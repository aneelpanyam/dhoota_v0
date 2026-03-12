-- Fix follow_up_option_ids so item-level actions (Edit, View, Add Note) appear on activity list items and cards

-- activity.list: add item-level options alongside the existing list-level ones
UPDATE option_definitions
SET follow_up_option_ids = ARRAY['activity.create', 'view.stats', 'activity.view', 'activity.edit', 'activity.add_note', 'activity.add_media']
WHERE id = 'activity.list';

-- activity.create: add activity.edit so you can edit right after creating
UPDATE option_definitions
SET follow_up_option_ids = ARRAY['activity.edit', 'activity.add_note', 'activity.add_media', 'activity.list']
WHERE id = 'activity.create';

-- activity.edit: ensure it links back to view, list, and further edits
UPDATE option_definitions
SET follow_up_option_ids = ARRAY['activity.view', 'activity.edit', 'activity.list']
WHERE id = 'activity.edit';

-- Fix activity.edit SQL template: add explicit enum casts (matches activity.create fix)
UPDATE sql_templates
SET sql = 'UPDATE activities SET title = COALESCE($3, title), description = COALESCE($4, description), status = COALESCE($5::activity_status, status), visibility = COALESCE($6::activity_visibility, visibility), activity_date = COALESCE($7::timestamptz, activity_date), location = COALESCE($8, location) WHERE id = $1::uuid AND tenant_id = $2::uuid AND deleted_at IS NULL RETURNING *'
WHERE option_id = 'activity.edit' AND name = 'update_activity';
