
import { supabase } from './client.js';
import { showError, showSuccess } from './common.js';

// --- AUTO-COMPLETE REGISTRATION FROM DATABASE ---
// When a user enters their RUT or Name that matches existing profile data,
// automatically fill in the other fields (email, phone, address, commune)

let autoCompleteTimeout = null;
let profilesCache = null;

// Fetch and cache all pre-registration data for auto-complete
// This comes from Excel imports stored in agent_predata table
async function loadProfilesForAutoComplete() {
    if (profilesCache) return profilesCache;

    try {
        // Query agent_predata table (pre-registration data from Excel imports)
        const { data, error } = await supabase
            .from('agent_predata')
            .select('full_name, rut, email, phone, address, addr_number, commune, first_name, middle_name, last_name_1, last_name_2');

        if (error) {
            console.error('Error loading predata for autocomplete:', error);
            // Fallback: try profiles table if agent_predata doesn't exist yet
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('full_name, rut, email, phone, address, commune, first_name, middle_name, last_name_1, last_name_2');

            if (profileError) {
                console.error('Fallback profiles error:', profileError);
                return [];
            }
            profilesCache = profileData || [];
            return profilesCache;
        }

        profilesCache = data || [];
        console.log(`[AUTOCOMPLETE] Loaded ${profilesCache.length} pre-registration records`);
        return profilesCache;
    } catch (err) {
        console.error('Auto-complete load error:', err);
        return [];
    }
}

// Normalize RUT for comparison
function normalizeRutForMatch(r) {
    if (!r) return '';
    return String(r).replace(/\./g, '').replace(/-/g, '').toUpperCase().trim();
}

// Normalize name for comparison
function normalizeNameForMatch(n) {
    if (!n) return '';
    return String(n).toUpperCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Parse address into street, number, unit
function parseAddress(address) {
    if (!address) return { street: '', number: '', unit: '' };

    // Expected format: "Calle #1234 Depto 501" or "Calle #1234, Depto 501"
    const result = { street: address, number: '', unit: '' };

    // Try to find # separator
    if (address.includes('#')) {
        const hashIndex = address.indexOf('#');
        result.street = address.substring(0, hashIndex).trim();
        const afterHash = address.substring(hashIndex + 1).trim();

        // Split by space or comma to separate number and unit
        const parts = afterHash.split(/[\s,]+/);
        if (parts.length >= 1) {
            result.number = parts[0];
        }
        if (parts.length >= 2) {
            result.unit = parts.slice(1).join(' ');
        }
    }

    return result;
}

// Find matching profile
function findMatchingProfile(profiles, rut, name) {
    const normalizedRut = normalizeRutForMatch(rut);
    const normalizedName = normalizeNameForMatch(name);

    // First try RUT match (more reliable)
    if (normalizedRut && normalizedRut.length >= 8) {
        const byRut = profiles.find(p => normalizeRutForMatch(p.rut) === normalizedRut);
        if (byRut) return byRut;
    }

    // Then try exact name match
    if (normalizedName && normalizedName.length >= 5) {
        const byName = profiles.find(p => normalizeNameForMatch(p.full_name) === normalizedName);
        if (byName) return byName;
    }

    return null;
}

// Fill form fields from matching profile
function fillFormFromProfile(profile) {
    if (!profile) return;

    const form = document.getElementById('register-form');
    if (!form) return;

    // Get form elements
    const emailInput = form.querySelector('[name="email"]');
    const phoneInput = form.querySelector('[name="phone"]');
    const streetInput = form.querySelector('[name="addr_street"]');
    const numberInput = form.querySelector('[name="addr_number"]');
    const unitInput = form.querySelector('[name="addr_unit"]');
    const communeInput = form.querySelector('[name="commune"]');

    const firstNameInput = form.querySelector('[name="first_name"]');
    const middleNameInput = form.querySelector('[name="middle_name"]');
    const lastName1Input = form.querySelector('[name="last_name_1"]');
    const lastName2Input = form.querySelector('[name="last_name_2"]');

    // Parse address as fallback (for old data that might have combined address)
    const parsedAddress = parseAddress(profile.address);

    // Only fill if the field is empty (don't overwrite user input)
    if (emailInput && !emailInput.value && profile.email) {
        emailInput.value = profile.email;
        highlightField(emailInput);
    }

    if (phoneInput && !phoneInput.value && profile.phone) {
        phoneInput.value = profile.phone;
        highlightField(phoneInput);
    }

    // Use address field directly (street only)
    if (streetInput && !streetInput.value && profile.address) {
        streetInput.value = profile.address; // Fallback to full address if street not parsed
        highlightField(streetInput);
    } else if (streetInput && !streetInput.value && parsedAddress.street) {
        streetInput.value = parsedAddress.street;
        highlightField(streetInput);
    }

    // Use addr_number directly if available, otherwise fallback to parsed
    if (numberInput && !numberInput.value && profile.addr_number) {
        numberInput.value = profile.addr_number;
        highlightField(numberInput);
    } else if (numberInput && !numberInput.value && parsedAddress.number) {
        numberInput.value = parsedAddress.number;
        highlightField(numberInput);
    }

    if (unitInput && !unitInput.value && parsedAddress.unit) {
        unitInput.value = parsedAddress.unit;
        highlightField(unitInput);
    }

    if (communeInput && !communeInput.value && profile.commune) {
        communeInput.value = profile.commune;
        highlightField(communeInput);
    }

    // Fill Names
    if (firstNameInput && !firstNameInput.value && profile.first_name) {
        firstNameInput.value = profile.first_name;
        highlightField(firstNameInput);
    }
    if (middleNameInput && !middleNameInput.value && profile.middle_name) {
        middleNameInput.value = profile.middle_name;
        highlightField(middleNameInput);
    }
    if (lastName1Input && !lastName1Input.value && profile.last_name_1) {
        lastName1Input.value = profile.last_name_1;
        highlightField(lastName1Input);
    }
    if (lastName2Input && !lastName2Input.value && profile.last_name_2) {
        lastName2Input.value = profile.last_name_2;
        highlightField(lastName2Input);
    }

    // Show success message
    showAutoCompleteNotice();
}

// Highlight auto-filled field
function highlightField(input) {
    input.style.transition = 'all 0.3s ease';
    input.style.borderColor = '#10b981';
    input.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.3)';

    setTimeout(() => {
        input.style.borderColor = '';
        input.style.boxShadow = '';
    }, 2000);
}

// Show notice that fields were auto-filled
function showAutoCompleteNotice() {
    const existingNotice = document.getElementById('autocomplete-notice');
    if (existingNotice) existingNotice.remove();

    const notice = document.createElement('div');
    notice.id = 'autocomplete-notice';
    notice.innerHTML = '✨ <strong>Datos encontrados!</strong> Algunos campos fueron completados automáticamente.';
    notice.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        padding: 12px 24px;
        border-radius: 12px;
        font-size: 0.9rem;
        z-index: 9999;
        box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
        animation: slideUp 0.3s ease;
    `;

    // Add animation keyframes if not exists
    if (!document.getElementById('autocomplete-styles')) {
        const style = document.createElement('style');
        style.id = 'autocomplete-styles';
        style.textContent = `
            @keyframes slideUp {
                from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notice);

    setTimeout(() => {
        notice.style.opacity = '0';
        notice.style.transition = 'opacity 0.3s ease';
        setTimeout(() => notice.remove(), 300);
    }, 4000);
}

// Debounced auto-complete trigger
async function triggerAutoComplete() {
    const form = document.getElementById('register-form');
    if (!form) return;

    const rutInput = form.querySelector('[name="rut"]');
    const nameInput = form.querySelector('[name="fullName"]');

    const rut = rutInput?.value || '';
    const name = nameInput?.value || '';

    // Load profiles
    const profiles = await loadProfilesForAutoComplete();
    if (profiles.length === 0) return;

    // Find match
    const match = findMatchingProfile(profiles, rut, name);
    if (match) {
        fillFormFromProfile(match);
    }
}

// Setup auto-complete listeners
function setupAutoCompleteListeners() {
    const form = document.getElementById('register-form');
    if (!form) return;

    const rutInput = form.querySelector('[name="rut"]');
    const nameInput = form.querySelector('[name="fullName"]');

    const debouncedSearch = () => {
        clearTimeout(autoCompleteTimeout);
        autoCompleteTimeout = setTimeout(triggerAutoComplete, 500);
    };

    if (rutInput) {
        rutInput.addEventListener('input', debouncedSearch);
        rutInput.addEventListener('blur', triggerAutoComplete);
    }

    if (nameInput) {
        nameInput.addEventListener('input', debouncedSearch);
        nameInput.addEventListener('blur', triggerAutoComplete);
    }
}

// Initialize auto-complete on page load
if (document.getElementById('register-form')) {
    setupAutoCompleteListeners();
    // Pre-load profiles cache
    loadProfilesForAutoComplete();
}

// Register Handler
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const loader = document.getElementById('loader');
        const submitBtn = document.getElementById('submit-btn');

        // Disable button and show loader
        submitBtn.disabled = true;
        loader.classList.remove('hidden');

        // Capture data
        const formData = new FormData(registerForm);
        const email = formData.get('email');
        const password = formData.get('password');
        const username = formData.get('username');
        const fullName = formData.get('fullName');
        const rut = formData.get('rut');
        const ticaStatus = formData.get('tica_status');

        // Address Composition
        const street = formData.get('addr_street');
        const number = formData.get('addr_number') || 'S/N';
        const unit = formData.get('addr_unit') || '';
        const address = `${street} #${number} ${unit}`.trim();

        const commune = formData.get('commune');
        const phone = formData.get('phone');

        if (!rut || rut.length < 8) {
            showError("RUT inválido. Formato requerido: 12.345.678-K");
            submitBtn.disabled = false;
            loader.classList.add('hidden');
            return;
        }

        try {
            // Sign up with Supabase Auth
            // We pass extra metadata so the trigger can pick it up
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username,
                        full_name: fullName,
                        rut,
                        tica_status: ticaStatus,
                        address,
                        commune,
                        phone
                    }
                }
            });

            if (error) throw error;

            showSuccess('¡Registro exitoso! 📧 Por favor verifica tu correo electrónico.');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);

        } catch (error) {
            showError(error.message);
            submitBtn.disabled = false;
        } finally {
            loader.classList.add('hidden');
        }
    });
}

// Login Handler
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const loader = document.getElementById('loader');
        const submitBtn = document.getElementById('submit-btn');

        submitBtn.disabled = true;
        loader.classList.remove('hidden');

        // The user prompted "Login pedira un usuario y contraseña".
        // HOWEVER, Supabase defaults to Email/Password. 
        // If the user REALLY wants username/password login, I usually need to query the email first or assume email.
        // I will assume the prompt implies "Usuario" might refer to the account identifier (email) OR actual username.
        // For simplicity with standard Supabase, I will use Email in the form but Label it "Correo / Usuario" or just stick to Email if possible,
        // BUT the prompt is specific: "EL LOGIN PEDIRA UN USUARIO Y CONTRASEÑA". 
        // I will interpret "Usuario" as the identifier. I'll verify if they entered an email, if not, I'll assume it's a username and look up the email (requires a DB query first, which is insecure if not careful, but possible).
        // A safer bet for "100% HTML/JS" without backend logic to safely lookup emails is to just ask for Email.
        // Let's try to stick to Email for technical robustness, but Label it "Email". 
        // If I MUST support Username login, I have to validly query the `profiles` table to find the email associated with that username.
        // Let's implement the "Resolve Email from Username" logic.

        const identifier = document.getElementById('identifier').value.trim();
        const password = document.getElementById('password').value;

        try {
            let email = identifier;

            // Resolve email if it's a username (not a valid email format)
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(identifier)) {
                // Try to find email by Username OR RUT
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('email')
                    .or(`username.ilike.${identifier},rut.ilike.${identifier}`)
                    .maybeSingle();

                if (profileError) {
                    console.error("Lookup Error:", profileError);
                    throw new Error('Error al validar credenciales. Intenta usar tu correo.');
                }

                if (!profile || !profile.email) {
                    throw new Error('Usuario o RUT no encontrado. Si tienes dudas, usa tu correo registrado.');
                }
                email = profile.email;
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) throw error;

            showSuccess('¡Bienvenido! 🚀');
            window.location.href = 'index.html';

        } catch (error) {
            showError(error.message || 'Error al iniciar sesión');
            submitBtn.disabled = false;
        } finally {
            loader.classList.add('hidden');
        }
    });
}

// Global RUT Formatter
window.formatRut = function (input) {
    let val = input.value.replace(/[^0-9kK]/g, '');
    if (val.length === 0) return;
    if (val.length > 9) val = val.substring(0, 9);

    const dv = val.slice(-1);
    let body = val.slice(0, -1);

    if (val.length > 1) {
        input.value = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + '-' + dv.toUpperCase();
    } else {
        input.value = val.toUpperCase();
    }
};

// Logout
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    });
}
