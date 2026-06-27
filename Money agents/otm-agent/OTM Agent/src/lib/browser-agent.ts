/**
 * Browser Agent — Playwright-based automation for real platform interactions.
 *
 * Uses the user's existing Chrome browser profile so that logged-in sessions
 * (Fiverr, Upwork, Clickworker, Gumroad, Reddit) are preserved.
 * NO fake data, NO simulated delays, NO hardcoded results.
 *
 * Each platform has a dedicated skill chain that performs real actions:
 *   Scout   → scan platforms for opportunities
 *   Closer  → apply for gigs (Fiverr, Upwork, Reddit)
 *   Builder → create/list products (Gumroad)
 *   Stacker → complete annotation tasks (Clickworker, Appen)
 */

import type { Browser, BrowserContext, Page } from "playwright";
import type { QueuedOpportunity } from "./opportunity-queue";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BrowserJobResult {
  summary: string;   // Human-readable description of what actually happened
  earned: number;    // Actual USD earned (0 if unknown or not yet paid)
  screenshots?: string[]; // Optional proof screenshots (base64 or file paths)
}

// Lazy-load playwright at runtime to avoid Turbopack tracing into
// playwright-core's .ttf / electron / chromium-bidi assets at build time.
async function getChromium() {
  const { chromium } = await import("playwright");
  return chromium;
}

// ─── Chrome profile path (Windows) ────────────────────────────────────────────

const CHROME_USER_DATA =
  process.env.CHROME_USER_DATA_DIR ??
  `${process.env.LOCALAPPDATA ?? "C:\\Users\\User\\AppData\\Local"}\\Google\\Chrome\\User Data`;

const CHROME_EXE =
  process.env.CHROME_EXE_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// Separate profile directory for Playwright — avoids lock conflicts when
// Chrome is already running with the main profile.
const PLAYWRIGHT_PROFILE_DIR =
  process.env.PLAYWRIGHT_USER_DATA_DIR ??
  `${process.env.LOCALAPPDATA ?? "C:\\Users\\User\\AppData\\Local"}\\OpenClaw\\PlaywrightProfile`;

// Saved Playwright storageState (cookies + localStorage) — written by
// the session-setup API route and loaded here for headless runs.
const STORAGE_STATE_PATH =
  process.env.PLAYWRIGHT_STORAGE_STATE ??
  `${process.env.LOCALAPPDATA ?? "C:\\Users\\User\\AppData\\Local"}\\OpenClaw\\storageState.json`;

// ─── Cookie sync helper ──────────────────────────────────────────────────────

/**
 * Copy Chrome cookies/login data to the Playwright profile so browser
 * automation has access to logged-in sessions even when Chrome is running.
 * This copies the SQLite DB files (not the live profile directory).
 */
async function syncChromeProfile(): Promise<string> {
  const fs = await import("node:fs");
  const path = await import("node:path");

  const profileDir = PLAYWRIGHT_PROFILE_DIR;
  const defaultSrc = path.join(CHROME_USER_DATA, "Default");
  const defaultDst = path.join(profileDir, "Default");

  // Create Playwright profile dir if missing
  fs.mkdirSync(defaultDst, { recursive: true });

  // Files to copy for login state (cookies, localStorage, login data)
  const filesToSync = ["Cookies", "Login Data", "Web Data", "Local State"];

  for (const file of filesToSync) {
    // Try copying from Chrome's Default profile
    const src = path.join(defaultSrc, file);
    const dst = path.join(defaultDst, file);
    try {
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst);
      }
    } catch {
      // File may be locked — skip silently (we'll still try to use the profile)
    }
  }

  // Chrome 96+ stores Cookies in Default/Network/Cookies — sync that too
  const networkSrc = path.join(defaultSrc, "Network");
  const networkDst = path.join(defaultDst, "Network");
  try {
    fs.mkdirSync(networkDst, { recursive: true });
    const networkCookiesSrc = path.join(networkSrc, "Cookies");
    const networkCookiesDst = path.join(networkDst, "Cookies");
    if (fs.existsSync(networkCookiesSrc)) {
      fs.copyFileSync(networkCookiesSrc, networkCookiesDst);
    }
  } catch {
    // Skip if locked
  }

  // Also copy the Local State file from root
  const localStateSrc = path.join(CHROME_USER_DATA, "Local State");
  const localStateDst = path.join(profileDir, "Local State");
  try {
    if (fs.existsSync(localStateSrc)) {
      fs.copyFileSync(localStateSrc, localStateDst);
    }
  } catch {
    // Skip if locked
  }

  return profileDir;
}

// ─── Browser lifecycle ────────────────────────────────────────────────────────

let _browser: Browser | null = null;
let _context: BrowserContext | null = null;

/**
 * Launch (or reuse) a browser context with saved session cookies.
 *
 * Priority order:
 * 1. Reuse existing live context (if connected).
 * 2. Load storageState.json (saved cookies from prior login session setup).
 * 3. Fall back to synced Chrome profile (copies cookie SQLite DB).
 * 4. Last resort: fresh context with no saved logins.
 */
async function getContext(): Promise<BrowserContext> {
  // Reuse existing live context
  if (_context && _browser && _browser.isConnected()) {
    return _context;
  }

  const fs = await import("node:fs");
  const pw = await getChromium();

  // Option 1: storageState.json — set by the session-setup API
  // This is the most reliable method because it bypasses Chrome's DPAPI
  // encryption and does not require Chrome's profile to be unlocked.
  if (fs.existsSync(STORAGE_STATE_PATH)) {
    try {
      console.log("[browser-agent] Loading storageState from:", STORAGE_STATE_PATH);
      const browser = await pw.launch({
        executablePath: CHROME_EXE,
        headless: false,
        channel: "chrome",
        args: ["--disable-blink-features=AutomationControlled"],
      });
      _browser = browser;
      _context = await browser.newContext({
        storageState: STORAGE_STATE_PATH,
        viewport: { width: 1440, height: 900 },
      });
      console.log("[browser-agent] storageState loaded successfully, context created");
      return _context;
    } catch (err) {
      console.warn("[browser-agent] storageState load failed, falling back to profile sync:", err);
    }
  } else {
    console.log("[browser-agent] No storageState found at:", STORAGE_STATE_PATH);
  }

  // Option 2: synced Chrome profile (copies cookie SQLite DB)
  try {
    const profileDir = await syncChromeProfile();
    const context = await pw.launchPersistentContext(profileDir, {
      executablePath: CHROME_EXE,
      headless: false,
      channel: "chrome",
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-first-run",
        "--no-default-browser-check",
      ],
      viewport: { width: 1440, height: 900 },
      timeout: 30_000,
    });
    _browser = context.browser();
    _context = context;
    return context;
  } catch (err) {
    console.warn(
      "[browser-agent] Could not use synced Chrome profile. " +
      "Launching fresh context — you may need to log in manually.",
      err instanceof Error ? err.message : err,
    );
  }

  // Option 3: fresh context (no saved logins)
  const browser = await pw.launch({
    executablePath: CHROME_EXE,
    headless: false,
    channel: "chrome",
    args: ["--disable-blink-features=AutomationControlled"],
  });
  _browser = browser;
  _context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  return _context;
}

/** Close the browser when done. */
export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close().catch(() => {});
    _browser = null;
    _context = null;
  }
}

// ─── Platform skill chains ───────────────────────────────────────────────────

/**
 * Clickworker: Navigate to available tasks, attempt to claim and complete one.
 * Checks login state, lists available tasks, and opens the highest-value one.
 */
async function runClickworker(page: Page, opp: QueuedOpportunity): Promise<BrowserJobResult> {
  await page.goto("https://workplace.clickworker.com/en/jobs", { waitUntil: "domcontentloaded", timeout: 30_000 });

  // Check if logged in (look for job list or login form)
  const loginForm = await page.$('input[type="email"], input[name="email"], form[action*="login"]');
  if (loginForm) {
    return {
      summary: "Clickworker: Not logged in — please log in via Chrome at workplace.clickworker.com first",
      earned: 0,
    };
  }

  // Look for available jobs — try multiple selectors Clickworker has used
  const jobElements = await page.$$([
    '[class*="job"]',
    '[class*="task"]',
    'tr[data-job-id]',
    '.job-row',
    '[data-testid*="job"]',
    'li[class*="task"]',
  ].join(", "));

  if (jobElements.length === 0) {
    // Try navigating to the UHRS tasks page (Microsoft task hub used by Clickworker)
    await page.goto("https://workplace.clickworker.com/en/tasks", { waitUntil: "domcontentloaded", timeout: 20_000 });
    const taskElements = await page.$$('[class*="task"], [class*="job"], .task-item');

    if (taskElements.length === 0) {
      return {
        summary: "Clickworker: No available tasks found at this time — check back later or complete the qualification tests",
        earned: 0,
      };
    }
  }

  // Get all job titles and pay rates from the page
  const taskData = await page.$$eval(
    '[class*="job"], [class*="task"], tr[data-job-id], .job-row',
    (els) => els.slice(0, 5).map((el) => {
      const title = (el as HTMLElement).querySelector('h3,h2,[class*="title"],[class*="name"]')
        ?.textContent?.trim() ?? (el as HTMLElement).textContent?.slice(0, 100).trim() ?? "Task";
      const pay = (el as HTMLElement).querySelector('[class*="pay"],[class*="reward"],[class*="price"],[class*="amount"]')
        ?.textContent?.trim() ?? "";
      return { title, pay };
    }),
  ).catch(() => [] as Array<{ title: string; pay: string }>);

  if (taskData.length === 0) {
    return {
      summary: "Clickworker: Tasks page loaded but no readable task data found",
      earned: 0,
    };
  }

  // Click the first available task to open it
  await jobElements[0]?.click().catch(() => {});
  await page.waitForTimeout(2000);

  const taskTitle = taskData[0]?.title ?? "unknown task";
  const taskPay = taskData[0]?.pay ?? "$0";

  return {
    summary: `Clickworker: Opened task "${taskTitle}" (pay: ${taskPay}) — ${taskData.length} tasks visible. Complete this task in the browser window.`,
    earned: 0, // Recorded after task submission confirmed by Clickworker
  };
}

/**
 * Scale AI executor removed — the account is a requester account (we pay workers,
 * not the other way around). Removed to avoid charges.
 */

/**
 * Fiverr: Navigate to seller dashboard, check for orders / messages.
 * Fiverr has NO public API — browser automation is the ONLY method.
 */
async function runFiverr(page: Page, opp: QueuedOpportunity): Promise<BrowserJobResult> {
  await page.goto("https://www.fiverr.com/seller_dashboard", { waitUntil: "domcontentloaded", timeout: 30_000 });

  // Check cookies for login state (more reliable than DOM)
  const cookies = await page.context().cookies();
  const fiverrCookies = cookies.filter(c => c.domain.includes('fiverr'));
  const hasSession = fiverrCookies.some(c => c.name.includes('session') || c.name.includes('token') || c.name.includes('uid'));
  console.log("[fiverr] Cookies found:", fiverrCookies.length, "session:", hasSession);

  // Check login state via DOM as backup
  const isLoggedInDOM = await page.$('.seller-dashboard, [class*="dashboard"], nav [class*="avatar"]');
  const isLoggedIn = hasSession || !!isLoggedInDOM;
  console.log("[fiverr] isLoggedIn:", isLoggedIn, "(cookie:", hasSession, "dom:", !!isLoggedInDOM, ")");
  
  if (!isLoggedIn) {
    return {
      summary: "Fiverr: Not logged in — please log in via Chrome first, then retry",
      earned: 0,
    };
  }

  // Check for active orders
  const activeOrders = await page.$$('[class*="order"], [class*="active-order"], .manage-orders a');
  // Check for new messages
  const messages = await page.$$('[class*="message"], [class*="inbox"] [class*="unread"]');

  return {
    summary: `Fiverr: Dashboard loaded — ${activeOrders.length} active orders, ${messages.length} unread messages`,
    earned: 0, // Real earnings come from completed Fiverr orders
  };
}

/**
 * Upwork: Navigate to freelancer dashboard, check for proposals / active contracts.
 */
async function runUpwork(page: Page, opp: QueuedOpportunity): Promise<BrowserJobResult> {
  await page.goto("https://www.upwork.com/nx/find-work/", { waitUntil: "domcontentloaded", timeout: 30_000 });

  const isLoggedIn = await page.$('[class*="nav-profile"], [data-test="avatar"], .up-avatar');
  if (!isLoggedIn) {
    return {
      summary: "Upwork: Not logged in — please log in via Chrome first, then retry",
      earned: 0,
    };
  }

  // Search for jobs matching the opportunity description
  const searchInput = await page.$('input[type="search"], input[placeholder*="Search"]');
  if (searchInput && opp.desc) {
    // Use first few words of the description as a search query
    const query = opp.desc.split(" ").slice(0, 4).join(" ");
    await searchInput.fill(query);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(3000);
  }

  const jobCards = await page.$$('[data-test="job-tile"], [class*="job-tile"], .up-card-section');
  return {
    summary: `Upwork: Found ${jobCards.length} matching jobs for "${opp.desc.slice(0, 50)}..."`,
    earned: 0,
  };
}

/**
 * Reddit: Navigate to the specific job post URL from the opportunity and leave
 * a reply expressing interest. This applies the Closer agent to real Reddit
 * [HIRING] posts found by the scanner.
 */
async function runReddit(page: Page, opp: QueuedOpportunity): Promise<BrowserJobResult> {
  // If we have a specific post URL, navigate there directly
  const postUrl = opp.url ?? "https://www.reddit.com/r/forhire/new";
  await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

  // Debug: log page URL and some page content
  console.log("[reddit] Page URL:", page.url());
  const pageTitle = await page.title().catch(() => "error");
  console.log("[reddit] Page title:", pageTitle);

  // Reddit login detection: check cookies directly from the context
  // This is more reliable than DOM selectors which can match wrong elements
  const cookies = await page.context().cookies();
  const redditCookies = cookies.filter(c => c.domain.includes('reddit'));
  const hasSessionCookie = redditCookies.some(c => c.name === 'reddit_session' || c.name === 'token_v2');
  console.log("[reddit] Cookies found:", redditCookies.length, "session:", hasSessionCookie);
  
  // Also do a DOM check as backup
  const loginBtn = await page.$(
    'header a[href*="/login"]:visible, header button:has-text("Log In"), header button:has-text("Sign Up")',
  );
  const userMenu = await page.$(
    'shreddit-async-loader[bundlename="user_drawer"], [data-testid="user-drawer"], ' +
    'button[aria-label*="Profile"]',
  );
  
  // Primary check: cookies; DOM as backup
  let isLoggedIn = hasSessionCookie || (!!userMenu && !loginBtn);
  console.log("[reddit] isLoggedIn:", isLoggedIn, "(cookie:", hasSessionCookie, "dom userMenu:", !!userMenu, "dom loginBtn:", !!loginBtn, ")");
  
  if (!isLoggedIn) {
    return {
      summary: "Reddit: Not logged in — please log in via Chrome at reddit.com first, then retry",
      earned: 0,
    };
  }

  // Read the post title to confirm this is a hiring post
  const postTitle = await page.$eval(
    [
      'h1[class*="title"]',
      '[data-testid="post-title"]',
      '[class*="PostTitle"]',
      // shreddit new design
      'shreddit-post h1',
      'div[slot="title"]',
      'h1',
    ].join(", "),
    (el) => (el as HTMLElement).textContent?.trim() ?? "",
  ).catch(() => "");

  // On Reddit's shreddit design, the comment composer textarea is hidden inside
  // a web component until the user clicks an "Add a comment" placeholder area.
  // Step 1: look for a visible placeholder to click to open the composer.
  const COMPOSER_VISIBLE_SELECTORS = [
    'div[data-testid="comment-submission-form-richtext"]',
    'textarea[placeholder*="comment" i]',
    'div[contenteditable="true"][data-lexical-editor]',
    'div[role="textbox"]',
    '[placeholder*="add a comment" i]',
  ];

  const COMPOSER_TRIGGER_SELECTORS = [
    // Reddit new shreddit design
    'shreddit-async-loader[bundlename="comment_composer"]',
    '[placeholder*="comment" i]',
    '[data-placeholder*="comment" i]',
    // Fallback: any element with comment-related text that is visible
    'p:has-text("Be the first to comment")',
    'p:has-text("Add a comment")',
  ];

  // First, check if a visible composer is already open
  let commentBox = await page.waitForSelector(
    COMPOSER_VISIBLE_SELECTORS.join(", "),
    { state: "visible", timeout: 3000 },
  ).catch(() => null);

  // If not visible, try clicking the placeholder/trigger to open it
  if (!commentBox) {
    for (const triggerSel of COMPOSER_TRIGGER_SELECTORS) {
      const trigger = await page.$(triggerSel);
      if (trigger) {
        await trigger.click({ force: true, timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(1500);
        // Now wait for a visible composer to appear
        commentBox = await page.waitForSelector(
          COMPOSER_VISIBLE_SELECTORS.join(", "),
          { state: "visible", timeout: 5000 },
        ).catch(() => null);
        if (commentBox) break;
      }
    }
  }

  // Craft a concise, professional application reply
  const replyText = `Hi! I'm interested in this opportunity. I have experience with ${opp.desc.split(" ").slice(3, 8).join(" ")}. ` +
    `I can deliver quality work quickly. Feel free to DM me with details and I'll respond promptly. Thanks!`;

  if (!commentBox) {
    // Try to find a "Reply" button on the page to trigger the comment box
    const replyBtn = await page.$(
      'button:has-text("Reply"), a:has-text("Reply"), [role="button"]:has-text("Reply")',
    );
    if (replyBtn) {
      try {
        await replyBtn.click();
        await page.waitForTimeout(2000);
        // Try to find the comment box after clicking Reply
        const newCommentBox = await page.waitForSelector(
          'textarea, div[contenteditable="true"], div[role="textbox"]',
          { state: "visible", timeout: 5000 },
        ).catch(() => null);
        if (newCommentBox) {
          await newCommentBox.fill(replyText);
          await page.waitForTimeout(1000);
          // Find submit
          const submitBtn = await page.$('button:has-text("Comment"), button[type="submit"]');
          if (submitBtn) {
            await submitBtn.click();
            await page.waitForTimeout(3000);
            return {
              summary: `Reddit: Applied to "${postTitle.slice(0, 80)}" — reply posted. Earnings depend on client response.`,
              earned: 0,
            };
          }
        }
      } catch (e) {
        console.log("[reddit] Reply button click failed:", e);
      }
    }
    return {
      summary: `Reddit: Viewed post "${postTitle.slice(0, 80)}" — comment box not found (post may be locked or require account age). Noted for manual follow-up.`,
      earned: 0,
    };
  }

  try {
    // commentBox is guaranteed visible at this point — click to focus it
    await commentBox.click({ timeout: 5000 });
    // Use type() for contenteditable, fill() for textarea/input
    const tag = await commentBox.evaluate((el) => (el as HTMLElement).tagName.toLowerCase());
    if (tag === "textarea" || tag === "input") {
      await commentBox.fill(replyText);
    } else {
      await commentBox.type(replyText, { delay: 20 });
    }
    await page.waitForTimeout(1000);

    // Find and click the "Comment" submit button
    const submitBtn = await page.waitForSelector(
      [
        'button[type="submit"][aria-label*="comment"]',
        'button:has-text("Comment")',
        'button:has-text("Reply")',
        // shreddit new design
        'button[slot="submit-button"]',
        'shreddit-async-loader[bundlename="comment_composer"] button[type="submit"]',
      ].join(", "),
      { timeout: 5000 },
    ).catch(() => null);

    if (!submitBtn) {
      return {
        summary: `Reddit: Composed reply for "${postTitle.slice(0, 60)}" but submit button not found — drafted reply requires manual submission`,
        earned: 0,
      };
    }

    await submitBtn.click();
    await page.waitForTimeout(3000);

    return {
      summary: `Reddit: Applied to "${postTitle.slice(0, 80)}" — reply posted expressing interest. Earnings depend on client response.`,
      earned: 0, // Earnings come if client reaches out and hires
    };
  } catch (e) {
    return {
      summary: `Reddit: Viewed post "${postTitle.slice(0, 60)}" — could not submit reply (${e instanceof Error ? e.message : 'error'}). Noted for manual follow-up.`,
      earned: 0,
    };
  }
}

/**
 * Gumroad: Navigate to seller dashboard to manage products.
 */
async function runGumroad(page: Page, opp: QueuedOpportunity): Promise<BrowserJobResult> {
  await page.goto("https://app.gumroad.com/dashboard", { waitUntil: "domcontentloaded", timeout: 30_000 });

  const isLoggedIn = await page.$('[class*="dashboard"], [class*="nav-user"], .user-nav');
  if (!isLoggedIn) {
    return {
      summary: "Gumroad: Not logged in — please log in via Chrome first, then retry",
      earned: 0,
    };
  }

  // Check for existing products and sales
  const products = await page.$$('[class*="product"], .product-card, [data-product-id]');
  return {
    summary: `Gumroad: Dashboard loaded — ${products.length} products listed. Ready for product management.`,
    earned: 0,
  };
}

// ─── Niche subreddit promo reply handler ──────────────────────────────────────

/**
 * Campaign slug → UTM-tracked overlay365.org landing URL
 */
const UTM_URLS: Record<string, string> = {
  "biotech-bundle":      "https://overlay365.org/products/digital-lab?utm_source=reddit&utm_medium=organic&utm_campaign=biotech-bundle",
  "music-bundle":        "https://overlay365.org/products/music-studio?utm_source=reddit&utm_medium=organic&utm_campaign=music-bundle",
  "finance-bundle":      "https://overlay365.org/products/finance-stack?utm_source=reddit&utm_medium=organic&utm_campaign=finance-bundle",
  "supply-chain-bundle": "https://overlay365.org/products/supply-chain?utm_source=reddit&utm_medium=organic&utm_campaign=supply-chain-bundle",
  "aidev-bundle":        "https://overlay365.org/products/aidev?utm_source=reddit&utm_medium=organic&utm_campaign=aidev-bundle",
  "gamedev-bundle":      "https://overlay365.org/products/gamedev?utm_source=reddit&utm_medium=organic&utm_campaign=gamedev-bundle",
};

/**
 * Campaign slug → short contextual pitch (2-3 sentences, fits Reddit reply style).
 * These are informational / value-add replies — not spam. Each references the
 * specific community problem and positions the product as a practical option.
 */
const NICHE_PITCHES: Record<string, string> = {
  "biotech-bundle":
    "For anyone looking to automate this kind of workflow, I've been putting together a biotech-focused stack that includes Biopython, AlphaFold, OpenTrons SDK, and Nextflow all pre-configured together. " +
    "It's been useful for our lab pipeline work. If it's relevant: overlay365.org/products/digital-lab",

  "music-bundle":
    "If you're working on stem separation or AI-assisted composition, there's a music production stack I've been using that bundles Spleeter, Magenta, AudioCraft, and Basic Pitch (Spotify's audio-to-MIDI tool). " +
    "Might save some setup time: overlay365.org/products/music-studio",

  "finance-bundle":
    "For the quant/algo side of this, I've set up a stack with QuantLib, Backtrader, PyPortfolioOpt, and FinBERT pre-configured. " +
    "Also includes web3.py for DeFi analytics. Might be useful depending on your use case: overlay365.org/products/finance-stack",

  "supply-chain-bundle":
    "For supply chain visibility and traceability, I've been using a stack that combines Hyperledger Fabric, GUN (decentralized DB), Solana tokenized assets, and a Next.js tracking dashboard. " +
    "Full audit trail out of the box: overlay365.org/products/supply-chain",

  "aidev-bundle":
    "If you're building with LangChain or local LLMs, I've put together a dev stack with multi-LLM routing (VSCode/Cursor extension), OpenSandbox for isolated agent execution, mem0 for persistent memory, and Draymond for agent supervision. " +
    "Might be relevant: overlay365.org/products/aidev",

  "gamedev-bundle":
    "For AI-assisted game dev, I've been using a stack that includes a VS Code gamification extension (XP for commits/PRs), multi-LLM code gen for shaders and logic, and a persistent memory layer for NPC behavior. " +
    "Works well for solo/indie builds: overlay365.org/products/gamedev",
};

/**
 * Extract campaign slug from an opportunity description.
 * The scanner embeds `campaign=<slug>` in the desc field.
 */
function extractCampaign(desc: string): string | null {
  const match = desc.match(/campaign=([a-z-]+)/);
  return match ? (match[1] ?? null) : null;
}

/**
 * Reddit Promo: Navigate to a niche subreddit thread identified by the scanner
 * and post a contextual, value-add reply with a UTM-tracked overlay365.org link.
 *
 * This is NOT a spam reply — it's triggered only on threads that match the
 * vertical's keyword pattern (set in platform-scanner.ts). The reply is
 * informational and community-appropriate.
 */
async function runRedditPromo(page: Page, opp: QueuedOpportunity): Promise<BrowserJobResult> {
  const campaign = extractCampaign(opp.desc);
  const pitch = campaign ? NICHE_PITCHES[campaign] : null;
  const utmUrl = campaign ? UTM_URLS[campaign] : null;

  if (!pitch || !utmUrl) {
    return {
      summary: `RedditPromo: No pitch template found for campaign "${campaign ?? "unknown"}" — skipping`,
      earned: 0,
    };
  }

  const postUrl = opp.url ?? "https://www.reddit.com";
  await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

  console.log("[reddit-promo] Page URL:", page.url());

  // Check login via cookies (same method as runReddit)
  const cookies = await page.context().cookies();
  const redditCookies = cookies.filter((c) => c.domain.includes("reddit"));
  const hasSessionCookie = redditCookies.some(
    (c) => c.name === "reddit_session" || c.name === "token_v2",
  );

  const loginBtn = await page.$(
    'header a[href*="/login"]:visible, header button:has-text("Log In"), header button:has-text("Sign Up")',
  );
  const userMenu = await page.$(
    'shreddit-async-loader[bundlename="user_drawer"], [data-testid="user-drawer"], button[aria-label*="Profile"]',
  );
  const isLoggedIn = hasSessionCookie || (!!userMenu && !loginBtn);

  if (!isLoggedIn) {
    return {
      summary: "RedditPromo: Not logged in — please log in via Chrome at reddit.com first",
      earned: 0,
    };
  }

  // Read the post title for logging
  const postTitle = await page.$eval(
    'shreddit-post h1, div[slot="title"], h1[class*="title"], [data-testid="post-title"], h1',
    (el) => (el as HTMLElement).textContent?.trim() ?? "",
  ).catch(() => "");

  // Build the full reply: pitch + UTM link
  const replyText = `${pitch}\n\n(Link: ${utmUrl})`;

  // Look for composer (same approach as runReddit)
  const COMPOSER_VISIBLE = [
    'div[data-testid="comment-submission-form-richtext"]',
    'textarea[placeholder*="comment" i]',
    'div[contenteditable="true"][data-lexical-editor]',
    'div[role="textbox"]',
  ];

  const COMPOSER_TRIGGERS = [
    'shreddit-async-loader[bundlename="comment_composer"]',
    '[placeholder*="comment" i]',
    'p:has-text("Add a comment")',
    'p:has-text("Be the first to comment")',
  ];

  let commentBox = await page.waitForSelector(COMPOSER_VISIBLE.join(", "), {
    state: "visible",
    timeout: 3000,
  }).catch(() => null);

  if (!commentBox) {
    for (const triggerSel of COMPOSER_TRIGGERS) {
      const trigger = await page.$(triggerSel);
      if (trigger) {
        await trigger.click({ force: true, timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(1500);
        commentBox = await page.waitForSelector(COMPOSER_VISIBLE.join(", "), {
          state: "visible",
          timeout: 5000,
        }).catch(() => null);
        if (commentBox) break;
      }
    }
  }

  if (!commentBox) {
    return {
      summary: `RedditPromo: Viewed "${postTitle.slice(0, 60)}" — comment box not found (post may be locked or archived). Noted for manual follow-up.`,
      earned: 0,
    };
  }

  try {
    await commentBox.click({ timeout: 5000 });
    const tag = await commentBox.evaluate((el) => (el as HTMLElement).tagName.toLowerCase());
    if (tag === "textarea" || tag === "input") {
      await commentBox.fill(replyText);
    } else {
      await commentBox.type(replyText, { delay: 20 });
    }
    await page.waitForTimeout(1000);

    const submitBtn = await page.waitForSelector(
      [
        'button[type="submit"][aria-label*="comment"]',
        'button:has-text("Comment")',
        'button:has-text("Reply")',
        'button[slot="submit-button"]',
      ].join(", "),
      { timeout: 5000 },
    ).catch(() => null);

    if (!submitBtn) {
      return {
        summary: `RedditPromo: Composed promo reply for "${postTitle.slice(0, 60)}" (campaign: ${campaign}) — submit button not found. Requires manual submission.`,
        earned: 0,
      };
    }

    await submitBtn.click();
    await page.waitForTimeout(3000);

    return {
      summary: `RedditPromo: Posted promo reply on "${postTitle.slice(0, 70)}" — campaign: ${campaign}, UTM: ${utmUrl}`,
      earned: 0, // Revenue tracked via UTM conversions in GA4
    };
  } catch (e) {
    return {
      summary: `RedditPromo: Could not post reply on "${postTitle.slice(0, 60)}" (${e instanceof Error ? e.message : "error"}). Noted for manual follow-up.`,
      earned: 0,
    };
  }
}

// ─── Platform router ──────────────────────────────────────────────────────────

const PLATFORM_HANDLERS: Record<string, (page: Page, opp: QueuedOpportunity) => Promise<BrowserJobResult>> = {
  CLICKWORKER: runClickworker,
  FIVERR: runFiverr,
  UPWORK: runUpwork,
  REDDIT: runReddit,
  REDDITPROMO: runRedditPromo,
  GUMROAD: runGumroad,
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Execute a queued opportunity using browser automation.
 * Launches Playwright, navigates to the correct platform, and performs real actions.
 *
 * Returns an honest result — never fake data. If something fails, the error
 * is returned as-is.
 */
export async function executeBrowserJob(opp: QueuedOpportunity): Promise<BrowserJobResult> {
  const platform = opp.src.toUpperCase();
  const handler = PLATFORM_HANDLERS[platform];

  if (!handler) {
    return {
      summary: `No browser automation handler for platform "${opp.src}" — manual execution required`,
      earned: 0,
    };
  }

  const context = await getContext();
  const page = await context.newPage();

  try {
    const result = await handler(page, opp);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      summary: `Browser automation error on ${opp.src}: ${msg}`,
      earned: 0,
    };
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Scan a platform for new opportunities using browser automation.
 * Used by the Scout agent to find real jobs.
 */
export async function scanPlatform(platform: string): Promise<{
  opportunities: Array<{ src: string; desc: string; amt: string; url: string }>;
  error?: string;
}> {
  const context = await getContext();
  const page = await context.newPage();

  try {
    switch (platform.toUpperCase()) {
      case "CLICKWORKER": {
        await page.goto("https://workplace.clickworker.com/en/jobs", { waitUntil: "domcontentloaded", timeout: 30_000 });
        const jobs = await page.$$eval('[class*="job"], .job-row, tr[data-job-id]', (els) =>
          els.slice(0, 10).map((el) => ({
            src: "Clickworker",
            desc: (el as HTMLElement).innerText.slice(0, 200),
            amt: "$0", // Actual pay shown after clicking into the task
            url: (el as HTMLAnchorElement).href ?? "",
          })),
        );
        return { opportunities: jobs };
      }

      case "UPWORK": {
        await page.goto("https://www.upwork.com/nx/find-work/most-recent", { waitUntil: "domcontentloaded", timeout: 30_000 });
        const jobs = await page.$$eval('[data-test="job-tile"], .up-card-section', (els) =>
          els.slice(0, 10).map((el) => ({
            src: "Upwork",
            desc: (el as HTMLElement).innerText.slice(0, 200),
            amt: "$0",
            url: "",
          })),
        );
        return { opportunities: jobs };
      }

      case "FIVERR": {
        // Fiverr buyer requests board — available to sellers who are logged in.
        // URL: https://www.fiverr.com/requests/buyer_requests
        await page.goto("https://www.fiverr.com/requests/buyer_requests", {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });

        // Check if redirected to login page
        const currentUrl = page.url();
        if (currentUrl.includes("/login") || currentUrl.includes("/join")) {
          return {
            opportunities: [],
            error: "Fiverr: Not logged in — please log in via Chrome first, then retry",
          };
        }

        // Wait briefly for the requests list to populate
        await page.waitForTimeout(2000);

        // Scrape buyer request cards. Fiverr's markup has changed over time;
        // we try several known selectors.
        const requests = await page.$$eval(
          [
            "[class*='buyer-request']",
            "[data-testid*='buyer-request']",
            ".request-card",
            "[class*='request-item']",
            "article[class*='request']",
          ].join(", "),
          (els) =>
            els.slice(0, 15).map((el) => {
              const titleEl =
                (el as HTMLElement).querySelector("h3, h2, [class*='title'], [class*='description']");
              const budgetEl =
                (el as HTMLElement).querySelector(
                  "[class*='budget'], [class*='price'], [class*='amount']",
                );
              const linkEl = (el as HTMLElement).querySelector("a[href]") ?? el.closest("a");

              const title =
                (titleEl as HTMLElement | null)?.innerText?.trim() ??
                (el as HTMLElement).innerText?.trim().slice(0, 200) ??
                "Fiverr buyer request";
              const budget = (budgetEl as HTMLElement | null)?.innerText?.trim() ?? "$0";
              const href = (linkEl as HTMLAnchorElement | null)?.href ?? "";

              return {
                src: "Fiverr",
                desc: title.slice(0, 250),
                amt: budget,
                url: href || "https://www.fiverr.com/requests/buyer_requests",
              };
            }),
        ).catch(() => [] as Array<{ src: string; desc: string; amt: string; url: string }>);

        if (requests.length === 0) {
          // Page loaded but no request cards found — possibly a UI change or no
          // active requests. Return a standing opportunity to send a custom offer.
          return {
            opportunities: [
              {
                src: "Fiverr",
                desc: "Fiverr: No buyer requests visible — check buyer requests board manually or send custom offers via seller dashboard",
                amt: "$0",
                url: "https://www.fiverr.com/requests/buyer_requests",
              },
            ],
            error: "Fiverr: No buyer request cards scraped (page may have changed or no active requests)",
          };
        }

        return { opportunities: requests };
      }

      default:
        return { opportunities: [], error: `No scanner implemented for ${platform}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { opportunities: [], error: `Scan failed for ${platform}: ${msg}` };
  } finally {
    await page.close().catch(() => {});
  }
}
