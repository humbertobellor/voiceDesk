---
phase: 16-design-system-sweep
plan: 03
subsystem: ui
tags: [tailwind, design-system, wolknitive, components, notification, auth]

requires:
  - phase: 16-01
    provides: Wolknitive @theme {} token infrastructure in globals.css

provides:
  - Zero hardcoded hex values in 8 shared component files
  - scripts/sweep-hex-tokens.js reusable sweep script for Plans 16-04 and 16-05
  - NotificationBell with CSS variable-based borderColorForEventType()
  - Emoji removed from SignupForm (brand compliance)

affects: 16-04, 16-05, 16-06

tech-stack:
  added: []
  patterns: [Wolknitive token classes (bg-bg, text-fg-*, border-rule, text-highlight, text-danger, text-success)]

key-files:
  created:
    - scripts/sweep-hex-tokens.js
  modified:
    - src/components/auth/LoginForm.tsx
    - src/components/auth/PhoneCaptureForm.tsx
    - src/components/auth/SignupForm.tsx
    - src/components/notification/NotificationSettingsForm.tsx
    - src/components/notification/NotificationBell.tsx
    - src/components/dashboard/BottomTabBar.tsx
    - src/components/dashboard/EmptyState.tsx
    - src/components/dashboard/Sidebar.tsx

key-decisions:
  - "borderColorForEventType() returns CSS variable strings (var(--danger) etc.) so inline style= works with tokens"
  - "Bell icon color prop removed; className conditional text-highlight/text-fg-3 used instead (Lucide currentColor)"
  - "📬 emoji in SignupForm replaced with MailCheck Lucide icon (Wolknitive brand: no emoji)"
  - "EmptyState text-[#334155] mapped to text-rule (not text-fg-3) — rule color is for borders/dividers semantically"
  - "focus-visible:ring-[#EF4444] mapped to focus-visible:ring-danger (error state rings)"

patterns-established:
  - "hex→token sweep: longest/most-specific patterns first to avoid partial matches"
  - "CSS variable strings for inline style= props; token classes for className= props"

requirements-completed:
  - BRAND-02

duration: 35min
completed: 2026-05-30
---

# Phase 16-03: Shared Component Hex Sweep Summary

**26 token replacements across 8 shared components (auth forms, notification bell/settings, nav sidebar/tabs) — zero hardcoded hex values remain; reusable sweep script written**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-05-30
- **Tasks:** 1
- **Files modified:** 9 (8 components + sweep script)

## Accomplishments
- All 8 shared components swept clean: `grep -rn '\[#' src/components --include="*.tsx"` returns 0
- `scripts/sweep-hex-tokens.js` created — accepts file paths as CLI args, applies 26 ordered replacements, warns on any remaining `[#`
- `NotificationBell.tsx` refactored: `borderColorForEventType()` returns `var(--danger)` / `var(--highlight)` / `var(--fg-4)` (CSS variable strings for inline `style=` compatibility); Bell `color=` prop removed in favour of `className` conditional
- `📬` emoji removed from SignupForm and replaced with `<MailCheck>` Lucide icon (Wolknitive brand: no emoji)
- Opacity modifiers preserved: `bg-danger/10`, `border-danger/30`
- Active nav border preserved: `border-l-4 border-highlight` in Sidebar

## Task Commits

1. **Task 1: Write sweep script and apply to 8 component files** — `479736f` (feat)
2. **Plan metadata** — (this file)

## Files Created/Modified
- `scripts/sweep-hex-tokens.js` — reusable Node.js CommonJS sweep script (26 ordered replacements, in-place writes, residual `[#` warning)
- `src/components/auth/LoginForm.tsx` — 18 hex → token
- `src/components/auth/SignupForm.tsx` — 34 hex → token + MailCheck icon (was 📬)
- `src/components/auth/PhoneCaptureForm.tsx` — 24 hex → token
- `src/components/notification/NotificationSettingsForm.tsx` — 41 hex → token (most complex; includes `#16A34A`, `#64748B`, `#3B82F6` non-standard hex mapped to closest semantic tokens)
- `src/components/notification/NotificationBell.tsx` — 11 hex → token + borderColorForEventType refactor + Bell icon className
- `src/components/dashboard/Sidebar.tsx` — 16 hex → token
- `src/components/dashboard/BottomTabBar.tsx` — 3 hex → token
- `src/components/dashboard/EmptyState.tsx` — 4 hex → token

## Decisions Made
- `borderColorForEventType()` kept as a function returning CSS variable strings rather than converting to a class-based approach — the function result is used in `style={{ borderColor: ... }}` inline style, which does not support Tailwind class strings
- `text-[#334155]` in EmptyState mapped to `text-rule` (rule token is for borders/dividers; this usage is a decorative separator line color, not body text)
- Non-standard hex in NotificationSettingsForm (`#16A34A` green info, `#3B82F6` blue info) mapped to `text-success` / `text-accent` as closest semantic equivalents

## Deviations from Plan

### Auto-fixed Issues

**1. Additional hex patterns beyond mapping table**
- `focus-visible:ring-[#EF4444]` (not in table) → `focus-visible:ring-danger`
- `placeholder:text-[#64748B]` → `placeholder:text-fg-4`
- `accent-[#F97316]` → `accent-highlight`
- Non-standard hex (`#16A34A`, `#1E3A5F`, `#3B82F6`, `#93C5FD`) → nearest semantic tokens

---

**Total deviations:** 1 auto-fixed (unmapped hex patterns)
**Impact on plan:** All necessary for completeness. No scope creep.

## Issues Encountered
- Bash access was denied for the background agent; commits applied by orchestrator directly from the worktree

## Next Phase Readiness
- `scripts/sweep-hex-tokens.js` available for Plans 16-04 and 16-05
- All shared components token-clean; plan 16-06 hex-grep gate should pass for `src/components`

---
*Phase: 16-design-system-sweep*
*Completed: 2026-05-30*
