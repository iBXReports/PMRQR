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
            userAvatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6366f1&color=fff&size=128`;
        }
    }

    // 3. Admin Link Visibility
    const allowedRoles = ['CDO', 'Supervisor', 'Administrador'];
    const userRole = profileData?.role || '';
    const hasAccess = allowedRoles.some(r => r.toLowerCase() === userRole.toLowerCase());

    if (hasAccess && adminLink) {
        adminLink.classList.remove('hidden');
    } else if (adminLink) {
        adminLink.classList.add('hidden');
    }

    // 4. Bind Actions
    if (logoutBtn) {
        const newLogout = logoutBtn.cloneNode(true);
        logoutBtn.parentNode.replaceChild(newLogout, logoutBtn);
        newLogout.addEventListener('click', async (e) => {
            e.stopPropagation();
            await supabase.auth.signOut();
            window.location.href = 'login.html';
        });
    }

    if (themeBtn) {
        const newThemeBtn = themeBtn.cloneNode(true);
        themeBtn.parentNode.replaceChild(newThemeBtn, themeBtn);
        newThemeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const current = localStorage.getItem('theme') || 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            applyTheme(next);
        });
    }

    // 5. Click Toggle for Dropdown
    const dropdown = document.querySelector('.user-dropdown');
    if (dropdown) {
        const newDropdown = dropdown.cloneNode(true);
        dropdown.parentNode.replaceChild(newDropdown, dropdown);

        newDropdown.onclick = (e) => {
            if (e.target.closest('.dropdown-content')) return;
            e.stopPropagation();
            newDropdown.classList.toggle('active');
        };

        document.addEventListener('click', (e) => {
            if (!newDropdown.contains(e.target)) {
                newDropdown.classList.remove('active');
            }
        });
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
        document.getElementById('username').value = data.username || '';
        document.getElementById('full_name').value = data.full_name || '';
        document.getElementById('phone').value = data.phone || '';
        document.getElementById('commune').value = data.commune || '';
        document.getElementById('address').value = data.address || '';

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
                    el.style.color = 'white';
                    el.style.fontWeight = 'bold';
                    el.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.4)';
                } else {
                    el.style.opacity = '0.3';
                    el.style.background = 'var(--card-border, #eee)';
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

async function uploadAvatar(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        loader.classList.remove('hidden');

        const fileExt = file.name.split('.').pop();
        const fileName = `${currentUser.id}-${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        // Upload
        const { error: uploadError } = await supabase.storage
            .from('uploads')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('uploads')
            .getPublicUrl(filePath);

        // Update Profile
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
        const username = document.getElementById('username').value;
        const full_name = document.getElementById('full_name').value;
        const phone = document.getElementById('phone').value;
        const commune = document.getElementById('commune').value;
        const address = document.getElementById('address').value;

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        const updates = {
            username,
            full_name,
            phone,
            commune,
            address,
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
