---
phase: 16-design-system-sweep
plan: "02"
subsystem: testing
tags: [playwright, visual-regression, screenshots, baseline]

# Dependency graph
requires:
  - phase: 16-01
    provides: "Wolknitive token infrastructure in globals.css (before-snapshots capture the transitional state where globals.css has @theme block but component hex values are still hardcoded)"
provides:
  - "5 before-snapshot PNG baselines capturing pre-sweep UI state: login, dashboard/calls, leads, agent-settings, notification-settings"
  - "Playwright capture script (scripts/capture-before-snapshots.ts) for repeatable full-page screenshots"
  - "tests/visual/ directory tracked in git with PNG files gitignored"
affects:
  - 16-06  # after-snapshots plan — manual side-by-side comparison depends on these before files

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Standalone Playwright screenshot script pattern (not a test spec — raw chromium.launch() Node.js script)"
    - "Unauthenticated capture pattern — auth-protected pages captured at login-redirect state, still valid visual baselines"

key-files:
  created:
    - tests/visual/.gitkeep
    - scripts/capture-before-snapshots.ts
  modified:
    - .gitignore

key-decisions:
  - "Capture auth-protected pages at login-redirect state rather than skip — provides valid visual baseline for outer shell and header even without credentials"
  - "Use ESM __dirname shim (import.meta.url + fileURLToPath) in capture script to support Next.js ESM project setup without ts-node CommonJS fallback"
  - "Store PNGs outside git (gitignored) — screenshots may contain UI state and grow repo size; only the capture script and .gitkeep are tracked"

patterns-established:
  - "Visual baseline pattern: before-snapshots in tests/visual/ named {page}-before.png, after-snapshots in Plan 16-06 named {page}-after.png"

requirements-completed:
  - BRAND-04

# Metrics
duration: ~25min
completed: "2026-05-30"
---

# Phase 16, Plan 02: Before-Snapshots Baseline Summary

**Playwright visual baseline captured for 5 key pages at pre-sweep state (hardcoded hex still in components), with ESM-compatible capture script committed to scripts/**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-30T13:30:00Z
- **Completed:** 2026-05-30T14:15:00Z
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 3 created/modified, 5 PNG baselines captured (gitignored)

## Accomplishments

- Created `tests/visual/` directory structure tracked in git (PNG files excluded via .gitignore)
- Wrote `scripts/capture-before-snapshots.ts` — standalone ESM Playwright script that launches Chromium headless and captures 5 full-page screenshots at 1280px width
- Captured all 5 before-snapshots with human verification: login (5.2KB rendered form), dashboard/calls, leads, agent-settings, notification-settings (98KB each showing login-redirect state)

## Task Commits

1. **Task 1: Create tests/visual/ directory and Playwright snapshot script** — `d5f7d34` (chore)
2. **Checkpoint deviation: ESM __dirname shim fix** — `813dd0a` (fix)

## Files Created/Modified

- `tests/visual/.gitkeep` — Tracks the directory in git without committing PNGs
- `scripts/capture-before-snapshots.ts` — Standalone Playwright capture script; launches Chromium, navigates 5 pages, saves PNGs to tests/visual/
- `.gitignore` — Added `tests/visual/*.png` entry to exclude screenshot binaries from git

## Decisions Made

- Captured auth-protected pages at their unauthenticated state (login redirect) rather than provisioning test credentials. The redirected pages still render the outer shell/layout with current hardcoded hex values — valid visual baselines for Plan 16-06 comparison.
- Used ESM-native `__dirname` shim (`fileURLToPath(new URL('.', import.meta.url))`) because the project is configured as ESM (`"type": "module"` / Next.js ESM). CommonJS `__dirname` is not available in this context.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESM __dirname not available in ESM module context**
- **Found during:** Checkpoint — capture script execution
- **Issue:** `scripts/capture-before-snapshots.ts` used CommonJS `__dirname` which is undefined in ESM context; script crashed on path resolution
- **Fix:** Replaced `__dirname` with `fileURLToPath(new URL('.', import.meta.url))` — standard ESM shim
- **Files modified:** `scripts/capture-before-snapshots.ts`
- **Verification:** Script ran successfully after fix; all 5 PNGs captured
- **Committed in:** `813dd0a` (fix(16-02): add ESM __dirname shim to capture script)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** ESM shim required for script to run at all. No scope creep.

## Issues Encountered

- Script initially failed at runtime due to ESM/CommonJS mismatch for `__dirname`. Fixed with standard ESM shim before proceeding to capture. All 5 screenshots captured successfully after fix.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Before-snapshot baselines are in place at `tests/visual/*-before.png` (5 files, gitignored)
- Plans 16-03 through 16-05 can now proceed with the component-level hex sweep
- Plan 16-06 (after-snapshots) will capture the post-sweep state and produce side-by-side comparisons against these baselines
- No blockers

---
*Phase: 16-design-system-sweep*
*Completed: 2026-05-30*
