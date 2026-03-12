CREATE TABLE tags (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid REFERENCES tenants(id),
    name            text NOT NULL,
    slug            text NOT NULL,
    color           text,
    source          tag_source NOT NULL DEFAULT 'custom',
    is_hidden       boolean NOT NULL DEFAULT false,
    parent_tag_id   uuid REFERENCES tags(id),
    metadata        jsonb DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, slug)
);

CREATE TABLE activity_tags (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id     uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    tag_id          uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    confidence      real,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE(activity_id, tag_id)
);

CREATE INDEX idx_tags_tenant ON tags(tenant_id);
CREATE INDEX idx_activity_tags_activity ON activity_tags(activity_id);
CREATE INDEX idx_activity_tags_tag ON activity_tags(tag_id);
