-- Migration: Add logo_url column to airlines table
-- Run this script in your Supabase SQL Editor
-- 1. Add the logo_url column
ALTER TABLE public.airlines
ADD COLUMN IF NOT EXISTS logo_url text;
-- 2. Update existing airlines with their logos
UPDATE public.airlines
SET logo_url = 'https://logos-world.net/wp-content/uploads/2020/03/LATAM-Logo.png'
WHERE iata_code = 'LA';
UPDATE public.airlines
SET logo_url = 'https://logos-world.net/wp-content/uploads/2020/11/Delta-Air-Lines-Logo.png'
WHERE iata_code = 'DL';
UPDATE public.airlines
SET logo_url = 'https://logos-world.net/wp-content/uploads/2020/03/Air-France-Logo.png'
WHERE iata_code = 'AF';
UPDATE public.airlines
SET logo_url = 'https://logos-world.net/wp-content/uploads/2021/02/Air-Canada-Logo.png'
WHERE iata_code = 'AC';
UPDATE public.airlines
SET logo_url = 'https://logos-world.net/wp-content/uploads/2020/10/KLM-Logo.png'
WHERE iata_code = 'KL';
UPDATE public.airlines
SET logo_url = 'https://logos-world.net/wp-content/uploads/2020/10/Iberia-Logo.png'
WHERE iata_code = 'IB';
UPDATE public.airlines
SET logo_url = 'https://logos-world.net/wp-content/uploads/2020/03/Qantas-Logo.png'
WHERE iata_code = 'QF';
UPDATE public.airlines
SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/LEVEL_logo.svg/1200px-LEVEL_logo.svg.png'
WHERE iata_code = 'LL';
UPDATE public.airlines
SET logo_url = 'https://logos-world.net/wp-content/uploads/2020/03/British-Airways-Logo.png'
WHERE iata_code = 'BA';
UPDATE public.airlines
SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Arajet_logo.svg/1200px-Arajet_logo.svg.png'
WHERE iata_code = 'DM';
UPDATE public.airlines
SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/BOA_Logo.svg/1200px-BOA_Logo.svg.png'
WHERE iata_code = 'OB';
UPDATE public.airlines
SET logo_url = 'https://logos-world.net/wp-content/uploads/2023/01/Aerolineas-Argentinas-Logo.png'
WHERE iata_code = 'AR';
UPDATE public.airlines
SET logo_url = 'https://logos-world.net/wp-content/uploads/2020/11/Copa-Airlines-Logo.png'
WHERE iata_code = 'CM';