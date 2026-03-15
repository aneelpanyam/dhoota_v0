# Simple Path — Architecture

> **Audience:** A developer joining this project on day one.
> **Updated after:** Step 02 (Core Database Schema).

---

## What Is This?

Simple Path is a mobile-first **Activity Tracker** for political workers, candidates, and elected representatives. Users log activities into categories (workspaces), and AI generates insights and reports that align with their party's knowledge base.

The app feels like a blend of **Slack** (channel navigation), **Notion** (rich activity pages), and **ChatGPT** (conversational activity creation).

---

## Tech Stack

| Layer        | Choice                          |
| ------------ | ------------------------------- |
| Framework    | Next.js 15 (App Router)        |
| Language     | TypeScript (strict mode)        |
| DB + Auth    | Supabase (Postgres, Auth, RLS, publishable key) |
| Styling      | Tailwind CSS v4                 |
| Validation   | Zod (client + server)           |
| Hosting      | Vercel                          |
| File Storage | S3 + CloudFront (future)        |
| AI           | Multi-provider (future)         |

---

## Folder Map

```
PoCs/simple-path-opus/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (fonts, viewport, globals)
│   │   ├── page.tsx                # Landing / redirect
│   │   ├── globals.css             # Tailwind v4 @theme tokens + base styles
│   │   ├── (auth)/layout.tsx       # Auth route group (login, OTP)
│   │   ├── (app)/layout.tsx        # Authenticated app shell (channels, activities)
│   │   └── (admin)/layout.tsx      # Admin route group
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts           # Browser client — AUTH ONLY (sign in/out, session)
│   │   │   ├── server.ts           # Server client — ALL DB reads/writes (respects RLS)
│   │   │   ├── database.types.ts   # Generated/hand-crafted DB types (Tables, Enums, etc.)
│   │   │   └── helpers.ts          # Typed query wrappers (getUserById, getUserSpace, etc.)
│   │   ├── logger.ts               # Structured JSON logger (server: with trace_id)
│   │   ├── tracing.ts              # AsyncLocalStorage-based request tracing
│   │   ├── validation/index.ts     # Zod helpers: validate(), validateOrThrow()
│   │   ├── auth/                   # Auth utilities (future: getCurrentUser, requireAuth)
│   │   ├── services/               # Business logic layer (future)
│   │   ├── s3/                     # File storage (future)
│   │   └── llm/                    # AI provider abstraction (future)
│   └── components/
│       ├── ui/                     # Shared UI kit (Button, Input, Card, etc.)
│       ├── activity/               # Activity-specific components
│       ├── calendar/               # Calendar view
│       ├── dashboard/              # Workspace dashboard
│       ├── insights/               # Insights generation & display
│       ├── knowledge-base/         # Knowledge base editor
│       └── navigation/             # Bottom nav, app shell
├── supabase/migrations/            # Numbered SQL migration files
├── steps/                          # PBP step briefs
├── PLAN.md                         # Product spec (source of truth)
├── ARCHITECTURE.md                 # This file
├── CONTEXT.md                      # Living memory across steps
└── STEPS.md                        # Execution roadmap with status
```

---

## Key Patterns

### 1. Layering

```
Route (page.tsx / server action)
  → Service layer (src/lib/services/)
    → Supabase client (src/lib/supabase/)
      → Database (Supabase Postgres + RLS)
```

**Server actions are thin:** Validate with Zod → call service → return result. Business logic lives in the service layer, not in actions.

### 2. Supabase Client Usage

**All database reads and writes go through the server.** The browser client exists only for Supabase Auth (sign in/out, session refresh, `onAuthStateChange`) and real-time subscriptions. Components that need data call server actions — they never query Supabase directly.

| Client | Import | Key | Used For |
|--------|--------|-----|----------|
| **Browser** | `@/lib/supabase/client` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...`) | Auth state only (sign in/out, session, onAuthStateChange), real-time subscriptions |
| **Server** | `@/lib/supabase/server` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...`) + cookies | All DB reads/writes for authenticated user (respects RLS) |
| **Admin** | `@/lib/supabase/admin` (future) | `SUPABASE_SECRET_KEY` (`sb_secret_...`) | Server-only admin operations that bypass RLS (user provisioning, system config) |

Rules:
- **Never query tables from the browser.** All data flows through server actions → service layer → server client.
- **Never expose the secret key to the client.** `SUPABASE_SECRET_KEY` has no `NEXT_PUBLIC_` prefix — Next.js won't bundle it.
- **Never mix client imports.** The import path (`/client` vs `/server` vs `/admin`) makes context obvious.
- **All clients are `Database`-typed.** Full autocomplete and type checking for queries.
- **Publishable key, not anon key.** Legacy `anon_key` / `service_role` keys are deprecated. Use `sb_publishable_...` and `sb_secret_...` formats.

### 2a. Database Types

Types are defined in `src/lib/supabase/database.types.ts`. Use convenience aliases:

```typescript
import type { Database, Tables, InsertTables, UpdateTables } from "@/lib/supabase/database.types";

type User = Tables<"users">;           // Row type
type NewSpace = InsertTables<"spaces">; // Insert type
type EditUser = UpdateTables<"users">; // Update type
```

To regenerate from a live Supabase instance:
```bash
npx supabase gen types typescript --project-id <id> > src/lib/supabase/database.types.ts
```

### 2b. Database Helpers

Typed query wrappers live in `src/lib/supabase/helpers.ts`. Each function is table-specific (not generic) for full type safety:

```typescript
import { getUserById, getUserSpace, getSystemConfig } from "@/lib/supabase/helpers";

const { data: user, error } = await getUserById(client, userId);
const { data: space, error } = await getUserSpace(client, userId);
const { data: config, error } = await getSystemConfig(client);
```

All helpers return `QueryResult<T>` (single row) or `QueryListResult<T>` (array), with `error: string | null`. Errors are logged via `logger.error` with structured context.

### 3. Request Tracing

Every server request gets a `trace_id` (UUIDv4) via `AsyncLocalStorage`:

```typescript
import { withTraceId, getTraceId } from "@/lib/tracing";

// In a server action or route handler:
return withTraceId(() => {
  logger.info("Processing request", { action: "createActivity" });
  // getTraceId() automatically resolves within this scope
});
```

All error responses include `trace_id` so support can correlate logs.

### 4. Validation

```typescript
import { validate, validateOrThrow } from "@/lib/validation";
import { z } from "zod";

const schema = z.object({ title: z.string().min(1) });

// Option A: structured result
const result = validate(schema, data);
if (!result.success) return { error: result.errors, traceId: result.traceId };

// Option B: throw on failure (auto-includes trace_id)
const data = validateOrThrow(schema, rawInput);
```

### 5. Logging

Structured JSON to stdout/stderr. On server, `trace_id` is included automatically from `AsyncLocalStorage`.

```typescript
import { logger } from "@/lib/logger";

logger.info("Activity created", { activityId: "abc", categoryId: "xyz" });
// → {"level":"info","message":"Activity created","timestamp":"...","traceId":"...","activityId":"abc","categoryId":"xyz"}
```

### 6. Styling (Tailwind v4)

- Design tokens defined in `globals.css` via `@theme` (not a tailwind.config.ts file).
- Color scales: `primary-*` (warm indigo), `surface-*` (warm gray), `success-*`, `warning-*`, `danger-*`.
- Fonts: `--font-sans` (Inter, body text), `--font-heading` (Nunito Sans, headings).
- Use semantic token names: `text-primary-600`, `bg-surface-50`, `text-danger-500`.

### 7. Route Groups

- `(auth)` — login/OTP flows; no app shell.
- `(app)` — authenticated user flows; will have bottom nav + drill-down layout.
- `(admin)` — admin flows; separate layout, same mobile-first approach.

---

## Conventions

- **Named exports only.** No default exports except Next.js pages/layouts (required by framework).
- **Path aliases:** `@/` maps to `src/`. Always use `@/lib/...`, `@/components/...`.
- **File naming:** `kebab-case` for files, `PascalCase` for components, `camelCase` for functions/variables.
- **No `any` types.** Use `unknown` and narrow.
- **No `console.log` in committed code.** Use `logger.*` from `@/lib/logger`.
- **Errors include trace_id.** Always.
- **No DB queries from the browser.** All data access goes through server actions → service layer → Supabase server client. The browser client is for auth state and real-time only.

---

## Database Schema

Migrations live in `supabase/migrations/`. Current migration: `001_core_schema.sql`.

### Tables

| Table | Purpose | Key Constraints |
|-------|---------|-----------------|
| `system` | Singleton global config (app name, version, feature flags) | `CHECK (id = 1)` — exactly one row |
| `users` | App users, linked to `auth.users` | PK references `auth.users(id)` |
| `spaces` | One workspace per user | `UNIQUE (user_id)` — 1:1 with users |
| `space_notes` | Free-form notes within a space | FK → spaces |
| `space_questions` | Ordered questions for a space | FK → spaces, `sort_order` |
| `space_answers` | Answers to space questions | FK → spaces, FK → space_questions |
| `access_codes` | Permanent auth codes (hashed) | `UNIQUE (code)`, never store plaintext |

### RLS Strategy

- All tables have RLS enabled.
- `is_admin()` — `SECURITY DEFINER` function checks `users.role = 'admin'` for current `auth.uid()`.
- Regular users see only their own rows (via `auth.uid()` match on `user_id` or space ownership chain).
- Admins bypass all read restrictions and can manage all records.
- Access codes: only admins can insert/update/delete; users can read their own.

### Enums

- `user_role`: `'user'` | `'admin'`
- `user_status`: `'active'` | `'suspended'`

---

## What's Next

Step 03 will add the auth flow: access code + OTP login, session management, `getCurrentUser`, `requireAuth` utilities.
