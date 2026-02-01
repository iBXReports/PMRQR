-- =====================================================
-- ATTENDANCE TABLE
-- Stores daily attendance records for agents
-- Tracks: Asistencia, Observaciones, and Colaciones
-- =====================================================
-- Create the attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    rut TEXT,
    user_name TEXT,
    shift_date DATE NOT NULL,
    -- Asistencia: Presente, Ausente, Licencia
    attendance_status TEXT DEFAULT 'pending' CHECK (
        attendance_status IN ('pending', 'presente', 'ausente', 'licencia')
    ),
    -- Observaciones
    observation TEXT DEFAULT 'SIN OBS' CHECK (
        observation IN (
            'RENUNCIA',
            '2° DIA AUSENTE',
            '3° DIA AUSENTE',
            'LLEGA TARDE',
            'NO LLEGA',
            'NO TOMA VAN',
            'NO RESPONDE',
            'NO SE REPORTA',
            'LICENCIA MEDICA',
            'EXTENDIDO//HRS EXTRA',
            'SIN OBS',
            'NO SE LE ASIGNO MOVIL',
            'ENFERM@',
            'PROBLEMA PERSONAL',
            'PERSONAL NUEVO'
        )
    ),
    -- Colaciones
    colation_status TEXT DEFAULT 'pendiente' CHECK (colation_status IN ('pendiente', 'ok')),
    -- Metadata
    updated_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Create unique index on rut + shift_date (only one of these should be unique)
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_rut_date ON attendance(rut, shift_date)
WHERE rut IS NOT NULL;
-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(shift_date);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(attendance_status);
-- Enable RLS
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated read attendance" ON attendance;
DROP POLICY IF EXISTS "Allow authenticated insert attendance" ON attendance;
DROP POLICY IF EXISTS "Allow authenticated update attendance" ON attendance;
DROP POLICY IF EXISTS "Allow authenticated delete attendance" ON attendance;
-- Policy: Authenticated users can read all
CREATE POLICY "Allow authenticated read attendance" ON attendance FOR
SELECT USING (auth.role() = 'authenticated');
-- Policy: Authenticated users can insert
CREATE POLICY "Allow authenticated insert attendance" ON attendance FOR
INSERT WITH CHECK (auth.role() = 'authenticated');
-- Policy: Authenticated users can update
CREATE POLICY "Allow authenticated update attendance" ON attendance FOR
UPDATE USING (auth.role() = 'authenticated');
-- Policy: Authenticated users can delete
CREATE POLICY "Allow authenticated delete attendance" ON attendance FOR DELETE USING (auth.role() = 'authenticated');
-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_attendance_timestamp() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS attendance_updated_at ON attendance;
CREATE TRIGGER attendance_updated_at BEFORE
UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION update_attendance_timestamp();
-- Grant permissions  
GRANT ALL ON attendance TO authenticated;