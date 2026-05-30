# Phase 2: Architecture Refactor Design (Updated)

## Goal
Transform the BlockLabor monolithic architecture into a scalable, feature-oriented, and type-safe foundation without altering behavior.

## 1. Directory Structure
- `src/app`: App shell, providers, routing.
- `src/features`: Feature modules (`jobs`, `candidates`, `incidents`, `integrations`, `vendors`, `admin`, `booking`, `navigation`).
- `src/shared`: `ui`, `types` (move `types.ts` here), `lib`, `services`, `mocks` (move `data.ts` here).

## 2. Refactor Tasks
- **Task 1: Extract app shell** - Separate routing/layout from logic.
- **Task 2: Introduce typed state slices** - Extract business logic from `App.tsx` into stores/hooks.
- **Task 3: Split the booking feature** - Break `BookLabor.tsx` into smaller, focused modules.
- **Task 4: Split the large portals** - Break `StaffDashboard.tsx`, `ContractorPortal.tsx`, `ClientPortal.tsx` into feature-based sub-components.
- **Task 5: Remove `any` usage** - Hard-type all props/state using `shared/types/domain.ts`.
- **Task 6: Add a service layer** - Abstract data access via `src/shared/services`.

## Deliverables
- `App.tsx` under 200 lines.
- Feature modules < 400 lines each.
- No `any` type usage for domain models.
- Business logic isolated from view components.
