# Step 05: Categories + Channel List

## Goal

Implement categories (workspaces/workstreams) and display them as a Slack-style channel list — the home screen and primary entry point of the app.

## Acceptance Criteria

### Schema

- [ ] Migration `002_categories.sql`: `categories`, `category_catalog`, `category_collaborators`, `category_questions`, `category_answers`
- [ ] `categories` table: id, space_id (FK), title, description, notes (text), status (active/archived), is_custom (boolean), catalog_id (nullable FK), created_by, created_at, updated_at
- [ ] `category_catalog` table: id, title, description, is_active, sort_order, created_at — system-defined templates
- [ ] `category_collaborators` table: id, category_id (FK), user_id (FK), role (owner/editor/viewer), invited_at, accepted_at — for future collaboration
- [ ] `category_questions` table: id, category_id (FK), question_text, sort_order, created_at
- [ ] `category_answers` table: id, category_id (FK), question_id (FK), answer_text, created_by, created_at, updated_at
- [ ] RLS: users see categories in their space + categories they're collaborators on; catalog is readable by all authenticated users

### Channel List (Home Screen)

- [ ] Channel list page (`src/app/(app)/channels/page.tsx`) — Slack-style list of user's categories
- [ ] Each channel card shows: category title, description snippet, activity count (placeholder), last activity date (placeholder), status indicator
- [ ] Channel cards are tappable — navigates to the category's activity list (drill-down)
- [ ] Visual style: clean, scannable, like Slack's channel sidebar but full-screen on mobile
- [ ] Empty state: "No channels yet — create your first workspace" with prominent CTA
- [ ] Create channel button: prominent FAB or header action to create new category

### Category Creation

- [ ] Category creation flow — user can pick from system catalog or create custom category
- [ ] Catalog picker: shows available templates as selectable cards
- [ ] Custom creation: simple form — title, description
- [ ] After creation: navigate into the new category (drill-down)

### Category Detail / Settings

- [ ] Category detail accessible from within the channel (header menu or settings icon)
- [ ] Shows: title, description (editable), notes (inline editable), Q&A planning
- [ ] Category Q&A: view questions, add/edit answers (space/category-level planning)
- [ ] Category CRUD server actions: create, update, archive, list

### Validation + Logging

- [ ] Zod validation on all category inputs (server-side required, client-side for UX)
- [ ] All mutations logged with trace_id

## Key Files (expected)

```
supabase/migrations/002_categories.sql
src/app/(app)/channels/page.tsx
src/app/(app)/channels/[categoryId]/page.tsx       (activity list — shows activities in this channel)
src/app/(app)/channels/[categoryId]/settings/page.tsx  (category detail/settings)
src/app/(app)/channels/[categoryId]/actions.ts
src/app/(app)/channels/actions.ts
src/lib/services/categories.ts
src/lib/validation/categories.ts
```

## Dependencies

- Step 02 (core schema — spaces, users)
- Step 04 (app shell, UI components, navigation, Accordion)

## Context to Read

- `PLAN.md` — User Management Model (Category = workspace), UI/UX section (Slack channel navigation), Key Flows (1-3)
- `ARCHITECTURE.md` — server action pattern, service layer, validation pattern
- `CONTEXT.md` — Steps 01–04 decisions

## Testing Requirements

- [ ] Category creation: valid input creates category in correct space; invalid input returns Zod errors with trace_id
- [ ] Category update: owner can update; non-owner cannot
- [ ] Catalog listing: returns only active catalog items

## Notes

- **This is the home screen.** It must feel fast, scannable, and Slack-like. The user lands here after login and spends most of their navigation time here.
- The drill-down flow: channel list → tap channel → activity list page inside that channel. The nav header updates to show the category name with a back arrow.
- `channels/[categoryId]/page.tsx` is the **activity list** for that category (not the category detail). This is "entering the channel" like tapping a Slack channel shows its messages. The activity list content comes in Steps 06-07 — for now, show an empty state placeholder.
- Category detail/settings is a secondary page — accessible from a gear icon or menu within the channel, not the primary tap target.
- Snapshot stats (activity count, last activity date) will show real data after Step 06 — for now, use placeholder values or "No activities yet".
- `category_collaborators` table is created now for schema completeness but the invite/collaboration UI is a future feature.
- Notes and Q&A are the user's planning tools at the category level. Keep the UX simple — inline editing preferred.
- `is_custom` flag distinguishes user-created categories from catalog-picked ones.
