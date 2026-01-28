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
