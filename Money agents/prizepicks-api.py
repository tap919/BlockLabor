"""
PrizePicks scraper using API with session cookie.
"""

import asyncio
import httpx
import json
import os
import re
from dotenv import load_dotenv

load_dotenv()

PRIZEPICKS_SESSION = os.getenv("PRIZEPICKS_SESSION_COOKIE", "")
BASE_URL = "https://api.prizepicks.com"

LEAGUE_MAP = {"NBA": 7, "NFL": 5, "NHL": 9, "MLB": 3}


async def get_with_session(url: str, session: str, params: dict = None) -> dict:
    """Make request with session cookie."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://app.prizepicks.com/",
        "Accept": "application/json",
    }
    cookies = {"_prizepicks_session": session}
    
    async with httpx.AsyncClient(headers=headers, cookies=cookies, timeout=15.0) as client:
        r = await client.get(url, params=params)
        return r.json() if r.status_code == 200 else {}


async def get_balance(session: str) -> float:
    """Get account info and extract balance."""
    data = await get_with_session(f"{BASE_URL}/account", session)
    # Try to find balance in response
    print(json.dumps(data, indent=2)[:500])
    return 0.0


async def get_picks(session: str, sport: str = "NBA") -> list[dict]:
    """Get picks for a sport."""
    league_id = LEAGUE_MAP.get(sport.upper(), 7)
    
    params = {"league_id": league_id, "per_page": 50, "single_stat": True}
    data = await get_with_session(f"{BASE_URL}/projections", session, params)
    
    players = {}
    for item in data.get("included", []):
        if item.get("type") == "new_player":
            players[item["id"]] = item["attributes"].get("name", "Unknown")
    
    picks = []
    for proj in data.get("data", []):
        attrs = proj.get("attributes", {})
        player_id = proj.get("relationships", {}).get("new_player", {}).get("data", {}).get("id", "")
        player = players.get(player_id, "Unknown")
        stat_type = attrs.get("stat_type", "PTS")
        line = attrs.get("line", 0)
        
        picks.append({
            "player": player,
            "stat_type": stat_type,
            "line": line,
            "sport": sport,
            "id": proj.get("id")
        })
    
    return picks


async def main():
    session = PRIZEPICKS_SESSION
    
    print(f"Session: {session[:20]}...")
    
    # Get picks
    picks = await get_picks(session, "NBA")
    print(f"NBA picks: {len(picks)}")
    
    if picks:
        for p in picks[:5]:
            print(f"  {p['player']} {p['stat_type']} {p['line']}")
    
    # Try NFL
    picks_nfl = await get_picks(session, "NFL")
    print(f"NFL picks: {len(picks_nfl)}")


if __name__ == "__main__":
    asyncio.run(main())