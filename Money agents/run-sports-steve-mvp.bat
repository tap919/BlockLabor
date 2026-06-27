@echo off
cd /d "C:\Users\User\Desktop\Money agents\Sports-Steve-main\new_sports_steve\backend"
python -m uvicorn main:app --port 8010 --host 0.0.0.0
pause
