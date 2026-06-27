// ─────────────────────────────────────────────────────────────────────────────
// ui/dashboardHtml.ts  –  Embedded HTML for the OG Glass Design Studio mini UI
// ─────────────────────────────────────────────────────────────────────────────

export const DASHBOARD_HTML = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OG Glass – Design Studio</title>
  <style>
    :root {
      --bg: #0a0d14;
      --surface: rgba(255,255,255,0.04);
      --border: rgba(255,255,255,0.08);
      --accent: #6366f1;
      --accent-hover: #818cf8;
      --text: rgba(255,255,255,0.92);
      --text-secondary: rgba(255,255,255,0.6);
      --text-muted: rgba(255,255,255,0.35);
      --danger: #ef4444;
      --warning: #f59e0b;
      --success: #22c55e;
      --radius: 16px;
      --sidebar-w: 220px;
      --blur: blur(12px);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'DM Sans', 'Inter', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      overflow: hidden;
    }

    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background:
        radial-gradient(ellipse 80% 80% at 20% 10%, rgba(99,102,241,0.15) 0%, transparent 60%),
        radial-gradient(ellipse 60% 60% at 80% 80%, rgba(14,165,233,0.1) 0%, transparent 60%);
      pointer-events: none;
      z-index: 0;
    }

    .app { display: flex; height: 100vh; position: relative; z-index: 1; }

    /* ── Sidebar ─────────────────────────────────────────────────────────────── */
    .sidebar {
      width: var(--sidebar-w);
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      background: rgba(255,255,255,0.03);
      border-right: 1px solid var(--border);
      backdrop-filter: var(--blur);
      padding: 20px 12px;
      gap: 4px;
    }

    .sidebar-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px 20px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 8px;
    }

    .logo-icon {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, var(--accent), #0ea5e9);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }

    .logo-text { font-size: 0.875rem; font-weight: 600; }
    .logo-sub  { font-size: 0.6875rem; color: var(--text-muted); }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      cursor: pointer;
      transition: all 200ms ease;
      color: var(--text-secondary);
      font-size: 0.875rem;
      font-weight: 500;
      border: 1px solid transparent;
      background: none;
      width: 100%;
      text-align: left;
      font-family: inherit;
    }

    .nav-item:hover { background: rgba(255,255,255,0.05); color: var(--text); }
    .nav-item.active {
      background: rgba(99,102,241,0.15);
      color: var(--accent-hover);
      border-color: rgba(99,102,241,0.25);
    }

    .nav-icon { font-size: 1rem; width: 20px; text-align: center; flex-shrink: 0; }

    .sidebar-footer {
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid var(--border);
    }

    /* ── Main ────────────────────────────────────────────────────────────────── */
    .main { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: rgba(255,255,255,0.02);
      border-bottom: 1px solid var(--border);
      backdrop-filter: blur(8px);
      flex-shrink: 0;
    }

    .topbar-title { font-size: 1.0625rem; font-weight: 600; }

    .preset-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 0.8125rem;
      color: var(--text-secondary);
    }

    .preset-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success); }
    .preset-dot.inactive { background: var(--text-muted); }

    .content { flex: 1; overflow-y: auto; padding: 24px; }
    .content::-webkit-scrollbar { width: 6px; }
    .content::-webkit-scrollbar-track { background: transparent; }
    .content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

    /* ── Sections ────────────────────────────────────────────────────────────── */
    .section { display: none; }
    .section.active { display: block; }

    .section-title { font-size: 1.25rem; font-weight: 600; margin-bottom: 6px; }
    .section-sub { font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 24px; }

    /* ── Cards ───────────────────────────────────────────────────────────────── */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
      backdrop-filter: var(--blur);
    }

    .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }

    .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }

    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      text-align: center;
    }

    .stat-value { font-size: 2rem; font-weight: 700; color: var(--accent-hover); }
    .stat-label {
      font-size: 0.75rem;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 4px;
    }

    .preset-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
      transition: all 250ms ease;
    }

    .preset-card:hover { border-color: rgba(99,102,241,0.3); background: rgba(99,102,241,0.06); }
    .preset-card.loaded { border-color: rgba(99,102,241,0.5); background: rgba(99,102,241,0.08); }

    .preset-name { font-size: 1rem; font-weight: 600; margin-bottom: 4px; }
    .preset-desc { font-size: 0.8125rem; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.4; }

    .tag-list { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
    .tag {
      padding: 2px 8px;
      background: rgba(255,255,255,0.06);
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 0.6875rem;
      color: var(--text-secondary);
    }

    .preset-meta { display: flex; gap: 12px; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 14px; }

    /* ── Buttons ─────────────────────────────────────────────────────────────── */
    .btn {
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: all 150ms ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: inherit;
    }

    .btn-primary { background: var(--accent); color: #fff; }
    .btn-primary:hover { background: var(--accent-hover); }

    .btn-ghost {
      background: rgba(255,255,255,0.06);
      color: var(--text);
      border: 1px solid var(--border);
    }
    .btn-ghost:hover { background: rgba(255,255,255,0.1); }

    .btn-sm { padding: 5px 10px; font-size: 0.8125rem; border-radius: 6px; }
    .btn-success { background: rgba(34,197,94,0.15); color: var(--success); border: 1px solid rgba(34,197,94,0.25); }

    /* ── Forms ───────────────────────────────────────────────────────────────── */
    .form-group { margin-bottom: 16px; }

    label {
      display: block;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--text-secondary);
      margin-bottom: 6px;
    }

    input, select, textarea {
      width: 100%;
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-size: 0.875rem;
      padding: 9px 12px;
      transition: border 150ms ease;
      font-family: inherit;
    }

    input:focus, select:focus, textarea:focus { outline: none; border-color: rgba(99,102,241,0.5); }

    textarea {
      resize: vertical;
      min-height: 180px;
      font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 0.8125rem;
      line-height: 1.6;
    }

    select option { background: #1a1f2e; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

    /* ── Token visualizations ────────────────────────────────────────────────── */
    .token-section { margin-bottom: 16px; }

    .token-section-title {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-secondary);
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }

    .color-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }

    .color-swatch { border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
    .swatch-color { height: 48px; }
    .swatch-info { padding: 6px 8px; background: rgba(255,255,255,0.03); }
    .swatch-name { font-size: 0.6875rem; color: var(--text-secondary); text-transform: capitalize; }
    .swatch-value { font-size: 0.6875rem; color: var(--text-muted); font-family: monospace; margin-top: 2px; word-break: break-all; }

    .token-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      font-size: 0.8125rem;
    }

    .token-key { color: var(--text-secondary); }
    .token-val { color: var(--accent-hover); font-family: monospace; font-size: 0.75rem; }

    /* ── Score ───────────────────────────────────────────────────────────────── */
    .score-container { margin-bottom: 20px; }
    .score-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .score-label { font-size: 0.875rem; color: var(--text-secondary); }
    .score-value { font-size: 1.5rem; font-weight: 700; }
    .score-bar { height: 8px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden; }
    .score-fill { height: 100%; border-radius: 4px; transition: width 500ms ease; }

    /* ── Issues ──────────────────────────────────────────────────────────────── */
    .issue-list { display: flex; flex-direction: column; gap: 8px; }

    .issue-item {
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.8125rem;
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }

    .issue-error   { background: rgba(239,68,68,0.08);  border: 1px solid rgba(239,68,68,0.2);  }
    .issue-warning { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); }
    .issue-info    { background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2); }

    .issue-icon { font-size: 0.875rem; flex-shrink: 0; margin-top: 1px; }
    .issue-rule { font-weight: 600; margin-bottom: 2px; }
    .issue-msg  { color: var(--text-secondary); line-height: 1.4; }
    .issue-fix  { color: var(--text-muted); font-size: 0.75rem; margin-top: 4px; }

    /* ── Code output ─────────────────────────────────────────────────────────── */
    .code-output {
      background: rgba(0,0,0,0.3);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.8125rem;
      line-height: 1.6;
      overflow: auto;
      max-height: 400px;
      white-space: pre;
      color: var(--text-secondary);
    }

    /* ── Format tabs ─────────────────────────────────────────────────────────── */
    .tab-group {
      display: flex;
      gap: 4px;
      margin-bottom: 16px;
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 4px;
    }

    .tab-btn {
      padding: 7px 14px;
      border-radius: 7px;
      border: none;
      background: none;
      color: var(--text-secondary);
      font-size: 0.8125rem;
      cursor: pointer;
      transition: all 150ms ease;
      font-family: inherit;
    }

    .tab-btn.active { background: rgba(99,102,241,0.2); color: var(--accent-hover); }

    /* ── Alert ───────────────────────────────────────────────────────────────── */
    .alert { padding: 10px 14px; border-radius: 8px; font-size: 0.8125rem; margin-bottom: 16px; display: none; }
    .alert.show { display: flex; align-items: center; gap: 8px; }
    .alert-success { background: rgba(34,197,94,0.1);  border: 1px solid rgba(34,197,94,0.25);  color: var(--success); }
    .alert-error   { background: rgba(239,68,68,0.1);  border: 1px solid rgba(239,68,68,0.25);  color: var(--danger);  }

    /* ── Spinner ─────────────────────────────────────────────────────────────── */
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner {
      width: 20px; height: 20px;
      border: 2px solid rgba(255,255,255,0.1);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      display: inline-block;
    }

    /* ── Empty state ─────────────────────────────────────────────────────────── */
    .empty-state { text-align: center; padding: 40px 20px; color: var(--text-muted); }
    .empty-icon { font-size: 2.5rem; margin-bottom: 12px; }
    .empty-msg  { font-size: 0.875rem; }

    /* ── Divider ─────────────────────────────────────────────────────────────── */
    .divider { height: 1px; background: var(--border); margin: 20px 0; }

    /* ── Copy button overlay ─────────────────────────────────────────────────── */
    .copy-wrap { position: relative; }
    .copy-btn { position: absolute; top: 8px; right: 8px; padding: 4px 8px; font-size: 0.75rem; }

    /* ── Utility helpers ─────────────────────────────────────────────────────── */
    .flex            { display: flex; }
    .items-center    { align-items: center; }
    .justify-between { justify-content: space-between; }
    .gap-2   { gap: 8px;  }
    .gap-3   { gap: 12px; }
    .mt-1    { margin-top: 4px;    }
    .mt-2    { margin-top: 8px;    }
    .mt-3    { margin-top: 12px;   }
    .mt-4    { margin-top: 16px;   }
    .mb-3    { margin-bottom: 12px; }
    .mb-4    { margin-bottom: 16px; }
    .text-sm { font-size: 0.875rem; }
    .text-xs { font-size: 0.75rem;  }
    .text-muted     { color: var(--text-muted);     }
    .text-secondary { color: var(--text-secondary); }
    .text-accent    { color: var(--accent-hover);   }
    .font-mono      { font-family: 'JetBrains Mono', monospace; }
    .font-semibold  { font-weight: 600; }

    /* ── Style Gallery ───────────────────────────────────────────────────────── */
    .style-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }

    .style-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
      transition: all 250ms ease;
      cursor: pointer;
    }

    .style-card:hover { transform: translateY(-2px); border-color: rgba(99,102,241,0.35); }
    .style-card.loaded { border-color: rgba(99,102,241,0.6); }

    .style-preview {
      height: 90px;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 12px;
    }

    .style-preview-chip {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .style-preview-bar {
      flex: 1;
      height: 6px;
      border-radius: 3px;
      opacity: 0.7;
    }

    .style-preview-text {
      position: absolute;
      bottom: 8px;
      left: 12px;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      opacity: 0.5;
    }

    .style-info { padding: 14px 16px; }
    .style-name { font-size: 0.9375rem; font-weight: 600; margin-bottom: 4px; }
    .style-desc { font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 10px; line-height: 1.45; }

    .principle-list { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px; }
    .principle-tag {
      padding: 2px 7px;
      background: rgba(99,102,241,0.1);
      border: 1px solid rgba(99,102,241,0.2);
      border-radius: 4px;
      font-size: 0.625rem;
      color: var(--text-secondary);
      font-family: 'JetBrains Mono', monospace;
    }

    /* ── Palette Generator ───────────────────────────────────────────────────── */
    .palette-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 8px; margin-top: 16px; }

    .palette-swatch {
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid var(--border);
    }

    .palette-color { height: 56px; }

    .palette-info {
      padding: 6px 8px;
      background: rgba(255,255,255,0.03);
    }

    .palette-name { font-size: 0.625rem; color: var(--text-secondary); text-transform: capitalize; margin-bottom: 2px; }
    .palette-hex  { font-size: 0.625rem; color: var(--text-muted); font-family: monospace; }

    .palette-shade-strip {
      display: flex;
      border-radius: 10px;
      overflow: hidden;
      height: 40px;
      margin-top: 12px;
      border: 1px solid var(--border);
    }

    .palette-shade-block { flex: 1; position: relative; cursor: pointer; transition: flex 150ms ease; }
    .palette-shade-block:hover { flex: 2; }
    .palette-shade-label {
      position: absolute;
      bottom: 4px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 0.5rem;
      font-weight: 700;
      opacity: 0.7;
      pointer-events: none;
    }

    .harmony-select-group {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }

    .harmony-btn {
      padding: 6px 12px;
      border-radius: 8px;
    /* ── Category badge ──────────────────────────────────────────────────────── */
    .category-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .cat-shell      { background: rgba(99,102,241,0.15); color: #818cf8; }
    .cat-surface    { background: rgba(14,165,233,0.15);  color: #38bdf8; }
    .cat-settings   { background: rgba(245,158,11,0.15);  color: #fbbf24; }
    .cat-navigation { background: rgba(34,197,94,0.15);   color: #4ade80; }
    .cat-data       { background: rgba(236,72,153,0.15);  color: #f472b6; }
    .cat-feedback   { background: rgba(168,85,247,0.15);  color: #c084fc; }

    /* ── Component cards ─────────────────────────────────────────────────────── */
    .component-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
      transition: all 200ms ease;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .component-card:hover { border-color: rgba(99,102,241,0.3); }
    .component-name { font-size: 0.9375rem; font-weight: 600; }
    .component-desc { font-size: 0.8125rem; color: var(--text-secondary); line-height: 1.4; flex: 1; }
    .component-variants { font-size: 0.75rem; color: var(--text-muted); }

    /* ── Category filter ─────────────────────────────────────────────────────── */
    .filter-group { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 20px; }
    .filter-btn {
      padding: 5px 12px;
      border-radius: 20px;
      border: 1px solid var(--border);
      background: none;
      color: var(--text-secondary);
      font-size: 0.8125rem;
      cursor: pointer;
      transition: all 150ms ease;
      font-family: inherit;
    }

    .harmony-btn.active {
      background: rgba(99,102,241,0.15);
      border-color: rgba(99,102,241,0.35);
      color: var(--accent-hover);
    }
    .filter-btn.active { background: rgba(99,102,241,0.15); color: var(--accent-hover); border-color: rgba(99,102,241,0.3); }
    .filter-btn:hover  { background: rgba(255,255,255,0.05); color: var(--text); }

    /* ── Visualizer ──────────────────────────────────────────────────────────── */
    .viz-select-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    .viz-props { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    .viz-prop-row { display: flex; flex-direction: column; gap: 4px; }
    .viz-prop-label { font-size: 0.75rem; color: var(--text-secondary); font-weight: 500; }
    .viz-prop-input {
      width: 100%;
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      font-size: 0.8125rem;
      padding: 6px 10px;
      font-family: inherit;
    }
    .viz-prop-input:focus { outline: none; border-color: rgba(99,102,241,0.5); }
  </style>
</head>
<body>
  <div class="app">

    <!-- ── Sidebar ──────────────────────────────────────────────────────────── -->
    <nav class="sidebar">
      <div class="sidebar-logo">
        <div class="logo-icon">⬡</div>
        <div>
          <div class="logo-text">OG Glass</div>
          <div class="logo-sub">Design Studio</div>
        </div>
      </div>

      <button class="nav-item active" data-section="dashboard">
        <span class="nav-icon">📊</span> Dashboard
      </button>
      <button class="nav-item" data-section="presets">
        <span class="nav-icon">🎨</span> Presets
      </button>
      <button class="nav-item" data-section="gallery">
        <span class="nav-icon">✦</span> Style Gallery
      </button>
      <button class="nav-item" data-section="palette">
        <span class="nav-icon">⬡</span> Palette
      </button>
      <button class="nav-item" data-section="tokens">
        <span class="nav-icon">🔵</span> Tokens
      </button>
      <button class="nav-item" data-section="validate">
        <span class="nav-icon">✓</span> Validate
      </button>
      <button class="nav-item" data-section="correct">
        <span class="nav-icon">🔧</span> Correct
      </button>
      <button class="nav-item" data-section="export">
        <span class="nav-icon">📦</span> Export
      </button>
      <button class="nav-item" data-section="scaffold">
        <span class="nav-icon">⊕</span> Scaffold
      </button>
      <button class="nav-item" data-section="components">
        <span class="nav-icon">🧩</span> Components
      </button>
      <button class="nav-item" data-section="visualizer">
        <span class="nav-icon">👁</span> Visualizer
      </button>

      <div class="sidebar-footer">
        <div class="text-xs text-muted" style="padding:8px 12px;">UI Preset MCP v1.1.0</div>
      </div>
    </nav>

    <!-- ── Main ─────────────────────────────────────────────────────────────── -->
    <div class="main">
      <div class="topbar">
        <span class="topbar-title" id="pageTitle">Dashboard</span>
        <div class="preset-badge">
          <div class="preset-dot inactive" id="presetDot"></div>
          <span id="presetLabel">No preset loaded</span>
        </div>
      </div>

      <div class="content">

        <!-- Dashboard ──────────────────────────────────────────────────────── -->
        <div class="section active" id="sect-dashboard">
          <div class="section-title">Design Dashboard</div>
          <div class="section-sub">Overview of your active preset and quick actions.</div>
          <div id="dashboardContent">
            <div class="empty-state">
              <div class="empty-icon">🎨</div>
              <div class="empty-msg">No preset loaded. Go to <strong>Presets</strong> to get started.</div>
            </div>
          </div>
        </div>

        <!-- Presets ────────────────────────────────────────────────────────── -->
        <div class="section" id="sect-presets">
          <div class="section-title">Preset Library</div>
          <div class="section-sub">Browse and activate design presets.</div>
          <div class="card-grid" id="presetGrid">
            <div class="spinner"></div>
          </div>
        </div>

        <!-- Style Gallery ──────────────────────────────────────────────────── -->
        <div class="section" id="sect-gallery">
          <div class="section-title">Style Gallery</div>
          <div class="section-sub">Explore all available design styles and load them instantly. Each style embodies distinct aesthetic principles.</div>
          <div class="style-grid" id="styleGrid">
            <div class="spinner"></div>
          </div>
        </div>

        <!-- Palette Generator ──────────────────────────────────────────────── -->
        <div class="section" id="sect-palette">
          <div class="section-title">Color Palette Generator</div>
          <div class="section-sub">Generate harmonious color palettes using color theory. Apply the result directly to your active preset.</div>
          <div class="card" style="max-width:640px;">
            <div class="form-row mb-4">
              <div class="form-group" style="margin-bottom:0">
                <label>Seed Color</label>
                <div class="flex gap-2 items-center">
                  <input id="palettePicker" type="color" value="#6366f1"
                    style="width:40px;height:36px;padding:2px;flex-shrink:0;cursor:pointer;border-radius:6px;">
                  <input id="paletteHex" type="text" placeholder="#6366f1" style="flex:1;">
                </div>
              </div>
              <div class="form-group" style="margin-bottom:0">
                <label>Options</label>
                <div class="flex gap-2 items-center" style="height:36px;">
                  <label style="display:flex;align-items:center;gap:6px;margin:0;color:var(--text-secondary);font-size:0.8125rem;cursor:pointer;">
                    <input type="checkbox" id="paletteShades" checked style="width:auto"> Shades
                  </label>
                </div>
              </div>
            </div>
            <div class="harmony-select-group" id="harmonyGroup">
              <button class="harmony-btn active" data-harmony="complementary">Complementary</button>
              <button class="harmony-btn" data-harmony="triadic">Triadic</button>
              <button class="harmony-btn" data-harmony="analogous">Analogous</button>
              <button class="harmony-btn" data-harmony="monochromatic">Monochromatic</button>
              <button class="harmony-btn" data-harmony="split-complementary">Split Compl.</button>
              <button class="harmony-btn" data-harmony="tetradic">Tetradic</button>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-primary" id="paletteGenBtn">
                <span>⬡</span> Generate Palette
              </button>
              <button class="btn btn-ghost btn-sm" id="paletteApplyBtn" style="display:none">
                Apply to Preset
              </button>
            </div>
          </div>
          <div id="paletteResult" class="mt-4"></div>
        </div>

        <!-- Tokens ─────────────────────────────────────────────────────────── -->
        <div class="section" id="sect-tokens">
          <div class="section-title">Design Tokens</div>
          <div class="section-sub">Visual preview of the active preset's token system.</div>
          <div id="tokenContent">
            <div class="empty-state">
              <div class="empty-icon">🔵</div>
              <div class="empty-msg">Load a preset to view its tokens.</div>
            </div>
          </div>
        </div>

        <!-- Validate ───────────────────────────────────────────────────────── -->
        <div class="section" id="sect-validate">
          <div class="section-title">Validate Component</div>
          <div class="section-sub">Check a React component against the active preset rules.</div>
          <div class="card">
            <div class="form-group">
              <label>React Component Code</label>
              <textarea id="validateCode" placeholder="Paste your React component code here..."></textarea>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-primary" id="validateBtn">
                <span>✓</span> Validate
              </button>
              <button class="btn btn-ghost btn-sm" id="validateClear">Clear</button>
            </div>
          </div>
          <div class="mt-4" id="validateResult"></div>
        </div>

        <!-- Correct ────────────────────────────────────────────────────────── -->
        <div class="section" id="sect-correct">
          <div class="section-title">Autocorrect Component</div>
          <div class="section-sub">Auto-fix a React component against the active preset rules.</div>
          <div class="card">
            <div class="form-row mb-4">
              <div class="form-group" style="margin-bottom:0">
                <label>Context</label>
                <select id="correctContext">
                  <option value="auto">Auto-detect</option>
                  <option value="sidebar">Sidebar</option>
                  <option value="settings">Settings</option>
                  <option value="dashboard">Dashboard</option>
                  <option value="surface">Surface</option>
                  <option value="navigation">Navigation</option>
                  <option value="form">Form</option>
                </select>
              </div>
              <div class="form-group" style="margin-bottom:0">
                <label>Mode</label>
                <select id="correctMode">
                  <option value="correct">Apply corrections</option>
                  <option value="dry">Dry run (issues only)</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>React Component Code</label>
              <textarea id="correctCode" placeholder="Paste your React component code here..."></textarea>
            </div>
            <button class="btn btn-primary" id="correctBtn">
              <span>🔧</span> Run Correction
            </button>
          </div>
          <div class="mt-4" id="correctResult"></div>
        </div>

        <!-- Export ─────────────────────────────────────────────────────────── -->
        <div class="section" id="sect-export">
          <div class="section-title">Export Tokens</div>
          <div class="section-sub">Generate token files for your project in various formats.</div>
          <div class="card">
            <div class="tab-group">
              <button class="tab-btn active" data-format="css">CSS Vars</button>
              <button class="tab-btn" data-format="js">TypeScript</button>
              <button class="tab-btn" data-format="json">JSON</button>
              <button class="tab-btn" data-format="tailwind">Tailwind</button>
            </div>
            <button class="btn btn-primary mb-4" id="exportBtn">
              <span>📦</span> Generate
            </button>
            <div class="copy-wrap">
              <div class="code-output" id="exportOutput">Select a format and click Generate to export tokens.</div>
              <button class="btn btn-ghost btn-sm copy-btn" id="exportCopyBtn">Copy</button>
            </div>
          </div>
        </div>

        <!-- Scaffold ───────────────────────────────────────────────────────── -->
        <div class="section" id="sect-scaffold">
          <div class="section-title">Scaffold Preset</div>
          <div class="section-sub">Create a new preset directory from an existing parent.</div>
          <div class="card" style="max-width:560px;">
            <div id="scaffoldAlert"></div>
            <div class="form-row">
              <div class="form-group">
                <label>Preset ID <span class="text-muted">(kebab-case)</span></label>
                <input id="scaffoldId" type="text" placeholder="client-mybrand">
              </div>
              <div class="form-group">
                <label>Display Name</label>
                <input id="scaffoldName" type="text" placeholder="My Brand">
              </div>
            </div>
            <div class="form-group">
              <label>Description</label>
              <input id="scaffoldDesc" type="text" placeholder="Short description of this preset">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Extends (parent preset)</label>
                <select id="scaffoldExtends"></select>
              </div>
              <div class="form-group">
                <label>Accent Color <span class="text-muted">(optional)</span></label>
                <div class="flex gap-2 items-center">
                  <input id="scaffoldAccentColor" type="color" value="#6366f1"
                    style="width:40px;height:36px;padding:2px;flex-shrink:0;cursor:pointer;border-radius:6px;">
                  <input id="scaffoldAccentHex" type="text" placeholder="#6366f1" style="flex:1;">
                </div>
              </div>
            </div>
            <button class="btn btn-primary" id="scaffoldBtn">
              <span>⊕</span> Create Preset
            </button>
          </div>
        </div>

        <!-- Components ─────────────────────────────────────────────────────── -->
        <div class="section" id="sect-components">
          <div class="section-title">Component Library</div>
          <div class="section-sub">Browse components by category. Menu populates from the active preset's asset folders.</div>
          <div id="componentsContent">
            <div class="empty-state">
              <div class="empty-icon">🧩</div>
              <div class="empty-msg">Load a preset to browse its components.</div>
            </div>
          </div>
        </div>

        <!-- Visualizer ─────────────────────────────────────────────────────── -->
        <div class="section" id="sect-visualizer">
          <div class="section-title">IDE Component Visualizer</div>
          <div class="section-sub">Preview and generate component code from the active preset's asset library.</div>
          <div id="vizContent">
            <div class="empty-state">
              <div class="empty-icon">👁</div>
              <div class="empty-msg">Load a preset to use the visualizer.</div>
            </div>
          </div>
        </div>

      </div><!-- /.content -->
    </div><!-- /.main -->
  </div><!-- /.app -->

  <script>
    // ── State ──────────────────────────────────────────────────────────────────
    let currentSection = 'dashboard';
    let currentFormat  = 'css';
    let allPresets     = [];
    let session        = { activePresetId: null, hasOverrides: false, overrideKeys: [] };

    const SECTION_TITLES = {
      dashboard: 'Dashboard',
      presets:   'Preset Library',
      gallery:   'Style Gallery',
      palette:   'Palette Generator',
      tokens:    'Design Tokens',
      validate:  'Validate Component',
      correct:   'Autocorrect Component',
      export:    'Export Tokens',
      scaffold:  'Scaffold Preset',
      dashboard:   'Dashboard',
      presets:     'Preset Library',
      tokens:      'Design Tokens',
      validate:    'Validate Component',
      correct:     'Autocorrect Component',
      export:      'Export Tokens',
      scaffold:    'Scaffold Preset',
      components:  'Component Library',
      visualizer:  'IDE Visualizer',
    };

    // ── Navigation ─────────────────────────────────────────────────────────────
    function navigate(section) {
      document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

      const sEl = document.getElementById('sect-' + section);
      if (!sEl) return;
      sEl.classList.add('active');

      document.querySelectorAll('.nav-item').forEach(el => {
        if (el.dataset.section === section) el.classList.add('active');
      });

      document.getElementById('pageTitle').textContent = SECTION_TITLES[section] || section;
      currentSection = section;

      if (section === 'presets')  loadPresetsSection();
      if (section === 'gallery')  loadStyleGallery();
      if (section === 'palette')  initPaletteSection();
      if (section === 'tokens')   loadTokensSection();
      if (section === 'scaffold') loadScaffoldSection();
      if (section === 'components')  loadComponentsSection();
      if (section === 'visualizer')  loadVisualizerSection();
    }

    document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.section));
    });

    // ── API helpers ────────────────────────────────────────────────────────────
    async function api(method, path, body) {
      const opts = { method, headers: { 'Content-Type': 'application/json' } };
      if (body !== undefined) opts.body = JSON.stringify(body);

      let res;
      try {
        res = await fetch(path, opts);
      } catch (err) {
        const networkError = new Error('Network error while calling API');
        // Attach original error for debugging
        networkError.cause = err;
        throw networkError;
      }

      let text = '';
      try {
        text = await res.text();
      } catch (_) {
        // Ignore body read errors; we'll still surface status below.
      }

      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (_) {
          // Non-JSON response; leave data as null and keep raw text.
        }
      }

      if (!res.ok) {
        const serverMessage =
          (data && (data.error || data.message)) ||
          res.statusText ||
          'Request failed';
        const error = new Error(serverMessage);
        error.status = res.status;
        error.body = data !== null ? data : text;
        throw error;
      }

      // Prefer parsed JSON when available; otherwise fall back to raw text.
      return data !== null ? data : text;
    }

    // ── Session polling ────────────────────────────────────────────────────────
    async function refreshSession() {
      try {
        session = await api('GET', '/api/session');
        const dot   = document.getElementById('presetDot');
        const label = document.getElementById('presetLabel');
        if (session.activePresetId) {
          dot.classList.remove('inactive');
          label.textContent = session.activePresetId;
        } else {
          dot.classList.add('inactive');
          label.textContent = 'No preset loaded';
        }
        if (currentSection === 'dashboard') updateDashboard();
      } catch (_) { /* server not ready yet */ }
    }

    // ── Dashboard ──────────────────────────────────────────────────────────────
    async function updateDashboard() {
      const el = document.getElementById('dashboardContent');
      if (!session.activePresetId) {
        el.innerHTML = '<div class="empty-state"><div class="empty-icon">🎨</div><div class="empty-msg">No preset loaded. Go to <strong>Presets</strong> to get started.</div></div>';
        return;
      }
      try {
        const tokens = await api('GET', '/api/tokens');
        const preset = allPresets.find(p => p.id === session.activePresetId) || { id: session.activePresetId, name: session.activePresetId, components: [], layouts: [], tags: [], version: '—' };
        el.innerHTML = '';

        // Stat cards
        const stats = document.createElement('div');
        stats.className = 'stat-grid';
        stats.innerHTML =
          '<div class="stat-card"><div class="stat-value">' + esc(preset.components?.length ?? '—') + '</div><div class="stat-label">Components</div></div>' +
          '<div class="stat-card"><div class="stat-value">' + esc(preset.layouts?.length ?? '—') + '</div><div class="stat-label">Layouts</div></div>' +
          '<div class="stat-card"><div class="stat-value">' + esc(preset.version ?? '1.0.0') + '</div><div class="stat-label">Version</div></div>';
        el.appendChild(stats);

        // Info card
        const info = document.createElement('div');
        info.className = 'card mb-4';
        info.innerHTML =
          '<div class="flex justify-between items-center mb-3">' +
            '<div>' +
              '<div class="preset-name">' + esc(preset.name || session.activePresetId) + '</div>' +
              '<div class="text-sm text-secondary mt-1">' + esc(preset.description || '') + '</div>' +
            '</div>' +
            '<div class="tag-list" style="margin:0">' + (preset.tags || []).map(t => '<span class="tag">' + esc(t) + '</span>').join('') + '</div>' +
          '</div>' +
          (preset.extends ? '<div class="text-xs text-muted">Extends: <span class="text-accent font-mono">' + esc(preset.extends) + '</span></div>' : '') +
          (session.hasOverrides ? '<div class="text-xs text-muted mt-1">&#x26A1; Runtime overrides: <span class="font-mono">' + esc((session.overrideKeys || []).join(', ')) + '</span></div>' : '');
        el.appendChild(info);

        // Color palette preview
        const colors = document.createElement('div');
        colors.className = 'card';
        colors.innerHTML = '<div class="token-section-title">Color Palette Preview</div>';
        const cg = document.createElement('div');
        cg.className = 'color-grid';

        const baseColors = flattenColorObj(tokens.colors?.base, 'base');
        const accentColors = flattenColorObj(tokens.colors?.accent, 'accent');
        const glassColors = flattenColorObj(tokens.colors?.glass, 'glass');
        const combined = { ...baseColors, ...accentColors, ...glassColors };

        for (const [name, val] of Object.entries(combined).slice(0, 12)) {
          const sw = document.createElement('div');
          sw.className = 'color-swatch';

          const swatchColor = document.createElement('div');
          swatchColor.className = 'swatch-color';
          const colorString = String(val);
          // Allow only typical color formats: hex, rgb[a], hsl[a]
          if (
            /^#([0-9a-fA-F]{3,8})$/.test(colorString) ||
            /^rgba?\\(/i.test(colorString) ||
            /^hsla?\\(/i.test(colorString)
          ) {
            swatchColor.style.background = colorString;
          }

          const info = document.createElement('div');
          info.className = 'swatch-info';

          const nameEl = document.createElement('div');
          nameEl.className = 'swatch-name';
          nameEl.textContent = name;

          const valueEl = document.createElement('div');
          valueEl.className = 'swatch-value';
          valueEl.textContent = colorString;

          info.appendChild(nameEl);
          info.appendChild(valueEl);

          sw.appendChild(swatchColor);
          sw.appendChild(info);
          cg.appendChild(sw);
        }
        colors.appendChild(cg);
        el.appendChild(colors);

      } catch (err) {
        el.innerHTML = '<div class="alert alert-error show">Failed to load dashboard: ' + esc(String(err)) + '</div>';
      }
    }

    function flattenColorObj(obj, prefix) {
      if (!obj) return {};
      const result = {};
      for (const [k, v] of Object.entries(obj)) result[prefix + '.' + k] = v;
      return result;
    }

    // ── Presets ────────────────────────────────────────────────────────────────
    async function loadPresetsSection() {
      const grid = document.getElementById('presetGrid');
      grid.innerHTML = '<div class="spinner"></div>';
      try {
        const data = await api('GET', '/api/presets');
        allPresets = data.presets || [];
        grid.innerHTML = '';
        for (const p of allPresets) {
          const card = document.createElement('div');
          card.className = 'preset-card' + (p.id === session.activePresetId ? ' loaded' : '');
          card.innerHTML =
            '<div class="preset-name">' + esc(p.name || p.id) + '</div>' +
            '<div class="preset-desc">' + esc(p.description || '') + '</div>' +
            '<div class="tag-list">' + (p.tags || []).map(t => '<span class="tag">' + esc(t) + '</span>').join('') + '</div>' +
            '<div class="preset-meta">' +
              '<span>v' + esc(p.version || '1.0.0') + '</span>' +
              (p.extends ? '<span>&#x2B21; ' + esc(p.extends) + '</span>' : '') +
              (p.components?.length ? '<span>' + esc(String(p.components.length)) + ' components</span>' : '') +
            '</div>' +
            '<button class="btn btn-primary btn-sm load-preset-btn" data-id="' + escAttr(p.id) + '">' +
              (p.id === session.activePresetId ? '&#x2713; Loaded' : '&#x25BA; Load') +
            '</button>';
          grid.appendChild(card);
        }
        grid.querySelectorAll('.load-preset-btn').forEach(btn => {
          btn.addEventListener('click', () => loadPreset(btn.dataset.id));
        });
      } catch (err) {
        grid.innerHTML = '<div class="alert alert-error show">Failed to load presets: ' + esc(String(err)) + '</div>';
      }
    }

    async function loadPreset(presetId) {
      try {
        const result = await api('POST', '/api/presets/load', { preset_id: presetId });
        if (result.error) throw new Error(result.error);
        await refreshSession();
        loadPresetsSection();
        stylesLoaded = false;
        navigate('dashboard');
      } catch (err) {
        alert('Failed to load preset: ' + String(err.message || err));
      }
    }

    // ── Style Gallery ──────────────────────────────────────────────────────────
    let stylesLoaded = false;

    // Per-category visual preview config
    const STYLE_VISUALS = {
      glassmorphic: { bg: '#0a0d14', chip1: '#6366f1', chip2: '#0ea5e9', chip3: 'rgba(255,255,255,0.12)', text: 'rgba(255,255,255,0.6)' },
      neumorphic:   { bg: '#e0e5ec', chip1: '#6c63ff', chip2: '#43b89c', chip3: 'rgba(255,255,255,0.9)',  text: 'rgba(50,60,90,0.5)' },
      cyberpunk:    { bg: '#050510', chip1: '#00ff88', chip2: '#ff00aa', chip3: 'rgba(0,255,136,0.2)',    text: 'rgba(0,255,136,0.5)' },
      brutalist:    { bg: '#ffffff', chip1: '#000000', chip2: '#ff0000', chip3: 'rgba(0,0,0,0.08)',       text: 'rgba(0,0,0,0.4)' },
      pastel:       { bg: '#fef7ff', chip1: '#c084fc', chip2: '#f9a8d4', chip3: 'rgba(192,132,252,0.2)',  text: 'rgba(74,29,150,0.4)' },
      aurora:       { bg: '#04081a', chip1: '#a78bfa', chip2: '#34d399', chip3: 'rgba(167,139,250,0.15)', text: 'rgba(196,181,253,0.5)' },
    };

    async function loadStyleGallery() {
      if (stylesLoaded) return;
      const grid = document.getElementById('styleGrid');
      grid.innerHTML = '<div class="spinner"></div>';
      try {
        const data = await api('GET', '/api/styles');
        const cats = data.categories || [];

        // Also fetch all presets to match preset IDs
        if (!allPresets.length) {
          const pd = await api('GET', '/api/presets');
          allPresets = pd.presets || [];
        }

        grid.innerHTML = '';

        for (const cat of cats) {
          const vis = STYLE_VISUALS[cat.id] || STYLE_VISUALS.glassmorphic;
          const presetId = (cat.presets || [])[0] || '';

          const card = document.createElement('div');
          card.className = 'style-card' + (presetId === session.activePresetId ? ' loaded' : '');

          // Visual preview strip
          const preview = document.createElement('div');
          preview.className = 'style-preview';
          preview.style.background = vis.bg;

          // Color chips
          [vis.chip1, vis.chip2, vis.chip3].forEach(c => {
            const chip = document.createElement('div');
            chip.className = 'style-preview-chip';
            chip.style.background = c;
            if (cat.id === 'brutalist') chip.style.borderRadius = '0';
            preview.appendChild(chip);
          });

          // Bar
          const bar = document.createElement('div');
          bar.className = 'style-preview-bar';
          bar.style.background = 'linear-gradient(90deg, ' + vis.chip1 + ', ' + vis.chip2 + ')';
          preview.appendChild(bar);

          const txtLbl = document.createElement('div');
          txtLbl.className = 'style-preview-text';
          txtLbl.style.color = vis.text;
          txtLbl.textContent = cat.name.toUpperCase();
          preview.appendChild(txtLbl);

          card.appendChild(preview);

          // Info
          const info = document.createElement('div');
          info.className = 'style-info';
          info.innerHTML =
            '<div class="style-name">' + esc(cat.name) + '</div>' +
            '<div class="style-desc">' + esc(cat.description) + '</div>' +
            '<div class="principle-list">' +
              (cat.principles || []).slice(0, 4).map(p => '<span class="principle-tag">' + esc(p) + '</span>').join('') +
            '</div>' +
            (presetId ? '<button class="btn btn-primary btn-sm load-style-btn" data-id="' + escAttr(presetId) + '">' +
              (presetId === session.activePresetId ? '&#x2713; Loaded' : '&#x25BA; Load ' + esc(presetId)) +
            '</button>' : '');
          card.appendChild(info);
          grid.appendChild(card);
        }

        grid.querySelectorAll('.load-style-btn').forEach(btn => {
          btn.addEventListener('click', () => loadPreset(btn.dataset.id));
        });

        stylesLoaded = true;
      } catch (err) {
        grid.innerHTML = '<div class="alert alert-error show">Failed to load styles: ' + esc(String(err)) + '</div>';
      }
    }

    // ── Palette Generator ──────────────────────────────────────────────────────
    let currentHarmony  = 'complementary';
    let lastPaletteData = null;

    function initPaletteSection() {
      const picker = document.getElementById('palettePicker');
      const hex    = document.getElementById('paletteHex');
      if (hex.dataset.initialized) return;
      hex.dataset.initialized = '1';
      picker.addEventListener('input', () => { hex.value = picker.value; });
      hex.addEventListener('input', () => {
        if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) picker.value = hex.value;
      });
      hex.value = picker.value;
    }

    document.querySelectorAll('.harmony-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentHarmony = btn.dataset.harmony;
        document.querySelectorAll('.harmony-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    document.getElementById('paletteGenBtn').addEventListener('click', async () => {
      const seedColor  = document.getElementById('paletteHex').value.trim() || document.getElementById('palettePicker').value;
      const inclShades = document.getElementById('paletteShades').checked;
      const resultEl   = document.getElementById('paletteResult');

      if (!/^#[0-9a-fA-F]{6}$/.test(seedColor)) {
        resultEl.innerHTML = '<div class="alert alert-error show">Enter a valid hex color (e.g. #6366f1).</div>';
        return;
      }
      resultEl.innerHTML = '<div class="spinner"></div>';
      try {
        const data = await api('POST', '/api/palette', {
          seed_color: seedColor,
          harmony:    currentHarmony,
          include_shades: inclShades,
        });
        lastPaletteData = data;
        resultEl.innerHTML = '';
        renderPaletteResult(resultEl, data);
        document.getElementById('paletteApplyBtn').style.display = session.activePresetId ? '' : 'none';
      } catch (err) {
        resultEl.innerHTML = '<div class="alert alert-error show">Error: ' + esc(String(err)) + '</div>';
      }
    });

    document.getElementById('paletteApplyBtn').addEventListener('click', async () => {
      if (!lastPaletteData || !session.activePresetId) return;
      const colors = lastPaletteData.colors || {};
      const primary = colors.primary || lastPaletteData.seed;
      const secondary = colors.complement || colors.secondary || colors.right || primary;
      try {
        await api('POST', '/api/tokens/overrides', {
          overrides: {
            colors: {
              accent: {
                primary,
                primaryHover: lastPaletteData.semantic?.foreground || primary,
                secondary,
              }
            }
          }
        });
        await refreshSession();
        const btn = document.getElementById('paletteApplyBtn');
        const orig = btn.textContent;
        btn.textContent = '✓ Applied!';
        btn.classList.add('btn-success');
        setTimeout(() => { btn.textContent = orig; btn.classList.remove('btn-success'); }, 2000);
      } catch (err) {
        alert('Failed to apply: ' + String(err.message || err));
      }
    });

    function renderPaletteResult(container, data) {
      const card = document.createElement('div');
      card.className = 'card';

      // Header
      card.innerHTML =
        '<div class="flex justify-between items-center mb-3">' +
          '<div>' +
            '<div class="font-semibold">' + esc(data.harmony || '') + ' palette</div>' +
            '<div class="text-xs text-muted mt-1">Seed: <span class="font-mono text-accent">' + esc(data.seed || '') + '</span> &nbsp;·&nbsp; ' +
              'HSL(' + esc(String(data.hsl?.h ?? '')) + '°, ' + esc(String(data.hsl?.s ?? '')) + '%, ' + esc(String(data.hsl?.l ?? '')) + '%)</div>' +
          '</div>' +
        '</div>';

      // Harmony colors
      if (data.colors && Object.keys(data.colors).length) {
        const secTitle = document.createElement('div');
        secTitle.className = 'token-section-title';
        secTitle.textContent = 'Harmony Colors';
        card.appendChild(secTitle);

        const grid = document.createElement('div');
        grid.className = 'palette-grid';
        for (const [name, val] of Object.entries(data.colors)) {
          grid.appendChild(makePaletteSwatch(name, String(val)));
        }
        card.appendChild(grid);
      }

      // Semantic colors
      if (data.semantic && Object.keys(data.semantic).length) {
        const secTitle = document.createElement('div');
        secTitle.className = 'token-section-title mt-4';
        secTitle.textContent = 'Semantic Aliases';
        card.appendChild(secTitle);

        const grid = document.createElement('div');
        grid.className = 'palette-grid';
        for (const [name, val] of Object.entries(data.semantic)) {
          grid.appendChild(makePaletteSwatch(name, String(val)));
        }
        card.appendChild(grid);
      }

      // Shade strip
      if (data.shades && Object.keys(data.shades).length) {
        const secTitle = document.createElement('div');
        secTitle.className = 'token-section-title mt-4';
        secTitle.textContent = 'Shade Scale';
        card.appendChild(secTitle);

        const strip = document.createElement('div');
        strip.className = 'palette-shade-strip';
        for (const [label, val] of Object.entries(data.shades)) {
          const block = document.createElement('div');
          block.className = 'palette-shade-block';
          block.style.background = String(val);
          block.title = label + ': ' + String(val);
          // Determine label text color based on lightness
          const lMatch = String(val).match(/#([0-9a-fA-F]{6})/);
          let textColor = '#fff';
          if (lMatch) {
            const r = parseInt(lMatch[1].slice(0,2),16);
            const g = parseInt(lMatch[1].slice(2,4),16);
            const b = parseInt(lMatch[1].slice(4,6),16);
            const luminance = 0.2126*r + 0.7152*g + 0.0722*b;
            textColor = luminance > 140 ? '#000' : '#fff';
          }
          const lbl = document.createElement('div');
          lbl.className = 'palette-shade-label';
          lbl.style.color = textColor;
          lbl.textContent = label;
          block.appendChild(lbl);
          strip.appendChild(block);
        }
        card.appendChild(strip);
      }

      container.appendChild(card);
    }

    function makePaletteSwatch(name, val) {
      const sw = document.createElement('div');
      sw.className = 'palette-swatch';
      const colorEl = document.createElement('div');
      colorEl.className = 'palette-color';
      if (/^#([0-9a-fA-F]{3,8})$/.test(val) || /^rgba?\\(/i.test(val) || /^hsla?\\(/i.test(val)) {
        colorEl.style.background = val;
      }
      const info = document.createElement('div');
      info.className = 'palette-info';
      const nameEl = document.createElement('div');
      nameEl.className = 'palette-name';
      nameEl.textContent = name;
      const hexEl = document.createElement('div');
      hexEl.className = 'palette-hex';
      hexEl.textContent = val;
      info.appendChild(nameEl);
      info.appendChild(hexEl);
      sw.appendChild(colorEl);
      sw.appendChild(info);
      return sw;
    }

    // ── Tokens ─────────────────────────────────────────────────────────────────
    async function loadTokensSection() {
      const el = document.getElementById('tokenContent');
      if (!session.activePresetId) {
        el.innerHTML = '<div class="empty-state"><div class="empty-icon">🔵</div><div class="empty-msg">Load a preset to view its tokens.</div></div>';
        return;
      }
      el.innerHTML = '<div class="spinner"></div>';
      try {
        const tokens = await api('GET', '/api/tokens');
        el.innerHTML = '';
        renderColorSection(el, 'Base Colors',   tokens.colors?.base);
        renderColorSection(el, 'Accent Colors', tokens.colors?.accent);
        renderColorSection(el, 'Text Colors',   tokens.colors?.text);
        renderColorSection(el, 'Glass Colors',  tokens.colors?.glass);
        renderTypographySection(el, 'Typography Scale', tokens.typography?.scale);
        renderKVSection(el, 'Blur Tokens', buildBlurFlat(tokens.blur));
        renderKVSection(el, 'Animation Duration', tokens.animation?.duration);
        renderKVSection(el, 'Animation Easing',   tokens.animation?.easing);
        renderKVSection(el, 'Sidebar Spacing',    tokens.spacing?.sidebar);
        renderKVSection(el, 'Card Spacing',       tokens.spacing?.card);
      } catch (err) {
        el.innerHTML = '<div class="alert alert-error show">Failed to load tokens: ' + esc(String(err)) + '</div>';
      }
    }

    function buildBlurFlat(blur) {
      if (!blur) return {};
      const { elevation, ...rest } = blur;
      const flat = { ...rest };
      if (elevation) {
        for (const [k, v] of Object.entries(elevation)) flat['elevation.' + k] = v;
      }
      return flat;
    }

    function renderColorSection(parent, title, obj) {
      if (!obj) return;
      const sec = document.createElement('div');
      sec.className = 'token-section card mb-3';
      const titleEl = document.createElement('div');
      titleEl.className = 'token-section-title';
      titleEl.textContent = title;
      sec.appendChild(titleEl);
      const grid = document.createElement('div');
      grid.className = 'color-grid';
      for (const [k, v] of Object.entries(obj)) {
        const sw = document.createElement('div');
        sw.className = 'color-swatch';

        const swatchColor = document.createElement('div');
        swatchColor.className = 'swatch-color';
        const colorString = String(v);
        if (
          /^#([0-9a-fA-F]{3,8})$/.test(colorString) ||
          /^rgba?\\(/i.test(colorString) ||
          /^hsla?\\(/i.test(colorString)
        ) {
          swatchColor.style.background = colorString;
        }

        const info = document.createElement('div');
        info.className = 'swatch-info';
        const nameEl = document.createElement('div');
        nameEl.className = 'swatch-name';
        nameEl.textContent = k;
        const valueEl = document.createElement('div');
        valueEl.className = 'swatch-value';
        valueEl.textContent = colorString;
        info.appendChild(nameEl);
        info.appendChild(valueEl);

        sw.appendChild(swatchColor);
        sw.appendChild(info);
        grid.appendChild(sw);
      }
      sec.appendChild(grid);
      parent.appendChild(sec);
    }

    function renderTypographySection(parent, title, obj) {
      if (!obj) return;
      const sec = document.createElement('div');
      sec.className = 'token-section card mb-3';
      sec.innerHTML = '<div class="token-section-title">' + esc(title) + '</div>';
      for (const [k, v] of Object.entries(obj)) {
        const row = document.createElement('div');
        row.className = 'token-row';
        const preview = document.createElement('span');
        preview.style.fontSize = String(v);
        preview.style.lineHeight = '1';
        preview.style.color = 'rgba(255,255,255,0.9)';
        preview.textContent = 'Aa ' + k;
        const keyEl = document.createElement('span');
        keyEl.className = 'token-key';
        keyEl.textContent = k;
        const valEl = document.createElement('span');
        valEl.className = 'token-val';
        valEl.textContent = String(v);
        row.appendChild(keyEl);
        row.appendChild(preview);
        row.appendChild(valEl);
        sec.appendChild(row);
      }
      parent.appendChild(sec);
    }

    function renderKVSection(parent, title, obj) {
      if (!obj || !Object.keys(obj).length) return;
      const sec = document.createElement('div');
      sec.className = 'token-section card mb-3';
      sec.innerHTML = '<div class="token-section-title">' + esc(title) + '</div>';
      for (const [k, v] of Object.entries(obj)) {
        const row = document.createElement('div');
        row.className = 'token-row';
        row.innerHTML = '<span class="token-key">' + esc(k) + '</span><span class="token-val">' + esc(String(v)) + '</span>';
        sec.appendChild(row);
      }
      parent.appendChild(sec);
    }

    // ── Validate ───────────────────────────────────────────────────────────────
    document.getElementById('validateBtn').addEventListener('click', async () => {
      const code   = document.getElementById('validateCode').value;
      const result = document.getElementById('validateResult');
      if (!code.trim()) {
        result.innerHTML = '<div class="alert alert-error show">Please enter component code.</div>';
        return;
      }
      result.innerHTML = '<div class="spinner"></div>';
      try {
        const data = await api('POST', '/api/validate', { code, include_suggestions: true });
        if (data.error) throw new Error(data.error);
        result.innerHTML = '';
        renderValidationResult(result, data);
      } catch (err) {
        result.innerHTML = '<div class="alert alert-error show">Error: ' + esc(String(err)) + '</div>';
      }
    });

    document.getElementById('validateClear').addEventListener('click', () => {
      document.getElementById('validateCode').value = '';
      document.getElementById('validateResult').innerHTML = '';
    });

    function renderValidationResult(container, data) {
      const score = data.score ?? 0;
      const col = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML =
        '<div class="score-container">' +
          '<div class="score-header">' +
            '<span class="score-label">Conformance Score</span>' +
            '<span class="score-value" style="color:' + col + '">' + esc(String(score)) + '/100</span>' +
          '</div>' +
          '<div class="score-bar"><div class="score-fill" style="width:' + score + '%;background:' + col + '"></div></div>' +
          '<div class="text-xs text-muted mt-2">Preset: <span class="font-mono text-accent">' + esc(data.presetUsed || '') + '</span> &nbsp;·&nbsp; ' + (data.valid ? '✓ Valid' : '✗ Issues found') + '</div>' +
        '</div>' +
        '<div class="divider"></div>' +
        '<div class="issue-list" id="valIssueList"></div>';
      container.appendChild(card);

      const list = document.getElementById('valIssueList');
      if (!data.issues?.length) {
        list.innerHTML = '<div class="text-sm text-secondary">No issues found. 🎉</div>';
        return;
      }
      for (const issue of data.issues) {
        const icon = issue.severity === 'error' ? '✗' : issue.severity === 'warning' ? '⚠' : 'ℹ';
        const item = document.createElement('div');
        item.className = 'issue-item issue-' + issue.severity;
        item.innerHTML =
          '<span class="issue-icon">' + icon + '</span>' +
          '<div>' +
            '<div class="issue-rule">' + esc(issue.rule) + '</div>' +
            '<div class="issue-msg">' + esc(issue.message) + '</div>' +
            (issue.fix ? '<div class="issue-fix">💡 ' + esc(issue.fix) + '</div>' : '') +
          '</div>';
        list.appendChild(item);
      }
    }

    // ── Correct ────────────────────────────────────────────────────────────────
    document.getElementById('correctBtn').addEventListener('click', async () => {
      const code    = document.getElementById('correctCode').value;
      const context = document.getElementById('correctContext').value;
      const mode    = document.getElementById('correctMode').value;
      const result  = document.getElementById('correctResult');
      if (!code.trim()) {
        result.innerHTML = '<div class="alert alert-error show">Please enter component code.</div>';
        return;
      }
      result.innerHTML = '<div class="spinner"></div>';
      try {
        const data = await api('POST', '/api/correct', { code, context, dry_run: mode === 'dry' });
        if (data.error) throw new Error(data.error);
        result.innerHTML = '';
        if (mode === 'dry') { renderValidationResult(result, data); return; }

        const fixCount = data.appliedFixes?.length ?? 0;
        const card = document.createElement('div');
        card.className = 'card';
        const fixLines = (data.appliedFixes || []).map(f => '<div class="text-xs text-secondary mb-1">&#x2713; ' + esc(f) + '</div>').join('');
        card.innerHTML =
          '<div class="flex justify-between items-center mb-3">' +
            '<span class="text-sm text-secondary">' + esc(String(fixCount)) + ' fix' + (fixCount !== 1 ? 'es' : '') + ' applied</span>' +
            '<span class="text-xs font-mono text-accent">' + esc(data.presetUsed || '') + '</span>' +
          '</div>' +
          (fixLines ? '<div class="mb-3">' + fixLines + '</div>' : '') +
          '<div class="divider"></div>' +
          '<div class="flex justify-between items-center mb-2">' +
            '<span class="text-sm">Corrected Code</span>' +
            '<button class="btn btn-ghost btn-sm" id="copyCorrectBtn">Copy</button>' +
          '</div>' +
          '<div class="code-output" id="correctedCode">' + esc(data.corrected || '') + '</div>';
        result.appendChild(card);
        document.getElementById('copyCorrectBtn').addEventListener('click', function() {
          navigator.clipboard.writeText(document.getElementById('correctedCode').textContent || '').then(() => {
            const btn = this;
            btn.textContent = 'Copied!';
            btn.classList.add('btn-success');
            setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('btn-success'); }, 2000);
          });
        });
      } catch (err) {
        result.innerHTML = '<div class="alert alert-error show">Error: ' + esc(String(err)) + '</div>';
      }
    });

    // ── Export ─────────────────────────────────────────────────────────────────
    document.querySelectorAll('.tab-btn[data-format]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentFormat = btn.dataset.format;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    document.getElementById('exportBtn').addEventListener('click', async () => {
      if (!session.activePresetId) {
        document.getElementById('exportOutput').textContent = 'Error: No preset loaded. Load a preset first.';
        return;
      }
      document.getElementById('exportOutput').textContent = 'Generating…';
      try {
        const data = await api('POST', '/api/tokens/export', { format: currentFormat });
        if (data.error) throw new Error(data.error);
        document.getElementById('exportOutput').textContent = data.output || '';
      } catch (err) {
        document.getElementById('exportOutput').textContent = 'Error: ' + String(err);
      }
    });

    document.getElementById('exportCopyBtn').addEventListener('click', function() {
      const text = document.getElementById('exportOutput').textContent || '';
      navigator.clipboard.writeText(text).then(() => {
        const btn = this;
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        btn.classList.add('btn-success');
        setTimeout(() => { btn.textContent = orig; btn.classList.remove('btn-success'); }, 2000);
      });
    });

    // ── Scaffold ───────────────────────────────────────────────────────────────
    async function loadScaffoldSection() {
      const sel = document.getElementById('scaffoldExtends');
      if (sel.options.length > 0) return; // already populated
      try {
        const data = await api('GET', '/api/presets');
        for (const p of (data.presets || [])) {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = p.name || p.id;
          if (p.id === 'glassmorphic-base') opt.selected = true;
          sel.appendChild(opt);
        }
      } catch (_) { /* ignore */ }

      const picker = document.getElementById('scaffoldAccentColor');
      const hex    = document.getElementById('scaffoldAccentHex');
      picker.addEventListener('input', () => { hex.value = picker.value; });
      hex.addEventListener('input', () => {
        if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) picker.value = hex.value;
      });
      hex.value = picker.value;
    }

    document.getElementById('scaffoldBtn').addEventListener('click', async () => {
      const preset_id   = document.getElementById('scaffoldId').value.trim();
      const name        = document.getElementById('scaffoldName').value.trim();
      const description = document.getElementById('scaffoldDesc').value.trim();
      const extendsVal  = document.getElementById('scaffoldExtends').value;
      const accentHex   = document.getElementById('scaffoldAccentHex').value.trim();
      // Only send accent_color when it is a valid 6-digit hex value
      const accent_color = /^#[0-9a-fA-F]{6}$/.test(accentHex) ? accentHex : undefined;
      const alertEl     = document.getElementById('scaffoldAlert');

      alertEl.className = 'alert';
      alertEl.textContent = '';

      if (!preset_id || !name) {
        alertEl.className = 'alert alert-error show';
        alertEl.textContent = 'Preset ID and Name are required.';
        return;
      }
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(preset_id)) {
        alertEl.className = 'alert alert-error show';
        alertEl.textContent = 'Preset ID must be kebab-case (e.g. my-brand).';
        return;
      }
      try {
        const data = await api('POST', '/api/scaffold', {
          preset_id, name, description, extends: extendsVal, accent_color,
        });
        if (data.error) throw new Error(data.error);
        alertEl.className = 'alert alert-success show';
        alertEl.textContent = "✓ Created preset '" + preset_id + "' successfully.";
        document.getElementById('scaffoldId').value   = '';
        document.getElementById('scaffoldName').value = '';
        document.getElementById('scaffoldDesc').value = '';
        allPresets = [];
        // Reset scaffold extends options so it reloads on next visit
        document.getElementById('scaffoldExtends').innerHTML = '';
        // Reset style gallery so it reloads fresh
        stylesLoaded = false;
      } catch (err) {
        alertEl.className = 'alert alert-error show';
        alertEl.textContent = 'Error: ' + String(err.message || err);
      }
    });

    // ── Helpers ────────────────────────────────────────────────────────────────
    function esc(str) {
      return String(str)
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#39;');
    }

    function escAttr(str) { return esc(str); }

    // ── Components ─────────────────────────────────────────────────────────────
    let currentCategoryFilter = 'all';
    let componentsData = [];

    async function loadComponentsSection() {
      const el = document.getElementById('componentsContent');
      if (!session.activePresetId) {
        el.innerHTML = '<div class="empty-state"><div class="empty-icon">🧩</div><div class="empty-msg">Load a preset to browse its components.</div></div>';
        return;
      }
      el.innerHTML = '<div class="spinner"></div>';
      try {
        const data = await api('GET', '/api/components');
        componentsData = data.components || [];
        renderComponentsGrid(el, componentsData, currentCategoryFilter);
      } catch (err) {
        el.innerHTML = '<div class="alert alert-error show">Failed to load components: ' + esc(String(err)) + '</div>';
      }
    }

    function renderComponentsGrid(container, components, filter) {
      container.innerHTML = '';
      const cats = ['all', ...Array.from(new Set(components.map(function(c) { return c.category; })))];

      // Category filter strip
      const fg = document.createElement('div');
      fg.className = 'filter-group';
      cats.forEach(function(cat) {
        const btn = document.createElement('button');
        btn.className = 'filter-btn' + (filter === cat ? ' active' : '');
        btn.textContent = cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1);
        btn.addEventListener('click', function() {
          currentCategoryFilter = cat;
          renderComponentsGrid(container, componentsData, cat);
        });
        fg.appendChild(btn);
      });
      container.appendChild(fg);

      const filtered = filter === 'all' ? components : components.filter(function(c) { return c.category === filter; });

      if (!filtered.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = '<div class="empty-icon">🧩</div><div class="empty-msg">No components in this category.</div>';
        container.appendChild(empty);
        return;
      }

      const grid = document.createElement('div');
      grid.className = 'card-grid';
      filtered.forEach(function(comp) {
        const card = document.createElement('div');
        card.className = 'component-card';
        const catClass = 'cat-' + (comp.category || 'surface');
        card.innerHTML =
          '<div class="flex items-center justify-between">' +
            '<span class="component-name">' + esc(comp.name) + '</span>' +
            '<span class="category-badge ' + escAttr(catClass) + '">' + esc(comp.category || '') + '</span>' +
          '</div>' +
          '<div class="component-desc">' + esc(comp.description || '') + '</div>' +
          (comp.variants && comp.variants.length
            ? '<div class="component-variants">Variants: ' + esc(comp.variants.join(', ')) + '</div>'
            : '') +
          '<div class="flex gap-2 mt-2">' +
            '<button class="btn btn-primary btn-sm viz-from-comp-btn" data-name="' + escAttr(comp.name) + '">&#x1F441; Visualize</button>' +
            '<button class="btn btn-ghost btn-sm gen-comp-btn" data-name="' + escAttr(comp.name) + '">Generate</button>' +
          '</div>';
        grid.appendChild(card);
      });
      container.appendChild(grid);

      container.querySelectorAll('.viz-from-comp-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          navigate('visualizer');
          selectVisualizerComponent(btn.dataset.name);
        });
      });

      container.querySelectorAll('.gen-comp-btn').forEach(function(btn) {
        btn.addEventListener('click', async function() {
          const origText = btn.textContent;
          btn.textContent = '…';
          btn.disabled = true;
          try {
            const data = await api('POST', '/api/components/generate', { template_name: btn.dataset.name });
            if (data.error) throw new Error(data.error);
            navigate('visualizer');
            await loadVisualizerSection();
            const codeEl = document.getElementById('vizCodeOutput');
            if (codeEl) codeEl.textContent = data.code || '';
            const sel = document.getElementById('vizComponentSelect');
            if (sel) { sel.value = btn.dataset.name; onVizComponentChange(); }
          } catch (err) {
            alert('Error: ' + String(err.message || err));
          } finally {
            btn.textContent = origText;
            btn.disabled = false;
          }
        });
      });
    }

    // ── Visualizer ─────────────────────────────────────────────────────────────
    async function loadVisualizerSection() {
      const el = document.getElementById('vizContent');
      if (!session.activePresetId) {
        el.innerHTML = '<div class="empty-state"><div class="empty-icon">&#x1F441;</div><div class="empty-msg">Load a preset to use the visualizer.</div></div>';
        return;
      }

      // Only build the shell once; refresh assets on each visit
      if (!document.getElementById('vizComponentSelect')) {
        el.innerHTML = '';

        // Controls card
        const controls = document.createElement('div');
        controls.className = 'card mb-4';
        controls.innerHTML =
          '<div class="viz-select-row">' +
            '<div class="form-group" style="margin:0"><label>Component</label>' +
              '<select id="vizComponentSelect"><option value="">— Select a component —</option></select>' +
            '</div>' +
            '<div class="form-group" style="margin:0"><label>Variant</label>' +
              '<select id="vizVariantSelect"><option value="">default</option></select>' +
            '</div>' +
          '</div>' +
          '<div id="vizPropsPanel" class="viz-props"></div>' +
          '<button class="btn btn-primary" id="vizRenderBtn"><span>&#x25BA;</span> Render</button>';
        el.appendChild(controls);

        // Output card
        const output = document.createElement('div');
        output.className = 'card';
        output.innerHTML =
          '<div class="flex justify-between items-center mb-3">' +
            '<span class="font-semibold text-sm">Generated Code</span>' +
            '<button class="btn btn-ghost btn-sm" id="vizCopyBtn">Copy</button>' +
          '</div>' +
          '<div class="copy-wrap">' +
            '<div class="code-output" id="vizCodeOutput" style="min-height:200px">Select a component and click Render to generate code.</div>' +
          '</div>';
        el.appendChild(output);

        document.getElementById('vizComponentSelect').addEventListener('change', onVizComponentChange);
        document.getElementById('vizRenderBtn').addEventListener('click', onVizRender);
        document.getElementById('vizCopyBtn').addEventListener('click', function() {
          const text = document.getElementById('vizCodeOutput').textContent || '';
          navigator.clipboard.writeText(text).then(function() {
            const btn = document.getElementById('vizCopyBtn');
            btn.textContent = 'Copied!';
            btn.classList.add('btn-success');
            setTimeout(function() { btn.textContent = 'Copy'; btn.classList.remove('btn-success'); }, 2000);
          });
        });
      }

      await refreshVisualizerAssets();
    }

    async function refreshVisualizerAssets() {
      const sel = document.getElementById('vizComponentSelect');
      if (!sel) return;
      const currentVal = sel.value;
      sel.innerHTML = '<option value="">— Select a component —</option>';
      try {
        const data = await api('GET', '/api/components');
        (data.components || []).forEach(function(c) {
          const opt = document.createElement('option');
          opt.value = c.name;
          opt.textContent = c.name + ' (' + (c.category || '') + ')';
          opt.dataset.variants = JSON.stringify(c.variants || []);
          opt.dataset.props = JSON.stringify(c.props || []);
          sel.appendChild(opt);
        });
        if (currentVal) sel.value = currentVal;
        if (sel.value) onVizComponentChange();
      } catch (_) { /* server not ready */ }
    }

    function onVizComponentChange() {
      const sel = document.getElementById('vizComponentSelect');
      const varSel = document.getElementById('vizVariantSelect');
      const propsPanel = document.getElementById('vizPropsPanel');
      if (!sel || !varSel || !propsPanel) return;

      const opt = sel.options[sel.selectedIndex];
      varSel.innerHTML = '<option value="">default</option>';
      try {
        JSON.parse(opt.dataset.variants || '[]').forEach(function(v) {
          const o = document.createElement('option');
          o.value = v; o.textContent = v;
          varSel.appendChild(o);
        });
      } catch (_) {}

      propsPanel.innerHTML = '';
      try {
        const props = JSON.parse(opt.dataset.props || '[]');
        if (props.length) {
          const lbl = document.createElement('div');
          lbl.className = 'text-xs text-secondary mb-1';
          lbl.textContent = 'Props (optional):';
          propsPanel.appendChild(lbl);
          props.forEach(function(propName) {
            const row = document.createElement('div');
            row.className = 'viz-prop-row';
            row.innerHTML =
              '<label class="viz-prop-label">' + esc(propName) + '</label>' +
              '<input class="viz-prop-input" id="viz-prop-' + escAttr(propName) + '" type="text" placeholder="value…">';
            propsPanel.appendChild(row);
          });
        }
      } catch (_) {}
    }

    async function onVizRender() {
      const sel = document.getElementById('vizComponentSelect');
      const varSel = document.getElementById('vizVariantSelect');
      const codeEl = document.getElementById('vizCodeOutput');
      if (!sel || !codeEl) return;
      const templateName = sel.value;
      if (!templateName) { codeEl.textContent = 'Select a component first.'; return; }

      codeEl.textContent = 'Generating…';
      const props = {};
      document.querySelectorAll('.viz-prop-input').forEach(function(input) {
        const key = input.id.replace('viz-prop-', '');
        if (input.value.trim()) props[key] = input.value.trim();
      });
      const variant = varSel ? (varSel.value || undefined) : undefined;

      try {
        const data = await api('POST', '/api/components/generate', { template_name: templateName, props, variant });
        if (data.error) throw new Error(data.error);
        codeEl.textContent = data.code || '';
      } catch (err) {
        codeEl.textContent = 'Error: ' + String(err.message || err);
      }
    }

    function selectVisualizerComponent(name) {
      let retries = 0;
      const MAX_RETRIES = 50; // ~3 seconds at 60ms intervals
      function trySelect() {
        const sel = document.getElementById('vizComponentSelect');
        if (!sel) return;
        const found = Array.from(sel.options).some(function(o) { return o.value === name; });
        if (found) {
          sel.value = name;
          onVizComponentChange();
        } else if (++retries < MAX_RETRIES) {
          setTimeout(trySelect, 60);
        } else {
          const codeEl = document.getElementById('vizCodeOutput');
          if (codeEl) codeEl.textContent = 'Component "' + name + '" not found in the active preset.';
        }
      }
      const sel = document.getElementById('vizComponentSelect');
      if (!sel) {
        loadVisualizerSection().then(trySelect);
        return;
      }
      trySelect();
    }

    // ── Init ───────────────────────────────────────────────────────────────────
    refreshSession();
    setInterval(refreshSession, 30000);
  </script>
</body>
</html>`;
