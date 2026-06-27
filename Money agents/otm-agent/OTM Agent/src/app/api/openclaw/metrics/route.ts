/**
 * GET /api/openclaw/metrics
 *
 * Proxies to the OpenClaw gateway tool `otm_get_metrics`.
 * Falls back to zeroed metrics when the gateway is not running.
 */
import { NextResponse } from "next/server";
import { invokeGatewayTool } from "@/lib/openclaw-client";

const FALLBACK_METRICS = {
  totalOpportunitiesScanned: 0,
  highScoreOpportunities: 0,
  estimatedEarningsIfExecuted: 0,
  quickWinsCount: 0,
  conversionRate: 0,
  activeStrategies: 0,
};

export async function GET() {
  // Try gateway directly — invokeGatewayTool returns { ok: false } on network errors
  const result = await invokeGatewayTool("otm_get_metrics", {});

  if (result.ok && result.result) {
    const data = result.result as { metrics?: typeof FALLBACK_METRICS };
    return NextResponse.json({
      source: "openclaw",
      metrics: data.metrics ?? FALLBACK_METRICS,
    });
  }

  return NextResponse.json({
    source: "fallback",
    metrics: FALLBACK_METRICS,
  });
}
