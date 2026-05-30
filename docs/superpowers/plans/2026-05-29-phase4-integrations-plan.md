# Phase 4: Integrations & Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement real integrations, harden the platform, and finalize its production readiness.

**Architecture:** Supabase Edge Functions for integrations, Sentry for error tracking, Vitest/Playwright for testing, GitHub Actions for CI/CD.

**Tech Stack:** Supabase (Edge Functions, Vault), Dropbox Sign, Checkr, Okta, Twilio, Sentry, Vitest, Playwright, GitHub Actions.

---

## Sprint 1: Foundation for Integrations

### Task 1.1: Shared Integration Framework (Edge Functions)
**Files:**
- Create: `supabase/functions/shared/auth.ts`, `supabase/functions/shared/webhook.ts`, `supabase/functions/shared/error.ts`, `supabase/functions/shared/idempotency.ts`
- Modify: `supabase/functions/shared/types.ts` (if needed for shared integration types)

- [ ] **Step 1: Create `supabase/functions/shared/auth.ts`**
  - Implement helpers for secure token retrieval from Supabase Vault or environment variables.
- [ ] **Step 2: Create `supabase/functions/shared/webhook.ts`**
  - Implement a generic webhook verification utility (e.g., for HMAC signatures).
- [ ] **Step 3: Create `supabase/functions/shared/error.ts`**
  - Implement a standardized error handling and response utility for Edge Functions.
- [ ] **Step 4: Create `supabase/functions/shared/idempotency.ts`**
  - Implement a basic idempotency key checking mechanism for webhook handlers.
- [ ] **Step 5: Commit.**

### Task 1.2: Sentry Integration
**Files:**
- Modify: `vite.config.ts`, `src/main.tsx` (frontend),
  `supabase/functions/utils/sentry.ts` (Edge Functions, create)
- Install: `@sentry/browser`, `@sentry/node`, `@sentry/deno`

- [ ] **Step 1: Install Sentry SDKs for frontend and Deno.**
  ```bash
  npm install @sentry/react @sentry/browser
  # For Deno Edge Functions, add to deps.ts or import map: https://docs.sentry.io/platforms/javascript/guides/deno/
  ```
- [ ] **Step 2: Configure Sentry in `src/main.tsx`** for frontend error tracking.
- [ ] **Step 3: Create `supabase/functions/utils/sentry.ts`** for Edge Function error tracking.
- [ ] **Step 4: Update Edge Functions** to use Sentry for error capturing (e.g., wrapping `try/catch` blocks).
- [ ] **Step 5: Commit.**

### Task 1.3: CI/CD Pipeline (GitHub Actions)
**Files:**
- Create: `.github/workflows/main.yml`

- [ ] **Step 1: Create `main.yml` for Lint, Type Check, Unit Test, Build Check.**
  - Define jobs for `eslint`, `tsc --noEmit`, `vitest run`, `vite build`.
  - Configure triggers for push and pull requests.
- [ ] **Step 2: Commit.**

### Task 1.4: Integration Tracking Table (`integration_events`)
**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_add_integration_events_table.sql`

- [ ] **Step 1: Create `integration_events` table migration.**
  ```sql
  CREATE TABLE IF NOT EXISTS public.integration_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider        TEXT NOT NULL,
    event_type      TEXT NOT NULL, -- e.g., 'webhook_received', 'api_call_failed', 'token_refresh'
    external_id     TEXT,          -- ID from external system (e.g., Checkr report ID, Dropbox Sign event ID)
    object_type     TEXT,          -- e.g., 'candidate', 'job', 'signature_request'
    object_id       UUID REFERENCES public.jobs(id) ON DELETE CASCADE, -- Link to relevant BlockLabor object
    status          TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processed', 'failed', 'ignored'
    payload         JSONB,         -- Full webhook payload or API response
    attempts        INTEGER DEFAULT 0,
    last_error      TEXT,
    last_webhook_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
  );
  -- Optional: Add RLS policy similar to system_logs
  ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
  CREATE POLICY integration_events_select_policy ON public.integration_events
    FOR SELECT USING (current_user_role() IN ('owner', 'recruiter', 'scheduler', 'payroll'));
  ```
- [ ] **Step 2: Apply migration.**
- [ ] **Step 3: Commit.**

### Task 1.5: Secrets Management (Supabase Vault)
**Files:**
- (Configuration within Supabase Dashboard)
- Modify: `supabase/functions/shared/auth.ts` (to retrieve secrets from Vault/env)

- [ ] **Step 1: Document secure storage process for API keys/tokens in Supabase Vault.** (Guide user through dashboard steps).
- [ ] **Step 2: Update `supabase/functions/shared/auth.ts`** to load secrets securely from Vault (or environment if Vault not directly usable by Edge Function).
- [ ] **Step 3: Commit.**

## Sprint 2: Dropbox Sign and Twilio Integrations

### Task 2.1: Dropbox Sign - Send Request Edge Function
**Files:**
- Create: `supabase/functions/dropbox-sign/send-request.ts`
- Modify: `src/features/candidates/candidateService.ts` (or similar service for triggering)

- [ ] **Step 1: Create `send-request.ts` Edge Function.**
  - Function takes `candidateId`, `templateId`, `documentDetails`.
  - Uses Dropbox Sign SDK/API to send signature request.
  - Stores `signature_request_id` in `integration_events` table.
- [ ] **Step 2: Update frontend service** to call this Edge Function.
- [ ] **Step 3: Commit.**

### Task 2.2: Dropbox Sign - Webhook Receiver Edge Function
**Files:**
- Create: `supabase/functions/dropbox-sign/webhook.ts`

- [ ] **Step 1: Create `webhook.ts` Edge Function.**
  - Verify webhook signature using `shared/webhook.ts`.
  - Parse event (`signature_request_signed`, `signature_request_declined`).
  - Update `candidate.e_sign_status` in Supabase.
  - Log event to `integration_events` and `system_logs`.
- [ ] **Step 2: Configure Dropbox Sign webhook URL to point to this Edge Function.**
- [ ] **Step 3: Commit.**

### Task 2.3: Twilio - Send SMS Edge Function
**Files:**
- Create: `supabase/functions/twilio/send-sms.ts`
- Modify: `src/shared/services/notificationService.ts` (create if not exists, or `jobs.service.ts`)

- [ ] **Step 1: Create `send-sms.ts` Edge Function.**
  - Takes `to`, `body`, `jobId`, `candidateId`.
  - Uses Twilio SDK/API to send SMS.
  - Stores message details in `integration_events` (or a dedicated `messages` table if needed).
- [ ] **Step 2: Update relevant frontend/backend logic** (e.g., job assignment, status change) to call this Edge Function.
- [ ] **Step 3: Commit.**

### Task 2.4: Twilio - Delivery Status Webhook Edge Function
**Files:**
- Create: `supabase/functions/twilio/status-webhook.ts`

- [ ] **Step 1: Create `status-webhook.ts` Edge Function.**
  - Verify Twilio webhook signature.
  - Parse delivery status (`delivered`, `failed`).
  - Update `integration_events` record for the message.
  - Log to `system_logs`.
- [ ] **Step 2: Configure Twilio webhook URL to point to this Edge Function.**
- [ ] **Step 3: Commit.**

## Sprint 3: Checkr and Okta Integrations

### Task 3.1: Checkr - Candidate Invitation Edge Function
**Files:**
- Create: `supabase/functions/checkr/invite-candidate.ts`
- Modify: `src/features/candidates/candidateService.ts`

- [ ] **Step 1: Create `invite-candidate.ts` Edge Function.**
  - Takes `candidateId`.
  - Uses Checkr API to create candidate and initiate background check.
  - Stores Checkr `candidate_id` and `report_id` in `integration_events` and/or `candidates` table.
- [ ] **Step 2: Update `candidateService`** to call this Edge Function when `backgroundCheckStatus` changes to `pending`.
- [ ] **Step 3: Commit.**

### Task 3.2: Checkr - Webhook Receiver Edge Function
**Files:**
- Create: `supabase/functions/checkr/webhook.ts`

- [ ] **Step 1: Create `webhook.ts` Edge Function.**
  - Verify Checkr webhook signature.
  - Parse event (`candidate.report.completed`, `candidate.report.adverse_action`).
  - Update `candidate.background_check_status`.
  - Log to `integration_events` and `system_logs`.
- [ ] **Step 2: Configure Checkr webhook URL to point to this Edge Function.**
- [ ] **Step 3: Commit.**

### Task 3.3: Okta - OIDC Login Edge Function
**Files:**
- Create: `supabase/functions/okta/login.ts`
- Modify: `src/app/AppShell.tsx` (or `src/features/auth/AuthService.ts` if created)

- [ ] **Step 1: Create `login.ts` Edge Function.**
  - Handle Okta OIDC redirect, token exchange.
  - Read `groups` claim from ID token.
  - Implement configurable role mapping from `SsoConfig.role_mapping`.
  - Create/update user in `public.users` table with mapped role.
  - Return JWT to frontend.
- [ ] **Step 2: Update frontend login flow** to initiate OIDC via this Edge Function.
- [ ] **Step 3: Commit.**

### Task 3.4: Okta - SAML Fallback (Optional, but planned)
**Files:**
- Create: `supabase/functions/okta/saml.ts`

- [ ] **Step 1: Create `saml.ts` Edge Function** to handle SAML assertions as a fallback.
- [ ] **Step 2: Implement similar role mapping and user provisioning** as OIDC flow.
- [ ] **Step 3: Commit.**

## Sprint 4: Polish, Testing & Deployment

### Task 4.1: QuickBooks/Gusto API Integration (Refinement)
**Files:**
- Modify: `supabase/functions/accounting/`, `supabase/functions/payroll/` (existing placeholders or new files)

- [ ] **Step 1: Implement full API interactions** for QuickBooks/Gusto based on confirmed data push events.
- [ ] **Step 2: Ensure secure credential handling** via Supabase Vault.
- [ ] **Step 3: Commit.**

### Task 4.2: Expanded E2E Test Coverage (Playwright)
**Files:**
- Create/Modify: `tests/e2e/**/*.spec.ts`

- [ ] **Step 1: Implement Playwright tests** for:
  - Failed OAuth reconnect.
  - Duplicate webhook delivery.
  - Adverse-action/background-check exception path.
  - Worker re-onboarding after expired document.
- [ ] **Step 2: Commit.**

### Task 4.3: Final UI & Docs Cleanup
**Files:**
- Modify: `README.md`, `.env.example`, `package.json` (version)

- [ ] **Step 1: Review and remove any remaining AI Studio/Gemini boilerplate or generic content.**
- [ ] **Step 2: Ensure all environment variables are documented** (e.g., `CHECKR_API_KEY`, `TWILIO_ACCOUNT_SID`).
- [ ] **Step 3: Update `package.json`** version to `1.0.0` or appropriate release version.
- [ ] **Step 4: Commit.**

### Task 4.4: Staging Hardening & Deployment Preparation
**Files:**
- (Deployment configuration for Supabase / Vercel if frontend is hosted separately)

- [ ] **Step 1: Document staging environment setup and deployment process.**
- [ ] **Step 2: Review all RLS policies** for completeness and security.
- [ ] **Step 3: Ensure Sentry is fully configured** for production environments.
- [ ] **Step 4: Commit.**
