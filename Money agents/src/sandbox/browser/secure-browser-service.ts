/**
 * Secure Playwright Browser Automation Service
 * Provides browser automation capabilities for the financial sandbox
 * 
 * SECURITY FIXES:
 * - Proper session management with timeouts
 * - HTTPS enforcement (configurable)
 * - Domain whitelisting
 * - Sensitive data masking
 * - Resource cleanup
 * - Audit logging
 */

import playwright, { Browser, BrowserContext, Page } from 'playwright';
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
  createdBy: string;
  actionCount: number;
  timeout: NodeJS.Timeout | null;
}

export interface BrowserRestrictions {
  maxPages: number;
  timeout: number; // Session timeout in ms
  blockDownloads: boolean;
  blockFileUploads: boolean;
  allowedProtocols: string[];
  blockedDomains: string[];
  screenshotEnabled: boolean;
  videoRecording: boolean;
  maxActionsPerSession: number;
}

export interface BrowserAction {
  type: 'navigate' | 'click' | 'type' | 'screenshot' | 'extract' | 'wait' | 'scroll' | 'hover' | 'fill';
  selector?: string;
  value?: string;
  timeout?: number;
  options?: Record<string, unknown>;
}

export interface BrowserActionResult {
  success: boolean;
  data?: unknown;
  screenshot?: string;
  error?: string;
  duration: number;
  url: string;
  timestamp: Date;
  actionType: string;
  masked: boolean;
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

export class SecureBrowserService {
  private sessions: Map<string, BrowserSession> = new Map();
  private maxSessions: number = 10;
  private sessionTimeoutMs: number = 1800000; // 30 minutes
  private auditLog: Array<{ sessionId: string; action: string; timestamp: Date; details: unknown }> = [];

  private defaultRestrictions: BrowserRestrictions = {
    maxPages: 5,
    timeout: 1800000, // 30 minutes
    blockDownloads: true,
    blockFileUploads: false, // Allow for form filling
    allowedProtocols: ['https'], // Only HTTPS by default
    blockedDomains: [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '10.*',
      '172.16.*',
      '192.168.*',
      '*.internal',
      '*.local',
    ],
    screenshotEnabled: true,
    videoRecording: false,
    maxActionsPerSession: 500,
  };

  private executionPolicies: Map<string, ExecutionPolicy> = new Map([
    ['navigate', { mode: 'simulation', requiresApproval: false, maxActionsPerSession: 100, allowedActions: ['navigate'], sensitiveSelectors: [] }],
    ['click', { mode: 'simulation', requiresApproval: false, maxActionsPerSession: 500, allowedActions: ['click'], sensitiveSelectors: ['button[type="submit"]', 'input[type="submit"]', '.pay', '.checkout', '.confirm', '.delete', '.remove'] }],
    ['type', { mode: 'simulation', requiresApproval: false, maxActionsPerSession: 1000, allowedActions: ['type'], sensitiveSelectors: ['input[type="password"]', 'input[name="credit"]', 'input[name="card"]', 'input[name="cvv"]', 'input[name="ssn"]'] }],
    ['fill', { mode: 'simulation', requiresApproval: false, maxActionsPerSession: 1000, allowedActions: ['fill'], sensitiveSelectors: ['input[type="password"]', 'input[name="credit"]', 'input[name="card"]'] }],
    ['extract', { mode: 'simulation', requiresApproval: false, maxActionsPerSession: 200, allowedActions: ['extract'], sensitiveSelectors: [] }],
    ['screenshot', { mode: 'simulation', requiresApproval: false, maxActionsPerSession: 50, allowedActions: ['screenshot'], sensitiveSelectors: [] }],
    ['wait', { mode: 'simulation', requiresApproval: false, maxActionsPerSession: 200, allowedActions: ['wait'], sensitiveSelectors: [] }],
    ['scroll', { mode: 'simulation', requiresApproval: false, maxActionsPerSession: 100, allowedActions: ['scroll'], sensitiveSelectors: [] }],
    ['hover', { mode: 'simulation', requiresApproval: false, maxActionsPerSession: 100, allowedActions: ['hover'], sensitiveSelectors: [] }],
  ]);

  /**
   * Create a new browser session with security controls
   */
  async createSession(options: {
    mode?: 'simulation' | 'draft' | 'live';
    allowedDomains?: string[];
    restrictions?: Partial<BrowserRestrictions>;
    headless?: boolean;
    createdBy?: string;
  } = {}): Promise<BrowserSession> {
    // Check max sessions
    if (this.sessions.size >= this.maxSessions) {
      // Clean up expired sessions first
      await this.cleanupExpiredSessions();
      
      if (this.sessions.size >= this.maxSessions) {
        throw new Error('Maximum browser sessions reached. Please try again later.');
      }
    }

    const sessionId = uuidv4();
    const mode = options.mode || 'simulation';
    const restrictions = { ...this.defaultRestrictions, ...options.restrictions };
    const createdBy = options.createdBy || 'system';

    // Launch browser with security settings
    const browser = await playwright.chromium.launch({
      headless: options.headless !== false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        // SECURITY: Re-enable web security in production
        // '--disable-web-security', // REMOVED - this was a security issue
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-background-networking',
        '--disable-breakpad',
        '--disable-component-update',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-sync',
        '--metrics-recording-only',
        '--no-first-run',
        '--disable-prompt-on-repost',
      ],
    });

    // Create isolated context with security settings
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      // SECURITY: Don't ignore HTTPS errors in production
      ignoreHTTPSErrors: mode === 'simulation', // Only ignore in simulation mode
      // Block service workers for security
      serviceWorkers: 'block',
      // Set strict permissions
      permissions: [],
    });

    // Apply security restrictions
    await this.applySecurityRestrictions(context, restrictions, options.allowedDomains || []);

    const page = await context.newPage();

    // Set up session timeout
    const timeoutId = setTimeout(() => {
      this.closeSession(sessionId).catch(console.error);
    }, restrictions.timeout);

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
      createdBy,
      actionCount: 0,
      timeout: timeoutId,
    };

    this.sessions.set(sessionId, session);
    this.logAudit(sessionId, 'session_created', { mode, allowedDomains: options.allowedDomains });

    return session;
  }

  /**
   * Apply security restrictions to browser context
   */
  private async applySecurityRestrictions(
    context: BrowserContext,
    restrictions: BrowserRestrictions,
    allowedDomains: string[]
  ): Promise<void> {
    // Block downloads
    if (restrictions.blockDownloads) {
      context.on('page', async (page) => {
        const client = await context.newCDPSession(page);
        await client.send('Page.setDownloadBehavior', { behavior: 'deny' });
      });
    }

    // Intercept and validate all requests
    await context.route('**/*', (route) => {
      const request = route.request();
      const url = request.url();

      try {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol.replace(':', '');
        const hostname = urlObj.hostname;

        // Check protocol
        if (!restrictions.allowedProtocols.includes(protocol)) {
          this.logAudit('route', 'blocked_protocol', { url, protocol });
          route.abort();
          return;
        }

        // Check blocked domains (internal networks)
        if (this.isBlockedDomain(hostname, restrictions.blockedDomains)) {
          this.logAudit('route', 'blocked_domain', { url, hostname });
          route.abort('blockedbyclient');
          return;
        }

        // Check allowed domains (if specified)
        if (allowedDomains.length > 0 && !this.isAllowedDomain(hostname, allowedDomains)) {
          this.logAudit('route', 'blocked_unallowed_domain', { url, hostname });
          route.abort('blockedbyclient');
          return;
        }

        route.continue();
      } catch (error) {
        // Invalid URL - block it
        route.abort();
      }
    });
  }

  /**
   * Check if domain is in blocked list
   */
  private isBlockedDomain(hostname: string, blockedDomains: string[]): boolean {
    return blockedDomains.some(blocked => {
      if (blocked.startsWith('*.')) {
        return hostname.endsWith(blocked.substring(2));
      }
      if (blocked.includes('*')) {
        const regex = new RegExp('^' + blocked.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
        return regex.test(hostname);
      }
      return hostname === blocked || hostname.endsWith('.' + blocked);
    });
  }

  /**
   * Check if domain is in allowed list
   */
  private isAllowedDomain(hostname: string, allowedDomains: string[]): boolean {
    return allowedDomains.some(allowed => {
      if (allowed.startsWith('*.')) {
        return hostname.endsWith(allowed.substring(2));
      }
      return hostname === allowed || hostname.endsWith('.' + allowed);
    });
  }

  /**
   * Execute a browser action with security controls
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
        actionType: action.type,
        masked: false,
      };
    }

    const startTime = Date.now();
    const policy = this.executionPolicies.get(action.type);

    try {
      // Check action count
      if (session.actionCount >= session.restrictions.maxActionsPerSession) {
        throw new Error('Maximum actions per session exceeded');
      }

      // Check if action is allowed by policy
      if (policy && !policy.allowedActions.includes(action.type)) {
        throw new Error(`Action ${action.type} is not allowed`);
      }

      // Check for sensitive selectors
      const isSensitive = action.selector && policy?.sensitiveSelectors.some(s => 
        action.selector?.match(new RegExp(s.replace(/\*/g, '.*')))
      );

      if (isSensitive && session.mode !== 'live') {
        // In simulation/draft, log but don't execute on sensitive elements
        this.logAudit(sessionId, 'sensitive_action_blocked', { action: action.type, selector: action.selector });
        return {
          success: true,
          data: { simulated: true, reason: 'Sensitive selector - action logged but not executed' },
          duration: Date.now() - startTime,
          url: session.page.url(),
          timestamp: new Date(),
          actionType: action.type,
          masked: true,
        };
      }

      // Validate URL for navigate actions
      if (action.type === 'navigate' && action.value) {
        try {
          const urlObj = new URL(action.value);
          
          // Check protocol
          if (!session.restrictions.allowedProtocols.includes(urlObj.protocol.replace(':', ''))) {
            throw new Error(`Protocol not allowed: ${urlObj.protocol}`);
          }

          // Check domain
          if (session.allowedDomains.length > 0 && !this.isAllowedDomain(urlObj.hostname, session.allowedDomains)) {
            throw new Error(`Domain not allowed: ${urlObj.hostname}`);
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes('not allowed')) {
            throw error;
          }
          throw new Error('Invalid URL');
        }
      }

      // Execute action
      let result: unknown;
      const page = session.page;

      switch (action.type) {
        case 'navigate':
          await page.goto(action.value!, { 
            timeout: action.timeout || 30000,
            waitUntil: 'domcontentloaded'
          });
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

        case 'fill':
          await page.fill(action.selector!, action.value!);
          result = { filled: true };
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

      // Update session
      session.lastActivity = new Date();
      session.actionCount++;

      this.logAudit(sessionId, 'action_executed', { action: action.type, success: true });

      return {
        success: true,
        data: result,
        screenshot: action.options?.includeScreenshot ? await this.takeScreenshot(page) : undefined,
        duration: Date.now() - startTime,
        url: page.url(),
        timestamp: new Date(),
        actionType: action.type,
        masked: false,
      };

    } catch (error: any) {
      this.logAudit(sessionId, 'action_failed', { action: action.type, error: error.message });

      return {
        success: false,
        error: error.message,
        screenshot: session.restrictions.screenshotEnabled ? await this.takeScreenshot(session.page) : undefined,
        duration: Date.now() - startTime,
        url: session.page.url(),
        timestamp: new Date(),
        actionType: action.type,
        masked: false,
      };
    }
  }

  /**
   * Extract data from page with sanitization
   */
  private async extractData(page: Page, selector?: string, options?: any): Promise<unknown> {
    if (selector) {
      return await page.evaluate((sel) => {
        const elements = document.querySelectorAll(sel);
        return Array.from(elements).map(el => ({
          text: el.textContent?.trim(),
          // Don't extract innerHTML to avoid XSS
          attributes: Array.from(el.attributes).reduce((acc, attr) => {
            // Filter out sensitive attributes
            if (!attr.name.toLowerCase().includes('token') && 
                !attr.name.toLowerCase().includes('key') &&
                !attr.name.toLowerCase().includes('secret')) {
              acc[attr.name] = attr.value;
            }
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
      // Don't extract form values for security
      links: Array.from(document.links).slice(0, 100).map(link => ({
        href: link.href,
        text: link.textContent?.trim(),
      })),
    }));
  }

  /**
   * Take screenshot safely
   */
  private async takeScreenshot(page: Page): Promise<string> {
    try {
      const buffer = await page.screenshot({ fullPage: false });
      return buffer.toString('base64');
    } catch {
      return '';
    }
  }

  /**
   * Close a browser session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Clear timeout
      if (session.timeout) {
        clearTimeout(session.timeout);
      }

      try {
        await session.browser.close();
      } catch (error) {
        // Browser may already be closed
      }

      this.sessions.delete(sessionId);
      this.logAudit(sessionId, 'session_closed', { 
        duration: Date.now() - session.createdAt.getTime(),
        actionCount: session.actionCount 
      });
    }
  }

  /**
   * Get session status
   */
  getSession(sessionId: string): { id: string; mode: string; url: string; createdAt: Date; lastActivity: Date; actionCount: number } | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    return {
      id: session.id,
      mode: session.mode,
      url: session.page.url(),
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      actionCount: session.actionCount,
    };
  }

  /**
   * List all active sessions
   */
  listSessions(): Array<{ id: string; mode: string; url: string; createdAt: Date; lastActivity: Date; actionCount: number }> {
    return Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      mode: session.mode,
      url: session.page.url(),
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      actionCount: session.actionCount,
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
   * Clean up expired sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActivity.getTime() > session.restrictions.timeout) {
        expiredSessions.push(id);
      }
    }

    for (const id of expiredSessions) {
      await this.closeSession(id);
    }
  }

  /**
   * Kill all sessions (emergency stop)
   */
  async killAllSessions(): Promise<void> {
    const closePromises = Array.from(this.sessions.keys()).map(id => this.closeSession(id));
    await Promise.all(closePromises);
    this.logAudit('system', 'all_sessions_killed', { count: closePromises.length });
  }

  /**
   * Log audit event
   */
  private logAudit(sessionId: string, action: string, details: unknown): void {
    this.auditLog.push({
      sessionId,
      action,
      timestamp: new Date(),
      details,
    });

    // Keep only last 1000 entries in memory
    if (this.auditLog.length > 1000) {
      this.auditLog.shift();
    }

    // In production, also write to persistent storage
    console.log(`[BROWSER_AUDIT] ${sessionId}: ${action}`, JSON.stringify(details));
  }

  /**
   * Get audit log
   */
  getAuditLog(sessionId?: string, limit: number = 100): Array<{ sessionId: string; action: string; timestamp: Date; details: unknown }> {
    if (sessionId) {
      return this.auditLog.filter(log => log.sessionId === sessionId).slice(-limit);
    }
    return this.auditLog.slice(-limit);
  }

  // ============================================
  // Convenience Methods
  // ============================================

  async getPageContent(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    return session.page.content();
  }

  async getPageUrl(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    return session.page.url();
  }

  async waitForNavigation(sessionId: string, options?: { timeout?: number; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    await session.page.waitForLoadState(options?.waitUntil || 'load', { timeout: options?.timeout || 30000 });
    return session.page.url();
  }

  async getText(sessionId: string, selector: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    return (await session.page.textContent(selector)) || '';
  }

  async elementExists(sessionId: string, selector: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    const element = await session.page.$(selector);
    return element !== null;
  }
}

// ============================================
// Singleton Export
// ============================================

export const secureBrowserService = new SecureBrowserService();
