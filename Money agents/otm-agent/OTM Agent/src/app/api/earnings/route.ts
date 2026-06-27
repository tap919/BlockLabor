/**
 * GET /api/earnings — Real earnings report
 *
 * Aggregates confirmed earnings from:
 *   1. Local SQLite DB (Earning table) — all platforms
 *   2. Payout history from local DB
 *
 * NEVER returns fake/mock data. If a source is unavailable, that source
 * is omitted from the response and a warning is included.
 *
 * Returns HTTP 200 with whatever real data is available.
 * Returns HTTP 502 only if ALL sources fail.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const errors: string[] = [];

  // ── 1. DB earnings (all platforms) ──────────────────────────────────────────
  let dbEarnings: Array<{
    id: string;
    platform: string;
    platformTaskId: string | null;
    amountUsd: number;
    confirmedAt: Date;
    jobId: string | null;
  }> = [];

  let dbPayouts: Array<{
    id: string;
    destination: string;
    destinationLabel: string | null;
    amountUsd: number;
    status: string;
    providerRef: string | null;
    initiatedAt: Date;
    confirmedAt: Date | null;
  }> = [];

  try {
    const prismaDb = db as unknown as {
      earning: {
        findMany: (args: object) => Promise<typeof dbEarnings>;
      };
      payout: {
        findMany: (args: object) => Promise<typeof dbPayouts>;
      };
    };
    [dbEarnings, dbPayouts] = await Promise.all([
      prismaDb.earning.findMany({
        orderBy: { confirmedAt: "desc" },
        take: 200,
      }),
      prismaDb.payout.findMany({
        orderBy: { initiatedAt: "desc" },
        take: 50,
      }),
    ]);
  } catch (err) {
    errors.push(`DB unavailable: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── 2. Aggregate ─────────────────────────────────────────────────────────────
  const dbTotal = dbEarnings.reduce((s, e) => s + e.amountUsd, 0);
  const dbPaidOut = dbPayouts
    .filter((p) => p.status === "confirmed" || p.status === "initiated")
    .reduce((s, p) => s + p.amountUsd, 0);

  // By platform breakdown from DB
  const byPlatform: Record<string, { count: number; totalUsd: number }> = {};
  for (const e of dbEarnings) {
    const p = byPlatform[e.platform] ?? { count: 0, totalUsd: 0 };
    p.count += 1;
    p.totalUsd += e.amountUsd;
    byPlatform[e.platform] = p;
  }

  // All sources failed → 502
  if (dbEarnings.length === 0 && errors.length > 0) {
    return NextResponse.json(
      {
        source: "error",
        error: errors.join("; "),
        earnings: null,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    source: "real",
    summary: {
      totalEarnedUsd: dbTotal,
      totalPaidOutUsd: dbPaidOut,
      availableUsd: dbTotal - dbPaidOut,
      earningCount: dbEarnings.length,
    },
    byPlatform,
    recentEarnings: dbEarnings.slice(0, 20).map((e) => ({
      id: e.id,
      platform: e.platform,
      platformTaskId: e.platformTaskId,
      amountUsd: e.amountUsd,
      confirmedAt: e.confirmedAt.toISOString(),
    })),
    payouts: dbPayouts.map((p) => ({
      id: p.id,
      destination: p.destination,
      destinationLabel: p.destinationLabel,
      amountUsd: p.amountUsd,
      status: p.status,
      providerRef: p.providerRef,
      initiatedAt: p.initiatedAt.toISOString(),
      confirmedAt: p.confirmedAt?.toISOString() ?? null,
    })),
    warnings: errors.length > 0 ? errors : undefined,
  });
}
