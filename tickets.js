(function () {
    'use strict';

    // Page Tickets (tickets.html) : incidents du cyberespace (matériel/réseau).
    // Liste groupée par statut avec badges de priorité, filtres, création en modale.
    // Étape 1 : liste + CRUD — la fiche détaillée (ticket.html) arrive à l'étape 2.
    // Dépend de : db.js, escape.js, auth.js (suppression), layout.js.

    var list = document.getElementById('ticketsList');
    if (!list) return;

    var loading = document.getElementById('loadingState');
    var empty = document.getElementById('emptyState');
    var countEl = document.getElementById('ticketsCount');
    var searchInput = document.getElementById('searchInput');
    var prioSelect = document.getElementById('prioSelect');
    var catSelect = document.getElementById('catSelect');
    var assigneeSelect = document.getElementById('assigneeSelect');

    var tickets = [];
    var statusFilter = 'all';

    function esc(s) { return window.ADWEscape.html(s); }

    var PRIO = {
        urgent: { label: '🔴 Urgente', badge: 'ticket-prio-urgent' },
        high: { label: '🟠 Haute', badge: 'ticket-prio-high' },
        normal: { label: '🟡 Normale', badge: 'ticket-prio-normal' },
        low: { label: '🟢 Basse', badge: 'badge-ok' }
    };
    var CAT = {
        computer: '💻 Ordinateur', printer: '🖨️ Imprimante', network: '🌐 Réseau',
        software: '💿 Logiciel', furniture: '🪑 Mobilier', other: '❓ Autre'
    };
    var STATUS = {
        open: { label: 'Nouveau', badge: 'ticket-status-open' },
        in_progress: { label: 'En cours', badge: 'ticket-status-progress' },
        resolved: { label: 'Résolu', badge: 'ticket-status-resolved' },
        closed: { label: 'Fermé', badge: 'ticket-status-closed' }
    };

    function formatDate(iso) {
        if (!iso) return '';
        try {
            return new Date(iso.replace(' ', 'T') + 'Z').toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' });
        } catch (e) { return iso; }
    }

    function applyFilters() {
        var q = (searchInput.value || '').trim().toLowerCase();
        var prio = prioSelect.value;
        var cat = catSelect.value;
        var ass = assigneeSelect.value;
        var visible = tickets.filter(function (t) {
            if (statusFilter !== 'all' && t.status !== statusFilter) return false;
            if (prio && t.priority !== prio) return false;
            if (cat && t.category !== cat) return false;
            if (ass && (t.assignee || '') !== ass) return false;
            if (q) {
                var hay = (t.title + ' ' + (t.description || '') + ' ' + (t.equipment || '') + ' ' + (t.assignee || '')).toLowerCase();
                if (hay.indexOf(q) === -1) return false;
            }
            return true;
        });

        countEl.textContent = visible.length + ' ticket' + (visible.length > 1 ? 's' : '');
        list.innerHTML = '';
        empty.hidden = visible.length > 0;
        loading.hidden = true;

        visible.forEach(function (t) {
            var p = PRIO[t.priority] || PRIO.normal;
            var st = STATUS[t.status] || STATUS.open;
            var card = document.createElement('div');
            card.className = 'stat-card';
            card.style.cursor = 'pointer';
            card.title = 'Ouvrir la fiche du ticket';
            card.addEventListener('click', function (e) {
                if (e.target.closest('select, button')) return;
                location.href = 'ticket.html?id=' + encodeURIComponent(t.id);
            });
            card.style.cssText = 'padding:0.9rem 1.1rem;display:flex;align-items:center;gap:0.9rem;flex-wrap:wrap;';
            card.innerHTML =
                '<div style="flex:1;min-width:200px;">' +
                    '<div style="font-weight:700;">' + esc(t.title) + '</div>' +
                    '<div class="form-hint" style="margin-top:0.2rem;">' +
                        (t.equipment ? '📍 ' + esc(t.equipment) + ' · ' : '') +
                        CAT[t.category || 'other'] +
                        (t.assignee ? ' · 👤 ' + esc(t.assignee) : '') +
                        ' · ' + formatDate(t.created_at) +
                    '</div>' +
                '</div>' +
                '<span class="badge ' + p.badge + '">' + p.label + '</span>' +
                '<span class="badge ' + st.badge + '">' + st.label + '</span>' +
                '<select data-act="status" data-id="' + esc(t.id) + '" title="Changer le statut" aria-label="Statut du ticket" style="padding:0.4rem 0.6rem;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);font-size:0.85rem;">' +
                    Object.keys(STATUS).map(function (s) {
                        return '<option value="' + s + '"' + (s === t.status ? ' selected' : '') + '>' + STATUS[s].label + '</option>';
                    }).join('') +
                '</select>' +
                '<button type="button" class="btn btn-danger btn-small" data-act="delete" data-id="' + esc(t.id) + '" title="Supprimer le ticket (admin)">🗑️</button>';
            list.appendChild(card);
        });
    }

    function refresh() {
        tickets = window.ADWDatabase.listTickets();
        // Peupler le filtre assigné-à avec les valeurs existantes
        var names = {};
        tickets.forEach(function (t) { if (t.assignee) names[t.assignee] = true; });
        var cur = assigneeSelect.value;
        assigneeSelect.innerHTML = '<option value="">Tout le monde</option>' +
            Object.keys(names).sort().map(function (n) {
                return '<option value="' + esc(n) + '">' + esc(n) + '</option>';
            }).join('');
        assigneeSelect.value = names[cur] ? cur : '';
        applyFilters();
    }

    // ============ Interactions ============

    list.addEventListener('change', function (e) {
        var sel = e.target.closest('select[data-act="status"]');
        if (!sel) return;
        window.ADWDatabase.updateTicket(sel.getAttribute('data-id'), { status: sel.value });
        refresh();
    });

    list.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-act="delete"]');
        if (!btn) return;
        var t = window.ADWDatabase.getTicket(btn.getAttribute('data-id'));
        if (!t) return;
        // Suppression : garde admin (décision utilisateur) + confirmation
        window.ADWAuth.ensureUnlocked('Supprimer un ticket — action réservée à l\u2019équipe.').then(function (ok) {
            if (!ok) return;
            if (confirm('Supprimer le ticket « ' + t.title + ' » ?\n\nCette action est définitive.')) {
                window.ADWDatabase.deleteTicket(t.id);
                refresh();
            }
        });
    });

    document.querySelectorAll('[data-status]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            document.querySelectorAll('[data-status]').forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            statusFilter = btn.getAttribute('data-status');
            applyFilters();
        });
    });
    prioSelect.addEventListener('change', applyFilters);
    catSelect.addEventListener('change', applyFilters);
    assigneeSelect.addEventListener('change', applyFilters);
    if (searchInput) searchInput.addEventListener('input', applyFilters);

    // ============ Modale de création ============

    var modal = document.getElementById('ticketModal');
    var openBtn = document.getElementById('newTicketBtn');

    function openModal() {
        ['tkTitle', 'tkEquipment', 'tkAssignee', 'tkDescription'].forEach(function (id) {
            document.getElementById(id).value = '';
        });
        document.getElementById('tkCategory').value = 'computer';
        document.getElementById('tkPriority').value = 'normal';
        modal.hidden = false;
        document.getElementById('tkTitle').focus();
    }

    function closeModal() { modal.hidden = true; }

    if (openBtn) openBtn.addEventListener('click', openModal);
    document.getElementById('tkCancel').addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

    document.getElementById('tkSave').addEventListener('click', function () {
        var title = (document.getElementById('tkTitle').value || '').trim();
        if (!title) { document.getElementById('tkTitle').focus(); return; }
        window.ADWDatabase.addTicket({
            title: title,
            description: document.getElementById('tkDescription').value.trim() || null,
            category: document.getElementById('tkCategory').value,
            equipment: document.getElementById('tkEquipment').value.trim() || null,
            priority: document.getElementById('tkPriority').value,
            assignee: document.getElementById('tkAssignee').value.trim() || null,
            created_by: null
        });
        if (window.ADWNotifications) {
            window.ADWNotifications.push('ticket_created', '🎫 Nouveau ticket : « ' + title + ' »', 'info');
        }
        closeModal();
        refresh();
    });

    // ============ Init ============

    window.ADWDatabase.init().then(function () {
        // Rappel : tickets urgents de plus de 48h sans résolution (règle projet : toute alerte est notifiée)
        if (window.ADWNotifications) {
            var urgentOld = window.ADWDatabase.queryAll(
                'SELECT title FROM tickets WHERE priority = \'urgent\' AND status IN (\'open\', \'in_progress\') AND created_at < datetime(\'now\', \'-2 days\')'
            );
            urgentOld.forEach(function (t) {
                window.ADWNotifications.push('ticket_urgent',
                    '🚨 Ticket urgent sans résolution depuis plus de 48h : « ' + t.title + ' »', 'warning');
            });
        }
        refresh();
    }).catch(function () {
        loading.hidden = true;
        empty.hidden = false;
        empty.querySelector('p').textContent = 'Impossible de charger la base de données locale.';
    });
})();
