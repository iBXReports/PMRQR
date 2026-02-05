-- Add email column to agent_predata for bulk imports
ALTER TABLE agent_predata
ADD COLUMN IF NOT EXISTS email TEXT;