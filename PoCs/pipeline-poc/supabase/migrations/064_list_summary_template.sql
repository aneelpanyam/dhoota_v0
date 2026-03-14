-- ============================================
-- 064: Add list_summary_template to option_definitions
-- Configurable per-option list result summary (e.g. "Here are the announcements")
-- Supports {{count}} placeholder for item count.
-- ============================================

ALTER TABLE option_definitions
ADD COLUMN IF NOT EXISTS list_summary_template text;

-- Announcement list options: friendly summary instead of "Found X result(s)"

UPDATE option_definitions SET list_summary_template = 'Please make a note of these!' WHERE id = 'public.announcements';
UPDATE option_definitions SET list_summary_template = 'Here''s what I''ve been up to' WHERE id = 'public.activities';
UPDATE option_definitions SET list_summary_template = 'A quick peek into my work' WHERE id = 'public.stats';

UPDATE option_definitions SET list_summary_template = 'Here are the announcements.' WHERE id = 'announcement.list';
UPDATE option_definitions SET list_summary_template = 'Here are the announcements.' WHERE id = 'admin.announcement.list';
