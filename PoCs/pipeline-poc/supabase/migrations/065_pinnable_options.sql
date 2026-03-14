-- ============================================
-- 065: Add pinnable_items and pinnable_collection to option_definitions
-- Only options that return activities, programs, or tenants are pinnable.
-- Default false = opt-in.
-- ============================================

ALTER TABLE option_definitions
  ADD COLUMN IF NOT EXISTS pinnable_items boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinnable_collection boolean DEFAULT false;

-- Activities
UPDATE option_definitions SET pinnable_items = true, pinnable_collection = true
WHERE id IN (
  'activity.list', 'analysis.activities', 'analysis.specific_activity',
  'activity.view', 'activity.create', 'activity.edit', 'activity.create_bulk','public.activities'
);

-- Programs
UPDATE option_definitions SET pinnable_items = true, pinnable_collection = true
WHERE id IN ('program.list', 'program.view','public.programs');

-- Tenants (admin)
UPDATE option_definitions SET pinnable_items = true, pinnable_collection = true
WHERE id = 'admin.tenant.list';
