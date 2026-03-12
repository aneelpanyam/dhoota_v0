-- Add a count template alongside the existing list_activities template
-- so the formatter can report accurate totalItems for pagination.

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('activity.list', 'count_activities',
 'SELECT count(*) as total_count FROM activities WHERE tenant_id = $1 AND deleted_at IS NULL',
 '{"$1": "context.tenantId"}'::jsonb,
 1, 'read');
