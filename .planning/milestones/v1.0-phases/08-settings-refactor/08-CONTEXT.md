# Phase 8: Settings Refactor - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning
**Source:** Direct user specification

<domain>
## Phase Boundary

Remove the onboarding wizard modal entirely and promote every wizard step into a standalone settings tab. Contractors configure their account through Settings (always accessible), not through a one-time linear modal flow.

**In scope:**
- Delete `OnboardingWizard`, `OnboardingWizardWrapper`, and `SetupBanner`
- Add three new settings tabs: Calendar · Phone · Go Live
- Settings/agent (existing) remains unchanged
- Wire settings/go-live with the same Realtime test-call detection + `markContractorLive` logic as the deleted `TestCallStep`
- `settings/phone` is **read-only**: shows the contractor's provisioned VoiceDesk number + the call forwarding instructions (AT&T, Verizon, T-Mobile carrier codes) that were previously in `CallForwardingStep`

**Out of scope:**
- Changing how `markContractorLive` works server-side
- Changing the Stripe checkout or post-signup flow
- Any changes to `/setup/phone` — kept exactly as-is (phone capture only, no provisioning)
- Redesigning the settings layout or navigation chrome
- No `settings/forwarding` tab — forwarding instructions live inside `settings/phone`
- Provisioning (Twilio number + Retell agent) continues to happen after Stripe checkout completes, as it does today

</domain>

<decisions>
## Implementation Decisions

### Wizard removal
- **D-01:** `OnboardingWizard.tsx`, `OnboardingWizardWrapper.tsx`, and the entire `src/components/onboarding/` directory are deleted. No modal, no wizard shell, no wrapper in the dashboard layout.
- **D-02:** `SetupBanner.tsx` is deleted entirely — not repurposed. Dashboard is clean for all contractors.
- **D-03:** `AgentConfigStep.tsx` inside the wizard is deleted alongside the wizard — the settings/agent page already covers this content.

### New settings tabs (3 new, 2 existing untouched)
- **D-04:** Three new pages are added under `src/app/(dashboard)/settings/`:
  - `settings/calendar` — Google Calendar connect/disconnect; content from `CalendarConnectStep.tsx`
  - `settings/phone` — read-only VoiceDesk number + call forwarding instructions; merges `PhoneProvisioningStep` (display only) and all content from `CallForwardingStep` (AT&T, Verizon, T-Mobile carrier codes)
  - `settings/go-live` — test call detection + live activation; content from `TestCallStep.tsx`
- **D-05:** No `settings/forwarding` tab — forwarding instructions live entirely inside `settings/phone`.
- **D-06:** Each new page follows the existing `settings/agent/page.tsx` App Router pattern. Source step components are the content reference; after extraction the step files are deleted.

### Settings navigation
- **D-07:** Settings tab nav updated to: Agent Config · Calendar · Phone · Go Live · Account · Notifications (6 tabs total, setup tabs first).
- **D-08:** Follow the existing tab nav pattern found in `settings/agent` before creating anything new.

### Auth flow
- **D-09:** `/setup/phone` is kept exactly as-is — phone number capture only, no provisioning call. DO NOT TOUCH this file.
- **D-10:** Provisioning (Twilio number + Retell agent creation) continues to happen after Stripe `checkout.completed` webhook fires, exactly as today.

### `settings/phone` — read-only display
- **D-11:** `settings/phone` reads `contractor.twilio_number` (the provisioned VoiceDesk number) from `useContractor()` and displays it prominently. No edit or re-provisioning UI. Below the number: the full call forwarding instructions with AT&T/Verizon/T-Mobile carrier codes (verbatim from `CallForwardingStep`).
- **D-12:** `CallForwardingStep.tsx` is deleted after its content is inlined into `settings/phone/page.tsx`.
- **D-13:** `PhoneProvisioningStep.tsx` is deleted — provisioning display is now just the read-only number in `settings/phone`.

### Go Live tab behaviour
- **D-14:** `settings/go-live` reuses `useTestCallVerification` from `src/lib/realtime/testCallVerification.ts`. Shows: live status, VoiceDesk number, forwarding reminder, Realtime detection indicator. When a test call is detected, `markContractorLive` is called and the page shows "You're live!".
- **D-15:** A contractor who is already live (`is_live = true`) sees a confirmation state — no repeated activation prompt.

### Dashboard layout
- **D-16:** `OnboardingWizardWrapper` is removed from `src/app/(dashboard)/layout.tsx`. Children render directly.

### Claude's Discretion
- How to render the settings tab navigation (layout-level nav bar vs. per-page tabs) — follow the existing pattern in `settings/agent`
- Whether to use a shared `SettingsLayout` component or inline tab nav per page
- Exact import structure for content extracted from wizard steps

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing settings pages (pattern source)
- `src/app/(dashboard)/settings/agent/page.tsx` — canonical settings page pattern
- `src/app/(dashboard)/settings/account/page.tsx` — second settings page example
- `src/app/(dashboard)/settings/notifications/` — third example

### Wizard files to be deleted
- `src/components/onboarding/OnboardingWizard.tsx` — main wizard shell
- `src/components/onboarding/OnboardingWizardWrapper.tsx` — dashboard layout wrapper
- `src/components/onboarding/steps/AgentConfigStep.tsx` — already covered by settings/agent
- `src/components/onboarding/steps/CalendarConnectStep.tsx` — source for settings/calendar
- `src/components/onboarding/steps/PhoneProvisioningStep.tsx` — provisioning logic moves to /setup/phone submit handler; file deleted after
- `src/components/onboarding/steps/CallForwardingStep.tsx` — content moves to settings/phone; file deleted after
- `src/components/onboarding/steps/TestCallStep.tsx` — source for settings/go-live; file deleted after
- `src/components/onboarding/steps/index.ts` — barrel export; deleted with directory
- `src/components/dashboard/SetupBanner.tsx` — deleted entirely

### Supporting files (read before editing)
- `src/app/(dashboard)/layout.tsx` — remove OnboardingWizardWrapper here
- `src/components/dashboard/Sidebar.tsx` — settings nav links to update
- `src/components/dashboard/BottomTabBar.tsx` — mobile settings nav to update
- `src/components/dashboard/SetupBanner.tsx` — delete this file
- `src/lib/realtime/testCallVerification.ts` — hook used by settings/go-live
- `src/app/actions/onboarding.ts` — markContractorLive server action used by settings/go-live
- `src/app/(dashboard)/connect-calendar/page.tsx` — may overlap with settings/calendar; reconcile
- `src/app/(auth)/setup/phone/page.tsx` — DO NOT TOUCH (kept in auth flow per D-11)

</canonical_refs>

<specifics>
## Specific Ideas

- The `connect-calendar` standalone page (`/connect-calendar`) — check all usages before deciding to delete or redirect to `/settings/calendar`.
- `settings/go-live` should show the contractor's VoiceDesk number (from `useContractor()`) so they know which number to forward calls to before making the test call.
- The four setup tabs (Agent Config · Calendar · Phone · Go Live) appear in setup-logical order, account/billing tabs at the end.
- `/setup/phone` provisioning call: use the same `POST /api/provisioning/create` payload as `PhoneProvisioningStep` — read that component for the exact request shape before implementing.

</specifics>

<deferred>
## Deferred Ideas

- Redesigning the overall settings navigation chrome or sidebar
- Adding a "setup progress" indicator anywhere in the UI
- Changing the Stripe portal or account settings content

</deferred>

---

*Phase: 08-settings-refactor*
*Context gathered: 2026-05-20 via direct user specification*
