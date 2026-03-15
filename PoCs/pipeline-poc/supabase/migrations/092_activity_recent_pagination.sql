-- 092: activity.recent - Add pagination support (LIMIT/OFFSET)
-- The list_recent_activities SQL had hardcoded LIMIT 10 and ignored page/pageSize.
-- Now it uses params.pageSize and params.offset so each page shows only its items.

-- 1. Add count template for activity.recent (same filters as list: tenant, no scope/visibility)
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('activity.recent', 'count_activities',
 'SELECT count(*) as total_count FROM activities WHERE tenant_id = $1 AND deleted_at IS NULL',
 '{"$1": "context.tenantId"}'::jsonb,
 1, 'read')
;

-- 2. Update list_recent_activities to use LIMIT $2 OFFSET $3
UPDATE sql_templates SET
  sql = 'SELECT a.*, array_agg(DISTINCT jsonb_build_object(''id'', t.id, ''name'', t.name, ''color'', t.color)) FILTER (WHERE t.id IS NOT NULL) as tags, count(DISTINCT an.id) as note_count, count(DISTINCT am.id) as media_count, array_agg(DISTINCT jsonb_build_object(''id'', am.id, ''s3_key'', am.s3_key, ''mime_type'', am.mime_type, ''original_filename'', am.original_filename)) FILTER (WHERE am.id IS NOT NULL) as media FROM activities a LEFT JOIN activity_tags at2 ON a.id = at2.activity_id LEFT JOIN tags t ON t.id = at2.tag_id LEFT JOIN activity_notes an ON a.id = an.activity_id AND an.deleted_at IS NULL LEFT JOIN activity_media am ON a.id = am.activity_id WHERE a.tenant_id = $1 AND a.deleted_at IS NULL GROUP BY a.id ORDER BY a.activity_date DESC LIMIT $2 OFFSET $3',
  param_mapping = '{"$1": "context.tenantId", "$2": "params.pageSize", "$3": "params.offset"}'::jsonb
WHERE option_id = 'activity.recent' AND name = 'list_recent_activities';

-- 3. Add page/pageSize to activity.recent input_schema so params flow through
UPDATE option_definitions
SET input_schema = '{"type":"object","properties":{"page":{"type":"integer","default":1},"pageSize":{"type":"integer","default":10}}}'::jsonb
WHERE id = 'activity.recent';
