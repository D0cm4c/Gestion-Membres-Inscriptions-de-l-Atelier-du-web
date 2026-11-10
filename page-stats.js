(function () {
    'use strict';

    // Page Statistiques (stats.html) — le pilotage de la directrice :
    // KPI membres/inscriptions/revenus, stats détaillées, rétention, profil,
    // inclusion, graphiques visites + heatmap, rapport annuel.
    // Dépend de : db.js (window.ADWDatabase), escape.js.

    function escapeHtml(str) { return window.ADWEscape.html(str); }

    function one(sql, params, col) {
        var rows = window.ADWDatabase.queryAll(sql, params || []);
        if (!rows.length) return 0;
        return rows[0][col || 'v'] || 0;
    }

    function setText(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = String(value);
    }

    var chartMode = 'days';
    var ADWDatabase = window.ADWDatabase;
    var chartDaysBtn = document.getElementById('chartDaysBtn');
    var chartMonthsBtn = document.getElementById('chartMonthsBtn');
    var annualReportBtn = document.getElementById('annualReportBtn');

    // Couleurs et libell\u00e9s des statuts sociaux (donut inclusion) \u2014 extraits de dashboard.js
    var STATUS_COLORS = {
        cpas: '#2F9BE4',
        actiris: '#6C5CE7',
        travailleur: '#18A55F',
        etudiant: '#EFA02C',
        pensionne: '#E8734A',
        mutuelle: '#B57BD6',
        interim: '#4ECDC4',
        enfant: '#95A5B8'
    };
    var STATUS_NAMES = {
        cpas: 'CPAS / Orbem', actiris: 'Actiris', travailleur: 'Travailleur.se',
        etudiant: '\u00c9tudiant', pensionne: 'Pensionn\u00e9', mutuelle: 'Mutuelle',
        interim: 'Int\u00e9rim', enfant: 'Enfant'
    };

    function eur(v) { return Number(v).toFixed(2).replace('.', ',') + ' \u20ac'; }

    // ===== KPI + carte Membres (stats détaillées) =====
    function renderMembersStats() {
        var total = one('SELECT COUNT(*) v FROM members');
        var active = one('SELECT COUNT(*) v FROM members WHERE date(end_date) >= date(\'now\') OR end_date IS NULL');
        var expired = one('SELECT COUNT(*) v FROM members WHERE date(end_date) < date(\'now\') AND end_date IS NOT NULL');
        var monthly = one('SELECT COUNT(*) v FROM members WHERE subscription = \'monthly\'');
        var yearly = one('SELECT COUNT(*) v FROM members WHERE subscription = \'yearly\'');
        var newThisMonth = one('SELECT COUNT(*) v FROM members WHERE date(created_at) >= date(\'now\', \'start of month\')');
        var revenueMonth = one('SELECT COALESCE(SUM(amount), 0) v FROM visits WHERE strftime(\'%Y-%m\', visit_date) = strftime(\'%Y-%m\', \'now\')');

        var visitsMonth = one('SELECT COUNT(*) v FROM visits WHERE strftime(\'%Y-%m\', visit_date) = strftime(\'%Y-%m\', \'now\')');
        setText('statVisitsMonth', visitsMonth);
        setText('statTotal', total);
        setText('statActive', active);
        setText('statExpired', expired);
        setText('statNewMonth', newThisMonth);
        setText('statMonthly', monthly);
        setText('statYearly', yearly);
        setText('statActivePct', (total ? Math.round((active / total) * 100) : 0) + ' %');
        var rev = document.getElementById('statRevenueMonth');
        if (rev) rev.textContent = revenueMonth.toFixed(2).replace('.', ',') + ' \u20ac';
    }

    // ===== Rétention =====
    function renderRetention() {
        var perMember = window.ADWDatabase.queryAll(
            'SELECT m.id, ' +
            '(SELECT COUNT(*) FROM visits v WHERE v.member_id = m.id) AS visits, ' +
            '(SELECT MAX(visit_date) FROM visits v WHERE v.member_id = m.id) AS last_visit ' +
            'FROM members m');
        var regulars = 0, oneshot = 0, never = 0, silent = 0;
        var totalVisits = 0;
        perMember.forEach(function (r) {
            totalVisits += r.visits;
            if (r.visits >= 5) regulars++;
            else if (r.visits === 1) oneshot++;
            else if (r.visits === 0) never++;
            if (r.visits > 0 && r.last_visit && r.last_visit < new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)) silent++;
        });
        var regularVisits = perMember.filter(function (r) { return r.visits >= 5; }).reduce(function (s, r) { return s + r.visits; }, 0);
        setText('retRegulars', regulars + ' membres (' + (totalVisits ? Math.round((regularVisits / totalVisits) * 100) : 0) + ' % des visites)');
        setText('retOneshot', String(oneshot));
        setText('retNever', String(never));
        setText('retSilent', String(silent));
    }

    // ===== Profil socio-spatial =====
    function renderProfile() {
        var byCp = window.ADWDatabase.queryAll(
            "SELECT postal_code, COUNT(*) c FROM members WHERE postal_code IS NOT NULL AND postal_code != '' GROUP BY postal_code ORDER BY c DESC LIMIT 4");
        var totalCp = one("SELECT COUNT(*) v FROM members WHERE postal_code IS NOT NULL AND postal_code != ''");
        var sg = one("SELECT COUNT(*) v FROM members WHERE postal_code IN ('1000','1020','1030','1040','1050','1060','1070','1080','1090','1100','1120','1130','1140','1150','1160','1170','1180','1190','1200','1210')");
        var pl = document.getElementById('profileList');
        if (pl) {
            pl.innerHTML = byCp.map(function (r) {
                var pct = totalCp ? Math.round((r.c / totalCp) * 100) : 0;
                return '<li><strong>' + escapeHtml(r.postal_code) + '</strong> : ' + r.c + ' membres (' + pct + ' %)</li>';
            }).join('') || '<li class="form-hint">Aucun code postal renseign\u00e9.</li>';
        }
        setText('profileHint', totalCp ? Math.round((sg / totalCp) * 100) + ' % des usagers viennent de la R\u00e9gion de Bruxelles-Capitale' : 'Renseignez les codes postaux pour activer cette analyse.');
    }

    // ===== Inclusion numérique =====
    function renderInclusion() {
        var totalM = one('SELECT COUNT(*) v FROM members');
        var vulnerable = one("SELECT COUNT(*) v FROM members WHERE social_status IN ('cpas', 'mutuelle', 'interim', 'actiris')");
        var cpasPart = one("SELECT COUNT(*) v FROM members WHERE social_status = 'cpas'");
        var noSub = one("SELECT COUNT(*) v FROM members WHERE subscription = 'none' OR subscription IS NULL");
        var pct = function (v) { return totalM ? Math.round((v / totalM) * 100) : 0; };
        setText('inclVulnerable', vulnerable + ' membres (' + pct(vulnerable) + ' %)');
        setText('inclCpas', pct(cpasPart) + ' %');
        setText('inclFree', noSub + ' membres (' + pct(noSub) + ' %)');
        setText('inclHint', 'CPAS/Orbem, mutuellistes, int\u00e9rimaires et accompagn\u00e9s Actiris : le public prioritaire de la m\u00e9diation num\u00e9rique.');
    }

    function buildAnnualReport() {
        var year = new Date().getFullYear();
        var sep = ';';
        var lines = [];
        var add = function (k, v) { lines.push('"' + String(k).replace(/"/g, '""') + '"' + sep + '"' + String(v).replace(/"/g, '""') + '"'); };
        var total = one('SELECT COUNT(*) v FROM members');
        var active = one("SELECT COUNT(*) v FROM members WHERE date(end_date) >= date('now') OR end_date IS NULL");
        var visitsYear = one("SELECT COUNT(*) v FROM visits WHERE strftime('%Y', visit_date) = '" + year + "'");
        var uniqueVisitors = one("SELECT COUNT(DISTINCT member_id) v FROM visits WHERE strftime('%Y', visit_date) = '" + year + "'");
        var monthly = one("SELECT COUNT(*) v FROM members WHERE subscription = 'monthly'");
        var yearly = one("SELECT COUNT(*) v FROM members WHERE subscription = 'yearly'");
        var vuln = one("SELECT COUNT(*) v FROM members WHERE social_status IN ('cpas','mutuelle','interim','actiris')");
        var seniors = one('SELECT COUNT(*) v FROM members WHERE age >= 65');

        lines.push('"Rapport annuel ' + year + ' \u2014 Atelier du Web (EPN)"');
        add('Généré le', new Date().toLocaleDateString('fr-BE'));
        lines.push('');
        lines.push('"Usagers"');
        add('Membres enregistrés (total)', total);
        add('Inscriptions actives', active);
        add('Abonnements mensuels', monthly);
        add('Abonnements annuels', yearly);
        lines.push('');
        lines.push('"Fréquentation ' + year + '"');
        add('Visites de l\u2019année', visitsYear);
        add('Usagers uniques ayant visité', uniqueVisitors);
        lines.push('');
        lines.push('"Inclusion numérique"');
        add('Usagers publics vulnérables (CPAS/Orbem, mutuelle, intérim, Actiris)', vuln);
        add('Usagers seniors (65+)', seniors);
        lines.push('');
        lines.push('"Statuts sociaux (répartition)"');
        ADWDatabase.queryAll("SELECT social_status, COUNT(*) c FROM members WHERE social_status IS NOT NULL AND social_status != '' GROUP BY social_status ORDER BY c DESC").forEach(function (r) {
            add(r.social_status, r.c + ' (' + (total ? Math.round((r.c / total) * 100) : 0) + ' %)');
        });
        lines.push('');
        lines.push('"Codes postaux (top 10)"');
        ADWDatabase.queryAll("SELECT postal_code, COUNT(*) c FROM members WHERE postal_code IS NOT NULL AND postal_code != '' GROUP BY postal_code ORDER BY c DESC LIMIT 10").forEach(function (r) {
            add(r.postal_code, r.c);
        });
        lines.push('');
        lines.push('"Genres"');
        ADWDatabase.queryAll("SELECT gender, COUNT(*) c FROM members WHERE gender IS NOT NULL AND gender != '' GROUP BY gender").forEach(function (r) {
            add(r.gender, r.c);
        });

        var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'rapport-annuel-' + year + '-atelierduweb.csv';
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('📊 Rapport annuel ' + year + ' téléchargé');
    }

    function renderHeatmap() {
        var hm = document.getElementById('heatmap');
        if (!hm) return;
        var rows = ADWDatabase.queryAll(
            "SELECT visit_date, COUNT(*) c FROM visits WHERE visit_date >= date('now', '-83 days') GROUP BY visit_date");
        var byDay = {};
        rows.forEach(function (r) { byDay[r.visit_date] = r.c; });

        var max = 1;
        rows.forEach(function (r) { if (r.c > max) max = r.c; });

        var today = new Date();
        var todayDow = today.getDay();
        var start = new Date(today);
        start.setDate(start.getDate() - 83);
        while (start.getDay() !== 1) start.setDate(start.getDate() - 1);

        var frag = document.createDocumentFragment();
        var d = new Date(start);
        var todayIso = today.toISOString().slice(0, 10);
        while (d <= today) {
            var iso = d.toISOString().slice(0, 10);
            var c = byDay[iso] || 0;
            var lvl = c === 0 ? '' : (c <= max * 0.25 ? 'l1' : (c <= max * 0.5 ? 'l2' : (c <= max * 0.75 ? 'l3' : 'l4')));
            var cell = document.createElement('span');
            cell.className = 'heat-cell ' + lvl + (iso === todayIso ? ' today' : '');
            cell.title = d.toLocaleDateString('fr-BE') + ' : ' + c + ' visite' + (c > 1 ? 's' : '');
            frag.appendChild(cell);
            d.setDate(d.getDate() + 1);
        }
        hm.innerHTML = '';
        hm.appendChild(frag);
        hm.setAttribute('aria-label', 'Carte de chaleur de la fréquentation quotidienne sur 12 semaines');
    }

    function renderStatusDonut() {
        var donut = document.getElementById('statusDonut');
        var legend = document.getElementById('statusDonutLegend');
        if (!donut || !legend) return;
        var rows = ADWDatabase.queryAll(
            "SELECT social_status, COUNT(*) c FROM members WHERE social_status IS NOT NULL AND social_status != '' GROUP BY social_status ORDER BY c DESC");
        var total = 0;
        rows.forEach(function (r) { total += r.c; });
        if (!total) {
            donut.style.background = 'var(--bg)';
            legend.innerHTML = '<li class="form-hint">Renseignez les statuts sociaux pour voir la répartition.</li>';
            return;
        }
        var stops = [];
        var acc = 0;
        rows.forEach(function (r) {
            var from = (acc / total) * 100;
            acc += r.c;
            var to = (acc / total) * 100;
            var color = STATUS_COLORS[r.social_status] || '#95A5B8';
            stops.push(color + ' ' + from + '% ' + to + '%');
        });
        donut.style.background = 'conic-gradient(' + stops.join(', ') + ')';
        legend.innerHTML = rows.slice(0, 6).map(function (r) {
            var color = STATUS_COLORS[r.social_status] || '#95A5B8';
            return '<li><span class="donut-dot" style="background:' + color + '"></span>' +
                escapeHtml(STATUS_NAMES[r.social_status] || r.social_status) +
                ' <strong>' + Math.round((r.c / total) * 100) + ' %</strong></li>';
        }).join('');
    }

    function renderChart(mode) {
        chartMode = mode || chartMode;
        var chart = document.getElementById('visitsChart');
        if (!chart) return;
        var chartCard = document.getElementById('visitsChartCard');
        if (chartCard) chartCard.removeAttribute('hidden');
        if (chartDaysBtn) chartDaysBtn.classList.toggle('active', chartMode === 'days');
        if (chartMonthsBtn) chartMonthsBtn.classList.toggle('active', chartMode === 'months');

        var buckets = [];
        var now = new Date();
        var i, key, label;

        if (chartMode === 'days') {
            for (i = 13; i >= 0; i--) {
                var d = new Date(now);
                d.setDate(d.getDate() - i);
                key = d.toISOString().slice(0, 10);
                label = d.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit' });
                buckets.push({ key: key, label: label });
            }
            var rows = ADWDatabase.queryAll(
                'SELECT visit_date, COUNT(*) c FROM visits WHERE visit_date >= date(\'now\', \'-13 days\') GROUP BY visit_date');
            var byKey = {};
            rows.forEach(function (r) { byKey[r.visit_date] = r.c; });
            buckets.forEach(function (b) { b.count = byKey[b.key] || 0; });
        } else {
            for (i = 11; i >= 0; i--) {
                var m = new Date(now.getFullYear(), now.getMonth() - i, 1);
                key = m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0');
                label = m.toLocaleDateString('fr-BE', { month: 'short' });
                buckets.push({ key: key, label: label });
            }
            var rowsM = ADWDatabase.queryAll(
                'SELECT strftime(\'%Y-%m\', visit_date) ym, COUNT(*) c FROM visits ' +
                'WHERE visit_date >= date(\'now\', \'-11 months\', \'start of month\') GROUP BY ym');
            var byKeyM = {};
            rowsM.forEach(function (r) { byKeyM[r.ym] = r.c; });
            buckets.forEach(function (b) { b.count = byKeyM[b.key] || 0; });
        }

        var max = 1;
        buckets.forEach(function (b) { if (b.count > max) max = b.count; });

        chart.innerHTML = '';
        var frag = document.createDocumentFragment();
        buckets.forEach(function (b) {
            var col = document.createElement('div');
            col.className = 'chart-col';
            col.title = b.label + ' : ' + b.count + ' visite' + (b.count > 1 ? 's' : '');
            col.innerHTML =
                '<span class="chart-value">' + (b.count || '') + '</span>' +
                '<span class="chart-bar" style="height:' + Math.max(4, Math.round((b.count / max) * 100)) + '%"></span>' +
                '<span class="chart-label">' + escapeHtml(b.label) + '</span>';
            frag.appendChild(col);
        });
        chart.appendChild(frag);
    }

    // ===== Init =====
    window.ADWDatabase.init().then(function () {
        renderMembersStats();
        renderRetention();
        renderProfile();
        renderInclusion();
        renderStatusDonut();
        renderChart();
        renderHeatmap();

        if (chartDaysBtn) chartDaysBtn.addEventListener('click', function () { renderChart('days'); });
        if (chartMonthsBtn) chartMonthsBtn.addEventListener('click', function () { renderChart('months'); });
        if (annualReportBtn) annualReportBtn.addEventListener('click', buildAnnualReport);

        var cards = document.querySelectorAll('.stat-card, .kpi-card, .chart-card');
        cards.forEach(function (c) { c.removeAttribute('hidden'); });
        var loading = document.getElementById('dashLoading');
        if (loading) loading.hidden = true; // cacher le loader dans le chemin de SUCCES aussi
    }).catch(function (err) {
        var loading = document.getElementById('dashLoading');
        if (loading) loading.hidden = true;
        console.error('Erreur stats :', err);
    });
})();
