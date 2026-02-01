import { supabase } from '../../assets/js/client.js';

// Init
window.initMovilizacion = async function () {
    const dateInput = document.getElementById('movil-date');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    loadRequesters();
};

async function loadRequesters() {
    const { data: users, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['Administrador', 'Supervisor', 'CDO'])
        .order('full_name');

    const select = document.getElementById('movil-requester');
    select.innerHTML = '<option value="">Seleccione...</option>';

    if (users) {
        const { data: { user } } = await supabase.auth.getUser();
        users.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.full_name;
            opt.textContent = `${u.full_name} (${u.role})`;
            if (user && user.id === u.id) opt.selected = true;
            select.appendChild(opt);
        });
    }
}

// Helper: Normalize RUT for comparison
const normalizeRut = (r) => {
    if (!r) return '';
    return r.replace(/\./g, '').replace(/-/g, '').toUpperCase().trim();
};

// Helper: Resolve Shift Times from Code
const getShiftTimes = (code) => {
    if (!code) return { start: null, end: null };
    code = code.toUpperCase().trim();

    // 1. Static Map for Non-Time Codes
    const staticMap = {
        'LIBRE': { s: null, e: null },
        'L': { s: null, e: null },
        'LI': { s: null, e: null },
        'V': { s: null, e: null },
        'VAC': { s: null, e: null },
        'S': { s: null, e: null },
        'X': { s: null, e: null },
        'AU': { s: null, e: null },
        'LM': { s: null, e: null }
    };
    if (staticMap[code]) return { start: staticMap[code].s, end: staticMap[code].e };

    // 2. Dynamic Parse (M0817, T1322, N2107, M0817CU)
    const match = code.match(/^([A-Z]+)(\d{2})(\d{2})([A-Z]*)?$/);

    if (match) {
        const startH = match[2];
        const endH = match[3];
        return { start: `${startH}:00`, end: `${endH}:00` };
    }

    return { start: null, end: null };
};

window.generateMovilExcel = async function () {
    const VERSION = 'v9';
    const date = document.getElementById('movil-date').value;
    const requester = document.getElementById('movil-requester').value;
    const msg = document.getElementById('movil-msg');

    // Calculate Next Date
    const baseDateObj = new Date(date + 'T00:00:00');
    const nextDateObj = new Date(baseDateObj);
    nextDateObj.setDate(baseDateObj.getDate() + 1);
    const nextDate = nextDateObj.toISOString().split('T')[0];

    if (!date) { alert(`[${VERSION}] Seleccione Fecha`); return; }
    if (!requester) { alert(`[${VERSION}] Seleccione Solicitante`); return; }

    msg.style.display = 'block';
    msg.textContent = `[${VERSION}] Consultando turnos y direcciones...`;

    // CAPTURE NOW ONCE
    const now = new Date();

    // --- CUTOFF CALCULATION ---
    const cutoffTimestamp = new Date(nextDateObj);
    const isSundayCutoff = cutoffTimestamp.getDay() === 0;
    const cutoffHour = isSundayCutoff ? 8 : 7; // 08:00 for Sunday, 07:00 otherwise
    cutoffTimestamp.setHours(cutoffHour, 0, 0, 0);

    console.log(`[MOVIL ${VERSION}] Generation Time:`, now.toISOString());

    try {
        // Fetch Shifts for Today AND Tomorrow
        const { data: shifts, error } = await supabase
            .from('user_shifts')
            .select('*')
            .in('shift_date', [date, nextDate]);

        if (error) throw error;
        if (!shifts || shifts.length === 0) {
            alert(`[${VERSION}] No hay turnos cargados para estas fechas.`);
            msg.style.display = 'none';
            return;
        }

        console.log(`[MOVIL ${VERSION}] Found ${shifts.length} shifts in DB`);

        // Fetch Profiles
        const { data: profiles, error: pError } = await supabase
            .from('profiles')
            .select('id, rut, full_name, address, commune, phone');

        if (pError) throw pError;

        // Fetch Pre-Data (Historical/Imports)
        const { data: preData, error: preError } = await supabase
            .from('agent_predata')
            .select('rut, full_name, address, addr_number, commune, phone');

        // --- INTELLIGENT MATCHING SYSTEM ---
        const kbByRut = {};
        const kbByName = {};

        const normName = (n) => {
            if (!n) return '';
            return n.trim().toUpperCase().replace(/\s+/g, ' ');
        };

        const addToKB = (source, type) => {
            const nr = normalizeRut(source.rut);
            const nn = normName(source.full_name);

            // Determine effective address for this record
            let effAddr = source.address || '';
            if (type === 'predata' && source.addr_number) {
                effAddr = `${effAddr} #${source.addr_number}`.trim();
            }

            let entry = null;

            if (nr && kbByRut[nr]) entry = kbByRut[nr];
            else if (nn && kbByName[nn]) entry = kbByName[nn];

            if (!entry) {
                entry = {
                    rut: source.rut,
                    name: source.full_name,
                    address: '',
                    commune: '',
                    phone: '',
                    sources: []
                };
            }

            entry.sources.push(type);

            if (type === 'profile') {
                entry.rut = source.rut || entry.rut;
                entry.name = source.full_name || entry.name;
                if (source.address) entry.address = source.address;
                if (source.commune) entry.commune = source.commune;
                if (source.phone) entry.phone = source.phone;
            } else {
                if (!entry.rut) entry.rut = source.rut;
                if (!entry.name) entry.name = source.full_name;
                if (!entry.address) entry.address = effAddr;
                if (!entry.commune) entry.commune = source.commune;
                if (!entry.phone) entry.phone = source.phone;
            }

            if (nr) kbByRut[nr] = entry;
            if (nn) kbByName[nn] = entry;
        };

        // 1. Load PreData first (base layer)
        if (preData) preData.forEach(p => addToKB(p, 'predata'));

        // 2. Load Profiles (authoritative layer)
        if (profiles) profiles.forEach(p => addToKB(p, 'profile'));

        console.log(`[MOVIL ${VERSION}] KB Size -> RUTs: ${Object.keys(kbByRut).length}, Names: ${Object.keys(kbByName).length}`);

        const rows = [];
        const formatDateObj = (d) => {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        };

        shifts.forEach(s => {
            const shiftRut = normalizeRut(s.rut);
            const shiftName = normName(s.user_name);

            // --- FIND PERSON ---
            // 1. Try by RUT
            let person = kbByRut[shiftRut];

            // 2. If no match (or matched person has no address), try by NAME
            if (!person || (!person.address && shiftName)) {

                // Do we have a name match?
                const personByName = kbByName[shiftName];

                if (personByName) {
                    if (!person) {
                        person = personByName;
                    } else if (personByName.address && !person.address) {
                        // Found by RUT but no address. Found by Name AND has address.
                        // Assume same person and use the name-matched record for address
                        person = personByName;
                        console.log(`[MOVIL] Enhanced via Name: "${s.user_name}" matched address via name lookup.`);
                    }
                }
            }

            /* 
               If we STILL don't have an address, we can try one more desperate check:
               Does agent_predata have this exact name but maybe slightly diff RUT?
               (Already handled by name lookup above)
            */

            const pName = person?.name || s.user_name || 'Desconocido';
            const pAddr = person?.address || 'SIN DIRECCIÓN';
            const pCommune = person?.commune || '';
            const pPhone = person?.phone || '';
            const pRutDisplay = person?.rut || s.rut || '';

            const times = getShiftTimes(s.shift_code);

            if (!times.start && !times.end) {
                return;
            }

            const [sY, sM, sD] = s.shift_date.split('-').map(Number);
            const shiftDateLocal = new Date(sY, sM - 1, sD, 0, 0, 0, 0);

            // Helper to clean address
            let street = pAddr;
            let numberUnit = '';
            if (street.includes('#')) {
                const parts = street.split('#');
                street = parts[0].trim();
                numberUnit = parts.slice(1).join('#').trim();
            }

            const createRow = (servicio, hora, movementDate) => ({
                FECHA: formatDateObj(movementDate),
                ID_PASAJERO: pRutDisplay,
                NOMBRE_COLABORADOR: pName,
                DIRECCION: street,
                NUMERO: numberUnit,
                COMUNA: pCommune,
                CONTACTO: (pPhone || '').replace('+569', '').replace(/\D/g, ''),
                SERVICIO: servicio,
                HORA: hora,
                SOLICITANTE: requester
            });

            // Entry
            if (times.start) {
                const [sh, sm] = times.start.split(':').map(Number);
                const startMins = sh * 60 + sm;
                const entryTimestamp = new Date(shiftDateLocal);
                entryTimestamp.setHours(sh, sm, 0, 0);
                const isFuture = entryTimestamp > now;
                const isBeforeCutoff = entryTimestamp <= cutoffTimestamp;
                const isSunday = shiftDateLocal.getDay() === 0;
                const limitMorning = isSunday ? 480 : 420;
                const isInWindow = (startMins >= 1260) || (startMins <= limitMorning);

                if (isFuture && isBeforeCutoff && isInWindow) {
                    rows.push(createRow('RECOGIDA', times.start, shiftDateLocal));
                }
            }

            // Exit
            if (times.end) {
                const [eh, em] = times.end.split(':').map(Number);
                const endMins = eh * 60 + em;
                const crossesMidnight = endMins < (times.start ? parseInt(times.start.split(':')[0]) * 60 : 0);

                let exitDateLocal = new Date(shiftDateLocal);
                if (crossesMidnight) exitDateLocal.setDate(exitDateLocal.getDate() + 1);
                exitDateLocal.setHours(eh, em, 0, 0);

                const isFuture = exitDateLocal > now;
                const isBeforeCutoff = exitDateLocal <= cutoffTimestamp;
                const isInWindow = (endMins >= 1260) || (endMins <= 420);

                if (isFuture && isBeforeCutoff && isInWindow) {
                    const exitDateForFecha = new Date(shiftDateLocal);
                    if (crossesMidnight) exitDateForFecha.setDate(exitDateForFecha.getDate() + 1);
                    rows.push(createRow('ZARPE', times.end, exitDateForFecha));
                }
            }
        });

        console.log(`[MOVIL ${VERSION}] Total Rows to Export:`, rows.length);

        if (rows.length === 0) {
            alert(`[${VERSION}] No hay movimientos pendientes (21:00-07:00) para los turnos seleccionados.`);
            msg.style.display = 'none';
            return;
        }

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Movilizacion");
        XLSX.writeFile(wb, `Movilizacion_${VERSION}_${date}.xlsx`);
        msg.style.display = 'none';
        alert(`[${VERSION}] Excel generado con ${rows.length} movimientos.`);

    } catch (e) {
        console.error(`[MOVIL ${VERSION}] ERROR:`, e);
        alert(`[${VERSION}] Error: ` + e.message);
        msg.style.display = 'none';
    }
};
