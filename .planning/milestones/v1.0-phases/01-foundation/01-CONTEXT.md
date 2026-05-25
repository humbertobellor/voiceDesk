# Phase 1: Foundation - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers: Supabase schema with RLS (all tables, all policies), Supabase Auth (Google + email/password), contractor account creation with persisted defaults, multi-language configuration schema (English/Spanish/Haitian Creole), dashboard shell UI with Calls/Leads/Settings nav, and the OAuth token encryption utility. No Retell, no Twilio, no billing — those are Phases 2 and 7.

</domain>

<decisions>
## Implementation Decisions

### Authentication

- **D-01:** Google sign-in is the prominent path (front and center button); email/password is secondary ("or continue with email" below). Supabase Auth handles both providers via `@supabase/ssr`.
- **D-02:** Phone number is required at signup — captured on a post-OAuth/signup step before the contractor can access the dashboard. Not deferred to the onboarding wizard. This ensures notification delivery (SMS/WhatsApp) is set up from account creation.
- **D-03:** Password reset handled by Supabase's built-in email flow. No custom reset UI needed for v1.

### Multi-Language Configuration

- **D-04:** When a contractor enables multiple languages, the Retell agent opens with a greeting in all enabled languages and prompts the caller to choose (e.g., "For English press 1, Para español oprima 2, Pou Kreyòl peze 3"). No auto-detection — explicit caller choice.
- **D-05:** Greeting language order when all three are enabled: English → Spanish → Haitian Creole. This order is fixed (not contractor-configurable in v1).
- **D-06:** The entire call conversation stays in the caller's selected language — qualification questions, scheduling confirmation, emergency prompts. Internal DB classification tags (lead/emergency/info) remain in English regardless of call language.
- **D-07:** Emergency keywords are stored per-language in the schema: `{ en: ['gas smell', 'no heat', ...], es: ['olor a gas', 'sin calefacción', ...], ht: ['sant gaz', 'pa gen chàfèt', ...] }`. Contractors can add custom keywords per language in Phase 6. Hard-coded non-configurable triggers (gas smell, CO alarm) are maintained as code constants in all three languages, not in the DB config.

### Agent Settings Schema (contractor_settings table)

- **D-08:** Discrete columns, not a JSONB blob. Each setting has its own typed column for queryability and validation.
- **D-09:** Core columns: `business_name TEXT`, `trade_type TEXT` (hvac/plumbing/electrical/multi), `service_area TEXT`, `supported_languages TEXT[]` (e.g., `['en','es','ht']`), `business_hours JSONB`, `emergency_keywords JSONB`, `after_hours_message TEXT`, `agent_voice TEXT`.
- **D-10:** Business hours stored as a JSONB per-day object: `{ monday: { open: '08:00', close: '18:00', enabled: true }, tuesday: {...}, ... }`. All 7 days present; `enabled: false` means closed that day.
- **D-11:** Emergency keywords stored as a JSONB per-language object: `{ en: ['gas smell', 'no heat', ...], es: [...], ht: [...] }`. Defaults pre-populated on account creation for all enabled languages.

### Dashboard Shell UI

- **D-12:** Contractors land on the full dashboard immediately after signup (and required phone capture). A prominent "Complete Setup" banner is shown at the top until provisioning is complete (Phase 7). All nav sections (Calls, Leads, Settings) are visible with appropriate empty states.
- **D-13:** Main nav: **Calls** / **Leads** / **Settings**. Settings contains: Agent Config, Notifications, Account/Billing.
- **D-14:** Responsive from day one using Tailwind CSS breakpoints. Mobile layout collapses sidebar nav to a bottom tab bar or hamburger menu.

### Brand & Visual Design

- **D-15:** Claude's discretion — deep navy (#0F172A) as the primary background/sidebar color with orange (#F97316) as the accent. Clean, professional, high-contrast. Reads trustworthy for home-service contractors, orange differentiates from generic enterprise SaaS blue. Typography: Inter (already in most Next.js starters).

### Infrastructure / Schema Non-Negotiables

- **D-16:** `webhook_events` idempotency table created in Phase 1: columns `id`, `source` (e.g., 'retell'), `event_type`, `external_id` (call_id), `payload JSONB`, `processed_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ`. Unique constraint on `(source, event_type, external_id)`.
- **D-17:** `calendar_credentials` table created with encrypted `access_token TEXT` and `refresh_token TEXT` columns. AES-256-GCM encryption utility written in Phase 1 — no Google OAuth callback route is written before this utility exists.
- **D-18:** RLS test: before Phase 1 is considered complete, an automated test (or manual test script) verifies as an unprivileged Supabase role that no contractor can read, update, insert, or delete another contractor's rows in any table.

### Claude's Discretion

- Brand/color palette: deep navy + orange (D-15 above) — user delegated this.
- Component library: Tailwind CSS utility-first (no heavy component library for v1 — keeps bundle lean and avoids version lock).
- Form library: react-hook-form + zod (standard pattern; no need to ask).
- Icon set: Lucide React (ships with most shadcn/ui setups, consistent SVG quality).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Foundation
- `.planning/PROJECT.md` — Project context, requirements summary, tech stack decisions
- `.planning/REQUIREMENTS.md` — All 26 v1 requirements with REQ-IDs; LANG-01 and LANG-02 are the formal requirements for Phase 1
- `.planning/ROADMAP.md` Phase 1 section — Success criteria and notes for Foundation phase
- `.planning/STATE.md` — Locked decisions and architecture reference (webhook-first, RLS rules, encryption requirement)

### Research
- `.planning/research/STACK.md` — Stack validation, Supabase RLS patterns, `@supabase/ssr` usage, OAuth encryption guidance
- `.planning/research/ARCHITECTURE.md` — Full DB schema sketch (9 tables), RLS policy patterns, multi-tenant isolation approach
- `.planning/research/PITFALLS.md` — Critical pitfalls: RLS gaps (Critical), Google OAuth testing-mode expiry (Critical), webhook idempotency pattern

### No external specs — requirements fully captured in decisions above

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project. No existing code to reuse.

### Established Patterns
- None yet. Phase 1 establishes the patterns all subsequent phases follow.

### Integration Points
- Phase 1 schema must include all tables needed by Phases 2–7 (see ARCHITECTURE.md for full table list). Phase 2 will write to `contractors` and `agents` rows established here. Phase 3's webhook handler depends on the `webhook_events` idempotency table and `calls` table created here.

</code_context>

<specifics>
## Specific Ideas

- **South Florida market:** Spanish and Haitian Creole are first-class languages from day one, not add-ons. The schema, default keyword lists, and greeting prompt must treat all three languages equally.
- **Phone number at signup:** Captured immediately post-OAuth/signup on a dedicated step (not buried in onboarding). This is a product decision to ensure contractors can receive notifications from their first login.
- **"Complete Setup" banner:** Visible and prominent on the dashboard until Phase 7 onboarding is complete. Should link directly to the onboarding wizard (Phase 7) and show the 4 setup steps as a mini-progress indicator.

</specifics>

<deferred>
## Deferred Ideas

- **Holiday/exception hours** — Contractors may want to mark specific dates (e.g., July 4th) as closed without changing their normal weekly schedule. Deferred to v2; the per-day JSONB structure can be extended later.
- **Team/multi-user accounts** — Multiple logins per contractor account (owner + office manager). Deferred to v2; single-user per account in v1.
- **Dark mode** — Dashboard dark mode toggle. Deferred; not a contractor priority.

</deferred>

---

*Phase: 1-Foundation*
*Context gathered: 2026-05-04*
