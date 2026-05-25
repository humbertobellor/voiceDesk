---
phase: 08-settings-refactor
plan: "02"
subsystem: settings-pages
tags: [settings, calendar, phone, go-live, navigation, supabase-realtime]
dependency_graph:
  requires: [08-01]
  provides: [settings/calendar, settings/phone, settings/go-live, sidebar-6-tabs]
  affects: [src/components/dashboard/Sidebar.tsx]
tech_stack:
  added: []
  patterns: [Server Component with createSupabaseServer(), useEffect+useState client fetch, useTestCallVerification Realtime gate]
key_files:
  created:
    - src/app/(dashboard)/settings/calendar/page.tsx
    - src/app/(dashboard)/settings/phone/page.tsx
    - src/app/(dashboard)/settings/go-live/page.tsx
  modified:
    - src/components/dashboard/Sidebar.tsx
decisions:
  - "settings/calendar is a Server Component matching connect-calendar/page.tsx exactly — reuses ConnectCalendarForm with no duplication"
  - "settings/phone inlines CARRIERS constant directly — not imported from deleted wizard step"
  - "settings/go-live uses enabled gate on useTestCallVerification so Realtime only subscribes after user clicks I've Called"
  - "BottomTabBar already had startsWith('/settings') — no change needed"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-20"
  tasks_completed: 3
  files_created: 3
  files_modified: 1
---

# Phase 8 Plan 02: Settings Pages (Calendar, Phone, Go Live) Summary

**One-liner:** Three new settings pages (calendar OAuth, read-only phone number, test-call go-live) plus Sidebar expanded to 6 sub-nav tabs.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create settings/calendar/page.tsx | 305aeb3 | src/app/(dashboard)/settings/calendar/page.tsx |
| 2 | Create settings/phone/page.tsx | 305aeb3 | src/app/(dashboard)/settings/phone/page.tsx |
| 3a | Create settings/go-live/page.tsx | 305aeb3 | src/app/(dashboard)/settings/go-live/page.tsx |
| 3b | Update Sidebar settingsSubNav to 6 entries | 305aeb3 | src/components/dashboard/Sidebar.tsx |

## What Was Built

### settings/calendar/page.tsx
Server Component mirroring `connect-calendar/page.tsx` exactly: authenticates via `createSupabaseServer()`, queries `contractors` for the user, queries `calendar_credentials` for connection status, renders `<ConnectCalendarForm isConnected={!!creds} />`. Exports `metadata = { title: 'Calendar — VoiceDesk' }`.

### settings/phone/page.tsx
Client component (`'use client'`). Uses `useContractor()` for `contractorId`, fetches `twilio_number` via Supabase browser client in `useEffect` (guarded by `if (!contractorId) return`). Displays the number in `text-2xl font-bold text-[#F97316]` with a copy button (Check icon reverts after 2s). Below: 4-carrier forwarding grid with `CARRIERS` constant (AT&T, Verizon, T-Mobile, Other), forwarding code examples when number is present, and a yellow advisory box. Strictly read-only — no provisioning controls.

### settings/go-live/page.tsx
Client component. Fetches `twilio_number, is_live` in `useEffect` (guarded by `if (!contractorId) return`). State machine: `loading → already-live` (if `is_live === true`) or `loading → waiting → detecting → verified`. Uses `useTestCallVerification({ enabled: status === 'detecting', onTestCallDetected })` — Realtime only activates after user clicks "I've Called". On detection: sets `status = 'verified'` then calls `markContractorLive(contractorId)`. Already-live state shows green confirmation card with number; no re-activation button.

### Sidebar.tsx
Added `Calendar` and `Radio` to lucide-react import. Replaced 3-entry `settingsSubNav` with 6-entry array: Agent Config · Calendar · Phone · Go Live · Account & Billing · Notifications. `Phone` was already imported — not re-imported.

### BottomTabBar.tsx (no change)
Already had `href === '/settings/agent' ? pathname.startsWith('/settings') : pathname.startsWith(href)` — all new `/settings/*` routes already highlighted correctly.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. `twilio_number` resolves to `'Not yet provisioned'` when null (correct display for unprovisioned contractors). `is_live` defaults correctly to the `waiting` state for new contractors.

## Threat Flags

No new trust boundaries introduced beyond those documented in the plan's threat model. All Supabase queries use `createBrowserClient` with anon key + RLS for tenant isolation (T-08-02-02), and `markContractorLive` re-validates ownership server-side (T-08-02-01).

## Self-Check: PASSED

- [x] `src/app/(dashboard)/settings/calendar/page.tsx` — exists, contains ConnectCalendarForm
- [x] `src/app/(dashboard)/settings/phone/page.tsx` — exists, contains twilio_number + CARRIERS
- [x] `src/app/(dashboard)/settings/go-live/page.tsx` — exists, contains useTestCallVerification + markContractorLive + is_live
- [x] `src/components/dashboard/Sidebar.tsx` — contains /settings/calendar, /settings/phone, /settings/go-live (3 new routes)
- [x] Commit 305aeb3 verified in git log
