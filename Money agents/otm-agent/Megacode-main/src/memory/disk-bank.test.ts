import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { DiskMemoryBank, ONE_GIB } from "./disk-bank";

function makeBank(bankDir: string, capacityBytes?: number): DiskMemoryBank {
  return new DiskMemoryBank({ bankDir, capacityBytes });
}

describe("DiskMemoryBank — constants", () => {
  it("ONE_GIB equals 1 073 741 824 bytes", () => {
    expect(ONE_GIB).toBe(1_073_741_824);
  });
});

describe("DiskMemoryBank — open / stats", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "overcoat-mem-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates the bank directory on open()", () => {
    const dir = path.join(tmpDir, "bank");
    const bank = makeBank(dir);
    bank.open();
    expect(fs.existsSync(dir)).toBe(true);
  });

  it("reports zero usage on a fresh bank", () => {
    const bank = makeBank(path.join(tmpDir, "bank"));
    bank.open();
    const stats = bank.getStats();
    expect(stats.usedBytes).toBe(0);
    expect(stats.entryCount).toBe(0);
    expect(stats.usagePercent).toBe(0);
  });

  it("defaults to ONE_GIB capacity", () => {
    const bank = makeBank(path.join(tmpDir, "bank"));
    bank.open();
    expect(bank.capacityBytes).toBe(ONE_GIB);
  });

  it("respects a custom capacity", () => {
    const bank = makeBank(path.join(tmpDir, "bank"), 1024);
    bank.open();
    expect(bank.capacityBytes).toBe(1024);
  });
});

describe("DiskMemoryBank — write / read / delete", () => {
  let tmpDir: string;
  let bank: DiskMemoryBank;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "overcoat-mem-"));
    bank = makeBank(path.join(tmpDir, "bank"));
    bank.open();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes and reads back a payload", () => {
    bank.write("key1", "hello world");
    expect(bank.read("key1")).toBe("hello world");
  });

  it("returns undefined for an unknown key", () => {
    expect(bank.read("nope")).toBeUndefined();
  });

  it("overwrites an existing entry", () => {
    bank.write("k", "first");
    bank.write("k", "second");
    expect(bank.read("k")).toBe("second");
  });

  it("accounts capacity correctly when overwriting with different sizes near capacity", () => {
    // Create a new bank with a small explicit capacity for this test.
    const capacity = 22;
    bank = makeBank(path.join(tmpDir, "capacity-bank"), capacity);
    bank.open();

    const smallA = "a".repeat(10); // 10 bytes
    const initialB = "b".repeat(10); // 10 bytes

    // 1. Create entries close to capacity (10 + 10 = 20 <= 22).
    bank.write("a", smallA);
    bank.write("b", initialB);
    expect(bank.getStats().usedBytes).toBe(
      Buffer.byteLength(smallA, "utf8") + Buffer.byteLength(initialB, "utf8"),
    );

    // 2. Overwrite "b" with a smaller payload (should not need evictions).
    const smallerB = "b".repeat(5); // 5 bytes
    bank.write("b", smallerB);
    expect(bank.read("a")).toBe(smallA);
    expect(bank.read("b")).toBe(smallerB);
    expect(bank.getStats().usedBytes).toBe(
      Buffer.byteLength(smallA, "utf8") + Buffer.byteLength(smallerB, "utf8"),
    );

    // 3. Overwrite "a" with a larger payload (might need evictions).
    const largerA = "a".repeat(20); // 20 bytes; 20 + 5 > capacity (22)
    bank.write("a", largerA);
    expect(bank.read("a")).toBe(largerA);

    // 4. Verify final capacity usage is correct:
    //    - usedBytes matches the total size of stored entries,
    //    - and does not exceed the configured capacity.
    const valA = bank.read("a");
    const valB = bank.read("b");
    const totalSize =
      (valA ? Buffer.byteLength(valA, "utf8") : 0) +
      (valB ? Buffer.byteLength(valB, "utf8") : 0);

    const finalStats = bank.getStats();
    expect(finalStats.usedBytes).toBe(totalSize);
    expect(finalStats.usedBytes).toBeLessThanOrEqual(capacity);
  });
  it("tracks size after write", () => {
    bank.write("k", "abc");
    expect(bank.getStats().usedBytes).toBe(Buffer.byteLength("abc", "utf8"));
  });

  it("stores summary and tags", () => {
    bank.write("k", "data", { summary: "my summary", tags: ["t1", "t2"] });
    const entry = bank.listEntries().find((e) => e.key === "k")!;
    expect(entry.summary).toBe("my summary");
    expect(entry.tags).toContain("t1");
  });

  it("deletes an entry", () => {
    bank.write("k", "val");
    expect(bank.delete("k")).toBe(true);
    expect(bank.read("k")).toBeUndefined();
    expect(bank.getStats().entryCount).toBe(0);
  });

  it("returns false when deleting a non-existent key", () => {
    expect(bank.delete("ghost")).toBe(false);
  });

  it("updates usedBytes after delete", () => {
    bank.write("k", "hello");
    bank.delete("k");
    expect(bank.getStats().usedBytes).toBe(0);
  });
});

describe("DiskMemoryBank — search", () => {
  let tmpDir: string;
  let bank: DiskMemoryBank;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "overcoat-mem-"));
    bank = makeBank(path.join(tmpDir, "bank"));
    bank.open();
    bank.write("project:auth", "auth context", { summary: "Authentication flow", tags: ["auth", "session"] });
    bank.write("project:db", "db schema", { summary: "Database design", tags: ["db", "schema"] });
    bank.write("project:ui", "ui notes", { summary: "UI wireframes", tags: ["ui"] });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("searches by key substring", () => {
    expect(bank.search("auth")).toHaveLength(1);
  });

  it("searches by summary keyword (case-insensitive)", () => {
    expect(bank.search("authentication")).toHaveLength(1);
  });

  it("searches by tag", () => {
    expect(bank.search("session")).toHaveLength(1);
  });

  it("returns multiple matches", () => {
    expect(bank.search("project")).toHaveLength(3);
  });

  it("getByTag returns entries with the exact tag", () => {
    expect(bank.getByTag("auth")).toHaveLength(1);
    expect(bank.getByTag("db")).toHaveLength(1);
  });

  it("getByTag is case-insensitive", () => {
    expect(bank.getByTag("AUTH")).toHaveLength(1);
  });
});

describe("DiskMemoryBank — capacity and eviction", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "overcoat-mem-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws when a single payload exceeds capacity", () => {
    const bank = makeBank(path.join(tmpDir, "bank"), 5);
    bank.open();
    expect(() => bank.write("k", "hello-world")).toThrow("insufficient capacity");
  });

  it("auto-evicts LRU entries to make room", async () => {
    // Capacity: 12 bytes. Write two 5-byte entries, then a new 5-byte entry.
    // After old1+old2 (10 bytes), only 2 bytes remain — insufficient for 5 bytes,
    // so old1 (the LRU) is evicted first.
    const bank = makeBank(path.join(tmpDir, "bank"), 12);
    bank.open();
    bank.write("old1", "aaaaa"); // 5 bytes
    // Ensure old1 has older lastAccessedAt than old2
    await new Promise((r) => setTimeout(r, 5));
    bank.write("old2", "bbbbb"); // 5 bytes — 10 total
    await new Promise((r) => setTimeout(r, 5));
    bank.write("new1", "ccccc"); // 5 bytes — only 2 free, evicts old1
    expect(bank.getStats().entryCount).toBe(2);
    expect(bank.read("old1")).toBeUndefined();
    expect(bank.read("new1")).toBe("ccccc");
  });

  it("evictLRU removes the N oldest entries", async () => {
    const bank = makeBank(path.join(tmpDir, "bank"));
    bank.open();
    bank.write("a", "data-a");
    await new Promise((r) => setTimeout(r, 5));
    bank.write("b", "data-b");
    await new Promise((r) => setTimeout(r, 5));
    bank.write("c", "data-c");
    const evicted = bank.evictLRU(2);
    expect(evicted).toHaveLength(2);
    expect(evicted).toContain("a");
    expect(evicted).toContain("b");
    expect(bank.getStats().entryCount).toBe(1);
  });
});

describe("DiskMemoryBank — persistence across open()", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "overcoat-mem-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("survives a close-and-reopen cycle", () => {
    const dir = path.join(tmpDir, "bank");
    const bank1 = makeBank(dir);
    bank1.open();
    bank1.write("persistent-key", "important context", { tags: ["context"] });

    // Simulate re-opening (new instance, same directory)
    const bank2 = makeBank(dir);
    bank2.open();
    expect(bank2.read("persistent-key")).toBe("important context");
    expect(bank2.getByTag("context")).toHaveLength(1);
  });
});
