
import { supabase } from './client.js';
import { showError, showSuccess } from './common.js';

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
        const address = formData.get('address');
        const commune = formData.get('commune');
        const phone = formData.get('phone');

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
                // Try to find email by username in profiles table
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('email')
                    .ilike('username', identifier) // Case-insensitive lookup
                    .maybeSingle(); // Better than single() to avoid pgrst error if multiple/missing

                if (profileError) {
                    console.error("Profile Lookup Error:", profileError);
                    throw new Error('Error al validar el usuario. Por favor usa tu correo.');
                }

                if (!profile || !profile.email) {
                    throw new Error('El nombre de usuario no existe o no tiene un correo vinculado. Asegúrate de que el administrador haya sincronizado tu cuenta.');
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

// Logout
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    });
}
