/**
 * SlashCommandRegistry + ChannelHistory + MultiModelCompare + AIResponsePanel + RealtimeCollabToken
 * Items #16, #17, #18, #19, #20 (Zed IDE features)
 *
 * SlashCommandRegistry (#16): Register, parse, and dispatch /slash commands
 *   in the chat interface (mirrors Zed's /file, /diagnostics, /terminal, etc.)
 *
 * ChannelHistory (#17): Persistent, searchable history of all messages in a
 *   channel/conversation — mirrors Zed's channel messaging system.
 *
 * MultiModelCompare (#18) + AIResponsePanel (#20): Run the same prompt against
 *   multiple models simultaneously and surface the responses in a structured
 *   side-by-side panel, so the user can pick the best answer.
 *
 * RealtimeCollabToken (#19) + SessionQRCode (#35): Generate and verify
 *   short-lived collaboration tokens (JWT-like HMAC tokens) that allow
 *   external collaborators to join a session, plus QR code encoding.
 */

import { createHash, createHmac, randomBytes } from "crypto";

// ============================================================================
// SlashCommandRegistry (Item #16)
// ============================================================================

/** A slash command handler. */
export interface SlashCommand {
  /** Command name without the leading slash. */
  name: string;
  /** Short description shown in autocomplete. */
  description: string;
  /** Optional list of sub-commands or argument hints. */
  usage?: string;
  /** Whether the command requires an argument. */
  requiresArg?: boolean;
  /** Execute the command. Returns a string to display to the user. */
  execute: (arg: string, context: SlashCommandContext) => Promise<string> | string;
}

/** Contextual information passed to every slash command handler. */
export interface SlashCommandContext {
  /** The raw input line (including the slash). */
  rawInput: string;
  /** The current working directory. */
  cwd: string;
  /** Arbitrary metadata the host can inject. */
  meta: Record<string, unknown>;
}

/** Result of parsing a slash command from a line of text. */
export interface SlashParseResult {
  /** Whether a slash command was detected. */
  isSlash: boolean;
  /** Command name (without slash), empty string if not a command. */
  command: string;
  /** Argument (everything after the command name, trimmed). */
  arg: string;
}

/**
 * SlashCommandRegistry: Register /slash commands and dispatch them from
 * chat input.
 *
 * Usage:
 *   const reg = new SlashCommandRegistry();
 *   reg.register({ name: "file", description: "Open a file", execute: (arg) => `Opening: ${arg}` });
 *   const parsed = reg.parse("/file src/index.ts");
 *   const result = await reg.dispatch(parsed, context);
 */
export class SlashCommandRegistry {
  private commands: Map<string, SlashCommand> = new Map();

  /** Register a new slash command. */
  register(cmd: SlashCommand): void {
    this.commands.set(cmd.name.toLowerCase(), cmd);
  }

  /** Unregister a command by name. */
  unregister(name: string): boolean {
    return this.commands.delete(name.toLowerCase());
  }

  /** Parse a line of text into a slash parse result. */
  parse(input: string): SlashParseResult {
    const trimmed = input.trimStart();
    if (!trimmed.startsWith("/")) {
      return { isSlash: false, command: "", arg: "" };
    }
    const [rawCmd, ...rest] = trimmed.slice(1).split(/\s+/);
    return {
      isSlash: true,
      command: rawCmd?.toLowerCase() ?? "",
      arg: rest.join(" "),
    };
  }

  /**
   * Dispatch a parsed slash command.
   *
   * @returns The handler's output string, or an error string if the command
   *          is not registered or validation fails.
   */
  async dispatch(
    parsed: SlashParseResult,
    context: Partial<SlashCommandContext> = {}
  ): Promise<string> {
    if (!parsed.isSlash) return "";
    const cmd = this.commands.get(parsed.command);
    if (!cmd) {
      const available = this.listNames().join(", ");
      return `Unknown command: /${parsed.command}. Available: ${available}`;
    }
    if (cmd.requiresArg && !parsed.arg) {
      return `/${cmd.name} requires an argument. Usage: ${cmd.usage ?? `/${cmd.name} <arg>`}`;
    }
    const ctx: SlashCommandContext = {
      rawInput: parsed.command + (parsed.arg ? " " + parsed.arg : ""),
      cwd: context.cwd ?? process.cwd(),
      meta: context.meta ?? {},
    };
    try {
      return await cmd.execute(parsed.arg, ctx);
    } catch (err) {
      return `Error in /${cmd.name}: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  /**
   * Convenience: parse + dispatch in one call.
   */
  async run(input: string, context: Partial<SlashCommandContext> = {}): Promise<string | null> {
    const parsed = this.parse(input);
    if (!parsed.isSlash) return null;
    return this.dispatch(parsed, context);
  }

  /** List all registered command names. */
  listNames(): string[] {
    return Array.from(this.commands.keys()).sort();
  }

  /** List all registered commands (for autocomplete). */
  listCommands(): SlashCommand[] {
    return Array.from(this.commands.values());
  }

  /** Get a single command by name. */
  get(name: string): SlashCommand | undefined {
    return this.commands.get(name.toLowerCase());
  }

  /**
   * Autocomplete suggestions for a partial input.
   *
   * @param partial  Text typed so far (e.g. "/fi")
   */
  autocomplete(partial: string): SlashCommand[] {
    if (!partial.startsWith("/")) return [];
    const prefix = partial.slice(1).toLowerCase();
    return this.listCommands().filter((c) => c.name.startsWith(prefix));
  }
}

// ============================================================================
// ChannelHistory (Item #17)
// ============================================================================

/** A single message in a channel. */
export interface ChannelMessage {
  /** Unique message ID. */
  id: string;
  /** Author identifier (user/agent name). */
  author: string;
  /** Message content (may be markdown). */
  content: string;
  /** Timestamp (ms). */
  timestamp: number;
  /** Optional reply-to message ID. */
  replyTo?: string;
  /** Whether this was generated by an AI agent. */
  isAI: boolean;
  /** Optional metadata. */
  meta?: Record<string, unknown>;
}

/** Search/filter options for channel history. */
export interface ChannelHistoryFilter {
  /** Text to search in content or author. */
  query?: string;
  /** Filter by author. */
  author?: string;
  /** Only AI messages. */
  aiOnly?: boolean;
  /** Only human messages. */
  humanOnly?: boolean;
  /** Start of time range (ms). */
  after?: number;
  /** End of time range (ms). */
  before?: number;
  /** Maximum results to return. */
  limit?: number;
}

/**
 * ChannelHistory: A searchable, ordered message log.
 *
 * Usage:
 *   const hist = new ChannelHistory("main");
 *   hist.add("user", "Can you explain closures?");
 *   hist.add("claude", "A closure is...", { isAI: true });
 *   const search = hist.search({ query: "closure" });
 */
export class ChannelHistory {
  private channelId: string;
  private messages: ChannelMessage[] = [];
  private maxMessages: number;

  constructor(channelId: string, maxMessages = 10000) {
    this.channelId = channelId;
    this.maxMessages = maxMessages;
  }

  /** Channel ID this history belongs to. */
  get id(): string {
    return this.channelId;
  }

  /** Add a message to the channel. */
  add(
    author: string,
    content: string,
    opts: { isAI?: boolean; replyTo?: string; meta?: Record<string, unknown> } = {}
  ): ChannelMessage {
    const msg: ChannelMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      author,
      content,
      timestamp: Date.now(),
      isAI: opts.isAI ?? false,
      replyTo: opts.replyTo,
      meta: opts.meta,
    };

    this.messages.push(msg);
    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }

    return msg;
  }

  /** Get the N most recent messages. */
  recent(n = 50): ChannelMessage[] {
    return this.messages.slice(-n);
  }

  /** Get a message by ID. */
  getById(id: string): ChannelMessage | undefined {
    return this.messages.find((m) => m.id === id);
  }

  /** Search / filter messages. */
  search(filter: ChannelHistoryFilter = {}): ChannelMessage[] {
    let msgs = [...this.messages];

    if (filter.query) {
      const q = filter.query.toLowerCase();
      msgs = msgs.filter(
        (m) =>
          m.content.toLowerCase().includes(q) ||
          m.author.toLowerCase().includes(q)
      );
    }
    if (filter.author) {
      msgs = msgs.filter((m) => m.author === filter.author);
    }
    if (filter.aiOnly) msgs = msgs.filter((m) => m.isAI);
    if (filter.humanOnly) msgs = msgs.filter((m) => !m.isAI);
    if (filter.after) msgs = msgs.filter((m) => m.timestamp > filter.after!);
    if (filter.before) msgs = msgs.filter((m) => m.timestamp < filter.before!);

    if (filter.limit) msgs = msgs.slice(-filter.limit);
    return msgs;
  }

  /** Total number of messages in history. */
  get size(): number {
    return this.messages.length;
  }

  /** Export history as JSON string. */
  export(): string {
    return JSON.stringify({ channelId: this.channelId, messages: this.messages }, null, 2);
  }

  /** Import history from a JSON string. */
  import(json: string): void {
    const data = JSON.parse(json);
    if (Array.isArray(data.messages)) {
      this.messages = data.messages as ChannelMessage[];
    }
  }

  /** Clear all messages. */
  clear(): void {
    this.messages = [];
  }
}

// ============================================================================
// MultiModelCompare + AIResponsePanel (Items #18 & #20)
// ============================================================================

/** A single model's response in a multi-model comparison. */
export interface ModelResponse {
  /** Model identifier (e.g. "claude-3-5-sonnet", "gpt-4o"). */
  model: string;
  /** The response text. */
  content: string;
  /** Time taken to generate the response (ms). */
  durationMs: number;
  /** Estimated token usage (if available). */
  tokens?: { prompt: number; completion: number; total: number };
  /** Whether the call succeeded. */
  success: boolean;
  /** Error message (if failed). */
  error?: string;
}

/** Comparison result from running multiple models. */
export interface ComparisonResult {
  /** The prompt that was sent. */
  prompt: string;
  /** Timestamp of the comparison. */
  timestamp: number;
  /** Responses from each model. */
  responses: ModelResponse[];
  /** The model with the fastest response. */
  fastestModel: string | null;
  /** The model with the most tokens (proxy for verbosity). */
  mostVerboseModel: string | null;
}

/** A model call function (maps model name → response text). */
export type ModelCaller = (model: string, prompt: string) => Promise<{ content: string; tokens?: ModelResponse["tokens"] }>;

/**
 * MultiModelCompare: Run the same prompt against multiple models and
 * compare responses.
 *
 * Usage:
 *   const cmp = new MultiModelCompare(myModelCaller);
 *   const result = await cmp.compare("Explain async/await", ["gpt-4o", "claude-3-5-sonnet"]);
 *   const panel = AIResponsePanel.render(result);
 *   console.log(panel);
 */
export class MultiModelCompare {
  private caller: ModelCaller;

  constructor(caller: ModelCaller) {
    this.caller = caller;
  }

  /**
   * Run a prompt against multiple models in parallel.
   */
  async compare(prompt: string, models: string[]): Promise<ComparisonResult> {
    const responses = await Promise.all(
      models.map(async (model): Promise<ModelResponse> => {
        const t0 = Date.now();
        try {
          const result = await this.caller(model, prompt);
          return {
            model,
            content: result.content,
            durationMs: Date.now() - t0,
            tokens: result.tokens,
            success: true,
          };
        } catch (err) {
          return {
            model,
            content: "",
            durationMs: Date.now() - t0,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      })
    );

    const successful = responses.filter((r) => r.success);
    const fastestModel =
      successful.length > 0
        ? successful.reduce((a, b) => (a.durationMs < b.durationMs ? a : b)).model
        : null;

    const mostVerboseModel =
      successful.filter((r) => r.tokens).length > 0
        ? successful
            .filter((r) => r.tokens)
            .reduce((a, b) => ((a.tokens?.completion ?? 0) >= (b.tokens?.completion ?? 0) ? a : b))
            .model
        : null;

    return { prompt, timestamp: Date.now(), responses, fastestModel, mostVerboseModel };
  }
}

/**
 * AIResponsePanel (Item #20): Renders a ComparisonResult as a formatted
 * terminal panel, similar to Zed's AI response panel.
 */
export class AIResponsePanel {
  /**
   * Render a comparison result as a formatted string for terminal display.
   */
  static render(result: ComparisonResult, maxWidth = 100): string {
    const lines: string[] = [];
    const bar = "═".repeat(Math.min(maxWidth, 80));

    lines.push(bar);
    lines.push(`PROMPT: ${result.prompt.slice(0, 120)}${result.prompt.length > 120 ? "…" : ""}`);
    lines.push(bar);

    for (const r of result.responses) {
      const header = `▶ ${r.model}  (${r.durationMs}ms${r.tokens ? ` · ${r.tokens.completion} tokens` : ""})`;
      lines.push(header);

      if (!r.success) {
        lines.push(`  ERROR: ${r.error}`);
      } else {
        const bodyLines = r.content.split("\n").slice(0, 20);
        for (const l of bodyLines) lines.push(`  ${l}`);
        if (r.content.split("\n").length > 20) {
          lines.push(`  … (${r.content.split("\n").length - 20} more lines)`);
        }
      }

      const badges: string[] = [];
      if (r.model === result.fastestModel) badges.push("⚡ fastest");
      if (r.model === result.mostVerboseModel) badges.push("📝 most verbose");
      if (badges.length) lines.push(`  [${badges.join(" · ")}]`);
      lines.push("");
    }

    lines.push(bar);
    return lines.join("\n");
  }

  /**
   * Render as a compact summary table.
   */
  static renderSummary(result: ComparisonResult): string {
    const rows: string[] = ["Model                     Duration   Tokens  Status"];
    rows.push("─".repeat(56));
    for (const r of result.responses) {
      const model = r.model.padEnd(26);
      const dur = `${r.durationMs}ms`.padEnd(11);
      const tok = (r.tokens?.completion?.toString() ?? "—").padEnd(8);
      const status = r.success ? "✓" : "✗ " + (r.error ?? "").slice(0, 20);
      rows.push(`${model}${dur}${tok}${status}`);
    }
    return rows.join("\n");
  }
}

// ============================================================================
// RealtimeCollabToken (Item #19) + SessionQRCode (Item #35)
// ============================================================================

/** A collaboration token payload. */
export interface CollabTokenPayload {
  /** Session ID this token is tied to. */
  sessionId: string;
  /** Role granted to the token holder. */
  role: "viewer" | "editor" | "admin";
  /** Creator user ID. */
  createdBy: string;
  /** Expiry timestamp (ms). */
  expiresAt: number;
  /** Token issued-at timestamp (ms). */
  issuedAt: number;
}

/** A signed collaboration token. */
export interface CollabToken {
  /** The signed token string (base64url). */
  token: string;
  /** Decoded payload. */
  payload: CollabTokenPayload;
  /** Collaboration URL (if baseUrl provided). */
  joinUrl?: string;
}

/**
 * RealtimeCollabToken: Generates and verifies HMAC-signed collaboration
 * tokens for joining a live session.
 *
 * Usage:
 *   const ct = new RealtimeCollabToken("my-secret");
 *   const tok = ct.issue("session-123", "editor", "alice", 3600);
 *   const valid = ct.verify(tok.token);
 */
export class RealtimeCollabToken {
  private secret: string;

  /** @param secret HMAC secret. Keep this server-side. */
  constructor(secret?: string) {
    this.secret = secret ?? randomBytes(32).toString("hex");
  }

  /**
   * Issue a new collaboration token.
   *
   * @param sessionId  ID of the session to join.
   * @param role       Permission level.
   * @param createdBy  User who created the token.
   * @param ttlSeconds Time-to-live in seconds (default 1 hour).
   * @param baseUrl    Optional base URL for constructing the join link.
   */
  issue(
    sessionId: string,
    role: CollabTokenPayload["role"],
    createdBy: string,
    ttlSeconds = 3600,
    baseUrl?: string
  ): CollabToken {
    const now = Date.now();
    const payload: CollabTokenPayload = {
      sessionId,
      role,
      createdBy,
      issuedAt: now,
      expiresAt: now + ttlSeconds * 1000,
    };

    const token = this._sign(payload);
    const joinUrl = baseUrl
      ? `${baseUrl.replace(/\/$/, "")}/join?token=${token}`
      : undefined;

    return { token, payload, joinUrl };
  }

  /**
   * Verify a token and return its payload if valid.
   * Returns null if expired, tampered, or malformed.
   */
  verify(token: string): CollabTokenPayload | null {
    try {
      const [encodedPayload, sig] = token.split(".");
      if (!encodedPayload || !sig) return null;

      const expectedSig = this._hmac(encodedPayload);
      // Constant-time comparison via hash equality
      if (
        createHash("sha256").update(sig).digest("hex") !==
        createHash("sha256").update(expectedSig).digest("hex")
      ) {
        return null;
      }

      const payload = JSON.parse(
        Buffer.from(encodedPayload, "base64url").toString("utf8")
      ) as CollabTokenPayload;

      if (payload.expiresAt < Date.now()) return null;

      return payload;
    } catch {
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Private
  // --------------------------------------------------------------------------

  private _sign(payload: CollabTokenPayload): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = this._hmac(encoded);
    return `${encoded}.${sig}`;
  }

  private _hmac(data: string): string {
    return createHmac("sha256", this.secret).update(data).digest("base64url");
  }
}

// ============================================================================
// SessionQRCode (Item #35) — bundled here with collab token
// ============================================================================

/**
 * SessionQRCode: Encodes a join URL or session token as a simple ASCII QR
 * code placeholder, and provides a data URI for use in rich UIs.
 *
 * A real implementation would use a QR library; this ships a terminal-friendly
 * fallback that renders the URL in a box for copy-paste, plus integration hooks
 * for popular QR libraries.
 */
export class SessionQRCode {
  /**
   * Render a terminal-friendly representation of the URL.
   * Replace this with a real QR library call (e.g. `qrcode`) in production.
   */
  static renderAscii(url: string, label = "Scan or copy:"): string {
    const border = "┌" + "─".repeat(url.length + 4) + "┐";
    const bottom = "└" + "─".repeat(url.length + 4) + "┘";
    return [
      label,
      border,
      `│  ${url}  │`,
      bottom,
      "(Install npm package 'qrcode' for a real QR image)",
    ].join("\n");
  }

  /**
   * Encode using the qrcode npm package if it's available at runtime.
   * Falls back to ASCII rendering if the package is not installed.
   */
  static async renderDataUri(url: string): Promise<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore — qrcode is an optional peer dependency
      const qrcode = await import("qrcode");
      return await (qrcode as unknown as { toDataURL: (url: string) => Promise<string> }).toDataURL(url);
    } catch {
      // qrcode not installed — return a data URI wrapping the ASCII render
      const ascii = this.renderAscii(url);
      return "data:text/plain;charset=utf-8," + encodeURIComponent(ascii);
    }
  }

  /**
   * Build a collab join QR from a RealtimeCollabToken issue result.
   */
  static fromCollabToken(token: CollabToken): string {
    const url = token.joinUrl ?? `megacode://join?token=${token.token}`;
    return this.renderAscii(url, `Join session (${token.payload.role}):`);
  }
}
