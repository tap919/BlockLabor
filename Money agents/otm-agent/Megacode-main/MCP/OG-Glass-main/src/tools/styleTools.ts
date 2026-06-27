// ─────────────────────────────────────────────────────────────────────────────
// tools/styleTools.ts  –  Style generation, palette, and suggestion MCP tools
// ─────────────────────────────────────────────────────────────────────────────

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  GenerateColorPaletteSchema,
  SuggestStyleSchema,
  ListStyleCategoriesSchema,
} from "../schemas/toolSchemas.js";

// ── Style category registry ───────────────────────────────────────────────────

interface StyleCategory {
  id: string;
  name: string;
  description: string;
  principles: string[];
  presets: string[];
  keywords: string[];
}

const STYLE_CATEGORIES: StyleCategory[] = [
  {
    id: "glassmorphic",
    name: "Glassmorphic",
    description: "Frosted-glass surfaces with backdrop blur, translucent layers, and soft highlights on a dark substrate. Modern SaaS and fintech staple.",
    principles: ["backdrop-blur", "translucency", "dark-substrate", "soft-borders", "layered-depth"],
    presets: ["glassmorphic-base", "client-fintech", "client-saas", "client-dark-minimal"],
    keywords: ["glass", "blur", "frosted", "dark", "translucent", "modern", "saas", "fintech", "dashboard", "admin"],
  },
  {
    id: "neumorphic",
    name: "Neumorphic",
    description: "Soft extruded shapes cast from a light monochromatic background using dual-shadow technique. No glass, no blur — depth through shadows alone.",
    principles: ["depth-through-shadow", "soft-extrusion", "monochromatic-light", "no-harsh-borders"],
    presets: ["style-neumorphic"],
    keywords: ["neumorphic", "soft ui", "soft", "light", "shadow", "extrude", "extruded", "clay", "emboss", "3d"],
  },
  {
    id: "cyberpunk",
    name: "Neon Cyberpunk",
    description: "Pitch-dark background with vivid neon accents, monospace typography, and glowing outlines. High-tech, dystopian, hacker aesthetic.",
    principles: ["neon-glow", "dark-substrate", "monospace-first", "high-contrast", "electric-accents"],
    presets: ["style-neon-cyberpunk"],
    keywords: ["neon", "cyber", "cyberpunk", "hacker", "terminal", "matrix", "retro", "glow", "electric", "tech", "sci-fi", "futuristic", "dark tech"],
  },
  {
    id: "brutalist",
    name: "Brutalist",
    description: "Raw, functional, zero-decoration design. Stark black on white, hard edges, no border-radius, heavy typography. Structure is the aesthetic.",
    principles: ["form-follows-function", "zero-decoration", "maximum-contrast", "heavy-type", "visible-structure"],
    presets: ["style-brutalist"],
    keywords: ["brutalist", "brutal", "raw", "stark", "bold", "black white", "minimal", "functional", "newspaper", "editorial", "print"],
  },
  {
    id: "pastel",
    name: "Soft Pastel",
    description: "Light lavender-tinted backgrounds with pastel purple and pink accents. Generous rounding, gentle contrast, and a friendly approachable feel.",
    principles: ["soft-color-harmony", "generous-rounding", "gentle-contrast", "airy-spacing", "approachable-tone"],
    presets: ["style-soft-pastel"],
    keywords: ["pastel", "soft", "dreamy", "pink", "purple", "gentle", "friendly", "cute", "kawaii", "kids", "playful", "light", "feminine", "lavender"],
  },
  {
    id: "aurora",
    name: "Aurora Gradient",
    description: "Deep navy substrate with iridescent aurora-inspired accents — purples, greens, and teals layered with rich glassmorphic depth.",
    principles: ["aurora-color-palette", "deep-dark-substrate", "iridescent-accents", "layered-depth", "natural-gradients"],
    presets: ["style-aurora"],
    keywords: ["aurora", "gradient", "rainbow", "iridescent", "colorful", "vibrant", "night sky", "cosmic", "space", "galaxy", "borealis", "northern lights"],
  },
];

// ── Color math utilities ──────────────────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, Math.round(l * 100)];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let hue: number;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) hue = ((b - r) / d + 2) / 6;
  else hue = ((r - g) / d + 4) / 6;

  return [Math.round(hue * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s));
  l = Math.max(0, Math.min(100, l));

  const sn = s / 100;
  const ln = l / 100;

  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;

  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }

  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function generateShades(h: number, s: number): Record<string, string> {
  return {
    "50":  hslToHex(h, Math.max(s - 15, 10), 97),
    "100": hslToHex(h, Math.max(s - 10, 15), 93),
    "200": hslToHex(h, s,                    86),
    "300": hslToHex(h, s,                    74),
    "400": hslToHex(h, s,                    62),
    "500": hslToHex(h, s,                    50),
    "600": hslToHex(h, Math.min(s + 5, 100), 42),
    "700": hslToHex(h, Math.min(s + 8, 100), 34),
    "800": hslToHex(h, Math.min(s + 10, 100), 26),
    "900": hslToHex(h, Math.min(s + 12, 100), 18),
  };
}

function buildPalette(
  seed: string,
  harmony: string,
  includeShades: boolean
): Record<string, unknown> {
  const [h, s, l] = hexToHsl(seed);

  const harmonyColors: Record<string, string> = {};

  switch (harmony) {
    case "complementary":
      harmonyColors.primary = seed;
      harmonyColors.complement = hslToHex(((h + 180) % 360), s, l);
      break;

    case "triadic":
      harmonyColors.primary   = seed;
      harmonyColors.secondary = hslToHex((h + 120) % 360, s, l);
      harmonyColors.tertiary  = hslToHex((h + 240) % 360, s, l);
      break;

    case "analogous":
      harmonyColors.left    = hslToHex(((h - 30 + 360) % 360), s, l);
      harmonyColors.primary = seed;
      harmonyColors.right   = hslToHex((h + 30) % 360, s, l);
      break;

    case "monochromatic":
      harmonyColors.lightest = hslToHex(h, Math.max(s - 20, 5),  Math.min(l + 30, 95));
      harmonyColors.light    = hslToHex(h, Math.max(s - 10, 10), Math.min(l + 15, 90));
      harmonyColors.primary  = seed;
      harmonyColors.dark     = hslToHex(h, Math.min(s + 10, 100), Math.max(l - 15, 10));
      harmonyColors.darkest  = hslToHex(h, Math.min(s + 20, 100), Math.max(l - 30, 5));
      break;

    case "split-complementary":
      harmonyColors.primary        = seed;
      harmonyColors.splitLeft      = hslToHex((h + 150) % 360, s, l);
      harmonyColors.splitRight     = hslToHex((h + 210) % 360, s, l);
      break;

    case "tetradic":
      harmonyColors.primary   = seed;
      harmonyColors.secondary = hslToHex((h + 90) % 360,  s, l);
      harmonyColors.tertiary  = hslToHex((h + 180) % 360, s, l);
      harmonyColors.quaternary = hslToHex((h + 270) % 360, s, l);
      break;

    default:
      harmonyColors.primary = seed;
  }

  // Always add semantic aliases
  const semantic = {
    foreground: l > 50 ? hslToHex(h, Math.min(s + 10, 100), Math.max(l - 45, 10))
                       : hslToHex(h, Math.max(s - 10, 5),   Math.min(l + 45, 95)),
    background: l > 50 ? hslToHex(h, Math.max(s - 30, 5), Math.min(l + 25, 98))
                       : hslToHex(h, Math.max(s - 30, 5), Math.max(l - 25, 5)),
    muted:      hslToHex(h, Math.max(s - 25, 5), l > 50 ? 88 : 25),
    surface:    hslToHex(h, Math.max(s - 30, 5), l > 50 ? 96 : 12),
  };

  const result: Record<string, unknown> = {
    seed,
    hsl: { h, s, l },
    harmony,
    colors: harmonyColors,
    semantic,
  };

  if (includeShades) {
    result.shades = generateShades(h, s);
  }

  return result;
}

// ── Keyword matching for suggest_style ───────────────────────────────────────

function suggestFromDescription(description: string): {
  category: StyleCategory;
  presetId: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  tokenSuggestions: Record<string, unknown>;
} {
  const lower = description.toLowerCase();
  const scores = STYLE_CATEGORIES.map((cat) => {
    const matches = cat.keywords.filter((kw) => lower.includes(kw)).length;
    return { cat, matches };
  });

  scores.sort((a, b) => b.matches - a.matches);
  const best = scores[0];

  const category = best.cat;
  const presetId = category.presets[0];
  const confidence: "high" | "medium" | "low" =
    best.matches >= 3 ? "high" : best.matches >= 1 ? "medium" : "low";

  const reasoning =
    best.matches > 0
      ? `Matched ${best.matches} keyword(s) from the "${category.name}" style category: ${category.keywords.filter((kw) => lower.includes(kw)).join(", ")}.`
      : `No strong keyword match found. Defaulting to "${category.name}" as a general-purpose starting point.`;

  // Build token suggestion snippets based on category
  const tokenSuggestions: Record<string, unknown> = {
    preset_id: presetId,
    suggested_overrides: buildCategoryOverrides(category.id),
  };

  return { category, presetId, confidence, reasoning, tokenSuggestions };
}

function buildCategoryOverrides(categoryId: string): Record<string, unknown> {
  switch (categoryId) {
    case "glassmorphic":
      return { colors: { base: { bg: "#0a0d14" } }, blur: { md: "blur(12px)" } };
    case "neumorphic":
      return { colors: { base: { bg: "#e0e5ec" } }, blur: { md: "blur(0px)" } };
    case "cyberpunk":
      return { colors: { base: { bg: "#050510" }, accent: { primary: "#00ff88" } } };
    case "brutalist":
      return { colors: { base: { bg: "#ffffff", border: "rgba(0,0,0,0.9)" } }, blur: { md: "blur(0px)" } };
    case "pastel":
      return { colors: { base: { bg: "#fef7ff" }, accent: { primary: "#c084fc" } } };
    case "aurora":
      return { colors: { base: { bg: "#04081a" }, accent: { primary: "#a78bfa", secondary: "#34d399" } } };
    default:
      return {};
  }
}

// ── Public exports for REST API ───────────────────────────────────────────────

export const STYLE_CATEGORIES_EXPORT = STYLE_CATEGORIES.map((cat) => ({
  id: cat.id,
  name: cat.name,
  description: cat.description,
  principles: cat.principles,
  presets: cat.presets,
  keywords: cat.keywords.slice(0, 6),
}));

export function generatePaletteExport(
  seedColor: string,
  harmony: string,
  includeShades: boolean
): Record<string, unknown> {
  return buildPalette(seedColor, harmony, includeShades);
}

// ── Tool registrations ────────────────────────────────────────────────────────

export function registerStyleTools(server: McpServer): void {

  // ── generate_color_palette ──────────────────────────────────────────────────
  server.registerTool(
    "generate_color_palette",
    {
      title: "Generate Color Palette",
      description: `Generate a harmonious color palette from a seed hex color using color theory.

Args:
  - seed_color (string): 6-digit hex color (e.g. '#6366f1')
  - harmony ('complementary'|'triadic'|'analogous'|'monochromatic'|'split-complementary'|'tetradic'): Color harmony rule (default: 'complementary')
  - include_shades (boolean): Include 10-step lightness shades 50–900 (default: true)

Returns:
  - seed: Input color
  - hsl: Hue, saturation, lightness of seed
  - harmony: Harmony type used
  - colors: Named harmony colors (primary, complement, etc.)
  - semantic: foreground, background, muted, surface aliases
  - shades: 50–900 shade scale (if include_shades is true)

Use the result to populate apply_token_overrides or scaffold_preset.`,
      inputSchema: GenerateColorPaletteSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ seed_color, harmony, include_shades }) => {
      const palette = buildPalette(seed_color, harmony, include_shades);
      return {
        content: [{ type: "text", text: JSON.stringify(palette, null, 2) }],
        structuredContent: palette,
      };
    }
  );

  // ── suggest_style ───────────────────────────────────────────────────────────
  server.registerTool(
    "suggest_style",
    {
      title: "Suggest Style",
      description: `Get a style preset and token override suggestions based on a natural-language aesthetic description.

Args:
  - description (string): Describe the desired look and feel (e.g. 'dark hacker terminal', 'friendly pastel kids app', 'professional fintech dashboard')
  - output_format ('preset_id'|'tokens'|'full'): What to return (default: 'full')
    - preset_id: Just the best matching preset ID
    - tokens: Just the suggested token overrides
    - full: Preset ID, token overrides, category info, and reasoning

Returns matching preset and style suggestions.`,
      inputSchema: SuggestStyleSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ description, output_format }) => {
      const suggestion = suggestFromDescription(description);

      let result: Record<string, unknown>;

      switch (output_format) {
        case "preset_id":
          result = { preset_id: suggestion.presetId };
          break;
        case "tokens":
          result = { overrides: suggestion.tokenSuggestions.suggested_overrides };
          break;
        case "full":
        default:
          result = {
            preset_id: suggestion.presetId,
            category: {
              id: suggestion.category.id,
              name: suggestion.category.name,
              description: suggestion.category.description,
              principles: suggestion.category.principles,
            },
            confidence: suggestion.confidence,
            reasoning: suggestion.reasoning,
            suggested_overrides: suggestion.tokenSuggestions.suggested_overrides,
            next_steps: [
              `load_preset("${suggestion.presetId}")`,
              `apply_token_overrides({ overrides: <suggested_overrides> })`,
              `scaffold_preset({ preset_id: "my-brand", extends: "${suggestion.presetId}" })`,
            ],
          };
          break;
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }
  );

  // ── list_style_categories ───────────────────────────────────────────────────
  server.registerTool(
    "list_style_categories",
    {
      title: "List Style Categories",
      description: `List all available design style categories with descriptions, design principles, and associated presets.

Args:
  - include_presets (boolean): Include preset IDs for each category (default: true)

Returns: Array of style categories with metadata. Use with suggest_style and load_preset to explore the design system.`,
      inputSchema: ListStyleCategoriesSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ include_presets }) => {
      const categories = STYLE_CATEGORIES.map((cat) => {
        const entry: Record<string, unknown> = {
          id: cat.id,
          name: cat.name,
          description: cat.description,
          principles: cat.principles,
          keywords: cat.keywords.slice(0, 6), // return top keywords only
        };
        if (include_presets) {
          entry.presets = cat.presets;
        }
        return entry;
      });

      const result = { categories, total: categories.length };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }
  );
}
