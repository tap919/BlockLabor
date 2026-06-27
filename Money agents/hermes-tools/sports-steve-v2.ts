/**
 * Hermes Sports Steve MVP Integration - Complete v2 wrapper
 * Provides typed tool wrappers around the Sports Steve MVP backend (port 8010)
 */

const SPORTS_V2_BASE = 'http://localhost:8010';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface AnalyzeRequest {
  sport: string;
  bankroll?: number;
  max_risk_pct?: number;
  date?: string;
  focus?: string;
}

export interface Pick {
  game: string;
  home: string;
  away: string;
  pick: string;
  edge: number;
  signal: string;
}

export interface AnalyzeResult {
  strategy: string;
  picks: Pick[];
}

export interface HealthResult {
  status: string;
  version: string;
}

// ─────────────────────────────────────────────
// Tool definitions (Hermes schema-compatible)
// ─────────────────────────────────────────────

export const sportsSteveV2Tools = [
  {
    name: 'sports_steve_v2_health',
    description: 'Check Sports Steve MVP backend health and version',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'sports_steve_v2_analyze',
    description:
      'Run AI sports betting analysis for a given sport. Returns strategy + picks with edge scores.',
    inputSchema: {
      type: 'object',
      properties: {
        sport: { type: 'string', description: 'Sport: nba, nfl, nhl, mlb' },
        bankroll: { type: 'number', description: 'Current bankroll', default: 100 },
        max_risk_pct: {
          type: 'number',
          description: 'Max risk per bet as percentage',
          default: 2.0,
        },
        date: {
          type: 'string',
          description: 'Date YYYY-MM-DD (optional)',
        },
        focus: {
          type: 'string',
          description: 'Focus: spreads | moneylines | totals | parlays',
        },
      },
      required: ['sport'],
    },
  },
  {
    name: 'sports_steve_v2_picks',
    description: 'Get quick generated picks for a sport',
    inputSchema: {
      type: 'object',
      properties: {
        sport: { type: 'string', description: 'Sport: nba, nfl, nhl, mlb' },
      },
      required: ['sport'],
    },
  },
] as const;

// ─────────────────────────────────────────────
// HTTP call helper
// ─────────────────────────────────────────────

async function mvpFetch(path: string, body?: unknown): Promise<any> {
  const url = `${SPORTS_V2_BASE}${path}`;
  const opts: RequestInit = {
    signal: AbortSignal.timeout(10000),
  };
  if (body) {
    opts.method = 'POST';
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  if (!res.ok) {
    throw new Error(`MVP error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

// ─────────────────────────────────────────────
// Tool implementations
// ─────────────────────────────────────────────

export async function sportsSteveV2Health(): Promise<HealthResult> {
  return mvpFetch('/health');
}

export async function sportsSteveV2Analyze(
  req: AnalyzeRequest
): Promise<AnalyzeResult> {
  return mvpFetch('/analyze', req);
}

export async function sportsSteveV2Picks(sport: string): Promise<{
  picks: Pick[];
}> {
  return mvpFetch(`/picks?sport=${encodeURIComponent(sport)}`);
}

// ─────────────────────────────────────────────
// Unified dispatcher (used by Hermes agent)
// ─────────────────────────────────────────────

export async function dispatchSportsSteveV2(
  toolName: string,
  args: Record<string, any>
): Promise<any> {
  switch (toolName) {
    case 'sports_steve_v2_health':
      return sportsSteveV2Health();
    case 'sports_steve_v2_analyze':
      return sportsSteveV2Analyze(args as AnalyzeRequest);
    case 'sports_steve_v2_picks':
      return sportsSteveV2Picks(args.sport as string);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
