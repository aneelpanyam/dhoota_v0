-- Add AI summary storage to activities
ALTER TABLE activities ADD COLUMN ai_summary jsonb;

-- Add option-specific refinement prompt
ALTER TABLE option_definitions ADD COLUMN refinement_prompt text;

-- Seed refinement prompts for activity options
UPDATE option_definitions SET refinement_prompt =
'Transform raw user input into a professional activity record.
- Title: Create a clear, concise 5-10 word title summarizing the activity
- Description: Expand into a well-written 1-2 sentence description that reads professionally
- Infer status from context (past tense = completed, future = planned)
- Default visibility to private unless explicitly stated
- Clean up informal language while preserving meaning
- Format dates in ISO format, infer from relative terms like "today", "yesterday"'
WHERE id = 'activity.create';

UPDATE option_definitions SET refinement_prompt =
'Refine updates to an existing activity record.
- Only include fields that are being changed
- Title: Clean up to 5-10 words if provided
- Description: Expand into professional language if provided
- Preserve existing values for unchanged fields
- Format dates in ISO format'
WHERE id = 'activity.edit';

-- Update activity.list SQL to include media array for thumbnails
UPDATE sql_templates SET sql =
'SELECT a.*, array_agg(DISTINCT jsonb_build_object(''id'', t.id, ''name'', t.name, ''color'', t.color)) FILTER (WHERE t.id IS NOT NULL) as tags, count(DISTINCT an.id) as note_count, count(DISTINCT am.id) as media_count, array_agg(DISTINCT jsonb_build_object(''id'', am.id, ''s3_key'', am.s3_key, ''mime_type'', am.mime_type, ''original_filename'', am.original_filename)) FILTER (WHERE am.id IS NOT NULL) as media FROM activities a LEFT JOIN activity_tags at2 ON a.id = at2.activity_id LEFT JOIN tags t ON at2.tag_id = t.id LEFT JOIN activity_notes an ON a.id = an.activity_id AND an.deleted_at IS NULL LEFT JOIN activity_media am ON a.id = am.activity_id WHERE a.tenant_id = $1 AND a.deleted_at IS NULL GROUP BY a.id ORDER BY a.activity_date DESC LIMIT $2 OFFSET $3'
WHERE option_id = 'activity.list' AND name = 'list_activities';
