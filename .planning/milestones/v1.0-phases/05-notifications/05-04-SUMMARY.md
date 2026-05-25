---
phase: 05-notifications
plan: 04
subsystem: notifications
tags: [telegram, grammy, dashboard, inngest, wave-4]
dependency_graph:
  requires: [05-01, 05-02, 05-03]
  provides: [telegram-webhook-handler, telegram-dashboard-banner]
  affects: []
tech_stack:
  added: []
  patterns: [grammy-webhookCallback, server-component-db-query, contractor-id-deep-link]
key_files:
  created:
    - src/app/api/webhooks/telegram/route.ts
  modified:
    - src/app/(dashboard)/dashboard/page.tsx
decisions:
  - "createSupabaseServer (not createServerClient) — actual export name from src/lib/supabase/server.ts"
  - "contractorId stored as separate variable so it is available in both the DB query and the JSX deep link"
  - "retellNotifyDispatch registration skipped — already present from Wave 3 proactive deviation (commit 89f5bff)"
metrics:
  duration: ~8 minutes
  completed: "2026-05-09"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase 5 Plan 04: Telegram Webhook + Dashboard Banner Summary

**One-liner:** Telegram bot webhook handler with grammY processes /start deep links and upserts telegram_chat_id; dashboard Server Component shows setup banner when unlinked, hides it when linked (D-21).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create Telegram webhook handler (retellNotifyDispatch already registered) | a71f529 | src/app/api/webhooks/telegram/route.ts |
| 2 | Add Telegram setup banner to dashboard page | 337e1c5 | src/app/(dashboard)/dashboard/page.tsx |

## What Was Built

**src/app/api/webhooks/telegram/route.ts — Telegram bot webhook handler:**
- Imports `server-only` and creates a grammY `Bot` from `TELEGRAM_BOT_TOKEN` env var
- `bot.command('start', ...)` extracts contractor UUID from `/start <uuid>` deep-link payload
- Upserts `{ contractor_id, telegram_chat_id }` into `notification_settings` via `createServiceRoleClient` (bypasses RLS)
- D-20: `onConflict: 'contractor_id'` allows re-linking from any device; always overwrites
- Replies "✅ VoiceDesk connected. You will receive call alerts here." on success
- Returns 503 (Telegram will retry) when `TELEGRAM_BOT_TOKEN` not set
- Returns 200 on grammY parse errors (prevents infinite Telegram retries on malformed updates)
- `webhookCallback(bot, 'std/http')` adapter for Next.js App Router (Web API Request/Response)

**src/app/(dashboard)/dashboard/page.tsx — Telegram setup banner:**
- `createSupabaseServer()` (user session, anon key) loads user → contractors → notification_settings chain
- `telegramLinked = notifSettings?.telegram_chat_id != null` — banner hidden when linked (D-21)
- `contractorId` stored from the contractors lookup — used in JSX deep link (not `user.id`)
- Deep link: `https://t.me/VoiceDeskBot?start=${contractorId ?? ''}` (contractors table PK per plan spec)
- Banner style: `bg-[#1E3A5F]/40 border border-[#3B82F6]/30 text-[#93C5FD]` (matches info/setup pattern)
- `role="status"` (informational, not an error)
- Existing calendarConnected and calendarError banners unchanged

**src/app/api/inngest/route.ts — No changes needed:**
- `retellNotifyDispatch` was already imported and registered as a Wave 3 proactive deviation (commit 89f5bff, Rule 2)

## Deviations from Plan

### Skipped Step (Context Note)

**retellNotifyDispatch Inngest registration — already done**
- **Context note:** The orchestrator noted Wave 3 already registered `retellNotifyDispatch` as a Rule 2 deviation
- **Action:** Verified 2 occurrences (`grep -c`) then skipped re-adding; no file change needed
- **No deviation from requirements** — `src/app/api/inngest/route.ts` already satisfies the must-have truth

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used correct server client export name**
- **Found during:** Task 2 — reading src/lib/supabase/server.ts
- **Issue:** Plan assumed the export was `createServerClient` but the actual function exported by server.ts is `createSupabaseServer`
- **Fix:** Used `import { createSupabaseServer } from '@/lib/supabase/server'` and called `await createSupabaseServer()`
- **Files modified:** src/app/(dashboard)/dashboard/page.tsx
- **Commit:** 337e1c5

## Known Stubs

None — Telegram webhook is fully wired. The only pre-existing stub is `WHATSAPP_CONTENT_SIDS` with `HXplaceholder_*` values from Plan 02 (WABA approval pending).

## Pre-Ship Action Items

These are operational steps required before Phase 5 is live in production:

1. **Register @VoiceDeskBot with @BotFather** — Get `TELEGRAM_BOT_TOKEN`; set it as a Vercel environment variable
2. **Register Telegram webhook via setWebhook** — After deploy, call Telegram API:
   ```
   POST https://api.telegram.org/bot<TOKEN>/setWebhook
   { "url": "https://voicedesk.app/api/webhooks/telegram", "secret_token": "<random-secret>" }
   ```
3. **WABA approval** — Submit WhatsApp Business Account + `voicedesk_new_lead` and `voicedesk_emergency` templates; update `WHATSAPP_CONTENT_SIDS` constants in Plan 02 file with approved Content SIDs

## Threat Surface Scan

New network endpoint introduced: `POST /api/webhooks/telegram`

All STRIDE mitigations from the plan's threat model are present:
- T-05-04-01 (Spoofing): grammY `webhookCallback` validates `secret_token` header set during setWebhook registration — unauthorized POSTs rejected before handler runs
- T-05-04-02 (Elevation of Privilege): contractor UUID in deep link is opaque (UUIDv4); worst case is an attacker linking their own Telegram to another contractor's account — low severity, re-linkable
- T-05-04-03 (Information Disclosure): `telegram_chat_id` readable only via user session (RLS enforced); service role used only in webhook server-side handler
- T-05-04-04 (DoS): Accepted — Telegram delivers one update per bot interaction; no bulk delivery
- T-05-04-05 (Tampering): Accepted within threat model — UUID knowledge required plus clicking the bot link

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-webhook-endpoint | src/app/api/webhooks/telegram/route.ts | POST /api/webhooks/telegram — new inbound network surface; mitigated by grammY secret_token validation (T-05-04-01) |

## Self-Check: PASSED

- [x] src/app/api/webhooks/telegram/route.ts — exists, exports POST
- [x] src/app/api/webhooks/telegram/route.ts — contains telegram_chat_id (3 occurrences)
- [x] src/app/api/webhooks/telegram/route.ts — contains "VoiceDesk connected" reply
- [x] src/app/api/inngest/route.ts — retellNotifyDispatch registered (2 occurrences confirmed)
- [x] src/app/(dashboard)/dashboard/page.tsx — contains t.me/VoiceDeskBot?start= deep link
- [x] src/app/(dashboard)/dashboard/page.tsx — contains telegram_chat_id query (4 occurrences)
- [x] src/app/(dashboard)/dashboard/page.tsx — contains telegramLinked (3 occurrences: defined + used in conditional)
- [x] Commit a71f529 — Telegram webhook route
- [x] Commit 337e1c5 — Dashboard Telegram banner
- [x] tsc --noEmit clean
- [x] 20/20 notification tests passing (no regressions)
- [x] Deep link uses contractor.id (contractors table PK), NOT user.id
- [x] Banner uses role="status" (informational, not role="alert")
- [x] Existing calendarConnected and calendarError banners unchanged
