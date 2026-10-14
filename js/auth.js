/**
 * js/auth.js - Supabase Authentication & Cloud Sync Engine (Vollversion)
 */

window.supabaseClient = window.supabaseClient || null;
window.currentSession = window.currentSession || null;

const SUPABASE_PROJECT_URL = "https://fpzpwzkgthgsjubvfblb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_sYcO0L_nBB0KwecumoqTUw_ZzsvImZ2";

function isValidConfigValue(value) {
    return typeof value === "string" && value.trim() !== "" && !value.includes("DEIN_");
}

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

        window.supabaseClient.auth.onAuthStateChange(async (_event, session) => {
            window.currentSession = session;
            updateAuthUI(session);
            if (session) {
                await loadUserDataFromCloud();
                await syncCloudCasesToLocal();
            }
        });

        window.supabaseClient.auth.getSession().then(async ({ data }) => {
            window.currentSession = data?.session || null;
            updateAuthUI(window.currentSession);
            if (window.currentSession) {
                await loadUserDataFromCloud();
                await syncCloudCasesToLocal();
            }
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
        
        await loadUserDataFromCloud();
        await syncCloudCasesToLocal();

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

        // Account-spezifische Daten aus dem lokalen Browser-Speicher bereinigen
        localStorage.removeItem("user_xp");
        localStorage.removeItem("solved_cases");
        localStorage.removeItem("medcheck_user_progress_v1");
        localStorage.removeItem("medcheck_specialty_progress");
        localStorage.removeItem("custom_cases");

        window.dispatchEvent(new CustomEvent("cloudDataSynced", { detail: { xp: 0 } }));
        window.dispatchEvent(new CustomEvent("cloudCasesSynced", { detail: { cases: [] } }));

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

/**
 * Zieht beim Start/Login alle Profildaten aus Supabase in den Browser.
 */
async function loadUserDataFromCloud() {
    if (!window.supabaseClient || !window.currentSession) return;
    const userId = window.currentSession.user.id;

    try {
        const { data: profile } = await window.supabaseClient
            .from("user_profiles")
            .select("*")
            .eq("id", userId)
            .maybeSingle();

        const { data: progress } = await window.supabaseClient
            .from("user_progress")
            .select("xp, solved_cases")
            .eq("user_id", userId)
            .maybeSingle();

        const cloudXp = Math.max(profile?.xp || 0, progress?.xp || 0);
        const cloudSolved = Array.isArray(profile?.solved_cases) && profile.solved_cases.length > 0 
            ? profile.solved_cases 
            : (progress?.solved_cases || []);

        const localXp = parseInt(localStorage.getItem("user_xp") || "0", 10);
        const localSolved = JSON.parse(localStorage.getItem("solved_cases") || "[]");

        const finalXp = Math.max(localXp, cloudXp);
        localStorage.setItem("user_xp", finalXp.toString());

        const mergedSolved = Array.from(new Set([...localSolved, ...cloudSolved]));
        localStorage.setItem("solved_cases", JSON.stringify(mergedSolved));

        if (profile?.progress_data && Object.keys(profile.progress_data).length > 0) {
            const currentLocalProgress = JSON.parse(localStorage.getItem("medcheck_user_progress_v1") || "{}");
            const merged = { ...profile.progress_data, ...currentLocalProgress };
            localStorage.setItem("medcheck_user_progress_v1", JSON.stringify(merged));
        }

        await syncUserDataWithCloud();

        window.dispatchEvent(new CustomEvent("cloudDataSynced", { detail: { xp: finalXp } }));
    } catch (err) {
        console.error("Fehler beim Laden der Benutzerdaten aus der Cloud:", err);
    }
}

/**
 * Holt alle gespeicherten Fälle des Accounts aus Supabase und spiegelt sie lokal.
 */
async function syncCloudCasesToLocal() {
    if (!window.supabaseClient || !window.currentSession) return;
    try {
        const cloudCases = await window.Cloud.getCloudCases();
        if (!cloudCases) return;

        const formattedCases = cloudCases.map(row => {
            const base = (typeof row.case_data === "object" && row.case_data !== null) ? row.case_data : {};
            return {
                ...base,
                id: row.case_id || base.id,
                case_id: row.case_id || base.case_id,
                title: row.title || base.title || base.metadata?.title || "Fall",
                medical_field: row.medical_field || base.medical_field || base.metadata?.medical_field || "Allgemein",
                folder_name: row.folder_name || base.folder_name || "Allgemein"
            };
        });

        // In den lokalen Schlüsseln spiegeln, die typischerweise von der App genutzt werden
        localStorage.setItem("custom_cases", JSON.stringify(formattedCases));

        window.dispatchEvent(new CustomEvent("cloudCasesSynced", { detail: { cases: formattedCases } }));
        if (typeof window.renderDashboardCases === "function") {
            window.renderDashboardCases();
        } 
            
    } catch (err) {
        console.error("Fehler beim Synchronisieren der Cloud-Fälle:", err);
    }
}

/**
 * Synchronisiert Fortschritt und Punkte mit Supabase.
 */
async function syncUserDataWithCloud() {
    if (!window.supabaseClient || !window.currentSession) return;
    const userId = window.currentSession.user.id;

    try {
        const xp = parseInt(localStorage.getItem("user_xp") || "0", 10);
        const solvedCases = JSON.parse(localStorage.getItem("solved_cases") || "[]");
        const progressData = JSON.parse(localStorage.getItem("medcheck_user_progress_v1") || "{}");
        const specialtyProgress = JSON.parse(localStorage.getItem("medcheck_specialty_progress") || "{}");
        const now = new Date().toISOString();

        await window.supabaseClient.from("user_profiles").upsert({
            id: userId,
            xp: xp,
            solved_cases: solvedCases,
            progress_data: { 
                ...progressData, 
                xp: xp,
                solved_cases: solvedCases,
                __mode_specialty: specialtyProgress 
            },
            updated_at: now
        });

        await window.supabaseClient.from("user_progress").upsert({
            user_id: userId,
            xp: xp,
            solved_cases: solvedCases,
            updated_at: now
        });
    } catch (err) {
        console.error("Cloud-Sync-Fehler:", err);
    }
}

window.Cloud = {
    isLoggedIn: () => !!window.currentSession,
    scheduleProgressSync: () => syncUserDataWithCloud(),
    loadUserData: () => loadUserDataFromCloud(),
    syncCases: () => syncCloudCasesToLocal(),

    saveCloudCase: async (caseData) => {
        if (!window.supabaseClient || !window.currentSession) {
            console.warn("Fall nicht gespeichert: Kein Nutzer eingeloggt.");
            return null;
        }

        const userId = window.currentSession.user.id;
        const caseId = caseData.case_id || caseData.id;

        try {
            const { data: existing } = await window.supabaseClient
                .from("medical_cases")
                .select("id")
                .eq("user_id", userId)
                .eq("case_id", caseId)
                .maybeSingle();

            const payload = {
                user_id: userId,
                case_id: caseId,
                title: caseData.title || caseData.metadata?.title || "Medizinischer Fall",
                medical_field: caseData.medical_field || caseData.metadata?.medical_field || "Allgemein",
                folder_name: caseData.folder_name || caseData.metadata?.folder_name || "Allgemein",
                case_data: caseData,
                updated_at: new Date().toISOString()
            };

            if (existing?.id) {
                payload.id = existing.id;
            }

            const { data, error } = await window.supabaseClient
                .from("medical_cases")
                .upsert(payload);

            if (error) {
                console.error("Fehler beim Speichern in medical_cases:", error);
                throw error;
            }

            await syncCloudCasesToLocal();
            return data;
        } catch (err) {
            console.error("saveCloudCase fehlgeschlagen:", err);
            return null;
        }
    },

    deleteCloudCase: async (caseId) => {
        if (!window.supabaseClient || !window.currentSession) return;
        try {
            const { error } = await window.supabaseClient
                .from("medical_cases")
                .delete()
                .eq("case_id", caseId)
                .eq("user_id", window.currentSession.user.id);

            if (error) throw error;
            await syncCloudCasesToLocal();
        } catch (err) {
            console.error("Fehler beim Löschen des Falls:", err);
        }
    },

    getCloudCases: async () => {
        if (!window.supabaseClient || !window.currentSession) return [];
        try {
            const { data, error } = await window.supabaseClient
                .from("medical_cases")
                .select("*")
                .eq("user_id", window.currentSession.user.id);

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error("Fehler beim Abrufen der Fälle:", err);
            return [];
        }
    }
};
