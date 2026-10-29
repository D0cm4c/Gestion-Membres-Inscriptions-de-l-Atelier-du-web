    (function () {
        'use strict';

        var loading = document.getElementById('loadingState');
        var content = document.getElementById('memberContent');
        var notFound = document.getElementById('notFoundState');
        var pageTitle = document.getElementById('pageTitle');

        document.getElementById('todayDate').textContent = new Date().toLocaleDateString('fr-BE', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });

        function esc(s) { return window.ADWEscape.html(s); }
        function formatDate(v) {
            if (!v) return '—';
            var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (!m) return v;
            return m[3] + '/' + m[2] + '/' + m[1];
        }

        var GENDER_LABELS = { F: 'Femme', M: 'Homme', X: 'Autre / Non-binaire' };
        var STATUS_LABELS = {
            travailleur: 'Travailleur.se', interim: 'Intérim', actiris: 'Actiris',
            mutuelle: 'Mutuelle', cpas: 'CPAS', pensionne: 'Pensionné.e',
            etudiant: 'Étudiant.e', enfant: 'Enfant'
        };
        var SUB_LABELS = {
            none: { label: 'Aucun abo', badge: 'badge-sub-none' },
            monthly: { label: 'Abo mensuel · 3 €', badge: 'badge-sub-monthly' },
            yearly: { label: 'Abo annuel · 30 €', badge: 'badge-sub-yearly' }
        };

        function isExpired(m) {
            if (!m.end_date) return false;
            return m.end_date < new Date().toISOString().slice(0, 10);
        }

        // Mini-dashboard : KPI compacts pour cibler l'aide (visites, formations, solde)
        function memberKpis(member, visits, formations) {
            var today = new Date();
            var todayStr = today.toISOString().slice(0, 10);
            var monthStr = todayStr.slice(0, 7);
            var visitsMonth = 0;
            try {
                visitsMonth = (window.ADWDatabase.queryAll(
                    'SELECT COUNT(*) c FROM visits WHERE member_id = ? AND strftime(\'%Y-%m\', visit_date) = ?',
                    [member.id, monthStr])[0] || {}).c || 0;
            } catch (e) { visitsMonth = 0; }

            // Dernière visite en délai humain
            var lastVisit = null;
            try {
                lastVisit = (window.ADWDatabase.queryAll(
                    'SELECT MAX(visit_date) d FROM visits WHERE member_id = ?', [member.id])[0] || {}).d || null;
            } catch (e) { lastVisit = null; }
            var lastVisitLabel;
            if (!lastVisit) lastVisitLabel = 'jamais';
            else {
                var days = Math.round((today - new Date(lastVisit + 'T00:00:00')) / 86400000);
                lastVisitLabel = days <= 0 ? 'aujourd\'hui' :
                    days === 1 ? 'hier' :
                    days < 31 ? 'il y a ' + days + ' j' :
                    'il y a ' + Math.round(days / 30) + ' mois';
            }

            var todayStr2 = todayStr;
            var past = formations.filter(function (f) { return f.start_date && f.start_date < todayStr2; }).length;
            var upcoming = formations.filter(function (f) { return f.start_date && f.start_date >= todayStr2; }).length;
            var balance = member.print_balance || 0;

            function kpi(icon, num, label, cls) {
                return '<div class="mkpi' + (cls ? ' ' + cls : '') + '">' +
                    '<span class="mkpi-icon" aria-hidden="true">' + icon + '</span>' +
                    '<span class="mkpi-num">' + num + '</span>' +
                    '<span class="mkpi-label">' + label + '</span></div>';
            }
            return '<div class="mkpi-row">' +
                kpi('📅', visitsMonth, 'visites ce mois') +
                kpi('👋', lastVisitLabel, 'dernière visite') +
                kpi('📚', past, 'formations suivies') +
                kpi('🎓', upcoming, 'à venir') +
                kpi('🖨️', balance > 0 ? balance.toFixed(2).replace('.', ',') + ' €' : '0', 'impressions dues', balance > 0 ? 'mkpi-warn' : '') +
                '</div>';
        }

        // Signaux d'aide pour l'accueillant — pas de ton commercial (décision EPN :
        // pas de « relance d'absence », on n'est pas une entreprise)
        function memberCareNotes(member, visits, formations) {
            var today = new Date();
            var todayStr = today.toISOString().slice(0, 10);
            var notes = [];

            // Inscription expirée → proposer le renouvellement
            var expired = member.end_date && member.end_date < todayStr && (member.subscription || 'none') !== 'none';
            if (expired) {
                notes.push('<div class="care-note care-red">🔴 Inscription expirée depuis le ' + esc(formatDate(member.end_date)) +
                    ' <button type="button" class="btn btn-secondary btn-small" id="careRenewBtn">♻️ Renouveler</button></div>');
            }
            // Dette d'impressions → solder
            var balance = member.print_balance || 0;
            if (balance > 0) {
                notes.push('<div class="care-note care-red">🖨️ ' + balance.toFixed(2).replace('.', ',') + ' € d\'impressions dues' +
                    ' <button type="button" class="btn btn-secondary btn-small" id="carePayBtn">💰 Solder</button></div>');
            }
            // Formation dans les 7 prochains jours → rappeler la date
            formations.forEach(function (f) {
                if (!f.start_date) return;
                var diff = Math.round((new Date(f.start_date + 'T00:00:00') - today) / 86400000);
                if (diff >= 0 && diff <= 7) {
                    notes.push('<div class="care-note care-amber">🎓 « ' + esc(f.title) + ' » le ' + esc(formatDate(f.start_date)) +
                        (f.time_label ? ' à ' + esc(f.time_label) : '') + ' — pense à le/la rappeler</div>');
                }
            });

            if (!notes.length) {
                return '<div class="care-note care-ok">🟢 Rien à signaler — tout est en ordre.</div>';
            }
            return '<div class="care-notes">' + notes.join('') + '</div>';
        }

        function render(member) {
            var visits = ADWDatabase.queryAll(
                'SELECT * FROM visits WHERE member_id = ? ORDER BY visit_date DESC, created_at DESC LIMIT 30', [member.id]);
            var formations = [];
            try { formations = ADWDatabase.getMemberFormations(member.id) || []; } catch (e) { formations = []; }

            pageTitle.textContent = member.first_name + ' ' + member.last_name;
            document.title = member.first_name + ' ' + member.last_name + ' — Atelier du Web';

            var s = SUB_LABELS[member.subscription] || SUB_LABELS.none;
            var expired = isExpired(member);

            // Classe de statut pour la vignette (même code couleur EPN que membres.html)
            var avatarStatus = (member.subscription || 'none') === 'none' ? ' inactive' : (expired ? ' expired' : '');

            var html = '<div class="m-card m-card-head"><div class="detail-head' + avatarStatus + '">' +
                    '<div class="member-avatar">' + esc(((member.first_name || '?')[0] || '') + ((member.last_name || '')[0] || '')) + '</div>' +
                    '<div><div class="member-name">' + esc(member.first_name) + ' ' + esc(member.last_name) + '</div>' +
                    '<div class="member-no-detail">N° de membre : <strong>' + (member.member_no || '—') + '</strong></div>' +
                    '<div class="member-badges">' +
                        ((member.subscription || 'none') === 'none'
                            ? '<span class="badge badge-sub-none">Inactif</span>'
                            : '<span class="badge ' + (expired ? 'badge-full' : 'badge-ok') + '">' + (expired ? 'Inscription expirée' : 'Inscription active') + '</span>') +
                        ((member.subscription === 'monthly' || member.subscription === 'yearly') ? '<span class="badge ' + s.badge + '">' + s.label + '</span>' : '') +
                    '</div></div>' +
                    '<button type="button" class="btn btn-secondary btn-small" id="editMemberBtn" title="Modifier les informations du membre">✏️ Modifier</button>' +
                    '<button type="button" class="btn btn-secondary btn-small" id="renewSubBtn" title="Prolonger l\u2019inscription selon la formule du membre">♻️ Renouveler l\u2019abo</button>' +
                    '<button type="button" class="btn btn-primary btn-small" id="checkinBtn" title="Enregistrer la visite du jour pour ce membre">✅ Pointer une visite</button>' +
                    '<button type="button" class="btn btn-danger btn-small" id="deleteMemberBtn" style="margin-left:auto;align-self:flex-start;">🗑️ Supprimer</button>' +
                '</div>' +
                '</div>' + // fin carte tête
                // ---- Grille de cartes (mise en page oct. 2026) ----
                '<div class="m-cards">' +
                '<div class="m-card">' +
                memberKpis(member, visits, formations) +
                memberCareNotes(member, visits, formations) +
                '</div>' +
                '<div class="m-card m-card-id">' +
                '<div class="mid-name">' + esc(member.first_name) + ' ' + esc(member.last_name) + '</div>' +
                (member.first_start_date && member.first_start_date !== member.start_date
                    ? '<div class="mid-since">Membre depuis le ' + esc(formatDate(member.first_start_date)) + '</div>'
                    : '') +
                ((member.subscription || 'none') !== 'none' && member.start_date
                    ? '<div class="mid-dates">du ' + esc(formatDate(member.start_date)) + ' <span class="mid-sep">→</span> au ' + esc(formatDate(member.end_date)) + '</div>'
                    : '') +
                '<dl class="detail-list">' +
                    '<div><dt>Âge</dt><dd>' + (member.age ? esc(member.age) + ' ans' : 'Non renseigné') + '</dd></div>' +
                    '<div><dt>Genre</dt><dd>' + (member.gender ? esc(GENDER_LABELS[member.gender] || member.gender) : 'Non renseigné') + '</dd></div>' +
                    '<div><dt>Code postal</dt><dd>' + (member.postal_code
                        ? esc(member.postal_code) + (typeof ADW_POSTAL_CODES !== 'undefined' && ADW_POSTAL_CODES.some(function (p) { return p[0] === member.postal_code; }) ? ' — ' + esc(ADW_POSTAL_CODES.filter(function (p) { return p[0] === member.postal_code; })[0][1]) : '')
                        : 'Non renseigné') + '</dd></div>' +
                    '<div><dt>Statut social</dt><dd>' + (member.social_status ? esc(STATUS_LABELS[member.social_status] || member.social_status) : 'Non renseigné') + '</dd></div>' +
                    (member.email ? '<div><dt>Email</dt><dd><a href="mailto:' + esc(member.email) + '">' + esc(member.email) + '</a></dd></div>' : '') +
                    (member.phone ? '<div><dt>Téléphone</dt><dd><a href="tel:' + esc(member.phone.replace(/\s/g, '')) + '">' + esc(member.phone) + '</a></dd></div>' : '') +
                    (member.address ? '<div><dt>Adresse</dt><dd>' + esc(member.address) + '</dd></div>' : '') +
                '</dl>' +
                '</div>'; // fin carte identité

            // Formations : à venir vs déjà suivies (historique) — décision EPN oct. 2026
            var todayStr = new Date().toISOString().slice(0, 10);
            var upcoming = formations.filter(function (f) { return f.start_date && f.start_date >= todayStr; });
            var past = formations.filter(function (f) { return f.start_date && f.start_date < todayStr; });
            var nodate = formations.filter(function (f) { return !f.start_date; });

            function formationLine(f) {
                return '<li><span class="f-line-title">🎓 ' + esc(f.title) +
                    (f.time_label ? ' · <span class="form-hint">' + esc(f.time_label) + '</span>' : '') +
                    ' · <span class="form-hint">📅 ' + (f.date_text || (f.start_date ? esc(formatDate(f.start_date)) : 'date à confirmer')) + '</span></span>' +
                    '<span class="f-line-actions">' +
                    '<a href="formation.html?id=' + encodeURIComponent(f.event_id || f.id) + '" class="btn btn-secondary btn-small f-link" title="Voir la fiche formation dans l’app">📄 Fiche</a>' +
                    (f.url ? '<a href="' + esc(f.url) + '" target="_blank" rel="noopener" class="btn btn-secondary btn-small f-link f-link-site" title="Voir la formation sur atelierduweb.be">🌐 Site</a>' : '') +
                    '</span></li>';
            }

            html += '<div class="m-card">' +
                '<div class="detail-visits">' +
                '<h4>🎓 Formations à venir <span class="members-count">' + upcoming.length + '</span></h4>';
            if (upcoming.length || nodate.length) {
                html += '<ul class="visits-list">';
                upcoming.forEach(function (f) { html += formationLine(f); });
                nodate.forEach(function (f) { html += formationLine(f); });
                html += '</ul>';
            } else {
                html += '<p class="form-hint">Aucune formation à venir.</p>';
            }
            html += '</div>';
            html += '</div>'; // fin carte

            html += '<div class="m-card">' +
                '<div class="detail-visits">' +
                '<h4>📚 Formations suivies <span class="members-count">' + past.length + '</span></h4>';
            if (past.length) {
                html += '<ul class="visits-list">';
                past.forEach(function (f) { html += formationLine(f); });
                html += '</ul>';
            } else {
                html += '<p class="form-hint">Aucune formation suivie pour le moment.</p>';
            }
            html += '</div>';
            html += '</div>'; // fin carte

            // Impressions (même logique que la modale fiche de membres.html)
            var balance = member.print_balance || 0;
            html += '<div class="m-card">' +
                '<div class="detail-prints">' +
                '<h4>🖨️ Impressions ' +
                (balance > 0
                    ? '<span class="badge badge-sub-none">' + balance.toFixed(2).replace('.', ',') + ' € dus</span>'
                    : '<span class="badge badge-ok">✓ rien à payer</span>') +
                '</h4>' +
                '<div class="print-actions-btns">' +
                    '<button type="button" class="btn btn-secondary btn-small" data-print="bw">+ 1 N&B (0,10 €)</button>' +
                    '<button type="button" class="btn btn-secondary btn-small" data-print="color">+ 1 Couleur (0,50 €)</button>' +
                    (balance > 0 ? '<button type="button" class="btn btn-primary btn-small" data-print="pay">💰 Solder ' + balance.toFixed(2).replace('.', ',') + ' €</button>' : '') +
                    (balance > 0 ? '<button type="button" class="btn btn-danger btn-small" data-print="delete" title="Supprimer le solde en cas d\'erreur">🗑️ Erreur de saisie</button>' : '') +
                '</div>' +
            '</div>' +
            '</div>'; // fin carte impressions

            // Visites
            html += '<div class="m-card">' +
                '<div class="detail-visits">' +
                '<h4>Historique des visites <span class="members-count">' + member.visit_count + ' au total</span></h4>';
            if (visits.length) {
                html += '<ul class="visits-list">';
                visits.forEach(function (v) {
                    html += '<li><span>📅 ' + esc(formatDate(v.visit_date)) + '</span>' +
                        (member.subscription === 'none'
                            ? '<span class="badge badge-sub-none">' + v.amount.toFixed(2).replace('.', ',') + ' € payé</span>'
                            : '<span class="badge badge-ok">incluse (abonnement)</span>') + '</li>';
                });
                html += '</ul>';
            } else {
                html += '<p class="form-hint">Aucune visite enregistrée pour le moment.</p>';
            }
            html += '</div>';
            html += '</div>'; // fin carte
            html += '</div>'; // fin grille m-cards

            content.innerHTML = html;
            content.hidden = false;
            loading.hidden = true;

            // Care-notes : actions directes (renouveler / solder)
            var careRenewBtn = document.getElementById('careRenewBtn');
            if (careRenewBtn) careRenewBtn.addEventListener('click', function () {
                document.getElementById('renewSubBtn').click();
            });
            var carePayBtn = document.getElementById('carePayBtn');
            if (carePayBtn) carePayBtn.addEventListener('click', function () {
                content.querySelector('[data-print="pay"]').click();
            });

            // Modifier : ouvre le formulaire d'édition sur membres.html (hash direct)
            var editMemberBtn = document.getElementById('editMemberBtn');
            if (editMemberBtn) editMemberBtn.addEventListener('click', function () {
                location.href = 'membres.html#edit=' + encodeURIComponent(member.id);
            });

            // Pointer une visite du jour (garde déjà-pointé, même règle que membres.html)
            var checkinBtn = document.getElementById('checkinBtn');
            if (checkinBtn) checkinBtn.addEventListener('click', function () {
                var today = new Date().toISOString().slice(0, 10);
                var already = window.ADWDatabase.queryAll(
                    'SELECT id FROM visits WHERE member_id = ? AND visit_date = ?', [member.id, today]);
                if (already.length) {
                    alert('⚠️ Visite déjà pointée aujourd\'hui pour ce membre.');
                    return;
                }
                var amount = member.subscription === 'none' ? 1 : 0;
                var visitId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
                window.ADWDatabase.run('INSERT INTO visits (id, member_id, visit_date, amount) VALUES (?, ?, ?, ?)',
                    [visitId, member.id, today, amount]).then(function () {
                    if (window.ADWNotifications) window.ADWNotifications.push('checkin', '✅ Visite de ' + member.first_name + ' pointée' + (amount ? ' (1 €)' : ' (incluse abonnement)'), 'success');
                    render();
                });
            });

            // Impressions : +N&B, +couleur, solder, erreur (même logique que membres.html)
            content.addEventListener('click', function (e) {
                var btn = e.target.closest('[data-print]');
                if (!btn) return;
                var action = btn.getAttribute('data-print');
                var today = new Date().toISOString().slice(0, 10);
                if (action === 'bw' || action === 'color') {
                    var amount = action === 'bw' ? 0.10 : 0.50;
                    var printId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
                    window.ADWDatabase.run('INSERT INTO prints (id, member_id, print_date, type, amount, paid) VALUES (?, ?, ?, ?, ?, 0)',
                        [printId, member.id, today, action, amount]).then(function () {
                        if (window.ADWNotifications) window.ADWNotifications.push('print', '🖨️ Impression ' + (action === 'bw' ? 'N&B' : 'couleur') + ' ajoutée (' + amount.toFixed(2).replace('.', ',') + ' €)', 'success');
                        render();
                    });
                } else if (action === 'pay') {
                    window.ADWDatabase.run('UPDATE prints SET paid = 1, paid_date = date(\'now\') WHERE member_id = ? AND paid = 0',
                        [member.id]).then(function () {
                        if (window.ADWNotifications) window.ADWNotifications.push('print', '💰 Impressions soldées', 'success');
                        render();
                    });
                } else if (action === 'delete') {
                    if (confirm('Supprimer le solde d\'impressions de ' + member.first_name + ' ? (en cas d\'erreur de saisie)')) {
                        window.ADWDatabase.run('DELETE FROM prints WHERE member_id = ? AND paid = 0',
                            [member.id]).then(function () {
                            if (window.ADWNotifications) window.ADWNotifications.push('print', '🗑️ Solde d\'impressions supprimé', 'success');
                            render();
                        });
                    }
                }
            });

            var deleteBtn = document.getElementById('deleteMemberBtn');
            if (deleteBtn) deleteBtn.addEventListener('click', function () {
var renewBtn = content.querySelector('#renewSubBtn');
            if (renewBtn) renewBtn.addEventListener('click', function () {
                var newEnd = window.ADWDatabase.renewSubscription(member.id);
                if (!newEnd) return;
                if (window.ADWNotifications) window.ADWNotifications.push('renew', '♻️ Abonnement renouvelé jusqu\u2019au ' + newEnd, 'success');
                alert('Abonnement renouvelé jusqu\u2019au ' + newEnd + '.');
                render();
            });
                ADWAuth.ensureUnlocked('Supprimer un membre — action réservée à l\u2019équipe.').then(function (ok) {
                    if (!ok) return;
                    if (confirm('Supprimer le membre "' + member.first_name + ' ' + member.last_name + '" ?\n\nSes visites, impressions et inscriptions aux formations seront aussi supprimées.')) {
                        ADWDatabase.deleteMemberCompletely(member.id).then(function () {
                            location.href = 'membres.html';
                        });
                    }
                });
            });
        }

        ADWDatabase.init().then(function () {
            if (window.ADWNotifications) window.ADWNotifications.refresh();
            var id = null;
            var m = location.search.match(/[?&]id=([^&]+)/) || location.hash.match(/^#member=(.+)$/);
            if (m) id = decodeURIComponent(m[1]);
            if (!id) {
                loading.hidden = true;
                notFound.hidden = false;
                notFound.querySelector('p').textContent = 'Aucun membre spécifié dans l\'URL.';
                return;
            }
            var rows = ADWDatabase.queryAll(
                'SELECT m.*, ' +
                '(SELECT COUNT(*) FROM visits v WHERE v.member_id = m.id) AS visit_count, ' +
                '(SELECT COALESCE(SUM(amount), 0) FROM prints p WHERE p.member_id = m.id AND paid = 0) AS print_balance ' +
                'FROM members m WHERE m.id = ?', [id]);
            if (!rows.length) {
                loading.hidden = true;
                notFound.hidden = false;
                return;
            }
            render(rows[0]);
        }).catch(function (err) {
            loading.hidden = true;
            notFound.hidden = false;
            notFound.querySelector('p').textContent = 'Erreur de chargement de la base : ' + err.message;
        });
    })();
