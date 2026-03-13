-- Add child_item_option_ids: options that operate on each displayed item (per-item action icons).
-- Separate from follow_up_option_ids (list-level buttons). Empty = no child actions.
ALTER TABLE option_definitions
  ADD COLUMN child_item_option_ids text[] DEFAULT '{}';

-- Set child_item_option_ids for options that produce activity lists or activity cards
UPDATE option_definitions SET child_item_option_ids = ARRAY['activity.view', 'activity.edit', 'activity.add_note', 'activity.add_media']
WHERE id IN ('activity.list', 'analysis.activities');

-- activity.view, activity.create, activity.edit produce single activity_card; child actions on the card
UPDATE option_definitions SET child_item_option_ids = ARRAY['activity.add_note', 'activity.add_media']
WHERE id IN ('activity.view', 'activity.create', 'activity.edit','analysis.specific_activity');
