-- ================================================================
-- COMPLETE QUOTA SYSTEM SETUP FOR SUPABASE DASHBOARD
-- ================================================================
-- Copy entire content and paste into:
-- https://app.supabase.com/project/emowefxzeqkksjnddzip/sql
-- Then click "RUN" to execute
-- ================================================================

-- ── API KEYS TABLE (Pool of 19+ Gemini API keys) ──────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Key metadata
  nickname TEXT NOT NULL UNIQUE,      -- "API1001", "API1002", etc.
  key TEXT NOT NULL,                  -- Actual Gemini API key
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,     -- Can be used for extractions
  is_deleted BOOLEAN DEFAULT FALSE,   -- Soft delete (historical tracking)
  
  -- SHARED Quota (all 19 keys share 20 requests/day)
  quota_daily_limit INT DEFAULT 20,   -- Fixed: 20 requests/day
  quota_used_today INT DEFAULT 0,     -- Increments on each successful request
  quota_reset_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 day',  -- Reset timestamp
  
  -- Usage tracking
  total_requests INT DEFAULT 0,
  total_tokens_used INT DEFAULT 0,
  estimated_cost_cents DECIMAL(10, 2) DEFAULT 0,
  
  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT api_keys_key_not_empty CHECK (key <> ''),
  CONSTRAINT api_keys_nickname_not_empty CHECK (nickname <> '')
);

-- Indexes for quota checks
CREATE INDEX IF NOT EXISTS idx_api_keys_active_quota 
  ON api_keys(is_active, is_deleted, quota_used_today, quota_reset_at)
  WHERE is_active = TRUE AND is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_api_keys_reset_at 
  ON api_keys(quota_reset_at);

CREATE INDEX IF NOT EXISTS idx_api_keys_created 
  ON api_keys(created_at DESC);

-- ── API USAGE LOGS TABLE (Audit trail for every request) ────────
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign keys
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  upload_id UUID REFERENCES uploads(id) ON DELETE SET NULL,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  
  -- Request details
  request_type TEXT,                  -- 'extract', 'map', 'master_db', 'refine', etc.
  status TEXT NOT NULL,               -- 'success', 'error', 'timeout', 'rate_limited'
  error_message TEXT,                 -- Stack trace if error
  
  -- Token usage
  tokens_used INT,                    -- Total tokens (prompt + completion)
  prompt_tokens INT,
  completion_tokens INT,
  estimated_cost_cents DECIMAL(10, 2),
  
  -- Metadata
  school_name TEXT,                   -- Denormalized for reporting
  file_name TEXT,
  processing_ms INT,                  -- How long the request took
  
  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT api_usage_logs_status_valid CHECK (
    status IN ('success', 'error', 'timeout', 'rate_limited', 'quota_exceeded')
  )
);

-- Indexes for querying logs
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_api_key 
  ON api_usage_logs(api_key_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created 
  ON api_usage_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_upload 
  ON api_usage_logs(upload_id);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_school 
  ON api_usage_logs(school_id);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_status 
  ON api_usage_logs(status, created_at DESC);

-- ── API QUOTA RESET LOG TABLE (Daily reset history) ──────────────
CREATE TABLE IF NOT EXISTS api_quota_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  reset_date DATE NOT NULL UNIQUE,
  
  -- Before reset
  total_requests_before INT,
  total_tokens_before INT,
  
  -- After reset
  total_requests_after INT,
  total_tokens_after INT,
  
  keys_reset INT,                     -- How many keys were reset
  
  reset_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_quota_resets_date 
  ON api_quota_resets(reset_date DESC);

-- ── DAILY QUOTA MONITORING VIEW (for dashboards) ────────────────
CREATE OR REPLACE VIEW api_quota_status AS
SELECT 
  COUNT(*) as total_keys,
  SUM(CASE WHEN is_active AND NOT is_deleted THEN 1 ELSE 0 END) as active_keys,
  SUM(quota_used_today) as total_requests_today,
  SUM(quota_daily_limit) as total_quota_available,
  (SUM(quota_daily_limit) - SUM(quota_used_today)) as quota_remaining,
  ROUND(
    ((SUM(quota_used_today)::FLOAT / NULLIF(SUM(quota_daily_limit), 0)) * 100)::NUMERIC, 
    2
  ) as percentage_used,
  MIN(quota_reset_at) as next_reset_at
FROM api_keys
WHERE is_deleted = FALSE;

-- ── KEY PERFORMANCE VIEW (for monitoring) ──────────────────────
CREATE OR REPLACE VIEW api_key_performance AS
SELECT 
  id,
  nickname,
  is_active,
  quota_used_today,
  quota_daily_limit,
  (quota_daily_limit - quota_used_today) as quota_remaining,
  ROUND(
    ((quota_used_today::FLOAT / NULLIF(quota_daily_limit, 0)) * 100)::NUMERIC,
    2
  ) as percentage_used,
  total_requests,
  total_tokens_used,
  estimated_cost_cents,
  last_used_at,
  quota_reset_at,
  created_at
FROM api_keys
WHERE is_deleted = FALSE
ORDER BY is_active DESC, quota_remaining DESC, created_at ASC;

-- ── DAILY USAGE VIEW (for analytics) ───────────────────────────
CREATE OR REPLACE VIEW api_daily_usage AS
SELECT 
  DATE(created_at) as usage_date,
  COUNT(*) as total_requests,
  COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_requests,
  COUNT(CASE WHEN status != 'success' THEN 1 END) as failed_requests,
  SUM(tokens_used) as total_tokens,
  SUM(estimated_cost_cents) as estimated_cost,
  COUNT(DISTINCT api_key_id) as keys_used
FROM api_usage_logs
GROUP BY DATE(created_at)
ORDER BY usage_date DESC;

-- ── TRIGGER: Auto-update api_keys.updated_at ──────────────────
CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS api_keys_update_timestamp ON api_keys;
CREATE TRIGGER api_keys_update_timestamp
BEFORE UPDATE ON api_keys
FOR EACH ROW
EXECUTE FUNCTION update_api_keys_updated_at();

-- ── FUNCTION: Check and select available API key ────────────────
CREATE OR REPLACE FUNCTION select_best_available_api_key()
RETURNS UUID AS $$
BEGIN
  -- Reset quota if past reset_at timestamp
  UPDATE api_keys
  SET quota_used_today = 0, quota_reset_at = NOW() + INTERVAL '1 day'
  WHERE quota_reset_at <= NOW() AND is_active = TRUE AND is_deleted = FALSE;
  
  -- Return key with most quota remaining (round-robin fairness)
  RETURN (
    SELECT id
    FROM api_keys
    WHERE is_active = TRUE
      AND is_deleted = FALSE
      AND (quota_daily_limit - quota_used_today) > 0
    ORDER BY (quota_daily_limit - quota_used_today) DESC, created_at ASC
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql;

-- ── FUNCTION: Check overall quota availability ─────────────────
CREATE OR REPLACE FUNCTION check_quota_available()
RETURNS TABLE(
  available BOOLEAN,
  remaining INT,
  limit INT,
  reset_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Reset quota if needed
  UPDATE api_keys
  SET quota_used_today = 0, quota_reset_at = NOW() + INTERVAL '1 day'
  WHERE quota_reset_at <= NOW() AND is_active = TRUE AND is_deleted = FALSE;
  
  RETURN QUERY
  SELECT 
    (SUM(quota_daily_limit) - SUM(quota_used_today)) > 0 as available,
    (SUM(quota_daily_limit) - SUM(quota_used_today))::INT as remaining,
    SUM(quota_daily_limit)::INT as limit,
    MIN(quota_reset_at) as reset_at
  FROM api_keys
  WHERE is_active = TRUE AND is_deleted = FALSE;
END;
$$ LANGUAGE plpgsql;

-- ── FUNCTION: Log API usage and increment quota ────────────────
CREATE OR REPLACE FUNCTION log_api_usage(
  p_api_key_id UUID,
  p_upload_id UUID DEFAULT NULL,
  p_school_id UUID DEFAULT NULL,
  p_request_type TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'success',
  p_error_message TEXT DEFAULT NULL,
  p_tokens_used INT DEFAULT 0,
  p_prompt_tokens INT DEFAULT 0,
  p_completion_tokens INT DEFAULT 0,
  p_estimated_cost_cents DECIMAL DEFAULT 0,
  p_school_name TEXT DEFAULT NULL,
  p_file_name TEXT DEFAULT NULL,
  p_processing_ms INT DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  -- Insert usage log
  INSERT INTO api_usage_logs (
    api_key_id, upload_id, school_id, request_type, status, error_message,
    tokens_used, prompt_tokens, completion_tokens, estimated_cost_cents,
    school_name, file_name, processing_ms
  )
  VALUES (
    p_api_key_id, p_upload_id, p_school_id, p_request_type, p_status, p_error_message,
    p_tokens_used, p_prompt_tokens, p_completion_tokens, p_estimated_cost_cents,
    p_school_name, p_file_name, p_processing_ms
  )
  RETURNING id INTO v_log_id;
  
  -- Only increment quota counter on SUCCESS
  IF p_status = 'success' THEN
    UPDATE api_keys
    SET 
      quota_used_today = quota_used_today + 1,
      total_requests = total_requests + 1,
      total_tokens_used = total_tokens_used + COALESCE(p_tokens_used, 0),
      estimated_cost_cents = estimated_cost_cents + COALESCE(p_estimated_cost_cents, 0),
      last_used_at = NOW()
    WHERE id = p_api_key_id;
  END IF;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- ── FUNCTION: Reset daily quotas (call at midnight UTC) ────────
CREATE OR REPLACE FUNCTION reset_daily_quotas()
RETURNS TABLE(
  reset_at TIMESTAMPTZ,
  keys_reset INT,
  total_requests_before INT,
  total_tokens_before INT
) AS $$
DECLARE
  v_total_requests_before INT;
  v_total_tokens_before INT;
  v_keys_reset INT;
BEGIN
  -- Capture current state
  SELECT 
    SUM(quota_used_today)::INT,
    SUM(total_tokens_used)::INT
  INTO v_total_requests_before, v_total_tokens_before
  FROM api_keys
  WHERE is_deleted = FALSE;
  
  -- Reset all active keys
  UPDATE api_keys
  SET 
    quota_used_today = 0,
    quota_reset_at = NOW() + INTERVAL '1 day'
  WHERE is_active = TRUE AND is_deleted = FALSE;
  
  GET DIAGNOSTICS v_keys_reset = ROW_COUNT;
  
  -- Log the reset
  INSERT INTO api_quota_resets (
    reset_date,
    total_requests_before,
    total_tokens_before,
    total_requests_after,
    total_tokens_after,
    keys_reset
  )
  VALUES (
    CURRENT_DATE,
    v_total_requests_before,
    v_total_tokens_before,
    0,  -- After reset
    0,
    v_keys_reset
  );
  
  RETURN QUERY SELECT NOW()::TIMESTAMPTZ, v_keys_reset, v_total_requests_before, v_total_tokens_before;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════
-- INSERT YOUR 4 API KEYS (Update the values below)
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO api_keys (nickname, key, is_active, is_deleted, quota_daily_limit, quota_used_today, created_at, updated_at)
VALUES
  ('API1001', 'AIzaSyBmpu3EEGThCVVb1RKTIpahoMNxCpIGD5o', true, false, 20, 0, NOW(), NOW()),
  ('API1002', 'AIzaSyCalCi-sd7CARrp-msZ8tJkNNxkawad4BI', true, false, 20, 0, NOW(), NOW()),
  ('API1003', 'AIzaSyASgyn9KJezJzu0rXTRIUgvsC2ZDhekAfY', true, false, 20, 0, NOW(), NOW()),
  ('API1004', 'AIzaSyCkqmf5dSNjKSDT-HSN7HOX1dzIZMsi-Ss', true, false, 20, 0, NOW(), NOW())
ON CONFLICT (nickname) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- ═══════════════════════════════════════════════════════════════════

-- Check: Tables created?
SELECT 'API Keys Table' as check_item, COUNT(*) as count FROM api_keys
UNION ALL
SELECT 'Usage Logs Table', COUNT(*) FROM api_usage_logs
UNION ALL
SELECT 'Quota Resets Table', COUNT(*) FROM api_quota_resets;

-- Check: API keys inserted?
SELECT 'Active Keys' as status, COUNT(*) as count FROM api_keys WHERE is_active = TRUE AND is_deleted = FALSE
UNION ALL
SELECT 'Total Quota Available', COUNT(*) * 20 FROM api_keys WHERE is_active = TRUE AND is_deleted = FALSE;

-- Check: Current quota status
SELECT * FROM api_quota_status;

-- Check: Key performance
SELECT * FROM api_key_performance;
