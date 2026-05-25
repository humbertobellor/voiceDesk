# Phase 3: Webhook Core - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers: a Retell webhook handler at `/api/webhooks/retell` that receives post-call events, creates and enriches `calls` rows in Supabase, classifies intent (lead / emergency / info / no_action) using GPT-4 models, and extracts structured caller and trade-specific data — so every completed call is persisted and auditable.

**What this phase includes:**
- `/api/webhooks/retell` route consuming `call_ended` and `call_analyzed` events
- `calls` row lifecycle: `pending` skeleton (call_ended) → enriched with transcript + classification (call_analyzed)
- Intent classification: hard-coded emergency triggers → GPT-4o-mini classification → GPT-4o structured extraction
- After-hours detection: pure timestamp comparison against contractor `business_hours` JSONB
- Migration: add `analysis_status` column to `calls` and `notify_on_general_inquiry` to `notification_settings`
- Inngest function for analysis timeout (30-min stale-analysis guard)

**What this phase does NOT include:**
- Notifications (Phase 5) — Phase 3 classifies; Phase 5 dispatches based on classification + contractor preferences
- Recording proxy API route `/api/recordings/:call_id` (Phase 6)
- Supabase Realtime subscription setup (Phase 6)
- Lead record creation (Phase 4 handles leads; Phase 3 writes calls only)
- Google Calendar anything (Phase 4)

</domain>

<decisions>
## Implementation Decisions

### Webhook Event Strategy

- **D-01:** Handle **both** Retell events: `call_ended` + `call_analyzed`. Single route `/api/webhooks/retell` dispatches by `event.event_type` (Claude's discretion — one route is standard for voice AI webhooks, Retell agent config points to one URL).
- **D-02:** `call_ended` handler creates a **skeleton `calls` row**: caller phone, duration, timestamp, `analysis_status='analyzing'`. Status of the call itself uses the existing `status` column — on `call_ended` set `status='completed'`.
- **D-03:** **Status progression** using a new `analysis_status` column (migration needed):
  - `pending` — DB default (call row not yet created)
  - `analyzing` — set when `call_ended` fires and skeleton row is created
  - `complete` — set when `call_analyzed` fires and enrichment is done
  - `analysis_failed` — set by Inngest timeout job if still `analyzing` after 30 minutes
- **D-04:** **Analysis timeout:** 30-minute Inngest scheduled job. If a `calls` row has `analysis_status='analyzing'` and `created_at` is > 30 minutes ago, update to `analysis_failed`.
- **D-05:** **Idempotency:** upsert on `calls` table using `ON CONFLICT (retell_call_id) DO UPDATE`. `retell_call_id` has a UNIQUE constraint (Phase 1 schema). Duplicate webhook deliveries for the same call are handled by upsert — not the `webhook_events` audit table.

### Intent Classification Pipeline

- **D-06:** **Hard-coded emergency triggers first** (EMRG-02 compliance): before any LLM call, scan the transcript for gas smell and CO alarm keywords across all enabled languages (`{ en: ['gas smell', 'co alarm', ...], es: ['olor a gas', ...] }`). If matched → `intent='emergency'`, cannot be overridden by the LLM. All other keywords pass to LLM.
- **D-07:** **LLM for all tiers**: after the hard-code check, send the transcript to GPT-4o-mini for intent classification across all three tiers (lead / emergency / info). LLM can also confirm or deny emergency classification for non-hard-coded keywords (EMRG-01 clarifying question behavior).
- **D-08:** **Two LLM calls** in sequence:
  1. **Classification call** (GPT-4o-mini): returns `intent` (`lead`|`emergency`|`info`|`no_action`) + `detected_trade` (for multi-trade contractors: `hvac`|`plumbing`|`electrical`|`other`)
  2. **Extraction call** (GPT-4o): returns structured caller data using a trade-specific schema (see D-10)
- **D-09:** **Summary storage:** store Retell's `call_analyzed` summary in the existing `summary TEXT` column as-is. The GPT-4o extraction populates separate structured fields (caller_name, issue details) stored in `raw_metadata JSONB`.
- **D-10:** **Trade-specific extraction schemas:** extraction prompt is tailored per contractor's `trade_type`:
  - `hvac`: `{ system_age, issue_type: 'heating'|'cooling'|'other', urgency }`
  - `plumbing`: `{ leak_type: 'active'|'slow'|'none', repair_type, urgency }`
  - `electrical`: `{ safety_issue: boolean, repair_type, urgency }`
  - `multi`: classification call also returns `detected_trade`, then the matching trade-specific extraction schema runs
- **D-11:** **After-hours detection:** in the `call_ended` handler, compare `call_start_at` timestamp to contractor's `business_hours JSONB` (from `contractor_settings`). Pure timestamp math — no LLM. Write `is_after_hours=true` to the `calls` row if the call started outside business hours.

### Ambiguous Call Fallback

- **D-12:** **Intent enum alignment with existing schema:** use the Phase 1 schema's existing values:
  - `info` = general inquiry (what was discussed as "general_inquiry" — schema uses `'info'`)
  - `no_action` = very short/unclassifiable calls (already in schema's CHECK constraint)
- **D-13:** **Short calls (< 15 seconds):** still run the LLM classification but pass `is_short_call: true` in the prompt context. Consistent code path; LLM uses short-call context to return `no_action` if appropriate. Calls with `intent='no_action'` do **not** get a leads row created (Phase 4 rule).
- **D-14:** **General inquiry calls (`intent='info'`) with duration ≥ 15s:** leads row IS created (Phase 4 deliverable). General inquiry calls are real contacts — contractor should see them in the lead list.

### General Inquiry Notifications (Schema Decision)

- **D-15:** `notification_settings.notify_on_general_inquiry BOOLEAN DEFAULT false` — needs migration in Phase 3. Default: **off**. Phase 6 portal adds a checkbox: `[ ] Notify me on general inquiry calls` (default unchecked). Phase 5 reads this preference before dispatching notifications for `info` calls.

### Recording Storage

- **D-16:** Store Retell's recording URL directly in `calls.recording_url` (column already exists in Phase 1 schema). No download or re-upload to Supabase Storage. Recordings remain on Retell's infrastructure.
- **D-17:** Recording access in the portal is handled by a proxy API `/api/recordings/:call_id` — **Phase 6 deliverable, not Phase 3**. Phase 3 just persists the URL.

### Supabase Realtime

- **D-18:** Leave entirely to Phase 6. Supabase Realtime picks up INSERT/UPDATE on `calls` table automatically. Phase 3 does not add any Realtime-specific configuration.

### Claude's Discretion

- Webhook route structure: one `/api/webhooks/retell` route dispatching by `event.event_type` — standard pattern, confirmed as Claude's call.
- OpenAI failure handling: on OpenAI API failure during `call_analyzed` processing — persist Retell's transcript and summary to the `calls` row immediately (never lose the transcript), then queue an Inngest retry function for the classification + extraction step. If all retries exhaust, set `analysis_status='analysis_failed'`.
- Exact exponential backoff and max retries for classification Inngest job: standard pattern, max 5 retries (consistent with Phase 2 `retell-agent-sync`).
- Webhook signature verification implementation detail: researcher must verify exact Retell signature header name and verification method from live Retell v2 docs before planning.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Foundation
- `.planning/PROJECT.md` — Project context, stack, constraints, core value
- `.planning/REQUIREMENTS.md` — CALL-01, CALL-02, CALL-03, CALL-04, EMRG-01, EMRG-02 are the requirements this phase delivers
- `.planning/ROADMAP.md` Phase 3 section — Success criteria, critical notes (especially: "Verify Retell webhook signature header name and call_ended vs call_analyzed event timing against live Retell docs before writing a single line of handler logic")
- `.planning/STATE.md` — Architecture reference, locked decisions (webhook-first, waitUntil pattern, RLS)

### Prior Phase Decisions
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-16 (webhook_events idempotency table), D-17 (calendar_credentials), infrastructure decisions
- `.planning/phases/02-provisioning/02-CONTEXT.md` — D-01 (HC removal), D-04–D-07 (system prompt / language behavior), D-12 (Inngest retry patterns)

### Schema (MUST read before planning — calls and notification_settings already defined)
- `supabase/migrations/20260504000001_initial_schema.sql` — `calls` table definition: `retell_call_id UNIQUE`, `intent` CHECK values (`lead`,`emergency`,`info`,`no_action`,`unknown`), `is_after_hours`, `recording_url`, `raw_metadata JSONB`, `transcript JSONB`, `summary TEXT` all already exist. Phase 3 migration adds `analysis_status TEXT`.
- `supabase/migrations/20260504000001_initial_schema.sql` — `notification_settings` table: `notify_on_lead`, `notify_on_emergency` exist. Phase 3 migration adds `notify_on_general_inquiry BOOLEAN DEFAULT false`.
- `supabase/migrations/20260504000001_initial_schema.sql` — `webhook_events` table (Phase 1 D-16): exists but NOT used for call event idempotency in Phase 3 (upsert on calls.retell_call_id is the idempotency mechanism instead).

### External APIs (researcher MUST verify current docs before planning)
- **Retell AI v2 API docs** — verify: (1) exact event names (`call_ended` vs `call_analyzed`), (2) signature header name for webhook verification, (3) payload schema for each event (what fields does `call_analyzed` return for transcript, summary, recording_url, call duration), (4) retry policy and delivery guarantees. ROADMAP.md explicitly calls this out as a blocker.
- **OpenAI API** — GPT-4o-mini for classification, GPT-4o for extraction. Both require `OPENAI_API_KEY` env var (never `NEXT_PUBLIC_` prefix). Verify structured output (JSON mode or function calling) support for extraction schema.

### Existing Code Integration Points
- `src/lib/retell/client.ts` — Retell SDK singleton (already built Phase 2). Phase 3 uses `getRetellClient()` for any Retell API calls needed from webhook handler.
- `src/app/api/inngest/route.ts` — Inngest handler route already configured (Phase 2). Phase 3 adds new Inngest functions to the existing setup.
- `src/inngest/functions/retell-agent-sync.ts` — Pattern reference for Inngest function structure with `onFailure` and exponential backoff. Phase 3 classification retry function follows the same pattern.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/retell/client.ts` — `getRetellClient()` singleton, `import 'server-only'` pattern, `RETELL_API_KEY` guard — reuse directly in webhook handler
- `src/lib/supabase/` — `createServiceClient()` (service role, no user session needed for webhook processing) — webhook handler uses this
- `src/app/api/inngest/route.ts` — Inngest route already wired; just add new functions to the Inngest serve() call
- `src/inngest/functions/retell-agent-sync.ts` — Inngest function template with `onFailure` handler and retry config; analysis timeout job and classification retry follow this pattern

### Established Patterns
- `import 'server-only'` in all lib modules (Phase 2 cross-cutting constraint — enforced)
- `createServiceClient()` (service role) in API routes and Inngest functions only — never in client components
- `OPENAI_API_KEY` follows the same env var pattern as `RETELL_API_KEY`: never `NEXT_PUBLIC_`, checked at runtime with a clear error throw
- Return HTTP 200 immediately from webhook route → all downstream processing inside Vercel `waitUntil()` (locked in STATE.md — the most critical rule for Phase 3)
- RLS on every table — `notification_settings` migration must include all four operation policies

### Integration Points
- `contractors.retell_agent_id` — Phase 3 reads this to look up which contractor a call belongs to when Retell sends a webhook (call payload contains the agent_id)
- `contractor_settings.business_hours` — read in `call_ended` handler for after-hours detection
- `contractor_settings.emergency_keywords` — read during classification for contractor-specific keywords (hard-coded gas smell / CO alarm checked in code constants, not from DB)
- `notification_settings.notify_on_lead`, `.notify_on_emergency`, `.notify_on_general_inquiry` (Phase 3 migration) — Phase 5 reads these; Phase 3 sets the schema

</code_context>

<specifics>
## Specific Ideas

- **Hard-coded emergency keyword constants** (EMRG-02): maintain as TypeScript code constants (not DB) for both EN and ES: `HARD_EMERGENCY_KEYWORDS = { en: ['gas smell', 'co alarm', 'carbon monoxide', ...], es: ['olor a gas', 'alarma de co', ...] }`. These cannot be overridden by contractor configuration.
- **analysis_status progression example** — portal call log shows: "Analyzing..." (analyzing state) → caller name + intent (complete state) → "Analysis unavailable" (analysis_failed state).
- **notify_on_general_inquiry checkbox** — Phase 6 portal, in Notification Settings section: `[ ] Notify me on general inquiry calls` — default unchecked, matches `DEFAULT false` in schema.
- **DeepSeek rejected** — considered for LLM cost savings but rejected due to PII concern (call transcripts contain homeowner names, addresses, phone numbers; DeepSeek stores data on servers in China).
- **Multi-trade contractor extraction** — classification call returns `detected_trade` alongside `intent`; saves an extra LLM round-trip compared to a separate trade detection pass.

</specifics>

<deferred>
## Deferred Ideas

- **Recording proxy API `/api/recordings/:call_id`** — Phase 6 deliverable. Phase 3 only stores the Retell recording URL.
- **Supabase Realtime configuration** — Phase 6 sets up the subscription on the `calls` table.
- **Lead record creation** — Phase 4 deliverable. Phase 3 writes calls only; Phase 4 creates leads based on classification.
- **Notification dispatch** — Phase 5 deliverable. Phase 3 sets the schema (`notify_on_general_inquiry`); Phase 5 reads preferences and dispatches.
- **notify_on_general_inquiry UI checkbox** — Phase 6 portal deliverable.

</deferred>

---

*Phase: 3-Webhook Core*
*Context gathered: 2026-05-08*
