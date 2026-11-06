(function () {
    'use strict';

    // Page Notifications (notifications.html) — remplace la modale débordante :
    // liste pleine page, filtres par catégorie, marquage individuel, actions ciblées.
    // Dépend de : db.js, escape.js, notifications.js (cloche + badge).

    var loading = document.getElementById('loadingState');
    var listEl = document.getElementById('notifPageList');
    var emptyEl = document.getElementById('emptyState');
    var totalEl = document.getElementById('notifTotal');

    function esc(s) { return window.ADWEscape.html(s); }

    // Catégories : chaque type de notification appartient à une famille
    // ⚠️ Alertes : à traiter (urgent, erreurs)
    // ⏳ Rappels : à faire (salles, tickets urgents, listes d'attente)
    // ℹ️ Activité : journal des actions (synchros, rattachements, infos)
    // Une SEULE table de catégorisation : type d'abord, sévérité en fallback.
    // Types connus -> famille ; types futurs inconnus -> déduit de la sévérité.
    var TYPE_CATEGORY = {
        ticket_urgent: 'alerts',
        error: 'alerts',
        room_needed: 'alerts',
        waitlist_match: 'waitlist',
        awaiting_validation: 'alerts',
        sync_formations: 'sync',
        auto_link: 'sync',
        auto_unlink: 'sync',
        member_created: 'activity',
        checkin: 'activity',
        renew: 'activity',
        print: 'activity',
        info: 'activity'
    };
    var SEVERITY_CATEGORY = {
        danger: 'alerts',
        warning: 'alerts',     // fusionne dans Alertes (decision EPN : danger et warning = agir)
        success: 'activity',   // un succès générique = journal, pas un rappel
        info: 'activity'
    };
    function categoryOf(n) {
        return TYPE_CATEGORY[n.type] || SEVERITY_CATEGORY[n.severity] || 'activity';
    }

    function timeAgo(iso) {
        if (!iso) return '';
        try {
            var d = new Date(String(iso).replace(' ', 'T') + (String(iso).indexOf('Z') === -1 ? 'Z' : ''));
            var mins = Math.round((Date.now() - d.getTime()) / 60000);
            if (isNaN(mins)) return String(iso).slice(0, 16).replace('T', ' ');
            if (mins < 1) return "à l'instant";
            if (mins < 60) return 'il y a ' + mins + ' min';
            var h = Math.round(mins / 60);
            if (h < 24) return 'il y a ' + h + ' h';
            var days = Math.round(h / 24);
            if (days < 30) return 'il y a ' + days + ' j';
            return d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch (e) { return String(iso).slice(0, 16).replace('T', ' '); }
    }

    // Action d'une notification : où elle mène (details JSON de la notif)
    function actionOf(n) {
        try {
            var d = n.details ? JSON.parse(n.details) : null;
            if (d && d.event_id) return { label: 'Ouvrir la formation', href: 'formation.html?id=' + encodeURIComponent(d.event_id) };
            if (d && d.ticket_id) return { label: 'Ouvrir le ticket', href: 'ticket.html?id=' + encodeURIComponent(d.ticket_id) };
            if (d && d.member_id) return { label: 'Ouvrir le membre', href: 'membre.html?id=' + encodeURIComponent(d.member_id) };
            if (n.type === 'room_needed') return { label: 'Planning des salles', href: 'salles.html' };
            if (n.type === 'awaiting_validation') return { label: 'Planning des salles', href: 'salles.html' };
            if (n.type === 'ticket_urgent') return { label: 'Incidents', href: 'tickets.html' };
            if (n.type === 'waitlist_match') return { label: 'Voir les formations', href: 'formations.html' };
            if (n.type === 'sync_formations') return { label: 'Voir les formations', href: 'formations.html' };
            if (n.type === 'auto_link' || n.type === 'auto_unlink') return { label: 'Voir les inscrits', href: 'formations.html' };
            if (n.type === 'checkin' || n.type === 'renew' || n.type === 'print' || n.type === 'member_created') return { label: 'Ouvrir Membres', href: 'membres.html' };
        } catch (e) {}
        return null;
    }

    // Contacts groupés d'une notif waitlist (mail/SMS copier-coller — V1 sans envoi auto)
    function contactsOf(n) {
        try {
            var d = n.details ? JSON.parse(n.details) : null;
            if (d && d.contacts && d.contacts.length) return d.contacts;
        } catch (e) {}
        return null;
    }

    var currentFilter = 'all';
    var searchInput = document.getElementById('notifSearch');
    var PAGE_SIZE = 30;
    var shownCount = PAGE_SIZE; // pagination : charger plus

    function sevBadge(sev) {
        if (sev === 'success') return 'badge-ok';
        if (sev === 'warning') return 'badge-sub-none';
        if (sev === 'danger') return 'badge-full';
        return 'badge-sub-monthly';
    }

    function render() {
        var items = [];
        try { items = window.ADWDatabase.listNotifications(200) || []; } catch (e) { items = []; }

        // compteurs d'en-tête
        var unread = items.filter(function (n) { return !n.is_read; }).length;
        if (totalEl) totalEl.textContent = items.length + ' notification' + (items.length > 1 ? 's' : '') + (unread ? ' · ' + unread + ' non lue' + (unread > 1 ? 's' : '') : '');

        // compteurs par catégorie sur les boutons de filtre (répartition visible)
        var counts = { all: items.length, unread: 0, alerts: 0, waitlist: 0, sync: 0, activity: 0 };
        items.forEach(function (n) {
            if (n.is_read) counts.read++; else counts.unread++;
            counts[categoryOf(n)]++;
        });
        document.querySelectorAll('[data-nfilter]').forEach(function (b) {
            var k = b.getAttribute('data-nfilter');
            var base = b.textContent.replace(/\s*\d+$/, ''); // retire un éventuel ancien compte
            b.textContent = counts[k] ? base + ' ' + counts[k] : base;
        });

        // filtre (segmented + recherche texte se combinent)
        var q = (searchInput && searchInput.value || '').trim().toLowerCase();
        var filtered = items.filter(function (n) {
            if (currentFilter === 'all') return true;
            if (currentFilter === 'unread') return !n.is_read;
            return categoryOf(n) === currentFilter;
        });
        if (q) {
            filtered = filtered.filter(function (n) {
                return (n.message || '').toLowerCase().indexOf(q) !== -1;
            });
        }

        loading.hidden = true;
        if (!filtered.length) {
            listEl.hidden = true;
            listEl.innerHTML = '';
            emptyEl.hidden = false;
            return;
        }
        emptyEl.hidden = true;
        listEl.hidden = false;
        // pagination : trancher au nombre affiché, bouton « charger plus » si reste
        var remaining = filtered.length - shownCount;
        filtered = filtered.slice(0, shownCount);

        var CAT_LABEL = { alerts: '🚨 Alerte', waitlist: '🎯 Attente', sync: '🔄 Synchro', activity: 'ℹ️ Activité' };
        listEl.innerHTML = filtered.map(function (n) {
            var cat = categoryOf(n);
            var act = actionOf(n);
            // Icône par CATÉGORIE (cohérente avec le filtre) : la sévérité affine
            // (danger = ❌ dans les alertes, success = ✅ dans l'activité).
            var ico = cat === 'alerts'
                ? (n.severity === 'danger' ? '❌' : '⚠️')
                : cat === 'waitlist' ? '🎯'
                : cat === 'sync' ? '🔄'
                : (n.severity === 'success' ? '✅' : 'ℹ️');
            return '<div class="notif-page-item' + (n.is_read ? ' is-read' : '') + ' cat-' + cat + '">' +
                '<span class="notif-ico sev-' + esc(n.severity) + '">' + ico + '</span>' +
                '<div class="notif-body">' +
                '<div class="notif-msg">' + esc(n.message) + '</div>' +
                '<div class="notif-meta">' +
                '<span class="badge ' + sevBadge(n.severity) + '">' + CAT_LABEL[cat] + '</span>' +
                '<span class="form-hint">' + timeAgo(n.created_at) + '</span>' +
                '</div>' +
                '</div>' +
                '<span class="notif-actions">' +
                (act ? '<a class="btn btn-primary btn-small" href="' + act.href + '">' + esc(act.label) + '</a>' : '') +
                (contactsOf(n) ? '<button class="btn btn-secondary btn-small n-copy" data-nid="' + esc(n.id) + '" title="Copier les contacts (email/tél) pour un mail ou SMS group\u00e9">\ud83d\udccb Copier les contacts</button>' : '') +
                (n.is_read ? '' : '<button class="btn btn-secondary btn-small n-read" data-nid="' + esc(n.id) + '" title="Marquer comme lu">✓ Lu</button>') +
                '</span>' +
                '</div>';
        }).join('') +
        (remaining > 0
            ? '<div style="text-align:center;margin-top:0.8rem;"><button class="btn btn-secondary btn-small" id="notifMoreBtn">Charger ' + Math.min(remaining, PAGE_SIZE) + ' de plus (' + remaining + ' restantes)</button></div>'
            : '');
    }

    // ===== Événements (délégation) =====
    if (searchInput) {
        searchInput.addEventListener('input', function () { render(); });
    }
    document.addEventListener('click', function (e) {
        var readBtn = e.target.closest('.n-read');
        if (readBtn) {
            try { window.ADWDatabase.markNotificationRead(readBtn.getAttribute('data-nid')); } catch (err) {}
            if (window.ADWNotifications) window.ADWNotifications.refresh();
            render();
            return;
        }
        var markAll = e.target.closest('#markAllReadBtn');
        if (markAll) {
            try { window.ADWDatabase.markAllNotificationsRead(); } catch (err) {}
            if (window.ADWNotifications) window.ADWNotifications.refresh();
            render();
            return;
        }
        var clearRead = e.target.closest('#clearReadBtn');
        if (clearRead) {
            if (window.confirm('Effacer toutes les notifications lues ? Les non-lues restent.')) {
                try { window.ADWDatabase.clearReadNotifications(); } catch (err) {}
                render();
            }
            return;
        }
        var copyBtn = e.target.closest('.n-copy');
        if (copyBtn) {
            var nid = copyBtn.getAttribute('data-nid');
            var item = null;
            try { item = (window.ADWDatabase.listNotifications(200) || []).filter(function (n) { return n.id === nid; })[0]; } catch (err) {}
            var contacts = item ? contactsOf(item) : null;
            if (contacts && contacts.length) {
                var text = contacts.join('\n');
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(function () {
                        copyBtn.textContent = '✓ Copié !';
                        setTimeout(function () { copyBtn.textContent = '📋 Copier les contacts'; }, 2000);
                    }).catch(function () { window.prompt('Copie manuelle (Ctrl+C) :', text); });
                } else {
                    window.prompt('Copie manuelle (Ctrl+C) :', text);
                }
            }
            return;
        }
        var more = e.target.closest('#notifMoreBtn');
        if (more) {
            shownCount += PAGE_SIZE;
            render();
            return;
        }
        var seg = e.target.closest('[data-nfilter]');
        if (seg) {
            currentFilter = seg.getAttribute('data-nfilter');
            shownCount = PAGE_SIZE; // reset pagination au changement de filtre
            document.querySelectorAll('[data-nfilter]').forEach(function (b) { b.classList.toggle('active', b === seg); });
            render();
        }
    });

    // ===== Init =====
    window.ADWDatabase.init().then(function () {
        render();
        // rafraîchir si une notif arrive pendant qu'on est sur la page (autre onglet)
        document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); });
    }).catch(function (err) {
        loading.hidden = true;
        emptyEl.hidden = false;
        emptyEl.querySelector('p').textContent = 'Erreur de chargement de la base : ' + err.message;
    });
})();
