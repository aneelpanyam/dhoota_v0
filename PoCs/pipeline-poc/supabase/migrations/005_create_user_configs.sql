CREATE TABLE user_type_configs (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_type           user_type NOT NULL UNIQUE,
    init_option_ids     text[] NOT NULL DEFAULT '{}',
    default_option_ids  text[] NOT NULL DEFAULT '{}',
    available_option_ids text[] NOT NULL DEFAULT '{}',
    theme_config        jsonb DEFAULT '{}',
    metadata            jsonb DEFAULT '{}',
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_configs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL UNIQUE REFERENCES users(id),
    tenant_id       uuid NOT NULL REFERENCES tenants(id),
    init_option_ids text[],
    default_option_ids text[],
    available_option_ids text[],
    theme_config    jsonb,
    preferences     jsonb DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_configs_user ON user_configs(user_id);
CREATE INDEX idx_user_configs_tenant ON user_configs(tenant_id);
