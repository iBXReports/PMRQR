
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
    'asset_categories': { table: 'asset_categories', label: 'Categorías Equipo', isCategory: true },
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

    const crudHeader = document.querySelector('#settings-crud-container > div'); // The header div with title and add button
    const bulkBtnId = 'btn-bulk-delete';
    const bulkPrintId = 'btn-bulk-print';
    let bulkBtn = document.getElementById(bulkBtnId);
    let bulkPrintBtn = document.getElementById(bulkPrintId);

    if (type === 'assets') {
        // Delete Button
        if (!bulkBtn) {
            bulkBtn = document.createElement('button');
            bulkBtn.id = bulkBtnId;
            bulkBtn.className = 'btn';
            bulkBtn.style.width = 'auto';
            bulkBtn.style.padding = '0.5rem 1rem';
            bulkBtn.style.marginRight = '10px';
            bulkBtn.style.background = '#ef4444'; // Red
            bulkBtn.style.display = 'none'; // Hidden initially
            bulkBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Eliminar (0)';
            bulkBtn.onclick = deleteBulkAssets;

            const addBtn = crudHeader.querySelector('button');
            crudHeader.insertBefore(bulkBtn, addBtn);
        }

        // Print Button
        if (!bulkPrintBtn) {
            bulkPrintBtn = document.createElement('button');
            bulkPrintBtn.id = bulkPrintId;
            bulkPrintBtn.className = 'btn';
            bulkPrintBtn.style.width = 'auto';
            bulkPrintBtn.style.padding = '0.5rem 1rem';
            bulkPrintBtn.style.marginRight = '10px';
            bulkPrintBtn.style.background = '#6366f1'; // Indigo
            bulkPrintBtn.style.display = 'none'; // Hidden initially
            bulkPrintBtn.innerHTML = '<i class="fas fa-print"></i> Imprimir (0)';
            bulkPrintBtn.onclick = printBulkAssets;

            const addBtn = crudHeader.querySelector('button');
            crudHeader.insertBefore(bulkPrintBtn, addBtn);
        }

    } else {
        if (bulkBtn) bulkBtn.remove();
        if (bulkPrintBtn) bulkPrintBtn.remove();
    }

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

    // If Asset Categories, also fetch counts
    let assetCounts = {};
    if (type === 'asset_categories' && !error) {
        const { data: allAssets } = await supabase.from('assets').select('type');
        if (allAssets) {
            allAssets.forEach(a => {
                const t = (a.type || '').toLowerCase();
                assetCounts[t] = (assetCounts[t] || 0) + 1;
            });
        }
    }

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
        const safeItem = encodeURIComponent(JSON.stringify(item));

        if (type === 'airlines') {
            // SPECIAL COMPACT AIRLINE CARD WITH BACKGROUND
            const card = document.createElement('div');
            card.className = 'airline-card hover-scale';
            const bgImage = item.logo_url ? `url('${item.logo_url}')` : 'none';

            card.style.cssText = `
                position: relative;
                height: 120px;
                background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.9)), ${bgImage};
                background-size: cover;
                background-position: center;
                border-radius: 16px;
                padding: 1rem;
                display: flex;
                flex-direction: column;
                justify-content: flex-end;
                color: white;
                box-shadow: 0 4px 10px rgba(0,0,0,0.2);
                border: 1px solid rgba(255,255,255,0.1);
                overflow: hidden;
            `;

            card.innerHTML = `
                <div style="position: absolute; top: 10px; right: 10px; display: flex; gap: 5px;">
                    <button onclick="openCrudModal('${safeItem}')" style="background: rgba(255,255,255,0.2); border: none; color: white; border-radius: 50%; width: 28px; height: 28px; cursor: pointer; backdrop-filter: blur(4px);">
                        <i class="fas fa-edit" style="font-size: 0.8rem;"></i>
                    </button>
                    <button onclick="deleteSetting('${item.id}')" style="background: rgba(239,68,68,0.8); border: none; color: white; border-radius: 50%; width: 28px; height: 28px; cursor: pointer;">
                        <i class="fas fa-trash-alt" style="font-size: 0.8rem;"></i>
                    </button>
                </div>
                <div>
                    <h4 style="margin: 0; font-size: 1.2rem; font-weight: 800; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">${item.name || 'Sin Nombre'}</h4>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
                        <span style="font-size: 0.8rem; background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 6px; backdrop-filter: blur(4px);">
                            ${item.iata_code || '-'}
                        </span>
                        ${item.logo_url ? '' : '<i class="fas fa-plane" style="opacity: 0.5;"></i>'} 
                    </div>
                </div>
            `;
            container.appendChild(card);
        } else {
            // STANDARD MODERN CARD
            const card = document.createElement('div');
            card.className = 'modern-card';

            let iconContent = '';
            // Icons logic for standard cards
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
                    ${config.isCategory ? `
                    <div class="card-info-item" style="grid-column: 1 / -1;">
                        <span class="info-label">Equipos Registrados</span>
                        <span class="info-value" style="font-weight: 800; font-size: 1.2rem;">
                            ${assetCounts[(item.name || '').toLowerCase()] || 0}
                        </span>
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
                    ${config.isAsset ? `
                    <div style="display: flex; align-items: center; gap: 10px; margin-right: auto;">
                        <input type="checkbox" class="bulk-check" value="${item.id}" onchange="toggleBulkSelect()" style="width: 18px; height: 18px; cursor: pointer;">
                        <span style="font-size: 0.8rem; opacity: 0.7;">Select</span>
                    </div>` : ''}
                    <div class="action-group">
                        ${config.isAsset ? `
                        <button class="btn-action btn-whatsapp" title="Imprimir QR" onclick="printAssetQR('${safeItem}')" style="background:var(--primary-color); color:white; border:none;">
                            <i class="fas fa-qrcode"></i>
                        </button>` : ''}
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
        }
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
    const quantityField = document.getElementById('crud-quantity-field');
    const quantityInput = document.getElementById('crud-quantity');

    extraField.style.display = 'none';
    extraInput.required = false;
    if (logoField) logoField.style.display = 'none';
    if (logoPreview) logoPreview.style.display = 'none';
    if (assetTypeField) assetTypeField.style.display = 'none';
    if (qrField) qrField.style.display = 'none';
    if (qrPreview) qrPreview.style.display = 'none';
    if (assetStatusField) assetStatusField.style.display = 'none';
    if (quantityField) quantityField.style.display = 'none';

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

        // Show quantity only for new creates
        if (!itemJson && quantityField) {
            quantityField.style.display = 'block';
            quantityInput.value = 1;
        }

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
    const quantity = parseInt(document.getElementById('crud-quantity')?.value || '1');

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

    // BULK OR SINGLE LOGIC
    let error = null;

    try {
        console.log(`Processing: Asset=${config.isAsset}, ID=${id}, Quantity=${quantity}`);

        if (config.isAsset && !id && quantity > 1) {
            // --- BULK CREATION ---
            const payloads = [];

            let prefix = name;
            let startNum = 1;
            let padding = 2; // Default 01

            const match = name.match(/(\d+)$/);
            if (match) {
                prefix = name.substring(0, match.index);
                startNum = parseInt(match[0], 10);
                padding = match[0].length;
            }

            // Loop to generate payloads
            for (let i = 0; i < quantity; i++) {
                const currentNum = startNum + i;
                const numStr = String(currentNum).padStart(padding, '0');
                const finalName = prefix + numStr;

                // Clone base payload
                const currentPayload = { ...payload };
                currentPayload.code = finalName;

                // Dynamic Type Key
                let typeKey = 'SILLA';
                const lowerType = assetType.toLowerCase();
                if (lowerType.includes('golf')) typeKey = 'GOLF';
                else if (lowerType.includes('duplex')) typeKey = 'DUPLEX';
                else if (lowerType.includes('oruga')) typeKey = 'ORUGA';

                // Re-calculate Base URL since previous decl was block scoped, or define it globally.
                // Best practice: define it once. But since we are patching:
                const baseUrl = window.location.origin + window.location.pathname.replace('admin/admin.html', 'index.html');

                currentPayload.start_link = `${baseUrl}?silla=INICIO${typeKey}-${numStr}`;
                currentPayload.return_link = `${baseUrl}?silla=DEVOL${typeKey}-${numStr}`;

                payloads.push(currentPayload);
            }

            console.log("Bulk Payloads:", payloads); // Debug
            const response = await supabase.from(config.table).insert(payloads);
            error = response.error;

        } else {
            // --- SINGLE OPERATION ---
            if (id) {
                const response = await supabase.from(config.table).update(payload).eq('id', id);
                error = response.error;
            } else {
                const response = await supabase.from(config.table).insert(payload);
                error = response.error;
            }
        }

        if (error) {
            console.error("Supabase Error:", error);
            alert('Error al guardar: ' + error.message);
        } else {
            closeCrudModal();
            if (currentSettingsType === 'assets') {
                if (typeof window.loadAssets === 'function') window.loadAssets();
            } else if (currentSettingsType === 'profiles') {
                if (typeof window.loadUsers === 'function') window.loadUsers();
            } else {
                loadSettingTable(currentSettingsType);
            }
            // Show success toast or alert (optional)
            // alert('Guardado correctamente'); 
        }

    } catch (err) {
        console.error("JS Exception:", err);
        alert('Ocurrió un error inesperado: ' + err.message);
    }
});

window.deleteSetting = async function (id) {
    if (!confirm('¿Seguro que deseas eliminar este registro?')) return;
    const config = SETTINGS_CONFIG[currentSettingsType];
    const { error } = await supabase.from(config.table).delete().eq('id', id);
    if (error) alert('Error: ' + error.message);
    else loadSettingTable(currentSettingsType);
}

// --- BULK DELETE LOGIC ---
window.toggleBulkSelect = function () {
    const checks = document.querySelectorAll('.bulk-check:checked');
    const btn = document.getElementById('btn-bulk-delete');
    const printBtn = document.getElementById('btn-bulk-print');

    if (checks.length > 0) {
        if (btn) {
            btn.style.display = 'inline-block';
            btn.innerHTML = `<i class="fas fa-trash-alt"></i> Eliminar (${checks.length})`;
        }
        if (printBtn) {
            printBtn.style.display = 'inline-block';
            printBtn.innerHTML = `<i class="fas fa-print"></i> Imprimir (${checks.length})`;
        }
    } else {
        if (btn) btn.style.display = 'none';
        if (printBtn) printBtn.style.display = 'none';
    }
}

window.printBulkAssets = function () {
    const checks = document.querySelectorAll('.bulk-check:checked');
    if (checks.length === 0) return;

    // We need data, but checking checks only gives ID.
    // We need to find the assets. We can grab them from DOM or fetch.
    // DOM is unsafe if paginated (not yet paginated).
    // Let's fetch all assets or find in current Data (not easily stored globally here).
    // Easiest: From the card input? No.
    // Let's just fetch them by ID from Supabase for correctness.
    const ids = Array.from(checks).map(c => c.value);

    supabase.from('assets').select('*').in('id', ids).then(({ data }) => {
        if (data) printAssets(data);
    });
}

window.printAssetQR = function (safeItem) {
    const item = JSON.parse(decodeURIComponent(safeItem));
    printAssets([item]);
}

window.printAssets = function (assets) {
    if (!assets || assets.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Por favor habilita las ventanas emergentes para imprimir.");
        return;
    }

    const cards = assets.map(asset => {
        // Format Type: "CARRITO DE GOLF"
        let typeDisplay = (asset.type || 'Equipo').toUpperCase();

        // Format Name: "Carrito 01" (Keep as is or Capitalize?)
        // User asked for "Carrito 01". If name is "carrito01", maybe prettify?
        // Assuming asset.code is "Carrito01" or similar.
        // Let's trust asset.code but maybe add a space if missing?
        // Logic: if "Carrito01" -> "Carrito 01"
        const codeDisplay = asset.code.replace(/([a-zA-Z])(\d)/, '$1 $2');

        // QR URL - Use start_link or return_link? Usually Start Link for "Scan to Usage".
        const qrData = asset.start_link || 'NO_LINK';

        return `
            <div class="qr-sticker">
                <div class="sticker-header">${typeDisplay}</div>
                <div class="sticker-qr">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}" alt="QR">
                </div>
                <div class="sticker-code">${codeDisplay}</div>
                <div class="sticker-footer">CARGOMOBILITY</div>
            </div>
        `;
    }).join('');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Imprimir Pases QR</title>
            <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;800&display=swap" rel="stylesheet">
            <style>
                body {
                    font-family: 'Outfit', sans-serif;
                    background: #f3f4f6;
                    padding: 20px;
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 20px;
                    margin: 0;
                }
                .qr-sticker {
                    background: white;
                    border: 2px solid #e5e7eb;
                    border-radius: 16px;
                    padding: 20px 10px;
                    text-align: center;
                    width: 100%;
                    max-width: 220px;
                    box-sizing: border-box;
                    page-break-inside: avoid;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: space-between;
                    aspect-ratio: 0.8; 
                }
                .sticker-header {
                    font-weight: 800;
                    font-size: 1rem;
                    text-transform: uppercase;
                    color: #111827;
                    margin-bottom: 10px;
                    line-height: 1.2;
                }
                .sticker-qr {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 5px;
                }
                .sticker-qr img {
                    width: 120px;
                    height: 120px;
                    object-fit: contain;
                }
                .sticker-code {
                    font-weight: 700;
                    font-size: 1.1rem;
                    color: #1f2937; /* Dark Grey */
                    margin-bottom: 5px;
                }
                .sticker-footer {
                    font-weight: 800;
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    color: #374151;
                    letter-spacing: 0.5px;
                }
                @media print {
                    body {
                        background: none;
                        display: block; /* Grid in print can vary, mostly inline-block or stick to grid */
                    }
                    .qr-sticker {
                        border: 1px solid #ccc; /* Thinner border for print */
                        float: left;
                        margin: 10px;
                    }
                }
            </style>
        </head>
        <body>
            ${cards}
            <script>
                window.onload = function() {
                    // Auto print? Maybe just let user view.
                    // window.print();
                }
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
}

window.deleteBulkAssets = async function () {
    const checks = document.querySelectorAll('.bulk-check:checked');
    if (checks.length === 0) return;

    if (!confirm(`¿Estás SEGURO de eliminar ${checks.length} equipos? Esta acción no se puede deshacer.`)) return;

    const ids = Array.from(checks).map(c => c.value);

    // 1. Delete associated ops
    const { error: opError } = await supabase.from('operations').delete().in('asset_id', ids);
    if (opError) {
        alert('Error borrando historial: ' + opError.message);
        return;
    }

    // 2. Delete assets
    const { error } = await supabase.from('assets').delete().in('id', ids);
    if (error) {
        alert('Error borrando equipos: ' + error.message);
    } else {
        // alert('Equipos eliminados correctamente.');
        if (typeof window.loadAssets === 'function') window.loadAssets(); // Refresh main assets view if needed relative to context
        loadSettingTable('assets'); // Refresh table
    }
}

// Auto load default if switched to settings (can be hooked into switchTab or init)
// Added hook in switchTab
