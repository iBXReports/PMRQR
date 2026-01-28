
import { supabase } from './client.js';
import { showError, showSuccess } from './common.js';

// DOM Elements
const viewScan = document.getElementById('view-scan');
const viewFormStart = document.getElementById('view-form-start');
const viewTimer = document.getElementById('view-timer');
const viewFormEnd = document.getElementById('view-form-end');
const viewReport = document.getElementById('view-report');
const loader = document.getElementById('loader');

const timerDisplay = document.getElementById('timer');
const timerProgress = document.getElementById('timer-progress');
const destSelect = document.getElementById('destination-select');
const bridgeSelect = document.getElementById('bridge-select');
const gateSelect = document.getElementById('gate-select');
const flightInfoSection = document.getElementById('flight-info-section');

// State
let currentUser = null;
let userProfile = null; // Store full profile including role/team
let currentOperationId = null;
let timerInterval = null;

async function init() {
    // 1. Auth Check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = session.user;

    // Fetch Extended Profile (Role, Team)
    await fetchUserProfile();

    // 2. Check for Active Operation
    await checkActiveOperation();

    // 3. Listeners
    window.addEventListener('qr-scanned', handleAssetScan);
    window.addEventListener('qr-return-scanned', handleReturnScan);

    document.getElementById('start-form').addEventListener('submit', startOperation);
    document.getElementById('end-form').addEventListener('submit', endOperation);

    const btnBackScan = document.getElementById('btn-back-scan');
    if (btnBackScan) btnBackScan.addEventListener('click', handleBack);

    // Flight Logic
    if (destSelect) destSelect.addEventListener('change', handleDestinationChange);
    if (bridgeSelect) bridgeSelect.addEventListener('change', handleBridgeChange);

    const endContext = document.getElementById('input-end-point');
    const endTerminal = document.getElementById('end-terminal');
    const endBridge = document.getElementById('end-bridge-select');

    if (endContext) endContext.addEventListener('change', handleEndLocationChange);
    if (endTerminal) endTerminal.addEventListener('change', handleEndLocationChange);
    if (endBridge) endBridge.addEventListener('change', handleEndBridgeChange);

    // Report Logic
    const reportContext = document.getElementById('report-context');
    const reportTerminal = document.getElementById('report-terminal');
    const reportAssetType = document.getElementById('report-asset-type');

    if (reportContext) reportContext.addEventListener('change', handleReportLocationChange);
    if (reportTerminal) reportTerminal.addEventListener('change', handleReportLocationChange);
    if (reportAssetType) reportAssetType.addEventListener('change', handleReportTypeChange);
    const reportForm = document.getElementById('report-form');
    if (reportForm) reportForm.addEventListener('submit', submitReport);

    window.openReportManual = openReportManual;

    // Initial check for URL params
    const urlParams = new URLSearchParams(window.location.search);
    const sillaParam = urlParams.get('silla') || urlParams.get('asset');

    if (sillaParam) {
        if (sillaParam.startsWith('INICIO')) {
            const code = sillaParam.replace('INICIO', '');
            handleAssetScan({ detail: code });
        } else if (sillaParam.startsWith('DEVOL')) {
            const code = sillaParam.replace('DEVOL', '');
            handleAssetScan({ detail: code }, true);
        } else {
            handleAssetScan({ detail: sillaParam });
        }
    }
}

async function fetchUserProfile() {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (data) {
            userProfile = data;
            // Update Nav with Avatar
            const userNavContainer = document.querySelector('.nav-links');
            const avatarUrl = data.avatar_url || 'https://via.placeholder.com/30';

            // Apply Flex Styles to Parent
            userNavContainer.style.display = 'flex';
            userNavContainer.style.alignItems = 'center';
            userNavContainer.style.gap = '15px';

            const currentTheme = document.body.getAttribute('data-theme') || 'light';
            const themeEmoji = currentTheme === 'dark' ? '☀️' : '🌙';

            const isAdminRole = ['CDO', 'Supervisor', 'Jefe', 'Admin'].includes(data.role);
            const adminBtn = isAdminRole ? `
                <a href="admin/admin.html" style="text-decoration: none;">
                    <button style="background: linear-gradient(135deg, var(--primary-color), var(--accent-color)); color: white; border: none; padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 5px; box-shadow: 0 4px 10px rgba(99, 102, 241, 0.3);">
                        🛡️ Admin
                    </button>
                </a>
            ` : '';

            userNavContainer.innerHTML = `
                <button id="theme-toggle" class="theme-toggle" style="margin:0;">${themeEmoji}</button>
                ${adminBtn}
                <a href="profile.html" style="display: flex; align-items: center; gap: 8px; text-decoration: none; color: var(--text-color); background: rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 20px;">
                    <img src="${avatarUrl}" style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--primary-color); object-fit: cover;">
                    <span style="font-weight: 600;">${data.username || 'Agente'}</span>
                </a>

                <button id="logout-btn-nav" style="background: transparent; border: 1px solid var(--secondary-color); color: var(--secondary-color); padding: 5px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; margin:0;">Salir</button>
            `;

            // Re-attach listeners
            document.getElementById('logout-btn-nav').addEventListener('click', async () => {
                await supabase.auth.signOut();
                window.location.href = 'login.html';
            });
        }
    } catch (e) {
        console.error("Profile fetch error", e);
    }
}

function handleDestinationChange(e) {
    const val = e.target.value;
    const flightDestinations = ['Embarque', 'Arribo', 'Remoto'];

    if (flightDestinations.includes(val)) {
        flightInfoSection.classList.remove('hidden');
        // Add REQUIRED attributes when visible
        document.querySelector('[name="bridge"]').setAttribute('required', 'true');
        document.querySelector('[name="airline"]').setAttribute('required', 'true');
        document.querySelector('[name="flight_number"]').setAttribute('required', 'true');

        // Re-trigger gate update if bridge is already selected
        if (bridgeSelect && bridgeSelect.value) {
            handleBridgeChange({ target: bridgeSelect });
        }
    } else {
        flightInfoSection.classList.add('hidden');
        document.querySelector('[name="bridge"]').removeAttribute('required');
        document.querySelector('[name="airline"]').removeAttribute('required');
        document.querySelector('[name="flight_number"]').removeAttribute('required');
    }
}

// --- VIEW MANAGEMENT ---
function showView(viewId) {
    // Hide all
    [viewScan, viewFormStart, viewTimer, viewFormEnd, viewReport].forEach(el => {
        if (el) el.classList.add('hidden');
    });
    // Show one
    const target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');
}
window.showView = showView;

async function handleBridgeChange(e) {
    const bridge = e.target.value;
    const destination = destSelect.value;
    if (!gateSelect) return;

    // Reset gates
    gateSelect.innerHTML = '<option value="">Cargando...</option>';

    if (!bridge || !destination) {
        gateSelect.innerHTML = '<option value="">Seleccione primero destino y puente...</option>';
        return;
    }

    // Update Label based on destination
    const gateLabel = document.querySelector('#gate-selection-group label');
    const isArrival = destination === 'Arribo';
    if (gateLabel) {
        gateLabel.textContent = isArrival ? '🚪 Gate Arribo' : '🚪 Gate Salida';
    }

    // Extract letter (A, B, C, D, E, F)
    const letter = bridge.split(' ').pop();

    // Try to fetch from DB first (since it's managed in Admin)
    const dbType = isArrival ? 'gate_arrival' : 'gate';
    const { data: dbGates, error } = await supabase
        .from('locations')
        .select('name')
        .eq('type', dbType)
        .ilike('name', `${letter}%`)
        .order('name');

    gateSelect.innerHTML = '<option value="">Seleccione Gate...</option>';

    if (dbGates && dbGates.length > 0) {
        dbGates.forEach(g => {
            const option = document.createElement('option');
            option.value = g.name;
            option.textContent = g.name;
            gateSelect.appendChild(option);
        });
    } else {
        // Fallback generator if DB is empty
        const config = {
            'A': { start: 1, end: 10 },
            'B': { start: 1, end: 12 },
            'C': { start: 1, end: 11 },
            'D': { start: 1, end: 10 },
            'E': { start: 1, end: 15 },
            'F': { start: 1, end: 15 }
        };

        const range = config[letter];
        if (range) {
            for (let i = range.start; i <= range.end; i++) {
                const gateNum = i.toString().padStart(2, '0');
                const gateVal = `${letter}${gateNum}`;
                const option = document.createElement('option');
                option.value = gateVal;
                option.textContent = gateVal;
                gateSelect.appendChild(option);
            }
        } else {
            const option = document.createElement('option');
            option.value = "N/A";
            option.textContent = "Sin gates para esta letra";
            gateSelect.appendChild(option);
        }
    }
}

function handleBack() {
    // Reset form
    const startForm = document.getElementById('start-form');
    if (startForm) startForm.reset();

    // Hide flight info if open
    if (flightInfoSection) flightInfoSection.classList.add('hidden');

    // Go to scan
    showView('view-scan');
}

// --- START OPERATION ---
// --- HANDLE SMART QR SCAN ---
async function handleAssetScan(e, forceReturn = false) {
    let code = typeof e.detail === 'object' ? e.detail.code : e.detail;
    const target = typeof e.detail === 'object' ? e.detail.target : 'asset';

    // --- FIX: Parse URL if scanned ---
    if (code && (code.startsWith('http://') || code.startsWith('https://'))) {
        try {
            const urlObj = new URL(code);
            const params = new URLSearchParams(urlObj.search);
            const extracted = params.get('silla') || params.get('asset');
            if (extracted) {
                code = extracted;
            }
        } catch (err) {
            console.warn("Could not parse scanned URL, using raw text:", code);
        }
    }

    if (loader) loader.classList.remove('hidden');

    try {
        // --- REPORT MODE ---
        if (target === 'report') {
            await openReportManual(code);
            return;
        }

        // 1. If forceReturn is true, we try to find an active operation for this asset
        if (forceReturn) {
            const { data: activeOp, error: opErr } = await supabase
                .from('operations')
                .select('id')
                .eq('status', 'active')
                .eq('user_id', currentUser.id)
                .is('end_time', null)
                .single(); // You can only have one active op at a time

            if (activeOp) {
                currentOperationId = activeOp.id;
                handleReturnScan({ detail: code });
                return;
            } else {
                showError("No tienes una operación activa para este equipo.");
                showView('view-scan');
                return;
            }
        }

        // 2. Check if we already have a local active op (fast path)
        if (currentOperationId) {
            showView('view-timer');
            if (loader) loader.classList.add('hidden');
            return;
        }

        // 2. Check Asset Status in DB
        const { data: asset, error } = await supabase
            .from('assets')
            .select('id, status, type')
            .eq('code', code)
            .single();

        if (!asset || error) {
            // New Asset -> Show Start Form
            document.getElementById('input-asset-code').value = code;

            // Format Display Name
            let displayName = code;

            // Try to guess from text even if not in DB
            const parts = code.split(/[-_]/);
            const number = parts.length > 1 ? parts[parts.length - 1] : '';
            const typeGuess = code.toLowerCase().includes('carrito') ? 'Carrito de Golf' :
                code.toLowerCase().includes('oruga') ? 'Silla Oruga' :
                    code.toLowerCase().includes('duplex') ? 'Carrito Duplex' : 'Equipo';

            if (number) displayName = `${typeGuess} ${number}`;

            document.getElementById('asset-code-display').textContent = displayName;
            showView('view-form-start');
            return;
        }

        // --- CERTIFICATION CHECK ---
        const specialEquip = {
            'Carrito de Golf': 'cert_golf',
            'Carrito Duplex': 'cert_duplex',
            'Silla Oruga': 'cert_oruga'
        };

        const requiredCert = specialEquip[asset.type];
        if (requiredCert && !userProfile[requiredCert]) {
            showError(`⚠️ No tienes el curso/permiso necesario para operar un **${asset.type}**.`);
            if (loader) loader.classList.add('hidden');
            return;
        }

        // 3. Logic based on Status
        if (asset.status === 'in_use') {
            // Check ownership
            const { data: operation } = await supabase
                .from('operations')
                .select('*')
                .eq('asset_id', asset.id)
                .eq('status', 'active')
                .single();

            if (operation && operation.user_id === currentUser.id) {
                // Resume User's Session
                currentOperationId = operation.id;
                startTimer(new Date(operation.start_time));
                showView('view-timer');
                showSuccess('Sesión recuperada ✅');
            } else {
                showError('⚠️ Este equipo está siendo ocupado por otro agente.');
            }
        } else {
            // Available -> Start Form
            document.getElementById('input-asset-code').value = code;

            // Format Display Name
            let displayName = code;
            if (asset && asset.type) {
                // Extract number from code if possible (e.g. SILLA-01 -> 01)
                const parts = code.split(/[-_]/);
                const number = parts.length > 1 ? parts[parts.length - 1] : '';
                displayName = `${asset.type} ${number}`;
            }

            document.getElementById('asset-code-display').textContent = displayName;
            showView('view-form-start');
        }

    } catch (err) {
        showError(err.message);
    } finally {
        loader.classList.add('hidden');
    }
}

async function startOperation(e) {
    e.preventDefault();
    loader.classList.remove('hidden');

    try {
        const formData = new FormData(e.target);

        // Resolve Asset ID
        const assetCode = formData.get('asset_code');
        const { data: asset, error: assetCheck } = await supabase.from('assets').select('id').eq('code', assetCode).single();

        let assetId = asset ? asset.id : null;
        if (!assetId) {
            // Auto Create (Sandbox mode)
            const { data: newAsset } = await supabase.from('assets').insert({
                code: assetCode, type: assetCode.includes('CARRITO') ? 'carrito' : 'silla'
            }).select().single();
            assetId = newAsset.id;
        }

        // Operation Data
        const opData = {
            user_id: currentUser.id,
            asset_id: assetId,
            start_location_type: formData.get('start_location_type'),
            start_point: formData.get('start_point'),

            // USE PROFILE DATA (Fallbacks to "Agente"/"OLA" if missing)
            team: userProfile?.team || formData.get('team') || 'OLA',
            role: userProfile?.role || 'Agente', // Enforce profile role

            destination: formData.get('destination'),

            // Flight Info (Optional)
            bridge: formData.get('bridge') || null,
            gate: formData.get('gate') || null,
            airline: formData.get('airline') || null,
            flight_number: formData.get('flight_number') || null,

            status: 'active'
        };

        const { data: op, error: opError } = await supabase.from('operations').insert(opData).select().single();
        if (opError) throw opError;

        currentOperationId = op.id;
        await supabase.from('assets').update({ status: 'in_use' }).eq('id', assetId);

        startTimer(new Date(op.start_time));
        showView('view-timer');
        showSuccess('¡Operación Iniciada! 🛫');

    } catch (err) {
        showError(err.message);
    } finally {
        loader.classList.add('hidden');
    }
}

// --- TIMER ---
// --- TIMER ---
async function checkActiveOperation() {
    // Use maybeSingle or return a list and take the first to avoid erroring if duplicates exist in DB
    const { data, error } = await supabase.from('operations')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('status', 'active')
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (data) {
        currentOperationId = data.id;
        startTimer(new Date(data.start_time));
        showView('view-timer');
    } else {
        if (error) console.error("Error checking active ops", error);
        showView('view-scan');
    }
}

function startTimer(startTime) {
    if (timerInterval) clearInterval(timerInterval);
    const DURATION_MS = 50 * 60 * 1000;

    const update = () => {
        const remaining = DURATION_MS - (new Date() - startTime);
        if (remaining <= 0) {
            timerDisplay.textContent = "00:00"; timerDisplay.style.color = "red";
            return;
        }
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        timerProgress.style.width = `${(remaining / DURATION_MS) * 100}%`;
    };
    update();
    timerInterval = setInterval(update, 1000);
}

// --- END OPERATION ---
function handleReturnScan(e) {
    const code = typeof e.detail === 'object' ? e.detail.code : e.detail;
    if (!currentOperationId) return;

    const pointSelect = document.getElementById('input-end-point');
    if (pointSelect) {
        // Try to match partial or exact (e.g. "Counter" or "RETURN-Counter")
        for (let i = 0; i < pointSelect.options.length; i++) {
            const opt = pointSelect.options[i];
            if (code.includes(opt.value)) {
                pointSelect.value = opt.value;
                break;
            }
        }
    }

    // Reset photo input
    const photoInput = document.getElementById('return-photo');
    if (photoInput) photoInput.value = '';

    document.getElementById('end-resume-display').textContent = `Agente: ${userProfile?.full_name || 'Yo'} | Team: ${userProfile?.team || '...'}`;
    showView('view-form-end');

    // Trigger gate logic in case the scanned point is a gated area (Arribo/Embarque)
    handleEndLocationChange();
}

async function endOperation(e) {
    e.preventDefault();
    loader.classList.remove('hidden');
    try {
        const formData = new FormData(e.target);
        const photoFile = formData.get('return_photo');

        if (!photoFile || photoFile.size === 0) {
            throw new Error("La foto de respaldo es obligatoria para finalizar.");
        }

        // 1. Upload Return Photo
        let photoUrl = null;
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `return_${currentOperationId}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `returns/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('uploads')
            .upload(filePath, photoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('uploads')
            .getPublicUrl(filePath);

        photoUrl = publicUrl;

        // 2. Update Operation
        await supabase.from('operations').update({
            end_time: new Date(),
            end_location_type: formData.get('end_location_type'),
            end_point: formData.get('end_point'),
            end_bridge: formData.get('end_bridge') || null,
            end_gate: formData.get('end_gate') || null,
            return_photo_url: photoUrl,
            status: 'completed'
        }).eq('id', currentOperationId);

        // 3. Get asset ID to free it
        const { data: op } = await supabase.from('operations').select('asset_id').eq('id', currentOperationId).single();
        if (op) await supabase.from('assets').update({ status: 'available' }).eq('id', op.asset_id);

        currentOperationId = null;
        clearInterval(timerInterval);
        showSuccess('Devolución completada exitosamente.');
        setTimeout(() => window.location.href = 'index.html', 1500);
    } catch (err) {
        showError(err.message);
    } finally {
        loader.classList.add('hidden');
    }
}

async function handleEndLocationChange() {
    const context = document.getElementById('input-end-point').value;
    const terminal = document.getElementById('end-terminal').value;
    const bridgeGroup = document.getElementById('end-bridge-group');
    const gateGroup = document.getElementById('end-gate-group');
    const gateSelect = document.getElementById('end-gate-select');

    if (!bridgeGroup || !gateGroup || !gateSelect) return;

    if (context === 'Arribo' || context === 'Embarque') {
        bridgeGroup.classList.remove('hidden');
        gateGroup.classList.remove('hidden');
        gateSelect.innerHTML = '<option value="">Seleccione puente primero...</option>';
        loadEndBridges(terminal);
    } else {
        bridgeGroup.classList.add('hidden');
        gateGroup.classList.add('hidden');
    }
}

async function loadEndBridges(terminal) {
    const bridgeSelect = document.getElementById('end-bridge-select');
    if (!bridgeSelect) return;

    bridgeSelect.innerHTML = '<option value="">Cargando puentes...</option>';

    try {
        const { data: bridges } = await supabase
            .from('locations')
            .select('name')
            .eq('type', 'bridge')
            .eq('terminal', terminal)
            .order('name');

        bridgeSelect.innerHTML = '<option value="">Seleccione Puente...</option>';
        if (bridges && bridges.length > 0) {
            bridges.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.name;
                opt.textContent = b.name;
                bridgeSelect.appendChild(opt);
            });
        } else {
            // Fallback manual filter if no terminal assigned
            const { data: allBridges } = await supabase.from('locations').select('name').eq('type', 'bridge').order('name');
            const filtered = allBridges.filter(b => {
                const letter = b.name.split(' ').pop().toUpperCase();
                if (terminal === 'Nacional') return ['A', 'B'].includes(letter);
                return ['C', 'D', 'E', 'F'].includes(letter);
            });
            filtered.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.name;
                opt.textContent = b.name;
                bridgeSelect.appendChild(opt);
            });
        }
    } catch (err) { console.error(err); }
}

async function handleEndBridgeChange(e) {
    const bridge = e.target.value;
    const context = document.getElementById('input-end-point').value;
    const terminal = document.getElementById('end-terminal').value;
    const gateSelect = document.getElementById('end-gate-select');
    const gateLabel = document.getElementById('end-gate-label');

    if (!bridge || !gateSelect) {
        gateSelect.innerHTML = '<option value="">Seleccione puente primero...</option>';
        return;
    }

    gateSelect.innerHTML = '<option value="">Cargando gates...</option>';
    const isArrival = context === 'Arribo';
    gateLabel.textContent = isArrival ? '🚪 Puerta / Gate Arribo' : '🚪 Puerta / Gate Salida';

    const letter = bridge.split(' ').pop().toUpperCase();
    const dbType = isArrival ? 'gate_arrival' : 'gate';

    try {
        // 1. Try DB
        const { data: dbGates } = await supabase
            .from('locations')
            .select('name')
            .eq('type', dbType)
            .ilike('name', `${letter}%`)
            .order('name');

        gateSelect.innerHTML = '<option value="">Seleccione Gate...</option>';
        if (dbGates && dbGates.length > 0) {
            dbGates.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g.name;
                opt.textContent = g.name;
                gateSelect.appendChild(opt);
            });
        } else {
            // 2. Fallback generator
            const config = { 'A': 10, 'B': 12, 'C': 11, 'D': 10, 'E': 15, 'F': 15 };
            const max = config[letter] || 10;
            for (let i = 1; i <= max; i++) {
                const val = `${letter}${i.toString().padStart(2, '0')}`;
                const opt = document.createElement('option');
                opt.value = val;
                opt.textContent = val;
                gateSelect.appendChild(opt);
            }
        }
    } catch (err) { console.error(err); }
}

// --- REPORT INCIDENT LOGIC ---
async function handleReportLocationChange() {
    const context = document.getElementById('report-context').value;
    const terminal = document.getElementById('report-terminal').value;
    const gateGroup = document.getElementById('report-gate-group');
    const gateSelect = document.getElementById('report-gate-select');
    const gateLabel = document.getElementById('report-gate-label');

    if (context === 'Arribo' || context === 'Embarque') {
        gateGroup.classList.remove('hidden');
        gateLabel.textContent = context === 'Arribo' ? '🚪 Gate Arribo' : '🚪 Gate Salida';

        const type = context === 'Arribo' ? 'gate_arrival' : 'gate';

        // Fetch gates - flexible approach
        let query = supabase.from('locations').select('name').eq('type', type);
        if (terminal) query = query.eq('terminal', terminal);

        let { data: gates } = await query.order('name');

        // Fallback: if no gates found for that terminal, try fetching all of that type
        if ((!gates || gates.length === 0) && terminal) {
            const { data: allTypeGates } = await supabase.from('locations').select('name').eq('type', type).order('name');
            gates = allTypeGates;
        }

        gateSelect.innerHTML = '<option value="">Seleccione Gate...</option>';
        if (gates && gates.length > 0) {
            gates.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g.name;
                opt.textContent = g.name;
                gateSelect.appendChild(opt);
            });
        } else {
            gateSelect.innerHTML = '<option value="">Sin gates configurados</option>';
        }
    } else {
        gateGroup.classList.add('hidden');
    }
}

async function submitReport(e) {
    e.preventDefault();
    if (loader) loader.classList.remove('hidden');

    try {
        const formData = new FormData(e.target);
        const photoFile = formData.get('photo');
        let photoUrl = null;

        // 1. Upload Photo if present
        if (photoFile && photoFile.size > 0) {
            const fileExt = photoFile.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `reports/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('uploads')
                .upload(filePath, photoFile);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('uploads')
                .getPublicUrl(filePath);

            photoUrl = publicUrl;
        }

        // 2. Insert Report
        const reportData = {
            user_id: currentUser.id,
            asset_code: formData.get('asset_code'), // NEW: Store which asset is reported
            report_category: formData.get('report_category'),
            asset_type: formData.get('asset_type'),
            terminal: formData.get('terminal'),
            location_context: formData.get('location_context'),
            gate: formData.get('gate') || null,
            description: formData.get('description'),
            photo_url: photoUrl
        };

        const { error: insertError } = await supabase
            .from('reports')
            .insert(reportData);

        if (insertError) throw insertError;

        // 3. Mark asset as inoperative (maintenance)
        const assetCode = reportData.asset_code;
        await supabase.from('assets').update({ status: 'maintenance' }).eq('code', assetCode);

        showSuccess('Reporte enviado. El equipo ha sido marcado como INOPERATIVO hasta ser revisado.');
        e.target.reset();
        showView('view-scan');

    } catch (err) {
        showError('Error al enviar reporte: ' + err.message);
    } finally {
        if (loader) loader.classList.add('hidden');
    }
}

async function openReportManual(preselectedCode = null) {
    const assetSelect = document.getElementById('report-asset-select');
    const assetTypeSelect = document.getElementById('report-asset-type');
    if (!assetSelect || !assetTypeSelect) return;

    // Reset form
    document.getElementById('report-form').reset();
    assetSelect.innerHTML = '<option value="">Seleccione primero el tipo...</option>';
    assetSelect.disabled = true;

    showView('view-report');

    if (preselectedCode) {
        // If we came from a scan, try to pre-fill
        try {
            const { data: asset } = await supabase.from('assets').select('code, type').eq('code', preselectedCode).maybeSingle();
            if (asset) {
                const typeMap = {
                    'silla': 'Silla De Ruedas',
                    'carrito': 'Carrito de Golf',
                    'oruga': 'Silla Oruga',
                    'duplex': 'Carrito Duplex',
                    'pasillo': 'Silla De Pasillo'
                };
                const mappedType = typeMap[asset.type.toLowerCase()] || asset.type;
                assetTypeSelect.value = mappedType;
                await handleReportTypeChange({ target: assetTypeSelect }, preselectedCode);
            }
        } catch (e) { console.error(e); }
    }
}

async function handleReportTypeChange(e, preselectedCode = null) {
    const type = e.target.value;
    const assetSelect = document.getElementById('report-asset-select');
    if (!assetSelect) return;

    if (!type) {
        assetSelect.innerHTML = '<option value="">Seleccione primero el tipo...</option>';
        assetSelect.disabled = true;
        return;
    }

    assetSelect.innerHTML = '<option value="">Cargando equipos...</option>';
    assetSelect.disabled = false;

    try {
        // Map UI type to DB type if needed, but here they seem to be stored as categories
        // Let's assume the DB status/type matches or we filter by category
        const typeMap = {
            'Silla De Pasillo': 'pasillo',
            'Silla Oruga': 'oruga',
            'Silla De Ruedas': 'silla',
            'Carrito de Golf': 'carrito',
            'Carrito Duplex': 'duplex'
        };

        const dbType = typeMap[type] || type.toLowerCase();

        const { data: assets } = await supabase
            .from('assets')
            .select('code')
            .ilike('type', `%${dbType}%`)
            .order('code');

        assetSelect.innerHTML = '<option value="">Seleccione el equipo...</option>';
        if (assets && assets.length > 0) {
            assets.forEach(a => {
                const opt = document.createElement('option');
                opt.value = a.code;
                opt.textContent = a.code;
                if (preselectedCode && a.code === preselectedCode) opt.selected = true;
                assetSelect.appendChild(opt);
            });
        } else {
            assetSelect.innerHTML = '<option value="">No hay equipos de este tipo</option>';
        }
    } catch (err) {
        console.error("Error loading assets for report", err);
    }
}

init();
