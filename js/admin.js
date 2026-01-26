
// Admin Logic

document.addEventListener('DOMContentLoaded', async () => {

    // Auth Check
    let attempts = 0;
    while (!window.DB?.ready && attempts < 20) { await new Promise(r => setTimeout(r, 100)); attempts++; }

    const session = await window.DB.checkAuth();
    console.log("Admin Check Session:", session);

    if (!session.isLoggedIn || session.role !== 'admin') {
        window.location.href = '../index.html';
        return;
    }

    // Toggle Sidebar
    document.getElementById('sidebarCollapse')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('active');
    });

    // Initial Load
    refreshDashboard();

    // View Switcher logic
    window.loadView = (viewName) => {
        const mainView = document.getElementById('mainView');
        const pageTitle = document.getElementById('pageTitle');

        // Update Active State in Sidebar
        document.querySelectorAll('.sidebar .nav-link').forEach(el => el.classList.remove('active'));
        const activeLink = document.querySelector(`.sidebar .nav-link[onclick="loadView('${viewName}')"]`);
        if (activeLink) activeLink.classList.add('active');

        // Map titles
        const titles = {
            'dashboard': 'Dashboard Principal',
            'resumen': 'Resumen General',
            'notas': 'Notas del Sistema',
            'adminsillas': 'Gestión de Sillas y Carros',
            'adminagentes': 'Gestión de Agentes',
            'terminales': 'Gestión de Terminales',
            'mantenciones': 'Control de Mantenciones',
            'adminconfig': 'Configuración del Sistema',
            'registros': 'Registros de Movimientos',
            'movimientos': 'Registro de Movimientos',
            'adminops': 'Operaciones en Tiempo Real',
            'admindb': 'Base de Datos'
        };
        if (pageTitle) pageTitle.innerText = titles[viewName] || 'Panel de Administración';

        // Load Content
        if (viewName === 'dashboard') {
            location.reload();
        }
        else if (viewName === 'adminsillas') {
            const template = document.getElementById('view-sillas');
            mainView.innerHTML = '';
            mainView.appendChild(template.content.cloneNode(true));
            loadChairs();
            setupCreateForm();
        }
        else if (viewName === 'movimientos') {
            const template = document.getElementById('view-movimientos');
            mainView.innerHTML = '';
            mainView.appendChild(template.content.cloneNode(true));
            loadLogs();

            // Subscribe to real-time updates
            if (!window.logSubscriptionActive) {
                window.DB.subscribeToLogs((newLog) => {
                    // Refresh if new log comes in (or append simpler?)
                    // For now, reloading safe to ensure sort order
                    loadLogs();
                    // Optional: Show toast notification?
                });
                window.logSubscriptionActive = true;
            }
        }
        else {
            // Generic Fallback for unimplemented views
            mainView.innerHTML = `
                <div class="text-center py-5">
                    <div class="display-1 text-muted mb-3"><i class="fas fa-person-digging"></i></div>
                    <h3>Sección en Construcción e Implementación</h3>
                    <p class="text-muted">La vista <strong>${viewName}</strong> estará disponible pronto.</p>
                </div>
            `;
        }
    };

});

async function refreshDashboard() {
    const stats = await window.DB.getStats();
    if (stats.success) {
        document.getElementById('statUsers').innerText = stats.data.users;
        document.getElementById('statChairs').innerText = stats.data.chairs;
        document.getElementById('statLogs').innerText = stats.data.logs;
    }
}

async function loadChairs() {
    const res = await window.DB.getChairs();
    const tbody = document.getElementById('chairsTableBody');
    if (res.success && tbody) {
        tbody.innerHTML = res.data.map(c => {
            // Determine Badge Class
            let badgeClass = 'bg-secondary';
            const owner = (c.owner || '').toString().trim(); // Normalize
            const ownerLower = owner.toLowerCase();
            if (ownerLower.includes('naranja')) badgeClass = 'badge-naranja';
            else if (ownerLower.includes('ola')) badgeClass = 'badge-ola';
            else if (ownerLower.includes('latam')) badgeClass = 'badge-latam';

            // Translate Status
            let statusBadge = 'bg-secondary';
            let statusText = c.status;
            if (c.status === 'available') { statusText = 'Disponible'; statusBadge = 'badge-avail'; }
            if (c.status === 'occupied') { statusText = 'Ocupado'; statusBadge = 'bg-danger'; }

            return `
            <tr>
                <td class="ps-4"><span class="badge bg-light text-dark border fw-bold" style="font-size:1rem;">${c.code}</span></td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center me-3" style="width:40px;height:40px;font-size:1.2rem;">
                            <i class="${getIcon(c.category)}"></i>
                        </div>
                        <span class="fw-bold text-dark text-capitalize fs-6">${c.category}</span>
                    </div>
                </td>
                <td><span class="badge ${badgeClass} rounded-pill px-3 py-2 shadow-sm" style="font-size:0.9rem;">${c.owner || 'Sin Asignar'}</span></td>
                <td><span class="fw-bold text-dark"><i class="fas fa-map-pin me-2 text-danger"></i> ${c.location}</span></td>
                <td><span class="badge ${statusBadge} rounded-pill px-3 py-2" style="font-size:0.85rem;"><i class="fas fa-check-circle me-1"></i> ${statusText}</span></td>
                <td class="text-end pe-4">
                    <div class="d-flex justify-content-end gap-2">
                        <button class="btn btn-outline-dark btn-sm shadow-sm" onclick="showQR('${c.code}')" title="Ver QR" style="width: 35px; height: 35px;"><i class="fas fa-qrcode"></i></button>
                        <button class="btn btn-outline-primary btn-sm shadow-sm" onclick="openEditModal('${c.id}', '${c.category}', '${c.owner}', '${c.location}')" title="Editar" style="width: 35px; height: 35px;"><i class="fas fa-pen"></i></button>
                        <button class="btn btn-outline-danger btn-sm shadow-sm" onclick="deleteChair('${c.id}', '${c.code}')" title="Eliminar" style="width: 35px; height: 35px;"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    }
}

function getIcon(cat) {
    if (cat === 'golf') return 'fas fa-golf-ball';
    if (cat === 'oruga') return 'fas fa-road';
    if (cat === 'pasillo') return 'fas fa-chair';
    return 'fas fa-wheelchair';
}

function setupCreateForm() {
    const form = document.getElementById('createChairForm');
    const modalEl = document.getElementById('createModal');

    if (modalEl) {
        // Clean form on open logic
        modalEl.removeEventListener('show.bs.modal', window.cleanModalHandler); // Avoid dupes?
        window.cleanModalHandler = function (event) {
            const trigger = event.relatedTarget;
            if (trigger) {
                if (form) form.reset();
                const idInput = document.getElementById('chairId');
                if (idInput) idInput.value = '';
                const title = document.getElementById('modalTitle');
                if (title) title.innerHTML = '<i class="fas fa-magic me-2"></i> Crear Activo';
            }
        };
        modalEl.addEventListener('show.bs.modal', window.cleanModalHandler);
    }

    if (form) {
        // Remove old listener hack: clone node
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);

        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(newForm);
            const data = Object.fromEntries(formData.entries());
            const id = data.id;

            // Adding default values if missing from select
            if (!data.category) data.category = 'standard';

            let res;
            if (id) {
                // Update
                res = await window.DB.updateChair(id, {
                    category: data.category,
                    owner: data.owner,
                    location: data.location
                });
            } else {
                // Create
                res = await window.DB.createChair(data);
            }

            if (res.success) {
                alert(id ? "Activo actualizado" : "Activo creado: " + res.data.code);
                const modal = bootstrap.Modal.getInstance(modalEl);
                modal.hide();
                loadChairs();
            } else {
                alert("Error: " + res.message);
            }
        });
    }
}

async function loadLogs() {
    const res = await window.DB.getLogs();
    const tbody = document.getElementById('logsTableBody');
    const loading = document.getElementById('logsLoading');

    if (res.success && tbody) {
        if (res.data.length === 0) {
            loading.innerText = 'No hay registros aun.';
            return;
        }
        loading.style.display = 'none';

        tbody.innerHTML = res.data.map(log => {
            const date = new Date(log.timestamp).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            return `
            <tr>
                <td class="ps-4 text-muted fw-bold small">${date}</td>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <div class="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center" style="width:30px;height:30px;"><i class="fas fa-user"></i></div>
                        <span class="fw-semibold text-dark">${log.username || 'Sistema'}</span>
                    </div>
                </td>
                <td><span class="badge bg-light text-dark border">${log.chair_code || '-'}</span></td>
                <td><small>${log.origin_text || '-'}</small></td>
                <td><small>${log.destination_text || '-'}</small></td>
                <td class="pe-4"><span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2">${log.final_location_text || '-'}</span></td>
            </tr>
            `;
        }).join('');
    } else {
        console.error("LoadLogs failed:", res);
        if (loading) loading.innerHTML = `<span class="text-danger"><i class="fas fa-exclamation-circle"></i> Error: ${res.message || 'Desconocido'}</span>`;
    }
}

// Global functions for inline buttons
window.openEditModal = (id, cat, owner, loc) => {
    document.getElementById('chairId').value = id;
    document.getElementById('chairCategory').value = cat;
    document.getElementById('chairOwner').value = owner;
    document.getElementById('chairLocation').value = loc;
    document.getElementById('modalTitle').innerText = 'Editar Activo';

    const modal = new bootstrap.Modal(document.getElementById('createModal'));
    modal.show();
};

window.deleteChair = async (id, code) => {
    if (confirm(`¿Estás seguro de eliminar el activo ${code}?`)) {
        const res = await window.DB.deleteChair(id);
        if (res.success) {
            loadChairs();
        } else {
            alert("Error al eliminar: " + res.message);
        }
    }
};

window.showQR = (code) => {
    const label = document.getElementById('qrCodeLabel');
    if (label) label.innerText = code;

    // Generate URL based on current location, pointing to index.html
    // Assuming admin is at /QRCARGO/admin/admin.html, we want /QRCARGO/index.html
    const origin = window.location.origin;
    // Simple heuristic: go up one level from current path
    const path = window.location.pathname.replace(/\/admin\/.*$/, '/index.html');
    const fullUrl = `${origin}${path}?code=${code}`;

    console.log("Generating QR for:", fullUrl);

    const qrContainer = document.getElementById('qrDisplay');
    if (qrContainer) {
        qrContainer.innerHTML = '';
        new QRCode(qrContainer, {
            text: fullUrl,
            width: 200,
            height: 200
        });
    }

    const modalEl = document.getElementById('qrModal');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
};
```
