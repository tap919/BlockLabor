-- Migration: Schedule Application SLA Breach Cron (every 6 hours)
-- Monitors jobs whose application_response_sla has passed without a hire
-- decision and notifies the employer via Aetherdesk outbound call.

SELECT cron.schedule(
  'application-sla-monitor-every-6h',
  '0 */6 * * *',
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/application-sla-monitor',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object('triggered_by', 'cron', 'triggered_at', now())
    ) AS request_id;
  $$
);
