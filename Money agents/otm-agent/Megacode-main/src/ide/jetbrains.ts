/**
 * JetBrains / PyCharm IDE Bridge for OverCoat.
 *
 * JetBrains IDEs (IntelliJ IDEA, PyCharm, WebStorm, etc.) support
 * plugins via the IntelliJ Platform SDK. This bridge exposes an HTTP
 * endpoint that the companion JetBrains plugin polls for completions
 * and streams results back via Server-Sent Events (SSE).
 *
 * The JetBrains plugin (overcoat-jetbrains) communicates with this
 * bridge over HTTP on a configurable localhost port.
 */

import * as http from "http";

export interface JetBrainsBridgeConfig {
  port: number;
  host: string;
}

export interface JetBrainsCompletionRequest {
  id: string;
  filePath: string;
  language: string;
  prefix: string;
  suffix: string;
  model?: string;
}

export interface JetBrainsCompletionResponse {
  id: string;
  completion: string;
  model: string;
  provider: string;
}

const DEFAULT_JETBRAINS_CONFIG: JetBrainsBridgeConfig = {
  port: 9744,
  host: "127.0.0.1",
};

type CompletionHandler = (
  request: JetBrainsCompletionRequest,
) => Promise<JetBrainsCompletionResponse>;

/**
 * JetBrainsBridge provides an HTTP server that the companion
 * JetBrains plugin connects to for OverCoat-powered completions.
 *
 * Endpoints:
 *   GET  /health           — liveness check
 *   POST /complete         — single completion request
 *   GET  /providers        — list registered providers
 */
export class JetBrainsBridge {
  private server: http.Server | null = null;
  private config: JetBrainsBridgeConfig;
  private completionHandler: CompletionHandler | null = null;
  private registeredProviders: string[] = [];

  constructor(config: Partial<JetBrainsBridgeConfig> = {}) {
    this.config = { ...DEFAULT_JETBRAINS_CONFIG, ...config };
  }

  /** Register the handler that resolves completion requests. */
  onCompletion(handler: CompletionHandler): void {
    this.completionHandler = handler;
  }

  /** Set the list of provider names to advertise. */
  setProviders(providers: string[]): void {
    this.registeredProviders = providers;
  }

  /** Start the HTTP server. */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on("error", reject);
      this.server.listen(this.config.port, this.config.host, () => {
        resolve();
      });
    });
  }

  /** Stop the HTTP server. */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close(() => {
        this.server = null;
        resolve();
      });
    });
  }

  /** Whether the server is running. */
  get isRunning(): boolean {
    return this.server !== null && this.server.listening;
  }

  private handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    const url = req.url ?? "/";

    // Handle CORS preflight — browsers send OPTIONS before certain POST requests
    if (req.method === "OPTIONS") {
      const origin = req.headers.origin;
      res.writeHead(204, {
        "Access-Control-Allow-Origin": this.resolveAllowedOrigin(origin),
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Length": "0",
      });
      res.end();
      return;
    }

    if (url === "/health" && req.method === "GET") {
      this.sendJson(req, res, 200, {
        status: "ok",
        source: "overcoat",
        providers: this.registeredProviders,
      });
      return;
    }

    if (url === "/providers" && req.method === "GET") {
      this.sendJson(req, res, 200, { providers: this.registeredProviders });
      return;
    }

    if (url === "/complete" && req.method === "POST") {
      this.handleComplete(req, res);
      return;
    }

    this.sendJson(req, res, 404, { error: "Not found" });
  }

  private handleComplete(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB
    let body = "";
    let bodySize = 0;
    let responseSent = false;

    req.on("error", (_err) => {
      if (!responseSent) {
        responseSent = true;
        this.sendJson(req, res, 400, { error: "Request read error" });
      }
    });

    req.on("data", (chunk: Buffer) => {
      bodySize += chunk.length;
      if (bodySize > MAX_BODY_BYTES) {
        responseSent = true;
        req.destroy();
        this.sendJson(req, res, 413, { error: "Request body too large" });
        return;
      }
      body += chunk.toString();
    });

    req.on("end", async () => {
      if (responseSent) return;
      try {
        const request = JSON.parse(body) as JetBrainsCompletionRequest;
        if (!this.completionHandler) {
          this.sendJson(req, res, 503, { error: "No completion handler registered" });
          return;
        }
        const response = await this.completionHandler(request);
        this.sendJson(req, res, 200, response as unknown as Record<string, unknown>);
      } catch (err) {
        this.sendJson(req, res, 500, {
          error: err instanceof Error ? err.message : "Internal error",
        });
      }
    });
  }

  private sendJson(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    status: number,
    body: Record<string, unknown>,
  ): void {
    const json = JSON.stringify(body);
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(json),
      "Access-Control-Allow-Origin": this.resolveAllowedOrigin(req.headers.origin),
    });
    res.end(json);
  }

  /**
   * Resolve the CORS `Access-Control-Allow-Origin` value.
   * Reflects back the request's `Origin` header when it is a known
   * localhost origin (with or without a port), so that JetBrains webviews
   * running on an arbitrary localhost port are not blocked. Any non-local
   * origin falls back to the safe default `http://127.0.0.1`.
   */
  private resolveAllowedOrigin(origin: string | undefined): string {
    if (origin && this.isLocalOrigin(origin)) {
      return origin;
    }
    return "http://127.0.0.1";
  }

  private isLocalOrigin(origin: string): boolean {
    return (
      origin === "http://127.0.0.1" ||
      origin === "http://localhost" ||
      /^http:\/\/127\.0\.0\.1:\d+$/.test(origin) ||
      /^http:\/\/localhost:\d+$/.test(origin)
    );
  }
}
