-- ============================================
-- 023: Fix feature flag column name mismatch
--      + Fix citizen.access.create auto-gen code
--
-- The table (003) defines the column as flag_key,
-- but SQL templates and option questions reference
-- flag_name. Align everything to flag_key.
--
-- citizen.access.create maps $3 to params.access_code
-- which is never provided (input_schema only has count),
-- causing a NOT NULL violation. Auto-generate the code.
-- ============================================

-- Fix upsert_flag SQL template (currently from 020)
UPDATE sql_templates SET
  sql = 'INSERT INTO tenant_feature_flags (tenant_id, flag_key, enabled) VALUES (resolve_tenant_id($1), $2, $3) ON CONFLICT (tenant_id, flag_key) DO UPDATE SET enabled = $3, updated_at = now() RETURNING *',
  param_mapping = '{"$1": "params.tenant_id", "$2": "params.flag_key", "$3": "params.enabled"}'::jsonb
WHERE option_id = 'admin.feature_flag.manage' AND name = 'upsert_flag';

-- Fix list_flags SQL template (currently from 020)
UPDATE sql_templates SET
  sql = 'SELECT * FROM tenant_feature_flags WHERE tenant_id = resolve_tenant_id($1) ORDER BY flag_key'
WHERE option_id = 'admin.feature_flag.manage' AND name = 'list_flags';

-- Fix input_schema on the option definition
UPDATE option_definitions SET
  input_schema = '{"type":"object","properties":{"tenant_id":{"type":"string"},"flag_key":{"type":"string"},"enabled":{"type":"boolean"}},"required":["tenant_id","flag_key","enabled"]}'::jsonb
WHERE id = 'admin.feature_flag.manage';

-- Fix question key from flag_name to flag_key
UPDATE option_questions SET
  question_key = 'flag_key'
WHERE option_id = 'admin.feature_flag.manage' AND question_key = 'flag_name';

-- ============================================
-- Fix citizen.access.create: auto-generate code
-- ============================================

UPDATE sql_templates SET
  sql = 'INSERT INTO citizen_access (tenant_id, user_id, access_code) VALUES ($1, $2, upper(substr(md5(random()::text), 1, 4) || ''-'' || substr(md5(random()::text), 1, 4))) RETURNING id, access_code, is_active, created_at',
  param_mapping = '{"$1": "context.tenantId", "$2": "context.userId"}'::jsonb
WHERE option_id = 'citizen.access.create' AND name = 'create_access_code';
