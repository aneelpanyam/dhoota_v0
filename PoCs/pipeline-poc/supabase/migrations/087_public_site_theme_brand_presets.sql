-- ============================================
-- 087: Add brand color presets (saffron, navy, teal) to header/nav theme options
-- ============================================

-- public_site.configure: Update header and bottom nav preset options
UPDATE option_questions
SET widget_config = '{"options":[{"value":"default","label":"Default"},{"value":"light","label":"Light"},{"value":"light_gray","label":"Light gray"},{"value":"muted","label":"Muted"},{"value":"dark","label":"Dark"},{"value":"saffron","label":"Saffron"},{"value":"navy","label":"Navy"},{"value":"teal","label":"Teal"}],"default":"default"}'::jsonb
WHERE option_id = 'public_site.configure' AND question_key = 'theme_header_preset';

UPDATE option_questions
SET widget_config = '{"options":[{"value":"default","label":"Default"},{"value":"light","label":"Light"},{"value":"light_gray","label":"Light gray"},{"value":"muted","label":"Muted"},{"value":"dark","label":"Dark"},{"value":"saffron","label":"Saffron"},{"value":"navy","label":"Navy"},{"value":"teal","label":"Teal"}],"default":"default"}'::jsonb
WHERE option_id = 'public_site.configure' AND question_key = 'theme_bottom_nav_preset';

-- admin.public_site.configure: Update header and bottom nav preset options
UPDATE option_questions
SET widget_config = '{"options":[{"value":"default","label":"Default"},{"value":"light","label":"Light"},{"value":"light_gray","label":"Light gray"},{"value":"muted","label":"Muted"},{"value":"dark","label":"Dark"},{"value":"saffron","label":"Saffron"},{"value":"navy","label":"Navy"},{"value":"teal","label":"Teal"}],"default":"default"}'::jsonb
WHERE option_id = 'admin.public_site.configure' AND question_key = 'theme_header_preset';

UPDATE option_questions
SET widget_config = '{"options":[{"value":"default","label":"Default"},{"value":"light","label":"Light"},{"value":"light_gray","label":"Light gray"},{"value":"muted","label":"Muted"},{"value":"dark","label":"Dark"},{"value":"saffron","label":"Saffron"},{"value":"navy","label":"Navy"},{"value":"teal","label":"Teal"}],"default":"default"}'::jsonb
WHERE option_id = 'admin.public_site.configure' AND question_key = 'theme_bottom_nav_preset';
