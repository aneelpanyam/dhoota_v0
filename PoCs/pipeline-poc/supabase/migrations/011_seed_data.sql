-- ============================================
-- System Tags (tenant_id = NULL for global)
-- ============================================
INSERT INTO tags (id, tenant_id, name, slug, color, source) VALUES
    (gen_random_uuid(), NULL, 'Governance',     'governance',     '#3B82F6', 'system'),
    (gen_random_uuid(), NULL, 'Infrastructure', 'infrastructure', '#F59E0B', 'system'),
    (gen_random_uuid(), NULL, 'Healthcare',     'healthcare',     '#EF4444', 'system'),
    (gen_random_uuid(), NULL, 'Education',      'education',      '#8B5CF6', 'system'),
    (gen_random_uuid(), NULL, 'Community',      'community',      '#10B981', 'system'),
    (gen_random_uuid(), NULL, 'Rally',          'rally',          '#F97316', 'system'),
    (gen_random_uuid(), NULL, 'Meeting',        'meeting',        '#6366F1', 'system'),
    (gen_random_uuid(), NULL, 'Campaign',       'campaign',       '#EC4899', 'system'),
    (gen_random_uuid(), NULL, 'Ceremony',       'ceremony',       '#14B8A6', 'system'),
    (gen_random_uuid(), NULL, 'Inspection',     'inspection',     '#84CC16', 'system'),
    (gen_random_uuid(), NULL, 'Welfare',        'welfare',        '#06B6D4', 'system'),
    (gen_random_uuid(), NULL, 'Sports',         'sports',         '#A855F7', 'system'),
    (gen_random_uuid(), NULL, 'Environment',    'environment',    '#22C55E', 'system'),
    (gen_random_uuid(), NULL, 'Culture',        'culture',        '#E11D48', 'system');

-- ============================================
-- Option Definitions
-- ============================================

-- activity.create
INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, response_prompt, follow_up_option_ids) VALUES
('activity.create', 'Add Activity', 'Create a new activity to track something you did or plan to do. Captures title, description, date, location, tags, media, and visibility.', 'activity', 'Plus', ARRAY['add', 'create', 'new', 'log', 'record', 'did', 'went', 'visited', 'attended', 'organized', 'conducted'], ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[], true, 10, true,
'{"type":"object","properties":{"title":{"type":"string"},"description":{"type":"string"},"activity_date":{"type":"string","format":"date-time"},"location":{"type":"string"},"status":{"type":"string","enum":["planned","in_progress","completed","cancelled"]},"visibility":{"type":"string","enum":["private","team","public"]},"tags":{"type":"array","items":{"type":"string"}},"media_keys":{"type":"array","items":{"type":"string"}}},"required":["title"]}',
'You are formatting the response after creating an activity. Show the created activity as an activity_card widget. Include a brief congratulatory summary. Suggest relevant follow-up actions.',
ARRAY['activity.add_note', 'activity.add_media', 'activity.list']);

-- activity.list
INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, response_prompt, follow_up_option_ids) VALUES
('activity.list', 'View Activities', 'Show a list of your recent activities with filtering and sorting options.', 'activity', 'List', ARRAY['list', 'show', 'view', 'activities', 'recent', 'all', 'my'], ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[], true, 20, false,
'{"type":"object","properties":{"page":{"type":"integer","default":1},"pageSize":{"type":"integer","default":10},"status":{"type":"string"},"visibility":{"type":"string"},"tag":{"type":"string"},"sortBy":{"type":"string","default":"activity_date"},"sortOrder":{"type":"string","default":"desc"}}}'::jsonb,
'You are formatting a list of activities. Show them as a data_list widget with columns for title, date, status, and tags. Include a summary count. Each item should have View, Edit, Add Note actions.',
ARRAY['activity.create', 'view.stats']);

-- activity.view
INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, response_prompt, follow_up_option_ids) VALUES
('activity.view', 'View Activity Details', 'View the full details of a specific activity including notes and media.', 'activity', 'Eye', ARRAY['view', 'details', 'show', 'open'], ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[], false, 100, false,
'{"type":"object","properties":{"activity_id":{"type":"string"}},"required":["activity_id"]}'::jsonb,
'Show the full activity as an activity_card widget with all details including notes, media gallery, and tags. Include Edit, Add Note, Add Media, Delete actions.',
ARRAY['activity.edit', 'activity.add_note', 'activity.add_media', 'activity.delete']);

-- activity.edit
INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, response_prompt, follow_up_option_ids) VALUES
('activity.edit', 'Edit Activity', 'Edit an existing activity - change title, description, date, location, status, visibility, or tags.', 'activity', 'Pencil', ARRAY['edit', 'update', 'change', 'modify'], ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[], false, 100, true,
'{"type":"object","properties":{"activity_id":{"type":"string"},"title":{"type":"string"},"description":{"type":"string"},"activity_date":{"type":"string","format":"date-time"},"location":{"type":"string"},"status":{"type":"string","enum":["planned","in_progress","completed","cancelled"]},"visibility":{"type":"string","enum":["private","team","public"]},"tags":{"type":"array","items":{"type":"string"}}},"required":["activity_id"]}'::jsonb,
'Show the updated activity as an activity_card widget. Summarize what changed.',
ARRAY['activity.view', 'activity.list']);

-- activity.delete
INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, response_prompt, follow_up_option_ids) VALUES
('activity.delete', 'Delete Activity', 'Soft-delete an activity. It can be recovered later.', 'activity', 'Trash2', ARRAY['delete', 'remove', 'discard'], ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[], false, 100, false,
'{"type":"object","properties":{"activity_id":{"type":"string"}},"required":["activity_id"]}'::jsonb,
'Confirm the activity has been deleted. Show a text_response with the summary.',
ARRAY['activity.list', 'activity.create']);

-- activity.add_note
INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, response_prompt, follow_up_option_ids) VALUES
('activity.add_note', 'Add Note', 'Add a follow-up note or update to an existing activity.', 'activity', 'MessageSquare', ARRAY['note', 'comment', 'update', 'followup', 'follow-up', 'annotate'], ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[], false, 100, true,
'{"type":"object","properties":{"activity_id":{"type":"string"},"content":{"type":"string"}},"required":["activity_id","content"]}'::jsonb,
'Show the note that was added and the activity it belongs to. Use a text_response for the note content and an activity_card for context.',
ARRAY['activity.view', 'activity.add_note']);

-- activity.add_media
INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, response_prompt, follow_up_option_ids) VALUES
('activity.add_media', 'Add Media', 'Attach photos, videos, or documents to an existing activity.', 'activity', 'Image', ARRAY['photo', 'image', 'video', 'upload', 'attach', 'media', 'picture'], ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[], false, 100, true,
'{"type":"object","properties":{"activity_id":{"type":"string"},"media_keys":{"type":"array","items":{"type":"string"}}},"required":["activity_id","media_keys"]}'::jsonb,
'Show the media gallery for the activity after the new media has been added. Use a media_gallery widget.',
ARRAY['activity.view']);

-- view.stats
INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, response_prompt, follow_up_option_ids) VALUES
('view.stats', 'Activity Stats', 'Show statistics about your activities - counts, breakdowns by tag, status trends, and more.', 'view', 'BarChart3', ARRAY['stats', 'statistics', 'dashboard', 'summary', 'overview', 'analytics', 'numbers', 'count'], ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[], true, 30, false,
'{"type":"object","properties":{"period":{"type":"string","default":"month"}}}'::jsonb,
'Show activity statistics using stats_card widgets for key metrics (total activities, this week, completion rate) and a chart widget for tag breakdown. Choose appropriate chart types.',
ARRAY['activity.list', 'activity.create']);

-- tag.manage
INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, response_prompt, follow_up_option_ids) VALUES
('tag.manage', 'Manage Tags', 'View, create, and manage your custom tags for categorizing activities.', 'activity', 'Tags', ARRAY['tag', 'tags', 'label', 'category', 'manage tags'], ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[], false, 50, false,
'{"type":"object","properties":{"action":{"type":"string","enum":["list","create"]},"name":{"type":"string"},"color":{"type":"string"}}}'::jsonb,
'Show the list of tags (system + custom) as a data_list widget. Include create action.',
ARRAY['activity.create']);

-- tag.create
INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, response_prompt, follow_up_option_ids) VALUES
('tag.create', 'Create Tag', 'Create a new custom tag for organizing activities.', 'activity', 'TagIcon', ARRAY['new tag', 'create tag', 'add tag'], ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[], false, 100, false,
'{"type":"object","properties":{"name":{"type":"string"},"color":{"type":"string"}},"required":["name"]}'::jsonb,
'Confirm the tag was created. Show a text_response.',
ARRAY['tag.manage', 'activity.create']);

-- ============================================
-- SQL Templates
-- ============================================

-- activity.create templates
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('activity.create', 'insert_activity',
'INSERT INTO activities (tenant_id, created_by, title, description, status, visibility, activity_date, location) VALUES ($1, $2, $3, $4, COALESCE($5, ''completed'')::activity_status, COALESCE($6, ''private'')::activity_visibility, COALESCE($7::timestamptz, now()), $8) RETURNING *',
'{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.title", "$4": "params.description", "$5": "params.status", "$6": "params.visibility", "$7": "params.activity_date", "$8": "params.location"}'::jsonb,
0, 'write');

-- activity.list templates
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('activity.list', 'list_activities',
'SELECT a.*, array_agg(DISTINCT jsonb_build_object(''id'', t.id, ''name'', t.name, ''color'', t.color)) FILTER (WHERE t.id IS NOT NULL) as tags, count(DISTINCT an.id) as note_count, count(DISTINCT am.id) as media_count FROM activities a LEFT JOIN activity_tags at2 ON a.id = at2.activity_id LEFT JOIN tags t ON at2.tag_id = t.id LEFT JOIN activity_notes an ON a.id = an.activity_id AND an.deleted_at IS NULL LEFT JOIN activity_media am ON a.id = am.activity_id WHERE a.tenant_id = $1 AND a.deleted_at IS NULL GROUP BY a.id ORDER BY a.activity_date DESC LIMIT $2 OFFSET $3',
'{"$1": "context.tenantId", "$2": "params.pageSize", "$3": "params.offset"}'::jsonb,
0, 'read');

-- activity.view templates
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('activity.view', 'get_activity',
'SELECT a.*, array_agg(DISTINCT jsonb_build_object(''id'', t.id, ''name'', t.name, ''color'', t.color)) FILTER (WHERE t.id IS NOT NULL) as tags FROM activities a LEFT JOIN activity_tags at2 ON a.id = at2.activity_id LEFT JOIN tags t ON at2.tag_id = t.id WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL GROUP BY a.id',
'{"$1": "params.activity_id", "$2": "context.tenantId"}'::jsonb,
0, 'read'),
('activity.view', 'get_notes',
'SELECT * FROM activity_notes WHERE activity_id = $1 AND tenant_id = $2 AND deleted_at IS NULL ORDER BY created_at ASC',
'{"$1": "params.activity_id", "$2": "context.tenantId"}'::jsonb,
1, 'read'),
('activity.view', 'get_media',
'SELECT * FROM activity_media WHERE activity_id = $1 AND tenant_id = $2 ORDER BY created_at ASC',
'{"$1": "params.activity_id", "$2": "context.tenantId"}'::jsonb,
2, 'read');

-- activity.edit templates
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('activity.edit', 'update_activity',
'UPDATE activities SET title = COALESCE($3, title), description = COALESCE($4, description), status = COALESCE($5, status), visibility = COALESCE($6, visibility), activity_date = COALESCE($7, activity_date), location = COALESCE($8, location) WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING *',
'{"$1": "params.activity_id", "$2": "context.tenantId", "$3": "params.title", "$4": "params.description", "$5": "params.status", "$6": "params.visibility", "$7": "params.activity_date", "$8": "params.location"}'::jsonb,
0, 'write');

-- activity.delete templates
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('activity.delete', 'soft_delete_activity',
'UPDATE activities SET deleted_at = now() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING id, title',
'{"$1": "params.activity_id", "$2": "context.tenantId"}'::jsonb,
0, 'write');

-- activity.add_note templates
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('activity.add_note', 'insert_note',
'INSERT INTO activity_notes (tenant_id, activity_id, created_by, content) VALUES ($1, $2, $3, $4) RETURNING *',
'{"$1": "context.tenantId", "$2": "params.activity_id", "$3": "context.userId", "$4": "params.content"}'::jsonb,
0, 'write');

-- activity.add_media templates
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('activity.add_media', 'insert_media',
'INSERT INTO activity_media (tenant_id, activity_id, uploaded_by, media_type, original_filename, s3_key, file_size_bytes, mime_type, processing_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ''ready'') RETURNING *',
'{"$1": "context.tenantId", "$2": "params.activity_id", "$3": "context.userId", "$4": "params.media_type", "$5": "params.original_filename", "$6": "params.s3_key", "$7": "params.file_size_bytes", "$8": "params.mime_type"}'::jsonb,
0, 'write');

-- view.stats templates
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('view.stats', 'total_stats',
'SELECT count(*) as total, count(*) FILTER (WHERE activity_date >= date_trunc(''week'', now())) as this_week, count(*) FILTER (WHERE activity_date >= date_trunc(''month'', now())) as this_month, count(*) FILTER (WHERE status = ''completed'') as completed, count(*) FILTER (WHERE status = ''planned'') as planned FROM activities WHERE tenant_id = $1 AND deleted_at IS NULL',
'{"$1": "context.tenantId"}'::jsonb,
0, 'read'),
('view.stats', 'tag_breakdown',
'SELECT t.name, t.color, count(at2.id) as count FROM tags t JOIN activity_tags at2 ON t.id = at2.tag_id JOIN activities a ON at2.activity_id = a.id WHERE (t.tenant_id = $1 OR t.tenant_id IS NULL) AND a.tenant_id = $1 AND a.deleted_at IS NULL GROUP BY t.id, t.name, t.color ORDER BY count DESC LIMIT 10',
'{"$1": "context.tenantId"}'::jsonb,
1, 'read');

-- tag.manage templates
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('tag.manage', 'list_tags',
'SELECT t.*, count(at2.id) as activity_count FROM tags t LEFT JOIN activity_tags at2 ON t.id = at2.tag_id WHERE (t.tenant_id = $1 OR t.tenant_id IS NULL) AND t.is_hidden = false GROUP BY t.id ORDER BY t.source, t.name',
'{"$1": "context.tenantId"}'::jsonb,
0, 'read');

-- tag.create templates
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('tag.create', 'insert_tag',
'INSERT INTO tags (tenant_id, name, slug, color, source) VALUES ($1, $2, $3, $4, ''custom'') RETURNING *',
'{"$1": "context.tenantId", "$2": "params.name", "$3": "params.slug", "$4": "params.color"}'::jsonb,
0, 'write');

-- ============================================
-- Option Questions (Guided Q&A)
-- ============================================

-- activity.create questions
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('activity.create', 'What did you do? Just describe it in your own words.', 'description_raw', 0, true, NULL, '{}', false),
('activity.create', 'When did this happen?', 'activity_date', 1, false, 'date_picker', '{"defaultToday": true}', true),
('activity.create', 'Where did this take place?', 'location', 2, false, NULL, '{}', true),
('activity.create', 'Any photos or videos from this?', 'media_keys', 3, false, 'file_upload', '{"accept": "image/*,video/*", "multiple": true}', false),
('activity.create', 'Who should be able to see this?', 'visibility', 4, false, 'visibility_select', '{"options": ["private", "team", "public"]}', true);

-- activity.edit questions
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('activity.edit', 'What would you like to change? Describe the updates.', 'edit_description', 0, true, NULL, '{}', false);

-- activity.add_note questions
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('activity.add_note', 'What would you like to add as a note?', 'content', 0, true, NULL, '{}', false);

-- tag.create questions
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('tag.create', 'What should the tag be called?', 'name', 0, true, NULL, '{}', true),
('tag.create', 'Pick a color for this tag.', 'color', 1, false, 'color_picker', '{}', true);

-- ============================================
-- User Type Configs
-- ============================================
INSERT INTO user_type_configs (user_type, init_option_ids, default_option_ids, available_option_ids, theme_config) VALUES
('worker',
 ARRAY['activity.list', 'view.stats'],
 ARRAY['activity.create', 'activity.list', 'view.stats', 'tag.manage'],
 ARRAY['activity.create', 'activity.list', 'activity.view', 'activity.edit', 'activity.delete', 'activity.add_note', 'activity.add_media', 'view.stats', 'tag.manage', 'tag.create'],
 '{}'::jsonb),
('candidate',
 ARRAY['activity.list', 'view.stats'],
 ARRAY['activity.create', 'activity.list', 'view.stats', 'tag.manage'],
 ARRAY['activity.create', 'activity.list', 'activity.view', 'activity.edit', 'activity.delete', 'activity.add_note', 'activity.add_media', 'view.stats', 'tag.manage', 'tag.create'],
 '{}'::jsonb),
('representative',
 ARRAY['activity.list', 'view.stats'],
 ARRAY['activity.create', 'activity.list', 'view.stats', 'tag.manage'],
 ARRAY['activity.create', 'activity.list', 'activity.view', 'activity.edit', 'activity.delete', 'activity.add_note', 'activity.add_media', 'view.stats', 'tag.manage', 'tag.create'],
 '{}'::jsonb);
