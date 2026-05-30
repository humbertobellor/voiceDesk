# Phase 16: Design System Sweep - Pattern Map

**Mapped:** 2026-05-30
**Files analyzed:** 23 new/modified files
**Analogs found:** 22 / 23 (existing codebase + Wolknitive ZIP)

---

## File Classification

| New/Modified File | Role | Data Flow | Pattern Type | Current State |
|---|---|---|---|---|
| `src/app/globals.css` | config | CSS tokens | CSS/design | 8 semantic tokens in `:root {}` |
| `tailwind.config.ts` | config | theme config | Tailwind | 8 color aliases + fontFamily |
| `src/app/layout.tsx` | root layout | font declarations | Next.js layout | Inter via `next/font/google` only |
| `src/components/auth/LoginForm.tsx` | component | UI/form | React client | 277 hardcoded hex values (sample: `#0F172A`, `#1E293B`, `#F97316`, etc.) |
| `src/components/auth/PhoneCaptureForm.tsx` | component | UI/form | React client | Same hex palette as LoginForm |
| `src/components/auth/SignupForm.tsx` | component | UI/form | React client | Same hex palette |
| `src/components/notification/NotificationSettingsForm.tsx` | component | UI/form | React client | Same hex palette |
| `src/components/notification/NotificationBell.tsx` | component | UI/interactive | React client | Same hex palette |
| `src/components/dashboard/BottomTabBar.tsx` | component | navigation | React client | Same hex palette |
| `src/components/dashboard/EmptyState.tsx` | component | UI | React client | Same hex palette |
| `src/components/dashboard/Sidebar.tsx` | component | navigation | React client | Same hex palette |
| `src/app/(auth)/auth/signup/page.tsx` | page | layout | Next.js page | Same hex palette |
| `src/app/(auth)/auth/login/page.tsx` | page | layout | Next.js page | Same hex palette |
| `src/app/(auth)/setup/phone/page.tsx` | page | layout | Next.js page | Same hex palette |
| `src/app/(dashboard)/layout.tsx` | layout | layout | Next.js layout | Same hex palette |
| `src/app/(auth)/pricing/page.tsx` | page | layout | Next.js page | Same hex palette |
| `src/app/(dashboard)/calls/page.tsx` | page | layout | Next.js page | Same hex palette |
| `src/app/(dashboard)/settings/calendar/page.tsx` | page | layout | Next.js page | Same hex palette |
| `src/app/(dashboard)/settings/go-live/page.tsx` | page | layout | Next.js page | Same hex palette |
| `src/app/(dashboard)/settings/agent/page.tsx` | page | layout | Next.js page | Same hex palette |
| `src/app/(dashboard)/settings/agent/_components/LanguageSettingsForm.tsx` | component | form | React client | Same hex palette |
| `src/app/(dashboard)/settings/notifications/page.tsx` | page | layout | Next.js page | Same hex palette |
| `src/app/(dashboard)/leads/page.tsx` | page | layout | Next.js page | Same hex palette |

---

## Current Hardcoded Hex Palette (ALL 277 occurrences map to these 8 values)

| Hex Value | Current Usage | Semantic Name (D-03) | Light Mode Token | Dark Mode Token |
|---|---|---|---|---|
| `#0F172A` | Background (dark sidebar, page bg) | `--bg` | N/A | `--bg` (dark) |
| `#1E293B` | Elevated surface (cards, input backgrounds) | `--bg-elevated` | N/A | `--bg-elevated` (dark) |
| `#334155` | Border/rule color | `--rule` | N/A | `--rule` (dark) |
| `#94A3B8` | Secondary text/icon | `--fg-3` | N/A | `--fg-3` (dark) |
| `#F8FAFC` | Primary text/foreground | `--fg-1` | N/A | `--fg-1` (dark) |
| `#F97316` | Accent (buttons, highlights, active states) | `--accent` | `var(--teal-500)` (light) | `var(--teal-400)` (dark) |
| `#EF4444` | Danger/error | `--danger` | `var(--brick-500)` (light) | `var(--brick-500)` (dark) |
| `#22C55E` | Success | `--success` | `var(--moss-500)` (light) | `var(--moss-500)` (dark) |

---

## Pattern Assignments

### Configuration Files

#### `src/app/globals.css` (config, CSS tokens)

**Current state** (lines 1–22):
```css
@import 'tailwindcss';

:root {
  --color-background: #0F172A;
  --color-surface: #1E293B;
  --color-accent: #F97316;
  --color-text-primary: #F8FAFC;
  --color-text-secondary: #94A3B8;
  --color-border: #334155;
  --color-destructive: #EF4444;
  --color-success: #22C55E;
}

html, body {
  background-color: var(--color-background);
  color: var(--color-text-primary);
}

@media (prefers-reduced-motion: reduce) {
  .animate-spin { animation: none; }
}
```

**Pattern to apply (D-04, D-05, D-06):**
- Replace `:root {}` entirely with Wolknitive primitive tokens (`--vellum-50` through `--ink`, `--teal-50` through `--teal-800`, `--plum-*`, `--amber-*`, `--moss-*`, `--brick-*`)
- Add semantic token definitions (`--bg`, `--bg-elevated`, `--bg-sunken`, `--fg-1` through `--fg-4`, `--accent`, `--success`, `--danger`, `--rule`, etc.)
- Add `@theme {}` block with all colors, fonts, spacing, radii tokens
- Add `@media (prefers-color-scheme: dark)` to remap semantic tokens only (primitives stay same)
- Preserve `@import 'tailwindcss'` and reduced-motion media query

**Source:** Wolknitive ZIP `colors_and_type.css` (canonical token list)

---

#### `tailwind.config.ts` (config, theme config)

**Current state** (lines 1–21):
```typescript
import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0F172A',
        surface: '#1E293B',
        accent: '#F97316',
        'text-primary': '#F8FAFC',
        'text-secondary': '#94A3B8',
        'border-default': '#334155',
        destructive: '#EF4444',
        success: '#22C55E',
      },
      fontFamily: { sans: ['var(--font-inter)', 'sans-serif'] },
    },
  },
  plugins: [],
}
export default config
```

**Pattern to apply (D-14):**
- **DELETE this file entirely**
- All tokens move to `@theme {}` block in `globals.css`
- Tailwind v4 automatically infers content from `./src/**/*.{ts,tsx}` or via `@source` directive
- Verify `npm run build` exits 0 after deletion

**Source:** None (file deletion)

---

#### `src/app/layout.tsx` (root layout, font declarations)

**Current state** (lines 1–20):
```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'VoiceDesk',
  description: '24/7 AI phone receptionist for HVAC, plumbing, and electrical contractors',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased bg-background text-text-primary">
        {children}
      </body>
    </html>
  )
}
```

**Pattern to apply (D-08, D-09, D-10, D-11):**
- Keep Inter import via `next/font/google` (UI labels, buttons, form fields, nav)
- **Add** `next/font/local` for Bogart trial files from ZIP (18 weight/style combinations into `src/fonts/bogart/`)
- **Add** Newsreader via `@fontsource/newsreader` CDN for digit fallback (unicode-range U+0030-0039) per D-09
- **Add** JetBrains Mono import for phone numbers / numeric data
- Apply font variables to `<html className={...}>` — concatenate all font variables
- Update `<body>` className to use `--font-ui` for UI elements
- Define CSS font stacks in `globals.css`:
  - `--font-display: 'Bogart', 'Iowan Old Style', Georgia, serif`
  - `--font-body: 'Bogart', Georgia, 'Times New Roman', serif`
  - `--font-ui: 'Inter Tight', system-ui, -apple-system, 'Segoe UI', sans-serif`
  - `--font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace`

**Source:** Next.js 14 font patterns (existing Inter) + Wolknitive font setup (Bogart, Inter Tight, JetBrains Mono)

---

### Component Files — Hex Replacement Patterns

All 20 component/page files follow **identical hardcoded hex patterns**. A script-assisted sweep (D-15) will convert these systematically:

#### Example: `src/components/auth/LoginForm.tsx` (component, UI/form)

**Current state — hex usage** (lines 64–145):
```typescript
// Line 64: Card background
<div className="bg-[#1E293B] border border-[#334155] rounded-xl p-8">
  
// Line 65: Heading text
<h1 className="text-[28px] font-semibold text-[#F8FAFC] mb-1">Welcome back</h1>
  
// Line 66: Subtitle text
<p className="text-sm text-[#94A3B8] mb-6">Sign in to your VoiceDesk account</p>

// Line 69: Error alert background + border + text
<div role="alert" className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] rounded-lg p-3 text-sm mb-4">

// Line 79: Orange button background + dark text
<Button className="w-full bg-[#F97316] text-[#0F172A] hover:bg-[#F97316]/90 min-h-[44px] font-semibold">

// Line 90: Border divider
<div className="flex-1 border-t border-[#334155]" />

// Line 91: Divider text
<span className="mx-3 text-sm text-[#94A3B8]">or continue with email</span>

// Line 98: Label text
<Label htmlFor="email" className="text-sm text-[#94A3B8]">Email</Label>

// Line 103: Input background + border + text + focus ring
<Input className="bg-[#0F172A] border-[#334155] text-[#F8FAFC] focus-visible:ring-[#F97316] min-h-[44px] mt-1" />

// Line 106: Error text
<p className="text-sm text-[#EF4444] mt-1">{errors.email.message}</p>

// Line 116: Password input with same pattern
<Input className="bg-[#0F172A] border-[#334155] text-[#F8FAFC] focus-visible:ring-[#F97316] min-h-[44px] pr-10" />

// Line 123: Eye icon color
className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94A3B8]"

// Line 135: Submit button border + text + hover
<Button variant="outline" className="w-full border-[#334155] text-[#F8FAFC] hover:bg-[#334155] min-h-[44px]" />

// Line 142: Link color + hover
<Link href="/auth/signup" className="text-[#F97316] hover:underline">
```

**Hex → Token mapping** (D-15 script mapping):
- `#0F172A` → `bg-bg` or `text-on-bg` (light mode) / dark mode context
- `#1E293B` → `bg-bg-elevated` or `bg-surface`
- `#334155` → `border-rule`
- `#94A3B8` → `text-fg-3`
- `#F8FAFC` → `text-fg-1`
- `#F97316` → `text-accent` / `bg-accent`
- `#EF4444` → `text-danger` / `border-danger` / `bg-danger` (with opacity preserved)
- `#22C55E` → `text-success` / `bg-success`
- Opacity modifiers like `/10`, `/30` → preserved as `danger/10`, `danger/30`, etc.

**Pattern to apply:**
- Script replaces all inline `[#XXXXXX]` with token utility classes
- Dynamic class strings via `cn()` reviewed manually post-script
- Verify no hex remains after sweep

**Source:** Same pattern across LoginForm, SignupForm, PhoneCaptureForm, LanguageSettingsForm, NotificationSettingsForm

---

#### Example: `src/components/dashboard/Sidebar.tsx` (component, navigation)

**Current state — hex usage** (lines 45–130):
```typescript
// Line 45: Sidebar background + border
<aside className="w-60 h-screen fixed bg-[#0F172A] border-r border-[#334155] flex-col hidden md:flex">

// Line 49: Logo area border
<div className="h-16 flex items-center gap-2 px-6 border-b border-[#334155]">

// Line 50: Mic icon color (orange accent)
<Mic size={20} className="text-[#F97316]" />

// Line 51: Logo text color
<span className="text-xl font-semibold text-[#F8FAFC]">VoiceDesk</span>

// Line 57: Navigation label color
<p className="text-sm font-semibold text-[#94A3B8] tracking-wider px-4 mb-2">NAVIGATION</p>

// Line 70: Active nav item background + border + text
'text-[#F8FAFC] bg-[#1E293B] border-l-4 border-[#F97316] pl-[12px]'
// Inactive nav item
'text-[#94A3B8] px-4 hover:bg-[#1E293B] hover:text-[#F8FAFC]'

// Line 82: Settings sub-nav border
<div className="ml-6 mt-2 border-l border-[#334155] pl-2">

// Line 92: Active sub-nav text color (orange)
'text-[#F97316] font-semibold'
// Inactive sub-nav
'text-[#94A3B8] hover:text-[#F8FAFC]'

// Line 106: Bottom border
<div className="border-t border-[#334155] p-4">

// Line 108: Avatar background
<div className="w-8 h-8 rounded-full bg-[#334155] flex items-center justify-center text-sm font-semibold text-[#F8FAFC]">

// Line 112: Business name text
<p className="text-sm font-semibold text-[#F8FAFC] truncate">{businessName ?? 'VoiceDesk'}</p>

// Line 114: Phone number text (orange accent)
<p className="text-xs text-[#F97316] flex items-center gap-1 truncate">

// Line 119: Email text color
<p className="text-xs text-[#94A3B8] truncate">{userEmail ?? ''}</p>

// Line 125: Sign-out link color
className="flex items-center gap-2 text-sm text-[#94A3B8] hover:text-[#F8FAFC]"
```

**Pattern to apply:** Same hex→token mapping as LoginForm. Additionally:
- Border colors (`border-[#334155]`, `border-l-4 border-[#F97316]`) → `border-rule`, `border-accent`
- Hover states preserve logic (e.g., `hover:bg-[#1E293B]` → `hover:bg-bg-elevated`)

**Source:** Same as LoginForm pattern

---

#### Example: `src/components/notification/NotificationBell.tsx` (component, UI/interactive)

**Current state — hex usage** (lines 96–180):
```typescript
// Line 96: Button focus ring color
className="relative flex items-center justify-center rounded-md p-1 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]"

// Line 101: Bell icon color (conditional: orange if unread, gray if read)
color={hasUnread ? '#F97316' : '#94A3B8'}

// Line 109: Badge background (orange)
className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#F97316] text-white"

// Line 122: Popover border + background
className="z-50 w-[360px] max-h-[500px] overflow-hidden rounded-lg border border-[#334155] bg-[#1E293B] shadow-xl"

// Line 125: Header border
<div className="flex items-center justify-between border-b border-[#334155] px-4 py-3">

// Line 126: Header text color
<span className="text-sm font-semibold text-[#F8FAFC]">

// Line 133: Mark-all-read link color
className="cursor-pointer text-xs text-[#F97316] hover:underline disabled:opacity-50"

// Line 144: Empty state text color
<p className="text-sm text-[#94A3B8]">No notifications yet</p>

// Line 150: Feed row border
className="flex items-stretch border-b border-[#334155] hover:bg-[rgba(255,255,255,0.05)]"

// Line 156: Left border color (per event_type, set via borderColorForEventType())
backgroundColor: borderColorForEventType(...) // returns #EF4444, #F97316, or #64748B

// Line 163: Notification title color
<p className="truncate text-xs font-semibold text-[#F8FAFC]">

// Line 166: Notification body text color
<p className="truncate text-xs text-[#94A3B8]">

// Line 169: Timestamp text color
<p className="mt-0.5 text-[#94A3B8]" style={{ fontSize: '10px' }}>
```

**Additional pattern — borderColorForEventType()** (lines 46–58):
```typescript
function borderColorForEventType(eventType: AppNotification['event_type']): string {
  switch (eventType) {
    case 'emergency':
      return '#EF4444'      // danger (red)
    case 'lead':
      return '#F97316'      // accent (orange)
    default:
      // 'system' | 'payment_failure' → slate
      return '#64748B'      // secondary text fallback
  }
}
```

**Pattern to apply:**
- Replace hardcoded hex in function return values with semantic token references
- Update focus ring, badge, button colors to use `accent`, `danger`, `fg-3` tokens
- Preserve conditional logic (e.g., `hasUnread ? 'accent' : 'fg-3'`)

**Source:** Same as LoginForm/Sidebar patterns

---

#### Example: `src/components/dashboard/BottomTabBar.tsx` (component, navigation)

**Current state — hex usage** (lines 22–46):
```typescript
// Line 22: Nav background + border
className="fixed bottom-0 left-0 right-0 h-14 bg-[#0F172A] border-t border-[#334155] flex md:hidden z-30"

// Line 35: Active tab color (orange accent) vs inactive (gray)
isActive ? 'text-[#F97316]' : 'text-[#94A3B8]'

// Line 46: Inactive "Alerts" label color
<span className="text-xs text-[#94A3B8]">Alerts</span>
```

**Pattern to apply:** Simple token replacement (no opacity modifiers, no complex logic)

**Source:** Same as Sidebar navigation pattern

---

#### Example: `src/components/dashboard/EmptyState.tsx` (component, UI)

**Current state — hex usage** (lines 17–28):
```typescript
// Line 17: Icon color (border/rule gray)
<Icon size={48} className="text-[#334155] mb-4" />

// Line 18: Heading color (primary text)
<h2 className="text-xl font-semibold text-[#F8FAFC] mb-2">{heading}</h2>

// Line 19: Body text color (secondary text)
<p className="text-sm text-[#94A3B8] max-w-[320px] text-center mb-6">{body}</p>

// Line 23: CTA link border + text (orange accent)
className="border border-[#F97316] text-[#F97316] px-4 py-2 rounded text-base font-normal min-h-[44px] flex items-center"
```

**Pattern to apply:** Straightforward token replacement (icon, text, border, link colors)

**Source:** Same as LoginForm pattern

---

### All 20 Component/Page Files

The following 16 files follow **identical hex patterns** to the examples above (no additional excerpts needed — executor will apply the mapping script uniformly):

- `src/components/auth/PhoneCaptureForm.tsx` — same hex palette
- `src/components/auth/SignupForm.tsx` — same hex palette
- `src/app/(auth)/auth/signup/page.tsx` — same hex palette
- `src/app/(auth)/auth/login/page.tsx` — same hex palette (excerpt above)
- `src/app/(auth)/setup/phone/page.tsx` — same hex palette
- `src/app/(dashboard)/layout.tsx` — same hex palette (line 29: `bg-[#1E293B]`)
- `src/app/(auth)/pricing/page.tsx` — same hex palette
- `src/app/(dashboard)/calls/page.tsx` — same hex palette
- `src/app/(dashboard)/settings/calendar/page.tsx` — same hex palette
- `src/app/(dashboard)/settings/go-live/page.tsx` — same hex palette
- `src/app/(dashboard)/settings/agent/page.tsx` — same hex palette
- `src/app/(dashboard)/settings/agent/_components/LanguageSettingsForm.tsx` — same hex palette
- `src/app/(dashboard)/settings/notifications/page.tsx` — same hex palette
- `src/app/(dashboard)/leads/page.tsx` — same hex palette

---

## Shared Patterns & Cross-Cutting Concerns

### Hex → Semantic Token Mapping (D-15)

**Deterministic mapping script:**

| Source Hex | Light Mode Token (Wolknitive) | Dark Mode Token (Wolknitive) | Tailwind v4 Class |
|---|---|---|---|
| `#0F172A` | `var(--vellum-50)` (warm cream) | `var(--bg)` = `#0F172A` | `bg-bg` |
| `#1E293B` | `var(--vellum-100)` (warm cream) | `var(--bg-elevated)` = `#1E293B` | `bg-bg-elevated` |
| `#334155` | `var(--rule-soft)` | `var(--rule)` = `#334155` | `border-rule` |
| `#94A3B8` | `var(--fg-3)` | `var(--fg-3)` = `#94A3B8` | `text-fg-3` |
| `#F8FAFC` | `var(--fg-1)` | `var(--fg-1)` = `#F8FAFC` | `text-fg-1` |
| `#F97316` | `var(--teal-500)` (light accent) | `var(--accent)` = `var(--teal-400)` | `text-accent`, `bg-accent`, `border-accent` |
| `#EF4444` | `var(--brick-500)` | `var(--danger)` = `var(--brick-500)` | `text-danger`, `bg-danger`, `border-danger` |
| `#22C55E` | `var(--moss-500)` | `var(--success)` = `var(--moss-500)` | `text-success`, `bg-success` |

**Special handling:**
- **Opacity modifiers** — preserve as-is (e.g., `bg-[#EF4444]/10` → `bg-danger/10`)
- **Dynamic strings with `cn()`** — review manually; no regex can safely extract
- **Inline style `backgroundColor`** — convert to Tailwind classes or keep as CSS variable references
- **Hover/focus states** — apply to semantic tokens (e.g., `hover:bg-[#334155]` → `hover:bg-rule`)

---

### Font Application Pattern (D-08 through D-11)

**Auth & Marketing Pages:**
- Headings: `--font-display` (Bogart serif, "editorial-classical")
- Body/prose: `--font-body` (Bogart serif)

**Dashboard/App UI:**
- Nav, buttons, form labels, table cells: `--font-ui` (Inter Tight sans-serif)
- Phone numbers, numeric data: `--font-mono` (JetBrains Mono, sidesteps Bogart digit watermark)

**Implementation in `layout.tsx`:**
- Declare all fonts via `next/font/local` (Bogart) and `next/font/google` (Inter, JetBrains)
- Set `className` on `<html>` with all font variables: `${bogart.variable} ${interTight.variable} ${jetbrainsMono.variable} ${inter.variable}`
- In `globals.css`, define stacks:
  ```css
  :root {
    --font-display: 'Bogart', 'Iowan Old Style', Georgia, serif;
    --font-body: 'Bogart', Georgia, 'Times New Roman', serif;
    --font-ui: 'Inter Tight', system-ui, -apple-system, 'Segoe UI', sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
  }
  body { font-family: var(--font-ui); } /* default UI */
  h1, h2, h3, h4, h5, h6 { font-family: var(--font-display); }
  ```

---

### Dark Mode Structure (D-06, D-07)

**`:root {}` for light mode** — Wolknitive values verbatim (warm cream `--bg`, ink text, teal accent)

**`@media (prefers-color-scheme: dark) { :root { ... } }`** — semantic remaps only:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0F172A;
    --bg-elevated: #1E293B;
    --bg-sunken: #0B1120;
    --fg-1: #F8FAFC;
    --fg-2: #CBD5E1;
    --fg-3: #94A3B8;
    --fg-4: #64748B;
    --rule: #334155;
    --rule-strong: #475569;
    --rule-soft: #1E293B;
    --accent: var(--teal-400);
    --success: var(--moss-500);
    --danger: var(--brick-500);
  }
}
```

**Note:** No UI toggle in this phase. Dark mode is OS-preference only (`@media (prefers-color-scheme: dark)`). Token structure supports future `.dark` class toggle without rework (D-07).

---

### No Emoji / No Gradients (SKILL.md brand rules)

**Executor checklist during sweep:**
- [ ] Scan all 20 files for emoji characters (none should exist)
- [ ] Scan for gradient classes (`bg-gradient-*`, `from-`, `to-`, etc.) — should not appear in UI chrome per Wolknitive rules
- [ ] Flag any found instances for manual review

---

## Wolknitive Design System Integration

**Token source:** `./Wolknitive Design System-handoff.zip` (in repo root)

**Key files inside ZIP (read during sweep):**
- `wolknitive-design-system/project/colors_and_type.css` — canonical token definitions (primitives, semantics, type scale, spacing, radii)
- `wolknitive-design-system/project/ui_kits/console/console.css` — reference for dashboard UI patterns (closest analog to VoiceDesk)
- `wolknitive-design-system/fonts/bogart/` — 18 Bogart trial .ttf files (weight/style combinations)
- `wolknitive-design-system/project/SKILL.md` — brand rules (no emoji, no gradients, Lucide icons only)

**Implementation (D-02, D-04):**
- Do NOT unzip into repo — read at plan/execute time
- Copy only `fonts/bogart/` and token values into project
- Define tokens via `@theme {}` block in `globals.css` (Tailwind v4 generates utility classes automatically)

---

## Regression Tests & Visual Snapshots (D-17, D-18)

### 15 v1.0 Regression Tests
- **File:** `tests/regression-v1-smoke.spec.ts` (existing, functional E2E)
- **Scope:** Auth, calls, leads, settings flows
- **Gate:** Must pass `npm test` with 0 failures
- **Impact:** Sweep must not break selectors or flow logic
- **Source:** Existing E2E test patterns in `tests/` directory

### New Playwright Visual Snapshots
- **Directory:** `tests/visual/` (new)
- **Scope:** 5 key pages before/after design system application
  1. Login page: `login-before.png` / `login-after.png`
  2. Dashboard (calls): `calls-before.png` / `calls-after.png`
  3. Leads page: `leads-before.png` / `leads-after.png`
  4. Agent settings: `agent-before.png` / `agent-after.png`
  5. Notification settings: `notifications-before.png` / `notifications-after.png`
- **Comparison:** Manual visual comparison (not automated CI snapshot diff)
- **Tool:** Playwright `page.screenshot({ path: '...' })` in test helpers

---

## No Analog Found

No files require external analog mapping; all patterns derive from:
1. Existing VoiceDesk codebase hex usage (identical palette across all components)
2. Wolknitive ZIP canonical tokens (authoritative source)
3. Tailwind v4 `@theme {}` documentation

---

## Metadata

**Analog search scope:** 23 files to sweep; 8 unique hex values; 277 total occurrences
**Pattern extraction date:** 2026-05-30
**Phase decision reference:** CONTEXT.md decisions D-01 through D-18
**Next step:** Executor uses this mapping to write Node.js sweep script, apply manually reviewed changes, and verify `npm run build && npm test` pass

