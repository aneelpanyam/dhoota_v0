-- 085: Add avatar_url to get_public_profile for public.about
UPDATE sql_templates
SET sql = 'SELECT u.display_name, u.avatar_url, psc.welcome_message, psc.side_panel_content FROM users u LEFT JOIN public_site_configs psc ON u.id = psc.user_id AND psc.tenant_id = $1 WHERE u.id = $2 AND u.tenant_id = $1 AND u.deleted_at IS NULL'
WHERE option_id = 'public.about' AND name = 'get_public_profile';
