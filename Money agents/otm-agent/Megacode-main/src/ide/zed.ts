/**
 * Zed Editor Bridge for OverCoat.
 *
 * Provides a WebSocket server that Zed extensions can connect to
 * for real-time communication: live diffs, status streaming,
 * code completions, and command execution.
 *
 * Zed's extension API supports WebSocket-based communication via
 * the LanguageServer protocol and custom extension transports.
 */

import { VSCodeBridge, VSCodeBridgeConfig, BridgeMessage, BridgeMessageType } from "../vscode/bridge";

export interface ZedBridgeConfig extends VSCodeBridgeConfig {
  /** Zed-specific: notify on file open/close events */
  trackBufferLifecycle?: boolean;
}

const DEFAULT_ZED_CONFIG: ZedBridgeConfig = {
  port: 9742,
  host: "127.0.0.1",
  trackBufferLifecycle: true,
};

/**
 * ZedBridge extends the base WebSocket bridge with Zed-specific
 * message types and lifecycle handling.
 *
 * Install the companion Zed extension to connect this bridge from the editor.
 * The extension listens on the port configured here (default 9742).
 */
export class ZedBridge extends VSCodeBridge {
  private zedConfig: ZedBridgeConfig;

  constructor(config: Partial<ZedBridgeConfig> = {}) {
    super({ ...DEFAULT_ZED_CONFIG, ...config });
    this.zedConfig = { ...DEFAULT_ZED_CONFIG, ...config };
  }

  /** Send an inline diagnostic annotation to Zed. */
  sendDiagnostic(
    filePath: string,
    line: number,
    column: number,
    message: string,
    severity: "error" | "warning" | "info" = "info",
  ): void {
    this.broadcast("diff.update", {
      filePath,
      line,
      column,
      message,
      severity,
      source: "overcoat",
    });
  }

  /** Notify Zed of a completion result to insert at the cursor. */
  insertCompletion(text: string, requestId?: string): void {
    const payload: Record<string, unknown> = { text, source: "overcoat" };
    if (requestId !== undefined) payload.requestId = requestId;
    this.broadcast("completion.response", payload);
  }

  /** Get the Zed-specific configuration. */
  get zedConfiguration(): ZedBridgeConfig {
    return { ...this.zedConfig };
  }
}

export { BridgeMessage, BridgeMessageType };
