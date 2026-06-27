/**
 * /api/dispatch — Opportunity dispatch engine
 *
 * GET  /api/dispatch          — snapshot of queue + agents + stats
 * POST /api/dispatch          — action: "enqueue" | "tick" | "settle"
 *
 * Actions:
 *   enqueue  { opportunity }   — add a radar item to the work queue
 *   tick                       — claim next queued item, fire background work
 *   settle   { id, outcome, result, earned } — mark a job done/failed
 */
import { NextRequest, NextResponse } from "next/server";
import {
  enqueue,
  claimNext,
  settle,
  snapshot,
  type QueuedOpportunity,
} from "@/lib/opportunity-queue";
import { db } from "@/lib/db";
import { payoutToSofi } from "@/lib/mercury-payout";

// ─── Earnings parser ──────────────────────────────────────────────────────────

/** Parse "$85", "$30/gig", "Est $60", "Passive", "$50/day" → number (best-effort). */
function parseEarned(amt: string): number {
  const m = amt.match(/\$(\d+(?:\.\d+)?)/);
  if (!m) return 0;
  const base = parseFloat(m[1]);
  if (/\/day/i.test(amt)) return Math.round(base * 0.5); // half-day task estimate
  if (/\/gig/i.test(amt)) return base;
  return base;
}

// ─── Work executor (runs in the background, non-blocking) ────────────────────

/**
 * Extract a platform task ID from a result summary string.
 * Looks for patterns like "task_abc123" or "Task ID: abc123".
 */
function extractTaskId(summary: string): string | undefined {
  const m = summary.match(/task[_\s:-]+([a-zA-Z0-9_-]{6,})/i);
  return m?.[1];
}

/**
 * Persist a completed/failed job to the Job table, record the earning if any,
 * and trigger an auto-withdrawal if total unpaid earnings reach $100.
 *
 * Never throws — errors are logged but do not affect queue state.
 */
async function persistAndMaybePayout(
  opp: QueuedOpportunity,
  status: "completed" | "failed",
  summary: string,
  earnedUsd: number,
): Promise<void> {
  try {
    const platform = opp.src.toUpperCase().replace(/\s+/g, "_");
    const platformTaskId = extractTaskId(summary);

    // 1. Upsert Job row for the earnings audit trail
    await db.job.upsert({
      where: { id: opp.id },
      create: {
        id: opp.id,
        platform,
        description: opp.desc,
        amtString: opp.amt,
        score: opp.score ?? 0,
        riskLevel: opp.riskLevel ?? null,
        trend: opp.trend ?? null,
        agent: opp.agent ?? null,
        status,
        result: summary,
        earnedUsd,
        platformTaskId: platformTaskId ?? null,
        completedAt: new Date(),
      },
      update: {
        status,
        result: summary,
        earnedUsd,
        platformTaskId: platformTaskId ?? null,
        completedAt: new Date(),
      },
    });

    // 2. Record confirmed earning row if money was earned
    let earningId: string | undefined;
    if (earnedUsd > 0) {
      const earning = await db.earning.create({
        data: {
          platform,
          platformTaskId: platformTaskId ?? null,
          amountUsd: earnedUsd,
          jobId: opp.id,
          rawResponse: summary,
        },
      });
      earningId = earning.id;
    }

    // 3. Auto-withdraw if unpaid balance ≥ $100 and Mercury key is present
    if (earnedUsd > 0 && process.env.MERCURY_API_KEY) {
      const [totalEarned, totalPaidOut] = await Promise.all([
        db.earning.aggregate({ _sum: { amountUsd: true } }),
        db.payout.aggregate({
          where: { status: { in: ["initiated", "confirmed"] } },
          _sum: { amountUsd: true },
        }),
      ]);

      const available =
        (totalEarned._sum.amountUsd ?? 0) - (totalPaidOut._sum.amountUsd ?? 0);

      if (available >= 100) {
        try {
          const { transfer, accountId } = await payoutToSofi(available);
          const payout = await db.payout.create({
            data: {
              destination: "sofi",
              destinationLabel: "SoFi Bank",
              amountUsd: available,
              status: "initiated",
              providerRef: transfer.id,
              rawResponse: JSON.stringify(transfer),
              ...(earningId
                ? { earnings: { create: { earningId } } }
                : {}),
            },
          });
          console.log(
            `[dispatch] Auto-payout initiated: $${available.toFixed(2)} → SoFi ` +
            `(Mercury transfer ${transfer.id}, payout ${payout.id}, account ${accountId})`,
          );
        } catch (payoutErr) {
          console.error("[dispatch] Auto-payout failed:", payoutErr);
          await db.payout.create({
            data: {
              destination: "sofi",
              destinationLabel: "SoFi Bank",
              amountUsd: available,
              status: "failed",
              errorMessage:
                payoutErr instanceof Error
                  ? payoutErr.message
                  : String(payoutErr),
            },
          });
        }
      }
    }
  } catch (dbErr) {
    console.error("[dispatch] DB persist error:", dbErr);
  }
}

/**
 * Execute real agent work via browser automation, then settle the queue entry.
 *
 * Calls the browser-agent module which drives Playwright against real platforms.
 * If the browser agent fails, the job is settled as "failed" with an honest error.
 */
async function executeWork(opp: QueuedOpportunity): Promise<void> {
  const earned = parseEarned(opp.amt);

  try {
    const { executeBrowserJob } = await import("@/lib/browser-agent");
    const result = await executeBrowserJob(opp);
    const finalEarned = result.earned ?? earned;

    // Record earnings to Block 2.0 if available (fire-and-forget)
    try {
      await fetch("http://localhost:8000/api/v1/trades/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: `otm-${opp.agent?.toLowerCase() ?? "agent"}`,
          symbol: opp.src.toUpperCase().replace(/\s+/g, "_"),
          action: "BUY",
          amount: finalEarned,
          competition_id: null,
        }),
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      // Block 2.0 offline — earnings still recorded locally
    }

    await settle(opp.id, "completed", result.summary, finalEarned);
    void persistAndMaybePayout(opp, "completed", result.summary, finalEarned);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await settle(opp.id, "failed", `Browser agent error: ${msg}`, 0);
    void persistAndMaybePayout(opp, "failed", `Browser agent error: ${msg}`, 0);
  }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function GET() {
  try {
    return NextResponse.json(await snapshot());
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      action: string;
      opportunity?: Omit<
        QueuedOpportunity,
        "id" | "status" | "agent" | "queuedAt" | "claimedAt" | "completedAt" | "result" | "earned"
      >;
      id?: string;
      outcome?: "completed" | "failed";
      result?: string;
      earned?: number;
    };

    switch (body.action) {

      // ── enqueue ────────────────────────────────────────────────────────────
      case "enqueue": {
        if (!body.opportunity) {
          return NextResponse.json({ ok: false, error: "opportunity required" }, { status: 400 });
        }
        const queued = await enqueue(body.opportunity);
        if (!queued) {
          return NextResponse.json({ ok: false, error: "duplicate or queue full" });
        }
        return NextResponse.json({ ok: true, queued });
      }

      // ── tick — claim next item and kick off background work ────────────────
      case "tick": {
        const claimed = await claimNext();
        if (!claimed) {
          return NextResponse.json({ ok: true, claimed: false, reason: "nothing to claim" });
        }
        // Fire-and-forget — do NOT await; let Next.js route respond immediately
        void executeWork(claimed.opp);
        return NextResponse.json({
          ok: true,
          claimed: true,
          opp: claimed.opp,
          agent: claimed.agent.name,
        });
      }

      // ── settle — manual override ──────────────────────────────────────────
      case "settle": {
        if (!body.id) {
          return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
        }
        const settled = await settle(
          body.id,
          body.outcome ?? "completed",
          body.result ?? "Manually settled",
          body.earned ?? 0,
        );
        if (!settled) {
          return NextResponse.json({ ok: false, error: "job not found" }, { status: 404 });
        }
        return NextResponse.json({ ok: true, settled });
      }

      default:
        return NextResponse.json(
          { ok: false, error: `Unknown action: ${body.action}` },
          { status: 400 },
        );
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
