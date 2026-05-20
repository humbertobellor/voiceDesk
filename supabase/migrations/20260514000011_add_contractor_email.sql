-- Add email column to contractors table for Stripe checkout.
-- Safe migration pattern: DEFAULT '' prevents NOT NULL failure on orphaned rows.
-- ADD COLUMN IF NOT EXISTS is idempotent — safe to re-apply on existing databases.

ALTER TABLE contractors ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';

-- Backfill from auth.users for all rows that still have the empty-string default.
-- Rows with a real email (from a previous partial run) are not overwritten.
UPDATE contractors c
SET email = u.email
FROM auth.users u
WHERE c.user_id = u.id
  AND c.email = '';

-- Remove the default so future inserts must supply a real email.
ALTER TABLE contractors ALTER COLUMN email DROP DEFAULT;
