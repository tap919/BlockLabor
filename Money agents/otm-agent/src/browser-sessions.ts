import { chromium } from "playwright-core";

interface SessionEntry {
  browser: Awaited<ReturnType<typeof chromium.connectOverCDP>>;
  lastUsed: number;
}

const sessions = new Map<string, SessionEntry>();
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleCleanup() {
  if (idleTimer) return;
  idleTimer = setTimeout(async () => {
    idleTimer = null;
    const now = Date.now();
    for (const [key, entry] of sessions) {
      if (now - entry.lastUsed > IDLE_TIMEOUT_MS) {
        try {
          await entry.browser.close();
        } catch {}
        sessions.delete(key);
      }
    }
  }, IDLE_TIMEOUT_MS + 10_000);
}

function getCometCdpUrl(): string {
  return "http://127.0.0.1:9222";
}

export async function getBrowserSession(platform: string): Promise<{
  cdpUrl: string;
  page: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.connectOverCDP>>["newPage"]>>;
}> {
  const existing = sessions.get(platform);
  if (existing) {
    existing.lastUsed = Date.now();
    const context = existing.browser.contexts()[0] ?? (await existing.browser.newContext());
    const page = await context.newPage();
    scheduleCleanup();
    return { cdpUrl: getCometCdpUrl(), page };
  }

  const cdpUrl = getCometCdpUrl();
  const browser = await chromium.connectOverCDP(cdpUrl, { timeout: 15_000 });
  const context = browser.contexts()[0] ?? (await browser.newContext());
  const page = await context.newPage();

  sessions.set(platform, { browser, lastUsed: Date.now() });
  scheduleCleanup();

  return { cdpUrl, page };
}

export async function closeBrowserSession(platform: string): Promise<void> {
  const entry = sessions.get(platform);
  if (!entry) return;
  try {
    await entry.browser.close();
  } catch {}
  sessions.delete(platform);
}

export async function closeAllSessions(): Promise<void> {
  for (const [key] of sessions) await closeBrowserSession(key);
}

export async function getSessionStatus(): Promise<
  Record<string, { active: boolean; lastUsed: string | null; cdpUrl: string }>
> {
  const result: Record<string, { active: boolean; lastUsed: string | null; cdpUrl: string }> = {};
  const platforms = [
    "instagram",
    "facebook",
    "youtube",
    "ebay",
    "craigslist",
    "ascap",
    "mlc",
    "distrokid",
    "cashapp",
    "soundcloud",
  ];
  for (const p of platforms) {
    const entry = sessions.get(p);
    result[p] = {
      active: !!entry,
      lastUsed: entry ? new Date(entry.lastUsed).toISOString() : null,
      cdpUrl: getCometCdpUrl(),
    };
  }
  return result;
}
