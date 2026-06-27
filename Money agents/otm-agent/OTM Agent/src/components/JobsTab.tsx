"use client";

import { useState, useEffect } from "react";

interface EngineStatus {
  running: boolean;
  cycleCount: number;
  lastCycleAt: string;
  config: {
    intervalMs: number;
    autoEnqueueThreshold: number;
    maxClaimsPerCycle: number;
    payoutThresholdUsd: number;
  };
  lastCycleResult?: {
    cycleNumber: number;
    scanned: {
      platformsHit: number;
      opportunitiesFound: number;
      errors: string[];
    };
    enqueued: number;
    claimed: number;
    executed: Array<{
      platform: string;
      outcome: string;
      summary: string;
      earned: number;
    }>;
  };
}

export function JobsTab() {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [jobs, setJobs] = useState<Array<{src: string; status: string; result: string; earnedUsd: string}>>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/engine");
        const data = await res.json();
        setStatus(data.status);
      } catch (e) {
        console.error("Failed to fetch engine status:", e);
      }
      
      try {
        const res = await fetch("/api/jobs");
        const data = await res.json();
        setJobs(data.jobs || []);
      } catch (e) {
        console.error("Failed to fetch jobs:", e);
      }
    }
    
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h2 style={{ marginBottom: "20px" }}>🚀 Autonomous Engine Status</h2>
      
      {status ? (
        <div style={{ marginBottom: "30px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "15px", marginBottom: "20px" }}>
            <div style={{ background: "#1a1a2e", padding: "15px", borderRadius: "8px" }}>
              <div style={{ color: "#666", fontSize: "12px" }}>STATUS</div>
              <div style={{ color: status.running ? "#0f0" : "#f00", fontSize: "24px", fontWeight: "bold" }}>
                {status.running ? "RUNNING" : "STOPPED"}
              </div>
            </div>
            <div style={{ background: "#1a1a2e", padding: "15px", borderRadius: "8px" }}>
              <div style={{ color: "#666", fontSize: "12px" }}>CYCLES</div>
              <div style={{ color: "#fff", fontSize: "24px", fontWeight: "bold" }}>{status.cycleCount || 0}</div>
            </div>
            <div style={{ background: "#1a1a2e", padding: "15px", borderRadius: "8px" }}>
              <div style={{ color: "#666", fontSize: "12px" }}>THRESHOLD</div>
              <div style={{ color: "#fff", fontSize: "24px", fontWeight: "bold" }}>{status.config?.autoEnqueueThreshold || 60}</div>
            </div>
            <div style={{ background: "#1a1a2e", padding: "15px", borderRadius: "8px" }}>
              <div style={{ color: "#666", fontSize: "12px" }}>EARNED</div>
              <div style={{ color: "#0f0", fontSize: "24px", fontWeight: "bold" }}>$0.00</div>
            </div>
          </div>
          
          {status.lastCycleResult && (
            <div style={{ background: "#1a1a2e", padding: "15px", borderRadius: "8px", marginBottom: "20px" }}>
              <h3 style={{ margin: "0 0 15px 0", color: "#fff" }}>Last Cycle (#{status.lastCycleResult.cycleNumber})</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                <div>Scanned: <span style={{ color: "#0af" }}>{status.lastCycleResult.scanned?.opportunitiesFound || 0}</span> opps</div>
                <div>Enqueued: <span style={{ color: "#0af" }}>{status.lastCycleResult.enqueued || 0}</span></div>
                <div>Claimed: <span style={{ color: "#fa0" }}>{status.lastCycleResult.claimed || 0}</span></div>
                <div>Executed: <span style={{ color: "#0f0" }}>{status.lastCycleResult.executed?.length || 0}</span></div>
              </div>
            </div>
          )}
          
          {status.lastCycleResult?.executed && status.lastCycleResult.executed.length > 0 && (
            <div style={{ background: "#1a1a2e", padding: "15px", borderRadius: "8px" }}>
              <h3 style={{ margin: "0 0 15px 0", color: "#fff" }}>Executed Jobs</h3>
              {status.lastCycleResult.executed.map((job, i) => (
                <div key={i} style={{ 
                  background: "#0a0a15", 
                  padding: "10px", 
                  marginBottom: "8px", 
                  borderRadius: "4px",
                  borderLeft: job.platform === "Reddit" ? "3px solid #f00" : "3px solid #0f0"
                }}>
                  <div style={{ color: job.platform === "Reddit" ? "#f55" : "#5f5", fontWeight: "bold" }}>
                    {job.platform}
                  </div>
                  <div style={{ color: "#888", fontSize: "12px", marginTop: "4px" }}>
                    {job.summary.substring(0, 120)}...
                  </div>
                  <div style={{ color: "#fa0", fontSize: "12px", marginTop: "4px" }}>
                    Earned: ${job.earned}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ color: "#666" }}>Loading engine status...</div>
      )}
      
      <h3 style={{ marginTop: "30px" }}>Recent Jobs</h3>
      {jobs.length > 0 ? (
        <div style={{ background: "#1a1a2e", padding: "15px", borderRadius: "8px" }}>
          {jobs.slice(0, 10).map((job, i) => (
            <div key={i} style={{ 
              padding: "8px", 
              marginBottom: "4px", 
              background: "#0a0a15",
              borderRadius: "4px",
              borderLeft: job.status === "completed" ? "3px solid #0f0" : job.status === "queued" ? "3px solid #0af" : "3px solid #666"
            }}>
              <span style={{ color: "#888" }}>[{job.src}]</span>{" "}
              <span style={{ color: job.status === "completed" ? "#0f0" : "#0af" }}>{job.status}</span>{" "}
              <span style={{ color: "#666", fontSize: "12px" }}>${job.earnedUsd}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: "#666" }}>No jobs yet</div>
      )}
    </div>
  );
}
