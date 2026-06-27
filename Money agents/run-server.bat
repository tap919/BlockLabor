@echo off
cd /d "%~dp0Sports-Steve-main"
python -m uvicorn src.main:app --port 8010 --host 127.0.0.1
pause