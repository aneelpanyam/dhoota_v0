-- ============================================
-- 051: Add media array to public.activities list
-- List view: only first image per activity (thumbnail/banner).
-- Activity detail view still fetches all images (via activity.view get_media).
-- ============================================

UPDATE sql_templates
SET sql = 'SELECT a.id, a.title, a.description, a.activity_date, a.location, a.ai_summary, array_agg(DISTINCT jsonb_build_object(''name'', t.name, ''color'', t.color)) FILTER (WHERE t.id IS NOT NULL) as tags, count(DISTINCT am.id) as media_count, (SELECT COALESCE(jsonb_agg(jsonb_build_object(''id'', sub.id, ''s3_key'', sub.s3_key, ''mime_type'', sub.mime_type, ''original_filename'', sub.original_filename)), ''[]''::jsonb) FROM (SELECT am.id, am.s3_key, am.mime_type, am.original_filename FROM activity_media am WHERE am.activity_id = a.id AND am.mime_type LIKE ''image/%'' ORDER BY am.created_at ASC LIMIT 1) sub) as media FROM activities a LEFT JOIN activity_tags at2 ON a.id = at2.activity_id LEFT JOIN tags t ON at2.tag_id = t.id LEFT JOIN activity_media am ON a.id = am.activity_id WHERE a.tenant_id = $1 AND a.created_by = $2 AND a.visibility = ''public'' AND a.deleted_at IS NULL AND ($3::text IS NULL OR EXISTS(SELECT 1 FROM activity_tags at3 JOIN tags t3 ON at3.tag_id = t3.id WHERE at3.activity_id = a.id AND t3.name ILIKE $3)) GROUP BY a.id ORDER BY a.activity_date DESC LIMIT LEAST($4, 50) OFFSET $5'
WHERE option_id = 'public.activities' AND name = 'list_public_activities';
