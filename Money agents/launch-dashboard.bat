@echo off
REM Money Agents - Launch Dashboard
cd /d "%~dp0"

echo Starting Sports Steve...
start "SportsSteve" cmd /k "cd Sports-Steve-main && python -m uvicorn src.main:app --port 8010 --host 127.0.0.1"

timeout /t 4 /nobreak > nul

echo Starting Dashboard...
start "Dashboard" cmd /k "node dashboard-server.js"

timeout /t 2 /nobreak > nul

echo Opening browser...
start http://127.0.0.1:3006

pause