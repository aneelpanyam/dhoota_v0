-- ============================================
-- 090: Add foreground (fg) preset questions for all 5 elements + chat message text
-- ============================================

-- Shared options for fg presets (same as header/nav: default, light, dark, saffron, navy, teal)
-- Using same widget_config for all fg questions
-- public_site.configure: Add 6 fg preset questions
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable)
VALUES
  ('public_site.configure', 'Header bar text color?', 'theme_header_fg_preset', 8, false, 'select', '{"options":[{"value":"default","label":"Default"},{"value":"light","label":"Light"},{"value":"light_gray","label":"Light gray"},{"value":"muted","label":"Muted"},{"value":"dark","label":"Dark"},{"value":"saffron","label":"Saffron"},{"value":"navy","label":"Navy"},{"value":"teal","label":"Teal"}],"default":"default"}'::jsonb, true),
  ('public_site.configure', 'Bottom nav bar text color?', 'theme_bottom_nav_fg_preset', 9, false, 'select', '{"options":[{"value":"default","label":"Default"},{"value":"light","label":"Light"},{"value":"light_gray","label":"Light gray"},{"value":"muted","label":"Muted"},{"value":"dark","label":"Dark"},{"value":"saffron","label":"Saffron"},{"value":"navy","label":"Navy"},{"value":"teal","label":"Teal"}],"default":"default"}'::jsonb, true),
  ('public_site.configure', 'About me card text color?', 'theme_about_me_fg_preset', 10, false, 'select', '{"options":[{"value":"default","label":"Default"},{"value":"light","label":"Light"},{"value":"dark","label":"Dark"},{"value":"saffron","label":"Saffron"},{"value":"navy","label":"Navy"},{"value":"teal","label":"Teal"}],"default":"default"}'::jsonb, true),
  ('public_site.configure', 'Info cards text color?', 'theme_info_card_fg_preset', 11, false, 'select', '{"options":[{"value":"default","label":"Default"},{"value":"light","label":"Light"},{"value":"dark","label":"Dark"},{"value":"saffron","label":"Saffron"},{"value":"navy","label":"Navy"},{"value":"teal","label":"Teal"}],"default":"default"}'::jsonb, true),
  ('public_site.configure', 'Welcome message card text color?', 'theme_welcome_message_fg_preset', 12, false, 'select', '{"options":[{"value":"default","label":"Default"},{"value":"light","label":"Light"},{"value":"dark","label":"Dark"},{"value":"saffron","label":"Saffron"},{"value":"navy","label":"Navy"},{"value":"teal","label":"Teal"}],"default":"default"}'::jsonb, true),
  ('public_site.configure', 'Chat message text color?', 'theme_chat_message_fg_preset', 13, false, 'select', '{"options":[{"value":"default","label":"Default"},{"value":"light","label":"Light"},{"value":"dark","label":"Dark"},{"value":"saffron","label":"Saffron"},{"value":"navy","label":"Navy"},{"value":"teal","label":"Teal"}],"default":"default"}'::jsonb, true);

-- admin.public_site.configure: Add same 6 fg preset questions (order 9-14)
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable)
VALUES
  ('admin.public_site.configure', 'Header bar text color?', 'theme_header_fg_preset', 9, false, 'select', '{"options":[{"value":"default","label":"Default"},{"value":"light","label":"Light"},{"value":"light_gray","label":"Light gray"},{"value":"muted","label":"Muted"},{"value":"dark","label":"Dark"},{"value":"saffron","label":"Saffron"},{"value":"navy","label":"Navy"},{"value":"teal","label":"Teal"}],"default":"default"}'::jsonb, true),
  ('admin.public_site.configure', 'Bottom nav bar text color?', 'theme_bottom_nav_fg_preset', 10, false, 'select', '{"options":[{"value":"default","label":"Default"},{"value":"light","label":"Light"},{"value":"light_gray","label":"Light gray"},{"value":"muted","label":"Muted"},{"value":"dark","label":"Dark"},{"value":"saffron","label":"Saffron"},{"value":"navy","label":"Navy"},{"value":"teal","label":"Teal"}],"default":"default"}'::jsonb, true),
  ('admin.public_site.configure', 'About me card text color?', 'theme_about_me_fg_preset', 11, false, 'select', '{"options":[{"value":"default","label":"Default"},{"value":"light","label":"Light"},{"value":"dark","label":"Dark"},{"value":"saffron","label":"Saffron"},{"value":"navy","label":"Navy"},{"value":"teal","label":"Teal"}],"default":"default"}'::jsonb, true),
  ('admin.public_site.configure', 'Info cards text color?', 'theme_info_card_fg_preset', 12, false, 'select', '{"options":[{"value":"default","label":"Default"},{"value":"light","label":"Light"},{"value":"dark","label":"Dark"},{"value":"saffron","label":"Saffron"},{"value":"navy","label":"Navy"},{"value":"teal","label":"Teal"}],"default":"default"}'::jsonb, true),
  ('admin.public_site.configure', 'Welcome message card text color?', 'theme_welcome_message_fg_preset', 13, false, 'select', '{"options":[{"value":"default","label":"Default"},{"value":"light","label":"Light"},{"value":"dark","label":"Dark"},{"value":"saffron","label":"Saffron"},{"value":"navy","label":"Navy"},{"value":"teal","label":"Teal"}],"default":"default"}'::jsonb, true),
  ('admin.public_site.configure', 'Chat message text color?', 'theme_chat_message_fg_preset', 14, false, 'select', '{"options":[{"value":"default","label":"Default"},{"value":"light","label":"Light"},{"value":"dark","label":"Dark"},{"value":"saffron","label":"Saffron"},{"value":"navy","label":"Navy"},{"value":"teal","label":"Teal"}],"default":"default"}'::jsonb, true);

-- Update input_schema for both options to include fg preset keys
UPDATE option_definitions
SET input_schema = jsonb_set(
  input_schema,
  '{properties}',
  (input_schema -> 'properties') || '{"theme_header_fg_preset":{"type":"string"},"theme_bottom_nav_fg_preset":{"type":"string"},"theme_about_me_fg_preset":{"type":"string"},"theme_info_card_fg_preset":{"type":"string"},"theme_welcome_message_fg_preset":{"type":"string"},"theme_chat_message_fg_preset":{"type":"string"}}'::jsonb
)
WHERE id IN ('public_site.configure', 'admin.public_site.configure');
