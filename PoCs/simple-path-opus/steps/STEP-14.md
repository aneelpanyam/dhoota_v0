# Step 14: Integration + Polish

## Goal

Verify the full end-to-end application, optimize performance, audit error handling, write integration tests for key user journeys, and finalize all living documents.

## Acceptance Criteria

### End-to-End Verification

- [ ] Full user journey works: login → channels → create category → add activity → AI generates title → view feed → view detail → generate insight → export
- [ ] Full admin journey works: login → dashboard → create user → manage categories → view costs → lookup trace
- [ ] Calendar shows activities correctly across categories and dates
- [ ] Knowledge base flows into AI insights correctly
- [ ] Activity linking, social posts, participants all display and edit correctly

### Performance Optimization

- [ ] Lazy loading: route-level code splitting verified (Next.js App Router default)
- [ ] Image optimization: Next.js Image component used for activity attachments where applicable
- [ ] Query optimization: no N+1 queries in feed, dashboard, or admin lists (verify with Supabase query logs or explain)
- [ ] Pagination verified on all list pages (activities, insights, admin users, traces, costs)
- [ ] Loading states: every data-fetching page shows skeleton/loading state before data arrives

### Error Handling Audit

- [ ] Every server action returns trace_id on error
- [ ] Every error boundary displays trace_id
- [ ] Every toast error shows trace_id
- [ ] No unhandled promise rejections in server actions
- [ ] No raw error messages leaked to client (sanitize for user display, log full error server-side)
- [ ] AI failure doesn't block core functionality (activities save without AI fields)

### Integration Tests

- [ ] Auth flow: access code → OTP → session → protected route access → logout
- [ ] Activity lifecycle: create → edit → add tags/notes → mark completed
- [ ] Insight generation: select activities → generate → save → export
- [ ] Admin provisioning: create user + space + access code → user can login

### Documentation Finalization

- [ ] `ARCHITECTURE.md` reflects final state of the system (all patterns, all modules, all conventions)
- [ ] `CONTEXT.md` has final summary section: "App is feature-complete for Phase 1"
- [ ] `README.md` created: project overview, setup instructions, env vars, how to run locally, how to deploy
- [ ] All `.env.example` vars documented and current

## Key Files (expected)

```
ARCHITECTURE.md (final update)
CONTEXT.md (final section)
README.md (new)
src/__tests__/integration/
    auth-flow.test.ts
    activity-lifecycle.test.ts
    insight-generation.test.ts
    admin-provisioning.test.ts
```

## Dependencies

- Step 13 (admin module — all features must be complete)

## Context to Read

- `PLAN.md` — all sections (full-app verification)
- `ARCHITECTURE.md` — all patterns (verify adherence)
- `CONTEXT.md` — all step entries (verify nothing was missed)

## Testing Requirements

This step IS the testing step. All integration tests listed above are required.

## Notes

- This step is about **verification and polish**, not new features. If something is broken, fix it. If something is missing, add it.
- Integration tests should use the actual Supabase instance (test schema or dedicated test project) — not mocks. This catches real DB/RLS issues.
- Performance: use browser DevTools Lighthouse audit on the mobile viewport. Target: Performance > 80, Accessibility > 90.
- Error handling audit: manually trigger errors (invalid input, AI failure, network timeout simulation) and verify the user experience is graceful.
- README should be comprehensive enough that a new developer can clone the repo, set up env vars, run migrations, and start the dev server in under 15 minutes.
- This is also the step where ARCHITECTURE.md gets its "final polish" — make sure it's a document any developer would appreciate reading.
- After this step, the app is ready for Phase 1 deployment. Future phases (collaboration, suggestion box, public site) build on this foundation.
