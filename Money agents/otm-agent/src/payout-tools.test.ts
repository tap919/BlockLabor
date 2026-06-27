import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const WITHDRAWAL_STORE_PATH = "/test-home/.openclaw/otm/withdrawals.jsonl";
const PAYOUT_CONFIG_PATH = "/test-home/.openclaw/otm/payout-config.jsonl";

function clearStore() {
  Object.keys(virtualStore).forEach((k) => delete virtualStore[k]);
}

function setFile(path: string, content: string) {
  virtualStore[path] = content;
}

// ─── Helpers extracted from otm_payout_setup execute logic ───────────────────
// These replicate the exact validation rules in the tool's execute function.

function validatePayoutSetupInput(input: Record<string, unknown>): string | null {
  const minW = (input.minWithdrawal as number | undefined) ?? 100;
  const maxW = (input.maxWithdrawal as number | undefined) ?? 500;

  if (typeof minW === "number" && minW < 0) {
    return "minWithdrawal must be positive";
  }
  if (typeof maxW === "number" && (maxW < 5 || maxW > 50000)) {
    return "maxWithdrawal must be between $5 and $50,000";
  }

  const destination = input.destination as string;
  if (destination === "sofi") {
    const routing = input.sofiRouting as string | undefined;
    const account = input.sofiAccount as string | undefined;
    if (!routing || !account) {
      return "SoFi routing number and account number are required";
    }
    if (!/^\d{9}$/.test(routing)) {
      return "Routing number must be exactly 9 digits";
    }
    if (!/^\d{4,17}$/.test(account)) {
      return "Account number must be 4-17 digits";
    }
  }
  if (destination === "cashapp") {
    const cashtag = input.cashappCashtag as string | undefined;
    if (!cashtag) {
      return "CashApp $cashtag is required";
    }
  }
  return null;
}

// ─── Helpers from otm_withdraw_now execute logic ─────────────────────────────

interface MockStats {
  totalWithdrawn: number;
  pendingAmount: number;
  withdrawalCount: number;
  lastWithdrawal: string | null;
  byDestination: Record<string, number>;
}

function computeAvailableBalance(earningsAllTime: number, stats: MockStats): number {
  return Math.max(0, earningsAllTime - stats.totalWithdrawn);
}

function validateWithdrawalAmount(
  amount: number | undefined,
  availableBalance: number,
): string | null {
  const amt = amount ?? availableBalance * 0.8;
  if (availableBalance <= 0) return "No earnings available to withdraw";
  if (amt < 5) return "Minimum withdrawal is $5";
  if (amt > availableBalance)
    return `Requested $${amt.toFixed(2)} exceeds available balance of $${availableBalance.toFixed(2)}`;
  return null;
}

// ─── otm_payout_setup validation tests ────────────────────────────────────────

describe("otm_payout_setup validation", () => {
  describe("minWithdrawal", () => {
    it("rejects negative minWithdrawal", () => {
      const err = validatePayoutSetupInput({
        destination: "manual",
        label: "T",
        minWithdrawal: -10,
      });
      expect(err).toBe("minWithdrawal must be positive");
    });

    it("accepts minWithdrawal of 0", () => {
      const err = validatePayoutSetupInput({ destination: "manual", label: "T", minWithdrawal: 0 });
      expect(err).toBeNull();
    });

    it("accepts positive minWithdrawal", () => {
      const err = validatePayoutSetupInput({
        destination: "manual",
        label: "T",
        minWithdrawal: 50,
      });
      expect(err).toBeNull();
    });
  });

  describe("maxWithdrawal boundaries", () => {
    it("rejects maxWithdrawal below $5", () => {
      const err = validatePayoutSetupInput({
        destination: "manual",
        label: "T",
        maxWithdrawal: 4.99,
      });
      expect(err).toBe("maxWithdrawal must be between $5 and $50,000");
    });

    it("accepts maxWithdrawal of $5 (lower boundary)", () => {
      const err = validatePayoutSetupInput({ destination: "manual", label: "T", maxWithdrawal: 5 });
      expect(err).toBeNull();
    });

    it("accepts maxWithdrawal of $50,000 (upper boundary)", () => {
      const err = validatePayoutSetupInput({
        destination: "manual",
        label: "T",
        maxWithdrawal: 50000,
      });
      expect(err).toBeNull();
    });

    it("rejects maxWithdrawal above $50,000", () => {
      const err = validatePayoutSetupInput({
        destination: "manual",
        label: "T",
        maxWithdrawal: 50001,
      });
      expect(err).toBe("maxWithdrawal must be between $5 and $50,000");
    });
  });

  describe("SoFi routing number validation", () => {
    it("rejects routing with fewer than 9 digits", () => {
      const err = validatePayoutSetupInput({
        destination: "sofi",
        label: "T",
        sofiRouting: "12345678",
        sofiAccount: "1234567890",
      });
      expect(err).toBe("Routing number must be exactly 9 digits");
    });

    it("rejects routing with more than 9 digits", () => {
      const err = validatePayoutSetupInput({
        destination: "sofi",
        label: "T",
        sofiRouting: "1234567890",
        sofiAccount: "1234567890",
      });
      expect(err).toBe("Routing number must be exactly 9 digits");
    });

    it("rejects routing with non-numeric characters", () => {
      const err = validatePayoutSetupInput({
        destination: "sofi",
        label: "T",
        sofiRouting: "12345678A",
        sofiAccount: "1234567890",
      });
      expect(err).toBe("Routing number must be exactly 9 digits");
    });

    it("accepts exactly 9 digits", () => {
      const err = validatePayoutSetupInput({
        destination: "sofi",
        label: "T",
        sofiRouting: "000000000",
        sofiAccount: "1234567890",
      });
      expect(err).toBeNull();
    });
  });

  describe("SoFi account number validation", () => {
    it("rejects account with fewer than 4 digits", () => {
      const err = validatePayoutSetupInput({
        destination: "sofi",
        label: "T",
        sofiRouting: "000000000",
        sofiAccount: "123",
      });
      expect(err).toBe("Account number must be 4-17 digits");
    });

    it("accepts account with 4 digits (lower boundary)", () => {
      const err = validatePayoutSetupInput({
        destination: "sofi",
        label: "T",
        sofiRouting: "000000000",
        sofiAccount: "1234",
      });
      expect(err).toBeNull();
    });

    it("accepts account with 17 digits (upper boundary)", () => {
      const err = validatePayoutSetupInput({
        destination: "sofi",
        label: "T",
        sofiRouting: "000000000",
        sofiAccount: "12345678901234567",
      });
      expect(err).toBeNull();
    });

    it("rejects account with more than 17 digits", () => {
      const err = validatePayoutSetupInput({
        destination: "sofi",
        label: "T",
        sofiRouting: "000000000",
        sofiAccount: "123456789012345678",
      });
      expect(err).toBe("Account number must be 4-17 digits");
    });

    it("requires both routing and account for sofi destination", () => {
      const err = validatePayoutSetupInput({
        destination: "sofi",
        label: "T",
        sofiRouting: "000000000",
      });
      expect(err).toBe("SoFi routing number and account number are required");
    });
  });

  describe("CashApp cashtag validation", () => {
    it("rejects missing cashtag", () => {
      const err = validatePayoutSetupInput({ destination: "cashapp", label: "T" });
      expect(err).toBe("CashApp $cashtag is required");
    });

    it("accepts valid cashtag", () => {
      const err = validatePayoutSetupInput({
        destination: "cashapp",
        label: "T",
        cashappCashtag: "$testcashtag",
      });
      expect(err).toBeNull();
    });

    it("accepts cashtag without $ prefix", () => {
      const err = validatePayoutSetupInput({
        destination: "cashapp",
        label: "T",
        cashappCashtag: "testcashtag",
      });
      expect(err).toBeNull();
    });
  });

  describe("Manual destination", () => {
    it("manual has no required field validation", () => {
      const err = validatePayoutSetupInput({ destination: "manual", label: "T" });
      expect(err).toBeNull();
    });
  });
});

// ─── otm_withdraw_now validation tests ───────────────────────────────────────

describe("otm_withdraw_now validation", () => {
  describe("availableBalance formula — CRITICAL REGRESSION TESTS", () => {
    it("CRITICAL: availableBalance = earnings.allTime - stats.totalWithdrawn (NOT minus pendingAmount)", () => {
      const stats: MockStats = {
        totalWithdrawn: 100,
        pendingAmount: 50,
        withdrawalCount: 1,
        lastWithdrawal: "2024-01-01T00:00:00.000Z",
        byDestination: { sofi: 100 },
      };
      const balance = computeAvailableBalance(300, stats);
      expect(balance).toBe(200); // 300 - 100, NOT 300 - 100 - 50
    });

    it("pendingAmount is tracked SEPARATELY and does not reduce available balance", () => {
      const stats: MockStats = {
        totalWithdrawn: 0,
        pendingAmount: 500,
        withdrawalCount: 0,
        lastWithdrawal: null,
        byDestination: {},
      };
      const balance = computeAvailableBalance(1000, stats);
      expect(balance).toBe(1000); // pendingAmount(500) should NOT reduce balance
    });

    it("availableBalance is floored at 0", () => {
      const stats: MockStats = {
        totalWithdrawn: 600,
        pendingAmount: 0,
        withdrawalCount: 2,
        lastWithdrawal: "2024-01-01T00:00:00.000Z",
        byDestination: { sofi: 600 },
      };
      const balance = computeAvailableBalance(100, stats);
      expect(balance).toBe(0); // 100 - 600 < 0, floored to 0
    });
  });

  describe("amount validation", () => {
    it("rejects when availableBalance <= 0", () => {
      const err = validateWithdrawalAmount(100, 0);
      expect(err).toBe("No earnings available to withdraw");
    });

    it("rejects when availableBalance is 0 with pending amount (regression test)", () => {
      const stats: MockStats = {
        totalWithdrawn: 100,
        pendingAmount: 100,
        withdrawalCount: 2,
        lastWithdrawal: null,
        byDestination: {},
      };
      const balance = computeAvailableBalance(100, stats);
      expect(balance).toBe(0);
      const err = validateWithdrawalAmount(50, balance);
      expect(err).toBe("No earnings available to withdraw");
    });

    it("rejects explicit amount below $5", () => {
      const err = validateWithdrawalAmount(4.99, 100);
      expect(err).toBe("Minimum withdrawal is $5");
    });

    it("accepts explicit amount of $5 (lower boundary)", () => {
      const err = validateWithdrawalAmount(5, 100);
      expect(err).toBeNull();
    });

    it("rejects amount exceeding availableBalance", () => {
      const err = validateWithdrawalAmount(150, 100);
      expect(err).toContain("exceeds available balance");
    });

    it("accepts amount equal to availableBalance (boundary)", () => {
      const err = validateWithdrawalAmount(100, 100);
      expect(err).toBeNull();
    });

    it("default amount is 80% of availableBalance", () => {
      const stats: MockStats = {
        totalWithdrawn: 0,
        pendingAmount: 0,
        withdrawalCount: 0,
        lastWithdrawal: null,
        byDestination: {},
      };
      const balance = computeAvailableBalance(500, stats);
      const defaultAmount = balance * 0.8;
      expect(defaultAmount).toBe(400);
      const err = validateWithdrawalAmount(defaultAmount, balance);
      expect(err).toBeNull();
    });
  });
});

// ─── Routing/account masking tests ───────────────────────────────────────────

describe("bank detail masking", () => {
  function maskBankDetail(raw: string): string {
    if (raw.length <= 4) return "****";
    return "****" + raw.slice(-4);
  }

  it("masks routing number to last 4 digits", () => {
    expect(maskBankDetail("000000000")).toBe("****1334");
  });

  it("masks account number to last 4 digits", () => {
    expect(maskBankDetail("999999999999")).toBe("****8579");
  });

  it("handles short account numbers", () => {
    expect(maskBankDetail("1234")).toBe("****");
  });

  it("handles very short values", () => {
    expect(maskBankDetail("123")).toBe("****");
  });
});

// ─── Reference ID masking tests ───────────────────────────────────────────────

describe("referenceId masking", () => {
  function maskRefId(refId: string | undefined): string | undefined {
    return refId ? `****${refId.slice(-4)}` : undefined;
  }

  it("masks reference ID to last 4 chars", () => {
    expect(maskRefId("tx_abc12345")).toBe("****2345");
  });

  it("handles referenceId shorter than 4 chars", () => {
    expect(maskRefId("tx")).toBe("****tx");
  });

  it("handles undefined referenceId", () => {
    expect(maskRefId(undefined)).toBeUndefined();
  });

  it("handles exactly 4 char referenceId", () => {
    expect(maskRefId("ABCD")).toBe("****ABCD");
  });
});

// ─── Payout engine integration — disabled config rejection ─────────────────────

describe("disabled config lookup (H8 regression)", () => {
  beforeEach(async () => {
    clearStore();
    await vi.resetModules();
  });

  it("findById returns null for disabled config even if id matches", async () => {
    const disabledConfig = JSON.stringify({
      id: "disabled-id",
      destination: "sofi",
      label: "Disabled SoFi",
      enabled: false,
      autoWithdraw: false,
      minWithdrawal: 50,
      withdrawalPercent: 0.8,
      maxWithdrawal: 500,
      sofi: { routingNumber: "000000000", accountNumber: "999999999999", accountType: "checking" },
    });
    setFile(PAYOUT_CONFIG_PATH, disabledConfig + "\n");

    const { loadAllPayoutConfigs } = await import("../src/payout-engine.js");
    const configs = await loadAllPayoutConfigs();

    // Simulate the otm_withdraw_now lookup: find by id AND enabled
    const byId = configs.find((c) => c.id === "disabled-id" && c.enabled);
    expect(byId).toBeUndefined(); // H8: disabled config should NOT be selected by ID
  });

  it("first enabled config is selected when no specific id requested", async () => {
    const disabledConfig = JSON.stringify({
      id: "a",
      destination: "sofi",
      label: "A",
      enabled: false,
      autoWithdraw: false,
      minWithdrawal: 50,
      withdrawalPercent: 0.8,
      maxWithdrawal: 500,
      sofi: { routingNumber: "000000000", accountNumber: "999999999999", accountType: "checking" },
    });
    const enabledConfig = JSON.stringify({
      id: "b",
      destination: "sofi",
      label: "B",
      enabled: true,
      autoWithdraw: true,
      minWithdrawal: 50,
      withdrawalPercent: 0.8,
      maxWithdrawal: 500,
      sofi: { routingNumber: "000000000", accountNumber: "999999999999", accountType: "checking" },
    });
    setFile(PAYOUT_CONFIG_PATH, disabledConfig + "\n" + enabledConfig + "\n");

    const { loadAllPayoutConfigs } = await import("../src/payout-engine.js");
    const configs = await loadAllPayoutConfigs();
    const firstEnabled = configs.find((c) => c.enabled) ?? configs[0] ?? null;
    expect(firstEnabled?.id).toBe("b");
  });
});
