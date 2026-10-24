// =========================================================================
// MEDCHECK PEER-REVIEW & KOMMENTAR-ENGINE ("KLINISCHES KONSIL")
// =========================================================================

(function() {
    const LOCAL_COMMENTS_KEY = 'medcheck_case_comments_fallback_v1';
    const CREATOR_EMAIL_LOWER = 'marco.claudio.nani@gmail.com';

    const CHALLENGE_LABELS = {
        overview:   '🧭 Übersicht & Cornell Notes',
        audit:      '📋 Klinisches Audit',
        synapses:   '🧠 Synapsen-Matrix',
        cascade:    '🔗 Clinical Cascades',
        cat:        '🏷️ Taxonomie',
        quiz:       '🎓 Master-Exam',
        doctordle:  '🔍 Doctordle',
        flashcards: '🗂️ Flashcards'
    };

    const COMMENT_TYPES = {
        question:   { label: '❓ Unklarheit / Frage', css: 'tag-question' },
        correction: { label: '⚠️ Fehler / Leitlinien-Hinweis', css: 'tag-correction' },
        pearl:      { label: '💡 Eselsbrücke / Clinical Pearl', css: 'tag-pearl' },
        discussion: { label: '💬 Allgemeine Diskussion', css: 'tag-discussion' }
    };

    const CaseComments = {
        isOpen: false,
        currentCaseId: null,
        currentMode: 'overview',
        commentsCache: [], // Alle Kommentare zum aktuellen Fall
        isLoading: false,
        activeTypeFilter: 'ALL',

        init() {
            this.injectDrawerDOM();
            this.hookIntoPlayerLifecycle();
        },

        // Erzeugt das ein-/ausklappbare Panel am Ende der #player-view
        injectDrawerDOM() {
            const playerView = document.getElementById('player-view');
            if (!playerView || document.getElementById('mc-comments-wrapper')) return;

            const wrapper = document.createElement('div');
            wrapper.id = 'mc-comments-wrapper';
            wrapper.className = 'mc-comments-wrapper collapsed';

            wrapper.innerHTML = `
                <!-- KOPFZEILE (EIN-/AUSKLAPPBAR) -->
                <div class="mc-comments-header" id="mc-comments-toggle-bar" role="button" tabindex="0">
                    <div class="mc-comments-header-left">
                        <span class="mc-comments-icon">💬</span>
                        <div>
                            <div class="mc-comments-title">
                                Klinisches Konsil & Peer-Review
                                <span class="mc-comments-Context-pill" id="mc-comments-mode-label">🧭 Übersicht</span>
                            </div>
                            <div class="mc-comments-subtitle">
                                Unklarheiten klären, Leitlinien-Updates teilen oder Eselsbrücken diskutieren
                            </div>
                        </div>
                    </div>
                    <div class="mc-comments-header-right">
                        <span class="mc-comments-count-badge" id="mc-comments-count-badge">0 Beiträge</span>
                        <span class="mc-comments-chevron" id="mc-comments-chevron">▼</span>
                    </div>
                </div>

                <!-- AUSKLAPPBARER BODY -->
                <div class="mc-comments-body" id="mc-comments-body" style="display: none;">
                    
                    <!-- FILTER-LEISTE -->
                    <div class="mc-comments-filter-bar">
                        <div class="mc-filter-pills" id="mc-comments-filter-pills">
                            <button type="button" class="mc-filter-pill active" data-filter="ALL">Alle (diese Challenge)</button>
                            <button type="button" class="mc-filter-pill" data-filter="ALL_CASE">Gesamter Fall</button>
                            <button type="button" class="mc-filter-pill" data-filter="correction">⚠️ Fehler/Hinweise</button>
                            <button type="button" class="mc-filter-pill" data-filter="question">❓ Fragen</button>
                            <button type="button" class="mc-filter-pill" data-filter="pearl">💡 Eselsbrücken</button>
                        </div>
                        <button type="button" class="mc-refresh-btn" id="mc-comments-refresh-btn" title="Kommentare neu laden">↻ Aktualisieren</button>
                    </div>

                    <!-- KOMMENTAR-LISTE -->
                    <div class="mc-comments-list" id="mc-comments-list"></div>

                    <!-- EINGABE-FORMULAR -->
                    <form class="mc-comments-form" id="mc-comments-form" onsubmit="return false;">
                        <div class="mc-form-top-row">
                            <div class="mc-type-selector">
                                <label for="mc-comment-type-select">Kategorie:</label>
                                <select id="mc-comment-type-select" class="mc-comment-select">
                                    <option value="question">❓ Unklarheit / Verständnisfrage</option>
                                    <option value="correction">⚠️ Mögliche Korrektur / Leitlinien-Check</option>
                                    <option value="pearl">💡 Hilfreiche Eselsbrücke / Clinical Pearl</option>
                                    <option value="discussion">💬 Allgemeine Anmerkung</option>
                                </select>
                            </div>
                            <input type="text" id="mc-comment-author-input" class="mc-author-input" placeholder="Dein Name / Kürzel (optional)" maxlength="40">
                        </div>

                        <textarea id="mc-comment-textarea" class="mc-comment-textarea" rows="3" maxlength="2000" placeholder="Ist dir in dieser Challenge etwas unklar oder ist ein klinischer Detailpunkt diskussionswürdig? Teile es mit deinen Mitstudierenden..."></textarea>

                        <div class="mc-form-bottom-row">
                            <span class="mc-form-hint" id="mc-comment-auth-status">Sichtbar für alle Nutzer dieses Falls.</span>
                            <button type="submit" class="action-btn btn-sm" id="mc-comment-submit-btn">
                                💬 Beitrag veröffentlichen
                            </button>
                        </div>
                    </form>
                </div>
            `;

            playerView.appendChild(wrapper);
            this.bindEvents();
        },

        bindEvents() {
            const toggleBar = document.getElementById('mc-comments-toggle-bar');
            if (toggleBar) {
                toggleBar.addEventListener('click', () => this.toggleDrawer());
                toggleBar.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.toggleDrawer();
                    }
                });
            }

            const form = document.getElementById('mc-comments-form');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.submitComment();
                });
            }

            const refreshBtn = document.getElementById('mc-comments-refresh-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    if (typeof window.triggerHaptic === 'function') window.triggerHaptic(6);
                    this.fetchCommentsForCase(this.currentCaseId);
                });
            }

            const filterContainer = document.getElementById('mc-comments-filter-pills');
            if (filterContainer) {
                filterContainer.querySelectorAll('.mc-filter-pill').forEach(btn => {
                    btn.addEventListener('click', () => {
                        filterContainer.querySelectorAll('.mc-filter-pill').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        this.activeTypeFilter = btn.getAttribute('data-filter') || 'ALL';
                        this.renderCommentsList();
                    });
                });
            }

            // Gespeicherten Alias-Namen wiederherstellen
            const savedAlias = localStorage.getItem('medcheck_comment_alias');
            const authorInput = document.getElementById('mc-comment-author-input');
            if (savedAlias && authorInput) {
                authorInput.value = savedAlias;
            }
        },

        // Klinkt sich sauber in loadCaseById und switchPlayerMode ein
        hookIntoPlayerLifecycle() {
            const origLoadCase = window.loadCaseById;
            if (typeof origLoadCase === 'function') {
                window.loadCaseById = (caseId, opts) => {
                    origLoadCase(caseId, opts);
                    this.onCaseChanged(caseId);
                };
            }

            const origSwitchMode = window.switchPlayerMode;
            if (typeof origSwitchMode === 'function') {
                window.switchPlayerMode = (mode) => {
                    origSwitchMode(mode);
                    this.onModeChanged(mode);
                };
            }
        },

        toggleDrawer(forceState) {
            this.isOpen = typeof forceState === 'boolean' ? forceState : !this.isOpen;
            const wrapper = document.getElementById('mc-comments-wrapper');
            const body = document.getElementById('mc-comments-body');
            const chevron = document.getElementById('mc-comments-chevron');

            if (wrapper) wrapper.classList.toggle('collapsed', !this.isOpen);
            if (body) body.style.display = this.isOpen ? 'block' : 'none';
            if (chevron) chevron.textContent = this.isOpen ? '▲' : '▼';

            if (typeof window.triggerHaptic === 'function') window.triggerHaptic(6);
            if (this.isOpen) {
                this.renderCommentsList();
            }
        },

        async onCaseChanged(caseId) {
            this.currentCaseId = caseId;
            this.currentMode = typeof currentActiveChallenge !== 'undefined' ? currentActiveChallenge : 'overview';
            this.updateHeaderContext();
            await this.fetchCommentsForCase(caseId);
        },

        onModeChanged(mode) {
            this.currentMode = mode || 'overview';
            this.updateHeaderContext();
            this.updateCounterBadge();
            if (this.isOpen) {
                this.renderCommentsList();
            }
        },

        updateHeaderContext() {
            const modeLabelEl = document.getElementById('mc-comments-mode-label');
            if (modeLabelEl) {
                modeLabelEl.textContent = CHALLENGE_LABELS[this.currentMode] || this.currentMode;
            }
        },

        getSupabase() {
            return window.supabaseClient || window.supabase || window.sb || null;
        },

        getLocalComments() {
            try {
                return JSON.parse(localStorage.getItem(LOCAL_COMMENTS_KEY) || '[]');
            } catch (_e) {
                return [];
            }
        },

        saveLocalComments(list) {
            try {
                localStorage.setItem(LOCAL_COMMENTS_KEY, JSON.stringify(list));
            } catch (_e) {}
        },

        async fetchCommentsForCase(caseId) {
            if (!caseId) return;
            this.isLoading = true;
            this.renderCommentsList();

            const sb = this.getSupabase();
            let loadedFromCloud = false;

            if (sb) {
                try {
                    const { data, error } = await sb
                        .from('case_comments')
                        .select('*')
                        .eq('case_id', caseId)
                        .order('created_at', { ascending: false });

                    if (!error && Array.isArray(data)) {
                        this.commentsCache = data;
                        loadedFromCloud = true;
                    }
                } catch (err) {
                    console.warn('Kommentare Cloud-Abruf fehlgeschlagen, nutze lokalen Cache:', err);
                }
            }

            if (!loadedFromCloud) {
                const allLocal = this.getLocalComments();
                this.commentsCache = allLocal
                    .filter(c => c.case_id === caseId)
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            }

            this.isLoading = false;
            this.updateCounterBadge();
            this.renderCommentsList();
        },

        updateCounterBadge() {
            const badge = document.getElementById('mc-comments-count-badge');
            if (!badge) return;

            const modeComments = this.commentsCache.filter(c => c.challenge_mode === this.currentMode);
            const totalCaseComments = this.commentsCache.length;
            const unresolvedCorrections = modeComments.filter(c => c.comment_type === 'correction' && !c.is_resolved).length;

            if (modeComments.length > 0) {
                badge.textContent = `${modeComments.length} hier (${totalCaseComments} gesamt)`;
                badge.classList.add('has-comments');
            } else {
                badge.textContent = totalCaseComments > 0 ? `0 hier (${totalCaseComments} im Fall)` : '0 Beiträge';
                badge.classList.remove('has-comments');
            }

            badge.classList.toggle('has-warning', unresolvedCorrections > 0);
        },

        async getCurrentUser() {
            if (window.currentSessionUser) return window.currentSessionUser;
            const sb = this.getSupabase();
            if (sb && sb.auth) {
                try {
                    const { data } = await sb.auth.getSession();
                    return data?.session?.user || null;
                } catch (_e) {}
            }
            return null;
        },

        async submitComment() {
            const textarea = document.getElementById('mc-comment-textarea');
            const typeSelect = document.getElementById('mc-comment-type-select');
            const authorInput = document.getElementById('mc-comment-author-input');
            const submitBtn = document.getElementById('mc-comment-submit-btn');

            if (!textarea || !this.currentCaseId) return;
            const content = textarea.value.trim();
            if (!content) {
                alert('Bitte gib zuerst einen Kommentartext ein.');
                return;
            }

            const commentType = typeSelect ? typeSelect.value : 'discussion';
            const customAlias = authorInput ? authorInput.value.trim() : '';
            if (customAlias) {
                localStorage.setItem('medcheck_comment_alias', customAlias);
            }

            if (submitBtn) submitBtn.disabled = true;

            try {
                const user = await this.getCurrentUser();
                const emailPrefix = user?.email ? user.email.split('@')[0] : 'MedStudent';
                const authorName = customAlias || emailPrefix;

                const newCommentPayload = {
                    case_id: this.currentCaseId,
                    challenge_mode: this.currentMode || 'overview',
                    user_id: user ? user.id : null,
                    author_name: authorName,
                    author_email: user?.email || null,
                    comment_type: commentType,
                    content: content,
                    upvotes: [],
                    is_resolved: false
                };

                const sb = this.getSupabase();
                let savedCloudItem = null;

                if (sb && user) {
                    const { data, error } = await sb
                        .from('case_comments')
                        .insert([newCommentPayload])
                        .select()
                        .single();

                    if (error) throw error;
                    savedCloudItem = data;
                } else {
                    // Lokaler Fallback (Gastmodus oder Offline)
                    savedCloudItem = {
                        ...newCommentPayload,
                        id: 'loc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
                        created_at: new Date().toISOString(),
                        is_local_only: true
                    };
                    const localList = this.getLocalComments();
                    localList.unshift(savedCloudItem);
                    this.saveLocalComments(localList);
                }

                this.commentsCache.unshift(savedCloudItem);
                textarea.value = '';
                if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);

                this.updateCounterBadge();
                this.renderCommentsList();

            } catch (err) {
                console.error('Fehler beim Speichern des Kommentars:', err);
                alert(`Kommentar konnte nicht veröffentlicht werden: ${err.message || 'Bitte prüfe, ob du angemeldet bist.'}`);
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        },

        async deleteComment(commentId) {
            if (!commentId) return;
            if (!window.confirm('Möchtest du diesen Beitrag wirklich unwiderruflich löschen?')) return;

            const sb = this.getSupabase();
            const target = this.commentsCache.find(c => c.id === commentId);

            try {
                if (sb && !String(commentId).startsWith('loc_')) {
                    const { error } = await sb
                        .from('case_comments')
                        .delete()
                        .eq('id', commentId);

                    if (error) throw error;
                }

                // Auch aus lokalem Fallback entfernen
                const localList = this.getLocalComments().filter(c => c.id !== commentId);
                this.saveLocalComments(localList);

                this.commentsCache = this.commentsCache.filter(c => c.id !== commentId);
                if (typeof window.triggerHaptic === 'function') window.triggerHaptic(10);

                this.updateCounterBadge();
                this.renderCommentsList();
            } catch (err) {
                alert(`Löschen fehlgeschlagen: ${err.message}`);
            }
        },

        async toggleUpvote(commentId) {
            const target = this.commentsCache.find(c => c.id === commentId);
            if (!target) return;

            const user = await this.getCurrentUser();
            const voterId = user?.id || 'local_guest_user';

            let upvotes = Array.isArray(target.upvotes) ? [...target.upvotes] : [];
            if (upvotes.includes(voterId)) {
                upvotes = upvotes.filter(id => id !== voterId);
            } else {
                upvotes.push(voterId);
            }
            target.upvotes = upvotes;
            this.renderCommentsList();

            const sb = this.getSupabase();
            if (sb && user && !String(commentId).startsWith('loc_')) {
                try {
                    await sb.from('case_comments').update({ upvotes }).eq('id', commentId);
                } catch (_e) {}
            } else {
                const localList = this.getLocalComments();
                const idx = localList.findIndex(c => c.id === commentId);
                if (idx !== -1) {
                    localList[idx].upvotes = upvotes;
                    this.saveLocalComments(localList);
                }
            }
        },

        async toggleResolved(commentId) {
            const target = this.commentsCache.find(c => c.id === commentId);
            if (!target) return;

            target.is_resolved = !target.is_resolved;
            this.updateCounterBadge();
            this.renderCommentsList();

            const sb = this.getSupabase();
            if (sb && !String(commentId).startsWith('loc_')) {
                try {
                    await sb.from('case_comments').update({ is_resolved: target.is_resolved }).eq('id', commentId);
                } catch (_e) {}
            }
        },

        formatTimestamp(isoStr) {
            if (!isoStr) return '';
            try {
                const d = new Date(isoStr);
                return d.toLocaleDateString('de-CH', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
            } catch (_e) {
                return '';
            }
        },

        escape(str) {
            return String(str || '').replace(/[&<>'"]/g, tag => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
            }[tag] || tag));
        },

        async renderCommentsList() {
            const listEl = document.getElementById('mc-comments-list');
            const authStatusEl = document.getElementById('mc-comment-auth-status');
            if (!listEl) return;

            const user = await this.getCurrentUser();
            const isCreator = user?.email?.toLowerCase() === CREATOR_EMAIL_LOWER;

            if (authStatusEl) {
                authStatusEl.innerHTML = user
                    ? `🟢 Angemeldet als <strong>${this.escape(user.email)}</strong> – Synchronisiert mit allen Nutzern`
                    : `🟡 Gastmodus – Bitte unter <em>Einstellungen</em> anmelden, damit andere deine Kommentare sehen`;
            }

            if (this.isLoading) {
                listEl.innerHTML = `<div class="mc-comments-empty">Lade Beiträge...</div>`;
                return;
            }

            // Filtern nach aktivem Modus oder "Gesamter Fall"
            let filtered = this.commentsCache.filter(c => {
                if (this.activeTypeFilter === 'ALL') {
                    return c.challenge_mode === this.currentMode;
                }
                if (this.activeTypeFilter === 'ALL_CASE') {
                    return true;
                }
                return c.challenge_mode === this.currentMode && c.comment_type === this.activeTypeFilter;
            });

            if (filtered.length === 0) {
                const modeTitle = CHALLENGE_LABELS[this.currentMode] || this.currentMode;
                listEl.innerHTML = `
                    <div class="mc-comments-empty">
                        Noch keine Beiträge für <strong>${this.escape(modeTitle)}</strong> vorhanden.
                        Starte die Diskussion oder melde eine Unklarheit!
                    </div>
                `;
                return;
            }

            const voterId = user?.id || 'local_guest_user';

            listEl.innerHTML = filtered.map(c => {
                const typeMeta = COMMENT_TYPES[c.comment_type] || COMMENT_TYPES.discussion;
                const isAuthor = (user && c.user_id && c.user_id === user.id) || String(c.id).startsWith('loc_');
                const canDelete = isAuthor || isCreator;
                const canResolve = isAuthor || isCreator;
                const isCommentFromCreator = c.author_email?.toLowerCase() === CREATOR_EMAIL_LOWER;

                const upvotesArr = Array.isArray(c.upvotes) ? c.upvotes : [];
                const hasUpvoted = upvotesArr.includes(voterId);
                const modeBadge = this.activeTypeFilter === 'ALL_CASE'
                    ? `<span class="mc-comment-mode-origin">${this.escape(CHALLENGE_LABELS[c.challenge_mode] || c.challenge_mode)}</span>`
                    : '';

                return `
                    <div class="mc-comment-card ${c.is_resolved ? 'is-resolved' : ''}" data-comment-id="${this.escape(c.id)}">
                        <div class="mc-comment-top">
                            <div class="mc-comment-meta">
                                <span class="mc-comment-author">
                                    👤 ${this.escape(c.author_name || 'Anonym')}
                                    ${isCommentFromCreator ? '<span class="mc-creator-badge">⚡ Creator</span>' : ''}
                                </span>
                                <span class="mc-comment-tag ${typeMeta.css}">${typeMeta.label}</span>
                                ${modeBadge}
                                ${c.is_resolved ? '<span class="mc-resolved-badge">✓ Geklärt / Geprüft</span>' : ''}
                            </div>
                            <span class="mc-comment-date">${this.formatTimestamp(c.created_at)}</span>
                        </div>

                        <div class="mc-comment-text">${this.escape(c.content)}</div>

                        <div class="mc-comment-actions">
                            <button type="button" class="mc-upvote-btn ${hasUpvoted ? 'active' : ''}" data-upvote-id="${this.escape(c.id)}" title="Hilfreicher Beitrag">
                                👍 Hilfreich (${upvotesArr.length})
                            </button>

                            <div style="display:flex; gap:8px; align-items:center;">
                                ${canResolve ? `
                                    <button type="button" class="mc-resolve-btn" data-resolve-id="${this.escape(c.id)}" title="Als geklärt/überprüft markieren">
                                        ${c.is_resolved ? '↺ Wieder öffnen' : '✓ Als geklärt markieren'}
                                    </button>
                                ` : ''}
                                ${canDelete ? `
                                    <button type="button" class="mc-delete-btn" data-delete-id="${this.escape(c.id)}" title="Kommentar löschen">
                                        🗑️ Löschen
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Event-Listener für Karten-Buttons binden
            listEl.querySelectorAll('[data-delete-id]').forEach(btn => {
                btn.addEventListener('click', () => this.deleteComment(btn.getAttribute('data-delete-id')));
            });
            listEl.querySelectorAll('[data-upvote-id]').forEach(btn => {
                btn.addEventListener('click', () => this.toggleUpvote(btn.getAttribute('data-upvote-id')));
            });
            listEl.querySelectorAll('[data-resolve-id]').forEach(btn => {
                btn.addEventListener('click', () => this.toggleResolved(btn.getAttribute('data-resolve-id')));
            });
        }
    };

    window.CaseComments = CaseComments;

    document.addEventListener('DOMContentLoaded', () => {
        CaseComments.init();
    });
})();
