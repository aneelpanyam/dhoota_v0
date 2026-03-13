-- ============================================
-- 044: Activity list follow-ups — list-level only
-- activity.view, activity.edit, activity.add_note, activity.add_media require
-- an activity_id and are already shown as per-item action icons (child_item_option_ids).
-- Remove them from follow_up_option_ids so they don't appear as confusing
-- list-level buttons below the list (which have no activity context).
-- ============================================

UPDATE option_definitions
SET follow_up_option_ids = (
  SELECT array_agg(x ORDER BY ord)
  FROM unnest(follow_up_option_ids) WITH ORDINALITY AS t(x, ord)
  WHERE x NOT IN ('activity.view', 'activity.edit', 'activity.add_note', 'activity.add_media')
)
WHERE id = 'activity.list'
  AND follow_up_option_ids && ARRAY['activity.view', 'activity.edit', 'activity.add_note', 'activity.add_media'];

-- Same for analysis.activities (produces activity list with same per-item actions)
UPDATE option_definitions
SET follow_up_option_ids = (
  SELECT array_agg(x ORDER BY ord)
  FROM unnest(follow_up_option_ids) WITH ORDINALITY AS t(x, ord)
  WHERE x NOT IN ('activity.view', 'activity.edit', 'activity.add_note', 'activity.add_media')
)
WHERE id = 'analysis.activities'
  AND follow_up_option_ids && ARRAY['activity.view', 'activity.edit', 'activity.add_note', 'activity.add_media'];
