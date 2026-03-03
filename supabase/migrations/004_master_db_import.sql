-- ================================================================
-- planpaths-data-miner | Migration 004: Master DB Import
-- ================================================================
-- Creates staging table for CSV import.
-- Target is unified master_courses table.
-- ================================================================

CREATE TABLE IF NOT EXISTS fl_master_staging (
  sr_no            TEXT,
  source           TEXT,
  category         TEXT,
  sub_category     TEXT,
  course_code      TEXT,
  abbrev_name      TEXT,
  course_name      TEXT,
  level_length     TEXT,
  course_length    TEXT,
  level            TEXT,
  grad_requirement TEXT,
  credit           TEXT,
  subject_tag      TEXT,
  source_filename  TEXT,
  grade_level      TEXT,
  certification    TEXT
);

-- Import function: call this after uploading CSV to fl_master_staging
CREATE OR REPLACE FUNCTION import_florida_master_db()
RETURNS TABLE(total BIGINT, categories BIGINT, six_digit BIGINT, seven_digit BIGINT, trigger_fired BIGINT, honors_norm BIGINT)
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO master_courses (
    state_code, sr_no, source, category, sub_category,
    course_code, abbrev_name, course_name,
    level_length, course_length, level,
    grad_requirement, credit, subject_tag,
    source_filename, grade_level, certification,
    is_active
  )
  SELECT
    'FL',
    NULLIF(TRIM(sr_no), '')::INT,
    NULLIF(TRIM(source), ''),
    NULLIF(TRIM(category), ''),
    NULLIF(TRIM(sub_category), ''),
    TRIM(course_code),
    NULLIF(TRIM(abbrev_name), ''),
    TRIM(course_name),
    NULLIF(TRIM(level_length), ''),
    NULLIF(TRIM(course_length), ''),
    NULLIF(TRIM(level), ''),
    NULLIF(TRIM(grad_requirement), ''),
    NULLIF(TRIM(credit), ''),
    NULLIF(TRIM(subject_tag), ''),
    NULLIF(TRIM(source_filename), ''),
    NULLIF(TRIM(grade_level), ''),
    NULLIF(TRIM(certification), ''),
    TRUE
  FROM fl_master_staging
  WHERE TRIM(course_code) <> ''
    AND TRIM(course_name) <> ''
    AND TRIM(course_code) NOT ILIKE '%code%'  -- skip any header rows
  ON CONFLICT (state_code, course_code) DO UPDATE SET
    abbrev_name      = EXCLUDED.abbrev_name,
    course_name      = EXCLUDED.course_name,
    level_length     = EXCLUDED.level_length,
    grad_requirement = EXCLUDED.grad_requirement,
    credit           = EXCLUDED.credit,
    category         = EXCLUDED.category,
    sub_category     = EXCLUDED.sub_category,
    updated_at       = NOW();

  -- Return import stats
  RETURN QUERY
  SELECT
    COUNT(*)                                                   AS total,
    COUNT(DISTINCT category)                                   AS categories,
    COUNT(CASE WHEN LENGTH(course_code) = 6 THEN 1 END)       AS six_digit_codes,
    COUNT(CASE WHEN LENGTH(course_code) = 7 THEN 1 END)       AS seven_digit_codes,
    COUNT(CASE WHEN code_normalized IS NOT NULL THEN 1 END)    AS trigger_fired,
    COUNT(CASE WHEN name_honors_norm IS NOT NULL THEN 1 END)   AS honors_norm_computed
  FROM master_courses
  WHERE state_code = 'FL';
END;
$$;
