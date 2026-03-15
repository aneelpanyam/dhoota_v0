# Step 11: Calendar + Session Tracing

## Goal

Add the calendar view for browsing activities by date, and implement drillable session tracing for production support — enabling trace_id and session_id based debugging.

## Acceptance Criteria

### Calendar

- [ ] Calendar page (`src/app/(app)/calendar/page.tsx`) — monthly calendar view, mobile-optimized
- [ ] Days with activities show a visual indicator (dot, count, or highlight)
- [ ] Tapping a day shows activities for that date (inline list below calendar or overlay)
- [ ] Tapping an activity navigates to its detail page
- [ ] Calendar navigates between months (swipe or arrows)
- [ ] Activities fetched efficiently (batch per visible month, not per day)
- [ ] Optional: week view toggle for denser activity periods

### Session Tracing

- [ ] Migration `007_session_traces.sql`: `session_traces`
- [ ] `session_traces` table: id, session_id (text — client-generated per browser session), user_id (FK), trace_id (text), action_type (text — e.g., login, create_activity, view_feed, generate_insight), action_params (JSONB — sanitized input params), result_status (enum: success, error), result_payload (JSONB — sanitized output or error), duration_ms (integer), created_at
- [ ] RLS: admin can read all; users can read own (for transparency, if needed)
- [ ] Session tracing service (`src/lib/session-tracing.ts`):
  - `recordAction(action_type, params, result, duration)` — writes to session_traces
  - `getSessionId()` — reads/generates session ID from cookie or client state
- [ ] Instrument key flows with session tracing:
  - Auth: login attempt, OTP verify
  - Activities: create, update, delete, view feed
  - AI: title generation, insight generation
  - Categories: create, update
- [ ] Trace lookup utility (`src/lib/session-tracing.ts`):
  - `getByTraceId(traceId)` — returns all actions for a trace
  - `getBySessionId(sessionId)` — returns full session timeline
- [ ] Indexes on session_id, trace_id, user_id, created_at

## Key Files (expected)

```
src/app/(app)/calendar/page.tsx
src/components/calendar/month-view.tsx
src/components/calendar/day-activities.tsx
supabase/migrations/007_session_traces.sql
src/lib/session-tracing.ts
```

## Dependencies

- Step 07 (activity feed, activity detail — calendar links to these)

## Context to Read

- `PLAN.md` — Calendar, Observability (drillable session tracing), Key Flows (6)
- `ARCHITECTURE.md` — tracing patterns, logging, service layer
- `CONTEXT.md` — Steps 01–07+ decisions (tracing.ts setup from Step 01)

## Testing Requirements

- [ ] Calendar: correct activities returned for a given date range; empty days return empty
- [ ] Session tracing: `recordAction` persists to DB with all required fields
- [ ] Trace lookup: `getByTraceId` returns matching records; `getBySessionId` returns full timeline ordered by created_at

## Notes

- Calendar is a **browse/discovery** tool — it gives users a time-based view of their work. Keep it simple and fast.
- For the calendar component: consider a lightweight custom implementation or a well-maintained library. Avoid heavy calendar libraries.
- Session tracing is for **production support**: when a user reports an issue and gives their trace_id (shown on error screens), support can look up the full session timeline — what the user did, what happened, what went wrong — without asking the user to reproduce.
- `action_params` and `result_payload` must be **sanitized** — never store passwords, OTPs, or sensitive data in traces.
- Session ID: generate a UUID per browser session (stored in sessionStorage or a short-lived cookie). Different from auth session.
- Duration tracking: wrap instrumented calls with timing to capture `duration_ms`.
- The admin trace viewer UI comes in Step 13 — this step just builds the data layer and instrumentation.
