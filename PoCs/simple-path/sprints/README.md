# Simple Path — Sprint Prompts

Use these prompts to implement the app story-by-story with the AI assistant.

## How to use

1. **Open the prompt file** for the story you want (e.g. `sprint-1/S1.1.md`).
2. **Copy the "Copy-paste prompt"** section.
3. **Add the process reference:** `@sprints/PROCESS.md` — Tells the AI to update `sprints/CONTEXT.md` at the end of each story.
4. **Paste into the chat** and send.
5. **Include context** — The "Context to provide" section lists files to @ mention. For later stories, also @ mention `@sprints/CONTEXT.md` so the AI has prior context.

## Tips

- **One story at a time** — Complete each story before moving to the next.
- **Respect dependencies** — Don't start S1.5 before S1.2, S1.3, S1.4 are done.
- **Between sprints** — Read `CONTEXT_FOR_NEXT_SPRINT.md` in the sprint you just finished. It lists files to @ mention and key artifacts for the next sprint.
- **Context continuity** — Include `@sprints/CONTEXT.md` in prompts (after S1.1). The AI writes to it at the end of each story per PROCESS.md.
- **Mark progress** — Update the checklist in `AGILE_PLAN.md` when done.
- **If something fails** — Share the error; the AI can fix it. Include the story ID (e.g. S1.1) for context.

## Folder structure

```
sprints/
├── README.md                    ← You are here
├── PROCESS.md                   ← Story workflow + context capture instructions
├── CONTEXT.md                  ← Centralized context (created/updated by AI after each story)
├── sprint-1/ through sprint-9/
│   ├── S1.1.md, S2.1.md, ...   Story prompts
│   └── CONTEXT_FOR_NEXT_SPRINT.md   Files/artifacts for next sprint
└── ...
```

**PROCESS.md** — Defines the workflow. Instructs the AI to read CONTEXT.md before each story and append to it after each story (thought process, decisions, gotchas).

**CONTEXT.md** — Living document. Created on first story; updated by AI at end of every story. Use it for continuity across stories and sessions.

**CONTEXT_FOR_NEXT_SPRINT.md** — Per-sprint. Lists files to @ mention and key artifacts for the *next* sprint.

## Quick start

**First time?** Start with:

```
@sprints/sprint-1/S1.1.md @sprints/PROCESS.md Implement S1.1. Follow PROCESS.md: read CONTEXT.md if it exists, implement, then append to CONTEXT.md at the end.
```

Then continue with S1.2, S1.3, etc. in order. Include `@sprints/PROCESS.md` and `@sprints/CONTEXT.md` in prompts so the AI maintains continuity.

---

## Context the AI needs (by story)

| Story | Primary context | Secondary |
|-------|-----------------|------------|
| S1.1 | PLAN.md | — |
| S1.2 | PLAN.md (Data model) | S1.1 deliverables |
| S1.3 | PLAN.md (Observability) | S1.1 structure |
| S1.4 | PLAN.md (Validation) | S1.1 structure |
| S1.5 | PLAN.md, S1.2–S1.4 deliverables | access_codes schema |
| S1.6 | PLAN.md (Status updates) | S1.1 structure |
| S1.7 | PLAN.md (Layout) | S1.5 auth |
| S2.1 | PLAN.md (Data model) | 001 migration |
| S2.2 | PLAN.md (Categories) | 001 migration |
| S2.3 | PLAN.md, S1.7, S2.2 | channels page |
| S2.4 | PLAN.md, S2.2, S1.6 | categories CRUD |
| S3.1 | PLAN.md (Activity Model) | 003 migration |
| S3.2 | PLAN.md, S3.1, S2.3, S1.6 | 004 migration |
| S3.3 | PLAN.md, S3.1, S2.3 | 004 migration |
| S3.4 | PLAN.md (session_traces), S1.3, S3.2 | tracing.ts |
| S3.5 | PLAN.md, S3.2–S3.4 | activity schema |
| S3.6 | PLAN.md (Calendar) | S3.1, S2.3 |
| S4.1 | PLAN.md (AI Provider) | 001 migration |
| S4.2 | PLAN.md, S4.1, S1.3 | llm/ |
| S4.3 | PLAN.md, S4.1, S3.2 | llm/, activity form |
| S4.4 | PLAN.md, S4.1, S3.5 | activity detail |
| S4.5 | PLAN.md (Knowledge base) | 001 migration |
| S4.6 | PLAN.md (Insights) | S4.1, S4.5, S3.1 |
| S4.7 | PLAN.md (Workspace dashboard) | S4.1, S2.3, S3.3 |
| S5.1 | PLAN.md (S3) | S3.1, S3.2 |
| S5.2 | PLAN.md (CloudFront) | S5.1 |
| S6.1 | PLAN.md (Admin) | S1.2, S1.5 |
| S6.2 | PLAN.md, S2.2, S3.1, S6.1 | 003, 004 migrations |
| S6.3 | PLAN.md (session_traces) | S3.4, S6.1 |
| S6.4 | PLAN.md (llm_cost_logs) | S4.2, S6.1 |
