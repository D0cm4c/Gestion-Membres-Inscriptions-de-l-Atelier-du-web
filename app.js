(function () {
    'use strict';

    // Page Membres (membres.html) : CRUD fiches, recherche/tri/filtres, visites (pointage),
    // impressions (solde), abonnements, vues cartes/liste, export CSV. Dépend de : db.js, escape.js, layout.js.

    var PREFS_KEY = 'atelierduweb_members_prefs';
    var VISIT_PRICE = 1;

    var todayDateEl = document.getElementById('todayDate');
    if (todayDateEl) {
        todayDateEl.textContent = new Date().toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }

    var grid = document.getElementById('membersGrid');
    if (!grid) return;

    var modal = document.getElementById('memberModal');
    var form = document.getElementById('memberForm');
    var addBtn = document.getElementById('addMemberBtn');
    var cancelBtn = document.getElementById('cancelBtn');
    var modalTitle = document.getElementById('modalTitle');
    var searchInput = document.getElementById('searchInput');
    var emptyState = document.getElementById('emptyState');
    var sortSelect = document.getElementById('sortSelect');
    var loading = document.getElementById('loadingState');
    var membersCount = document.getElementById('membersCount');
    var viewGridBtn = document.getElementById('viewGridBtn');
    var viewListBtn = document.getElementById('viewListBtn');
    var exportBtn = document.getElementById('exportBtn');
    var formError = document.getElementById('formError');
    var startDateInput = document.getElementById('startDate');
    var endDateInput = document.getElementById('endDate');
    var detailModal = document.getElementById('detailModal');
    var detailBody = document.getElementById('detailBody');
    var detailTitle = document.getElementById('detailTitle');
    var detailCloseBtn = document.getElementById('detailCloseBtn');
    var detailCheckinBtn = document.getElementById('detailCheckinBtn');
    var detailMember = null;

    var currentFilter = 'all';
    var currentView = 'grid';

    var SUB_LABELS = {
        none: { label: 'Aucun abo', badge: 'badge-sub-none' },
        monthly: { label: 'Abo mensuel · 3 €', badge: 'badge-sub-monthly' },
        yearly: { label: 'Abo annuel · 30 €', badge: 'badge-sub-yearly' }
    };

    var SORTS = {
        'name-asc': 'm.last_name COLLATE NOCASE ASC, m.first_name COLLATE NOCASE ASC',
        'name-desc': 'm.last_name COLLATE NOCASE DESC, m.first_name COLLATE NOCASE DESC',
        'first-name-asc': 'm.first_name COLLATE NOCASE ASC, m.last_name COLLATE NOCASE ASC',
        'first-name-desc': 'm.first_name COLLATE NOCASE DESC, m.last_name COLLATE NOCASE DESC',
        'age-asc': 'm.age IS NULL, m.age ASC',
        'age-desc': 'm.age IS NULL, m.age DESC',
        'start-desc': 'm.start_date IS NULL, m.start_date DESC',
        'start-asc': 'm.start_date IS NULL, m.start_date ASC',
        'end-asc': 'm.end_date IS NULL, m.end_date ASC',
        'end-desc': 'm.end_date IS NULL, m.end_date DESC',
        'visits-desc': 'visit_count DESC, m.last_name COLLATE NOCASE ASC',
        'created-desc': 'm.created_at DESC'
    };

    var FILTERS = {
        all: null,
        // Actifs / Expirés : uniquement les membres AVEC abonnement (exclut les inactifs — décision EPN)
        active: "(m.subscription IS NOT NULL AND m.subscription != 'none') AND (date(m.end_date) >= date('now') OR m.end_date IS NULL)",
        expired: "(m.subscription IS NOT NULL AND m.subscription != 'none') AND date(m.end_date) < date('now') AND m.end_date IS NOT NULL",
        subscribed: 'm.subscription != \'none\'',
        inactive: "(m.subscription = 'none' OR m.subscription IS NULL)",
        'prints-due': '(SELECT COALESCE(SUM(amount), 0) FROM prints p WHERE p.member_id = m.id AND paid = 0) > 0'
    };

    function loadPrefs() {
        try {
            var prefs = JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
            if (prefs.sort && SORTS[prefs.sort]) sortSelect.value = prefs.sort;
            if (prefs.filter && FILTERS[prefs.filter]) currentFilter = prefs.filter;
            if (prefs.view === 'list' || prefs.view === 'grid') currentView = prefs.view;
            if (typeof prefs.search === 'string') searchInput.value = prefs.search;
        } catch (e) { /* best effort */ }
        syncFilterButtons();
        syncViewButtons();
    }

    function savePrefs() {
        try {
            localStorage.setItem(PREFS_KEY, JSON.stringify({
                sort: sortSelect.value, filter: currentFilter,
                view: currentView, search: searchInput.value
            }));
        } catch (e) { /* best effort */ }
    }

    function syncFilterButtons() {
        document.querySelectorAll('.filters-bar [data-filter]').forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-filter') === currentFilter);
        });
    }

    function syncViewButtons() {
        viewGridBtn.classList.toggle('active', currentView === 'grid');
        viewListBtn.classList.toggle('active', currentView === 'list');
    }

    function escapeHtml(str) { return window.ADWEscape.html(str); }

    var GENDER_LABELS = { F: 'Femme', M: 'Homme', X: 'Autre / Non-binaire' };
    var STATUS_LABELS = {
        travailleur: 'Travailleur.se', interim: 'Intérim', actiris: 'Actiris',
        mutuelle: 'Mutuelle', cpas: 'CPAS', pensionne: 'Pensionné',
        etudiant: 'Étudiant', enfant: 'Enfant'
    };

    function initPostalCodes() {
        var dl = document.getElementById('postalCodesList');
        if (!dl || typeof ADW_POSTAL_CODES === 'undefined') return;
        var frag = document.createDocumentFragment();
        ADW_POSTAL_CODES.forEach(function (pc) {
            var opt = document.createElement('option');
            opt.value = pc[0] + ' — ' + pc[1];
            frag.appendChild(opt);
        });
        dl.appendChild(frag);
    }

    function normalizePostalCode(input) {
        if (!input) return '';
        var m = String(input).match(/\b(\d{4})\b/);
        return m ? m[1] : '';
    }

    initPostalCodes();

    function isExpired(member) {
        if (!member.end_date) return false;
        return new Date(member.end_date) < new Date(new Date().toDateString());
    }

    function initials(member) {
        return ((member.first_name || '?').charAt(0) + (member.last_name || '?').charAt(0)).toUpperCase();
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('fr-BE');
    }

    function getMembers() {
        var order = SORTS[sortSelect.value] || SORTS['name-asc'];
        var query = (searchInput.value || '').trim();
        var conditions = [];
        var params = [];

        var filter = FILTERS[currentFilter];
        if (filter) conditions.push('(' + filter + ')');

        if (query) {
            if (/^\d+$/.test(query)) {
                conditions.push('CAST(m.member_no AS TEXT) LIKE ?');
                params.push('%' + query + '%');
            } else {
            conditions.push('lower(m.first_name || \' \' || m.last_name || \' \' || COALESCE(m.email,\'\') || \' \' || COALESCE(m.phone,\'\') || \' \' || COALESCE(m.address,\'\')) LIKE ?');
            params.push('%' + query.toLowerCase() + '%');
            }
        }

        var sql = 'SELECT m.*, ' +
            '(SELECT COUNT(*) FROM visits v WHERE v.member_id = m.id) AS visit_count, ' +
            '(SELECT COUNT(*) FROM visits v WHERE v.member_id = m.id AND v.visit_date = date(\'now\')) AS visited_today, ' +
            '(SELECT COALESCE(SUM(amount), 0) FROM prints p WHERE p.member_id = m.id AND paid = 0) AS print_balance ' +
            'FROM members m';
        if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
        sql += ' ORDER BY ' + order;
        return ADWDatabase.queryAll(sql, params);
    }

    function subBadge(member) {
        var s = SUB_LABELS[member.subscription] || SUB_LABELS.none;
        return '<span class="badge ' + s.badge + '">' + s.label + '</span>';
    }

    function statusBadge(member) {
        // « Aucun abo » = pas d'inscription dans le temps : ni Active ni Expirée
        // (décision EPN oct. 2026) — badge neutre « Sans abo ».
        if ((member.subscription || 'none') === 'none') {
            return '<span class="badge badge-sub-none">Inactif</span>';
        }
        var expired = isExpired(member);
        return '<span class="badge ' + (expired ? 'expired' : 'active-member') + '">' +
            (expired ? 'Expirée' : 'Active') + '</span>';
    }

    function cardHTML(member) {
        return '<div class="card-top">' +
                '<div class="member-avatar" aria-hidden="true">' + escapeHtml(initials(member)) + '</div>' +
                '<div class="member-idblock">' +
                    '<div class="member-name">' + escapeHtml(member.first_name) + ' ' + escapeHtml(member.last_name) + ' <span class="member-no">#' + (member.member_no || '—') + '</span></div>' +
                    '<div class="member-badges">' + statusBadge(member) + subBadge(member) + '</div>' +
                '</div>' +
            '</div>' +
            '<div class="member-meta">' +
                (member.age ? '<span>🎂 ' + escapeHtml(member.age) + ' ans' +
                    (member.gender ? ' · ' + (GENDER_LABELS[member.gender] || member.gender) : '') + '</span>' : (member.gender ? '<span>' + (GENDER_LABELS[member.gender] || member.gender) + '</span>' : '')) +
                (member.postal_code ? '<span>🏠 ' + escapeHtml(member.postal_code) + '</span>' : '') +
                (member.social_status ? '<span>💼 ' + escapeHtml(STATUS_LABELS[member.social_status] || member.social_status) + '</span>' : '') +
                (member.email ? '<span>✉️ <a href="mailto:' + escapeHtml(member.email) + '">' + escapeHtml(member.email) + '</a></span>' : '') +
                (member.phone ? '<span>📞 <a href="tel:' + escapeHtml(member.phone.replace(/\s/g, '')) + '">' + escapeHtml(member.phone) + '</a></span>' : '') +
                (member.address ? '<span>📍 ' + escapeHtml(member.address) + '</span>' : '') +
            '</div>' +
            '<div class="member-visits">' +
                '<span>Visites : <strong>' + member.visit_count + '</strong>' +
                (member.visited_today ? ' <span class="badge badge-ok">✓ aujourd\'hui</span>' : '') + '</span>' +
                (member.print_balance > 0 ? '<span class="print-balance">🖨️ ' + member.print_balance.toFixed(2).replace('.', ',') + ' € dus</span>' : '') +
                '<span class="dates-cell">du ' + escapeHtml(formatDate(member.start_date)) + ' au ' + escapeHtml(formatDate(member.end_date)) + '</span>' +
            '</div>';
    }

    function rowHTML(member) {
        return '<div class="list-cell avatar-cell"><span class="member-avatar small" aria-hidden="true">' + escapeHtml(initials(member)) + '</span></div>' +
            '<div class="list-cell name-cell">' + escapeHtml(member.first_name) + ' ' + escapeHtml(member.last_name) + ' <span class="member-no">#' + (member.member_no || '—') + '</span></div>' +
            '<div class="list-cell">' + (member.age ? escapeHtml(member.age) + ' ans' : '—') + '</div>' +
            '<div class="list-cell">' + subBadge(member) + '</div>' +
            '<div class="list-cell">' + (member.email ? escapeHtml(member.email) : '—') + '</div>' +
            '<div class="list-cell">' + escapeHtml(member.visit_count) + ' visite' + (member.visit_count > 1 ? 's' : '') + '</div>' +
            '<div class="list-cell dates-cell">' + statusBadge(member) + '</div>';
    }

    var RENDER_CAP = 200;

    function render() {
        var members = getMembers();
        grid.className = currentView === 'list' ? 'members-list' : 'members-grid';
        grid.innerHTML = '';
        emptyState.hidden = members.length > 0;
        membersCount.textContent = members.length + ' membre' + (members.length > 1 ? 's' : '');
        var shown = members.slice(0, RENDER_CAP);

        shown.forEach(function (member) {
            var expired = isExpired(member);
            var item = document.createElement('div');
            var inactive = (member.subscription || 'none') === 'none';
            item.className = (currentView === 'list' ? 'member-row' : 'member-card') +
                (expired ? ' expired' : '') + (inactive ? ' inactive' : '');
            item.innerHTML = currentView === 'list' ? rowHTML(member) : cardHTML(member);

            // UX refonte : une seule porte d'entrée — clic sur la carte/ligne → modale fiche
            // (plus de bouton Modifier dans la liste ; l'édition vit dans la modale fiche)
            item.addEventListener('click', function (e) {
                if (e.target.closest('button, a')) return;
                openDetail(member.id);
            });
            grid.appendChild(item);
        });

        if (members.length > RENDER_CAP) {
            var more = document.createElement('div');
            more.className = 'empty-state';
            more.style.border = 'none';
            more.style.boxShadow = 'none';
            more.innerHTML = '<p>' + (members.length - RENDER_CAP) + ' membre' + (members.length - RENDER_CAP > 1 ? 's' : '') +
                ' supplémentaire' + (members.length - RENDER_CAP > 1 ? 's' : '') +
                ' non affiché' + (members.length - RENDER_CAP > 1 ? 's' : '') +
                ' — affinez la recherche ou le tri.</p>';
            grid.appendChild(more);
        }
    }

    /* ---------- Fiche détail ---------- */

    // Format date dd/mm/aa (ex. 16/11/26) — aperçus de renouvellement
    function fmtDMY(iso) {
        if (!iso || iso.length < 10) return iso || '';
        return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(2, 4);
    }

    function openDetail(id) {
        var rows = ADWDatabase.queryAll(
            'SELECT m.*, ' +
            '(SELECT COUNT(*) FROM visits v WHERE v.member_id = m.id) AS visit_count, ' +
            '(SELECT COALESCE(SUM(amount), 0) FROM prints p WHERE p.member_id = m.id AND paid = 0) AS print_balance ' +
            'FROM members m WHERE m.id = ?', [id]);
        if (!rows.length) return;
        var member = rows[0];
        detailMember = member;

        detailTitle.textContent = 'Fiche de ' + member.first_name + ' ' + member.last_name;
        var s = SUB_LABELS[member.subscription] || SUB_LABELS.none;
        var expired = isExpired(member);

        var html = '<div class="detail-head">' +
                '<div class="member-avatar">' + escapeHtml(initials(member)) + '</div>' +
                '<div><div class="member-name">' + escapeHtml(member.first_name) + ' ' + escapeHtml(member.last_name) + '</div>' +
                '<div class="member-no-detail">N° de membre : <strong>' + (member.member_no || '—') + '</strong></div>' +
                '<div class="member-badges">' + statusBadge(member) + subBadge(member) + '</div></div>' +
            '</div>' +
            '<dl class="detail-list">' +
                '<div><dt>Âge</dt><dd>' + (member.age ? escapeHtml(member.age) + ' ans' : 'Non renseigné') + '</dd></div>' +
                '<div><dt>Genre</dt><dd>' + (member.gender ? escapeHtml(GENDER_LABELS[member.gender] || member.gender) : 'Non renseigné') + '</dd></div>' +
                '<div><dt>Code postal</dt><dd>' + (member.postal_code
                    ? escapeHtml(member.postal_code) + (typeof ADW_POSTAL_CODES !== 'undefined' && ADW_POSTAL_CODES.some(function (p) { return p[0] === member.postal_code; }) ? ' — ' + escapeHtml(ADW_POSTAL_CODES.filter(function (p) { return p[0] === member.postal_code; })[0][1]) : '')
                    : 'Non renseigné') + '</dd></div>' +
                '<div><dt>Statut social</dt><dd>' + (member.social_status ? escapeHtml(STATUS_LABELS[member.social_status] || member.social_status) : 'Non renseigné') + '</dd></div>' +
                (member.email ? '<div><dt>Email</dt><dd><a href="mailto:' + escapeHtml(member.email) + '">' + escapeHtml(member.email) + '</a></dd></div>' : '') +
                (member.phone ? '<div><dt>Téléphone</dt><dd><a href="tel:' + escapeHtml(member.phone.replace(/\s/g, '')) + '">' + escapeHtml(member.phone) + '</a></dd></div>' : '') +
                (member.address ? '<div><dt>Adresse</dt><dd>' + escapeHtml(member.address) + '</dd></div>' : '') +
                '<div><dt>Inscription</dt><dd>du ' + escapeHtml(formatDate(member.start_date)) + ' au ' + escapeHtml(formatDate(member.end_date)) + '</dd></div>' +
            '</dl>'; // historique des visites volontairement absent de la modale — sur la fiche complète (membre.html)

        // Formations du membre (inscriptions)
        var memberFormations = [];
        try {
            memberFormations = ADWDatabase.getMemberFormations(id) || [];
        } catch (e) { memberFormations = []; }
        html += '<div class="detail-prints">' +
            '<div class="chart-header">' +
                '<h4>🎓 Inscriptions aux formations <span class="members-count">' + memberFormations.length + '</span></h4>' +
            '</div>';
        if (memberFormations.length) {
            html += '<ul class="visits-list">';
            memberFormations.forEach(function (f) {
                var dLabel = f.start_date ? escapeHtml(formatDate(f.start_date)) : 'date à confirmer';
                html += '<li><span>🎓 ' + escapeHtml(f.title) +
                    (f.time_label ? ' · <span class="form-hint">' + escapeHtml(f.time_label) + '</span>' : '') +
                    ' · <span class="form-hint">📅 ' + dLabel + '</span></span>' +
                    '<a href="formation.html?id=' + encodeURIComponent(f.id) + '" class="badge badge-sub-monthly" title="Voir la fiche formation">fiche →</a>' +
                    (f.url ? ' <a href="' + escapeHtml(f.url) + '" target="_blank" rel="noopener" class="badge badge-sub-monthly">site</a>' : '') +
                    '</li>';
            });
            html += '</ul>';
        } else {
            html += '<p class="form-hint">Aucune inscription à une formation. <a href="formations.html">Inscrire à une formation →</a></p>';
        }
        html += '</div>';

        var balance = member.print_balance || 0;
        html += '<div class="detail-prints">' +
            '<div class="chart-header">' +
                '<h4>🖨️ Impressions ' +
                (balance > 0
                    ? '<span class="badge badge-sub-none">' + balance.toFixed(2).replace('.', ',') + ' € dus</span>'
                    : '<span class="badge badge-ok">✓ rien à payer</span>') +
                '</h4>' +
                '<div class="print-actions-btns">' +
                    '<button type="button" class="btn btn-secondary btn-small" data-print="bw">+ 1 N&B (0,10 €)</button>' +
                    '<button type="button" class="btn btn-secondary btn-small" data-print="color">+ 1 Couleur (0,50 €)</button>' +
                    (balance > 0 ? '<button type="button" class="btn btn-primary btn-small" data-print="pay">💰 Solder ' + balance.toFixed(2).replace('.', ',') + ' €</button>' : '') +
                    (balance > 0 ? '<button type="button" class="btn btn-danger btn-small" data-print="delete" title="Supprimer le solde en cas d\'erreur">🗑️ Erreur de saisie</button>' : '') +
                '</div>' +
            '</div>';

        html += '</div>';

        detailBody.innerHTML = html;
        var detailFullBtn = document.getElementById('detailFullBtn');
        if (detailFullBtn) detailFullBtn.href = 'membre.html?id=' + encodeURIComponent(member.id);
        detailModal.hidden = false;
    }

    function closeDetail() {
        detailModal.hidden = true;
        detailMember = null;
    }

    if (detailCloseBtn) detailCloseBtn.addEventListener('click', closeDetail);
    detailModal.addEventListener('click', function (e) {
        if (e.target === detailModal) closeDetail();
    });

    detailBody.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-print]');
        if (!btn || !detailMember) return;
        var action = btn.getAttribute('data-print');
        var today = new Date().toISOString().slice(0, 10);
        if (action === 'bw' || action === 'color') {
            var amount = action === 'bw' ? 0.10 : 0.50;
            var printId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
            ADWDatabase.run('INSERT INTO prints (id, member_id, print_date, type, amount, paid) VALUES (?, ?, ?, ?, ?, 0)',
                [printId, detailMember.id, today, action, amount]).then(function () {
                showToast('🖨️ Impression ' + (action === 'bw' ? 'N&B' : 'couleur') + ' ajoutée (' + amount.toFixed(2).replace('.', ',') + ' €)', 'success');
                render();
                openDetail(detailMember.id);
            });
        } else if (action === 'pay') {
            ADWDatabase.run('UPDATE prints SET paid = 1, paid_date = date(\'now\') WHERE member_id = ? AND paid = 0',
                [detailMember.id]).then(function () {
                showToast('💰 Impressions soldées', 'success');
                render();
                openDetail(detailMember.id);
            });
        } else if (action === 'delete') {
            if (confirm('Supprimer le solde d\'impressions de ' + detailMember.first_name + ' ? (en cas d\'erreur de saisie)')) {
                ADWDatabase.run('DELETE FROM prints WHERE member_id = ? AND paid = 0',
                    [detailMember.id]).then(function () {
                    showToast('🗑️ Solde d\'impressions supprimé', 'success');
                    render();
                    openDetail(detailMember.id);
                });
            }
        }
    });

    // Renouveler depuis la modale fiche : prolonge selon la formule + toast + rafraîchit la fiche
    // Renouveler : double validation avec affichage des nouvelles dates (décision utilisateur).
    // 1er clic → calcul + aperçu des dates ; 2e clic (dans la foulée) → application effective.
    var detailRenewBtn = document.getElementById('detailRenewBtn');
    var renewArmed = null; // { newStart, newEnd, until } en attente de confirmation
    var RENEW_ARMED_MS = 6000; // la confirmation doit se faire dans les 6 s, sinon désarmée

    if (detailRenewBtn) {
        var renewArmTimer = null;
        detailRenewBtn.addEventListener('click', function () {
            if (!detailMember) return;
            if (renewArmed) {
                // 2e clic = confirmation
                clearTimeout(renewArmTimer);
                var r = renewArmed;
                renewArmed = null;
                detailRenewBtn.textContent = '♻️ Renouveler l’abo';
                detailRenewBtn.classList.remove('btn-danger');
                var res = ADWDatabase.renewSubscription(detailMember.id, r.newStart, r.newEnd);
                if (!res) return;
                if (window.ADWNotifications) window.ADWNotifications.push('renew', '♻️ Abonnement renouvelé : du ' + res.newStart + ' au ' + res.newEnd + ' (membre ' + detailMember.member_no + ')', 'success');
                showToast('♻️ Renouvelé — inscription du ' + res.newStart + ' au ' + res.newEnd);
                render();
                openDetail(detailMember.id);
                return;
            }
            // 1er clic : calculer et afficher l'aperçu (rien n'est écrit en base)
            var r = ADWDatabase.previewRenewal(detailMember.id);
            if (!r) return;
            renewArmed = r;
            detailRenewBtn.textContent = '✅ Confirmer : du ' + fmtDMY(r.newStart) + ' au ' + fmtDMY(r.newEnd) + ' ?';
            detailRenewBtn.classList.add('btn-danger');
            renewArmTimer = setTimeout(function () {
                renewArmed = null;
                detailRenewBtn.textContent = '♻️ Renouveler l’abo';
                detailRenewBtn.classList.remove('btn-danger');
            }, RENEW_ARMED_MS);
        });
    }

    var detailEditBtn = document.getElementById('detailEditBtn');
    if (detailEditBtn) detailEditBtn.addEventListener('click', function () {
        if (!detailMember) return;
        openModal(detailMember); // AVANT closeDetail — sinon detailMember est remis à null → « Ajouter un membre »
        closeDetail();
    });

    detailCheckinBtn.addEventListener('click', function () {
        if (!detailMember) return;
        var today = new Date().toISOString().slice(0, 10);
        var already = ADWDatabase.queryAll(
            'SELECT id FROM visits WHERE member_id = ? AND visit_date = ?', [detailMember.id, today]);
        if (already.length) {
            showToast('⚠️ Visite déjà pointée aujourd\'hui pour ce membre', 'error');
            return;
        }
        var amount = detailMember.subscription === 'none' ? VISIT_PRICE : 0;
        var visitId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        ADWDatabase.run('INSERT INTO visits (id, member_id, visit_date, amount) VALUES (?, ?, ?, ?)',
            [visitId, detailMember.id, today, amount]).then(function () {
            showToast(amount ? 'Visite enregistrée (' + amount + ' €)' : 'Visite enregistrée (incluse abonnement)', 'success');
            render();
            openDetail(detailMember.id);
        });
    });

    /* ---------- Toast ---------- */

    function showToast(message, type) {
        var toast = document.createElement('div');
        toast.className = 'toast toast-' + (type || 'success');
        toast.setAttribute('role', 'status');
        toast.textContent = message;
        document.body.appendChild(toast);
        requestAnimationFrame(function () { toast.classList.add('visible'); });
        setTimeout(function () {
            toast.classList.remove('visible');
            setTimeout(function () { toast.remove(); }, 300);
        }, 2500);
    }

    /* ---------- Formulaire ---------- */

    function openModal(member) {
        form.reset();
        formError.hidden = true;
        document.getElementById('memberId').value = member ? member.id : '';
        document.getElementById('firstName').value = member ? member.first_name : '';
        document.getElementById('lastName').value = member ? member.last_name : '';
        document.getElementById('age').value = member ? (member.age || '') : '';
        document.getElementById('phone').value = member ? (member.phone || '') : '';
        document.getElementById('email').value = member ? (member.email || '') : '';
        document.getElementById('address').value = member ? (member.address || '') : '';
        var sub = member ? (member.subscription || 'none') : 'none';
        var radio = form.querySelector('input[name="subscription"][value="' + sub + '"]');
        if (radio) radio.checked = true;
        document.getElementById('postalCode').value = member && member.postal_code ? member.postal_code : '';
        document.getElementById('gender').value = member && member.gender ? member.gender : '';
        document.getElementById('socialStatus').value = member && member.social_status ? member.social_status : '';
        document.getElementById('startDate').value = member ? (member.start_date || '') : new Date().toISOString().slice(0, 10);
        document.getElementById('endDate').value = member ? (member.end_date || '') : '';
        // « Aucun abo » : date de fin neutre (vide) — pas d'inscription dans le temps
        var noneRadio = form.querySelector('input[name="subscription"][value="none"]');
        if (noneRadio && noneRadio.checked) document.getElementById('endDate').value = '';
        modalTitle.textContent = member ? 'Modifier le membre' : 'Ajouter un membre';
        // Live : le changement de formule d'abonnement ajuste la date de fin
        // — « aucun » la vide (neutre), mensuel/annuel la propose à 1 mois/1 an si vide
        Array.prototype.forEach.call(form.querySelectorAll('input[name="subscription"]'), function (radio) {
            radio.addEventListener('change', function () {
                var endDateInput = document.getElementById('endDate');
                if (radio.value === 'none' && radio.checked) {
                    endDateInput.value = '';
                } else if (radio.checked && !endDateInput.value) {
                    var months = radio.value === 'yearly' ? 12 : 1;
                    var d = new Date();
                    d.setMonth(d.getMonth() + months);
                    endDateInput.value = d.toISOString().slice(0, 10);
                }
            });
        });
        modal.hidden = false;
        document.getElementById('firstName').focus();
    }

    function closeModal() {
        modal.hidden = true;
    }

    function validateDates() {
        var start = startDateInput.value;
        var end = endDateInput.value;
        if (start && end && end < start) {
            formError.textContent = '⚠️ La date de fin doit être postérieure à la date de début.';
            formError.hidden = false;
            return false;
        }
        formError.hidden = true;
        return true;
    }

    startDateInput.addEventListener('change', function () {
        applySubscriptionDates();
        validateDates();
    });

    endDateInput.addEventListener('change', validateDates);

    function applySubscriptionDates() {
        var checked = form.querySelector('input[name="subscription"]:checked');
        var sub = checked ? checked.value : 'none';
        var base = startDateInput.value
            ? new Date(startDateInput.value)
            : new Date();
        var end;
        if (sub === 'monthly') {
            end = new Date(base);
            end.setMonth(end.getMonth() + 1);
            end.setDate(end.getDate() - 1);
        } else if (sub === 'yearly') {
            end = new Date(base);
            end.setFullYear(end.getFullYear() + 1);
            end.setDate(end.getDate() - 1);
        } else {
            return;
        }
        endDateInput.value = end.toISOString().slice(0, 10);
    }

    form.querySelectorAll('input[name="subscription"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
            if (document.getElementById('memberId').value) {
                applySubscriptionDates();
            } else if (radio.checked && radio.value !== 'none' && startDateInput.value) {
                applySubscriptionDates();
            }
        });
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!validateDates()) return;
        var id = document.getElementById('memberId').value;
        var subRadio = form.querySelector('input[name="subscription"]:checked');
        var data = {
            firstName: document.getElementById('firstName').value.trim(),
            lastName: document.getElementById('lastName').value.trim(),
            age: document.getElementById('age').value,
            phone: document.getElementById('phone').value.trim(),
            email: document.getElementById('email').value.trim(),
            address: document.getElementById('address').value.trim(),
            startDate: startDateInput.value,
            endDate: endDateInput.value,
            subscription: subRadio ? subRadio.value : 'none',
            postalCode: normalizePostalCode(document.getElementById('postalCode').value),
            gender: document.getElementById('gender').value,
            socialStatus: document.getElementById('socialStatus').value
        };

        var promise;
        if (id) {
            promise = ADWDatabase.run(
                'UPDATE members SET first_name = ?, last_name = ?, age = ?, phone = ?, email = ?, address = ?, start_date = ?, end_date = ?, subscription = ?, postal_code = ?, gender = ?, social_status = ? WHERE id = ?',
                [data.firstName, data.lastName, data.age ? Number(data.age) : null,
                 data.phone, data.email, data.address, data.startDate || null, data.endDate || null,
                 data.subscription, data.postalCode || null, data.gender || null, data.socialStatus || null, id]
            );
        } else {
            var newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
            var memberNo = ADWDatabase.nextMemberNo();
            if (memberNo === null) {
                formError.textContent = '⚠️ Plus de numéros de membre disponibles (maximum 9999).';
                formError.hidden = false;
                return;
            }
            promise = ADWDatabase.run(
                'INSERT INTO members (id, member_no, first_name, last_name, age, phone, email, address, start_date, end_date, subscription, postal_code, gender, social_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [newId, memberNo, data.firstName, data.lastName, data.age ? Number(data.age) : null,
                 data.phone, data.email, data.address, data.startDate || null, data.endDate || null,
                 data.subscription, data.postalCode || null, data.gender || null, data.socialStatus || null]
            );
        }
        promise.then(function () {
            closeModal();
            render();
            showToast(id ? 'Membre modifié' : 'Membre ajouté', 'success');
        });
    });

    /* ---------- Vue / filtres / tri ---------- */

    function setView(view) {
        currentView = view;
        syncViewButtons();
        savePrefs();
        render();
    }

    function exportCSV() {
        var members = getMembers();
        if (!members.length) return;
        var headers = ['N°', 'Prénom', 'Nom', 'Âge', 'Genre', 'Code postal', 'Statut social', 'Téléphone', 'Email', 'Adresse', 'Abonnement', 'Visites', 'Début inscription', 'Fin inscription'];
        var csvRows = [headers.join(';')];
        members.forEach(function (m) {
            csvRows.push([
                m.member_no || '', m.first_name, m.last_name, m.age || '',
                GENDER_LABELS[m.gender] || '', m.postal_code || '', STATUS_LABELS[m.social_status] || '',
                m.phone || '',
                m.email || '', m.address || '',
                (SUB_LABELS[m.subscription] || SUB_LABELS.none).label,
                m.visit_count, m.start_date || '', m.end_date || ''
            ].map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';'));
        });
        var blob = new Blob(['\ufeff' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'membres-atelierduweb.csv';
        a.click();
        URL.revokeObjectURL(a.href);
    }

    addBtn.addEventListener('click', function () { openModal(null); });
    var emptyAddBtn = document.getElementById('emptyAddBtn');
    if (emptyAddBtn) emptyAddBtn.addEventListener('click', function () { openModal(null); });
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) {
        if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            if (!modal.hidden) closeModal();
            if (!detailModal.hidden) closeDetail();
        }
    });
    searchInput.addEventListener('input', function () { savePrefs(); render(); });
    sortSelect.addEventListener('change', function () { savePrefs(); render(); });
    viewGridBtn.addEventListener('click', function () { setView('grid'); });
    viewListBtn.addEventListener('click', function () { setView('list'); });
    if (exportBtn) exportBtn.addEventListener('click', exportCSV);

    // Barre de filtres repliable en mobile
    var filtersToggle = document.getElementById('filtersToggle');
    var filtersMore = document.getElementById('filtersMore');
    if (filtersToggle && filtersMore) {
        var MOBILE = window.matchMedia('(max-width: 860px)');
        var syncFiltersToggle = function () {
            filtersToggle.hidden = !MOBILE.matches;
            if (!MOBILE.matches) filtersMore.hidden = false;
        };
        filtersToggle.addEventListener('click', function () {
            var open = filtersToggle.getAttribute('aria-expanded') === 'true';
            filtersToggle.setAttribute('aria-expanded', String(!open));
            filtersToggle.textContent = open ? '\uD83D\uDD3D Filtres & tri' : '\uD83D\uDD3C Filtres & tri';
            filtersMore.hidden = open;
        });
        if (MOBILE.addEventListener) {
            MOBILE.addEventListener('change', syncFiltersToggle);
        } else if (MOBILE.addListener) {
            MOBILE.addListener(syncFiltersToggle);
        }
        syncFiltersToggle();
    }

    document.querySelectorAll('.filters-bar [data-filter]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            currentFilter = btn.getAttribute('data-filter');
            syncFilterButtons();
            savePrefs();
            render();
        });
    });

    loadPrefs();

    try {
        var urlFilter = new URLSearchParams(window.location.search).get('prints');
        if (urlFilter === 'due') {
            currentFilter = 'prints-due';
            syncFilterButtons();
            savePrefs();
        }
    } catch (e) { /* best effort */ }

    /* ---------- Import XML (Access) ---------- */

    var importModal = document.getElementById('importModal');
    var importBtn = document.getElementById('importBtn');
    var importCloseBtn = document.getElementById('importCloseBtn');
    var importCancelBtn = document.getElementById('importCancelBtn');
    var importConfirmBtn = document.getElementById('importConfirmBtn');
    var importFile = document.getElementById('importFile');
    var importPreview = document.getElementById('importPreview');
    var pendingImport = null;

    function closeImport() {
        if (importModal) importModal.hidden = true;
        if (importPreview) importPreview.hidden = true;
        if (importFile) importFile.value = '';
        pendingImport = null;
    }

    function openImport() {
        if (!importModal) return;
        ADWAuth.ensureUnlocked('Importer des membres (XML) — action réservée à l\u2019équipe.').then(function (ok) {
            if (!ok) return;
            doOpenImport();
        });
    }

    function doOpenImport() {
        importModal.hidden = false;
        if (importPreview) importPreview.hidden = true;
        if (importFile) importFile.value = '';
        pendingImport = null;
    }

    function handleImportFile(file) {
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
            try {
                var result = ADWImport.parseXml(reader.result);
                pendingImport = result.members;
                var w = result.warnings;
                var warnTxt = [];
                if (w.noStatus) warnTxt.push(w.noStatus + ' statut(s) non mappé(s) laissé(s) vide(s)');
                if (w.badEmail) warnTxt.push(w.badEmail + ' email(s) illisible(s) ignoré(s)');
                if (w.badDate) warnTxt.push(w.badDate + ' date(s) de fin invalide(s)');
                var el = document.getElementById('impCount');
                if (el) el.textContent = result.members.length + ' membres';
                var we = document.getElementById('impWarn');
                if (we) we.textContent = warnTxt.length ? warnTxt.join(' · ') : 'Aucun problème détecté.';
                if (importPreview) importPreview.hidden = false;
            } catch (e) {
                alert('Erreur de lecture du XML : ' + e.message);
            }
        };
        reader.readAsText(file);
    }

    function confirmImport() {
        if (!pendingImport || !pendingImport.length) return;
        var existing = {};
        ADWDatabase.queryAll('SELECT member_no FROM members WHERE member_no IS NOT NULL').forEach(function (r) {
            existing[r.member_no] = true;
        });
        var toInsert = pendingImport.filter(function (m) { return !existing[m.member_no]; });
        var skipped = pendingImport.length - toInsert.length;

        var db = ADWDatabase.db;
        db.run('BEGIN TRANSACTION');
        var stmt = db.prepare(
            'INSERT INTO members (id, member_no, first_name, last_name, age, phone, email, address, postal_code, gender, social_status, start_date, end_date, subscription) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        toInsert.forEach(function (m) {
            stmt.run([
                'imp' + m.member_no, m.member_no, m.first_name, m.last_name,
                m.age, m.phone || null, m.email || null, m.address || null,
                m.postal_code, m.gender, m.social_status,
                m.start_date, m.end_date, m.subscription
            ]);
        });
        stmt.free();
        db.run('COMMIT');

        ADWDatabase.persist().then(function () {
            closeImport();
            render();
            showToast('📥 ' + toInsert.length + ' membres importés' + (skipped ? ' (' + skipped + ' doublons ignorés)' : ''), 'success');
        });
    }

    if (importBtn) importBtn.addEventListener('click', openImport);
    if (importCloseBtn) importCloseBtn.addEventListener('click', closeImport);
    if (importCancelBtn) importCancelBtn.addEventListener('click', closeImport);
    if (importConfirmBtn) importConfirmBtn.addEventListener('click', confirmImport);
    if (importFile) importFile.addEventListener('change', function () {
        handleImportFile(importFile.files && importFile.files[0]);
    });
    if (importModal) importModal.addEventListener('click', function (e) {
        if (e.target === importModal) closeImport();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && importModal && !importModal.hidden) closeImport();
    });

    var demoBtn = document.getElementById('demoBtn');
    if (demoBtn) {
        demoBtn.addEventListener('click', function () {
            if (!window.ADWDemo) return;
            if (!confirm('Charger 20 membres fictifs de démonstration ?')) return;
            ADWDemo.loadDemo(ADWDatabase).then(function (count) {
                render();
                showToast('🧪 ' + count + ' membres de démo chargés', 'success');
            });
        });
    }

    ADWDatabase.init().then(function () {
        loading.hidden = true;
        render();
        // Lien direct vers une fiche : membres.html#member=<id>
        var m = location.hash.match(/^#member=(.+)$/);
        if (m) {
            openDetail(decodeURIComponent(m[1]));
            // Nettoie le hash pour ne pas rouvrir la fiche au rechargement
            history.replaceState(null, '', location.pathname + location.search);
        }
    }).catch(function (err) {
        loading.hidden = true;
        emptyState.hidden = false;
        emptyState.querySelector('p').textContent = 'Erreur de chargement de la base de données : ' + err.message;
    });
})();
