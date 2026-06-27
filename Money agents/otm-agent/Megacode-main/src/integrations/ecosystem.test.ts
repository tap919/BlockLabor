import { WebhookManager, APIRegistry, BrowserBridge, PluginMarketplace } from "./ecosystem";

describe("WebhookManager", () => {
  it("registers and lists webhooks", () => {
    const manager = new WebhookManager();
    manager.register({
      id: "slack-notify",
      event: "command.success",
      url: "https://hooks.slack.com/test",
      headers: {},
      enabled: true,
      maxRetries: 1,
    });
    expect(manager.listWebhooks()).toHaveLength(1);
  });

  it("blocks webhooks targeting localhost (SSRF protection)", async () => {
    const manager = new WebhookManager();
    manager.register({
      id: "ssrf-local",
      event: "test",
      url: "http://localhost:8080/internal",
      headers: {},
      enabled: true,
      maxRetries: 1,
    });
    const results = await manager.trigger("test", {});
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("private/internal");
  });

  it("blocks webhooks targeting private IPs (SSRF protection)", async () => {
    const manager = new WebhookManager();
    manager.register({
      id: "ssrf-private",
      event: "test",
      url: "http://192.168.1.1/admin",
      headers: {},
      enabled: true,
      maxRetries: 1,
    });
    const results = await manager.trigger("test", {});
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("private/internal");
  });

  it("blocks webhooks targeting 10.x.x.x (SSRF protection)", async () => {
    const manager = new WebhookManager();
    manager.register({
      id: "ssrf-10",
      event: "test",
      url: "http://10.0.0.5/metadata",
      headers: {},
      enabled: true,
      maxRetries: 1,
    });
    const results = await manager.trigger("test", {});
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("private/internal");
  });

  it("unregisters webhooks", () => {
    const manager = new WebhookManager();
    manager.register({
      id: "test",
      event: "test",
      url: "https://example.com",
      headers: {},
      enabled: true,
      maxRetries: 1,
    });
    manager.unregister("test");
    expect(manager.listWebhooks()).toHaveLength(0);
  });
});

describe("APIRegistry", () => {
  it("registers and retrieves endpoints", () => {
    const registry = new APIRegistry();
    registry.registerEndpoint({
      method: "GET",
      path: "/api/v1/providers",
      description: "List LLM providers",
    });
    expect(registry.getEndpoints()).toHaveLength(1);
  });

  it("generates an OpenAPI spec", () => {
    const registry = new APIRegistry();
    registry.registerEndpoint({
      method: "GET",
      path: "/api/v1/health",
      description: "Health check",
    });
    registry.registerEndpoint({
      method: "POST",
      path: "/api/v1/complete",
      description: "Request completion",
    });

    const spec = registry.generateSpec();
    expect(spec.openapi).toBe("3.0.0");
    expect(spec.paths).toBeDefined();
    const paths = spec.paths as Record<string, unknown>;
    expect(paths["/api/v1/health"]).toBeDefined();
    expect(paths["/api/v1/complete"]).toBeDefined();
  });
});

describe("BrowserBridge", () => {
  it("receives commands", () => {
    const bridge = new BrowserBridge();
    const cmd = bridge.receiveCommand(
      "npm install express",
      "https://expressjs.com",
      "Quick start guide"
    );
    expect(cmd.command).toBe("npm install express");
    expect(cmd.sourceUrl).toBe("https://expressjs.com");
  });

  it("queues multiple commands", () => {
    const bridge = new BrowserBridge();
    bridge.receiveCommand("cmd1");
    bridge.receiveCommand("cmd2");
    expect(bridge.getPendingCommands()).toHaveLength(2);
  });

  it("clears the command queue", () => {
    const bridge = new BrowserBridge();
    bridge.receiveCommand("cmd1");
    bridge.clearQueue();
    expect(bridge.getPendingCommands()).toHaveLength(0);
  });

  it("calls registered handlers", () => {
    const bridge = new BrowserBridge();
    const received: string[] = [];
    bridge.onCommand((cmd) => received.push(cmd.command));
    bridge.receiveCommand("test-cmd");
    expect(received).toEqual(["test-cmd"]);
  });
});

describe("PluginMarketplace", () => {
  let marketplace: PluginMarketplace;

  // Factory function to create fresh plugin objects for each test
  const createTestPlugin = (overrides = {}) => ({
    id: "test-plugin",
    name: "Test Plugin",
    description: "A test plugin",
    version: "1.0.0",
    author: { name: "Test Author", email: "test@example.com" },
    category: "tool" as const,
    tags: ["test", "example"],
    downloads: 100,
    rating: 4.5,
    ratingCount: 10,
    license: "MIT",
    publishedAt: Date.now(),
    updatedAt: Date.now(),
    verified: true,
    ...overrides,
  });

  beforeEach(() => {
    marketplace = new PluginMarketplace();
  });

  describe("registerPlugin", () => {
    it("adds a plugin to the registry", () => {
      marketplace.registerPlugin(createTestPlugin());
      expect(marketplace.getPlugin("test-plugin")).not.toBeNull();
    });
  });

  describe("search", () => {
    beforeEach(() => {
      marketplace.registerPlugin(createTestPlugin());
      marketplace.registerPlugin(createTestPlugin({
        id: "theme-dark",
        name: "Dark Theme",
        category: "theme",
        tags: ["theme", "dark"],
        downloads: 500,
        rating: 4.8,
      }));
      marketplace.registerPlugin(createTestPlugin({
        id: "linter-ts",
        name: "TypeScript Linter",
        category: "linter",
        tags: ["typescript", "linter"],
        downloads: 200,
        verified: false,
      }));
    });

    it("searches by query text", () => {
      const result = marketplace.search({ query: "dark" });
      expect(result.plugins).toHaveLength(1);
      expect(result.plugins[0].id).toBe("theme-dark");
    });

    it("filters by category", () => {
      const result = marketplace.search({ category: "linter" });
      expect(result.plugins).toHaveLength(1);
      expect(result.plugins[0].id).toBe("linter-ts");
    });

    it("filters by tags", () => {
      const result = marketplace.search({ tags: ["test"] });
      expect(result.plugins).toHaveLength(1);
      expect(result.plugins[0].id).toBe("test-plugin");
    });

    it("filters by minimum rating", () => {
      const result = marketplace.search({ minRating: 4.7 });
      expect(result.plugins).toHaveLength(1);
      expect(result.plugins[0].rating).toBeGreaterThanOrEqual(4.7);
    });

    it("filters by verified only", () => {
      const result = marketplace.search({ verifiedOnly: true });
      expect(result.plugins).toHaveLength(2);
      expect(result.plugins.every((p) => p.verified)).toBe(true);
    });

    it("sorts by downloads descending by default", () => {
      const result = marketplace.search({});
      expect(result.plugins[0].id).toBe("theme-dark");
    });

    it("sorts by name ascending", () => {
      const result = marketplace.search({ sortBy: "name", sortOrder: "asc" });
      expect(result.plugins[0].id).toBe("theme-dark");
    });

    it("applies pagination", () => {
      const result = marketplace.search({ limit: 1, offset: 1 });
      expect(result.plugins).toHaveLength(1);
      expect(result.total).toBe(3);
    });
  });

  describe("install", () => {
    it("installs a plugin", () => {
      marketplace.registerPlugin(createTestPlugin());
      const installed = marketplace.install("test-plugin");
      expect(installed).not.toBeNull();
      expect(installed?.enabled).toBe(true);
      expect(marketplace.isInstalled("test-plugin")).toBe(true);
    });

    it("increments download count on install", () => {
      const plugin = createTestPlugin();
      marketplace.registerPlugin(plugin);
      const initialDownloads = plugin.downloads;
      marketplace.install("test-plugin");
      expect(marketplace.getPlugin("test-plugin")?.downloads).toBe(initialDownloads + 1);
    });

    it("returns null for non-existent plugin", () => {
      const installed = marketplace.install("nonexistent");
      expect(installed).toBeNull();
    });

    it("accepts custom configuration", () => {
      marketplace.registerPlugin(createTestPlugin());
      const installed = marketplace.install("test-plugin", { customOption: true });
      expect(installed?.config).toEqual({ customOption: true });
    });
  });

  describe("uninstall", () => {
    it("removes an installed plugin", () => {
      marketplace.registerPlugin(createTestPlugin());
      marketplace.install("test-plugin");
      const result = marketplace.uninstall("test-plugin");
      expect(result).toBe(true);
      expect(marketplace.isInstalled("test-plugin")).toBe(false);
    });

    it("returns false for non-installed plugin", () => {
      marketplace.registerPlugin(createTestPlugin());
      const result = marketplace.uninstall("test-plugin");
      expect(result).toBe(false);
    });
  });

  describe("setEnabled", () => {
    it("enables and disables plugins", () => {
      marketplace.registerPlugin(createTestPlugin());
      marketplace.install("test-plugin");
      marketplace.setEnabled("test-plugin", false);
      expect(marketplace.getInstalledPlugin("test-plugin")?.enabled).toBe(false);
      marketplace.setEnabled("test-plugin", true);
      expect(marketplace.getInstalledPlugin("test-plugin")?.enabled).toBe(true);
    });

    it("returns false for non-installed plugin", () => {
      const result = marketplace.setEnabled("nonexistent", false);
      expect(result).toBe(false);
    });
  });

  describe("updateConfig", () => {
    it("updates plugin configuration", () => {
      marketplace.registerPlugin(createTestPlugin());
      marketplace.install("test-plugin", { optionA: true });
      marketplace.updateConfig("test-plugin", { optionB: "value" });
      const installed = marketplace.getInstalledPlugin("test-plugin");
      expect(installed?.config).toEqual({ optionA: true, optionB: "value" });
    });
  });

  describe("getInstalled", () => {
    it("returns all installed plugins", () => {
      marketplace.registerPlugin(createTestPlugin());
      marketplace.registerPlugin(createTestPlugin({ id: "plugin-2" }));
      marketplace.install("test-plugin");
      marketplace.install("plugin-2");
      expect(marketplace.getInstalled()).toHaveLength(2);
    });
  });

  describe("getFeatured", () => {
    it("returns top verified plugins by downloads", () => {
      marketplace.registerPlugin(createTestPlugin());
      marketplace.registerPlugin(createTestPlugin({
        id: "popular",
        downloads: 10000,
        verified: true,
      }));
      marketplace.registerPlugin(createTestPlugin({
        id: "unverified",
        downloads: 50000,
        verified: false,
      }));
      const featured = marketplace.getFeatured(2);
      expect(featured).toHaveLength(2);
      expect(featured.every((p) => p.verified)).toBe(true);
    });
  });

  describe("ratePlugin", () => {
    it("updates the plugin rating", () => {
      marketplace.registerPlugin(createTestPlugin({ rating: 4.0, ratingCount: 10 }));
      const result = marketplace.ratePlugin("test-plugin", 5);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      const plugin = marketplace.getPlugin("test-plugin");
      expect(plugin?.ratingCount).toBe(11);
    });

    it("rejects invalid ratings with error message", () => {
      marketplace.registerPlugin(createTestPlugin());
      const result1 = marketplace.ratePlugin("test-plugin", 6);
      expect(result1.success).toBe(false);
      expect(result1.error).toContain("between 0 and 5");

      const result2 = marketplace.ratePlugin("test-plugin", -1);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain("between 0 and 5");
    });

    it("returns error for non-existent plugin", () => {
      const result = marketplace.ratePlugin("nonexistent", 4);
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("rejects NaN ratings", () => {
      marketplace.registerPlugin(createTestPlugin());
      const result = marketplace.ratePlugin("test-plugin", NaN);
      expect(result.success).toBe(false);
      expect(result.error).toContain("finite number");
    });

    it("rejects Infinity ratings", () => {
      marketplace.registerPlugin(createTestPlugin());
      const result = marketplace.ratePlugin("test-plugin", Infinity);
      expect(result.success).toBe(false);
      expect(result.error).toContain("finite number");
    });
  });

  describe("getStats", () => {
    it("returns marketplace statistics", () => {
      marketplace.registerPlugin(createTestPlugin());
      marketplace.registerPlugin(createTestPlugin({ id: "theme-1", category: "theme" }));
      marketplace.install("test-plugin");
      const stats = marketplace.getStats();
      expect(stats.totalPlugins).toBe(2);
      expect(stats.totalInstalled).toBe(1);
      expect(stats.byCategory.tool).toBe(1);
      expect(stats.byCategory.theme).toBe(1);
    });
  });

  describe("event handlers", () => {
    it("calls install handlers", () => {
      marketplace.registerPlugin(createTestPlugin());
      const installed: string[] = [];
      marketplace.onInstall((p) => installed.push(p.id));
      marketplace.install("test-plugin");
      expect(installed).toEqual(["test-plugin"]);
    });

    it("calls uninstall handlers", () => {
      marketplace.registerPlugin(createTestPlugin());
      marketplace.install("test-plugin");
      const uninstalled: string[] = [];
      marketplace.onUninstall((id) => uninstalled.push(id));
      marketplace.uninstall("test-plugin");
      expect(uninstalled).toEqual(["test-plugin"]);
    });
  });
});
