-- ============================================
-- 080: activity.list - Add scope and visibility filters
-- Optional questions let users filter by:
-- - Scope: All activities (tenant) vs My activities only
-- - Visibility: All | Public only | Private & Team
-- Supports use case: view my public activities, or view my non-public to mark as public.
-- ============================================

-- 1. Update input_schema for activity.list
UPDATE option_definitions
SET input_schema = '{"type":"object","properties":{"page":{"type":"integer","default":1},"pageSize":{"type":"integer","default":10},"scope":{"type":"string","enum":["all","mine"],"default":"all"},"visibility":{"type":"string","enum":["all","public","non_public"],"default":"all"},"status":{"type":"string"},"tag":{"type":"string"},"sortBy":{"type":"string","default":"activity_date"},"sortOrder":{"type":"string","default":"desc"}}}'::jsonb
WHERE id = 'activity.list';

-- 2. Add optional questions (both optional - user can skip for default behavior)
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('activity.list', 'Show your activities only or all?', 'scope', 0, false, 'select', '{"options":[{"value":"all","label":"All activities"},{"value":"mine","label":"My activities only"}],"placeholder":"All activities","default":"all"}'::jsonb, true),
('activity.list', 'Filter by visibility?', 'visibility', 1, false, 'select', '{"options":[{"value":"all","label":"All"},{"value":"public","label":"Public only"},{"value":"non_public","label":"Private & Team"}],"placeholder":"All","default":"all"}'::jsonb, true);

-- 3. Update list_activities SQL - add scope and visibility filters
-- $1=tenantId, $2=pageSize, $3=offset, $4=scope, $5=userId, $6=visibility
UPDATE sql_templates SET
  sql = 'SELECT a.*, array_agg(DISTINCT jsonb_build_object(''id'', t.id, ''name'', t.name, ''color'', t.color)) FILTER (WHERE t.id IS NOT NULL) as tags, count(DISTINCT an.id) as note_count, count(DISTINCT am.id) as media_count, array_agg(DISTINCT jsonb_build_object(''id'', am.id, ''s3_key'', am.s3_key, ''mime_type'', am.mime_type, ''original_filename'', am.original_filename)) FILTER (WHERE am.id IS NOT NULL) as media FROM activities a LEFT JOIN activity_tags at2 ON a.id = at2.activity_id LEFT JOIN tags t ON at2.tag_id = t.id LEFT JOIN activity_notes an ON a.id = an.activity_id AND an.deleted_at IS NULL LEFT JOIN activity_media am ON a.id = am.activity_id WHERE a.tenant_id = $1 AND a.deleted_at IS NULL AND ($4::text IS NULL OR $4 = ''all'' OR a.created_by = $5) AND ($6::text IS NULL OR $6 = ''all'' OR ($6 = ''public'' AND a.visibility = ''public'') OR ($6 = ''non_public'' AND a.visibility IN (''private'',''team''))) GROUP BY a.id ORDER BY a.activity_date DESC LIMIT $2 OFFSET $3',
  param_mapping = '{"$1":"context.tenantId","$2":"params.pageSize","$3":"params.offset","$4":"params.scope","$5":"context.userId","$6":"params.visibility"}'::jsonb
WHERE option_id = 'activity.list' AND name = 'list_activities';

-- 4. Update count_activities SQL - same filters, $2/$3 unused but required for param alignment
UPDATE sql_templates SET
  sql = 'SELECT count(*) as total_count FROM activities WHERE tenant_id = $1 AND deleted_at IS NULL AND ($4::text IS NULL OR $4 = ''all'' OR created_by = $5) AND ($6::text IS NULL OR $6 = ''all'' OR ($6 = ''public'' AND visibility = ''public'') OR ($6 = ''non_public'' AND visibility IN (''private'',''team'')))',
  param_mapping = '{"$1":"context.tenantId","$2":"params.pageSize","$3":"params.offset","$4":"params.scope","$5":"context.userId","$6":"params.visibility"}'::jsonb
WHERE option_id = 'activity.list' AND name = 'count_activities';
