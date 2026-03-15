# Context for Sprint 4

After completing Sprint 3 (S2.1, S2.2, S2.3, S2.4), use this context when starting Sprint 4 (S3.1, S3.2, S3.3).

## Files to @ mention (when prompting for S3.x)

```
@PLAN.md
@sprints/sprint-4/S3.1.md   (or S3.2, S3.3 as needed)
@supabase/migrations/002_space_planning.sql
@supabase/migrations/003_categories.sql
@src/app/(app)/channels/page.tsx
@src/components/ui/StatusToast.tsx
```

## Key artifacts from Sprint 3

| Deliverable | Path | Notes |
|-------------|------|-------|
| Space planning | `supabase/migrations/002_space_planning.sql` | space_notes, space_questions, space_answers |
| Categories | `supabase/migrations/003_categories.sql` | categories, category_catalog, category_questions, category_answers |
| Channels list | `src/app/(app)/channels/page.tsx` | Real categories, snapshot, tap → category |
| Create category | Page/modal + server action | Form, catalog pick, validation |
| Category CRUD | Server actions | Create, read, update categories |

## Decisions / conventions to carry forward

- **Category = workspace:** Space-scoped. User sees own categories; future: invited/shared.
- **Channels route:** Tap category → navigate to `channels/[categoryId]/feed` (Sprint 4 will create feed).
- **Category catalog:** System pre-defined workspaces; user can pick or create custom.

## Sprint 4 stories

- **S3.1** — activities, activity_answers, questions — needs 003 (categories)
- **S3.2** — Activity creation (basic) — needs S3.1, S2.3, S1.6
- **S3.3** — Activity feed (infinite scroll) — needs S3.1, S2.3
