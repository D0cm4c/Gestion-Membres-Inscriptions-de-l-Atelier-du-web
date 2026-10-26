    (function () {
        'use strict';

        var list = document.getElementById('suggList');
        var empty = document.getElementById('emptyState');
        var loading = document.getElementById('loadingState');
        var countEl = document.getElementById('suggCount');
        var status = 'all';

        document.getElementById('todayDate').textContent = new Date().toLocaleDateString('fr-BE', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });

        function esc(s) { return window.ADWEscape.html(s); }

        function statusBadge(s) {
            if (s === 'done') return '<span class="badge badge-ok">✓ traitée</span>';
            if (s === 'discarded') return '<span class="badge badge-sub-none">écartée</span>';
            return '<span class="badge badge-sub-monthly">à traiter</span>';
        }

        function pageLabel(p) {
            if (!p) return '';
            var name = (p.split('/').pop() || p).split('?')[0];
            var map = { 'index.html': 'Tableau de bord', 'membres.html': 'Membres', 'formations.html': 'Formations', 'formation.html': 'Fiche formation', 'membre.html': 'Fiche membre', 'parametres.html': 'Paramètres', 'suggestions.html': 'À faire' };
            return map[name] || name;
        }

        function render() {
            var all = [];
            try { all = window.ADWDatabase.listSuggestions(); } catch (e) { all = []; }
            var items = status === 'all' ? all : all.filter(function (s) { return s.status === status; });
            loading.hidden = true;
            countEl.textContent = items.length + ' suggestion' + (items.length > 1 ? 's' : '');
            list.innerHTML = '';
            empty.hidden = items.length > 0;
            items.forEach(function (s) {
                var card = document.createElement('article');
                card.className = 'checkin-item';
                card.style.flexWrap = 'wrap';
                card.style.cursor = 'default';
                var date = (s.created_at || '').slice(0, 16).replace('T', ' ');
                card.innerHTML =
                    '<span style="font-size:1.2rem;" aria-hidden="true">' + (s.status === 'done' ? '✅' : s.status === 'discarded' ? '🚫' : '💡') + '</span>' +
                    '<div style="flex:1;min-width:220px;">' +
                    '<div>' + esc(s.message) + '</div>' +
                    '<div class="form-hint">' +
                    (s.author ? 'par ' + esc(s.author) + ' · ' : '') +
                    date +
                    (s.page ? ' · depuis ' + esc(pageLabel(s.page)) : '') +
                    '</div></div>' +
                    statusBadge(s.status) +
                    '<div style="flex-basis:100%;display:flex;gap:0.4rem;padding-top:0.4rem;">' +
                    (s.status === 'open'
                        ? '<button class="btn btn-primary btn-small s-done" data-id="' + esc(s.id) + '">✓ Traiter</button>' +
                          '<button class="btn btn-danger btn-small s-discard" data-id="' + esc(s.id) + '">Écarter</button>'
                        : '<button class="btn btn-secondary btn-small s-reopen" data-id="' + esc(s.id) + '">↩ Rouvrir</button>') +
                    '</div>';
                list.appendChild(card);
            });
        }

        list.addEventListener('click', function (e) {
            var done = e.target.closest('.s-done');
            var discard = e.target.closest('.s-discard');
            var reopen = e.target.closest('.s-reopen');
            if (!done && !discard && !reopen) return;
            var id = (done || discard || reopen).getAttribute('data-id');
            var action = done ? 'done' : (discard ? 'discarded' : 'open');
            window.ADWDatabase.setSuggestionStatus(id, action);
            render();
        });

        document.querySelectorAll('[data-status]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                document.querySelectorAll('[data-status]').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                status = btn.getAttribute('data-status');
                render();
            });
        });

        window.ADWDatabase.init().then(function () {
            if (window.ADWNotifications) window.ADWNotifications.refresh();
            render();
        }).catch(function () {
            loading.hidden = true;
            empty.hidden = false;
        });
    })();
