-- ============================================
-- 088: Add theme preset for welcome messages
-- ============================================

-- public_site.configure: Add welcome message preset question
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable)
VALUES
  ('public_site.configure', 'Welcome message card style?', 'theme_welcome_message_preset', 7, false, 'select', '{"options":[{"value":"default","label":"Default"},{"value":"minimal","label":"Minimal"},{"value":"subtle","label":"Subtle"}],"default":"default"}'::jsonb, true);

-- admin.public_site.configure: Add welcome message preset question
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable)
VALUES
  ('admin.public_site.configure', 'Welcome message card style?', 'theme_welcome_message_preset', 8, false, 'select', '{"options":[{"value":"default","label":"Default"},{"value":"minimal","label":"Minimal"},{"value":"subtle","label":"Subtle"}],"default":"default"}'::jsonb, true);

-- Update input_schema for both options
UPDATE option_definitions
SET input_schema = '{"type":"object","properties":{"welcome_message":{"type":"string"},"side_panel_content":{"type":"object"},"theme_overrides":{"type":"object"},"enabled_option_ids":{"type":"array","items":{"type":"string"}},"site_title":{"type":"string"},"theme_header_preset":{"type":"string"},"theme_bottom_nav_preset":{"type":"string"},"theme_about_me_preset":{"type":"string"},"theme_info_card_preset":{"type":"string"},"theme_welcome_message_preset":{"type":"string"}}}'::jsonb
WHERE id = 'public_site.configure';

UPDATE option_definitions
SET input_schema = '{"type":"object","properties":{"tenant_id":{"type":"string"},"user_id":{"type":"string"},"welcome_message":{"type":"string"},"site_title":{"type":"string"},"theme_header_preset":{"type":"string"},"theme_bottom_nav_preset":{"type":"string"},"theme_about_me_preset":{"type":"string"},"theme_info_card_preset":{"type":"string"},"theme_welcome_message_preset":{"type":"string"}}}'::jsonb
WHERE id = 'admin.public_site.configure';
