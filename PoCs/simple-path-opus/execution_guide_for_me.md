How to Execute the Simple Path Plan
Your project uses a Progressive Build Protocol (PBP) with 14 steps. Everything is already well-organized. Here's the practical workflow:

The Basics
One step per chat session. Each step gets its own Cursor conversation.
Steps are sequential (with some parallelism possible later). You start at Step 01 and work through the dependency chain.
All 14 steps are currently pending in STEPS.md.
To Start Step 01 (Bootstrap + Foundations)
Open a new Cursor chat and type this prompt, using @ references to attach the files:

@steps/STEP-01.md @steps/PROCESS.md @CONTEXT.md @PLAN.md
Execute Step 01. Follow the PBP protocol.
The AI will then follow the six-phase protocol automatically:

ORIENT — Read context and the step brief
PLAN — Declare which files it will create/modify, ask any clarifying questions
BUILD — Implement against the acceptance criteria in STEP-01.md
VERIFY — Check all criteria are met, no lint errors, builds clean
CAPTURE — Append a summary to CONTEXT.md
EVOLVE — Create/update ARCHITECTURE.md with the mental model
After Step 01 is Done
Verify the step is marked done in STEPS.md
Confirm CONTEXT.md has a new section for Step 01
Confirm ARCHITECTURE.md was created
Start a new chat session for Step 02
For Each Subsequent Step
Same pattern — new session, same prompt structure:

@steps/STEP-XX.md @steps/PROCESS.md @CONTEXT.md @ARCHITECTURE.md
Execute Step XX. Follow the PBP protocol.
Note: from Step 02 onward, you reference @ARCHITECTURE.md instead of @PLAN.md (since ARCHITECTURE.md will exist by then). You can include @PLAN.md too if you want — more context is fine.

The Step Order (following dependencies)
01 → 02 → 03 → 04 → 05 → 06
                                ├→ 07 → 11 ─┐
                                ├→ 08 → 09 ──┼→ 13 → 14
                                │    └→ 10 ──┘
                                └→ 12
Steps 01–06 are strictly sequential
After Step 06, Steps 07, 08, and 12 can run in parallel (separate sessions)
After Step 08, Steps 09 and 10 can run in parallel
Step 13 (Admin) is the convergence point — needs 03, 09, 10, 11 done
Step 14 is always last
Practical Tips
Don't skip the ORIENT phase. The CONTEXT.md file is how the AI maintains memory across sessions. It's critical.

Review the PLAN phase output. Before the AI starts building, it will tell you what it plans to do. This is your chance to course-correct before code gets written.

Keep sessions focused. One step per session prevents context overload and keeps quality high.

If a step is too large for one session (the AI hits context limits), you can split it: finish the BUILD phase, then start a follow-up session referencing CONTEXT.md for VERIFY/CAPTURE/EVOLVE.

You'll need Supabase credentials before Step 02. Make sure you have a Supabase project created and the URL + keys ready in your .env file.