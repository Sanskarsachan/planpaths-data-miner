# API Key & Quota Migration Plan
## Consolidating 19 Gemini APIs with Shared 20 Requests/Day Quota

**Status:** Planning Phase  
**Date:** March 4, 2026  
**Target:** Full migration from single API key to pooled quota system  

---

## 📋 Current State Analysis

### What You Have Now
- ✅ **Supabase** already integrated (PostgreSQL backend)
- ✅ **7 API routes** (extract, map, master-db import, schools, synonyms)
- ✅ **GeminiExtractor** handles Gemini API calls
- ✅ **Single GEMINI_API_KEY** from environment variables
- ❌ **No API key pooling** - only one key
- ❌ **No quota tracking** - unlimited (until hit actual Gemini limits)
- ❌ **No quota enforcement** - no checks before API calls

### Database Schema (Current)
```
tables:
  - states
  - schools
  - uploads
  - master_courses
  - (no api_keys table)
  - (no api_usage_logs table)
  - (no quota tracking)
```

### Current Extraction Flow
```
User Upload PDF
    ↓
extract/route.ts
    ↓
GeminiExtractor.extractAllChunks()
    ↓
model.generateContent(prompt)  ← Uses single hardcoded API key
    ↓
Returns courses → Save to Supabase
```

---

## 🎯 Target Architecture

### New Design: Shared Quota Pool (20 requests/day total)
```
Feature                  Current         →    Target
─────────────────────────────────────────────────────────
API Keys                1 key           →    19 keys in pool
Quota Type              Unlimited       →    20 requests/day (SHARED)
Quota Tracking          None            →    Per-request logging
Quota Enforcement       None            →    Pre-request checks
Selection Strategy      Hardcoded       →    Round-robin or next-available
Reset Frequency         Never           →    Daily (midnight UTC)
Usage Visibility        None            →    Dashboard + endpoints
Failed Requests         None            →    Tracked + errors logged
```

### New Extraction Flow (With Quota)
```
User Upload PDF
    ↓
extract/route.ts + checkQuotaAvailable()
    ↓
Is quota available?
├─ NO  → Return 429: "Quota exhausted"
├─ YES → Continue
    ↓
selectNextApiKey()  ← Pick from 19 keys
    ↓
GeminiExtractor.extractAllChunks(apiKeyId)
    ↓
model.generateContent(prompt)  ← Uses pool API key
    ↓
✓ Success → logApiUsage() → Increment counter
✗ Failed  → logApiUsage(error=true) → Track error
    ↓
Return courses → Save to Supabase
```

---

## 🏗️ Implementation Phases

### Phase 1: Database Schema (2 hours)
Create Supabase migration with new tables:

```sql
-- api_keys table (store 19 keys)
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname TEXT NOT NULL UNIQUE,      -- "Key #1", "Key #2", etc.
  key TEXT NOT NULL,                  -- Actual Gemini API key
  
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  
  quota_daily_limit INT DEFAULT 20,
  quota_used_today INT DEFAULT 0,
  quota_reset_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 day',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_active (is_active, is_deleted),
  INDEX idx_quota_reset (quota_reset_at)
);

-- api_usage_logs table (audit trail)
CREATE TABLE api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id),
  upload_id UUID REFERENCES uploads(id),
  
  request_type TEXT,      -- 'extract', 'map', 'master_db'
  status TEXT,            -- 'success', 'error'
  error_message TEXT,
  
  tokens_used INT,
  prompt_tokens INT,
  completion_tokens INT,
  estimated_cost_cents DECIMAL(10, 2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_api_key (api_key_id),
  INDEX idx_created (created_at),
  INDEX idx_upload (upload_id)
);

-- api_quota_reset_log table (track daily resets)
CREATE TABLE api_quota_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reset_date DATE NOT NULL UNIQUE,
  total_requests_before INT,
  total_requests_after INT,
  reset_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Phase 2: Quota Service Layer (3-4 hours)
Create **lib/quota/QuotaManager.ts** (core business logic):

**Functions:**
- `checkQuotaAvailable()` - Is quota left today?
- `selectNextApiKey()` - Pick best available key
- `getApiKey(id)` - Get specific key details
- `logApiUsage(keyId, usage)` - Record request
- `resetDailyQuotas()` - Reset at midnight UTC
- `getQuotaStats()` - Dashboard data

**Types:**
```typescript
interface ApiKey {
  id: string
  nickname: string
  is_active: boolean
  quota_used_today: number
  quota_daily_limit: number
  quota_remaining: number
  last_used_at?: Date
}

interface QuotaStatus {
  remaining: number
  limit: number
  percentage_used: number
  reset_at: Date
}

interface ApiUsageLog {
  api_key_id: string
  upload_id?: string
  status: 'success' | 'error'
  tokens_used?: number
  error_message?: string
}
```

### Phase 3: GeminiExtractor Update (2 hours)
Modify **lib/extraction/GeminiExtractor.ts** to:
- Accept `apiKeyId` parameter
- Fetch key from Supabase
- Use pooled key instead of hardcoded
- Include token tracking
- Chain error handling

**Before:**
```typescript
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

export async function extractAllChunks(chunks, state) {
  // Uses hardcoded key
}
```

**After:**
```typescript
export async function extractAllChunks(chunks, state, apiKeyId) {
  const { quotaMgr } = await setupQuotaManager()
  
  // Get the actual key
  const apiKey = await quotaMgr.getApiKey(apiKeyId)
  
  // Create dynamic Gemini client
  const genAI = new GoogleGenerativeAI(apiKey.key)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  
  // Process chunks
  for (let chunk of chunks) {
    try {
      const result = await model.generateContent(prompt)
      // ... extract courses ...
      
      // Log successful usage
      await quotaMgr.logApiUsage({
        api_key_id: apiKeyId,
        tokens_used: estimateTokens(result),
        status: 'success'
      })
    } catch (err) {
      // Log failed request
      await quotaMgr.logApiUsage({
        api_key_id: apiKeyId,
        status: 'error',
        error_message: err.message
      })
    }
  }
}
```

### Phase 4: API Route Updates (3-4 hours)

**Update:** `src/app/api/extract/route.ts`
```typescript
async function POST(req: Request) {
  const { quotaMgr } = await setupQuotaManager()
  
  // NEW: Check quota before processing
  const status = await quotaMgr.checkQuotaAvailable()
  if (!status.remaining) {
    return Response.json(
      { 
        error: 'API quota exhausted (20 requests/day)', 
        quotaResets: status.reset_at 
      },
      { status: 429 }
    )
  }
  
  // Select best available key
  const apiKey = await quotaMgr.selectNextApiKey()
  if (!apiKey) {
    return Response.json(
      { error: 'No API keys available' },
      { status: 503 }
    )
  }
  
  // Pass API key ID to extraction
  const courses = await extractAllChunks(chunks, state, apiKey.id)
  
  // ... rest of logic ...
}
```

**Similarly update:**
- `src/app/api/map/route.ts`
- `src/app/api/master-db/import/route.ts`
- `src/app/api/schools/route.ts`
- `src/app/api/synonyms/route.ts`

### Phase 5: Quota Reset Cron Job (1 hour)
Create webhook or cron for midnight UTC reset:

**Option A: External Cron (Vercel, Inngest)**
```typescript
// api/cron/reset-quotas.ts
export async function POST(req: Request) {
  // Verify secret token
  if (req.headers.get('Authorization') !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const { quotaMgr } = await setupQuotaManager()
  await quotaMgr.resetDailyQuotas()
  
  return Response.json({ success: true, reset_at: new Date() })
}

// In vercel.json:
{
  "crons": [{
    "path": "/api/cron/reset-quotas",
    "schedule": "0 0 * * *"  // Daily at 00:00 UTC
  }]
}
```

**Option B: Database Trigger + Task (Supabase)**
```sql
-- Auto-reset when trigger date hits
CREATE OR REPLACE TRIGGER reset_api_quotas
AFTER INSERT ON api_usage_logs
FOR EACH ROW
EXECUTE FUNCTION check_and_reset_quotas();
```

### Phase 6: Monitoring Endpoints (2 hours)

**New endpoints:**
```
GET /api/v2/quota/status
  → { remaining: 12, limit: 20, reset_at: "2026-03-05T00:00:00Z" }

GET /api/v2/quota/keys
  → [
      { id: "...", nickname: "Key #1", remaining: 8, limit: 20 },
      { id: "...", nickname: "Key #2", remaining: 4, limit: 20 }
    ]

GET /api/v2/quota/logs?limit=50
  → [ 
      { key_nickname: "Key #1", status: "success", tokens: 1234, timestamp },
      ...
    ]

POST /api/v2/admin/reset-quotas
  → { success: true, reset_at: "...", next_reset: "..." }
```

### Phase 7: Frontend UI Updates (2-3 hours)

**Components to add/update:**
1. **QuotaStatus.tsx** - Display remaining quota
2. **ApiKeySelector.tsx** - Let user pick key (if needed)
3. **QuotaDashboard.tsx** - Analytics view
4. **ErrorModals.tsx** - "Quota exceeded" modal

**Pages to update:**
- `src/app/extract/page.tsx` - Show quota before upload
- `src/app/mapping/page.tsx` - Show remaining quota

---

## 📊 Data Flows

### Scenario 1: Normal Extraction
```
1. User uploads PDF to extract/route.ts
2. checkQuotaAvailable() → true (15/20 remaining)
3. selectNextApiKey() → "Key #7"
4. extractAllChunks(chunks, state, "key-7-id")
5. GeminiExtractor calls Gemini API with Key #7
6. Success! logApiUsage(key-7-id, tokens=1200)
7. quota_used_today increments: 14 → 15
8. Return 200 with courses
9. UI: "15/20 quota used. Reset tomorrow at 00:00 UTC"
```

### Scenario 2: Quota Exhausted
```
1. User uploads PDF at 11:59 PM
2. Current quota: 20/20 remaining (0 available)
3. checkQuotaAvailable() → false
4. Return 429: "Quota exhausted. Resets in 1 minute"
5. User must wait or admin adds new keys
```

### Scenario 3: Daily Reset
```
1. Cron fires at 00:00 UTC
2. resetDailyQuotas() called
3. All 19 keys: quota_used_today = 0
4. All 19 keys: quota_reset_at = tomorrow 00:00 UTC
5. Log reset event to api_quota_resets table
6. Next request: checkQuotaAvailable() → true (0/20)
```

---

## 🔧 Integration Checklist

### ✅ Database Layer
- [ ] Create `api_keys` table (19 key records)
- [ ] Create `api_usage_logs` table (audit trail)
- [ ] Create `api_quota_resets` table (reset history)
- [ ] Add indexes on `is_active`, `quota_reset_at`, `created_at`
- [ ] Create migration file in `/supabase/migrations/005_quota_system.sql`
- [ ] Run migration: `pnpm run db:push`

### ✅ Backend Services
- [ ] Create `lib/quota/QuotaManager.ts` (core logic)
- [ ] Create `lib/quota/supabase-quota.ts` (DB queries)
- [ ] Update `lib/extraction/GeminiExtractor.ts` (accept apiKeyId)
- [ ] Create `lib/quota/useQuota.ts` hook for components

### ✅ API Routes
- [ ] Update `src/app/api/extract/route.ts`
- [ ] Update `src/app/api/map/route.ts`
- [ ] Update `src/app/api/master-db/import/route.ts`
- [ ] Create `src/app/api/v2/quota/status.ts`
- [ ] Create `src/app/api/v2/quota/keys.ts`
- [ ] Create `src/app/api/v2/quota/logs.ts`
- [ ] Create `src/app/api/v2/admin/reset-quotas.ts`
- [ ] Create `src/app/api/cron/reset-quotas.ts`

### ✅ Frontend
- [ ] Create `src/components/QuotaStatus.tsx`
- [ ] Create `src/components/QuotaDashboard.tsx`
- [ ] Update `src/app/extract/page.tsx`
- [ ] Update `src/app/mapping/page.tsx`

### ✅ Configuration
- [ ] Add `CRON_SECRET` to `.env.local`
- [ ] Update `.env.local.example` with quota docs
- [ ] Update `vercel.json` with cron job config
- [ ] Document Supabase backups

### ✅ Testing
- [ ] Write tests for `QuotaManager.ts`
- [ ] Test quota enforcement before API calls
- [ ] Test daily reset logic
- [ ] Test error scenarios (no keys available, etc.)
- [ ] Load test with simulated 20 requests/day

### ✅ Deployment
- [ ] Run migration on production Supabase
- [ ] Add 19 API keys to production `api_keys` table
- [ ] Deploy API routes with quota checks
- [ ] Deploy cron job configuration
- [ ] Monitor quota usage first 24 hours
- [ ] Create runbook for adding/rotating keys

---

## ⚠️ Important Notes

### Quota Enforcement
- ✅ Checked **at the start** of each extraction
- ✅ Checked for **all 7 API routes**
- ✅ Shared pool means **if one endpoint uses quota, all others see reduced quota**

### Key Rotation
```typescript
// TODO: Add later
export async function rotateApiKey(oldKeyId, newKey) {
  // Mark old key as is_deleted
  // Insert new key with higher priority
  // Log rotation event
  // Alert admin
}
```

### Token Estimation
```typescript
// Rough approximation (Gemini provides actual values)
function estimateTokens(response) {
  // response.response.usageMetadata contains:
  // - promptTokenCount
  // - candidatesTokenCount
  return promptTokens + completionTokens
}
```

### Rate Limit Strategy
- **Strategy 1:** First-come-first-served (FIFO)
- **Strategy 2:** Round-robin across all keys
- **Strategy 3:** Weighted by remaining quota
- **Recommendation:** Round-robin (fairest, simplest)

---

## 📈 Success Metrics

After implementation:
- ✅ All 19 API keys registered in `api_keys` table
- ✅ Zero requests go through without quota check
- ✅ Daily quota correctly resets at 00:00 UTC
- ✅ Usage tracked with < 99% accuracy
- ✅ Dashboard shows real-time quota status
- ✅ 429 errors properly handled in frontend
- ✅ No data loss during migration
- ✅ All existing extractions still work

---

## 🎓 Questions for You

Before we implement:

1. **Key Storage:** Should the 19 API keys be:
   - Stored in Supabase `api_keys` table encrypted?
   - Only passed via environment variables initially?
   - Both (secrets in env, metadata in DB)?
   - ✅ **Recommendation:** Encrypt in DB (more flexible for rotation)

2. **Key Selection Strategy:**
   - Round-robin (cycle through all keys)?
   - Next-available (pick first with quota)?
   - Random (randomize?)?
   - ✅ **Recommendation:** Next-available (deterministic, fair)

3. **Error Retry:**
   - When extraction fails, should we retry with different key?
   - ✅ **Recommendation:** No (keep simple, user can retry)

4. **Admin Panel:**
   - Need UI to add/delete/rotate keys?
   - Need analytics dashboard?
   - ✅ **Recommendation:** Start with basic dashboard

5. **Timeline:**
   - Full implementation: ~15-20 hours
   - Phased rollout (start with Phase 1-2)?
   - ✅ **Recommendation:** All phases together (cleaner)

---

## 🚀 Next Steps

Once you confirm this plan:
1. ✅ I'll create the Supabase migration (Phase 1)
2. ✅ I'll build QuotaManager service (Phase 2)
3. ✅ I'll update GeminiExtractor (Phase 3)
4. ✅ I'll update all API routes (Phase 4)
5. ✅ I'll setup cron job (Phase 5)
6. ✅ I'll create monitoring endpoints (Phase 6)
7. ✅ I'll add frontend UI (Phase 7)

**Ready to proceed?** Just confirm the plan or request any changes! 🎯
