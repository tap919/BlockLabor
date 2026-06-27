/**
 * Mercury ACH Payout Client
 *
 * Initiates real ACH transfers from the Mercury business bank account
 * to external destinations (SoFi checking, CashApp).
 *
 * API docs: https://docs.mercury.com
 * Base URL: https://backend.mercury.com/api/v1
 * Auth: HTTP Basic — username is the full token (including `secret-token:`
 *       prefix if present), password is empty.
 *
 * SoFi routing: BANK_ROUTING env var, account: BANK_ACCOUNT env var (checking)
 * CashApp: CASHAPP_TAG env var (uses ACH routing — CashApp provides ACH details)
 *
 * IMPORTANT: Transfers are REAL and move REAL money.
 * This client does NOT simulate — every call hits the live Mercury API.
 * Guard all calls with proper amount validation before invoking.
 */

const MERCURY_API_BASE = "https://backend.mercury.com/api/v1";
const MERCURY_API_KEY = process.env.MERCURY_API_KEY ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MercuryAccount {
  id: string;
  name: string;
  kind: string;
  status: string;
  currentBalance: number;
  availableBalance: number;
  routingNumber: string;
  accountNumber: string;
  createdAt: string;
}

export interface MercuryRecipient {
  id: string;
  name: string;
  status: string;
  accountType?: string;
  routingNumber?: string;
  accountNumber?: string;
  emails: string[];
}

export interface MercuryTransfer {
  id: string;
  status: "pending" | "sent" | "cancelled" | "failed" | "returned";
  amount: number; // In USD (decimal, e.g. 85.00)
  note?: string;
  estimatedDeliveryDate?: string;
  createdAt: string;
  postedAt?: string;
  recipientId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mercuryHeaders() {
  if (!MERCURY_API_KEY) {
    throw new Error(
      "MERCURY_API_KEY environment variable is not set. " +
      "Set it in .env.local to enable real ACH payouts.",
    );
  }
  // Mercury API uses HTTP Basic auth: username = full token, password = empty.
  // The token may include a `secret-token:` prefix — pass it as-is.
  const basicAuth = Buffer.from(`${MERCURY_API_KEY}:`).toString("base64");
  return {
    Authorization: `Basic ${basicAuth}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function mercuryGet<T>(path: string): Promise<T> {
  const res = await fetch(`${MERCURY_API_BASE}${path}`, {
    headers: mercuryHeaders(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Mercury GET ${path} → HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

async function mercuryPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${MERCURY_API_BASE}${path}`, {
    method: "POST",
    headers: mercuryHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Mercury POST ${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * List all Mercury accounts.
 * Use to find the account ID needed for transfers.
 */
export async function listAccounts(): Promise<MercuryAccount[]> {
  const resp = await mercuryGet<{ accounts: MercuryAccount[] }>("/accounts");
  return resp.accounts;
}

/**
 * Get a single account by ID (or the first account if no ID given).
 */
export async function getPrimaryAccount(): Promise<MercuryAccount> {
  const accounts = await listAccounts();
  if (!accounts.length) throw new Error("No Mercury accounts found");
  return accounts[0];
}

/**
 * List existing recipients (payees) on the Mercury account.
 */
export async function listRecipients(accountId: string): Promise<MercuryRecipient[]> {
  const resp = await mercuryGet<{ recipients: MercuryRecipient[] }>(
    `/accounts/${accountId}/recipients`,
  );
  return resp.recipients;
}

/**
 * Create a new ACH recipient (external bank account).
 * Used to add SoFi or CashApp as a payee before sending.
 */
export async function createRecipient(
  accountId: string,
  opts: {
    name: string;
    routingNumber: string;
    accountNumber: string;
    accountType: "checking" | "savings";
    email?: string;
  },
): Promise<MercuryRecipient> {
  return mercuryPost<MercuryRecipient>(`/accounts/${accountId}/recipients`, {
    name: opts.name,
    routingNumber: opts.routingNumber,
    accountNumber: opts.accountNumber,
    accountType: opts.accountType,
    emails: opts.email ? [opts.email] : [],
    paymentMethod: "ach",
  });
}

/**
 * Send a real ACH transfer.
 *
 * CAUTION: This sends REAL MONEY. Validate amount before calling.
 * Minimum: $1.00. Maximum: governed by Mercury account limits.
 */
export async function sendAchTransfer(opts: {
  accountId: string;
  recipientId: string;
  amountUsd: number; // e.g. 85.00
  note?: string;
}): Promise<MercuryTransfer> {
  if (opts.amountUsd < 1.0) {
    throw new Error(`Transfer amount $${opts.amountUsd.toFixed(2)} is below $1.00 minimum`);
  }
  if (opts.amountUsd > 10_000) {
    throw new Error(`Transfer amount $${opts.amountUsd.toFixed(2)} exceeds $10,000 safety cap — manual approval required`);
  }

  return mercuryPost<MercuryTransfer>(`/accounts/${opts.accountId}/transactions`, {
    recipientId: opts.recipientId,
    amount: opts.amountUsd,
    paymentMethod: "ach",
    note: opts.note ?? "OTM Agent earnings withdrawal",
  });
}

/**
 * High-level: initiate a payout to SoFi.
 *
 * Finds or creates the SoFi recipient and sends an ACH transfer.
 * Returns the Mercury transfer object for storage in the Payout table.
 *
 * Requires MERCURY_API_KEY in env.
 */
export async function payoutToSofi(amountUsd: number): Promise<{
  transfer: MercuryTransfer;
  accountId: string;
  recipientId: string;
}> {
  const account = await getPrimaryAccount();
  const recipients = await listRecipients(account.id);

  // Find existing SoFi recipient or create it
  const bankRouting = process.env.BANK_ROUTING || '';
  const bankAccount = process.env.BANK_ACCOUNT || '';

  let sofi = recipients.find(
    (r) =>
      r.routingNumber === bankRouting ||
      r.name?.toLowerCase().includes("sofi"),
  );

  if (!sofi) {
    sofi = await createRecipient(account.id, {
      name: "SoFi Bank",
      routingNumber: bankRouting,
      accountNumber: bankAccount,
      accountType: "checking",
    });
  }

  const transfer = await sendAchTransfer({
    accountId: account.id,
    recipientId: sofi.id,
    amountUsd,
    note: `OTM Agent payout — $${amountUsd.toFixed(2)} earned`,
  });

  return { transfer, accountId: account.id, recipientId: sofi.id };
}

/**
 * Check if Mercury API key is configured and valid.
 * Returns { ok: true } if the API responds, { ok: false, error } otherwise.
 */
export async function checkMercuryConnection(): Promise<{ ok: boolean; error?: string; balance?: number }> {
  if (!MERCURY_API_KEY) {
    return { ok: false, error: "MERCURY_API_KEY not set in environment" };
  }
  try {
    const account = await getPrimaryAccount();
    return { ok: true, balance: account.availableBalance };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
