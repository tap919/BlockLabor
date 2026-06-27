#!/usr/bin/env python
"""Quick API server."""
import asyncio
import json
import sys
from pathlib import Path

# Load env
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / 'Sports-Steve-main' / '.env')

async def main():
    from scraper import get_prizepicks, get_odds
    
    print("=== PrizePicks ===")
    pp = await get_prizepicks("NBA", 10)
    if isinstance(pp, list):
        print(f"Got {len(pp)} picks")
        for p in pp[:3]:
            print(f"  {p['player'][:30]} {p['stat_type']} {p['line']}")
    else:
        print(pp)
    
    print("\n=== Odds API ===")
    odds = await get_odds()
    if isinstance(odds, list):
        print(f"Got {len(odds)} games")
    else:
        print(odds)

if __name__ == "__main__":
    asyncio.run(main())