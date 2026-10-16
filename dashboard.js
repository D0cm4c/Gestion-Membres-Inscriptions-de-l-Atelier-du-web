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

        var cards = document.querySelectorAll('.stat-card, .kpi-grid');
        cards.forEach(function (c) { c.removeAttribute('hidden'); });
        if (loading) loading.hidden = true;

        var alertsList = document.getElementById('alertsList');
        if (alertsList) {
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

        var recentList = document.getElementById('recentVisits');
        if (recentList) {
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
                recentList.innerHTML = '<li class="form-hint">Aucune visite enregistrée — pointez une visite depuis la fiche d\'un membre.</li>';
            }
        }
    }

    ADWDatabase.init().then(render).catch(function (err) {
        if (loading) {
            loading.hidden = true;
            loading.querySelector('p').textContent = 'Erreur de chargement de la base de données : ' + err.message;
        }
    });
})();
