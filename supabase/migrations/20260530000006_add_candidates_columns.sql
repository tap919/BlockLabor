-- Migration: Add missing columns to candidates table
-- These columns are referenced in edge functions (accounting, payroll, checkr, dropbox-sign)
-- and TypeScript types but absent from the init_schema migration

ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS vendor_id TEXT;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS background_check_id TEXT;
