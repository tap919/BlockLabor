/**
 * Hermes Tool: Sports Steve Integration
 * 
 * Tool for Hermes agent to query Sports Steve betting API
 * and get sports analysis, picks, and odds.
 */

const SPORTS_STEVE_URL = 'http://localhost:8010';

export const sportsSteveTools = [
  {
    name: 'sports_steve_health',
    description: 'Check Sports Steve service health and status',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'sports_steve_analyze',
    description: 'Get AI-powered sports betting analysis for a given sport or event',
    inputSchema: {
      type: 'object',
      properties: {
        sport: { type: 'string', description: 'Sport (nba, nfl, nhl, mlb, nba)' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format (optional)' },
        focus: { type: 'string', description: 'Focus type: spreads, moneylines, totals, parlays' },
      },
      required: ['sport'],
    },
  },
  {
    name: 'sports_steve_picks',
    description: 'Get AI-generated betting picks with Kelly criterion sizing',
    inputSchema: {
      type: 'object',
      properties: {
        sport: { type: 'string', description: 'Sport to get picks for' },
        bankroll: { type: 'number', description: 'Current bankroll amount' },
        maxRisk: { type: 'number', description: 'Max risk percentage (default 2)' },
      },
      required: ['sport', 'bankroll'],
    },
  },
  {
    name: 'sports_steve_parlay',
    description: 'Generate optimized parlay combinations',
    inputSchema: {
      type: 'object',
      properties: {
        legs: { type: 'number', description: 'Number of legs (2-6)' },
        sport: { type: 'string', description: 'Sport for parlay' },
        stake: { type: 'number', description: 'Stake amount' },
      },
      required: ['legs', 'sport', 'stake'],
    },
  },
  {
    name: 'sports_steve_odds',
    description: 'Compare odds across sportsbooks for a game',
    inputSchema: {
      type: 'object',
      properties: {
        sport: { type: 'string', description: 'Sport' },
        matchup: { type: 'string', description: 'Matchup (e.g., Lakers vs Celtics)' },
      },
      required: ['sport', 'matchup'],
    },
  },
  {
    name: 'sports_steve_bankroll',
    description: 'Track and analyze bankroll performance',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['report', 'log_win', 'log_loss'], description: 'Action' },
        amount: { type: 'number', description: 'Win/Loss amount' },
        betId: { type: 'string', description: 'Bet ID (for logging)' },
      },
      required: ['action'],
    },
  },
];

export async function callSportsSteve(toolName: string, args: Record<string, unknown>) {
  const endpoint = `${SPORTS_STEVE_URL}/api/v1/${toolName.replace('sports_steve_', '')}`;
  
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    return await res.json();
  } catch (err) {
    return { error: `Sports Steve unavailable: ${err.message}` };
  }
}