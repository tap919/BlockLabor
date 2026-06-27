// Playwright health check for the local Next.js OTM dashboard
// Runs headless Chromium to verify the server is up and serving the UI
// Usage: node scripts/playwright-health.js

const { chromium } = require('playwright');

async function run() {
  const MAX_RETRIES = 5;
  const DELAY_MS = 600;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let browser;
    try {
      // Launch headless browser
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();

      // Try to load the local dashboard
      const url = 'http://127.0.0.1:3000';
      console.log(`INFO: Navigating to ${url} (attempt ${attempt})`);
      await page.goto(url, { timeout: 15000, waitUntil: 'networkidle' });

      // Check for a known DOM signature from the dashboard (title/h1)
      const header = await page.locator('h1').first().textContent();
      if (header && header.toLowerCase().includes('otm')) {
        console.log('PLAYWRIGHT-HEALTH: READY — Dashboard UI detected');
        await browser.close();
        process.exit(0);
      }

      // Fallback: look for a container element
      const hasBody = await page.locator('body').count();
      if (hasBody > 0) {
        console.log('PLAYWRIGHT-HEALTH: READY — UI responsive, no explicit header found');
        await browser.close();
        process.exit(0);
      }

      console.error('PLAYWRIGHT-HEALTH: UNKNOWN_UI_STATE');
      await browser.close();
      process.exit(3);
    } catch (err) {
      console.error('PLAYWRIGHT-HEALTH: ERROR', err && err.message ? err.message : err);
      if (browser) {
        try { await browser.close(); } catch (e) { /* ignore */ }
      }
      const msg = String(err?.message || '');
      if (msg.includes('ERR_CONNECTION_REFUSED') || msg.includes('net::ERR_CONNECTION_REFUSED')) {
        if (attempt < MAX_RETRIES) {
          await new Promise(res => setTimeout(res, DELAY_MS));
          continue;
        }
      }
      process.exit(2);
    }
  }
  console.error('PLAYWRIGHT-HEALTH: FAILED_AFTER_RETRIES');
  process.exit(3);
}

run();
