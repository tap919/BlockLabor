// ─────────────────────────────────────────────────────────────────────────────
// services/presetLoader.ts  –  Reads + deep-merges preset files with caching
// ─────────────────────────────────────────────────────────────────────────────

import fs from "fs/promises";
import path from "path";
import deepmerge from "deepmerge";
import { PRESETS_DIR, MANIFEST_FILE, TOKENS_FILE } from "../constants.js";
import type { Preset, PresetManifest, DesignTokens, ComponentTemplate, LayoutTemplate } from "../types/index.js";

// ── In-memory cache ───────────────────────────────────────────────────────────

const cache = new Map<string, Preset>();

export function invalidateCache(presetId: string): void {
  cache.delete(presetId);
}

// ── Main loader ───────────────────────────────────────────────────────────────

export async function loadPreset(
  presetId: string,
  _visitedIds: ReadonlySet<string> = new Set()
): Promise<Preset> {
  if (cache.has(presetId)) {
    return cache.get(presetId)!;
  }

  const preset = await readPresetFromDisk(presetId, _visitedIds);
  cache.set(presetId, preset);
  return preset;
}

export async function listAvailablePresets(): Promise<string[]> {
  try {
    const entries = await fs.readdir(PRESETS_DIR, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

// ── Disk reader ───────────────────────────────────────────────────────────────

async function readPresetFromDisk(
  presetId: string,
  visitedIds: ReadonlySet<string> = new Set()
): Promise<Preset> {
  const presetsRoot = path.resolve(PRESETS_DIR);
  const presetDir = path.resolve(presetsRoot, presetId);

  // Ensure the resolved preset directory is within the presets root to prevent path traversal
  if (!presetDir.startsWith(presetsRoot + path.sep)) {
    throw new Error(`Invalid preset ID '${presetId}'`);
  }
  // Check directory exists
  try {
    await fs.access(presetDir);
  } catch {
    throw new Error(`Preset '${presetId}' not found at ${presetDir}`);
  }

  // Load manifest
  const manifestPath = path.join(presetDir, MANIFEST_FILE);
  const manifestRaw = await fs.readFile(manifestPath, "utf-8");
  const manifest = JSON.parse(manifestRaw) as PresetManifest;

  // Load own tokens
  const tokensPath = path.join(presetDir, TOKENS_FILE);
  let ownTokens: Partial<DesignTokens> = {};
  try {
    const tokensRaw = await fs.readFile(tokensPath, "utf-8");
    ownTokens = JSON.parse(tokensRaw) as Partial<DesignTokens>;
  } catch {
    // No tokens file — ok for child presets
  }

  // Resolve parent tokens (inheritance chain)
  let tokens: DesignTokens;
  if (manifest.extends) {
    if (visitedIds.has(manifest.extends)) {
      throw new Error(
        `Circular preset inheritance detected: '${manifest.extends}' is already in the chain [${[...visitedIds].join(" → ")}]`
      );
    }
    const nextVisited = new Set([...visitedIds, presetId]);
    const parent = await loadPreset(manifest.extends, nextVisited);
    tokens = deepmerge(parent.tokens, ownTokens as DesignTokens, {
      arrayMerge: (_dst, src) => src,
    });
  } else {
    tokens = ownTokens as DesignTokens;
  }

  // Load components — scan all subdirectories dynamically
  const components: Record<string, ComponentTemplate> = {};
  const componentsRoot = path.join(presetDir, "components");
  try {
    const categoryEntries = await fs.readdir(componentsRoot, { withFileTypes: true });
    const categoryDirs = categoryEntries
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    for (const dir of categoryDirs) {
      const dirPath = path.join(componentsRoot, dir);
      const files = await fs.readdir(dirPath);
      for (const file of files.filter((f) => f.endsWith(".json"))) {
        const raw = await fs.readFile(path.join(dirPath, file), "utf-8");
        const template = JSON.parse(raw) as ComponentTemplate;
        components[template.name] = template;
      }
    }
  } catch {
    // No components directory — ok
  }

  // Inherit parent components if extends
  if (manifest.extends) {
    const nextVisited = new Set([...visitedIds, presetId]);
    const parent = await loadPreset(manifest.extends, nextVisited);
    for (const [name, template] of Object.entries(parent.components)) {
      if (!(name in components)) {
        components[name] = template;
      }
    }
  }

  // Load layouts
  const layouts: Record<string, LayoutTemplate> = {};
  const layoutsDir = path.join(presetDir, "layouts");
  try {
    const files = await fs.readdir(layoutsDir);
    for (const file of files.filter((f) => f.endsWith(".json"))) {
      const raw = await fs.readFile(path.join(layoutsDir, file), "utf-8");
      const layout = JSON.parse(raw) as LayoutTemplate;
      layouts[layout.name] = layout;
    }
  } catch {
    // No layouts directory
  }

  // Inherit parent layouts if extends
  if (manifest.extends) {
    const nextVisited = new Set([...visitedIds, presetId]);
    const parent = await loadPreset(manifest.extends, nextVisited);
    for (const [name, layout] of Object.entries(parent.layouts)) {
      if (!(name in layouts)) {
        layouts[name] = layout;
      }
    }
  }

  return { manifest, tokens, components, layouts };
}
