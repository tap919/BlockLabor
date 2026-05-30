// Lightweight Sentry wrapper for Deno Edge Functions
// Replaces with official Sentry Deno SDK when it stabilizes.
// See: https://docs.sentry.io/platforms/javascript/guides/deno/

export function captureException(error: Error, context?: Record<string, unknown>): void {
  console.error("[Sentry]", error.message, JSON.stringify(context));
}

export function captureMessage(message: string, level: "info" | "warning" | "error" = "info"): void {
  console.log(`[Sentry][${level}]`, message);
}
