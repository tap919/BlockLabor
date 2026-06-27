/**
 * Cursor IDE Bridge for OverCoat.
 *
 * Cursor is built on VSCode and supports the same extension API.
 * This bridge extends the base VSCodeBridge with Cursor-specific
 * features: AI diff previews, composer integration, and
 * context-aware completions.
 */

import { VSCodeBridge, VSCodeBridgeConfig, BridgeMessage, BridgeMessageType } from "../vscode/bridge";

export interface CursorBridgeConfig extends VSCodeBridgeConfig {
  /** Enable Cursor Composer integration (multi-file edits) */
  composerEnabled?: boolean;
  /** Show AI diff previews before applying changes */
  diffPreview?: boolean;
}

const DEFAULT_CURSOR_CONFIG: CursorBridgeConfig = {
  port: 9743,
  host: "127.0.0.1",
  composerEnabled: true,
  diffPreview: true,
};

/**
 * CursorBridge extends VSCodeBridge with Cursor-specific capabilities.
 *
 * Because Cursor ships with its own AI layer, the bridge focuses on
 * providing OverCoat's multi-LLM routing as an alternative backend
 * and surfaces results through Cursor's native diff/preview UI.
 */
export class CursorBridge extends VSCodeBridge {
  private cursorConfig: CursorBridgeConfig;

  constructor(config: Partial<CursorBridgeConfig> = {}) {
    super({ ...DEFAULT_CURSOR_CONFIG, ...config });
    this.cursorConfig = { ...DEFAULT_CURSOR_CONFIG, ...config };
  }

  /**
   * Send a multi-file diff payload for Cursor's Composer preview.
   * Each entry in `files` represents a file to be changed.
   */
  sendComposerDiff(
    files: Array<{ path: string; original: string; updated: string }>,
    description?: string,
  ): void {
    this.broadcast("diff.update", {
      composerDiff: true,
      files,
      description: description ?? "",
      source: "overcoat",
    });
  }

  /** Send a status message to Cursor's status bar. */
  updateStatusBar(text: string, tooltip?: string): void {
    this.broadcast("status.update", {
      statusBar: { text, tooltip: tooltip ?? "" },
      source: "overcoat",
    });
  }

  /** Get the Cursor-specific configuration. */
  get cursorConfiguration(): CursorBridgeConfig {
    return { ...this.cursorConfig };
  }
}

export { BridgeMessage, BridgeMessageType };
