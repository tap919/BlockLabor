-- Seed data for development
-- Branches
INSERT INTO branches (id, name, city, manager, margin_target) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Dallas Logistics', 'Dallas', 'Marcus J.', 18.5),
  ('00000000-0000-0000-0000-000000000002', 'Houston East', 'Houston', 'Sonia K.', 20.0),
  ('00000000-0000-0000-0000-000000000003', 'Austin Central', 'Austin', 'Luis R.', 17.0)
ON CONFLICT (id) DO NOTHING;

-- Rate Cards
INSERT INTO rate_cards (id, vertical, category, standard_bill_rate, standard_pay_rate, custom_client_markup_percent) VALUES
  ('00000000-0000-0000-0000-000000000011', 'Light Industrial', 'Warehouse Packing', 32.50, 25.00, 30.00),
  ('00000000-0000-0000-0000-000000000012', 'Healthcare', 'Nursing Assistant (CNA) Support', 31.25, 23.75, 31.50),
  ('00000000-0000-0000-0000-000000000013', 'Events', 'Event Ticket Scanner', 32.50, 25.00, 30.00),
  ('00000000-0000-0000-0000-000000000014', 'Skilled Trades', 'Electrical Helper', 55.00, 40.00, 37.50),
  ('00000000-0000-0000-0000-000000000015', 'Hospitality', 'Line Cook', 28.00, 22.00, 27.27)
ON CONFLICT (id) DO NOTHING;

-- Partner Vendors
INSERT INTO partner_vendors (id, name, contact_name, email, phone, verticals, markup_share, status) VALUES
  ('00000000-0000-0000-0000-000000000021', 'StaffPro Solutions', 'Alice Chen', 'alice@staffpro.com', '555-0101', ARRAY['Light Industrial', 'Warehouse'], 0.15, 'active'),
  ('00000000-0000-0000-0000-000000000022', 'MedStaff Partners', 'Bob Williams', 'bob@medstaff.com', '555-0102', ARRAY['Healthcare'], 0.12, 'active'),
  ('00000000-0000-0000-0000-000000000023', 'EventForce Staffing', 'Carol Davis', 'carol@eventforce.com', '555-0103', ARRAY['Events', 'Hospitality'], 0.18, 'active')
ON CONFLICT (id) DO NOTHING;

-- Candidates
INSERT INTO candidates (id, name, email, phone, skills, verticals, status, background_check_status, e_sign_status, total_earned, state_code) VALUES
  ('00000000-0000-0000-0000-000000000031', 'Elena Torres', 'elena.t@email.com', '555-1001', ARRAY['Forklift Certified', 'Barcode Scanning', 'Lifting 50lbs'], ARRAY['Light Industrial'], 'active', 'passed', 'signed', 4850.00, 'TX'),
  ('00000000-0000-0000-0000-000000000032', 'Jamal Wright', 'jamal.w@email.com', '555-1002', ARRAY['CNA License', 'HIPAA Certified', 'BLS certified', 'Patient Transport'], ARRAY['Healthcare'], 'active', 'passed', 'signed', 7200.00, 'TX'),
  ('00000000-0000-0000-0000-000000000033', 'Sarah Kim', 'sarah.k@email.com', '555-1003', ARRAY['Customer Service', 'Smartphone scanning', 'Crowd Management'], ARRAY['Events', 'Hospitality'], 'active', 'passed', 'signed', 3100.00, 'TX'),
  ('00000000-0000-0000-0000-000000000034', 'Mike O''Brien', 'mike.o@email.com', '555-1004', ARRAY['Electrical License', 'OSHA Certified', 'Blueprint Reading'], ARRAY['Skilled Trades'], 'onboarded', 'passed', 'sent', 12500.00, 'TX'),
  ('00000000-0000-0000-0000-000000000035', 'Priya Patel', 'priya.p@email.com', '555-1005', ARRAY['Food Handler', 'Knife Skills', 'ServSafe Certified'], ARRAY['Hospitality'], 'screening', 'pending', 'unsigned', 1800.00, 'TX')
ON CONFLICT (id) DO NOTHING;

-- Jobs
INSERT INTO jobs (id, business_name, vertical, category, block_type, status, payout, charge, bill_rate, pay_rate, markup, headcount, state_code, branch_name, recruiter_name) VALUES
  ('00000000-0000-0000-0000-000000000041', 'Apex Materials Inc', 'Light Industrial', 'Warehouse Packing', '4-hour', 'open', 100, 130, 32.50, 25.00, 30, 2, 'TX', 'Dallas Logistics', 'Sonia K.'),
  ('00000000-0000-0000-0000-000000000042', 'Summit General Hospital', 'Healthcare', 'Nursing Assistant (CNA) Support', '8-hour', 'open', 190, 250, 31.25, 23.75, 31.5, 1, 'TX', 'Houston East', 'David L.'),
  ('00000000-0000-0000-0000-000000000043', 'Vanguard Events Corp', 'Events', 'Event Ticket Scanner', '4-hour', 'accepted', 100, 130, 32.50, 25.00, 30, 3, 'TX', 'Dallas Logistics', 'Sonia K.'),
  ('00000000-0000-0000-0000-000000000044', 'BuildRight Construction', 'Skilled Trades', 'Electrical Helper', '8-hour', 'open', 320, 440, 55.00, 40.00, 37.5, 1, 'TX', 'Austin Central', 'Luis R.'),
  ('00000000-0000-0000-0000-000000000045', 'Highline Hospitality', 'Hospitality', 'Line Cook', '4-hour', 'completed', 88, 112, 28.00, 22.00, 27.27, 2, 'TX', 'Houston East', 'David L.')
ON CONFLICT (id) DO NOTHING;

-- Integrations
INSERT INTO integrations (id, name, category, status, last_sync) VALUES
  ('00000000-0000-0000-0000-000000000051', 'QuickBooks', 'accounting', 'disconnected', NULL),
  ('00000000-0000-0000-0000-000000000052', 'Gusto', 'payroll', 'disconnected', NULL),
  ('00000000-0000-0000-0000-000000000053', 'DocuSign', 'signature', 'connected', NOW()),
  ('00000000-0000-0000-0000-000000000054', 'Checkr', 'background_checks', 'disconnected', NULL),
  ('00000000-0000-0000-0000-000000000055', 'Indeed', 'job_boards', 'connected', NOW())
ON CONFLICT (id) DO NOTHING;

-- Incident Reports
INSERT INTO incident_reports (id, business_name, contractor_name, category, severity, description, status) VALUES
  ('00000000-0000-0000-0000-000000000061', 'Apex Materials Inc', 'Elena Torres', 'safety', 'low', 'Missing safety goggles on warehouse floor. Resolved on-site.', 'resolved'),
  ('00000000-0000-0000-0000-000000000062', 'Vanguard Events Corp', 'Sarah Kim', 'dispute', 'medium', 'Disagreement over shift end time between worker and site manager.', 'under_review')
ON CONFLICT (id) DO NOTHING;
