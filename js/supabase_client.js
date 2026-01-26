
// QRCARGO Supabase Client
// Handles connection, auth, and data operations

const SUPABASE_URL = 'https://plpnypzesupfczxrzgwb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBscG55cHplc3VwZmN6eHJ6Z3diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NjAwNDksImV4cCI6MjA4NTAzNjA0OX0.d_sGStyMDts6wUEPOeZQZw8vIpfZMxx78kieGOrzxR8';

// Define Global DB Interface immediately
window.DB = {
    ready: false,

    // Auth
    login: async (username, password) => { return { success: false, message: "Client not ready" }; },
    register: async (data) => { return { success: false, message: "Client not ready" }; },
    checkAuth: async () => { return { isLoggedIn: false }; },
    logout: () => {
        localStorage.removeItem('qrcargo_session');
        window.location.href = '../index.html'; // Adjust based on path
    },

    // Data
    getStats: async () => { return { success: false }; },
    getChairs: async () => { return { success: false }; },
    createChair: async (data) => { return { success: false }; },
    updateChair: async (id, data) => { return { success: false }; },
    deleteChair: async (id) => { return { success: false }; },
    getLogs: async () => { return { success: false, message: "Client not ready" }; },
    logMovement: async (data) => { return { success: false }; },

    // Realtime
    subscribeToChairs: (callback) => { },
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("Initializing Supabase Client...");

    if (typeof window.supabase === 'undefined') {
        console.error("Supabase SDK not loaded!");
        alert("Error: Supabase SDK not found. Please check internet connection.");
        return;
    }

    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.DB.ready = true;
    console.log("Supabase Client Ready");

    // Implement Interface
    window.DB.login = async (username, password) => {
        try {
            const { data, error } = await sb
                .from('users')
                .select('*')
                .eq('username', username)
                .eq('password', password)
                .single();

            if (error) throw error;
            if (!data) throw new Error("Credenciales inválidas");

            const session = {
                id: data.id,
                username: data.username,
                role: data.role,
                isLoggedIn: true
            };
            localStorage.setItem('qrcargo_session', JSON.stringify(session));
            return { success: true, role: data.role };
        } catch (e) {
            console.error(e);
            return { success: false, message: e.message };
        }
    };

    window.DB.register = async (data) => {
        try {
            const { data: existing } = await sb.from('users').select('id').eq('username', data.username).maybeSingle();
            if (existing) return { success: false, message: "Usuario ya existe" };

            // Default role 'agente'
            const newUser = { ...data, role: 'agente' };
            const { error } = await sb.from('users').insert([newUser]);

            if (error) throw error;
            return { success: true };
        } catch (e) {
            return { success: false, message: e.message };
        }
    };

    window.DB.checkAuth = async () => {
        const session = JSON.parse(localStorage.getItem('qrcargo_session'));
        return session ? session : { isLoggedIn: false };
    };

    window.DB.getStats = async () => {
        try {
            const { count: users } = await sb.from('users').select('*', { count: 'exact', head: true });
            const { count: chairs } = await sb.from('chairs').select('*', { count: 'exact', head: true });
            const { count: logs } = await sb.from('movement_logs').select('*', { count: 'exact', head: true });
            return { success: true, data: { users: users || 0, chairs: chairs || 0, logs: logs || 0 } };
        } catch (e) {
            return { success: false };
        }
    };

    window.DB.getChairs = async () => {
        const { data, error } = await sb.from('chairs').select('*').order('number', { ascending: true });
        if (error) return { success: false, message: error.message };
        return { success: true, data: data };
    };

    window.DB.createChair = async (data) => {
        try {
            const category = data.category || 'standard';
            const prefixMap = {
                'standard': 'SILLA',
                'golf': 'CARRITO',
                'oruga': 'ORUGA',
                'pasillo': 'PASILLO'
            };
            const prefix = prefixMap[category] || 'ITEM';

            // Get last number
            const { data: last } = await sb.from('chairs').select('number').eq('category', category).order('number', { ascending: false }).limit(1).single();
            const nextNum = (last?.number || 0) + 1;
            const code = `${prefix}-${String(nextNum).padStart(3, '0')}`;

            const newChair = {
                code,
                category,
                number: nextNum,
                status: 'available',
                owner: data.owner,
                location: data.location
            };

            const { data: inserted, error } = await sb.from('chairs').insert([newChair]).select().single();
            if (error) throw error;
            return { success: true, data: inserted };
        } catch (e) {
            console.error(e);
            return { success: false, message: e.message };
        }
    };

    window.DB.updateChair = async (id, updates) => {
        try {
            const { data, error } = await sb.from('chairs').update(updates).eq('id', id).select().single();
            if (error) throw error;
            return { success: true, data: data };
        } catch (e) {
            return { success: false, message: e.message };
        }
    };

    window.DB.deleteChair = async (id) => {
        try {
            const { error } = await sb.from('chairs').delete().eq('id', id);
            if (error) throw error;
            return { success: true };
        } catch (e) {
            return { success: false, message: e.message };
        }
    };

    window.DB.logMovement = async (logData) => {
        try {
            const session = await window.DB.checkAuth();
            if (!session.isLoggedIn) throw new Error("No autenticado");

            const dbData = {
                user_id: session.id,
                username: session.username,
                timestamp: new Date().toISOString(),
                chair_code: logData.chair_code,
                // Map frontend keys to DB columns
                origin_text: logData.origin,
                destination_text: logData.destination,
                final_location_text: logData.final_location || logData.final_location_text
            };

            const { error } = await sb.from('movement_logs').insert([dbData]);
            if (error) throw error;
            return { success: true };
        } catch (e) {
            return { success: false, message: e.message };
        }
    };

    window.DB.getLogs = async () => {
        try {
            const { data, error } = await sb
                .from('movement_logs')
                .select('*')
                .order('timestamp', { ascending: false })
                .limit(50);

            if (error) throw error;
            return { success: true, data: data };
        } catch (e) {
            return { success: false, message: e.message };
        }
    };

    // Realtime Subscriptions
    window.DB.subscribeToChairs = (callback) => {
        sb.channel('chairs_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chairs' }, payload => {
                callback(payload);
            })
            .subscribe();
    };

    window.DB.subscribeToLogs = (callback) => {
        sb.channel('logs_updates')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'movement_logs' }, payload => {
                callback(payload.new);
            })
            .subscribe();
    };
});
