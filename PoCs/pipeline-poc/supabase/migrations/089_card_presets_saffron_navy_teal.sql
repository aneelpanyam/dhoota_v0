-- ============================================
-- 089: Add saffron, navy, teal to card preset options (about me, info cards, welcome message)
-- ============================================

-- public_site.configure: Update card preset options
UPDATE option_questions
SET widget_config = '{"options":[{"value":"default","label":"Default"},{"value":"minimal","label":"Minimal"},{"value":"subtle","label":"Subtle"},{"value":"saffron","label":"Saffron"},{"value":"navy","label":"Navy"},{"value":"teal","label":"Teal"}],"default":"default"}'::jsonb
WHERE option_id = 'public_site.configure' AND question_key = 'theme_about_me_preset';

UPDATE option_questions
SET widget_config = '{"options":[{"value":"default","label":"Default"},{"value":"minimal","label":"Minimal"},{"value":"subtle","label":"Subtle"},{"value":"saffron","label":"Saffron"},{"value":"navy","label":"Navy"},{"value":"teal","label":"Teal"}],"default":"default"}'::jsonb
WHERE option_id = 'public_site.configure' AND question_key = 'theme_info_card_preset';

UPDATE option_questions
SET widget_config = '{"options":[{"value":"default","label":"Default"},{"value":"minimal","label":"Minimal"},{"value":"subtle","label":"Subtle"},{"value":"saffron","label":"Saffron"},{"value":"navy","label":"Navy"},{"value":"teal","label":"Teal"}],"default":"default"}'::jsonb
WHERE option_id = 'public_site.configure' AND question_key = 'theme_welcome_message_preset';

-- admin.public_site.configure: Update card preset options
UPDATE option_questions
SET widget_config = '{"options":[{"value":"default","label":"Default"},{"value":"minimal","label":"Minimal"},{"value":"subtle","label":"Subtle"},{"value":"saffron","label":"Saffron"},{"value":"navy","label":"Navy"},{"value":"teal","label":"Teal"}],"default":"default"}'::jsonb
WHERE option_id = 'admin.public_site.configure' AND question_key = 'theme_about_me_preset';

UPDATE option_questions
SET widget_config = '{"options":[{"value":"default","label":"Default"},{"value":"minimal","label":"Minimal"},{"value":"subtle","label":"Subtle"},{"value":"saffron","label":"Saffron"},{"value":"navy","label":"Navy"},{"value":"teal","label":"Teal"}],"default":"default"}'::jsonb
WHERE option_id = 'admin.public_site.configure' AND question_key = 'theme_info_card_preset';

UPDATE option_questions
SET widget_config = '{"options":[{"value":"default","label":"Default"},{"value":"minimal","label":"Minimal"},{"value":"subtle","label":"Subtle"},{"value":"saffron","label":"Saffron"},{"value":"navy","label":"Navy"},{"value":"teal","label":"Teal"}],"default":"default"}'::jsonb
WHERE option_id = 'admin.public_site.configure' AND question_key = 'theme_welcome_message_preset';
