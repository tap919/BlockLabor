# Megacode Foundation Upgrades Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stabilize a Windows-friendly test baseline, harden the highest-risk UI server endpoints, then lay groundwork for chat/MCP/UI upgrades.

**Architecture:** Introduce a “core test slice” and fix build-blocking issues first, then add opt-in security controls (auth/rate limit) around dangerous endpoints without changing default local dev UX.

**Tech Stack:** Node.js, TypeScript, Jest (ts-jest), Express, esbuild.

---

### Task 1: Establish a stable Windows test entrypoint

**Files:**
- Modify: `package.json`

**Step 1: Add `test:core` script**

Change `package.json` to include a new script that runs a minimal, stable set of tests on Windows:

- `test:llm` (already exists) stays as-is.
- Add: `test:core` = `jest` limited to a curated list of suites.

**Step 2: Run to verify it works**

Run: `npm run test:core`  
Expected: PASS (even if `npm test` still fails due to existing unrelated failures).

---

### Task 2: Fix esbuild duplicate-class-member warning in a11y

**Files:**
- Modify: `src/accessibility/a11y.ts` (remove duplicate `isSynthesisAvailable()` implementation)
- Test: `npm run esbuild:build`

**Step 1: Write a tiny regression test (optional)**

If feasible, add/adjust `src/accessibility/a11y.test.ts` to cover `isSynthesisAvailable()` behavior in Node by mocking `window`.

**Step 2: Implement minimal fix**

Keep one canonical `isSynthesisAvailable()` method; remove the duplicate.

**Step 3: Verify**

Run: `npm run esbuild:build`  
Expected: no duplicate-class-member warning.

---

### Task 3: Make browser-only speech recognition types safe for Node tests

**Files:**
- Modify: `src/accessibility/a11y.ts`
- Optional: Create `src/types/speech-recognition.d.ts` (or inline types)
- Test: `npm run test:core`

**Step 1: Write failing test**

Create a test ensuring importing the module in Node does not throw/typefail.

**Step 2: Implement**

Use `typeof window !== "undefined"` guards and type-safe fallbacks. Avoid referencing `SpeechRecognition*` global types directly in positions that TypeScript requires DOM lib support in Node test compilation.

**Step 3: Verify**

Run: `npm run test:core`  
Expected: PASS.

---

### Task 4: Add lightweight auth for high-risk UI server endpoints (opt-in)

**Files:**
- Modify: `ui/server.js`
- Modify: `ui/public/index.html` (only if we expose a UI field; otherwise document env var)

**Step 1: Add env-based auth check**

Add `MEGACODE_ADMIN_TOKEN` support. If set, require header `x-megacode-token: <token>` for:\n
- `/api/files/write`\n
- `/api/files/delete`\n
- `/api/files/rename`\n
- `/api/workspace/open`\n
- `/api/terminal/*` (already gated via `MEGACODE_TERMINAL_ENABLED`)

**Step 2: Verify behavior**

- With token unset: behavior unchanged for local dev.\n
- With token set: unauthenticated requests return 401/403.

---

### Task 5: Add basic rate limiting to `/api/chat` (and terminal when enabled)

**Files:**
- Modify: `ui/server.js`
- Test: add minimal unit/integration test OR manual verification steps

**Step 1: Implement a simple in-memory limiter**

Per-IP (or per session id) sliding window, small defaults (e.g., 30 req/min) with env overrides.

**Step 2: Verify**

Manual: spam `/api/chat` and observe 429s after threshold.

---

### Task 6: Improve observability for chat + workflow endpoints

**Files:**
- Modify: `ui/server.js`

**Step 1: Add request correlation id**

Ensure every `/api/chat` request includes a stable request id in logs and responses (SSE already has `requestId`).

**Step 2: Add structured logs for failures**

Log provider, task type, timing, and error summaries without leaking keys.

---

### Task 7: Rebuild and verify no secrets are embedded

**Files:**
- Modify: `dist/*` via build only

**Step 1: Rebuild**

Run: `npm run esbuild:build`

**Step 2: Verify**

Run: `rg "sk-[a-zA-Z0-9]" dist/index.js`  
Expected: no embedded real keys; only pattern checks or documentation strings.

---

### Task 8: Document safe defaults and how to enable power features

**Files:**
- Modify: `README.md` (or `FULLSTACK-README.md`)

**Step 1: Add a “Security knobs” section**

Document:\n
- `MEGACODE_TERMINAL_ENABLED=true`\n
- `MEGACODE_ALLOW_ANY_WORKSPACE=true`\n
- `MEGACODE_ADMIN_TOKEN=...`\n
- rate limit env vars (if added)

---

## Execution options
Plan saved to `docs/plans/2026-03-19-megacode-foundation-upgrades.md`.

Two execution options:

1. **Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Parallel Session (separate)** — Open a new session and implement using executing-plans task-by-task.

Which approach?

