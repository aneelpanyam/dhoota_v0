  -- ============================================
  -- 075: Tenant AI cost display and operational cost amortization
  -- 1. operational_cost_entries table for system costs (AWS, Supabase, etc.)
  -- 2. usage_by_tenant_summary: AI cost per tenant for the period
  -- 3. admin.costs.record: chat option to record operational costs
  -- 4. Extend admin.usage.view with per-tenant AI + allocated cost table
  -- ============================================

  -- ============================================
  -- 1. Operational cost entries table
  -- ============================================
  CREATE TABLE operational_cost_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cost_type text NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency text NOT NULL DEFAULT 'USD',
    period_start date NOT NULL,
    period_end date NOT NULL,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id)
  );

  CREATE INDEX idx_operational_cost_period ON operational_cost_entries(period_start, period_end);

  -- ============================================
  -- 2. usage_by_tenant_summary: AI cost per tenant
  -- ============================================
  INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
  ('admin.usage.view', 'usage_by_tenant_summary',
  'SELECT t.id as tenant_id, t.name as tenant_name,
    COALESCE(sum(l.total_cost), 0)::numeric as ai_cost,
    count(l.id)::bigint as llm_calls,
    sum(COALESCE(l.prompt_tokens, 0))::bigint as input_tokens,
    sum(COALESCE(l.completion_tokens, 0))::bigint as output_tokens
  FROM tenants t
  LEFT JOIN llm_logs l ON l.tenant_id = t.id
    AND l.created_at >= date_trunc(COALESCE($2, ''month''), now())
    AND ($1::text IS NULL OR l.tenant_id = resolve_tenant_id($1))
  WHERE t.deleted_at IS NULL
    AND ($1::text IS NULL OR t.id = resolve_tenant_id($1))
  GROUP BY t.id, t.name
  ORDER BY ai_cost DESC',
  '{"$1": "params.tenant_id", "$2": "params.period"}'::jsonb,
  2, 'read');

  -- ============================================
  -- 3. operational_cost_allocation: total op cost for period (equal split)
  -- ============================================
  INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
  ('admin.usage.view', 'operational_cost_allocation',
  'WITH period_bounds AS (
    SELECT
      date_trunc(COALESCE($2, ''month''), now())::date as p_start,
      (date_trunc(COALESCE($2, ''month''), now()) + CASE COALESCE($2, ''month'') WHEN ''day'' THEN interval ''1 day'' WHEN ''week'' THEN interval ''1 week'' ELSE interval ''1 month'' END - interval ''1 day'')::date as p_end
  ),
  op_total AS (
    SELECT COALESCE(sum(o.amount), 0)::numeric as total
    FROM operational_cost_entries o, period_bounds p
    WHERE o.period_start <= p.p_end AND o.period_end >= p.p_start
  ),
  tenant_count AS (
    SELECT count(*)::integer as n
    FROM tenants t
    WHERE t.deleted_at IS NULL
      AND ($1::text IS NULL OR t.id = resolve_tenant_id($1))
  )
  SELECT (SELECT total FROM op_total) as total_operational_cost, (SELECT n FROM tenant_count) as tenant_count',
  '{"$1": "params.tenant_id", "$2": "params.period"}'::jsonb,
  3, 'read');

  -- Update execution_order for option_execution_stats (was 1, now 4)
  UPDATE sql_templates SET execution_order = 4
  WHERE option_id = 'admin.usage.view' AND name = 'option_execution_stats';

  -- ============================================
  -- 4. admin.costs.record option
  -- ============================================
  INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt, follow_up_option_ids, is_active, target_widget, requires_confirmation, skip_refinement, entity_type) VALUES
  ('admin.costs.record', 'Record System Cost', 'Record operational costs (AWS, Supabase, etc.) for a billing period. Costs are split equally across tenants in the usage view.', 'admin', 'DollarSign', ARRAY['record cost', 'add cost', 'operational cost', 'system cost', 'amortize'], ARRAY['system_admin'], ARRAY[]::text[], false, 36, false,
  '{"type":"object","properties":{"cost_type":{"type":"string","enum":["aws","supabase","openai_base","other"]},"amount":{"type":"number"},"period_start":{"type":"string","format":"date"},"period_end":{"type":"string","format":"date"},"notes":{"type":"string"}},"required":["cost_type","amount","period_start","period_end"]}'::jsonb,
  'Confirm the cost was recorded. Show the entry details and remind admin that costs are split equally across tenants in the usage view.',
  ARRAY['admin.usage.view'], true, 'text_response', true, true, 'usage');

  INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
  ('admin.costs.record', 'Cost type?', 'cost_type', 0, true, 'select', '{"options": [{"value": "aws", "label": "AWS"}, {"value": "supabase", "label": "Supabase"}, {"value": "openai_base", "label": "OpenAI (base)"}, {"value": "other", "label": "Other"}]}'::jsonb, true),
  ('admin.costs.record', 'Amount (USD)?', 'amount', 1, true, NULL, '{"placeholder": "e.g. 150.00"}'::jsonb, true),
  ('admin.costs.record', 'Period start date?', 'period_start', 2, true, 'date_picker', '{"placeholder": "YYYY-MM-DD"}'::jsonb, true),
  ('admin.costs.record', 'Period end date?', 'period_end', 3, true, 'date_picker', '{"placeholder": "YYYY-MM-DD"}'::jsonb, true),
  ('admin.costs.record', 'Notes (optional)?', 'notes', 4, false, NULL, '{"placeholder": "e.g. March 2024 infrastructure"}'::jsonb, true);

  INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
  ('admin.costs.record', 'insert_cost',
  'INSERT INTO operational_cost_entries (cost_type, amount, currency, period_start, period_end, notes, created_by) VALUES ($1, $2, ''USD'', $3::date, $4::date, NULLIF(trim($5), ''''), $6) RETURNING id, cost_type, amount, period_start, period_end, notes, created_at',
  '{"$1": "params.cost_type", "$2": "params.amount", "$3": "params.period_start", "$4": "params.period_end", "$5": "params.notes", "$6": "context.userId"}'::jsonb,
  0, 'write');

  -- Add admin.costs.record as follow-up on admin.usage.view
  UPDATE option_definitions SET
    follow_up_option_ids = array_append(follow_up_option_ids, 'admin.costs.record')
  WHERE id = 'admin.usage.view' AND NOT ('admin.costs.record' = ANY(follow_up_option_ids));

  -- Add admin.costs.record to system_admin available options
  UPDATE user_type_configs SET
    available_option_ids = array_append(available_option_ids, 'admin.costs.record')
  WHERE user_type = 'system_admin' AND NOT ('admin.costs.record' = ANY(available_option_ids));
