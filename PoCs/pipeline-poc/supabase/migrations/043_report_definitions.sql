-- ============================================
-- 043: Report definitions and templates
-- Multiple SQL templates per report, run in parallel.
-- ============================================

CREATE TABLE report_definitions (
  id                text PRIMARY KEY,
  filter_id         text NOT NULL REFERENCES context_filters(id),
  name              text NOT NULL,
  description       text,
  user_types        text[] NOT NULL DEFAULT '{}',
  required_toggles   text[] NOT NULL DEFAULT '{}',
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE report_templates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id         text NOT NULL REFERENCES report_definitions(id) ON DELETE CASCADE,
  name              text NOT NULL,
  sql               text NOT NULL,
  param_mapping     jsonb NOT NULL DEFAULT '{}',
  chart_type        text NOT NULL DEFAULT 'bar',
  chart_title       text NOT NULL,
  label_column      text,
  value_columns     text[] DEFAULT '{}',
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_report_templates_report ON report_templates(report_id, sort_order);

-- Seed: Activities report for recent_activities filter
INSERT INTO report_definitions (id, filter_id, name, description, user_types, required_toggles, sort_order) VALUES
('activities_report', 'recent_activities', 'My Activities Report', 'Activity trends, status breakdown, and tag distribution', ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[], 0);

INSERT INTO report_templates (report_id, name, sql, param_mapping, chart_type, chart_title, label_column, value_columns, sort_order) VALUES
('activities_report', 'by_status',
'SELECT status, count(*) as count FROM activities WHERE tenant_id = $1 AND created_by = $2 AND deleted_at IS NULL GROUP BY status',
'{"$1": "context.tenantId", "$2": "context.userId"}'::jsonb,
'pie', 'Activities by Status', 'status', ARRAY['count'], 0),

('activities_report', 'by_week',
'SELECT date_trunc(''week'', activity_date)::date as week_start, count(*) as count FROM activities WHERE tenant_id = $1 AND created_by = $2 AND deleted_at IS NULL AND activity_date >= now() - interval ''8 weeks'' GROUP BY 1 ORDER BY 1',
'{"$1": "context.tenantId", "$2": "context.userId"}'::jsonb,
'bar', 'Activities by Week', 'week_start', ARRAY['count'], 1),

('activities_report', 'top_tags',
'SELECT t.name, count(*) as activity_count FROM activities a JOIN activity_tags at ON a.id = at.activity_id JOIN tags t ON at.tag_id = t.id WHERE a.tenant_id = $1 AND a.created_by = $2 AND a.deleted_at IS NULL GROUP BY t.name ORDER BY activity_count DESC LIMIT 10',
'{"$1": "context.tenantId", "$2": "context.userId"}'::jsonb,
'bar', 'Top Tags', 'name', ARRAY['activity_count'], 2);
