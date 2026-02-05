import { supabase } from './client.js';
import { showError, showSuccess, applyPerformanceMode, applyTheme } from './common.js';

const avatarInput = document.getElementById('avatar-input');
const avatarPreview = document.getElementById('avatar-preview');
const profileForm = document.getElementById('profile-form');
const loader = document.getElementById('loader');

// Fields
const fields = ['username', 'full_name', 'phone', 'commune', 'address', 'email'];

let currentUser = null;

async function init() {
    // 1. Check User
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = session.user;

    // 2. Load Data
    const { data } = await loadProfile(); // We need data for topbar too

    // 3. Setup Topbar
    setupTopbar(data); // Pass profile data explicitly

    // 4. Init Toggle State
    const currentMode = localStorage.getItem('performanceMode');
    const toggle = document.getElementById('lite-mode-toggle');
    if (toggle) toggle.checked = (currentMode === 'lite');

    // Make toggle global
    window.toggleLiteMode = function (el) {
        const newMode = el.checked ? 'lite' : 'normal';
        applyPerformanceMode(newMode);
        // showSuccess(newMode === 'lite' ? 'Modo Rapidez activado' : 'Modo Normal activado');
    };

    // 4. Attach Listeners
    if (avatarInput) avatarInput.addEventListener('change', uploadAvatar);
    if (profileForm) profileForm.addEventListener('submit', updateProfile);

    // Logout (Handled by setupTopbar now, but keeping for safely if old buttons exist)
    const oldLogout = document.getElementById('logout-btn');
    if (oldLogout) {
        oldLogout.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = 'index.html';
        });
    }
}

function setupTopbar(profileData) {
    const userNav = document.getElementById('user-nav-container');
    const userNameEl = document.getElementById('nav-user-name');
    const userAvatarEl = document.getElementById('nav-user-avatar');
    const adminLink = document.getElementById('nav-admin-link');
    const logoutBtn = document.getElementById('nav-logout-btn');
    const themeBtn = document.getElementById('nav-theme-toggle');

    if (!currentUser) return;

    // 1. Show Container
    if (userNav) userNav.classList.remove('hidden');

    // 2. Set Info
    const displayName = profileData?.full_name || currentUser.email.split('@')[0];
    if (userNameEl) userNameEl.textContent = displayName;

    // Avatar Logic
    if (userAvatarEl) {
        if (profileData && profileData.avatar_url) {
            userAvatarEl.src = profileData.avatar_url;
        } else {
            userAvatarEl.src = 'assets/imagenes/avatarcargo.png';
        }
    }

    // 3. Admin Link Visibility & Dynamic Dropdown
    const allowedRoles = ['CDO', 'Supervisor', 'Administrador', 'SPRV'];
    const userRole = profileData?.role || '';
    const hasAccess = allowedRoles.some(r => r.toLowerCase() === userRole.toLowerCase());

    // 4. Clone Dropdown and Setup Events
    const dropdown = document.querySelector('.user-dropdown');
    if (dropdown) {
        const newDropdown = dropdown.cloneNode(true);
        dropdown.parentNode.replaceChild(newDropdown, dropdown);

        const content = newDropdown.querySelector('.dropdown-content');
        if (content) {
            content.innerHTML = '';

            // 1. Profile Link (Redundant on profile page? Maybe "Volver a Inicio" is better?)
            // But per request to keep it consistent or standard:
            // "en profile.html igual me estas mostrando el panel admin aun que NO soy ni administrador... ocultalo"
            // Let's standardise the menu.

            const homeLink = document.createElement('a');
            homeLink.href = 'index.html';
            homeLink.innerHTML = `<span class="dropdown-icon">🏠</span> Volver a Inicio`;
            content.appendChild(homeLink);

            // 2. Admin Link (Conditional)
            if (hasAccess) {
                const adminLinkEl = document.createElement('a');
                adminLinkEl.href = 'admin/admin.html';
                adminLinkEl.id = 'nav-admin-link';
                adminLinkEl.innerHTML = `<span class="dropdown-icon">🛡️</span> Panel Admin`;
                content.appendChild(adminLinkEl);
            }

            // 3. Theme Toggle
            const themeBtnEl = document.createElement('button');
            themeBtnEl.id = 'nav-theme-toggle';
            themeBtnEl.innerHTML = `<span class="dropdown-icon">🌓</span> Cambiar Tema`;
            content.appendChild(themeBtnEl);

            // 4. Divider
            const divider = document.createElement('div');
            divider.className = 'dropdown-divider';
            content.appendChild(divider);

            // 5. Logout
            const logoutBtnEl = document.createElement('button');
            logoutBtnEl.id = 'nav-logout-btn';
            logoutBtnEl.className = 'logout-btn';
            logoutBtnEl.style.color = '#ef4444';
            logoutBtnEl.innerHTML = `<span class="dropdown-icon">🚪</span> Cerrar Sesión`;
            content.appendChild(logoutBtnEl);
        }

        // Toggle on click
        newDropdown.onclick = (e) => {
            if (e.target.closest('.dropdown-content')) return;
            e.stopPropagation();
            newDropdown.classList.toggle('active');
        };

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!newDropdown.contains(e.target)) {
                newDropdown.classList.remove('active');
            }
        });

        // Re-query elements INSIDE the cloned dropdown
        const clonedLogout = newDropdown.querySelector('#nav-logout-btn');
        const clonedTheme = newDropdown.querySelector('#nav-theme-toggle');

        if (clonedLogout) {
            clonedLogout.addEventListener('click', async (e) => {
                e.stopPropagation();
                await supabase.auth.signOut();
                window.location.href = 'login.html';
            });
        }

        if (clonedTheme) {
            clonedTheme.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const current = localStorage.getItem('theme') || 'light';
                const next = current === 'dark' ? 'light' : 'dark';
                applyTheme(next);
            });
        }
    }
}

async function loadProfile() {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error) throw error;

        // Populate Fields
        document.getElementById('rut').value = data.rut || '';
        document.getElementById('username').value = data.username || '';
        // document.getElementById('full_name').value = data.full_name || ''; // Removed generic full name input

        document.getElementById('first_name').value = data.first_name || '';
        document.getElementById('middle_name').value = data.middle_name || '';
        document.getElementById('last_name_1').value = data.last_name_1 || '';
        document.getElementById('last_name_2').value = data.last_name_2 || '';

        document.getElementById('phone').value = data.phone || '';
        document.getElementById('commune').value = data.commune || '';

        document.getElementById('address_street').value = data.address_street || data.address || ''; // Fallback
        document.getElementById('address_number').value = data.address_number || '';
        document.getElementById('address_unit').value = data.address_unit || '';

        // Operational Data
        if (document.getElementById('team')) document.getElementById('team').value = data.team || 'OLA';
        if (document.getElementById('tica_status')) document.getElementById('tica_status').value = data.tica_status || 'NO_APLICA';

        // Auth Email
        document.getElementById('email').value = currentUser.email;

        // Display Info
        document.getElementById('display-name').textContent = data.full_name || data.username || 'Usuario';
        document.getElementById('display-email').textContent = currentUser.email;

        // Avatar
        if (data.avatar_url) {
            avatarPreview.src = data.avatar_url;
        }

        // Certifications UI
        const certs = {
            'badge-golf': data.cert_golf,
            'badge-duplex': data.cert_duplex,
            'badge-oruga': data.cert_oruga
        };

        Object.entries(certs).forEach(([id, active]) => {
            const el = document.getElementById(id);
            if (el) {
                if (active) {
                    el.style.opacity = '1';
                    el.style.background = 'var(--success-color, #10b981)';
                    el.style.borderColor = 'var(--success-color, #10b981)';
                    el.style.color = 'white';
                    el.style.fontWeight = 'bold';
                    el.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.4)';
                } else {
                    el.style.opacity = '0.3';
                    el.style.background = 'transparent';
                    el.style.borderColor = 'var(--text-color)';
                    el.style.color = 'inherit';
                }
            }
        });

        return { data }; // Return data for init usage

    } catch (err) {
        showError('Error al cargar perfil: ' + err.message);
        return { data: null };
    }
}

async function uploadAvatar(e) { /* ... same ... */
    const file = e.target.files[0];
    // ... [No changes needed in uploadAvatar, using existing] ...
    if (!file) return;

    try {
        loader.classList.remove('hidden');

        const fileExt = file.name.split('.').pop();
        const fileName = `${currentUser.id}-${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('uploads')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('uploads')
            .getPublicUrl(filePath);

        const { error: updateError } = await supabase
            .from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', currentUser.id);

        if (updateError) throw updateError;

        avatarPreview.src = publicUrl;
        showSuccess('Foto de perfil actualizada');

    } catch (err) {
        showError('Error subiendo imagen: ' + err.message);
    } finally {
        loader.classList.add('hidden');
    }
}

async function updateProfile(e) {
    e.preventDefault();
    loader.classList.remove('hidden');

    try {
        const rut = document.getElementById('rut').value;
        const username = document.getElementById('username').value;

        const first_name = document.getElementById('first_name').value;
        const middle_name = document.getElementById('middle_name').value;
        const last_name_1 = document.getElementById('last_name_1').value;
        const last_name_2 = document.getElementById('last_name_2').value;

        // Reconstruction for compatibility
        const full_name = `${first_name} ${middle_name} ${last_name_1} ${last_name_2}`.replace(/\s+/g, ' ').trim();

        const phone = document.getElementById('phone').value;
        const commune = document.getElementById('commune').value;

        const address_street = document.getElementById('address_street').value;
        const address_number = document.getElementById('address_number').value;
        const address_unit = document.getElementById('address_unit').value;
        const address = `${address_street} #${address_number} ${address_unit}`.trim();

        const team = document.getElementById('team').value;
        const tica_status = document.getElementById('tica_status').value;

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        const updates = {
            rut,
            username,
            first_name,
            middle_name,
            last_name_1,
            last_name_2,
            full_name,
            phone,
            commune,
            address_street,
            address_number,
            address_unit,
            address,
            team,
            tica_status,
            updated_at: new Date()
        };

        // 1. Update Public Profile
        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', currentUser.id);

        if (error) throw error;

        // 2. Update Auth (Email/Password) if changed
        const authUpdates = {};
        if (email !== currentUser.email) authUpdates.email = email;
        if (password) authUpdates.password = password;

        if (Object.keys(authUpdates).length > 0) {
            const { error: authError } = await supabase.auth.updateUser(authUpdates);
            if (authError) throw authError;
            if (authUpdates.email) showSuccess('Perfil actualizado. Revisa tu nuevo correo para confirmar.');
            else showSuccess('Perfil y contraseña actualizados.');
        } else {
            showSuccess('Perfil actualizado correctamente.');
        }

        // Refresh UI
        loadProfile();
        if (document.getElementById('password')) {
            document.getElementById('password').value = '';
        }

    } catch (err) {
        showError(err.message);
    } finally {
        loader.classList.add('hidden');
    }
}

init();
