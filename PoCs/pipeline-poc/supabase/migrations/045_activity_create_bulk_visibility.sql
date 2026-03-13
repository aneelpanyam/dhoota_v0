-- ============================================
-- 045: Make activity.create_bulk visible
-- Add to "What would you like to do?" menu and as follow-up on activity list
-- ============================================

-- Add as follow-up when viewing activity list (alongside "Add Activity")
UPDATE option_definitions
SET follow_up_option_ids = array_append(follow_up_option_ids, 'activity.create_bulk')
WHERE id = 'activity.list'
  AND NOT ('activity.create_bulk' = ANY(follow_up_option_ids));

-- Same for analysis.activities (activity list from analysis)
UPDATE option_definitions
SET follow_up_option_ids = array_append(follow_up_option_ids, 'activity.create_bulk')
WHERE id = 'analysis.activities'
  AND NOT ('activity.create_bulk' = ANY(follow_up_option_ids));

-- Add to "What would you like to do?" default menu for worker, candidate, representative
UPDATE user_type_configs
SET default_option_ids = array_append(default_option_ids, 'activity.create_bulk')
WHERE user_type IN ('worker', 'candidate', 'representative')
  AND NOT ('activity.create_bulk' = ANY(default_option_ids));
