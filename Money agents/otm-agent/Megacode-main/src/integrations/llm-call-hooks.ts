/**
 * LLMCallHooks — Item #23 (Claude Code skill)
 *
 * A lightweight before/after hook registry that wraps any LLM call pipeline.
 * Each hook receives the request (before) or the request+response (after)
 * and can mutate, log, or short-circuit the call.
 *
 * Mirrors the hook pattern used in Claude Code's tool call interception and
 * OpenCode's middleware layer.
 */

import { EventEmitter } from "events";

// ============================================================================
// Types
// ============================================================================

/** Minimal LLM message shape (compatible with all providers). */
export interface HookMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** The request object passed through hooks. */
export interface HookRequest {
  /** Model name / identifier. */
  model: string;
  /** Messages in the conversation. */
  messages: HookMessage[];
  /** Provider-specific options. */
  options: Record<string, unknown>;
  /** Arbitrary context bag — hooks can store data here for later hooks. */
  ctx: Record<string, unknown>;
}

/** The response object passed through after-hooks. */
export interface HookResponse {
  /** The generated content. */
  content: string;
  /** Model that generated the response. */
  model: string;
  /** Token usage stats (if available). */
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  /** Duration in ms. */
  durationMs: number;
  /** Original request (for reference). */
  request: HookRequest;
}

/** Return value from a before-hook. */
export type BeforeHookResult =
  | { action: "continue" }               // proceed normally
  | { action: "mutate"; request: HookRequest }  // replace request
  | { action: "short-circuit"; response: HookResponse }; // skip LLM call

/** A before-hook: runs before the LLM call. */
export type BeforeHook = (request: HookRequest) => BeforeHookResult | Promise<BeforeHookResult>;

/** An after-hook: runs after the LLM call. Can mutate the response. */
export type AfterHook = (
  response: HookResponse
) => HookResponse | Promise<HookResponse>;

/** An error-hook: runs when the LLM call throws. */
export type ErrorHook = (
  error: Error,
  request: HookRequest
) => void | Promise<void>;

/** Registration entry for a hook. */
export interface HookRegistration {
  id: string;
  name: string;
  priority: number;  // Lower number = runs first
}

// ============================================================================
// LLMCallHooks (Item #23)
// ============================================================================

/**
 * LLMCallHooks: A composable hook registry for wrapping LLM calls.
 *
 * Usage:
 *   const hooks = new LLMCallHooks();
 *   hooks.before("log-request", (req) => {
 *     console.log("Calling", req.model);
 *     return { action: "continue" };
 *   });
 *   hooks.after("log-response", (res) => {
 *     console.log("Response in", res.durationMs, "ms");
 *     return res;
 *   });
 *
 *   // Wrap your LLM call:
 *   const response = await hooks.runWithHooks(request, () => myProvider.complete(req));
 */
export class LLMCallHooks extends EventEmitter {
  private beforeHooks: Array<{ reg: HookRegistration; fn: BeforeHook }> = [];
  private afterHooks: Array<{ reg: HookRegistration; fn: AfterHook }> = [];
  private errorHooks: Array<{ reg: HookRegistration; fn: ErrorHook }> = [];
  private nextId = 1;

  // --------------------------------------------------------------------------
  // Registration
  // --------------------------------------------------------------------------

  /**
   * Register a before-hook (runs before the LLM call, in priority order).
   *
   * @param name      Human-readable hook name.
   * @param fn        Hook function.
   * @param priority  Lower number = runs first. Default: 100.
   * @returns Registration ID (for removal).
   */
  before(name: string, fn: BeforeHook, priority = 100): string {
    const id = `before-${this.nextId++}`;
    this.beforeHooks.push({ reg: { id, name, priority }, fn });
    this.beforeHooks.sort((a, b) => a.reg.priority - b.reg.priority);
    return id;
  }

  /**
   * Register an after-hook (runs after the LLM call, in priority order).
   */
  after(name: string, fn: AfterHook, priority = 100): string {
    const id = `after-${this.nextId++}`;
    this.afterHooks.push({ reg: { id, name, priority }, fn });
    this.afterHooks.sort((a, b) => a.reg.priority - b.reg.priority);
    return id;
  }

  /**
   * Register an error-hook (runs when the LLM call throws).
   */
  onError(name: string, fn: ErrorHook, priority = 100): string {
    const id = `error-${this.nextId++}`;
    this.errorHooks.push({ reg: { id, name, priority }, fn });
    this.errorHooks.sort((a, b) => a.reg.priority - b.reg.priority);
    return id;
  }

  /**
   * Remove any hook by its registration ID.
   */
  remove(hookId: string): boolean {
    const totalBefore = this.beforeHooks.length + this.afterHooks.length + this.errorHooks.length;
    this.beforeHooks = this.beforeHooks.filter((h) => h.reg.id !== hookId);
    this.afterHooks = this.afterHooks.filter((h) => h.reg.id !== hookId);
    this.errorHooks = this.errorHooks.filter((h) => h.reg.id !== hookId);
    const totalAfter = this.beforeHooks.length + this.afterHooks.length + this.errorHooks.length;
    return totalAfter < totalBefore;
  }

  /** Remove all registered hooks. */
  removeAll(): void {
    this.beforeHooks = [];
    this.afterHooks = [];
    this.errorHooks = [];
  }

  // --------------------------------------------------------------------------
  // Execution
  // --------------------------------------------------------------------------

  /**
   * Run an LLM call wrapped in all registered hooks.
   *
   * @param request The initial request.
   * @param callFn  The actual LLM call (receives the (possibly mutated) request).
   */
  async runWithHooks(
    request: HookRequest,
    callFn: (req: HookRequest) => Promise<Omit<HookResponse, "request" | "durationMs">>
  ): Promise<HookResponse> {
    let req = { ...request };

    // --- Before hooks ---
    for (const { fn } of this.beforeHooks) {
      const result = await fn(req);
      if (result.action === "mutate") {
        req = result.request;
      } else if (result.action === "short-circuit") {
        this.emit("short-circuit", result.response);
        return this._runAfterHooks(result.response);
      }
      // "continue" → proceed
    }

    // --- LLM call ---
    const t0 = Date.now();
    let rawResponse: Omit<HookResponse, "request" | "durationMs">;

    try {
      rawResponse = await callFn(req);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      for (const { fn } of this.errorHooks) {
        await fn(error, req);
      }
      this.emit("call-error", error, req);
      throw error;
    }

    let response: HookResponse = {
      ...rawResponse,
      durationMs: Date.now() - t0,
      request: req,
    };

    this.emit("call-complete", response);

    // --- After hooks ---
    return this._runAfterHooks(response);
  }

  // --------------------------------------------------------------------------
  // Introspection
  // --------------------------------------------------------------------------

  /** List all registered hooks. */
  listHooks(): { before: HookRegistration[]; after: HookRegistration[]; error: HookRegistration[] } {
    return {
      before: this.beforeHooks.map((h) => h.reg),
      after: this.afterHooks.map((h) => h.reg),
      error: this.errorHooks.map((h) => h.reg),
    };
  }

  // --------------------------------------------------------------------------
  // Built-in convenience hooks
  // --------------------------------------------------------------------------

  /**
   * Install a logging hook that prints request/response summaries.
   */
  installLoggingHook(
    log: (msg: string) => void = console.log
  ): { beforeId: string; afterId: string } {
    const beforeId = this.before(
      "logging-before",
      (req) => {
        log(`[LLMCallHooks] → ${req.model} | ${req.messages.length} messages`);
        return { action: "continue" };
      },
      1
    );
    const afterId = this.after(
      "logging-after",
      (res) => {
        log(`[LLMCallHooks] ← ${res.model} | ${res.durationMs}ms | ${res.usage?.totalTokens ?? "?"} tokens`);
        return res;
      },
      1
    );
    return { beforeId, afterId };
  }

  /**
   * Install a hook that injects a system message into every request.
   */
  installSystemInjector(systemContent: string): string {
    return this.before(
      "system-injector",
      (req) => {
        const hasSystem = req.messages.some((m) => m.role === "system");
        if (!hasSystem) {
          return {
            action: "mutate",
            request: {
              ...req,
              messages: [{ role: "system", content: systemContent }, ...req.messages],
            },
          };
        }
        return { action: "continue" };
      },
      10
    );
  }

  // --------------------------------------------------------------------------
  // Private
  // --------------------------------------------------------------------------

  private async _runAfterHooks(response: HookResponse): Promise<HookResponse> {
    let res = response;
    for (const { fn } of this.afterHooks) {
      res = await fn(res);
    }
    return res;
  }
}
