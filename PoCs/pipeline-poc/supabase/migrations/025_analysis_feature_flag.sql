-- Gate all analysis.* options behind the 'analysis_enabled' feature flag.
-- Tenants must have this flag enabled to see analysis options.

UPDATE option_definitions
SET required_toggles = ARRAY['analysis_enabled']
WHERE id IN (
  'analysis.activities',
  'analysis.tags',
  'analysis.timeline',
  'analysis.notes',
  'analysis.specific_activity'
);
