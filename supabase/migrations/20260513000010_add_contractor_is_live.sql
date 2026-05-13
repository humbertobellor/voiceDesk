-- Add is_live column to contractors table
-- Used to track whether contractor has completed onboarding and is live
-- This is set to true after test call verification in the onboarding wizard

ALTER TABLE contractors
ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT false;

-- Add index for efficient queries on is_live status
CREATE INDEX IF NOT EXISTS idx_contractors_is_live ON contractors(is_live);