-- 070: Expand view.stats to include profile/public-site metrics for workers/representatives/candidates
-- Adds: info cards count, announcements count, welcome messages count, avatar set or not

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('view.stats', 'profile_public_stats',
'SELECT
  (SELECT count(*)::int FROM announcements WHERE tenant_id = $1 AND created_by = $2 AND deleted_at IS NULL) as announcement_count,
  (SELECT count(*)::int FROM info_cards WHERE tenant_id = $1 AND created_by = $2 AND deleted_at IS NULL) as info_card_count,
  (SELECT count(*)::int FROM public_site_welcome_messages WHERE tenant_id = $1 AND user_id = $2) as welcome_message_count,
  (SELECT CASE WHEN u.avatar_url IS NOT NULL AND trim(u.avatar_url) != '''' THEN 1 ELSE 0 END FROM users u WHERE u.id = $2 AND u.tenant_id = $1 AND u.deleted_at IS NULL) as avatar_set',
'{"$1": "context.tenantId", "$2": "context.userId"}'::jsonb,
2, 'read');
