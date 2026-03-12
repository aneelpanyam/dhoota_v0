# Design Decisions & Future Tasks

Captured during PoC development. Items here should be addressed when building the main application.

---

## 1. User Provisioning (Admin-Provisioned Flow)

**PoC approach:** Manual SQL insert to create a `users` row linking Supabase auth user to a tenant.

**Main app approach:** Admin-provisioned users.

- Admin or system creates the Supabase auth user via Admin API (`supabase.auth.admin.createUser(...)`) using the service_role key.
- Simultaneously inserts the `users` row with the correct `tenant_id`, `auth_user_id`, `email`, and `user_type`.
- Both operations happen in a single server-side transaction to keep auth and app user in sync.
- User receives an invite/welcome email, clicks through to the login page, and signs in with OTP — no waiting or manual intervention.
- This prevents orphaned auth users or missing tenant associations.

---

## 2. Row Level Security (RLS)

**PoC approach:** RLS is not enabled. All database access goes through Next.js API routes using the `service_role` key, which bypasses RLS. Tenant isolation is enforced in application logic.

**Main app approach:** If the frontend ever queries Supabase directly (e.g., for real-time subscriptions), RLS policies must be added. Helper functions (`tenant_id()`, `app_user_id()`) that extract claims from the JWT should be created in a custom schema (e.g., `app_helpers`) or in `public` with `EXECUTE` revoked from `anon`/`authenticated` roles.

---

## 3. Feature Flags

**PoC approach:** The `tenant_feature_flags` table exists but no option definitions currently require any flags (`required_toggles` is empty for all options). The infrastructure is ready for when features need to be gated per tenant.

---

## 4. SQL Execution Architecture

**PoC issue:** The `exec_raw_sql` database function wraps queries as subqueries, which fails for INSERT/UPDATE/DELETE with RETURNING. Fixed with CTE-based wrapping for write queries.

**Main app consideration:** The raw SQL execution approach (string interpolation in `executeRawQuery`) is a security concern. For the main app:

- Use parameterized queries via the `exec_sql` RPC function (which accepts `query_params`) as the primary path, not the string-interpolation fallback.
- The `exec_raw_sql` function should be eliminated or heavily restricted.
- Consider using Supabase's PostgREST API directly for standard CRUD instead of raw SQL execution.

---

## 5. SQL Template Defaults

**PoC issue:** INSERT templates that explicitly pass NULL for columns bypass PostgreSQL DEFAULT values. Fixed with COALESCE + type casts in the `activity.create` template.

**Main app rule:** All SQL templates with optional parameters must use `COALESCE($N, default_value)::type` pattern to ensure defaults are applied. Required for enum columns (`::activity_status`, `::activity_visibility`) and timestamp columns (`::timestamptz`).

---

## 6. Tag Persistence

**PoC status: Fixed.** Tags from the LLM refiner are now saved to `activity_tags` in `handleConfirmation`. Tag names are resolved to IDs, existing associations are cleared, and new ones inserted.

**Main app consideration:** Consider creating custom tags on the fly if the name doesn't match an existing tag, and handle tag removal more granularly on edit (only remove tags the user explicitly deselected).

---

## 7. Edit Flow (Client-Side Forms)

**PoC status: Fixed.** Implemented hybrid edit flow with `EditActivityFormWidget` -- an inline client-side form pre-filled with existing values. Structured fields (title, date, status, location, visibility) are editable directly; the form also supports media uploads. Only submits to the server on Save. The LLM refiner runs server-side on the submitted params to enhance descriptions.

---

## 8. Cancel/Dismiss Actions on Widgets

**PoC status: Fixed.** Cancel buttons are wired through the full component tree (`ChatContainer` -> `MessageList` -> `MessageBubble` -> `WidgetRenderer` -> widget). `cancelAction` in `useChat` resets conversation state, filters out interactive widgets from the previous message, and appends an "Action cancelled" message. Confirmation/QA response flows also strip the originating widget from history when the response arrives.

---

## 9. Follow-Up Context Passing

**PoC issue (fixed):** Follow-up action buttons (Edit, Add Note, Add Media) were built without passing the resource ID from the preceding operation. Fixed by extracting the resource ID from SQL results and including it in follow-up `params`.

**Main app rule:** Any follow-up action that operates on a specific resource must include the resource ID in its params. This should be a generic pattern, not limited to activities.

---

## 10. Next.js Compatibility

**PoC issue (fixed):** `cookies()` from `next/headers` returns a Promise in Next.js 15+ and must be `await`ed. The `createServerSupabase()` function was calling it synchronously.

**Main app rule:** Always use `async/await` with `cookies()` and `headers()` from `next/headers`. The `createServerSupabase()` function must remain async.

---

## 11. Supabase Auth Configuration

**PoC notes:**

- IAM resources (users, policies) are global in AWS, not region-specific.
- Supabase email OTP requires enabling "Use 6-digit OTP" in Dashboard > Auth > Providers > Email. Without this, Supabase sends a long magic link token instead.
- The email template must include `{{ .Token }}` for the OTP code to appear in the email.
- `emailRedirectTo` must point to `/api/auth/callback` for magic link fallback to work.
- Rate limiting on OTP emails is enforced by Supabase (free tier: ~1 per 60 seconds).

---

## 12. Pipeline Debug Logging and Request Tracing

**PoC status: Implemented.** The `PipelineTrace` class (`src/lib/pipeline/trace.ts`) wraps every pipeline step with timing, input/output capture, and error tracking. Configurable via `DEBUG_LOG_LEVEL` env var (`full` | `summary` | `off`, defaults to `full` in dev).

**How it works:**

- Each pipeline call creates a `PipelineTrace` instance that records steps via `trace.step(name, fn, captureInput)`.
- Trace data is returned in the API response as `debugTrace` on `ChatMessageResponse`.
- The frontend stores traces in `localStorage` per conversation (`dhoota_debug_{conversationId}`).
- A floating `DebugPanel` component (bottom-right bubble) lets developers inspect traces, expand individual steps, and see input/output/errors and durations.
- Initial load traces are also captured from the `/api/chat/init` response.

**Main app consideration:** In production, set `DEBUG_LOG_LEVEL=off` or `summary`. Consider persisting traces to a server-side log store (e.g., `option_executions` table) for production debugging.

---

## 13. Option-Driven Question Flow (Multi-Step Q&A)

**Decision:** Every option that performs a write operation is driven through a configurable question flow before execution. Questions are defined in the `option_questions` table with:

- `question_text`, `question_key` -- what to ask and which parameter it maps to.
- `inline_widget` -- widget type for structured input (`date_picker`, `file_upload`, `visibility_select`, etc.).
- `is_required` -- whether the question can be skipped.
- `question_order` -- sequencing.
- `groupable` -- whether the question can be shown alongside others.

The `qa-engine.ts` presents all unanswered questions (required and optional) and allows explicit skipping of optional ones. The LLM `groupQuestions` method can batch compatible questions into a single step to reduce round-trips.

**Main app consideration:** Question flows should be extensible to non-activity options (e.g., creating reports, scheduling events). The question grouping logic could use the LLM more aggressively for adaptive grouping based on user behavior patterns.

---

## 14. Follow-Up Options for Every Option

**Decision:** Every `option_definition` has a `follow_up_option_ids` array that defines what actions are available after the option completes. This creates a graph of user flows:

- `activity.create` -> `[activity.add_note, activity.add_media, activity.list]`
- `activity.list` -> `[activity.create, view.stats]`
- `activity.view` -> `[activity.edit, activity.add_note, activity.add_media, activity.delete]`

Follow-ups are rendered as pill buttons below each response. For activity lists, per-item actions (`activity.view`, `activity.edit`, etc.) are deterministically attached to `data_list` widgets via `attachItemActions` in the pipeline, rather than relying on the LLM to generate them.

**Main app consideration:** The follow-up graph should be configurable per user type and feature flag. Consider adding conditional follow-ups (e.g., only show "Delete" to admins).

---

## 15. Option-Specific Pre-Processing (Refinement Prompts)

**Decision:** Each option can define a `refinement_prompt` in the `option_definitions` table. This prompt is passed to the LLM during the `refineInput` step, replacing the generic hardcoded prompt. This allows each option to customize how raw user input is transformed into professional, well-formed data.

**How it works:**

- `option_definitions.refinement_prompt` (text, nullable) -- option-specific LLM instructions.
- `refiner.ts` passes `option.refinement_prompt` through `RefinementContext` to the LLM provider.
- `openai.ts` uses the option-specific prompt when available, falls back to a generic prompt.
- Example for `activity.create`: instructs the LLM to create a clear 5-10 word title, expand the description professionally, infer status from tense, default visibility to private, etc.

**Main app consideration:** This pattern extends to any option type. Pre-processing steps could be chained (e.g., extract entities -> enrich with external data -> format). Consider storing multiple pre-processing step definitions per option rather than a single prompt.

---

## 16. AI Summary Stored in Database

**Decision:** When an activity is created or edited, an AI-generated summary is computed and stored in the `activities.ai_summary` jsonb column. This eliminates the need for LLM calls when viewing or listing activities.

**Schema:**

```json
{
  "enhancedTitle": "Hospital Facilities Inspection",
  "enhancedDescription": "Visited the local government hospital to inspect facilities...",
  "highlights": ["Inspection", "Bansawadi"],
  "generatedAt": "2026-03-12T..."
}
```

**How it works:**

- After `handleConfirmation` saves the activity, tags, and media, a `generate_ai_summary` trace step calls `generateActivitySummary` (gpt-5-nano) and stores the result.
- `formatter.ts` uses deterministic formatting for `activity.list`, `activity.view`, `activity.create`, `activity.edit`, `activity.delete`, and `view.stats` -- no LLM call needed.
- The deterministic formatter reads `ai_summary.enhancedTitle` and `ai_summary.enhancedDescription` from the DB rows for display.
- If `ai_summary` is null (old records), the raw `title`/`description` are used as fallback.

**Performance impact:** Initial load went from ~7-10 seconds (two LLM `formatResponse` calls) to sub-second (direct SQL + deterministic formatting).

**Main app consideration:** The summary should be regenerated when an activity is edited, and potentially on a schedule for activities that gain new notes or media. Consider a background job for bulk regeneration.

---

## 17. Chat Collapse After Activity Save

**Decision:** When an activity is saved (confirmation response), all preceding messages that belong to the activity creation/edit flow (user messages, Q&A questions, answers, confirmation cards, text prompts) are collapsed into the resulting activity card. The user sees only the final activity card with a "Show conversation (N messages)" toggle to expand the full history.

**How it works:**

- `ChatMessage` interface has an optional `collapsedMessages?: ChatMessage[]` field.
- When a confirmation response arrives in `use-chat.ts`, `collapseFlowMessages` walks backwards from the end of the messages array, collecting contiguous flow messages (user answers, question cards, confirmation cards, text responses).
- The collected messages are removed from the main array and attached as `collapsedMessages` on the new response message.
- `MessageBubble.tsx` renders a toggle above the activity card when `collapsedMessages` is present, with a compact indented view of the conversation thread when expanded.

**Main app consideration:** The collapse logic currently identifies flow boundaries by message type. A more robust approach would be to tag messages with a `flowId` during the Q&A/confirmation process so the collapse can handle interleaved conversations.

---

## 18. Social Media-Style Activity Display

**Decision:** Activity cards are designed to resemble social media posts (Twitter/WhatsApp) for a familiar, engaging user experience.

**Layout:**

- **Hero image/grid:** Full-width image for single media, side-by-side for 2, 1+2 layout for 3, and 2x2 grid with "+N" overlay for 4+ images.
- **Title and description:** Bold title as heading, description as body text below images.
- **Meta row:** Date, location, visibility icon -- compact and inline.
- **Tags:** Subtle colored pills below description.
- **Action bar:** Evenly spaced action buttons across the bottom (like social post actions).

**File previews during upload:** Image thumbnails are shown using `URL.createObjectURL` in both the Q&A file upload widget and the edit activity form, arranged in a grid layout.

**List view thumbnails:** Activity list items show a 48x48 thumbnail on the left when the activity has media.

**Main app consideration:** Add image lightbox/fullscreen viewer, video playback support, and lazy loading for images. Consider different card layouts per content type (text-only, media-heavy, event-style).

---

## 19. LLM Model Selection

**Decision:** Use the fastest, cheapest model appropriate for each pipeline task:

| Pipeline Step | Model | Reasoning |
|---|---|---|
| `classifyIntent` | gpt-5-nano | Classification task, well-constrained |
| `extractParams` | gpt-5-nano | Text extraction, structured output |
| `refineInput` | gpt-5-nano | Summarization/rewriting, option-specific prompt |
| `formatResponse` | gpt-5-nano | Now mostly unused (deterministic formatting) |
| `generateActivitySummary` | gpt-5-nano | Summarization, well-constrained prompt |
| `generateDynamicSQL` | gpt-5-mini | SQL generation benefits from stronger reasoning |
| `groupQuestions` | Deterministic | No LLM needed, simple grouping logic |

All LLM calls use `temperature: 0` for deterministic output except where creativity is needed.

**Cost/speed:** gpt-5-nano is 10x cheaper on input and ~3.8x cheaper on output than gpt-3.5-turbo, with 134 tokens/sec output speed and 0.67s median TTFT.

---

## 20. Next.js 16: Middleware Renamed to Proxy

**PoC status: Fixed.** Next.js 16 deprecated the `middleware.ts` file convention and renamed it to `proxy.ts`. The exported function must also be renamed from `middleware()` to `proxy()`.

**Key changes in Next.js 16:**

| Aspect | Middleware (deprecated) | Proxy (Next.js 16+) |
|---|---|---|
| File name | `middleware.ts` | `proxy.ts` |
| Export name | `middleware()` | `proxy()` |
| Runtime | Edge (default) | Node.js (fixed) |
| Node.js API access | Limited | Full |

**Why Next.js made this change:**

- "Proxy" better describes the feature's purpose -- intercepting and forwarding requests at the network boundary.
- Follows security improvements after CVE-2025-29927.
- Discourages misuse for business logic (a common mistake from Express.js developers).
- Node.js runtime provides full API access and better debugging.

**Migration:** Rename `src/middleware.ts` to `src/proxy.ts`, change `export async function middleware(...)` to `export async function proxy(...)`. The `config` object and `NextRequest`/`NextResponse` APIs remain identical. An automated codemod is available: `npx @next/codemod@canary middleware-to-proxy .`

---

## 21. OpenAI Responses API (Upgraded from Chat Completions)

**Decision:** All LLM calls use the OpenAI Responses API (`client.responses.create`) instead of the Chat Completions API (`client.chat.completions.create`).

**Key changes from Chat Completions to Responses API:**

| Aspect | Chat Completions (old) | Responses API (new) |
|---|---|---|
| Method | `client.chat.completions.create` | `client.responses.create` |
| System prompt | `messages: [{role: "system", content: ...}]` | `instructions: "..."` |
| User input | `messages: [{role: "user", content: ...}]` | `input: "..."` |
| JSON mode | `response_format: { type: "json_object" }` | `text: { format: { type: "json_object" } }` |
| Max tokens | `max_completion_tokens: N` | `max_output_tokens: N` |
| Response text | `response.choices[0].message.content` | `response.output_text` |
| Finish reason | `response.choices[0].finish_reason` | `response.status` |

**Why:** The Responses API is OpenAI's recommended path forward. It provides a cleaner interface, built-in tool use, and future features. The `openai` SDK was upgraded from `^4.80.0` to `^6.27.0`.

---

## 22. Deterministic Formatting for Read Operations

**Decision:** All predefined read operations (`activity.list`, `activity.view`, `view.stats`, `tag.manage`) and simple write responses (`activity.add_note`, `activity.add_media`, `tag.create`) use deterministic formatting instead of LLM-based formatting.

**How it works:**

- `formatter.ts` maintains a `DETERMINISTIC_OPTIONS` set listing option IDs that bypass LLM formatting.
- Each deterministic option has a custom formatter function (e.g., `formatActivityList`, `formatActivityView`, `formatTagList`) that transforms SQL results directly into widgets.
- The LLM `formatResponse` is only called as a fallback for dynamic queries and truly novel option types.

**Benefits:** Faster response times (no LLM round-trip), consistent output, and no risk of LLM hallucinating widget structures.

---

## 23. Collapsible Navigation Sidebar (Mobile Responsive)

**Decision:** The conversation sidebar is collapsible for mobile responsiveness, using a hamburger menu button.

**Implementation:**

- `ConversationSidebar.tsx` manages `isOpen` state via `useState`, defaulting to closed on mobile.
- A hamburger menu button (fixed `top-4 left-4 z-50`) toggles the sidebar.
- On mobile, the sidebar overlays as a drawer (`fixed inset-y-0 left-0 z-40 w-72`).
- Clicking a conversation or pressing `Escape` closes the sidebar.
- `ChatContainer.tsx` header has `pl-14 md:pl-6` to accommodate the hamburger button.

---

## 24. Conversation History & Persistence

**Decision:** Chat sessions are persisted to the database and can be revisited, similar to ChatGPT's conversation list.

**How it works:**

- `POST /api/chat/init` reuses existing conversations or creates new ones, and persists initial messages.
- `POST /api/chat/message` updates the conversation title on the first `chat` source message.
- `GET /api/chat/conversations` lists all user conversations sorted by `updated_at`.
- `GET /api/chat/conversations/[id]` loads a specific conversation's full message history.
- `useChat` hook manages conversation switching, loading, and creation.
- `ConversationSidebar` displays the conversation list and handles selection.

---

## 25. Markdown Rendering with react-markdown

**Decision:** Text responses use `react-markdown` for robust markdown rendering instead of custom inline parsing.

**Why:** Custom regex-based markdown parsing was fragile and couldn't handle nested structures, lists, blockquotes, or code blocks correctly. `react-markdown` provides complete CommonMark support.

**Implementation:** `TextResponseWidget.tsx` uses `<Markdown>` with custom component overrides for consistent styling (prose classes, proper spacing, link handling).

---

## 26. Context-Aware Dynamic Queries

**Decision:** When a user types a free-text query that doesn't match any predefined option, the system uses a two-step interactive flow instead of generating SQL from scratch.

**Flow:**

1. **Context Analysis:** The LLM analyzes the user's query against predefined data contexts (`my_activities`, `specific_activity`, `tags_breakdown`, `activity_timeline`, `notes_search`) and ranks them by relevance.
2. **Context Picker:** If multiple contexts are relevant (or the top match has <90% confidence), a `context_picker` widget is shown, letting the user choose where to search.
3. **Contextual SQL Generation:** Once a context is selected, the LLM generates SQL by modifying the context's base query (adding WHERE clauses, aggregations, ORDER BY, etc.) rather than writing SQL from scratch.
4. **Auto-select:** If a single context has ≥90% relevance, it's automatically selected without showing the picker.

**Why this approach:**

- **Safety:** The LLM can only modify a known-good base query, not write arbitrary SQL. The base queries already handle tenant isolation (`$1 = tenant_id`), proper joins, and column selection.
- **Accuracy:** Constrained SQL generation (given available columns and allowed operations) is far more reliable than open-ended generation.
- **User control:** The context picker gives users visibility into what data the system will search, reducing confusion.
- **Extensibility:** New contexts can be added to `query-contexts.ts` without changing the pipeline logic.

**Architecture:**

- `src/lib/pipeline/query-contexts.ts` — defines `QueryContext` type and `QUERY_CONTEXTS` array with base SQL, available columns, and allowed operations per context.
- `src/lib/pipeline/dynamic-sql.ts` — orchestrates context analysis, picker widget creation, and contextual query execution.
- `src/lib/llm/openai.ts` — `analyzeQueryContexts` (gpt-5-nano) and `generateContextualDynamicSQL` (gpt-5-mini) methods.
- `src/components/widgets/ContextPickerWidget.tsx` — interactive widget for context selection.

---

## 27. LLM Error Handling and Fallbacks

**Decision:** All LLM calls are wrapped in try/catch with meaningful fallbacks. Key patterns:

- `refineInput` falls back to `buildRefineFallback` which derives a short title from raw input and preserves all user-provided data.
- `classifyIntent` returns `{ optionId: null, confidence: 0 }` on failure, triggering dynamic query flow.
- `formatResponse` falls back to raw JSON display in a `text_response` widget.
- `generateContextualDynamicSQL` falls back to the base query with `LIMIT 20`.
- The `temperature` parameter is not used with `gpt-5-nano` (unsupported), preventing silent failures.
- LLM output truncation is detected via `response.status === "incomplete"` and triggers fallback.

---

## 28. Debug Trace: LLM and SQL Capture

**Decision:** The debug panel captures full LLM prompts/responses and SQL queries for every pipeline step.

**Implementation:**

- Module-level capture variables (`_llmCallDebug` in `openai.ts`, `_sqlCallDebug` in `executor.ts`) store the most recent LLM/SQL call details.
- After each `trace.step()`, `trace.enrichLastStep()` consumes and attaches the captured debug data.
- `DebugPanel.tsx` renders expandable LLM sections (model, system prompt, user input, response, finish reason) and SQL sections (query text, params, row count).

---

## 29. Skip Refinement for Simple Options

**Decision:** Options that don't benefit from LLM refinement (`activity.add_note`, `activity.add_media`, `activity.delete`, `tag.manage`, `tag.create`) bypass the `refineInput` step entirely.

**Why:** These options have predictable, structured inputs (e.g., a note's content, a file reference) that don't need AI enhancement. Skipping refinement saves ~1-2 seconds per request.

**Implementation:** `SKIP_REFINEMENT_OPTIONS` set in `index.ts` controls which options skip refinement and use `buildSimpleDisplayFields` for confirmation cards instead.

---

## 30. S3 Media Access via Presigned URLs

**Decision:** S3 media objects are private and accessed through server-generated presigned read URLs, not direct public URLs.

**How it works:**

- `generatePresignedReadUrl` in `s3.ts` creates time-limited signed URLs for reading S3 objects.
- `GET /api/media/serve?key=<s3_key>` generates a presigned URL and redirects the client to it.
- `ActivityCardWidget` and `DataListWidget` use this proxy endpoint for all media display.

**Why:** Direct S3 access would require public bucket policies. Presigned URLs maintain security while providing direct S3 delivery to the client.

---

## 31. Conversation Flow Collapsing

**Decision:** When an activity is saved or an action is cancelled, all related conversation messages (Q&A, confirmations, user responses) are collapsed into the final result card, keeping the chat clean.

**Implementation:**

- Messages are tagged with a `flowId` (assigned when a flow starts via default option, inline action, or chat).
- `flowStartIndexRef` tracks the message index where the current flow began.
- On confirmation or cancellation, messages matching the `flowId` or within the flow index range are collected as `collapsedMessages` on the result message.
- `MessageBubble.tsx` renders a "Show conversation (N messages)" toggle for collapsed messages.

---

## 32. Follow-Up Resource ID Resolution

**PoC issue (fixed):** When `activity.add_note` completes, the SQL `INSERT INTO activity_notes ... RETURNING *` returns the *note's* ID in `rows[0].id`. `extractResourceId` was picking this up and passing it as `activity_id` to follow-up actions like "View Activity Details", causing "Activity not found" errors.

**Fix:** Introduced `resolveActivityResourceId(params, optionId, sqlResults)` which checks if the option operates on an existing activity (`activity.add_note`, `activity.add_media`, `activity.view`, `activity.edit`, `activity.delete`). For these options, the `activity_id` from the request params takes precedence over the SQL result ID. For `activity.create`, the SQL result ID is used (since the activity was just created).

**Main app rule:** Any option that operates on a child entity (note, media, tag association) must carry the parent entity's ID in its params. `resolveActivityResourceId` should be generalized to `resolveParentResourceId` supporting multiple entity types.

---

## 33. Entity Context Banner for Follow-Up Actions

**Decision:** When a follow-up action operates on a specific entity (e.g., adding a note to an activity), a context banner is shown above question cards and confirmation cards, displaying the target entity's title and metadata.

**Implementation:**

- `fetchEntityContext(params, tenantId)` in `index.ts` queries the activities table for the `activity_id` and returns the title (from `ai_summary.enhancedTitle` or raw title), status, and date.
- The returned `EntityContext` object (`{ entityType, entityId, title, subtitle }`) is injected into widget data as `entityContext`.
- `QuestionCardWidget` and `ConfirmationCardWidget` render a compact banner with an icon, entity title, and subtitle (status + date).
- A `text_response` widget is also added before question cards: e.g., "**Add Note** for: *Hospital Facilities Inspection* (completed · Mar 12, 2026)".

**Why:** Without context, users performing follow-up actions had no visual indication of *which* activity they were acting on, leading to confusion.

---

## 34. Intelligence Queries vs Data Queries

**Decision:** Dynamic queries (free-text that doesn't match a predefined option) are classified into two modes:

| Mode | Purpose | Example | Flow |
|---|---|---|---|
| **Data** | Factual: counts, lists, filters, aggregations | "How many activities this week?" | SQL → widget |
| **Intelligence** | AI reasoning: insights, ideas, analysis, recommendations | "Give me insights about this activity" | Fetch data → LLM analysis → markdown |

**How it works:**

1. `analyzeQueryContexts` (gpt-5-nano) returns `queryMode: "data" | "intelligence"` alongside context suggestions.
2. For **intelligence + entity reference** (e.g., "this activity"): `resolveEntityFromConversation` scans recent messages for `input_params.activity_id` on activity-related options. The full entity data (activity, notes, tags, media) is fetched and passed to `analyzeDataWithContext` (gpt-5-mini) which produces a rich markdown analysis with follow-up suggestions.
3. For **intelligence + no entity**: the best-matching context's data is fetched via SQL, then passed to the AI analysis.
4. For **data queries**: the existing context picker → SQL → widget flow continues.

**Entity reference resolution:** The word patterns `this`, `that`, `the`, `it`, `current` trigger a reverse scan of `recentMessages` looking for `activity.view`, `activity.edit`, etc. option IDs with `inputParams.activity_id`. The `ConversationMessage` type was extended with `inputParams` and the `loadRecentMessages` query now includes `input_params` from the messages table.

**Why this matters:** The platform's value isn't just in querying data — it's in providing AI-powered intelligence on top of user data. "Give me activity ideas like this one" or "What could improve this activity?" are the kinds of queries that differentiate the platform from a simple CRUD tool.

---
