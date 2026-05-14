-- Allow null caller_phone in leads since not all calls have phone numbers
ALTER TABLE leads ALTER COLUMN caller_phone DROP NOT NULL;