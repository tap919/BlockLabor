// ─────────────────────────────────────────────────────────────────────────────
// schemas/toolSchemas.ts  –  Zod validation schemas for every MCP tool
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

// ── Correction tool schemas ───────────────────────────────────────────────────

export const AutocorrectComponentSchema = {
  code: z.string().max(10_000).describe("React component source code (max 10,000 chars)"),
  context: z
    .enum(["sidebar", "settings", "dashboard", "surface", "navigation", "form", "auto"])
    .default("auto")
    .describe("Component context hint for targeted rules"),
  dry_run: z
    .boolean()
    .default(false)
    .describe("Return issues without changing code"),
};

export const ValidateUISchema = {
  code: z.string().describe("React component source code to validate"),
  include_suggestions: z
    .boolean()
    .default(true)
    .describe("Include info-level suggestions"),
};

export const GenerateComponentSchema = {
  template_name: z
    .string()
    .describe("Component template to generate (e.g. 'GlassCard', 'Sidebar')"),
  props: z
    .record(z.unknown())
    .default({})
    .describe("Props to inject into the template"),
  variant: z.string().optional().describe("Template variant (e.g. 'compact', 'wide')"),
};

export const GenerateTokensSchema = {
  format: z
    .enum(["css", "js", "json", "tailwind"])
    .default("css")
    .describe("Output format for token export"),
  include_comments: z
    .boolean()
    .default(true)
    .describe("Add section headers in output"),
};

export const ApplyTokenOverridesSchema = {
  overrides: z
    .record(z.unknown())
    .describe("Partial DesignTokens object (deeply merged over active tokens)"),
  persist: z
    .boolean()
    .default(false)
    .describe("Write overrides to preset/overrides.json on disk"),
};

// ── Preset management tool schemas ────────────────────────────────────────────

export const LoadPresetSchema = {
  preset_id: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Must be kebab-case")
    .describe("Preset folder name in /presets (e.g. 'glassmorphic-base')"),
  force_reload: z
    .boolean()
    .default(false)
    .describe("Bypass cache and re-read from disk"),
};

export const SwapTemplateSchema = {
  preset_id: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Must be kebab-case")
    .describe("The preset to switch to"),
  preserve_overrides: z
    .boolean()
    .default(false)
    .describe("Keep current overrides after swap"),
};

export const ListPresetsSchema = {
  include_metadata: z
    .boolean()
    .default(false)
    .describe("Include full manifest for each preset"),
};

export const DiffPresetsSchema = {
  preset_a: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Must be kebab-case")
    .describe("First preset ID"),
  preset_b: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Must be kebab-case")
    .describe("Second preset ID"),
  scope: z
    .enum(["tokens", "components", "layouts", "all"])
    .default("all")
    .describe("What to compare"),
};

export const ScaffoldPresetSchema = {
  preset_id: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Must be kebab-case")
    .describe("Kebab-case ID for the new preset"),
  extends: z
    .string()
    .default("glassmorphic-base")
    .describe("Parent preset to inherit from"),
  name: z.string().describe("Human-readable display name"),
  description: z.string().describe("Short description"),
  accent_color: z
    .string()
    .optional()
    .describe("Override accent color in the scaffolded tokens"),
};

export const GetSessionStateSchema = {};

// ── Style tool schemas ────────────────────────────────────────────────────────

export const GenerateColorPaletteSchema = {
  seed_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a 6-digit hex color (e.g. #6366f1)")
    .describe("Seed hex color to generate the palette from"),
  harmony: z
    .enum(["complementary", "triadic", "analogous", "monochromatic", "split-complementary", "tetradic"])
    .default("complementary")
    .describe("Color harmony rule to apply"),
  include_shades: z
    .boolean()
    .default(true)
    .describe("Include 10-step lightness shades (50–900) for the primary color"),
};

export const SuggestStyleSchema = {
  description: z
    .string()
    .min(3)
    .max(500)
    .describe("Natural-language description of the desired aesthetic or use-case (e.g. 'dark hacker terminal', 'friendly kids app')"),
  output_format: z
    .enum(["preset_id", "tokens", "full"])
    .default("full")
    .describe("What to return: just the preset ID, just token overrides, or both with reasoning"),
};

export const ListStyleCategoriesSchema = {
  include_presets: z
    .boolean()
    .default(true)
    .describe("Include the list of preset IDs for each category"),
};
