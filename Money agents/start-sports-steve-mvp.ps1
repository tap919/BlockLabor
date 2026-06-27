Start-Process powershell -WorkingDirectory "C:\Users\User\Desktop\Money agents\Sports-Steve-main\new_sports_steve\backend" -ArgumentList "-NoExit", "python", "-m", "uvicorn", "main:app", "--port", "8010", "--host", "0.0.0.0"
Write-Host "Sports Steve MVP starting on http://localhost:8010"
