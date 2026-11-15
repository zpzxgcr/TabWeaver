/** Local, opt-in diagnostic ring buffer. Loaded only by the background worker. */
(() => {
  const KEY = 'tabweaverDiagnostics';
  const LIMIT = 400;
  const MAX_CHARS = 700000;
  let queue = Promise.resolve();
  let flushRunning = false;
  let flushRequested = false;
  let flushTimer;
  let sinkStatus = { connected: false, directory: '', pending: 0, lastError: '' };
  const eventId = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  function scheduleFlush(delay = 150) {
    if (typeof fetch !== 'function' || typeof setTimeout !== 'function' || flushTimer) return;
    flushTimer = setTimeout(() => { flushTimer = null; void flushToDirectory(); }, delay);
  }
  async function flushToDirectory() {
    if (typeof fetch !== 'function') return;
    if (flushRunning) { flushRequested = true; return; }
    flushRunning = true;
    let more = false;
    try {
      const data = await snapshot();
      if (!data.enabled) return;
      const cursor = (await chrome.storage.local.get('tabweaverLogCursor')).tabweaverLogCursor;
      const index = data.events.findIndex(event => event.id === cursor);
      const pending = data.events.slice(index + 1);
      sinkStatus.pending = pending.length;
      if (!pending.length) {
        const health = await fetch('http://127.0.0.1:17321/health', { headers: { 'X-TabWeaver-Client': chrome.runtime.id }, signal: AbortSignal.timeout(2000) });
        if (!health.ok) throw new Error('Collector HTTP ' + health.status);
        const info = await health.json();
        if (!info.ok) throw new Error('Collector health check failed');
        sinkStatus = { ...sinkStatus, connected: true, directory: info.directory, lastError: '' };
        return;
      }
      const batch = [];
      let chars = 0;
      for (const event of pending) {
        const length = JSON.stringify(event).length;
        if (batch.length && (batch.length >= 20 || chars + length > 300000)) break;
        batch.push(event);
        chars += length;
      }
      const response = await fetch('http://127.0.0.1:17321/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-TabWeaver-Client': chrome.runtime.id },
        body: JSON.stringify({ events: batch }), signal: AbortSignal.timeout(2000)
      });
      if (!response.ok) throw new Error('Collector HTTP ' + response.status);
      const result = await response.json();
      if (!result.ok) throw new Error('Collector did not acknowledge the write');
      await chrome.storage.local.set({ tabweaverLogCursor: batch[batch.length - 1].id });
      sinkStatus = { connected: true, directory: result.directory, pending: pending.length - batch.length, lastError: '', lastWrite: new Date().toISOString() };
      more = pending.length > batch.length || (await snapshot()).events.at(-1)?.id !== batch.at(-1).id;
    } catch (error) {
      sinkStatus = { ...sinkStatus, connected: false, lastError: error.message };
    } finally {
      flushRunning = false;
      if (more || flushRequested) { flushRequested = false; scheduleFlush(); }
    }
  }
  function getSinkStatus() { scheduleFlush(); return { ...sinkStatus }; }
  function serial(job) {
    const next = queue.then(job);
    queue = next.catch(() => {});
    return next;
  }
  function clean(value, depth = 0) {
    if (depth > 5) return '[depth limited]';
    if (typeof value === 'string') return value.replace(/(Bearer\s+)[\w.\-]+/gi, '$1[redacted]').slice(0, 12000);
    if (Array.isArray(value)) return value.slice(0, 40).map(v => clean(v, depth + 1));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).slice(0, 50).map(([k, v]) => [k, /password|cookie|authorization|token|secret/i.test(k) ? '[redacted]' : clean(v, depth + 1)]));
    }
    return value;
  }
  async function load() {
    const result = await chrome.storage.local.get(KEY);
    const data = result[KEY] || { enabled: false, captureContent: false, events: [] };
    if (data.events.some(event => !event.id)) {
      data.events.forEach(event => { if (!event.id) event.id = eventId(); });
      await chrome.storage.local.set({ [KEY]: data });
    }
    return data;
  }
  function record(event) {
    return serial(async () => {
      const data = await load();
      if (!data.enabled) return;
      const { content, ...metadata } = event;
      const entry = clean({ ...metadata, id: eventId(), time: new Date().toISOString() });
      if (data.captureContent && content !== undefined) entry.content = clean(content);
      data.events.push(entry);
      data.events = data.events.slice(-LIMIT);
      while (JSON.stringify(data.events).length > MAX_CHARS) data.events.shift();
      await chrome.storage.local.set({ [KEY]: data });
      scheduleFlush();
      return entry.id;
    });
  }
  async function probe() {
    if (!(await snapshot()).enabled) throw new Error('请先开启开发日志');
    const id = await record({ source: 'debug', event: 'diagnostics.probe', synthetic: true, purpose: 'Verify extension-to-disk delivery; not a browser task execution' });
    const deadline = Date.now() + 7000;
    while (Date.now() < deadline) {
      await flushToDirectory();
      const cursor = (await chrome.storage.local.get('tabweaverLogCursor')).tabweaverLogCursor;
      const data = await snapshot();
      const probeIndex = data.events.findIndex(event => event.id === id);
      const cursorIndex = data.events.findIndex(event => event.id === cursor);
      if (probeIndex >= 0 && cursorIndex >= probeIndex && sinkStatus.connected) {
        return { delivered: true, probeId: id, directory: sinkStatus.directory };
      }
      if (!sinkStatus.connected && !flushRunning) break;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    return { delivered: false, probeId: id, directory: sinkStatus.directory, error: sinkStatus.lastError || '尚未收到磁盘写入确认' };
  }
  function configure(settings) {
    return serial(async () => {
      const data = await load();
      data.enabled = settings.enabled === true;
      data.captureContent = data.enabled && settings.captureContent === true;
      data.events.push({ id: eventId(), time: new Date().toISOString(), source: 'debug', event: 'settings.changed', enabled: data.enabled, captureContent: data.captureContent });
      data.events = data.events.slice(-LIMIT);
      await chrome.storage.local.set({ [KEY]: data });
      if (data.enabled) scheduleFlush();
      return { enabled: data.enabled, captureContent: data.captureContent, count: data.events.length };
    });
  }
  function snapshot() { return serial(load); }
  function clear() {
    return serial(async () => {
      const data = await load();
      data.events = [];
      await chrome.storage.local.set({ [KEY]: data, tabweaverLogCursor: null });
      sinkStatus.pending = 0;
    });
  }
  function safeUrl(url) {
    try { const parsed = new URL(url); return parsed.origin + parsed.pathname; } catch { return ''; }
  }
  globalThis.TabWeaverDebug = { record, configure, snapshot, clear, safeUrl, getSinkStatus, flushToDirectory, probe };
})();
