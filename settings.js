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
            li.style.borderBottom = '1px solid var(--bg)';
            li.style.padding = '0.55rem 0';
            li.innerHTML =
                '<label style="display:flex;align-items:center;gap:0.7rem;font-size:0.95rem;font-weight:600;cursor:pointer;">' +
                    '<input type="checkbox" data-tile="' + tid + '"' + (hidden.indexOf(tid) === -1 ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:var(--accent);cursor:pointer;">' +
                    '<span>' + TILE_LABELS[tid] + '</span>' +
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
                window.ADWDatabase.purgeAllPersonalData().then(function () {
                    alert('Toutes les données personnelles ont été effacées de ce navigateur.');
                });
            });
        }
    }

    window.ADWSettings = {
        hiddenTiles: getHidden,
        TILE_LABELS: TILE_LABELS
    };
})();
