-- Fix activity.add_media: add file upload question and fix SQL template
-- Previously, no option_question existed so the Q&A engine skipped straight
-- to confirmation without prompting for file uploads.

-- 1. Add file upload question so users are prompted to select files
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('activity.add_media', 'Select photos, videos, or documents to attach:', 'media_keys', 0, true, 'file_upload', '{"accept": "image/*,video/*,application/pdf,.doc,.docx", "multiple": true}'::jsonb, false);

-- 2. Replace the old insert_media SQL template.
--    The old template tried to insert a single media row using individual params
--    (media_type, original_filename, s3_key, etc.) which the upload flow never collects.
--    Media insertion is handled by saveActivityMedia() in handleConfirmation when
--    params.media_keys is present. We just need a write template to trigger the
--    confirmation flow and touch the activity's updated_at.
DELETE FROM sql_templates WHERE option_id = 'activity.add_media' AND name = 'insert_media';

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('activity.add_media', 'touch_activity',
 'UPDATE activities SET updated_at = now() WHERE id = $1 AND tenant_id = $2 RETURNING id, title, status, activity_date',
 '{"$1": "params.activity_id", "$2": "context.tenantId"}'::jsonb,
 0, 'write');
