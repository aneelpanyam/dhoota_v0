-- ============================================
-- 084: Add public.recent_activities to public_site_configs enabled_option_ids
-- When enabled_option_ids is set, only those options are available. Migration 083
-- added public.recent_activities for init, but it was missing from enabled_option_ids.
-- ============================================

-- Add public.recent_activities to enabled_option_ids where public.activities exists
-- (keeps both: recent for init, activities for view-all)
UPDATE public_site_configs
SET enabled_option_ids = array_prepend(
  'public.recent_activities',
  array_remove(enabled_option_ids, 'public.recent_activities')
)
WHERE 'public.activities' = ANY(enabled_option_ids)
  AND NOT ('public.recent_activities' = ANY(enabled_option_ids));
