-- Gate all program.* and public.programs options behind the 'programs_enabled' feature flag.
-- Tenants must have this flag enabled to see program options.

UPDATE option_definitions
SET required_toggles = ARRAY['programs_enabled']
WHERE id IN (
  'program.create',
  'program.list',
  'program.view',
  'program.edit',
  'program.add_activity',
  'program.remove_activity',
  'program.delete',
  'public.programs'
);
