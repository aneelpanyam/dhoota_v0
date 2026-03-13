-- ============================================
-- 039: Context filters for insights
-- Pre-defined filters per user type that fetch
-- records (with AI summaries) for the context strip.
-- ============================================

CREATE TABLE context_filters (
  id                text PRIMARY KEY,
  name              text NOT NULL,
  description       text,
  icon              text NOT NULL DEFAULT 'List',
  sql               text NOT NULL,
  param_mapping      jsonb NOT NULL DEFAULT '{}',
  entity_type       text NOT NULL DEFAULT 'activity',
  view_option_id    text,
  view_param_key    text,
  user_types        text[] NOT NULL DEFAULT '{}',
  required_toggles   text[] NOT NULL DEFAULT '{}',
  sort_order        integer NOT NULL DEFAULT 0,
  tenant_id         uuid REFERENCES tenants(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_context_filters_user_types ON context_filters USING GIN (user_types);

-- ============================================
-- Worker, candidate, representative filters
-- ============================================

INSERT INTO context_filters (id, name, description, icon, sql, param_mapping, entity_type, view_option_id, view_param_key, user_types, required_toggles, sort_order) VALUES
('recent_activities', 'Recent activities', 'Last 10 activities', 'List',
'SELECT a.id, a.title, a.description, a.activity_date, a.ai_summary FROM activities a WHERE a.tenant_id = $1 AND a.created_by = $2 AND a.deleted_at IS NULL ORDER BY a.activity_date DESC LIMIT 10',
'{"$1": "context.tenantId", "$2": "context.userId"}'::jsonb,
'activity', 'activity.view', 'activity_id',
ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[], 0),

('this_week', 'This week', 'Activities from the current week', 'Calendar',
'SELECT a.id, a.title, a.description, a.activity_date, a.ai_summary FROM activities a WHERE a.tenant_id = $1 AND a.created_by = $2 AND a.deleted_at IS NULL AND a.activity_date >= date_trunc(''week'', now()) ORDER BY a.activity_date DESC',
'{"$1": "context.tenantId", "$2": "context.userId"}'::jsonb,
'activity', 'activity.view', 'activity_id',
ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[], 1),

('completed_this_month', 'Completed this month', 'Completed activities in current month', 'CheckCircle',
'SELECT a.id, a.title, a.description, a.activity_date, a.ai_summary FROM activities a WHERE a.tenant_id = $1 AND a.created_by = $2 AND a.deleted_at IS NULL AND a.status = ''completed'' AND a.activity_date >= date_trunc(''month'', now()) ORDER BY a.activity_date DESC',
'{"$1": "context.tenantId", "$2": "context.userId"}'::jsonb,
'activity', 'activity.view', 'activity_id',
ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[], 2),

('my_programs', 'My programs', 'Programs with activities', 'CalendarPlus',
'SELECT p.id, p.title, p.description, p.start_date, p.end_date, p.ai_summary FROM programs p WHERE p.tenant_id = $1 AND p.user_id = $2 AND p.deleted_at IS NULL ORDER BY p.start_date DESC NULLS LAST LIMIT 10',
'{"$1": "context.tenantId", "$2": "context.userId"}'::jsonb,
'program', 'program.view', 'program_id',
ARRAY['worker', 'candidate', 'representative'], ARRAY['programs_enabled'], 3),

('my_announcements', 'My announcements', 'Recent announcements', 'Megaphone',
'SELECT a.id, a.title, a.content, a.published_at, a.pinned FROM announcements a WHERE a.tenant_id = $1 AND a.created_by = $2 AND a.deleted_at IS NULL ORDER BY a.pinned DESC, a.published_at DESC NULLS LAST, a.created_at DESC LIMIT 10',
'{"$1": "context.tenantId", "$2": "context.userId"}'::jsonb,
'announcement', 'announcement.edit', 'announcement_id',
ARRAY['worker', 'candidate', 'representative'], ARRAY['public_site_enabled'], 4);

-- ============================================
-- System admin filters
-- ============================================

INSERT INTO context_filters (id, name, description, icon, sql, param_mapping, entity_type, view_option_id, view_param_key, user_types, required_toggles, sort_order) VALUES
('all_tenants', 'All tenants', 'All tenants with user counts', 'Building2',
'SELECT t.id, t.name, t.slug, t.subscription, count(DISTINCT u.id) as user_count FROM tenants t LEFT JOIN users u ON t.id = u.tenant_id AND u.deleted_at IS NULL GROUP BY t.id ORDER BY t.created_at DESC LIMIT 20',
'{}'::jsonb,
'tenant', 'admin.tenant.view', 'tenant_id',
ARRAY['system_admin'], ARRAY[]::text[], 0),

('recent_users', 'Recent users', 'Users across all tenants', 'Users',
'SELECT u.id, u.email, u.display_name, u.user_type, t.name as tenant_name FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE u.deleted_at IS NULL ORDER BY u.created_at DESC LIMIT 20',
'{}'::jsonb,
'user', 'admin.user.view', 'user_id',
ARRAY['system_admin'], ARRAY[]::text[], 1),

('pending_reports', 'Pending reports', 'Report requests awaiting processing', 'FileBarChart',
'SELECT r.id, r.report_type, r.status, r.requested_at, u.email FROM report_requests r JOIN users u ON r.user_id = u.id WHERE r.status IN (''requested'', ''processing'') ORDER BY r.requested_at ASC LIMIT 20',
'{}'::jsonb,
'report', 'admin.report.process', 'report_id',
ARRAY['system_admin'], ARRAY[]::text[], 2);

-- ============================================
-- Citizen filters (public site)
-- ============================================

INSERT INTO context_filters (id, name, description, icon, sql, param_mapping, entity_type, view_option_id, view_param_key, user_types, required_toggles, sort_order) VALUES
('public_activities', 'Public activities', 'Public activities for this site', 'List',
'SELECT a.id, a.title, a.description, a.activity_date, a.ai_summary FROM activities a WHERE a.tenant_id = $1 AND a.visibility = ''public'' AND a.deleted_at IS NULL ORDER BY a.activity_date DESC LIMIT 15',
'{"$1": "context.tenantId"}'::jsonb,
'activity', 'activity.view', 'activity_id',
ARRAY['citizen'], ARRAY[]::text[], 0),

('public_announcements', 'Announcements', 'Public announcements', 'Megaphone',
'SELECT a.id, a.title, a.content, a.published_at FROM announcements a WHERE a.tenant_id = $1 AND a.visibility = ''public'' AND a.deleted_at IS NULL ORDER BY a.pinned DESC, a.published_at DESC NULLS LAST LIMIT 10',
'{"$1": "context.tenantId"}'::jsonb,
'announcement', NULL, NULL,
ARRAY['citizen'], ARRAY['public_site_enabled'], 1);
