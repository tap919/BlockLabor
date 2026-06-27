/**
 * VSCode Extension Activation for OverCoat.
 *
 * Provides the entry point and integration layer for the
 * OverCoat VSCode extension, connecting the multi-LLM router
 * with the WebSocket bridge for deep IDE integration.
 */

import { LLMRouter } from "../llm/router";
import { VSCodeBridge, BridgeMessage, EditorDidChangePayload } from "./bridge";
import { loadOvercoatSpec, buildProviderConfigs } from "../llm/config";
import { LLMCompletionRequest, LLMProviderConfig } from "../llm/provider";
import { WebSocket } from "ws";

export interface OvercoatExtensionConfig {
  workspaceRoot: string;
  bridgePort?: number;
  providerOverrides?: Record<string, Partial<LLMProviderConfig>>;
  /**
   * Explicit API keys for LLM providers, keyed by provider name.
   * These take priority over environment variables but yield to any key
   * already set inside `providerOverrides`.
   *
   * @example
   * ```ts
   * new OvercoatExtension({
   *   workspaceRoot: ".",
   *   apiKeys: { deepseek: "sk-..." },
   * });
   * ```
   */
  apiKeys?: Record<string, string>;
}

export class OvercoatExtension {
  private router: LLMRouter;
  private bridge: VSCodeBridge;
  private workspaceRoot: string;
  /** Tracks the most-recently reported active editor state from VSCode. */
  private activeEditor: EditorDidChangePayload | null = null;
  /** Tracks the most-recently received workspace symbol results from VSCode. */
  private lastSymbolResults: { query: string; symbols: Record<string, unknown>[] } | null = null;

  constructor(config: OvercoatExtensionConfig) {
    this.workspaceRoot = config.workspaceRoot;
    this.router = new LLMRouter({ strategy: "model-match" });
    this.bridge = new VSCodeBridge({ port: config.bridgePort ?? 9741 });

    this.initializeFromOvercoat(config.providerOverrides, config.apiKeys);
  }

  /** Start the extension: connect providers and start the bridge. */
  async activate(): Promise<void> {
    // Start the WebSocket bridge for VSCode communication
    await this.bridge.start();

    // Register message handlers
    this.registerHandlers();

    // Check provider health
    const health = await this.router.healthCheck();
    this.bridge.broadcast("providers.status", { providers: health });
  }

  /** Stop the extension gracefully. */
  async deactivate(): Promise<void> {
    await this.bridge.stop();
  }

  /** Get the LLM router for direct use. */
  getRouter(): LLMRouter {
    return this.router;
  }

  /** Get the VSCode bridge for direct use. */
  getBridge(): VSCodeBridge {
    return this.bridge;
  }

  /** Get the most-recently reported active editor state, or null if unknown. */
  getActiveEditor(): EditorDidChangePayload | null {
    return this.activeEditor;
  }

  /** Get the most-recently received workspace symbol results, or null if none yet. */
  getLastSymbolResults(): { query: string; symbols: Record<string, unknown>[] } | null {
    return this.lastSymbolResults;
  }

  /** Initialize LLM providers from the Overcoat specification file. */
  private initializeFromOvercoat(
    overrides?: Record<string, Partial<LLMProviderConfig>>,
    apiKeys?: Record<string, string>,
  ): void {
    const spec = loadOvercoatSpec(this.workspaceRoot);
    const providerConfigs = buildProviderConfigs(spec, overrides, apiKeys);

    for (const config of providerConfigs) {
      if (config.enabled) {
        this.router.registerProvider(config);
      }
    }
  }

  /** Register WebSocket message handlers for VSCode communication. */
  private registerHandlers(): void {
    // Handle completion requests from VSCode
    this.bridge.on(
      "completion.request",
      async (message: BridgeMessage, client: WebSocket) => {
        try {
          const request = message.payload as unknown as LLMCompletionRequest;

          // Validate required fields before processing
          if (
            !request ||
            !request.messages ||
            !Array.isArray(request.messages) ||
            request.messages.length === 0
          ) {
            this.bridge.send(
              client,
              "completion.response",
              { error: "Invalid request: 'messages' must be a non-empty array" },
              message.id,
            );
            return;
          }

          for (const msg of request.messages) {
            if (!msg || !msg.role || !msg.content) {
              this.bridge.send(
                client,
                "completion.response",
                { error: "Invalid request: each message must have 'role' and 'content'" },
                message.id,
              );
              return;
            }
          }

          if (request.stream) {
            // Stream responses back to VSCode
            for await (const chunk of this.router.streamComplete(request)) {
              this.bridge.send(
                client,
                "completion.stream",
                {
                  content: chunk.content,
                  done: chunk.done,
                },
                message.id,
              );
            }
          } else {
            const response = await this.router.complete(request);
            this.bridge.send(
              client,
              "completion.response",
              response as unknown as Record<string, unknown>,
              message.id,
            );
          }
        } catch (err) {
          this.bridge.send(
            client,
            "completion.response",
            {
              error:
                err instanceof Error ? err.message : "Unknown error",
            },
            message.id,
          );
        }
      },
    );

    // Handle provider listing requests
    this.bridge.on(
      "providers.list",
      (_message: BridgeMessage, client: WebSocket) => {
        const providers = this.router.listProviders();
        this.bridge.send(client, "providers.status", { providers });
      },
    );

    // Handle command execution
    this.bridge.on(
      "command.execute",
      async (message: BridgeMessage, client: WebSocket) => {
        const { command, args } = message.payload as {
          command: string;
          args?: Record<string, unknown>;
        };

        try {
          const result = await this.executeCommand(command, args);
          this.bridge.send(
            client,
            "command.result",
            { success: true, result },
            message.id,
          );
        } catch (err) {
          this.bridge.send(
            client,
            "command.result",
            {
              success: false,
              error:
                err instanceof Error ? err.message : "Unknown error",
            },
            message.id,
          );
        }
      },
    );

    // Track active editor state reported by the VSCode extension
    this.bridge.on(
      "editor.didChange",
      (message: BridgeMessage, _client: WebSocket) => {
        const p = message.payload;
        if (!p || typeof p !== "object") return;
        if (typeof p.filePath === "string" && typeof p.languageId === "string") {
          this.activeEditor = {
            filePath: p.filePath,
            languageId: p.languageId,
            selection: typeof p.selection === "string" ? p.selection : undefined,
            cursorLine: typeof p.cursorLine === "number" ? p.cursorLine : undefined,
            cursorColumn: typeof p.cursorColumn === "number" ? p.cursorColumn : undefined,
          };
        }
      },
    );

    // Collect workspace symbol results returned by VSCode clients in response
    // to server-initiated workspace.symbolQuery broadcasts.
    this.bridge.on(
      "workspace.symbolResult",
      (message: BridgeMessage, _client: WebSocket) => {
        const p = message.payload;
        if (!p || typeof p !== "object") return;
        this.lastSymbolResults = {
          query: typeof p.query === "string" ? p.query : "",
          symbols: Array.isArray(p.symbols) ? (p.symbols as Record<string, unknown>[]) : [],
        };
      },
    );
  }

  /** Execute an OverCoat command. */
  private async executeCommand(
    command: string,
    _args?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    switch (command) {
      case "overcoat.healthCheck":
        return await this.router.healthCheck();
      case "overcoat.listProviders":
        return { providers: this.router.listProviders() };
      case "overcoat.getConfig": {
        const spec = loadOvercoatSpec(this.workspaceRoot);
        return { config: spec ?? null };
      }
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }
}

/**
 * Create and activate an OverCoat extension instance.
 * This is the main entry point for VSCode extension activation.
 */
export async function createOvercoatExtension(
  config: OvercoatExtensionConfig,
): Promise<OvercoatExtension> {
  const extension = new OvercoatExtension(config);
  await extension.activate();
  return extension;
}
