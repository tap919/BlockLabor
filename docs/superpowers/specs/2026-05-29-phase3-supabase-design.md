# Phase 3: Supabase Backend Implementation Design

## Goal
Implement a persistent backend using Supabase, replacing in-memory state with a database-backed API.

## 1. Schema & Migration (`feat/db-schema`)
- **Initialization:** Initialize Supabase CLI project.
- **Migration:** Convert the canonical SQL schema into `supabase/migrations/*.sql`.
- **Seeding:** Convert `src/shared/mocks/data.ts` to `supabase/seed.sql` for consistent development environments.

## 2. Authentication & Security (`feat/auth-rbac`)
- **Auth Setup:** Enable Supabase Auth.
- **Identity:** Utilize `users` table linked to Supabase Auth `uid`.
- **RBAC & RLS:** Define strict Row Level Security (RLS) policies for all tables, restricting access by user role (`client`, `worker`, `admin`, etc.).

## 3. Service Layer Integration (`feat/supabase-integration`)
- **Client Library:** Implement `src/shared/lib/supabaseClient.ts`.
- **Data Access:** Refactor `src/shared/services/*.service.ts` to utilize `@supabase/supabase-js` for CRUD operations, replacing mock-state mutations.

## 4. Audit & Observability (`feat/audit-logs`)
- **Triggers:** Implement database triggers for critical state changes to populate `system_logs` for an immutable audit trail.

## Deliverables
- Fully migrated Supabase database schema.
- Role-based authentication and security (RLS).
- Persistent data access layer via Supabase API.
- Automated system logs via database triggers.
