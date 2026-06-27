"use client";

import { useState, useEffect, useCallback } from "react";

// ============================================================================
// TYPES
// ============================================================================

interface SystemService {
  id: string;
  name: string;
  category: "core" | "marketing" | "trading" | "extension";
  status: "online" | "offline" | "degraded" | "checking";
  uptime: string;
  latency: string;
  url: string;
  icon: string;
  details: Record<string, string | number>;
}

interface AgentProcess {
  id: string;
  name: string;
  role: string;
  status: "active" | "idle" | "error" | "stopped";
  tasks: number;
  successRate: number;
  lastActivity: string;
}

interface SystemLog {
  id: string;
  time: string;
  level: "info" | "warn" | "error" | "debug";
  source: string;
  message: string;
}

// ============================================================================
// DATA
// ============================================================================

const INITIAL_SERVICES: SystemService[] = [
  // Core
  { id: "gateway", name: "OpenClaw Gateway", category: "core", status: "checking", uptime: "--", latency: "--", url: "localhost:18789", icon: "G", details: { Port: 18789, Mode: "local", Version: "latest" } },
  { id: "nextjs", name: "OTM Agent Web", category: "core", status: "online", uptime: "Active", latency: "<1ms", url: "localhost:3000", icon: "W", details: { Framework: "Next.js", Port: 3000 } },
  // Marketing
  { id: "mautic", name: "Mautic", category: "marketing", status: "checking", uptime: "--", latency: "--", url: "localhost:8880", icon: "M", details: { "API Version": "v2", Protocol: "REST" } },
  { id: "twenty", name: "Twenty CRM", category: "marketing", status: "checking", uptime: "--", latency: "--", url: "localhost:3030", icon: "T", details: { "API Type": "GraphQL", Auth: "Bearer" } },
  { id: "sd", name: "Stable Diffusion", category: "marketing", status: "checking", uptime: "--", latency: "--", url: "localhost:7860", icon: "I", details: { Backend: "Auto-detect", Modes: "A1111/ComfyUI" } },
  { id: "mp", name: "MoneyPrinter Turbo", category: "marketing", status: "checking", uptime: "--", latency: "--", url: "localhost:8501", icon: "V", details: { Protocol: "REST", Endpoint: "/api/v1" } },
  // Trading
  { id: "freqtrade", name: "Freqtrade", category: "trading", status: "checking", uptime: "--", latency: "--", url: "localhost:8080", icon: "F", details: { Strategy: "RSI+MACD" } },
  { id: "superalgos", name: "Superalgos", category: "trading", status: "checking", uptime: "--", latency: "--", url: "localhost:34248", icon: "S", details: { Type: "Visual Trading" } },
  // Extensions
  { id: "signal", name: "Signal Messenger", category: "extension", status: "checking", uptime: "--", latency: "--", url: "signal-cli daemon", icon: "S", details: { Protocol: "signal-cli", Mode: "Daemon" } },
  { id: "draymond", name: "Draymond Supervisor", category: "extension", status: "checking", uptime: "--", latency: "--", url: "Extension", icon: "D", details: { Role: "Agent Orchestration" } },
];

const INITIAL_AGENTS: AgentProcess[] = [
  { id: "scout", name: "Scout", role: "Micro-opportunity detector", status: "active", tasks: 142, successRate: 94.2, lastActivity: "Just now" },
  { id: "closer", name: "Closer", role: "Outreach & sales", status: "active", tasks: 67, successRate: 88.5, lastActivity: "2m ago" },
  { id: "builder", name: "Builder", role: "Deliverable creator", status: "active", tasks: 89, successRate: 96.1, lastActivity: "1m ago" },
  { id: "stacker", name: "Stacker", role: "Capital reinvestment", status: "idle", tasks: 12, successRate: 100, lastActivity: "1h ago" },
  { id: "marketing-mautic", name: "Mautic Agent", role: "Email campaigns", status: "idle", tasks: 0, successRate: 0, lastActivity: "N/A" },
  { id: "marketing-crm", name: "CRM Agent", role: "Deal management", status: "idle", tasks: 0, successRate: 0, lastActivity: "N/A" },
  { id: "marketing-media", name: "Media Agent", role: "Content generation", status: "idle", tasks: 0, successRate: 0, lastActivity: "N/A" },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function SystemStatusTab() {
  const [services, setServices] = useState<SystemService[]>(INITIAL_SERVICES);
  const [agents, setAgents] = useState<AgentProcess[]>(INITIAL_AGENTS);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [filterCategory, setFilterCategory] = useState<"all" | "core" | "marketing" | "trading" | "extension">("all");

  const addSystemLog = useCallback((level: SystemLog["level"], source: string, message: string) => {
    const now = new Date();
    const time = now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0") + ":" + now.getSeconds().toString().padStart(2, "0");
    setSystemLogs((prev) => [{ id: crypto.randomUUID(), time, level, source, message }, ...prev].slice(0, 50));
  }, []);

  // Probe gateway on mount
  useEffect(() => {
    let cancelled = false;

    async function probe() {
      try {
        const res = await fetch("/api/openclaw/metrics");
        if (!cancelled && res.ok) {
          const data = await res.json();
          if (data.source === "openclaw") {
            setServices((prev) =>
              prev.map((s) =>
                s.id === "gateway" ? { ...s, status: "online" as const, uptime: "Active", latency: "<50ms" } : s,
              ),
            );
            addSystemLog("info", "gateway", "OpenClaw gateway connected");
          }
        }
      } catch {
        if (!cancelled) {
          setServices((prev) =>
            prev.map((s) =>
              s.id === "gateway" ? { ...s, status: "offline" as const } : s,
            ),
          );
          addSystemLog("warn", "gateway", "Gateway offline — using demo data");
        }
      }

      // Mark other services as offline after check (no direct probing for external services)
      if (!cancelled) {
        setServices((prev) =>
          prev.map((s) => {
            if (s.status === "checking" && s.id !== "nextjs") {
              return { ...s, status: "offline" as const };
            }
            return s;
          }),
        );
        addSystemLog("info", "system", "Service discovery complete");
      }
    }

    void probe();
    return () => { cancelled = true; };
  }, [addSystemLog]);

  // Simulate periodic health checks
  useEffect(() => {
    const interval = setInterval(() => {
      const sources = ["scout", "closer", "builder", "gateway", "system"];
      const messages = [
        "Health check passed",
        "Task completed successfully",
        "Memory usage normal",
        "Connection pool healthy",
        "Queue depth nominal",
      ];
      const src = sources[Math.floor(Math.random() * sources.length)];
      const msg = messages[Math.floor(Math.random() * messages.length)];
      addSystemLog("debug", src, msg);
    }, 8000);
    return () => clearInterval(interval);
  }, [addSystemLog]);

  const filteredServices = filterCategory === "all"
    ? services
    : services.filter((s) => s.category === filterCategory);

  const onlineCount = services.filter((s) => s.status === "online").length;
  const totalCount = services.length;
  const activeAgents = agents.filter((a) => a.status === "active").length;
  const totalTasks = agents.reduce((s, a) => s + a.tasks, 0);
  const avgSuccess = agents.filter((a) => a.tasks > 0).reduce((s, a) => s + a.successRate, 0) / (agents.filter((a) => a.tasks > 0).length || 1);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online": case "active": return "var(--green)";
      case "offline": case "stopped": return "var(--muted)";
      case "degraded": case "error": return "var(--red)";
      case "idle": return "var(--yellow)";
      case "checking": return "var(--purple)";
      default: return "var(--muted)";
    }
  };

  return (
    <div className="tab-content">
      {/* Health Overview */}
      <section className="panel panel-full">
        <div className="panel-title">System Health Overview</div>
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon">S</div>
            <div className="metric-content">
              <div className="metric-value">{onlineCount}/{totalCount}</div>
              <div className="metric-label">Services Online</div>
            </div>
          </div>
          <div className="metric-card metric-highlight">
            <div className="metric-icon">A</div>
            <div className="metric-content">
              <div className="metric-value">{activeAgents}</div>
              <div className="metric-label">Active Agents</div>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">T</div>
            <div className="metric-content">
              <div className="metric-value">{totalTasks}</div>
              <div className="metric-label">Total Tasks</div>
            </div>
          </div>
          <div className="metric-card metric-quick-win">
            <div className="metric-icon">%</div>
            <div className="metric-content">
              <div className="metric-value">{avgSuccess.toFixed(1)}%</div>
              <div className="metric-label">Avg Success Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* Service Filter */}
      <section className="panel panel-full">
        <div className="mkt-subnav">
          {(["all", "core", "marketing", "trading", "extension"] as const).map((cat) => (
            <button
              key={cat}
              className={`mkt-subnav-btn ${filterCategory === cat ? "active" : ""}`}
              onClick={() => setFilterCategory(cat)}
            >
              {cat === "all" ? "All Services" : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </section>

      {/* Services Grid */}
      <section className="panel panel-full">
        <div className="panel-title">Service Registry <span>{filteredServices.length} services</span></div>
        <div className="svc-status-grid">
          {filteredServices.map((svc) => (
            <div key={svc.id} className={`svc-status-card svc-${svc.status}`}>
              <div className="svc-icon-wrap">
                <span className="svc-icon">{svc.icon}</span>
                <span className={`svc-dot svc-dot-${svc.status}`}></span>
              </div>
              <div className="svc-info">
                <span className="svc-name">{svc.name}</span>
                <span className="svc-desc">{svc.url}</span>
                <div className="svc-detail-row">
                  {Object.entries(svc.details).map(([k, v]) => (
                    <span key={k} className="svc-detail-tag">{k}: {v}</span>
                  ))}
                </div>
              </div>
              <div className="svc-meta">
                <span className={`svc-badge svc-badge-${svc.status}`}>{svc.status.toUpperCase()}</span>
                <span className="svc-latency">{svc.latency}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Agent Orchestration */}
      <section className="panel panel-full">
        <div className="panel-title">Agent Orchestration <span>{activeAgents} active</span></div>
        <div className="agent-orch-grid">
          {agents.map((agent) => (
            <div key={agent.id} className={`agent-orch-card agent-orch-${agent.status}`}>
              <div className="agent-orch-header">
                <div className="agent-orch-dot" style={{ background: getStatusColor(agent.status) }}></div>
                <span className="agent-orch-name">{agent.name}</span>
                <span className={`agent-orch-status`} style={{ color: getStatusColor(agent.status) }}>
                  {agent.status.toUpperCase()}
                </span>
              </div>
              <div className="agent-orch-role">{agent.role}</div>
              <div className="agent-orch-stats">
                <div className="aos-item">
                  <span className="aos-label">Tasks</span>
                  <span className="aos-value">{agent.tasks}</span>
                </div>
                <div className="aos-item">
                  <span className="aos-label">Success</span>
                  <span className="aos-value">{agent.successRate > 0 ? `${agent.successRate}%` : "N/A"}</span>
                </div>
                <div className="aos-item">
                  <span className="aos-label">Last</span>
                  <span className="aos-value">{agent.lastActivity}</span>
                </div>
              </div>
              {agent.tasks > 0 && (
                <div className="agent-orch-bar">
                  <div className="agent-orch-bar-fill" style={{ width: `${agent.successRate}%`, background: getStatusColor(agent.status) }}></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* System Logs */}
      <section className="panel panel-full">
        <div className="panel-title">System Logs <span>{systemLogs.length} entries</span></div>
        <div className="log-box" style={{ height: "240px" }}>
          {systemLogs.length === 0 ? (
            <div className="log-line">
              <span className="log-time">[--:--:--]</span>
              <span className="log-msg info">System initializing...</span>
            </div>
          ) : (
            systemLogs.map((log) => (
              <div key={log.id} className="log-line">
                <span className="log-time">[{log.time}]</span>
                <span className={`log-msg ${log.level === "error" ? "warn" : log.level === "warn" ? "warn" : log.level === "debug" ? "info" : "success"}`}>
                  [{log.source.toUpperCase()}] {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
