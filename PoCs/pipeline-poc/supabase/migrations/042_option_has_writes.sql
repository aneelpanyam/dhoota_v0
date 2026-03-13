-- ============================================
-- 042: Add has_writes to option_definitions
-- Allows branching without loading sql_templates.
-- ============================================

ALTER TABLE option_definitions
  ADD COLUMN IF NOT EXISTS has_writes boolean NOT NULL DEFAULT true;

-- Backfill from sql_templates
UPDATE option_definitions od SET has_writes = EXISTS (
  SELECT 1 FROM sql_templates st
  WHERE st.option_id = od.id AND st.query_type = 'write'
);
