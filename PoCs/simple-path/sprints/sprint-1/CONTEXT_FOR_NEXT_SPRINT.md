# Context for Sprint 2

After completing Sprint 1 (S1.1, S1.2, S1.3, S1.4, S1.6), use this context when starting Sprint 2 (S1.5, S1.7).

## Files to @ mention (when prompting for S1.5, S1.7)

```
@PLAN.md
@sprints/sprint-2/S1.5.md
@supabase/migrations/001_core_schema.sql
@src/lib/tracing.ts
@src/lib/logger.ts
@src/lib/validation/
@src/lib/supabase/client.ts
@src/lib/supabase/server.ts
```

## Key artifacts from Sprint 1

| Deliverable | Path | Notes |
|-------------|------|-------|
| Core schema | `supabase/migrations/001_core_schema.sql` | system, users, spaces, access_codes + RLS |
| Tracing | `src/lib/tracing.ts` | trace_id, AsyncLocalStorage |
| Logger | `src/lib/logger.ts` | Structured JSON logging |
| Validation | `src/lib/validation/*.ts` | Access code, OTP schemas |
| Supabase | `src/lib/supabase/client.ts`, `server.ts` | Client and server setup |
| Toast | `src/components/ui/StatusToast.tsx` | Non-intrusive status updates |
| Layout | `src/app/layout.tsx` | Root layout, fonts |

## Decisions / conventions to carry forward

- **Auth model:** Access code (permanent) + OTP. access_codes table maps code → user.
- **trace_id:** Return in error responses for support. Log all auth attempts.
- **Validation:** Server actions must validate with Zod before processing.

## Sprint 2 stories

- **S1.5** — Auth flow (access code + OTP) — needs 001 schema, tracing, logger, validation
- **S1.7** — App shell and channels placeholder — needs S1.5 (auth) complete
