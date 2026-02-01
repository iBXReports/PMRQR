
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
    'shift_codes': { table: 'shift_codes', label: 'Códigos de Turno', isShift: true },
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
    const uploadShiftsId = 'btn-upload-shifts';

    let bulkBtn = document.getElementById(bulkBtnId);
    let bulkPrintBtn = document.getElementById(bulkPrintId);
    let uploadShiftsBtn = document.getElementById(uploadShiftsId);

    // Clean up previous buttons if switching tabs
    if (type !== 'assets' && bulkBtn) { bulkBtn.remove(); bulkBtn = null; }
    if (type !== 'assets' && bulkPrintBtn) { bulkPrintBtn.remove(); bulkPrintBtn = null; }
    if (type !== 'shift_codes' && uploadShiftsBtn) { uploadShiftsBtn.remove(); uploadShiftsBtn = null; }

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

    } else if (type === 'shift_codes' || type === 'profiles') {
        const isProfile = type === 'profiles';

        // Button A: Import Master / Shifts
        if (!uploadShiftsBtn) {
            uploadShiftsBtn = document.createElement('button');
            uploadShiftsBtn.id = uploadShiftsId;
            uploadShiftsBtn.className = 'btn';
            uploadShiftsBtn.style.width = 'auto';
            uploadShiftsBtn.style.padding = '0.5rem 1rem';
            uploadShiftsBtn.style.marginRight = '10px';
            uploadShiftsBtn.style.background = '#10b981'; // Green
            uploadShiftsBtn.innerHTML = `<i class="fas fa-file-excel"></i> Importar ${isProfile ? 'Usuarios' : 'Turnos'}`;

            // Hidden File Input
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.id = isProfile ? 'user-master-upload-input' : 'shift-upload-input';
            fileInput.accept = '.xlsx, .xls';
            fileInput.style.display = 'none';
            fileInput.onchange = isProfile ? handleUserMasterUpload : handleShiftUpload;
            document.body.appendChild(fileInput);

            uploadShiftsBtn.onclick = () => document.getElementById(isProfile ? 'user-master-upload-input' : 'shift-upload-input').click();

            const addBtn = crudHeader.querySelector('button');
            crudHeader.insertBefore(uploadShiftsBtn, addBtn);
        }

        // Button B: Import Daily Report (Only for Profiles)
        if (isProfile) {
            let dailyBtn = document.getElementById('btn-daily-report');
            if (!dailyBtn) {
                dailyBtn = document.createElement('button');
                dailyBtn.id = 'btn-daily-report';
                dailyBtn.className = 'btn';
                dailyBtn.style.width = 'auto';
                dailyBtn.style.padding = '0.5rem 1rem';
                dailyBtn.style.marginRight = '10px';
                dailyBtn.style.background = '#8b5cf6'; // Violet
                dailyBtn.innerHTML = `<i class="fas fa-calendar-check"></i> Reporte Diario`;

                // Hidden File Input
                const fileInput2 = document.createElement('input');
                fileInput2.type = 'file';
                fileInput2.id = 'daily-report-upload-input';
                fileInput2.accept = '.xlsx, .xls';
                fileInput2.style.display = 'none';
                fileInput2.onchange = handleDailyReportUpload;
                document.body.appendChild(fileInput2);

                dailyBtn.onclick = () => document.getElementById('daily-report-upload-input').click();

                const addBtn = crudHeader.querySelector('button');
                crudHeader.insertBefore(dailyBtn, addBtn);
            }
        }
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

    // Adjust Grid/Layout
    if (type === 'airlines') {
        container.style.display = 'grid';
        container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
    } else if (type === 'shift_codes') {
        // EXCEL LIKE TABLE VIEW
        container.style.display = 'block';
        container.style.overflowX = 'auto';
    } else {
        container.style.display = 'grid';
        container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(240px, 1fr))';
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

    // --- RENDER TABLE FOR SHIFT CODES ---
    if (type === 'shift_codes') {
        const table = document.createElement('table');
        table.className = 'modern-table'; // Use class for reusability if we add CSS, for now we inline style mostly
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.background = 'var(--bg-card)'; // Theme aware
        table.style.color = 'var(--text-color)';
        table.style.fontSize = '0.85rem';
        table.style.fontFamily = "'Outfit', sans-serif";
        table.style.borderRadius = '12px';
        table.style.overflow = 'hidden';
        table.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';

        const isDark = document.body.getAttribute('data-theme') === 'dark'; // Simple check, or rely on css vars

        table.innerHTML = `
            <thead style="background: var(--primary-color); color: white;">
                <tr>
                    <th style="padding:12px 16px; text-align:left; font-weight:600;">CÓDIGO</th>
                    <th style="padding:12px 16px; text-align:center; font-weight:600;">CAT</th>
                    <th style="padding:12px 16px; text-align:center; font-weight:600;">INICIO</th>
                    <th style="padding:12px 16px; text-align:center; font-weight:600;">FIN</th>
                    <th style="padding:12px 16px; text-align:center; font-weight:600;">TIPO</th>
                    <th style="padding:12px 16px; text-align:center; font-weight:600;">ACCIONES</th>
                </tr>
            </thead>
            <tbody style="font-weight: 500;"></tbody>
        `;

        const tbody = table.querySelector('tbody');

        data.forEach(item => {
            const safeItem = encodeURIComponent(JSON.stringify(item));
            const tr = document.createElement('tr');

            // Modern Color Coding
            let catColor = '#6b7280'; // gray default
            let catBg = 'rgba(107, 114, 128, 0.1)';

            if (['L', 'LI', 'LM', 'V', 'AU'].includes(item.category)) {
                catColor = '#10b981'; // Green
                catBg = 'rgba(16, 185, 129, 0.1)';
            }
            else if (['N'].includes(item.category)) {
                catColor = '#3b82f6'; // Blue
                catBg = 'rgba(59, 130, 246, 0.1)';
            }
            else if (['M'].includes(item.category)) {
                catColor = '#f59e0b'; // Amber
                catBg = 'rgba(245, 158, 11, 0.1)';
            }
            else if (['T'].includes(item.category)) {
                catColor = '#ef4444'; // Red-ish for afternoon heat? Or just styling
                catBg = 'rgba(239, 68, 68, 0.1)';
            }

            tr.style.borderBottom = '1px solid var(--border-color, #e5e7eb)';
            tr.style.transition = 'background 0.2s';
            tr.onmouseover = () => tr.style.background = 'var(--bg-hover, rgba(0,0,0,0.02))';
            tr.onmouseout = () => tr.style.background = 'transparent';

            tr.innerHTML = `
                <td style="padding:12px 16px;">
                    <span style="font-weight: 800; color: var(--text-color);">${item.name}</span>
                </td>
                <td style="padding:12px 16px; text-align:center;">
                    <span style="background:${catBg}; color:${catColor}; padding: 4px 10px; border-radius: 99px; font-size: 0.75rem; font-weight: 700;">${item.category}</span>
                </td>
                <td style="padding:12px 16px; text-align:center; opacity: 0.8;">${item.start_time ? item.start_time.substring(0, 5) : '-'}</td>
                <td style="padding:12px 16px; text-align:center; opacity: 0.8;">${item.end_time ? item.end_time.substring(0, 5) : '-'}</td>
                <td style="padding:12px 16px; text-align:center; text-transform:capitalize; font-size:0.8rem; opacity: 0.7;">${item.type || 'Turno'}</td>
                <td style="padding:12px 16px;">
                    <div style="display:flex; justify-content:center; gap:8px;">
                        <button onclick="openCrudModal('${safeItem}')" class="btn-icon" style="background:var(--primary-light, #e0e7ff); color:var(--primary-color); width:32px; height:32px; border-radius:8px; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; transition: all 0.2s;">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteSetting('${item.id}')" class="btn-icon" style="background:#fee2e2; color:#ef4444; width:32px; height:32px; border-radius:8px; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; transition: all 0.2s;">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        container.appendChild(table);
        return; // Stop here for shift_codes
    }

    // --- RENDER CARDS FOR OTHERS ---
    data.forEach(item => {
        const safeItem = encodeURIComponent(JSON.stringify(item));

        if (type === 'airlines') {
            // ... (Existing Airline Card Logic)
            // SPECIAL COMPACT AIRLINE CARD WITH BACKGROUND
            const card = document.createElement('div');
            card.className = 'airline-card hover-scale';
            const bgImage = item.logo_url ? `url('${item.logo_url}')` : 'none';

            // User requested: Smaller cards, Logo as background.
            // visual: White card, contained logo, floating actions and name.
            card.style.cssText = `
                position: relative;
                height: 100px; 
                background: #ffffff ${bgImage} center/ 80% auto no-repeat;
                border-radius: 16px;
                padding: 0.5rem;
                display: flex;
                flex-direction: column;
                justify-content: flex-end;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                border: 1px solid rgba(0,0,0,0.1);
                overflow: hidden;
            `;

            card.innerHTML = `
                <div style="position: absolute; top: 8px; right: 8px; display: flex; gap: 4px;">
                    <button onclick="openCrudModal('${safeItem}')" style="background: rgba(99, 102, 241, 0.9); border: none; color: white; border-radius: 6px; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-edit" style="font-size: 0.7rem;"></i>
                    </button>
                    <button onclick="deleteSetting('${item.id}')" style="background: rgba(239, 68, 68, 0.9); border: none; color: white; border-radius: 6px; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-trash-alt" style="font-size: 0.7rem;"></i>
                    </button>
                </div>
                
                <div style="background: rgba(0,0,0,0.75); backdrop-filter: blur(2px); border-radius: 8px; padding: 4px 8px; display: flex; align-items: center; justify-content: space-between;">
                    <span style="font-weight: 700; color: white; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name || 'Sin Nombre'}</span>
                    <span style="font-size: 0.7rem; color: #fbbf24; font-weight: 800; margin-left: 5px;">${item.iata_code || ''}</span>
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
                    'asset_categories': 'fa-tags',
                    'shift_codes': 'fa-clock'
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
                    ${config.isShift ? `
                    <div class="card-info-item">
                        <span class="info-label">Categoría</span>
                        <span class="info-value">${item.category || '-'}</span>
                    </div>
                    ${item.start_time ? `
                    <div class="card-info-item">
                        <span class="info-label">Horario</span>
                        <span class="info-value">${item.start_time?.substring(0, 5)} - ${item.end_time?.substring(0, 5)}</span>
                    </div>` : ''}` : ''}
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

    // Shift Code Fields (Dynamic Inject if not exists)
    let shiftTimeField = document.getElementById('crud-shift-time-field');
    if (!shiftTimeField) {
        // Create if missing (lazy inject)
        const div = document.createElement('div');
        div.id = 'crud-shift-time-field';
        div.className = 'form-group';
        div.style.marginBottom = '1rem';
        div.style.display = 'none';
        div.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
                <div>
                    <label style="font-weight: bold; display: block; margin-bottom: 0.5rem;">Hora Inicio</label>
                    <input type="time" id="crud-shift-start" class="input-style" style="border: 1px solid #ccc;">
                </div>
                <div>
                    <label style="font-weight: bold; display: block; margin-bottom: 0.5rem;">Hora Fin</label>
                    <input type="time" id="crud-shift-end" class="input-style" style="border: 1px solid #ccc;">
                </div>
            </div>
            <div style="margin-top:1rem;">
                <label style="font-weight: bold; display: block; margin-bottom: 0.5rem;">Categoría</label>
                <select id="crud-shift-cat" class="input-style" style="border: 1px solid #ccc;">
                    <option value="M">Mañana (M)</option>
                    <option value="T">Tarde (T)</option>
                    <option value="N">Noche (N)</option>
                    <option value="S">Saliente (S)</option>
                    <option value="CU">Curso (CU)</option>
                    <option value="L">Libre (L)</option>
                    <option value="AU">Ausente (AU)</option>
                    <option value="V">Vacaciones (V)</option>
                    <option value="LM">Licencia Médica (LM)</option>
                </select>
            </div>
        `;
        const form = document.getElementById('crud-form');
        const appendTarget = document.getElementById('crud-extra-field'); // Insert after this
        form.insertBefore(div, appendTarget ? appendTarget.nextSibling : form.firstChild);
        shiftTimeField = div;
    }
    const shiftStart = document.getElementById('crud-shift-start');
    const shiftEnd = document.getElementById('crud-shift-end');
    const shiftCat = document.getElementById('crud-shift-cat');

    extraField.style.display = 'none';
    extraInput.required = false;
    if (logoField) logoField.style.display = 'none';
    if (logoPreview) logoPreview.style.display = 'none';
    if (assetTypeField) assetTypeField.style.display = 'none';
    if (qrField) qrField.style.display = 'none';
    if (qrPreview) qrPreview.style.display = 'none';
    if (assetStatusField) assetStatusField.style.display = 'none';
    if (quantityField) quantityField.style.display = 'none';
    if (shiftTimeField) shiftTimeField.style.display = 'none';

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
    } else if (config.isShift) {
        document.getElementById('modal-title').textContent = 'Gestionar Código de Turno';
        document.getElementById('crud-name').placeholder = 'Ej: M0817, N2008CU, LI';
        if (shiftTimeField) shiftTimeField.style.display = 'block';

        // Auto-Fill Listener
        const nameInput = document.getElementById('crud-name');
        nameInput.oninput = (e) => {
            const val = e.target.value.toUpperCase().trim();

            // 1. Check Special Codes
            // LI=Libre, S=Saliente, AU=Ausente, V=Vacaciones
            if (['LI', 'LIBRE'].includes(val)) {
                if (shiftCat) shiftCat.value = 'L';
                if (shiftStart) shiftStart.value = '';
                if (shiftEnd) shiftEnd.value = '';
                return;
            }
            if (['S', 'SALIENTE', 'SAL'].includes(val)) {
                if (shiftCat) shiftCat.value = 'S';
                // Usually has a start time? Assuming generic for now unless parsed
                return;
            }
            if (['AU', 'AUSENTE'].includes(val)) {
                if (shiftCat) shiftCat.value = 'AU';
                return;
            }
            if (['V', 'VAC', 'VACACIONES'].includes(val)) {
                if (shiftCat) shiftCat.value = 'V';
                return;
            }

            // 2. Regex for Standard Patterns: M0817, T1523
            // Group 1: Cat (M,T,N,S)
            // Group 2: StartHH
            // Group 3: StartMM (Optional, implied 00) - Actually existing regex expects explicit start/end hour pairs e.g. 0817 (08 to 17)
            // Let's match the user's example "N2008CU" -> Start 20:00, End 08:00, Cat CU? 
            // Or "M0715" -> Start 07, End 15

            // Updated Regex: ^([A-Z]+)(\d{2})(\d{2})([A-Z]*)?$
            // Example: M0715 -> M, 07, 15, undefined
            // Example: N2008CU -> N, 20, 08, CU

            const match = val.match(/^([A-Z])(\d{2})(\d{2})([A-Z]*)$/);

            if (match) {
                let cat = match[1];     // M, T, N...
                const startH = match[2]; // 07
                const endH = match[3];   // 15
                const suffix = match[4]; // CU?

                // Fix Time format
                if (shiftStart) shiftStart.value = `${startH}:00`;
                if (shiftEnd) shiftEnd.value = `${endH}:00`;

                // Logic for Category
                if (suffix === 'CU') {
                    cat = 'CU';
                }

                // Map initial char if simple
                if (shiftCat) {
                    // Normalize unknown cats to M/T/N if strict? Or select correctly
                    // Our options: M, T, N, S, CU, L, AU, V
                    if (['M', 'T', 'N', 'S'].includes(cat) && cat !== 'CU') {
                        shiftCat.value = cat;
                    }
                    if (cat === 'CU' || suffix === 'CU') {
                        shiftCat.value = 'CU';
                    }
                }
            }
        };
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

        // Shift Population
        if (config.isShift) {
            if (shiftCat) shiftCat.value = item.category || 'M';
            if (shiftStart) shiftStart.value = item.start_time || '';
            if (shiftEnd) shiftEnd.value = item.end_time || '';
        }

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

        // Shift Payload
        if (config.isShift) {
            payload.category = document.getElementById('crud-shift-cat').value;
            payload.start_time = document.getElementById('crud-shift-start').value;
            payload.end_time = document.getElementById('crud-shift-end').value;

            // Auto-detect type if special
            if (['L', 'LI', 'V', 'AU'].includes(payload.category)) {
                payload.type = 'ausencia'; // Not 'turno'
            } else {
                payload.type = 'turno';
            }
        }
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

// --- SHIFT CODE BULK UPLOAD EXCEL LOGIC ---
window.handleShiftUpload = function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON (Header: 1 assumes 0-index based array of arrays)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        processShiftExcelData(jsonData);
    };
    reader.readAsArrayBuffer(file);
    // Reset inputs
    e.target.value = '';
};

async function processShiftExcelData(rows) {
    if (!rows || rows.length === 0) {
        alert("El archivo parece vacío.");
        return;
    }

    const payloads = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 1) continue;

        let code = (row[0] || '').toString().trim().toUpperCase();
        if (!code || code === 'CODIGO' || code === 'CODE' || code.includes('CODIGO')) continue; // Skip header

        let startRaw = row[1]; // Col B
        let endRaw = row[2];   // Col C

        // Excel Time Parsing Helper
        const formatTime = (val) => {
            if (!val) return null;
            if (typeof val === 'number') {
                // Excel fraction day
                const totalMinutes = Math.round(val * 24 * 60);
                const h = Math.floor(totalMinutes / 60);
                const m = totalMinutes % 60;
                return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            }
            const s = String(val).trim();
            if (s.match(/^\d{1,2}:\d{2}$/)) return s.padStart(5, '0');
            if (s.match(/^\d{1,2}:\d{2}:\d{2}$/)) return s.substring(0, 5).padStart(5, '0');
            return null;
        };

        const startTime = formatTime(startRaw);
        const endTime = formatTime(endRaw);

        // Heuristics
        let category = 'M'; // Default
        let type = 'turno';

        if (['LI', 'LIBRE'].includes(code)) { category = 'L'; type = 'ausencia'; }
        else if (['S', 'SALIENTE', 'SAL'].includes(code)) { category = 'S'; type = 'turno'; }
        else if (['AU', 'AUSENTE'].includes(code)) { category = 'AU'; type = 'ausencia'; }
        else if (['V', 'VAC', 'VACACIONES'].includes(code)) { category = 'V'; type = 'ausencia'; }
        else if (['LM', 'LICENCIA'].includes(code)) { category = 'LM'; type = 'ausencia'; }
        else {
            const match = code.match(/^([A-Z])(\d{2})(\d{2})([A-Z]*)$/);
            if (match) {
                let catChar = match[1];
                const suffix = match[4];
                if (suffix === 'CU') { category = 'CU'; type = 'turno'; }
                else if (['M', 'T', 'N'].includes(catChar)) category = catChar;
            } else {
                if (code.startsWith('M')) category = 'M';
                else if (code.startsWith('T')) category = 'T';
                else if (code.startsWith('N')) category = 'N';
                else if (code.includes('CURSO')) category = 'CU';
            }
        }

        const payload = {
            name: code,
            category: category,
            type: type,
            start_time: startTime,
            end_time: endTime
        };
        payloads.push(payload);
    }

    if (payloads.length === 0) {
        alert("No se encontraron turnos válidos para importar.");
        return;
    }

    const { data, error } = await supabase.from('shift_codes').upsert(payloads, { onConflict: 'name' });

    if (error) {
        console.error("Upload Error:", error);
        alert("Error al importar: " + error.message);
    } else {
        alert(`Se importaron ${payloads.length} códigos de turno exitosamente.`);
        loadSettingTable('shift_codes');
    }
}

// Auto load default if switched to settings (can be hooked into switchTab or init)
// Added hook in switchTab

// --- USER MASTER UPLOAD EXCEL LOGIC ---
window.handleUserMasterUpload = function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON (Header: 1 assumes 0-index based array of arrays)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        processUserMasterExcel(jsonData);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // Reset
};

async function processUserMasterExcel(rows) {
    if (!rows || rows.length === 0) {
        alert("El archivo parece vacío.");
        return;
    }

    // 1. Fetch ALL existing profiles with fields key for matching
    const { data: existingProfiles, error: pfError } = await supabase
        .from('profiles')
        .select('id, rut, email, username, full_name');

    if (pfError) {
        console.error("Error fetching profiles:", pfError);
        alert("Error verificando usuarios existentes: " + pfError.message);
        return;
    }

    // 2. Build Index Maps for fast lookup
    const mapByRut = {};
    const mapByEmail = {};
    const mapByUsername = {};
    const mapByName = {}; // Normalized name -> ID

    // Normalizer helper
    const normalize = (str) => String(str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const cleanRut = (r) => String(r || '').replace(/[^0-9kK]/g, '').toUpperCase();
    const cleanStr = (s) => s ? String(s).trim() : '';

    existingProfiles.forEach(p => {
        if (p.rut) mapByRut[cleanRut(p.rut)] = p.id;
        if (p.email) mapByEmail[p.email.toLowerCase().trim()] = p.id;
        if (p.username) mapByUsername[p.username.toLowerCase().trim()] = p.id;
        if (p.full_name) mapByName[normalize(p.full_name)] = p.id;
    });

    const predataList = [];
    const profilesUpdates = [];
    let updatedCount = 0;
    let predataCount = 0;

    // Stats for report
    const matchesFound = {
        scan_rut: 0,
        scan_email: 0,
        scan_username: 0,
        scan_name: 0
    };

    // Loop rows (Skip header)
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 1) continue;

        // Check if header
        const firstCell = String(row[0] || '').toUpperCase();
        if (firstCell.includes('RUT') || firstCell === 'A') continue;

        // Parse Excel Columns
        const rawRut = row[0];
        const rut = cleanRut(rawRut); // Key for Predata

        // Names
        const colB_ApellidosNombres = row[1];
        const colC_NombresApellidos = row[2];
        const colD_FirstName = cleanStr(row[3]);
        const colE_MiddleName = cleanStr(row[4]);
        const colF_LastName1 = cleanStr(row[5]);
        const colG_LastName2 = cleanStr(row[6]);

        // Construct a clean Full Name for display/legacy
        let finalFullName = cleanStr(colC_NombresApellidos);
        if (!finalFullName && colD_FirstName) {
            finalFullName = `${colD_FirstName} ${colE_MiddleName} ${colF_LastName1} ${colG_LastName2}`.replace(/\s+/g, ' ').trim();
        }

        const username = cleanStr(row[7]);
        const email = cleanStr(row[8]);
        const phone = cleanStr(row[9]);

        // Address
        const addrStreet = cleanStr(row[10]);
        const addrNumber = cleanStr(row[11]);
        const addrUnit = cleanStr(row[12]);
        const commune = cleanStr(row[13]);
        const fullAddress = `${addrStreet} #${addrNumber || 'S/N'} ${addrUnit}`.trim();

        // Extra
        const rawTica = cleanStr(row[14]).toUpperCase();
        let ticaStatus = 'no_tiene';
        if (rawTica.includes('VIGENTE')) ticaStatus = 'vigente';
        else if (rawTica.includes('VENCIDA')) ticaStatus = 'vencida';
        else if (rawTica.includes('POR VENCER')) ticaStatus = 'por_vencer';
        else if (rawTica.includes('SIN')) ticaStatus = 'no_tiene';

        const isTrue = (val) => {
            if (!val) return false;
            const s = String(val).toUpperCase();
            return s === 'SI' || s === 'YES' || s === 'X' || s.includes('APROBADO') || s.includes('REALIZADO') || s === '1' || s === 'TRUE';
        };
        const courseGolf = isTrue(row[15]);
        const courseDuplex = isTrue(row[16]);
        const courseOruga = isTrue(row[17]);

        // OBJECT CONSTRUCTION (Common for both Profile and Predata)
        const userData = {
            // Include RUT in update only if it was missing? Or force update? 
            // Force update ensures profile has correct RUT from Master File.
            rut: rut.length >= 5 ? rut : undefined,
            username: username || undefined,
            full_name: finalFullName,
            first_name: colD_FirstName,
            middle_name: colE_MiddleName,
            last_name_1: colF_LastName1,
            last_name_2: colG_LastName2,
            email: email || undefined, // Be careful not to wipe existing emails if excel is empty?
            phone: phone,
            address: fullAddress,
            address_street: addrStreet,
            address_number: addrNumber,
            address_unit: addrUnit,
            commune: commune,
            tica_status: ticaStatus,
            course_golf: courseGolf,
            course_duplex: courseDuplex,
            course_oruga: courseOruga
        };

        // Clean undefined keys
        Object.keys(userData).forEach(key => userData[key] === undefined && delete userData[key]);

        // 1. ADD TO PREDATA (Always, keyed by RUT)
        if (rut && rut.length >= 5) {
            predataList.push({ ...userData, rut: rut }); // Ensure RUT is set for predata
        }

        // 2. MATCH WITH EXISTING PROFILE
        let matchId = null;

        // Strategy A: Direct RUT Match (Most Reliable)
        if (rut && mapByRut[rut]) {
            matchId = mapByRut[rut];
            matchesFound.scan_rut++;
        }

        // Strategy B: Email Match
        if (!matchId && email && mapByEmail[email.toLowerCase().trim()]) {
            matchId = mapByEmail[email.toLowerCase().trim()];
            matchesFound.scan_email++;
        }

        // Strategy C: Username Match
        if (!matchId && username && mapByUsername[username.toLowerCase().trim()]) {
            matchId = mapByUsername[username.toLowerCase().trim()];
            matchesFound.scan_username++;
        }

        // Strategy D: Name Match (Normalized)
        if (!matchId) {
            const norm1 = normalize(colC_NombresApellidos); // "Nombres Apellidos"
            const norm2 = normalize(colB_ApellidosNombres); // "Apellidos Nombres"

            if (norm1 && mapByName[norm1]) {
                matchId = mapByName[norm1];
                matchesFound.scan_name++;
            } else if (norm2 && mapByName[norm2]) {
                matchId = mapByName[norm2];
                matchesFound.scan_name++;
            }
        }

        // Add to Profile Updates if Match Found
        if (matchId) {
            profilesUpdates.push({
                id: matchId,
                ...userData
            });
        }
    }

    // BATCH OPS
    // 1. Upsert Agent Predata
    if (predataList.length > 0) {
        const { error: preError } = await supabase
            .from('agent_predata')
            .upsert(predataList, { onConflict: 'rut' });

        if (preError) {
            console.error("Error upserting predata:", preError);
            alert("Hubo errores guardando datos de pre-match.");
        } else {
            predataCount = predataList.length;
        }
    }

    // 2. Update Profiles
    if (profilesUpdates.length > 0) {
        const { error: profError } = await supabase
            .from('profiles')
            .upsert(profilesUpdates, { onConflict: 'id' });

        if (profError) {
            console.error("Error updating profiles:", profError);
            alert("Hubo errores actualizando perfiles existentes.");
        } else {
            updatedCount = profilesUpdates.length;
        }
    }

    alert(`Proceso Terminado 🤖\n\n` +
        `Datos Nuevos Cargados (Predata): ${predataCount}\n` +
        `Perfiles Existentes Actualizados: ${updatedCount}\n\n` +
        `- Por RUT: ${matchesFound.scan_rut}\n` +
        `- Por Email: ${matchesFound.scan_email}\n` +
        `- Por Usuario: ${matchesFound.scan_username}\n` +
        `- Por Nombre: ${matchesFound.scan_name}`);

    // Refresh
    if (typeof window.loadSettingTable === 'function') {
        if (currentSettingsType === 'profiles') loadSettingTable('profiles');
    }
}

// --- DAILY REPORT UPLOAD (TICA + ATTENDANCE) ---
window.handleDailyReportUpload = function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON (Header: 1 assumes 0-index based array of arrays)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        processDailyReportExcel(jsonData);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // Reset
};

async function processDailyReportExcel(rows) {
    if (!rows || rows.length === 0) {
        alert("El archivo parece vacío.");
        return;
    }

    // 1. Fetch matching data
    const { data: existingProfiles, error: pfError } = await supabase
        .from('profiles')
        .select('id, rut, full_name, username, email');

    if (pfError) {
        alert("Error cargando perfiles: " + pfError.message);
        return;
    }

    // 2. Build Maps
    const mapByRut = {};
    const mapByName = {};
    const cleanRut = (r) => String(r || '').replace(/[^0-9kK]/g, '').toUpperCase();
    const normalize = (str) => String(str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

    existingProfiles.forEach(p => {
        if (p.rut) mapByRut[cleanRut(p.rut)] = p;
        if (p.full_name) mapByName[normalize(p.full_name)] = p;
        if (p.username) mapByName[normalize(p.username)] = p; // Fallback
    });

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const proUpdates = [];
    const attUpserts = [];
    let processedCount = 0;
    let notFoundCount = 0;

    // Loop Rows
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 1) continue;

        // Skip Header heuristics
        const cell0 = String(row[0] || '').toUpperCase();
        if (cell0.includes('NOMBRE') || cell0.includes('AGENTE')) continue;

        // Match Logic
        let matchedProfile = null;
        const potentials = row.map(c => String(c).trim());

        // Try to find profile
        for (const val of potentials) {
            // Try RUT
            const asRut = cleanRut(val);
            if (asRut.length > 5 && mapByRut[asRut]) {
                matchedProfile = mapByRut[asRut];
                break;
            }
            // Try Name
            const asName = normalize(val);
            if (asName.length > 4 && mapByName[asName]) {
                matchedProfile = mapByName[asName];
                break;
            }
        }

        if (!matchedProfile) {
            notFoundCount++;
            continue;
        }

        const rowStr = potentials.join(' ').toUpperCase();

        // 1. TICA Parsing
        let ticaStatus = null;
        if (rowStr.includes('VIGENTE') || rowStr.includes('CON TICA')) ticaStatus = 'vigente';
        else if (rowStr.includes('VENCIDA') || rowStr.includes('CADUCADA')) ticaStatus = 'vencida';
        else if (rowStr.includes('POR VENCER')) ticaStatus = 'por_vencer';
        else if (rowStr.includes('SIN TICA') || rowStr.includes('NO TIENE')) ticaStatus = 'no_tiene';

        if (ticaStatus) {
            proUpdates.push({
                id: matchedProfile.id,
                tica_status: ticaStatus
            });
        }

        // 2. Attendance Parsing
        let attendanceStatus = 'presente'; // Default
        if (rowStr.includes('AUSENTE') || rowStr.includes('FALTA')) attendanceStatus = 'ausente';
        else if (rowStr.includes('LICENCIA') || rowStr.includes('MEDICA')) attendanceStatus = 'licencia';
        else if (rowStr.includes('LIBRE')) attendanceStatus = 'libre';
        else if (rowStr.includes('PRESENTE') || rowStr.includes('ASISTE')) attendanceStatus = 'presente';

        // Map libre to ausente for DB consistency or keep if DB allows
        // Check DB: attendance_status IN ('pending', 'presente', 'ausente', 'licencia')
        if (attendanceStatus === 'libre') attendanceStatus = 'ausente';

        attUpserts.push({
            user_id: matchedProfile.id,
            rut: matchedProfile.rut,
            user_name: matchedProfile.full_name,
            shift_date: today,
            attendance_status: attendanceStatus,
            observation: rowStr.includes('OBS:') ? 'LEER NOTA' : 'SIN OBS',
            updated_at: new Date().toISOString()
        });

        processedCount++;
    }

    // Execute Updates
    if (proUpdates.length > 0) {
        const uniquePro = {};
        proUpdates.forEach(u => uniquePro[u.id] = u);
        const { error } = await supabase.from('profiles').upsert(Object.values(uniquePro), { onConflict: 'id' });
        if (error) console.error("Error updating TICA:", error);
    }

    if (attUpserts.length > 0) {
        const { error } = await supabase.from('attendance').upsert(attUpserts, { onConflict: 'rut, shift_date' });
        if (error) {
            console.error("Error updating Attendance:", error);
            alert("Error guardando asistencia: " + error.message);
        }
    }

    alert(`Reporte Diario Procesado 📅\n\nRegistros Procesados: ${processedCount}\nUsuarios No Encontrados: ${notFoundCount}\n\nTICA y Asistencia actualizadas para hoy.`);

    // Refresh
    if (typeof window.loadSettingTable === 'function') loadSettingTable('profiles');
}
