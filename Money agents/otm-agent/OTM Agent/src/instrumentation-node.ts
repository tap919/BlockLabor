/**
 * Node.js-only instrumentation logic.
 *
 * Imported by instrumentation.ts only when NEXT_RUNTIME === "nodejs".
 * This isolation prevents Turbopack's Edge analysis from tracing into
 * autonomous-engine → browser-agent → playwright.
 */

import { startEngine } from "@/lib/autonomous-engine";

console.log("[instrumentation] Next.js server started — auto-starting autonomous engine...");

startEngine({
  intervalMs: 5 * 60 * 1000, // 5 minutes
  autoEnqueueThreshold: 80,
  maxClaimsPerCycle: 3,
  payoutThresholdUsd: 100,
});

console.log("[instrumentation] Autonomous engine is now running.");
