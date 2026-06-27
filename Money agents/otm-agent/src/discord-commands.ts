/**
 * TapClaw Discord Bot — slash command definitions.
 * Each entry is passed to the Discord REST API at registration time.
 */

export interface SlashCommand {
  name: string;
  description: string;
  options?: SlashCommandOption[];
}

export interface SlashCommandOption {
  type: number;
  name: string;
  description: string;
  required?: boolean;
  choices?: { name: string; value: string }[];
}

// Discord ApplicationCommandOptionType constants (subset used here)
const STRING = 3;
const INTEGER = 4;
const BOOLEAN = 5;

export const TAPCLAW_COMMANDS: SlashCommand[] = [
  // ── General ──────────────────────────────────────────────────────────────
  {
    name: "ping",
    description: "Check if the TapClaw bot is alive",
  },
  {
    name: "status",
    description: "Show TapClaw system status and current metrics",
    options: [
      {
        type: STRING,
        name: "period",
        description: "Time period for metrics (day, week, month, all)",
        required: false,
        choices: [
          { name: "Today", value: "day" },
          { name: "This week", value: "week" },
          { name: "This month", value: "month" },
          { name: "All time", value: "all" },
        ],
      },
    ],
  },

  // ── Opportunity scanning ──────────────────────────────────────────────────
  {
    name: "scan",
    description: "Scan for new money-making opportunities across platforms",
    options: [
      {
        type: INTEGER,
        name: "limit",
        description: "Max results to return (1–20, default 5)",
        required: false,
      },
      {
        type: INTEGER,
        name: "min_score",
        description: "Minimum score threshold 0-100 (default 70)",
        required: false,
      },
    ],
  },
  {
    name: "quickscan",
    description: "Fast single-platform pulse check (top 5 results)",
    options: [
      {
        type: STRING,
        name: "platform",
        description: "Platform to scan",
        required: false,
        choices: [
          { name: "Upwork", value: "upwork" },
          { name: "Fiverr", value: "fiverr" },
          { name: "Reddit", value: "reddit" },
          { name: "Clickworker", value: "clickworker" },
        ],
      },
    ],
  },

  // ── Strategy ─────────────────────────────────────────────────────────────
  {
    name: "strategies",
    description: "Get recommended income strategies based on your bankroll",
    options: [
      {
        type: INTEGER,
        name: "bankroll",
        description: "Available capital in USD (default: configured bankroll)",
        required: false,
      },
      {
        type: INTEGER,
        name: "hours",
        description: "Hours available per day (1–24, default 2)",
        required: false,
      },
      {
        type: STRING,
        name: "risk",
        description: "Risk tolerance",
        required: false,
        choices: [
          { name: "Low", value: "low" },
          { name: "Medium", value: "medium" },
          { name: "High", value: "high" },
        ],
      },
    ],
  },

  // ── Analysis ─────────────────────────────────────────────────────────────
  {
    name: "analyze",
    description: "Analyze a specific opportunity for feasibility and risk",
    options: [
      {
        type: STRING,
        name: "description",
        description: "Description of the opportunity",
        required: true,
      },
      {
        type: STRING,
        name: "source",
        description: "Source platform (Upwork, Fiverr, Reddit, etc.)",
        required: true,
      },
      {
        type: STRING,
        name: "amount",
        description: "Potential earnings (e.g. '$50', '$20/hr')",
        required: false,
      },
    ],
  },

  // ── Payout / earnings ────────────────────────────────────────────────────
  {
    name: "earnings",
    description: "Show earnings summary and withdrawal history",
    options: [
      {
        type: STRING,
        name: "period",
        description: "Time period",
        required: false,
        choices: [
          { name: "Today", value: "day" },
          { name: "This week", value: "week" },
          { name: "This month", value: "month" },
          { name: "All time", value: "all" },
        ],
      },
    ],
  },

  // ── Chat / general update ─────────────────────────────────────────────────
  {
    name: "update",
    description: "Ask TapClaw for a plain-English update on what's happening",
  },
  {
    name: "help",
    description: "Show all available TapClaw commands",
  },
];
