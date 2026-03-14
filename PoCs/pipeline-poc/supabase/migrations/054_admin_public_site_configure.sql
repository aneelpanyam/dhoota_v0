-- ============================================
-- 054: Admin option to manage public site config (welcome message, site title)
-- Admin can configure for any tenant
-- ============================================

INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt, refinement_prompt, follow_up_option_ids, child_item_option_ids, is_active, metadata, tenant_id, target_widget, requires_confirmation, skip_refinement, entity_type)
VALUES (
  'admin.public_site.configure',
  'Configure Public Site',
  'Set welcome message and site title for a tenant''s public site. Admin can configure for any tenant.',
  'admin',
  'Globe',
  ARRAY['configure public site', 'welcome message', 'site title', 'public site admin'],
  ARRAY['system_admin'],
  ARRAY[]::text[],
  false,
  52,
  false,
  '{"type":"object","properties":{"tenant_id":{"type":"string"},"user_id":{"type":"string"},"welcome_message":{"type":"string"},"site_title":{"type":"string"}}}'::jsonb,
  'Public site configuration updated.',
  NULL,
  ARRAY['admin.tenant.view', 'admin.tenant.list'],
  ARRAY[]::text[],
  true,
  '{}'::jsonb,
  NULL,
  'text_response',
  true,
  true,
  'public_site'
) ON CONFLICT (id) DO NOTHING;

-- SQL: upsert public_site_configs for the selected tenant+user
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type)
VALUES (
  'admin.public_site.configure',
  'upsert_public_site_config',
  'INSERT INTO public_site_configs (tenant_id, user_id, welcome_message, side_panel_content, theme_overrides, enabled_option_ids, site_title) VALUES ($1, $2, COALESCE($3, ''Welcome!''), COALESCE($4::jsonb, ''{}''), COALESCE($5::jsonb, ''{}''), COALESCE($6::text[], ARRAY[''public.activities'',''public.stats'',''public.announcements'',''public.info_cards'',''public.about'']), $7) ON CONFLICT (tenant_id, user_id) DO UPDATE SET welcome_message = COALESCE($3, public_site_configs.welcome_message), side_panel_content = COALESCE($4::jsonb, public_site_configs.side_panel_content), theme_overrides = COALESCE($5::jsonb, public_site_configs.theme_overrides), enabled_option_ids = COALESCE($6::text[], public_site_configs.enabled_option_ids), site_title = COALESCE($7, public_site_configs.site_title), updated_at = now() RETURNING *',
  '{"$1": "params.tenant_id", "$2": "params.user_id", "$3": "params.welcome_message", "$4": "params.side_panel_content", "$5": "params.theme_overrides", "$6": "params.enabled_option_ids", "$7": "params.site_title"}'::jsonb,
  0,
  'write'
);

-- Option questions
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable)
VALUES
  ('admin.public_site.configure', 'Which tenant?', 'tenant_id', 0, true, 'select', '{"source":"tenants"}'::jsonb, true),
  ('admin.public_site.configure', 'Which user (representative) owns this public site?', 'user_id', 1, true, 'select', '{"source":"tenant_users"}'::jsonb, true),
  ('admin.public_site.configure', 'Welcome message for citizens?', 'welcome_message', 2, false, NULL, '{"placeholder":"Welcome! Here you can explore..."}'::jsonb, false),
  ('admin.public_site.configure', 'Public site title?', 'site_title', 3, false, NULL, '{"placeholder":"e.g. My Campaign"}'::jsonb, true);

-- Add to system_admin available options
UPDATE user_type_configs
SET available_option_ids = array_append(available_option_ids, 'admin.public_site.configure')
WHERE user_type = 'system_admin' AND NOT ('admin.public_site.configure' = ANY(available_option_ids));
