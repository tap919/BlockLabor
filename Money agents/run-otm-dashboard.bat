@echo off
REM Money Agents - OTM Dashboard Launcher
REM Run this file to start the OTM web dashboard on localhost:3000

echo ============================================
echo   OTM Agent Dashboard
echo   http://localhost:3000
echo ============================================
echo.

cd /d "C:\Users\User\Desktop\Money agents"
echo Starting Next.js development server...
echo.
echo Once ready, open: http://localhost:3000
echo.

npx next dev -p 3000 --experimental-https

REM If you get errors, try:
REM   npx next dev -p 3000 -H 127.0.0.1