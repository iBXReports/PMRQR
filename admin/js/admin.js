
import { supabase } from '../../assets/js/client.js';

// --- STATE ---
let currentUser = null;
let allShiftsCache = [];
let allUsersCache = []; // Fix: Global cache for users to avoid ReferenceError
let filteredShifts = [];
let currentShiftsPage = 0;
const shiftsPerPage = 20;

// --- GLOBAL HELPERS FOR DASHBOARD STATS ---
window._dashboardData = {
    onShift: [],
    upcoming: [],
    ticaActive: [],
    sinTica: [],
    ausencias: []
};

window.showStatDetail = function (type) {
    const modal = document.getElementById('stat-detail-modal');
    const title = document.getElementById('stat-detail-title');
    const content = document.getElementById('stat-detail-content');

    if (!modal || !title || !content) return;

    const data = window._dashboardData || {};
    let titleText = '';
    let agents = [];
    let badgeColor = '#6b7280';

    switch (type) {
        case 'on-shift':
            titleText = '🟢 Agentes En Turno (Presentes)';
            agents = data.onShift || [];
            badgeColor = '#10b981';
            break;
        case 'upcoming':
            titleText = '⏰ Agentes Por Ingresar (Próximas 4 hrs)';
            agents = data.upcoming || [];
            badgeColor = '#f59e0b';
            break;
        case 'tica-active':
            titleText = '✅ Agentes con TICA Vigente (Presentes)';
            agents = data.ticaActive || [];
            badgeColor = '#0ea5e9';
            break;
        case 'sin-tica':
            titleText = '❌ Agentes Sin TICA';
            agents = data.sinTica || [];
            badgeColor = '#6b7280';
            break;
        case 'ausencias':
            titleText = '🚫 Ausencias del Día';
            agents = data.ausencias || [];
            badgeColor = '#ef4444';
            break;
    }

    title.textContent = titleText;

    if (agents.length === 0) {
        content.innerHTML = '<p style="text-align:center; opacity:0.6;">No hay agentes en esta categoría.</p>';
    } else {
        let html = `<div style="display:grid; gap:0.5rem;">`;
        agents.forEach(a => {
            const teamColor = a.team === 'LATAM' ? '#ef4444' : '#3b82f6';
            const obs = a.observation || '';
            html += `
                <div style="display:flex; align-items:center; gap:0.75rem; padding:0.75rem; background:rgba(255,255,255,0.05); border-radius:8px; border-left:3px solid ${badgeColor};">
                    <div style="flex:1;">
                        <div style="font-weight:600; font-size:0.9rem;">${a.name || 'Sin Nombre'}</div>
                        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.25rem;">
                            <span style="font-size:0.7rem; opacity:0.7;">${a.role || 'Sin Cargo'}</span>
                            <span style="font-size:0.65rem; padding:2px 6px; border-radius:4px; background:rgba(${a.team === 'LATAM' ? '239,68,68' : '59,130,246'},0.2); color:${teamColor};">${a.team || 'OLA'}</span>
                            ${a.shiftCode ? `<span style="font-size:0.7rem; padding:2px 6px; border-radius:4px; background:rgba(99,102,241,0.2); color:#6366f1; font-family:monospace;">${a.shiftCode}</span>` : ''}
                            ${obs && obs !== 'SIN OBS' ? `<span style="font-size:0.65rem; padding:2px 6px; border-radius:4px; background:rgba(245,158,11,0.2); color:#f59e0b;">${obs}</span>` : ''}
                        </div>
                    </div>
                    ${a.ticaStatus ? `<span style="font-size:0.7rem; padding:3px 8px; border-radius:6px; background:${window.getTicaBg(a.ticaStatus)}; color:${window.getTicaColor(a.ticaStatus)}; white-space:nowrap;">${window.getTicaLabel(a.ticaStatus)}</span>` : ''}
                </div>
            `;
        });
        html += '</div>';
        content.innerHTML = html;
    }

    modal.style.display = 'flex';
};

window.getTicaColor = function (status) {
    const colors = { 'vigente': '#10b981', 'por_vencer': '#f59e0b', 'vencida': '#ef4444', 'en_tramite': '#3b82f6', 'sin_tica': '#6b7280' };
    return colors[status] || '#6b7280';
};

window.getTicaBg = function (status) {
    const bgs = { 'vigente': 'rgba(16,185,129,0.2)', 'por_vencer': 'rgba(245,158,11,0.2)', 'vencida': 'rgba(239,68,68,0.2)', 'en_tramite': 'rgba(59,130,246,0.2)', 'sin_tica': 'rgba(107,114,128,0.2)' };
    return bgs[status] || 'rgba(107,114,128,0.2)';
};

window.getTicaLabel = function (status) {
    const labels = { 'vigente': '✅ Vigente', 'por_vencer': '⚠️ Por Vencer', 'vencida': '❌ Vencida', 'en_tramite': '🔄 Trámite', 'sin_tica': '❓ Sin TICA' };
    return labels[status] || '❓ Sin TICA';
};

window.updateDashStats = function (active, upcoming, additionalStats = {}) {
    const elActive = document.getElementById('stat-on-shift');
    const elUpcoming = document.getElementById('stat-upcoming');
    const elTicaActive = document.getElementById('stat-tica-active');
    const elSinTica = document.getElementById('stat-sin-tica');
    const elAusencias = document.getElementById('stat-ausencias');

    if (elActive) elActive.textContent = active;
    if (elUpcoming) elUpcoming.textContent = upcoming;
    if (elTicaActive) elTicaActive.textContent = additionalStats.ticaActive || 0;
    if (elSinTica) elSinTica.textContent = additionalStats.sinTica || 0;
    if (elAusencias) elAusencias.textContent = additionalStats.ausencias || 0;
};


console.log("Admin JS loading...");
// alert("Admin JS Script Executing");

// NOTE: Global window assignments are made AFTER function definitions below

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. Auth Check - STRICT
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError) {
            alert("Auth Error: " + authError.message);
            throw authError;
        }

        if (!session) {
            window.location.href = '../login.html';
            return;
        }

        // Fetch profile
        const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();

        if (profileError) {
            console.error("Profile Error:", profileError);
            // Don't block entirely, but alert
            alert("Error cargando perfil: " + profileError.message);
        }

        if (profile) {
            currentUser = profile;
            updateUIProfile(profile);
        }


        // 2. Load Initial Data
        await loadDashboard();



        // Setup Admin Dropdown
        setupAdminDropdown();

    } catch (err) {
        console.error("Critical Init Error:", err);
        alert("Error crítico iniciando el panel: " + err.message);
    }
});

function setupAdminDropdown() {
    const dropdown = document.getElementById('admin-user-dropdown');
    const themeBtn = document.getElementById('admin-theme-toggle');
    const logoutBtn = document.getElementById('admin-logout-btn');
    const sidebarLogout = document.getElementById('logout-btn');

    // Dropdown Toggle
    if (dropdown) {
        dropdown.addEventListener('click', (e) => {
            if (e.target.closest('.dropdown-content')) return;
            e.stopPropagation();
            dropdown.classList.toggle('active');
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
    }

    // Theme Toggle
    if (themeBtn) {
        themeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const current = document.documentElement.getAttribute('data-theme') || 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
        });
    }

    // Logout (dropdown)
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await supabase.auth.signOut();
            window.location.href = '../login.html';
        });
    }

    // Logout (sidebar)
    if (sidebarLogout) {
        sidebarLogout.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '../login.html';
        });
    }
}

function updateUIProfile(profile) {
    if (!profile) return;
    document.getElementById('admin-name').textContent = profile.full_name || profile.username || 'Admin';
    if (profile.avatar_url) document.getElementById('admin-avatar').src = profile.avatar_url;
}

// --- NAVIGATION ---
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('active');
}

function switchTab(tabName) {
    // On mobile, close sidebar when clicking a link
    if (window.innerWidth < 960) {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('active');
    }

    // Update Sidebar active state
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    // Find the link that matches this tab
    const activeLink = [...document.querySelectorAll('.nav-item')].find(item => {
        const onclick = item.getAttribute('onclick');
        return onclick && onclick.includes(`'${tabName}'`);
    });
    if (activeLink) activeLink.classList.add('active');

    // Hide all views
    document.querySelectorAll('.content-view').forEach(el => el.classList.add('hidden'));

    // Update Page Title
    const pageTitles = {
        'dashboard': 'Dashboard',
        'operations': 'Monitor de Operaciones',
        'activity-history': 'Historial de Actividad',
        'assets': 'Gestión de Equipo',
        'users': 'Usuarios y Permisos',
        'reports': 'Reportes',
        'registros': 'Registros de Incidencias',
        'settings': 'Ajustes de Configuración',
        'rosters': 'Gestión de Roles Mensuales',
        'movilizacion': 'Planilla de Movilización (Triage)'
    };
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.textContent = pageTitles[tabName] || 'Dashboard';

    // Show Target
    const target = document.getElementById(`view-${tabName}`);
    if (target) {
        target.classList.remove('hidden');

        // Refresh Data
        if (tabName === 'dashboard') loadDashboard();
        if (tabName === 'operations') loadLiveOperations();
        if (tabName === 'activity-history') loadActivityHistory(0);
        if (tabName === 'assets') loadAssets();
        if (tabName === 'users') loadUsers();
        if (tabName === 'registros') loadRegistros();
        if (tabName === 'reports') {
            loadReports();
            const periodSelect = document.getElementById('report-period');
            if (periodSelect && !periodSelect.dataset.listener) {
                periodSelect.addEventListener('change', () => loadReports());
                periodSelect.dataset.listener = "true";
            }
        }
        if (tabName === 'settings') {
            // Load default tab (airlines) when entering settings
            if (typeof loadSettingTable === 'function') {
                loadSettingTable('airlines', 'Aerolíneas');
            }
        }
        if (tabName === 'rosters') {
            loadRosters();
        }
        if (tabName === 'movilizacion') {
            if (window.initMovilizacion) window.initMovilizacion();
        }
    }
}

// --- EXPOSE GLOBALS FOR HTML ONCLICK ---
window.switchTab = switchTab;
window.toggleSidebar = toggleSidebar;

window.openAssetModal = function () {
    // We use the generic crud modal for assets now
    window.loadSettingTable('assets', 'Equipo'); // Switch internal type
    window.openCrudModal();
}

window.editAsset = async function (id) {
    const { data: asset } = await supabase.from('assets').select('*').eq('id', id).single();
    if (asset) {
        // Prepare current state
        window.loadSettingTable('assets', 'Equipo');
        const safeItem = encodeURIComponent(JSON.stringify(asset));
        window.openCrudModal(safeItem);

        // Map code to name for generic crud compat
        document.getElementById('crud-name').value = asset.code;
        document.getElementById('crud-asset-type').value = asset.type;
    }
}

window.editUser = async function (id) {
    const { data: user } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (user) {
        // Use 'profiles' config
        window.loadSettingTable('profiles', 'Editar Usuario');
        const safeItem = encodeURIComponent(JSON.stringify(user));
        window.openCrudModal(safeItem);

        // Manual override for profile-specific name field
        document.getElementById('crud-name').value = user.full_name || user.username;
    }
}

window.deleteAsset = async function (id) {
    if (!confirm('¿Seguro que deseas eliminar este equipo? ADVERTENCIA: Se eliminará todo el historial de uso asociado a este equipo de forma permanente.')) return;

    // 1. Delete associated operations first (Manual Cascade)
    const { error: opError } = await supabase.from('operations').delete().eq('asset_id', id);
    if (opError) {
        console.error("Error clearing history:", opError);
        alert("Error al limpiar historial de operaciones: " + opError.message);
        return;
    }

    // 2. Delete the asset
    const { error } = await supabase.from('assets').delete().eq('id', id);
    if (error) alert(error.message);
    else loadAssets();
}

// --- DASHBOARD LOADER ---
// --- DASHBOARD LOADER ---
async function loadDashboard() {
    console.log("Loading Dashboard Data...");
    try {
        // Load Today's Shifts
        loadTodayShifts(); // Async but we don't await to parallelize

        // Quick Stats
        const { count: opsCount } = await supabase.from('operations').select('*', { count: 'exact', head: true }).eq('status', 'active');
        const activeOpsEl = document.getElementById('stat-active-ops');
        if (activeOpsEl) activeOpsEl.textContent = opsCount || 0;


        const { count: ticaCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('tica_status', 'vigente');
        const ticaStatEl = document.getElementById('stat-tica-active');
        if (ticaStatEl) ticaStatEl.textContent = ticaCount || 0;

        const { count: assetsCount } = await supabase.from('assets').select('*', { count: 'exact', head: true }).eq('status', 'available');
        document.getElementById('stat-available-assets').textContent = assetsCount || 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: todayCount } = await supabase.from('operations')
            .select('*', { count: 'exact', head: true })
            .gte('start_time', today.toISOString());
        document.getElementById('stat-total-today').textContent = todayCount || 0;

        const { count: faultyCount } = await supabase.from('assets')
            .select('*', { count: 'exact', head: true })
            .in('status', ['damaged', 'lost', 'maintenance']);
        document.getElementById('stat-faulty').textContent = faultyCount || 0;

        // --- RECENT OPERATIONS (Dashboard) ---
        const { data: recentOps } = await supabase
            .from('operations')
            .select(`
            *,
            assets (id, code, type),
            profiles (username, full_name)
        `)
            .eq('status', 'completed')
            .order('end_time', { ascending: false })
            .limit(10); // Fetch more to filter admin

        const filteredRecentOps = (recentOps || []).filter(op => !['Administrador', 'StbcK'].includes(op.profiles?.username)).slice(0, 5);


        // --- FAULTY ASSETS TABLE (Dashboard) ---
        const faultyTableBody = document.querySelector('#faulty-assets-dashboard-table tbody');
        if (faultyTableBody) {
            const { data: faultyAssets } = await supabase
                .from('assets')
                .select('*')
                .in('status', ['damaged', 'lost', 'maintenance'])
                .limit(3);

            faultyTableBody.innerHTML = '';
            if (faultyAssets && faultyAssets.length > 0) {
                for (const asset of faultyAssets) {
                    const tr = document.createElement('tr');
                    const statusLabel = { 'damaged': '⚠️ Dañado', 'lost': '❌ Extraviado', 'maintenance': '🛠️ Mant.' };
                    tr.innerHTML = `
                    <td><strong>${asset.code}</strong></td>
                    <td>${asset.type}</td>
                    <td><span class="badge ${asset.status === 'lost' ? 'danger' : 'warning'}">${statusLabel[asset.status] || asset.status}</span></td>
                    <td>${new Date(asset.created_at).toLocaleDateString('es-CL')}</td>
                `;
                    faultyTableBody.appendChild(tr);
                }
            } else {
                faultyTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1rem; opacity:0.5;">No hay equipos con falla reportada.</td></tr>';
            }
        }

        const tbody = document.querySelector('#recent-ops-table tbody');
        tbody.innerHTML = '';

        if (filteredRecentOps.length > 0) {
            filteredRecentOps.forEach(op => {
                const row = document.createElement('tr');
                const timeAgo = getTimeAgo(new Date(op.end_time));
                row.innerHTML = `
                <td><strong>${op.assets?.code || '???'}</strong></td>
                <td>${op.profiles?.full_name || op.profiles?.username || 'Agente'}</td>
                <td>${op.start_point}</td>
                <td>${op.end_point || op.destination}</td>
                <td><span class="badge active" style="background: rgba(16, 185, 129, 0.1); color: #10b981;">Devuelto hace: ${timeAgo}</span></td>
            `;
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay actividad reciente.</td></tr>';
        }
    } catch (err) {
        console.error("Dashboard Load Error:", err);
    }
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " años";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " meses";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " días";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " h";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " min";
    return "unos segundos";
}

// --- ACTIVITY HISTORY (COMPLETED) ---
let activityPage = 0;
const activityLimit = 20;

async function loadActivityHistory(page = 0) {
    activityPage = page;
    const start = activityPage * activityLimit;
    const end = start + activityLimit - 1;

    const { data: history, count } = await supabase
        .from('operations')
        .select(`
            *,
            assets (code),
            profiles (username, full_name, avatar_url)
        `, { count: 'exact' })
        .eq('status', 'completed')
        .order('end_time', { ascending: false })
        .range(start, end);

    const tbody = document.querySelector('#history-ops-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (history && history.length > 0) {
        history.forEach(op => {
            const row = document.createElement('tr');
            const totalTime = op.end_time ? Math.round((new Date(op.end_time) - new Date(op.start_time)) / 60000) : '-';
            row.innerHTML = `
                <td><strong>${op.assets?.code || '???'}</strong></td>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <img src="${op.profiles?.avatar_url || '../assets/imagenes/avatarcargo.png'}" style="width:24px; height:24px; border-radius:50%;">
                        <span>${op.profiles?.full_name || op.profiles?.username}</span>
                    </div>
                </td>
                <td>${op.start_point} <i class="fas fa-arrow-right" style="font-size:0.7rem; opacity:0.5; margin: 0 5px;"></i> ${op.end_point}</td>
                <td>${new Date(op.end_time).toLocaleString('es-CL', { hour12: false })}</td>
                <td><span class="badge active">${totalTime} min</span></td>
            `;
            tbody.appendChild(row);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay historial disponible.</td></tr>';
    }

    // Pagination
    updatePaginationUI(count);
}

function updatePaginationUI(total) {
    const container = document.getElementById('history-pagination');
    if (!container) return;
    container.innerHTML = '';

    const totalPages = Math.ceil(total / activityLimit);
    if (totalPages <= 1) return;

    // Show current page / total info
    const info = document.createElement('span');
    info.style.opacity = '0.6';
    info.style.fontSize = '0.8rem';
    info.style.marginRight = '1rem';
    info.textContent = `Página ${activityPage + 1} de ${totalPages}`;
    container.appendChild(info);

    for (let i = 0; i < totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = `btn btn-secondary ${i === activityPage ? 'active' : ''}`;
        btn.style.width = 'auto';
        btn.style.padding = '0.3rem 0.8rem';
        btn.textContent = i + 1;
        btn.onclick = () => loadActivityHistory(i);
        container.appendChild(btn);
    }
}



// --- LIVE OPERATIONS ---
const airlineMap = {
    'LATAM': 'LA',
    'DELTA': 'DL',
    'AIRFRANCE': 'AF',
    'AIR FRANCE': 'AF',
    'AIR CANADA': 'AC',
    'AIRCANADA': 'AC',
    'KLM': 'KL',
    'IBERIA': 'IB',
    'QANTAS': 'QF',
    'LEVEL': 'LL',
    'BRITISH AIRWAYS': 'BA',
    'ARAJET': 'DM',
    'BOA': 'OB',
    'AEROLINEAS ARG': 'AR',
    'COPA': 'CM'
};

function getIATACode(airlineName) {
    if (!airlineName) return '-';
    const upperName = airlineName.toUpperCase().trim();
    // Check direct map
    if (airlineMap[upperName]) return airlineMap[upperName];
    // Check partials if needed, or return original 2 chars
    return airlineName.substring(0, 2).toUpperCase();
}

function loadLiveOperations() {
    const tbody = document.querySelector('#live-ops-table tbody');
    if (!tbody) return; // Guard for safety
    tbody.innerHTML = '<tr><td colspan="12" style="text-align:center">Cargando...</td></tr>';

    supabase
        .from('operations')
        .select(`
            *,
            assets (code, type)
        `)
        .eq('status', 'active')
        .then(async ({ data: opsData, error }) => {
            tbody.innerHTML = '';

            if (error) {
                console.error("Error loading operations:", error);
                tbody.innerHTML = `<tr><td colspan="12" style="color:#ef4444; text-align:center">Error: ${error.message}</td></tr>`;
                return;
            }

            if (!opsData || opsData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="12" style="text-align:center">No hay operaciones activas.</td></tr>';
                return;
            }

            // Manually fetch profiles including phone
            const userIds = [...new Set(opsData.map(o => o.user_id))];
            const { data: profiles } = await supabase.from('profiles').select('id, username, full_name, avatar_url, phone, team').in('id', userIds);

            const profileMap = {};
            if (profiles) profiles.forEach(p => profileMap[p.id] = p);

            opsData.forEach(op => {
                // --- HIDE HIDDEN ADMIN FROM LIVE OPS ---
                const profile = profileMap[op.user_id] || {};
                const hiddenUsers = ['Administrador', 'StbcK', 'administrador', 'stbck'];
                if (hiddenUsers.includes(profile.username) || hiddenUsers.includes(profile.username?.toLowerCase())) return;

                // Calculate time elapsed
                const start = new Date(op.start_time);
                const now = new Date();
                const diffMins = Math.floor((now - start) / 60000);

                let timeClass = 'active'; // Greenish
                let timeColor = '#10b981';

                if (diffMins >= 40) {
                    timeClass = 'danger'; // Red
                    timeColor = '#ef4444';
                } else if (diffMins > 30) {
                    timeColor = '#f59e0b'; // Orange warning
                }

                // WhatsApp Link
                let whatsappLink = '#';
                let whatsappBadge = '';
                if (profile.phone) {
                    // Clean phone number (remove +, spaces)
                    const cleanPhone = profile.phone.replace(/\D/g, '');
                    whatsappLink = `https://wa.me/${cleanPhone}`;
                    whatsappBadge = `
                        <a href="${whatsappLink}" target="_blank" style="text-decoration:none;">
                            <button class="btn-action btn-whatsapp" title="Contactar por WhatsApp">
                                <i class="fab fa-whatsapp"></i> Chat
                            </button>
                        </a>
                    `;
                } else {
                    whatsappBadge = `<span style="opacity:0.5; font-size:0.8rem;">Sin N°</span>`;
                }

                const iata = getIATACode(op.airline);

                // Use profile team if op team is missing, or fallback
                const team = op.team || profile.team || '-';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="display:flex; align-items:center; gap:0.5rem;">
                        <img src="${profile.avatar_url || '../assets/imagenes/avatarcargo.png'}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;">
                        <span style="font-weight:600; font-size:0.9rem;">${profile.full_name || profile.username || 'Agente'}</span>
                    </td>
                    <td>${team}</td>
                    <td><strong>${op.assets?.code || '-'}</strong></td>
                    <td>${op.assets?.type || '-'}</td>
                    <td>${op.start_location_type || '-'}</td>
                    <td>${op.start_point || '-'}</td>
                    <td>${op.destination || '-'}</td>
                    <td>${op.gate || op.bridge || '-'}</td>
                    <td>${iata}</td>
                    <td>${op.flight_number || '-'}</td>
                    <td>
                        <span class="badge" style="background:${timeColor}33; color:${timeColor}; border:1px solid ${timeColor}; font-weight:800;">
                            ${diffMins} min
                        </span>
                    </td>
                    <td>${whatsappBadge}</td>
                    <td>
                        <div class="action-group">
                            <button onclick="manualReturn('${op.id}', '${op.asset_id}')" class="btn-action btn-return" title="Forzar Devolución">
                                <i class="fas fa-undo"></i> Devolución
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        });
}

// --- MANUAL RETURN (ADMIN) ---
window.manualReturn = async function (opId, assetId) {
    if (!confirm('¿Estás seguro de forzar la devolución de este activo? El agente actual perderá la sesión.')) return;

    try {
        // 1. Close Operation
        const { error: opError } = await supabase
            .from('operations')
            .update({
                status: 'completed',
                end_time: new Date().toISOString(),
                end_point: 'Devolución Manual (Admin)',
                return_method: 'manual'
            })
            .eq('id', opId);

        if (opError) throw opError;

        // 2. Free Asset
        const { error: assetError } = await supabase
            .from('assets')
            .update({ status: 'available' })
            .eq('id', assetId);

        if (assetError) throw assetError;

        alert('Devolución completada exitosamente.');
        loadLiveOperations(); // Refresh table

    } catch (e) {
        console.error(e);
        alert('Error al realizar la devolución: ' + e.message);
    }
}

// --- ASSETS ---
async function loadAssets() {
    const tbody = document.querySelector('#assets-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando...</td></tr>';

    try {
        const { data: assets, error: assetsError } = await supabase.from('assets').select('*').order('code');
        if (assetsError) throw assetsError;

        const { data: activeOps, error: opsError } = await supabase
            .from('operations')
            .select('*, profiles(full_name)')
            .eq('status', 'active');
        if (opsError) throw opsError;

        const opsMap = {};
        if (activeOps) activeOps.forEach(op => opsMap[op.asset_id] = op);

        // --- CALCULATE STATS ---
        const stats = {
            total: assets.length,
            available: 0,
            in_use: 0,
            maintenance: 0,
            damaged: 0,
            lost: 0
        };
        const categoryCount = {};

        assets.forEach(a => {
            // Status counts
            if (a.status === 'available') stats.available++;
            else if (a.status === 'in_use') stats.in_use++;
            else if (a.status === 'maintenance') stats.maintenance++;
            else if (a.status === 'damaged') stats.damaged++;
            else if (a.status === 'lost') stats.lost++;

            // Category counts
            const cat = (a.type || 'Otro').toLowerCase();
            categoryCount[cat] = (categoryCount[cat] || 0) + 1;
        });

        // Update Stat Cards
        const setTextIfExists = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };
        setTextIfExists('asset-stat-total', stats.total);
        setTextIfExists('asset-stat-available', stats.available);
        setTextIfExists('asset-stat-inuse', stats.in_use);
        setTextIfExists('asset-stat-maintenance', stats.maintenance);
        setTextIfExists('asset-stat-damaged', stats.damaged);
        setTextIfExists('asset-stat-lost', stats.lost);

        // Update Category Pills
        const catContainer = document.getElementById('assets-category-stats');
        if (catContainer) {
            catContainer.innerHTML = '';
            Object.entries(categoryCount).forEach(([cat, count]) => {
                const pill = document.createElement('span');
                pill.style.cssText = 'background: var(--primary-color); color: white; padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; display: inline-flex; gap: 6px; align-items: center;';
                pill.innerHTML = `<span style="text-transform: capitalize;">${cat}</span> <strong>${count}</strong>`;
                catContainer.appendChild(pill);
            });
        }

        tbody.innerHTML = '';
        if (!assets || assets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay activos registrados.</td></tr>';
            return;
        }

        assets.forEach(asset => {
            const tr = document.createElement('tr');
            const op = opsMap[asset.id];

            // Icono según tipo
            let icon = 'fa-wheelchair';
            const typeLower = (asset.type || '').toLowerCase();
            if (typeLower.includes('carrito')) icon = 'fa-car';
            if (typeLower.includes('oruga')) icon = 'fa-truck-monster';

            let locationText = asset.location || 'Base';
            if (asset.status === 'in_use' && op) {
                const startTime = new Date(op.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                locationText = `<div style="font-size: 0.8rem; line-height: 1.2;">
                    <span style="opacity: 0.6;">Dsd:</span> ${op.start_point}<br>
                    <span style="opacity: 0.6;">Hacia:</span> ${op.destination}<br>
                    <span style="color: var(--primary-color); font-weight: bold;">🕒 ${startTime}</span>
                </div>`;
            } else if (asset.status === 'damaged') {
                locationText = '⚠️ Fuera de servicio';
            } else if (asset.status === 'lost') {
                locationText = '❌ Desconocida (Perdido)';
            }

            let statusBadge = '';
            if (asset.status === 'available') statusBadge = '<span class="badge active">Disponible</span>';
            else if (asset.status === 'in_use') {
                const userName = op?.profiles?.full_name || 'Agente';
                statusBadge = `<div style="display:flex; flex-direction:column; gap:4px;">
                    <span class="badge warning">En Uso</span>
                    <span style="font-size:0.75rem; font-weight:600; opacity:0.8;">👤 ${userName}</span>
                </div>`;
            }
            else if (asset.status === 'damaged') statusBadge = '<span class="badge danger">Dañado</span>';
            else if (asset.status === 'lost') statusBadge = '<span class="badge danger">Extraviado</span>';
            else if (asset.status === 'maintenance') statusBadge = '<span class="badge warning">Mantenimiento</span>';
            else statusBadge = `<span class="badge">${asset.status}</span>`;

            tr.innerHTML = `
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <i class="fas ${icon}" style="font-size:1.2rem; color:var(--primary-color);"></i>
                        <strong>${asset.code}</strong>
                    </div>
                </td>
                <td style="text-transform: capitalize;">${asset.type}</td>
                <td>${statusBadge}</td>
                <td>${locationText}</td>

                <td>
                    <div class="action-group">
                        <button class="btn-action btn-edit" title="Editar" onclick="editAsset('${asset.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action btn-delete" title="Eliminar" onclick="deleteAsset('${asset.id}')">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
        // --- GALLERY OF RETURNS ---
        const galleryContainer = document.getElementById('asset-gallery-grid');
        if (galleryContainer) {
            // Fetch last 20 operations with photos
            const { data: galleryOps, error: galleryError } = await supabase
                .from('operations')
                .select('*, assets(code, type), profiles(full_name)')
                .eq('status', 'completed')
                .neq('return_photo_url', null) // Correct column for return photos
                .order('end_time', { ascending: false })
                .limit(20);

            if (!galleryError && galleryOps && galleryOps.length > 0) {
                galleryContainer.innerHTML = '';
                galleryOps.forEach(op => {
                    const dateObj = new Date(op.end_time);
                    const date = dateObj.toLocaleDateString('es-CL');
                    const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const startTime = new Date(op.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    const card = document.createElement('div');
                    card.className = 'glass';
                    card.style.cssText = 'position: relative; overflow: hidden; border-radius: 16px; aspect-ratio: 1; group; cursor: pointer; border: 1px solid var(--card-border);';

                    // Image Background
                    card.innerHTML = `
                    <div style="position: absolute; inset: 0; background-image: url('${op.return_photo_url}'); background-size: cover; background-position: center; transition: transform 0.3s ease;">
                    </div>
                    <div style="position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 50%, transparent 100%); display: flex; flex-direction: column; justify-content: flex-end; padding: 1rem;">
                        <span class="badge active" style="align-self: flex-start; margin-bottom: auto; backdrop-filter: blur(4px);">${op.assets?.code}</span>
                        
                        <div style="color: white; font-size: 0.9rem; font-weight: 600;">${op.profiles?.full_name || 'Agente'}</div>
                        <div style="color: rgba(255,255,255,0.7); font-size: 0.75rem;"><i class="fas fa-map-marker-alt"></i> ${op.end_point || 'Base'}</div>
                        <div style="color: rgba(255,255,255,0.7); font-size: 0.75rem; margin-top: 4px;">
                            <i class="fas fa-clock"></i> ${startTime} - ${time} <br>
                            <i class="fas fa-calendar"></i> ${date}
                        </div>
                    </div>
                `;

                    // Hover effect logic via JS or CSS class
                    card.onmouseenter = () => { card.children[0].style.transform = 'scale(1.1)'; };
                    card.onmouseleave = () => { card.children[0].style.transform = 'scale(1)'; };

                    // Open full image on click
                    card.onclick = () => window.open(op.return_photo_url, '_blank');

                    galleryContainer.appendChild(card);
                });
            } else {
                galleryContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; opacity: 0.5;">No hay fotos de devoluciones recientes.</div>';
            }
        }

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center error">Error: ${err.message}</td></tr>`;
    }
}

window.copyToClipboard = function (text) {
    if (!text || text === 'null' || text === 'undefined') return;
    navigator.clipboard.writeText(text).then(() => {
        alert("Link copiado al portapapeles");
    }).catch(err => {
        console.error('Error al copiar: ', err);
    });
}

// --- USERS ---
// --- USERS ---


async function loadUsers() {
    const tbody = document.querySelector('#users-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 2rem; opacity: 0.5;">Cargando...</td></tr>';

    try {
        const { data, error } = await supabase.from('profiles').select('*').order('full_name');
        if (error) throw error;

        // Filter hidden admins
        allUsersCache = (data || []).filter(u =>
            !['administrador', 'stbck'].includes(u.username?.toLowerCase()) &&
            !['administrador sistema', 'administrador stbck'].includes(u.full_name?.toLowerCase())
        );

        renderUsers(allUsersCache);

        // Setup search listener
        const searchInput = document.getElementById('user-search-input');
        if (searchInput && !searchInput.dataset.listener) {
            searchInput.addEventListener('input', (e) => filterUsers(e.target.value));
            searchInput.dataset.listener = "true";
        }

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center error">Error: ${err.message}</td></tr>`;
    }
}

function filterUsers(query) {
    if (!query) {
        renderUsers(allUsersCache);
        return;
    }
    const lowerQ = query.toLowerCase();
    const filtered = allUsersCache.filter(u =>
        (u.full_name || '').toLowerCase().includes(lowerQ) ||
        (u.username || '').toLowerCase().includes(lowerQ) ||
        (u.email || '').toLowerCase().includes(lowerQ) ||
        (u.team || '').toLowerCase().includes(lowerQ)
    );
    renderUsers(filtered);
}

function renderUsers(usersList) {
    const tbody = document.querySelector('#users-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (usersList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:2rem; opacity:0.5;">No se encontraron usuarios.</td></tr>';
        return;
    }

    usersList.forEach(user => {
        const tr = document.createElement('tr');

        let ticaBadge = '<span class="badge" style="background:#ef4444; color:white; font-size:0.65rem; padding:2px 6px;">Sin TICA</span>';
        if (user.tica_status === 'vigente') ticaBadge = '<span class="badge" style="background:#10b981; color:white; font-size:0.65rem; padding:2px 6px;">TICA Vigente</span>';
        if (user.tica_status === 'por_vencer') ticaBadge = '<span class="badge" style="background:#f59e0b; color:white; font-size:0.65rem; padding:2px 6px;">TICA x Vencer</span>';

        tr.innerHTML = `
            <td>
                <img src="${user.avatar_url || '../assets/imagenes/avatarcargo.png'}" style="width:35px; height:35px; border-radius:50%; object-fit:cover; border:1px solid #ddd;">
            </td>
            <td>
                <div style="font-weight:600;">${user.full_name || user.username || 'Sin Nombre'}</div>
                <div style="font-size:0.75rem; opacity:0.6;">@${user.username}</div>
                <div style="margin-top:3px;">${ticaBadge}</div>
            </td>
            <td>
                <select onchange="updateUserRole('${user.id}', this.value)" class="input-style" style="padding:0.2rem; font-size:0.8rem; width:auto;">
                    <option value="Agente" ${user.role === 'Agente' ? 'selected' : ''}>Agente</option>
                    <option value="Supervisor" ${user.role === 'Supervisor' ? 'selected' : ''}>Supervisor</option>
                    <option value="CDO" ${user.role === 'CDO' ? 'selected' : ''}>CDO</option>
                    <option value="admin" ${user.role?.toLowerCase() === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            </td>
            <td>
                <select onchange="updateUserTeam('${user.id}', this.value)" class="input-style" style="padding:0.2rem; font-size:0.8rem; width:auto;">
                    <option value="Team OLA" ${user.team === 'Team OLA' ? 'selected' : ''}>Team OLA</option>
                    <option value="Team Latam" ${user.team === 'Team Latam' ? 'selected' : ''}>Team Latam</option>
                </select>
            </td>
            <td>
                <div style="display:flex; flex-direction:column; gap:4px; font-size:0.7rem;">
                    ${user.cert_golf ? `
                    <span class="cert-badge cert-golf active" 
                          onclick="toggleCert('${user.id}', 'cert_golf', false)">
                        🏌️ Golf
                    </span>` : ''}
                    ${user.cert_duplex ? `
                    <span class="cert-badge cert-duplex active" 
                          onclick="toggleCert('${user.id}', 'cert_duplex', false)">
                        🚌 Duplex
                    </span>` : ''}
                    ${user.cert_oruga ? `
                    <span class="cert-badge cert-oruga active" 
                          onclick="toggleCert('${user.id}', 'cert_oruga', false)">
                        🚜 Oruga
                    </span>` : ''}
                    ${!user.cert_golf && !user.cert_duplex && !user.cert_oruga ? '<span style="opacity:0.4;">Sin cursos</span>' : ''}
                </div>
            </td>
            <td style="font-size:0.75rem;">${user.email || '-'}</td>
            <td style="font-size:0.75rem;">${user.phone || '-'}</td>
            <td>${user.commune || '-'}</td>
            <td style="font-size:0.75rem; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${user.address || ''}">
                ${user.address || '-'}
            </td>
            <td>
                <div class="action-group">
                    <button class="btn-action btn-edit" title="Editar Usuario" onclick="editUser('${user.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action btn-delete" title="Eliminar Usuario" onclick="deleteUser('${user.id}')">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.exportUsers = function (format) {
    if (!allUsersCache || allUsersCache.length === 0) {
        alert("No hay usuarios para exportar.");
        return;
    }

    // Transform data for export
    const exportData = allUsersCache.map(u => ({
        "Nombre Completo": u.full_name || u.username,
        "Usuario": u.username,
        "Rol": u.role,
        "Team": u.team,
        "Email": u.email,
        "Teléfono": u.phone,
        "Comuna": u.commune,
        "Dirección": u.address,
        "Cursos": [
            u.cert_golf ? 'Golf' : '',
            u.cert_duplex ? 'Duplex' : '',
            u.cert_oruga ? 'Oruga' : ''
        ].filter(Boolean).join(', ')
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, "Usuarios");

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `PMRQR_Usuarios_${dateStr}`;

    if (format === 'csv') {
        XLSX.writeFile(wb, `${filename}.csv`, { bookType: 'csv' });
    } else if (format === 'xls') {
        XLSX.writeFile(wb, `${filename}.xls`, { bookType: 'xlsb' });
    } else if (format === 'odt') {
        XLSX.writeFile(wb, `${filename}.odt`, { bookType: 'ods' });
    } else {
        XLSX.writeFile(wb, `${filename}.xlsx`, { bookType: 'xlsx' });
    }
}

// --- IMPORT USERS FROM EXCEL ---
// This function reads an Excel file and updates ONLY missing fields for existing users
// It will NOT overwrite existing data
window.importUsersExcel = async function (fileInput) {
    const file = fileInput.files[0];
    if (!file) return;

    // Reset file input so same file can be selected again
    fileInput.value = '';

    try {
        const reader = new FileReader();

        reader.onload = async (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            // Get the first sheet
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            if (jsonData.length === 0) {
                alert('El archivo Excel está vacío o no tiene datos válidos.');
                return;
            }

            // Create progress modal
            let progressModal = document.getElementById('import-progress-modal');
            if (!progressModal) {
                progressModal = document.createElement('div');
                progressModal.id = 'import-progress-modal';
                progressModal.innerHTML = `
                    <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 99999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px);">
                        <div style="background: linear-gradient(145deg, #1a1a2e, #16213e); padding: 2rem; border-radius: 16px; width: 90%; max-width: 500px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); border: 1px solid rgba(139, 92, 246, 0.3);">
                            <h3 style="color: #a855f7; margin: 0 0 1rem 0; text-align: center;">📥 Importando Datos</h3>
                            
                            <div style="margin-bottom: 1rem;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                    <span id="import-progress-text" style="color: white; font-size: 0.9rem;">Procesando...</span>
                                    <span id="import-progress-percent" style="color: #10b981; font-weight: bold;">0%</span>
                                </div>
                                <div style="background: rgba(255,255,255,0.1); border-radius: 10px; height: 20px; overflow: hidden;">
                                    <div id="import-progress-bar" style="background: linear-gradient(90deg, #8b5cf6, #10b981); height: 100%; width: 0%; transition: width 0.3s ease; border-radius: 10px;"></div>
                                </div>
                            </div>
                            
                            <div style="text-align: center; color: rgba(255,255,255,0.6); font-size: 0.8rem;">
                                <span id="import-progress-detail">Fila 0 de ${jsonData.length}</span>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(progressModal);
            } else {
                progressModal.style.display = 'block';
            }

            const progressBar = document.getElementById('import-progress-bar');
            const progressPercent = document.getElementById('import-progress-percent');
            const progressText = document.getElementById('import-progress-text');
            const progressDetail = document.getElementById('import-progress-detail');
            const totalRows = jsonData.length;

            // Update progress helper
            const updateProgress = (current, phase, detail = '') => {
                const percent = Math.round((current / totalRows) * 100);
                progressBar.style.width = percent + '%';
                progressPercent.textContent = percent + '%';
                progressText.textContent = phase;
                progressDetail.textContent = detail || `Fila ${current} de ${totalRows}`;
            };

            // Show loading in table too
            const tbody = document.querySelector('#users-table tbody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 2rem;">⏳ Importando datos...</td></tr>';
            }

            // Normalize RUT helper
            const normalizeRut = (r) => {
                if (!r) return '';
                return String(r).replace(/\./g, '').replace(/-/g, '').toUpperCase().trim();
            };

            // Normalize name
            const normalizeName = (n) => {
                if (!n) return '';
                return String(n).toUpperCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            };

            // Fetch current users from database
            const { data: currentUsers, error: fetchError } = await supabase
                .from('profiles')
                .select('*');

            if (fetchError) {
                alert('Error obteniendo usuarios: ' + fetchError.message);
                loadUsers();
                return;
            }

            // Create lookup maps
            const usersByRut = {};
            const usersByName = {};
            currentUsers.forEach(u => {
                const rut = normalizeRut(u.rut);
                const name = normalizeName(u.full_name);
                if (rut) usersByRut[rut] = u;
                if (name) usersByName[name] = u;
            });

            // Possible column name mappings (Spanish and English variations)
            // Updated to match new Excel format:
            // A: NOMBRE DE FUNCIONARIO, B: MAIL, C: ID, D: CEL, E: DIRECCION, F: NUMERO, G: COMUNA, H: RUT
            const columnMappings = {
                rut: ['rut', 'RUT', 'Rut', 'rut_id', 'RUT_ID', 'id_rut', 'H'],
                id_rut: ['id', 'ID', 'Id', 'C'],  // RUT without dots/dash/verification digit
                full_name: ['nombre', 'Nombre', 'NOMBRE', 'full_name', 'nombre_completo', 'NOMBRE COMPLETO', 'Nombre Completo',
                    'NOMBRE DE FUNCIONARIO', 'Nombre de Funcionario', 'nombre de funcionario', 'A'],
                phone: ['telefono', 'Telefono', 'TELEFONO', 'phone', 'celular', 'Celular', 'CELULAR', 'fono', 'Fono',
                    'cel', 'CEL', 'Cel', 'D'],
                address: ['direccion', 'Direccion', 'DIRECCION', 'address', 'domicilio', 'Domicilio', 'DOMICILIO', 'E'],
                addr_number: ['numero', 'Numero', 'NUMERO', 'number', 'num', 'NUM', 'nro', 'NRO', 'F'],
                commune: ['comuna', 'Comuna', 'COMUNA', 'commune', 'ciudad', 'Ciudad', 'CIUDAD', 'G'],
                email: ['email', 'Email', 'EMAIL', 'correo', 'Correo', 'CORREO', 'mail', 'Mail', 'MAIL', 'B'],
                team: ['team', 'Team', 'TEAM', 'equipo', 'Equipo', 'EQUIPO'],
                role: ['cargo', 'Cargo', 'CARGO', 'role', 'rol', 'Rol', 'ROL']
            };

            // Find column in row by checking possible names
            const getField = (row, fieldNames) => {
                for (const name of fieldNames) {
                    if (row[name] !== undefined && row[name] !== '') {
                        return String(row[name]).trim();
                    }
                }
                return '';
            };

            let updated = 0;
            let skipped = 0;
            let notFound = 0;
            let rowIndex = 0;

            // Phase 1: Process existing users
            updateProgress(0, '📝 Actualizando usuarios existentes...', `Preparando...`);

            // Process each row from Excel
            for (const row of jsonData) {
                rowIndex++;

                // Update progress every 5 rows to avoid UI lag
                if (rowIndex % 5 === 0 || rowIndex === totalRows) {
                    updateProgress(rowIndex, '📝 Actualizando usuarios existentes...', `Fila ${rowIndex} de ${totalRows}`);
                    await new Promise(r => setTimeout(r, 0)); // Allow UI to update
                }

                const excelRut = normalizeRut(getField(row, columnMappings.rut));
                const excelName = normalizeName(getField(row, columnMappings.full_name));

                // Find matching user (by RUT first, then by name)
                let dbUser = null;
                if (excelRut && usersByRut[excelRut]) {
                    dbUser = usersByRut[excelRut];
                } else if (excelName && usersByName[excelName]) {
                    dbUser = usersByName[excelName];
                }

                if (!dbUser) {
                    notFound++;
                    console.log(`[IMPORT] No encontrado: ${excelName || excelRut}`);
                    continue;
                }

                // Build update object - ONLY fields that are NULL or empty in DB
                const updates = {};
                let hasUpdates = false;

                // Check each field - only update if DB is empty AND Excel has value
                const fieldsToCheck = [
                    { dbField: 'phone', excelMappings: columnMappings.phone },
                    { dbField: 'address', excelMappings: columnMappings.address },
                    { dbField: 'commune', excelMappings: columnMappings.commune },
                    { dbField: 'rut', excelMappings: columnMappings.rut },
                    { dbField: 'team', excelMappings: columnMappings.team }
                ];

                for (const { dbField, excelMappings } of fieldsToCheck) {
                    const excelValue = getField(row, excelMappings);
                    const dbValue = dbUser[dbField];

                    // Only update if DB is empty/null and Excel has a value
                    if ((!dbValue || dbValue === '' || dbValue === '-') && excelValue) {
                        updates[dbField] = excelValue;
                        hasUpdates = true;
                    }
                }

                if (hasUpdates) {
                    const { error: updateError } = await supabase
                        .from('profiles')
                        .update(updates)
                        .eq('id', dbUser.id);

                    if (updateError) {
                        console.error(`[IMPORT] Error actualizando ${dbUser.full_name}:`, updateError);
                    } else {
                        updated++;
                        console.log(`[IMPORT] Actualizado: ${dbUser.full_name}`, updates);
                    }
                } else {
                    skipped++;
                }
            }

            // --- SAVE ALL ROWS TO AGENT_PREDATA TABLE ---
            // This creates a "pre-registration database" for auto-complete during registration
            let preDataSaved = 0;
            let preDataErrors = 0;
            rowIndex = 0; // Reset for phase 2

            // Phase 2: Save pre-registration data
            updateProgress(0, '💾 Guardando pre-datos...', `Preparando...`);

            for (const row of jsonData) {
                rowIndex++;

                // Update progress every 5 rows
                if (rowIndex % 5 === 0 || rowIndex === totalRows) {
                    updateProgress(rowIndex, '💾 Guardando pre-datos...', `Fila ${rowIndex} de ${totalRows}`);
                    await new Promise(r => setTimeout(r, 0)); // Allow UI to update
                }
                // Get RUT - try column H first, then fall back to ID column (C) adding verification digit
                let rut = normalizeRut(getField(row, columnMappings.rut));
                const idRut = getField(row, columnMappings.id_rut); // Column C - RUT without verification digit

                // If no RUT but we have ID, use ID as the base (won't have verification digit)
                if (!rut && idRut) {
                    rut = String(idRut).replace(/\D/g, '').toUpperCase();
                }

                const fullName = getField(row, columnMappings.full_name);
                const phone = getField(row, columnMappings.phone);
                const address = getField(row, columnMappings.address);
                const addrNumber = getField(row, columnMappings.addr_number);  // Column F
                const commune = getField(row, columnMappings.commune);
                const email = getField(row, columnMappings.email);
                const team = getField(row, columnMappings.team);

                // Skip if no RUT (can't upsert without unique key)
                if (!rut) continue;

                // Prepare record
                const preDataRecord = {
                    rut: rut,
                    full_name: fullName || null,
                    phone: phone || null,
                    address: address || null,
                    addr_number: addrNumber || null,  // House number separate
                    commune: commune || null,
                    email: email || null,
                    team: team || null
                };

                // Upsert to agent_predata (insert or update based on RUT)
                const { error: preDataError } = await supabase
                    .from('agent_predata')
                    .upsert(preDataRecord, { onConflict: 'rut' });

                if (preDataError) {
                    console.error(`[PREDATA] Error saving ${fullName}:`, preDataError);
                    preDataErrors++;
                } else {
                    preDataSaved++;
                }
            }

            console.log(`[IMPORT] Pre-data saved: ${preDataSaved}, errors: ${preDataErrors}`);

            // Update progress to 100% complete
            updateProgress(totalRows, '✅ Importación completa!', `${totalRows} filas procesadas`);

            // Close progress modal after a brief delay
            setTimeout(() => {
                const modal = document.getElementById('import-progress-modal');
                if (modal) modal.remove();
            }, 500);

            // Show results
            alert(`✅ Importación completada!\n\n` +
                `📊 Procesados: ${jsonData.length} filas\n` +
                `✏️ Actualizados: ${updated} usuarios existentes\n` +
                `⏭️ Sin cambios: ${skipped} usuarios (ya tenían datos)\n` +
                `❓ No encontrados: ${notFound} (no coinciden RUT/Nombre)\n\n` +
                `📁 Pre-datos guardados: ${preDataSaved} (para auto-registro)`);

            // Reload users table
            loadUsers();
        };

        reader.onerror = () => {
            alert('Error leyendo el archivo.');
        };

        reader.readAsArrayBuffer(file);

    } catch (err) {
        console.error('Import error:', err);
        alert('Error en la importación: ' + err.message);
        loadUsers();
    }
}

window.toggleCert = async function (uid, field, status) {
    const { error } = await supabase.from('profiles').update({ [field]: status }).eq('id', uid);
    if (error) alert("Error actualizando permiso: " + error.message);
    else loadUsers(); // Refresh UI to update badge state
}

window.updateUserRole = async function (uid, newRole) {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', uid);
    if (error) alert(error.message);
}

window.updateUserTeam = async function (uid, newTeam) {
    const { error } = await supabase.from('profiles').update({ team: newTeam }).eq('id', uid);
    if (error) alert(error.message);
}

window.deleteUser = async function (id) {
    // 1. Check if it's the hidden admin (requires fetching first or checking the list)
    try {
        const { data: targetUser } = await supabase.from('profiles').select('username').eq('id', id).single();

        if (targetUser && ['Administrador', 'StbcK'].includes(targetUser.username)) {
            const masterPass = prompt("Este es un usuario de SISTEMA PROTEGIDO. Ingrese la CONTRASEÑA MAESTRA para proceder:");
            if (masterPass !== 'Leon2023') {
                alert("CONTRASENA MAESTRA INCORRECTA. Acción cancelada.");
                return;
            }
        }
    } catch (e) { console.error(e); }

    if (!confirm('¿Seguro que deseas eliminar este usuario?')) return;
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) alert(error.message);
    else loadUsers();
}

// --- SETTINGS ---
// Settings CRUD functionality is now handled by crud_logic.js
// This avoids code duplication and conflicts


// Stub - actual implementation in crud_logic.js
window.loadAllSettings = function () {
    // Deprecated - now using loadSettingTable from crud_logic.js
    if (typeof loadSettingTable === 'function') {
        loadSettingTable('airlines', 'Aerolíneas');
    }
};

// Old settings grid code removed - now using crud_logic.js

// All CRUD functionality for Settings is now handled in crud_logic.js
// This file only handles navigation, dashboard, operations, assets, and users

// --- REPORTS ENGINE ---
async function loadReports() {
    const period = document.getElementById('report-period')?.value || 'today';
    const tbody = document.querySelector('#table-reports-detail tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2rem;">Calculando métricas...</td></tr>';

    // 1. Calculate Date Range
    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    if (period === 'weekly') startDate.setDate(startDate.getDate() - 7);
    if (period === 'monthly') startDate.setDate(startDate.getDate() - 30);
    if (period === 'all') startDate = new Date(0);

    // 2. Fetch Data (Completed Operations)
    let query = supabase.from('operations')
        .select(`*, assets(code, type), profiles(full_name, avatar_url)`)
        .gte('start_time', startDate.toISOString())
        .order('end_time', { ascending: false });

    const { data: ops, error } = await query;
    if (error) {
        console.error("Reports Fetch Error:", error);
        return;
    }

    // 3. Process Stats & Filter
    const filteredOps = (ops || []).filter(o => !['Administrador', 'StbcK'].includes(o.profiles?.username));
    const completed = filteredOps.filter(o => o.status === 'completed');
    const active = filteredOps.filter(o => o.status === 'active');

    let totalMins = 0;
    let manualReturns = 0;
    let differentLocation = 0;
    const agentTimes = {}; // { agentId: { total: X, count: Y, name: Z } }

    completed.forEach(op => {
        const start = new Date(op.start_time);
        const end = new Date(op.end_time);
        const duration = Math.floor((end - start) / 60000);
        totalMins += duration;

        if (op.return_method === 'manual') manualReturns++;
        if (op.end_point !== op.destination) differentLocation++;

        const agentId = op.user_id;
        if (!agentTimes[agentId]) agentTimes[agentId] = { total: 0, count: 0, name: op.profiles?.full_name || 'Agente' };
        agentTimes[agentId].total += duration;
        agentTimes[agentId].count += 1;
    });

    const avgDuration = completed.length > 0 ? Math.round(totalMins / completed.length) : 0;

    // Update Counters
    document.getElementById('rep-stat-total').textContent = filteredOps.length;
    document.getElementById('rep-stat-avg').textContent = `${avgDuration} min`;
    document.getElementById('rep-stat-manual').textContent = manualReturns;
    document.getElementById('rep-stat-diff').textContent = differentLocation;

    // 4. Render Detail Table
    if (tbody) {
        tbody.innerHTML = '';
        if (filteredOps.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2rem;">No hay datos para este periodo.</td></tr>';
        } else {
            filteredOps.forEach(op => {
                const duration = op.end_time ? Math.floor((new Date(op.end_time) - new Date(op.start_time)) / 60000) : '-';
                const alert = (op.end_point && op.destination && op.end_point !== op.destination) ? '⚠️ Desvío' : (op.status === 'active' ? '🔄 En curso' : '✅ OK');
                const iata = typeof getIATACode === 'function' ? getIATACode(op.airline) : (op.airline || '-');

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(op.start_time).toLocaleDateString('es-CL')}</td>
                    <td>${op.profiles?.full_name || 'Agente'}</td>
                    <td>${op.team || '-'}</td>
                    <td><strong>${op.assets?.code || '-'}</strong></td>
                    <td>${op.assets?.type || '-'}</td>
                    <td>${op.start_location_type || '-'}</td>
                    <td>${op.start_point || '-'}</td>
                    <td>${op.destination || '-'}</td>
                    <td>${op.gate || op.bridge || '-'}</td>
                    <td>${iata}</td>
                    <td>${op.flight_number || '-'}</td>
                    <td>${duration}</td>
                    <td><span class="badge ${op.return_method === 'manual' ? 'warning' : 'active'}">${op.return_method || (op.status === 'active' ? '...' : 'qr')}</span></td>

                `;
                tbody.appendChild(tr);
            });
        }
    }

    // 5. Render Slowest Agents
    const slowestBody = document.querySelector('#table-slowest-agents tbody');
    if (slowestBody) {
        slowestBody.innerHTML = '';
        const list = Object.values(agentTimes)
            .map(a => ({ name: a.name, avg: Math.round(a.total / a.count) }))
            .sort((a, b) => b.avg - a.avg)
            .slice(0, 5);

        list.forEach(a => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${a.name}</td><td><strong>${a.avg} min</strong></td>`;
            slowestBody.appendChild(tr);
        });
    }

    // 6. Non-returned Assets
    const unreturnedBody = document.querySelector('#table-unreturned tbody');
    if (unreturnedBody) {
        unreturnedBody.innerHTML = '';
        active.forEach(op => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${op.assets?.code || '-'}</td>
                <td>${op.profiles?.full_name || 'Agente'}</td>
                <td>${new Date(op.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
            `;
            unreturnedBody.appendChild(tr);
        });
        if (active.length === 0) unreturnedBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Todos devueltos.</td></tr>';
    }

    // 7. Faulty / Lost Assets Detail
    const faultyBody = document.querySelector('#table-faulty-assets tbody');
    if (faultyBody) {
        faultyBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Buscando reportes de fallas...</td></tr>';

        // Fetch Assets with non-standard status
        const { data: faultyAssets } = await supabase
            .from('assets')
            .select('*')
            .in('status', ['damaged', 'lost', 'maintenance'])
            .order('code');

        if (faultyAssets && faultyAssets.length > 0) {
            faultyBody.innerHTML = '';
            for (const asset of faultyAssets) {
                // Find last operation for this asset to get the user
                const { data: lastOp } = await supabase
                    .from('operations')
                    .select('*, profiles(full_name)')
                    .eq('asset_id', asset.id)
                    .order('start_time', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                const tr = document.createElement('tr');
                const statusLabel = {
                    'damaged': '⚠️ Dañado',
                    'lost': '❌ Extraviado',
                    'maintenance': '🛠️ Mantenimiento'
                };

                tr.innerHTML = `
                    <td><strong>${asset.code}</strong></td>
                    <td>${asset.type}</td>
                    <td><span class="badge ${asset.status === 'lost' ? 'danger' : 'warning'}">${statusLabel[asset.status] || asset.status}</span></td>
                    <td>${lastOp ? `${lastOp.profiles?.full_name} (${new Date(lastOp.start_time).toLocaleDateString('es-CL')})` : 'Sin historial'}</td>
                `;
                faultyBody.appendChild(tr);
            }
        } else {
            faultyBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay equipos con fallas reportadas.</td></tr>';
        }
    }
};

window.exportReports = function () {
    const format = document.getElementById('export-format')?.value || 'xlsx';
    const table = document.getElementById('table-reports-detail');

    // Use SheetJS to convert table to workbook
    const wb = XLSX.utils.table_to_book(table, { sheet: "Operaciones" });

    // Filename
    const filename = `Reporte_PMRQR_${new Date().toISOString().split('T')[0]}.${format}`;

    if (format === 'csv') {
        XLSX.writeFile(wb, filename, { bookType: 'csv' });
    } else if (format === 'xls') {
        XLSX.writeFile(wb, filename, { bookType: 'xlsb' });
    } else if (format === 'ods') {
        XLSX.writeFile(wb, filename, { bookType: 'ods' });
    } else {
        XLSX.writeFile(wb, filename, { bookType: 'xlsx' });
    }
};

async function loadRegistros() {
    const tbody = document.getElementById('registros-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 3rem; opacity: 0.5;">Cargando registros...</td></tr>';

    try {
        const { data, error } = await supabase
            .from('reports')
            .select(`
                *,
                profiles:user_id (full_name, username)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Filter out reports by Hidden Admin
        const filteredReports = (data || []).filter(r => r.profiles?.username !== 'Administrador');

        if (filteredReports.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 3rem; opacity: 0.5;">No hay registros de incidencias aún.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        filteredReports.forEach(report => {
            const date = new Date(report.created_at).toLocaleString('es-CL');
            const tr = document.createElement('tr');

            const categoryColors = {
                'Extraviado': '#ef4444',
                'Encontrado': '#10b981',
                'Roto': '#f59e0b',
                'Dañado': '#f97316',
                'Otro': '#6366f1'
            };

            tr.innerHTML = `
                <td style="font-size: 0.75rem; white-space: nowrap;">${date}</td>
                <td><strong>${report.profiles?.full_name || 'Anónimo'}</strong></td>
                <td><span class="badge" style="background: ${categoryColors[report.report_category] || '#ccc'}; color: white;">${report.report_category}</span></td>
                <td><strong>${report.asset_code || '-'}</strong><br><small style="opacity:0.7;">${report.asset_type}</small></td>
                <td>${report.terminal}</td>
                <td>${report.location_context}${report.gate ? ` - ${report.gate}` : ''}</td>
                <td style="max-width: 200px; font-size: 0.8rem;">${report.description || '-'}</td>
                <td>
                    ${report.photo_url ? `
                        <a href="${report.photo_url}" target="_blank" class="btn btn-secondary" style="width: auto; padding: 3px 8px; font-size: 0.7rem;">
                            <i class="fas fa-image"></i> Ver Foto
                        </a>
                    ` : '<span style="opacity: 0.4;">Sin foto</span>'}
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error("Error loading registros:", err);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 3rem; color: #ef4444;">Error: ${err.message}</td></tr>`;
    }
}

// --- DASHBOARD SHIFTS LOGIC ---

// --- DASHBOARD SHIFTS LOGIC ---

// Global cache for filtering
let allGroupedShifts = null;

async function loadTodayShifts() {
    const container = document.getElementById('shifts-grouped-container');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center; padding:2rem;">Cargando turnos desplegados...</div>';

    // 1. Calculate Dates
    // HELPERS (Moved to top to prefer hoisting issues)
    // 1. Calculate Dates
    // HELPERS
    const cleanRut = (s) => {
        if (!s) return '';
        return String(s).replace(/[^0-9kK]/g, '').toUpperCase();
    };
    const normalizeName = (s) => String(s || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const getTokens = (str) => {
        return normalizeName(str)
            .replace(/[.,()\-]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length > 2 && !['latam', 'ola', 'practica', 'sin', 'perfil', 'cargo', 'turn', 'turno'].includes(t));
    };
    window.debugGetTokens = getTokens;

    const now = new Date();
    const dates = [];
    // Start from YESTERDAY to catch overnight shifts
    for (let i = -1; i < 3; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        dates.push(`${yyyy}-${mm}-${dd}`);
    }
    const [yesterday, today, tomorrow, dayAfter] = dates;

    try {
        // 2. Fetch Shift Codes
        const { data: shiftCodesData } = await supabase.from('shift_codes').select('*');
        const shiftMap = {};
        if (shiftCodesData) {
            shiftCodesData.forEach(sc => {
                shiftMap[sc.name] = { start: sc.start_time, end: sc.end_time };
            });
        }

        // 3. Fetch Shifts (From Yesterday)
        const { data: shifts, error } = await supabase
            .from('user_shifts')
            .select('*')
            .gte('shift_date', yesterday) // Include Yesterday
            .lte('shift_date', dayAfter)
            .order('user_name');

        if (error || !shifts || shifts.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:2rem;">No hay turnos registrados.</div>';
            updateDashStats(0, 0);
            return;
        }

        // 4. Fetch Profiles
        const { data: allProfiles } = await supabase
            .from('profiles')
            .select('id, rut, tica_status, phone, full_name, role, team, username')
            .not('username', 'in', '("Administrador","StbcK")');

        const profilesData = allProfiles || [];

        // Predata & Maps
        const { data: predataData } = await supabase.from('agent_predata').select('rut, tica_status, full_name');
        const predataByName = {};
        const predataMap = {};

        if (predataData) {
            predataData.forEach(p => {
                if (p.rut) predataMap[cleanRut(p.rut)] = p;
                if (p.full_name) predataByName[normalizeName(p.full_name)] = p;
            });
        }

        const profileMap = {};
        const profileByName = {};

        profilesData.forEach(p => {
            if (p.rut) {
                const cleanedRut = cleanRut(p.rut);
                profileMap[cleanedRut] = p;
                if (cleanedRut.endsWith('K')) profileMap[cleanedRut.slice(0, -1)] = p;
            }
            if (p.full_name) profileByName[normalizeName(p.full_name)] = p;
        });

        // 5. Structure Data
        const users = {};
        let statsActive = 0;
        let statsUpcoming = 0;

        // Populate users map
        shifts.forEach(s => {
            // Link Logic (Same as before)
            // ... (Abbreviated for patch size, keeping linking logic is assumed or we use existing users map)
            /* The tool limits context. I must recreate the user grouping logic. */

            if (!users[s.rut]) {
                let profile = profileMap[cleanRut(s.rut)];
                if (!profile && s.user_name) profile = profileByName[normalizeName(s.user_name)];

                // Smart Match (Simplified for brevity but functional)
                if (!profile && s.user_name) {
                    const tokens = getTokens(s.user_name);
                    if (tokens.length >= 2) {
                        profile = profilesData.find(p => {
                            if (!p.full_name) return false;
                            const pTokens = getTokens(p.full_name);
                            let matches = 0;
                            tokens.forEach(t => { if (pTokens.includes(t)) matches++; });
                            return matches >= 3 || (matches >= 2 && matches === Math.min(tokens.length, pTokens.length));
                        });
                        // Transitive
                        if (!profile) {
                            const ph = predataByName[normalizeName(s.user_name)];
                            if (ph && ph.rut) profile = profileMap[cleanRut(ph.rut)];
                        }
                    }
                }

                // Category Logic
                let rawRole = (s.role_raw || '').toUpperCase();
                let team = (s.team || 'OLA').toUpperCase();
                if (rawRole.includes('LATAM')) team = 'LATAM';
                let category = 'OTHER';
                if (rawRole.includes('SUPERVISOR') || rawRole.includes('SPRV') || rawRole.includes('JEFE')) category = team.includes('LATAM') ? 'SPRV_LATAM' : 'SPRV_OLA';
                else if (rawRole.includes('CDO')) category = team.includes('LATAM') ? 'CDO_LATAM' : 'CDO_OLA';
                else if (team.includes('LATAM')) category = 'AG_LATAM_FT';
                else category = 'AG_OLA_FT';

                users[s.rut] = {
                    rut: s.rut,
                    name: s.user_name,
                    role: s.role_raw,
                    team: team,
                    category: category,
                    profile: profile || {},
                    shifts: {} // Map date -> code
                };
            }
            users[s.rut].shifts[s.shift_date] = s.shift_code || 'SIN TURNO';
        });

        // Get Attendance
        const { data: attData } = await supabase
            .from('attendance')
            .select('rut, attendance_status, observation')
            .gte('shift_date', yesterday) // Also need yesterday's attendance
            .lte('shift_date', today);

        const attendanceMap = {};
        if (attData) {
            attData.forEach(a => {
                if (a.rut) attendanceMap[cleanRut(a.rut)] = a;
            });
        }

        // Init Globals
        window._dashboardData = { onShift: [], upcoming: [], ticaActive: [], sinTica: [], ausencias: [] };
        let ticaActiveCount = 0;
        let sinTicaCount = 0;
        let ausenciasCount = 0;

        let unifiedList = [];

        // 6. PROCESSING & STATUS CHECK (The Fix)
        const nowTime = now.getTime();

        const checkDetailedStatus = (userObj) => {
            // Check Yesterday and Today shifts to see if ANY is active right now
            const checkDates = [yesterday, today];

            let finalStatus = 'other';
            let bestDiff = 99999;
            let activeShiftCode = null;

            for (const dateStr of checkDates) {
                const code = userObj.shifts[dateStr];
                if (!code || code === 'LI' || code === 'SIN TURNO') continue;

                const times = shiftMap[code];
                if (!times) continue;

                // Parse Start
                const [sh, sm] = times.start.split(':').map(Number);
                const startDate = new Date(dateStr);
                // Adjust for timezone? Date(dateStr) creates UTC or Local? 
                // "YYYY-MM-DD" usually parses as UTC. But we want Local midnight logic.
                // Safest:
                const [y, m, d] = dateStr.split('-').map(Number);
                const startObj = new Date(y, m - 1, d, sh, sm, 0); // Local time construction

                // Parse End
                const [eh, em] = (times.end || '23:59').split(':').map(Number);
                let endObj = new Date(y, m - 1, d, eh, em, 0);

                // Handle Overnight
                if (endObj <= startObj) {
                    endObj.setDate(endObj.getDate() + 1); // Ends next day
                }

                const startTime = startObj.getTime();
                const endTime = endObj.getTime();

                // Check Active
                if (nowTime >= startTime && nowTime < endTime) {
                    return { status: 'active', code: code };
                }

                // Check Upcoming (only if Today)
                if (dateStr === today) {
                    const diff = (startTime - nowTime) / 60000; // mins
                    if (diff > 0 && diff <= 240) {
                        // Keep looking, but this is a candidate
                        if (diff < bestDiff) {
                            finalStatus = 'upcoming';
                            activeShiftCode = code;
                            bestDiff = diff;
                        }
                    }
                }
            }
            return { status: finalStatus, code: activeShiftCode || userObj.shifts[today] || 'SIN TURNO' };
        };

        Object.values(users).forEach(u => {
            const statusFn = checkDetailedStatus(u);
            const status = statusFn.status;
            const shiftCode = statusFn.code; // The relevant code for the active/upcoming status

            // Determine if 'Presente' in system matches the *current* reality
            // We link attendance to the person, not specific date here (simplified)
            // ideally we match attendance date to the active shift date.
            const cleanR = cleanRut(u.rut);
            const att = attendanceMap[cleanR] || {};
            const attStatus = att.attendance_status;

            const ticaStatus = u.profile.tica_status || predataMap[cleanR]?.tica_status || 'sin_tica';

            // Stats Logic
            if (status === 'active') statsActive++;
            if (status === 'upcoming') statsUpcoming++;

            const agentData = {
                name: u.name, role: u.category, team: u.team, shiftCode: shiftCode,
                ticaStatus: ticaStatus, observation: att.observation || ''
            };

            // Dashboard Lists
            // include in onShift if Active, OR if Upcoming but already marked Presente
            if (status === 'active' || (status === 'upcoming' && attStatus === 'presente')) {
                window._dashboardData.onShift.push(agentData);
            }
            if (status === 'upcoming' && attStatus !== 'presente') window._dashboardData.upcoming.push(agentData);

            // TICA / Absence logic typically applies to Today's primary shift
            // but for "Agents Present", we care about who is here now.
            if ((status === 'active' || attStatus === 'presente') && ticaStatus === 'vigente') {
                ticaActiveCount++;
                window._dashboardData.ticaActive.push(agentData);
            }
            // Sin Tica: If present/active and no tica
            if ((status === 'active' || attStatus === 'presente') && ticaStatus === 'sin_tica') {
                sinTicaCount++;
                window._dashboardData.sinTica.push(agentData);
            }

            // Absences (Usually logged against Today)
            if (attStatus === 'ausente' || attStatus === 'licencia') {
                if (u.shifts[today] && u.shifts[today] !== 'LI') {
                    ausenciasCount++;
                    window._dashboardData.ausencias.push(agentData);
                }
            }

            // Table List Inclusion
            // Show if Active, Upcoming, or if they have a shift Today (even if ended)
            const hasShiftToday = u.shifts[today] && u.shifts[today] !== 'LI';
            if (status === 'active' || status === 'upcoming' || hasShiftToday) {
                u.realStatus = status; // For sorting/display
                unifiedList.push(u);
            }
        });

        // Update Stats UI
        updateDashStats(window._dashboardData.onShift.length, window._dashboardData.upcoming.length, {
            ticaActive: ticaActiveCount,
            sinTica: sinTicaCount,
            ausencias: ausenciasCount
        });

        // Sort: Alphabetical by Shift Code, then by Name
        unifiedList.sort((a, b) => {
            const shiftA = a.shifts[today] || '';
            const shiftB = b.shifts[today] || '';

            // Compare shifts alphabetically (e.g., M01 vs M02 vs T01)
            const shiftCompare = shiftA.localeCompare(shiftB);
            if (shiftCompare !== 0) return shiftCompare;

            // Then by name
            return a.name.localeCompare(b.name);
        });

        // LIMIT TO 20
        const limitedList = unifiedList.slice(0, 20);



        allGroupedShifts = limitedList; // Cache for simple local reuse if needed
        await renderUnifiedShifts(limitedList, today);

        // Setup Search (Simple filtering on the already fethed list?)
        // If searching, we might search the FULL list, not just the top 20.
        const searchInput = document.getElementById('today-shifts-search');
        if (searchInput) {
            // Remove old listeners to avoid dupes or use oninput
            searchInput.oninput = async (e) => {
                const term = e.target.value.toLowerCase();
                if (!term) {
                    await renderUnifiedShifts(unifiedList.slice(0, 20), today);
                } else {
                    const searchRes = unifiedList.filter(u => u.name.toLowerCase().includes(term) || u.rut.toLowerCase().includes(term));
                    await renderUnifiedShifts(searchRes.slice(0, 20), today);
                }
            };
        }

    } catch (err) {
        console.error("Shift Load Error:", err);
        container.innerHTML = `<div style="color:red; text-align:center;">Error: ${err.message}</div>`;
    }
}

// Replaces renderGroupedShifts
async function renderUnifiedShifts(list, todayDate) {
    const container = document.getElementById('shifts-grouped-container');
    if (!container) return;
    container.innerHTML = '';

    if (!list || list.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:2rem; color: #aaa;">No hay personal activo o próximo por mostrar.</div>';
        return;
    }

    // Fetch attendance data for today
    const ruts = list.map(u => u.rut).filter(Boolean);
    // Normalize RUTs for querying
    const cleanRut = (s) => String(s || '').replace(/[^0-9kK]/g, '').toUpperCase();
    const cleanedRuts = ruts.map(r => cleanRut(r)).filter(Boolean);

    let attendanceMap = {};
    let predataMap = {};

    if (cleanedRuts.length > 0) {
        // Fetch attendance data
        const { data: attendanceData } = await supabase
            .from('attendance')
            .select('*')
            .eq('shift_date', todayDate)
            .in('rut', cleanedRuts);

        if (attendanceData) {
            attendanceData.forEach(a => {
                attendanceMap[a.rut] = a;
                attendanceMap[cleanRut(a.rut)] = a; // Also index by cleaned version
            });
        }

        // Fetch agent_predata for TICA status fallback
        const { data: predataData } = await supabase
            .from('agent_predata')
            .select('rut, tica_status, full_name')
            .in('rut', cleanedRuts);

        if (predataData) {
            predataData.forEach(p => {
                predataMap[p.rut] = p;
                predataMap[cleanRut(p.rut)] = p;
            });
        }
    }

    const table = document.createElement('table');
    table.className = 'unified-shift-table';
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '0.85rem';

    table.innerHTML = `
        <thead>
            <tr style="border-bottom: 2px solid var(--primary-color);">
                <th style="padding:10px 8px; text-align:left; background: linear-gradient(135deg, var(--primary-color), var(--accent-color)); color: white; font-weight: 600;">Agente</th>
                <th style="padding:10px 8px; text-align:center; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; font-weight: 600;">🕐 Turno</th>
                <th style="padding:10px 8px; text-align:center; min-width:100px; background: linear-gradient(135deg, #10b981, #059669); color: white; font-weight: 600;">📋 Asistencia</th>
                <th style="padding:10px 8px; text-align:center; min-width:140px; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; font-weight: 600;">📝 Observaciones</th>
                <th style="padding:10px 8px; text-align:center; min-width:110px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; font-weight: 600;">🪪 TICA</th>
                <th style="padding:10px 8px; text-align:center; min-width:120px; background: linear-gradient(135deg, #8b5cf6, #6d28d9); color: white; font-weight: 600;">🍽️ Colación</th>
                <th style="padding:10px 8px; text-align:center; background: linear-gradient(135deg, #64748b, #475569); color: white; font-weight: 600;">Estado</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');

    // Add Keyframe for blinking
    if (!document.getElementById('blink-style')) {
        const style = document.createElement('style');
        style.id = 'blink-style';
        style.textContent = `
            @keyframes blink-badge { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
            .badge-pulse { animation: blink-badge 1.5s infinite; }
         `;
        document.head.appendChild(style);
    }

    // Options for selects
    const attendanceOpts = [
        { val: 'pending', label: '⏳ Pendiente', color: '#6b7280' },
        { val: 'presente', label: '✅ Presente', color: '#10b981' },
        { val: 'ausente', label: '❌ Ausente', color: '#ef4444' },
        { val: 'licencia', label: '📋 Licencia', color: '#3b82f6' }
    ];

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

    const ticaOpts = [
        { val: 'vigente', label: '✅ Vigente', color: '#10b981' },
        { val: 'por_vencer', label: '⚠️ Por Vencer', color: '#f59e0b' },
        { val: 'vencida', label: '❌ Vencida', color: '#ef4444' },
        { val: 'en_tramite', label: '🔄 En Trámite', color: '#3b82f6' },
        { val: 'sin_tica', label: '❓ Sin TICA', color: '#6b7280' }
    ];

    const colationOpts = [
        { val: 'pendiente', label: '⏳ Pendiente', color: '#f59e0b' },
        { val: 'ok', label: '✅ OK', color: '#10b981' }
    ];

    list.forEach(u => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.08)';

        let statusBadge = '-';
        if (u.realStatus === 'active') {
            statusBadge = `<span class="badge" style="background:#10b981; color:white; font-size:0.7rem;">En Turno</span>`;
        } else if (u.realStatus === 'upcoming') {
            statusBadge = `<span class="badge badge-pulse" style="background:#f59e0b; color:black; font-weight:bold; font-size:0.7rem;">⚠️ Próximo</span>`;
        }

        // Colorize Shift Code
        const shiftCode = u.shifts[todayDate] || '-';
        let codeStyle = 'background:#374151; color:white;';
        if (shiftCode.startsWith('M')) codeStyle = 'background:#ea580c; color:white;';
        else if (shiftCode.startsWith('T')) codeStyle = 'background:#eab308; color:black;';
        else if (shiftCode.startsWith('N')) codeStyle = 'background:#4f46e5; color:white;';
        else if (['L', 'LI'].includes(shiftCode)) codeStyle = 'background:#15803d; color:white;';

        // Get attendance data (using cleaned RUT for lookup)
        const userCleanRut = cleanRut(u.rut);
        const att = attendanceMap[userCleanRut] || attendanceMap[u.rut] || {};
        const currentAttendance = att.attendance_status || 'pending';
        const currentObs = att.observation || 'SIN OBS';
        const currentColation = att.colation_status || 'pendiente';

        // Get TICA status: first from profile, then from predataMap
        const predata = predataMap[userCleanRut] || predataMap[u.rut] || {};
        const currentTica = u.profile?.tica_status || predata.tica_status || 'sin_tica';
        const userId = u.profile?.id;

        // Generate select options HTML
        const attendanceOptsHtml = attendanceOpts.map(o =>
            `<option value="${o.val}" ${o.val === currentAttendance ? 'selected' : ''}>${o.label}</option>`
        ).join('');
        const attendanceColor = attendanceOpts.find(o => o.val === currentAttendance)?.color || '#6b7280';

        const obsOptsHtml = observationOpts.map(o =>
            `<option value="${o.val}" ${o.val === currentObs ? 'selected' : ''}>${o.label}</option>`
        ).join('');
        const currentObsData = observationOpts.find(o => o.val === currentObs);
        const obsColor = currentObsData?.color || '#6b7280';
        const obsBg = currentObsData?.bg || 'rgba(107,114,128,0.15)';

        const ticaOptsHtml = ticaOpts.map(o =>
            `<option value="${o.val}" ${o.val === currentTica ? 'selected' : ''}>${o.label}</option>`
        ).join('');
        const ticaColor = ticaOpts.find(o => o.val === currentTica)?.color || '#6b7280';

        const colationOptsHtml = colationOpts.map(o =>
            `<option value="${o.val}" ${o.val === currentColation ? 'selected' : ''}>${o.label}</option>`
        ).join('');
        const colationColor = colationOpts.find(o => o.val === currentColation)?.color || '#f59e0b';

        const safeRut = (u.rut || '').replace(/'/g, "\\'");
        const safeName = u.name.replace(/'/g, "\\'");

        tr.innerHTML = `
            <td style="padding:8px;">
                <div style="display:flex; flex-direction:column; gap:2px;">
                    <span style="font-size:0.85rem; font-weight:600; color:var(--text-color);">${u.name}</span>
                    <div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                        <span style="font-size:0.7rem; opacity:0.7;">${u.role || 'Sin Cargo'}</span>
                        <span style="font-size:0.6rem; padding:2px 5px; border-radius:4px; background:${u.team === 'LATAM' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)'}; color:${u.team === 'LATAM' ? '#ef4444' : '#3b82f6'};">${u.team}</span>
                    </div>
                </div>
            </td>
            <td style="padding:8px; text-align:center;">
                 <span class="badge" style="${codeStyle} font-family:monospace; font-size:0.8rem; padding:3px 6px;">${shiftCode}</span>
            </td>
            <td style="padding:6px; text-align:center; background:rgba(16,185,129,0.05);">
                <select onchange="updateDashboardAttendance('${safeRut}', '${safeName}', '${todayDate}', 'attendance_status', this.value, this)" 
                        style="width:100%; max-width:100px; padding:4px; border-radius:4px; border:2px solid ${attendanceColor}; 
                               background:var(--input-bg, rgba(0,0,0,0.2)); color:var(--text-color); font-size:0.7rem; cursor:pointer;">
                    ${attendanceOptsHtml}
                </select>
            </td>
            <td style="padding:6px; text-align:center; background:rgba(245,158,11,0.05);">
                <select onchange="updateDashboardAttendance('${safeRut}', '${safeName}', '${todayDate}', 'observation', this.value, this); this.style.borderColor=this.options[this.selectedIndex].dataset.color; this.style.background=this.options[this.selectedIndex].dataset.bg;" 
                        style="width:100%; max-width:145px; padding:5px 6px; border-radius:6px; border:2px solid ${obsColor}; 
                               background:${obsBg}; color:var(--text-color); font-size:0.65rem; cursor:pointer; font-weight:500;">
                    ${observationOpts.map(o => `<option value="${o.val}" data-color="${o.color}" data-bg="${o.bg}" ${o.val === currentObs ? 'selected' : ''}>${o.label}</option>`).join('')}
                </select>
            </td>
            <td style="padding:6px; text-align:center; background:rgba(59,130,246,0.05);">
                <select onchange="updateDashboardTica('${userId || ''}', '${safeRut}', '${safeName}', this.value, this)" 
                        style="width:100%; max-width:100px; padding:4px; border-radius:4px; border:2px solid ${ticaColor}; 
                               background:var(--input-bg, rgba(0,0,0,0.2)); color:var(--text-color); font-size:0.7rem; cursor:pointer;">
                    ${ticaOptsHtml}
                </select>
            </td>
            <td style="padding:6px; text-align:center; background:rgba(139,92,246,0.05);">
                <select onchange="updateDashboardAttendance('${safeRut}', '${safeName}', '${todayDate}', 'colation_status', this.value, this)" 
                        style="width:100%; max-width:110px; padding:4px; border-radius:4px; border:2px solid ${colationColor}; 
                               background:var(--input-bg, rgba(0,0,0,0.2)); color:var(--text-color); font-size:0.7rem; cursor:pointer;">
                    ${colationOptsHtml}
                </select>
            </td>
            <td style="padding:8px; text-align:center;">${statusBadge}</td>
        `;
        tbody.appendChild(tr);
    });

    container.appendChild(table);
}

// Dashboard Attendance Update Function
window.updateDashboardAttendance = async function (rut, userName, shiftDate, field, value, selectElement) {
    try {
        // Check if record exists
        const { data: existing } = await supabase
            .from('attendance')
            .select('id')
            .eq('rut', rut)
            .eq('shift_date', shiftDate)
            .maybeSingle();

        let error;
        if (existing) {
            // Update existing
            const { error: updateErr } = await supabase
                .from('attendance')
                .update({ [field]: value, updated_at: new Date().toISOString() })
                .eq('id', existing.id);
            error = updateErr;
        } else {
            // Insert new
            const { error: insertErr } = await supabase
                .from('attendance')
                .insert({
                    rut: rut,
                    user_name: userName,
                    shift_date: shiftDate,
                    [field]: value
                });
            error = insertErr;
        }

        if (error) {
            console.error('Attendance update error:', error);
            if (selectElement) selectElement.style.borderColor = '#ef4444';
            return;
        }

        // Visual feedback
        if (selectElement) {
            const origBorder = selectElement.style.borderColor;
            selectElement.style.borderColor = '#10b981';
            selectElement.style.boxShadow = '0 0 0 2px rgba(16,185,129,0.3)';
            setTimeout(() => {
                selectElement.style.boxShadow = 'none';
            }, 500);
        }
    } catch (err) {
        console.error('Dashboard attendance error:', err);
    }
};

// Dashboard TICA Update Function - works with userId OR rut
window.updateDashboardTica = async function (userId, rut, userName, newStatus, selectElement) {
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
            const { error: updateErr } = await supabase
                .from('profiles')
                .update({ tica_status: newStatus })
                .eq('id', userId);
            error = updateErr;
        } else if (rut) {
            // No profile - try to update/insert in agent_predata
            const cleanRut = String(rut).replace(/[^0-9kK]/g, '').toUpperCase();

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

        if (error) {
            console.error('TICA update error:', error);
            if (selectElement) selectElement.style.borderColor = '#ef4444';
            return;
        }

        // Visual feedback
        if (selectElement) {
            selectElement.style.borderColor = ticaColors[newStatus] || '#6b7280';
            selectElement.style.boxShadow = '0 0 0 2px rgba(16,185,129,0.3)';
            setTimeout(() => {
                selectElement.style.boxShadow = 'none';
            }, 500);
        }
    } catch (err) {
        console.error('Dashboard TICA error:', err);
    }
};




