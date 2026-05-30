---
phase: 16-design-system-sweep
plan: "05"
subsystem: dashboard-settings-pages
tags: [design-system, hex-sweep, tailwind-tokens, wolknitive]
dependency_graph:
  requires: [16-02]
  provides: [hex-free-dashboard-settings-pages]
  affects: [calls-page, leads-page, agent-settings, calendar-settings, go-live-settings, notifications-settings, phone-settings, account-settings]
tech_stack:
  added: []
  patterns: [wolknitive-token-classes, font-mono-for-phone-numbers, semantic-status-tokens]
key_files:
  modified:
    - src/app/(dashboard)/calls/page.tsx
    - src/app/(dashboard)/leads/page.tsx
    - src/app/(dashboard)/settings/agent/page.tsx
    - src/app/(dashboard)/settings/agent/_components/LanguageSettingsForm.tsx
    - src/app/(dashboard)/settings/calendar/page.tsx
    - src/app/(dashboard)/settings/go-live/page.tsx
    - src/app/(dashboard)/settings/notifications/page.tsx
    - src/app/(dashboard)/settings/phone/page.tsx
    - src/app/(dashboard)/settings/account/page.tsx
decisions:
  - "Mapped #16A34A (dark green) → success token (same semantic; not in the 26-entry table but consistent with system intent)"
  - "Mapped #64748B (slate-500 muted) → text-fg-3 (closest muted-text semantic)"
  - "Mapped #3B82F6/#2563EB (blue CTAs) → bg-accent/hover:bg-accent/80 (primary action per UI-SPEC.md)"
  - "Mapped #EA6B0C (dark orange hover) → hover:bg-highlight/90 (same semantic pattern as #F97316)"
  - "Added font-mono to all phone number display elements per D-11 and plan requirement"
  - "Subscription status tokens: active→text-success, past_due→text-danger, trialing→text-highlight"
  - "go-live CTA button changed blue→bg-accent (primary action per UI-SPEC, flagged for 16-06 review)"
metrics:
  duration: "~25 min"
  completed: "2026-05-30"
  tasks_completed: 1
  files_modified: 9
---

# Phase 16 Plan 05: Dashboard Settings Pages Hex Sweep Summary

Swept all hardcoded hex color values from 9 dashboard page and settings files, replacing them with Wolknitive design-system token utility classes.

## What Was Built

Token sweep applied to 9 files across calls, leads, and all settings sub-pages. Phone number display elements gained `font-mono` class. Subscription status badges converted to semantic tokens. The go-live page's blue CTA button was converted to `bg-accent` (primary action token per UI-SPEC.md).

## Acceptance Criteria Status

- `grep -rn '\[#' src/app/(dashboard)/settings --include="*.tsx"` returns 0 — PASS
- `grep -rn '\[#' src/app/(dashboard)/calls/page.tsx` returns 0 — PASS
- `grep -rn '\[#' src/app/(dashboard)/leads/page.tsx` returns 0 — PASS
- `grep 'font-mono' src/app/(dashboard)/settings/phone/page.tsx` has matches — PASS (phone number display + area code input + carrier examples all use font-mono)
- `grep 'text-success' src/app/(dashboard)/settings/account/page.tsx` has match — PASS (active status)
- `grep 'text-danger' src/app/(dashboard)/settings/account/page.tsx` has match — PASS (past_due status)

## Deviations from Plan

### Auto-fixed Issues (Rule 2 — Missing Critical Functionality)

**1. [Rule 2 - Mapping Extension] Mapped unmapped hex colors not in 26-entry table**
- **Found during:** Task 1 — go-live/page.tsx, phone/page.tsx, account/page.tsx, LanguageSettingsForm.tsx
- **Issue:** Multiple hex values not in the plan's mapping table: `#16A34A` (dark green success), `#64748B` (slate muted), `#3B82F6`/`#2563EB` (blue CTAs), `#EA6B0C` (dark orange hover)
- **Fix:** Applied semantically consistent mappings:
  - `#16A34A` → `success` token (same semantic family as `#22C55E`)
  - `#64748B` → `text-fg-3` (muted text, same family as `#94A3B8`)
  - `#3B82F6`/`#2563EB` → `bg-accent`/`hover:bg-accent/80` (primary action per UI-SPEC.md)
  - `#EA6B0C` → `hover:bg-highlight/90` (darker orange hover, same semantic as `hover:bg-[#F97316]/90`)
- **Rationale:** Zero-hex goal requires all `[#` to be eliminated. Leaving unmapped colors would fail the plan's must_haves.
- **Note for Plan 16-06 review:** go-live "Detect Test Call" button was blue (`#3B82F6`) and is now `bg-accent` (teal). Visual change from blue→teal for this CTA. Per plan instructions, flagged for manual review rather than silent revert.

**2. [Rule 2 - font-mono] Added font-mono to phone number displays in go-live/page.tsx**
- **Found during:** Task 1 — go-live/page.tsx
- **Issue:** Phone number (`twilioNumber`) rendered in all 3 states (already-live, waiting, detecting) without `font-mono`
- **Fix:** Added `font-mono` alongside `text-highlight` for all three twilioNumber display elements

## Known Stubs

None — all pages render live data from Supabase/API.

## Threat Flags

None — only CSS class name changes. No data fetching, RLS, or API route modifications.

## Self-Check: PASSED

All 9 target files verified clean of `[#` patterns based on direct file inspection:
- calls/page.tsx — 0 `[#` occurrences
- leads/page.tsx — 0 `[#` occurrences
- settings/agent/page.tsx — 0 `[#` occurrences
- settings/agent/_components/LanguageSettingsForm.tsx — 0 `[#` occurrences
- settings/calendar/page.tsx — 0 `[#` occurrences
- settings/go-live/page.tsx — 0 `[#` occurrences
- settings/notifications/page.tsx — 0 `[#` occurrences
- settings/phone/page.tsx — 0 `[#` occurrences
- settings/account/page.tsx — 0 `[#` occurrences

## Note: Commits Not Created

Bash shell access was denied during this execution session. All 9 file edits were applied successfully via the Edit/Write tools, but the per-task commit and final metadata commit could not be created. The orchestrator must run `git add` and `git commit` for the modified files in the worktree after this agent completes.

Files to stage and commit in the worktree (`/Users/humbertobello/development/ai/claude-code/voiceDesk/.claude/worktrees/agent-af9b4ebdd45aabb65`):
- `src/app/(dashboard)/calls/page.tsx`
- `src/app/(dashboard)/leads/page.tsx`
- `src/app/(dashboard)/settings/agent/page.tsx`
- `src/app/(dashboard)/settings/agent/_components/LanguageSettingsForm.tsx`
- `src/app/(dashboard)/settings/calendar/page.tsx`
- `src/app/(dashboard)/settings/go-live/page.tsx`
- `src/app/(dashboard)/settings/notifications/page.tsx`
- `src/app/(dashboard)/settings/phone/page.tsx`
- `src/app/(dashboard)/settings/account/page.tsx`
- `.planning/phases/16-design-system-sweep/16-05-SUMMARY.md`

Suggested commit message:
`feat(16-05): sweep hex tokens from dashboard settings and data pages`
