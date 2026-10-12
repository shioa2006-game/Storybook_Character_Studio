@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 or later is required.
  pause
  exit /b 1
)
node "%~dp0tools\start-studio.mjs" --open
if errorlevel 1 (
  echo Failed to start character-studio. See the error above.
  pause
  exit /b 1
)
endlocal
