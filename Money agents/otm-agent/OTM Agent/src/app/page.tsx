"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { MarketingTab } from "@/components/MarketingTab";
import { TradingTab } from "@/components/TradingTab";
import { SystemStatusTab } from "@/components/SystemStatusTab";

// ============================================================================
// TYPES
// ============================================================================

interface RadarItem {
  id: string;
  src: string;
  desc: string;
  amt: string;
  time: string;
  score: number;
  scoreFactors: {
    timeToFirstDollar: number;
    effort: number;
    capital: number;
    skill: number;
    scalability: number;
  };
  riskLevel?: "Low" | "Medium" | "High";
  trend?: "rising" | "stable" | "declining";
}

interface LogEntry {
  id: string;
  time: string;
  msg: string;
  type: "success" | "warn" | "info" | "achievement";
}

interface AgentInfo {
  title: string;
  sections: Array<{ heading: string; lines: string[] }>;
}

interface StratInfo {
  title: string;
  steps: string[];
  minBankroll: number;
  maxBankroll: number;
  category: "micro" | "content" | "gig" | "template" | "agent" | "automation";
}

interface ActionItem {
  id: string;
  title: string;
  description: string;
  timeEstimate: string;
  expectedEarnings: string;
  priority: number;
  category: "immediate" | "week" | "upcoming";
  requiredResources: string[];
  strategy: string;
}

interface BankrollAllocation {
  automationTools: { percentage: number; amount: number; items: string[] };
  learning: { percentage: number; amount: number; items: string[] };
  reserve: { percentage: number; amount: number; items: string[] };
}

interface PerformanceMetrics {
  totalOpportunitiesScanned: number;
  highScoreOpportunities: number;
  estimatedEarningsIfExecuted: number;
  quickWinsCount: number;
}

// Gamification Types
interface GameState {
  xp: number;
  level: number;
  levelName: string;
  achievements: Achievement[];
  streak: number;
  lastActive: string;
  totalActions: number;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
  progress?: number;
  target?: number;
}

interface Alert {
  id: string;
  type: "opportunity" | "trend" | "achievement" | "reminder" | "milestone";
  title: string;
  message: string;
  time: Date;
  read: boolean;
  icon: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: Date;
}

interface AIAnalysis {
  feasibilityScore: number;
  riskLevel: "Low" | "Medium" | "High";
  recommendedApproach: string;
  potentialRisks: string[];
  nextSteps: string[];
  timeToFirstDollar: string;
  confidenceScore: number;
}

interface MarketTrend {
  category: string;
  trend: "rising" | "stable" | "declining";
  change: number;
  demand: "High" | "Medium" | "Low";
  hotSkills: string[];
}

interface PortfolioAllocation {
  strategy: string;
  hours: number;
  expectedReturn: number;
  risk: "Low" | "Medium" | "High";
  color: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getScoreColor(score: number): string {
  if (score >= 80) return "score-green";
  if (score >= 70) return "score-yellow";
  if (score >= 50) return "score-red";
  return "score-red";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 70) return "Great";
  if (score >= 50) return "Good";
  return "Needs Improvement";
}

// ============================================================================
// CONSTANTS & DATA
// ============================================================================

const LEVELS = [
  { name: "Rookie", minXP: 0, icon: "🌱" },
  { name: "Hustler", minXP: 100, icon: "💪" },
  { name: "Grinder", minXP: 500, icon: "⚡" },
  { name: "Operator", minXP: 1500, icon: "🎯" },
  { name: "Boss", minXP: 5000, icon: "👑" },
  { name: "Mogul", minXP: 15000, icon: "🏆" },
];

const ACHIEVEMENTS_DEF: Achievement[] = [
  {
    id: "first_dollar",
    name: "First Dollar",
    description: "Set bankroll above $0",
    icon: "💵",
    unlocked: false,
    progress: 0,
    target: 1,
  },
  {
    id: "opportunity_hunter",
    name: "Opportunity Hunter",
    description: "View 10 opportunities",
    icon: "🔍",
    unlocked: false,
    progress: 0,
    target: 10,
  },
  {
    id: "strategist",
    name: "Strategist",
    description: "Explore 5 strategies",
    icon: "📋",
    unlocked: false,
    progress: 0,
    target: 5,
  },
  {
    id: "ai_powered",
    name: "AI Powered",
    description: "Use AI analysis",
    icon: "🤖",
    unlocked: false,
    progress: 0,
    target: 1,
  },
  {
    id: "quick_starter",
    name: "Quick Starter",
    description: "Complete an immediate action",
    icon: "⚡",
    unlocked: false,
    progress: 0,
    target: 1,
  },
  {
    id: "week_warrior",
    name: "Week Warrior",
    description: "7-day streak",
    icon: "🔥",
    unlocked: false,
    progress: 0,
    target: 7,
  },
  {
    id: "high_roller",
    name: "High Roller",
    description: "Reach $500 bankroll",
    icon: "💰",
    unlocked: false,
    progress: 0,
    target: 500,
  },
  {
    id: "score_master",
    name: "Score Master",
    description: "Find 5 opportunities with 90+ score",
    icon: "⭐",
    unlocked: false,
    progress: 0,
    target: 5,
  },
  {
    id: "diversified",
    name: "Diversified",
    description: "Explore all 6 strategies",
    icon: "🎯",
    unlocked: false,
    progress: 0,
    target: 6,
  },
  {
    id: "mogul_status",
    name: "Mogul Status",
    description: "Reach Mogul level",
    icon: "🏆",
    unlocked: false,
    progress: 0,
    target: 15000,
  },
];

const MARKET_TRENDS: MarketTrend[] = [
  {
    category: "AI Writing",
    trend: "rising",
    change: 23,
    demand: "High",
    hotSkills: ["GPT Prompts", "SEO Content", "Email Copy"],
  },
  {
    category: "Micro-Tasks",
    trend: "stable",
    change: 5,
    demand: "High",
    hotSkills: ["Data Annotation", "RLHF", "Transcription"],
  },
  {
    category: "Automation",
    trend: "rising",
    change: 18,
    demand: "High",
    hotSkills: ["Make.com", "Zapier", "n8n"],
  },
  {
    category: "Chatbots",
    trend: "rising",
    change: 31,
    demand: "Medium",
    hotSkills: ["Voiceflow", "Botpress", "Custom GPTs"],
  },
  {
    category: "Templates",
    trend: "stable",
    change: 8,
    demand: "Medium",
    hotSkills: ["Notion", "Airtable", "Figma"],
  },
  {
    category: "Content",
    trend: "declining",
    change: -12,
    demand: "Low",
    hotSkills: ["Blog Writing", "Newsletter", "Twitter Threads"],
  },
];

const radarData: Omit<RadarItem, "time" | "id">[] = [
  {
    src: "UPWORK",
    desc: "AI product description writing — 50 items",
    amt: "$85",
    score: 92,
    scoreFactors: { timeToFirstDollar: 95, effort: 85, capital: 100, skill: 90, scalability: 75 },
    riskLevel: "Low",
    trend: "rising",
  },
  {
    src: "REDDIT",
    desc: "Viral thread → blog opportunity detected",
    amt: "Est $60",
    score: 78,
    scoreFactors: { timeToFirstDollar: 70, effort: 75, capital: 100, skill: 80, scalability: 85 },
    riskLevel: "Medium",
    trend: "stable",
  },
  {
    src: "FIVERR",
    desc: "Social media bio rewrites — surge in demand",
    amt: "$30/gig",
    score: 88,
    scoreFactors: { timeToFirstDollar: 90, effort: 90, capital: 100, skill: 85, scalability: 70 },
    riskLevel: "Low",
    trend: "rising",
  },
  {
    src: "CLICKWORKER",
    desc: "Data annotation batch — 200 tasks open",
    amt: "$40",
    score: 85,
    scoreFactors: { timeToFirstDollar: 95, effort: 80, capital: 100, skill: 95, scalability: 60 },
    riskLevel: "Low",
    trend: "stable",
  },
  {
    src: "GUMROAD",
    desc: "Notion finance tracker — gap in market",
    amt: "Passive",
    score: 72,
    scoreFactors: { timeToFirstDollar: 50, effort: 60, capital: 90, skill: 70, scalability: 95 },
    riskLevel: "Medium",
    trend: "rising",
  },
  {
    src: "LOCAL SEO",
    desc: "4 restaurants with no chatbot — cold pitch",
    amt: "$1K MRR",
    score: 68,
    scoreFactors: { timeToFirstDollar: 55, effort: 50, capital: 70, skill: 65, scalability: 90 },
    riskLevel: "High",
    trend: "rising",
  },
  {
    src: "TWITTER",
    desc: "Thread niche gap — AI tools for musicians",
    amt: "Est $55",
    score: 75,
    scoreFactors: { timeToFirstDollar: 70, effort: 75, capital: 100, skill: 75, scalability: 80 },
    riskLevel: "Medium",
    trend: "stable",
  },
  {
    src: "SCALE AI",
    desc: "RLHF feedback tasks — $12/hr equivalent",
    amt: "$50/day",
    score: 82,
    scoreFactors: { timeToFirstDollar: 90, effort: 85, capital: 100, skill: 90, scalability: 55 },
    riskLevel: "Low",
    trend: "rising",
  },
  {
    src: "APPEN",
    desc: "Voice data collection project open",
    amt: "$35",
    score: 79,
    scoreFactors: { timeToFirstDollar: 85, effort: 80, capital: 100, skill: 90, scalability: 50 },
    riskLevel: "Low",
    trend: "stable",
  },
  {
    src: "FIVERR",
    desc: "Email sequence copywriting — no quality sellers",
    amt: "$120/gig",
    score: 87,
    scoreFactors: { timeToFirstDollar: 85, effort: 80, capital: 100, skill: 85, scalability: 80 },
    riskLevel: "Low",
    trend: "rising",
  },
];

const bootLogs: [string, "success" | "warn" | "info"][] = [
  ["OTM Agent initialized. Awaiting bankroll input.", "info"],
  ["Scout agent deployed. Scanning Upwork, Fiverr, Reddit, Clickworker…", "success"],
  ["Closer agent on standby. Ready to generate outreach copy.", "success"],
  ["Builder agent on standby. Ready to create deliverables.", "success"],
  ["Stacker agent dormant. Activates after first $50 earned.", "warn"],
];

const liveLogs: [string, "success" | "warn" | "info"][] = [
  ["Scout: Upwork has 3 new AI writing gigs under $150 — Builder can fulfill in <10 min", "warn"],
  ["Scout: Reddit r/entrepreneur — repeated request for social media automation template", "warn"],
  ["Builder: Content arbitrage pipeline ready. 1 thread → 1 blog post in 4 minutes.", "success"],
  ["Closer: Cold pitch template generated for local restaurant chatbot offer", "success"],
  ["Stacker: Tracking active. Reinvestment rule: first $50 goes back to automation tools.", "info"],
  ["Scout: Clickworker batch opened — 200 annotation tasks @ $0.20 each = $40 available", "warn"],
  ["Builder: Notion template draft complete. Ready to list on Gumroad.", "success"],
  ["Closer: Fiverr gig listing copy generated. Category: AI writing.", "success"],
];

const agentInfo: Record<string, AgentInfo> = {
  scout: {
    title: "Scout — Micro-Opportunity Detector",
    sections: [
      {
        heading: "What Scout Does",
        lines: [
          "Continuously scrapes Upwork, Fiverr, Reddit, Twitter, Clickworker, Appen, Scale AI, and expired domain registries for any money-making gap that requires $0–$50 or less to execute.",
        ],
      },
      {
        heading: "Detection Signals",
        lines: [
          "Underpriced gigs where AI fulfillment takes under 15 min",
          "Viral content with no long-form monetization (blog/newsletter gap)",
          "Repeated business complaints on Reddit/forums (SaaS gap)",
          "Local businesses missing basic automation (chatbots, booking)",
          "Open micro-task batches (data labeling, transcription, annotation)",
        ],
      },
      {
        heading: "Output",
        lines: [
          "Sends prioritized opportunity list to Closer and Builder every 30 minutes, ranked by speed-to-dollar.",
        ],
      },
    ],
  },
  closer: {
    title: "Closer — Outreach & Sales Agent",
    sections: [
      {
        heading: "What Closer Does",
        lines: [
          "Takes Scout's opportunity list and generates cold outreach messages, Fiverr gig descriptions, Upwork proposals, and LinkedIn DMs tailored to each target.",
        ],
      },
      {
        heading: "Tactics Used",
        lines: [
          "Personalized cold email/DM with a free-value hook",
          "Gig listings with SEO-optimized descriptions",
          "Proposal templates that win bids in under 3 sentences",
          "Follow-up sequences (Day 1, Day 3, Day 7)",
        ],
      },
      {
        heading: "Goal",
        lines: [
          "Convert at least 1 of every 10 Scout opportunities into a paid transaction within 48 hours.",
        ],
      },
    ],
  },
  builder: {
    title: "Builder — Deliverable Creator",
    sections: [
      {
        heading: "What Builder Does",
        lines: [
          "Creates the actual product or service being sold. Requires zero upfront spending — all work is generated using AI tooling.",
        ],
      },
      {
        heading: "What Builder Creates",
        lines: [
          "Blog posts and Twitter threads from sourced content (10 min)",
          "Gig deliverables: email copy, bios, SEO descriptions (10 min)",
          "Notion/Make.com templates packaged for Gumroad (4 hrs)",
          "Make.com automation flows for AaaS clients (2–4 hrs)",
          "White-label chatbot configurations for local businesses (30 min)",
        ],
      },
      {
        heading: "Quality Gate",
        lines: [
          "Every deliverable must be reviewed before delivery. Builder flags anything that needs human review.",
        ],
      },
    ],
  },
  stacker: {
    title: "Stacker — Capital Reinvestment Strategist",
    sections: [
      {
        heading: "Activation Trigger",
        lines: [
          "Stacker wakes up the moment $50 is earned. Before that, all effort goes to execution, not strategy.",
        ],
      },
      {
        heading: "Reinvestment Rules",
        lines: [
          "$0–$50: No reinvestment. Full hustle mode, zero spend.",
          "$50–$500: Reinvest up to 20% into automation (Make.com plan, domain, Gumroad).",
          "$500–$2,500/mo: Convert best-performing one-off gigs into retainers. Spend on tools that 10x output.",
          "$2,500+/mo: Allocate to a Micro-SaaS or niche product. Begin building an asset, not just income.",
        ],
      },
      {
        heading: "One Rule",
        lines: [
          "Never spend more than you earned last week. The stack only goes up.",
        ],
      },
    ],
  },
};

const stratInfo: Record<string, StratInfo> = {
  microtask: {
    title: "Micro-Task Arbitrage — Step by Step",
    minBankroll: 0,
    maxBankroll: 50,
    category: "micro",
    steps: [
      "Create free accounts on Clickworker, Scale AI, Appen, and Hive Micro.",
      "Scout scans each platform daily for the highest-paying open task batches.",
      "Prioritize: data annotation, RLHF feedback, transcription, image labeling.",
      "Builder uses AI to assist with repetitive tasks — increasing hourly output.",
      "Complete tasks daily. Most platforms pay within 24–48 hours.",
      "Stacker logs every payout and records which platforms yield the most per hour.",
      "Scale by dedicating 2–3 hours/day to highest-performing platforms.",
      "Reinvest first $50 into an automation that batch-processes simpler tasks.",
    ],
  },
  content: {
    title: "Content Arbitrage — Step by Step",
    minBankroll: 0,
    maxBankroll: 100,
    category: "content",
    steps: [
      "Scout identifies top Reddit posts in high-CPM niches (finance, tech, health).",
      "Builder transforms each post into an original 800-word blog article using AI.",
      "Publish to a free WordPress blog. Enable Google AdSense.",
      "Post the key insight as a Twitter/X thread linking back to the full article.",
      "Repeat daily: 1 article + 1 thread. Volume creates compounding ad revenue.",
      "After 30 posts, apply to Mediavine or Ezoic for higher ad rates ($20–50 RPM).",
      "Add affiliate links to recommended tools in each article (Amazon, software).",
      "At 50K monthly views, this yields $500–2K/month passively.",
    ],
  },
  gigbot: {
    title: "Gig Bot Service — Step by Step",
    minBankroll: 20,
    maxBankroll: 200,
    category: "gig",
    steps: [
      "Closer creates 3 Fiverr listings: email sequences, SEO product descriptions, social media bios.",
      "Use AI-generated gig thumbnails and keyword-optimized titles.",
      "Set pricing: Basic $25, Standard $60, Premium $120.",
      "Builder fulfills each order in under 10 minutes using structured prompts.",
      "Deliver early — early delivery boosts Fiverr algorithm ranking.",
      "Respond to every inquiry within 1 hour to maintain response rate.",
      "After 10 reviews, raise prices 20–30%.",
      "Use Upwork for direct outreach — Closer sends 10 proposals/day.",
    ],
  },
  templates: {
    title: "Digital Template Sales — Step by Step",
    minBankroll: 50,
    maxBankroll: 500,
    category: "template",
    steps: [
      "Scout identifies 3 underserved template niches (check Etsy/Gumroad search volume).",
      "Builder creates: a Notion productivity system, a Make.com email automation blueprint, and an AI prompt pack for a specific profession.",
      "Package each with a README and screenshots.",
      "List on Gumroad (free) and Etsy. Price: $9, $19, $29.",
      "Write 1 Twitter thread or Reddit post showcasing each template for free traffic.",
      "Collect buyer emails. Build a list. Sell the next template to the same audience.",
      "At $500 in sales, reinvest in a paid Gumroad promo or ProductHunt launch.",
      "Passive income: each template can sell daily with zero additional work.",
    ],
  },
  agentresell: {
    title: "Agent Resale Service — Step by Step",
    minBankroll: 200,
    maxBankroll: 5000,
    category: "agent",
    steps: [
      "Identify 10 local businesses (restaurants, salons, real estate agents) missing a website chatbot.",
      'Closer sends cold email: "I can automate 30% of your customer questions by Friday — free demo."',
      "Sign up for a white-label AI agent platform at $29/agent/month.",
      "Configure agent with business FAQ, hours, and booking link in 30 minutes.",
      "Demo live to client. Show them how it handles 10 common questions.",
      "Close at $200–300/month. Client perceives high value — you pay $29.",
      "Onboard and deliver in 48 hours. Collect payment via Stripe.",
      "Repeat: 5 clients = $1,250 MRR at $145 cost = $1,105 net profit monthly.",
    ],
  },
  automationsvc: {
    title: "Automation-as-a-Service — Step by Step",
    minBankroll: 50,
    maxBankroll: 5000,
    category: "automation",
    steps: [
      "Scout monitors Reddit (r/entrepreneur, r/smallbusiness) for posts asking about repetitive workflow problems.",
      "Comment with genuine help, then offer to build the automation for them.",
      "Common automations: lead → CRM → email follow-up, invoice generation, social post scheduling.",
      "Builder creates the workflow in Make.com (free tier for prototypes).",
      "Charge $300–800 for a one-time build, or $300–500/month to maintain and improve.",
      "Deliver with a 5-min Loom video explaining how it works.",
      "Upsell: once clients see one automation work, they want five more.",
      "At 5 retainer clients ($300/mo each), you have $1,500/mo in recurring revenue.",
    ],
  },
};

// ============================================================================
// HELPER FUNCTIONS (component-specific)
// ============================================================================

function getLevel(xp: number): { level: number; name: string; icon: string; nextXP: number } {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) {
      const nextLevel = LEVELS[i + 1];
      return {
        level: i + 1,
        name: LEVELS[i].name,
        icon: LEVELS[i].icon,
        nextXP: nextLevel ? nextLevel.minXP : LEVELS[i].minXP,
      };
    }
  }
  return { level: 1, name: "Rookie", icon: "🌱", nextXP: 100 };
}

function generateActions(bankroll: number): ActionItem[] {
  const actions: ActionItem[] = [
    {
      id: "1",
      title: "Complete 3 micro-task batches",
      description:
        "Log into Clickworker, Scale AI, and Appen. Complete available annotation tasks.",
      timeEstimate: "2-3 hours",
      expectedEarnings: "$40-60",
      priority: 95,
      category: "immediate",
      requiredResources: ["Computer", "Internet"],
      strategy: "microtask",
    },
    {
      id: "2",
      title: "Set up Fiverr profile",
      description: "Create seller account, add gig listings for AI writing services.",
      timeEstimate: "1 hour",
      expectedEarnings: "$0 (setup)",
      priority: 90,
      category: "immediate",
      requiredResources: ["Computer", "Internet"],
      strategy: "gigbot",
    },
    {
      id: "3",
      title: "Write first blog post from Reddit thread",
      description: "Find viral Reddit post, transform into blog article using AI.",
      timeEstimate: "30 min",
      expectedEarnings: "Passive ($0.50-5/mo)",
      priority: 85,
      category: "immediate",
      requiredResources: ["Computer", "AI Tool"],
      strategy: "content",
    },
    {
      id: "4",
      title: "Build Notion template for Gumroad",
      description: "Create a productivity or finance tracker template.",
      timeEstimate: "4-6 hours",
      expectedEarnings: "$9-49 per sale",
      priority: bankroll >= 50 ? 75 : 45,
      category: "week",
      requiredResources: ["Notion account", "Design skills"],
      strategy: "templates",
    },
    {
      id: "5",
      title: "Cold pitch 10 local businesses",
      description: "Send personalized emails offering chatbot/automation services.",
      timeEstimate: "2 hours",
      expectedEarnings: "$200-500 potential",
      priority: 80,
      category: "week",
      requiredResources: ["Email", "Lead list"],
      strategy: "agentresell",
    },
    {
      id: "6",
      title: "Complete 5 Fiverr orders",
      description: "Fulfill incoming gig orders with AI assistance.",
      timeEstimate: "1-2 hours",
      expectedEarnings: "$75-300",
      priority: 88,
      category: "week",
      requiredResources: ["Fiverr account", "AI tools"],
      strategy: "gigbot",
    },
    {
      id: "7",
      title: "Launch email newsletter",
      description: "Set up Substack or ConvertKit, start building audience.",
      timeEstimate: "3-4 hours",
      expectedEarnings: "Long-term",
      priority: 60,
      category: "upcoming",
      requiredResources: ["Email platform", "Content"],
      strategy: "content",
    },
    {
      id: "8",
      title: "Sign first retainer client",
      description: "Convert one-off automation client to monthly retainer.",
      timeEstimate: "2 hours",
      expectedEarnings: "$300-500/mo",
      priority: bankroll >= 200 ? 70 : 40,
      category: "upcoming",
      requiredResources: ["Client relationship", "Make.com"],
      strategy: "automationsvc",
    },
  ];

  return actions.filter((a) => a.priority > 50).sort((a, b) => b.priority - a.priority);
}

function getBankrollAllocation(bankroll: number): BankrollAllocation | null {
  if (bankroll <= 0) return null;

  let automationPct = 0;
  let learningPct = 0;
  let reservePct = 100;

  if (bankroll < 50) {
    automationPct = 0;
    learningPct = 0;
    reservePct = 100;
  } else if (bankroll < 200) {
    automationPct = 20;
    learningPct = 10;
    reservePct = 70;
  } else if (bankroll < 500) {
    automationPct = 30;
    learningPct = 15;
    reservePct = 55;
  } else {
    automationPct = 35;
    learningPct = 20;
    reservePct = 45;
  }

  const getTools = (amount: number, category: "automation" | "learning"): string[] => {
    if (category === "automation") {
      if (amount < 20) return ["Free tier tools only"];
      if (amount < 50) return ["Make.com Starter ($9/mo)", "ChatGPT Plus ($20/mo)"];
      if (amount < 100)
        return ["Make.com Pro ($29/mo)", "ChatGPT Plus ($20/mo)", "Custom domain ($12/yr)"];
      return [
        "Make.com Teams ($99/mo)",
        "ChatGPT Plus ($20/mo)",
        "Custom domain",
        "Zapier Professional",
      ];
    } else {
      if (amount < 20) return ["Free YouTube tutorials", "Reddit communities"];
      if (amount < 50) return ["Udemy course", "Industry newsletter subscriptions"];
      return ["Premium courses", "Mastermind access", "Industry conferences"];
    }
  };

  return {
    automationTools: {
      percentage: automationPct,
      amount: Math.round((bankroll * automationPct) / 100),
      items: getTools(Math.round((bankroll * automationPct) / 100), "automation"),
    },
    learning: {
      percentage: learningPct,
      amount: Math.round((bankroll * learningPct) / 100),
      items: getTools(Math.round((bankroll * learningPct) / 100), "learning"),
    },
    reserve: {
      percentage: reservePct,
      amount: Math.round((bankroll * reservePct) / 100),
      items: ["Emergency fund", "Opportunity fund for quick investments"],
    },
  };
}

function getRecommendedStrategies(bankroll: number): string[] {
  if (bankroll === 0) return ["microtask", "content"];
  if (bankroll < 50) return ["microtask", "content", "gigbot"];
  if (bankroll < 200) return ["gigbot", "content", "templates", "automationsvc"];
  return ["agentresell", "automationsvc", "templates", "gigbot"];
}

function calculatePortfolioAllocation(hours: number, bankroll: number): PortfolioAllocation[] {
  const baseHours = hours;
  const allocations: PortfolioAllocation[] = [];

  if (bankroll < 50) {
    allocations.push({
      strategy: "Micro-Tasks",
      hours: Math.round(baseHours * 0.5),
      expectedReturn: 45,
      risk: "Low",
      color: "#10b981",
    });
    allocations.push({
      strategy: "Content",
      hours: Math.round(baseHours * 0.3),
      expectedReturn: 25,
      risk: "Medium",
      color: "#f59e0b",
    });
    allocations.push({
      strategy: "Skill Building",
      hours: Math.round(baseHours * 0.2),
      expectedReturn: 0,
      risk: "Low",
      color: "#8b5cf6",
    });
  } else if (bankroll < 200) {
    allocations.push({
      strategy: "Gig Services",
      hours: Math.round(baseHours * 0.4),
      expectedReturn: 80,
      risk: "Low",
      color: "#10b981",
    });
    allocations.push({
      strategy: "Templates",
      hours: Math.round(baseHours * 0.25),
      expectedReturn: 35,
      risk: "Medium",
      color: "#f59e0b",
    });
    allocations.push({
      strategy: "Micro-Tasks",
      hours: Math.round(baseHours * 0.2),
      expectedReturn: 30,
      risk: "Low",
      color: "#06b6d4",
    });
    allocations.push({
      strategy: "Outreach",
      hours: Math.round(baseHours * 0.15),
      expectedReturn: 20,
      risk: "High",
      color: "#ef4444",
    });
  } else {
    allocations.push({
      strategy: "Automation Svc",
      hours: Math.round(baseHours * 0.35),
      expectedReturn: 120,
      risk: "Medium",
      color: "#10b981",
    });
    allocations.push({
      strategy: "Agent Resale",
      hours: Math.round(baseHours * 0.3),
      expectedReturn: 150,
      risk: "Medium",
      color: "#f59e0b",
    });
    allocations.push({
      strategy: "Templates",
      hours: Math.round(baseHours * 0.2),
      expectedReturn: 50,
      risk: "Low",
      color: "#8b5cf6",
    });
    allocations.push({
      strategy: "Gig Services",
      hours: Math.round(baseHours * 0.15),
      expectedReturn: 40,
      risk: "Low",
      color: "#06b6d4",
    });
  }

  return allocations;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function OTMAgentDashboard() {
  // Tab Navigation
  const [activeTab, setActiveTab] = useState<"otm" | "marketing" | "trading" | "system">("otm");

  // Core State
  const [bankroll, setBankroll] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [scanCount, setScanCount] = useState(0);
  const [radarItems, setRadarItems] = useState<RadarItem[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{
    title: string;
    type: "agent" | "strategy";
    agentId?: string;
    stratId?: string;
  }>({ title: "", type: "agent" });
  const [activeAgent, setActiveAgent] = useState("scout");
  const [radarIdx, setRadarIdx] = useState(0);
  const radarIdxRef = useRef(0);
  const [hoursPerDay, setHoursPerDay] = useState(2);
  const [showProjections, setShowProjections] = useState(false);

  // Advanced Features State
  const [gameState, setGameState] = useState<GameState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("otm_game_state");
        if (saved) {
          const parsed = JSON.parse(saved);
          // Minimal shape validation
          if (
            typeof parsed === "object" &&
            parsed !== null &&
            typeof parsed.xp === "number" &&
            Array.isArray(parsed.achievements)
          ) {
            return parsed as GameState;
          }
        }
      } catch {
        // Corrupted data — fall through to default
      }
    }
    return {
      xp: 0,
      level: 1,
      levelName: "Rookie",
      achievements: ACHIEVEMENTS_DEF,
      streak: 0,
      lastActive: new Date().toDateString(),
      totalActions: 0,
    };
  });

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [analyzingOpportunity, setAnalyzingOpportunity] = useState<RadarItem | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [marketTrends, setMarketTrends] = useState(MARKET_TRENDS);
  const [strategiesClicked, setStrategiesClicked] = useState<Set<string>>(new Set());
  const [highScoreCount, setHighScoreCount] = useState(0);

  // Performance metrics
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    totalOpportunitiesScanned: 0,
    highScoreOpportunities: 0,
    estimatedEarningsIfExecuted: 0,
    quickWinsCount: 0,
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  // Save game state to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("otm_game_state", JSON.stringify(gameState));
    }
  }, [gameState]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Close alerts when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (alertRef.current && !alertRef.current.contains(e.target as Node)) {
        setShowAlerts(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch live data from OpenClaw gateway on mount.
  // Falls back to the static mock data embedded in the API routes when the
  // gateway is not running — so the dashboard is always functional.
  useEffect(() => {
    let cancelled = false;

    async function fetchLiveData() {
      try {
        const [oppsRes, metricsRes] = await Promise.all([
          fetch("/api/openclaw/opportunities?limit=10&minScore=0"),
          fetch("/api/openclaw/metrics"),
        ]);

        if (cancelled) return;

        if (oppsRes.ok) {
          const oppsData = (await oppsRes.json()) as {
            source: string;
            opportunities: Array<{
              src?: string;
              source?: string;
              desc?: string;
              description?: string;
              amt?: string;
              amount?: string;
              score: number;
              scoreFactors: RadarItem["scoreFactors"];
              riskLevel?: RadarItem["riskLevel"];
              trend?: RadarItem["trend"];
            }>;
          };

          if (oppsData.opportunities?.length) {
            const now = new Date();
            const timeStr =
              now.getHours().toString().padStart(2, "0") +
              ":" +
              now.getMinutes().toString().padStart(2, "0") +
              ":" +
              now.getSeconds().toString().padStart(2, "0");

            const items: RadarItem[] = oppsData.opportunities.map((o) => ({
              id: crypto.randomUUID(),
              src: o.src ?? o.source ?? "OPENCLAW",
              desc: o.desc ?? o.description ?? "",
              amt: o.amt ?? o.amount ?? "—",
              score: o.score,
              scoreFactors: o.scoreFactors ?? {
                timeToFirstDollar: 80,
                effort: 80,
                capital: 100,
                skill: 80,
                scalability: 70,
              },
              riskLevel: o.riskLevel,
              trend: o.trend,
              time: timeStr,
            }));

            setRadarItems(items);

            if (oppsData.source === "openclaw") {
              addLog(
                `Scout: OpenClaw gateway connected — ${items.length} live opportunities loaded`,
                "success",
              );
            }
          }
        }

        if (metricsRes.ok) {
          const metricsData = (await metricsRes.json()) as {
            source: string;
            metrics: {
              totalOpportunitiesScanned: number;
              highScoreOpportunities: number;
              estimatedEarningsIfExecuted: number;
              quickWinsCount: number;
            };
          };

          if (metricsData.metrics && metricsData.source === "openclaw") {
            setMetrics(metricsData.metrics);
          }
        }
      } catch {
        // Gateway unreachable — static fallback data remains active.
      }
    }

    void fetchLiveData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // XP and Achievement Functions
  const addXP = useCallback((amount: number, reason: string) => {
    setGameState((prev) => {
      const newXP = prev.xp + amount;
      const newLevel = getLevel(newXP);
      const leveledUp = newLevel.level > prev.level;

      if (leveledUp) {
        addAlert(
          "achievement",
          "Level Up!",
          `You're now a ${newLevel.name}! ${newLevel.icon}`,
          "⬆️",
        );
      }

      return {
        ...prev,
        xp: newXP,
        level: newLevel.level,
        levelName: newLevel.name,
      };
    });

    addLog(`+${amount} XP: ${reason}`, "success");
  }, []);

  const checkAchievements = useCallback(() => {
    // Collect newly unlocked achievements outside the updater, then apply XP separately
    const newlyUnlocked: Achievement[] = [];

    setGameState((prev) => {
      const updatedAchievements = prev.achievements.map((ach) => {
        if (ach.unlocked) return ach;

        let progress = ach.progress || 0;
        let unlocked = false;

        switch (ach.id) {
          case "first_dollar":
            progress = bankroll > 0 ? 1 : 0;
            unlocked = bankroll > 0;
            break;
          case "opportunity_hunter":
            progress = metrics.totalOpportunitiesScanned;
            unlocked = metrics.totalOpportunitiesScanned >= 10;
            break;
          case "strategist":
            progress = strategiesClicked.size;
            unlocked = strategiesClicked.size >= 5;
            break;
          case "ai_powered":
            unlocked = prev.totalActions > 0 && aiAnalysis !== null;
            break;
          case "high_roller":
            progress = bankroll;
            unlocked = bankroll >= 500;
            break;
          case "score_master":
            progress = highScoreCount;
            unlocked = highScoreCount >= 5;
            break;
          case "diversified":
            progress = strategiesClicked.size;
            unlocked = strategiesClicked.size >= 6;
            break;
          case "mogul_status":
            progress = prev.xp;
            unlocked = prev.xp >= 15000;
            break;
        }

        if (unlocked && !ach.unlocked) {
          newlyUnlocked.push({ ...ach, progress, unlocked: true });
        }

        return { ...ach, progress, unlocked };
      });

      return { ...prev, achievements: updatedAchievements };
    });

    // Apply alerts and XP outside the state updater to avoid nested updates
    for (const ach of newlyUnlocked) {
      addAlert("achievement", "Achievement Unlocked!", `${ach.icon} ${ach.name}`, ach.icon);
      addXP(50, `Achievement: ${ach.name}`);
    }
  }, [
    bankroll,
    metrics.totalOpportunitiesScanned,
    strategiesClicked,
    highScoreCount,
    aiAnalysis,
    addXP,
    addAlert,
  ]);

  useEffect(() => {
    checkAchievements();
  }, [checkAchievements]);

  // Alert Functions
  const addAlert = useCallback(
    (type: Alert["type"], title: string, message: string, icon: string) => {
      const newAlert: Alert = {
        id: crypto.randomUUID(),
        type,
        title,
        message,
        time: new Date(),
        read: false,
        icon,
      };
      setAlerts((prev) => [newAlert, ...prev].slice(0, 20));
    },
    [],
  );

  const getTimeString = () => {
    const now = new Date();
    return (
      now.getHours().toString().padStart(2, "0") +
      ":" +
      now.getMinutes().toString().padStart(2, "0") +
      ":" +
      now.getSeconds().toString().padStart(2, "0")
    );
  };

  const addLog = useCallback(
    (msg: string, type: "success" | "warn" | "info" | "achievement" = "info") => {
      setLogs((prev) => {
        const newLog = { id: crypto.randomUUID(), time: getTimeString(), msg, type };
        return [newLog, ...prev].slice(0, 40);
      });
    },
    [],
  );

  // AI Functions
  const analyzeWithAI = async (item: RadarItem) => {
    setAnalyzingOpportunity(item);
    setAnalysisLoading(true);
    setShowAnalysisModal(true);

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "analyze",
          data: {
            title: item.desc,
            source: item.src,
            amount: item.amt,
            score: item.score,
            bankroll,
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        setAiAnalysis(result.analysis);
        addXP(25, "AI Analysis used");
        setGameState((prev) => ({ ...prev, totalActions: prev.totalActions + 1 }));
      }
    } catch (error) {
      console.error("AI Analysis failed:", error);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: chatInput,
      time: new Date(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          data: {
            messages: [...chatMessages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            context: {
              bankroll,
              strategies: Array.from(strategiesClicked),
              xp: gameState.xp,
            },
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.response,
          time: new Date(),
        };
        setChatMessages((prev) => [...prev, assistantMessage]);
        addXP(10, "Chat interaction");
      }
    } catch (error) {
      console.error("Chat failed:", error);
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I'm having trouble connecting right now. Please try again.",
        time: new Date(),
      };
      setChatMessages((prev) => [...prev, errorMessage]);
    } finally {
      setChatLoading(false);
    }
  };

  // Bankroll Functions
  const handleSetBankroll = () => {
    const val = Math.max(0, parseFloat(inputValue) || 0);
    setBankroll(val);
    addLog(`Bankroll set to $${val.toFixed(2)}. Calibrating strategy modules…`, "success");
    addXP(5, "Bankroll updated");
    setGameState((prev) => ({ ...prev, totalActions: prev.totalActions + 1 }));
  };

  const quickSet = (amount: number) => {
    setInputValue(amount.toString());
    setBankroll(amount);
    addLog(`Bankroll set to $${amount.toFixed(2)}. Calibrating strategy modules…`, "success");
    addXP(5, "Bankroll updated");
    setGameState((prev) => ({ ...prev, totalActions: prev.totalActions + 1 }));
  };

  // Modal Functions
  const showAgent = (id: string) => {
    setActiveAgent(id);
    const info = agentInfo[id];
    setModalContent({ title: info.title, type: "agent", agentId: id });
    setModalOpen(true);
  };

  const showStrat = (id: string) => {
    const s = stratInfo[id];
    setModalContent({
      title: s.title,
      type: "strategy",
      stratId: id,
    });
    setModalOpen(true);

    // Track strategy clicks
    setStrategiesClicked((prev) => {
      const newSet = new Set(prev);
      newSet.add(id);
      return newSet;
    });
    addXP(10, "Strategy explored");
    setGameState((prev) => ({ ...prev, totalActions: prev.totalActions + 1 }));
  };

  // Radar Functions
  const pushRadarItem = useCallback(() => {
    const idx = radarIdxRef.current;
    const d = radarData[idx % radarData.length];
    radarIdxRef.current = idx + 1;
    setRadarIdx(radarIdxRef.current);
    setScanCount((prev) => prev + 1);

    setMetrics((prev) => ({
      ...prev,
      totalOpportunitiesScanned: prev.totalOpportunitiesScanned + 1,
      highScoreOpportunities: prev.highScoreOpportunities + (d.score >= 80 ? 1 : 0),
      estimatedEarningsIfExecuted:
        prev.estimatedEarningsIfExecuted +
        (d.score >= 70 ? parseInt(d.amt.replace(/[^0-9]/g, "")) || 30 : 0),
      quickWinsCount:
        prev.quickWinsCount + (d.score >= 85 && d.scoreFactors.timeToFirstDollar >= 90 ? 1 : 0),
    }));

    if (d.score >= 90) {
      setHighScoreCount((prev) => prev + 1);
    }

    if (d.score >= 90) {
      addAlert("opportunity", "High-Value Opportunity!", `${d.desc.substring(0, 40)}...`, "⭐");
    }

    setRadarItems((prev) => [{ ...d, id: crypto.randomUUID(), time: "Now" }, ...prev.slice(0, 4)]);
    addXP(5, "Opportunity scanned");
  }, [addXP, addAlert]);

  const handleRadarClick = (item: RadarItem) => {
    addLog(`Scout flagged: ${item.desc} [Score: ${item.score}]`, "warn");
    analyzeWithAI(item);
  };

  // Initialize boot logs
  useEffect(() => {
    const reversedBootLogs = [...bootLogs].reverse();
    const timerIds: ReturnType<typeof setTimeout>[] = [];
    reversedBootLogs.forEach((l, i) => {
      timerIds.push(setTimeout(() => addLog(l[0], l[1]), i * 600));
    });
    return () => {
      for (const id of timerIds) clearTimeout(id);
    };
  }, [addLog]);

  // Radar feed interval
  useEffect(() => {
    pushRadarItem();
    const interval = setInterval(pushRadarItem, 5000 + Math.random() * 5000);
    return () => clearInterval(interval);
  }, [pushRadarItem]);

  // Live logs interval
  useEffect(() => {
    let liveLogIdx = 0;
    const interval = setInterval(() => {
      const l = liveLogs[liveLogIdx % liveLogs.length];
      addLog(l[0], l[1]);
      liveLogIdx++;
    }, 10000);
    return () => clearInterval(interval);
  }, [addLog]);

  // Market trends update
  useEffect(() => {
    const interval = setInterval(() => {
      setMarketTrends((prev) =>
        prev.map((trend) => {
          const delta = (Math.random() - 0.5) * 5;
          const newChange = trend.change + delta;
          return {
            ...trend,
            change: newChange,
            trend: newChange > 5 ? "rising" : newChange < -5 ? "declining" : "stable",
          };
        }),
      );
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Derived data
  const recommendedStrategies = useMemo(() => getRecommendedStrategies(bankroll), [bankroll]);
  const actions = useMemo(() => generateActions(bankroll), [bankroll]);
  const allocation = useMemo(() => getBankrollAllocation(bankroll), [bankroll]);
  const portfolioAllocation = useMemo(
    () => calculatePortfolioAllocation(hoursPerDay, bankroll),
    [hoursPerDay, bankroll],
  );
  const levelInfo = useMemo(() => getLevel(gameState.xp), [gameState.xp]);
  const unreadAlerts = useMemo(() => alerts.filter((a) => !a.read).length, [alerts]);

  const projections = useMemo(() => {
    const hourlyRate = 15;
    const dailyEarnings = hoursPerDay * hourlyRate;
    const weeklyEarnings = dailyEarnings * 5;
    const monthlyEarnings = weeklyEarnings * 4;
    const months = 12;
    const growthRate = 1.15;
    const yearlyProjection: { month: number; earnings: number; cumulative: number }[] = [];

    let cumulative = 0;
    let currentMonthly = monthlyEarnings;

    for (let i = 1; i <= months; i++) {
      cumulative += currentMonthly;
      yearlyProjection.push({
        month: i,
        earnings: Math.round(currentMonthly),
        cumulative: Math.round(cumulative),
      });
      currentMonthly *= growthRate;
    }

    return {
      daily: Math.round(dailyEarnings),
      weekly: Math.round(weeklyEarnings),
      monthly: Math.round(monthlyEarnings),
      yearlyProjection,
    };
  }, [hoursPerDay]);

  const getProgressWidth = (stage: number) => {
    const stages = [
      { max: 50, threshold: 0 },
      { max: 500, threshold: 50 },
      { max: 2500, threshold: 500 },
      { max: 10000, threshold: 2500 },
    ];
    const s = stages[stage - 1];
    if (bankroll >= s.threshold) {
      return Math.min(100, ((bankroll - s.threshold) / (s.max - s.threshold)) * 100);
    }
    return 0;
  };

  const isStageActive = (threshold: number) => bankroll >= threshold;

  return (
    <div className="otm-container">
      {/* Header with Gamification */}
      <header className="otm-header">
        <div className="header-left">
          <h1>OTM AGENT // OUT THE MUD</h1>
          <p>Automated bootstrapping system — from zero to funded</p>
        </div>
        <div className="header-right">
          {/* Level Badge */}
          <div className="level-badge">
            <span className="level-icon">{levelInfo.icon}</span>
            <div className="level-info">
              <span className="level-name">{levelInfo.name}</span>
              <span className="level-xp">{gameState.xp.toLocaleString()} XP</span>
            </div>
            <div className="xp-bar">
              <div
                className="xp-fill"
                style={{ width: `${Math.min(100, (gameState.xp / levelInfo.nextXP) * 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Alert Bell */}
          <div className="alert-container" ref={alertRef}>
            <button className="alert-bell" onClick={() => setShowAlerts(!showAlerts)}>
              🔔{unreadAlerts > 0 && <span className="alert-badge">{unreadAlerts}</span>}
            </button>
            {showAlerts && (
              <div className="alert-dropdown">
                <div className="alert-dropdown-header">Notifications</div>
                <div className="alert-list">
                  {alerts.length === 0 ? (
                    <div className="alert-empty">No notifications yet</div>
                  ) : (
                    alerts.map((alert) => (
                      <div key={alert.id} className={`alert-item ${alert.read ? "read" : ""}`}>
                        <span className="alert-icon">{alert.icon}</span>
                        <div className="alert-content">
                          <span className="alert-title">{alert.title}</span>
                          <span className="alert-message">{alert.message}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="status-badge">
            <div className="dot"></div>
            AGENT ONLINE
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="tab-nav">
        <button
          className={`tab-btn${activeTab === "otm" ? " active" : ""}`}
          onClick={() => setActiveTab("otm")}
        >
          🎯 OTM Agent
        </button>
        <button
          className={`tab-btn${activeTab === "marketing" ? " active" : ""}`}
          onClick={() => setActiveTab("marketing")}
        >
          📣 Marketing Suite
        </button>
        <button
          className={`tab-btn${activeTab === "trading" ? " active" : ""}`}
          onClick={() => setActiveTab("trading")}
        >
          📈 Trading Dashboard
        </button>
        <button
          className={`tab-btn${activeTab === "system" ? " active" : ""}`}
          onClick={() => setActiveTab("system")}
        >
          ⚙️ System Status
        </button>
      </nav>

      {/* Tab Content */}
      {activeTab === "otm" && (
      <main className="otm-main">
        {/* MISSION */}
        <section className="panel panel-full">
          <div className="panel-title">Mission Directive</div>
          <div className="mission-block">
            <div className="label">OBJECTIVE</div>
            Start with a small amount of capital — or none. Deploy sub-agents to scan the internet
            for real, executable money opportunities. Take every small win. Feed every dollar back
            into bigger moves. Never stop until the come-up is real.
          </div>
        </section>

        {/* PERFORMANCE METRICS */}
        <section className="panel panel-full">
          <div className="panel-title">Performance Metrics Dashboard</div>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon">🔍</div>
              <div className="metric-content">
                <div className="metric-value">{metrics.totalOpportunitiesScanned}</div>
                <div className="metric-label">Opportunities Scanned</div>
              </div>
            </div>
            <div className="metric-card metric-highlight">
              <div className="metric-icon">⭐</div>
              <div className="metric-content">
                <div className="metric-value">{metrics.highScoreOpportunities}</div>
                <div className="metric-label">High-Score Opportunities (80+)</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon">💰</div>
              <div className="metric-content">
                <div className="metric-value">${metrics.estimatedEarningsIfExecuted}</div>
                <div className="metric-label">Estimated Earnings (if executed)</div>
              </div>
            </div>
            <div className="metric-card metric-quick-win">
              <div className="metric-icon">⚡</div>
              <div className="metric-content">
                <div className="metric-value">{metrics.quickWinsCount}</div>
                <div className="metric-label">Quick Wins Available</div>
              </div>
            </div>
          </div>
        </section>

        {/* MARKET PULSE */}
        <section className="panel panel-full">
          <div className="panel-title">Market Pulse — Real-Time Trends</div>
          <div className="market-trends-grid">
            {marketTrends.map((trend) => (
              <div key={trend.category} className="trend-card">
                <div className="trend-header">
                  <span className="trend-category">{trend.category}</span>
                  <span className={`trend-indicator ${trend.trend}`}>
                    {trend.trend === "rising" ? "↑" : trend.trend === "declining" ? "↓" : "→"}
                    {trend.change > 0 ? "+" : ""}
                    {trend.change.toFixed(1)}%
                  </span>
                </div>
                <div className="trend-demand">
                  Demand:{" "}
                  <span className={`demand-${trend.demand.toLowerCase()}`}>{trend.demand}</span>
                </div>
                <div className="trend-skills">
                  {trend.hotSkills.map((skill, i) => (
                    <span key={i} className="skill-tag">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* STARTING BANKROLL */}
        <section className="panel">
          <div className="panel-title">
            Starting Bankroll <span>${bankroll.toFixed(2)}</span>
          </div>
          <div className="bankroll-section">
            <div className="bankroll-input-row">
              <label>ENTER AMOUNT</label>
              <input
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
              <button className="btn" onClick={handleSetBankroll}>
                SET
              </button>
            </div>
            <p className="bankroll-hint">
              Enter what you&apos;re working with — even $0. The OTM Agent will select strategies
              that match your starting capital.
            </p>
            <div className="quick-buttons">
              <button className="btn-ghost" onClick={() => quickSet(0)}>
                $0
              </button>
              <button className="btn-ghost" onClick={() => quickSet(20)}>
                $20
              </button>
              <button className="btn-ghost" onClick={() => quickSet(50)}>
                $50
              </button>
              <button className="btn-ghost" onClick={() => quickSet(100)}>
                $100
              </button>
              <button className="btn-ghost" onClick={() => quickSet(200)}>
                $200
              </button>
              <button className="btn-ghost" onClick={() => quickSet(500)}>
                $500
              </button>
            </div>
          </div>
        </section>

        {/* BANKROLL ALLOCATION */}
        {allocation && (
          <section className="panel">
            <div className="panel-title">Bankroll Allocation Optimizer</div>
            <div className="allocation-grid">
              <div className="allocation-item allocation-automation">
                <div className="allocation-header">
                  <span className="allocation-icon">⚙️</span>
                  <span className="allocation-name">Automation Tools</span>
                  <span className="allocation-pct">{allocation.automationTools.percentage}%</span>
                </div>
                <div className="allocation-amount">${allocation.automationTools.amount}</div>
                <div className="allocation-items">
                  {allocation.automationTools.items.map((item, i) => (
                    <span key={i} className="allocation-tag">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="allocation-item allocation-learning">
                <div className="allocation-header">
                  <span className="allocation-icon">📚</span>
                  <span className="allocation-name">Learning & Resources</span>
                  <span className="allocation-pct">{allocation.learning.percentage}%</span>
                </div>
                <div className="allocation-amount">${allocation.learning.amount}</div>
                <div className="allocation-items">
                  {allocation.learning.items.map((item, i) => (
                    <span key={i} className="allocation-tag">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="allocation-item allocation-reserve">
                <div className="allocation-header">
                  <span className="allocation-icon">🏦</span>
                  <span className="allocation-name">Reserve Fund</span>
                  <span className="allocation-pct">{allocation.reserve.percentage}%</span>
                </div>
                <div className="allocation-amount">${allocation.reserve.amount}</div>
                <div className="allocation-items">
                  {allocation.reserve.items.map((item, i) => (
                    <span key={i} className="allocation-tag">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* PORTFOLIO OPTIMIZATION */}
        <section className="panel">
          <div className="panel-title">Portfolio Optimizer — Time Allocation</div>
          <div className="portfolio-section">
            <div className="portfolio-chart">
              {portfolioAllocation.map((item) => (
                <div
                  key={item.strategy}
                  className="portfolio-bar"
                  style={{ width: `${(item.hours / hoursPerDay) * 100}%`, background: item.color }}
                >
                  <span className="portfolio-label">{item.strategy}</span>
                  <span className="portfolio-hours">{item.hours}h</span>
                </div>
              ))}
            </div>
            <div className="portfolio-legend">
              {portfolioAllocation.map((item) => (
                <div key={item.strategy} className="legend-item">
                  <span className="legend-color" style={{ background: item.color }}></span>
                  <span className="legend-name">{item.strategy}</span>
                  <span className="legend-return">~${item.expectedReturn}/day</span>
                  <span className={`legend-risk risk-${item.risk.toLowerCase()}`}>{item.risk}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AGENT ROSTER */}
        <section className="panel">
          <div className="panel-title">Sub-Agent Roster</div>
          <div className="agent-list">
            <div
              className={`agent-row ${activeAgent === "scout" ? "active" : ""}`}
              onClick={() => showAgent("scout")}
            >
              <div className="agent-icon" style={{ background: "rgba(245,158,11,0.15)" }}>
                📡
              </div>
              <div className="agent-info">
                <div className="agent-name">Scout</div>
                <div className="agent-role">
                  Micro-opportunity detector — scans gig sites, forums, social
                </div>
              </div>
              <div className="agent-status status-active">ACTIVE</div>
            </div>
            <div
              className={`agent-row ${activeAgent === "closer" ? "active" : ""}`}
              onClick={() => showAgent("closer")}
            >
              <div className="agent-icon" style={{ background: "rgba(16,185,129,0.15)" }}>
                💬
              </div>
              <div className="agent-info">
                <div className="agent-name">Closer</div>
                <div className="agent-role">Outreach, proposals, pitch copy, cold DMs</div>
              </div>
              <div className="agent-status status-active">ACTIVE</div>
            </div>
            <div
              className={`agent-row ${activeAgent === "builder" ? "active" : ""}`}
              onClick={() => showAgent("builder")}
            >
              <div className="agent-icon" style={{ background: "rgba(139,92,246,0.15)" }}>
                🛠️
              </div>
              <div className="agent-info">
                <div className="agent-name">Builder</div>
                <div className="agent-role">
                  Creates deliverables — content, templates, automations
                </div>
              </div>
              <div className="agent-status status-active">ACTIVE</div>
            </div>
            <div
              className={`agent-row ${activeAgent === "stacker" ? "active" : ""}`}
              onClick={() => showAgent("stacker")}
            >
              <div className="agent-icon" style={{ background: "rgba(239,68,68,0.15)" }}>
                📈
              </div>
              <div className="agent-info">
                <div className="agent-name">Stacker</div>
                <div className="agent-role">Tracks wins, decides how to reinvest each dollar</div>
              </div>
              <div className="agent-status status-standby">STANDBY</div>
            </div>
          </div>
        </section>

        {/* RADAR FEED WITH SCORING */}
        <section className="panel">
          <div className="panel-title">
            Scout Radar Feed <span>{scanCount} scanned today</span>
          </div>
          <div className="radar-list">
            {radarItems.map((item) => (
              <div key={item.id} className="radar-item" onClick={() => handleRadarClick(item)}>
                <div className="radar-left">
                  <div className="ri-source">
                    [{item.src}] {item.time} ago
                  </div>
                  <div className="ri-desc">{item.desc}</div>
                </div>
                <div className="radar-right">
                  <div className={`ri-score ${getScoreColor(item.score)}`}>
                    <span className="score-value">{item.score}</span>
                    <span className="score-label">{getScoreLabel(item.score)}</span>
                  </div>
                  <div className="ri-amount">{item.amt}</div>
                  <div className="ri-risk">
                    {item.riskLevel === "Low" && <span className="risk-low">🟢 Low Risk</span>}
                    {item.riskLevel === "Medium" && (
                      <span className="risk-medium">🟡 Med Risk</span>
                    )}
                    {item.riskLevel === "High" && <span className="risk-high">🔴 High Risk</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="score-legend">
            <span className="legend-item">
              <span className="legend-dot legend-green"></span> 80+ Excellent
            </span>
            <span className="legend-item">
              <span className="legend-dot legend-yellow"></span> 50-79 Good
            </span>
            <span className="legend-item">
              <span className="legend-dot legend-red"></span> &lt;50 Fair
            </span>
          </div>
        </section>

        {/* ACTION QUEUE */}
        <section className="panel panel-full">
          <div className="panel-title">Action Queue — Prioritized Tasks</div>
          <div className="action-queue">
            <div className="action-column">
              <div className="action-column-header immediate">
                <span className="column-icon">🔥</span> Immediate (Do Today)
              </div>
              <div className="action-list">
                {actions
                  .filter((a) => a.category === "immediate")
                  .map((action) => (
                    <div key={action.id} className="action-card">
                      <div className="action-header">
                        <span className="action-title">{action.title}</span>
                        <span className="action-priority">P{action.priority}</span>
                      </div>
                      <p className="action-desc">{action.description}</p>
                      <div className="action-meta">
                        <span className="meta-item">⏱️ {action.timeEstimate}</span>
                        <span className="meta-item">💰 {action.expectedEarnings}</span>
                      </div>
                      <div className="action-resources">
                        {action.requiredResources.map((r, i) => (
                          <span key={i} className="resource-tag">
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            <div className="action-column">
              <div className="action-column-header week">
                <span className="column-icon">📅</span> This Week
              </div>
              <div className="action-list">
                {actions
                  .filter((a) => a.category === "week")
                  .map((action) => (
                    <div key={action.id} className="action-card">
                      <div className="action-header">
                        <span className="action-title">{action.title}</span>
                        <span className="action-priority">P{action.priority}</span>
                      </div>
                      <p className="action-desc">{action.description}</p>
                      <div className="action-meta">
                        <span className="meta-item">⏱️ {action.timeEstimate}</span>
                        <span className="meta-item">💰 {action.expectedEarnings}</span>
                      </div>
                      <div className="action-resources">
                        {action.requiredResources.map((r, i) => (
                          <span key={i} className="resource-tag">
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            <div className="action-column">
              <div className="action-column-header upcoming">
                <span className="column-icon">🎯</span> Upcoming
              </div>
              <div className="action-list">
                {actions
                  .filter((a) => a.category === "upcoming")
                  .map((action) => (
                    <div key={action.id} className="action-card">
                      <div className="action-header">
                        <span className="action-title">{action.title}</span>
                        <span className="action-priority">P{action.priority}</span>
                      </div>
                      <p className="action-desc">{action.description}</p>
                      <div className="action-meta">
                        <span className="meta-item">⏱️ {action.timeEstimate}</span>
                        <span className="meta-item">💰 {action.expectedEarnings}</span>
                      </div>
                      <div className="action-resources">
                        {action.requiredResources.map((r, i) => (
                          <span key={i} className="resource-tag">
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </section>

        {/* PIPELINE */}
        <section className="panel">
          <div className="panel-title">Capital Pipeline — How Dollars Stack</div>
          <div className="pipeline">
            {[1, 2, 3, 4].map((stage) => {
              const thresholds = [0, 50, 500, 2500];
              const maxes = [50, 500, 2500, 10000];
              const names = ["First Dollar", "Traction", "Recurring Base", "Scale Up"];
              const ranges = ["$0 → $50", "$50 → $500", "$500 → $2,500/mo", "$2,500/mo → $10K/mo"];
              const descs = [
                "Micro-tasks, content arbitrage, quick Fiverr gigs. No investment needed.",
                "Repeat winning plays. Reinvest in automation. Launch digital products.",
                "Convert one-off wins into retainers. Agent arbitrage. Build MRR.",
                "Deploy micro-SaaS, build niche marketplaces, fund larger ventures.",
              ];

              return (
                <div key={stage} className="pipe-stage">
                  <div className="pipe-connector">
                    <div
                      className={`pipe-dot ${!isStageActive(thresholds[stage - 1]) && stage > 1 ? "dim" : ""}`}
                    ></div>
                    <div
                      className={`pipe-line ${isStageActive(thresholds[stage - 1]) ? "lit" : ""}`}
                    ></div>
                  </div>
                  <div
                    className={`pipe-card ${isStageActive(thresholds[stage - 1]) ? "active-stage" : ""}`}
                  >
                    <div className="pc-row">
                      <div className="pc-name">
                        Stage {stage} — {names[stage - 1]}
                      </div>
                      <div className="pc-range">{ranges[stage - 1]}</div>
                    </div>
                    <div className="pc-desc">{descs[stage - 1]}</div>
                    <div className="progress-bar-wrap">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${getProgressWidth(stage)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* REVENUE PROJECTION */}
        <section className="panel">
          <div className="panel-title">Revenue Projection Calculator</div>
          <div className="projection-section">
            <div className="projection-input">
              <label>Available hours per day</label>
              <div className="hours-slider">
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={hoursPerDay}
                  onChange={(e) => setHoursPerDay(parseInt(e.target.value))}
                />
                <span className="hours-value">{hoursPerDay} hrs</span>
              </div>
            </div>
            <div className="projection-summary">
              <div className="projection-item">
                <span className="projection-label">Daily</span>
                <span className="projection-value">${projections.daily}</span>
              </div>
              <div className="projection-item">
                <span className="projection-label">Weekly</span>
                <span className="projection-value">${projections.weekly}</span>
              </div>
              <div className="projection-item">
                <span className="projection-label">Monthly</span>
                <span className="projection-value">${projections.monthly}</span>
              </div>
            </div>
            <button className="btn btn-full" onClick={() => setShowProjections(!showProjections)}>
              {showProjections ? "Hide" : "Show"} Growth Trajectory
            </button>
            {showProjections && (
              <div className="growth-trajectory">
                <div className="trajectory-header">
                  <span>Month</span>
                  <span>Earnings</span>
                  <span>Cumulative</span>
                </div>
                {projections.yearlyProjection.slice(0, 6).map((p) => (
                  <div key={p.month} className="trajectory-row">
                    <span>Month {p.month}</span>
                    <span>${p.earnings}</span>
                    <span>${p.cumulative}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ACTIVITY LOG */}
        <section className="panel">
          <div className="panel-title">System Log</div>
          <div className="log-box">
            {logs.map((log) => (
              <div key={log.id} className="log-line">
                <span className="log-time">[{log.time}]</span>
                <span className={`log-msg ${log.type}`}>{log.msg}</span>
              </div>
            ))}
          </div>
        </section>

        {/* STRATEGY MODULES */}
        <section className="panel panel-full">
          <div className="panel-title">
            Revenue Modules — Matched to Bankroll
            {bankroll > 0 && <span className="recommended-note">Showing best for ${bankroll}</span>}
          </div>
          <div className="strat-grid">
            {Object.entries(stratInfo).map(([key, strat]) => (
              <div
                key={key}
                className={`strat-card ${recommendedStrategies.includes(key) ? "recommended" : ""}`}
                onClick={() => showStrat(key)}
              >
                {recommendedStrategies.includes(key) && (
                  <div className="recommended-badge">⭐ Recommended</div>
                )}
                <div className="strat-top">
                  <div className="strat-name">{strat.title.split(" — ")[0]}</div>
                  <div className={`cost-tag ${strat.minBankroll === 0 ? "cost-zero" : "cost-low"}`}>
                    {strat.minBankroll === 0 ? "$0 START" : `$${strat.minBankroll}+`}
                  </div>
                </div>
                <div className="strat-desc">{strat.steps[0]}</div>
                <div className="strat-metrics">
                  <div className="sm-item">
                    <div className="sm-label">Min Bankroll</div>
                    <div className="sm-val">${strat.minBankroll}</div>
                  </div>
                  <div className="sm-item">
                    <div className="sm-label">Category</div>
                    <div className="sm-val">{strat.category}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ACHIEVEMENTS */}
        <section className="panel panel-full">
          <div className="panel-title">Achievements</div>
          <div className="achievements-grid">
            {gameState.achievements.map((ach) => (
              <div
                key={ach.id}
                className={`achievement-card ${ach.unlocked ? "unlocked" : "locked"}`}
              >
                <span className="achievement-icon">{ach.icon}</span>
                <div className="achievement-info">
                  <span className="achievement-name">{ach.name}</span>
                  <span className="achievement-desc">{ach.description}</span>
                  {ach.target && !ach.unlocked && (
                    <div className="achievement-progress">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${Math.min(100, ((ach.progress || 0) / ach.target) * 100)}%`,
                          }}
                        ></div>
                      </div>
                      <span className="progress-text">
                        {ach.progress || 0}/{ach.target}
                      </span>
                    </div>
                  )}
                </div>
                {ach.unlocked && <span className="achievement-check">✓</span>}
              </div>
            ))}
          </div>
        </section>
      </main>
      )}

      {activeTab === "marketing" && <MarketingTab />}

      {activeTab === "trading" && <TradingTab />}

      {activeTab === "system" && <SystemStatusTab />}

      {/* AI CHAT FLOATING BUTTON */}
      <button className="chat-fab" onClick={() => setChatOpen(!chatOpen)}>
        {chatOpen ? "✕" : "🤖"}
      </button>

      {/* AI CHAT PANEL */}
      {chatOpen && (
        <div className="chat-panel">
          <div className="chat-header">
            <span className="chat-title">🤖 OTM Assistant</span>
            <button className="chat-close" onClick={() => setChatOpen(false)}>
              ✕
            </button>
          </div>
          <div className="chat-messages">
            {chatMessages.length === 0 && (
              <div className="chat-welcome">
                <p>Hi! I&apos;m your OTM Agent assistant. Ask me about:</p>
                <ul>
                  <li>Best strategies for your bankroll</li>
                  <li>How to execute opportunities</li>
                  <li>Time management tips</li>
                  <li>Risk assessment</li>
                </ul>
              </div>
            )}
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`chat-message ${msg.role}`}>
                <span className="message-content">{msg.content}</span>
              </div>
            ))}
            {chatLoading && (
              <div className="chat-message assistant">
                <span className="message-content typing">Thinking...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="chat-input">
            <input
              type="text"
              placeholder="Ask me anything..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
            />
            <button className="chat-send" onClick={sendChatMessage}>
              →
            </button>
          </div>
        </div>
      )}

      {/* MODAL */}
      <div
        className={`modal ${modalOpen ? "open" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModalOpen(false);
        }}
      >
        <div className="modal-box">
          <button className="modal-close-btn" onClick={() => setModalOpen(false)}>
            ×
          </button>
          <div>
            <h2>{modalContent.title}</h2>
            {modalContent.type === "agent" && modalContent.agentId && agentInfo[modalContent.agentId] && (
              <div>
                {agentInfo[modalContent.agentId].sections.map((section) => (
                  <div key={section.heading} className="detail-block">
                    <strong>{section.heading}:</strong>
                    {section.lines.length === 1 ? (
                      <span> {section.lines[0]}</span>
                    ) : (
                      <ul>
                        {section.lines.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
            {modalContent.type === "strategy" && modalContent.stratId && stratInfo[modalContent.stratId] && (
              <ol className="step-list">
                {stratInfo[modalContent.stratId].steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>

      {/* AI ANALYSIS MODAL */}
      <div
        className={`modal ${showAnalysisModal ? "open" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowAnalysisModal(false);
        }}
      >
        <div className="modal-box modal-large">
          <button className="modal-close-btn" onClick={() => setShowAnalysisModal(false)}>
            ×
          </button>
          <h2>🤖 AI Opportunity Analysis</h2>

          {analysisLoading ? (
            <div className="analysis-loading">
              <div className="loading-spinner"></div>
              <p>Analyzing opportunity with AI...</p>
            </div>
          ) : aiAnalysis && analyzingOpportunity ? (
            <div className="analysis-content">
              <div className="analysis-item">
                <h3>{analyzingOpportunity.desc}</h3>
                <div className="analysis-meta">
                  <span>Source: {analyzingOpportunity.src}</span>
                  <span>Potential: {analyzingOpportunity.amt}</span>
                </div>
              </div>

              <div className="analysis-grid">
                <div className="analysis-stat">
                  <span className="stat-label">Feasibility</span>
                  <span className="stat-value">{aiAnalysis.feasibilityScore}/100</span>
                </div>
                <div className="analysis-stat">
                  <span className="stat-label">Risk Level</span>
                  <span className={`stat-value risk-${aiAnalysis.riskLevel.toLowerCase()}`}>
                    {aiAnalysis.riskLevel}
                  </span>
                </div>
                <div className="analysis-stat">
                  <span className="stat-label">Time to $</span>
                  <span className="stat-value">{aiAnalysis.timeToFirstDollar}</span>
                </div>
                <div className="analysis-stat">
                  <span className="stat-label">Confidence</span>
                  <span className="stat-value">{aiAnalysis.confidenceScore}%</span>
                </div>
              </div>

              <div className="analysis-section">
                <h4>Recommended Approach</h4>
                <p>{aiAnalysis.recommendedApproach}</p>
              </div>

              <div className="analysis-section">
                <h4>Potential Risks</h4>
                <ul>
                  {aiAnalysis.potentialRisks.map((risk, i) => (
                    <li key={i}>{risk}</li>
                  ))}
                </ul>
              </div>

              <div className="analysis-section">
                <h4>Next Steps</h4>
                <ol>
                  {aiAnalysis.nextSteps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
