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
