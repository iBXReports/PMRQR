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

    // Calculate Dates: Prev (Yesterday) and Selected (Today)
    const selectedDateStr = date;
    const selectedDateObj = new Date(selectedDateStr + 'T00:00:00');

    // Yesterday (T-1)
    const prevDateObj = new Date(selectedDateObj);
    prevDateObj.setDate(selectedDateObj.getDate() - 1);
    const prevDateStr = prevDateObj.toISOString().split('T')[0];

    // Next Day (Tomorrow) is NOT needed for querying shifts anymore, but cutoff is essentially Selected Date Morning.
    // Wait, user says "night of 4th to 5th". 
    // If selected is 5th, we want shifts from 4th (Yesterday) and 5th (Today).
    // Window: 4th 18:00 -> 5th 07:00.

    if (!date) { alert(`[${VERSION}] Seleccione Fecha`); return; }
    if (!requester) { alert(`[${VERSION}] Seleccione Solicitante`); return; }

    msg.style.display = 'block';
    msg.textContent = `[${VERSION}] Consultando turnos (Ayer 18:00 - Hoy AM)...`;

    // CAPTURE NOW ONCE
    const now = new Date();

    // --- WINDOW DEFINITION ---
    // Start: Yesterday 21:00 (As per new logic)
    const windowStart = new Date(prevDateObj);
    windowStart.setHours(21, 0, 0, 0);

    // End: Today 07:00 (or 08:00 if Sunday)
    const windowEnd = new Date(selectedDateObj);
    const isSundayCutoff = windowEnd.getDay() === 0;
    const cutoffHour = isSundayCutoff ? 8 : 7;
    windowEnd.setHours(cutoffHour, 0, 0, 0);

    console.log(`[MOVIL ${VERSION}] Window: ${windowStart.toLocaleString()} -> ${windowEnd.toLocaleString()}`);

    try {
        // Fetch Shifts for Yesterday and Today
        const { data: shifts, error } = await supabase
            .from('user_shifts')
            .select('*')
            .in('shift_date', [prevDateStr, selectedDateStr]);

        if (error) throw error;
        if (!shifts || shifts.length === 0) {
            alert(`[${VERSION}] No hay turnos cargados para ${prevDateStr} ni ${selectedDateStr}.`);
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

            if (entry.name && entry.name.toUpperCase().includes('MARTINEZ')) {
                console.log(`[DEBUG] Processing: ${entry.name} | Type: ${type}`);
                console.log(`   Current Address: "${entry.address}"`);
                console.log(`   New Source Address: "${source.address}"`);
                console.log(`   New Source Number: "${source.addr_number || source.address_number}"`);
            }

            if (type === 'profile') {
                entry.rut = source.rut || entry.rut;
                entry.name = source.full_name || entry.name;

                // Prioritize Profile Address ONLY if it has content
                if (source.address && source.address.trim().length > 2) {
                    entry.address = source.address;
                    if (entry.name.toUpperCase().includes('MARTINEZ')) console.log(`   -> OVERWRITE with Profile Address: ${entry.address}`);
                } else {
                    if (entry.name.toUpperCase().includes('MARTINEZ')) console.log(`   -> IGNORED Profile Address (Too short/empty)`);
                }

                if (source.commune && source.commune.trim().length > 2) entry.commune = source.commune;
                if (source.phone && source.phone.trim().length > 5) entry.phone = source.phone;
            } else {
                if (!entry.rut) entry.rut = source.rut;
                if (!entry.name) entry.name = source.full_name;

                // For PreData, we adopt if empty, OR if we want to support upgrading valid predata over existing empty?
                // Current logic: if (!entry.address) entry.address = effAddr;
                // If entry has address (from previous PreData row), we keep it.

                if (!entry.address || entry.address.length < 3) {
                    entry.address = effAddr;
                    if (entry.name && entry.name.includes('MARTINEZ RODRIGUEZ')) console.log(`   -> SET PreData Address: ${entry.address}`);
                }

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
                        person = personByName; // Name match has address, prioritize it
                    }
                }

                // 3. If STILL no person (or no address), try FUZZY MATCH on KB Names
                if (!person || !person.address) {
                    let bestScore = 0;
                    let bestMatch = null;

                    // Iterate all KB names (expensive but necessary for unlinked agents)
                    const allNames = Object.keys(kbByName);
                    for (const kn of allNames) {
                        if (typeof window.calculateMatchingTokens === 'function') {
                            const { matches, len1, len2 } = window.calculateMatchingTokens(shiftName, kn);

                            // Logic: 
                            // 1. Matches >= 3 (Detailed Match: e.g. "Name Name Last Last" vs "Name Last Last")
                            // 2. Matches >= 2 AND (len1 === 2 OR len2 === 2) (Subset Match: "Name Last" vs "Name Name Last Last")
                            // 3. High Ratio (Standard Fuzzy)

                            let score = matches / Math.max(len1, len2);

                            if (matches >= 3) {
                                score = 1.0; // Force high score
                            } else if (matches >= 2 && (len1 === 2 || len2 === 2)) {
                                score = 0.9; // Strong subset match
                            }

                            if (score > bestScore) {
                                bestScore = score;
                                bestMatch = kbByName[kn];
                            }
                        } else if (typeof window.calculateTokenSimilarity === 'function') {
                            // Fallback
                            const score = window.calculateTokenSimilarity(shiftName, kn);
                            if (score > bestScore) {
                                bestScore = score;
                                bestMatch = kbByName[kn];
                            }
                        }
                    }

                    // Threshold 0.75 for generation
                    if (bestScore >= 0.75 && bestMatch) {
                        if (!person) {
                            person = bestMatch;
                            console.log(`[MOVIL] Fuzzy Match: "${shiftName}" -> "${bestMatch.name}" (Score: ${bestScore.toFixed(2)})`);
                        } else if (bestMatch.address && !person.address) {
                            person = bestMatch; // Upgrade to fuzzy match if it has address
                            console.log(`[MOVIL] Fuzzy Match (Address Upgrade): "${shiftName}" -> "${bestMatch.name}"`);
                        }
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
                const entryTimestamp = new Date(shiftDateLocal);
                entryTimestamp.setHours(sh, sm, 0, 0);

                // Is it in the window?
                if (entryTimestamp >= windowStart && entryTimestamp <= windowEnd) {
                    rows.push(createRow('RECOGIDA', times.start, entryTimestamp));
                }
            }

            // Exit
            if (times.end) {
                const [eh, em] = times.end.split(':').map(Number);
                const crossesMidnight = eh < (times.start ? parseInt(times.start.split(':')[0]) : 0);
                // Better midnight check: if end time < start time, typically next day.
                // Or if end time is small (e.g. 06:00) vs shift date (maybe night shift).

                // Let's rely on standard logic:
                // If start > end, it crosses midnight. 
                // BUT we must be careful with date assignments.
                // shiftDateLocal is the assigned "Shift Date". 
                // E.g. Shift 4th, 22:00-06:00. Start=4th 22:00. End=5th 06:00.

                let exitTimestamp = new Date(shiftDateLocal);
                if (times.start && eh < parseInt(times.start.split(':')[0])) {
                    exitTimestamp.setDate(exitTimestamp.getDate() + 1);
                }
                exitTimestamp.setHours(eh, em, 0, 0);

                // Is it in the window?
                if (exitTimestamp >= windowStart && exitTimestamp <= windowEnd) {
                    rows.push(createRow('ZARPE', times.end, exitTimestamp));
                }
            }
        });

        console.log(`[MOVIL ${VERSION}] Total Rows to Export:`, rows.length);

        if (rows.length === 0) {
            alert(`[${VERSION}] No hay movimientos en el rango ${windowStart.toLocaleDateString()} 21:00 - ${windowEnd.toLocaleDateString()} ${windowEnd.getHours()}:00.`);
            msg.style.display = 'none';
            return;
        }

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Movilizacion");
        XLSX.writeFile(wb, `Movilizacion_Nocturno_${selectedDateStr}.xlsx`);
        msg.style.display = 'none';
        alert(`[${VERSION}] Excel generado con ${rows.length} movimientos.`);

    } catch (e) {
        console.error(`[MOVIL ${VERSION}] ERROR:`, e);
        alert(`[${VERSION}] Error: ` + e.message);
        msg.style.display = 'none';
    }
};

window.handleMovilDatabaseUpload = async function (input) {
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const msg = document.getElementById('movil-msg');
    const progressContainer = document.getElementById('movil-progress-container');
    const progressBar = document.getElementById('movil-progress-bar');
    const progressText = document.getElementById('movil-progress-text');

    msg.style.display = 'block';
    msg.style.color = '#3b82f6';
    msg.textContent = 'Procesando Base Maestra...';

    // Reset Progress
    if (progressContainer) {
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressText.style.display = 'block';
        progressText.textContent = '0%';
    }

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Expected Columns:
            // A: NOMBRE DE FUNCIONARIO
            // B: MAIL
            // C: ID (Ignored)
            // D: CEL (TELEFONO)
            // E: DIRECCION
            // F: NUMERO
            // G: COMUNA
            // H: RUT

            const range = XLSX.utils.decode_range(worksheet['!ref']);
            const rows = [];

            // Start from Row 2 (Index 1) assuming header is Row 1
            for (let R = 1; R <= range.e.r; ++R) {
                const getVal = (c) => {
                    const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: c })];
                    return cell ? String(cell.v).trim() : '';
                };

                const name = getVal(0); // A
                if (!name) continue;

                const email = getVal(1); // B
                const phone = getVal(3); // D
                const address = getVal(4); // E
                const number = getVal(5); // F
                const commune = getVal(6); // G
                const rutRaw = getVal(7); // H (Full RUT 17737508-K)

                rows.push({
                    full_name: name.toUpperCase(),
                    rut: rutRaw.toUpperCase(),
                    email: email.toLowerCase(),
                    phone: phone,
                    address: address.toUpperCase(),
                    addr_number: number,
                    commune: commune.toUpperCase()
                });
            }

            console.log(`[MOVIL UPLOAD] Parsed ${rows.length} rows.`);
            msg.textContent = `Actualizando ${rows.length} registros...`;

            let successCount = 0;
            let errorCount = 0;
            const total = rows.length;

            const normalizeRut = (r) => r.replace(/\./g, '').replace(/-/g, '').toUpperCase().trim();

            for (let i = 0; i < total; i++) {
                const row = rows[i];

                // Update Progress UI
                if (progressBar) {
                    const percent = Math.round(((i + 1) / total) * 100);
                    progressBar.style.width = `${percent}%`;
                    progressText.textContent = `${percent}% (${i + 1}/${total})`;
                }

                if (!row.rut) continue;

                const cleanRut = normalizeRut(row.rut);

                // We update agent_predata. 
                // We assume cleanRut is unique or we want to overwrite.
                // First check if exists
                const { data: existing } = await supabase
                    .from('agent_predata')
                    .select('id')
                    .eq('rut', cleanRut) // agent_predata usually stores clean rut or formatted? Let's assume input rut might have dots
                    .maybeSingle();

                // To be safe, let's just Upsert based on RUT if unique constraint exists, 
                // but agent_predata might not have unique constraint on RUT in Supabase.
                // Let's do check-update-insert approach.

                // Actually, let's normalize the RUT we store in predata to be matching format (dots/dash? or clean?)
                // The system usually uses 12.345.678-9. Let's keep input format but ensure it's upper.

                // Wait, user said Col C is ID (17737508) and Col H is RUT (17737508-K).
                // Let's use Col H.

                const payload = {
                    rut: row.rut, // We store the RUT as is (17737508-K)
                    full_name: row.full_name,
                    email: row.email,
                    phone: row.phone,
                    address: row.address,
                    addr_number: row.addr_number,
                    commune: row.commune,
                    // created_at: new Date() // Let db handle default
                };

                // Check by Clean Rut to avoid duplicates with different format
                // But we don't have clean rut column. We check 'rut' column.

                // Simplest strategy: Delete by RUT then Insert? No, ID changes.
                // Update if found, Insert if not.

                const { data: search, error: sErr } = await supabase
                    .from('agent_predata')
                    .select('id, rut')
                    .or(`rut.eq.${row.rut},rut.eq.${cleanRut}`) // Try both
                    .limit(1);

                let err = null;

                if (search && search.length > 0) {
                    // Update
                    const { error } = await supabase
                        .from('agent_predata')
                        .update(payload)
                        .eq('id', search[0].id);
                    err = error;
                } else {
                    // Insert
                    const { error } = await supabase
                        .from('agent_predata')
                        .insert([payload]);
                    err = error;
                }

                if (err) {
                    console.error('Error row:', row, err);
                    errorCount++;
                } else {
                    successCount++;
                }
            }

            msg.style.color = '#10b981';
            msg.textContent = `Carga Completada: ${successCount} OK, ${errorCount} Errores.`;
            setTimeout(() => {
                msg.style.display = 'none';
                if (progressContainer) progressContainer.style.display = 'none';
                if (progressText) progressText.style.display = 'none';
            }, 5000);

            // Reload requester list just in case names changed? Not needed.

        } catch (ex) {
            console.error(ex);
            msg.style.color = '#ef4444';
            msg.textContent = 'Error al procesar archivo: ' + ex.message;
            if (progressContainer) progressContainer.style.display = 'none';
            if (progressText) progressText.style.display = 'none';
        } finally {
            input.value = ''; // Reset
        }
    };
    reader.readAsArrayBuffer(file);
};

// --- INLINE AGENT MANAGEMENT LOGIC ---

window.toggleAgentPanel = function () {
    const panel = document.getElementById('agent-management-panel');
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        setTimeout(() => {
            const input = document.getElementById('agent-search-input');
            if (input) input.focus();
        }, 100);
    } else {
        panel.style.display = 'none';
        const editForm = document.getElementById('agent-edit-form');
        if (editForm) editForm.style.display = 'none';
    }
};

window.searchAgents = async function () {
    const query = document.getElementById('agent-search-input').value.trim();
    if (query.length < 2) {
        alert("Ingrese al menos 2 caracteres.");
        return;
    }

    const resultsDiv = document.getElementById('agent-search-results');
    resultsDiv.innerHTML = '<p style="text-align: center; color: #a855f7;">Buscando...</p>';

    const editForm = document.getElementById('agent-edit-form');
    if (editForm) editForm.style.display = 'none';

    try {
        // Search in Profiles (Registered Users)
        const { data: profiles, error: pErr } = await supabase
            .from('profiles')
            .select('*')
            .or(`first_name.ilike.%${query}%,last_name_1.ilike.%${query}%,rut.ilike.%${query}%,email.ilike.%${query}%`)
            .limit(20);

        // Search in Agent Predata (Master List)
        const { data: predata, error: pdErr } = await supabase
            .from('agent_predata')
            .select('*')
            .or(`full_name.ilike.%${query}%,rut.ilike.%${query}%,email.ilike.%${query}%`)
            .limit(20);

        resultsDiv.innerHTML = '';
        const uniqueResults = new Map();

        if (profiles) {
            profiles.forEach(p => {
                const name = `${p.first_name || ''} ${p.last_name_1 || ''} ${p.last_name_2 || ''}`.trim();
                uniqueResults.set('P_' + p.id, {
                    id: p.id,
                    source: 'profile',
                    name: name || 'Sin Nombre',
                    rut: p.rut,
                    email: p.email,
                    phone: p.phone,
                    address: p.address_street,
                    raw: p
                });
            });
        }

        if (predata) {
            predata.forEach(p => {
                uniqueResults.set('M_' + p.id, {
                    id: p.id,
                    source: 'predata',
                    name: p.full_name || 'Sin Nombre',
                    rut: p.rut,
                    email: p.email,
                    phone: p.phone,
                    address: p.address,
                    raw: p
                });
            });
        }

        if (uniqueResults.size === 0) {
            resultsDiv.innerHTML = '<p style="text-align: center; color: #ef4444;">No se encontraron agentes.</p>';
            return;
        }

        uniqueResults.forEach(agent => {
            const item = document.createElement('div');
            item.style.cssText = 'background: rgba(255,255,255,0.05); padding: 12px; margin-bottom: 8px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s; border: 1px solid rgba(255,255,255,0.05); cursor: pointer;';
            item.onmouseover = () => item.style.background = 'rgba(255,255,255,0.1)';
            item.onmouseout = () => item.style.background = 'rgba(255,255,255,0.05)';

            const badgeColor = agent.source === 'profile' ? '#10b981' : '#6366f1';
            const badgeText = agent.source === 'profile' ? 'Usuario Registrado' : 'Base Maestra';

            item.innerHTML = `
                <div>
                    <div style="font-weight: bold; color: white;">${agent.name}</div>
                    <div style="font-size: 0.85rem; opacity: 0.7; margin-top: 4px;">
                        <i class="fas fa-id-card"></i> ${agent.rut || '--'} | <i class="fas fa-envelope"></i> ${agent.email || '--'}
                    </div>
                </div>
                <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 5px;">
                     <span style="background: ${badgeColor}; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; color: white; display: inline-block;">${badgeText}</span>
                     <button onclick="editAgent('${agent.id}', '${agent.source}')" class="btn-sm" style="background: #3b82f6; border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
                        <i class="fas fa-pen"></i> Editar
                     </button>
                </div>
            `;
            resultsDiv.appendChild(item);
        });

    } catch (err) {
        console.error(err);
        resultsDiv.innerHTML = `<p style="color: red;">Error: ${err.message}</p>`;
    }
};

window.editAgent = async function (id, source) {
    const form = document.getElementById('agent-edit-form');
    if (!form) return;

    form.style.display = 'block';

    // Smooth scroll
    setTimeout(() => {
        form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);

    // Fetch fresh data
    const table = source === 'profile' ? 'profiles' : 'agent_predata';
    const { data, error } = await supabase.from(table).select('*').eq('id', id).single();

    if (error || !data) {
        alert("Error al cargar datos.");
        return;
    }

    document.getElementById('edit-agent-id').value = id;
    document.getElementById('edit-agent-source').value = source;

    if (source === 'profile') {
        document.getElementById('edit-full-name').value = `${data.first_name || ''} ${data.last_name_1 || ''} ${data.last_name_2 || ''}`.trim();
        document.getElementById('edit-rut').value = data.rut || '';
        document.getElementById('edit-email').value = data.email || '';
        document.getElementById('edit-phone').value = data.phone || '';
        document.getElementById('edit-address').value = data.address_street || '';
        document.getElementById('edit-number').value = data.address_number || '';
        document.getElementById('edit-commune').value = data.commune || '';
    } else {
        document.getElementById('edit-full-name').value = data.full_name || '';
        document.getElementById('edit-rut').value = data.rut || '';
        document.getElementById('edit-email').value = data.email || '';
        document.getElementById('edit-phone').value = data.phone || '';
        document.getElementById('edit-address').value = data.address || '';
        document.getElementById('edit-number').value = data.addr_number || '';
        document.getElementById('edit-commune').value = data.commune || '';
    }
};

window.cancelAgentEdit = function () {
    document.getElementById('agent-edit-form').style.display = 'none';
};

window.saveAgentChanges = async function () {
    const id = document.getElementById('edit-agent-id').value;
    const source = document.getElementById('edit-agent-source').value;

    const fullName = document.getElementById('edit-full-name').value.trim();
    const email = document.getElementById('edit-email').value.trim();
    const phone = document.getElementById('edit-phone').value.trim();
    const address = document.getElementById('edit-address').value.trim();
    const number = document.getElementById('edit-number').value.trim();
    const commune = document.getElementById('edit-commune').value.trim();

    if (!fullName) { alert("El nombre es obligatorio"); return; }

    const payload = {};
    if (source === 'profile') {
        const parts = fullName.split(' ');
        payload.first_name = parts[0];
        payload.last_name_1 = parts.slice(1).join(' ');
        payload.email = email;
        payload.phone = phone;
        payload.address_street = address;
        payload.address_number = number;
        payload.commune = commune;
        // Legacy address
        payload.address = `${address} ${number}, ${commune}`;
    } else {
        payload.full_name = fullName.toUpperCase();
        payload.email = email.toLowerCase();
        payload.phone = phone;
        payload.address = address.toUpperCase();
        payload.addr_number = number;
        payload.commune = commune.toUpperCase();
    }

    const table = source === 'profile' ? 'profiles' : 'agent_predata';
    const { error } = await supabase.from(table).update(payload).eq('id', id);

    if (error) {
        alert("Error al guardar: " + error.message);
    } else {
        alert("Cambios guardados correctamente.");
        document.getElementById('agent-edit-form').style.display = 'none';
        searchAgents(); // Refresh list to show changes
    }
};

