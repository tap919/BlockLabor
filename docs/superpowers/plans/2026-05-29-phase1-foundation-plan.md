# Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish project governance, identity, and foundational documentation.

**Architecture:** Initialize Git workflow, normalize package metadata, clean dependencies, and rewrite documentation.

**Tech Stack:** Git, NPM/Node.js, Markdown.

---

### Task 1: Establish Git Workflow

**Files:**
- Create: `PULL_REQUEST_TEMPLATE.md`
- Modify: `.git/config` (or local git commands)

- [ ] **Step 1: Create local dev branch**

```bash
git checkout -b dev
```

- [ ] **Step 2: Create PR template**

Create `PULL_REQUEST_TEMPLATE.md` at root:
```markdown
## Description
<!-- Briefly describe the changes -->

## Impact
<!-- Explain what this affects -->

## Testing
<!-- How have you tested these changes? -->
```

- [ ] **Step 3: Commit PR template**

```bash
git add PULL_REQUEST_TEMPLATE.md
git commit -m "chore: add pull request template"
```

### Task 2: Project Identity & Dependency Audit

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update package.json metadata**

Modify `package.json`:
- `name`: "block-labor"
- `version`: "0.1.0"

- [ ] **Step 2: Audit dependencies**

Move `express` and `dotenv` from `dependencies` to `devDependencies` in `package.json`.

- [ ] **Step 3: Verify build still works**

```bash
npm install
npm run lint
```

- [ ] **Step 4: Commit changes**

```bash
git add package.json
git commit -m "chore: rename package to block-labor and update dependency declarations"
```

### Task 3: README Rewrite

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Rewrite README content**

Replace `README.md` content with:

```markdown
# BlockLabor

A professional staffing marketplace platform.

## Prerequisites
- Node.js (v20+)
- npm

## Setup
1. `npm install`
2. Configure `.env.local` using `.env.example`
3. `npm run dev`

## Roadmap
- Phase 1: Foundation (Current)
- Phase 2: Architecture Refactor
- Phase 3: Backend Integration
- Phase 4: Integrations & Polish
```

- [ ] **Step 2: Commit changes**

```bash
git add README.md
git commit -m "docs: rewrite README to remove AI Studio boilerplate"
```

### Task 4: Environment Documentation

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Create/Update .env.example**

Replace/Create `.env.example` with:

```text
# Required for development
# VITE_API_URL=http://localhost:3000

# Placeholder for future backend
# GEMINI_API_KEY=
```

- [ ] **Step 2: Commit changes**

```bash
git add .env.example
git commit -m "chore: update environment configuration template"
```
