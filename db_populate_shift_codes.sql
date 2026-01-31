-- Clear existing codes to avoid duplicates (optional, be careful)
-- TRUNCATE TABLE public.shift_codes;
INSERT INTO public.shift_codes (name, start_time, end_time, category, type)
VALUES -- MAÑANA (Generic)
    ('M1', '07:00', '15:00', 'M', 'turno'),
    ('M2', '08:00', '16:00', 'M', 'turno'),
    ('M3', '09:00', '17:00', 'M', 'turno'),
    ('M4', '10:00', '18:00', 'M', 'turno'),
    ('M5', '06:00', '14:00', 'M', 'turno'),
    -- MAÑANA (Explicit)
    ('M0700', '07:00', '15:00', 'M', 'turno'),
    ('M0800', '08:00', '16:00', 'M', 'turno'),
    ('M0600', '06:00', '14:00', 'M', 'turno'),
    -- TARDE (Generic)
    ('T1', '15:00', '23:00', 'T', 'turno'),
    ('T2', '14:00', '22:00', 'T', 'turno'),
    ('T3', '16:00', '00:00', 'T', 'turno'),
    ('T4', '13:00', '21:00', 'T', 'turno'),
    -- TARDE (Explicit)
    ('T1500', '15:00', '23:00', 'T', 'turno'),
    ('T1400', '14:00', '22:00', 'T', 'turno'),
    -- NOCHE (Generic)
    ('N1', '23:00', '07:00', 'N', 'turno'),
    ('N2', '00:00', '08:00', 'N', 'turno'),
    ('N3', '22:00', '06:00', 'N', 'turno'),
    -- NOCHE (Explicit)
    ('N2300', '23:00', '07:00', 'N', 'turno'),
    ('N2200', '22:00', '06:00', 'N', 'turno'),
    -- ADMINISTRATIVOS / ESPECIALES
    ('S1', '09:00', '18:00', 'S', 'turno'),
    -- Standard Office
    ('S2', '08:30', '17:30', 'S', 'turno'),
    ('ADM', '09:00', '18:00', 'S', 'turno'),
    -- LICENCIAS / AUSENCIAS (No times needed usually, but good to have)
    ('L', null, null, 'L', 'libre'),
    ('LI', null, null, 'L', 'libre'),
    ('LIBRE', null, null, 'L', 'libre'),
    ('AU', null, null, 'AU', 'ausencia'),
    ('VAC', null, null, 'VAC', 'vacaciones'),
    ('LM', null, null, 'LM', 'licencia');