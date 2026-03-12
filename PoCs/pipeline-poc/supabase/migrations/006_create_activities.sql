CREATE TABLE activities (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id),
    created_by      uuid NOT NULL REFERENCES users(id),
    title           text NOT NULL,
    description     text,
    status          activity_status NOT NULL DEFAULT 'completed',
    visibility      activity_visibility NOT NULL DEFAULT 'private',
    activity_date   timestamptz NOT NULL DEFAULT now(),
    location        text,
    is_pinned       boolean NOT NULL DEFAULT false,
    metadata        jsonb DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz
);

CREATE TABLE activity_notes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id),
    activity_id     uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    created_by      uuid NOT NULL REFERENCES users(id),
    content         text NOT NULL,
    metadata        jsonb DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz
);

CREATE TABLE activity_media (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id),
    activity_id         uuid REFERENCES activities(id) ON DELETE SET NULL,
    note_id             uuid REFERENCES activity_notes(id) ON DELETE SET NULL,
    uploaded_by         uuid NOT NULL REFERENCES users(id),
    media_type          media_type NOT NULL,
    original_filename   text NOT NULL,
    s3_key              text NOT NULL,
    file_size_bytes     bigint NOT NULL,
    mime_type           text NOT NULL,
    processing_status   media_status NOT NULL DEFAULT 'uploading',
    variants            jsonb DEFAULT '{}',
    width               integer,
    height              integer,
    duration_seconds    integer,
    metadata            jsonb DEFAULT '{}',
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activities_tenant ON activities(tenant_id);
CREATE INDEX idx_activities_tenant_date ON activities(tenant_id, activity_date DESC);
CREATE INDEX idx_activities_tenant_visibility ON activities(tenant_id, visibility);
CREATE INDEX idx_activities_created_by ON activities(created_by);
CREATE INDEX idx_activity_notes_activity ON activity_notes(activity_id, created_at);
CREATE INDEX idx_activity_media_activity ON activity_media(activity_id);
