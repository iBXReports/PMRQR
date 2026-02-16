-- Add status column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
-- Add status column to agent_predata
ALTER TABLE agent_predata
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';