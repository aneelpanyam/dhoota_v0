# Context for Future Phases

Sprint 9 is the final sprint for the basic Activity Tracker. After completing S6.1–S6.4, the app is feature-complete for the current scope.

## What Sprint 9 delivers

| Story | Deliverable |
|-------|-------------|
| S6.1 | Admin layout, users, spaces, access_codes management |
| S6.2 | Category catalog CRUD, questions per category, space_features |
| S6.3 | Trace lookup by trace_id/session_id, session timeline view |
| S6.4 | LLM cost dashboard (usage by space, period, operation) |

## Future phases (from PLAN.md)

- **Phase 6 (Future):** Collaboration — category_collaborators, invite flow, shared categories
- **Phase 7 (Future):** Suggestion Box module, Public Site module

## Context for future work

If you extend the app later, key reference points:

| Area | Key files |
|------|-----------|
| Data model | `supabase/migrations/001_*.sql` through `008_*.sql` |
| Auth | `src/app/(auth)/`, access_codes, Supabase session |
| Tracing | `src/lib/tracing.ts`, `src/lib/session-tracing.ts` |
| LLM | `src/lib/llm/`, ai_provider_config, llm_cost_logs |
| Admin | `src/app/(admin)/` |
| Activity flow | `channels/[categoryId]/feed`, activity creation, detail |

## Handoff notes

- **Admin auth:** Ensure admin routes use separate auth or role check (admin vs user).
- **space_features:** Per-space flags for activity_tracker, suggestion_box, public_site.
- **Extensibility:** Route structure and nav designed for new modules; add routes under `(app)` or new route groups.
