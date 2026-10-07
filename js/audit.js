/**
 * js/auth.js - Supabase Authentication & Cloud Sync Engine
 * Robuste Initialisierung mit automatischer Fallback-Kette (Inline -> API -> Hardcoded)
 */

let supabaseClient = null;
window.currentSession = null;

// Echte Projekt-Werte deines Dashboards als garantierter Fallback
const DEFAULT_SUPABASE_URL = "https://fpzpwzkgthgsjubvflbl.supabase.co";
// Trage hier deinen anon-Key aus Project Settings -> API ein:
const DEFAULT_SUPABASE_ANON_KEY = "DEIN_ANON_KEY_HIER_EINTRAGEN";

/**
 * Ermittelt die Konfiguration aus allen verfügbaren Quellen
 */
async function resolveSupabaseConfig() {
    // 1. Priorität: Bereits im window gesetzt (z. B. via <head> in index.html)
    if (window.ENV_SUPABASE_URL && window.ENV_SUPABASE_ANON_KEY && !window.ENV_SUPABASE_ANON_KEY.includes('DEIN_')) {
        return {
            url: window.ENV_SUPABASE_URL,
            key: window.ENV_SUPABASE_ANON_KEY
        };
    }

    // 2. Priorität: Vercel Serverless Endpoint /api/config abfragen
    try {
        const res = await fetch('/api/config');
        if (res.ok) {
            const data = await res.json();
            if (data.supabaseUrl && data.supabaseAnonKey) {
                return {
                    url: data.supabaseUrl,
                    key: data.supabaseAnonKey
                };
            }
        }
    } catch (_err) {
        // Lokale Ausführung ohne Serverless Function – Fallback greift
    }

    // 3. Priorität: Lokale Standardkonfiguration
    return {
        url: DEFAULT_SUPABASE_URL,
        key: DEFAULT_SUPABASE_ANON_KEY
    };
}

/**
 * Initialisiert den Supabase-Client asynchron und bindet ihn an die App
 */
async function initSupabase() {
    const config = await resolveSupabaseConfig();

    if (typeof supabase === 'undefined') {
        console.error('Supabase CDN-Bibliothek nicht geladen.');
        return;
    }

    if (config.url && config.key && !config.key.includes('DEIN_')) {
        try {
            supabaseClient = supabase.createClient(config.url, config.key);
            
            // Session-Status überwachen
            supabaseClient.auth.onAuthStateChange((event, session) => {
                window.currentSession = session;
                updateAuthUI(session);
                if (session) {
                    syncUserDataWithCloud();
                }
            });

            // Initialen Session-Status abfragen
            const { data } = await supabaseClient.auth.getSession();
            window.currentSession = data.session;
            updateAuthUI(data.session);

        } catch (e) {
            console.error('Fehler bei der Initialisierung des Supabase Clients:', e);
        }
    } else {
        console.warn('Supabase ist nicht vollständig konfiguriert. App läuft im Gastmodus.');
    }
}

// Initialisierung sofort beim Laden starten
initSupabase();

// ----------------------------------------------------
// UI-FEEDBACK
// ----------------------------------------------------
function showAuthFeedback(type, message) {
    const fb = document.getElementById('auth-fb');
    if (!fb) return;
    fb.style.display = 'block';
    fb.className = `feedback-box ${type}`;
    fb.innerHTML = message;
}

function clearAuthFeedback() {
    const fb = document.getElementById('auth-fb');
    if (fb) {
        fb.style.display = 'none';
        fb.innerHTML = '';
    }
}

// ----------------------------------------------------
// GLOBALE AUTH-AKTIONEN
// ----------------------------------------------------

window.authSignIn = async function () {
    if (!supabaseClient) {
        await initSupabase();
        if (!supabaseClient) {
            showAuthFeedback('feedback-error', 'Supabase ist nicht initialisiert. Bitte API-Key hinterlegen.');
            return;
        }
    }

    const emailInput = document.getElementById('auth-email');
    const passInput = document.getElementById('auth-password');
    const email = (emailInput?.value || '').trim().toLowerCase();
    const password = passInput?.value || '';

    if (!email || !password) {
        showAuthFeedback('feedback-error', 'Bitte E-Mail-Adresse und Passwort eingeben.');
        return;
    }

    showAuthFeedback('feedback-neutral', 'Anmeldung läuft...');

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            if (error.message.includes('Invalid login credentials')) {
                throw new Error('E-Mail oder Passwort ungültig. Falls du noch kein Konto hast, klicke auf "Registrieren".');
            }
            if (error.message.includes('Email not confirmed')) {
                throw new Error('E-Mail-Adresse wurde noch nicht bestätigt. Bitte Posteingang prüfen.');
            }
            throw error;
        }

        clearAuthFeedback();
        showAuthFeedback('feedback-success', `Willkommen zurück, ${data.user.email}!`);
        setTimeout(() => {
            const panel = document.getElementById('auth-panel');
            if (panel) panel.style.display = 'none';
        }, 800);

    } catch (err) {
        showAuthFeedback('feedback-error', `Anmeldefehler: ${err.message}`);
    }
};

window.authSignUp = async function () {
    if (!supabaseClient) {
        await initSupabase();
        if (!supabaseClient) {
            showAuthFeedback('feedback-error', 'Supabase ist nicht initialisiert. Bitte API-Key hinterlegen.');
            return;
        }
    }

    const emailInput = document.getElementById('auth-email');
    const passInput = document.getElementById('auth-password');
    const email = (emailInput?.value || '').trim().toLowerCase();
    const password = passInput?.value || '';

    if (!email || !password) {
        showAuthFeedback('feedback-error', 'Bitte E-Mail und ein sicheres Passwort eingeben.');
        return;
    }

    if (password.length < 6) {
        showAuthFeedback('feedback-error', 'Das Passwort muss mindestens 6 Zeichen lang sein.');
        return;
    }

    showAuthFeedback('feedback-neutral', 'Konto wird erstellt...');

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password
        });

        if (error) throw error;

        if (data.user && !data.session) {
            showAuthFeedback('feedback-success', 'Registrierung erfolgreich! Bitte bestätige den Aktivierungslink in deiner E-Mail.');
        } else {
            showAuthFeedback('feedback-success', 'Erfolgreich registriert und angemeldet!');
            setTimeout(() => {
                const panel = document.getElementById('auth-panel');
                if (panel) panel.style.display = 'none';
            }, 800);
        }
    } catch (err) {
        showAuthFeedback('feedback-error', `Registrierungsfehler: ${err.message}`);
    }
};

window.authSignOut = async function () {
    if (!supabaseClient) return;
    try {
        await supabaseClient.auth.signOut();
        window.currentSession = null;
        updateAuthUI(null);
        showAuthFeedback('feedback-neutral', 'Erfolgreich abgemeldet. Die App läuft im Gastmodus.');
        const panel = document.getElementById('auth-panel');
        if (panel) panel.style.display = 'block';
    } catch (err) {
        console.error('Fehler beim Abmelden:', err);
    }
};

// ----------------------------------------------------
// UI-SYNCHRONISATION
// ----------------------------------------------------

function updateAuthUI(session) {
    const authUserDiv = document.getElementById('auth-user');
    const authEmailSpan = document.getElementById('auth-user-email');
    const authPanel = document.getElementById('auth-panel');

    if (session && session.user) {
        if (authUserDiv) authUserDiv.style.display = 'flex';
        if (authEmailSpan) authEmailSpan.innerText = session.user.email;
        if (authPanel) authPanel.style.display = 'none';
    } else {
        if (authUserDiv) authUserDiv.style.display = 'none';
        if (authEmailSpan) authEmailSpan.innerText = '';
        if (authPanel) authPanel.style.display = 'block';
    }
}

// ----------------------------------------------------
// CLOUD-DATENSYNCHRONISATION
// ----------------------------------------------------

async function syncUserDataWithCloud() {
    if (!supabaseClient || !window.currentSession) return;
    const userId = window.currentSession.user.id;

    try {
        const xp = parseInt(localStorage.getItem('user_xp') || '0');
        const solvedCases = JSON.parse(localStorage.getItem('solved_cases') || '[]');
        const progressData = JSON.parse(localStorage.getItem('medcheck_user_progress_v1') || '{}');

        await supabaseClient.from('user_profiles').upsert({
            id: userId,
            xp: xp,
            solved_cases: solvedCases,
            progress_data: progressData,
            updated_at: new Date().toISOString()
        });
    } catch (err) {
        console.error('Fehler bei der Cloud-Synchronisation:', err);
    }
}

// Globales Cloud-Interface für app.js
window.Cloud = {
    isLoggedIn: () => !!window.currentSession,
    scheduleProgressSync: () => syncUserDataWithCloud(),
    saveCloudCase: async (caseData) => {
        if (!supabaseClient || !window.currentSession) return;
        return supabaseClient.from('medical_cases').upsert({
            case_id: caseData.case_id,
            user_id: window.currentSession.user.id,
            data: caseData,
            updated_at: new Date().toISOString()
        });
    },
    deleteCloudCase: async (caseId) => {
        if (!supabaseClient || !window.currentSession) return;
        return supabaseClient.from('medical_cases').delete().eq('case_id', caseId).eq('user_id', window.currentSession.user.id);
    }
};
