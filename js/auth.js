// SUPABASE AUTH + CLOUD-SPEICHER (Gastmodus bleibt über localStorage erhalten)
(function () {
// ====================================================
// MEDCHECK AUTH & CLOUD SYNC ENGINE (V6.0 CORNELL EDITION)
// ====================================================

(function() {
let client = null;
let session = null;
    let syncedUserId = null;
    let progressTimer = null;
    let applyingRemote = false;

    const $ = id => document.getElementById(id);

    function sanitizeCaseId(id) {
        return String(id || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    }
    let syncTimer = null;

function readJson(key, fallback) {
try {
            const value = JSON.parse(localStorage.getItem(key));
            return value === null || value === undefined ? fallback : value;
        } catch (_e) {
            const v = localStorage.getItem(key);
            return v ? JSON.parse(v) : fallback;
        } catch (_) {
return fallback;
}
}

    function translateError(error) {
        const msg = String(error?.message || error || '');
        if (/invalid login credentials/i.test(msg)) return 'E-Mail oder Passwort ist falsch.';
        if (/email not confirmed/i.test(msg)) return 'Bitte bestätige zuerst deine E-Mail-Adresse.';
        if (/already registered|already been registered/i.test(msg)) return 'Diese E-Mail ist bereits registriert.';
        if (/password should be at least|weak password/i.test(msg)) return 'Das Passwort ist zu schwach (mindestens 6 Zeichen).';
        if (/invalid.*email|unable to validate email/i.test(msg)) return 'Bitte gib eine gültige E-Mail-Adresse ein.';
        if (/rate limit|too many/i.test(msg)) return 'Zu viele Versuche. Bitte warte einen Moment.';
        if (/failed to fetch|network/i.test(msg)) return 'Netzwerkfehler. Bitte Verbindung prüfen.';
        return msg || 'Unbekannter Fehler.';
    function writeJson(key, val) {
        try {
            localStorage.setItem(key, JSON.stringify(val));
        } catch (e) {
            console.error('Fehler beim Schreiben in localStorage:', e);
        }
    }

    function requireSession() {
        if (!session || !session.user) {
            throw new Error('Keine aktive Sitzung vorhanden.');
        }
}

    function showAuthMessage(type, text) {
        const fb = $('auth-fb');
    function showAuthFeedback(type, message) {
        const fb = document.getElementById('auth-fb');
if (!fb) return;
        fb.style.display = text ? 'block' : 'none';
        fb.style.display = 'block';
fb.className = `feedback-box ${type}`;
        fb.textContent = text || '';
        fb.innerHTML = message;
}

function updateAuthUI() {
        const loggedIn = !!session;
        const panel = $('auth-panel');
        const user = $('auth-user');
        if (panel) panel.style.display = loggedIn ? 'none' : 'block';
        if (user) user.style.display = loggedIn ? 'flex' : 'none';
        const email = $('auth-user-email');
        if (email) email.textContent = session?.user?.email || '';
        const userDiv = document.getElementById('auth-user');
        const emailSpan = document.getElementById('auth-user-email');
        const panel = document.getElementById('auth-panel');

        if (session && session.user) {
            if (userDiv) userDiv.style.display = 'flex';
            if (emailSpan) emailSpan.textContent = session.user.email || 'Angemeldet';
            if (panel) panel.style.display = 'none';
        } else {
            if (userDiv) userDiv.style.display = 'none';
            if (emailSpan) emailSpan.textContent = '';
            if (panel) panel.style.display = 'block';
        }
}

    // ---------- Cloud-Zugriff (RLS schützt die Daten, nur Anon-Key + Nutzer-Session) ----------
    function requireSession() {
        if (!client || !session) throw new Error('Nicht angemeldet.');
    async function initSupabase() {
        try {
            const res = await fetch('/api/config');
            if (!res.ok) throw new Error(`HTTP ${res.status} beim Laden von /api/config`);
            const cfg = await res.json();
            if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
                console.warn('Supabase ist nicht konfiguriert (Gast-Modus aktiv).');
                return;
            }

            if (typeof supabase === 'undefined' || !supabase.createClient) {
                console.warn('Supabase JS SDK nicht geladen.');
                return;
            }

            client = supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
            window.supabaseClient = client;

            const { data } = await client.auth.getSession();
            session = data?.session || null;
            window.currentSession = session;
            updateAuthUI();

            if (session) {
                await syncAllOnLogin();
            }

            client.auth.onAuthStateChange(async (event, newSession) => {
                session = newSession;
                window.currentSession = session;
                updateAuthUI();

                if (event === 'SIGNED_IN' && session) {
                    await syncAllOnLogin();
                } else if (event === 'SIGNED_OUT') {
                    showAuthFeedback('feedback-neutral', 'Erfolgreich abgemeldet.');
                    if (typeof renderDashboardCases === 'function') {
                        renderDashboardCases();
                    }
                }
            });
        } catch (err) {
            console.error('Fehler bei der Supabase-Initialisierung:', err);
        }
}

    async function loadCloudCases() {
        requireSession();
        const { data, error } = await client.from('medical_cases').select('case_id, case_data');
        if (error) throw error;
        return (data || []).map(row => ({ ...row.case_data, case_id: row.case_id }));
    async function syncAllOnLogin() {
        try {
            await loadProgress();
            await loadCloudCases();
            if (typeof renderDashboardCases === 'function') {
                renderDashboardCases();
            }
        } catch (err) {
            console.error('Sync-Fehler beim Login:', err);
        }
}

    async function saveCloudCase(caseObj) {
        requireSession();
        const caseId = sanitizeCaseId(caseObj.case_id);
        if (!caseId) throw new Error('Ungültige case_id.');
    async function saveProgress() {
        if (!client || !session) return;

        const folder_order = readJson('medcheck_folder_order', []);
        const folder_state = typeof bookshelfFolderState !== 'undefined' 
            ? bookshelfFolderState 
            : readJson('medcheck_folder_state', {});

const row = {
user_id: session.user.id,
            case_id: caseId,
            title: caseObj.metadata?.title || null,
            medical_field: caseObj.metadata?.medical_field || null,
            case_data: { ...caseObj, case_id: caseId },
            xp: parseInt(localStorage.getItem('user_xp') || '0', 10) || 0,
            solved_cases: readJson('solved_cases', []),
            skills: readJson('user_skills', {}),
            folder_order,
            folder_state,
updated_at: new Date().toISOString()
};
        const { error } = await client.from('medical_cases').upsert(row, { onConflict: 'user_id,case_id' });
        if (error) throw error;

        const { error } = await client.from('user_progress').upsert(row, { onConflict: 'user_id' });
        if (error) {
            console.error('Fehler beim Speichern von user_progress:', error);
            throw error;
        }
}

    async function deleteCloudCase(caseId) {
        requireSession();
        const { error } = await client
            .from('medical_cases')
            .delete()
    async function loadProgress() {
        if (!client || !session) return;
        
        const { data, error } = await client
            .from('user_progress')
            .select('*')
.eq('user_id', session.user.id)
            .eq('case_id', sanitizeCaseId(caseId));
        if (error) throw error;
    }
            .maybeSingle();

async function loadProgress() {
        requireSession();
        const { data, error } = await client.from('user_progress').select('*').eq('user_id', session.user.id).maybeSingle();
if (error) throw error;

if (data) {
            // Nativer localStorage-Zugriff ohne fehlerhafte Hilfsfunktionen
localStorage.setItem('user_xp', String(data.xp || 0));
            localStorage.setItem('solved_cases', JSON.stringify(data.solved_cases || []));
            localStorage.setItem('user_skills', JSON.stringify(data.skills || {}));
            writeJson('solved_cases', data.solved_cases || []);
            writeJson('user_skills', data.skills || {});

            // Ordnerstruktur und Klapp-Status aus der Cloud wiederherstellen
if (Array.isArray(data.folder_order) && data.folder_order.length > 0) {
                localStorage.setItem('medcheck_folder_order', JSON.stringify(data.folder_order));
                writeJson('medcheck_folder_order', data.folder_order);
}
if (data.folder_state && typeof data.folder_state === 'object') {
                localStorage.setItem('medcheck_folder_state', JSON.stringify(data.folder_state));
                writeJson('medcheck_folder_state', data.folder_state);
if (typeof bookshelfFolderState !== 'undefined') {
Object.assign(bookshelfFolderState, data.folder_state);
}
}

if (typeof updateStatsUI === 'function') updateStatsUI();
if (typeof renderSkillsSidebar === 'function') renderSkillsSidebar();
            if (typeof renderDashboardCases === 'function') renderDashboardCases();
}
}
            // ==========================================================

            updateStatsUI();
            renderSkillsSidebar();
            if (typeof renderDashboardCases === 'function') {
                renderDashboardCases();
            }
        }
    }
    async function saveCloudCase(caseObj) {
        if (!client || !session) return;

async function saveProgress() {
        requireSession();
        
        // NEU: Ordnerstruktur aus dem Browser-Cache auslesen
        const folder_order = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
        const folder_state = typeof bookshelfFolderState !== 'undefined' 
            ? bookshelfFolderState 
            : JSON.parse(localStorage.getItem('medcheck_folder_state') || '{}');
        const folderName = (caseObj.folder_name || caseObj.metadata?.medical_field || 'Allgemein').trim();
        const cleanCase = { ...caseObj, folder_name: folderName };

const row = {
user_id: session.user.id,
            xp: parseInt(localStorage.getItem('user_xp') || '0', 10) || 0,
            solved_cases: readJson('solved_cases', []),
            skills: readJson('user_skills', {}),
            folder_order, // NEU: Wird in die Cloud geschrieben
            folder_state, // NEU: Wird in die Cloud geschrieben
            case_id: cleanCase.case_id,
            title: cleanCase.metadata?.title || cleanCase.case_id,
            medical_field: cleanCase.metadata?.medical_field || null,
            folder_name: folderName,
            case_data: cleanCase,
updated_at: new Date().toISOString()
};
        const { error } = await client.from('user_progress').upsert(row, { onConflict: 'user_id' });

        const { error } = await client.from('medical_cases').upsert(row, { onConflict: 'user_id,case_id' });
if (error) throw error;
}
    function scheduleProgressSync() {
        if (!session || applyingRemote) return;
        clearTimeout(progressTimer);
        progressTimer = setTimeout(() => {
            saveProgress().catch(err => console.warn('Fortschritt konnte nicht gespeichert werden:', err));
        }, 1500);
    }

    // ---------- Synchronisation nach Login ----------
    function mergeProgress(remote) {
        const localXp = parseInt(localStorage.getItem('user_xp') || '0', 10) || 0;
        const localSolved = readJson('solved_cases', []);
        const localSkills = readJson('user_skills', {});
        if (!remote) return { xp: localXp, solved: localSolved, skills: localSkills };

        const solved = Array.from(new Set([...(remote.solved_cases || []), ...localSolved]));
        const skills = { ...localSkills };
        Object.entries(remote.skills || {}).forEach(([name, val]) => {
            if (!skills[name] || (val?.total || 0) > (skills[name]?.total || 0)) skills[name] = val;
    async function loadCloudCases() {
        if (!client || !session) return [];

        const { data, error } = await client
            .from('medical_cases')
            .select('*')
            .eq('user_id', session.user.id);

        if (error) throw error;

        const cloudCases = (data || []).map(row => {
            const c = row.case_data || {};
            c.folder_name = row.folder_name || c.folder_name || c.metadata?.medical_field || 'Allgemein';
            return c;
});
        return { xp: Math.max(localXp, remote.xp || 0), solved, skills };

        const localCases = readJson('custom_cases', []);
        const merged = new Map();
        localCases.forEach(c => merged.set(c.case_id, c));
        cloudCases.forEach(c => merged.set(c.case_id, c));

        const finalCases = Array.from(merged.values());
        writeJson('custom_cases', finalCases);
        return finalCases;
}

    async function syncAfterLogin() {
        applyingRemote = true;
        try {
            const cloudCases = await loadCloudCases();
            const localCases = readJson('custom_cases', []);
            const cloudIds = new Set(cloudCases.map(c => c.case_id));
            const localOnly = (Array.isArray(localCases) ? localCases : [])
                .filter(c => c && c.case_id)
                .map(c => ({ ...c, case_id: sanitizeCaseId(c.case_id) }))
                .filter(c => c.case_id && !cloudIds.has(c.case_id));

            await Promise.all(localOnly.map(saveCloudCase));
            localStorage.setItem('custom_cases', JSON.stringify([...localOnly, ...cloudCases]));

            const merged = mergeProgress(await loadProgress());
            localStorage.setItem('user_xp', String(merged.xp));
            localStorage.setItem('solved_cases', JSON.stringify(merged.solved));
            localStorage.setItem('user_skills', JSON.stringify(merged.skills));
            await saveProgress();

            if (typeof initUserData === 'function') initUserData();
            if (typeof renderSkillsSidebar === 'function') renderSkillsSidebar();
            showAuthMessage('feedback-success', '');
        } catch (err) {
            console.warn('Cloud-Synchronisation fehlgeschlagen:', err);
            alert(`Online-Synchronisation fehlgeschlagen: ${translateError(err)}\nDie App läuft lokal weiter.`);
        } finally {
            applyingRemote = false;
            if (typeof renderDashboardCases === 'function') renderDashboardCases();
        }
    async function deleteCloudCase(caseId) {
        if (!client || !session) return;
        const { error } = await client
            .from('medical_cases')
            .delete()
            .eq('user_id', session.user.id)
            .eq('case_id', caseId);
        if (error) throw error;
}

    // ---------- Auth-Aktionen ----------
    function readCredentials() {
        return {
            email: ($('auth-email')?.value || '').trim(),
            password: $('auth-password')?.value || ''
        };
    function scheduleProgressSync() {
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = setTimeout(() => {
            saveProgress().catch(err => console.error('Hintergrund-Sync fehlgeschlagen:', err));
        }, 1200);
}

    async function runAuth(action, busyText) {
        if (!client) {
            showAuthMessage('feedback-error', 'Online-Speicherung ist nicht konfiguriert (Gastmodus).');
            return;
        }
        const { email, password } = readCredentials();
    window.Cloud = {
        isLoggedIn: () => Boolean(session && session.user),
        saveProgress,
        loadProgress,
        saveCloudCase,
        loadCloudCases,
        deleteCloudCase,
        scheduleProgressSync
    };

    window.authSignIn = async function() {
        const emailEl = document.getElementById('auth-email');
        const passEl = document.getElementById('auth-password');
        if (!emailEl || !passEl) return;

        const email = emailEl.value.trim();
        const password = passEl.value;

if (!email || !password) {
            showAuthMessage('feedback-error', 'Bitte E-Mail und Passwort eingeben.');
            showAuthFeedback('feedback-error', 'Bitte E-Mail und Passwort eingeben.');
return;
}
        showAuthMessage('feedback-neutral', busyText);

        showAuthFeedback('feedback-neutral', 'Anmeldung läuft...');
try {
            await action(email, password);
            if (!client) throw new Error('Supabase ist nicht konfiguriert oder nicht erreichbar.');
            const { error } = await client.auth.signInWithPassword({ email, password });
            if (error) throw error;
            showAuthFeedback('feedback-success', 'Erfolgreich angemeldet!');
            emailEl.value = '';
            passEl.value = '';
} catch (err) {
            showAuthMessage('feedback-error', translateError(err));
            showAuthFeedback('feedback-error', `Anmeldefehler: ${err.message}`);
}
    }
    };

    window.authSignIn = () => runAuth(async (email, password) => {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        $('auth-password').value = '';
        showAuthMessage('feedback-success', '');
    }, 'Anmeldung läuft...');
    window.authSignUp = async function() {
        const emailEl = document.getElementById('auth-email');
        const passEl = document.getElementById('auth-password');
        if (!emailEl || !passEl) return;

    window.authSignUp = () => runAuth(async (email, password) => {
        const { data, error } = await client.auth.signUp({ email, password });
        if (error) throw error;
        $('auth-password').value = '';
        showAuthMessage(
            'feedback-success',
            data.session
                ? 'Registrierung erfolgreich. Du bist angemeldet.'
                : 'Registrierung erfolgreich. Bitte bestätige deine E-Mail-Adresse und melde dich danach an.'
        );
    }, 'Registrierung läuft...');

    window.authSignOut = async function () {
        if (!client) return;
        const { error } = await client.auth.signOut();
        if (error) alert(`Abmelden fehlgeschlagen: ${translateError(error)}`);
    };
        const email = emailEl.value.trim();
        const password = passEl.value;

    window.Cloud = {
        isLoggedIn: () => !!session,
        getSession: () => session,
        getAccessToken: () => session?.access_token || null,
        loadCloudCases,
        saveCloudCase,
        deleteCloudCase,
        loadProgress,
        saveProgress,
        scheduleProgressSync
    };
        if (!email || !password) {
            showAuthFeedback('feedback-error', 'Bitte E-Mail und Passwort eingeben.');
            return;
        }

    async function initAuth() {
        updateAuthUI();
        showAuthFeedback('feedback-neutral', 'Registrierung läuft...');
try {
            if (!window.supabase || !window.supabase.createClient) throw new Error('Supabase-Client nicht geladen.');
            const res = await fetch('/api/config');
            const config = await res.json();
            if (!res.ok || !config.supabaseUrl || !config.supabaseAnonKey) throw new Error('Supabase ist nicht konfiguriert.');
            if (!client) throw new Error('Supabase ist nicht konfiguriert oder nicht erreichbar.');
            const { data, error } = await client.auth.signUp({ email, password });
            if (error) throw error;

            client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
            client.auth.onAuthStateChange((_event, newSession) => {
                const previousId = session?.user?.id || null;
                session = newSession || null;
                updateAuthUI();
                const userId = session?.user?.id || null;
                if (userId && userId !== syncedUserId) {
                    syncedUserId = userId;
                    // außerhalb des Auth-Callbacks ausführen (Supabase-Empfehlung)
                    setTimeout(syncAfterLogin, 0);
                } else if (!userId) {
                    syncedUserId = null;
                    if (previousId && typeof renderDashboardCases === 'function') renderDashboardCases();
                }
            });
            if (data.session) {
                showAuthFeedback('feedback-success', 'Konto erstellt und direkt angemeldet!');
            } else {
                showAuthFeedback('feedback-success', 'Registrierung erfolgreich! Bitte bestätige ggf. deine E-Mail.');
            }
} catch (err) {
            console.info('Gastmodus (nur localStorage):', err.message);
            showAuthMessage('feedback-neutral', 'Gastmodus: Online-Speicherung ist aktuell nicht verfügbar. Deine Daten bleiben lokal gespeichert.');
            showAuthFeedback('feedback-error', `Registrierungsfehler: ${err.message}`);
}
    }
    };

    window.authSignOut = async function() {
        try {
            if (!client) return;
            await client.auth.signOut();
        } catch (err) {
            console.error('Abmeldefehler:', err);
        }
    };

    document.addEventListener('DOMContentLoaded', initAuth);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSupabase);
    } else {
        initSupabase();
    }
})();
