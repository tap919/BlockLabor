/**
 * GET /api/sports-steve?path=...  — Proxy to Sports Steve FastAPI agent
 *
 * Sports Steve runs as a FastAPI server (default port 8001).
 * Start it with: cd skills/tapskills/Sports-Steve-main && uvicorn src.main:app --port 8001
 *
 * Proxied endpoints:
 *   GET  /api/v1/status       — agent status, bankroll, pending bets, daily P&L
 *   GET  /api/v1/bets         — all bets (add ?status=pending for pending only)
 *   GET  /api/v1/revenue      — revenue summary (won/lost/net P&L)
 *   POST /api/v1/daily-run    — trigger daily bet assessment
 *   POST /api/v1/resolve-bets — trigger bet resolution
 *
 * NEVER returns fake data — returns 503 if Sports Steve is not running.
 */
import { NextRequest, NextResponse } from "next/server";

const SPORTS_STEVE_URL = process.env.SPORTS_STEVE_URL ?? "http://127.0.0.1:8001";

async function proxy(method: string, subPath: string, body?: unknown): Promise<NextResponse> {
  const url = `${SPORTS_STEVE_URL}/api/v1${subPath}`;
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
          error: "Sports Steve not running",
          hint: "cd skills/tapskills/Sports-Steve-main && uvicorn src.main:app --port 8001",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Sports Steve proxy error", detail: msg }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path") ?? "/status";
  // Forward any remaining query params (e.g. ?status=pending&limit=50)
  const qs = new URLSearchParams(searchParams);
  qs.delete("path");
  const suffix = qs.size > 0 ? `?${qs.toString()}` : "";
  return proxy("GET", `${path}${suffix}`);
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path") ?? "/daily-run";
  const body = await req.json().catch(() => ({}));
  return proxy("POST", path, body);
}
