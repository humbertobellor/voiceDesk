---
phase: 06-portal-ui
plan: 02
status: complete
completed: 2026-05-12
---

## Wave 2: Lead List with Status Workflow

### What Was Built

Created lead list with status dropdown, filtering, and CRUD operations:

- **src/components/leads/StatusBadge.tsx** — Status badge component:
  - Display status as colored badge (new=blue, contacted=orange, booked=green, won=emerald, lost=gray)
  - On click, shows dropdown to change status
  - Options: new, contacted, booked, won, lost
  - On selection, calls useUpdateLeadStatus mutation
  - Shows loading state while pending

- **src/components/leads/LeadFilters.tsx** — Filter controls:
  - Status dropdown: All, New, Contacted, Booked, Won, Lost
  - Date range picker: two date inputs (from/to)
  - Service type filter: All, HVAC, Plumbing, Electrical, General
  - Clear filters button resets all to default
  - Expandable/collapsible filter panel

- **src/components/leads/LeadTable.tsx** — Lead list table:
  - Table columns: Name, Phone, Service, Status (StatusBadge), Created, Notes (truncated to 50 chars)
  - Sorted by created_at descending (newest first)
  - Pagination similar to CallLogTable (50 per page)
  - Loading and empty states

- **src/app/(dashboard)/leads/page.tsx** — Updated to render LeadFilters + LeadTable

### Verification

- [x] npm run typecheck passes

### Key Decisions

- Status badge dropdown implemented with portal-style positioning
- Filters use controlled component pattern with parent state
- Pagination mirrors CallLogTable pattern for consistency

### Notes

- Filters are applied client-side via React Query query params
- Status changes trigger immediate invalidation of leads query