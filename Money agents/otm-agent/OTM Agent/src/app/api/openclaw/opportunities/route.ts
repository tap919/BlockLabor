/**
 * GET /api/openclaw/opportunities
 *
 * Proxies to the OpenClaw gateway tool `otm_scan_opportunities`.
 * Falls back to the static mock data when the gateway is not running.
 *
 * Query params:
 *   minScore   — minimum score threshold (default 70)
 *   limit      — max results (default 10)
 *   platforms  — comma-separated platform list
 */
import { NextRequest, NextResponse } from "next/server";
import { invokeGatewayTool } from "@/lib/openclaw-client";

// Static fallback used when the gateway is offline
const FALLBACK_OPPORTUNITIES = [
  {
    src: "UPWORK",
    desc: "AI product description writing — 50 items",
    amt: "$85",
    score: 92,
    scoreFactors: { timeToFirstDollar: 95, effort: 85, capital: 100, skill: 90, scalability: 75 },
    riskLevel: "Low",
    trend: "rising",
  },
  {
    src: "REDDIT",
    desc: "Viral thread → blog opportunity detected",
    amt: "Est $60",
    score: 78,
    scoreFactors: { timeToFirstDollar: 70, effort: 75, capital: 100, skill: 80, scalability: 85 },
    riskLevel: "Medium",
    trend: "stable",
  },
  {
    src: "FIVERR",
    desc: "Social media bio rewrites — surge in demand",
    amt: "$30/gig",
    score: 88,
    scoreFactors: { timeToFirstDollar: 90, effort: 90, capital: 100, skill: 85, scalability: 70 },
    riskLevel: "Low",
    trend: "rising",
  },
  {
    src: "CLICKWORKER",
    desc: "Data annotation batch — 200 tasks open",
    amt: "$40",
    score: 85,
    scoreFactors: { timeToFirstDollar: 95, effort: 80, capital: 100, skill: 95, scalability: 60 },
    riskLevel: "Low",
    trend: "stable",
  },
  {
    src: "GUMROAD",
    desc: "Notion finance tracker — gap in market",
    amt: "Passive",
    score: 72,
    scoreFactors: { timeToFirstDollar: 50, effort: 60, capital: 90, skill: 70, scalability: 95 },
    riskLevel: "Medium",
    trend: "rising",
  },
  {
    src: "SCALE AI",
    desc: "RLHF feedback tasks — $12/hr equivalent",
    amt: "$50/day",
    score: 82,
    scoreFactors: { timeToFirstDollar: 90, effort: 85, capital: 100, skill: 90, scalability: 55 },
    riskLevel: "Low",
    trend: "rising",
  },
];

/** Parse a numeric query param, returning `fallback` when missing or NaN. */
function safeNumber(raw: string | null, fallback: number): number {
  if (raw == null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const minScore = safeNumber(searchParams.get("minScore"), 70);
  const limit = safeNumber(searchParams.get("limit"), 10);
  const platformsParam = searchParams.get("platforms");
  const platforms = platformsParam ? platformsParam.split(",").map((p) => p.trim()).filter(Boolean) : undefined;

  // Try gateway directly — invokeGatewayTool returns { ok: false } on network errors
  const result = await invokeGatewayTool("otm_scan_opportunities", {
    ...(platforms ? { platforms } : {}),
    minScore,
    limit,
  });

  if (result.ok && result.result) {
    const data = result.result as { opportunities?: unknown[] };
    return NextResponse.json({
      source: "openclaw",
      opportunities: data.opportunities ?? [],
    });
  }

  // Gateway offline or tool call failed — serve filtered fallback
  let filtered = FALLBACK_OPPORTUNITIES.filter((o) => o.score >= minScore);

  // Apply platform filter to fallback data too
  if (platforms && platforms.length > 0) {
    const upperPlatforms = platforms.map((p) => p.toUpperCase());
    filtered = filtered.filter((o) => upperPlatforms.includes(o.src.toUpperCase()));
  }

  filtered = filtered.slice(0, limit);

  return NextResponse.json({
    source: "fallback",
    opportunities: filtered,
  });
}
