-- ============================================
-- 081: Move tags to second step in activity.create
-- Tags become question_order 1 (right after "What did you do?")
-- ============================================

-- Shift questions to make room: update in reverse order to avoid conflicts
UPDATE option_questions SET question_order = 6 WHERE option_id = 'activity.create' AND question_key = 'participants';
UPDATE option_questions SET question_order = 5 WHERE option_id = 'activity.create' AND question_key = 'visibility';
UPDATE option_questions SET question_order = 4 WHERE option_id = 'activity.create' AND question_key = 'media_keys';
UPDATE option_questions SET question_order = 3 WHERE option_id = 'activity.create' AND question_key = 'location';
UPDATE option_questions SET question_order = 2 WHERE option_id = 'activity.create' AND question_key = 'activity_date';
UPDATE option_questions SET question_order = 1 WHERE option_id = 'activity.create' AND question_key = 'tags';
