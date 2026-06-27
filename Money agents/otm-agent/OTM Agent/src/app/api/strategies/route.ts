/**
 * GET /api/strategies
 *
 * Alias route that forwards to /api/openclaw/strategies.
 * The OTM Agent extension calls this path directly.
 */
import { NextRequest, NextResponse } from "next/server";

const BASE = "http://127.0.0.1:3001";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resp = await fetch(`${BASE}/api/openclaw/strategies?${searchParams.toString()}`, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    const data = await resp.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ source: "error", strategies: [] }, { status: 200 });
  }
}
