CREATE TABLE tenant_feature_flags (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id),
    flag_key        text NOT NULL,
    enabled         boolean NOT NULL DEFAULT false,
    metadata        jsonb DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, flag_key)
);

CREATE INDEX idx_feature_flags_tenant ON tenant_feature_flags(tenant_id);
