import {
  CompletionCache,
  cacheKeyFor,
  CompletionCacheConfig,
} from "./completion-cache";
import {
  LLMCompletionRequest,
  LLMCompletionResponse,
} from "../llm/provider";

const req1: LLMCompletionRequest = {
  messages: [{ role: "user", content: "Write a hello world function" }],
  model: "llama3",
  temperature: 0,
};

const req2: LLMCompletionRequest = {
  messages: [{ role: "user", content: "Explain recursion" }],
  model: "llama3",
  temperature: 0,
};

const response1: LLMCompletionResponse = {
  content: "function hello() { return 'hello'; }",
  model: "llama3",
  provider: "ollama",
};

const response2: LLMCompletionResponse = {
  content: "Recursion is when a function calls itself.",
  model: "llama3",
  provider: "ollama",
};

describe("cacheKeyFor", () => {
  it("produces the same key for identical requests", () => {
    const a = cacheKeyFor(req1);
    const b = cacheKeyFor({ ...req1 });
    expect(a).toBe(b);
  });

  it("produces different keys for different messages", () => {
    expect(cacheKeyFor(req1)).not.toBe(cacheKeyFor(req2));
  });

  it("produces different keys for different models", () => {
    const a = cacheKeyFor({ ...req1, model: "llama3" });
    const b = cacheKeyFor({ ...req1, model: "codellama" });
    expect(a).not.toBe(b);
  });

  it("produces different keys for different temperatures", () => {
    const a = cacheKeyFor({ ...req1, temperature: 0 });
    const b = cacheKeyFor({ ...req1, temperature: 0.7 });
    expect(a).not.toBe(b);
  });

  it("treats undefined model as empty string", () => {
    const a = cacheKeyFor({ messages: req1.messages, model: undefined });
    const b = cacheKeyFor({ messages: req1.messages, model: "" });
    expect(a).toBe(b);
  });
});

describe("CompletionCache", () => {
  let cache: CompletionCache;

  beforeEach(() => {
    cache = new CompletionCache();
  });

  it("starts empty with zero stats", () => {
    expect(cache.size).toBe(0);
    const stats = cache.getStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.evictions).toBe(0);
    expect(stats.hitRate).toBe(0);
  });

  it("returns undefined on cache miss", () => {
    expect(cache.get(req1)).toBeUndefined();
    expect(cache.getStats().misses).toBe(1);
  });

  it("stores and retrieves a response", () => {
    cache.set(req1, response1);
    const result = cache.get(req1);
    expect(result).toEqual(response1);
    expect(cache.getStats().hits).toBe(1);
  });

  it("does not return another request's response", () => {
    cache.set(req1, response1);
    expect(cache.get(req2)).toBeUndefined();
  });

  it("calculates hit rate correctly", () => {
    cache.set(req1, response1);
    cache.get(req1); // hit
    cache.get(req2); // miss
    const stats = cache.getStats();
    expect(stats.hitRate).toBeCloseTo(0.5);
  });

  it("evicts LRU entry when full", () => {
    const small = new CompletionCache({ maxSize: 2 });
    const r0: LLMCompletionRequest = {
      messages: [{ role: "user", content: "req0" }],
    };
    const r1: LLMCompletionRequest = {
      messages: [{ role: "user", content: "req1" }],
    };
    const r2: LLMCompletionRequest = {
      messages: [{ role: "user", content: "req2" }],
    };

    small.set(r0, response1);
    small.set(r1, response2);
    // Access r0 to make it more-recently-used than r1
    small.get(r0);
    // Adding r2 should evict r1 (LRU)
    small.set(r2, response1);

    expect(small.get(r1)).toBeUndefined(); // evicted
    expect(small.get(r0)).toBeDefined();   // still present
    expect(small.get(r2)).toBeDefined();   // just added
    expect(small.getStats().evictions).toBe(1);
  });

  it("expires entries after TTL", () => {
    jest.useFakeTimers();
    const shortCache = new CompletionCache({ ttlMs: 1000 });

    shortCache.set(req1, response1);
    expect(shortCache.get(req1)).toBeDefined();

    jest.advanceTimersByTime(1001);
    expect(shortCache.get(req1)).toBeUndefined();
    jest.useRealTimers();
  });

  it("purgeExpired removes expired entries and returns count", () => {
    jest.useFakeTimers();
    const shortCache = new CompletionCache({ ttlMs: 500 });

    shortCache.set(req1, response1);
    shortCache.set(req2, response2);
    jest.advanceTimersByTime(600);

    const purged = shortCache.purgeExpired();
    expect(purged).toBe(2);
    expect(shortCache.size).toBe(0);
    jest.useRealTimers();
  });

  it("invalidate removes a specific entry", () => {
    cache.set(req1, response1);
    cache.set(req2, response2);
    cache.invalidate(req1);
    expect(cache.get(req1)).toBeUndefined();
    expect(cache.get(req2)).toBeDefined();
  });

  it("clear empties all entries", () => {
    cache.set(req1, response1);
    cache.set(req2, response2);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it("getOrFetch calls fetchFn on miss and caches result", async () => {
    let fetchCount = 0;
    const fetch = async (_req: LLMCompletionRequest) => {
      fetchCount++;
      return response1;
    };

    const result = await cache.getOrFetch(req1, fetch);
    expect(result.content).toBe(response1.content);
    expect(fetchCount).toBe(1);

    // Second call: should hit cache, not call fetchFn
    await cache.getOrFetch(req1, fetch);
    expect(fetchCount).toBe(1);
  });

  it("getOrFetch marks cache hits with finishReason cache-hit", async () => {
    cache.set(req1, response1);
    const result = await cache.getOrFetch(req1, async () => response2);
    expect(result.finishReason).toBe("cache-hit");
  });
});
