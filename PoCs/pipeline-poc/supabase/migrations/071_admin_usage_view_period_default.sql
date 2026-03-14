-- ============================================
-- 071: Fix admin.usage.view - period default and optional filters
-- Root cause: params.period was null, causing date_trunc(null, now()) to
-- filter out all rows. Add COALESCE default and optional period/tenant questions.
-- ============================================

-- Fix SQL: default period to 'month' when not provided
UPDATE sql_templates SET
  sql = 'SELECT t.name as tenant_name, l.model, count(*) as call_count, sum(l.prompt_tokens) as total_input_tokens, sum(l.completion_tokens) as total_output_tokens, sum(l.total_cost) as total_cost FROM llm_logs l JOIN tenants t ON l.tenant_id = t.id WHERE ($1::text IS NULL OR l.tenant_id = resolve_tenant_id($1)) AND l.created_at >= date_trunc(COALESCE($2, ''month''), now()) GROUP BY t.name, l.model ORDER BY total_cost DESC'
WHERE option_id = 'admin.usage.view' AND name = 'usage_by_tenant';

UPDATE sql_templates SET
  sql = 'SELECT oe.option_id, od.name as option_name, count(*) as execution_count, avg(oe.execution_ms) as avg_ms, count(*) FILTER (WHERE oe.success = false) as error_count FROM option_executions oe JOIN option_definitions od ON oe.option_id = od.id WHERE ($1::text IS NULL OR oe.tenant_id = resolve_tenant_id($1)) AND oe.created_at >= date_trunc(COALESCE($2, ''month''), now()) GROUP BY oe.option_id, od.name ORDER BY execution_count DESC'
WHERE option_id = 'admin.usage.view' AND name = 'option_execution_stats';

-- Add optional questions for period and tenant filter
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('admin.usage.view', 'Time period?', 'period', 0, false, 'select', '{"options": ["day", "week", "month"], "default": "month", "placeholder": "This month"}'::jsonb, true),
('admin.usage.view', 'Filter by tenant?', 'tenant_id', 1, false, 'select', '{"source": "tenants", "placeholder": "All tenants"}'::jsonb, true);
