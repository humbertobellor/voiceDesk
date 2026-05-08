---
phase: 03-webhook-core
verified: 2026-05-08T07:30:00Z
status: human_needed
score: 8/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "End-to-end test call — verify a real call produces a persisted calls row"
    expected: "A test call to the Twilio number produces a calls row in Supabase with caller_phone, duration_seconds, transcript (JSONB), summary, intent classification, and analysis_status='complete' within 5 minutes"
    why_human: "Requires a live Retell agent registered with an active Twilio number and Supabase DB push applied. The supabase db push was auth-gated in Plan 01 — the migration SQL exists but live DB column existence is unconfirmed."
  - test: "EMRG-01 clarifying question — verify Retell agent script asks 'Is this happening right now?' for non-hard-coded emergency keywords"
    expected: "Caller says 'no heat' → agent asks clarifying question → caller says 'no' → classification is 'lead', not 'emergency'"
    why_human: "This is Retell agent runtime behavior. The system-prompt builder includes the instruction (confirmed in system-prompt.ts line 27) but the classification result ('lead' vs 'emergency' on 'no') depends on live LLM behavior, not testable with static analysis."
---

# Phase 3: Webhook Core Verification Report

**Phase Goal:** Every completed call is persisted with its transcript, summary, and intent classification — the product engine is running and auditable.
**Verified:** 2026-05-08T07:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/webhooks/retell returns 200 immediately for valid call_ended events without blocking on DB or OpenAI (CALL-01) | VERIFIED | route.ts: `after()` from next/server defers all processing; `return new Response('OK', {status:200})` fires before DB write; 5/5 webhook tests pass |
| 2 | POST /api/webhooks/retell returns 401 for invalid Retell signature (T-03-01) | VERIFIED | route.ts: `verify(rawBody, retellApiKey, signature)` called before `JSON.parse`; `req.text()` used (not `req.json()`); test case passes |
| 3 | classifyIntent returns valid intent enum ('lead'|'emergency'|'info'|'no_action') matching Phase 1 schema (CALL-02) | VERIFIED | ClassificationSchema uses `z.enum(['lead','emergency','info','no_action'])`; gpt-4o-mini model; zodResponseFormat enforces at parse time; 13 classification tests pass |
| 4 | extractTradeData returns trade-specific fields (HVAC/plumbing/electrical) by detected_trade (CALL-03) | VERIFIED | extract-trade.ts: HvacSchema, PlumbingSchema, ElectricalSchema, GeneralSchema; gpt-4o model; returns null for no_action (D-13); tests pass |
| 5 | detectAfterHours returns correct boolean for contractor-configured business hours including DST (CALL-04) | VERIFIED | detect.ts: toZonedTime() from date-fns-tz; 6 tests pass including DST edge case; processCallEnded writes is_after_hours |
| 6 | Gas smell and CO alarm keywords always produce emergency — non-overridable (EMRG-02) | VERIFIED | hasHardEmergencyKeyword checked in Inngest step-1 before LLM; `finalIntent = hardEmergency ? 'emergency' : classification.intent`; EN+ES+HT keywords present (HT was added beyond plan scope) |
| 7 | Other emergency keywords trigger clarifying question before emergency classification (EMRG-01) | VERIFIED (partial) | system-prompt.ts line 27: `"If the caller mentions any of these, ask 'Is this happening right now?' before classifying as an emergency"` — instruction exists in Retell agent prompt; LLM runtime behavior requires human test |
| 8 | Duplicate webhook delivery produces exactly one calls row — idempotency (SC-5) | VERIFIED | Both processCallEnded and processCallAnalyzed use `upsert({...}, { onConflict: 'retell_call_id' })`; test case confirms |
| 9 | supabase db push applied — analysis_status and notify_on_general_inquiry columns exist in live DB | UNCERTAIN | Migration SQL file exists and is correct; Plan 01 documented auth-gate — `supabase db push` could not complete without user running it manually. Columns may or may not exist in live DB. |
| 10 | After-hours calls produce is_after_hours=true and use after-hours script branch (SC-4) | VERIFIED (partial — code path confirmed) | processCallEnded calls detectAfterHours and writes is_after_hours; system-prompt.ts includes after-hours message branch; live call behavior requires human test |

**Score:** 8/10 truths verified (2 require human/have uncertainty)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260508000007_webhook_core.sql` | analysis_status + notify_on_general_inquiry columns | VERIFIED | File exists; contains `ADD COLUMN IF NOT EXISTS analysis_status` and `ADD COLUMN IF NOT EXISTS notify_on_general_inquiry` |
| `src/lib/retell/webhook-types.ts` | RetellCallPayload, RetellWebhookEvent typed interfaces | VERIFIED | Exists; `import 'server-only'`; call_summary in call_analysis, duration_ms, transcript_object all present |
| `src/lib/openai/client.ts` | getOpenAIClient() singleton with env guard | VERIFIED | Exists; `import 'server-only'`; throws on missing OPENAI_API_KEY; no NEXT_PUBLIC_ prefix |
| `src/lib/classification/emergency-keywords.ts` | HARD_EMERGENCY_KEYWORDS + hasHardEmergencyKeyword | VERIFIED | Exists; EN+ES+HT keywords; case-insensitive match; `import 'server-only'` |
| `src/lib/after-hours/detect.ts` | detectAfterHours() DST-safe | VERIFIED | Exists; toZonedTime() from date-fns-tz; 6 tests GREEN |
| `src/lib/classification/classify-intent.ts` | classifyIntent + ClassificationSchema | VERIFIED | Exists; gpt-4o-mini; zodResponseFormat; `.nullish()` on optional fields |
| `src/lib/classification/extract-trade.ts` | extractTradeData per-trade schemas | VERIFIED | Exists; gpt-4o; HvacSchema/PlumbingSchema/ElectricalSchema/GeneralSchema; returns null for no_action |
| `src/app/api/webhooks/retell/route.ts` | POST handler — verify + 200 + after() | VERIFIED | Exists; `import 'server-only'`; maxDuration=30; runtime='nodejs'; req.text() before verify(); after() dispatch |
| `src/app/api/webhooks/retell/handlers.ts` | processCallEnded + processCallAnalyzed | VERIFIED | Exists; retell_agent_id lookup (T-03-02); onConflict:'retell_call_id' (D-05); call_analysis?.call_summary (D-09); transcript_object stored in JSONB |
| `src/inngest/functions/retell-call-classify.ts` | retellCallClassify event-triggered function | VERIFIED | Exists; retries:5; hasHardEmergencyKeyword in step-1; hardEmergency overrides LLM; onFailure sets analysis_failed |
| `src/inngest/functions/retell-analysis-timeout.ts` | retellAnalysisTimeout cron every 5 minutes | VERIFIED | Exists; `*/5 * * * *` cron; 30-minute guard; marks analysis_failed |
| `src/app/api/inngest/route.ts` | serve() with all three functions | VERIFIED | Imports and registers retellAgentSync + retellCallClassify + retellAnalysisTimeout |
| `tests/api/webhook.test.ts` | 5 webhook tests (all GREEN) | VERIFIED | 5/5 passing; no "not yet implemented" stubs |
| `tests/lib/classification.test.ts` | 13 classification tests (all GREEN) | VERIFIED | 13/13 passing |
| `tests/lib/after-hours.test.ts` | 6 after-hours tests (all GREEN) | VERIFIED | 6/6 passing |
| `tests/__mocks__/openai.ts` | Vitest OpenAI mock | VERIFIED | Exists; prevents real API calls |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| route.ts | handlers.ts | `import { processCallEnded, processCallAnalyzed } from './handlers'` | WIRED | Both imports present and used |
| handlers.ts | contractors table | `.eq('retell_agent_id', call.agent_id)` | WIRED | T-03-02: two lookups in handlers.ts both use retell_agent_id |
| handlers.ts | calls table | `.upsert({...}, { onConflict: 'retell_call_id' })` | WIRED | D-05: both processCallEnded and processCallAnalyzed |
| classify-intent.ts | openai/client.ts | `import { getOpenAIClient } from '@/lib/openai/client'` | WIRED | Import present; getOpenAIClient() called in classifyIntent |
| retell-call-classify.ts | emergency-keywords.ts | `import { hasHardEmergencyKeyword }` | WIRED | Import present; called in step-1 'check-hard-emergency' |
| handlers.ts | retell-call-classify (Inngest) | `inngest.send({ name: 'retell/call.classify', ... })` | WIRED | processCallAnalyzed fires event with callId, contractorId, transcriptText, durationMs |
| retell-call-classify.ts | calls table | `.update({ intent, analysis_status: 'complete' }).eq('id', callId)` | WIRED | persist-classification step confirmed |
| retell-analysis-timeout.ts | calls table | `.update({ analysis_status: 'analysis_failed' }).eq('analysis_status', 'analyzing').lt('created_at', thirtyMinutesAgo)` | WIRED | mark-stale-analyzing step confirmed |
| inngest/route.ts | retellCallClassify + retellAnalysisTimeout | `serve({ functions: [...] })` | WIRED | Both imported and registered in functions array |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| handlers.ts processCallEnded | contractor (id, timezone, business_hours) | `db.from('contractors').eq('retell_agent_id')` | Yes — live DB query | FLOWING |
| handlers.ts processCallEnded | calls row | `db.from('calls').upsert(...)` | Yes — writes transcript, intent, status | FLOWING |
| handlers.ts processCallAnalyzed | summary | `call.call_analysis?.call_summary` | Yes — from Retell payload | FLOWING |
| handlers.ts processCallAnalyzed | transcript | `call.transcript_object` (JSONB) | Yes — from Retell payload | FLOWING |
| retell-call-classify.ts | classification | `classifyIntent(transcriptText, isShortCall)` | Yes — real OpenAI call (mocked in tests) | FLOWING |
| retell-call-classify.ts | tradeData | `extractTradeData(transcriptText, detectedTrade)` | Yes — skipped for no_action; real GPT-4o otherwise | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 23 Phase 3 tests pass | `npx vitest run tests/api/webhook.test.ts tests/lib/classification.test.ts tests/lib/after-hours.test.ts` | 3 files, 23 tests, all passed | PASS |
| No stub tests remain | `grep 'not yet implemented' tests/api/webhook.test.ts tests/lib/classification.test.ts tests/lib/after-hours.test.ts` | No output | PASS |
| EMRG-02 hard override logic | `grep 'finalIntent.*hardEmergency\|hardEmergency.*emergency'` in retell-call-classify.ts | `const finalIntent = hardEmergency ? 'emergency' : classification.intent` | PASS |
| verify() before JSON.parse | `grep 'req.text()'` in route.ts | `const rawBody = await req.text()` — called before `JSON.parse(rawBody)` | PASS |
| Inngest serve() registers both new functions | `grep 'retellCallClassify\|retellAnalysisTimeout'` in inngest/route.ts | Both imported and in functions array | PASS |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| CALL-01 | 03-01, 03-03 | AI answers every inbound call; webhook returns 200 | SATISFIED | route.ts returns 200 before any async work; after() defers processing |
| CALL-02 | 03-01, 03-03, 03-04 | Classifies as lead/emergency/info/no_action | SATISFIED | ClassificationSchema enum matches DB CHECK constraint; zodResponseFormat enforces; 13 tests pass |
| CALL-03 | 03-01, 03-03 | Trade-specific qualification questions captured | SATISFIED | extractTradeData returns HVAC/plumbing/electrical schemas; stored in raw_metadata |
| CALL-04 | 03-01, 03-02 | After-hours detection with configured windows | SATISFIED | detectAfterHours DST-safe; processCallEnded writes is_after_hours; 6 tests pass |
| EMRG-01 | 03-01, 03-04 | Emergency keywords trigger clarifying question; non-confirmation classified as lead | PARTIAL — system-prompt instruction confirmed; live agent behavior requires human test | system-prompt.ts line 27 includes "ask 'Is this happening right now?'" |
| EMRG-02 | 03-01, 03-02, 03-04 | Gas/CO alarm always emergency — non-configurable | SATISFIED | hasHardEmergencyKeyword in Inngest step-1; overrides LLM unconditionally; EN+ES+HT keywords |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | No TODO/FIXME/placeholder/stub patterns in implementation files | Info | No blockers |

All `import 'server-only'` guards present on all 10 implementation files. No `NEXT_PUBLIC_` prefix on actual environment variable keys. The `NEXT_PUBLIC_` text in `src/lib/openai/client.ts` line 3 is a warning comment, not an actual prefixed key.

---

### Human Verification Required

#### 1. Supabase DB Push — Live Column Existence

**Test:** Run `supabase db push` with valid credentials (PAT or --db-url), then verify columns exist:
```bash
curl -s "https://sbkfhwybkwmbevcfzwdv.supabase.co/rest/v1/calls?select=analysis_status&limit=1" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```
**Expected:** Returns `[]` or a data array with `analysis_status` field present — no "column does not exist" error.
**Why human:** `supabase db push` was auth-gated in Plan 01 (access token expired). The migration SQL is correct and ready. Without the columns in the live DB, the webhook handler will fail at runtime on DB writes. All downstream Phase 4 work depends on this.

#### 2. EMRG-01 Clarifying Question — Live Agent Behavior

**Test:** Call the provisioned Twilio number. Say "I have no heat in my house." Wait for agent response.
**Expected:** Agent asks "Is this happening right now?" (or equivalent clarifying question). If caller says "No, I just want a checkup," the final classification in the calls row should be `intent='lead'`, not `intent='emergency'`.
**Why human:** The clarifying question is in the Retell agent system prompt (`system-prompt.ts` line 27), but the LLM's ability to correctly route a "no" answer to `lead` rather than `emergency` requires runtime behavioral testing. Phase 2 (provisioning) must be complete for a live number to exist.

#### 3. After-Hours Script Branch — Live Call Behavior

**Test:** Place a test call outside the contractor's configured business hours.
**Expected:** Agent uses after-hours message (from `contractor_settings.after_hours_message`); calls row has `is_after_hours=true`.
**Why human:** Code path is confirmed (detectAfterHours wired in processCallEnded; system-prompt includes after-hours branch), but runtime verification requires a live call with after-hours timing.

---

### Gaps Summary

No blocking gaps found in the codebase itself. All 13 required artifacts exist and are substantively implemented. All key wiring links are connected. 23 tests pass. No stub implementations remain.

**One outstanding human-action item** (not a code gap): `supabase db push` was not applied during Plan 01 execution due to an authentication gate. The migration SQL file `supabase/migrations/20260508000007_webhook_core.sql` is correct and ready. The ROADMAP marks Plan 03-01 as complete (`[x]`), but the "BLOCKING" task within it (Task 2) was not executed.

**Recommendation:** Run `supabase db push` before proceeding to Phase 4. Phase 4 writes to `calls.analysis_status` and depends on that column existing.

---

_Verified: 2026-05-08T07:30:00Z_
_Verifier: Claude (gsd-verifier)_
