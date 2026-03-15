# Simple Path — Living Context

> This file accumulates decisions, patterns, gotchas, and codebase state after each step.
> Read this at the start of every step to maintain continuity across sessions.
>
> **Protocol:** Append a new section after completing each step (see [PROCESS.md](steps/PROCESS.md)).
> **Archive:** When this file exceeds ~80 sections, move older entries to `CONTEXT_ARCHIVE.md`.

---

<!-- Step entries will be appended below this line -->

## Step 01: Bootstrap + Foundations — 2026-03-16

### Delivered
- `package.json` — Next.js 15.5.12, React 19, Supabase SSR, Tailwind v4, Zod 3, TypeScript 5
- `tsconfig.json` — strict mode, `@/` → `src/` path alias
- `next.config.ts`, `postcss.config.mjs`, `.env.example`, `.gitignore`
- `src/app/layout.tsx` — Root layout with Inter + Nunito Sans fonts, mobile viewport (no user scaling)
- `src/app/page.tsx` — Placeholder home page
- `src/app/globals.css` — Tailwind v4 `@theme` tokens: `primary-*` (indigo), `surface-*` (warm gray), success/warning/danger, custom radii, font vars
- Route group layouts: `(auth)`, `(app)`, `(admin)` — all pass-through for now
- `src/lib/supabase/client.ts` — `createBrowserClient` wrapper
- `src/lib/supabase/server.ts` — `createServerClient` with cookie adapter
- `src/lib/tracing.ts` — `AsyncLocalStorage`-based; `generateTraceId()`, `getTraceId()`, `withTraceId()`
- `src/lib/logger.ts` — Structured JSON; server side auto-includes `traceId`
- `src/lib/validation/index.ts` — `validate()`, `validateOrThrow()`, `ValidationError` class; all include `traceId`
- `ARCHITECTURE.md` — Initial mental model (folder map, patterns, conventions)
- Folder scaffolds: `lib/auth`, `lib/services`, `lib/s3`, `lib/llm`, `components/ui|activity|calendar|dashboard|insights|knowledge-base|navigation`, `supabase/migrations`

### Decisions Made
- **Tailwind v4** — Theme configured via CSS `@theme` directive in `globals.css` (not a `tailwind.config.ts` file). Content paths auto-detected by v4.
- **Supabase publishable key** — Using `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (new `sb_publishable_...` format), not the legacy `anon_key`. Both work during transition but publishable key is the standard going forward.
- **Logger uses `require()` for tracing** — Dynamic server-only import to avoid bundling `async_hooks` into client.
- **Node runtime required** — `AsyncLocalStorage` needs Node.js runtime (not Edge). Server actions/routes must use Node.

### Patterns Established
- Supabase client/server split by import path (`@/lib/supabase/client` vs `server`)
- Validation returns `{ success, data }` or `{ success: false, errors, traceId }`
- All structured logging via `logger.*`; never `console.log`
- Path aliases: always `@/lib/...`, `@/components/...`

### Gotchas / Learnings
- `CookieOptions` type must be explicitly imported from `@supabase/ssr` for the `setAll` parameter in strict mode.
- Node.js 21.4.0 shows engine warnings (not LTS); works but recommend Node 20 or 22 for production.

### State for Next Step
- Project builds clean. No pages with real functionality yet.
- Step 02 should add migrations in `supabase/migrations/` and generate types.
- Supabase project credentials needed in `.env.local` before Step 02 can run migrations. Use publishable key (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), not legacy anon key.

---

## Step 02: Core Database Schema — 2026-03-16

### Delivered
- `supabase/migrations/001_core_schema.sql` — Full migration: enums, 7 tables, RLS policies, indexes, triggers
- `src/lib/supabase/database.types.ts` — Hand-crafted types matching schema; generation command documented in header
- `src/lib/supabase/helpers.ts` — Typed query wrappers: `getUserById`, `getSpaceById`, `getUserSpace`, `getAccessCodesByUserId`, `getSpaceNotes`, `getSpaceQuestions`, `getSpaceAnswers`, `getSystemConfig`
- Updated `src/lib/supabase/client.ts` and `server.ts` to use `Database` generic parameter

### Decisions Made
- **Concrete helpers over generics:** Used table-specific helper functions (e.g., `getUserSpace`) instead of a fully generic `getById<T>` because Supabase's PostgREST type system makes generics across table names fragile with strict TypeScript. Each helper is fully typed with zero casts.
- **`is_admin()` as SQL function:** Created a `SECURITY DEFINER` function for RLS admin checks, avoiding repeated subqueries in every policy.
- **System singleton via CHECK constraint:** `system.id` has `CHECK (id = 1)` — Postgres enforces exactly one row. Seeded in migration.
- **`access_codes.code` column is text (hashed):** Application layer responsible for hashing before insert and comparing on auth. Column stores bcrypt/hash output, never plaintext.
- **Partial index for active access codes:** `idx_access_codes_active` uses `WHERE is_active = true` for efficient lookup during auth.
- **Auto-`updated_at` trigger:** Shared `set_updated_at()` trigger function used on all tables with `updated_at` columns.

### Patterns Established
- DB types importable as `import type { Database, Tables } from "@/lib/supabase/database.types"`
- Convenience aliases: `Tables<"users">` for row types, `InsertTables<"spaces">` for insert types
- Supabase clients are now `Database`-typed: `createServerClient<Database>(...)`, `createBrowserClient<Database>(...)`
- Helper return types: `QueryResult<T>` (single) and `QueryListResult<T>` (list) — both include `error: string | null`
- Helpers log errors via `logger.error` with structured context

### Gotchas / Learnings
- Supabase's PostgREST types use deep conditional types. Generic functions like `getById<T extends TableName>` fail strict TS checks because the `.single()` return type can't be narrowed through a generic table parameter. Solution: use concrete table-specific functions.
- `spaces.user_id` unique constraint creates an implicit unique index; the explicit `idx_spaces_user_id` is redundant but kept for documentation clarity (Postgres deduplicates).
- **Supabase new key format adopted:** `sb_publishable_...` (client, replaces `anon`) and `sb_secret_...` (server-only, replaces `service_role`). Env var: `SUPABASE_SECRET_KEY`. Legacy key names deprecated.
- **All DB queries server-side only.** Browser client (`client.ts`) is restricted to auth state and real-time. All data access goes through server actions → service layer → server client. Documented in ARCHITECTURE.md as a convention.

### State for Next Step
- Schema is defined but **migration has not been run** against a live Supabase instance yet. Run `supabase db push` or apply via Supabase dashboard before Step 03.
- All Supabase clients are now `Database`-typed. Future queries get full autocomplete and type checking.
- Step 03 (Auth Flow) should use `users`, `access_codes` tables and the `getUserById` / `getAccessCodesByUserId` helpers.
- To regenerate types from a live DB: `npx supabase gen types typescript --project-id <id> > src/lib/supabase/database.types.ts`

---

## Step 03: Auth Flow — 2026-03-16

### Delivered
- `src/lib/supabase/admin.ts` — Server-only admin client (`SUPABASE_SECRET_KEY`, bypasses RLS); `autoRefreshToken: false`, `persistSession: false`
- `src/lib/services/auth.ts` — Auth service layer: `hashAccessCode` (SHA-256+pepper), `findUserByAccessCode`, `generateAndStoreOtp` / `validateStoredOtp` (in-memory stub), `createAuthSession` (admin generateLink → server verifyOtp), `maskEmail`
- `src/lib/auth/index.ts` — `getCurrentUser()`, `requireAuth()`, `requireAdmin()` helpers using Supabase server client
- `src/app/(auth)/actions.ts` — Server actions: `loginAction`, `verifyAction`, `resendOtp`, `signOut`; Zod schemas for access code and OTP
- `src/app/(auth)/login/page.tsx` — Mobile-optimized login with password input, loading state, error display with trace_id
- `src/app/(auth)/verify/page.tsx` — 6-digit OTP input with auto-focus, auto-advance, paste support, 60s resend cooldown
- `src/middleware.ts` — Supabase SSR middleware: session refresh via `getUser()`, protects all routes except `/login` and `/verify`
- `src/app/(auth)/layout.tsx` — Suspense wrapper for `useSearchParams` in verify page
- `src/app/page.tsx` — Auth-aware home: shows welcome + sign out for authenticated users
- `src/lib/services/auth.test.ts` — 13 unit tests: hashing, OTP flow (generate/verify/expiry/attempts/cooldown), maskEmail
- `vitest.config.ts`, updated `package.json` with `test` and `test:watch` scripts
- `.env.example` — Added `ACCESS_CODE_PEPPER`

### Decisions Made
- **SHA-256 + pepper for access codes** — Deterministic hash enables direct DB lookup (`WHERE code = hash`). Pepper from env var `ACCESS_CODE_PEPPER` prevents rainbow tables. Chose over bcrypt because bcrypt requires iterating all codes (non-deterministic salts).
- **Custom OTP stub (in-memory)** — In-memory `Map<email, OtpEntry>` for development. OTP code logged to console via `logger.info`. 5-minute expiry, 3 max attempts, 60s resend cooldown. Replace with real email/SMS delivery in production.
- **Session creation via admin `generateLink` + server `verifyOtp`** — Admin client generates a magiclink token (no email sent), extracts `hashed_token`, then server client exchanges it for a session (cookies set via SSR adapter). This avoids requiring email infrastructure for the stub.
- **Admin client created now** — `src/lib/supabase/admin.ts` uses `createClient` from `@supabase/supabase-js` directly (not SSR), with `SUPABASE_SECRET_KEY`. Used for pre-auth access code lookup (RLS blocks unauthenticated users).
- **Middleware protects by exclusion** — All routes require auth except `/login` and `/verify`. Simpler than enumerating protected routes. Authenticated users on auth pages are redirected to `/`.
- **`useActionState` for forms, `useTransition` for resend** — Login and verify forms use React 19 `useActionState` for form actions. Resend uses `useTransition` with direct server action call for programmatic invocation.
- **Vitest v2 for testing** — Vitest v4 requires Node 20/22+; project uses Node 21.4.0. Vitest v2 works. Tests mock Supabase clients and logger.

### Patterns Established
- **Admin client**: import from `@/lib/supabase/admin` — server-only, bypasses RLS. Never use in client code.
- **Service layer pattern**: `src/lib/services/auth.ts` — business logic separated from server actions. Actions validate → call service → return/redirect.
- **Auth utilities**: `getCurrentUser()` for optional auth, `requireAuth()` for mandatory (redirects), `requireAdmin()` for admin-only. All return `Tables<"users">`.
- **Server action state type**: `AuthActionState` with `error?`, `fieldErrors?`, `traceId?` — consistent across all auth actions.
- **Middleware pattern**: Supabase SSR `createServerClient` with request/response cookie adapter. `getUser()` for session validation (not `getSession()`).

### Gotchas / Learnings
- **SupabaseClient generics mismatch** — `@supabase/ssr` 0.6.x returns `SupabaseClient<Database, SchemaName, Schema>` (3 generics) but `@supabase/supabase-js` 2.99.x defines 5 generics. Fix: `TypedClient = SupabaseClient<Database, any, any>` in helpers.ts. Documented with comment.
- **`CookieOptions` type needed in middleware** — The `setAll` callback in middleware must explicitly type its parameter to satisfy strict mode.
- **`redirect()` inside `withTraceId`** — Next.js `redirect()` throws `NEXT_REDIRECT` which propagates through `AsyncLocalStorage.run`. This is expected; the framework catches it. `useActionState` doesn't receive new state on redirect — the page navigates instead.
- **Suspense for `useSearchParams`** — Client components using `useSearchParams()` need a Suspense boundary. Added to `(auth)/layout.tsx`.
- **Node 21.4.0 incompatible with vitest v4** — Missing `node:util.styleText`. Pinned to vitest v2.
- **Module-level state lost in Next.js dev mode** — Next.js re-evaluates server modules across requests, resetting `Map`/`Set`/etc. Fix: attach to `globalThis` (e.g. `globalThis.__otpStore`). This is the standard singleton pattern for Next.js dev (same as Prisma client).

### State for Next Step
- Auth flow is complete: access code → OTP → session → protected routes.
- **Migration must be applied** to Supabase before auth can work end-to-end (`001_core_schema.sql`).
- **`ACCESS_CODE_PEPPER` must be set** in `.env.local` for access code hashing.
- OTP is a stub (in-memory, logged to console). Production needs real email/SMS delivery.
- Home page (`/`) shows welcome + sign out for authenticated users. Step 04 will replace with the app shell.
- Test infrastructure ready: `npm test` runs vitest. Extend with more tests in future steps.
- Auth utilities (`getCurrentUser`, `requireAuth`, `requireAdmin`) ready for use in Steps 04+ pages and actions.
