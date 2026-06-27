-- Migration: Add businesses table for verified employer identity
-- Connects BlockLabor's job postings to a real business record with
-- phone, EIN, and trust tier. Required by Aetherdesk-driven
-- verification flows (ghost-job audit, business identity, SLA alerts)
-- so we can resolve a real outbound phone instead of falling back to
-- OVERLAY365_DEFAULT_AUDIT_PHONE.

CREATE TABLE IF NOT EXISTS public.businesses (
  id               TEXT PRIMARY KEY,
  legal_name       TEXT NOT NULL,
  ein              TEXT,
  state_code       TEXT,
  business_phone   TEXT,
  contact_email    TEXT,
  trust_tier       INTEGER DEFAULT 1,
  verification_status TEXT DEFAULT 'pending',
  verified_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_businesses_phone ON public.businesses (business_phone);
CREATE INDEX IF NOT EXISTS idx_businesses_trust_tier ON public.businesses (trust_tier);
CREATE INDEX IF NOT EXISTS idx_businesses_verification_status
  ON public.businesses (verification_status);

-- Add business_id FK to jobs so we can resolve a real phone for verification.
-- (Nullable for backward compatibility with existing rows.)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS business_id TEXT REFERENCES public.businesses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_business_id ON public.jobs (business_id);
