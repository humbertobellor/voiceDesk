# Phase 16: Design System Sweep - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Apply the Wolknitive design system across the entire VoiceDesk application: extract authentic tokens from the Wolknitive ZIP (`./Wolknitive Design System-handoff.zip`), define them in `globals.css` using Tailwind v4 `@theme {}` + `:root {}`, install Bogart trial fonts via `next/font/local`, and replace all 277 hardcoded `[#XXXXXX]` hex arbitrary Tailwind values across 20 component files with named token utility classes.

Result: light-mode (Wolknitive cream/teal) as default, dark mode via `@media (prefers-color-scheme: dark)` remapping semantic tokens, `npm run build` clean, 15 v1.0 regression tests pass, and Playwright visual snapshots capture before/after for key pages.

</domain>

<decisions>
## Implementation Decisions

### Token Source
- **D-01:** Extract all tokens from `./Wolknitive Design System-handoff.zip` — specifically `wolknitive-design-system/project/colors_and_type.css`. This is the authoritative token source; do not derive values from the existing `tailwind.config.ts` hardcoded colors.
- **D-02:** The ZIP is already in the repo root. Do NOT unzip into the repo — read tokens from the ZIP at plan/execute time and copy only the `fonts/` directory and token values into the project.

### Token Naming
- **D-03:** Use Wolknitive token names **verbatim** from `colors_and_type.css`: primitive scales (`--vellum-50` through `--ink`, `--teal-50` through `--teal-800`, `--plum-50` through `--plum-800`, `--amber-*`, `--moss-*`, `--brick-*`) and semantic aliases (`--bg`, `--bg-elevated`, `--bg-sunken`, `--fg-1` through `--fg-4`, `--fg-on-dark`, `--accent`, `--accent-hover`, `--accent-soft`, `--accent-2`, `--accent-2-soft`, `--highlight`, `--highlight-soft`, `--success`, `--danger`, `--rule`, `--rule-strong`, `--rule-soft`).
- **D-04:** Define ALL tokens in a Tailwind v4 `@theme {}` block in `globals.css`. This generates utility classes (`bg-bg`, `text-fg-1`, `bg-teal-500`, `border-rule`, etc.) without a `tailwind.config.ts`.

### Light Mode & Dark Mode
- **D-05:** **Light mode is the default.** `:root {}` uses Wolknitive values verbatim (warm cream `--bg: var(--vellum-50)`, ink text, teal accent `--accent: var(--teal-500)`).
- **D-06:** **Dark mode via `@media (prefers-color-scheme: dark)`** — remaps only the semantic tokens (primitives stay the same). Dark mappings:
  - `--bg` → `#0F172A`
  - `--bg-elevated` → `#1E293B`
  - `--bg-sunken` → `#0B1120`
  - `--fg-1` → `#F8FAFC`
  - `--fg-2` → `#CBD5E1`
  - `--fg-3` → `#94A3B8`
  - `--fg-4` → `#64748B`
  - `--rule` → `#334155`
  - `--rule-strong` → `#475569`
  - `--rule-soft` → `#1E293B`
  - `--accent` → `var(--teal-400)` (slightly lighter for dark bg contrast)
  - `--success` → `var(--moss-500)`
  - `--danger` → `var(--brick-500)`
- **D-07:** No UI toggle in this phase. Dark mode is OS-preference only. Token structure must support adding a `.dark` class toggle in a future phase without rework.

### Font Hosting & Typography
- **D-08:** Copy Bogart `.ttf` trial files from the ZIP into `src/fonts/bogart/` (all 18 weight/style combinations). Declare them via `next/font/local` in `src/app/layout.tsx`.
- **D-09:** Use the **trial-font digit fallback workaround** from `colors_and_type.css`: map `unicode-range: U+0030-0039` to Newsreader via `@fontsource/newsreader` CDN woff2. Add a TODO comment to swap for licensed Bogart.
- **D-10:** Font stack tokens to define:
  - `--font-display: 'Bogart', 'Iowan Old Style', Georgia, serif` — page headings
  - `--font-body: 'Bogart', Georgia, 'Times New Roman', serif` — body/prose text
  - `--font-ui: 'Inter Tight', system-ui, -apple-system, 'Segoe UI', sans-serif` — UI labels, buttons, form fields, nav
  - `--font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace` — code, phone numbers
- **D-11:** Apply `--font-ui` (Inter Tight) to all dashboard/app UI elements (nav, buttons, form labels, table cells). Apply `--font-display`/`--font-body` (Bogart) to marketing/auth page headings and prose. Phone numbers and numeric data use `--font-mono` to sidestep the digit watermark.
- **D-12:** Type scale tokens (`--fs-xs` through `--fs-5xl`, `--lh-tight` through `--lh-loose`) are defined in `@theme {}` but **not actively swept** in component files this phase. Components retain their existing Tailwind `text-sm`, `text-lg` etc. classes.

### Spacing & Radii
- **D-13:** Define spacing (`--space-1` through `--space-10`) and radius (`--radius-xs` through `--radius-pill`) tokens in `@theme {}` so they are available as utility classes. **Do NOT sweep existing `p-*`, `rounded-*` classes in components** — too high risk, out of BRAND-02 scope.

### tailwind.config.ts
- **D-14:** **Delete `tailwind.config.ts` entirely.** All color, font, and spacing tokens move to the `@theme {}` block in `globals.css`. The Tailwind v4 content glob (`./src/**/*.{ts,tsx}`) is configured via `@source` directive in `globals.css` or inferred automatically. Verify `npm run build` exits 0 after deletion.

### Sweep Strategy
- **D-15:** Use a **script-assisted sweep**: write a Node.js/sed mapping script that converts known hex values to Wolknitive token utility classes. Known hex→token mappings (light mode values from existing code → Wolknitive dark-mode semantic classes):
  - `#0F172A` → `bg-bg` (dark mode) or context-dependent
  - `#1E293B` → `bg-bg-elevated`
  - `#334155` → `border-rule`
  - `#94A3B8` → `text-fg-3`
  - `#F8FAFC` → `text-fg-on-dark`
  - `#F97316` → `text-highlight` (amber-500 maps to Wolknitive `--highlight`)
  - `#EF4444` → `text-danger` / `border-danger`
  - `#22C55E` → `text-success`
  - Opacity modifiers (e.g., `#EF4444/10`, `#EF4444/30`) → preserve as `text-danger/10`, `text-danger/30`
- **D-16:** Manual review pass after script: check gradients, dynamic class strings (`cn()` / template literals), and hover states for correctness. The executor reviews each file after script runs.

### Regression Tests
- **D-17:** The 15 v1.0 regression tests in `tests/regression-v1-smoke.spec.ts` are functional E2E (auth, calls, leads, settings). The sweep must not break selectors or flow logic. Run `npm test` as the final gate.
- **D-18:** **Add Playwright visual snapshots** — capture before/after screenshots of: login page, dashboard (calls), leads page, agent settings, notification settings. Snapshots go in `tests/visual/`. These are NOT part of the 15 regression tests; they're new. Named `{page}-before.png` and `{page}-after.png`, compared manually (not automated CI snapshot diff in this phase).

### Claude's Discretion
- Exact Inter Tight weights to import (suggest 400, 500, 600 — what the Wolknitive console kit uses)
- JetBrains Mono weight selection (suggest 400, 500)
- Whether to add `<link>` preload hints for Bogart in `<head>` or rely on `next/font/local` automatic preloading
- Order of `@font-face` declarations vs `@theme {}` block in `globals.css`
- Exact dark mode semantic token values for any token not listed in D-06 (use judgment based on VoiceDesk's existing palette)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Wolknitive Design System (primary source)
- `./Wolknitive Design System-handoff.zip` — ZIP in repo root; extract `wolknitive-design-system/project/colors_and_type.css` for all token values and `fonts/` for Bogart trial files
- `wolknitive-design-system/project/colors_and_type.css` (inside ZIP) — canonical token definitions: primitives, semantics, radii, shadows, spacing, type families, type scale
- `wolknitive-design-system/project/ui_kits/console/console.css` (inside ZIP) — reference for how Wolknitive tokens are used in a sidebar-based dashboard app (closest analog to VoiceDesk)
- `wolknitive-design-system/project/SKILL.md` (inside ZIP) — brand rules: no emoji, no gradients in UI chrome, no colored left-border cards, Lucide icons only

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §BRAND-01 through BRAND-04 — success criteria for this phase
- `.planning/ROADMAP.md` §Phase 16 — authoritative success criteria (5 concrete pass/fail conditions)

### Existing Code to Modify
- `src/app/globals.css` — current `:root {}` block; replace entirely with `@theme {}` + `:root {}` Wolknitive tokens
- `tailwind.config.ts` — **delete this file** (D-14); all tokens move to `@theme {}`
- `src/app/layout.tsx` — add `next/font/local` Bogart declarations; apply font CSS variables to `<html>`

### Component Files with Hardcoded Hex (sweep targets — 20 files, 277 occurrences)
- `src/components/auth/LoginForm.tsx`
- `src/components/auth/PhoneCaptureForm.tsx`
- `src/components/auth/SignupForm.tsx`
- `src/components/notification/NotificationSettingsForm.tsx`
- `src/components/notification/NotificationBell.tsx`
- `src/components/dashboard/BottomTabBar.tsx`
- `src/components/dashboard/EmptyState.tsx`
- `src/components/dashboard/Sidebar.tsx`
- `src/app/(auth)/auth/signup/page.tsx`
- `src/app/(auth)/auth/login/page.tsx`
- `src/app/(auth)/setup/phone/page.tsx`
- `src/app/(dashboard)/layout.tsx`
- `src/app/(auth)/pricing/page.tsx`
- `src/app/(dashboard)/calls/page.tsx`
- `src/app/(dashboard)/settings/calendar/page.tsx`
- `src/app/(dashboard)/settings/go-live/page.tsx`
- `src/app/(dashboard)/settings/agent/page.tsx`
- `src/app/(dashboard)/settings/agent/_components/LanguageSettingsForm.tsx`
- `src/app/(dashboard)/settings/notifications/page.tsx`
- `src/app/(dashboard)/leads/page.tsx`

### Prior Phase Decisions
- `.planning/STATE.md` §Key Decisions Locked (v1.1) — Tailwind v4 `@theme {}` + `:root {}` both required; Wolknitive CSS-only from ZIP handoff

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/globals.css` — currently has `:root {}` with 8 semantic tokens; replace entirely (keep `@import 'tailwindcss'` at top and reduced-motion media query)
- `tailwind.config.ts` — has 8 color names (`background`, `surface`, `accent`, `text-primary`, `text-secondary`, `border-default`, `destructive`, `success`) and `fontFamily.sans`; all replaced by `@theme {}`
- `src/app/layout.tsx` — already imports Inter via `next/font/google`; extend with `next/font/local` for Bogart

### Established Patterns
- Hex values in components all use the same 8 palette values — a deterministic mapping script is viable (D-15)
- Opacity modifiers like `/10` and `/30` on hex values (e.g. `bg-[#EF4444]/10`) must preserve the modifier when replacing the base color
- `cn()` utility is used across components for conditional class strings — check dynamic class assembly for hex occurrences that a simple regex would miss

### Integration Points
- After deleting `tailwind.config.ts`, verify `npm run build` exits 0 — Tailwind v4 should infer content from `./src/**/*.{ts,tsx}` automatically but may need `@source` in `globals.css`
- `next/font/local` variables set on `<html>` via `className` in `layout.tsx` — pattern already used for Inter (`var(--font-inter)`)
- Playwright visual snapshots go in `tests/visual/` (new directory)

</code_context>

<specifics>
## Specific Ideas

- Bogart is "editorial-classical" — use it for auth page headings (login "Welcome back", signup "Create your account") and marketing page (pricing) headings. Dashboard UI (nav, tables, buttons, form labels) stays Inter Tight per D-11.
- Phone numbers and numeric data (call durations, counts) should use `font-mono` class (`--font-mono` = JetBrains Mono) to sidestep the Bogart digit watermark issue.
- The Wolknitive console UI kit uses `--vellum-100` for the sidebar background — the closest analog to VoiceDesk's current dark sidebar. In dark mode, remap this to `#1E293B`.
- No emoji anywhere per Wolknitive brand rules (SKILL.md). Executor should flag any emoji found during the sweep.
- No gradients in UI chrome per Wolknitive brand rules. Flag any gradient classes found during sweep.

</specifics>

<deferred>
## Deferred Ideas

- **Manual dark mode toggle UI** — a settings toggle for light/dark preference. Deferred to a future phase. Token structure from D-07 (use `.dark` class in future) enables this without rework.
- **Licensed Bogart font** — replace trial .ttf files with licensed .woff2 from Indian Type Foundry. Deferred until licensing is arranged. Trial files + digit fallback used for now per D-09.
- **Full spacing/radius sweep** — replace `p-*`, `rounded-*` Tailwind classes with `--space-*`/`--radius-*` token classes. Deferred — too much blast radius for this phase per D-13.
- **Type scale sweep** — replace `text-sm`, `text-lg` etc. with `--fs-*` token classes. Deferred per D-12.
- **Automated visual regression CI** — Percy or Playwright snapshot CI integration. This phase adds before/after snapshots for manual comparison only (D-18). Automated CI diff is a future investment.

</deferred>

---

*Phase: 16-design-system-sweep*
*Context gathered: 2026-05-30*
