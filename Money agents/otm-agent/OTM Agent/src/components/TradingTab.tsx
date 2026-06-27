"use client";

import { useState, useEffect, useCallback } from "react";

// ============================================================================
// TYPES
// ============================================================================

interface Position {
  id: string;
  symbol: string;
  type: "stock" | "crypto" | "option";
  quantity: number;
  avgCost: number;
  currentPrice: number;
  change: number;
  changePercent: number;
  value: number;
  pnl: number;
}

interface TradingSystem {
  id: string;
  name: string;
  status: "running" | "stopped" | "error";
  icon: string;
  description: string;
  details: Record<string, string | number>;
}

interface TradeLog {
  id: string;
  time: string;
  symbol: string;
  action: "BUY" | "SELL" | "HOLD";
  price: number;
  quantity: number;
  system: string;
}

// ============================================================================
// FALLBACK DATA
// ============================================================================

const FALLBACK_POSITIONS: Position[] = [
  { id: "1", symbol: "AAPL", type: "stock", quantity: 15, avgCost: 175.20, currentPrice: 182.45, change: 2.18, changePercent: 1.21, value: 2736.75, pnl: 108.75 },
  { id: "2", symbol: "BTC", type: "crypto", quantity: 0.15, avgCost: 62000, currentPrice: 67420, change: 1250, changePercent: 1.89, value: 10113, pnl: 813 },
  { id: "3", symbol: "ETH", type: "crypto", quantity: 2.5, avgCost: 3200, currentPrice: 3450, change: -45, changePercent: -1.29, value: 8625, pnl: 625 },
  { id: "4", symbol: "NVDA", type: "stock", quantity: 8, avgCost: 870, currentPrice: 924.50, change: 15.30, changePercent: 1.68, value: 7396, pnl: 436 },
  { id: "5", symbol: "SOL", type: "crypto", quantity: 40, avgCost: 145, currentPrice: 158.20, change: 3.80, changePercent: 2.46, value: 6328, pnl: 528 },
];

const FALLBACK_SYSTEMS: TradingSystem[] = [
  { id: "freqtrade", name: "Freqtrade", status: "stopped", icon: "F", description: "Algorithmic crypto trading bot", details: { "Active Bots": 0, "Daily PnL": "$0", "Strategy": "RSI+MACD" } },
  { id: "superalgos", name: "Superalgos", status: "stopped", icon: "S", description: "Visual trading & social trading", details: { "Projects": 0, "Signals": 0, "Community": "Connected" } },
  { id: "tradingagents", name: "TradingAgents", status: "stopped", icon: "A", description: "Multi-agent trading intelligence", details: { "Agents": 0, "Tasks": 0, "Accuracy": "N/A" } },
  { id: "mem0", name: "Mem0 Memory", status: "stopped", icon: "M", description: "Context-aware trading memory", details: { "Memories": 0, "Last Access": "N/A", "Category": "trading" } },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function TradingTab() {
  const [positions, setPositions] = useState<Position[]>(FALLBACK_POSITIONS);
  const [systems, setSystems] = useState<TradingSystem[]>(FALLBACK_SYSTEMS);
  const [tradeLogs, setTradeLogs] = useState<TradeLog[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>("AAPL");
  const [watchlistInput, setWatchlistInput] = useState("");

  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const totalPnlPercent = totalValue > 0 ? (totalPnl / (totalValue - totalPnl)) * 100 : 0;

  const allocationByType = positions.reduce(
    (acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + p.value;
      return acc;
    },
    {} as Record<string, number>,
  );

  const addTradeLog = useCallback((symbol: string, action: TradeLog["action"], price: number, quantity: number, system: string) => {
    const now = new Date();
    const time = now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0");
    setTradeLogs((prev) => [{ id: crypto.randomUUID(), time, symbol, action, price, quantity, system }, ...prev].slice(0, 20));
  }, []);

  // Simulate price updates
  useEffect(() => {
    const interval = setInterval(() => {
      setPositions((prev) =>
        prev.map((p) => {
          const delta = (Math.random() - 0.48) * p.currentPrice * 0.002;
          const newPrice = Math.max(0.01, p.currentPrice + delta);
          const newChange = newPrice - p.avgCost;
          const newPnl = newChange * p.quantity;
          return {
            ...p,
            currentPrice: parseFloat(newPrice.toFixed(2)),
            change: parseFloat(delta.toFixed(2)),
            changePercent: parseFloat(((delta / p.currentPrice) * 100).toFixed(2)),
            value: parseFloat((newPrice * p.quantity).toFixed(2)),
            pnl: parseFloat(newPnl.toFixed(2)),
          };
        }),
      );
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Simulate occasional trade signals
  useEffect(() => {
    const interval = setInterval(() => {
      const pos = positions[Math.floor(Math.random() * positions.length)];
      const actions: TradeLog["action"][] = ["BUY", "SELL", "HOLD"];
      const action = actions[Math.floor(Math.random() * actions.length)];
      addTradeLog(pos.symbol, action, pos.currentPrice, Math.floor(Math.random() * 5) + 1, "TradingAgents");
    }, 12000);
    return () => clearInterval(interval);
  }, [positions, addTradeLog]);

  const selectedPosition = positions.find((p) => p.symbol === selectedSymbol);

  return (
    <div className="tab-content">
      {/* Portfolio Overview */}
      <section className="panel panel-full">
        <div className="panel-title">Portfolio Overview</div>
        <div className="portfolio-overview-grid">
          <div className="port-value-card">
            <div className="port-label">Total Value</div>
            <div className="port-value">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className={`port-change ${totalPnl >= 0 ? "positive" : "negative"}`}>
              {totalPnl >= 0 ? "+" : ""}{totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({totalPnlPercent.toFixed(2)}%)
            </div>
          </div>
          <div className="port-alloc-card">
            <div className="port-label">Allocation</div>
            <div className="port-alloc-bars">
              {Object.entries(allocationByType).map(([type, value]) => (
                <div key={type} className="alloc-bar-row">
                  <span className="alloc-type">{type}</span>
                  <div className="alloc-bar-wrap">
                    <div
                      className={`alloc-bar-fill alloc-${type}`}
                      style={{ width: `${(value / totalValue) * 100}%` }}
                    ></div>
                  </div>
                  <span className="alloc-pct">{((value / totalValue) * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="port-perf-card">
            <div className="port-label">Performance</div>
            <div className="perf-grid">
              <div className="perf-item">
                <span className="perf-period">Today</span>
                <span className={`perf-value ${totalPnl >= 0 ? "positive" : "negative"}`}>
                  {totalPnl >= 0 ? "+" : ""}{totalPnlPercent.toFixed(2)}%
                </span>
              </div>
              <div className="perf-item">
                <span className="perf-period">Week</span>
                <span className="perf-value positive">+3.42%</span>
              </div>
              <div className="perf-item">
                <span className="perf-period">Month</span>
                <span className="perf-value positive">+8.17%</span>
              </div>
              <div className="perf-item">
                <span className="perf-period">Year</span>
                <span className="perf-value positive">+24.56%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Positions Table */}
      <section className="panel panel-full">
        <div className="panel-title">Open Positions <span>{positions.length} active</span></div>
        <div className="positions-table">
          <div className="pos-header">
            <span className="pos-col pos-sym">Symbol</span>
            <span className="pos-col pos-type">Type</span>
            <span className="pos-col pos-qty">Qty</span>
            <span className="pos-col pos-price">Price</span>
            <span className="pos-col pos-chg">Change</span>
            <span className="pos-col pos-val">Value</span>
            <span className="pos-col pos-pnl">P&L</span>
          </div>
          {positions.map((pos) => (
            <div
              key={pos.id}
              className={`pos-row ${selectedSymbol === pos.symbol ? "pos-selected" : ""}`}
              onClick={() => setSelectedSymbol(pos.symbol)}
            >
              <span className="pos-col pos-sym pos-sym-val">{pos.symbol}</span>
              <span className="pos-col pos-type">
                <span className={`type-badge type-${pos.type}`}>{pos.type}</span>
              </span>
              <span className="pos-col pos-qty">{pos.quantity}</span>
              <span className="pos-col pos-price">${pos.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              <span className={`pos-col pos-chg ${pos.change >= 0 ? "positive" : "negative"}`}>
                {pos.change >= 0 ? "+" : ""}{pos.changePercent.toFixed(2)}%
              </span>
              <span className="pos-col pos-val">${pos.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              <span className={`pos-col pos-pnl ${pos.pnl >= 0 ? "positive" : "negative"}`}>
                {pos.pnl >= 0 ? "+" : ""}${pos.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Trading Terminal + Systems */}
      <section className="panel">
        <div className="panel-title">Trading Terminal</div>
        {selectedPosition && (
          <div className="terminal-content">
            <div className="terminal-symbol">
              <span className="terminal-sym">{selectedPosition.symbol}</span>
              <span className="terminal-price">${selectedPosition.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              <span className={`terminal-change ${selectedPosition.change >= 0 ? "positive" : "negative"}`}>
                {selectedPosition.change >= 0 ? "+" : ""}{selectedPosition.changePercent.toFixed(2)}%
              </span>
            </div>
            <div className="terminal-details">
              <div className="terminal-detail">
                <span className="td-label">Avg Cost</span>
                <span className="td-value">${selectedPosition.avgCost.toLocaleString()}</span>
              </div>
              <div className="terminal-detail">
                <span className="td-label">Quantity</span>
                <span className="td-value">{selectedPosition.quantity}</span>
              </div>
              <div className="terminal-detail">
                <span className="td-label">Value</span>
                <span className="td-value">${selectedPosition.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="terminal-detail">
                <span className="td-label">P&L</span>
                <span className={`td-value ${selectedPosition.pnl >= 0 ? "positive" : "negative"}`}>
                  {selectedPosition.pnl >= 0 ? "+" : ""}${selectedPosition.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <div className="terminal-actions">
              <button className="btn terminal-buy">BUY</button>
              <button className="btn terminal-sell">SELL</button>
            </div>
            <div className="watchlist-add">
              <input
                type="text"
                placeholder="Add symbol..."
                value={watchlistInput}
                onChange={(e) => setWatchlistInput(e.target.value.toUpperCase())}
                className="watchlist-input"
              />
              <button className="btn-ghost" onClick={() => setWatchlistInput("")}>ADD</button>
            </div>
          </div>
        )}
      </section>

      {/* Trading Systems */}
      <section className="panel">
        <div className="panel-title">Integrated Trading Systems</div>
        <div className="trading-systems">
          {systems.map((sys) => (
            <div key={sys.id} className={`system-card system-${sys.status}`}>
              <div className="system-header">
                <span className="system-icon">{sys.icon}</span>
                <div className="system-info">
                  <span className="system-name">{sys.name}</span>
                  <span className="system-desc">{sys.description}</span>
                </div>
                <span className={`svc-badge svc-badge-${sys.status === "running" ? "online" : sys.status === "error" ? "error" : "offline"}`}>
                  {sys.status.toUpperCase()}
                </span>
              </div>
              <div className="system-details">
                {Object.entries(sys.details).map(([k, v]) => (
                  <div key={k} className="system-detail-item">
                    <span className="sd-label">{k}</span>
                    <span className="sd-value">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Trade Signal Log */}
      <section className="panel panel-full">
        <div className="panel-title">Agent Trade Signals</div>
        <div className="log-box">
          {tradeLogs.length === 0 ? (
            <div className="log-line">
              <span className="log-time">[--:--]</span>
              <span className="log-msg info">Waiting for trade signals...</span>
            </div>
          ) : (
            tradeLogs.map((log) => (
              <div key={log.id} className="log-line">
                <span className="log-time">[{log.time}]</span>
                <span className={`log-msg ${log.action === "BUY" ? "success" : log.action === "SELL" ? "warn" : "info"}`}>
                  [{log.system}] {log.action} {log.quantity}x {log.symbol} @ ${log.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
