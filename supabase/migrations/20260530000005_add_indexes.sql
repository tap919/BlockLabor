-- Migration: Add indexes for high-frequency query columns

-- Jobs: status is filtered constantly in scheduler views
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs (status);

-- Candidates: email lookup for auth and deduplication
CREATE INDEX IF NOT EXISTS idx_candidates_email ON public.candidates (email);

-- Integration events: provider + external_id is the idempotency lookup key
CREATE INDEX IF NOT EXISTS idx_integration_events_provider_external
  ON public.integration_events (provider, external_id);

-- Integration events: object_id for reverse lookups from candidates/jobs
CREATE INDEX IF NOT EXISTS idx_integration_events_object
  ON public.integration_events (object_type, object_id);

-- System logs: category for filtered views
CREATE INDEX IF NOT EXISTS idx_system_logs_category ON public.system_logs (category);

-- System logs: created_at for time-range queries
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs (created_at);

-- Users: email for login lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);

-- Users: role for RLS function performance
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users (role);
