"""
Direct PrizePicks API scraper - standalone.
"""

import asyncio
import httpx
import json
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), 'Sports-Steve-main', '.env'))

# PrizePicks session from .env
SESSION = os.getenv("PRIZEPICKS_SESSION_COOKIE", "") or os.getenv("PRIZEPICKS_SESSION", "")
ODDS_API_KEY = os.getenv("THE_ODDS_API_KEY", "")

BASE_URL = "https://api.prizepicks.com"
ODDS_URL = "https://api.the-odds-api.com/v4"

LEAGUE_MAP = {"NBA": 7, "NFL": 5, "NHL": 9, "MLB": 3}


async def get_prizepicks(sport: str = "NBA", limit: int = 20) -> list:
    """Get PrizePicks projections."""
    league_id = LEAGUE_MAP.get(sport.upper(), 7)
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://app.prizepicks.com/",
    }
    cookies = {"_prizepicks_session": SESSION}
    
    async with httpx.AsyncClient(headers=headers, cookies=cookies, timeout=15.0) as client:
        r = await client.get(
            f"{BASE_URL}/projections",
            params={"league_id": league_id, "per_page": limit, "single_stat": True}
        )
        
        if r.status_code != 200:
            return {"error": f"HTTP {r.status_code}"}
        
        data = r.json()
        
        # Parse players
        players = {}
        for item in data.get("included", []):
            if item.get("type") == "new_player":
                players[item["id"]] = item["attributes"].get("name", "Unknown")
        
        picks = []
        for proj in data.get("data", []):
            attrs = proj.get("attributes", {})
            player_id = proj.get("relationships", {}).get("new_player", {}).get("data", {}).get("id", "")
            
            picks.append({
                "player": players.get(player_id, "Unknown"),
                "stat_type": attrs.get("stat_type", "PTS"),
                "line": attrs.get("line", 0),
                "sport": sport
            })
        
        return picks


async def get_odds(sport: str = "basketball_nba") -> list:
    """Get game odds from The Odds API."""
    if not ODDS_API_KEY:
        return {"error": "No THE_ODDS_API_KEY"}
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(
            f"{ODDS_URL}/sports",
            params={"api_key": ODDS_API_KEY}
        )
        
        if r.status_code != 200:
            return {"error": f"HTTP {r.status_code}: {r.text}"}
        
        return r.json()


async def match_picks(pp_picks: list, odds_data: list) -> list:
    """Match PrizePicks to game lines."""
    matched = []
    
    for game in odds_data:
        home = game.get("home_team", "")
        away = game.get("away_team", "")
        markets = game.get("bookmakers", [{}])[0].get("markets", [])
        
        for market in markets:
            for outcome in market.get("outcomes", []):
                matched.append({
                    "game": f"{away} @ {home}",
                    "team": outcome.get("description"),
                    "line": outcome.get("point"),
                    "odds": outcome.get("price"),
                    "sport": sport
                })
    
    return matched[:20]


async def main():
    print(f"Session: {SESSION[:20] if SESSION else 'MISSING'}...")
    print(f"OddsAPI: {ODDS_API_KEY[:20] if ODDS_API_KEY else 'MISSING'}")
    print()
    
    # Get PrizePicks
    print("=== PrizePicks ===")
    pp = await get_prizepicks("NBA", 10)
    if isinstance(pp, dict) and "error" in pp:
        print(f"Error: {pp['error']}")
    else:
        print(f"Got {len(pp)} picks:")
        for p in pp[:5]:
            print(f"  {p['player']} {p['stat_type']} {p['line']}")
    
    print()
    
    # Get Odds API
    print("=== The Odds API ===")
    if ODDS_API_KEY:
        odds = await get_odds("basketball_nba")
        if isinstance(odds, dict) and "error" in odds:
            print(f"Error: {odds['error']}")
        else:
            print(f"Got {len(odds)} games:")
            for g in odds[:3]:
                print(f"  {g.get('away_team')} @ {g.get('home_team')}")
    else:
        print("No API key - skipping")


if __name__ == "__main__":
    asyncio.run(main())