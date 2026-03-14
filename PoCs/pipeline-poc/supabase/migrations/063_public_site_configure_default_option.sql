-- 063: Add Configure Public Site to default options for representatives
-- So "Configure Public Site" (welcome message, site title) appears in the "What would you like to do?" menu
-- when the tenant has public_site_enabled.

UPDATE user_type_configs
SET default_option_ids = array_append(default_option_ids, 'public_site.configure')
WHERE user_type IN ('worker', 'candidate', 'representative')
  AND NOT ('public_site.configure' = ANY(default_option_ids));

update user_type_configs
set 
init_option_ids = array['public.announcements', 'public.activities','public.stats']::text[],
default_option_ids = array['public.activities','public.stats','public.about','public.suggestion.submit','public.suggestion.list','public.programs']::text[]
where user_type='citizen';


update option_definitions
set follow_up_option_ids = Array[]::text[]
where id = 'public.announcements'