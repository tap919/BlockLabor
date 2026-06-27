# Money Agents

## Quick Start

### Option 1: Double-click
```
quick-start-mvp.bat
```

### Option 2: Node.js Server
```
node servers.js
```

Then open: http://127.0.0.1:3006

---

## MVP Configuration

Edit `Sports-Steve-main/.env` to add API keys:

- `THE_ODDS_API_KEY` - Get free at theoddsapi.com
- `PRIZEPICKS_SESSION_COOKIE` - From browser inspector

---

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `POST /analyze` | Run analysis |
| `GET /picks` | Get picks |

---

## Tech Stack

- **Backend**: Python FastAPI (port 8010)
- **Dashboard**: Static HTML
- **Server**: Node.js proxy (port 3006)