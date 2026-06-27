# ⚡ Bobby Breakdown

> AI-powered concept explainer for developers, scientists, and builders — powered by Claude (Anthropic)

Bobby Breakdown lives in your VS Code sidebar and helps you **instantly understand** complex ideas, code, and concepts across five expert domains. It also converts books and documents into dense **LLM Guides** — cliff-noted references optimized for AI agents and software development.

---

## Features

### ⚡ Concept Breakdown
Select any text in your editor or type a concept, and Bobby will explain it in your preferred format and domain.

**5 Expert Domains:**
| Domain | Focus |
|--------|-------|
| 💻 **Coding** | Algorithms, design patterns, architectures, frameworks |
| 🧬 **Biotech** | Genomics, CRISPR, molecular biology, drug discovery |
| 📈 **Fintech** | Options, derivatives, market microstructure, DeFi |
| 📣 **Marketing** | Growth frameworks, CAC/LTV, brand strategy, funnels |
| 🎮 **GameDev** | ECS, shaders, game loops, AI, procedural generation |

**5 Breakdown Formats:**
- 📋 **Structured** — Concept → How It Works → Example → Takeaways
- 🧒 **ELI5** — Plain English with vivid analogies
- ⚙️ **Technical Deep-Dive** — Algorithms, edge cases, code examples
- 🗺️ **Visual Map** — ASCII diagrams, flow charts, reference tables
- ⚡ **Quickfire** — 6 punchy bullets, no fluff

**🛠️ Dev Toolkit Formats** *(new — for working on unfamiliar codebases)*:
- 🚶 **Walkthrough** — Paste any code: get a step-by-step execution trace, variable state, decision points, and safe-to-modify zones. Ideal for understanding someone else's code fast.
- 📋 **Plan It** — Describe a task: get a numbered implementation plan with effort estimates, starter code snippets, dependency list, gotchas, and done criteria.
- 🔧 **Fix Error** — Paste an error message (± code context): get the error decoded in plain English, root cause, step-by-step fix, before/after code, and how to prevent it.

### 📚 Book → LLM Guide
Upload or paste any book/document text. Bobby generates a dense **LLM Guide** with:
- 🧠 Core Knowledge Atoms (20 distilled facts)
- 🗺️ Conceptual Frameworks
- 📖 Terminology Glossary
- ⚙️ Implementation Patterns
- 🌲 Decision Trees
- ⚠️ Anti-Patterns & Warnings
- 🤖 Agentic Prompting Notes
- ⚡ Quick Reference Cheatsheet

Perfect for feeding into AI coding assistants, RAG pipelines, or as context for Claude Projects.

---

## Setup

### 1. Install the extension
```bash
# From VSIX
code --install-extension bobby-breakdown-1.0.0.vsix
```

### 2. Set your Anthropic API key
Open the command palette (`Ctrl+Shift+P`) and run:
```
Bobby Breakdown: Set Anthropic API Key
```

Or set the environment variable:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Or add to VS Code settings:
```json
{
  "bobbyBreakdown.apiKey": "sk-ant-..."
}
```

---

## Usage

### Keyboard Shortcuts
| Action | Windows/Linux | Mac |
|--------|--------------|-----|
| Open Panel | `Ctrl+Shift+B` | `Cmd+Shift+B` |
| Break Down Selection | `Ctrl+Shift+X` | `Cmd+Shift+X` |
| Quick Explain Selection | `Ctrl+Shift+E` | `Cmd+Shift+E` |

### Right-Click Menu
Select any text → right-click → **Bobby Breakdown: Break Down Selected Text**

### Command Palette
- `Bobby Breakdown: Open Panel`
- `Bobby Breakdown: Break Down Selected Text`
- `Bobby Breakdown: Process Book / Document → LLM Guide`
- `Bobby Breakdown: Set Anthropic API Key`

---

## Configuration

```json
{
  "bobbyBreakdown.apiKey": "",           // Your Anthropic API key
  "bobbyBreakdown.defaultDomain": "coding",  // coding|biotech|fintech|marketing|gamedev
  "bobbyBreakdown.defaultFormat": "structured", // structured|eli5|technical|visual|quickfire
  "bobbyBreakdown.model": "claude-sonnet-4-20250514"
}
```

---

## Building from Source

```bash
git clone https://github.com/your-repo/bobby-breakdown
cd bobby-breakdown
npm install
npm run compile
npx vsce package
```

---

## Use Cases

**For Software Engineers:**
- Paste confusing code or error messages for instant breakdown
- Understand design patterns, CS concepts, new frameworks
- **🚶 Walkthrough** unfamiliar code files to get up to speed in seconds
- **📋 Plan It** to turn a vague feature request into a concrete implementation plan
- **🔧 Fix Error** to decode stack traces and get step-by-step fixes

**For Biotech/Life Science Devs:**
- Break down research papers, gene editing concepts, lab protocols
- Convert biology textbooks into LLM-ready reference guides

**For Fintech Builders:**
- Understand derivatives, market mechanics, regulatory concepts
- Process finance books into agentic knowledge bases

**For Marketing Tech:**
- Break down growth frameworks, attribution models, campaign concepts
- Convert marketing playbooks into structured LLM guides

**For Game Developers:**
- Understand complex engine systems, rendering pipelines, AI patterns
- Convert game design docs into agent-accessible references

---

*Powered by Claude (Anthropic) — claude-sonnet-4-20250514*
