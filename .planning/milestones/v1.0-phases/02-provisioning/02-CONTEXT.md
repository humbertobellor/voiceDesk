# Phase 2: Provisioning - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers: a provisioning service that gives each contractor a dedicated Twilio phone number (imported into Retell via the managed Twilio integration) and a Retell AI agent running a system prompt compiled from the contractor's configured settings. After Phase 2, a contractor can receive an inbound call answered by the Retell agent.

Phase 2 also includes a cleanup pass removing Haitian Creole support (added in Phase 1 schema) from the product scope entirely.

**No UI in this phase** — provisioning is triggered by a server-side API route; Phase 7's onboarding wizard calls it. No standalone provisioning UI.

</domain>

<decisions>
## Implementation Decisions

### Haitian Creole Removal

- **D-01:** Haitian Creole (HC) is removed from the product scope entirely. Phase 2 performs a full cleanup: remove 'ht' from `supported_languages` UI options, remove 'ht' from `contractor_settings` defaults, remove HC references from system prompt templates, and update REQUIREMENTS.md (LANG-02 moved to Out of Scope). Language support going forward: English + Spanish only.
- **D-02:** The language-selection UI retains the two-checkbox pattern from Phase 1 — one checkbox for English, one for Spanish. HC checkbox is removed. This keeps the pattern flexible for future language additions (e.g., Portuguese) without requiring a redesign.
- **D-03:** Emergency keywords JSONB structure (`emergency_keywords` column in `contractor_settings`) stays as-is — object format `{ en: [...], es: [...] }`. The 'ht' key is removed from default seed values. No schema migration needed.

### System Prompt Design

- **D-04:** Default persona and tone: **professional + warm receptionist**. Greeting pattern: "Thank you for calling [business_name], this is [agent_voice] your AI receptionist. How can I help you today?" Formal enough for home-service contractors, warm enough for homeowners in stressful situations.
- **D-05:** Multi-language handling: **single Retell agent per contractor** with language branching inside the prompt. If Spanish is enabled, the greeting includes "Para español, oprima dos" and the prompt instructs the agent to switch fully to Spanish for the remainder of the call if selected. No separate agents per language — one agent ID per contractor simplifies management.
- **D-06:** Out-of-scope questions (e.g., caller asks about a service not offered): agent redirects and offers to take a message — "I'm not able to help with that directly, but I can take your contact info and have the team follow up with you." Never end the call without capturing the lead.
- **D-07:** After-hours behavior: use contractor's `after_hours_message` to acknowledge off-hours, but **still capture the lead** (name, phone, issue). Prompt does NOT end the call early for after-hours callers. This directly satisfies CALL-04: "still captures lead and offers scheduling for next available slot."

### Area Code / Number Provisioning

- **D-08:** Area code input is a free text field, pre-filled with `'305'` as the default (Miami-Dade focus for South Florida launch). Contractor can change it. The provisioning API searches Twilio for the first available local number in the specified area code and purchases it.
- **D-09:** Provisioning trigger: **API route only** — `POST /api/provisioning/create`. No UI in Phase 2. Phase 7's onboarding wizard calls this endpoint after contractor completes agent configuration. Auto-provisioning on account creation is NOT implemented; provisioning is intentionally deferred to Phase 7's guided wizard.
- **D-10:** If Twilio has no available numbers in the requested area code, the API returns a clear error response. Contractor tries a different area code. No auto-fallback to adjacent codes; no toll-free fallback. South Florida alternatives to suggest in error message: 786 (Miami-Dade overlay), 954 (Broward), 561 (Palm Beach).

### Agent Re-Sync on Config Changes

- **D-11:** When a contractor updates their agent settings (business name, services, language, emergency keywords, after-hours message, voice), Phase 2 exposes `PATCH /api/provisioning/update-agent` for on-demand re-sync. Phase 6's settings save flow calls this endpoint after persisting to Supabase.
- **D-12:** Retell API failure handling on settings save: settings are **always persisted to Supabase first** (DB is source of truth). If the Retell API call fails, an Inngest job is queued for retry silently — no error shown to the contractor for transient failures. If all Inngest retries exhaust, the `contractors` table is updated with `agent_sync_status = 'failed'` and the portal shows a persistent sync-failed banner: "Agent sync failed — your live agent may be outdated. Reload or contact support."

### Claude's Discretion

- Retell API call sequencing (which Retell endpoints to call, in what order, to import a Twilio number and create an agent) — researcher will verify against current Retell v2 docs before planning
- System prompt template wording beyond the tone/behavior decisions locked above — Claude writes the template following D-04 through D-07
- Exact Inngest retry backoff and max-retries for agent re-sync — standard exponential backoff, max 5 retries

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Foundation
- `.planning/PROJECT.md` — Project context, stack, constraints
- `.planning/REQUIREMENTS.md` — All v1 requirements; LANG-01, CALL-01, ONBOARD-01, ONBOARD-02 are the requirements this phase enables (no standalone Phase 2 REQ-IDs)
- `.planning/ROADMAP.md` Phase 2 section — Success criteria and critical notes for Provisioning
- `.planning/STATE.md` — Current phase state

### Prior Phase Decisions
- `.planning/phases/01-foundation/01-CONTEXT.md` — Language config decisions (D-04–D-07), agent settings schema (D-08–D-11), contractor_settings columns, all foundational patterns

### Schema
- `supabase/migrations/20260504000001_initial_schema.sql` — `contractors` table: `twilio_number`, `twilio_number_sid`, `retell_agent_id`, `area_code` columns are already defined here; no migration needed for provisioning fields
- `supabase/migrations/20260504000003_contractor_defaults.sql` — Default seed values for contractor_settings; Phase 2 cleanup removes 'ht' from language defaults here

### External APIs (researcher must verify current docs before planning)
- Retell AI v2 SDK — verify exact API call sequence for: (1) linking Twilio SID + Auth Token, (2) importing a Twilio number, (3) creating an agent with a system prompt. ROADMAP.md explicitly requires Retell managed Twilio integration (NOT raw TwiML/SIP)
- Twilio Number Provisioning API — `availablePhoneNumbers` (local search by area code) + `incomingPhoneNumbers` (purchase)

### No external specs — requirements fully captured in decisions above

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/api/onboarding/create-account/` — Existing API route pattern for account creation; provisioning routes follow the same server-side-only Supabase client pattern
- `src/lib/supabase/` — Server Supabase client (service role) already configured; use `createServiceClient()` for provisioning API routes (no user context needed for Twilio/Retell calls)
- AES-256-GCM encryption utility (Phase 1) — Available for any secrets; Twilio/Retell credentials live in env vars (not encrypted in DB), so this utility is not needed in Phase 2

### Established Patterns
- All API routes use server-side Supabase client only — service role key never reaches the browser (Critical Rule #3)
- `contractor_settings` uses discrete columns (not JSONB blob) per D-08 from Phase 1
- `emergency_keywords` stored as JSONB `{ en: [...], es: [...] }` per D-07 (Phase 1) / D-03 (Phase 2)

### Integration Points
- `contractors.retell_agent_id` and `contractors.twilio_number` are written by Phase 2's provisioning route; Phase 3's webhook handler reads these to associate incoming calls with contractors
- `contractor_settings.supported_languages`, `.business_name`, `.trade_type`, `.service_area`, `.business_hours`, `.emergency_keywords`, `.after_hours_message`, `.agent_voice` are read by Phase 2 to compile the Retell system prompt
- `contractor_settings.supported_languages` UI component (Phase 1): HC checkbox removed in Phase 2 cleanup

</code_context>

<specifics>
## Specific Ideas

- **South Florida default area code:** Pre-fill area code input with `305` on the provisioning form (Phase 7 wizard). Error message for unavailable codes should list `786`, `954`, `561` as alternatives.
- **Single agent architecture:** One Retell agent per contractor (not per language) — this simplifies `retell_agent_id` storage (single column, already in schema) and the update-agent endpoint.
- **Language greeting example (when Spanish enabled):** "Thank you for calling [business_name]. For English, stay on the line. Para español, oprima dos."
- **Sync-failed banner:** `agent_sync_status TEXT` column needs to be added to `contractors` table (or `contractor_settings`) if not already present — researcher should check existing schema and add migration if needed.

</specifics>

<deferred>
## Deferred Ideas

- **Toll-free number option** — Contractor preference for 800/888 numbers. Deferred to v2; local area codes are the right default for South Florida home-service contractors.
- **Number porting** — Contractor wants to keep their existing business number. Complex Twilio porting flow; deferred to post-PMF.
- **Multiple Retell agents per language** — Separate EN/ES agents for stronger language isolation. Deferred; single-agent with prompt branching is sufficient for v1.
- **Haitian Creole re-enablement** — If South Florida market data later shows strong HC demand, the JSONB schema structure supports re-adding 'ht' keys without a migration.

</deferred>

---

*Phase: 2-Provisioning*
*Context gathered: 2026-05-05*
