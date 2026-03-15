# Simple Path App - Implementation Plan

> **Read this plan when working on PoCs/simple-path-opus.** It is the source of truth for architecture, data model, and flows.
>
> **For step-by-step execution:** See [STEPS.md](STEPS.md) — 14 steps with acceptance criteria. Process: [steps/PROCESS.md](steps/PROCESS.md).

## Scope

Build the **basic Activity Tracker** entirely within PoCs/simple-path-opus. No dependencies on pipeline-poc or other folders. **Out of scope for now:** Suggestion Box, Public Site modules.

**Future phases:** Suggestion Box and Public Site will be added later. Design with extensibility in mind for both.

---

## Product Vision (Domain Context)

**Target users:** Political workers, candidates contesting elections, and elected representatives.

**Goal:** Help users capture their activities and use a **context graph** (activities + answers + party knowledge base) to generate insights and reports they can showcase to their parties.

**Context graph:** The combined context fed to AI for insights — user's activities, answers, tags, notes, plus the party's knowledge base (agendas, principles). This enables AI to produce insights that show how activities align with party values.

**Knowledge base (party-level):** Admin sets party agendas, principles, priorities per space. Used during insights generation so users get guidance on how their activities align with these aspects. Enables reports that resonate with party leadership.

---

## User Management Model

**No traditional tenant.** Business model: sell to user types (political workers, candidates, representatives), not to organizations. Primary entity is the **User**.

**Provisioning:** Admin provisions users only. Each provisioned user gets a **space** (their workspace) when they purchase. No org/tenant hierarchy.

**Category = workspace/workstream:** Category is the primary unit for collaboration and grouping. Think of it as a workspace or workstream.

- **Flexible activity capture:** User logs activities directly into a category. No tasks abstraction — planning is done via space/category-level notes and Q&A.
- **Collaboration at category level:** Create category → invite users to category → users add activities. Users see: their own categories, invited categories, categories they shared.
- **Extensibility:** Future: collaboration features for shared categories; control visibility and access when category becomes shared.
- **System catalog:** Pre-defined workspaces (categories) that users can pick from or create custom.

**Category (workspace) structure:** `title`, `description`, `notes`; Q&A (`category_questions`, `category_answers`); User uses notes and Q&A at category/space level for planning. Can be personal (own) or shared (invited users).

**Activity:** Always in category; `category_id` required. Activities support `participants` (JSONB array of name/role pairs), `tags` (text array), `notes`, `status` (draft/active/completed), `social media posts` (per-activity tracking of related social content), and `activity linking` (relate activities to each other as related/parent/follows).

---

## Tech Stack

| Layer        | Choice                                                                     |
| ------------ | -------------------------------------------------------------------------- |
| Framework    | Next.js 15 (App Router)                                                    |
| DB           | Supabase (Postgres + Auth + Realtime)                                      |
| File Storage | S3 (via presigned URLs)                                                    |
| Caching      | AWS ElastiCache or DynamoDB (for session/cache)                            |
| CDN          | CloudFront (static assets + API cache)                                     |
| Hosting      | Vercel                                                                     |
| Auth         | Admin-generated permanent access codes + OTP (simplified MFA); future TOTP |
| Logging      | AWS CloudWatch Logs                                                        |
| Tracing      | OpenTelemetry-compatible (trace IDs for request correlation)               |

**Packages:** Latest stable, trusted packages. Pin major versions.

---

## Data Model (Supabase)

**Core entities:** `system`, `users`, `spaces`, `space_notes`, `space_questions`, `space_answers`, `access_codes` (permanent, not one-time), `categories`, `category_collaborators`, `category_questions`, `category_answers`, `questions` (for activities), `category_catalog`, `activities`, `activity_answers`, `activity_links`, `activity_social_posts`, `insights`, `ai_provider_config`, `knowledge_base`, `space_features`, `llm_cost_logs`, `session_traces` (drillable session context for support).

**Activity:** `raw_description`, `attachments`, `title` (AI-generated), `well_formed_description` (AI-generated), `status` (draft/active/completed), `participants` (JSONB), `tags` (text[]), `notes`, `category_id`, `created_by`. Answers in `activity_answers` (1:many). Links in `activity_links` (many:many self-referential). Social posts in `activity_social_posts` (1:many).

**Auth:** Admin creates permanent access code → User enters code + OTP → Session created. Future: TOTP.

---

## Observability

- **Tracing:** `trace_id` per request; propagate; return on errors.
- **Logging:** Structured JSON to CloudWatch; log auth, activities, AI calls, validation failures.
- **LLM cost:** `llm_cost_logs` — provider, model, operation, input/output tokens, latency, space_id, trace_id.
- **Drillable session tracing:** `session_traces` — capture session_id, user actions (action_type, action_params), results (success/error, payload). Support can look up by trace_id or session_id and reconstruct full context (user journey, actions, outcomes) without asking the user.

---

## Security & Validation

- **Session timeout:** JWT expiry; idle timeout.
- **Access codes:** Permanent (like PIN); code + OTP each login.
- **Input validation:** Zod frontend + server; never trust client. DB constraints, RLS.

---

## AI Provider Abstraction

**AI is a core, powerful module.** Expect many AI-powered features. Design LLM layer for extensibility.

- **Activity Summary:** Insights, Guidance, Assessment per activity.
- **Category/Workspace Summary:** Insights, Guidance, Assessment per category.
- **Insights page:** Context graph → AI-generated insights and reports → export/share.
- **Next-steps guidance:** On activity add; on workspace view.
- **Knowledge-base alignment:** How activities align with party agendas.

Admin-configurable providers: OpenAI, Gemini, Perplexity. All calls logged to `llm_cost_logs` and CloudWatch.

---

## UI/UX (Mobile-First — Slack + Notion + ChatGPT)

**Design mental model:** The app feels like a combination of **Slack** (channel-based navigation), **Notion** (rich, expandable activity pages), and **ChatGPT** (conversational AI interactions). Every screen is mobile-first, including admin.

### Navigation: Slack-Style Drill-Down

The primary navigation is a **drill-down hierarchy**, not tab-hopping:

```
Categories (home) → Activity list (inside a category) → Activity page (Notion-style)
```

- **Home screen** = Category list, styled like Slack channels. Each channel shows a snapshot (title, description snippet, activity count, last activity date).
- **Inside a category** = Activity list, like messages in a Slack channel. Infinite scroll, most recent first. FAB to add a new activity.
- **Activity page** = Opens as a full Notion-style page (new route, clean layout, back arrow). Not a modal or sidebar.

A **minimal bottom bar** provides access to global views: **Channels** (home), **Calendar**, **Insights**, **Profile**. The drill-down within Channels is the primary flow; Calendar and Insights are secondary global views.

### Activity Page: Notion-Style

Each activity opens as a rich, self-contained page:

- **Header:** Title (AI-generated) or raw description fallback, status badge, date
- **Description section:** Raw description, well-formed description (AI), editable inline
- **Question answers as accordions:** Each category question is a collapsible toggle section (like Notion toggles). Tap to expand, see the answer. Clean, scannable — not a long form.
- **Enrichment sections below:** Tags, participants, linked activities, social media posts — each as a collapsible or always-visible section
- **Notes/comments at the bottom:** Like a Notion page's comment thread. Inline-editable. This is where users add context over time.
- **AI section:** Activity summary (insights, guidance, assessment) — displayed inline, conversational tone

### Activity Creation: Conversational + Progressive

- Feels like starting a conversation (ChatGPT-like) — "What did you do?" as the opening prompt
- Progressive disclosure: description first → questions appear → optional enrichment
- AI responds with a generated title and next-steps guidance, like a helpful assistant
- Warm, encouraging inline hints for non-app-literate users

### Admin: Same Drill-Down Pattern

Admin follows the same mobile-first drill-down: Admin sections as "channels" → list of items → item detail page. Same Notion-style detail pages for user profiles, category management, etc.

### Status Updates

Non-intrusive, user-friendly. Subtle toasts or inline status (e.g. "Saving...", "Generating title..."); avoid blocking modals. Bottom/corner placement; auto-dismiss on success; persist on error with trace_id for support.

### Design Tokens

**Fonts:** Inter or Nunito Sans. **Colors:** soft palette, high contrast for actions.

---

## Key Flows

1. Auth → access code + OTP → channel list (home)
2. Channel list (home) → categories as Slack channels with snapshot; tap → activity list inside channel
3. Inside channel → activity list (infinite scroll); tap activity → Notion-style activity page
4. Activity page → rich page with accordion question answers, notes/comments, tags, participants, social posts, linked activities, AI summary
5. Create activity → conversational flow ("What did you do?") → progressive disclosure → AI title/guidance → saved as new page in channel
6. Workspace dashboard → stats, AI summary per category (accessible from channel header or tab within channel)
7. Calendar (bottom bar) → global view, activities by date across categories
8. Insights (bottom bar) → select activities → AI insights → save → export/share for parties
9. Admin → same drill-down pattern: admin sections as channels → item lists → Notion-style detail pages

---

## Implementation Phases

See [STEPS.md](STEPS.md) for the detailed 14-step execution roadmap with dependencies and acceptance criteria.

**Phase 1 (Steps 01–04):** Bootstrap, database schema, auth flow, app shell + design system.

**Phase 2 (Steps 05–07):** Categories, activity creation, activity feed + management (including participants, tags, social posts, linking).

**Phase 3 (Steps 08–10):** AI engine, knowledge base + workspace dashboard, insights engine.

**Phase 4 (Steps 11–12):** Calendar, session tracing, file storage (S3 + CloudFront).

**Phase 5 (Step 13):** Admin module (mobile-first).

**Phase 6 (Step 14):** Integration testing + polish + deployment observability (CloudWatch log drain setup).

**Future:** Collaboration (category_collaborators, invite flow), Suggestion Box, Public Site.

---

## Module Structure

```
PoCs/simple-path-opus/
├── src/app/(auth)/           # Access code + OTP
├── src/app/(app)/            # Channels, workspace dashboard, activities, insights, calendar
├── src/app/(admin)/          # Admin
├── src/lib/
│   ├── supabase/             # Client, server, helpers, generated types
│   ├── s3/                   # Presigned URLs, file operations
│   ├── llm/                  # AI provider abstraction, prompts, cost logging
│   ├── auth/                 # Auth utilities (getCurrentUser, requireAuth, requireAdmin)
│   ├── services/             # Business logic layer (activities, categories, insights, etc.)
│   ├── validation/           # Zod schemas and validation helpers
│   ├── logger.ts             # Structured JSON logging
│   ├── tracing.ts            # Request trace_id (AsyncLocalStorage)
│   └── session-tracing.ts    # Drillable session traces for support
├── src/components/
│   ├── ui/                   # Shared UI kit (Button, Input, Card, Sheet, Toast, etc.)
│   ├── activity/             # Activity-specific components (wizard, feed item, detail)
│   ├── calendar/             # Calendar view components
│   ├── dashboard/            # Workspace dashboard components
│   ├── insights/             # Insights generation and display components
│   ├── knowledge-base/       # Knowledge base editor components
│   └── navigation/           # Bottom nav, app shell components
├── supabase/migrations/      # Numbered SQL migrations
├── steps/                    # PBP step briefs and process
├── PLAN.md                   # This file
├── ARCHITECTURE.md           # Living mental model (created in Step 01)
├── CONTEXT.md                # Living context (updated after each step)
├── STEPS.md                  # Execution roadmap
└── package.json
```
