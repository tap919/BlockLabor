# Phase 4: Integrations & Polish Design (Refined)

## Goal
Transform BlockLabor's simulated integrations into real, production-ready workflows, harden the platform, and finalize its positioning as a professional staffing marketplace.

## 1. Integration Workstreams

### 1.1. Accounting & Payroll (QuickBooks/Gusto)
*   **Architecture:** Supabase Edge Functions for all external API interactions (OAuth, webhooks, server-to-server calls).
*   **OAuth Management:** Hybrid approach: Centralized Edge Function for initial OAuth redirect, dispatching to integration-specific Edge Functions for token exchange and secure storage in Supabase Vault.
*   **Data Sync:** BlockLabor Initiated Push: User actions directly trigger pushes to external systems.
*   **Error Handling:** Direct structured logging from each integration function to `system_logs` table, complemented by `console.log`/`console.error` for observability.

### 1.2. E-Signature Integration (Dropbox Sign)
*   **Provider:** **Dropbox Sign (HelloSign)**. Chosen for developer-friendly API, cost-effectiveness, and compliance (E-SIGN Act, UETA, eIDAS).
*   **Trigger Model:** **Both Manual and Automated**.
    *   Automated: Backend (via Edge Function) fires `POST /v3/signature_request/send` when candidate status transitions to `onboarded`.
    *   Manual: Staff in `StaffDashboard` or `CandidateReviewTable` can trigger ad-hoc signing requests.
*   **API Interactions:** Supabase Edge Functions to securely interact with Dropbox Sign API (sending requests, handling embedded signing via iFrame, receiving webhook callbacks for `signature_request_signed`, `signature_request_declined`).

### 1.3. Background Checks (Checkr)
*   **Provider:** **Checkr**.
*   **API Management:** Secure Storage + Dedicated Edge Function: Checkr API key in Supabase Vault. Dedicated Edge Function for candidate creation/invitation, report polling/retrieval, and webhook receiver to update worker eligibility state. Assignment eligibility gated off a normalized internal status.

### 1.4. Enterprise Identity (SSO) (Okta)
*   **Provider:** **Okta**.
*   **Protocol:** **OIDC first, SAML as fallback**.
*   **Role Mapping:** **Configurable Mapping**. Read `groups` claim from OIDC, map via `SsoConfig.role_mapping` (JSON object). Just-in-Time (JIT) provisioning with `worker` as default role if no mapping matches.

### 1.5. Communications & Dispatch (SMS) (Twilio)
*   **Provider:** **Twilio**.
*   **Critical SMS Types:** Job Assignment, Job Status Change, Incident Alert, Timesheet Reminders, Background Check Status.
*   **API Interactions:** Supabase Edge Functions to send messages via Twilio API (`POST /2010-04-01/Accounts/{AccountSid}/Messages`), persist a message record immediately, and reconcile final delivery state from Twilio callbacks into both `system_logs` and the message record.

## 2. Architecture Refinements (Cross-cutting)
*   **Shared Integration Framework:** Create one request signer, one webhook verifier, one retry/idempotency helper, one audit logger, and one standard error envelope for every provider.
*   **Integration Tracking Table:** Add a single `integration_events` or `integration_jobs` table (alongside `system_logs`) to track provider, object type, external ID, status, attempts, last error, and last webhook timestamp.

## 3. Product Hardening & Polish

### 3.1. Observability & Error Tracking
*   **Error Tracking:** **Sentry**. Implement SDK for both frontend and Supabase Edge Functions (Deno SDK). Capture full stack traces with context, integrate with GitHub for release tracking. Wrap third-party API calls in `captureException`.

### 3.2. Testing
*   **Unit Tests:** **Vitest**.
*   **E2E Tests:** **Playwright**.
*   **Critical E2E Flows:** Booking, Candidate Onboarding, Incident Resolution, Enterprise Settings, E-Sign flow, SMS dispatch flow, Payroll export flow, SSO login flow.
*   **Provider Contract Tests:** Add a separate layer to mock Dropbox Sign, Twilio, and Checkr webhooks and verify signature validation, idempotency, retries, and role-based access outcomes.

### 3.3. CI/CD Pipeline
*   **GitHub Actions.**
    *   **Lint & Type Check:** Every push/PR (`eslint`, `tsc --noEmit`).
    *   **Unit Tests:** Every push/PR (`vitest run`).
    *   **E2E Tests:** PR to `main` (`playwright test` against staging).
    *   **Build Check:** PR to `main` (`vite build`).
    *   **Deploy to Staging:** Merge to `main`.

### 3.4. Final Cleanup
*   **Scaffold Artifacts:** Focus on documentation accuracy and ensuring all integration environment variables are properly named and documented. The previous phases addressed most generic scaffold content.

## 4. Delivery Order (Sprints)
*   **Sprint 1:** Shared integration framework, Sentry, CI/CD, secrets management (Supabase Vault), and base webhook/idempotency utilities.
*   **Sprint 2:** Dropbox Sign and Twilio integrations.
*   **Sprint 3:** Checkr and Okta integrations.
*   **Sprint 4:** QuickBooks/Gusto polish, test expansion, UI cleanup, docs, and staging hardening before production cutover.
