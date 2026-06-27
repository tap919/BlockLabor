# Money Agents - Quick Start

## Option 1: Run Server + Dashboard
```cmd
cd C:\Users\User\Desktop\Money agents\Sports-Steve-main
python -m uvicorn src.main:app --port 8010 --host 127.0.0.1
```
Then open: http://127.0.0.1:8010/api/v1/health

## Option 2: Just Get Live Data
```cmd
cd C:\Users\User\Desktop\Money agents
python quick-api.py
```

## Current Config
- PrizePicks: ✅ Working (5000+ picks)
- The Odds API: ✅ Working (84 games)
- Scheduler: Runs daily @ 9AM
- Bankroll: $1000

## Key Files
- `quick-api.py` - Live data script
- `scraper.py` - PrizePicks + Odds API
- `Sports-Steve-main/.env` - Configuration
- `run-server.bat` - Start server