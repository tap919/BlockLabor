/**
 * Vite middleware plugin that exposes BlockLabor's Supabase data as a
 * small JSON HTTP API. This is the surface that AgentBrowser's
 * `callBlocklabor()` helper hits when orchestrating labor workflows.
 *
 * Routes (all under /api/labor):
 *   GET    /jobs                       -> list jobs (filterable)
 *   GET    /jobs/:id                   -> fetch one job
 *   GET    /workers                    -> list candidate worker profiles
 *   GET    /workers/:id                -> fetch one worker
 *   POST   /jobs/:id/rank              -> rank top-K workers for a job
 *   POST   /verification/business-identity  -> trigger Aetherdesk call
 *   POST   /verification/ghost-job-audit    -> trigger Aetherdesk call
 *   POST   /verification/application-sla-breach -> trigger Aetherdesk call
 *   GET    /health                     -> service liveness probe
 *
 * The matching endpoint reuses the same scoring formula as BlockLabor's
 * UI filters (vertical + location + skills overlap + tier weight) so
 * orchestrator-side ranking stays consistent with what the dispatcher
 * already shows humans.
 */
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface LaborApiOptions {
  aetherdeskUrl: string;
  aetherdeskApiKey: string;
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function getQueryParams(req: IncomingMessage): Record<string, string> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? (JSON.parse(text) as Record<string, unknown>) : {});
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
    req.on('error', reject);
  });
}

async function triggerAetherdesk(
  endpoint: string,
  body: Record<string, unknown>,
  options: LaborApiOptions,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const url = `${options.aetherdeskUrl.replace(/\/$/, '')}/api/v1/verification/${endpoint}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.aetherdeskApiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* leave as text */ }
    return { ok: res.ok, status: res.status, body: parsed };
  } catch (err) {
    return { ok: false, status: 502, body: { error: err instanceof Error ? err.message : 'unknown' } };
  }
}

/**
 * Rank top-K workers for a job using a transparent score:
 *   score = vertical_match * 30 + skills_overlap * 25 + location_match * 15 + trust_tier * 15 + availability * 15
 * Pure JS so it runs without extra dependencies. Real production should
 * delegate to reporank (see Phase 3).
 */
function rankWorkersForJob(
  job: { id: string; vertical: string; requiredSkills: string[] | null; stateCode: string | null; businessName: string },
  workers: Array<{
    id: string;
    name: string;
    skills: string[] | null;
    verticals: string[] | null;
    stateCode: string | null;
    reliabilityScore: number | null;
    backgroundCheckStatus: string | null;
    workerVerificationStatus: string | null;
  }>,
  topK: number,
): Array<{ workerId: string; name: string; score: number; breakdown: Record<string, number> }> {
  const required = (job.requiredSkills ?? []).map(s => s.toLowerCase());
  return workers
    .map(w => {
      const wskills = (w.skills ?? []).map(s => s.toLowerCase());
      const overlap = required.filter(s => wskills.includes(s)).length;
      const skillsScore = required.length === 0 ? 25 : Math.round((overlap / required.length) * 25);
      const verticalScore = (w.verticals ?? []).includes(job.vertical) ? 30 : 0;
      const locationScore = w.stateCode && job.stateCode && w.stateCode === job.stateCode ? 15 : 0;
      const tierScore = w.workerVerificationStatus === 'verified' ? 15
        : w.workerVerificationStatus === 'pending' ? 8 : 0;
      const reliability = w.reliabilityScore ?? 0;
      const availabilityScore = Math.round((reliability / 100) * 15);
      const total = verticalScore + skillsScore + locationScore + tierScore + availabilityScore;
      return {
        workerId: w.id,
        name: w.name,
        score: total,
        breakdown: {
          vertical: verticalScore,
          skills: skillsScore,
          location: locationScore,
          trust_tier: tierScore,
          availability: availabilityScore,
        },
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export function laborApiPlugin(options: LaborApiOptions): Plugin {
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY ?? '';
  let supabase: SupabaseClient | null = null;
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });
  }

  return {
    name: 'blocklabor-labor-api',
    configureServer(server) {
      server.middlewares.use('/api/labor', async (req, res, next) => {
        try {
          const url = new URL(req.url ?? '/', 'http://localhost');
          // Strip the /api/labor prefix so the rest of the handler can
          // dispatch on the remaining path segments.
          const path = url.pathname.replace(/^\/api\/labor/, '') || '/';
          const params = getQueryParams(req);

          // GET /api/labor/health
          if (req.method === 'GET' && path === '/health') {
            return sendJson(res, 200, {
              ok: true,
              service: 'blocklabor',
              supabase: !!supabase,
              aetherdesk: !!options.aetherdeskUrl,
              ts: new Date().toISOString(),
            });
          }

          if (!supabase) {
            return sendJson(res, 503, {
              error: 'supabase_not_configured',
              detail: 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env',
            });
          }

          // GET /api/labor/jobs
          if (req.method === 'GET' && path === '/jobs') {
            let q = supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(200);
            if (params.status) q = q.eq('status', params.status);
            if (params.vertical) q = q.eq('vertical', params.vertical);
            const { data, error } = await q;
            if (error) return sendJson(res, 500, { error: error.message });
            return sendJson(res, 200, { jobs: data ?? [] });
          }

          // POST /api/labor/jobs — receive jobs from Aetherdesk or other services
          if (req.method === 'POST' && path === '/jobs') {
            const body = await readJsonBody(req);
            const title = String(body.title ?? '').trim();
            const description = String(body.description ?? '').trim();
            if (!title || !description) {
              return sendJson(res, 400, { error: 'title and description are required' });
            }
            const insertPayload: Record<string, unknown> = {
              title,
              description,
              vertical: body.vertical ?? 'general',
              required_skills: body.skills ?? [],
              pay_rate: body.pay_rate ?? null,
              duration: body.duration ?? 'temp',
              status: 'open',
              source: body.source ?? 'direct',
              tenant_id: body.tenant_id ?? null,
              business_name: body.business_name ?? null,
              state_code: body.state_code ?? null,
              verification_status: 'unverified',
            };
            const { data, error } = await supabase
              .from('jobs')
              .insert(insertPayload)
              .select()
              .single();
            if (error) return sendJson(res, 500, { error: error.message });
            return sendJson(res, 201, { job: data });
          }

          // GET /api/labor/jobs/:id
          const jobMatch = path.match(/^\/jobs\/([^/]+)$/);
          if (req.method === 'GET' && jobMatch) {
            const { data, error } = await supabase
              .from('jobs').select('*').eq('id', jobMatch[1]).single();
            if (error) return sendJson(res, error.code === 'PGRST116' ? 404 : 500, { error: error.message });
            return sendJson(res, 200, { job: data });
          }

          // POST /api/labor/jobs/:id/rank
          const rankMatch = path.match(/^\/jobs\/([^/]+)\/rank$/);
          if (req.method === 'POST' && rankMatch) {
            const jobId = rankMatch[1];
            const body = await readJsonBody(req);
            const topK = Math.max(1, Math.min(50, Number(body.topK ?? 5)));

            const { data: job, error: jobErr } = await supabase
              .from('jobs').select('*').eq('id', jobId).single();
            if (jobErr) return sendJson(res, 404, { error: jobErr.message });

            const { data: workers, error: wErr } = await supabase
              .from('candidates')
              .select('id,name,skills,verticals,state_code,reliability_score,background_check_status,worker_verification_status')
              .in('status', ['active', 'onboarded'])
              .limit(500);
            if (wErr) return sendJson(res, 500, { error: wErr.message });

            const ranked = rankWorkersForJob(
              {
                id: job.id,
                vertical: job.vertical,
                requiredSkills: job.required_skills ?? [],
                stateCode: job.state_code ?? null,
                businessName: job.business_name ?? '',
              },
              (workers ?? []).map(w => ({
                id: w.id,
                name: w.name,
                skills: w.skills,
                verticals: w.verticals,
                stateCode: w.state_code,
                reliabilityScore: w.reliability_score,
                backgroundCheckStatus: w.background_check_status,
                workerVerificationStatus: w.worker_verification_status,
              })),
              topK,
            );
            return sendJson(res, 200, { jobId, topK, candidates: ranked });
          }

          // GET /api/labor/workers
          if (req.method === 'GET' && path === '/workers') {
            let q = supabase.from('candidates').select('*').limit(500);
            if (params.vertical) q = q.contains('verticals', [params.vertical]);
            if (params.state) q = q.eq('state_code', params.state);
            if (params.status) q = q.eq('status', params.status);
            const { data, error } = await q;
            if (error) return sendJson(res, 500, { error: error.message });
            return sendJson(res, 200, { workers: data ?? [] });
          }

          // GET /api/labor/workers/:id
          const workerMatch = path.match(/^\/workers\/([^/]+)$/);
          if (req.method === 'GET' && workerMatch) {
            const { data, error } = await supabase
              .from('candidates').select('*').eq('id', workerMatch[1]).single();
            if (error) return sendJson(res, error.code === 'PGRST116' ? 404 : 500, { error: error.message });
            return sendJson(res, 200, { worker: data });
          }

          // POST /api/labor/verification/business-identity
          if (req.method === 'POST' && path === '/verification/business-identity') {
            const body = await readJsonBody(req);
            const result = await triggerAetherdesk('business-identity', body, options);
            return sendJson(res, result.ok ? 200 : result.status, result.body);
          }
          if (req.method === 'POST' && path === '/verification/ghost-job-audit') {
            const body = await readJsonBody(req);
            const result = await triggerAetherdesk('ghost-job-audit', body, options);
            return sendJson(res, result.ok ? 200 : result.status, result.body);
          }
          if (req.method === 'POST' && path === '/verification/application-sla-breach') {
            const body = await readJsonBody(req);
            const result = await triggerAetherdesk('application-sla-breach', body, options);
            return sendJson(res, result.ok ? 200 : result.status, result.body);
          }

          return sendJson(res, 404, {
            error: 'route_not_found',
            method: req.method,
            path,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Internal error';
          return sendJson(res, 500, { error: msg });
        }
      });
    },
  };
}
