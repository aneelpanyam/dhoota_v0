-- ============================================
-- 074: Admin usage view - LLM calls and cost per option
-- Extends option_execution_stats to include llm_call_count and llm_total_cost
-- by joining with llm_logs aggregated by option_id.
-- ============================================

UPDATE sql_templates SET
  sql = 'SELECT oe.option_id, od.name as option_name, count(*) as execution_count, avg(oe.execution_ms) as avg_ms, count(*) FILTER (WHERE oe.success = false) as error_count, COALESCE(llm.llm_call_count, 0)::bigint as llm_call_count, COALESCE(llm.llm_total_cost, 0)::numeric as llm_total_cost FROM option_executions oe JOIN option_definitions od ON oe.option_id = od.id LEFT JOIN (SELECT l.option_id, count(*)::bigint as llm_call_count, sum(COALESCE(l.total_cost, 0))::numeric as llm_total_cost FROM llm_logs l WHERE ($1::text IS NULL OR l.tenant_id = resolve_tenant_id($1)) AND l.created_at >= date_trunc(COALESCE($2, ''month''), now()) AND l.option_id IS NOT NULL GROUP BY l.option_id) llm ON oe.option_id = llm.option_id WHERE ($1::text IS NULL OR oe.tenant_id = resolve_tenant_id($1)) AND oe.created_at >= date_trunc(COALESCE($2, ''month''), now()) GROUP BY oe.option_id, od.name, llm.llm_call_count, llm.llm_total_cost ORDER BY execution_count DESC'
WHERE option_id = 'admin.usage.view' AND name = 'option_execution_stats';
