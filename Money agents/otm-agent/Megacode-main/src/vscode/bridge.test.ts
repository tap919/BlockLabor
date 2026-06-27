import { VSCodeBridge } from "./bridge";
import WebSocket from "ws";

describe("VSCodeBridge", () => {
  let bridge: VSCodeBridge;
  const TEST_PORT = 19741; // Use non-standard port for tests

  beforeEach(() => {
    bridge = new VSCodeBridge({ port: TEST_PORT, host: "127.0.0.1" });
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

  it("should accept client connections", async () => {
    await bridge.start();

    const client = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    expect(bridge.connectionCount).toBe(1);

    client.close();
    await new Promise<void>((resolve) => client.on("close", resolve));
  });

  it("should handle health ping/pong", async () => {
    await bridge.start();

    const client = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    const responsePromise = new Promise<Record<string, unknown>>(
      (resolve) => {
        client.on("message", (data) => {
          resolve(JSON.parse(data.toString()));
        });
      },
    );

    client.send(
      JSON.stringify({
        id: "test-1",
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

  it("should broadcast messages to all clients", async () => {
    await bridge.start();

    const client1 = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    const client2 = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    await Promise.all([
      new Promise<void>((resolve) => client1.on("open", resolve)),
      new Promise<void>((resolve) => client2.on("open", resolve)),
    ]);

    const messages: Record<string, unknown>[] = [];
    const collectPromise = new Promise<void>((resolve) => {
      let count = 0;
      const handler = (data: WebSocket.Data) => {
        messages.push(JSON.parse(data.toString()));
        count++;
        if (count === 2) resolve();
      };
      client1.on("message", handler);
      client2.on("message", handler);
    });

    bridge.broadcast("status.update", { message: "test broadcast" });
    await collectPromise;

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      type: "status.update",
      payload: { message: "test broadcast" },
    });

    client1.close();
    client2.close();
    await Promise.all([
      new Promise<void>((resolve) => client1.on("close", resolve)),
      new Promise<void>((resolve) => client2.on("close", resolve)),
    ]);
  });

  it("should register custom message handlers", async () => {
    await bridge.start();

    let receivedPayload: Record<string, unknown> | null = null;
    bridge.on("command.execute", (message) => {
      receivedPayload = message.payload;
    });

    const client = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    client.send(
      JSON.stringify({
        id: "test-cmd",
        type: "command.execute",
        payload: { command: "test.command", args: { key: "value" } },
        timestamp: Date.now(),
      }),
    );

    // Wait for handler to process
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(receivedPayload).toMatchObject({
      command: "test.command",
      args: { key: "value" },
    });

    client.close();
    await new Promise<void>((resolve) => client.on("close", resolve));
  });

  it("should track connection count", async () => {
    await bridge.start();
    expect(bridge.connectionCount).toBe(0);

    const client = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    await new Promise<void>((resolve) => client.on("open", resolve));
    expect(bridge.connectionCount).toBe(1);

    client.close();
    await new Promise<void>((resolve) => client.on("close", resolve));

    // Wait for server to process disconnect
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(bridge.connectionCount).toBe(0);
  });

  it("message IDs are UUID v4 formatted", async () => {
    await bridge.start();

    const client = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
      client.on("message", (data) => resolve(JSON.parse(data.toString())));
    });

    client.send(
      JSON.stringify({
        id: "test-uuid-check",
        type: "health.ping",
        payload: {},
        timestamp: Date.now(),
      }),
    );

    const response = await responsePromise;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuidRegex.test(response.id as string)).toBe(true);

    client.close();
    await new Promise<void>((resolve) => client.on("close", resolve));
  });

  it("publishDiagnostics broadcasts diagnostics.publish to all clients", async () => {
    await bridge.start();

    const client = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    const msgPromise = new Promise<Record<string, unknown>>((resolve) => {
      client.on("message", (data) => resolve(JSON.parse(data.toString())));
    });

    bridge.publishDiagnostics([
      {
        filePath: "src/foo.ts",
        line: 5,
        column: 3,
        message: "Unused variable",
        severity: "warning",
        code: "no-unused-vars",
        source: "overcoat",
      },
    ]);

    const msg = await msgPromise;
    expect(msg).toMatchObject({
      type: "diagnostics.publish",
      payload: {
        diagnostics: [
          {
            filePath: "src/foo.ts",
            line: 5,
            column: 3,
            message: "Unused variable",
            severity: "warning",
          },
        ],
      },
    });

    client.close();
    await new Promise<void>((resolve) => client.on("close", resolve));
  });

  it("clearDiagnostics broadcasts diagnostics.clear with filePath", async () => {
    await bridge.start();

    const client = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    const msgPromise = new Promise<Record<string, unknown>>((resolve) => {
      client.on("message", (data) => resolve(JSON.parse(data.toString())));
    });

    bridge.clearDiagnostics("src/foo.ts");
    const msg = await msgPromise;
    expect(msg).toMatchObject({
      type: "diagnostics.clear",
      payload: { filePath: "src/foo.ts" },
    });

    client.close();
    await new Promise<void>((resolve) => client.on("close", resolve));
  });

  it("clearDiagnostics with no argument broadcasts null filePath", async () => {
    await bridge.start();

    const client = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    const msgPromise = new Promise<Record<string, unknown>>((resolve) => {
      client.on("message", (data) => resolve(JSON.parse(data.toString())));
    });

    bridge.clearDiagnostics();
    const msg = await msgPromise;
    expect(msg).toMatchObject({
      type: "diagnostics.clear",
      payload: { filePath: null },
    });

    client.close();
    await new Promise<void>((resolve) => client.on("close", resolve));
  });

  it("queryWorkspaceSymbols broadcasts workspace.symbolQuery", async () => {
    await bridge.start();

    const client = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    await new Promise<void>((resolve) => client.on("open", resolve));

    const msgPromise = new Promise<Record<string, unknown>>((resolve) => {
      client.on("message", (data) => resolve(JSON.parse(data.toString())));
    });

    bridge.queryWorkspaceSymbols("MyClass");
    const msg = await msgPromise;
    expect(msg).toMatchObject({
      type: "workspace.symbolQuery",
      payload: { query: "MyClass" },
    });

    client.close();
    await new Promise<void>((resolve) => client.on("close", resolve));
  });
});
