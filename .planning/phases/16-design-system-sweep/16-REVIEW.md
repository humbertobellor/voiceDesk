---
phase: 16-design-system-sweep
reviewed: 2026-05-30T00:00:00Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - src/app/globals.css
  - src/app/layout.tsx
  - scripts/capture-before-snapshots.ts
  - scripts/sweep-hex-tokens.js
  - src/components/auth/LoginForm.tsx
  - src/components/auth/PhoneCaptureForm.tsx
  - src/components/auth/SignupForm.tsx
  - src/components/notification/NotificationSettingsForm.tsx
  - src/components/notification/NotificationBell.tsx
  - src/components/dashboard/BottomTabBar.tsx
  - src/components/dashboard/EmptyState.tsx
  - src/components/dashboard/Sidebar.tsx
  - src/app/(auth)/auth/login/page.tsx
  - src/app/(auth)/auth/signup/page.tsx
  - src/app/(auth)/setup/phone/page.tsx
  - src/app/(auth)/pricing/page.tsx
  - src/app/(dashboard)/layout.tsx
  - src/app/(dashboard)/dashboard/page.tsx
  - src/app/(dashboard)/connect-calendar/page.tsx
  - src/app/(dashboard)/connect-calendar/_components/ConnectCalendarForm.tsx
  - src/app/(dashboard)/calls/page.tsx
  - src/app/(dashboard)/leads/page.tsx
  - src/app/(dashboard)/settings/agent/page.tsx
  - src/app/(dashboard)/settings/agent/_components/LanguageSettingsForm.tsx
  - src/app/(dashboard)/settings/calendar/page.tsx
  - src/app/(dashboard)/settings/go-live/page.tsx
  - src/app/(dashboard)/settings/notifications/page.tsx
  - src/app/(dashboard)/settings/phone/page.tsx
  - src/app/(dashboard)/settings/account/page.tsx
  - scripts/capture-after-snapshots.ts
findings:
  critical: 4
  warning: 9
  info: 4
  total: 17
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-05-30
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Summary

Phase 16 swept hardcoded Tailwind hex arbitrary values from 25+ component and page files and replaced them with Wolknitive design-system token utility classes. The core token definition in `globals.css` is well-structured. The sweep successfully eliminated `[#…]` patterns from all reviewed components.

However the review surfaces four blockers: a self-referential circular CSS custom property in the `@theme` font block that will silently produce invalid `font-` utilities at build time; a systematic token-value mismatch where the sweep script mapped Tailwind-default hex values to Wolknitive primitives that are substantially different colors (breaking visual intent); duplicate font loading that defeats the purpose of `next/font`; and multiple residual non-tokenised color classes (`text-gray-*`, `bg-green-*`, `text-yellow-*`, `bg-red-*`, `text-white`) that escaped the sweep in four files. Nine warnings cover logical errors, bad contrasts in dark mode, and dead code.

---

## Critical Issues

### CR-01: Circular CSS custom property in `@theme` font block

**File:** `src/app/globals.css:274-277`
**Issue:** The `@theme` block declares `--font-display: var(--font-display)`, `--font-body: var(--font-body)`, `--font-ui: var(--font-ui)`, and `--font-mono: var(--font-mono)`. Tailwind v4 emits `@theme` declarations as `:root` custom properties. Because the property name on the left-hand side is identical to the one being referenced by `var()`, the final compiled CSS is:

```css
/* from :root (line 168-171) */
:root { --font-display: 'Bogart', ...; }
/* then @theme overwrites with a self-ref: */
:root { --font-display: var(--font-display); }
```

A CSS custom property that references itself via `var()` is invalid and resolves to the guaranteed-invalid value, making all `font-display`, `font-body`, `font-ui`, and `font-mono` utility classes produce no font-family output. The colour tokens avoid this because they use *different* names: `--color-bg: var(--bg)` — two distinct property names. The font block must do the same.

**Fix:** Rename the `@theme` font keys to avoid collision with the `:root` definitions, or inline the values directly.
```css
/* Option A — distinct names (preferred, mirrors color pattern) */
@theme {
  --font-family-display: var(--font-display);
  --font-family-body:    var(--font-body);
  --font-family-ui:      var(--font-ui);
  --font-family-mono:    var(--font-mono);
}

/* Option B — inline values (avoids any var() chain) */
@theme {
  --font-display: 'Bogart', 'Iowan Old Style', Georgia, serif;
  --font-body:    'Bogart', Georgia, 'Times New Roman', serif;
  --font-ui:      'Inter Tight', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono:    'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
}
```
Note: if Option A is chosen, all component usages of `font-display`, `font-body`, `font-ui`, `font-mono` classes must be updated to match the new names.

---

### CR-02: Sweep script maps Tailwind-default hex values to substantially different Wolknitive primitives

**File:** `scripts/sweep-hex-tokens.js:31-81`
**Issue:** The sweep script performed a literal hex-to-token substitution, but the source hex values were Tailwind v3 defaults while the destination tokens are Wolknitive palette primitives — significantly different colours:

| Replaced hex | Token applied | Token actual value | Delta |
|---|---|---|---|
| `#F97316` (bright Tailwind orange) | `bg-highlight` | `--amber-500` = `#C7763B` (muted burnt sienna) | Hue shift, 40% darker |
| `#EF4444` (bright Tailwind red) | `bg-danger` | `--brick-500` = `#A8442B` (muted brick) | Hue shift, ~30% darker |
| `#22C55E` (bright Tailwind green) | `bg-success` | `--moss-500` = `#4E6B3A` (dark muted green) | Hue shift, 50% darker |
| `#F97316` (orange) | `focus-visible:ring-accent` | `--teal-500` = `#1B4E4A` (teal) | Completely different hue |

The last row is the worst: line 46 maps an orange focus ring (`focus-visible:ring-[#F97316]`) to `focus-visible:ring-accent` (teal). A user who relied on an orange focus ring now gets a teal one — this alters keyboard-navigation affordance in a way that was not the intent.

The design-system intent is sound (use tokens, not raw hex), but the script silently mapped visually unrelated colours. Every replacement must be verified against the actual design spec, not just the closest-sounding token name.

**Fix:** Audit each replacement in `REPLACEMENTS` against the UI spec before re-running the sweep. At minimum the focus-ring mapping should be corrected:
```js
// Line 46 — was mapping orange ring to teal (wrong)
['focus-visible:ring-[#F97316]', 'focus-visible:ring-highlight'],
```
The button background/text pairs (`bg-highlight text-bg`) should also be reviewed under WCAG 2.1 AA contrast for both light and dark modes (see WR-04).

---

### CR-03: `next/font` variables are declared but never consumed by the design system

**File:** `src/app/layout.tsx:10-65` and `src/app/globals.css:5`
**Issue:** `layout.tsx` loads Inter Tight, JetBrains Mono, and Bogart via `next/font/google` / `next/font/local`, exposing them as CSS custom properties `--font-inter-tight`, `--font-jetbrains-mono`, and `--font-bogart` on the `<html>` element. None of these variables are referenced anywhere in `globals.css` or `@theme`. The design system instead hard-codes the font family strings in `:root` (line 168-171). Separately, `globals.css` line 5 also imports Inter Tight and JetBrains Mono directly from Google Fonts CDN.

Result: Inter Tight and JetBrains Mono are loaded **twice** — once from the Google Fonts CDN (globals.css) and once from next/font (layout.tsx). The next/font self-hosted copy (with its preload, font-display, and no layout-shift benefits) is never actually applied because `--font-ui` in `:root` is the literal string `'Inter Tight'`, which resolves to the CDN version. The next/font variables are orphaned.

Additionally `Inter` (line 10) is loaded but its variable `--font-inter` is not referenced anywhere other than the html class string, making it a live download with zero use.

**Fix:**
1. Remove the Google Fonts CDN `@import` from `globals.css` (line 5).
2. Update `:root` in `globals.css` to reference the next/font CSS variables:
```css
--font-ui:   var(--font-inter-tight), system-ui, -apple-system, sans-serif;
--font-mono: var(--font-jetbrains-mono), ui-monospace, 'SF Mono', Menlo, monospace;
```
3. Remove the unused `inter` (bare Inter) font loader from `layout.tsx`.

---

### CR-04: Multiple Tailwind color classes outside the design system survived the sweep

**File:** `src/app/(dashboard)/settings/account/page.tsx:79-96, 112-117, 172`
**File:** `src/app/(dashboard)/calls/page.tsx:29-30`
**File:** `src/app/(dashboard)/leads/page.tsx:29-30`
**File:** `src/app/(dashboard)/settings/phone/page.tsx:203-204`
**File:** `src/components/notification/NotificationSettingsForm.tsx:341, 394`

**Issue:** The sweep script only targeted the exact `[#hex]` arbitrary-value syntax. Several files still contain named Tailwind colour classes that bypass the token system entirely. The phase success criterion states "zero `[#` hex values" but these classes produce the same problem — they will not respond to design-system token changes and create inconsistency between light/dark modes.

Concrete occurrences:

- `account/page.tsx:79`: `bg-red-900/30 border border-red-700 text-red-300` (suspended service banner) — design token is `bg-danger/10 border-danger/30 text-danger`
- `account/page.tsx:95`: `bg-red-900/20 border border-red-800 text-red-400` (load error banner)
- `account/page.tsx:112-117`: `text-green-400`, `text-yellow-400`, `text-indigo-400` for subscription status labels — no design token equivalent
- `account/page.tsx:154, 172`: `text-white` on buttons, `text-red-400` for inline error
- `calls/page.tsx:29-30` and `leads/page.tsx:29-30`: `bg-green-500` and `text-gray-400` for the realtime live indicator
- `phone/page.tsx:203-204`: `bg-yellow-500/10 border-yellow-500/30 text-yellow-300` for the advisory box
- `NotificationSettingsForm.tsx:341, 394`: `text-gray-300` for field labels inside SMS and WhatsApp sections — these labels escaped the sweep because they were not using `[#hex]` syntax

**Fix (representative):**
```tsx
// calls/page.tsx and leads/page.tsx:29-30 — replace Tailwind defaults
<span className="w-2 h-2 rounded-full bg-success flex-shrink-0" />
<span className="text-xs text-fg-3">Live</span>

// NotificationSettingsForm.tsx:341, 394
<label className="block text-sm font-semibold text-fg-3 mb-2">

// account/page.tsx — suspended service banner
<div className="bg-danger/10 border border-danger/30 rounded-lg p-4 mb-6">
  <p className="text-sm font-medium text-danger mb-2">...</p>
  <button className="... bg-danger hover:bg-danger/90 text-fg-on-dark ...">

// phone/page.tsx advisory box
<div className="mt-4 bg-highlight-soft border border-highlight/30 rounded-lg p-4">
  <p className="text-xs text-fg-2">...</p>
```

---

## Warnings

### WR-01: `text-bg` on colored button backgrounds fails dark-mode contrast

**File:** `src/components/auth/LoginForm.tsx:79`, `SignupForm.tsx:186`, `PhoneCaptureForm.tsx:182`, `NotificationSettingsForm.tsx:616`, `pricing/page.tsx:157, 187`, `LanguageSettingsForm.tsx:93`, `ConnectCalendarForm.tsx:39`
**Issue:** All primary CTA buttons use `bg-highlight text-bg`. In dark mode `--bg` resolves to `#0F172A` (very dark navy), while `--highlight` resolves to `#C7763B` (burnt sienna). Dark navy text on burnt sienna background does not meet WCAG AA 4.5:1 contrast. In light mode `--bg` is `#FAF6EC` (cream) on `#C7763B` which may be marginal as well. The original code used `text-[#0F172A]` (ink) on a bright orange (`#F97316`) — a visually deliberate dark-on-bright pattern. After the sweep the token values diverge from the original intent.
**Fix:** Use `text-fg-on-dark` (which is `--vellum-50`, the lightest foreground token) instead of `text-bg` for text on all coloured button backgrounds. This is both semantically correct and provides better contrast in both modes:
```tsx
className="w-full bg-highlight text-fg-on-dark hover:bg-highlight/90 min-h-[44px] font-semibold"
```

---

### WR-02: `text-white` used on multiple buttons — not a design system token

**File:** `src/components/notification/NotificationBell.tsx:109`, `settings/phone/page.tsx:152`, `settings/account/page.tsx:86, 154`, `settings/go-live/page.tsx:122`
**Issue:** The Wolknitive design system does not define pure white (`#FFFFFF`) as a foreground token. The sweep correctly replaced `text-[#F8FAFC]` with `text-fg-on-dark` (the cream-white foreground), but five locations still use `text-white` directly. This is both an off-token violation and inconsistent with the rest of the codebase that uses `text-fg-on-dark` or `text-bg` for light text.
**Fix:** Replace `text-white` with `text-fg-on-dark` throughout.

---

### WR-03: Hardcoded RGBA arbitrary value in NotificationBell notification row hover

**File:** `src/components/notification/NotificationBell.tsx:150`
**Issue:** The notification row uses `hover:bg-[rgba(255,255,255,0.05)]`. This is a raw RGBA arbitrary value that bypasses the token system. In light mode this adds a nearly invisible white tint over a cream background (essentially invisible). The design system provides `hover:bg-rule-soft` or `hover:bg-bg-sunken` for subtle hover states on surfaces.
**Fix:**
```tsx
className="flex items-stretch border-b border-rule hover:bg-bg-sunken"
```

---

### WR-04: `sweep-hex-tokens.js` unconditionally writes files even with zero replacements

**File:** `scripts/sweep-hex-tokens.js:110`
**Issue:** `fs.writeFileSync(abs, content, 'utf8')` is called regardless of whether `totalReplacements > 0`. This unnecessarily updates the file's mtime on every invocation, which can invalidate Next.js and bundler caches, triggering spurious rebuilds when the script is re-run as a no-op on already-swept files.
**Fix:**
```js
if (totalReplacements > 0) {
  fs.writeFileSync(abs, content, 'utf8')
}
console.log(`${totalReplacements > 0 ? 'OK  ' : 'SKIP'} ${filePath} — ${totalReplacements} total replacement(s)`)
```

---

### WR-05: Snapshot scripts do not create the output directory before writing PNGs

**File:** `scripts/capture-before-snapshots.ts:40, 90-124`, `scripts/capture-after-snapshots.ts:40, 90-124`
**Issue:** Both scripts resolve `OUTPUT_DIR` to `tests/visual/` and call `page.screenshot({ path: path.join(OUTPUT_DIR, '...') })` without first verifying the directory exists. Playwright's `screenshot()` throws `Error: Failed to write the screenshot` if the parent directory is absent. The directory is described as tracked via a `.gitkeep`, but if a fresh clone omits it or it is cleaned, the script will crash after the browser is already open — leaving the browser process alive until the `finally` block runs `browser.close()`.
**Fix:** Add directory creation before the first screenshot:
```ts
import { mkdirSync } from 'fs'
// At the start of main():
mkdirSync(OUTPUT_DIR, { recursive: true })
```

---

### WR-06: `realtimeStatus` state is declared and never read in `calls/page.tsx`

**File:** `src/app/(dashboard)/calls/page.tsx:12`
**Issue:** `const [realtimeStatus, setRealtimeStatus] = useState<…>('connecting')` — `realtimeStatus` is never read and `setRealtimeStatus` is never called. This is dead state. TypeScript will not flag it because both names are used in the destructuring. It contributes confusion about the component's design intent and wastes a re-render slot if ever accidentally triggered.
**Fix:** Remove the unused state declaration:
```tsx
// Remove this line entirely:
const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
```

---

### WR-07: `console.log` debug statements in production page components

**File:** `src/app/(dashboard)/calls/page.tsx:17`, `src/app/(dashboard)/leads/page.tsx:17`
**Issue:** Both realtime subscription callbacks log every incoming call/lead ID to the browser console: `console.log('New call:', callId)` and `console.log('New lead:', leadId)`. These are production pages — the callback comment even notes "could show a notification", indicating the log was placeholder-only. In production this leaks call IDs in the browser console of any logged-in contractor.
**Fix:** Remove the console.log statements. If observability is needed, use a structured logger behind an env-flag guard.

---

### WR-08: `pricing/page.tsx` uses `hover:bg-rule-strong` for non-popular tier button

**File:** `src/app/(auth)/pricing/page.tsx:188`
**Issue:** Non-popular pricing tier buttons use `bg-rule text-fg-on-dark hover:bg-rule-strong`. `--rule-strong` = `--vellum-700` = `#2E261A` (very dark brown), making the hover state a nearly-black button. This is semantically incorrect — `rule-strong` is a border/rule token, not a surface token. The hover state should use a lighter surface token such as `hover:bg-bg-sunken` or `hover:bg-vellum-200`.
**Fix:**
```tsx
: 'bg-rule text-fg-on-dark hover:bg-bg-sunken'
```

---

### WR-09: Unreachable auth redirect logic in `pricing/page.tsx` `useEffect`

**File:** `src/app/(auth)/pricing/page.tsx:59-64`
**Issue:** The `useEffect` calls `supabase.auth.getUser()` then in the `.then()` callback chains a second `.then()` on the contractor query. The inner `.then()` at line 71 sets `setIsLoading(false)` — but there is no corresponding `setIsLoading(false)` in the error path of the outer `getUser()` call. If `getUser()` itself fails (network error), the outer `.then()` is never entered, the inner `.then()` never runs, and `setIsLoading` is never called `false`. The page will spin indefinitely (stuck in the loading spinner state) with no error feedback.
**Fix:** Add a `.catch()` on the outer promise chain:
```tsx
supabase.auth.getUser()
  .then(({ data: { user } }) => {
    if (!user) { window.location.href = '/auth/signup'; return }
    return supabase.from('contractors') /* ... */
      .then(({ data, error }) => { setIsLoading(false); /* ... */ })
  })
  .catch(() => { setIsLoading(false); setError('Failed to load account details.') })
```

---

## Info

### IN-01: `inter` (bare Inter font) is loaded via `next/font` but never referenced in the design system

**File:** `src/app/layout.tsx:10`
**Issue:** The `inter` font is loaded and its variable `--font-inter` is added to the `<html>` element. The docstring says it's a "backward-compat alias for any existing `font-sans` references." There are no `font-sans` usages in any of the reviewed files. The variable is consumed only within the template literal on line 76 but sets no style anywhere meaningful.
**Fix:** Remove the `Inter` import and its variable from the `className` on `<html>`. If backward-compat is truly needed, add a comment pointing to where `font-sans` exists.

---

### IN-02: `borderColorForEventType` uses `var(--danger)` / `var(--highlight)` inline style strings

**File:** `src/components/notification/NotificationBell.tsx:46-58`
**Issue:** The function returns CSS custom property references as `style={{ backgroundColor: borderColorForEventType(…) }}` strings. This works, but it bypasses Tailwind's utility class system, is not detected by the hex sweep, and will not honour any future token remapping via utility classes. The phase established that design tokens should be used via utility classes wherever possible.
**Fix:** Either map event types to Tailwind utility class names and use `className` conditionally, or accept the current approach as intentional (inline style for dynamic values) and document it.

---

### IN-03: TODO comment in `globals.css` references a licensed font that may never arrive

**File:** `src/app/globals.css:52`
**Issue:** `/* TODO: remove when licensed Bogart (Indian Type Foundry) is installed. */` — the digit-fallback `@font-face` block maps U+0030-0039 to Newsreader from jsDelivr CDN as a workaround for the trial font's watermark glyphs. This creates a production dependency on jsDelivr CDN for digit rendering. If the licensed font is never purchased, this CDN dependency is permanent and is not documented in CLAUDE.md or the project's dependency inventory.
**Fix:** Track this explicitly as a known dependency (add to `CLAUDE.md` "Week-1 Action Items" or a follow-up issue). Consider self-hosting the Newsreader woff2 file in `public/fonts/` to eliminate the runtime CDN dependency.

---

### IN-04: `capture-before-snapshots.ts` and `capture-after-snapshots.ts` are near-identical duplicates

**File:** `scripts/capture-before-snapshots.ts`, `scripts/capture-after-snapshots.ts`
**Issue:** Both scripts share 90%+ of their logic — same `navigateTo` helper, same browser context loop, same 5 pages. The only differences are the output filenames (`-before.png` vs `-after.png`) and a minor logging style change. A single parameterised script (`capture-snapshots.ts --suffix before|after`) would eliminate the duplication and prevent the two from drifting apart if pages are added or removed.
**Fix:** Refactor into one script:
```ts
const SUFFIX = process.env.SNAPSHOT_SUFFIX ?? 'before' // 'before' | 'after'
// ... use SUFFIX in all path.join() calls
```

---

_Reviewed: 2026-05-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
