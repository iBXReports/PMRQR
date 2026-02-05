import { supabase } from '../../assets/js/client.js';

// --- ROSTERS LOGIC ---

async function loadRosters() {
    const tbody = document.querySelector('#rosters-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; opacity: 0.5;">Cargando historial...</td></tr>';

    try {
        const { data, error } = await supabase
            .from('roster_files')
            .select(`
                *,
                profiles:uploaded_by (full_name, username)
            `)
            .order('month', { ascending: false });

        if (error) throw error;

        tbody.innerHTML = '';
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; opacity: 0.5;">No hay roles cargados.</td></tr>';
        } else {
            data.forEach(file => {
                const tr = document.createElement('tr');
                const date = new Date(file.created_at).toLocaleString();
                const monthDate = new Date(file.month);
                const monthName = monthDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });

                tr.innerHTML = `
                    <td style="text-transform: capitalize;"><strong>${monthName}</strong></td>
                    <td>${file.name}</td>
                    <td>${file.profiles?.full_name || 'Admin'}</td>
                    <td>${date}</td>
                    <td>
                        <div class="action-group">
                            <button class="btn-action btn-edit" title="Ver Detalle" onclick="viewRosterDetail('${file.id}', '${file.name}', '${file.month}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            <a href="${file.file_url}" target="_blank" class="btn-action btn-edit" title="Descargar" style="text-decoration:none; display:inline-flex; align-items:center;">
                                <i class="fas fa-download"></i>
                            </a>
                            <button class="btn-action btn-delete" title="Eliminar" onclick="deleteRoster('${file.id}', '${file.file_url}')">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        // --- LOAD DAILY MANAGEMENT SECTION ---
        loadDailyRosterManagement();

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center error">Error: ${err.message}</td></tr>`;
    }
}

// Ensure function is exposed
window.loadRosters = loadRosters;

// --- UTILS: FUZZY MATCHING ---
// --- UTILS: FUZZY MATCHING ---
window.levenshteinDistance = function (a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

window.calculateTokenSimilarity = function (str1, str2) {
    if (!str1 || !str2) return 0;

    // Normalize: remove special chars, lowercase, replace common phonetic variations
    const normalize = s => s.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/ñ/g, "n")
        .replace(/[^a-z0-9\s]/g, "");

    const tokens1 = normalize(str1).split(/\s+/).filter(t => t.length > 1);
    const tokens2 = normalize(str2).split(/\s+/).filter(t => t.length > 1);

    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    let matches = 0;
    const usedIndices = new Set();

    tokens1.forEach(t1 => {
        let bestMatch = null;
        let bestDist = 2; // Tolerance threshold

        // Find best match in tokens2
        for (let i = 0; i < tokens2.length; i++) {
            if (usedIndices.has(i)) continue;
            const t2 = tokens2[i];

            // Exact or includes
            if (t1 === t2) { bestMatch = i; bestDist = 0; break; }

            // Levenshtein for typos
            const dist = window.levenshteinDistance(t1, t2);
            if (dist < bestDist || (dist === bestDist && dist < 2)) {
                // Allow dist 1 for short words, dist 2 for longer
                if (dist <= 1 || (dist <= 2 && t1.length > 4 && t2.length > 4)) {
                    bestMatch = i;
                    bestDist = dist;
                }
            }
        }

        if (bestMatch !== null) {
            matches++;
            usedIndices.add(bestMatch);
        }
    });

    // Score: matches / max(tokens1.length, tokens2.length)
    // We want high recall. If I match most of the names, it's good.
    return matches / Math.max(tokens1.length, tokens2.length);
};

window.calculateMatchingTokens = function (str1, str2) {
    if (!str1 || !str2) return { matches: 0, len1: 0, len2: 0 };

    // Normalize
    const normalize = s => s.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/ñ/g, "n")
        .replace(/[^a-z0-9\s]/g, "");

    const tokens1 = normalize(str1).split(/\s+/).filter(t => t.length > 1);
    const tokens2 = normalize(str2).split(/\s+/).filter(t => t.length > 1);

    if (tokens1.length === 0 || tokens2.length === 0) return { matches: 0, len1: tokens1.length, len2: tokens2.length };

    let matches = 0;
    const usedIndices = new Set();

    tokens1.forEach(t1 => {
        let bestMatch = null;
        let bestDist = 2;

        for (let i = 0; i < tokens2.length; i++) {
            if (usedIndices.has(i)) continue;
            const t2 = tokens2[i];

            if (t1 === t2) { bestMatch = i; bestDist = 0; break; }

            const dist = window.levenshteinDistance(t1, t2);
            if (dist < bestDist || (dist === bestDist && dist < 2)) {
                if (dist <= 1 || (dist <= 2 && t1.length > 4 && t2.length > 4)) {
                    bestMatch = i;
                    bestDist = dist;
                }
            }
        }

        if (bestMatch !== null) {
            matches++;
            usedIndices.add(bestMatch);
        }
    });

    return { matches, len1: tokens1.length, len2: tokens2.length };
};

// --- DAILY ROSTER MANAGEMENT ---
// --- DAILY ROSTER MANAGEMENT ---
window.loadDailyRosterManagement = async function (targetDateStr) {
    let container = document.getElementById('daily-roster-container');

    // Inject Container if missing (Below the rosters list)
    if (!container) {
        const parent = document.getElementById('view-rosters').querySelector('.content-section');
        container = document.createElement('div');
        container.id = 'daily-roster-container';
        container.style.marginTop = '3rem';
        container.style.borderTop = '1px solid rgba(255,255,255,0.1)';
        container.style.paddingTop = '2rem';
        parent.appendChild(container);
    }

    container.innerHTML = '<div style="text-align:center;">Cargando gestión diaria...</div>';

    try {
        // 1. Calculate Dates
        // If targetDateStr is supplied (YYYY-MM-DD), use it. Else default to today (Local).
        const getLocalYMD = (dateObj) => {
            // Returns YYYY-MM-DD
            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const d = String(dateObj.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        let todayObj;
        if (targetDateStr) {
            // Construct date at noon to avoid timezone rollover issues
            const [y, m, d] = targetDateStr.split('-').map(Number);
            todayObj = new Date(y, m - 1, d, 12, 0, 0);
        } else {
            todayObj = new Date();
        }

        const today = getLocalYMD(todayObj);

        // Yesterday is relative to "today"
        const yesterdayObj = new Date(todayObj);
        yesterdayObj.setDate(yesterdayObj.getDate() - 1);
        const yesterday = getLocalYMD(yesterdayObj);

        // Get current hour to determine if we need to show overnight shifts
        // Note: Logic for "active" overnight shift implies "is the shift code from yesterday valid right now?"
        // This logic holds mostly for "real-time" viewing. If viewing past/future, this check might be slightly misleading visually, 
        // but we'll keep the logic consistent: 
        // "Show yesterday's overnight shifts if they would 'overlap' into the morning of the target day"
        // This essentially means just showing them. The "active" check might return false if we are not literally at that time, but that's fine.
        const currentHour = new Date().getHours();

        // UI Formatters
        const formatDateUI = (ymd) => {
            const [y, m, d] = ymd.split('-');
            return `${d}/${m}/${y}`;
        };
        const formatDateHeader = (ymd) => {
            const [y, m, d] = ymd.split('-');
            return `${d}/${m}`;
        };

        // Fetch Shifts for Today AND Yesterday (for overnight shifts)
        const { data: shifts, error } = await supabase
            .from('user_shifts')
            .select('*')
            .in('shift_date', [yesterday, today])
            .order('user_name');

        if (error) throw error;

        // Fetch profiles
        // Fetch profiles with extended fields for matching
        const { data: pData } = await supabase.from('profiles').select('rut, id, tica_status, full_name, email, phone, address, address_street, first_name, last_name_1, last_name_2');
        const profiles = pData || [];

        // Helper to normalize RUT - handles all variations:
        // 17737508-K, 17.737.508-K, 17737508K, 17737508
        const cleanRut = (r) => String(r || '').replace(/[^0-9kK]/g, '').toUpperCase();

        const profileMap = {};
        profiles.forEach(p => {
            if (p.rut) {
                const cleaned = cleanRut(p.rut);
                profileMap[cleaned] = p;
                // Also index without K at the end (for RUTs stored without verification digit)
                if (cleaned.endsWith('K')) {
                    profileMap[cleaned.slice(0, -1)] = p;
                }
            }
        });

        // Group Shifts by User (Key: Normalized RUT or Name fallback)
        const groupedUsers = {};

        if (shifts) {
            shifts.forEach(s => {
                const sRutClean = cleanRut(s.rut);
                // Use a unique key. Ideally RUT. If no RUT, Name.
                // We trust the roster usually implies one user per RUT.
                const key = sRutClean && sRutClean !== 'SIN-RUT' ? sRutClean : s.user_name;

                if (!groupedUsers[key]) {
                    groupedUsers[key] = {
                        rut: s.rut,
                        cleanRut: sRutClean,
                        name: s.user_name, // Take first name found
                        role: s.role_raw,  // Take first role found
                        email: s.email,
                        phone: s.phone,
                        address: s.address,
                        shifts: {}
                    };
                }
                // Map Date -> Code
                groupedUsers[key].shifts[s.shift_date] = s.shift_code;
            });
        }

        // Fetch existing attendance data for today and yesterday
        const { data: attendanceData } = await supabase
            .from('attendance')
            .select('*')
            .in('shift_date', [yesterday, today]);

        // Create attendance lookup map: key = `${rut}_${date}`
        const attendanceMap = {};
        if (attendanceData) {
            attendanceData.forEach(a => {
                const key = `${a.rut || a.user_name}_${a.shift_date}`;
                attendanceMap[key] = a;
                // Also index by cleaned RUT
                if (a.rut) {
                    const cleanedKey = `${cleanRut(a.rut)}_${a.shift_date}`;
                    attendanceMap[cleanedKey] = a;
                }
            });
        }

        // Fetch agent_predata for TICA status fallback (for agents without profile)
        const { data: predataData } = await supabase
            .from('agent_predata')
            .select('rut, tica_status, full_name');

        const predataMap = {};
        if (predataData) {
            predataData.forEach(p => {
                if (p.rut) {
                    const cleaned = cleanRut(p.rut);
                    predataMap[cleaned] = p;
                    predataMap[p.rut] = p;
                }
            });
        }

        container.innerHTML = `
            <h4 style="margin-bottom: 1rem; color: var(--primary-color);">📋 Gestión Operativa del Día (${formatDateUI(today)})</h4>
            
            <div style="display:flex; gap:1rem; margin-bottom: 1rem; flex-wrap: wrap; align-items:center;">
                <div style="position: relative; max-width: 400px; flex-grow:1;">
                    <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events:none;"></i>
                    <input type="text" id="daily-roster-search" placeholder="Buscar por Nombre, RUT o Cargo..." 
                        style="width: 100%; padding: 10px 16px 10px 36px; border-radius: 8px; border: 1px solid var(--card-border); background: var(--input-bg, rgba(255,255,255,0.05)); color: var(--text-color); font-size: 0.9rem; outline:none;">
                </div>
                
                <div style="display:flex; gap:0.5rem; align-items:center;">
                    <input type="date" id="export-date-picker" value="${today}" onchange="window.loadDailyRosterManagement(this.value)"
                        style="padding: 8px; border-radius: 6px; border: 1px solid var(--card-border); background: var(--bg-card); color: var(--text-color);">
                    <button class="btn btn-primary" id="btn-export-daily" style="white-space:nowrap;" onclick="window.triggerExportDaily()">
                        <i class="fas fa-file-excel"></i> Descargar Planilla
                    </button>
                </div>
            </div>

            <div style="background: var(--bg-card); border-radius: 12px; padding: 1rem; overflow-x: auto;">
                <table class="modern-table" style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--primary-color);">
                            <th class="table-header" onclick="window.sortDailyTable('name')" style="padding:12px 10px; text-align:left; min-width:180px; background: linear-gradient(135deg, var(--primary-color), var(--accent-color)); color: white; font-weight: 600; cursor: pointer;">
                                Agente <i id="sort-icon-name" class="fas fa-sort"></i>
                            </th>
                            <th class="table-header" onclick="window.sortDailyTable('shift')" style="padding:12px 10px; text-align:center; min-width:80px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; font-weight: 600; cursor: pointer;">
                                🕐 TURNO <i id="sort-icon-shift" class="fas fa-sort"></i><br><small style="opacity:0.8">${formatDateHeader(today)}</small>
                            </th>
                            <th class="table-header" style="padding:12px 10px; text-align:center; min-width:130px; background: linear-gradient(135deg, #10b981, #059669); color: white; font-weight: 600;">📋 ASISTENCIA</th>
                            <th class="table-header" style="padding:12px 10px; text-align:center; min-width:170px; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; font-weight: 600;">📝 OBSERVACIONES</th>
                            <th class="table-header" style="padding:12px 10px; text-align:center; min-width:130px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; font-weight: 600;">🪪 ESTADO TICA</th>
                            <th class="table-header" style="padding:12px 10px; text-align:center; min-width:150px; background: linear-gradient(135deg, #8b5cf6, #6d28d9); color: white; font-weight: 600;">🍽️ COLACIONES</th>
                            <th class="table-header" style="padding:12px 10px; text-align:center; min-width:80px; background: linear-gradient(135deg, #64748b, #475569); color: white; font-weight: 600;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        `;

        // Wrapper for onclick
        window.triggerExportDaily = async () => {
            const dateVal = document.getElementById('export-date-picker').value;
            if (!dateVal) return alert("Seleccione una fecha válida");
            await window.exportDailyAttendanceExcel(dateVal);
        };

        // Store attendance map and dates globally for row rendering
        window._attendanceMap = attendanceMap;
        window._todayDate = today;
        window._yesterdayDate = yesterday;
        window._currentHour = currentHour;

        const tbody = container.querySelector('tbody');

        // Search Logic
        document.getElementById('daily-roster-search').addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const rows = tbody.querySelectorAll('tr');
            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                row.style.display = text.includes(term) ? '' : 'none';
            });
        });

        const userKeys = Object.keys(groupedUsers).sort((a, b) => groupedUsers[a].name.localeCompare(groupedUsers[b].name));

        if (userKeys.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem;">No hay turnos para estos días.</td></tr>';
            return;
        }

        // Helper for styling codes
        const getCodeStyle = (c) => {
            c = (c || '').trim().toUpperCase();
            if (c.startsWith('M')) return 'background:#f97316; color:white;'; // Mañana - Orange
            if (c.startsWith('T')) return 'background:#eab308; color:black;';  // Tarde - Yellow
            if (c.startsWith('N')) return 'background:#4f46e5; color:white;';  // Noche - Indigo
            if (['L', 'LI'].includes(c)) return 'background:#15803d; color:white;'; // Libre - Green
            if (['X'].includes(c)) return 'background:#6b7280; color:white;'; // Libre - Gray
            return 'background:#374151; color:white;'; // Default Dark
        };

        // Helper to check if a shift is overnight (ends after midnight)
        const isOvernightShift = (code) => {
            if (!code) return false;
            const c = code.trim().toUpperCase();
            // Night shifts typically start with N
            if (c.startsWith('N')) return true;
            // Check for pattern like N2108 (starts 21, ends 08)
            const patternMatch = c.match(/^([A-Z]*)(\\d{2})(\\d{2})$/);
            if (patternMatch) {
                const startHour = parseInt(patternMatch[2]);
                const endHour = parseInt(patternMatch[3]);
                // If start hour > end hour, it's overnight
                if (startHour > endHour) return true;
            }
            return false;
        };

        // Helper to check if overnight shift from yesterday is still active
        const isYesterdayShiftStillActive = (code) => {
            if (!code || !isOvernightShift(code)) return false;
            const c = code.trim().toUpperCase();

            // Try to extract end hour from shift code
            const patternMatch = c.match(/^([A-Z]*)(\\d{2})(\\d{2})$/);
            if (patternMatch) {
                const endHour = parseInt(patternMatch[3]);
                // If current hour is before end hour, shift is still active
                return currentHour < endHour;
            }

            // Default: assume overnight shifts end around 7-8 AM
            return currentHour < 8;
        };

        // Filter agents: show if they have a shift today OR if they have an overnight shift from yesterday still active
        const excludedShiftCodes = ['L', 'LI', 'X', 'V', 'LIBRE', 'VACACIONES', 'VAC'];
        const filteredUserKeys = userKeys.filter(key => {
            const u = groupedUsers[key];
            const todayShift = (u.shifts[today] || '').trim().toUpperCase();
            const yesterdayShift = (u.shifts[yesterday] || '').trim().toUpperCase();

            // Case 1: Has an active shift today (not libre/vacaciones)
            if (todayShift && !excludedShiftCodes.includes(todayShift)) {
                return true;
            }

            // Case 2: Has an overnight shift from yesterday that's still active
            if (yesterdayShift && isYesterdayShiftStillActive(yesterdayShift)) {
                // Mark this user as having an overnight shift for display purposes
                u.isOvernightFromYesterday = true;
                u.activeShiftCode = yesterdayShift;
                return true;
            }

            return false;
        });

        if (filteredUserKeys.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem;">No hay agentes con turnos activos para hoy.</td></tr>';
            return;
        }

        filteredUserKeys.forEach(key => {
            const u = groupedUsers[key];
            let profile = profileMap[u.cleanRut];
            let autoLinked = false;

            // Link logic
            // Enhanced Link linking logic
            if (!profile) {
                // Strategy 1: RUT Match (already tried via profileMap, but let's be sure about cleaning)
                // (Handled by profileMap[u.cleanRut])

                // Strategy 2: Email Match
                if (!profile && u.email) {
                    profile = profiles.find(p => p.email && p.email.trim().toLowerCase() === u.email.trim().toLowerCase());
                    if (profile) console.log(`SmartMatch: Linked by Email ${u.email}`);
                }

                // Strategy 3: Phone Match (Last 8 digits)
                if (!profile && u.phone) {
                    const cleanPhone = u.phone.replace(/\D/g, '').slice(-8);
                    if (cleanPhone.length >= 8) {
                        profile = profiles.find(p => {
                            if (!p.phone) return false;
                            const pPhone = p.phone.replace(/\D/g, '').slice(-8);
                            return pPhone === cleanPhone;
                        });
                        if (profile) console.log(`SmartMatch: Linked by Phone ${u.phone}`);
                    }
                }

                // Strategy 4: Name Match (Fuzzy & Phonetic)
                if (!profile) {
                    const targetName = u.name;

                    // Try exact full name first (normalized)
                    profile = profiles.find(p => p.full_name && p.full_name.trim().toLowerCase() === targetName.trim().toLowerCase());

                    if (!profile) {
                        // Use Token Similarity
                        let bestCandidate = null;
                        let bestScore = 0;

                        profiles.forEach(p => {
                            if (!p.full_name) return;
                            const score = window.calculateTokenSimilarity(targetName, p.full_name);
                            if (score > bestScore) {
                                bestScore = score;
                                bestCandidate = p;
                            }
                        });

                        // Threshold: 0.75 means 3/4 tokens match, or similar
                        // e.g. "Juan Perez Gonzalez" vs "Juan Perez" -> 2/3 = 0.66 (might fail strict)
                        // But "ACUÑA LEYTON FRANCISCA ARACELLY" (4) vs "Francisca Araceli Acuña Leiton" (4) -> 4/4 matches (fuzzy) -> 1.0
                        if (bestScore >= 0.7) {
                            profile = bestCandidate;
                            console.log(`SmartMatch: Fuzzy Name Match (${bestScore.toFixed(2)}) for ${targetName} -> ${profile.full_name}`);
                        }
                    }
                }

                // Strategy 5: Address Match (Very basic fuzzy)
                if (!profile && u.address) {
                    const cleanAddr = u.address.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (cleanAddr.length > 5) {
                        profile = profiles.find(p => {
                            // Check legacy address
                            if (p.address && p.address.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanAddr) return true;
                            // Check street match
                            if (p.address_street && cleanAddr.includes(p.address_street.toLowerCase().replace(/[^a-z0-9]/g, ''))) return true;
                            return false;
                        });
                        if (profile) console.log(`SmartMatch: Linked by Address ${u.address}`);
                    }
                }

                // If found via smart match, verify RUT consistency
                if (profile) {
                    autoLinked = true;
                    // Auto-update RUT if needed (Trusting the link found via other strong methods)
                    // Only update if profile has NO RUT or filtered RUT is different
                    const pRutClean = cleanRut(profile.rut);
                    if (!pRutClean || (u.cleanRut && u.cleanRut !== 'SIN-RUT' && u.cleanRut !== pRutClean)) {
                        // Double check: if profile already has a RUT, do we overwrite it? 
                        // Only if we matched by Email or Phone which are strong identifiers.
                        // Name/Address are weaker.

                        // For now, let's update if profile has NO RUT.
                        if (!profile.rut || profile.rut === 'SIN-RUT') {
                            console.log(`Auto-linking: Updating RUT for ${profile.full_name} to ${u.rut}`);
                            supabase.from('profiles').update({ rut: u.rut }).eq('id', profile.id).then(() => { });
                        }
                    }
                }
            }

            const userId = profile ? profile.id : null;

            // Get TICA status: first from profile, then from predataMap
            const predata = predataMap[u.cleanRut] || {};
            const currentTica = profile?.tica_status || predata.tica_status || 'sin_tica';

            // Get attendance data for today
            const attendanceKey = `${u.cleanRut || u.name}_${today}`;
            const attendance = attendanceMap[attendanceKey] || {};
            const currentAttendance = attendance.attendance_status || 'pending';
            const currentObservation = attendance.observation || 'SIN OBS';
            const currentColation = attendance.colation_status || 'pendiente';

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid rgba(0,0,0,0.05)';

            // TICA Select Options (complete list)
            const opts = [
                { val: 'vigente', label: '✅ Vigente' },
                { val: 'por_vencer', label: '⚠️ Por Vencer' },
                { val: 'vencida', label: '❌ Vencida' },
                { val: 'en_tramite', label: '🔄 En Trámite' },
                { val: 'sin_tica', label: '❓ Sin TICA' }
            ].map(o => `<option value="${o.val}" ${o.val === currentTica ? 'selected' : ''}>${o.label}</option>`).join('');

            // ATTENDANCE Select Options
            const attendanceOpts = [
                { val: 'pending', label: '⏳ Pendiente', color: '#9ca3af' },
                { val: 'presente', label: '✅ Presente', color: '#10b981' },
                { val: 'ausente', label: '❌ Ausente', color: '#ef4444' },
                { val: 'licencia', label: '📋 Licencia', color: '#6366f1' }
            ];
            const attendanceOptsHtml = attendanceOpts.map(o =>
                `<option value="${o.val}" ${o.val === currentAttendance ? 'selected' : ''}>${o.label}</option>`
            ).join('');
            const attendanceColor = attendanceOpts.find(o => o.val === currentAttendance)?.color || '#9ca3af';

            // OBSERVATION Select Options (with colors for badge style)
            const observationOpts = [
                { val: 'SIN OBS', label: '✓ SIN OBS', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
                { val: 'RENUNCIA', label: '🚪 RENUNCIA', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
                { val: '2° DIA AUSENTE', label: '⚠️ 2° DIA AUSENTE', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
                { val: '3° DIA AUSENTE', label: '🚨 3° DIA AUSENTE', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
                { val: 'LLEGA TARDE', label: '🕐 LLEGA TARDE', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
                { val: 'NO LLEGA', label: '❌ NO LLEGA', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
                { val: 'NO TOMA VAN', label: '🚐 NO TOMA VAN', color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
                { val: 'NO RESPONDE', label: '📵 NO RESPONDE', color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
                { val: 'NO SE REPORTA', label: '📋 NO SE REPORTA', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
                { val: 'LICENCIA MEDICA', label: '🏥 LICENCIA MEDICA', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
                { val: 'EXTENDIDO//HRS EXTRA', label: '⏰ HRS EXTRA', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
                { val: 'NO SE LE ASIGNO MOVIL', label: '📱 SIN MOVIL', color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
                { val: 'ENFERM@', label: '🤒 ENFERM@', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
                { val: 'PROBLEMA PERSONAL', label: '👤 PROB. PERSONAL', color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
                { val: 'PERSONAL NUEVO', label: '🆕 PERSONAL NUEVO', color: '#10b981', bg: 'rgba(16,185,129,0.15)' }
            ];
            const currentObsData = observationOpts.find(o => o.val === currentObservation);
            const obsColor = currentObsData?.color || '#6b7280';
            const obsBg = currentObsData?.bg || 'rgba(107,114,128,0.15)';
            const observationOptsHtml = observationOpts.map(o =>
                `<option value="${o.val}" data-color="${o.color}" data-bg="${o.bg}" ${o.val === currentObservation ? 'selected' : ''}>${o.label}</option>`
            ).join('');

            // COLATION Select Options
            const colationOpts = [
                { val: 'pendiente', label: '⏳ COLACION PENDIENTE', color: '#f59e0b' },
                { val: 'ok', label: '✅ COLACION OK', color: '#10b981' }
            ];
            const colationOptsHtml = colationOpts.map(o =>
                `<option value="${o.val}" ${o.val === currentColation ? 'selected' : ''}>${o.label}</option>`
            ).join('');
            const colationColor = colationOpts.find(o => o.val === currentColation)?.color || '#f59e0b';

            // Warning
            let notFoundWarning = '';
            if (!userId) {
                notFoundWarning = `<span class="badge" style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); font-size:0.7rem; display:inline-flex; align-items:center; gap:4px;">
                    <i class="fas fa-exclamation-circle"></i> Sin Perfil (${u.rut})
                </span>`;
            } else if (autoLinked) {
                notFoundWarning = `<span class="badge" style="background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3); font-size:0.7rem;">
                    <i class="fas fa-link"></i> Auto-Vinculado
                </span>`;
            } else {
                notFoundWarning = `<span class="badge" style="background:rgba(16,185,129,0.1); color:#10b981; border:1px solid rgba(16,185,129,0.2); font-size:0.7rem; display:inline-flex; align-items:center; gap:4px;">
                    <i class="fas fa-check-circle"></i> ${u.rut}
                </span>`;
            }

            // Tica Style
            let selectBorder = 'var(--card-border, rgba(255,255,255,0.1))';
            if (currentTica === 'vigente') selectBorder = '#10b981';
            if (currentTica === 'por_vencer') selectBorder = '#f59e0b';
            if (currentTica === 'vencida') selectBorder = '#ef4444';

            // Determine which shift to display (today's or overnight from yesterday)
            const displayShiftCode = u.isOvernightFromYesterday ? u.activeShiftCode : (u.shifts[today] || '-');
            const isOvernight = u.isOvernightFromYesterday || false;

            // Render shift cell with overnight indicator if applicable
            const renderShiftCell = () => {
                const code = displayShiftCode;
                if (code === '-') return '<span style="opacity:0.3">-</span>';

                let overnightBadge = '';
                if (isOvernight) {
                    overnightBadge = `<span style="font-size:0.6rem; background:#6366f1; color:white; padding:2px 4px; border-radius:4px; margin-left:4px;" title="Turno nocturno del día anterior">🌙</span>`;
                }

                return `<span class="badge" style="${getCodeStyle(code)} font-family:'Courier New', monospace; font-size:0.85rem; padding:4px 8px; border-radius:6px;">${code}</span>${overnightBadge}`;
            };

            // Escape data for JS functions
            const safeRut = (u.rut || '').replace(/'/g, "\\'");
            const safeName = u.name.replace(/'/g, "\\'");
            const safeCleanRut = u.cleanRut || u.name;

            // Determine which date to use for attendance (today for regular, yesterday for overnight)
            const attendanceDate = isOvernight ? yesterday : today;

            tr.dataset.name = u.name.toLowerCase(); // Normalized for case-insensitive sort
            tr.dataset.shift = displayShiftCode;

            tr.innerHTML = `
                <td style="padding: 10px 12px;">
                    <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-color); margin-bottom: 3px;">${u.name}</div>
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <span style="font-size: 0.75rem; opacity: 0.7;">${u.role || 'Sin Cargo'}</span>
                        ${notFoundWarning}
                    </div>
                </td>
                
                <!-- TURNO -->
                <td style="padding: 8px; text-align: center;">${renderShiftCell()}</td>
                
                <!-- ASISTENCIA -->
                <td style="padding: 8px; text-align: center; background:rgba(16,185,129,0.05);">
                    <select onchange="updateAttendance('${safeCleanRut}', '${safeName}', '${attendanceDate}', 'attendance_status', this.value, this)" 
                            style="width: 100%; max-width: 130px; padding: 6px 8px; border-radius: 6px; 
                                   border: 2px solid ${attendanceColor}; 
                                   background: var(--input-bg, rgba(0,0,0,0.2)); 
                                   color: var(--text-color); 
                                   font-size: 0.75rem; 
                                   cursor: pointer; 
                                   outline: none; 
                                   font-family: inherit;">
                        ${attendanceOptsHtml}
                    </select>
                </td>
                
                <!-- OBSERVACIONES -->
                <td style="padding: 8px; text-align: center; background:rgba(245,158,11,0.05);">
                    <select onchange="updateAttendance('${safeCleanRut}', '${safeName}', '${attendanceDate}', 'observation', this.value, this); this.style.borderColor=this.options[this.selectedIndex].dataset.color; this.style.background=this.options[this.selectedIndex].dataset.bg;" 
                            style="width: 100%; max-width: 175px; padding: 6px 8px; border-radius: 8px; 
                                   border: 2px solid ${obsColor}; 
                                   background: ${obsBg}; 
                                   color: var(--text-color); 
                                   font-size: 0.7rem; 
                                   font-weight: 500;
                                   cursor: pointer; 
                                   outline: none; 
                                   font-family: inherit;">
                        ${observationOptsHtml}
                    </select>
                </td>
                
                <!-- ESTADO TICA -->
                <td style="padding: 8px; text-align: center; background:rgba(59,130,246,0.05);">
                    <select onchange="updateAgentTica('${userId || ''}', '${safeCleanRut}', '${safeName}', this.value, this)" 
                            style="width: 100%; max-width: 130px; padding: 6px 8px; border-radius: 6px; 
                                   border: 2px solid ${selectBorder}; 
                                   background: var(--input-bg, rgba(0,0,0,0.2)); 
                                   color: var(--text-color); 
                                   font-size: 0.75rem; 
                                   cursor: pointer; 
                                   outline: none; 
                                   font-family: inherit;">
                        ${opts}
                    </select>
                </td>
                
                <!-- COLACIONES -->
                <td style="padding: 8px; text-align: center; background:rgba(139,92,246,0.05);">
                    <select onchange="updateAttendance('${safeCleanRut}', '${safeName}', '${attendanceDate}', 'colation_status', this.value, this)" 
                            style="width: 100%; max-width: 160px; padding: 6px 8px; border-radius: 6px; 
                                   border: 2px solid ${colationColor}; 
                                   background: var(--input-bg, rgba(0,0,0,0.2)); 
                                   color: var(--text-color); 
                                   font-size: 0.7rem; 
                                   cursor: pointer; 
                                   outline: none; 
                                   font-family: inherit;">
                        ${colationOptsHtml}
                    </select>
                </td>
                
                <!-- ACCIONES -->
                <td style="padding: 8px; text-align: center;">
                    ${userId ? `
                        <button class="btn-icon" title="Editar Perfil" onclick="openEditProfile('${userId}')" 
                                style="color: var(--text-color); background: var(--bg-card); width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--card-border); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;">
                            <i class="fas fa-edit" style="font-size: 0.75rem;"></i>
                        </button>
                    ` : `
                        <button class="btn-icon" title="Vincular Perfil Manualmente" onclick="openManualLink('${safeRut}', '${safeName}')" 
                                style="color: #f59e0b; background: rgba(245,158,11,0.1); width: 28px; height: 28px; border-radius: 6px; border: 1px solid rgba(245,158,11,0.3); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;">
                            <i class="fas fa-link" style="font-size: 0.75rem;"></i>
                        </button>
                    `}
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error("Error loading daily roster management:", err);
        container.innerHTML = `<div style="color:red; text-align:center;">Error: ${err.message}</div>`;
    }
}

window.updateAgentTica = async function (userId, rut, userName, newStatus, selectElement) {
    if (!userId && !rut) return;

    const ticaColors = {
        'vigente': '#10b981',
        'por_vencer': '#f59e0b',
        'vencida': '#ef4444',
        'en_tramite': '#3b82f6',
        'sin_tica': '#6b7280'
    };

    try {
        let error = null;

        if (userId) {
            // Update in profiles table
            console.log(`Updating TICA for profile ${userId} to ${newStatus}`);
            const { error: updateErr } = await supabase
                .from('profiles')
                .update({ tica_status: newStatus })
                .eq('id', userId);
            error = updateErr;
        } else if (rut) {
            // No profile - try to update/insert in agent_predata
            const cleanRut = String(rut).replace(/[^0-9kK]/g, '').toUpperCase();
            console.log(`Updating TICA for agent_predata RUT ${cleanRut} to ${newStatus}`);

            // Check if exists in agent_predata
            const { data: existing } = await supabase
                .from('agent_predata')
                .select('id')
                .eq('rut', cleanRut)
                .maybeSingle();

            if (existing) {
                const { error: updateErr } = await supabase
                    .from('agent_predata')
                    .update({ tica_status: newStatus })
                    .eq('id', existing.id);
                error = updateErr;
            } else {
                // Insert new record in agent_predata
                const { error: insertErr } = await supabase
                    .from('agent_predata')
                    .insert({
                        rut: cleanRut,
                        full_name: userName || null,
                        tica_status: newStatus
                    });
                error = insertErr;
            }
        }

        if (error) throw error;

        // Visual feedback
        if (selectElement) {
            selectElement.style.borderColor = ticaColors[newStatus] || '#6b7280';
            selectElement.style.boxShadow = '0 0 0 2px rgba(16,185,129,0.3)';
            setTimeout(() => {
                selectElement.style.boxShadow = 'none';
            }, 500);
        }

    } catch (err) {
        console.error("Error actualizando TICA:", err);
        if (selectElement) {
            selectElement.style.borderColor = '#ef4444';
        }
    }
};

// --- ATTENDANCE UPDATE FUNCTION ---
window.updateAttendance = async function (rut, userName, shiftDate, field, value, selectElement) {
    console.log(`Updating attendance: ${field} = ${value} for ${userName} (${rut}) on ${shiftDate}`);

    try {
        // Get current user for updated_by field
        const { data: { user } } = await supabase.auth.getUser();
        const updatedBy = user?.id || null;

        // Check if record exists
        const { data: existing } = await supabase
            .from('attendance')
            .select('id')
            .eq('rut', rut)
            .eq('shift_date', shiftDate)
            .maybeSingle();

        if (existing) {
            // Update existing record
            const updateData = { [field]: value, updated_by: updatedBy };
            const { error } = await supabase
                .from('attendance')
                .update(updateData)
                .eq('id', existing.id);

            if (error) throw error;
        } else {
            // Insert new record
            const insertData = {
                rut: rut,
                user_name: userName,
                shift_date: shiftDate,
                [field]: value,
                updated_by: updatedBy
            };
            const { error } = await supabase
                .from('attendance')
                .insert(insertData);

            if (error) throw error;
        }

        // Visual feedback - flash green border
        if (selectElement) {
            const originalBorder = selectElement.style.border;
            selectElement.style.border = '2px solid #10b981';
            selectElement.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.3)';

            setTimeout(() => {
                // Update border color based on field and value
                if (field === 'attendance_status') {
                    const colors = { pending: '#9ca3af', presente: '#10b981', ausente: '#ef4444', licencia: '#6366f1' };
                    selectElement.style.border = `2px solid ${colors[value] || '#9ca3af'}`;
                } else if (field === 'colation_status') {
                    const colors = { pendiente: '#f59e0b', ok: '#10b981' };
                    selectElement.style.border = `2px solid ${colors[value] || '#f59e0b'}`;
                } else {
                    selectElement.style.border = originalBorder;
                }
                selectElement.style.boxShadow = 'none';
            }, 500);
        }

        console.log('Attendance updated successfully');

    } catch (err) {
        console.error('Error updating attendance:', err);
        alert("Error actualizando asistencia: " + err.message);

        // Visual feedback - flash red border on error
        if (selectElement) {
            const originalBorder = selectElement.style.border;
            selectElement.style.border = '2px solid #ef4444';
            setTimeout(() => {
                selectElement.style.border = originalBorder;
            }, 1000);
        }
    }
};


window.loadRosters = loadRosters;

window.uploadRoster = async function () {
    const fileInput = document.getElementById('roster-file');
    const monthInput = document.getElementById('roster-month');
    const file = fileInput.files[0];
    const monthVal = monthInput.value; // "2026-01"

    if (!file || !monthVal) {
        alert("Por favor selecciona un mes y un archivo.");
        return;
    }

    try {
        // 1. Upload File (Storage)
        const fileExt = file.name.split('.').pop();
        const fileName = `rol_${monthVal}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('rosters')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('rosters')
            .getPublicUrl(filePath);

        // 2. Register File in DB
        const { data: fileRecord, error: dbError } = await supabase
            .from('roster_files')
            .insert({
                name: file.name,
                month: `${monthVal}-01`, // First day of month
                file_url: publicUrl,
                uploaded_by: (await supabase.auth.getUser()).data.user.id
            })
            .select()
            .single();

        if (dbError) throw dbError;

        // 3. PROCESS EXCEL FILE (Client-Side Parsing)
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Convert to JSON array of arrays (headerless to handle layout manually)
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                // Start processing
                // Search for Header Row (Check first 20 rows)
                let headerIndex = -1;
                for (let i = 0; i < Math.min(rows.length, 20); i++) {
                    const row = rows[i] || [];
                    // Join row to string to search keywords loosely
                    const rowStr = row.join(' ').toLowerCase();

                    // Check for 'rut' AND ('nombre' OR 'agente')
                    if (rowStr.includes('rut') && (rowStr.includes('nombre') || rowStr.includes('agente'))) {
                        headerIndex = i;
                        console.log("Header found at row index:", i);
                        break;
                    }
                }

                // If header not found by keyword, try to find first row with data in Col A (Structure sanity check)
                if (headerIndex === -1) {
                    // Look for a row where Col A (Index 0) looks like a Rut (has numbers) 
                    // and Col D (Index 3) exists (has shifts).
                    // We'll treat the row BEFORE that as header, or just start there.
                    for (let i = 0; i < Math.min(rows.length, 20); i++) {
                        const cellA = String(rows[i]?.[0] || '');
                        // Simple heuristic: cellA has at least 5 digits?
                        if (cellA.replace(/\D/g, '').length > 5) {
                            headerIndex = i - 1; // Assume previous is header
                            console.log("Data pattern found at index", i, "Assuming header at", headerIndex);
                            break;
                        }
                    }
                }

                // If still -1, default to 0 (Row 1 is Header, Data starts Row 2/Index 1)
                if (headerIndex === -1) headerIndex = 0;

                // Identify Columns for extended matching
                const headerRow = rows[headerIndex].map(c => String(c).toLowerCase().trim());
                let colEmail = -1, colPhone = -1, colAddress = -1;

                headerRow.forEach((h, idx) => {
                    if (h.includes('email') || h.includes('correo')) colEmail = idx;
                    if (h.includes('fono') || h.includes('celular') || h.includes('telefono') || h.includes('teléfono')) colPhone = idx;
                    if (h.includes('direccion') || h.includes('dirección') || h.includes('domicilio')) colAddress = idx;
                });
                console.log("Column Mapping:", { colEmail, colPhone, colAddress });

                const shiftsToInsert = [];
                const monthYearParts = monthVal.split('-'); // ["2026", "01"]
                const year = parseInt(monthYearParts[0]);
                const monthIndex = parseInt(monthYearParts[1]) - 1; // 0-based JS Month

                const daysInMonth = new Date(year, monthIndex + 1, 0).getDate(); // Get total days

                // Iterate Data Rows
                for (let i = headerIndex + 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0) continue;

                    // Col A=Rut, B=Nombre, C=Cargo
                    // Indices: 0, 1, 2

                    const rut = row[0];
                    const name = row[1];
                    let cargo = row[2];

                    // Validation: Must have at least Rut or Name to be worth looking at
                    if (!rut && !name) continue;

                    // If Rut is "TOTAL" or metadata, skip
                    if (String(rut).toUpperCase().includes('TOTAL')) continue;

                    // Determine Team & Normalized Role
                    cargo = (cargo || '').toUpperCase();
                    let team = 'OLA'; // Default
                    if (cargo.includes('LATAM')) team = 'LATAM';

                    for (let d = 1; d <= daysInMonth; d++) {
                        const colIndex = 2 + d; // Day 1 = Col D (Index 3)

                        let shiftCode = 'SIN TURNO';
                        // Check if row has this column
                        if (row[colIndex] !== undefined) {
                            const val = String(row[colIndex]).trim();
                            if (val !== '' && val !== 'null' && val !== 'undefined') {
                                shiftCode = val;
                            }
                        }

                        // Create Date Object: YYYY-MM-DD
                        const dayStr = String(d).padStart(2, '0');
                        const monthStr = String(monthIndex + 1).padStart(2, '0');
                        const dateStr = `${year}-${monthStr}-${dayStr}`;

                        shiftsToInsert.push({
                            roster_file_id: fileRecord.id,
                            rut: String(rut || 'SIN-RUT'),
                            user_name: String(name || 'Sin Nombre'),
                            role_raw: cargo,
                            team: team,
                            shift_date: dateStr,
                            shift_code: shiftCode,
                            email: colEmail > -1 ? String(row[colEmail] || '').trim() : null,
                            phone: colPhone > -1 ? String(row[colPhone] || '').trim() : null,
                            address: colAddress > -1 ? String(row[colAddress] || '').trim() : null
                        });
                    }
                }

                if (shiftsToInsert.length === 0) {
                    alert("Advertencia: No se encontraron filas de turnos validas. Verifique que el archivo tenga datos en las columnas A (Rut), B (Nombre) y C (Cargo).");
                    return;
                }

                // Batch Insert (Supabase limits batch size, let's do chunks of 1000)
                const BATCH_SIZE = 1000;
                for (let i = 0; i < shiftsToInsert.length; i += BATCH_SIZE) {
                    const chunk = shiftsToInsert.slice(i, i + BATCH_SIZE);
                    const { error: insertError } = await supabase.from('user_shifts').insert(chunk);
                    if (insertError) {
                        console.error('Error inserting chunk', i, insertError);
                        throw insertError; // Abort on error
                    }
                }

                alert(`Rol cargado y procesado exitosamente. ${shiftsToInsert.length} turnos registrados.`);

                // Reset Inputs
                fileInput.value = '';
                monthInput.value = '';
                loadRosters();

            } catch (err) {
                console.error("Parsing Error:", err);
                alert("Error procesando el archivo Excel: " + err.message);
                // Optionally delete the file record if parsing failed? 
                // await supabase.from('roster_files').delete().eq('id', fileRecord.id);
            }
        };
        reader.readAsArrayBuffer(file);

    } catch (err) {
        console.error(err);
        alert("Error al subir archivo: " + err.message);
    }
};

window.deleteRoster = async function (id, url) {
    if (!confirm("¿Seguro que deseas eliminar este rol?")) return;

    try {
        // 1. Delete DB Record
        const { error: dbError } = await supabase.from('roster_files').delete().eq('id', id);
        if (dbError) throw dbError;

        // 2. Extract path from URL and Delete Storage (Optional but clean)
        // URL: .../storage/v1/object/public/rosters/filename.ext
        const path = url.split('/rosters/')[1];
        if (path) {
            await supabase.storage.from('rosters').remove([path]);
        }

        loadRosters();

    } catch (err) {
        alert("Error: " + err.message);
    }
};

// --- Roster Grid View ---
window.viewRosterDetail = async function (rosterFileId, fileName, monthStr) {
    const detailView = document.getElementById('roster-detail-view');
    const listView = document.querySelector('#view-rosters .mini-table').parentElement;

    // Hide list, show detail
    listView.style.display = 'none';
    detailView.style.display = 'block';

    // Update Title
    const monthDate = new Date(monthStr);
    const monthName = monthDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    document.getElementById('roster-detail-title').textContent = `📅 Detalle: ${monthName} (${fileName})`;

    const gridTable = document.getElementById('roster-grid');
    gridTable.innerHTML = '<tr><td style="padding:2rem;">Cargando detalle...</td></tr>';

    try {
        // Fetch Shifts
        const { data: shifts, error } = await supabase
            .from('user_shifts')
            .select('*')
            .eq('roster_file_id', rosterFileId)
            .order('user_name')
            .order('shift_date');

        if (error) throw error;
        if (!shifts || shifts.length === 0) {
            gridTable.innerHTML = '<tr><td style="padding:2rem;">No hay turnos registrados en este archivo.</td></tr>';
            return;
        }

        renderRosterGrid(gridTable, shifts, monthStr);

    } catch (err) {
        console.error(err);
        gridTable.innerHTML = `<tr><td style="color:red; padding:2rem;">Error: ${err.message}</td></tr>`;
    }
};

window.closeRosterDetail = function () {
    const detailView = document.getElementById('roster-detail-view');
    // Show list
    document.querySelector('#view-rosters .mini-table').parentElement.style.display = 'block';
    detailView.style.display = 'none';
};

function renderRosterGrid(table, shifts, monthStr) {
    // 1. Group by User (Rut)
    const users = {};
    const dateSet = new Set();

    shifts.forEach(s => {
        if (!users[s.rut]) {
            users[s.rut] = {
                name: s.user_name,
                role: s.role_raw,
                team: s.team,
                shifts: {}
            };
        }
        users[s.rut].shifts[s.shift_date] = s.shift_code;
        dateSet.add(s.shift_date);
    });

    // 2. Sort Dates
    const sortedDates = Array.from(dateSet).sort();

    // 3. Current Date Check
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // 4. Build Table
    let html = '<thead><tr>';
    html += '<th style="text-align:left; position:sticky; left:0; z-index:20; background:#1e1e1e; min-width:150px;">Agente</th>';
    html += '<th style="background:#1e1e1e;">Cargo</th>';

    // Header Days
    sortedDates.forEach(date => {
        const dayPart = date.split('-')[2];
        const isToday = (date === todayStr);

        if (date < todayStr) return; // Skip past days

        const style = isToday ? 'background: #fbbf24; color: black; border: 2px solid #fbbf24;' : '';
        html += `<th style="${style}">${dayPart}</th>`;
    });
    html += '</tr></thead><tbody>';

    // Body Rows
    const sortedUserKeys = Object.keys(users).sort((a, b) => users[a].name.localeCompare(users[b].name));

    sortedUserKeys.forEach(key => {
        const u = users[key];
        html += '<tr>';
        html += `<td style="text-align:left; position:sticky; left:0; background:#1e1e1e; font-weight:bold; border-right:2px solid rgba(255,255,255,0.1);">${u.name}</td>`;
        html += `<td style="font-size:0.7rem; background:#1e1e1e;">${u.role}</td>`;

        sortedDates.forEach(date => {
            if (date < todayStr) return; // Skip past days

            const code = u.shifts[date] || '-';
            const isToday = (date === todayStr);

            // Color Logic
            let cellClass = '';
            const c = (code + '').toUpperCase().trim();

            if (c.includes('CU')) cellClass = 'shift-CU';
            else if (c.startsWith('M')) cellClass = 'shift-M';
            else if (c.startsWith('T')) cellClass = 'shift-T';
            else if (c.startsWith('N')) cellClass = 'shift-N';
            else if (c.startsWith('S')) cellClass = 'shift-S';
            else if (['LI', 'L', 'LIBRE'].includes(c)) cellClass = 'shift-L';
            else if (['AU', 'AUSENCIA'].includes(c)) cellClass = 'shift-AU';
            else if (c === 'SIN TURNO') { cellClass = ''; }

            if (isToday) cellClass += ' today';

            // Clean display
            const displayCode = c === 'SIN TURNO' ? '-' : code;

            html += `<td class="${cellClass}">${displayCode}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody>';

    table.innerHTML = html;
}

// --- EDIT PROFILE MODAL LOGIC ---
function injectEditProfileModal() {
    if (document.getElementById('edit-profile-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'edit-profile-modal';
    modal.style.display = 'none';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.background = 'rgba(0,0,0,0.7)';
    modal.style.zIndex = '10000';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.backdropFilter = 'blur(4px)';

    modal.innerHTML = `
        <div class="glass" style="background:var(--bg-card); padding:2rem; border-radius:16px; width:90%; max-width:500px; position:relative; box-shadow:0 20px 50px rgba(0,0,0,0.5);">
            <button onclick="closeEditProfile()" style="position:absolute; top:1rem; right:1rem; border:none; background:none; color:var(--text-color); font-size:1.5rem; cursor:pointer;">&times;</button>
            <h3 style="margin-top:0; color:var(--primary-color); margin-bottom:1.5rem;">✏️ Editar Perfil</h3>
            
            <input type="hidden" id="edit-user-id">

            <div style="display:grid; gap:1rem;">
                <div>
                    <label style="display:block; margin-bottom:0.5rem; font-size:0.9rem;">Nombre Completo</label>
                    <input type="text" id="edit-fullname" class="input-style" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--card-border); background:rgba(255,255,255,0.05); color:var(--text-color);">
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
                    <div>
                        <label style="display:block; margin-bottom:0.5rem; font-size:0.9rem;">Rol / Cargo</label>
                        <select id="edit-role" class="input-style" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--card-border); background:rgba(255,255,255,0.05); color:var(--text-color);">
                            <option value="Agente">Agente</option>
                            <option value="Supervisor">Supervisor</option>
                            <option value="CDO">CDO</option>
                            <option value="Administrador">Administrador</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; margin-bottom:0.5rem; font-size:0.9rem;">Equipo</label>
                        <select id="edit-team" class="input-style" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--card-border); background:rgba(255,255,255,0.05); color:var(--text-color);">
                            <option value="LATAM">LATAM</option>
                            <option value="OLA">OLA</option>
                            <option value="Otro">Otro</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label style="display:block; margin-bottom:0.5rem; font-size:0.9rem;">Estado TICA</label>
                     <select id="edit-tica" class="input-style" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--card-border); background:rgba(255,255,255,0.05); color:var(--text-color);">
                        <option value="no_tiene">No tiene / Desconocido</option>
                        <option value="vigente">✅ Vigente</option>
                        <option value="por_vencer">⚠️ Por Vencer</option>
                        <option value="vencida">❌ Vencida</option>
                    </select>
                </div>
                
                 <div>
                    <label style="display:block; margin-bottom:0.5rem; font-size:0.9rem;">RUT</label>
                    <input type="text" id="edit-rut" class="input-style" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--card-border); background:rgba(255,255,255,0.05); color:var(--text-color);">
                </div>
            </div>

            <div style="margin-top:2rem; display:flex; justify-content:flex-end; gap:1rem;">
                <button onclick="closeEditProfile()" class="btn" style="background:rgba(255,255,255,0.1); width:auto;">Cancelar</button>
                <button onclick="saveEditProfile()" class="btn" style="width:auto;">Guardar Cambios</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

window.openEditProfile = async function (userId) {
    injectEditProfileModal();
    const modal = document.getElementById('edit-profile-modal');

    // Reset/Loading state
    document.getElementById('edit-user-id').value = userId;
    document.getElementById('edit-fullname').value = 'Cargando...';

    modal.style.display = 'flex';

    // Fetch User Data
    const { data: user, error } = await supabase.from('profiles').select('*').eq('id', userId).single();

    if (error) {
        alert("Error cargando perfil: " + error.message);
        modal.style.display = 'none';
        return;
    }

    // Populate
    document.getElementById('edit-fullname').value = user.full_name || '';
    document.getElementById('edit-role').value = user.role || 'Agente';
    document.getElementById('edit-team').value = user.team || 'LATAM';
    document.getElementById('edit-tica').value = user.tica_status || 'no_tiene';
    document.getElementById('edit-rut').value = user.rut || '';
}

window.closeEditProfile = function () {
    const modal = document.getElementById('edit-profile-modal');
    if (modal) modal.style.display = 'none';
}

window.saveEditProfile = async function () {
    const userId = document.getElementById('edit-user-id').value;
    const updates = {
        full_name: document.getElementById('edit-fullname').value,
        role: document.getElementById('edit-role').value,
        team: document.getElementById('edit-team').value,
        tica_status: document.getElementById('edit-tica').value,
        rut: document.getElementById('edit-rut').value
    };

    const { error } = await supabase.from('profiles').update(updates).eq('id', userId);

    if (error) {
        alert("Error guardando cambios: " + error.message);
    } else {
        // Success
        closeEditProfile();
        // Refresh the roster view to show changes
        if (typeof loadDailyRosterManagement === 'function') {
            loadDailyRosterManagement();
        }
    }
}

// --- MANUAL LINK MODAL ---
function injectLinkModal() {
    if (document.getElementById('link-profile-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'link-profile-modal';
    modal.style.cssText = `
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.85);
        z-index: 10000;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(8px);
    `;

    modal.innerHTML = `
        <div style="background: linear-gradient(145deg, #1a1a2e, #16213e); padding: 2rem; border-radius: 16px; width: 90%; max-width: 500px; position: relative; box-shadow: 0 25px 60px rgba(0,0,0,0.6); border: 1px solid rgba(245, 158, 11, 0.3);">
            <button onclick="closeLinkModal()" style="position: absolute; top: 1rem; right: 1rem; border: none; background: rgba(255,255,255,0.1); color: #fff; font-size: 1.2rem; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">&times;</button>
            
            <h3 style="margin-top: 0; color: #f59e0b; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 1.3rem;">🔗</span> Vincular Perfil
            </h3>
            
            <p style="font-size: 0.9rem; color: rgba(255,255,255,0.7); margin-bottom: 1.5rem; background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 10px; border-left: 3px solid #f59e0b;">
                Estás vinculando el turno de: <br>
                <strong id="link-target-name" style="font-size: 1.1rem; color: #fff; display: block; margin-top: 0.5rem;"></strong>
                <span style="font-family: monospace; background: rgba(245,158,11,0.2); padding: 4px 10px; border-radius: 6px; color: #f59e0b; font-size: 0.85rem; display: inline-block; margin-top: 0.5rem;">RUT: <span id="link-target-rut-disp"></span></span>
            </p>
            
            <input type="hidden" id="link-target-rut">

            <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; color: rgba(255,255,255,0.8);">Selecciona el usuario del sistema:</label>
                
                <div style="position: relative;">
                    <input type="text" id="link-search-input" placeholder="🔍 Buscar por nombre..." 
                        style="width: 100%; padding: 12px 16px; border-radius: 10px; border: 1px solid rgba(245,158,11,0.4); background: rgba(0,0,0,0.4); color: #fff; font-size: 1rem; outline: none; transition: all 0.3s; box-sizing: border-box;"
                        onfocus="this.style.borderColor='#f59e0b'; this.style.boxShadow='0 0 15px rgba(245,158,11,0.2)';"
                        onblur="this.style.borderColor='rgba(245,158,11,0.4)'; this.style.boxShadow='none';"
                        oninput="filterLinkUsers(this.value)">
                </div>
                
                <div id="link-users-list" style="max-height: 200px; overflow-y: auto; margin-top: 0.75rem; background: rgba(0,0,0,0.3); border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="padding: 1rem; text-align: center; color: rgba(255,255,255,0.5);">Cargando usuarios...</div>
                </div>
                
                <input type="hidden" id="link-profile-select">
                
                <p style="font-size: 0.8rem; margin-top: 0.75rem; color: #f59e0b; background: rgba(245,158,11,0.1); padding: 0.75rem; border-radius: 8px; display: flex; align-items: start; gap: 0.5rem;">
                    <span>⚠️</span>
                    <span>Al vincular, el RUT del usuario seleccionado será actualizado a: <strong><span id="link-target-rut-warn"></span></strong></span>
                </p>
            </div>

            <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 1rem;">
                <button onclick="closeLinkModal()" style="padding: 12px 24px; border-radius: 10px; border: none; background: rgba(255,255,255,0.1); color: #fff; font-weight: 600; cursor: pointer; transition: all 0.3s;"
                    onmouseover="this.style.background='rgba(255,255,255,0.2)'"
                    onmouseout="this.style.background='rgba(255,255,255,0.1)'">CANCELAR</button>
                <button onclick="saveManualLink()" style="padding: 12px 24px; border-radius: 10px; border: none; background: linear-gradient(135deg, #f59e0b, #d97706); color: #000; font-weight: 700; cursor: pointer; transition: all 0.3s; text-transform: uppercase;"
                    onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 5px 20px rgba(245,158,11,0.4)'"
                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">VINCULAR AHORA</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Store users for filtering
let linkModalUsers = [];

window.filterLinkUsers = function (query) {
    const list = document.getElementById('link-users-list');
    const q = query.toLowerCase().trim();

    const filtered = q === '' ? linkModalUsers : linkModalUsers.filter(u =>
        u.full_name.toLowerCase().includes(q) || (u.rut && u.rut.includes(q))
    );

    if (filtered.length === 0) {
        list.innerHTML = `<div style="padding: 1rem; text-align: center; color: rgba(255,255,255,0.5);">No se encontraron usuarios</div>`;
        return;
    }

    list.innerHTML = filtered.map(u => `
        <div class="link-user-item" onclick="selectLinkUser('${u.id}', '${u.full_name.replace(/'/g, "\\'")}')" 
            style="padding: 10px 14px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; transition: all 0.2s;"
            onmouseover="this.style.background='rgba(245,158,11,0.15)'"
            onmouseout="this.style.background='transparent'">
            <span style="color: #fff; font-weight: 500;">${u.full_name}</span>
            <span style="font-size: 0.75rem; color: rgba(255,255,255,0.5); font-family: monospace;">${u.rut || 'Sin RUT'}</span>
        </div>
    `).join('');
}

window.selectLinkUser = function (userId, userName) {
    document.getElementById('link-profile-select').value = userId;
    document.getElementById('link-search-input').value = userName;
    document.getElementById('link-search-input').style.borderColor = '#10b981';
    document.getElementById('link-search-input').style.background = 'rgba(16, 185, 129, 0.1)';

    // Highlight selection in list
    document.querySelectorAll('.link-user-item').forEach(el => el.style.background = 'transparent');
    event.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)';
}

window.openManualLink = async function (rut, name) {
    injectLinkModal();
    const modal = document.getElementById('link-profile-modal');

    document.getElementById('link-target-rut').value = rut;
    document.getElementById('link-target-rut-disp').textContent = rut;
    document.getElementById('link-target-rut-warn').textContent = rut;
    document.getElementById('link-target-name').textContent = name;
    document.getElementById('link-profile-select').value = '';
    document.getElementById('link-search-input').value = '';
    document.getElementById('link-search-input').style.borderColor = 'rgba(245,158,11,0.4)';
    document.getElementById('link-search-input').style.background = 'rgba(0,0,0,0.4)';

    modal.style.display = 'flex';

    // Fetch Users
    const { data: users, error } = await supabase.from('profiles').select('id, full_name, rut').order('full_name');

    if (users) {
        linkModalUsers = users;
        filterLinkUsers('');
    } else {
        document.getElementById('link-users-list').innerHTML = `<div style="padding: 1rem; text-align: center; color: #ef4444;">Error cargando usuarios</div>`;
    }
}

window.closeLinkModal = function () {
    document.getElementById('link-profile-modal').style.display = 'none';
}

window.saveManualLink = async function () {
    const userId = document.getElementById('link-profile-select').value;
    const targetRut = document.getElementById('link-target-rut').value;
    const targetName = document.getElementById('link-target-name').textContent; // Name from the roster/shift

    console.log("Start Manual Link:", { userId, targetRut });

    if (!userId) {
        alert("Por favor selecciona un usuario de la lista.");
        return;
    }

    if (!confirm("¿Estás seguro de vincular este RUT al usuario seleccionado?")) return;

    // 1. Check duplicate RUT in profiles (Strict check to avoid conflicts)
    // We clean the RUT for the check to be safe
    const cleanRutVal = String(targetRut).replace(/[^0-9kK]/g, '').toUpperCase();

    // Check if this physical RUT exists on ANY profile
    // We search profiles by clean rut logic if possible, but postgres usually stores strict string
    // Let's filter client side or assume strict format in DB?
    // Best: Check strict match on 'rut' column first
    const { data: existing, error: checkErr } = await supabase
        .from('profiles')
        .select('id, full_name, rut')
        .neq('id', userId)
        .eq('rut', targetRut) // Try exact string match
        .maybeSingle();

    if (checkErr) {
        console.error("Link check error:", checkErr);
        alert("Error verificando RUT: " + checkErr.message);
        return;
    }

    if (existing) {
        alert(`⚠️ El RUT ${targetRut} ya está asignado a otro usuario: ${existing.full_name}.\n\nNo se puede vincular.`);
        return;
    }

    // 2. Update Profile with the EXACT RUT from input (to match what user sees/entered)
    // OR should we save the clean version? 
    // If we save the clean version, we guarantee matches.
    // Let's save the RAW version as requested, but also ensure consistency.
    // Actually, saving the CLEAN version is safer for the system.
    // But user might want formatting. 
    // Compromise: Save what was passed, but we know loadDailyRoster cleans it for matching.

    const { error } = await supabase.from('profiles').update({ rut: targetRut }).eq('id', userId);

    if (error) {
        console.error("Link update error:", error);
        alert("Error al guardar en base de datos: " + error.message);
        return;
    }

    // 3. Sync to agent_predata (Smart Learning)
    try {
        // Check if this RUT exists in predata
        const { data: preExisting } = await supabase
            .from('agent_predata')
            .select('id')
            .eq('rut', cleanRutVal)
            .maybeSingle();

        if (preExisting) {
            // Update existing predata to ensure name matches roster reference
            await supabase.from('agent_predata').update({
                full_name: targetName,
                updated_at: new Date()
            }).eq('id', preExisting.id);
        } else {
            // Insert new predata record
            await supabase.from('agent_predata').insert({
                rut: cleanRutVal,
                full_name: targetName,
                tica_status: 'no_tiene' // Default
            });
        }
    } catch (err) {
        console.warn("Non-fatal error syncing agent_predata:", err);
    }

    alert("✅ Vinculación exitosa. El perfil ha sido actualizado.");
    closeLinkModal();

    // Reload Rosters view with a slight delay to ensure propagation
    if (typeof loadDailyRosterManagement === 'function') {
        setTimeout(() => {
            loadDailyRosterManagement();
        }, 500);
    }

    // Also try to refresh the main dashboard if available
    if (typeof window.loadTodayShifts === 'function') {
        setTimeout(() => {
            window.loadTodayShifts();
        }, 500);
    }
}

// --- MOVILIZACION (TRIAGE) LOGIC ---

// Helper: Normalize RUT
window.normalizeRut = (r) => {
    if (!r) return '';
    return r.replace(/\./g, '').replace(/-/g, '').toUpperCase().trim();
};

// Helper: Resolve Shift Times
window.getShiftTimes = (code) => {
    if (!code) return { start: null, end: null };
    code = String(code).toUpperCase().trim();

    // 1. Dictionary (Legacy/Overrides)
    const map = {
        'T1': { s: '07:00', e: '15:00' },
        'T2': { s: '15:00', e: '23:00' },
        'T3': { s: '23:00', e: '07:00' },
        'TN': { s: '21:00', e: '07:00' },
        'NOCHE': { s: '22:00', e: '07:00' },
        'ADMIN': { s: '08:30', e: '17:30' },
        'OFICINA': { s: '08:30', e: '17:30' },
        'AM': { s: '07:00', e: '15:00' },
        'PM': { s: '15:00', e: '23:00' },
        'LIBRE': { s: null, e: null },
        'L': { s: null, e: null },
        'X': { s: null, e: null },
        'F': { s: null, e: null }
    };
    if (map[code]) return map[code];

    // 2. Pattern: [Letters][StartHH][EndHH]
    // Examples: N0113 (Start 01:00, End 13:00), M0618
    const patternMatch = code.match(/^([A-Z]+)(\d{2})(\d{2})$/);
    if (patternMatch) {
        return {
            start: `${patternMatch[2]}:00`,
            end: `${patternMatch[3]}:00`
        };
    }

    // 3. Pattern: Just Numbers "0715" -> 07:00-15:00
    const numMatch = code.match(/^(\d{2})(\d{2})$/);
    if (numMatch) {
        return {
            start: `${numMatch[1]}:00`,
            end: `${numMatch[2]}:00`
        };
    }

    // 4. Heuristics (Explicit Times)
    if (/^\d{1,2}:\d{2}$/.test(code)) {
        const parts = code.split(':');
        const h = parseInt(parts[0]);
        const m = parts[1];
        const sStr = `${String(h).padStart(2, '0')}:${m}`;

        let endH = (h + 9) % 24;
        const eStr = `${String(endH).padStart(2, '0')}:${m}`;
        return { start: sStr, end: eStr };
    }

    if (/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(code)) {
        const [s, e] = code.split('-');
        return { start: s.trim(), end: e.trim() };
    }

    return { start: null, end: null };
};

window.initMovilizacion = async function () {
    const dateInput = document.getElementById('movil-date');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    loadMovilRequesters();
};

async function loadMovilRequesters() {
    const { data: users, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['Administrador', 'Supervisor', 'CDO'])
        .order('full_name');

    const select = document.getElementById('movil-requester');
    if (!select) return;

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

// NOTE: generateMovilExcel has been moved to movilizacion.js (the authoritative source)
// Do NOT define it here as it will overwrite the correct version.

// --- EXPORT DAILY ATTENDANCE EXCEL ---
window.exportDailyAttendanceExcel = async function (targetDate) {
    if (!targetDate) return;

    // Show loading state on button
    const btn = document.getElementById('btn-export-daily');
    const originalText = btn ? btn.innerHTML : 'Descargar';
    if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';

    try {
        console.log(`Starting export for ${targetDate}`);

        // 1. Fetch Data (Parallel)
        const [shiftsRes, profilesRes, attendanceRes, predataRes] = await Promise.all([
            // Shifts for target date
            supabase.from('user_shifts').select('*').eq('shift_date', targetDate),
            // Profiles
            supabase.from('profiles').select('id, rut, full_name, tica_status, email, phone'),
            // Attendance for target date
            supabase.from('attendance').select('*').eq('shift_date', targetDate),
            // Predata
            supabase.from('agent_predata').select('rut, full_name, tica_status')
        ]);

        if (shiftsRes.error) throw shiftsRes.error;
        const shifts = shiftsRes.data || [];
        const profiles = profilesRes.data || [];
        const attendanceData = attendanceRes.data || [];
        const predata = predataRes.data || [];

        // 2. Index Data
        const cleanRut = (s) => String(s || '').replace(/[^0-9kK]/g, '').toUpperCase();

        const profileMap = {}; // Key: CleanRut -> Profile
        const profileByName = {}; // Key: Name -> Profile (for manual links)
        profiles.forEach(p => {
            if (p.rut) profileMap[cleanRut(p.rut)] = p;
            if (p.full_name) profileByName[p.full_name.trim().toUpperCase()] = p;
        });

        const attendanceMap = {}; // Key: CleanRut -> Attendance Row
        attendanceData.forEach(a => {
            if (a.rut) attendanceMap[cleanRut(a.rut)] = a;
        });

        const predataMap = {}; // Key: CleanRut -> Predata
        predata.forEach(p => {
            if (p.rut) predataMap[cleanRut(p.rut)] = p;
        });

        // 3. Process Rows
        const rows = [];

        // Exclude these shift codes
        const excluded = ['L', 'LI', 'X', 'V', 'LIBRE', 'VACACIONES', 'VAC'];

        for (const s of shifts) {
            const code = (s.shift_code || '').trim().toUpperCase();
            if (excluded.includes(code)) continue;

            const sRutClean = cleanRut(s.rut);

            // Resolve Profile (Logic similar to dashboard/roster)
            let profile = profileMap[sRutClean];
            if (!profile && s.user_name) {
                profile = profileByName[s.user_name.trim().toUpperCase()];
            }

            // Resolve Attendance
            // Primary key is RUT, fallback to name if absolutely necessary but RUT is standard here
            let att = attendanceMap[sRutClean] || {};

            // Resolve TICA
            const ticaStatus = profile?.tica_status || predataMap[sRutClean]?.tica_status || 'sin_tica';

            // Resolve values
            const rut = s.rut || profile?.rut || 'SIN-RUT';
            const name = profile?.full_name || s.user_name || 'Desconocido';
            const role = s.role_raw || '-';
            const shiftCode = s.shift_code || '-';

            // Format Attendance Status
            const attStatus = att.attendance_status || 'Pendiente';
            const attLabel = {
                'presente': 'Presente',
                'ausente': 'Ausente',
                'licencia': 'Licencia',
                'pending': 'Pendiente',
                'pendiente': 'Pendiente'
            }[attStatus.toLowerCase()] || attStatus;

            const obs = att.observation || '';
            const colacion = att.colation_status || 'Pendiente';

            rows.push({
                "RUT": rut,
                "Nombre": name,
                "ORIGEN (CARGO O ROL)": role,
                "TURNOS": shiftCode,
                "ASISTENCIA": attLabel,
                "OBSERVACIONES": obs,
                "Estado ticas": ticaStatus,
                "COLACIONES": colacion
            });
        }

        // Sort by Name
        rows.sort((a, b) => a.Nombre.localeCompare(b.Nombre));

        // 4. Generate Excel
        const worksheet = XLSX.utils.json_to_sheet(rows);

        // Auto-width columns (simple estimation)
        const wscols = [
            { wch: 15 }, // RUT
            { wch: 40 }, // Nombre
            { wch: 25 }, // Role
            { wch: 10 }, // Turno
            { wch: 15 }, // Asistencia
            { wch: 30 }, // Obs
            { wch: 15 }, // Tica
            { wch: 15 }  // Colacion
        ];
        worksheet['!cols'] = wscols;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Asistencia");

        XLSX.writeFile(workbook, `Asistencia_${targetDate}.xlsx`);

    } catch (err) {
        console.error("Export Error:", err);
        alert("Error al exportar: " + err.message);
    } finally {
        if (btn) btn.innerHTML = originalText;
    }
};

// --- SORTING LOGIC ---
let currentSort = { col: null, dir: 'asc' };

window.sortDailyTable = function (col) {
    const tbody = document.querySelector('#daily-roster-container tbody');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));

    // Toggle direction
    if (currentSort.col === col) {
        currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.col = col;
        currentSort.dir = 'asc';
    }

    // Sort
    rows.sort((a, b) => {
        let valA = a.dataset[col] || '';
        let valB = b.dataset[col] || '';

        if (col === 'shift') {
            // Specialized shift sort? Alphanumeric is fine for now.
        }

        if (valA < valB) return currentSort.dir === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.dir === 'asc' ? 1 : -1;
        return 0;
    });

    // Re-append
    rows.forEach(r => tbody.appendChild(r));

    // Update Icons
    document.querySelectorAll('.table-header i.fa-sort, .table-header i.fa-sort-up, .table-header i.fa-sort-down').forEach(i => {
        i.className = 'fas fa-sort'; // Reset
        i.style.opacity = '0.3';
    });

    const iconId = `sort-icon-${col}`;
    const icon = document.getElementById(iconId);
    if (icon) {
        icon.className = currentSort.dir === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
        icon.style.opacity = '1';
    }
};
