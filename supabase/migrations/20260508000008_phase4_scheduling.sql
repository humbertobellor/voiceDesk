-- 20260508000008_phase4_scheduling.sql
-- Phase 4: Scheduling & Lead Capture — adds scheduling and lead capture columns.
-- D-06: appointment_duration_minutes → contractor_settings (default 2 hours)
-- D-14: google_sync_status → appointments (lifecycle: pending→synced|failed|skipped)
-- D-10: booking_conflict → leads (NOT appointments — UNIQUE(contractor_id, starts_at) on
--   appointments makes a second row for the same slot impossible regardless of any column value;
--   the losing caller's LEAD is marked booking_conflict=true instead)
-- RLS: existing policies in 20260504000002_rls_policies.sql cover contractor_settings,
--   appointments, and leads with all four operations (SELECT/INSERT/UPDATE/DELETE) per
--   contractor_id. New columns on existing tables are automatically covered — no new policies.

-- 1. Add appointment_duration_minutes to contractor_settings (D-06)
ALTER TABLE contractor_settings
  ADD COLUMN IF NOT EXISTS appointment_duration_minutes INT NOT NULL DEFAULT 120;

COMMENT ON COLUMN contractor_settings.appointment_duration_minutes IS
  'D-06: default 2 hours (120 min). Phase 6 portal allows contractor to select 60/90/120/180 min.';

-- 2. Add Google Calendar sync status to appointments (D-14)
--    Column is NOT NULL to prevent ambiguous NULL state; DEFAULT ''pending'' for all new rows.
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS google_sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (google_sync_status IN ('pending', 'synced', 'failed', 'skipped'));

COMMENT ON COLUMN appointments.google_sync_status IS
  'D-14: pending (row created) → synced (google_event_id written) → failed (all Inngest retries exhausted) → skipped (no calendar_credentials row for contractor).';

-- 3. Add booking_conflict flag to leads (D-10)
--    See: RESEARCH.md UNIQUE Constraint Conflict Handling section for why this goes on
--    leads and NOT appointments. Appointment winner keeps starts_at; losing lead is flagged.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS booking_conflict BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN leads.booking_conflict IS
  'D-10: true when the requested appointment slot was already taken (UNIQUE violation on appointments). Contractor sees this lead in portal (Phase 6) and calls back this customer.';
