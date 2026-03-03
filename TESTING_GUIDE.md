# Extraction & Mapping Test Guide

This guide walks through testing the complete extraction pipeline with sample data.

## Prerequisites

### 1. Environment Setup

Create `.env.local` in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Gemini
GEMINI_API_KEY=your-gemini-api-key
```

**How to obtain:**
- Supabase: Create account at https://supabase.com, create project, copy URL & keys from Settings
- Gemini: Get API key from https://makersuite.google.com/app/apikey

### 2. Supabase Migrations

Deploy all migrations to your Supabase project:

```bash
# Install CLI (if needed)
npm install -g @supabase/cli

# Link to project
supabase link

# Deploy migrations
supabase db push
```

This creates:
- 9 tables (states, schools, uploads, master_courses, extracted_courses, etc.)
- 32 indexes optimized for search
- 9 normalization functions
- 27-pass mapping engine
- Analytics views

**Verify**: Check Supabase dashboard → SQL Editor → `SELECT * FROM states;` should show states table.

### 3. Add Florida Master Data (Optional)

Before mapping, populate the master database:

```bash
# Create CSV: fl_master.csv
course_code,name,category
6101010,English I,English Language Arts
6101020,AP English Language and Composition,English Language Arts
132310,Physics I,Science
132330,AP Chemistry,Science
201005,Algebra I,Mathematics
# ... add more rows
```

Then import via API (see Step 5 below).

## Test Execution

### Step 1: Start Development Server

```bash
pnpm dev
```

Open http://localhost:3000 in browser to verify frontend loads.

### Step 2: Create Test PDF

Generate sample school catalog:

```bash
node scripts/generate-test-pdf.js
# Created: public/test-catalog.pdf
```

The PDF contains Orlando High School courses formatted for extraction.

### Step 3: Upload PDF for Extraction

**Option A: Via Browser**

Navigate to http://localhost:3000/extract

Fill form with:
- **School Name**: Orlando High School
- **State**: Florida
- **PDF File**: Select `public/test-catalog.pdf`

Click **Extract**. You'll receive:
```json
{
  "upload_id": "uuid",
  "school_slug": "orlando-high-school"
}
```

**Option B: Via curl**

```bash
curl -X POST http://localhost:3000/api/extract \
  -F "school_name=Orlando High School" \
  -F "state=Florida" \
  -F "file=@public/test-catalog.pdf"
```

Expected response (201):
```json
{
  "upload_id": "550e8400-e29b-41d4-a716-446655440000",
  "school_slug": "orlando-high-school"
}
```

### Step 4: Poll Extraction Status

Call repeatedly with `upload_id` from Step 3:

```bash
curl http://localhost:3000/api/extract/[uploadId]
```

Expected states:
1. `processing` → Extracting PDF with Gemini
2. `complete` → Done (see `courses_found`, `dupes_removed`, `processing_ms`)
3. `failed` → Check `error_message` field

**Example response (complete)**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "school_slug": "orlando-high-school",
  "status": "complete",
  "courses_found": 10,
  "dupes_removed": 0,
  "processing_ms": 3500,
  "error_message": null
}
```

### Step 5: Verify Extracted Courses in Database

Query Supabase directly:

```sql
-- View all extracted courses from Orlando
SELECT 
  id, course_code, name, category, created_at
FROM extracted_courses
WHERE school_slug = 'orlando-high-school'
ORDER BY course_code;
```

Expected columns populated:
- `course_code`: Auto-detected 6-7 digit codes (6101010, 132310, etc.)
- `name`: Course title
- `category`: Subject area
- Pre-indexed normalized columns: `code_normalized`, `name_upper`, `name_no_spaces`, etc.

### Step 6: Run Mapping (Florida)

If you added Florida master data in Step 3, run 27-pass mapping:

```bash
curl -X POST http://localhost:3000/api/map \
  -H "Content-Type: application/json" \
  -d '{
    "school_slug": "orlando-high-school",
    "state_code": "FL"
  }'
```

Expected response:
```json
[
  { "mapping_logic": "Pass 1: Exact course code match", "count": 8 },
  { "mapping_logic": "Pass 5: Name exact match", "count": 2 },
  { "mapping_logic": "Pass 12: Name contains state code", "count": 0 },
  ...
  { "mapping_logic": "Unmatched courses", "count": 0 }
]
```

### Step 7: Verify Mapping Results

Query the mapping result junction table:

```sql
SELECT 
  ec.course_code,
  ec.name,
  mc.course_code as master_code,
  mr.match_type,
  mr.confidence_score
FROM mapping_results mr
JOIN extracted_courses ec ON mr.extracted_course_id = ec.id
JOIN master_courses mc ON mr.master_course_id = mc.id
WHERE ec.school_slug = 'orlando-high-school'
ORDER BY mr.match_type, mr.created_at;
```

## Debugging

### Issue: "403 Forbidden" on Supabase calls

**Fix**: Check `.env.local` Supabase keys are correct and service_role_key is in env.

### Issue: School extraction returns empty courses

**Possible causes**:
1. PDF doesn't contain valid course codes (6-7 digit format)
2. State detection failed (ensure PDF mentions FL state)
3. Gemini API rate limit hit (wait 60s)

**Debug**: Check Next.js console logs for `[uploadId]` prefix showing extraction steps.

### Issue: Mapping returns 0 matches

**Causes**:
1. Florida master_courses table empty (need Step 3 data)
2. Course codes don't exactly match master database format
3. Course names too different in spelling/abbreviation

**Fix**: Add course synonyms to handle variations:

```bash
curl -X POST http://localhost:3000/api/synonyms \
  -H "Content-Type: application/json" \
  -d '{
    "state_code": "FL",
    "alias_name": "AP English Composition",
    "master_code": "6101020"
  }'
```

Then re-run mapping (with `"reset": true` flag to clear old results).

## Performance Expectations

| Operation | Expected Time |
|-----------|---------------|
| PDF upload & state detection | < 1s |
| Gemini extraction (10 courses) | 2-5s |
| Batch Supabase insert | 1-2s |
| Full extraction pipeline | 3-8s |
| 27-pass mapping × 200 courses | 5-15s |
| Index queries (all 32 indexes) | < 100ms |

## Logs & Tracing

Each operation uses `[uploadId]` prefix in logs:

```
[550e8400...] Parsing PDF
[550e8400...] Detected state: FL
[550e8400...] Created 3 chunks
[550e8400...] Extracted 10 courses via Gemini
[550e8400...] Deduped: 0 duplicates removed
[550e8400...] Upserted 10 courses to database
```

Check browser console (in /extract page) or Next.js terminal for full trace.

## Next Steps

1. **Frontend UI**: Implement /extract, /mapping, /master-db pages with real forms
2. **Batch upload**: Handle multiple PDFs per school
3. **Review workflow**: Implement mapping_results review status transitions
4. **Analytics**: Query views for dashboard metrics
5. **Export**: CSV export of all mapping results
