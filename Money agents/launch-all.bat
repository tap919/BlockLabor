@echo off
REM Money Agents - All-In-One Autonomous Launcher
REM ======================================

echo ======================================
echo   Money Agents - Starting Ecosystem
echo ======================================
echo.

cd /d "%~dp0"

REM Kill existing processes
echo [1/4] Stopping existing servers...
taskkill /F /IM python.exe 2>nul
timeout /t 2 /nobreak > nul

REM Sports Steve (full) - port 8010
echo [2/4] Starting Sports Steve (port 8010)...
start "SportsSteve" cmd /k "cd Sports-Steve-main && python -m uvicorn src.main:app --port 8010 --host 127.0.0.1 --reload"

timeout /t 3 /nobreak > nul

REM Try OmniVoice - port 8000
echo [3/4] Starting OmniVoice (port 8000)...
cd OmniVoice-Studio-main\backend
if exist omnivoice (
    start "OmniVoice" cmd /k "python -m uvicorn main:app --port 8000 --host 127.0.0.1"
) else (
    echo [SKIP] OmniVoice not ready (missing dependencies)
)
cd ..\..

timeout /t 2 /nobreak > nul

REM Dashboard proxy - port 3006
echo [4/4] Starting Dashboard (port 3006)...
start "Dashboard" cmd /k "node servers.js"

echo.
echo ======================================
echo   Servers Running:
echo   - Sports Steve:  http://127.0.0.1:8010
echo   - Dashboard:   http://127.0.0.1:3006
echo.
echo   Wait 5 seconds for startup
echo ======================================
echo.
pause