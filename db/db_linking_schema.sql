-- Add columns to user_shifts for enhanced linking logic
ALTER TABLE user_shifts
ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS address TEXT;