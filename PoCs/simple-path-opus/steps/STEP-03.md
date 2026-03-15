# Step 03: Auth Flow

## Goal

Implement the full authentication flow (permanent access code + OTP) so users can securely log in and access protected routes.

## Acceptance Criteria

- [ ] Access code entry page (`src/app/(auth)/login/page.tsx`) — single input, clear instructions, mobile-optimized
- [ ] OTP verification page (`src/app/(auth)/verify/page.tsx`) — OTP input after valid access code, auto-focus, resend option
- [ ] Server action: `validateAccessCode` — hash input, query access_codes, return user_id if valid, log attempt with trace_id
- [ ] Server action: `sendOtp` — generate OTP, store (Supabase auth or custom), send via configured channel (email/SMS stub for now)
- [ ] Server action: `verifyOtp` — validate OTP, create Supabase session, redirect to app
- [ ] Auth middleware (`src/middleware.ts`) — protect `(app)` and `(admin)` route groups; redirect unauthenticated to `/login`
- [ ] Session management: JWT-based via Supabase Auth; configure expiry and refresh
- [ ] Auth utility (`src/lib/auth/index.ts`) — `getCurrentUser()`, `requireAuth()`, `requireAdmin()` helpers for server components/actions
- [ ] All auth attempts logged (access code validation, OTP send, OTP verify) with trace_id, user_id, success/failure
- [ ] Error responses include trace_id for support reference
- [ ] Input validation with Zod on both client and server (access code format, OTP format)
- [ ] Non-intrusive status feedback during auth flow (loading states, error messages with trace_id)

## Key Files (expected)

```
src/app/(auth)/login/page.tsx
src/app/(auth)/verify/page.tsx
src/app/(auth)/actions.ts
src/lib/auth/index.ts
src/middleware.ts
```

## Dependencies

- Step 02 (users, access_codes tables, RLS, Supabase types)

## Context to Read

- `PLAN.md` — Auth section, Security & Validation, Observability
- `ARCHITECTURE.md` — server action patterns, validation patterns, folder structure
- `CONTEXT.md` — Step 01, Step 02 decisions (Supabase setup, type generation, validation helpers)

## Testing Requirements

Critical path — tests required:
- [ ] Access code validation: valid code returns user_id, invalid code returns error with trace_id
- [ ] OTP flow: send generates code, verify with correct code succeeds, verify with wrong code fails
- [ ] Session creation: successful auth creates valid session
- [ ] Middleware: unauthenticated requests to protected routes redirect to login

## Notes

- Access codes are **permanent** (like a PIN), not one-time. The user enters the same code every time, then gets a fresh OTP.
- OTP delivery: for now, use a stub/mock (log OTP to console or store in a dev-accessible way). Real SMS/email integration is not needed yet.
- The auth model is: access_code (factor 1: something you know) + OTP (factor 2: something you receive). This is simplified MFA.
- Future: TOTP support. Design auth utilities to be extensible for this.
- Middleware should handle token refresh on each request (Supabase `@supabase/ssr` pattern)
- Admin role check: `requireAdmin()` should verify `users.role = 'admin'` from the session
