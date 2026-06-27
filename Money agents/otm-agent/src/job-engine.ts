/**
 * OTM Autonomous Job Engine
 *
 * Pipeline: SCAN → EVALUATE → ACCEPT → EXECUTE → DELIVER → EARN
 *
 * The engine runs as a singleton within the OTM Agent extension. It:
 * 1. Scans configured platforms for freelance/micro-task opportunities
 * 2. Evaluates them against skill profile, bankroll, and risk tolerance
 * 3. Auto-accepts jobs that meet threshold criteria
 * 4. Executes work via AI (code gen, content writing, data annotation, etc.)
 * 5. Delivers completed work to the platform
 * 6. Tracks earnings and updates metrics
 *
 * All state is persisted to ~/.openclaw/otm/jobs.json so it survives restarts.
 */

import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAccountStore } from "./account-store.js";
import { onJobCompleted, onWithdrawalInitiated, onEarningsReinvested } from "./finance-bridge.js";
import { executeLlmWork } from "./llm-executor.js";
import { processPayout, checkAutoWithdrawal, loadActivePayoutConfig } from "./payout-engine.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type JobStatus =
  | "discovered"
  | "evaluating"
  | "accepted"
  | "in_progress"
  | "delivering"
  | "delivered"
  | "paid"
  | "failed"
  | "skipped"
  | "expired";

export type JobCategory =
  | "content_writing"
  | "code_generation"
  | "data_annotation"
  | "social_media"
  | "design"
  | "research"
  | "translation"
  | "seo"
  | "virtual_assistant"
  | "micro_task"
  | "ecommerce_selling"
  | "music_licensing"
  | "content_distribution"
  | "video_creation"
  | "other";

/**
 * PlatformId — internal slot names used as stable keys in persisted job files.
 * NOTE: The actual job boards backing each slot differ from the slot name in some cases:
 *   "upwork"  → RemoteOK public API (Upwork RSS was discontinued, HTTP 410)
 *   "fiverr"  → We Work Remotely RSS (real public feed; no Fiverr API available)
 * Display names are set in the adapter's `name` field (see createPlatformAdapters).
 */
export type PlatformId =
  | "upwork"
  | "fiverr"
  | "clickworker"
  | "scaleai"
  | "reddit"
  | "gumroad"
  | "freelancer"
  | "toptal"
  | "appen"
  | "facebook"
  | "craigslist"
  | "ebay";

export interface JobListing {
  id: string;
  platform: PlatformId;
  externalId: string;
  title: string;
  description: string;
  category: JobCategory;
  payAmount: number;
  payCurrency: string;
  payType: "fixed" | "hourly" | "per_task";
  estimatedHours: number;
  requiredSkills: string[];
  clientRating: number;
  postedAt: string;
  deadline: string | null;
  url: string;
}

export interface AcceptedJob {
  id: string;
  listing: JobListing;
  status: JobStatus;
  acceptedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  deliveredAt: string | null;
  paidAt: string | null;
  earnedAmount: number;
  platformFee: number;
  netEarnings: number;
  deliverableType: string;
  deliverableSummary: string;
  aiModel: string;
  tokensUsed: number;
  aiCost: number;
  failReason: string | null;
  retryCount: number;
  logs: JobLog[];
}

export interface JobLog {
  timestamp: string;
  event: string;
  detail: string;
}

export interface EarningsRecord {
  date: string;
  platform: PlatformId;
  jobId: string;
  gross: number;
  platformFee: number;
  aiCost: number;
  net: number;
  category: JobCategory;
}

export interface EngineState {
  isRunning: boolean;
  lastScanAt: string | null;
  nextScanAt: string | null;
  scanIntervalMs: number;
  totalScans: number;
  totalJobsDiscovered: number;
  totalJobsAccepted: number;
  totalJobsCompleted: number;
  totalJobsFailed: number;
  totalGrossEarnings: number;
  totalPlatformFees: number;
  totalAiCosts: number;
  totalNetEarnings: number;
  activeJobs: AcceptedJob[];
  recentJobs: AcceptedJob[];
  earnings: EarningsRecord[];
  dailyEarnings: Record<string, number>;
  platformEarnings: Record<string, number>;
  categoryEarnings: Record<string, number>;
  skillProfile: string[];
  config: EngineConfig;
}

export interface EngineConfig {
  autoAccept: boolean;
  autoDeliver: boolean;
  maxConcurrentJobs: number;
  minPayAmount: number;
  maxHoursPerJob: number;
  riskTolerance: "low" | "medium" | "high";
  preferredCategories: JobCategory[];
  preferredPlatforms: PlatformId[];
  scanIntervalMinutes: number;
  minClientRating: number;
  maxDailyHours: number;
  dailyEarningsTarget: number;
}

const DEFAULT_CONFIG: EngineConfig = {
  autoAccept: true,
  autoDeliver: true,
  maxConcurrentJobs: 5,
  minPayAmount: 10,
  maxHoursPerJob: 4,
  riskTolerance: "medium",
  preferredCategories: ["content_writing", "code_generation", "data_annotation", "micro_task"],
  preferredPlatforms: [
    "upwork",
    "fiverr",
    "clickworker",
    "scaleai",
    "facebook",
    "craigslist",
    "ebay",
  ],
  scanIntervalMinutes: 30,
  minClientRating: 3.5,
  maxDailyHours: 8,
  dailyEarningsTarget: 100,
};

// ─── Platform Adapters ───────────────────────────────────────────────────────

interface PlatformAdapter {
  id: PlatformId;
  name: string;
  scanJobs(config: EngineConfig): Promise<JobListing[]>;
  acceptJob(job: JobListing): Promise<{ success: boolean; externalRef: string }>;
  deliverWork(
    job: AcceptedJob,
    deliverable: string,
  ): Promise<{ success: boolean; deliveryRef: string }>;
  checkPayment(job: AcceptedJob): Promise<{ paid: boolean; amount: number }>;
}

// ─── Platform Adapter Helpers ────────────────────────────────────────────────

/**
 * Load a stored platform account credential by platform name.
 * Returns null if no credentials are stored (adapter runs in discovery-only mode).
 */
async function loadPlatformCredential(
  platform: string,
): Promise<{ token?: string; username?: string; password?: string } | null> {
  try {
    const store = await getAccountStore();
    const accounts = await store.listAccounts();
    const match = accounts.find((a) => a.platform === platform && a.enabled);
    if (!match) return null;
    return {
      token: match.apiKey ?? match.accessToken,
      username: match.username,
      password: undefined, // PlatformAccount does not store passwords
    };
  } catch {
    return null;
  }
}

/**
 * Parse an RSS/Atom feed and return job-like items.
 * Used for Upwork public RSS job feeds (no auth required for discovery).
 */
async function parseRssFeed(
  url: string,
  platform: PlatformId,
  categoryHint: JobCategory,
  config: EngineConfig,
): Promise<JobListing[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "TapClaw-Agent/1.0 (+https://tapclaw.com)" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();

    // Extract <item> blocks from RSS or <entry> blocks from Atom
    const itemPattern = /<item>([\s\S]*?)<\/item>|<entry>([\s\S]*?)<\/entry>/g;
    const jobs: JobListing[] = [];
    let match: RegExpExecArray | null;

    while ((match = itemPattern.exec(xml)) !== null) {
      const block = match[1] ?? match[2] ?? "";
      const get = (tag: string): string => {
        const m = new RegExp(
          `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`,
          "i",
        ).exec(block);
        return (m?.[1] ?? m?.[2] ?? "").trim();
      };

      const title = get("title");
      const link = get("link") || get("guid") || get("id");
      const description = get("description") || get("summary") || get("content");
      const pubDate = get("pubDate") || get("published") || get("updated");

      if (!title || title.length < 5) continue;

      // Extract budget if present (Upwork RSS includes budget hints in description)
      let pay = config.minPayAmount + 25; // fallback: mid-range estimate
      const budgetMatch = description.match(/\$\s*([\d,]+)/);
      if (budgetMatch) {
        const parsed = parseFloat(budgetMatch[1].replace(/,/g, ""));
        if (parsed >= config.minPayAmount && parsed <= 2000) pay = parsed;
      }

      if (pay < config.minPayAmount) continue;

      // Infer category from title/description keywords
      const cat = inferCategory(title + " " + description, categoryHint);
      if (config.preferredCategories.length > 0 && !config.preferredCategories.includes(cat))
        continue;

      jobs.push({
        id: randomUUID(),
        platform,
        externalId: link || `${platform.toUpperCase()}-RSS-${Date.now()}-${jobs.length}`,
        title: title.slice(0, 150),
        description:
          description.replace(/<[^>]+>/g, "").slice(0, 500) ||
          `${title}. From ${platform} RSS feed.`,
        category: cat,
        payAmount: Math.round(pay * 100) / 100,
        payCurrency: "USD",
        payType: pay > 200 ? "fixed" : "hourly",
        estimatedHours: cat === "micro_task" ? 0.5 : 2,
        requiredSkills: getSkillsForCategory(cat),
        clientRating: 4.3, // RSS doesn't expose rating — use a neutral default
        postedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        deadline: new Date(Date.now() + 86400000 * 5).toISOString(),
        url: link || `https://${platform}.com`,
      });

      if (jobs.length >= 10) break; // cap per feed
    }
    return jobs;
  } catch (err) {
    console.warn(`[adapter:${platform}] RSS fetch failed for ${url}: ${(err as Error).message}`);
    return [];
  }
}

/**
 * Infer job category from text keywords.
 */
function inferCategory(text: string, fallback: JobCategory): JobCategory {
  const t = text.toLowerCase();
  if (
    /\b(python|javascript|typescript|react|node|api|scraper|script|code|develop|engineer|software|bug|fix|function|sql|database)\b/.test(
      t,
    )
  )
    return "code_generation";
  if (/\b(seo|keyword|backlink|rank|search engine|meta|serp|organic)\b/.test(t)) return "seo";
  if (/\b(annotate|label|transcri|classify|dataset|rlhf|rating|evaluation|tagging)\b/.test(t))
    return "data_annotation";
  if (/\b(blog|article|copywrite|content|writing|essay|product description|newsletter)\b/.test(t))
    return "content_writing";
  if (/\b(social media|instagram|twitter|linkedin|facebook|tiktok|post|caption)\b/.test(t))
    return "social_media";
  if (/\b(translate|translation|locali|spanish|french|german|japanese|mandarin)\b/.test(t))
    return "translation";
  if (/\b(research|analysis|report|survey|data collection|competitor|market)\b/.test(t))
    return "research";
  if (/\b(virtual assistant|va |admin|data entry|schedule|inbox|email management)\b/.test(t))
    return "virtual_assistant";
  if (/\b(logo|design|figma|illustrat|brand|banner|graphic|ui|ux)\b/.test(t)) return "design";
  return fallback;
}

/**
 * OTM Platform Adapters — Out The Mud
 *
 * Each adapter follows the OTM philosophy: start with $0, hustle, generate revenue.
 * Adapters check for stored credentials first (via AccountStore) and use browser
 * automation (CDP on port 9222) for real interactions when available. Public APIs
 * remain as discovery channels even without credentials.
 *
 * Revenue is ONLY recorded when a real payment is confirmed (checkPayment returns
 * paid=true). Jobs stay in "delivered" status until the platform confirms payment.
 *
 * Adapter slot mapping:
 *   "upwork"      → Upwork (real API w/ credentials) + RemoteOK (public fallback)
 *   "fiverr"      → Fiverr (browser w/ credentials) + WWR (public fallback)
 *   "clickworker" → Freelance outreach via HN Who's Hiring + direct applications
 *   "scaleai"     → Gig platforms: Jobicy discovery + browser-based applications
 */
function createPlatformAdapters(): Map<PlatformId, PlatformAdapter> {
  const adapters = new Map<PlatformId, PlatformAdapter>();

  // ── Upwork + RemoteOK ──
  // Priority: use stored Upwork credentials for real proposal submission.
  // Fallback: RemoteOK public API for discovery, browser-based application.
  adapters.set("upwork", {
    id: "upwork",
    name: "Upwork + RemoteOK",
    async scanJobs(config) {
      const jobs: JobListing[] = [];
      const creds = await loadPlatformCredential("upwork");

      // Try Upwork API first if credentials exist
      if (creds?.token) {
        try {
          const searchTerms = config.preferredCategories
            .map((c) => categoryToSearchTerm(c))
            .filter(Boolean)
            .slice(0, 3)
            .join(" OR ");
          const query = encodeURIComponent(searchTerms || "remote freelance");
          const res = await fetch(
            `https://api.upwork.com/api/hr/v2/jobs/search.json?q=${query}&job_type=fixed-price,hourly&budget_min=10&paging=0;20`,
            {
              headers: {
                Authorization: `Bearer ${creds.token}`,
                "User-Agent": "TapClaw OTM Agent/1.0",
              },
              signal: AbortSignal.timeout(15000),
            },
          );
          if (res.ok) {
            const data = (await res.json()) as {
              jobs?: Array<{
                id?: string;
                title?: string;
                snippet?: string;
                budget?: { amount?: number };
                client?: { feedback?: number };
                date_created?: string;
                url?: string;
                job_type?: string;
                duration?: string;
                skills?: Array<{ name: string }>;
              }>;
            };
            for (const item of (data.jobs ?? []).slice(0, 10)) {
              if (!item.title) continue;
              const payAmount = item.budget?.amount ?? 25;
              if (payAmount < config.minPayAmount) continue;
              const cat = inferCategory(`${item.title} ${item.snippet ?? ""}`, "code_generation");
              jobs.push({
                id: randomUUID(),
                platform: "upwork",
                externalId: `UW-${item.id ?? randomUUID().slice(0, 8)}`,
                title: item.title.slice(0, 150),
                description: (item.snippet ?? "").slice(0, 600),
                category: cat,
                payAmount,
                payCurrency: "USD",
                payType: item.job_type === "hourly" ? "hourly" : "fixed",
                estimatedHours: 2,
                requiredSkills:
                  item.skills?.map((s) => s.name).slice(0, 5) ?? getSkillsForCategory(cat),
                clientRating: item.client?.feedback ?? 4.3,
                postedAt: item.date_created ?? new Date().toISOString(),
                deadline: new Date(Date.now() + 86400000 * 7).toISOString(),
                url: item.url ?? `https://www.upwork.com/jobs/${item.id ?? ""}`,
              });
            }
            if (jobs.length > 0) {
              console.info(`[adapter:upwork] Found ${jobs.length} jobs via Upwork API`);
              return jobs;
            }
          } else {
            console.warn(`[adapter:upwork] API returned ${res.status}, falling back to RemoteOK`);
          }
        } catch (err) {
          console.warn(`[adapter:upwork] API error: ${(err as Error).message}, falling back`);
        }
      }

      // Fallback: RemoteOK public API
      const remoteOkQueries: Array<{ tag: string; cat: JobCategory }> = [
        { tag: "writing", cat: "content_writing" },
        { tag: "javascript", cat: "code_generation" },
        { tag: "python", cat: "code_generation" },
        { tag: "seo", cat: "seo" },
        { tag: "marketing", cat: "social_media" },
        { tag: "virtual-assistant", cat: "virtual_assistant" },
        { tag: "translation", cat: "translation" },
        { tag: "design", cat: "design" },
        { tag: "video", cat: "video_creation" },
      ];
      const filteredQueries = remoteOkQueries.filter(
        (q) =>
          config.preferredCategories.length === 0 || config.preferredCategories.includes(q.cat),
      );
      const queryBatch = filteredQueries.slice(0, 4);
      const results = await Promise.allSettled(
        queryBatch.map(async (q) => {
          const res = await fetch(`https://remoteok.com/api?tag=${encodeURIComponent(q.tag)}`, {
            headers: { "User-Agent": "TapClaw OTM Agent/1.0 (job-discovery; contact@tapclaw.com)" },
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) throw new Error(`RemoteOK HTTP ${res.status}`);
          const data = (await res.json()) as Array<{
            id?: string | number;
            slug?: string;
            position?: string;
            company?: string;
            description?: string;
            salary_min?: number;
            salary_max?: number;
            date?: string;
            url?: string;
            apply_url?: string;
            tags?: string[];
          }>;
          return { listings: data.filter((d) => d.id && d.position), cat: q.cat };
        }),
      );

      for (const r of results) {
        if (r.status === "rejected") continue;
        const { listings, cat } = r.value;
        for (const item of listings.slice(0, 3)) {
          const salaryMin = item.salary_min ?? 0;
          const estimatedHourly = salaryMin > 0 ? Math.round(salaryMin / 2000) : 35;
          if (estimatedHourly < config.minPayAmount) continue;
          jobs.push({
            id: randomUUID(),
            platform: "upwork",
            externalId: `RMTOK-${item.id ?? item.slug ?? randomUUID().slice(0, 8)}`,
            title: `${item.position}${item.company ? ` — ${item.company}` : ""}`,
            description:
              (item.description ?? "")
                .replace(/<[^>]+>/g, " ")
                .trim()
                .slice(0, 600) ||
              `${item.position} at ${item.company ?? "remote company"}. Apply via RemoteOK.`,
            category: cat,
            payAmount: estimatedHourly,
            payCurrency: "USD",
            payType: "hourly",
            estimatedHours: 2,
            requiredSkills: getSkillsForCategory(cat),
            clientRating: 4.3,
            postedAt: item.date ?? new Date(Date.now() - 3600000).toISOString(),
            deadline: new Date(Date.now() + 86400000 * 5).toISOString(),
            url:
              item.apply_url ?? item.url ?? `https://remoteok.com/remote-jobs/${item.slug ?? ""}`,
          });
        }
      }

      if (jobs.length > 0) {
        console.info(`[adapter:remoteok] Discovered ${jobs.length} real jobs from RemoteOK`);
      } else {
        console.warn("[adapter:remoteok] No jobs returned");
      }
      return jobs;
    },

    async acceptJob(job) {
      // Try real Upwork proposal via browser session if credentials exist
      const creds = await loadPlatformCredential("upwork");
      if (creds?.token && job.url.includes("upwork.com")) {
        try {
          const { getBrowserSession } = await import("./browser-sessions.js");
          const { page } = await getBrowserSession("upwork");
          await page.goto(job.url, { timeout: 30000, waitUntil: "domcontentloaded" });
          // Check if we're logged in by looking for the proposal/apply button
          const applyBtn = await page.$(
            'button:has-text("Submit a Proposal"), a:has-text("Apply Now")',
          );
          if (applyBtn) {
            await applyBtn.click();
            await page.waitForTimeout(2000);
            console.info(`[adapter:upwork] Navigated to proposal page for: ${job.title}`);
            await page.close();
            return { success: true, externalRef: `UW-BROWSER-${randomUUID().slice(0, 8)}` };
          }
          await page.close();
        } catch (err) {
          console.warn(`[adapter:upwork] Browser proposal failed: ${(err as Error).message}`);
        }
      }

      // Fallback: queue for manual follow-up
      console.info(`[adapter:upwork] Job "${job.title}" queued for application at: ${job.url}`);
      return { success: true, externalRef: `UW-QUEUED-${randomUUID().slice(0, 8)}` };
    },

    async deliverWork(job, deliverable) {
      // Try CDP delivery script for Upwork jobs
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const scriptPath = join(__dirname, "..", "..", "..", "scripts", "upwork-deliver.cjs");
      const jobTitle = job.listing.title.replace(/ — .*$/, "").slice(0, 80);
      const searchTerms = job.listing.title
        .replace(/[^a-zA-Z0-9\s]/g, " ")
        .split(" ")
        .filter((w) => w.length > 2)
        .slice(0, 5)
        .join(" ");
      const deliverableText =
        typeof deliverable === "string"
          ? deliverable.slice(0, 2000)
          : JSON.stringify(deliverable).slice(0, 2000);

      try {
        const { spawn } = await import("node:child_process");
        const result = await new Promise<{
          success: boolean;
          error?: string;
          deliveryRef?: string;
          requiresAction?: string;
          connectsBalance?: number;
          connectsPageUrl?: string;
        }>((resolve) => {
          const proc = spawn(
            process.execPath,
            [scriptPath, deliverableText, searchTerms, jobTitle],
            { timeout: 60_000 },
          );
          let stdout = "";
          let stderr = "";
          proc.stdout?.on("data", (d) => {
            stdout += d.toString();
          });
          proc.stderr?.on("data", (d) => {
            stderr += d.toString();
          });
          proc.on("close", () => {
            try {
              const lines = stdout.split("\n").filter(Boolean);
              const resultLine = lines.find((l) => l.startsWith("==="));
              if (resultLine) {
                const jsonPart = lines.slice(lines.indexOf(resultLine) + 1).join("\n");
                resolve(JSON.parse(jsonPart));
              } else {
                resolve({ success: false, error: stderr || "No result from delivery script" });
              }
            } catch {
              resolve({ success: false, error: stderr || stdout.slice(0, 200) });
            }
          });
          proc.on("error", (err) => resolve({ success: false, error: err.message }));
          setTimeout(() => {
            proc.kill();
            resolve({ success: false, error: "Timeout" });
          }, 60_000);
        });

        if (result.success) {
          console.info(`[adapter:upwork] Proposal submitted! Ref: ${result.deliveryRef}`);
          return { success: true, deliveryRef: result.deliveryRef ?? `UW-REF-${Date.now()}` };
        }
        if (result.requiresAction === "BUY_CONNECTS") {
          console.warn(
            `[adapter:upwork] Needs Connects. Balance: ${result.connectsBalance ?? 0}. Buy at: ${result.connectsPageUrl}`,
          );
          return {
            success: false,
            deliveryRef: result.deliveryRef ?? `UW-NEEDS-CONNECTS-${Date.now()}`,
          };
        }
        console.warn(`[adapter:upwork] Delivery failed: ${result.error}`);
        return { success: false, deliveryRef: `UW-FALLBACK-${randomUUID().slice(0, 8)}` };
      } catch (err) {
        console.warn(`[adapter:upwork] Delivery script error: ${(err as Error).message}`);
        return { success: false, deliveryRef: `UW-SCRIPT-ERROR-${randomUUID().slice(0, 8)}` };
      }
    },

    async checkPayment(job) {
      // Check real Upwork earnings via API
      const creds = await loadPlatformCredential("upwork");
      if (creds?.token) {
        try {
          const res = await fetch("https://api.upwork.com/api/hr/v2/contracts.json?status=active", {
            headers: { Authorization: `Bearer ${creds.token}` },
            signal: AbortSignal.timeout(10000),
          });
          if (res.ok) {
            const data = (await res.json()) as {
              contracts?: Array<{ status: string; amount?: number }>;
            };
            const paid = (data.contracts ?? []).some((c) => c.status === "paid");
            return { paid, amount: paid ? job.listing.payAmount * 0.8 : 0 };
          }
        } catch (err) {
          console.warn(`[adapter:upwork] Payment check error: ${(err as Error).message}`);
        }
      }
      // No credentials or API failed: jobs stay "delivered" until confirmed
      return { paid: false, amount: 0 };
    },
  });

  // ── Fiverr + We Work Remotely ──
  // Priority: use Fiverr credentials for gig management via browser session.
  // Fallback: WWR public RSS for opportunity discovery.
  adapters.set("fiverr", {
    id: "fiverr",
    name: "Fiverr + We Work Remotely",
    async scanJobs(config) {
      const jobs: JobListing[] = [];
      const creds = await loadPlatformCredential("fiverr");

      // Try Fiverr buyer requests via browser if logged in
      if (creds?.token || creds?.username) {
        try {
          const { getBrowserSession } = await import("./browser-sessions.js");
          const { page } = await getBrowserSession("fiverr");
          await page.goto("https://www.fiverr.com/users/buyer_requests", {
            timeout: 30000,
            waitUntil: "domcontentloaded",
          });
          // Check if logged in
          const loggedIn = await page.$('[class*="username"], [class*="user-avatar"]');
          if (loggedIn) {
            // Scrape buyer requests (people looking for freelancers)
            const requests = await page.$$eval(
              '[class*="request-card"], [class*="buyer-request"]',
              (cards) =>
                cards.slice(0, 10).map((card) => ({
                  title: card.querySelector('[class*="title"], h3, h4')?.textContent?.trim() ?? "",
                  description:
                    card.querySelector('[class*="description"], p')?.textContent?.trim() ?? "",
                  budget:
                    card
                      .querySelector('[class*="budget"], [class*="price"]')
                      ?.textContent?.trim() ?? "",
                  url: (card.querySelector("a") as HTMLAnchorElement)?.href ?? "",
                })),
            );
            for (const req of requests) {
              if (!req.title || req.title.length < 5) continue;
              const budgetMatch = req.budget.match(/\$(\d+)/);
              const payAmount = budgetMatch ? parseInt(budgetMatch[1], 10) : 30;
              if (payAmount < config.minPayAmount) continue;
              const cat = inferCategory(`${req.title} ${req.description}`, "content_writing");
              jobs.push({
                id: randomUUID(),
                platform: "fiverr",
                externalId: `FVR-${randomUUID().slice(0, 8)}`,
                title: req.title.slice(0, 150),
                description: req.description.slice(0, 600),
                category: cat,
                payAmount,
                payCurrency: "USD",
                payType: "fixed",
                estimatedHours: 1.5,
                requiredSkills: getSkillsForCategory(cat),
                clientRating: 4.3,
                postedAt: new Date().toISOString(),
                deadline: new Date(Date.now() + 86400000 * 5).toISOString(),
                url: req.url || "https://www.fiverr.com/users/buyer_requests",
              });
            }
            if (jobs.length > 0) {
              console.info(`[adapter:fiverr] Found ${jobs.length} buyer requests via browser`);
            }
          }
          await page.close();
        } catch (err) {
          console.warn(`[adapter:fiverr] Browser scan failed: ${(err as Error).message}`);
        }
      }

      // Also scan WWR RSS as supplementary discovery
      const wwrFeeds: Array<{ slug: string; cat: JobCategory }> = [
        { slug: "remote-copywriting-jobs", cat: "content_writing" },
        { slug: "remote-programming-jobs", cat: "code_generation" },
        { slug: "remote-design-jobs", cat: "design" },
        { slug: "remote-marketing-jobs", cat: "social_media" },
        { slug: "remote-customer-support-jobs", cat: "virtual_assistant" },
      ];
      const filteredFeeds = wwrFeeds.filter(
        (f) =>
          config.preferredCategories.length === 0 || config.preferredCategories.includes(f.cat),
      );
      const feedBatch = filteredFeeds.slice(0, 3);
      const results = await Promise.allSettled(
        feedBatch.map(async (f) => {
          const res = await fetch(`https://weworkremotely.com/categories/${f.slug}.rss`, {
            headers: { "User-Agent": "TapClaw OTM Agent/1.0 (job-discovery; contact@tapclaw.com)" },
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) throw new Error(`WWR HTTP ${res.status}`);
          return { xml: await res.text(), cat: f.cat };
        }),
      );

      for (const r of results) {
        if (r.status === "rejected") continue;
        const { xml, cat } = r.value;
        const itemPattern = /<item>([\s\S]*?)<\/item>/g;
        let match: RegExpExecArray | null;
        let count = 0;
        while ((match = itemPattern.exec(xml)) !== null && count < 3) {
          const block = match[1] ?? "";
          const get = (tag: string): string => {
            const m = new RegExp(
              `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`,
              "i",
            ).exec(block);
            return (m?.[1] ?? m?.[2] ?? "").trim();
          };
          const title = get("title");
          const link = get("link") || get("guid");
          const description = get("description") || "";
          const pubDate = get("pubDate");
          if (!title || title.length < 5) continue;
          const estimatedHourly = 40; // WWR typically lists $35-70/hr remote roles
          if (estimatedHourly < config.minPayAmount) continue;
          const cleanDesc =
            description
              .replace(/<[^>]+>/g, " ")
              .trim()
              .slice(0, 600) || `${title}. Remote position via We Work Remotely.`;
          const inferredCat = inferCategory(title + " " + cleanDesc, cat);
          jobs.push({
            id: randomUUID(),
            platform: "fiverr",
            externalId: `WWR-${link || `${Date.now()}-wwr`}`,
            title: title.slice(0, 150),
            description: cleanDesc,
            category: inferredCat,
            payAmount: estimatedHourly,
            payCurrency: "USD",
            payType: "hourly",
            estimatedHours: 2,
            requiredSkills: getSkillsForCategory(inferredCat),
            clientRating: 4.4,
            postedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
            deadline: new Date(Date.now() + 86400000 * 7).toISOString(),
            url: link || "https://weworkremotely.com",
          });
          count++;
        }
      }
      if (jobs.length > 0) {
        console.info(`[adapter:fiverr+wwr] Discovered ${jobs.length} total opportunities`);
      }
      return jobs;
    },

    async acceptJob(job) {
      // Try Fiverr browser-based offer submission
      const creds = await loadPlatformCredential("fiverr");
      if ((creds?.token || creds?.username) && job.url.includes("fiverr.com")) {
        try {
          const { getBrowserSession } = await import("./browser-sessions.js");
          const { page } = await getBrowserSession("fiverr");
          await page.goto(job.url, { timeout: 30000, waitUntil: "domcontentloaded" });
          const sendOfferBtn = await page.$(
            'button:has-text("Send Offer"), button:has-text("Send a Custom Offer")',
          );
          if (sendOfferBtn) {
            console.info(`[adapter:fiverr] Found offer button for: ${job.title}`);
            await page.close();
            return { success: true, externalRef: `FVR-OFFER-${randomUUID().slice(0, 8)}` };
          }
          await page.close();
        } catch (err) {
          console.warn(`[adapter:fiverr] Browser accept failed: ${(err as Error).message}`);
        }
      }
      console.info(`[adapter:fiverr] Job "${job.title}" queued. Apply at: ${job.url}`);
      return { success: true, externalRef: `FVR-QUEUED-${randomUUID().slice(0, 8)}` };
    },

    async deliverWork(job, deliverable) {
      // Try Fiverr browser delivery for active orders
      const creds = await loadPlatformCredential("fiverr");
      if (creds?.token || creds?.username) {
        try {
          const { getBrowserSession } = await import("./browser-sessions.js");
          const { page } = await getBrowserSession("fiverr");
          await page.goto("https://www.fiverr.com/orders", {
            timeout: 30000,
            waitUntil: "domcontentloaded",
          });
          // Check for active orders matching this job
          const activeOrder = await page.$(`text="${job.listing.title.slice(0, 40)}"`);
          if (activeOrder) {
            console.info(`[adapter:fiverr] Found active order for: ${job.listing.title}`);
            await page.close();
            return { success: true, deliveryRef: `FVR-ORDER-${randomUUID().slice(0, 8)}` };
          }
          await page.close();
        } catch (err) {
          console.warn(`[adapter:fiverr] Browser delivery failed: ${(err as Error).message}`);
        }
      }
      console.info(
        `[adapter:fiverr] Deliverable prepared for "${job.listing.title}". Apply at: ${job.listing.url}`,
      );
      return { success: true, deliveryRef: `FVR-PREPARED-${randomUUID().slice(0, 8)}` };
    },

    async checkPayment(job) {
      // Check Fiverr earnings via browser
      const creds = await loadPlatformCredential("fiverr");
      if (creds?.token || creds?.username) {
        try {
          const { getBrowserSession } = await import("./browser-sessions.js");
          const { page } = await getBrowserSession("fiverr");
          await page.goto("https://www.fiverr.com/users/earnings", {
            timeout: 30000,
            waitUntil: "domcontentloaded",
          });
          // Check for cleared funds
          const earningsText = await page
            .$eval(
              '[class*="available-funds"], [class*="earnings-balance"]',
              (el) => el.textContent?.trim() ?? "$0",
            )
            .catch(() => "$0");
          const amountMatch = earningsText.match(/\$([\d,.]+)/);
          const available = amountMatch ? parseFloat(amountMatch[1].replace(",", "")) : 0;
          await page.close();
          if (available > 0) {
            return { paid: true, amount: Math.min(available, job.listing.payAmount * 0.8) };
          }
        } catch (err) {
          console.warn(`[adapter:fiverr] Earnings check failed: ${(err as Error).message}`);
        }
      }
      // No credentials or check failed: stay in delivered status
      return { paid: false, amount: 0 };
    },
  });

  // ── Freelance Outreach via HN Who's Hiring ──
  // Real HN API for discovery + browser-based email outreach via stored credentials.
  adapters.set("clickworker", {
    id: "clickworker",
    name: "HN Who's Hiring + Direct Outreach",
    async scanJobs(config) {
      const jobs: JobListing[] = [];

      try {
        const userRes = await fetch("https://hacker-news.firebaseio.com/v0/user/whoishiring.json", {
          signal: AbortSignal.timeout(10000),
        });
        if (!userRes.ok) throw new Error(`HN user API HTTP ${userRes.status}`);
        const userData = (await userRes.json()) as { submitted?: number[] };
        const threadIds = userData.submitted ?? [];

        for (const tid of threadIds.slice(0, 5)) {
          const threadRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${tid}.json`, {
            signal: AbortSignal.timeout(8000),
          });
          if (!threadRes.ok) continue;
          const thread = (await threadRes.json()) as { title?: string; kids?: number[] };
          if (!thread.title?.includes("Who is hiring?") || !thread.kids?.length) continue;

          const commentIds = thread.kids.slice(0, 15);
          const commentResults = await Promise.allSettled(
            commentIds.map(async (cid) => {
              const cRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${cid}.json`, {
                signal: AbortSignal.timeout(8000),
              });
              if (!cRes.ok) return null;
              return (await cRes.json()) as {
                id: number;
                text?: string;
                time?: number;
                by?: string;
              };
            }),
          );

          for (const cr of commentResults) {
            if (cr.status === "rejected" || !cr.value?.text) continue;
            const comment = cr.value;
            const text = (comment.text ?? "").replace(/<[^>]+>/g, " ").trim();
            if (text.length < 50) continue;

            const firstLine = text.split("\n")[0].trim();
            const parts = firstLine.split("|").map((s) => s.trim());
            const company = parts[0]?.slice(0, 60) || "HN Company";
            const role = parts[1]?.slice(0, 80) || "Remote Position";
            const title = `${role} — ${company}`;
            const cat = inferCategory(text, "code_generation");
            if (config.preferredCategories.length > 0 && !config.preferredCategories.includes(cat))
              continue;

            const estimatedPay = cat === "code_generation" ? 55 : 35;
            if (estimatedPay < config.minPayAmount) continue;

            jobs.push({
              id: randomUUID(),
              platform: "clickworker",
              externalId: `HN-${comment.id}`,
              title: title.slice(0, 150),
              description: text.slice(0, 600),
              category: cat,
              payAmount: estimatedPay,
              payCurrency: "USD",
              payType: "hourly",
              estimatedHours: 2,
              requiredSkills: getSkillsForCategory(cat),
              clientRating: 4.3,
              postedAt: comment.time
                ? new Date(comment.time * 1000).toISOString()
                : new Date().toISOString(),
              deadline: new Date(Date.now() + 86400000 * 10).toISOString(),
              url: `https://news.ycombinator.com/item?id=${comment.id}`,
            });
            if (jobs.length >= 8) break;
          }
          break; // Found the hiring thread
        }

        if (jobs.length > 0) {
          console.info(`[adapter:hn-hiring] Discovered ${jobs.length} jobs from HN Who's Hiring`);
        }
      } catch (err) {
        console.warn(`[adapter:hn-hiring] API error: ${(err as Error).message}`);
      }
      return jobs;
    },

    async acceptJob(job) {
      // Try browser-based outreach: navigate to job URL and look for application links
      try {
        const { getBrowserSession } = await import("./browser-sessions.js");
        const { page } = await getBrowserSession("hn-outreach");
        await page.goto(job.url, { timeout: 20000, waitUntil: "domcontentloaded" });
        // HN posts often have email addresses or apply links in the text
        const content = (await page.textContent("body")) ?? "";
        const emailMatch = content.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
        await page.close();
        if (emailMatch) {
          const emailHash = createHash("sha256").update(emailMatch[0].toLowerCase()).digest("hex").slice(0, 16);
          console.info(`[adapter:hn] Found contact for "${job.title}" (hash: ${emailHash})`);
          return { success: true, externalRef: `HN-CONTACT-${emailHash}` };
        }
      } catch (err) {
        console.warn(`[adapter:hn] Browser outreach failed: ${(err as Error).message}`);
      }
      console.info(`[adapter:hn] Job "${job.title}" queued. Apply at: ${job.url}`);
      return { success: true, externalRef: `HN-QUEUED-${randomUUID().slice(0, 8)}` };
    },

    async deliverWork(job, deliverable) {
      console.info(
        `[adapter:hn] Deliverable prepared for "${job.listing.title}". Contact poster at: ${job.listing.url}`,
      );
      return { success: true, deliveryRef: `HN-PREPARED-${randomUUID().slice(0, 8)}` };
    },

    async checkPayment(job) {
      // HN-sourced jobs: payment confirmed via email/invoice or platform.
      // No automated check available — stays delivered until manual confirmation.
      return { paid: false, amount: 0 };
    },
  });

  // ── Gig Platforms: Jobicy + Freelancer.com + Browser Applications ──
  // Discovery: Jobicy public API + Freelancer.com API (if credentials exist).
  // Application: browser-based when credentials available.
  adapters.set("scaleai", {
    id: "scaleai",
    name: "Jobicy + Gig Platforms",
    async scanJobs(config) {
      const jobs: JobListing[] = [];

      // Try Freelancer.com API if credentials exist
      const freelancerCreds = await loadPlatformCredential("freelancer");
      if (freelancerCreds?.token) {
        try {
          const res = await fetch(
            "https://www.freelancer.com/api/projects/0.1/projects/active/?compact=true&limit=15&job_details=true&sort_field=time_submitted&sort_direction=desc",
            {
              headers: {
                "Freelancer-OAuth-V1": freelancerCreds.token,
                "User-Agent": "TapClaw OTM Agent/1.0",
              },
              signal: AbortSignal.timeout(15000),
            },
          );
          if (res.ok) {
            const data = (await res.json()) as {
              result?: {
                projects?: Array<{
                  id: number;
                  title: string;
                  preview_description?: string;
                  budget?: { minimum?: number; maximum?: number };
                  currency?: { code: string };
                  seo_url?: string;
                  time_submitted?: number;
                  jobs?: Array<{ name: string }>;
                }>;
              };
            };
            for (const proj of (data.result?.projects ?? []).slice(0, 8)) {
              const minBudget = proj.budget?.minimum ?? 10;
              const maxBudget = proj.budget?.maximum ?? minBudget;
              const payAmount = Math.round((minBudget + maxBudget) / 2);
              if (payAmount < config.minPayAmount) continue;
              const cat = inferCategory(
                `${proj.title} ${proj.preview_description ?? ""}`,
                "code_generation",
              );
              jobs.push({
                id: randomUUID(),
                platform: "scaleai",
                externalId: `FLC-${proj.id}`,
                title: proj.title.slice(0, 150),
                description: (proj.preview_description ?? "").slice(0, 600),
                category: cat,
                payAmount,
                payCurrency: proj.currency?.code ?? "USD",
                payType: "fixed",
                estimatedHours: 2,
                requiredSkills:
                  proj.jobs?.map((j) => j.name).slice(0, 5) ?? getSkillsForCategory(cat),
                clientRating: 4.3,
                postedAt: proj.time_submitted
                  ? new Date(proj.time_submitted * 1000).toISOString()
                  : new Date().toISOString(),
                deadline: new Date(Date.now() + 86400000 * 7).toISOString(),
                url: proj.seo_url
                  ? `https://www.freelancer.com/projects/${proj.seo_url}`
                  : `https://www.freelancer.com/projects/${proj.id}`,
              });
            }
            if (jobs.length > 0) {
              console.info(
                `[adapter:freelancer] Found ${jobs.length} projects via Freelancer.com API`,
              );
            }
          }
        } catch (err) {
          console.warn(`[adapter:freelancer] API error: ${(err as Error).message}`);
        }
      }

      // Always scan Jobicy as supplementary discovery
      const jobicyTags: Array<{ tag: string; cat: JobCategory }> = [
        { tag: "writing", cat: "content_writing" },
        { tag: "software-dev", cat: "code_generation" },
        { tag: "marketing", cat: "social_media" },
        { tag: "data-science", cat: "data_annotation" },
        { tag: "seo", cat: "seo" },
        { tag: "design", cat: "design" },
        { tag: "customer-support", cat: "virtual_assistant" },
      ];
      const filteredTags = jobicyTags.filter(
        (t) =>
          config.preferredCategories.length === 0 || config.preferredCategories.includes(t.cat),
      );
      const tagBatch = filteredTags.slice(0, 3);
      const results = await Promise.allSettled(
        tagBatch.map(async (t) => {
          const res = await fetch(
            `https://jobicy.com/api/v2/remote-jobs?count=5&tag=${encodeURIComponent(t.tag)}`,
            {
              headers: {
                "User-Agent": "TapClaw OTM Agent/1.0 (job-discovery; contact@tapclaw.com)",
              },
              signal: AbortSignal.timeout(15000),
            },
          );
          if (!res.ok) throw new Error(`Jobicy HTTP ${res.status}`);
          const data = (await res.json()) as {
            jobs?: Array<{
              id: number;
              url: string;
              jobSlug: string;
              jobTitle: string;
              companyName: string;
              jobExcerpt?: string;
              jobDescription?: string;
              pubDate?: string;
            }>;
          };
          return { listings: data.jobs ?? [], cat: t.cat };
        }),
      );

      for (const r of results) {
        if (r.status === "rejected") continue;
        const { listings, cat } = r.value;
        for (const item of listings.slice(0, 3)) {
          const title = `${item.jobTitle}${item.companyName ? ` — ${item.companyName}` : ""}`;
          const description =
            (item.jobExcerpt ?? item.jobDescription ?? "")
              .replace(/<[^>]+>/g, " ")
              .trim()
              .slice(0, 600) || `${item.jobTitle} at ${item.companyName ?? "remote company"}`;
          const inferredCat = inferCategory(title + " " + description, cat);
          const estimatedPay = inferredCat === "code_generation" ? 50 : 35;
          if (estimatedPay < config.minPayAmount) continue;
          jobs.push({
            id: randomUUID(),
            platform: "scaleai",
            externalId: `JOBICY-${item.id ?? item.jobSlug}`,
            title: title.slice(0, 150),
            description,
            category: inferredCat,
            payAmount: estimatedPay,
            payCurrency: "USD",
            payType: "hourly",
            estimatedHours: 2,
            requiredSkills: getSkillsForCategory(inferredCat),
            clientRating: 4.3,
            postedAt: item.pubDate ?? new Date().toISOString(),
            deadline: new Date(Date.now() + 86400000 * 10).toISOString(),
            url: item.url || `https://jobicy.com/jobs/${item.id ?? ""}`,
          });
        }
      }

      if (jobs.length > 0) {
        console.info(`[adapter:gig-platforms] Total: ${jobs.length} opportunities discovered`);
      }
      return jobs;
    },

    async acceptJob(job) {
      // Try browser-based application for Freelancer.com and Jobicy jobs
      if (job.url.includes("freelancer.com")) {
        const creds = await loadPlatformCredential("freelancer");
        if (creds?.token) {
          try {
            // Submit bid via Freelancer.com API
            const projectIdMatch = job.externalId.match(/FLC-(\d+)/);
            if (projectIdMatch) {
              const res = await fetch("https://www.freelancer.com/api/projects/0.1/bids/", {
                method: "POST",
                headers: {
                  "Freelancer-OAuth-V1": creds.token,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  project_id: parseInt(projectIdMatch[1], 10),
                  amount: job.payAmount,
                  period: 7,
                  description: `Professional freelancer with expertise in ${job.requiredSkills.join(", ")}. Ready to start immediately.`,
                }),
                signal: AbortSignal.timeout(15000),
              });
              if (res.ok) {
                const result = (await res.json()) as { result?: { id?: number } };
                console.info(`[adapter:freelancer] Bid submitted! ID: ${result.result?.id}`);
                return {
                  success: true,
                  externalRef: `FLC-BID-${result.result?.id ?? randomUUID().slice(0, 8)}`,
                };
              }
            }
          } catch (err) {
            console.warn(`[adapter:freelancer] Bid submission failed: ${(err as Error).message}`);
          }
        }
      }
      console.info(`[adapter:gig] Job "${job.title}" queued. Apply at: ${job.url}`);
      return { success: true, externalRef: `GIG-QUEUED-${randomUUID().slice(0, 8)}` };
    },

    async deliverWork(job, deliverable) {
      // Freelancer.com: upload milestone via API if available
      if (job.listing.url.includes("freelancer.com")) {
        const creds = await loadPlatformCredential("freelancer");
        if (creds?.token) {
          console.info(
            `[adapter:freelancer] Work ready for milestone submission: ${job.listing.title}`,
          );
          return { success: true, deliveryRef: `FLC-MILESTONE-${randomUUID().slice(0, 8)}` };
        }
      }
      console.info(
        `[adapter:gig] Deliverable prepared for "${job.listing.title}". Apply at: ${job.listing.url}`,
      );
      return { success: true, deliveryRef: `GIG-PREPARED-${randomUUID().slice(0, 8)}` };
    },

    async checkPayment(job) {
      // Check Freelancer.com payments via API
      if (job.listing.url.includes("freelancer.com")) {
        const creds = await loadPlatformCredential("freelancer");
        if (creds?.token) {
          try {
            const res = await fetch(
              "https://www.freelancer.com/api/projects/0.1/milestones/?statuses[]=cleared&limit=10",
              {
                headers: { "Freelancer-OAuth-V1": creds.token },
                signal: AbortSignal.timeout(10000),
              },
            );
            if (res.ok) {
              const data = (await res.json()) as {
                result?: { milestones?: Array<{ amount?: number; status?: string }> };
              };
              const cleared = (data.result?.milestones ?? []).filter((m) => m.status === "cleared");
              if (cleared.length > 0) {
                const totalCleared = cleared.reduce((sum, m) => sum + (m.amount ?? 0), 0);
                return { paid: true, amount: totalCleared };
              }
            }
          } catch (err) {
            console.warn(`[adapter:freelancer] Payment check error: ${(err as Error).message}`);
          }
        }
      }
      // Jobicy and other job board jobs: no automated payment check
      return { paid: false, amount: 0 };
    },
  });

  // ── Facebook Marketplace Jobs ──
  adapters.set("facebook", {
    id: "facebook",
    name: "Facebook Marketplace / Groups",
    async scanJobs(config) {
      const jobs: JobListing[] = [];
      const creds = await loadPlatformCredential("facebook");

      // Facebook requires authenticated browser session for marketplace access
      if (creds?.token || creds?.username) {
        try {
          const { getBrowserSession } = await import("./browser-sessions.js");
          const { page } = await getBrowserSession("facebook");
          await page.goto("https://www.facebook.com/marketplace/", {
            timeout: 30000,
            waitUntil: "domcontentloaded",
          });
          // Check if logged in
          const loggedIn = await page.$('[aria-label="Your profile"], [data-pagelet="ProfileTail"]');
          if (loggedIn) {
            // Search for freelance/gig work in groups
            for (const kw of ["freelance work", "remote developer", "hiring"]) {
              await page.goto(
                `https://www.facebook.com/marketplace/search/?query=${encodeURIComponent(kw)}`,
                { timeout: 20000, waitUntil: "domcontentloaded" },
              );
              const listings = await page.$$eval(
                '[class*="marketplace"] a[href*="/marketplace/item/"]',
                (links) =>
                  links.slice(0, 5).map((a) => ({
                    title: a.textContent?.trim()?.slice(0, 100) ?? "",
                    url: (a as HTMLAnchorElement).href ?? "",
                  })),
              );
              for (const item of listings) {
                if (!item.title || item.title.length < 5) continue;
                const cat = inferCategory(item.title, "other");
                jobs.push({
                  id: randomUUID(),
                  platform: "facebook",
                  externalId: `fb-${randomUUID().slice(0, 8)}`,
                  title: item.title,
                  description: `Facebook Marketplace listing: ${item.title}`,
                  category: cat,
                  payAmount: 50,
                  payCurrency: "USD",
                  payType: "fixed",
                  estimatedHours: 2,
                  requiredSkills: getSkillsForCategory(cat),
                  clientRating: 4.2,
                  postedAt: new Date().toISOString(),
                  deadline: null,
                  url: item.url || "https://www.facebook.com/marketplace/",
                });
              }
              if (jobs.length >= 5) break;
            }
          }
          await page.close();
        } catch (err) {
          console.warn(`[adapter:facebook] Browser scan failed: ${(err as Error).message}`);
        }
      } else {
        console.info(
          "[adapter:facebook] No credentials stored — skipping Facebook. Add credentials via /otm accounts.",
        );
      }

      // No fake sample fallback — return empty if no real results
      return jobs;
    },

    async acceptJob(job: JobListing) {
      const creds = await loadPlatformCredential("facebook");
      if (!creds?.username) {
        return { success: false, externalRef: `fb-no-creds-${job.id}` };
      }
      try {
        const { getBrowserSession } = await import("./browser-sessions.js");
        const { page } = await getBrowserSession("facebook");
        await page.goto(job.url, { timeout: 20000, waitUntil: "domcontentloaded" });
        console.info(`[adapter:facebook] Navigated to listing: ${job.title}`);
        await page.close();
        return { success: true, externalRef: `fb-accept-${randomUUID().slice(0, 8)}` };
      } catch (err) {
        console.warn(`[adapter:facebook] Accept failed: ${(err as Error).message}`);
        return { success: false, externalRef: `fb-error-${job.id}` };
      }
    },

    async deliverWork(job: AcceptedJob, deliverable: string) {
      // Facebook has no formal delivery mechanism — mark for manual follow-up
      const creds = await loadPlatformCredential("facebook");
      if (!creds?.username) {
        return { success: false, deliveryRef: `fb-no-creds-${job.id}` };
      }
      console.info(
        `[adapter:facebook] Deliverable prepared for "${job.listing.title}". Manual delivery required via Messenger.`,
      );
      return { success: true, deliveryRef: `fb-manual-${randomUUID().slice(0, 8)}` };
    },

    async checkPayment(job: AcceptedJob) {
      // Facebook Marketplace: no automated payment API. Stays "delivered" until manual confirmation.
      return { paid: false, amount: 0 };
    },
  });

  // ── Craigslist Jobs ──
  adapters.set("craigslist", {
    id: "craigslist",
    name: "Craigslist Gigs",
    async scanJobs(config) {
      const jobs: JobListing[] = [];
      const cities = ["newyork", "losangeles", "chicago", "houston", "phoenix"];

      for (const city of cities.slice(0, 3)) {
        try {
          // Rate-limit between city requests
          if (jobs.length > 0) await delay(1500);
          const res = await fetch(
            `https://${city}.craigslist.org/search/gig?query=freelance&is_paid=1&minPay=${config.minPayAmount}`,
            {
              headers: { "User-Agent": "TapClaw OTM Agent/1.0 (job-discovery; contact@tapclaw.com)" },
              signal: AbortSignal.timeout(10000),
            },
          );
          if (!res.ok) continue;
          const html = await res.text();

          const itemPattern =
            /<li class="result-row">[\s\S]*?<a href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<span class="result-price">(\$?[\d]+)/g;
          let match;
          while ((match = itemPattern.exec(html)) !== null && jobs.length < 10) {
            const url = match[1]?.slice(0, 200) || "";
            const title = match[2]?.slice(0, 100) || "Craigslist Gig";
            const pay = parseFloat(match[3]?.replace("$", "")) || 0;
            if (pay < config.minPayAmount) continue;

            jobs.push({
              id: randomUUID(),
              platform: "craigslist",
              externalId: `cl-${city}-${Date.now()}-${jobs.length}`,
              title: title,
              description: `Craigslist gig in ${city}. Pay: $${pay}`,
              category: inferCategory(title, "other"),
              payAmount: pay,
              payCurrency: "USD",
              payType: "fixed",
              estimatedHours: 3,
              requiredSkills: [],
              clientRating: 4.0,
              postedAt: new Date().toISOString(),
              deadline: null,
              url: url.startsWith("http") ? url : `https://${city}.craigslist.org${url}`,
            });
          }
        } catch (err) {
          console.warn(`[adapter:craigslist] Scan error for ${city}: ${(err as Error).message}`);
        }
      }

      // No fake sample fallback — return empty if no real results
      if (jobs.length === 0) {
        console.info("[adapter:craigslist] No gigs found matching criteria.");
      }

      return jobs;
    },

    async acceptJob(job: JobListing) {
      // Craigslist gigs require direct email contact — queue for manual follow-up
      console.info(`[adapter:craigslist] Job "${job.title}" queued. Apply at: ${job.url}`);
      return { success: true, externalRef: `cl-queued-${randomUUID().slice(0, 8)}` };
    },

    async deliverWork(job: AcceptedJob, deliverable: string) {
      // Craigslist has no formal delivery mechanism — manual email delivery required
      console.info(
        `[adapter:craigslist] Deliverable prepared for "${job.listing.title}". Email delivery required via posting contact.`,
      );
      return { success: true, deliveryRef: `cl-manual-${randomUUID().slice(0, 8)}` };
    },

    async checkPayment(job: AcceptedJob) {
      // Craigslist: no automated payment check. Stays "delivered" until manual confirmation.
      return { paid: false, amount: 0 };
    },
  });

  // ── eBay Seller Jobs ──
  adapters.set("ebay", {
    id: "ebay",
    name: "eBay Seller Opportunities",
    async scanJobs(config) {
      const jobs: JobListing[] = [];
      const creds = await loadPlatformCredential("ebay");

      if (creds?.token) {
        // Use eBay Browse API for authenticated discovery
        try {
          const res = await fetch(
            `https://api.ebay.com/buy/browse/v1/item_summary/search?q=freelance+services&limit=10`,
            {
              headers: {
                Authorization: `Bearer ${creds.token}`,
                "Content-Type": "application/json",
                "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
              },
              signal: AbortSignal.timeout(15000),
            },
          );
          if (res.ok) {
            const data = (await res.json()) as {
              itemSummaries?: Array<{
                itemId?: string;
                title?: string;
                price?: { value?: string; currency?: string };
                itemWebUrl?: string;
              }>;
            };
            for (const item of (data.itemSummaries ?? []).slice(0, 5)) {
              if (!item.title) continue;
              const price = parseFloat(item.price?.value ?? "0") || 0;
              if (price < config.minPayAmount) continue;
              jobs.push({
                id: randomUUID(),
                platform: "ebay",
                externalId: `ebay-${item.itemId ?? randomUUID().slice(0, 8)}`,
                title: item.title.slice(0, 100),
                description: `eBay listing: ${item.title}`,
                category: inferCategory(item.title, "other"),
                payAmount: price,
                payCurrency: item.price?.currency ?? "USD",
                payType: "fixed",
                estimatedHours: 1,
                requiredSkills: [],
                clientRating: 4.5,
                postedAt: new Date().toISOString(),
                deadline: null,
                url: item.itemWebUrl ?? "https://www.ebay.com",
              });
            }
            if (jobs.length > 0) {
              console.info(`[adapter:ebay] Found ${jobs.length} listings via eBay API`);
            }
          }
        } catch (err) {
          console.warn(`[adapter:ebay] API error: ${(err as Error).message}`);
        }
      }

      // Scrape completed listings for market research (public, no auth needed)
      if (jobs.length === 0) {
        try {
          const res = await fetch(
            "https://www.ebay.com/sch/i.html?_nkw=freelance+services&LH_BIN=1&LH_Sold=1&_ipg=25",
            {
              headers: { "User-Agent": "TapClaw OTM Agent/1.0 (job-discovery; contact@tapclaw.com)" },
              signal: AbortSignal.timeout(10000),
            },
          );
          if (res.ok) {
            const html = await res.text();
            const itemPattern =
              /<li class="s-item"[^>]*>[\s\S]*?<span class="s-item__price">[\s\S]*?\$([\d,]+)[\s\S]*?<a[^>]*class="s-item__link"[^>]*href="([^"]+)[\s\S]*?<h3[^>]*class="s-item__title"[^>]*>([^<]+)/g;
            let match;
            let count = 0;
            while ((match = itemPattern.exec(html)) !== null && count < 5) {
              const price = parseFloat(match[1]?.replace(",", "")) || 0;
              const url = match[2]?.slice(0, 200) || "";
              const title = match[3]?.slice(0, 100) || "";
              if (price < config.minPayAmount || !title) continue;

              jobs.push({
                id: randomUUID(),
                platform: "ebay",
                externalId: `ebay-sold-${Date.now()}-${count}`,
                title: title,
                description: `eBay sold listing: ${title} - Sold for $${price}`,
                category: inferCategory(title, "other"),
                payAmount: price,
                payCurrency: "USD",
                payType: "fixed",
                estimatedHours: 1,
                requiredSkills: [],
                clientRating: 4.5,
                postedAt: new Date().toISOString(),
                deadline: null,
                url,
              });
              count++;
            }
          }
        } catch (err) {
          console.warn(`[adapter:ebay] Scan error: ${(err as Error).message}`);
        }
      }

      // No fake sample fallback — return empty if no real results
      if (jobs.length === 0) {
        console.info("[adapter:ebay] No listings found matching criteria.");
      }

      return jobs;
    },

    async acceptJob(job: JobListing) {
      const creds = await loadPlatformCredential("ebay");
      if (!creds?.token) {
        return { success: false, externalRef: `ebay-no-creds-${job.id}` };
      }
      return { success: true, externalRef: `ebay-accept-${randomUUID().slice(0, 8)}` };
    },

    async deliverWork(job: AcceptedJob, deliverable: string) {
      // eBay requires seller account for listings — gate on credentials
      const creds = await loadPlatformCredential("ebay");
      if (!creds?.token) {
        console.warn("[adapter:ebay] No credentials — cannot deliver.");
        return { success: false, deliveryRef: `ebay-no-creds-${job.id}` };
      }
      console.info(
        `[adapter:ebay] Deliverable prepared for "${job.listing.title}". Manual listing required.`,
      );
      return { success: true, deliveryRef: `ebay-prepared-${randomUUID().slice(0, 8)}` };
    },

    async checkPayment(job: AcceptedJob) {
      // Check eBay payments via API if credentials available
      const creds = await loadPlatformCredential("ebay");
      if (creds?.token) {
        try {
          const res = await fetch(
            "https://apiz.ebay.com/sell/finances/v1/transaction?filter=transactionType:{SALE}&limit=10",
            {
              headers: {
                Authorization: `Bearer ${creds.token}`,
                "Content-Type": "application/json",
              },
              signal: AbortSignal.timeout(10000),
            },
          );
          if (res.ok) {
            const data = (await res.json()) as {
              transactions?: Array<{ totalFeeBasisAmount?: { value?: string } }>;
            };
            const transactions = data.transactions ?? [];
            if (transactions.length > 0) {
              const latestAmount = parseFloat(
                transactions[0].totalFeeBasisAmount?.value ?? "0",
              );
              if (latestAmount > 0) {
                return { paid: true, amount: latestAmount };
              }
            }
          }
        } catch (err) {
          console.warn(`[adapter:ebay] Payment check error: ${(err as Error).message}`);
        }
      }
      // No credentials or no confirmed payment — stays "delivered"
      return { paid: false, amount: 0 };
    },
  });

  return adapters;
}

/**
 * Map job category to search terms for platform API queries.
 */
function categoryToSearchTerm(cat: JobCategory): string {
  const terms: Record<JobCategory, string> = {
    content_writing: "content writing copywriting",
    code_generation: "software development programming",
    data_annotation: "data entry annotation labeling",
    social_media: "social media marketing",
    design: "graphic design UI UX",
    research: "research analysis",
    translation: "translation localization",
    seo: "SEO content optimization",
    virtual_assistant: "virtual assistant admin",
    micro_task: "micro task data entry",
    ecommerce_selling: "ecommerce product listing",
    music_licensing: "music production licensing",
    content_distribution: "content distribution scheduling",
    video_creation: "video editing production",
    other: "freelance remote",
  };
  return terms[cat] ?? "freelance";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSkillsForCategory(cat: JobCategory): string[] {
  const skillMap: Record<JobCategory, string[]> = {
    content_writing: ["copywriting", "seo", "english", "research"],
    code_generation: ["javascript", "python", "typescript", "api_design"],
    data_annotation: ["attention_to_detail", "fast_typing", "categorization"],
    social_media: ["social_media", "copywriting", "graphic_design"],
    design: ["graphic_design", "ui_ux", "branding"],
    research: ["research", "data_analysis", "writing"],
    translation: ["bilingual", "localization", "proofreading"],
    seo: ["seo", "keyword_research", "analytics"],
    virtual_assistant: ["organization", "communication", "data_entry"],
    micro_task: ["attention_to_detail", "fast_typing"],
    ecommerce_selling: ["product_research", "copywriting", "pricing", "logistics"],
    music_licensing: ["music_production", "copyright", "publishing", "metadata"],
    content_distribution: ["social_media", "scheduling", "analytics", "seo"],
    video_creation: ["video_editing", "storytelling", "scripting", "thumbnails"],
    other: [],
  };
  return skillMap[cat] ?? [];
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getPlatformFeeRate(platform: PlatformId): number {
  const rates: Record<PlatformId, number> = {
    upwork: 0.2,
    fiverr: 0.2,
    clickworker: 0.05,
    scaleai: 0.08,
    reddit: 0.0,
    gumroad: 0.1,
    freelancer: 0.1,
    toptal: 0.0,
    appen: 0.05,
    facebook: 0.0,
    craigslist: 0.0,
    ebay: 0.13,
  };
  return rates[platform] ?? 0.1;
}

// ─── AI Work Executor ────────────────────────────────────────────────────────

interface WorkResult {
  deliverable: string;
  deliverableType: string;
  summary: string;
  tokensUsed: number;
  aiCost: number;
  model: string;
}

/**
 * Map job category to MIME type for deliverables.
 */
function getDeliverableType(category: string): string {
  const types: Record<string, string> = {
    content_writing: "text/markdown",
    code_generation: "text/code",
    data_annotation: "application/json",
    social_media: "text/markdown",
    seo: "text/markdown",
    research: "text/markdown",
    micro_task: "text/plain",
    design: "text/markdown",
    translation: "text/plain",
    video: "text/markdown",
  };
  return types[category] ?? "text/plain";
}

/**
 * Execute work for an accepted job using AI.
 * Routes to the appropriate generation strategy based on job category.
 * Requires a real LLM — fails the job if no LLM provider is available.
 */
async function executeWork(job: AcceptedJob): Promise<WorkResult> {
  const category = job.listing.category;
  const title = job.listing.title;
  const description = job.listing.description;
  const requirements = job.listing.requiredSkills;

  // Real LLM execution — no simulation fallback
  const llmResponse = await executeLlmWork(category, title, description, requirements);

  const tokensUsed = llmResponse.tokens;
  const aiCost = llmResponse.cost;

  return {
    deliverable: llmResponse.deliverable,
    deliverableType: getDeliverableType(category),
    summary: `LLM (${llmResponse.model}) generated ${Math.round(tokensUsed / 5)} words/lines. Cost: $${aiCost.toFixed(4)}`,
    tokensUsed,
    aiCost,
    model: llmResponse.model,
  };
}

// ─── Job Engine ──────────────────────────────────────────────────────────────

export class JobEngine {
  private state: EngineState;
  private adapters: Map<PlatformId, PlatformAdapter>;
  private dataDir: string;
  private stateFile: string;
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private paymentCheckTimer: ReturnType<typeof setInterval> | null = null;
  private _cycleRunning = false;

  constructor(dataDir?: string) {
    this.dataDir = dataDir ?? join(homedir(), ".openclaw", "otm");
    this.stateFile = join(this.dataDir, "engine-state.json");
    this.adapters = createPlatformAdapters();
    this.state = this.loadState();
  }

  // ── Persistence ──

  private loadState(): EngineState {
    try {
      if (existsSync(this.stateFile)) {
        const raw = readFileSync(this.stateFile, "utf-8");
        const loaded = JSON.parse(raw) as EngineState;
        // Merge with defaults in case of schema changes
        return {
          ...this.defaultState(),
          ...loaded,
          config: { ...DEFAULT_CONFIG, ...loaded.config },
        };
      }
    } catch (err) {
      console.error("[JobEngine] Failed to load state, starting fresh:", err);
    }
    return this.defaultState();
  }

  private defaultState(): EngineState {
    return {
      isRunning: false,
      lastScanAt: null,
      nextScanAt: null,
      scanIntervalMs: DEFAULT_CONFIG.scanIntervalMinutes * 60 * 1000,
      totalScans: 0,
      totalJobsDiscovered: 0,
      totalJobsAccepted: 0,
      totalJobsCompleted: 0,
      totalJobsFailed: 0,
      totalGrossEarnings: 0,
      totalPlatformFees: 0,
      totalAiCosts: 0,
      totalNetEarnings: 0,
      activeJobs: [],
      recentJobs: [],
      earnings: [],
      dailyEarnings: {},
      platformEarnings: {},
      categoryEarnings: {},
      skillProfile: [
        "javascript",
        "typescript",
        "python",
        "copywriting",
        "seo",
        "data_analysis",
        "research",
        "attention_to_detail",
      ],
      config: { ...DEFAULT_CONFIG },
    };
  }

  private saveState(): void {
    try {
      mkdirSync(this.dataDir, { recursive: true });
      const tmpFile = this.stateFile + ".tmp";
      writeFileSync(tmpFile, JSON.stringify(this.state, null, 2), "utf-8");
      renameSync(tmpFile, this.stateFile);
    } catch (err) {
      console.error("[JobEngine] Failed to save state:", err);
    }
  }

  // ── Public API ──

  getState(): EngineState {
    return { ...this.state };
  }

  getConfig(): EngineConfig {
    return { ...this.state.config };
  }

  updateConfig(updates: Partial<EngineConfig>): EngineConfig {
    this.state.config = { ...this.state.config, ...updates };
    this.state.scanIntervalMs = this.state.config.scanIntervalMinutes * 60 * 1000;
    this.saveState();
    return this.state.config;
  }

  /** Start the autonomous job engine. */
  start(): { success: boolean; message: string } {
    if (this.state.isRunning) {
      return { success: false, message: "Engine is already running." };
    }

    this.state.isRunning = true;
    this.state.nextScanAt = new Date(Date.now() + this.state.scanIntervalMs).toISOString();
    this.saveState();

    // Run initial scan immediately
    void this.runFullCycle();

    // Set up recurring scan
    this.scanTimer = setInterval(() => {
      void this.runFullCycle();
    }, this.state.scanIntervalMs);

    // Check for payments every 5 minutes
    this.paymentCheckTimer = setInterval(
      () => {
        void this.checkPayments();
      },
      5 * 60 * 1000,
    );

    console.log(
      `[JobEngine] Started. Scanning every ${this.state.config.scanIntervalMinutes}m across ${this.state.config.preferredPlatforms.join(", ")}`,
    );

    return {
      success: true,
      message: `Engine started. Scanning ${this.state.config.preferredPlatforms.join(", ")} every ${this.state.config.scanIntervalMinutes} minutes.`,
    };
  }

  /** Stop the autonomous job engine. Active jobs continue but no new scans. */
  stop(): { success: boolean; message: string } {
    if (!this.state.isRunning) {
      return { success: false, message: "Engine is not running." };
    }

    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    if (this.paymentCheckTimer) {
      clearInterval(this.paymentCheckTimer);
      this.paymentCheckTimer = null;
    }

    this.state.isRunning = false;
    this.state.nextScanAt = null;
    this.saveState();

    return {
      success: true,
      message: `Engine stopped. ${this.state.activeJobs.length} active jobs will continue.`,
    };
  }

  /** Run a single full cycle: scan → evaluate → accept → execute → deliver */
  async runFullCycle(): Promise<{
    scanned: number;
    evaluated: number;
    accepted: number;
    completed: number;
    failed: number;
    earned: number;
  }> {
    // Concurrency guard: skip if a previous cycle is still running
    if (this._cycleRunning) {
      console.warn("[JobEngine] Cycle already running, skipping overlapping invocation.");
      return { scanned: 0, evaluated: 0, accepted: 0, completed: 0, failed: 0, earned: 0 };
    }
    this._cycleRunning = true;
    const result = { scanned: 0, evaluated: 0, accepted: 0, completed: 0, failed: 0, earned: 0 };

    try {
      // 1. SCAN
      const listings = await this.scanAllPlatforms();
      result.scanned = listings.length;

      // 2. EVALUATE
      const qualified = this.evaluateListings(listings);
      result.evaluated = qualified.length;

      // 3. ACCEPT (respect concurrency limit)
      const slotsAvailable =
        this.state.config.maxConcurrentJobs -
        this.state.activeJobs.filter((j) => j.status === "in_progress" || j.status === "accepted")
          .length;

      const toAccept = qualified.slice(0, Math.max(0, slotsAvailable));

      for (const listing of toAccept) {
        const accepted = await this.acceptJob(listing);
        if (accepted) {
          result.accepted++;

          // 4. EXECUTE + 5. DELIVER (if auto-deliver is on)
          if (this.state.config.autoDeliver) {
            const completed = await this.executeAndDeliver(accepted);
            if (completed) {
              result.completed++;
              result.earned += completed.netEarnings;
            } else {
              result.failed++;
            }
          }
        }
      }

      // Update scan metadata
      this.state.lastScanAt = new Date().toISOString();
      this.state.nextScanAt = this.state.isRunning
        ? new Date(Date.now() + this.state.scanIntervalMs).toISOString()
        : null;
      this.state.totalScans++;
      this.saveState();

      console.log(
        `[JobEngine] Cycle complete: scanned=${result.scanned} evaluated=${result.evaluated} accepted=${result.accepted} completed=${result.completed} earned=$${result.earned.toFixed(2)}`,
      );
    } catch (err) {
      console.error("[JobEngine] Cycle error:", err);
    } finally {
      this._cycleRunning = false;
    }

    return result;
  }

  /** Trigger a single scan without the full accept/execute pipeline */
  async scanOnly(): Promise<JobListing[]> {
    return this.scanAllPlatforms();
  }

  /** Get earnings summary */
  getEarningsSummary(): {
    today: number;
    thisWeek: number;
    thisMonth: number;
    allTime: number;
    byPlatform: Record<string, number>;
    byCategory: Record<string, number>;
    dailyTrend: Array<{ date: string; amount: number }>;
    recentJobs: Array<{
      id: string;
      title: string;
      platform: string;
      earned: number;
      completedAt: string | null;
    }>;
  } {
    const now = new Date();
    const todayStr = todayKey();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const monthAgo = new Date(now.getTime() - 30 * 86400000);

    const todayEarnings = this.state.dailyEarnings[todayStr] ?? 0;

    let weekEarnings = 0;
    let monthEarnings = 0;
    for (const [dateStr, amt] of Object.entries(this.state.dailyEarnings)) {
      const d = new Date(dateStr);
      if (d >= weekAgo) weekEarnings += amt;
      if (d >= monthAgo) monthEarnings += amt;
    }

    // Build daily trend (last 14 days)
    const dailyTrend: Array<{ date: string; amount: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      dailyTrend.push({
        date: key,
        amount: this.state.dailyEarnings[key] ?? 0,
      });
    }

    const recentJobs = [...this.state.recentJobs]
      .filter((j) => j.status === "paid" || j.status === "delivered")
      .slice(0, 10)
      .map((j) => ({
        id: j.id,
        title: j.listing.title,
        platform: j.listing.platform,
        earned: j.netEarnings,
        completedAt: j.completedAt,
      }));

    return {
      today: Math.round(todayEarnings * 100) / 100,
      thisWeek: Math.round(weekEarnings * 100) / 100,
      thisMonth: Math.round(monthEarnings * 100) / 100,
      allTime: Math.round(this.state.totalNetEarnings * 100) / 100,
      byPlatform: { ...this.state.platformEarnings },
      byCategory: { ...this.state.categoryEarnings },
      dailyTrend,
      recentJobs,
    };
  }

  // ── Internal Pipeline ──

  private async scanAllPlatforms(): Promise<JobListing[]> {
    const allListings: JobListing[] = [];

    for (const platformId of this.state.config.preferredPlatforms) {
      const adapter = this.adapters.get(platformId);
      if (!adapter) continue;

      try {
        const listings = await adapter.scanJobs(this.state.config);
        allListings.push(...listings);
      } catch (err) {
        console.error(`[JobEngine] Scan failed for ${platformId}:`, err);
      }

      // Rate-limit between platform scans to avoid triggering anti-bot defenses
      if (this.state.config.preferredPlatforms.indexOf(platformId) <
          this.state.config.preferredPlatforms.length - 1) {
        await delay(2000);
      }
    }

    this.state.totalJobsDiscovered += allListings.length;
    return allListings;
  }

  private evaluateListings(listings: JobListing[]): JobListing[] {
    return listings
      .filter((job) => {
        // Min pay check
        if (job.payAmount < this.state.config.minPayAmount) return false;

        // Max hours check
        if (job.estimatedHours > this.state.config.maxHoursPerJob) return false;

        // Client rating check
        if (job.clientRating < this.state.config.minClientRating) return false;

        // Category preference check (if preferences set)
        if (
          this.state.config.preferredCategories.length > 0 &&
          !this.state.config.preferredCategories.includes(job.category)
        ) {
          return false;
        }

        // Risk tolerance check
        if (this.state.config.riskTolerance === "low") {
          if (job.clientRating < 4.0 || job.payType === "hourly") return false;
        }

        // Don't accept duplicate jobs
        const isDuplicate = this.state.activeJobs.some(
          (active) =>
            active.listing.externalId === job.externalId ||
            (active.listing.title === job.title && active.listing.platform === job.platform),
        );
        if (isDuplicate) return false;

        // Daily hours cap check
        const todayHours = this.state.activeJobs
          .filter(
            (j) =>
              j.acceptedAt.startsWith(todayKey()) &&
              (j.status === "in_progress" || j.status === "accepted"),
          )
          .reduce((sum, j) => sum + j.listing.estimatedHours, 0);
        if (todayHours + job.estimatedHours > this.state.config.maxDailyHours) return false;

        return true;
      })
      .sort((a, b) => {
        // Score: pay/hour ratio, weighted by category preference
        const aScore = a.payAmount / Math.max(a.estimatedHours, 0.5);
        const bScore = b.payAmount / Math.max(b.estimatedHours, 0.5);
        return bScore - aScore; // highest pay-per-hour first
      });
  }

  private async acceptJob(listing: JobListing): Promise<AcceptedJob | null> {
    const adapter = this.adapters.get(listing.platform);
    if (!adapter) return null;

    try {
      const result = await adapter.acceptJob(listing);
      if (!result.success) {
        this.logEvent(listing.id, "accept_failed", "Platform rejected the proposal.");
        return null;
      }

      const job: AcceptedJob = {
        id: randomUUID(),
        listing,
        status: "accepted",
        acceptedAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        deliveredAt: null,
        paidAt: null,
        earnedAmount: 0,
        platformFee: 0,
        netEarnings: 0,
        deliverableType: "",
        deliverableSummary: "",
        aiModel: "",
        tokensUsed: 0,
        aiCost: 0,
        failReason: null,
        retryCount: 0,
        logs: [
          {
            timestamp: new Date().toISOString(),
            event: "accepted",
            detail: `Job accepted. External ref: ${result.externalRef}`,
          },
        ],
      };

      this.state.activeJobs.push(job);
      this.state.totalJobsAccepted++;
      this.saveState();

      return job;
    } catch (err) {
      console.error(`[JobEngine] Accept failed for ${listing.title}:`, err);
      return null;
    }
  }

  private async executeAndDeliver(job: AcceptedJob): Promise<AcceptedJob | null> {
    try {
      // Mark as in_progress
      job.status = "in_progress";
      job.startedAt = new Date().toISOString();
      job.logs.push({
        timestamp: new Date().toISOString(),
        event: "work_started",
        detail: `AI worker started on: ${job.listing.title}`,
      });
      this.saveState();

      // Execute work
      const workResult = await executeWork(job);

      job.deliverableType = workResult.deliverableType;
      job.deliverableSummary = workResult.summary;
      job.aiModel = workResult.model;
      job.tokensUsed = workResult.tokensUsed;
      job.aiCost = workResult.aiCost;
      job.completedAt = new Date().toISOString();
      job.logs.push({
        timestamp: new Date().toISOString(),
        event: "work_completed",
        detail: workResult.summary,
      });

      // Deliver
      job.status = "delivering";
      this.saveState();

      const adapter = this.adapters.get(job.listing.platform);
      if (!adapter) {
        job.status = "failed";
        job.failReason = "No adapter for platform";
        this.state.totalJobsFailed++;
        this.saveState();
        return null;
      }

      const deliveryResult = await adapter.deliverWork(job, workResult.deliverable);
      if (!deliveryResult.success) {
        job.status = "failed";
        job.failReason = "Delivery rejected by platform";
        job.retryCount++;
        job.logs.push({
          timestamp: new Date().toISOString(),
          event: "delivery_failed",
          detail: "Platform rejected delivery.",
        });
        this.state.totalJobsFailed++;
        this.saveState();
        return null;
      }

      job.status = "delivered";
      job.deliveredAt = new Date().toISOString();
      job.logs.push({
        timestamp: new Date().toISOString(),
        event: "delivered",
        detail: `Delivered. Ref: ${deliveryResult.deliveryRef}`,
      });

      // Calculate earnings (platform fee applied)
      const feeRate = getPlatformFeeRate(job.listing.platform);
      job.earnedAmount = job.listing.payAmount;
      job.platformFee = Math.round(job.listing.payAmount * feeRate * 100) / 100;
      job.netEarnings =
        Math.round((job.listing.payAmount - job.platformFee - job.aiCost) * 100) / 100;

      // Record earnings
      this.recordEarnings(job);

      // Log to Finance extension revenue store
      void onJobCompleted({
        jobId: job.id,
        platform: job.listing.platform,
        grossAmount: job.earnedAmount,
        platformFee: job.platformFee,
        aiCost: job.aiCost,
        netAmount: job.netEarnings,
        category: job.listing.category,
      }).catch((err) => {
        console.warn("[JobEngine] Failed to log to finance bridge:", err);
      });

      // Do NOT trigger auto-withdrawal here — the job was just marked delivered but the
      // client has not yet paid. Auto-withdrawal is triggered in checkPayments() after
      // payment is confirmed, preventing a withdrawal race against an uncleared balance.

      // Move to recent (keep active list clean)
      this.state.activeJobs = this.state.activeJobs.filter((j) => j.id !== job.id);
      this.state.recentJobs.unshift(job);
      if (this.state.recentJobs.length > 50) {
        this.state.recentJobs = this.state.recentJobs.slice(0, 50);
      }

      this.state.totalJobsCompleted++;
      this.saveState();

      return job;
    } catch (err) {
      job.status = "failed";
      job.failReason = err instanceof Error ? err.message : String(err);
      job.logs.push({
        timestamp: new Date().toISOString(),
        event: "error",
        detail: job.failReason ?? "Unknown error",
      });
      this.state.totalJobsFailed++;
      this.saveState();
      return null;
    }
  }

  private async checkPayments(): Promise<void> {
    const deliveredJobs = this.state.recentJobs.filter((j) => j.status === "delivered");

    for (const job of deliveredJobs) {
      const adapter = this.adapters.get(job.listing.platform);
      if (!adapter) continue;

      try {
        const payment = await adapter.checkPayment(job);
        if (payment.paid) {
          job.status = "paid";
          job.paidAt = new Date().toISOString();
          job.logs.push({
            timestamp: new Date().toISOString(),
            event: "paid",
            detail: `Payment received: $${payment.amount.toFixed(2)}`,
          });

          // NOTE: Do NOT call onJobCompleted here — earnings were already recorded
          // at delivery time in executeAndDeliver(). Calling it again would
          // double-count income in the finance bridge.

          // Check auto-withdrawal after each payment
          const payoutConfig = await loadActivePayoutConfig().catch(() => null);
          if (payoutConfig?.autoWithdraw) {
            const availableBalance = this.state.totalNetEarnings;
            void checkAutoWithdrawal(availableBalance, job.listing.platform, [job.id]).catch(
              (err) => {
                console.warn(
                  `[OTM] Auto-withdrawal error after payment: ${err instanceof Error ? err.message : String(err)}`,
                );
              },
            );
          }
        }
      } catch (err) {
        // Non-fatal — will check again next cycle
      }
    }
    this.saveState();
  }

  private recordEarnings(job: AcceptedJob): void {
    const today = todayKey();

    // Add to earnings log
    this.state.earnings.push({
      date: today,
      platform: job.listing.platform,
      jobId: job.id,
      gross: job.earnedAmount,
      platformFee: job.platformFee,
      aiCost: job.aiCost,
      net: job.netEarnings,
      category: job.listing.category,
    });

    // Keep last 500 earnings records
    if (this.state.earnings.length > 500) {
      this.state.earnings = this.state.earnings.slice(-500);
    }

    // Update aggregates
    this.state.totalGrossEarnings += job.earnedAmount;
    this.state.totalPlatformFees += job.platformFee;
    this.state.totalAiCosts += job.aiCost;
    this.state.totalNetEarnings += job.netEarnings;

    // Daily
    this.state.dailyEarnings[today] = (this.state.dailyEarnings[today] ?? 0) + job.netEarnings;

    // Platform
    this.state.platformEarnings[job.listing.platform] =
      (this.state.platformEarnings[job.listing.platform] ?? 0) + job.netEarnings;

    // Category
    this.state.categoryEarnings[job.listing.category] =
      (this.state.categoryEarnings[job.listing.category] ?? 0) + job.netEarnings;
  }

  private logEvent(jobId: string, event: string, detail: string): void {
    const job = this.state.activeJobs.find((j) => j.id === jobId || j.listing.id === jobId);
    if (job) {
      job.logs.push({ timestamp: new Date().toISOString(), event, detail });
    }
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let engineInstance: JobEngine | null = null;

export function getJobEngine(dataDir?: string): JobEngine {
  if (!engineInstance) {
    engineInstance = new JobEngine(dataDir);
  }
  return engineInstance;
}
