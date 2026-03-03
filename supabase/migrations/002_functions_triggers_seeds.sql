-- ================================================================
-- planpaths-data-miner | Migration 002: Functions, Triggers & Seeds
-- ================================================================

-- ── fn_norm_code ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_norm_code(c TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT UPPER(REGEXP_REPLACE(COALESCE(c, ''), '[^a-zA-Z0-9]', '', 'g'));
$$;

-- ── fn_roman_to_arabic ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_roman_to_arabic(t TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE r TEXT := COALESCE(t, '');
BEGIN
  r := REGEXP_REPLACE(r, '\mXII\M',  '12', 'gi');
  r := REGEXP_REPLACE(r, '\mXI\M',   '11', 'gi');
  r := REGEXP_REPLACE(r, '\mX\M',    '10', 'gi');
  r := REGEXP_REPLACE(r, '\mVIII\M', '8',  'gi');
  r := REGEXP_REPLACE(r, '\mVII\M',  '7',  'gi');
  r := REGEXP_REPLACE(r, '\mVI\M',   '6',  'gi');
  r := REGEXP_REPLACE(r, '\mIX\M',   '9',  'gi');
  r := REGEXP_REPLACE(r, '\mIV\M',   '4',  'gi');
  r := REGEXP_REPLACE(r, '\mIII\M',  '3',  'gi');
  r := REGEXP_REPLACE(r, '\mII\M',   '2',  'gi');
  r := REGEXP_REPLACE(r, '\mI\M',    '1',  'gi');
  RETURN r;
END;
$$;

-- ── fn_skeleton ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_skeleton(t TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT UPPER(REGEXP_REPLACE(COALESCE(t, ''), '[^a-zA-Z0-9]', '', 'g'));
$$;

-- ── fn_sort_words ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_sort_words(t TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE words TEXT[];
BEGIN
  IF t IS NULL OR TRIM(t) = '' THEN RETURN ''; END IF;
  words := STRING_TO_ARRAY(
    UPPER(REGEXP_REPLACE(TRIM(t), '\s+', ' ', 'g')), ' '
  );
  SELECT ARRAY_AGG(w ORDER BY w) INTO words FROM UNNEST(words) w;
  RETURN ARRAY_TO_STRING(words, ' ');
END;
$$;

-- ── fn_norm_ap ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_norm_ap(t TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE r TEXT := UPPER(TRIM(COALESCE(t, '')));
BEGIN
  r := REGEXP_REPLACE(r, '^A\.P\.\s*', 'ADVANCED PLACEMENT ');
  r := REGEXP_REPLACE(r, '^AP\s+',     'ADVANCED PLACEMENT ');
  RETURN r;
END;
$$;

-- ── fn_norm_ib ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_norm_ib(t TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT REGEXP_REPLACE(
    UPPER(TRIM(COALESCE(t, ''))),
    '^IB\s+', 'INTERNATIONAL BACCALAUREATE '
  );
$$;

-- ── fn_norm_honors ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_norm_honors(t TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE r TEXT := UPPER(TRIM(COALESCE(t, '')));
BEGIN
  r := REGEXP_REPLACE(r, '\s+H\.\s*$',   ' HONORS');
  r := REGEXP_REPLACE(r, '\s+H\s*$',     ' HONORS');
  r := REGEXP_REPLACE(r, '\s+HON\.\s*$', ' HONORS');
  r := REGEXP_REPLACE(r, '\s+HON\s*$',   ' HONORS');
  r := REGEXP_REPLACE(r, '\mHON\M',      'HONORS', 'g');
  RETURN TRIM(r);
END;
$$;

-- ── fn_norm_honors_position ─────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_norm_honors_position(t TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE r TEXT;
BEGIN
  r := fn_norm_honors(fn_roman_to_arabic(UPPER(TRIM(COALESCE(t, '')))));
  r := REGEXP_REPLACE(r, '^(.+)\s+(\d+)\s+HONORS$', '\1 HONORS \2');
  r := REGEXP_REPLACE(r, '^HONORS\s+(.+)\s+(\d+)$', '\1 HONORS \2');
  RETURN TRIM(r);
END;
$$;

-- ── fn_expand_abbrevs ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_expand_abbrevs(t TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE r TEXT := UPPER(TRIM(COALESCE(t, '')));
BEGIN
  r := REGEXP_REPLACE(r, '\mM/J\M',     'MIDDLE JUNIOR', 'g');
  r := REGEXP_REPLACE(r, '\mM\.J\.\M',  'MIDDLE JUNIOR', 'g');
  r := REGEXP_REPLACE(r, '\mU\.?S\.?\M','UNITED STATES', 'g');
  r := REGEXP_REPLACE(r, '\mMATH\M',    'MATHEMATICS',   'g');
  r := REGEXP_REPLACE(r, '\mSCI\.?\M',  'SCIENCE',       'g');
  r := REGEXP_REPLACE(r, '\mTECH\.?\M', 'TECHNOLOGY',    'g');
  r := REGEXP_REPLACE(r, '\mLANG\.?\M', 'LANGUAGE',      'g');
  r := REGEXP_REPLACE(r, '\mLIT\.?\M',  'LITERATURE',    'g');
  r := REGEXP_REPLACE(r, '\mHIST\.?\M', 'HISTORY',       'g');
  r := REGEXP_REPLACE(r, '\mGOVT\.?\M', 'GOVERNMENT',    'g');
  r := REPLACE(r, '&', 'AND');
  RETURN r;
END;
$$;

-- ── fn_strip_conjunctions ───────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_strip_conjunctions(t TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT TRIM(REGEXP_REPLACE(
    REGEXP_REPLACE(
      UPPER(COALESCE(t, '')),
      '\m(AND|THE|OF|FOR|IN|TO|A|AN|OR|WITH|AT)\M', '', 'gi'
    ),
    '\s+', ' ', 'g'
  ));
$$;

-- ================================================================
-- TRIGGERS
-- ================================================================

-- ── Synonym alias_upper trigger ─────────────────────────────────
CREATE OR REPLACE FUNCTION trg_synonym_upper()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.alias_upper := UPPER(TRIM(NEW.alias_name));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_synonym
  BEFORE INSERT OR UPDATE ON course_synonyms
  FOR EACH ROW EXECUTE FUNCTION trg_synonym_upper();

-- ── Master courses normalize trigger ────────────────────────────
CREATE OR REPLACE FUNCTION trg_master_normalize()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.code_normalized   := fn_norm_code(NEW.course_code);
  NEW.name_upper        := UPPER(COALESCE(NEW.course_name, ''));
  NEW.name_no_spaces    := REPLACE(UPPER(COALESCE(NEW.course_name, '')), ' ', '');
  NEW.abbrev_upper      := UPPER(COALESCE(NEW.abbrev_name, ''));
  NEW.abbrev_no_spaces  := REPLACE(UPPER(COALESCE(NEW.abbrev_name, '')), ' ', '');
  NEW.name_skeleton     := fn_skeleton(NEW.course_name);
  NEW.name_sorted_words := fn_sort_words(NEW.course_name);
  NEW.name_roman_norm   := UPPER(fn_roman_to_arabic(COALESCE(NEW.course_name, '')));
  NEW.name_honors_norm  := fn_norm_honors_position(NEW.course_name);
  NEW.name_ap_norm      := fn_norm_ap(NEW.course_name);
  NEW.name_ib_norm      := fn_norm_ib(NEW.course_name);
  NEW.updated_at        := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_master
  BEFORE INSERT OR UPDATE ON master_courses
  FOR EACH ROW EXECUTE FUNCTION trg_master_normalize();

-- ── Extracted courses normalize trigger ─────────────────────────
CREATE OR REPLACE FUNCTION trg_extracted_normalize()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.code_normalized   := fn_norm_code(NEW.course_code);
  NEW.name_upper        := UPPER(COALESCE(NEW.course_name, ''));
  NEW.name_no_spaces    := REPLACE(UPPER(COALESCE(NEW.course_name, '')), ' ', '');
  NEW.name_skeleton     := fn_skeleton(NEW.course_name);
  NEW.name_sorted_words := fn_sort_words(NEW.course_name);
  NEW.name_roman_norm   := UPPER(fn_roman_to_arabic(COALESCE(NEW.course_name, '')));
  NEW.name_honors_norm  := fn_norm_honors_position(NEW.course_name);
  NEW.name_ap_norm      := fn_norm_ap(NEW.course_name);
  NEW.name_ib_norm      := fn_norm_ib(NEW.course_name);
  NEW.honors_flag       := (
    NEW.course_name ~* '\mHonors\M' OR
    NEW.course_name ~* '\mHon\M'    OR
    NEW.course_name ~* '\sH\.?\s*$'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_extracted
  BEFORE INSERT OR UPDATE ON extracted_courses
  FOR EACH ROW EXECUTE FUNCTION trg_extracted_normalize();

-- ================================================================
-- SYNONYM SEEDS
-- Must be AFTER trigger creation so alias_upper is auto-populated.
-- ================================================================
INSERT INTO course_synonyms (state_code, alias_name, master_code) VALUES
  ('FL', 'American Government',      '2106310'),
  ('FL', 'US Government',            '2106310'),
  ('FL', 'American History',         '2100310'),
  ('FL', 'US History',               '2100310'),
  ('FL', 'HOPE',                     '3026010'),
  ('FL', 'Physical Education',       '3026010'),
  ('FL', 'PE',                       '3026010'),
  ('FL', 'Health',                   '3026010'),
  ('FL', 'Biology',                  '2000310'),
  ('FL', 'Chemistry',                '2003340'),
  ('FL', 'Psychology',               '2107300'),
  ('FL', 'Intensive Reading',        '1000010'),
  ('FL', 'Theater',                  '0400310'),
  ('FL', 'Theatre',                  '0400310'),
  ('FL', 'Theater 1',                '0400310'),
  ('FL', 'Ceramics 1',               '102300'),
  ('FL', 'Ceramics 2',               '102310'),
  ('FL', 'Ceramics 3',               '102320'),
  ('FL', 'Drivers Ed',               '1900300'),
  ('FL', 'Driver Education',         '1900300'),
  ('FL', 'Computer Applications',    '8207310')
ON CONFLICT (state_code, alias_name) DO NOTHING;
