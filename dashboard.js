(function () {
    'use strict';

    var todayDateEl = document.getElementById('todayDate');
    if (todayDateEl) {
        todayDateEl.textContent = new Date().toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }

    /* ---------- Indicateur ouvert / fermé ---------- */
    var OPENING_HOURS = {
        1: [12.5, 17],   // lundi
        2: [9, 17],      // mardi
        3: [9, 17],      // mercredi
        4: [9, 17],      // jeudi
        5: [9, 12],      // vendredi
        6: [9.5, 12]     // samedi
    };

    function updateOpenStatus() {
        var el = document.getElementById('openStatus');
        if (!el) return;
        var now = new Date();
        var day = now.getDay();
        var t = now.getHours() + now.getMinutes() / 60;
        var hours = OPENING_HOURS[day];

        if (!hours) {
            el.className = 'open-status closed';
            el.textContent = '🔴 Fermé aujourd’hui';
            return;
        }
        var fmt = function (h) {
            var hh = Math.floor(h);
            var mm = Math.round((h - hh) * 60);
            return hh + 'h' + (mm ? String(mm).padStart(2, '0') : '');
        };
        if (t < hours[0]) {
            el.className = 'open-status closed';
            el.textContent = '🟡 Ouverture à ' + fmt(hours[0]);
        } else if (t < hours[1]) {
            el.className = 'open-status open';
            el.textContent = '🟢 Ouvert · ferme à ' + fmt(hours[1]);
        } else {
            el.className = 'open-status closed';
            el.textContent = '🔴 Fermé · réouvre demain';
        }
    }

    updateOpenStatus();
    setInterval(updateOpenStatus, 60000);



    var loading = document.getElementById('dashLoading');
    if (!loading) return;

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str == null ? '' : String(str);
        return div.innerHTML;
    }

    function one(sql, params, col) {
        var rows = ADWDatabase.queryAll(sql, params);
        if (!rows.length) return 0;
        return rows[0][col || 'v'];
    }

    function setText(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function showToast(message) {
        var toast = document.createElement('div');
        toast.className = 'toast toast-success visible';
        toast.setAttribute('role', 'status');
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(function () {
            toast.classList.remove('visible');
            setTimeout(function () { toast.remove(); }, 300);
        }, 2600);
    }

    /* ============ Stats ============ */

    function render() {
        var total = one('SELECT COUNT(*) v FROM members');
        var active = one('SELECT COUNT(*) v FROM members WHERE date(end_date) >= date(\'now\') OR end_date IS NULL');
        var expired = one('SELECT COUNT(*) v FROM members WHERE date(end_date) < date(\'now\') AND end_date IS NOT NULL');
        var monthly = one('SELECT COUNT(*) v FROM members WHERE subscription = \'monthly\'');
        var yearly = one('SELECT COUNT(*) v FROM members WHERE subscription = \'yearly\'');
        var newThisMonth = one('SELECT COUNT(*) v FROM members WHERE date(created_at) >= date(\'now\', \'start of month\')');
        var visitsToday = one('SELECT COUNT(*) v FROM visits WHERE visit_date = date(\'now\')');
        var visitsMonth = one('SELECT COUNT(*) v FROM visits WHERE strftime(\'%Y-%m\', visit_date) = strftime(\'%Y-%m\', \'now\')');
        var revenueMonth = one('SELECT COALESCE(SUM(amount), 0) v FROM visits WHERE strftime(\'%Y-%m\', visit_date) = strftime(\'%Y-%m\', \'now\')');

        setText('statTotal', total);
        setText('statActive', active);
        setText('statActive2', active);
        setText('statExpired', expired);
        setText('statMonthly', monthly);
        setText('statYearly', yearly);
        setText('statNewMonth', newThisMonth);
        setText('statVisitsToday', visitsToday);
        setText('statVisitsMonth', visitsMonth);
        var rev = document.getElementById('statRevenueMonth');
        if (rev) rev.textContent = revenueMonth.toFixed(2).replace('.', ',') + ' €';

        var activePct = total ? Math.round((active / total) * 100) : 0;
        setText('statActivePct', activePct + ' %');

        var lastVisit = one('SELECT MAX(visit_date) v FROM visits');
        setText('statLastVisit', lastVisit || '—');

        var cards = document.querySelectorAll('.stat-card, .kpi-grid, .chart-card');
        cards.forEach(function (c) { c.removeAttribute('hidden'); });
        if (loading) loading.hidden = true;

        renderAlerts(expired, visitsToday);
        renderRecentVisits();
        renderPrintsDue();
        renderAnalytics(visitsToday, monthly, yearly);
        renderChart();
        renderHeatmap();
        renderStatusDonut();
    }

    function renderAlerts(expired, visitsToday) {
        var alertsList = document.getElementById('alertsList');
        if (!alertsList) return;
        var alerts = [];
        if (expired > 0) {
            alerts.push({ text: expired + ' inscription' + (expired > 1 ? 's' : '') + ' expirée' + (expired > 1 ? 's' : '') + ' à renouveler', icon: '⚠️' });
        }
        var expiringSoon = one('SELECT COUNT(*) v FROM members WHERE date(end_date) BETWEEN date(\'now\') AND date(\'now\', \'+30 days\')');
        if (expiringSoon > 0) {
            alerts.push({ text: expiringSoon + ' inscription' + (expiringSoon > 1 ? 's' : '') + ' expire' + (expiringSoon > 1 ? 'nt' : '') + ' dans les 30 jours', icon: '⏳' });
        }
        if (visitsToday === 0) {
            alerts.push({ text: 'Aucune visite pointée aujourd\'hui', icon: '📌' });
        }
        if (alerts.length === 0) {
            alerts.push({ text: 'Tout est en ordre ✨', icon: '✅' });
        }
        alertsList.innerHTML = alerts.map(function (a) {
            return '<li><span aria-hidden="true">' + a.icon + '</span> ' + escapeHtml(a.text) + '</li>';
        }).join('');
    }

    function renderRecentVisits() {
        var recentList = document.getElementById('recentVisits');
        if (!recentList) return;
        var recent = ADWDatabase.queryAll(
            'SELECT v.visit_date, m.first_name, m.last_name, m.member_no, v.amount ' +
            'FROM visits v JOIN members m ON m.id = v.member_id ' +
            'ORDER BY v.visit_date DESC, v.created_at DESC LIMIT 6');
        if (recent.length) {
            recentList.innerHTML = recent.map(function (r) {
                var d = new Date(r.visit_date);
                var label = isNaN(d.getTime()) ? r.visit_date : d.toLocaleDateString('fr-BE');
                return '<li><span class="rv-name">#' + escapeHtml(r.member_no) + ' ' +
                    escapeHtml(r.first_name) + ' ' + escapeHtml(r.last_name) + '</span>' +
                    '<span class="rv-date">' + escapeHtml(label) + '</span>' +
                    '<span class="badge ' + (r.amount > 0 ? 'badge-sub-none' : 'badge-ok') + '">' +
                    (r.amount > 0 ? r.amount.toFixed(2).replace('.', ',') + ' €' : 'abo') + '</span></li>';
            }).join('');
        } else {
            recentList.innerHTML = '<li class="form-hint" style="list-style:none;padding:0.5rem 0;">Aucune visite enregistrée — pointez une visite depuis le bouton « ✅ Pointer une visite ».</li>';
        }
    }

    var PCS = 21;

    function eur(v) {
        return v.toFixed(2).replace('.', ',') + ' \u20AC';
    }

    function renderAnalytics(visitsToday, monthly, yearly) {
        var section = document.getElementById('analyticsSection');
        if (section) section.removeAttribute('hidden');

        /* --- 1. Occupation --- */
        var occPct = Math.min(100, Math.round((visitsToday / PCS) * 100));
        var ob = document.getElementById('occupancyBar');
        if (ob) {
            var segs = '';
            for (var i = 0; i < PCS; i++) {
                segs += '<span class="pc-seg' + (i < visitsToday ? ' busy' : '') + '" title="Poste ' + (i + 1) + (i < visitsToday ? ' : occup\u00e9' : ' : libre') + '"></span>';
            }
            ob.innerHTML = segs;
            ob.setAttribute('aria-label', visitsToday + ' postes occup\u00e9s sur ' + PCS + ' (' + occPct + ' %)');
        }
        setText('occupancyToday', visitsToday + ' / ' + PCS + ' postes occup\u00e9s (' + occPct + ' %)');
        var avg = one("SELECT COUNT(*) v FROM visits WHERE visit_date > date('now', '-7 days')");
        setText('occupancyHint', 'Moyenne 7 derniers jours : ' + Math.round(avg / 7) + ' visites/jour');

        /* --- 2. Rétention --- */
        var perMember = ADWDatabase.queryAll(
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

        /* --- 3. Profil socio-spatial --- */
        var byCp = ADWDatabase.queryAll(
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

        /* --- 3b. Nouveaux vs connus du jour --- */
        var todayFlux = ADWDatabase.queryAll(
            "SELECT v.member_id, (SELECT COUNT(*) FROM visits v2 WHERE v2.member_id = v.member_id AND v2.visit_date < v.visit_date) AS prior " +
            "FROM visits v WHERE v.visit_date = date('now')");
        var newToday = 0;
        todayFlux.forEach(function (r) { if (r.prior === 0) newToday++; });
        setText('fluxTotal', String(todayFlux.length));
        setText('fluxNew', newToday + (todayFlux.length ? ' (' + Math.round((newToday / todayFlux.length) * 100) + ' %)' : ''));
        setText('fluxKnown', String(todayFlux.length - newToday));
        setText('fluxHint', 'Chaque visite d\u2019un nouveau usager compte double : il d\u00e9couvre le service.');

        /* --- 4. Inclusion numérique (mission service public) --- */
        var totalM = one('SELECT COUNT(*) v FROM members');
        var vulnerable = one("SELECT COUNT(*) v FROM members WHERE social_status IN ('cpas', 'mutuelle', 'interim', 'actiris')");
        var cpasPart = one("SELECT COUNT(*) v FROM members WHERE social_status = 'cpas'");
        var noSub = one("SELECT COUNT(*) v FROM members WHERE subscription = 'none' OR subscription IS NULL");
        var pct = function (v) { return totalM ? Math.round((v / totalM) * 100) : 0; };
        setText('inclVulnerable', vulnerable + ' membres (' + pct(vulnerable) + ' %)');
        setText('inclCpas', pct(cpasPart) + ' %');
        setText('inclFree', noSub + ' membres (' + pct(noSub) + ' %)');
        setText('inclHint', 'CPAS/Orbem, mutuellistes, intérimaires et accompagnés Actiris : le public prioritaire de la médiation numérique.');
    }

    function renderPrintsDue() {
        var list = document.getElementById('printsDueList');
        var totalEl = document.getElementById('printsDueTotal');
        var card = document.getElementById('printsDueCard');
        if (card) card.removeAttribute('hidden');
        if (!list) return;
        var rows = ADWDatabase.queryAll(
            'SELECT m.id, m.first_name, m.last_name, m.member_no, ' +
            'COALESCE((SELECT SUM(amount) FROM prints p WHERE p.member_id = m.id AND paid = 0), 0) AS balance, ' +
            '(SELECT MAX(print_date) FROM prints p WHERE p.member_id = m.id AND paid = 0) AS last_print ' +
            'FROM members m ' +
            'WHERE (SELECT SUM(amount) FROM prints p WHERE p.member_id = m.id AND paid = 0) > 0 ' +
            'ORDER BY last_print DESC, balance DESC LIMIT 3');
        var total = one('SELECT COALESCE(SUM(amount), 0) v FROM prints WHERE paid = 0');
        var count = one('SELECT COUNT(DISTINCT member_id) v FROM prints WHERE paid = 0');

        if (rows.length) {
            list.innerHTML = rows.map(function (r) {
                var d = new Date(r.last_print);
                var label = isNaN(d.getTime()) ? r.last_print : d.toLocaleDateString('fr-BE');
                return '<li><span class="rv-name">#' + escapeHtml(r.member_no) + ' ' +
                    escapeHtml(r.first_name) + ' ' + escapeHtml(r.last_name) + '</span>' +
                    '<span class="rv-date">' + escapeHtml(label) + '</span>' +
                    '<span class="badge badge-sub-none">' + r.balance.toFixed(2).replace('.', ',') + ' €</span></li>';
            }).join('');
        } else {
            list.innerHTML = '<li class="form-hint" style="list-style:none;padding:0.5rem 0;">Aucune impression à solder ✨</li>';
        }
        if (totalEl) {
            totalEl.textContent = count > 0
                ? 'Total dû : ' + total.toFixed(2).replace('.', ',') + ' € (' + count + ' membre' + (count > 1 ? 's' : '') + ')'
                : 'Tout est réglé.';
        }
    }

    /* ============ Rapport annuel exportable ============ */

    var annualReportBtn = document.getElementById('annualReportBtn');

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

    if (annualReportBtn) annualReportBtn.addEventListener('click', buildAnnualReport);

    /* ============ Heatmap fréquentation (12 semaines) ============ */

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

    /* ============ Donut statuts sociaux ============ */

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
        etudiant: 'Étudiant', pensionne: 'Pensionné', mutuelle: 'Mutuelle',
        interim: 'Intérim', enfant: 'Enfant'
    };

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

    /* ============ Graphique des visites ============ */

    var chartDaysBtn = document.getElementById('chartDaysBtn');
    var chartMonthsBtn = document.getElementById('chartMonthsBtn');
    var chartMode = 'days';

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

    if (chartDaysBtn) chartDaysBtn.addEventListener('click', function () { renderChart('days'); });
    if (chartMonthsBtn) chartMonthsBtn.addEventListener('click', function () { renderChart('months'); });

    /* ============ Check-in rapide ============ */

    var checkinModal = document.getElementById('checkinModal');
    var quickCheckinBtn = document.getElementById('quickCheckinBtn');
    var checkinCloseBtn = document.getElementById('checkinCloseBtn');
    var checkinSearch = document.getElementById('checkinSearch');
    var checkinResults = document.getElementById('checkinResults');
    var checkinHint = document.getElementById('checkinHint');

    var CHECKIN_SQL = 'SELECT id, first_name, last_name, member_no, subscription, ' +
        '(SELECT COUNT(*) FROM visits v WHERE v.member_id = members.id AND v.visit_date = date(\'now\')) AS visited_today, ' +
        '(SELECT COALESCE(SUM(amount), 0) FROM prints p WHERE p.member_id = members.id AND paid = 0) AS print_balance ' +
        'FROM members';

    function searchMembers(q) {
        q = (q || '').trim().toLowerCase();
        if (/^\d+$/.test(q)) {
            return ADWDatabase.queryAll(CHECKIN_SQL + ' WHERE CAST(member_no AS TEXT) LIKE ? ORDER BY member_no LIMIT 8', ['%' + q + '%']);
        }
        if (q) {
            return ADWDatabase.queryAll(CHECKIN_SQL + ' WHERE lower(first_name || \' \' || last_name) LIKE ? ORDER BY last_name COLLATE NOCASE LIMIT 8', ['%' + q + '%']);
        }
        return ADWDatabase.queryAll(CHECKIN_SQL + ' ORDER BY last_name COLLATE NOCASE LIMIT 8');
    }

    function openCheckin() {
        if (!checkinModal) return;
        checkinModal.hidden = false;
        if (checkinSearch) {
            checkinSearch.value = '';
            checkinSearch.focus();
        }
        displayCheckinResults(searchMembers(''));
    }

    function closeCheckin() {
        if (checkinModal) checkinModal.hidden = true;
    }

    function displayCheckinResults(members) {
        if (!checkinResults) return;
        checkinResults.innerHTML = '';
        if (!members.length) {
            checkinResults.innerHTML = '<li class="form-hint" style="list-style:none;padding:0.6rem 0;">Aucun membre trouvé.</li>';
            return;
        }
        members.forEach(function (m) {
            var li = document.createElement('li');
            li.className = 'checkin-item' + (m.visited_today ? ' done' : '');
            li.innerHTML =
                '<span class="member-avatar small" aria-hidden="true">' +
                    escapeHtml(((m.first_name || '?').charAt(0) + (m.last_name || '?').charAt(0)).toUpperCase()) +
                '</span>' +
                '<span class="rv-name">#' + escapeHtml(m.member_no) + ' ' + escapeHtml(m.first_name) + ' ' + escapeHtml(m.last_name) + '</span>' +
                (m.visited_today
                    ? '<span class="badge badge-ok">✓ déjà pointé</span>'
                    : (m.subscription !== 'none'
                        ? '<span class="badge badge-sub-yearly">abo</span>'
                        : '<span class="badge badge-sub-none">1 €</span>'));

            li.addEventListener('click', function () { doCheckin(m); });
            checkinResults.appendChild(li);
        });
    }

    function doCheckin(member) {
        if (member.visited_today) return;
        var today = new Date().toISOString().slice(0, 10);
        var amount = member.subscription === 'none' ? 1 : 0;
        var visitId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        ADWDatabase.run('INSERT INTO visits (id, member_id, visit_date, amount) VALUES (?, ?, ?, ?)',
            [visitId, member.id, today, amount]).then(function () {
            closeCheckin();
            render();
            renderChart();
            showToast('✅ Visite de ' + member.first_name + ' pointée' + (amount ? ' (1 €)' : ' (incluse abonnement)'));
        });
    }

    if (quickCheckinBtn) quickCheckinBtn.addEventListener('click', openCheckin);
    if (checkinCloseBtn) checkinCloseBtn.addEventListener('click', closeCheckin);
    if (checkinModal) checkinModal.addEventListener('click', function (e) {
        if (e.target === checkinModal) closeCheckin();
    });
    if (checkinSearch) checkinSearch.addEventListener('input', function () {
        displayCheckinResults(searchMembers(checkinSearch.value));
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && checkinModal && !checkinModal.hidden) closeCheckin();
    });

    /* ============ Impression rapide ============ */

    var printModal = document.getElementById('printModal');
    var quickPrintBtn = document.getElementById('quickPrintBtn');
    var printCloseBtn = document.getElementById('printCloseBtn');
    var printSearch = document.getElementById('printSearch');
    var printResults = document.getElementById('printResults');

    function openPrint() {
        if (!printModal) return;
        printModal.hidden = false;
        if (printSearch) {
            printSearch.value = '';
            printSearch.focus();
        }
        displayPrintResults(searchMembers(''));
    }

    function closePrint() {
        if (printModal) printModal.hidden = true;
    }

    function displayPrintResults(members) {
        if (!printResults) return;
        printResults.innerHTML = '';
        if (!members.length) {
            printResults.innerHTML = '<li class="form-hint" style="list-style:none;padding:0.6rem 0;">Aucun membre trouvé.</li>';
            return;
        }
        members.forEach(function (m) {
            var li = document.createElement('li');
            li.className = 'checkin-item';
            li.innerHTML =
                '<span class="member-avatar small" aria-hidden="true">' +
                    escapeHtml(((m.first_name || '?').charAt(0) + (m.last_name || '?').charAt(0)).toUpperCase()) +
                '</span>' +
                '<span class="rv-name">#' + escapeHtml(m.member_no) + ' ' + escapeHtml(m.first_name) + ' ' + escapeHtml(m.last_name) + '</span>' +
                (m.print_balance > 0
                    ? '<span class="badge badge-sub-none">' + m.print_balance.toFixed(2).replace('.', ',') + ' € dus</span>'
                    : '') +
                '<span class="print-actions-btns">' +
                    '<button type="button" class="btn btn-secondary btn-small" data-print="bw">+ N&B (0,10 €)</button>' +
                    '<button type="button" class="btn btn-secondary btn-small" data-print="color">+ Couleur (0,50 €)</button>' +
                '</span>';

            li.querySelectorAll('[data-print]').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var type = btn.getAttribute('data-print');
                    var amount = type === 'bw' ? 0.10 : 0.50;
                    var today = new Date().toISOString().slice(0, 10);
                    var printId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
                    ADWDatabase.run('INSERT INTO prints (id, member_id, print_date, type, amount, paid) VALUES (?, ?, ?, ?, ?, 0)',
                        [printId, m.id, today, type, amount]).then(function () {
                        render();
                        renderChart();
                        showToast('🖨️ Impression ' + (type === 'bw' ? 'N&B' : 'couleur') + ' pour ' + m.first_name + ' (' + amount.toFixed(2).replace('.', ',') + ' €)');
                        displayPrintResults(searchMembers(printSearch ? printSearch.value : ''));
                    });
                });
            });
            printResults.appendChild(li);
        });
    }

    if (quickPrintBtn) quickPrintBtn.addEventListener('click', openPrint);
    if (printCloseBtn) printCloseBtn.addEventListener('click', closePrint);
    if (printModal) printModal.addEventListener('click', function (e) {
        if (e.target === printModal) closePrint();
    });
    if (printSearch) printSearch.addEventListener('input', function () {
        displayPrintResults(searchMembers(printSearch.value));
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && printModal && !printModal.hidden) closePrint();
    });

    /* ---------- Drag'n'drop de la mosaïque ---------- */

    var TILE_ORDER_KEY = 'atelierduweb_tile_order';

    function initTileDrag() {
        var mosaic = document.getElementById('dashboardMosaic');
        if (!mosaic) return;
        var tiles = mosaic.querySelectorAll('[data-tile]');
        if (!tiles.length) return;

        var saved = null;
        try { saved = JSON.parse(localStorage.getItem(TILE_ORDER_KEY)) || []; } catch (e) { /* best effort */ }

        // masquer les tuiles désactivées dans Paramètres
        var hiddenTiles = [];
        try { hiddenTiles = JSON.parse(localStorage.getItem('atelierduweb_tiles_hidden')) || []; } catch (e) { /* best effort */ }
        tiles.forEach(function (tile) {
            if (hiddenTiles.indexOf(tile.getAttribute('data-tile')) !== -1) {
                tile.style.display = 'none';
            }
        });

        // apply saved order
        if (saved.length) {
            saved.forEach(function (tid) {
                var el = mosaic.querySelector('[data-tile="' + tid + '"]');
                if (el) mosaic.appendChild(el);
            });
        }

        mosaic._dragTile = null;

        tiles.forEach(function (tile) {
            tile.setAttribute('draggable', 'true');

            tile.addEventListener('dragstart', function (e) {
                mosaic._dragTile = tile;
                tile.classList.add('tile-dragging');
                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                    try { e.dataTransfer.setData('text/plain', tile.getAttribute('data-tile')); } catch (err) { /* IE */ }
                }
            });

            tile.addEventListener('dragend', function () {
                tile.classList.remove('tile-dragging');
                mosaic.querySelectorAll('.tile-drop-target').forEach(function (t) { t.classList.remove('tile-drop-target'); });
                mosaic._dragTile = null;
                saveTileOrder(mosaic);
            });

            tile.addEventListener('dragover', function (e) {
                e.preventDefault();
                if (!mosaic._dragTile || mosaic._dragTile === tile) return;
                tile.classList.add('tile-drop-target');
            });

            tile.addEventListener('dragleave', function () {
                tile.classList.remove('tile-drop-target');
            });

            tile.addEventListener('drop', function (e) {
                e.preventDefault();
                if (!mosaic._dragTile || mosaic._dragTile === tile) return;
                tile.classList.remove('tile-drop-target');
                var rect = tile.getBoundingClientRect();
                var before = (e.clientX - rect.left) < rect.width / 2;
                mosaic.insertBefore(mosaic._dragTile, before ? tile : tile.nextSibling);
            });
        });

        // Drop aussi sur la grille elle-même (zones vides) :
        // la tuile est insérée à l'emplacement le plus proche du curseur.
        mosaic.addEventListener('dragover', function (e) {
            e.preventDefault();
        });

        mosaic.addEventListener('drop', function (e) {
            e.preventDefault();
            var dragTile = mosaic._dragTile;
            if (!dragTile) return;
            if (e.target !== mosaic) return; // le drop sur une tuile est déjà géré
            var tilesArr = Array.prototype.slice.call(mosaic.querySelectorAll('[data-tile]'));
            if (!tilesArr.length) { mosaic.appendChild(dragTile); return; }
            var best = null;
            var bestDist = Infinity;
            tilesArr.forEach(function (t) {
                if (t === dragTile) return;
                var r = t.getBoundingClientRect();
                var cx = r.left + r.width / 2;
                var cy = r.top + r.height / 2;
                var d = (e.clientX - cx) * (e.clientX - cx) + (e.clientY - cy) * (e.clientY - cy);
                if (d < bestDist) { bestDist = d; best = t; }
            });
            if (!best) { mosaic.appendChild(dragTile); return; }
            var r = best.getBoundingClientRect();
            var after = (e.clientX - r.left) > r.width / 2;
            mosaic.insertBefore(dragTile, after ? best.nextSibling : best);
        });
    }

    function saveTileOrder(mosaic) {
        var order = [];
        mosaic.querySelectorAll('[data-tile]').forEach(function (t) {
            order.push(t.getAttribute('data-tile'));
        });
        try { localStorage.setItem(TILE_ORDER_KEY, JSON.stringify(order)); } catch (e) { /* best effort */ }
    }

    initTileDrag();

    ADWDatabase.init().then(render).catch(function (err) {
        if (loading) {
            loading.hidden = true;
            loading.querySelector('p').textContent = 'Erreur de chargement de la base de données : ' + err.message;
        }
    });
})();
