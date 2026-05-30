---
phase: 16-design-system-sweep
plan: "01"
subsystem: frontend/design-system
tags: [tailwind-v4, design-tokens, typography, fonts, globals-css]
dependency_graph:
  requires: []
  provides:
    - Wolknitive @theme {} block with all token utility classes
    - 18 Bogart trial .ttf files in src/fonts/bogart/
    - Tailwind v4 CSS-only token infrastructure (no tailwind.config.ts)
    - Multi-font layout.tsx declarations (Bogart + Inter Tight + JetBrains Mono)
  affects:
    - src/app/globals.css
    - src/app/layout.tsx
    - All downstream sweep plans (16-03 through 16-05)
tech_stack:
  added: []
  patterns:
    - Tailwind v4 @theme {} block for utility class generation from CSS vars
    - next/font/local for self-hosted trial font files
    - unicode-range split for trial-font digit watermark workaround
key_files:
  created:
    - src/fonts/bogart/ (18 .ttf files — Bogart trial, all weight/style combos)
  modified:
    - src/app/globals.css
    - src/app/layout.tsx
  deleted:
    - tailwind.config.ts
decisions:
  - "Google Fonts @import must follow @import 'tailwindcss' and precede @font-face in globals.css — CSS @import rules must precede non-@import rules; moved it to position 2 in the file"
  - "Wolknitive spacing tokens named --spacing-wk-1 through --spacing-wk-10 to avoid colliding with Tailwind's own numeric spacing scale"
  - "next/font/local path for Bogart is ../fonts/bogart/ (relative from src/app/) — one level up to src/, then fonts/bogart/"
metrics:
  duration: "~18 min"
  completed: "2026-05-30"
  tasks_completed: 2
  files_changed: 21
---

# Phase 16 Plan 01: Design System Token Infrastructure Summary

Wolknitive Design System token infrastructure established via CSS-only globals.css @theme {} block, 18 Bogart trial fonts extracted from ZIP handoff, and multi-font layout.tsx declarations — all sweep plans (16-03 through 16-05) can now apply named token classes.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Copy Bogart fonts + rebuild globals.css with Wolknitive tokens | d9fecf8 | src/fonts/bogart/ (18 files), src/app/globals.css |
| 2 | Update layout.tsx multi-font + delete tailwind.config.ts | 87b8413 | src/app/layout.tsx, tailwind.config.ts (deleted) |

## What Was Built

**globals.css** — Complete rewrite from the old 8-variable `:root {}` block to:
1. `@import 'tailwindcss'` (line 1, unchanged)
2. `@import url(Google Fonts)` — Inter Tight 400/500/600, JetBrains Mono 400/500
3. 18 Bogart trial `@font-face` declarations with `unicode-range: U+0000-002F, U+003A-10FFFF` (excludes digits to avoid watermark glyphs)
4. 2 Newsreader CDN `@font-face` fallback declarations for `unicode-range: U+0030-0039` (digits)
5. `:root {}` — full Wolknitive primitive token set (vellum, ink, teal, plum, amber, moss, brick scales) + all semantic surface/foreground/accent/rule tokens
6. `@theme {}` — maps all tokens to Tailwind v4 utility namespaces: `--color-bg`, `--color-fg-1` through `--color-fg-4`, `--color-danger`, `--color-rule`, `--font-display/body/ui/mono`, `--spacing-wk-1` through `--spacing-wk-10`, `--radius-xs` through `--radius-pill`, `--text-fs-xs` through `--text-fs-5xl`, `--leading-*`
7. `@media (prefers-color-scheme: dark)` — remaps 13 semantic tokens only (primitives unchanged)
8. `html, body` base with `var(--bg)` / `var(--fg-1)` (replaced old `var(--color-background)`)
9. `@media (prefers-reduced-motion)` (preserved verbatim)

**src/fonts/bogart/** — 18 Bogart trial .ttf files extracted from ZIP handoff.

**layout.tsx** — Adds `localFont` (Bogart, 18 src entries), `Inter_Tight` (wt 400/500/600), `JetBrains_Mono` (wt 400/500) alongside existing `Inter`. All four `--font-*` CSS variables applied to `<html>` className. `<body>` updated from `font-sans bg-background text-text-primary` to `font-ui bg-bg text-fg-1`.

**tailwind.config.ts** — Deleted. Tailwind v4 infers content from `./src/**/*.{ts,tsx}` automatically; `npm run build` exits 0 confirmed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Google Fonts @import position in globals.css**
- **Found during:** Task 2 (first build attempt)
- **Issue:** Plan instructed placing `@import url(Google Fonts)` after the @font-face blocks, but CSS spec requires @import rules to precede all non-@import rules (including @font-face). Tailwind's CSS optimizer emitted a warning.
- **Fix:** Moved the Google Fonts @import to position 2 in the file — after `@import 'tailwindcss'` and before the first @font-face declaration.
- **Files modified:** src/app/globals.css
- **Commit:** 87b8413 (included in Task 2 commit)

**2. [Rule 1 - Bug] Fixed next/font/local Bogart path depth**
- **Found during:** Task 2 (first build attempt — "Font file not found")
- **Issue:** Plan specified `../../fonts/bogart/` in layout.tsx. `src/app/layout.tsx` is one level inside `src/`, so `../fonts/bogart/` (one `../`) is correct; `../../fonts/bogart/` goes up to the worktree root which has no `fonts/` directory.
- **Fix:** Changed all 18 path entries from `../../fonts/bogart/` to `../fonts/bogart/`.
- **Files modified:** src/app/layout.tsx
- **Commit:** 87b8413

**3. [Rule 2 - Missing Critical] Spacing token names use wk-* prefix**
- **Found during:** Task 1 (design-time)
- **Issue:** Plan noted risk of `--spacing-*` collision with Tailwind's numeric spacing scale. Using `--spacing-1` through `--spacing-10` would shadow Tailwind's built-in `p-1`, `m-1` etc. utility classes.
- **Fix:** Named tokens `--spacing-wk-1` through `--spacing-wk-10` (Wolknitive-prefixed) to generate `p-wk-1`, `m-wk-1`, etc. without collision.
- **Files modified:** src/app/globals.css
- **Commit:** d9fecf8

## Threat Mitigations Applied

| Threat | Mitigation |
|--------|-----------|
| T-16-01-01: Bogart .ttf trial redistribution | Fonts committed to worktree branch; trial license note in file headers. Recommend adding `src/fonts/bogart/` to .gitignore if repo goes public. |
| T-16-01-02: CDN tampering (jsDelivr, Google Fonts) | Accepted per threat register — read-only font assets, no auth data crossing boundary |
| T-16-01-03: CDN unavailability | Accepted — system font fallbacks defined in each --font-* stack |

## Known Stubs

None. This plan is infrastructure-only (no UI rendering that could be stubbed).

## Self-Check: PASSED

- [x] `src/fonts/bogart/*.ttf` — 18 files exist (verified: `ls | wc -l` = 18)
- [x] `src/app/globals.css` — contains `@theme {`, `@media (prefers-color-scheme: dark)`, `@import 'tailwindcss'` at line 1, `animate-spin` preserved, `color-background` references removed (count = 0)
- [x] `tailwind.config.ts` — does not exist
- [x] `src/app/layout.tsx` — contains `next/font/local`, `font-bogart`, `font-inter-tight`, `font-jetbrains-mono`; body has `font-ui bg-bg`
- [x] `npm run build` — exits 0, 33/33 pages generated, TypeScript clean
- [x] Commits d9fecf8 and 87b8413 exist in git log
