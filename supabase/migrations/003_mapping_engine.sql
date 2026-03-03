-- ================================================================
-- planpaths-data-miner | Migration 003: Florida Mapping Engine
-- ================================================================

CREATE OR REPLACE FUNCTION run_florida_mapping(p_school_slug TEXT)
RETURNS TABLE(mapping_logic TEXT, count BIGINT)
LANGUAGE plpgsql AS $$
BEGIN

  -- ── PASS 0: cpalms-terminated ───────────────────────────────
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT ec.id, 'FL', mc.id,
    'cpalms-terminated', 0.90,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code      = 'FL'
    AND ec.code_normalized = mc.code_normalized
    AND mc.is_active       = FALSE
  WHERE ec.school_slug = p_school_slug
    AND NOT EXISTS (
      SELECT 1 FROM master_courses mc2
      WHERE mc2.state_code      = 'FL'
        AND mc2.code_normalized = ec.code_normalized
        AND mc2.is_active       = TRUE
    )
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id);

  -- ── PASS 1: exact-course-code ─────────────────────────────────
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'exact-course-code', 1.00,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code      = 'FL'
    AND ec.code_normalized = mc.code_normalized
    AND mc.is_active       = TRUE
  WHERE ec.school_slug = p_school_slug
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id;

  -- ── PASS 2: exact-course-code-remblanks-match ─────────────────
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'exact-course-code-remblanks-match', 0.99,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code = 'FL'
    AND REPLACE(UPPER(COALESCE(ec.course_code, '')), ' ', '') = mc.code_normalized
    AND mc.is_active  = TRUE
  WHERE ec.school_slug = p_school_slug
    AND ec.course_code IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id;

  -- ── PASS 3: exact-8char-course-code-remove-last-match ─────────
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'exact-8char-course-code-remove-last-match', 0.97,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code = 'FL'
    AND LENGTH(ec.code_normalized) = LENGTH(mc.code_normalized) + 1
    AND LEFT(ec.code_normalized, LENGTH(mc.code_normalized)) = mc.code_normalized
    AND mc.is_active  = TRUE
  WHERE ec.school_slug = p_school_slug
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id;

  -- ── PASS 4: exact-8char-course-code-remove-last-character-match
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'exact-8char-course-code-remove-last-character-match', 0.96,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code = 'FL'
    AND LENGTH(ec.code_normalized) BETWEEN LENGTH(mc.code_normalized) + 1
                                       AND LENGTH(mc.code_normalized) + 2
    AND LEFT(ec.code_normalized, LENGTH(ec.code_normalized) - 1) = mc.code_normalized
    AND mc.is_active  = TRUE
  WHERE ec.school_slug = p_school_slug
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id;

  -- ── PASS 5: exact-course-name ─────────────────────────────────
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'exact-course-name', 0.95,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code  = 'FL'
    AND ec.course_name = mc.course_name
    AND mc.is_active   = TRUE
  WHERE ec.school_slug = p_school_slug
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id;

  -- ── PASS 6: exact-course-name-uppercase ───────────────────────
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'exact-course-name-uppercase', 0.94,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code = 'FL'
    AND ec.name_upper = mc.name_upper
    AND mc.is_active  = TRUE
  WHERE ec.school_slug = p_school_slug
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id;

  -- ── PASS 7: exact-course-name-remblanks-match ─────────────────
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'exact-course-name-remblanks-match', 0.93,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code     = 'FL'
    AND ec.name_no_spaces = mc.name_no_spaces
    AND mc.is_active      = TRUE
  WHERE ec.school_slug = p_school_slug
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id;

  -- ── PASS 8: exact-course-name-upper-remblanks-match ───────────
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'exact-course-name-upper-remblanks-match', 0.92,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code = 'FL'
    AND REGEXP_REPLACE(ec.name_upper, '\s+', '', 'g')
      = REGEXP_REPLACE(mc.name_upper, '\s+', '', 'g')
    AND mc.is_active  = TRUE
  WHERE ec.school_slug = p_school_slug
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id;

  -- ── PASS 9: exact-course-abb-name ─────────────────────────────
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'exact-course-abb-name', 0.92,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code  = 'FL'
    AND ec.course_name = mc.abbrev_name
    AND mc.is_active   = TRUE
  WHERE ec.school_slug = p_school_slug
    AND mc.abbrev_name IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id;

  -- ── PASS 10: exact-course-abb-name-uppercase ──────────────────
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'exact-course-abb-name-uppercase', 0.91,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code = 'FL'
    AND ec.name_upper = mc.abbrev_upper
    AND mc.is_active  = TRUE
  WHERE ec.school_slug = p_school_slug
    AND mc.abbrev_name IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id;

  -- ── PASS 11: exact-course-abb-name-remblanks-match ────────────
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'exact-course-abb-name-remblanks-match', 0.90,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code = 'FL'
    AND REPLACE(ec.name_upper, ' ', '') = mc.abbrev_no_spaces
    AND mc.is_active  = TRUE
  WHERE ec.school_slug = p_school_slug
    AND mc.abbrev_name IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id;

  -- ── PASS 12: exact-course-abb-name-upper-remblanks-match ──────
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'exact-course-abb-name-upper-remblanks-match', 0.89,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code = 'FL'
    AND REGEXP_REPLACE(ec.name_upper, '\s+', '', 'g') = mc.abbrev_no_spaces
    AND mc.is_active  = TRUE
  WHERE ec.school_slug = p_school_slug
    AND mc.abbrev_name IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id;

  -- ── PASS 13: exact-roman-course-name-match ────────────────────
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'exact-roman-course-name-match', 0.93,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code      = 'FL'
    AND ec.name_roman_norm = mc.name_roman_norm
    AND mc.is_active       = TRUE
  WHERE ec.school_slug = p_school_slug
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id;

  -- ── PASS 14: exact-roman-course-abbreviated-name-match ────────
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'exact-roman-course-abbreviated-name-match', 0.91,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code      = 'FL'
    AND ec.name_roman_norm = UPPER(fn_roman_to_arabic(mc.abbrev_name))
    AND mc.is_active       = TRUE
  WHERE ec.school_slug = p_school_slug
    AND mc.abbrev_name IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id;

  -- ── PASS 15: exact-honors-position-roman-match ────────────────
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'exact-honors-position-roman-match', 0.93,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code      = 'FL'
    AND ec.name_honors_norm = mc.name_honors_norm
    AND mc.is_active       = TRUE
  WHERE ec.school_slug = p_school_slug
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id;

  -- ── PASS 16: exact-course-name-ap-transformation ──────────────
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'exact-course-name-ap-transformation', 0.92,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code   = 'FL'
    AND ec.name_ap_norm = mc.name_ap_norm
    AND mc.is_active    = TRUE
  WHERE ec.school_slug = p_school_slug
    AND (ec.course_name ILIKE 'AP %' OR ec.course_name ILIKE 'Advanced Placement%')
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id;

  -- ── PASS 17: exact-course-name-ap-ampersand-expansion-remblanks
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'exact-course-name-ap-ampersand-expansion-remblanks', 0.91,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code = 'FL'
    AND REPLACE(REPLACE(ec.name_ap_norm, '&', 'AND'), ' ', '')
      = REPLACE(REPLACE(mc.name_ap_norm, '&', 'AND'), ' ', '')
    AND mc.is_active  = TRUE
  WHERE ec.school_slug = p_school_slug
    AND ec.course_name LIKE '%&%'
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id;

  -- ── PASS 18: exact-course-name-ib-transformation ──────────────
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'exact-course-name-ib-transformation', 0.92,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code   = 'FL'
    AND ec.name_ib_norm = mc.name_ib_norm
    AND mc.is_active    = TRUE
  WHERE ec.school_slug = p_school_slug
    AND (ec.course_name ILIKE 'IB %' OR ec.course_name ILIKE 'International Baccalaureate%')
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id;

  -- ── PASS 19: exact-course-name-symmetric-cambridge-remblanks ──
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'exact-course-name-symmetric-cambridge-remblanks', 0.90,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code = 'FL'
    AND REPLACE(REGEXP_REPLACE(ec.name_upper, '\mCAMBRIDGE\M', '', 'gi'), ' ', '')
      = REPLACE(REGEXP_REPLACE(mc.name_upper, '\mCAMBRIDGE\M', '', 'gi'), ' ', '')
    AND mc.is_active  = TRUE
  WHERE ec.school_slug = p_school_slug
    AND ec.course_name ILIKE '%Cambridge%'
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id;

  -- ── PASS 20: exact-course-name-skeleton-alphanumeric-match ────
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'exact-course-name-skeleton-alphanumeric-match', 0.88,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code   = 'FL'
    AND ec.name_skeleton = mc.name_skeleton
    AND mc.is_active    = TRUE
  WHERE ec.school_slug = p_school_slug
    AND LENGTH(ec.name_skeleton) > 6
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id;

  -- ── PASS 21: exact-course-name-sorted-word-match ──────────────
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'exact-course-name-sorted-word-match', 0.87,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code        = 'FL'
    AND ec.name_sorted_words  = mc.name_sorted_words
    AND mc.is_active         = TRUE
  WHERE ec.school_slug = p_school_slug
    AND LENGTH(ec.name_sorted_words) > 8
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id;

  -- ── PASS 22: exact-course-name-conjunction-roman-strip-v4 ─────
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'exact-course-name-conjunction-roman-strip-v4', 0.82,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code = 'FL'
    AND fn_sort_words(fn_strip_conjunctions(ec.name_roman_norm))
      = fn_sort_words(fn_strip_conjunctions(mc.name_roman_norm))
    AND mc.is_active  = TRUE
  WHERE ec.school_slug = p_school_slug
    AND LENGTH(ec.course_name) > 10
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id;

  -- ── PASS 23: Expanded Abbreviations (US, Math, M/J) & Removed Spaces
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'Expanded Abbreviations (US, Math, M/J) & Removed Spaces', 0.88,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code = 'FL'
    AND REPLACE(fn_expand_abbrevs(ec.course_name), ' ', '')
      = REPLACE(fn_expand_abbrevs(mc.course_name), ' ', '')
    AND mc.is_active  = TRUE
  WHERE ec.school_slug = p_school_slug
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id;

  -- ── PASS 24: Expanded AP and Standardized Honors (H/Hon to Honors)
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'Expanded AP and Standardized Honors (H/Hon to Honors)', 0.89,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code = 'FL'
    AND fn_norm_honors_position(fn_norm_ap(ec.name_roman_norm))
      = fn_norm_honors_position(fn_norm_ap(mc.name_roman_norm))
    AND mc.is_active  = TRUE
  WHERE ec.school_slug = p_school_slug
    AND (ec.course_name ~* '\mHon(ors)?\M'
         OR ec.course_name ~* '\sH\.?\s*$'
         OR ec.course_name ILIKE '%AP%')
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id;

  -- ── PASS 25: synonym-table-match ──────────────────────────────
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'synonym-table-match', 0.90,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN course_synonyms cs
    ON  cs.state_code  = 'FL'
    AND ec.name_upper  = cs.alias_upper
  JOIN master_courses mc
    ON  mc.state_code  = 'FL'
    AND mc.course_code = cs.master_code
    AND mc.is_active   = TRUE
  WHERE ec.school_slug = p_school_slug
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id;

  -- ── PASS 26: partial-prefix-match ─────────────────────────────
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name, matched_abbrev)
  SELECT DISTINCT ON (ec.id)
    ec.id, 'FL', mc.id,
    'partial-prefix-match', 0.78,
    mc.course_code, mc.course_name, mc.abbrev_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code = 'FL'
    AND (   mc.name_upper LIKE ec.name_upper || ':%'
         OR mc.name_upper LIKE ec.name_upper || ' -%'
         OR mc.name_upper LIKE ec.name_upper || ' –%')
    AND mc.is_active  = TRUE
  WHERE ec.school_slug = p_school_slug
    AND LENGTH(ec.course_name) >= 6
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id)
  ORDER BY ec.id, LENGTH(mc.course_name) ASC;

  -- ── PASS 27: to-be-deleted-k5 ─────────────────────────────────
  INSERT INTO mapping_results
    (extracted_id, state_code, master_course_id,
     match_type, confidence, matched_code, matched_name)
  SELECT ec.id, 'FL', mc.id,
    'to-be-deleted-k5', 0.0,
    mc.course_code, mc.course_name
  FROM extracted_courses ec
  JOIN master_courses mc
    ON  mc.state_code      = 'FL'
    AND ec.code_normalized = mc.code_normalized
  WHERE ec.school_slug = p_school_slug
    AND (mc.grade_level IN ('K','1','2','3','4','5','K-5','PK','KG')
         OR mc.course_name ILIKE '%Kindergarten%')
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id);

  -- ── FINAL: unmatched ──────────────────────────────────────────
  INSERT INTO mapping_results (extracted_id, state_code, match_type, confidence, review_status)
  SELECT ec.id, 'FL', 'unmatched', 0.0, 'needs_review'
  FROM extracted_courses ec
  WHERE ec.school_slug = p_school_slug
    AND NOT EXISTS (SELECT 1 FROM mapping_results mr WHERE mr.extracted_id = ec.id);

  -- Return in production analytics table format: mapping_logic | count
  RETURN QUERY
  SELECT mr.match_type AS mapping_logic, COUNT(*) AS count
  FROM mapping_results mr
  JOIN extracted_courses ec ON mr.extracted_id = ec.id
  WHERE ec.school_slug = p_school_slug
  GROUP BY mr.match_type
  ORDER BY count DESC;

END;
$$;

-- ── Safe remap: preserves confirmed + rejected human reviews ─────
CREATE OR REPLACE FUNCTION reset_and_remap_school(p_school_slug TEXT)
RETURNS TABLE(mapping_logic TEXT, count BIGINT)
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM mapping_results
  WHERE review_status IN ('auto', 'needs_review')
    AND extracted_id IN (
      SELECT id FROM extracted_courses WHERE school_slug = p_school_slug
    );

  RETURN QUERY SELECT * FROM run_florida_mapping(p_school_slug);
END;
$$;

-- Helper function for school views
CREATE OR REPLACE FUNCTION create_school_view(p_view_name TEXT, p_school_slug TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format(
    'CREATE OR REPLACE VIEW %I AS SELECT * FROM vw_school_courses WHERE school_slug = %L',
    p_view_name, p_school_slug
  );
END;
$$;
