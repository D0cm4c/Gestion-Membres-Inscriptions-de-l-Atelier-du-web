(function () {
    'use strict';

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
        renderChart();
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

    function renderPrintsDue() {
        var list = document.getElementById('printsDueList');
        var totalEl = document.getElementById('printsDueTotal');
        var section = document.getElementById('printsDueSection');
        if (section) section.removeAttribute('hidden');
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

    ADWDatabase.init().then(render).catch(function (err) {
        if (loading) {
            loading.hidden = true;
            loading.querySelector('p').textContent = 'Erreur de chargement de la base de données : ' + err.message;
        }
    });
})();
