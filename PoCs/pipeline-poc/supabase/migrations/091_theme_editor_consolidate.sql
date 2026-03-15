-- ============================================
-- 091: Consolidate 11 theme questions into 1 theme_editor question
-- ============================================

-- Delete individual theme questions from public_site.configure
DELETE FROM option_questions
WHERE option_id = 'public_site.configure'
  AND question_key IN (
    'theme_header_preset',
    'theme_bottom_nav_preset',
    'theme_about_me_preset',
    'theme_info_card_preset',
    'theme_welcome_message_preset',
    'theme_header_fg_preset',
    'theme_bottom_nav_fg_preset',
    'theme_about_me_fg_preset',
    'theme_info_card_fg_preset',
    'theme_welcome_message_fg_preset',
    'theme_chat_message_fg_preset'
  );

-- Delete individual theme questions from admin.public_site.configure
DELETE FROM option_questions
WHERE option_id = 'admin.public_site.configure'
  AND question_key IN (
    'theme_header_preset',
    'theme_bottom_nav_preset',
    'theme_about_me_preset',
    'theme_info_card_preset',
    'theme_welcome_message_preset',
    'theme_header_fg_preset',
    'theme_bottom_nav_fg_preset',
    'theme_about_me_fg_preset',
    'theme_info_card_fg_preset',
    'theme_welcome_message_fg_preset',
    'theme_chat_message_fg_preset'
  );

-- Add single theme_editor question for public_site.configure (order 3, after welcome_message and enabled_option_ids)
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable)
VALUES
  ('public_site.configure', 'Customize your public site theme', 'theme_settings', 3, false, 'theme_editor', '{}'::jsonb, true);

-- Add single theme_editor question for admin.public_site.configure (order 4, after site_title)
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable)
VALUES
  ('admin.public_site.configure', 'Customize public site theme', 'theme_settings', 4, false, 'theme_editor', '{}'::jsonb, true);

-- Update input_schema to include theme_settings (object) - pipeline expands it into individual params
UPDATE option_definitions
SET input_schema = jsonb_set(
  input_schema,
  '{properties}',
  (input_schema -> 'properties') || '{"theme_settings":{"type":"object"}}'::jsonb
)
WHERE id IN ('public_site.configure', 'admin.public_site.configure');
