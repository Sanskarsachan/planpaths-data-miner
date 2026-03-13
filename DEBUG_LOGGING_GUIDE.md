# Debug Logging & Error Handling Guide

## Overview

Comprehensive debugging and logging has been added throughout the extraction pipeline to help identify and resolve API key issues, quota problems, and timeout failures.

## Key Log Levels & Formats

### QuotaManager Logs

**Key Selection Process:**
```
[QuotaManager] Selected key via RPC: My-API-Key-1 (ID: abc123cd...) | Remaining: 19/20
[QuotaManager] Direct key lookup failed: no active keys found
[QuotaManager] Found direct key: Fallback-Key (ID: def456gh...) | Remaining: 20/20
[QuotaManager] No Supabase keys available, using env fallback: Fallback (env var)
```

**Error Recording:**
```
[KeyError] KeyID: abc123cd... | Type: leaked_key | Code: 403 | Msg: API key was reported as leaked...
[KeyError] KeyID: def456gh... | Type: quota_exceeded | Code: 429 | Msg: Quota exceeded...
[KeyError] KeyID: ghi789ij... | Type: invalid_key | Code: 403 | Msg: Unauthorized key...
[KeyError] Deactivating leaked key: abc123cd...
```

### ChunkProcessor Logs

**API Call Attempts:**
```
[ChunkProcessor] → Gemini API | attempt 1/3 | pages 1-5 | 17282 chars | keyId=abc123cd...
[ChunkProcessor] ← 25 courses | 9715 tokens
```

**Error Detection:**
```
[ChunkProcessor] ERROR (LEAKED_KEY) | KeyId=abc123cd... | Attempt 1/3 | Pages 1-5 | Status: 403 | Message: API key was reported as leaked
[ChunkProcessor] ERROR (QUOTA_EXCEEDED) | KeyId=def456gh... | Attempt 2/3 | Pages 1-5 | Status: 429 | Message: Quota exceeded limit: 20
[ChunkProcessor] ERROR (TIMEOUT) | KeyId=ghi789ij... | Attempt 1/3 | Pages 1-5 | Status: N/A | Message: Gemini request timed out
[ChunkProcessor] FATAL ERROR (LEAKED_KEY): Key abc123cd... is unusable | Pages: 1-5
```

**Retry Logic:**
```
[ChunkProcessor] Timeout after 55000ms (pages 1-5)
[ChunkProcessor] Timeout retry 1/3...
[ChunkProcessor] Network error, retrying 1/3...
[ChunkProcessor] Retrying (INVALID_KEY): attempt 1/3...
```

### Extract Route Logs

**Initial Processing:**
```
[Extract] POST: Initiating extraction request
[Extract] POST: Created job {uploadId} for {school-slug}
[Extract] PDF detected pages: 24
[Extract] Scope: selected range 1-5 (24 total pages)
```

**Progress Updates:**
```
[Extract] Progress: processing | 1/2 | Processing pages 1–5 (chunk 1/2)…
[Extract] Progress: chunk_complete | 1/2 |  Pages 1–3: 25 courses found
[Extract] Progress: waiting | 1/2 | Waiting before next batch…
```

**Completion & Errors:**
```
[Extract] Complete | 51 courses | 120000ms | tokens: 16282
[Extract] Fatal error | KeyId: abc123cd... | Status: 403 | Message: API key was reported as leaked
[Extract] ALERT: API key abc123cd... is leaked, deactivating...
[Extract] ALERT: API key def456gh... quota exceeded
```

## Error Type Reference

### LEAKED_KEY (403)
- **Symptom**: "API key was reported as leaked"
- **Action**: Key is automatically deactivated
- **Solution**: Remove key from Supabase and create a new one
- **Log**: `[KeyError] Deactivating leaked key: {keyId}`

### QUOTA_EXCEEDED (429)
- **Symptom**: "You exceeded your current quota"
- **Action**: Logged as error, no automatic retry
- **Solution**: Wait for quota reset (~24 hours) or upgrade API plan
- **Log**: `[KeyError] Type: quota_exceeded | Code: 429`

### TIMEOUT (no status code)
- **Symptom**: "Gemini request timed out after 55000ms"
- **Action**: Automatic retry up to 3 times with exponential backoff
- **Solution**: Usually temporary, retries succeed on subsequent attempts
- **Log**: `[ChunkProcessor] Timeout after 55000ms...`

### INVALID_KEY (401/403)
- **Symptom**: "unauthorized" or "invalid" in error message
- **Action**: Logged as error, automatic retry
- **Solution**: Verify key format and permissions in Supabase
- **Log**: `[KeyError] Type: invalid_key | Code: 401`

## How to Read Logs During Extraction

### 1. Watch the Key Selection
```
[QuotaManager] Selected key via RPC: My-API-Key-1 (ID: abc123cd...) | Remaining: 19/20
↑ You're using this key for the extraction
```

### 2. Monitor API Calls
```
[ChunkProcessor] → Gemini API | attempt 1/3 | pages 1-5 | 17282 chars | keyId=abc123cd...
[ChunkProcessor] ← 25 courses | 9715 tokens
↑ Call succeeded, got 25 courses back
```

### 3. If You See an Error
```
[ChunkProcessor] ERROR (QUOTA_EXCEEDED) | KeyId=def456gh... | Attempt 1/3 | Pages 1-5 | Status: 429
[ChunkProcessor] Timeout after 55000ms (pages 1-5)
[ChunkProcessor] Retrying (QUOTA_EXCEEDED): attempt 1/3...
↑ Hit quota limit, will retry based on error type
```

### 4. Completion Status
```
[Extract] Complete | 51 courses | 120000ms | tokens: 16282
↑ Extraction succeeded with accumulative course count
```

## Debugging Checklist

If extraction fails, check logs in this order:

1. **API Key Selection**
   - `Does QuotaManager say which key was selected?`
   -  Should see: `Selected key via RPC: {nickname} (ID: {id}) | Remaining: X/20`

2. **First API Call**
   - `Is ChunkProcessor making the call with the selected key?`
   -  Should see: `→ Gemini API | attempt 1/3 | pages X-Y | keyId={id}`

3. **API Error**
   - `What error type is being returned?`
   -  Should see: `ERROR ({TYPE}) | KeyId={id} | Status: {code}`

4. **Retry Behavior**
   - `Does ChunkProcessor retry after errors?`
   -  Should see: `Retrying ({TYPE}): attempt 1/3...` (up to 3 times)

5. **Final Status**
   - `Does extraction complete or fail?`
   -  Should see: `Complete | {count} courses | {time}ms`
   -  Should see: `Fatal error | KeyId={id} | Status: {code}`

## Common Issues & Solutions

### Issue: `No API keys available`
```
[Extract] POST: No API keys available
```
**Check:**
1. Are there active keys in the Supabase `api_keys` table?
2. Is the service role client properly authenticated?
3. Is the `SUPABASE_SERVICE_ROLE_KEY` environment variable set?

### Issue: Repeated timeouts on same key
```
[ChunkProcessor] Timeout after 55000ms (pages 1-5)
[ChunkProcessor] Timeout after 55000ms (pages 1-5) [retry 1]
[ChunkProcessor] Timeout after 55000ms (pages 1-5) [retry 2]
[ChunkProcessor] Timeout — all retries exhausted
```
**Check:**
1. Is Gemini API responding at all? (check status.google.com)
2. Is the network connection stable?
3. Try with a different API key to see if it's key-specific

### Issue: Quota exceeded immediately
```
[ChunkProcessor] ERROR (QUOTA_EXCEEDED) | ... | Status: 429
```
**Check:**
1. Run: `SELECT quota_used_today, quota_daily_limit FROM api_keys`
2. If `quota_used_today >= 20`, you've hit the daily limit
3. Wait until midnight UTC for reset, or use a different key

### Issue: Leaked key detected
```
[ChunkProcessor] FATAL ERROR (LEAKED_KEY): Key abc123cd... is unusable
[Extract] ALERT: API key abc123cd... is leaked, deactivating...
```
**Check:**
1. Key is automatically deactivated
2. Remove from Supabase or create new API key at aistudio.google.com
3. Next extraction will use a different key

## Real-Time Monitoring

To watch logs as they happen:
```bash
# In one terminal, run the dev server
pnpm run dev

# In another terminal, tail the console output
# (Logs appear in the pnpm dev output)
```

Key patterns to watch for:
- `Selected key via RPC: {name} | Remaining: {N}/20`
- `← {N} courses | {T} tokens`
- `Complete | {N} courses | {time}ms`

## API Usage Logs

Errors are also logged to the `api_usage_logs` table in Supabase:
```sql
SELECT * FROM api_usage_logs 
WHERE api_key_id = 'abc123cd...' 
ORDER BY created_at DESC
LIMIT 10;
```

Columns of interest:
- `status`: 'success' | 'error' | 'timeout' | 'rate_limited'
- `error_message`: Full error text
- `api_key_id`: Which key was used
- `created_at`: When the error occurred
