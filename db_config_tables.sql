-- 1. CONFIG: AIRLINES
create table if not exists public.airlines (
    id uuid default gen_random_uuid() primary key,
    logo_url text,
    name text not null,
    iata_code text,
    created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table public.airlines enable row level security;
create policy "Read airlines" on public.airlines for
select using (true);
create policy "Manage airlines" on public.airlines for all using (auth.role() = 'authenticated');
-- Simplified for admin use
-- 2. CONFIG: LOCATIONS (Origins, Destinations, Gates, Bridges)
create table if not exists public.locations (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    type text not null check (
        type in (
            'origin',
            'destination',
            'gate',
            'bridge',
            'gate_arrival',
            'position'
        )
    ),
    terminal text,
    -- 'Nacional', 'Internacional', or null (Any)
    created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table public.locations enable row level security;
create policy "Read locations" on public.locations for
select using (true);
create policy "Manage locations" on public.locations for all using (auth.role() = 'authenticated');
-- SEED DATA (To match current hardcoded index.html)
insert into public.airlines (logo_url, name, iata_code)
values (
        'https://logos-world.net/wp-content/uploads/2020/03/LATAM-Logo.png',
        'LATAM',
        'LA'
    ),
    (
        'https://logos-world.net/wp-content/uploads/2020/11/Delta-Air-Lines-Logo.png',
        'DELTA',
        'DL'
    ),
    (
        'https://logos-world.net/wp-content/uploads/2020/03/Air-France-Logo.png',
        'AIRFRANCE',
        'AF'
    ),
    (
        'https://logos-world.net/wp-content/uploads/2021/02/Air-Canada-Logo.png',
        'AIR CANADA',
        'AC'
    ),
    (
        'https://logos-world.net/wp-content/uploads/2020/10/KLM-Logo.png',
        'KLM',
        'KL'
    ),
    (
        'https://logos-world.net/wp-content/uploads/2020/10/Iberia-Logo.png',
        'IBERIA',
        'IB'
    ),
    (
        'https://logos-world.net/wp-content/uploads/2020/03/Qantas-Logo.png',
        'QANTAS',
        'QF'
    ),
    (
        'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/LEVEL_logo.svg/1200px-LEVEL_logo.svg.png',
        'LEVEL',
        'LL'
    ),
    (
        'https://logos-world.net/wp-content/uploads/2020/03/British-Airways-Logo.png',
        'BRITISH AIRWAYS',
        'BA'
    ),
    (
        'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Arajet_logo.svg/1200px-Arajet_logo.svg.png',
        'ARAJET',
        'DM'
    ),
    (
        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/BOA_Logo.svg/1200px-BOA_Logo.svg.png',
        'BOA',
        'OB'
    ),
    (
        'https://logos-world.net/wp-content/uploads/2020/11/Copa-Airlines-Logo.png',
        'COPA',
        'CM'
    ),
    (
        'https://logos-world.net/wp-content/uploads/2023/01/Aerolineas-Argentinas-Logo.png',
        'AEROLINEAS ARG',
        'AR'
    );
insert into public.locations (name, type, terminal)
values ('Counter', 'origin', null),
    ('Punto Info', 'origin', null),
    ('Minsal', 'origin', null),
    ('Embarque', 'origin', null),
    ('Arribo', 'origin', null),
    ('Estacionamientos', 'origin', null),
    ('Remoto', 'origin', null),
    ('Counters', 'destination', null),
    ('Arribo', 'destination', null),
    ('Embarque', 'destination', null),
    ('Punto', 'destination', null),
    ('Remoto', 'destination', null),
    ('Puente A', 'bridge', 'Nacional'),
    ('Puente B', 'bridge', 'Nacional'),
    ('Puente C', 'bridge', 'Internacional'),
    ('Puente D', 'bridge', 'Internacional'),
    ('Puente E', 'bridge', 'Internacional'),
    ('Puente F', 'bridge', 'Internacional');