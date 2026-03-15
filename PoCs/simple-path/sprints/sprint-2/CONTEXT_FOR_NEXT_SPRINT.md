# Context for Sprint 3

After completing Sprint 2 (S1.5, S1.7), use this context when starting Sprint 3 (S2.1, S2.2, S2.3, S2.4).

## Files to @ mention (when prompting for S2.x)

```
@PLAN.md
@sprints/sprint-3/S2.1.md   (or S2.2, S2.3, S2.4 as needed)
@supabase/migrations/001_core_schema.sql
@src/app/(auth)/access-code/page.tsx
@src/app/(auth)/otp/page.tsx
@src/app/(app)/layout.tsx
@src/app/(app)/channels/page.tsx
@src/lib/supabase/server.ts
```

## Key artifacts from Sprint 2

| Deliverable | Path | Notes |
|-------------|------|-------|
| Auth flow | `src/app/(auth)/access-code/page.tsx`, `otp/page.tsx` | Access code entry, OTP verify |
| Auth actions | Server actions for request OTP, verify OTP | Session creation, redirect |
| App shell | `src/app/(app)/layout.tsx` | Bottom nav (mobile), sidebar (desktop) |
| Channels | `src/app/(app)/channels/page.tsx` | Placeholder or empty state |
| Protected routes | Middleware or layout check | Redirect to auth if not logged in |

## Decisions / conventions to carry forward

- **Session:** Supabase session; JWT expiry config. Redirect to `/channels` after login.
- **Layout:** `(app)` route group for authenticated app. Nav ready for channels, insights, calendar.
- **Channels:** Currently placeholder; Sprint 3 will load real categories.

## Sprint 3 stories

- **S2.1** — space_notes, space_questions, space_answers — needs 001 (spaces)
- **S2.2** — categories, category_catalog, category_questions, category_answers — needs 001
- **S2.3** — Channels with real categories — needs S2.2, S1.7
- **S2.4** — Create category flow — needs S2.2, S1.6
