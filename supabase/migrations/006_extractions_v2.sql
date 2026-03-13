-- ================================================================
-- planpaths-data-miner | Migration 006: extractions_v2
-- ================================================================

CREATE TABLE IF NOT EXISTS extractions_v2 (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id        UUID,
  school_slug      TEXT        NOT NULL,
  state_code       VARCHAR(2)  NOT NULL,

  course_name      TEXT        NOT NULL,
  course_code      TEXT,
  category         TEXT,
  grade_level      TEXT,
  credits          TEXT,
  course_duration  TEXT,
  course_term      TEXT,
  grad_requirement TEXT,
  description      TEXT,

  chunk_index      INT,
  content_hash     TEXT,

  created_at       TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (school_slug, content_hash)
);

DO $$
BEGIN
  IF to_regclass('public.uploads') IS NOT NULL THEN
    BEGIN
      ALTER TABLE extractions_v2
      ADD CONSTRAINT extractions_v2_upload_id_fkey
      FOREIGN KEY (upload_id) REFERENCES uploads(id) ON DELETE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.states') IS NOT NULL THEN
    BEGIN
      ALTER TABLE extractions_v2
      ADD CONSTRAINT extractions_v2_state_code_fkey
      FOREIGN KEY (state_code) REFERENCES states(code);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ev2_upload    ON extractions_v2(upload_id);
CREATE INDEX IF NOT EXISTS idx_ev2_school    ON extractions_v2(school_slug);
CREATE INDEX IF NOT EXISTS idx_ev2_state     ON extractions_v2(state_code);
CREATE INDEX IF NOT EXISTS idx_ev2_code      ON extractions_v2(course_code);
CREATE INDEX IF NOT EXISTS idx_ev2_category  ON extractions_v2(category);
