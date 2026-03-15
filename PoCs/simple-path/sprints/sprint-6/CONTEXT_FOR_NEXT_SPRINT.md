# Context for Sprint 7

After completing Sprint 6 (S4.1, S4.2, S4.3), use this context when starting Sprint 7 (S4.4, S4.5, S4.6, S4.7).

## Files to @ mention (when prompting for S4.x)

```
@PLAN.md
@sprints/sprint-7/S4.4.md   (or S4.5, S4.6, S4.7 as needed)
@supabase/migrations/006_ai_provider.sql
@supabase/migrations/007_llm_cost_logs.sql
@src/lib/llm/
@src/app/(app)/channels/[categoryId]/feed/page.tsx
@src/app/(app)/channels/[categoryId]/activities/[activityId]/page.tsx
@supabase/migrations/004_activities.sql
```

## Key artifacts from Sprint 6

| Deliverable | Path | Notes |
|-------------|------|-------|
| AI provider config | `supabase/migrations/006_ai_provider.sql` | provider, model, api_key_ref per space |
| LLM provider | `src/lib/llm/` | Interface, factory, getLLMProvider(spaceId) |
| Cost logging | `supabase/migrations/007_llm_cost_logs.sql` | Log every LLM call |
| Cost wrapper | LLM wrapper | Log input/output tokens, latency, trace_id |
| AI title/description | Activity creation flow | raw_description → title, well_formed_description |
| Admin AI config | Admin page | Set provider, model, API key |

## Decisions / conventions to carry forward

- **LLM flow:** All calls via getLLMProvider(spaceId). Wrapper logs to llm_cost_logs + CloudWatch.
- **Activity title:** AI generates on save. Fallback to raw_description if AI fails.
- **Operations:** Use consistent operation names (e.g. title_generation, insights) for cost tracking.

## Sprint 7 stories

- **S4.4** — Activity Summary (AI insights, guidance, assessment) — needs S4.1, S3.5
- **S4.5** — Knowledge base schema and admin — needs 001
- **S4.6** — Insights page (select activities → AI insights) — needs S4.1, S4.5, S3.1
- **S4.7** — Workspace dashboard (AI snapshot per category) — needs S4.1, S2.3, S3.3
