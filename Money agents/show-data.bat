@echo off
REM Money Agents - Quick Start (No persistent server needed)
cd /d "%~dp0"

echo ======================================
echo   Money Agents - Live Data
echo ======================================
echo.

echo Getting PrizePicks data...
python quick-api.py

echo.
echo Done. Press any key to exit...
pause > nul