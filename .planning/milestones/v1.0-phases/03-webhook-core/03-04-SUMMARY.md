---
phase: 03-webhook-core
plan: "04"
subsystem: inngest-classification
tags: [inngest, classification, emergency, cron, webhook]
dependency_graph:
  requires:
    - "03-03"  # classify-intent, extract-trade, handlers.ts
    - "02-02"  # retell-agent-sync (Inngest route structure reference)
  provides:
    - retell-call-classify Inngest function (retell/call.classify event)
    - retell-analysis-timeout cron (*/5 * * * *)
    - Inngest serve() with all three Phase 2+3 functions
  affects:
    - calls table (analysis_status: analyzing → complete | analysis_failed)
tech_stack:
  added: []
  patterns:
    - Inngest createFunction with step.run pipeline
    - EMRG-02 hard-coded keyword override before LLM
    - Inngest cron trigger for stale-row cleanup
key_files:
  created:
    - src/inngest/functions/retell-call-classify.ts
    - src/inngest/functions/retell-analysis-timeout.ts
  modified:
    - src/app/api/inngest/route.ts
decisions:
  - "D-06/EMRG-02: hasHardEmergencyKeyword checked in step 1 — result stored in hardEmergency, overrides classification.intent before DB write"
  - "D-13: isShortCall = durationMs < 15000 — passed to classifyIntent; no_action skips extractTradeData"
  - "D-04: 30-minute guard implemented as cron, not as webhook-side timeout — idempotent and safe to re-run"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-08T11:15:56Z"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 3 Plan 4: Inngest Classification Pipeline Summary

Durable Inngest classification pipeline — two-step LLM classification (GPT-4o-mini intent + GPT-4o trade extraction) with EMRG-02 hard-code override, 5-retry semantics, onFailure status update, and a 5-minute cron safety net for stale analysis rows.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | retell-call-classify.ts + retell-analysis-timeout.ts | 91f33da | src/inngest/functions/retell-call-classify.ts, src/inngest/functions/retell-analysis-timeout.ts |
| 2 | Register Inngest functions + full phase test suite | 3bea41e | src/app/api/inngest/route.ts |

## What Was Built

### retell-call-classify.ts
Event-triggered Inngest function that processes `retell/call.classify` events fired by `processCallEnded` in `handlers.ts`. Implements the full 4-step pipeline:

1. **step: check-hard-emergency** — calls `hasHardEmergencyKeyword(transcriptText)` synchronously. EMRG-02: result is stored in `hardEmergency` variable and cannot be overridden.
2. **step: classify-intent** — calls `classifyIntent(transcriptText, isShortCall)` where `isShortCall = durationMs < 15000` (D-13).
3. **step: extract-trade-data** — calls `extractTradeData()` only when `finalIntent !== 'no_action'` (D-13: skip for no-action to avoid wasted API calls).
4. **step: persist-classification** — writes `{ intent: finalIntent, raw_metadata: tradeData, analysis_status: 'complete' }` to calls table.

EMRG-02 compliance: `finalIntent = hardEmergency ? 'emergency' : classification.intent` — hard-code check is in a separate step that runs before any LLM step, and its result overrides LLM output unconditionally.

Configuration: `retries: 5`, `onFailure` handler sets `analysis_status='analysis_failed'`.

### retell-analysis-timeout.ts
Cron-triggered Inngest function (`*/5 * * * *`, every 5 minutes). Finds all calls with `analysis_status='analyzing'` where `created_at < now - 30 minutes` and marks them `analysis_failed`. Covers Retell delivery failures and Inngest cold-start gaps. Idempotent — safe to re-run.

### src/app/api/inngest/route.ts (updated)
Added `retellCallClassify` and `retellAnalysisTimeout` to `serve()` functions array. `retellAgentSync` (Phase 2) remains registered.

## Test Results

All Phase 3 tests pass: **23/23**

| Test File | Tests | Status |
|-----------|-------|--------|
| tests/api/webhook.test.ts | 4 | PASS |
| tests/lib/classification.test.ts | 13 | PASS |
| tests/lib/after-hours.test.ts | 6 | PASS |

## Deviations from Plan

None — plan executed exactly as written.

The plan's code template used `classification.detected_trade` directly in `extractTradeData()`. Since `ClassificationResult.detected_trade` is typed as `string | null | undefined` (`.nullish()`), a `?? undefined` coercion was added to match `extractTradeData`'s `detectedTrade?: string` parameter. This is a minor type-safety fix, not a behavioral deviation.

## Known Stubs

None. All plan artifacts are fully implemented.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: T-03-02 | src/inngest/functions/retell-call-classify.ts | contractorId comes from the Inngest event payload — which is derived server-side in handlers.ts from agent_id lookup, never from the original Retell payload's contractor_id field. Validated by T-03-02 test in webhook.test.ts. |

## Self-Check: PASSED

- src/inngest/functions/retell-call-classify.ts — EXISTS
- src/inngest/functions/retell-analysis-timeout.ts — EXISTS
- src/app/api/inngest/route.ts — MODIFIED (retellCallClassify and retellAnalysisTimeout registered)
- Commit 91f33da — EXISTS (verified via git log)
- Commit 3bea41e — EXISTS (verified via git log)
- 23/23 Phase 3 tests pass
- No new TypeScript errors in files created/modified by this plan
