-- 022_programs.sql
-- Replaces the minimal "Plan" (single future task) with "Program"
-- (date-ranged initiative containing a calendar of activities).

-- ============================================================
-- 1. New enum for program status
-- ============================================================

CREATE TYPE program_status AS ENUM ('draft', 'active', 'completed', 'archived');

-- ============================================================
-- 2. Rename activity_plans -> programs and reshape columns
-- ============================================================

ALTER TABLE activity_plans RENAME TO programs;

-- Drop the old single-link and reminder columns
ALTER TABLE programs DROP COLUMN IF EXISTS linked_activity_id;
ALTER TABLE programs DROP COLUMN IF EXISTS planned_date;
ALTER TABLE programs DROP COLUMN IF EXISTS reminders;

-- Add new program columns
ALTER TABLE programs ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS visibility activity_visibility NOT NULL DEFAULT 'private';
ALTER TABLE programs ADD COLUMN IF NOT EXISTS ai_summary jsonb;

-- Migrate status from plan_status to program_status
ALTER TABLE programs ADD COLUMN IF NOT EXISTS new_status program_status NOT NULL DEFAULT 'draft';

UPDATE programs SET new_status = CASE
  WHEN status::text = 'draft'     THEN 'draft'::program_status
  WHEN status::text = 'scheduled' THEN 'active'::program_status
  WHEN status::text = 'completed' THEN 'completed'::program_status
  ELSE 'draft'::program_status
END;

ALTER TABLE programs DROP COLUMN status;
ALTER TABLE programs RENAME COLUMN new_status TO status;

-- Rename old indexes
ALTER INDEX IF EXISTS idx_activity_plans_user RENAME TO idx_programs_user;
ALTER INDEX IF EXISTS idx_activity_plans_tenant RENAME TO idx_programs_tenant;

-- ============================================================
-- 3. New join table: program_activities
-- ============================================================

CREATE TABLE program_activities (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id      uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    activity_id     uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    sequence_order  int NOT NULL DEFAULT 0,
    planned_date    date,
    milestone_label text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (program_id, activity_id)
);

CREATE INDEX idx_program_activities_program ON program_activities(program_id);
CREATE INDEX idx_program_activities_activity ON program_activities(activity_id);

-- ============================================================
-- 4. Deactivate old plan.* options (keep rows for FK safety)
-- ============================================================

UPDATE option_definitions SET is_active = false WHERE id IN ('plan.create', 'plan.list', 'plan.edit');

-- ============================================================
-- 5. New program.* option definitions
-- ============================================================

INSERT INTO option_definitions (
  id, name, description, category, icon, keywords, user_types, required_toggles,
  show_in_defaults, default_priority, accepts_files, input_schema,
  summary_prompt, follow_up_option_ids,
  target_widget, requires_confirmation, skip_refinement, entity_type
) VALUES

('program.create', 'Create Program', 'Create a program with a date range and planned activities.',
 'planning', 'CalendarPlus',
 ARRAY['program', 'create program', 'new program', 'initiative', 'schedule'],
 ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[],
 false, 48, false,
 '{"type":"object","properties":{"title":{"type":"string"},"description":{"type":"string"},"start_date":{"type":"string","format":"date"},"end_date":{"type":"string","format":"date"},"visibility":{"type":"string","enum":["private","team","public"]}},"required":["title"]}'::jsonb,
 'Confirm the program was created. Show the program details and date range.',
 ARRAY['program.list', 'program.add_activity'],
 'text_response', true, true, 'program'),

('program.list', 'View Programs', 'View your programs with progress tracking.',
 'planning', 'Calendar',
 ARRAY['programs', 'my programs', 'view programs', 'list programs', 'initiatives'],
 ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[],
 true, 49, false,
 '{"type":"object","properties":{"status":{"type":"string","enum":["draft","active","completed","archived"]},"page":{"type":"integer","default":1},"pageSize":{"type":"integer","default":10}}}'::jsonb,
 'Show programs as a data_list with title, date range, status, and progress.',
 ARRAY['program.create', 'program.view', 'program.edit'],
 'data_list', false, true, 'program'),

('program.view', 'View Program Details', 'View a program with its activity calendar and progress.',
 'planning', 'CalendarDays',
 ARRAY['view program', 'program details', 'program calendar'],
 ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[],
 false, 100, false,
 '{"type":"object","properties":{"program_id":{"type":"string"}},"required":["program_id"]}'::jsonb,
 'Show the program details and its activity calendar with progress.',
 ARRAY['program.edit', 'program.add_activity', 'program.remove_activity', 'program.list'],
 'data_list', false, true, 'program'),

('program.edit', 'Edit Program', 'Update program title, dates, description, status, or visibility.',
 'planning', 'Pencil',
 ARRAY['edit program', 'update program', 'change program'],
 ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[],
 false, 100, false,
 '{"type":"object","properties":{"program_id":{"type":"string"},"title":{"type":"string"},"description":{"type":"string"},"start_date":{"type":"string","format":"date"},"end_date":{"type":"string","format":"date"},"status":{"type":"string","enum":["draft","active","completed","archived"]},"visibility":{"type":"string","enum":["private","team","public"]}},"required":["program_id"]}'::jsonb,
 'Show the updated program. Summarize what changed.',
 ARRAY['program.view', 'program.list'],
 'text_response', true, true, 'program'),

('program.add_activity', 'Add Activity to Program', 'Create a new activity inside a program or link an existing one.',
 'planning', 'PlusCircle',
 ARRAY['add activity', 'add to program', 'schedule activity', 'new milestone'],
 ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[],
 false, 100, false,
 '{"type":"object","properties":{"program_id":{"type":"string"},"title":{"type":"string"},"description":{"type":"string"},"planned_date":{"type":"string","format":"date"},"milestone_label":{"type":"string"},"location":{"type":"string"},"status":{"type":"string","enum":["planned","in_progress","completed"]}},"required":["program_id","title"]}'::jsonb,
 'Confirm the activity was added to the program. Show its position in the calendar.',
 ARRAY['program.view', 'program.add_activity'],
 'text_response', true, true, 'program'),

('program.remove_activity', 'Remove Activity from Program', 'Unlink an activity from a program (does not delete the activity).',
 'planning', 'MinusCircle',
 ARRAY['remove activity', 'unlink activity', 'remove from program'],
 ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[],
 false, 100, false,
 '{"type":"object","properties":{"program_id":{"type":"string"},"activity_id":{"type":"string"}},"required":["program_id","activity_id"]}'::jsonb,
 'Confirm the activity was removed from the program.',
 ARRAY['program.view'],
 'text_response', true, true, 'program'),

('program.delete', 'Delete Program', 'Soft-delete a program (activities are kept).',
 'planning', 'Trash2',
 ARRAY['delete program', 'remove program', 'archive program'],
 ARRAY['worker', 'candidate', 'representative'], ARRAY[]::text[],
 false, 100, false,
 '{"type":"object","properties":{"program_id":{"type":"string"}},"required":["program_id"]}'::jsonb,
 'Confirm the program was deleted.',
 ARRAY['program.list'],
 'text_response', true, true, 'program'),

('public.programs', 'View Programs', 'View public programs for this representative.',
 'public', 'Calendar',
 ARRAY['programs', 'initiatives', 'plans'],
 ARRAY['citizen'], ARRAY[]::text[],
 true, 28, false,
 '{"type":"object","properties":{"page":{"type":"integer","default":1},"pageSize":{"type":"integer","default":20}}}'::jsonb,
 'Show public programs with progress.',
 ARRAY[]::text[],
 'data_list', false, true, 'program');

-- ============================================================
-- 6. SQL templates for program options
-- ============================================================

-- program.create
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('program.create', 'insert_program',
 'INSERT INTO programs (tenant_id, user_id, title, description, start_date, end_date, visibility) VALUES ($1, $2, $3, $4, $5::date, $6::date, COALESCE($7::activity_visibility, ''private''::activity_visibility)) RETURNING *',
 '{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.title", "$4": "params.description", "$5": "params.start_date", "$6": "params.end_date", "$7": "params.visibility"}'::jsonb,
 0, 'write');

-- program.list
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('program.list', 'list_programs',
 'SELECT p.id, p.title, p.description, p.start_date, p.end_date, p.status::text, p.visibility::text, p.created_at, (SELECT count(*) FROM program_activities pa JOIN activities a ON pa.activity_id = a.id WHERE pa.program_id = p.id AND a.deleted_at IS NULL) as total_activities, (SELECT count(*) FROM program_activities pa JOIN activities a ON pa.activity_id = a.id WHERE pa.program_id = p.id AND a.status = ''completed'' AND a.deleted_at IS NULL) as completed_activities FROM programs p WHERE p.tenant_id = $1 AND p.user_id = $2 AND p.deleted_at IS NULL AND ($3::text IS NULL OR p.status::text = $3) ORDER BY p.start_date ASC NULLS LAST, p.created_at DESC LIMIT $4 OFFSET $5',
 '{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.status", "$4": "params.pageSize", "$5": "params.offset"}'::jsonb,
 0, 'read');

-- program.view: template 1 - program details
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('program.view', 'get_program',
 'SELECT p.id, p.title, p.description, p.start_date, p.end_date, p.status::text, p.visibility::text, p.ai_summary, p.created_at, p.updated_at, (SELECT count(*) FROM program_activities pa JOIN activities a ON pa.activity_id = a.id WHERE pa.program_id = p.id AND a.deleted_at IS NULL) as total_activities, (SELECT count(*) FROM program_activities pa JOIN activities a ON pa.activity_id = a.id WHERE pa.program_id = p.id AND a.status = ''completed'' AND a.deleted_at IS NULL) as completed_activities FROM programs p WHERE p.id = $1 AND p.tenant_id = $2 AND p.deleted_at IS NULL',
 '{"$1": "params.program_id", "$2": "context.tenantId"}'::jsonb,
 0, 'read');

-- program.view: template 2 - activity calendar
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('program.view', 'get_program_activities',
 'SELECT a.id, a.title, a.description, a.status::text, a.activity_date, a.location, pa.sequence_order, pa.planned_date, pa.milestone_label FROM program_activities pa JOIN activities a ON pa.activity_id = a.id WHERE pa.program_id = $1 AND a.deleted_at IS NULL ORDER BY pa.sequence_order ASC, pa.planned_date ASC NULLS LAST',
 '{"$1": "params.program_id"}'::jsonb,
 1, 'read');

-- program.edit
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('program.edit', 'update_program',
 'UPDATE programs SET title = COALESCE($3, title), description = COALESCE($4, description), start_date = COALESCE($5::date, start_date), end_date = COALESCE($6::date, end_date), status = COALESCE($7::program_status, status), visibility = COALESCE($8::activity_visibility, visibility), updated_at = now() WHERE id = $1 AND tenant_id = $2 AND user_id = $9 AND deleted_at IS NULL RETURNING *',
 '{"$1": "params.program_id", "$2": "context.tenantId", "$3": "params.title", "$4": "params.description", "$5": "params.start_date", "$6": "params.end_date", "$7": "params.status", "$8": "params.visibility", "$9": "context.userId"}'::jsonb,
 0, 'write');

-- program.add_activity: step 1 - create the activity
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('program.add_activity', 'create_activity',
 'INSERT INTO activities (tenant_id, created_by, title, description, status, activity_date, location) VALUES ($1, $2, $3, $4, COALESCE($5, ''planned'')::activity_status, COALESCE($6::timestamptz, now()), $7) RETURNING id, title, status::text, activity_date',
 '{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.title", "$4": "params.description", "$5": "params.status", "$6": "params.planned_date", "$7": "params.location"}'::jsonb,
 0, 'write');

-- program.add_activity: step 2 - link to program
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('program.add_activity', 'link_to_program',
 'INSERT INTO program_activities (program_id, activity_id, planned_date, milestone_label, sequence_order) VALUES ($1, (SELECT id FROM activities WHERE tenant_id = $2 AND created_by = $3 ORDER BY created_at DESC LIMIT 1), $4::date, $5, COALESCE((SELECT MAX(sequence_order) + 1 FROM program_activities WHERE program_id = $1), 0)) RETURNING *',
 '{"$1": "params.program_id", "$2": "context.tenantId", "$3": "context.userId", "$4": "params.planned_date", "$5": "params.milestone_label"}'::jsonb,
 1, 'write');

-- program.remove_activity
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('program.remove_activity', 'unlink_activity',
 'DELETE FROM program_activities WHERE program_id = $1 AND activity_id = $2 RETURNING program_id, activity_id',
 '{"$1": "params.program_id", "$2": "params.activity_id"}'::jsonb,
 0, 'write');

-- program.delete
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('program.delete', 'soft_delete_program',
 'UPDATE programs SET deleted_at = now() WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND deleted_at IS NULL RETURNING id, title',
 '{"$1": "params.program_id", "$2": "context.tenantId", "$3": "context.userId"}'::jsonb,
 0, 'write');

-- public.programs
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('public.programs', 'list_public_programs',
 'SELECT p.id, p.title, p.description, p.start_date, p.end_date, p.status::text, p.created_at, (SELECT count(*) FROM program_activities pa JOIN activities a ON pa.activity_id = a.id WHERE pa.program_id = p.id AND a.deleted_at IS NULL) as total_activities, (SELECT count(*) FROM program_activities pa JOIN activities a ON pa.activity_id = a.id WHERE pa.program_id = p.id AND a.status = ''completed'' AND a.deleted_at IS NULL) as completed_activities FROM programs p WHERE p.tenant_id = $1 AND p.user_id = $2 AND p.visibility = ''public'' AND p.deleted_at IS NULL ORDER BY p.start_date ASC NULLS LAST LIMIT LEAST($3, 50) OFFSET $4',
 '{"$1": "context.tenantId", "$2": "context.scopedUserId", "$3": "params.pageSize", "$4": "params.offset"}'::jsonb,
 0, 'read');

-- ============================================================
-- 7. Option questions for program options
-- ============================================================

-- program.create
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('program.create', 'What is the program called?', 'title', 0, true, NULL, '{"placeholder":"Program title"}'::jsonb, true),
('program.create', 'Describe the program', 'description', 1, false, NULL, '{"placeholder":"What is this program about?"}'::jsonb, false),
('program.create', 'Start date?', 'start_date', 2, false, 'date_picker', '{}'::jsonb, true),
('program.create', 'End date?', 'end_date', 3, false, 'date_picker', '{}'::jsonb, true),
('program.create', 'Visibility?', 'visibility', 4, false, 'select', '{"options":["private","team","public"],"default":"private"}'::jsonb, true);

-- program.edit
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('program.edit', 'Which program?', 'program_id', 0, true, NULL, '{"placeholder":"Program ID"}'::jsonb, false),
('program.edit', 'New title? (leave blank to keep current)', 'title', 1, false, NULL, '{"placeholder":"Program title"}'::jsonb, true),
('program.edit', 'New description?', 'description', 2, false, NULL, '{"placeholder":"Description"}'::jsonb, true),
('program.edit', 'New start date?', 'start_date', 3, false, 'date_picker', '{}'::jsonb, true),
('program.edit', 'New end date?', 'end_date', 4, false, 'date_picker', '{}'::jsonb, true),
('program.edit', 'Status?', 'status', 5, false, 'select', '{"options":["draft","active","completed","archived"],"placeholder":"Keep current"}'::jsonb, true),
('program.edit', 'Visibility?', 'visibility', 6, false, 'select', '{"options":["private","team","public"],"placeholder":"Keep current"}'::jsonb, true);

-- program.add_activity
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('program.add_activity', 'Which program?', 'program_id', 0, true, NULL, '{"placeholder":"Program ID"}'::jsonb, false),
('program.add_activity', 'Activity title?', 'title', 1, true, NULL, '{"placeholder":"Activity title"}'::jsonb, true),
('program.add_activity', 'Activity description?', 'description', 2, false, NULL, '{"placeholder":"Description"}'::jsonb, false),
('program.add_activity', 'Planned date for this activity?', 'planned_date', 3, false, 'date_picker', '{}'::jsonb, true),
('program.add_activity', 'Milestone label? (e.g. Kickoff, Review)', 'milestone_label', 4, false, NULL, '{"placeholder":"Optional milestone label"}'::jsonb, true),
('program.add_activity', 'Location?', 'location', 5, false, NULL, '{"placeholder":"Location"}'::jsonb, true);

-- program.remove_activity
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('program.remove_activity', 'Which program?', 'program_id', 0, true, NULL, '{"placeholder":"Program ID"}'::jsonb, false),
('program.remove_activity', 'Which activity to remove?', 'activity_id', 1, true, NULL, '{"placeholder":"Activity ID"}'::jsonb, false);

-- program.delete
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('program.delete', 'Which program to delete?', 'program_id', 0, true, NULL, '{"placeholder":"Program ID"}'::jsonb, false);

-- ============================================================
-- 8. Update user_type_configs: replace plan.* with program.*
-- ============================================================

-- Remove old plan.* from available and default option IDs
UPDATE user_type_configs SET
  available_option_ids = array_remove(array_remove(array_remove(available_option_ids, 'plan.create'), 'plan.list'), 'plan.edit'),
  default_option_ids = array_remove(default_option_ids, 'plan.list')
WHERE user_type IN ('worker', 'candidate', 'representative');

-- Add new program.* options
UPDATE user_type_configs SET
  available_option_ids = array_cat(available_option_ids, ARRAY[
    'program.create', 'program.list', 'program.view', 'program.edit',
    'program.add_activity', 'program.remove_activity', 'program.delete'
  ]),
  default_option_ids = array_cat(default_option_ids, ARRAY['program.list'])
WHERE user_type IN ('worker', 'candidate', 'representative');

-- Add public.programs to citizen config
UPDATE user_type_configs SET
  available_option_ids = array_cat(available_option_ids, ARRAY['public.programs']),
  default_option_ids = array_cat(default_option_ids, ARRAY['public.programs'])
WHERE user_type = 'citizen';

-- Remove old plan.* SQL templates (cleaned up; old options are deactivated)
DELETE FROM sql_templates WHERE option_id IN ('plan.create', 'plan.list', 'plan.edit');

-- Remove old plan.* option questions
DELETE FROM option_questions WHERE option_id IN ('plan.create', 'plan.list', 'plan.edit');
