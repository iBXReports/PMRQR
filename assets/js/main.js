
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
    attachThemeListener();
}

async function handleLoggedInState(user) {
    // Fetch basic profile for the name in navbar
    let username = 'Usuario';
    try {
        const { data } = await supabase
            .from('profiles')
            .select('username, full_name')
            .eq('id', user.id)
            .single();
        if (data) username = data.username || data.full_name || 'Usuario';
    } catch (e) { }

    // Update Nav to point to Profile
    const userNav = `
        <button id="theme-toggle" class="theme-toggle">🌙</button>
        <a href="profile.html" style="font-weight: bold; margin-right: 1rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>${username}</span>
            <span style="background: var(--primary-color); padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; color: white;">Mi Perfil</span>
        </a>
    `;
    if (navLinks) navLinks.innerHTML = userNav;
    attachThemeListener();
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
