# Dhoota Pipeline PoC

Proof-of-concept for the Dhoota Option Processing Pipeline — a chat-driven interface where every feature is an "option" executed through a 5-stage pipeline: **resolve → Q&A → refine → SQL → format**.

## What This Validates

1. **Chat-driven interaction model** — users interact through conversation, not forms
2. **Guided Q&A** — system asks adaptive questions with inline widgets
3. **AI input refinement** — broken/informal input is cleaned into structured data
4. **Configuration-driven options** — features defined as DB rows, not code
5. **Dynamic queries** — free-text questions answered via LLM-generated SQL
6. **Rich widget rendering** — charts, cards, tables, galleries in the chat

## Prerequisites

- Node.js 18+
- A Supabase project (cloud or local via Docker)
- An OpenAI API key
- An AWS S3 bucket (for file uploads)

## Setup

1. **Clone and install**
  ```bash
   cd PoCs/pipeline-poc
   npm install
  ```
2. **Configure environment** — copy `.env.example` to `.env.local` and fill in your values.
  See [docs/AWS_SETUP.md](docs/AWS_SETUP.md) for detailed S3 + IAM setup instructions.

  | Variable                               | Where to get it                                                       |
  | -------------------------------------- | --------------------------------------------------------------------- |
  | `NEXT_PUBLIC_SUPABASE_URL`             | Supabase Dashboard > Settings > API                                   |
  | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Dashboard > Settings > API Keys (create new publishable key) |
  | `SUPABASE_SECRET_KEY`                  | Supabase Dashboard > Settings > API Keys (create new secret key)      |
  | `OPENAI_API_KEY`                       | [OpenAI Platform > API Keys](https://platform.openai.com/api-keys)    |
  | `AWS_S3_BUCKET`                        | S3 Console > your bucket name                                         |
  | `AWS_S3_REGION`                        | `ap-south-1` (Mumbai) recommended                                     |
  | `AWS_ACCESS_KEY_ID`                    | IAM Console > your user > Security credentials                        |
  | `AWS_SECRET_ACCESS_KEY`                | Shown once when creating the access key                               |

3. **Run database migrations** — apply the SQL files in `supabase/migrations/` in order (001 through 012) against your Supabase project via the SQL Editor or Supabase CLI.
4. **Create a test user** — after running migrations, you need to:
  - Create a tenant: `INSERT INTO tenants (name, slug) VALUES ('Test Org', 'test-org');`
  - Enable feature flags for the tenant
  - Sign up via the app's login page (email OTP)
  - Create a user record linking the auth user to the tenant:
    ```sql
    INSERT INTO users (tenant_id, auth_user_id, email, display_name, user_type)
    VALUES ('<tenant-id>', '<supabase-auth-user-id>', 'your@email.com', 'Your Name', 'worker');
    ```
5. **Start the dev server**
  ```bash
   npm run dev
  ```
6. **Open** [http://localhost:3000](http://localhost:3000)

## Architecture

```
Browser (Chat UI)
    ↓
POST /api/chat/message (unified endpoint)
    ↓
Option Processing Pipeline
    ├── Stage 1: Option Resolution (direct / LLM classification)
    ├── Stage 2: Guided Q&A (adaptive questions + inline widgets)
    ├── Stage 3: LLM Input Refinement (broken text → structured data)
    ├── Stage 4: SQL Template Execution (parameterized, tenant-scoped)
    └── Stage 5: LLM Response Formatting (results → widgets + summary)
    ↓
ChatMessageResponse (widgets, follow-ups, default options)
    ↓
Widget Renderer (activity cards, charts, tables, galleries, etc.)
```

## Key Files


| File                                    | Purpose                            |
| --------------------------------------- | ---------------------------------- |
| `src/lib/pipeline/index.ts`             | Pipeline orchestrator              |
| `src/lib/pipeline/resolver.ts`          | Option resolution                  |
| `src/lib/pipeline/qa-engine.ts`         | Guided Q&A                         |
| `src/lib/pipeline/refiner.ts`           | LLM input refinement               |
| `src/lib/pipeline/executor.ts`          | SQL execution                      |
| `src/lib/pipeline/formatter.ts`         | Response formatting                |
| `src/lib/llm/openai.ts`                 | OpenAI provider                    |
| `src/app/api/chat/message/route.ts`     | Universal API endpoint             |
| `src/components/chat/ChatContainer.tsx` | Main chat UI                       |
| `src/components/widgets/`               | All response widgets               |
| `supabase/migrations/011_seed_data.sql` | Option definitions + SQL templates |


## PoC Scope

**In scope:** Activity CRUD, guided Q&A, AI refinement, dynamic queries, file uploads, 10 widget types, init config.

**Out of scope:** Public website, suggestion box, teams, bookmarks, background jobs, admin panel.