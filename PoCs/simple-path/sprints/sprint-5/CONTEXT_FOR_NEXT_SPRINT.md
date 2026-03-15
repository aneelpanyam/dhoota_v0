# Context for Sprint 6

After completing Sprint 5 (S3.4, S3.5, S3.6), use this context when starting Sprint 6 (S4.1, S4.2, S4.3).

## Files to @ mention (when prompting for S4.x)

```
@PLAN.md
@sprints/sprint-6/S4.1.md   (or S4.2, S4.3 as needed)
@supabase/migrations/001_core_schema.sql
@supabase/migrations/004_activities.sql
@supabase/migrations/005_session_traces.sql
@src/lib/tracing.ts
@src/lib/session-tracing.ts
@src/app/(app)/channels/[categoryId]/feed/page.tsx
@src/app/(app)/channels/[categoryId]/activities/[activityId]/page.tsx   (or detail route)
```

## Key artifacts from Sprint 5

| Deliverable | Path | Notes |
|-------------|------|-------|
| Session traces | `supabase/migrations/005_session_traces.sql` | session_id, action_type, action_params, result |
| Session tracing | `src/lib/session-tracing.ts` | Capture layer, record actions + results |
| Instrumentation | Server actions | create_activity, view_feed, etc. record to session_traces |
| Activity detail | Detail page | Full description, answers, tags, notes, complete |
| Calendar | `src/app/(app)/calendar/page.tsx` | Activities by date, tap → detail |

## Decisions / conventions to carry forward

- **session_id:** From client (e.g. cookie or generated per tab). Propagate with trace_id.
- **Action types:** create_activity, view_feed, update_activity, etc. Store sanitized params and result.
- **Activity detail:** May have tags, notes, status/complete columns (check 004 or new migration).

## Sprint 6 stories

- **S4.1** — AI provider abstraction (OpenAI, Gemini, Perplexity) — needs 001 (spaces)
- **S4.2** — LLM cost logging — needs S4.1, S1.3
- **S4.3** — AI-generated title and description — needs S4.1, S3.2
