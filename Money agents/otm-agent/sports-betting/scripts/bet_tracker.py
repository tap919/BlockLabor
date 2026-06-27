#!/usr/bin/env python3
"""
Bet tracker — log bets, calculate Kelly, view status and history.

Usage:
  python bet_tracker.py kelly --bankroll 5000 --odds 2.10 --prob 0.52
  python bet_tracker.py log --event "Lakers vs Celtics" --book dk --odds 2.10 --stake 50 --selection "Lakers"
  python bet_tracker.py settle --event "Lakers vs Celtics" --result won
  python bet_tracker.py status
  python bet_tracker.py history --days 30
  python bet_tracker.py summary
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

BETS_LOG = Path(
    os.environ.get("OPENCLAW_FINANCE_DATA_DIR") or Path.home() / ".openclaw" / "finance"
) / "bets.jsonl"
BANKROLL_FILE = Path(
    os.environ.get("OPENCLAW_FINANCE_DATA_DIR") or Path.home() / ".openclaw" / "finance"
) / "bankroll.json"


# ─── File helpers ──────────────────────────────────────────────────────────────

def ensure_dir() -> None:
    BETS_LOG.parent.mkdir(parents=True, exist_ok=True)


def load_bets() -> list[dict]:
    if not BETS_LOG.exists():
        return []
    bets = []
    for line in BETS_LOG.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            bets.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return bets


def save_bets(bets: list[dict]) -> None:
    ensure_dir()
    BETS_LOG.write_text("\n".join(json.dumps(b) for b in bets) + "\n")


def append_bet(bet: dict) -> None:
    ensure_dir()
    with BETS_LOG.open("a") as f:
        f.write(json.dumps(bet) + "\n")


def load_bankroll() -> dict:
    if BANKROLL_FILE.exists():
        return json.loads(BANKROLL_FILE.read_text())
    return {"balance": 0.0, "target": 0.0, "all_time_deposited": 0.0,
            "all_time_withdrawn": 0.0, "all_time_pnl": 0.0}


def save_bankroll(br: dict) -> None:
    ensure_dir()
    br["updated"] = datetime.now(timezone.utc).isoformat()
    BANKROLL_FILE.write_text(json.dumps(br, indent=2))


# ─── Kelly ────────────────────────────────────────────────────────────────────

def cmd_kelly(args: argparse.Namespace) -> int:
    bankroll = args.bankroll
    decimal_odds = args.odds
    prob = args.prob
    cap = args.cap

    if prob <= 0 or prob >= 1:
        print("Error: --prob must be between 0 and 1 (exclusive).", file=sys.stderr)
        return 1
    if decimal_odds <= 1:
        print("Error: --odds must be > 1 (decimal format).", file=sys.stderr)
        return 1

    b = decimal_odds - 1  # net odds
    q = 1 - prob
    kelly = (prob * b - q) / b
    half_kelly = kelly / 2
    capped = min(half_kelly, cap)

    stake = bankroll * capped

    print(f"Kelly fraction:       {kelly:.4f}  ({kelly * 100:.2f}%)")
    print(f"Half-Kelly:           {half_kelly:.4f}  ({half_kelly * 100:.2f}%)")
    print(f"Capped ({cap*100:.0f}% max):   {capped:.4f}  ({capped * 100:.2f}%)")
    print(f"Recommended stake:    ${stake:,.2f}  (bankroll: ${bankroll:,.2f})")

    if kelly <= 0:
        print("\nWarning: negative edge — do not bet.")
    elif kelly < 0.02:
        print("\nNote: thin edge — consider skipping or betting minimum.")

    return 0


# ─── Log ──────────────────────────────────────────────────────────────────────

def cmd_log(args: argparse.Namespace) -> int:
    bet = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "event": args.event,
        "sport": args.sport or "",
        "market": args.market or "h2h",
        "selection": args.selection or "",
        "book": args.book,
        "odds_decimal": args.odds,
        "stake": args.stake,
        "status": "open",
        "result": None,
        "pnl": None,
        "note": args.note or "",
    }
    append_bet(bet)
    print(f"Logged: {args.event} — {args.selection} @ {args.odds} (${args.stake})")
    return 0


# ─── Settle ───────────────────────────────────────────────────────────────────

def cmd_settle(args: argparse.Namespace) -> int:
    bets = load_bets()
    matched = False
    for b in bets:
        if b.get("status") == "open" and args.event.lower() in b.get("event", "").lower():
            b["status"] = args.result
            b["result"] = args.result
            if args.result == "won":
                b["pnl"] = round(b["stake"] * (b["odds_decimal"] - 1), 2)
            elif args.result == "lost":
                b["pnl"] = -b["stake"]
            elif args.result == "void":
                b["pnl"] = 0.0
            matched = True
            print(f"Settled: {b['event']} — {args.result}  P&L: ${b['pnl']:+,.2f}")

            # Update bankroll
            br = load_bankroll()
            br["balance"] = round(br["balance"] + b["pnl"], 2)
            br["all_time_pnl"] = round(br["all_time_pnl"] + b["pnl"], 2)
            save_bankroll(br)
            break

    if not matched:
        print(f"No open bet found matching: {args.event}", file=sys.stderr)
        return 1

    save_bets(bets)
    return 0


# ─── Status ───────────────────────────────────────────────────────────────────

def cmd_status(_args: argparse.Namespace) -> int:
    bets = load_bets()
    open_bets = [b for b in bets if b.get("status") == "open"]
    if not open_bets:
        print("No open bets.")
        return 0

    total_at_risk = sum(b["stake"] for b in open_bets)
    print(f"Open bets: {len(open_bets)}  |  At risk: ${total_at_risk:,.2f}\n")
    print(f"{'Event':<40} {'Selection':<20} {'Book':<12} {'Odds':<8} {'Stake'}")
    print("-" * 95)
    for b in open_bets:
        print(f"{b.get('event','?')[:39]:<40} {b.get('selection','?')[:19]:<20} "
              f"{b.get('book','?'):<12} {b.get('odds_decimal',0):<8.3f} ${b.get('stake',0):.2f}")
    return 0


# ─── History ──────────────────────────────────────────────────────────────────

def cmd_history(args: argparse.Namespace) -> int:
    bets = load_bets()
    cutoff = datetime.now(timezone.utc) - timedelta(days=args.days)
    settled = [
        b for b in bets
        if b.get("status") in ("won", "lost", "void")
        and datetime.fromisoformat(b["ts"]) >= cutoff
    ]
    if not settled:
        print(f"No settled bets in last {args.days} days.")
        return 0

    print(f"{'Event':<40} {'Sel':<15} {'Result':<8} {'Odds':<8} {'Stake':<10} {'P&L'}")
    print("-" * 100)
    for b in settled:
        pnl = b.get("pnl", 0) or 0
        print(f"{b.get('event','?')[:39]:<40} {b.get('selection','?')[:14]:<15} "
              f"{b.get('result','?'):<8} {b.get('odds_decimal',0):<8.3f} "
              f"${b.get('stake',0):<9.2f} ${pnl:+,.2f}")
    return 0


# ─── Summary ──────────────────────────────────────────────────────────────────

def cmd_summary(_args: argparse.Namespace) -> int:
    bets = load_bets()
    br = load_bankroll()

    settled = [b for b in bets if b.get("status") in ("won", "lost") and b.get("pnl") is not None]
    wins = [b for b in settled if b["status"] == "won"]
    losses = [b for b in settled if b["status"] == "lost"]
    total_pnl = sum(b["pnl"] for b in settled)
    total_staked = sum(b["stake"] for b in settled)
    roi = (total_pnl / total_staked * 100) if total_staked > 0 else 0.0

    print(f"=== Betting Summary ===\n")
    print(f"  Bankroll:       ${br.get('balance', 0):,.2f}  (target: ${br.get('target', 0):,.2f})")
    print(f"  All-time P&L:   ${br.get('all_time_pnl', 0):+,.2f}")
    print(f"  Total bets:     {len(settled)}  ({len(wins)}W / {len(losses)}L)")
    print(f"  Win rate:       {len(wins)/len(settled)*100:.1f}%" if settled else "  Win rate:       n/a")
    print(f"  Net P&L:        ${total_pnl:+,.2f}")
    print(f"  Total staked:   ${total_staked:,.2f}")
    print(f"  ROI:            {roi:+.2f}%")

    open_bets = [b for b in bets if b.get("status") == "open"]
    if open_bets:
        at_risk = sum(b["stake"] for b in open_bets)
        print(f"\n  Open bets:      {len(open_bets)}  (${at_risk:,.2f} at risk)")

    return 0


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="Bet tracker — log, settle, and analyze bets.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    # kelly
    p_kelly = sub.add_parser("kelly", help="Calculate Kelly bet size")
    p_kelly.add_argument("--bankroll", type=float, required=True)
    p_kelly.add_argument("--odds", type=float, required=True, help="Decimal odds")
    p_kelly.add_argument("--prob", type=float, required=True, help="Win probability 0-1")
    p_kelly.add_argument("--cap", type=float, default=0.05, help="Max fraction cap (default: 0.05)")

    # log
    p_log = sub.add_parser("log", help="Log a new bet")
    p_log.add_argument("--event", required=True)
    p_log.add_argument("--book", required=True, help="Bookmaker key (dk, fd, etc.)")
    p_log.add_argument("--odds", type=float, required=True, help="Decimal odds taken")
    p_log.add_argument("--stake", type=float, required=True)
    p_log.add_argument("--selection", help="Outcome backed")
    p_log.add_argument("--sport", help="Sport key")
    p_log.add_argument("--market", default="h2h")
    p_log.add_argument("--note", help="Optional note")

    # settle
    p_settle = sub.add_parser("settle", help="Settle an open bet")
    p_settle.add_argument("--event", required=True, help="Partial event name to match")
    p_settle.add_argument("--result", choices=["won", "lost", "void"], required=True)

    # status
    sub.add_parser("status", help="Show open bets")

    # history
    p_hist = sub.add_parser("history", help="Show settled bet history")
    p_hist.add_argument("--days", type=int, default=30)

    # summary
    sub.add_parser("summary", help="Bankroll and overall performance summary")

    args = parser.parse_args()

    dispatch = {
        "kelly": cmd_kelly,
        "log": cmd_log,
        "settle": cmd_settle,
        "status": cmd_status,
        "history": cmd_history,
        "summary": cmd_summary,
    }
    return dispatch[args.cmd](args)


if __name__ == "__main__":
    raise SystemExit(main())
