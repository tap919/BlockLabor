-- Migration: Create 8 missing tables referenced by RLS policies, audit triggers, and application code
-- These tables are already referenced in 000001_auth_rls.sql and 000002_audit_triggers.sql

CREATE TABLE IF NOT EXISTS public.system_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category   TEXT,
  type       TEXT,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.users (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  name       TEXT,
  full_name  TEXT,
  role       TEXT NOT NULL,
  branch_id  TEXT,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.branches (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  city                 TEXT NOT NULL,
  manager              TEXT NOT NULL,
  margin_target        NUMERIC,
  active_jobs_count    INTEGER DEFAULT 0,
  active_workers_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.rate_cards (
  id                          TEXT PRIMARY KEY,
  vertical                    TEXT NOT NULL,
  category                    TEXT NOT NULL,
  standard_bill_rate          NUMERIC NOT NULL,
  standard_pay_rate           NUMERIC NOT NULL,
  custom_client_markup_percent NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS public.sso_config (
  id                     TEXT PRIMARY KEY,
  provider               TEXT,
  domain                 TEXT,
  enabled                BOOLEAN DEFAULT false,
  active_directory_group TEXT,
  last_sync_date         TIMESTAMPTZ,
  role_mapping           JSONB
);

CREATE TABLE IF NOT EXISTS public.partner_vendors (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  contact_name        TEXT,
  email               TEXT,
  phone               TEXT,
  verticals           JSONB,
  markup_share        NUMERIC,
  status              TEXT,
  assigned_jobs_count INTEGER DEFAULT 0,
  insurance_expiry    TEXT,
  tax_id              TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.incident_reports (
  id               TEXT PRIMARY KEY,
  business_name    TEXT NOT NULL,
  job_id           TEXT,
  contractor_id    TEXT,
  contractor_name  TEXT,
  reported_by      TEXT,
  category         TEXT,
  severity         TEXT,
  description      TEXT,
  status           TEXT,
  resolution_notes TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.integrations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT,
  status      TEXT,
  api_key     TEXT,
  webhook_url TEXT,
  last_sync   TIMESTAMPTZ
);