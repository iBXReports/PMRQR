-- 1. Ensure pgcrypto extension is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- 2. Update existing 'Administrador' or 'admin_sistema@pmrqr.com' user if they exist
DO $$
DECLARE target_user_id UUID;
BEGIN -- Try to find the old admin user by specific email
SELECT id INTO target_user_id
FROM auth.users
WHERE email = 'admin_sistema@pmrqr.com';
-- If not found by email, try to find by profile username
IF target_user_id IS NULL THEN
SELECT id INTO target_user_id
FROM public.profiles
WHERE username = 'Administrador';
END IF;
-- If still not found, check if the NEW email already exists (maybe they ran this partialy before)
IF target_user_id IS NULL THEN
SELECT id INTO target_user_id
FROM auth.users
WHERE email = 'iansaavedra21@gmail.com';
END IF;
-- IF WE FOUND A USER TO UPDATE
IF target_user_id IS NOT NULL THEN -- Update auth.users
UPDATE auth.users
SET email = 'iansaavedra21@gmail.com',
    encrypted_password = crypt('Leon2023', gen_salt('bf')),
    raw_user_meta_data = '{"username": "StbcK", "full_name": "Administrador StbcK"}'::jsonb,
    updated_at = now(),
    email_confirmed_at = now()
WHERE id = target_user_id;
-- Update public.profiles
-- We use ON CONFLICT just in case, or simple update
UPDATE public.profiles
SET username = 'StbcK',
    full_name = 'Administrador StbcK',
    email = 'iansaavedra21@gmail.com',
    role = 'admin'
WHERE id = target_user_id;
ELSE -- CREATE NEW USER IF DOES NOT EXIST
target_user_id := gen_random_uuid();
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
        target_user_id,
        'iansaavedra21@gmail.com',
        crypt('Leon2023', gen_salt('bf')),
        now(),
        '{"username": "StbcK", "full_name": "Administrador StbcK"}'::jsonb,
        now(),
        now(),
        'authenticated',
        'authenticated',
        ''
    );
-- Profile (should be handled by trigger, but we force it to ensure correct data)
INSERT INTO public.profiles (id, username, full_name, email, role)
VALUES (
        target_user_id,
        'StbcK',
        'Administrador StbcK',
        'iansaavedra21@gmail.com',
        'admin'
    ) ON CONFLICT (id) DO
UPDATE
SET username = 'StbcK',
    full_name = 'Administrador StbcK',
    email = 'iansaavedra21@gmail.com',
    role = 'admin';
END IF;
END $$;