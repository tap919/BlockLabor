/**
 * Marathon Memory Bridge for OverCoat.
 *
 * Integrates MarathonSession with DiskMemoryBank for deep autonomous coding
 * sessions that can span hours or days. This bridge enables:
 *
 * 1. **Session Persistence** - Save/restore marathon sessions to the 1GB partition
 * 2. **Rich Context Storage** - Store code context, decisions, file states
 * 3. **Autonomous Recovery** - Resume sessions after interruptions
 * 4. **Smart Context Retrieval** - Get relevant context for current task
 * 5. **Long-term Memory** - Remember decisions across multiple sessions
 *
 * This is the core of OverCoat's unique marketplace positioning for
 * enterprise-grade deep coding sessions.
 */

import * as fs from "fs";
import * as path from "path";
import { DiskMemoryBank, ONE_GIB, MemoryEntry } from "../memory/disk-bank";
import {
  MarathonSession,
  SessionCheckpoint,
  MarathonSessionConfig,
  SessionStats,
} from "./marathon";

export interface MarathonMemoryConfig {
  /** Directory for the disk memory bank (defaults to .overcoat/marathon-memory) */
  bankDir?: string;
  /** Capacity for the memory bank (defaults to 1 GiB) */
  capacityBytes?: number;
  /** Marathon session configuration */
  sessionConfig?: Partial<MarathonSessionConfig>;
  /** Auto-save interval in milliseconds (default 5 minutes) */
  autoSaveIntervalMs?: number;
  /** Maximum number of context snapshots to retain */
  maxContextSnapshots?: number;
}

export interface SessionSnapshot {
  id: string;
  sessionName: string;
  createdAt: number;
  resumedAt?: number;
  config: MarathonSessionConfig;
  checkpoints: SessionCheckpoint[];
  stats: SessionStats;
  context: SessionContext;
}

export interface SessionContext {
  currentTask?: string;
  filesInFocus: string[];
  recentDecisions: DecisionRecord[];
  codeSnippets: CodeSnippet[];
  keyInsights: string[];
  pendingWork: PendingWork[];
  workspaceState: Record<string, unknown>;
}

export interface DecisionRecord {
  id: string;
  timestamp: number;
  description: string;
  rationale: string;
  filesAffected: string[];
  outcome?: string;
}

export interface CodeSnippet {
  id: string;
  filePath: string;
  language: string;
  code: string;
  description: string;
  createdAt: number;
  relevanceScore: number;
}

export interface PendingWork {
  id: string;
  description: string;
  filePath?: string;
  priority: "high" | "medium" | "low";
  createdAt: number;
  blockedBy?: string[];
}

export interface MarathonMemoryStats {
  sessionActive: boolean;
  currentSessionName?: string;
  sessionDurationMs: number;
  totalCheckpoints: number;
  totalTokens: number;
  filesModified: string[];
  contextSnapshots: number;
  memoryBankStats: {
    capacityBytes: number;
    usedBytes: number;
    availableBytes: number;
    entryCount: number;
    usagePercent: number;
  };
}

const DEFAULT_CONFIG: Required<MarathonMemoryConfig> = {
  bankDir: ".overcoat/marathon-memory",
  capacityBytes: ONE_GIB,
  sessionConfig: {},
  autoSaveIntervalMs: 5 * 60 * 1000,
  maxContextSnapshots: 100,
};

const SESSION_PREFIX = "marathon:session:";
const CONTEXT_PREFIX = "marathon:context:";
const SNAPSHOT_PREFIX = "marathon:snapshot:";
const DECISION_PREFIX = "marathon:decision:";
const SNIPPET_PREFIX = "marathon: PENDING_PREFIXsnippet:";
const PENDING_PREFIX = "marathon:pending:";

export class MarathonMemoryBridge {
  private config: Required<MarathonMemoryConfig>;
  private memoryBank: DiskMemoryBank;
  private session: MarathonSession | null = null;
  private currentContext: SessionContext;
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private sessionId: string | null = null;

  constructor(config: MarathonMemoryConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.memoryBank = new DiskMemoryBank({
      bankDir: this.config.bankDir,
      capacityBytes: this.config.capacityBytes,
    });
    this.currentContext = this._createEmptyContext();
  }

  private _createEmptyContext(): SessionContext {
    return {
      filesInFocus: [],
      recentDecisions: [],
      codeSnippets: [],
      keyInsights: [],
      pendingWork: [],
      workspaceState: {},
    };
  }

  open(): void {
    this.memoryBank.open();
  }

  close(): void {
    this.stopAutoSave();
    if (this.session) {
      this.saveSession();
    }
  }

  startSession(name?: string): SessionSnapshot {
    const sessionName = name ?? `session-${Date.now()}`;
    this.sessionId = `${sessionName}-${Date.now()}`;
    
    this.session = new MarathonSession(this.config.sessionConfig);
    this.session.start();
    this.currentContext = this._createEmptyContext();
    this.currentContext.workspaceState["sessionId"] = this.sessionId;

    this._startAutoSave();

    const snapshot = this._createSnapshot();
    this._saveSnapshot(snapshot);
    
    return snapshot;
  }

  stopSession(): SessionSnapshot | null {
    if (!this.session) return null;

    this.stopAutoSave();
    this.session.stop();

    const snapshot = this._createSnapshot();
    snapshot.resumedAt = undefined;
    this._saveSnapshot(snapshot);

    const finalSession = this.session;
    this.session = null;
    this.sessionId = null;

    return snapshot;
  }

  resumeSession(sessionName?: string): SessionSnapshot | null {
    const snapshot = this._findLatestSession(sessionName);
    if (!snapshot) return null;

    this.sessionId = snapshot.id;
    this.currentContext = snapshot.context;

    this.session = new MarathonSession(snapshot.config);
    this.session.setStartTime(snapshot.stats.startedAt);
    this.session.restoreCheckpoints(snapshot.checkpoints);
    this.session.setTotalTokens(snapshot.stats.totalTokens);
    this.session.addFilesModified(snapshot.stats.filesModified);
    this.session.setBreaksTaken(snapshot.stats.breaksTaken);
    this.session.start();

    this._startAutoSave();

    snapshot.resumedAt = Date.now();
    this._saveSnapshot(snapshot);

    return snapshot;
  }

  private _findLatestSession(name?: string): SessionSnapshot | null {
    const entries = this.memoryBank.listEntries();
    const sessionEntries = entries
      .filter(e => e.key.startsWith(SNAPSHOT_PREFIX))
      .sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);

    for (const entry of sessionEntries) {
      if (name && !entry.key.includes(name)) continue;
      
      const data = this.memoryBank.read(entry.key);
      if (!data) continue;

      try {
        const snapshot = JSON.parse(data) as SessionSnapshot;
        if (!snapshot.resumedAt) {
          return snapshot;
        }
      } catch {
        continue;
      }
    }

    for (const entry of sessionEntries) {
      const data = this.memoryBank.read(entry.key);
      if (!data) continue;

      try {
        return JSON.parse(data) as SessionSnapshot;
      } catch {
        continue;
      }
    }

    return null;
  }

  listSessions(): SessionSnapshot[] {
    const entries = this.memoryBank.listEntries();
    const sessions: SessionSnapshot[] = [];

    for (const entry of entries) {
      if (!entry.key.startsWith(SNAPSHOT_PREFIX)) continue;
      
      const data = this.memoryBank.read(entry.key);
      if (!data) continue;

      try {
        sessions.push(JSON.parse(data) as SessionSnapshot);
      } catch {
        continue;
      }
    }

    return sessions.sort((a, b) => b.createdAt - a.createdAt);
  }

  deleteSession(sessionId: string): boolean {
    const key = `${SNAPSHOT_PREFIX}${sessionId}`;
    return this.memoryBank.delete(key);
  }

  saveSession(): void {
    if (!this.session || !this.sessionId) return;

    const snapshot = this._createSnapshot();
    this._saveSnapshot(snapshot);
  }

  private _createSnapshot(): SessionSnapshot {
    if (!this.session || !this.sessionId) {
      throw new Error("No active session to snapshot");
    }

    return {
      id: this.sessionId,
      sessionName: this.session.sessionConfig.name,
      createdAt: Date.now(),
      config: this.session.sessionConfig,
      checkpoints: this.session.getCheckpoints(),
      stats: this.session.getStats(),
      context: { ...this.currentContext },
    };
  }

  private _saveSnapshot(snapshot: SessionSnapshot): void {
    const key = `${SNAPSHOT_PREFIX}${snapshot.id}`;
    this.memoryBank.write(key, JSON.stringify(snapshot, null, 2), {
      summary: `Marathon session: ${snapshot.sessionName}`,
      tags: ["marathon", "session", snapshot.sessionName],
    });
  }

  recordContextChange(context: Partial<SessionContext>): void {
    this.currentContext = { ...this.currentContext, ...context };
  }

  addFileToFocus(filePath: string): void {
    if (!this.currentContext.filesInFocus.includes(filePath)) {
      this.currentContext.filesInFocus.unshift(filePath);
      if (this.currentContext.filesInFocus.length > 20) {
        this.currentContext.filesInFocus.pop();
      }
    }
  }

  removeFileFromFocus(filePath: string): void {
    this.currentContext.filesInFocus = 
      this.currentContext.filesInFocus.filter(f => f !== filePath);
  }

  recordDecision(
    description: string,
    rationale: string,
    filesAffected: string[],
    outcome?: string
  ): DecisionRecord {
    const decision: DecisionRecord = {
      id: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      description,
      rationale,
      filesAffected,
      outcome,
    };

    this.currentContext.recentDecisions.unshift(decision);
    if (this.currentContext.recentDecisions.length > 50) {
      this.currentContext.recentDecisions.pop();
    }

    const key = `${DECISION_PREFIX}${decision.id}`;
    this.memoryBank.write(key, JSON.stringify(decision), {
      summary: description,
      tags: ["decision", ...filesAffected.map(f => path.extname(f))],
    });

    return decision;
  }

  storeCodeSnippet(
    filePath: string,
    code: string,
    description: string,
    relevanceScore: number = 0.5
  ): CodeSnippet {
    const snippet: CodeSnippet = {
      id: `snip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      filePath,
      language: path.extname(filePath).slice(1) || "unknown",
      code,
      description,
      createdAt: Date.now(),
      relevanceScore,
    };

    this.currentContext.codeSnippets.unshift(snippet);
    if (this.currentContext.codeSnippets.length > this.config.maxContextSnapshots) {
      this.currentContext.codeSnippets.pop();
    }

    const key = `${SNIPPET_PREFIX}${snippet.id}`;
    this.memoryBank.write(key, JSON.stringify(snippet), {
      summary: description,
      tags: ["code-snippet", snippet.language, filePath],
    });

    return snippet;
  }

  addKeyInsight(insight: string): void {
    if (!this.currentContext.keyInsights.includes(insight)) {
      this.currentContext.keyInsights.unshift(insight);
      if (this.currentContext.keyInsights.length > 100) {
        this.currentContext.keyInsights.pop();
      }
    }
  }

  addPendingWork(
    description: string,
    filePath?: string,
    priority: "high" | "medium" | "low" = "medium",
    blockedBy?: string[]
  ): PendingWork {
    const work: PendingWork = {
      id: `work-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      description,
      filePath,
      priority,
      createdAt: Date.now(),
      blockedBy,
    };

    this.currentContext.pendingWork.unshift(work);

    const key = `${PENDING_PREFIX}${work.id}`;
    this.memoryBank.write(key, JSON.stringify(work), {
      summary: description,
      tags: ["pending", priority, filePath ? path.extname(filePath) : ""],
    });

    return work;
  }

  completePendingWork(workId: string): boolean {
    const index = this.currentContext.pendingWork.findIndex(w => w.id === workId);
    if (index === -1) return false;

    this.currentContext.pendingWork.splice(index, 1);
    const key = `${PENDING_PREFIX}${workId}`;
    this.memoryBank.delete(key);

    return true;
  }

  getRelevantContext(query: string): {
    decisions: DecisionRecord[];
    snippets: CodeSnippet[];
    insights: string[];
    pendingWork: PendingWork[];
  } {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);

    const decisions = this.currentContext.recentDecisions
      .filter(d => 
        d.description.toLowerCase().includes(queryLower) ||
        d.rationale.toLowerCase().includes(queryLower) ||
        d.filesAffected.some(f => queryLower.includes(path.basename(f).toLowerCase()))
      )
      .slice(0, 10);

    const snippets = this.currentContext.codeSnippets
      .filter(s =>
        s.description.toLowerCase().includes(queryLower) ||
        s.filePath.toLowerCase().includes(queryLower) ||
        queryWords.some(w => s.code.toLowerCase().includes(w))
      )
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 5);

    const insights = this.currentContext.keyInsights
      .filter(i => queryWords.some(w => i.toLowerCase().includes(w)))
      .slice(0, 5);

    const pendingWork = this.currentContext.pendingWork
      .filter(p =>
        p.description.toLowerCase().includes(queryLower) ||
        (p.filePath && queryLower.includes(path.basename(p.filePath).toLowerCase()))
      )
      .slice(0, 5);

    return { decisions, snippets, insights, pendingWork };
  }

  getFilesInFocus(): string[] {
    return [...this.currentContext.filesInFocus];
  }

  getPendingWork(): PendingWork[] {
    return [...this.currentContext.pendingWork];
  }

  getDecisions(): DecisionRecord[] {
    return [...this.currentContext.recentDecisions];
  }

  createCheckpoint(label: string): SessionCheckpoint | null {
    if (!this.session) return null;

    const contextCopy = JSON.stringify(this.currentContext);
    return this.session.createCheckpoint(label, {
      contextSnapshot: contextCopy,
      filesInFocus: this.currentContext.filesInFocus,
      pendingWorkCount: this.currentContext.pendingWork.length,
    });
  }

  getSessionStats(): MarathonMemoryStats | null {
    if (!this.session) {
      return {
        sessionActive: false,
        sessionDurationMs: 0,
        totalCheckpoints: 0,
        totalTokens: 0,
        filesModified: [],
        contextSnapshots: 0,
        memoryBankStats: this._getMemoryStats(),
      };
    }

    const stats = this.session.getStats();
    return {
      sessionActive: true,
      currentSessionName: this.session.sessionConfig.name,
      sessionDurationMs: stats.durationMs,
      totalCheckpoints: stats.checkpoints,
      totalTokens: stats.totalTokens,
      filesModified: stats.filesModified,
      contextSnapshots: this.currentContext.codeSnippets.length,
      memoryBankStats: this._getMemoryStats(),
    };
  }

  private _getMemoryStats() {
    const memStats = this.memoryBank.getStats();
    return {
      capacityBytes: memStats.capacityBytes,
      usedBytes: memStats.usedBytes,
      availableBytes: memStats.availableBytes,
      entryCount: memStats.entryCount,
      usagePercent: memStats.usagePercent,
    };
  }

  isSessionActive(): boolean {
    return this.session !== null;
  }

  getCurrentContext(): SessionContext {
    return { ...this.currentContext };
  }

  recordTokens(count: number): void {
    if (this.session) {
      this.session.recordTokens(count);
    }
  }

  recordFileModified(filePath: string): void {
    if (this.session) {
      this.session.recordFileModified(filePath);
    }
    this.addFileToFocus(filePath);
  }

  acknowledgeBreak(): void {
    if (this.session) {
      this.session.acknowledgeBreak();
    }
  }

  isOverMaxDuration(): boolean {
    return this.session?.isOverMaxDuration() ?? false;
  }

  private _startAutoSave(): void {
    if (this.autoSaveTimer !== null) return;

    this.autoSaveTimer = setInterval(() => {
      this.saveSession();
    }, this.config.autoSaveIntervalMs);
  }

  stopAutoSave(): void {
    if (this.autoSaveTimer !== null) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  searchMemory(query: string): {
    sessions: SessionSnapshot[];
    decisions: DecisionRecord[];
    snippets: CodeSnippet[];
  } {
    const sessionEntries = this.memoryBank.search(query).filter(e => e.key.startsWith(SNAPSHOT_PREFIX));
    const sessions: SessionSnapshot[] = [];
    
    for (const entry of sessionEntries.slice(0, 10)) {
      const data = this.memoryBank.read(entry.key);
      if (data) {
        try {
          sessions.push(JSON.parse(data) as SessionSnapshot);
        } catch {
          continue;
        }
      }
    }

    const decisionEntries = this.memoryBank.search(query).filter(e => e.key.startsWith(DECISION_PREFIX));
    const decisions: DecisionRecord[] = [];
    
    for (const entry of decisionEntries.slice(0, 10)) {
      const data = this.memoryBank.read(entry.key);
      if (data) {
        try {
          decisions.push(JSON.parse(data) as DecisionRecord);
        } catch {
          continue;
        }
      }
    }

    const snippetEntries = this.memoryBank.search(query).filter(e => e.key.startsWith(SNIPPET_PREFIX));
    const snippets: CodeSnippet[] = [];
    
    for (const entry of snippetEntries.slice(0, 10)) {
      const data = this.memoryBank.read(entry.key);
      if (data) {
        try {
          snippets.push(JSON.parse(data) as CodeSnippet);
        } catch {
          continue;
        }
      }
    }

    return { sessions, decisions, snippets };
  }

  exportSession(sessionId: string): string | null {
    const sessions = this.listSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return null;
    return JSON.stringify(session, null, 2);
  }

  importSession(jsonData: string): SessionSnapshot | null {
    try {
      const snapshot = JSON.parse(jsonData) as SessionSnapshot;
      if (!snapshot.id || !snapshot.sessionName) {
        throw new Error("Invalid session snapshot");
      }
      this._saveSnapshot(snapshot);
      return snapshot;
    } catch {
      return null;
    }
  }

  getMemoryBank(): DiskMemoryBank {
    return this.memoryBank;
  }
}
