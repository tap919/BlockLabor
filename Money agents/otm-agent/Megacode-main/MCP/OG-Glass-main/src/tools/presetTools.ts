// ─────────────────────────────────────────────────────────────────────────────
// tools/presetTools.ts  –  Preset management MCP tools
// ─────────────────────────────────────────────────────────────────────────────

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "fs/promises";
import path from "path";
import { loadPreset, listAvailablePresets, invalidateCache } from "../services/presetLoader.js";
import { setActivePreset, getSessionState } from "../services/sessionState.js";
import {
  LoadPresetSchema,
  SwapTemplateSchema,
  ListPresetsSchema,
  DiffPresetsSchema,
  ScaffoldPresetSchema,
  GetSessionStateSchema,
} from "../schemas/toolSchemas.js";
import { PRESETS_DIR, MANIFEST_FILE, TOKENS_FILE } from "../constants.js";
import type { PresetDiff, PresetManifest } from "../types/index.js";

export function registerPresetTools(server: McpServer): void {

  // ── load_preset ─────────────────────────────────────────────────────────────
  server.registerTool(
    "load_preset",
    {
      title: "Load Preset",
      description: `Activate a UI preset bundle by ID. Loads all tokens, component templates, and layout templates.
Resolves inheritance (extends) chain automatically, deep-merging parent tokens.
Must be called before any correction, validation, or generation tools.

Args:
  - preset_id (string): Folder name in /presets (e.g. 'glassmorphic-base', 'client-fintech')
  - force_reload (boolean): Bypass cache and re-read from disk (default: false)

Returns: Preset manifest summary and token count confirmation.
Error: "Preset 'x' not found" if the preset directory doesn't exist.`,
      inputSchema: LoadPresetSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ preset_id, force_reload }) => {
      if (force_reload) invalidateCache(preset_id);
      const preset = await loadPreset(preset_id);
      setActivePreset(preset_id, preset);

      const summary = {
        id: preset.manifest.id,
        name: preset.manifest.name,
        version: preset.manifest.version,
        extends: preset.manifest.extends ?? null,
        componentCount: Object.keys(preset.components).length,
        layoutCount: Object.keys(preset.layouts).length,
        tags: preset.manifest.tags,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
        structuredContent: summary,
      };
    }
  );

  // ── swap_template ───────────────────────────────────────────────────────────
  server.registerTool(
    "swap_template",
    {
      title: "Swap Template",
      description: `Hot-swap the active preset without restarting the server.
Useful for switching between client presets while building.
Optionally preserves any runtime token overrides applied in the current session.

Args:
  - preset_id (string): The preset to switch to
  - preserve_overrides (boolean): Keep current overrides after swap (default: false)

Returns: New active preset summary.`,
      inputSchema: SwapTemplateSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ preset_id, preserve_overrides }) => {
      const previousState = getSessionState();
      const previousOverrides = previousState.overrides;

      const preset = await loadPreset(preset_id);
      setActivePreset(preset_id, preset);

      if (preserve_overrides && Object.keys(previousOverrides).length > 0) {
        const { applyTokenOverrides } = await import("../services/sessionState.js");
        applyTokenOverrides(previousOverrides);
      }

      const result = {
        swappedTo: preset_id,
        previousPreset: previousState.activePresetId,
        overridesPreserved: preserve_overrides,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }
  );

  // ── list_presets ────────────────────────────────────────────────────────────
  server.registerTool(
    "list_presets",
    {
      title: "List Presets",
      description: `List all available presets in the presets directory.
Optionally includes full manifest metadata for each preset.

Args:
  - include_metadata (boolean): Include full manifest for each preset (default: false)

Returns: Array of preset IDs, or array of preset manifests if include_metadata is true.`,
      inputSchema: ListPresetsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ include_metadata }) => {
      const ids = await listAvailablePresets();

      if (!include_metadata) {
        return {
          content: [{ type: "text", text: JSON.stringify(ids) }],
          structuredContent: { presets: ids },
        };
      }

      const manifests = await Promise.all(
        ids.map(async (id) => {
          try {
            const manifestPath = path.join(PRESETS_DIR, id, MANIFEST_FILE);
            const raw = await fs.readFile(manifestPath, "utf-8");
            return JSON.parse(raw) as PresetManifest;
          } catch {
            return { id, error: "Could not load manifest" };
          }
        })
      );

      return {
        content: [{ type: "text", text: JSON.stringify(manifests, null, 2) }],
        structuredContent: { presets: manifests },
      };
    }
  );

  // ── diff_presets ────────────────────────────────────────────────────────────
  server.registerTool(
    "diff_presets",
    {
      title: "Diff Presets",
      description: `Compare two presets and return what changed between them.
Useful for understanding what a client override changes vs the base.

Args:
  - preset_a (string): First preset ID
  - preset_b (string): Second preset ID
  - scope ('tokens' | 'components' | 'layouts' | 'all'): What to compare (default: 'all')

Returns: Object with added, removed, and changed keys with before/after values.`,
      inputSchema: DiffPresetsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ preset_a, preset_b, scope }) => {
      const [a, b] = await Promise.all([loadPreset(preset_a), loadPreset(preset_b)]);

      const diff: PresetDiff = { added: [], removed: [], changed: [] };

      if (scope === "tokens" || scope === "all") {
        diffObjects("tokens", a.tokens, b.tokens, diff);
      }
      if (scope === "components" || scope === "all") {
        diffKeys("components", Object.keys(a.components), Object.keys(b.components), diff);
      }
      if (scope === "layouts" || scope === "all") {
        diffKeys("layouts", Object.keys(a.layouts), Object.keys(b.layouts), diff);
      }

      return {
        content: [{ type: "text", text: JSON.stringify(diff, null, 2) }],
        structuredContent: diff as unknown as Record<string, unknown>,
      };
    }
  );

  // ── get_session_state ───────────────────────────────────────────────────────
  server.registerTool(
    "get_session_state",
    {
      title: "Get Session State",
      description: `Returns the current session state including active preset ID, load time, and any runtime token overrides.

Returns:
  - activePresetId: Currently loaded preset
  - loadedAt: When the preset was activated
  - hasOverrides: Whether runtime overrides are applied
  - overrideKeys: Top-level override keys`,
      inputSchema: GetSessionStateSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const state = getSessionState();
      const summary = {
        activePresetId: state.activePresetId,
        loadedAt: state.loadedAt?.toISOString() ?? null,
        hasOverrides: Object.keys(state.overrides).length > 0,
        overrideKeys: Object.keys(state.overrides),
      };
      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
        structuredContent: summary,
      };
    }
  );

  // ── scaffold_preset ─────────────────────────────────────────────────────────
  server.registerTool(
    "scaffold_preset",
    {
      title: "Scaffold Preset",
      description: `Create a new preset directory with manifest and token override scaffold, inheriting from a parent preset.
Generates a ready-to-customize preset structure on disk.

Args:
  - preset_id (string): Kebab-case ID for the new preset (e.g. 'client-banking')
  - extends (string): Parent preset to inherit from (default: 'glassmorphic-base')
  - name (string): Human-readable display name
  - description (string): Short description
  - accent_color (string, optional): Override accent color in the scaffolded tokens

Returns: Path to new preset directory and files created.`,
      inputSchema: ScaffoldPresetSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ preset_id, extends: extendsId, name, description, accent_color }) => {
      const presetDir = path.join(PRESETS_DIR, preset_id);

      // Check it doesn't already exist
      try {
        await fs.access(presetDir);
        return {
          content: [{
            type: "text",
            text: `Error: Preset '${preset_id}' already exists at ${presetDir}`,
          }],
          structuredContent: { error: "Preset already exists" },
        };
      } catch {
        // doesn't exist — good
      }

      await fs.mkdir(path.join(presetDir, "tokens"), { recursive: true });
      await fs.mkdir(path.join(presetDir, "components"), { recursive: true });
      await fs.mkdir(path.join(presetDir, "layouts"), { recursive: true });

      const manifest: PresetManifest = {
        id: preset_id,
        name,
        description,
        version: "1.0.0",
        extends: extendsId,
        tags: ["custom"],
        components: [],
        layouts: [],
      };

      const tokenOverrides = accent_color
        ? { colors: { accent: { primary: accent_color } } }
        : {};

      await fs.writeFile(
        path.join(presetDir, MANIFEST_FILE),
        JSON.stringify(manifest, null, 2)
      );
      await fs.writeFile(
        path.join(presetDir, TOKENS_FILE),
        JSON.stringify(tokenOverrides, null, 2)
      );

      const result = {
        created: preset_id,
        path: presetDir,
        files: [MANIFEST_FILE, TOKENS_FILE, "components/", "layouts/"],
        inheritsFrom: extendsId,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }
  );
}

// ── Diff helpers ──────────────────────────────────────────────────────────────

function diffObjects(prefix: string, a: unknown, b: unknown, diff: PresetDiff): void {
  const aFlat = flattenForDiff(a, prefix);
  const bFlat = flattenForDiff(b, prefix);

  const allKeys = new Set([...Object.keys(aFlat), ...Object.keys(bFlat)]);
  for (const key of allKeys) {
    if (!(key in aFlat)) {
      diff.added.push(key);
    } else if (!(key in bFlat)) {
      diff.removed.push(key);
    } else if (aFlat[key] !== bFlat[key]) {
      diff.changed.push({ path: key, from: aFlat[key], to: bFlat[key] });
    }
  }
}

function diffKeys(prefix: string, aKeys: string[], bKeys: string[], diff: PresetDiff): void {
  const aSet = new Set(aKeys);
  const bSet = new Set(bKeys);
  bKeys.filter((k) => !aSet.has(k)).forEach((k) => diff.added.push(`${prefix}.${k}`));
  aKeys.filter((k) => !bSet.has(k)).forEach((k) => diff.removed.push(`${prefix}.${k}`));
}

function flattenForDiff(obj: unknown, prefix: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  function walk(o: unknown, p: string) {
    if (typeof o !== "object" || o === null) {
      result[p] = o;
      return;
    }
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      walk(v, `${p}.${k}`);
    }
  }
  walk(obj, prefix);
  return result;
}
