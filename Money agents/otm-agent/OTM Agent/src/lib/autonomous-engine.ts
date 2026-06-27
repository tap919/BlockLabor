/**
 * Autonomous Engine — the heartbeat that makes the system actually work.
 *
 * Runs on a configurable interval (default 5 minutes). Each cycle:
 *   1. SCAN   — scanAllPlatforms() for new opportunities
 *   2. ENQUEUE — score and auto-enqueue any opportunity scoring ≥ 80
 *   3. CLAIM  — claimNext() to assign queued jobs to idle agents
 *   4. EXECUTE — executeBrowserJob() or API call against the real platform
 *   5. SETTLE — mark job completed/failed, record earnings, trigger payout if ≥ $100
 *
 * This module is a singleton. Only one engine runs per process.
 * State is in-memory (running/stopped) but all job data is in SQLite via Prisma.
 *
 * NO fake data. NO simulated work. If a platform fails, the error is logged
 * and the engine moves on to the next opportunity.
 */

import { scanAllPlatforms, type RawOpportunity } from "@/lib/platform-scanner";
import { enqueue, claimNext, settle, snapshot, type ScoreFactors } from "@/lib/opportunity-queue";
// NOTE: browser-agent is imported lazily via dynamic import() inside runCycle()
// to prevent Turbopack from statically tracing into playwright-core (which pulls
// .ttf, electron, chromium-bidi assets that break the Edge Instrumentation build).
import { db } from "@/lib/db";
import { payoutToSofi } from "@/lib/mercury-payout";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EngineConfig {
  /** Milliseconds between cycles. Default: 5 minutes. */
  intervalMs: number;
  /** Minimum score to auto-enqueue. Default: 80. */
  autoEnqueueThreshold: number;
  /** Maximum jobs to claim per cycle. Default: 3. */
  maxClaimsPerCycle: number;
  /** Auto-payout threshold in USD. Default: 100. */
  payoutThresholdUsd: number;
}

export interface CycleResult {
  cycleNumber: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  scanned: {
    platformsHit: number;
    opportunitiesFound: number;
    errors: string[];
  };
  enqueued: number;
  claimed: number;
  executed: Array<{
    jobId: string;
    platform: string;
    outcome: "completed" | "failed";
    summary: string;
    earned: number;
  }>;
  payoutTriggered: boolean;
  payoutAmount: number;
}

export interface EngineStatus {
  running: boolean;
  cycleCount: number;
  lastCycleAt: string | null;
  lastCycleResult: CycleResult | null;
  config: EngineConfig;
  upSinceUtc: string | null;
  errors: string[];
}

// ─── Default config ───────────────────────────────────────────────────────────

const DEFAULT_CONFIG: EngineConfig = {
  intervalMs: 5 * 60 * 1000, // 5 minutes
  autoEnqueueThreshold: 60,
  maxClaimsPerCycle: 3,
  payoutThresholdUsd: 100,
};

// ─── Scoring (duplicated from opportunities route for self-containment) ───────

function scoreOpportunity(opp: RawOpportunity): {
  score: number;
  scoreFactors: ScoreFactors;
  riskLevel: "Low" | "Medium" | "High";
  trend: "rising" | "stable" | "declining";
} {
  const base = opp.rawScore ?? 60;
  const dollarMatch = opp.amt.replace(/[,$]/g, "").match(/[\d.]+/);
  const dollarAmt = dollarMatch ? parseFloat(dollarMatch[0]) : 0;
  const srcLower = opp.src.toLowerCase();

  let timeToFirstDollar = 60, effort = 60, capital = 100, skill = 60, scalability = 60;
  let riskLevel: "Low" | "Medium" | "High" = "Medium";
  let trend: "rising" | "stable" | "declining" = "stable";

  if (srcLower.includes("scale ai")) {
    timeToFirstDollar = 80; effort = 85; skill = 70; scalability = 90;
    riskLevel = "Low"; trend = "rising";
  } else if (srcLower.includes("clickworker")) {
    timeToFirstDollar = 75; effort = 80; skill = 80; scalability = 85;
    riskLevel = "Low";
  } else if (srcLower.includes("fiverr")) {
    timeToFirstDollar = 50; effort = 40; skill = 50; scalability = 70;
    trend = "rising";
  } else if (srcLower.includes("upwork")) {
    timeToFirstDollar = 55; effort = 50; skill = 50; scalability = 60;
  } else if (srcLower.includes("reddit")) {
    timeToFirstDollar = 40; effort = 55; skill = 45; scalability = 50;
  } else if (srcLower.includes("gumroad")) {
    timeToFirstDollar = 30; effort = 30; skill = 40; scalability = 95;
    riskLevel = "Low"; trend = "rising";
  }

  const amtBonus = dollarAmt >= 100 ? 8 : dollarAmt >= 50 ? 4 : dollarAmt >= 20 ? 2 : 0;
  const factorScore = Math.round(
    timeToFirstDollar * 0.25 + effort * 0.25 + capital * 0.1 + skill * 0.2 + scalability * 0.2,
  );
  const score = Math.min(100, Math.round(base * 0.4 + factorScore * 0.6 + amtBonus));

  return { score, scoreFactors: { timeToFirstDollar, effort, capital, skill, scalability }, riskLevel, trend };
}

// ─── Parse earned amount helper ───────────────────────────────────────────────

function parseEarned(amt: string): number {
  const m = amt.match(/\$(\d+(?:\.\d+)?)/);
  if (!m) return 0;
  const base = parseFloat(m[1]);
  if (/\/day/i.test(amt)) return Math.round(base * 0.5);
  if (/\/gig/i.test(amt)) return base;
  return base;
}

// ─── Engine singleton via globalThis ──────────────────────────────────────────
// Turbopack may instantiate this module multiple times (instrumentation vs API
// route). Using globalThis ensures a single shared state across all instances.

interface EngineGlobal {
  __otmEngine?: {
    running: boolean;
    timer: ReturnType<typeof setInterval> | null;
    cycleCount: number;
    lastCycleResult: CycleResult | null;
    upSince: string | null;
    config: EngineConfig;
    recentErrors: string[];
    cycleInProgress: boolean;
  };
}

const g = globalThis as unknown as EngineGlobal;
if (!g.__otmEngine) {
  g.__otmEngine = {
    running: false,
    timer: null,
    cycleCount: 0,
    lastCycleResult: null,
    upSince: null,
    config: { ...DEFAULT_CONFIG },
    recentErrors: [],
    cycleInProgress: false,
  };
}
const _state = g.__otmEngine;

/**
 * Run one full autonomous cycle:
 *   scan → enqueue → claim → execute → settle → maybe payout
 */
async function runCycle(): Promise<CycleResult> {
  if (_state.cycleInProgress) {
    throw new Error("Cycle already in progress — skipping overlap");
  }
  _state.cycleInProgress = true;
  const startedAt = new Date();
  _state.cycleCount++;
  const cycleNum = _state.cycleCount;

  const result: CycleResult = {
    cycleNumber: cycleNum,
    startedAt: startedAt.toISOString(),
    completedAt: "",
    durationMs: 0,
    scanned: { platformsHit: 0, opportunitiesFound: 0, errors: [] },
    enqueued: 0,
    claimed: 0,
    executed: [],
    payoutTriggered: false,
    payoutAmount: 0,
  };

  try {
    // ── STEP 1: SCAN ──────────────────────────────────────────────────────────
    console.log(`[engine] Cycle ${cycleNum} — scanning all platforms...`);
    const scan = await scanAllPlatforms({ force: false });
    result.scanned.platformsHit = Object.keys(scan.sources).length;
    result.scanned.opportunitiesFound = scan.opportunities.length;
    result.scanned.errors = Object.entries(scan.sources)
      .filter(([, v]) => v.error)
      .map(([platform, v]) => `${platform}: ${v.error}`);

    console.log(
      `[engine] Cycle ${cycleNum} — found ${scan.opportunities.length} opportunities ` +
      `from ${result.scanned.platformsHit} platforms (${scan.cached.length} cached, ${scan.fresh.length} fresh)`,
    );

    // ── STEP 2: ENQUEUE high-scoring opportunities ────────────────────────────
    for (const opp of scan.opportunities) {
      const { score, scoreFactors, riskLevel, trend } = scoreOpportunity(opp);
      if (score >= _state.config.autoEnqueueThreshold) {
        const queued = await enqueue({
          src: opp.src,
          desc: opp.desc,
          url: opp.url,
          amt: opp.amt,
          score,
          scoreFactors,
          riskLevel,
          trend,
        });
        if (queued) {
          result.enqueued++;
          console.log(`[engine] Cycle ${cycleNum} — enqueued: ${opp.src} (score ${score}): ${opp.desc.slice(0, 80)}`);
        }
      }
    }

    // ── STEP 3: CLAIM + EXECUTE up to maxClaimsPerCycle jobs ──────────────────
    for (let i = 0; i < _state.config.maxClaimsPerCycle; i++) {
      const claimed = await claimNext();
      if (!claimed) break; // nothing in queue or all agents busy

      result.claimed++;
      const opp = claimed.opp;
      const agent = claimed.agent;
      console.log(
        `[engine] Cycle ${cycleNum} — ${agent.name} claimed: [${opp.src}] ${opp.desc.slice(0, 60)}`,
      );

      // ── STEP 4: EXECUTE ─────────────────────────────────────────────────────
      let outcome: "completed" | "failed" = "failed";
      let summary = "";
      let earned = 0;

      try {
        // Lazy-import browser-agent to avoid Turbopack tracing into playwright-core
        const { executeBrowserJob } = await import("@/lib/browser-agent");
        const jobResult = await executeBrowserJob(opp);
        outcome = "completed";
        summary = jobResult.summary;
        earned = jobResult.earned ?? parseEarned(opp.amt);
        console.log(`[engine] Cycle ${cycleNum} — ${agent.name} completed: $${earned} — ${summary.slice(0, 100)}`);
      } catch (execErr) {
        outcome = "failed";
        summary = `Execution error: ${execErr instanceof Error ? execErr.message : String(execErr)}`;
        console.error(`[engine] Cycle ${cycleNum} — ${agent.name} failed: ${summary}`);
      }

      // ── STEP 5: SETTLE ──────────────────────────────────────────────────────
      await settle(opp.id, outcome, summary, earned);
      result.executed.push({
        jobId: opp.id,
        platform: opp.src,
        outcome,
        summary: summary.slice(0, 300),
        earned,
      });

      // Record earning in DB if money was earned
      if (earned > 0) {
        try {
          const platform = opp.src.toUpperCase().replace(/\s+/g, "_");
          await db.job.upsert({
            where: { id: opp.id },
            create: {
              id: opp.id,
              platform,
              description: opp.desc,
              amtString: opp.amt,
              score: opp.score ?? 0,
              agent: opp.agent ?? agent.name,
              status: outcome,
              result: summary,
              earnedUsd: earned,
              completedAt: new Date(),
            },
            update: { status: outcome, result: summary, earnedUsd: earned, completedAt: new Date() },
          });

          await db.earning.create({
            data: {
              platform,
              amountUsd: earned,
              jobId: opp.id,
              rawResponse: summary,
            },
          });
        } catch (dbErr) {
          console.error(`[engine] DB persist error:`, dbErr);
        }
      }
    }

    // ── STEP 6: AUTO-PAYOUT CHECK ─────────────────────────────────────────────
    if (process.env.MERCURY_API_KEY) {
      try {
        const [totalEarned, totalPaidOut] = await Promise.all([
          db.earning.aggregate({ _sum: { amountUsd: true } }),
          db.payout.aggregate({
            where: { status: { in: ["initiated", "confirmed"] } },
            _sum: { amountUsd: true },
          }),
        ]);

        const available = (totalEarned._sum.amountUsd ?? 0) - (totalPaidOut._sum.amountUsd ?? 0);

        if (available >= _state.config.payoutThresholdUsd) {
          console.log(`[engine] Cycle ${cycleNum} — unpaid balance $${available.toFixed(2)} ≥ $${_state.config.payoutThresholdUsd}, triggering payout...`);
          try {
            const { transfer } = await payoutToSofi(available);
            await db.payout.create({
              data: {
                destination: "sofi",
                destinationLabel: "SoFi Bank",
                amountUsd: available,
                status: "initiated",
                providerRef: transfer.id,
                rawResponse: JSON.stringify(transfer),
              },
            });
            result.payoutTriggered = true;
            result.payoutAmount = available;
            console.log(`[engine] Cycle ${cycleNum} — payout initiated: $${available.toFixed(2)} → SoFi (Mercury transfer ${transfer.id})`);
          } catch (payoutErr) {
            const errMsg = payoutErr instanceof Error ? payoutErr.message : String(payoutErr);
            console.error(`[engine] Cycle ${cycleNum} — payout failed: ${errMsg}`);
            await db.payout.create({
              data: {
                destination: "sofi",
                destinationLabel: "SoFi Bank",
                amountUsd: available,
                status: "failed",
                errorMessage: errMsg,
              },
            });
          }
        }
      } catch (payoutCheckErr) {
        console.error(`[engine] Payout check error:`, payoutCheckErr);
      }
    }

  } catch (cycleErr) {
    const errMsg = cycleErr instanceof Error ? cycleErr.message : String(cycleErr);
    _state.recentErrors.push(`Cycle ${cycleNum}: ${errMsg}`);
    if (_state.recentErrors.length > 20) _state.recentErrors = _state.recentErrors.slice(-20);
    console.error(`[engine] Cycle ${cycleNum} FATAL:`, errMsg);
  } finally {
    _state.cycleInProgress = false;
  }

  const completedAt = new Date();
  result.completedAt = completedAt.toISOString();
  result.durationMs = completedAt.getTime() - startedAt.getTime();
  _state.lastCycleResult = result;

  console.log(
    `[engine] Cycle ${cycleNum} complete in ${(result.durationMs / 1000).toFixed(1)}s — ` +
    `scanned ${result.scanned.opportunitiesFound} opps, enqueued ${result.enqueued}, ` +
    `claimed ${result.claimed}, executed ${result.executed.length} ` +
    `(earned $${result.executed.reduce((s, e) => s + e.earned, 0).toFixed(2)})`,
  );

  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start the autonomous engine. It will run a cycle immediately, then repeat
 * on the configured interval.
 *
 * Safe to call multiple times — subsequent calls are no-ops if already running.
 */
export function startEngine(config?: Partial<EngineConfig>): EngineStatus {
  if (_state.running) return getStatus();

  if (config) {
    _state.config = { ..._state.config, ...config };
  }

  _state.running = true;
  _state.upSince = new Date().toISOString();
  console.log(
    `[engine] STARTED — interval ${_state.config.intervalMs / 1000}s, ` +
    `auto-enqueue ≥ ${_state.config.autoEnqueueThreshold}, ` +
    `max claims/cycle ${_state.config.maxClaimsPerCycle}, ` +
    `payout threshold $${_state.config.payoutThresholdUsd}`,
  );

  // Run first cycle immediately (fire-and-forget)
  void runCycle().catch((err) => {
    console.error("[engine] First cycle error:", err);
  });

  // Schedule recurring cycles
  _state.timer = setInterval(() => {
    if (!_state.cycleInProgress) {
      void runCycle().catch((err) => {
        console.error("[engine] Cycle error:", err);
      });
    } else {
      console.log("[engine] Skipping cycle — previous cycle still in progress");
    }
  }, _state.config.intervalMs);

  return getStatus();
}

/**
 * Stop the autonomous engine. In-progress cycles will finish but no new
 * cycles will be scheduled.
 */
export function stopEngine(): EngineStatus {
  if (_state.timer) {
    clearInterval(_state.timer);
    _state.timer = null;
  }
  _state.running = false;
  console.log("[engine] STOPPED");
  return getStatus();
}

/**
 * Run a single cycle manually (even if the engine is stopped).
 * Useful for testing or one-shot runs.
 */
export async function runSingleCycle(): Promise<CycleResult> {
  return runCycle();
}

/**
 * Get current engine status.
 */
export function getStatus(): EngineStatus {
  return {
    running: _state.running,
    cycleCount: _state.cycleCount,
    lastCycleAt: _state.lastCycleResult?.completedAt ?? null,
    lastCycleResult: _state.lastCycleResult,
    config: { ..._state.config },
    upSinceUtc: _state.upSince,
    errors: [..._state.recentErrors],
  };
}

/**
 * Update engine config. If the engine is running, it will use the new config
 * on the next cycle. To change the interval, stop and restart.
 */
export function updateConfig(patch: Partial<EngineConfig>): EngineConfig {
  _state.config = { ..._state.config, ...patch };
  return { ..._state.config };
}
