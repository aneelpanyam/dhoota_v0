# Step 01: Bootstrap + Foundations

## Goal

Set up the Next.js 15 project with all foundational tooling so that every subsequent step can build on a consistent, well-structured base.

## Acceptance Criteria

- [ ] Next.js 15 (App Router) project initialized in `PoCs/simple-path-opus/`
- [ ] `package.json` with pinned major versions for: next, react, @supabase/supabase-js, @supabase/ssr, tailwindcss, zod, typescript
- [ ] Supabase client helper (`src/lib/supabase/client.ts`) using `createBrowserClient`
- [ ] Supabase server helper (`src/lib/supabase/server.ts`) using `createServerClient` with cookie handling
- [ ] Tailwind CSS configured with design tokens: Inter and Nunito Sans fonts, soft color palette, high-contrast action colors
- [ ] `tailwind.config.ts` with content paths covering `src/**/*.{ts,tsx}`
- [ ] Root layout (`src/app/layout.tsx`) with mobile-first viewport meta, font loading, base styles
- [ ] Structured logger (`src/lib/logger.ts`) — JSON output with severity, timestamp, trace_id, message, context
- [ ] Request tracing (`src/lib/tracing.ts`) — generates `trace_id` per request using `AsyncLocalStorage`, provides `getTraceId()` and `withTraceId()` helpers
- [ ] Zod validation helpers (`src/lib/validation/index.ts`) — utility to run Zod schemas and return structured errors with trace_id
- [ ] Folder structure matches PLAN.md module structure (route groups for auth, app, admin; lib subfolders)
- [ ] `.env.example` with all required env vars documented (Supabase URL, anon key, service role key)
- [ ] `tsconfig.json` with strict mode, path aliases (`@/` -> `src/`)
- [ ] `ARCHITECTURE.md` created with initial mental model (folder map, layering, naming conventions, key patterns)
- [ ] Project builds without errors (`npm run build`)

## Key Files (expected)

```
PoCs/simple-path-opus/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── next.config.ts
├── .env.example
├── ARCHITECTURE.md
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   ├── (auth)/
│   │   ├── (app)/
│   │   └── (admin)/
│   └── lib/
│       ├── supabase/
│       │   ├── client.ts
│       │   └── server.ts
│       ├── logger.ts
│       ├── tracing.ts
│       └── validation/
│           └── index.ts
└── supabase/
    └── migrations/
```

## Dependencies

None — this is the first step.

## Context to Read

- `PLAN.md` — Tech Stack, Module Structure, Observability, Security & Validation sections
- `.cursor/rules/simple-path-context.mdc` — Quick reference for key decisions

## Testing Requirements

No tests in this step. Foundation only — testable code comes in Step 02+.

## Notes

- Use `@supabase/ssr` (not the deprecated `@supabase/auth-helpers-nextjs`) for server client
- AsyncLocalStorage requires Node.js runtime — ensure Next.js API routes/server actions use Node runtime (not Edge)
- The logger should be usable from both server and client contexts; server version includes trace_id, client version logs to console
- ARCHITECTURE.md should be written as if a new developer is reading it on day one — explain the "why" behind the structure, not just the "what"
- Tailwind design tokens: define a `colors.primary`, `colors.surface`, `colors.muted` etc. for the soft palette; ensure action buttons have high contrast
- Fonts: load Inter as the primary body font, Nunito Sans as an accent/heading font (or vice versa — pick what looks clean)
