# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 1-Foundation
**Areas discussed:** Auth entry method, Language-switching logic, Agent settings structure, Dashboard shell scope

---

## Auth Entry Method

| Option | Description | Selected |
|--------|-------------|----------|
| Email + password only | Simple, no OAuth setup needed | |
| Google sign-in + email/password | One-tap Google reduces friction for non-technical contractors | ✓ |
| Magic links only | No password at all — login link per email | |

**User's choice:** Google sign-in + email/password

---

| Option | Description | Selected |
|--------|-------------|----------|
| Google prominent, email secondary | Google button front and center, 'or continue with email' below | ✓ |
| Equal options side by side | Both presented equally | |
| You decide | Claude picks based on UX best practices | |

**User's choice:** Google prominent, email secondary

---

| Option | Description | Selected |
|--------|-------------|----------|
| No phone verification | Keep signup frictionless; phone captured later in onboarding | |
| Optional phone capture at signup | Ask but don't require | |
| Required phone at signup | Mandatory before accessing dashboard | ✓ |

**User's choice:** Required phone at signup
**Notes:** Ensures notification delivery (SMS/WhatsApp) is set up from account creation, not deferred.

---

## Language-Switching Logic

| Option | Description | Selected |
|--------|-------------|----------|
| Agent greets in all languages, caller chooses | "For English press 1, Para español oprima 2, Pou Kreyòl peze 3" | ✓ |
| Auto-detect from caller's speech | Retell tries to detect automatically | |
| Contractor sets one default language | Single language per agent | |

**User's choice:** Agent greets in all enabled languages, caller presses 1/2/3

---

| Option | Description | Selected |
|--------|-------------|----------|
| English → Spanish → Haitian Creole | Alphabetical by market size | ✓ |
| Spanish → Haitian Creole → English | South Florida market-first | |
| Contractor sets the order | Configurable per contractor | |

**User's choice:** English → Spanish → Haitian Creole

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — full conversation in selected language | Consistent experience; keywords in all languages | ✓ |
| Spanish/Creole conversation, English classification | AI speaks caller's language, internal tags stay English | |

**User's choice:** Full conversation in selected language including emergency detection
**Notes:** Internal DB classification tags (lead/emergency) remain English regardless.

---

## Agent Settings Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Discrete columns (Recommended) | Each setting its own typed column | ✓ |
| Single JSONB config blob | All settings in one column | |
| Hybrid — core fields as columns, extras in JSONB | Mixed approach | |

**User's choice:** Discrete columns

---

| Option | Description | Selected |
|--------|-------------|----------|
| JSONB per-day object | { monday: {open, close, enabled}, ... } | ✓ |
| Separate availability_windows table | Normalized rows with joins | |
| Start/end time only, applies all days | Simplest, no per-day variation | |

**User's choice:** JSONB per-day business hours object

---

| Option | Description | Selected |
|--------|-------------|----------|
| Per-language keyword lists | { en: [...], es: [...], ht: [...] } | ✓ |
| Single shared list, LLM handles translation | One English list, LLM recognizes equivalents | |

**User's choice:** Per-language emergency keyword lists

---

## Dashboard Shell Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Setup wizard redirect | Immediately flows into onboarding wizard | |
| Dashboard with setup banner | Full nav visible with prominent 'Complete Setup' banner | ✓ |
| Minimal placeholder with single CTA | Just brand, progress indicator, and one button | |

**User's choice:** Dashboard with setup banner — full nav visible from day one

---

| Option | Description | Selected |
|--------|-------------|----------|
| Calls / Leads / Settings | Three sections matching core user jobs | ✓ |
| Dashboard / Calls / Leads / Agent / Billing | More granular nav with summary home | |
| You decide | Claude picks based on v1 scope | |

**User's choice:** Calls / Leads / Settings

---

| Option | Description | Selected |
|--------|-------------|----------|
| Desktop-first only | Mobile polish later | |
| Responsive from day one | Tailwind makes this low-cost | ✓ |

**User's choice:** Responsive from day one

---

| Option | Description | Selected |
|--------|-------------|----------|
| Dark professional (charcoal + accent) | Dark sidebar, white content, bold accent | |
| Clean light (white + brand color) | White background, primary color for CTAs | |
| You decide based on target market | Claude picks something trustworthy for contractors | ✓ |

**User's choice:** Delegated to Claude

---

## Claude's Discretion

- **Brand/color:** Deep navy (#0F172A) + orange (#F97316) accent. Trustworthy, high-contrast, differentiates from generic blue SaaS.
- **Component approach:** Tailwind CSS utility-first, no heavy component library. shadcn/ui components as needed.
- **Form library:** react-hook-form + zod.
- **Icons:** Lucide React.

## Deferred Ideas

- **Holiday/exception hours** — Specific date overrides for the weekly schedule. Deferred to v2.
- **Team/multi-user accounts** — Multiple logins per contractor. Deferred to v2.
- **Dark mode toggle** — Not a contractor priority. Deferred.
