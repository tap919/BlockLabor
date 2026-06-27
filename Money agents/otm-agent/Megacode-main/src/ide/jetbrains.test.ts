import * as http from "http";
import { JetBrainsBridge, JetBrainsCompletionRequest, JetBrainsCompletionResponse } from "./jetbrains";

const TEST_PORT = 19744;

function httpGet(path: string): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    http.get(
      {
        hostname: "127.0.0.1",
        port: TEST_PORT,
        path,
        headers: { Connection: "close" },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
        });
      },
    ).on("error", reject);
  });
}

function httpGetWithHeaders(path: string, origin?: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    http.get(
      {
        hostname: "127.0.0.1",
        port: TEST_PORT,
        path,
        headers: {
          Connection: "close",
          ...(origin !== undefined && { Origin: origin }),
        },
        // Disable connection pooling to avoid reusing stale keep-alive sockets
        // from earlier tests that didn't send Connection: close.
        agent: false,
      },
      (res) => {
        const resHeaders = res.headers;
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => {
          resolve({ status: res.statusCode ?? 0, headers: resHeaders, body: JSON.parse(data) });
        });
      },
    ).on("error", reject);
  });
}

function httpPost(
  path: string,
  payload: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: TEST_PORT,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Connection: "close",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
        });
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

describe("JetBrainsBridge", () => {
  let bridge: JetBrainsBridge;

  beforeEach(() => {
    bridge = new JetBrainsBridge({ port: TEST_PORT, host: "127.0.0.1" });
  });

  afterEach(async () => {
    await bridge.stop();
  });

  it("should start and stop the server", async () => {
    await bridge.start();
    expect(bridge.isRunning).toBe(true);

    await bridge.stop();
    expect(bridge.isRunning).toBe(false);
  });

  it("GET /health returns 200 with status ok", async () => {
    await bridge.start();
    const { status, body } = await httpGet("/health");
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: "ok", source: "overcoat" });
  });

  it("GET /health includes registered providers", async () => {
    await bridge.start();
    bridge.setProviders(["ollama", "deepseek"]);
    const { body } = await httpGet("/health");
    expect(body.providers).toEqual(["ollama", "deepseek"]);
  });

  it("GET /providers returns provider list", async () => {
    await bridge.start();
    bridge.setProviders(["gemini"]);
    const { status, body } = await httpGet("/providers");
    expect(status).toBe(200);
    expect(body).toMatchObject({ providers: ["gemini"] });
  });

  it("GET /unknown returns 404", async () => {
    await bridge.start();
    const { status } = await httpGet("/unknown");
    expect(status).toBe(404);
  });

  it("POST /complete returns 503 when no handler is registered", async () => {
    await bridge.start();
    const { status, body } = await httpPost("/complete", {
      id: "req-1",
      filePath: "src/foo.ts",
      language: "typescript",
      prefix: "const x",
      suffix: "",
    });
    expect(status).toBe(503);
    expect(body).toMatchObject({ error: "No completion handler registered" });
  });

  it("POST /complete invokes the registered handler and returns its response", async () => {
    await bridge.start();

    bridge.onCompletion(
      async (req: JetBrainsCompletionRequest): Promise<JetBrainsCompletionResponse> => ({
        id: req.id,
        completion: " = 42;",
        model: "llama3",
        provider: "ollama",
      }),
    );

    const { status, body } = await httpPost("/complete", {
      id: "req-2",
      filePath: "src/foo.ts",
      language: "typescript",
      prefix: "const x",
      suffix: "",
    });

    expect(status).toBe(200);
    expect(body).toMatchObject({
      id: "req-2",
      completion: " = 42;",
      model: "llama3",
      provider: "ollama",
    });
  });

  it("POST /complete returns 500 when handler throws", async () => {
    await bridge.start();
    bridge.onCompletion(async () => {
      throw new Error("LLM unavailable");
    });

    const { status, body } = await httpPost("/complete", {
      id: "req-3",
      filePath: "src/bar.ts",
      language: "python",
      prefix: "def foo",
      suffix: "",
    });

    expect(status).toBe(500);
    expect(body).toMatchObject({ error: "LLM unavailable" });
  });

  it("POST /complete returns 500 on invalid JSON body", async () => {
    await bridge.start();
    bridge.onCompletion(async (req) => ({
      id: req.id,
      completion: "",
      model: "m",
      provider: "p",
    }));

    // Send raw invalid JSON
    const result = await new Promise<{ status: number; body: Record<string, unknown> }>(
      (resolve, reject) => {
        const body = "{invalid-json}";
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port: TEST_PORT,
            path: "/complete",
            method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
          },
          (res) => {
            let data = "";
            res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
            res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) }));
          },
        );
        req.on("error", reject);
        req.write(body);
        req.end();
      },
    );

    expect(result.status).toBe(500);
    expect(result.body).toHaveProperty("error");
  });

  it("responses include a restrictive Access-Control-Allow-Origin header", async () => {
    await bridge.start();

    const { headers } = await httpGetWithHeaders("/health");

    // Must NOT be the wildcard — the server is localhost-only
    expect(headers["access-control-allow-origin"]).not.toBe("*");
    expect(headers["access-control-allow-origin"]).toBe("http://127.0.0.1");
  });

  it("reflects a localhost Origin header with port back in the CORS response", async () => {
    await bridge.start();

    const { headers } = await httpGetWithHeaders("/health", "http://127.0.0.1:9999");

    // A local origin with a port should be reflected back as-is
    expect(headers["access-control-allow-origin"]).toBe("http://127.0.0.1:9999");
  });

  it("does not reflect a non-local Origin header", async () => {
    await bridge.start();

    const { headers } = await httpGetWithHeaders("/health", "https://evil.example.com");

    // Non-local origin must NOT be reflected; falls back to safe default
    expect(headers["access-control-allow-origin"]).toBe("http://127.0.0.1");
  });

  it("OPTIONS preflight returns 204 with CORS headers", async () => {
    await bridge.start();

    const result = await new Promise<{ status: number; headers: http.IncomingHttpHeaders }>(
      (resolve, reject) => {
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port: TEST_PORT,
            path: "/complete",
            method: "OPTIONS",
            headers: {
              Origin: "http://127.0.0.1:9999",
              "Access-Control-Request-Method": "POST",
              "Access-Control-Request-Headers": "Content-Type",
            },
            agent: false,
          },
          (res) => {
            const resHeaders = res.headers;
            res.resume();
            res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: resHeaders }));
          },
        );
        req.on("error", reject);
        req.end();
      },
    );

    expect(result.status).toBe(204);
    expect(result.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:9999");
    expect(result.headers["access-control-allow-methods"]).toContain("POST");
    expect(result.headers["access-control-allow-headers"]).toContain("Content-Type");
  });
});
