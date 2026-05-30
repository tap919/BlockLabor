# Deployment Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the codebase from 48% to production-ready by fixing all critical, high, and medium severity audit findings.

**Architecture:** Database migrations first (the foundation everything else depends on), then security fixes, then Edge Function consistency, then testing and tooling.

**Tech Stack:** Supabase (PostgreSQL, Edge Functions/Deno, RLS), TypeScript, Playwright, Vitest, ESLint

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `supabase/migrations/20260530000004_create_missing_tables.sql` | CREATE TABLE for 8 missing tables |
| Create | `supabase/migrations/20260530000005_add_indexes.sql` | Indexes on high-frequency columns |
| Create | `supabase/migrations/20260530000006_add_candidates_columns.sql` | Missing columns on candidates table |
| Modify | `supabase/migrations/20260530000001_auth_rls.sql:109` | Add RLS + policies for users table |
| Modify | `supabase/functions/dropbox-sign/send-request.ts:52` | Remove test_mode: true |
| Modify | `supabase/functions/shared/error.ts` | Add AppError re-export, deprecation notice |
| Modify | `supabase/functions/checkr/invite-candidate.ts` | Migrate to new shared modules |
| Modify | `supabase/functions/checkr/webhook.ts` | Migrate to new shared modules |
| Modify | `supabase/functions/twilio/send-sms.ts` | Migrate to new shared modules |
| Modify | `supabase/functions/twilio/status-webhook.ts` | Migrate to new shared modules |
| Modify | `supabase/functions/payroll/sync-employee.ts` | Migrate to new shared modules |
| Modify | `supabase/functions/dropbox-sign/send-request.ts` | Migrate to new shared modules |
| Modify | `supabase/functions/dropbox-sign/webhook.ts` | Migrate to new shared modules |
| Modify | `supabase/functions/okta/login.ts` | Migrate to new shared modules |
| Modify | `supabase/functions/okta/saml.ts` | Migrate to new shared modules |
| Create | `tests/functions/checkr-webhook.test.ts` | Edge function test |
| Create | `tests/functions/twilio-send-sms.test.ts` | Edge function test |
| Create | `vitest.config.ts` | Vitest configuration |
| Create | `eslint.config.js` | ESLint configuration |

---

## Task 1: Create missing table migrations

**Files:**
- Create: `supabase/migrations/20260530000004_create_missing_tables.sql`

- [ ] **Step 1: Write the migration DDL**

```sql
-- Migration: Create 8 missing tables referenced by RLS policies, audit triggers, and application code
-- These tables are already referenced in 000001_auth_rls.sql and 000002_audit_triggers.sql

CREATE TABLE IF NOT EXISTS public.system_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category   TEXT,
  type       TEXT,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.users (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  name       TEXT,
  full_name  TEXT,
  role       TEXT NOT NULL,
  branch_id  TEXT,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.branches (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  city                 TEXT NOT NULL,
  manager              TEXT NOT NULL,
  margin_target        NUMERIC,
  active_jobs_count    INTEGER DEFAULT 0,
  active_workers_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.rate_cards (
  id                          TEXT PRIMARY KEY,
  vertical                    TEXT NOT NULL,
  category                    TEXT NOT NULL,
  standard_bill_rate          NUMERIC NOT NULL,
  standard_pay_rate           NUMERIC NOT NULL,
  custom_client_markup_percent NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS public.sso_config (
  id                     TEXT PRIMARY KEY,
  provider               TEXT,
  domain                 TEXT,
  enabled                BOOLEAN DEFAULT false,
  active_directory_group TEXT,
  last_sync_date         TIMESTAMPTZ,
  role_mapping           JSONB
);

CREATE TABLE IF NOT EXISTS public.partner_vendors (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  contact_name        TEXT,
  email               TEXT,
  phone               TEXT,
  verticals           JSONB,
  markup_share        NUMERIC,
  status              TEXT,
  assigned_jobs_count INTEGER DEFAULT 0,
  insurance_expiry    TEXT,
  tax_id              TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.incident_reports (
  id               TEXT PRIMARY KEY,
  business_name    TEXT NOT NULL,
  job_id           TEXT,
  contractor_id    TEXT,
  contractor_name  TEXT,
  reported_by      TEXT,
  category         TEXT,
  severity         TEXT,
  description      TEXT,
  status           TEXT,
  resolution_notes TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.integrations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT,
  status      TEXT,
  api_key     TEXT,
  webhook_url TEXT,
  last_sync   TIMESTAMPTZ
);
```

- [ ] **Step 2: Verify migration applies cleanly**

Run: `supabase db reset` (local) or check migration order. The file sorts after `000003` alphabetically.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260530000004_create_missing_tables.sql
git commit -m "feat(db): add CREATE TABLE migrations for 8 missing tables"
```

---

## Task 2: Add candidates table missing columns

**Files:**
- Create: `supabase/migrations/20260530000006_add_candidates_columns.sql`

- [ ] **Step 1: Write the ALTER TABLE migration**

```sql
-- Migration: Add missing columns to candidates table
-- These columns are referenced in edge functions (accounting, payroll, checkr, dropbox-sign)
-- and TypeScript types but absent from the init_schema migration

ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS vendor_id TEXT;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS background_check_id TEXT;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260530000006_add_candidates_columns.sql
git commit -m "feat(db): add missing columns to candidates table"
```

---

## Task 3: Add RLS to users table

**Files:**
- Modify: `supabase/migrations/20260530000001_auth_rls.sql` (append after line 110)

- [ ] **Step 1: Append RLS enable + policies to the existing migration**

Append to the end of `supabase/migrations/20260530000001_auth_rls.sql`:

```sql
-- RLS for users table (missing from original migration)
CREATE POLICY users_select_policy ON public.users
  FOR SELECT USING (current_user_role() IN ('owner', 'recruiter', 'scheduler', 'payroll'));

CREATE POLICY users_insert_policy ON public.users
  FOR INSERT WITH CHECK (current_user_role() IN ('owner'));

CREATE POLICY users_update_policy ON public.users
  FOR UPDATE USING (current_user_role() IN ('owner'));
```

Note: `users` must also have `ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;` added. Check if `users` is in the `ALTER TABLE` block at lines 24-33. If not, add it.

- [ ] **Step 2: Verify `users` is in the ENABLE list**

Read the file. If line 32 area does not include `ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;`, add it after line 32.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260530000001_auth_rls.sql
git commit -m "security(db): add RLS policies for users table"
```

---

## Task 4: Add database indexes

**Files:**
- Create: `supabase/migrations/20260530000005_add_indexes.sql`

- [ ] **Step 1: Write the indexes migration**

```sql
-- Migration: Add indexes for high-frequency query columns

-- Jobs: status is filtered constantly in scheduler views
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs (status);

-- Candidates: email lookup for auth and deduplication
CREATE INDEX IF NOT EXISTS idx_candidates_email ON public.candidates (email);

-- Integration events: provider + external_id is the idempotency lookup key
CREATE INDEX IF NOT EXISTS idx_integration_events_provider_external
  ON public.integration_events (provider, external_id);

-- Integration events: object_id for reverse lookups from candidates/jobs
CREATE INDEX IF NOT EXISTS idx_integration_events_object
  ON public.integration_events (object_type, object_id);

-- System logs: category for filtered views
CREATE INDEX IF NOT EXISTS idx_system_logs_category ON public.system_logs (category);

-- System logs: created_at for time-range queries
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs (created_at);

-- Users: email for login lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);

-- Users: role for RLS function performance
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users (role);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260530000005_add_indexes.sql
git commit -m "perf(db): add indexes on high-frequency query columns"
```

---

## Task 5: Fix Dropbox Sign test_mode

**Files:**
- Modify: `supabase/functions/dropbox-sign/send-request.ts:52`

- [ ] **Step 1: Read the file to confirm the line**

Read `supabase/functions/dropbox-sign/send-request.ts`. Find the line with `test_mode: true`.

- [ ] **Step 2: Change to use env var**

Replace `test_mode: true` with:
```typescript
test_mode: Deno.env.get('DROPBOX_SIGN_TEST_MODE') === 'true',
```

This defaults to `false` (production mode) unless explicitly set.

- [ ] **Step 3: Add the env var to .env.example**

Append to `.env.example`:
```
DROPBOX_SIGN_TEST_MODE=false
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/dropbox-sign/send-request.ts .env.example
git commit -m "fix(security): remove hardcoded test_mode from Dropbox Sign"
```

---

## Task 6: Consolidate error modules

**Files:**
- Modify: `supabase/functions/shared/error.ts`

- [ ] **Step 1: Add AppError re-export and deprecation notice**

Add to the top of `supabase/functions/shared/error.ts`:

```typescript
// DEPRECATED: New code should import AppError from './errors.ts' and ok/fail from './response.ts'
// This module is kept for backward compatibility with existing edge functions.
export { AppError } from './errors.ts'
```

This lets existing functions that import from `error.ts` access `AppError` without changes, while new code uses `errors.ts` directly.

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/shared/error.ts
git commit -m "refactor(shared): add AppError re-export to error.ts for backward compat"
```

---

## Task 7: Migrate checkr/invite-candidate.ts

**Files:**
- Modify: `supabase/functions/checkr/invite-candidate.ts`

- [ ] **Step 1: Read current file**

Read `supabase/functions/checkr/invite-candidate.ts` fully.

- [ ] **Step 2: Apply the new pattern**

The refactored function should:
1. Import `AppError` from `../shared/errors.ts`, `ok`/`fail` from `../shared/response.ts`, `logEvent` from `../shared/logger.ts`
2. Generate `requestId` at top
3. Create supabase client with service role key
4. Log start event
5. Validate input
6. Call Checkr API with `withRetry`
7. On success: write integration_events, log success, return `ok()`
8. On error: classify with `AppError`, log failure, return `fail()`

Preserve all existing business logic (Checkr API endpoint, body shape, integration_events writes).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/checkr/invite-candidate.ts
git commit -m "refactor(functions): migrate checkr/invite-candidate to shared modules"
```

---

## Task 8: Migrate checkr/webhook.ts

**Files:**
- Modify: `supabase/functions/checkr/webhook.ts`

- [ ] **Step 1: Read current file**

Read `supabase/functions/checkr/webhook.ts` fully.

- [ ] **Step 2: Apply the new pattern**

Keep existing logic (HMAC verification, idempotency check, candidate status update). Add:
1. `requestId` generation
2. `logEvent` for start/success/rejected
3. `AppError` for invalid signature
4. `ok()`/`fail()` for responses

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/checkr/webhook.ts
git commit -m "refactor(functions): migrate checkr/webhook to shared modules"
```

---

## Task 9: Migrate twilio/send-sms.ts

**Files:**
- Modify: `supabase/functions/twilio/send-sms.ts`

- [ ] **Step 1: Read current file**

Read `supabase/functions/twilio/send-sms.ts` fully.

- [ ] **Step 2: Apply the new pattern**

1. Import shared modules
2. Generate `requestId`
3. Log start
4. Call Twilio with `withRetry`
5. Map errors: 401 → INVALID_CREDENTIALS, 429 → RATE_LIMITED, 5xx → UPSTREAM_ERROR
6. Write integration_events (keep existing)
7. Log outcome
8. Return `ok()`/`fail()`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/twilio/send-sms.ts
git commit -m "refactor(functions): migrate twilio/send-sms to shared modules"
```

---

## Task 10: Migrate twilio/status-webhook.ts

**Files:**
- Modify: `supabase/functions/twilio/status-webhook.ts`

- [ ] **Step 1: Read current file**

- [ ] **Step 2: Apply the new pattern**

Keep Twilio signature verification. Add requestId, logEvent, AppError, ok/fail.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/twilio/status-webhook.ts
git commit -m "refactor(functions): migrate twilio/status-webhook to shared modules"
```

---

## Task 11: Migrate payroll/sync-employee.ts

**Files:**
- Modify: `supabase/functions/payroll/sync-employee.ts`

- [ ] **Step 1: Read current file**

- [ ] **Step 2: Apply the new pattern**

Same structure as accounting/sync-employee.ts (already migrated). Import shared modules, generate requestId, logEvent, withRetry, AppError mapping, ok/fail.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/payroll/sync-employee.ts
git commit -m "refactor(functions): migrate payroll/sync-employee to shared modules"
```

---

## Task 12: Migrate dropbox-sign/send-request.ts

**Files:**
- Modify: `supabase/functions/dropbox-sign/send-request.ts`

- [ ] **Step 1: Read current file**

- [ ] **Step 2: Apply the new pattern**

Apply shared modules. Also incorporate the test_mode fix from Task 5 if not already done.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/dropbox-sign/send-request.ts
git commit -m "refactor(functions): migrate dropbox-sign/send-request to shared modules"
```

---

## Task 13: Migrate dropbox-sign/webhook.ts

**Files:**
- Modify: `supabase/functions/dropbox-sign/webhook.ts`

- [ ] **Step 1: Read current file**

- [ ] **Step 2: Apply the new pattern**

Keep HMAC-SHA256 verification. Add shared modules.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/dropbox-sign/webhook.ts
git commit -m "refactor(functions): migrate dropbox-sign/webhook to shared modules"
```

---

## Task 14: Migrate okta/login.ts

**Files:**
- Modify: `supabase/functions/okta/login.ts`

- [ ] **Step 1: Read current file**

- [ ] **Step 2: Apply the new pattern**

This is the most complex function (OAuth flow with state/csrf). Keep all existing logic. Add requestId, logEvent at key points (auth start, callback received, user created, error). Use AppError for auth failures. Use ok/fail for responses.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/okta/login.ts
git commit -m "refactor(functions): migrate okta/login to shared modules"
```

---

## Task 15: Migrate okta/saml.ts

**Files:**
- Modify: `supabase/functions/okta/saml.ts`

- [ ] **Step 1: Read current file**

- [ ] **Step 2: Apply the new pattern**

Keep SAML XML parsing logic. Add shared modules.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/okta/saml.ts
git commit -m "refactor(functions): migrate okta/saml to shared modules"
```

---

## Task 16: Add edge function tests

**Files:**
- Create: `tests/functions/checkr-webhook.test.ts`
- Create: `tests/functions/twilio-send-sms.test.ts`
- Create: `vitest.config.ts`

- [ ] **Step 1: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['supabase/functions/**/*.ts'],
      exclude: ['supabase/functions/shared/**'],
    },
  },
})
```

- [ ] **Step 2: Write checkr-webhook test**

Create `tests/functions/checkr-webhook.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('checkr-webhook', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects non-POST requests', async () => {
    const req = new Request('http://localhost', { method: 'GET' })
    // Import the handler and invoke it
    // Assert response status is 400
  })

  it('rejects invalid webhook signatures', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'X-Checkr-Signature': 'invalid' },
      body: JSON.stringify({ id: '1', type: 'report.completed', data: {} }),
    })
    // Assert response status is 401
  })

  it('processes valid report.completed webhook', async () => {
    // Mock supabase client
    // Mock HMAC verification to return true
    // Call handler
    // Assert integration_events insert was called
    // Assert system_logs insert was called
    // Assert response is 200
  })
})
```

Note: Exact test implementation depends on how the handler is exported. If `Deno.serve` is used, tests need to mock the Deno global and extract the handler function.

- [ ] **Step 3: Write twilio-send-sms test**

Create `tests/functions/twilio-send-sms.test.ts` with similar structure:
- Test POST method required
- Test missing `to`/`body` returns 400
- Test successful send writes to integration_events
- Test Twilio API error returns proper error

- [ ] **Step 4: Commit**

```bash
git add tests/functions/ vitest.config.ts
git commit -m "test(functions): add edge function tests for checkr-webhook and twilio-send-sms"
```

---

## Task 17: Configure ESLint

**Files:**
- Create: `eslint.config.js`

- [ ] **Step 1: Create ESLint config**

```javascript
import js from '@eslint/js'

export default [
  js.configs.recommended,
  {
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  {
    ignores: ['supabase/functions/**/*.ts', 'node_modules/**'],
  },
]
```

- [ ] **Step 2: Verify ESLint runs**

Run: `npx eslint src/ --max-warnings 0`
Expected: Pass or only warnings (no errors).

- [ ] **Step 3: Update CI to not silently skip**

Read `.github/workflows/main.yml`. Find the eslint step. Remove the `|| echo "..."` fallback so failures are caught.

- [ ] **Step 4: Commit**

```bash
git add eslint.config.js .github/workflows/main.yml
git commit -m "chore(ci): configure ESLint and remove silent skip fallback"
```

---

## Task 18: Fix TypeScript types sync

**Files:**
- Modify: `src/shared/types/database.ts`

- [ ] **Step 1: Read current file**

Read `src/shared/types/database.ts`.

- [ ] **Step 2: Add missing columns**

Add to the `candidates` row type:
```typescript
created_at: string | null
vendor_id: string | null
first_name: string | null
last_name: string | null
background_check_id: string | null
```

Add to the `users` row type:
```typescript
is_active: boolean | null
```

Add to the `sso_config` row type:
```typescript
role_mapping: Record<string, string> | null
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/types/database.ts
git commit -m "fix(types): sync database.ts with actual DB schema"
```

---

## Execution Order

| Phase | Tasks | Dependency |
|-------|-------|------------|
| **1. Database foundation** | Task 1, 2, 3, 4 | None — all independent, can run in parallel |
| **2. Security fix** | Task 5 | None |
| **3. Module consolidation** | Task 6 | None |
| **4. Function migration** | Tasks 7-15 | Task 6 (AppError re-export) |
| **5. Testing** | Task 16 | Tasks 7-15 (tests cover migrated functions) |
| **6. Tooling** | Task 17, 18 | None |

Tasks 1-6 can be dispatched in parallel. Tasks 7-15 can be batched (3-4 at a time). Tasks 16-18 can run in parallel.
