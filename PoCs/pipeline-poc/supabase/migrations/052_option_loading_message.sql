-- ============================================
-- 052: Add loading_message to option_definitions
-- Configurable per-option contextual loading text
-- ============================================

ALTER TABLE option_definitions
ADD COLUMN IF NOT EXISTS loading_message text;

-- Seed common options with contextual messages
UPDATE option_definitions SET loading_message = 'Creating activity...' WHERE id = 'activity.create';
UPDATE option_definitions SET loading_message = 'Updating activity...' WHERE id = 'activity.edit';
UPDATE option_definitions SET loading_message = 'Adding note...' WHERE id = 'activity.add_note';
UPDATE option_definitions SET loading_message = 'Uploading media...' WHERE id = 'activity.add_media';
UPDATE option_definitions SET loading_message = 'Loading report...' WHERE id = 'report.request';
UPDATE option_definitions SET loading_message = 'Generating insights...' WHERE id LIKE 'analysis.%';
UPDATE option_definitions SET loading_message = 'Loading report...' WHERE id LIKE 'report.%';
