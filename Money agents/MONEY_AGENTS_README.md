# Money Agents - 24/7 Financial Sandbox Ecosystem

## System Overview

The Money Agents system is a multi-agent financial sandbox that coordinates specialized agents to discover, validate, and execute legal income opportunities around the clock. It combines supervised autonomy with strong governance rails, audit trails, and human-in-the-loop approval gates.

```
┌─────────────────────────────────────────────────────────┐
│                    OTM DASHBOARD                         │
│            http://localhost:3000                        │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐     │
│  │ Hermes      │  │ Sports Steve│  │ OmniVoice    │     │
│  │ (Primary    │  │ MVP (Bet)   │  │ (Voice)      │     │
│  │  Agent)     │  │  :8010      │  │  :8000       │     │
│  └─────────────┘  └─────────────┘  └──────────────┘     │
│         │                │                │              │
│         └────────────────┼────────────────┘          │
│                          │                              │
│              ┌──────────┴──────────┐                   │
│              │  RECEIPT LEDGER      │                   │
│              │  (Audit Trail)       │                   │
│              └─────────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

## Architecture

| Component | Role | Port | Status |
|-----------|------|------|--------|
| **OTM Dashboard** | Main orchestrator UI, strategy selection, risk controls | 3000 | ✅ Ready |
| **Hermes** | Primary AI agent — orchestrates all sub-agents | CLI | ✅ Ready |
| **Sports Steve MVP** | Sports betting analysis, Kelly criterion picks | 8010 | ✅ Ready |
| **OmniVoice** | Voice cloning, TTS, voice reports | 8000 | 🔜 Start manually |
| **Bet Buddy** | Odds calc, bankroll tracking, slip OCR | 3001 | 🔜 Start manually |

## Quick Start

### 1. Start Sports Steve MVP (backend)
```bat
cd "C:\Users\User\Desktop\Money agents\Sports-Steve-main\new_sports_steve\backend"
python -m uvicorn main:app --port 8010 --host 0.0.0.0
```

### 2. Start OTM Dashboard
```bat
cd "C:\Users\User\Desktop\Money agents"
npm run dev
```
Then open **http://localhost:3000** in your browser.

### 3. Verify all services
```bat
node scripts/check-all-health.js
node scripts/full-integration-test.js
```

## Core Agents

### Hermes (Primary Agent)
The central orchestrator that coordinates all sub-agents.
- **Tools**: sports_steve_v2_health, sports_steve_v2_analyze, sports_steve_v2_picks
- **Location**: `hermes-tools/sports-steve-v2.js`

### Sports Steve MVP (Betting Agent)
Lightweight sports betting analysis backend.
- **Endpoint**: `http://localhost:8010`
- **Health**: `GET /health` → `{status: ok, version: 0.1.0}`
- **Analyze**: `POST /analyze` with `{sport, bankroll, max_risk_pct}` → `{strategy, picks}`

## Risk Controls

| Control | Purpose |
|---------|---------|
| **Kill Switch** | Instantly halts all agent activity |
| **Budget** | Max capital deployed per session |
| **Stop-Loss** | Auto-kill if losses exceed threshold |
| **Receipt Ledger** | Every action logged with validation status |
| **Human Approval Gates** | High-risk actions require explicit approval |

## Available Scripts

| Script | Purpose |
|--------|---------|
| `node scripts/check-all-health.js` | Check health of all services |
| `node scripts/integration-test-sports-steve.js` | Test Sports Steve MVP |
| `node scripts/full-integration-test.js` | End-to-end Hermes → MVP → Receipt |
| `node hermes-tools/demo-hermes-sports-steve.js` | Hermes tool demo |

## System Files

```
Money agents/
├── hermes-tools/
│   ├── sports-steve-v2.js      # Hermes wrapper for MVP
│   └── demo-hermes-sports-steve.js  # Demo usage
├── Sports-Steve-main/
│   └── new_sports_steve/        # MVP backend (port 8010)
│       └── backend/
│           └── main.py           # FastAPI app
├── scripts/
│   ├── check-all-health.js      # Multi-service health checker
│   ├── integration-test-sports-steve.js  # MVP smoke test
│   ├── full-integration-test.js # Full flow test
│   └── playwright-health.js      # UI health check
├── components/
│   └── services-panel.tsx       # Network status panel in OTM
├── lib/
│   ├── store.ts                # Zustand store (services, receipts, etc)
│   ├── data.ts                 # Strategy definitions
│   ├── judge.ts                # Validation logic
│   └── utils.ts                # Utilities
└── start-sports-steve-mvp.ps1   # Launcher for Sports Steve MVP
```

## Revenue Loops Implemented

1. **Lead Generation Loop** — Scout → Score → Outreach → CRM → Book
2. **Service Business Loop** — Package → Prospect → Close → Deliver → Invoice
3. **Sports Betting Loop** — Analyze → Pick → Stake → Track → Learn
4. **Content/Affiliate Loop** — Research → Create → Distribute → Convert → Prune

## Next Steps to Productionize

1. **Start OmniVoice** — Voice reports and alerts
2. **Add real API keys** — Stripe, HubSpot, Gmail
3. **Wire Hermes to OTM** — Show MVP results in dashboard
4. **Add compliance layer** — Tax, KYC, platform ToS checks
5. **Deploy to cloud** — For 24/7 availability without local machine

## Health Check Output

```json
[
  {"k": "otm", "url": "http://127.0.0.1:3000", "status": "offline"},
  {"k": "sports", "url": "http://localhost:8010/health", "status": "online", "code": 200},
  {"k": "omnivoice", "url": "http://localhost:8000/health", "status": "offline"}
]
```

Sports Steve MVP must show `"status": "online"` before running bets.

---
Built with OTM Agent framework. See README.md for full documentation.