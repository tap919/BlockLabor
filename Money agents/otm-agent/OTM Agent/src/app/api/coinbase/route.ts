/**
 * GET  /api/coinbase?path=/brokerage/accounts          — proxy to Coinbase Advanced Trade API
 * POST /api/coinbase?path=/brokerage/orders            — proxy to Coinbase Advanced Trade API
 *
 * Coinbase Advanced Trade uses JWT-signed requests (ES256, EC key).
 * Key format (Coinbase Developer Platform):
 *   COINBASE_API_KEY_NAME  = "organizations/{org_id}/apiKeys/{key_id}"
 *   COINBASE_API_KEY_SECRET = PEM-encoded EC private key (-----BEGIN EC PRIVATE KEY-----)
 *
 * To create keys: https://www.coinbase.com/settings/api
 *   → Advanced Trade → New API Key → copy Key Name + Private Key
 *
 * Supported paths proxied here (all /api/v3/brokerage/*):
 *   GET /brokerage/accounts            — portfolio balances
 *   GET /brokerage/portfolios          — portfolio summary
 *   GET /brokerage/orders/historical/batch — order history
 *   GET /brokerage/products            — tradeable pairs
 *   POST /brokerage/orders             — place order
 *   GET /brokerage/best_bid_ask        — live quotes
 *
 * NEVER returns fake or mock data — returns upstream error if keys are missing.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSign, createPrivateKey } from "crypto";

const COINBASE_API_BASE = "https://api.coinbase.com";
const KEY_NAME = process.env.COINBASE_API_KEY_NAME ?? "";
const KEY_SECRET = process.env.COINBASE_API_KEY_SECRET ?? "";

function buildJwt(method: string, path: string): string {
  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID().replace(/-/g, "");

  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: KEY_NAME, nonce })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: KEY_NAME,
      iss: "cdp",
      nbf: now,
      exp: now + 120,
      uri: `${method} api.coinbase.com${path}`,
    }),
  ).toString("base64url");

  const signingInput = `${header}.${payload}`;

  // Support \n-escaped PEM (env var encoding) and real newlines
  const pemKey = KEY_SECRET.replace(/\\n/g, "\n");
  const privateKey = createPrivateKey({ key: pemKey, format: "pem" });
  const sign = createSign("SHA256");
  sign.update(signingInput);
  sign.end();

  // DER-encoded ECDSA signature → convert to raw r||s for JWT
  const derSig = sign.sign(privateKey);
  const r = derSig.slice(4, 4 + 32);
  const s = derSig.slice(4 + 32 + 2, 4 + 32 + 2 + 32);
  const sig = Buffer.concat([r, s]).toString("base64url");

  return `${signingInput}.${sig}`;
}

async function proxyToCoinbase(method: string, path: string, body?: unknown): Promise<NextResponse> {
  if (!KEY_NAME || !KEY_SECRET) {
    return NextResponse.json(
      {
        error: "Coinbase API keys not configured",
        hint: "Set COINBASE_API_KEY_NAME and COINBASE_API_KEY_SECRET in .env.local",
        docs: "https://www.coinbase.com/settings/api",
      },
      { status: 503 },
    );
  }

  const fullPath = `/api/v3/brokerage${path}`;
  const jwt = buildJwt(method, fullPath);
  const url = `${COINBASE_API_BASE}${fullPath}`;

  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
      "CB-VERSION": "2024-07-09",
    },
  };
  if (body && method !== "GET") {
    init.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, init);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: "Coinbase API unreachable", detail: String(err) }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path") ?? "/accounts";
  return proxyToCoinbase("GET", path);
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path") ?? "/orders";
  const body = await req.json().catch(() => ({}));
  return proxyToCoinbase("POST", path, body);
}
