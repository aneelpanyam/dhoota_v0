-- 021_pipeline_redesign.sql
-- Adds declarative pipeline configuration to option_definitions,
-- converts query contexts into regular options with Q&A filters,
-- and renames response_prompt to summary_prompt.

-- ============================================================
-- 1. Schema changes to option_definitions
-- ============================================================

ALTER TABLE option_definitions ADD COLUMN IF NOT EXISTS target_widget text;
ALTER TABLE option_definitions ADD COLUMN IF NOT EXISTS requires_confirmation boolean NOT NULL DEFAULT true;
ALTER TABLE option_definitions ADD COLUMN IF NOT EXISTS skip_refinement boolean NOT NULL DEFAULT true;
ALTER TABLE option_definitions ADD COLUMN IF NOT EXISTS entity_type text;

ALTER TABLE option_definitions RENAME COLUMN response_prompt TO summary_prompt;

-- ============================================================
-- 2. Update ALL existing options with declarative config
-- ============================================================

-- Helper: set reads to requires_confirmation=false by default
-- We'll do targeted updates per category for clarity.

-- Activity options
UPDATE option_definitions SET target_widget = 'data_list',    entity_type = 'activity', requires_confirmation = false, skip_refinement = true  WHERE id = 'activity.list';
UPDATE option_definitions SET target_widget = 'activity_card', entity_type = 'activity', requires_confirmation = false, skip_refinement = true  WHERE id = 'activity.view';
UPDATE option_definitions SET target_widget = 'activity_card', entity_type = 'activity', requires_confirmation = true,  skip_refinement = false WHERE id = 'activity.create';
UPDATE option_definitions SET target_widget = 'activity_card', entity_type = 'activity', requires_confirmation = true,  skip_refinement = false WHERE id = 'activity.edit';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'activity', requires_confirmation = true,  skip_refinement = true  WHERE id = 'activity.delete';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'activity', requires_confirmation = true,  skip_refinement = true  WHERE id = 'activity.add_note';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'activity', requires_confirmation = true,  skip_refinement = true  WHERE id = 'activity.add_media';

-- Tags
UPDATE option_definitions SET target_widget = 'data_list',    entity_type = 'tag', requires_confirmation = false, skip_refinement = true WHERE id = 'tag.manage';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'tag', requires_confirmation = true,  skip_refinement = true WHERE id = 'tag.create';

-- Stats
UPDATE option_definitions SET target_widget = 'stats_card', entity_type = 'activity', requires_confirmation = false, skip_refinement = true WHERE id = 'view.stats';

-- Admin options (all skip refinement)
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'tenant',       requires_confirmation = true,  skip_refinement = true WHERE id = 'admin.tenant.create';
UPDATE option_definitions SET target_widget = 'data_list',     entity_type = 'tenant',       requires_confirmation = false, skip_refinement = true WHERE id = 'admin.tenant.list';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'tenant',       requires_confirmation = true,  skip_refinement = true WHERE id = 'admin.tenant.edit';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'user',         requires_confirmation = true,  skip_refinement = true WHERE id = 'admin.user.provision';
UPDATE option_definitions SET target_widget = 'data_list',     entity_type = 'user',         requires_confirmation = false, skip_refinement = true WHERE id = 'admin.user.list';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'user',         requires_confirmation = true,  skip_refinement = true WHERE id = 'admin.user.edit';
UPDATE option_definitions SET target_widget = 'data_list',     entity_type = 'feature_flag', requires_confirmation = false, skip_refinement = true WHERE id = 'admin.feature_flag.manage';
UPDATE option_definitions SET target_widget = 'data_list',     entity_type = 'option',       requires_confirmation = false, skip_refinement = true WHERE id = 'admin.option.list';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'option',       requires_confirmation = true,  skip_refinement = true WHERE id = 'admin.option.configure';
UPDATE option_definitions SET target_widget = 'data_list',     entity_type = 'option',       requires_confirmation = false, skip_refinement = true WHERE id = 'admin.option.view';
UPDATE option_definitions SET target_widget = 'data_list',     entity_type = 'conversation', requires_confirmation = false, skip_refinement = true WHERE id = 'admin.conversation.list';
UPDATE option_definitions SET target_widget = 'data_list',     entity_type = 'conversation', requires_confirmation = false, skip_refinement = true WHERE id = 'admin.conversation.view';
UPDATE option_definitions SET target_widget = 'data_list',     entity_type = 'trace',        requires_confirmation = false, skip_refinement = true WHERE id = 'admin.trace.lookup';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'subscription', requires_confirmation = true,  skip_refinement = true WHERE id = 'admin.subscription.manage';
UPDATE option_definitions SET target_widget = 'stats_card',    entity_type = 'usage',        requires_confirmation = false, skip_refinement = true WHERE id = 'admin.usage.view';
UPDATE option_definitions SET target_widget = 'data_list',     entity_type = 'report',       requires_confirmation = false, skip_refinement = true WHERE id = 'admin.report.list';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'report',       requires_confirmation = true,  skip_refinement = true WHERE id = 'admin.report.process';

-- Public / citizen options
UPDATE option_definitions SET target_widget = 'data_list',     entity_type = 'activity',     requires_confirmation = false, skip_refinement = true WHERE id = 'public.activities';
UPDATE option_definitions SET target_widget = 'stats_card',    entity_type = 'activity',     requires_confirmation = false, skip_refinement = true WHERE id = 'public.stats';
UPDATE option_definitions SET target_widget = 'data_list',     entity_type = 'announcement', requires_confirmation = false, skip_refinement = true WHERE id = 'public.announcements';
UPDATE option_definitions SET target_widget = 'data_list',     entity_type = 'info_card',    requires_confirmation = false, skip_refinement = true WHERE id = 'public.info_cards';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'user',         requires_confirmation = false, skip_refinement = true WHERE id = 'public.about';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'suggestion',   requires_confirmation = true,  skip_refinement = true WHERE id = 'public.suggestion.submit';
UPDATE option_definitions SET target_widget = 'data_list',     entity_type = 'suggestion',   requires_confirmation = false, skip_refinement = true WHERE id = 'public.suggestion.list';

-- Announcement options
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'announcement', requires_confirmation = true,  skip_refinement = true WHERE id = 'announcement.create';
UPDATE option_definitions SET target_widget = 'data_list',     entity_type = 'announcement', requires_confirmation = false, skip_refinement = true WHERE id = 'announcement.list';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'announcement', requires_confirmation = true,  skip_refinement = true WHERE id = 'announcement.edit';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'announcement', requires_confirmation = true,  skip_refinement = true WHERE id = 'announcement.delete';

-- Info card options
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'info_card', requires_confirmation = true,  skip_refinement = true WHERE id = 'info_card.create';
UPDATE option_definitions SET target_widget = 'data_list',     entity_type = 'info_card', requires_confirmation = false, skip_refinement = true WHERE id = 'info_card.list';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'info_card', requires_confirmation = true,  skip_refinement = true WHERE id = 'info_card.edit';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'info_card', requires_confirmation = true,  skip_refinement = true WHERE id = 'info_card.delete';

-- Report, bookmark, plan, profile, public_site
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'report',   requires_confirmation = true,  skip_refinement = true WHERE id = 'report.request';
UPDATE option_definitions SET target_widget = 'data_list',     entity_type = 'report',   requires_confirmation = false, skip_refinement = true WHERE id = 'report.list';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'bookmark', requires_confirmation = true,  skip_refinement = true WHERE id = 'bookmark.add';
UPDATE option_definitions SET target_widget = 'data_list',     entity_type = 'bookmark', requires_confirmation = false, skip_refinement = true WHERE id = 'bookmark.list';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'bookmark', requires_confirmation = true,  skip_refinement = true WHERE id = 'bookmark.remove';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'plan',     requires_confirmation = true,  skip_refinement = true WHERE id = 'plan.create';
UPDATE option_definitions SET target_widget = 'data_list',     entity_type = 'plan',     requires_confirmation = false, skip_refinement = true WHERE id = 'plan.list';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'plan',     requires_confirmation = true,  skip_refinement = true WHERE id = 'plan.edit';
UPDATE option_definitions SET target_widget = 'data_list',     entity_type = 'user',     requires_confirmation = false, skip_refinement = true WHERE id = 'profile.view';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'user',     requires_confirmation = true,  skip_refinement = true WHERE id = 'profile.edit';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'public_site', requires_confirmation = true,  skip_refinement = true WHERE id = 'public_site.configure';
UPDATE option_definitions SET target_widget = 'data_list',     entity_type = 'public_site', requires_confirmation = false, skip_refinement = true WHERE id = 'public_site.preview';

-- Suggestion box options
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'citizen_access',  requires_confirmation = true,  skip_refinement = true WHERE id = 'citizen.access.create';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'citizen_access',  requires_confirmation = true,  skip_refinement = true WHERE id = 'citizen.access.assign';
UPDATE option_definitions SET target_widget = 'data_list',     entity_type = 'citizen_access',  requires_confirmation = false, skip_refinement = true WHERE id = 'citizen.access.list';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'citizen_access',  requires_confirmation = true,  skip_refinement = true WHERE id = 'citizen.access.revoke';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'citizen_access',  requires_confirmation = true,  skip_refinement = true WHERE id = 'citizen.access.regenerate';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'citizen_group',   requires_confirmation = true,  skip_refinement = true WHERE id = 'citizen.group.create';
UPDATE option_definitions SET target_widget = 'data_list',     entity_type = 'citizen_group',   requires_confirmation = false, skip_refinement = true WHERE id = 'citizen.group.list';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'citizen_group',   requires_confirmation = true,  skip_refinement = true WHERE id = 'citizen.group.edit';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'suggestion_box',  requires_confirmation = true,  skip_refinement = true WHERE id = 'suggestion_box.create';
UPDATE option_definitions SET target_widget = 'data_list',     entity_type = 'suggestion_box',  requires_confirmation = false, skip_refinement = true WHERE id = 'suggestion_box.list';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'suggestion_box',  requires_confirmation = true,  skip_refinement = true WHERE id = 'suggestion_box.edit';
UPDATE option_definitions SET target_widget = 'data_list',     entity_type = 'suggestion',      requires_confirmation = false, skip_refinement = true WHERE id = 'suggestion.list';
UPDATE option_definitions SET target_widget = 'text_response', entity_type = 'suggestion',      requires_confirmation = true,  skip_refinement = true WHERE id = 'suggestion.respond';

-- ============================================================
-- 3. Convert query contexts into regular analysis options
-- ============================================================

INSERT INTO option_definitions (
  id, name, description, category, icon, keywords, user_types,
  show_in_defaults, default_priority, accepts_files,
  input_schema, summary_prompt, follow_up_option_ids, is_active,
  target_widget, requires_confirmation, skip_refinement, entity_type
) VALUES
(
  'analysis.activities',
  'Search Activities',
  'Search, filter, and browse across all your activities',
  'analysis', 'Search',
  ARRAY['search', 'find', 'filter', 'browse', 'activities'],
  ARRAY['worker', 'candidate', 'representative'],
  false, 200, false,
  '{"type":"object","properties":{"status":{"type":"string"},"date_from":{"type":"string"},"date_to":{"type":"string"},"tag":{"type":"string"},"search_text":{"type":"string"}}}'::jsonb,
  '', ARRAY['activity.view', 'activity.edit', 'activity.create'],
  true,
  'data_list', false, true, 'activity'
),
(
  'analysis.tags',
  'Tags & Categories',
  'View tag usage, distribution, and activity counts per tag',
  'analysis', 'Tags',
  ARRAY['tags', 'categories', 'labels', 'breakdown'],
  ARRAY['worker', 'candidate', 'representative'],
  false, 210, false,
  '{"type":"object","properties":{"source":{"type":"string"}}}'::jsonb,
  '', ARRAY['tag.manage', 'tag.create'],
  true,
  'chart', false, true, 'tag'
),
(
  'analysis.timeline',
  'Activity Timeline',
  'View trends, patterns, and time-based analysis of activities',
  'analysis', 'Calendar',
  ARRAY['timeline', 'trends', 'patterns', 'time', 'monthly', 'weekly'],
  ARRAY['worker', 'candidate', 'representative'],
  false, 220, false,
  '{"type":"object","properties":{"granularity":{"type":"string"},"date_from":{"type":"string"},"date_to":{"type":"string"},"status":{"type":"string"}}}'::jsonb,
  '', ARRAY['activity.list', 'view.stats'],
  true,
  'chart', false, true, 'activity'
),
(
  'analysis.notes',
  'Search Notes',
  'Search across all activity notes and follow-ups',
  'analysis', 'MessageSquare',
  ARRAY['notes', 'search notes', 'follow-ups', 'comments'],
  ARRAY['worker', 'candidate', 'representative'],
  false, 230, false,
  '{"type":"object","properties":{"search_text":{"type":"string"},"date_from":{"type":"string"},"date_to":{"type":"string"}}}'::jsonb,
  '', ARRAY['activity.view'],
  true,
  'data_list', false, true, 'note'
),
(
  'analysis.specific_activity',
  'Find an Activity',
  'Look up a specific activity by title, date, or other criteria',
  'analysis', 'Eye',
  ARRAY['find', 'specific', 'lookup', 'particular'],
  ARRAY['worker', 'candidate', 'representative'],
  false, 240, false,
  '{"type":"object","properties":{"search_text":{"type":"string"},"date":{"type":"string"},"status":{"type":"string"}},"required":["search_text"]}'::jsonb,
  '', ARRAY['activity.view', 'activity.edit'],
  true,
  'data_list', false, true, 'activity'
);

-- SQL templates for the analysis options

-- analysis.activities: parameterized search with optional filters
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('analysis.activities', 'search_activities',
$$SELECT a.id, a.title, a.description, a.status, a.visibility,
       a.activity_date, a.location, a.is_pinned,
       array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tag_names,
       count(DISTINCT an.id) as note_count,
       count(DISTINCT am.id) as media_count
FROM activities a
LEFT JOIN activity_tags at2 ON a.id = at2.activity_id
LEFT JOIN tags t ON at2.tag_id = t.id
LEFT JOIN activity_notes an ON a.id = an.activity_id AND an.deleted_at IS NULL
LEFT JOIN activity_media am ON a.id = am.activity_id
WHERE a.tenant_id = $1 AND a.deleted_at IS NULL
  AND ($2::text IS NULL OR a.status = $2)
  AND ($3::date IS NULL OR a.activity_date >= $3::date)
  AND ($4::date IS NULL OR a.activity_date <= $4::date)
  AND ($5::text IS NULL OR a.title ILIKE '%' || $5 || '%' OR a.description ILIKE '%' || $5 || '%')
GROUP BY a.id
ORDER BY a.activity_date DESC NULLS LAST
LIMIT 50$$,
'{"$1":"context.tenantId","$2":"params.status","$3":"params.date_from","$4":"params.date_to","$5":"params.search_text"}'::jsonb,
0, 'read');

-- analysis.tags: tag breakdown with optional source filter
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('analysis.tags', 'tags_breakdown',
$$SELECT t.name, t.color, t.source, count(at2.id) as activity_count
FROM tags t
LEFT JOIN activity_tags at2 ON t.id = at2.tag_id
LEFT JOIN activities a ON at2.activity_id = a.id AND a.deleted_at IS NULL AND a.tenant_id = $1
WHERE (t.tenant_id = $1 OR t.tenant_id IS NULL) AND t.is_hidden = false
  AND ($2::text IS NULL OR t.source = $2)
GROUP BY t.id, t.name, t.color, t.source
ORDER BY activity_count DESC$$,
'{"$1":"context.tenantId","$2":"params.source"}'::jsonb,
0, 'read');

-- analysis.timeline: activity timeline with granularity and filters
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('analysis.timeline', 'activity_timeline',
$$SELECT
  date_trunc(COALESCE($2, 'week'), a.activity_date) as period,
  count(*) as activity_count,
  count(*) FILTER (WHERE a.status = 'completed') as completed_count,
  count(*) FILTER (WHERE a.status = 'planned') as planned_count,
  count(*) FILTER (WHERE a.status = 'in_progress') as in_progress_count
FROM activities a
WHERE a.tenant_id = $1 AND a.deleted_at IS NULL AND a.activity_date IS NOT NULL
  AND ($3::date IS NULL OR a.activity_date >= $3::date)
  AND ($4::date IS NULL OR a.activity_date <= $4::date)
  AND ($5::text IS NULL OR a.status = $5)
GROUP BY period
ORDER BY period DESC
LIMIT 30$$,
'{"$1":"context.tenantId","$2":"params.granularity","$3":"params.date_from","$4":"params.date_to","$5":"params.status"}'::jsonb,
0, 'read');

-- analysis.notes: search across notes
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('analysis.notes', 'search_notes',
$$SELECT an.id, an.content, an.created_at, a.title as activity_title, a.id as activity_id
FROM activity_notes an
JOIN activities a ON an.activity_id = a.id
WHERE an.tenant_id = $1 AND an.deleted_at IS NULL AND a.deleted_at IS NULL
  AND ($2::text IS NULL OR an.content ILIKE '%' || $2 || '%')
  AND ($3::date IS NULL OR an.created_at >= $3::date)
  AND ($4::date IS NULL OR an.created_at <= $4::date)
ORDER BY an.created_at DESC
LIMIT 50$$,
'{"$1":"context.tenantId","$2":"params.search_text","$3":"params.date_from","$4":"params.date_to"}'::jsonb,
0, 'read');

-- analysis.specific_activity: find by search text
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('analysis.specific_activity', 'find_activity',
$$SELECT a.id, a.title, a.description, a.status, a.visibility,
       a.activity_date, a.location,
       (SELECT count(*) FROM activity_notes WHERE activity_id = a.id AND deleted_at IS NULL) as note_count,
       (SELECT count(*) FROM activity_media WHERE activity_id = a.id) as media_count
FROM activities a
WHERE a.tenant_id = $1 AND a.deleted_at IS NULL
  AND (a.title ILIKE '%' || $2 || '%' OR a.description ILIKE '%' || $2 || '%')
  AND ($3::date IS NULL OR a.activity_date = $3::date)
  AND ($4::text IS NULL OR a.status = $4)
ORDER BY a.activity_date DESC NULLS LAST
LIMIT 20$$,
'{"$1":"context.tenantId","$2":"params.search_text","$3":"params.date","$4":"params.status"}'::jsonb,
0, 'read');

-- Option questions for analysis options (Q&A filters)

-- analysis.activities questions
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('analysis.activities', 'What would you like to search for?', 'search_text', 1, false, NULL, '{"placeholder":"Enter search text (optional)"}'::jsonb, true),
('analysis.activities', 'Filter by status?', 'status', 2, false, 'select', '{"options":["planned","in_progress","completed","cancelled"],"placeholder":"Any status"}'::jsonb, true),
('analysis.activities', 'From date?', 'date_from', 3, false, 'date_picker', '{"placeholder":"Start date"}'::jsonb, true),
('analysis.activities', 'To date?', 'date_to', 4, false, 'date_picker', '{"placeholder":"End date"}'::jsonb, true);

-- analysis.tags questions
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('analysis.tags', 'Filter by tag type?', 'source', 1, false, 'select', '{"options":["system","custom"],"placeholder":"All types"}'::jsonb, true);

-- analysis.timeline questions
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('analysis.timeline', 'Time granularity?', 'granularity', 1, false, 'select', '{"options":["day","week","month"],"default":"week"}'::jsonb, true),
('analysis.timeline', 'From date?', 'date_from', 2, false, 'date_picker', '{"placeholder":"Start date"}'::jsonb, true),
('analysis.timeline', 'To date?', 'date_to', 3, false, 'date_picker', '{"placeholder":"End date"}'::jsonb, true),
('analysis.timeline', 'Filter by status?', 'status', 4, false, 'select', '{"options":["planned","in_progress","completed","cancelled"],"placeholder":"Any status"}'::jsonb, true);

-- analysis.notes questions
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('analysis.notes', 'Search text?', 'search_text', 1, false, NULL, '{"placeholder":"Enter search text (optional)"}'::jsonb, true),
('analysis.notes', 'From date?', 'date_from', 2, false, 'date_picker', '{"placeholder":"Start date"}'::jsonb, true),
('analysis.notes', 'To date?', 'date_to', 3, false, 'date_picker', '{"placeholder":"End date"}'::jsonb, true);

-- analysis.specific_activity questions
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('analysis.specific_activity', 'What are you looking for?', 'search_text', 1, true, NULL, '{"placeholder":"Title or description keywords"}'::jsonb, false),
('analysis.specific_activity', 'On a specific date?', 'date', 2, false, 'date_picker', '{"placeholder":"Activity date"}'::jsonb, true),
('analysis.specific_activity', 'With specific status?', 'status', 3, false, 'select', '{"options":["planned","in_progress","completed","cancelled"],"placeholder":"Any status"}'::jsonb, true);

-- ============================================================
-- 4. Add analysis options as follow-ups on activity.list
-- ============================================================
UPDATE option_definitions
SET follow_up_option_ids = follow_up_option_ids || ARRAY['analysis.activities', 'analysis.tags', 'analysis.timeline', 'analysis.notes']
WHERE id = 'activity.list'
  AND NOT follow_up_option_ids @> ARRAY['analysis.activities'];

UPDATE option_definitions
SET follow_up_option_ids = follow_up_option_ids || ARRAY['analysis.activities', 'analysis.timeline']
WHERE id = 'view.stats'
  AND NOT follow_up_option_ids @> ARRAY['analysis.activities'];

-- ============================================================
-- 5. Add analysis options to user_type_configs available_option_ids
-- ============================================================
UPDATE user_type_configs
SET available_option_ids = available_option_ids || ARRAY['analysis.activities', 'analysis.tags', 'analysis.timeline', 'analysis.notes', 'analysis.specific_activity']
WHERE user_type IN ('worker', 'candidate', 'representative')
  AND NOT available_option_ids @> ARRAY['analysis.activities'];

-- ============================================================
-- 6. Add missing option_questions for admin edit options
-- ============================================================

-- admin.tenant.edit questions
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('admin.tenant.edit', 'Which tenant?', 'tenant_id', 0, true, 'select', '{"source":"tenants"}'::jsonb, false),
('admin.tenant.edit', 'New name? (leave blank to keep current)', 'name', 1, false, NULL, '{"placeholder":"Tenant name"}'::jsonb, true),
('admin.tenant.edit', 'Subscription level?', 'subscription', 2, false, 'select', '{"options":["free","basic","premium"],"placeholder":"Keep current"}'::jsonb, true),
('admin.tenant.edit', 'Custom domain? (leave blank to keep current)', 'custom_domain', 3, false, NULL, '{"placeholder":"e.g. app.example.com"}'::jsonb, true);

-- admin.user.edit questions
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('admin.user.edit', 'Which user? (user ID)', 'user_id', 0, true, NULL, '{"placeholder":"User ID"}'::jsonb, false),
('admin.user.edit', 'New display name? (leave blank to keep current)', 'display_name', 1, false, NULL, '{"placeholder":"Display name"}'::jsonb, true),
('admin.user.edit', 'New user type?', 'user_type', 2, false, 'select', '{"options":["worker","candidate","representative"],"placeholder":"Keep current"}'::jsonb, true),
('admin.user.edit', 'Regenerate access code?', 'regenerate_access_code', 3, false, 'select', '{"options":["false","true"],"default":"false"}'::jsonb, true),
('admin.user.edit', 'Deactivate user?', 'deactivate', 4, false, 'select', '{"options":["false","true"],"default":"false"}'::jsonb, true);
