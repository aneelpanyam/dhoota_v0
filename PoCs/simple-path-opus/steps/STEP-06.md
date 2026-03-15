# Step 06: Activity Creation + Schema

## Goal

Build the activity data model and the conversational creation flow — the core user action of the entire app. Creating an activity should feel like starting a conversation (ChatGPT) that produces a rich Notion-style page inside a Slack channel.

## Acceptance Criteria

### Schema

- [ ] Migration `003_activities.sql`: `questions`, `activities`, `activity_answers`, `activity_links`, `activity_social_posts`
- [ ] `questions` table: id, category_id (FK), question_text, question_type (enum: text, file, table, date, email, phone, rich_text), is_required, sort_order, config (JSONB — type-specific settings), created_at
- [ ] `activities` table: id, category_id (FK), title (AI-generated, nullable initially), raw_description (text), well_formed_description (AI-generated, nullable), status (enum: draft, active, completed), participants (JSONB array), tags (text array), attachments (JSONB — file refs), notes (text), created_by (FK -> users), created_at, updated_at
- [ ] `activity_answers` table: id, activity_id (FK), question_id (FK), value (JSONB — flexible by question type), created_at, updated_at
- [ ] `activity_links` table: id, source_activity_id (FK), target_activity_id (FK), link_type (enum: related, parent, follows), created_by, created_at
- [ ] `activity_social_posts` table: id, activity_id (FK), platform (text), content (text), url (text, nullable), posted_at (timestamp, nullable), created_at
- [ ] RLS: users CRUD own activities (via space -> category ownership); collaborators based on category_collaborators role
- [ ] Indexes: category_id, created_by, created_at (for feed ordering), status, tags (GIN)

### Activity Creation (Conversational + Progressive)

- [ ] Creation page (`src/app/(app)/channels/[categoryId]/activities/new/page.tsx`)
- [ ] **Opening prompt:** "What did you do?" — large, friendly text input with inline hint ("Describe what you did in your own words"). Feels like starting a chat with ChatGPT.
- [ ] **Progressive disclosure:** After the user fills the description:
  - Category questions appear as expandable sections (accordion-style, like Notion toggles)
  - Each question rendered by type (text, date, email, phone, file placeholder, table placeholder, rich_text)
  - Optional enrichment appears last: tags, participants, notes
- [ ] **One primary action per screen section** — don't overwhelm. Sections appear progressively as the user fills them.
- [ ] Question type renderers — one component per question type (text, date, email, phone, file placeholder, table placeholder, rich_text placeholder)
- [ ] Activity creation server action: validate with Zod, save to DB, log with trace_id
- [ ] **Success feedback:** Toast confirmation + option to add another activity. After save, navigate to the new activity's Notion-style page.
- [ ] All form inputs validated client-side (Zod) for immediate feedback + server-side for security

## Key Files (expected)

```
supabase/migrations/003_activities.sql
src/app/(app)/channels/[categoryId]/activities/new/page.tsx
src/app/(app)/channels/[categoryId]/activities/actions.ts
src/lib/services/activities.ts
src/lib/validation/activities.ts
src/components/activity/creation-wizard.tsx
src/components/activity/question-renderers/
    text-question.tsx
    date-question.tsx
    email-question.tsx
    phone-question.tsx
    file-question.tsx       (placeholder)
    table-question.tsx      (placeholder)
    rich-text-question.tsx  (placeholder)
```

## Dependencies

- Step 05 (categories schema, channel list, category detail page)

## Context to Read

- `PLAN.md` — Data Model (Activity), UI/UX section (Slack + Notion + ChatGPT), Key Flows (5)
- `.cursor/rules/ux-activity-creation.mdc` — UX principles for non-app-literate users
- `.cursor/rules/data-model.mdc` — Activity model reference
- `ARCHITECTURE.md` — server action pattern, service layer, validation, Accordion component
- `CONTEXT.md` — Steps 01–05 decisions

## Testing Requirements

- [ ] Activity creation: valid input saves activity with correct category_id and created_by
- [ ] Answer validation: required questions must have answers; type-specific validation (email format, phone format, date format)
- [ ] Activity creation with missing required fields returns structured Zod errors with trace_id

## Notes

- **This is the most important UX in the app.** The target users may have basic app literacy. Every design decision should reduce cognitive load.
- The creation flow should feel like **starting a conversation** (ChatGPT-like), not filling out a form. The opening "What did you do?" prompt sets this tone.
- Questions appear as **Notion-style toggles/accordions** — each question is a collapsible section the user can expand to answer. This keeps the page clean and scannable.
- Inline hints should be warm and encouraging: "Describe what you did in your own words", "Who else was involved?", "Add tags to organize later"
- `title` and `well_formed_description` are AI-generated — they will be null on creation and populated in Step 08 (AI Engine). Design the UI to handle null gracefully (show raw_description as fallback).
- `attachments` is JSONB storing file references — actual file upload comes in Step 12. For now, the field exists but the upload UI is a placeholder.
- `file` and `table` question type renderers are placeholders for now — show a disabled/coming-soon state. `rich_text` can use a simple textarea initially.
- `participants` is JSONB array of `{ name: string, role?: string }` — free-form for now, not linked to users table.
- `activity_links` and `activity_social_posts` tables exist but their full UI comes in Step 07. Creation wizard doesn't expose them yet.
- After successful creation, the user should land on the new activity's Notion-style page (built in Step 07). For now, redirect to the channel's activity list.
