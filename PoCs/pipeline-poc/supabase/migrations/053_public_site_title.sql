-- ============================================
-- 053: Add site_title to public_site_configs
-- Configurable public website title per tenant
-- ============================================

ALTER TABLE public_site_configs
ADD COLUMN IF NOT EXISTS site_title text;

-- Update public_site.configure SQL template to include site_title
UPDATE sql_templates
SET
  sql = 'INSERT INTO public_site_configs (tenant_id, user_id, welcome_message, side_panel_content, theme_overrides, enabled_option_ids, site_title) VALUES ($1, $2, COALESCE($3, ''Welcome!''), COALESCE($4::jsonb, ''{}''::jsonb), COALESCE($5::jsonb, ''{}''::jsonb), COALESCE($6::text[], ARRAY[''public.activities'', ''public.stats'', ''public.announcements'', ''public.info_cards'', ''public.about'']), $7) ON CONFLICT (tenant_id, user_id) DO UPDATE SET welcome_message = COALESCE($3, public_site_configs.welcome_message), side_panel_content = COALESCE($4::jsonb, public_site_configs.side_panel_content), theme_overrides = COALESCE($5::jsonb, public_site_configs.theme_overrides), enabled_option_ids = COALESCE($6::text[], public_site_configs.enabled_option_ids), site_title = COALESCE($7, public_site_configs.site_title), updated_at = now() RETURNING *',
  param_mapping = '{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.welcome_message", "$4": "params.side_panel_content", "$5": "params.theme_overrides", "$6": "params.enabled_option_ids", "$7": "params.site_title"}'::jsonb
WHERE option_id = 'public_site.configure' AND name = 'upsert_public_site_config';

-- Add site_title question to public_site.configure (before enabled_option_ids)
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable)
SELECT 'public_site.configure', 'What should the public site title be?', 'site_title', 0, false, NULL, '{"placeholder": "e.g. My Campaign"}'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM option_questions WHERE option_id = 'public_site.configure' AND question_key = 'site_title');

-- Shift existing question orders
UPDATE option_questions SET question_order = 1 WHERE option_id = 'public_site.configure' AND question_key = 'welcome_message';
UPDATE option_questions SET question_order = 2 WHERE option_id = 'public_site.configure' AND question_key = 'enabled_option_ids';

-- Update input_schema to include site_title
UPDATE option_definitions
SET input_schema = '{"type":"object","properties":{"welcome_message":{"type":"string"},"side_panel_content":{"type":"object"},"theme_overrides":{"type":"object"},"enabled_option_ids":{"type":"array","items":{"type":"string"}},"site_title":{"type":"string"}}}'::jsonb
WHERE id = 'public_site.configure';
