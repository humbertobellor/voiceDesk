-- Fix L-20: token_expiry can be null for service account OAuth configurations
-- Google's tokens.expiry_date is null in certain token types.
ALTER TABLE calendar_credentials ALTER COLUMN token_expiry DROP NOT NULL;
