@echo off
echo ================================
echo = MONEY AGENTS              =
echo ================================
echo.
cd /d "%~dp0Sports-Steve-main"

echo Starting Sports Steve on port 8010...
python -m uvicorn src.main:app --port 8010 --host 127.0.0.1
echo.
echo Server stopped.