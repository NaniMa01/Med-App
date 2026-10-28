/* ==========================================================================
   MEDCHECK – FREUNDE, SCOREBOARD & KLINIK-TELEMETRIE (js/friends.js)
   ========================================================================== */

const FriendsModule = (() => {
    const FRIENDS_LIST_KEY    = 'medcheck_friends_list_v1';
    const TELEMETRY_STATS_KEY = 'medcheck_telemetry_stats_v1';
    const FRIEND_CODE_KEY     = 'medcheck_my_friend_code';

    let currentSortBy = 'xp'; // 'xp' | 'monthly' | 'streak'
    let currentSearchTerm = '';
    let cloudProfilesCache = [];

    const CHALLENGE_LABELS = {
        audit:          { name: 'Klinisches Audit', icon: '📋', color: '#38bdf8' },
        quiz:           { name: 'Master-Exam (MC)', icon: '🎓', color: '#818cf8' },
        synapses:       { name: 'Synapsen-Matrix',  icon: '🧠', color: '#22d3ee' },
        cascades:       { name: 'Clinical Cascades', icon: '🔗', color: '#f59e0b' },
        categorization: { name: 'Taxonomie',        icon: '🏷️', color: '#a855f7' },
        doctordle:      { name: 'Doctordle',        icon: '🔍', color: '#10b981' },
        flashcards:     { name: 'Flashcards',       icon: '🗂️', color: '#ec4899' }
    };

    // Realistische Kollegen-Profile für den sofortigen Start (und Offline-Modus)
    const DEFAULT_COLLEAGUES = [
        {
            id: 'col_clara',
            name: 'Clara M. Radu',
            email: 'clara.radu@stud.unibas.ch',
            avatar: '🩺',
            xp: 1840,
            monthlyCases: 14,
            streak: 9,
            favoriteChallenge: 'synapses',
            challengeCounts: { audit: 18, quiz: 15, synapses: 29, cascades: 12, categorization: 9, doctordle: 21, flashcards: 24 },
            statusText: 'Löst gerade Neuro-Fälle',
            isOnline: true
        },
        {
            id: 'col_benjamin',
            name: 'Benjamin Inauen',
            email: 'b.inauen@stud.unibas.ch',
            avatar: '🔪',
            xp: 1420,
            monthlyCases: 11,
            streak: 5,
            favoriteChallenge: 'audit',
            challengeCounts: { audit: 27, quiz: 14, synapses: 11, cascades: 16, categorization: 8, doctordle: 12, flashcards: 15 },
            statusText: 'Chirurgie & Triage Fokus',
            isOnline: true
        },
        {
            id: 'col_elias',
            name: 'Elias (Klinik-Team)',
            email: 'elias.med@unibas.ch',
            avatar: '🚑',
            xp: 980,
            monthlyCases: 8,
            streak: 3,
            favoriteChallenge: 'doctordle',
            challengeCounts: { audit: 11, quiz: 12, synapses: 9, cascades: 7, categorization: 6, doctordle: 22, flashcards: 18 },
            statusText: 'Vor 2 Std. in der Notaufnahme',
            isOnline: false
        }
    ];

    // ======================================================================
    // 1. TELEMETRIE & EIGENE MONATS-/CHALLENGE-STATISTIK
    // ======================================================================
    function getCurrentMonthKey() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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

    function getSolvedCasesCountFallback() {
        try {
            const solved = JSON.parse(localStorage.getItem('solved_cases') || '[]');
            return Array.isArray(solved) ? solved.length : 0;
        } catch (_e) {
            return 0;
        }
    }

    function createInitialTelemetry(monthKey) {
        // Initialisiert die Statistik intelligent anhand bereits vorhandener ProgressManager-Daten
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
        localStorage.setItem(TELEMETRY_STATS_KEY, JSON.stringify(initial));
        return initial;
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

    // Klinkt sich automatisch in ProgressManager & finishCase ein
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
    function getMyFriendCode() {
        let code = localStorage.getItem(FRIEND_CODE_KEY);
        if (!code) {
            const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
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

        const userEmail = window.currentSessionUser?.email || 'du@stud.unibas.ch';
        const displayName = window.currentSessionUser?.email
            ? window.currentSessionUser.email.split('@')[0] + ' (Du)'
            : 'Marco Nani (Du)';

        return {
            id: 'me_user',
            isMe: true,
            name: displayName,
            email: userEmail,
            friendCode: getMyFriendCode(),
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
            const saved = JSON.parse(localStorage.getItem(FRIENDS_LIST_KEY) || 'null');
            if (!Array.isArray(saved)) {
                localStorage.setItem(FRIENDS_LIST_KEY, JSON.stringify(DEFAULT_COLLEAGUES));
                return [...DEFAULT_COLLEAGUES];
            }
            return saved;
        } catch (_e) {
            return [...DEFAULT_COLLEAGUES];
        }
    }

    function saveFriendsList(list) {
        try {
            localStorage.setItem(FRIENDS_LIST_KEY, JSON.stringify(list));
            updateSidebarBadge(list.length);
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
    // 3. SUPABASE CLOUD-SYNC (FALLBACK-SICHER)
    // ======================================================================
    function getSupabase() {
        return window.supabaseClient || window.supabase || window.sb || null;
    }

async function syncMyStatsToCloud() {
        const sb = getSupabase();
        if (!sb || !sb.auth) return;

        try {
            const { data: { session } } = await sb.auth.getSession();
            if (!session?.user) return;

            const me = getMyProfile();
            const currentUid = session.user.id;
            
            // Setzt 'id' UND 'user_id' auf die User-ID, damit Postgres in keinem Fall
            // eine "null value in column id"-Verletzung wirft!
            const payload = {
                id: currentUid,
                user_id: currentUid,
                email: session.user.email.toLowerCase(),
                display_name: me.name.replace(' (Du)', ''),
                friend_code: me.friendCode,
                xp: me.xp,
                monthly_cases: me.monthlyCases,
                streak: me.streak,
                favorite_challenge: me.favoriteChallenge,
                challenge_counts: me.challengeCounts,
                updated_at: new Date().toISOString()
            };

            const { error } = await sb.from('user_profiles').upsert(payload, { 
                onConflict: 'user_id' 
            });

            if (error) {
                // Fallback für alte Schemas, die noch 'id' als Konfliktspalte erwarten
                if (error.message && error.message.includes('user_id')) {
                    const fallbackRes = await sb.from('user_profiles').upsert(payload, { 
                        onConflict: 'id' 
                    });
                    if (fallbackRes.error) {
                        console.warn("[Friends] Cloud-Sync Hinweis:", fallbackRes.error.message);
                    }
                } else {
                    console.warn("[Friends] Cloud-Sync Hinweis:", error.message);
                }
            }
        } catch (err) {
            console.warn('[Friends] Konnte Profil nicht zur Cloud senden:', err);
        }
    }
    async function fetchFriendsFromCloud() {
        const sb = getSupabase();
        if (!sb) return;

        try {
            const { data, error } = await sb
                .from('user_profiles')
                .select('*')
                .order('xp', { ascending: false })
                .limit(50);

            if (!error && Array.isArray(data) && data.length > 0) {
                cloudProfilesCache = data;
                const localFriends = getFriendsList();
                let updated = false;

                localFriends.forEach(friend => {
                    const match = data.find(d =>
                        (d.email && friend.email && d.email.toLowerCase() === friend.email.toLowerCase()) ||
                        (d.friend_code && friend.friendCode && d.friend_code === friend.friendCode)
                    );
                    if (match) {
                        friend.xp = match.xp ?? friend.xp;
                        friend.monthlyCases = match.monthly_cases ?? friend.monthlyCases;
                        friend.streak = match.streak ?? friend.streak;
                        friend.favoriteChallenge = match.favorite_challenge || friend.favoriteChallenge;
                        if (match.challenge_counts) friend.challengeCounts = match.challenge_counts;
                        updated = true;
                    }
                });

                if (updated) saveFriendsList(localFriends);
            }
        } catch (_e) {}
    }

    // ======================================================================
    // 4. FREUND HINZUFÜGEN, ENTFERNEN, ANFUNKEN & DUELLIEREN
    // ======================================================================
    async function addFriendByInput() {
        const inputEl = document.getElementById('friends-add-input');
        const fbEl = document.getElementById('friends-add-feedback');
        if (!inputEl) return;

        const raw = inputEl.value.trim();
        if (!raw) {
            showAddFeedback('Bitte gib eine E-Mail-Adresse, einen Namen oder einen Freundes-Code (z. B. MC-BS-...) ein.', 'error');
            return;
        }

        const friends = getFriendsList();
        const exists = friends.some(f =>
            f.email.toLowerCase() === raw.toLowerCase() ||
            f.name.toLowerCase() === raw.toLowerCase() ||
            (f.friendCode && f.friendCode.toLowerCase() === raw.toLowerCase())
        );

        if (exists) {
            showAddFeedback(`„${raw}“ befindet sich bereits in deinem Kollegium!`, 'error');
            return;
        }

        // Prüfen, ob das Profil in Supabase existiert
        const cloudMatch = cloudProfilesCache.find(d =>
            (d.email && d.email.toLowerCase() === raw.toLowerCase()) ||
            (d.friend_code && d.friend_code.toLowerCase() === raw.toLowerCase()) ||
            (d.display_name && d.display_name.toLowerCase() === raw.toLowerCase())
        );

        const avatars = ['🩺', '🧠', '🫀', '🔬', '🩻', '💉', '🧬'];
        const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)];
        const challengeKeys = Object.keys(CHALLENGE_LABELS);
        const favKey = cloudMatch?.favorite_challenge || challengeKeys[Math.floor(Math.random() * challengeKeys.length)];

        // Erzeuge sinnvolle Initialwerte (oder übernehme echte Cloud-Werte)
        const cleanName = cloudMatch?.display_name || (raw.includes('@')
            ? raw.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
            : raw);

        const cleanEmail = cloudMatch?.email || (raw.includes('@') ? raw.toLowerCase() : `${raw.toLowerCase().replace(/[^a-z0-9]/g, '')}@stud.unibas.ch`);

        const newFriend = {
            id: 'friend_' + Date.now(),
            name: cleanName,
            email: cleanEmail,
            friendCode: cloudMatch?.friend_code || null,
            avatar: randomAvatar,
            xp: cloudMatch?.xp ?? Math.floor(450 + Math.random() * 1100),
            monthlyCases: cloudMatch?.monthly_cases ?? Math.floor(4 + Math.random() * 12),
            streak: cloudMatch?.streak ?? Math.floor(1 + Math.random() * 7),
            favoriteChallenge: favKey,
            challengeCounts: cloudMatch?.challenge_counts || {
                audit: Math.floor(5 + Math.random() * 18),
                quiz: Math.floor(5 + Math.random() * 18),
                synapses: Math.floor(5 + Math.random() * 18),
                cascades: Math.floor(3 + Math.random() * 12),
                categorization: Math.floor(3 + Math.random() * 10),
                doctordle: Math.floor(4 + Math.random() * 16),
                flashcards: Math.floor(6 + Math.random() * 20)
            },
            statusText: cloudMatch ? 'Verifiziertes Cloud-Profil' : 'Neu im Kollegium',
            isOnline: true
        };

        friends.push(newFriend);
        saveFriendsList(friends);
        inputEl.value = '';

        if (typeof window.triggerHaptic === 'function') window.triggerHaptic([10, 30, 10]);
        renderView();
        showAddFeedback(`✓ ${cleanName} wurde erfolgreich zu deinem Kollegium hinzugefügt!`, 'success');
    }

    function removeFriend(friendId) {
        const friends = getFriendsList();
        const target = friends.find(f => f.id === friendId);
        if (!target) return;

        if (!window.confirm(`Möchtest du „${target.name}“ wirklich aus deiner Freundesliste entfernen?`)) return;

        const filtered = friends.filter(f => f.id !== friendId);
        saveFriendsList(filtered);
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);
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

        // Zeige MedCheck Toast
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
        window.switchTab('duel', navDuel);

        // Übergibt die E-Mail direkt in das Suchfeld der Klinik-Duell-Arena
        setTimeout(() => {
            const emailInput = document.querySelector('.duel-email-input') || document.getElementById('duel-opponent-email');
            if (emailInput) {
                emailInput.value = friendEmail;
                emailInput.focus();
            }
        }, 120);
    }

    function copyMyFriendCode(btnEl) {
        const code = getMyFriendCode();
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
        setTimeout(() => fbEl.classList.add('hidden'), 4000);
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

        const totalChallengeRuns = Object.values(combinedChallenges).reduce((a, b) => a + b, 0) || 1;
        const sortedChallenges = Object.entries(combinedChallenges)
            .map(([key, count]) => ({
                key,
                count,
                pct: Math.round((count / totalChallengeRuns) * 100),
                meta: CHALLENGE_LABELS[key] || { name: key, icon: '⚡', color: '#38bdf8' }
            }))
            .sort((a, b) => b.count - a.count);

        return {
            totalMonthlyCases,
            totalXp,
            totalChallengeRuns,
            topChallenge: sortedChallenges[0],
            sortedChallenges
        };
    }

    function renderView() {
        const container = document.getElementById('friends-view');
        if (!container) return;

        const me = getMyProfile();
        const friends = getFriendsList();
        updateSidebarBadge(friends.length);

        const allParticipants = [me, ...friends];
        const stats = computeCommunityStats(allParticipants);

        // Sortieren für das Scoreboard
        const sortedBoard = [...allParticipants]
            .filter(p => !currentSearchTerm || p.name.toLowerCase().includes(currentSearchTerm) || p.email.toLowerCase().includes(currentSearchTerm))
            .sort((a, b) => {
                if (currentSortBy === 'monthly') return (b.monthlyCases || 0) - (a.monthlyCases || 0);
                if (currentSortBy === 'streak')  return (b.streak || 0) - (a.streak || 0);
                return (b.xp || 0) - (a.xp || 0);
            });

        const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
        const currentMonthName = monthNames[new Date().getMonth()];

        // Gemeinsames Monatsziel (z. B. 50 Fälle im Monat)
        const teamGoalTarget = Math.max(50, allParticipants.length * 12);
        const teamGoalPct = Math.min(100, Math.round((stats.totalMonthlyCases / teamGoalTarget) * 100));

        // Top 3 Podium (aus der ungefilterten Sortierung)
        const fullSorted = [...allParticipants].sort((a, b) => {
            if (currentSortBy === 'monthly') return (b.monthlyCases || 0) - (a.monthlyCases || 0);
            if (currentSortBy === 'streak')  return (b.streak || 0) - (a.streak || 0);
            return (b.xp || 0) - (a.xp || 0);
        });

        container.innerHTML = `
            <div class="friends-wrapper">
                <!-- 1. HEADER & FREUNDES-CODE -->
                <div class="friends-header-card">
                    <div>
                        <div class="friends-kicker">KLINISCHES KOLLEGIUM & TELEMETRIE</div>
                        <h2 class="friends-main-title">👥 Freunde & Scoreboard</h2>
                        <p class="friends-subtitle">Vergleiche deinen monatlichen Fall-Durchsatz, sieh dir die beliebtesten Challenges an und fordere Kollegen heraus.</p>
                    </div>
                    <div class="friends-code-box">
                        <span class="friends-code-label">Dein Pager-Code:</span>
                        <div class="friends-code-row">
                            <code id="my-friend-code-display">${escapeSafe(me.friendCode)}</code>
                            <button type="button" class="action-btn secondary btn-sm" onclick="window.FriendsModule.copyMyFriendCode(this)">📋 Kopieren</button>
                        </div>
                    </div>
                </div>

                <!-- 2. FREUND HINZUFÜGEN LEISTE -->
                <div class="friends-add-card">
                    <div class="friends-add-row">
                        <div class="friends-input-wrap">
                            <span class="friends-input-icon">🔍</span>
                            <input type="text" id="friends-add-input" class="friends-add-input" placeholder="Kommilitonen per E-Mail (z.B. name@stud.unibas.ch), Name oder Pager-Code hinzufügen..." onkeydown="if(event.key==='Enter') window.FriendsModule.addFriendByInput()">
                        </div>
                        <button type="button" class="action-btn" onclick="window.FriendsModule.addFriendByInput()">+ Freund hinzufügen</button>
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
                                <h3 style="margin: 0; font-size: 1.1rem;">🏆 Kollegiums-Scoreboard</h3>
                                <span style="font-size: 0.78rem; color: var(--text-muted);">Sortiert nach ${currentSortBy === 'xp' ? 'Gesamt-XP' : (currentSortBy === 'monthly' ? `Fällen im ${currentMonthName}` : 'Dienst-Streak')}</span>
                            </div>
                            <div class="segmented-control" style="margin: 0;">
                                <button type="button" class="segmented-btn ${currentSortBy === 'xp' ? 'active' : ''}" onclick="window.FriendsModule.setSortBy('xp')">⚡ Gesamt-XP</button>
                                <button type="button" class="segmented-btn ${currentSortBy === 'monthly' ? 'active' : ''}" onclick="window.FriendsModule.setSortBy('monthly')">📅 Fälle / Monat</button>
                                <button type="button" class="segmented-btn ${currentSortBy === 'streak' ? 'active' : ''}" onclick="window.FriendsModule.setSortBy('streak')">🔥 Streak</button>
                            </div>
                        </div>

                        <!-- Top 3 Podium -->
                        <div class="friends-podium-row">
                            ${[1, 0, 2].map(posIdx => {
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
                                                ${idx === 0 ? '<span class="top-choice-pill">★ Nr. 1</span>' : ''}
                                            </span>
                                            <span class="popularity-numbers">${item.count}× (${item.pct}%)</span>
                                        </div>
                                        <div class="popularity-bar-track">
                                            <div class="popularity-bar-fill" style="width: ${Math.max(6, item.pct)}%; background: ${item.meta.color};"></div>
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
                                    const maxCases = Math.max(15, ...allParticipants.map(x => x.monthlyCases || 0));
                                    const widthPct = Math.min(100, Math.round(((p.monthlyCases || 0) / maxCases) * 100));
                                    return `
                                        <div class="monthly-comp-row">
                                            <div class="monthly-comp-label">
                                                <span>${p.avatar || '🩺'} ${escapeSafe(p.name)}</span>
                                                <strong>${p.monthlyCases || 0} Fälle</strong>
                                            </div>
                                            <div class="popularity-bar-track">
                                                <div class="popularity-bar-fill" style="width: ${Math.max(5, widthPct)}%; background: ${p.isMe ? 'var(--accent-blue)' : 'var(--color-symptom)'};"></div>
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
        installTelemetryHooks();
        renderView();
        await fetchFriendsFromCloud();
        renderView();
    }

    function init() {
        installTelemetryHooks();
        const friends = getFriendsList();
        updateSidebarBadge(friends.length);
        syncMyStatsToCloud();
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
        recordChallengeActivity,
        recordMonthlyCaseSolved
    };
})();

window.FriendsModule = FriendsModule;

document.addEventListener('DOMContentLoaded', () => {
    FriendsModule.init();
});
