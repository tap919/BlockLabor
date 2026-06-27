/**
 * Knowledge Management for OverCoat.
 *
 * Implementation plan for knowledge management features:
 *
 * 1. Command Documentation
 *    - Auto-generates docs for your scripts
 *    - Parses script comments, function signatures, and usage patterns
 *    - Implementation: Script parser for common languages (bash, python, node),
 *      JSDoc/docstring extraction, markdown doc generation,
 *      man-page-style output for custom commands
 *
 * 2. Learning Mode
 *    - Explains what each command does as you type
 *    - Interactive explanations with examples
 *    - Implementation: Command knowledge base with descriptions and
 *      common options, real-time lookup as user types,
 *      difficulty level adaptation (beginner/intermediate/expert),
 *      links to official documentation
 *
 * 3. Snippet Library
 *    - Personal and team command library with tags
 *    - Searchable, shareable code/command snippets
 *    - Implementation: Snippet storage with metadata (tags, description,
 *      language, author), full-text search, import/export (JSON/YAML),
 *      team sync via git or API
 *
 * 4. Contextual Help
 *    - Shows relevant examples based on current directory
 *    - Detects project type and suggests relevant commands
 *    - Implementation: Directory-based project detection (package.json,
 *      Cargo.toml, setup.py), project-type knowledge bases,
 *      context-sensitive help provider, IDE integration
 */

/** Documentation entry for a command or script. */
export interface DocEntry {
  /** Command or script name. */
  name: string;
  /** Brief description. */
  description: string;
  /** Usage syntax. */
  usage: string;
  /** Detailed explanation. */
  details?: string;
  /** Usage examples. */
  examples: DocExample[];
  /** Options/flags documentation. */
  options: DocOption[];
  /** Related commands. */
  seeAlso: string[];
  /** Auto-generated or manually written. */
  source: "auto" | "manual";
}

export interface DocExample {
  /** Example command. */
  command: string;
  /** What the example does. */
  description: string;
}

export interface DocOption {
  /** Flag name (e.g., "--verbose", "-v"). */
  flag: string;
  /** Description of the option. */
  description: string;
  /** Whether a value is required. */
  requiresValue: boolean;
  /** Default value, if any. */
  defaultValue?: string;
}

/** A command explanation for learning mode. */
export interface CommandExplanation {
  /** The full command. */
  command: string;
  /** Program name. */
  program: string;
  /** Human-readable explanation. */
  explanation: string;
  /** Breakdown of each part of the command. */
  parts: Array<{
    text: string;
    meaning: string;
  }>;
  /** Skill level needed to understand this command. */
  level: "beginner" | "intermediate" | "expert";
  /** Link to official docs, if available. */
  docUrl?: string;
}

/** A code/command snippet. */
export interface Snippet {
  /** Unique snippet identifier. */
  id: string;
  /** Display title. */
  title: string;
  /** The snippet content. */
  content: string;
  /** Language (e.g., "bash", "python", "typescript"). */
  language: string;
  /** Description. */
  description: string;
  /** Tags for categorization. */
  tags: string[];
  /** Author identifier. */
  author?: string;
  /** When the snippet was created. */
  createdAt: number;
  /** When the snippet was last updated. */
  updatedAt: number;
}

/** Help suggestion based on current context. */
export interface ContextualHelpItem {
  /** The suggested command. */
  command: string;
  /** Why this command is relevant. */
  reason: string;
  /** Brief description. */
  description: string;
  /** Category (e.g., "build", "test", "deploy", "debug"). */
  category: string;
  /** Relevance score 0-1. */
  relevance: number;
}

/** Known command descriptions for learning mode. */
const COMMAND_KNOWLEDGE: Record<
  string,
  { description: string; level: CommandExplanation["level"]; docUrl?: string }
> = {
  ls: { description: "List directory contents", level: "beginner" },
  cd: { description: "Change the current directory", level: "beginner" },
  cat: { description: "Concatenate and display file contents", level: "beginner" },
  echo: { description: "Print text to standard output", level: "beginner" },
  mkdir: { description: "Create directories", level: "beginner" },
  touch: { description: "Create empty files or update timestamps", level: "beginner" },
  cp: { description: "Copy files and directories", level: "beginner" },
  mv: { description: "Move or rename files and directories", level: "beginner" },
  rm: { description: "Remove files or directories", level: "beginner" },
  pwd: { description: "Print the current working directory", level: "beginner" },
  grep: { description: "Search for patterns in text", level: "intermediate" },
  find: { description: "Search for files in a directory hierarchy", level: "intermediate" },
  sed: { description: "Stream editor for text transformation", level: "expert" },
  awk: { description: "Pattern scanning and processing language", level: "expert" },
  curl: { description: "Transfer data from or to a server", level: "intermediate" },
  wget: { description: "Download files from the web", level: "intermediate" },
  git: { description: "Distributed version control system", level: "beginner" },
  npm: { description: "Node.js package manager", level: "beginner" },
  npx: { description: "Execute Node.js packages without installing", level: "beginner" },
  node: { description: "JavaScript runtime built on Chrome's V8 engine", level: "beginner" },
  yarn: { description: "Fast, reliable Node.js package manager", level: "beginner" },
  pnpm: { description: "Efficient Node.js package manager", level: "intermediate" },
  tsc: { description: "TypeScript compiler", level: "intermediate" },
  python: { description: "Python programming language interpreter", level: "beginner" },
  pip: { description: "Python package installer", level: "beginner" },
  pip3: { description: "Python 3 package installer", level: "beginner" },
  pytest: { description: "Python testing framework", level: "intermediate" },
  docker: { description: "Container runtime and management", level: "intermediate" },
  kubectl: { description: "Kubernetes command-line tool", level: "expert" },
  ssh: { description: "Secure shell remote login", level: "intermediate" },
  tar: { description: "Archive files", level: "intermediate" },
  chmod: { description: "Change file permissions", level: "intermediate" },
  chown: { description: "Change file ownership", level: "intermediate" },
  cargo: { description: "Rust package manager and build tool", level: "intermediate" },
  rustc: { description: "Rust programming language compiler", level: "intermediate" },
  go: { description: "Go programming language toolchain", level: "intermediate" },
  make: { description: "Build automation tool", level: "intermediate" },
  terraform: { description: "Infrastructure as code tool", level: "expert" },
  jq: { description: "Command-line JSON processor", level: "intermediate" },
  sort: { description: "Sort lines of text", level: "beginner" },
  uniq: { description: "Filter adjacent duplicate lines", level: "intermediate" },
  xargs: { description: "Build and execute command lines from standard input", level: "intermediate" },
  tee: { description: "Read from stdin and write to stdout and files", level: "intermediate" },
  ps: { description: "Report a snapshot of current processes", level: "intermediate" },
  kill: { description: "Send a signal to a process", level: "intermediate" },
  top: { description: "Display Linux processes in real time", level: "beginner" },
  df: { description: "Report file system disk space usage", level: "beginner" },
  du: { description: "Estimate file space usage", level: "beginner" },
};

/** Project type detection patterns. */
const PROJECT_PATTERNS: Array<{
  files: string[];
  type: string;
  helpCommands: ContextualHelpItem[];
}> = [
  {
    files: ["package.json"],
    type: "node",
    helpCommands: [
      { command: "npm install", reason: "Install dependencies", description: "Install all project dependencies from package.json", category: "setup", relevance: 0.9 },
      { command: "npm test", reason: "Run tests", description: "Execute the project test suite", category: "test", relevance: 0.8 },
      { command: "npm run build", reason: "Build project", description: "Compile/bundle the project", category: "build", relevance: 0.8 },
    ],
  },
  {
    files: ["Cargo.toml"],
    type: "rust",
    helpCommands: [
      { command: "cargo build", reason: "Compile the project", description: "Build the Rust project", category: "build", relevance: 0.9 },
      { command: "cargo test", reason: "Run tests", description: "Execute Rust test suite", category: "test", relevance: 0.8 },
      { command: "cargo run", reason: "Run the project", description: "Build and run the project", category: "execute", relevance: 0.8 },
      { command: "cargo clippy", reason: "Lint the project", description: "Run Rust linter for code quality", category: "quality", relevance: 0.7 },
      { command: "cargo fmt", reason: "Format code", description: "Apply Rust code formatting", category: "quality", relevance: 0.7 },
    ],
  },
  {
    files: ["setup.py", "pyproject.toml", "requirements.txt"],
    type: "python",
    helpCommands: [
      { command: "pip install -r requirements.txt", reason: "Install dependencies", description: "Install Python dependencies", category: "setup", relevance: 0.9 },
      { command: "python -m pytest", reason: "Run tests", description: "Execute pytest test suite", category: "test", relevance: 0.8 },
      { command: "python -m black .", reason: "Format code", description: "Apply Black code formatter", category: "quality", relevance: 0.7 },
    ],
  },
  {
    files: ["go.mod"],
    type: "go",
    helpCommands: [
      { command: "go build ./...", reason: "Build all packages", description: "Compile Go packages", category: "build", relevance: 0.9 },
      { command: "go test ./...", reason: "Run all tests", description: "Execute Go test suite", category: "test", relevance: 0.8 },
      { command: "go vet ./...", reason: "Lint the project", description: "Run Go vet for code issues", category: "quality", relevance: 0.7 },
    ],
  },
  {
    files: ["pom.xml"],
    type: "java-maven",
    helpCommands: [
      { command: "mvn install", reason: "Build and install", description: "Build the project and install to local repository", category: "build", relevance: 0.9 },
      { command: "mvn test", reason: "Run tests", description: "Execute Maven test phase", category: "test", relevance: 0.8 },
      { command: "mvn clean package", reason: "Clean and package", description: "Clean and create deployable artifact", category: "build", relevance: 0.8 },
    ],
  },
  {
    files: ["build.gradle", "build.gradle.kts"],
    type: "java-gradle",
    helpCommands: [
      { command: "./gradlew build", reason: "Build the project", description: "Build using Gradle wrapper", category: "build", relevance: 0.9 },
      { command: "./gradlew test", reason: "Run tests", description: "Execute Gradle test task", category: "test", relevance: 0.8 },
      { command: "./gradlew clean", reason: "Clean build", description: "Remove all build outputs", category: "build", relevance: 0.7 },
    ],
  },
  {
    files: ["Gemfile"],
    type: "ruby",
    helpCommands: [
      { command: "bundle install", reason: "Install dependencies", description: "Install Ruby gems from Gemfile", category: "setup", relevance: 0.9 },
      { command: "bundle exec rspec", reason: "Run tests", description: "Execute RSpec test suite", category: "test", relevance: 0.8 },
      { command: "bundle exec rake", reason: "Run tasks", description: "Execute Rake tasks", category: "execute", relevance: 0.7 },
    ],
  },
  {
    files: ["Dockerfile"],
    type: "docker",
    helpCommands: [
      { command: "docker build -t app .", reason: "Build image", description: "Build a Docker image from Dockerfile", category: "build", relevance: 0.9 },
      { command: "docker run -it app", reason: "Run container", description: "Run a container from the image", category: "execute", relevance: 0.8 },
      { command: "docker-compose up", reason: "Start services", description: "Start all services defined in docker-compose.yml", category: "execute", relevance: 0.8 },
    ],
  },
  {
    files: ["main.tf", "terraform.tf"],
    type: "terraform",
    helpCommands: [
      { command: "terraform init", reason: "Initialize workspace", description: "Initialize Terraform working directory", category: "setup", relevance: 0.9 },
      { command: "terraform plan", reason: "Preview changes", description: "Show what Terraform will do before applying", category: "query", relevance: 0.9 },
      { command: "terraform apply", reason: "Apply changes", description: "Apply the Terraform configuration", category: "execute", relevance: 0.8 },
    ],
  },
];

/**
 * DocGenerator auto-generates documentation for scripts and commands.
 */
export class DocGenerator {
  /**
   * Generate documentation from a script's content by parsing comments.
   */
  generateFromScript(
    name: string,
    content: string,
    language: string = "bash"
  ): DocEntry {
    const lines = content.split("\n");
    const examples: DocExample[] = [];
    const options: DocOption[] = [];
    let description = "";
    let usage = name;
    let details = "";

    // Extract description from top comments
    for (const line of lines) {
      if (language === "bash" && line.startsWith("#") && !line.startsWith("#!")) {
        const text = line.replace(/^#+\s*/, "").trim();
        if (text && !description) {
          description = text;
        }
      } else if (
        (language === "python" || language === "typescript") &&
        (line.includes('"""') || line.includes("/**"))
      ) {
        const text = line
          .replace(/"""/g, "")
          .replace(/\/\*\*/g, "")
          .replace(/\*\//g, "")
          .trim();
        if (text && !description) {
          description = text;
        }
      }
    }

    // Extract usage patterns (look for "Usage:" comments)
    for (const line of lines) {
      const usageMatch = line.match(/[Uu]sage:\s*(.+)/);
      if (usageMatch) {
        usage = usageMatch[1].trim();
        break;
      }
    }

    // Extract JSDoc @param tags (TypeScript/JavaScript)
    if (language === "typescript" || language === "javascript") {
      for (const line of lines) {
        const paramMatch = line.match(/\*\s*@param\s+(?:\{[^}]+\}\s+)?(\w+)\s*[-–]?\s*(.*)/);
        if (paramMatch) {
          options.push({
            flag: `--${paramMatch[1]}`,
            description: paramMatch[2].trim(),
            requiresValue: true,
          });
        }

        const returnsMatch = line.match(/\*\s*@returns?\s+(.*)/);
        if (returnsMatch && !details) {
          details = `Returns: ${returnsMatch[1].trim()}`;
        }

        // Extract @example tags
        const exampleMatch = line.match(/\*\s*@example\s+(.*)/);
        if (exampleMatch && exampleMatch[1].trim()) {
          examples.push({
            command: exampleMatch[1].trim(),
            description: "Example from JSDoc",
          });
        }
      }
    }

    // Extract option flags from the content
    const flagPattern = /--(\w[\w-]*)/g;
    const seenFlags = new Set<string>(options.map((o) => o.flag));
    let match;
    while ((match = flagPattern.exec(content)) !== null) {
      const flag = `--${match[1]}`;
      if (!seenFlags.has(flag)) {
        seenFlags.add(flag);
        options.push({
          flag,
          description: "",
          requiresValue: false,
        });
      }
    }

    return {
      name,
      description: description || `Documentation for ${name}`,
      usage,
      details: details || undefined,
      examples,
      options,
      seeAlso: [],
      source: "auto",
    };
  }
}

/**
 * LearningMode explains commands as the user types them.
 */
export class LearningMode {
  private enabled: boolean = true;

  /** Toggle learning mode on/off. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Check if learning mode is active. */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Explain a command, breaking it into parts with descriptions.
   */
  explain(command: string): CommandExplanation {
    const parts = command.trim().split(/\s+/);
    const program = parts[0] ?? "";
    const knowledge = COMMAND_KNOWLEDGE[program];

    const breakdown: CommandExplanation["parts"] = parts.map((part, i) => {
      if (i === 0) {
        return {
          text: part,
          meaning: knowledge?.description ?? `Execute '${part}'`,
        };
      }
      if (part.startsWith("--")) {
        return { text: part, meaning: `Long option: ${part}` };
      }
      if (part.startsWith("-")) {
        return { text: part, meaning: `Short option: ${part}` };
      }
      return { text: part, meaning: `Argument: ${part}` };
    });

    return {
      command,
      program,
      explanation:
        knowledge?.description ?? `Execute the '${program}' command`,
      parts: breakdown,
      level: knowledge?.level ?? "beginner",
      docUrl: knowledge?.docUrl,
    };
  }
}

/**
 * SnippetLibrary manages a searchable collection of code snippets.
 */
export class SnippetLibrary {
  private snippets: Map<string, Snippet> = new Map();
  private counter: number = 0;

  /** Add a new snippet. */
  add(
    title: string,
    content: string,
    language: string,
    description: string = "",
    tags: string[] = []
  ): Snippet {
    const id = `snip-${++this.counter}`;
    const snippet: Snippet = {
      id,
      title,
      content,
      language,
      description,
      tags,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.snippets.set(id, snippet);
    return snippet;
  }

  /** Search snippets by query text or tag. */
  search(query: string): Snippet[] {
    const lower = query.toLowerCase();
    return Array.from(this.snippets.values()).filter(
      (s) =>
        s.title.toLowerCase().includes(lower) ||
        s.content.toLowerCase().includes(lower) ||
        s.description.toLowerCase().includes(lower) ||
        s.tags.some((t) => t.toLowerCase().includes(lower))
    );
  }

  /** Get a snippet by ID. */
  get(id: string): Snippet | null {
    return this.snippets.get(id) ?? null;
  }

  /** Delete a snippet. */
  delete(id: string): boolean {
    return this.snippets.delete(id);
  }

  /** Get all snippets. */
  getAll(): Snippet[] {
    return Array.from(this.snippets.values());
  }

  /** Get snippets by tag. */
  getByTag(tag: string): Snippet[] {
    return Array.from(this.snippets.values()).filter((s) =>
      s.tags.includes(tag)
    );
  }

  /** Get snippets by language. */
  getByLanguage(language: string): Snippet[] {
    return Array.from(this.snippets.values()).filter(
      (s) => s.language === language
    );
  }

  /**
   * Export all snippets as a JSON string.
   * The returned string can be stored to disk or shared with a team.
   */
  exportJSON(): string {
    return JSON.stringify(Array.from(this.snippets.values()), null, 2);
  }

  /**
   * Import snippets from a JSON string produced by `exportJSON()`.
   * Skips duplicates (existing IDs are not overwritten).
   * Returns the number of snippets successfully imported.
   */
  importJSON(json: string): number {
    let snippets: unknown;
    try {
      snippets = JSON.parse(json);
    } catch {
      return 0;
    }
    if (!Array.isArray(snippets)) return 0;

    let imported = 0;
    for (const item of snippets) {
      if (
        item &&
        typeof item === "object" &&
        typeof (item as Snippet).id === "string" &&
        typeof (item as Snippet).title === "string" &&
        typeof (item as Snippet).content === "string"
      ) {
        const snippet = item as Snippet;
        if (!this.snippets.has(snippet.id)) {
          this.snippets.set(snippet.id, snippet);
          imported++;
        }
      }
    }
    return imported;
  }
}

/**
 * ContextualHelpProvider suggests relevant commands based on
 * the current project directory and detected project type.
 */
export class ContextualHelpProvider {
  /**
   * Detect project type from files present in the directory.
   */
  detectProjectType(files: string[]): string {
    for (const projectPattern of PROJECT_PATTERNS) {
      if (projectPattern.files.some((f) => files.includes(f))) {
        return projectPattern.type;
      }
    }
    return "unknown";
  }

  /**
   * Get help suggestions based on project files.
   */
  getHelp(files: string[]): ContextualHelpItem[] {
    const results: ContextualHelpItem[] = [];

    for (const projectPattern of PROJECT_PATTERNS) {
      if (projectPattern.files.some((f) => files.includes(f))) {
        results.push(...projectPattern.helpCommands);
      }
    }

    return results.sort((a, b) => b.relevance - a.relevance);
  }
}
