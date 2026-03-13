-- ============================================
-- 050: Fix welcome message for public site
-- Replace "ask me" with neutral "ask questions"
-- Tenant: 849fe865 (from 048)
-- ============================================

UPDATE public_site_configs
SET welcome_message = 'Welcome! Here you can explore activities and statistics. Feel free to browse or ask questions.'
WHERE tenant_id = '849fe865-848e-4447-9bae-5d6a4301ddf5'::uuid
  AND user_id = '5d4ba89b-3365-4625-a846-d9f13d9e2ba7'::uuid;
