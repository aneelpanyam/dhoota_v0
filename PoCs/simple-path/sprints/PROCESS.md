# Story Implementation Process

> **Reference this document when implementing any story.** It defines the workflow and instructs the AI to maintain a centralized context file for continuity across stories.

---

## Workflow for each story

1. **Read the story** — Load the prompt file (e.g. `sprints/sprint-1/S1.1.md`), PLAN.md, and any context listed in the story or CONTEXT_FOR_NEXT_SPRINT.
2. **Implement** — Build the deliverables per acceptance criteria.
3. **Update the centralized context file** — At the end of the story, append/update `sprints/CONTEXT.md` with the capture below.

---

## Centralized context file: `sprints/CONTEXT.md`

**Location:** `PoCs/simple-path/sprints/CONTEXT.md`

**Purpose:** A living document that accumulates thought process, decisions, and details from each completed story. The next story can read it to maintain continuity.

**Initial state:** Create the file when implementing the first story (S1.1). It starts empty or with a header.

---

## What to capture at the end of each story

After completing a story, append a new section to `sprints/CONTEXT.md` with this structure:

```markdown
## [Story ID] — [Story title] — [Date or session]

### Delivered
- [List key files created or modified with paths]
- [Any migrations, components, server actions]

### Decisions made
- [Architectural or implementation choices that affect future stories]
- [Conventions adopted (naming, patterns, structure)]
- [Deviations from PLAN.md and why]

### Gotchas / learnings
- [Things that were tricky or required iteration]
- [Dependencies or setup steps that tripped up]
- [Edge cases handled]

### Context for next story
- [What the next story (or dependent stories) should know]
- [Files to @ mention]
- [State of the codebase relevant to upcoming work]
```

**Keep it concise.** 5–15 lines per story is usually enough. Focus on what a fresh context (or a different AI session) would need to pick up smoothly.

---

## Instructions for the AI

When implementing a story:

1. **Before starting:** Read `sprints/CONTEXT.md` if it exists. Use it to understand prior decisions and current state.
2. **During implementation:** Follow the story's acceptance criteria and PLAN.md.
3. **After completing:** Append the capture block above to `sprints/CONTEXT.md`. Use the actual story ID (e.g. S1.1), title, and fill in the sections based on what was done.
4. **If CONTEXT.md doesn't exist:** Create it with a brief header, then add the first capture block.

---

## How to reference this process in prompts

When prompting for a story, include:

```
@sprints/PROCESS.md Follow the story process. At the end, update sprints/CONTEXT.md per PROCESS.md.
```

Or more briefly:

```
@sprints/sprint-1/S1.1.md @sprints/PROCESS.md Implement S1.1. Follow PROCESS.md for context capture.
```

---

## Example capture (S1.1)

```markdown
## S1.1 — Project bootstrap — 2025-03-15

### Delivered
- package.json (Next.js 15, Supabase, Tailwind, Zod)
- src/app/layout.tsx (Inter font, mobile viewport)
- src/lib/supabase/client.ts, server.ts
- tailwind.config.ts (soft palette, Nunito Sans)

### Decisions made
- Using @supabase/ssr for server client; createBrowserClient for client
- Tailwind: content paths include src/**/*.{ts,tsx}
- No .env.example yet; documented in README

### Gotchas / learnings
- Supabase server client needs cookies from headers; use createServerClient with cookie helpers
- Next.js 15: ensure "use client" only where needed for client components

### Context for next story
- S1.2 needs 001 migration; schema in PLAN.md. RLS patterns: users see own rows, spaces by user.
- S1.3 needs src/lib/ to exist; tracing will use AsyncLocalStorage, need Node.js runtime.
```

---

## Maintenance

- **Trim if needed:** If CONTEXT.md grows very long (e.g. 50+ stories), consider archiving older sections to `sprints/CONTEXT_ARCHIVE.md` and keeping only the last 1–2 sprints in CONTEXT.md.
- **Don't duplicate:** CONTEXT_FOR_NEXT_SPRINT.md in each sprint folder lists files and artifacts. CONTEXT.md adds the *why* and *how* — thought process, decisions, gotchas.
