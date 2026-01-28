
import { supabase } from './client.js';

const navLinks = document.querySelector('.nav-links');

async function init() {
    // Check auth session once on load (faster user experience)
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        handleLoggedInState(session.user);
    } else {
        handleGuestState();
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'TOKEN_REFRESHED') return; // Prevent flickering

        if (session) {
            handleLoggedInState(session.user);
        } else {
            handleGuestState();
        }
    });
}

function handleGuestState() {
    // Ensure Login/Register buttons are in nav
    const authBtns = `
        <button id="theme-toggle" class="theme-toggle">🌙</button>
        <a href="login.html">Iniciar Sesión</a>
        <a href="register.html" class="btn" style="padding: 0.5rem 1rem; width: auto; font-size: 1rem;">Crear Cuenta</a>
    `;
    if (navLinks) navLinks.innerHTML = authBtns;

    // Simple listener for guest
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
}

async function handleLoggedInState(user) {
    // Fetch full profile (role, avatar, name)
    let profile = { username: 'Usuario', role: 'Agente' };
    try {
        const { data } = await supabase
            .from('profiles')
            .select('username, full_name, role, avatar_url')
            .eq('id', user.id)
            .single();
        if (data) profile = data;
    } catch (e) { }

    const displayName = profile.full_name || profile.username || 'Usuario';
    const avatar = profile.avatar_url || 'assets/imagenes/avatarcargo.png';
    const cleanRole = (profile.role || 'agente').toLowerCase();

    // Check for admin/supervisor permissions
    const canAccessAdmin = ['admin', 'jefe', 'supervisor', 'cdo'].includes(cleanRole);

    const userNav = `
        <div class="user-dropdown" onclick="this.classList.toggle('active')">
            <div style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <img src="${avatar}" alt="Avatar" style="width: 40px; height: 40px; min-width: 40px; border-radius: 50%; border: 2px solid var(--primary-color); object-fit: cover;">
                <span class="desktop-only" style="font-weight: 600; font-size: 0.9rem;">${displayName}</span>
                <i class="fas fa-chevron-down" style="font-size: 0.8rem; opacity: 0.7;"></i>
            </div>
            <div class="dropdown-content">
                <div style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: center;">
                    <strong style="display:block; font-size: 1rem;">${displayName}</strong>
                    <span style="font-size: 0.8rem; opacity: 0.6; text-transform: capitalize;">${profile.role || 'Agente'}</span>
                </div>
                
                ${canAccessAdmin ? `<a href="admin/admin.html"><i class="fas fa-shield-alt"></i> Panel Admin</a>` : ''}
                <a href="profile.html"><i class="fas fa-user"></i> Mi Perfil</a>
                <button id="theme-toggle-drop"><i class="fas fa-moon"></i> Cambiar Tema</button>
                <button id="logout-btn-drop" style="color: #ef4444;"><i class="fas fa-sign-out-alt"></i> Cerrar Sesión</button>
            </div>
        </div>
    `;

    if (navLinks) navLinks.innerHTML = userNav;

    // Attach Listeners for Dropdown items
    setTimeout(() => {
        const themeBtn = document.getElementById('theme-toggle-drop');
        if (themeBtn) {
            themeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleTheme();
            });
        }

        const logoutBtn = document.getElementById('logout-btn-drop');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await supabase.auth.signOut();
                window.location.reload();
            });
        }
    }, 100);
}

function toggleTheme() {
    const body = document.body;
    const currentTheme = body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

function attachThemeListener() {
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    if (themeToggle) {
        // Set initial icon
        const currentTheme = body.getAttribute('data-theme');
        themeToggle.innerHTML = currentTheme === 'dark' ? '☀️' : '🌙';

        themeToggle.addEventListener('click', () => {
            const currentTheme = body.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            body.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            themeToggle.innerHTML = newTheme === 'dark' ? '☀️' : '🌙';
        });
    }
}

init();
