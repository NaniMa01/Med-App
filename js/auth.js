/**
 * js/auth.js - Supabase Authentication & Cloud Sync Engine
 */

window.supabaseClient = window.supabaseClient || null;
window.currentSession = window.currentSession || null;

// IMPORTANT: Nur die Projekt-Root-URL (ohne /rest/v1/ und ohne doppeltes https://).
const SUPABASE_PROJECT_URL = "https://fpzpwzkgthgsjubvfblb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_sYcO0L_nBB0KwecumoqTUw_ZzsvImZ2";

// Ein Wert gilt nur als gültig, wenn er nicht leer ist und kein Platzhalter ("DEIN_...") ist.
function isValidConfigValue(value) {
    return typeof value === "string" && value.trim() !== "" && !value.includes("DEIN_");
}

// Bereinigt die URL: entfernt doppeltes "https://", Pfade wie /rest/v1/ und Slashes am Ende.
function normalizeSupabaseUrl(raw) {
    if (!isValidConfigValue(raw)) return "";
    try {
        const cleaned = raw.trim().replace(/^(https?:\/\/)+/i, "https://");
        return new URL(cleaned).origin;
    } catch (_err) {
        return "";
    }
}

function getActiveConfig() {
    const rawUrl = isValidConfigValue(window.ENV_SUPABASE_URL) ? window.ENV_SUPABASE_URL : SUPABASE_PROJECT_URL;
    const key = isValidConfigValue(window.ENV_SUPABASE_ANON_KEY) ? window.ENV_SUPABASE_ANON_KEY : SUPABASE_ANON_KEY;
    return { url: normalizeSupabaseUrl(rawUrl), key };
}

function initSupabase() {
    const { url, key } = getActiveConfig();

    if (!isValidConfigValue(url) || !isValidConfigValue(key)) {
        console.warn("Supabase-Konfiguration unvollständig. App läuft im Gastmodus.");
        return false;
    }

    if (typeof supabase === "undefined") {
        console.error("Supabase-SDK wurde nicht geladen.");
        return false;
    }

    try {
        window.supabaseClient = supabase.createClient(url, key);

        window.supabaseClient.auth.onAuthStateChange((_event, session) => {
            window.currentSession = session;
            updateAuthUI(session);
            if (session) syncUserDataWithCloud();
        });

        window.supabaseClient.auth.getSession().then(({ data }) => {
            window.currentSession = data?.session || null;
            updateAuthUI(window.currentSession);
        });

        return true;
    } catch (err) {
        console.error("Supabase Init-Fehler:", err);
        return false;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initSupabase();
});

function showAuthFeedback(type, message) {
    const fb = document.getElementById("auth-fb");
    if (!fb) return;
    fb.style.display = "block";
    fb.className = `feedback-box ${type}`;
    fb.innerHTML = message;
}

function clearAuthFeedback() {
    const fb = document.getElementById("auth-fb");
    if (fb) {
        fb.style.display = "none";
        fb.innerHTML = "";
    }
}

window.authSignIn = async function () {
    if (!window.supabaseClient && !initSupabase()) {
        showAuthFeedback("feedback-error", "Supabase ist nicht konfiguriert. Bitte prüfe den anon-Key.");
        return;
    }

    const emailInput = document.getElementById("auth-email");
    const passInput = document.getElementById("auth-password");
    const email = (emailInput?.value || "").trim().toLowerCase();
    const password = passInput?.value || "";

    if (!email || !password) {
        showAuthFeedback("feedback-error", "Bitte E-Mail-Adresse und Passwort eingeben.");
        return;
    }

    showAuthFeedback("feedback-neutral", "Verbindung wird hergestellt...");

    try {
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            if (error.message.includes("Invalid login credentials")) {
                throw new Error("E-Mail oder Passwort falsch. Falls kein Konto existiert: Registrieren wählen.");
            }
            if (error.message.includes("Email not confirmed")) {
                throw new Error("E-Mail-Adresse noch nicht bestätigt. Bitte Postfach prüfen.");
            }
            throw error;
        }

        clearAuthFeedback();
        showAuthFeedback("feedback-success", `Willkommen, ${data.user.email}!`);
        setTimeout(() => {
            const panel = document.getElementById("auth-panel");
            if (panel) panel.style.display = "none";
        }, 800);

    } catch (err) {
        console.error("Auth-Fehler:", err);
        if (err.name === "AuthRetryableFetchError" || (err.message && err.message.includes("fetch"))) {
            showAuthFeedback(
                "feedback-error",
                "Verbindungsabbruch zu Supabase. Prüfe die Project URL, den anon/public Key und ob das Projekt erreichbar ist."
            );
        } else {
            showAuthFeedback("feedback-error", `Anmeldefehler: ${err.message}`);
        }
    }
};

window.authSignUp = async function () {
    if (!window.supabaseClient && !initSupabase()) {
        showAuthFeedback("feedback-error", "Supabase ist nicht konfiguriert. Bitte prüfe den anon-Key.");
        return;
    }

    const emailInput = document.getElementById("auth-email");
    const passInput = document.getElementById("auth-password");
    const email = (emailInput?.value || "").trim().toLowerCase();
    const password = passInput?.value || "";

    if (!email || !password) {
        showAuthFeedback("feedback-error", "Bitte E-Mail und Passwort angeben.");
        return;
    }

    if (password.length < 6) {
        showAuthFeedback("feedback-error", "Das Passwort muss mindestens 6 Zeichen lang sein.");
        return;
    }

    showAuthFeedback("feedback-neutral", "Konto wird angelegt...");

    try {
        const { data, error } = await window.supabaseClient.auth.signUp({
            email,
            password
        });

        if (error) throw error;

        if (data.user && !data.session) {
            showAuthFeedback("feedback-success", "Registrierung erfolgreich! Bitte Bestätigungslink im Postfach anklicken.");
        } else {
            showAuthFeedback("feedback-success", "Konto erstellt und eingeloggt!");
            setTimeout(() => {
                const panel = document.getElementById("auth-panel");
                if (panel) panel.style.display = "none";
            }, 800);
        }
    } catch (err) {
        console.error("Signup-Fehler:", err);
        if (err.name === "AuthRetryableFetchError" || (err.message && err.message.includes("fetch"))) {
            showAuthFeedback("feedback-error", "Server nicht erreichbar. Bitte Projektstatus und URL prüfen.");
        } else {
            showAuthFeedback("feedback-error", `Registrierungsfehler: ${err.message}`);
        }
    }
};

window.authSignOut = async function () {
    if (!window.supabaseClient) return;
    try {
        await window.supabaseClient.auth.signOut();
        window.currentSession = null;
        updateAuthUI(null);
        showAuthFeedback("feedback-neutral", "Erfolgreich abgemeldet. Die App läuft im Gastmodus.");
        const panel = document.getElementById("auth-panel");
        if (panel) panel.style.display = "block";
    } catch (err) {
        console.error("Fehler beim Abmelden:", err);
    }
};

function updateAuthUI(session) {
    const authUserDiv = document.getElementById("auth-user");
    const authEmailSpan = document.getElementById("auth-user-email");
    const authPanel = document.getElementById("auth-panel");

    if (session && session.user) {
        if (authUserDiv) authUserDiv.style.display = "flex";
        if (authEmailSpan) authEmailSpan.innerText = session.user.email;
        if (authPanel) authPanel.style.display = "none";
    } else {
        if (authUserDiv) authUserDiv.style.display = "none";
        if (authEmailSpan) authEmailSpan.innerText = "";
        if (authPanel) authPanel.style.display = "block";
    }
}

async function syncUserDataWithCloud() {
    if (!window.supabaseClient || !window.currentSession) return;
    const userId = window.currentSession.user.id;

    try {
        const xp = parseInt(localStorage.getItem("user_xp") || "0");
        const solvedCases = JSON.parse(localStorage.getItem("solved_cases") || "[]");
        const progressData = JSON.parse(localStorage.getItem("medcheck_user_progress_v1") || "{}");

        await window.supabaseClient.from("user_profiles").upsert({
            id: userId,
            xp: xp,
            solved_cases: solvedCases,
            progress_data: progressData,
            updated_at: new Date().toISOString()
        });
    } catch (err) {
        console.error("Cloud-Sync-Fehler:", err);
    }
}

window.Cloud = {
    isLoggedIn: () => !!window.currentSession,
    scheduleProgressSync: () => syncUserDataWithCloud(),
    saveCloudCase: async (caseData) => {
        if (!window.supabaseClient || !window.currentSession) return;
        return window.supabaseClient.from("medical_cases").upsert({
            case_id: caseData.case_id,
            user_id: window.currentSession.user.id,
            data: caseData,
            updated_at: new Date().toISOString()
        });
    },
    deleteCloudCase: async (caseId) => {
        if (!window.supabaseClient || !window.currentSession) return;
        return window.supabaseClient.from("medical_cases").delete().eq("case_id", caseId).eq("user_id", window.currentSession.user.id);
    }
};
