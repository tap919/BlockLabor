// ─────────────────────────────────────────────────────────────────────────────
// utils/templateUtils.ts  –  Shared template helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escapes special regex characters in a string so it can be used safely
 * inside a RegExp constructor.
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replaces {{prop:<key>}} placeholders in a template string with the
 * provided prop values.
 */
export function injectProps(template: string, props: Record<string, unknown>): string {
  let result = template;
  for (const [key, value] of Object.entries(props)) {
    const placeholder = new RegExp(`\\{\\{prop:${escapeRegExp(key)}\\}\\}`, "g");
    result = result.replace(placeholder, String(value));
  }
  return result;
}
