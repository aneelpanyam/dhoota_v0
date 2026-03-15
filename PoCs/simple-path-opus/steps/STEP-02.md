# Step 02: Core Database Schema

## Goal

Create the foundational database schema (users, spaces, access codes) with RLS policies and type generation, so that auth and space-scoped features have a solid data layer.

## Acceptance Criteria

- [ ] Migration `001_core_schema.sql` created in `supabase/migrations/`
- [ ] Tables created: `system`, `users`, `spaces`, `space_notes`, `space_questions`, `space_answers`, `access_codes`
- [ ] `system` table: singleton row for global config (app name, version, feature flags)
- [ ] `users` table: id (uuid, PK), email, phone, display_name, role (enum: user, admin), status (enum: active, suspended), created_at, updated_at
- [ ] `spaces` table: id (uuid, PK), user_id (FK -> users, unique), name, created_at, updated_at — one space per user
- [ ] `space_notes` table: id, space_id (FK), content (text), created_at, updated_at
- [ ] `space_questions` table: id, space_id (FK), question_text, sort_order, created_at
- [ ] `space_answers` table: id, space_id (FK), question_id (FK -> space_questions), answer_text, created_at, updated_at
- [ ] `access_codes` table: id, user_id (FK -> users), code (unique, hashed), is_active (boolean), created_at, last_used_at
- [ ] RLS enabled on all tables
- [ ] RLS policies: users see own row; spaces scoped to owning user; access_codes readable by matching user; admin role bypasses for management
- [ ] Indexes on foreign keys and commonly queried columns (user_id, space_id, code)
- [ ] Supabase type generation configured — `database.types.ts` generated (or generation script documented)
- [ ] DB helper utilities (`src/lib/supabase/helpers.ts`) — typed wrappers for common query patterns (getById, getByUserId)
- [ ] Migration runs cleanly against a fresh Supabase instance

## Key Files (expected)

```
supabase/migrations/001_core_schema.sql
src/lib/supabase/helpers.ts
src/lib/supabase/database.types.ts (generated)
```

## Dependencies

- Step 01 (project setup, Supabase client/server)

## Context to Read

- `PLAN.md` — Data Model, User Management Model, Security & Validation
- `ARCHITECTURE.md` — folder structure, naming conventions
- `CONTEXT.md` — Step 01 decisions

## Testing Requirements

No automated tests yet. Verify migration applies cleanly. Type generation produces valid types.

## Notes

- `access_codes.code` should be stored hashed (bcrypt or similar) — never store plaintext codes
- The `system` table is a singleton pattern: one row, used for global config. Consider a check constraint or trigger to enforce single row.
- `users.role` enum: `user` and `admin` for now. Extensible later.
- `spaces` has a unique constraint on `user_id` — each user gets exactly one space
- Space notes and Q&A are for space-level planning (user's personal workspace planning), distinct from category-level Q&A which comes in Step 05
- Generated types should be importable as `import type { Database } from '@/lib/supabase/database.types'`
