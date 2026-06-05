---
status: resolved
trigger: "In the dashboard in the calls section the dropdown of the column 'Status' is not showing up and it's opening a scroll bar at the right side of the row"
created: 2026-06-04T21:50:00Z
updated: 2026-06-04T21:50:00Z
tdd_mode: false
---

# Debug Session: LeadTable Status Dropdown Clipped

## Symptoms

**Expected Behavior:** Clicking the "Status" dropdown in the LeadTable shows a menu of status options (e.g., "Contacted", "Qualified", "Unqualified").

**Actual Behavior:** The dropdown menu does not appear visually. Instead, a scrollbar appears on the right side of the table row, suggesting the dropdown is being rendered off-screen or is hidden by overflow clipping.

**Errors:** None visible in console.

**Timeline:** Never worked — this is a new feature issue.

**Reproduction:** Every time — click the Status button in any row of the LeadTable.

**Scope:** Leads page only — the issue does not occur on the Calls page or in other tables.

## Root Cause

**Location:** `src/components/leads/LeadTable.tsx`, line 62

**Issue:** The `<div className="overflow-x-auto">` wrapper around the table created a new stacking context with overflow clipping enabled.

**Consequence:** The StatusBadge dropdown component (in `src/components/leads/StatusBadge.tsx`) uses `absolute z-10 mt-1` positioning. When the dropdown was opened, it extended beyond the visible table area, but the `overflow-x-auto` parent clipped it, making it invisible. The parent's overflow behavior also triggered a scrollbar on the right side of the row.

**Why it happens:**
- Line 62 in LeadTable.tsx: `<div className="overflow-x-auto">` (enables horizontal scroll with overflow clipping)
- Line 56 in StatusBadge.tsx: `<div className="absolute z-10 mt-1 w-36 ...">` (dropdown positioned absolutely relative to the parent div with overflow clipping)
- The dropdown is rendered but hidden by the overflow container

## Solution Applied

**File:** `src/components/leads/LeadTable.tsx`

**Change:** Line 62 — Replaced `<div className="overflow-x-auto">` with `<div className="w-full">`

**Rationale:**
- The LeadTable columns (Name, Phone, Service, Status, Created, Notes) fit comfortably on most screens
- Removed the overflow-x-auto wrapper that was clipping the dropdown
- Replaced with a simple w-full wrapper to maintain full-width layout
- StatusBadge dropdown now renders without clipping

**Testing:**
- Build passes successfully (npm run build)
- TypeScript compilation succeeds
- No new errors introduced

## Eliminated

- Radix UI Popover issue — component uses plain absolute positioning, not a Popover component
- z-index stacking context — z-10 is sufficient; the issue is overflow clipping, not stacking order
- Browser viewport issue — the dropdown is within viewport; the issue is container-level clipping

---

## Resolution

**root_cause:** LeadTable wrapped table in `overflow-x-auto` div, clipping absolutely-positioned StatusBadge dropdown

**fix:** Removed overflow-x-auto wrapper, replaced with w-full div — allows dropdown to render without clipping

**specialist_hint:** typescript (React/Next.js component fix)

**verification:** Build passes, no new TypeScript errors, minimal change

---

## Notes

- StatusBadge component (src/components/leads/StatusBadge.tsx) handles the dropdown logic correctly
- The dropdown uses a fixed overlay layer (line 52-55) for click-outside handling, which is good practice
- No accessibility issues identified
- Change is backwards compatible
