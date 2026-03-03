# PlanPaths Data Miner v1.0.0

Extract school course catalogs from PDF → store in Supabase → map to state master databases using a 27-pass SQL matching engine.

**States**: Florida (complete) → Texas → California (extensible pattern)  
**Stack**: Next.js 15 · TypeScript · Supabase (PostgreSQL 15) · Google Gemini 2.5 Flash · Tailwind CSS  

## Quick Start

### 1. Setup

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.local.example .env.local
# Edit .env.local with Supabase credentials and API keys

# Deploy Supabase migrations
pnpm supabase db push
```

### 2. Run Development Server

```bash
pnpm dev
# Open http://localhost:3000
```

### 3. Upload PDF & Extract Courses

1. Navigate to `/extract`
2. Upload a school catalog PDF
3. System auto-detects state (FL/TX/CA)
4. SmartChunker splits by subject area headers
5. Gemini 2.5 Flash extracts courses (max 5 concurrent calls)
6. Deduplication checks cross-upload duplicates
7. Results stored in `extracted_courses` table

### 4. Run Mapping Engine

1. Navigate to `/mapping`
2. Select a school
3. Click "Run Mapping"
4. System executes 27 SQL passes in order
5. Each pass skips already-matched rows
6. Returns `mapping_logic | count` analytics table

### 5. Import Master Database

1. Navigate to `/master-db`
2. Upload state course catalog CSV
3. Staging table auto-populates
4. Trigger normalizes all columns
5. Master DB ready for mapping

## Architecture

### Flow

```
PDF Upload
  ↓
[StateDetector]     Detect FL / TX / CA from content + filename
  ↓
[SmartChunker]      Split at subject-section headers
  ↓
[GeminiExtractor]   Max 5 concurrent calls, strict JSON schema
  ↓
[Deduplicator]      SHA-256 hash: name|code|school_slug
  ↓
Supabase bulk INSERT
  ↓
PostgreSQL trigger auto-computes 10 normalized columns
  ↓
run_florida_mapping() 27 SQL passes in order
  ↓
Returns mapping_logic | count table
```

### Key Design Decisions

| Decision | Rationale |
|---|---|
| Single `extracted_courses` + `school_slug` | No dynamic table creation per school |
| Unified `master_courses` with `state_code` | Solves multi-state FK problem |
| Pre-computed normalized columns + trigger | Normalization fires once on INSERT. Mapping JOINs use B-tree indexed columns — zero per-row function calls |
| Synonym table for un-bridgeable gaps | "American Government" → "United States Government" — human curated |
| SQL-first mapping, AI fallback only | 27 passes handle ~80% at zero marginal cost. Only remaining ~20% need AI/review |
| Async extraction, sync mapping | Extraction async (Gemini calls). Mapping entirely in Supabase — no Vercel timeout concern |

## Database Schema

### Tables

- **states** — FL, TX, CA
- **schools** — name, slug, state_code, district, city
- **uploads** — track PDF extraction jobs
- **master_courses** — unified catalog (all states)
- **extracted_courses** — from PDF extraction
- **mapping_results** — extracted → master matches
- **course_synonyms** — curated aliases ("American Government" → "United States Government")

### Views

- **vw_fl_mapping_summary** — analytics: mapping_logic | count | pct
- **vw_school_mapping_summary** — per-school: mapping_logic | count | avg_confidence
- **vw_school_courses** — full joined view with all metadata

### Normalized Columns (Auto-Computed)

Each course triggers normalization on INSERT/UPDATE:

- `code_normalized` — uppercase, no spaces/hyphens
- `name_upper` — uppercase
- `name_no_spaces` — uppercase, remove spaces
- `name_skeleton` — only letters/digits
- `name_sorted_words` — words A-Z sorted
- `name_roman_norm` — Roman numerals → Arabic (II → 2)
- `name_honors_norm` — honors position normalized ("Biology II Honors" → "Biology Honors 2")
- `name_ap_norm` — AP → "Advanced Placement"
- `name_ib_norm` — IB → "International Baccalaureate"
- `abbrev_upper` — abbreviation uppercase

## Migrations

Run in order:

1. **001_schema.sql** — All tables, indexes, views
2. **002_functions_triggers_seeds.sql** — Normalization functions, triggers, synonym seeds
3. **003_mapping_engine.sql** — 27-pass `run_florida_mapping()` function
4. **004_master_db_import.sql** — CSV staging + import function

## API Routes

### `POST /api/extract`

Upload PDF for extraction.

**Request**: `multipart/form-data`
- `file` — PDF (up to 50MB)
- `school_name` — string
- `state_code` — `'FL' | 'TX' | 'CA'`
- `school_district?` — string
- `school_city?` — string

**Response**: `{ upload_id: string, school_slug: string }`

Returns immediately. Processing runs async. Poll status via `GET /api/extract/[uploadId]`.

### `GET /api/extract/[uploadId]`

Poll extraction status.

**Response**: Upload row with `status` ('processing' | 'complete' | 'failed')

### `POST /api/map`

Run SQL mapping for a school.

**Request**: `{ school_slug: string, state_code: StateCode, reset?: boolean }`

**Response**: Array of `{ mapping_logic: string, count: number }`

### `POST /api/synonyms`

Add a synonym.

**Request**: `{ state_code: StateCode, alias_name: string, master_code: string }`

### `POST /api/master-db/import`

Import master course CSV.

**Request**: `multipart/form-data` with `file` (CSV) + `state_code`

## 27-Pass Mapping Reference

| Pass | Name | Confidence | Logic |
|------|------|------------|-------|
| 0 | cpalms-terminated | 0.90 | Code match but master is inactive |
| 1 | exact-course-code | 1.00 | Normalized 6/7-digit code exact match |
| 2-4 | Code variants | 0.97-0.99 | Handle spacing, trailing digits/letters |
| 5-12 | Name variants | 0.89-0.95 | Different case/spacing/abbreviation combinations |
| 13-14 | Roman numerals | 0.91-0.93 | "Algebra II" ↔ "Algebra 2" |
| 15 | Honors position | 0.93 | "Biology II Honors" ↔ "Biology Honors 2" |
| 16-18 | AP/IB/Cambridge | 0.90-0.92 | Standardized prefix handling |
| 19-22 | Advanced | 0.78-0.88 | Skeleton, sorted words, conjunctions |
| 23-24 | Expansions | 0.88-0.89 | US → "United States", M/J → "Middle Junior" |
| 25 | Synonyms | 0.90 | Curated alias table |
| 26 | Prefix match | 0.78 | Extracted name is prefix of master (before ":" or "–") |
| 27 | K-5 deletion | 0.00 | Flag K-5 courses in HS catalogs for manual review |
| — | Unmatched | 0.00 | review_status = 'needs_review' |

## Development

### Version Management

Releases are semantic:
- `v1.0.0` — Initial setup, extraction pipeline working
- `v1.1.0` — Extraction complete, mapping engine live
- `v1.2.0` — Master DB import working
- `v2.0.0` — Texas mapping engine
- `v3.0.0` — California mapping engine

### Making Changes

```bash
# Create feature branch
git checkout -b feature/name

# Make changes, test locally
pnpm dev

# Small commit (single feature)
git add .
git commit -m "feat: description [skip ci]"

# Push and PR
git push origin feature/name
```

## Package Management

Using **pnpm** for faster installs and efficient disk usage.

```bash
# Install all dependencies
pnpm install

# Add a package
pnpm add package-name

# Install dev dependency
pnpm add -D @types/package

# Update all
pnpm update

# Lock file: pnpm-lock.yaml (commit to git)
```

## Troubleshooting

### Gemini API Key Issues

Ensure `GEMINI_API_KEY` is set in `.env.local`:

```bash
export GEMINI_API_KEY=your-key-here
```

### Supabase Connection

Check credentials in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### PDF Upload Size

If uploads fail, increase formidable max size in `/api/extract/route.ts`:

```typescript
const form = formidable({ maxFileSize: 100 * 1024 * 1024 }) // 100MB
```

## Production Deployment

### Vercel

1. Push to GitHub
2. Link repo to Vercel
3. Set environment variables
4. Deploy

**Note**: Extraction pipeline is async (uses `setImmediate`) to avoid 60-second Vercel timeout. Client polls for status.

### Run Script

```bash
pnpm build
pnpm start
```

## License

MIT

---

**Last Updated**: March 4, 2026  
**Maintainer**: PlanPaths Team
