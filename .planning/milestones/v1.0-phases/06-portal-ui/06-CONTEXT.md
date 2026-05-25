---
name: 06-portal-ui-context
description: Phase 6 Portal UI - contractor dashboard with call log, leads, agent config, and real-time updates
metadata:
  type: context
  phase: 6
  milestone: v1.0
---

# Phase 6: Portal UI — Context

**Created:** 2026-05-12
**Phase:** 06 — Portal UI
**Goal:** Contractors can review every call, play recordings, manage leads, and configure their agent — all from a real-time-updating web dashboard.

---

## Domain

Contractor-facing dashboard for managing:
- **Call log** — View, playback recordings, read transcripts
- **Lead management** — View qualified leads, update status
- **Agent configuration** — Edit business info, hours, keywords, voice
- **Real-time updates** — Live data as calls come in

---

## Prior Decisions

From earlier phases:
- **Storage:** Supabase Storage (private bucket, 60-second TTL signed URLs for recordings) — per ROADMAP.md
- **Auth:** Supabase Auth (`@supabase/ssr`) — from Phase 1
- **Dashboard shell exists:** `/src/app/(dashboard)/` with Sidebar, calls page, leads page, settings/agent page (language only currently)
- **Empty states:** Calls and leads pages currently show EmptyState component

---

## Decisions

### Call Log Layout + Playback

| Decision | Value |
|----------|-------|
| Layout | Table with columns |
| Columns | Date, caller name, phone, duration, intent, summary (6 columns) |
| Pagination | Infinite scroll (load more on scroll) |
| Playback | Inline modal — click row opens modal with audio player + transcript |
| Data source | `calls` table — fields: caller_phone, caller_name, duration_seconds, intent, summary, recording_url, transcript |

### Lead List + Status Workflow

| Decision | Value |
|----------|-------|
| Layout | Table with columns |
| Columns | Name, phone, service, status, created date, notes preview |
| Status change | Click status badge → dropdown to change (Won/Lost/Contacted/Booked/New) |
| Filtering | Multiple filters — status dropdown, date range picker, service type filter |
| Data source | `leads` table — fields: caller_name, caller_phone, service_requested, service_type, status, notes, created_at |

### Agent Configuration Form

| Decision | Value |
|----------|-------|
| Structure | Tabbed/stepped (not single long form) |
| Tabs | Business Info \| Hours \| Keywords \| Voice (4 tabs) |
| First tab content | Full config: business name, trade type, service area, phone, supported languages |
| Other tabs | Hours (business_hours), Keywords (emergency_keywords), Voice (agent_voice) |
| Save behavior | Save + async sync — saves to DB, triggers Retell agent update in background (non-blocking) |
| Data source | `contractor_settings` table |
| Related | Uses `retell-agent-sync` Inngest function from Phase 2 |

### Real-Time Updates

| Decision | Value |
|----------|-------|
| Library | React Query (TanStack Query) |
| Real-time mechanism | Supabase Realtime subscription on `calls` table |
| Integration | React Query cache invalidation on Supabase realtime `INSERT` event |
| Expected behavior | New call appears at top of call log within 10 seconds (per ROADMAP.md success criteria) |
| Packages needed | `@tanstack/react-query`, `@supabase/realtime` (already in supabase-js) |

---

## Canonical Refs

- `src/types/database.ts` — Call, Lead, ContractorSettings types
- `src/app/(dashboard)/calls/page.tsx` — Existing calls page (empty state)
- `src/app/(dashboard)/leads/page.tsx` — Existing leads page (empty state)
- `src/app/(dashboard)/settings/agent/page.tsx` — Existing agent config (language only)
- `.planning/ROADMAP.md` — Phase 6 goal, success criteria, notes on signed URLs
- `.planning/REQUIREMENTS.md` — PORTAL-01 through PORTAL-05 requirements

---

## Code Context

**Existing dashboard structure:**
```
src/app/(dashboard)/
├── calls/page.tsx      # Empty state — needs call list
├── leads/page.tsx      # Empty state — needs lead list
├── settings/
│   ├── agent/page.tsx  # Language only — needs full config form
│   ├── account/
│   └── notifications/
├── connect-calendar/page.tsx
├── dashboard/
└── layout.tsx
```

**UI components already available:**
- `EmptyState` from `@/components/dashboard/EmptyState`
- Lucide icons (PhoneCall, Users, etc.)

**Libraries to install:**
- `@tanstack/react-query` — for data fetching + caching

---

## Deferred Ideas

- Search functionality across calls/leads (future phase)
- Export to CSV (future phase)
- Email digests of daily call summary (future phase)

---

## Next

`/gsd-plan-phase 6` — Plan the implementation with 4-6 plans based on this context.