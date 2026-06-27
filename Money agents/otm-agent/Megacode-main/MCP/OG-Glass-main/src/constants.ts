// ─────────────────────────────────────────────────────────────────────────────
// constants.ts  –  Shared constants and paths
// ─────────────────────────────────────────────────────────────────────────────

import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Paths ─────────────────────────────────────────────────────────────────────

export const PRESETS_DIR = path.resolve(__dirname, "../presets");
export const MANIFEST_FILE = "manifest.json";
export const TOKENS_FILE = "tokens.json";

// ── Regex patterns ────────────────────────────────────────────────────────────

// Matches hardcoded CSS color values: hex (#fff, #ffffff, #ffffffcc), rgb(), rgba(), hsl(), hsla()
export const FORBIDDEN_HARDCODED_COLORS: RegExp =
  /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|(?:rgb|rgba|hsl|hsla)\s*\([^)]+\)/g;

// Matches hardcoded pixel values in style props (e.g. "16px", "24px")
// but not inside var() references
export const FORBIDDEN_HARDCODED_PIXELS: RegExp =
  /(?<![a-zA-Z(])\d+px(?!\s*[);,]?\s*var\()/g;

// Matches token placeholder syntax: {{token:colors.base.bg}}
export const TOKEN_PATTERN: RegExp = /\{\{token:([^}]+)\}\}/g;
