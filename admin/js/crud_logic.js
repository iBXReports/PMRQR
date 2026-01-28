
import { supabase } from '../../assets/js/client.js';

// --- SETTINGS (CRUD) ---
let currentSettingsType = 'airlines'; // Default

// Map types to DB tables and friendly logic
const SETTINGS_CONFIG = {
    'airlines': { table: 'airlines', label: 'Aerolíneas', hasIata: true, hasLogo: true },
    'origin': { table: 'locations', label: 'Orígenes', filter: { type: 'origin' }, hiddenType: 'origin' },
    'destination': { table: 'locations', label: 'Destinos', filter: { type: 'destination' }, hiddenType: 'destination' },
    'gate': { table: 'locations', label: 'Gates Salida', filter: { type: 'gate' }, hasTerminal: true, hiddenType: 'gate' },
    'gate_arrival': { table: 'locations', label: 'Gates Arribo', filter: { type: 'gate_arrival' }, hasTerminal: true, hiddenType: 'gate_arrival' },
    'bridge': { table: 'locations', label: 'Puentes', filter: { type: 'bridge' }, hasTerminal: true, hiddenType: 'bridge' },
    'asset_categories': { table: 'asset_categories', label: 'Categorías Equipo' },
    'assets': { table: 'assets', label: 'Equipo', isAsset: true },
    'profiles': { table: 'profiles', label: 'Usuario', isProfile: true, hasLogo: true }
};

window.loadSettingTable = async function (type, title) {
    currentSettingsType = type;
    const config = SETTINGS_CONFIG[type];
    if (!config) return;

    // Update Tab UI
    document.querySelectorAll('.nav-card').forEach(card => card.classList.remove('active'));
    const clickedBtn = [...document.querySelectorAll('.nav-card')].find(b => b.onclick.toString().includes(`'${type}'`));
    if (clickedBtn) clickedBtn.classList.add('active');

    document.getElementById('crud-title').textContent = title || config.label;
    const container = document.getElementById('settings-cards-container');
    if (!container) return;

    container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 2rem; opacity: 0.5;">Cargando...</div>';

    // Fetch Data
    const orderBy = config.isAsset ? 'code' : 'name';
    let query = supabase.from(config.table).select('*').order(orderBy);
    if (config.filter) {
        Object.keys(config.filter).forEach(key => {
            query = query.eq(key, config.filter[key]);
        });
    }

    const { data, error } = await query;
    if (error) {
        console.error(error);
        container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color: red; padding: 2rem;">Error cargando datos</div>';
        return;
    }

    container.innerHTML = '';
    if (data.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 2rem; opacity: 0.5;">No hay registros.</div>';
        return;
    }

    data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'modern-card';

        let iconContent = '';
        if (config.hasLogo) {
            iconContent = item.logo_url
                ? `<img src="${item.logo_url}" alt="${item.name}">`
                : `<i class="fas fa-plane"></i>`;
        } else {
            const icons = {
                'origin': 'fa-plane-departure',
                'destination': 'fa-plane-arrival',
                'gate': 'fa-door-open',
                'gate_arrival': 'fa-sign-in-alt',
                'bridge': 'fa-bridge',
                'assets': 'fa-tools',
                'asset_categories': 'fa-tags'
            };

            // Override with specific asset icons
            if (type === 'assets') {
                const assetIcons = {
                    'silla de ruedas': 'fa-wheelchair',
                    'silla de pasillo': 'fa-chair',
                    'silla oruga': 'fa-truck-monster',
                    'carrito de golf': 'fa-golf-cart',
                    'carrito duplex': 'fa-bus'
                };
                const assetType = (item.type || '').toLowerCase();
                iconContent = `<i class="fas ${assetIcons[assetType] || 'fa-tools'}"></i>`;
            } else {
                iconContent = `<i class="fas ${icons[type] || 'fa-map-marker-alt'}"></i>`;
            }
        }

        const safeItem = encodeURIComponent(JSON.stringify(item));

        card.innerHTML = `
            <div class="card-header">
                <div class="card-icon-wrapper">${iconContent}</div>
                <div class="card-title-area">
                    <h4 class="card-title">${item.name || item.code}</h4>
                    <span class="card-subtitle">${config.label}</span>
                </div>
            </div>
            <div class="card-body">
                ${config.hasIata ? `
                <div class="card-info-item">
                    <span class="info-label">IATA</span>
                    <span class="info-value">${item.iata_code || '-'}</span>
                </div>` : ''}
                ${config.hasTerminal ? `
                <div class="card-info-item">
                    <span class="info-label">Terminal</span>
                    <span class="info-value">${item.terminal || '-'}</span>
                </div>` : ''}
                ${config.isAsset ? `
                <div class="card-info-item">
                    <span class="info-label">Tipo</span>
                    <span class="info-value" style="text-transform: capitalize;">${item.type}</span>
                </div>
                <div class="card-info-item">
                    <span class="info-label">Estado</span>
                    <span class="badge ${item.status === 'available' ? 'active' : 'warning'}">${item.status === 'available' ? 'Disponible' : 'En Uso'}</span>
                </div>
                <div class="card-info-item" style="grid-column: 1 / -1; margin-top: 10px;">
                    <span class="info-label" style="display:block; margin-bottom:5px;">🔗 Link Inicio</span>
                    <input type="text" readonly value="${item.start_link || 'No generado'}" style="width: 100%; font-size: 0.7rem; padding: 4px; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; background: rgba(0,0,0,0.2); color: var(--text-color);">
                </div>
                <div class="card-info-item" style="grid-column: 1 / -1;">
                    <span class="info-label" style="display:block; margin-bottom:5px;">🔗 Link Devolución</span>
                    <input type="text" readonly value="${item.return_link || 'No generado'}" style="width: 100%; font-size: 0.7rem; padding: 4px; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; background: rgba(0,0,0,0.2); color: var(--text-color);">
                </div>` : ''}
            </div>
            <div class="card-footer">
                <div class="action-group">
                    <button class="btn-action btn-edit" title="Editar" onclick="openCrudModal('${safeItem}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${!config.isAsset ? `
                    <button class="btn-action btn-delete" title="Eliminar" onclick="deleteSetting('${item.id}')">
                        <i class="fas fa-trash-alt"></i>
                    </button>` : `
                    <button class="btn-action btn-delete" title="Eliminar" onclick="deleteAsset('${item.id}')">
                        <i class="fas fa-trash-alt"></i>
                    </button>`}
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Modal Logic
window.openCrudModal = function (itemJson) {
    const config = SETTINGS_CONFIG[currentSettingsType];
    const form = document.getElementById('crud-form');
    form.reset();
    document.getElementById('crud-id').value = '';
    document.getElementById('crud-type').value = currentSettingsType;

    // Visibility
    const extraField = document.getElementById('crud-extra-field');
    const extraLabel = extraField.querySelector('label');
    const extraInput = document.getElementById('crud-extra');
    const logoField = document.getElementById('crud-logo-field');
    const logoInput = document.getElementById('crud-logo');
    const logoPreview = document.getElementById('crud-logo-preview');
    const assetTypeField = document.getElementById('crud-asset-type-field');
    const assetTypeInput = document.getElementById('crud-asset-type');
    const qrField = document.getElementById('crud-qr-field');
    const qrInput = document.getElementById('crud-qr-file');
    const qrPreview = document.getElementById('crud-qr-preview');
    const assetStatusField = document.getElementById('crud-asset-status-field');
    const assetStatusInput = document.getElementById('crud-asset-status');

    extraField.style.display = 'none';
    extraInput.required = false;
    if (logoField) logoField.style.display = 'none';
    if (logoPreview) logoPreview.style.display = 'none';
    if (assetTypeField) assetTypeField.style.display = 'none';
    if (qrField) qrField.style.display = 'none';
    if (qrPreview) qrPreview.style.display = 'none';
    if (assetStatusField) assetStatusField.style.display = 'none';

    const userFields = document.getElementById('crud-user-fields');
    if (userFields) userFields.style.display = 'none';

    if (config.isProfile) {
        document.getElementById('modal-title').textContent = 'Editar Usuario';
        document.getElementById('crud-name').placeholder = 'Nombre Completo';
        if (logoField) {
            logoField.style.display = 'block';
            logoField.querySelector('label').textContent = 'Foto de Perfil (URL o Archivo)';
        }
        if (userFields) userFields.style.display = 'block';
    } else if (config.isAsset) {
        document.getElementById('crud-name').placeholder = 'Ej: SILLA-001 o GOLF-10';
        extraField.style.display = 'none';
        if (assetTypeField) assetTypeField.style.display = 'block';
        if (qrField) qrField.style.display = 'block';
        if (assetStatusField) assetStatusField.style.display = 'block';

        // QR Preview Logic
        if (qrInput) {
            qrInput.value = '';
            qrInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (re) => {
                        qrPreview.src = re.target.result;
                        qrPreview.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                }
            };
        }

        // Fetch Categories from DB dynamically
        if (assetTypeInput) {
            assetTypeInput.innerHTML = '<option value="">Cargando...</option>';
            supabase.from('asset_categories').select('name').order('name').then(({ data }) => {
                assetTypeInput.innerHTML = '';
                if (data && data.length > 0) {
                    data.forEach(cat => {
                        const opt = document.createElement('option');
                        opt.value = cat.name;
                        opt.textContent = cat.name;
                        if (itemJson) {
                            const item = JSON.parse(decodeURIComponent(itemJson));
                            if (item.type === cat.name) opt.selected = true;
                        }
                        assetTypeInput.appendChild(opt);
                    });
                }
            });
        }
    } else if (config.hasIata) {
        document.getElementById('crud-name').placeholder = 'Ej: LATAM';
        extraField.style.display = 'block';
        extraLabel.textContent = 'Código IATA';
        extraInput.placeholder = 'Ej: LA';
    } else if (config.hasTerminal) {
        extraField.style.display = 'block';
        extraLabel.textContent = 'Terminal';
        extraInput.placeholder = 'Nacional / Internacional';
    }

    // Show logo field for airlines
    if (config.hasLogo && logoField) {
        logoField.style.display = 'block';
        if (logoInput) logoInput.value = '';
        if (logoPreview) {
            logoPreview.src = '';
            logoPreview.style.display = 'none';
        }

        // Add event listener for real-time preview of URL
        logoInput.oninput = () => {
            if (logoInput.value) {
                logoPreview.src = logoInput.value;
                logoPreview.style.display = 'block';
            }
        };

        // Add event listener for file selection
        const fileInput = document.getElementById('crud-logo-file');
        fileInput.value = '';
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (re) => {
                    logoPreview.src = re.target.result;
                    logoPreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
                logoInput.value = ''; // prioritizes file over URL
            }
        };
    }

    // Populate if Edit
    if (itemJson) {
        const item = JSON.parse(decodeURIComponent(itemJson));
        document.getElementById('modal-title').textContent = 'Editar Item';
        document.getElementById('crud-id').value = item.id;
        document.getElementById('crud-name').value = item.name || item.code;

        if (item.status && assetStatusInput) assetStatusInput.value = item.status;

        if (config.hasIata) extraInput.value = item.iata_code || '';
        if (config.hasTerminal) extraInput.value = item.terminal || '';

        // QR Preview for edit
        if (config.isAsset && item.qr_url) {
            if (qrPreview) {
                qrPreview.src = item.qr_url;
                qrPreview.style.display = 'block';
            }
        }

        // Logo preview for edit (Profile Avatar or Airline Logo)
        if (config.hasLogo && (item.logo_url || item.avatar_url)) {
            const url = item.logo_url || item.avatar_url;
            if (logoInput) logoInput.value = url;
            if (logoPreview) {
                logoPreview.src = url;
                logoPreview.style.display = 'block';
            }
        }

        // Profile Specific Population
        if (config.isProfile) {
            document.getElementById('crud-user-email').value = item.email || '';
            document.getElementById('crud-user-phone').value = item.phone || '';
            document.getElementById('crud-user-commune').value = item.commune || '';
            document.getElementById('crud-user-role').value = item.role || 'Agente';
            document.getElementById('crud-user-address').value = item.address || '';
        }
    } else {
        document.getElementById('modal-title').textContent = 'Agregar Item';
    }

    // Show Modal
    const modal = document.getElementById('crud-modal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10); // Trigger transition
}

window.closeCrudModal = function () {
    const modal = document.getElementById('crud-modal');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}

document.getElementById('crud-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('crud-id').value;
    const name = document.getElementById('crud-name').value;
    const extra = document.getElementById('crud-extra').value;
    const config = SETTINGS_CONFIG[currentSettingsType];

    let logoUrl = document.getElementById('crud-logo')?.value || '';
    const logoFile = document.getElementById('crud-logo-file')?.files[0];
    const assetType = document.getElementById('crud-asset-type')?.value || 'silla';
    const qrFile = document.getElementById('crud-qr-file')?.files[0];

    // 1. Handle File Upload if present (Logos)
    if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `logos/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('logos')
            .upload(filePath, logoFile);

        if (uploadError) {
            alert('Error subiendo imagen: ' + uploadError.message);
            return;
        }

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('logos')
            .getPublicUrl(filePath);

        logoUrl = publicUrl;
    }

    // 2. Handle QR Upload
    let qrUrl = null;
    if (qrFile) {
        const fileExt = qrFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `qrcodes/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('uploads')
            .upload(filePath, qrFile);

        if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
                .from('uploads')
                .getPublicUrl(filePath);
            qrUrl = publicUrl;
        }
    }

    const payload = {};
    if (config.isAsset) {
        payload.code = name;
        payload.type = assetType;
        payload.status = document.getElementById('crud-asset-status')?.value || 'available';
        if (qrUrl) payload.qr_url = qrUrl;

        // Generate dynamic links
        const baseUrl = window.location.origin + window.location.pathname.replace('admin/admin.html', 'index.html');
        let typeKey = 'SILLA';
        if (assetType.toLowerCase().includes('golf')) typeKey = 'GOLF';
        else if (assetType.toLowerCase().includes('duplex')) typeKey = 'DUPLEX';
        else if (assetType.toLowerCase().includes('oruga')) typeKey = 'ORUGA';

        // Extract number from name (e.g., "SILLA-01" -> "01")
        const numberMatch = (name || '').match(/\d+$/);
        const number = numberMatch ? numberMatch[0] : (name || '0');

        payload.start_link = `${baseUrl}?silla=INICIO${typeKey}-${number}`;
        payload.return_link = `${baseUrl}?silla=DEVOL${typeKey}-${number}`;
    } else {
        payload.name = name;
        if (config.hasIata) payload.iata_code = extra;
        if (config.hasTerminal) payload.terminal = extra;
        if (config.hiddenType) payload.type = config.hiddenType;
        if (config.hasLogo) payload.logo_url = logoUrl;
    }

    if (config.isProfile) {
        payload.full_name = name;
        payload.email = document.getElementById('crud-user-email').value;
        payload.phone = document.getElementById('crud-user-phone').value;
        payload.commune = document.getElementById('crud-user-commune').value;
        payload.role = document.getElementById('crud-user-role').value;
        payload.address = document.getElementById('crud-user-address').value;
        payload.avatar_url = logoUrl; // Reuse logoUrl for profile avatar
        delete payload.name; // Clean up
        delete payload.logo_url;
    }

    let error;
    if (id) {
        // Update
        ({ error } = await supabase.from(config.table).update(payload).eq('id', id));
    } else {
        // Insert
        ({ error } = await supabase.from(config.table).insert(payload));
    }

    if (error) {
        alert('Error: ' + error.message);
    } else {
        closeCrudModal();
        if (currentSettingsType === 'assets') {
            if (typeof window.loadAssets === 'function') window.loadAssets();
        } else if (currentSettingsType === 'profiles') {
            if (typeof window.loadUsers === 'function') window.loadUsers();
        } else {
            loadSettingTable(currentSettingsType);
        }
    }
});

window.deleteSetting = async function (id) {
    if (!confirm('¿Seguro que deseas eliminar este registro?')) return;
    const config = SETTINGS_CONFIG[currentSettingsType];
    const { error } = await supabase.from(config.table).delete().eq('id', id);
    if (error) alert('Error: ' + error.message);
    else loadSettingTable(currentSettingsType);
}

// Auto load default if switched to settings (can be hooked into switchTab or init)
// Added hook in switchTab
