@echo off
setlocal
pushd "%~dp0"
if errorlevel 1 (
  echo Failed to open the Studio folder.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 or later is required.
  popd
  pause
  exit /b 1
)

rem Edit this list to export only the characters you need.
set "EXPORT_CHARACTERS=swordsman,archer,warrior,skeleton,slime,mage,goblin"
set "EXPORT_OUTPUT=./exports/all-characters"

if exist "%EXPORT_OUTPUT%" (
  echo The output already exists: %EXPORT_OUTPUT%
  echo Nothing was overwritten. Move the previous export or change EXPORT_OUTPUT in this file.
  popd
  pause
  exit /b 1
)

node tools/export-game.mjs --characters %EXPORT_CHARACTERS% --out "%EXPORT_OUTPUT%"
if errorlevel 1 (
  echo Export failed. See the error above.
  popd
  pause
  exit /b 1
)

echo.
echo Export complete: %EXPORT_OUTPUT%
echo Copy this folder to your other repository.
popd
pause
endlocal
exit /b 0
