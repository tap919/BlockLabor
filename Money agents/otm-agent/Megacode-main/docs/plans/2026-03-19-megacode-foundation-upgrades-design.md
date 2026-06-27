# Megacode Foundation Upgrades (Stabilize → Secure → Supercharge)

**Goal:** Make Megacode safer to run and easier to improve by stabilizing the test/runtime baseline, hardening the most dangerous server surfaces, then upgrading chat/MCP/UI with confidence.

## Why this order
- **Stabilize**: The repo currently has broad TypeScript/test failures outside the LLM layer. Without a reliable baseline, upgrades are high-risk and slow.
- **Secure**: `ui/server.js` exposes powerful primitives (file write/delete, terminal exec, workspace switching). These need explicit gating and safer defaults.
- **Supercharge**: Once the foundation is stable and safer, we can upgrade the visible product areas (chat UX, provider routing, MCP lifecycle) without constantly firefighting regressions.

## Scope (first upgrade tranche)
### 1) Reliability stabilization
- Establish a “known-good” test slice (`test:core`) that must pass on Windows.
- Fix the highest-impact correctness issues that block stable tests/builds:
  - Duplicate method declarations in `src/accessibility/a11y.ts` (esbuild warning).
  - Type-level issues that break compilation in common environments (e.g., missing DOM types in Node test env).
  - Ensure chat/LLM/provider tests remain isolated and green.

### 2) Security hardening (local-by-default)
- Terminal endpoints remain **disabled by default** and require an explicit env flag to enable.
- Workspace opening stays restricted by default.
- Add lightweight request hardening:
  - Basic rate limiting for expensive endpoints (`/api/chat`, `/api/terminal/*` when enabled).
  - Safer error handling with request correlation ids.
  - Optional shared secret token for high-risk endpoints (simple header-based auth).

### 3) Supercharge (after foundation)
- Chat: provider selection transparency, better streaming UX, better retries/backoff, richer status/usage stats.
- MCP: lifecycle management (connectivity, health, start/stop), tool permission boundaries.
- UI/UX: better error states, accessibility improvements, performance tuning.

## Success criteria
- `npm run esbuild:build` has **no security-key defaults** in `dist/index.js`.
- `npm run test:llm` stays green.
- A new `npm run test:core` is green on Windows and covers the UI server + chat base behaviors.
- High-risk endpoints are gated by default and have clear enablement knobs.

