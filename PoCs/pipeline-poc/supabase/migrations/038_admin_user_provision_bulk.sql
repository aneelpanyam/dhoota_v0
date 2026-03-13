-- ============================================
-- 038: Admin user provision bulk
-- New option to provision multiple users at once
-- using a table question.
-- ============================================

INSERT INTO option_definitions (
  id, name, description, category, icon, keywords, user_types, required_toggles,
  show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt,
  follow_up_option_ids, target_widget, requires_confirmation, skip_refinement, entity_type
) VALUES (
  'admin.user.provision_bulk', 'Provision Multiple Users', 'Add multiple users to a tenant at once. Each row: email, display name, user type.',
  'admin', 'UserPlus', ARRAY['bulk provision', 'add users', 'provision multiple', 'onboard users'],
  ARRAY['system_admin'], ARRAY[]::text[], false, 16, false,
  jsonb_build_object(
    'type', 'object',
    'properties', jsonb_build_object(
      'tenant_id', jsonb_build_object('type', 'string'),
      'users', jsonb_build_object(
        'type', 'array',
        'items', jsonb_build_object(
          'type', 'object',
          'properties', jsonb_build_object(
            'email', jsonb_build_object('type', 'string'),
            'display_name', jsonb_build_object('type', 'string'),
            'user_type', jsonb_build_object('type', 'string', 'enum', jsonb_build_array('worker', 'candidate', 'representative'))
          ),
          'required', jsonb_build_array('email', 'display_name', 'user_type')
        )
      )
    ),
    'required', jsonb_build_array('tenant_id', 'users')
  ),
  'Show the provisioned users with their access codes. Remind admin to share codes with each user.',
  ARRAY['admin.user.list', 'admin.user.provision', 'admin.tenant.view'],
  'data_list', true, true, 'user'
);

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.user.provision_bulk', 'insert_users_bulk',
'INSERT INTO users (tenant_id, email, display_name, user_type, access_code)
SELECT resolve_tenant_id($1), e->>''email'', e->>''display_name'', (e->>''user_type'')::user_type,
  upper(substr(md5(random()::text), 1, 4) || ''-'' || substr(md5(random()::text), 1, 4))
FROM jsonb_array_elements($2::jsonb) AS e
RETURNING id, email, display_name, user_type, access_code, created_at',
'{"$1": "params.tenant_id", "$2": "params.users"}'::jsonb,
0, 'write');

INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('admin.user.provision_bulk', 'Which tenant?', 'tenant_id', 0, true, 'select', '{"source": "tenants"}'::jsonb, false),
('admin.user.provision_bulk', 'Add users (email, display name, user type per row):', 'users', 1, true, 'table',
'{"columns": [{"key": "email", "label": "Email", "required": true}, {"key": "display_name", "label": "Display Name", "required": true}, {"key": "user_type", "label": "User Type", "required": true}]}'::jsonb,
false);

-- Add to system_admin available options
UPDATE user_type_configs SET
  available_option_ids = array_append(available_option_ids, 'admin.user.provision_bulk')
WHERE user_type = 'system_admin' AND NOT ('admin.user.provision_bulk' = ANY(available_option_ids));
