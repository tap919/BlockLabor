import { OpenAICompatibleProvider } from "./openai";
import { LLMProviderConfig } from "../provider";

const BASE_CONFIG: LLMProviderConfig = {
  name: "openai",
  baseUrl: "https://api.openai.com",
  apiKey: "test-key",
  models: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
  defaultModel: "gpt-4o-mini",
  enabled: true,
};

describe("OpenAICompatibleProvider", () => {
  it("has the name from config", () => {
    const provider = new OpenAICompatibleProvider(BASE_CONFIG);
    expect(provider.name).toBe("openai");
  });

  it("uses a custom provider name", () => {
    const config: LLMProviderConfig = {
      ...BASE_CONFIG,
      name: "mistral",
      baseUrl: "https://api.mistral.ai",
    };
    const provider = new OpenAICompatibleProvider(config);
    expect(provider.name).toBe("mistral");
  });

  it("returns false from healthCheck when no API key is set", async () => {
    const config: LLMProviderConfig = { ...BASE_CONFIG, apiKey: undefined };
    const provider = new OpenAICompatibleProvider(config);
    const healthy = await provider.healthCheck();
    expect(healthy).toBe(false);
  });

  it("returns default models when no API key is set for listModels", async () => {
    const config: LLMProviderConfig = { ...BASE_CONFIG, apiKey: undefined };
    const provider = new OpenAICompatibleProvider(config);
    const models = await provider.listModels();
    expect(models).toEqual(BASE_CONFIG.models);
  });

  it("throws when complete is called without an API key", async () => {
    const config: LLMProviderConfig = { ...BASE_CONFIG, apiKey: undefined };
    const provider = new OpenAICompatibleProvider(config);
    await expect(
      provider.complete({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow("API key not configured");
  });

  it("throws when streamComplete is called without an API key", async () => {
    const config: LLMProviderConfig = { ...BASE_CONFIG, apiKey: undefined };
    const provider = new OpenAICompatibleProvider(config);
    const gen = provider.streamComplete({
      messages: [{ role: "user", content: "hi" }],
    });
    await expect(gen.next()).rejects.toThrow("API key not configured");
  });

  it("exposes the provider config", () => {
    const provider = new OpenAICompatibleProvider(BASE_CONFIG);
    expect(provider.config.baseUrl).toBe("https://api.openai.com");
    expect(provider.config.models).toContain("gpt-4o");
  });

  it("returns model info for a known model", async () => {
    const provider = new OpenAICompatibleProvider(BASE_CONFIG);
    const info = await provider.getModelInfo("gpt-4o");
    expect(info).toMatchObject({
      id: "gpt-4o",
      name: "gpt-4o",
      provider: "openai",
    });
    expect(info?.capabilities.supportsFunctionCalling).toBe(true);
    expect(info?.capabilities.supportsVision).toBe(true);
  });

  it("returns null for unknown models", async () => {
    const config: LLMProviderConfig = { ...BASE_CONFIG, apiKey: undefined };
    const provider = new OpenAICompatibleProvider(config);
    const info = await provider.getModelInfo("not-real");
    expect(info).toBeNull();
  });
});
