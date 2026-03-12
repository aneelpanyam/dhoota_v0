CREATE TABLE tenants (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,
    slug            text NOT NULL UNIQUE,
    subscription    subscription_level NOT NULL DEFAULT 'basic',
    custom_domain   text UNIQUE,
    owner_user_id   uuid,
    metadata        jsonb DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz
);

CREATE TABLE users (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id),
    auth_user_id    uuid NOT NULL UNIQUE,
    email           text,
    phone           text,
    display_name    text NOT NULL,
    avatar_url      text,
    user_type       user_type NOT NULL DEFAULT 'worker',
    bio             text,
    metadata        jsonb DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz
);

ALTER TABLE tenants ADD CONSTRAINT fk_tenants_owner
    FOREIGN KEY (owner_user_id) REFERENCES users(id);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_auth_user ON users(auth_user_id);
CREATE INDEX idx_users_user_type ON users(user_type);
CREATE INDEX idx_tenants_slug ON tenants(slug);
