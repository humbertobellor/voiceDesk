---
phase: 09-hardening
verified: 2026-05-23T00:00:00Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Unprovisioned contractor can provision a number from settings/phone"
    expected: "Navigate to Settings > Phone as an unprovisioned contractor — see 'No number assigned yet' text, a 3-digit area-code input, and a 'Provision My Number' button. Type 2 digits and confirm button is disabled. Type 3 digits and confirm button becomes enabled."
    why_human: "Two-state conditional rendering depends on live DB state (twilio_number null vs set); cannot verify without a running session."
  - test: "Sidebar displays provisioned phone number between business name and email"
    expected: "After provisioning (or for an already-provisioned account), navigate to any dashboard page. Sidebar bottom-left should show: business name (white), phone number in orange with phone icon, email (grey) — in that vertical order."
    why_human: "Requires a provisioned contractor session. Sidebar rendering is conditional on phoneNumber prop value passed from layout server query."
  - test: "router.refresh() triggers Sidebar update without hard reload"
    expected: "Provision a number from settings/phone. Without manually reloading the page, the Sidebar should update to display the new phone number within the same navigation session."
    why_human: "router.refresh() behavior in Next.js App Router depends on runtime layout re-execution; cannot be verified statically."
---

# Phase 9: Hardening & UX Polish Verification Report

**Phase Goal:** Address cross-AI review findings and close UX gaps before beta launch: add error observability, make emergency keywords configurable per contractor, fix the Telegram bot name, move phone provisioning into settings/phone so contractors can self-serve a number, and surface the provisioned number in the Sidebar.
**Verified:** 2026-05-23T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `voiceDeskTelBot` is the bot name everywhere — no reference to `voiceDeskBot` remains in source or UI | ✓ VERIFIED | `grep -rn "VoiceDeskBot" src/` returns 0 results. `grep -rn "voiceDeskTelBot" src/` returns exactly 5 results across 3 files: `telegram/route.ts` (lines 2, 21), `dashboard/page.tsx` (lines 79, 84), `telegram.ts` (line 15). |
| 2 | Contractors can provision their phone number directly from `settings/phone` — button calls existing provisioning API and shows result inline | ✓ VERIFIED | `settings/phone/page.tsx` implements two-state logic: unprovisioned branch renders area-code input + "Provision My Number" button; calls `POST /api/provisioning/create` with `{ area_code }` only; `router.refresh()` called on success; inline error display for 409 and 422. No `contractor_id` in fetch body (security invariant). |
| 3 | Provisioned number displayed in Sidebar bottom-left between business name and email | ? UNCERTAIN | Code verified: `Sidebar.tsx` lines 110–117 render business name, then `{phoneNumber && <p>...</p>}` in orange, then email — correct order. `layout.tsx` line 20 selects `twilio_number` and passes as `phoneNumber` prop. `router.refresh()` wiring in settings/phone triggers layout re-query. **Visual rendering requires human confirmation** (see Human Verification section). |
| 4 | `settings/agent` Emergency Keywords tab lets contractors add/remove custom keywords — changes persist to `contractor_settings` | ✓ VERIFIED | `KeywordsForm.tsx` fully implemented: reads `settings.emergency_keywords` via `useContractorSettings()`, writes via `updateSettings.mutateAsync({ emergency_keywords: keywords })`, triggers Retell sync. Hardcoded baseline (`gas smell`, `co alarm`, `carbon monoxide`) shown as non-configurable. Rendered at `settings/agent/page.tsx` line 26 via `AgentConfigTabs`. |
| 5 | Uncaught errors in `after()` webhook processing and Inngest functions are logged with enough context to diagnose without a Supabase query | ~ PARTIAL | **Inngest functions (4/4):** All four `onFailure` handlers emit `[voicedesk]` JSON logs with `contractor_id` and `call_id` (where available). **`after()` catch in `retell/route.ts`:** Emits `[voicedesk]` JSON with `event`, `error`, and `stack` — but NOT `contractor_id` or `call_id`. This is by design (not in scope at that catch boundary, per plan acceptance criteria), but the PLAN's must_have truth and ROADMAP SC-5 both mention `contractor_id` and `call_id`. The `stack` field partially compensates for diagnosability. **See WARNING below.** |

**Score:** 4/5 truths fully verified (SC-5 is partial)

---

### Deferred Items

None.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/(dashboard)/dashboard/page.tsx` | Telegram deep-link with `voiceDeskTelBot` | ✓ VERIFIED | Line 79: `href="https://t.me/voiceDeskTelBot?start=${contractorId ?? ''}"`. Line 84: `Connect @voiceDeskTelBot` |
| `src/app/api/webhooks/telegram/route.ts` | Telegram webhook route with `voiceDeskTelBot` | ✓ VERIFIED | Lines 2 and 21 contain `voiceDeskTelBot` |
| `src/lib/notifications/telegram.ts` | Telegram send helper with `voiceDeskTelBot` | ✓ VERIFIED | Line 15: `// D-18: Single @voiceDeskTelBot for the entire platform.` |
| `src/app/api/webhooks/retell/route.ts` | Structured error logging in `after()` catch | ✓ VERIFIED (partial) | Line 111: `console.error('[voicedesk]', JSON.stringify({event, error, stack}))` — no `contractor_id`/`call_id` (by design) |
| `src/inngest/functions/retell-call-classify.ts` | `onFailure` with structured JSON log | ✓ VERIFIED | Lines 43–48: logs `{event, contractor_id, call_id, error}` |
| `src/inngest/functions/retell-notify-dispatch.ts` | `onFailure` with structured JSON log | ✓ VERIFIED | Lines 82–87: logs `{event, contractor_id, call_id, error}` |
| `src/inngest/functions/retell-agent-sync.ts` | `onFailure` with structured JSON log | ✓ VERIFIED | Lines 26–30: logs `{event, contractor_id, error}` (no call_id available in this function) |
| `src/inngest/functions/stripe-payment-failure.ts` | `onFailure` with structured JSON log | ✓ VERIFIED | Lines 24–28: logs `{event, contractor_id, error}` |
| `src/app/(dashboard)/settings/phone/page.tsx` | Two-state provisioning + display page | ✓ VERIFIED | Full implementation present: area-code input, "Provision My Number" button, `router.refresh()` on success, 409/422 inline errors, Section B gated on `twilioNumber` |
| `src/components/agent/KeywordsForm.tsx` | Emergency keywords read/write form | ✓ VERIFIED | Reads `emergency_keywords`, writes via `updateSettings.mutateAsync`, hardcoded baseline displayed as non-configurable |
| `src/components/dashboard/Sidebar.tsx` | Phone number prop + display | ✓ VERIFIED | Lines 111–116: `{phoneNumber && <p className="text-xs text-[#F97316]..."><Phone/>{phoneNumber}</p>}` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/(dashboard)/dashboard/page.tsx` | `https://t.me/voiceDeskTelBot` | `href` attribute | ✓ WIRED | Line 79 confirmed |
| `src/app/(dashboard)/settings/phone/page.tsx` | `/api/provisioning/create` | `fetch POST { area_code }` | ✓ WIRED | Lines 66–70 confirmed |
| `src/app/(dashboard)/layout.tsx` | `src/components/dashboard/Sidebar.tsx` | `phoneNumber={contractor.twilio_number}` | ✓ WIRED | `layout.tsx` line 30 passes `twilio_number` as `phoneNumber` prop; Sidebar line 111 renders it |
| `src/app/(dashboard)/settings/phone/page.tsx` | `Sidebar` re-render | `router.refresh()` | ✓ WIRED (code only) | Line 74: `router.refresh()` called on success — triggers layout server re-query; **visual confirmation needed** |
| `src/app/(dashboard)/settings/agent/page.tsx` | `KeywordsForm` | `import + render` | ✓ WIRED | Line 7: import; line 26: `<KeywordsForm />` rendered when `activeTab === 'keywords'` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `Sidebar.tsx` | `phoneNumber` prop | `layout.tsx` → `supabase.from('contractors').select('twilio_number')` | Yes — live DB query | ✓ FLOWING |
| `settings/phone/page.tsx` | `twilioNumber` state | `useEffect` → `supabase.from('contractors').select('twilio_number')` | Yes — live DB query | ✓ FLOWING |
| `KeywordsForm.tsx` | `settings.emergency_keywords` | `useContractorSettings()` → React Query → Supabase | Yes — live DB query | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| No `VoiceDeskBot` in `src/` | `grep -rn "VoiceDeskBot" src/ \| wc -l` | 0 | ✓ PASS |
| Exactly 5 `voiceDeskTelBot` in `src/` | `grep -rn "voiceDeskTelBot" src/` | 5 lines across 3 files | ✓ PASS |
| `[voicedesk]` JSON logs in 5 Inngest/route files | `grep -rn "[voicedesk]" ...5 files...` | 6 lines (5 onFailure/after + 1 signature-failure path added in Phase 5 fix) | ✓ PASS — 5 required paths covered; 6th is additional diagnostic path |
| `Provision My Number` in phone settings page | `grep -n "Provision My Number" settings/phone/page.tsx` | Line 155 | ✓ PASS |
| `router.refresh` in phone settings page | `grep -n "router.refresh" settings/phone/page.tsx` | Line 74 | ✓ PASS |
| `contractor_id` absent from fetch body | `grep -n "contractor_id" settings/phone/page.tsx` | Only in comments (lines 6–7), not in fetch body | ✓ PASS |
| `emergency_keywords` in `KeywordsForm.tsx` | `grep -n "emergency_keywords" KeywordsForm.tsx` | Lines 20, 21, 35 | ✓ PASS |
| `KeywordsForm` rendered in agent settings | `grep -n "KeywordsForm" settings/agent/page.tsx` | Lines 7 (import), 26 (render) | ✓ PASS |

---

### Probe Execution

Step 7c: SKIPPED — no probe scripts found in `scripts/*/tests/probe-*.sh` and phase does not declare probes.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| NOTIF-03 | 09-01-PLAN.md | Telegram notification with correct bot | ✓ SATISFIED | Bot name `voiceDeskTelBot` in all 5 source locations; deep-link href correct |
| EMRG-01 | 09-01-PLAN.md | Configurable emergency keywords | ✓ SATISFIED | `KeywordsForm.tsx` fully implemented; rendered in `settings/agent` keywords tab; persists to `contractor_settings.emergency_keywords` |
| ONBOARD-01 | 09-02-PLAN.md | Self-serve phone provisioning from settings | ✓ SATISFIED (code) / ? UNCERTAIN (visual) | Code verified — two-state page with provisioning form calling existing API. Visual verification of rendered states deferred to human check. |

**REQUIREMENTS.md traceability note:** REQUIREMENTS.md marks NOTIF-03, EMRG-01, and ONBOARD-01 as `Pending` in the traceability table (reflecting their original phase assignment of Phase 5/3/7 respectively). Phase 9 provides the implementation that satisfies these requirements. The table entries reflect planning-time assignment, not current completion state.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/inngest/functions/retell-call-classify.ts` | 231 | `?? 'TBD'` as fallback for `service_address` | ℹ️ Info | Pre-existing (introduced in Phase 4, commit `4ac38`). Not a Phase 9 regression. `TBD` is a data fallback for calendar event location, not a task marker. Not in scope for Phase 9 verification. |
| `.env.example` | 66 | Comment: `set username to VoiceDeskBot` | ⚠️ Warning | `VoiceDeskBot` remains in `.env.example` developer setup comment. Plan scope was `src/` only, so this was intentionally excluded. Developer documentation inconsistency — does not affect runtime behavior. Not a BLOCKER. |

---

### WARNING: SC-5 `after()` catch lacks `contractor_id` / `call_id`

**Finding:** The PLAN's must_have truth (line 26) states the `after()` catch block will log `event, contractor_id, call_id, and error`. The actual implementation (line 111, `retell/route.ts`) logs only `event`, `error`, and `stack` — no `contractor_id` or `call_id`.

**Context:** The plan's own Task 2 acceptance criteria (line 281) explicitly says: "retell/route.ts after() catch: logs { event: 'webhook.retell.after.failed', error } (no contractor_id — not in scope)." This is an intentional design choice: `contractor_id` and `call_id` are derived inside `processCallEnded`/`processCallAnalyzed`, not accessible at the outer `after()` catch boundary.

**ROADMAP SC-5 assessment:** The ROADMAP states failures must be "diagnosable without a Supabase query." The `stack` field in the log provides function-call context. The Inngest functions (which handle the same call processing steps) DO log `contractor_id` and `call_id`. The `after()` path only triggers if the pre-Inngest processing fails. This partially satisfies the diagnosability intent but does not meet the letter of PLAN must_have truth #4 nor ROADMAP SC-5's explicit mention of `contractor_id` and `call_id`.

**Classification:** ⚠️ WARNING — intentional architectural constraint acknowledged in acceptance criteria. Not a regression. Does not prevent beta launch.

---

### Human Verification Required

**Purpose:** Three items require a running application with a valid contractor session to confirm.

#### 1. Unprovisioned State: settings/phone Provisioning Form

**Test:** Navigate to Settings > Phone as an unprovisioned contractor (no Twilio number assigned).
**Expected:** Page shows "No number assigned yet. Enter your preferred area code..." text, a 3-digit numeric input (placeholder "305"), and a "Provision My Number" button. With <3 digits entered, button is disabled. With exactly 3 digits, button becomes enabled.
**Why human:** Conditional rendering depends on live `twilio_number` DB state; cannot simulate without an active session.

#### 2. Provisioned State: Phone Number in Sidebar

**Test:** Log in as a provisioned contractor (has a Twilio number). Navigate to any dashboard page.
**Expected:** Sidebar bottom-left user area shows: (1) business name in white, (2) phone number in orange with phone icon, (3) email in grey — in that exact vertical order.
**Why human:** Requires a provisioned account session. The code wiring is verified but visual layout under real data needs confirmation.

#### 3. router.refresh() Triggers Sidebar Update Without Hard Reload

**Test:** As an unprovisioned contractor, provision a number from settings/phone. Without navigating away or reloading the browser, observe whether the Sidebar updates to show the new phone number.
**Expected:** Sidebar reflects the new number within the same session (no hard reload required).
**Why human:** `router.refresh()` triggers a server-side re-execution of the layout component; behavior depends on Next.js runtime that cannot be statically verified.

---

### Gaps Summary

No blocking gaps. The phase goal is substantively achieved:

- SC-1 (bot name): VERIFIED — zero `VoiceDeskBot` in `src/`.
- SC-2 (provisioning from settings): VERIFIED — full two-state implementation present and wired to existing API.
- SC-3 (Sidebar number display): Code VERIFIED; visual rendering awaits human confirmation.
- SC-4 (emergency keywords): VERIFIED — `KeywordsForm` fully implemented and wired.
- SC-5 (error observability): PARTIAL — Inngest functions meet the standard; `after()` catch lacks `contractor_id`/`call_id` by design. Diagnosability intent is partially met via `stack` field.

The only actionable items before beta launch are the three human verification tests above.

---

_Verified: 2026-05-23T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
