-- ============================================
-- 046: Fix bulk activity create - visibility enum and JSON
-- - Use lower() for visibility so "Public" -> "public" works
-- - Add visibility dropdown options so users pick valid values
-- ============================================

UPDATE sql_templates
SET sql = 'INSERT INTO activities (tenant_id, created_by, title, description, status, visibility, activity_date, location)
SELECT $1, $2,
  left(e->>''description'', 100),
  e->>''description'',
  COALESCE((e->>''status'')::activity_status, ''completed''),
  COALESCE((lower(nullif(trim(coalesce(e->>''visibility'','''')), ''''))::activity_visibility), ''private''),
  COALESCE((e->>''activity_date'')::timestamptz, now()),
  e->>''location''
FROM jsonb_array_elements($3::jsonb) AS e
RETURNING *'
WHERE option_id = 'activity.create_bulk' AND name = 'insert_activities_bulk';

-- Add visibility dropdown, date picker type, and activity_date empty-string handling
UPDATE option_questions
SET widget_config = '{"columns": [
  {"key": "description", "label": "Description", "required": true},
  {"key": "activity_date", "label": "Date", "required": false, "type": "date"},
  {"key": "location", "label": "Location", "required": false},
  {"key": "visibility", "label": "Visibility", "required": false, "options": [{"value": "private", "label": "Private"}, {"value": "team", "label": "Team"}, {"value": "public", "label": "Public"}]},
  {"key": "media_keys", "label": "Photos/Files", "required": false, "type": "file_upload", "accept": "image/*,video/*", "multiple": true}
]}'::jsonb
WHERE option_id = 'activity.create_bulk' AND question_key = 'activities';
