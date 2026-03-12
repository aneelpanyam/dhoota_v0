CREATE TABLE llm_logs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid REFERENCES tenants(id),
    user_id         uuid REFERENCES users(id),
    provider        text NOT NULL,
    model           text NOT NULL,
    operation       text NOT NULL,
    prompt_tokens   integer,
    completion_tokens integer,
    latency_ms      integer,
    success         boolean NOT NULL DEFAULT true,
    error_message   text,
    metadata        jsonb DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_llm_logs_tenant ON llm_logs(tenant_id, created_at DESC);
