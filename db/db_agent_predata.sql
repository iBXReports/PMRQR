-- =====================================================
-- AGENT PRE-DATA TABLE
-- Stores Excel imported data for auto-complete during registration
-- This data is used BEFORE users register to pre-fill their info
-- =====================================================
-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS agent_predata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rut TEXT UNIQUE,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    -- Street/Pasaje only
    addr_number TEXT,
    -- House number (separate from address)
    commune TEXT,
    team TEXT,
    tica_status TEXT DEFAULT 'sin_tica' CHECK (
        tica_status IN (
            'vigente',
            'por_vencer',
            'vencida',
            'en_tramite',
            'sin_tica'
        )
    ),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Add addr_number column if table already exists
ALTER TABLE agent_predata
ADD COLUMN IF NOT EXISTS addr_number TEXT;
-- Add tica_status column if table already exists
ALTER TABLE agent_predata
ADD COLUMN IF NOT EXISTS tica_status TEXT DEFAULT 'sin_tica';
-- Create index on rut for fast lookups
CREATE INDEX IF NOT EXISTS idx_agent_predata_rut ON agent_predata(rut);
-- Create index on full_name for name-based lookups
CREATE INDEX IF NOT EXISTS idx_agent_predata_name ON agent_predata(full_name);
-- Enable RLS but allow anonymous read for registration auto-complete
ALTER TABLE agent_predata ENABLE ROW LEVEL SECURITY;
-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow public read for registration" ON agent_predata;
DROP POLICY IF EXISTS "Allow authenticated insert" ON agent_predata;
DROP POLICY IF EXISTS "Allow authenticated update" ON agent_predata;
-- Policy: Anyone can read (for registration auto-complete)
CREATE POLICY "Allow public read for registration" ON agent_predata FOR
SELECT USING (true);
-- Policy: Only authenticated users can insert/update (admins importing Excel)
CREATE POLICY "Allow authenticated insert" ON agent_predata FOR
INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update" ON agent_predata FOR
UPDATE USING (auth.role() = 'authenticated');
-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_agent_predata_timestamp() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS agent_predata_updated_at ON agent_predata;
CREATE TRIGGER agent_predata_updated_at BEFORE
UPDATE ON agent_predata FOR EACH ROW EXECUTE FUNCTION update_agent_predata_timestamp();
-- Grant permissions  
GRANT SELECT ON agent_predata TO anon;
GRANT ALL ON agent_predata TO authenticated;