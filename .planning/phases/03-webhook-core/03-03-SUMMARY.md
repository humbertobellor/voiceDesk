---
phase: 03-webhook-core
plan: "03"
subsystem: webhook-core
tags:
  - webhook
  - classification
  - openai
  - retell
  - inngest
  - security
dependency_graph:
  requires:
    - "03-01"  # packages + migration SQL + test stubs
    - "03-02"  # webhook-types.ts, openai/client.ts, emergency-keywords.ts, after-hours/detect.ts
  provides:
    - classify-intent.ts (gpt-4o-mini intent classification)
    - extract-trade.ts (gpt-4o trade-specific extraction)
    - route.ts (verified webhook POST handler with after() dispatch)
    - handlers.ts (processCallEnded + processCallAnalyzed with upsert idempotency)
  affects:
    - calls table (every completed call creates/updates a row via UPSERT)
    - contractors table (retell_agent_id lookup for contractor_id resolution)
    - inngest (retell/call.classify event fired on call_analyzed)
tech_stack:
  added:
    - openai/helpers/zod (zodResponseFormat for structured LLM output)
  patterns:
    - after() from next/server for non-blocking webhook response
    - verify() from retell-sdk for HMAC signature validation before body parsing
    - UPSERT onConflict:'retell_call_id' for idempotent duplicate handling
    - vi.hoisted() for Vitest mock variables in factory closures
key_files:
  created:
    - src/lib/classification/classify-intent.ts
    - src/lib/classification/extract-trade.ts
    - src/app/api/webhooks/retell/route.ts
    - src/app/api/webhooks/retell/handlers.ts
  modified:
    - tests/lib/classification.test.ts (stubs → GREEN)
    - tests/api/webhook.test.ts (stubs → GREEN)
decisions:
  - "Used .nullish() (nullable + optional) for Zod schema optional fields to satisfy OpenAI structured output constraint — .optional() alone throws in zodResponseFormat"
  - "Used vi.hoisted() in classification tests for mockParse variable to be accessible in vi.mock() factory (hoisting-safe pattern)"
  - "T-03-02: contractor_id is never accepted from webhook payload; always looked up via retell_agent_id from contractors table"
  - "D-05: UPSERT on retell_call_id makes both handlers idempotent on duplicate Retell delivery"
  - "D-09: call_analysis?.call_summary (not call.summary) — only field path with actual summary data in Retell v2 payload"
metrics:
  duration: "~7 minutes"
  completed_date: "2026-05-08"
  tasks_completed: 2
  files_created: 4
  files_modified: 2
  tests_passing: 17
---

# Phase 3 Plan 03: Classification + Webhook Handler Summary

GPT-4o-mini intent classification and GPT-4o trade extraction with zodResponseFormat, plus complete Retell webhook route returning 200 immediately with all DB/Inngest work deferred to after().

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | classify-intent.ts + extract-trade.ts | e86e867 | classify-intent.ts, extract-trade.ts, classification.test.ts |
| 2 | route.ts + handlers.ts | 3b361ef | route.ts, handlers.ts, webhook.test.ts |

## What Was Built

### Classification Modules

**`src/lib/classification/classify-intent.ts`**
- GPT-4o-mini with `zodResponseFormat(ClassificationSchema, 'classification')`
- Intent enum: `'lead' | 'emergency' | 'info' | 'no_action'` — exactly matches Phase 1 DB schema CHECK constraint (D-12)
- Detected trade: `'hvac' | 'plumbing' | 'electrical' | 'other'` — nullish for OpenAI structured output compliance
- isShortCall flag adds context to system prompt for calls under 15 seconds (D-13)
- Throws if OpenAI returns no parsed result (fail-fast for Inngest retry)

**`src/lib/classification/extract-trade.ts`**
- GPT-4o (not gpt-4o-mini) for better structural extraction accuracy (D-10)
- Trade-specific Zod schemas: HvacSchema, PlumbingSchema, ElectricalSchema, GeneralSchema
- Returns null for empty transcripts — avoids wasted API calls on no_action calls (D-13)
- All optional fields use `.nullish()` for OpenAI structured output compliance

### Webhook Handler

**`src/app/api/webhooks/retell/route.ts`**
- `import { verify } from 'retell-sdk'` called with `(rawBody, RETELL_API_KEY, signature)` BEFORE JSON.parse (T-03-01)
- `req.text()` not `req.json()` — preserves raw body for HMAC verification
- Returns `new Response('OK', { status: 200 })` immediately
- All processing deferred to `after()` — never blocks on DB or OpenAI (CLAUDE.md rule 2)
- `maxDuration = 30`, `runtime = 'nodejs'` segment config exported

**`src/app/api/webhooks/retell/handlers.ts`**
- `processCallEnded`: looks up contractor via `.eq('retell_agent_id', call.agent_id)` (T-03-02); UPSERTs calls row with `analysis_status='analyzing'`, `status='completed'`, `is_after_hours` from `detectAfterHours()`; idempotent via `onConflict:'retell_call_id'` (D-05)
- `processCallAnalyzed`: persists `transcript_object` (JSONB) and `call_analysis?.call_summary` FIRST, then fires `inngest.send({name:'retell/call.classify', ...})`; Inngest failure is logged but not rethrown (transcript already saved)
- `duration_ms / 1000` → `duration_seconds` conversion (not duration_seconds directly)

## Test Results

- **classification.test.ts**: 12/12 passing (EMRG-01, EMRG-02, CALL-02, CALL-03)
- **webhook.test.ts**: 5/5 passing (CALL-01, T-03-01, T-03-02, D-05, D-02)
- **Total**: 17/17 passing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Zod `.optional()` → `.nullish()` for OpenAI structured output**
- **Found during:** Task 1, running classification tests
- **Issue:** `zodResponseFormat()` in the newer openai SDK validates that optional fields must be `.nullable()`. Fields using `.optional()` alone throw: "Zod field uses `.optional()` without `.nullable()` which is not supported by the API"
- **Fix:** Changed `z.enum(...).optional()` and `z.string().optional()` to `.nullish()` in both `ClassificationSchema` and all per-trade schemas in `extract-trade.ts`
- **Files modified:** `src/lib/classification/classify-intent.ts`, `src/lib/classification/extract-trade.ts`
- **Commit:** e86e867

**2. [Rule 1 - Bug] Fixed vi.mock() factory hoisting for mockParse**
- **Found during:** Task 1, running classification tests
- **Issue:** `vi.mock('openai')` without factory was not finding `tests/__mocks__/openai.ts` (not at Vitest-expected project-root location). Client singleton was getting an improperly mocked instance.
- **Fix:** Used `vi.hoisted(() => ({ mockParse: vi.fn() }))` and inline `vi.mock('openai', () => { class OpenAI { ... } })` factory
- **Files modified:** `tests/lib/classification.test.ts`
- **Commit:** e86e867

**3. [Rule 1 - Bug] Fixed TypeScript cast for Supabase one-to-one join**
- **Found during:** Task 2, running TypeScript check
- **Issue:** Supabase inferred `contractor_settings` join as array type. Direct cast to `{ business_hours: BusinessHours }` failed TS2352.
- **Fix:** Changed cast to `as unknown as { business_hours: BusinessHours } | null` (double-cast through `unknown`)
- **Files modified:** `src/app/api/webhooks/retell/handlers.ts`
- **Commit:** 3b361ef

## Security Verification

All four threat mitigations from the plan's threat model were implemented:

| Threat ID | Mitigation | Verified |
|-----------|-----------|---------|
| T-03-01 | `verify(rawBody, RETELL_API_KEY, signature)` before JSON.parse | grep + tests |
| T-03-02 | `.eq('retell_agent_id', call.agent_id)` — contractor_id server-derived | grep + tests |
| T-03-03 | `import 'server-only'` in both handlers.ts and route.ts | grep |
| T-03-04 | `zodResponseFormat(ClassificationSchema, ...)` validates intent enum at parse time | implementation |

## Self-Check: PASSED

- `src/lib/classification/classify-intent.ts` — FOUND
- `src/lib/classification/extract-trade.ts` — FOUND
- `src/app/api/webhooks/retell/route.ts` — FOUND
- `src/app/api/webhooks/retell/handlers.ts` — FOUND
- `tests/lib/classification.test.ts` — 12/12 GREEN
- `tests/api/webhook.test.ts` — 5/5 GREEN
- Commit e86e867 — FOUND (Task 1)
- Commit 3b361ef — FOUND (Task 2)
