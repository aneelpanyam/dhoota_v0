-- 069: Fix welcome message edit - add dynamic source for welcome_message_id, ensure questions work
-- Update "Which welcome message?" to use select with source for dropdown when not coming from list
UPDATE option_questions SET
  inline_widget = 'select',
  widget_config = '{"source": "welcome_messages", "placeholder": "Select from list"}'::jsonb
WHERE option_id = 'public_site.welcome_message.edit' AND question_key = 'welcome_message_id';
