-- OTM Agent Database Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/negtslsunwlblmynzitq/sql

-- OTM Accounts (encrypted credentials)
CREATE TABLE IF NOT EXISTS otm_accounts (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  platform TEXT NOT NULL,
  username TEXT,
  email TEXT,
  encrypted_credentials TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  last_used TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- OTM Withdrawals
CREATE TABLE IF NOT EXISTS otm_withdrawals (
  id TEXT PRIMARY KEY,
  config_id TEXT,
  destination TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  fee DECIMAL(12,2) DEFAULT 0,
  net_amount DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  method TEXT DEFAULT 'manual',
  platform_source TEXT,
  job_ids TEXT[],
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  reference_id TEXT,
  notes TEXT,
  error TEXT
);

-- OTM Payout Config (encrypted)
CREATE TABLE IF NOT EXISTS otm_payout_config (
  id TEXT PRIMARY KEY,
  destination TEXT NOT NULL,
  label TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  encrypted_config TEXT NOT NULL,
  auto_withdraw BOOLEAN DEFAULT false,
  min_withdrawal DECIMAL(10,2) DEFAULT 100,
  withdrawal_percent DECIMAL(5,2) DEFAULT 0.8,
  max_withdrawal DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- OTM Jobs
CREATE TABLE IF NOT EXISTS otm_jobs (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  external_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  pay_amount DECIMAL(10,2) NOT NULL,
  pay_currency TEXT DEFAULT 'USD',
  pay_type TEXT,
  estimated_hours DECIMAL(6,2),
  required_skills TEXT[],
  client_rating DECIMAL(3,2),
  posted_at TIMESTAMPTZ,
  deadline TIMESTAMPTZ,
  url TEXT,
  status TEXT DEFAULT 'discovered',
  accepted_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  earned_amount DECIMAL(10,2) DEFAULT 0,
  platform_fee DECIMAL(10,2) DEFAULT 0,
  net_earnings DECIMAL(10,2) DEFAULT 0,
  deliverable_type TEXT,
  deliverable_summary TEXT,
  ai_model TEXT,
  tokens_used INTEGER DEFAULT 0,
  ai_cost DECIMAL(10,4) DEFAULT 0,
  fail_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  logs JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- OTM Earnings
CREATE TABLE IF NOT EXISTS otm_earnings (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  platform TEXT NOT NULL,
  job_id TEXT,
  gross DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) DEFAULT 0,
  ai_cost DECIMAL(10,4) DEFAULT 0,
  net DECIMAL(10,2) NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- OTM Settings
CREATE TABLE IF NOT EXISTS otm_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_otm_accounts_platform ON otm_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_otm_accounts_type ON otm_accounts(type);
CREATE INDEX IF NOT EXISTS idx_otm_withdrawals_status ON otm_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_otm_withdrawals_initiated ON otm_withdrawals(initiated_at DESC);
CREATE INDEX IF NOT EXISTS idx_otm_jobs_platform ON otm_jobs(platform);
CREATE INDEX IF NOT EXISTS idx_otm_jobs_status ON otm_jobs(status);
CREATE INDEX IF NOT EXISTS idx_otm_earnings_date ON otm_earnings(date DESC);
CREATE INDEX IF NOT EXISTS idx_otm_earnings_platform ON otm_earnings(platform);

-- Insert default CashApp payout config
INSERT INTO otm_payout_config (id, destination, label, enabled, encrypted_config, auto_withdraw, min_withdrawal, withdrawal_percent)
VALUES (
  'cashapp_default',
  'cashapp',
  'CashApp (default)',
  false,
  '{"cashtag": "$CHANGEME"}',
  true,
  50,
  0.8
) ON CONFLICT (id) DO NOTHING;

SELECT 'OTM Database schema created successfully!' as result;
