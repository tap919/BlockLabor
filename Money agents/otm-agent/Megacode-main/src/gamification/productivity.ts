/**
 * Gamification & Productivity for OverCoat.
 *
 * Implementation plan for gamification and productivity features:
 *
 * 1. Workflow Achievements
 *    - "You've saved 10 hours with aliases this week!"
 *    - Track milestones and celebrate productivity improvements
 *    - Implementation: Achievement definitions with criteria (thresholds),
 *      progress tracker per user/project, notification system for unlocks,
 *      persistent achievement storage
 *
 * 2. Productivity Insights
 *    - "You run 'git status' 50x/day, here's a faster workflow"
 *    - Analyze command patterns and suggest optimizations
 *    - Implementation: Command frequency analysis, redundancy detection,
 *      workflow optimization suggestions, daily/weekly reports
 *
 * 3. Command Macros
 *    - Record and replay complex workflows with variables
 *    - Parameterized macros for reusable command sequences
 *    - Implementation: Macro recording with start/stop capture,
 *      variable interpolation (${name}), storage/retrieval by name,
 *      import/export for sharing
 *
 * 4. Context Switching
 *    - Save and restore terminal states per project
 *    - Capture working directory, env vars, running processes, open files
 *    - Implementation: State snapshot capture, named context storage,
 *      restore with delta comparison, project auto-detection
 */

/** An achievement that can be unlocked. */
export interface Achievement {
  /** Unique achievement identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** Description of what this achievement represents. */
  description: string;
  /** Icon/emoji for the achievement. */
  icon: string;
  /** Category (e.g., "efficiency", "consistency", "exploration"). */
  category: string;
  /** Criteria to unlock this achievement. */
  criteria: AchievementCriteria;
  /** Whether the achievement has been unlocked. */
  unlocked: boolean;
  /** When the achievement was unlocked, if applicable. */
  unlockedAt?: number;
}

export interface AchievementCriteria {
  /** Metric to track (e.g., "commands_run", "aliases_used", "time_saved_hours"). */
  metric: string;
  /** Threshold value to unlock. */
  threshold: number;
}

/** A productivity insight/recommendation. */
export interface ProductivityInsight {
  id: string;
  /** The pattern observed. */
  observation: string;
  /** The recommended improvement. */
  recommendation: string;
  /** Estimated time savings per week. */
  estimatedSavingsMinutes: number;
  /** Priority (higher = more impactful). */
  priority: number;
  /** Commands related to this insight. */
  relatedCommands: string[];
}

/** A recorded command macro. */
export interface CommandMacro {
  /** Unique macro name. */
  name: string;
  /** Description of what the macro does. */
  description: string;
  /** Ordered list of commands in the macro. */
  commands: string[];
  /** Variable names used in the macro (e.g., ["branch", "version"]). */
  variables: string[];
  /** When the macro was created. */
  createdAt: number;
  /** How many times the macro has been run. */
  runCount: number;
}

/** A saved project context for context switching. */
export interface ProjectContextState {
  /** Context name (typically the project name). */
  name: string;
  /** Working directory. */
  cwd: string;
  /** Environment variables specific to this context. */
  envVars: Record<string, string>;
  /** Git branch that was active. */
  gitBranch?: string;
  /** Open files/tabs. */
  openFiles: string[];
  /** When this context was saved. */
  savedAt: number;
}

/** Built-in achievement definitions. */
const BUILT_IN_ACHIEVEMENTS: Omit<Achievement, "unlocked" | "unlockedAt">[] = [
  {
    id: "first-command",
    name: "Hello World",
    description: "Run your first command with OverCoat",
    icon: "👋",
    category: "exploration",
    criteria: { metric: "commands_run", threshold: 1 },
  },
  {
    id: "centurion",
    name: "Centurion",
    description: "Run 100 commands",
    icon: "💯",
    category: "consistency",
    criteria: { metric: "commands_run", threshold: 100 },
  },
  {
    id: "alias-hero",
    name: "Alias Hero",
    description: "Save 1 hour with aliases and macros",
    icon: "⚡",
    category: "efficiency",
    criteria: { metric: "time_saved_minutes", threshold: 60 },
  },
  {
    id: "streak-7",
    name: "Week Warrior",
    description: "Use OverCoat 7 days in a row",
    icon: "🔥",
    category: "consistency",
    criteria: { metric: "consecutive_days", threshold: 7 },
  },
  {
    id: "macro-creator",
    name: "Macro Master",
    description: "Create 5 command macros",
    icon: "🎯",
    category: "efficiency",
    criteria: { metric: "macros_created", threshold: 5 },
  },
  {
    id: "multi-project",
    name: "Multi-Tasker",
    description: "Work across 3 different projects",
    icon: "🔀",
    category: "exploration",
    criteria: { metric: "projects_used", threshold: 3 },
  },
];

/**
 * AchievementTracker manages workflow achievements and progress.
 */
export class AchievementTracker {
  private achievements: Achievement[];
  private metrics: Map<string, number> = new Map();
  private unlockHandlers: Array<(achievement: Achievement) => void> = [];

  constructor() {
    this.achievements = BUILT_IN_ACHIEVEMENTS.map((a) => ({
      ...a,
      unlocked: false,
    }));
  }

  /**
   * Update a metric value and check for newly unlocked achievements.
   */
  updateMetric(metric: string, value: number): Achievement[] {
    this.metrics.set(metric, value);
    const newlyUnlocked: Achievement[] = [];

    for (const achievement of this.achievements) {
      if (
        !achievement.unlocked &&
        achievement.criteria.metric === metric &&
        value >= achievement.criteria.threshold
      ) {
        achievement.unlocked = true;
        achievement.unlockedAt = Date.now();
        newlyUnlocked.push(achievement);
        this.unlockHandlers.forEach((h) => h(achievement));
      }
    }

    return newlyUnlocked;
  }

  /**
   * Increment a metric by a delta value.
   */
  incrementMetric(metric: string, delta: number = 1): Achievement[] {
    const current = this.metrics.get(metric) ?? 0;
    return this.updateMetric(metric, current + delta);
  }

  /** Get all achievements (both locked and unlocked). */
  getAll(): Achievement[] {
    return [...this.achievements];
  }

  /** Get only unlocked achievements. */
  getUnlocked(): Achievement[] {
    return this.achievements.filter((a) => a.unlocked);
  }

  /** Register a handler for achievement unlocks. */
  onUnlock(handler: (achievement: Achievement) => void): void {
    this.unlockHandlers.push(handler);
  }

  /** Get current value for a metric. */
  getMetric(metric: string): number {
    return this.metrics.get(metric) ?? 0;
  }
}

/**
 * ProductivityAnalyzer identifies workflow inefficiencies
 * and suggests improvements.
 */
export class ProductivityAnalyzer {
  private commandLog: Array<{ command: string; timestamp: number }> = [];

  /** Record a command execution. */
  recordCommand(command: string): void {
    this.commandLog.push({ command, timestamp: Date.now() });
  }

  /** Analyze usage patterns and generate insights. */
  analyze(): ProductivityInsight[] {
    const insights: ProductivityInsight[] = [];

    // Count command frequencies
    const frequencies = new Map<string, number>();
    for (const entry of this.commandLog) {
      const count = frequencies.get(entry.command) ?? 0;
      frequencies.set(entry.command, count + 1);
    }

    // Detect high-frequency commands that could be aliased
    for (const [command, count] of frequencies.entries()) {
      if (count >= 10 && command.length > 5) {
        insights.push({
          id: `freq-${command.replace(/\s+/g, "-")}`,
          observation: `You run '${command}' ${count} times in this session`,
          recommendation: `Create an alias or macro for this command to save time`,
          estimatedSavingsMinutes: Math.round(
            (count * command.length * 0.1) / 60
          ),
          priority: Math.min(10, Math.floor(count / 5)),
          relatedCommands: [command],
        });
      }
    }

    // Detect repeated git status checks
    const gitStatusCount = frequencies.get("git status") ?? 0;
    if (gitStatusCount >= 20) {
      insights.push({
        id: "git-status-overuse",
        observation: `You run 'git status' ${gitStatusCount}x — consider using a git-aware prompt`,
        recommendation:
          "Install a git-aware shell prompt (like starship or oh-my-zsh) to always see git status",
        estimatedSavingsMinutes: Math.round(gitStatusCount * 0.05),
        priority: 7,
        relatedCommands: ["git status"],
      });
    }

    // Detect sequential command patterns (A frequently followed by B)
    if (this.commandLog.length >= 4) {
      const pairCounts = new Map<string, number>();
      const firstCommandCounts = new Map<string, number>();
      for (let i = 0; i < this.commandLog.length - 1; i++) {
        const first = this.commandLog[i].command;
        const pair = `${first}|||${this.commandLog[i + 1].command}`;
        pairCounts.set(pair, (pairCounts.get(pair) ?? 0) + 1);
        firstCommandCounts.set(first, (firstCommandCounts.get(first) ?? 0) + 1);
      }

      for (const [pair, count] of pairCounts.entries()) {
        if (count >= 5) {
          const [first, second] = pair.split("|||");
          // Don't report if pair is just the same command repeated
          if (first !== second) {
            const totalFirstOccurrences = firstCommandCounts.get(first) ?? count;
            const consistencyPct = Math.round((count / totalFirstOccurrences) * 100);
            const frequencyWord = consistencyPct >= 80 ? "always" : "frequently";
            insights.push({
              id: `seq-${pair.replace(/[^\w]/g, "-")}`,
              observation: `You ${frequencyWord} run '${second}' right after '${first}' (${count} times, ${consistencyPct}% of the time)`,
              recommendation: `Consider combining these into a single alias or macro: '${first} && ${second}'`,
              estimatedSavingsMinutes: Math.round(count * 0.1),
              priority: Math.min(8, Math.floor(count / 2)),
              relatedCommands: [first, second],
            });
          }
        }
      }
    }

    return insights.sort((a, b) => b.priority - a.priority);
  }
}

/**
 * MacroManager handles recording, storing, and executing command macros.
 */
export class MacroManager {
  private macros: Map<string, CommandMacro> = new Map();
  private recording: { name: string; commands: string[] } | null = null;

  /** Start recording a new macro. */
  startRecording(name: string, description: string = ""): void {
    this.recording = { name, commands: [] };
    if (!this.macros.has(name)) {
      this.macros.set(name, {
        name,
        description,
        commands: [],
        variables: [],
        createdAt: Date.now(),
        runCount: 0,
      });
    }
  }

  /** Add a command to the current recording. */
  recordStep(command: string): void {
    if (this.recording) {
      this.recording.commands.push(command);
    }
  }

  /** Stop recording and save the macro. */
  stopRecording(): CommandMacro | null {
    if (!this.recording) return null;
    const macro = this.macros.get(this.recording.name);
    if (macro) {
      macro.commands = [...this.recording.commands];
      // Detect variable patterns like ${name}
      const varPattern = /\$\{(\w+)\}/g;
      const vars = new Set<string>();
      for (const cmd of macro.commands) {
        let match;
        while ((match = varPattern.exec(cmd)) !== null) {
          vars.add(match[1]);
        }
      }
      macro.variables = Array.from(vars);
    }
    this.recording = null;
    return macro ?? null;
  }

  /** Resolve a macro's commands with variable values. */
  resolve(
    name: string,
    variables: Record<string, string> = {}
  ): string[] | null {
    const macro = this.macros.get(name);
    if (!macro) return null;

    macro.runCount++;
    return macro.commands.map((cmd) =>
      cmd.replace(/\$\{(\w+)\}/g, (_, key) => variables[key] ?? `\${${key}}`)
    );
  }

  /** Get a macro by name. */
  getMacro(name: string): CommandMacro | null {
    return this.macros.get(name) ?? null;
  }

  /** List all macros. */
  listMacros(): CommandMacro[] {
    return Array.from(this.macros.values());
  }

  /** Delete a macro. */
  deleteMacro(name: string): boolean {
    return this.macros.delete(name);
  }
}

/**
 * ContextSwitcher saves and restores terminal states per project.
 */
export class ContextSwitcher {
  private contexts: Map<string, ProjectContextState> = new Map();
  private activeContext: string | null = null;

  /** Save the current context state. */
  save(state: ProjectContextState): void {
    this.contexts.set(state.name, { ...state, savedAt: Date.now() });
  }

  /** Load a saved context by name. */
  load(name: string): ProjectContextState | null {
    const ctx = this.contexts.get(name);
    if (ctx) {
      this.activeContext = name;
    }
    return ctx ?? null;
  }

  /** Get the currently active context name. */
  getActiveContext(): string | null {
    return this.activeContext;
  }

  /** List all saved contexts. */
  listContexts(): ProjectContextState[] {
    return Array.from(this.contexts.values());
  }

  /** Delete a saved context. */
  deleteContext(name: string): boolean {
    if (this.activeContext === name) {
      this.activeContext = null;
    }
    return this.contexts.delete(name);
  }
}
