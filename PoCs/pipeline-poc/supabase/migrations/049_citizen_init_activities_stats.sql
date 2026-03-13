-- ============================================
-- 049: Citizen init options - activities + stats
-- Show public.activities and public.stats on load
-- instead of announcements + activities.
-- ============================================

UPDATE user_type_configs
SET init_option_ids = ARRAY['public.activities', 'public.stats']
WHERE user_type = 'citizen';
