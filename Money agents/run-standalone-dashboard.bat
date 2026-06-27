@echo off
REM Money Agents - Standalone Dashboard (No Next.js required)
REM This serves a simple HTML dashboard that connects to Sports Steve

echo.
echo ============================================
echo   Money Agents - Standalone Dashboard
echo ============================================
echo.
echo Starting HTTP server on port 3005...
echo.
echo Once started, open: http://localhost:3005/standalone-dashboard.html
echo.
echo Make sure Sports Steve MVP is running on port 8010 first!
echo.

cd /d "C:\Users\User\Desktop\Money agents"
python -m http.server 3005

pause