---
phase: 09-hardening
plan: "01"
subsystem: notifications, error-observability
tags: [bot-name-fix, structured-logging, inngest, vercel-logs, NOTIF-03, EMRG-01]
dependency_graph:
  requires: []
  provides: [structured-error-logging, correct-telegram-bot-name]
  affects: [src/app/api/webhooks/telegram, src/app/(dashboard)/dashboard, src/lib/notifications/telegram, src/app/api/webhooks/retell, src/inngest/functions]
tech_stack:
  added: []
  patterns: [structured-JSON-console-error, voicedesk-log-prefix]
key_files:
  created: []
  modified:
    - src/app/api/webhooks/telegram/route.ts
    - src/app/(dashboard)/dashboard/page.tsx
    - src/lib/notifications/telegram.ts
    - src/app/api/webhooks/retell/route.ts
    - src/inngest/functions/retell-call-classify.ts
    - src/inngest/functions/retell-notify-dispatch.ts
    - src/inngest/functions/retell-agent-sync.ts
    - src/inngest/functions/stripe-payment-failure.ts
decisions:
  - "Bot name is voiceDeskTelBot (camelCase) — only comments and display text updated, TELEGRAM_BOT_TOKEN env var unchanged"
  - "Structured log format: console.error('[voicedesk]', JSON.stringify({event, contractor_id?, call_id?, error, stack?})) — no third-party SDK"
  - "retell/route.ts after() catch: omits contractor_id and call_id (not in scope at that catch boundary); includes stack for caught Error"
  - "retell-agent-sync.ts: no call_id available — key omitted per plan spec"
  - "EMRG-01 confirmed satisfied by existing KeywordsForm.tsx — no new work required"
  - "Build TypeScript compilation passes; collect-page-data failure is pre-existing (TELEGRAM_WEBHOOK_SECRET not set in build env) — out of scope"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-21"
  tasks_completed: 3
  files_modified: 8
---

# Phase 9 Plan 01: Bot Name Fix and Structured Error Logging Summary

**One-liner:** Replace VoiceDeskBot with voiceDeskTelBot across 3 files (5 locations) and add structured `[voicedesk]` JSON console.error logging at all 5 uncaught failure paths for Vercel log searchability.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace VoiceDeskBot with voiceDeskTelBot in all three files | a22a413 | telegram/route.ts, dashboard/page.tsx, telegram.ts |
| 2 | Add structured JSON console.error at all uncaught failure paths | 65e35ff | retell/route.ts, retell-call-classify.ts, retell-notify-dispatch.ts, retell-agent-sync.ts, stripe-payment-failure.ts |
| 3 | Verify EMRG-01 satisfied by existing KeywordsForm implementation | (no commit — verification only) | none |

## Task Details

### Task 1: Bot Name Replacement

Replaced all 5 occurrences of `VoiceDeskBot` with `voiceDeskTelBot` (camelCase per D-01 decision):

- `src/app/api/webhooks/telegram/route.ts` lines 2 and 21 — header comment and deep-link URL comment
- `src/app/(dashboard)/dashboard/page.tsx` lines 79 and 84 — href attribute value and display text
- `src/lib/notifications/telegram.ts` line 15 — D-18 comment

TELEGRAM_BOT_TOKEN env var was not changed. Zero occurrences of `VoiceDeskBot` remain in src/.

### Task 2: Structured Error Logging

Added structured `console.error('[voicedesk]', JSON.stringify({...}))` at all 5 uncaught failure paths:

| File | Location | Keys logged |
|------|----------|-------------|
| `retell/route.ts` | `after()` catch block | `event`, `error`, `stack` |
| `retell-call-classify.ts` | `onFailure` handler | `event`, `contractor_id`, `call_id`, `error` |
| `retell-notify-dispatch.ts` | `onFailure` handler | `event`, `contractor_id`, `call_id`, `error` |
| `retell-agent-sync.ts` | `onFailure` handler (new) | `event`, `contractor_id`, `error` |
| `stripe-payment-failure.ts` | `onFailure` handler | `event`, `contractor_id`, `error` |

`retell-call-classify.ts` and `retell-notify-dispatch.ts` onFailure destructuring was widened to also extract `contractorId` (in addition to the previously extracted `callId`).

`retell-agent-sync.ts` had no console.error in onFailure — one was added after the existing DB update.

`stack` field included only in the `retell/route.ts` catch block (where `err` is a caught Error object). Omitted from onFailure handlers that use the sentinel string 'all retries exhausted'.

### Task 3: EMRG-01 Verification

Confirmed EMRG-01 is already satisfied by existing implementation:
- `src/components/agent/KeywordsForm.tsx` — reads and writes `contractor_settings.emergency_keywords` (3 references: initial load, state update, mutation)
- `src/app/(dashboard)/settings/agent/page.tsx` — imports and renders `<KeywordsForm />` in the `keywords` tab via `AgentConfigTabs`

No new files created, no code modified.

## Verification Results

- `grep -rn "VoiceDeskBot" src/` — 0 occurrences (PASS)
- `grep -rn "voiceDeskTelBot" src/` — 5 occurrences across 3 files (PASS)
- `[voicedesk]` JSON.stringify log lines across 5 target files — 5 lines (PASS)
- `git diff package.json` — no changes (PASS)
- TypeScript compilation — PASS (✓ Compiled successfully in ~15s, TypeScript finished with no errors)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan contains only string edits and logging additions with no data flow.

## Threat Flags

None — per the plan's threat model, all changes are either comment/display-text-only (T-09-01-02: accepted) or structured log output of internal UUIDs (T-09-01-01: accepted). No new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check

- [x] `src/app/api/webhooks/telegram/route.ts` — exists, contains `voiceDeskTelBot`
- [x] `src/app/(dashboard)/dashboard/page.tsx` — exists, contains `voiceDeskTelBot`
- [x] `src/lib/notifications/telegram.ts` — exists, contains `voiceDeskTelBot`
- [x] `src/app/api/webhooks/retell/route.ts` — exists, contains `[voicedesk]` JSON.stringify
- [x] `src/inngest/functions/retell-call-classify.ts` — exists, contains `[voicedesk]` JSON.stringify
- [x] `src/inngest/functions/retell-notify-dispatch.ts` — exists, contains `[voicedesk]` JSON.stringify
- [x] `src/inngest/functions/retell-agent-sync.ts` — exists, contains `[voicedesk]` JSON.stringify
- [x] `src/inngest/functions/stripe-payment-failure.ts` — exists, contains `[voicedesk]` JSON.stringify
- [x] Commit a22a413 exists (Task 1)
- [x] Commit 65e35ff exists (Task 2)

## Self-Check: PASSED
