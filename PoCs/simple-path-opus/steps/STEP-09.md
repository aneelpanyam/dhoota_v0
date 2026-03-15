# Step 09: Knowledge Base + Workspace Dashboard

## Goal

Implement the party knowledge base and workspace dashboard — giving each category a smart summary with AI-powered insights that align with party values.

## Acceptance Criteria

- [ ] Migration `005_knowledge_base.sql`: `knowledge_base`
- [ ] `knowledge_base` table: id, space_id (FK), category_id (FK, nullable — space-level or category-level), type (enum: agenda, principle, priority, general), title, content (text), sort_order, is_active, created_by, created_at, updated_at
- [ ] RLS: users manage knowledge base entries in their own space; admins can manage any
- [ ] Knowledge base CRUD service (`src/lib/services/knowledge-base.ts`) — create, update, delete, list by space/category
- [ ] Knowledge base UI (accessible from category detail or workspace settings):
  - List knowledge base entries grouped by type (agendas, principles, priorities)
  - Add/edit/remove entries
  - Inline editing preferred
- [ ] Workspace dashboard page (`src/app/(app)/channels/[categoryId]/dashboard/page.tsx`):
  - Stats: total activities, activities by status, activities this week/month
  - Recent activities list (last 5)
  - AI snapshot: workspace-level insights, guidance, assessment
  - Knowledge-base alignment: how recent activities align with party agendas/priorities
- [ ] AI workspace summary prompt (`src/lib/llm/prompts/workspace-summary.ts`):
  - Input: category activities + answers + knowledge base entries
  - Output: structured summary with insights, guidance, assessment, alignment score
- [ ] Dashboard generates AI summary on demand (button) or on first load with caching
- [ ] AI summary cached per category (regenerate when new activities added or on demand)
- [ ] All AI calls logged to llm_cost_logs

## Key Files (expected)

```
supabase/migrations/005_knowledge_base.sql
src/app/(app)/channels/[categoryId]/dashboard/page.tsx
src/app/(app)/channels/[categoryId]/knowledge-base/page.tsx
src/lib/services/knowledge-base.ts
src/lib/llm/prompts/workspace-summary.ts
src/lib/validation/knowledge-base.ts
src/components/dashboard/workspace-stats.tsx
src/components/dashboard/ai-snapshot.tsx
src/components/knowledge-base/kb-editor.tsx
```

## Dependencies

- Step 08 (AI provider, LLM cost logging, prompt infrastructure)

## Context to Read

- `PLAN.md` — Knowledge base, Workspace dashboard, Context graph, AI Provider Abstraction
- `ARCHITECTURE.md` — service layer, AI patterns from Step 08
- `CONTEXT.md` — Steps 01–08 decisions (especially AI provider setup, activity schema)

## Testing Requirements

- [ ] Knowledge base CRUD: create/update/delete entries; RLS enforcement (own space only)
- [ ] Dashboard stats: correct counts for activities by status
- [ ] AI summary: generates structured output from context graph; logged to cost table

## Notes

- **Context graph** = activities + answers + tags + notes + knowledge base. This is the combined input fed to AI for meaningful insights.
- Knowledge base is where party-level information lives: what the party cares about, their agendas, principles, priorities. The AI uses this to tell users "your activities align with X agenda" or "consider focusing more on Y priority."
- This is a key differentiator for the product — insights aren't generic, they're aligned with the user's party's values.
- Dashboard should be the "landing page" when tapping a category channel — show stats + AI snapshot at a glance.
- Consider navigation: channel list → tap category → show dashboard (with tabs for Feed, Dashboard, Knowledge Base, Q&A)
- AI caching: store the last generated summary in a JSONB column or a separate cache table. Invalidate when activity count changes.
- Knowledge base entries at space-level apply across all categories. Category-level entries are specific to that workspace.
