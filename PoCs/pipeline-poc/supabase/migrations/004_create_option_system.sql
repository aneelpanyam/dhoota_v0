CREATE TABLE option_definitions (
    id              text PRIMARY KEY,
    name            text NOT NULL,
    description     text NOT NULL,
    category        text NOT NULL,
    icon            text,
    keywords        text[] DEFAULT '{}',
    user_types      text[] NOT NULL,
    required_toggles text[] DEFAULT '{}',
    show_in_defaults boolean NOT NULL DEFAULT false,
    default_priority integer DEFAULT 100,
    accepts_files   boolean NOT NULL DEFAULT false,
    input_schema    jsonb,
    response_prompt text NOT NULL,
    follow_up_option_ids text[] DEFAULT '{}',
    is_active       boolean NOT NULL DEFAULT true,
    metadata        jsonb DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sql_templates (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    option_id       text NOT NULL REFERENCES option_definitions(id),
    name            text NOT NULL,
    sql             text NOT NULL,
    param_mapping   jsonb NOT NULL,
    execution_order integer NOT NULL DEFAULT 0,
    query_type      text NOT NULL DEFAULT 'write',
    metadata        jsonb DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE option_questions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    option_id       text NOT NULL REFERENCES option_definitions(id),
    question_text   text NOT NULL,
    question_key    text NOT NULL,
    question_order  integer NOT NULL DEFAULT 0,
    is_required     boolean NOT NULL DEFAULT true,
    inline_widget   text,
    widget_config   jsonb DEFAULT '{}',
    groupable       boolean NOT NULL DEFAULT true,
    metadata        jsonb DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE option_executions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id),
    user_id         uuid NOT NULL REFERENCES users(id),
    option_id       text NOT NULL REFERENCES option_definitions(id),
    conversation_id uuid NOT NULL,
    input_params    jsonb NOT NULL,
    raw_input       jsonb,
    sql_results     jsonb,
    response_data   jsonb,
    execution_ms    integer,
    llm_tokens_used integer,
    success         boolean NOT NULL DEFAULT true,
    error_message   text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_option_definitions_category ON option_definitions(category);
CREATE INDEX idx_option_definitions_user_types ON option_definitions USING gin(user_types);
CREATE INDEX idx_sql_templates_option ON sql_templates(option_id, execution_order);
CREATE INDEX idx_option_questions_option ON option_questions(option_id, question_order);
CREATE INDEX idx_option_executions_tenant ON option_executions(tenant_id, created_at DESC);
