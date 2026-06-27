/**
 * Megacode Flows — Unified Entry Point
 *
 * This is the single API surface that ties together:
 * - MCPFlowCoordinator (connection management, tool routing, flow execution)
 * - Build Templates (11 project archetypes with pre-filled flows)
 * - Tool Recipes (28 task-specific tool-call combinations)
 *
 * Usage:
 *
 *   const flows = new MegacodeFlows();
 *   await flows.boot();                              // Connect to all 9 MCPs
 *   await flows.applyTemplate("saas-fullstack", {    // Scaffold a SaaS project
 *     projectName: "my-app",
 *     database: "postgresql",
 *   });
 *   await flows.runRecipe("new-api-endpoint");       // Run a recipe
 *   flows.shutdown();                                // Disconnect all MCPs
 *
 * The class extends EventEmitter, so you can hook into:
 *   - "boot"            → all MCPs connected
 *   - "boot-error"      → one or more MCPs failed
 *   - "template-start"  → template flow is starting
 *   - "template-done"   → template flow finished
 *   - "recipe-start"    → recipe is starting
 *   - "recipe-done"     → recipe finished
 *   - "step-start"      → individual step started
 *   - "step-complete"   → individual step completed
 *   - "step-error"      → individual step errored
 *   - "shutdown"        → all MCPs disconnected
 */

import { EventEmitter } from "events";
import {
  MCPFlowCoordinator,
  type MCPServerConfig,
  type Flow,
  type FlowResult,
  type ToolCallResult,
} from "./mcp-flow-coordinator";
import {
  getTemplate,
  listTemplates,
  searchTemplates,
  type BuildTemplate,
  type TemplateParams,
  type TemplateCategory,
} from "./build-templates";
import {
  getRecipe,
  listRecipes,
  searchRecipes,
  getRecipesByCategory,
  getAvailableRecipes,
  recipeToFlowSteps,
  type Recipe,
  type RecipeCategory,
} from "./tool-recipes";

// ============================================================================
// Types
// ============================================================================

/** Status of the MegacodeFlows system. */
export interface FlowsStatus {
  booted: boolean;
  connectedServers: number;
  totalServers: number;
  totalTools: number;
  servers: Array<{
    id: string;
    name: string;
    connected: boolean;
    toolCount: number;
  }>;
  availableTemplates: number;
  availableRecipes: number;
}

/** Options for booting the system. */
export interface BootOptions {
  /** Path to .mcp.json config file. Defaults to .mcp.json in rootDir. */
  configPath?: string;
  /** Only connect to these server IDs (useful for partial boot). */
  serverIds?: string[];
  /** Continue booting even if some servers fail. Default: true. */
  tolerateFailures?: boolean;
}

/** Result from applying a template. */
export interface TemplateResult {
  templateId: string;
  templateName: string;
  flow: FlowResult;
}

/** Result from running a recipe. */
export interface RecipeResult {
  recipeId: string;
  recipeName: string;
  flow: FlowResult;
}

/** Result of quickBuild's template selection. */
export interface QuickBuildMatch {
  templateId: string;
  templateName: string;
  score: number;
  reason: string;
}

// ============================================================================
// Keyword → Template Scoring Map
// ============================================================================

/** Keywords that map to template IDs with a weight. */
const TEMPLATE_KEYWORDS: Record<string, Array<{ keyword: string; weight: number }>> = {
  "saas-fullstack": [
    { keyword: "saas", weight: 10 },
    { keyword: "fullstack", weight: 8 },
    { keyword: "full-stack", weight: 8 },
    { keyword: "web app", weight: 7 },
    { keyword: "webapp", weight: 7 },
    { keyword: "dashboard", weight: 5 },
    { keyword: "admin", weight: 4 },
    { keyword: "auth", weight: 3 },
    { keyword: "subscription", weight: 6 },
    { keyword: "billing", weight: 5 },
    { keyword: "multi-tenant", weight: 7 },
    { keyword: "next", weight: 3 },
    { keyword: "react", weight: 2 },
  ],
  "rest-api": [
    { keyword: "api", weight: 8 },
    { keyword: "rest", weight: 10 },
    { keyword: "graphql", weight: 7 },
    { keyword: "backend", weight: 6 },
    { keyword: "server", weight: 4 },
    { keyword: "endpoint", weight: 7 },
    { keyword: "crud", weight: 6 },
    { keyword: "express", weight: 5 },
    { keyword: "fastapi", weight: 5 },
  ],
  "game-project": [
    { keyword: "game", weight: 10 },
    { keyword: "gamedev", weight: 10 },
    { keyword: "platformer", weight: 8 },
    { keyword: "rpg", weight: 8 },
    { keyword: "shooter", weight: 7 },
    { keyword: "controller", weight: 5 },
    { keyword: "gamepad", weight: 6 },
    { keyword: "sprite", weight: 5 },
    { keyword: "n64", weight: 7 },
    { keyword: "2d", weight: 4 },
    { keyword: "3d", weight: 4 },
  ],
  "microservices": [
    { keyword: "microservice", weight: 10 },
    { keyword: "distributed", weight: 8 },
    { keyword: "service mesh", weight: 8 },
    { keyword: "event-driven", weight: 6 },
    { keyword: "event bus", weight: 7 },
    { keyword: "kafka", weight: 5 },
    { keyword: "rabbitmq", weight: 5 },
    { keyword: "circuit breaker", weight: 6 },
    { keyword: "service discovery", weight: 7 },
  ],
  "ai-ml-project": [
    { keyword: "ai", weight: 8 },
    { keyword: "ml", weight: 8 },
    { keyword: "machine learning", weight: 10 },
    { keyword: "artificial intelligence", weight: 10 },
    { keyword: "vector", weight: 6 },
    { keyword: "embedding", weight: 7 },
    { keyword: "rag", weight: 8 },
    { keyword: "llm", weight: 7 },
    { keyword: "training", weight: 5 },
    { keyword: "neural", weight: 6 },
    { keyword: "model", weight: 3 },
    { keyword: "chatbot", weight: 6 },
  ],
  "cli-tool": [
    { keyword: "cli", weight: 10 },
    { keyword: "command line", weight: 10 },
    { keyword: "terminal", weight: 7 },
    { keyword: "command-line", weight: 10 },
    { keyword: "shell", weight: 5 },
    { keyword: "script", weight: 3 },
    { keyword: "tool", weight: 2 },
  ],
  "library-package": [
    { keyword: "library", weight: 10 },
    { keyword: "package", weight: 8 },
    { keyword: "npm", weight: 7 },
    { keyword: "module", weight: 5 },
    { keyword: "sdk", weight: 7 },
    { keyword: "reusable", weight: 4 },
    { keyword: "publishable", weight: 6 },
  ],
  "static-site": [
    { keyword: "static", weight: 7 },
    { keyword: "marketing", weight: 8 },
    { keyword: "landing", weight: 9 },
    { keyword: "landing page", weight: 10 },
    { keyword: "blog", weight: 6 },
    { keyword: "portfolio", weight: 7 },
    { keyword: "brochure", weight: 6 },
    { keyword: "jamstack", weight: 7 },
  ],
  "browser-extension": [
    { keyword: "extension", weight: 10 },
    { keyword: "browser extension", weight: 10 },
    { keyword: "chrome extension", weight: 10 },
    { keyword: "firefox addon", weight: 9 },
    { keyword: "addon", weight: 7 },
    { keyword: "popup", weight: 4 },
    { keyword: "content script", weight: 7 },
  ],
  "devops-pipeline": [
    { keyword: "devops", weight: 10 },
    { keyword: "ci/cd", weight: 10 },
    { keyword: "cicd", weight: 10 },
    { keyword: "pipeline", weight: 7 },
    { keyword: "deployment", weight: 6 },
    { keyword: "docker", weight: 5 },
    { keyword: "kubernetes", weight: 6 },
    { keyword: "monitoring", weight: 5 },
    { keyword: "infrastructure", weight: 5 },
  ],
  "mobile-app": [
    { keyword: "mobile", weight: 10 },
    { keyword: "ios", weight: 8 },
    { keyword: "android", weight: 8 },
    { keyword: "react native", weight: 9 },
    { keyword: "cross-platform", weight: 7 },
    { keyword: "app", weight: 2 },
    { keyword: "phone", weight: 5 },
    { keyword: "tablet", weight: 5 },
  ],
};

// ============================================================================
// MegacodeFlows Class
// ============================================================================

/**
 * The unified entry point for Megacode's flow orchestration system.
 *
 * Manages all 9 MCP connections, provides template and recipe execution,
 * and includes a natural-language quickBuild feature that auto-selects
 * the right template based on a project description.
 */
export class MegacodeFlows extends EventEmitter {
  private coordinator: MCPFlowCoordinator;
  private booted = false;
  private bootResults = new Map<string, boolean>();

  constructor(rootDir?: string) {
    super();
    this.coordinator = new MCPFlowCoordinator(rootDir);

    // Relay coordinator events
    this.coordinator.on("connected", (id: string, toolCount: number) => {
      this.emit("server-connected", id, toolCount);
    });
    this.coordinator.on("connection-error", (id: string, error: string) => {
      this.emit("server-error", id, error);
    });
    this.coordinator.on("step-start", (stepId: string, label: string) => {
      this.emit("step-start", stepId, label);
    });
    this.coordinator.on("step-complete", (stepId: string, success: boolean) => {
      this.emit("step-complete", stepId, success);
    });
    this.coordinator.on("step-error", (stepId: string, error: string) => {
      this.emit("step-error", stepId, error);
    });
    this.coordinator.on("flow-complete", (flowId: string, completed: number, total: number) => {
      this.emit("flow-complete", flowId, completed, total);
    });
  }

  // --------------------------------------------------------------------------
  // Boot / Shutdown
  // --------------------------------------------------------------------------

  /**
   * Boot the flow system: load MCP configs and connect to all servers.
   *
   * @returns Map of server ID → connected (true/false)
   */
  async boot(options: BootOptions = {}): Promise<Map<string, boolean>> {
    const tolerateFailures = options.tolerateFailures ?? true;

    // Load configs from .mcp.json
    this.coordinator.loadConfigs(options.configPath);

    // Connect to all (or selected) servers
    if (options.serverIds) {
      const results = new Map<string, boolean>();
      for (const id of options.serverIds) {
        const ok = await this.coordinator.connect(id);
        results.set(id, ok);
      }
      this.bootResults = results;
    } else {
      this.bootResults = await this.coordinator.connectAll();
    }

    const connectedCount = [...this.bootResults.values()].filter(Boolean).length;
    const totalCount = this.bootResults.size;

    if (connectedCount === 0) {
      this.emit("boot-error", "No MCP servers connected");
      if (!tolerateFailures) {
        throw new Error("Boot failed: no MCP servers connected");
      }
    } else if (connectedCount < totalCount) {
      const failed = [...this.bootResults.entries()]
        .filter(([, ok]) => !ok)
        .map(([id]) => id);
      this.emit("boot", connectedCount, totalCount, failed);

      if (!tolerateFailures) {
        throw new Error(`Boot failed: ${failed.join(", ")} did not connect`);
      }
    } else {
      this.emit("boot", connectedCount, totalCount, []);
    }

    this.booted = true;
    return this.bootResults;
  }

  /**
   * Shut down all MCP connections and clean up event listeners.
   */
  shutdown(): void {
    this.coordinator.disconnectAll();
    this.coordinator.removeAllListeners();
    this.booted = false;
    this.bootResults.clear();
    this.emit("shutdown");
  }

  /** Whether the system has booted. */
  get isBooted(): boolean {
    return this.booted;
  }

  // --------------------------------------------------------------------------
  // Status / Introspection
  // --------------------------------------------------------------------------

  /**
   * Get the full status of the flow system.
   */
  status(): FlowsStatus {
    const servers = this.coordinator.getStatus();
    const connectedIds = servers.filter((s) => s.connected).map((s) => s.id);

    return {
      booted: this.booted,
      connectedServers: servers.filter((s) => s.connected).length,
      totalServers: servers.length,
      totalTools: this.coordinator.getAllTools().length,
      servers,
      availableTemplates: listTemplates().length,
      availableRecipes: getAvailableRecipes(connectedIds).length,
    };
  }

  /**
   * List all available templates.
   */
  availableTemplates(): ReturnType<typeof listTemplates> {
    return listTemplates();
  }

  /**
   * Search templates by query, category, or required MCP.
   */
  findTemplates(opts: {
    query?: string;
    category?: TemplateCategory;
    requiredMCP?: string;
  }): ReturnType<typeof searchTemplates> {
    return searchTemplates(opts);
  }

  /**
   * List all available recipes (optionally filtered to connected MCPs only).
   */
  availableRecipes(connectedOnly = false): ReturnType<typeof listRecipes> {
    if (!connectedOnly) return listRecipes();

    const connectedIds = this.coordinator
      .getStatus()
      .filter((s) => s.connected)
      .map((s) => s.id);

    const available = getAvailableRecipes(connectedIds);
    return available.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category,
      callCount: r.calls.length,
      requiredMCPs: r.requiredMCPs,
    }));
  }

  /**
   * Search recipes by query, category, or required MCP.
   */
  findRecipes(opts: {
    query?: string;
    category?: RecipeCategory;
    requiredMCP?: string;
  }): Recipe[] {
    return searchRecipes(opts);
  }

  /**
   * Get recipes organized by category.
   */
  recipesByCategory(): Record<RecipeCategory, Recipe[]> {
    return getRecipesByCategory();
  }

  /**
   * Get the global tool index — every tool across every connected MCP.
   */
  toolIndex(): Map<string, string[]> {
    return this.coordinator.getToolIndex();
  }

  /**
   * List all tools across all connected MCPs.
   */
  allTools(): Array<{ serverId: string; name: string; description: string }> {
    return this.coordinator.getAllTools();
  }

  /**
   * List tools from a specific MCP server.
   */
  serverTools(serverId: string): Array<{ name: string; description: string }> {
    return this.coordinator.getServerTools(serverId);
  }

  // --------------------------------------------------------------------------
  // Template Execution
  // --------------------------------------------------------------------------

  /**
   * Apply a build template — scaffold an entire project archetype.
   *
   * @param templateId - One of the 11 template IDs (e.g. "saas-fullstack")
   * @param params - Template parameters (projectName required, rest optional)
   * @returns TemplateResult with the full flow execution result
   */
  async applyTemplate(templateId: string, params: TemplateParams): Promise<TemplateResult> {
    this.ensureBooted();

    const template = getTemplate(templateId, params);
    if (!template) {
      throw new Error(`Unknown template: ${templateId}. Available: ${listTemplates().map((t) => t.id).join(", ")}`);
    }

    // Check that required MCPs are connected
    const connectedIds = this.coordinator
      .getStatus()
      .filter((s) => s.connected)
      .map((s) => s.id);

    const missing = template.requiredMCPs.filter((id) => !connectedIds.includes(id));
    if (missing.length > 0) {
      throw new Error(
        `Template "${templateId}" requires MCPs that are not connected: ${missing.join(", ")}`
      );
    }

    this.emit("template-start", templateId, template.name, template.flow.steps.length);

    const flowResult = await this.coordinator.executeFlow(template.flow);

    this.emit("template-done", templateId, template.name, flowResult.success, flowResult.totalDurationMs);

    return {
      templateId: template.id,
      templateName: template.name,
      flow: flowResult,
    };
  }

  // --------------------------------------------------------------------------
  // Recipe Execution
  // --------------------------------------------------------------------------

  /**
   * Run a recipe — execute a pre-built sequence of tool calls.
   *
   * @param recipeId - One of the 28 recipe IDs (e.g. "new-api-endpoint")
   * @param overrides - Optional argument overrides for specific tool calls.
   *                    Keys are tool names, values are partial args to merge.
   * @returns RecipeResult with the full flow execution result
   */
  async runRecipe(
    recipeId: string,
    overrides?: Record<string, Record<string, unknown>>
  ): Promise<RecipeResult> {
    this.ensureBooted();

    const recipe = getRecipe(recipeId);
    if (!recipe) {
      throw new Error(`Unknown recipe: ${recipeId}. Available: ${listRecipes().map((r) => r.id).join(", ")}`);
    }

    // Check that required MCPs are connected
    const connectedIds = this.coordinator
      .getStatus()
      .filter((s) => s.connected)
      .map((s) => s.id);

    const missing = recipe.requiredMCPs.filter((id) => !connectedIds.includes(id));
    if (missing.length > 0) {
      throw new Error(
        `Recipe "${recipeId}" requires MCPs that are not connected: ${missing.join(", ")}`
      );
    }

    // Apply overrides to the recipe calls
    let calls = recipe.calls;
    if (overrides) {
      calls = calls.map((call) => {
        const override = overrides[call.tool];
        if (override) {
          return { ...call, args: { ...call.args, ...override } };
        }
        return call;
      });
    }

    // Convert recipe calls to a flow
    const recipeWithOverrides: Recipe = { ...recipe, calls };
    const steps = recipeToFlowSteps(recipeWithOverrides);
    const flow: Flow = {
      id: `recipe-${recipeId}`,
      name: recipe.name,
      description: recipe.description,
      steps,
    };

    this.emit("recipe-start", recipeId, recipe.name, calls.length);

    const flowResult = await this.coordinator.executeFlow(flow);

    this.emit("recipe-done", recipeId, recipe.name, flowResult.success, flowResult.totalDurationMs);

    return {
      recipeId: recipe.id,
      recipeName: recipe.name,
      flow: flowResult,
    };
  }

  // --------------------------------------------------------------------------
  // Direct Tool Calls
  // --------------------------------------------------------------------------

  /**
   * Call a specific tool on a specific MCP server.
   */
  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown> = {}
  ): Promise<ToolCallResult> {
    this.ensureBooted();
    return this.coordinator.callTool(serverId, toolName, args);
  }

  /**
   * Auto-route a tool call — the coordinator finds which MCP exposes it.
   */
  async autoCall(
    toolName: string,
    args: Record<string, unknown> = {}
  ): Promise<ToolCallResult> {
    this.ensureBooted();
    return this.coordinator.autoCallTool(toolName, args);
  }

  /**
   * Execute a custom flow definition.
   */
  async executeFlow(flow: Flow): Promise<FlowResult> {
    this.ensureBooted();
    return this.coordinator.executeFlow(flow);
  }

  // --------------------------------------------------------------------------
  // Quick Build — Natural Language Template Selection
  // --------------------------------------------------------------------------

  /**
   * Given a natural-language project description, score all templates
   * and return the best match. Does NOT execute the template — call
   * `applyTemplate()` with the returned templateId to do that.
   *
   * @param description - e.g. "I want to build a SaaS app for managing invoices"
   * @returns Ranked matches with scores and reasons
   */
  quickBuild(description: string): QuickBuildMatch[] {
    const descLower = description.toLowerCase();
    const scores: QuickBuildMatch[] = [];

    for (const [templateId, keywords] of Object.entries(TEMPLATE_KEYWORDS)) {
      let score = 0;
      const matchedKeywords: string[] = [];

      for (const { keyword, weight } of keywords) {
        if (descLower.includes(keyword)) {
          score += weight;
          matchedKeywords.push(keyword);
        }
      }

      if (score > 0) {
        const templates = listTemplates();
        const tmpl = templates.find((t) => t.id === templateId);
        scores.push({
          templateId,
          templateName: tmpl?.name ?? templateId,
          score,
          reason: `Matched keywords: ${matchedKeywords.join(", ")}`,
        });
      }
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // If nothing matched, return a default suggestion
    if (scores.length === 0) {
      scores.push({
        templateId: "saas-fullstack",
        templateName: "Full-Stack SaaS Application",
        score: 0,
        reason: "Default suggestion — no keywords matched. Try being more specific.",
      });
    }

    return scores;
  }

  /**
   * Convenience: auto-select the best template and apply it in one call.
   *
   * @param description - Natural-language project description
   * @param params - Template params (projectName required)
   * @returns The QuickBuildMatch that was selected, plus the TemplateResult
   */
  async quickBuildAndApply(
    description: string,
    params: TemplateParams
  ): Promise<{ match: QuickBuildMatch; result: TemplateResult }> {
    const matches = this.quickBuild(description);
    const best = matches[0];

    this.emit("quick-build", best.templateId, best.templateName, best.score, best.reason);

    const result = await this.applyTemplate(best.templateId, {
      ...params,
      description,
    });

    return { match: best, result };
  }

  // --------------------------------------------------------------------------
  // Batch Operations
  // --------------------------------------------------------------------------

  /**
   * Run multiple recipes in parallel.
   *
   * @param recipeIds - Array of recipe IDs to run
   * @returns Map of recipe ID → RecipeResult
   */
  async runRecipesBatch(
    recipeIds: string[]
  ): Promise<Map<string, RecipeResult | Error>> {
    this.ensureBooted();

    const results = new Map<string, RecipeResult | Error>();

    const promises = recipeIds.map(async (id) => {
      try {
        const result = await this.runRecipe(id);
        results.set(id, result);
      } catch (err) {
        results.set(id, err as Error);
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Call multiple tools across different MCPs in parallel.
   *
   * @param calls - Array of { serverId, tool, args } objects
   * @returns Array of ToolCallResults in the same order
   */
  async callToolsBatch(
    calls: Array<{ serverId: string; tool: string; args?: Record<string, unknown> }>
  ): Promise<ToolCallResult[]> {
    this.ensureBooted();

    const promises = calls.map((c) =>
      this.coordinator.callTool(c.serverId, c.tool, c.args ?? {})
    );

    return Promise.all(promises);
  }

  // --------------------------------------------------------------------------
  // Private
  // --------------------------------------------------------------------------

  private ensureBooted(): void {
    if (!this.booted) {
      throw new Error(
        "MegacodeFlows not booted. Call await flows.boot() first."
      );
    }
  }
}

// ============================================================================
// Convenience: Module-Level Factory
// ============================================================================

let _instance: MegacodeFlows | null = null;
let _instanceRootDir: string | undefined;

/**
 * Get or create the singleton MegacodeFlows instance.
 * If a different rootDir is requested and an instance already exists,
 * the existing instance is shut down and replaced.
 */
export function getMegacodeFlows(rootDir?: string): MegacodeFlows {
  if (_instance) {
    if (rootDir !== undefined && rootDir !== _instanceRootDir) {
      // Different root requested — shut down old instance and create new one
      _instance.shutdown();
      _instance = new MegacodeFlows(rootDir);
      _instanceRootDir = rootDir;
    }
    return _instance;
  }
  _instance = new MegacodeFlows(rootDir);
  _instanceRootDir = rootDir;
  return _instance;
}

/**
 * Boot the singleton instance and return it.
 */
export async function bootMegacodeFlows(
  rootDir?: string,
  options?: BootOptions
): Promise<MegacodeFlows> {
  const flows = getMegacodeFlows(rootDir);
  if (!flows.isBooted) {
    await flows.boot(options);
  }
  return flows;
}

// Re-export types and functions from sub-modules for convenience
export type {
  BuildTemplate,
  TemplateParams,
  TemplateCategory,
} from "./build-templates";
export type {
  Recipe,
  RecipeCategory,
} from "./tool-recipes";
export type {
  MCPServerConfig,
  Flow,
  FlowStep,
  FlowResult,
  FlowContext,
  ToolCall,
  ToolCallResult,
} from "./mcp-flow-coordinator";
export {
  listTemplates,
  searchTemplates,
  getTemplate,
} from "./build-templates";
export {
  listRecipes,
  searchRecipes,
  getRecipe,
  getRecipesByCategory,
  getAvailableRecipes,
  recipeToFlowSteps,
} from "./tool-recipes";
