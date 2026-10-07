/**
 * js/auth.js - Supabase Authentication & Cloud Sync Engine
 */

let supabaseClient = null;
window.currentSession = null;

// Initialisierung von Supabase
(function initSupabase() {
    // Greift auf window.ENV_SUPABASE_URL zu (definiert in api/config.js oder via Vercel/Netlify Injection)
    const SUPABASE_URL = window.ENV_SUPABASE_URL || (typeof ENV !== 'undefined' ? ENV.SUPABASE_URL : '');
    const SUPABASE_ANON_KEY = window.ENV_SUPABASE_ANON_KEY || (typeof ENV !== 'undefined' ? ENV.SUPABASE_ANON_KEY : '');

    if (SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('DEINE_')) {
        try {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            
            supabaseClient.auth.onAuthStateChange((event, session) => {
                window.currentSession = session;
                updateAuthUI(session);
                if (session) {
                    syncUserDataWithCloud();
                }
            });
        } catch (e) {
            console.error('Fehler beim Init von Supabase Client:', e);
        }
    } else {
        console.warn('Supabase ist nicht konfiguriert. App läuft im lokalen Gastmodus.');
    }
})();

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
// GLOBALE AUTH-FUNKTIONEN
// ----------------------------------------------------

window.authSignIn = async function () {
    if (!supabaseClient) {
        await initSupabase();
        if (!supabaseClient) {
            showAuthFeedback('feedback-error', 'Supabase ist nicht initialisiert. Bitte API-Key prüfen.');
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

    showAuthFeedback('feedback-neutral', 'Verbindung zu Supabase wird aufgebaut...');

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            if (error.message.includes('Invalid login credentials')) {
                throw new Error('E-Mail oder Passwort falsch. Klicke auf "Registrieren", falls noch kein Account existiert.');
            }
            if (error.message.includes('Email not confirmed')) {
                throw new Error('E-Mail-Adresse ist noch nicht bestätigt. Bitte Posteingang prüfen.');
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
        console.error('Auth-Netzwerkfehler:', err);
        
        // Spezifische Aufschlüsselung von "Failed to fetch"
        if (err.name === 'TypeError' && err.message.includes('fetch')) {
            showAuthFeedback(
                'feedback-error', 
                'Verbindungsfehler: Der Supabase-Server konnte nicht erreicht werden. Mögliche Ursachen: Projekt pausiert, falsche URL, Adblocker aktiv oder keine Internetverbindung.'
            );
        } else {
            showAuthFeedback('feedback-error', `Anmeldefehler: ${err.message}`);
        }
    }
};

window.authSignUp = async function () {
    if (!supabaseClient) {
        await initSupabase();
        if (!supabaseClient) {
            showAuthFeedback('feedback-error', 'Supabase ist nicht initialisiert. Bitte API-Key prüfen.');
            return;
        }
    }

    const emailInput = document.getElementById('auth-email');
    const passInput = document.getElementById('auth-password');
    const email = (emailInput?.value || '').trim().toLowerCase();
    const password = passInput?.value || '';

    if (!email || !password) {
        showAuthFeedback('feedback-error', 'Bitte E-Mail und Passwort eingeben.');
        return;
    }

    if (password.length < 6) {
        showAuthFeedback('feedback-error', 'Das Passwort muss mindestens 6 Zeichen lang sein.');
        return;
    }

    showAuthFeedback('feedback-neutral', 'Registrierung wird übermittelt...');

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password
        });

        if (error) throw error;

        if (data.user && !data.session) {
            showAuthFeedback('feedback-success', 'Konto angelegt! Bitte Bestätigungslink im Postfach anklicken.');
        } else {
            showAuthFeedback('feedback-success', 'Erfolgreich registriert und angemeldet!');
            setTimeout(() => {
                const panel = document.getElementById('auth-panel');
                if (panel) panel.style.display = 'none';
            }, 800);
        }
    } catch (err) {
        console.error('Signup-Netzwerkfehler:', err);
        if (err.name === 'TypeError' && err.message.includes('fetch')) {
            showAuthFeedback('feedback-error', 'Server nicht erreichbar (Failed to fetch). Bitte Adblocker deaktivieren oder Projektstatus prüfen.');
        } else {
            showAuthFeedback('feedback-error', `Registrierungsfehler: ${err.message}`);
        }
    }
};

window.authSignOut = async function() {
    if (!supabaseClient) return;
    try {
        await supabaseClient.auth.signOut();
        window.currentSession = null;
        updateAuthUI(null);
        showAuthFeedback('feedback-neutral', 'Erfolgreich abgemeldet. App läuft im Gastmodus.');
        const panel = document.getElementById('auth-panel');
        if (panel) panel.style.display = 'block';
    } catch (err) {
        console.error('Fehler beim Abmelden:', err);
    }
};

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
        console.error('Cloud-Sync Fehler:', err);
    }
}

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
