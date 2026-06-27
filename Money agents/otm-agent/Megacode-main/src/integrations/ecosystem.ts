/**
 * Integration Ecosystem for OverCoat.
 *
 * Implementation plan for integration features:
 *
 * 1. Webhook Triggers
 *    - "When this command succeeds, notify Slack"
 *    - Configurable event-to-webhook mappings
 *    - Implementation: Event listener registry, HTTP POST with
 *      configurable payloads, retry logic with exponential backoff,
 *      support for Slack/Discord/Teams/generic webhook URLs
 *
 * 2. API-First Design
 *    - Control everything programmatically
 *    - RESTful HTTP API for all OverCoat operations
 *    - Implementation: HTTP server with JSON endpoints,
 *      API key authentication, OpenAPI spec generation,
 *      client SDKs for common languages
 *
 * 3. Browser Integration
 *    - Copy commands from docs directly to terminal
 *    - Browser extension communication via native messaging
 *    - Implementation: WebSocket listener for browser extension messages,
 *      command queue from browser, clipboard integration,
 *      documentation URL context extraction
 */

import { EventEmitter } from "events";

/** Webhook configuration for an event trigger. */
export interface WebhookConfig {
  /** Unique identifier for this webhook. */
  id: string;
  /** The event that triggers this webhook. */
  event: string;
  /** The URL to POST to. */
  url: string;
  /** Optional condition (command pattern, exit code, etc.). */
  condition?: WebhookCondition;
  /** Custom headers to include in the request. */
  headers: Record<string, string>;
  /** Whether this webhook is active. */
  enabled: boolean;
  /** Maximum retry attempts. */
  maxRetries: number;
}

export interface WebhookCondition {
  /** Command pattern to match (supports glob-like matching). */
  commandPattern?: string;
  /** Required exit code (e.g., 0 for success). */
  exitCode?: number;
}

/** Result of a webhook delivery attempt. */
export interface WebhookDelivery {
  webhookId: string;
  event: string;
  /** HTTP status code of the response. */
  statusCode: number;
  /** Whether the delivery was successful. */
  success: boolean;
  /** Number of attempts made. */
  attempts: number;
  /** Timestamp of the delivery. */
  timestamp: number;
  /** Error message, if any. */
  error?: string;
}

/** An API endpoint definition. */
export interface APIEndpoint {
  /** HTTP method (GET, POST, PUT, DELETE). */
  method: "GET" | "POST" | "PUT" | "DELETE";
  /** URL path (e.g., "/api/v1/providers"). */
  path: string;
  /** Description of the endpoint. */
  description: string;
  /** Request body schema, if applicable. */
  requestSchema?: Record<string, unknown>;
  /** Response schema. */
  responseSchema?: Record<string, unknown>;
}

/** A command received from the browser integration. */
export interface BrowserCommand {
  /** The command text. */
  command: string;
  /** Source URL where the command was copied from. */
  sourceUrl?: string;
  /** Description/context from the documentation. */
  context?: string;
  /** Timestamp of receipt. */
  receivedAt: number;
}

/**
 * WebhookManager handles event-driven webhook notifications.
 */
export class WebhookManager extends EventEmitter {
  private webhooks: Map<string, WebhookConfig> = new Map();
  private deliveries: WebhookDelivery[] = [];

  /**
   * Register a new webhook.
   */
  register(config: WebhookConfig): void {
    this.webhooks.set(config.id, config);
  }

  /**
   * Remove a webhook by ID.
   */
  unregister(id: string): boolean {
    return this.webhooks.delete(id);
  }

  /**
   * Trigger webhooks for a given event.
   */
  async trigger(
    event: string,
    payload: Record<string, unknown>
  ): Promise<WebhookDelivery[]> {
    const results: WebhookDelivery[] = [];

    for (const webhook of this.webhooks.values()) {
      if (!webhook.enabled || webhook.event !== event) continue;

      // Check conditions
      if (webhook.condition) {
        if (
          webhook.condition.exitCode !== undefined &&
          payload["exitCode"] !== webhook.condition.exitCode
        ) {
          continue;
        }
        if (
          webhook.condition.commandPattern &&
          typeof payload["command"] === "string" &&
          !payload["command"].includes(webhook.condition.commandPattern)
        ) {
          continue;
        }
      }

      const delivery = await this.deliver(webhook, event, payload);
      results.push(delivery);
      this.deliveries.push(delivery);
    }

    return results;
  }

  /** Get delivery history. */
  getDeliveries(): WebhookDelivery[] {
    return [...this.deliveries];
  }

  /** List all registered webhooks. */
  listWebhooks(): WebhookConfig[] {
    return Array.from(this.webhooks.values());
  }

  /**
   * Validate that a URL does not target private/internal networks (SSRF protection).
   * Rejects loopback, link-local, and RFC-1918 private IP ranges.
   */
  private isAllowedUrl(urlStr: string): boolean {
    let parsed: URL;
    try {
      parsed = new URL(urlStr);
    } catch {
      return false;
    }

    // Only allow http and https schemes
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname;

    // Block loopback and localhost
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "0.0.0.0"
    ) {
      return false;
    }

    // Block private/internal IP ranges (RFC 1918 + link-local)
    const privateRanges = [
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,       // 10.0.0.0/8
      /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/, // 172.16.0.0/12
      /^192\.168\.\d{1,3}\.\d{1,3}$/,            // 192.168.0.0/16
      /^169\.254\.\d{1,3}\.\d{1,3}$/,            // 169.254.0.0/16 (link-local)
      /^fc[0-9a-f]{2}:/i,                        // IPv6 unique local
      /^fe80:/i,                                  // IPv6 link-local
    ];

    if (privateRanges.some((re) => re.test(hostname))) {
      return false;
    }

    return true;
  }

  private async deliver(
    webhook: WebhookConfig,
    event: string,
    payload: Record<string, unknown>
  ): Promise<WebhookDelivery> {
    // Validate URL before making any requests (SSRF protection)
    if (!this.isAllowedUrl(webhook.url)) {
      return {
        webhookId: webhook.id,
        event,
        statusCode: 0,
        success: false,
        attempts: 0,
        timestamp: Date.now(),
        error: "Webhook URL targets a private/internal address and was blocked",
      };
    }

    let attempts = 0;
    let lastError: string | undefined;

    while (attempts < webhook.maxRetries) {
      attempts++;
      try {
        const response = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...webhook.headers,
          },
          body: JSON.stringify({ event, payload, timestamp: Date.now() }),
          signal: AbortSignal.timeout(10000),
        });

        return {
          webhookId: webhook.id,
          event,
          statusCode: response.status,
          success: response.ok,
          attempts,
          timestamp: Date.now(),
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        // Exponential backoff before retry
        if (attempts < webhook.maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempts) * 1000)
          );
        }
      }
    }

    return {
      webhookId: webhook.id,
      event,
      statusCode: 0,
      success: false,
      attempts,
      timestamp: Date.now(),
      error: lastError,
    };
  }
}

/**
 * APIRegistry defines and documents the programmatic API surface.
 */
export class APIRegistry {
  private endpoints: APIEndpoint[] = [];

  /** Register an API endpoint. */
  registerEndpoint(endpoint: APIEndpoint): void {
    this.endpoints.push(endpoint);
  }

  /** Get all registered endpoints. */
  getEndpoints(): APIEndpoint[] {
    return [...this.endpoints];
  }

  /** Generate a simplified OpenAPI-style spec. */
  generateSpec(): Record<string, unknown> {
    const paths: Record<string, Record<string, unknown>> = {};

    for (const endpoint of this.endpoints) {
      if (!paths[endpoint.path]) {
        paths[endpoint.path] = {};
      }
      paths[endpoint.path][endpoint.method.toLowerCase()] = {
        description: endpoint.description,
        requestBody: endpoint.requestSchema
          ? { content: { "application/json": { schema: endpoint.requestSchema } } }
          : undefined,
        responses: {
          "200": {
            description: "Success",
            content: endpoint.responseSchema
              ? { "application/json": { schema: endpoint.responseSchema } }
              : undefined,
          },
        },
      };
    }

    return {
      openapi: "3.0.0",
      info: {
        title: "OverCoat API",
        version: "0.1.0",
        description: "Programmatic API for OverCoat operations",
      },
      paths,
    };
  }
}

/**
 * BrowserBridge handles communication with browser extensions
 * for copying commands from documentation to the terminal.
 */
export class BrowserBridge {
  private commandQueue: BrowserCommand[] = [];
  private commandHandlers: Array<(cmd: BrowserCommand) => void> = [];

  /**
   * Receive a command from the browser extension.
   */
  receiveCommand(command: string, sourceUrl?: string, context?: string): BrowserCommand {
    const cmd: BrowserCommand = {
      command,
      sourceUrl,
      context,
      receivedAt: Date.now(),
    };
    this.commandQueue.push(cmd);
    this.commandHandlers.forEach((h) => h(cmd));
    return cmd;
  }

  /** Get pending commands from the queue. */
  getPendingCommands(): BrowserCommand[] {
    return [...this.commandQueue];
  }

  /** Clear the command queue. */
  clearQueue(): void {
    this.commandQueue = [];
  }

  /** Register a handler for incoming commands. */
  onCommand(handler: (cmd: BrowserCommand) => void): void {
    this.commandHandlers.push(handler);
  }
}

/** A plugin in the marketplace. */
export interface Plugin {
  /** Unique plugin identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** Short description. */
  description: string;
  /** Plugin version. */
  version: string;
  /** Author information. */
  author: {
    name: string;
    email?: string;
    url?: string;
  };
  /** Plugin category. */
  category: PluginCategory;
  /** Tags for search. */
  tags: string[];
  /** Number of downloads. */
  downloads: number;
  /** Average rating (0-5). */
  rating: number;
  /** Number of ratings. */
  ratingCount: number;
  /** Repository URL. */
  repositoryUrl?: string;
  /** Homepage URL. */
  homepageUrl?: string;
  /** License identifier (e.g., "MIT", "Apache-2.0"). */
  license: string;
  /** Publication date. */
  publishedAt: number;
  /** Last update date. */
  updatedAt: number;
  /** Whether the plugin is verified by the OverCoat team. */
  verified: boolean;
}

/** Plugin categories. */
export type PluginCategory =
  | "language"
  | "theme"
  | "tool"
  | "integration"
  | "linter"
  | "formatter"
  | "debugger"
  | "workflow"
  | "ai"
  | "other";

/** An installed plugin with its status. */
export interface InstalledPlugin {
  plugin: Plugin;
  /** Installation timestamp. */
  installedAt: number;
  /** Whether the plugin is enabled. */
  enabled: boolean;
  /** Local configuration. */
  config: Record<string, unknown>;
  /** Last error, if any. */
  lastError?: string;
}

/** Search filters for the marketplace. */
export interface PluginSearchFilters {
  query?: string;
  category?: PluginCategory;
  tags?: string[];
  minRating?: number;
  verifiedOnly?: boolean;
  sortBy?: "downloads" | "rating" | "updated" | "name";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

/** Result of a plugin search. */
export interface PluginSearchResult {
  plugins: Plugin[];
  total: number;
  filters: PluginSearchFilters;
}

/**
 * PluginMarketplace provides discovery, installation, and management
 * of community extensions for OverCoat.
 */
export class PluginMarketplace {
  private registry: Map<string, Plugin> = new Map();
  private installed: Map<string, InstalledPlugin> = new Map();
  private installHandlers: Array<(plugin: Plugin) => void> = [];
  private uninstallHandlers: Array<(pluginId: string) => void> = [];

  /**
   * Register a plugin in the marketplace registry.
   */
  registerPlugin(plugin: Plugin): void {
    this.registry.set(plugin.id, plugin);
  }

  /**
   * Search for plugins in the marketplace.
   */
  search(filters: PluginSearchFilters = {}): PluginSearchResult {
    let plugins = Array.from(this.registry.values());

    // Apply text search
    if (filters.query) {
      const query = filters.query.toLowerCase();
      plugins = plugins.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    // Apply category filter
    if (filters.category) {
      plugins = plugins.filter((p) => p.category === filters.category);
    }

    // Apply tags filter
    if (filters.tags && filters.tags.length > 0) {
      plugins = plugins.filter((p) =>
        filters.tags!.some((tag) => p.tags.includes(tag))
      );
    }

    // Apply rating filter
    if (filters.minRating !== undefined) {
      plugins = plugins.filter((p) => p.rating >= filters.minRating!);
    }

    // Apply verified filter
    if (filters.verifiedOnly) {
      plugins = plugins.filter((p) => p.verified);
    }

    const total = plugins.length;

    // Apply sorting
    const sortBy = filters.sortBy ?? "downloads";
    const sortOrder = filters.sortOrder ?? "desc";
    plugins.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "downloads":
          cmp = a.downloads - b.downloads;
          break;
        case "rating":
          cmp = a.rating - b.rating;
          break;
        case "updated":
          cmp = a.updatedAt - b.updatedAt;
          break;
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
      }
      return sortOrder === "desc" ? -cmp : cmp;
    });

    // Apply pagination
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 20;
    plugins = plugins.slice(offset, offset + limit);

    return { plugins, total, filters };
  }

  /**
   * Get a plugin by ID.
   */
  getPlugin(id: string): Plugin | null {
    return this.registry.get(id) ?? null;
  }

  /**
   * Install a plugin.
   */
  install(
    pluginId: string,
    config: Record<string, unknown> = {}
  ): InstalledPlugin | null {
    const plugin = this.registry.get(pluginId);
    if (!plugin) return null;

    const installed: InstalledPlugin = {
      plugin,
      installedAt: Date.now(),
      enabled: true,
      config,
    };

    this.installed.set(pluginId, installed);

    // Update download count
    plugin.downloads++;

    // Notify handlers
    this.installHandlers.forEach((h) => h(plugin));

    return installed;
  }

  /**
   * Uninstall a plugin.
   */
  uninstall(pluginId: string): boolean {
    const result = this.installed.delete(pluginId);
    if (result) {
      this.uninstallHandlers.forEach((h) => h(pluginId));
    }
    return result;
  }

  /**
   * Enable or disable a plugin.
   */
  setEnabled(pluginId: string, enabled: boolean): boolean {
    const installed = this.installed.get(pluginId);
    if (!installed) return false;
    installed.enabled = enabled;
    return true;
  }

  /**
   * Update plugin configuration.
   */
  updateConfig(pluginId: string, config: Record<string, unknown>): boolean {
    const installed = this.installed.get(pluginId);
    if (!installed) return false;
    installed.config = { ...installed.config, ...config };
    return true;
  }

  /**
   * Get all installed plugins.
   */
  getInstalled(): InstalledPlugin[] {
    return Array.from(this.installed.values());
  }

  /**
   * Get installed plugin by ID.
   */
  getInstalledPlugin(pluginId: string): InstalledPlugin | null {
    return this.installed.get(pluginId) ?? null;
  }

  /**
   * Check if a plugin is installed.
   */
  isInstalled(pluginId: string): boolean {
    return this.installed.has(pluginId);
  }

  /**
   * Get featured/popular plugins.
   */
  getFeatured(limit: number = 10): Plugin[] {
    return this.search({
      verifiedOnly: true,
      sortBy: "downloads",
      sortOrder: "desc",
      limit,
    }).plugins;
  }

  /**
   * Get plugins by category.
   */
  getByCategory(category: PluginCategory, limit: number = 20): Plugin[] {
    return this.search({
      category,
      sortBy: "downloads",
      sortOrder: "desc",
      limit,
    }).plugins;
  }

  /**
   * Rate a plugin.
   * @returns Object with success status and optional error message
   */
  ratePlugin(pluginId: string, rating: number): { success: boolean; error?: string } {
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
      return { success: false, error: "Rating must be a finite number between 0 and 5" };
    }
    
    const plugin = this.registry.get(pluginId);
    if (!plugin) {
      return { success: false, error: `Plugin '${pluginId}' not found` };
    }

    // Update average rating
    const newTotal = plugin.rating * plugin.ratingCount + rating;
    plugin.ratingCount++;
    plugin.rating = newTotal / plugin.ratingCount;

    return { success: true };
  }

  /**
   * Register a handler for plugin installation events.
   */
  onInstall(handler: (plugin: Plugin) => void): void {
    this.installHandlers.push(handler);
  }

  /**
   * Register a handler for plugin uninstallation events.
   */
  onUninstall(handler: (pluginId: string) => void): void {
    this.uninstallHandlers.push(handler);
  }

  /**
   * Get marketplace statistics.
   */
  getStats(): {
    totalPlugins: number;
    totalInstalled: number;
    byCategory: Record<PluginCategory, number>;
  } {
    const byCategory: Record<PluginCategory, number> = {
      language: 0,
      theme: 0,
      tool: 0,
      integration: 0,
      linter: 0,
      formatter: 0,
      debugger: 0,
      workflow: 0,
      ai: 0,
      other: 0,
    };

    for (const plugin of this.registry.values()) {
      byCategory[plugin.category]++;
    }

    return {
      totalPlugins: this.registry.size,
      totalInstalled: this.installed.size,
      byCategory,
    };
  }
}
