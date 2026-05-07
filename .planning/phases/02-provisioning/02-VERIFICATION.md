---
phase: 02-provisioning
verified: 2026-05-07T07:10:00Z
status: human_needed
score: 3/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Call POST /api/provisioning/create with a valid RETELL_API_KEY, a provisioned Supabase contractor row, and area_code '305'. Then dial the returned phone number."
    expected: "The call is answered by the Retell AI agent within 3 rings — not voicemail."
    why_human: "Requires live Retell + Twilio credentials, a real phone number purchase, and an actual inbound call. Cannot be verified by static analysis or unit tests."
  - test: "After provisioning, dial the returned number and listen to the greeting."
    expected: "The Retell agent opens with the contractor's configured business name (e.g., 'Thank you for calling Miami HVAC Pro')."
    why_human: "End-to-end voice behavior requires live Retell agent activation with real credentials. The code that builds the greeting is verified; the live agent behavior is not."
---

# Phase 2: Provisioning Verification Report

**Phase Goal:** Each contractor has a dedicated Twilio phone number imported into Retell, and a Retell agent running their configured system prompt — so inbound calls can actually be answered.
**Verified:** 2026-05-07T07:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After completing provisioning, a contractor has a unique Twilio number visible in their account | VERIFIED | `POST /api/provisioning/create` calls `retell.phoneNumber.create()`, writes `twilio_number` and `twilio_number_sid` (E.164) to contractors row, and returns `{ twilio_number, retell_agent_id }`. DB update verified in route.ts lines 117–126. Unit test (test 5) confirms 200 response with `twilio_number`. |
| 2 | A test call to that number is answered by the Retell AI agent (not voicemail) within 3 rings | HUMAN NEEDED | Static analysis confirms the agent is created and bound via `inbound_agents: [{ agent_id }]` in `phoneNumber.create()`. Live call behavior requires live credentials and an actual phone call — cannot be verified programmatically. |
| 3 | The Retell agent uses the contractor's configured business name and service list in its greeting | HUMAN NEEDED | `buildSystemPrompt` and `buildBeginMessage` both interpolate `settings.business_name` into the greeting strings (system-prompt.ts lines 18, 23, 38, 40). Unit tests confirm the business name appears in the generated prompt. However, whether the live Retell agent actually delivers this greeting requires a real call. |
| 4 | The provisioned number and Retell agent ID are stored in the contractor's DB row and retrievable via the server API | VERIFIED | `create/route.ts` persists `retell_agent_id`, `retell_llm_id`, `twilio_number`, `twilio_number_sid`, and `agent_sync_status='synced'` to contractors table in a single update call (lines 115–126). `update-agent/route.ts` loads contractor including `retell_llm_id` via service role client — it is queryable. |

**Score:** 2/4 truths fully verified by static analysis; 2/4 require human verification (both concern live call behavior, not missing implementation). Per roadmap criteria, SC#1 and SC#4 are VERIFIED at the code level; SC#2 and SC#3 are blocked on live testing.

### Deferred Items

None — all truths are either verified or require human testing of implemented code.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260506000004_agent_sync_status.sql` | Migration adding agent_sync_status + retell_llm_id columns, removing HC | VERIFIED | File exists with correct ADD COLUMN statements (lines 9–13), data migration before constraint change (lines 15–23), HC removal from CHECK constraints (lines 31–57). |
| `src/types/database.ts` | Language = 'en' \| 'es'; Contractor with retell_llm_id + agent_sync_status; EmergencyKeywords without ht | VERIFIED | Language type on line 5 is 'en' \| 'es'. Contractor interface has retell_llm_id (line 26) and agent_sync_status (line 27). EmergencyKeywords has only en and es fields (lines 53–56). |
| `src/lib/retell/client.ts` | getRetellClient() server-only singleton; toRetellLanguage() mapper | VERIFIED | File exists, `import 'server-only'` on line 5. Exports getRetellClient (line 22) and toRetellLanguage (line 14). RETELL_API_KEY guard at line 25. Singleton via `let _client: Retell | null = null`. |
| `src/lib/retell/system-prompt.ts` | buildSystemPrompt + buildBeginMessage with language branching | VERIFIED | File exists. Both functions exported. Spanish branching via `hasSpanish` flag. "Para español, oprima dos" in both functions. business_name, after_hours_message, emergency_keywords.en, trade_type, service_area all interpolated. |
| `src/inngest/client.ts` | Inngest singleton id 'voicedesk', server-only | VERIFIED | `import 'server-only'` line 5. `export const inngest = new Inngest({ id: 'voicedesk' })` line 8. |
| `src/inngest/functions/retell-agent-sync.ts` | Durable function, event 'retell/agent.sync', retries:5, onFailure | VERIFIED | triggers: [{ event: 'retell/agent.sync' }] (line 16). retries: 5 (line 15). onFailure sets agent_sync_status='failed' (lines 17–26). NonRetriableError guard (lines 37–41). Two durable steps: patch-retell-llm and set-synced-status. |
| `src/app/api/inngest/route.ts` | GET, POST, PUT from serve() | VERIFIED | `export const { GET, POST, PUT } = serve({ client: inngest, functions: [retellAgentSync] })` (lines 10–13). |
| `src/app/api/provisioning/create/route.ts` | POST: LLM → agent → phoneNumber → DB, 401/400/404/409/422/200 | VERIFIED | Full provisioning sequence implemented in correct order. All error responses present. DB write is last after all three Retell calls succeed (line 115). Area code zod regex `/^\d{3}$/` (line 19). |
| `src/app/api/provisioning/update-agent/route.ts` | PATCH: DB-first, pending before Retell, Inngest retry, always 200 | VERIFIED | agent_sync_status='pending' written before Retell call (lines 44–48). Inngest retry on failure (lines 66–75). Always returns `{ ok: true }` (line 79). JWT-based auth, never accepts contractor_id from body. |
| `tests/api/provisioning.test.ts` | 10 unit tests GREEN | VERIFIED | All 10 tests pass: 5 for POST (401/400/409/422/200) + 5 for PATCH (401/404/200-fail/200-ok/call-order). Test run confirmed 10/10 passing. |
| `tests/lib/retell-language-mapper.test.ts` | 4 unit tests for toRetellLanguage | VERIFIED | 4 tests pass. Verified by test run. |
| `tests/lib/system-prompt.test.ts` | 7 unit tests for buildSystemPrompt + buildBeginMessage | VERIFIED | 7 tests pass. Verified by test run. |
| `tests/lib/validations.test.ts` | HC cleanup — 'ht' rejected | VERIFIED | 2 tests pass — languageSchema rejects ['ht'], accepts ['en'] and ['en','es']. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `create/route.ts` | `retell.llm.create()` → `retell.agent.create()` → `retell.phoneNumber.create()` | getRetellClient() + Retell SDK | WIRED | Lines 63–109 show correct call sequence. phoneNumber.create binds inbound_agents at creation. |
| `create/route.ts` | `contractors` table (all IDs) | createServiceRoleClient().from('contractors').update() | WIRED | Lines 115–126 persist retell_agent_id, retell_llm_id, twilio_number, twilio_number_sid, agent_sync_status. Verified. |
| `update-agent/route.ts` | `inngest.send('retell/agent.sync')` | import inngest from '@/inngest/client' | WIRED | Lines 19 (import), 66–75 (catch block sends event). Inngest module present at src/inngest/client.ts. |
| `update-agent/route.ts` | `contractors.agent_sync_status = 'pending'` before Retell call | sequential await calls | WIRED | Lines 44–48 (pending write) precede line 56 (retell.llm.update call). Call-order test in provisioning.test.ts confirms this ordering executes correctly. |
| `retell-agent-sync.ts` | `getRetellClient()` from '@/lib/retell/client' | import statement line 9 | WIRED | Import verified. Usage in step.run('patch-retell-llm') at line 46. |
| `retell-agent-sync.ts` | `contractors.agent_sync_status` | createServiceRoleClient().from('contractors').update() | WIRED | onFailure sets 'failed' (lines 17–26); step 'set-synced-status' sets 'synced' (lines 61–71). |
| `src/app/api/inngest/route.ts` | `retellAgentSync` registered | serve({ functions: [retellAgentSync] }) | WIRED | Line 12. Import on line 8. |
| `package.json` | retell-sdk@5.18.0 | npm install | WIRED | `"retell-sdk": "^5.18.0"` confirmed in package.json. |
| `package.json` | inngest@4.3.0 | npm install | WIRED | `"inngest": "^4.3.0"` confirmed in package.json. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `create/route.ts` | `llm`, `agent`, `phone` (Retell responses) | `retell.llm.create()`, `retell.agent.create()`, `retell.phoneNumber.create()` | Yes — live Retell API calls with real env key | FLOWING (at runtime with credentials) |
| `create/route.ts` | `settings` (contractor config) | DB join via `contractor_settings(*)` | Yes — reads from live contractor_settings row | FLOWING |
| `update-agent/route.ts` | `settings` | DB read via `contractor_settings(*)` join | Yes — reads already-persisted settings | FLOWING |
| `system-prompt.ts` | `buildSystemPrompt` output | ContractorSettings fields | Yes — uses business_name, trade_type, service_area, emergency_keywords.en, after_hours_message | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 10 provisioning unit tests pass | `npx vitest run tests/api/provisioning.test.ts` | 10/10 passed | PASS |
| 11 lib unit tests pass (language mapper + system prompt) | `npx vitest run tests/lib/` | 18/18 passed (includes crypto + validations tests) | PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | Exit 0, no output | PASS |
| agent_sync_status='pending' set before Retell call | Call-order test in provisioning.test.ts | callOrder: ['pending', 'retell', 'synced'] confirmed | PASS |
| 422 response includes '786', '954', '561' | Test case in provisioning.test.ts | body.error contains all three area codes | PASS |
| toRetellLanguage(['en']) === 'en-US' | Unit test in retell-language-mapper.test.ts | PASS | PASS |
| buildSystemPrompt includes 'Para español, oprima dos' when Spanish enabled | Unit test in system-prompt.test.ts | PASS | PASS |

Step 7b: Behavioral spot-checks for live API calls are SKIPPED — requires live Retell + Twilio credentials and cannot be verified without starting the server (routed to human verification).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LANG-01 | 02-01a, 02-01b, 02-02, 02-03, 02-04 | Agent detects/prompts for caller language; schema precondition Phase 1, runtime Phase 2–3 | PARTIAL | Schema precondition: Language type narrowed to 'en'\|'es', system prompt builder has EN/ES branching, toRetellLanguage mapper verified. Runtime behavior (caller language detection during live call) is a Phase 3 responsibility. Phase 2 delivers the infrastructure layer required. |
| LANG-02 | 02-01b | HC support removed (Out of Scope D-01) | SATISFIED (Out of Scope) | REQUIREMENTS.md marks LANG-02 as "Out of Scope (D-01 Phase 2 — HC removed from product)". Language type, zod schema, UI form, DB constraint all updated. 'ht' removed from all functional code paths. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/(dashboard)/settings/agent/page.tsx` | 37 | Stale UI description text mentions "Haitian Creole" | INFO | UI help text still says "Choose the languages your AI receptionist will speak (English, Spanish, Haitian Creole)". This is a documentation inconsistency — the functional code (LanguageSettingsForm, zod schema, Language type) is fully cleaned up. The 'ht' code is not present anywhere in the control flow. Presents incorrect information to the contractor in Phase 6. |

No functional stubs found in any implementation file. No TODO/FIXME markers in the 7 core implementation files. No hardcoded empty data returns. All `return null` / `return {}` patterns are typed response objects (e.g., `NextResponse.json({ ok: true })`), not placeholder stubs.

### Human Verification Required

#### 1. Live test call — Retell agent answers within 3 rings

**Test:** Complete provisioning by calling `POST /api/provisioning/create` with a valid `RETELL_API_KEY` in environment, an existing contractor row in Supabase, and body `{ "area_code": "305" }`. Dial the returned `twilio_number` from a mobile phone.
**Expected:** The call is answered by the Retell AI voice agent (not voicemail, not a busy signal) within 3 rings. The call does not route to the contractor's personal phone — it is handled by Retell's infrastructure.
**Why human:** Requires live Retell + Twilio credentials, an actual phone number purchase via Retell's API, and an inbound call placed from a real device. No static analysis or unit test can substitute for this.

#### 2. Agent greeting uses configured business name

**Test:** On the same call placed in test #1, listen to the agent's opening message.
**Expected:** The greeting matches the contractor's `business_name` from `contractor_settings` — e.g., "Thank you for calling [business_name]." The `service_list` (trade type and service area) should be available in the prompt, though the exact wording depends on Retell's interpretation of the system prompt.
**Why human:** The code that builds the greeting (`buildBeginMessage`) is verified by unit tests to include `business_name`. Whether the live Retell agent faithfully delivers this greeting requires a real call — Retell's voice synthesis and prompt interpretation cannot be tested statically.

### Gaps Summary

No code-level gaps were identified. All four success criteria are implemented in the codebase:

- SC#1 (unique phone number stored): Fully implemented and unit-tested.
- SC#2 (call answered by agent): Code path implemented (`inbound_agents` binding in `phoneNumber.create()`). Cannot be verified without live credentials.
- SC#3 (agent uses business name in greeting): `buildSystemPrompt` and `buildBeginMessage` both interpolate `business_name`. Seven unit tests verify the output. Live verification needed.
- SC#4 (IDs stored and retrievable): All IDs (`retell_agent_id`, `retell_llm_id`, `twilio_number`, `twilio_number_sid`) written to contractors row and readable via server API. Fully verified.

The two human verification items are about live call behavior, not missing implementation. The infrastructure is present and correct.

**Stale text warning:** `src/app/(dashboard)/settings/agent/page.tsx` line 37 still mentions "Haitian Creole" in a UI description paragraph. This is not a functional blocker but should be corrected before Phase 6 portal work begins so contractors see accurate information.

---

_Verified: 2026-05-07T07:10:00Z_
_Verifier: Claude (gsd-verifier)_
