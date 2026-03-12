-- ============================================
-- 029: Tenant Question Overrides
-- Adds per-tenant customisation of option
-- questions (text, widget config, required).
-- Includes admin options to list and configure.
-- ============================================

-- ============================================
-- New table
-- ============================================

CREATE TABLE tenant_question_overrides (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               uuid NOT NULL REFERENCES tenants(id),
    question_id             uuid NOT NULL REFERENCES option_questions(id),
    question_text_override  text,
    widget_config_override  jsonb,
    is_required_override    boolean,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, question_id)
);

CREATE INDEX idx_tenant_question_overrides_tenant ON tenant_question_overrides(tenant_id);

-- ============================================
-- Admin option definitions
-- ============================================

INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt, follow_up_option_ids) VALUES

('admin.question.list', 'List Questions', 'View all questions for an option with any tenant-specific overrides.', 'admin', 'HelpCircle', ARRAY['list questions', 'view questions', 'option questions', 'question overrides'], ARRAY['system_admin'], ARRAY[]::text[], false, 41, false,
'{"type":"object","properties":{"option_id":{"type":"string"},"tenant_id":{"type":"string"}},"required":["option_id"]}'::jsonb,
'Show questions as a data_list with columns for question text, key, order, required, widget, and any tenant override values.',
ARRAY['admin.question.configure', 'admin.option.view']),

('admin.question.configure', 'Configure Question', 'Override a question''s text, widget config, or required flag for a specific tenant.', 'admin', 'MessageSquare', ARRAY['configure question', 'override question', 'change question text', 'customise question'], ARRAY['system_admin'], ARRAY[]::text[], false, 100, false,
'{"type":"object","properties":{"tenant_id":{"type":"string"},"question_id":{"type":"string"},"question_text_override":{"type":"string"},"widget_config_override":{"type":"object"},"is_required_override":{"type":"boolean"}},"required":["tenant_id","question_id"]}'::jsonb,
'Confirm the question override was saved. Show the effective question configuration for the tenant.',
ARRAY['admin.question.list', 'admin.option.view']);

-- ============================================
-- SQL templates
-- ============================================

-- admin.question.list
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.question.list', 'list_questions',
'SELECT oq.id, oq.option_id, oq.question_text, oq.question_key, oq.question_order, oq.is_required, oq.inline_widget, oq.widget_config, oq.groupable, tqo.question_text_override, tqo.widget_config_override, tqo.is_required_override FROM option_questions oq LEFT JOIN tenant_question_overrides tqo ON oq.id = tqo.question_id AND tqo.tenant_id = $2 WHERE oq.option_id = $1 ORDER BY oq.question_order',
'{"$1": "params.option_id", "$2": "params.tenant_id"}'::jsonb,
0, 'read');

-- admin.question.configure
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.question.configure', 'upsert_question_override',
'INSERT INTO tenant_question_overrides (tenant_id, question_id, question_text_override, widget_config_override, is_required_override) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (tenant_id, question_id) DO UPDATE SET question_text_override = COALESCE($3, tenant_question_overrides.question_text_override), widget_config_override = COALESCE($4, tenant_question_overrides.widget_config_override), is_required_override = COALESCE($5, tenant_question_overrides.is_required_override), updated_at = now() RETURNING *',
'{"$1": "params.tenant_id", "$2": "params.question_id", "$3": "params.question_text_override", "$4": "params.widget_config_override", "$5": "params.is_required_override"}'::jsonb,
0, 'write');

-- ============================================
-- Admin option questions (Q&A flows)
-- ============================================

INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('admin.question.list', 'Which option ID?', 'option_id', 0, true, NULL, '{}', false),
('admin.question.list', 'Tenant ID to check overrides for (optional)?', 'tenant_id', 1, false, 'select', '{"source": "tenants"}', false);

INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('admin.question.configure', 'Which tenant?', 'tenant_id', 0, true, 'select', '{"source": "tenants"}', false),
('admin.question.configure', 'Which question ID (UUID from question list)?', 'question_id', 1, true, NULL, '{}', false),
('admin.question.configure', 'New question text (leave blank to keep current)?', 'question_text_override', 2, false, NULL, '{}', true),
('admin.question.configure', 'Override required flag?', 'is_required_override', 3, false, 'select', '{"options": ["true", "false"]}', true);

-- ============================================
-- Update system_admin available options
-- ============================================

UPDATE user_type_configs
SET available_option_ids = array_cat(available_option_ids, ARRAY['admin.question.list', 'admin.question.configure'])
WHERE user_type = 'system_admin'
  AND NOT available_option_ids @> ARRAY['admin.question.list'];
