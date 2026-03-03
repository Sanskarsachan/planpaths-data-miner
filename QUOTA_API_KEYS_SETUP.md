# 🚀 NEXT STEPS - API Keys Setup Guide

## You are here → Add your 19 Gemini API keys and deploy

---

## Step 1: Get Your 19 API Keys Ready

You should have **19 Gemini API keys** from Google's API Console.

If you don't have them yet:
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Get API Key"
3. Create 19 separate keys (one for each)
4. Save them somewhere secure

---

## Step 2: Run Database Migration

```bash
cd /Users/sanskarsachan/Documents/planpaths-data-miner

# Deploy the quota system tables, views, and functions
pnpm run db:push

# Expected output:
# ✅ Migrations applied successfully
# ✅ 3 tables created (api_keys, api_usage_logs, api_quota_resets)
```

This creates:
- ✅ `api_keys` table (for 19 keys)
- ✅ `api_usage_logs` table (audit trail)
- ✅ `api_quota_resets` table (reset history)
- ✅ 3 SQL views (for monitoring)
- ✅ 4 PostgreSQL functions (business logic)

---

## Step 3: Insert Your 19 API Keys

### Option A: Via Supabase Dashboard (Easy)

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Click "SQL Editor" (left sidebar)
4. Click "New Query"
5. Paste this INSERT statement with YOUR keys:

```sql
-- Replace the XXX values with your actual API keys
INSERT INTO api_keys (nickname, key, is_active, is_deleted)
VALUES
  ('Key #1', 'AIzaSyD_YOUR_KEY_1_HERE', true, false),
  ('Key #2', 'AIzaSyE_YOUR_KEY_2_HERE', true, false),
  ('Key #3', 'AIzaSyF_YOUR_KEY_3_HERE', true, false),
  ('Key #4', 'AIzaSyG_YOUR_KEY_4_HERE', true, false),
  ('Key #5', 'AIzaSyH_YOUR_KEY_5_HERE', true, false),
  ('Key #6', 'AIzaSyI_YOUR_KEY_6_HERE', true, false),
  ('Key #7', 'AIzaSyJ_YOUR_KEY_7_HERE', true, false),
  ('Key #8', 'AIzaSyK_YOUR_KEY_8_HERE', true, false),
  ('Key #9', 'AIzaSyL_YOUR_KEY_9_HERE', true, false),
  ('Key #10', 'AIzaSyM_YOUR_KEY_10_HERE', true, false),
  ('Key #11', 'AIzaSyN_YOUR_KEY_11_HERE', true, false),
  ('Key #12', 'AIzaSyO_YOUR_KEY_12_HERE', true, false),
  ('Key #13', 'AIzaSyP_YOUR_KEY_13_HERE', true, false),
  ('Key #14', 'AIzaSyQ_YOUR_KEY_14_HERE', true, false),
  ('Key #15', 'AIzaSyR_YOUR_KEY_15_HERE', true, false),
  ('Key #16', 'AIzaSyS_YOUR_KEY_16_HERE', true, false),
  ('Key #17', 'AIzaSyT_YOUR_KEY_17_HERE', true, false),
  ('Key #18', 'AIzaSyU_YOUR_KEY_18_HERE', true, false),
  ('Key #19', 'AIzaSyV_YOUR_KEY_19_HERE', true, false);
```

6. Click "Run" button
7. ✅ Should see: "19 rows inserted"

### Option B: Via Command Line (Advanced)

```bash
# Using psql
psql $SUPABASE_CONNECTION_STRING << EOF
INSERT INTO api_keys (nickname, key, is_active, is_deleted)
VALUES
  ('Key #1', 'AIzaSyD...', true, false),
  ... (repeat for all 19 keys)
EOF
```

### Option C: Verify Keys Were Added

```bash
# In Supabase Dashboard → SQL Editor:
SELECT nickname, LEFT(key, 10) || '...' as key_preview, quota_used_today, quota_daily_limit
FROM api_keys
ORDER BY created_at;

# Expected output:
# Key #1     | AIzaSyD...   | 0  | 20
# Key #2     | AIzaSyE...   | 0  | 20
# ... (19 total rows)
```

---

## Step 4: Generate CRON_SECRET

Generate a random secret for the cron job:

```bash
# On macOS/Linux:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# On Windows PowerShell:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Output will be something like:
# 8f3d9e2a4c1b5f8e9d3a2c4b6f8e1a3d5c7b9d2e4f6a8c1d3e5f7b9a0c2d4e

# Copy this value - you'll use it in the next step
```

---

## Step 5: Update Environment Variables

### Local Development (.env.local)

```bash
# In: /Users/sanskarsachan/Documents/planpaths-data-miner/.env.local

# Add this line (use the secret from step 4):
CRON_SECRET=8f3d9e2a4c1b5f8e9d3a2c4b6f8e1a3d5c7b9d2e4f6a8c1d3e5f7b9a0c2d4e

# Should now have:
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
CRON_SECRET=8f3d9e2a4c1b5f8e9d3a2c4b6f8e1a3d...
```

### Vercel Production (coming in step 7)

---

## Step 6: Test Locally

```bash
# Start development server
pnpm dev

# In another terminal, test quota status:
curl http://localhost:3000/api/v2/quota/status

# Expected response:
# {
#   "available": true,
#   "remaining": 20,
#   "limit": 20,
#   "percentage_used": 0,
#   "reset_at": "2026-03-05T00:00:00.000Z",
#   "reset_in_seconds": 86400,
#   "message": "20 of 20 requests available"
# }

# ✅ If you see this, quota system is working!
```

---

## Step 7: Configure Vercel Cron Job

### Update vercel.json

```json
{
  // ... existing config ...
  "crons": [
    {
      "path": "/api/cron/reset-quotas",
      "schedule": "0 0 * * *"
    }
  ]
}
```

**Schedule Explanation:**
- `0 0 * * *` = Every day at 00:00 UTC (midnight)
- Resets all quota_used_today counters to 0
- Happens automatically every night

---

## Step 8: Deploy to Vercel

```bash
# 1. Add CRON_SECRET to Vercel environment
vercel env add CRON_SECRET
# Paste your secret when prompted

# 2. Build locally to verify
pnpm run build

# 3. Deploy to production
vercel deploy --prod

# 4. Verify deployment
curl https://your-domain.com/api/v2/quota/status
# Should return the same quota data
```

---

## Step 9: Verify Everything Works

### Test 1: Check Quota Status
```bash
curl http://localhost:3000/api/v2/quota/status
# Should show: { "available": true, "remaining": 20 }
```

### Test 2: Check Available Keys
```bash
curl http://localhost:3000/api/v2/quota/keys
# Should show: 19 keys with quota_remaining: 20
```

### Test 3: Try an Extraction
```bash
# Upload a test PDF to the extract page
# Watch the quota decrement: 20 → 19 → 18...

# Verify in dashboard:
curl http://localhost:3000/api/v2/quota/dashboard
# Should show updated usage logs
```

### Test 4: Verify Logging
```bash
# In Supabase Dashboard → Table Editor:
# Go to: api_usage_logs

# Should see new rows with:
# - api_key_id: populated
# - status: "success"
# - tokens_used: number > 0
# - created_at: current time
```

---

## Step 10: Monitor in Production

### Dashboard
```
http://your-domain.com/api/v2/quota/dashboard
```

Shows:
- Current quota (X/20)
- All 19 keys and their usage
- Recent activity logs
- Daily trend chart

### Supabase Monitoring
```sql
-- Check current quota in Supabase Dashboard → SQL Editor:
SELECT * FROM api_quota_status;

-- Should show:
-- total_keys: 19
-- active_keys: 19
-- total_requests_today: 0-20
-- quota_remaining: 20-0
-- percentage_used: 0-100
```

---

## Troubleshooting

### "Cannot find api_keys table"
**→ Solution:** Run `pnpm run db:push` to create tables

### "CRON_SECRET is not set"
**→ Solution:** Add CRON_SECRET to .env.local and vercel env

### "All API keys show 0 remaining"
**→ Solution:** You've hit the quota. Wait until 00:00 UTC or manually reset:
```bash
curl -X POST http://localhost:3000/api/v2/admin/reset-quotas \
  -H "Authorization: Bearer $CRON_SECRET"
```

### "Extraction still returns errors"
**→ Solution:** Check GeminiExtractor.ts - ensure keys are valid

### "Cron job not running on Vercel"
**→ Checklist:**
- [ ] vercel.json has crons section?
- [ ] CRON_SECRET is set in Vercel env?
- [ ] Redeploy after adding cron to vercel.json

---

## Timeline

| Step | Task | Time |
|------|------|------|
| 1 | Get 19 API keys | 15 min |
| 2 | Run migration | 2 min |
| 3 | Insert API keys | 5 min |
| 4 | Generate CRON_SECRET | 1 min |
| 5 | Update .env.local | 1 min |
| 6 | Test locally | 5 min |
| 7 | Update vercel.json | 1 min |
| 8 | Deploy to Vercel | 5 min |
| 9 | Verify everything | 5 min |
| **Total** | **Complete Setup** | **~40 minutes** |

---

## ✅ Success Criteria

You're done when:

- ✅ `api_keys` table has 19 records with your keys
- ✅ `CRON_SECRET` is set in .env.local and Vercel
- ✅ `/api/v2/quota/status` returns `{ "available": true, "remaining": 20 }`
- ✅ First PDF extraction decrements quota: 20 → 19
- ✅ After 20 extractions, 21st returns 429 error
- ✅ Dashboard shows real-time quota usage
- ✅ Cron job successfully resets quota at 00:00 UTC

---

## Need Help?

1. **Check documentation:**
   - [QUOTA_SETUP.md](./QUOTA_SETUP.md) - Detailed guide
   - [QUOTA_MIGRATION_PLAN.md](./QUOTA_MIGRATION_PLAN.md) - Architecture

2. **Check logs:**
   - Supabase → Logs tab
   - Vercel → Deployments → Logs
   - Browser console for frontend errors

3. **Test endpoints:**
   - `/api/v2/quota/status` - Check quota
   - `/api/v2/quota/keys` - Check keys
   - `/api/v2/quota/dashboard` - Full dashboard

---

## What's Next After Setup?

1. **Monitor daily:** Check dashboard every morning
2. **Add alerts:** Setup email alerts when quota > 80%
3. **Track costs:** Monitor estimated_cost in database
4. **Rotate keys:** Deactivate old keys as needed
5. **Plan scaling:** Add more keys if quota increasing

---

🎉 **You've got this! 30-40 minutes from now, you'll have a fully operational quota system.**

Next: Add your 19 API keys! ⬆️
