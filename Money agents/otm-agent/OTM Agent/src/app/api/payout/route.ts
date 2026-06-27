/**
 * GET /api/payout — Payout config and withdrawal history
 * POST /api/payout — Setup payout config or withdraw now
 */
import { NextRequest, NextResponse } from "next/server";
import { invokeGatewayTool } from "@/lib/openclaw-client";

export async function GET() {
  const result = await invokeGatewayTool("otm_payout_status", {});

  if (result.ok && result.result) {
    const payload = result.result as Record<string, unknown>;
    const data = ((payload.details as Record<string, unknown>) ?? payload);
    return NextResponse.json({ source: "openclaw", ...data });
  }

  return NextResponse.json({
    source: "error",
    success: false,
    error: result.error ?? "Gateway unavailable — no payout data available",
  }, { status: 502 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...params } = body;

    let tool: string;
    let toolParams: Record<string, unknown> = {};

    switch (action) {
      case "setup":
        tool = "otm_payout_setup";
        toolParams = {
          destination: params.destination ?? "sofi",
          label: params.label ?? "SoFi Bank",
          enabled: params.enabled ?? true,
          sofiRouting: params.sofiRouting ?? (process.env.BANK_ROUTING || ''),
          sofiAccount: params.sofiAccount ?? (process.env.BANK_ACCOUNT || ''),
          sofiAccountType: params.sofiAccountType ?? "checking",
          mercuryApiKey: params.mercuryApiKey,
          cashappCashtag: params.cashappCashtag ?? (process.env.CASHAPP_TAG || ''),
          autoWithdraw: params.autoWithdraw ?? true,
          minWithdrawal: params.minWithdrawal ?? 100,
          withdrawalPercent: params.withdrawalPercent ?? 0.8,
          maxWithdrawal: params.maxWithdrawal ?? 500,
        };
        break;
      case "withdraw":
        tool = "otm_withdraw_now";
        toolParams = {
          amount: params.amount,
          destination: params.destination,
        };
        break;
      case "force_withdraw":
        // Immediately withdraw available balance to the configured SoFi destination.
        // Amount is intentionally omitted so the gateway uses the full available balance.
        tool = "otm_withdraw_now";
        toolParams = {
          destination: params.destination ?? "sofi",
        };
        break;
      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }

    const result = await invokeGatewayTool(tool, toolParams);

    if (result.ok && result.result) {
      const payload = result.result as Record<string, unknown>;
      const data = ((payload.details as Record<string, unknown>) ?? payload);
      return NextResponse.json({ source: "openclaw", ...data });
    }

    return NextResponse.json({
      source: "error",
      success: false,
      error: result.error ?? "Gateway unavailable — payout action failed",
    }, { status: 502 });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Internal error",
    }, { status: 500 });
  }
}
