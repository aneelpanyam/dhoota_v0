-- ============================================
-- 018: Expanded User Options
-- Announcements, info cards, reports, bookmarks,
-- activity planning, profile, public site config.
-- ============================================

-- ============================================
-- Option Definitions
-- ============================================

INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, response_prompt, follow_up_option_ids) VALUES

-- Announcements
('announcement.create', 'Create Announcement', 'Create a new announcement. Set visibility to public to share with citizens.', 'announcement', 'Megaphone', ARRAY['announcement', 'create announcement', 'new announcement', 'publish', 'news'], ARRAY['worker', 'candidate', 'representative'], ARRAY['public_site_enabled'], false, 40, false,
'{"type":"object","properties":{"title":{"type":"string"},"content":{"type":"string"},"visibility":{"type":"string","enum":["private","public"]},"pinned":{"type":"boolean"},"expires_at":{"type":"string","format":"date-time"}},"required":["title","content"]}'::jsonb,
'Confirm the announcement was created. Show the title, visibility status, and whether it is pinned.',
ARRAY['announcement.list']),

('announcement.list', 'View Announcements', 'View your announcements with filtering by visibility.', 'announcement', 'List', ARRAY['announcements', 'list announcements', 'my announcements', 'view announcements'], ARRAY['worker', 'candidate', 'representative'], ARRAY['public_site_enabled'], true, 41, false,
'{"type":"object","properties":{"visibility":{"type":"string","enum":["private","public"]},"page":{"type":"integer","default":1},"pageSize":{"type":"integer","default":10}}}'::jsonb,
'Show announcements as a data_list with title, visibility, pinned status, published date, and expiry.',
ARRAY['announcement.create', 'announcement.edit']),

('announcement.edit', 'Edit Announcement', 'Edit an existing announcement title, content, visibility, or pin status.', 'announcement', 'Pencil', ARRAY['edit announcement', 'update announcement', 'change announcement'], ARRAY['worker', 'candidate', 'representative'], ARRAY['public_site_enabled'], false, 100, false,
'{"type":"object","properties":{"announcement_id":{"type":"string"},"title":{"type":"string"},"content":{"type":"string"},"visibility":{"type":"string","enum":["private","public"]},"pinned":{"type":"boolean"},"expires_at":{"type":"string","format":"date-time"}},"required":["announcement_id"]}'::jsonb,
'Show the updated announcement. Summarize what changed.',
ARRAY['announcement.list']),

('announcement.delete', 'Delete Announcement', 'Soft-delete an announcement.', 'announcement', 'Trash2', ARRAY['delete announcement', 'remove announcement'], ARRAY['worker', 'candidate', 'representative'], ARRAY['public_site_enabled'], false, 100, false,
'{"type":"object","properties":{"announcement_id":{"type":"string"}},"required":["announcement_id"]}'::jsonb,
'Confirm the announcement has been deleted.',
ARRAY['announcement.list']),

-- Info Cards
('info_card.create', 'Create Info Card', 'Create an info card (about, contact, service, custom). Set visibility to public to show on citizen site.', 'info_card', 'CreditCard', ARRAY['info card', 'create info card', 'new card', 'about card', 'contact card', 'service card'], ARRAY['worker', 'candidate', 'representative'], ARRAY['public_site_enabled'], false, 42, false,
'{"type":"object","properties":{"title":{"type":"string"},"content":{"type":"object"},"card_type":{"type":"string","enum":["about","contact","service","custom"]},"visibility":{"type":"string","enum":["private","public"]},"display_order":{"type":"integer"},"icon":{"type":"string"}},"required":["title","card_type"]}'::jsonb,
'Confirm the info card was created. Show the card details including type and visibility.',
ARRAY['info_card.list']),

('info_card.list', 'View Info Cards', 'View your info cards with filtering by type.', 'info_card', 'LayoutGrid', ARRAY['info cards', 'list info cards', 'my cards', 'view cards'], ARRAY['worker', 'candidate', 'representative'], ARRAY['public_site_enabled'], true, 43, false,
'{"type":"object","properties":{"card_type":{"type":"string","enum":["about","contact","service","custom"]},"page":{"type":"integer","default":1},"pageSize":{"type":"integer","default":20}}}'::jsonb,
'Show info cards as a data_list organized by card_type with title, type, visibility, and display order.',
ARRAY['info_card.create', 'info_card.edit']),

('info_card.edit', 'Edit Info Card', 'Edit an info card title, content, type, visibility, or display order.', 'info_card', 'Pencil', ARRAY['edit info card', 'update card', 'change card'], ARRAY['worker', 'candidate', 'representative'], ARRAY['public_site_enabled'], false, 100, false,
'{"type":"object","properties":{"info_card_id":{"type":"string"},"title":{"type":"string"},"content":{"type":"object"},"card_type":{"type":"string","enum":["about","contact","service","custom"]},"visibility":{"type":"string","enum":["private","public"]},"display_order":{"type":"integer"},"icon":{"type":"string"}},"required":["info_card_id"]}'::jsonb,
'Show the updated info card. Summarize what changed.',
ARRAY['info_card.list']),

('info_card.delete', 'Delete Info Card', 'Soft-delete an info card.', 'info_card', 'Trash2', ARRAY['delete info card', 'remove card'], ARRAY['worker', 'candidate', 'representative'], ARRAY['public_site_enabled'], false, 100, false,
'{"type":"object","properties":{"info_card_id":{"type":"string"}},"required":["info_card_id"]}'::jsonb,
'Confirm the info card has been deleted.',
ARRAY['info_card.list']),

-- Reports
('report.request', 'Request Report', 'Request a report to be generated for your activities.', 'report', 'FileBarChart', ARRAY['report', 'request report', 'generate report', 'export', 'download'], ARRAY['worker', 'candidate', 'representative'], ARRAY['reports_enabled'], true, 45, false,
'{"type":"object","properties":{"report_type":{"type":"string","enum":["monthly_summary","activity_export","tag_analysis","media_summary"]},"parameters":{"type":"object"}},"required":["report_type"]}'::jsonb,
'Confirm the report request was submitted. Show the report type and expected processing time.',
ARRAY['report.list']),

('report.list', 'View My Reports', 'View your report requests and their status.', 'report', 'FileText', ARRAY['my reports', 'report status', 'view reports', 'reports'], ARRAY['worker', 'candidate', 'representative'], ARRAY['reports_enabled'], false, 46, false,
'{"type":"object","properties":{"status":{"type":"string","enum":["requested","processing","completed","failed"]},"page":{"type":"integer","default":1},"pageSize":{"type":"integer","default":10}}}'::jsonb,
'Show reports as a data_list with report type, status, requested date, and download link if completed.',
ARRAY['report.request']),

-- Bookmarks
('bookmark.add', 'Bookmark Item', 'Save an activity, conversation, or report to your bookmarks for quick access.', 'bookmark', 'Bookmark', ARRAY['bookmark', 'save', 'star', 'favorite', 'pin'], ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[], false, 100, false,
'{"type":"object","properties":{"entity_type":{"type":"string","enum":["activity","conversation","report"]},"entity_id":{"type":"string"},"label":{"type":"string"}},"required":["entity_type","entity_id"]}'::jsonb,
'Confirm the item has been bookmarked.',
ARRAY['bookmark.list']),

('bookmark.list', 'View Bookmarks', 'View your saved bookmarks.', 'bookmark', 'Bookmarks', ARRAY['bookmarks', 'saved items', 'my bookmarks', 'favorites'], ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[], true, 47, false,
'{"type":"object","properties":{"entity_type":{"type":"string"},"page":{"type":"integer","default":1},"pageSize":{"type":"integer","default":20}}}'::jsonb,
'Show bookmarks as a data_list with label, type, and date bookmarked.',
ARRAY['bookmark.add']),

('bookmark.remove', 'Remove Bookmark', 'Remove an item from your bookmarks.', 'bookmark', 'BookmarkMinus', ARRAY['unbookmark', 'remove bookmark', 'unpin', 'unsave'], ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[], false, 100, false,
'{"type":"object","properties":{"bookmark_id":{"type":"string"}},"required":["bookmark_id"]}'::jsonb,
'Confirm the bookmark has been removed.',
ARRAY['bookmark.list']),

-- Activity Planning
('plan.create', 'Plan Activity', 'Create an activity plan with a target date and optional reminders.', 'planning', 'CalendarPlus', ARRAY['plan', 'schedule', 'plan activity', 'upcoming', 'future activity'], ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[], false, 48, false,
'{"type":"object","properties":{"title":{"type":"string"},"description":{"type":"string"},"planned_date":{"type":"string","format":"date-time"},"linked_activity_id":{"type":"string"},"reminders":{"type":"array","items":{"type":"object"}}},"required":["title"]}'::jsonb,
'Confirm the plan was created. Show the plan details and planned date.',
ARRAY['plan.list']),

('plan.list', 'View Plans', 'View your activity plans sorted by date.', 'planning', 'Calendar', ARRAY['plans', 'my plans', 'scheduled', 'upcoming plans', 'view plans'], ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[], true, 49, false,
'{"type":"object","properties":{"status":{"type":"string","enum":["draft","scheduled","completed"]},"page":{"type":"integer","default":1},"pageSize":{"type":"integer","default":10}}}'::jsonb,
'Show plans as a data_list with title, planned date, status, and linked activity if any.',
ARRAY['plan.create', 'plan.edit']),

('plan.edit', 'Edit Plan', 'Update a plan title, date, status, or reminders.', 'planning', 'Pencil', ARRAY['edit plan', 'update plan', 'change plan', 'reschedule'], ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[], false, 100, false,
'{"type":"object","properties":{"plan_id":{"type":"string"},"title":{"type":"string"},"description":{"type":"string"},"planned_date":{"type":"string","format":"date-time"},"status":{"type":"string","enum":["draft","scheduled","completed"]},"reminders":{"type":"array","items":{"type":"object"}}},"required":["plan_id"]}'::jsonb,
'Show the updated plan. Summarize what changed.',
ARRAY['plan.list']),

-- Profile
('profile.view', 'View Profile', 'View your profile and account details.', 'profile', 'User', ARRAY['profile', 'my profile', 'account', 'my account', 'who am i'], ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[], false, 50, false,
'{"type":"object","properties":{}}'::jsonb,
'Show the user profile including name, email, user type, tenant, and account creation date.',
ARRAY['profile.edit']),

('profile.edit', 'Edit Profile', 'Update your display name or preferences.', 'profile', 'UserCog', ARRAY['edit profile', 'update profile', 'change name', 'update name'], ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[], false, 100, false,
'{"type":"object","properties":{"display_name":{"type":"string"},"preferences":{"type":"object"}}}'::jsonb,
'Confirm the profile was updated. Show the updated details.',
ARRAY['profile.view']),

-- Public Site Configuration
('public_site.configure', 'Configure Public Site', 'Set up your public site welcome message, side panel content, and theme.', 'public_site', 'Globe', ARRAY['public site', 'configure public', 'public website', 'citizen site', 'setup public'], ARRAY['worker', 'candidate', 'representative'], ARRAY['public_site_enabled'], false, 51, false,
'{"type":"object","properties":{"welcome_message":{"type":"string"},"side_panel_content":{"type":"object"},"theme_overrides":{"type":"object"},"enabled_option_ids":{"type":"array","items":{"type":"string"}}}}'::jsonb,
'Confirm the public site configuration was saved. Show the welcome message and enabled options.',
ARRAY['public_site.preview']),

('public_site.preview', 'Preview Public Site', 'Preview how your public site looks to citizens.', 'public_site', 'Eye', ARRAY['preview public', 'preview site', 'how does it look'], ARRAY['worker', 'candidate', 'representative'], ARRAY['public_site_enabled'], false, 52, false,
'{"type":"object","properties":{}}'::jsonb,
'Show a preview of the public site including welcome message, public announcements, and public info cards.',
ARRAY['public_site.configure']);

-- ============================================
-- SQL Templates
-- ============================================

-- Announcements
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('announcement.create', 'insert_announcement',
'INSERT INTO announcements (tenant_id, created_by, title, content, visibility, pinned, published_at, expires_at) VALUES ($1, $2, $3, $4, COALESCE($5, ''private'')::announcement_visibility, COALESCE($6, false), CASE WHEN $5 = ''public'' THEN now() ELSE NULL END, $7::timestamptz) RETURNING *',
'{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.title", "$4": "params.content", "$5": "params.visibility", "$6": "params.pinned", "$7": "params.expires_at"}'::jsonb,
0, 'write');

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('announcement.list', 'list_announcements',
'SELECT * FROM announcements WHERE tenant_id = $1 AND created_by = $2 AND deleted_at IS NULL AND ($3::text IS NULL OR visibility::text = $3) ORDER BY pinned DESC, created_at DESC LIMIT $4 OFFSET $5',
'{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.visibility", "$4": "params.pageSize", "$5": "params.offset"}'::jsonb,
0, 'read');

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('announcement.edit', 'update_announcement',
'UPDATE announcements SET title = COALESCE($3, title), content = COALESCE($4, content), visibility = COALESCE($5::announcement_visibility, visibility), pinned = COALESCE($6, pinned), expires_at = COALESCE($7::timestamptz, expires_at), published_at = CASE WHEN $5 = ''public'' AND published_at IS NULL THEN now() ELSE published_at END, updated_at = now() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING *',
'{"$1": "params.announcement_id", "$2": "context.tenantId", "$3": "params.title", "$4": "params.content", "$5": "params.visibility", "$6": "params.pinned", "$7": "params.expires_at"}'::jsonb,
0, 'write');

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('announcement.delete', 'soft_delete_announcement',
'UPDATE announcements SET deleted_at = now() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING id, title',
'{"$1": "params.announcement_id", "$2": "context.tenantId"}'::jsonb,
0, 'write');

-- Info Cards
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('info_card.create', 'insert_info_card',
'INSERT INTO info_cards (tenant_id, created_by, title, content, card_type, visibility, display_order, icon) VALUES ($1, $2, $3, COALESCE($4::jsonb, ''{}''::jsonb), $5::info_card_type, COALESCE($6, ''private'')::announcement_visibility, COALESCE($7, 0), $8) RETURNING *',
'{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.title", "$4": "params.content", "$5": "params.card_type", "$6": "params.visibility", "$7": "params.display_order", "$8": "params.icon"}'::jsonb,
0, 'write');

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('info_card.list', 'list_info_cards',
'SELECT * FROM info_cards WHERE tenant_id = $1 AND created_by = $2 AND deleted_at IS NULL AND ($3::text IS NULL OR card_type::text = $3) ORDER BY display_order ASC, created_at DESC LIMIT $4 OFFSET $5',
'{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.card_type", "$4": "params.pageSize", "$5": "params.offset"}'::jsonb,
0, 'read');

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('info_card.edit', 'update_info_card',
'UPDATE info_cards SET title = COALESCE($3, title), content = COALESCE($4::jsonb, content), card_type = COALESCE($5::info_card_type, card_type), visibility = COALESCE($6::announcement_visibility, visibility), display_order = COALESCE($7, display_order), icon = COALESCE($8, icon), updated_at = now() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING *',
'{"$1": "params.info_card_id", "$2": "context.tenantId", "$3": "params.title", "$4": "params.content", "$5": "params.card_type", "$6": "params.visibility", "$7": "params.display_order", "$8": "params.icon"}'::jsonb,
0, 'write');

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('info_card.delete', 'soft_delete_info_card',
'UPDATE info_cards SET deleted_at = now() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING id, title',
'{"$1": "params.info_card_id", "$2": "context.tenantId"}'::jsonb,
0, 'write');

-- Reports
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('report.request', 'insert_report_request',
'INSERT INTO report_requests (tenant_id, user_id, report_type, parameters) VALUES ($1, $2, $3, COALESCE($4::jsonb, ''{}''::jsonb)) RETURNING *',
'{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.report_type", "$4": "params.parameters"}'::jsonb,
0, 'write');

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('report.list', 'list_my_reports',
'SELECT * FROM report_requests WHERE tenant_id = $1 AND user_id = $2 AND ($3::text IS NULL OR status::text = $3) ORDER BY requested_at DESC LIMIT $4 OFFSET $5',
'{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.status", "$4": "params.pageSize", "$5": "params.offset"}'::jsonb,
0, 'read');

-- Bookmarks
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('bookmark.add', 'insert_bookmark',
'INSERT INTO bookmarks (tenant_id, user_id, entity_type, entity_id, label) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id, entity_type, entity_id) DO NOTHING RETURNING *',
'{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.entity_type", "$4": "params.entity_id", "$5": "params.label"}'::jsonb,
0, 'write');

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('bookmark.list', 'list_bookmarks',
'SELECT * FROM bookmarks WHERE tenant_id = $1 AND user_id = $2 AND ($3::text IS NULL OR entity_type = $3) ORDER BY created_at DESC LIMIT $4 OFFSET $5',
'{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.entity_type", "$4": "params.pageSize", "$5": "params.offset"}'::jsonb,
0, 'read');

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('bookmark.remove', 'delete_bookmark',
'DELETE FROM bookmarks WHERE id = $1 AND user_id = $2 RETURNING id',
'{"$1": "params.bookmark_id", "$2": "context.userId"}'::jsonb,
0, 'write');

-- Activity Plans
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('plan.create', 'insert_plan',
'INSERT INTO activity_plans (tenant_id, user_id, title, description, planned_date, linked_activity_id, reminders) VALUES ($1, $2, $3, $4, $5::timestamptz, $6, COALESCE($7::jsonb, ''[]''::jsonb)) RETURNING *',
'{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.title", "$4": "params.description", "$5": "params.planned_date", "$6": "params.linked_activity_id", "$7": "params.reminders"}'::jsonb,
0, 'write');

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('plan.list', 'list_plans',
'SELECT ap.*, a.title as linked_activity_title FROM activity_plans ap LEFT JOIN activities a ON ap.linked_activity_id = a.id WHERE ap.tenant_id = $1 AND ap.user_id = $2 AND ap.deleted_at IS NULL AND ($3::text IS NULL OR ap.status::text = $3) ORDER BY ap.planned_date ASC NULLS LAST LIMIT $4 OFFSET $5',
'{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.status", "$4": "params.pageSize", "$5": "params.offset"}'::jsonb,
0, 'read');

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('plan.edit', 'update_plan',
'UPDATE activity_plans SET title = COALESCE($3, title), description = COALESCE($4, description), planned_date = COALESCE($5::timestamptz, planned_date), status = COALESCE($6::plan_status, status), reminders = COALESCE($7::jsonb, reminders), updated_at = now() WHERE id = $1 AND tenant_id = $2 AND user_id = $8 AND deleted_at IS NULL RETURNING *',
'{"$1": "params.plan_id", "$2": "context.tenantId", "$3": "params.title", "$4": "params.description", "$5": "params.planned_date", "$6": "params.status", "$7": "params.reminders", "$8": "context.userId"}'::jsonb,
0, 'write');

-- Profile
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('profile.view', 'get_profile',
'SELECT u.id, u.email, u.display_name, u.user_type, u.created_at, t.name as tenant_name, t.slug as tenant_slug FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE u.id = $1 AND u.tenant_id = $2 AND u.deleted_at IS NULL',
'{"$1": "context.userId", "$2": "context.tenantId"}'::jsonb,
0, 'read');

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('profile.edit', 'update_profile',
'UPDATE users SET display_name = COALESCE($3, display_name), updated_at = now() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING id, email, display_name, user_type',
'{"$1": "context.userId", "$2": "context.tenantId", "$3": "params.display_name"}'::jsonb,
0, 'write');

-- Public Site Config
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('public_site.configure', 'upsert_public_site_config',
'INSERT INTO public_site_configs (tenant_id, user_id, welcome_message, side_panel_content, theme_overrides, enabled_option_ids) VALUES ($1, $2, COALESCE($3, ''Welcome!''), COALESCE($4::jsonb, ''{}''::jsonb), COALESCE($5::jsonb, ''{}''::jsonb), COALESCE($6::text[], ARRAY[''public.activities'', ''public.stats'', ''public.announcements'', ''public.info_cards'', ''public.about''])) ON CONFLICT (tenant_id, user_id) DO UPDATE SET welcome_message = COALESCE($3, public_site_configs.welcome_message), side_panel_content = COALESCE($4::jsonb, public_site_configs.side_panel_content), theme_overrides = COALESCE($5::jsonb, public_site_configs.theme_overrides), enabled_option_ids = COALESCE($6::text[], public_site_configs.enabled_option_ids), updated_at = now() RETURNING *',
'{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.welcome_message", "$4": "params.side_panel_content", "$5": "params.theme_overrides", "$6": "params.enabled_option_ids"}'::jsonb,
0, 'write');

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('public_site.preview', 'preview_public_site',
'SELECT psc.welcome_message, psc.theme_overrides, psc.enabled_option_ids, (SELECT json_agg(a ORDER BY a.pinned DESC, a.published_at DESC) FROM announcements a WHERE a.tenant_id = $1 AND a.created_by = $2 AND a.visibility = ''public'' AND a.deleted_at IS NULL LIMIT 5) as announcements, (SELECT json_agg(ic ORDER BY ic.display_order ASC) FROM info_cards ic WHERE ic.tenant_id = $1 AND ic.created_by = $2 AND ic.visibility = ''public'' AND ic.deleted_at IS NULL) as info_cards FROM public_site_configs psc WHERE psc.tenant_id = $1 AND psc.user_id = $2',
'{"$1": "context.tenantId", "$2": "context.userId"}'::jsonb,
0, 'read');

-- ============================================
-- Option Questions
-- ============================================

-- Announcements
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('announcement.create', 'What''s the announcement title?', 'title', 0, true, NULL, '{}', true),
('announcement.create', 'What''s the content?', 'content', 1, true, NULL, '{}', false),
('announcement.create', 'Who should see this?', 'visibility', 2, false, 'select', '{"options": ["private", "public"], "default": "private"}', true),
('announcement.create', 'Pin this announcement?', 'pinned', 3, false, 'select', '{"options": ["true", "false"], "default": "false"}', true);

-- Info Cards
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('info_card.create', 'What type of card?', 'card_type', 0, true, 'select', '{"options": ["about", "contact", "service", "custom"]}', true),
('info_card.create', 'Card title?', 'title', 1, true, NULL, '{}', true),
('info_card.create', 'Card content? (describe what information to include)', 'content_raw', 2, true, NULL, '{}', false),
('info_card.create', 'Who should see this?', 'visibility', 3, false, 'select', '{"options": ["private", "public"], "default": "private"}', true);

-- Reports
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('report.request', 'What type of report?', 'report_type', 0, true, 'select', '{"options": ["monthly_summary", "activity_export", "tag_analysis", "media_summary"]}', false);

-- Activity Planning
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('plan.create', 'What are you planning?', 'title', 0, true, NULL, '{}', true),
('plan.create', 'Any details?', 'description', 1, false, NULL, '{}', false),
('plan.create', 'When is it planned for?', 'planned_date', 2, false, 'date_picker', '{}', true);

-- Public Site Config
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('public_site.configure', 'What welcome message should citizens see?', 'welcome_message', 0, false, NULL, '{}', false),
('public_site.configure', 'Which options should be available on the public site?', 'enabled_option_ids', 1, false, 'multi_select', '{"options": ["public.activities", "public.stats", "public.announcements", "public.info_cards", "public.about"]}', false);

-- ============================================
-- Update existing user_type_configs to include new options
-- ============================================

UPDATE user_type_configs SET
  default_option_ids = array_cat(default_option_ids, ARRAY['announcement.list', 'info_card.list', 'bookmark.list', 'plan.list']),
  available_option_ids = array_cat(available_option_ids, ARRAY[
    'announcement.create', 'announcement.list', 'announcement.edit', 'announcement.delete',
    'info_card.create', 'info_card.list', 'info_card.edit', 'info_card.delete',
    'report.request', 'report.list',
    'bookmark.add', 'bookmark.list', 'bookmark.remove',
    'plan.create', 'plan.list', 'plan.edit',
    'profile.view', 'profile.edit',
    'public_site.configure', 'public_site.preview'
  ])
WHERE user_type IN ('worker', 'candidate', 'representative');
