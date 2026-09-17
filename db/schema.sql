CREATE TABLE IF NOT EXISTS students (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS practice_sessions (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  lesson_id VARCHAR(80) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (student_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS practice_sessions_lesson_id_idx ON practice_sessions (lesson_id);

CREATE TABLE IF NOT EXISTS practice_submissions (
  id BIGSERIAL PRIMARY KEY,
  student_id VARCHAR(40) NOT NULL,
  student_name VARCHAR(80) NOT NULL,
  lesson_id VARCHAR(80) NOT NULL,
  code TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS practice_submissions_lesson_id_idx ON practice_submissions (lesson_id);

ALTER TABLE practice_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read practice submissions" ON practice_submissions;
CREATE POLICY "Anyone can read practice submissions"
  ON practice_submissions FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can submit practice" ON practice_submissions;
CREATE POLICY "Anyone can submit practice"
  ON practice_submissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
