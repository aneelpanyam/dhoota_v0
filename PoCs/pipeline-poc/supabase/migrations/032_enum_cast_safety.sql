-- Add 'free' to subscription_level enum (referenced by option definitions but missing from enum)
ALTER TYPE subscription_level ADD VALUE IF NOT EXISTS 'free' BEFORE 'basic';

-- Fix enum cast safety for all admin write operations that use enum columns

-- admin.tenant.create: cast $3 to subscription_level enum
UPDATE sql_templates SET
  sql = 'INSERT INTO tenants (name, slug, subscription) VALUES ($1, $2, COALESCE($3::subscription_level, ''basic''::subscription_level)) RETURNING *'
WHERE option_id = 'admin.tenant.create' AND name = 'insert_tenant';

-- admin.tenant.edit: cast $3 to subscription_level enum
UPDATE sql_templates SET
  sql = 'UPDATE tenants SET name = COALESCE($2, name), subscription = COALESCE($3::subscription_level, subscription), custom_domain = COALESCE($4, custom_domain), updated_at = now() WHERE id = resolve_tenant_id($1) RETURNING *'
WHERE option_id = 'admin.tenant.edit' AND name = 'update_tenant';

-- admin.user.provision: cast $4 to user_type enum
UPDATE sql_templates SET
  sql = 'INSERT INTO users (tenant_id, email, display_name, user_type, access_code) VALUES ($1, $2, $3, $4::user_type, $5) RETURNING id, email, display_name, user_type, access_code, created_at'
WHERE option_id = 'admin.user.provision' AND name = 'insert_user';

-- admin.subscription.manage: cast $2 to subscription_level enum
UPDATE sql_templates SET
  sql = 'UPDATE tenants SET subscription = $2::subscription_level, updated_at = now() WHERE id = resolve_tenant_id($1) RETURNING *'
WHERE option_id = 'admin.subscription.manage' AND name = 'update_subscription';
