-- Script para generar y actualizar URLs masivamente para todos los equipos
-- Reemplaza 'TU_URL_DOMINIO' con la URL real de tu servidor (ej: https://pmrqr-sistema.com)
DO $$
DECLARE base_url text := 'https://plpnypzesupfczxrzgwb.supabase.co/storage/v1/render/image/public/assets';
-- Ajusta esto a tu dominio real si es necesario
-- O mejor, usa una ruta relativa que funcione con el despliegue actual
asset_record RECORD;
BEGIN -- Iterar por todos los activos
FOR asset_record IN
SELECT id,
    code
FROM public.assets LOOP -- Actualizar con links dinámicos basados en el ID del equipo
    -- El formato asume que index.html maneja los parámetros de la URL
UPDATE public.assets
SET start_link = 'https://ibxreports.github.io/PMRQR/index.html?asset=' || asset_record.id || '&action=start',
    return_link = 'https://ibxreports.github.io/PMRQR/index.html?asset=' || asset_record.id || '&action=return'
WHERE id = asset_record.id;
END LOOP;
END $$;