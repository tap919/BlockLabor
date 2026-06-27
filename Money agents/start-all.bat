@echo off
REM Money Agents - Full System Launcher
REM Starts all services for 24/7 operation

echo ============================================
echo   MONEY AGENTS - 24/7 Financial Sandbox
echo ============================================
echo.

REM Start Sports Steve MVP in a new window
echo [1/3] Starting Sports Steve MVP (port 8010)...
start "Sports Steve MVP" cmd /k "cd /d C:\Users\User\Desktop\Money agents\Sports-Steve-main\new_sports_steve\backend && python -m uvicorn main:app --port 8010 --host 0.0.0.0"

timeout /t 3 >nul

REM Start OTM Dashboard
echo [2/3] Starting OTM Dashboard (port 3000)...
start "OTM Dashboard" cmd /k "cd /d C:\Users\User\Desktop\Money agents && npm run dev"

timeout /t 3 >nul

REM Run health check
echo [3/3] Running system health check...
echo.
node scripts\check-all-health.js

echo.
echo ============================================
echo   SYSTEM STATUS
echo ============================================
echo.
echo Sports Steve MVP: http://localhost:8010
echo OTM Dashboard:     http://localhost:3000
echo.
echo Run full integration test:
echo   node scripts\full-integration-test.js
echo.
echo Press any key to open dashboard...
pause >nul

start http://localhost:3000