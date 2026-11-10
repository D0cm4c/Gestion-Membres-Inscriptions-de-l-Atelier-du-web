(function () {
    'use strict';

    // Page Tableau de bord (index.html) : KPI temps réel, agenda du jour, alertes,
    // analyses croisées, usagers du jour, rapport annuel, mosaïque de tuiles (drag'n'drop).

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

    var MOBILE = window.matchMedia('(max-width: 860px)');

    function updateOpenStatus() {
        var el = document.getElementById('openStatus');
        if (!el) return;
        var now = new Date();
        var day = now.getDay();
        var t = now.getHours() + now.getMinutes() / 60;
        var hours = OPENING_HOURS[day];
        var short = MOBILE.matches;

        if (!hours) {
            el.className = 'open-status closed';
            el.textContent = '🔴 Fermé';
            el.title = 'Fermé aujourd’hui';
            return;
        }
        var fmt = function (h) {
            var hh = Math.floor(h);
            var mm = Math.round((h - hh) * 60);
            return hh + 'h' + (mm ? String(mm).padStart(2, '0') : '');
        };
        if (t < hours[0]) {
            el.className = 'open-status closed';
            el.textContent = short ? '🟡 ' + fmt(hours[0]) : '🟡 Ouverture à ' + fmt(hours[0]);
            el.title = 'Ouverture à ' + fmt(hours[0]);
        } else if (t < hours[1]) {
            el.className = 'open-status open';
            el.textContent = short ? '🟢 Ouvert' : '🟢 Ouvert · ferme à ' + fmt(hours[1]);
            el.title = 'Ouvert · ferme à ' + fmt(hours[1]);
        } else {
            el.className = 'open-status closed';
            el.textContent = short ? '🔴 Fermé' : '🔴 Fermé · réouvre demain';
            el.title = 'Fermé · réouvre demain';
        }
    }

    if (MOBILE.addEventListener) {
        MOBILE.addEventListener('change', updateOpenStatus);
    } else if (MOBILE.addListener) {
        MOBILE.addListener(updateOpenStatus);
    }

    updateOpenStatus();
    setInterval(updateOpenStatus, 60000);



    var loading = document.getElementById('dashLoading');
    if (!loading) return;

    function escapeHtml(str) { return window.ADWEscape.html(str); }

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

    // ============ Agenda du jour ============
    function isoLocal(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function toneFor(name) {
        var str = (name || '').toLowerCase();
        var h = 0;
        for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
        return h % 10;
    }
    var TONE_SOLID = ['#0F3D5C', '#6C5CE7', '#2F9BE4', '#18A55F', '#E8734A', '#B26A00', '#D8434B', '#7A5230', '#556B2F', '#4A4E69'];

    function renderTodayAgenda() {
        var el = document.getElementById('todayAgenda');
        if (!el) return;
        var today = isoLocal(new Date());
        var rows;
        try {
            rows = ADWDatabase.queryAll(
                'SELECT f.title, f.event_id, f.time_label, f.categories, f.room_id, fd.slot, ' +
                '(SELECT name FROM rooms r WHERE r.id = f.room_id) AS room_name, ' +
                '(SELECT COUNT(*) FROM formations_members fm WHERE fm.formation_id = f.id) AS attendee_count ' +
                'FROM formation_dates fd JOIN formations f ON f.id = fd.formation_id ' +
                'WHERE fd.date = ? ORDER BY fd.slot ASC, f.title ASC', [today]);
        } catch (e) { rows = []; }
        if (!rows.length) {
            // Journée calme : carte discrète plutôt qu'un trou
            el.innerHTML = '<div class="stat-card today-agenda" style="margin-bottom:1.3rem;opacity:0.75;">' +
                '<h3>\ud83d\udcc6 Aujourd\u2019hui \u00e0 l\u2019Atelier</h3>' +
                '<p class="form-hint" style="margin:0;">Aucune formation programm\u00e9e aujourd\u2019hui \u2014 journ\u00e9e calme \ud83c\udf3f</p></div>';
            el.hidden = false;
            return;
        }
        var html = '<div class="stat-card today-agenda" style="margin-bottom:1.3rem;">' +
            '<h3>📆 Aujourd\u2019hui à l\u2019Atelier <span class="members-count">' + rows.length + ' formation' + (rows.length > 1 ? 's' : '') + '</span></h3>' +
            '<div class="agenda-list">';
        rows.forEach(function (f) {
            var mainCat = (f.categories || '').split(',').map(function (c) { return c.trim(); }).filter(function (c) { return c && !/^\d+$/.test(c); })[0] || '';
            var tone = mainCat ? toneFor(mainCat) : -1;
            var bg = tone >= 0 ? TONE_SOLID[tone] : 'var(--primary)';
            html += '<a class="agenda-item" href="formation.html?id=' + encodeURIComponent(f.event_id) + '" style="text-decoration:none;">' +
                '<span class="agenda-slot ' + (f.slot === 'AM' ? 'am' : 'pm') + '">' + (f.slot === 'AM' ? 'Matin' : 'A-midi') + '</span>' +
                '<span class="agenda-bar" style="background:' + bg + ';"></span>' +
                '<span class="agenda-title">' + escapeHtml(f.title) + '</span>' +
                (f.time_label ? '<span class="agenda-time">' + escapeHtml(f.time_label) + '</span>' : '') +
                '<span class="agenda-count' + (f.attendee_count ? ' has-attendees' : '') + '">' + f.attendee_count + ' inscrit' + (f.attendee_count > 1 ? 's' : '') + '</span>' +
                (f.room_name ? '<span class="agenda-room">' + escapeHtml(f.room_name) + '</span>' : '<span class="badge badge-full">sans salle</span>') +
                '</a>';
        });
        html += '</div></div>';
        el.innerHTML = html;
        el.hidden = false;
    }

    // Formations les plus attendues : le classement des listes d'attente (dashboard)
    function renderMostWaited() {
        var el = document.getElementById('mostWaited');
        if (!el) return;
        var rows = [];
        try { rows = ADWDatabase.getMostWaitedFormations(5) || []; } catch (e) { rows = []; }
        if (!rows.length) { el.hidden = true; return; }
        var total = rows.reduce(function (s, r) { return s + r.waiting; }, 0);
        var html = '<div class="stat-card today-agenda" style="margin-bottom:1.3rem;">' +
            '<h3>\u{1F3AF} Les formations les plus attendues <span class="members-count">' + total + ' en attente</span></h3>' +
            '<div class="agenda-list">';
        rows.forEach(function (r, i) {
            html += '<a class="agenda-item" href="' + (r.event_id
                ? 'formation.html?id=' + encodeURIComponent(r.event_id)
                : 'formations.html') + '" style="text-decoration:none;">' +
                '<span class="mw-rank">' + (i + 1) + '</span>' +
                '<span class="agenda-title">' + escapeHtml(r.title) + '</span>' +
                '<span class="agenda-count has-attendees">' + r.waiting + ' en attente' +
                (r.contacted ? ' \u00b7 ' + r.contacted + ' contact\u00e9' + (r.contacted > 1 ? 's' : '') : '') +
                '</span>' +
                '</a>';
        });
        html += '</div></div>';
        el.innerHTML = html;
        el.hidden = false;
    }

    // 3 dernières notifications (dashboard) — aperçu du centre, lien vers notifications.html
    function renderLastNotifs() {
        var el = document.getElementById('lastNotifs');
        if (!el) return;
        var items = [];
        try { items = ADWDatabase.listNotifications(3) || []; } catch (e) { items = []; }
        if (!items.length) { el.hidden = true; return; }
        function ago(iso) {
            if (!iso) return '';
            try {
                var d = new Date(String(iso).replace(' ', 'T') + (String(iso).indexOf('Z') === -1 ? 'Z' : ''));
                var mins = Math.round((Date.now() - d.getTime()) / 60000);
                if (isNaN(mins)) return '';
                if (mins < 1) return 'a l\u2019instant';
                if (mins < 60) return 'il y a ' + mins + ' min';
                var h = Math.round(mins / 60);
                if (h < 24) return 'il y a ' + h + ' h';
                return 'il y a ' + Math.round(h / 24) + ' j';
            } catch (e2) { return ''; }
        }
        function icoOf(n) {
            return n.severity === 'success' ? '✅' : n.severity === 'warning' ? '⚠️' : n.severity === 'danger' ? '❌' : 'ℹ️';
        }
        var html = '<div class="stat-card today-agenda" style="margin-bottom:1.3rem;">' +
            '<h3>🔔 Derni\u00e8res notifications <a href="notifications.html" class="btn btn-secondary btn-small" style="margin-left:auto;font-size:0.72rem;">Tout voir \u2192</a></h3>' +
            '<div class="agenda-list">';
        items.forEach(function (n) {
            var msg = n.message || '';
            if (msg.length > 110) msg = msg.slice(0, 107) + '\u2026';
            html += '<a class="agenda-item" href="notifications.html" style="text-decoration:none;">' +
                '<span class="notif-ico sev-' + escapeHtml(n.severity) + '">' + icoOf(n) + '</span>' +
                '<span class="agenda-title" style="flex:1;min-width:0;">' + escapeHtml(msg) + '</span>' +
                '<span class="form-hint" style="white-space:nowrap;">' + ago(n.created_at) + '</span>' +
                '</a>';
        });
        html += '</div></div>';
        el.innerHTML = html;
        el.hidden = false;
    }

    function render() {
        renderTodayAgenda();
        renderMostWaited();
        renderLastNotifs();

        var visitsToday = one('SELECT COUNT(*) v FROM visits WHERE visit_date = date(\'now\')');
        var visitsMonth = one('SELECT COUNT(*) v FROM visits WHERE strftime(\'%Y-%m\', visit_date) = strftime(\'%Y-%m\', \'now\')');
        setText('statVisitsToday', visitsToday);
        setText('statVisitsMonth', visitsMonth);

        var ticketsEl = document.getElementById('statTicketsOpen');
        if (ticketsEl) {
            var openT = 0, urgentT = 0, unassignedT = 0;
            try { openT = one('SELECT COUNT(*) v FROM tickets WHERE status IN (\'open\', \'in_progress\')'); } catch (e) { /* table absente : 0 */ }
            try { urgentT = one('SELECT COUNT(*) v FROM tickets WHERE status IN (\'open\', \'in_progress\') AND priority = \'urgent\''); } catch (e) {}
            try { unassignedT = one('SELECT COUNT(*) v FROM tickets WHERE status IN (\'open\', \'in_progress\') AND priority = \'urgent\' AND (assignee IS NULL OR assignee = \'\')'); } catch (e) {}
            ticketsEl.textContent = openT;
            ticketsEl.title = openT + ' incident(s) ouvert(s)' +
                (urgentT ? ' \u2014 dont ' + urgentT + ' urgent(s)' : '') +
                (unassignedT ? ' (' + unassignedT + ' non assign\u00e9(s))' : '');
        }

        var lastVisit = one('SELECT MAX(visit_date) v FROM visits');
        setText('statLastVisit', lastVisit || '\u2014');

        var cards = document.querySelectorAll('.stat-card, .kpi-grid, .chart-card');
        cards.forEach(function (c) { c.removeAttribute('hidden'); });
        if (loading) loading.hidden = true;

        renderFlux();
        renderRecentVisits();
        renderPrintsDue();
    }

    // Nouveaux vs connus du jour (extrait de l'ancienne renderAnalytics — reste au dashboard)
    function renderFlux() {
        var todayFlux = ADWDatabase.queryAll(
            "SELECT v.member_id, (SELECT COUNT(*) FROM visits v2 WHERE v2.member_id = v.member_id AND v2.visit_date < v.visit_date) AS prior " +
            "FROM visits v WHERE v.visit_date = date('now')");
        var newToday = 0;
        todayFlux.forEach(function (r) { if (r.prior === 0) newToday++; });
        setText('fluxTotal', String(todayFlux.length));
        setText('fluxNew', newToday + (todayFlux.length ? ' (' + Math.round((newToday / todayFlux.length) * 100) + ' %)' : ''));
        setText('fluxKnown', String(todayFlux.length - newToday));
        setText('fluxHint', 'Chaque visite d\u2019un nouveau usager compte double : il d\u00e9couvre le service.');
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



    /* ============ Heatmap fréquentation (12 semaines) ============ */



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



    /* ============ Check-in rapide ============ */


    /* ---------- Navigation clavier des listes de recherche (visites/impressions) ---------- */
    function makeListNavigable(searchInput, resultsEl, opts) {
        // opts.onEnter(itemEl, members, activeIndex, subAction) — valide la ligne ;
        // opts.subActions : liste de selecteurs de sous-boutons (navigation gauche/droite + Entr\u00e9e sur le bouton focus).
        var state = { activeIndex: -1, subIndex: -1, members: [] };
        function items() { return resultsEl.querySelectorAll('li.checkin-item'); }
        function setActive(idx, subIdx) {
            state.activeIndex = idx;
            state.subIndex = (subIdx === undefined ? -1 : subIdx);
            var els = items();
            els.forEach(function (el, i) {
                el.classList.toggle('bk-active', i === state.activeIndex);
            });
            if (state.activeIndex >= 0 && els[state.activeIndex]) {
                els[state.activeIndex].scrollIntoView({ block: 'nearest' });
            }
        }
        searchInput.addEventListener('keydown', function (e) {
            var els = items();
            if (!els.length) return;
            var max = els.length - 1;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive(state.activeIndex < 0 ? 0 : Math.min(state.activeIndex + 1, max));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive(state.activeIndex <= 0 ? 0 : state.activeIndex - 1);
            } else if (e.key === 'ArrowRight' && opts.subActions && state.activeIndex >= 0) {
                e.preventDefault();
                var btns = els[state.activeIndex].querySelectorAll(opts.subActions);
                state.subIndex = Math.min(state.subIndex + 1, btns.length - 1);
                btns.forEach(function (b, i) { b.classList.toggle('bk-active', i === state.subIndex); });
            } else if (e.key === 'ArrowLeft' && opts.subActions && state.activeIndex >= 0) {
                e.preventDefault();
                var btns = els[state.activeIndex].querySelectorAll(opts.subActions);
                state.subIndex = Math.max(state.subIndex - 1, -1);
                btns.forEach(function (b, i) { b.classList.toggle('bk-active', i === state.subIndex); });
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (state.activeIndex >= 0 && state.members[state.activeIndex]) {
                    var el = els[state.activeIndex];
                    var subBtn = state.subIndex >= 0 ? el.querySelectorAll(opts.subActions)[state.subIndex] : null;
                    if (subBtn) { subBtn.click(); }
                    else { el.click(); }
                }
            }
        });
        searchInput.addEventListener('input', function () { setActive(-1); });
        return {
            setMembers: function (members) { state.members = members || []; setActive(state.members.length ? 0 : -1); },
            state: state
        };
    }

    var checkinModal = document.getElementById('checkinModal');
    var quickCheckinBtn = document.getElementById('quickCheckinBtn');
    var checkinCloseBtn = document.getElementById('checkinCloseBtn');
    var checkinSearch = document.getElementById('checkinSearch');
    var checkinResults = document.getElementById('checkinResults');
    var checkinHint = document.getElementById('checkinHint');
    var checkinNav = (checkinSearch && checkinResults) ? makeListNavigable(checkinSearch, checkinResults, {}) : null;

    var CHECKIN_SQL = 'SELECT id, first_name, last_name, member_no, subscription, end_date, ' +
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


    // Classe de statut pour la vignette (même code couleur que membres.html — décision EPN :
    // vert = actif, rouge = expiré, gris foncé = inactif)
    function statusClass(m) {
        if ((m.subscription || 'none') === 'none') return ' inactive';
        var today = new Date().toISOString().slice(0, 10);
        if (m.end_date && m.end_date < today) return ' expired';
        return '';
    }

    function displayCheckinResults(members) {
        if (!checkinResults) return;
        checkinResults.innerHTML = '';
        if (!members.length) {
            checkinResults.innerHTML = '<li class="form-hint" style="list-style:none;padding:0.6rem 0;">Aucun membre trouvé.</li>';
            return;
        }
        if (checkinNav) checkinNav.setMembers(members);
        members.forEach(function (m) {
            var li = document.createElement('li');
            li.className = 'checkin-item' + statusClass(m) + (m.visited_today ? ' done' : '');
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
            pulseVisitsKpi();
            showToast('✅ Visite de ' + member.first_name + ' pointée' + (amount ? ' (1 €)' : ' (incluse abonnement)'));
        });
    }


    // Design v4 : pulse du KPI Visites après un pointage (récompense visuelle du geste)
    function pulseVisitsKpi() {
        var kpi = document.querySelector('.kpi-card[data-tile="kpi2"]');
        if (!kpi) return;
        kpi.classList.remove('kpi-pulse');
        void kpi.offsetWidth; // reflow pour relancer l'animation
        kpi.classList.add('kpi-pulse');
    }
    if (quickCheckinBtn) quickCheckinBtn.addEventListener('click', openCheckin);

    // Visite anonyme : passage sans fiche membre — compteur simple à 1 EUR (décision utilisateur).
    // member_id sentinel 'anon' (colonne NOT NULL) — comptée dans les stats visites/revenus.
    var anonVisitBtn = document.getElementById('anonVisitBtn');
    if (anonVisitBtn) anonVisitBtn.addEventListener('click', function () {
        var today = new Date().toISOString().slice(0, 10);
        var visitId = 'av-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        window.ADWDatabase.run('INSERT INTO visits (id, member_id, visit_date, amount) VALUES (?, ?, ?, ?)',
            [visitId, 'anon', today, 1.0]).then(function () {
            if (window.ADWNotifications) window.ADWNotifications.push('anon_visit', '👤 Visite anonyme enregistrée (1 €)', 'success');
            closeCheckin();
            render();
            pulseVisitsKpi();
        });
    });
    // Raccourci A : visible seulement modale ouverte (sinon A en saisie libre serait piégé)
    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if ((e.key || '').toLowerCase() !== 'a') return;
        if (!checkinModal || checkinModal.hidden) return;
        // Si l'utilisateur tape dans le champ de recherche, « a » est une lettre, pas un raccourci
        var active = document.activeElement;
        var typing = active && (active.id === 'checkinSearch' || (active.tagName || '').toLowerCase() === 'input');
        if (typing) return;
        e.preventDefault();
        anonVisitBtn.click();
    });
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
    var printNav = (printSearch && printResults) ? makeListNavigable(printSearch, printResults, { subActions: '[data-print]' }) : null;

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
        if (printNav) printNav.setMembers(members);
        if (!members.length) {
            printResults.innerHTML = '<li class="form-hint" style="list-style:none;padding:0.6rem 0;">Aucun membre trouvé.</li>';
            return;
        }
        members.forEach(function (m) {
            var li = document.createElement('li');
            li.className = 'checkin-item' + statusClass(m);
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
