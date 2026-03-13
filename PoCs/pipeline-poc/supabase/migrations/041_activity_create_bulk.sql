-- ============================================
-- 041: Activity create bulk
-- New option to add multiple activities at once
-- with table question including file_upload column.
-- ============================================

INSERT INTO option_definitions (
  id, name, description, category, icon, keywords, user_types, required_toggles,
  show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt,
  follow_up_option_ids, target_widget, requires_confirmation, skip_refinement, entity_type
) VALUES (
  'activity.create_bulk', 'Add Activities in Bulk', 'Add multiple activities at once. Each row: description, date, location, visibility, and optional photos.',
  'activity', 'Plus', ARRAY['bulk add', 'add multiple', 'bulk create', 'add activities'],
  ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[], false, 11, true,
  jsonb_build_object(
    'type', 'object',
    'properties', jsonb_build_object(
      'activities', jsonb_build_object(
        'type', 'array',
        'items', jsonb_build_object(
          'type', 'object',
          'properties', jsonb_build_object(
            'description', jsonb_build_object('type', 'string'),
            'activity_date', jsonb_build_object('type', 'string', 'format', 'date-time'),
            'location', jsonb_build_object('type', 'string'),
            'visibility', jsonb_build_object('type', 'string', 'enum', jsonb_build_array('private', 'team', 'public')),
            'media_keys', jsonb_build_object('type', 'array', 'items', jsonb_build_object('type', 'object'))
          ),
          'required', jsonb_build_array('description')
        )
      )
    ),
    'required', jsonb_build_array('activities')
  ),
  'Show the created activities in a list. Summarize how many were added.',
  ARRAY['activity.list', 'activity.view', 'activity.create'],
  'data_list', true, true, 'activity'
);

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('activity.create_bulk', 'insert_activities_bulk',
'INSERT INTO activities (tenant_id, created_by, title, description, status, visibility, activity_date, location)
SELECT $1, $2,
  left(e->>''description'', 100),
  e->>''description'',
  COALESCE((e->>''status'')::activity_status, ''completed''),
  COALESCE((e->>''visibility'')::activity_visibility, ''private''),
  COALESCE((e->>''activity_date'')::timestamptz, now()),
  e->>''location''
FROM jsonb_array_elements($3::jsonb) AS e
RETURNING *',
'{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.activities"}'::jsonb,
0, 'write');

INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('activity.create_bulk', 'Add activities (one per row):', 'activities', 0, true, 'table',
'{"columns": [
  {"key": "description", "label": "Description", "required": true},
  {"key": "activity_date", "label": "Date", "required": false},
  {"key": "location", "label": "Location", "required": false},
  {"key": "visibility", "label": "Visibility", "required": false},
  {"key": "media_keys", "label": "Photos/Files", "required": false, "type": "file_upload", "accept": "image/*,video/*", "multiple": true}
]}'::jsonb,
false);

-- Add to worker, candidate, representative available options
UPDATE user_type_configs SET
  available_option_ids = array_append(available_option_ids, 'activity.create_bulk')
WHERE user_type IN ('worker', 'candidate', 'representative')
  AND NOT ('activity.create_bulk' = ANY(available_option_ids));
