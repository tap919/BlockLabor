/**
 * GET /api/openclaw/strategies
 *
 * Proxies to the OpenClaw gateway tool `otm_get_strategies`.
 * Falls back to built-in strategy data when the gateway is not running.
 *
 * Query params:
 *   bankroll      — current capital (default 0)
 *   hoursPerDay   — hours available per day (default 2)
 *   riskTolerance — low | medium | high (default medium)
 */
import { NextRequest, NextResponse } from "next/server";
import { invokeGatewayTool } from "@/lib/openclaw-client";

const FALLBACK_STRATEGIES = [
  {
    id: "microtask",
    title: "Micro-Task Arbitrage",
    minBankroll: 0,
    maxBankroll: 50,
    category: "micro",
    hoursRequired: 1,
    riskLevel: "low",
    steps: [
      "Create free accounts on Clickworker, Scale AI, Appen",
      "Scan for highest-paying open task batches",
      "Prioritize data annotation, RLHF feedback, transcription",
      "Use AI to assist with repetitive tasks",
      "Complete tasks daily for consistent income",
    ],
  },
  {
    id: "content",
    title: "Content Arbitrage",
    minBankroll: 0,
    maxBankroll: 100,
    category: "content",
    hoursRequired: 2,
    riskLevel: "medium",
    steps: [
      "Identify top Reddit posts in high-CPM niches",
      "Transform into blog articles using AI",
      "Publish to free WordPress with AdSense",
      "Post key insights as Twitter threads",
      "Build passive ad revenue over time",
    ],
  },
  {
    id: "gigbot",
    title: "Gig Bot Service",
    minBankroll: 20,
    maxBankroll: 200,
    category: "gig",
    hoursRequired: 2,
    riskLevel: "low",
    steps: [
      "Create Fiverr listings for AI writing services",
      "Use AI-generated gig thumbnails",
      "Set tiered pricing: $25/$60/$120",
      "Automate delivery with Builder agent",
      "Upsell to monthly retainers",
    ],
  },
  {
    id: "template",
    title: "Template Sales",
    minBankroll: 0,
    maxBankroll: 500,
    category: "template",
    hoursRequired: 4,
    riskLevel: "medium",
    steps: [
      "Identify popular Notion/Airtable use cases",
      "Build polished template with AI assistance",
      "List on Gumroad for $9–$29",
      "Drive traffic via Twitter and Reddit",
      "Build a bundle for passive income",
    ],
  },
];

const VALID_RISK_LEVELS = new Set(["low", "medium", "high"]);

/** Parse a numeric query param, returning `fallback` when missing or NaN. */
function safeNumber(raw: string | null, fallback: number): number {
  if (raw == null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bankroll = safeNumber(searchParams.get("bankroll"), 0);
  const hoursPerDay = safeNumber(searchParams.get("hoursPerDay"), 2);
  const riskToleranceRaw = (searchParams.get("riskTolerance") ?? "medium").toLowerCase();
  const riskTolerance = VALID_RISK_LEVELS.has(riskToleranceRaw) ? riskToleranceRaw : "medium";

  // Try gateway directly — invokeGatewayTool returns { ok: false } on network errors
  const result = await invokeGatewayTool("otm_get_strategies", {
    bankroll,
    hoursPerDay,
    riskTolerance,
  });

  if (result.ok && result.result) {
    const data = result.result as { strategies?: unknown[] };
    return NextResponse.json({
      source: "openclaw",
      strategies: data.strategies ?? [],
    });
  }

  // Gateway offline — serve fallback strategies filtered by bankroll, hours, and risk
  const riskOrder: Record<string, number> = { low: 1, medium: 2, high: 3 };
  const maxRisk = riskOrder[riskTolerance] ?? 2;

  const filtered = FALLBACK_STRATEGIES.filter((s) => {
    if (bankroll < s.minBankroll) return false;
    if (s.hoursRequired > hoursPerDay) return false;
    const sRisk = riskOrder[s.riskLevel] ?? 2;
    if (sRisk > maxRisk) return false;
    return true;
  });

  return NextResponse.json({
    source: "fallback",
    strategies: filtered,
  });
}
