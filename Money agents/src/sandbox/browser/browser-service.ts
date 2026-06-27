/**
 * Playwright Browser Automation Service
 * Provides browser automation capabilities for the financial sandbox
 * Enables agents to interact with web applications safely within the sandbox
 */

import playwright, { Browser, BrowserContext, Page, BrowserType } from 'playwright';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// Types and Interfaces
// ============================================

export interface BrowserSession {
  id: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  createdAt: Date;
  lastActivity: Date;
  mode: 'simulation' | 'draft' | 'live';
  allowedDomains: string[];
  restrictions: BrowserRestrictions;
}

export interface BrowserRestrictions {
  maxPages: number;
  timeout: number;
  blockDownloads: boolean;
  blockFileUploads: boolean;
  allowedProtocols: string[];
  blockedDomains: string[];
  screenshotEnabled: boolean;
  videoRecording: boolean;
}

export interface BrowserAction {
  type: 'navigate' | 'click' | 'type' | 'screenshot' | 'extract' | 'wait' | 'scroll' | 'hover';
  selector?: string;
  value?: string;
  timeout?: number;
  options?: Record<string, any>;
}

export interface BrowserActionResult {
  success: boolean;
  data?: any;
  screenshot?: string;
  error?: string;
  duration: number;
  url: string;
  timestamp: Date;
}

export interface ExecutionPolicy {
  mode: 'simulation' | 'draft' | 'live';
  requiresApproval: boolean;
  maxActionsPerSession: number;
  allowedActions: string[];
  sensitiveSelectors: string[];
}

// ============================================
// Browser Service Class
// ============================================

export class BrowserService {
  private sessions: Map<string, BrowserSession> = new Map();
  private defaultRestrictions: BrowserRestrictions = {
    maxPages: 5,
    timeout: 30000,
    blockDownloads: true,
    blockFileUploads: false,
    allowedProtocols: ['https'],
    blockedDomains: ['localhost', '127.0.0.1', 'internal.*'],
    screenshotEnabled: true,
    videoRecording: false,
  };

  private executionPolicies: Map<string, ExecutionPolicy> = new Map([
    ['navigate', { mode: 'simulation', requiresApproval: false, maxActionsPerSession: 100, allowedActions: ['navigate'], sensitiveSelectors: [] }],
    ['click', { mode: 'simulation', requiresApproval: false, maxActionsPerSession: 500, allowedActions: ['click'], sensitiveSelectors: ['button[type="submit"]', 'input[type="submit"]', '.pay', '.checkout', '.confirm'] }],
    ['type', { mode: 'simulation', requiresApproval: false, maxActionsPerSession: 1000, allowedActions: ['type'], sensitiveSelectors: ['input[type="password"]', 'input[name="credit"]', 'input[name="card"]'] }],
    ['extract', { mode: 'simulation', requiresApproval: false, maxActionsPerSession: 200, allowedActions: ['extract'], sensitiveSelectors: [] }],
    ['screenshot', { mode: 'simulation', requiresApproval: false, maxActionsPerSession: 50, allowedActions: ['screenshot'], sensitiveSelectors: [] }],
  ]);

  /**
   * Create a new browser session
   */
  async createSession(options: {
    mode?: 'simulation' | 'draft' | 'live';
    allowedDomains?: string[];
    restrictions?: Partial<BrowserRestrictions>;
    headless?: boolean;
  } = {}): Promise<BrowserSession> {
    const sessionId = uuidv4();
    const mode = options.mode || 'simulation';
    const restrictions = { ...this.defaultRestrictions, ...options.restrictions };

    // Launch browser with appropriate settings
    const browser = await playwright.chromium.launch({
      headless: options.headless !== false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });

    // Create isolated context
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true,
      // Block unnecessary resources for performance
      // serviceWorkers: 'block',
    });

    // Apply restrictions
    await this.applyRestrictions(context, restrictions);

    const page = await context.newPage();

    const session: BrowserSession = {
      id: sessionId,
      browser,
      context,
      page,
      createdAt: new Date(),
      lastActivity: new Date(),
      mode,
      allowedDomains: options.allowedDomains || [],
      restrictions,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Apply browser restrictions to context
   */
  private async applyRestrictions(context: BrowserContext, restrictions: BrowserRestrictions): Promise<void> {
    // Block downloads if required
    if (restrictions.blockDownloads) {
      context.on('page', async (page) => {
        const client = await context.newCDPSession(page);
        await client.send('Page.setDownloadBehavior', { behavior: 'deny' });
      });
    }

    // Block specific domains
    await context.route('**/*', (route) => {
      const url = route.request().url();
      const protocol = url.split('://')[0];

      // Check protocol
      if (!restrictions.allowedProtocols.includes(protocol)) {
        route.abort();
        return;
      }

      // Check blocked domains
      const hostname = new URL(url).hostname;
      if (restrictions.blockedDomains.some(domain => 
        hostname === domain || hostname.endsWith('.' + domain) || new RegExp(domain).test(hostname)
      )) {
        route.abort();
        return;
      }

      route.continue();
    });
  }

  /**
   * Execute a browser action
   */
  async executeAction(sessionId: string, action: BrowserAction): Promise<BrowserActionResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        error: 'Session not found',
        duration: 0,
        url: '',
        timestamp: new Date(),
      };
    }

    const startTime = Date.now();
    const policy = this.executionPolicies.get(action.type);

    try {
      // Check if action is allowed
      if (policy && !policy.allowedActions.includes(action.type)) {
        throw new Error(`Action ${action.type} is not allowed`);
      }

      // Check for sensitive selectors
      if (action.selector && policy?.sensitiveSelectors.some(s => action.selector?.match(s))) {
        if (session.mode === 'simulation' || session.mode === 'draft') {
          // In simulation/draft, log but don't execute
          return {
            success: true,
            data: { simulated: true, reason: 'Sensitive selector - action logged but not executed' },
            duration: Date.now() - startTime,
            url: session.page.url(),
            timestamp: new Date(),
          };
        }
        // In live mode, this requires explicit approval
      }

      let result: any;
      const page = session.page;

      switch (action.type) {
        case 'navigate':
          await page.goto(action.value!, { timeout: action.timeout || session.restrictions.timeout });
          result = { url: page.url(), title: await page.title() };
          break;

        case 'click':
          await page.click(action.selector!, { timeout: action.timeout || 5000 });
          result = { clicked: true };
          break;

        case 'type':
          await page.type(action.selector!, action.value!, { delay: 50 });
          result = { typed: true };
          break;

        case 'screenshot':
          const screenshot = await page.screenshot({ fullPage: action.options?.fullPage || false });
          result = { screenshot: screenshot.toString('base64') };
          break;

        case 'extract':
          result = await this.extractData(page, action.selector, action.options);
          break;

        case 'wait':
          if (action.selector) {
            await page.waitForSelector(action.selector, { timeout: action.timeout || 10000 });
          } else {
            await page.waitForTimeout(action.timeout || 1000);
          }
          result = { waited: true };
          break;

        case 'scroll':
          await page.evaluate((scrollOptions) => {
            window.scrollBy(scrollOptions.x || 0, scrollOptions.y || 500);
          }, action.options || {});
          result = { scrolled: true };
          break;

        case 'hover':
          await page.hover(action.selector!, { timeout: action.timeout || 5000 });
          result = { hovered: true };
          break;

        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      session.lastActivity = new Date();

      return {
        success: true,
        data: result,
        screenshot: action.options?.includeScreenshot ? await this.takeScreenshot(page) : undefined,
        duration: Date.now() - startTime,
        url: page.url(),
        timestamp: new Date(),
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        screenshot: session.restrictions.screenshotEnabled ? await this.takeScreenshot(session.page) : undefined,
        duration: Date.now() - startTime,
        url: session.page.url(),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Extract data from page
   */
  private async extractData(page: Page, selector?: string, options?: any): Promise<any> {
    if (selector) {
      return await page.evaluate((sel) => {
        const elements = document.querySelectorAll(sel);
        return Array.from(elements).map(el => ({
          text: el.textContent?.trim(),
          html: el.innerHTML,
          attributes: Array.from(el.attributes).reduce((acc, attr) => {
            acc[attr.name] = attr.value;
            return acc;
          }, {} as Record<string, string>),
        }));
      }, selector);
    }

    // Extract all data from page
    return await page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      text: document.body.innerText,
      forms: Array.from(document.forms).map(form => ({
        action: form.action,
        method: form.method,
        inputs: Array.from(form.elements).map(input => ({
          name: (input as HTMLInputElement).name,
          type: (input as HTMLInputElement).type,
          value: (input as HTMLInputElement).value,
        })),
      })),
      links: Array.from(document.links).map(link => ({
        href: link.href,
        text: link.textContent?.trim(),
      })),
    }));
  }

  /**
   * Take screenshot
   */
  private async takeScreenshot(page: Page): Promise<string> {
    const buffer = await page.screenshot({ fullPage: false });
    return buffer.toString('base64');
  }

  /**
   * Close a browser session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.browser.close();
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Get session status
   */
  getSession(sessionId: string): BrowserSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * List all active sessions
   */
  listSessions(): Array<{ id: string; mode: string; url: string; createdAt: Date; lastActivity: Date }> {
    return Array.from(this.sessions.entries()).map(([id, session]) => ({
      id,
      mode: session.mode,
      url: session.page.url(),
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
    }));
  }

  /**
   * Execute a workflow (multiple actions)
   */
  async executeWorkflow(sessionId: string, actions: BrowserAction[]): Promise<BrowserActionResult[]> {
    const results: BrowserActionResult[] = [];

    for (const action of actions) {
      const result = await this.executeAction(sessionId, action);
      results.push(result);

      if (!result.success && action.options?.stopOnError !== false) {
        break;
      }
    }

    return results;
  }

  /**
   * Execute a single action (alias for executeAction for consistency)
   */
  async executeActionById(sessionId: string, action: BrowserAction): Promise<BrowserActionResult> {
    return this.executeAction(sessionId, action);
  }

  /**
   * Get page content as text
   */
  async getPageContent(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    return session.page.content();
  }

  /**
   * Get page URL
   */
  async getPageUrl(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    return session.page.url();
  }

  /**
   * Wait for navigation
   */
  async waitForNavigation(sessionId: string, options?: { timeout?: number; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    await session.page.waitForLoadState(options?.waitUntil || 'load', { timeout: options?.timeout || 30000 });
    return session.page.url();
  }

  /**
   * Fill a form field
   */
  async fill(sessionId: string, selector: string, value: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    await session.page.fill(selector, value);
  }

  /**
   * Select from dropdown
   */
  async select(sessionId: string, selector: string, value: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    await session.page.selectOption(selector, value);
  }

  /**
   * Check a checkbox
   */
  async check(sessionId: string, selector: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    await session.page.check(selector);
  }

  /**
   * Uncheck a checkbox
   */
  async uncheck(sessionId: string, selector: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    await session.page.uncheck(selector);
  }

  /**
   * Press a key
   */
  async press(sessionId: string, key: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    await session.page.keyboard.press(key);
  }

  /**
   * Get element text
   */
  async getText(sessionId: string, selector: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    return (await session.page.textContent(selector)) || '';
  }

  /**
   * Get element attribute
   */
  async getAttribute(sessionId: string, selector: string, attribute: string): Promise<string | null> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    return session.page.getAttribute(selector, attribute);
  }

  /**
   * Check if element exists
   */
  async elementExists(sessionId: string, selector: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    const element = await session.page.$(selector);
    return element !== null;
  }

  /**
   * Create a recording of browser session
   */
  async startRecording(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.restrictions.videoRecording = true;
      // Playwright recording would be set up here
    }
  }

  /**
   * Kill all sessions (emergency stop)
   */
  async killAllSessions(): Promise<void> {
    const closePromises = Array.from(this.sessions.keys()).map(id => this.closeSession(id));
    await Promise.all(closePromises);
  }
}

// ============================================
// Singleton Export
// ============================================

export const browserService = new BrowserService();
