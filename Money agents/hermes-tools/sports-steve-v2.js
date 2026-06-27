/**
 * Hermes Sports Steve MVP Integration - Complete v2 wrapper (plain JS)
 * Provides typed tool wrappers around the Sports Steve MVP backend (port 8010)
 */

const SPORTS_V2_BASE = 'http://localhost:8010';

// ─────────────────────────────────────────────
// HTTP call helper
// ─────────────────────────────────────────────

async function mvpFetch(path, body) {
  const url = `${SPORTS_V2_BASE}${path}`;
  const opts = { signal: AbortSignal.timeout(10000) };
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

async function sportsSteveV2Health() {
  return mvpFetch('/health');
}

async function sportsSteveV2Analyze(req) {
  return mvpFetch('/analyze', req);
}

async function sportsSteveV2Picks(sport) {
  return mvpFetch(`/picks?sport=${encodeURIComponent(sport)}`);
}

// ─────────────────────────────────────────────
// Unified dispatcher (used by Hermes agent)
// ─────────────────────────────────────────────

async function dispatchSportsSteveV2(toolName, args) {
  switch (toolName) {
    case 'sports_steve_v2_health':
      return sportsSteveV2Health();
    case 'sports_steve_v2_analyze':
      return sportsSteveV2Analyze(args);
    case 'sports_steve_v2_picks':
      return sportsSteveV2Picks(args.sport);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// ─────────────────────────────────────────────
// Tool definitions (Hermes schema-compatible)
// ─────────────────────────────────────────────

const sportsSteveV2Tools = [
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
];

module.exports = {
  dispatchSportsSteveV2,
  sportsSteveV2Tools,
  sportsSteveV2Health,
  sportsSteveV2Analyze,
  sportsSteveV2Picks,
};
