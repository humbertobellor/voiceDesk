-- 20260524000016_phase11_is_active_trial_ends_at.sql
-- Phase 11: Account page subscription load fix + BILL-03 deactivation
-- Addresses decisions D-04 (trial_ends_at) and D-07 (is_active deactivation flag).
-- RLS: existing contractors table policies in 20260504000002_rls_policies.sql cover all four
--   operations (SELECT/INSERT/UPDATE/DELETE) by contractor_id.
--   New columns are automatically covered by existing policies — no new policy changes needed.

ALTER TABLE contractors
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE contractors
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

COMMENT ON COLUMN contractors.is_active IS
  'D-07: Phase 11 deactivation flag. FALSE when subscription lapses (set by stripe-payment-failure Inngest function). Replaces agent_sync_status=''failed'' hack.';

COMMENT ON COLUMN contractors.trial_ends_at IS
  'D-04: Phase 11 trial end date from Stripe subscription.trial_end. Set by handleSubscriptionUpdated when status transitions to trialing. NULL until first trialing subscription created.';
