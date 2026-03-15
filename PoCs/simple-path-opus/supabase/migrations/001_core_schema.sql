-- 001_core_schema.sql
-- Core database schema: system, users, spaces, space_notes, space_questions, space_answers, access_codes
-- RLS policies, indexes, and triggers

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'suspended');

-- ============================================================
-- HELPER: updated_at trigger function
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLE: system (singleton — global config)
-- ============================================================

CREATE TABLE system (
  id         int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  app_name   text NOT NULL DEFAULT 'Simple Path',
  version    text NOT NULL DEFAULT '0.1.0',
  feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO system (id) VALUES (1);

CREATE TRIGGER system_updated_at
  BEFORE UPDATE ON system
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TABLE: users
-- ============================================================

CREATE TABLE users (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text,
  phone        text,
  display_name text,
  role         user_role NOT NULL DEFAULT 'user',
  status       user_status NOT NULL DEFAULT 'active',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TABLE: spaces (one per user)
-- ============================================================

CREATE TABLE spaces (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL DEFAULT 'My Space',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT spaces_user_id_unique UNIQUE (user_id)
);

CREATE TRIGGER spaces_updated_at
  BEFORE UPDATE ON spaces
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TABLE: space_notes
-- ============================================================

CREATE TABLE space_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id   uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  content    text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER space_notes_updated_at
  BEFORE UPDATE ON space_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TABLE: space_questions
-- ============================================================

CREATE TABLE space_questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id      uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  sort_order    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: space_answers
-- ============================================================

CREATE TABLE space_answers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id    uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES space_questions(id) ON DELETE CASCADE,
  answer_text text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER space_answers_updated_at
  BEFORE UPDATE ON space_answers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TABLE: access_codes (permanent, hashed)
-- ============================================================

CREATE TABLE access_codes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code         text NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,

  CONSTRAINT access_codes_code_unique UNIQUE (code)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

CREATE INDEX idx_spaces_user_id ON spaces(user_id);

CREATE INDEX idx_space_notes_space_id ON space_notes(space_id);

CREATE INDEX idx_space_questions_space_id ON space_questions(space_id);
CREATE INDEX idx_space_questions_sort_order ON space_questions(space_id, sort_order);

CREATE INDEX idx_space_answers_space_id ON space_answers(space_id);
CREATE INDEX idx_space_answers_question_id ON space_answers(question_id);

CREATE INDEX idx_access_codes_user_id ON access_codes(user_id);
CREATE INDEX idx_access_codes_code ON access_codes(code);
CREATE INDEX idx_access_codes_active ON access_codes(user_id, is_active) WHERE is_active = true;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE system ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---- system ----

CREATE POLICY "system_read_authenticated"
  ON system FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "system_write_admin"
  ON system FOR UPDATE
  TO authenticated
  USING (is_admin());

-- ---- users ----

CREATE POLICY "users_select_own"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR is_admin());

CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR is_admin())
  WITH CHECK (id = auth.uid() OR is_admin());

CREATE POLICY "users_insert_admin"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (is_admin() OR id = auth.uid());

CREATE POLICY "users_delete_admin"
  ON users FOR DELETE
  TO authenticated
  USING (is_admin());

-- ---- spaces ----

CREATE POLICY "spaces_select_own"
  ON spaces FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "spaces_insert_own"
  ON spaces FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR is_admin());

CREATE POLICY "spaces_update_own"
  ON spaces FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());

CREATE POLICY "spaces_delete_admin"
  ON spaces FOR DELETE
  TO authenticated
  USING (is_admin());

-- ---- space_notes ----

CREATE POLICY "space_notes_select_own"
  ON space_notes FOR SELECT
  TO authenticated
  USING (
    space_id IN (SELECT id FROM spaces WHERE user_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "space_notes_insert_own"
  ON space_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    space_id IN (SELECT id FROM spaces WHERE user_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "space_notes_update_own"
  ON space_notes FOR UPDATE
  TO authenticated
  USING (
    space_id IN (SELECT id FROM spaces WHERE user_id = auth.uid())
    OR is_admin()
  )
  WITH CHECK (
    space_id IN (SELECT id FROM spaces WHERE user_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "space_notes_delete_own"
  ON space_notes FOR DELETE
  TO authenticated
  USING (
    space_id IN (SELECT id FROM spaces WHERE user_id = auth.uid())
    OR is_admin()
  );

-- ---- space_questions ----

CREATE POLICY "space_questions_select_own"
  ON space_questions FOR SELECT
  TO authenticated
  USING (
    space_id IN (SELECT id FROM spaces WHERE user_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "space_questions_insert_own"
  ON space_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    space_id IN (SELECT id FROM spaces WHERE user_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "space_questions_update_own"
  ON space_questions FOR UPDATE
  TO authenticated
  USING (
    space_id IN (SELECT id FROM spaces WHERE user_id = auth.uid())
    OR is_admin()
  )
  WITH CHECK (
    space_id IN (SELECT id FROM spaces WHERE user_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "space_questions_delete_own"
  ON space_questions FOR DELETE
  TO authenticated
  USING (
    space_id IN (SELECT id FROM spaces WHERE user_id = auth.uid())
    OR is_admin()
  );

-- ---- space_answers ----

CREATE POLICY "space_answers_select_own"
  ON space_answers FOR SELECT
  TO authenticated
  USING (
    space_id IN (SELECT id FROM spaces WHERE user_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "space_answers_insert_own"
  ON space_answers FOR INSERT
  TO authenticated
  WITH CHECK (
    space_id IN (SELECT id FROM spaces WHERE user_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "space_answers_update_own"
  ON space_answers FOR UPDATE
  TO authenticated
  USING (
    space_id IN (SELECT id FROM spaces WHERE user_id = auth.uid())
    OR is_admin()
  )
  WITH CHECK (
    space_id IN (SELECT id FROM spaces WHERE user_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "space_answers_delete_own"
  ON space_answers FOR DELETE
  TO authenticated
  USING (
    space_id IN (SELECT id FROM spaces WHERE user_id = auth.uid())
    OR is_admin()
  );

-- ---- access_codes ----

CREATE POLICY "access_codes_select_own"
  ON access_codes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "access_codes_insert_admin"
  ON access_codes FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "access_codes_update_admin"
  ON access_codes FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "access_codes_delete_admin"
  ON access_codes FOR DELETE
  TO authenticated
  USING (is_admin());
