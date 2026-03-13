-- ============================================
-- 036: Fix Edit Option Questions
-- Many edit options were missing their Q&A
-- questions, relying only on LLM refinement
-- to collect params. This adds proper guided
-- questions for all edit operations so users
-- get structured input widgets.
-- ============================================

-- ============================================
-- activity.edit — currently has only 1 free-form
-- question. Replace with structured per-field
-- questions matching what the SQL template accepts.
-- ============================================

DELETE FROM option_questions WHERE option_id = 'activity.edit';

INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('activity.edit', 'New title? (leave blank to keep current)', 'title', 0, false, NULL, '{"placeholder": "Activity title"}'::jsonb, true),
('activity.edit', 'New description?', 'description', 1, false, NULL, '{"placeholder": "Describe the activity"}'::jsonb, false),
('activity.edit', 'Change the date?', 'activity_date', 2, false, 'date_picker', '{"placeholder": "Activity date"}'::jsonb, true),
('activity.edit', 'Change the location?', 'location', 3, false, NULL, '{"placeholder": "Location"}'::jsonb, true),
('activity.edit', 'Update status?', 'status', 4, false, 'select', '{"options": ["planned", "in_progress", "completed", "cancelled"], "placeholder": "Keep current"}'::jsonb, true),
('activity.edit', 'Change visibility?', 'visibility', 5, false, 'visibility_select', '{"options": ["private", "team", "public"], "placeholder": "Keep current"}'::jsonb, true);

-- ============================================
-- announcement.edit — had NO questions
-- ============================================

INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('announcement.edit', 'New title? (leave blank to keep current)', 'title', 0, false, NULL, '{"placeholder": "Announcement title"}'::jsonb, true),
('announcement.edit', 'New content?', 'content', 1, false, NULL, '{"placeholder": "Announcement content"}'::jsonb, false),
('announcement.edit', 'Change visibility?', 'visibility', 2, false, 'select', '{"options": ["private", "public"], "placeholder": "Keep current"}'::jsonb, true),
('announcement.edit', 'Pin or unpin?', 'pinned', 3, false, 'select', '{"options": ["true", "false"], "placeholder": "Keep current"}'::jsonb, true);

-- ============================================
-- info_card.edit — had NO questions
-- ============================================

INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('info_card.edit', 'New title? (leave blank to keep current)', 'title', 0, false, NULL, '{"placeholder": "Card title"}'::jsonb, true),
('info_card.edit', 'New content?', 'content_raw', 1, false, NULL, '{"placeholder": "Describe the card content"}'::jsonb, false),
('info_card.edit', 'Change card type?', 'card_type', 2, false, 'select', '{"options": ["about", "contact", "service", "custom"], "placeholder": "Keep current"}'::jsonb, true),
('info_card.edit', 'Change visibility?', 'visibility', 3, false, 'select', '{"options": ["private", "public"], "placeholder": "Keep current"}'::jsonb, true);

-- ============================================
-- suggestion_box.edit — had NO questions
-- ============================================

INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('suggestion_box.edit', 'New title? (leave blank to keep current)', 'title', 0, false, NULL, '{"placeholder": "Suggestion box title"}'::jsonb, true),
('suggestion_box.edit', 'New description?', 'description', 1, false, NULL, '{"placeholder": "Description"}'::jsonb, false),
('suggestion_box.edit', 'Activate or deactivate?', 'is_active', 2, false, 'select', '{"options": ["true", "false"], "placeholder": "Keep current"}'::jsonb, true);

-- ============================================
-- citizen.group.edit — had NO questions
-- ============================================

INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('citizen.group.edit', 'New group name? (leave blank to keep current)', 'name', 0, false, NULL, '{"placeholder": "Group name"}'::jsonb, true),
('citizen.group.edit', 'New description?', 'description', 1, false, NULL, '{"placeholder": "Group description"}'::jsonb, false);

-- ============================================
-- profile.edit — had NO questions
-- ============================================

INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('profile.edit', 'What would you like your display name to be?', 'display_name', 0, false, NULL, '{"placeholder": "Your display name"}'::jsonb, false);
