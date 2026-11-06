(function () {
    'use strict';

    // Centre de notifications partagé — s'active sur toute page ayant un conteneur #notifCenter
    function ready(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }

    ready(function () {
        var anchor = document.getElementById('notifCenter');
        if (!anchor || !window.ADWDatabase) return;

        var btn = document.createElement('button');
        btn.className = 'theme-toggle notif-btn'; // réutilise le style rond de theme-toggle
        btn.setAttribute('aria-label', 'Centre de notifications');
        btn.title = 'Notifications';
        btn.innerHTML = '🔔<span class="notif-badge" hidden>0</span>';
        anchor.appendChild(btn);

        var modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.hidden = true;
        modal.innerHTML =
            '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="notifTitle">' +
            '<h3 id="notifTitle">🔔 Notifications <span class="members-count" id="notifPreviewCount"></span></h3>' +
            '<div id="notifList" class="checkin-results" style="max-height:40vh;"></div>' +
            '<div class="modal-actions">' +
            '<a href="notifications.html" class="btn btn-primary btn-small" id="notifSeeAllBtn">Tout voir →</a>' +
            '<span style="flex:1"></span>' +
            '<button type="button" class="btn btn-secondary" id="notifCloseBtn">Fermer</button>' +
            '</div></div>';
        document.body.appendChild(modal);

        var badge = btn.querySelector('.notif-badge');
        var list = modal.querySelector('#notifList');

        function esc(s) { return window.ADWEscape.html(s); }

        function refreshBadge() {
            var count = 0;
            try { count = window.ADWDatabase.unreadNotificationsCount(); } catch (e) { count = 0; }
            badge.textContent = count > 99 ? '99+' : count;
            badge.hidden = count === 0;
            btn.title = count ? count + ' notification(s) non lue(s)' : 'Notifications';
            // badge de la sidebar (lien Notifications) — même compte
            var nav = document.getElementById('navNotifBadge');
            if (nav) {
                nav.textContent = count > 99 ? '99+' : count;
                nav.hidden = count === 0;
            }
        }

        function sevClass(s) {
            if (s === 'success') return 'badge-ok';
            if (s === 'warning') return 'badge-sub-none';
            if (s === 'danger') return 'badge-full';
            return 'badge-sub-monthly';
        }

        function renderList() {
            // Aperçu cloche : léger — 8 dernières non lues, sinon 8 dernières toutes catégories.
            // Le centre complet vit sur notifications.html (bouton « Tout voir »).
            var items = [];
            try {
                items = window.ADWDatabase.listNotificationsPreview(8) || [];
            } catch (e) { items = []; }
            var pc = modal.querySelector('#notifPreviewCount');
            if (pc) pc.textContent = items.length;
            list.innerHTML = items.length ? '' : '<p class="form-hint" style="padding:1rem;">Aucune notification récente. Le centre complet vit sur la page Notifications.</p>';
            items.forEach(function (n) {
                var li = document.createElement('div');
                li.className = 'checkin-item' + (n.is_read ? ' done' : '');
                li.innerHTML =
                    '<span class="notif-ico sev-' + esc(n.severity) + '">' +
                    (n.severity === 'success' ? '✅' : n.severity === 'warning' ? '⚠️' : n.severity === 'danger' ? '❌' : 'ℹ️') +
                    '</span>' +
                    '<div style="flex:1;min-width:0;"><div>' + esc(n.message) + '</div>' +
                    '<div class="form-hint">' + esc((n.created_at || '').slice(0, 16).replace('T', ' ')) + '</div></div>' +
                    (n.is_read ? '' : '<span class="badge ' + sevClass(n.severity) + '">nouveau</span>');
                list.appendChild(li);
            });
        }

        function open() {
            // La cloche est un APERÇU : elle ne marque plus tout lu automatiquement.
            // Le marquage est explicite (page Notifications : bouton « Lu » par notif ou « tout marquer lu »).
            renderList();
            modal.hidden = false;
            refreshBadge();
        }

        btn.addEventListener('click', open);
        modal.querySelector('#notifCloseBtn').addEventListener('click', function () { modal.hidden = true; });
        modal.addEventListener('click', function (e) { if (e.target === modal) modal.hidden = true; });
        // NB : plus de bouton « Tout effacer » dans l'aperçu — le nettoyage vit sur la page
        // notifications.html (effacer les lues uniquement, plus prudent que tout effacer).

        // API pour les autres scripts
        window.ADWNotifications = {
            push: function (type, message, severity, details) {
                try {
                    window.ADWDatabase.notify(type, message, severity, details);
                    refreshBadge();
                } catch (e) { /* DB non prête : ignore */ }
            },
            refresh: refreshBadge
        };

        refreshBadge();
        // Rafraîchit le badge quand la page redevient visible (synchro possible dans un autre onglet)
        document.addEventListener('visibilitychange', refreshBadge);

        // ===== Rappel auto : formations sans salle (anti-spam quotidien) =====
        // Au démarrage de n'importe quelle page, si des formations datées n'ont pas de salle,
        // une notification par formation est émise — une seule fois par jour (localStorage).
        function roomReminderCheck() {
            var db = window.ADWDatabase;
            if (!db || !db.formationsWithoutRoom) return;
            var without;
            try { without = db.formationsWithoutRoom() || []; } catch (e) { return; }
            var attributable = without.filter(function (f) { return f.date_count > 0; });
            if (!attributable.length) return;
            // anti-spam : 1 vérification productive par jour
            var today = new Date().toISOString().slice(0, 10);
            var lastKey = 'adw_room_reminder';
            var last = null;
            try { last = localStorage.getItem(lastKey); } catch (e) {}
            if (last === today) return;
            try { localStorage.setItem(lastKey, today); } catch (e) {}
            // anti-doublon : ne pas re-signaler une formation déjà notifiée (tant que non résolue)
            var already = {};
            try {
                db.listNotifications(200).forEach(function (n) {
                    if (n.type === 'room_needed') {
                        try {
                            var d = n.details ? JSON.parse(n.details) : null;
                            if (d && d.event_id) already[d.event_id] = true;
                        } catch (e) {}
                    }
                });
            } catch (e) {}
            attributable.forEach(function (f) {
                if (already[f.event_id]) return; // déjà signalée, pas résolue : pas de spam
                window.ADWNotifications.push('room_needed',
                    '🏷 « ' + (f.title || 'Formation') + ' » n\u2019a pas de salle attribuée — planifie-la depuis la page Salles.',
                    'warning', { event_id: f.event_id });
            });
        }
        // ===== Rappel auto : tickets urgents non assignés (tickets étape 3) =====
        // Au démarrage, chaque ticket urgent (open/in_progress) SANS assigné génère une
        // notification — dédupliquée par ticket (details.ticket_id) tant que non résolu.
        function urgentTicketsCheck() {
            var db = window.ADWDatabase;
            if (!db || !db.queryAll) return;
            var rows;
            try {
                rows = db.queryAll("SELECT id, title, equipment FROM tickets " +
                    "WHERE status IN ('open','in_progress') AND priority = 'urgent' " +
                    "AND (assignee IS NULL OR assignee = '')");
            } catch (e) { return; }
            if (!rows.length) return;
            var already = {};
            try {
                db.listNotifications(200).forEach(function (n) {
                    if (n.type === 'ticket_urgent') {
                        try {
                            var d = n.details ? JSON.parse(n.details) : null;
                            if (d && d.ticket_id) already[d.ticket_id] = true;
                        } catch (e) {}
                    }
                });
            } catch (e) {}
            rows.forEach(function (t) {
                if (already[t.id]) return;
                window.ADWNotifications.push('ticket_urgent',
                    '🛠️ Incident URGENT non assigné : « ' + (t.title || 'ticket') + ' »' +
                    (t.equipment ? ' (' + t.equipment + ')' : '') + ' — assigne-le ou traite-le depuis la page Incidents.',
                    'danger', { ticket_id: t.id });
            });
        }

        // attendre que la DB soit initialisée
        var tryDb = setInterval(function () {
            if (window.ADWDatabase && window.ADWDatabase.db) {
                clearInterval(tryDb);
                try { roomReminderCheck(); } catch (e) {}
                try { urgentTicketsCheck(); } catch (e) {}
            }
        }, 600);
        setTimeout(function () { clearInterval(tryDb); }, 15000); // bail global
    });
})();
