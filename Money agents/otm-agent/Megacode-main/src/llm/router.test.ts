import { LLMRouter } from "./router";
import { buildProviderConfigs, loadOvercoatSpec } from "./config";
import { LLMProvider, LLMProviderConfig, LLMCompletionRequest, LLMCompletionResponse, LLMStreamChunk } from "./provider";
import * as path from "path";

describe("LLMRouter", () => {
  let router: LLMRouter;

  beforeEach(() => {
    router = new LLMRouter({ strategy: "model-match" });
  });

  it("should initialize with no providers", () => {
    expect(router.listProviders()).toEqual([]);
  });

  it("should register providers from config", () => {
    const config: LLMProviderConfig = {
      name: "ollama",
      baseUrl: "http://localhost:11434",
      models: ["llama3", "codellama"],
      defaultModel: "llama3",
      enabled: true,
    };

    router.registerProvider(config);
    expect(router.listProviders()).toContain("ollama");
  });

  it("should register multiple providers", () => {
    const configs: LLMProviderConfig[] = [
      {
        name: "ollama",
        baseUrl: "http://localhost:11434",
        models: ["llama3"],
        defaultModel: "llama3",
        enabled: true,
      },
      {
        name: "deepseek",
        baseUrl: "https://api.deepseek.com",
        apiKey: "test-key",
        models: ["deepseek-coder"],
        defaultModel: "deepseek-coder",
        enabled: true,
      },
      {
        name: "gemini",
        baseUrl: "https://generativelanguage.googleapis.com",
        apiKey: "test-key",
        models: ["gemini-pro"],
        defaultModel: "gemini-pro",
        enabled: true,
      },
    ];

    for (const config of configs) {
      router.registerProvider(config);
    }

    const providers = router.listProviders();
    expect(providers).toHaveLength(3);
    expect(providers).toContain("ollama");
    expect(providers).toContain("deepseek");
    expect(providers).toContain("gemini");
  });

  it("should get a specific provider by name", () => {
    router.registerProvider({
      name: "ollama",
      baseUrl: "http://localhost:11434",
      models: ["llama3"],
      defaultModel: "llama3",
      enabled: true,
    });

    const provider = router.getProvider("ollama");
    expect(provider).toBeDefined();
    expect(provider?.name).toBe("ollama");
  });

  it("should return undefined for unknown provider", () => {
    expect(router.getProvider("unknown")).toBeUndefined();
  });

  it("should throw when completing with no providers", async () => {
    await expect(
      router.complete({
        messages: [{ role: "user", content: "Hello" }],
      }),
    ).rejects.toThrow("No providers available");
  });

  it("should register unknown provider types via OpenAI-compatible fallback", () => {
    router.registerProvider({
      name: "unknown-provider",
      baseUrl: "http://localhost:1234",
      models: ["test"],
      enabled: true,
    });

    // Unknown providers are registered via the OpenAI-compatible fallback,
    // enabling any OpenAI-API-compatible endpoint to work out of the box.
    expect(router.listProviders()).toContain("unknown-provider");
  });
});

describe("LLMRouter in-flight deduplication", () => {
  it("coalesces concurrent identical requests into a single provider call", async () => {
    const router = new LLMRouter({ strategy: "priority" });

    let callCount = 0;
    const mockProvider: LLMProvider = {
      name: "mock",
      config: {
        name: "mock",
        baseUrl: "http://mock",
        models: ["mock-model"],
        enabled: true,
      },
      healthCheck: async () => true,
      listModels: async () => ["mock-model"],
      getModelInfo: async (modelId: string) => ({
        id: modelId,
        name: modelId,
        provider: "mock",
        capabilities: {},
      }),
      complete: async (_req: LLMCompletionRequest): Promise<LLMCompletionResponse> => {
        callCount++;
        // Simulate async latency so both requests are in-flight simultaneously
        await new Promise((r) => setTimeout(r, 20));
        return { content: "result", model: "mock-model", provider: "mock" };
      },
      async *streamComplete(): AsyncGenerator<LLMStreamChunk, void, unknown> {
        yield { content: "result", done: true };
      },
    };

    router.registerCustomProvider(mockProvider);

    const request: LLMCompletionRequest = {
      messages: [{ role: "user", content: "Hello" }],
      model: "mock-model",
    };

    // Fire two identical concurrent requests
    const [r1, r2] = await Promise.all([
      router.complete(request),
      router.complete(request),
    ]);

    // Both should get the same result
    expect(r1.content).toBe("result");
    expect(r2.content).toBe("result");
    // Provider should only have been called once
    expect(callCount).toBe(1);
  });

  it("does not coalesce requests with different messages", async () => {
    const router = new LLMRouter({ strategy: "priority" });

    let callCount = 0;
    const mockProvider: LLMProvider = {
      name: "mock",
      config: { name: "mock", baseUrl: "http://mock", models: [], enabled: true },
      healthCheck: async () => true,
      listModels: async () => [],
      getModelInfo: async (modelId: string) => ({
        id: modelId,
        name: modelId,
        provider: "mock",
        capabilities: {},
      }),
      complete: async (_req: LLMCompletionRequest): Promise<LLMCompletionResponse> => {
        callCount++;
        await new Promise((r) => setTimeout(r, 20));
        return { content: "result", model: "m", provider: "mock" };
      },
      async *streamComplete(): AsyncGenerator<LLMStreamChunk, void, unknown> {
        yield { content: "", done: true };
      },
    };

    router.registerCustomProvider(mockProvider);

    await Promise.all([
      router.complete({ messages: [{ role: "user", content: "Req A" }] }),
      router.complete({ messages: [{ role: "user", content: "Req B" }] }),
    ]);

    expect(callCount).toBe(2);
  });

  it("propagates the error to all concurrent callers and cleans up the in-flight entry", async () => {
    const router = new LLMRouter({ strategy: "priority", enableFailover: false, maxRetries: 0 });

    let callCount = 0;
    const mockProvider: LLMProvider = {
      name: "mock",
      config: { name: "mock", baseUrl: "http://mock", models: [], enabled: true },
      healthCheck: async () => true,
      listModels: async () => [],
      getModelInfo: async (modelId: string) => ({
        id: modelId,
        name: modelId,
        provider: "mock",
        capabilities: {},
      }),
      complete: async (_req: LLMCompletionRequest): Promise<LLMCompletionResponse> => {
        callCount++;
        await new Promise((r) => setTimeout(r, 20));
        throw new Error("provider failed");
      },
      async *streamComplete(): AsyncGenerator<LLMStreamChunk, void, unknown> {
        yield { content: "", done: true };
      },
    };

    router.registerCustomProvider(mockProvider);

    const request: LLMCompletionRequest = {
      messages: [{ role: "user", content: "Hello" }],
    };

    // Both concurrent identical requests should fail with the same error
    const [r1, r2] = await Promise.allSettled([
      router.complete(request),
      router.complete(request),
    ]);

    expect(r1.status).toBe("rejected");
    expect((r1 as PromiseRejectedResult).reason.message).toBe("provider failed");
    expect(r2.status).toBe("rejected");
    expect((r2 as PromiseRejectedResult).reason.message).toBe("provider failed");
    // Only one provider call was made (deduplication worked)
    expect(callCount).toBe(1);

    // After the failure, the in-flight entry must be cleaned up so subsequent
    // requests make a fresh provider call rather than getting a stale rejection
    await expect(router.complete(request)).rejects.toThrow("provider failed");
    expect(callCount).toBe(2);
  });
});

describe("Config", () => {
  it("should build default provider configs", () => {
    const configs = buildProviderConfigs();
    expect(configs.length).toBeGreaterThanOrEqual(3);

    const names = configs.map((c) => c.name);
    expect(names).toContain("ollama");
    expect(names).toContain("deepseek");
    expect(names).toContain("gemini");
  });

  it("should apply overrides to provider configs", () => {
    const configs = buildProviderConfigs(undefined, {
      ollama: { baseUrl: "http://custom:11434" },
    });

    const ollama = configs.find((c) => c.name === "ollama");
    expect(ollama?.baseUrl).toBe("http://custom:11434");
  });

  it("should add custom providers via overrides", () => {
    const configs = buildProviderConfigs(undefined, {
      custom: {
        name: "custom",
        baseUrl: "http://custom-llm:8080",
        models: ["custom-model"],
        enabled: true,
      },
    });

    const custom = configs.find((c) => c.name === "custom");
    expect(custom).toBeDefined();
    expect(custom?.baseUrl).toBe("http://custom-llm:8080");
  });

  it("should load API keys from environment variables", () => {
    const originalDeepseek = process.env.DEEPSEEK_API_KEY;
    const originalGemini = process.env.GEMINI_API_KEY;
    try {
      process.env.DEEPSEEK_API_KEY = "test-deepseek-key";
      process.env.GEMINI_API_KEY = "test-gemini-key";

      const configs = buildProviderConfigs();
      const deepseek = configs.find((c) => c.name === "deepseek");
      const gemini = configs.find((c) => c.name === "gemini");
      expect(deepseek?.apiKey).toBe("test-deepseek-key");
      expect(gemini?.apiKey).toBe("test-gemini-key");
    } finally {
      if (originalDeepseek === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = originalDeepseek;
      if (originalGemini === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = originalGemini;
    }
  });

  it("should not override explicitly set API keys with env vars", () => {
    const originalDeepseek = process.env.DEEPSEEK_API_KEY;
    try {
      process.env.DEEPSEEK_API_KEY = "env-key";

      const configs = buildProviderConfigs(undefined, {
        deepseek: { apiKey: "explicit-key" },
      });
      const deepseek = configs.find((c) => c.name === "deepseek");
      expect(deepseek?.apiKey).toBe("explicit-key");
    } finally {
      if (originalDeepseek === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = originalDeepseek;
    }
  });

  it("should apply DeepSeek API key from apiKeys map", () => {
    const configs = buildProviderConfigs(undefined, undefined, {
      deepseek: "sk-from-apikeys",
    });
    const deepseek = configs.find((c) => c.name === "deepseek");
    expect(deepseek?.apiKey).toBe("sk-from-apikeys");
  });

  it("apiKeys map should take priority over environment variable", () => {
    const original = process.env.DEEPSEEK_API_KEY;
    try {
      process.env.DEEPSEEK_API_KEY = "env-key";
      const configs = buildProviderConfigs(undefined, undefined, {
        deepseek: "sk-explicit",
      });
      const deepseek = configs.find((c) => c.name === "deepseek");
      expect(deepseek?.apiKey).toBe("sk-explicit");
    } finally {
      if (original === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = original;
    }
  });

  it("providerOverrides apiKey should take priority over apiKeys map", () => {
    const configs = buildProviderConfigs(
      undefined,
      { deepseek: { apiKey: "override-wins" } },
      { deepseek: "apikeys-loses" },
    );
    const deepseek = configs.find((c) => c.name === "deepseek");
    expect(deepseek?.apiKey).toBe("override-wins");
  });

  it("should apply multiple provider keys from apiKeys map", () => {
    const configs = buildProviderConfigs(undefined, undefined, {
      deepseek: "sk-ds",
      gemini: "ai-gem",
      openai: "sk-oai",
    });
    expect(configs.find((c) => c.name === "deepseek")?.apiKey).toBe("sk-ds");
    expect(configs.find((c) => c.name === "gemini")?.apiKey).toBe("ai-gem");
    expect(configs.find((c) => c.name === "openai")?.apiKey).toBe("sk-oai");
  });

  it("should load the overcoat spec from the project root", () => {
    // The "Overcoat " file exists in the project root
    const projectRoot = path.resolve(__dirname, "../..");
    const spec = loadOvercoatSpec(projectRoot);
    expect(spec).toBeDefined();
    expect(spec?.project?.name).toBe("OverCoat");
    expect(spec?.stack?.llm?.providers).toContain("Ollama");
    expect(spec?.stack?.llm?.providers).toContain("DeepSeek");
    expect(spec?.stack?.llm?.providers).toContain("Gemini");
  });

  it("should build configs filtered by overcoat spec", () => {
    const projectRoot = path.resolve(__dirname, "../..");
    const spec = loadOvercoatSpec(projectRoot);
    const configs = buildProviderConfigs(spec);

    // Should include providers from the spec
    const names = configs.map((c) => c.name);
    expect(names).toContain("ollama");
    expect(names).toContain("deepseek");
    expect(names).toContain("gemini");
  });

  it("should exclude enabled providers that are not listed in the spec", () => {
    // A minimal spec listing only Ollama
    const spec = {
      project: { name: "Test", tagline: "", version: "", description: "", license: "" },
      stack: {
        core: { language: "", framework: "", runtime: "" },
        llm: { providers: ["Ollama"], integration: "" },
        ui: { desktop: "", ide_plugin: "" },
      },
      features: {},
      architecture: { channels: [], components: {}, data_flow: "" },
    } as import("./config").OvercoatConfig;

    const configs = buildProviderConfigs(spec);
    const names = configs.map((c) => c.name);

    expect(names).toContain("ollama");
    // deepseek and gemini are enabled by default but NOT in this spec
    expect(names).not.toContain("deepseek");
    expect(names).not.toContain("gemini");
  });
});
