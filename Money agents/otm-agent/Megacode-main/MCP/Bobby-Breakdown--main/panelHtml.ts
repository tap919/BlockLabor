export function getPanelHtml(): string {
  return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bobby Breakdown</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syne:wght@400;600;700;800&display=swap');

  :root {
    --bg: #0a0a0f;
    --surface: #111118;
    --surface2: #1a1a24;
    --border: #2a2a3d;
    --accent: #7c3aed;
    --accent2: #06b6d4;
    --accent3: #f59e0b;
    --text: #e2e8f0;
    --text-muted: #64748b;
    --success: #10b981;
    --error: #ef4444;
    --coding: #06b6d4;
    --biotech: #10b981;
    --fintech: #f59e0b;
    --marketing: #ec4899;
    --gamedev: #8b5cf6;
    --devops: #f97316;
    --aiml: #a78bfa;
    --web: #38bdf8;
    --mode-beginner: #34d399;
    --mode-intermediate: #fbbf24;
    --mode-expert: #f87171;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Syne', sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
  }

  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: 
      linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
    z-index: 0;
  }

  .app {
    position: relative;
    z-index: 1;
    max-width: 900px;
    margin: 0 auto;
    padding: 24px 20px;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 28px;
  }

  .logo {
    width: 42px;
    height: 42px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
    box-shadow: 0 0 20px rgba(124,58,237,0.4);
  }

  .header-text h1 {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.5px;
    background: linear-gradient(90deg, #fff, var(--accent2));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .header-text p {
    font-size: 11px;
    color: var(--text-muted);
    font-family: 'Space Mono', monospace;
    margin-top: 1px;
  }

  .header-actions {
    margin-left: auto;
    display: flex;
    gap: 8px;
  }

  .icon-btn {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text-muted);
    width: 32px;
    height: 32px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    transition: all 0.2s;
  }
  .icon-btn:hover { background: var(--surface2); color: var(--text); border-color: var(--accent); }

  .tabs {
    display: flex;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 4px;
    margin-bottom: 20px;
    gap: 2px;
    flex-wrap: wrap;
  }

  .tab {
    flex: 1;
    padding: 8px 6px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-family: 'Syne', sans-serif;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.2s;
    text-align: center;
    letter-spacing: 0.3px;
    white-space: nowrap;
  }

  .tab.active {
    background: var(--surface2);
    color: var(--text);
    border: 1px solid var(--border);
  }

  .tab:hover:not(.active) { color: var(--text); }

  .domain-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin-bottom: 16px;
  }

  @media (max-width: 500px) {
    .domain-grid { grid-template-columns: repeat(3, 1fr); }
  }

  .domain-btn {
    padding: 8px 4px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    cursor: pointer;
    text-align: center;
    transition: all 0.2s;
    font-family: 'Syne', sans-serif;
  }

  .domain-btn .emoji { font-size: 16px; display: block; margin-bottom: 3px; }
  .domain-btn .label { font-size: 9px; font-weight: 700; letter-spacing: 0.5px; color: var(--text-muted); text-transform: uppercase; }

  .domain-btn.active-coding   { border-color: var(--coding);    background: rgba(6,182,212,0.1);    box-shadow: 0 0 12px rgba(6,182,212,0.15); }
  .domain-btn.active-coding .label { color: var(--coding); }
  .domain-btn.active-biotech  { border-color: var(--biotech);   background: rgba(16,185,129,0.1);   box-shadow: 0 0 12px rgba(16,185,129,0.15); }
  .domain-btn.active-biotech .label { color: var(--biotech); }
  .domain-btn.active-fintech  { border-color: var(--fintech);   background: rgba(245,158,11,0.1);   box-shadow: 0 0 12px rgba(245,158,11,0.15); }
  .domain-btn.active-fintech .label { color: var(--fintech); }
  .domain-btn.active-marketing { border-color: var(--marketing); background: rgba(236,72,153,0.1); box-shadow: 0 0 12px rgba(236,72,153,0.15); }
  .domain-btn.active-marketing .label { color: var(--marketing); }
  .domain-btn.active-gamedev  { border-color: var(--gamedev);   background: rgba(139,92,246,0.1);   box-shadow: 0 0 12px rgba(139,92,246,0.15); }
  .domain-btn.active-gamedev .label { color: var(--gamedev); }
  .domain-btn.active-devops   { border-color: var(--devops);    background: rgba(249,115,22,0.1);   box-shadow: 0 0 12px rgba(249,115,22,0.15); }
  .domain-btn.active-devops .label { color: var(--devops); }
  .domain-btn.active-aiml     { border-color: var(--aiml);      background: rgba(167,139,250,0.1);  box-shadow: 0 0 12px rgba(167,139,250,0.15); }
  .domain-btn.active-aiml .label { color: var(--aiml); }
  .domain-btn.active-web      { border-color: var(--web);       background: rgba(56,189,248,0.1);   box-shadow: 0 0 12px rgba(56,189,248,0.15); }
  .domain-btn.active-web .label { color: var(--web); }
  .domain-btn.active-custom   { border-color: var(--accent3);   background: rgba(245,158,11,0.1);   box-shadow: 0 0 12px rgba(245,158,11,0.15); }
  .domain-btn.active-custom .label { color: var(--accent3); }

  .domain-btn:hover:not([class*="active"]) { border-color: var(--text-muted); }

  .format-row {
    display: flex;
    gap: 6px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .fmt-btn {
    padding: 6px 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    color: var(--text-muted);
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .fmt-btn.active {
    background: rgba(124,58,237,0.2);
    border-color: var(--accent);
    color: var(--text);
  }

  .fmt-btn:hover:not(.active) { color: var(--text); border-color: var(--text-muted); }

  .format-row-label {
    font-size: 9px;
    font-family: 'Space Mono', monospace;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 6px;
    margin-top: 4px;
  }

  .fmt-redflag { border-color: rgba(239,68,68,0.4); color: #fca5a5; }
  .fmt-redflag:hover:not(.active) { border-color: var(--error); color: #fca5a5; }
  .fmt-redflag.active { background: rgba(239,68,68,0.15); border-color: var(--error); color: #fca5a5; }

  .fmt-walkthrough { border-color: rgba(56,189,248,0.4); color: #7dd3fc; }
  .fmt-walkthrough:hover:not(.active) { border-color: var(--web); color: #7dd3fc; }
  .fmt-walkthrough.active { background: rgba(56,189,248,0.15); border-color: var(--web); color: #7dd3fc; }

  .fmt-plan { border-color: rgba(16,185,129,0.4); color: #6ee7b7; }
  .fmt-plan:hover:not(.active) { border-color: var(--success); color: #6ee7b7; }
  .fmt-plan.active { background: rgba(16,185,129,0.15); border-color: var(--success); color: #6ee7b7; }

  .fmt-fixerror { border-color: rgba(245,158,11,0.4); color: #fcd34d; }
  .fmt-fixerror:hover:not(.active) { border-color: var(--accent3); color: #fcd34d; }
  .fmt-fixerror.active { background: rgba(245,158,11,0.15); border-color: var(--accent3); color: #fcd34d; }

  .output-area.redflag .output-label { color: #fca5a5; }
  .output-area.redflag .output-label .dot { background: var(--error); }
  .output-area.redflag .output-rendered,
  .output-area.redflag .output-content { border-color: rgba(239,68,68,0.35); background: rgba(239,68,68,0.04); }
  .output-area.redflag .output-header { border-bottom: 1px solid rgba(239,68,68,0.25); padding-bottom: 8px; margin-bottom: 14px; }

  .input-wrapper {
    position: relative;
    margin-bottom: 12px;
  }

  textarea {
    width: 100%;
    min-height: 90px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 12px 14px;
    color: var(--text);
    font-family: 'Space Mono', monospace;
    font-size: 12px;
    line-height: 1.6;
    resize: vertical;
    transition: border-color 0.2s;
    outline: none;
  }

  textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(124,58,237,0.1); }
  textarea::placeholder { color: var(--text-muted); }

  .submit-btn {
    width: 100%;
    padding: 13px;
    background: linear-gradient(135deg, var(--accent), #6d28d9);
    border: none;
    border-radius: 12px;
    color: white;
    font-family: 'Syne', sans-serif;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    letter-spacing: 0.5px;
    position: relative;
    overflow: hidden;
  }

  .submit-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent);
    opacity: 0;
    transition: opacity 0.2s;
  }

  .submit-btn:hover::before { opacity: 1; }
  .submit-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 25px rgba(124,58,237,0.35); }
  .submit-btn:active { transform: translateY(0); }
  .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  .upload-zone {
    border: 2px dashed var(--border);
    border-radius: 12px;
    padding: 36px 20px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 12px;
  }

  .upload-zone:hover { border-color: var(--accent); background: rgba(124,58,237,0.05); }
  .upload-zone.dragover { border-color: var(--accent); background: rgba(124,58,237,0.1); }

  .upload-icon { font-size: 32px; margin-bottom: 8px; }
  .upload-title { font-size: 14px; font-weight: 700; margin-bottom: 5px; }
  .upload-sub { font-size: 11px; color: var(--text-muted); font-family: 'Space Mono', monospace; }

  .file-preview {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    display: none;
  }

  .file-preview.visible { display: flex; }
  .file-info { flex: 1; min-width: 0; }
  .file-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .file-size { font-size: 11px; color: var(--text-muted); font-family: 'Space Mono', monospace; }

  .output-area {
    margin-top: 20px;
    display: none;
  }

  .output-area.visible { display: block; }

  .output-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    gap: 8px;
    flex-wrap: wrap;
  }

  .output-label {
    font-size: 11px;
    font-family: 'Space Mono', monospace;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .output-label .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--success);
    animation: pulse 1.5s infinite;
    display: none;
  }

  .output-label .dot.streaming { display: block; }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .output-actions { display: flex; gap: 5px; flex-wrap: wrap; }

  .action-btn {
    padding: 4px 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-muted);
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .action-btn:hover { background: var(--surface2); color: var(--text); border-color: var(--accent); }
  .action-btn.pinned { border-color: var(--accent3); color: var(--accent3); }

  .output-content {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 18px;
    font-family: 'Space Mono', monospace;
    font-size: 12px;
    line-height: 1.8;
    white-space: pre-wrap;
    overflow-x: auto;
    max-height: 500px;
    overflow-y: auto;
    scroll-behavior: smooth;
  }

  .output-rendered {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 18px;
    line-height: 1.8;
    max-height: 500px;
    overflow-y: auto;
  }

  .output-rendered h1, .output-rendered h2, .output-rendered h3 {
    font-family: 'Syne', sans-serif;
    margin-top: 18px;
    margin-bottom: 8px;
  }
  .output-rendered h1 { font-size: 17px; font-weight: 800; color: #fff; }
  .output-rendered h2 { font-size: 14px; font-weight: 700; color: var(--accent2); border-bottom: 1px solid var(--border); padding-bottom: 5px; }
  .output-rendered h3 { font-size: 13px; font-weight: 700; color: var(--accent3); }
  .output-rendered p { font-size: 12.5px; margin-bottom: 8px; }
  .output-rendered ul, .output-rendered ol { padding-left: 18px; margin-bottom: 8px; }
  .output-rendered li { font-size: 12.5px; margin-bottom: 3px; }
  .output-rendered code { font-family: 'Space Mono', monospace; font-size: 11px; background: var(--surface2); padding: 2px 5px; border-radius: 4px; color: var(--accent2); }
  .output-rendered pre { background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 12px; overflow-x: auto; margin: 10px 0; }
  .output-rendered pre code { background: none; padding: 0; color: var(--text); }
  .output-rendered strong { color: #fff; font-weight: 700; }
  .output-rendered blockquote { border-left: 3px solid var(--accent); padding-left: 10px; color: var(--text-muted); font-style: italic; }
  .output-rendered table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 11.5px; }
  .output-rendered th { background: var(--surface2); padding: 7px 10px; text-align: left; font-family: 'Syne', sans-serif; font-weight: 700; border: 1px solid var(--border); }
  .output-rendered td { padding: 6px 10px; border: 1px solid var(--border); }
  .output-rendered tr:nth-child(even) td { background: rgba(255,255,255,0.02); }

  .cursor {
    display: inline-block;
    width: 2px;
    height: 14px;
    background: var(--accent2);
    animation: blink 0.8s infinite;
    vertical-align: middle;
    margin-left: 1px;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  /* Token/word counter */
  .stats-bar {
    display: flex;
    gap: 12px;
    margin-top: 6px;
    font-size: 10px;
    font-family: 'Space Mono', monospace;
    color: var(--text-muted);
  }
  .stat-item { display: flex; align-items: center; gap: 4px; }
  .stat-value { color: var(--accent2); font-weight: 700; }

  /* Follow-up questions */
  .followup-section {
    margin-top: 16px;
    border-top: 1px solid var(--border);
    padding-top: 14px;
  }
  .followup-label {
    font-size: 10px;
    font-family: 'Space Mono', monospace;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 8px;
  }
  .followup-input-row {
    display: flex;
    gap: 8px;
  }
  .followup-input {
    flex: 1;
    min-height: unset;
    height: 38px;
    resize: none;
    padding: 8px 12px;
    font-size: 12px;
  }
  .followup-btn {
    padding: 0 14px;
    background: linear-gradient(135deg, var(--accent2), #0891b2);
    border: none;
    border-radius: 10px;
    color: white;
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }
  .followup-btn:hover { opacity: 0.9; transform: translateY(-1px); }
  .followup-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  .chat-messages {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .chat-msg {
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 12px;
    line-height: 1.6;
  }
  .chat-msg.user {
    background: rgba(124,58,237,0.12);
    border: 1px solid rgba(124,58,237,0.25);
    align-self: flex-end;
    max-width: 90%;
    font-family: 'Space Mono', monospace;
  }
  .chat-msg.assistant {
    background: var(--surface);
    border: 1px solid var(--border);
    align-self: flex-start;
    width: 100%;
  }
  .chat-msg.assistant .msg-content { font-size: 12px; line-height: 1.7; }
  .chat-msg.assistant .msg-content h1 { font-size: 14px; }
  .chat-msg.assistant .msg-content h2 { font-size: 13px; color: var(--accent2); }
  .chat-msg.assistant .msg-content h3 { font-size: 12px; color: var(--accent3); }
  .chat-msg.assistant .msg-content p { margin-bottom: 6px; }
  .chat-msg.assistant .msg-content code { font-family: 'Space Mono', monospace; font-size: 11px; background: var(--surface2); padding: 1px 4px; border-radius: 3px; color: var(--accent2); }
  .chat-msg.assistant .msg-content ul { padding-left: 16px; }
  .chat-msg.assistant .msg-content li { margin-bottom: 2px; }
  .chat-msg.assistant .msg-content strong { color: #fff; }

  /* History */
  .history-section { margin-top: 4px; }
  .history-header { 
    font-size: 11px; 
    font-family: 'Space Mono', monospace; 
    color: var(--text-muted); 
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 1px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .history-item {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 9px 12px;
    margin-bottom: 5px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
  .history-item:hover { border-color: var(--accent); background: var(--surface2); }
  .history-item.pinned { border-color: var(--accent3); }

  .history-domain {
    font-size: 9px;
    font-weight: 700;
    font-family: 'Space Mono', monospace;
    padding: 2px 5px;
    border-radius: 4px;
    flex-shrink: 0;
    text-transform: uppercase;
    margin-top: 1px;
  }

  .history-text { font-size: 11px; color: var(--text-muted); line-height: 1.4; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .history-pin { font-size: 11px; color: var(--text-muted); cursor: pointer; flex-shrink: 0; }
  .history-pin:hover { color: var(--accent3); }
  .history-pin.active { color: var(--accent3); }

  .empty-state {
    text-align: center;
    padding: 32px 20px;
    color: var(--text-muted);
  }
  .empty-state .big-icon { font-size: 36px; margin-bottom: 10px; }
  .empty-state p { font-size: 12px; line-height: 1.6; max-width: 280px; margin: 0 auto; }

  .error-banner {
    background: rgba(239,68,68,0.1);
    border: 1px solid var(--error);
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 11px;
    color: #fca5a5;
    font-family: 'Space Mono', monospace;
    margin-top: 10px;
    display: none;
  }
  .error-banner.visible { display: block; }

  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

  .view { display: none; }
  .view.active { display: block; }

  .mode-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }
  .toggle-label { font-size: 11px; color: var(--text-muted); font-family: 'Space Mono', monospace; }
  .toggle-btns { display: flex; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 3px; gap: 2px; }
  .toggle-btn { padding: 3px 8px; border: none; background: transparent; color: var(--text-muted); font-family: 'Space Mono', monospace; font-size: 10px; cursor: pointer; border-radius: 5px; transition: all 0.15s; }
  .toggle-btn.active { background: var(--surface2); color: var(--text); }

  /* Comparison tab */
  .compare-inputs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
  .compare-col label { font-size: 10px; font-family: 'Space Mono', monospace; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 5px; }
  .compare-col textarea { min-height: 80px; }

  /* Custom domain tab */
  .custom-domain-form { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 12px; }
  .custom-domain-form label { font-size: 10px; font-family: 'Space Mono', monospace; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 5px; margin-top: 12px; }
  .custom-domain-form label:first-child { margin-top: 0; }
  .custom-domain-form input { width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; color: var(--text); font-family: 'Space Mono', monospace; font-size: 12px; outline: none; transition: border-color 0.2s; }
  .custom-domain-form input:focus { border-color: var(--accent); }
  .custom-domain-form textarea { min-height: 70px; }
  .saved-domains { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
  .saved-domain-item { background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; }
  .saved-domain-name { font-size: 12px; font-weight: 700; }
  .saved-domain-actions { display: flex; gap: 6px; }

  .section-header {
    font-size: 10px;
    font-family: 'Space Mono', monospace;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 10px;
    margin-top: 16px;
    padding-bottom: 5px;
    border-bottom: 1px solid var(--border);
  }
  .section-header:first-child { margin-top: 0; }

  .pinned-section { margin-bottom: 20px; }
  .pinned-section .section-header { color: var(--accent3); border-color: rgba(245,158,11,0.3); }

  input[type="text"] {
    width: 100%;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 12px;
    color: var(--text);
    font-family: 'Space Mono', monospace;
    font-size: 12px;
    outline: none;
    transition: border-color 0.2s;
    margin-bottom: 8px;
  }
  input[type="text"]:focus { border-color: var(--accent); }

  /* Dev Mode Selector */
  .dev-mode-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }
  .dev-mode-label {
    font-size: 10px;
    font-family: 'Space Mono', monospace;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    white-space: nowrap;
  }
  .dev-mode-btns {
    display: flex;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 3px;
    gap: 2px;
  }
  .dev-mode-btn {
    padding: 4px 10px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    border-radius: 5px;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .dev-mode-btn.active { background: var(--surface2); color: var(--text); }
  .dev-mode-btn.active[data-mode="beginner"] { color: var(--mode-beginner); }
  .dev-mode-btn.active[data-mode="intermediate"] { color: var(--mode-intermediate); }
  .dev-mode-btn.active[data-mode="expert"] { color: var(--mode-expert); }

  /* Fast Scan output colors */
  .output-area.fastscan .output-rendered h2 { color: #34d399; }
  .output-area.fastscan .output-label .dot { background: #34d399; }
</style>
</head>
<body>
<div class="app">
  <div class="header">
    <div class="logo">⚡</div>
    <div class="header-text">
      <h1>Bobby Breakdown</h1>
      <p>ai-powered concept explainer</p>
    </div>
    <div class="header-actions">
      <button class="icon-btn" onclick="openSettings()" title="Settings">⚙</button>
    </div>
  </div>

  <div class="tabs">
    <button class="tab active" onclick="switchTab('breakdown')">⚡ Breakdown</button>
    <button class="tab" onclick="switchTab('compare')">⚖️ Compare</button>
    <button class="tab" onclick="switchTab('fastscan')">🔍 Fast Scan</button>
    <button class="tab" onclick="switchTab('book')">📚 Book→Guide</button>
    <button class="tab" onclick="switchTab('history')">🕐 History</button>
    <button class="tab" onclick="switchTab('domains')">🎛 Domains</button>
  </div>

  <!-- BREAKDOWN TAB -->
  <div id="tab-breakdown" class="view active">
    <div class="domain-grid" id="breakdownDomainGrid">
      <button class="domain-btn active-coding" data-domain="coding" onclick="selectDomain(this,'breakdown')">
        <span class="emoji">💻</span><span class="label">Coding</span>
      </button>
      <button class="domain-btn" data-domain="biotech" onclick="selectDomain(this,'breakdown')">
        <span class="emoji">🧬</span><span class="label">Biotech</span>
      </button>
      <button class="domain-btn" data-domain="fintech" onclick="selectDomain(this,'breakdown')">
        <span class="emoji">📈</span><span class="label">Fintech</span>
      </button>
      <button class="domain-btn" data-domain="marketing" onclick="selectDomain(this,'breakdown')">
        <span class="emoji">📣</span><span class="label">Marketing</span>
      </button>
      <button class="domain-btn" data-domain="gamedev" onclick="selectDomain(this,'breakdown')">
        <span class="emoji">🎮</span><span class="label">GameDev</span>
      </button>
      <button class="domain-btn" data-domain="devops" onclick="selectDomain(this,'breakdown')">
        <span class="emoji">🐳</span><span class="label">DevOps</span>
      </button>
      <button class="domain-btn" data-domain="aiml" onclick="selectDomain(this,'breakdown')">
        <span class="emoji">🤖</span><span class="label">AI/ML</span>
      </button>
      <button class="domain-btn" data-domain="web" onclick="selectDomain(this,'breakdown')">
        <span class="emoji">🌐</span><span class="label">Web</span>
      </button>
    </div>

    <div class="dev-mode-row">
      <span class="dev-mode-label">🧑‍💻 Dev Mode:</span>
      <div class="dev-mode-btns" id="devModeBtns">
        <button class="dev-mode-btn" data-mode="beginner" onclick="selectDevMode(this)" aria-label="Beginner mode: Simple explanations with analogies, no jargon">🟢 Beginner</button>
        <button class="dev-mode-btn active" data-mode="intermediate" onclick="selectDevMode(this)" aria-label="Intermediate mode: Standard terminology, practical nuance">🟡 Intermediate</button>
        <button class="dev-mode-btn" data-mode="expert" onclick="selectDevMode(this)" aria-label="Expert mode: Dense, precise, peer-level technical detail">🔴 Expert</button>
      </div>
    </div>

    <div class="format-row">
      <button class="fmt-btn active" data-format="structured" onclick="selectFormat(this)">📋 Structured</button>
      <button class="fmt-btn" data-format="eli5" onclick="selectFormat(this)">🧒 ELI5</button>
      <button class="fmt-btn" data-format="technical" onclick="selectFormat(this)">⚙️ Technical</button>
      <button class="fmt-btn" data-format="visual" onclick="selectFormat(this)">🗺️ Visual Map</button>
      <button class="fmt-btn" data-format="quickfire" onclick="selectFormat(this)">⚡ Quickfire</button>
    </div>

    <div class="format-row-label">Explain Like I'm…</div>
    <div class="format-row">
      <button class="fmt-btn" data-format="pm" onclick="selectFormat(this)">📊 For PM</button>
      <button class="fmt-btn" data-format="designer" onclick="selectFormat(this)">🎨 Designer</button>
      <button class="fmt-btn" data-format="founder" onclick="selectFormat(this)">🚀 Founder</button>
      <button class="fmt-btn" data-format="scientist" onclick="selectFormat(this)">🔬 Scientist</button>
      <button class="fmt-btn" data-format="rapper" onclick="selectFormat(this)">🎤 Rapper</button>
      <button class="fmt-btn fmt-redflag" data-format="redflag" onclick="selectFormat(this)">🚨 Red Flags</button>
    </div>

    <div class="format-row-label">🛠️ Dev Toolkit</div>
    <div class="format-row">
      <button class="fmt-btn fmt-walkthrough" data-format="walkthrough" onclick="selectFormat(this)">🚶 Walkthrough</button>
      <button class="fmt-btn fmt-plan" data-format="plan" onclick="selectFormat(this)">📋 Plan It</button>
      <button class="fmt-btn fmt-fixerror" data-format="fixerror" onclick="selectFormat(this)">🔧 Fix Error</button>
    </div>

    <div class="input-wrapper">
      <textarea id="breakdownInput" placeholder="Paste a concept, paste code, or type anything confusing...&#10;&#10;Examples:&#10;• 'How does CRISPR actually edit DNA?'&#10;• 'What is options Greeks delta?'&#10;• 'Explain Entity Component Systems'&#10;&#10;Dev Toolkit:&#10;• Paste code → 🚶 Walkthrough (understand it fast)&#10;• Describe a task → 📋 Plan It (get an implementation plan)&#10;• Paste an error → 🔧 Fix Error (decode &amp; fix it)" rows="5"></textarea>
    </div>

    <button class="submit-btn" id="breakdownBtn" onclick="submitBreakdown()">
      ⚡ Break It Down
    </button>

    <div class="error-banner" id="breakdownError"></div>

    <div class="output-area" id="breakdownOutput">
      <div class="output-header">
        <div class="output-label">
          <div class="dot" id="streamDot"></div>
          <span id="outputLabel">BREAKDOWN</span>
        </div>
        <div class="output-actions">
          <div class="toggle-btns">
            <button class="toggle-btn active" onclick="setView('rendered')">Preview</button>
            <button class="toggle-btn" onclick="setView('raw')">Raw</button>
          </div>
          <button class="action-btn" id="pinBreakdownBtn" onclick="togglePin()" title="Pin to history">📌 Pin</button>
          <button class="action-btn" onclick="copyOutput()">📋 Copy</button>
          <button class="action-btn" onclick="exportBreakdownMarkdown()">💾 Export .md</button>
          <button class="action-btn" onclick="saveAsSnippet()">✂️ Snippet</button>
          <button class="action-btn" onclick="clearOutput()">✕ Clear</button>
        </div>
      </div>
      <div id="outputRendered" class="output-rendered"></div>
      <pre id="outputRaw" class="output-content" style="display:none"></pre>
      <div class="stats-bar" id="breakdownStats" style="display:none">
        <span class="stat-item">Words: <span class="stat-value" id="statWords">0</span></span>
        <span class="stat-item">~Tokens: <span class="stat-value" id="statTokens">0</span></span>
        <span class="stat-item">Chars: <span class="stat-value" id="statChars">0</span></span>
      </div>

      <!-- Follow-up Questions -->
      <div class="followup-section" id="followupSection">
        <div class="followup-label">💬 Ask a Follow-up</div>
        <div class="followup-input-row">
          <textarea class="followup-input" id="followupInput" placeholder="Ask a clarifying question..." rows="1"></textarea>
          <button class="followup-btn" id="followupBtn" onclick="submitFollowup()">Ask →</button>
        </div>
        <div class="chat-messages" id="chatMessages"></div>
      </div>
    </div>
  </div>

  <!-- COMPARE TAB -->
  <div id="tab-compare" class="view">
    <div class="domain-grid" id="compareDomainGrid">
      <button class="domain-btn active-coding" data-domain="coding" onclick="selectDomain(this,'compare')">
        <span class="emoji">💻</span><span class="label">Coding</span>
      </button>
      <button class="domain-btn" data-domain="biotech" onclick="selectDomain(this,'compare')">
        <span class="emoji">🧬</span><span class="label">Biotech</span>
      </button>
      <button class="domain-btn" data-domain="fintech" onclick="selectDomain(this,'compare')">
        <span class="emoji">📈</span><span class="label">Fintech</span>
      </button>
      <button class="domain-btn" data-domain="marketing" onclick="selectDomain(this,'compare')">
        <span class="emoji">📣</span><span class="label">Marketing</span>
      </button>
      <button class="domain-btn" data-domain="gamedev" onclick="selectDomain(this,'compare')">
        <span class="emoji">🎮</span><span class="label">GameDev</span>
      </button>
      <button class="domain-btn" data-domain="devops" onclick="selectDomain(this,'compare')">
        <span class="emoji">🐳</span><span class="label">DevOps</span>
      </button>
      <button class="domain-btn" data-domain="aiml" onclick="selectDomain(this,'compare')">
        <span class="emoji">🤖</span><span class="label">AI/ML</span>
      </button>
      <button class="domain-btn" data-domain="web" onclick="selectDomain(this,'compare')">
        <span class="emoji">🌐</span><span class="label">Web</span>
      </button>
    </div>

    <div class="compare-inputs">
      <div class="compare-col">
        <label>Concept A</label>
        <textarea id="compareA" placeholder="First concept, term, or code..."></textarea>
      </div>
      <div class="compare-col">
        <label>Concept B</label>
        <textarea id="compareB" placeholder="Second concept, term, or code..."></textarea>
      </div>
    </div>

    <button class="submit-btn" id="compareBtn" onclick="submitComparison()">
      ⚖️ Compare Concepts
    </button>

    <div class="error-banner" id="compareError"></div>

    <div class="output-area" id="compareOutput">
      <div class="output-header">
        <div class="output-label">
          <div class="dot" id="compareStreamDot"></div>
          <span>COMPARISON</span>
        </div>
        <div class="output-actions">
          <div class="toggle-btns">
            <button class="toggle-btn active" onclick="setCompareView('rendered')">Preview</button>
            <button class="toggle-btn" onclick="setCompareView('raw')">Raw</button>
          </div>
          <button class="action-btn" onclick="copyCompareOutput()">📋 Copy</button>
          <button class="action-btn" onclick="exportCompareMarkdown()">💾 Export .md</button>
          <button class="action-btn" onclick="clearCompareOutput()">✕ Clear</button>
        </div>
      </div>
      <div id="compareOutputRendered" class="output-rendered"></div>
      <pre id="compareOutputRaw" class="output-content" style="display:none"></pre>
      <div class="stats-bar" id="compareStats" style="display:none">
        <span class="stat-item">Words: <span class="stat-value" id="compareStatWords">0</span></span>
        <span class="stat-item">~Tokens: <span class="stat-value" id="compareStatTokens">0</span></span>
      </div>
    </div>
  </div>

  <!-- BOOK TAB -->
  <div id="tab-book" class="view">
    <div class="domain-grid" id="bookDomainGrid">
      <button class="domain-btn active-coding" data-domain="coding" onclick="selectDomain(this,'book')">
        <span class="emoji">💻</span><span class="label">Coding</span>
      </button>
      <button class="domain-btn" data-domain="biotech" onclick="selectDomain(this,'book')">
        <span class="emoji">🧬</span><span class="label">Biotech</span>
      </button>
      <button class="domain-btn" data-domain="fintech" onclick="selectDomain(this,'book')">
        <span class="emoji">📈</span><span class="label">Fintech</span>
      </button>
      <button class="domain-btn" data-domain="marketing" onclick="selectDomain(this,'book')">
        <span class="emoji">📣</span><span class="label">Marketing</span>
      </button>
      <button class="domain-btn" data-domain="gamedev" onclick="selectDomain(this,'book')">
        <span class="emoji">🎮</span><span class="label">GameDev</span>
      </button>
      <button class="domain-btn" data-domain="devops" onclick="selectDomain(this,'book')">
        <span class="emoji">🐳</span><span class="label">DevOps</span>
      </button>
      <button class="domain-btn" data-domain="aiml" onclick="selectDomain(this,'book')">
        <span class="emoji">🤖</span><span class="label">AI/ML</span>
      </button>
      <button class="domain-btn" data-domain="web" onclick="selectDomain(this,'book')">
        <span class="emoji">🌐</span><span class="label">Web</span>
      </button>
    </div>

    <div class="upload-zone" id="uploadZone" onclick="triggerFileInput()" ondragover="handleDragOver(event)" ondrop="handleDrop(event)" ondragleave="handleDragLeave(event)">
      <div class="upload-icon">📚</div>
      <div class="upload-title">Drop a Book / Document</div>
      <div class="upload-sub">Supports .txt, .md files (paste text below too)</div>
    </div>
    <input type="file" id="fileInput" style="display:none" accept=".txt,.md" onchange="handleFileSelect(event)">

    <div class="file-preview" id="filePreview">
      <span style="font-size:22px">📄</span>
      <div class="file-info">
        <div class="file-name" id="fileName">document.txt</div>
        <div class="file-size" id="fileSize">0 KB</div>
      </div>
      <button class="action-btn" onclick="clearFile()">✕ Remove</button>
    </div>

    <textarea id="bookText" placeholder="Or paste book/document text here directly...&#10;&#10;Bobby will create a dense LLM Guide: cliff notes, concept maps, terminology glossary, implementation patterns, and agentic prompting notes." rows="5" style="margin-bottom:12px"></textarea>

    <button class="submit-btn" id="bookBtn" onclick="submitBook()">
      📚 Generate LLM Guide
    </button>

    <div class="error-banner" id="bookError"></div>

    <div class="output-area" id="bookOutput">
      <div class="output-header">
        <div class="output-label">
          <div class="dot" id="bookStreamDot"></div>
          <span>LLM GUIDE</span>
        </div>
        <div class="output-actions">
          <div class="toggle-btns">
            <button class="toggle-btn active" onclick="setBookView('rendered')">Preview</button>
            <button class="toggle-btn" onclick="setBookView('raw')">Raw</button>
          </div>
          <button class="action-btn" onclick="saveGuide()">💾 Save .md</button>
          <button class="action-btn" onclick="copyBookOutput()">📋 Copy</button>
          <button class="action-btn" onclick="clearBookOutput()">✕ Clear</button>
        </div>
      </div>
      <div id="bookOutputRendered" class="output-rendered"></div>
      <pre id="bookOutputRaw" class="output-content" style="display:none"></pre>
      <div class="stats-bar" id="bookStats" style="display:none">
        <span class="stat-item">Words: <span class="stat-value" id="bookStatWords">0</span></span>
        <span class="stat-item">~Tokens: <span class="stat-value" id="bookStatTokens">0</span></span>
        <span class="stat-item">Chars: <span class="stat-value" id="bookStatChars">0</span></span>
      </div>
    </div>
  </div>

  <!-- FAST SCAN TAB -->
  <div id="tab-fastscan" class="view">
    <div class="section-header" style="margin-top:0">🔍 Fast Scan — Instant Code Intelligence</div>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px;font-family:'Space Mono',monospace;line-height:1.6">
      Paste any file, function, or code block for instant triage: file type, purpose, dependencies, data flow, risks 🟢🟡🔴, and next steps. Scan in under 60 seconds.
    </p>

    <div class="input-wrapper">
      <label for="fastscanInput" class="format-row-label">Code to Scan</label>
      <textarea id="fastscanInput" placeholder="Paste code here — a file, function, class, or any snippet...&#10;&#10;You'll get instant triage:&#10;• File type &amp; purpose&#10;• Key functions with complexity ratings 🟢🟡🔴&#10;• Data flow visualization&#10;• Risk zones and recommended next steps" rows="10"></textarea>
    </div>

    <button class="submit-btn" id="fastscanBtn" onclick="submitFastScan()" style="background:linear-gradient(135deg,#059669,#10b981)">
      🔍 Fast Scan
    </button>

    <div class="error-banner" id="fastscanError"></div>

    <div class="output-area fastscan" id="fastscanOutput">
      <div class="output-header">
        <div class="output-label">
          <div class="dot" id="fastscanStreamDot"></div>
          <span>FAST SCAN REPORT</span>
        </div>
        <div class="output-actions">
          <div class="toggle-btns">
            <button class="toggle-btn active" onclick="setFastscanView('rendered')">Preview</button>
            <button class="toggle-btn" onclick="setFastscanView('raw')">Raw</button>
          </div>
          <button class="action-btn" onclick="copyFastscanOutput()">📋 Copy</button>
          <button class="action-btn" onclick="exportFastscanMarkdown()">💾 Export .md</button>
          <button class="action-btn" onclick="clearFastscanOutput()">✕ Clear</button>
        </div>
      </div>
      <div id="fastscanOutputRendered" class="output-rendered"></div>
      <pre id="fastscanOutputRaw" class="output-content" style="display:none"></pre>
      <div class="stats-bar" id="fastscanStats" style="display:none">
        <span class="stat-item">Words: <span class="stat-value" id="fastscanStatWords">0</span></span>
        <span class="stat-item">~Tokens: <span class="stat-value" id="fastscanStatTokens">0</span></span>
      </div>
    </div>
  </div>

  <!-- HISTORY TAB -->
  <div id="tab-history" class="view">
    <div class="history-section">
      <div id="pinnedSection" class="pinned-section" style="display:none">
        <div class="section-header">📌 Pinned</div>
        <div id="pinnedList"></div>
      </div>
      <div class="section-header">🕐 Recent Breakdowns</div>
      <div id="historyList">
        <div class="empty-state">
          <div class="big-icon">🧠</div>
          <p>Your breakdown history will appear here. Break down a concept to get started!</p>
        </div>
      </div>
    </div>
  </div>

  <!-- CUSTOM DOMAINS TAB -->
  <div id="tab-domains" class="view">
    <div class="section-header">🎛 Custom Domain Builder</div>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px;font-family:'Space Mono',monospace;line-height:1.6">
      Create custom expert domains with tailored system prompts. Your domains appear as domain buttons in the Breakdown tab.
    </p>
    <div class="custom-domain-form">
      <label>Domain Name</label>
      <input type="text" id="customDomainName" placeholder="e.g., DevOps, Legal, Healthcare, Robotics">
      <label>Expert System Prompt</label>
      <textarea id="customDomainPrompt" rows="4" placeholder="You are an expert in [field]. Use precise [field] terminology and reference real tools, frameworks, and concepts in this domain..."></textarea>
      <button class="submit-btn" style="margin-top:12px" onclick="saveCustomDomain()">+ Save Custom Domain</button>
    </div>

    <div class="section-header">Saved Domains</div>
    <div id="savedDomainsList">
      <div class="empty-state" style="padding:20px">
        <p>No custom domains yet. Create one above!</p>
      </div>
    </div>
  </div>
</div>

<script>
const vscode = acquireVsCodeApi();

// Formats that display code-analysis output (no follow-up chat, distinct labels)
const CODE_ANALYSIS_FORMATS = ['redflag', 'walkthrough', 'fixerror'];

let state = {
  domain: 'coding',
  bookDomain: 'coding',
  compareDomain: 'coding',
  format: 'structured',
  streamFormat: 'structured',
  devMode: 'intermediate',
  output: '',
  bookOutput: '',
  compareOutput: '',
  fastscanOutput: '',
  streaming: false,
  history: [],
  pinnedItems: [],
  currentFile: null,
  outputView: 'rendered',
  bookOutputView: 'rendered',
  compareOutputView: 'rendered',
  fastscanOutputView: 'rendered',
  activeMode: 'breakdown',
  customDomains: [],
  conversationHistory: [],
  currentQuery: '',
  followupStreaming: false,
  currentFollowupText: '',
  isPinned: false
};

// Shared domain color map for history, pinned views, and badges
const DOMAIN_COLORS = {
  coding: '#06b6d4', biotech: '#10b981', fintech: '#f59e0b',
  marketing: '#ec4899', gamedev: '#8b5cf6', devops: '#f97316',
  aiml: '#a78bfa', web: '#38bdf8', custom: '#f59e0b'
};

// Load saved state
const saved = vscode.getState();
if (saved) {
  state.devMode = saved.devMode || 'intermediate';
  state.history = saved.history || [];
  state.pinnedItems = saved.pinnedItems || [];
  state.customDomains = saved.customDomains || [];
  renderHistory();
  renderPinned();
  renderCustomDomains();
  renderCustomDomainButtons();
}

// Message handler from extension
window.addEventListener('message', (event) => {
  const msg = event.data;
  switch(msg.type) {
    case 'prefill':
      document.getElementById('breakdownInput').value = msg.text;
      switchTab('breakdown');
      break;
    case 'book':
      document.getElementById('bookText').value = msg.content;
      const fname = msg.filename ? (msg.filename.split('/').pop() || 'document') : 'document';
      state.currentFile = { name: fname, size: msg.content.length };
      updateFilePreview();
      switchTab('book');
      break;
    case 'startStream':
      if (msg.mode === 'book') startBookStream();
      else if (msg.mode === 'comparison') startCompareStream();
      else if (msg.mode === 'fastscan') startFastscanStream();
      else if (msg.mode === 'followup') {
        // Follow-up streaming uses separate followupChunk/followupDone events
        // and should not modify breakdown streaming state here.
      } else startBreakdownStream();
      break;
    case 'chunk':
      if (state.activeMode === 'book') {
        state.bookOutput += msg.text;
        renderBookOutput();
      } else if (state.activeMode === 'comparison') {
        state.compareOutput += msg.text;
        renderCompareOutput();
      } else if (state.activeMode === 'fastscan') {
        state.fastscanOutput += msg.text;
        renderFastscanOutput();
      } else {
        state.output += msg.text;
        renderOutput();
      }
      break;
    case 'done':
      stopStream();
      break;
    case 'followupChunk':
      state.currentFollowupText += msg.text;
      renderFollowupStream();
      break;
    case 'followupDone':
      stopFollowupStream();
      break;
    case 'error':
      showError(msg.message, state.activeMode === 'book');
      stopStream();
      stopFollowupStream();
      break;
  }
});

function switchTab(name) {
  const tabs = ['breakdown', 'compare', 'fastscan', 'book', 'history', 'domains'];
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('active', tabs[i] === name);
  });
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
}

function selectDomain(btn, tab) {
  const grid = document.getElementById(tab + 'DomainGrid');
  if (!grid) return;
  grid.querySelectorAll('.domain-btn').forEach(b => {
    const d = b.dataset.domain;
    b.className = 'domain-btn';
    if (b === btn) {
      b.classList.add('active-' + d);
      if (tab === 'breakdown') state.domain = d;
      else if (tab === 'book') state.bookDomain = d;
      else if (tab === 'compare') state.compareDomain = d;
    }
  });
}

function selectFormat(btn) {
  document.querySelectorAll('.fmt-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.format = btn.dataset.format;
  const breakdownBtn = document.getElementById('breakdownBtn');
  if (breakdownBtn) {
    const btnLabels = { redflag: '🚨 Scan Red Flags', walkthrough: '🚶 Walk Through Code', plan: '📋 Generate Plan', fixerror: '🔧 Fix This Error' };
    breakdownBtn.textContent = btnLabels[state.format] || '⚡ Break It Down';
  }
}

function submitBreakdown() {
  const text = document.getElementById('breakdownInput').value.trim();
  if (!text) return;
  state.activeMode = 'breakdown';
  state.streamFormat = state.format;
  state.output = '';
  state.currentQuery = text;
  state.conversationHistory = [];
  state.isPinned = false;
  document.getElementById('chatMessages').innerHTML = '';
  document.getElementById('pinBreakdownBtn').classList.remove('pinned');
  document.getElementById('pinBreakdownBtn').textContent = '📌 Pin';

  const customDomain = state.customDomains.find(d => d.name === state.domain);

  vscode.postMessage({
    type: 'breakdown',
    text,
    domain: customDomain ? 'custom' : state.domain,
    format: state.format,
    devMode: state.devMode,
    customDomainName: customDomain ? customDomain.name : undefined,
    customDomainPrompt: customDomain ? customDomain.prompt : undefined
  });
}

function submitBook() {
  const text = document.getElementById('bookText').value.trim();
  if (!text) { showError('Please paste text or upload a file first.', true); return; }
  state.activeMode = 'book';
  state.bookOutput = '';

  vscode.postMessage({
    type: 'book',
    content: text,
    domain: state.bookDomain,
    filename: state.currentFile ? state.currentFile.name : 'document.md'
  });
}

function submitComparison() {
  const conceptA = document.getElementById('compareA').value.trim();
  const conceptB = document.getElementById('compareB').value.trim();
  if (!conceptA || !conceptB) {
    showError('Please enter both concepts to compare.', false);
    document.getElementById('compareError').classList.add('visible');
    return;
  }
  state.activeMode = 'comparison';
  state.compareOutput = '';

  const customDomain = state.customDomains.find(d => d.name === state.compareDomain);

  vscode.postMessage({
    type: 'comparison',
    conceptA,
    conceptB,
    domain: customDomain ? 'custom' : state.compareDomain,
    devMode: state.devMode,
    customDomainName: customDomain ? customDomain.name : undefined,
    customDomainPrompt: customDomain ? customDomain.prompt : undefined
  });
}

function submitFollowup() {
  const question = document.getElementById('followupInput').value.trim();
  if (!question || state.followupStreaming) return;

  // Build conversation history
  const history = [
    { role: 'user', content: 'Break down: ' + state.currentQuery },
    { role: 'assistant', content: state.output },
    ...state.conversationHistory,
    { role: 'user', content: question }
  ];

  state.conversationHistory.push({ role: 'user', content: question });
  state.currentFollowupText = '';

  // Render user message
  const chatEl = document.getElementById('chatMessages');
  const userMsg = document.createElement('div');
  userMsg.className = 'chat-msg user';
  userMsg.textContent = question;
  chatEl.appendChild(userMsg);

  // Add assistant placeholder
  const assistantMsg = document.createElement('div');
  assistantMsg.className = 'chat-msg assistant';
  assistantMsg.innerHTML = '<div class="msg-content" id="followupStreamContent"><span class="cursor"></span></div>';
  chatEl.appendChild(assistantMsg);
  chatEl.scrollTop = chatEl.scrollHeight;

  document.getElementById('followupInput').value = '';

  const customDomain = state.customDomains.find(d => d.name === state.domain);

  state.followupStreaming = true;
  document.getElementById('followupBtn').disabled = true;

  vscode.postMessage({
    type: 'followup',
    question,
    domain: customDomain ? 'custom' : state.domain,
    devMode: state.devMode,
    conversationHistory: history,
    customDomainName: customDomain ? customDomain.name : undefined,
    customDomainPrompt: customDomain ? customDomain.prompt : undefined
  });
}

function renderFollowupStream() {
  const el = document.getElementById('followupStreamContent');
  if (!el) return;
  const cursor = state.followupStreaming ? '<span class="cursor"></span>' : '';
  el.innerHTML = markdownToHtml(state.currentFollowupText) + cursor;
  const chatEl = document.getElementById('chatMessages');
  chatEl.scrollTop = chatEl.scrollHeight;
}

function stopFollowupStream() {
  state.followupStreaming = false;
  state.conversationHistory.push({ role: 'assistant', content: state.currentFollowupText });
  document.getElementById('followupBtn').disabled = false;
  const el = document.getElementById('followupStreamContent');
  if (el) el.innerHTML = markdownToHtml(state.currentFollowupText);
  // Remove cursor from id
  const streamEl = document.getElementById('followupStreamContent');
  if (streamEl) streamEl.id = 'followupMsg_' + Date.now();
}

function startFastscanStream() {
  state.streaming = true;
  state.activeMode = 'fastscan';
  state.fastscanOutput = '';
  const btn = document.getElementById('fastscanBtn');
  btn.disabled = true;
  btn.textContent = '🔍 Scanning...';
  document.getElementById('fastscanError').classList.remove('visible');
  document.getElementById('fastscanOutput').classList.add('visible');
  document.getElementById('fastscanStreamDot').classList.add('streaming');
  document.getElementById('fastscanStats').style.display = 'none';
}

function startBreakdownStream() {
  state.streaming = true;
  const btn = document.getElementById('breakdownBtn');
  btn.disabled = true;
  const formatLabels = {
    pm: '📊 Explaining for PM...', designer: '🎨 Explaining for Designer...', founder: '🚀 Explaining for Founder...',
    scientist: '🔬 Explaining for Scientist...', rapper: '🎤 Explaining for Rapper...', redflag: '🚨 Scanning red flags...',
    walkthrough: '🚶 Walking through code...', plan: '📋 Building plan...', fixerror: '🔧 Diagnosing error...'
  };
  btn.textContent = formatLabels[state.streamFormat] || '⚡ Breaking down...';
  const outputLabels = {
    pm: 'FOR PM', designer: 'FOR DESIGNER', founder: 'FOR FOUNDER',
    scientist: 'FOR SCIENTIST', rapper: 'STREET CODE', redflag: 'RED FLAG ANALYSIS',
    walkthrough: 'CODE WALKTHROUGH', plan: 'IMPLEMENTATION PLAN', fixerror: 'ERROR ANALYSIS'
  };
  document.getElementById('outputLabel').textContent = outputLabels[state.streamFormat] || 'BREAKDOWN';
  const outputArea = document.getElementById('breakdownOutput');
  outputArea.classList.toggle('redflag', state.streamFormat === 'redflag');
  document.querySelectorAll('.fmt-btn').forEach(b => { b.disabled = true; });
  document.getElementById('breakdownError').classList.remove('visible');
  outputArea.classList.add('visible');
  document.getElementById('streamDot').classList.add('streaming');
  document.getElementById('breakdownStats').style.display = 'none';
  document.getElementById('followupSection').style.display = 'none';
}

function startBookStream() {
  state.streaming = true;
  const btn = document.getElementById('bookBtn');
  btn.disabled = true;
  btn.textContent = '📚 Generating guide...';
  document.getElementById('bookError').classList.remove('visible');
  document.getElementById('bookOutput').classList.add('visible');
  document.getElementById('bookStreamDot').classList.add('streaming');
  document.getElementById('bookStats').style.display = 'none';
}

function startCompareStream() {
  state.streaming = true;
  const btn = document.getElementById('compareBtn');
  btn.disabled = true;
  btn.textContent = '⚖️ Comparing...';
  document.getElementById('compareError').classList.remove('visible');
  document.getElementById('compareOutput').classList.add('visible');
  document.getElementById('compareStreamDot').classList.add('streaming');
  document.getElementById('compareStats').style.display = 'none';
}

function stopStream() {
  state.streaming = false;
  const btn1 = document.getElementById('breakdownBtn');
  btn1.disabled = false;
  const btnLabels = { redflag: '🚨 Scan Red Flags', walkthrough: '🚶 Walk Through Code', plan: '📋 Generate Plan', fixerror: '🔧 Fix This Error' };
  btn1.textContent = btnLabels[state.format] || '⚡ Break It Down';
  document.querySelectorAll('.fmt-btn').forEach(b => { b.disabled = false; });
  const btn2 = document.getElementById('bookBtn');
  btn2.disabled = false;
  btn2.textContent = '📚 Generate LLM Guide';
  const btn3 = document.getElementById('compareBtn');
  btn3.disabled = false;
  btn3.textContent = '⚖️ Compare Concepts';
  const btn4 = document.getElementById('fastscanBtn');
  btn4.disabled = false;
  btn4.textContent = '🔍 Fast Scan';
  document.getElementById('streamDot').classList.remove('streaming');
  document.getElementById('bookStreamDot').classList.remove('streaming');
  document.getElementById('compareStreamDot').classList.remove('streaming');
  document.getElementById('fastscanStreamDot').classList.remove('streaming');

  if (state.activeMode === 'breakdown' && state.output) {
    const input = document.getElementById('breakdownInput').value.trim();
    addToHistory(input, state.domain, state.output);
    updateStats('breakdown', state.output);
    document.getElementById('breakdownStats').style.display = 'flex';
    // Only show follow-up chat for non-code-analysis modes (use streamFormat to check what was actually run)
    if (!CODE_ANALYSIS_FORMATS.includes(state.streamFormat)) {
      document.getElementById('followupSection').style.display = 'block';
    }
  } else if (state.activeMode === 'book' && state.bookOutput) {
    updateStats('book', state.bookOutput);
    document.getElementById('bookStats').style.display = 'flex';
  } else if (state.activeMode === 'comparison' && state.compareOutput) {
    updateCompareStats(state.compareOutput);
    document.getElementById('compareStats').style.display = 'flex';
  } else if (state.activeMode === 'fastscan' && state.fastscanOutput) {
    const words = state.fastscanOutput.trim().split(/\s+/).filter(w => w.length > 0).length;
    const tokens = Math.ceil(state.fastscanOutput.length / 4);
    document.getElementById('fastscanStatWords').textContent = words.toLocaleString();
    document.getElementById('fastscanStatTokens').textContent = tokens.toLocaleString();
    document.getElementById('fastscanStats').style.display = 'flex';
  }
}

function updateStats(mode, text) {
  const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  const chars = text.length;
  const tokens = Math.ceil(chars / 4);
  if (mode === 'breakdown') {
    document.getElementById('statWords').textContent = words.toLocaleString();
    document.getElementById('statTokens').textContent = tokens.toLocaleString();
    document.getElementById('statChars').textContent = chars.toLocaleString();
  } else {
    document.getElementById('bookStatWords').textContent = words.toLocaleString();
    document.getElementById('bookStatTokens').textContent = tokens.toLocaleString();
    document.getElementById('bookStatChars').textContent = chars.toLocaleString();
  }
}

function updateCompareStats(text) {
  const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  const tokens = Math.ceil(text.length / 4);
  document.getElementById('compareStatWords').textContent = words.toLocaleString();
  document.getElementById('compareStatTokens').textContent = tokens.toLocaleString();
}

function submitFastScan() {
  const text = document.getElementById('fastscanInput').value.trim();
  if (!text) return;
  state.activeMode = 'fastscan';
  state.fastscanOutput = '';
  vscode.postMessage({ type: 'fastscan', text, domain: state.domain, devMode: state.devMode });
}

function selectDevMode(btn) {
  document.querySelectorAll('.dev-mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.devMode = btn.dataset.mode;
}

function renderFastscanOutput() {
  const raw = document.getElementById('fastscanOutputRaw');
  const rendered = document.getElementById('fastscanOutputRendered');
  const cursor = state.streaming ? '<span class="cursor"></span>' : '';
  raw.textContent = state.fastscanOutput;
  rendered.innerHTML = markdownToHtml(state.fastscanOutput) + cursor;
  if (state.fastscanOutputView === 'rendered') {
    rendered.scrollTop = rendered.scrollHeight;
  } else {
    raw.scrollTop = raw.scrollHeight;
  }
}

function setFastscanView(mode) {
  state.fastscanOutputView = mode;
  document.querySelectorAll('#tab-fastscan .toggle-btn').forEach((b, i) => {
    b.classList.toggle('active', (i === 0 && mode === 'rendered') || (i === 1 && mode === 'raw'));
  });
  document.getElementById('fastscanOutputRendered').style.display = mode === 'rendered' ? '' : 'none';
  document.getElementById('fastscanOutputRaw').style.display = mode === 'raw' ? '' : 'none';
}

function copyFastscanOutput() {
  vscode.postMessage({ type: 'copy', text: state.fastscanOutput });
}

function exportFastscanMarkdown() {
  const filename = 'fastscan-' + Date.now() + '.md';
  vscode.postMessage({ type: 'exportMarkdown', text: state.fastscanOutput, filename });
}

function clearFastscanOutput() {
  state.fastscanOutput = '';
  document.getElementById('fastscanOutput').classList.remove('visible');
  document.getElementById('fastscanOutputRendered').innerHTML = '';
  document.getElementById('fastscanOutputRaw').textContent = '';
  document.getElementById('fastscanStats').style.display = 'none';
}

function renderOutput() {
  const raw = document.getElementById('outputRaw');
  const rendered = document.getElementById('outputRendered');
  const cursor = state.streaming ? '<span class="cursor"></span>' : '';
  raw.textContent = state.output;
  rendered.innerHTML = markdownToHtml(state.output) + cursor;
  if (state.outputView === 'rendered') {
    rendered.scrollTop = rendered.scrollHeight;
  } else {
    raw.scrollTop = raw.scrollHeight;
  }
}

function renderBookOutput() {
  const raw = document.getElementById('bookOutputRaw');
  const rendered = document.getElementById('bookOutputRendered');
  const cursor = state.streaming ? '<span class="cursor"></span>' : '';
  raw.textContent = state.bookOutput;
  rendered.innerHTML = markdownToHtml(state.bookOutput) + cursor;
  if (state.bookOutputView === 'rendered') {
    rendered.scrollTop = rendered.scrollHeight;
  } else {
    raw.scrollTop = raw.scrollHeight;
  }
}

function renderCompareOutput() {
  const raw = document.getElementById('compareOutputRaw');
  const rendered = document.getElementById('compareOutputRendered');
  const cursor = state.streaming ? '<span class="cursor"></span>' : '';
  raw.textContent = state.compareOutput;
  rendered.innerHTML = markdownToHtml(state.compareOutput) + cursor;
  if (state.compareOutputView === 'rendered') {
    rendered.scrollTop = rendered.scrollHeight;
  } else {
    raw.scrollTop = raw.scrollHeight;
  }
}

function setView(mode) {
  state.outputView = mode;
  document.querySelectorAll('#tab-breakdown .toggle-btn').forEach((b, i) => {
    b.classList.toggle('active', (i === 0 && mode === 'rendered') || (i === 1 && mode === 'raw'));
  });
  document.getElementById('outputRendered').style.display = mode === 'rendered' ? '' : 'none';
  document.getElementById('outputRaw').style.display = mode === 'raw' ? '' : 'none';
}

function setBookView(mode) {
  state.bookOutputView = mode;
  document.querySelectorAll('#tab-book .toggle-btn').forEach((b, i) => {
    b.classList.toggle('active', (i === 0 && mode === 'rendered') || (i === 1 && mode === 'raw'));
  });
  document.getElementById('bookOutputRendered').style.display = mode === 'rendered' ? '' : 'none';
  document.getElementById('bookOutputRaw').style.display = mode === 'raw' ? '' : 'none';
}

function setCompareView(mode) {
  state.compareOutputView = mode;
  document.querySelectorAll('#tab-compare .toggle-btn').forEach((b, i) => {
    b.classList.toggle('active', (i === 0 && mode === 'rendered') || (i === 1 && mode === 'raw'));
  });
  document.getElementById('compareOutputRendered').style.display = mode === 'rendered' ? '' : 'none';
  document.getElementById('compareOutputRaw').style.display = mode === 'raw' ? '' : 'none';
}

function showError(msg, isBook) {
  const id = isBook ? 'bookError' : (state.activeMode === 'comparison' ? 'compareError' : 'breakdownError');
  const el = document.getElementById(id);
  if (el) { el.textContent = '⚠️ ' + msg; el.classList.add('visible'); }
}

function copyOutput() {
  vscode.postMessage({ type: 'copy', text: state.output });
}

function copyBookOutput() {
  vscode.postMessage({ type: 'copy', text: state.bookOutput });
}

function copyCompareOutput() {
  vscode.postMessage({ type: 'copy', text: state.compareOutput });
}

function clearOutput() {
  state.output = '';
  state.conversationHistory = [];
  document.getElementById('breakdownOutput').classList.remove('visible');
  document.getElementById('outputRendered').innerHTML = '';
  document.getElementById('outputRaw').textContent = '';
  document.getElementById('chatMessages').innerHTML = '';
  document.getElementById('breakdownStats').style.display = 'none';
  state.isPinned = false;
  document.getElementById('pinBreakdownBtn').classList.remove('pinned');
  document.getElementById('pinBreakdownBtn').textContent = '📌 Pin';
}

function clearBookOutput() {
  state.bookOutput = '';
  document.getElementById('bookOutput').classList.remove('visible');
  document.getElementById('bookOutputRendered').innerHTML = '';
  document.getElementById('bookOutputRaw').textContent = '';
  document.getElementById('bookStats').style.display = 'none';
}

function clearCompareOutput() {
  state.compareOutput = '';
  document.getElementById('compareOutput').classList.remove('visible');
  document.getElementById('compareOutputRendered').innerHTML = '';
  document.getElementById('compareOutputRaw').textContent = '';
  document.getElementById('compareStats').style.display = 'none';
}

function saveGuide() {
  const filename = (state.currentFile ? state.currentFile.name.replace(/\.[^.]+$/, '') : 'llm-guide') + '-llm-guide.md';
  vscode.postMessage({ type: 'saveGuide', text: state.bookOutput, filename });
}

function exportBreakdownMarkdown() {
  const query = state.currentQuery || document.getElementById('breakdownInput').value.trim();
  const filename = (query.slice(0, 30).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'breakdown') + '.md';
  vscode.postMessage({ type: 'exportMarkdown', text: state.output, filename });
}

function exportCompareMarkdown() {
  const a = document.getElementById('compareA').value.trim().slice(0, 20);
  const b = document.getElementById('compareB').value.trim().slice(0, 20);
  const filename = 'compare-' + a.toLowerCase().replace(/\s+/g, '-') + '-vs-' + b.toLowerCase().replace(/\s+/g, '-') + '.md';
  vscode.postMessage({ type: 'exportMarkdown', text: state.compareOutput, filename });
}

function saveAsSnippet() {
  vscode.postMessage({ type: 'saveSnippet', text: state.output, query: state.currentQuery, language: state.domain });
}

function openSettings() {
  vscode.postMessage({ type: 'openSettings' });
}

// Pin functionality
function togglePin() {
  if (!state.output) return;
  state.isPinned = !state.isPinned;
  const btn = document.getElementById('pinBreakdownBtn');
  if (state.isPinned) {
    btn.classList.add('pinned');
    btn.textContent = '📌 Pinned';
    // Pin the current item in history
    const query = state.currentQuery || document.getElementById('breakdownInput').value.trim();
    const existingPin = state.pinnedItems.find(p => p.query === query);
    if (!existingPin) {
      state.pinnedItems.unshift({ query, domain: state.domain, output: state.output, time: Date.now() });
      if (state.pinnedItems.length > 20) state.pinnedItems.pop();
    }
  } else {
    btn.classList.remove('pinned');
    btn.textContent = '📌 Pin';
    const query = state.currentQuery || document.getElementById('breakdownInput').value.trim();
    state.pinnedItems = state.pinnedItems.filter(p => p.query !== query);
  }
  saveStateToVscode();
  renderPinned();
}

function unpinItem(i) {
  state.pinnedItems.splice(i, 1);
  saveStateToVscode();
  renderPinned();
}

function renderPinned() {
  const section = document.getElementById('pinnedSection');
  const list = document.getElementById('pinnedList');
  if (!state.pinnedItems.length) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';
  list.innerHTML = state.pinnedItems.map((h, i) =>
    '<div class="history-item pinned" style="border-color:rgba(245,158,11,0.4)">' +
    '<span class="history-domain" style="background:' + (DOMAIN_COLORS[h.domain] || '#7c3aed') + '22;color:' + (DOMAIN_COLORS[h.domain] || '#7c3aed') + '">' + escapeHtml(h.domain) + '</span>' +
    '<span class="history-text" onclick="loadPinned(' + i + ')" style="cursor:pointer">' + escapeHtml(h.query.slice(0, 80)) + '</span>' +
    '<span class="history-pin active" onclick="unpinItem(' + i + ')" title="Unpin">📌</span>' +
    '</div>'
  ).join('');
}

function loadPinned(i) {
  const h = state.pinnedItems[i];
  state.output = h.output;
  state.currentQuery = h.query;
  document.getElementById('breakdownInput').value = h.query;
  setActiveDomain('#breakdownDomainGrid', h.domain, 'breakdown');
  state.domain = h.domain;
  document.getElementById('breakdownOutput').classList.add('visible');
  document.getElementById('breakdownStats').style.display = 'flex';
  document.getElementById('followupSection').style.display = 'block';
  updateStats('breakdown', h.output);
  renderOutput();
  state.isPinned = true;
  document.getElementById('pinBreakdownBtn').classList.add('pinned');
  document.getElementById('pinBreakdownBtn').textContent = '📌 Pinned';
  switchTab('breakdown');
}

// File handling
function triggerFileInput() {
  document.getElementById('fileInput').click();
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  readFile(file);
}

function handleDragOver(event) {
  event.preventDefault();
  document.getElementById('uploadZone').classList.add('dragover');
}

function handleDragLeave() {
  document.getElementById('uploadZone').classList.remove('dragover');
}

function handleDrop(event) {
  event.preventDefault();
  document.getElementById('uploadZone').classList.remove('dragover');
  const file = event.dataTransfer.files[0];
  if (file) readFile(file);
}

function readFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('bookText').value = e.target.result;
    state.currentFile = { name: file.name, size: file.size };
    updateFilePreview();
  };
  reader.readAsText(file);
}

function updateFilePreview() {
  if (!state.currentFile) return;
  document.getElementById('fileName').textContent = state.currentFile.name;
  document.getElementById('fileSize').textContent = (state.currentFile.size / 1024).toFixed(1) + ' KB';
  document.getElementById('filePreview').classList.add('visible');
}

function clearFile() {
  state.currentFile = null;
  document.getElementById('filePreview').classList.remove('visible');
  document.getElementById('bookText').value = '';
  document.getElementById('fileInput').value = '';
}

// History
function addToHistory(query, domain, output) {
  // Remove duplicate
  state.history = state.history.filter(h => h.query !== query);
  state.history.unshift({ query, domain, output, time: Date.now() });
  if (state.history.length > 50) state.history.pop();
  saveStateToVscode();
  renderHistory();
}

function saveStateToVscode() {
  vscode.setState({ history: state.history, pinnedItems: state.pinnedItems, customDomains: state.customDomains });
}

function renderHistory() {
  const list = document.getElementById('historyList');
  if (!state.history.length) {
    list.innerHTML = '<div class="empty-state"><div class="big-icon">🧠</div><p>Your breakdown history will appear here. Break down a concept to get started!</p></div>';
    return;
  }
  list.innerHTML = state.history.map((h, i) =>
    '<div class="history-item" onclick="loadHistory(' + i + ')">' +
    '<span class="history-domain" style="background:' + (DOMAIN_COLORS[h.domain] || '#7c3aed') + '22;color:' + (DOMAIN_COLORS[h.domain] || '#7c3aed') + '">' + escapeHtml(h.domain) + '</span>' +
    '<span class="history-text">' + escapeHtml(h.query.slice(0, 100)) + '</span>' +
    '</div>'
  ).join('');
}

function loadHistory(i) {
  const h = state.history[i];
  state.output = h.output;
  state.currentQuery = h.query;
  document.getElementById('breakdownInput').value = h.query;
  setActiveDomain('#breakdownDomainGrid', h.domain, 'breakdown');
  state.domain = h.domain;
  document.getElementById('breakdownOutput').classList.add('visible');
  document.getElementById('breakdownStats').style.display = 'flex';
  document.getElementById('followupSection').style.display = 'block';
  updateStats('breakdown', h.output);
  renderOutput();
  switchTab('breakdown');
}

function setActiveDomain(gridSelector, domain, tab) {
  const grid = document.getElementById(tab + 'DomainGrid');
  if (!grid) return;
  grid.querySelectorAll('.domain-btn').forEach(b => {
    b.className = 'domain-btn';
    if (b.dataset.domain === domain) b.classList.add('active-' + domain);
  });
}

// Custom domains
function saveCustomDomain() {
  const name = document.getElementById('customDomainName').value.trim();
  const prompt = document.getElementById('customDomainPrompt').value.trim();
  if (!name || !prompt) return;

  const existing = state.customDomains.findIndex(d => d.name === name);
  if (existing >= 0) {
    state.customDomains[existing] = { name, prompt };
  } else {
    state.customDomains.push({ name, prompt });
  }
  saveStateToVscode();
  renderCustomDomains();
  renderCustomDomainButtons();

  document.getElementById('customDomainName').value = '';
  document.getElementById('customDomainPrompt').value = '';
}

function deleteCustomDomain(name) {
  state.customDomains = state.customDomains.filter(d => d.name !== name);
  saveStateToVscode();
  renderCustomDomains();
  renderCustomDomainButtons();
}

function renderCustomDomains() {
  const list = document.getElementById('savedDomainsList');
  if (!state.customDomains.length) {
    list.innerHTML = '<div class="empty-state" style="padding:20px"><p>No custom domains yet. Create one above!</p></div>';
    return;
  }
  list.innerHTML = '<div class="saved-domains">' + state.customDomains.map(d =>
    '<div class="saved-domain-item">' +
    '<div>' +
    '<div class="saved-domain-name">' + escapeHtml(d.name) + '</div>' +
    '<div style="font-size:11px;color:var(--text-muted);font-family:Space Mono,monospace;margin-top:2px">' + escapeHtml(d.prompt.slice(0, 60)) + '...</div>' +
    '</div>' +
    '<div class="saved-domain-actions">' +
    '<button class="action-btn" onclick="editCustomDomain(' + JSON.stringify(d.name) + ')">Edit</button>' +
    '<button class="action-btn" onclick="deleteCustomDomain(' + JSON.stringify(d.name) + ')">✕ Delete</button>' +
    '</div>' +
    '</div>'
  ).join('') + '</div>';
}

function editCustomDomain(name) {
  const domain = state.customDomains.find(d => d.name === name);
  if (!domain) return;
  document.getElementById('customDomainName').value = domain.name;
  document.getElementById('customDomainPrompt').value = domain.prompt;
}

function renderCustomDomainButtons() {
  // Add custom domain buttons to the breakdown and compare grids
  const grids = [
    { id: 'breakdownDomainGrid', tab: 'breakdown' },
    { id: 'compareDomainGrid', tab: 'compare' }
  ];

  grids.forEach(({ id, tab }) => {
    const grid = document.getElementById(id);
    if (!grid) return;
    // Remove existing custom domain buttons
    grid.querySelectorAll('.domain-btn[data-custom]').forEach(b => b.remove());
    // Add new ones
    state.customDomains.forEach(d => {
      const btn = document.createElement('button');
      btn.className = 'domain-btn';
      btn.dataset.domain = d.name;
      btn.dataset.custom = '1';
      btn.innerHTML = '<span class="emoji">🎛</span><span class="label">' + escapeHtml(d.name.slice(0, 8)) + '</span>';
      btn.onclick = function() { selectDomain(this, tab); };
      grid.appendChild(btn);
    });
  });
}

// Minimal markdown renderer
function markdownToHtml(md) {
  return md
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
    .replace(/^\`\`\`[\w]*\n([\s\S]*?)\`\`\`$/gm, '<pre><code>$1</code></pre>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      return '<tr>' + cells.map(c => '<td>' + c.trim() + '</td>').join('') + '</tr>';
    })
    .replace(/(<tr>.*<\/tr>\n?)+/g, (t) => '<table>' + t + '</table>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (l) => '<ul>' + l + '</ul>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/^(?!<[h|u|o|l|p|b|t|pre|blockquote])(.+)$/gm, '<p>$1</p>')
    .replace(/\n\n/g, '')
    .replace(/<\/p>\n<p>/g, '</p><p>');
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
</script>
</body>
</html>`;
}
