---
name: sports-betting
description: Sports betting agent for DraftKings, FanDuel, and odds aggregator APIs. Use when analyzing bet opportunities, comparing odds across books, calculating Kelly criterion bet sizes, tracking active bets, reviewing win/loss history, finding arbitrage, or managing a betting bankroll. Trigger phrases include "check the odds", "find value bets", "place a bet", "betting bankroll", "arbitrage", "Kelly criterion", "bet on [game/team]", "betting P&L", "sharps lines".
---

# Sports Betting

Sports betting agent for DraftKings/FanDuel and odds aggregator APIs (The Odds API, OddsJam). Covers bet analysis, Kelly sizing, bankroll management, and tracking.

## Data Sources

| Source       | What It Provides                     | API                                |
| ------------ | ------------------------------------ | ---------------------------------- |
| The Odds API | Odds from 40+ books, live lines      | `https://api.the-odds-api.com`     |
| OddsJam      | Sharp lines, EV finder, CLV tracking | `https://api.oddsjam.com`          |
| DraftKings   | Place bets, check balance            | No official API — use web scraping |
| FanDuel      | Place bets, check balance            | No official API — use web scraping |

Set `ODDS_API_KEY` env var for The Odds API. See `references/odds-api.md` for endpoints.

## Core Workflows

### Find Value Bets

```bash
python {baseDir}/scripts/fetch_odds.py --sport americanfootball_nfl --market h2h
python {baseDir}/scripts/fetch_odds.py --sport basketball_nba --market spreads --days 1
```

Output: event, best available odds per outcome, implied probability, and fair value estimate.

### Calculate Kelly Bet Size

Given bankroll B, decimal odds D, and win probability p:

```
Kelly fraction f = (p * D - 1) / (D - 1)
Bet size = B * f * (fraction cap, default 0.05)
```

Use fractional Kelly (half-Kelly = f/2) to reduce variance. Never exceed 5% of bankroll on a single bet regardless of Kelly output.

```bash
python {baseDir}/scripts/bet_tracker.py kelly --bankroll 5000 --odds 2.10 --prob 0.52
```

### Place a Bet

Manual workflow (no direct API):

1. Fetch recommended bet from `fetch_odds.py`
2. Agent presents: event, book, bet type, odds, recommended size
3. User confirms and places manually on DraftKings or FanDuel
4. Log the bet: `python {baseDir}/scripts/bet_tracker.py log --event "..." --book dk --odds 2.10 --stake 50`

### Track Active Bets

```bash
python {baseDir}/scripts/bet_tracker.py status          # open bets
python {baseDir}/scripts/bet_tracker.py history --days 30  # win/loss history
python {baseDir}/scripts/bet_tracker.py summary         # bankroll, ROI, CLV
```

### Find Arbitrage

```bash
python {baseDir}/scripts/fetch_odds.py --sport americanfootball_nfl --market h2h --arb
```

Outputs any two-way arb opportunities with guaranteed profit %, stake split, and both books.

## Bankroll Rules

- Starting bankroll is a fixed allocation from the financial-hub (default 15% of total portfolio)
- Replenish from business profits, not from trading accounts, when below 50% of target bankroll
- Flat-betting maximum: 2% of bankroll per bet
- Kelly-sized bets: use half-Kelly, cap at 5%
- Stop betting for the day if bankroll drops 10% in one session

## References

- `references/odds-api.md` — The Odds API endpoints, sports keys, market types
- `references/bankroll-management.md` — Kelly formula, CLV tracking, ROI analysis
