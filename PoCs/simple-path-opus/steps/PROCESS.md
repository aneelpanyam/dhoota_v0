# Progressive Build Protocol (PBP)

> **This is a project-agnostic process.** Use it for any app built step-by-step with AI assistance.
> Copy this file into any new project's `steps/` folder to bootstrap the protocol.

---

## Living Documents

Every PBP project maintains exactly four documents at the project root:

| Document | Purpose | Audience |
|----------|---------|----------|
| **PLAN.md** | Source of truth for *what* we're building. Scope, data model, tech stack, features. | Product / AI |
| **ARCHITECTURE.md** | The mental model. *How* the system works, *where* things go, *what patterns* to follow. | Developers / AI |
| **CONTEXT.md** | Living memory. Accumulated decisions, gotchas, codebase state after each step. | AI (continuity) |
| **STEPS.md** | Execution roadmap. All steps with status, goal, and dependencies. | Product / AI |

**ARCHITECTURE.md** is the document that makes a senior architect feel at home. It answers: "I just joined this project — how does it work and where do I put things?"

**CONTEXT.md** is append-only. When it exceeds ~80 sections, archive older entries to `CONTEXT_ARCHIVE.md` and keep the last 5 steps in CONTEXT.md.

---

## The Protocol

Every step follows this sequence. No exceptions.

```
ORIENT --> PLAN --> BUILD --> VERIFY --> CAPTURE --> EVOLVE
```

### 1. ORIENT (read before touching code)

- Read `CONTEXT.md` — understand what happened before, what decisions are in effect
- Read the step brief (`steps/STEP-XX.md`) — understand the goal and acceptance criteria
- Review relevant existing source files listed in context
- Review `ARCHITECTURE.md` — understand established patterns and conventions
- If anything is unclear, ask before building

### 2. PLAN (declare intent before building)

Before writing any code, state:
- Files you will create or modify (with paths)
- Patterns you will follow (cite ARCHITECTURE.md sections)
- Any open questions, risks, or deviations from PLAN.md
- Any new patterns you anticipate introducing

This step prevents drift and gives the user a chance to course-correct.

### 3. BUILD (implement against acceptance criteria)

- Follow acceptance criteria from the step brief — treat them as a checklist
- Follow established patterns from ARCHITECTURE.md — consistency over cleverness
- Write tests for critical paths as specified in the step brief
- Run linter after substantive edits — fix any introduced errors
- Keep commits atomic if the user requests them

### 4. VERIFY (quality gate — non-negotiable)

Before declaring a step complete, verify:
- [ ] All acceptance criteria from the step brief are met
- [ ] Tests pass (if any were written)
- [ ] No linter errors introduced
- [ ] Code follows ARCHITECTURE.md patterns
- [ ] Mobile-first check (if UI work was done)
- [ ] No `any` types, no unhandled errors, no console.log left behind
- [ ] Error responses include trace_id where applicable

### 5. CAPTURE (append to CONTEXT.md)

Add a new section to `CONTEXT.md` with this structure:

```markdown
---

## Step XX: [Title] — [Date]

### Delivered
- [Key files created or modified, with paths]
- [Migrations, components, server actions, tests]

### Decisions Made
- [Architectural or implementation choices that affect future steps]
- [Conventions adopted (naming, patterns, structure)]
- [Deviations from PLAN.md and why]

### Patterns Established
- [New patterns introduced in this step]
- [Reference to ARCHITECTURE.md section if updated]

### Gotchas / Learnings
- [Things that were tricky or required iteration]
- [Edge cases handled]
- [Dependencies or setup notes]

### State for Next Step
- [What the next step should know about current codebase state]
- [Files to reference]
- [Any prerequisites or setup needed]
```

Keep it concise: 10–20 lines per step. Focus on what a fresh AI session needs to pick up smoothly.

### 6. EVOLVE (update ARCHITECTURE.md if the mental model changed)

After each step, ask: "Did the mental model change?"

- New patterns introduced? Document them in ARCHITECTURE.md.
- New conventions adopted? Add them.
- Folder structure changed? Update the map.
- New service layer or abstraction? Describe the contract.

ARCHITECTURE.md must always reflect the *current* state of the system, not the planned state. It is the living truth of "how this system works right now."

---

## Quality Principles

These are enforced across all steps, regardless of project:

- **Single Responsibility** — Each module/file does one thing well
- **Explicit over implicit** — No magic. Clear data flow. Named exports.
- **Colocation** — Keep related code together (server action next to its page, validation schema next to its type)
- **Thin server actions** — Validate (Zod) -> call service -> return. Business logic lives in the service layer.
- **Type safety end-to-end** — Generated types flow from DB to UI. No `any`.
- **Error traceability** — Every error response includes `trace_id`. Structured logging everywhere.
- **Progressive disclosure in code** — Simple cases are simple. Complex cases are possible.

---

## How to Prompt for a Step

When starting a step, include these references:

```
@steps/STEP-XX.md @steps/PROCESS.md @CONTEXT.md @ARCHITECTURE.md

Execute Step XX. Follow the PBP protocol.
```

The AI will: ORIENT (read context) -> PLAN (declare intent) -> BUILD (implement) -> VERIFY (quality gate) -> CAPTURE (update CONTEXT.md) -> EVOLVE (update ARCHITECTURE.md if needed).

**One step per session.** Complete each step before starting the next. Mark progress in `STEPS.md`.

---

## Maintenance

- **STEPS.md** — Update status after each step: `pending` -> `in_progress` -> `done`
- **CONTEXT.md** — Append after each step. Archive if it grows beyond ~80 sections.
- **ARCHITECTURE.md** — Evolve after each step. Keep current. Never let it become stale.
- **Step briefs** — Once a step is done, don't modify its brief. It serves as historical record.
