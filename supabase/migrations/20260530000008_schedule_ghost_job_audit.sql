-- Migration: Schedule Ghost-Job Audit Cron (every 3 days)
-- Invokes the 'ghost-job-audit' Supabase Edge Function which calls
-- Aetherdesk's /api/v1/verification/ghost-job-audit endpoint for any
-- job that has been active for 3+ days.

-- Enable pg_cron extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net for HTTP calls from inside Postgres (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the ghost-job audit every 3 days at 02:00 UTC
SELECT cron.schedule(
  'ghost-job-audit-every-3-days',
  '0 2 */3 * *',
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/ghost-job-audit',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object('triggered_by', 'cron', 'triggered_at', now())
    ) AS request_id;
  $$
);
