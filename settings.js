(function () {
    'use strict';

    var TILES_HIDDEN_KEY = 'atelierduweb_tiles_hidden';

    var TILE_LABELS = {
        kpi0: '👥 Membres au total (KPI)',
        kpi1: '✅ Inscriptions actives (KPI)',
        kpi2: '📅 Visites aujourd\'hui (KPI)',
        kpi3: '💶 Revenus visites ce mois (KPI)',
        members: '📊 Membres (stats détaillées)',
        alerts: '🚨 Alertes',
        recent: '📋 Dernières visites',
        occupancy: '🔥 Occupation des postes',
        retention: '📉 Rétention des inscrits',
        profile: '🧭 Profil des usagers',
        flux: '🧑‍🤝‍🧑 Nouveaux usagers du jour',
        inclusion: '🤝 Inclusion numérique',
        prints: '🖨️ Impressions à solder',
        chart: '📈 Visites (graphique + heatmap)'
    };

    function getHidden() {
        try { return JSON.parse(localStorage.getItem(TILES_HIDDEN_KEY)) || []; } catch (e) { return []; }
    }

    function setHidden(list) {
        try { localStorage.setItem(TILES_HIDDEN_KEY, JSON.stringify(list)); } catch (e) { /* best effort */ }
    }

    // Page Paramètres : construire la liste de cases
    var list = document.getElementById('tilesList');
    if (list) {
        var hidden = getHidden();

        Object.keys(TILE_LABELS).forEach(function (tid) {
            var li = document.createElement('li');
            li.innerHTML =
                '<label style="display:flex;align-items:center;gap:0.7rem;font-size:0.93rem;font-weight:600;cursor:pointer;">' +
                    '<input type="checkbox" data-tile="' + tid + '"' + (hidden.indexOf(tid) === -1 ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:var(--accent);cursor:pointer;">' +
                    '<span class="grow">' + TILE_LABELS[tid] + '</span>' +
                '</label>';
            list.appendChild(li);
        });

        list.addEventListener('change', function (e) {
            var cb = e.target;
            var tid = cb.getAttribute('data-tile');
            var cur = getHidden();
            if (cb.checked) {
                cur = cur.filter(function (t) { return t !== tid; });
            } else if (cur.indexOf(tid) === -1) {
                cur.push(tid);
            }
            setHidden(cur);
        });

        document.getElementById('tilesAllBtn').addEventListener('click', function () {
            setHidden([]);
            list.querySelectorAll('input[type="checkbox"]').forEach(function (cb) { cb.checked = true; });
        });

        document.getElementById('tilesNoneBtn').addEventListener('click', function () {
            setHidden(Object.keys(TILE_LABELS));
            list.querySelectorAll('input[type="checkbox"]').forEach(function (cb) { cb.checked = false; });
        });

        var purgeBtn = document.getElementById('purgeAllBtn');
        if (purgeBtn) {
            purgeBtn.addEventListener('click', function () {
                if (!window.ADWDatabase) return;
                var step1 = confirm('Purger TOUTES les données personnelles de ce navigateur ?\n\nMembres, visites, impressions, inscriptions aux formations, réservations en attente et suggestions seront définitivement effacés.');
                if (!step1) return;
                var step2 = confirm('Confirmation finale : cette action est IRRÉVERSIBLE.\n\nLes données personnelles vont être effacées définitivement.');
                if (!step2) return;
                ensureDb().then(function () {
                    return window.ADWDatabase.purgeAllPersonalData();
                }).then(function () {
                    alert('Toutes les données personnelles ont été effacées de ce navigateur.');
                }).catch(function () {
                    alert('Impossible d\u2019ouvrir la base de données locale.');
                });
            });
        }
    }

    // ============ Gestion des salles (page Paramètres) ============

    var dbReady = null;
    function ensureDb() {
        if (!dbReady) dbReady = window.ADWDatabase.init();
        return dbReady;
    }

    function initRoomsAdmin() {
        var list = document.getElementById('roomsList');
        var nameInput = document.getElementById('newRoomName');
        var capInput = document.getElementById('newRoomCapacity');
        var addBtn = document.getElementById('addRoomBtn');
        if (!list || !addBtn || !window.ADWDatabase) return;

        function esc(v) { return window.ADWEscape.html(v); }

        function render() {
            var rooms = window.ADWDatabase.listRooms();
            if (!rooms.length) {
                list.innerHTML = '<li class="form-hint" style="padding:0.5rem 0;">Aucune salle — ajoute-en une ci-dessous.</li>';
                return;
            }
            list.innerHTML = '';
            rooms.forEach(function (r) {
                var li = document.createElement('li');
                li.innerHTML =
                    '<span class="grow" style="font-weight:600;">' + esc(r.name) + '</span>' +
                    '<span class="room-cap">' + (r.capacity ? esc(r.capacity) + ' place' + (r.capacity > 1 ? 's' : '') : 'capacité libre') + '</span>';

                var renameBtn = document.createElement('button');
                renameBtn.className = 'btn btn-secondary btn-small';
                renameBtn.textContent = '✏️';
                renameBtn.title = 'Renommer la salle';
                renameBtn.addEventListener('click', function () {
                    var newName = prompt('Nouveau nom de la salle :', r.name);
                    if (newName && newName.trim()) {
                        window.ADWDatabase.renameRoom(r.id, newName);
                        render();
                    }
                });

                var deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn btn-danger btn-small';
                deleteBtn.textContent = '🗑️';
                deleteBtn.title = 'Supprimer la salle';
                deleteBtn.addEventListener('click', function () {
                    var res = window.ADWDatabase.deleteRoom(r.id);
                    if (!res.ok) {
                        alert('Impossible de supprimer « ' + r.name + ' » : ' + res.blocked.length +
                            ' formation(s) y sont attribuée(s) (ex. « ' + res.blocked[0].title + ' »).\n' +
                            'Réattribue-les depuis la page Salles d’abord.');
                        return;
                    }
                    render();
                });

                li.appendChild(renameBtn);
                li.appendChild(deleteBtn);
                list.appendChild(li);
            });
        }

        addBtn.addEventListener('click', function () {
            var name = (nameInput.value || '').trim();
            if (!name) { nameInput.focus(); return; }
            window.ADWDatabase.addRoom(name, capInput.value);
            nameInput.value = '';
            capInput.value = '';
            render();
        });

        ensureDb().then(render).catch(function () { /* base indisponible : liste vide */ });
    }

    if (document.readyState !== 'loading') initRoomsAdmin();
    else document.addEventListener('DOMContentLoaded', initRoomsAdmin);

    window.ADWSettings = {
        hiddenTiles: getHidden,
        TILE_LABELS: TILE_LABELS
    };
})();
