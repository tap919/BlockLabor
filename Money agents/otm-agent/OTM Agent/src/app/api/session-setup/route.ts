/**
 * Session Setup API
 *
 * Opens a visible Chrome browser via Playwright and waits for the user to log
 * into all required platforms (Reddit, Fiverr, Upwork, Clickworker, Gumroad).
 * Once done, saves the session cookies to storageState.json so subsequent
 * automated runs can reuse the logged-in session without Chrome.
 *
 * POST /api/session-setup        { "action": "start" }   → opens browser, returns immediately
 * POST /api/session-setup        { "action": "save" }    → saves storageState.json, closes browser
 * GET  /api/session-setup                                → returns current session status
 */

import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";

const STORAGE_STATE_PATH =
  process.env.PLAYWRIGHT_STORAGE_STATE ??
  path.join(
    process.env.LOCALAPPDATA ?? "C:\\Users\\User\\AppData\\Local",
    "OpenClaw",
    "storageState.json",
  );

const CHROME_EXE =
  process.env.CHROME_EXE_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// Module-level browser reference (persists across requests in same process)
let _setupContext: import("playwright").BrowserContext | null = null;
let _setupStatus: "idle" | "open" | "saving" | "saved" | "error" = "idle";
let _setupError: string | null = null;

export async function GET() {
  const hasStorageState = fs.existsSync(STORAGE_STATE_PATH);
  return NextResponse.json({
    status: _setupStatus,
    hasStorageState,
    storagePath: STORAGE_STATE_PATH,
    error: _setupError,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { action?: string };
  const action = body.action ?? "start";

  if (action === "start") {
    if (_setupContext) {
      return NextResponse.json({ success: false, message: "Browser already open — call 'save' to finish" });
    }

    try {
      _setupStatus = "open";
      _setupError = null;

      // Lazy-load playwright
      const { chromium } = await import("playwright");

      // Ensure output directory exists
      fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });

      // Launch visible browser with a fresh context so user can log in
      const browser = await chromium.launch({
        executablePath: CHROME_EXE,
        headless: false,
        channel: "chrome",
        args: ["--disable-blink-features=AutomationControlled"],
      });

      _setupContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await _setupContext.newPage();

      // Navigate to Reddit to prompt login
      await page.goto("https://www.reddit.com/login", { waitUntil: "domcontentloaded", timeout: 30_000 });

      return NextResponse.json({
        success: true,
        message: "Browser opened — log into Reddit (and any other platforms), then POST { action: 'save' }",
        storagePath: STORAGE_STATE_PATH,
      });
    } catch (err) {
      _setupStatus = "error";
      _setupError = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ success: false, error: _setupError }, { status: 500 });
    }
  }

  if (action === "save") {
    if (!_setupContext) {
      return NextResponse.json({ success: false, message: "No browser open — call 'start' first" }, { status: 400 });
    }

    try {
      _setupStatus = "saving";
      fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });
      await _setupContext.storageState({ path: STORAGE_STATE_PATH });
      await _setupContext.browser()?.close().catch(() => {});
      _setupContext = null;
      _setupStatus = "saved";

      return NextResponse.json({
        success: true,
        message: "Session saved — browser automation will now use your saved login.",
        storagePath: STORAGE_STATE_PATH,
      });
    } catch (err) {
      _setupStatus = "error";
      _setupError = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ success: false, error: _setupError }, { status: 500 });
    }
  }

  return NextResponse.json({ success: false, message: `Unknown action: ${action}` }, { status: 400 });
}
