-- ============================================
-- 072: Fix admin.user.provision and add validation
-- 1. Restore resolve_tenant_id and COALESCE for access_code in insert_user
-- 2. Add optional access_code question (password_with_confirmation)
-- 3. Add format: email for provision_bulk table columns
-- 4. Update option_definitions input_schema to include access_code
-- ============================================

-- Fix insert_user SQL: restore tenant resolution and access_code auto-generation
UPDATE sql_templates SET
  sql = 'INSERT INTO users (tenant_id, email, display_name, user_type, access_code) VALUES (resolve_tenant_id($1), $2, $3, $4::user_type, COALESCE($5, upper(substr(md5(random()::text), 1, 4) || ''-'' || substr(md5(random()::text), 1, 4)))) RETURNING id, email, display_name, user_type, access_code, created_at'
WHERE option_id = 'admin.user.provision' AND name = 'insert_user';

-- Add optional access_code question to admin.user.provision
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('admin.user.provision', 'Access code? (leave blank to auto-generate)', 'access_code', 4, false, 'password_with_confirmation', '{"minLength": 6, "requireUppercase": true, "requireDigit": true, "placeholder": "e.g. ACME-7X9K"}'::jsonb, true);

-- Update option_definitions input_schema to include access_code
UPDATE option_definitions SET
  input_schema = '{"type":"object","properties":{"tenant_id":{"type":"string"},"email":{"type":"string","format":"email"},"display_name":{"type":"string"},"user_type":{"type":"string","enum":["worker","candidate","representative"]},"access_code":{"type":"string"}},"required":["tenant_id","email","display_name","user_type"]}'::jsonb
WHERE id = 'admin.user.provision';

-- Add format: email for provision_bulk table columns
UPDATE option_questions SET widget_config = '{"columns": [{"key": "email", "label": "Email", "required": true, "format": "email"}, {"key": "display_name", "label": "Display Name", "required": true}, {"key": "user_type", "label": "User Type", "required": true}]}'::jsonb
WHERE option_id = 'admin.user.provision_bulk' AND question_key = 'users';

update option_definitions
set follow_up_option_ids = array_append(follow_up_option_ids,'admin.tenant.view')
where id = 'admin.user.view' and not ('admin.tenant.view' = ANY(follow_up_option_ids))
