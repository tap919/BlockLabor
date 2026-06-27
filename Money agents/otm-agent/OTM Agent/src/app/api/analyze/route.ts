/**
 * POST /api/analyze
 *
 * Alias route that forwards to /api/ai.
 * The OTM Agent extension calls this path directly.
 */
import { NextRequest, NextResponse } from "next/server";

const BASE = "http://127.0.0.1:3001";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const resp = await fetch(`${BASE}/api/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "analyze", data: body }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await resp.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { success: false, error: "OTM backend unreachable" },
      { status: 200 },
    );
  }
}
