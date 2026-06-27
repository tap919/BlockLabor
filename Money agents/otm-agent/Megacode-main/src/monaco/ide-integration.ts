/**
 * Monaco Editor Integration for OverCoat.
 *
 * Provides deep integration with Monaco-based editors (VS Code, Cursor, Zed, custom Monaco apps).
 * This module enables:
 *
 * 1. Monaco Editor Control
 *    - Read/write editor content, selections, cursor position
 *    - Register command handlers, keybindings
 *    - IntelliSense trigger and completion handling
 *    - Multi-cursor and selection management
 *
 * 2. MCP (Model Context Protocol) Client
 *    - Connect to MCP servers (stdio, SSE, HTTP, WebSocket)
 *    - Discover and execute tools from MCP servers
 *    - Tool result caching and history
 *
 * 3. Web Research
 *    - Search the web for documentation, solutions
 *    - Fetch and parse web pages
 *    - Extract code examples and API references
 *
 * 4. IDE Tool Discovery
 *    - Auto-detect IDE capabilities
 *    - Register custom commands
 *    - Build tool registry from IDE + MCP
 *
 * 5. CLI Interface
 *    - Interactive REPL mode
 *    - Command execution
 *    - File editing workflow
 */

import { EventEmitter } from "events";
import { spawn, ChildProcess, execSync } from "child_process";
import { randomUUID } from "crypto";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
} from "fs";
import { join, dirname, basename, extname } from "path";
import * as https from "https";
import * as http from "http";
import {
  validateInput,
  sanitizeInput,
  sanitizeObject,
  withRetry,
  Cache,
  SecureConfig,
  HealthMonitor,
  LazyLoader,
  ConnectionPool,
  createConfigProfile,
  debounce,
  throttle,
  ValidationSchema,
  RetryOptions,
  ConnectionPoolConfig,
  ValidationError,
} from "./utils";

export {};

/**
 * Configuration for Monaco IDE integration.
 */
export interface MonacoIDEConfig {
  /** Connection type to the IDE */
  connectionType: "stdio" | "sse" | "websocket" | "http";
  /** Command to spawn for stdio connection (e.g., path to IDE's CLI) */
  command?: string;
  /** Args for the command */
  args?: string[];
  /** URL for SSE/WebSocket/HTTP connections */
  url?: string;
  /** Environment variables for subprocess */
  env?: Record<string, string>;
  /** Port for stdio server (default: 9876) */
  port?: number;
  /** Enable web research (default: true) */
  webResearch?: boolean;
  /** MCP server configurations */
  mcpServers?: MCPServerConfig[];
  /** Auto-discover IDE tools on connect */
  autoDiscoverTools?: boolean;
  /** Log level */
  logLevel?: "debug" | "info" | "warn" | "error";
  /** Environment profile (development, production, test) */
  envProfile?: "development" | "production" | "test";
  /** Connection timeout in ms */
  connectionTimeout?: number;
  /** Retry attempts for failed connections */
  retryAttempts?: number;
  /** Enable tool caching */
  toolCacheEnabled?: boolean;
  /** Tool cache TTL in ms */
  toolCacheTtlMs?: number;
  /** Enable connection pooling */
  connectionPoolEnabled?: boolean;
  /** Minimum connections in pool */
  poolMinConnections?: number;
  /** Maximum connections in pool */
  poolMaxConnections?: number;
  /** Health check interval in ms */
  healthCheckIntervalMs?: number;
  /** Enable secure API key management */
  secureApiKeys?: boolean;
  /** Encryption key for API keys */
  encryptionKey?: string;
}

/**
 * MCP Server configuration.
 */
export interface MCPServerConfig {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Connection type */
  type: "stdio" | "sse" | "http" | "websocket";
  /** Command (for stdio type) */
  command?: string;
  /** Arguments (for stdio type) */
  args?: string[];
  /** URL (for HTTP/SSE/WS types) */
  url?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Whether server is enabled */
  enabled?: boolean;
}

/**
 * An MCP tool exposed by a server.
 */
export interface MCPTool {
  /** Tool name (fully qualified: serverId/toolName) */
  name: string;
  /** Server that provides this tool */
  serverId: string;
  /** Tool description */
  description?: string;
  /** Input schema */
  inputSchema: Record<string, unknown>;
}

/**
 * Result from calling an MCP tool.
 */
export interface MCToolResult {
  tool: string;
  success: boolean;
  result?: unknown;
  error?: string;
  durationMs: number;
}

/**
 * A discovered IDE tool/command.
 */
export interface IDETool {
  /** Tool identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description?: string;
  /** Category (edit, navigation, terminal, etc.) */
  category:
    | "edit"
    | "navigation"
    | "terminal"
    | "search"
    | "refactor"
    | "debug"
    | "custom";
  /** Parameters schema */
  parameters?: Record<string, unknown>;
  /** Source (ide, mcp, custom) */
  source: "ide" | "mcp" | "custom";
  /** Handler function */
  handler?: (params?: unknown) => Promise<unknown>;
}

/**
 * Web search result.
 */
export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  score?: number;
}

/**
 * Research result with extracted content.
 */
export interface ResearchResult {
  query: string;
  results: WebSearchResult[];
  sources: Array<{
    url: string;
    content: string;
    codeExamples?: string[];
  }>;
  timestamp: number;
}

/**
 * Editor state snapshot.
 */
export interface EditorState {
  /** Current file path */
  filePath: string | null;
  /** Current language */
  language: string | null;
  /** Cursor position (line, column) */
  cursor: { line: number; column: number };
  /** Selection range */
  selection: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  } | null;
  /** Selected text */
  selectedText: string;
  /** Full document content */
  content: string;
  /** Open tabs/files */
  openFiles: string[];
  /** Modified (unsaved) files */
  modifiedFiles: string[];
}

/**
 * Monaco protocol message.
 */
export interface MonacoMessage {
  id: string;
  method: string;
  params?: unknown;
  result?: unknown;
  error?: string;
}

/**
 * Monaco protocol request handler.
 */
export type MonacoRequestHandler = (
  method: string,
  params?: unknown,
) => Promise<unknown>;

const DEFAULT_CONFIG: MonacoIDEConfig = {
  connectionType: "stdio",
  port: 9876,
  webResearch: true,
  autoDiscoverTools: true,
  logLevel: "info",
  envProfile: "development",
  connectionTimeout: 30000,
  retryAttempts: 3,
  toolCacheEnabled: true,
  toolCacheTtlMs: 60000,
  connectionPoolEnabled: false,
  poolMinConnections: 1,
  poolMaxConnections: 5,
  healthCheckIntervalMs: 30000,
  secureApiKeys: false,
};

const CONFIG_VALIDATION_SCHEMA: ValidationSchema = {
  connectionType: [
    { type: "enum", value: ["stdio", "sse", "websocket", "http"] },
  ],
  port: [{ type: "range", value: { min: 1, max: 65535 } }],
  logLevel: [{ type: "enum", value: ["debug", "info", "warn", "error"] }],
  envProfile: [{ type: "enum", value: ["development", "production", "test"] }],
  connectionTimeout: [{ type: "range", value: { min: 1000, max: 300000 } }],
  retryAttempts: [{ type: "range", value: { min: 1, max: 10 } }],
  toolCacheTtlMs: [{ type: "range", value: { min: 1000, max: 3600000 } }],
  poolMinConnections: [{ type: "range", value: { min: 1, max: 100 } }],
  poolMaxConnections: [{ type: "range", value: { min: 1, max: 100 } }],
};

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "ECONNRESET"],
};

const DEFAULT_POOL_CONFIG: ConnectionPoolConfig = {
  minConnections: 1,
  maxConnections: 5,
  acquireTimeoutMs: 30000,
  idleTimeoutMs: 60000,
  healthCheckIntervalMs: 30000,
};

/**
 * MonacoIDE provides deep integration with Monaco-based editors.
 */
export class MonacoIDE extends EventEmitter {
  private config: MonacoIDEConfig;
  private process: ChildProcess | null = null;
  private connected: boolean = false;
  private pendingRequests: Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  > = new Map();
  private tools: Map<string, IDETool> = new Map();
  private mcpTools: Map<string, MCPTool> = new Map();
  private mcpServers: Map<string, MCPServerConfig> = new Map();
  private mcpProcesses: Map<string, ChildProcess> = new Map();
  private logLevel: number = 1;
  private toolCache: Cache<unknown>;
  private healthMonitor: HealthMonitor;
  private secureConfig: SecureConfig | null = null;
  private connectionPool: ConnectionPool | null = null;
  private lazyModules: Map<string, LazyLoader<unknown>> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private debouncedDiscoverTools: (() => void) & { cancel: () => void };

  constructor(config: Partial<MonacoIDEConfig> = {}) {
    super();

    const profile = createConfigProfile(
      {},
      config.envProfile ?? process.env.NODE_ENV ?? "development",
    );
    const mergedConfig = { ...DEFAULT_CONFIG, ...profile, ...config };

    try {
      validateInput(mergedConfig, CONFIG_VALIDATION_SCHEMA);
    } catch (error) {
      if (error instanceof ValidationError) {
        this.log("warn", `Config validation warning: ${error.message}`);
      }
    }

    this.config = mergedConfig as MonacoIDEConfig;
    this.logLevel = LOG_LEVELS[this.config.logLevel ?? "info"];

    this.toolCache = new Cache(this.config.toolCacheTtlMs ?? 60000);
    this.healthMonitor = new HealthMonitor(
      this.config.retryAttempts ?? 3,
      Math.floor((this.config.retryAttempts ?? 3) / 2),
    );

    if (this.config.secureApiKeys && this.config.encryptionKey) {
      this.secureConfig = new SecureConfig(this.config.encryptionKey);
    }

    if (config.mcpServers) {
      for (const server of config.mcpServers) {
        this.mcpServers.set(server.id, server);
      }
    }

    this.debouncedDiscoverTools = debounce(() => {
      this.discoverTools().catch((err) =>
        this.log("error", "Tool discovery failed:", err),
      );
    }, 5000) as typeof this.debouncedDiscoverTools;
  }

  private log(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    ...args: unknown[]
  ): void {
    if (LOG_LEVELS[level] >= this.logLevel) {
      console[level](`[MonacoIDE] ${message}`, ...args);
    }
  }

  /**
   * Connect to the Monaco IDE.
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    if (!this.healthMonitor.isHealthy()) {
      this.log("warn", "Connection unhealthy, attempting to recover...");
    }

    const retryOptions: RetryOptions = {
      ...DEFAULT_RETRY_OPTIONS,
      maxAttempts: this.config.retryAttempts ?? 3,
    };

    try {
      await withRetry(async () => {
        const startTime = Date.now();

        this.log("info", "Connecting to Monaco IDE...");

        switch (this.config.connectionType) {
          case "stdio":
            await this.connectStdio();
            break;
          case "sse":
          case "http":
            await this.connectHttp();
            break;
          case "websocket":
            await this.connectWebSocket();
            break;
        }

        const latencyMs = Date.now() - startTime;
        this.healthMonitor.recordSuccess(latencyMs);

        this.connected = true;
        this.emit("connected");
        this.log("info", `Connected to Monaco IDE (latency: ${latencyMs}ms)`);

        this.startHealthCheck();
      }, retryOptions);

      if (this.config.autoDiscoverTools) {
        await this.discoverTools();
      }
    } catch (error) {
      this.healthMonitor.recordFailure();
      this.log("error", "Failed to connect to Monaco IDE:", error);
      this.emit("connectionError", error);
      throw error;
    }
  }

  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    const intervalMs = this.config.healthCheckIntervalMs ?? 30000;
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.healthCheck();
      } catch (error) {
        this.healthMonitor.recordFailure();
        this.log("warn", "Health check failed:", error);
        this.emit("healthCheckFailed", error);
      }
    }, intervalMs);
  }

  private async healthCheck(): Promise<void> {
    if (!this.connected) {
      throw new Error("Not connected");
    }

    const startTime = Date.now();

    try {
      await this.sendRequest("ping", { timestamp: startTime });
      const latencyMs = Date.now() - startTime;
      this.healthMonitor.recordSuccess(latencyMs);
    } catch (error) {
      this.healthMonitor.recordFailure();
      throw error;
    }
  }

  /**
   * Get connection health status.
   */
  getHealthStatus(): {
    isHealthy: boolean;
    latencyMs?: number;
    consecutiveFailures: number;
  } {
    const status = this.healthMonitor.getStatus();
    return {
      isHealthy: status.isHealthy,
      latencyMs: status.latencyMs,
      consecutiveFailures: status.consecutiveFailures,
    };
  }

  /**
   * Connect via stdio (spawn IDE process).
   */
  private async connectStdio(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.config.command) {
        reject(new Error("Command required for stdio connection"));
        return;
      }

      this.process = spawn(this.config.command, this.config.args ?? [], {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          ...this.config.env,
          MONACO_PORT: String(this.config.port),
        },
      });

      let buffer = "";

      this.process.stdout?.on("data", (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.trim()) {
            this.handleMessage(line);
          }
        }
      });

      this.process.stderr?.on("data", (data: Buffer) => {
        this.log("debug", "IDE stderr:", data.toString());
      });

      this.process.on("error", (err) => {
        this.log("error", "Process error:", err);
        this.emit("error", err);
      });

      this.process.on("exit", (code) => {
        this.connected = false;
        this.emit("disconnected", code);
      });

      // Wait for ready signal
      this.once("ready", () => resolve());

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this.connected) {
          resolve(); // Resolve anyway, will work async
        }
      }, 10000);
    });
  }

  /**
   * Connect via HTTP/SSE.
   */
  private async connectHttp(): Promise<void> {
    // For HTTP connections, we'll use a simple polling mechanism
    this.log("info", `Connecting to HTTP endpoint: ${this.config.url}`);
    // In practice, this would establish SSE connection or HTTP long-polling
  }

  /**
   * Connect via WebSocket.
   */
  private async connectWebSocket(): Promise<void> {
    // WebSocket implementation would go here
    this.log("info", `Connecting to WebSocket: ${this.config.url}`);
  }

  /**
   * Handle incoming message from IDE.
   */
  private handleMessage(data: string): void {
    try {
      const message: MonacoMessage = JSON.parse(data);

      if (message.id && this.pendingRequests.has(message.id)) {
        const { resolve, reject } = this.pendingRequests.get(message.id)!;
        this.pendingRequests.delete(message.id);

        if (message.error) {
          reject(new Error(message.error));
        } else {
          resolve(message.result);
        }
      } else if (message.method) {
        this.handleRequest(message.method, message.params);
      }
    } catch (err) {
      this.log("warn", "Failed to parse message:", data);
    }
  }

  /**
   * Handle incoming request from IDE.
   */
  private async handleRequest(method: string, params?: unknown): Promise<void> {
    this.emit("request", { method, params });

    // Emit specific events for common methods
    if (method === "editor.didChange") {
      this.emit("editorChange", params);
    } else if (method === "editor.didSave") {
      this.emit("fileSave", params);
    } else if (method === "tool.execute") {
      const result = await this.executeTool(
        params as { toolId: string; params?: unknown },
      );
      this.sendResponse({ method: "tool.result", result });
    }
  }

  /**
   * Send a request to the IDE.
   */
  private sendRequest<T = unknown>(
    method: string,
    params?: unknown,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = randomUUID();

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      const message: MonacoMessage = { id, method, params };
      this.sendMessage(message);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  /**
   * Send a message to the IDE.
   */
  private sendMessage(message: MonacoMessage): void {
    const data = JSON.stringify(message) + "\n";

    if (this.process?.stdin) {
      this.process.stdin.write(data);
    }
  }

  /**
   * Send a response to the IDE.
   */
  private sendResponse(message: Partial<MonacoMessage>): void {
    this.sendMessage(message as MonacoMessage);
  }

  /**
   * Get current editor state.
   */
  async getEditorState(): Promise<EditorState> {
    const result = await this.sendRequest<EditorState>("editor.getState");
    return result;
  }

  /**
   * Get current file content.
   */
  async getFileContent(filePath?: string): Promise<string> {
    if (filePath) {
      return readFileSync(filePath, "utf-8");
    }
    const state = await this.getEditorState();
    return state.content;
  }

  /**
   * Get text at a specific range.
   */
  async getTextAt(range: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  }): Promise<string> {
    const state = await this.getEditorState();
    const lines = state.content.split("\n");

    if (range.startLine === range.endLine) {
      return (
        lines[range.startLine - 1]?.substring(
          range.startColumn - 1,
          range.endColumn - 1,
        ) ?? ""
      );
    }

    const text: string[] = [];
    text.push(
      lines[range.startLine - 1]?.substring(range.startColumn - 1) ?? "",
    );

    for (let i = range.startLine; i < range.endLine - 1; i++) {
      text.push(lines[i] ?? "");
    }

    text.push(
      lines[range.endLine - 1]?.substring(0, range.endColumn - 1) ?? "",
    );

    return text.join("\n");
  }

  /**
   * Insert text at cursor or selection.
   */
  async insertText(
    text: string,
    options?: { cursorMove?: "after" | "preserve" },
  ): Promise<void> {
    await this.sendRequest("editor.insert", {
      text,
      cursorMove: options?.cursorMove ?? "after",
    });
  }

  /**
   * Replace text in a range.
   */
  async replaceText(
    range: {
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
    },
    text: string,
  ): Promise<void> {
    await this.sendRequest("editor.replace", { range, text });
  }

  /**
   * Execute an editor command.
   */
  async executeCommand(
    commandId: string,
    ...args: unknown[]
  ): Promise<unknown> {
    return this.sendRequest("editor.executeCommand", { commandId, args });
  }

  /**
   * Open a file.
   */
  async openFile(filePath: string): Promise<void> {
    await this.sendRequest("editor.openFile", { filePath });
  }

  /**
   * Save current file.
   */
  async saveFile(filePath?: string): Promise<void> {
    await this.sendRequest("editor.save", { filePath });
  }

  /**
   * Get list of open files.
   */
  async getOpenFiles(): Promise<string[]> {
    const state = await this.getEditorState();
    return state.openFiles;
  }

  /**
   * Discover available IDE tools.
   */
  async discoverTools(): Promise<IDETool[]> {
    this.log("info", "Discovering IDE tools...");

    // Built-in IDE commands
    const builtInTools: IDETool[] = [
      {
        id: "editor.gotoLine",
        name: "Go to Line",
        description: "Jump to a specific line number",
        category: "navigation",
        source: "ide",
      },
      {
        id: "editor.find",
        name: "Find",
        description: "Open find dialog",
        category: "search",
        source: "ide",
      },
      {
        id: "editor.replace",
        name: "Find and Replace",
        description: "Open find and replace dialog",
        category: "edit",
        source: "ide",
      },
      {
        id: "editor.formatDocument",
        name: "Format Document",
        description: "Format the current document",
        category: "edit",
        source: "ide",
      },
      {
        id: "editor.formatSelection",
        name: "Format Selection",
        description: "Format selected text",
        category: "edit",
        source: "ide",
      },
      {
        id: "editor.commentLine",
        name: "Toggle Line Comment",
        description: "Comment or uncomment current line",
        category: "edit",
        source: "ide",
      },
      {
        id: "editor.toggleBlockComment",
        name: "Toggle Block Comment",
        description: "Comment or uncomment selected block",
        category: "edit",
        source: "ide",
      },
      {
        id: "editor.rename",
        name: "Rename Symbol",
        description: "Rename all occurrences of a symbol",
        category: "refactor",
        source: "ide",
      },
      {
        id: "editor.quickFix",
        name: "Quick Fix",
        description: "Show quick fixes and refactorings",
        category: "refactor",
        source: "ide",
      },
      {
        id: "editor.goToDefinition",
        name: "Go to Definition",
        description: "Navigate to symbol definition",
        category: "navigation",
        source: "ide",
      },
      {
        id: "editor.peekDefinition",
        name: "Peek Definition",
        description: "Show definition inline",
        category: "navigation",
        source: "ide",
      },
      {
        id: "editor.goToReferences",
        name: "Go to References",
        description: "Find all references to symbol",
        category: "search",
        source: "ide",
      },
      {
        id: "editor.toggleTerminal",
        name: "Toggle Terminal",
        description: "Show or hide integrated terminal",
        category: "terminal",
        source: "ide",
      },
      {
        id: "editor.newFile",
        name: "New File",
        description: "Create a new file",
        category: "edit",
        source: "ide",
      },
      {
        id: "editor.saveAll",
        name: "Save All",
        description: "Save all open files",
        category: "edit",
        source: "ide",
      },
      {
        id: "workbench.action.nextEditor",
        name: "Next Editor",
        description: "Switch to next open file",
        category: "navigation",
        source: "ide",
      },
      {
        id: "workbench.action.previousEditor",
        name: "Previous Editor",
        description: "Switch to previous open file",
        category: "navigation",
        source: "ide",
      },
      {
        id: "workbench.action.splitEditor",
        name: "Split Editor",
        description: "Split the editor window",
        category: "edit",
        source: "ide",
      },
    ];

    for (const tool of builtInTools) {
      this.tools.set(tool.id, tool);
    }

    // Discover MCP tools
    await this.discoverMCPTools();

    this.log("info", `Discovered ${this.tools.size} tools`);

    return Array.from(this.tools.values());
  }

  /**
   * Get all available tools.
   */
  getTools(): IDETool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category.
   */
  getToolsByCategory(category: IDETool["category"]): IDETool[] {
    return Array.from(this.tools.values()).filter(
      (t) => t.category === category,
    );
  }

  /**
   * Execute an IDE tool by ID.
   */
  async executeTool(request: {
    toolId: string;
    params?: unknown;
  }): Promise<unknown> {
    if (!request.toolId || typeof request.toolId !== "string") {
      throw new ValidationError(
        "toolId is required and must be a string",
        "toolId",
      );
    }

    const sanitizedToolId = sanitizeInput(request.toolId);
    const sanitizedParams = request.params
      ? sanitizeObject(request.params as Record<string, unknown>)
      : undefined;

    const cacheKey = `tool:${sanitizedToolId}:${JSON.stringify(sanitizedParams ?? {})}`;

    if (this.config.toolCacheEnabled && this.toolCache.has(cacheKey)) {
      this.log("debug", `Cache hit for tool: ${sanitizedToolId}`);
      return this.toolCache.get(cacheKey);
    }

    const tool = this.tools.get(sanitizedToolId);

    if (!tool) {
      throw new Error(`Tool not found: ${sanitizedToolId}`);
    }

    const startTime = Date.now();

    try {
      let result: unknown;

      if (tool.handler) {
        result = await tool.handler(sanitizedParams);
      } else {
        result = await this.executeCommand(sanitizedToolId, sanitizedParams);
      }

      const durationMs = Date.now() - startTime;

      if (this.config.toolCacheEnabled && durationMs < 1000) {
        this.toolCache.set(cacheKey, result, this.config.toolCacheTtlMs);
      }

      this.emit("toolExecuted", {
        toolId: sanitizedToolId,
        durationMs,
        success: true,
      });
      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.emit("toolExecuted", {
        toolId: sanitizedToolId,
        durationMs,
        success: false,
        error,
      });
      throw error;
    }
  }

  /**
   * Clear the tool cache.
   */
  clearToolCache(): void {
    this.toolCache.clear();
    this.log("info", "Tool cache cleared");
  }

  /**
   * Get tool cache statistics.
   */
  getToolCacheStats(): { size: number; cleaned: number } {
    const cleaned = this.toolCache.cleanup();
    return { size: this.toolCache.size(), cleaned };
  }

  /**
   * Register a custom tool.
   */
  registerTool(tool: IDETool): void {
    this.tools.set(tool.id, tool);
    this.emit("toolRegistered", tool);
  }

  /**
   * Unregister a tool.
   */
  unregisterTool(toolId: string): boolean {
    const deleted = this.tools.delete(toolId);
    if (deleted) {
      this.emit("toolUnregistered", toolId);
    }
    return deleted;
  }

  // ─────────────────────────────────────────────────────────────────
  // MCP Integration
  // ─────────────────────────────────────────────────────────────────

  /**
   * Discover tools from MCP servers.
   */
  async discoverMCPTools(): Promise<void> {
    for (const [id, config] of this.mcpServers) {
      if (!(config.enabled ?? true)) continue;

      try {
        await this.connectMCPServer(id);
        const tools = await this.listMCPTools(id);

        for (const tool of tools) {
          this.mcpTools.set(tool.name, tool);

          this.tools.set(`mcp.${tool.name}`, {
            id: `mcp.${tool.name}`,
            name: tool.name,
            description: tool.description,
            category: "custom",
            source: "mcp",
            handler: async (params) => this.executeMCPTool(tool.name, params),
          });
        }

        this.log(
          "info",
          `Discovered ${tools.length} tools from MCP server: ${config.name}`,
        );
      } catch (err) {
        this.log(
          "error",
          `Failed to connect to MCP server ${config.name}:`,
          err,
        );
      }
    }
  }

  /**
   * Connect to an MCP server.
   */
  async connectMCPServer(serverId: string): Promise<void> {
    const config = this.mcpServers.get(serverId);
    if (!config) {
      throw new Error(`MCP server not found: ${serverId}`);
    }

    if (this.mcpProcesses.has(serverId)) {
      return; // Already connected
    }

    if (config.type === "stdio" && config.command) {
      const spawnArgs = config.args ?? [];
      // Resolve cwd for the spawn - use config.cwd if provided, otherwise process.cwd()
      const spawnCwd = (config as any).cwd ?? process.cwd();

      const proc = spawn(config.command, spawnArgs, {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ...config.env },
        cwd: spawnCwd,
      });

      proc.on("error", (err) => {
        this.log("error", `MCP server ${serverId} error:`, err);
      });

      proc.on("exit", (code) => {
        this.mcpProcesses.delete(serverId);
        this.log("info", `MCP server ${serverId} exited with code ${code}`);
      });

      this.mcpProcesses.set(serverId, proc);

      // MCP protocol requires an initialize handshake before any other requests
      try {
        await this.sendMCPRequest(serverId, {
          jsonrpc: "2.0",
          id: randomUUID(),
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "megacode", version: "1.0.0" },
          },
        });
        // Send initialized notification (no response expected)
        proc.stdin?.write(
          JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n",
        );
        this.log("info", `MCP server ${serverId} initialized successfully`);
      } catch (initErr) {
        this.log("warn", `MCP server ${serverId} initialize failed:`, initErr);
        // Don't throw — server may still work for tools/list
      }
    }
  }

  /**
   * List tools available from an MCP server.
   */
  async listMCPTools(serverId: string): Promise<MCPTool[]> {
    // Send JSON-RPC request to MCP server
    const request = {
      jsonrpc: "2.0",
      id: randomUUID(),
      method: "tools/list",
      params: {},
    };

    try {
      const response = await this.sendMCPRequest(serverId, request);
      const rawTools = ((response.result as any)?.tools ?? []) as Array<Record<string, unknown>>;
      // Tag each tool with its serverId so executeMCPTool can route correctly
      return rawTools.map((t) => ({ ...t, serverId } as unknown as MCPTool));
    } catch {
      return [];
    }
  }

  /**
   * Execute an MCP tool.
   */
  async executeMCPTool(
    toolName: string,
    params?: unknown,
  ): Promise<MCToolResult> {
    const startTime = Date.now();
    const tool = this.mcpTools.get(toolName);

    if (!tool) {
      return {
        tool: toolName,
        success: false,
        error: `Tool not found: ${toolName}`,
        durationMs: Date.now() - startTime,
      };
    }

    const request = {
      jsonrpc: "2.0",
      id: randomUUID(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: params ?? {},
      },
    };

    try {
      const response = await this.sendMCPRequest(tool.serverId, request);
      return {
        tool: toolName,
        success: true,
        result: response.result,
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        tool: toolName,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Send request to MCP server.
   * MCP uses line-delimited JSON-RPC: each message is one JSON object per line.
   */
  private async sendMCPRequest(
    serverId: string,
    request: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const proc = this.mcpProcesses.get(serverId);

    if (!proc || !proc.stdin) {
      throw new Error(`MCP server not connected: ${serverId}`);
    }

    return new Promise((resolve, reject) => {
      const requestId = request.id as string;
      let lineBuffer = "";

      const onData = (data: Buffer) => {
        lineBuffer += data.toString();
        // MCP sends one JSON object per line
        const lines = lineBuffer.split("\n");
        // Keep the last incomplete line in the buffer
        lineBuffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const response = JSON.parse(trimmed);
            // Match by id — ignore notifications (no id) and mismatched ids
            if (response.id === requestId) {
              proc.stdout?.removeListener("data", onData);
              resolve(response);
              return;
            }
          } catch {
            // Not valid JSON on this line, skip
          }
        }
      };

      proc.stdout?.on("data", onData);

      proc.stdin.write(JSON.stringify(request) + "\n");

      setTimeout(() => {
        proc.stdout?.removeListener("data", onData);
        reject(new Error(`MCP request timeout for ${serverId} method=${request.method}`));
      }, 15000);
    });
  }

  /**
   * Add an MCP server configuration.
   */
  addMCPServer(config: MCPServerConfig): void {
    this.mcpServers.set(config.id, config);
  }

  /**
   * Remove an MCP server.
   */
  removeMCPServer(serverId: string): void {
    const proc = this.mcpProcesses.get(serverId);
    if (proc) {
      proc.kill();
      this.mcpProcesses.delete(serverId);
    }
    this.mcpServers.delete(serverId);
  }

  /**
   * Get MCP server status.
   */
  getMCPServerStatus(): Array<{
    id: string;
    name: string;
    connected: boolean;
  }> {
    return Array.from(this.mcpServers.values()).map((s) => ({
      id: s.id,
      name: s.name,
      connected: this.mcpProcesses.has(s.id),
    }));
  }

  // ─────────────────────────────────────────────────────────────────
  // Web Research
  // ─────────────────────────────────────────────────────────────────

  /**
   * Search the web for information.
   */
  async webSearch(
    query: string,
    numResults: number = 10,
  ): Promise<WebSearchResult[]> {
    this.log("info", `Searching web for: ${query}`);

    // Use Exa API if available, fallback to simple HTTP request
    const results = await this.exaSearch(query, numResults);

    return results;
  }

  /**
   * Search using Exa API.
   */
  private async exaSearch(
    query: string,
    numResults: number,
  ): Promise<WebSearchResult[]> {
    const apiKey = process.env.EXA_API_KEY;

    if (apiKey) {
      try {
        const response = await this.httpRequest({
          hostname: "api.exa.ai",
          path: `/search?query=${encodeURIComponent(query)}&num-results=${numResults}`,
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });

        const data = JSON.parse(response);
        return (data.results ?? []).map(
          (r: { title: string; url: string; text: string }) => ({
            title: r.title,
            url: r.url,
            snippet: r.text?.substring(0, 300) ?? "",
          }),
        );
      } catch {
        // Fall through to fallback
      }
    }

    // Fallback: Use DuckDuckGo-like approach (simplified)
    return this.fallbackSearch(query, numResults);
  }

  /**
   * Fallback search using textise dot iitty
   */
  private async fallbackSearch(
    query: string,
    numResults: number,
  ): Promise<WebSearchResult[]> {
    // Simple fallback - in production you'd use a proper search API
    this.log("warn", "Using fallback search - consider setting EXA_API_KEY");

    return [
      {
        title: `Search results for: ${query}`,
        url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        snippet:
          "Set EXA_API_KEY environment variable for better search results",
        score: 0,
      },
    ];
  }

  /**
   * Research a topic by searching and fetching relevant pages.
   */
  async research(
    query: string,
    options?: { numSources?: number; includeCode?: boolean },
  ): Promise<ResearchResult> {
    const numSources = options?.numSources ?? 5;
    const includeCode = options?.includeCode ?? true;

    const searchResults = await this.webSearch(query, numSources * 2);

    const sources: ResearchResult["sources"] = [];

    for (const result of searchResults.slice(0, numSources)) {
      try {
        const content = await this.fetchPage(result.url);
        const codeExamples = includeCode
          ? this.extractCodeExamples(content)
          : undefined;

        sources.push({
          url: result.url,
          content: content.substring(0, 5000),
          codeExamples,
        });
      } catch {
        // Skip failed pages
      }
    }

    return {
      query,
      results: searchResults,
      sources,
      timestamp: Date.now(),
    };
  }

  /**
   * Fetch a web page.
   */
  async fetchPage(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const client = parsed.protocol === "https:" ? https : http;

      const req = client.get(url, { timeout: 10000 }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      });

      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });
    });
  }

  /**
   * Extract code examples from HTML content.
   */
  private extractCodeExamples(html: string): string[] {
    const codeBlocks: string[] = [];

    // Match <pre><code>...</code></pre> blocks
    const preCodeMatch = html.match(
      /<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
    );
    if (preCodeMatch) {
      for (const block of preCodeMatch) {
        const cleaned = block.replace(/<[^>]+>/g, "").trim();
        if (cleaned.length > 20 && cleaned.length < 2000) {
          codeBlocks.push(cleaned);
        }
      }
    }

    return codeBlocks.slice(0, 10);
  }

  // ─────────────────────────────────────────────────────────────────
  // Utility Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Detect language from file extension.
   */
  detectLanguage(filePath: string): string {
    const ext = extname(filePath).toLowerCase();
    const langMap: Record<string, string> = {
      ".ts": "typescript",
      ".tsx": "typescript",
      ".js": "javascript",
      ".jsx": "javascript",
      ".py": "python",
      ".rb": "ruby",
      ".go": "go",
      ".rs": "rust",
      ".java": "java",
      ".c": "c",
      ".cpp": "cpp",
      ".h": "c",
      ".hpp": "cpp",
      ".cs": "csharp",
      ".php": "php",
      ".swift": "swift",
      ".kt": "kotlin",
      ".scala": "scala",
      ".html": "html",
      ".css": "css",
      ".scss": "scss",
      ".json": "json",
      ".yaml": "yaml",
      ".yml": "yaml",
      ".md": "markdown",
      ".sql": "sql",
      ".sh": "shell",
      ".bash": "shell",
      ".zsh": "shell",
      ".dockerfile": "dockerfile",
      ".xml": "xml",
    };

    return langMap[ext] ?? "plaintext";
  }

  /**
   * Get workspace root.
   */
  getWorkspaceRoot(): string | null {
    // Look for common project markers
    const markers = [
      "package.json",
      "Cargo.toml",
      "go.mod",
      "pyproject.toml",
      "pom.xml",
      "Gemfile",
    ];

    let current = process.cwd();
    while (current !== "/" && current !== dirname(current)) {
      for (const marker of markers) {
        if (existsSync(join(current, marker))) {
          return current;
        }
      }
      current = dirname(current);
    }

    return process.cwd();
  }

  /**
   * Scan workspace for code files.
   */
  scanWorkspace(extensions?: string[]): string[] {
    const root = this.getWorkspaceRoot();
    if (!root) return [];

    const files: string[] = [];
    const extSet = new Set(
      extensions ?? [
        ".ts",
        ".js",
        ".py",
        ".go",
        ".rs",
        ".java",
        ".cpp",
        ".c",
        ".h",
        ".jsx",
        ".tsx",
      ],
    );

    const scan = (dir: string, depth: number = 0): void => {
      if (depth > 5) return; // Limit depth

      try {
        const entries = readdirSync(dir);

        for (const entry of entries) {
          if (
            entry.startsWith(".") ||
            entry === "node_modules" ||
            entry === "dist" ||
            entry === "build" ||
            entry === "target"
          ) {
            continue;
          }

          const fullPath = join(dir, entry);
          const stat = statSync(fullPath);

          if (stat.isDirectory()) {
            scan(fullPath, depth + 1);
          } else if (extSet.has(extname(entry).toLowerCase())) {
            files.push(fullPath);
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    };

    scan(root);
    return files;
  }

  /**
   * Make HTTP/HTTPS request.
   */
  private httpRequest(options: {
    hostname: string;
    path: string;
    method: string;
    headers?: Record<string, string>;
    body?: string;
  }): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = options.hostname.includes("https") ? https : http;

      const req = client.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      });

      req.on("error", reject);
      if (options.body) req.write(options.body);
      req.end();
    });
  }

  /**
   * Disconnect from the IDE.
   */
  disconnect(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    for (const [serverId, proc] of this.mcpProcesses) {
      proc.kill();
    }
    this.mcpProcesses.clear();

    this.toolCache.clear();
    this.healthMonitor.reset();

    if (this.connectionPool) {
      this.connectionPool.close();
      this.connectionPool = null;
    }

    this.pendingRequests.clear();
    this.connected = false;
    this.emit("disconnected");
    this.log("info", "Disconnected from Monaco IDE");
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Lazy load a module.
   */
  async lazyLoad<T>(moduleName: string, loader: () => Promise<T>): Promise<T> {
    if (this.lazyModules.has(moduleName)) {
      const lazyModule = this.lazyModules.get(moduleName)!;
      return lazyModule.get() as Promise<T>;
    }

    const lazyLoader = new LazyLoader(loader);
    this.lazyModules.set(moduleName, lazyLoader);
    return lazyLoader.get() as Promise<T>;
  }

  /**
   * Get connection pool statistics.
   */
  getPoolStats(): {
    total: number;
    available: number;
    pending: number;
    creating: number;
  } | null {
    return this.connectionPool?.getStats() ?? null;
  }
}

/**
 * Create a Monaco IDE instance from config file.
 */
export async function createMonacoIDE(configPath?: string): Promise<MonacoIDE> {
  let config: Partial<MonacoIDEConfig> = {};

  if (configPath && existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, "utf-8");
      config = JSON.parse(content);
    } catch {
      console.warn(`Failed to parse config from ${configPath}`);
    }
  }

  // Load MCP servers from .mcp.json if exists
  const mcpPath = join(process.cwd(), ".mcp.json");
  if (existsSync(mcpPath)) {
    try {
      const mcpConfig = JSON.parse(readFileSync(mcpPath, "utf-8"));
      if (mcpConfig.mcpServers && mcpConfig.mcpServers.length > 0) {
        // Always load from .mcp.json if it has servers, regardless of existing config
        config.mcpServers = mcpConfig.mcpServers;
      }
    } catch {
      // Ignore
    }
  }

  return new MonacoIDE(config);
}
