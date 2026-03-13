# Improved Error Handling & Debugging Summary

**Last Updated:** March 6, 2026

## Changes Made

### 1. **QuotaManager Enhancements** (`src/lib/quota/QuotaManager.ts`)

#### a) Better Key Selection Logging
- Added detailed logs showing which key was selected and why
- Logs include key nickname, partial ID, and remaining quota
- Shows fallback chain: RPC → Direct Query → Env Var

**Example Log:**
```
[QuotaManager] Selected key via RPC: My-API-Key-1 (ID: abc123cd...) | Remaining: 19/20
[QuotaManager] RPC failed: permission_denied | Attempt 1/3 | Fallback: direct lookup
[QuotaManager] Found direct key: Fallback-Key (ID: def456gh...) | Remaining: 20/20
```

#### b) New `recordKeyError()` Method
- Tracks API key failures with categorization:
  - `leaked_key` (403)
  - `quota_exceeded` (429)
  - `invalid_key` (403 or 401)
  - `unauthorized` (401)
  - `other`

- Automatically deactivates leaked keys
- Logs errors to `api_usage_logs` table for metrics

**Example:**
```typescript
await quotaMgr.recordKeyError(apiKeyId, errorMessage, 403);
// Logs: [KeyError] KeyID: abc123cd... | Type: leaked_key | Code: 403
// Action: Deactivates the key automatically
```

#### c) Direct Key Lookup Logging
- Enhanced fallback mechanism shows when RPC fails
- Clear logging of why each fallback was used

---

### 2. **ChunkProcessor Error Logging** (`src/lib/extraction/ChunkProcessor.ts`)

#### a) Detailed API Call Logging
- Shows which API key is being used (partial ID)
- Logs for each attempt (attempt X/3)
- Page range and character count for context

**Before:**
```
[ChunkProcessor] → Gemini API | attempt 1/3 | pages 1-5 | 17282 chars
```

**After:**
```
[ChunkProcessor] → Gemini API | attempt 1/3 | pages 1-5 | 17282 chars | keyId=abc123cd...
```

#### b) Error Type Detection
- Parses error responses to identify root cause
- Shows error type, status code, and message
- Differentiates between retryable and fatal errors

**Example:**
```
[ChunkProcessor] ERROR (LEAKED_KEY) | KeyId=abc123cd... | Attempt 1/3 | Pages 1-5 | Status: 403
[ChunkProcessor] ERROR (QUOTA_EXCEEDED) | KeyId=def456gh... | Attempt 2/3 | Pages 1-5 | Status: 429
[ChunkProcessor] ERROR (TIMEOUT) | KeyId=ghi789ij... | Attempt 1/3 | Pages 1-5 | Status: N/A
```

#### c) Smarter Retry Logic
- Logs why each retry is happening
- Shows backoff delays between retries
- Clear logging when all retries exhausted

**Example:**
```
[ChunkProcessor] Timeout after 55000ms (pages 1-5)
[ChunkProcessor] Timeout retry 1/3...
[ChunkProcessor] Network error, retrying 1/3...
[ChunkProcessor] Retrying (INVALID_KEY): attempt 1/3...
[ChunkProcessor] All retries exhausted for pages 1-5
```

#### d) Fatal Error Alerts
- Clearly marks permanent failures (leaked keys, etc.)
- Shows full error details for debugging

**Example:**
```
[ChunkProcessor] FATAL ERROR (LEAKED_KEY): Key abc123cd... is unusable | Pages: 1-5
[ChunkProcessor] Error details: API key was reported as leaked. Please use another API key.
```

---

### 3. **Extract Route Improvements** (`src/app/api/extract/route.ts`)

#### a) Initial Processing Logs
- Shows when extraction starts
- Logs file upload ID and school slug
- Shows which API key was selected

**Example:**
```
[Extract] POST: Initiating extraction request
[Extract] POST: Created job abc123de-5678-9012-3456 for armwood-high-school-fl
ℹ [QuotaManager] Selected key via RPC: My-API-Key-1 (ID: abc123cd...) | Remaining: 19/20
```

#### b) Error Recording
- When extraction fails, logs why
- Records the error to Supabase for tracking
- Automatically deactivates bad keys

**Example:**
```
[Extract] Fatal error | KeyId: abc123cd... | Status: 403 | Message: API key was reported as leaked
[Extract] ALERT: API key abc123cd... is leaked, deactivating...
```

#### c) Fallback Chain Logging
- Shows when QuotaManager needs to fallback to different keys
- Clear visibility into key selection process

---

## How This Fixes Your Issues

### Issue 1: Leaked API Keys
**Before:** Silently fails with 403, no indication of why
**After:** 
- Detects "leaked_key" error type
- Logs: `[KeyError] Type: leaked_key | Code: 403`
- Automatically deactivates the key
- Next extraction uses a different key

### Issue 2: Quota Exceeded
**Before:** Hits 429 error, no indication that quota is exhausted
**After:**
- Detects "quota_exceeded" error type
- Logs: `[KeyError] Type: quota_exceeded | Code: 429`
- Shows in `api_usage_logs` table for metrics
- UI tells user to wait for quota reset

### Issue 3: Silent Failures (Timeouts)
**Before:** Timeout happens, all retries fail silently, shows "0 courses"
**After:**
- Logs each timeout: `Timeout after 55000ms`
- Shows which API key timed out
- Logs all retry attempts
- Shows error when retries exhausted: `All retries exhausted for pages 1-5`

### Issue 4: Unclear Error Messages
**Before:** `Error: [GoogleGenerativeAI Error]: Error fetching...`
**After:**
- Error type identified: `ERROR (LEAKED_KEY | QUOTA_EXCEEDED | TIMEOUT | INVALID_KEY)`
- Status code shown: `Status: 403 | 429 | 401 | N/A`
- API key ID logged: `KeyId: abc123cd...`
- Context (page range) shown: `Pages: 1-5`

---

## Log Reading Guide

### Quick Scan: Is Extraction Working?
```
 GOOD:
[QuotaManager] Selected key via RPC: ... | Remaining: 19/20
[ChunkProcessor] ← 25 courses | 9715 tokens
[Extract] Complete | 51 courses | 120000ms

 BAD:
[ChunkProcessor] ERROR (QUOTA_EXCEEDED) | ... | Status: 429
[ChunkProcessor] All retries exhausted for pages 1-5
[Extract] Fatal error | KeyId: abc... | Status: 403
```

### Understanding Error Types
| Error Type | Status | Root Cause | Action |
|-----------|--------|-----------|--------|
| LEAKED_KEY | 403 | Key compromised | Automatically deactivated |
| QUOTA_EXCEEDED | 429 | Hit 20 requests/day | Wait for reset (~24h) |
| TIMEOUT | N/A | Gemini API slow | Auto-retries 3 times |
| INVALID_KEY | 401/403 | Wrong/expired key | Auto-retries 3 times |

---

## Files Modified

1. **QuotaManager.ts**
   - Enhanced `selectNextApiKey()` with detailed logging
   - Added `recordKeyError()` method
   - Better fallback chain visibility

2. **ChunkProcessor.ts**
   - Added detailed API call logging with key ID
   - Error type detection and classification
   - Improved retry logging

3. **Extract route.ts**
   - Initial request logging
   - API key selection logging
   - Error recording with QuotaManager
   - Better error handling and alerts

4. **DEBUG_LOGGING_GUIDE.md** (NEW)
   - Complete guide to understanding logs
   - Reference for all error types
   - Debugging checklist
   - Common issues and solutions

---

## Testing

All tests pass without regression:
```
Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
```

Dev server starts without errors:
```
 Ready in 2.5s
Using port 3001
```

---

## Next Steps

Your system now has:
1. Better visibility into API key selection
2. Error type detection (leaked, quota, timeout, invalid)
3. Automatic key deactivation for leaked keys
4. Detailed retry logging
5. API error metadata in logs and database

**Try an extraction now and watch the logs!**

Example successful extraction log flow:
```
[Extract] POST: Initiating extraction request
[QuotaManager] Selected key via RPC: My-API-Key-1 (ID: abc123cd...) | Remaining: 19/20
[Extract] PDF detected pages: 24
[Extract] Scope: selected range 1-5 (24 total pages)
[ChunkProcessor] → Gemini API | attempt 1/3 | pages 1-5 | 17282 chars | keyId=abc123cd...
[ChunkProcessor] ← 25 courses | 9715 tokens
[Extract] Progress: chunk_complete | 1/1 |  Pages 1–5: 25 courses found
[Extract] Complete | 25 courses | 45000ms | tokens: 9715
```

See `DEBUG_LOGGING_GUIDE.md` for more examples and troubleshooting.
