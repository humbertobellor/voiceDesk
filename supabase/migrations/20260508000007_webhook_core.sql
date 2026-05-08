-- 20260508000007_webhook_core.sql
-- Phase 3: Webhook Core — adds analysis_status to calls;
-- adds notify_on_general_inquiry to notification_settings.
-- D-03: analysis_status tracks the two-stage call enrichment lifecycle:
--   pending (DB default) → analyzing (call_ended) → complete (call_analyzed) → analysis_failed (Inngest timeout).
-- D-15: notify_on_general_inquiry controls Phase 5 notification dispatch for info calls.
-- RLS: existing policies in 20260504000002_rls_policies.sql cover calls and notification_settings
--   with all four operations (SELECT/INSERT/UPDATE/DELETE) by contractor_id.
--   New columns are automatically covered by existing policies — no new policy changes needed.
--   Verified: calls policies cover all operations; notification_settings policies cover all operations.

-- 1. Add analysis_status to calls (D-03)
ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS analysis_status TEXT
    CHECK (analysis_status IS NULL OR analysis_status IN ('pending', 'analyzing', 'complete', 'analysis_failed'))
    DEFAULT 'pending';

COMMENT ON COLUMN calls.analysis_status IS 'D-03: pending (default) → analyzing (call_ended fires) → complete (call_analyzed + LLM done) → analysis_failed (Inngest timeout or all retries exhausted)';

-- 2. Add notify_on_general_inquiry to notification_settings (D-15)
ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS notify_on_general_inquiry BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN notification_settings.notify_on_general_inquiry IS 'D-15: controls whether Phase 5 dispatches notifications for intent=info calls. Default false. Phase 6 portal adds checkbox.';
