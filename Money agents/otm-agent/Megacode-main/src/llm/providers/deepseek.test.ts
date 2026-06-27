import { DeepSeekProvider } from "./deepseek";

describe("DeepSeekProvider", () => {
  it("uses baseUrl without double /v1 when configured", () => {
    const provider = new DeepSeekProvider({
      name: "deepseek",
      baseUrl: "https://api.deepseek.com",
      apiKey: "test-key",
      models: ["deepseek-chat"],
      defaultModel: "deepseek-chat",
      enabled: true,
    });
    expect(provider.config.baseUrl).toBe("https://api.deepseek.com");
  });
});

