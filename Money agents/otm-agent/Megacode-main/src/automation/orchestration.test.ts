import {
  WorkflowEngine,
  TaskScheduler,
  EventEngine,
  ServerInventory,
} from "./orchestration";

describe("WorkflowEngine", () => {
  it("registers and retrieves workflows", () => {
    const engine = new WorkflowEngine();
    engine.register({
      name: "deploy",
      description: "Deploy pipeline",
      steps: [],
      createdAt: Date.now(),
      variables: {},
    });
    expect(engine.get("deploy")).not.toBeNull();
    expect(engine.list()).toHaveLength(1);
  });

  it("validates a workflow with no cycles", () => {
    const engine = new WorkflowEngine();
    const workflow = {
      name: "build-test",
      description: "",
      steps: [
        { id: "build", name: "Build", command: "npm run build", dependsOn: [], onError: "abort" as const, maxRetries: 0, timeoutMs: 60000 },
        { id: "test", name: "Test", command: "npm test", dependsOn: ["build"], onError: "abort" as const, maxRetries: 0, timeoutMs: 60000 },
      ],
      createdAt: Date.now(),
      variables: {},
    };
    const result = engine.validate(workflow);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("detects missing dependencies", () => {
    const engine = new WorkflowEngine();
    const workflow = {
      name: "broken",
      description: "",
      steps: [
        { id: "test", name: "Test", command: "npm test", dependsOn: ["nonexistent"], onError: "abort" as const, maxRetries: 0, timeoutMs: 60000 },
      ],
      createdAt: Date.now(),
      variables: {},
    };
    const result = engine.validate(workflow);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("nonexistent");
  });

  it("produces topological execution order", () => {
    const engine = new WorkflowEngine();
    const workflow = {
      name: "pipeline",
      description: "",
      steps: [
        { id: "deploy", name: "Deploy", command: "deploy", dependsOn: ["test"], onError: "abort" as const, maxRetries: 0, timeoutMs: 60000 },
        { id: "build", name: "Build", command: "build", dependsOn: [], onError: "abort" as const, maxRetries: 0, timeoutMs: 60000 },
        { id: "test", name: "Test", command: "test", dependsOn: ["build"], onError: "abort" as const, maxRetries: 0, timeoutMs: 60000 },
      ],
      createdAt: Date.now(),
      variables: {},
    };
    const order = engine.getExecutionOrder(workflow);
    expect(order.indexOf("build")).toBeLessThan(order.indexOf("test"));
    expect(order.indexOf("test")).toBeLessThan(order.indexOf("deploy"));
  });
});

describe("TaskScheduler", () => {
  it("adds and lists tasks", () => {
    const scheduler = new TaskScheduler();
    scheduler.addTask({
      id: "backup",
      description: "Backup DB",
      command: "pg_dump",
      cron: "*/30 * * * *",
      enabled: true,
      runCount: 0,
    });
    expect(scheduler.listTasks()).toHaveLength(1);
  });

  it("removes tasks", () => {
    const scheduler = new TaskScheduler();
    scheduler.addTask({
      id: "temp",
      description: "Temp task",
      command: "echo",
      cron: "*/5 * * * *",
      enabled: true,
      runCount: 0,
    });
    scheduler.removeTask("temp");
    expect(scheduler.listTasks()).toHaveLength(0);
  });
});

describe("EventEngine", () => {
  it("fires events matching triggers", (done) => {
    const engine = new EventEngine();
    engine.addTrigger({
      id: "test-trigger",
      event: "file-change",
      pattern: "**/*.ts",
      command: "npm test",
      debounceMs: 0,
      enabled: true,
    });

    engine.on("trigger-fire", (data) => {
      expect(data.trigger.id).toBe("test-trigger");
      done();
    });

    engine.fireEvent("file-change", { path: "src/index.ts" });
  });

  it("does not fire for disabled triggers", () => {
    const engine = new EventEngine();
    let fired = false;
    engine.addTrigger({
      id: "disabled",
      event: "file-change",
      pattern: "**/*.ts",
      command: "npm test",
      debounceMs: 0,
      enabled: false,
    });

    engine.on("trigger-fire", () => { fired = true; });
    engine.fireEvent("file-change", { path: "src/index.ts" });
    expect(fired).toBe(false);
  });
});

describe("ServerInventory", () => {
  it("adds and retrieves servers", () => {
    const inventory = new ServerInventory();
    inventory.addServer({
      id: "web1",
      host: "10.0.0.1",
      port: 22,
      user: "deploy",
      roles: ["web"],
      online: true,
    });
    expect(inventory.getAll()).toHaveLength(1);
    expect(inventory.getServer("web1")?.host).toBe("10.0.0.1");
  });

  it("filters by role", () => {
    const inventory = new ServerInventory();
    inventory.addServer({ id: "web1", host: "10.0.0.1", port: 22, user: "deploy", roles: ["web"], online: true });
    inventory.addServer({ id: "db1", host: "10.0.0.2", port: 22, user: "deploy", roles: ["db"], online: true });
    inventory.addServer({ id: "web2", host: "10.0.0.3", port: 22, user: "deploy", roles: ["web"], online: true });

    expect(inventory.getByRole("web")).toHaveLength(2);
    expect(inventory.getByRole("db")).toHaveLength(1);
  });
});
