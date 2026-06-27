# The Odds API Reference

## Authentication

Set `ODDS_API_KEY` env var. Free tier: 500 requests/month. Paid tiers available.

Get a key: https://the-odds-api.com

## Base URL

```
https://api.the-odds-api.com/v4
```

## Key Endpoints

### List Sports

```
GET /sports?apiKey={key}&all=false
```

Common sport keys:

| Key                      | Sport           |
| ------------------------ | --------------- |
| `americanfootball_nfl`   | NFL             |
| `americanfootball_ncaaf` | NCAA Football   |
| `basketball_nba`         | NBA             |
| `basketball_ncaab`       | NCAA Basketball |
| `baseball_mlb`           | MLB             |
| `icehockey_nhl`          | NHL             |
| `soccer_usa_mls`         | MLS             |
| `tennis_atp_french_open` | ATP Tennis      |
| `mma_mixed_martial_arts` | MMA/UFC         |

### Get Odds

```
GET /sports/{sport}/odds?apiKey={key}&regions={regions}&markets={markets}&oddsFormat=decimal
```

Parameters:

| Param        | Values                     | Notes                                   |
| ------------ | -------------------------- | --------------------------------------- |
| `regions`    | `us`, `uk`, `eu`, `au`     | Comma-separated, US = DK/FD/MGM etc.    |
| `markets`    | `h2h`, `spreads`, `totals` | Comma-separated                         |
| `oddsFormat` | `decimal`, `american`      | Prefer `decimal` for Kelly calculations |
| `bookmakers` | `draftkings,fanduel,...`   | Optional — filter specific books        |
| `dateFormat` | `iso`                      | ISO timestamp (default)                 |

### Response Structure

```json
[
  {
    "id": "...",
    "sport_key": "americanfootball_nfl",
    "sport_title": "NFL",
    "commence_time": "2026-01-15T18:00:00Z",
    "home_team": "Kansas City Chiefs",
    "away_team": "Buffalo Bills",
    "bookmakers": [
      {
        "key": "draftkings",
        "title": "DraftKings",
        "last_update": "2026-01-15T17:45:00Z",
        "markets": [
          {
            "key": "h2h",
            "outcomes": [
              { "name": "Kansas City Chiefs", "price": 1.91 },
              { "name": "Buffalo Bills", "price": 1.95 }
            ]
          }
        ]
      }
    ]
  }
]
```

## Common Bookmaker Keys (US)

| Key              | Name             |
| ---------------- | ---------------- |
| `draftkings`     | DraftKings       |
| `fanduel`        | FanDuel          |
| `betmgm`         | BetMGM           |
| `caesars`        | Caesars          |
| `pointsbetus`    | PointsBet        |
| `williamhill_us` | William Hill US  |
| `bovada`         | Bovada           |
| `pinnacle`       | Pinnacle (sharp) |

## Rate Limit / Request Cost

Each API call uses request quota. Check `X-Requests-Remaining` and `X-Requests-Used` response headers to track usage.

To minimize quota use:

- Cache odds responses for 5-10 minutes (odds rarely change faster)
- Use `--bookmakers` filter when only comparing DK/FD
- Use `fetch_odds.py --format json > /tmp/odds.json` and reprocess locally
