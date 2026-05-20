---
phase: 08-settings-refactor
plan: 01
subsystem: dashboard-layout
tags: [refactor, deletion, dead-code, layout]
dependency_graph:
  requires: []
  provides: [clean-dashboard-layout]
  affects: [src/app/(dashboard)/layout.tsx]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - src/app/(dashboard)/layout.tsx
  deleted:
    - src/components/onboarding/OnboardingWizard.tsx
    - src/components/onboarding/OnboardingWizardWrapper.tsx
    - src/components/onboarding/steps/AgentConfigStep.tsx
    - src/components/onboarding/steps/CalendarConnectStep.tsx
    - src/components/onboarding/steps/CallForwardingStep.tsx
    - src/components/onboarding/steps/PhoneProvisioningStep.tsx
    - src/components/onboarding/steps/TestCallStep.tsx
    - src/components/onboarding/steps/index.ts
    - src/components/dashboard/SetupBanner.tsx
decisions:
  - key: wizard-deletion
    choice: Delete all 9 onboarding component files; re-implement as dedicated settings pages in Plan 02
metrics:
  duration: ~3 min
  completed: "2026-05-20"
  tasks_completed: 2
  tasks_total: 2
  files_deleted: 9
  files_modified: 1
---

# Phase 08 Plan 01: Delete Wizard Components and Clean Dashboard Layout Summary

**One-liner:** Deleted 9 onboarding wizard + SetupBanner component files and stripped their imports/JSX from the dashboard layout, leaving `{children}` rendered directly.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Delete src/components/onboarding/ and SetupBanner | 22133fa | 9 files deleted |
| 2 | Remove wizard and banner from dashboard layout | 22133fa | layout.tsx (-6 lines) |

---

## What Was Done

### Task 1: Deleted 9 component files

All files under `src/components/onboarding/` were removed:
- `OnboardingWizard.tsx` — 5-step modal wizard component
- `OnboardingWizardWrapper.tsx` — wrapper that conditionally rendered wizard for non-active subscriptions
- `steps/AgentConfigStep.tsx`, `CalendarConnectStep.tsx`, `PhoneProvisioningStep.tsx`, `CallForwardingStep.tsx`, `TestCallStep.tsx` — individual wizard step components
- `steps/index.ts` — barrel export

Also deleted: `src/components/dashboard/SetupBanner.tsx` — setup progress banner.

### Task 2: Cleaned dashboard layout

Removed from `src/app/(dashboard)/layout.tsx`:
- Import: `import { SetupBanner } from '@/components/dashboard/SetupBanner'`
- Import: `import { OnboardingWizardWrapper } from '@/components/onboarding/OnboardingWizardWrapper'`
- JSX: `<SetupBanner contractorName={contractor.business_name} />` (was inside `<div className="p-4 md:p-8">`)
- JSX: `<OnboardingWizardWrapper ... />` + preceding HTML comment (was inside `<DashboardProviders>`)

Preserved intact: Sidebar, BottomTabBar, DashboardProviders, auth guard, contractor query (including `twilio_number` for Sidebar), redirect to `/setup/phone`.

---

## Deviations from Plan

None — plan executed exactly as written.

No other files in `src/` were found to import from `src/components/onboarding/`. Other files containing the string "onboarding" reference API route paths, validation schema modules (`src/lib/validations/onboarding.ts`), or comments — none required editing.

---

## Verification Results

| Check | Result |
|-------|--------|
| `src/components/onboarding/` does not exist | PASS |
| `src/components/dashboard/SetupBanner.tsx` does not exist | PASS |
| No `OnboardingWizardWrapper` or `SetupBanner` in layout.tsx | PASS |
| No src/ file imports from components/onboarding/ | PASS |
| Sidebar import present in layout | PASS |
| DashboardProviders present in layout | PASS |
| BottomTabBar present in layout | PASS |
| createSupabaseServer present in layout | PASS |

---

## Known Stubs

None — this plan only deletes files and removes dead imports.

---

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. Auth guard (`if (!contractor?.phone_number) redirect('/setup/phone')`) and contractor_id derivation from `supabase.auth.getUser()` remain unchanged (T-08-01-01, T-08-01-02 mitigations intact).

---

## Self-Check: PASSED

- Commit `22133fa` confirmed present in git log
- `src/components/onboarding/` directory confirmed absent
- `src/components/dashboard/SetupBanner.tsx` confirmed absent
- `src/app/(dashboard)/layout.tsx` confirmed clean of wizard/banner references
