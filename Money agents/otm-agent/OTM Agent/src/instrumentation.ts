/**
 * Next.js Instrumentation Hook
 *
 * Runs ONCE when the Next.js server process starts.
 * We split into instrumentation.ts (entry) + instrumentation-node.ts (Node-only)
 * so Turbopack's Edge Instrumentation analysis does NOT trace into
 * autonomous-engine → browser-agent → playwright, which causes build errors.
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
