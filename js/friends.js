/* ==========================================================================
   MEDCHECK – FREUNDE, SCOREBOARD & KLINIK-TELEMETRIE (js/friends.js)
   ========================================================================== */

const FriendsModule = (() => {
    const LEGACY_FRIENDS_KEY  = 'medcheck_friends_list_v1';
    const FRIENDS_LIST_KEY    = 'medcheck_friends_list_v2';
    const TELEMETRY_STATS_KEY = 'medcheck_telemetry_stats_v1';
    const FRIEND_CODE_KEY     = 'medcheck_my_friend_code';

    let currentSortBy = 'xp'; // 'xp' | 'monthly' | 'streak'
    let currentSearchTerm = '';
    let syncState = 'idle'; // 'idle' | 'syncing' | 'synced' | 'offline' | 'error'
    let syncErrorMessage = '';
    let authListenerAttached = false;

    const CHALLENGE_LABELS = {
        audit:          { name: 'Klinisches Audit', icon: '📋', color: '#38bdf8' },
        quiz:           { name: 'Master-Exam (MC)', icon: '🎓', color: '#818cf8' },
        synapses:       { name: 'Synapsen-Matrix',  icon: '🧠', color: '#22d3ee' },
        cascades:       { name: 'Clinical Cascades', icon: '🔗', color: '#f59e0b' },
        categorization: { name: 'Taxonomie',        icon: '🏷️', color: '#a855f7' },
        doctordle:      { name: 'Doctordle',        icon: '🔍', color: '#10b981' },
        flashcards:     { name: 'Flashcards',       icon: '🗂️', color: '#ec4899' }
    };

    // ======================================================================
    // 0. LEGACY-CLEANUP (Entfernt alte Mock-User wie Benjamin, Elias, Clara)
    // ======================================================================
    function purgeLegacyMockData() {
        try {
            if (localStorage.getItem(LEGACY_FRIENDS_KEY) !== null) {
                localStorage.removeItem(LEGACY_FRIENDS_KEY);
            }
            const current = JSON.parse(localStorage.getItem(FRIENDS_LIST_KEY) || '[]');
            if (Array.isArray(current)) {
                // Behalte ausschließlich verifizierte Cloud-Profile mit echter Supabase-ID
                const cleaned = current.filter(f =>
                    f &&
                    f.isCloudVerified === true &&
                    f.id &&
                    !String(f.id).startsWith('col_') &&
                    !String(f.id).startsWith('friend_')
                );
                if (cleaned.length !== current.length) {
                    localStorage.setItem(FRIENDS_LIST_KEY, JSON.stringify(cleaned));
                }
            }
        } catch (_e) {
            localStorage.removeItem(FRIENDS_LIST_KEY);
        }
    }

    // ======================================================================
    // 1. TELEMETRIE & EIGENE MONATS-/CHALLENGE-STATISTIK
    // ======================================================================
    function getCurrentMonthKey() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    function getSolvedCasesCountFallback() {
        try {
            const solved = JSON.parse(localStorage.getItem('solved_cases') || '[]');
            return Array.isArray(solved) ? solved.length : 0;
        } catch (_e) {
            return 0;
        }
    }

    function createInitialTelemetry(monthKey) {
        const counts = { audit: 0, quiz: 0, synapses: 0, cascades: 0, categorization: 0, doctordle: 0, flashcards: 0 };
        try {
            const allProg = window.ProgressManager ? window.ProgressManager.getAll() : {};
            Object.values(allProg).forEach(caseState => {
                if (!caseState || typeof caseState !== 'object') return;
                Object.keys(counts).forEach(k => {
                    if (caseState[k]) counts[k] += 1;
                });
            });
        } catch (_e) {}

        const initial = {
            monthlySolved: { [monthKey]: getSolvedCasesCountFallback() },
            challengeCounts: counts,
            pokesSent: 0
        };
        try {
            localStorage.setItem(TELEMETRY_STATS_KEY, JSON.stringify(initial));
        } catch (_e) {}
        return initial;
    }

    function getMyTelemetry() {
        try {
            const raw = JSON.parse(localStorage.getItem(TELEMETRY_STATS_KEY) || 'null');
            const monthKey = getCurrentMonthKey();

            if (!raw || typeof raw !== 'object') {
                return createInitialTelemetry(monthKey);
            }
            if (!raw.monthlySolved) raw.monthlySolved = {};
            if (raw.monthlySolved[monthKey] === undefined) {
                raw.monthlySolved[monthKey] = getSolvedCasesCountFallback();
            }
            if (!raw.challengeCounts) {
                raw.challengeCounts = { audit: 0, quiz: 0, synapses: 0, cascades: 0, categorization: 0, doctordle: 0, flashcards: 0 };
            }
            return raw;
        } catch (_e) {
            return createInitialTelemetry(getCurrentMonthKey());
        }
    }

    function saveMyTelemetry(data) {
        try {
            localStorage.setItem(TELEMETRY_STATS_KEY, JSON.stringify(data));
        } catch (_e) {}
    }

    function recordChallengeActivity(challengeKey) {
        if (!challengeKey) return;
        const normalized = challengeKey === 'cascade' ? 'cascades' : (challengeKey === 'cat' ? 'categorization' : challengeKey);
        const telemetry = getMyTelemetry();
        if (telemetry.challengeCounts[normalized] === undefined) {
            telemetry.challengeCounts[normalized] = 0;
        }
        telemetry.challengeCounts[normalized] += 1;
        saveMyTelemetry(telemetry);
        syncMyStatsToCloud();
    }

    function recordMonthlyCaseSolved() {
        const telemetry = getMyTelemetry();
        const monthKey = getCurrentMonthKey();
        const solvedTotal = getSolvedCasesCountFallback();
        telemetry.monthlySolved[monthKey] = Math.max((telemetry.monthlySolved[monthKey] || 0) + 1, solvedTotal);
        saveMyTelemetry(telemetry);
        syncMyStatsToCloud();
    }

    function installTelemetryHooks() {
        if (window.ProgressManager && !window.ProgressManager._friendsHookInstalled) {
            const origSave = window.ProgressManager.saveCaseState.bind(window.ProgressManager);
            window.ProgressManager.saveCaseState = function(caseId, partialState) {
                origSave(caseId, partialState);
                if (partialState && typeof partialState === 'object') {
                    Object.keys(partialState).forEach(k => {
                        if (k !== 'updatedAt') recordChallengeActivity(k);
                    });
                }
            };
            window.ProgressManager._friendsHookInstalled = true;
        }

        if (typeof window.finishCase === 'function' && !window.finishCase._friendsHookInstalled) {
            const origFinish = window.finishCase;
            const wrappedFinish = function() {
                recordMonthlyCaseSolved();
                return origFinish.apply(this, arguments);
            };
            wrappedFinish._friendsHookInstalled = true;
            window.finishCase = wrappedFinish;
        }
    }

    // ======================================================================
    // 2. SPIELER-PROFIL & FREUNDESLISTE VERWALTEN
    // ======================================================================
    function getMyFriendCode(userId) {
        // Deterministischer Code anhand der Supabase-User-ID (identisch auf allen Geräten)
        const uid = userId || window.currentSessionUser?.id;
        if (uid && typeof uid === 'string' && uid.length >= 6) {
            const deterministic = 'MC-BS-' + uid.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase();
            localStorage.setItem(FRIEND_CODE_KEY, deterministic);
            return deterministic;
        }

        let code = localStorage.getItem(FRIEND_CODE_KEY);
        if (!code) {
            const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
            code = `MC-BS-${randomPart}`;
            localStorage.setItem(FRIEND_CODE_KEY, code);
        }
        return code;
    }

    function getRankTitle(xp) {
        if (xp >= 1500) return 'Oberarzt';
        if (xp >= 800)  return 'Facharzt';
        if (xp >= 300)  return 'Assistenzarzt';
        return 'Famulus';
    }

    function getMyFavoriteChallenge(challengeCounts) {
        let bestKey = 'audit';
        let maxVal = -1;
        Object.entries(challengeCounts || {}).forEach(([k, v]) => {
            if (v > maxVal && CHALLENGE_LABELS[k]) {
                maxVal = v;
                bestKey = k;
            }
        });
        return bestKey;
    }

    function formatDisplayNameFromEmail(email) {
        if (!email) return 'MedCheck User';
        const prefix = email.split('@')[0] || email;
        return prefix
            .replace(/[._-]+/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase())
            .trim();
    }

    function getMyProfile() {
        const xp = parseInt(localStorage.getItem('user_xp') || '0', 10);
        const telemetry = getMyTelemetry();
        const monthKey = getCurrentMonthKey();
        const solvedAllTime = getSolvedCasesCountFallback();
        const monthlyCases = Math.max(telemetry.monthlySolved[monthKey] || 0, solvedAllTime);

        let streak = 1;
        const streakText = document.getElementById('stat-streak')?.textContent || '';
        const parsedStreak = parseInt(streakText, 10);
        if (!isNaN(parsedStreak) && parsedStreak > 0) streak = parsedStreak;

        const sessionUser = window.currentSessionUser || null;
        const userEmail = (sessionUser?.email || '').toLowerCase();
        const rawName = sessionUser?.user_metadata?.display_name ||
                        sessionUser?.user_metadata?.full_name ||
                        (userEmail ? formatDisplayNameFromEmail(userEmail) : 'Du');

        return {
            id: sessionUser?.id || 'me_local',
            isMe: true,
            name: `${rawName} (Du)`,
            rawDisplayName: rawName,
            email: userEmail || 'Nicht eingeloggt',
            friendCode: getMyFriendCode(sessionUser?.id),
            avatar: '⚡',
            xp: xp,
            monthlyCases: monthlyCases,
            streak: streak,
            favoriteChallenge: getMyFavoriteChallenge(telemetry.challengeCounts),
            challengeCounts: telemetry.challengeCounts,
            statusText: 'Aktiv im Dienst',
            isOnline: true
        };
    }

    function getFriendsList() {
        try {
            const saved = JSON.parse(localStorage.getItem(FRIENDS_LIST_KEY) || '[]');
            if (!Array.isArray(saved)) return [];
            return saved.filter(f => f && f.isCloudVerified === true);
        } catch (_e) {
            return [];
        }
    }

    function saveFriendsList(list) {
        try {
            const validList = Array.isArray(list) ? list.filter(f => f && f.isCloudVerified === true) : [];
            localStorage.setItem(FRIENDS_LIST_KEY, JSON.stringify(validList));
            updateSidebarBadge(validList.length);
        } catch (_e) {}
    }

    function updateSidebarBadge(count) {
        const badge = document.getElementById('nav-friends-badge');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-block' : 'none';
        }
    }

    // ======================================================================
    // 3. SUPABASE CLOUD-SYNC (PROFIL + FREUNDESLISTE + LIVE-STATS)
    // ======================================================================
    function getSupabase() {
        // Wichtig: Prüfe auf .from (echte Client-Instanz), nicht auf das globale CDN-Namespace-Objekt!
        if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
            return window.supabaseClient;
        }
        if (window.sb && typeof window.sb.from === 'function') {
            return window.sb;
        }
        if (window.supabase && typeof window.supabase.from === 'function') {
            return window.supabase;
        }
        return null;
    }

    async function waitForSupabase(maxWaitMs = 5000) {
        const start = Date.now();
        while (Date.now() - start < maxWaitMs) {
            const sb = getSupabase();
            if (sb && sb.auth) return sb;
            await new Promise(r => setTimeout(r, 150));
        }
        return getSupabase();
    }

    function computeOnlineStatus(updatedAtIso) {
        if (!updatedAtIso) {
            return { isOnline: false, statusText: 'Verifiziertes Cloud-Profil' };
        }
        const diffMs = Date.now() - new Date(updatedAtIso).getTime();
        const diffMin = Math.floor(diffMs / 60000);

        if (diffMin < 15) {
            return { isOnline: true, statusText: '🟢 Gerade aktiv im Dienst' };
        }
        if (diffMin < 60) {
            return { isOnline: false, statusText: `Vor ${Math.max(1, diffMin)} Min. aktiv` };
        }
        const diffHours = Math.floor(diffMin / 60);
        if (diffHours < 24) {
            return { isOnline: false, statusText: `Vor ${diffHours} Std. aktiv` };
        }
        const diffDays = Math.floor(diffHours / 24);
        return { isOnline: false, statusText: `Vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''} aktiv` };
    }

    function mapCloudRowToFriend(row, existingFriend = null) {
        const avatars = ['🩺', '🧠', '🫀', '🔬', '🩻', '💉', '🧬'];
        const deterministicAvatarIdx = (row.id || row.email || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % avatars.length;
        const presence = computeOnlineStatus(row.updated_at);

        const defaultCounts = { audit: 0, quiz: 0, synapses: 0, cascades: 0, categorization: 0, doctordle: 0, flashcards: 0 };
        const counts = (row.challenge_counts && typeof row.challenge_counts === 'object')
            ? { ...defaultCounts, ...row.challenge_counts }
            : defaultCounts;

        return {
            id: row.id,
            name: row.display_name || formatDisplayNameFromEmail(row.email),
            email: (row.email || '').toLowerCase(),
            friendCode: row.friend_code || getMyFriendCode(row.id),
            avatar: existingFriend?.avatar || avatars[deterministicAvatarIdx] || '🩺',
            xp: Number(row.xp) || 0,
            monthlyCases: Number(row.monthly_cases) || 0,
            streak: Number(row.streak) || 1,
            favoriteChallenge: row.favorite_challenge || getMyFavoriteChallenge(counts),
            challengeCounts: counts,
            statusText: presence.statusText,
            isOnline: presence.isOnline,
            updatedAt: row.updated_at || null,
            isCloudVerified: true
        };
    }

    async function syncMyStatsToCloud() {
        const sb = await waitForSupabase(3500);
        if (!sb || !sb.auth) {
            syncState = 'offline';
            return false;
        }

        try {
            const { data: { session } } = await sb.auth.getSession();
            if (!session?.user) {
                syncState = 'offline';
                return false;
            }

            window.currentSessionUser = session.user;
            const me = getMyProfile();
            const uid = session.user.id;
            const friendIds = getFriendsList().map(f => f.id).filter(Boolean);

            const basePayload = {
                id: uid,
                email: (session.user.email || me.email || '').toLowerCase(),
                display_name: me.rawDisplayName || formatDisplayNameFromEmail(session.user.email),
                friend_code: me.friendCode,
                xp: Number(me.xp) || 0,
                monthly_cases: Number(me.monthlyCases) || 0,
                streak: Number(me.streak) || 1,
                favorite_challenge: me.favoriteChallenge || 'audit',
                challenge_counts: me.challengeCounts || {},
                updated_at: new Date().toISOString()
            };

            // Versuch 1: Upsert mit friend_ids (falls Spalte in user_profiles existiert)
            let { error } = await sb.from('user_profiles').upsert(
                { ...basePayload, friend_ids: friendIds },
                { onConflict: 'id' }
            );

            // Fallback: Falls friend_ids als Spalte noch nicht angelegt wurde, ohne friend_ids speichern
            if (error && error.message && error.message.includes('friend_ids')) {
                const retry = await sb.from('user_profiles').upsert(basePayload, { onConflict: 'id' });
                error = retry.error;
            }

            if (error) {
                syncState = 'error';
                syncErrorMessage = error.message || 'Unbekannter Datenbankfehler';
                console.warn('[Friends] Fehler beim Upsert in user_profiles:', error.message);
                return false;
            }

            syncState = 'synced';
            syncErrorMessage = '';
            return true;
        } catch (err) {
            syncState = 'error';
            syncErrorMessage = err.message || 'Netzwerkfehler';
            console.warn('[Friends] Cloud-Sync fehlgeschlagen:', err);
            return false;
        }
    }

    // Speichert die Freundes-IDs zusätzlich in den Supabase User-Metadaten (100% Schema-unabhängig)
    async function syncFriendIdsToAuthMetadata(friendsArray) {
        const sb = getSupabase();
        if (!sb || !sb.auth) return;

        try {
            const friendRefs = friendsArray.map(f => ({
                id: f.id,
                email: f.email,
                friendCode: f.friendCode
            }));
            await sb.auth.updateUser({
                data: { medcheck_friends_v2: friendRefs }
            });
        } catch (_e) {}
    }

    async function fetchFriendsFromCloud() {
        const sb = await waitForSupabase(3500);
        if (!sb || !sb.auth) {
            syncState = 'offline';
            return;
        }

        syncState = 'syncing';
        try {
            const { data: { session } } = await sb.auth.getSession();
            if (!session?.user) {
                syncState = 'offline';
                return;
            }
            window.currentSessionUser = session.user;
            const myUid = session.user.id;

            // 1. Eigenes Profil vorher pushen, damit unsere aktuellen Stats in der DB stehen
            await syncMyStatsToCloud();

            // 2. Lokale Freunde + evtl. in der Cloud gespeicherte Freunde (aus Auth-Metadata oder user_profiles) zusammenführen
            const localFriends = getFriendsList();
            const metaFriends = Array.isArray(session.user.user_metadata?.medcheck_friends_v2)
                ? session.user.user_metadata.medcheck_friends_v2
                : [];

            // Prüfe auch, ob in user_profiles.friend_ids IDs hinterlegt sind
            let profileFriendIds = [];
            const { data: myRow } = await sb
                .from('user_profiles')
                .select('friend_ids')
                .eq('id', myUid)
                .maybeSingle();

            if (Array.isArray(myRow?.friend_ids)) {
                profileFriendIds = myRow.friend_ids;
            }

            // Alle bekannten Identifier (IDs & E-Mails) unserer hinzugefügten Freunde sammeln
            const targetIds = new Set([
                ...localFriends.map(f => f.id).filter(Boolean),
                ...metaFriends.map(f => f.id).filter(Boolean),
                ...profileFriendIds.filter(Boolean)
            ]);
            targetIds.delete(myUid); // Mich selbst nie als Freund führen

            const targetEmails = new Set([
                ...localFriends.map(f => (f.email || '').toLowerCase()).filter(Boolean),
                ...metaFriends.map(f => (f.email || '').toLowerCase()).filter(Boolean)
            ]);
            if (session.user.email) targetEmails.delete(session.user.email.toLowerCase());

            // Wenn der User noch gar keine Freunde geaddet hat -> Liste bleibt leer!
            if (targetIds.size === 0 && targetEmails.size === 0) {
                saveFriendsList([]);
                syncState = 'synced';
                return;
            }

            // 3. Live-Daten dieser Freunde aus Supabase abrufen
            const idList = Array.from(targetIds);
            const emailList = Array.from(targetEmails);

            let matchedRows = [];

            if (idList.length > 0) {
                const { data: byIdData, error: idErr } = await sb
                    .from('user_profiles')
                    .select('*')
                    .in('id', idList);

                if (!idErr && Array.isArray(byIdData)) {
                    matchedRows.push(...byIdData);
                }
            }

            if (emailList.length > 0) {
                const { data: byEmailData, error: emailErr } = await sb
                    .from('user_profiles')
                    .select('*')
                    .in('email', emailList);

                if (!emailErr && Array.isArray(byEmailData)) {
                    byEmailData.forEach(row => {
                        if (!matchedRows.some(r => r.id === row.id)) {
                            matchedRows.push(row);
                        }
                    });
                }
            }

            // 4. Nur tatsächlich in Supabase existierende Profile übernehmen & aktualisieren
            const syncedFriends = matchedRows
                .filter(row => row.id !== myUid)
                .map(row => {
                    const existing = localFriends.find(f => f.id === row.id || (f.email && row.email && f.email.toLowerCase() === row.email.toLowerCase()));
                    return mapCloudRowToFriend(row, existing);
                });

            saveFriendsList(syncedFriends);
            syncState = 'synced';
        } catch (err) {
            console.warn('[Friends] Fehler beim Abrufen der Freundesdaten:', err);
            syncState = 'error';
            syncErrorMessage = err.message || 'Synchronisationsfehler';
        }
    }

    // ======================================================================
    // 4. FREUND HINZUFÜGEN (NUR ECHTE SUPABASE-USER), ENTFERNEN & INTERAKTION
    // ======================================================================
    async function addFriendByInput() {
        const inputEl = document.getElementById('friends-add-input');
        const addBtn = document.getElementById('friends-add-btn');
        if (!inputEl) return;

        const raw = inputEl.value.trim();
        if (!raw) {
            showAddFeedback('Bitte gib eine E-Mail-Adresse, einen Namen oder einen Pager-Code (z. B. MC-BS-...) ein.', 'error');
            return;
        }

        const sb = await waitForSupabase(2500);
        if (!sb || !sb.auth) {
            showAddFeedback('Keine Verbindung zu Supabase. Bitte stelle sicher, dass du online und eingeloggt bist.', 'error');
            return;
        }

        const { data: { session } } = await sb.auth.getSession();
        if (!session?.user) {
            showAddFeedback('Bitte logge dich zuerst mit deinem MedCheck-Account ein, um Freunde hinzuzufügen.', 'error');
            return;
        }

        const me = getMyProfile();
        if (
            raw.toLowerCase() === me.email.toLowerCase() ||
            raw.toUpperCase() === me.friendCode.toUpperCase()
        ) {
            showAddFeedback('Das bist du selbst! Gib den Pager-Code oder die E-Mail eines Kollegen ein.', 'error');
            return;
        }

        const friends = getFriendsList();
        const alreadyAdded = friends.some(f =>
            (f.email && f.email.toLowerCase() === raw.toLowerCase()) ||
            (f.name && f.name.toLowerCase() === raw.toLowerCase()) ||
            (f.friendCode && f.friendCode.toLowerCase() === raw.toLowerCase())
        );

        if (alreadyAdded) {
            showAddFeedback(`„${raw}“ befindet sich bereits in deiner Freundesliste!`, 'error');
            return;
        }

        if (addBtn) {
            addBtn.disabled = true;
            addBtn.textContent = 'Suche in Cloud...';
        }

        try {
            // Suche den User live in der Supabase-Tabelle user_profiles
            // Wir prüfen exakt/case-insensitive auf email, friend_code oder display_name
            const cleanQuery = raw.replace(/[,()]/g, '').trim();
            const { data: candidates, error } = await sb
                .from('user_profiles')
                .select('*')
                .or(`email.ilike.${cleanQuery},friend_code.ilike.${cleanQuery},display_name.ilike.%${cleanQuery}%`)
                .limit(5);

            if (error) {
                showAddFeedback(`Datenbank-Abfrage fehlgeschlagen: ${error.message}. Prüfe bitte die Supabase-Tabelle 'user_profiles'.`, 'error');
                return;
            }

            // Eigenes Profil aus den Treffern herausfiltern
            const validMatches = (candidates || []).filter(row => row.id !== session.user.id);

            if (validMatches.length === 0) {
                showAddFeedback(`Kein registrierter MedCheck-User für „${raw}“ gefunden. Dein Kollege muss sich mindestens einmal in der App eingeloggt haben.`, 'error');
                return;
            }

            // Bevorzuge exakten Treffer auf E-Mail oder Pager-Code, sonst ersten Namens-Treffer
            const exactMatch = validMatches.find(row =>
                (row.email && row.email.toLowerCase() === cleanQuery.toLowerCase()) ||
                (row.friend_code && row.friend_code.toLowerCase() === cleanQuery.toLowerCase()) ||
                (row.display_name && row.display_name.toLowerCase() === cleanQuery.toLowerCase())
            ) || validMatches[0];

            if (friends.some(f => f.id === exactMatch.id)) {
                showAddFeedback(`„${exactMatch.display_name || exactMatch.email}“ ist bereits in deiner Freundesliste!`, 'error');
                return;
            }

            const newFriend = mapCloudRowToFriend(exactMatch);
            friends.push(newFriend);
            saveFriendsList(friends);

            // Synchronisiere die aktualisierte Freundesliste sofort in die Cloud
            await syncFriendIdsToAuthMetadata(friends);
            await syncMyStatsToCloud();

            inputEl.value = '';
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic([10, 30, 10]);
            renderView();
            showAddFeedback(`✓ ${newFriend.name} (${newFriend.friendCode}) wurde verifiziert und hinzugefügt!`, 'success');
        } catch (err) {
            showAddFeedback(`Fehler bei der Benutzersuche: ${err.message || 'Unbekannter Fehler'}`, 'error');
        } finally {
            if (addBtn) {
                addBtn.disabled = false;
                addBtn.textContent = '+ Freund hinzufügen';
            }
        }
    }

    async function removeFriend(friendId) {
        const friends = getFriendsList();
        const target = friends.find(f => f.id === friendId);
        if (!target) return;

        if (!window.confirm(`Möchtest du „${target.name}“ wirklich aus deiner Freundesliste entfernen?`)) return;

        const filtered = friends.filter(f => f.id !== friendId);
        saveFriendsList(filtered);
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);
        renderView();

        await syncFriendIdsToAuthMetadata(filtered);
        await syncMyStatsToCloud();
    }

    async function manualSync() {
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(8);
        syncState = 'syncing';
        renderView();
        await fetchFriendsFromCloud();
        renderView();
    }

    function pokeFriend(friendName, btnEl) {
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic([12, 40, 12]);
        if (btnEl) {
            const orig = btnEl.innerHTML;
            btnEl.innerHTML = '📟 Angefunkt!';
            btnEl.disabled = true;
            setTimeout(() => {
                btnEl.innerHTML = orig;
                btnEl.disabled = false;
            }, 2500);
        }

        const toast = document.createElement('div');
        toast.className = 'gamification-toast joker';
        toast.innerHTML = `📟 Pager-Funk an <strong>${escapeSafe(friendName)}</strong> gesendet: „Zeit für eine Schicht in MedCheck!“`;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('fade-out'), 2400);
        setTimeout(() => toast.remove(), 2800);
    }

    function challengeFriendToDuel(friendEmail) {
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);
        const navDuel = document.getElementById('nav-duel');
        if (typeof window.switchTab === 'function') {
            window.switchTab('duel', navDuel);
        }

        setTimeout(() => {
            const emailInput = document.querySelector('.duel-email-input') || document.getElementById('duel-opponent-email');
            if (emailInput) {
                emailInput.value = friendEmail;
                emailInput.focus();
            }
        }, 120);
    }

    function copyMyFriendCode(btnEl) {
        const code = getMyProfile().friendCode;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).catch(() => {});
        }
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(8);
        if (btnEl) {
            const orig = btnEl.innerHTML;
            btnEl.innerHTML = '✓ Code kopiert!';
            setTimeout(() => { btnEl.innerHTML = orig; }, 1800);
        }
    }

    function showAddFeedback(msg, type) {
        const fbEl = document.getElementById('friends-add-feedback');
        if (!fbEl) return;
        fbEl.className = `friends-feedback ${type}`;
        fbEl.textContent = msg;
        fbEl.classList.remove('hidden');
        setTimeout(() => fbEl.classList.add('hidden'), 5000);
    }

    // ======================================================================
    // 5. STATISTIK-AGGREGATION & RENDERING
    // ======================================================================
    function setSortBy(sortKey) {
        currentSortBy = sortKey;
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(6);
        renderView();
    }

    function handleSearch(val) {
        currentSearchTerm = (val || '').trim().toLowerCase();
        renderView();
    }

    function escapeSafe(str) {
        return String(str || '').replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag));
    }

    function computeCommunityStats(allParticipants) {
        const combinedChallenges = { audit: 0, quiz: 0, synapses: 0, cascades: 0, categorization: 0, doctordle: 0, flashcards: 0 };
        let totalMonthlyCases = 0;
        let totalXp = 0;

        allParticipants.forEach(p => {
            totalMonthlyCases += (p.monthlyCases || 0);
            totalXp += (p.xp || 0);
            Object.entries(p.challengeCounts || {}).forEach(([k, val]) => {
                if (combinedChallenges[k] !== undefined) {
                    combinedChallenges[k] += (Number(val) || 0);
                }
            });
        });

        const rawTotalRuns = Object.values(combinedChallenges).reduce((a, b) => a + b, 0);
        const divisor = rawTotalRuns || 1;
        const sortedChallenges = Object.entries(combinedChallenges)
            .map(([key, count]) => ({
                key,
                count,
                pct: rawTotalRuns > 0 ? Math.round((count / divisor) * 100) : 0,
                meta: CHALLENGE_LABELS[key] || { name: key, icon: '⚡', color: '#38bdf8' }
            }))
            .sort((a, b) => b.count - a.count);

        return {
            totalMonthlyCases,
            totalXp,
            totalChallengeRuns: rawTotalRuns,
            topChallenge: sortedChallenges[0],
            sortedChallenges
        };
    }

    function getSyncBadgeHtml() {
        if (syncState === 'syncing') {
            return `<span style="font-size:0.75rem; color:#38bdf8;">🔄 Synchronisiere...</span>`;
        }
        if (syncState === 'synced') {
            return `<span style="font-size:0.75rem; color:#10b981;">🟢 Cloud synchronisiert</span>`;
        }
        if (syncState === 'error') {
            return `<span style="font-size:0.75rem; color:#f43f5e;" title="${escapeSafe(syncErrorMessage)}">⚠️ Sync-Fehler (Prüfe DB)</span>`;
        }
        return `<span style="font-size:0.75rem; color:var(--text-muted);">🟠 Offline / Lokal</span>`;
    }

    function renderView() {
        const container = document.getElementById('friends-view');
        if (!container) return;

        const me = getMyProfile();
        const friends = getFriendsList(); // Enthält NUR echte, hinzugefügte Freunde!
        updateSidebarBadge(friends.length);

        const allParticipants = [me, ...friends];
        const stats = computeCommunityStats(allParticipants);

        const sortedBoard = [...allParticipants]
            .filter(p => !currentSearchTerm || p.name.toLowerCase().includes(currentSearchTerm) || p.email.toLowerCase().includes(currentSearchTerm))
            .sort((a, b) => {
                if (currentSortBy === 'monthly') return (b.monthlyCases || 0) - (a.monthlyCases || 0);
                if (currentSortBy === 'streak')  return (b.streak || 0) - (a.streak || 0);
                return (b.xp || 0) - (a.xp || 0);
            });

        const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
        const currentMonthName = monthNames[new Date().getMonth()];

        const teamGoalTarget = Math.max(20, allParticipants.length * 12);
        const teamGoalPct = Math.min(100, Math.round((stats.totalMonthlyCases / teamGoalTarget) * 100));

        const fullSorted = [...allParticipants].sort((a, b) => {
            if (currentSortBy === 'monthly') return (b.monthlyCases || 0) - (a.monthlyCases || 0);
            if (currentSortBy === 'streak')  return (b.streak || 0) - (a.streak || 0);
            return (b.xp || 0) - (a.xp || 0);
        });

        // Podium-Reihenfolge: Wenn 3+ Personen -> [Platz 2, Platz 1, Platz 3], sonst absteigend
        const podiumOrder = fullSorted.length >= 3 ? [1, 0, 2] : fullSorted.map((_, i) => i);

        container.innerHTML = `
            <div class="friends-wrapper">
                <!-- 1. HEADER & FREUNDES-CODE -->
                <div class="friends-header-card">
                    <div>
                        <div class="friends-kicker" style="display:flex; align-items:center; gap:12px;">
                            <span>KLINISCHES KOLLEGIUM & TELEMETRIE</span>
                            ${getSyncBadgeHtml()}
                        </div>
                        <h2 class="friends-main-title">👥 Freunde & Scoreboard</h2>
                        <p class="friends-subtitle">Verbinde dich über E-Mail oder Pager-Code mit echten Kommilitonen, vergleiche euren Fall-Durchsatz und fordere sie heraus.</p>
                    </div>
                    <div class="friends-code-box">
                        <span class="friends-code-label">Dein Pager-Code:</span>
                        <div class="friends-code-row">
                            <code id="my-friend-code-display">${escapeSafe(me.friendCode)}</code>
                            <button type="button" class="action-btn secondary btn-sm" onclick="window.FriendsModule.copyMyFriendCode(this)">📋 Kopieren</button>
                            <button type="button" class="action-btn secondary btn-sm" onclick="window.FriendsModule.manualSync()" title="Jetzt mit Supabase synchronisieren">🔄 Sync</button>
                        </div>
                    </div>
                </div>

                <!-- 2. FREUND HINZUFÜGEN LEISTE -->
                <div class="friends-add-card">
                    <div class="friends-add-row">
                        <div class="friends-input-wrap">
                            <span class="friends-input-icon">🔍</span>
                            <input type="text" id="friends-add-input" class="friends-add-input" placeholder="Registrierten User per E-Mail, Name oder Pager-Code (z.B. MC-BS-...) suchen..." onkeydown="if(event.key==='Enter') window.FriendsModule.addFriendByInput()">
                        </div>
                        <button type="button" id="friends-add-btn" class="action-btn" onclick="window.FriendsModule.addFriendByInput()">+ Freund hinzufügen</button>
                    </div>
                    <div id="friends-add-feedback" class="friends-feedback hidden"></div>
                </div>

                <!-- 3. KLINIK-STATISTIK & MONATS-KPI CARDS (4er GRID) -->
                <div class="friends-kpi-grid">
                    <div class="friends-kpi-card highlight-blue">
                        <div class="kpi-top">
                            <span class="kpi-label">Fälle im ${currentMonthName} (Du)</span>
                            <span class="kpi-icon">📅</span>
                        </div>
                        <div class="kpi-value">${me.monthlyCases} <span class="kpi-unit">Fälle</span></div>
                        <div class="kpi-sub">Kollegium gesamt: <strong>${stats.totalMonthlyCases} Fälle</strong> im ${currentMonthName}</div>
                    </div>

                    <div class="friends-kpi-card highlight-cyan">
                        <div class="kpi-top">
                            <span class="kpi-label">Beliebteste Challenge</span>
                            <span class="kpi-icon">${stats.topChallenge.meta.icon}</span>
                        </div>
                        <div class="kpi-value" style="font-size: 1.25rem;">${escapeSafe(stats.topChallenge.meta.name)}</div>
                        <div class="kpi-sub"><strong>${stats.topChallenge.pct}%</strong> aller Durchläufe (${stats.topChallenge.count}× absolviert)</div>
                    </div>

                    <div class="friends-kpi-card highlight-emerald">
                        <div class="kpi-top">
                            <span class="kpi-label">Deine Spezialdisziplin</span>
                            <span class="kpi-icon">${CHALLENGE_LABELS[me.favoriteChallenge]?.icon || '⚡'}</span>
                        </div>
                        <div class="kpi-value" style="font-size: 1.25rem;">${escapeSafe(CHALLENGE_LABELS[me.favoriteChallenge]?.name || 'Audit')}</div>
                        <div class="kpi-sub">Dein Dienstrang: <strong>${getRankTitle(me.xp)}</strong> (${me.xp} XP)</div>
                    </div>

                    <div class="friends-kpi-card highlight-amber">
                        <div class="kpi-top">
                            <span class="kpi-label">Stations-Ziel (${currentMonthName})</span>
                            <span class="kpi-icon">🏥</span>
                        </div>
                        <div class="kpi-value">${stats.totalMonthlyCases} / ${teamGoalTarget}</div>
                        <div class="friends-goal-bar">
                            <div class="friends-goal-fill" style="width: ${teamGoalPct}%;"></div>
                        </div>
                        <div class="kpi-sub">${teamGoalPct}% des gemeinsamen Monatsziels erreicht</div>
                    </div>
                </div>

                <!-- 4. HAUPTBEREICH: SCOREBOARD (LINKS) & CHALLENGE-BELIEBTHEIT (RECHTS) -->
                <div class="friends-main-grid">

                    <!-- LINKS: SCOREBOARD & PODIUM -->
                    <div class="friends-board-card">
                        <div class="friends-board-header">
                            <div>
                                <h3 style="margin: 0; font-size: 1.1rem;">🏆 Kollegiums-Scoreboard (${friends.length} ${friends.length === 1 ? 'Freund' : 'Freunde'})</h3>
                                <span style="font-size: 0.78rem; color: var(--text-muted);">Sortiert nach ${currentSortBy === 'xp' ? 'Gesamt-XP' : (currentSortBy === 'monthly' ? `Fällen im ${currentMonthName}` : 'Dienst-Streak')}</span>
                            </div>
                            <div class="segmented-control" style="margin: 0;">
                                <button type="button" class="segmented-btn ${currentSortBy === 'xp' ? 'active' : ''}" onclick="window.FriendsModule.setSortBy('xp')">⚡ Gesamt-XP</button>
                                <button type="button" class="segmented-btn ${currentSortBy === 'monthly' ? 'active' : ''}" onclick="window.FriendsModule.setSortBy('monthly')">📅 Fälle / Monat</button>
                                <button type="button" class="segmented-btn ${currentSortBy === 'streak' ? 'active' : ''}" onclick="window.FriendsModule.setSortBy('streak')">🔥 Streak</button>
                            </div>
                        </div>

                        <!-- Top Podium -->
                        <div class="friends-podium-row">
                            ${podiumOrder.map(posIdx => {
                                const p = fullSorted[posIdx];
                                if (!p) return '';
                                const rankNum = posIdx + 1;
                                const medal = rankNum === 1 ? '🥇' : (rankNum === 2 ? '🥈' : '🥉');
                                const metricText = currentSortBy === 'monthly'
                                    ? `${p.monthlyCases} Fälle`
                                    : (currentSortBy === 'streak' ? `🔥 ${p.streak}d` : `${p.xp} XP`);
                                return `
                                    <div class="podium-spot spot-${rankNum} ${p.isMe ? 'is-me-podium' : ''}">
                                        <div class="podium-medal">${medal}</div>
                                        <div class="podium-avatar">${p.avatar || '🩺'}</div>
                                        <div class="podium-name">${escapeSafe(p.name)}</div>
                                        <div class="podium-rank-badge">${getRankTitle(p.xp)}</div>
                                        <div class="podium-metric">${metricText}</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>

                        <!-- Ranglisten-Zeilen -->
                        <div class="friends-list-rows">
                            ${sortedBoard.map((person, idx) => {
                                const favMeta = CHALLENGE_LABELS[person.favoriteChallenge] || CHALLENGE_LABELS.audit;
                                return `
                                    <div class="friend-row-card ${person.isMe ? 'is-me-row' : ''}">
                                        <div class="friend-row-left">
                                            <span class="friend-rank-num">#${idx + 1}</span>
                                            <div class="friend-avatar-wrap">
                                                <span class="friend-avatar">${person.avatar || '🩺'}</span>
                                                <span class="friend-online-dot ${person.isOnline ? 'online' : 'offline'}" title="${person.isOnline ? 'Online' : 'Offline'}"></span>
                                            </div>
                                            <div class="friend-info">
                                                <div class="friend-name-line">
                                                    <strong>${escapeSafe(person.name)}</strong>
                                                    <span class="friend-title-pill">${getRankTitle(person.xp)}</span>
                                                </div>
                                                <div class="friend-meta-line">
                                                    <span>${escapeSafe(person.statusText || person.email)}</span>
                                                    <span>•</span>
                                                    <span title="Meistgespielte Challenge">${favMeta.icon} Fokus: ${favMeta.name}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="friend-row-stats">
                                            <div class="friend-stat-col ${currentSortBy === 'monthly' ? 'active-metric' : ''}">
                                                <span class="stat-val">${person.monthlyCases || 0}</span>
                                                <span class="stat-lbl">Fälle (${currentMonthName.slice(0, 3)})</span>
                                            </div>
                                            <div class="friend-stat-col ${currentSortBy === 'streak' ? 'active-metric' : ''}">
                                                <span class="stat-val">🔥 ${person.streak || 0}d</span>
                                                <span class="stat-lbl">Streak</span>
                                            </div>
                                            <div class="friend-stat-col ${currentSortBy === 'xp' ? 'active-metric' : ''}">
                                                <span class="stat-val xp-val">${person.xp || 0}</span>
                                                <span class="stat-lbl">XP</span>
                                            </div>
                                        </div>

                                        <div class="friend-row-actions">
                                            ${person.isMe ? `
                                                <span class="me-tag-pill">Dein Profil</span>
                                            ` : `
                                                <button type="button" class="friend-action-btn duel-btn-mini" onclick="window.FriendsModule.challengeFriendToDuel('${escapeSafe(person.email)}')" title="Ins 1v1 Klinik-Duell herausfordern">⚔️ Duell</button>
                                                <button type="button" class="friend-action-btn poke-btn-mini" onclick="window.FriendsModule.pokeFriend('${escapeSafe(person.name)}', this)" title="Motivations-Funk auf den Pager senden">📟 Funk</button>
                                                <button type="button" class="friend-action-btn remove-btn-mini" onclick="window.FriendsModule.removeFriend('${escapeSafe(person.id)}')" title="Aus Freundesliste entfernen">✕</button>
                                            `}
                                        </div>
                                    </div>
                                `;
                            }).join('')}

                            ${friends.length === 0 ? `
                                <div style="margin-top: 14px; padding: 18px; border: 1px dashed rgba(56, 189, 248, 0.35); border-radius: 12px; text-align: center; background: rgba(15, 23, 42, 0.4);">
                                    <div style="font-size: 1.5rem; margin-bottom: 6px;">📟</div>
                                    <strong style="display: block; margin-bottom: 4px; color: var(--text-main);">Noch keine Kollegen in deiner Freundesliste</strong>
                                    <p style="margin: 0; font-size: 0.82rem; color: var(--text-muted);">
                                        Teile deinen Pager-Code <code>${escapeSafe(me.friendCode)}</code> oder gib oben die E-Mail-Adresse bzw. den Code eines registrierten Kommilitonen ein.
                                    </p>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- RECHTS: CHALLENGE-BELIEBTHEIT & MONATS-ANALYSE -->
                    <div class="friends-analytics-col">
                        <div class="friends-analytics-card">
                            <h3 style="margin: 0 0 4px 0; font-size: 1.02rem;">📊 Beliebteste Challenges im Kollegium</h3>
                            <p style="margin: 0 0 16px 0; font-size: 0.78rem; color: var(--text-muted);">
                                Auswertung über alle <strong>${stats.totalChallengeRuns} absolvierten Einzel-Challenges</strong> deiner Lerngruppe:
                            </p>

                            <div class="challenge-popularity-list">
                                ${stats.sortedChallenges.map((item, idx) => `
                                    <div class="popularity-row">
                                        <div class="popularity-top">
                                            <span class="popularity-name">
                                                <span>${item.meta.icon}</span>
                                                <strong>${escapeSafe(item.meta.name)}</strong>
                                                ${idx === 0 && item.count > 0 ? '<span class="top-choice-pill">★ Nr. 1</span>' : ''}
                                            </span>
                                            <span class="popularity-numbers">${item.count}× (${item.pct}%)</span>
                                        </div>
                                        <div class="popularity-bar-track">
                                            <div class="popularity-bar-fill" style="width: ${item.count > 0 ? Math.max(6, item.pct) : 0}%; background: ${item.meta.color};"></div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Monats-Durchsatz Vergleich -->
                        <div class="friends-analytics-card">
                            <h3 style="margin: 0 0 4px 0; font-size: 1.02rem;">📈 Monats-Durchsatz (${currentMonthName})</h3>
                            <p style="margin: 0 0 14px 0; font-size: 0.78rem; color: var(--text-muted);">
                                Gelöste klinische Komplettfälle in diesem Monat im direkten Vergleich:
                            </p>
                            <div class="monthly-comparison-list">
                                ${[...allParticipants].sort((a, b) => (b.monthlyCases || 0) - (a.monthlyCases || 0)).map(p => {
                                    const maxCases = Math.max(10, ...allParticipants.map(x => x.monthlyCases || 0));
                                    const widthPct = Math.min(100, Math.round(((p.monthlyCases || 0) / maxCases) * 100));
                                    return `
                                        <div class="monthly-comp-row">
                                            <div class="monthly-comp-label">
                                                <span>${p.avatar || '🩺'} ${escapeSafe(p.name)}</span>
                                                <strong>${p.monthlyCases || 0} Fälle</strong>
                                            </div>
                                            <div class="popularity-bar-track">
                                                <div class="popularity-bar-fill" style="width: ${(p.monthlyCases || 0) > 0 ? Math.max(5, widthPct) : 0}%; background: ${p.isMe ? 'var(--accent-blue)' : 'var(--color-symptom)'};"></div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        `;
    }

    async function openView() {
        purgeLegacyMockData();
        installTelemetryHooks();
        renderView();
        await fetchFriendsFromCloud();
        renderView();
    }

    async function init() {
        purgeLegacyMockData();
        installTelemetryHooks();
        const friends = getFriendsList();
        updateSidebarBadge(friends.length);

        const sb = await waitForSupabase(5000);
        if (sb && sb.auth && !authListenerAttached) {
            authListenerAttached = true;
            sb.auth.onAuthStateChange((event, session) => {
                if (session?.user) {
                    window.currentSessionUser = session.user;
                    fetchFriendsFromCloud().then(() => {
                        const container = document.getElementById('friends-view');
                        if (container && !container.classList.contains('hidden')) {
                            renderView();
                        }
                    });
                }
            });
        }

        await fetchFriendsFromCloud();
    }

    return {
        init,
        openView,
        renderView,
        setSortBy,
        handleSearch,
        addFriendByInput,
        removeFriend,
        pokeFriend,
        challengeFriendToDuel,
        copyMyFriendCode,
        manualSync,
        recordChallengeActivity,
        recordMonthlyCaseSolved
    };
})();

window.FriendsModule = FriendsModule;

document.addEventListener('DOMContentLoaded', () => {
    FriendsModule.init();
});
