/**
 * Megacode UI Server
 * Express backend that exposes all Megacode capabilities via REST + SSE.
 * Run with:  node ui/server.js
 */

"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { execSync, spawn, exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

const PORT = process.env.PORT || 3000;
const DIST_PATH = path.resolve(__dirname, "../dist/index.js");
const TERMINAL_ENABLED =
  (process.env.MEGACODE_TERMINAL_ENABLED || "").toLowerCase() === "true";
const WORKSPACE_ALLOW_ANY =
  (process.env.MEGACODE_ALLOW_ANY_WORKSPACE || "").toLowerCase() === "true";

// ─── Load Megacode bundle ──────────────────────────────────────────────────
let megacode = null;
let factory = null;
let taskRouter = null;
let controller = null;
const DEFAULT_WORKSPACE_ROOT = path.resolve(__dirname, "..");
const DEFAULT_WORKSPACE_PARENT = path.dirname(DEFAULT_WORKSPACE_ROOT);
const runtimeSettings = {
  apiKeys: {},
};

function createFactory() {
  return new megacode.ConfigFactory({
    debug: false,
    apiKeys: runtimeSettings.apiKeys,
  });
}

function rebuildTaskRouter() {
  factory = createFactory();
  taskRouter = factory.createTaskRouter();
}

async function loadMegacode() {
  try {
    megacode = require(DIST_PATH);
    rebuildTaskRouter();
    console.log("[Megacode] Core loaded successfully.");
    const providers = factory.getAvailableProviders();
    console.log(
      `[Megacode] Available providers: ${providers.join(", ") || "none"}`,
    );
    
    // Initialize Monaco IDE controller with MCP auto-loading
    try {
      controller = new megacode.MegacodeController({
        monaco: {
          connectionType: "stdio",
          autoDiscoverTools: true,
          webResearch: true,
        },
      });
      // initialize() now handles IDE connection failure gracefully
      // and loads MCPs from .mcp.json automatically
      await controller.initialize();
      const tools = controller.getTools();
      const mcpTools = tools.filter(t => t.source === 'mcp');
      console.log(`[Megacode] IDE Controller ready with ${tools.length} tools (${mcpTools.length} MCP tools).`);
      const mcpStatus = controller.getMCPServerStatus();
      if (mcpStatus.length > 0) {
        console.log(`[MCP] Active servers: ${mcpStatus.map(s => s.name + (s.connected ? ' ✓' : ' (loaded)')).join(', ')}`);
      }
    } catch (ctrlErr) {
      console.warn("[Megacode] IDE Controller failed to initialize:", ctrlErr.message);
      controller = null;
    }

    // Load additional MCP servers from auto-loader (discovers MCP/ folder)
    try {
      await loadMCPServers();
    } catch (mcpErr) {
      console.warn("[MCP] Auto-loader failed, continuing without additional MCPs:", mcpErr.message);
    }
  } catch (err) {
    console.error("[Megacode] Failed to load dist/index.js:", err.message);
    console.error(
      "[Megacode] Run  npm run esbuild:build  first, then restart the server.",
    );
  }
}

// ─── MCP Auto-Loader ───────────────────────────────────────────────────────
let mcpProcesses = new Map();
let workflowSequence = [];
let projectAssessmentTemplate = null;

async function loadMCPServers() {
  try {
    const MCPAutoLoader = require("../mcp-autoloader");
    const loader = new MCPAutoLoader();
    
    // Discover MCP servers
    const servers = loader.discoverMCPServers();
    console.log(`[MCP] Discovered ${servers.length} MCP servers`);
    
    if (servers.length > 0) {
      // Generate configuration
      const config = loader.generateMCPConfig(servers);
      
      // Add MCP servers to controller if available
      if (controller && config.mcpServers) {
        for (const server of config.mcpServers) {
          try {
            controller.addMCPServer({
              id: server.id,
              name: server.name,
              command: server.command,
              args: server.args,
              cwd: server.cwd,
              env: server.env
            });
            console.log(`[MCP] Added server: ${server.name}`);
          } catch (err) {
            console.warn(`[MCP] Failed to add server ${server.name}:`, err.message);
          }
        }
      }
      
      // Create workflow sequence
      workflowSequence = loader.createWorkflowSequence(servers);
      console.log(`[Workflow] Created ${workflowSequence.length} step sequence`);
      
      // Generate project assessment template
      projectAssessmentTemplate = loader.generateProjectAssessment();
      console.log("[Assessment] Project assessment template ready");
      
      // Don't start MCP servers here - let Megacode start them when connecting
      // const processes = loader.startAllMCPServers(servers);
      // mcpProcesses = processes;
      
      console.log("[MCP] MCP servers added to controller");
    }
  } catch (err) {
    console.warn("[MCP] Auto-loader failed, continuing without MCP:", err.message);
  }
}

loadMegacode().catch((err) => {
  console.error("[Megacode] Initial load failed:", err.message);
});

// ─── Express app ──────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: "4mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  "/monaco/vs",
  express.static(path.join(__dirname, "..", "node_modules", "monaco-editor", "min", "vs")),
);

// ─── Middleware: check megacode loaded ────────────────────────────────────
function requireMegacode(req, res, next) {
  if (!megacode || !factory || !taskRouter) {
    return res.status(503).json({
      error:
        "Megacode core not loaded. Run `npm run esbuild:build` and restart.",
    });
  }
  next();
}

function requireTerminalEnabled(req, res, next) {
  if (!TERMINAL_ENABLED) {
    return res.status(403).json({
      error:
        "Terminal endpoints are disabled. Set MEGACODE_TERMINAL_ENABLED=true to enable.",
    });
  }
  next();
}

// ─── GET /api/status ──────────────────────────────────────────────────────
app.get("/api/status", requireMegacode, (req, res) => {
  try {
    const keyStatus = factory.getAPIKeyStatus();
    const providers = factory.getAvailableProviders();
    const taskMapping = taskRouter.getTaskMapping();
    const providerStatus = taskRouter.getProviderStatus();

    res.json({
      ok: true,
      keyStatus,
      providers,
      taskMapping,
      providerStatus,
      buildLoaded: !!megacode,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/settings", requireMegacode, (req, res) => {
  try {
    const keyStatus = factory.getAPIKeyStatus();
    res.json({
      ok: true,
      settings: {
        hasDeepSeekKey: !!runtimeSettings.apiKeys.deepseek,
        keyStatus,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/settings/api-keys", requireMegacode, (req, res) => {
  const { deepseek } = req.body || {};

  if (typeof deepseek !== "string" || !deepseek.trim()) {
    return res.status(400).json({ error: "deepseek API key is required." });
  }

  try {
    runtimeSettings.apiKeys.deepseek = deepseek.trim();
    rebuildTaskRouter();
    const keyStatus = factory.getAPIKeyStatus();
    res.json({
      ok: true,
      saved: true,
      settings: {
        hasDeepSeekKey: true,
        keyStatus,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/health ──────────────────────────────────────────────────────
app.get("/api/health", requireMegacode, async (req, res) => {
  try {
    const health = await taskRouter.healthCheck();
    res.json({ ok: true, health });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, health: {} });
  }
});

// ─── GET /api/task-types ──────────────────────────────────────────────────
app.get("/api/task-types", requireMegacode, (req, res) => {
  const taskMapping = taskRouter.getTaskMapping();
  const descriptions = {
    daily: "Daily go-to tasks — quick questions, short completions",
    research: "Deep research, background info, fact-finding",
    complex_logic: "Complex code review, algorithms, architecture",
    creative: "Creative, UI/UX design, inventive suggestions",
    templates: "Boilerplate, scaffolding, code templates",
    image: "Image generation / visual description",
    video: "Video generation / animation descriptions",
    long_session: "Extended sessions with large context windows",
    the_block: "Blockchain, crypto, smart contracts, Web3",
    general: "General fallback — any task",
  };
  const icons = {
    daily: "⚡",
    research: "🔬",
    complex_logic: "🧠",
    creative: "🎨",
    templates: "📋",
    image: "🖼️",
    video: "🎬",
    long_session: "🏃",
    the_block: "⛓️",
    general: "🌐",
  };
  const types = Object.keys(taskMapping).map((t) => ({
    id: t,
    label: t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    description: descriptions[t] || t,
    icon: icons[t] || "💬",
    providers: taskMapping[t],
  }));
  res.json({ ok: true, types });
});

// ─── POST /api/chat ───────────────────────────────────────────────────────
// Body: { messages: LLMMessage[], taskType?: string, stream?: boolean }
app.post("/api/chat", requireMegacode, async (req, res) => {
  const { messages, taskType, stream } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required." });
  }

  const abortCtrl = new AbortController();
  req.on("close", () => {
    try {
      abortCtrl.abort();
    } catch (_) {}
  });

  const request = { messages, signal: abortCtrl.signal };
  const resolvedTask =
    taskType && taskType !== "auto"
      ? taskType
      : taskRouter.detectTaskType(request);

  // ── Streaming via SSE ──────────────────────────────────────────────────
  if (stream) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const requestId =
      typeof crypto?.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const send = (data) =>
      res.write(
        `data: ${JSON.stringify({ requestId, ...data })}\n\n`,
      );

    try {
      send({ type: "task", taskType: resolvedTask });

      let fullContent = "";
      const gen = taskRouter.streamComplete(request, resolvedTask);

      for await (const chunk of gen) {
        if (chunk.content) {
          fullContent += chunk.content;
          send({ type: "chunk", content: chunk.content });
        }
        if (chunk.done) break;
      }

      // Quality-score any code blocks in the response
      const qualityReports = scoreCodeBlocks(fullContent);

      send({ type: "done", taskType: resolvedTask, qualityReports });
    } catch (err) {
      const msg = err && err.name === "AbortError" ? "Request cancelled" : err.message;
      send({ type: "error", error: msg });
    } finally {
      res.end();
    }
    return;
  }

  // ── Non-streaming ──────────────────────────────────────────────────────
  try {
    const response = await taskRouter.complete(request, resolvedTask);
    const qualityReports = scoreCodeBlocks(response.content || "");

    res.json({
      ok: true,
      content: response.content,
      provider: response.provider,
      model: response.model,
      usage: response.usage,
      taskType: resolvedTask,
      qualityReports,
    });
  } catch (err) {
    const msg = err && err.name === "AbortError" ? "Request cancelled" : err.message;
    res
      .status(502)
      .json({ ok: false, error: msg, taskType: resolvedTask });
  }
});

// ─── POST /api/detect-task ────────────────────────────────────────────────
app.post("/api/detect-task", requireMegacode, (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required." });
  }
  try {
    const taskType = taskRouter.detectTaskType({ messages });
    const mapping = taskRouter.getTaskMapping();
    res.json({ ok: true, taskType, providers: mapping[taskType] || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/score ──────────────────────────────────────────────────────
app.post("/api/score", requireMegacode, (req, res) => {
  const { code } = req.body;
  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "code string is required." });
  }
  try {
    const report = megacode.scoreCode(code);
    res.json({ ok: true, report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/explain-error ──────────────────────────────────────────────
app.post("/api/explain-error", requireMegacode, (req, res) => {
  const { errorMessage } = req.body;
  if (!errorMessage || typeof errorMessage !== "string") {
    return res.status(400).json({ error: "errorMessage string is required." });
  }
  try {
    const explainer = new megacode.PlainEnglishErrorExplainer();
    const explanation = explainer.explain(errorMessage);
    res.json({ ok: true, explanation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/glossary/:term ──────────────────────────────────────────────
app.get("/api/glossary/:term", requireMegacode, (req, res) => {
  const { term } = req.params;
  try {
    const glossary = new megacode.PlainLanguageGlossary();
    const entry = glossary.lookup(term);
    res.json({ ok: true, entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/validate-intent ────────────────────────────────────────────
app.post("/api/validate-intent", requireMegacode, (req, res) => {
  const { userRequest, aiResponse } = req.body;
  if (!userRequest || !aiResponse) {
    return res
      .status(400)
      .json({ error: "userRequest and aiResponse are required." });
  }
  try {
    const validator = new megacode.IntentValidator();
    const result = validator.validate(userRequest, aiResponse);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/confidence ─────────────────────────────────────────────────
app.post("/api/confidence", requireMegacode, (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "text string is required." });
  }
  try {
    const indicator = new megacode.ConfidenceIndicator();
    const assessment = indicator.assess(text);
    res.json({ ok: true, assessment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/safe-mode ──────────────────────────────────────────────────
app.post("/api/safe-mode", requireMegacode, (req, res) => {
  const { operation } = req.body;
  if (!operation || typeof operation !== "string") {
    return res.status(400).json({ error: "operation string is required." });
  }
  try {
    const safeMode = new megacode.SafeMode();
    const result = safeMode.classify(operation);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/scaffold ───────────────────────────────────────────────────
app.post("/api/scaffold", requireMegacode, (req, res) => {
  const { description } = req.body;
  if (!description || typeof description !== "string") {
    return res.status(400).json({ error: "description string is required." });
  }
  try {
    const scaffolder = new megacode.SmartScaffolder();
    const result = scaffolder.generate(description);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/check-dependency ───────────────────────────────────────────
app.post("/api/check-dependency", requireMegacode, (req, res) => {
  const { packageName, version } = req.body;
  if (!packageName || typeof packageName !== "string") {
    return res.status(400).json({ error: "packageName string is required." });
  }
  try {
    const advisor = new megacode.DependencyAdvisor();
    const advice = advisor.advise(packageName, version);
    res.json({ ok: true, advice });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/reload ─────────────────────────────────────────────────────
app.post("/api/reload", async (req, res) => {
  try {
    controller?.disconnect?.();
    // Clear require cache so fresh dist is loaded
    Object.keys(require.cache).forEach((key) => {
      if (key.includes("dist/index") || key.includes("dist\\index")) {
        delete require.cache[key];
      }
    });
    megacode = null;
    factory = null;
    taskRouter = null;
    controller = null;
    await loadMegacode();
    res.json({
      ok: !!megacode,
      message: megacode ? "Megacode reloaded." : "Reload failed.",
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /api/ping ────────────────────────────────────────────────────────
app.get("/api/ping", (req, res) => {
  res.json({ ok: true, loaded: !!megacode, ts: Date.now() });
});

// ═══════════════════════════════════════════════════════════════════════════
// FILE SYSTEM API
// ═══════════════════════════════════════════════════════════════════════════

// Workspace root — set via POST /api/workspace/open, defaults to project root
let workspaceRoot = DEFAULT_WORKSPACE_ROOT;

// Security: prevent path traversal outside workspace
function safePath(rel) {
  const resolved = path.resolve(workspaceRoot, rel || "");
  const relative = path.relative(workspaceRoot, resolved);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    (process.platform === "win32" &&
      resolved.toLowerCase() !== workspaceRoot.toLowerCase() &&
      !resolved.toLowerCase().startsWith(workspaceRoot.toLowerCase() + path.sep))
  ) {
    return null;
  }
  return resolved;
}

// Directories/files to hide from the tree
const IGNORED = new Set([
  "node_modules",
  ".git",
  "dist",
  ".DS_Store",
  "Thumbs.db",
  ".env",
  ".env.local",
]);

// ─── GET /api/workspace ───────────────────────────────────────────────────
app.get("/api/workspace", (req, res) => {
  res.json({ ok: true, root: workspaceRoot });
});

// ─── POST /api/workspace/reset ────────────────────────────────────────────
app.post("/api/workspace/reset", (req, res) => {
  workspaceRoot = DEFAULT_WORKSPACE_ROOT;
  res.json({ ok: true, root: workspaceRoot });
});

// ─── POST /api/workspace/open ─────────────────────────────────────────────
app.post("/api/workspace/open", (req, res) => {
  const { folderPath } = req.body;
  if (!folderPath || typeof folderPath !== "string") {
    return res.status(400).json({ error: "folderPath string is required." });
  }
  const resolved = path.resolve(folderPath);
  if (!WORKSPACE_ALLOW_ANY) {
    const rel = path.relative(DEFAULT_WORKSPACE_PARENT, resolved);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      return res.status(403).json({
        error:
          "Workspace path is outside the allowed parent. Set MEGACODE_ALLOW_ANY_WORKSPACE=true to override.",
      });
    }
  }
  try {
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: "Path is not a directory." });
    }
    workspaceRoot = resolved;
    res.json({ ok: true, root: workspaceRoot });
  } catch (err) {
    res.status(400).json({ error: "Directory not found: " + err.message });
  }
});

// ─── GET /api/files/tree ──────────────────────────────────────────────────
// Returns a recursive file tree (capped depth to avoid huge scans)
app.get("/api/files/tree", (req, res) => {
  const rel = req.query.path || "";
  const depth = Math.min(parseInt(req.query.depth) || 4, 8);
  const target = safePath(rel);
  if (!target) return res.status(403).json({ error: "Path outside workspace." });

  try {
    const tree = buildTree(target, depth, 0);
    res.json({ ok: true, root: workspaceRoot, tree });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function buildTree(dirPath, maxDepth, currentDepth) {
  if (currentDepth >= maxDepth) return [];
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (_) {
    return [];
  }
  const result = [];
  for (const ent of entries) {
    if (IGNORED.has(ent.name)) continue;
    const full = path.join(dirPath, ent.name);
    const relPath = path.relative(workspaceRoot, full).replace(/\\/g, "/");
    if (ent.isDirectory()) {
      result.push({
        name: ent.name,
        path: relPath,
        type: "directory",
        children: buildTree(full, maxDepth, currentDepth + 1),
      });
    } else {
      const stats = fs.statSync(full);
      result.push({
        name: ent.name,
        path: relPath,
        type: "file",
        size: stats.size,
      });
    }
  }
  // Sort: dirs first, then files, alphabetical within each
  result.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return result;
}

// ─── GET /api/files/read ──────────────────────────────────────────────────
app.get("/api/files/read", (req, res) => {
  const rel = req.query.path;
  if (!rel) return res.status(400).json({ error: "path query param required." });
  const target = safePath(rel);
  if (!target) return res.status(403).json({ error: "Path outside workspace." });

  try {
    const stats = fs.statSync(target);
    if (stats.isDirectory()) {
      return res.status(400).json({ error: "Path is a directory, not a file." });
    }
    // Don't read very large files (>2MB)
    if (stats.size > 2 * 1024 * 1024) {
      return res
        .status(400)
        .json({ error: "File too large (>2MB). size=" + stats.size });
    }
    const content = fs.readFileSync(target, "utf-8");
    const ext = path.extname(target).slice(1);
    res.json({
      ok: true,
      path: rel,
      name: path.basename(target),
      content,
      size: stats.size,
      extension: ext,
      language: extToLanguage(ext),
    });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// ─── POST /api/files/write ────────────────────────────────────────────────
app.post("/api/files/write", (req, res) => {
  const { path: filePath, content } = req.body;
  if (!filePath || typeof filePath !== "string") {
    return res.status(400).json({ error: "path string is required." });
  }
  if (typeof content !== "string") {
    return res.status(400).json({ error: "content string is required." });
  }
  const target = safePath(filePath);
  if (!target)
    return res.status(403).json({ error: "Path outside workspace." });

  try {
    // Ensure parent directory exists
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf-8");
    res.json({ ok: true, path: filePath, size: Buffer.byteLength(content) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/files/create-dir ───────────────────────────────────────────
app.post("/api/files/create-dir", (req, res) => {
  const { path: dirPath } = req.body;
  if (!dirPath || typeof dirPath !== "string") {
    return res.status(400).json({ error: "path string is required." });
  }
  const target = safePath(dirPath);
  if (!target)
    return res.status(403).json({ error: "Path outside workspace." });

  try {
    fs.mkdirSync(target, { recursive: true });
    res.json({ ok: true, path: dirPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/files/delete ───────────────────────────────────────────────
app.post("/api/files/delete", (req, res) => {
  const { path: filePath } = req.body;
  if (!filePath || typeof filePath !== "string") {
    return res.status(400).json({ error: "path string is required." });
  }
  const target = safePath(filePath);
  if (!target)
    return res.status(403).json({ error: "Path outside workspace." });

  try {
    const stats = fs.statSync(target);
    if (stats.isDirectory()) {
      fs.rmSync(target, { recursive: true, force: true });
    } else {
      fs.unlinkSync(target);
    }
    res.json({ ok: true, path: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/files/rename ───────────────────────────────────────────────
app.post("/api/files/rename", (req, res) => {
  const { oldPath, newPath } = req.body;
  if (!oldPath || !newPath) {
    return res
      .status(400)
      .json({ error: "oldPath and newPath strings are required." });
  }
  const srcPath = safePath(oldPath);
  const dstPath = safePath(newPath);
  if (!srcPath || !dstPath)
    return res.status(403).json({ error: "Path outside workspace." });

  try {
    fs.mkdirSync(path.dirname(dstPath), { recursive: true });
    fs.renameSync(srcPath, dstPath);
    res.json({ ok: true, oldPath, newPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GIT API
// ═══════════════════════════════════════════════════════════════════════════

function gitExec(cmd) {
  return execSync(cmd, {
    cwd: workspaceRoot,
    encoding: "utf-8",
    timeout: 15000,
    maxBuffer: 5 * 1024 * 1024,
  }).trim();
}

function isGitRepo() {
  try {
    gitExec("git rev-parse --is-inside-work-tree");
    return true;
  } catch (_) {
    return false;
  }
}

// ─── GET /api/git/status ──────────────────────────────────────────────────
app.get("/api/git/status", (req, res) => {
  if (!isGitRepo())
    return res.json({ ok: false, error: "Not a git repository." });
  try {
    const branch = gitExec("git branch --show-current") || "HEAD (detached)";
    const status = gitExec("git status --porcelain");
    const files = status
      ? status.split("\n").map((line) => ({
          status: line.substring(0, 2).trim(),
          path: line.substring(3),
        }))
      : [];
    const hasChanges = files.length > 0;
    res.json({ ok: true, branch, files, hasChanges });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /api/git/log ─────────────────────────────────────────────────────
app.get("/api/git/log", (req, res) => {
  if (!isGitRepo())
    return res.json({ ok: false, error: "Not a git repository." });
  try {
    const count = Math.min(parseInt(req.query.count) || 20, 100);
    const raw = gitExec(
      `git log --oneline --decorate --format="%H|%h|%an|%ar|%s" -n ${count}`,
    );
    const entries = raw
      ? raw.split("\n").map((line) => {
          const [hash, short, author, date, ...msgParts] = line.split("|");
          return { hash, short, author, date, message: msgParts.join("|") };
        })
      : [];
    res.json({ ok: true, entries });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /api/git/diff ────────────────────────────────────────────────────
app.get("/api/git/diff", (req, res) => {
  if (!isGitRepo())
    return res.json({ ok: false, error: "Not a git repository." });
  try {
    const staged = req.query.staged === "true";
    const filePath = req.query.path || "";
    let cmd = staged ? "git diff --cached" : "git diff";
    if (filePath) cmd += ` -- "${filePath}"`;
    const diff = gitExec(cmd);
    res.json({ ok: true, diff });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /api/git/branches ────────────────────────────────────────────────
app.get("/api/git/branches", (req, res) => {
  if (!isGitRepo())
    return res.json({ ok: false, error: "Not a git repository." });
  try {
    const raw = gitExec("git branch -a --no-color");
    const branches = raw.split("\n").map((b) => {
      const current = b.startsWith("*");
      return { name: b.replace(/^\*?\s+/, "").trim(), current };
    });
    res.json({ ok: true, branches });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /api/git/add ───────────────────────────────────────────────────
app.post("/api/git/add", (req, res) => {
  if (!isGitRepo())
    return res.json({ ok: false, error: "Not a git repository." });
  try {
    const files = req.body.files || ["."];
    const fileArgs = files.map((f) => `"${f}"`).join(" ");
    gitExec(`git add ${fileArgs}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /api/git/commit ────────────────────────────────────────────────
app.post("/api/git/commit", (req, res) => {
  if (!isGitRepo())
    return res.json({ ok: false, error: "Not a git repository." });
  try {
    const { message } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message string is required." });
    }
    const result = gitExec(`git commit -m "${message.replace(/"/g, '\\"')}"`);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /api/git/checkout ──────────────────────────────────────────────
app.post("/api/git/checkout", (req, res) => {
  if (!isGitRepo())
    return res.json({ ok: false, error: "Not a git repository." });
  try {
    const { branch, create } = req.body;
    if (!branch) return res.status(400).json({ error: "branch is required." });
    const cmd = create
      ? `git checkout -b "${branch}"`
      : `git checkout "${branch}"`;
    const result = gitExec(cmd);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /api/git/pull ──────────────────────────────────────────────────
app.post("/api/git/pull", (req, res) => {
  if (!isGitRepo())
    return res.json({ ok: false, error: "Not a git repository." });
  try {
    const result = gitExec("git pull");
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /api/git/push ──────────────────────────────────────────────────
app.post("/api/git/push", (req, res) => {
  if (!isGitRepo())
    return res.json({ ok: false, error: "Not a git repository." });
  try {
    const result = gitExec("git push");
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TERMINAL / COMMAND EXECUTION API
// ═══════════════════════════════════════════════════════════════════════════

const activeProcesses = new Map();

// ─── POST /api/terminal/exec ──────────────────────────────────────────────
// Runs a command and returns output (non-streaming, max 30s)
app.post("/api/terminal/exec", requireTerminalEnabled, (req, res) => {
  const { command, cwd } = req.body;
  if (!command || typeof command !== "string") {
    return res.status(400).json({ error: "command string is required." });
  }
  const execDir = cwd ? safePath(cwd) || workspaceRoot : workspaceRoot;

  try {
    const output = execSync(command, {
      cwd: execDir,
      encoding: "utf-8",
      timeout: 30000,
      maxBuffer: 5 * 1024 * 1024,
      shell: true,
    });
    res.json({ ok: true, output, exitCode: 0 });
  } catch (err) {
    res.json({
      ok: false,
      output: (err.stdout || "") + (err.stderr || ""),
      exitCode: err.status || 1,
      error: err.message,
    });
  }
});

// ─── POST /api/terminal/spawn ─────────────────────────────────────────────
// Spawns a long-running process; streams output via SSE
app.post("/api/terminal/spawn", requireTerminalEnabled, (req, res) => {
  const { command, cwd } = req.body;
  if (!command || typeof command !== "string") {
    return res.status(400).json({ error: "command string is required." });
  }
  const execDir = cwd ? safePath(cwd) || workspaceRoot : workspaceRoot;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const proc = spawn(command, {
    cwd: execDir,
    shell: true,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const pid = proc.pid;
  activeProcesses.set(pid, proc);

  const send = (data) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (_) {}
  };

  send({ type: "started", pid });

  proc.stdout.on("data", (chunk) => send({ type: "stdout", data: chunk.toString() }));
  proc.stderr.on("data", (chunk) => send({ type: "stderr", data: chunk.toString() }));
  proc.on("close", (code) => {
    send({ type: "exit", code });
    activeProcesses.delete(pid);
    res.end();
  });
  proc.on("error", (err) => {
    send({ type: "error", error: err.message });
    activeProcesses.delete(pid);
    res.end();
  });

  req.on("close", () => {
    try {
      proc.kill();
    } catch (_) {}
    activeProcesses.delete(pid);
  });
});

// ─── POST /api/terminal/kill ──────────────────────────────────────────────
app.post("/api/terminal/kill", requireTerminalEnabled, (req, res) => {
  const { pid } = req.body;
  if (!pid) return res.status(400).json({ error: "pid is required." });
  const proc = activeProcesses.get(pid);
  if (proc) {
    try {
      proc.kill();
    } catch (_) {}
    activeProcesses.delete(pid);
    res.json({ ok: true });
  } else {
    res.json({ ok: false, error: "Process not found." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FILE SEARCH API
// ═══════════════════════════════════════════════════════════════════════════

// ─── GET /api/files/search ────────────────────────────────────────────────
app.get("/api/files/search", (req, res) => {
  const query = req.query.q || "";
  const searchType = req.query.type || "name"; // 'name' or 'content'
  if (!query) return res.status(400).json({ error: "q query param required." });

  try {
    if (searchType === "content") {
      // Content search using grep
      const results = [];
      searchContent(workspaceRoot, query, results, 0, 3, 100);
      res.json({ ok: true, results, total: results.length });
    } else {
      // Filename search
      const results = [];
      searchFilenames(workspaceRoot, query.toLowerCase(), results, 0, 4, 50);
      res.json({ ok: true, results, total: results.length });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function searchFilenames(dir, query, results, depth, maxDepth, maxResults) {
  if (depth >= maxDepth || results.length >= maxResults) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return;
  }
  for (const ent of entries) {
    if (results.length >= maxResults) return;
    if (IGNORED.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    const rel = path.relative(workspaceRoot, full).replace(/\\/g, "/");
    if (ent.name.toLowerCase().includes(query)) {
      results.push({
        name: ent.name,
        path: rel,
        type: ent.isDirectory() ? "directory" : "file",
      });
    }
    if (ent.isDirectory()) {
      searchFilenames(full, query, results, depth + 1, maxDepth, maxResults);
    }
  }
}

function searchContent(dir, query, results, depth, maxDepth, maxResults) {
  if (depth >= maxDepth || results.length >= maxResults) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return;
  }
  const TEXT_EXTS = new Set([
    "js","ts","jsx","tsx","json","md","txt","css","scss","html",
    "py","rb","go","rs","java","c","cpp","h","hpp","yaml","yml",
    "toml","xml","sql","sh","bat","ps1","env","cfg","ini","conf",
  ]);
  for (const ent of entries) {
    if (results.length >= maxResults) return;
    if (IGNORED.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      searchContent(full, query, results, depth + 1, maxDepth, maxResults);
    } else {
      const ext = path.extname(ent.name).slice(1).toLowerCase();
      if (!TEXT_EXTS.has(ext)) continue;
      try {
        const stats = fs.statSync(full);
        if (stats.size > 512 * 1024) continue; // skip >512KB
        const content = fs.readFileSync(full, "utf-8");
        const lines = content.split("\n");
        const matches = [];
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(query)) {
            matches.push({ line: i + 1, text: lines[i].trim().slice(0, 200) });
            if (matches.length >= 5) break;
          }
        }
        if (matches.length > 0) {
          const rel = path.relative(workspaceRoot, full).replace(/\\/g, "/");
          results.push({ name: ent.name, path: rel, matches });
        }
      } catch (_) {}
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function extToLanguage(ext) {
  const map = {
    js: "javascript", ts: "typescript", jsx: "javascript", tsx: "typescript",
    py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
    c: "c", cpp: "cpp", h: "c", hpp: "cpp", cs: "csharp",
    html: "html", css: "css", scss: "scss", less: "less",
    json: "json", xml: "xml", yaml: "yaml", yml: "yaml",
    md: "markdown", txt: "plaintext", sh: "shell", bat: "bat",
    sql: "sql", graphql: "graphql", dockerfile: "dockerfile",
    toml: "toml", ini: "ini", cfg: "ini",
  };
  return map[(ext || "").toLowerCase()] || "plaintext";
}

// ═══════════════════════════════════════════════════════════════════════════
// MCP / IDE TOOL API (via MegacodeController)
// ═══════════════════════════════════════════════════════════════════════════

function requireController(req, res, next) {
  if (!controller) {
    return res.status(503).json({
      error: "IDE Controller not available. Check server logs.",
    });
  }
  next();
}

function hasLiveIDEConnection() {
  try {
    return !!controller?.getIDE?.().isConnected?.();
  } catch (_) {
    return false;
  }
}

function getControllerTool(toolId) {
  try {
    return controller?.getTools?.().find((tool) => tool.id === toolId) || null;
  } catch (_) {
    return null;
  }
}

// ─── GET /api/tools ────────────────────────────────────────────────────────
app.get("/api/tools", requireController, (req, res) => {
  try {
    const tools = controller.getTools();
    res.json({ ok: true, tools });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/tools/execute ───────────────────────────────────────────────
app.post("/api/tools/execute", requireController, async (req, res) => {
  const { toolId, params } = req.body;
  if (!toolId || typeof toolId !== "string") {
    return res.status(400).json({ error: "toolId string is required." });
  }
  try {
    const tool = getControllerTool(toolId);
    if (!tool) {
      return res.status(404).json({ error: `Tool not found: ${toolId}` });
    }
    if (tool.source === "ide" && !hasLiveIDEConnection()) {
      return res.status(409).json({
        error:
          "This IDE tool requires a live Monaco/IDE connection, which is not currently available.",
      });
    }
    const result = await controller.executeTool(toolId, params);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/tools/search ────────────────────────────────────────────────
app.post("/api/tools/search", requireController, async (req, res) => {
  const { query } = req.body;
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "query string is required." });
  }
  try {
    const results = await controller.searchWeb(query);
    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/tools/research ──────────────────────────────────────────────
app.post("/api/tools/research", requireController, async (req, res) => {
  const { query } = req.body;
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "query string is required." });
  }
  try {
    const result = await controller.research(query);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/tools/editor-state ───────────────────────────────────────────
app.get("/api/tools/editor-state", requireController, async (req, res) => {
  try {
    if (!hasLiveIDEConnection()) {
      return res.status(409).json({
        error:
          "Editor state is unavailable because no live Monaco/IDE connection is active.",
      });
    }
    const state = await controller.getEditorState();
    res.json({ ok: true, state });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/tools/analyze-context ────────────────────────────────────────
app.get("/api/tools/analyze-context", requireController, async (req, res) => {
  try {
    if (!hasLiveIDEConnection()) {
      return res.status(409).json({
        error:
          "Context analysis requires a live Monaco/IDE connection.",
      });
    }
    const analysis = await controller.analyzeContext();
    res.json({ ok: true, analysis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/tools/process-request ───────────────────────────────────────
app.post("/api/tools/process-request", requireController, async (req, res) => {
  const { request } = req.body;
  if (!request || typeof request !== "string") {
    return res.status(400).json({ error: "request string is required." });
  }
  try {
    if (
      !hasLiveIDEConnection() &&
      /(format|save|goto line|go to line|rename|quick fix|definition|references)/i.test(
        request,
      )
    ) {
      return res.status(409).json({
        error:
          "That request needs a live Monaco/IDE connection. Search and research requests still work without one.",
      });
    }
    const result = await controller.processRequest(request);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/tools/handle-error ──────────────────────────────────────────
app.post("/api/tools/handle-error", requireController, async (req, res) => {
  const { error } = req.body;
  if (!error) {
    return res.status(400).json({ error: "error string or object is required." });
  }
  try {
    const result = await controller.handleError(error);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/tools/status ─────────────────────────────────────────────────
app.get("/api/tools/status", (req, res) => {
  res.json({
    ok: !!controller,
    available: !!controller,
    toolsCount: controller ? controller.getTools().length : 0,
    ideConnected: hasLiveIDEConnection(),
  });
});

// ─── PROJECT ASSESSMENT & WORKFLOW ENDPOINTS ──────────────────────────────

// ─── GET /api/assessment/template ─────────────────────────────────────────
app.get("/api/assessment/template", (req, res) => {
  res.json({
    ok: true,
    template: projectAssessmentTemplate || {
      assessment: {
        steps: [
          'Scan project structure and files',
          'Analyze dependencies and package.json',
          'Check for configuration files',
          'Identify entry points and main modules',
          'Review existing code quality',
          'Check for tests and documentation',
          'Assess build and deployment setup',
          'Identify potential issues and improvements'
        ],
        tools: [
          'file-scanner',
          'dependency-analyzer',
          'code-quality-checker',
          'architecture-validator'
        ]
      }
    }
  });
});

// ─── POST /api/assessment/run ─────────────────────────────────────────────
app.post("/api/assessment/run", async (req, res) => {
  const { projectPath } = req.body;
  
  if (!projectPath || typeof projectPath !== 'string') {
    return res.status(400).json({ error: 'projectPath is required' });
  }
  
  try {
    // Check if path exists
    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project path does not exist' });
    }
    
    const assessment = await runProjectAssessment(projectPath);
    res.json({ ok: true, assessment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/workflow/sequence ───────────────────────────────────────────
app.get("/api/workflow/sequence", (req, res) => {
  res.json({
    ok: true,
    sequence: workflowSequence.length > 0 ? workflowSequence : [
      {
        id: 'default-assessment',
        name: 'Project Assessment',
        description: 'Analyze project structure and requirements',
        tools: ['file-scanner', 'dependency-analyzer']
      },
      {
        id: 'default-development',
        name: 'Development',
        description: 'Implement features and fix issues',
        tools: ['code-editor', 'git']
      },
      {
        id: 'default-testing',
        name: 'Testing & Deployment',
        description: 'Test and deploy the project',
        tools: ['test-runner', 'deploy']
      }
    ]
  });
});

// ─── POST /api/workflow/execute-step ──────────────────────────────────────
app.post("/api/workflow/execute-step", requireController, async (req, res) => {
  const { stepId, projectPath } = req.body;
  
  if (!stepId || typeof stepId !== 'string') {
    return res.status(400).json({ error: 'stepId is required' });
  }
  
  try {
    const result = await executeWorkflowStep(stepId, projectPath);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/mcp/status ──────────────────────────────────────────────────
app.get("/api/mcp/status", (req, res) => {
  const status = [];
  
  for (const [id, proc] of mcpProcesses) {
    status.push({
      id,
      pid: proc.pid,
      alive: !proc.killed,
      exitCode: proc.exitCode
    });
  }
  
  res.json({ ok: true, servers: status });
});

// ─── Helper: Run project assessment ───────────────────────────────────────
async function runProjectAssessment(projectPath) {
  const assessment = {
    timestamp: new Date().toISOString(),
    projectPath,
    summary: {},
    findings: [],
    recommendations: []
  };
  
  // 1. Scan project structure
  try {
    const files = await scanProjectStructure(projectPath);
    assessment.summary.fileCount = files.length;
    assessment.summary.projectType = detectProjectType(files);
  } catch (err) {
    assessment.findings.push({
      type: 'error',
      message: `Failed to scan project structure: ${err.message}`,
      severity: 'high'
    });
  }
  
  // 2. Analyze package.json if exists
  const packageJsonPath = path.join(projectPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      assessment.summary.projectName = pkg.name;
      assessment.summary.version = pkg.version;
      assessment.summary.dependencies = Object.keys(pkg.dependencies || {}).length;
      assessment.summary.devDependencies = Object.keys(pkg.devDependencies || {}).length;
      
      // Check for common issues
      if (!pkg.scripts || !pkg.scripts.start) {
        assessment.findings.push({
          type: 'warning',
          message: 'No start script in package.json',
          severity: 'medium',
          recommendation: 'Add a "start" script to package.json'
        });
      }
    } catch (err) {
      assessment.findings.push({
        type: 'error',
        message: `Failed to parse package.json: ${err.message}`,
        severity: 'medium'
      });
    }
  }
  
  // 3. Check for common configuration files
  const configFiles = [
    'tsconfig.json', 'webpack.config.js', 'vite.config.js',
    '.gitignore', '.env', 'dockerfile', 'docker-compose.yml'
  ];
  
  assessment.summary.configFiles = [];
  for (const configFile of configFiles) {
    const configPath = path.join(projectPath, configFile);
    if (fs.existsSync(configPath)) {
      assessment.summary.configFiles.push(configFile);
    }
  }
  
  // 4. Check for tests
  const testDirs = ['tests', '__tests__', 'spec', 'test'];
  let hasTests = false;
  for (const testDir of testDirs) {
    const testPath = path.join(projectPath, testDir);
    if (fs.existsSync(testPath)) {
      hasTests = true;
      break;
    }
  }
  assessment.summary.hasTests = hasTests;
  
  if (!hasTests) {
    assessment.findings.push({
      type: 'warning',
      message: 'No test directory found',
      severity: 'medium',
      recommendation: 'Add tests to improve code quality'
    });
  }
  
  // 5. Generate recommendations based on findings
  if (assessment.findings.length === 0) {
    assessment.recommendations.push({
      type: 'info',
      message: 'Project structure looks good. Ready for development.',
      priority: 'low'
    });
  } else {
    // Sort findings by severity
    assessment.findings.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
    });
    
    // Generate recommendations
    for (const finding of assessment.findings) {
      if (finding.recommendation) {
        assessment.recommendations.push({
          type: finding.type,
          message: finding.recommendation,
          priority: finding.severity
        });
      }
    }
  }
  
  return assessment;
}

// ─── Helper: Scan project structure ───────────────────────────────────────
async function scanProjectStructure(projectPath) {
  const files = [];
  
  function scanDir(dirPath, depth = 0) {
    if (depth > 5) return; // Limit recursion depth
    
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(projectPath, fullPath);
        
        // Skip node_modules, .git, and other large directories
        if (entry.name === 'node_modules' || entry.name === '.git' || 
            entry.name === '.next' || entry.name === 'dist' || 
            entry.name === 'build') {
          continue;
        }
        
        if (entry.isDirectory()) {
          files.push({
            path: relativePath,
            type: 'directory',
            size: 0
          });
          scanDir(fullPath, depth + 1);
        } else {
          try {
            const stats = fs.statSync(fullPath);
            files.push({
              path: relativePath,
              type: 'file',
              size: stats.size,
              extension: path.extname(entry.name).toLowerCase()
            });
          } catch (err) {
            // Skip files we can't stat
          }
        }
      }
    } catch (err) {
      // Skip directories we can't read
    }
  }
  
  scanDir(projectPath);
  return files;
}

// ─── Helper: Detect project type ──────────────────────────────────────────
function detectProjectType(files) {
  const extensions = files.filter(f => f.type === 'file').map(f => f.extension);
  
  if (extensions.includes('.ts') || extensions.includes('.tsx')) {
    return 'TypeScript';
  } else if (extensions.includes('.js') || extensions.includes('.jsx')) {
    return 'JavaScript';
  } else if (extensions.includes('.py')) {
    return 'Python';
  } else if (extensions.includes('.java')) {
    return 'Java';
  } else if (extensions.includes('.cs')) {
    return 'C#';
  } else if (extensions.includes('.go')) {
    return 'Go';
  } else if (extensions.includes('.rs')) {
    return 'Rust';
  }
  
  return 'Unknown';
}

// ─── Helper: Execute workflow step ────────────────────────────────────────
async function executeWorkflowStep(stepId, projectPath) {
  const step = workflowSequence.find(s => s.id === stepId);
  
  if (!step) {
    throw new Error(`Workflow step not found: ${stepId}`);
  }
  
  const result = {
    stepId,
    stepName: step.name,
    startedAt: new Date().toISOString(),
    actions: []
  };
  
  // Execute based on step type
  switch (stepId) {
    case 'assessment':
      result.actions.push({ action: 'run_assessment', status: 'started' });
      const assessment = await runProjectAssessment(projectPath);
      result.assessment = assessment;
      result.actions[0].status = 'completed';
      break;
      
    case 'planning':
      result.actions.push({ action: 'generate_architecture', status: 'started' });
      // Use business logic MCP if available
      result.actions[0].status = 'completed';
      result.architecture = {
        components: ['API Layer', 'Business Logic', 'Database', 'UI'],
        recommendations: ['Use REST API', 'Implement caching', 'Add monitoring']
      };
      break;
      
    case 'backend':
      result.actions.push({ action: 'setup_backend', status: 'started' });
      // Use database and business logic MCPs
      result.actions[0].status = 'completed';
      result.backend = {
        setup: ['Database schema', 'API endpoints', 'Authentication'],
        tools: ['BigBack', 'Business-Logic-MCP']
      };
      break;
      
    case 'frontend':
      result.actions.push({ action: 'setup_frontend', status: 'started' });
      // Use UI MCPs
      result.actions[0].status = 'completed';
      result.frontend = {
        components: ['Layout', 'Navigation', 'Forms', 'Charts'],
        tools: ['OG-Glass', 'Lucide']
      };
      break;
      
    case 'game-animation':
      result.actions.push({ action: 'setup_game_animation', status: 'started' });
      // Use GameAnimation64 MCP
      result.actions[0].status = 'completed';
      result.gameAnimation = {
        features: ['Physics', 'Rendering', 'Animation', 'Audio'],
        tools: ['GameAnimation64']
      };
      break;
      
    case 'voice':
      result.actions.push({ action: 'setup_voice', status: 'started' });
      // Use Voicebox MCP
      result.actions[0].status = 'completed';
      result.voice = {
        features: ['Speech recognition', 'Text-to-speech', 'Voice commands'],
        tools: ['Voicebox']
      };
      break;
      
    default:
      result.actions.push({ 
        action: 'generic_step', 
        status: 'completed',
        message: `Executed step: ${step.name}`
      });
  }
  
  result.completedAt = new Date().toISOString();
  result.duration = new Date(result.completedAt) - new Date(result.startedAt);
  
  return result;
}

// ─── Sales landing page ──────────────────────────────────────────────────
app.get("/sales", (req, res) => {
  const salesPath = path.join(__dirname, "public", "sales.html");
  if (fs.existsSync(salesPath)) {
    res.sendFile(salesPath);
  } else {
    res.status(404).json({ error: "Sales page not found" });
  }
});

// ─── Catch-all: serve index.html for SPA ──────────────────────────────────
app.get("/{*any}", (req, res) => {
  const indexPath = path.join(__dirname, "public", "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res
      .status(404)
      .send("UI not found. Run the build to generate the frontend.");
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────
function scoreCodeBlocks(text) {
  if (!megacode || !megacode.scoreCode) return [];
  const reports = [];
  const regex = /```(?:\w+)?\n([\s\S]*?)```/g;
  let match;
  let idx = 0;
  while ((match = regex.exec(text)) !== null) {
    try {
      const report = megacode.scoreCode(match[1]);
      reports.push({ index: idx++, report });
    } catch (_) {
      // ignore scorer errors
    }
  }
  return reports;
}

// ─── Start ────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║          🔮  MEGACODE  UI  SERVER        ║");
  console.log("╠══════════════════════════════════════════╣");
  console.log(
    `║  http://localhost:${PORT}${" ".repeat(24 - PORT.toString().length)}║`,
  );
  console.log("║  Press Ctrl+C to stop                    ║");
  console.log("╚══════════════════════════════════════════╝");
});
