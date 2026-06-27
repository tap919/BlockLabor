/**
 * Opportunity Queue — DB-backed via Prisma (QueuedJob + AgentState tables).
 *
 * All state survives server restarts. On startup, any job that was left in
 * "claimed" status is automatically reset to "queued" (interrupted recovery).
 *
 * Agents:  Scout · Closer · Builder · Stacker
 * Scout   — surfaces high-score quick-turnaround tasks (effort ≥ 80)
 * Closer  — takes leads and converts them (Upwork / Fiverr gig applications)
 * Builder — builds assets (content, templates, products — GUMROAD/REDDIT)
 * Stacker — stacks passive / data work (CLICKWORKER / SCALE AI)
 *
 * All public functions are async.  The dispatch route awaits them.
 */

import { db } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgentName = "Scout" | "Closer" | "Builder" | "Stacker";

export type OpportunityStatus =
  | "queued"
  | "claimed"
  | "completed"
  | "failed"
  | "interrupted"; // was claimed when server restarted

export interface ScoreFactors {
  timeToFirstDollar: number;
  effort: number;
  capital: number;
  skill: number;
  scalability: number;
}

export interface QueuedOpportunity {
  id: string;
  src: string;
  desc: string;
  url?: string;
  amt: string;
  score: number;
  scoreFactors: ScoreFactors;
  riskLevel?: "Low" | "Medium" | "High";
  trend?: "rising" | "stable" | "declining";
  status: OpportunityStatus;
  agent: AgentName | null;
  queuedAt: number;     // Unix ms
  claimedAt: number | null;
  completedAt: number | null;
  result: string | null;
  earned: number;
}

export interface AgentState {
  name: AgentName;
  status: "idle" | "working";
  currentJob: string | null;
  jobsSince: number;
  earned: number;
  lastActivity: number; // Unix ms
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AGENT_NAMES: AgentName[] = ["Scout", "Closer", "Builder", "Stacker"];
const MAX_QUEUE = 50;
const MAX_HISTORY = 20;

/** Map a DB QueuedJob row → QueuedOpportunity */
function rowToOpp(row: {
  id: string;
  src: string;
  desc: string;
  url?: string | null;
  amt: string;
  score: number;
  scoreFactors: string;
  riskLevel: string | null;
  trend: string | null;
  status: string;
  agent: string | null;
  result: string | null;
  earnedUsd: number;
  queuedAt: Date;
  claimedAt: Date | null;
  completedAt: Date | null;
}): QueuedOpportunity {
  let scoreFactors: ScoreFactors = {
    timeToFirstDollar: 0,
    effort: 0,
    capital: 0,
    skill: 0,
    scalability: 0,
  };
  try {
    scoreFactors = JSON.parse(row.scoreFactors) as ScoreFactors;
  } catch {
    // keep defaults
  }
  return {
    id: row.id,
    src: row.src,
    desc: row.desc,
    url: row.url ?? undefined,
    amt: row.amt,
    score: row.score,
    scoreFactors,
    riskLevel: (row.riskLevel ?? undefined) as QueuedOpportunity["riskLevel"],
    trend: (row.trend ?? undefined) as QueuedOpportunity["trend"],
    status: row.status as OpportunityStatus,
    agent: (row.agent ?? null) as AgentName | null,
    queuedAt: row.queuedAt.getTime(),
    claimedAt: row.claimedAt ? row.claimedAt.getTime() : null,
    completedAt: row.completedAt ? row.completedAt.getTime() : null,
    result: row.result,
    earned: row.earnedUsd,
  };
}

/** Map a DB AgentState row → AgentState */
function rowToAgent(row: {
  name: string;
  status: string;
  currentJobId: string | null;
  jobsSince: number;
  earnedTotal: number;
  lastActivity: Date;
}): AgentState {
  return {
    name: row.name as AgentName,
    status: row.status as "idle" | "working",
    currentJob: row.currentJobId,
    jobsSince: row.jobsSince,
    earned: row.earnedTotal,
    lastActivity: row.lastActivity.getTime(),
  };
}

/** Decide which agent should handle an opportunity based on source + factors. */
function routeToAgent(opp: QueuedOpportunity): AgentName {
  const src = opp.src.toUpperCase();
  if (src === "UPWORK" || src === "FIVERR") return "Closer";
  if (src === "GUMROAD" || src === "REDDIT") return "Builder";
  if (src === "CLICKWORKER" || src === "SCALE AI") return "Stacker";
  return (opp.scoreFactors?.effort ?? 0) >= 80 ? "Scout" : "Closer";
}

// ─── Startup: seed agent rows + recover interrupted jobs ──────────────────────

let _initialized = false;

async function ensureInitialized(): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  // Seed one AgentState row per agent name if they don't exist
  await Promise.all(
    AGENT_NAMES.map((name) =>
      db.agentState.upsert({
        where: { name },
        create: { name },
        update: {}, // keep existing counters/status
      }),
    ),
  );

  // Re-queue any jobs that were "claimed" when the server last crashed
  await db.queuedJob.updateMany({
    where: { status: "claimed" },
    data: { status: "interrupted" },
  });

  // Reset any agents that were "working" (their job is now interrupted)
  await db.agentState.updateMany({
    where: { status: "working" },
    data: { status: "idle", currentJobId: null },
  });

  // Mark interrupted jobs back to queued so they get re-claimed
  await db.queuedJob.updateMany({
    where: { status: "interrupted" },
    data: { status: "queued", claimedAt: null, agent: null },
  });
}

// ─── Public API (all async) ───────────────────────────────────────────────────

/**
 * Enqueue a new opportunity.
 * Returns the created QueuedOpportunity, or null if it's a duplicate or the
 * queue is full.
 */
export async function enqueue(
  raw: Omit<
    QueuedOpportunity,
    "id" | "status" | "agent" | "queuedAt" | "claimedAt" | "completedAt" | "result" | "earned"
  >,
): Promise<QueuedOpportunity | null> {
  await ensureInitialized();

  // Dedup: same src + desc already in active queue
  const existing = await db.queuedJob.findFirst({
    where: {
      src: raw.src,
      desc: raw.desc,
      status: { in: ["queued", "claimed"] },
    },
  });
  if (existing) return null;

  // Enforce max queue size
  const count = await db.queuedJob.count({
    where: { status: { in: ["queued", "claimed"] } },
  });
  if (count >= MAX_QUEUE) return null;

  const row = await db.queuedJob.create({
    data: {
      src: raw.src,
      desc: raw.desc,
      url: raw.url ?? null,
      amt: raw.amt,
      score: raw.score,
      scoreFactors: JSON.stringify(raw.scoreFactors ?? {}),
      riskLevel: raw.riskLevel ?? null,
      trend: raw.trend ?? null,
      status: "queued",
    },
  });

  return rowToOpp(row);
}

/**
 * Claim the next queued opportunity for the best available idle agent.
 * Returns the claimed item + agent, or null if nothing to claim.
 */
export async function claimNext(): Promise<{
  opp: QueuedOpportunity;
  agent: AgentState;
} | null> {
  await ensureInitialized();

  // Load oldest queued item
  const nextRow = await db.queuedJob.findFirst({
    where: { status: "queued" },
    orderBy: { queuedAt: "asc" },
  });
  if (!nextRow) return null;

  const opp = rowToOpp(nextRow);

  // Pick preferred agent, fall back to any idle agent
  const preferred = routeToAgent(opp);
  const allAgents = await db.agentState.findMany();
  const preferredAgent = allAgents.find(
    (a) => a.name === preferred && a.status === "idle",
  );
  const agentRow =
    preferredAgent ?? allAgents.find((a) => a.status === "idle") ?? null;

  if (!agentRow) return null; // all busy

  const now = new Date();

  // Update job and agent atomically
  const [updatedJob, updatedAgent] = await Promise.all([
    db.queuedJob.update({
      where: { id: nextRow.id },
      data: {
        status: "claimed",
        agent: agentRow.name,
        claimedAt: now,
      },
    }),
    db.agentState.update({
      where: { name: agentRow.name },
      data: {
        status: "working",
        currentJobId: nextRow.id,
        lastActivity: now,
      },
    }),
  ]);

  return { opp: rowToOpp(updatedJob), agent: rowToAgent(updatedAgent) };
}

/**
 * Settle a job (completed or failed).
 * Frees the assigned agent and marks the job done.
 * Returns the final QueuedOpportunity, or null if not found.
 */
export async function settle(
  id: string,
  outcome: "completed" | "failed",
  result: string,
  earned: number,
): Promise<QueuedOpportunity | null> {
  await ensureInitialized();

  const job = await db.queuedJob.findUnique({ where: { id } });
  if (!job) return null;

  const now = new Date();

  const [updatedJob] = await Promise.all([
    db.queuedJob.update({
      where: { id },
      data: {
        status: outcome,
        result,
        earnedUsd: earned,
        completedAt: now,
      },
    }),
    // Release the agent if one was assigned
    job.agent
      ? db.agentState.update({
          where: { name: job.agent },
          data: {
            status: "idle",
            currentJobId: null,
            lastActivity: now,
            jobsSince: { increment: 1 },
            earnedTotal: { increment: earned },
          },
        })
      : Promise.resolve(),
  ]);

  return rowToOpp(updatedJob);
}

/**
 * Snapshot of current queue state for the GET /api/dispatch endpoint.
 * Returns active queue, recent history, agent states, and aggregate stats.
 */
export async function snapshot(): Promise<{
  queue: QueuedOpportunity[];
  history: QueuedOpportunity[];
  agents: Record<AgentName, AgentState>;
  stats: {
    queued: number;
    claimed: number;
    completed: number;
    failed: number;
    totalEarned: number;
  };
}> {
  await ensureInitialized();

  const [activeRows, historyRows, agentRows, completedAgg, failedCount] =
    await Promise.all([
      db.queuedJob.findMany({
        where: { status: { in: ["queued", "claimed"] } },
        orderBy: { queuedAt: "asc" },
      }),
      db.queuedJob.findMany({
        where: { status: { in: ["completed", "failed"] } },
        orderBy: { completedAt: "desc" },
        take: MAX_HISTORY,
      }),
      db.agentState.findMany(),
      db.queuedJob.aggregate({
        where: { status: "completed" },
        _sum: { earnedUsd: true },
        _count: { id: true },
      }),
      db.queuedJob.count({ where: { status: "failed" } }),
    ]);

  const agents = Object.fromEntries(
    agentRows.map((r) => [r.name, rowToAgent(r)]),
  ) as Record<AgentName, AgentState>;

  // Fill in any missing agent rows (edge case on first boot)
  for (const name of AGENT_NAMES) {
    if (!agents[name]) {
      agents[name] = {
        name,
        status: "idle",
        currentJob: null,
        jobsSince: 0,
        earned: 0,
        lastActivity: Date.now(),
      };
    }
  }

  return {
    queue: activeRows.map(rowToOpp),
    history: historyRows.map(rowToOpp),
    agents,
    stats: {
      queued: activeRows.filter((r) => r.status === "queued").length,
      claimed: activeRows.filter((r) => r.status === "claimed").length,
      completed: completedAgg._count.id,
      failed: failedCount,
      totalEarned: completedAgg._sum.earnedUsd ?? 0,
    },
  };
}
