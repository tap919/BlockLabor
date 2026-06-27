/**
 * OverCoat IDE Bridge Factory.
 *
 * Unified entry point for creating IDE-specific bridges.
 * Supports VSCode, Cursor, Zed, and JetBrains/PyCharm.
 */

export { ZedBridge, ZedBridgeConfig } from "./zed";
export { CursorBridge, CursorBridgeConfig } from "./cursor";
export {
  JetBrainsBridge,
  JetBrainsBridgeConfig,
  JetBrainsCompletionRequest,
  JetBrainsCompletionResponse,
} from "./jetbrains";

export type IDEType = "vscode" | "cursor" | "zed" | "jetbrains";

export interface IDEBridgeOptions {
  ide: IDEType;
  port?: number;
  host?: string;
}

import { VSCodeBridge } from "../vscode/bridge";
import { CursorBridge } from "./cursor";
import { ZedBridge } from "./zed";
import { JetBrainsBridge } from "./jetbrains";

/**
 * Create an IDE bridge for the specified editor.
 *
 * Default ports:
 *   vscode   — 9741
 *   zed      — 9742
 *   cursor   — 9743
 *   jetbrains — 9744
 */
export function createIDEBridge(
  options: IDEBridgeOptions,
): VSCodeBridge | ZedBridge | CursorBridge | JetBrainsBridge {
  const { ide, port, host } = options;
  const bridgeConfig = {
    ...(port !== undefined && { port }),
    ...(host !== undefined && { host }),
  };

  switch (ide) {
    case "cursor":
      return new CursorBridge(bridgeConfig);
    case "zed":
      return new ZedBridge(bridgeConfig);
    case "jetbrains":
      return new JetBrainsBridge(bridgeConfig);
    case "vscode":
    default:
      return new VSCodeBridge(bridgeConfig);
  }
}
