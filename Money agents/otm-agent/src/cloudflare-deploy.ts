/**
 * TapClaw Store — Autonomous Cloudflare Pages Deploy Tool
 *
 * This module implements the `otm_deploy_store` tool registered inside the
 * OTM Agent extension.  It is TapClaw's FIRST registered tool and its first
 * autonomous action: build the sales website and push it to Cloudflare Pages
 * using Cloudflare Pages APIs plus Wrangler for deployment upload.
 *
 * Steps executed autonomously:
 *  1. Shell out to `npm run build:cf` inside `store/` which runs:
 *     `next build && next-on-pages --skip-build && <copy _next/static>`
 *     to produce the `.vercel/output/static` Pages bundle without invoking
 *     the Vercel CLI (which is unreliable on Windows).
 *  2. Create the Cloudflare Pages project if it does not exist yet.
 *  3. Upload the built output as a new deployment via `wrangler pages deploy`.
 *  4. Push environment secrets (Stripe keys, gateway token) to the project.
 *  5. Bind the custom domain to the deployment.
 *
 * Project/domain/secrets are managed via api.cloudflare.com REST calls.
 */

import { execFileSync, SpawnSyncReturns } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CF_API = "https://api.cloudflare.com/client/v4";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DeployConfig {
  /** Cloudflare Account ID */
  accountId: string;
  /** Cloudflare API token with Pages:Edit permission */
  apiToken: string;
  /** Cloudflare Pages project name (created if absent) */
  projectName: string;
  /** Custom domain to bind (e.g. "tapclaw.ai") */
  domain?: string;
  /** Absolute path to the store directory */
  storeDir: string;
  /** Secrets to push to the project (key → value) */
  secrets?: Record<string, string>;
}

export interface DeployResult {
  success: boolean;
  deploymentUrl?: string;
  projectCreated?: boolean;
  domainBound?: boolean;
  secretsPushed?: string[];
  error?: string;
  logs: string[];
}

// ─── Input Validation ─────────────────────────────────────────────────────────

function validateDeployConfig(config: DeployConfig): string[] {
  const errors: string[] = [];

  if (!config.accountId?.trim()) {
    errors.push("Account ID is required");
  }

  if (!config.apiToken?.trim()) {
    errors.push("API token is required");
  }

  if (!config.projectName?.trim()) {
    errors.push("Project name is required");
  }

  if (config.storeDir && !existsSync(config.storeDir)) {
    errors.push(`Store directory does not exist: ${config.storeDir}`);
  }

  // Validate secrets if provided
  if (config.secrets) {
    for (const [key, value] of Object.entries(config.secrets)) {
      if (!key.trim()) {
        errors.push("Secret key cannot be empty");
      }
      if (typeof value !== "string") {
        errors.push(`Secret value for ${key} must be a string`);
      }
    }
  }

  return errors;
}

// ─── Helper: Cloudflare API fetch ─────────────────────────────────────────────

async function cfFetch(
  token: string,
  method: string,
  path: string,
  body?: unknown,
  logs: string[] = [],
): Promise<{ success: boolean; result: unknown; errors: { message: string }[] }> {
  return withRetry(
    async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const res = await fetch(`${CF_API}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
          signal: controller.signal,
        });

        let json: { success: boolean; result: unknown; errors: { message: string }[] };
        try {
          json = (await res.json()) as {
            success: boolean;
            result: unknown;
            errors: { message: string }[];
          };
        } catch {
          return {
            success: false,
            result: null,
            errors: [{ message: `Cloudflare API returned non-JSON response (${res.status})` }],
          };
        }

        clearTimeout(timeoutId);
        return json;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === "AbortError") {
          return {
            success: false,
            result: null,
            errors: [{ message: "Cloudflare API request timed out after 30 seconds" }],
          };
        }
        throw error; // Let the retry wrapper handle it
      }
    },
    `Cloudflare API ${method} ${path}`,
    3,
    1000,
    logs,
  );
}

// ─── Retry wrapper ───────────────────────────────────────────────────────────

async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
  logs: string[] = [],
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        logs.push(`[deploy] Retry attempt ${attempt}/${maxRetries} for ${operationName}`);
      }
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on validation errors or user errors
      if (
        lastError.message.includes("validation") ||
        lastError.message.includes("not found") ||
        lastError.message.includes("permission denied")
      ) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
        logs.push(
          `[deploy] ${operationName} failed (attempt ${attempt}): ${lastError.message}. Retrying in ${delayMs}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error(`${operationName} failed after ${maxRetries} attempts`);
}

// ─── Step 1: Build ────────────────────────────────────────────────────────────

function buildStore(storeDir: string, logs: string[]): void {
  logs.push("[deploy] Running build:cf in " + storeDir);
  try {
    // Platform-aware command execution for Windows compatibility
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
    const out = execFileSync(npmCmd, ["run", "build:cf"], {
      cwd: storeDir,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      timeout: 5 * 60 * 1000, // 5 min max
    });
    logs.push("[deploy] Build output: " + out.toString().trim().slice(-500));
  } catch (err: unknown) {
    const e = err as SpawnSyncReturns<Buffer>;
    const msg = (e.stderr?.toString() ?? "") + "\n" + (e.stdout?.toString() ?? "");
    throw new Error("Build failed:\n" + msg.trim().slice(-800));
  }
}

// ─── Step 2: Ensure project exists ───────────────────────────────────────────

async function ensureProject(config: DeployConfig, logs: string[]): Promise<boolean> {
  logs.push("[deploy] Checking for CF Pages project: " + config.projectName);
  const existing = await cfFetch(
    config.apiToken,
    "GET",
    `/accounts/${config.accountId}/pages/projects/${config.projectName}`,
    undefined,
    logs,
  );
  if (existing.success) {
    logs.push("[deploy] Project already exists.");
    return false;
  }

  logs.push("[deploy] Creating new project: " + config.projectName);
  const created = await cfFetch(
    config.apiToken,
    "POST",
    `/accounts/${config.accountId}/pages/projects`,
    {
      name: config.projectName,
      production_branch: "main",
    },
    logs,
  );
  if (!created.success) {
    throw new Error(
      "Failed to create project: " +
        (created.errors?.map((e) => e.message).join(", ") ?? "unknown error"),
    );
  }
  logs.push("[deploy] Project created.");
  return true;
}

// ─── Step 3: Upload deployment via Wrangler ───────────────────────────────────

function uploadDeployment(config: DeployConfig, logs: string[]): { url?: string } {
  const outputDir = join(config.storeDir, ".vercel", "output", "static");
  if (!existsSync(outputDir)) {
    throw new Error(`Build output not found at ${outputDir}. Run the build step first.`);
  }

  logs.push("[deploy] Uploading Pages bundle with Wrangler...");
  try {
    // Platform-aware command execution for Windows compatibility
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
    const out = execFileSync(
      npmCmd,
      [
        "exec",
        "--",
        "wrangler",
        "pages",
        "deploy",
        ".vercel/output/static",
        "--project-name",
        config.projectName,
      ],
      {
        cwd: config.storeDir,
        env: {
          ...process.env,
          CLOUDFLARE_ACCOUNT_ID: config.accountId,
          CLOUDFLARE_API_TOKEN: config.apiToken,
        },
        timeout: 5 * 60 * 1000,
      },
    ).toString();

    logs.push("[deploy] Wrangler output: " + out.trim().slice(-700));

    const match = out.match(/https?:\/\/[^\s]+\.pages\.dev/);
    return { url: match?.[0] };
  } catch (err: unknown) {
    const e = err as SpawnSyncReturns<Buffer>;
    const msg = (e.stderr?.toString() ?? "") + "\n" + (e.stdout?.toString() ?? "");
    throw new Error("Wrangler upload failed:\n" + msg.trim().slice(-1200));
  }
}

// ─── Step 4: Push secrets ─────────────────────────────────────────────────────

async function pushSecrets(config: DeployConfig, logs: string[]): Promise<string[]> {
  const secrets = config.secrets;
  if (!secrets || Object.keys(secrets).length === 0) {
    logs.push("[deploy] No secrets to push.");
    return [];
  }

  logs.push("[deploy] Pushing secrets to Cloudflare Pages project...");
  const envVars: Record<string, { value: string; type: string }> = {};
  for (const [key, value] of Object.entries(secrets)) {
    if (!value) {
      continue;
    }
    envVars[key] = {
      value,
      type: key.startsWith("NEXT_PUBLIC_") ? "plain_text" : "secret_text",
    };
  }

  if (Object.keys(envVars).length === 0) {
    logs.push("[deploy] No non-empty secrets to push.");
    return [];
  }

  const res = await cfFetch(
    config.apiToken,
    "PATCH",
    `/accounts/${config.accountId}/pages/projects/${config.projectName}`,
    {
      deployment_configs: {
        production: { env_vars: envVars },
        preview: { env_vars: envVars },
      },
    },
    logs,
  );

  if (!res.success) {
    logs.push(
      "[deploy] Warning: could not push secrets: " +
        (res.errors?.map((e) => e.message).join(", ") ?? "unknown"),
    );
    return [];
  }

  const pushed = Object.keys(envVars);
  logs.push("[deploy] Secrets pushed: " + pushed.join(", "));
  return pushed;
}

// ─── Step 5: Bind custom domain ───────────────────────────────────────────────

async function bindDomain(config: DeployConfig, logs: string[]): Promise<boolean> {
  if (!config.domain) {
    logs.push("[deploy] No custom domain configured — skipping domain binding.");
    return false;
  }

  logs.push(`[deploy] Binding custom domain: ${config.domain}`);
  const res = await cfFetch(
    config.apiToken,
    "POST",
    `/accounts/${config.accountId}/pages/projects/${config.projectName}/domains`,
    { name: config.domain },
    logs,
  );

  if (res.success) {
    logs.push(`[deploy] Domain bound: ${config.domain}`);
    return true;
  }

  // "already exists" is fine — not a hard error
  const errMsg = res.errors?.map((e) => e.message).join(", ") ?? "";
  if (errMsg.toLowerCase().includes("already") || errMsg.toLowerCase().includes("exist")) {
    logs.push(`[deploy] Domain already bound: ${config.domain}`);
    return true;
  }

  logs.push(`[deploy] Warning: domain binding failed: ${errMsg}`);
  return false;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Autonomously build and deploy the TapClaw store to Cloudflare Pages.
 * This is called by the `otm_deploy_store` tool registered in the OTM Agent.
 */
export async function deployStoreToCloudflarepages(config: DeployConfig): Promise<DeployResult> {
  const logs: string[] = [];

  // Validate input configuration
  const validationErrors = validateDeployConfig(config);
  if (validationErrors.length > 0) {
    return {
      success: false,
      error: `Configuration validation failed: ${validationErrors.join(", ")}`,
      logs,
    };
  }

  try {
    // 1. Build
    buildStore(config.storeDir, logs);

    // 2. Ensure project exists
    const projectCreated = await ensureProject(config, logs);

    // 3. Upload
    const { url: deploymentUrl } = uploadDeployment(config, logs);

    // 4. Secrets
    const secretsPushed = await pushSecrets(config, logs);

    // 5. Domain
    const domainBound = await bindDomain(config, logs);

    logs.push("[deploy] ✓ Deployment complete.");

    return {
      success: true,
      deploymentUrl,
      projectCreated,
      domainBound,
      secretsPushed,
      logs,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    logs.push("[deploy] ✗ Deployment failed: " + error);
    return { success: false, error, logs };
  }
}

// ─── Resolve store directory ──────────────────────────────────────────────────

/**
 * Locate the `store/` directory relative to this extension, or fall back to
 * a configurable path.
 */
export function resolveStoreDir(override?: string): string {
  if (override) return override;

  // Extension lives at extensions/otm-agent/ — store is at repo root
  // __dirname equivalent for ESM: use import.meta.url pattern at call site.
  // We try common relative paths and env var.
  const envPath = process.env.TAPCLAW_STORE_DIR;
  if (envPath && existsSync(envPath)) return envPath;

  // Relative to cwd (works when OpenClaw is run from repo root)
  const cwdStore = join(process.cwd(), "store");
  if (existsSync(cwdStore)) return cwdStore;

  // Fallback: ~/.openclaw/store
  return join(homedir(), ".openclaw", "store");
}
