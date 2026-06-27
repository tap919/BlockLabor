@echo off
REM Money Agents - Quick Start
REM ========================

echo Starting Sports Steve MVP on port 8010...
cd /d "%~dp0Sports-Steve-main\new_sports_steve\backend"
start "SportsSteve" cmd /k "python -m uvicorn main:app --port 8010 --host 127.0.0.1 --reload"

timeout /t 3 /nobreak > nul

echo.
echo Opening dashboard...
start http://127.0.0.1:8010

echo.
echo ========================
echo Servers running:
echo   MVP:  http://127.0.0.1:8010
echo.
echo To add real API keys, edit:
echo   Sports-Steve-main\.env
echo.
echo Press any key to exit...
pause > nul