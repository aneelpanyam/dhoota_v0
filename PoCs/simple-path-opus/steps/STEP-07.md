# Step 07: Activity Feed + Notion-Style Activity Page

## Goal

Build the activity list within a channel (Slack-style message list) and the Notion-style activity detail page — the rich, expandable page where users view and manage everything about an activity.

## Acceptance Criteria

### Activity List (Inside a Channel)

- [ ] Activity list page (`src/app/(app)/channels/[categoryId]/page.tsx`) — replaces the placeholder from Step 05
- [ ] Listed like messages in a Slack channel: most recent first, infinite scroll, cursor-based pagination
- [ ] Each activity card shows: title (or raw_description fallback), status badge, date, participant count, tag pills, attachment count indicator
- [ ] Cursor-based pagination: load 20 activities at a time, ordered by created_at desc; "Load more" trigger at scroll bottom
- [ ] FAB (Floating Action Button) for "Add Activity" — tapping opens the creation flow (Step 06)
- [ ] Tapping an activity card navigates to the Notion-style activity page (drill-down)
- [ ] Empty state: "No activities yet — tap + to add your first" with visual guidance
- [ ] Nav header shows category name + back arrow to channel list

### Notion-Style Activity Page

- [ ] Activity page (`src/app/(app)/channels/[categoryId]/activities/[activityId]/page.tsx`)
- [ ] **Page layout** — clean, Notion-like. No heavy chrome. Back arrow to activity list. Title prominent at top.
- [ ] **Header section:**
  - Title (AI-generated, or raw_description fallback) — large, prominent, inline-editable
  - Status badge (draft/active/completed) — tappable to change status
  - Date, created_by info
- [ ] **Description section:**
  - Raw description — editable inline
  - Well-formed description (AI-generated) — shown below when available, subtle visual distinction
- [ ] **Question answers as Notion-style accordions:**
  - Each category question rendered as a collapsible toggle section (Accordion component)
  - Collapsed: shows question text + answer preview (first line or "Not answered")
  - Expanded: shows full answer, editable inline, rendered by question type
  - Ordered by sort_order from the questions table
- [ ] **Enrichment sections (below accordions):**
  - **Tags** — pill display, add/remove with inline tag input
  - **Participants** — list of name/role pairs, add/remove
  - **Linked activities** — show linked activities with link_type labels, add/remove links (search other activities in same category)
  - **Social media posts** — list of posts (platform, content, url), add/edit/remove
- [ ] **Notes/Comments section (bottom of page):**
  - Like a Notion page's comment thread
  - Inline-editable text area for notes
  - Timestamp when last edited
  - This is where users add context over time
- [ ] **Status management:** Visual status indicator, tappable toggle between draft → active → completed
- [ ] **Delete activity:** Available via sheet/menu, with confirmation dialog

### Server Actions + Data

- [ ] All mutations via server actions with Zod validation and trace_id logging
- [ ] Activity CRUD: update description, notes, tags, participants, status
- [ ] Activity linking: search/select activities, create link with type, remove link; query both directions
- [ ] Social media posts: CRUD per activity
- [ ] Pagination service for feed

## Key Files (expected)

```
src/app/(app)/channels/[categoryId]/page.tsx                              (activity list)
src/app/(app)/channels/[categoryId]/activities/[activityId]/page.tsx      (Notion-style page)
src/app/(app)/channels/[categoryId]/activities/[activityId]/actions.ts
src/components/activity/activity-list.tsx
src/components/activity/activity-card.tsx
src/components/activity/activity-page.tsx
src/components/activity/question-accordion.tsx
src/components/activity/tag-manager.tsx
src/components/activity/participant-manager.tsx
src/components/activity/social-post-manager.tsx
src/components/activity/activity-linker.tsx
src/components/activity/notes-section.tsx
src/lib/services/activities.ts (extend from Step 06)
```

## Dependencies

- Step 06 (activity schema, creation flow, question renderers)

## Context to Read

- `PLAN.md` — UI/UX section (Slack + Notion + ChatGPT model), Key Flows (3, 4)
- `ARCHITECTURE.md` — pagination pattern, server action pattern, Accordion component
- `CONTEXT.md` — Steps 01–06 decisions (especially activity schema, question types, Accordion)

## Testing Requirements

- [ ] Pagination: first page returns correct count; subsequent pages use cursor correctly; empty category returns empty array
- [ ] Activity update: owner can update all fields; validation errors return structured response
- [ ] Activity linking: creates bidirectional-aware link; prevents self-linking; prevents duplicate links

## Notes

- **The activity page is the heart of the app.** Think of it as a Notion page: clean, spacious, content-focused. No visual clutter.
- **Accordion is the key pattern** for question answers. Each question is a collapsible toggle — this keeps the page scannable. Users expand only the sections they want. Exactly like Notion's toggle blocks.
- **Notes at the bottom** work like comments on a Notion page — the user adds context, reflections, updates over time. This is a simple text area, not a full rich-text editor (yet).
- The activity list inside a channel should feel like Slack messages — fast scroll, visual cards, quick scanning. The FAB for "Add Activity" is the primary CTA.
- Cursor-based pagination uses `created_at` + `id` as the cursor (not offset-based, which has consistency issues).
- Activity linking: when linking A to B, the UI should also show B's link to A in B's detail page. Query both directions (source and target).
- Social media posts track social media activity *related to* the political activity — e.g., "I tweeted about this event" with a link to the tweet.
- The Notion-style page should feel like its own world — when you're on it, you're focused on that activity. The nav header shows activity title + back arrow to the activity list.
- Inline editing: wherever possible, the user edits directly on the page (click to edit title, click to edit description, click to edit notes). No separate "edit mode" or "edit page."
