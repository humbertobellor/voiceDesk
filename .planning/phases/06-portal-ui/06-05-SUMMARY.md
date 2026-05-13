---
phase: 06-portal-ui
plan: 05
status: complete
completed: 2026-05-12
---

## Wave 5: Call Recordings Playback

### What Was Built

Implemented call recording playback with modal:

- **src/app/api/recordings/route.ts** — Signed URL API endpoint:
  - GET endpoint accepting ?callId={id}
  - Verifies user session and contractor ownership (RLS enforced)
  - Fetches call row to get recording_url (storage path)
  - Uses supabase.storage.from('recordings').createSignedUrl(path, 60) — 60s TTL
  - Returns signed URL in JSON response
  - dynamic = 'force-dynamic' (no static generation)

- **src/components/calls/CallPlaybackModal.tsx** — Full playback modal:
  - Uses @radix-ui/react-dialog for accessible modal
  - Header: Caller name, phone, date/time, duration
  - Audio player with play/pause button
  - Transcript section (handles both array format from Retell and string format)
  - Loading skeleton while fetching signed URL
  - Error state if recording unavailable
  - Graceful handling for empty transcript

- **CallLogTable already has onCallClick** — Already wired in Plan 01

### Verification

- [x] npm run typecheck passes

### Key Decisions

- 60-second TTL on signed URLs limits exposure window
- API verifies session + RLS ensures contractor owns call
- Transcript rendering handles both array and string formats
- Modal closes on X button, outside click, or Escape key

### Notes

- @radix-ui/react-dialog installed for accessible modal
- Uses native HTML5 audio element for playback
- Recording storage bucket must be named 'recordings' in Supabase