---
phase: 07-billing-onboarding
plan: 03
type: execute
wave: 3
subsystem: onboarding
tags: [onboarding, wizard, modal, ui]
dependency_graph:
  requires:
    - 07-01
    - 07-02
  provides:
    - ONBOARD-01
  affects:
    - src/app/(dashboard)/layout.tsx

tech_stack:
  added:
    - @radix-ui/react-dialog
  patterns:
    - Modal wizard with tab navigation (D-05, D-06)
    - Linear step progression with back navigation
    - Carrier-specific call forwarding codes

key_files:
  created:
    - src/components/onboarding/OnboardingWizard.tsx
    - src/components/onboarding/OnboardingWizardWrapper.tsx
    - src/components/onboarding/steps/AgentConfigStep.tsx
    - src/components/onboarding/steps/CalendarConnectStep.tsx
    - src/components/onboarding/steps/PhoneProvisioningStep.tsx
    - src/components/onboarding/steps/CallForwardingStep.tsx
    - src/components/onboarding/steps/TestCallStep.tsx
  modified:
    - src/app/(dashboard)/layout.tsx

decisions:
  - Used Radix Dialog for modal (existing in project)
  - Tab bar shows all 5 steps at once (D-06 pattern)
  - Linear progression enforced - can go back but not skip ahead
  - TestCallStep is UI stub only, full Realtime in Plan 4

---

# Phase 7 Plan 3: Onboarding Wizard Modal Summary

## Objective

Create modal onboarding wizard with tabs showing all 5 steps (Agent Config → Calendar → Phone Provisioning → Call Forwarding → Test Call). Follows D-05 (modal wizard in existing portal), D-06 (single modal with tabs), D-07 (wizard steps order).

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | OnboardingWizard modal component | a4218c4 | OnboardingWizard.tsx |
| 2 | AgentConfigStep component | a4218c4 | steps/AgentConfigStep.tsx |
| 3 | CalendarConnectStep component | a4218c4 | steps/CalendarConnectStep.tsx |
| 4 | PhoneProvisioningStep component | a4218c4 | steps/PhoneProvisioningStep.tsx |
| 5 | CallForwardingStep component | a4218c4 | steps/CallForwardingStep.tsx |
| 6 | TestCallStep component (stub) | a4218c4 | steps/TestCallStep.tsx |
| 7 | Integrate wizard into dashboard | a4218c4 | layout.tsx, OnboardingWizardWrapper.tsx |

## Verification

- All 6 step components created with >30 lines each
- Wizard component has >50 lines with full tab navigation
- Tab navigation works - all 5 steps visible (D-06)
- Step order enforced via canProceed logic (T-07-03-01)
- Carrier codes displayed: AT&T *72, Verizon *72, T-Mobile ##21#
- Wizard triggers for subscription_status != 'active'

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

- TestCallStep uses polling stub for call verification - full Realtime subscription integration in Plan 4
- CallForwardingStep uses placeholder phone number - will be wired to actual provisioned number in Plan 2/4

## Threat Flags

None - no new security surface introduced beyond what was in threat_model.

---

## Self-Check: PASSED

- [x] All step components created
- [x] Wizard modal created with tab navigation
- [x] Layout integration complete
- [x] Commit a4218c4 exists