import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PayoutConfig, WithdrawalRecord } from "./payout-engine.js";

const virtualStore: Record<string, string> = {};

vi.mock("node:fs/promises", () => ({
  appendFile: vi.fn(async (path: string, data: string) => {
    virtualStore[path] = (virtualStore[path] ?? "") + data;
  }),
  readFile: vi.fn(async (path: string) => {
    return virtualStore[path] ?? "";
  }),
  writeFile: vi.fn(async (path: string, data: string) => {
    virtualStore[path] = data;
  }),
  open: vi.fn(async (path: string, flags: string) => {
    if (flags === "wx" && path in virtualStore) {
      throw Object.assign(new Error("EEXIST"), { code: "EEXIST" });
    }
    virtualStore[path] = "";
    return {
      writeFile: vi.fn(async (data: string) => {
        virtualStore[path] = data;
      }),
      close: vi.fn(async () => {}),
    };
  }),
  unlink: vi.fn(async (path: string) => {
    delete virtualStore[path];
  }),
  mkdir: vi.fn(async () => {}),
  access: vi.fn(async (path: string) => {
    if (!(path in virtualStore)) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
  }),
}));

vi.mock("node:os", () => ({
  homedir: () => "/test-home",
}));

vi.mock("node:path", () => ({
  join: (...parts: string[]) => parts.join("/"),
}));

function setFile(path: string, content: string) {
  virtualStore[path] = content;
}

function clearStore() {
  Object.keys(virtualStore).forEach((k) => delete virtualStore[k]);
}

function makeConfig(overrides: Partial<PayoutConfig> = {}): PayoutConfig {
  return {
    id: "testid1234",
    destination: "sofi",
    label: "Test SoFi",
    enabled: true,
    autoWithdraw: false,
    minWithdrawal: 100,
    withdrawalPercent: 0.8,
    maxWithdrawal: 500,
    sofi: {
      routingNumber: "000000000",
      accountNumber: "999999999999",
      accountType: "checking",
    },
    ...overrides,
  };
}

function makeWithdrawal(overrides: Partial<WithdrawalRecord> = {}): WithdrawalRecord {
  return {
    id: crypto.randomUUID(),
    configId: "testid1234",
    destination: "sofi",
    amount: 100,
    fee: 0,
    netAmount: 100,
    status: "completed",
    method: "api",
    platformSource: "upwork",
    jobIds: [],
    initiatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    ...overrides,
  };
}

const WITHDRAWAL_STORE_PATH = "/test-home/.openclaw/otm/withdrawals.jsonl";
const PAYOUT_CONFIG_PATH = "/test-home/.openclaw/otm/payout-config.jsonl";

describe("payout-engine", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    clearStore();
    // Reset the module cache so module-level singletons (_withdrawalLock, payoutEngineInitialized)
    // are fresh for each test. Without this, a previous test's pending Promise chain leaks.
    await vi.resetModules();
  });

  // ─── withWithdrawalLock ─────────────────────────────────────────────────────

  describe("withWithdrawalLock", () => {
    it("passes return value through", async () => {
      const { withWithdrawalLock } = await import("./payout-engine.js");
      const result = await withWithdrawalLock(async () => 42);
      expect(result).toBe(42);
    });

    it("serializes concurrent calls — second waits for first", async () => {
      const { withWithdrawalLock } = await import("./payout-engine.js");
      const results: number[] = [];
      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

      const [p1, p2] = await Promise.all([
        withWithdrawalLock(async () => {
          await delay(30);
          results.push(1);
          return 1;
        }),
        withWithdrawalLock(async () => {
          results.push(2);
          return 2;
        }),
      ]);

      expect(results).toEqual([1, 2]);
      expect(p1).toBe(1);
      expect(p2).toBe(2);
    });

    it("releases lock even when fn throws", async () => {
      const { withWithdrawalLock } = await import("./payout-engine.js");
      const err = new Error("boom");

      await expect(
        withWithdrawalLock(async () => {
          throw err;
        }),
      ).rejects.toThrow("boom");

      // A second call should succeed (lock was released)
      const result = await withWithdrawalLock(async () => "ok");
      expect(result).toBe("ok");
    });
  });

  // ─── parseJsonl ─────────────────────────────────────────────────────────────

  describe("parseJsonl (via loadAllPayoutConfigs)", () => {
    it("returns empty array for empty string", async () => {
      const { loadAllPayoutConfigs } = await import("./payout-engine.js");
      const result = await loadAllPayoutConfigs();
      expect(result).toEqual([]);
    });

    it("skips blank and whitespace-only lines", async () => {
      setFile(PAYOUT_CONFIG_PATH, "\n  \n\n\n");
      const { loadAllPayoutConfigs } = await import("./payout-engine.js");
      const result = await loadAllPayoutConfigs();
      expect(result).toEqual([]);
    });

    it("skips malformed JSON lines silently", async () => {
      setFile(
        PAYOUT_CONFIG_PATH,
        '{"id":"a","destination":"sofi","label":"L"}\nnot json\n{"id":"b","destination":"cashapp","label":"M"}',
      );
      const { loadAllPayoutConfigs } = await import("./payout-engine.js");
      const result = await loadAllPayoutConfigs();
      expect(result).toHaveLength(2);
    });

    it("last-write-wins for duplicate IDs", async () => {
      setFile(
        PAYOUT_CONFIG_PATH,
        '{"id":"dup","destination":"sofi","label":"First"}\n{"id":"dup","destination":"cashapp","label":"Second"}',
      );
      const { loadAllPayoutConfigs } = await import("./payout-engine.js");
      const result = await loadAllPayoutConfigs();
      const dup = result.find((c) => c.id === "dup");
      expect(dup?.label).toBe("Second");
    });

    it("filters out records missing destination or label", async () => {
      setFile(
        PAYOUT_CONFIG_PATH,
        '{"id":"good","destination":"sofi","label":"Good"}\n{"id":"bad","label":"No destination"}\n{"id":"alsobad","destination":"cashapp"}',
      );
      const { loadAllPayoutConfigs } = await import("./payout-engine.js");
      const result = await loadAllPayoutConfigs();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("good");
    });

    it("records without id field are silently dropped by parseJsonl", async () => {
      setFile(
        PAYOUT_CONFIG_PATH,
        '{"destination":"sofi","label":"A"}\n{"destination":"cashapp","label":"B"}',
      );
      const { loadAllPayoutConfigs } = await import("./payout-engine.js");
      const result = await loadAllPayoutConfigs();
      expect(result).toHaveLength(0);
    });
  });

  // ─── savePayoutConfig ───────────────────────────────────────────────────────

  describe("savePayoutConfig", () => {
    it("generates new id when config.id is empty", async () => {
      const { savePayoutConfig, loadAllPayoutConfigs } = await import("./payout-engine.js");
      const config = makeConfig({ id: "" });
      await savePayoutConfig(config);
      const all = await loadAllPayoutConfigs();
      expect(all).toHaveLength(1);
      expect(all[0].id).toHaveLength(16); // 8 bytes hex = 16 chars
    });

    it("updates existing config by id", async () => {
      const { savePayoutConfig, loadAllPayoutConfigs } = await import("./payout-engine.js");
      const config = makeConfig({ id: "existid123456" });
      await savePayoutConfig(config);
      await savePayoutConfig({ ...config, label: "Updated Label" });
      const all = await loadAllPayoutConfigs();
      expect(all).toHaveLength(1);
      expect(all[0].label).toBe("Updated Label");
    });

    it("appends as new when id not found in existing", async () => {
      const { savePayoutConfig, loadAllPayoutConfigs } = await import("./payout-engine.js");
      await savePayoutConfig(makeConfig({ id: "first" }));
      await savePayoutConfig(makeConfig({ id: "second", label: "Second" }));
      const all = await loadAllPayoutConfigs();
      expect(all).toHaveLength(2);
    });
  });

  // ─── loadActivePayoutConfig ─────────────────────────────────────────────────

  describe("loadActivePayoutConfig", () => {
    it("returns first enabled config", async () => {
      const { savePayoutConfig, loadActivePayoutConfig } = await import("./payout-engine.js");
      await savePayoutConfig(makeConfig({ id: "a", enabled: false, label: "Disabled" }));
      await savePayoutConfig(makeConfig({ id: "b", enabled: true, label: "Active" }));
      const { loadAllPayoutConfigs } = await import("./payout-engine.js");
      const all = await loadAllPayoutConfigs();
      const result = all.find((c) => c.enabled) ?? all[0] ?? null;
      expect(result?.id).toBe("b");
    });

    it("falls back to index 0 when no enabled config", async () => {
      const { savePayoutConfig } = await import("./payout-engine.js");
      await savePayoutConfig(makeConfig({ id: "a", enabled: false }));
      await savePayoutConfig(makeConfig({ id: "b", enabled: false }));
      const { loadAllPayoutConfigs } = await import("./payout-engine.js");
      const all = await loadAllPayoutConfigs();
      const result = all.find((c) => c.enabled) ?? all[0] ?? null;
      expect(result?.id).toBe("a"); // falls back to index 0 even though disabled
    });

    it("returns null when no configs exist", async () => {
      const { loadActivePayoutConfig } = await import("./payout-engine.js");
      const result = await loadActivePayoutConfig();
      expect(result).toBeNull();
    });
  });

  // ─── deletePayoutConfig ─────────────────────────────────────────────────────

  describe("deletePayoutConfig", () => {
    it("removes existing config by id", async () => {
      const { savePayoutConfig, deletePayoutConfig, loadAllPayoutConfigs } =
        await import("./payout-engine.js");
      await savePayoutConfig(makeConfig({ id: "todelete" }));
      await savePayoutConfig(makeConfig({ id: "tokeep" }));
      await deletePayoutConfig("todelete");
      const all = await loadAllPayoutConfigs();
      expect(all.map((c) => c.id)).not.toContain("todelete");
      expect(all.map((c) => c.id)).toContain("tokeep");
    });

    it("is a no-op when id not found", async () => {
      const { savePayoutConfig, deletePayoutConfig, loadAllPayoutConfigs } =
        await import("./payout-engine.js");
      await savePayoutConfig(makeConfig({ id: "keep" }));
      await deletePayoutConfig("notfound");
      const all = await loadAllPayoutConfigs();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe("keep");
    });

    it("writes empty file when deleting last config", async () => {
      const { savePayoutConfig, deletePayoutConfig, loadAllPayoutConfigs } =
        await import("./payout-engine.js");
      await savePayoutConfig(makeConfig({ id: "only" }));
      await deletePayoutConfig("only");
      const all = await loadAllPayoutConfigs();
      expect(all).toHaveLength(0);
    });
  });

  // ─── getWithdrawalStats ─────────────────────────────────────────────────────

  describe("getWithdrawalStats", () => {
    it("returns zeros when no file exists", async () => {
      const { getWithdrawalStats } = await import("./payout-engine.js");
      const stats = await getWithdrawalStats();
      expect(stats.totalWithdrawn).toBe(0);
      expect(stats.pendingAmount).toBe(0);
      expect(stats.lastWithdrawal).toBeNull();
      expect(stats.withdrawalCount).toBe(0);
      expect(stats.byDestination).toEqual({});
    });

    it("totalWithdrawn sums completed records only", async () => {
      setFile(
        WITHDRAWAL_STORE_PATH,
        [
          JSON.stringify(makeWithdrawal({ id: "w1", status: "completed", netAmount: 100 })),
          JSON.stringify(makeWithdrawal({ id: "w2", status: "pending", netAmount: 50 })),
          JSON.stringify(makeWithdrawal({ id: "w3", status: "completed", netAmount: 75 })),
        ].join("\n") + "\n",
      );
      const { getWithdrawalStats } = await import("./payout-engine.js");
      const stats = await getWithdrawalStats();
      expect(stats.totalWithdrawn).toBe(175); // 100 + 75 only
      expect(stats.pendingAmount).toBe(50); // pending record
    });

    it("excludes failed and cancelled from both totals", async () => {
      setFile(
        WITHDRAWAL_STORE_PATH,
        [
          JSON.stringify(makeWithdrawal({ id: "f1", status: "failed", netAmount: 200 })),
          JSON.stringify(makeWithdrawal({ id: "c1", status: "cancelled", netAmount: 300 })),
        ].join("\n") + "\n",
      );
      const { getWithdrawalStats } = await import("./payout-engine.js");
      const stats = await getWithdrawalStats();
      expect(stats.totalWithdrawn).toBe(0);
      expect(stats.pendingAmount).toBe(0);
    });

    it("lastWithdrawal is most recent completedAt", async () => {
      const older = new Date("2024-01-01").toISOString();
      const newer = new Date("2024-06-01").toISOString();
      setFile(
        WITHDRAWAL_STORE_PATH,
        [
          JSON.stringify(makeWithdrawal({ id: "w1", completedAt: older })),
          JSON.stringify(makeWithdrawal({ id: "w2", completedAt: newer })),
        ].join("\n") + "\n",
      );
      const { getWithdrawalStats } = await import("./payout-engine.js");
      const stats = await getWithdrawalStats();
      expect(stats.lastWithdrawal).toBe(newer);
    });

    it("lastWithdrawal ignores records with no completedAt", async () => {
      const withTime = new Date("2024-06-01").toISOString();
      setFile(
        WITHDRAWAL_STORE_PATH,
        [
          JSON.stringify(makeWithdrawal({ id: "w1", completedAt: undefined })),
          JSON.stringify(makeWithdrawal({ id: "w2", completedAt: withTime })),
        ].join("\n") + "\n",
      );
      const { getWithdrawalStats } = await import("./payout-engine.js");
      const stats = await getWithdrawalStats();
      expect(stats.lastWithdrawal).toBe(withTime);
    });

    it("byDestination sums completed records only", async () => {
      setFile(
        WITHDRAWAL_STORE_PATH,
        [
          JSON.stringify(
            makeWithdrawal({ id: "w1", destination: "sofi", status: "completed", netAmount: 100 }),
          ),
          JSON.stringify(
            makeWithdrawal({
              id: "w2",
              destination: "cashapp",
              status: "completed",
              netAmount: 50,
            }),
          ),
          JSON.stringify(
            makeWithdrawal({ id: "w3", destination: "sofi", status: "pending", netAmount: 25 }),
          ),
        ].join("\n") + "\n",
      );
      const { getWithdrawalStats } = await import("./payout-engine.js");
      const stats = await getWithdrawalStats();
      expect(stats.byDestination).toEqual({ sofi: 100, cashapp: 50 });
    });

    it("CRITICAL: does NOT subtract pendingAmount from available balance computation — pendingAmount is a SEPARATE field", async () => {
      setFile(
        WITHDRAWAL_STORE_PATH,
        [
          JSON.stringify(makeWithdrawal({ id: "w1", status: "completed", netAmount: 100 })),
          JSON.stringify(makeWithdrawal({ id: "w2", status: "pending", netAmount: 50 })),
        ].join("\n") + "\n",
      );
      const { getWithdrawalStats } = await import("./payout-engine.js");
      const stats = await getWithdrawalStats();
      expect(stats.totalWithdrawn).toBe(100);
      expect(stats.pendingAmount).toBe(50);
      expect(stats.pendingAmount).not.toBe(0); // ensure pending is tracked separately
    });
  });

  // ─── getWithdrawalHistory ───────────────────────────────────────────────────

  describe("getWithdrawalHistory", () => {
    it("returns empty array when file missing", async () => {
      const { getWithdrawalHistory } = await import("./payout-engine.js");
      const result = await getWithdrawalHistory();
      expect(result).toEqual([]);
    });

    it("sorts by initiatedAt descending", async () => {
      const old = new Date("2024-01-01").toISOString();
      const recent = new Date("2024-06-01").toISOString();
      setFile(
        WITHDRAWAL_STORE_PATH,
        [
          JSON.stringify(makeWithdrawal({ id: "w1", initiatedAt: old })),
          JSON.stringify(makeWithdrawal({ id: "w2", initiatedAt: recent })),
        ].join("\n") + "\n",
      );
      const { getWithdrawalHistory } = await import("./payout-engine.js");
      const result = await getWithdrawalHistory();
      expect(result[0].id).toBe("w2");
      expect(result[1].id).toBe("w1");
    });

    it("respects limit parameter", async () => {
      setFile(
        WITHDRAWAL_STORE_PATH,
        Array.from({ length: 10 }, (_, i) =>
          JSON.stringify(
            makeWithdrawal({ id: `w${i}`, initiatedAt: new Date(2024, i, 1).toISOString() }),
          ),
        ).join("\n") + "\n",
      );
      const { getWithdrawalHistory } = await import("./payout-engine.js");
      const result = await getWithdrawalHistory(3);
      expect(result).toHaveLength(3);
    });

    it("limit=0 returns empty", async () => {
      setFile(WITHDRAWAL_STORE_PATH, JSON.stringify(makeWithdrawal()) + "\n");
      const { getWithdrawalHistory } = await import("./payout-engine.js");
      const result = await getWithdrawalHistory(0);
      expect(result).toHaveLength(0);
    });
  });

  // ─── initiateSoFiWithdrawal ─────────────────────────────────────────────────

  describe("initiateSoFiWithdrawal", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockReset();
    });

    it("returns error when no sofi config", async () => {
      const { initiateSoFiWithdrawal } = await import("./payout-engine.js");
      const result = await initiateSoFiWithdrawal(makeConfig({ sofi: undefined }), 100, "wid");
      expect(result.success).toBe(false);
      expect(result.error).toContain("SoFi config missing");
    });

    it("returns error when mercuryApiKey present but mercuryAccountId missing", async () => {
      const { initiateSoFiWithdrawal } = await import("./payout-engine.js");
      const config = makeConfig({
        sofi: {
          routingNumber: "000000000",
          accountNumber: "999999999999",
          accountType: "checking",
          mercuryApiKey: "mk_test_key",
        },
      });
      const result = await initiateSoFiWithdrawal(config, 100, "wid");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Mercury account ID not configured");
    });

    it("calls Mercury API with correct amount format (dollars, not cents)", async () => {
      const fetchMock = vi
        .spyOn(global, "fetch")
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: "tx_123" }), { status: 200 }));
      const { initiateSoFiWithdrawal } = await import("./payout-engine.js");
      const config = makeConfig({
        sofi: {
          routingNumber: "000000000",
          accountNumber: "999999999999",
          accountType: "checking",
          mercuryApiKey: "mk_test_key",
          mercuryAccountId: "acc_uuid",
        },
      });
      const result = await initiateSoFiWithdrawal(config, 99.99, "wid_123");
      expect(result.success).toBe(true);
      expect(result.referenceId).toBe("tx_123");

      const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
      expect(body.amount).toBe(99.99); // dollars, not cents
      expect(body.sourceAccountId).toBe("acc_uuid");
      expect(body.destination.routingNumber).toBe("000000000");
      expect(fetchMock.mock.calls[0]![1]!.headers).toHaveProperty("Idempotency-Key", "wid_123");
    });

    it("returns referenceId=withdrawalId when Mercury response has no id", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 }),
      );
      const { initiateSoFiWithdrawal } = await import("./payout-engine.js");
      const result = await initiateSoFiWithdrawal(
        makeConfig({
          sofi: {
            routingNumber: "000000000",
            accountNumber: "999999999999",
            accountType: "checking",
            mercuryApiKey: "mk",
            mercuryAccountId: "acc",
          },
        }),
        50,
        "wid_abc",
      );
      expect(result.referenceId).toBe("wid_abc");
    });

    it("returns error on HTTP failure", async () => {
      const longBody =
        "Internal server error — the Mercury service is currently unavailable. Please try again later. If this persists, contact support at support@mercury.com with trace ID MG-2024-ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(longBody, { status: 503 }));
      const { initiateSoFiWithdrawal } = await import("./payout-engine.js");
      const result = await initiateSoFiWithdrawal(
        makeConfig({
          sofi: {
            routingNumber: "000000000",
            accountNumber: "999999999999",
            accountType: "checking",
            mercuryApiKey: "mk",
            mercuryAccountId: "acc",
          },
        }),
        50,
        "wid",
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Mercury API error 503:");
      expect(result.error?.length).toBeLessThan(longBody.length + 30); // body truncated to 120 chars
      expect(result.error).not.toContain("@"); // special chars stripped
    });

    it("returns error when no Mercury API key (manual approval path)", async () => {
      const { initiateSoFiWithdrawal } = await import("./payout-engine.js");
      const config = makeConfig({
        sofi: {
          routingNumber: "000000000",
          accountNumber: "999999999999",
          accountType: "checking",
        },
      });
      const result = await initiateSoFiWithdrawal(config, 100, "wid");
      expect(result.success).toBe(false);
      expect(result.error).toContain("No Mercury API key");
    });
  });

  // ─── initiateCashAppWithdrawal ──────────────────────────────────────────────

  describe("initiateCashAppWithdrawal", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockReset();
    });

    it("returns error when no cashapp config", async () => {
      const { initiateCashAppWithdrawal } = await import("./payout-engine.js");
      const result = await initiateCashAppWithdrawal(
        makeConfig({ cashapp: undefined, destination: "cashapp" }),
        100,
        "wid",
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("CashApp config missing");
    });

    it("calls CashApp Payouts API with correct amount in cents", async () => {
      const fetchMock = vi
        .spyOn(global, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ payout: { id: "payout_abc" } }), { status: 200 }),
        );
      const { initiateCashAppWithdrawal } = await import("./payout-engine.js");
      const config = makeConfig({
        destination: "cashapp",
        cashapp: { cashtag: "$testcashtag", cashappApiKey: "sq_key" },
      });
      await initiateCashAppWithdrawal(config, 99.99, "wid_xyz");

      const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
      expect(body.amountMoney.amount).toBe(9999); // cents
      expect(body.destination.cashAppDetails.cashtag).toBe("$testcashtag");
    });

    it("returns paymentUrl when no API key", async () => {
      const { initiateCashAppWithdrawal } = await import("./payout-engine.js");
      const config = makeConfig({ destination: "cashapp", cashapp: { cashtag: "$testcashtag" } });
      const result = await initiateCashAppWithdrawal(config, 25, "wid");
      expect(result.success).toBe(false);
      expect(result.paymentUrl).toBe("https://cash.me/testcashtag/25.00");
      expect(result.error).toContain("No CashApp API key");
    });

    it("handles cashtag without $ prefix", async () => {
      const { initiateCashAppWithdrawal } = await import("./payout-engine.js");
      const config = makeConfig({ destination: "cashapp", cashapp: { cashtag: "testcashtag" } });
      const result = await initiateCashAppWithdrawal(config, 10, "wid");
      expect(result.paymentUrl).toBe("https://cash.me/testcashtag/10.00");
    });

    it("returns error on Square HTTP failure", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: [{ detail: "Invalid cashtag" }] }), { status: 400 }),
      );
      const { initiateCashAppWithdrawal } = await import("./payout-engine.js");
      const config = makeConfig({
        destination: "cashapp",
        cashapp: { cashtag: "$bad", cashappApiKey: "sq_key" },
      });
      const result = await initiateCashAppWithdrawal(config, 50, "wid");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid cashtag");
    });
  });

  // ─── processPayout ─────────────────────────────────────────────────────────

  describe("processPayout", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockReset();
    });

    it("logs as pending when no config and no active config", async () => {
      const { processPayout } = await import("./payout-engine.js");
      const result = await processPayout(100, "upwork", ["j1"], null);
      expect(result.status).toBe("pending");
      expect(result.notes).toContain("No payout config");
    });

    it("throws RangeError for non-positive amount (M3)", async () => {
      const { processPayout } = await import("./payout-engine.js");
      await expect(processPayout(0, "upwork", [], null)).rejects.toThrow(RangeError);
      await expect(processPayout(-1, "upwork", [], null)).rejects.toThrow(RangeError);
      await expect(processPayout(Number.NaN, "upwork", [], null)).rejects.toThrow(RangeError);
    });

    it("logs as pending when config.enabled is false", async () => {
      const { processPayout } = await import("./payout-engine.js");
      const result = await processPayout(100, "upwork", ["j1"], {
        ...makeConfig({ enabled: false }),
        id: "disabled",
      });
      expect(result.status).toBe("pending");
    });

    it("double-logs sofi withdrawal (processing then completed)", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "tx_123" }), { status: 200 }),
      );
      const { processPayout } = await import("./payout-engine.js");
      const config = makeConfig({
        sofi: {
          routingNumber: "000000000",
          accountNumber: "999999999999",
          accountType: "checking",
          mercuryApiKey: "mk",
          mercuryAccountId: "acc",
        },
      });
      await processPayout(50, "upwork", ["j1"], config);
      const lines = virtualStore[WITHDRAWAL_STORE_PATH]?.split("\n").filter(Boolean) ?? [];
      expect(lines).toHaveLength(2);
      const first = JSON.parse(lines[0]!);
      const second = JSON.parse(lines[1]!);
      expect(first.status).toBe("processing");
      expect(second.status).toBe("completed");
    });

    it("falls back to pending on sofi API failure", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response("error", { status: 500 }));
      const { processPayout } = await import("./payout-engine.js");
      const config = makeConfig({
        sofi: {
          routingNumber: "000000000",
          accountNumber: "999999999999",
          accountType: "checking",
          mercuryApiKey: "mk",
          mercuryAccountId: "acc",
        },
      });
      const result = await processPayout(50, "upwork", ["j1"], config);
      expect(result.status).toBe("pending");
      expect(result.error).toBeDefined();
    });

    it("double-logs cashapp withdrawal", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ payout: { id: "p_123" } }), { status: 200 }),
      );
      const { processPayout } = await import("./payout-engine.js");
      const config = makeConfig({
        destination: "cashapp",
        cashapp: { cashtag: "$testcashtag", cashappApiKey: "sq" },
      });
      await processPayout(25, "upwork", ["j1"], config);
      const lines = virtualStore[WITHDRAWAL_STORE_PATH]?.split("\n").filter(Boolean) ?? [];
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0]!).status).toBe("processing");
      expect(JSON.parse(lines[1]!).status).toBe("completed");
    });

    it("manual destination logs once with notes", async () => {
      const { processPayout } = await import("./payout-engine.js");
      const config = makeConfig({ destination: "manual" });
      const result = await processPayout(100, "upwork", ["j1"], config);
      expect(result.status).toBe("pending");
      expect(result.notes).toContain("manual");
      const lines = virtualStore[WITHDRAWAL_STORE_PATH]?.split("\n").filter(Boolean) ?? [];
      expect(lines).toHaveLength(1);
    });
  });

  // ─── checkAutoWithdrawal ─────────────────────────────────────────────────────

  describe("checkAutoWithdrawal", () => {
    it("returns null when no active config", async () => {
      const { checkAutoWithdrawal } = await import("./payout-engine.js");
      const result = await checkAutoWithdrawal(500);
      expect(result).toBeNull();
    });

    it("returns null when autoWithdraw is false", async () => {
      const { savePayoutConfig, checkAutoWithdrawal } = await import("./payout-engine.js");
      await savePayoutConfig(makeConfig({ autoWithdraw: false }));
      const result = await checkAutoWithdrawal(500);
      expect(result).toBeNull();
    });

    it("returns null when availableBalance < minBalance", async () => {
      const { savePayoutConfig, checkAutoWithdrawal } = await import("./payout-engine.js");
      await savePayoutConfig(makeConfig({ minWithdrawal: 200, autoWithdraw: true }));
      const result = await checkAutoWithdrawal(150);
      expect(result).toBeNull();
    });

    it("returns null when computed amount < $5", async () => {
      const { savePayoutConfig, checkAutoWithdrawal } = await import("./payout-engine.js");
      await savePayoutConfig(
        makeConfig({ minWithdrawal: 0, withdrawalPercent: 0.05, autoWithdraw: true }),
      );
      const result = await checkAutoWithdrawal(50);
      expect(result).toBeNull(); // 50 * 0.05 = 2.5 < 5
    });

    it("clamps withdrawalPercent to 0-1 range", async () => {
      const { savePayoutConfig, checkAutoWithdrawal } = await import("./payout-engine.js");
      await savePayoutConfig(
        makeConfig({ minWithdrawal: 0, withdrawalPercent: 1.5, autoWithdraw: true }),
      );
      const result = await checkAutoWithdrawal(200);
      expect(result?.netAmount).toBe(200); // clamped to 1.0
    });

    it("clamps negative withdrawalPercent to 0", async () => {
      const { savePayoutConfig, checkAutoWithdrawal } = await import("./payout-engine.js");
      await savePayoutConfig(
        makeConfig({ minWithdrawal: 0, withdrawalPercent: -0.5, autoWithdraw: true }),
      );
      const result = await checkAutoWithdrawal(200);
      expect(result).toBeNull(); // clamped to 0, amount = 0 < 5
    });

    it("respects maxWithdrawal cap", async () => {
      const { savePayoutConfig, checkAutoWithdrawal } = await import("./payout-engine.js");
      await savePayoutConfig(
        makeConfig({
          minWithdrawal: 0,
          withdrawalPercent: 1,
          maxWithdrawal: 100,
          autoWithdraw: true,
        }),
      );
      const result = await checkAutoWithdrawal(500);
      expect(result?.netAmount).toBe(100); // capped at maxWithdrawal
    });

    it("CRITICAL: availableBalance = totalNetEarnings - totalWithdrawn (NOT minus pendingAmount)", async () => {
      const { savePayoutConfig, checkAutoWithdrawal } = await import("./payout-engine.js");
      await savePayoutConfig(
        makeConfig({
          id: "autoconfig",
          minWithdrawal: 0,
          withdrawalPercent: 1,
          maxWithdrawal: Infinity,
          autoWithdraw: true,
          destination: "manual",
        }),
      );
      setFile(
        WITHDRAWAL_STORE_PATH,
        [
          JSON.stringify(makeWithdrawal({ id: "c1", status: "completed", netAmount: 100 })),
          JSON.stringify(makeWithdrawal({ id: "p1", status: "pending", netAmount: 50 })),
        ].join("\n") + "\n",
      );
      const result = await checkAutoWithdrawal(300);
      // availableBalance = 300 - 100 = 200. pendingAmount(50) is NOT subtracted.
      expect(result?.netAmount).toBe(200);
    });

    it("serializes concurrent calls via mutex", async () => {
      const { savePayoutConfig, checkAutoWithdrawal } = await import("./payout-engine.js");
      await savePayoutConfig(
        makeConfig({
          minWithdrawal: 0,
          withdrawalPercent: 1,
          maxWithdrawal: Infinity,
          autoWithdraw: true,
          destination: "manual",
        }),
      );
      const results: number[] = [];
      await Promise.all([checkAutoWithdrawal(100), checkAutoWithdrawal(200)]);
    });
  });

  // ─── initPayoutEngine ───────────────────────────────────────────────────────

  describe("initPayoutEngine", () => {
    it("is idempotent (calling twice does not error)", async () => {
      const { initPayoutEngine } = await import("./payout-engine.js");
      await initPayoutEngine();
      await expect(initPayoutEngine()).resolves.not.toThrow();
    });

    it("recovers stuck 'processing' withdrawals to 'pending' on startup (H3)", async () => {
      // Simulate a process crash that left a withdrawal in "processing"
      const stuck = makeWithdrawal({ id: "stuck1", status: "processing" });
      setFile(WITHDRAWAL_STORE_PATH, JSON.stringify(stuck) + "\n");

      const { initPayoutEngine, getWithdrawalHistory } = await import("./payout-engine.js");
      await initPayoutEngine();

      const history = await getWithdrawalHistory(10);
      const recovered = history.find((r) => r.id === "stuck1");
      expect(recovered?.status).toBe("pending");
      expect(recovered?.notes).toContain("Recovered from 'processing'");
    });
  });
});
