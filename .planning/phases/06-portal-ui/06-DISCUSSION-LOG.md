---
name: 06-portal-ui-discussion-log
description: Discussion log for Phase 6 Portal UI
metadata:
  type: discussion-log
  phase: 6
---

# Phase 6 Discussion Log

**Date:** 2026-05-12

## Areas Discussed

### 1. Call Log Layout + Playback

**Q: How should the call log display calls?**
- Options: Table with columns / Card-based list
- **Selection:** Table with columns

**Q: Which columns should the table show?**
- Options: Full detail (Date, caller name, phone, duration, intent, summary) / Compact
- **Selection:** Full detail

**Q: How should pagination work?**
- Options: Infinite scroll / Numbered pages
- **Selection:** Infinite scroll

**Q: When clicking a call, how should playback work?**
- Options: Inline modal / Dedicated page
- **Selection:** Inline modal

### 2. Lead List + Status Workflow

**Q: How should the lead list display?**
- Options: Table layout / Card layout
- **Selection:** Table layout

**Q: Which columns should the lead table show?**
- Options: Full detail (Name, phone, service, status, created date, notes preview) / Compact
- **Selection:** Full detail

**Q: How should lead status changes work?**
- Options: Click badge to change / Actions menu
- **Selection:** Click badge to change

**Q: Should leads have filtering options?**
- Options: Status filter only / Multiple filters
- **Selection:** Multiple filters (status + date range + service type)

### 3. Agent Configuration Form

**Q: How should the agent configuration form be structured?**
- Options: Single form / Tabbed/stepped
- **Selection:** Tabbed/stepped

**Q: Which fields should the first tab (Business Info) include?**
- Options: Basic info / Basic + languages / Full config
- **Selection:** Full config

**Q: When saving agent config, how should Retell sync work?**
- Options: Save + async sync / Save then sync
- **Selection:** Save + async sync

### 4. Real-Time Updates

**Q: Which data fetching library should the dashboard use?**
- Options: SWR / React Query (TanStack) / Supabase React hooks
- **Selection:** React Query (TanStack)

**Q: How should real-time updates work with React Query?**
- Options: Cache invalidation on event / Polling on interval
- **Selection:** Cache invalidation on event

---

## Summary

All four areas discussed and decisions captured in 06-CONTEXT.md.