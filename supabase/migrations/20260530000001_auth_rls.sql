-- Migration: Add role_permissions and enable RLS
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name             TEXT NOT NULL UNIQUE,
  can_edit_rate_cards   BOOLEAN DEFAULT false,
  can_approve_payroll   BOOLEAN DEFAULT false,
  can_verify_docs       BOOLEAN DEFAULT false,
  can_deploy_dispatches BOOLEAN DEFAULT false,
  can_manage_branches   BOOLEAN DEFAULT false
);

-- Seed default role permissions
INSERT INTO role_permissions (role_name, can_edit_rate_cards, can_approve_payroll, can_verify_docs, can_deploy_dispatches, can_manage_branches)
VALUES
  ('owner', true, true, true, true, true),
  ('recruiter', false, false, true, true, false),
  ('scheduler', false, false, false, true, false),
  ('payroll', false, true, false, false, false),
  ('client', false, false, false, false, false),
  ('worker', false, false, false, false, false)
ON CONFLICT (role_name) DO NOTHING;

-- Enable RLS on all tables
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sso_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE SQL STABLE
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.users WHERE id = auth.uid()::text),
    'anonymous'
  );
$$;

-- RLS Policies
CREATE POLICY jobs_select_policy ON public.jobs
  FOR SELECT USING (
    current_user_role() IN ('owner', 'recruiter', 'scheduler', 'payroll')
    OR (current_user_role() = 'worker' AND contractor_id = auth.uid()::uuid)
    OR (current_user_role() = 'client' AND recruiter_id = auth.uid()::uuid)
  );

CREATE POLICY jobs_insert_policy ON public.jobs
  FOR INSERT WITH CHECK (
    current_user_role() IN ('owner', 'recruiter', 'scheduler', 'client')
  );

CREATE POLICY jobs_update_policy ON public.jobs
  FOR UPDATE USING (
    current_user_role() IN ('owner', 'recruiter', 'scheduler', 'payroll')
  );

CREATE POLICY candidates_select_policy ON public.candidates
  FOR SELECT USING (
    current_user_role() IN ('owner', 'recruiter', 'scheduler', 'payroll')
    OR id = auth.uid()::uuid
  );

CREATE POLICY candidates_update_policy ON public.candidates
  FOR UPDATE USING (
    current_user_role() IN ('owner', 'recruiter', 'scheduler')
    OR id = auth.uid()::uuid
  );

CREATE POLICY incidents_select_policy ON public.incident_reports
  FOR SELECT USING (
    current_user_role() IN ('owner', 'recruiter', 'scheduler')
    OR contractor_id = auth.uid()::uuid
  );

CREATE POLICY incidents_insert_policy ON public.incident_reports
  FOR INSERT WITH CHECK (current_user_role() IN ('owner', 'recruiter', 'scheduler', 'worker', 'client'));

CREATE POLICY admin_all_policy ON public.branches
  USING (current_user_role() IN ('owner'));

CREATE POLICY admin_all_policy ON public.rate_cards
  USING (current_user_role() IN ('owner'));

CREATE POLICY admin_all_policy ON public.sso_config
  USING (current_user_role() IN ('owner'));

CREATE POLICY admin_all_policy ON public.integrations
  USING (current_user_role() IN ('owner'));

CREATE POLICY admin_all_policy ON public.role_permissions
  USING (current_user_role() IN ('owner'));

CREATE POLICY vendors_select_policy ON public.partner_vendors
  FOR SELECT USING (current_user_role() IN ('owner', 'recruiter', 'scheduler', 'payroll'));

CREATE POLICY vendors_insert_policy ON public.partner_vendors
  FOR INSERT WITH CHECK (current_user_role() IN ('owner'));

CREATE POLICY vendors_update_policy ON public.partner_vendors
  FOR UPDATE USING (current_user_role() IN ('owner'));

CREATE POLICY logs_select_policy ON public.system_logs
  FOR SELECT USING (current_user_role() IN ('owner', 'recruiter', 'scheduler', 'payroll'));

-- RLS for users table (missing from original migration)
CREATE POLICY users_select_policy ON public.users
  FOR SELECT USING (current_user_role() IN ('owner', 'recruiter', 'scheduler', 'payroll'));

CREATE POLICY users_insert_policy ON public.users
  FOR INSERT WITH CHECK (current_user_role() IN ('owner'));

CREATE POLICY users_update_policy ON public.users
  FOR UPDATE USING (current_user_role() IN ('owner'));
