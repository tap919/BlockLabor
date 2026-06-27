/**
 * OpenClaw gateway client for the OTM Agent web app.
 *
 * Calls the local OpenClaw gateway's POST /tools/invoke endpoint to execute
 * OTM Agent plugin tools. The gateway runs on localhost:18789 by default.
 *
 * Required env vars (set in .env.local):
 *   OPENCLAW_GATEWAY_URL   — defaults to http://127.0.0.1:18789
 *   OPENCLAW_GATEWAY_TOKEN — Bearer token from gateway.auth.token in OpenClaw config
 */

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL ?? "http://127.0.0.1:18789";
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN ?? "";

if (!GATEWAY_TOKEN) {
  console.warn(
    "[openclaw-client] OPENCLAW_GATEWAY_TOKEN is empty — requests will be unauthenticated. " +
      "Set it in .env.local to enable gateway auth.",
  );
}

export interface GatewayToolResult {
  ok: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Invoke a named tool on the OpenClaw gateway.
 * Returns `{ ok: false, error }` when the gateway is unreachable or returns
 * a non-200 response — callers should fall back to mock data.
 */
export async function invokeGatewayTool(
  tool: string,
  args: Record<string, unknown> = {},
): Promise<GatewayToolResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (GATEWAY_TOKEN) {
    headers["Authorization"] = `Bearer ${GATEWAY_TOKEN}`;
  }

  try {
    const res = await fetch(`${GATEWAY_URL}/tools/invoke`, {
      method: "POST",
      headers,
      body: JSON.stringify({ tool, args }),
      // Short timeout: if the gateway is not running we fall back to mock data.
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return { ok: false, error: `Gateway returned ${res.status}: ${text}` };
    }

    const data = (await res.json()) as GatewayToolResult;
    return data;
  } catch (e) {
    // Network error, timeout, DNS failure, etc. — return a structured error
    // so callers can fall through to fallback data without crashing.
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Gateway unreachable: ${msg}` };
  }
}
