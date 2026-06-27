@echo off
REM Money Agents - Quick Start
REM Runs both the MVP backend and dashboard

echo ========================================
echo   Money Agents - Quick Start
echo ========================================
echo.

REM Kill any existing processes
taskkill /F /IM python.exe 2>nul
taskkill /F /IM node.exe 2>nul

timeout /t 2 >nul

REM Start MVP Backend
echo [1] Starting MVP Backend on port 8010...
start "MVP" cmd /k "cd /d C:\Users\User\Desktop\Money agents\Sports-Steve-main\new_sports_steve\backend && python -m uvicorn main:app --port 8010 --host 127.0.0.1"

timeout /t 4 >nul

REM Start Dashboard Server  
echo [2] Starting Dashboard on port 3006...
start "Dashboard" cmd /k "cd /d C:\Users\User\Desktop\Money agents && node serve.js"

timeout /t 3 >nul

echo.
echo ========================================
echo   READY - Open in browser:
echo   http://127.0.0.1:3006
echo ========================================
echo.

REM Test connectivity
echo Testing...
node -e "const h=require('http');h.get('http://127.0.0.1:3006',r=>process.exit(r.statusCode===200?0:1))" && echo Dashboard: OK || echo Dashboard: FAIL
node -e "const h=require('http');h.get('http://127.0.0.1:8010/health',r=>process.exit(r.statusCode===200?0:1))" && echo MVP: OK || echo MVP: FAIL

pause