# Simple Path App — Agile Implementation Plan

> **Follow this plan story-by-story.** Each story is independently deliverable and testable. Mark stories complete as you go.
>
> **Copy-paste prompts:** See [sprints/](sprints/) — each story has a ready-to-use prompt file. Example: `@sprints/sprint-1/S1.1.md`

---

## Story Format

Each story includes:
- **ID** — Unique identifier
- **Title** — User story format
- **Acceptance criteria** — Definition of done
- **Depends on** — Prerequisite stories
- **Deliverables** — Key files/outputs

---

## Epic 1: Foundation

### S1.1 — Project bootstrap

**As a** developer  
**I want** a Next.js 15 project with Supabase, Tailwind, and core dependencies  
**So that** I can build the app on a solid foundation.

**Acceptance criteria:**
- [ ] Next.js 15 (App Router) project in `PoCs/simple-path`
- [ ] Supabase client and server setup
- [ ] Tailwind CSS configured (Inter or Nunito Sans, soft palette)
- [ ] Zod for validation
- [ ] Root layout with fonts and mobile-first viewport
- [ ] `package.json` with pinned major versions

**Depends on:** —

**Deliverables:** `package.json`, `tailwind.config.ts`, `src/app/layout.tsx`, `src/lib/supabase/client.ts`, `server.ts`

---

### S1.2 — Core database schema

**As a** developer  
**I want** core tables (system, users, spaces, access_codes) with RLS  
**So that** the app has a secure data foundation.

**Acceptance criteria:**
- [ ] Migration: `system`, `users`, `spaces`, `access_codes` tables
- [ ] RLS policies for users and spaces
- [ ] Foreign keys and constraints
- [ ] Migration runs cleanly on fresh Supabase

**Depends on:** S1.1

**Deliverables:** `supabase/migrations/001_core_schema.sql`

---

### S1.3 — Tracing and logging

**As a** developer  
**I want** trace_id propagation and structured logging  
**So that** I can debug issues and correlate logs across requests.

**Acceptance criteria:**
- [ ] `trace_id` (UUID v4) generated per request
- [ ] Trace propagated via AsyncLocalStorage in server context
- [ ] Structured logger (JSON: level, message, trace_id, user_id, timestamp)
- [ ] CloudWatch-compatible output (or stdout for dev)
- [ ] Error responses include trace_id for support

**Depends on:** S1.1

**Deliverables:** `src/lib/tracing.ts`, `src/lib/logger.ts`

---

### S1.4 — Input validation (Zod schemas)

**As a** developer  
**I want** shared Zod schemas for validation  
**So that** frontend and server validate consistently and never trust client input.

**Acceptance criteria:**
- [ ] Shared schemas in `src/lib/validation/`
- [ ] Schemas for access code, OTP, and any Phase 1 forms
- [ ] Server actions validate all inputs before processing
- [ ] Clear error messages on validation failure

**Depends on:** S1.1

**Deliverables:** `src/lib/validation/*.ts`

---

### S1.5 — Auth flow (access code + OTP)

**As a** user  
**I want** to log in with my access code and OTP  
**So that** I can access my workspace securely.

**Acceptance criteria:**
- [ ] Access code entry page
- [ ] OTP request and verification flow
- [ ] Session created on success; redirect to channels
- [ ] Session timeout config (JWT expiry)
- [ ] Invalid code/OTP shows clear error with trace_id
- [ ] Log auth attempts (success/failure) to logger

**Depends on:** S1.2, S1.3, S1.4

**Deliverables:** `src/app/(auth)/access-code/page.tsx`, `src/app/(auth)/otp/page.tsx`, auth server actions

---

### S1.6 — Non-intrusive status updates (toast)

**As a** user  
**I want** subtle feedback when actions are in progress or complete  
**So that** I know what’s happening without being interrupted.

**Acceptance criteria:**
- [ ] Toast component: bottom or corner placement
- [ ] States: loading ("Saving…"), success (auto-dismiss), error (persist with trace_id copy)
- [ ] No blocking modals for status
- [ ] Accessible and mobile-friendly

**Depends on:** S1.1

**Deliverables:** `src/components/ui/StatusToast.tsx` (or toast lib integration)

---

### S1.7 — App shell and channels placeholder

**As a** user  
**I want** a mobile-first app shell with bottom nav and a channels list placeholder  
**So that** I land in the app after login and see where my workspaces will go.

**Acceptance criteria:**
- [ ] `(app)` layout: bottom nav on mobile, sidebar on desktop
- [ ] Channels page: list placeholder (empty state or mock data)
- [ ] Protected route: redirect to auth if not logged in
- [ ] Navigation structure ready for future routes (channels, insights, calendar)

**Depends on:** S1.5

**Deliverables:** `src/app/(app)/layout.tsx`, `src/app/(app)/channels/page.tsx`

---

## Epic 2: Spaces and Categories

### S2.1 — Space notes and Q&A schema

**As a** user  
**I want** to store notes and Q&A at the space level  
**So that** I can plan at the top level before creating categories.

**Acceptance criteria:**
- [ ] Migration: `space_notes`, `space_questions`, `space_answers`
- [ ] RLS scoped to space
- [ ] CRUD server actions with validation

**Depends on:** S1.2

**Deliverables:** `supabase/migrations/002_space_planning.sql`, server actions

---

### S2.2 — Categories (workspaces) schema

**As a** user  
**I want** to create and manage categories (workspaces)  
**So that** I can organize my activities by workstream.

**Acceptance criteria:**
- [ ] Migration: `categories`, `category_questions`, `category_answers`, `category_catalog`
- [ ] Categories: title, description, notes; space-scoped
- [ ] Category catalog: system pre-defined workspaces
- [ ] RLS; CRUD with validation

**Depends on:** S1.2

**Deliverables:** `supabase/migrations/003_categories.sql`, server actions

---

### S2.3 — Channels list (real categories)

**As a** user  
**I want** to see my categories as channels with a quick snapshot  
**So that** I can navigate to my workspaces.

**Acceptance criteria:**
- [ ] Channels page loads categories for user's space
- [ ] Each channel shows title and basic snapshot (e.g. activity count)
- [ ] Tap channel → navigates to category feed (placeholder ok)
- [ ] Empty state when no categories

**Depends on:** S2.2, S1.7

**Deliverables:** `src/app/(app)/channels/page.tsx` (real data), category list component

---

### S2.4 — Create category flow

**As a** user  
**I want** to create a category from scratch or from the catalog  
**So that** I can set up new workspaces.

**Acceptance criteria:**
- [ ] Create category form: title, description, notes
- [ ] Option to pick from `category_catalog` or create custom
- [ ] Category Q&A if configured (optional)
- [ ] Success toast; redirect or refresh channels
- [ ] Validation and error handling with trace_id

**Depends on:** S2.2, S1.6

**Deliverables:** Create category page/modal, server action

---

## Epic 3: Activities

### S3.1 — Activities schema and questions

**As a** developer  
**I want** activities and activity_answers tables with configurable questions  
**So that** users can log activities with flexible, category-specific fields.

**Acceptance criteria:**
- [ ] Migration: `questions` (per category), `activities`, `activity_answers`
- [ ] Question types: file, table, date, email, phone, rich_text
- [ ] Activities: raw_description, attachments (JSON refs), category_id, created_by
- [ ] activity_answers: activity_id, question_id, value (JSONB), question_key
- [ ] RLS; indexes for common queries

**Depends on:** S2.2

**Deliverables:** `supabase/migrations/004_activities.sql`

---

### S3.2 — Activity creation (basic, no AI)

**As a** user  
**I want** to add an activity with raw description and answers  
**So that** I can log what I did (title/description can be manual initially).

**Acceptance criteria:**
- [ ] Activity form: raw_description, category questions (based on category config)
- [ ] Basic validation; save to activities + activity_answers
- [ ] Success toast; show in feed or redirect
- [ ] Intuitive flow: inline hints, progressive disclosure
- [ ] Status updates during save (non-intrusive)

**Depends on:** S3.1, S2.3, S1.6

**Deliverables:** Activity creation page/form, server action

---

### S3.3 — Activity feed (infinite scroll)

**As a** user  
**I want** to see my activities in a social-media-style feed  
**So that** I can browse what I’ve logged.

**Acceptance criteria:**
- [ ] Feed: cards with title, description, metadata; newest first
- [ ] Cursor-based pagination; infinite scroll (Intersection Observer)
- [ ] Tap to expand or view details
- [ ] Empty state when no activities
- [ ] Scoped to selected category

**Depends on:** S3.1, S2.3

**Deliverables:** `src/app/(app)/channels/[categoryId]/feed/page.tsx`, ActivityCard component

---

### S3.4 — Session tracing (capture layer)

**As a** support agent  
**I want** user actions and results captured per session  
**So that** I can reconstruct context when users reach out.

**Acceptance criteria:**
- [ ] Migration: `session_traces` (session_id, user_id, space_id, trace_id, action_type, action_params, result, created_at)
- [ ] Capture layer: record actions in server actions (create_activity, view_feed, etc.)
- [ ] Store result (success/error, sanitized payload)
- [ ] session_id from client; propagate trace_id
- [ ] Indexed for lookup by session_id, trace_id, user_id

**Depends on:** S1.3, S3.2

**Deliverables:** `supabase/migrations/005_session_traces.sql`, `src/lib/session-tracing.ts`, instrumentation in server actions

---

### S3.5 — Activity details, tags, notes, completion

**As a** user  
**I want** to view activity details, add tags/notes, and mark complete  
**So that** I can manage and enrich my activities.

**Acceptance criteria:**
- [ ] Activity detail view: full description, answers, metadata
- [ ] Add/edit tags
- [ ] Add/edit notes
- [ ] Mark complete (or status field)
- [ ] Session tracing for these actions

**Depends on:** S3.2, S3.3, S3.4

**Deliverables:** Activity detail page, tag/note/complete server actions

---

### S3.6 — Calendar view

**As a** user  
**I want** to see my activities by date on a calendar  
**So that** I can plan and review by time.

**Acceptance criteria:**
- [ ] Calendar page: activities grouped by date
- [ ] Tap date or activity → navigate to detail
- [ ] Works with activity date field (from questions or created_at)
- [ ] Mobile-friendly calendar UI

**Depends on:** S3.1, S2.3

**Deliverables:** `src/app/(app)/calendar/page.tsx`

---

## Epic 4: AI and Insights

### S4.1 — AI provider abstraction and config

**As a** admin  
**I want** to configure AI provider (OpenAI, Gemini, Perplexity) and model  
**So that** the app can use AI features with my chosen provider.

**Acceptance criteria:**
- [ ] Migration: `ai_provider_config` (provider, model, api_key_ref)
- [ ] LLMProvider interface + factory (OpenAI, Gemini, Perplexity)
- [ ] `getLLMProvider(spaceId)` returns configured provider
- [ ] Admin UI to set provider, model, API key (stored securely)
- [ ] All calls go through wrapper that logs to llm_cost_logs

**Depends on:** S1.2

**Deliverables:** `supabase/migrations/006_ai_provider.sql`, `src/lib/llm/`, admin config page

---

### S4.2 — LLM cost logging

**As a** admin  
**I want** every LLM call logged with tokens and cost  
**So that** I can monitor usage and costs per space.

**Acceptance criteria:**
- [ ] Migration: `llm_cost_logs` (space_id, user_id, provider, model, operation, input_tokens, output_tokens, latency_ms, trace_id, created_at)
- [ ] Wrapper logs every LLM call before/after
- [ ] Also log to CloudWatch for alerting
- [ ] Admin can view usage/cost dashboard (basic table or chart)

**Depends on:** S4.1, S1.3

**Deliverables:** `supabase/migrations/007_llm_cost_logs.sql`, logging wrapper, admin dashboard stub

---

### S4.3 — AI-generated title and description

**As a** user  
**I want** the system to generate a title and well-formed description from my raw input  
**So that** my activities look polished without extra effort.

**Acceptance criteria:**
- [ ] On activity save: call LLM with raw_description → title, well_formed_description
- [ ] Store in activities; show in feed
- [ ] Fallback to raw_description if AI fails
- [ ] Status: "Generating title…" during call
- [ ] Logged to llm_cost_logs

**Depends on:** S4.1, S3.2

**Deliverables:** AI title/description generation in activity creation flow

---

### S4.4 — Activity Summary (AI insights, guidance, assessment)

**As a** user  
**I want** AI-generated insights, guidance, and assessment per activity  
**So that** I get value from each logged activity.

**Acceptance criteria:**
- [ ] On activity view: AI generates summary (insights, guidance, assessment)
- [ ] Display in activity detail or expandable section
- [ ] Cached or stored to avoid repeated calls (optional)
- [ ] Non-blocking: show loading state, then result

**Depends on:** S4.1, S3.5

**Deliverables:** Activity Summary component, server action

---

### S4.5 — Knowledge base schema and admin

**As a** admin  
**I want** to set party agendas, principles, priorities per space  
**So that** insights can align activities with party values.

**Acceptance criteria:**
- [ ] Migration: `knowledge_base` (space_id, content type, content, scope)
- [ ] Admin UI to add/edit knowledge base entries
- [ ] Used as context in insights generation (next story)

**Depends on:** S1.2

**Deliverables:** `supabase/migrations/008_knowledge_base.sql`, admin knowledge base UI

---

### S4.6 — Insights page (select activities → AI insights)

**As a** user  
**I want** to select activities and get AI-generated insights from the context graph  
**So that** I can create reports for my party.

**Acceptance criteria:**
- [ ] Insights page: select activities (multi-select)
- [ ] Context graph: selected activities + answers + knowledge base
- [ ] AI generates insights; display to user
- [ ] Save insights with notes to DB
- [ ] Export/share (basic: copy or download)
- [ ] Logged to llm_cost_logs

**Depends on:** S4.1, S4.5, S3.1

**Deliverables:** `src/app/(app)/insights/page.tsx`, insights schema, server actions

---

### S4.7 — Workspace dashboard (AI snapshot per category)

**As a** user  
**I want** a quick snapshot per category with stats and AI summary  
**So that** I see progress at a glance.

**Acceptance criteria:**
- [ ] Category dashboard: stats (activity count, recent), AI-generated summary (insights, guidance, assessment)
- [ ] Shown when opening a category or on channels list
- [ ] Cached or debounced to limit AI calls
- [ ] Next-steps guidance on activity add (optional)

**Depends on:** S4.1, S2.3, S3.3

**Deliverables:** Workspace dashboard component, category snapshot

---

## Epic 5: Storage and Infra

### S5.1 — S3 file uploads (presigned URLs)

**As a** user  
**I want** to attach images and files to activities  
**So that** I can document my work with evidence.

**Acceptance criteria:**
- [ ] Presigned URL flow: client requests URL, uploads to S3
- [ ] Store file references in activity attachments (JSON)
- [ ] Validate file types and sizes
- [ ] Display images in activity feed and detail

**Depends on:** S3.1, S3.2

**Deliverables:** `src/lib/s3/`, presigned URL API, attachment UI in activity form

---

### S5.2 — CloudFront and caching (optional)

**As a** developer  
**I want** CloudFront for static assets and optional API cache  
**So that** the app is fast and cost-efficient.

**Acceptance criteria:**
- [ ] CloudFront distribution for static assets
- [ ] Optional: API cache for read-heavy endpoints
- [ ] Vercel deployment config

**Depends on:** S5.1

**Deliverables:** Infra config, `vercel.json` or similar

---

## Epic 6: Admin

### S6.1 — Admin shell and user management

**As a** admin  
**I want** to manage users and spaces from a mobile-first admin UI  
**So that** I can provision and configure the app.

**Acceptance criteria:**
- [ ] Admin layout: mobile-first; separate from user app
- [ ] Users list: create, edit, deactivate
- [ ] Spaces: create, link to users
- [ ] Access codes: generate, assign to users
- [ ] Protected: admin role or separate auth

**Depends on:** S1.2, S1.5

**Deliverables:** `src/app/(admin)/layout.tsx`, users, spaces, access_codes management pages

---

### S6.2 — Admin: categories, catalog, questions

**As a** admin  
**I want** to manage category catalog and questions per category  
**So that** tenants can use standardized workspaces and activity fields.

**Acceptance criteria:**
- [ ] Category catalog: CRUD for pre-defined workspaces
- [ ] Questions: configure per category; question types (file, table, date, etc.)
- [ ] Admin can enable/disable features per space (space_features)

**Depends on:** S2.2, S3.1, S6.1

**Deliverables:** Admin pages for catalog, questions, space_features

---

### S6.3 — Drillable session tracing UI

**As a** support agent  
**I want** to look up a trace_id or session_id and see the full session timeline  
**So that** I can help users without asking them to repeat steps.

**Acceptance criteria:**
- [ ] Admin trace lookup: search by trace_id or session_id
- [ ] Display: session timeline, all actions, results (success/error, payload)
- [ ] Ability to "replay" or reconstruct user journey
- [ ] Mobile-friendly view
- [ ] Sanitized data (no secrets)

**Depends on:** S3.4, S6.1

**Deliverables:** Admin trace lookup page, session timeline component

---

### S6.4 — Admin: LLM cost dashboard

**As a** admin  
**I want** to view LLM usage and cost per space over time  
**So that** I can monitor spend and optimize.

**Acceptance criteria:**
- [ ] Dashboard: usage by space, period, operation
- [ ] Cost attribution (if cost data available)
- [ ] Basic filters and date range
- [ ] Mobile-friendly

**Depends on:** S4.2, S6.1

**Deliverables:** Admin LLM cost dashboard page

---

## Story dependency graph (summary)

```
Epic 1: S1.1 → S1.2, S1.3, S1.4, S1.6
         S1.2, S1.3, S1.4 → S1.5
         S1.5 → S1.7

Epic 2: S1.2 → S2.1, S2.2
         S2.2, S1.7 → S2.3
         S2.2, S1.6 → S2.4

Epic 3: S2.2 → S3.1
         S3.1, S2.3, S1.6 → S3.2
         S3.1, S2.3 → S3.3
         S1.3, S3.2 → S3.4
         S3.2, S3.3, S3.4 → S3.5
         S3.1, S2.3 → S3.6

Epic 4: S1.2 → S4.1, S4.5
         S4.1 → S4.2, S4.3, S4.4, S4.6, S4.7
         S4.5 → S4.6
         S4.1, S2.3, S3.3 → S4.7

Epic 5: S3.1, S3.2 → S5.1
         S5.1 → S5.2

Epic 6: S1.2, S1.5 → S6.1
         S2.2, S3.1, S6.1 → S6.2
         S3.4, S6.1 → S6.3
         S4.2, S6.1 → S6.4
```

---

## Suggested sprint order

| Sprint | Stories | Focus |
|--------|---------|-------|
| 1 | S1.1, S1.2, S1.3, S1.4, S1.6 | Foundation: project, DB, tracing, validation, toast |
| 2 | S1.5, S1.7 | Auth + app shell |
| 3 | S2.1, S2.2, S2.3, S2.4 | Spaces and categories |
| 4 | S3.1, S3.2, S3.3 | Activities: schema, creation, feed |
| 5 | S3.4, S3.5, S3.6 | Session tracing, activity details, calendar |
| 6 | S4.1, S4.2, S4.3 | AI provider, cost logging, title/description |
| 7 | S4.4, S4.5, S4.6, S4.7 | Activity summary, knowledge base, insights, workspace dashboard |
| 8 | S5.1, S5.2 | S3, CloudFront, deployment |
| 9 | S6.1, S6.2, S6.3, S6.4 | Admin: users, catalog, trace lookup, cost dashboard |

---

## Progress tracking

Copy this checklist and update as you complete stories:

```
[ ] S1.1  [ ] S1.2  [ ] S1.3  [ ] S1.4  [ ] S1.5  [ ] S1.6  [ ] S1.7
[ ] S2.1  [ ] S2.2  [ ] S2.3  [ ] S2.4
[ ] S3.1  [ ] S3.2  [ ] S3.3  [ ] S3.4  [ ] S3.5  [ ] S3.6
[ ] S4.1  [ ] S4.2  [ ] S4.3  [ ] S4.4  [ ] S4.5  [ ] S4.6  [ ] S4.7
[ ] S5.1  [ ] S5.2
[ ] S6.1  [ ] S6.2  [ ] S6.3  [ ] S6.4
```
