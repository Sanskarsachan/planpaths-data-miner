## Migration: Adding API Key Quota System

This guide explains how to set up the new API key quota system for your Planpaths Data Miner project.

### What Changed

The system now:
- **Pools 19 Gemini API keys** in Supabase
- **Shares a quota** of 20 requests/day across all keys
- **Tracks usage** in detail with audit logs
- **Prevents over-usage** with pre-request quota checks
- **Auto-resets** daily at midnight UTC

### Phase 1: Database Setup

#### 1.1 Run Supabase Migration

```bash
# Deploy the new quota tables, views, functions, and triggers
pnpm run db:push
```

This creates:
- `api_keys` table (stores 19 API keys)
- `api_usage_logs` table (audit trail)
- `api_quota_resets` table (reset history)
- 3 SQL views for monitoring
- 4 PostgreSQL functions for business logic

#### 1.2 Add Your 19 API Keys

Insert your Gemini API keys into the database:

```sql
-- In Supabase Dashboard → SQL Editor, or via your admin panel

INSERT INTO api_keys (nickname, key, is_active, is_deleted)
VALUES
  ('Key #1', 'AIzaSyD...', true, false),
  ('Key #2', 'AIzaSyE...', true, false),
  ('Key #3', 'AIzaSyF...', true, false),
  -- ... repeat for all 19 keys
  ('Key #19', 'AIzaSyZ...', true, false);
```

⚠️ **Security:** Consider encrypting keys at rest in Supabase. For now they're stored plaintext.

### Phase 2: Environment Setup

#### 2.1 Update `.env.local`

Add these variables:

```bash
# .env.local

# Existing...
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...  # Keep as fallback

# NEW: For cron job authentication
CRON_SECRET=your-random-secret-key-here
```

To generate a secure `CRON_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### 2.2 Update `.env.local.example`

Document the new variables:

```bash
# Quota System
CRON_SECRET=your-secret-here  # For cron job authentication
```

### Phase 3: Deployment (Vercel)

#### 3.1 Set Environment Variables

```bash
vercel env add CRON_SECRET
# Paste your secret when prompted
```

#### 3.2 Configure Cron Job

Update `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/reset-quotas",
      "schedule": "0 0 * * *"
    }
  ]
}
```

This triggers a daily reset at **00:00 UTC**.

For other timing, use cron syntax:
- `0 0 * * *` = Daily at midnight UTC
- `0 */4 * * *` = Every 4 hours
- `0 1 * * *` = Daily at 1 AM UTC

#### 3.3 Test Cron Locally

```bash
# In one terminal:
pnpm dev

# In another:
curl -X POST http://localhost:3000/api/cron/reset-quotas \
  -H "Authorization: Bearer your-cron-secret"
```

Should return:
```json
{
  "success": true,
  "keys_reset": 19,
  "total_requests_before": 8,
  "reset_at": "2026-03-05T00:00:00.000Z"
}
```

### Phase 4: Frontend Integration

#### 4.1 Update Extract Page

Import and use quota components in `src/app/extract/page.tsx`:

```typescript
'use client'

import { QuotaStatus } from '@/components/QuotaStatus'
import { useExtraction } from '@/lib/quota/useQuota'

export default function ExtractPage() {
  const { isQuotaAvailable, startExtraction } = useExtraction()

  return (
    <div>
      {/* Show quota status */}
      <QuotaStatus />

      {/* Extract form */}
      <form>
        {/* ... form fields ... */}

        <button
          type="submit"
          disabled={!isQuotaAvailable}
          onClick={async (e) => {
            e.preventDefault()
            
            if (!isQuotaAvailable) {
              alert('Quota exhausted')
              return
            }

            try {
              const result = await startExtraction(
                file,
                schoolName,
                stateCode,
                selectedApiKeyId
              )
              console.log('Extraction complete:', result)
            } catch (err) {
              console.error('Extraction failed:', err)
            }
          }}
        >
          Extract
        </button>
      </form>
    </div>
  )
}
```

#### 4.2 Add Dashboard Page

Create `src/app/admin/quota.tsx`:

```typescript
'use client'

import { QuotaDashboard } from '@/components/QuotaDashboard'

export default function QuotaPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">API Quota Dashboard</h1>
      <QuotaDashboard />
    </div>
  )
}
```

### Phase 5: Testing

#### 5.1 Unit Tests

```bash
pnpm test
```

Tests cover:
- ✅ Quota availability checks
- ✅ Key selection logic
- ✅ Usage logging
- ✅ Daily reset behavior
- ✅ Error handling

#### 5.2 Integration Tests

```bash
# Test the full extraction flow
pnpm test:integration

# Or manually:
1. Upload small PDF to extract page
2. Check that quota decrements
3. Check that logs appear in dashboard
4. Test quota exhaustion (upload 21 times)
5. Manually trigger reset: curl -X POST http://localhost:3000/api/cron/reset-quotas
6. Verify quota resets
```

#### 5.3 Load Testing

```bash
# Simulate 20 concurrent extractions
for i in {1..20}; do
  curl -X POST http://localhost:3000/api/extract \
    -F "school_name=Test School" \
    -F "state_code=FL" \
    -F "file=@test.pdf" &
done
wait

# Check that 20 requests succeeded, then 21st fails with 429
```

### Phase 6: Monitoring

#### 6.1 API Endpoints

New endpoints for tracking:

```bash
# Check quota status
curl http://localhost:3000/api/v2/quota/status
# Response: { available: true, remaining: 15, limit: 20, ... }

# List available keys
curl http://localhost:3000/api/v2/quota/keys
# Response: [ { id: "...", nickname: "Key #1", remaining: 8, ... } ]

# Get recent logs
curl "http://localhost:3000/api/v2/quota/logs?limit=50"
# Response: [ { api_key_nickname: "Key #1", status: "success", tokens_used: 1234, ... } ]

# Full dashboard
curl http://localhost:3000/api/v2/quota/dashboard
# Response: { quota, keys, stats, recent_logs, daily_stats }

# Manually reset (admin only)
curl -X POST http://localhost:3000/api/v2/admin/reset-quotas \
  -H "Authorization: Bearer $CRON_SECRET"
```

#### 6.2 Supabase Monitoring

View logs in Supabase Dashboard:

```sql
-- Total requests today
SELECT COUNT(*) as requests, status
FROM api_usage_logs
WHERE DATE(created_at) = CURRENT_DATE
GROUP BY status;

-- Tokens per key
SELECT 
  ak.nickname,
  SUM(aul.tokens_used) as tokens,
  COUNT(*) as requests
FROM api_usage_logs aul
JOIN api_keys ak ON aul.api_key_id = ak.id
WHERE DATE(aul.created_at) = CURRENT_DATE
GROUP BY ak.nickname
ORDER BY tokens DESC;

-- Cost estimation
SELECT 
  SUM(estimated_cost_cents) as total_cost_cents
FROM api_usage_logs
WHERE DATE(created_at) = CURRENT_DATE;
```

### Phase 7: Maintenance

#### 7.1 Adding New Keys

When you run out of quota:

```sql
INSERT INTO api_keys (nickname, key, is_active, is_deleted)
VALUES ('Key #20', 'AIzaSyZzzz...', true, false);
```

The system automatically includes it in the next request.

#### 7.2 Rotating Keys

When a key expires:

```sql
UPDATE api_keys
SET is_active = false
WHERE nickname = 'Key #5';
```

The system skips inactive keys automatically.

#### 7.3 Viewing Historical Data

```sql
-- Daily usage trend
SELECT usage_date, total_requests, total_tokens, estimated_cost
FROM api_daily_usage
ORDER BY usage_date DESC
LIMIT 30;

-- Reset history
SELECT reset_date, keys_reset, total_requests_before
FROM api_quota_resets
ORDER BY reset_date DESC;
```

### Phase 8: Troubleshooting

#### Issue: "No API keys with available quota"

**Cause:** All 19 keys used their 20 requests

**Solution:**
- Wait for midnight UTC reset (automatic)
- OR manually reset: `POST /api/v2/admin/reset-quotas`
- OR add more keys to the `api_keys` table

#### Issue: Extraction fails with 429 (Gemini rate limit)

**Cause:** Gemini API is rate limiting us

**Solution:**
- This is different from our 20 request/day quota
- Reduce `MAX_CONCURRENT` in `GeminiExtractor.ts` from 5 to 3
- Add delays between requests

#### Issue: Cron job not running

**Cause:** Missing `vercel.json` or `CRON_SECRET` not set

**Solution:**
- Verify `vercel.json` includes cron config
- Verify `CRON_SECRET` is set in Vercel environment
- Test manually: `curl -X POST http://localhost:3000/api/cron/reset-quotas -H "Authorization: Bearer $CRON_SECRET"`

### Rollback Plan

If something breaks:

#### 1. Disable quota checks (fail-open)

```bash
# In .env.local
QUOTA_SYSTEM_ENABLED=false
```

Then update `src/app/api/extract/route.ts`:
```typescript
if (process.env.QUOTA_SYSTEM_ENABLED === 'false') {
  // Skip quota checks
  // Use fallback key
}
```

#### 2. Restore previous migration

```bash
# Delete the quota system tables
supabase migration delete 005_quota_system.sql
pnpm run db:push
```

#### 3. Use single API key (pre-quota setup)

Everything still works with `GEMINI_API_KEY` environment variable.

### Success Criteria

✅ All 19 keys registered in `api_keys` table  
✅ Zero requests proceed without quota check  
✅ Quota decrements correctly (20 total per day)  
✅ Daily reset at 00:00 UTC succeeds  
✅ Usage tracked with >99% accuracy  
✅ Dashboard shows real-time status  
✅ 429 errors handled gracefully  
✅ No existing functionality broken  

---

**Questions?** Check [QUOTA_MIGRATION_PLAN.md](../QUOTA_MIGRATION_PLAN.md) for detailed architecture.
