CREATE TABLE IF NOT EXISTS public.integration_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  external_id     TEXT,
  object_type     TEXT,
  object_id       UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending',
  payload         JSONB,
  attempts        INTEGER DEFAULT 0,
  last_error      TEXT,
  last_webhook_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY integration_events_select_policy ON public.integration_events
  FOR SELECT
  USING (current_user_role() IN ('owner', 'recruiter', 'scheduler', 'payroll'));

CREATE POLICY integration_events_insert_policy ON public.integration_events
  FOR INSERT
  WITH CHECK (current_user_role() IN ('owner', 'recruiter', 'scheduler', 'payroll'));
