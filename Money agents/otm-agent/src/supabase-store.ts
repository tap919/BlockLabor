/**
 * OTM Agent — Supabase Storage Layer
 *
 * Replaces local JSONL file storage with Supabase for persistent,
 * cross-device data storage.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? "";

let supabase: SupabaseClient | null = null;
let supabaseAdmin: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_KEY);
}

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
  }
  return supabase;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }
  return supabaseAdmin;
}

// Database table names
export const Table = {
  ACCOUNTS: "otm_accounts",
  WITHDRAWALS: "otm_withdrawals",
  PAYOUT_CONFIG: "otm_payout_config",
  JOBS: "otm_jobs",
  EARNINGS: "otm_earnings",
  SETTINGS: "otm_settings",
} as const;

// ─── Accounts ─────────────────────────────────────────────────────────────────

export interface StoredAccount {
  id: string;
  type: string;
  platform: string;
  username?: string;
  email?: string;
  encrypted_credentials: string;
  enabled: boolean;
  last_used?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export async function saveAccount(account: StoredAccount): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin.from(Table.ACCOUNTS).upsert(account, { onConflict: "id" });
}

export async function loadAccount(id: string): Promise<StoredAccount | null> {
  const supabase = getSupabase();
  const { data } = await supabase.from(Table.ACCOUNTS).select("*").eq("id", id).single();
  return data;
}

export async function loadAccountsByPlatform(platform: string): Promise<StoredAccount[]> {
  const supabase = getSupabase();
  const { data } = await supabase.from(Table.ACCOUNTS).select("*").eq("platform", platform);
  return data || [];
}

export async function loadAllAccounts(): Promise<StoredAccount[]> {
  const supabase = getSupabase();
  const { data } = await supabase.from(Table.ACCOUNTS).select("*");
  return data || [];
}

export async function deleteAccount(id: string): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin.from(Table.ACCOUNTS).delete().eq("id", id);
}

// ─── Payout Config ───────────────────────────────────────────────────────────

export interface StoredPayoutConfig {
  id: string;
  destination: string;
  label: string;
  enabled: boolean;
  encrypted_config: string;
  auto_withdraw: boolean;
  min_withdrawal: number;
  withdrawal_percent: number;
  max_withdrawal?: number;
  created_at: string;
  updated_at: string;
}

export async function savePayoutConfig(config: StoredPayoutConfig): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin.from(Table.PAYOUT_CONFIG).upsert(config, {
    onConflict: "id",
  });
}

export async function loadPayoutConfig(id: string): Promise<StoredPayoutConfig | null> {
  const supabase = getSupabase();
  const { data } = await supabase.from(Table.PAYOUT_CONFIG).select("*").eq("id", id).single();
  return data;
}

export async function loadAllPayoutConfigs(): Promise<StoredPayoutConfig[]> {
  const supabase = getSupabase();
  const { data } = await supabase.from(Table.PAYOUT_CONFIG).select("*");
  return data || [];
}

export async function loadActivePayoutConfig(): Promise<StoredPayoutConfig | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from(Table.PAYOUT_CONFIG)
    .select("*")
    .eq("enabled", true)
    .single();
  return data;
}

export async function deletePayoutConfig(id: string): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin.from(Table.PAYOUT_CONFIG).delete().eq("id", id);
}

// ─── Withdrawals ─────────────────────────────────────────────────────────────

export interface StoredWithdrawal {
  id: string;
  config_id?: string;
  destination: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: string;
  method: string;
  platform_source?: string;
  job_ids?: string[];
  initiated_at: string;
  processed_at?: string;
  completed_at?: string;
  reference_id?: string;
  notes?: string;
  error?: string;
}

export async function saveWithdrawal(withdrawal: StoredWithdrawal): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin.from(Table.WITHDRAWALS).upsert(withdrawal, { onConflict: "id" });
}

export async function loadWithdrawalHistory(limit = 50): Promise<StoredWithdrawal[]> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from(Table.WITHDRAWALS)
    .select("*")
    .order("initiated_at", { ascending: false })
    .limit(limit);
  return data || [];
}

export async function loadWithdrawalStats(): Promise<{
  totalWithdrawn: number;
  pendingAmount: number;
  lastWithdrawal: string | null;
  withdrawalCount: number;
  byDestination: Record<string, number>;
}> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from(Table.WITHDRAWALS)
    .select("*")
    .in("status", ["completed", "pending", "processing", "approved"]);

  const records = data || [];
  const completed = records.filter((r) => r.status === "completed");
  const pending = records.filter((r) => ["pending", "approved", "processing"].includes(r.status));

  const byDestination: Record<string, number> = {};
  for (const r of completed) {
    byDestination[r.destination] = (byDestination[r.destination] ?? 0) + r.net_amount;
  }

  const sortedCompleted = [...completed].sort((a, b) => {
    const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
    const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
    return bTime - aTime;
  });

  return {
    totalWithdrawn: completed.reduce((s, r) => s + r.net_amount, 0),
    pendingAmount: pending.reduce((s, r) => s + r.net_amount, 0),
    lastWithdrawal: sortedCompleted[0]?.completed_at ?? null,
    withdrawalCount: completed.length,
    byDestination,
  };
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export interface StoredJob {
  id: string;
  platform: string;
  external_id?: string;
  title: string;
  description?: string;
  category?: string;
  pay_amount: number;
  pay_currency: string;
  pay_type?: string;
  estimated_hours?: number;
  required_skills?: string[];
  client_rating?: number;
  posted_at?: string;
  deadline?: string;
  url?: string;
  status: string;
  accepted_at?: string;
  started_at?: string;
  completed_at?: string;
  delivered_at?: string;
  paid_at?: string;
  earned_amount: number;
  platform_fee: number;
  net_earnings: number;
  deliverable_type?: string;
  deliverable_summary?: string;
  ai_model?: string;
  tokens_used: number;
  ai_cost: number;
  fail_reason?: string;
  retry_count: number;
  logs: unknown[];
  created_at: string;
  updated_at: string;
}

export async function saveJob(job: StoredJob): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin.from(Table.JOBS).upsert(job, { onConflict: "id" });
}

export async function loadJob(id: string): Promise<StoredJob | null> {
  const supabase = getSupabase();
  const { data } = await supabase.from(Table.JOBS).select("*").eq("id", id).single();
  return data;
}

export async function loadJobsByPlatform(platform: string, status?: string): Promise<StoredJob[]> {
  const supabase = getSupabase();
  let query = supabase.from(Table.JOBS).select("*").eq("platform", platform);
  if (status) {
    query = query.eq("status", status);
  }
  const { data } = await query;
  return data || [];
}

export async function loadRecentJobs(limit = 20, status?: string): Promise<StoredJob[]> {
  const supabase = getSupabase();
  let query = supabase
    .from(Table.JOBS)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status) {
    query = query.eq("status", status);
  }
  const { data } = await query;
  return data || [];
}

// ─── Earnings ────────────────────────────────────────────────────────────────

export interface StoredEarning {
  id: string;
  date: string;
  platform: string;
  job_id?: string;
  gross: number;
  platform_fee: number;
  ai_cost: number;
  net: number;
  category?: string;
  created_at: string;
}

export async function saveEarning(earning: StoredEarning): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin.from(Table.EARNINGS).upsert(earning, { onConflict: "id" });
}

export async function loadEarnings(startDate?: string, endDate?: string): Promise<StoredEarning[]> {
  const supabase = getSupabase();
  let query = supabase.from(Table.EARNINGS).select("*").order("date", { ascending: false });
  if (startDate) {
    query = query.gte("date", startDate);
  }
  if (endDate) {
    query = query.lte("date", endDate);
  }
  const { data } = await query;
  return data || [];
}

export async function loadEarningsSummary(): Promise<{
  today: number;
  thisWeek: number;
  thisMonth: number;
  allTime: number;
}> {
  const supabase = getSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date();
  monthStart.setDate(1);

  const { data } = await supabase.from(Table.EARNINGS).select("date, net");

  const records = data || [];
  let todayTotal = 0;
  let weekTotal = 0;
  let monthTotal = 0;
  let allTime = 0;

  for (const r of records) {
    allTime += r.net;
    if (r.date >= today.slice(0, 10)) {
      todayTotal += r.net;
    }
    if (r.date >= weekStart.toISOString().slice(0, 10)) {
      weekTotal += r.net;
    }
    if (r.date >= monthStart.toISOString().slice(0, 10)) {
      monthTotal += r.net;
    }
  }

  return { today: todayTotal, thisWeek: weekTotal, thisMonth: monthTotal, allTime };
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function saveSetting(key: string, value: string): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin
    .from(Table.SETTINGS)
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
}

export async function loadSetting(key: string): Promise<string | null> {
  const supabase = getSupabase();
  const { data } = await supabase.from(Table.SETTINGS).select("value").eq("key", key).single();
  return data?.value ?? null;
}
