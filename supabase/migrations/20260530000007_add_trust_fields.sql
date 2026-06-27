-- Migration: Add trust fields for Truth-Verified Labor Exchange
-- Adds trust_tier to public.users (for both clients/employers and workers)
-- Adds verification_status and application_response_sla to public.jobs
-- Adds worker_verification_status to public.candidates

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trust_tier INTEGER DEFAULT 1;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS application_response_sla TIMESTAMPTZ;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS worker_verification_status TEXT DEFAULT 'pending';
