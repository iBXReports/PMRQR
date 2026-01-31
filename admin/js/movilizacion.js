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
        'S': { s: null, e: null }, // Saliente usually implies no active work hours for the day's start?
        'X': { s: null, e: null },
        'AU': { s: null, e: null },
        'LM': { s: null, e: null }
    };
    if (staticMap[code]) return { start: staticMap[code].s, end: staticMap[code].e };

    // 2. Dynamic Parse (M0817, T1322, N2107, M0817CU)
    // Regex: Starts with Letters, then 2 digits (Start Hour), then 2 digits (End Hour), optional suffix
    // Example: T1322 -> T, 13, 22
    const match = code.match(/^([A-Z]+)(\d{2})(\d{2})([A-Z]*)?$/);

    if (match) {
        const startH = match[2];
        const endH = match[3];
        return { start: `${startH}:00`, end: `${endH}:00` };
    }

    // 3. Fallback or specific manual overrides from database if needed
    // For now, return null if no match
    return { start: null, end: null };
};

window.generateMovilExcel = async function () {
    const VERSION = 'v8';
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
    msg.textContent = `[${VERSION}] Consultando turnos...`;

    // CAPTURE NOW ONCE - before all processing
    const now = new Date();

    // --- CUTOFF CALCULATION ---
    // Cutoff = Tomorrow at 07:00 (or 08:00 if Sunday)
    // Movements AFTER this cutoff are NOT included (they belong to the next transport cycle)
    const cutoffTimestamp = new Date(nextDateObj);
    const isSundayCutoff = cutoffTimestamp.getDay() === 0;
    const cutoffHour = isSundayCutoff ? 8 : 7; // 08:00 for Sunday, 07:00 otherwise
    cutoffTimestamp.setHours(cutoffHour, 0, 0, 0);

    console.log(`[MOVIL ${VERSION}] Generation Time:`, now.toISOString());
    console.log(`[MOVIL ${VERSION}] Selected Date:`, date, 'Next Date:', nextDate);
    console.log(`[MOVIL ${VERSION}] Cutoff (incl):`, cutoffTimestamp.toISOString(), `(Sunday: ${isSundayCutoff})`);


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

        // Also fetch pre-registration data (from Excel imports)
        const { data: preData, error: preError } = await supabase
            .from('agent_predata')
            .select('rut, full_name, address, addr_number, commune, phone');

        // Create preData map by normalized RUT
        const preDataMap = {};
        if (preData && !preError) {
            preData.forEach(p => {
                const nr = normalizeRut(p.rut);
                if (nr) {
                    // Combine address + addr_number into full address
                    if (p.address && p.addr_number) {
                        p.full_address = `${p.address} #${p.addr_number}`;
                    } else if (p.address) {
                        p.full_address = p.address;
                    } else {
                        p.full_address = '';
                    }
                    preDataMap[nr] = p;
                }
            });
            console.log(`[MOVIL ${VERSION}] Loaded ${preData.length} pre-data records for fallback`);
        }

        // Hash Map Profiles by Normalized RUT, merging with preData
        const profileMap = {};
        profiles.forEach(p => {
            const nr = normalizeRut(p.rut);
            if (nr) {
                // Check if we have preData for this RUT and merge missing fields
                const pre = preDataMap[nr];
                if (pre) {
                    // Fill missing fields from preData
                    // Use full_address (with number) from preData
                    if (!p.address && pre.full_address) p.address = pre.full_address;
                    else if (!p.address && pre.address) p.address = pre.address;
                    if (!p.commune && pre.commune) p.commune = pre.commune;
                    if (!p.phone && pre.phone) p.phone = pre.phone;
                    if (!p.full_name && pre.full_name) p.full_name = pre.full_name;
                }
                profileMap[nr] = p;
            }
        });

        // Also add preData entries that are NOT in profiles (agents without accounts)
        Object.keys(preDataMap).forEach(nr => {
            if (!profileMap[nr]) {
                // Use full_address instead of address for entries from preData
                const pre = preDataMap[nr];
                pre.address = pre.full_address || pre.address;
                profileMap[nr] = pre;
            }
        });

        const rows = [];

        // Date Formatter for Date objects
        const formatDateObj = (d) => {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        };

        shifts.forEach(s => {
            const shiftRut = normalizeRut(s.rut);
            const p = profileMap[shiftRut] || {};
            const times = getShiftTimes(s.shift_code);

            if (!times.start && !times.end) {
                console.log(`[MOVIL ${VERSION}] SKIP ${s.user_name}: No times for code ${s.shift_code}`);
                return;
            }

            // Parse shift date (Robust Local Time)
            const [sY, sM, sD] = s.shift_date.split('-').map(Number);
            const shiftDateLocal = new Date(sY, sM - 1, sD, 0, 0, 0, 0);

            // Address parsing
            let street = p.address || 'SIN DIRECCIÓN';
            let numberUnit = '';
            if (p.address && p.address.includes('#')) {
                const parts = p.address.split('#');
                street = parts[0].trim();
                numberUnit = parts.slice(1).join('#').trim();
            }

            // Row creator - now accepts the movement date
            const createRow = (servicio, hora, movementDate) => ({
                FECHA: formatDateObj(movementDate),
                ID_PASAJERO: s.rut || shiftRut,
                NOMBRE_COLABORADOR: p.full_name || s.user_name || 'Desconocido',
                DIRECCION: street,
                NUMERO: numberUnit,
                COMUNA: p.commune || '',
                CONTACTO: (p.phone || '').replace('+569', '').replace(/\D/g, ''),
                SERVICIO: servicio,
                HORA: hora,
                SOLICITANTE: requester
            });

            // --- RECOGIDA (Entry) Logic ---
            if (times.start) {
                const [sh, sm] = times.start.split(':').map(Number);
                const startMins = sh * 60 + sm;

                // Calculate exact entry timestamp
                const entryTimestamp = new Date(shiftDateLocal);
                entryTimestamp.setHours(sh, sm, 0, 0);

                // Check if FUTURE (after now)
                const isFuture = entryTimestamp > now;

                // Check if BEFORE CUTOFF (within this transport cycle)
                const isBeforeCutoff = entryTimestamp <= cutoffTimestamp;

                // Check if in WINDOW (21:00-07:00, Sunday exception 08:00)
                const isSunday = shiftDateLocal.getDay() === 0;
                const limitMorning = isSunday ? 480 : 420; // 08:00 or 07:00
                const isInWindow = (startMins >= 1260) || (startMins <= limitMorning);

                console.log(`[MOVIL ${VERSION}] ENTRY ${s.user_name} | Date: ${s.shift_date} | Code: ${s.shift_code} | Time: ${times.start} | Future: ${isFuture} | BeforeCutoff: ${isBeforeCutoff} | InWindow: ${isInWindow}`);

                if (isFuture && isBeforeCutoff && isInWindow) {
                    rows.push(createRow('RECOGIDA', times.start, shiftDateLocal));
                    console.log(`[MOVIL ${VERSION}]   -> ADDED RECOGIDA for ${formatDateObj(shiftDateLocal)}`);
                }
            }

            // --- ZARPE (Exit) Logic ---
            if (times.end) {
                const [eh, em] = times.end.split(':').map(Number);
                const endMins = eh * 60 + em;
                const startMins = times.start ? times.start.split(':').map(Number)[0] * 60 + (times.start.split(':').map(Number)[1] || 0) : 0;

                // Check if crosses midnight (exit is on next day)
                const crossesMidnight = endMins < startMins;

                // Calculate exact exit timestamp
                let exitDateLocal = new Date(shiftDateLocal);
                if (crossesMidnight) {
                    exitDateLocal.setDate(exitDateLocal.getDate() + 1);
                }
                exitDateLocal.setHours(eh, em, 0, 0);

                // Check if FUTURE (after now)
                const isFuture = exitDateLocal > now;

                // Check if BEFORE CUTOFF (within this transport cycle)
                const isBeforeCutoff = exitDateLocal <= cutoffTimestamp;

                // Check if in WINDOW (21:00-07:00, NO Sunday exception for Zarpe)
                const isInWindow = (endMins >= 1260) || (endMins <= 420);

                console.log(`[MOVIL ${VERSION}] EXIT ${s.user_name} | Date: ${s.shift_date} | Code: ${s.shift_code} | Time: ${times.end} | CrossMN: ${crossesMidnight} | Future: ${isFuture} | BeforeCutoff: ${isBeforeCutoff} | InWindow: ${isInWindow}`);

                if (isFuture && isBeforeCutoff && isInWindow) {
                    // Create a clean date for FECHA (just the date portion of exitDateLocal)
                    const exitDateForFecha = new Date(shiftDateLocal);
                    if (crossesMidnight) {
                        exitDateForFecha.setDate(exitDateForFecha.getDate() + 1);
                    }
                    rows.push(createRow('ZARPE', times.end, exitDateForFecha));
                    console.log(`[MOVIL ${VERSION}]   -> ADDED ZARPE for ${formatDateObj(exitDateForFecha)}`);
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
