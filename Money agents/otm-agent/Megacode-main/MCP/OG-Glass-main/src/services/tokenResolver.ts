// ─────────────────────────────────────────────────────────────────────────────
// services/tokenResolver.ts  –  Resolves {{token:x.y.z}} placeholders + export generators
// ─────────────────────────────────────────────────────────────────────────────

import { TOKEN_PATTERN } from "../constants.js";
import type { DesignTokens } from "../types/index.js";

// ── Token placeholder resolver ────────────────────────────────────────────────

type TokenResolutionMode = "raw" | "css-var";

export function resolveTokens(
  template: string,
  tokens: DesignTokens,
  mode: TokenResolutionMode = "raw"
): string {
  return template.replace(TOKEN_PATTERN, (_match, path: string) => {
    const trimmedPath = path.trim();

    if (mode === "css-var") {
      const cssVarName = `--${trimmedPath.replace(/\./g, "-")}`;
      return `var(${cssVarName})`;
    }

    const value = getNestedValue(tokens, trimmedPath);
    return value !== undefined ? String(value) : _match;
  });
}

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current !== null && typeof current === "object") {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

// ── CSS custom properties generator ──────────────────────────────────────────

export function generateCSSVariables(tokens: DesignTokens): string {
  const lines: string[] = [":root {"];

  // Colors
  lines.push("  /* Colors */");
  lines.push(`  --color-bg: ${tokens.colors.base.bg};`);
  lines.push(`  --color-surface: ${tokens.colors.base.surface};`);
  lines.push(`  --color-border: ${tokens.colors.base.border};`);
  lines.push(`  --color-overlay: ${tokens.colors.base.overlay};`);
  for (const [key, val] of Object.entries(tokens.colors.accent)) {
    lines.push(`  --color-accent-${key}: ${val};`);
  }
  lines.push(`  --color-text-primary: ${tokens.colors.text.primary};`);
  lines.push(`  --color-text-secondary: ${tokens.colors.text.secondary};`);
  lines.push(`  --color-text-muted: ${tokens.colors.text.muted};`);
  lines.push(`  --color-text-inverse: ${tokens.colors.text.inverse};`);
  lines.push(`  --color-glass-tint: ${tokens.colors.glass.tint};`);
  lines.push(`  --color-glass-highlight: ${tokens.colors.glass.highlight};`);
  lines.push(`  --color-glass-shadow: ${tokens.colors.glass.shadow};`);

  // Blur
  lines.push("\n  /* Blur */");
  lines.push(`  --blur-none: ${tokens.blur.none};`);
  lines.push(`  --blur-sm: ${tokens.blur.sm};`);
  lines.push(`  --blur-md: ${tokens.blur.md};`);
  lines.push(`  --blur-lg: ${tokens.blur.lg};`);
  lines.push(`  --blur-xl: ${tokens.blur.xl};`);
  for (const [level, val] of Object.entries(tokens.blur.elevation)) {
    lines.push(`  --blur-elevation-${level}: ${val};`);
  }

  // Spacing
  lines.push("\n  /* Spacing */");
  tokens.spacing.scale.forEach((v, i) => lines.push(`  --spacing-${i}: ${v}px;`));
  lines.push(`  --sidebar-width: ${tokens.spacing.sidebar.width};`);
  lines.push(`  --sidebar-collapsed-width: ${tokens.spacing.sidebar.collapsedWidth};`);
  lines.push(`  --sidebar-padding: ${tokens.spacing.sidebar.padding};`);
  lines.push(`  --card-padding: ${tokens.spacing.card.padding};`);
  lines.push(`  --card-gap: ${tokens.spacing.card.gap};`);
  lines.push(`  --card-radius: ${tokens.spacing.card.borderRadius};`);
  if (tokens.spacing.settings) {
    for (const [key, val] of Object.entries(tokens.spacing.settings)) {
      lines.push(`  --settings-${key}: ${val};`);
    }
  }

  // Typography
  lines.push("\n  /* Typography */");
  lines.push(`  --font-display: ${tokens.typography.fontFamily.display};`);
  lines.push(`  --font-body: ${tokens.typography.fontFamily.body};`);
  lines.push(`  --font-mono: ${tokens.typography.fontFamily.mono};`);
  for (const [key, val] of Object.entries(tokens.typography.scale)) {
    lines.push(`  --text-${key}: ${val};`);
  }
  for (const [key, val] of Object.entries(tokens.typography.weight)) {
    lines.push(`  --font-weight-${key}: ${val};`);
  }

  // Animation
  lines.push("\n  /* Animation */");
  for (const [key, val] of Object.entries(tokens.animation.duration)) {
    lines.push(`  --duration-${key}: ${val};`);
  }
  for (const [key, val] of Object.entries(tokens.animation.easing)) {
    lines.push(`  --easing-${key}: ${val};`);
  }
  lines.push(`  --transition-default: ${tokens.animation.transition.default};`);
  lines.push(`  --transition-glass: ${tokens.animation.transition.glass};`);
  lines.push(`  --transition-sidebar: ${tokens.animation.transition.sidebar};`);
  lines.push(`  --transition-settings: ${tokens.animation.transition.settings};`);

  lines.push("}");
  return lines.join("\n");
}

// ── JS/TypeScript token export generator ─────────────────────────────────────

export function generateTokenExport(tokens: DesignTokens): string {
  const json = JSON.stringify(tokens, null, 2);
  return `export const tokens = ${json} as const;\n\nexport type Tokens = typeof tokens;\n`;
}

// ── Tailwind theme.extend generator ──────────────────────────────────────────

export function generateTailwindExtend(tokens: DesignTokens): string {
  const extend = {
    colors: {
      glass: tokens.colors.glass,
      accent: tokens.colors.accent,
      base: tokens.colors.base,
      text: tokens.colors.text,
    },
    borderRadius: {
      card: tokens.spacing.card.borderRadius,
    },
    fontFamily: {
      display: [tokens.typography.fontFamily.display],
      body: [tokens.typography.fontFamily.body],
      mono: [tokens.typography.fontFamily.mono],
    },
    fontSize: tokens.typography.scale,
    fontWeight: Object.fromEntries(
      Object.entries(tokens.typography.weight).map(([k, v]) => [k, String(v)])
    ),
    transitionTimingFunction: tokens.animation.easing,
    transitionDuration: tokens.animation.duration,
  };

  return `// tailwind.config.js – theme.extend\nmodule.exports = {\n  theme: {\n    extend: ${JSON.stringify(extend, null, 4)},\n  },\n};\n`;
}
