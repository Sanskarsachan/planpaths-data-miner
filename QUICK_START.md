# Quick Start - 5 Minute Setup

## 1⃣ Environment (30 seconds)
```bash
cd /Users/sanskarsachan/Documents/planpaths-data-miner
cp .env.local.example .env.local
```

Open `.env.local` in editor and fill:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
SUPABASE_SERVICE_ROLE_KEY=your-key
GEMINI_API_KEY=your-key
```

If you are running Supabase locally, use:
```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<from supabase status>
GEMINI_API_KEY=your-key
```

**Where to get keys:**
- Supabase: https://supabase.com → Create project → Settings → API
- Gemini: https://makersuite.google.com/app/apikey

For local Supabase keys:
```bash
supabase start
supabase status
```

## 2⃣ Database Setup (2 minutes)

### Option A: Dashboard (Easy)
1. Go to https://app.supabase.com
2. Open SQL Editor
3. For each file (copy entire content):
   - `supabase/migrations/001_schema.sql` → Run
   - `supabase/migrations/002_functions_triggers_seeds.sql` → Run
   - `supabase/migrations/003_mapping_engine.sql` → Run
   - `supabase/migrations/004_master_db_import.sql` → Run

### Option B: CLI (Advanced)
```bash
supabase link --project-ref your-project-id
supabase db push
```

## 3⃣ Start Server (30 seconds)
```bash
pnpm dev
# Open http://localhost:3000
```

## 4⃣ Test Extraction (1 minute)

```bash
# Generate test PDF
node scripts/generate-test-pdf.js

# Upload PDF
UPLOAD=$(curl -s -X POST http://localhost:3000/api/extract \
  -F "school_name=Orlando High School" \
  -F "state=Florida" \
  -F "file=@public/test-catalog.pdf" | jq -r '.upload_id')

echo "Extraction started with upload_id: $UPLOAD"

# Poll until complete (repeat every 2 sec)
curl http://localhost:3000/api/extract/$UPLOAD | jq '.status, .courses_found'
```

Expected output (status="complete" after 3-8 seconds):
```json
"complete"
10
```

## Done!

All 6 API endpoints are ready to use:

| Endpoint | Command |
|----------|---------|
| Extract | `curl -X POST /api/extract -F ...` |
| Check Status | `curl /api/extract/[id]` |
| Schools | `curl /api/schools` |
| Map Courses | `curl -X POST /api/map -d ...` |
| Add Synonym | `curl -X POST /api/synonyms -d ...` |
| Import Master | `curl -X POST /api/master-db/import -F ...` |

See [API_REFERENCE.md](./API_REFERENCE.md) for full endpoint details.

---

## Documentation

- **Need help with setup?** → [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md)
- **Need test instructions?** → [TESTING_GUIDE.md](./TESTING_GUIDE.md)
- **Need API details?** → [API_REFERENCE.md](./API_REFERENCE.md)
- **What's new in v1.1.0?** → [COMPLETION_SUMMARY.md](./COMPLETION_SUMMARY.md)

---

## 🆘 If Something Goes Wrong

| Issue | Fix |
|-------|-----|
| 500 on /api/extract | Check .env.local keys |
| No courses found | Ensure PDF has valid course codes |
| Build fails | `pnpm install` then `pnpm build` |
| Database error | Run migrations again in SQL Editor |

See [TESTING_GUIDE.md](./TESTING_GUIDE.md#debugging) for detailed troubleshooting.

---

**You're ready! Start with Step 1 above.** 
