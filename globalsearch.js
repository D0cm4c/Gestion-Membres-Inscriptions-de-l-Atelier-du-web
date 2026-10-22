(function () {
    'use strict';

    // Recherche globale — recherche dans l'app (membres, formations, suggestions)
    // Prend le relais sur les champs de recherche de topbar (id="siteSearch").
    // Dropdown avec navigation clavier (haut/bas/Entrée/Échap), résultats cliquables.

    function ready(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }

    ready(function () {
        var input = document.getElementById('siteSearch');
        if (!input || !window.ADWDatabase) return;

        input.placeholder = 'Rechercher : membre, formation…';
        input.setAttribute('autocomplete', 'off');

        var drop = document.createElement('div');
        drop.className = 'gs-dropdown';
        drop.hidden = true;
        input.parentNode.style.position = 'relative';
        input.parentNode.appendChild(drop);

        var results = [];
        var activeIndex = -1;

        function esc(s) { return window.ADWEscape.html(s); }

        function setActive(idx) {
            activeIndex = idx;
            var items = drop.querySelectorAll('.gs-item');
            items.forEach(function (el, i) { el.classList.toggle('gs-active', i === activeIndex); });
            if (activeIndex >= 0 && items[activeIndex]) items[activeIndex].scrollIntoView({ block: 'nearest' });
        }

        function close() { drop.hidden = true; activeIndex = -1; results = []; }

        function go(item) {
            if (!item) return;
            location.href = item.url;
        }

        function search(q) {
            q = (q || '').trim().toLowerCase();
            if (!q || q.length < 2) { close(); return; }
            results = [];
            var like = '%' + q + '%';

            // Membres
            try {
                var members = window.ADWDatabase.queryAll(
                    'SELECT id, first_name, last_name, member_no, email FROM members ' +
                    'WHERE (first_name LIKE ? OR last_name LIKE ? OR CAST(member_no AS TEXT) LIKE ? OR email LIKE ?) ' +
                    'ORDER BY last_name LIMIT 5', [like, like, like, like]);
                members.forEach(function (m) {
                    results.push({
                        icon: '👥', label: m.first_name + ' ' + m.last_name + (m.member_no ? ' (#' + m.member_no + ')' : ''),
                        hint: m.email || 'membre', url: 'membre.html?id=' + encodeURIComponent(m.id)
                    });
                });
            } catch (e) { /* table absente */ }

            // Formations
            try {
                var formations = window.ADWDatabase.queryAll(
                    'SELECT id, title, event_id, date_text FROM formations ' +
                    'WHERE (title LIKE ? OR categories LIKE ?) ORDER BY start_date LIMIT 5', [like, like]);
                formations.forEach(function (f) {
                    results.push({
                        icon: '🎓', label: f.title,
                        hint: 'formation' + (f.date_text ? ' · ' + f.date_text : ''),
                        url: 'formation.html?id=' + encodeURIComponent(f.event_id)
                    });
                });
            } catch (e) { /* table absente */ }

            // Suggestions
            try {
                var suggs = window.ADWDatabase.queryAll(
                    "SELECT id, message FROM suggestions WHERE message LIKE ? AND status = 'open' LIMIT 3", [like]);
                suggs.forEach(function (sg) {
                    results.push({
                        icon: '💡', label: (sg.message || '').slice(0, 60),
                        hint: 'à faire', url: 'suggestions.html'
                    });
                });
            } catch (e) { /* table absente */ }

            if (!results.length) {
                drop.innerHTML = '<div class="gs-empty">Aucun résultat dans l\u2019app.</div>';
                drop.hidden = false;
                return;
            }
            var html = '';
            results.forEach(function (r, i) {
                html += '<div class="gs-item" data-idx="' + i + '">' +
                    '<span class="gs-ico">' + r.icon + '</span>' +
                    '<span class="gs-label">' + esc(r.label) + '</span>' +
                    '<span class="gs-hint">' + esc(r.hint) + '</span>' +
                    '</div>';
            });
            drop.innerHTML = html;
            drop.hidden = false;
            setActive(0);
        }

        input.addEventListener('input', function () { search(input.value); });
        input.addEventListener('focus', function () { if (input.value.trim().length >= 2) search(input.value); });
        input.addEventListener('keydown', function (e) {
            if (drop.hidden || !results.length) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(activeIndex + 1, results.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(activeIndex - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); go(results[activeIndex >= 0 ? activeIndex : 0]); }
            else if (e.key === 'Escape') { close(); }
        });
        drop.addEventListener('click', function (e) {
            var item = e.target.closest('.gs-item');
            if (item) go(results[parseInt(item.getAttribute('data-idx'), 10)]);
        });
        document.addEventListener('click', function (e) {
            if (!input.parentNode.contains(e.target)) close();
        });
    });
})();
