/**
 * OTM Agent — Payout Engine
 *
 * Handles automated withdrawals from OTM earnings to real bank accounts.
 * Supports SoFi (ACH) and CashApp ($cashtag).
 *
 * Architecture:
 *  - PayoutConfig: stored encrypted in account-store
 *  - WithdrawalHistory: persisted to Supabase (primary) or ~/.openclaw/otm/withdrawals.jsonl (fallback)
 *  - Auto-withdrawal threshold: triggers when balance exceeds minWithdrawal
 *  - Each platform adapter (sofi, cashapp) handles its own API
 *
 * API Credentials needed (ask user to provide):
 *  - SoFi: Mercury API key (mercury.com) OR Plaid + Stripe for ACH
 *  - CashApp: CashApp Business API key (developers.squareup.com)
 *  - Falling back to: manual approval queue
 */

import crypto from "node:crypto";
import { appendFile, readFile, writeFile, mkdir, access, unlink, open } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { decryptConfigValue, encryptConfigValue } from "openclaw/plugin-sdk/config-crypto";
import * as supabaseStore from "./supabase-store.js";

// ─── In-process async mutex for withdrawal operations ──────────────────────
// Prevents double-spend when concurrent calls both read the same balance
// before either writes.
let _withdrawalLock: Promise<void> = Promise.resolve();
export function withWithdrawalLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = _withdrawalLock;
  let releaseFn: () => void = () => {};
  _withdrawalLock = new Promise<void>((resolve) => {
    releaseFn = resolve;
  });
  return prev.then(fn).finally(() => releaseFn());
}

async function withFileWithdrawalLock<T>(fn: () => Promise<T>): Promise<T> {
  await ensureDir();
  const startedAt = Date.now();

  while (true) {
    try {
      const handle = await open(WITHDRAWAL_LOCK_PATH, "wx");
      try {
        await handle.writeFile(String(process.pid), { encoding: "utf8" });
        return await fn();
      } finally {
        await handle.close().catch(() => {});
        await unlink(WITHDRAWAL_LOCK_PATH).catch(() => {});
      }
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code !== "EEXIST") throw err;
      if (Date.now() - startedAt > 15_000) {
        throw new Error("Timed out waiting for payout file lock");
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

export interface PayoutConfig {
  id: string;
  destination: "sofi" | "cashapp" | "manual";
  label: string;
  enabled: boolean;
  // SoFi via Mercury ACH
  sofi?: {
    routingNumber: string; // 9-digit ABA routing number
    accountNumber: string; // bank account number
    accountType: "checking" | "savings";
    mercuryApiKey?: string; // Mercury API key for ACH transfers
    mercuryAccountId?: string; // Mercury source account UUID (from /api/accounts); required for transfers
  };
  // CashApp
  cashapp?: {
    cashtag: string; // e.g. $yourcashtag
    cashappApiKey?: string; // CashApp Business API
  };
  // Auto-withdrawal settings
  autoWithdraw: boolean;
  minWithdrawal: number; // minimum balance before auto-withdraw
  withdrawalPercent: number; // % of earnings to withdraw (0-1)
  maxWithdrawal: number; // max per withdrawal
}

export interface WithdrawalRecord {
  id: string;
  configId: string;
  destination: PayoutConfig["destination"];
  amount: number;
  fee: number;
  netAmount: number;
  status: "pending" | "approved" | "processing" | "completed" | "failed" | "cancelled";
  method: "api" | "manual";
  platformSource: string; // "upwork", "fiverr", "clickworker", "scaleai", "aggregate"
  jobIds: string[]; // which jobs funded this withdrawal
  initiatedAt: string;
  processedAt?: string;
  completedAt?: string;
  referenceId?: string; // ACH trace #, CashApp ID, etc.
  notes?: string;
  error?: string;
}

interface WithdrawalStore {
  version: number;
  withdrawals: WithdrawalRecord[];
}

const WITHDRAWAL_STORE_PATH = join(homedir(), ".openclaw", "otm", "withdrawals.jsonl");
const PAYOUT_CONFIG_PATH = join(homedir(), ".openclaw", "otm", "payout-config.jsonl");
const WITHDRAWAL_LOCK_PATH = join(homedir(), ".openclaw", "otm", "withdrawals.lock");

async function ensureDir(): Promise<void> {
  await mkdir(join(homedir(), ".openclaw", "otm"), { recursive: true });
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function parseJsonl<T extends { id?: string }>(text: string): T[] {
  const seen = new Map<string, T>();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const record = JSON.parse(trimmed) as T;
      // Keep the latest entry for each withdrawal id (last write wins)
      if (record.id) seen.set(record.id, record);
    } catch {
      /* skip */
    }
  }
  return Array.from(seen.values());
}

// ─── Supabase storage helpers ──────────────────────────────────────────────
// Try Supabase first; fall back to local JSONL if Supabase is not configured
// or the call fails.

function isSupabaseConfigured(): boolean {
  return supabaseStore.isSupabaseConfigured();
}

function serializePayoutSecrets(c: PayoutConfig): string {
  const payload = JSON.stringify({ sofi: c.sofi, cashapp: c.cashapp });
  try {
    return encryptConfigValue(payload) ?? payload;
  } catch {
    return payload;
  }
}

function deserializePayoutSecrets(value: string): {
  sofi?: PayoutConfig["sofi"];
  cashapp?: PayoutConfig["cashapp"];
} {
  const decrypted = decryptConfigValue(value) ?? value;
  try {
    return JSON.parse(decrypted) as {
      sofi?: PayoutConfig["sofi"];
      cashapp?: PayoutConfig["cashapp"];
    };
  } catch {
    return {};
  }
}

function toSupabaseWithdrawal(r: WithdrawalRecord): supabaseStore.StoredWithdrawal {
  return {
    id: r.id,
    config_id: r.configId,
    destination: r.destination,
    amount: r.amount,
    fee: r.fee,
    net_amount: r.netAmount,
    status: r.status,
    method: r.method,
    platform_source: r.platformSource,
    job_ids: r.jobIds,
    initiated_at: r.initiatedAt,
    processed_at: r.processedAt,
    completed_at: r.completedAt,
    reference_id: r.referenceId,
    notes: r.notes,
    error: r.error,
  };
}

function fromSupabaseWithdrawal(r: supabaseStore.StoredWithdrawal): WithdrawalRecord {
  return {
    id: r.id,
    configId: r.config_id ?? "none",
    destination: r.destination as PayoutConfig["destination"],
    amount: r.amount,
    fee: r.fee,
    netAmount: r.net_amount,
    status: r.status as WithdrawalRecord["status"],
    method: r.method as WithdrawalRecord["method"],
    platformSource: r.platform_source ?? "aggregate",
    jobIds: r.job_ids ?? [],
    initiatedAt: r.initiated_at,
    processedAt: r.processed_at,
    completedAt: r.completed_at,
    referenceId: r.reference_id,
    notes: r.notes,
    error: r.error,
  };
}

function toSupabasePayoutConfig(c: PayoutConfig): supabaseStore.StoredPayoutConfig {
  const now = new Date().toISOString();
  return {
    id: c.id,
    destination: c.destination,
    label: c.label,
    enabled: c.enabled,
    encrypted_config: serializePayoutSecrets(c),
    auto_withdraw: c.autoWithdraw,
    min_withdrawal: c.minWithdrawal,
    withdrawal_percent: c.withdrawalPercent,
    max_withdrawal: c.maxWithdrawal,
    created_at: now,
    updated_at: now,
  };
}

function fromSupabasePayoutConfig(s: supabaseStore.StoredPayoutConfig): PayoutConfig {
  const extras = deserializePayoutSecrets(s.encrypted_config);
  return {
    id: s.id,
    destination: s.destination as PayoutConfig["destination"],
    label: s.label,
    enabled: s.enabled,
    sofi: extras.sofi,
    cashapp: extras.cashapp,
    autoWithdraw: s.auto_withdraw,
    minWithdrawal: s.min_withdrawal,
    withdrawalPercent: s.withdrawal_percent,
    maxWithdrawal: s.max_withdrawal ?? Infinity,
  };
}

// ─── Payout Config CRUD ────────────────────────────────────────────────────

export async function savePayoutConfig(config: PayoutConfig): Promise<void> {
  // Try Supabase first
  if (isSupabaseConfigured()) {
    try {
      const id = config.id || crypto.randomBytes(8).toString("hex");
      const withId = { ...config, id };
      await supabaseStore.savePayoutConfig(toSupabasePayoutConfig(withId));
      return;
    } catch (err) {
      console.warn("[payout-engine] Supabase savePayoutConfig failed, falling back to local:", err);
    }
  }

  // Local fallback
  await ensureDir();
  const existing = await loadAllPayoutConfigsLocal();
  let updated: PayoutConfig[];
  if (!config.id) {
    const newConfig = { ...config, id: crypto.randomBytes(8).toString("hex") };
    updated = existing.concat(newConfig);
  } else {
    const found = existing.some((c) => c.id === config.id);
    updated = found
      ? existing.map((c) => (c.id === config.id ? config : c))
      : existing.concat(config);
  }
  const data =
    updated
      .map((c) => {
        const { sofi, cashapp, ...rest } = c;
        return JSON.stringify({ ...rest, encrypted_config: serializePayoutSecrets(c) });
      })
      .join("\n") + "\n";
  await writeFile(PAYOUT_CONFIG_PATH, data, { encoding: "utf8", mode: 0o600 });
}

/** Local-only loader (used as fallback) */
async function loadAllPayoutConfigsLocal(): Promise<PayoutConfig[]> {
  if (!(await fileExists(PAYOUT_CONFIG_PATH))) return [];
  const data = await readFile(PAYOUT_CONFIG_PATH, "utf8").catch(() => "");
  return parseJsonl<PayoutConfig & { encrypted_config?: string }>(data)
    .filter((r) => "destination" in r && "label" in r)
    .map((record) => {
      if (typeof record.encrypted_config === "string") {
        const { encrypted_config, ...rest } = record;
        return { ...rest, ...deserializePayoutSecrets(encrypted_config) } as PayoutConfig;
      }
      return record as PayoutConfig;
    });
}

export async function loadAllPayoutConfigs(): Promise<PayoutConfig[]> {
  if (isSupabaseConfigured()) {
    try {
      const configs = await supabaseStore.loadAllPayoutConfigs();
      if (configs.length > 0) return configs.map(fromSupabasePayoutConfig);
    } catch (err) {
      console.warn("[payout-engine] Supabase loadAllPayoutConfigs failed, falling back:", err);
    }
  }
  return loadAllPayoutConfigsLocal();
}

export async function loadActivePayoutConfig(): Promise<PayoutConfig | null> {
  if (isSupabaseConfigured()) {
    try {
      const config = await supabaseStore.loadActivePayoutConfig();
      if (config) return fromSupabasePayoutConfig(config);
    } catch (err) {
      console.warn("[payout-engine] Supabase loadActivePayoutConfig failed, falling back:", err);
    }
  }
  // Local fallback
  const configs = await loadAllPayoutConfigsLocal();
  return configs.find((c) => c.enabled) ?? configs[0] ?? null;
}

export async function deletePayoutConfig(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      await supabaseStore.deletePayoutConfig(id);
      return;
    } catch (err) {
      console.warn("[payout-engine] Supabase deletePayoutConfig failed, falling back:", err);
    }
  }
  await ensureDir();
  const configs = (await loadAllPayoutConfigsLocal()).filter((c) => c.id !== id);
  const data =
    configs.length === 0
      ? ""
      : configs
          .map((c) => {
            const { sofi, cashapp, ...rest } = c;
            return JSON.stringify({ ...rest, encrypted_config: serializePayoutSecrets(c) });
          })
          .join("\n") + "\n";
  await writeFile(PAYOUT_CONFIG_PATH, data, "utf8");
}

// ─── Withdrawal History ────────────────────────────────────────────────────

export async function logWithdrawal(withdrawal: WithdrawalRecord): Promise<void> {
  // Write to Supabase first
  if (isSupabaseConfigured()) {
    try {
      await supabaseStore.saveWithdrawal(toSupabaseWithdrawal(withdrawal));
    } catch (err) {
      console.warn("[payout-engine] Supabase saveWithdrawal failed, writing local only:", err);
    }
  }

  // Always write local as backup
  await ensureDir();
  // L2: Ensure the withdrawal store is owner-readable only (0o600).
  // writeFile with mode only applies on file creation; if the file already exists the mode
  // argument is silently ignored by the OS, so we only need this on first write.
  if (!(await fileExists(WITHDRAWAL_STORE_PATH))) {
    await writeFile(WITHDRAWAL_STORE_PATH, "", { encoding: "utf8", mode: 0o600 });
  }
  const line = JSON.stringify(withdrawal) + "\n";
  await appendFile(WITHDRAWAL_STORE_PATH, line, { encoding: "utf8", flag: "a" });
}

export async function getWithdrawalHistory(limit = 50): Promise<WithdrawalRecord[]> {
  if (isSupabaseConfigured()) {
    try {
      const records = await supabaseStore.loadWithdrawalHistory(limit);
      if (records.length > 0) return records.map(fromSupabaseWithdrawal);
    } catch (err) {
      console.warn("[payout-engine] Supabase loadWithdrawalHistory failed, falling back:", err);
    }
  }

  // Local fallback
  if (!(await fileExists(WITHDRAWAL_STORE_PATH))) return [];
  const data = await readFile(WITHDRAWAL_STORE_PATH, "utf8").catch(() => "");
  const records = parseJsonl<WithdrawalRecord>(data);
  // Sort by initiatedAt descending (most recent first) before slicing
  records.sort((a, b) => new Date(b.initiatedAt).getTime() - new Date(a.initiatedAt).getTime());
  return records.slice(0, limit);
}

export async function getWithdrawalStats(): Promise<{
  totalWithdrawn: number;
  pendingAmount: number;
  lastWithdrawal: string | null;
  withdrawalCount: number;
  byDestination: Record<string, number>;
}> {
  if (isSupabaseConfigured()) {
    try {
      return await supabaseStore.loadWithdrawalStats();
    } catch (err) {
      console.warn("[payout-engine] Supabase loadWithdrawalStats failed, falling back:", err);
    }
  }

  // Local fallback — read ALL records. totalWithdrawn must reflect the full history
  // to prevent the available-balance calculation from inflating.
  if (!(await fileExists(WITHDRAWAL_STORE_PATH))) {
    return {
      totalWithdrawn: 0,
      pendingAmount: 0,
      lastWithdrawal: null,
      withdrawalCount: 0,
      byDestination: {},
    };
  }
  const data = await readFile(WITHDRAWAL_STORE_PATH, "utf8").catch(() => "");
  const records = parseJsonl<WithdrawalRecord>(data);
  const completed = records.filter((r) => r.status === "completed");
  const pending = records.filter((r) => ["pending", "approved", "processing"].includes(r.status));

  const byDestination: Record<string, number> = {};
  for (const r of completed) {
    byDestination[r.destination] = (byDestination[r.destination] ?? 0) + r.netAmount;
  }

  // Sort completed records descending by completedAt so index [0] is always the most recent.
  const sortedCompleted = [...completed].sort((a, b) => {
    const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return bTime - aTime;
  });

  return {
    totalWithdrawn: completed.reduce((s, r) => s + r.netAmount, 0),
    pendingAmount: pending.reduce((s, r) => s + r.netAmount, 0),
    lastWithdrawal: sortedCompleted[0]?.completedAt ?? null,
    withdrawalCount: completed.length,
    byDestination,
  };
}

// ─── SoFi ACH Adapter ──────────────────────────────────────────────────────

export async function initiateSoFiWithdrawal(
  config: PayoutConfig,
  amount: number,
  withdrawalId: string,
): Promise<{ success: boolean; referenceId?: string; error?: string }> {
  if (!config.sofi) {
    return { success: false, error: "SoFi config missing" };
  }

  const { routingNumber, accountNumber } = config.sofi;

  // Try Mercury API if key is available
  if (config.sofi.mercuryApiKey) {
    if (!config.sofi.mercuryAccountId) {
      return {
        success: false,
        error:
          "Mercury account ID not configured. Run otm_payout_setup with mercuryAccountId (UUID from your Mercury dashboard → Accounts).",
      };
    }
    try {
      // Mercury API: create a transfer to external bank account
      const response = await fetch("https://api.mercury.com/v1/transfers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.sofi.mercuryApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": withdrawalId,
        },
        body: JSON.stringify({
          sourceAccountId: config.sofi.mercuryAccountId,
          destination: {
            type: "external",
            routingNumber,
            accountNumber,
            accountType: config.sofi.accountType,
          },
          amount: Math.round(amount * 100) / 100, // Mercury expects dollars (2 decimal places)
          currency: "USD",
          note: `OTM Agent withdrawal ${withdrawalId}`,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        const data = (await response.json()) as { id?: string; status?: string };
        return {
          success: true,
          referenceId: data.id ?? withdrawalId,
        };
      }

      const errorText = await response.text().catch(() => "Unknown error");
      // Only expose status code and a sanitized snippet — never leak raw API body to agent logs
      const sanitized = errorText.slice(0, 120).replace(/[^\w\s.:,'"()-]/g, "");
      return { success: false, error: `Mercury API error ${response.status}: ${sanitized}` };
    } catch (err) {
      return {
        success: false,
        error: `Mercury API call failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // No API key — queue for manual approval
  return {
    success: false,
    error: "No Mercury API key configured. Withdrawal queued for manual approval.",
  };
}

// ─── CashApp Adapter ───────────────────────────────────────────────────────

export async function initiateCashAppWithdrawal(
  config: PayoutConfig,
  amount: number,
  withdrawalId: string,
): Promise<{ success: boolean; referenceId?: string; paymentUrl?: string; error?: string }> {
  if (!config.cashapp) {
    return { success: false, error: "CashApp config missing" };
  }

  const { cashtag, cashappApiKey } = config.cashapp;

  // CashApp Pay Payouts API (Square /v2/payouts — sends money TO a cashtag)
  if (cashappApiKey) {
    try {
      const response = await fetch("https://connect.squareup.com/v2/payouts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cashappApiKey}`,
          "Content-Type": "application/json",
          "Square-Version": "2024-01-18",
        },
        body: JSON.stringify({
          idempotencyKey: withdrawalId,
          amountMoney: {
            amount: Math.round(amount * 100),
            currency: "USD",
          },
          destination: {
            type: "CASH_APP",
            cashAppDetails: {
              // cashtag must include the $ prefix (e.g. "$yourcashtag")
              cashtag,
            },
          },
          note: `OTM Agent Payout ${withdrawalId}`,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        const data = (await response.json()) as { payout?: { id?: string } };
        return { success: true, referenceId: data.payout?.id ?? withdrawalId };
      }

      const errorData = (await response.json().catch(() => ({}))) as {
        errors?: Array<{ detail?: string }>;
      };
      return {
        success: false,
        error: `CashApp Payouts API error: ${errorData.errors?.[0]?.detail ?? response.status}`,
      };
    } catch (err) {
      return {
        success: false,
        error: `CashApp API call failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // Generate CashApp payment request link for manual approval
  const paymentUrl = `https://cash.me/${cashtag.replace("$", "")}/${amount.toFixed(2)}`;
  return {
    success: false,
    error: "No CashApp API key. Payment request queued.",
    paymentUrl,
  };
}

// ─── Main Payout Engine ────────────────────────────────────────────────────

export async function processPayout(
  amount: number,
  platformSource: string,
  jobIds: string[],
  config?: PayoutConfig | null,
): Promise<WithdrawalRecord> {
  // M3: Reject non-positive amounts before creating any withdrawal record
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new RangeError(`processPayout: amount must be a positive finite number, got ${amount}`);
  }

  const effectiveConfig = config ?? (await loadActivePayoutConfig());

  const withdrawal: WithdrawalRecord = {
    id: crypto.randomBytes(8).toString("hex"),
    configId: effectiveConfig?.id ?? "none",
    destination: effectiveConfig?.destination ?? "manual",
    amount,
    fee: 0,
    netAmount: amount,
    status: "pending",
    method: "manual",
    platformSource,
    jobIds,
    initiatedAt: new Date().toISOString(),
  };

  if (!effectiveConfig || !effectiveConfig.enabled) {
    withdrawal.notes = "No payout config — queued for manual setup";
    await logWithdrawal(withdrawal);
    return withdrawal;
  }

  withdrawal.configId = effectiveConfig.id;

  if (effectiveConfig.destination === "sofi") {
    withdrawal.status = "processing";
    withdrawal.method = effectiveConfig.sofi?.mercuryApiKey ? "api" : "manual";
    await logWithdrawal(withdrawal);

    const result = await initiateSoFiWithdrawal(effectiveConfig, amount, withdrawal.id);
    if (result.success) {
      withdrawal.status = "completed";
      withdrawal.referenceId = result.referenceId;
      withdrawal.processedAt = new Date().toISOString();
      withdrawal.completedAt = new Date().toISOString();
    } else {
      withdrawal.status = "pending"; // fallback to manual
      withdrawal.error = result.error;
      withdrawal.notes = result.error ?? undefined;
    }
    await logWithdrawal(withdrawal);
    return withdrawal;
  }

  if (effectiveConfig.destination === "cashapp") {
    withdrawal.status = "processing";
    withdrawal.method = effectiveConfig.cashapp?.cashappApiKey ? "api" : "manual";
    await logWithdrawal(withdrawal);

    const result = await initiateCashAppWithdrawal(effectiveConfig, amount, withdrawal.id);
    if (result.success) {
      withdrawal.status = "completed";
      withdrawal.referenceId = result.referenceId;
      withdrawal.processedAt = new Date().toISOString();
      withdrawal.completedAt = new Date().toISOString();
    } else {
      withdrawal.status = "pending";
      withdrawal.notes = `Payment request: ${result.paymentUrl ?? "see error"}`;
      withdrawal.error = result.error;
    }
    await logWithdrawal(withdrawal);
    return withdrawal;
  }

  // Manual — queue for human review
  withdrawal.notes = `${effectiveConfig.destination} — awaiting manual processing`;
  await logWithdrawal(withdrawal);
  return withdrawal;
}

// ─── Auto-Withdrawal Check ────────────────────────────────────────────────

export async function checkAutoWithdrawal(
  totalNetEarnings: number,
  platformSource = "aggregate",
  jobIds: string[] = [],
): Promise<WithdrawalRecord | null> {
  // Acquire mutex to prevent double-spend from concurrent calls
  return withWithdrawalLock(async () =>
    withFileWithdrawalLock(async () => {
      const config = await loadActivePayoutConfig();
      if (!config || !config.autoWithdraw || !config.enabled) return null;

      const minBalance = config.minWithdrawal ?? 100;
      const rawPct = config.withdrawalPercent ?? 0.8;
      // Clamp withdrawalPercent to 0-1 range to prevent withdrawing >100%
      const withdrawPct = Math.max(0, Math.min(1, rawPct));
      const maxWithdrawal = config.maxWithdrawal ?? Infinity;

      // Compute truly available balance = net earnings minus COMPLETED withdrawals only.
      // Pending withdrawals have not cleared yet — do NOT subtract them from available balance.
      // This prevents the balance from being exhausted by accumulated pending records.
      const stats = await getWithdrawalStats();
      const completedWithdrawn = stats.totalWithdrawn;
      const availableBalance = Math.max(0, totalNetEarnings - completedWithdrawn);

      if (availableBalance < minBalance) return null;

      const amount = Math.min(availableBalance * withdrawPct, maxWithdrawal);
      if (amount < 5) return null; // minimum $5

      return processPayout(amount, platformSource, jobIds, config);
    }),
  );
}

// ─── Singleton ─────────────────────────────────────────────────────────────

let payoutEngineInitialized = false;

export async function initPayoutEngine(): Promise<void> {
  if (payoutEngineInitialized) return;
  await ensureDir();

  // H3: Crash recovery — any withdrawal stuck in "processing" means the process crashed
  // between the first logWithdrawal (status=processing) and the second (status=completed/failed).
  // Transition these to "pending" so a human can review and re-trigger them manually.
  if (await fileExists(WITHDRAWAL_STORE_PATH)) {
    const data = await readFile(WITHDRAWAL_STORE_PATH, "utf8").catch(() => "");
    const records = parseJsonl<WithdrawalRecord>(data);
    const stuck = records.filter((r) => r.status === "processing");
    if (stuck.length > 0) {
      for (const r of stuck) {
        const recovered: WithdrawalRecord = {
          ...r,
          status: "pending",
          notes: [r.notes, "Recovered from 'processing' on startup — manual review required"]
            .filter(Boolean)
            .join("; "),
        };
        // logWithdrawal appends; parseJsonl keeps last-write-wins by id, so this overwrites
        await logWithdrawal(recovered);
      }
    }
  }

  payoutEngineInitialized = true;
}
