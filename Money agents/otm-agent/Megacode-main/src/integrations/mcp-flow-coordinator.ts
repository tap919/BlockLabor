/**
 * MCP Flow Coordinator for Megacode (OverCoat).
 *
 * This is the engine that connects to all 9 MCP servers and orchestrates
 * tool calls across them. It provides:
 *
 * 1. Connection management for all MCP servers via stdio
 * 2. Tool call routing — call any tool on any server by name
 * 3. Flow execution — run a sequence of tool calls with data piping
 * 4. Parallel fan-out — run multiple independent calls simultaneously
 * 5. Result aggregation — collect and merge outputs from multiple MCPs
 *
 * The coordinator is the backbone of the template and recipe systems.
 */

import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { EventEmitter } from "events";

// ============================================================================
// Types
// ============================================================================

/** An MCP server registration. */
export interface MCPServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  cwd?: string;
  enabled: boolean;
}

/** A single tool call to a specific MCP server. */
export interface ToolCall {
  /** MCP server ID to call. */
  serverId: string;
  /** Tool name on that server. */
  tool: string;
  /** Arguments to pass to the tool. */
  args: Record<string, unknown>;
}

/** Result from a single tool call. */
export interface ToolCallResult {
  serverId: string;
  tool: string;
  success: boolean;
  data: unknown;
  error?: string;
  durationMs: number;
}

/** A step in a flow — can be a single call, parallel fan-out, or transform. */
export interface FlowStep {
  /** Step identifier for dependency tracking. */
  id: string;
  /** Human-readable description. */
  label: string;
  /** The type of step. */
  type: "call" | "parallel" | "transform" | "condition";
  /** For "call" — the tool call to make. */
  call?: ToolCall;
  /** For "parallel" — multiple calls to make simultaneously. */
  parallel?: ToolCall[];
  /** For "transform" — a function that takes prior results and returns new args. */
  transform?: (context: FlowContext) => Record<string, unknown>;
  /** For "condition" — a predicate that decides whether to continue. */
  condition?: (context: FlowContext) => boolean;
  /** IDs of steps that must complete before this one. */
  dependsOn?: string[];
}

/** Context that accumulates across a flow execution. */
export interface FlowContext {
  /** All results keyed by step ID. */
  results: Map<string, ToolCallResult | ToolCallResult[]>;
  /** Arbitrary shared data for transforms. */
  variables: Record<string, unknown>;
  /** Flow start time. */
  startedAt: number;
  /** Errors encountered. */
  errors: Array<{ stepId: string; error: string }>;
}

/** A complete flow definition. */
export interface Flow {
  id: string;
  name: string;
  description: string;
  steps: FlowStep[];
  /** Initial variables. */
  variables?: Record<string, unknown>;
}

/** Result of a complete flow execution. */
export interface FlowResult {
  flowId: string;
  flowName: string;
  success: boolean;
  context: FlowContext;
  totalDurationMs: number;
  stepsCompleted: number;
  stepsTotal: number;
}

// ============================================================================
// MCP Connection — manages a single stdio MCP server
// ============================================================================

class MCPConnection {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pending = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private buffer = "";
  private initialized = false;
  public tools: Array<{ name: string; description: string; inputSchema: unknown }> = [];

  constructor(
    public readonly config: MCPServerConfig,
    private readonly rootDir: string
  ) {}

  /** Start the MCP server process and perform the initialize handshake. */
  async connect(): Promise<void> {
    this.process = spawn(this.config.command, this.config.args, {
      cwd: this.config.cwd ?? this.rootDir,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    this.process.stdout!.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString();
      this.processBuffer();
    });

    this.process.stderr!.on("data", () => {
      // Suppress stderr — MCP servers log here
    });

    this.process.on("close", () => {
      this.initialized = false;
      // Reject all pending requests and clear their timers
      for (const [, p] of this.pending) {
        clearTimeout(p.timer);
        p.reject(new Error(`MCP server ${this.config.id} closed unexpectedly`));
      }
      this.pending.clear();
    });

    // Initialize handshake
    await this.send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "megacode-flow-coordinator", version: "1.0.0" },
    });

    // Send initialized notification (required by MCP spec)
    if (this.process && this.process.stdin) {
      const notification = JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      });
      this.process.stdin.write(notification + "\n");
    }

    this.initialized = true;

    // Discover tools
    const listResult = await this.send("tools/list", {}) as {
      tools: Array<{ name: string; description: string; inputSchema: unknown }>;
    };

    this.tools = listResult.tools ?? [];
  }

  /** Call a tool on this MCP server. */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.initialized) {
      throw new Error(`MCP server ${this.config.id} not initialized`);
    }

    const result = await this.send("tools/call", {
      name: toolName,
      arguments: args,
    }) as { content?: Array<{ type: string; text: string }>; isError?: boolean };

    if (result.isError) {
      const errorText = result.content?.map((c) => c.text).join("\n") ?? "Unknown error";
      throw new Error(errorText);
    }

    // Parse the text content
    if (result.content && result.content.length > 0) {
      const text = result.content[0].text;
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }

    return result;
  }

  /** Disconnect from the MCP server. */
  disconnect(): void {
    // Clear all pending request timers
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
    }
    this.pending.clear();

    if (this.process && !this.process.killed) {
      const proc = this.process;
      proc.kill("SIGTERM");
      // SIGKILL fallback after 5s if SIGTERM doesn't work
      const killTimer = setTimeout(() => {
        if (!proc.killed) {
          proc.kill("SIGKILL");
        }
      }, 5000);
      proc.on("close", () => clearTimeout(killTimer));
    }
    this.process = null;
    this.initialized = false;
  }

  get isConnected(): boolean {
    return this.initialized && this.process !== null && !this.process.killed;
  }

  // --- Internal ---

  private send(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.process.stdin) {
        return reject(new Error(`No process for ${this.config.id}`));
      }

      const id = ++this.requestId;

      // Timeout after 30s — cleared when response arrives
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Timeout calling ${method} on ${this.config.id}`));
        }
      }, 30000);

      this.pending.set(id, { resolve, reject, timer });

      const msg = JSON.stringify({
        jsonrpc: "2.0",
        id,
        method,
        params,
      });

      this.process.stdin.write(msg + "\n");
    });
  }

  private processBuffer(): void {
    // MCP uses newline-delimited JSON
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const msg = JSON.parse(trimmed) as {
          id?: number;
          result?: unknown;
          error?: { message: string };
        };

        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const p = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          clearTimeout(p.timer);

          if (msg.error) {
            p.reject(new Error(msg.error.message));
          } else {
            p.resolve(msg.result);
          }
        }
      } catch {
        // Ignore unparseable lines
      }
    }
  }
}

// ============================================================================
// MCPFlowCoordinator — the main orchestration engine
// ============================================================================

/**
 * The flow coordinator manages connections to all MCP servers and executes
 * flows (sequences of tool calls with data piping between steps).
 */
export class MCPFlowCoordinator extends EventEmitter {
  private connections = new Map<string, MCPConnection>();
  private serverConfigs: MCPServerConfig[] = [];
  private rootDir: string;

  /** Global tool index: tool name -> server IDs that expose it. */
  private toolIndex = new Map<string, string[]>();

  constructor(rootDir?: string) {
    super();
    this.rootDir = rootDir ?? process.cwd();
  }

  // --------------------------------------------------------------------------
  // Server management
  // --------------------------------------------------------------------------

  /** Load server configs from .mcp.json. */
  loadConfigs(configPath?: string): MCPServerConfig[] {
    const cfgPath =
      configPath ?? path.join(this.rootDir, ".mcp.json");

    const raw = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    this.serverConfigs = (raw.mcpServers ?? []) as MCPServerConfig[];
    return this.serverConfigs;
  }

  /** Connect to all enabled MCP servers. */
  async connectAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    const promises = this.serverConfigs
      .filter((s) => s.enabled)
      .map(async (config) => {
        try {
          const conn = new MCPConnection(config, this.rootDir);
          await conn.connect();
          this.connections.set(config.id, conn);

          // Index tools
          for (const tool of conn.tools) {
            const existing = this.toolIndex.get(tool.name) ?? [];
            existing.push(config.id);
            this.toolIndex.set(tool.name, existing);
          }

          results.set(config.id, true);
          this.emit("connected", config.id, conn.tools.length);
        } catch (err) {
          results.set(config.id, false);
          this.emit("connection-error", config.id, (err as Error).message);
        }
      });

    await Promise.all(promises);
    return results;
  }

  /** Connect to a single MCP server by ID. */
  async connect(serverId: string): Promise<boolean> {
    const config = this.serverConfigs.find((s) => s.id === serverId);
    if (!config) return false;

    try {
      const conn = new MCPConnection(config, this.rootDir);
      await conn.connect();
      this.connections.set(config.id, conn);

      for (const tool of conn.tools) {
        const existing = this.toolIndex.get(tool.name) ?? [];
        existing.push(config.id);
        this.toolIndex.set(tool.name, existing);
      }

      return true;
    } catch {
      return false;
    }
  }

  /** Disconnect all servers. */
  disconnectAll(): void {
    for (const conn of this.connections.values()) {
      conn.disconnect();
    }
    this.connections.clear();
    this.toolIndex.clear();
  }

  /** Get connection status for all servers. */
  getStatus(): Array<{
    id: string;
    name: string;
    connected: boolean;
    toolCount: number;
  }> {
    return this.serverConfigs.map((config) => {
      const conn = this.connections.get(config.id);
      return {
        id: config.id,
        name: config.name,
        connected: conn?.isConnected ?? false,
        toolCount: conn?.tools.length ?? 0,
      };
    });
  }

  /** Get the global tool index — every tool across every MCP. */
  getToolIndex(): Map<string, string[]> {
    return new Map(this.toolIndex);
  }

  /** Get all tools from a specific server. */
  getServerTools(serverId: string): Array<{ name: string; description: string }> {
    const conn = this.connections.get(serverId);
    if (!conn) return [];
    return conn.tools.map((t) => ({ name: t.name, description: t.description }));
  }

  /** List all available tools across all connected servers. */
  getAllTools(): Array<{ serverId: string; name: string; description: string }> {
    const tools: Array<{ serverId: string; name: string; description: string }> = [];
    for (const [serverId, conn] of this.connections) {
      for (const tool of conn.tools) {
        tools.push({ serverId, name: tool.name, description: tool.description });
      }
    }
    return tools;
  }

  // --------------------------------------------------------------------------
  // Single tool calls
  // --------------------------------------------------------------------------

  /** Call a tool on a specific server. */
  async callTool(serverId: string, toolName: string, args: Record<string, unknown> = {}): Promise<ToolCallResult> {
    const start = Date.now();
    const conn = this.connections.get(serverId);

    if (!conn || !conn.isConnected) {
      return {
        serverId,
        tool: toolName,
        success: false,
        data: null,
        error: `Server ${serverId} not connected`,
        durationMs: Date.now() - start,
      };
    }

    try {
      const data = await conn.callTool(toolName, args);
      return {
        serverId,
        tool: toolName,
        success: true,
        data,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        serverId,
        tool: toolName,
        success: false,
        data: null,
        error: (err as Error).message,
        durationMs: Date.now() - start,
      };
    }
  }

  /**
   * Auto-route a tool call: find which server(s) expose this tool
   * and call the first available one.
   */
  async autoCallTool(toolName: string, args: Record<string, unknown> = {}): Promise<ToolCallResult> {
    const serverIds = this.toolIndex.get(toolName);
    if (!serverIds || serverIds.length === 0) {
      return {
        serverId: "unknown",
        tool: toolName,
        success: false,
        data: null,
        error: `No server exposes tool: ${toolName}`,
        durationMs: 0,
      };
    }

    // Try each server that has this tool
    for (const serverId of serverIds) {
      const result = await this.callTool(serverId, toolName, args);
      if (result.success) return result;
    }

    return {
      serverId: serverIds[0],
      tool: toolName,
      success: false,
      data: null,
      error: `All servers failed for tool: ${toolName}`,
      durationMs: 0,
    };
  }

  // --------------------------------------------------------------------------
  // Flow execution
  // --------------------------------------------------------------------------

  /** Execute a complete flow — a sequence of steps with data piping. */
  async executeFlow(flow: Flow): Promise<FlowResult> {
    const context: FlowContext = {
      results: new Map(),
      variables: { ...flow.variables },
      startedAt: Date.now(),
      errors: [],
    };

    let stepsCompleted = 0;
    const completed = new Set<string>();

    // Build dependency graph
    const stepMap = new Map<string, FlowStep>();
    for (const step of flow.steps) {
      stepMap.set(step.id, step);
    }

    // Execute steps in topological order
    const remaining = new Set(flow.steps.map((s) => s.id));

    while (remaining.size > 0) {
      // Find all steps whose dependencies are satisfied
      const ready: FlowStep[] = [];
      for (const id of remaining) {
        const step = stepMap.get(id)!;
        const deps = step.dependsOn ?? [];
        if (deps.every((d) => completed.has(d))) {
          ready.push(step);
        }
      }

      if (ready.length === 0 && remaining.size > 0) {
        // Deadlock — unsatisfied dependencies
        context.errors.push({
          stepId: "flow",
          error: `Deadlock: ${remaining.size} steps have unsatisfied dependencies`,
        });
        break;
      }

      // Execute ready steps (could parallelize independent ones)
      const stepPromises = ready.map((step) => this.executeStep(step, context));
      const stepResults = await Promise.all(stepPromises);

      for (let i = 0; i < ready.length; i++) {
        const step = ready[i];
        const result = stepResults[i];

        if (result !== null) {
          context.results.set(step.id, result);
          stepsCompleted++;
        }

        remaining.delete(step.id);
        completed.add(step.id);
      }
    }

    const totalDurationMs = Date.now() - context.startedAt;

    this.emit("flow-complete", flow.id, stepsCompleted, flow.steps.length);

    return {
      flowId: flow.id,
      flowName: flow.name,
      success: context.errors.length === 0,
      context,
      totalDurationMs,
      stepsCompleted,
      stepsTotal: flow.steps.length,
    };
  }

  /** Execute a single flow step. */
  private async executeStep(
    step: FlowStep,
    context: FlowContext
  ): Promise<ToolCallResult | ToolCallResult[] | null> {
    this.emit("step-start", step.id, step.label);

    try {
      switch (step.type) {
        case "call": {
          if (!step.call) throw new Error(`Step ${step.id} missing call`);
          const result = await this.callTool(
            step.call.serverId,
            step.call.tool,
            step.call.args
          );
          if (!result.success) {
            context.errors.push({ stepId: step.id, error: result.error ?? "Unknown" });
          }
          this.emit("step-complete", step.id, result.success);
          return result;
        }

        case "parallel": {
          if (!step.parallel) throw new Error(`Step ${step.id} missing parallel`);
          const promises = step.parallel.map((call) =>
            this.callTool(call.serverId, call.tool, call.args)
          );
          const results = await Promise.all(promises);
          const failures = results.filter((r) => !r.success);
          if (failures.length > 0) {
            for (const f of failures) {
              context.errors.push({ stepId: step.id, error: f.error ?? "Unknown" });
            }
          }
          this.emit("step-complete", step.id, failures.length === 0);
          return results;
        }

        case "transform": {
          if (!step.transform) throw new Error(`Step ${step.id} missing transform`);
          const newVars = step.transform(context);
          Object.assign(context.variables, newVars);
          this.emit("step-complete", step.id, true);
          return null;
        }

        case "condition": {
          if (!step.condition) throw new Error(`Step ${step.id} missing condition`);
          const shouldContinue = step.condition(context);
          if (!shouldContinue) {
            context.errors.push({ stepId: step.id, error: "Condition not met — flow halted" });
          }
          this.emit("step-complete", step.id, shouldContinue);
          return null;
        }

        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }
    } catch (err) {
      const error = (err as Error).message;
      context.errors.push({ stepId: step.id, error });
      this.emit("step-error", step.id, error);
      return {
        serverId: "coordinator",
        tool: step.id,
        success: false,
        data: null,
        error,
        durationMs: 0,
      };
    }
  }
}
