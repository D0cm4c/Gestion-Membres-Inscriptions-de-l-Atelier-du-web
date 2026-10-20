(function () {
    'use strict';

    // Composant partagé : « Réserver sur le site »
    // Ouvre un sélecteur de membre → la réservation MEC s'ouvre pré-remplie
    // avec les données du membre (n° de membre, nom, email, téléphone).
    // Le n° pré-rempli EST le tracking : la booking reviendra avec, le matching auto fera le reste.

    function ready(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }

    ready(function () {
        if (!window.ADWDatabase) return;

        var modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.hidden = true;
        modal.innerHTML =
            '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="bookingPickerTitle">' +
            '<h3 id="bookingPickerTitle">Réserver sur le site</h3>' +
            '<p class="form-hint" id="bookingPickerFormation"></p>' +
            '<div class="form-group">' +
            '<label for="bookingSearchInput">Pour quel membre ?</label>' +
            '<input type="text" id="bookingSearchInput" placeholder="Nom, prénom ou n° de membre..." autocomplete="off">' +
            '<p class="form-hint">Le formulaire d\u2019inscription du site s\u2019ouvrira pré-rempli avec les données du membre. Une fois la réservation confirmée sur le site, le rattachement se fait automatiquement à la prochaine synchronisation.</p>' +
            '<div id="bookingSearchResults" class="checkin-results" style="margin-top:0.6rem;" hidden></div>' +
            '</div>' +
            '<div class="modal-actions">' +
            '<button type="button" class="btn btn-secondary btn-small" id="bookingNoMemberBtn">Continuer sans membre</button>' +
            '<span style="flex:1"></span>' +
            '<button type="button" class="btn btn-primary" id="bookingCloseBtn">Fermer</button>' +
            '</div>' +
            '</div>';
        document.body.appendChild(modal);

        var searchInput = modal.querySelector('#bookingSearchInput');
        var results = modal.querySelector('#bookingSearchResults');
        var formationLabel = modal.querySelector('#bookingPickerFormation');
        var currentFormation = null;
        var activeIndex = -1; // navigation clavier dans les resultats

        function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

        function mecUrl(formation, member) {
            var url = formation.url + (formation.url.indexOf('?') === -1 ? '?' : '&') + 'method=mec-booking-modal';
            if (member) {
                var params = [
                    ['adw_name', (member.first_name || '') + ' ' + (member.last_name || '')],
                    ['adw_email', member.email || ''],
                    ['adw_phone', member.phone || ''],
                    ['adw_member_no', member.member_no || '']
                ];
                params.forEach(function (kv) { if (kv[1]) url += '&' + kv[0] + '=' + encodeURIComponent(kv[1]); });
            }
            return url;
        }

        function finish(member) {
            var f = currentFormation;
            modal.hidden = true;
            if (!f || !f.url) return;
            window.open(mecUrl(f, member), '_blank', 'noopener');
            if (window.ADWNotifications) {
                window.ADWNotifications.push('info',
                    member
                        ? '\uD83D\uDCE4 Formulaire d\u2019inscription ouvert sur le site pour ' + member.first_name + ' ' + member.last_name +
                          ' \u2014 ' + f.title + '. Le rattachement se fera automatiquement dès que la réservation sera confirmée.'
                        : '\uD83D\uDCE4 Formulaire d\u2019inscription ouvert sur le site \u2014 ' + f.title + ' (sans membre sélectionné).',
                    'info');
            }
        }

        var lastMembers = []; // resultats de la recherche courante (pour la navigation clavier)

        function setActive(idx) {
            activeIndex = idx;
            var items = results.querySelectorAll('.checkin-item');
            items.forEach(function (el, i) {
                el.classList.toggle('bk-active', i === activeIndex);
            });
            if (activeIndex >= 0 && items[activeIndex]) {
                items[activeIndex].scrollIntoView({ block: 'nearest' });
            }
        }

        function search(q) {
            q = (q || '').trim().toLowerCase();
            results.innerHTML = '';
            lastMembers = [];
            setActive(-1);
            if (!q) { results.hidden = true; return; }
            var members = window.ADWDatabase.queryAll(
                'SELECT id, first_name, last_name, member_no, email FROM members WHERE (first_name LIKE ? OR last_name LIKE ? OR CAST(member_no AS TEXT) LIKE ?) ORDER BY last_name LIMIT 8',
                ['%' + q + '%', '%' + q + '%', '%' + q + '%']
            );
            results.hidden = members.length === 0;
            members.forEach(function (m) {
                lastMembers.push(m);
                var li = document.createElement('div');
                li.className = 'checkin-item';
                li.innerHTML =
                    '<span class="member-avatar small">' + esc((m.first_name || '?')[0] + (m.last_name || '')[0]) + '</span>' +
                    '<div style="flex:1;min-width:0;"><strong>' + esc(m.last_name.toUpperCase() + ' ' + m.first_name) + '</strong>' +
                    (m.member_no ? ' <span class="member-no">#' + esc(m.member_no) + '</span>' : '') +
                    '<div class="form-hint">' + (m.email ? esc(m.email) : 'pas d\u2019email') + '</div></div>';
                li.addEventListener('click', function () { finish(m); });
                li.addEventListener('mouseenter', function () { setActive(lastMembers.indexOf(m)); });
                results.appendChild(li);
            });
            if (members.length) setActive(0); // premier resultat pre-selectionne
        }

        window.ADWBooking = {
            // formation : { title, url } (ligne de la table formations)
            openPicker: function (formation) {
                if (!formation || !formation.url) return;
                currentFormation = formation;
                formationLabel.textContent = formation.title || '';
                searchInput.value = '';
                results.hidden = true;
                results.innerHTML = '';
                modal.hidden = false;
                searchInput.focus();
            }
        };

        searchInput.addEventListener('input', function () { search(searchInput.value); });
        searchInput.addEventListener('keydown', function (e) {
            if (results.hidden || !lastMembers.length) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive(Math.min(activeIndex + 1, lastMembers.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive(Math.max(activeIndex - 1, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (activeIndex >= 0 && lastMembers[activeIndex]) finish(lastMembers[activeIndex]);
            }
        });
        modal.querySelector('#bookingNoMemberBtn').addEventListener('click', function () { finish(null); });
        modal.querySelector('#bookingCloseBtn').addEventListener('click', function () { modal.hidden = true; });
        modal.addEventListener('click', function (e) { if (e.target === modal) modal.hidden = true; });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !modal.hidden) modal.hidden = true;
        });
    });
})();
