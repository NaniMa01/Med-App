// SUPABASE AUTH + CLOUD-SPEICHER (Gastmodus bleibt über localStorage erhalten)
(function () {
    let client = null;
    let session = null;
    let syncedUserId = null;
    let progressTimer = null;
    let applyingRemote = false;

    const $ = id => document.getElementById(id);

    function sanitizeCaseId(id) {
        return String(id || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function readJson(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key));
            return value === null || value === undefined ? fallback : value;
        } catch (_e) {
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
    }

    function showAuthMessage(type, text) {
        const fb = $('auth-fb');
        if (!fb) return;
        fb.style.display = text ? 'block' : 'none';
        fb.className = `feedback-box ${type}`;
        fb.textContent = text || '';
    }

    function updateAuthUI() {
        const loggedIn = !!session;
        const panel = $('auth-panel');
        const user = $('auth-user');
        if (panel) panel.style.display = loggedIn ? 'none' : 'block';
        if (user) user.style.display = loggedIn ? 'flex' : 'none';
        const email = $('auth-user-email');
        if (email) email.textContent = session?.user?.email || '';
    }

    // ---------- Cloud-Zugriff (RLS schützt die Daten, nur Anon-Key + Nutzer-Session) ----------
    function requireSession() {
        if (!client || !session) throw new Error('Nicht angemeldet.');
    }

    async function loadCloudCases() {
        requireSession();
        const { data, error } = await client.from('medical_cases').select('case_id, case_data');
        if (error) throw error;
        return (data || []).map(row => ({ ...row.case_data, case_id: row.case_id }));
    }

    async function saveCloudCase(caseObj) {
        requireSession();
        const caseId = sanitizeCaseId(caseObj.case_id);
        if (!caseId) throw new Error('Ungültige case_id.');
        const row = {
            user_id: session.user.id,
            case_id: caseId,
            title: caseObj.metadata?.title || null,
            medical_field: caseObj.metadata?.medical_field || null,
            case_data: { ...caseObj, case_id: caseId },
            updated_at: new Date().toISOString()
        };
        const { error } = await client.from('medical_cases').upsert(row, { onConflict: 'user_id,case_id' });
        if (error) throw error;
    }

    async function deleteCloudCase(caseId) {
        requireSession();
        const { error } = await client
            .from('medical_cases')
            .delete()
            .eq('user_id', session.user.id)
            .eq('case_id', sanitizeCaseId(caseId));
        if (error) throw error;
    }

async function loadProgress() {
        requireSession();
        const { data, error } = await client.from('user_progress').select('*').eq('user_id', session.user.id).maybeSingle();
        if (error) throw error;
        if (data) {
            // Nativer localStorage-Zugriff ohne fehlerhafte Hilfsfunktionen
            localStorage.setItem('user_xp', String(data.xp || 0));
            localStorage.setItem('solved_cases', JSON.stringify(data.solved_cases || []));
            localStorage.setItem('user_skills', JSON.stringify(data.skills || {}));

            // Ordnerstruktur und Klapp-Status aus der Cloud wiederherstellen
            if (Array.isArray(data.folder_order) && data.folder_order.length > 0) {
                localStorage.setItem('medcheck_folder_order', JSON.stringify(data.folder_order));
            }
            if (data.folder_state && typeof data.folder_state === 'object') {
                localStorage.setItem('medcheck_folder_state', JSON.stringify(data.folder_state));
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

async function saveProgress() {
        requireSession();
        
        // NEU: Ordnerstruktur aus dem Browser-Cache auslesen
        const folder_order = JSON.parse(localStorage.getItem('medcheck_folder_order') || '[]');
        const folder_state = typeof bookshelfFolderState !== 'undefined' 
            ? bookshelfFolderState 
            : JSON.parse(localStorage.getItem('medcheck_folder_state') || '{}');

        const row = {
            user_id: session.user.id,
            xp: parseInt(localStorage.getItem('user_xp') || '0', 10) || 0,
            solved_cases: readJson('solved_cases', []),
            skills: readJson('user_skills', {}),
            folder_order, // NEU: Wird in die Cloud geschrieben
            folder_state, // NEU: Wird in die Cloud geschrieben
            updated_at: new Date().toISOString()
        };
        const { error } = await client.from('user_progress').upsert(row, { onConflict: 'user_id' });
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
        });
        return { xp: Math.max(localXp, remote.xp || 0), solved, skills };
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
    }

    // ---------- Auth-Aktionen ----------
    function readCredentials() {
        return {
            email: ($('auth-email')?.value || '').trim(),
            password: $('auth-password')?.value || ''
        };
    }

    async function runAuth(action, busyText) {
        if (!client) {
            showAuthMessage('feedback-error', 'Online-Speicherung ist nicht konfiguriert (Gastmodus).');
            return;
        }
        const { email, password } = readCredentials();
        if (!email || !password) {
            showAuthMessage('feedback-error', 'Bitte E-Mail und Passwort eingeben.');
            return;
        }
        showAuthMessage('feedback-neutral', busyText);
        try {
            await action(email, password);
        } catch (err) {
            showAuthMessage('feedback-error', translateError(err));
        }
    }

    window.authSignIn = () => runAuth(async (email, password) => {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        $('auth-password').value = '';
        showAuthMessage('feedback-success', '');
    }, 'Anmeldung läuft...');

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

    async function initAuth() {
        updateAuthUI();
        try {
            if (!window.supabase || !window.supabase.createClient) throw new Error('Supabase-Client nicht geladen.');
            const res = await fetch('/api/config');
            const config = await res.json();
            if (!res.ok || !config.supabaseUrl || !config.supabaseAnonKey) throw new Error('Supabase ist nicht konfiguriert.');

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
        } catch (err) {
            console.info('Gastmodus (nur localStorage):', err.message);
            showAuthMessage('feedback-neutral', 'Gastmodus: Online-Speicherung ist aktuell nicht verfügbar. Deine Daten bleiben lokal gespeichert.');
        }
    }

    document.addEventListener('DOMContentLoaded', initAuth);
})();
