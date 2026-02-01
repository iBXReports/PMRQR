// Theme Management
export function applyTheme(theme) {
    const body = document.body;
    if (!theme) theme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

    body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    // Update all theme toggle buttons on the page
    const themeToggles = document.querySelectorAll('#theme-toggle');
    themeToggles.forEach(btn => {
        btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
    });

    // Handle Logo Switching
    const isInsideAdmin = window.location.pathname.includes('/admin/');
    const basePath = isInsideAdmin ? '../assets/imagenes/' : 'assets/imagenes/';
    const logoImg = theme === 'dark' ? 'logodark.png' : 'logoclaro.png';

    const logos = document.querySelectorAll('.logo img, .sidebar-logo img');
    logos.forEach(img => {
        img.src = basePath + logoImg;
    });
}

// Initial apply
applyTheme();

// Event Delegation for Theme Toggle (handles dynamic buttons)
document.addEventListener('click', (e) => {
    const btn = e.target.closest('#theme-toggle');
    if (btn) {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
    }
});

// Sync across tabs
window.addEventListener('storage', (e) => {
    if (e.key === 'theme') {
        applyTheme(e.newValue);
    }
    if (e.key === 'performanceMode') {
        applyPerformanceMode(e.newValue);
    }
});

// Lite Theme (Performance Mode) - DEFAULT: 'lite' for all users
export function applyPerformanceMode(mode) {
    // mode: 'lite' or 'normal' - Default is 'lite' for performance
    if (!mode) mode = localStorage.getItem('performanceMode') || 'lite';

    if (mode === 'lite') {
        document.body.classList.add('lite-mode');
        // Ensure the CSS is loaded if not present (mainly for index.html)
        if (!document.getElementById('lite-theme-css')) {
            const link = document.createElement('link');
            link.id = 'lite-theme-css';
            link.rel = 'stylesheet';
            const isInsideAdmin = window.location.pathname.includes('/admin/');
            link.href = (isInsideAdmin ? '../' : '') + 'assets/css/lite-theme.css';
            document.head.appendChild(link);
        }
    } else {
        document.body.classList.remove('lite-mode');
        const link = document.getElementById('lite-theme-css');
        if (link) link.remove();
    }
    localStorage.setItem('performanceMode', mode);
}

// Initial apply
applyPerformanceMode();

// Common UI Utils
export function showError(message) {
    const errorAlert = document.getElementById('error-alert');
    if (errorAlert) {
        errorAlert.textContent = message;
        errorAlert.classList.remove('hidden');
        setTimeout(() => errorAlert.classList.add('hidden'), 5000);
    } else {
        alert(message);
    }
}

export function showSuccess(message) {
    const successAlert = document.getElementById('success-alert');
    if (successAlert) {
        successAlert.textContent = message;
        successAlert.classList.remove('hidden');
        setTimeout(() => successAlert.classList.add('hidden'), 5000);
    } else {
        alert(message);
    }
}

// --- GLOBAL RIGHT CLICK BLOCKER ---
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();

    // Check if lock message already exists
    let lockMsg = document.getElementById('context-lock-msg');

    if (!lockMsg) {
        lockMsg = document.createElement('div');
        lockMsg.id = 'context-lock-msg';
        lockMsg.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.9);
            background: rgba(20, 20, 30, 0.95);
            color: #f59e0b; /* Primary accent color */
            padding: 30px 50px;
            border-radius: 20px;
            font-family: 'Outfit', sans-serif;
            text-align: center;
            z-index: 999999;
            pointer-events: none;
            backdrop-filter: blur(12px);
            border: 1px solid rgba(245, 158, 11, 0.2);
            box-shadow: 0 20px 60px rgba(0,0,0,0.6);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 15px;
        `;
        lockMsg.innerHTML = `
            <div style="font-size: 3.5rem;">🔒❌</div>
            <div style="font-size: 1.4rem; font-weight: 700; color: #fff;">Acceso Restringido</div>
            <div style="font-size: 1rem; opacity: 0.8; color: #ccc;">Esta acción no está permitida por seguridad.</div>
        `;
        document.body.appendChild(lockMsg);
    }

    // Animate In
    requestAnimationFrame(() => {
        lockMsg.style.opacity = '1';
        lockMsg.style.transform = 'translate(-50%, -50%) scale(1)';
    });

    // Clear previous timeout if user clicks fast
    if (window.contextLockTimeout) clearTimeout(window.contextLockTimeout);

    // Animate Out
    window.contextLockTimeout = setTimeout(() => {
        lockMsg.style.opacity = '0';
        lockMsg.style.transform = 'translate(-50%, -50%) scale(0.9)';
    }, 2000);
});
