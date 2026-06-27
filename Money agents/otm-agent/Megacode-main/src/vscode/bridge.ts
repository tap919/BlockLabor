/**
 * VSCode WebSocket Bridge for OverCoat.
 *
 * Provides a WebSocket server that VSCode extensions can connect to
 * for real-time communication: live diffs, status streaming,
 * code completions, and command execution.
 */

import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";

export type BridgeMessageType =
  | "completion.request"
  | "completion.response"
  | "completion.stream"
  | "diff.update"
  | "status.update"
  | "command.execute"
  | "command.result"
  | "health.ping"
  | "health.pong"
  | "providers.list"
  | "providers.status"
  | "diagnostics.publish"
  | "diagnostics.clear"
  | "editor.didChange"
  | "workspace.symbolQuery"
  | "workspace.symbolResult";

export interface BridgeMessage {
  id: string;
  type: BridgeMessageType;
  payload: Record<string, unknown>;
  timestamp: number;
}

/** A single diagnostic item pushed from OverCoat to VSCode's Problems panel. */
export interface DiagnosticItem {
  /** Workspace-relative or absolute file path. */
  filePath: string;
  /** 1-based line number. */
  line: number;
  /** 1-based column number. */
  column: number;
  message: string;
  severity: "error" | "warning" | "info" | "hint";
  /** Optional short machine-readable code (e.g. "ts-any-type"). */
  code?: string;
  /** Source label shown in the Problems panel (e.g. "overcoat"). */
  source?: string;
}

/** Payload for `editor.didChange` messages sent by the VSCode extension. */
export interface EditorDidChangePayload {
  /** Workspace-relative or absolute path of the active file. */
  filePath: string;
  /** Programming language identifier (e.g. "typescript"). */
  languageId: string;
  /** Selected text, if any. */
  selection?: string;
  /** 1-based cursor line. */
  cursorLine?: number;
  /** 1-based cursor column. */
  cursorColumn?: number;
}

/** A single workspace symbol returned by a `workspace.symbolResult` message. */
export interface WorkspaceSymbol {
  name: string;
  kind: string;
  filePath: string;
  line: number;
  column: number;
}

export interface VSCodeBridgeConfig {
  port: number;
  host: string;
}

const DEFAULT_BRIDGE_CONFIG: VSCodeBridgeConfig = {
  port: 9741,
  host: "127.0.0.1",
};

type MessageHandler = (
  message: BridgeMessage,
  client: WebSocket,
) => Promise<void> | void;

export class VSCodeBridge {
  private server: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private handlers: Map<BridgeMessageType, MessageHandler[]> = new Map();
  private config: VSCodeBridgeConfig;

  constructor(config: Partial<VSCodeBridgeConfig> = {}) {
    this.config = { ...DEFAULT_BRIDGE_CONFIG, ...config };
  }

  /** Start the WebSocket server. */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = new WebSocketServer({
          port: this.config.port,
          host: this.config.host,
        });

        this.server.on("connection", (ws) => {
          this.clients.add(ws);

          ws.on("message", (data) => {
            try {
              const message = JSON.parse(data.toString()) as BridgeMessage;
              this.handleMessage(message, ws);
            } catch (err) {
              const rawString = typeof data === "string" ? data : data?.toString?.() ?? "";
              const rawMessage = rawString.length > 1024 ? rawString.slice(0, 1024) + "... [truncated]" : rawString;
              console.error("VSCodeBridge: Failed to parse or handle incoming message", {
                error: err,
                rawMessage,
              });

              if (ws.readyState === WebSocket.OPEN) {
                const errorMessage: BridgeMessage = {
                  id: "",
                  type: "status.update",
                  payload: {
                    error: "Invalid message format received by VSCodeBridge",
                    rawMessage,
                  },
                  timestamp: Date.now(),
                };
                ws.send(JSON.stringify(errorMessage));
              }
            }
          });

          ws.on("close", () => {
            this.clients.delete(ws);
          });

          ws.on("error", (err) => {
            console.error("VSCodeBridge client WebSocket error:", err);
            this.clients.delete(ws);
          });
        });

        this.server.on("listening", () => {
          resolve();
        });

        this.server.on("error", (err) => {
          reject(err);
        });

        // Register built-in handlers
        this.registerBuiltinHandlers();
      } catch (err) {
        reject(err);
      }
    });
  }

  /** Stop the WebSocket server. */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      // Close all client connections
      for (const client of this.clients) {
        client.close();
      }
      this.clients.clear();

      this.server.close(() => {
        this.server = null;
        resolve();
      });
    });
  }

  /** Register a handler for a specific message type. */
  on(type: BridgeMessageType, handler: MessageHandler): void {
    const existing = this.handlers.get(type) ?? [];
    existing.push(handler);
    this.handlers.set(type, existing);
  }

  /** Send a message to all connected clients. */
  broadcast(type: BridgeMessageType, payload: Record<string, unknown>): void {
    const message: BridgeMessage = {
      id: this.generateId(),
      type,
      payload,
      timestamp: Date.now(),
    };
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  /** Send a message to a specific client. */
  send(
    client: WebSocket,
    type: BridgeMessageType,
    payload: Record<string, unknown>,
    replyTo?: string,
  ): void {
    if (client.readyState !== WebSocket.OPEN) return;

    const message: BridgeMessage = {
      id: replyTo ?? this.generateId(),
      type,
      payload,
      timestamp: Date.now(),
    };
    client.send(JSON.stringify(message));
  }

  /** Get the number of connected clients. */
  get connectionCount(): number {
    return this.clients.size;
  }

  /** Check if the server is running. */
  get isRunning(): boolean {
    return this.server !== null;
  }

  /**
   * Publish diagnostics for a file to all connected VSCode clients.
   * The VSCode extension should translate these into `vscode.Diagnostic`
   * objects and populate the Problems panel.
   *
   * @param diagnostics  One or more diagnostic items for the same or
   *                     different files.
   */
  publishDiagnostics(diagnostics: DiagnosticItem[]): void {
    this.broadcast("diagnostics.publish", {
      diagnostics,
    });
  }

  /**
   * Clear all OverCoat diagnostics for a specific file, or for all files
   * when `filePath` is omitted.
   */
  clearDiagnostics(filePath?: string): void {
    this.broadcast("diagnostics.clear", {
      filePath: filePath ?? null,
    });
  }

  /**
   * Send a workspace symbol query to connected VSCode clients.
   * Clients should respond with a `workspace.symbolResult` message.
   *
   * @param query   Symbol name prefix to search for.
   *
   * The canonical correlation ID for this request is the `message.id`
   * generated by the bridge when broadcasting the message.
   */
  queryWorkspaceSymbols(query: string): void {
    this.broadcast("workspace.symbolQuery", {
      query,
    });
  }

  private handleMessage(message: BridgeMessage, client: WebSocket): void {
    const handlers = this.handlers.get(message.type) ?? [];
    for (const handler of handlers) {
      handler(message, client);
    }
  }

  private registerBuiltinHandlers(): void {
    this.on("health.ping", (_message, client) => {
      this.send(client, "health.pong", { status: "ok" });
    });
  }

  private generateId(): string {
    return randomUUID();
  }
}
