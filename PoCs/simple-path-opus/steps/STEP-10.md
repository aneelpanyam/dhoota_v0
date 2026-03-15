# Step 10: Insights Engine

## Goal

Build the Insights page where users select activities, generate AI-powered insights and reports, save them, and export/share — the key output users showcase to their parties.

## Acceptance Criteria

- [ ] Migration `006_insights.sql`: `insights`
- [ ] `insights` table: id, space_id (FK), title, content (text/JSONB — structured insight), activity_ids (uuid array — which activities contributed), prompt_used (text — for auditability), notes (text — user-added notes), knowledge_base_context (JSONB — KB entries used), is_starred (boolean), created_by, created_at, updated_at
- [ ] RLS: users manage insights in their own space
- [ ] Insights list page (`src/app/(app)/insights/page.tsx`):
  - List of saved insights (sorted by date, filterable by starred)
  - Each insight shows title, creation date, activity count, star indicator
  - Tap to view full insight
- [ ] Insight generation flow:
  - Step 1: Select activities (multi-select from any category, with search/filter)
  - Step 2: Review context (show selected activities + relevant knowledge base entries)
  - Step 3: Generate insight (AI call with full context graph)
  - Step 4: Review generated insight, edit if needed, add notes
  - Step 5: Save to DB
- [ ] AI insight generation prompt (`src/lib/llm/prompts/insight-generation.ts`):
  - Input: selected activities (descriptions, answers, tags), knowledge base (agendas, principles, priorities)
  - Output: structured report with sections — summary, alignment with party values, achievements, recommendations
- [ ] Insight detail page (`src/app/(app)/insights/[insightId]/page.tsx`):
  - Full insight content rendered as formatted report
  - User notes section (editable)
  - Star/unstar
  - List of source activities (tappable links)
- [ ] Export/share functionality:
  - Copy to clipboard (formatted text)
  - Share via device share API (if available)
  - Download as formatted text/HTML
- [ ] All AI calls logged to llm_cost_logs with operation = 'insights'

## Key Files (expected)

```
supabase/migrations/006_insights.sql
src/app/(app)/insights/page.tsx
src/app/(app)/insights/new/page.tsx
src/app/(app)/insights/[insightId]/page.tsx
src/app/(app)/insights/actions.ts
src/lib/services/insights.ts
src/lib/llm/prompts/insight-generation.ts
src/lib/validation/insights.ts
src/components/insights/activity-selector.tsx
src/components/insights/context-review.tsx
src/components/insights/insight-report.tsx
src/components/insights/export-actions.tsx
```

## Dependencies

- Step 08 (AI provider, cost logging)

## Context to Read

- `PLAN.md` — Insights page, Context graph, Knowledge-base alignment, Key Flows (7)
- `ARCHITECTURE.md` — AI patterns, service layer, pagination
- `CONTEXT.md` — Steps 01–08+ decisions

## Testing Requirements

- [ ] Insight generation: given activities + KB, produces structured output; logged to cost table
- [ ] Insight save: creates record with correct activity_ids and space_id
- [ ] Insight CRUD: update notes, star/unstar, delete

## Notes

- This is the **money feature** — the insights users share with their parties to demonstrate their work and alignment.
- The report should look professional and structured: clear sections, alignment with party agendas, concrete achievements from activities.
- Activity selector should be fast and usable — consider a searchable list with checkboxes, grouped by category.
- Knowledge base context: automatically include relevant KB entries based on the selected activities' categories. Let the user see what context is being fed to AI.
- The prompt should be carefully crafted — it's producing a "report to party leadership." Tone should be professional, achievement-oriented, and aligned with party values.
- Store `prompt_used` for auditability — if the user or admin wants to see what went into generating an insight.
- Export: on mobile, the Web Share API (`navigator.share`) is the cleanest UX. Fallback to copy-to-clipboard.
- Consider: allow regeneration of an insight with the same activities (in case the first result isn't satisfactory).
