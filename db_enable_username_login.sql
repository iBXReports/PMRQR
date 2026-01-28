-- 1. Añadir columna de email a perfiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email text;
-- 2. Actualizar la función del trigger para incluir el email
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger AS $$ BEGIN
INSERT INTO public.profiles (
        id,
        username,
        full_name,
        address,
        commune,
        phone,
        email
    )
VALUES (
        new.id,
        new.raw_user_meta_data->>'username',
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'address',
        new.raw_user_meta_data->>'commune',
        new.raw_user_meta_data->>'phone',
        new.email
    );
RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 3. Sincronizar correos existentes (Opcional, pero recomendado)
-- Nota: Esto solo funcionará si lo corres como superusuario en la consola de Supabase
-- UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE p.id = u.id;