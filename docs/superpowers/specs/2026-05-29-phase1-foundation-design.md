# Phase 1: Foundation Design

## Goal
Establish project governance, identity, and foundational documentation for the BlockLabor staffing marketplace.

## 1. Repository Governance (`chore/repo-governance`)
- **Branches:** Establish `main` (protected/stable) and `dev` (integration).
- **Workflow:** All work occurs in `feat/` or `chore/` branches, merged into `dev`, then `dev` to `main`.
- **Commit Conventions:** Adopt conventional commits (`feat:`, `chore:`, `docs:`, `fix:`, `refactor:`).
- **PR Template:** Create a `PULL_REQUEST_TEMPLATE.md` requiring description, impact, and testing note.

## 2. Project Identity & Dependency Audit (`chore/project-identity`)
- **`package.json`:** Update `"name"` to `"block-labor"`, version to `"0.1.0"`, and update metadata.
- **Dependency Audit:** Move `express` and `dotenv` to `devDependencies` (pending backend implementation).
- **Cleanup:** Remove AI Studio scaffold remnants.

## 3. README Rewrite (`docs/readme-rewrite`)
- **Boilerplate removal:** Delete AI Studio default content.
- **Project Description:** Define BlockLabor as a staffing marketplace.
- **Setup:** Document prerequisites (Node.js, `npm install`), env setup, and commands.
- **Roadmap:** Outline current Phase 1 status and upcoming phases.

## 4. Environment Documentation (`chore/env-setup`)
- **`.env.example`:** Create a well-commented template. Document all keys and their purpose (required vs. future-facing).
