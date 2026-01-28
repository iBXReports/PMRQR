-- Reset and Seed Airlines Table
delete from public.airlines;
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
        'https://logos-world.net/wp-content/uploads/2023/01/Aerolineas-Argentinas-Logo.png',
        'AEROLINEAS ARG',
        'AR'
    ),
    (
        'https://logos-world.net/wp-content/uploads/2020/11/Copa-Airlines-Logo.png',
        'COPA',
        'CM'
    );