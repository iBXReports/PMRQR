-- Add new columns to profiles table for granular name and address
-- and new course certifications
-- 1. Split Name Fields
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS middle_name TEXT;
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_name_1 TEXT;
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_name_2 TEXT;
-- 2. Granular Address Fields
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS address_street TEXT;
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS address_number TEXT;
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS address_unit TEXT;
-- Depto/Block/Casa
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS commune TEXT;
-- 3. Course Certifications
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS course_golf BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS course_duplex BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS course_oruga BOOLEAN DEFAULT FALSE;
-- 4. Update agent_predata to match (for pre-registration matching)
ALTER TABLE agent_predata
ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE agent_predata
ADD COLUMN IF NOT EXISTS middle_name TEXT;
ALTER TABLE agent_predata
ADD COLUMN IF NOT EXISTS last_name_1 TEXT;
ALTER TABLE agent_predata
ADD COLUMN IF NOT EXISTS last_name_2 TEXT;
ALTER TABLE agent_predata
ADD COLUMN IF NOT EXISTS address_street TEXT;
ALTER TABLE agent_predata
ADD COLUMN IF NOT EXISTS address_number TEXT;
ALTER TABLE agent_predata
ADD COLUMN IF NOT EXISTS address_unit TEXT;
ALTER TABLE agent_predata
ADD COLUMN IF NOT EXISTS commune TEXT;
ALTER TABLE agent_predata
ADD COLUMN IF NOT EXISTS course_golf BOOLEAN DEFAULT FALSE;
ALTER TABLE agent_predata
ADD COLUMN IF NOT EXISTS course_duplex BOOLEAN DEFAULT FALSE;
ALTER TABLE agent_predata
ADD COLUMN IF NOT EXISTS course_oruga BOOLEAN DEFAULT FALSE;
ALTER TABLE agent_predata
ADD COLUMN IF NOT EXISTS username TEXT;
-- To pre-reserve username