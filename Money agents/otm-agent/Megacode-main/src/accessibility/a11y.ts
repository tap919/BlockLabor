/**
 * Accessibility & Inclusivity for OverCoat.
 *
 * Implementation plan for accessibility features:
 *
 * 1. Voice Control
 *    - "Claude, deploy the app"
 *    - Voice-to-text integration for hands-free operation
 *    - Implementation: Speech recognition API integration (Web Speech API
 *      or platform-native), wake word detection, command parsing from
 *      spoken input, voice feedback for command results,
 *      configurable wake word and language
 *
 * 2. Screen Reader Optimized
 *    - For visually impaired developers
 *    - ARIA-like annotations for terminal output
 *    - Implementation: Structured output with semantic labels,
 *      plain-text mode (no ANSI/Unicode decorations),
 *      screen reader announcement system, keyboard-only navigation,
 *      high-contrast mode
 *
 * 3. Internationalization (i18n)
 *    - Commands and help in multiple languages
 *    - Translatable message system
 *    - Implementation: Message catalog with locale keys,
 *      locale detection from environment, pluralization rules,
 *      fallback to English for missing translations,
 *      community-contributed translations
 *
 * 4. Cognitive Load Reduction
 *    - Simplifies complex commands progressively
 *    - Multi-level interface from simple to expert
 *    - Implementation: Command complexity scoring, progressive
 *      disclosure (show simple form first, expand for advanced),
 *      guided wizards for complex operations,
 *      configurable verbosity levels
 */

/** Supported locales. */
export type Locale =
  | "en"
  | "es"
  | "fr"
  | "de"
  | "ja"
  | "zh"
  | "ko"
  | "pt"
  | "ru"
  | "ar";

/** A translatable message with locale variants. */
export interface Message {
  /** Message key identifier. */
  key: string;
  /** Translations keyed by locale. */
  translations: Partial<Record<Locale, string>>;
  /** Default text (English). */
  defaultText: string;
}

/** Voice command configuration. */
export interface VoiceConfig {
  /** Whether voice control is enabled. */
  enabled: boolean;
  /** Wake word to activate listening (e.g., "claude", "overcoat"). */
  wakeWord: string;
  /** Language for speech recognition. */
  language: string;
  /** Whether to provide voice feedback for results. */
  voiceFeedback: boolean;
}

/** Screen reader output configuration. */
export interface ScreenReaderConfig {
  /** Whether screen reader mode is active. */
  enabled: boolean;
  /** Strip ANSI color codes from output. */
  stripColors: boolean;
  /** Replace Unicode symbols with text equivalents. */
  replaceSymbols: boolean;
  /** High contrast mode. */
  highContrast: boolean;
  /** Verbosity level for announcements. */
  verbosity: "minimal" | "normal" | "verbose";
}

/** Cognitive complexity level for commands. */
export type ComplexityLevel = "simple" | "intermediate" | "advanced" | "expert";

/** A simplified version of a complex command. */
export interface SimplifiedCommand {
  /** The original complex command. */
  original: string;
  /** The simplified version(s), from simplest to most detailed. */
  levels: Array<{
    level: ComplexityLevel;
    command: string;
    explanation: string;
  }>;
}

/** An accessibility announcement for screen readers. */
export interface Announcement {
  /** Text to announce. */
  text: string;
  /** Priority of the announcement. */
  priority: "polite" | "assertive";
  /** Timestamp. */
  timestamp: number;
}

/** Unicode symbol replacements for screen reader mode. */
const SYMBOL_REPLACEMENTS: Array<{ symbol: string; text: string }> = [
  { symbol: "✓", text: "[OK]" },
  { symbol: "✗", text: "[FAIL]" },
  { symbol: "⚠", text: "[WARN]" },
  { symbol: "→", text: "->" },
  { symbol: "←", text: "<-" },
  { symbol: "●", text: "[*]" },
  { symbol: "○", text: "[ ]" },
  { symbol: "█", text: "#" },
  { symbol: "░", text: "." },
  { symbol: "⠋", text: "|" },
  { symbol: "⠙", text: "/" },
  { symbol: "⠹", text: "-" },
  { symbol: "⠸", text: "\\" },
];

/** Default English messages. */
const DEFAULT_MESSAGES: Record<string, string> = {
  "command.success": "Command completed successfully",
  "command.failure": "Command failed with exit code {exitCode}",
  "command.running": "Running: {command}",
  "session.started": "Session started: {name}",
  "session.ended": "Session ended. Duration: {duration}",
  "error.unknown": "An unknown error occurred",
  "help.usage": "Usage: {usage}",
  "help.options": "Options:",
  "help.examples": "Examples:",
  "progress.complete": "Complete: {label}",
  "progress.percent": "{label}: {percent}% complete",
};

/**
 * I18nManager provides internationalization support with
 * locale-aware message formatting.
 */
export class I18nManager {
  private locale: Locale;
  private messages: Map<string, Message> = new Map();

  constructor(locale: Locale = "en") {
    this.locale = locale;
    this.loadDefaults();
  }

  /** Set the active locale. */
  setLocale(locale: Locale): void {
    this.locale = locale;
  }

  /** Get the active locale. */
  getLocale(): Locale {
    return this.locale;
  }

  /**
   * Get a translated message, with optional variable interpolation.
   */
  t(key: string, vars: Record<string, string | number> = {}): string {
    const message = this.messages.get(key);
    let text =
      message?.translations[this.locale] ??
      message?.defaultText ??
      key;

    // Interpolate variables
    for (const [varName, value] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${varName}\\}`, "g"), String(value));
    }

    return text;
  }

  /**
   * Add a message to the catalog.
   */
  addMessage(message: Message): void {
    this.messages.set(message.key, message);
  }

  /**
   * Add translations for a locale.
   */
  addTranslations(
    locale: Locale,
    translations: Record<string, string>
  ): void {
    for (const [key, text] of Object.entries(translations)) {
      const existing = this.messages.get(key);
      if (existing) {
        existing.translations[locale] = text;
      } else {
        this.messages.set(key, {
          key,
          defaultText: text,
          translations: { [locale]: text },
        });
      }
    }
  }

  /** Get all available locales that have translations. */
  getAvailableLocales(): Locale[] {
    const locales = new Set<Locale>();
    locales.add("en"); // Always available
    for (const message of this.messages.values()) {
      for (const locale of Object.keys(message.translations) as Locale[]) {
        locales.add(locale);
      }
    }
    return Array.from(locales);
  }

  private loadDefaults(): void {
    for (const [key, text] of Object.entries(DEFAULT_MESSAGES)) {
      this.messages.set(key, {
        key,
        defaultText: text,
        translations: { en: text },
      });
    }
  }
}

/**
 * ScreenReaderAdapter transforms output for screen reader compatibility.
 */
export class ScreenReaderAdapter {
  private config: ScreenReaderConfig;
  private announcements: Announcement[] = [];

  constructor(config: Partial<ScreenReaderConfig> = {}) {
    this.config = {
      enabled: false,
      stripColors: true,
      replaceSymbols: true,
      highContrast: false,
      verbosity: "normal",
      ...config,
    };
  }

  /** Check if screen reader mode is active. */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /** Enable or disable screen reader mode. */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Transform output for screen reader compatibility.
   */
  transform(output: string): string {
    if (!this.config.enabled) return output;

    let result = output;

    // Strip ANSI color codes
    if (this.config.stripColors) {
      result = result.replace(
        /\x1b\[[0-9;]*[a-zA-Z]/g,
        ""
      );
    }

    // Replace Unicode symbols with text equivalents
    if (this.config.replaceSymbols) {
      for (const { symbol, text } of SYMBOL_REPLACEMENTS) {
        result = result.split(symbol).join(text);
      }
    }

    return result;
  }

  /**
   * Queue an announcement for the screen reader.
   */
  announce(text: string, priority: "polite" | "assertive" = "polite"): void {
    this.announcements.push({
      text,
      priority,
      timestamp: Date.now(),
    });
  }

  /**
   * Get and clear pending announcements.
   */
  getAnnouncements(): Announcement[] {
    const pending = [...this.announcements];
    this.announcements = [];
    return pending;
  }
}

/**
 * CognitiveAssistant reduces cognitive load by simplifying commands
 * and providing progressive disclosure.
 */
export class CognitiveAssistant {
  /**
   * Score the complexity of a command (0 = simple, 10 = very complex).
   */
  scoreComplexity(command: string): number {
    let score = 0;
    const parts = command.split(/\s+/);

    // More args = more complex
    score += Math.min(3, (parts.length - 1) * 0.5);

    // Pipes add complexity
    score += (command.match(/\|/g) ?? []).length * 1.5;

    // Redirections add complexity
    score += (command.match(/[<>]/g) ?? []).length;

    // Subshells/command substitution
    score += (command.match(/\$\(/g) ?? []).length * 2;

    // Regex patterns
    score += (command.match(/[-]e\s+'.*'/g) ?? []).length * 1.5;

    // Long flags
    score += (command.match(/--\w+/g) ?? []).length * 0.3;

    return Math.min(10, Math.round(score * 10) / 10);
  }

  /**
   * Determine the complexity level of a command.
   */
  getLevel(command: string): ComplexityLevel {
    const score = this.scoreComplexity(command);
    if (score <= 2) return "simple";
    if (score <= 4) return "intermediate";
    if (score <= 7) return "advanced";
    return "expert";
  }

  /**
   * Simplify a complex command by breaking it into steps.
   */
  simplify(command: string): SimplifiedCommand {
    const levels: SimplifiedCommand["levels"] = [];

    // Handle && chained commands first
    const andParts = command.split(/\s*&&\s*/);
    if (andParts.length > 1) {
      levels.push({
        level: "simple",
        command: andParts[0],
        explanation: `Start with: ${andParts[0]}`,
      });

      if (andParts.length >= 2) {
        levels.push({
          level: "intermediate",
          command: `${andParts[0]} && ${andParts[1]}`,
          explanation: `Run ${andParts[0]}, then if it succeeds run ${andParts[1]}`,
        });
      }

      if (andParts.length >= 3) {
        levels.push({
          level: "advanced",
          command,
          explanation: `Full chain: ${andParts.join(" → ")}`,
        });
      }

      return { original: command, levels };
    }

    // Handle pipe-separated commands
    const parts = command.split(/\s*\|\s*/);
    if (parts.length > 1) {
      levels.push({
        level: "simple",
        command: parts[0],
        explanation: `Start with: ${parts[0]} (this gets the initial data)`,
      });

      // Intermediate: first pipe
      if (parts.length >= 2) {
        levels.push({
          level: "intermediate",
          command: `${parts[0]} | ${parts[1]}`,
          explanation: `${parts[0]} feeds into ${parts[1]}`,
        });
      }

      // Advanced: full command
      levels.push({
        level: "advanced",
        command,
        explanation: `Full pipeline: ${parts.join(" → ")}`,
      });
    } else {
      // Handle commands with many long flags — show progressive flag inclusion
      const flagMatches = command.match(/--\w[\w-]*/g) ?? [];
      const baseCommand = command.replace(/\s+--\w[\w-]*/g, "").trim();

      if (flagMatches.length >= 3) {
        levels.push({
          level: "simple",
          command: baseCommand,
          explanation: `Core command without options: ${baseCommand}`,
        });
        levels.push({
          level: "intermediate",
          command: `${baseCommand} ${flagMatches.slice(0, Math.ceil(flagMatches.length / 2)).join(" ")}`,
          explanation: `With key options: ${flagMatches.slice(0, Math.ceil(flagMatches.length / 2)).join(", ")}`,
        });
        levels.push({
          level: "advanced",
          command,
          explanation: `Full command with all ${flagMatches.length} options`,
        });
      } else {
        levels.push({
          level: "simple",
          command,
          explanation: command,
        });
      }
    }

    return { original: command, levels };
  }
}

/** A recognized voice command. */
export interface VoiceCommand {
  /** The transcribed text. */
  transcript: string;
  /** Confidence of the transcription (0-1). */
  confidence: number;
  /** Whether this is a final result or interim. */
  isFinal: boolean;
  /** Detected intent/command type. */
  intent?: VoiceIntent;
  /** Extracted parameters from the command. */
  parameters?: Record<string, string>;
  /** Timestamp of recognition. */
  timestamp: number;
}

/** Voice command intents. */
export type VoiceIntent =
  | "execute"      // Execute a command
  | "navigate"     // Navigate to a location
  | "search"       // Search for something
  | "create"       // Create a file/folder
  | "delete"       // Delete something
  | "copy"         // Copy something
  | "paste"        // Paste
  | "undo"         // Undo last action
  | "redo"         // Redo
  | "help"         // Get help
  | "stop"         // Stop/cancel current action
  | "confirm"      // Confirm/yes
  | "cancel"       // Cancel/no
  | "unknown";     // Unrecognized intent

/** Voice controller state. */
export type VoiceState = "idle" | "listening" | "processing" | "speaking" | "error";

/** Voice feedback message. */
export interface VoiceFeedback {
  /** Text to speak. */
  text: string;
  /** Priority of the message. */
  priority: "low" | "normal" | "high";
  /** Whether to interrupt current speech. */
  interrupt: boolean;
}

/** Intent patterns for voice command recognition. */
interface IntentPattern {
  intent: VoiceIntent;
  patterns: RegExp[];
  parameterExtractor?: (match: RegExpMatchArray) => Record<string, string>;
}

/** Default intent patterns for voice command recognition. */
const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: "execute",
    patterns: [
      /^(?:run|execute|do)\s+(.+)$/i,
      /^(?:please\s+)?(?:run|execute)\s+(.+)$/i,
    ],
    parameterExtractor: (match) => ({ command: match[1] }),
  },
  {
    intent: "navigate",
    patterns: [
      /^(?:go to|open|navigate to|cd)\s+(.+)$/i,
      /^(?:change directory to)\s+(.+)$/i,
    ],
    parameterExtractor: (match) => ({ path: match[1] }),
  },
  {
    intent: "search",
    patterns: [
      /^(?:search|find|look)\s+(?:for\s+)?(.+)$/i,
      /^(?:where is)\s+(.+)$/i,
    ],
    parameterExtractor: (match) => ({ query: match[1] }),
  },
  {
    intent: "create",
    patterns: [
      /^(?:create|make|new)\s+(?:a\s+)?(?:file|folder|directory)\s+(?:called\s+)?(.+)$/i,
      /^(?:touch|mkdir)\s+(.+)$/i,
    ],
    parameterExtractor: (match) => ({ name: match[1] }),
  },
  {
    intent: "delete",
    patterns: [
      /^(?:delete|remove|rm)\s+(.+)$/i,
      /^(?:get rid of)\s+(.+)$/i,
    ],
    parameterExtractor: (match) => ({ target: match[1] }),
  },
  {
    intent: "copy",
    patterns: [/^copy\s+(.+)$/i],
    parameterExtractor: (match) => ({ target: match[1] }),
  },
  {
    intent: "paste",
    patterns: [/^paste$/i],
  },
  {
    intent: "undo",
    patterns: [/^undo$/i, /^undo last(?:\s+action)?$/i],
  },
  {
    intent: "redo",
    patterns: [/^redo$/i, /^redo last(?:\s+action)?$/i],
  },
  {
    intent: "help",
    patterns: [
      /^help$/i,
      /^(?:what can you do|show help|commands)$/i,
      /^(?:how do I)\s+(.+)$/i,
    ],
    parameterExtractor: (match): Record<string, string> => (match[1] ? { topic: match[1] } : {}),
  },
  {
    intent: "stop",
    patterns: [/^stop$/i, /^cancel$/i, /^abort$/i, /^quit$/i],
  },
  {
    intent: "confirm",
    patterns: [/^(?:yes|yeah|yep|confirm|ok|okay|sure|do it)$/i],
  },
  {
    intent: "cancel",
    patterns: [/^(?:no|nope|cancel|never mind|forget it)$/i],
  },
];

/**
 * VoiceController provides voice control capabilities for hands-free
 * operation of OverCoat, including speech recognition and synthesis.
 */
export class VoiceController {
  private config: VoiceConfig;
  private state: VoiceState = "idle";
  private commandHandlers: Array<(cmd: VoiceCommand) => void> = [];
  private stateHandlers: Array<(state: VoiceState) => void> = [];
  private feedbackQueue: VoiceFeedback[] = [];
  private lastWakeWordTime: number = 0;
  private wakeWordCooldownMs: number = 1000;
  private commandHistory: VoiceCommand[] = [];
  private maxHistorySize: number = 100;

  constructor(config: Partial<VoiceConfig> = {}) {
    this.config = {
      enabled: false,
      wakeWord: "overcoat",
      language: "en-US",
      voiceFeedback: true,
      ...config,
    };
  }

  /** Get the current voice control configuration. */
  getConfig(): VoiceConfig {
    return { ...this.config };
  }

  /** Update voice control configuration. */
  setConfig(config: Partial<VoiceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Get the current state of the voice controller. */
  getState(): VoiceState {
    return this.state;
  }

  /** Check if voice control is enabled. */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /** Enable voice control. */
  enable(): void {
    this.config.enabled = true;
    this.setState("idle");
  }

  /** Disable voice control. */
  disable(): void {
    this.config.enabled = false;
    this.setState("idle");
  }

  /**
   * Process a speech recognition result.
   * This would typically be called by a speech recognition API.
   */
  processTranscript(transcript: string, confidence: number, isFinal: boolean): VoiceCommand {
    const command: VoiceCommand = {
      transcript,
      confidence,
      isFinal,
      intent: "unknown",
      parameters: {},
      timestamp: Date.now(),
    };

    // Detect wake word (escape regex metacharacters in the wake word)
    const escapedWakeWord = this.config.wakeWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wakeWordPattern = new RegExp(`^${escapedWakeWord}[,\\s]*`, "i");
    let processedTranscript = transcript;

    if (wakeWordPattern.test(transcript)) {
      // Remove wake word from transcript
      processedTranscript = transcript.replace(wakeWordPattern, "").trim();
      this.lastWakeWordTime = Date.now();
    } else if (Date.now() - this.lastWakeWordTime > this.wakeWordCooldownMs * 5) {
      // No wake word and cooldown expired, ignore
      command.intent = undefined;
      return command;
    }

    // Parse intent from the processed transcript
    if (isFinal && processedTranscript) {
      const parsed = this.parseIntent(processedTranscript);
      command.intent = parsed.intent;
      command.parameters = parsed.parameters;
    }

    // Store in history if final
    if (isFinal) {
      this.commandHistory.push(command);
      if (this.commandHistory.length > this.maxHistorySize) {
        this.commandHistory.shift();
      }

      // Notify handlers
      this.commandHandlers.forEach((h) => h(command));
    }

    return command;
  }

  /**
   * Parse the intent from a transcript.
   */
  parseIntent(transcript: string): { intent: VoiceIntent; parameters: Record<string, string> } {
    const normalizedTranscript = transcript.trim();

    for (const { intent, patterns, parameterExtractor } of INTENT_PATTERNS) {
      for (const pattern of patterns) {
        const match = normalizedTranscript.match(pattern);
        if (match) {
          return {
            intent,
            parameters: parameterExtractor ? parameterExtractor(match) : {},
          };
        }
      }
    }

    return { intent: "unknown", parameters: { raw: normalizedTranscript } };
  }

  /**
   * Queue voice feedback to be spoken.
   */
  queueFeedback(
    text: string,
    priority: VoiceFeedback["priority"] = "normal",
    interrupt: boolean = false
  ): void {
    if (!this.config.voiceFeedback) return;

    const feedback: VoiceFeedback = { text, priority, interrupt };

    if (interrupt) {
      // Clear queue and add this feedback
      this.feedbackQueue = [feedback];
    } else if (priority === "high") {
      // Add to front of queue
      this.feedbackQueue.unshift(feedback);
    } else {
      // Add to end of queue
      this.feedbackQueue.push(feedback);
    }
  }

  /**
   * Get the next feedback message to speak.
   */
  getNextFeedback(): VoiceFeedback | null {
    return this.feedbackQueue.shift() ?? null;
  }

  /**
   * Generate a confirmation response for an intent.
   */
  generateConfirmation(command: VoiceCommand): string {
    switch (command.intent) {
      case "execute":
        return `Running: ${command.parameters?.command ?? "command"}`;
      case "navigate":
        return `Navigating to ${command.parameters?.path ?? "location"}`;
      case "search":
        return `Searching for ${command.parameters?.query ?? "item"}`;
      case "create":
        return `Creating ${command.parameters?.name ?? "item"}`;
      case "delete":
        return `Deleting ${command.parameters?.target ?? "item"}`;
      case "copy":
        return "Copied";
      case "paste":
        return "Pasted";
      case "undo":
        return "Undoing last action";
      case "redo":
        return "Redoing last action";
      case "help":
        return "Here are the available voice commands";
      case "stop":
        return "Stopping";
      case "confirm":
        return "Confirmed";
      case "cancel":
        return "Cancelled";
      default:
        return `I heard: ${command.transcript}. Could you rephrase that?`;
    }
  }

  /**
   * Get the list of available voice commands for help.
   */
  getAvailableCommands(): Array<{ intent: VoiceIntent; examples: string[] }> {
    return [
      { intent: "execute", examples: ["run npm test", "execute build", "do git status"] },
      { intent: "navigate", examples: ["go to src folder", "open documents", "cd projects"] },
      { intent: "search", examples: ["search for config files", "find main.ts", "look for tests"] },
      { intent: "create", examples: ["create file hello.txt", "make new folder", "new directory src"] },
      { intent: "delete", examples: ["delete temp files", "remove node_modules"] },
      { intent: "copy", examples: ["copy selection"] },
      { intent: "paste", examples: ["paste"] },
      { intent: "undo", examples: ["undo", "undo last action"] },
      { intent: "redo", examples: ["redo", "redo last action"] },
      { intent: "help", examples: ["help", "what can you do", "how do I create a file"] },
      { intent: "stop", examples: ["stop", "cancel", "abort"] },
      { intent: "confirm", examples: ["yes", "confirm", "do it"] },
      { intent: "cancel", examples: ["no", "cancel", "never mind"] },
    ];
  }

  /**
   * Register a handler for recognized voice commands.
   */
  onCommand(handler: (cmd: VoiceCommand) => void): void {
    this.commandHandlers.push(handler);
  }

  /**
   * Register a handler for state changes.
   */
  onStateChange(handler: (state: VoiceState) => void): void {
    this.stateHandlers.push(handler);
  }

  /**
   * Get command history.
   */
  getHistory(): VoiceCommand[] {
    return [...this.commandHistory];
  }

  /**
   * Clear command history.
   */
  clearHistory(): void {
    this.commandHistory = [];
  }

  /**
   * Start listening (set state to listening).
   */
  startListening(): void {
    if (this.config.enabled) {
      this.setState("listening");
    }
  }

  /**
   * Stop listening (set state to idle).
   */
  stopListening(): void {
    this.setState("idle");
  }

  private setState(state: VoiceState): void {
    if (this.state !== state) {
      this.state = state;
      this.stateHandlers.forEach((h) => h(state));
    }
  }
}
