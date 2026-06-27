// ─────────────────────────────────────────────────────────────────────────────
// routes/uiRoutes.ts  –  REST API endpoints consumed by the Design Studio UI
// ─────────────────────────────────────────────────────────────────────────────

import type { Express, Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import rateLimit from "express-rate-limit";
import { DASHBOARD_HTML } from "../ui/dashboardHtml.js";
import { listAvailablePresets, loadPreset, invalidateCache } from "../services/presetLoader.js";
import {
  setActivePreset,
  getSessionState,
  getEffectiveTokens,
  applyTokenOverrides,
} from "../services/sessionState.js";
import { validateComponent, correctComponent } from "../services/uiCorrector.js";
import {
  generateCSSVariables,
  generateTokenExport,
  generateTailwindExtend,
  resolveTokens,
} from "../services/tokenResolver.js";
import { PRESETS_DIR, MANIFEST_FILE, TOKENS_FILE } from "../constants.js";
import type { DesignTokens, PresetManifest } from "../types/index.js";
import { STYLE_CATEGORIES_EXPORT, generatePaletteExport } from "../tools/styleTools.js";
import { injectProps } from "../utils/templateUtils.js";

// ── Rate limiter: 20 write requests per minute per IP ─────────────────────────
const writeLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait before trying again." },
});

export function registerUIRoutes(app: Express): void {

  // ── Dashboard page ──────────────────────────────────────────────────────────
  app.get("/", (_req: Request, res: Response): void => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(DASHBOARD_HTML);
  });

  // ── List presets ────────────────────────────────────────────────────────────
  app.get("/api/presets", async (_req: Request, res: Response): Promise<void> => {
    try {
      const ids = await listAvailablePresets();
      const manifests = await Promise.all(
        ids.map(async (id): Promise<PresetManifest | { id: string; name: string; error: string }> => {
          try {
            const raw = await fs.readFile(path.join(PRESETS_DIR, id, MANIFEST_FILE), "utf-8");
            return JSON.parse(raw) as PresetManifest;
          } catch {
            return { id, name: id, error: "Could not load manifest" };
          }
        })
      );
      res.json({ presets: manifests });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── Load a preset ───────────────────────────────────────────────────────────
  app.post("/api/presets/load", writeLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
      const { preset_id, force_reload } = req.body as {
        preset_id: string;
        force_reload?: boolean;
      };
      if (!preset_id || typeof preset_id !== "string") {
        res.status(400).json({ error: "preset_id is required" });
        return;
      }
      if (force_reload) invalidateCache(preset_id);
      const preset = await loadPreset(preset_id);
      setActivePreset(preset_id, preset);
      res.json({
        id: preset.manifest.id,
        name: preset.manifest.name,
        version: preset.manifest.version,
        extends: preset.manifest.extends ?? null,
        componentCount: Object.keys(preset.components).length,
        layoutCount: Object.keys(preset.layouts).length,
        tags: preset.manifest.tags,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── Session state ───────────────────────────────────────────────────────────
  app.get("/api/session", (_req: Request, res: Response): void => {
    const state = getSessionState();
    res.json({
      activePresetId: state.activePresetId,
      loadedAt: state.loadedAt?.toISOString() ?? null,
      hasOverrides: Object.keys(state.overrides).length > 0,
      overrideKeys: Object.keys(state.overrides),
    });
  });

  // ── Effective tokens ────────────────────────────────────────────────────────
  app.get("/api/tokens", (_req: Request, res: Response): void => {
    try {
      const tokens = getEffectiveTokens();
      res.json(tokens);
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  // ── Export tokens ───────────────────────────────────────────────────────────
  app.post("/api/tokens/export", writeLimiter, (req: Request, res: Response): void => {
    try {
      const { format } = req.body as { format?: string };
      const tokens = getEffectiveTokens();
      const requestedFormat = typeof format === "string" ? format : undefined;
      const effectiveFormat =
        requestedFormat === "css" ||
        requestedFormat === "js" ||
        requestedFormat === "tailwind"
          ? requestedFormat
          : "json";
      let output: string;
      switch (effectiveFormat) {
        case "css":
          output = generateCSSVariables(tokens);
          break;
        case "js":
          output = generateTokenExport(tokens);
          break;
        case "tailwind":
          output = generateTailwindExtend(tokens);
          break;
        case "json":
        default:
          output = JSON.stringify(tokens, null, 2);
      }
      res.json({ format: effectiveFormat, output });
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  // ── Apply token overrides ───────────────────────────────────────────────────
  app.post("/api/tokens/overrides", writeLimiter, (req: Request, res: Response): void => {
    try {
      const { overrides } = req.body as { overrides?: Partial<DesignTokens> };
      if (!overrides || typeof overrides !== "object") {
        res.status(400).json({ error: "overrides object is required" });
        return;
      }
      const state = getSessionState();
      if (!state.activePreset) {
        res.status(400).json({ error: "No active preset. Load a preset first." });
        return;
      }
      applyTokenOverrides(overrides);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  // ── Validate component ──────────────────────────────────────────────────────
  app.post("/api/validate", writeLimiter, (req: Request, res: Response): void => {
    try {
      const { code, include_suggestions = true } = req.body as {
        code?: string;
        include_suggestions?: boolean;
      };
      if (!code || typeof code !== "string") {
        res.status(400).json({ error: "code is required" });
        return;
      }
      const state = getSessionState();
      if (!state.activePreset) {
        res.status(400).json({ error: "No active preset. Load a preset first." });
        return;
      }
      const tokens = getEffectiveTokens();
      let result = validateComponent(code, state.activePreset, tokens);
      if (!include_suggestions) {
        result = { ...result, issues: result.issues.filter((i) => i.severity !== "info") };
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── Autocorrect component ───────────────────────────────────────────────────
  app.post("/api/correct", writeLimiter, (req: Request, res: Response): void => {
    try {
      const { code, context, dry_run = false } = req.body as {
        code?: string;
        context?: string;
        dry_run?: boolean;
      };
      if (!code || typeof code !== "string") {
        res.status(400).json({ error: "code is required" });
        return;
      }
      const state = getSessionState();
      if (!state.activePreset) {
        res.status(400).json({ error: "No active preset. Load a preset first." });
        return;
      }
      const tokens = getEffectiveTokens();
      if (dry_run) {
        res.json(validateComponent(code, state.activePreset, tokens));
        return;
      }
      res.json(correctComponent(code, state.activePreset, tokens, context === "auto" ? undefined : context));
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── Scaffold preset ─────────────────────────────────────────────────────────
  app.post("/api/scaffold", writeLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        preset_id,
        name,
        description = "",
        extends: extendsId = "glassmorphic-base",
        accent_color,
      } = req.body as {
        preset_id?: string;
        name?: string;
        description?: string;
        extends?: string;
        accent_color?: string;
      };

      if (!preset_id || typeof preset_id !== "string" || !name || typeof name !== "string") {
        res.status(400).json({ error: "preset_id and name are required" });
        return;
      }

      // Validate kebab-case format
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(preset_id)) {
        res.status(400).json({ error: "preset_id must be kebab-case (e.g. client-mybrand)" });
        return;
      }

      // Validate accent color format if provided (e.g. "#RRGGBB")
      if (accent_color && !/^#[0-9a-fA-F]{6}$/.test(accent_color)) {
        res.status(400).json({ error: "accent_color must be a valid hex color (e.g. #3366ff)" });
        return;
      }

      // Validate that the base preset we extend from exists / is loadable
      try {
        await loadPreset(extendsId);
      } catch {
        res.status(400).json({ error: `Unknown extends preset '${extendsId}'` });
        return;
      }
      const presetDir = path.join(PRESETS_DIR, preset_id);

      // Create the preset root directory; catch EEXIST to detect duplicates atomically
      try {
        await fs.mkdir(presetDir, { recursive: false });
      } catch (mkdirErr) {
        const nodeErr = mkdirErr as NodeJS.ErrnoException;
        if (nodeErr.code === "EEXIST") {
          res.status(409).json({ error: `Preset '${preset_id}' already exists` });
          return;
        }
        throw mkdirErr;
      }

      await fs.mkdir(path.join(presetDir, "tokens"),     { recursive: true });
      await fs.mkdir(path.join(presetDir, "components"), { recursive: true });
      await fs.mkdir(path.join(presetDir, "layouts"),    { recursive: true });

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

      await fs.writeFile(path.join(presetDir, MANIFEST_FILE), JSON.stringify(manifest, null, 2));
      await fs.writeFile(path.join(presetDir, TOKENS_FILE),   JSON.stringify(tokenOverrides, null, 2));

      res.json({ created: preset_id, path: preset_id, inheritsFrom: extendsId });
    } catch (err) {
      // Clean up any partially-created preset directory to avoid leaving invalid state on disk
      const presetId = (req.body as { preset_id?: string } | undefined)?.preset_id ?? "";
      const presetDirForCleanup = path.join(PRESETS_DIR, presetId);
      if (presetDirForCleanup && presetDirForCleanup !== PRESETS_DIR) {
        try {
          await fs.rm(presetDirForCleanup, { recursive: true, force: true });
        } catch {
          // best-effort cleanup; ignore secondary errors
        }
      }
      res.status(500).json({ error: String(err) });
    }
  });

  // ── Style categories ────────────────────────────────────────────────────────
  app.get("/api/styles", (_req: Request, res: Response): void => {
    res.json({ categories: STYLE_CATEGORIES_EXPORT, total: STYLE_CATEGORIES_EXPORT.length });
  });

  // ── Color palette generator ─────────────────────────────────────────────────
  app.post("/api/palette", writeLimiter, (req: Request, res: Response): void => {
    try {
      const { seed_color, harmony = "complementary", include_shades = true } = req.body as {
        seed_color?: string;
        harmony?: string;
        include_shades?: boolean;
      };

      if (!seed_color || typeof seed_color !== "string") {
        res.status(400).json({ error: "seed_color is required" });
        return;
      }
      if (!/^#[0-9a-fA-F]{6}$/.test(seed_color)) {
        res.status(400).json({ error: "seed_color must be a 6-digit hex color (e.g. #6366f1)" });
        return;
      }

      const validHarmonies = ["complementary", "triadic", "analogous", "monochromatic", "split-complementary", "tetradic"];
      if (!validHarmonies.includes(harmony)) {
        res.status(400).json({ error: `harmony must be one of: ${validHarmonies.join(", ")}` });
        return;
      }

      const palette = generatePaletteExport(seed_color, harmony, Boolean(include_shades));
      res.json(palette);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── List components ─────────────────────────────────────────────────────────
  app.get("/api/components", (_req: Request, res: Response): void => {
    try {
      const state = getSessionState();
      if (!state.activePreset) {
        res.status(400).json({ error: "No active preset. Load a preset first." });
        return;
      }
      const components = Object.values(state.activePreset.components).map((t) => ({
        name: t.name,
        category: t.category,
        description: t.description,
        variants: Object.keys(t.variants ?? {}),
        props: Object.keys(t.propsSchema),
      }));
      res.json({ components });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── List layouts ────────────────────────────────────────────────────────────
  app.get("/api/layouts", (_req: Request, res: Response): void => {
    try {
      const state = getSessionState();
      if (!state.activePreset) {
        res.status(400).json({ error: "No active preset. Load a preset first." });
        return;
      }
      const layouts = Object.values(state.activePreset.layouts).map((l) => ({
        name: l.name,
        description: l.description,
        regions: l.regions,
      }));
      res.json({ layouts });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── Generate component ──────────────────────────────────────────────────────
  app.post("/api/components/generate", writeLimiter, (req: Request, res: Response): void => {
    try {
      const { template_name, props = {}, variant } = req.body as {
        template_name?: string;
        props?: Record<string, unknown>;
        variant?: string;
      };
      if (!template_name || typeof template_name !== "string") {
        res.status(400).json({ error: "template_name is required" });
        return;
      }
      const state = getSessionState();
      if (!state.activePreset) {
        res.status(400).json({ error: "No active preset. Load a preset first." });
        return;
      }
      const template = state.activePreset.components[template_name];
      if (!template) {
        const available = Object.keys(state.activePreset.components).join(", ");
        res.status(404).json({
          error: `Template '${template_name}' not found. Available: ${available}`,
        });
        return;
      }
      const tokens = getEffectiveTokens();
      // Validate variant exists when specified
      if (variant !== undefined && !template.variants?.[variant]) {
        const availableVariants = Object.keys(template.variants ?? {});
        res.status(400).json({
          error: `Variant '${variant}' not found in template '${template_name}'. Available variants: ${availableVariants.length ? availableVariants.join(", ") : "none"}`,
        });
        return;
      }
      const activeTemplate =
        variant && template.variants?.[variant]
          ? { ...template, ...template.variants[variant] }
          : template;
      let code = resolveTokens(activeTemplate.template, tokens);
      const safeProps = typeof props === "object" && props !== null ? props : {};
      code = injectProps(code, safeProps);
      res.json({
        code,
        templateUsed: template_name,
        variant: variant ?? "default",
        availableProps: activeTemplate.propsSchema,
        availableVariants: Object.keys(template.variants ?? {}),
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}
