# BlockLabor

A professional staffing marketplace platform connecting businesses with skilled labor.

## Tech Stack
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Zustand
- **Backend:** Supabase (Postgres, Auth, RLS, Edge Functions, Vault)
- **Integrations:** Dropbox Sign (e-signatures), Twilio (SMS), Checkr (background checks), Okta (SSO), QuickBooks, Gusto
- **Observability:** Sentry
- **Testing:** Vitest (unit), Playwright (E2E)
- **CI/CD:** GitHub Actions

## Prerequisites
- Node.js (v22+)
- npm

## Setup
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in your credentials
3. `npm run dev`

## Integrations
All external API integrations are implemented as Supabase Edge Functions in `supabase/functions/`:
- **Dropbox Sign**: `send-request.ts`, `webhook.ts`
- **Twilio**: `send-sms.ts`, `status-webhook.ts`
- **Checkr**: `invite-candidate.ts`, `webhook.ts`
- **Okta**: `login.ts` (OIDC), `saml.ts` (SAML fallback)
- **QuickBooks**: `sync-employee.ts`
- **Gusto**: `sync-employee.ts`

## Project Structure
```
src/
  features/       Feature-based domain modules (jobs, candidates, etc.)
  shared/         Shared types, services, and utilities
  app/            App shell and routing
supabase/
  functions/      Edge Functions for integrations
  migrations/     Database migrations
tests/
  e2e/            Playwright E2E tests
```

## Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Production build
- `npm run preview` - Preview production build
- `npm run lint` - TypeScript type checking
