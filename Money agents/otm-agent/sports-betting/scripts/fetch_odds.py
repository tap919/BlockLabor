#!/usr/bin/env python3
"""
Fetch sports odds from The Odds API.

Usage:
  python fetch_odds.py --sport americanfootball_nfl --market h2h
  python fetch_odds.py --sport basketball_nba --market spreads --days 1
  python fetch_odds.py --sport americanfootball_nfl --market h2h --arb
  python fetch_odds.py --sports          # list available sports
  python fetch_odds.py --format json --sport americanfootball_nfl --market h2h
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any
from urllib.request import urlopen, Request
from urllib.parse import urlencode


BASE_URL = "https://api.the-odds-api.com/v4"


def get_api_key() -> str:
    key = os.environ.get("ODDS_API_KEY")
    if not key:
        sys.exit("Set ODDS_API_KEY env var. Get a key at https://the-odds-api.com")
    return key


def api_get(path: str, params: dict) -> Any:
    params["apiKey"] = get_api_key()
    url = f"{BASE_URL}{path}?{urlencode(params)}"
    req = Request(url, headers={"Accept": "application/json"})
    try:
        with urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except Exception as exc:
        sys.exit(f"API request failed: {exc}")


def list_sports() -> None:
    sports = api_get("/sports", {"all": "false"})
    print(f"{'Key':<40} {'Title'}")
    print("-" * 70)
    for s in sports:
        print(f"{s['key']:<40} {s['title']}")


def implied_prob(decimal_odds: float) -> float:
    return 1.0 / decimal_odds if decimal_odds > 0 else 0.0


def american_to_decimal(american: int) -> float:
    if american > 0:
        return american / 100 + 1
    return 100 / abs(american) + 1


def find_arb(events: list[dict]) -> list[dict]:
    """Find two-way arbitrage opportunities across bookmakers."""
    opportunities = []
    for event in events:
        bookmakers = event.get("bookmakers", [])
        outcomes_by_name: dict[str, list[tuple[float, str]]] = {}
        for bm in bookmakers:
            for market in bm.get("markets", []):
                for outcome in market.get("outcomes", []):
                    name = outcome["name"]
                    price = outcome.get("price", 0)
                    if price < 1.01:
                        continue
                    if name not in outcomes_by_name:
                        outcomes_by_name[name] = []
                    outcomes_by_name[name].append((price, bm["key"]))

        outcome_names = list(outcomes_by_name.keys())
        if len(outcome_names) < 2:
            continue

        best: list[tuple[float, str, str]] = []
        for name in outcome_names:
            prices = outcomes_by_name[name]
            if not prices:
                continue
            best_price, best_book = max(prices, key=lambda x: x[0])
            best.append((best_price, best_book, name))

        arb_sum = sum(implied_prob(p) for p, _, _ in best)
        if arb_sum < 1.0:
            profit_pct = (1 - arb_sum) * 100
            stake = 1000.0
            stakes = [stake * implied_prob(p) / arb_sum for p, _, _ in best]
            opportunities.append({
                "event": f"{event.get('home_team')} vs {event.get('away_team')}",
                "commence": event.get("commence_time", "")[:10],
                "profit_pct": round(profit_pct, 2),
                "sides": [
                    {"outcome": name, "book": book, "odds": price, "stake_per_1000": round(stake_amt, 2)}
                    for (price, book, name), stake_amt in zip(best, stakes)
                ],
            })

    return sorted(opportunities, key=lambda x: -x["profit_pct"])


def fetch_odds(sport: str, market: str, regions: str = "us") -> list[dict]:
    data = api_get(f"/sports/{sport}/odds", {
        "regions": regions,
        "markets": market,
        "oddsFormat": "decimal",
    })
    return data


def render_odds_table(events: list[dict], market: str) -> None:
    if not events:
        print("No events found.")
        return
    for event in events:
        home = event.get("home_team", "?")
        away = event.get("away_team", "?")
        commence = event.get("commence_time", "")[:10]
        print(f"\n{away} @ {home}  [{commence}]")

        best_by_outcome: dict[str, tuple[float, str]] = {}
        for bm in event.get("bookmakers", []):
            for mkt in bm.get("markets", []):
                if mkt["key"] != market:
                    continue
                for outcome in mkt.get("outcomes", []):
                    name = outcome["name"]
                    price = float(outcome.get("price", 0))
                    if name not in best_by_outcome or price > best_by_outcome[name][0]:
                        best_by_outcome[name] = (price, bm["title"])

        for name, (price, book) in sorted(best_by_outcome.items()):
            prob = implied_prob(price) * 100
            print(f"  {name:<25} {price:.3f} ({prob:.1f}% impl prob)  — best: {book}")


def render_arb_table(arbs: list[dict]) -> None:
    if not arbs:
        print("No arbitrage opportunities found.")
        return
    print(f"{'Event':<45} {'Profit%':<10} {'Sides'}")
    print("-" * 90)
    for arb in arbs:
        sides_str = "  |  ".join(
            f"{s['outcome']} @ {s['odds']:.3f} ({s['book']})" for s in arb["sides"]
        )
        print(f"{arb['event'][:44]:<45} {arb['profit_pct']:+.2f}%    {sides_str}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch sports odds from The Odds API.")
    parser.add_argument("--sport", help="Sport key (e.g. americanfootball_nfl)")
    parser.add_argument("--market", default="h2h", help="Market type: h2h, spreads, totals (default: h2h)")
    parser.add_argument("--regions", default="us", help="Regions: us, uk, eu, au (default: us)")
    parser.add_argument("--arb", action="store_true", help="Show arbitrage opportunities only")
    parser.add_argument("--sports", action="store_true", help="List available sports")
    parser.add_argument("--format", choices=["table", "json"], default="table")
    args = parser.parse_args()

    if args.sports:
        list_sports()
        return 0

    if not args.sport:
        parser.error("--sport is required (or use --sports to list options)")

    events = fetch_odds(args.sport, args.market, args.regions)

    if args.format == "json":
        if args.arb:
            print(json.dumps(find_arb(events), indent=2))
        else:
            print(json.dumps(events, indent=2))
        return 0

    if args.arb:
        arbs = find_arb(events)
        print(f"Arbitrage opportunities for {args.sport} [{args.market}]:\n")
        render_arb_table(arbs)
    else:
        print(f"Odds for {args.sport} [{args.market}] — {len(events)} event(s):")
        render_odds_table(events, args.market)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
