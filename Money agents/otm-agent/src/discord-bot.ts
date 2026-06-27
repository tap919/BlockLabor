/**
 * TapClaw Discord Bot
 *
 * Provides slash commands for TapClaw updates, opportunity scanning,
 * strategy recommendations, and earnings tracking.
 *
 * Usage:
 *   1. Set DISCORD_BOT_TOKEN, DISCORD_APP_ID, DISCORD_PUBLIC_KEY in your .env
 *   2. Run `node --loader ts-node/esm src/discord-register.ts` once to register commands
 *   3. Run `node --loader ts-node/esm src/discord-bot.ts` to start the bot
 *
 * Or from extensions/otm-agent/:
 *   pnpm discord:register
 *   pnpm discord:start
 */

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  ActivityType,
} from "discord.js";

// ---------------------------------------------------------------------------
// Config from env
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
        `Set it in your .env file or shell before starting the bot.`,
    );
  }
  return val;
}

// ---------------------------------------------------------------------------
// Auth gate — restrict sensitive commands to allowlisted users/roles
// ---------------------------------------------------------------------------

/** Commands that anyone can run (read-only, no engine side-effects). */
const PUBLIC_COMMANDS = new Set(["ping", "help"]);

/**
 * Parse a comma-separated env var into a Set of trimmed, non-empty strings.
 * Returns an empty Set if the var is unset or blank.
 */
function parseAllowlist(envVar: string): Set<string> {
  const raw = process.env[envVar] ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/**
 * Check whether the interaction caller is authorized.
 *
 * Authorization rules:
 *  1. If neither OTM_DISCORD_ALLOWED_USERS nor OTM_DISCORD_ALLOWED_ROLES is
 *     set, ALL commands are blocked (fail-closed) and the bot logs a setup
 *     warning.
 *  2. If the caller's Discord user ID is in OTM_DISCORD_ALLOWED_USERS → allow.
 *  3. If the caller has any guild role whose ID is in
 *     OTM_DISCORD_ALLOWED_ROLES → allow.
 *  4. Otherwise → deny.
 */
async function isAuthorized(interaction: ChatInputCommandInteraction): Promise<boolean> {
  const allowedUsers = parseAllowlist("OTM_DISCORD_ALLOWED_USERS");
  const allowedRoles = parseAllowlist("OTM_DISCORD_ALLOWED_ROLES");

  // Fail-closed: if no allowlists configured, deny everything
  if (allowedUsers.size === 0 && allowedRoles.size === 0) {
    console.warn(
      "[auth] Neither OTM_DISCORD_ALLOWED_USERS nor OTM_DISCORD_ALLOWED_ROLES is set. " +
        "All non-public commands are blocked. Set at least one to enable the bot.",
    );
    return false;
  }

  // Check user ID allowlist
  if (allowedUsers.has(interaction.user.id)) return true;

  // Check role allowlist (requires guild context)
  if (allowedRoles.size > 0 && interaction.guild && interaction.member) {
    const memberRoles = interaction.member.roles;
    // memberRoles can be a GuildMemberRoleManager (cache) or string[] (API)
    if (Array.isArray(memberRoles)) {
      for (const roleId of memberRoles) {
        if (allowedRoles.has(roleId)) return true;
      }
    } else if ("cache" in memberRoles) {
      for (const [roleId] of memberRoles.cache) {
        if (allowedRoles.has(roleId)) return true;
      }
    }
  }

  return false;
}

// Load .env from repo root if dotenv is available (best-effort)
async function loadDotenv(): Promise<void> {
  // Walk up from cwd looking for .env
  const candidates = [
    join(process.cwd(), ".env"),
    join(process.cwd(), "..", "..", ".env"), // from extensions/otm-agent/ → repo root
    join(homedir(), ".openclaw", ".env"),
  ];
  for (const p of candidates) {
    try {
      const text = await readFile(p, "utf8");
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        // Strip surrounding quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        } else {
          // Strip inline comments (only when not quoted)
          const commentIdx = val.indexOf(" #");
          if (commentIdx !== -1) val = val.slice(0, commentIdx).trim();
        }
        // Only set if not already in env (respect real env over file)
        if (key && val && !process.env[key]) {
          process.env[key] = val;
        }
      }
      break; // Use first file found
    } catch {
      // File not found — try next
    }
  }
}

// ---------------------------------------------------------------------------
// OTM job-engine helpers (loaded dynamically to avoid circular deps)
// ---------------------------------------------------------------------------

interface Opportunity {
  id: string;
  source: string;
  description: string;
  amount: string;
  score: number;
  riskLevel: string;
  trend: string;
}

interface Strategy {
  id: string;
  title: string;
  category: string;
  steps: string[];
}

interface Metrics {
  totalOpportunitiesScanned: number;
  highScoreOpportunities: number;
  estimatedEarningsIfExecuted: number;
  quickWinsCount: number;
  conversionRate: number;
  activeStrategies: number;
}

/**
 * Dynamically import and call the job engine so the bot can be started
 * independently without the full openclaw plugin runtime.
 * Falls back to a stub result if the engine is unavailable.
 */
async function scanOpportunities(
  minScore: number,
  limit: number,
): Promise<{ opportunities: Opportunity[]; scanTime: string }> {
  try {
    const { getJobEngine } = await import("./job-engine.js");
    const dataDir = join(homedir(), ".openclaw", "otm");
    const engine = getJobEngine(dataDir);
    const listings = await engine.scanOnly();

    // Inline scoring mirrors jobListingToOpportunity in index.ts
    const opps: Opportunity[] = listings
      .map((job) => {
        const ttfd =
          job.payType === "per_task" || job.payType === "fixed"
            ? job.estimatedHours <= 2
              ? 90
              : 75
            : 65;
        const effort = Math.max(20, Math.round(100 - job.estimatedHours * 2.5));
        const score = Math.round(ttfd * 0.35 + effort * 0.35 + 90 * 0.15 + 65 * 0.15);
        const ageMs = Date.now() - new Date(job.postedAt).getTime();
        return {
          id: job.id,
          source: job.platform,
          description: job.title,
          amount: job.payType === "hourly" ? `$${job.payAmount}/hr` : `$${job.payAmount}`,
          score: Math.min(100, score),
          riskLevel: job.clientRating >= 4.5 ? "Low" : job.clientRating >= 4.0 ? "Medium" : "High",
          trend: ageMs < 3_600_000 ? "rising" : ageMs < 86_400_000 ? "stable" : "declining",
        };
      })
      .filter((o) => o.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return { opportunities: opps, scanTime: new Date().toISOString() };
  } catch {
    // Engine unavailable — return stub so the bot still responds
    return { opportunities: [], scanTime: new Date().toISOString() };
  }
}

async function getMetrics(period: string): Promise<{ metrics: Metrics; insights: string[] }> {
  try {
    const { getJobEngine } = await import("./job-engine.js");
    const { getWithdrawalStats } = await import("./payout-engine.js");
    const dataDir = join(homedir(), ".openclaw", "otm");
    const engine = getJobEngine(dataDir);
    const state = engine.getState();
    const summary = engine.getEarningsSummary();
    const wStats = await getWithdrawalStats();

    const periodEarnings =
      period === "day"
        ? summary.today
        : period === "week"
          ? summary.thisWeek
          : period === "month"
            ? summary.thisMonth
            : summary.allTime;

    const metrics: Metrics = {
      totalOpportunitiesScanned: state.totalJobsDiscovered,
      highScoreOpportunities: state.recentJobs.filter((j) => j.netEarnings >= 20).length,
      estimatedEarningsIfExecuted: periodEarnings,
      quickWinsCount: state.recentJobs.filter((j) => j.netEarnings > 0 && j.aiCost < 0.5).length,
      conversionRate:
        state.totalJobsDiscovered > 0
          ? Math.round((state.totalJobsCompleted / state.totalJobsDiscovered) * 100) / 100
          : 0,
      activeStrategies: state.activeJobs.length,
    };

    const insights: string[] = [
      `${metrics.totalOpportunitiesScanned} opportunities scanned; ${metrics.highScoreOpportunities} high-score.`,
      metrics.conversionRate > 0
        ? `Conversion: ${(metrics.conversionRate * 100).toFixed(1)}%`
        : "No completions yet — run /scan to start.",
      wStats.totalWithdrawn > 0
        ? `Total withdrawn: $${wStats.totalWithdrawn.toFixed(2)}`
        : "No payouts yet.",
      `Earnings (${period}): $${periodEarnings.toFixed(2)}`,
    ];

    return { metrics, insights };
  } catch {
    const metrics: Metrics = {
      totalOpportunitiesScanned: 0,
      highScoreOpportunities: 0,
      estimatedEarningsIfExecuted: 0,
      quickWinsCount: 0,
      conversionRate: 0,
      activeStrategies: 0,
    };
    return { metrics, insights: ["Engine not running — start TapClaw to collect metrics."] };
  }
}

function buildStrategies(bankroll: number, hoursPerDay: number, risk: string): Strategy[] {
  const strategies: Strategy[] = [];

  if (hoursPerDay >= 1) {
    strategies.push({
      id: "micro-tasks",
      title: "Micro-Tasks (Clickworker / Appen)",
      category: "micro_task",
      steps: [
        "Sign up for Clickworker/Appen (free, 24h approval)",
        "Complete onboarding tests",
        "Target UHRS tasks ($12–18/hr equivalent)",
        "Withdraw weekly via PayPal",
      ],
    });
    strategies.push({
      id: "content-writing",
      title: "Content Writing (Upwork / WWR)",
      category: "content_writing",
      steps: [
        "Create Upwork profile with 3 writing samples",
        "Bid on entry-level posts ($15–35/article)",
        "Raise rates to $50–80 after 5 reviews",
        "Scale to 3–5 articles/day with AI assistance",
      ],
    });
  }
  if (bankroll >= 100 || risk === "medium" || risk === "high") {
    strategies.push({
      id: "code-freelance",
      title: "Freelance Code (Upwork / Freelancer)",
      category: "code",
      steps: [
        "Build 2–3 portfolio scripts",
        "Bid fixed-price $50–200 jobs",
        "Use AI to accelerate delivery",
        "Upsell maintenance retainers",
      ],
    });
  }
  if (bankroll >= 200 && risk !== "low") {
    strategies.push({
      id: "digital-products",
      title: "Digital Products (Gumroad / Etsy)",
      category: "ecommerce",
      steps: [
        "Create 3–5 digital templates in a weekend",
        "List on Gumroad at $7–27",
        "Drive traffic via Reddit value posts",
        "Build email list from buyers",
      ],
    });
  }

  return strategies;
}

// ---------------------------------------------------------------------------
// Discord client setup
// ---------------------------------------------------------------------------

async function buildCommands(): Promise<ReturnType<SlashCommandBuilder["toJSON"]>[]> {
  const ping = new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check if the TapClaw bot is alive");

  const status = new SlashCommandBuilder()
    .setName("status")
    .setDescription("Show TapClaw system status and current metrics")
    .addStringOption((o) =>
      o
        .setName("period")
        .setDescription("Time period for metrics")
        .setRequired(false)
        .addChoices(
          { name: "Today", value: "day" },
          { name: "This week", value: "week" },
          { name: "This month", value: "month" },
          { name: "All time", value: "all" },
        ),
    );

  const scan = new SlashCommandBuilder()
    .setName("scan")
    .setDescription("Scan for new money-making opportunities across platforms")
    .addIntegerOption((o) =>
      o.setName("limit").setDescription("Max results (1–20, default 5)").setRequired(false),
    )
    .addIntegerOption((o) =>
      o.setName("min_score").setDescription("Minimum score 0–100 (default 70)").setRequired(false),
    );

  const quickscan = new SlashCommandBuilder()
    .setName("quickscan")
    .setDescription("Fast single-platform pulse check (top 5)")
    .addStringOption((o) =>
      o
        .setName("platform")
        .setDescription("Platform to scan")
        .setRequired(false)
        .addChoices(
          { name: "Upwork", value: "upwork" },
          { name: "Fiverr", value: "fiverr" },
          { name: "Reddit", value: "reddit" },
          { name: "Clickworker", value: "clickworker" },
        ),
    );

  const strategies = new SlashCommandBuilder()
    .setName("strategies")
    .setDescription("Get recommended income strategies based on your bankroll")
    .addIntegerOption((o) =>
      o.setName("bankroll").setDescription("Available capital in USD").setRequired(false),
    )
    .addIntegerOption((o) =>
      o.setName("hours").setDescription("Hours available per day (1–24)").setRequired(false),
    )
    .addStringOption((o) =>
      o
        .setName("risk")
        .setDescription("Risk tolerance")
        .setRequired(false)
        .addChoices(
          { name: "Low", value: "low" },
          { name: "Medium", value: "medium" },
          { name: "High", value: "high" },
        ),
    );

  const analyze = new SlashCommandBuilder()
    .setName("analyze")
    .setDescription("Analyze a specific opportunity for feasibility and risk")
    .addStringOption((o) =>
      o.setName("description").setDescription("Description of the opportunity").setRequired(true),
    )
    .addStringOption((o) => o.setName("source").setDescription("Source platform").setRequired(true))
    .addStringOption((o) =>
      o.setName("amount").setDescription("Potential earnings (e.g. $50)").setRequired(false),
    );

  const earnings = new SlashCommandBuilder()
    .setName("earnings")
    .setDescription("Show earnings summary and withdrawal history")
    .addStringOption((o) =>
      o
        .setName("period")
        .setDescription("Time period")
        .setRequired(false)
        .addChoices(
          { name: "Today", value: "day" },
          { name: "This week", value: "week" },
          { name: "This month", value: "month" },
          { name: "All time", value: "all" },
        ),
    );

  const update = new SlashCommandBuilder()
    .setName("update")
    .setDescription("Get a plain-English update on what TapClaw is doing");

  const morning = new SlashCommandBuilder()
    .setName("morning")
    .setDescription("Get your 7am TapClaw morning briefing (Mon-Fri)");

  const afternoon = new SlashCommandBuilder()
    .setName("afternoon")
    .setDescription("Get your 2pm TapClaw afternoon update (Mon-Fri)");

  const wrapup = new SlashCommandBuilder()
    .setName("wrapup")
    .setDescription("Get your 6pm TapClaw wrap up (Mon-Fri)");

  const help = new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all available TapClaw commands");

  return [
    ping,
    status,
    scan,
    quickscan,
    strategies,
    analyze,
    earnings,
    update,
    morning,
    afternoon,
    wrapup,
    help,
  ].map((c) => c.toJSON());
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

async function handlePing(interaction: ChatInputCommandInteraction): Promise<void> {
  const latency = Date.now() - interaction.createdTimestamp;
  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle("TapClaw Online")
    .setDescription("Bot is running and connected to Discord.")
    .addFields(
      { name: "Latency", value: `${latency}ms`, inline: true },
      { name: "API Latency", value: `${Math.round(interaction.client.ws.ping)}ms`, inline: true },
    )
    .setTimestamp();
  await interaction.reply({ embeds: [embed] });
}

async function handleStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const period = interaction.options.getString("period") ?? "week";
  const { metrics, insights } = await getMetrics(period);

  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle("TapClaw Status")
    .setDescription(`Metrics for: **${period}**`)
    .addFields(
      {
        name: "Opportunities Scanned",
        value: String(metrics.totalOpportunitiesScanned),
        inline: true,
      },
      {
        name: "High-Score Opps",
        value: String(metrics.highScoreOpportunities),
        inline: true,
      },
      {
        name: "Active Strategies",
        value: String(metrics.activeStrategies),
        inline: true,
      },
      {
        name: "Estimated Earnings",
        value: `$${metrics.estimatedEarningsIfExecuted.toFixed(2)}`,
        inline: true,
      },
      {
        name: "Quick Wins",
        value: String(metrics.quickWinsCount),
        inline: true,
      },
      {
        name: "Conversion Rate",
        value: `${(metrics.conversionRate * 100).toFixed(1)}%`,
        inline: true,
      },
    )
    .addFields({ name: "Insights", value: insights.join("\n") })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleScan(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const limit = Math.min(20, Math.max(1, interaction.options.getInteger("limit") ?? 5));
  const minScore = interaction.options.getInteger("min_score") ?? 70;
  const { opportunities, scanTime } = await scanOpportunities(minScore, limit);
  if (opportunities.length === 0) {
    await interaction.editReply(
      `No opportunities found with score >= ${minScore}. Try lowering \`min_score\` or run again later.`,
    );
    return;
  }
  const embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle(
      `Scan Results — ${opportunities.length} opportunit${opportunities.length === 1 ? "y" : "ies"}`,
    )
    .setDescription(
      `Min score: ${minScore} | Scanned at ${new Date(scanTime).toLocaleTimeString()}`,
    )
    .setTimestamp();
  for (const opp of opportunities.slice(0, 10)) {
    const trendIcon = opp.trend === "rising" ? "^" : opp.trend === "declining" ? "v" : "~";
    embed.addFields({
      name: `[${opp.score}/100] ${opp.description}`,
      value: `**${opp.amount}** | Risk: ${opp.riskLevel}`,
    });
  }
  await interaction.editReply({ embeds: [embed] });
}

async function handleQuickScan(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const platform = interaction.options.getString("platform") ?? "upwork";
  const { opportunities, scanTime } = await scanOpportunities(0, 20);
  const filtered = opportunities
    .filter((o) => o.source.toLowerCase().includes(platform.toLowerCase()))
    .slice(0, 5);

  const embed = new EmbedBuilder()
    .setColor(Colors.Orange)
    .setTitle(`Quick Scan: ${platform}`)
    .setDescription(`Top ${filtered.length} results | ${new Date(scanTime).toLocaleTimeString()}`)
    .setTimestamp();

  if (filtered.length === 0) {
    embed.setDescription(`No results for **${platform}** right now. Try another platform.`);
  } else {
    for (const opp of filtered) {
      embed.addFields({
        name: `[${opp.score}/100] ${opp.description}`,
        value: `**${opp.amount}** | Risk: ${opp.riskLevel}`,
      });
    }
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleStrategies(interaction: ChatInputCommandInteraction): Promise<void> {
  const bankroll = interaction.options.getInteger("bankroll") ?? 0;
  const hours = interaction.options.getInteger("hours") ?? 2;
  const risk = interaction.options.getString("risk") ?? "medium";

  const strats = buildStrategies(bankroll, hours, risk);

  const embed = new EmbedBuilder()
    .setColor(Colors.Purple)
    .setTitle("Recommended Strategies")
    .setDescription(`Bankroll: **$${bankroll}** | Hours/day: **${hours}** | Risk: **${risk}**`)
    .setTimestamp();

  for (const s of strats.slice(0, 4)) {
    embed.addFields({
      name: s.title,
      value: s.steps.map((step, i) => `${i + 1}. ${step}`).join("\n"),
    });
  }

  if (strats.length === 0) {
    embed.setDescription("No strategies found. Try increasing your bankroll or hours available.");
  }

  await interaction.reply({ embeds: [embed] });
}

async function handleAnalyze(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const description = interaction.options.getString("description", true);
  const source = interaction.options.getString("source", true);
  const amount = interaction.options.getString("amount") ?? "unknown";

  // Deterministic local analysis (mirrors buildFallbackAnalysis in index.ts)
  const desc = description.toLowerCase();
  const isQuick = /micro.task|annotation|transcri|survey|label|data entry/i.test(desc);
  const isSkilled = /code|develop|react|python|typescript|node|api|sql/i.test(desc);
  const ttfd = isQuick ? 85 : isSkilled ? 60 : 70;
  const effort = 70;
  const score = Math.round(ttfd * 0.35 + effort * 0.35 + 90 * 0.15 + 65 * 0.15);
  const risk: string = score >= 75 ? "Low" : score >= 55 ? "Medium" : "High";
  const timeToFirstDollar = isQuick ? "1–4 hours" : isSkilled ? "4–12 hours" : "4–24 hours";

  const color = score >= 75 ? Colors.Green : score >= 55 ? Colors.Yellow : Colors.Red;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`Opportunity Analysis: ${source}`)
    .setDescription(`> ${description}`)
    .addFields(
      { name: "Feasibility Score", value: `${score}/100`, inline: true },
      { name: "Risk Level", value: risk, inline: true },
      { name: "Potential Earnings", value: amount, inline: true },
      { name: "Time to First Dollar", value: timeToFirstDollar, inline: true },
    )
    .addFields({
      name: "Recommended Approach",
      value: isQuick
        ? "Start immediately — low barrier. Complete onboarding/qualification first."
        : isSkilled
          ? "Build a minimal demo first, then bid. Price by scope, not hours."
          : "Create one strong portfolio sample, then apply selectively.",
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleEarnings(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const period = interaction.options.getString("period") ?? "week";
  const { metrics, insights } = await getMetrics(period);

  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle("Earnings Summary")
    .setDescription(`Period: **${period}**`)
    .addFields(
      {
        name: "Estimated Earnings",
        value: `$${metrics.estimatedEarningsIfExecuted.toFixed(2)}`,
        inline: true,
      },
      { name: "Quick Wins", value: String(metrics.quickWinsCount), inline: true },
      {
        name: "Conversion Rate",
        value: `${(metrics.conversionRate * 100).toFixed(1)}%`,
        inline: true,
      },
    )
    .addFields({ name: "Summary", value: insights.join("\n") })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleUpdate(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const { metrics } = await getMetrics("week");

  const lines: string[] = [
    `**TapClaw Weekly Update**`,
    ``,
    `Scanned **${metrics.totalOpportunitiesScanned}** opportunities this period.`,
    `Found **${metrics.highScoreOpportunities}** high-score opportunities.`,
    `Estimated earnings: **$${metrics.estimatedEarningsIfExecuted.toFixed(2)}**`,
    `Quick wins: **${metrics.quickWinsCount}**`,
    `Conversion rate: **${(metrics.conversionRate * 100).toFixed(1)}%**`,
    `Active strategies: **${metrics.activeStrategies}**`,
    ``,
    `Use \`/scan\` to see current opportunities or \`/strategies\` for recommendations.`,
  ];

  // Discord plain-text replies are capped at 2000 chars
  await interaction.editReply(lines.join("\n").slice(0, 2000));
}

async function handleHelp(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(Colors.Blurple)
    .setTitle("TapClaw Bot — Commands")
    .setDescription("All available slash commands:")
    .addFields(
      { name: "/ping", value: "Check if the bot is online" },
      { name: "/status [period]", value: "Show TapClaw metrics dashboard" },
      { name: "/scan [limit] [min_score]", value: "Scan for money-making opportunities" },
      { name: "/quickscan [platform]", value: "Fast single-platform pulse check" },
      {
        name: "/strategies [bankroll] [hours] [risk]",
        value: "Get strategy recommendations",
      },
      {
        name: "/analyze <description> <source> [amount]",
        value: "Analyze a specific opportunity",
      },
      { name: "/earnings [period]", value: "Show earnings and withdrawal history" },
      { name: "/update", value: "Plain-English weekly update" },
      { name: "/morning", value: "Get your 7am TapClaw morning briefing (Mon-Fri)" },
      { name: "/afternoon", value: "Get your 2pm TapClaw afternoon update (Mon-Fri)" },
      { name: "/wrapup", value: "Get your 6pm TapClaw wrap up (Mon-Fri)" },
      { name: "/help", value: "Show this message" },
    )
    .setFooter({ text: "TapClaw — AI Multi-Agent Platform" })
    .setTimestamp();
  await interaction.reply({ embeds: [embed] });
}

async function handleMorning(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const { metrics, insights } = await getMetrics("day");
  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle("TapClaw Morning Briefing")
    .setDescription(`**7am Briefing - Ready to start the day?**`)
    .addFields(
      {
        name: "Opportunities Scanned",
        value: String(metrics.totalOpportunitiesScanned),
        inline: true,
      },
      { name: "High-Score Opps", value: String(metrics.highScoreOpportunities), inline: true },
      {
        name: "Estimated Earnings",
        value: `$${metrics.estimatedEarningsIfExecuted.toFixed(2)}`,
        inline: true,
      },
      { name: "Quick Wins", value: String(metrics.quickWinsCount), inline: true },
      {
        name: "Conversion Rate",
        value: `${(metrics.conversionRate * 100).toFixed(1)}%`,
        inline: true,
      },
    )
    .addFields({ name: "Insights & Recommendations", value: insights.join("\n") })
    .setTimestamp();
  await interaction.editReply({ embeds: [embed] });
}

async function handleAfternoon(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const { metrics, insights } = await getMetrics("day");
  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle("TapClaw Afternoon Update")
    .setDescription(`**2pm Check-in - Progress Report**`)
    .addFields(
      {
        name: "Opportunities Scanned",
        value: String(metrics.totalOpportunitiesScanned),
        inline: true,
      },
      { name: "High-Score Opps", value: String(metrics.highScoreOpportunities), inline: true },
      {
        name: "Estimated Earnings",
        value: `$${metrics.estimatedEarningsIfExecuted.toFixed(2)}`,
        inline: true,
      },
      { name: "Quick Wins", value: String(metrics.quickWinsCount), inline: true },
      {
        name: "Conversion Rate",
        value: `${(metrics.conversionRate * 100).toFixed(1)}%`,
        inline: true,
      },
    )
    .addFields({ name: "Insights & Recommendations", value: insights.join("\n") })
    .setTimestamp();
  await interaction.editReply({ embeds: [embed] });
}

async function handleWrapup(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const { metrics, insights } = await getMetrics("day");
  const embed = new EmbedBuilder()
    .setColor(Colors.Purple)
    .setTitle("TapClaw End-of-Day Wrap Up")
    .setDescription(`**6pm Review - Day's Results**`)
    .addFields(
      {
        name: "Opportunities Scanned",
        value: String(metrics.totalOpportunitiesScanned),
        inline: true,
      },
      { name: "High-Score Opps", value: String(metrics.highScoreOpportunities), inline: true },
      {
        name: "Estimated Earnings",
        value: `$${metrics.estimatedEarningsIfExecuted.toFixed(2)}`,
        inline: true,
      },
      { name: "Quick Wins", value: String(metrics.quickWinsCount), inline: true },
      {
        name: "Conversion Rate",
        value: `${(metrics.conversionRate * 100).toFixed(1)}%`,
        inline: true,
      },
    )
    .addFields({ name: "Summary & Next Steps", value: insights.join("\n") })
    .setTimestamp();
  await interaction.editReply({ embeds: [embed] });
}

// ---------------------------------------------------------------------------
// Automated Briefing Scheduler (7am / 2pm / 6pm Mon-Fri)
// ---------------------------------------------------------------------------

interface ScheduledBriefing {
  hour: number;
  label: string;
  color: (typeof Colors)[keyof typeof Colors];
  title: string;
  subtitle: string;
  insightsLabel: string;
}

const SCHEDULED_BRIEFINGS: ScheduledBriefing[] = [
  {
    hour: 7,
    label: "morning",
    color: Colors.Green,
    title: "TapClaw Morning Briefing",
    subtitle: "**7am Briefing - Ready to start the day?**",
    insightsLabel: "Insights & Recommendations",
  },
  {
    hour: 14,
    label: "afternoon",
    color: Colors.Blue,
    title: "TapClaw Afternoon Update",
    subtitle: "**2pm Check-in - Progress Report**",
    insightsLabel: "Insights & Recommendations",
  },
  {
    hour: 18,
    label: "wrapup",
    color: Colors.Purple,
    title: "TapClaw End-of-Day Wrap Up",
    subtitle: "**6pm Review - Day's Results**",
    insightsLabel: "Summary & Next Steps",
  },
];

/**
 * Compute milliseconds until the next occurrence of `targetHour` (0-23)
 * on a weekday (Mon-Fri). If today is a weekday and the hour hasn't
 * passed yet, it schedules for today; otherwise for the next weekday.
 */
function msUntilNextWeekday(targetHour: number): number {
  const now = new Date();
  const target = new Date(now);
  target.setHours(targetHour, 0, 0, 0);

  // If the target time already passed today, move to next day
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  // Skip weekends (0 = Sun, 6 = Sat)
  while (target.getDay() === 0 || target.getDay() === 6) {
    target.setDate(target.getDate() + 1);
  }

  return target.getTime() - now.getTime();
}

async function sendScheduledBriefing(client: Client, briefing: ScheduledBriefing): Promise<void> {
  const channelId = process.env.DISCORD_BRIEFING_CHANNEL_ID;
  if (!channelId) {
    console.warn(
      `[scheduler] DISCORD_BRIEFING_CHANNEL_ID not set — skipping ${briefing.label} briefing`,
    );
    return;
  }

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !("send" in channel)) {
      console.warn(`[scheduler] Channel ${channelId} not found or not a text channel`);
      return;
    }

    const { metrics, insights } = await getMetrics("day");

    const embed = new EmbedBuilder()
      .setColor(briefing.color)
      .setTitle(briefing.title)
      .setDescription(briefing.subtitle)
      .addFields(
        {
          name: "Opportunities Scanned",
          value: String(metrics.totalOpportunitiesScanned),
          inline: true,
        },
        { name: "High-Score Opps", value: String(metrics.highScoreOpportunities), inline: true },
        {
          name: "Estimated Earnings",
          value: `$${metrics.estimatedEarningsIfExecuted.toFixed(2)}`,
          inline: true,
        },
        { name: "Quick Wins", value: String(metrics.quickWinsCount), inline: true },
        {
          name: "Conversion Rate",
          value: `${(metrics.conversionRate * 100).toFixed(1)}%`,
          inline: true,
        },
      )
      .addFields({ name: briefing.insightsLabel, value: insights.join("\n") })
      .setTimestamp();

    const textChannel = channel as { send: (opts: { embeds: EmbedBuilder[] }) => Promise<unknown> };
    await textChannel.send({ embeds: [embed] });
    console.log(`[scheduler] Sent ${briefing.label} briefing to #${channelId}`);
  } catch (err) {
    console.error(`[scheduler] Failed to send ${briefing.label} briefing:`, err);
  }
}

function scheduleBriefing(client: Client, briefing: ScheduledBriefing): void {
  const schedule = () => {
    const delayMs = msUntilNextWeekday(briefing.hour);
    const nextTime = new Date(Date.now() + delayMs);
    console.log(
      `[scheduler] Next ${briefing.label} briefing at ${nextTime.toLocaleString()} (in ${Math.round(delayMs / 60000)}min)`,
    );

    setTimeout(async () => {
      await sendScheduledBriefing(client, briefing);
      // Reschedule for the next occurrence
      schedule();
    }, delayMs);
  };

  schedule();
}

function startBriefingScheduler(client: Client): void {
  console.log("[scheduler] Starting automated briefing scheduler (7am / 2pm / 6pm Mon-Fri)");
  for (const briefing of SCHEDULED_BRIEFINGS) {
    scheduleBriefing(client, briefing);
  }
}

// ---------------------------------------------------------------------------
// Main — build client and register handlers
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  await loadDotenv();

  const token = requireEnv("DISCORD_BOT_TOKEN");
  const appId = requireEnv("DISCORD_APP_ID");

  // Register commands with Discord REST API (idempotent — safe to run on every start)
  console.log("Registering slash commands...");
  const rest = new REST({ version: "10" }).setToken(token);
  const commands = await buildCommands();
  await rest.put(Routes.applicationCommands(appId), { body: commands });
  console.log(`Registered ${commands.length} slash command(s).`);

  // Build the Gateway client
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`TapClaw bot ready as ${readyClient.user.tag}`);
    readyClient.user.setActivity("TapClaw opportunities", { type: ActivityType.Watching });

    // Start automated briefing scheduler (7am / 2pm / 6pm Mon-Fri)
    startBriefingScheduler(client);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // Auth gate: public commands skip the check, everything else requires allowlist
    if (!PUBLIC_COMMANDS.has(commandName)) {
      const authorized = await isAuthorized(interaction);
      if (!authorized) {
        await interaction.reply({
          content:
            "You are not authorized to run this command. " +
            "Ask an admin to add your Discord user ID to `OTM_DISCORD_ALLOWED_USERS`.",
          ephemeral: true,
        });
        return;
      }
    }

    try {
      switch (commandName) {
        case "ping":
          await handlePing(interaction);
          break;
        case "status":
          await handleStatus(interaction);
          break;
        case "scan":
          await handleScan(interaction);
          break;
        case "quickscan":
          await handleQuickScan(interaction);
          break;
        case "strategies":
          await handleStrategies(interaction);
          break;
        case "analyze":
          await handleAnalyze(interaction);
          break;
        case "earnings":
          await handleEarnings(interaction);
          break;
        case "update":
          await handleUpdate(interaction);
          break;
        case "morning":
          await handleMorning(interaction);
          break;
        case "afternoon":
          await handleAfternoon(interaction);
          break;
        case "wrapup":
          await handleWrapup(interaction);
          break;
        case "help":
          await handleHelp(interaction);
          break;
        default:
          await interaction.reply({
            content: `Unknown command: \`/${commandName}\`. Use \`/help\` to see all commands.`,
            ephemeral: true,
          });
      }
    } catch (err) {
      console.error(`Error handling /${commandName}:`, err);
      const msg = `Something went wrong running \`/${commandName}\`. Check the bot logs.`;
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(msg).catch(() => {});
      } else {
        await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
      }
    }
  });

  await client.login(token);
}

main().catch((err) => {
  console.error("Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
