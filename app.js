(function () {
    'use strict';

    var PREFS_KEY = 'atelierduweb_members_prefs';
    var VISIT_PRICE = 1;

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
        active: 'date(m.end_date) >= date(\'now\') OR m.end_date IS NULL',
        expired: 'date(m.end_date) < date(\'now\') AND m.end_date IS NOT NULL',
        subscribed: 'm.subscription != \'none\'',
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

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str == null ? '' : String(str);
        return div.innerHTML;
    }

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
                (member.age ? '<span>🎂 ' + escapeHtml(member.age) + ' ans</span>' : '') +
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

    function render() {
        var members = getMembers();
        grid.className = currentView === 'list' ? 'members-list' : 'members-grid';
        grid.innerHTML = '';
        emptyState.hidden = members.length > 0;
        membersCount.textContent = members.length + ' membre' + (members.length > 1 ? 's' : '');

        members.forEach(function (member) {
            var expired = isExpired(member);
            var item = document.createElement('div');
            item.className = (currentView === 'list' ? 'member-row' : 'member-card') + (expired ? ' expired' : '');
            item.innerHTML = currentView === 'list' ? rowHTML(member) : cardHTML(member);

            item.addEventListener('click', function (e) {
                if (e.target.closest('button')) return;
                openDetail(member.id);
            });

            var actions = document.createElement('div');
            actions.className = currentView === 'list' ? 'list-actions' : 'card-actions';
            actions.innerHTML =
                '<button class="btn btn-secondary btn-small">✏️ Modifier</button>' +
                '<button class="btn btn-danger btn-small">🗑️ Supprimer</button>';

            actions.children[0].addEventListener('click', function (e) {
                e.stopPropagation();
                openModal(member);
            });
            actions.children[1].addEventListener('click', function (e) {
                e.stopPropagation();
                if (confirm('Supprimer le membre "' + member.first_name + ' ' + member.last_name + '" ?')) {
                    ADWDatabase.run('DELETE FROM members WHERE id = ?', [member.id]).then(function () {
                        render();
                        showToast('Membre supprimé', 'success');
                    });
                }
            });
            item.appendChild(actions);
            grid.appendChild(item);
        });
    }

    /* ---------- Fiche détail ---------- */

    function openDetail(id) {
        var rows = ADWDatabase.queryAll(
            'SELECT m.*, ' +
            '(SELECT COUNT(*) FROM visits v WHERE v.member_id = m.id) AS visit_count, ' +
            '(SELECT COALESCE(SUM(amount), 0) FROM prints p WHERE p.member_id = m.id AND paid = 0) AS print_balance ' +
            'FROM members m WHERE m.id = ?', [id]);
        if (!rows.length) return;
        var member = rows[0];
        var visits = ADWDatabase.queryAll(
            'SELECT * FROM visits WHERE member_id = ? ORDER BY visit_date DESC, created_at DESC LIMIT 30', [id]);
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
                (member.age ? '<div><dt>Âge</dt><dd>' + escapeHtml(member.age) + ' ans</dd></div>' : '') +
                (member.email ? '<div><dt>Email</dt><dd><a href="mailto:' + escapeHtml(member.email) + '">' + escapeHtml(member.email) + '</a></dd></div>' : '') +
                (member.phone ? '<div><dt>Téléphone</dt><dd><a href="tel:' + escapeHtml(member.phone.replace(/\s/g, '')) + '">' + escapeHtml(member.phone) + '</a></dd></div>' : '') +
                (member.address ? '<div><dt>Adresse</dt><dd>' + escapeHtml(member.address) + '</dd></div>' : '') +
                '<div><dt>Inscription</dt><dd>du ' + escapeHtml(formatDate(member.start_date)) + ' au ' + escapeHtml(formatDate(member.end_date)) + '</dd></div>' +
            '</dl>' +
            '<div class="detail-visits">' +
                '<h4>Historique des visites <span class="members-count">' + member.visit_count + ' au total</span></h4>';

        if (visits.length) {
            html += '<ul class="visits-list">';
            visits.forEach(function (v) {
                html += '<li><span>📅 ' + escapeHtml(formatDate(v.visit_date)) + '</span>' +
                    (member.subscription === 'none'
                        ? '<span class="badge badge-sub-none">' + v.amount.toFixed(2).replace('.', ',') + ' € payé</span>'
                        : '<span class="badge badge-ok">incluse (abonnement)</span>') + '</li>';
            });
            html += '</ul>';
        } else {
            html += '<p class="form-hint">Aucune visite enregistrée pour le moment.</p>';
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
        detailModal.hidden = false;
        detailCloseBtn.focus();
    }

    function closeDetail() {
        detailModal.hidden = true;
        detailMember = null;
    }

    detailCloseBtn.addEventListener('click', closeDetail);
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
        document.getElementById('startDate').value = member ? (member.start_date || '') : new Date().toISOString().slice(0, 10);
        document.getElementById('endDate').value = member ? (member.end_date || '') : '';
        modalTitle.textContent = member ? 'Modifier le membre' : 'Ajouter un membre';
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
            subscription: subRadio ? subRadio.value : 'none'
        };

        var promise;
        if (id) {
            promise = ADWDatabase.run(
                'UPDATE members SET first_name = ?, last_name = ?, age = ?, phone = ?, email = ?, address = ?, start_date = ?, end_date = ?, subscription = ? WHERE id = ?',
                [data.firstName, data.lastName, data.age ? Number(data.age) : null,
                 data.phone, data.email, data.address, data.startDate || null, data.endDate || null,
                 data.subscription, id]
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
                'INSERT INTO members (id, member_no, first_name, last_name, age, phone, email, address, start_date, end_date, subscription) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [newId, memberNo, data.firstName, data.lastName, data.age ? Number(data.age) : null,
                 data.phone, data.email, data.address, data.startDate || null, data.endDate || null,
                 data.subscription]
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
        var headers = ['N°', 'Prénom', 'Nom', 'Âge', 'Téléphone', 'Email', 'Adresse', 'Abonnement', 'Visites', 'Début inscription', 'Fin inscription'];
        var csvRows = [headers.join(';')];
        members.forEach(function (m) {
            csvRows.push([
                m.member_no || '', m.first_name, m.last_name, m.age || '', m.phone || '',
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

    ADWDatabase.init().then(function () {
        loading.hidden = true;
        render();
    }).catch(function (err) {
        loading.hidden = true;
        emptyState.hidden = false;
        emptyState.querySelector('p').textContent = 'Erreur de chargement de la base de données : ' + err.message;
    });
})();
