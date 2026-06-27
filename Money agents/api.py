"""
Simple API wrapper - returns JSON for dashboard.
"""

import asyncio
import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent))

async def get_data():
    from scraper import get_prizepicks, get_odds
    
    pp = await get_prizepicks("NBA", 20)
    if isinstance(pp, dict) and "error" in pp:
        pp = []
    
    odds = await get_odds()
    if isinstance(odds, dict) and "error" in odds:
        odds = []
    odds = odds[:10]  # Limit
    
    return {"prizePicks": pp, "oddsApi": odds}

if __name__ == "__main__":
    import json
    result = asyncio.run(get_data())
    print(json.dumps(result, indent=2))