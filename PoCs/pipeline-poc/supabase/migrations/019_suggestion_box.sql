-- ============================================
-- 019: Suggestion Box
-- Tables, options, and SQL templates for the
-- suggestion box feature. Includes citizen
-- profiles, access codes, groups, suggestion
-- boxes, suggestions, and suggestion notes.
-- ============================================

-- ============================================
-- New enums
-- ============================================

CREATE TYPE suggestion_status AS ENUM ('new', 'read', 'in_progress', 'resolved', 'closed');
CREATE TYPE suggestion_author_type AS ENUM ('citizen', 'user');

-- ============================================
-- Tables
-- ============================================

CREATE TABLE citizen_profiles (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mobile_number   text NOT NULL UNIQUE,
    display_name    text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE citizen_access (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    citizen_id      uuid REFERENCES citizen_profiles(id),
    tenant_id       uuid NOT NULL REFERENCES tenants(id),
    user_id         uuid NOT NULL REFERENCES users(id),
    access_code     text NOT NULL,
    mobile_number   text,
    is_active       boolean NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now(),
    revoked_at      timestamptz,
    UNIQUE(tenant_id, access_code)
);

CREATE INDEX idx_citizen_access_tenant ON citizen_access(tenant_id);
CREATE INDEX idx_citizen_access_user ON citizen_access(user_id);
CREATE INDEX idx_citizen_access_citizen ON citizen_access(citizen_id);
CREATE INDEX idx_citizen_access_mobile ON citizen_access(mobile_number, tenant_id) WHERE is_active = true;

CREATE TABLE citizen_groups (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id),
    created_by      uuid NOT NULL REFERENCES users(id),
    name            text NOT NULL,
    description     text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz
);

CREATE INDEX idx_citizen_groups_tenant ON citizen_groups(tenant_id);

CREATE TABLE citizen_group_members (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id            uuid NOT NULL REFERENCES citizen_groups(id) ON DELETE CASCADE,
    citizen_access_id   uuid NOT NULL REFERENCES citizen_access(id) ON DELETE CASCADE,
    added_at            timestamptz NOT NULL DEFAULT now(),
    UNIQUE(group_id, citizen_access_id)
);

CREATE TABLE suggestion_boxes (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id),
    created_by          uuid NOT NULL REFERENCES users(id),
    title               text NOT NULL,
    description         text,
    is_active           boolean NOT NULL DEFAULT true,
    allowed_group_ids   uuid[] DEFAULT '{}',
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    deleted_at          timestamptz
);

CREATE INDEX idx_suggestion_boxes_tenant ON suggestion_boxes(tenant_id);
CREATE INDEX idx_suggestion_boxes_created_by ON suggestion_boxes(created_by);

CREATE TABLE suggestions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    suggestion_box_id   uuid NOT NULL REFERENCES suggestion_boxes(id),
    tenant_id           uuid NOT NULL REFERENCES tenants(id),
    citizen_id          uuid NOT NULL REFERENCES citizen_profiles(id),
    content             text NOT NULL,
    status              suggestion_status NOT NULL DEFAULT 'new',
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    deleted_at          timestamptz
);

CREATE INDEX idx_suggestions_box ON suggestions(suggestion_box_id, created_at DESC);
CREATE INDEX idx_suggestions_citizen ON suggestions(citizen_id);
CREATE INDEX idx_suggestions_tenant ON suggestions(tenant_id);

CREATE TABLE suggestion_notes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    suggestion_id   uuid NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
    tenant_id       uuid NOT NULL REFERENCES tenants(id),
    author_type     suggestion_author_type NOT NULL,
    author_id       uuid NOT NULL,
    content         text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz
);

CREATE INDEX idx_suggestion_notes_suggestion ON suggestion_notes(suggestion_id, created_at);

-- ============================================
-- Tenant User Options (managing suggestion box)
-- ============================================

INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, response_prompt, follow_up_option_ids) VALUES

('citizen.access.create', 'Create Access Code', 'Generate a new citizen access code for the suggestion box.', 'suggestion_box', 'Key', ARRAY['access code', 'create code', 'new code', 'citizen code'], ARRAY['worker', 'candidate', 'representative'], ARRAY['suggestion_box_enabled'], false, 60, false,
'{"type":"object","properties":{"count":{"type":"integer","default":1}}}'::jsonb,
'Show the generated access code(s). Remind the user to assign a mobile number before sharing.',
ARRAY['citizen.access.assign', 'citizen.access.list']),

('citizen.access.assign', 'Assign Mobile Number', 'Assign a mobile number to an existing access code to activate it.', 'suggestion_box', 'Smartphone', ARRAY['assign mobile', 'activate code', 'assign number', 'link mobile'], ARRAY['worker', 'candidate', 'representative'], ARRAY['suggestion_box_enabled'], false, 61, false,
'{"type":"object","properties":{"access_code_id":{"type":"string"},"mobile_number":{"type":"string"}},"required":["access_code_id","mobile_number"]}'::jsonb,
'Confirm the mobile number was assigned and the access code is now active.',
ARRAY['citizen.access.list']),

('citizen.access.list', 'View Access Codes', 'List all citizen access codes with assignment status and group memberships.', 'suggestion_box', 'List', ARRAY['list codes', 'view codes', 'access codes', 'citizen codes'], ARRAY['worker', 'candidate', 'representative'], ARRAY['suggestion_box_enabled'], true, 62, false,
'{"type":"object","properties":{"page":{"type":"integer","default":1},"pageSize":{"type":"integer","default":20},"is_active":{"type":"boolean"}}}'::jsonb,
'Show access codes as a data_list with columns for code, mobile number, active status, assigned groups, and creation date.',
ARRAY['citizen.access.create', 'citizen.access.assign']),

('citizen.access.revoke', 'Revoke Access', 'Deactivate a citizen access code.', 'suggestion_box', 'ShieldOff', ARRAY['revoke access', 'deactivate code', 'remove access'], ARRAY['worker', 'candidate', 'representative'], ARRAY['suggestion_box_enabled'], false, 100, false,
'{"type":"object","properties":{"access_code_id":{"type":"string"}},"required":["access_code_id"]}'::jsonb,
'Confirm the access code has been revoked.',
ARRAY['citizen.access.list']),

('citizen.access.regenerate', 'Regenerate Access Code', 'Generate a new code for a citizen, invalidating the old one.', 'suggestion_box', 'RefreshCw', ARRAY['regenerate code', 'new code', 'replace code'], ARRAY['worker', 'candidate', 'representative'], ARRAY['suggestion_box_enabled'], false, 100, false,
'{"type":"object","properties":{"access_code_id":{"type":"string"}},"required":["access_code_id"]}'::jsonb,
'Show the new access code. Remind the user to share it with the citizen.',
ARRAY['citizen.access.list']),

('citizen.group.create', 'Create Citizen Group', 'Create a group to organize suggestors (e.g., "Ward 5 Residents").', 'suggestion_box', 'Users', ARRAY['create group', 'new group', 'citizen group'], ARRAY['worker', 'candidate', 'representative'], ARRAY['suggestion_box_enabled'], false, 63, false,
'{"type":"object","properties":{"name":{"type":"string"},"description":{"type":"string"}},"required":["name"]}'::jsonb,
'Confirm the group was created.',
ARRAY['citizen.group.list']),

('citizen.group.list', 'View Citizen Groups', 'List groups with member counts.', 'suggestion_box', 'Users', ARRAY['list groups', 'view groups', 'citizen groups'], ARRAY['worker', 'candidate', 'representative'], ARRAY['suggestion_box_enabled'], false, 64, false,
'{"type":"object","properties":{"page":{"type":"integer","default":1},"pageSize":{"type":"integer","default":20}}}'::jsonb,
'Show groups as a data_list with name, description, and member count.',
ARRAY['citizen.group.create', 'citizen.group.edit']),

('citizen.group.edit', 'Edit Citizen Group', 'Rename group, add or remove members.', 'suggestion_box', 'Pencil', ARRAY['edit group', 'update group', 'manage members'], ARRAY['worker', 'candidate', 'representative'], ARRAY['suggestion_box_enabled'], false, 100, false,
'{"type":"object","properties":{"group_id":{"type":"string"},"name":{"type":"string"},"description":{"type":"string"},"add_member_ids":{"type":"array","items":{"type":"string"}},"remove_member_ids":{"type":"array","items":{"type":"string"}}},"required":["group_id"]}'::jsonb,
'Show the updated group with current members.',
ARRAY['citizen.group.list']),

('suggestion_box.create', 'Create Suggestion Box', 'Create a suggestion box, optionally restrict to specific citizen groups.', 'suggestion_box', 'MessageSquarePlus', ARRAY['create suggestion box', 'new suggestion box', 'add suggestion box'], ARRAY['worker', 'candidate', 'representative'], ARRAY['suggestion_box_enabled'], true, 65, false,
'{"type":"object","properties":{"title":{"type":"string"},"description":{"type":"string"},"allowed_group_ids":{"type":"array","items":{"type":"string"}}},"required":["title"]}'::jsonb,
'Confirm the suggestion box was created. Show the title and any group restrictions.',
ARRAY['suggestion_box.list']),

('suggestion_box.list', 'View Suggestion Boxes', 'List suggestion boxes with suggestion counts.', 'suggestion_box', 'MessageSquare', ARRAY['list suggestion boxes', 'view suggestion boxes', 'my suggestion boxes'], ARRAY['worker', 'candidate', 'representative'], ARRAY['suggestion_box_enabled'], true, 66, false,
'{"type":"object","properties":{"page":{"type":"integer","default":1},"pageSize":{"type":"integer","default":20}}}'::jsonb,
'Show suggestion boxes as a data_list with title, active status, suggestion count, and group restrictions.',
ARRAY['suggestion_box.create', 'suggestion.list']),

('suggestion_box.edit', 'Edit Suggestion Box', 'Update title, description, allowed groups, or activate/deactivate.', 'suggestion_box', 'Pencil', ARRAY['edit suggestion box', 'update suggestion box'], ARRAY['worker', 'candidate', 'representative'], ARRAY['suggestion_box_enabled'], false, 100, false,
'{"type":"object","properties":{"suggestion_box_id":{"type":"string"},"title":{"type":"string"},"description":{"type":"string"},"is_active":{"type":"boolean"},"allowed_group_ids":{"type":"array","items":{"type":"string"}}},"required":["suggestion_box_id"]}'::jsonb,
'Show the updated suggestion box.',
ARRAY['suggestion_box.list']),

('suggestion.list', 'View Suggestions', 'View suggestions from citizens, filterable by box, status, or citizen.', 'suggestion_box', 'MessageCircle', ARRAY['view suggestions', 'list suggestions', 'citizen suggestions', 'feedback'], ARRAY['worker', 'candidate', 'representative'], ARRAY['suggestion_box_enabled'], false, 67, false,
'{"type":"object","properties":{"suggestion_box_id":{"type":"string"},"status":{"type":"string","enum":["new","read","in_progress","resolved","closed"]},"page":{"type":"integer","default":1},"pageSize":{"type":"integer","default":20}}}'::jsonb,
'Show suggestions as a data_list with content preview, status, citizen mobile number, and creation date.',
ARRAY['suggestion.respond']),

('suggestion.respond', 'Respond to Suggestion', 'Add a note to a suggestion and update its status.', 'suggestion_box', 'Reply', ARRAY['respond suggestion', 'reply suggestion', 'note suggestion'], ARRAY['worker', 'candidate', 'representative'], ARRAY['suggestion_box_enabled'], false, 100, false,
'{"type":"object","properties":{"suggestion_id":{"type":"string"},"content":{"type":"string"},"status":{"type":"string","enum":["read","in_progress","resolved","closed"]}},"required":["suggestion_id","content"]}'::jsonb,
'Show the suggestion with the new note added. Update the status if changed.',
ARRAY['suggestion.list']);

-- ============================================
-- Citizen Options (on public site)
-- ============================================

INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, response_prompt, follow_up_option_ids) VALUES

('public.suggestion.submit', 'Submit Suggestion', 'Submit a suggestion to a suggestion box. Requires mobile number and access code.', 'public', 'MessageSquarePlus', ARRAY['suggest', 'suggestion', 'submit suggestion', 'feedback', 'idea'], ARRAY['citizen'], ARRAY['suggestion_box_enabled'], true, 30, false,
'{"type":"object","properties":{"mobile_number":{"type":"string"},"access_code":{"type":"string"},"suggestion_box_id":{"type":"string"},"content":{"type":"string"}},"required":["mobile_number","access_code","content"]}'::jsonb,
'Confirm the suggestion was submitted. Thank the citizen for their feedback.',
ARRAY['public.suggestion.list']),

('public.suggestion.list', 'View My Suggestions', 'View your submitted suggestions and responses. Requires mobile number and access code.', 'public', 'MessageCircle', ARRAY['my suggestions', 'view suggestions', 'suggestion status'], ARRAY['citizen'], ARRAY['suggestion_box_enabled'], true, 31, false,
'{"type":"object","properties":{"mobile_number":{"type":"string"},"access_code":{"type":"string"}},"required":["mobile_number","access_code"]}'::jsonb,
'Show the citizen''s suggestions with status and any responses from the representative.',
ARRAY['public.suggestion.submit']);

-- ============================================
-- SQL Templates
-- ============================================

-- citizen.access.create
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('citizen.access.create', 'create_access_code',
'INSERT INTO citizen_access (tenant_id, user_id, access_code) VALUES ($1, $2, $3) RETURNING id, access_code, is_active, created_at',
'{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.access_code"}'::jsonb,
0, 'write');

-- citizen.access.assign
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('citizen.access.assign', 'assign_mobile',
'WITH profile AS (INSERT INTO citizen_profiles (mobile_number) VALUES ($3) ON CONFLICT (mobile_number) DO UPDATE SET updated_at = now() RETURNING id) UPDATE citizen_access SET mobile_number = $3, citizen_id = (SELECT id FROM profile), is_active = true WHERE id = $1 AND tenant_id = $2 RETURNING *',
'{"$1": "params.access_code_id", "$2": "context.tenantId", "$3": "params.mobile_number"}'::jsonb,
0, 'write');

-- citizen.access.list
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('citizen.access.list', 'list_access_codes',
'SELECT ca.id, ca.access_code, ca.mobile_number, ca.is_active, ca.created_at, ca.revoked_at, cp.display_name as citizen_name, array_agg(DISTINCT cg.name) FILTER (WHERE cg.id IS NOT NULL) as groups FROM citizen_access ca LEFT JOIN citizen_profiles cp ON ca.citizen_id = cp.id LEFT JOIN citizen_group_members cgm ON ca.id = cgm.citizen_access_id LEFT JOIN citizen_groups cg ON cgm.group_id = cg.id WHERE ca.tenant_id = $1 AND ca.user_id = $2 AND ($3::boolean IS NULL OR ca.is_active = $3) GROUP BY ca.id, cp.display_name ORDER BY ca.created_at DESC LIMIT $4 OFFSET $5',
'{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.is_active", "$4": "params.pageSize", "$5": "params.offset"}'::jsonb,
0, 'read');

-- citizen.access.revoke
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('citizen.access.revoke', 'revoke_access',
'UPDATE citizen_access SET is_active = false, revoked_at = now() WHERE id = $1 AND tenant_id = $2 RETURNING id, access_code',
'{"$1": "params.access_code_id", "$2": "context.tenantId"}'::jsonb,
0, 'write');

-- citizen.access.regenerate
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('citizen.access.regenerate', 'regenerate_code',
'UPDATE citizen_access SET access_code = $3 WHERE id = $1 AND tenant_id = $2 RETURNING id, access_code, mobile_number, is_active',
'{"$1": "params.access_code_id", "$2": "context.tenantId", "$3": "params.new_access_code"}'::jsonb,
0, 'write');

-- citizen.group.create
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('citizen.group.create', 'create_group',
'INSERT INTO citizen_groups (tenant_id, created_by, name, description) VALUES ($1, $2, $3, $4) RETURNING *',
'{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.name", "$4": "params.description"}'::jsonb,
0, 'write');

-- citizen.group.list
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('citizen.group.list', 'list_groups',
'SELECT cg.*, count(DISTINCT cgm.id) as member_count FROM citizen_groups cg LEFT JOIN citizen_group_members cgm ON cg.id = cgm.group_id WHERE cg.tenant_id = $1 AND cg.created_by = $2 AND cg.deleted_at IS NULL GROUP BY cg.id ORDER BY cg.name LIMIT $3 OFFSET $4',
'{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.pageSize", "$4": "params.offset"}'::jsonb,
0, 'read');

-- citizen.group.edit
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('citizen.group.edit', 'update_group',
'UPDATE citizen_groups SET name = COALESCE($3, name), description = COALESCE($4, description), updated_at = now() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING *',
'{"$1": "params.group_id", "$2": "context.tenantId", "$3": "params.name", "$4": "params.description"}'::jsonb,
0, 'write');

-- suggestion_box.create
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('suggestion_box.create', 'create_box',
'INSERT INTO suggestion_boxes (tenant_id, created_by, title, description, allowed_group_ids) VALUES ($1, $2, $3, $4, COALESCE($5::uuid[], ''{}''::uuid[])) RETURNING *',
'{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.title", "$4": "params.description", "$5": "params.allowed_group_ids"}'::jsonb,
0, 'write');

-- suggestion_box.list
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('suggestion_box.list', 'list_boxes',
'SELECT sb.*, count(DISTINCT s.id) as suggestion_count, count(DISTINCT s.id) FILTER (WHERE s.status = ''new'') as new_count FROM suggestion_boxes sb LEFT JOIN suggestions s ON sb.id = s.suggestion_box_id AND s.deleted_at IS NULL WHERE sb.tenant_id = $1 AND sb.created_by = $2 AND sb.deleted_at IS NULL GROUP BY sb.id ORDER BY sb.created_at DESC LIMIT $3 OFFSET $4',
'{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.pageSize", "$4": "params.offset"}'::jsonb,
0, 'read');

-- suggestion_box.edit
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('suggestion_box.edit', 'update_box',
'UPDATE suggestion_boxes SET title = COALESCE($3, title), description = COALESCE($4, description), is_active = COALESCE($5, is_active), allowed_group_ids = COALESCE($6::uuid[], allowed_group_ids), updated_at = now() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING *',
'{"$1": "params.suggestion_box_id", "$2": "context.tenantId", "$3": "params.title", "$4": "params.description", "$5": "params.is_active", "$6": "params.allowed_group_ids"}'::jsonb,
0, 'write');

-- suggestion.list
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('suggestion.list', 'list_suggestions',
'SELECT s.id, s.content, s.status, s.created_at, s.updated_at, sb.title as box_title, cp.mobile_number, cp.display_name as citizen_name, count(sn.id) as note_count FROM suggestions s JOIN suggestion_boxes sb ON s.suggestion_box_id = sb.id JOIN citizen_profiles cp ON s.citizen_id = cp.id LEFT JOIN suggestion_notes sn ON s.id = sn.suggestion_id AND sn.deleted_at IS NULL WHERE s.tenant_id = $1 AND sb.created_by = $2 AND s.deleted_at IS NULL AND ($3::uuid IS NULL OR s.suggestion_box_id = $3) AND ($4::text IS NULL OR s.status::text = $4) GROUP BY s.id, sb.title, cp.mobile_number, cp.display_name ORDER BY s.created_at DESC LIMIT $5 OFFSET $6',
'{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.suggestion_box_id", "$4": "params.status", "$5": "params.pageSize", "$6": "params.offset"}'::jsonb,
0, 'read');

-- suggestion.respond
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('suggestion.respond', 'add_note',
'INSERT INTO suggestion_notes (suggestion_id, tenant_id, author_type, author_id, content) VALUES ($1, $2, ''user'', $3, $4) RETURNING *',
'{"$1": "params.suggestion_id", "$2": "context.tenantId", "$3": "context.userId", "$4": "params.content"}'::jsonb,
0, 'write'),
('suggestion.respond', 'update_status',
'UPDATE suggestions SET status = COALESCE($3::suggestion_status, status), updated_at = now() WHERE id = $1 AND tenant_id = $2 RETURNING *',
'{"$1": "params.suggestion_id", "$2": "context.tenantId", "$3": "params.status"}'::jsonb,
1, 'write');

-- public.suggestion.submit (citizen option - uses pre-execution validation)
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('public.suggestion.submit', 'validate_citizen_access',
'SELECT ca.id, ca.citizen_id, ca.tenant_id FROM citizen_access ca WHERE ca.mobile_number = $1 AND ca.access_code = $2 AND ca.tenant_id = $3 AND ca.is_active = true AND ca.revoked_at IS NULL',
'{"$1": "params.mobile_number", "$2": "params.access_code", "$3": "context.tenantId"}'::jsonb,
-1, 'read'),
('public.suggestion.submit', 'insert_suggestion',
'INSERT INTO suggestions (suggestion_box_id, tenant_id, citizen_id, content) VALUES (COALESCE($4, (SELECT id FROM suggestion_boxes WHERE tenant_id = $1 AND is_active = true AND deleted_at IS NULL ORDER BY created_at LIMIT 1)), $1, $3, $5) RETURNING *',
'{"$1": "context.tenantId", "$2": "context.scopedUserId", "$3": "params.validated_citizen_id", "$4": "params.suggestion_box_id", "$5": "params.content"}'::jsonb,
0, 'write');

-- public.suggestion.list (citizen option - uses pre-execution validation)
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('public.suggestion.list', 'validate_citizen_access',
'SELECT ca.id, ca.citizen_id, ca.tenant_id FROM citizen_access ca WHERE ca.mobile_number = $1 AND ca.access_code = $2 AND ca.tenant_id = $3 AND ca.is_active = true AND ca.revoked_at IS NULL',
'{"$1": "params.mobile_number", "$2": "params.access_code", "$3": "context.tenantId"}'::jsonb,
-1, 'read'),
('public.suggestion.list', 'list_citizen_suggestions',
'SELECT s.id, s.content, s.status, s.created_at, sb.title as box_title, (SELECT json_agg(json_build_object(''content'', sn.content, ''author_type'', sn.author_type, ''created_at'', sn.created_at) ORDER BY sn.created_at) FROM suggestion_notes sn WHERE sn.suggestion_id = s.id AND sn.deleted_at IS NULL) as notes FROM suggestions s JOIN suggestion_boxes sb ON s.suggestion_box_id = sb.id WHERE s.tenant_id = $1 AND s.citizen_id = $2 AND s.deleted_at IS NULL ORDER BY s.created_at DESC LIMIT 50',
'{"$1": "context.tenantId", "$2": "params.validated_citizen_id"}'::jsonb,
0, 'read');

-- ============================================
-- Option Questions
-- ============================================

-- citizen.access.assign
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('citizen.access.assign', 'Which access code ID?', 'access_code_id', 0, true, NULL, '{}', false),
('citizen.access.assign', 'What mobile number to assign?', 'mobile_number', 1, true, NULL, '{}', true);

-- citizen.group.create
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('citizen.group.create', 'Group name?', 'name', 0, true, NULL, '{}', true),
('citizen.group.create', 'Description (optional)?', 'description', 1, false, NULL, '{}', false);

-- suggestion_box.create
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('suggestion_box.create', 'Title for the suggestion box?', 'title', 0, true, NULL, '{}', true),
('suggestion_box.create', 'Description (optional)?', 'description', 1, false, NULL, '{}', false);

-- suggestion.respond
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('suggestion.respond', 'Your response?', 'content', 0, true, NULL, '{}', false),
('suggestion.respond', 'Update status?', 'status', 1, false, 'select', '{"options": ["read", "in_progress", "resolved", "closed"]}', true);

-- public.suggestion.submit (citizen Q&A)
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('public.suggestion.submit', 'What''s your mobile number?', 'mobile_number', 0, true, NULL, '{"placeholder": "+91 XXXXX XXXXX"}', false),
('public.suggestion.submit', 'Enter your access code', 'access_code', 1, true, NULL, '{"placeholder": "SB-XXXXXX"}', false),
('public.suggestion.submit', 'What''s your suggestion?', 'content', 2, true, NULL, '{}', false);

-- public.suggestion.list (citizen Q&A)
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('public.suggestion.list', 'What''s your mobile number?', 'mobile_number', 0, true, NULL, '{"placeholder": "+91 XXXXX XXXXX"}', false),
('public.suggestion.list', 'Enter your access code', 'access_code', 1, true, NULL, '{"placeholder": "SB-XXXXXX"}', false);

-- ============================================
-- Update user_type_configs for suggestion box options
-- ============================================

UPDATE user_type_configs SET
  available_option_ids = array_cat(available_option_ids, ARRAY[
    'citizen.access.create', 'citizen.access.assign', 'citizen.access.list',
    'citizen.access.revoke', 'citizen.access.regenerate',
    'citizen.group.create', 'citizen.group.list', 'citizen.group.edit',
    'suggestion_box.create', 'suggestion_box.list', 'suggestion_box.edit',
    'suggestion.list', 'suggestion.respond'
  ]),
  default_option_ids = array_cat(default_option_ids, ARRAY[
    'citizen.access.list', 'suggestion_box.list'
  ])
WHERE user_type IN ('worker', 'candidate', 'representative');

-- Update citizen config to include suggestion options
UPDATE user_type_configs SET
  available_option_ids = array_cat(available_option_ids, ARRAY[
    'public.suggestion.submit', 'public.suggestion.list'
  ]),
  default_option_ids = array_cat(default_option_ids, ARRAY[
    'public.suggestion.submit', 'public.suggestion.list'
  ])
WHERE user_type = 'citizen';
