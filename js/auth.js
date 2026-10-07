// ====================================================
// MEDCHECK AUTH & CLOUD SYNC ENGINE (V6.0 CORNELL EDITION)
// ====================================================

(function() {
    let client = null;
    let session = null;
    let syncTimer = null;

    function readJson(key, fallback) {
        try {
            const v = localStorage.getItem(key);
            return v ? JSON.parse(v) : fallback;
        } catch (_) {
            return fallback;
        }
    }

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

    function showAuthFeedback(type, message) {
        const fb = document.getElementById('auth-fb');
        if (!fb) return;
        fb.style.display = 'block';
        fb.className = `feedback-box ${type}`;
        fb.innerHTML = message;
    }

    function updateAuthUI() {
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

    async function saveProgress() {
        if (!client || !session) return;

        const folder_order = readJson('medcheck_folder_order', []);
        const folder_state = typeof bookshelfFolderState !== 'undefined' 
            ? bookshelfFolderState 
            : readJson('medcheck_folder_state', {});

        const row = {
            user_id: session.user.id,
            xp: parseInt(localStorage.getItem('user_xp') || '0', 10) || 0,
            solved_cases: readJson('solved_cases', []),
            skills: readJson('user_skills', {}),
            folder_order,
            folder_state,
            updated_at: new Date().toISOString()
        };

        const { error } = await client.from('user_progress').upsert(row, { onConflict: 'user_id' });
        if (error) {
            console.error('Fehler beim Speichern von user_progress:', error);
            throw error;
        }
    }

    async function loadProgress() {
        if (!client || !session) return;
        
        const { data, error } = await client
            .from('user_progress')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();

        if (error) throw error;

        if (data) {
            localStorage.setItem('user_xp', String(data.xp || 0));
            writeJson('solved_cases', data.solved_cases || []);
            writeJson('user_skills', data.skills || {});

            if (Array.isArray(data.folder_order) && data.folder_order.length > 0) {
                writeJson('medcheck_folder_order', data.folder_order);
            }
            if (data.folder_state && typeof data.folder_state === 'object') {
                writeJson('medcheck_folder_state', data.folder_state);
                if (typeof bookshelfFolderState !== 'undefined') {
                    Object.assign(bookshelfFolderState, data.folder_state);
                }
            }

            if (typeof updateStatsUI === 'function') updateStatsUI();
            if (typeof renderSkillsSidebar === 'function') renderSkillsSidebar();
        }
    }

    async function saveCloudCase(caseObj) {
        if (!client || !session) return;

        const folderName = (caseObj.folder_name || caseObj.metadata?.medical_field || 'Allgemein').trim();
        const cleanCase = { ...caseObj, folder_name: folderName };

        const row = {
            user_id: session.user.id,
            case_id: cleanCase.case_id,
            title: cleanCase.metadata?.title || cleanCase.case_id,
            medical_field: cleanCase.metadata?.medical_field || null,
            folder_name: folderName,
            case_data: cleanCase,
            updated_at: new Date().toISOString()
        };

        const { error } = await client.from('medical_cases').upsert(row, { onConflict: 'user_id,case_id' });
        if (error) throw error;
    }

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

        const localCases = readJson('custom_cases', []);
        const merged = new Map();
        localCases.forEach(c => merged.set(c.case_id, c));
        cloudCases.forEach(c => merged.set(c.case_id, c));

        const finalCases = Array.from(merged.values());
        writeJson('custom_cases', finalCases);
        return finalCases;
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

    function scheduleProgressSync() {
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = setTimeout(() => {
            saveProgress().catch(err => console.error('Hintergrund-Sync fehlgeschlagen:', err));
        }, 1200);
    }

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
            showAuthFeedback('feedback-error', 'Bitte E-Mail und Passwort eingeben.');
            return;
        }

        showAuthFeedback('feedback-neutral', 'Anmeldung läuft...');
        try {
            if (!client) throw new Error('Supabase ist nicht konfiguriert oder nicht erreichbar.');
            const { error } = await client.auth.signInWithPassword({ email, password });
            if (error) throw error;
            showAuthFeedback('feedback-success', 'Erfolgreich angemeldet!');
            emailEl.value = '';
            passEl.value = '';
        } catch (err) {
            showAuthFeedback('feedback-error', `Anmeldefehler: ${err.message}`);
        }
    };

    window.authSignUp = async function() {
        const emailEl = document.getElementById('auth-email');
        const passEl = document.getElementById('auth-password');
        if (!emailEl || !passEl) return;

        const email = emailEl.value.trim();
        const password = passEl.value;

        if (!email || !password) {
            showAuthFeedback('feedback-error', 'Bitte E-Mail und Passwort eingeben.');
            return;
        }

        showAuthFeedback('feedback-neutral', 'Registrierung läuft...');
        try {
            if (!client) throw new Error('Supabase ist nicht konfiguriert oder nicht erreichbar.');
            const { data, error } = await client.auth.signUp({ email, password });
            if (error) throw error;

            if (data.session) {
                showAuthFeedback('feedback-success', 'Konto erstellt und direkt angemeldet!');
            } else {
                showAuthFeedback('feedback-success', 'Registrierung erfolgreich! Bitte bestätige ggf. deine E-Mail.');
            }
        } catch (err) {
            showAuthFeedback('feedback-error', `Registrierungsfehler: ${err.message}`);
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSupabase);
    } else {
        initSupabase();
    }
})();
