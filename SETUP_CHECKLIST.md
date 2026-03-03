# Setup Checklist

Complete this checklist to get the extraction pipeline running.

## Phase 1: Credentials (10 min)

- [ ] Create Supabase account at https://supabase.com
- [ ] Create new project (choose region closest to you)
- [ ] Copy project URL from Settings → API
- [ ] Copy `anon` public key from Settings → API
- [ ] Copy `service_role` secret key from Settings → API
- [ ] Get Google Gemini API key from https://makersuite.google.com/app/apikey

## Phase 2: Environment Setup (5 min)

- [ ] Copy `.env.local.example` to `.env.local`
- [ ] Fill in 3 Supabase keys and Gemini API key
- [ ] Verify `.env.local` is in `.gitignore` (never commit secrets)

```bash
# Quick check
cat .env.local | head -4
```

## Phase 3: Database Migrations (10 min)

Option A: **Via Supabase Dashboard (Easiest)**
- [ ] Go to Supabase Dashboard → SQL Editor
- [ ] For each migration file (supabase/migrations/001-004):
  - [ ] Copy entire file content
  - [ ] Paste into SQL Editor
  - [ ] Click ▶ Run
  - [ ] Verify "Success" appears

Option B: **Via CLI (Advanced)**
- [ ] Install: `npm install -g supabase`
- [ ] Link: `supabase link --project-ref your-project-id`
- [ ] Deploy: `supabase db push`

**Verification**: In Supabase Dashboard SQL Editor, run:
```sql
SELECT COUNT(*) as total_tables FROM information_schema.tables WHERE table_schema = 'public';
```
Expected: `9` tables

## Phase 4: Local Development (5 min)

- [ ] Start server: `pnpm dev`
- [ ] Open http://localhost:3000 in browser
- [ ] Verify page loads without errors
- [ ] Check terminal for any warnings

## Phase 5: Test Extraction (20 min)

### Step 1: Generate Test PDF
```bash
node scripts/generate-test-pdf.js
# Output: public/test-catalog.pdf
```

### Step 2: Upload via API
```bash
curl -X POST http://localhost:3000/api/extract \
  -F "school_name=Orlando High School" \
  -F "state=Florida" \
  -F "file=@public/test-catalog.pdf"
```

Save the `upload_id` from response.

### Step 3: Poll Status
```bash
curl http://localhost:3000/api/extract/{upload_id}
```

Repeat every 2 seconds until `"status": "complete"`

### Step 4: Verify Database
In Supabase SQL Editor:
```sql
SELECT COUNT(*) FROM extracted_courses WHERE school_slug = 'orlando-high-school';
```

Expected: Should see course count > 0

## Phase 6: Test Mapping (10 min)

### Prerequisite: Add Master Data
Create `fl_master.csv`:
```csv
course_code,name,category
6101010,English I,English Language Arts
6101020,AP English Language and Composition,English Language Arts
132310,Physics I,Science
132330,AP Chemistry,Science
201005,Algebra I,Mathematics
201035,AP Calculus AB,Mathematics
2100010,World History,Social Studies
2100020,AP US Government and Politics,Social Studies
5100005,Visual Arts I,Fine Arts
5200010,Music Theory I,Fine Arts
```

### Upload Master Data
```bash
curl -X POST http://localhost:3000/api/master-db/import \
  -F "file=@fl_master.csv"
```

### Run Mapping
```bash
curl -X POST http://localhost:3000/api/map \
  -H "Content-Type: application/json" \
  -d '{"school_slug": "orlando-high-school", "state_code": "FL"}'
```

Expected: Array showing match counts across 27 passes

## Phase 7: Commit

- [ ] Run tests: `pnpm test` (if applicable)
- [ ] Build: `pnpm build` (verify no errors)
- [ ] Commit: `git add . && git commit -m "setup: complete Supabase migration and test extraction [v1.1.0]"`

## Troubleshooting

| Issue | Check |
|-------|-------|
| 500 error on /api/extract | `.env.local` Supabase keys valid? |
| "No courses found" | PDF has valid course codes (6-7 digits)? |
| Mapping returns no matches | Master data imported to FL master_courses table? |
| "CORS error" | Using localhost:3000, not IP address? |
| Slow extraction | Gemini API rate limits (wait 60 sec)? |

See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for detailed debugging steps.

## Next: Frontend Implementation

Once extraction is verified working:
1. Implement form UI on /extract page
2. Implement real-time progress bar
3. Implement mapping visualization on /mapping page
4. Implement CSV import on /master-db page
