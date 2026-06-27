// ─────────────────────────────────────────────────────────────────────────────
// services/uiCorrector.ts  –  AST-based React component correction engine
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CorrectionResult,
  ValidationResult,
  UIIssue,
  DesignTokens,
  Preset,
} from "../types/index.js";
import {
  FORBIDDEN_HARDCODED_COLORS,
  FORBIDDEN_HARDCODED_PIXELS,
  TOKEN_PATTERN,
} from "../constants.js";

// ── Main correction entry point ───────────────────────────────────────────────

export function correctComponent(
  code: string,
  preset: Preset,
  tokens: DesignTokens,
  context?: string
): CorrectionResult {
  const issues: UIIssue[] = [];
  const appliedFixes: string[] = [];
  let corrected = code;

  // Run all correction passes in order
  corrected = pass_replaceHardcodedColors(corrected, tokens, issues, appliedFixes);
  corrected = pass_replaceHardcodedSpacing(corrected, tokens, issues, appliedFixes);
  corrected = pass_enforceGlassSurfaces(corrected, tokens, issues, appliedFixes);
  corrected = pass_enforceTypographyTokens(corrected, tokens, issues, appliedFixes);
  corrected = pass_enforceAnimationTokens(corrected, tokens, issues, appliedFixes);
  corrected = pass_enforceSidebarStructure(corrected, preset, issues, appliedFixes, context);
  corrected = pass_enforceSettingsPattern(corrected, preset, issues, appliedFixes, context);
  corrected = pass_injectMissingImports(corrected, issues, appliedFixes);

  return {
    original: code,
    corrected,
    issues,
    appliedFixes,
    presetUsed: preset.manifest.id,
    timestamp: new Date().toISOString(),
  };
}

export function validateComponent(code: string, preset: Preset, tokens: DesignTokens): ValidationResult {
  const issues: UIIssue[] = [];

  // Run validation-only checks (no code modification)
  check_hardcodedColors(code, issues);
  check_hardcodedSpacing(code, issues);
  check_glassSurfaces(code, tokens, issues);
  check_typographyConformance(code, tokens, issues);
  check_settingsPatternConformance(code, preset, issues);
  check_sidebarConformance(code, preset, issues);
  check_accessibilityBasics(code, issues);

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const score = Math.max(0, 100 - errorCount * 15 - warningCount * 5);

  return {
    valid: errorCount === 0,
    issues,
    score,
    presetUsed: preset.manifest.id,
  };
}

// ── Correction passes ─────────────────────────────────────────────────────────

function pass_replaceHardcodedColors(
  code: string,
  tokens: DesignTokens,
  issues: UIIssue[],
  fixes: string[]
): string {
  let result = code;
  const matches = [...code.matchAll(FORBIDDEN_HARDCODED_COLORS)];

  for (const match of matches) {
    issues.push({
      severity: "error",
      rule: "no-hardcoded-colors",
      message: `Hardcoded color value found: "${match[0]}". Use design tokens instead.`,
      fix: "Replace with CSS custom property from token system",
    });

    // Replace common hardcoded patterns with token variables
    result = result.replace(
      match[0],
      suggestColorToken(match[0], tokens)
    );
    fixes.push(`Replaced hardcoded color with token: ${match[0]}`);
  }

  return result;
}

function pass_replaceHardcodedSpacing(
  code: string,
  tokens: DesignTokens,
  issues: UIIssue[],
  fixes: string[]
): string {
  let result = code;
  const matches = [...code.matchAll(FORBIDDEN_HARDCODED_PIXELS)];

  for (const match of matches) {
    issues.push({
      severity: "warning",
      rule: "no-hardcoded-spacing",
      message: `Hardcoded pixel spacing: "${match[0]}". Use spacing tokens.`,
      fix: "Replace with spacing scale token",
    });
    // Flag but don't auto-replace spacing (too context-dependent)
  }

  return result;
}

function pass_enforceGlassSurfaces(
  code: string,
  tokens: DesignTokens,
  issues: UIIssue[],
  fixes: string[]
): string {
  let result = code;

  // Detect card/panel/surface components missing glass treatment
  const cardPattern = /className=["'][^"']*(?:card|panel|surface|container)[^"']*["']/gi;
  const matches = [...code.matchAll(cardPattern)];

  for (const match of matches) {
    const hasBackdropFilter =
      code.includes("backdropFilter") || code.includes("backdrop-filter");
    const hasSemiTransparentBg =
      code.includes("rgba(") || code.includes("var(--glass");

    if (!hasBackdropFilter || !hasSemiTransparentBg) {
      issues.push({
        severity: "error",
        rule: "enforce-glass-surface",
        message: `Surface component missing glass treatment. Add backdropFilter and semi-transparent background.`,
        fix: `Apply glass tokens: backdrop-filter: ${tokens.blur.elevation[1]}; background: ${tokens.colors.glass.tint}; border: 1px solid ${tokens.colors.glass.highlight};`,
      });

      // Inject glass styles if className found without glass properties
      result = injectGlassStyles(result, match[0], tokens);
      fixes.push("Injected glass surface treatment");
    }
  }

  return result;
}

function pass_enforceTypographyTokens(
  code: string,
  tokens: DesignTokens,
  issues: UIIssue[],
  fixes: string[]
): string {
  // Detect raw font-size/font-family values
  const fontFamilyPattern = /fontFamily:\s*["'][^"']+["']/g;
  const fontSizePattern = /fontSize:\s*["']?\d+px["']?/g;

  const fontFamilyMatches = [...code.matchAll(fontFamilyPattern)];
  const fontSizeMatches = [...code.matchAll(fontSizePattern)];

  for (const match of fontFamilyMatches) {
    if (!match[0].includes("var(--font")) {
      issues.push({
        severity: "error",
        rule: "no-hardcoded-font-family",
        message: `Hardcoded fontFamily: "${match[0]}". Use typography tokens.`,
        fix: `Use var(--font-body), var(--font-display), or var(--font-mono)`,
      });
    }
  }

  for (const match of fontSizeMatches) {
    issues.push({
      severity: "warning",
      rule: "no-hardcoded-font-size",
      message: `Hardcoded fontSize: "${match[0]}". Use typography scale tokens.`,
      fix: `Use var(--text-sm), var(--text-base), var(--text-lg), etc.`,
    });
  }

  return code; // Typography corrections are suggestive only
}

function pass_enforceAnimationTokens(
  code: string,
  tokens: DesignTokens,
  issues: UIIssue[],
  fixes: string[]
): string {
  // Check for hardcoded transition durations
  const transitionPattern = /transition:[^;]+\d+ms/g;
  const matches = [...code.matchAll(transitionPattern)];

  for (const match of matches) {
    if (!match[0].includes("var(--")) {
      issues.push({
        severity: "warning",
        rule: "use-animation-tokens",
        message: `Hardcoded transition timing: "${match[0].slice(0, 60)}".`,
        fix: `Use var(--transition-default) or var(--transition-glass)`,
      });
    }
  }

  return code;
}

function pass_enforceSidebarStructure(
  code: string,
  preset: Preset,
  issues: UIIssue[],
  fixes: string[],
  context?: string
): string {
  if (context !== "sidebar" && !code.includes("Sidebar") && !code.includes("sidebar")) {
    return code;
  }

  // Check for NavGroup/NavItem pattern
  if (
    code.includes("sidebar") &&
    !code.includes("NavGroup") &&
    !code.includes("NavItem")
  ) {
    issues.push({
      severity: "error",
      rule: "enforce-sidebar-components",
      message: "Sidebar content must use NavGroup and NavItem components from your preset.",
      fix: "Replace custom nav elements with <NavGroup> and <NavItem> from the preset system.",
    });
  }

  return code;
}

function pass_enforceSettingsPattern(
  code: string,
  preset: Preset,
  issues: UIIssue[],
  fixes: string[],
  context?: string
): string {
  if (context !== "settings" && !code.toLowerCase().includes("settings")) {
    return code;
  }

  // Check that settings UI uses OptionGroup/OptionRow
  const hasAdHocInputs =
    (code.includes("<input") || code.includes("<select") || code.includes("<checkbox")) &&
    !code.includes("OptionGroup") &&
    !code.includes("OptionRow");

  if (hasAdHocInputs) {
    issues.push({
      severity: "error",
      rule: "enforce-settings-components",
      message: "Settings UI must use OptionGroup and OptionRow components. Raw inputs are not allowed.",
      fix: "Wrap controls in <OptionGroup label='...'> with <OptionRow> children using the preset's settings primitives.",
    });
  }

  return code;
}

function pass_injectMissingImports(
  code: string,
  issues: UIIssue[],
  fixes: string[]
): string {
  // Detect used components that may need imports
  const usedComponents = ["NavGroup", "NavItem", "GlassCard", "OptionGroup", "OptionRow"];
  let result = code;

  for (const comp of usedComponents) {
    const isUsed = new RegExp(`<${comp}[\\s/>]`).test(code);
    const isImported = new RegExp(`import.*${comp}.*from`).test(code);

    if (isUsed && !isImported) {
      issues.push({
        severity: "warning",
        rule: "missing-import",
        message: `Component <${comp}> is used but not imported.`,
        fix: `Add: import { ${comp} } from '@/components/preset';`,
      });
      // Inject import at top of file
      result = `import { ${comp} } from '@/components/preset';\n` + result;
      fixes.push(`Injected missing import for ${comp}`);
    }
  }

  return result;
}

// ── Validation-only checks ────────────────────────────────────────────────────

function check_hardcodedColors(code: string, issues: UIIssue[]): void {
  const matches = [...code.matchAll(FORBIDDEN_HARDCODED_COLORS)];
  for (const match of matches) {
    issues.push({
      severity: "error",
      rule: "no-hardcoded-colors",
      message: `Hardcoded color: "${match[0]}"`,
    });
  }
}

function check_hardcodedSpacing(code: string, issues: UIIssue[]): void {
  const matches = [...code.matchAll(FORBIDDEN_HARDCODED_PIXELS)];
  for (const match of matches) {
    issues.push({
      severity: "warning",
      rule: "no-hardcoded-spacing",
      message: `Hardcoded spacing: "${match[0]}"`,
    });
  }
}

function check_glassSurfaces(code: string, tokens: DesignTokens, issues: UIIssue[]): void {
  const hasSurface = /(?:card|panel|surface|GlassCard)/i.test(code);
  if (hasSurface && !code.includes("backdropFilter") && !code.includes("backdrop-filter")) {
    issues.push({
      severity: "error",
      rule: "enforce-glass-surface",
      message: "Surface element detected without glass treatment (backdropFilter).",
    });
  }
}

function check_typographyConformance(code: string, tokens: DesignTokens, issues: UIIssue[]): void {
  const hardcodedFonts = /fontFamily:\s*["'][^v][^"']+["']/g;
  const matches = [...code.matchAll(hardcodedFonts)];
  for (const match of matches) {
    issues.push({ severity: "error", rule: "no-hardcoded-font-family", message: match[0] });
  }
}

function check_settingsPatternConformance(code: string, preset: Preset, issues: UIIssue[]): void {
  pass_enforceSettingsPattern(code, preset, issues, [], "settings");
}

function check_sidebarConformance(code: string, preset: Preset, issues: UIIssue[]): void {
  pass_enforceSidebarStructure(code, preset, issues, [], "sidebar");
}

function check_accessibilityBasics(code: string, issues: UIIssue[]): void {
  // Check for images without alt
  const imgWithoutAlt = /<img(?![^>]*alt=)[^>]*>/gi;
  const matches = [...code.matchAll(imgWithoutAlt)];
  for (const match of matches) {
    issues.push({
      severity: "warning",
      rule: "a11y-img-alt",
      message: `<img> element missing alt attribute.`,
      fix: `Add alt="" or descriptive alt text`,
    });
  }

  // Check icon buttons without aria-label
  if (code.includes("IconButton") && !code.includes("aria-label")) {
    issues.push({
      severity: "warning",
      rule: "a11y-icon-button-label",
      message: "IconButton detected without aria-label.",
      fix: "Add aria-label prop to all icon-only buttons",
    });
  }
}

// ── Utility helpers ───────────────────────────────────────────────────────────

function suggestColorToken(match: string, tokens: DesignTokens): string {
  // Very lightweight heuristic — a real implementation would use chroma.js
  // to find the nearest token by color distance
  if (/background/.test(match)) {
    return `background: var(--color-surface);`;
  }
  if (/border/.test(match)) {
    return `border-color: var(--color-glass-border);`;
  }
  return `color: var(--color-text-primary);`;
}

function injectGlassStyles(
  code: string,
  targetMatch: string,
  tokens: DesignTokens
): string {
  // Inject inline glass style prop if className detected on surface element
  const glassStyle = `style={{ backdropFilter: '${tokens.blur.elevation[1]}', background: '${tokens.colors.glass.tint}', border: '1px solid ${tokens.colors.glass.highlight}' }}`;
  return code.replace(
    targetMatch,
    targetMatch + " " + glassStyle
  );
}
