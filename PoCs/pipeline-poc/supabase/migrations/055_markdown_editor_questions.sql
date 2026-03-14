-- ============================================
-- 055: Use markdown_editor for content questions
-- Welcome message, announcement content, info card content
-- ============================================

UPDATE option_questions
SET inline_widget = 'markdown_editor',
    widget_config = COALESCE(widget_config, '{}'::jsonb) || '{"minRows": 6, "placeholder": "Enter content (markdown supported)..."}'::jsonb
WHERE (option_id, question_key) IN (
  ('public_site.configure', 'welcome_message'),
  ('announcement.create', 'content'),
  ('announcement.edit', 'content'),
  ('info_card.create', 'content_raw'),
  ('info_card.edit', 'content_raw')
);
