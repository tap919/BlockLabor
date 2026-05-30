# Phase 3: Supabase Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement persistent backend using Supabase, replacing in-memory state.

**Architecture:** Migration to Supabase schema, RBAC with RLS, Service layer refactor.

**Tech Stack:** Supabase (Postgres, Auth, RLS), TypeScript.

---

### Task 1: Initialize Supabase
- [ ] **Step 1:** Initialize local Supabase project: `npx supabase init`.
- [ ] **Step 2:** Create migration files for canonical schema provided in spec.
- [ ] **Step 3:** Commit schema changes.

### Task 2: Implement Auth & RBAC
- [ ] **Step 1:** Configure Supabase Auth.
- [ ] **Step 2:** Define RLS policies for each table based on user roles (`client`, `worker`, etc.).
- [ ] **Step 3:** Commit.

### Task 3: Migrate Services (Data Layer)
- [ ] **Step 1:** Configure `src/shared/lib/supabaseClient.ts`.
- [ ] **Step 2:** Refactor `src/shared/services/*.service.ts` to use Supabase client.
- [ ] **Step 3:** Verify CRUD operations work against Supabase.
- [ ] **Step 4:** Commit.

### Task 4: Audit & Observability
- [ ] **Step 1:** Implement database triggers for `system_logs` on critical table mutations.
- [ ] **Step 2:** Commit.
