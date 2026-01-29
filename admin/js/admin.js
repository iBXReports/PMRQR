
import { supabase } from '../../assets/js/client.js';

// --- STATE ---
let currentUser = null;

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Check - STRICT
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '../login.html';
        return;
    }

    // Optional: Check if role is 'admin' or 'supervisor'
    // For now assuming any logged in user can try, but ideally we restrict this specific page.
    // Fetch profile
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) { // || profile.role !== 'admin'
        // alert("No tienes permisos de administrador");
        // window.location.href = '../index.html';
    }

    currentUser = profile;
    updateUIProfile(profile);

    // 2. Load Initial Data
    loadDashboard();

    // 3. Global Listeners
    window.switchTab = switchTab;

    // Setup Admin Dropdown
    setupAdminDropdown();
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
window.toggleSidebar = function () {
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
        'settings': 'Ajustes de Configuración'
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
    }
}

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
async function loadDashboard() {
    // Quick Stats
    const { count: opsCount } = await supabase.from('operations').select('*', { count: 'exact', head: true }).eq('status', 'active');
    document.getElementById('stat-active-ops').textContent = opsCount || 0;

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
                    <td>${new Date(asset.created_at).toLocaleDateString()}</td>
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
let allUsersCache = [];

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
        tr.innerHTML = `
            <td>
                <img src="${user.avatar_url || '../assets/imagenes/avatarcargo.png'}" style="width:35px; height:35px; border-radius:50%; object-fit:cover; border:1px solid #ddd;">
            </td>
            <td>
                <div style="font-weight:600;">${user.full_name || user.username || 'Sin Nombre'}</div>
                <div style="font-size:0.75rem; opacity:0.6;">@${user.username}</div>
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
window.loadReports = async function () {
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
                    <td>${new Date(op.start_time).toLocaleDateString()}</td>
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
                    <td>${lastOp ? `${lastOp.profiles?.full_name} (${new Date(lastOp.start_time).toLocaleDateString()})` : 'Sin historial'}</td>
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
            const date = new Date(report.created_at).toLocaleString();
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

window.loadRegistros = loadRegistros;
