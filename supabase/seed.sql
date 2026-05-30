INSERT INTO candidates (
    id, name, email, phone, skills, verticals, total_earned, status, 
    background_check_status, esign_status, verified_credentials, weekly_availability, 
    shift_preferences, pay_option, profile_updated, state_code, recruiter_name, 
    branch_name, performance_score, time_to_onboard_days, no_show_count, 
    is_redeployed, documents, messages, reliability_score, attendance_rate, 
    punctuality_rate, completion_rate, client_rating_class
) VALUES (
    'c-001', 'Marcus Hayes', 'marcus.hayes@contractor.test', '(555) 438-9011', 
    '["OSHA Driving", "Heavy Lifting", "Data Typing"]'::jsonb, 
    '["Light Industrial", "Clerical", "Events"]'::jsonb, 
    3450, 'active', 'passed', 'signed', 
    '["forklift_cert", "heavy_lifting_waiver", "typing_speed"]'::jsonb, 
    '{"Monday": true, "Tuesday": true, "Wednesday": true, "Thursday": true, "Friday": true, "Saturday": false, "Sunday": false}'::jsonb, 
    '["morning", "afternoon"]'::jsonb, 'direct_deposit', true, 'CA', 'Sonia K.', 
    'San Francisco Main', 94, 4, 0, true, 
    '[]'::jsonb, '[]'::jsonb, 98, 100, 97, 100, 'A+'
);
