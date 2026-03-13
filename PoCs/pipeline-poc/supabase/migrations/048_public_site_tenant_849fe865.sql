-- ============================================
-- 048: Public site setup for tenant 849fe865
-- Welcome message, info cards, feature flag.
-- Tenant: 849fe865-848e-4447-9bae-5d6a4301ddf5
-- Representative: 5d4ba89b-3365-4625-a846-d9f13d9e2ba7
-- ============================================

-- Enable public_site_enabled for the tenant
INSERT INTO tenant_feature_flags (tenant_id, flag_key, enabled)
VALUES ('849fe865-848e-4447-9bae-5d6a4301ddf5'::uuid, 'public_site_enabled', true)
ON CONFLICT (tenant_id, flag_key) DO UPDATE SET enabled = true, updated_at = now();

-- Upsert public_site_configs (welcome message + enabled options)
INSERT INTO public_site_configs (tenant_id, user_id, welcome_message, enabled_option_ids)
VALUES (
  '849fe865-848e-4447-9bae-5d6a4301ddf5'::uuid,
  '5d4ba89b-3365-4625-a846-d9f13d9e2ba7'::uuid,
  'Welcome! Here you can explore my activities and statistics. Feel free to browse or ask me anything.',
  ARRAY['public.activities', 'public.stats', 'public.announcements', 'public.info_cards', 'public.about']
)
ON CONFLICT (tenant_id, user_id) DO UPDATE SET
  welcome_message = EXCLUDED.welcome_message,
  enabled_option_ids = EXCLUDED.enabled_option_ids,
  updated_at = now();

-- Create sample info cards (about + contact)
INSERT INTO info_cards (tenant_id, created_by, title, content, card_type, visibility, display_order)
VALUES
  ('849fe865-848e-4447-9bae-5d6a4301ddf5'::uuid, '5d4ba89b-3365-4625-a846-d9f13d9e2ba7'::uuid,
   'About', '{"description": "Your representative profile and mission.", "points": ["Transparency", "Community engagement"]}'::jsonb,
   'about', 'public', 0),
  ('849fe865-848e-4447-9bae-5d6a4301ddf5'::uuid, '5d4ba89b-3365-4625-a846-d9f13d9e2ba7'::uuid,
   'Contact', '{"email": "contact@example.com", "phone": "+1 234 567 8900"}'::jsonb,
   'contact', 'public', 1);
