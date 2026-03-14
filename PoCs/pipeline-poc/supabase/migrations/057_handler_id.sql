-- ============================================
-- 057: Add handler_id for pluggable pipeline handlers
-- ============================================

ALTER TABLE option_definitions
  ADD COLUMN IF NOT EXISTS handler_id text NOT NULL DEFAULT 'sql';

-- admin.trace.lookup: use trace_logs handler to query CloudWatch by trace ID
UPDATE option_definitions SET handler_id = 'trace_logs' WHERE id = 'admin.trace.lookup';
