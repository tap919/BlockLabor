/**
 * MegacodeMd — Items #6, #10, #21
 *
 * #6  — MEGACODE.md loader: auto-loads a project-level rules file and
 *        prepends it to every LLM context (replaces .cursorrules / CLAUDE.md).
 *
 * #10 — CursorRulesImporter: one-command import of .cursorrules or CLAUDE.md
 *        into MEGACODE.md format, so teams can migrate from Cursor or Claude Code.
 *
 * #21 — /init skill: scans the project (package.json, tsconfig.json, git log,
 *        test files, src structure) and auto-generates a MEGACODE.md.
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================================
// MEGACODE.md loader — Item #6
// ============================================================================

export interface MegacodeMdConfig {
  /** Directory to search for MEGACODE.md. Defaults to cwd. */
  rootDir?: string;
  /** Custom filename. Defaults to "MEGACODE.md". */
  filename?: string;
  /** Walk parent directories until found. Default true. */
  walkUp?: boolean;
}

export interface MegacodeMdContent {
  /** Absolute path of the file that was loaded. */
  filePath: string;
  /** Raw markdown content. */
  raw: string;
  /** Rules extracted from the file (lines starting with "-" or "*"). */
  rules: string[];
  /** Detected stack hints (e.g. "TypeScript", "React"). */
  stack: string[];
}

export class MegacodeMd {
  private readonly config: Required<MegacodeMdConfig>;
  private loaded: MegacodeMdContent | null = null;

  constructor(config: MegacodeMdConfig = {}) {
    this.config = {
      rootDir: config.rootDir ?? process.cwd(),
      filename: config.filename ?? "MEGACODE.md",
      walkUp: config.walkUp ?? true,
    };
  }

  /** Find and load MEGACODE.md. Returns null if not found. */
  load(): MegacodeMdContent | null {
    const filePath = this.locate();
    if (!filePath) return null;

    const raw = fs.readFileSync(filePath, "utf8");
    const rules: string[] = [];
    const stackHints = new Set<string>();

    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (/^[-*]\s/.test(trimmed)) rules.push(trimmed.replace(/^[-*]\s/, "").trim());

      // Detect stack hints
      if (/typescript|\.tsx?/i.test(trimmed)) stackHints.add("TypeScript");
      if (/react|jsx/i.test(trimmed)) stackHints.add("React");
      if (/next\.?js/i.test(trimmed)) stackHints.add("Next.js");
      if (/python|\.py\b/i.test(trimmed)) stackHints.add("Python");
      if (/rust|cargo/i.test(trimmed)) stackHints.add("Rust");
      if (/go\b|golang/i.test(trimmed)) stackHints.add("Go");
      if (/node\.?js/i.test(trimmed)) stackHints.add("Node.js");
    }

    this.loaded = { filePath, raw, rules, stack: [...stackHints] };
    return this.loaded;
  }

  /** Build a system-prompt prefix from the loaded rules. */
  toSystemPrompt(): string {
    if (!this.loaded) this.load();
    if (!this.loaded) return "";
    const lines = ["# Project Rules (MEGACODE.md)\n", this.loaded.raw, "\n---\n"];
    return lines.join("\n");
  }

  /** Get the last loaded content. */
  get content(): MegacodeMdContent | null {
    return this.loaded;
  }

  /** True if a MEGACODE.md was found. */
  exists(): boolean {
    return this.locate() !== null;
  }

  /** Save new content to MEGACODE.md. */
  save(content: string, overwrite = false): string {
    const target = path.join(this.config.rootDir, this.config.filename);
    if (fs.existsSync(target) && !overwrite) {
      throw new Error(`${target} already exists. Pass overwrite=true to replace it.`);
    }
    fs.writeFileSync(target, content, "utf8");
    this.load(); // Reload
    return target;
  }

  private locate(): string | null {
    let dir = this.config.rootDir;
    while (true) {
      const candidate = path.join(dir, this.config.filename);
      if (fs.existsSync(candidate)) return candidate;
      if (!this.config.walkUp) return null;
      const parent = path.dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }
  }
}

// ============================================================================
// CursorRulesImporter — Item #10
// ============================================================================

export interface ImportResult {
  source: string;
  destination: string;
  rulesImported: number;
}

export class CursorRulesImporter {
  /**
   * Import .cursorrules, CLAUDE.md, or any plaintext rules file
   * into MEGACODE.md format.
   */
  static import(
    sourcePath: string,
    rootDir = process.cwd(),
    overwrite = false
  ): ImportResult {
    const destination = path.join(rootDir, "MEGACODE.md");

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source file not found: ${sourcePath}`);
    }
    if (fs.existsSync(destination) && !overwrite) {
      throw new Error(`MEGACODE.md already exists. Pass overwrite=true to replace.`);
    }

    const raw = fs.readFileSync(sourcePath, "utf8");
    const basename = path.basename(sourcePath);

    // Build MEGACODE.md with attribution header
    const content = [
      `# MEGACODE.md`,
      ``,
      `> Imported from \`${basename}\` on ${new Date().toISOString().slice(0, 10)}.`,
      `> Edit this file to configure Megacode AI behavior for this project.`,
      ``,
      `---`,
      ``,
      raw.trim(),
      ``,
    ].join("\n");

    fs.writeFileSync(destination, content, "utf8");

    // Count rule lines
    const rules = raw.split("\n").filter(l => /^[-*]\s/.test(l.trim()));
    return { source: sourcePath, destination, rulesImported: rules.length };
  }

  /** Find importable files in the project root. */
  static findImportable(rootDir = process.cwd()): string[] {
    const candidates = [".cursorrules", "CLAUDE.md", ".claude-rules", ".ai-rules"];
    return candidates
      .map(f => path.join(rootDir, f))
      .filter(fs.existsSync);
  }
}

// ============================================================================
// InitSkill — Item #21
// ============================================================================

export interface ProjectScan {
  name: string;
  version?: string;
  stack: string[];
  testFramework?: string;
  hasTypeScript: boolean;
  hasGit: boolean;
  srcDirs: string[];
  testDirs: string[];
  packageManager: "npm" | "yarn" | "pnpm" | "unknown";
}

export class InitSkill {
  /**
   * Scan the project and generate a MEGACODE.md file.
   * Returns the generated content.
   */
  static async run(rootDir = process.cwd(), overwrite = false): Promise<string> {
    const scan = InitSkill.scan(rootDir);
    const content = InitSkill.generate(scan);

    const megacode = new MegacodeMd({ rootDir });
    megacode.save(content, overwrite);
    return content;
  }

  /** Scan the project for stack and conventions. */
  static scan(rootDir: string): ProjectScan {
    const stack: string[] = [];
    let name = path.basename(rootDir);
    let version: string | undefined;
    let testFramework: string | undefined;
    let packageManager: "npm" | "yarn" | "pnpm" | "unknown" = "unknown";

    // package.json
    const pkgPath = path.join(rootDir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        name = pkg.name ?? name;
        version = pkg.version;
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        if (deps.react) stack.push("React");
        if (deps.next) stack.push("Next.js");
        if (deps.vue) stack.push("Vue");
        if (deps.svelte) stack.push("Svelte");
        if (deps.express || deps.fastify) stack.push("Node.js/Express");
        if (deps.jest) testFramework = "Jest";
        if (deps.vitest) testFramework = "Vitest";
        if (deps.mocha) testFramework = "Mocha";
      } catch { /* ignore */ }
    }

    // tsconfig.json → TypeScript
    const hasTypeScript = fs.existsSync(path.join(rootDir, "tsconfig.json"));
    if (hasTypeScript && !stack.includes("TypeScript")) stack.unshift("TypeScript");

    // Detect package manager
    if (fs.existsSync(path.join(rootDir, "pnpm-lock.yaml"))) packageManager = "pnpm";
    else if (fs.existsSync(path.join(rootDir, "yarn.lock"))) packageManager = "yarn";
    else if (fs.existsSync(path.join(rootDir, "package-lock.json"))) packageManager = "npm";

    // Detect git
    const hasGit = fs.existsSync(path.join(rootDir, ".git"));

    // Find src/test dirs (shallow scan)
    const srcDirs: string[] = [];
    const testDirs: string[] = [];
    try {
      for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (["src", "lib", "app", "packages"].includes(entry.name)) srcDirs.push(entry.name);
        if (["test", "tests", "__tests__", "spec"].includes(entry.name)) testDirs.push(entry.name);
      }
    } catch { /* ignore */ }

    // Cargo.toml → Rust
    if (fs.existsSync(path.join(rootDir, "Cargo.toml"))) stack.push("Rust");
    // requirements.txt / pyproject.toml → Python
    if (
      fs.existsSync(path.join(rootDir, "requirements.txt")) ||
      fs.existsSync(path.join(rootDir, "pyproject.toml"))
    ) stack.push("Python");
    // go.mod → Go
    if (fs.existsSync(path.join(rootDir, "go.mod"))) stack.push("Go");

    return { name, version, stack, testFramework, hasTypeScript, hasGit, srcDirs, testDirs, packageManager };
  }

  /** Generate MEGACODE.md content from a project scan. */
  static generate(scan: ProjectScan): string {
    const stack = scan.stack.length > 0 ? scan.stack.join(", ") : "Unknown";
    const pm = scan.packageManager !== "unknown" ? scan.packageManager : "npm";

    return [
      `# MEGACODE.md`,
      ``,
      `> Auto-generated by \`/init\` on ${new Date().toISOString().slice(0, 10)}.`,
      `> Edit this file to guide Megacode AI behavior for **${scan.name}**.`,
      ``,
      `## Project`,
      ``,
      `- **Name**: ${scan.name}${scan.version ? ` v${scan.version}` : ""}`,
      `- **Stack**: ${stack}`,
      `- **Package manager**: ${pm}`,
      `- **Testing**: ${scan.testFramework ?? "none detected"}`,
      `- **Git**: ${scan.hasGit ? "yes" : "no"}`,
      ``,
      `## Source Layout`,
      ``,
      scan.srcDirs.length > 0
        ? scan.srcDirs.map(d => `- \`${d}/\``).join("\n")
        : "- (standard layout)",
      ``,
      `## Coding Rules`,
      ``,
      `- Always use ${scan.hasTypeScript ? "TypeScript with strict mode" : "the project's existing language"}.`,
      `- Write tests for all new public functions${scan.testFramework ? ` using ${scan.testFramework}` : ""}.`,
      `- Follow existing naming conventions — check nearby files before introducing new patterns.`,
      `- Prefer editing existing files over creating new ones.`,
      `- No TODOs in committed code — resolve or create a tracked issue instead.`,
      `- Keep functions under 50 lines; extract helpers freely.`,
      ``,
      `## AI Behavior`,
      ``,
      `- Ask before making large architectural changes.`,
      `- Prefer incremental, reviewable changes over large rewrites.`,
      `- Surface trade-offs rather than picking silently.`,
      `- When in doubt, read the existing code before writing new code.`,
      ``,
    ].join("\n");
  }
}
