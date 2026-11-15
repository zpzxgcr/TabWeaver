@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 or newer is required for the optional local log collector.
  pause
  exit /b 1
)
node scripts\debug-collector.cjs
pause
