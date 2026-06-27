/**
 * GET /api/marketing?action=probe|contacts|deals
 *
 * Probes and fetches data from real marketing services.
 * Returns honest errors when services are not running — no fake data.
 *
 * Services:
 *   mautic  — localhost:8880  (Marketing automation + email campaigns)
 *   twenty  — localhost:3030  (Twenty CRM)
 *   sd      — localhost:7860  (Stable Diffusion)
 *   mp      — localhost:8501  (MoneyPrinter Turbo)
 *
 * Routes:
 *   GET /api/marketing?action=probe&service=mautic|twenty|sd|mp
 *   GET /api/marketing/contacts    — Mautic contacts
 *   GET /api/marketing/deals       — Twenty CRM deals (opportunities)
 */
import { NextRequest, NextResponse } from "next/server";

const MAUTIC_URL = process.env.MAUTIC_URL ?? "http://localhost:8880";
const TWENTY_URL = process.env.TWENTY_URL ?? "http://localhost:3030";
const SD_URL = process.env.SD_URL ?? "http://localhost:7860";
const MP_URL = process.env.MP_URL ?? "http://localhost:8501";

const MAUTIC_USER = process.env.MAUTIC_USER ?? "";
const MAUTIC_PASS = process.env.MAUTIC_PASS ?? "";
const TWENTY_API_KEY = process.env.TWENTY_API_KEY ?? "";

async function probeUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000), method: "HEAD" });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const service = searchParams.get("service");

  // --- Probe a specific service ---
  if (action === "probe" && service) {
    const urlMap: Record<string, string> = {
      mautic: `${MAUTIC_URL}/s/login`,
      twenty: `${TWENTY_URL}/api/health`,
      sd: `${SD_URL}/internal/sysinfo`,
      mp: MP_URL,
    };
    const target = urlMap[service];
    if (!target) return NextResponse.json({ error: `Unknown service: ${service}` }, { status: 400 });
    const online = await probeUrl(target);
    return NextResponse.json({ service, online, url: target.split("/").slice(0, 3).join("/") });
  }

  // --- Mautic contacts ---
  if (action === "contacts") {
    if (!MAUTIC_USER || !MAUTIC_PASS) {
      return NextResponse.json(
        { contacts: [], error: "Mautic credentials not configured", hint: "Set MAUTIC_USER and MAUTIC_PASS in .env.local" },
        { status: 503 },
      );
    }
    try {
      const basic = Buffer.from(`${MAUTIC_USER}:${MAUTIC_PASS}`).toString("base64");
      const res = await fetch(`${MAUTIC_URL}/api/contacts?limit=100&orderBy=lastActive&orderByDir=desc`, {
        headers: { Authorization: `Basic ${basic}`, Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        return NextResponse.json({ contacts: [], error: `Mautic returned ${res.status}` }, { status: res.status });
      }
      const raw = await res.json();
      const contacts = Object.values(raw.contacts ?? {}).map((c: unknown) => {
        const ct = c as Record<string, unknown>;
        const fields = (ct.fields as Record<string, Record<string, unknown>>)?.all ?? {};
        return {
          id: String(ct.id ?? ""),
          firstName: String(fields.firstname ?? ""),
          lastName: String(fields.lastname ?? ""),
          email: String(fields.email ?? ""),
          score: Number(ct.points ?? 0),
          lastActive: String(ct.lastActive ?? ct.dateAdded ?? ""),
          tags: ((ct.tags as Array<{ tag: string }>) ?? []).map((t) => t.tag),
        };
      });
      return NextResponse.json({ contacts });
    } catch (err) {
      return NextResponse.json({ contacts: [], error: "Mautic not reachable", detail: String(err) }, { status: 503 });
    }
  }

  // --- Twenty CRM deals (opportunities) ---
  if (action === "deals") {
    if (!TWENTY_API_KEY) {
      return NextResponse.json(
        { deals: [], error: "Twenty CRM API key not configured", hint: "Set TWENTY_API_KEY in .env.local — find it at localhost:3030/settings/api" },
        { status: 503 },
      );
    }
    try {
      const res = await fetch(`${TWENTY_URL}/api/opportunities`, {
        headers: { Authorization: `Bearer ${TWENTY_API_KEY}`, Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        return NextResponse.json({ deals: [], error: `Twenty CRM returned ${res.status}` }, { status: res.status });
      }
      const raw = await res.json();
      const edges: Array<{ node: Record<string, unknown> }> = raw.data?.opportunities?.edges ?? [];
      const deals = edges.map(({ node }) => ({
        id: String(node.id ?? ""),
        name: String(node.name ?? ""),
        stage: String(node.stage ?? "Unknown"),
        amount: Number((node.amount as Record<string, number>)?.amountMicros ?? 0) / 1_000_000,
        probability: Number(node.probability ?? 0),
        company: String((node.company as Record<string, string>)?.name ?? ""),
        updatedAt: String(node.updatedAt ?? node.createdAt ?? ""),
      }));
      return NextResponse.json({ deals });
    } catch (err) {
      return NextResponse.json({ deals: [], error: "Twenty CRM not reachable", detail: String(err) }, { status: 503 });
    }
  }

  return NextResponse.json({ error: "Missing ?action=probe|contacts|deals" }, { status: 400 });
}
