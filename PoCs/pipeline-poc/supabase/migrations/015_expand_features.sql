-- ============================================
-- 015: Expand Features
-- Adds tables for announcements, info cards,
-- bookmarks, reports, activity plans, public
-- site configs, tenant option overrides.
-- Alters users (access_code), option_definitions
-- (tenant_id), messages (trace_id), llm_logs
-- (cost columns).
-- ============================================

-- ============================================
-- Alter existing tables
-- ============================================

ALTER TABLE users ALTER COLUMN auth_user_id DROP NOT NULL;
ALTER TABLE users ADD COLUMN access_code text UNIQUE;

ALTER TABLE option_definitions ADD COLUMN tenant_id uuid REFERENCES tenants(id);
CREATE INDEX idx_option_definitions_tenant ON option_definitions(tenant_id);

ALTER TABLE messages ADD COLUMN trace_id text;
CREATE INDEX idx_messages_trace_id ON messages(trace_id);

ALTER TABLE llm_logs
  ADD COLUMN input_cost    numeric(10,6),
  ADD COLUMN output_cost   numeric(10,6),
  ADD COLUMN total_cost    numeric(10,6),
  ADD COLUMN conversation_id uuid,
  ADD COLUMN option_id     text;

-- ============================================
-- New enums
-- ============================================

CREATE TYPE announcement_visibility AS ENUM ('private', 'public');
CREATE TYPE info_card_type AS ENUM ('about', 'contact', 'service', 'custom');
CREATE TYPE report_status AS ENUM ('requested', 'processing', 'completed', 'failed');
CREATE TYPE plan_status AS ENUM ('draft', 'scheduled', 'completed');

-- ============================================
-- Public site configs
-- ============================================

CREATE TABLE public_site_configs (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id),
    user_id             uuid NOT NULL REFERENCES users(id),
    welcome_message     text NOT NULL DEFAULT 'Welcome! Ask me about activities, announcements, and more.',
    side_panel_content  jsonb DEFAULT '{}',
    theme_overrides     jsonb DEFAULT '{}',
    enabled_option_ids  text[] NOT NULL DEFAULT '{}',
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_public_site_configs_tenant ON public_site_configs(tenant_id);

-- ============================================
-- Announcements
-- ============================================

CREATE TABLE announcements (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id),
    created_by      uuid NOT NULL REFERENCES users(id),
    title           text NOT NULL,
    content         text NOT NULL,
    visibility      announcement_visibility NOT NULL DEFAULT 'private',
    pinned          boolean NOT NULL DEFAULT false,
    published_at    timestamptz,
    expires_at      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz
);

CREATE INDEX idx_announcements_tenant ON announcements(tenant_id, created_at DESC);
CREATE INDEX idx_announcements_created_by ON announcements(created_by);
CREATE INDEX idx_announcements_visibility ON announcements(tenant_id, visibility) WHERE deleted_at IS NULL;

-- ============================================
-- Info cards
-- ============================================

CREATE TABLE info_cards (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id),
    created_by      uuid NOT NULL REFERENCES users(id),
    title           text NOT NULL,
    content         jsonb NOT NULL DEFAULT '{}',
    card_type       info_card_type NOT NULL DEFAULT 'custom',
    visibility      announcement_visibility NOT NULL DEFAULT 'private',
    display_order   integer NOT NULL DEFAULT 0,
    icon            text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz
);

CREATE INDEX idx_info_cards_tenant ON info_cards(tenant_id, display_order);
CREATE INDEX idx_info_cards_created_by ON info_cards(created_by);
CREATE INDEX idx_info_cards_visibility ON info_cards(tenant_id, visibility) WHERE deleted_at IS NULL;

-- ============================================
-- Bookmarks
-- ============================================

CREATE TABLE bookmarks (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id),
    user_id         uuid NOT NULL REFERENCES users(id),
    entity_type     text NOT NULL,
    entity_id       uuid NOT NULL,
    label           text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id, entity_type, entity_id)
);

CREATE INDEX idx_bookmarks_user ON bookmarks(user_id, created_at DESC);
CREATE INDEX idx_bookmarks_tenant ON bookmarks(tenant_id);

-- ============================================
-- Report requests
-- ============================================

CREATE TABLE report_requests (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id),
    user_id         uuid NOT NULL REFERENCES users(id),
    report_type     text NOT NULL,
    parameters      jsonb NOT NULL DEFAULT '{}',
    status          report_status NOT NULL DEFAULT 'requested',
    result_url      text,
    requested_at    timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz
);

CREATE INDEX idx_report_requests_user ON report_requests(user_id, requested_at DESC);
CREATE INDEX idx_report_requests_tenant ON report_requests(tenant_id);
CREATE INDEX idx_report_requests_status ON report_requests(status) WHERE status IN ('requested', 'processing');

-- ============================================
-- Activity plans
-- ============================================

CREATE TABLE activity_plans (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id),
    user_id             uuid NOT NULL REFERENCES users(id),
    title               text NOT NULL,
    description         text,
    planned_date        timestamptz,
    linked_activity_id  uuid REFERENCES activities(id) ON DELETE SET NULL,
    status              plan_status NOT NULL DEFAULT 'draft',
    reminders           jsonb DEFAULT '[]',
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    deleted_at          timestamptz
);

CREATE INDEX idx_activity_plans_user ON activity_plans(user_id, planned_date);
CREATE INDEX idx_activity_plans_tenant ON activity_plans(tenant_id);

-- ============================================
-- Tenant option overrides
-- ============================================

CREATE TABLE tenant_option_overrides (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id),
    option_id           text NOT NULL REFERENCES option_definitions(id),
    enabled             boolean NOT NULL DEFAULT true,
    name_override       text,
    description_override text,
    icon_override       text,
    priority_override   integer,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, option_id)
);

CREATE INDEX idx_tenant_option_overrides_tenant ON tenant_option_overrides(tenant_id);
