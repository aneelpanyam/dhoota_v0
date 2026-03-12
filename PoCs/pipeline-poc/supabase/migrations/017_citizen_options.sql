-- ============================================
-- 017: Citizen (Public Site) Options
-- Read-only options for citizen user type.
-- All queries scoped by $scopedUserId and $tenantId
-- from env vars, with visibility='public' filter.
-- ============================================

-- ============================================
-- Citizen Option Definitions
-- ============================================

INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, response_prompt, follow_up_option_ids) VALUES

('public.activities', 'View Activities', 'Browse public activities from this representative.', 'public', 'List', ARRAY['activities', 'what did', 'show activities', 'work', 'recent activities'], ARRAY['citizen'], ARRAY[]::text[], true, 10, false,
'{"type":"object","properties":{"page":{"type":"integer","default":1},"pageSize":{"type":"integer","default":10},"tag":{"type":"string"}}}'::jsonb,
'Show public activities as a data_list widget. Include title, date, location, and tags. Keep the summary brief and citizen-friendly.',
ARRAY['public.stats']),

('public.stats', 'View Stats', 'See public activity statistics for this representative.', 'public', 'BarChart3', ARRAY['stats', 'statistics', 'numbers', 'how many', 'count', 'overview'], ARRAY['citizen'], ARRAY[]::text[], true, 20, false,
'{"type":"object","properties":{"period":{"type":"string","default":"month"}}}'::jsonb,
'Show activity statistics using stats_card widgets for key metrics. Keep it simple and informative for citizens.',
ARRAY['public.activities']),

('public.announcements', 'Announcements', 'View published announcements from this representative.', 'public', 'Megaphone', ARRAY['announcements', 'news', 'updates', 'latest', 'what''s new'], ARRAY['citizen'], ARRAY[]::text[], true, 5, false,
'{"type":"object","properties":{"page":{"type":"integer","default":1},"pageSize":{"type":"integer","default":10}}}'::jsonb,
'Show announcements as a list. Pinned announcements should appear first. Include title, content preview, and date.',
ARRAY['public.activities']),

('public.info_cards', 'Information', 'View public info cards (about, contact, services) from this representative.', 'public', 'Info', ARRAY['info', 'about', 'contact', 'services', 'who', 'information'], ARRAY['citizen'], ARRAY[]::text[], true, 15, false,
'{"type":"object","properties":{"card_type":{"type":"string"}}}'::jsonb,
'Show info cards organized by card_type. Use a clean, readable format. About cards first, then services, then contact.',
ARRAY['public.announcements']),

('public.about', 'About', 'View the representative''s public profile.', 'public', 'User', ARRAY['about', 'who is', 'profile', 'representative'], ARRAY['citizen'], ARRAY[]::text[], true, 25, false,
'{"type":"object","properties":{}}'::jsonb,
'Show the representative''s public profile information in a clean, professional format.',
ARRAY['public.activities', 'public.announcements']);

-- ============================================
-- Citizen SQL Templates (all read-only, all scoped)
-- ============================================

-- public.activities
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('public.activities', 'list_public_activities',
'SELECT a.id, a.title, a.description, a.activity_date, a.location, a.ai_summary, array_agg(DISTINCT jsonb_build_object(''name'', t.name, ''color'', t.color)) FILTER (WHERE t.id IS NOT NULL) as tags, count(DISTINCT am.id) as media_count FROM activities a LEFT JOIN activity_tags at2 ON a.id = at2.activity_id LEFT JOIN tags t ON at2.tag_id = t.id LEFT JOIN activity_media am ON a.id = am.activity_id WHERE a.tenant_id = $1 AND a.created_by = $2 AND a.visibility = ''public'' AND a.deleted_at IS NULL AND ($3::text IS NULL OR EXISTS(SELECT 1 FROM activity_tags at3 JOIN tags t3 ON at3.tag_id = t3.id WHERE at3.activity_id = a.id AND t3.name ILIKE $3)) GROUP BY a.id ORDER BY a.activity_date DESC LIMIT LEAST($4, 50) OFFSET $5',
'{"$1": "context.tenantId", "$2": "context.scopedUserId", "$3": "params.tag", "$4": "params.pageSize", "$5": "params.offset"}'::jsonb,
0, 'read');

-- public.stats
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('public.stats', 'public_activity_stats',
'SELECT count(*) as total_activities, count(*) FILTER (WHERE activity_date >= date_trunc(''month'', now())) as this_month, count(*) FILTER (WHERE activity_date >= date_trunc(''week'', now())) as this_week FROM activities WHERE tenant_id = $1 AND created_by = $2 AND visibility = ''public'' AND deleted_at IS NULL',
'{"$1": "context.tenantId", "$2": "context.scopedUserId"}'::jsonb,
0, 'read'),
('public.stats', 'public_tag_breakdown',
'SELECT t.name, t.color, count(at2.id) as count FROM tags t JOIN activity_tags at2 ON t.id = at2.tag_id JOIN activities a ON at2.activity_id = a.id WHERE a.tenant_id = $1 AND a.created_by = $2 AND a.visibility = ''public'' AND a.deleted_at IS NULL GROUP BY t.id, t.name, t.color ORDER BY count DESC LIMIT 10',
'{"$1": "context.tenantId", "$2": "context.scopedUserId"}'::jsonb,
1, 'read');

-- public.announcements
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('public.announcements', 'list_public_announcements',
'SELECT id, title, content, pinned, published_at, created_at FROM announcements WHERE tenant_id = $1 AND created_by = $2 AND visibility = ''public'' AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > now()) ORDER BY pinned DESC, published_at DESC NULLS LAST, created_at DESC LIMIT LEAST($3, 50) OFFSET $4',
'{"$1": "context.tenantId", "$2": "context.scopedUserId", "$3": "params.pageSize", "$4": "params.offset"}'::jsonb,
0, 'read');

-- public.info_cards
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('public.info_cards', 'list_public_info_cards',
'SELECT id, title, content, card_type, icon, display_order FROM info_cards WHERE tenant_id = $1 AND created_by = $2 AND visibility = ''public'' AND deleted_at IS NULL AND ($3::text IS NULL OR card_type::text = $3) ORDER BY display_order ASC, created_at DESC LIMIT 50',
'{"$1": "context.tenantId", "$2": "context.scopedUserId", "$3": "params.card_type"}'::jsonb,
0, 'read');

-- public.about
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('public.about', 'get_public_profile',
'SELECT u.display_name, psc.welcome_message, psc.side_panel_content FROM users u LEFT JOIN public_site_configs psc ON u.id = psc.user_id AND psc.tenant_id = $1 WHERE u.id = $2 AND u.tenant_id = $1 AND u.deleted_at IS NULL',
'{"$1": "context.tenantId", "$2": "context.scopedUserId"}'::jsonb,
0, 'read');

-- ============================================
-- Citizen User Type Config
-- ============================================

INSERT INTO user_type_configs (user_type, init_option_ids, default_option_ids, available_option_ids, theme_config) VALUES
('citizen',
  ARRAY['public.announcements', 'public.activities'],
  ARRAY['public.activities', 'public.stats', 'public.about',
        'public.announcements', 'public.info_cards'],
  ARRAY['public.activities', 'public.stats', 'public.about',
        'public.announcements', 'public.info_cards'],
  '{}'::jsonb);
