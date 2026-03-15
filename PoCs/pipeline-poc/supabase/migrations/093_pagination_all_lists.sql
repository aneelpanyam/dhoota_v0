-- 093: Pagination for all list options
-- analysis.activities, public.activities, public.recent_activities get count + pagination.

-- ============================================================
-- 1. analysis.activities: add count + pagination to search_activities
-- ============================================================

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('analysis.activities', 'count_activities',
$$SELECT count(*) as total_count FROM activities a
WHERE a.tenant_id = $1 AND a.deleted_at IS NULL
  AND ($2::text IS NULL OR a.status::text = $2)
  AND ($3::date IS NULL OR a.activity_date >= $3::date)
  AND ($4::date IS NULL OR a.activity_date <= $4::date)
  AND ($5::text IS NULL OR a.title ILIKE '%' || $5 || '%' OR a.description ILIKE '%' || $5 || '%')
  AND ($6::text IS NULL OR EXISTS (
    SELECT 1 FROM activity_tags at3 JOIN tags t2 ON at3.tag_id = t2.id
    WHERE at3.activity_id = a.id AND t2.name = $6
  ))$$,
'{"$1":"context.tenantId","$2":"params.status","$3":"params.date_from","$4":"params.date_to","$5":"params.search_text","$6":"params.tag"}'::jsonb,
1, 'read');

UPDATE sql_templates SET
  sql = $$SELECT a.id, a.title, a.description, a.status, a.visibility,
       a.activity_date, a.location, a.is_pinned, a.ai_summary,
       array_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color)) FILTER (WHERE t.id IS NOT NULL) as tags,
       count(DISTINCT an.id) as note_count,
       count(DISTINCT am.id) as media_count,
       array_agg(DISTINCT jsonb_build_object('id', am.id, 's3_key', am.s3_key, 'mime_type', am.mime_type, 'original_filename', am.original_filename)) FILTER (WHERE am.id IS NOT NULL) as media
FROM activities a
LEFT JOIN activity_tags at2 ON a.id = at2.activity_id
LEFT JOIN tags t ON at2.tag_id = t.id
LEFT JOIN activity_notes an ON a.id = an.activity_id AND an.deleted_at IS NULL
LEFT JOIN activity_media am ON a.id = am.activity_id
WHERE a.tenant_id = $1 AND a.deleted_at IS NULL
  AND ($2::text IS NULL OR a.status::text = $2)
  AND ($3::date IS NULL OR a.activity_date >= $3::date)
  AND ($4::date IS NULL OR a.activity_date <= $4::date)
  AND ($5::text IS NULL OR a.title ILIKE '%' || $5 || '%' OR a.description ILIKE '%' || $5 || '%')
  AND ($6::text IS NULL OR EXISTS (
    SELECT 1 FROM activity_tags at3 JOIN tags t2 ON at3.tag_id = t2.id
    WHERE at3.activity_id = a.id AND t2.name = $6
  ))
GROUP BY a.id
ORDER BY a.activity_date DESC NULLS LAST
LIMIT $7 OFFSET $8$$,
  param_mapping = '{"$1":"context.tenantId","$2":"params.status","$3":"params.date_from","$4":"params.date_to","$5":"params.search_text","$6":"params.tag","$7":"params.pageSize","$8":"params.offset"}'::jsonb
WHERE option_id = 'analysis.activities' AND name = 'search_activities';

UPDATE option_definitions
SET input_schema = '{"type":"object","properties":{"search_text":{"type":"string"},"status":{"type":"string"},"date_from":{"type":"string"},"date_to":{"type":"string"},"tag":{"type":"string"},"page":{"type":"integer","default":1},"pageSize":{"type":"integer","default":10}}}'::jsonb
WHERE id = 'analysis.activities';

-- ============================================================
-- 2. public.activities: add count template (list already has LIMIT/OFFSET)
-- ============================================================

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('public.activities', 'count_activities',
'SELECT count(*) as total_count FROM activities a WHERE a.tenant_id = $1 AND a.created_by = $2 AND a.visibility = ''public'' AND a.deleted_at IS NULL AND ($3::text IS NULL OR EXISTS(SELECT 1 FROM activity_tags at3 JOIN tags t3 ON at3.tag_id = t3.id WHERE at3.activity_id = a.id AND t3.name ILIKE $3))',
'{"$1": "context.tenantId", "$2": "context.scopedUserId", "$3": "params.tag"}'::jsonb,
1, 'read');

-- ============================================================
-- 3. public.recent_activities: add count + pagination
-- ============================================================

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('public.recent_activities', 'count_activities',
'SELECT count(*) as total_count FROM activities WHERE tenant_id = $1 AND created_by = $2 AND visibility = ''public'' AND deleted_at IS NULL',
'{"$1": "context.tenantId", "$2": "context.scopedUserId"}'::jsonb,
1, 'read');

UPDATE sql_templates SET
  sql = 'SELECT a.id, a.title, a.description, a.activity_date, a.location, a.ai_summary, array_agg(DISTINCT jsonb_build_object(''name'', t.name, ''color'', t.color)) FILTER (WHERE t.id IS NOT NULL) as tags, count(DISTINCT am.id) as media_count, (SELECT COALESCE(jsonb_agg(jsonb_build_object(''id'', sub.id, ''s3_key'', sub.s3_key, ''mime_type'', sub.mime_type, ''original_filename'', sub.original_filename)), ''[]''::jsonb) FROM (SELECT am.id, am.s3_key, am.mime_type, am.original_filename FROM activity_media am WHERE am.activity_id = a.id AND am.mime_type LIKE ''image/%'' ORDER BY am.created_at ASC LIMIT 1) sub) as media FROM activities a LEFT JOIN activity_tags at2 ON a.id = at2.activity_id LEFT JOIN tags t ON at2.tag_id = t.id LEFT JOIN activity_media am ON a.id = am.activity_id WHERE a.tenant_id = $1 AND a.created_by = $2 AND a.visibility = ''public'' AND a.deleted_at IS NULL GROUP BY a.id ORDER BY a.activity_date DESC LIMIT $3 OFFSET $4',
  param_mapping = '{"$1": "context.tenantId", "$2": "context.scopedUserId", "$3": "params.pageSize", "$4": "params.offset"}'::jsonb
WHERE option_id = 'public.recent_activities' AND name = 'list_recent_public_activities';

UPDATE option_definitions
SET input_schema = '{"type":"object","properties":{"page":{"type":"integer","default":1},"pageSize":{"type":"integer","default":10}}}'::jsonb
WHERE id = 'public.recent_activities';
