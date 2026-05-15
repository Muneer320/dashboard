@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "REPO_ROOT=%%~fI"

echo Starting Mirage processor...
powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\backend\scripts\start_mirage_processor_server.ps1"
if errorlevel 1 (
  echo Failed to start Mirage processor.
  exit /b 1
)

echo Starting Mirage dashboard...
start "Mirage Dashboard" cmd /k "cd /d ""%SCRIPT_DIR%"" && npm run dev"

echo Waiting for dashboard server...
timeout /t 4 /nobreak >nul

start "" "http://localhost:4175"

echo Mirage Ops should now be starting:
echo   Dashboard: http://localhost:4175
echo   Processor: http://127.0.0.1:8765

endlocal
