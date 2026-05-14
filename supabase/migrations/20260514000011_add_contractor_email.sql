-- Add email column to contractors table for Stripe checkout
-- Fixes: can't query auth.users directly with service role
ALTER TABLE contractors ADD COLUMN email TEXT;

-- Backfill existing contractors from auth.users (if any exist)
UPDATE contractors c
SET email = u.email
FROM auth.users u
WHERE c.user_id = u.id AND c.email IS NULL;

-- Add NOT NULL constraint for new inserts (existing rows may have NULL)
ALTER TABLE contractors ALTER COLUMN email SET NOT NULL;