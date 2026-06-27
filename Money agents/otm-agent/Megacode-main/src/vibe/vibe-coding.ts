/**
 * Vibe Coding Reliability Layer for OverCoat.
 *
 * "Vibe coding" describes the experience of building software through
 * natural-language conversation with an AI, often without deep technical
 * knowledge.  This module adds 15 features that make that experience more
 * reliable, safer, and more understandable for everyone — not just experts.
 *
 * Features implemented here:
 *
 *  1.  PlainEnglishErrorExplainer  — turns cryptic runtime errors into one
 *      sentence of plain English plus a single actionable suggestion.
 *
 *  2.  IntentValidator             — checks that an AI response actually
 *      addresses what the user asked, returning a 0-1 confidence score.
 *
 *  3.  ConfidenceIndicator         — scores any AI-generated text block
 *      0-100 for how confident the assistant appears to be.
 *
 *  4.  SafeMode                    — classifies operations as safe/cautious/
 *      destructive and blocks dangerous ones until the user confirms.
 *
 *  5.  OneClickFixEngine           — given a list of code issues, returns
 *      ready-to-paste patches with one-line explanations.
 *
 *  6.  PlainLanguageGlossary       — look up any technical term and get a
 *      plain-English definition.
 *
 *  7.  DependencyAdvisor           — rates a package by safety, popularity,
 *      and explains what it does in plain English.
 *
 *  8.  StepByStepWizard            — decomposes a vague goal into numbered,
 *      reversible micro-steps with progress tracking.
 *
 *  9.  UndoStack                   — lightweight text-level undo/redo so
 *      users can roll back any AI edit with one call.
 *
 * 10.  SmartScaffolder             — generates a starter project file tree
 *      from a one-sentence description.
 *
 * 11.  FriendlyProgressNarrator    — converts numeric progress (0-100 %) into
 *      cheerful, human-readable status messages.
 *
 * 12.  CodeIntentLogger            — prepends a plain-English comment block
 *      to every AI-generated code snippet describing what it does.
 *
 * 13.  RookieModeToggle            — switches the session into a beginner-
 *      friendly mode: simplified prompts and verbose explanations.
 *
 * 14.  VisualDiffFormatter         — converts a unified diff into a readable
 *      side-by-side table of removed / added lines.
 *
 * 15.  AutoExplainMode             — automatically appends a plain-English
 *      paragraph after every code block in an AI response.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. Plain English Error Explainer
// ─────────────────────────────────────────────────────────────────────────────

/** A human-friendly explanation of a runtime or build error. */
export interface ErrorExplanation {
  /** The original error message or code. */
  original: string;
  /** One-sentence plain-English explanation. */
  plainEnglish: string;
  /** A single actionable fix suggestion. */
  suggestion: string;
  /** Confidence that this pattern matched (0-1). */
  confidence: number;
}

interface ErrorPattern {
  pattern: RegExp;
  plainEnglish: string;
  suggestion: string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /ENOENT|no such file or directory/i,
    plainEnglish: "The file or folder you asked for doesn't exist.",
    suggestion: "Double-check the path spelling, or create the missing file first.",
  },
  {
    pattern: /EACCES|permission denied/i,
    plainEnglish: "You don't have permission to access that file or folder.",
    suggestion: "Try running with elevated permissions, or check the file's ownership.",
  },
  {
    pattern: /EADDRINUSE|address already in use/i,
    plainEnglish: "Another program is already using the port you're trying to start on.",
    suggestion: "Stop the other program first, or change your app to use a different port.",
  },
  {
    pattern: /cannot find module|module not found/i,
    plainEnglish: "A required code package is missing from your project.",
    suggestion: "Run 'npm install' (or 'pip install <package>') to install the missing package.",
  },
  {
    pattern: /syntaxerror|unexpected token/i,
    plainEnglish: "There's a typo or punctuation mistake in the code.",
    suggestion: "Look at the line number in the error — you likely have a missing comma, bracket, or quote.",
  },
  {
    pattern: /typeerror.*undefined|cannot read propert(?:y|ies)/i,
    plainEnglish: "The code tried to use a value that doesn't exist yet.",
    suggestion: "Add a check like 'if (value) { … }' before using that variable.",
  },
  {
    pattern: /network.*timeout|etimedout/i,
    plainEnglish: "The request timed out because the server took too long to respond.",
    suggestion: "Check your internet connection, or increase the timeout setting.",
  },
  {
    pattern: /out of memory|heap out of memory/i,
    plainEnglish: "Your program ran out of memory while running.",
    suggestion: "Try processing smaller chunks of data at a time, or increase the memory limit.",
  },
  {
    pattern: /certificat.*expired|ssl.*error/i,
    plainEnglish: "The security certificate for that website is invalid or expired.",
    suggestion: "Check your system date/time, or contact the site owner about their certificate.",
  },
  {
    pattern: /(git.*merge.*conflict|CONFLICT.*merge|merge conflict)/i,
    plainEnglish: "Two versions of the same file have conflicting changes.",
    suggestion: "Open the file, find the <<<< markers, and choose which version to keep.",
  },
];

/**
 * Translate a raw error string into plain English.
 *
 * @example
 * const explainer = new PlainEnglishErrorExplainer();
 * const result = explainer.explain("Error: ENOENT: no such file or directory, open '/app/config.json'");
 * // result.plainEnglish  → "The file or folder you asked for doesn't exist."
 * // result.suggestion    → "Double-check the path spelling, or create the missing file first."
 */
export class PlainEnglishErrorExplainer {
  explain(errorMessage: string): ErrorExplanation {
    for (const ep of ERROR_PATTERNS) {
      if (ep.pattern.test(errorMessage)) {
        return {
          original: errorMessage,
          plainEnglish: ep.plainEnglish,
          suggestion: ep.suggestion,
          confidence: 0.9,
        };
      }
    }
    return {
      original: errorMessage,
      plainEnglish: "Something unexpected went wrong.",
      suggestion: "Copy the full error message and ask your AI assistant to explain it.",
      confidence: 0.3,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Intent Validator
// ─────────────────────────────────────────────────────────────────────────────

/** Result of validating whether an AI response matches the user's intent. */
export interface IntentValidationResult {
  /** How well the response addresses the user's request (0-1). */
  score: number;
  /** Whether the response is considered on-topic. */
  onTopic: boolean;
  /** Keywords from the request that were found in the response. */
  matchedKeywords: string[];
  /** Keywords from the request that were NOT found in the response. */
  missingKeywords: string[];
  /** Human-readable verdict. */
  verdict: string;
}

/**
 * Validates that an AI response actually addresses the user's original request.
 *
 * Uses a lightweight keyword-overlap heuristic — no external model required.
 */
export class IntentValidator {
  /**
   * Score how well `response` addresses `request`.
   *
   * @param request  The user's original natural-language request.
   * @param response The AI's generated response text.
   */
  validate(request: string, response: string): IntentValidationResult {
    const keywords = this._extractKeywords(request);
    const responseLower = response.toLowerCase();

    const matched = keywords.filter((k) => responseLower.includes(k));
    const missing = keywords.filter((k) => !responseLower.includes(k));

    const score = keywords.length === 0 ? 1 : matched.length / keywords.length;
    const onTopic = score >= 0.5;

    let verdict: string;
    if (score >= 0.8) {
      verdict = "The response looks like a great match for your request.";
    } else if (score >= 0.5) {
      verdict = "The response partially addresses your request.";
    } else {
      verdict = "The response may not address what you asked — consider rephrasing.";
    }

    return { score, onTopic, matchedKeywords: matched, missingKeywords: missing, verdict };
  }

  private _extractKeywords(text: string): string[] {
    const STOP_WORDS = new Set([
      "a","an","the","is","it","in","on","at","to","for","of","and","or","but",
      "with","this","that","my","me","i","you","please","can","could","would",
      "should","how","what","when","where","why","do","does","did","will","make",
    ]);
    // Allow a curated set of meaningful 2-character technical terms to pass through.
    const TECH_TWO_CHAR_KEYWORDS = new Set([
      "js","ts","go","fs","db","ui","ux","os","ci","cd","db","io","vm","ai","ml",
    ]);
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(
        (w) =>
          !STOP_WORDS.has(w) &&
          (w.length > 2 || (w.length === 2 && TECH_TWO_CHAR_KEYWORDS.has(w)))
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Confidence Indicator
// ─────────────────────────────────────────────────────────────────────────────

/** Confidence level label. */
export type ConfidenceLevel = "high" | "medium" | "low" | "uncertain";

/** Confidence assessment of an AI-generated text block. */
export interface ConfidenceAssessment {
  /** Numeric score 0-100. */
  score: number;
  /** Categorical label. */
  level: ConfidenceLevel;
  /** Signals that reduced confidence. */
  hedgingSignals: string[];
  /** One-line human-readable summary. */
  summary: string;
}

const HEDGING_PHRASES: string[] = [
  "i think", "i believe", "i'm not sure", "i'm not certain", "might be",
  "may be", "could be", "possibly", "perhaps", "not sure", "uncertain",
  "probably", "roughly", "approximately", "i assume", "it seems",
  "if i recall", "i may be wrong", "you might want to verify",
];

/**
 * Scores an AI-generated text block for expressed confidence.
 *
 * Looks for hedging language and uncertainty markers to estimate how
 * confident the response is, on a 0-100 scale.
 */
export class ConfidenceIndicator {
  /**
   * Assess the confidence of an AI-generated text block.
   *
   * @param text The AI response to assess.
   */
  assess(text: string): ConfidenceAssessment {
    const lower = text.toLowerCase();
    const found = HEDGING_PHRASES.filter((p) => lower.includes(p));

    const deduction = Math.min(found.length * 12, 70);
    const score = Math.max(100 - deduction, 10);

    let level: ConfidenceLevel;
    if (score >= 80) level = "high";
    else if (score >= 55) level = "medium";
    else if (score >= 30) level = "low";
    else level = "uncertain";

    const summary =
      score >= 80
        ? "The AI seems confident in this answer."
        : score >= 55
        ? "The AI has some uncertainty — double-check the key points."
        : "The AI is quite unsure here — verify this carefully before using it.";

    return { score, level, hedgingSignals: found, summary };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Safe Mode / Guardrails
// ─────────────────────────────────────────────────────────────────────────────

/** Risk level of an operation. */
export type RiskLevel = "safe" | "cautious" | "destructive";

/** Classification result for an operation. */
export interface SafeModeResult {
  /** The original operation string. */
  operation: string;
  /** Risk assessment. */
  risk: RiskLevel;
  /** Whether the operation is blocked until confirmed. */
  blocked: boolean;
  /** Plain-English description of what would happen. */
  explanation: string;
  /** Question to ask the user before proceeding (for blocked ops). */
  confirmationPrompt?: string;
}

interface RiskPattern {
  pattern: RegExp;
  risk: RiskLevel;
  explanation: string;
  confirmationPrompt: string;
}

const RISK_PATTERNS: RiskPattern[] = [
  {
    pattern: /\brm\s+-rf\b|rmdir\s+\/|del\s+\/s/i,
    risk: "destructive",
    explanation: "This will permanently delete files or folders — it cannot be undone.",
    confirmationPrompt: "Are you sure you want to permanently delete these files?",
  },
  {
    pattern: /\bdrop\s+(?:table|database)\b/i,
    risk: "destructive",
    explanation: "This will permanently remove a database table or database.",
    confirmationPrompt: "Are you sure you want to drop this database object? All data will be lost.",
  },
  {
    pattern: /\bgit\s+(?:force\b|push\b[^\n]*\s--force\b|push\b[^\n]*\s-f\b)/i,
    risk: "destructive",
    explanation: "Force-pushing can overwrite other people's work on the shared repository.",
    confirmationPrompt: "Are you sure you want to force-push? This may overwrite teammates' changes.",
  },
  {
    pattern: /\bformat\s+\w:|mkfs\b/i,
    risk: "destructive",
    explanation: "This will erase everything on the disk.",
    confirmationPrompt: "Are you sure you want to format this disk? All data will be erased.",
  },
  {
    pattern: /\bnpm\s+publish\b|\bpip\s+upload\b/i,
    risk: "cautious",
    explanation: "This will publish a package to the public registry.",
    confirmationPrompt: "Are you sure you want to publish this package publicly?",
  },
  {
    pattern: /\bdeploy\b|\bkubectl\s+apply\b/i,
    risk: "cautious",
    explanation: "This will change a live production environment.",
    confirmationPrompt: "Are you sure you want to deploy to production?",
  },
  {
    pattern: /\bchmod\b[^\S\r\n]+(?:-R[^\S\r\n]+)?(?:0?777\b|[augo]*\+rwx\b)/i,
    risk: "cautious",
    explanation: "Setting permissions to 777 (or equivalent modes like a+rwx) makes the file readable and writable by everyone.",
    confirmationPrompt: "Are you sure? This makes the file world-writable which is a security risk.",
  },
];

/**
 * Classifies operations by risk level and blocks destructive ones.
 *
 * In SafeMode, any operation classified as "destructive" is blocked until
 * `confirm()` is called.  "Cautious" operations are flagged but not blocked.
 */
export class SafeMode {
  private _enabled: boolean;

  constructor(enabled = true) {
    this._enabled = enabled;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  enable(): void {
    this._enabled = true;
  }

  disable(): void {
    this._enabled = false;
  }

  /**
   * Classify an operation and return a SafeModeResult.
   *
   * When `enabled`, destructive operations have `blocked: true`.
   */
  check(operation: string): SafeModeResult {
    for (const rp of RISK_PATTERNS) {
      if (rp.pattern.test(operation)) {
        const blocked = this._enabled && rp.risk === "destructive";
        return {
          operation,
          risk: rp.risk,
          blocked,
          explanation: rp.explanation,
          confirmationPrompt: blocked ? rp.confirmationPrompt : undefined,
        };
      }
    }
    return {
      operation,
      risk: "safe",
      blocked: false,
      explanation: "This operation looks safe to run.",
    };
  }

  /**
   * Confirm and unblock a previously blocked operation.
   *
   * Returns a result with `blocked: false` so callers can proceed.
   */
  confirm(operation: string): SafeModeResult {
    const result = this.check(operation);
    return { ...result, blocked: false, confirmationPrompt: undefined };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. One-Click Fix Engine
// ─────────────────────────────────────────────────────────────────────────────

/** A ready-to-apply fix for a single code issue. */
export interface CodeFix {
  /** The issue code this fix addresses (matches QualityIssue.code). */
  issueCode: string;
  /** One-sentence plain-English explanation of what the fix does. */
  explanation: string;
  /** The original (broken) code fragment. */
  original: string;
  /** The corrected replacement code fragment. */
  replacement: string;
  /** Whether applying this fix is safe to do automatically. */
  autoApply: boolean;
}

const FIX_TEMPLATES: Record<string, { explanation: string; autoApply: boolean }> = {
  "empty-catch": {
    explanation: "Add a console.error() call so the error is never silently ignored.",
    autoApply: false,
  },
  "debug-console-log": {
    explanation: "Remove the console.log() call before shipping to production.",
    autoApply: true,
  },
  "ts-any-type": {
    explanation: "Replace 'any' with 'unknown' to keep TypeScript type safety.",
    autoApply: false,
  },
  "eval-usage": {
    explanation: "Remove eval() — it's a security risk.  Use JSON.parse() or a safer alternative.",
    autoApply: false,
  },
  "hardcoded-secret": {
    explanation: "Move the secret to an environment variable (process.env.MY_SECRET).",
    autoApply: false,
  },
  "todo-marker": {
    explanation: "Replace the TODO comment with the actual implementation, or file a ticket.",
    autoApply: false,
  },
  "ts-missing-return-type": {
    explanation: "Add an explicit return type annotation after the closing parenthesis.",
    autoApply: false,
  },
  "prototype-pollution": {
    explanation: "Use Object.assign({}, obj, patch) instead of mutating __proto__.",
    autoApply: false,
  },
};

/**
 * Generates ready-to-paste fixes for detected code issues.
 *
 * Works alongside CodeQualityScorer — pass in the issues array and the
 * relevant code lines to get actionable patches.
 */
export class OneClickFixEngine {
  /**
   * Generate a fix suggestion for a single issue code and its affected line.
   *
   * @param issueCode  The issue code from QualityIssue.code.
   * @param codeLine   The source line where the issue was detected.
   */
  fix(issueCode: string, codeLine: string): CodeFix | null {
    const template = FIX_TEMPLATES[issueCode];
    if (!template) return null;

    const replacement = this._applyFix(issueCode, codeLine);

    return {
      issueCode,
      explanation: template.explanation,
      original: codeLine,
      replacement,
      autoApply: template.autoApply,
    };
  }

  private _applyFix(issueCode: string, line: string): string {
    switch (issueCode) {
      case "debug-console-log":
        return line.replace(/\bconsole\.log\s*\([^)]*\);?\s*/g, "").trim();
      case "ts-any-type":
        return line.replace(/:\s*any\b/g, ": unknown");
      default:
        return line; // manual fix required
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Plain Language Glossary
// ─────────────────────────────────────────────────────────────────────────────

/** A glossary entry for a technical term. */
export interface GlossaryEntry {
  /** The technical term. */
  term: string;
  /** Plain-English definition (1-2 sentences). */
  definition: string;
  /** Optional analogy to everyday life. */
  analogy?: string;
  /** Related terms. */
  related: string[];
}

const GLOSSARY: GlossaryEntry[] = [
  {
    term: "api",
    definition: "A way for two programs to talk to each other.  When you log in with Google, that uses an API.",
    analogy: "Think of it like a waiter in a restaurant — you tell them what you want, and they bring it from the kitchen.",
    related: ["endpoint", "rest", "http"],
  },
  {
    term: "dependency",
    definition: "A package of code that your project needs in order to work.",
    analogy: "Like ingredients in a recipe — your app needs them before it can run.",
    related: ["npm", "package", "module"],
  },
  {
    term: "endpoint",
    definition: "A specific URL that your application responds to (e.g., /users or /login).",
    analogy: "Like a phone extension — each one connects you to a different service.",
    related: ["api", "route", "rest"],
  },
  {
    term: "environment variable",
    definition: "A named piece of configuration stored outside your code, like a password or API key.",
    analogy: "Like a sticky note on the wall — your program reads it without the value being baked in.",
    related: ["config", "secret", ".env"],
  },
  {
    term: "git",
    definition: "A system that tracks every change you make to your code so you can go back in time.",
    analogy: "Like a Save History for your entire project.",
    related: ["commit", "branch", "repository"],
  },
  {
    term: "function",
    definition: "A named block of code you can run whenever you need it.",
    analogy: "Like a recipe step — you can repeat it as many times as you want.",
    related: ["method", "return", "parameter"],
  },
  {
    term: "promise",
    definition: "A JavaScript object that represents a task that will complete in the future.",
    analogy: "Like a ticket at a bakery — you get it now, and collect your bread when it's ready.",
    related: ["async", "await", "callback"],
  },
  {
    term: "typescript",
    definition: "A version of JavaScript that adds type labels so mistakes are caught before the code runs.",
    analogy: "Like spell-check for code — it highlights mistakes as you type.",
    related: ["javascript", "type", "compiler"],
  },
  {
    term: "linter",
    definition: "A tool that reads your code and flags style problems or likely bugs.",
    analogy: "Like a grammar checker, but for code.",
    related: ["eslint", "prettier", "formatter"],
  },
  {
    term: "merge conflict",
    definition: "When two people edited the same part of a file and Git can't decide which version to keep.",
    analogy: "Like two people editing the same Google Doc line at the same time — someone has to choose.",
    related: ["git", "branch", "pull request"],
  },
  {
    term: "null",
    definition: "A special value meaning 'nothing' or 'not set'.",
    analogy: "Like an empty box — the box exists, but there's nothing inside.",
    related: ["undefined", "type", "error"],
  },
  {
    term: "package",
    definition: "A bundle of reusable code that someone else wrote and published so you can use it.",
    analogy: "Like a LEGO set — snap it in and it just works.",
    related: ["npm", "library", "dependency"],
  },
  {
    term: "refactor",
    definition: "Rewriting existing code to be cleaner or faster without changing what it does.",
    analogy: "Like reorganizing your desk — everything still works, but it's tidier.",
    related: ["clean code", "technical debt", "review"],
  },
  {
    term: "repository",
    definition: "A folder (usually on GitHub) that stores all the code and history for a project.",
    analogy: "Like a shared Google Drive folder for your code.",
    related: ["git", "branch", "commit"],
  },
  {
    term: "token",
    definition: "In AI contexts: the basic unit the model reads — roughly 3/4 of a word.",
    analogy: "Like syllables in a sentence — the model counts them to stay within its memory limit.",
    related: ["context window", "llm", "prompt"],
  },
];

/**
 * Provides plain-English definitions for technical terms.
 *
 * @example
 * const glossary = new PlainLanguageGlossary();
 * const entry = glossary.lookup("api");
 * // entry.definition → "A way for two programs to talk to each other…"
 */
export class PlainLanguageGlossary {
  private _entries: Map<string, GlossaryEntry>;

  constructor(extraEntries: GlossaryEntry[] = []) {
    this._entries = new Map(
      [...GLOSSARY, ...extraEntries].map((e) => [e.term.toLowerCase(), e]),
    );
  }

  /** Look up a term (case-insensitive). Returns null if not found. */
  lookup(term: string): GlossaryEntry | null {
    return this._entries.get(term.toLowerCase()) ?? null;
  }

  /** Add or replace an entry. */
  define(entry: GlossaryEntry): void {
    this._entries.set(entry.term.toLowerCase(), entry);
  }

  /** Return all known terms sorted alphabetically. */
  listTerms(): string[] {
    return [...this._entries.keys()].sort();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Dependency Advisor
// ─────────────────────────────────────────────────────────────────────────────

/** Safety and quality rating for a package. */
export type PackageSafetyRating = "trusted" | "popular" | "unknown" | "risky";

/** Advisory report for an npm / pip package. */
export interface DependencyAdvice {
  /** Package name. */
  name: string;
  /** Plain-English description of what the package does. */
  description: string;
  /** Safety / trust rating. */
  safety: PackageSafetyRating;
  /** Human-readable safety explanation. */
  safetyNote: string;
  /** Whether to recommend installing this package. */
  recommended: boolean;
}

const KNOWN_PACKAGES: Record<string, DependencyAdvice> = {
  express: {
    name: "express",
    description: "A popular toolkit for building web servers in Node.js.",
    safety: "trusted",
    safetyNote: "One of the most widely used Node.js packages, maintained for 10+ years.",
    recommended: true,
  },
  lodash: {
    name: "lodash",
    description: "A collection of helpful utility functions for working with arrays, objects, and strings.",
    safety: "trusted",
    safetyNote: "Extremely popular, well-maintained, and widely audited.",
    recommended: true,
  },
  axios: {
    name: "axios",
    description: "Makes it easy to send HTTP requests (fetch data from APIs).",
    safety: "trusted",
    safetyNote: "Industry-standard HTTP client, very widely used.",
    recommended: true,
  },
  dotenv: {
    name: "dotenv",
    description: "Loads environment variables from a .env file into your program.",
    safety: "trusted",
    safetyNote: "Standard tool for managing secrets — just make sure you never commit the .env file.",
    recommended: true,
  },
  "left-pad": {
    name: "left-pad",
    description: "Adds spaces to the left side of a string.",
    safety: "popular",
    safetyNote: "Famous for once breaking the internet when unpublished, but otherwise harmless.",
    recommended: false,
  },
  colors: {
    name: "colors",
    description: "Adds color to terminal text.",
    safety: "risky",
    safetyNote: "Version 1.4.1 was sabotaged by its author — use 'chalk' instead.",
    recommended: false,
  },
  chalk: {
    name: "chalk",
    description: "Adds color to terminal text.",
    safety: "trusted",
    safetyNote: "The recommended replacement for 'colors'. Widely used and well-maintained.",
    recommended: true,
  },
  moment: {
    name: "moment",
    description: "Parses, validates, and formats dates and times.",
    safety: "popular",
    safetyNote: "Stable but no longer recommended for new projects. Consider 'date-fns' instead.",
    recommended: false,
  },
  "date-fns": {
    name: "date-fns",
    description: "Lightweight, modern library for working with dates.",
    safety: "trusted",
    safetyNote: "The modern recommended alternative to moment.js.",
    recommended: true,
  },
};

/**
 * Provides plain-English advice about npm/pip packages.
 *
 * @example
 * const advisor = new DependencyAdvisor();
 * const advice = advisor.advise("express");
 * // advice.description → "A popular toolkit for building web servers in Node.js."
 * // advice.safety      → "trusted"
 */
export class DependencyAdvisor {
  /**
   * Return advice for a named package.
   *
   * If the package is not in the built-in database, returns an "unknown"
   * advisory prompting the user to research before installing.
   */
  advise(packageName: string): DependencyAdvice {
    const known = KNOWN_PACKAGES[packageName.toLowerCase()];
    if (known) return known;

    return {
      name: packageName,
      description: "This package isn't in our database yet.",
      safety: "unknown",
      safetyNote: "We don't have information on this package. Check npmjs.com or PyPI for reviews and download counts.",
      recommended: false,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Step-by-Step Wizard
// ─────────────────────────────────────────────────────────────────────────────

/** A single step in a wizard plan. */
export interface WizardStep {
  /** 1-based step number. */
  number: number;
  /** Short title for the step. */
  title: string;
  /** Plain-English description of what to do. */
  description: string;
  /** The command or action to run (if any). */
  action?: string;
  /** Whether this step can be undone. */
  reversible: boolean;
  /** Status of this step. */
  status: "pending" | "in_progress" | "done" | "skipped";
}

/** A wizard plan with multiple steps. */
export interface WizardPlan {
  /** One-sentence summary of what the wizard will achieve. */
  goal: string;
  /** Ordered list of steps. */
  steps: WizardStep[];
  /** Index (0-based) of the currently active step. */
  currentStep: number;
}

const GOAL_TEMPLATES: Record<string, Omit<WizardStep, "status">[]> = {
  "create react app": [
    { number: 1, title: "Install Node.js", description: "Make sure Node.js is installed on your machine.", action: "node --version", reversible: true },
    { number: 2, title: "Create the app", description: "Use Create React App to generate a starter project.", action: "npx create-react-app my-app", reversible: true },
    { number: 3, title: "Open the folder", description: "Navigate into your new project folder.", action: "cd my-app", reversible: true },
    { number: 4, title: "Start the app", description: "Launch the development server in your browser.", action: "npm start", reversible: true },
  ],
  "deploy to github": [
    { number: 1, title: "Initialize Git", description: "Set up a Git repository in your project folder.", action: "git init", reversible: true },
    { number: 2, title: "Stage all files", description: "Tell Git to track all your files.", action: "git add .", reversible: true },
    { number: 3, title: "Make first commit", description: "Save a snapshot of your code.", action: 'git commit -m "Initial commit"', reversible: true },
    { number: 4, title: "Create GitHub repo", description: "Go to github.com and create a new repository, then copy its URL.", reversible: true },
    { number: 5, title: "Push to GitHub", description: "Upload your code to GitHub.", action: "git push -u origin main", reversible: false },
  ],
  "install dependencies": [
    { number: 1, title: "Check package manager", description: "Confirm npm is available.", action: "npm --version", reversible: true },
    { number: 2, title: "Install packages", description: "Download and install all listed dependencies.", action: "npm install", reversible: true },
    { number: 3, title: "Verify installation", description: "Confirm everything installed correctly.", action: "npm list --depth=0", reversible: true },
  ],
};

/**
 * Decomposes a vague goal into numbered, reversible micro-steps.
 *
 * @example
 * const wizard = new StepByStepWizard();
 * const plan = wizard.plan("create react app");
 * // plan.steps[0].action → "node --version"
 */
export class StepByStepWizard {
  /**
   * Build a step-by-step plan for a goal.
   *
   * Matches `goal` against built-in templates (case-insensitive substring
   * match).  Falls back to a generic research plan if no template matches.
   */
  plan(goal: string): WizardPlan {
    const key = Object.keys(GOAL_TEMPLATES).find((k) =>
      goal.toLowerCase().includes(k),
    );

    const templateSteps = key
      ? GOAL_TEMPLATES[key]
      : [
          { number: 1, title: "Understand the goal", description: "Describe what you want to achieve in one sentence.", reversible: true },
          { number: 2, title: "Research the tools", description: "Ask your AI assistant which tools are needed.", reversible: true },
          { number: 3, title: "Set up the environment", description: "Install any required tools or packages.", reversible: true },
          { number: 4, title: "Implement step by step", description: "Ask the AI to break the work into smaller tasks.", reversible: true },
          { number: 5, title: "Test your result", description: "Verify the outcome matches your goal.", reversible: true },
        ];

    return {
      goal,
      steps: templateSteps.map((s) => ({ ...s, status: "pending" as const })),
      currentStep: 0,
    };
  }

  /** Mark a step as done and advance to the next one. */
  advance(plan: WizardPlan): WizardPlan {
    const updated = { ...plan, steps: plan.steps.map((s) => ({ ...s })) };
    if (updated.currentStep < updated.steps.length) {
      updated.steps[updated.currentStep].status = "done";
      updated.currentStep += 1;
      if (updated.currentStep < updated.steps.length) {
        updated.steps[updated.currentStep].status = "in_progress";
      }
    }
    return updated;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Undo Stack
// ─────────────────────────────────────────────────────────────────────────────

/** A single edit recorded in the undo stack. */
export interface EditRecord {
  /** Unique edit identifier. */
  id: string;
  /** Timestamp of the edit. */
  timestamp: number;
  /** Plain-English description of what changed. */
  description: string;
  /** Content before the edit. */
  before: string;
  /** Content after the edit. */
  after: string;
}

/** Result of an undo or redo operation. */
export interface UndoRedoResult {
  /** Whether the operation succeeded. */
  success: boolean;
  /** The restored content, if successful. */
  content?: string;
  /** Human-readable message. */
  message: string;
}

/**
 * Lightweight text-level undo/redo for AI-generated code edits.
 *
 * Call `push()` before every AI edit, then `undo()` / `redo()` to navigate.
 */
export class UndoStack {
  private static _idCounter = 0;

  private static _nextId(): string {
    return `edit-${UndoStack._idCounter++}`;
  }

  private _stack: EditRecord[] = [];
  private _pointer = -1;
  private readonly _maxSize: number;

  constructor(maxSize = 50) {
    this._maxSize = maxSize;
  }

  /**
   * Record a new edit.
   *
   * @param before      The content before the edit.
   * @param after       The content after the edit.
   * @param description Plain-English description (e.g. "Added error handler").
   */
  push(before: string, after: string, description: string): EditRecord {
    // Discard any redoable future edits
    this._stack = this._stack.slice(0, this._pointer + 1);

    const record: EditRecord = {
      id: UndoStack._nextId(),
      timestamp: Date.now(),
      description,
      before,
      after,
    };

    this._stack.push(record);
    if (this._stack.length > this._maxSize) {
      this._stack.shift();
    }
    this._pointer = this._stack.length - 1;

    return record;
  }

  /** Undo the most recent edit. */
  undo(): UndoRedoResult {
    if (this._pointer < 0) {
      return { success: false, message: "Nothing to undo." };
    }
    const record = this._stack[this._pointer];
    this._pointer--;
    return {
      success: true,
      content: record.before,
      message: `Undid: "${record.description}"`,
    };
  }

  /** Redo the most recently undone edit. */
  redo(): UndoRedoResult {
    if (this._pointer >= this._stack.length - 1) {
      return { success: false, message: "Nothing to redo." };
    }
    this._pointer++;
    const record = this._stack[this._pointer];
    return {
      success: true,
      content: record.after,
      message: `Redid: "${record.description}"`,
    };
  }

  /** How many edits can be undone. */
  get undoCount(): number {
    return this._pointer + 1;
  }

  /** How many edits can be redone. */
  get redoCount(): number {
    return this._stack.length - this._pointer - 1;
  }

  /** Clear the entire history. */
  clear(): void {
    this._stack = [];
    this._pointer = -1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Smart Scaffolder
// ─────────────────────────────────────────────────────────────────────────────

/** A file in a scaffolded project. */
export interface ScaffoldFile {
  /** Relative path from the project root. */
  path: string;
  /** Starter file content. */
  content: string;
}

/** A scaffolded project layout. */
export interface ScaffoldResult {
  /** Detected project type. */
  type: string;
  /** Plain-English description of the scaffold. */
  description: string;
  /** Files to create. */
  files: ScaffoldFile[];
  /** Shell commands to run after creating the files. */
  setupCommands: string[];
}

const SCAFFOLD_TEMPLATES: Record<string, ScaffoldResult> = {
  "express api": {
    type: "Node.js / Express REST API",
    description: "A simple Express.js web server ready to handle API requests.",
    files: [
      {
        path: "package.json",
        content: JSON.stringify(
          { name: "my-api", version: "1.0.0", main: "src/index.js", scripts: { start: "node src/index.js", dev: "nodemon src/index.js" }, dependencies: { express: "^4.18.0" } },
          null, 2,
        ),
      },
      {
        path: "src/index.js",
        content: `const express = require('express');\nconst app = express();\nconst PORT = process.env.PORT || 3000;\n\napp.use(express.json());\n\napp.get('/health', (req, res) => res.json({ status: 'ok' }));\n\napp.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));\n`,
      },
      { path: ".env", content: "PORT=3000\n" },
      { path: ".gitignore", content: "node_modules/\n.env\n" },
    ],
    setupCommands: ["npm install", "npm run dev"],
  },
  "react app": {
    type: "React Single-Page Application",
    description: "A minimal React app with a component and basic styling.",
    files: [
      {
        path: "package.json",
        content: JSON.stringify(
          { name: "my-react-app", version: "1.0.0", scripts: { start: "react-scripts start", build: "react-scripts build" }, dependencies: { react: "^18.0.0", "react-dom": "^18.0.0", "react-scripts": "5.0.1" } },
          null, 2,
        ),
      },
      { path: "public/index.html", content: `<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8"><title>My React App</title></head>\n<body><div id="root"></div></body>\n</html>\n` },
      { path: "src/index.js", content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nReactDOM.createRoot(document.getElementById('root')).render(<App />);\n` },
      { path: "src/App.js", content: `import React from 'react';\nexport default function App() {\n  return <h1>Hello, world!</h1>;\n}\n` },
      { path: ".gitignore", content: "node_modules/\nbuild/\n" },
    ],
    setupCommands: ["npm install", "npm start"],
  },
  "python script": {
    type: "Python Script",
    description: "A ready-to-run Python script with argument parsing and logging.",
    files: [
      {
        path: "main.py",
        content: `#!/usr/bin/env python3\n"""My script — describe what it does here."""\nimport argparse\nimport logging\n\nlogging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')\nlog = logging.getLogger(__name__)\n\ndef main(args):\n    log.info("Starting with args: %s", args)\n    # TODO: implement your logic here\n\nif __name__ == '__main__':\n    parser = argparse.ArgumentParser(description=__doc__)\n    parser.add_argument('--verbose', '-v', action='store_true')\n    main(parser.parse_args())\n`,
      },
      { path: "requirements.txt", content: "# Add your dependencies here\n" },
      { path: ".gitignore", content: "__pycache__/\n*.pyc\n.env\n" },
    ],
    setupCommands: ["pip install -r requirements.txt", "python main.py"],
  },
};

/**
 * Generates a starter project file tree from a one-line description.
 *
 * @example
 * const scaffolder = new SmartScaffolder();
 * const result = scaffolder.scaffold("build an express api");
 * // result.type    → "Node.js / Express REST API"
 * // result.files   → [{ path: 'package.json', content: '…' }, …]
 */
export class SmartScaffolder {
  /**
   * Generate a project scaffold from a natural-language description.
   *
   * Matches against built-in templates; falls back to a generic single-file
   * placeholder if no template is found.
   */
  scaffold(description: string): ScaffoldResult {
    const lower = description.toLowerCase();

    for (const [key, template] of Object.entries(SCAFFOLD_TEMPLATES)) {
      if (lower.includes(key)) {
        return template;
      }
    }

    return {
      type: "Custom Project",
      description: `Starter scaffold for: ${description}`,
      files: [
        { path: "README.md", content: `# ${description}\n\nDescribe your project here.\n` },
        { path: ".gitignore", content: "node_modules/\ndist/\n.env\n" },
      ],
      setupCommands: [],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Friendly Progress Narrator
// ─────────────────────────────────────────────────────────────────────────────

/** A human-friendly progress update. */
export interface ProgressNarration {
  /** Progress percentage (0-100). */
  percent: number;
  /** Friendly message for this progress level. */
  message: string;
  /** Emoji to accompany the message. */
  emoji: string;
  /** Whether the operation is complete. */
  done: boolean;
}

interface ProgressPhrase {
  minPercent: number;
  maxPercent: number;
  messages: string[];
  emoji: string;
}

const PROGRESS_PHRASES: ProgressPhrase[] = [
  { minPercent: 0,  maxPercent: 10, messages: ["Just getting started…", "Warming things up…", "Loading the essentials…"],         emoji: "🚀" },
  { minPercent: 10, maxPercent: 30, messages: ["Making good progress!", "Things are moving along nicely.", "Getting into the swing of things…"], emoji: "⚙️" },
  { minPercent: 30, maxPercent: 60, messages: ["Halfway there soon!", "Crunching through the work…", "Still going strong!"],          emoji: "💪" },
  { minPercent: 60, maxPercent: 80, messages: ["More than halfway done!", "The finish line is in sight.", "Almost there!"],            emoji: "🏃" },
  { minPercent: 80, maxPercent: 99, messages: ["Just tidying up a few things…", "Nearly done!", "Last few steps…"],                   emoji: "✨" },
  { minPercent: 99, maxPercent: 100, messages: ["All done!", "Finished!", "Complete!"],                                               emoji: "🎉" },
];

/**
 * Converts a numeric progress percentage into a cheerful, human-readable
 * status message.
 *
 * @example
 * const narrator = new FriendlyProgressNarrator();
 * narrator.narrate(45).message  // → "Crunching through the work…"
 * narrator.narrate(100).done    // → true
 */
export class FriendlyProgressNarrator {
  private _rng: () => number;

  constructor(rng: () => number = Math.random) {
    this._rng = rng;
  }

  /** Generate a narration for the given progress percentage. */
  narrate(percent: number, operationName?: string): ProgressNarration {
    const clamped = Math.max(0, Math.min(100, percent));
    const done = clamped >= 100;

    const phase = PROGRESS_PHRASES.find(
      (p) => clamped >= p.minPercent && clamped <= p.maxPercent,
    ) ?? PROGRESS_PHRASES[PROGRESS_PHRASES.length - 1];

    const raw = this._rng();
    const rngValue = Number.isFinite(raw) ? raw : Math.random();
    const normalized = rngValue - Math.floor(rngValue);
    const index = Math.floor(normalized * phase.messages.length);
    const base = phase.messages[index];
    const message = operationName ? `${operationName}: ${base}` : base;

    return { percent: clamped, message, emoji: phase.emoji, done };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Code Intent Logger
// ─────────────────────────────────────────────────────────────────────────────

/** Options for the intent logger. */
export interface IntentLoggerOptions {
  /** Language of the code (for comment syntax). */
  language?: "typescript" | "javascript" | "python" | "unknown";
  /** Author label (e.g. "AI generated", "user"). */
  author?: string;
}

/** A code snippet annotated with a plain-English intent comment. */
export interface AnnotatedCode {
  /** The annotated code with the intent comment prepended. */
  annotated: string;
  /** The raw intent description. */
  intent: string;
  /** Comment syntax used. */
  commentStyle: "//" | "#";
}

/**
 * Prepends a plain-English intent comment block to AI-generated code.
 *
 * Helps vibe coders understand what a generated block does without reading
 * every line.
 *
 * @example
 * const logger = new CodeIntentLogger();
 * const result = logger.annotate(
 *   "fetch('/api/users').then(r => r.json()).then(data => setUsers(data));",
 *   "Fetch the list of users from the API and store them in state.",
 *   { language: "javascript" }
 * );
 */
export class CodeIntentLogger {
  /**
   * Annotate a code snippet with a plain-English intent comment.
   *
   * @param code    The code to annotate.
   * @param intent  Plain-English description of what the code does.
   * @param opts    Options (language, author).
   */
  annotate(code: string, intent: string, opts: IntentLoggerOptions = {}): AnnotatedCode {
    const commentStyle: "//" | "#" = opts.language === "python" ? "#" : "//";
    const c = commentStyle;
    const author = opts.author ?? "AI generated";
    const timestamp = new Date().toISOString().slice(0, 10);

    const header = [
      `${c} ─────────────────────────────────────────`,
      `${c} Intent: ${intent}`,
      `${c} Author:  ${author}  |  ${timestamp}`,
      `${c} ─────────────────────────────────────────`,
      "",
    ].join("\n");

    return { annotated: header + code, intent, commentStyle };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. Rookie Mode Toggle
// ─────────────────────────────────────────────────────────────────────────────

/** Verbosity level for rookie mode. */
export type VerbosityLevel = "rookie" | "standard" | "expert";

/** Rookie mode configuration. */
export interface RookieModeConfig {
  verbosity: VerbosityLevel;
  /** Whether to show analogies alongside technical explanations. */
  showAnalogies: boolean;
  /** Whether to confirm every AI action before executing. */
  confirmBeforeAction: boolean;
  /** Whether to auto-simplify error messages. */
  autoSimplifyErrors: boolean;
}

/** A system prompt prefix tuned for the current verbosity level. */
export interface RookieModePrompt {
  prefix: string;
  verbosity: VerbosityLevel;
}

const ROOKIE_PROMPT_PREFIX =
  "Please explain everything in plain, simple English as if I'm new to coding. " +
  "Avoid jargon. When you must use a technical term, define it immediately. " +
  "Break every task into small numbered steps. " +
  "After any code you write, add a plain-English comment explaining what it does.";

const STANDARD_PROMPT_PREFIX =
  "Explain your reasoning concisely. " +
  "Provide code with brief inline comments where helpful.";

const EXPERT_PROMPT_PREFIX =
  "Be concise. Skip basic explanations. Focus on edge cases and performance.";

/**
 * Manages a session-level verbosity toggle for adapting AI prompts.
 *
 * @example
 * const toggle = new RookieModeToggle();
 * toggle.setVerbosity("rookie");
 * const prompt = toggle.getSystemPromptPrefix();
 * // prompt.prefix → "Please explain everything in plain, simple English…"
 */
export class RookieModeToggle {
  private _config: RookieModeConfig;

  constructor(initial: Partial<RookieModeConfig> = {}) {
    this._config = {
      verbosity: "standard",
      showAnalogies: false,
      confirmBeforeAction: false,
      autoSimplifyErrors: false,
      ...initial,
    };
  }

  get config(): RookieModeConfig {
    return { ...this._config };
  }

  /** Switch to a verbosity level. */
  setVerbosity(level: VerbosityLevel): void {
    this._config.verbosity = level;
    if (level === "rookie") {
      this._config.showAnalogies = true;
      this._config.confirmBeforeAction = true;
      this._config.autoSimplifyErrors = true;
    } else if (level === "expert") {
      this._config.showAnalogies = false;
      this._config.confirmBeforeAction = false;
      this._config.autoSimplifyErrors = false;
    }
  }

  /** Return the system-prompt prefix for the current verbosity level. */
  getSystemPromptPrefix(): RookieModePrompt {
    const prefixes: Record<VerbosityLevel, string> = {
      rookie: ROOKIE_PROMPT_PREFIX,
      standard: STANDARD_PROMPT_PREFIX,
      expert: EXPERT_PROMPT_PREFIX,
    };
    return {
      prefix: prefixes[this._config.verbosity],
      verbosity: this._config.verbosity,
    };
  }

  /** Convenience: is rookie mode on? */
  isRookieMode(): boolean {
    return this._config.verbosity === "rookie";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. Visual Diff Formatter
// ─────────────────────────────────────────────────────────────────────────────

/** A single line entry in a visual diff. */
export interface DiffLine {
  /** Line type. */
  type: "added" | "removed" | "unchanged" | "header";
  /** The line content. */
  content: string;
  /** Display label ("+", "-", " ", "@@"). */
  label: string;
}

/** A human-readable diff report. */
export interface VisualDiff {
  /** All lines including headers, additions, and deletions. */
  lines: DiffLine[];
  /** Count of added lines. */
  addedCount: number;
  /** Count of removed lines. */
  removedCount: number;
  /** Plain-English summary. */
  summary: string;
}

/**
 * Converts a unified-format diff string into a readable line-by-line table.
 *
 * @example
 * const formatter = new VisualDiffFormatter();
 * const diff = formatter.format("--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old line\n+new line");
 * // diff.addedCount   → 1
 * // diff.removedCount → 1
 */
export class VisualDiffFormatter {
  /**
   * Parse a unified diff string into a VisualDiff.
   *
   * @param unifiedDiff The raw unified diff text.
   */
  format(unifiedDiff: string): VisualDiff {
    const lines: DiffLine[] = [];
    let added = 0;
    let removed = 0;

    for (const raw of unifiedDiff.split("\n")) {
      if (raw.startsWith("+++") || raw.startsWith("---")) {
        lines.push({ type: "header", content: raw, label: "  " });
      } else if (raw.startsWith("@@")) {
        lines.push({ type: "header", content: raw, label: "@@" });
      } else if (raw.startsWith("+")) {
        lines.push({ type: "added", content: raw.slice(1), label: "+ " });
        added++;
      } else if (raw.startsWith("-")) {
        lines.push({ type: "removed", content: raw.slice(1), label: "- " });
        removed++;
      } else {
        const unchangedContent = raw.startsWith(" ") ? raw.slice(1) : raw;
        lines.push({ type: "unchanged", content: unchangedContent, label: "  " });
      }
    }

    let summary: string;
    if (added === 0 && removed === 0) {
      summary = "No changes.";
    } else if (removed === 0) {
      summary = `${added} line${added !== 1 ? "s" : ""} added.`;
    } else if (added === 0) {
      summary = `${removed} line${removed !== 1 ? "s" : ""} removed.`;
    } else {
      summary = `${added} line${added !== 1 ? "s" : ""} added, ${removed} line${removed !== 1 ? "s" : ""} removed.`;
    }

    return { lines, addedCount: added, removedCount: removed, summary };
  }

  /**
   * Render the diff as a plain-text side-by-side table string.
   *
   * Added lines are prefixed with "+ ", removed with "- ", unchanged with "  ".
   */
  render(diff: VisualDiff): string {
    return diff.lines
      .map((l) => `${l.label}${l.content}`)
      .join("\n");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 15. Auto-Explain Mode
// ─────────────────────────────────────────────────────────────────────────────

/** Options for the auto-explain mode. */
export interface AutoExplainOptions {
  /** Target audience level. */
  audience: "beginner" | "intermediate" | "expert";
  /** Whether to explain every code block or just the first one. */
  explainAll: boolean;
}

/** A response with explanations appended after each code block. */
export interface ExplainedResponse {
  /** The augmented text with explanations inserted. */
  augmented: string;
  /** Number of code blocks that were explained. */
  blocksExplained: number;
}

/**
 * Automatically appends a plain-English explanation paragraph after every
 * fenced code block in an AI response.
 *
 * This helps vibe coders understand what each piece of generated code does
 * without having to ask a follow-up question.
 *
 * @example
 * const explainer = new AutoExplainMode();
 * const result = explainer.augment("Here's how:\n```js\nconsole.log('hi')\n```\n");
 * // result.blocksExplained → 1
 * // result.augmented contains an explanation paragraph after the code block
 */
export class AutoExplainMode {
  private _opts: AutoExplainOptions;

  constructor(opts: Partial<AutoExplainOptions> = {}) {
    this._opts = {
      audience: "beginner",
      explainAll: true,
      ...opts,
    };
  }

  get options(): AutoExplainOptions {
    return { ...this._opts };
  }

  /**
   * Augment an AI response by inserting plain-English explanations after
   * each fenced code block.
   *
   * @param response The raw AI response text (may contain markdown).
   * @param customExplanations Optional map of code-block content → custom explanation.
   */
  augment(response: string, customExplanations: Map<string, string> = new Map()): ExplainedResponse {
    const fenceRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
    let blocksExplained = 0;
    const insertions: Array<{ index: number; length: number; replacement: string }> = [];

    for (const match of response.matchAll(fenceRegex)) {
      if (!this._opts.explainAll && blocksExplained >= 1) break;

      const fullMatch = match[0];
      const codeContent = match[1].trim();
      const explanation =
        customExplanations.get(codeContent) ??
        this._generateExplanation(codeContent);

      const replacementSuffix = `\n\n> 💡 **What this does:** ${explanation}\n`;
      insertions.push({
        index: match.index!,
        length: fullMatch.length,
        replacement: fullMatch + replacementSuffix,
      });
      blocksExplained++;
    }

    // Apply insertions in reverse order to preserve indices
    let augmented = response;
    for (let i = insertions.length - 1; i >= 0; i--) {
      const ins = insertions[i];
      augmented =
        augmented.slice(0, ins.index) +
        ins.replacement +
        augmented.slice(ins.index + ins.length);
    }

    return { augmented, blocksExplained };
  }

  private _generateExplanation(code: string): string {
    const lines = code.split("\n").filter((l) => l.trim()).length;

    const audience = this._opts.audience;
    const suffix =
      audience === "beginner"
        ? " If any part of this is unclear, ask your AI assistant to explain it further."
        : "";

    if (code.includes("console.log") || /(^|\W)print\(/.test(code)) {
      return `This code prints a value to the terminal so you can see what's happening.${suffix}`;
    }
    if (/\bimport\b/.test(code) || code.includes("require(")) {
      return `This loads an external library or module that the rest of the code needs.${suffix}`;
    }
    if (/\basync\b/.test(code) && /\bawait\b/.test(code)) {
      return `This code makes a request that takes time (like fetching data from the internet) and waits for the result before continuing.${suffix}`;
    }
    if (/\bfunction\b/.test(code) || /\bdef\b/.test(code) || code.includes("=>")) {
      return `This defines a reusable block of code (a function) that you can call whenever you need it.${suffix}`;
    }
    if (/\bif\b/.test(code) || /\belse\b/.test(code)) {
      return `This checks a condition and runs different code depending on whether it's true or false.${suffix}`;
    }
    if (/\bfor\b/.test(code) || /\bwhile\b/.test(code) || code.includes("forEach")) {
      return `This loops through a list of items and does something with each one.${suffix}`;
    }
    if (/\bclass\b/.test(code)) {
      return `This defines a class — a blueprint for creating objects that share the same properties and behavior.${suffix}`;
    }

    return `This ${lines}-line block performs the logic described above.${suffix}`;
  }
}
