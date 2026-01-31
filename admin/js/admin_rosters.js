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

// --- DAILY ROSTER MANAGEMENT ---
async function loadDailyRosterManagement() {
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
        // 1. Calculate Dates (Today, Tomorrow, Day After)
        // Use local date logic to avoid UTC offsets for "Today"
        const getLocalYMD = (offset) => {
            const d = new Date();
            d.setDate(d.getDate() + offset);
            return d.toLocaleDateString('fr-CA'); // YYYY-MM-DD
        };

        const today = getLocalYMD(0);
        const tomorrow = getLocalYMD(1);
        const dayAfter = getLocalYMD(2);

        // UI Formatters
        const formatDateUI = (ymd) => {
            const [y, m, d] = ymd.split('-');
            return `${d}/${m}/${y}`;
        };
        const formatDateHeader = (ymd) => {
            const [y, m, d] = ymd.split('-');
            return `${d}/${m}`;
        };

        // Fetch Shifts for 3 Days
        const { data: shifts, error } = await supabase
            .from('user_shifts')
            .select('*')
            .in('shift_date', [today, tomorrow, dayAfter])
            .order('user_name');

        if (error) throw error;

        // Fetch profiles
        const { data: pData } = await supabase.from('profiles').select('rut, id, tica_status, full_name');
        const profiles = pData || [];

        // Helper to normalize RUT
        const cleanRut = (r) => String(r || '').replace(/[^0-9kK]/g, '').toUpperCase();

        const profileMap = {};
        profiles.forEach(p => {
            if (p.rut) profileMap[cleanRut(p.rut)] = p;
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
                        shifts: {}
                    };
                }
                // Map Date -> Code
                groupedUsers[key].shifts[s.shift_date] = s.shift_code;
            });
        }

        container.innerHTML = `
            <h4 style="margin-bottom: 1rem; color: var(--primary-color);">📋 Gestión Operativa del Día (${formatDateUI(today)})</h4>
            
            <div style="margin-bottom: 1rem; position: relative; max-width: 400px;">
                <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events:none;"></i>
                <input type="text" id="daily-roster-search" placeholder="Buscar por Nombre, RUT o Cargo..." 
                       style="width: 100%; padding: 10px 16px 10px 36px; border-radius: 8px; border: 1px solid var(--card-border); background: var(--input-bg, rgba(255,255,255,0.05)); color: var(--text-color); font-size: 0.9rem; outline:none;">
            </div>

            <div style="background: var(--bg-card); border-radius: 12px; padding: 1rem; overflow-x: auto;">
                <table class="modern-table" style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                    <thead>
                        <tr style="border-bottom: 1px solid rgba(0,0,0,0.1);">
                            <th style="padding:10px; text-align:left;">Agente</th>
                            <th style="padding:10px; text-align:center;">Hoy<br><small style="opacity:0.6">${formatDateHeader(today)}</small></th>
                            <th style="padding:10px; text-align:center;">Mañana<br><small style="opacity:0.6">${formatDateHeader(tomorrow)}</small></th>
                            <th style="padding:10px; text-align:center;">Subsig.<br><small style="opacity:0.6">${formatDateHeader(dayAfter)}</small></th>
                            <th style="padding:10px; text-align:center;">Estado TICA</th>
                            <th style="padding:10px; text-align:center;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        `;

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
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem;">No hay turnos para estos días.</td></tr>';
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

        userKeys.forEach(key => {
            const u = groupedUsers[key];
            let profile = profileMap[u.cleanRut];
            let autoLinked = false;

            // Link logic
            if (!profile) {
                const nameMatch = profiles.find(p => p.full_name && p.full_name.trim().toLowerCase() === u.name.trim().toLowerCase());
                if (nameMatch) {
                    profile = nameMatch;
                    autoLinked = true;
                    // Auto-update RUT if needed
                    if (cleanRut(nameMatch.rut) !== u.cleanRut) {
                        console.log(`Auto-linking RUT ${u.rut} for user ${u.name}`);
                        supabase.from('profiles').update({ rut: u.rut }).eq('id', nameMatch.id).then(() => { });
                    }
                }
            }

            const userId = profile ? profile.id : null;
            const currentTica = profile ? profile.tica_status : 'unknown';

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid rgba(0,0,0,0.05)';

            // Select Options
            const opts = [
                { val: 'vigente', label: '✅ Vigente' },
                { val: 'por_vencer', label: '⚠️ Por Vencer' },
                { val: 'vencida', label: '❌ Vencida' }
            ].map(o => `<option value="${o.val}" ${o.val === currentTica ? 'selected' : ''}>${o.label}</option>`).join('');

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

            // Shift Columns
            const renderShiftCell = (date) => {
                const code = u.shifts[date] || '-';
                if (code === '-') return '<span style="opacity:0.3">-</span>';
                return `<span class="badge" style="${getCodeStyle(code)} font-family:'Courier New', monospace; font-size:0.9rem; padding:4px 8px; border-radius:6px;">${code}</span>`;
            };

            tr.innerHTML = `
                <td style="padding: 12px 16px;">
                    <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-color); margin-bottom: 4px;">${u.name}</div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="font-size: 0.8rem; opacity: 0.7;">${u.role || 'Sin Cargo'}</span>
                        ${notFoundWarning}
                    </div>
                </td>
                <td style="padding: 12px; text-align: center;">${renderShiftCell(today)}</td>
                <td style="padding: 12px; text-align: center;">${renderShiftCell(tomorrow)}</td>
                <td style="padding: 12px; text-align: center;">${renderShiftCell(dayAfter)}</td>
                <td style="padding: 12px; text-align: center;">
                    ${userId ? `
                    <div style="position: relative; width: 100%; max-width: 160px; margin: 0 auto;">
                        <select onchange="updateAgentTica('${userId}', this.value)" 
                                style="width: 100%; padding: 8px 12px; border-radius: 8px; 
                                       border: 1px solid ${selectBorder}; 
                                       background-color: var(--bg-card); 
                                       color: var(--text-color); 
                                       font-size: 0.85rem; 
                                       cursor: pointer; 
                                       outline: none; 
                                       appearance: none;
                                       -webkit-appearance: none;
                                       font-family: inherit;
                                       transition: all 0.2s ease;">
                            ${opts}
                        </select>
                         <div style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); pointer-events: none; opacity: 0.6;">
                            <i class="fas fa-chevron-down" style="font-size: 0.7rem;"></i>
                        </div>
                    </div>` : '<span style="opacity:0.4; font-size:0.8rem;">—</span>'}
                </td>
                <td style="padding: 12px; text-align: center;">
                    ${userId ? `
                        <button class="btn-icon" title="Editar Perfil" onclick="openEditProfile('${userId}')" 
                                style="color: var(--text-color); background: var(--bg-card); width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--card-border); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;">
                            <i class="fas fa-edit"></i>
                        </button>
                    ` : `
                        <button class="btn-icon" title="Vincular Perfil Manualmente" onclick="openManualLink('${u.rut}', '${u.name.replace(/'/g, "\\'")}')" 
                                style="color: #f59e0b; background: rgba(245,158,11,0.1); width: 32px; height: 32px; border-radius: 8px; border: 1px solid rgba(245,158,11,0.3); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;">
                            <i class="fas fa-link"></i>
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

window.updateAgentTica = async function (userId, newStatus) {
    if (!userId) return;
    try {
        // Show lightweight toast or processing indicator? For now just silent or console.
        console.log(`Updating TICA for ${userId} to ${newStatus}`);

        const { error } = await supabase
            .from('profiles')
            .update({ tica_status: newStatus })
            .eq('id', userId);

        if (error) throw error;

        // Optional: Show visual success (green outline?)
        // const select = document.activeElement; 
        // if(select) select.style.borderColor = 'green';

    } catch (err) {
        alert("Error actualizando TICA: " + err.message);
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
                            shift_code: shiftCode
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

    if (!userId) {
        alert("Por favor selecciona un usuario.");
        return;
    }

    if (!confirm("¿Estás seguro de vincular este RUT al usuario seleccionado? Esto actualizará su perfil.")) return;

    const { error } = await supabase.from('profiles').update({ rut: targetRut }).eq('id', userId);

    if (error) {
        alert("Error al vincular: " + error.message);
    } else {
        closeLinkModal();
        if (typeof loadDailyRosterManagement === 'function') {
            loadDailyRosterManagement();
        }
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
