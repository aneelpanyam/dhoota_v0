CREATE TABLE conversations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id),
    user_id         uuid NOT NULL REFERENCES users(id),
    context         conversation_context NOT NULL DEFAULT 'tracker',
    title           text,
    is_archived     boolean NOT NULL DEFAULT false,
    metadata        jsonb DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE messages (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id     uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    tenant_id           uuid NOT NULL REFERENCES tenants(id),
    role                message_role NOT NULL,
    content             text,
    source              text,
    option_id           text REFERENCES option_definitions(id),
    widgets             jsonb DEFAULT '[]',
    follow_ups          jsonb DEFAULT '[]',
    input_params        jsonb,
    metadata            jsonb DEFAULT '{}',
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_tenant_user ON conversations(tenant_id, user_id, updated_at DESC);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_tenant ON messages(tenant_id);
