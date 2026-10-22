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
            '<h3 id="notifTitle">🔔 Notifications</h3>' +
            '<div id="notifList" class="checkin-results" style="max-height:50vh;"></div>' +
            '<div class="modal-actions">' +
            '<button type="button" class="btn btn-secondary btn-small" id="notifClearBtn">🗑 Tout effacer</button>' +
            '<span style="flex:1"></span>' +
            '<button type="button" class="btn btn-primary" id="notifCloseBtn">Fermer</button>' +
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
        }

        function sevClass(s) {
            if (s === 'success') return 'badge-ok';
            if (s === 'warning') return 'badge-sub-none';
            if (s === 'danger') return 'badge-full';
            return 'badge-sub-monthly';
        }

        function renderList() {
            var items = [];
            try { items = window.ADWDatabase.listNotifications(50); } catch (e) { items = []; }
            list.innerHTML = items.length ? '' : '<p class="form-hint" style="padding:1rem;">Aucune notification. Les actions automatiques (synchro, rattachements) apparaîtront ici.</p>';
            items.forEach(function (n) {
                var li = document.createElement('div');
                li.className = 'checkin-item' + (n.is_read ? ' done' : '');
                var date = (n.created_at || '').slice(0, 16).replace('T', ' ');
                li.innerHTML =
                    '<span class="notif-ico sev-' + esc(n.severity) + '">' +
                    (n.severity === 'success' ? '✅' : n.severity === 'warning' ? '⚠️' : n.severity === 'danger' ? '❌' : 'ℹ️') +
                    '</span>' +
                    '<div style="flex:1;min-width:0;"><div>' + esc(n.message) + '</div>' +
                    '<div class="form-hint">' + esc(date) + '</div></div>' +
                    (n.is_read ? '' : '<span class="badge ' + sevClass(n.severity) + '">nouveau</span>');
                list.appendChild(li);
            });
        }

        function open() {
            renderList();
            modal.hidden = false;
            try { window.ADWDatabase.markAllNotificationsRead(); } catch (e) { /* ignore */ }
            refreshBadge();
            renderList(); // re-render avec état lu
        }

        btn.addEventListener('click', open);
        modal.querySelector('#notifCloseBtn').addEventListener('click', function () { modal.hidden = true; });
        modal.addEventListener('click', function (e) { if (e.target === modal) modal.hidden = true; });
        modal.querySelector('#notifClearBtn').addEventListener('click', function () {
            if (window.confirm("Effacer tout l'historique des notifications ?")) {
                window.ADWDatabase.clearNotifications();
                renderList();
                refreshBadge();
            }
        });

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
    });
})();
