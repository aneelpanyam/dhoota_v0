# Simple Path App - Implementation Plan

> **Read this plan when working on PoCs/simple-path.** It is the source of truth for architecture, data model, and flows.
>
> **For story-by-story execution:** See [AGILE_PLAN.md](AGILE_PLAN.md) — 28 stories across 6 epics with acceptance criteria and sprint order.

## Scope

Build the **basic Activity Tracker** entirely within PoCs/simple-path. No dependencies on pipeline-poc or other folders. **Out of scope for now:** Suggestion Box, Public Site modules.

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

**Activity:** Always in category; `category_id` required.

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

**Core entities:** `system`, `users`, `spaces`, `space_notes`, `space_questions`, `space_answers`, `access_codes` (permanent, not one-time), `categories`, `category_collaborators`, `category_questions`, `category_answers`, `questions` (for activities), `category_catalog`, `activities`, `activity_answers`, `insights`, `ai_provider_config`, `knowledge_base`, `space_features`, `llm_cost_logs`, `session_traces` (drillable session context for support).

**Activity:** `raw_description`, `attachments`, `title` (AI-generated), `well_formed_description` (AI-generated), `category_id`, `created_by`. Answers in `activity_answers` (1:many).

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

## UI/UX (Mobile-First, WhatsApp-Inspired)

- **Entire app mobile-first** (including admin).
- **Channels:** Category list (workspaces); each shows quick snapshot/dashboard.
- **Activity feed:** Social media style; infinite scroll (cursor-based).
- **Workspace dashboard:** Quick snapshot per category — stats, recent activities, AI insights/guidance/assessment.
- **Activity creation:** Very intuitive for non-app-literate users. Contextual guidance, inline hints, examples, progressive disclosure, AI-suggested next steps. Plain language; consider wizard or conversational flow.
- **Status updates:** Non-intrusive, user-friendly. Subtle toasts or inline status (e.g. "Saving…", "Generating title…"); avoid blocking modals. Bottom/corner placement; auto-dismiss on success; persist on error with trace_id for support.
- **Fonts:** Inter or Nunito Sans. Colors: soft palette, high contrast for actions.

---

## Key Flows

1. Auth → access code + OTP → channels
2. Channels → categories with snapshot; tap → activity feed + dashboard
3. Categories → create/pick from catalog; notes, Q&A for planning; invite collaborators
4. Activities → add to category; intuitive flow; raw description + attachments → AI title/description → saved
5. Workspace dashboard → stats, AI summary per category
6. Calendar → activities by date
7. Insights → select activities → AI insights → save → export/share for parties
8. Admin → users, spaces, access codes, categories, catalog, questions, knowledge base, AI config; mobile-first

---

## Implementation Phases

**Phase 1:** Next.js 15, Supabase, auth (access code + OTP), tracing, logging, validation, layout.

**Phase 2:** Spaces (notes, Q&A), categories, activities, activity feed (infinite scroll), activity creation UX, calendar.

**Phase 3:** AI provider, llm_cost_logs, Activity Summary, Workspace dashboard, Insights page, knowledge base, report export.

**Phase 4:** S3, CloudFront, AWS cache, Vercel.

**Phase 5:** Admin (mobile-first).

**Phase 6 (Future):** Collaboration (category_collaborators, invite flow).

**Phase 7 (Future):** Suggestion Box, Public Site.

---

## Module Structure

```
PoCs/simple-path/
├── src/app/(auth)/          # Access code + OTP
├── src/app/(app)/            # Channels, workspace dashboard, activities, insights, calendar
├── src/app/(admin)/          # Admin
├── src/lib/supabase/, s3/, llm/, auth/, logger.ts, tracing.ts, validation/
├── supabase/migrations/
└── package.json
```
