// ─────────────────────────────────────────────────────────────────────────────
// index.ts  –  UI Preset MCP Server entry point
// ─────────────────────────────────────────────────────────────────────────────

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { registerPresetTools } from "./tools/presetTools.js";
import { registerCorrectionTools } from "./tools/correctionTools.js";
import { registerStyleTools } from "./tools/styleTools.js";
import { registerUIRoutes } from "./routes/uiRoutes.js";
import { startWatching } from "./services/fileWatcher.js";
import { getActivePresetId } from "./services/sessionState.js";
import { invalidateCache, loadPreset } from "./services/presetLoader.js";
import { setActivePreset } from "./services/sessionState.js";

// ── Server initialization ─────────────────────────────────────────────────────

const server = new McpServer({
  name: "ui-preset-mcp-server",
  version: "1.0.0",
});

// Register all tool groups
registerPresetTools(server);
registerCorrectionTools(server);
registerStyleTools(server);

// ── File watcher (dev mode) ───────────────────────────────────────────────────

if (process.env.WATCH_PRESETS === "true") {
  startWatching(async (changedPresetId) => {
    console.error(`[MCP] Preset '${changedPresetId}' changed on disk — reloading...`);
    invalidateCache(changedPresetId);

    // If the changed preset is the active one, reload it automatically
    const activeId = getActivePresetId();
    if (activeId === changedPresetId) {
      try {
        const preset = await loadPreset(changedPresetId);
        setActivePreset(changedPresetId, preset);
        console.error(`[MCP] Active preset '${changedPresetId}' reloaded.`);
      } catch (err) {
        console.error(`[MCP] Failed to reload active preset: ${String(err)}`);
      }
    }
  });
}

// ── Transport ─────────────────────────────────────────────────────────────────

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[MCP] UI Preset MCP Server running (stdio)");
}

async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      server: "ui-preset-mcp-server",
      version: "1.0.0",
      activePreset: getActivePresetId(),
    });
  });

  // Register Design Studio UI routes (dashboard + REST API)
  registerUIRoutes(app);

  const port = parseInt(process.env.PORT ?? "3000");
  app.listen(port, () => {
    console.error(`[MCP] UI Preset MCP Server running on http://localhost:${port}/mcp`);
  });
}

const transport = process.env.TRANSPORT ?? "stdio";
if (transport === "http") {
  runHTTP().catch((err) => {
    console.error("[MCP] Fatal error:", err);
    process.exit(1);
  });
} else {
  runStdio().catch((err) => {
    console.error("[MCP] Fatal error:", err);
    process.exit(1);
  });
}
