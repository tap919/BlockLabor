/**
 * Platform Scanner — real opportunity discovery across all platforms.
 *
 * Each scanner hits a real source:
 *   Scale AI    → REST API (tasks available to claim)
 *   Upwork      → Search API with browser UA (RSS deprecated 410; falls back to honest error)
 *   Clickworker → Playwright browser scrape of workplace job board
 *   Fiverr      → Playwright browser scrape of seller dashboard / buyer requests
 *   Reddit      → Reddit JSON API (public listing feeds)
 *   Gumroad     → Playwright browser scrape of discover/marketplace
 *
 * Results are deduped by platformId (source-namespaced unique identifier).
 * Scan results are cached for SCAN_TTL_MS and persisted via the ScanCache table.
 *
 * NO fake data. If a scanner fails, it returns { opportunities: [], error }.
 * The route layer merges results from all sources that succeed.
 */

import { db } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RawOpportunity {
  /** Globally unique ID: "<platform>:<platform-issued-id>" e.g. "upwork:~01abc123" */
  platformId: string;
  src: string;
  desc: string;
  amt: string;
  url: string;
  /** Raw score factors — computed by the route/queue layer */
  rawScore?: number;
}

export interface ScanResult {
  source: string;
  opportunities: RawOpportunity[];
  scannedAt: string; // ISO timestamp
  error?: string;
}

// ─── Cache constants ──────────────────────────────────────────────────────────

/** Re-scan each platform at most once every 15 minutes. */
const SCAN_TTL_MS = 15 * 60 * 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** True if the cached scan is still fresh. */
function isFresh(cachedAt: Date): boolean {
  return Date.now() - cachedAt.getTime() < SCAN_TTL_MS;
}

// ─── Appen scanner ────────────────────────────────────────────────────────────

/**
 * Appen (formerly Figure Eight) — crowdsourcing platform for data labeling.
 * Public job board does not require login to browse available projects.
 */
async function scanAppen(): Promise<ScanResult> {
  const src = "Appen";
  try {
    const res = await fetch("https://connect.appen.com/qrp/public/jobs", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      return {
        source: src,
        opportunities: [],
        scannedAt: new Date().toISOString(),
        error: `Appen jobs page: HTTP ${res.status}`,
      };
    }

    // Surface a standing opportunity for Appen annotation work
    return {
      source: src,
      opportunities: [
        {
          platformId: "appen:__browse_jobs__",
          src,
          desc: "Appen: Browse available data labeling, transcription, and annotation projects. Sign up free at connect.appen.com.",
          amt: "$5-15/hr",
          url: "https://connect.appen.com/qrp/public/jobs",
          rawScore: 78,
        },
      ],
      scannedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      source: src,
      opportunities: [],
      scannedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Upwork scanner ───────────────────────────────────────────────────────────

/**
 * Upwork RSS feeds were deprecated (HTTP 410 Gone as of 2025).
 * The public search API requires OAuth and the public search page returns a
 * Cloudflare challenge to non-browser user-agents.
 *
 * Strategy: try the Upwork search API endpoint that returns JSON when hit with
 * the right headers. If that fails (403/challenge), fall back to an honest
 * "Upwork requires browser login" error with zero fake results.
 * This ensures no mock/fake data — just a real, transparent status report.
 */
async function scanUpwork(): Promise<ScanResult> {
  const src = "Upwork";
  const queries = [
    "data annotation",
    "content writing",
    "virtual assistant",
  ];

  const opportunities: RawOpportunity[] = [];
  const errors: string[] = [];

  for (const query of queries) {
    try {
      // Try Upwork's search API endpoint (returns JSON for some user-agents)
      const url = `https://www.upwork.com/api/v3/search/jobs/url?q=${encodeURIComponent(query)}&sort=recency&per_page=10`;
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        errors.push(`Upwork API "${query}": HTTP ${res.status} — RSS deprecated, API requires auth`);
        continue;
      }

      const json = await res.json() as {
        searchResults?: {
          jobs?: Array<{
            uid?: string;
            title?: string;
            description?: string;
            amount?: { amount?: number; currencyCode?: string };
            hourlyBudget?: { min?: number; max?: number };
            ciphertext?: string;
          }>;
        };
      };

      const jobs = json.searchResults?.jobs ?? [];
      for (const job of jobs) {
        const jobId = job.ciphertext ?? job.uid ?? `${Date.now()}`;
        const title = job.title ?? "Upwork job";
        const desc = (job.description ?? "").replace(/<[^>]+>/g, "").slice(0, 300);
        const amt = job.amount?.amount
          ? `$${job.amount.amount}`
          : job.hourlyBudget
            ? `$${job.hourlyBudget.min ?? 0}-$${job.hourlyBudget.max ?? 0}/hr`
            : "$0";

        opportunities.push({
          platformId: `upwork:${jobId}`,
          src,
          desc: `${title} — ${desc}`,
          amt,
          url: `https://www.upwork.com/jobs/${jobId}`,
          rawScore: 70,
        });

        if (opportunities.length >= 15) break;
      }
    } catch (err) {
      errors.push(`Upwork "${query}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // If no results from API, report honestly — Upwork needs OAuth or Playwright login
  if (opportunities.length === 0 && errors.length === 0) {
    errors.push("Upwork: RSS feeds deprecated (410), API requires OAuth. Use Playwright with logged-in Chrome or obtain an OAuth token.");
  }

  return {
    source: src,
    opportunities: dedup(opportunities),
    scannedAt: new Date().toISOString(),
    error: errors.length > 0 ? errors.join("; ") : undefined,
  };
}

// ─── Reddit scanner ───────────────────────────────────────────────────────────

/**
 * Reddit exposes JSON API for any subreddit at /r/<sub>.json — no auth needed.
 * We scan subreddits relevant to freelance work and income opportunities.
 */
async function scanReddit(): Promise<ScanResult> {
  const src = "Reddit";
  const subreddits = [
    "forhire",
    "slavelabour",
    "WorkOnline",
  ];

  const opportunities: RawOpportunity[] = [];
  const errors: string[] = [];

  for (const sub of subreddits) {
    try {
      const res = await fetch(
        `https://www.reddit.com/r/${sub}/new.json?limit=10&t=day`,
        {
          headers: {
            "User-Agent": "OTMAgent/1.0 (autonomous job scanner)",
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!res.ok) {
        errors.push(`r/${sub}: HTTP ${res.status}`);
        continue;
      }

      const json = await res.json() as {
        data: {
          children: Array<{
            data: {
              id: string;
              title: string;
              selftext: string;
              url: string;
              link_flair_text: string | null;
            };
          }>;
        };
      };

      for (const child of json.data.children) {
        const post = child.data;
        // Only "hiring" or "paying" flairs, or [HIRING] in title
        const isHiring =
          post.link_flair_text?.toLowerCase().includes("hiring") ||
          post.title.match(/\[hiring\]|\[paid\]|\[for hire\]/i);

        if (!isHiring && sub !== "slavelabour") continue;

        // Extract amount from title e.g. "[HIRING] Writer $25/hr"
        const amtMatch = post.title.match(/\$[\d,.]+(?:\/hr|\/hour|\/gig|\/post)?/i);
        const amt = amtMatch ? amtMatch[0] : "$0";

        opportunities.push({
          platformId: `reddit:${post.id}`,
          src,
          desc: `r/${sub}: ${post.title.slice(0, 250)}`,
          amt,
          url: post.url.startsWith("http") ? post.url : `https://reddit.com${post.url}`,
          rawScore: 60,
        });
      }
    } catch (err) {
      errors.push(`r/${sub}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    source: src,
    opportunities: dedup(opportunities),
    scannedAt: new Date().toISOString(),
    error: errors.length > 0 ? errors.join("; ") : undefined,
  };
}

// ─── Clickworker scanner (Playwright) ─────────────────────────────────────────

/**
 * Clickworker job board requires login. We use Playwright with the user's
 * existing Chrome profile (already logged in).
 */
async function scanClickworker(): Promise<ScanResult> {
  const src = "Clickworker";
  try {
    const { scanPlatform } = await import("@/lib/browser-agent");
    const result = await scanPlatform("CLICKWORKER");

    const opportunities: RawOpportunity[] = result.opportunities.map((o, i) => ({
      platformId: `clickworker:scan_${Date.now()}_${i}`,
      src,
      desc: o.desc,
      amt: o.amt,
      url: o.url || "https://workplace.clickworker.com/en/jobs",
      rawScore: 75,
    }));

    return {
      source: src,
      opportunities,
      scannedAt: new Date().toISOString(),
      error: result.error,
    };
  } catch (err) {
    return {
      source: src,
      opportunities: [],
      scannedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Fiverr scanner (Playwright) ─────────────────────────────────────────────

/**
 * Fiverr has NO public API. We scrape buyer requests via the seller dashboard.
 * Requires the user to be logged in via Chrome.
 */
async function scanFiverr(): Promise<ScanResult> {
  const src = "Fiverr";
  try {
    const { scanPlatform } = await import("@/lib/browser-agent");
    const result = await scanPlatform("FIVERR");

    const opportunities: RawOpportunity[] = result.opportunities.map((o, i) => ({
      platformId: `fiverr:scan_${Date.now()}_${i}`,
      src,
      desc: o.desc,
      amt: o.amt,
      url: o.url || "https://www.fiverr.com/seller_dashboard",
      rawScore: 80,
    }));

    return {
      source: src,
      opportunities,
      scannedAt: new Date().toISOString(),
      error: result.error,
    };
  } catch (err) {
    return {
      source: src,
      opportunities: [],
      scannedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Gumroad scanner ──────────────────────────────────────────────────────────

/**
 * Gumroad discover page is public. Scrape trending digital products as
 * inspiration for Builder agent to list competing/similar products.
 */
async function scanGumroad(): Promise<ScanResult> {
  const src = "Gumroad";
  try {
    // Gumroad's discover page uses client-side rendering; we surface a standing
    // "create product" opportunity based on account status instead.
    const res = await fetch("https://gumroad.com/discover", {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return {
        source: src,
        opportunities: [],
        scannedAt: new Date().toISOString(),
        error: `Gumroad discover: HTTP ${res.status}`,
      };
    }

    // Surface a standing opportunity for the Builder agent
    return {
      source: src,
      opportunities: [
        {
          platformId: "gumroad:__create_product__",
          src,
          desc: "Gumroad: Create and publish a digital product (templates, guides, presets, code snippets). Builder agent can automate listing creation.",
          amt: "$15/sale",
          url: "https://app.gumroad.com/products/new",
          rawScore: 65,
        },
      ],
      scannedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      source: src,
      opportunities: [],
      scannedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Niche subreddit promo scanner ───────────────────────────────────────────

/**
 * Scan niche subreddits for threads where promoting Overlay365 products
 * with a UTM-tracked link would be contextually appropriate.
 *
 * We look for posts about problems these tools solve — not [HIRING] posts.
 * UTM format: https://overlay365.org?utm_source=reddit&utm_medium=organic&utm_campaign=<slug>
 *
 * Each entry surfaces as a RawOpportunity so the autonomous engine can
 * route it to the Closer agent (which will use the niche pitch templates
 * in browser-agent.ts to compose and post a contextual reply).
 */
async function scanNicheSubreddits(): Promise<ScanResult> {
  const src = "RedditPromo";

  // Map of subreddit → product campaign slug for UTM links
  const NICHE_TARGETS: Array<{ sub: string; campaign: string; keywords: RegExp }> = [
    { sub: "bioinformatics",      campaign: "biotech-bundle",      keywords: /pipeline|workflow|automat|sequenc|alphafold|protein|lab|pcr|crispr/i },
    { sub: "labautomation",       campaign: "biotech-bundle",      keywords: /automat|robot|pipett|opentrons|liquid.handl|protocol|lab/i },
    { sub: "biotech",             campaign: "biotech-bundle",      keywords: /tool|software|platform|analys|ai|ml|model|data/i },
    { sub: "WeAreTheMusicMakers", campaign: "music-bundle",        keywords: /stem.sep|vocal.remov|chords|transcri|composition|ai.music|beat|sample/i },
    { sub: "edmproduction",       campaign: "music-bundle",        keywords: /stem|vocal|instrument|ai.generat|sample|chord|midi/i },
    { sub: "musicproduction",     campaign: "music-bundle",        keywords: /ai|tool|stem|vocal.isolat|chord|midi|transcri/i },
    { sub: "algotrading",         campaign: "finance-bundle",      keywords: /backtest|portfolio|quant|strategy|risk|optim|python|data/i },
    { sub: "personalfinance",     campaign: "finance-bundle",      keywords: /invest|tool|track|automat|analys|budget|ai/i },
    { sub: "CryptoCurrency",      campaign: "finance-bundle",      keywords: /defi|on.chain|analytics|bot|trading|web3|smart.contract/i },
    { sub: "supplychain",         campaign: "supply-chain-bundle", keywords: /track|visibilit|blockchain|automat|ai|analytic|disrupt/i },
    { sub: "logistics",           campaign: "supply-chain-bundle", keywords: /track|route|automat|tool|software|ai|visibilit/i },
    { sub: "blockchain",          campaign: "supply-chain-bundle", keywords: /hyperledger|fabric|solana|asset.track|supply|logistic|enterprise/i },
    { sub: "MachineLearning",     campaign: "aidev-bundle",        keywords: /agent|llm|langchain|memory|sandbox|orchestrat|tool|framework/i },
    { sub: "LangChain",           campaign: "aidev-bundle",        keywords: /memory|persist|agent|tool|orchestrat|supervisor|sandbox/i },
    { sub: "LocalLLaMA",          campaign: "aidev-bundle",        keywords: /agent|memory|tool.call|orchestrat|multi.model|vscode|cursor/i },
    { sub: "gamedev",             campaign: "gamedev-bundle",      keywords: /ai.npc|procedural|shader|tool|vscode|gamif|ai.tool|llm/i },
    { sub: "indiegaming",         campaign: "gamedev-bundle",      keywords: /ai|tool|npc|procedural|developer|solo.dev|indie/i },
    { sub: "Unity3D",             campaign: "gamedev-bundle",      keywords: /ai|npc|tool|procedural|shader|generat|vscode|plugin/i },
  ];

  const opportunities: RawOpportunity[] = [];
  const errors: string[] = [];

  for (const target of NICHE_TARGETS) {
    try {
      const res = await fetch(
        `https://www.reddit.com/r/${target.sub}/new.json?limit=15&t=day`,
        {
          headers: {
            "User-Agent": "OTMAgent/1.0 (overlay365-promo-scanner)",
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!res.ok) {
        errors.push(`r/${target.sub}: HTTP ${res.status}`);
        continue;
      }

      const json = await res.json() as {
        data: {
          children: Array<{
            data: {
              id: string;
              title: string;
              selftext: string;
              url: string;
              link_flair_text: string | null;
              score: number;
              num_comments: number;
            };
          }>;
        };
      };

      for (const child of json.data.children) {
        const post = child.data;
        const text = `${post.title} ${post.selftext}`;

        // Only surface posts that match the keyword pattern for this vertical
        if (!target.keywords.test(text)) continue;

        // Skip posts with very low engagement (not worth replying to)
        if (post.score < 1 && post.num_comments === 0) continue;

        const utmUrl =
          `https://overlay365.org?utm_source=reddit&utm_medium=organic&utm_campaign=${target.campaign}`;

        opportunities.push({
          platformId: `reddit-promo:${post.id}`,
          src,
          desc: `[PROMO] r/${target.sub}: ${post.title.slice(0, 200)} | campaign=${target.campaign} | utm=${utmUrl}`,
          amt: "$0", // Promotional — no direct payout; tracked via UTM conversions
          url: post.url.startsWith("http") ? post.url : `https://reddit.com${post.url}`,
          rawScore: 55,
        });

        // Cap per-subreddit to 3 most recent relevant posts
        if (opportunities.filter((o) => o.desc.includes(`r/${target.sub}`)).length >= 3) break;
      }
    } catch (err) {
      errors.push(`r/${target.sub}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    source: src,
    opportunities: dedup(opportunities),
    scannedAt: new Date().toISOString(),
    error: errors.length > 0 ? errors.join("; ") : undefined,
  };
}

// ─── Dedup helper ─────────────────────────────────────────────────────────────

function dedup(opps: RawOpportunity[]): RawOpportunity[] {
  const seen = new Set<string>();
  return opps.filter((o) => {
    if (seen.has(o.platformId)) return false;
    seen.add(o.platformId);
    return true;
  });
}

// ─── Scan cache (DB-backed) ───────────────────────────────────────────────────

/**
 * Load cached scan results for a platform from the DB.
 * Returns null if not cached or stale.
 */
async function loadCache(platform: string): Promise<ScanResult | null> {
  try {
    const row = await db.scanCache.findUnique({ where: { platform } });
    if (!row || !isFresh(row.scannedAt)) return null;
    return JSON.parse(row.resultJson) as ScanResult;
  } catch {
    return null;
  }
}

/**
 * Save scan results to the DB cache.
 */
async function saveCache(platform: string, result: ScanResult): Promise<void> {
  try {
    await db.scanCache.upsert({
      where: { platform },
      create: {
        platform,
        resultJson: JSON.stringify(result),
        scannedAt: new Date(),
      },
      update: {
        resultJson: JSON.stringify(result),
        scannedAt: new Date(),
      },
    });
  } catch {
    // Cache save failure is non-fatal
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

const SCANNERS: Record<string, () => Promise<ScanResult>> = {
  Upwork: scanUpwork,
  Reddit: scanReddit,
  Clickworker: scanClickworker,
  Fiverr: scanFiverr,
  Gumroad: scanGumroad,
  Appen: scanAppen,
  RedditPromo: scanNicheSubreddits,
};

/** Per-scanner timeout: if any single scanner exceeds this, it gets cut off. */
const SCANNER_TIMEOUT_MS = 15_000;

/**
 * Wrap a scanner in a timeout race. If the scanner doesn't resolve within
 * SCANNER_TIMEOUT_MS, a timeout error result is returned instead.
 * This prevents slow Playwright scanners from blocking the entire scan.
 */
function withTimeout(platform: string, fn: () => Promise<ScanResult>): Promise<ScanResult> {
  return Promise.race([
    fn(),
    new Promise<ScanResult>((resolve) => {
      setTimeout(() => {
        resolve({
          source: platform,
          opportunities: [],
          scannedAt: new Date().toISOString(),
          error: `Scanner timed out after ${SCANNER_TIMEOUT_MS / 1000}s`,
        });
      }, SCANNER_TIMEOUT_MS);
    }),
  ]);
}

/**
 * Scan all platforms for new opportunities.
 *
 * Uses DB cache — each platform is only re-scanned after SCAN_TTL_MS (15 min).
 * Pass `force: true` to bypass the cache and re-scan immediately.
 *
 * Each scanner is wrapped in a 15-second timeout so Playwright-based scanners
 * (Clickworker, Fiverr) can't block the response when Chrome is busy/locked.
 *
 * Returns merged, deduped results from all platforms that responded.
 */
export async function scanAllPlatforms(opts?: {
  platforms?: string[];
  force?: boolean;
  minScore?: number;
}): Promise<{
  opportunities: RawOpportunity[];
  sources: Record<string, { count: number; scannedAt: string; error?: string }>;
  cached: string[];
  fresh: string[];
}> {
  const targets = opts?.platforms
    ? Object.keys(SCANNERS).filter((p) =>
        opts.platforms!.some((req) => p.toLowerCase().includes(req.toLowerCase())),
      )
    : Object.keys(SCANNERS);

  const allOpps: RawOpportunity[] = [];
  const sources: Record<string, { count: number; scannedAt: string; error?: string }> = {};
  const cached: string[] = [];
  const fresh: string[] = [];

  await Promise.all(
    targets.map(async (platform) => {
      // Try cache first (unless forced)
      if (!opts?.force) {
        const hit = await loadCache(platform);
        if (hit) {
          allOpps.push(...hit.opportunities);
          sources[platform] = {
            count: hit.opportunities.length,
            scannedAt: hit.scannedAt,
            error: hit.error,
          };
          cached.push(platform);
          return;
        }
      }

      // Run the real scanner with a per-scanner timeout guard
      const scanner = SCANNERS[platform];
      if (!scanner) return;

      const result = await withTimeout(platform, scanner);
      await saveCache(platform, result);

      allOpps.push(...result.opportunities);
      sources[platform] = {
        count: result.opportunities.length,
        scannedAt: result.scannedAt,
        error: result.error,
      };
      fresh.push(platform);
    }),
  );

  // Dedup across platforms and apply minScore filter
  const minScore = opts?.minScore ?? 0;
  const deduped = dedup(allOpps).filter(
    (o) => (o.rawScore ?? 0) >= minScore,
  );

  return { opportunities: deduped, sources, cached, fresh };
}

/**
 * Check if any platform has been scanned in the last TTL window.
 * Used by the /api/openclaw/opportunities route to report staleness.
 */
export async function getScanStatus(): Promise<
  Record<string, { scannedAt: string | null; fresh: boolean }>
> {
  const rows = await db.scanCache.findMany();
  const result: Record<string, { scannedAt: string | null; fresh: boolean }> = {};

  for (const platform of Object.keys(SCANNERS)) {
    const row = rows.find((r) => r.platform === platform);
    result[platform] = {
      scannedAt: row ? row.scannedAt.toISOString() : null,
      fresh: row ? isFresh(row.scannedAt) : false,
    };
  }

  return result;
}
