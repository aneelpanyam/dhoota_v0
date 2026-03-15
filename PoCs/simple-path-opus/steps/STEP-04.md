# Step 04: App Shell + Design System

## Goal

Build the mobile-first app shell with Slack-style drill-down navigation and a shared UI component kit, establishing the visual language and interaction patterns for the entire app.

## Acceptance Criteria

### App Shell + Navigation

- [ ] App layout (`src/app/(app)/layout.tsx`) — mobile-first shell with minimal bottom bar and drill-down content area
- [ ] Bottom navigation bar (`src/components/navigation/bottom-nav.tsx`): 4 items — Channels (home), Calendar, Insights, Profile (icons + labels)
- [ ] Active tab state with visual indicator
- [ ] **Drill-down is the primary flow:** Channels tab is the default; within it, the user drills: category list → activity list → activity page. Back arrow navigation at each level.
- [ ] Navigation header (`src/components/navigation/nav-header.tsx`): context-aware header that shows current location (e.g., "Channels", category name, activity title) with back arrow when drilled in
- [ ] Navigation works correctly with Next.js App Router (no full-page reloads, smooth transitions)
- [ ] Auth integration: app layout verifies session, redirects if unauthenticated

### Status + Feedback System

- [ ] Status toast system (`src/components/ui/toast.tsx`) — non-intrusive, bottom/corner placement, auto-dismiss on success, persist on error with trace_id
- [ ] Toast variants: success (green), error (red, shows trace_id), info (blue), loading (animated)
- [ ] Error boundary component (`src/components/ui/error-boundary.tsx`) — catches React errors, shows user-friendly message with trace_id, option to retry
- [ ] Loading skeleton component (`src/components/ui/skeleton.tsx`) — reusable loading placeholder for lists, cards, and pages

### Shared UI Components

- [ ] `Button` — primary, secondary, ghost, destructive variants; loading state with spinner
- [ ] `Input` — text input with label, error state, helper text; mobile-optimized (large touch targets)
- [ ] `Card` — tappable container for list items (Slack channel style); optional header, body, footer
- [ ] `Sheet` — bottom sheet for mobile actions (preferred over centered modals); smooth slide animation
- [ ] `Badge` — status/tag display (draft, active, completed, category labels)
- [ ] `Avatar` — user avatar with fallback initials
- [ ] `Accordion` — collapsible toggle section (Notion-style); used for question answers on activity pages
- [ ] `FAB` (Floating Action Button) — positioned bottom-right for primary actions (e.g., "Add Activity"); respects bottom nav spacing

### Shell Pages

- [ ] Empty shell pages as navigation targets: channels list, calendar, insights, profile (placeholder content)
- [ ] Design tokens applied consistently: font hierarchy, color palette, spacing scale
- [ ] All components responsive — mobile-first, graceful scaling to larger screens

## Key Files (expected)

```
src/app/(app)/layout.tsx
src/app/(app)/channels/page.tsx          (placeholder)
src/app/(app)/calendar/page.tsx          (placeholder)
src/app/(app)/insights/page.tsx          (placeholder)
src/app/(app)/profile/page.tsx           (placeholder)
src/components/navigation/bottom-nav.tsx
src/components/navigation/nav-header.tsx
src/components/ui/toast.tsx
src/components/ui/error-boundary.tsx
src/components/ui/skeleton.tsx
src/components/ui/button.tsx
src/components/ui/input.tsx
src/components/ui/card.tsx
src/components/ui/sheet.tsx
src/components/ui/badge.tsx
src/components/ui/avatar.tsx
src/components/ui/accordion.tsx
src/components/ui/fab.tsx
```

## Dependencies

- Step 01 (Tailwind, fonts, root layout)
- Step 03 (auth — app layout needs session check)

## Context to Read

- `PLAN.md` — UI/UX section (Slack + Notion + ChatGPT vision), Status updates, Design Tokens
- `.cursor/rules/ux-activity-creation.mdc` — UX principles (contextual guidance, plain language)
- `ARCHITECTURE.md` — component conventions, folder structure
- `CONTEXT.md` — Steps 01–03 decisions

## Testing Requirements

No automated tests for UI components in this step. Visual verification only.

## Notes

- **Mental model: Slack + Notion + ChatGPT.** The shell should feel like Slack mobile: channel list on home, drill into channels, content within.
- Bottom bar provides global navigation (Calendar, Insights, Profile are always reachable), but the **primary user flow is drill-down** within the Channels tab.
- The `nav-header` is crucial for the drill-down UX: it must clearly show where the user is and how to go back. Think of Slack's mobile header that shows channel name + back arrow.
- `Accordion` component is key for the Notion-style activity pages (Step 07) — build it now as part of the design system so it's ready.
- `FAB` component will be used on the activity list page (Step 07) for "Add Activity" — build the generic component now.
- `Sheet` is preferred over centered modals on mobile — it's more thumb-friendly. Use for confirmations, quick actions, filters.
- Toast system: use a context provider pattern so any component/server action can trigger a toast.
- Consider using Radix UI primitives for accessible Sheet/Accordion if adding a dependency is acceptable, or build minimal custom versions.
- Design tokens in Tailwind config should make theming easy: changing `colors.primary` should update the whole app.
- Admin layout is separate (`(admin)/layout.tsx` in Step 13) but will follow the same drill-down pattern.
