-- ============================================
-- 086: Public site theme presets (header, bottom nav, about me, info cards)
-- Curated presets ensure colors never clash with icons/chat
-- ============================================

-- public_site.configure: Add 4 optional theme preset questions
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable)
VALUES
  ('public_site.configure', 'Header bar style?', 'theme_header_preset', 3, false, 'select', '{"options":[{"value":"default","label":"Default"},{"value":"light","label":"Light"},{"value":"light_gray","label":"Light gray"},{"value":"muted","label":"Muted"},{"value":"dark","label":"Dark"}],"default":"default"}'::jsonb, true),
  ('public_site.configure', 'Bottom nav bar style?', 'theme_bottom_nav_preset', 4, false, 'select', '{"options":[{"value":"default","label":"Default"},{"value":"light","label":"Light"},{"value":"light_gray","label":"Light gray"},{"value":"muted","label":"Muted"},{"value":"dark","label":"Dark"}],"default":"default"}'::jsonb, true),
  ('public_site.configure', 'About me card style?', 'theme_about_me_preset', 5, false, 'select', '{"options":[{"value":"default","label":"Default"},{"value":"minimal","label":"Minimal"},{"value":"subtle","label":"Subtle"}],"default":"default"}'::jsonb, true),
  ('public_site.configure', 'Info cards style?', 'theme_info_card_preset', 6, false, 'select', '{"options":[{"value":"default","label":"Default"},{"value":"minimal","label":"Minimal"},{"value":"subtle","label":"Subtle"}],"default":"default"}'::jsonb, true);

-- admin.public_site.configure: Add same 4 theme preset questions (after site_title which is order 3)
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable)
VALUES
  ('admin.public_site.configure', 'Header bar style?', 'theme_header_preset', 4, false, 'select', '{"options":[{"value":"default","label":"Default"},{"value":"light","label":"Light"},{"value":"light_gray","label":"Light gray"},{"value":"muted","label":"Muted"},{"value":"dark","label":"Dark"}],"default":"default"}'::jsonb, true),
  ('admin.public_site.configure', 'Bottom nav bar style?', 'theme_bottom_nav_preset', 5, false, 'select', '{"options":[{"value":"default","label":"Default"},{"value":"light","label":"Light"},{"value":"light_gray","label":"Light gray"},{"value":"muted","label":"Muted"},{"value":"dark","label":"Dark"}],"default":"default"}'::jsonb, true),
  ('admin.public_site.configure', 'About me card style?', 'theme_about_me_preset', 6, false, 'select', '{"options":[{"value":"default","label":"Default"},{"value":"minimal","label":"Minimal"},{"value":"subtle","label":"Subtle"}],"default":"default"}'::jsonb, true),
  ('admin.public_site.configure', 'Info cards style?', 'theme_info_card_preset', 7, false, 'select', '{"options":[{"value":"default","label":"Default"},{"value":"minimal","label":"Minimal"},{"value":"subtle","label":"Subtle"}],"default":"default"}'::jsonb, true);

-- Update input_schema for both options to include theme preset keys
UPDATE option_definitions
SET input_schema = '{"type":"object","properties":{"welcome_message":{"type":"string"},"side_panel_content":{"type":"object"},"theme_overrides":{"type":"object"},"enabled_option_ids":{"type":"array","items":{"type":"string"}},"site_title":{"type":"string"},"theme_header_preset":{"type":"string"},"theme_bottom_nav_preset":{"type":"string"},"theme_about_me_preset":{"type":"string"},"theme_info_card_preset":{"type":"string"}}}'::jsonb
WHERE id = 'public_site.configure';

UPDATE option_definitions
SET input_schema = '{"type":"object","properties":{"tenant_id":{"type":"string"},"user_id":{"type":"string"},"welcome_message":{"type":"string"},"site_title":{"type":"string"},"theme_header_preset":{"type":"string"},"theme_bottom_nav_preset":{"type":"string"},"theme_about_me_preset":{"type":"string"},"theme_info_card_preset":{"type":"string"}}}'::jsonb
WHERE id = 'admin.public_site.configure';
