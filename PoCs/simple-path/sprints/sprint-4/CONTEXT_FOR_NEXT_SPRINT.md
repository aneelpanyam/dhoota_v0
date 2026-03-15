# Context for Sprint 5

After completing Sprint 4 (S3.1, S3.2, S3.3), use this context when starting Sprint 5 (S3.4, S3.5, S3.6).

## Files to @ mention (when prompting for S3.x)

```
@PLAN.md
@sprints/sprint-5/S3.4.md   (or S3.5, S3.6 as needed)
@supabase/migrations/004_activities.sql
@src/lib/tracing.ts
@src/lib/logger.ts
@src/app/(app)/channels/[categoryId]/feed/page.tsx
@src/components/ActivityCard.tsx   (or equivalent)
```

## Key artifacts from Sprint 4

| Deliverable | Path | Notes |
|-------------|------|-------|
| Activities schema | `supabase/migrations/004_activities.sql` | activities, activity_answers, questions |
| Activity creation | Page/form + server action | raw_description, category questions, save |
| Activity feed | `channels/[categoryId]/feed/page.tsx` | Cards, infinite scroll, cursor pagination |
| ActivityCard | Component | Title, description, metadata, tap to expand |

## Decisions / conventions to carry forward

- **Activity model:** raw_description, attachments (JSON), category_id, created_by. title/well_formed_description added by AI later (S4.3).
- **activity_answers:** 1:many with activities; question_id, value (JSONB), question_key.
- **Questions:** Per category; types: file, table, date, email, phone, rich_text.
- **Feed:** Cursor-based pagination, Intersection Observer for infinite scroll.

## Sprint 5 stories

- **S3.4** — Session tracing (session_traces) — needs S1.3, S3.2
- **S3.5** — Activity details, tags, notes, completion — needs S3.2, S3.3, S3.4
- **S3.6** — Calendar view — needs S3.1, S2.3
