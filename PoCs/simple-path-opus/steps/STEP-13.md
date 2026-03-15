# Step 13: Admin Module

## Goal

Build the mobile-first admin module following the same Slack-style drill-down pattern as the user app — admin sections as "channels," item lists within each, and Notion-style detail pages.

## Acceptance Criteria

### Admin Shell (Same Drill-Down Pattern)

- [ ] Admin layout (`src/app/(admin)/layout.tsx`) — mobile-first, visually distinct from user app (different accent color, "Admin" badge in header)
- [ ] **Admin home** = section list (like channel list): Users, Categories, Knowledge Base, AI Config, Costs, Traces — each as a tappable card
- [ ] **Drill-down:** Tap a section → item list → tap item → Notion-style detail page. Back arrow at each level.
- [ ] Admin nav header: shows current section name + back arrow when drilled in
- [ ] Admin auth: `requireAdmin()` check on layout — only users with role=admin can access
- [ ] Admin overview dashboard (`src/app/(admin)/page.tsx`) — key metrics at the top of the section list (total users, total activities, active spaces, AI costs this period)

### User + Space Management

- [ ] Users section → users list (`src/app/(admin)/users/page.tsx`) — searchable list with status, space info
- [ ] User detail (Notion-style page): view/edit user fields, view their space, suspend/activate
- [ ] Create user + space + access code in one flow (admin provisions users per PLAN.md)
- [ ] Access code management: view (masked), regenerate, deactivate

### Category Management

- [ ] Categories section → category catalog list (`src/app/(admin)/categories/page.tsx`) — manage system-defined category templates
- [ ] Category template detail (Notion-style page): title, description, questions list
- [ ] Questions per catalog category: add/edit/remove/reorder questions (with question_type selection) — use Accordion for question list
- [ ] Space features: toggle features per space (activity_tracker, suggestion_box future flag, public_site future flag)

### Knowledge Base Management

- [ ] Knowledge Base section → space list → knowledge base entries per space
- [ ] Admin can view/edit knowledge base for any space
- [ ] Filter by space, category, type
- [ ] Entry detail (Notion-style page): title, content, type, category association

### AI Configuration

- [ ] AI Config section → provider list (`src/app/(admin)/ai-config/page.tsx`)
- [ ] Provider detail (Notion-style page): model name, config (temperature, max_tokens), active/inactive toggle

### Operational Dashboards

- [ ] **Costs section** (`src/app/(admin)/costs/page.tsx`):
  - Overview: total cost by period (day/week/month)
  - Drill-down: cost by provider, by model, by operation, by space (top consumers)
  - Filterable table: date range, provider, operation, space
- [ ] **Traces section** (`src/app/(admin)/traces/page.tsx`):
  - Search by trace_id or session_id
  - Results list → tap → session timeline (Notion-style page)
  - Timeline shows: action_type, params (sanitized), result, duration, timestamp
  - Reconstruct user journey for support debugging

## Key Files (expected)

```
src/app/(admin)/layout.tsx
src/app/(admin)/page.tsx
src/app/(admin)/users/page.tsx
src/app/(admin)/users/[userId]/page.tsx
src/app/(admin)/users/actions.ts
src/app/(admin)/categories/page.tsx
src/app/(admin)/categories/[catalogId]/page.tsx
src/app/(admin)/categories/actions.ts
src/app/(admin)/knowledge-base/page.tsx
src/app/(admin)/knowledge-base/[spaceId]/page.tsx
src/app/(admin)/ai-config/page.tsx
src/app/(admin)/ai-config/[providerId]/page.tsx
src/app/(admin)/ai-config/actions.ts
src/app/(admin)/costs/page.tsx
src/app/(admin)/traces/page.tsx
src/app/(admin)/traces/[traceId]/page.tsx
src/lib/services/admin.ts
```

## Dependencies

- Step 03 (auth — admin role check)
- Step 09 (knowledge base schema and service)
- Step 10 (insights — admin may need to view/manage)
- Step 11 (session traces schema and service)

## Context to Read

- `PLAN.md` — Admin section, UI/UX section (admin follows same drill-down), Key Flows (9)
- `ARCHITECTURE.md` — all established patterns (admin reuses the same component kit and patterns as user app)
- `CONTEXT.md` — all prior steps (admin surfaces data from every feature)

## Testing Requirements

- [ ] Admin auth: non-admin users cannot access admin routes
- [ ] User provisioning: creates user + space + access code in one transaction
- [ ] LLM cost aggregation: correct totals by period, provider, operation

## Notes

- **Admin follows the exact same UX pattern as the user app:** section list (channels) → item list → Notion-style detail page. This gives admins a familiar, consistent experience.
- Admin layout should be visually distinct: different accent color (e.g., a darker or branded admin color) and an "Admin" badge in the header so admins always know they're in admin mode.
- User provisioning is the admin's main workflow: create users, generate access codes, tell users their codes. This flow must be the most polished admin feature.
- Access code display: show the code once at creation time (with copy button). After that, show only masked version. Regenerate creates a new code.
- Trace viewer is the support tool: user reports "error with trace ID xyz" → admin searches → sees full session timeline. This is the admin equivalent of a "conversation" — reconstructing what happened.
- LLM cost dashboard is critical for cost control. Admin needs to see at a glance: are costs reasonable? who's consuming? what operations cost the most?
- Reuse the same UI components (Card, Accordion, Badge, Sheet, Skeleton, etc.) from the user app. Admin is not a separate design system.
- Keep admin server actions in separate files from user actions, even if they call the same services. This makes admin-specific authorization clearer.
- Consider pagination on all admin lists — user count and trace count will grow.
