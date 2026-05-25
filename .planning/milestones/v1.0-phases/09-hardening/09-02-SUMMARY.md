---
phase: 09-hardening
plan: "02"
subsystem: settings-phone-provisioning
tags: [provisioning, settings, ui, two-state-page, router-refresh]
dependency_graph:
  requires: []
  provides: [settings/phone two-state provisioning page]
  affects: [src/app/(dashboard)/settings/phone/page.tsx, src/components/dashboard/Sidebar.tsx (via router.refresh)]
tech_stack:
  added: []
  patterns: [two-state client component, optimistic router.refresh, Wave 0 TDD stubs]
key_files:
  created:
    - tests/ui/phone-settings.test.tsx
  modified:
    - src/app/(dashboard)/settings/phone/page.tsx
decisions:
  - "contractor_id excluded from fetch body — API derives it from JWT session (auth.getUser())"
  - "router.refresh() on success triggers layout re-query, updating Sidebar without hard reload"
  - "Section B (forwarding grid) guarded by twilioNumber — never shown before number is provisioned"
metrics:
  duration: "~3 minutes"
  completed: "2026-05-21"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 2
---

# Phase 9 Plan 02: Phone Settings Provisioning Form Summary

**One-liner:** Two-state settings/phone page with area-code input form for unprovisioned contractors, calling existing provisioning API with router.refresh() on success.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 0 | Wave 0 test stubs | 3d4b9f4 | tests/ui/phone-settings.test.tsx |
| 1 | Provisioning form implementation | bc2b469 | src/app/(dashboard)/settings/phone/page.tsx |

## What Was Built

### Task 0 — Wave 0 Test Stubs
Created `tests/ui/phone-settings.test.tsx` with 3 stub tests (all RED, throwing "not yet implemented"):
- `renders provisioning form when twilio_number is null`
- `calls POST /api/provisioning/create with area_code when Provision My Number is clicked`
- `shows area code unavailable error on 422 response`

### Task 1 — Two-State settings/phone Page
Rewrote `src/app/(dashboard)/settings/phone/page.tsx` to support two states:

**State A (no twilio_number):**
- "No number assigned yet" descriptive text
- 3-digit numeric input (digits-only, maxLength=3)
- "Provision My Number" button (disabled when length != 3 or during provisioning)
- Spinner with "Provisioning..." label during API call
- Inline error display for 409, 422, and generic failures

**State B (twilio_number set):**
- Existing orange phone number display with copy button (preserved)
- Carrier forwarding grid (AT&T, Verizon, T-Mobile, Other) — now gated on twilioNumber

**Handler behavior:**
- Calls `POST /api/provisioning/create` with `{ area_code }` only
- 409: "Number already provisioned — refresh page."
- 422: "Area code unavailable. Try: 786, 954, or 561."
- Success: sets local state + calls `router.refresh()` (triggers layout re-query, Sidebar updates)

**Security invariant maintained:** `contractor_id` is never in the fetch body. The API derives it from `supabase.auth.getUser()` (JWT session).

## Checkpoint Reached — Task 2 (Human Verify)

Execution paused at `checkpoint:human-verify`. Visual verification required before plan is marked complete.

**What to verify:**
1. Navigate to Settings > Phone
2. Unprovisioned state: should show "No number assigned yet", 3-digit input, disabled button until 3 digits entered
3. Provisioned state: should show phone number in orange with copy button and forwarding grid below
4. `npm run build` exits 0 (confirmed: passes cleanly)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `tests/ui/phone-settings.test.tsx` — 3 Wave 0 stubs throwing "not yet implemented". These are intentional Wave 0 stubs. Full test implementation is deferred to a future green-phase task (outside scope of 09-02).

## Threat Surface Scan

No new network endpoints introduced. Security boundary analysis confirms:
- Form sends `{ area_code }` only (T-09-02-01 mitigation applied — no `contractor_id` in body)
- Area code input sanitized client-side to digits-only (T-09-02-02 accepted; server-side zod remains authoritative)
- Button disabled during `isProvisioning` (T-09-02-03 DoS mitigation applied)

No new threat surface identified beyond what is already in the plan's threat model.

## Self-Check

**Files exist:**
- `tests/ui/phone-settings.test.tsx` — FOUND
- `src/app/(dashboard)/settings/phone/page.tsx` — FOUND (modified)

**Commits exist:**
- `3d4b9f4` — test(09-02): add Wave 0 stub tests
- `bc2b469` — feat(09-02): add provisioning form

## Self-Check: PASSED
