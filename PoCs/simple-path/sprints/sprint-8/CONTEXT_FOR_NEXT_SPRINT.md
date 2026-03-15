# Context for Sprint 9

After completing Sprint 8 (S5.1, S5.2), use this context when starting Sprint 9 (S6.1, S6.2, S6.3, S6.4).

## Files to @ mention (when prompting for S6.x)

```
@PLAN.md
@sprints/sprint-9/S6.1.md   (or S6.2, S6.3, S6.4 as needed)
@supabase/migrations/001_core_schema.sql
@supabase/migrations/003_categories.sql
@supabase/migrations/004_activities.sql
@supabase/migrations/005_session_traces.sql
@supabase/migrations/007_llm_cost_logs.sql
@src/lib/session-tracing.ts
@src/app/(auth)/
@src/lib/s3/
```

## Key artifacts from Sprint 8

| Deliverable | Path | Notes |
|-------------|------|-------|
| S3 integration | `src/lib/s3/` | Presigned URLs, upload flow |
| Attachment UI | Activity form | Upload images/files, store refs in attachments JSON |
| CloudFront | Infra config | Static assets, optional API cache |
| Vercel config | `vercel.json` | Deployment |

## Decisions / conventions to carry forward

- **Attachments:** JSON array of { key, url, type, size } or similar. Stored in activities.attachments.
- **File validation:** Types and sizes validated before upload.
- **Display:** Images in feed and detail; use presigned or CloudFront URLs.

## Sprint 9 stories

- **S6.1** — Admin shell and user management — needs S1.2, S1.5
- **S6.2** — Admin: categories, catalog, questions — needs S2.2, S3.1, S6.1
- **S6.3** — Drillable session tracing UI — needs S3.4, S6.1
- **S6.4** — Admin: LLM cost dashboard — needs S4.2, S6.1
