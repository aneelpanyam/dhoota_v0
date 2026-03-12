-- Enrich analysis option SQL templates to return structured data
-- compatible with the rich ActivityListItem, TagListItem, and NoteListItem renderers.

-- ============================================================
-- 1. analysis.activities: return structured tags + media + ai_summary
--    (matches activity.list data shape for ActivityListItem)
-- ============================================================
UPDATE sql_templates SET sql =
$$SELECT a.id, a.title, a.description, a.status, a.visibility,
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
    SELECT 1 FROM activity_tags at3
    JOIN tags t2 ON at3.tag_id = t2.id
    WHERE at3.activity_id = a.id AND t2.name = $6
  ))
GROUP BY a.id
ORDER BY a.activity_date DESC NULLS LAST
LIMIT 50$$,
param_mapping = '{"$1":"context.tenantId","$2":"params.status","$3":"params.date_from","$4":"params.date_to","$5":"params.search_text","$6":"params.tag"}'::jsonb
WHERE option_id = 'analysis.activities' AND name = 'search_activities';

-- ============================================================
-- 2. analysis.specific_activity: return structured tags + media + ai_summary
-- ============================================================
UPDATE sql_templates SET sql =
$$SELECT a.id, a.title, a.description, a.status, a.visibility,
       a.activity_date, a.location, a.ai_summary,
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
  AND (a.title ILIKE '%' || $2 || '%' OR a.description ILIKE '%' || $2 || '%')
  AND ($3::date IS NULL OR a.activity_date = $3::date)
  AND ($4::text IS NULL OR a.status::text = $4)
GROUP BY a.id
ORDER BY a.activity_date DESC NULLS LAST
LIMIT 20$$
WHERE option_id = 'analysis.specific_activity' AND name = 'find_activity';

-- ============================================================
-- 3. analysis.notes: add activity status and date for richer rendering
-- ============================================================
UPDATE sql_templates SET sql =
$$SELECT an.id, an.content, an.created_at,
       a.title as activity_title, a.id as activity_id,
       a.status as activity_status, a.activity_date as activity_date
FROM activity_notes an
JOIN activities a ON an.activity_id = a.id
WHERE an.tenant_id = $1 AND an.deleted_at IS NULL AND a.deleted_at IS NULL
  AND ($2::text IS NULL OR an.content ILIKE '%' || $2 || '%')
  AND ($3::date IS NULL OR an.created_at >= $3::date)
  AND ($4::date IS NULL OR an.created_at <= $4::date)
ORDER BY an.created_at DESC
LIMIT 50$$
WHERE option_id = 'analysis.notes' AND name = 'search_notes';

-- ============================================================
-- 4. analysis.tags: add tag id, filter by tag name instead of source
-- ============================================================
UPDATE sql_templates SET sql =
$$SELECT t.id, t.name, t.color, t.source, count(at2.id) as activity_count
FROM tags t
LEFT JOIN activity_tags at2 ON t.id = at2.tag_id
LEFT JOIN activities a ON at2.activity_id = a.id AND a.deleted_at IS NULL AND a.tenant_id = $1
WHERE (t.tenant_id = $1 OR t.tenant_id IS NULL) AND t.is_hidden = false
  AND ($2::text IS NULL OR t.name ILIKE '%' || $2 || '%')
GROUP BY t.id, t.name, t.color, t.source
ORDER BY activity_count DESC$$,
param_mapping = '{"$1":"context.tenantId","$2":"params.search_text"}'::jsonb
WHERE option_id = 'analysis.tags' AND name = 'tags_breakdown';

-- Update the analysis.tags question: search by name instead of source type
UPDATE option_questions
SET question_text = 'Search by tag name?',
    question_key = 'search_text',
    inline_widget = NULL,
    widget_config = '{"placeholder":"Tag name (optional)"}'::jsonb
WHERE option_id = 'analysis.tags' AND question_key = 'source';

-- ============================================================
-- 5. analysis.timeline: fix enum cast for status filter
-- ============================================================
UPDATE sql_templates SET sql =
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
  AND ($5::text IS NULL OR a.status::text = $5)
GROUP BY period
ORDER BY period DESC
LIMIT 30$$
WHERE option_id = 'analysis.timeline' AND name = 'activity_timeline';

-- ============================================================
-- 6. Add tag filter question to analysis.activities
-- ============================================================
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable)
VALUES ('analysis.activities', 'Filter by tag?', 'tag', 5, false, NULL, '{"placeholder":"Tag name (optional)"}'::jsonb, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. Add analysis.activities as a follow-up on analysis.tags
--    so clicking a tag can drill down to activities with that tag
-- ============================================================
UPDATE option_definitions
SET follow_up_option_ids = follow_up_option_ids || ARRAY['analysis.activities']
WHERE id = 'analysis.tags'
  AND NOT follow_up_option_ids @> ARRAY['analysis.activities'];
