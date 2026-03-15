# Context for Sprint 8

After completing Sprint 7 (S4.4, S4.5, S4.6, S4.7), use this context when starting Sprint 8 (S5.1, S5.2).

## Files to @ mention (when prompting for S5.x)

```
@PLAN.md
@sprints/sprint-8/S5.1.md   (or S5.2 as needed)
@supabase/migrations/004_activities.sql
@supabase/migrations/008_knowledge_base.sql
@src/app/(app)/insights/page.tsx
@src/lib/llm/
@src/app/(app)/channels/[categoryId]/feed/page.tsx
@src/app/(app)/channels/page.tsx
```

## Key artifacts from Sprint 7

| Deliverable | Path | Notes |
|-------------|------|-------|
| Activity Summary | Component in activity detail | AI insights, guidance, assessment per activity |
| Knowledge base | `supabase/migrations/008_knowledge_base.sql` | space_id, content type, content, scope |
| Knowledge base admin | Admin UI | Add/edit party agendas, principles, priorities |
| Insights page | `src/app/(app)/insights/page.tsx` | Select activities, context graph, AI insights |
| Insights schema | insights table | Save insights with notes |
| Workspace dashboard | Component | Stats, AI summary per category; on channels or category view |

## Decisions / conventions to carry forward

- **Context graph:** Selected activities + answers + knowledge base → AI insights.
- **Insights:** Stored in DB; export/share (copy or download).
- **Workspace dashboard:** Cached or debounced to limit AI calls.

## Sprint 8 stories

- **S5.1** — S3 file uploads (presigned URLs) — needs S3.1, S3.2
- **S5.2** — CloudFront and caching — needs S5.1
