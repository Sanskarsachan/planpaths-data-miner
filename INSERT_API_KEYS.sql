-- Insert 4 Gemini API Keys into api_keys table
-- Copy and paste this into Supabase SQL Editor: https://app.supabase.com/project/YOUR_PROJECT/sql
-- Then click Run to insert these keys

INSERT INTO api_keys (
  id,
  key,
  nickname,
  provider,
  created_at,
  updated_at,
  is_active,
  is_deleted,
  quota_limit,
  total_requests_today,
  quota_reset_at
)
VALUES
  (
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    'AIzaSyBmpu3EEGThCVVb1RKTIpahoMNxCpIGD5o',
    'API1001',
    'gemini',
    '2026-02-10T17:28:02.648+00:00',
    '2026-02-10T17:28:02.648+00:00',
    true,
    false,
    20,
    0,
    now() + interval '1 day'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440002'::uuid,
    'AIzaSyCalCi-sd7CARrp-msZ8tJkNNxkawad4BI',
    'API1002',
    'gemini',
    '2026-02-10T17:28:03.054+00:00',
    '2026-02-10T17:28:03.054+00:00',
    true,
    false,
    20,
    0,
    now() + interval '1 day'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440003'::uuid,
    'AIzaSyASgyn9KJezJzu0rXTRIUgvsC2ZDhekAfY',
    'API1003',
    'gemini',
    '2026-02-10T17:28:03.429+00:00',
    '2026-02-10T17:28:03.429+00:00',
    true,
    false,
    20,
    0,
    now() + interval '1 day'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440004'::uuid,
    'AIzaSyCkqmf5dSNjKSDT-HSN7HOX1dzIZMsi-Ss',
    'API1004',
    'gemini',
    '2026-02-10T17:28:03.817+00:00',
    '2026-02-10T17:28:03.817+00:00',
    true,
    false,
    20,
    0,
    now() + interval '1 day'
  );

-- Verify insertion
SELECT COUNT(*) as total_keys, COUNT(CASE WHEN is_active THEN 1 END) as active_keys FROM api_keys;
