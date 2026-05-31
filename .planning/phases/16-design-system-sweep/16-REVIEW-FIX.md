---
phase: 16-design-system-sweep
fixed_at: 2026-05-30T00:00:00Z
review_path: .planning/phases/16-design-system-sweep/16-REVIEW.md
iteration: 1
findings_in_scope: 13
fixed: 13
skipped: 0
status: all_fixed
---

# Phase 16: Code Review Fix Report

**Fixed at:** 2026-05-30
**Source review:** `.planning/phases/16-design-system-sweep/16-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 13 (4 Critical + 9 Warning; Info excluded per default scope)
- Fixed: 13
- Skipped: 0

## Fixed Issues

### CR-01: Circular CSS custom property in `@theme` font block

**Files modified:** `src/app/globals.css`
**Commit:** `50ef91c`
**Applied fix:** Replaced the four self-referential `var(--font-*)` declarations in the `@theme` block with inlined font family strings (Option B). This breaks the circular reference that caused all `font-display`, `font-body`, `font-ui`, and `font-mono` utility classes to resolve to the guaranteed-invalid value.

---

### CR-02: Sweep script maps focus ring to semantically wrong token

**Files modified:** `src/components/notification/NotificationBell.tsx`
**Commit:** `e39deba`
**Applied fix:** Changed `focus-visible:ring-accent` (teal) to `focus-visible:ring-highlight` (amber) on the NotificationBell trigger button, which has an amber/highlight-colored bell icon. Also replaced `hover:bg-white/5` with token-based `hover:bg-fg/5` on the same button. Form input `ring-accent` usages in auth forms were left as-is — teal is the semantically correct focus ring for text inputs.

---

### CR-03: `next/font` variables declared but never consumed

**Files modified:** `src/app/globals.css`, `src/app/layout.tsx`
**Commit:** `4158d7f`
**Applied fix:**
1. Removed the Google Fonts CDN `@import` for Inter Tight and JetBrains Mono from `globals.css` — eliminated the double-download.
2. Updated `:root` `--font-ui` and `--font-mono` to reference `var(--font-inter-tight)` and `var(--font-jetbrains-mono)` (next/font runtime CSS vars), so the self-hosted optimised copies are actually applied.
3. Removed the unused `Inter` (bare) font import from `layout.tsx` and its `--font-inter` variable from the `<html>` className.

---

### CR-04: Multiple Tailwind color classes outside the design system survived the sweep

**Files modified:** `src/app/(dashboard)/settings/account/page.tsx`, `src/app/(dashboard)/calls/page.tsx`, `src/app/(dashboard)/leads/page.tsx`, `src/app/(dashboard)/settings/phone/page.tsx`, `src/components/notification/NotificationSettingsForm.tsx`
**Commit:** `34d7943`
**Applied fix:**
- `account/page.tsx`: Replaced `bg-red-900/30`, `border-red-700`, `text-red-300`, `bg-red-900/20`, `border-red-800`, `text-red-400` with `bg-danger/10`, `border-danger/30`, `text-danger`. Replaced subscription status labels `text-green-400` → `text-success`, `text-yellow-400` → `text-highlight`, `text-indigo-400` → `text-accent`. Replaced `text-white` on manage button → `text-fg-on-dark`, `text-red-400` on inline error → `text-danger`.
- `calls/page.tsx` + `leads/page.tsx`: `bg-green-500` → `bg-success`, `text-gray-400` → `text-fg-3` on the live indicator.
- `phone/page.tsx`: Advisory box `bg-yellow-500/10` → `bg-highlight/10`, `border-yellow-500/30` → `border-highlight/30`, `text-yellow-300` → `text-highlight`.
- `NotificationSettingsForm.tsx`: Two `text-gray-300` field labels → `text-fg-3`.

---

### WR-01: `text-bg` on colored button backgrounds fails dark-mode contrast

**Files modified:** `src/components/auth/LoginForm.tsx`, `src/components/auth/SignupForm.tsx`, `src/components/auth/PhoneCaptureForm.tsx`, `src/components/notification/NotificationSettingsForm.tsx`, `src/app/(dashboard)/settings/agent/_components/LanguageSettingsForm.tsx`, `src/app/(dashboard)/connect-calendar/_components/ConnectCalendarForm.tsx`, `src/app/(auth)/pricing/page.tsx`
**Commit:** `094b918`
**Applied fix:** Replaced all `bg-highlight text-bg` (and `text-bg` on the Telegram webhook button) with `text-fg-on-dark` across all 9 occurrences. `text-fg-on-dark` resolves to `--vellum-50` (cream), which provides better contrast on amber backgrounds in both light and dark modes.

---

### WR-02: `text-white` used on multiple buttons

**Files modified:** `src/components/notification/NotificationBell.tsx`, `src/app/(dashboard)/settings/phone/page.tsx`, `src/app/(dashboard)/settings/go-live/page.tsx`
**Commit:** `15c6d19`
**Applied fix:** Replaced `text-white` with `text-fg-on-dark` on the unread notification badge (NotificationBell), the Provision My Number button (phone/page.tsx), and the I've Called button (go-live/page.tsx). The `text-white` occurrences in `account/page.tsx` were fixed as part of CR-04.

---

### WR-03: Hardcoded RGBA arbitrary value in NotificationBell row hover

**Files modified:** `src/components/notification/NotificationBell.tsx`
**Commit:** `589e5fc`
**Applied fix:** Replaced `hover:bg-[rgba(255,255,255,0.05)]` with `hover:bg-bg-sunken` — the semantic surface token for subtle hover states on elevated surfaces. `bg-bg-sunken` adapts correctly in both light and dark modes via the design system token remapping.

---

### WR-05: Snapshot scripts crash when output directory is missing

**Files modified:** `scripts/capture-before-snapshots.ts`, `scripts/capture-after-snapshots.ts`
**Commit:** `5770e99`
**Applied fix:** Added `import { mkdirSync } from 'fs'` and `mkdirSync(OUTPUT_DIR, { recursive: true })` at the start of `main()` in both scripts. This ensures the `tests/visual/` directory is created before the browser launches, preventing a crash that left the browser process alive until `finally` ran.

---

### WR-06: `realtimeStatus` state is declared and never read in `calls/page.tsx`

**Files modified:** `src/app/(dashboard)/calls/page.tsx`
**Commit:** `5bc9c1e`
**Applied fix:** Removed the `const [realtimeStatus, setRealtimeStatus] = useState<...>('connecting')` declaration entirely. The `useState` import was retained (still needed for `selectedCallId`). The placeholder `console.log` was also removed as part of this change (coordinated with WR-07).

---

### WR-07: `console.log` debug statements in production page components

**Files modified:** `src/app/(dashboard)/calls/page.tsx`, `src/app/(dashboard)/leads/page.tsx`
**Commit:** `48a1f37`
**Applied fix:** Removed `console.log('New call:', callId)` from `calls/page.tsx` (handled in WR-06 commit) and `console.log('New lead:', leadId)` from `leads/page.tsx`. The subscription callbacks now have empty bodies with a comment explaining the subscription hook handles query invalidation internally.

---

### WR-09: Unreachable auth redirect / infinite loading in `pricing/page.tsx` `useEffect`

**Files modified:** `src/app/(auth)/pricing/page.tsx`
**Commit:** `7422826`
**Applied fix:** Restructured the promise chain to:
1. Add `return` before the inner contractor query so its rejection propagates to the outer `.catch()`.
2. Add `.catch((err: Error) => { setIsLoading(false); setError('Failed to load account details.'); console.error(...) })` on the outer chain.
This prevents the page from spinning indefinitely when `getUser()` or the contractor query fails due to a network error.
Status: `fixed: requires human verification` — the promise chain restructure is a logic change that should be manually verified to confirm the `setIsLoading(false)` path is reached correctly in all error scenarios.

---

_Fixed: 2026-05-30_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
