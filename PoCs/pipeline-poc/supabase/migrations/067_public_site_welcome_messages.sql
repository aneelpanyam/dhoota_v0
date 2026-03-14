-- ============================================
-- 067: Public site welcome messages (multiple with optional banners)
-- New table + options for list/add/edit/delete, similar to announcements
-- welcome_message in public_site_configs remains as default fallback when empty
-- ============================================

CREATE TABLE public_site_welcome_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  user_id       uuid NOT NULL REFERENCES users(id),
  display_order integer NOT NULL DEFAULT 0,
  message_text  text NOT NULL,
  banner_url    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_public_site_welcome_messages_tenant_user ON public_site_welcome_messages(tenant_id, user_id);
CREATE INDEX idx_public_site_welcome_messages_order ON public_site_welcome_messages(tenant_id, user_id, display_order);

-- Migrate existing welcome_message to first row per (tenant_id, user_id)
INSERT INTO public_site_welcome_messages (tenant_id, user_id, display_order, message_text)
SELECT tenant_id, user_id, 0, welcome_message
FROM public_site_configs
WHERE welcome_message IS NOT NULL AND trim(welcome_message) != '';

-- public_site.welcome_message.list
INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt, follow_up_option_ids, child_item_option_ids, is_active, target_widget, requires_confirmation, skip_refinement, entity_type, handler_id)
VALUES (
  'public_site.welcome_message.list',
  'Manage Welcome Messages',
  'View and manage welcome messages shown to citizens on your public site.',
  'public_site',
  'MessageSquare',
  ARRAY['welcome messages', 'manage welcome', 'public site welcome'],
  ARRAY['worker', 'candidate', 'representative'],
  ARRAY['public_site_enabled'],
  false,
  52,
  false,
  '{}'::jsonb,
  'Here are your welcome messages.',
  ARRAY['public_site.welcome_message.view', 'public_site.welcome_message.add', 'public_site.configure'],
  ARRAY['public_site.welcome_message.edit', 'public_site.welcome_message.delete'],
  true,
  'data_list',
  false,
  true,
  'welcome_message',
  'sql'
) ON CONFLICT (id) DO UPDATE SET follow_up_option_ids = EXCLUDED.follow_up_option_ids, child_item_option_ids = EXCLUDED.child_item_option_ids;

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('public_site.welcome_message.list', 'list_welcome_messages',
'SELECT id, display_order, left(message_text, 100) as message_preview, banner_url, created_at FROM public_site_welcome_messages WHERE tenant_id = $1 AND user_id = $2 ORDER BY display_order ASC, created_at ASC',
'{"$1": "context.tenantId", "$2": "context.userId"}'::jsonb,
0, 'read');

-- public_site.welcome_message.add
INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt, follow_up_option_ids, is_active, target_widget, requires_confirmation, skip_refinement, entity_type, handler_id)
VALUES (
  'public_site.welcome_message.add',
  'Add Welcome Message',
  'Add a new welcome message for your public site. Optional banner image.',
  'public_site',
  'Plus',
  ARRAY['add welcome message', 'new welcome message'],
  ARRAY['worker', 'candidate', 'representative'],
  ARRAY['public_site_enabled'],
  false,
  100,
  false,
  '{"type":"object","properties":{"message_text":{"type":"string"},"banner_keys":{"type":"array"}}}'::jsonb,
  'Welcome message added.',
  ARRAY['public_site.welcome_message.list', 'public_site.configure'],
  true,
  'text_response',
  true,
  true,
  'welcome_message',
  'sql'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('public_site.welcome_message.add', 'Message text for citizens?', 'message_text', 0, true, 'markdown_editor', '{"minRows": 6, "placeholder": "Welcome! Here you can explore..."}'::jsonb, false),
('public_site.welcome_message.add', 'Banner image? (optional)', 'banner_keys', 1, false, 'file_upload', '{"accept": "image/*", "multiple": false, "uploadContext": "public_site"}'::jsonb, true);

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('public_site.welcome_message.add', 'insert_welcome_message',
'INSERT INTO public_site_welcome_messages (tenant_id, user_id, display_order, message_text, banner_url) SELECT $1, $2, COALESCE((SELECT max(display_order) + 1 FROM public_site_welcome_messages WHERE tenant_id = $1 AND user_id = $2), 0), $3, $4 RETURNING id, message_text, banner_url, display_order',
'{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.message_text", "$4": "params.banner_url"}'::jsonb,
0, 'write');

-- public_site.welcome_message.edit
INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt, follow_up_option_ids, is_active, target_widget, requires_confirmation, skip_refinement, entity_type, handler_id)
VALUES (
  'public_site.welcome_message.edit',
  'Edit Welcome Message',
  'Edit a welcome message.',
  'public_site',
  'Pencil',
  ARRAY['edit welcome message'],
  ARRAY['worker', 'candidate', 'representative'],
  ARRAY['public_site_enabled'],
  false,
  100,
  false,
  '{"type":"object","properties":{"welcome_message_id":{"type":"string"},"message_text":{"type":"string"},"banner_keys":{"type":"array"}},"required":["welcome_message_id"]}'::jsonb,
  'Welcome message updated.',
  ARRAY['public_site.welcome_message.list', 'public_site.configure'],
  true,
  'text_response',
  true,
  true,
  'welcome_message',
  'sql'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('public_site.welcome_message.edit', 'Which welcome message?', 'welcome_message_id', 0, true, NULL, '{"placeholder": "Select from list"}'::jsonb, true),
('public_site.welcome_message.edit', 'New message text? (leave blank to keep)', 'message_text', 1, false, 'markdown_editor', '{"minRows": 6}'::jsonb, false),
('public_site.welcome_message.edit', 'New banner image? (optional, leave blank to keep)', 'banner_keys', 2, false, 'file_upload', '{"accept": "image/*", "multiple": false, "uploadContext": "public_site"}'::jsonb, true);

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('public_site.welcome_message.edit', 'update_welcome_message',
'UPDATE public_site_welcome_messages SET message_text = COALESCE($3, message_text), banner_url = COALESCE($4, banner_url), updated_at = now() WHERE id = $1 AND tenant_id = $2 AND user_id = $2 RETURNING id, message_text, banner_url',
'{"$1": "params.welcome_message_id", "$2": "context.tenantId", "$3": "params.message_text", "$4": "params.banner_url"}'::jsonb,
0, 'write');

-- Fix edit: need user_id from context. The WHERE should be id = $1 AND tenant_id = $2 AND user_id = $3
UPDATE sql_templates SET
  sql = 'UPDATE public_site_welcome_messages SET message_text = COALESCE($4, message_text), banner_url = COALESCE($5, banner_url), updated_at = now() WHERE id = $1 AND tenant_id = $2 AND user_id = $3 RETURNING id, message_text, banner_url',
  param_mapping = '{"$1": "params.welcome_message_id", "$2": "context.tenantId", "$3": "context.userId", "$4": "params.message_text", "$5": "params.banner_url"}'::jsonb
WHERE option_id = 'public_site.welcome_message.edit' AND name = 'update_welcome_message';

-- public_site.welcome_message.delete
INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt, follow_up_option_ids, is_active, target_widget, requires_confirmation, skip_refinement, entity_type, handler_id)
VALUES (
  'public_site.welcome_message.delete',
  'Delete Welcome Message',
  'Remove a welcome message.',
  'public_site',
  'Trash2',
  ARRAY['delete welcome message'],
  ARRAY['worker', 'candidate', 'representative'],
  ARRAY['public_site_enabled'],
  false,
  100,
  false,
  '{"type":"object","properties":{"welcome_message_id":{"type":"string"}},"required":["welcome_message_id"]}'::jsonb,
  'Welcome message deleted.',
  ARRAY['public_site.welcome_message.list', 'public_site.configure'],
  true,
  'text_response',
  true,
  true,
  'welcome_message',
  'sql'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('public_site.welcome_message.delete', 'delete_welcome_message',
'DELETE FROM public_site_welcome_messages WHERE id = $1 AND tenant_id = $2 AND user_id = $3 RETURNING id',
'{"$1": "params.welcome_message_id", "$2": "context.tenantId", "$3": "context.userId"}'::jsonb,
0, 'write');

-- List needs view/edit/delete. For data_list we need viewOptionId and editOptionId. Welcome messages don't have a "view" - we could use edit as the click action. Let me add view that shows the message.
-- Actually for list items, the child_item_option_ids are edit and delete. The list needs columns and viewOptionId. For welcome_message we don't have a separate view - the edit serves as the main action. Let me add public_site.welcome_message.view that shows the message, and make list item click open view. Or we can use edit as the view - when user clicks they go to edit. Simpler: add view that just shows the message, then edit/delete as actions.
-- Actually looking at announcement list - it has view, edit, delete. So we need view. Let me add public_site.welcome_message.view.
INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt, follow_up_option_ids, child_item_option_ids, is_active, target_widget, requires_confirmation, skip_refinement, entity_type, handler_id)
VALUES (
  'public_site.welcome_message.view',
  'View Welcome Message',
  'View a welcome message.',
  'public_site',
  'Eye',
  ARRAY['view welcome message'],
  ARRAY['worker', 'candidate', 'representative'],
  ARRAY['public_site_enabled'],
  false,
  100,
  false,
  '{"type":"object","properties":{"welcome_message_id":{"type":"string"}},"required":["welcome_message_id"]}'::jsonb,
  'Here is the welcome message.',
  ARRAY['public_site.welcome_message.edit', 'public_site.welcome_message.delete', 'public_site.welcome_message.list'],
  ARRAY['public_site.welcome_message.edit', 'public_site.welcome_message.delete'],
  true,
  'text_response',
  false,
  true,
  'welcome_message',
  'sql'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('public_site.welcome_message.view', 'get_welcome_message',
'SELECT id, display_order, message_text, banner_url, created_at FROM public_site_welcome_messages WHERE id = $1 AND tenant_id = $2 AND user_id = $3',
'{"$1": "params.welcome_message_id", "$2": "context.tenantId", "$3": "context.userId"}'::jsonb,
0, 'read');

-- Update list to use view for item click
UPDATE option_definitions SET
  child_item_option_ids = ARRAY['public_site.welcome_message.view', 'public_site.welcome_message.edit', 'public_site.welcome_message.delete']
WHERE id = 'public_site.welcome_message.list';

-- Add "Manage welcome messages" to public_site.configure follow-ups
UPDATE option_definitions SET
  follow_up_option_ids = array_append(follow_up_option_ids, 'public_site.welcome_message.list')
WHERE id = 'public_site.configure' AND NOT ('public_site.welcome_message.list' = ANY(follow_up_option_ids));

-- Add new options to user_type_configs for worker, candidate, representative
UPDATE user_type_configs SET
  available_option_ids = array_cat(available_option_ids, ARRAY[
    'public_site.welcome_message.list', 'public_site.welcome_message.add', 'public_site.welcome_message.view',
    'public_site.welcome_message.edit', 'public_site.welcome_message.delete'
  ])
WHERE user_type IN ('worker', 'candidate', 'representative')
  AND NOT ('public_site.welcome_message.list' = ANY(available_option_ids));


UPDATE user_type_configs SET
  default_option_ids = array_append(default_option_ids, 'profile.set_avatar')
WHERE user_type IN ('worker', 'candidate', 'representative') AND NOT ('profile.set_avatar' = ANY(default_option_ids));

UPDATE user_type_configs SET
  default_option_ids = array_append(default_option_ids, 'public_site.welcome_message.add')
WHERE user_type IN ('worker', 'candidate', 'representative') AND NOT ('public_site.welcome_message.add' = ANY(default_option_ids)) ;

UPDATE user_type_configs SET
  default_option_ids = array_append(default_option_ids, 'public_site.welcome_message.list')
WHERE user_type IN ('worker', 'candidate', 'representative') AND NOT ('public_site.welcome_message.list' = ANY(default_option_ids)); 


-- List summary template
UPDATE option_definitions SET list_summary_template = 'Here are your welcome messages.' WHERE id = 'public_site.welcome_message.list';

