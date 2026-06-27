import WebSocket from "ws";
import { ZedBridge } from "./zed";
import { CursorBridge } from "./cursor";

// ─── ZedBridge ────────────────────────────────────────────────────────────────

describe("ZedBridge", () => {
  let bridge: ZedBridge;
  const TEST_PORT = 19742;

  beforeEach(() => {
    bridge = new ZedBridge({ port: TEST_PORT, host: "127.0.0.1" });
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

  it("should expose Zed-specific configuration", () => {
    const cfg = bridge.zedConfiguration;
    expect(cfg.port).toBe(TEST_PORT);
    expect(cfg.host).toBe("127.0.0.1");
    expect(cfg.trackBufferLifecycle).toBe(true);
  });

  it("should accept client connections", async () => {
    await bridge.start();

    const client = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    expect(bridge.connectionCount).toBe(1);

    client.close();
    await new Promise<void>((resolve) => client.on("close", resolve));
  });

  it("should respond to health ping/pong", async () => {
    await bridge.start();

    const client = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
      client.on("message", (data) => resolve(JSON.parse(data.toString())));
    });

    client.send(
      JSON.stringify({
        id: "zed-ping",
        type: "health.ping",
        payload: {},
        timestamp: Date.now(),
      }),
    );

    const response = await responsePromise;
    expect(response).toMatchObject({
      type: "health.pong",
      payload: { status: "ok" },
    });

    client.close();
    await new Promise<void>((resolve) => client.on("close", resolve));
  });

  it("sendDiagnostic broadcasts a diff.update message", async () => {
    await bridge.start();

    const client = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    const msgPromise = new Promise<Record<string, unknown>>((resolve) => {
      client.on("message", (data) => resolve(JSON.parse(data.toString())));
    });

    bridge.sendDiagnostic("src/foo.ts", 10, 5, "unused variable", "warning");
    const msg = await msgPromise;

    expect(msg).toMatchObject({
      type: "diff.update",
      payload: {
        filePath: "src/foo.ts",
        line: 10,
        column: 5,
        message: "unused variable",
        severity: "warning",
        source: "overcoat",
      },
    });

    client.close();
    await new Promise<void>((resolve) => client.on("close", resolve));
  });

  it("insertCompletion broadcasts a completion.response message", async () => {
    await bridge.start();

    const client = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    const msgPromise = new Promise<Record<string, unknown>>((resolve) => {
      client.on("message", (data) => resolve(JSON.parse(data.toString())));
    });

    bridge.insertCompletion("const x = 42;", "req-1");
    const msg = await msgPromise;

    expect(msg).toMatchObject({
      type: "completion.response",
      payload: { text: "const x = 42;", source: "overcoat", requestId: "req-1" },
    });

    client.close();
    await new Promise<void>((resolve) => client.on("close", resolve));
  });
});

// ─── CursorBridge ─────────────────────────────────────────────────────────────

describe("CursorBridge", () => {
  let bridge: CursorBridge;
  const TEST_PORT = 19743;

  beforeEach(() => {
    bridge = new CursorBridge({ port: TEST_PORT, host: "127.0.0.1" });
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

  it("should expose Cursor-specific configuration", () => {
    const cfg = bridge.cursorConfiguration;
    expect(cfg.port).toBe(TEST_PORT);
    expect(cfg.composerEnabled).toBe(true);
    expect(cfg.diffPreview).toBe(true);
  });

  it("should accept client connections", async () => {
    await bridge.start();

    const client = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    expect(bridge.connectionCount).toBe(1);

    client.close();
    await new Promise<void>((resolve) => client.on("close", resolve));
  });

  it("should respond to health ping/pong", async () => {
    await bridge.start();

    const client = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
      client.on("message", (data) => resolve(JSON.parse(data.toString())));
    });

    client.send(
      JSON.stringify({
        id: "cursor-ping",
        type: "health.ping",
        payload: {},
        timestamp: Date.now(),
      }),
    );

    const response = await responsePromise;
    expect(response).toMatchObject({
      type: "health.pong",
      payload: { status: "ok" },
    });

    client.close();
    await new Promise<void>((resolve) => client.on("close", resolve));
  });

  it("sendComposerDiff broadcasts a diff.update message", async () => {
    await bridge.start();

    const client = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    const msgPromise = new Promise<Record<string, unknown>>((resolve) => {
      client.on("message", (data) => resolve(JSON.parse(data.toString())));
    });

    bridge.sendComposerDiff(
      [{ path: "src/auth.ts", original: "// old", updated: "// new" }],
      "refactor auth",
    );
    const msg = await msgPromise;

    expect(msg).toMatchObject({
      type: "diff.update",
      payload: {
        composerDiff: true,
        description: "refactor auth",
        source: "overcoat",
      },
    });

    client.close();
    await new Promise<void>((resolve) => client.on("close", resolve));
  });

  it("updateStatusBar broadcasts a status.update message", async () => {
    await bridge.start();

    const client = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    const msgPromise = new Promise<Record<string, unknown>>((resolve) => {
      client.on("message", (data) => resolve(JSON.parse(data.toString())));
    });

    bridge.updateStatusBar("OverCoat: ready", "3 providers online");
    const msg = await msgPromise;

    expect(msg).toMatchObject({
      type: "status.update",
      payload: {
        statusBar: { text: "OverCoat: ready", tooltip: "3 providers online" },
        source: "overcoat",
      },
    });

    client.close();
    await new Promise<void>((resolve) => client.on("close", resolve));
  });
});
