---
phase: 06-portal-ui
plan: 04
status: complete
completed: 2026-05-12
---

## Wave 4: Real-time Updates

### What Was Built

Integrated Supabase Realtime for live dashboard updates:

- **src/lib/realtime/callsSubscription.ts** — Calls subscription hook:
  - Uses supabase.channel('calls-realtime-{contractorId}')
  - Listens for INSERT events on calls table filtered by contractor_id
  - On new call, invalidates React Query 'calls' cache to refetch
  - Cleanup on unmount

- **src/lib/realtime/leadsSubscription.ts** — Leads subscription hook:
  - Same pattern as callsSubscription for leads table
  - Filters by contractor_id in subscription filter (not callback)

- **src/app/(dashboard)/calls/page.tsx** — Updated with live indicator and subscription

- **src/app/(dashboard)/leads/page.tsx** — Updated with live indicator and subscription

### Verification

- [x] npm run typecheck passes

### Key Decisions

- Subscription filter is applied at Supabase level (`filter: contractor_id=eq.{contractorId}`) for security
- Invalidates query cache on new INSERT events - triggers automatic refetch
- Shows "Live" indicator in page header

### Manual Step Required

**Supabase Dashboard Configuration:**
The calls and leads tables must have Realtime enabled in the Supabase dashboard:
1. Go to your Supabase project
2. Database → Tables → Select "calls" table
3. Enable "Realtime" toggle
4. Repeat for "leads" table

Alternatively, run SQL:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE calls;
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
```

This requires database superuser or REPLICA IDENTITY FULL on the tables.