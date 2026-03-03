# API Quick Reference

## Overview

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/extract` | POST | Upload PDF for course extraction |
| `/api/extract/[uploadId]` | GET | Poll extraction status |
| `/api/schools` | GET | List all schools |
| `/api/schools` | POST | Create/upsert school |
| `/api/map` | POST | Trigger 27-pass mapping |
| `/api/synonyms` | POST | Add course synonym |
| `/api/master-db/import` | POST | Import master course CSV |

---

## 1. POST /api/extract

**Extract courses from PDF using Gemini AI**

### Request
```bash
curl -X POST http://localhost:3000/api/extract \
  -F "school_name=Orlando High School" \
  -F "state=Florida" \
  -F "file=@./catalog.pdf"
```

**Form Fields:**
- `school_name` (string, required): School name
- `state` (string, required): State (e.g., "Florida", "Texas")
- `file` (file, required): PDF file (max 50MB)

### Response (201 Created)
```json
{
  "upload_id": "550e8400-e29b-41d4-a716-446655440000",
  "school_slug": "orlando-high-school"
}
```

### How It Works
1. Parses PDF text
2. Auto-detects state code (FL, TX, CA, etc.)
3. Chunks content by section size
4. Calls Gemini API (max 5 concurrent) to extract courses
5. Deduplicates by SHA-256(school_slug + content_hash)
6. Upserts to `extracted_courses` table
7. Returns immediately; processing happens async via setImmediate

### Error Responses
- `400`: Missing school_name, state, or file
- `500`: PDF parsing failed or Gemini API error

---

## 2. GET /api/extract/[uploadId]

**Poll extraction job status**

### Request
```bash
curl http://localhost:3000/api/extract/550e8400-e29b-41d4-a716-446655440000
```

### Response
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "school_slug": "orlando-high-school",
  "status": "complete",
  "courses_found": 10,
  "dupes_removed": 0,
  "processing_ms": 3500,
  "error_message": null,
  "created_at": "2025-01-24T12:00:00Z",
  "updated_at": "2025-01-24T12:00:03.5Z"
}
```

**Status values:**
- `processing`: Job running
- `complete`: Success
- `failed`: Error occurred (see `error_message`)

---

## 3. GET /api/schools

**List all schools**

### Request
```bash
curl http://localhost:3000/api/schools
```

### Response (200 OK)
```json
[
  {
    "id": "uuid1",
    "name": "Orlando High School",
    "slug": "orlando-high-school",
    "state_code": "FL",
    "created_at": "2025-01-24T12:00:00Z"
  },
  {
    "id": "uuid2",
    "name": "Austin High School",
    "slug": "austin-high-school",
    "state_code": "TX",
    "created_at": "2025-01-24T12:05:00Z"
  }
]
```

---

## 4. POST /api/schools

**Create or update a school**

### Request
```bash
curl -X POST http://localhost:3000/api/schools \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Miami Central High",
    "slug": "miami-central-high",
    "state_code": "FL"
  }'
```

**Fields:**
- `name` (string, required): School name
- `slug` (string, required): URL-friendly identifier
- `state_code` (string, required): Two-letter state code (FL, TX, CA)

### Response (201 Created)
```json
{
  "id": "uuid3",
  "name": "Miami Central High",
  "slug": "miami-central-high",
  "state_code": "FL",
  "created_at": "2025-01-24T12:10:00Z"
}
```

---

## 5. POST /api/map

**Trigger 27-pass SQL mapping engine**

Matches extracted courses to master database using 27 different matching strategies.

### Request
```bash
curl -X POST http://localhost:3000/api/map \
  -H "Content-Type: application/json" \
  -d '{
    "school_slug": "orlando-high-school",
    "state_code": "FL",
    "reset": false
  }'
```

**Fields:**
- `school_slug` (string, required): School slug
- `state_code` (string, required): Two-letter state code
- `reset` (boolean, optional): Clear old mapping results before running (default: false)

### Response (200 OK)
```json
[
  { "mapping_logic": "Pass 1: Exact course code match", "count": 8 },
  { "mapping_logic": "Pass 2: Course code contains master code", "count": 1 },
  { "mapping_logic": "Pass 5: Exact name match (case insensitive)", "count": 2 },
  { "mapping_logic": "Pass 12: Name skeleton match", "count": 0 },
  { "mapping_logic": "Pass 27: Unmatched courses", "count": 1 }
]
```

**Pass summary**: Returns array of all 27 passes with match counts per pass.

---

## 6. POST /api/synonyms

**Add course synonym for manual mapping**

Used to link extracted course names to master course codes when automated matching fails.

### Request
```bash
curl -X POST http://localhost:3000/api/synonyms \
  -H "Content-Type: application/json" \
  -d '{
    "state_code": "FL",
    "alias_name": "AP English Composition",
    "master_code": "6101020"
  }'
```

**Fields:**
- `state_code` (string, required): State code
- `alias_name` (string, required): Extracted course name variant
- `master_code` (string, required): Master database course code

### Response (201 Created)
```json
{
  "state_code": "FL",
  "alias_name": "AP English Composition",
  "master_code": "6101020",
  "created_at": "2025-01-24T12:15:00Z"
}
```

---

## 7. POST /api/master-db/import

**Import master course database from CSV**

### Request
```bash
curl -X POST http://localhost:3000/api/master-db/import \
  -F "file=@fl_master.csv"
```

**CSV format** (header required):
```csv
course_code,name,category
6101010,English I,English Language Arts
6101020,AP English Language and Composition,English Language Arts
132310,Physics I,Science
```

### Response (201 Created)
```json
{
  "staged_count": 100,
  "import_result": {
    "total_inserted": 100,
    "categories": 8,
    "six_digit_codes": 75,
    "seven_digit_codes": 25,
    "trigger_fired": true,
    "honors_normalized": true
  }
}
```

---

## Rate Limiting & Timeouts

| Endpoint | Timeout | Limit |
|----------|---------|-------|
| /api/extract | 60s (via setImmediate async) | 1 PDF per request |
| /api/extract/[id] | 5s | 100 polls/min |
| /api/schools | 5s | 1000 queries/min |
| /api/map | 30s | 10 mappings/min per school |
| /api/synonyms | 5s | 100 inserts/min |

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Missing required fields |
| 404 | Resource not found (school_slug, master_code) |
| 500 | Server error (check logs) |
| 503 | Gemini API rate limited (wait 60s) |

---

## Complete Workflow Example

```bash
# 1. Extract courses from PDF
UPLOAD=$(curl -s -X POST http://localhost:3000/api/extract \
  -F "school_name=Orlando High" \
  -F "state=Florida" \
  -F "file=@test-catalog.pdf" | jq -r '.upload_id')

# 2. Poll until complete
until [[ $(curl -s http://localhost:3000/api/extract/$UPLOAD | jq -r '.status') == "complete" ]]; do
  sleep 2
  echo "Status: $(curl -s http://localhost:3000/api/extract/$UPLOAD | jq -r '.status')"
done

# 3. Run mapping
curl -X POST http://localhost:3000/api/map \
  -H "Content-Type: application/json" \
  -d "{\"school_slug\": \"orlando-high\", \"state_code\": \"FL\"}" | jq '.'

# 4. Check results in Supabase
# SELECT * FROM mapping_results WHERE school_slug = 'orlando-high'
```

---

## Database Reference

**Tables:**
- `schools`: School metadata
- `uploads`: PDF upload jobs
- `extracted_courses`: Courses extracted from PDFs
- `master_courses`: Official state master database
- `mapping_results`: Extracted ↔ Master mappings
- `course_synonyms`: Manual course name aliases

See [README.md](./README.md) for full schema.
