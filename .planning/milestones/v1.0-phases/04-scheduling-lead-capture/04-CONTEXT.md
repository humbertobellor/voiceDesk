# Phase 4: Scheduling & Lead Capture - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 delivers: Google Calendar OAuth connection for contractors, pre-computed availability-window-based appointment slot injection into the Retell agent system prompt, post-call appointment record creation with Google Calendar event sync, and lead record creation for every qualifying call.

**What this phase includes:**
- `/dashboard/connect-calendar` — minimal OAuth connection page (button + success/error state)
- `/api/auth/google/initiate` — generate OAuth URL, set state cookie, redirect to Google
- `/api/auth/google/callback` — verify state cookie, exchange code for tokens, encrypt, write to `calendar_credentials`
- Google OAuth2Client singleton (`src/lib/google/client.ts`) using `googleapis`
- Token refresh-on-use utility — checks expiry before every Calendar API call, re-encrypts and writes new tokens
- Available slot computation logic — reads `contractor_settings.business_hours` + `appointment_duration_minutes`, subtracts existing `appointments`, returns next 5 business days of open slots
- System prompt injection — slot list passed into Retell agent system prompt rebuild (triggers existing `retell-agent-sync` Inngest function on appointment create/cancel)
- Extend Phase 3 GPT-4o extraction schemas (hvac, plumbing, electrical, multi) to include `confirmed_appointment_time` and `service_address` fields
- Lead creation in `retell-call-classify` Inngest function (after classification + extraction)
- Appointment creation with DB-level UNIQUE(contractor_id, starts_at) conflict prevention
- Google Calendar event creation inside `retell-call-classify` Inngest function, after appointment row is inserted
- `appointment_duration_minutes` column added to `contractor_settings` (migration)
- `google_sync_status` column added to `appointments` (migration)

**What this phase does NOT include:**
- Portal UI for viewing leads/appointments (Phase 6)
- Notifications about new leads or appointments (Phase 5)
- Appointment cancellation/rescheduling API (Phase 6)
- Supabase Realtime for appointment updates (Phase 6)
- Twilio/Retell provisioning changes (Phase 2 complete)

</domain>

<decisions>
## Implementation Decisions

### Google OAuth Connection Flow

- **D-01:** **OAuth entry page:** Minimal `/dashboard/connect-calendar` page — a single "Connect Google Calendar" button plus success/error state display. No full portal UI. Phase 6 replaces this with the proper Settings section.
- **D-02:** **OAuth state management:** State param + httpOnly cookie. Before redirecting to Google, generate a short-lived random state token, store it in an httpOnly cookie (`oauth_state`), and pass it as the OAuth `state` param. Verify the cookie matches on callback before proceeding.
- **D-03:** **Post-OAuth redirect:** On successful token write, redirect to `/dashboard`. Dashboard shell (Phase 1) shows a success banner via query param (`?calendarConnected=1`).
- **D-04:** **OAuth library:** `googleapis` OAuth2Client directly (`google.auth.OAuth2`). `generateAuthUrl()` for initiation, `getToken()` on callback. Already installed — no new dependencies.
- **D-05:** **Token refresh strategy:** Refresh on use. Before every Google API call, read `token_expiry` from `calendar_credentials`. If expired or within 5 minutes, call `oauth2Client.refreshAccessToken()`, encrypt both tokens with the Phase 1 AES-256-GCM utility, write back to `calendar_credentials`. Proceed with the fresh token.

### Appointment Slot Strategy

- **D-06:** **Appointment duration:** Add `appointment_duration_minutes INT NOT NULL DEFAULT 120` to `contractor_settings` (migration). Contractors can later configure 60/90/120/180 min in Phase 6 portal. Default 2 hours for all contractors.
- **D-07:** **Slot injection:** Pre-compute available slots for the next 5 business days. Computation: for each enabled business day, generate slot boundaries from `open` to `close` using `appointment_duration_minutes` steps, then subtract slots already in `appointments` table (by `starts_at`). Resulting list injected as concrete time offers into the Retell agent system prompt (e.g., "Available: Tuesday May 12 at 10am, Tuesday May 12 at 2pm, Thursday May 14 at 9am...").
- **D-08:** **System prompt refresh trigger:** After each new appointment is created or cancelled, fire the existing `retell/agent.sync` Inngest event to rebuild the system prompt with updated available slots. Same Inngest function (`retell-agent-sync`) as Phase 2 — no new function needed.
- **D-09:** **Booking conflict prevention:** Slot-boundary locking via UNIQUE(contractor_id, starts_at) is sufficient. Pre-computed slots are always aligned to duration boundaries — you cannot offer 9am if slots are 8am/10am — so overlapping bookings are structurally impossible when slots are honored.
- **D-10:** **Race condition handling:** If two calls simultaneously target the same slot and the second INSERT hits the UNIQUE constraint, create the appointment row anyway with a `booking_conflict = true` flag (add boolean column to `appointments`). Contractor sees the conflict in the portal (Phase 6) and calls back the second customer. SCHED-04's "next open slot" = contractor callback, not automated re-slot. Keeps Phase 4 simple.

### Appointment Details Extraction

- **D-11:** **Extraction schema extension:** Extend all four Phase 3 GPT-4o extraction schemas (`hvac`, `plumbing`, `electrical`, `multi`) to include two new fields in `raw_metadata JSONB`:
  - `confirmed_appointment_time`: ISO datetime string (e.g., `"2026-05-12T10:00:00"`), or `null` if no appointment was booked
  - `service_address`: plain text string (full address or intersection), or `null` if not provided by caller
  
  Same single GPT-4o extraction call — no extra LLM round-trip. Phase 4 just adds these fields to the existing extraction prompt.

- **D-12:** **Lead creation rules (carrying forward Phase 3 D-13/D-14):**
  - `intent = 'lead'` → lead created ✓
  - `intent = 'emergency'` → lead created ✓
  - `intent = 'info'` AND `duration_seconds >= 15` → lead created ✓
  - `intent = 'no_action'` → no lead created ✗
  - Lead `status` at creation: `'booked'` if `raw_metadata.confirmed_appointment_time` is non-null; `'new'` otherwise.
  - Lead created in the `retell-call-classify` Inngest function after classification + extraction complete.

### Calendar Event Creation & Failure Handling

- **D-13:** **Calendar event creation timing:** Inside the existing `retell-call-classify` Inngest function, after the `appointments` DB row is inserted. Sequence: classify → extract → create lead → create appointment → create Google Calendar event → update `appointments.google_event_id` + `google_sync_status = 'synced'`.

- **D-14:** **Source of truth and failure path:** DB `appointments` row is authoritative. Add `google_sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (google_sync_status IN ('pending','synced','failed','skipped'))` to `appointments` table (migration). If Calendar API fails, Inngest retries up to 5 times (same pattern as `retell-agent-sync`). If all retries exhaust, set `google_sync_status = 'failed'`. Contractor can see unsynced appointments in portal (Phase 6).

- **D-15:** **No calendar connected:** If `calendar_credentials` row doesn't exist for the contractor, still create `appointments` and `leads` rows. Set `google_sync_status = 'skipped'`. No error — system works without Calendar connected; contractor manually syncs or connects calendar later.

### Claude's Discretion

- Exact route paths for OAuth: `/api/auth/google/initiate` and `/api/auth/google/callback` — standard Next.js App Router patterns.
- State cookie name (`oauth_state`) and TTL (10 minutes) — researcher to confirm secure cookie config.
- Slot injection format in system prompt (exact phrasing) — researcher to determine based on Retell prompt patterns from Phase 2.
- GPT-4o model for extraction (same as Phase 3 — `gpt-4o`, `zodResponseFormat`) — researcher to confirm no changes needed.
- `booking_conflict` column type and default (`BOOLEAN DEFAULT false`) — planner to decide.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Foundation
- `.planning/PROJECT.md` — Project context, stack, constraints, core value
- `.planning/REQUIREMENTS.md` — SCHED-01, SCHED-02, SCHED-03, SCHED-04 are the requirements this phase delivers
- `.planning/ROADMAP.md` Phase 4 section — Success criteria, critical notes (OAuth production mode, SELECT FOR UPDATE, AES-256-GCM)
- `.planning/STATE.md` — Architecture reference, locked decisions (AES-256-GCM, Inngest, `after()` from `next/server`)

### Prior Phase Decisions
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-17 (calendar_credentials table), D-16 (AES-256-GCM encryption utility)
- `.planning/phases/02-provisioning/02-CONTEXT.md` — D-04–D-07 (system prompt builder, Retell LLM sync pattern), D-12 (Inngest retry patterns)
- `.planning/phases/03-webhook-core/03-CONTEXT.md` — D-06–D-10 (classification pipeline, extraction schemas, leads decisions), D-13/D-14 (which calls get lead records), D-08/D-09 (raw_metadata extraction schema per trade type)

### Schema (MUST read before planning)
- `supabase/migrations/20260504000001_initial_schema.sql` — `leads` table (id, contractor_id, call_id, caller_name, caller_phone, service_requested, service_type, urgency, preferred_time, notes, status CHECK), `appointments` table (UNIQUE(contractor_id, starts_at), google_event_id, starts_at, ends_at, service_address), `calendar_credentials` table (access_token/refresh_token encrypted TEXT, token_expiry, calendar_id, UNIQUE(contractor_id)), `contractor_settings` table (business_hours JSONB structure)
- `supabase/migrations/20260504000002_rls_policies.sql` — RLS policies for leads, appointments, calendar_credentials (all four operations per table)
- Phase 4 migration will add: `contractor_settings.appointment_duration_minutes INT`, `appointments.google_sync_status TEXT`, `appointments.booking_conflict BOOLEAN`

### Existing Code Integration Points
- `src/lib/crypto/tokens.ts` — AES-256-GCM `encrypt(plaintext)` and `decrypt(ciphertext)` — MUST use for all OAuth token writes/reads
- `src/inngest/functions/retell-agent-sync.ts` — Inngest function pattern (retries: 5, onFailure handler, NonRetriableError) — calendar event creation follows same pattern
- `src/inngest/functions/retell-call-classify.ts` — The function that Phase 4 extends for lead creation + appointment creation + Calendar event creation
- `src/app/api/inngest/route.ts` — Register new Inngest functions here if any are added

### External APIs (researcher MUST verify current docs before planning)
- **Google Calendar API v3** — verify: `events.insert()` payload (summary, start, end, description fields), `freebusy.query()` for conflict checking, OAuth2 scope requirements (`calendar.events` + `calendar.freebusy`), token refresh flow with `oauth2Client.refreshAccessToken()`
- **googleapis npm package** — verify current version, `OAuth2Client` constructor signature, `generateAuthUrl()` options (access_type: 'offline', prompt: 'consent' for refresh token)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/crypto/tokens.ts` — `encrypt(plaintext: string): string` and `decrypt(ciphertext: string): string` (AES-256-GCM, Phase 1) — use directly for all Calendar token storage/retrieval
- `src/inngest/functions/retell-agent-sync.ts` — Inngest function template with `retries: 5`, `onFailure` handler, `NonRetriableError` pattern — Calendar event creation function follows this exactly
- `src/inngest/functions/retell-call-classify.ts` — Phase 3 classification + extraction Inngest function — Phase 4 extends this function (adds lead creation, appointment creation, Calendar event write after extraction)
- `src/lib/supabase/service.ts` — `createServiceRoleClient()` — use in all server-side Calendar and booking API routes (same as Phase 3 webhook handler)
- `src/lib/retell/client.ts` — `getRetellClient()` — needed for system prompt rebuild trigger in D-08

### Established Patterns
- `import 'server-only'` in all lib modules (enforced since Phase 2)
- `createServiceRoleClient()` only in API routes and Inngest functions — never in client components
- OAuth token vars (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) follow same env pattern as `RETELL_API_KEY` — never `NEXT_PUBLIC_` prefix
- `OAUTH_ENCRYPTION_KEY` env var already exists (Phase 1 — the AES-256-GCM key)
- Inngest retry pattern: `retries: 5`, default exponential backoff, `onFailure` sets DB status to `'failed'`
- RLS on every new column/table — Phase 4 migration must include all four policies for any new tables

### Integration Points
- `contractor_settings.business_hours` + new `appointment_duration_minutes` → slot computation inputs
- `contractor_settings.retell_agent_id` + `contractor_settings.retell_llm_id` (Phase 2) → needed to trigger system prompt rebuild on Retell
- `calls.intent` + `calls.duration_seconds` → gate for lead creation (D-12)
- `calls.raw_metadata JSONB` → extended in Phase 4 to include `confirmed_appointment_time` + `service_address`
- `appointments.starts_at` UNIQUE constraint → booking conflict prevention (no additional DB changes needed for D-09)
- Phase 3 `retell-call-classify` Inngest function → Phase 4 extends this function, does NOT create a new one

</code_context>

<specifics>
## Specific Ideas

- **Slot list format in system prompt** — example: `"Available appointment slots: Tuesday May 12 at 10:00 AM, Tuesday May 12 at 2:00 PM, Thursday May 14 at 9:00 AM, Thursday May 14 at 11:00 AM, Friday May 15 at 8:00 AM."` Researcher to verify format that works well with Retell agent conversation flow based on Phase 2 prompt patterns.
- **booking_conflict flag** — When UNIQUE constraint fires on appointment INSERT, catch the constraint error, retry with `booking_conflict = true` flag. The second appointment is created, but marked as a conflict. Contractor sees both in portal (Phase 6) and calls back the second customer.
- **google_sync_status progression** — similar to Phase 3's analysis_status: `'pending'` (appointment created, Google event not yet attempted) → `'synced'` (google_event_id written) → `'failed'` (all retries exhausted) → `'skipped'` (no calendar connected).
- **OAuth state cookie TTL** — 10 minutes. The Google OAuth redirect + callback round-trip should complete well within this window. Cookie must be httpOnly, Secure, SameSite=Lax.
- **Token expiry buffer** — Refresh token if `token_expiry - now < 5 minutes`. Matches standard OAuth client behavior and avoids race conditions at the boundary.
- **SCHED-03 confirmation** — The Retell agent verbally confirms the appointment during the call ("I've booked you for Tuesday May 12th at 10am. Our team will arrive at your address."). The `confirmed_appointment_time` extraction field captures what the agent confirmed — this is the time used to create the Calendar event. If extraction returns null, no appointment row is created.

</specifics>

<deferred>
## Deferred Ideas

- **Appointment rescheduling API** — Phase 6 portal; contractor can cancel/reschedule from the portal UI.
- **freebusy.query() mid-slot-computation** — Using Google Calendar's freebusy API to cross-check existing Google events (not just DB appointments) when computing available slots. Deferred: adds latency and complexity; DB appointments table is the source of truth for Phase 4. Phase 6 can add freebusy enrichment.
- **Notification on new booking** — Phase 5 deliverable. Phase 4 creates the appointment; Phase 5 dispatches SMS/WhatsApp/Telegram notification to the contractor.
- **notify_on_general_inquiry UI checkbox** — Phase 6 portal deliverable (Phase 3 schema decision D-15).
- **Proactive token refresh cron** — Rejected in discussion in favor of refresh-on-use (D-05). Could be added as a Phase 7 hardening step if token refresh latency becomes a concern at scale.

</deferred>

---

*Phase: 4-Scheduling & Lead Capture*
*Context gathered: 2026-05-08*
