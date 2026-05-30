# Phase 16: Design System Sweep - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 16-design-system-sweep
**Areas discussed:** Token source, Token naming, Typography & spacing scope, Sweep strategy, Font file hosting, Dark mode toggle mechanism, tailwind.config.ts fate, Regression tests scope

---

## Token Source

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — I have the ZIP/Figma | Provide token values extracted from the Wolknitive brand files | ✓ |
| No — formalize existing values | Treat existing hex values as official tokens | |
| Partial — some Wolknitive values to add/override | Start from existing, add/replace specific tokens | |

**User's choice:** ZIP/Figma available — it's included in the Wolknitive design system ZIP at `./Wolknitive Design System-handoff.zip`.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Paste token list into chat | Provide values during plan-phase session | |
| Drop a file into the repo | Commit a token reference file before execution | |
| It is included in the Wolknitive design system ZIP | ZIP already in repo root | ✓ |

**User's choice:** ZIP already in repo at `./Wolknitive Design System-handoff.zip`. Primary token file: `wolknitive-design-system/project/colors_and_type.css`.

---

| Option | Description | Selected |
|--------|-------------|----------|
| In the repo already | ZIP is in the project directory | ✓ |
| Outside the repo | Would be placed before execution | |
| I'll extract and paste the relevant CSS/JSON | Manual extraction | |

**User's choice:** In repo already. Agent discovered it at `./Wolknitive Design System-handoff.zip` via file search.

**Notes:** ZIP contains `colors_and_type.css` (all tokens), Bogart trial fonts, preview HTML files, and two UI kits (marketing + console). The console kit is the closest analog to VoiceDesk's dashboard layout.

---

## Token Naming

| Option | Description | Selected |
|--------|-------------|----------|
| Use Wolknitive names verbatim | Adopt --vellum-*, --teal-*, --plum-*, --bg, --fg-1, --accent etc. as defined in colors_and_type.css | ✓ |
| Keep VoiceDesk semantic names, map to Wolknitive values | Keep --color-background, --color-surface etc., update hex values | |

**User's choice:** Use Wolknitive names verbatim.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — go full light mode | VoiceDesk switches to Wolknitive's warm cream light theme | |
| Yes, but keep a dark mode option | Light by default, @media or class-toggle dark mode | ✓ |
| No — dark mode only, adapt Wolknitive for dark | Force Wolknitive token names with dark-appropriate values | |

**User's choice:** Full Wolknitive adoption with dark mode preserved via `@media (prefers-color-scheme: dark)`.

**Notes:** Dark mode remaps only semantic tokens. Primitive scales (--vellum-*, --teal-*, etc.) stay the same in both modes.

---

## Typography & Spacing Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full Wolknitive type stack | Define all font families + type scale, add @font-face for Bogart, apply to pages | ✓ |
| Fonts only, no type scale | @font-face + font-family tokens, leave font-size as Tailwind defaults | |
| Colors only this phase | Skip typography entirely | |

**User's choice:** Full Wolknitive type stack (Bogart trial, Inter Tight, JetBrains Mono, type scale tokens).

---

| Option | Description | Selected |
|--------|-------------|----------|
| Define tokens but don't sweep spacing/radius | Add --space-* and --radius-* as @theme tokens, don't replace p-*/rounded-* | ✓ |
| Full sweep including spacing and radius | Replace p-*, rounded-xl etc. with token-based classes | |
| Skip spacing/radius tokens entirely | Colors + fonts only | |

**User's choice:** Define spacing/radius tokens in @theme but don't sweep component files.

---

## Sweep Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Script-assisted + verification | Node/sed mapping script for known hex values, manual review for edge cases | ✓ |
| File-by-file manual sweep | Executor reads each file and replaces manually | |
| Automated codemods only | Pure find+replace, no manual review | |

**User's choice:** Script-assisted + verification.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Use Wolknitive dark-mode semantic tokens | @media prefers-color-scheme: dark remaps --bg to #0F172A etc. | ✓ |
| Keep orange accent (#F97316) in both modes | Override --accent to orange/amber instead of teal | |

**User's choice:** Use Wolknitive dark-mode semantic tokens. VoiceDesk's existing dark palette (#0F172A, #1E293B, #F97316) becomes the dark mode values.

---

## Font File Hosting

| Option | Description | Selected |
|--------|-------------|----------|
| next/font/local | Copy .ttf files to src/fonts/bogart/, declare via next/font/local in layout.tsx | ✓ |
| public/fonts/ + @font-face in globals.css | Drop in public/fonts/bogart/, copy @font-face from colors_and_type.css | |
| Keep fonts in Wolknitive ZIP directory | Reference from ZIP path (not viable for production) | |

**User's choice:** `next/font/local` in `layout.tsx`. Next.js handles preloading and caching automatically.

---

## Dark Mode Toggle Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| @media (prefers-color-scheme: dark) only | System-preference driven, no UI toggle | ✓ |
| CSS class .dark on `<html>` | Class-toggle pattern ready for next-themes | |

**User's choice:** `@media (prefers-color-scheme: dark)` only. Token structure should support adding `.dark` class toggle in a future phase.

---

## tailwind.config.ts Fate

| Option | Description | Selected |
|--------|-------------|----------|
| Delete it — @theme takes over | Remove entirely, all tokens in globals.css @theme block | ✓ |
| Keep it alongside @theme | Retain for content glob + plugins, strip theme.extend.colors | |

**User's choice:** Delete `tailwind.config.ts`. Full Tailwind v4 approach.

---

## Regression Tests Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Functional E2E only — no visual regression | 15 v1.0 tests are functional; no Percy/Playwright visual snapshots | |
| Add Playwright visual snapshots | Before/after screenshots of key pages for manual comparison | ✓ |

**User's choice:** Add Playwright visual snapshots (before/after, manual comparison, `tests/visual/` directory). Not automated CI diff in this phase.

---

## Claude's Discretion

- Inter Tight weight selection for imports (suggest 400, 500, 600)
- JetBrains Mono weight selection (suggest 400, 500)
- Whether to add `<link>` preload hints for Bogart or rely on next/font/local
- Order of @font-face declarations vs @theme block in globals.css
- Exact dark mode semantic token values for tokens not explicitly listed in D-06

## Deferred Ideas

- Manual dark mode toggle UI (future phase — token structure D-07 enables it)
- Licensed Bogart font (when licensing arranged — trial + digit fallback for now)
- Full spacing/radius sweep in components (too high blast radius for this phase)
- Type scale sweep (`text-sm` → `--fs-*` token classes)
- Automated visual regression CI (Percy/Playwright snapshot diff in CI)
