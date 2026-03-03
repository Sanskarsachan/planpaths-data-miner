-- ================================================================
-- planpaths-data-miner | Migration 001: Core Schema
-- ================================================================
-- Run this first. Creates all tables, indexes, and analytics views.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── STATES ──────────────────────────────────────────────────────
CREATE TABLE states (
  code       VARCHAR(2) PRIMARY KEY,   -- 'FL', 'TX', 'CA'
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO states (code, name) VALUES
  ('FL', 'Florida'),
  ('TX', 'Texas'),
  ('CA', 'California');

-- ── SCHOOLS ─────────────────────────────────────────────────────
CREATE TABLE schools (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  slug       TEXT        UNIQUE NOT NULL,  -- 'lincoln-high-miami-fl'
  state_code VARCHAR(2)  REFERENCES states(code),
  district   TEXT,
  city       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── UPLOADS ─────────────────────────────────────────────────────
CREATE TABLE uploads (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID        REFERENCES schools(id),
  school_slug    TEXT        NOT NULL,
  filename       TEXT        NOT NULL,
  state_code     VARCHAR(2)  REFERENCES states(code),
  status         TEXT        DEFAULT 'processing', -- processing|complete|failed
  total_chunks   INT         DEFAULT 0,
  courses_found  INT         DEFAULT 0,
  dupes_removed  INT         DEFAULT 0,
  processing_ms  INT,
  error_message  TEXT,
  uploaded_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at   TIMESTAMPTZ
);

-- ── MASTER COURSES (unified FL + TX + CA) ───────────────────────
CREATE TABLE master_courses (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code       VARCHAR(2)  NOT NULL REFERENCES states(code),

  -- Common across all states
  course_code      TEXT        NOT NULL,
  course_name      TEXT        NOT NULL,
  abbrev_name      TEXT,                     -- FL: abbreviated title column
  category         TEXT,
  sub_category     TEXT,
  grade_level      TEXT,                     -- '9-12', 'K-5', '6-8'
  credit           TEXT,                     -- '1', '0.5'

  -- FL-specific
  level_length     TEXT,                     -- '3Y', '2S'
  course_length    TEXT,                     -- '3', '2'
  level            TEXT,                     -- 'Y'=year, 'S'=semester
  grad_requirement TEXT,                     -- 'PF', 'ELA', 'MATH'
  subject_tag      TEXT,                     -- 'HUMANITIES', 'ART'
  certification    TEXT,
  sr_no            INT,
  source_filename  TEXT,

  -- TX-specific
  tea_code         TEXT,
  endorsement      TEXT,

  -- CA-specific
  uc_approved      BOOLEAN,
  ag_category      TEXT,
  cte_pathway      TEXT,

  -- Lifecycle
  is_active        BOOLEAN     DEFAULT TRUE,
  termination_date DATE,
  effective_date   DATE,

  -- Pre-computed normalized columns (populated by trigger in 002)
  code_normalized   TEXT,
  name_upper        TEXT,
  name_no_spaces    TEXT,
  abbrev_upper      TEXT,
  abbrev_no_spaces  TEXT,
  name_skeleton     TEXT,
  name_sorted_words TEXT,
  name_roman_norm   TEXT,   -- roman numerals → arabic
  name_honors_norm  TEXT,   -- honors position normalized
  name_ap_norm      TEXT,   -- AP → Advanced Placement
  name_ib_norm      TEXT,   -- IB → International Baccalaureate

  imported_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (state_code, course_code)
);

CREATE INDEX idx_mc_state        ON master_courses(state_code);
CREATE INDEX idx_mc_code         ON master_courses(course_code);
CREATE INDEX idx_mc_code_norm    ON master_courses(state_code, code_normalized);
CREATE INDEX idx_mc_active       ON master_courses(state_code, is_active);
CREATE INDEX idx_mc_grade        ON master_courses(grade_level);
CREATE INDEX idx_mc_name_upper   ON master_courses(state_code, name_upper);
CREATE INDEX idx_mc_name_ns      ON master_courses(state_code, name_no_spaces);
CREATE INDEX idx_mc_abbrev_upper ON master_courses(state_code, abbrev_upper);
CREATE INDEX idx_mc_abbrev_ns    ON master_courses(state_code, abbrev_no_spaces);
CREATE INDEX idx_mc_skeleton     ON master_courses(state_code, name_skeleton);
CREATE INDEX idx_mc_sorted       ON master_courses(state_code, name_sorted_words);
CREATE INDEX idx_mc_roman        ON master_courses(state_code, name_roman_norm);
CREATE INDEX idx_mc_honors       ON master_courses(state_code, name_honors_norm);
CREATE INDEX idx_mc_ap           ON master_courses(state_code, name_ap_norm);
CREATE INDEX idx_mc_ib           ON master_courses(state_code, name_ib_norm);
CREATE INDEX idx_trgm_mc_name    ON master_courses USING GIN (course_name gin_trgm_ops);
CREATE INDEX idx_trgm_mc_abbrev  ON master_courses USING GIN (abbrev_name gin_trgm_ops);

-- ── COURSE SYNONYMS ─────────────────────────────────────────────
CREATE TABLE course_synonyms (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code  VARCHAR(2)  REFERENCES states(code),
  alias_name  TEXT        NOT NULL,
  alias_upper TEXT,                          -- populated by trigger in 002
  master_code TEXT        NOT NULL,          -- course_code in master_courses
  verified_by TEXT        DEFAULT 'system',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (state_code, alias_name)
);

CREATE INDEX idx_syn_lookup ON course_synonyms(state_code, alias_upper);

-- ── EXTRACTED COURSES ────────────────────────────────────────────
CREATE TABLE extracted_courses (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id        UUID        REFERENCES uploads(id) ON DELETE CASCADE,
  school_id        UUID        REFERENCES schools(id),
  school_slug      TEXT        NOT NULL,
  state_code       VARCHAR(2)  NOT NULL REFERENCES states(code),

  -- Core extracted fields
  course_name      TEXT        NOT NULL,
  course_code      TEXT,
  category         TEXT,         -- subject area header from PDF section
  sub_category     TEXT,
  grade_level      TEXT,
  credits          TEXT,
  length           TEXT,         -- raw string from PDF
  prerequisite     TEXT,
  description      TEXT,

  -- FL-specific
  course_duration  TEXT,         -- from '3/Y' → '3'
  course_term      TEXT,         -- from '3/Y' → 'Y'
  grad_requirement TEXT,
  honors_flag      BOOLEAN       DEFAULT FALSE,

  -- TX-specific
  tea_code         TEXT,
  endorsement      TEXT,

  -- CA-specific
  uc_approved      BOOLEAN,
  ag_category      TEXT,
  cte_pathway      TEXT,

  -- Pre-computed normalized columns (populated by trigger in 002)
  code_normalized   TEXT,
  name_upper        TEXT,
  name_no_spaces    TEXT,
  name_skeleton     TEXT,
  name_sorted_words TEXT,
  name_roman_norm   TEXT,
  name_honors_norm  TEXT,
  name_ap_norm      TEXT,
  name_ib_norm      TEXT,

  -- Quality metadata
  confidence_score FLOAT       DEFAULT 0.0,
  field_scores     JSONB,       -- { CourseName: 0.9, CourseCode: 1.0, ... }
  chunk_index      INT,
  raw_ai_output    JSONB,       -- original AI JSON for debugging
  is_duplicate     BOOLEAN     DEFAULT FALSE,
  content_hash     TEXT,        -- SHA-256 of name|code|school_slug (first 16 hex chars)

  extracted_at     TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent cross-upload duplicates for same school
  UNIQUE (school_slug, content_hash)
);

CREATE INDEX idx_ec_school    ON extracted_courses(school_slug);
CREATE INDEX idx_ec_state     ON extracted_courses(state_code);
CREATE INDEX idx_ec_upload    ON extracted_courses(upload_id);
CREATE INDEX idx_ec_code_norm ON extracted_courses(code_normalized);
CREATE INDEX idx_ec_name_up   ON extracted_courses(name_upper);
CREATE INDEX idx_ec_name_ns   ON extracted_courses(name_no_spaces);
CREATE INDEX idx_ec_skeleton  ON extracted_courses(name_skeleton);
CREATE INDEX idx_ec_sorted    ON extracted_courses(name_sorted_words);
CREATE INDEX idx_ec_roman     ON extracted_courses(name_roman_norm);
CREATE INDEX idx_ec_honors    ON extracted_courses(name_honors_norm);
CREATE INDEX idx_ec_ap        ON extracted_courses(name_ap_norm);
CREATE INDEX idx_ec_ib        ON extracted_courses(name_ib_norm);
CREATE INDEX idx_ec_duplicate ON extracted_courses(is_duplicate);

-- ── MAPPING RESULTS ──────────────────────────────────────────────
CREATE TABLE mapping_results (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  extracted_id     UUID        UNIQUE NOT NULL REFERENCES extracted_courses(id) ON DELETE CASCADE,
  state_code       VARCHAR(2)  NOT NULL REFERENCES states(code),
  master_course_id UUID        REFERENCES master_courses(id),  -- NULL = unmatched

  match_type       TEXT        NOT NULL,
  confidence       FLOAT       NOT NULL DEFAULT 0.0,
  matched_code     TEXT,
  matched_name     TEXT,
  matched_abbrev   TEXT,

  review_status    TEXT        DEFAULT 'auto',
  reviewed_by      TEXT,
  reviewed_at      TIMESTAMPTZ,
  review_notes     TEXT,

  mapped_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mr_type       ON mapping_results(match_type);
CREATE INDEX idx_mr_confidence ON mapping_results(confidence);
CREATE INDEX idx_mr_status     ON mapping_results(review_status);
CREATE INDEX idx_mr_state      ON mapping_results(state_code);

-- ── ANALYTICS VIEWS ──────────────────────────────────────────────

CREATE OR REPLACE VIEW vw_fl_mapping_summary AS
SELECT
  mr.match_type                                          AS mapping_logic,
  COUNT(*)                                               AS count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2)    AS pct
FROM mapping_results mr
JOIN extracted_courses ec ON mr.extracted_id = ec.id
WHERE ec.state_code = 'FL'
GROUP BY mr.match_type
ORDER BY count DESC;

CREATE OR REPLACE VIEW vw_school_mapping_summary AS
SELECT
  ec.school_slug,
  ec.state_code,
  mr.match_type                                          AS mapping_logic,
  COUNT(*)                                               AS count,
  ROUND(AVG(mr.confidence) * 100, 1)                    AS avg_confidence_pct
FROM mapping_results mr
JOIN extracted_courses ec ON mr.extracted_id = ec.id
GROUP BY ec.school_slug, ec.state_code, mr.match_type
ORDER BY ec.school_slug, count DESC;

CREATE OR REPLACE VIEW vw_school_courses AS
SELECT
  ec.school_slug,
  ec.state_code,
  ec.course_name,
  ec.course_code,
  ec.category,
  ec.grade_level,
  ec.credits,
  ec.course_duration,
  ec.course_term,
  ec.grad_requirement,
  ec.honors_flag,
  ec.confidence_score    AS extraction_confidence,
  mr.match_type          AS mapping_logic,
  mr.confidence          AS mapping_confidence,
  mr.matched_code        AS master_code,
  mr.matched_name        AS master_name,
  mr.review_status,
  mc.category            AS master_category,
  mc.sub_category        AS master_sub_category,
  mc.grad_requirement    AS master_grad_req,
  mc.credit              AS master_credit,
  mc.level               AS master_level,
  mc.is_active           AS master_is_active,
  mc.termination_date    AS master_termination_date
FROM extracted_courses ec
LEFT JOIN mapping_results mr ON mr.extracted_id    = ec.id
LEFT JOIN master_courses   mc ON mr.master_course_id = mc.id
WHERE ec.is_duplicate = FALSE;
