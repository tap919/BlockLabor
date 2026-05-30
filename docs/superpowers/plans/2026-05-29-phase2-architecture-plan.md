# Phase 2: Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modularize monolith, improve type safety, establish data service layer.

**Architecture:** Feature-based extraction (shell, stores, services, feature components).

**Tech Stack:** React, TypeScript, Zustand (optional).

---

### Task 1: Extract App Shell
- [ ] **Step 1:** Create `src/app/AppShell.tsx` and move navigation layout there.
- [ ] **Step 2:** Refactor `App.tsx` to be a bootstrap component (under 200 lines).
- [ ] **Step 3:** Commit.

### Task 2: Introduce Typed State Slices
- [ ] **Step 1:** Create `src/features/*/store.ts` (or use shared hooks).
- [ ] **Step 2:** Move handlers (`handleBookJob`, etc.) from `App.tsx` to new stores/hooks.
- [ ] **Step 3:** Commit.

### Task 3: Split the Booking Feature
- [ ] **Step 1:** Decompose `BookLabor.tsx` into `BookingPage.tsx`, `BookingForm.tsx`, etc.
- [ ] **Step 2:** Move to `src/features/booking/`.
- [ ] **Step 3:** Commit.

### Task 4: Split the Large Portals
- [ ] **Step 1:** Decompose `StaffDashboard.tsx`, `ContractorPortal.tsx`, `ClientPortal.tsx`.
- [ ] **Step 2:** Create feature-based sub-components in respective folders (`features/admin`, etc.).
- [ ] **Step 3:** Commit.

### Task 5: Remove `any` Usage
- [ ] **Step 1:** Audit codebase for `any` usage.
- [ ] **Step 2:** Replace `any[]` with `BranchDivision[]`, `RateCard[]`, etc., using `src/shared/types/domain.ts`.
- [ ] **Step 3:** Commit.

### Task 6: Add Service Layer
- [ ] **Step 1:** Create `src/shared/services/*.service.ts`.
- [ ] **Step 2:** Refactor stores/components to use these services instead of `src/shared/mocks/data.ts` directly.
- [ ] **Step 3:** Commit.
