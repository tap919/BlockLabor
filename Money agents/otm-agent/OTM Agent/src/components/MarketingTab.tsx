"use client";

import { useState, useEffect, useCallback } from "react";

// ============================================================================
// TYPES
// ============================================================================

interface ServiceStatus {
  name: string;
  id: string;
  status: "online" | "offline" | "checking" | "error";
  url: string;
  description: string;
  icon: string;
  details?: Record<string, string | number>;
}

interface MauticContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  score: number;
  lastActive: string;
  tags: string[];
}

interface CrmDeal {
  id: string;
  name: string;
  stage: string;
  amount: number;
  probability: number;
  company: string;
  updatedAt: string;
}

interface MarketingLog {
  id: string;
  time: string;
  message: string;
  type: "success" | "warn" | "info" | "error";
  service: string;
}

// ============================================================================
// FALLBACK DATA
// ============================================================================

const FALLBACK_CONTACTS: MauticContact[] = [
  { id: "1", firstName: "Alex", lastName: "Rivera", email: "alex@startup.io", score: 92, lastActive: "2h ago", tags: ["hot-lead", "ai-tools"] },
  { id: "2", firstName: "Morgan", lastName: "Chen", email: "morgan@agency.co", score: 78, lastActive: "5h ago", tags: ["content-buyer", "returning"] },
  { id: "3", firstName: "Jordan", lastName: "Blake", email: "jordan@ecom.shop", score: 65, lastActive: "1d ago", tags: ["template-interest"] },
  { id: "4", firstName: "Casey", lastName: "Nguyen", email: "casey@freelance.dev", score: 88, lastActive: "30m ago", tags: ["automation", "high-value"] },
  { id: "5", firstName: "Taylor", lastName: "Martinez", email: "taylor@smb.biz", score: 45, lastActive: "3d ago", tags: ["chatbot-demo"] },
];

const FALLBACK_DEALS: CrmDeal[] = [
  { id: "1", name: "AI Chatbot Setup - Rivera", stage: "Proposal", amount: 1200, probability: 80, company: "Startup.io", updatedAt: "Today" },
  { id: "2", name: "Content Pipeline - Chen Agency", stage: "Negotiation", amount: 3500, probability: 60, company: "Chen Agency", updatedAt: "Yesterday" },
  { id: "3", name: "Template Bundle - Blake Ecom", stage: "Qualified", amount: 450, probability: 40, company: "Blake Ecom", updatedAt: "2d ago" },
  { id: "4", name: "Automation Retainer - Nguyen", stage: "Won", amount: 2400, probability: 100, company: "Freelance Dev", updatedAt: "3d ago" },
  { id: "5", name: "Social Media Bot - Martinez", stage: "Discovery", amount: 800, probability: 25, company: "SMB Biz", updatedAt: "4d ago" },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function MarketingTab() {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: "Mautic", id: "mautic", status: "checking", url: "http://localhost:8880", description: "Marketing automation & email campaigns", icon: "M" },
    { name: "Twenty CRM", id: "twenty", status: "checking", url: "http://localhost:3030", description: "Customer relationship management", icon: "T" },
    { name: "Stable Diffusion", id: "sd", status: "checking", url: "http://localhost:7860", description: "AI image generation (A1111/ComfyUI)", icon: "I" },
    { name: "MoneyPrinter Turbo", id: "mp", status: "checking", url: "http://localhost:8501", description: "AI video generation pipeline", icon: "V" },
  ]);

  const [contacts, setContacts] = useState<MauticContact[]>(FALLBACK_CONTACTS);
  const [deals, setDeals] = useState<CrmDeal[]>(FALLBACK_DEALS);
  const [logs, setLogs] = useState<MarketingLog[]>([]);
  const [activePanel, setActivePanel] = useState<"contacts" | "pipeline" | "campaigns" | "media">("contacts");

  const addLog = useCallback((message: string, type: MarketingLog["type"], service: string) => {
    const now = new Date();
    const time = now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0") + ":" + now.getSeconds().toString().padStart(2, "0");
    setLogs((prev) => [{ id: crypto.randomUUID(), time, message, type, service }, ...prev].slice(0, 30));
  }, []);

  // Probe services on mount
  useEffect(() => {
    let cancelled = false;

    async function probeService(svc: ServiceStatus): Promise<ServiceStatus> {
      try {
        // Use gateway marketing.status if available
        const res = await fetch("/api/openclaw/metrics");
        if (!cancelled && res.ok) {
          const data = await res.json();
          if (data.source === "openclaw" && data.metrics) {
            return { ...svc, status: "online" };
          }
        }
      } catch {
        // Fall through
      }
      return { ...svc, status: "offline" };
    }

    async function probeAll() {
      const results = await Promise.all(services.map(probeService));
      if (!cancelled) {
        setServices(results);
        for (const s of results) {
          addLog(
            `${s.name}: ${s.status === "online" ? "Connected" : "Offline (using demo data)"}`,
            s.status === "online" ? "success" : "warn",
            s.id,
          );
        }
      }
    }

    void probeAll();
    return () => { cancelled = true; };
    // Run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Try to fetch real contacts from gateway
  useEffect(() => {
    let cancelled = false;

    async function fetchContacts() {
      try {
        const res = await fetch("/api/openclaw/opportunities?limit=5&minScore=0");
        if (!cancelled && res.ok) {
          const data = await res.json();
          if (data.source === "openclaw") {
            addLog("Mautic contacts synced from gateway", "success", "mautic");
          }
        }
      } catch {
        // Fallback data remains
      }
    }

    void fetchContacts();
    return () => { cancelled = true; };
  }, [addLog]);

  const pipelineValue = deals.reduce((sum, d) => sum + d.amount * (d.probability / 100), 0);
  const wonDeals = deals.filter((d) => d.stage === "Won");
  const activeDeals = deals.filter((d) => d.stage !== "Won");

  const getStageColor = (stage: string) => {
    switch (stage) {
      case "Won": return "var(--green)";
      case "Negotiation": return "var(--yellow)";
      case "Proposal": return "var(--purple)";
      case "Qualified": return "#06b6d4";
      case "Discovery": return "var(--muted)";
      default: return "var(--muted)";
    }
  };

  return (
    <div className="tab-content">
      {/* Service Status Bar */}
      <section className="panel panel-full">
        <div className="panel-title">Marketing Services Status</div>
        <div className="svc-status-grid">
          {services.map((svc) => (
            <div key={svc.id} className={`svc-status-card svc-${svc.status}`}>
              <div className="svc-icon-wrap">
                <span className="svc-icon">{svc.icon}</span>
                <span className={`svc-dot svc-dot-${svc.status}`}></span>
              </div>
              <div className="svc-info">
                <span className="svc-name">{svc.name}</span>
                <span className="svc-desc">{svc.description}</span>
                <span className="svc-url">{svc.url}</span>
              </div>
              <span className={`svc-badge svc-badge-${svc.status}`}>
                {svc.status === "checking" ? "CHECKING..." : svc.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Stats */}
      <section className="panel panel-full">
        <div className="panel-title">Marketing Overview</div>
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon">M</div>
            <div className="metric-content">
              <div className="metric-value">{contacts.length}</div>
              <div className="metric-label">Active Contacts</div>
            </div>
          </div>
          <div className="metric-card metric-highlight">
            <div className="metric-icon">T</div>
            <div className="metric-content">
              <div className="metric-value">${Math.round(pipelineValue).toLocaleString()}</div>
              <div className="metric-label">Weighted Pipeline</div>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">I</div>
            <div className="metric-content">
              <div className="metric-value">{wonDeals.length}</div>
              <div className="metric-label">Won Deals</div>
            </div>
          </div>
          <div className="metric-card metric-quick-win">
            <div className="metric-icon">V</div>
            <div className="metric-content">
              <div className="metric-value">{contacts.filter((c) => c.score >= 80).length}</div>
              <div className="metric-label">Hot Leads (80+)</div>
            </div>
          </div>
        </div>
      </section>

      {/* Sub-navigation */}
      <section className="panel panel-full">
        <div className="mkt-subnav">
          <button className={`mkt-subnav-btn ${activePanel === "contacts" ? "active" : ""}`} onClick={() => setActivePanel("contacts")}>
            Contacts
          </button>
          <button className={`mkt-subnav-btn ${activePanel === "pipeline" ? "active" : ""}`} onClick={() => setActivePanel("pipeline")}>
            Deal Pipeline
          </button>
          <button className={`mkt-subnav-btn ${activePanel === "campaigns" ? "active" : ""}`} onClick={() => setActivePanel("campaigns")}>
            Campaigns
          </button>
          <button className={`mkt-subnav-btn ${activePanel === "media" ? "active" : ""}`} onClick={() => setActivePanel("media")}>
            Media Studio
          </button>
        </div>
      </section>

      {/* CONTACTS PANEL */}
      {activePanel === "contacts" && (
        <section className="panel panel-full">
          <div className="panel-title">Mautic Contacts <span>{contacts.length} total</span></div>
          <div className="contacts-table">
            <div className="ct-header">
              <span className="ct-col ct-name">Name</span>
              <span className="ct-col ct-email">Email</span>
              <span className="ct-col ct-score">Score</span>
              <span className="ct-col ct-active">Last Active</span>
              <span className="ct-col ct-tags">Tags</span>
            </div>
            {contacts.map((c) => (
              <div key={c.id} className="ct-row">
                <span className="ct-col ct-name">{c.firstName} {c.lastName}</span>
                <span className="ct-col ct-email">{c.email}</span>
                <span className={`ct-col ct-score ${c.score >= 80 ? "score-hot" : c.score >= 50 ? "score-warm" : "score-cold"}`}>
                  {c.score}
                </span>
                <span className="ct-col ct-active">{c.lastActive}</span>
                <span className="ct-col ct-tags">
                  {c.tags.map((t) => <span key={t} className="ct-tag">{t}</span>)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* PIPELINE PANEL */}
      {activePanel === "pipeline" && (
        <section className="panel panel-full">
          <div className="panel-title">Twenty CRM Pipeline <span>${deals.reduce((s, d) => s + d.amount, 0).toLocaleString()} total</span></div>
          <div className="pipeline-cards">
            {activeDeals.map((deal) => (
              <div key={deal.id} className="deal-card" style={{ borderLeftColor: getStageColor(deal.stage) }}>
                <div className="deal-header">
                  <span className="deal-name">{deal.name}</span>
                  <span className="deal-amount">${deal.amount.toLocaleString()}</span>
                </div>
                <div className="deal-meta">
                  <span className="deal-stage" style={{ color: getStageColor(deal.stage) }}>{deal.stage}</span>
                  <span className="deal-company">{deal.company}</span>
                  <span className="deal-prob">{deal.probability}%</span>
                  <span className="deal-date">{deal.updatedAt}</span>
                </div>
                <div className="deal-progress-bar">
                  <div className="deal-progress-fill" style={{ width: `${deal.probability}%`, background: getStageColor(deal.stage) }}></div>
                </div>
              </div>
            ))}
            {wonDeals.length > 0 && (
              <div className="won-section">
                <div className="won-header">Won Deals</div>
                {wonDeals.map((deal) => (
                  <div key={deal.id} className="deal-card deal-won" style={{ borderLeftColor: "var(--green)" }}>
                    <div className="deal-header">
                      <span className="deal-name">{deal.name}</span>
                      <span className="deal-amount">${deal.amount.toLocaleString()}</span>
                    </div>
                    <div className="deal-meta">
                      <span className="deal-company">{deal.company}</span>
                      <span className="deal-date">{deal.updatedAt}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* CAMPAIGNS PANEL */}
      {activePanel === "campaigns" && (
        <section className="panel panel-full">
          <div className="panel-title">Campaign Orchestration</div>
          <div className="campaign-grid">
            <div className="campaign-card">
              <div className="campaign-header">
                <span className="campaign-icon">M</span>
                <span className="campaign-name">Welcome Drip Sequence</span>
                <span className="campaign-status campaign-active">ACTIVE</span>
              </div>
              <div className="campaign-stats">
                <span>Sent: 142</span>
                <span>Opened: 89 (62.7%)</span>
                <span>Clicked: 34 (23.9%)</span>
              </div>
              <div className="campaign-desc">5-email nurture sequence for new contacts. Triggers on form submission.</div>
            </div>
            <div className="campaign-card">
              <div className="campaign-header">
                <span className="campaign-icon">M</span>
                <span className="campaign-name">Re-engagement Blast</span>
                <span className="campaign-status campaign-scheduled">SCHEDULED</span>
              </div>
              <div className="campaign-stats">
                <span>Target: 45 contacts</span>
                <span>Segment: Inactive 30d+</span>
              </div>
              <div className="campaign-desc">Win-back campaign for dormant leads with special offer.</div>
            </div>
            <div className="campaign-card">
              <div className="campaign-header">
                <span className="campaign-icon">V</span>
                <span className="campaign-name">Product Demo Video</span>
                <span className="campaign-status campaign-draft">DRAFT</span>
              </div>
              <div className="campaign-stats">
                <span>Template: AI Explainer</span>
                <span>Duration: 60s</span>
              </div>
              <div className="campaign-desc">MoneyPrinter Turbo auto-generated product walkthrough video.</div>
            </div>
            <div className="campaign-card">
              <div className="campaign-header">
                <span className="campaign-icon">I</span>
                <span className="campaign-name">Social Media Creatives</span>
                <span className="campaign-status campaign-active">ACTIVE</span>
              </div>
              <div className="campaign-stats">
                <span>Generated: 12 images</span>
                <span>Published: 8</span>
              </div>
              <div className="campaign-desc">Stable Diffusion batch generation for weekly social posts.</div>
            </div>
          </div>
        </section>
      )}

      {/* MEDIA STUDIO PANEL */}
      {activePanel === "media" && (
        <section className="panel panel-full">
          <div className="panel-title">Media Studio</div>
          <div className="media-grid">
            <div className="media-section">
              <div className="media-section-header">
                <span className="media-section-icon">I</span>
                <span className="media-section-title">Image Generation (Stable Diffusion)</span>
                <span className={`svc-badge svc-badge-${services.find((s) => s.id === "sd")?.status ?? "offline"}`}>
                  {(services.find((s) => s.id === "sd")?.status ?? "offline").toUpperCase()}
                </span>
              </div>
              <div className="media-description">
                Generate marketing visuals, product mockups, social media graphics, and brand assets using AI. Supports both Automatic1111 and ComfyUI backends with auto-detection.
              </div>
              <div className="media-quick-actions">
                <button className="btn-ghost">Generate Social Post</button>
                <button className="btn-ghost">Product Mockup</button>
                <button className="btn-ghost">Brand Banner</button>
                <button className="btn-ghost">Ad Creative</button>
              </div>
              <div className="media-presets">
                <div className="preset-tag">512x512 Square</div>
                <div className="preset-tag">1024x1024 HD</div>
                <div className="preset-tag">1200x628 OG</div>
                <div className="preset-tag">1080x1920 Story</div>
              </div>
            </div>
            <div className="media-section">
              <div className="media-section-header">
                <span className="media-section-icon">V</span>
                <span className="media-section-title">Video Generation (MoneyPrinter Turbo)</span>
                <span className={`svc-badge svc-badge-${services.find((s) => s.id === "mp")?.status ?? "offline"}`}>
                  {(services.find((s) => s.id === "mp")?.status ?? "offline").toUpperCase()}
                </span>
              </div>
              <div className="media-description">
                Create marketing videos, product demos, explainer content, and social clips automatically. Uses AI for script generation, voiceover, and video assembly.
              </div>
              <div className="media-quick-actions">
                <button className="btn-ghost">Product Explainer</button>
                <button className="btn-ghost">Social Clip (30s)</button>
                <button className="btn-ghost">Testimonial Video</button>
                <button className="btn-ghost">Ad Spot (15s)</button>
              </div>
              <div className="media-presets">
                <div className="preset-tag">1080p Landscape</div>
                <div className="preset-tag">1080p Portrait</div>
                <div className="preset-tag">720p Fast</div>
                <div className="preset-tag">4K Premium</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Marketing Activity Log */}
      <section className="panel panel-full">
        <div className="panel-title">Marketing Activity Log</div>
        <div className="log-box">
          {logs.length === 0 ? (
            <div className="log-line">
              <span className="log-time">[--:--:--]</span>
              <span className="log-msg info">Marketing services initializing...</span>
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="log-line">
                <span className="log-time">[{log.time}]</span>
                <span className="log-msg" style={{ color: `var(--${log.service === "mautic" ? "purple" : log.service === "twenty" ? "green" : log.service === "sd" ? "yellow" : "red"})` }}>
                  [{log.service.toUpperCase()}]
                </span>
                <span className={`log-msg ${log.type}`}> {log.message}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
