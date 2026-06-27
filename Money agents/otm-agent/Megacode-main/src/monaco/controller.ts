/**
 * Monaco IDE Controller - Orchestrates all Monaco IDE integrations.
 *
 * This is the main entry point that combines:
 * - Monaco Editor integration
 * - MCP tool execution
 * - Web research
 * - LLM-powered assistance
 * - CLI interface
 */

import { EventEmitter } from "events";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import {
  MonacoIDE,
  MonacoIDEConfig,
  IDETool,
  ResearchResult,
  MCPServerConfig,
  WebSearchResult,
  EditorState,
} from "./ide-integration";
import { MonacoCLI, CLIConfig, runCLI } from "./cli";

export {
  MonacoIDE,
  MonacoIDEConfig,
  MonacoCLI,
  CLIConfig,
  runCLI,
  IDETool,
  ResearchResult,
  MCPServerConfig,
  WebSearchResult,
  EditorState,
};

/**
 * Unified controller configuration.
 */
export interface MegacodeControllerConfig {
  /** Monaco IDE configuration */
  monaco?: Partial<MonacoIDEConfig>;
  /** CLI configuration */
  cli?: Partial<CLIConfig>;
  /** Enable LLM assistance */
  llm?: {
    provider: string;
    model?: string;
    apiKey?: string;
  };
  /** System prompt for LLM */
  systemPrompt?: string;
  /** Auto-research on errors */
  autoResearch?: boolean;
  /** Auto-connect to IDE */
  autoConnect?: boolean;
}

/** Default API keys - must be set via environment variables */
export const DEFAULT_API_KEYS = {
  deepseek: process.env.DEEPSEEK_API_KEY || "",
  deepseekAlt: process.env.DEEPSEEK_API_KEY || "",
  ollama: process.env.OLLAMA_API_KEY || "",
  mistral: process.env.MISTRAL_API_KEY || "",
  openai: process.env.OPENAI_API_KEY || "",
};

/**
 * An action the controller can take.
 */
export interface ControllerAction {
  type: "tool" | "edit" | "search" | "research" | "ask";
  payload: unknown;
  description: string;
}

/**
 * Unified controller that orchestrates all integrations.
 */
export class MegacodeController extends EventEmitter {
  private ide: MonacoIDE;
  private cli: MonacoCLI | null = null;
  private config: MegacodeControllerConfig;
  private llmProvider: string | null = null;
  private llmApiKey: string | null = null;
  private llmModel: string = "gpt-4";
  private running: boolean = false;

  constructor(config: MegacodeControllerConfig = {}) {
    super();
    this.config = config;
    this.ide = new MonacoIDE(config.monaco ?? {});

    if (config.llm) {
      this.llmProvider = config.llm.provider;
      this.llmApiKey = config.llm.apiKey ?? null;
      this.llmModel = config.llm.model ?? "gpt-4";
    }
  }

  /**
   * Initialize the controller.
   */
  async initialize(): Promise<void> {
    // Load config from .megacode.json if exists
    const configPath = join(process.cwd(), ".megacode.json");
    if (existsSync(configPath)) {
      try {
        const fileConfig = JSON.parse(readFileSync(configPath, "utf-8"));

        if (fileConfig.mcpServers) {
          for (const server of fileConfig.mcpServers) {
            this.ide.addMCPServer(server);
          }
        }

        if (fileConfig.llm) {
          this.llmProvider = fileConfig.llm.provider ?? this.llmProvider;
          this.llmApiKey = fileConfig.llm.apiKey ?? this.llmApiKey;
          this.llmModel = fileConfig.llm.model ?? this.llmModel;
        }
      } catch {
        // Ignore config errors
      }
    }

    // Load MCP servers from .mcp.json if exists (takes priority / merges)
    const mcpPath = join(process.cwd(), ".mcp.json");
    if (existsSync(mcpPath)) {
      try {
        const mcpConfig = JSON.parse(readFileSync(mcpPath, "utf-8"));
        if (mcpConfig.mcpServers && mcpConfig.mcpServers.length > 0) {
          for (const server of mcpConfig.mcpServers) {
            this.ide.addMCPServer(server);
          }
        }
      } catch {
        // Ignore
      }
    }

    // Connect to IDE (may fail if no IDE process running — that's OK)
    try {
      await this.ide.connect();
    } catch {
      // IDE not running, but MCP servers and built-in tools still work
    }

    // Discover tools (includes MCP tool discovery)
    await this.ide.discoverTools();

    this.emit("initialized");
  }

  /**
   * Get the Monaco IDE instance.
   */
  getIDE(): MonacoIDE {
    return this.ide;
  }

  /**
   * Get available tools.
   */
  getTools(): IDETool[] {
    return this.ide.getTools();
  }

  /**
   * Execute a tool by name.
   */
  async executeTool(toolId: string, params?: unknown): Promise<unknown> {
    return this.ide.executeTool({ toolId, params });
  }

  /**
   * Search the web.
   */
  async searchWeb(query: string): Promise<WebSearchResult[]> {
    return this.ide.webSearch(query);
  }

  /**
   * Research a topic.
   */
  async research(query: string): Promise<ResearchResult> {
    return this.ide.research(query);
  }

  /**
   * Get current editor state.
   */
  async getEditorState(): Promise<EditorState> {
    return this.ide.getEditorState();
  }

  /**
   * Analyze current context and suggest next action.
   */
  async analyzeContext(): Promise<{
    currentFile: string | null;
    language: string | null;
    selection: string | null;
    context: string;
    suggestions: string[];
  }> {
    const state = await this.ide.getEditorState();

    const analysis: {
      currentFile: string | null;
      language: string | null;
      selection: string | null;
      context: string;
      suggestions: string[];
    } = {
      currentFile: state.filePath,
      language: state.language,
      selection: state.selectedText || null,
      context: "",
      suggestions: [],
    };

    // Build context
    if (state.filePath) {
      analysis.context = `Working on ${state.filePath} (${state.language || "unknown"})\n`;

      if (state.selectedText) {
        analysis.context += `\nSelected:\n${state.selectedText.substring(0, 500)}\n`;
      }
    }

    // Suggest tools based on context
    const tools = this.ide.getTools();

    if (state.selectedText && state.selectedText.includes("TODO")) {
      analysis.suggestions.push("editor.quickFix", "tools search:fix TODO");
    }

    return analysis;
  }

  /**
   * Get API key for a specific provider.
   */
  getAPIKey(provider: keyof typeof DEFAULT_API_KEYS): string {
    return DEFAULT_API_KEYS[provider];
  }

  /**
   * Get all available API keys (with keys redacted for display).
   */
  getAPIKeyStatus(): Record<string, { available: boolean; key: string }> {
    return {
      deepseek: {
        available: !!DEFAULT_API_KEYS.deepseek,
        key: DEFAULT_API_KEYS.deepseek
          ? DEFAULT_API_KEYS.deepseek.substring(0, 8) + "..."
          : "",
      },
      ollama: {
        available: !!DEFAULT_API_KEYS.ollama,
        key: DEFAULT_API_KEYS.ollama
          ? DEFAULT_API_KEYS.ollama.substring(0, 8) + "..."
          : "",
      },
      mistral: {
        available: !!DEFAULT_API_KEYS.mistral,
        key: DEFAULT_API_KEYS.mistral
          ? DEFAULT_API_KEYS.mistral.substring(0, 8) + "..."
          : "",
      },
      openai: {
        available: !!DEFAULT_API_KEYS.openai,
        key: DEFAULT_API_KEYS.openai
          ? DEFAULT_API_KEYS.openai.substring(0, 8) + "..."
          : "",
      },
    };
  }

  /**
   * Process natural language request and execute appropriate actions.
   */
  async processRequest(request: string): Promise<{
    actions: ControllerAction[];
    result?: unknown;
    error?: string;
  }> {
    const actions: ControllerAction[] = [];

    // Analyze the request
    const lowerRequest = request.toLowerCase();

    // Search requests
    if (
      lowerRequest.includes("search") ||
      lowerRequest.includes("look up") ||
      lowerRequest.includes("how to")
    ) {
      const query = request.replace(/.*(?:search|look up|how to)\s+/i, "");
      actions.push({
        type: "search",
        payload: { query },
        description: `Search for: ${query}`,
      });
    }

    // Research requests
    if (lowerRequest.includes("research") || lowerRequest.includes("explain")) {
      const topic = request.replace(/.*(?:research|explain)\s+(me\s+)?/i, "");
      actions.push({
        type: "research",
        payload: { topic },
        description: `Research: ${topic}`,
      });
    }

    // Tool execution requests
    const toolPatterns = [
      { pattern: /run (.*)/i, toolId: "exec" },
      { pattern: /execute (.*)/i, toolId: "exec" },
      { pattern: /format/i, toolId: "editor.formatDocument" },
      { pattern: /save/i, toolId: "editor.save" },
      { pattern: /goto line (\d+)/i, toolId: "editor.gotoLine" },
    ];

    for (const { pattern, toolId } of toolPatterns) {
      const match = request.match(pattern);
      if (match) {
        actions.push({
          type: "tool",
          payload: { toolId, params: match[1] },
          description: `Execute: ${toolId}`,
        });
      }
    }

    // Execute actions
    let lastResult: unknown;

    for (const action of actions) {
      try {
        switch (action.type) {
          case "search": {
            const { query } = action.payload as { query: string };
            lastResult = await this.ide.webSearch(query);
            break;
          }

          case "research": {
            const { topic } = action.payload as { topic: string };
            lastResult = await this.ide.research(topic);
            break;
          }

          case "tool": {
            const { toolId, params } = action.payload as {
              toolId: string;
              params?: unknown;
            };
            lastResult = await this.ide.executeTool({ toolId, params });
            break;
          }
        }
      } catch (err) {
        return {
          actions,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    return { actions, result: lastResult };
  }

  /**
   * Handle an error by auto-researching a solution.
   */
  async handleError(error: Error | string): Promise<ResearchResult | null> {
    if (!this.config.autoResearch) return null;

    const errorMessage = typeof error === "string" ? error : error.message;

    // Extract key terms from error
    const terms = errorMessage
      .split(/[\s,]+/)
      .filter((t) => t.length > 3)
      .slice(0, 5)
      .join(" ");

    console.log(`[Megacode] Auto-researching error: ${terms}`);

    try {
      const result = await this.ide.research(`fix ${terms} error`);
      return result;
    } catch {
      return null;
    }
  }

  /**
   * Start the interactive CLI.
   */
  async startCLI(): Promise<void> {
    const cli = new MonacoCLI({
      monaco: this.config.monaco,
      autoConnect: this.config.cli?.autoConnect ?? true,
    });

    this.cli = cli;
    await cli.start();
  }

  /**
   * Get MCP server status.
   */
  getMCPServerStatus(): Array<{
    id: string;
    name: string;
    connected: boolean;
  }> {
    return this.ide.getMCPServerStatus();
  }

  /**
   * Add an MCP server.
   */
  addMCPServer(config: MCPServerConfig): void {
    this.ide.addMCPServer(config);
  }

  /**
   * Remove an MCP server.
   */
  removeMCPServer(serverId: string): void {
    this.ide.removeMCPServer(serverId);
  }

  /**
   * Save configuration to file.
   */
  saveConfig(path?: string): void {
    const configPath = path ?? join(process.cwd(), ".megacode.json");

    const config = {
      mcpServers: this.ide.getMCPServerStatus().map((s) => ({
        id: s.id,
        name: s.name,
        enabled: true,
      })),
      llm: this.llmProvider
        ? {
            provider: this.llmProvider,
            model: this.llmModel,
          }
        : undefined,
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  /**
   * Disconnect and cleanup.
   */
  disconnect(): void {
    this.ide.disconnect();
    this.cli?.stop();
    this.running = false;
  }

  /**
   * Check if running.
   */
  isRunning(): boolean {
    return this.running;
  }
}

/**
 * Create a controller from config file or defaults.
 */
export async function createController(
  config?: MegacodeControllerConfig,
): Promise<MegacodeController> {
  const controller = new MegacodeController(config);
  await controller.initialize();
  return controller;
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Start interactive CLI
    await runCLI([]);
  } else if (args[0] === "cli") {
    // CLI mode
    await runCLI(args.slice(1));
  } else if (args[0] === "connect") {
    // Connect and discover tools
    const controller = new MegacodeController({ autoConnect: true });
    await controller.initialize();

    console.log("Connected! Tools discovered.");
    console.log(`Run 'megacode cli' for interactive mode.`);

    controller.disconnect();
  } else if (args[0] === "exec") {
    // Execute a tool
    const toolId = args[1];
    const params = args[2] ? JSON.parse(args[2]) : undefined;

    const controller = new MegacodeController();
    await controller.initialize();

    const result = await controller.executeTool(toolId, params);
    console.log(JSON.stringify(result, null, 2));

    controller.disconnect();
  } else if (args[0] === "research") {
    // Research a topic
    const query = args.slice(1).join(" ");

    const controller = new MegacodeController();
    const result = await controller.research(query);

    console.log(JSON.stringify(result, null, 2));

    controller.disconnect();
  } else if (args[0] === "serve") {
    // HTTP server mode (future)
    console.log("HTTP server mode not yet implemented");
  } else {
    console.log(`
Megacode - Monaco IDE Controller

Usage:
  megacode                 Start interactive CLI
  megacode cli             Start interactive CLI
  megacode connect         Connect to IDE and discover tools
  megacode exec <tool>    Execute a tool
  megacode research <query> Research a topic

Environment:
  EXA_API_KEY              For web search (optional)
  OPENAI_API_KEY          For LLM assistance (optional)

Configuration:
  .megacode.json          Configuration file in project root
  .mcp.json               MCP server configurations
`);
  }
}

// Export main for programmatic use
export { main };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
