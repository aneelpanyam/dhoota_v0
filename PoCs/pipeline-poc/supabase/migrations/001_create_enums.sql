CREATE TYPE user_type AS ENUM (
    'worker', 'candidate', 'representative', 'team_worker',
    'citizen', 'anonymous', 'system_admin'
);

CREATE TYPE subscription_level AS ENUM ('basic', 'standard', 'premium');
CREATE TYPE activity_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE activity_visibility AS ENUM ('private', 'team', 'public');
CREATE TYPE media_type AS ENUM ('image', 'video', 'document');
CREATE TYPE media_status AS ENUM ('uploading', 'processing', 'ready', 'failed');
CREATE TYPE tag_source AS ENUM ('system', 'custom', 'ai');
CREATE TYPE conversation_context AS ENUM ('tracker', 'admin', 'public', 'suggestion_box');
CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');
