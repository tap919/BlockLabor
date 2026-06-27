# BlockLabor Foundation Security, Backend Integration & E2E Test Plan

**Objective:** Secure the foundation, remove all mock data, integrate the Supabase backend end-to-end, and ship comprehensive E2E test coverage.

**Current state:** React 19 + TS + Vite + Zustand + Supabase. Backend is configured (migrations + edge functions exist) but the React frontend still uses hardcoded mock data from `src/shared/mocks/data.ts`. Tests are skeletons.

**Target state:** All UI reads/writes from Supabase via typed services. Auth, RLS, environment validation, error boundary, observability in place. E2E tests cover booking, candidate onboarding, incident logging, and staff console flows.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│  React 19 + Vite 6 + Tailwind 4                          │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Features/  │  │ Shared/      │  │  Components/     │  │
│  │  Stores    │─▶│  Services    │─▶│   ErrorBoundary  │  │
│  │  Hooks     │  │  Types       │  │   AuthGate       │  │
│  └────────────┘  └──────┬───────┘  └──────────────────┘  │
│                         │                                 │
│                  React Query                              │
│                  (cache, retry)                           │
└─────────────────────────┬────────────────────────────────┘
                          │  Typed client
                          ▼
        ┌──────────────────────────────────────┐
        │  Supabase                            │
        │   ├── Postgres + RLS                 │
        │   ├── Auth (JWT)                     │
        │   ├── Edge Functions (Twilio, OKTA,  │
        │   │   Checkr, DropboxSign, Payroll)  │
        │   └── Storage                        │
        └──────────────────────────────────────┘
```

---

## Dependency Graph

```
Step 1: Foundation Security
  └─→ Step 2: Environment & Config Validation
       └─→ Step 3: Auth Layer (Supabase Auth + Context)
            └─→ Step 4: Type-Safe Supabase Services
                 ├─→ Step 5: React Query + Service Hooks
                 │     └─→ Step 7: Remove Mock Data
                 └─→ Step 6: Error Boundary + Sentry Wiring
                      └─→ Step 8: E2E Test Suite
```

**Parallel-safe steps:** 5 and 6 can run in parallel after step 4. Step 7 must follow step 5. Step 8 follows step 7.

---

## Step 1 — Foundation Security (lint, types, deps)

**Context brief:** Tighten the security and quality baseline before any data-layer work. Add missing lint rules, audit dependencies, and lock in TypeScript strict checks.

**Files:**
- Modify: `package.json` (add eslint plugins, husky optional)
- Modify: `eslint.config.js` (add TS, React Hooks, a11y rules)
- Modify: `tsconfig.json` (enable `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- Create: `.npmrc` (save-exact)
- Create: `.editorconfig`
- Create: `PULL_REQUEST_TEMPLATE.md`
- Create: `README.md` (replaces whatever exists, per phase 1 plan)

**Tasks:**
- [ ] Run `npm audit --production` and triage any high/critical findings
- [ ] Add `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`
- [ ] Update `eslint.config.js` to extend TS + React Hooks + a11y recommended rules
- [ ] Enable TS strict flags: `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`
- [ ] Add `.editorconfig` and `.npmrc` (save-exact=true)
- [ ] Add `PULL_REQUEST_TEMPLATE.md` with security checklist section
- [ ] Write `README.md` with setup, env vars, scripts, deployment section
- [ ] Add `.gitignore` entries for `.env`, `.env.local`, `.env.*.local`, `coverage/`, `playwright-report/`

**Verification:**
```bash
npm install
npm run lint
npx tsc --noEmit
npm run build
```

**Exit criteria:** `npm run lint`, `tsc --noEmit`, and `npm run build` all pass with zero warnings.

**Rollback:** `git revert` the commit. Lint changes are non-breaking.

**Model tier:** default (haiku)

---

## Step 2 — Environment & Config Validation

**Context brief:** The app currently throws at module load if Supabase env vars are missing. We need fail-fast validation, a typed config object, and an `.env.example` so new devs can boot the app.

**Files:**
- Create: `.env.example`
- Create: `src/shared/lib/env.ts` (Zod-validated env config)
- Modify: `src/shared/lib/supabaseClient.ts` (use validated env)
- Modify: `src/main.tsx` (init Sentry from validated env)

**Tasks:**
- [ ] Install `zod` (or reuse if available)
- [ ] Create `.env.example` with all required vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SENTRY_DSN`, `VITE_SENTRY_ENV`, `VITE_APP_URL`
- [ ] Create `src/shared/lib/env.ts` with Zod schema validating all `import.meta.env.VITE_*` vars at startup
- [ ] Export typed `env` object, fail-fast with clear console error in dev
- [ ] Refactor `supabaseClient.ts` to import from `env.ts`
- [ ] Refactor `main.tsx` Sentry init to read from `env.ts`, add `tracesSampleRate` and `replaysSessionSampleRate`
- [ ] Add runtime check: if `import.meta.env.PROD` and `env.VITE_SENTRY_DSN` empty, log warning

**Verification:**
```bash
# With missing env
npm run dev   # should show clear error
# With .env.local populated
npm run dev   # should start cleanly
npm run lint
npx tsc --noEmit
```

**Exit criteria:** App refuses to start without env vars in any mode; starts cleanly with valid `.env.local`.

**Rollback:** `git revert`. env.ts is new file, no other refactor.

**Model tier:** default (haiku)

---

## Step 3 — Auth Layer + AuthContext

**Context brief:** Supabase is configured but no UI flows use `supabase.auth`. Add a typed `AuthContext` that exposes session/user/signIn/signOut, and a `<RequireAuth>` guard for protected routes. Wire to existing `users` table.

**Files:**
- Create: `src/features/auth/authStore.ts` (Zustand session store, hydrated on mount)
- Create: `src/features/auth/useAuth.ts` (hook)
- Create: `src/features/auth/RequireAuth.tsx` (route guard)
- Create: `src/features/auth/SignInForm.tsx` (email + magic link)
- Modify: `src/main.tsx` (hydrate session on boot, add `<ErrorBoundary>` wrapper)
- Modify: `src/app/AppShell.tsx` (gate staff/contractor views behind auth)
- Modify: `src/constants.ts` (extract auth-related constants)
- Modify: `src/shared/types/domain.ts` (add `SessionUser` type)

**Tasks:**
- [ ] Install `@supabase/auth-ui-react` (optional, or build minimal form)
- [ ] Define `SessionUser` in `domain.ts` (subset of `auth.users` + `public.users` join)
- [ ] Create `useAuth` hook returning `{ user, session, role, isLoading, signIn, signOut, refreshSession }`
- [ ] On boot, call `supabase.auth.getSession()` and `supabase.auth.onAuthStateChange`
- [ ] Hydrate `users` table row to determine `role` (`'owner' | 'recruiter' | 'scheduler' | 'payroll' | 'worker'`)
- [ ] Create `<RequireAuth roles={['owner', 'recruiter']}>` guard component
- [ ] Add `SignInForm` component with email/password + magic link
- [ ] Add sign-out button in `Navigation.tsx` (visible only when authed)
- [ ] Gate `currentView === 'staff' | 'qa'` behind `RequireAuth roles={['owner','recruiter','scheduler','payroll']}`

**Verification:**
```bash
npm run lint
npx tsc --noEmit
npm run dev   # manual: try sign-in, sign-out, refresh
```

**Exit criteria:** Sign-in flow works with local Supabase; protected routes redirect to sign-in when unauthenticated; session persists across page refresh.

**Rollback:** `git revert`. App falls back to current "no auth" state.

**Model tier:** default (haiku)

---

## Step 4 — Type-Safe Supabase Service Layer

**Context brief:** The services directory (`src/shared/services/`) has stubs. Replace direct DB calls in stores with full CRUD services per table. Regenerate `database.ts` from live Supabase to keep types in sync with migrations.

**Files:**
- Modify: `src/shared/services/jobs.service.ts` (full CRUD)
- Modify: `src/shared/services/candidates.service.ts`
- Modify: `src/shared/services/incidents.service.ts`
- Modify: `src/shared/services/integrations.service.ts`
- Modify: `src/shared/services/vendors.service.ts`
- Create: `src/shared/services/branches.service.ts`
- Create: `src/shared/services/rateCards.service.ts`
- Create: `src/shared/services/ssoConfig.service.ts`
- Create: `src/shared/services/permissions.service.ts`
- Create: `src/shared/services/logs.service.ts`
- Modify: `src/shared/types/domain.ts` (tighten field types where DB types differ)
- Create: `src/shared/lib/result.ts` (Result<T, E> helper for service returns)

**Tasks:**
- [ ] Document local dev setup: `supabase start` produces local DB at `localhost:54321`
- [ ] Create `supabase/.temp/project-ref` placeholder doc; add README in `supabase/` with local setup steps
- [ ] Run `npx supabase gen types typescript --local > src/shared/types/database.ts` to regenerate from local
- [ ] Diff regenerated types vs current; manually merge any domain-mapping changes
- [ ] For each service file:
  - [ ] Export `getAll()`, `getById(id)`, `create(payload)`, `update(id, patch)`, `delete(id)` where the table supports it
  - [ ] Wrap calls in try/catch, return `Result<T, AppError>` from `result.ts`
  - [ ] Use `Database['public']['Tables']['X']['Insert']` and `Update` types for inputs
- [ ] Add `mapRow` helpers in each service (convert snake_case → camelCase, typed)
- [ ] Export `appErrorFromSupabase(error)` helper to convert PostgREST errors to `AppError`

**Verification:**
```bash
npx tsc --noEmit
npm run lint
# Manual: hit each service from a temp script, confirm no unhandled rejections
```

**Exit criteria:** All 9 services have full CRUD; types compile; result helper covered by unit tests.

**Rollback:** `git revert`. Stores fall back to existing direct calls (still work for now).

**Model tier:** strongest (sonnet) — type contracts are load-bearing.

---

## Step 5 — React Query + Service Hooks

**Context brief:** Stores currently do `useState` and direct service calls. Introduce React Query for cache, retry, optimistic updates. Stores become thin: they consume the query cache and trigger mutations.

**Files:**
- Create: `src/shared/lib/queryClient.ts` (configured React Query client)
- Create: `src/shared/hooks/useJobs.ts`, `useCandidates.ts`, `useIncidents.ts`, `useIntegrations.ts`, `useVendors.ts`, `useBranches.ts`, `useRateCards.ts`, `useLogs.ts`, `usePermissions.ts`, `useSsoConfig.ts`
- Modify: `src/main.tsx` (wrap app in `<QueryClientProvider>`)
- Modify: `src/features/*/stores.ts` (thin wrappers around query cache)
- Modify: `src/App.tsx` (remove direct store reads, use hooks)

**Tasks:**
- [ ] Install `@tanstack/react-query` and `@tanstack/react-query-devtools`
- [ ] Configure `queryClient` with sane defaults: `staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false`
- [ ] Mount `<QueryClientProvider>` in `main.tsx`; devtools only in dev
- [ ] Create one hook per resource with `useQuery` (list + byId) and `useMutation` (create/update/delete)
- [ ] Each mutation invalidates the corresponding query key on success
- [ ] Refactor each `*Store.ts` to a thin Zustand selector of the query cache (or replace with direct hook usage in components)
- [ ] In `App.tsx`, replace `useJobsStore()` etc. with the new hooks
- [ ] In `AppShell.tsx`, pass query-data props instead of raw store state
- [ ] In `BookingPage`, `ClientPortal`, `ContractorPortal`, `StaffDashboard`, `QaStagingHub`: replace mock-callback flows with mutation hooks

**Verification:**
```bash
npm run lint
npx tsc --noEmit
npm run dev   # manual: book a job, verify it appears in client portal
```

**Exit criteria:** All read paths go through React Query; all writes trigger cache invalidation; no `useState` in stores for server data.

**Rollback:** `git revert`. Stores still work standalone.

**Model tier:** strongest (sonnet) — many file edits, must keep types consistent.

---

## Step 6 — Error Boundary + Sentry Wiring

**Context brief:** Main has no error boundary — any uncaught render error blanks the app. Wire a top-level boundary that reports to Sentry with `extra.context` for the current view, plus a small recovery UI.

**Files:**
- Create: `src/components/ErrorBoundary.tsx` (class component, reports to Sentry)
- Create: `src/components/FallbackError.tsx` (UI for crashed subtree)
- Modify: `src/main.tsx` (wrap in `<ErrorBoundary>` with Sentry scope)
- Create: `src/shared/lib/logger.ts` (browser-side logger: console + Sentry capture, level-aware)

**Tasks:**
- [ ] Install (already have) `@sentry/react` and use its `ErrorBoundary` wrapper or build a thin class boundary
- [ ] Build `ErrorBoundary` that calls `Sentry.captureException` with tags `{view, role, isEnterprise}`
- [ ] Render `FallbackError` with: error message, "Reload" button, "Copy diagnostics" button
- [ ] In `main.tsx`, wrap `<App />` in the boundary
- [ ] Add per-feature `try/catch` logging in mutation hooks via the new `logger.ts`
- [ ] Add `logger.warn/error` calls wherever today there is `console.error`
- [ ] Add `Sentry.setUser({ id, email, role })` on auth state change

**Verification:**
```bash
npm run lint
npx tsc --noEmit
npm run dev
# Manual: throw an error in a component, confirm Sentry receives event and fallback UI renders
```

**Exit criteria:** Uncaught error in any subtree shows fallback UI; Sentry receives a tagged event; no uncaught errors reach the console silently.

**Rollback:** `git revert`. App runs as before without boundary.

**Model tier:** default (haiku)

---

## Step 7 — Remove Mock Data

**Context brief:** All UI flows currently seed from `src/shared/mocks/data.ts`. Once the backend is wired, delete the file and any imports. The QA Staging Hub becomes the only place that can seed dev data via a guarded button.

**Files:**
- Delete: `src/shared/mocks/data.ts`
- Modify: `src/App.tsx` (remove `mockBranches`, `mockRateCards`, `defaultSsoConfig`, `defaultPermissions` imports)
- Modify: `src/features/admin/components/QaStagingHub.tsx` (add "Seed dev data" button that inserts a baseline row set when `import.meta.env.DEV`)
- Create: `supabase/seed.sql` (already exists, but verify it matches the new service contracts)
- Modify: `supabase/seed.sql` if needed for new columns

**Tasks:**
- [ ] Grep codebase for `from.*mocks/data` to enumerate all references
- [ ] Replace each `mockJobs`, `mockCandidates`, `mockRateCards`, `mockBranches` with empty initial state + `useQuery` hydration
- [ ] In `QaStagingHub`, add a guarded `<button>` that calls a `seedDevData()` function inserting 1 branch, 1 rate card, 1 user, 1 job, 1 candidate. Visible only when `import.meta.env.DEV` AND user is authed
- [ ] `seedDevData()` calls services in a specific order respecting FK constraints
- [ ] Delete `src/shared/mocks/data.ts`
- [ ] Update `src/shared/mocks/.gitkeep` if present (delete or leave with comment)
- [ ] Add vitest test confirming `mocks/data` import fails (or just delete and rely on TS error)

**Verification:**
```bash
npm run lint
npx tsc --noEmit   # should fail if any mock import remains
npm run dev        # QA Staging Hub → click "Seed dev data" → verify data appears
npm run build
```

**Exit criteria:** No file in `src/` imports from `mocks/`; app boots with empty Supabase; QA hub can seed dev data on demand.

**Rollback:** `git revert` and `git restore src/shared/mocks/data.ts`.

**Model tier:** default (haiku)

---

## Step 8 — E2E Test Suite (Playwright)

**Context brief:** Existing E2E tests only assert page title. Build a real suite covering the four user journeys that prove the backend integration works: client booking, contractor self-service, staff console, auth + RBAC.

**Files:**
- Modify: `playwright.config.ts` (create if absent) — baseURL, webServer, projects (chromium, firefox, webkit), retries, trace
- Modify: `.github/workflows/main.yml` (add E2E job with PostgreSQL + Supabase service containers)
- Create: `tests/e2e/auth.spec.ts` (sign-in, sign-out, protected route redirect)
- Create: `tests/e2e/booking.spec.ts` (home → book labor → submit → success card)
- Create: `tests/e2e/client-portal.spec.ts` (view jobs, file incident, change status)
- Create: `tests/e2e/contractor-portal.spec.ts` (view available jobs, accept, timesheet check-in)
- Create: `tests/e2e/staff-console.spec.ts` (jobs queue, candidate review, rate card manager, integrations toggle)
- Create: `tests/e2e/qa-hub.spec.ts` (seed dev data, verify rows appear)
- Create: `tests/e2e/visual-regression.spec.ts` (snapshots of home, booking, staff dashboard)
- Create: `tests/e2e/fixtures/auth.ts` (signInAs(role) helper)
- Create: `tests/e2e/fixtures/db.ts` (reset + seed via service role key)

**Tasks:**
- [ ] Add `playwright.config.ts` with `webServer` running `npm run dev` and `globalSetup` that resets DB
- [ ] Add `playwright` to devDependencies (already present at `^1.60.0`)
- [ ] Create `auth` fixture that signs in via magic link (use test-only mail catcher or signed magic link token in env)
- [ ] Create `db` fixture that calls `supabase.from(...).delete()` on all tables in dependency order
- [ ] Write `auth.spec.ts`:
  - [ ] unauthenticated user hitting `/` lands on sign-in
  - [ ] authenticated user can navigate to home
  - [ ] staff route requires `recruiter` or `owner` role
- [ ] Write `booking.spec.ts`:
  - [ ] pick vertical, fill form, submit, success card shows lastCreatedId
  - [ ] navigate to client portal, verify new job appears
- [ ] Write `client-portal.spec.ts`:
  - [ ] file an incident, verify in staff queue
  - [ ] change job status, verify persists after refresh
- [ ] Write `contractor-portal.spec.ts`:
  - [ ] accept an open job, verify status updates
- [ ] Write `staff-console.spec.ts`:
  - [ ] jobs queue renders, click row → detail
  - [ ] candidate review → approve background check
  - [ ] rate card manager → edit, save, reload, persists
  - [ ] integrations toggle → state persists
- [ ] Write `visual-regression.spec.ts`:
  - [ ] snapshot home, booking form, client portal, staff console at desktop + mobile widths
- [ ] Add `e2e` job to `.github/workflows/main.yml` that:
  - [ ] uses `services:` for postgres + supabase
  - [ ] runs `npx supabase start`
  - [ ] runs `npm run seed` (or seeds via API)
  - [ ] runs `npx playwright test`
  - [ ] uploads `playwright-report/` and `test-results/` as artifacts
- [ ] Set `retries: 2` on CI, `0` locally; `trace: 'on-first-retry'`
- [ ] Document in `README.md` how to run E2E locally: `npm run e2e` + `npm run e2e:ui`

**Verification:**
```bash
npm run lint
npx tsc --noEmit
npx playwright install --with-deps
npx playwright test
npx playwright test --ui   # verify interactive debugging works
# Push branch → confirm CI e2e job runs green
```

**Exit criteria:** All 7 spec files pass locally and in CI; visual regressions within 1% pixel diff; CI job takes < 6 min.

**Rollback:** `git revert`. Existing title-only spec remains green.

**Model tier:** strongest (sonnet) — multi-file test architecture.

---

## Step 9 — Final Verification & Documentation

**Context brief:** Confirm everything is wired, doc the new env vars and scripts, and update the deployment plan.

**Files:**
- Modify: `README.md` (env vars, scripts, E2E section, security notes)
- Modify: `.github/workflows/main.yml` (consolidate jobs, add caching, matrix)
- Create: `SECURITY.md` (env var handling, RLS, Sentry PII scrubbing)
- Modify: `package.json` (add scripts: `e2e`, `e2e:ui`, `typecheck`, `seed`)

**Tasks:**
- [ ] Add `typecheck: tsc --noEmit` script
- [ ] Add `e2e: playwright test` and `e2e:ui: playwright test --ui` scripts
- [ ] Add `seed: supabase db reset && supabase db seed` script
- [ ] Confirm `npm run lint && npm run typecheck && npm run build && npm run e2e` all green
- [ ] Write `SECURITY.md` covering:
  - env var handling
  - RLS policy model
  - Sentry PII scrubbing via `beforeSend`
  - Webhook signature verification (Checkr, DropboxSign, Twilio)
  - CSP headers (note for deployment target)
- [ ] Update CI to use `npm run typecheck` and `npm run e2e`

**Verification:**
```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm run e2e
```

**Exit criteria:** One command chain passes locally. CI green. Docs up to date.

**Model tier:** default (haiku)

---

## Anti-Patterns to Avoid

- **❌ Don't add `localStorage` caches** — React Query already handles cache; double-caching causes bugs.
- **❌ Don't use `as any`** in service types — fix the row mapper, not the cast.
- **❌ Don't bypass RLS in the client** — never expose `service_role` key; it's server-side only.
- **❌ Don't put business logic in components** — keep `calculateJobData` and similar in `*Utils.ts`.
- **❌ Don't write a custom auth UI** if `supabase.auth.ui` covers the need.
- **❌ Don't use `page.waitForTimeout`** in E2E — use `expect(locator).toBeVisible()` with auto-retry.
- **❌ Don't seed in test setup with file imports** — use the same API the production app uses.
- **❌ Don't skip `page.screenshot({ fullPage: true })`** in visual regression — viewport-only misses bugs.
- **❌ Don't trust user-controlled `redirect_to`** in auth — validate against an allowlist.

---

## Step Status Tracker

| # | Step | Status | Branch | PR |
|---|------|--------|--------|----|
| 1 | Foundation Security | pending | `chore/foundation-security` | — |
| 2 | Environment & Config | pending | `chore/env-validation` | — |
| 3 | Auth Layer | pending | `feat/auth-context` | — |
| 4 | Type-Safe Services | pending | `feat/service-layer` | — |
| 5 | React Query + Hooks | pending | `feat/react-query` | — |
| 6 | Error Boundary + Sentry | pending | `feat/error-boundary` | — |
| 7 | Remove Mock Data | pending | `chore/remove-mocks` | — |
| 8 | E2E Test Suite | pending | `feat/e2e-suite` | — |
| 9 | Final Verification | pending | `docs/verify-and-document` | — |

**Parallelism:** Steps 5 and 6 are parallel-safe. All other steps are sequential.
