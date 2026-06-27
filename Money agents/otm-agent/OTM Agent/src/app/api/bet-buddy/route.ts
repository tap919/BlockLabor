/**
 * GET  /api/bet-buddy?path=...   — Proxy to Bet Buddy Express server (port 3001)
 * POST /api/bet-buddy?path=...   — Proxy to Bet Buddy Express server (port 3001)
 *
 * Bet Buddy runs as an Express server. Start it with:
 *   cd skills/tapskills/Bet-Buddy--main/backend && npm start
 *
 * Proxied endpoints:
 *   GET  /health                              — health check
 *   POST /api/tools/odds/convert/decimal      — convert decimal odds
 *   POST /api/tools/odds/convert/american     — convert American odds
 *   POST /api/tools/statistics/kelly          — Kelly criterion sizing
 *   POST /api/tools/statistics/ev             — expected value calculation
 *   POST /api/tools/bankroll/suggested-stake  — suggested stake for bankroll
 *   POST /api/tools/bankroll/stop-levels      — stop-loss / take-profit levels
 *   GET  /api/games                           — upcoming games
 *
 * NEVER returns fake data — returns 503 if Bet Buddy is not running.
 */
import { NextRequest, NextResponse } from "next/server";

const BET_BUDDY_URL = process.env.BET_BUDDY_URL ?? "http://127.0.0.1:3001";

async function proxy(method: string, subPath: string, body?: unknown): Promise<NextResponse> {
  const url = `${BET_BUDDY_URL}${subPath}`;
  try {
    const init: RequestInit = {
      method,
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(6000),
    };
    if (body && method !== "GET") init.body = JSON.stringify(body);
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const msg = String(err);
    if (msg.includes("ECONNREFUSED") || msg.includes("TimeoutError") || msg.includes("fetch failed")) {
      return NextResponse.json(
        {
          error: "Bet Buddy not running",
          hint: "cd skills/tapskills/Bet-Buddy--main/backend && npm start",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Bet Buddy proxy error", detail: msg }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path") ?? "/health";
  const qs = new URLSearchParams(searchParams);
  qs.delete("path");
  const suffix = qs.size > 0 ? `?${qs.toString()}` : "";
  return proxy("GET", `${path}${suffix}`);
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path") ?? "/api/tools/statistics/kelly";
  const body = await req.json().catch(() => ({}));
  return proxy("POST", path, body);
}
