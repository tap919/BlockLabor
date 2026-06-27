/**
 * OTM Agent — Finance Bridge
 *
 * Connects OTM earnings to the Finance extension's revenue store.
 * Writes entries to ~/.openclaw/finance/revenue.jsonl so that the Finance
 * extension's `get_revenue` tool includes OTM income and withdrawals.
 *
 * Revenue entry format:
 *   { source, category, amount, period, ts }
 *
 * Sources: upwork, fiverr, clickworker, scaleai, otm_withdrawal, otm_reinvested
 * Categories: freelance_income, platform_fee, ai_cost, payout, reinvested
 */

import { existsSync } from "node:fs";
import { appendFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface OtmEarningEntry {
  source: string;
  category: "freelance_income" | "platform_fee" | "ai_cost" | "payout" | "reinvested" | "bonus";
  amount: number;
  period: string; // "daily", "weekly", "monthly", or YYYY-MM-DD
  ts: number;
  jobId?: string;
  platform?: string;
  notes?: string;
}

const FINANCE_REVENUE_PATH = join(homedir(), ".openclaw", "finance", "revenue.jsonl");

async function ensureFinanceDir(): Promise<void> {
  await mkdir(join(homedir(), ".openclaw", "finance"), { recursive: true });
}

export async function logOtmRevenue(entry: OtmEarningEntry): Promise<void> {
  await ensureFinanceDir();
  const line = JSON.stringify(entry) + "\n";
  await appendFile(FINANCE_REVENUE_PATH, line, { encoding: "utf8", flag: "a" });
}

export async function logOtmEarningsBatch(entries: OtmEarningEntry[]): Promise<void> {
  if (entries.length === 0) return;
  await ensureFinanceDir();
  const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await appendFile(FINANCE_REVENUE_PATH, lines, { encoding: "utf8", flag: "a" });
}

/** Call this when a job is marked "completed" (delivered, pending payment). */
export async function onJobCompleted(params: {
  jobId: string;
  platform: string;
  grossAmount: number;
  platformFee: number;
  aiCost: number;
  netAmount: number;
  category: string;
  period?: string;
}): Promise<void> {
  const ts = Date.now();
  const period = params.period ?? getCurrentPeriod();
  const entries: OtmEarningEntry[] = [];

  // Gross income (positive)
  entries.push({
    source: params.platform,
    category: "freelance_income",
    amount: params.grossAmount,
    period,
    ts,
    jobId: params.jobId,
    platform: params.platform,
    notes: `Job completed: ${params.jobId}`,
  });

  // Platform fee (negative — expense)
  if (params.platformFee > 0) {
    entries.push({
      source: params.platform,
      category: "platform_fee",
      amount: -params.platformFee,
      period,
      ts,
      jobId: params.jobId,
      platform: params.platform,
      notes: `Platform fee: ${params.platform}`,
    });
  }

  // AI cost (negative — expense)
  if (params.aiCost > 0) {
    entries.push({
      source: "llm",
      category: "ai_cost",
      amount: -params.aiCost,
      period,
      ts,
      jobId: params.jobId,
      platform: params.platform,
      notes: `LLM cost for job: ${params.jobId}`,
    });
  }
  // Note: net earnings = gross - platformFee - aiCost; already derivable from above entries.

  await logOtmEarningsBatch(entries);
}

/** Call this when a withdrawal is initiated. */
export async function onWithdrawalInitiated(params: {
  withdrawalId: string;
  destination: string;
  grossAmount: number;
  fee: number;
  netAmount: number;
}): Promise<void> {
  await logOtmRevenue({
    source: params.destination,
    category: "payout",
    amount: -params.grossAmount, // money going out
    period: getCurrentPeriod(),
    ts: Date.now(),
    notes: `Withdrawal initiated: ${params.withdrawalId} to ${params.destination}`,
  });
}

/** Call this when a withdrawal completes. */
export async function onWithdrawalCompleted(params: {
  withdrawalId: string;
  destination: string;
  netAmount: number;
  referenceId?: string;
}): Promise<void> {
  await logOtmRevenue({
    source: params.destination,
    category: "payout",
    amount: -params.netAmount,
    period: getCurrentPeriod(),
    ts: Date.now(),
    notes: `Withdrawal completed: ${params.referenceId ?? params.withdrawalId}`,
  });
}

/** Call this when earnings are reinvested (e.g., into trading). */
export async function onEarningsReinvested(params: {
  amount: number;
  destination: string; // "trading", "betting", "marketing"
}): Promise<void> {
  await logOtmRevenue({
    source: params.destination,
    category: "reinvested",
    amount: -params.amount,
    period: getCurrentPeriod(),
    ts: Date.now(),
    notes: `Reinvested into ${params.destination}`,
  });
}

function getCurrentPeriod(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const isWeekStart = dayOfWeek === 0;
  const isMonthStart = now.getDate() === 1;

  if (isWeekStart) {
    return "weekly";
  } else if (isMonthStart) {
    return "monthly";
  }
  return now.toISOString().split("T")[0]; // YYYY-MM-DD
}

/** Quick summary of OTM financial health */
export async function getOtmFinancialSummary(): Promise<{
  grossToday: number;
  netToday: number;
  grossThisWeek: number;
  grossThisMonth: number;
  totalWithdrawn: number;
  pendingWithdrawals: number;
  reinvestedTotal: number;
  byPlatform: Record<string, number>;
}> {
  if (!existsSync(FINANCE_REVENUE_PATH)) {
    return {
      grossToday: 0,
      netToday: 0,
      grossThisWeek: 0,
      grossThisMonth: 0,
      totalWithdrawn: 0,
      pendingWithdrawals: 0,
      reinvestedTotal: 0,
      byPlatform: {},
    };
  }

  const { readFile } = await import("node:fs/promises");
  const data = await readFile(FINANCE_REVENUE_PATH, "utf8").catch(() => "");
  const lines = data.split("\n").filter((l) => l.trim());

  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

  let grossToday = 0,
    netToday = 0,
    grossThisWeek = 0,
    grossThisMonth = 0;
  let totalWithdrawn = 0,
    reinvestedTotal = 0;
  const byPlatform: Record<string, number> = {};

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as OtmEarningEntry;
      if (entry.category === "freelance_income") {
        if (entry.ts >= todayStart.getTime()) grossToday += entry.amount;
        if (entry.ts >= weekStart.getTime()) grossThisWeek += entry.amount;
        if (entry.ts >= monthStart.getTime()) grossThisMonth += entry.amount;
        if (entry.platform) {
          byPlatform[entry.platform] = (byPlatform[entry.platform] ?? 0) + entry.amount;
        }
      }
      if (entry.category === "payout") {
        totalWithdrawn += Math.abs(entry.amount);
      }
      if (entry.category === "reinvested") {
        reinvestedTotal += Math.abs(entry.amount);
      }
    } catch {
      /* skip */
    }
  }

  return {
    grossToday,
    netToday: grossToday, // simplified
    grossThisWeek,
    grossThisMonth,
    totalWithdrawn,
    pendingWithdrawals: 0,
    reinvestedTotal,
    byPlatform,
  };
}
