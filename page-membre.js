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

        function render(member) {
            var visits = ADWDatabase.queryAll(
                'SELECT * FROM visits WHERE member_id = ? ORDER BY visit_date DESC, created_at DESC LIMIT 30', [member.id]);
            var formations = [];
            try { formations = ADWDatabase.getMemberFormations(member.id) || []; } catch (e) { formations = []; }

            pageTitle.textContent = member.first_name + ' ' + member.last_name;
            document.title = member.first_name + ' ' + member.last_name + ' — Atelier du Web';

            var s = SUB_LABELS[member.subscription] || SUB_LABELS.none;
            var expired = isExpired(member);

            var html = '<div class="detail-head">' +
                    '<div class="member-avatar">' + esc(((member.first_name || '?')[0] || '') + ((member.last_name || '')[0] || '')) + '</div>' +
                    '<div><div class="member-name">' + esc(member.first_name) + ' ' + esc(member.last_name) + '</div>' +
                    '<div class="member-no-detail">N° de membre : <strong>' + (member.member_no || '—') + '</strong></div>' +
                    '<div class="member-badges">' +
                        ((member.subscription || 'none') === 'none'
                            ? '<span class="badge badge-sub-none">Inactif</span>'
                            : '<span class="badge ' + (expired ? 'badge-full' : 'badge-ok') + '">' + (expired ? 'Inscription expirée' : 'Inscription active') + '</span>') +
                        ((member.subscription === 'monthly' || member.subscription === 'yearly') ? '<span class="badge ' + s.badge + '">' + s.label + '</span>' : '') +
                    '</div></div>' +
                    '<button type="button" class="btn btn-secondary btn-small" id="renewSubBtn" title="Prolonger l\u2019inscription selon la formule du membre">♻️ Renouveler l\u2019abo</button>' +
                    '<button type="button" class="btn btn-primary btn-small" id="checkinBtn" title="Enregistrer la visite du jour pour ce membre">✅ Pointer une visite</button>' +
                    '<button type="button" class="btn btn-danger btn-small" id="deleteMemberBtn" style="margin-left:auto;align-self:flex-start;">🗑️ Supprimer</button>' +
                '</div>' +
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
                    '<div><dt>Inscription</dt><dd>du ' + esc(formatDate(member.start_date)) + ' au ' + esc(formatDate(member.end_date)) + '</dd></div>' +
                '</dl>';

            // Formations : à venir vs déjà suivies (historique) — décision EPN oct. 2026
            var todayStr = new Date().toISOString().slice(0, 10);
            var upcoming = formations.filter(function (f) { return f.start_date && f.start_date >= todayStr; });
            var past = formations.filter(function (f) { return f.start_date && f.start_date < todayStr; });
            var nodate = formations.filter(function (f) { return !f.start_date; });

            function formationLine(f) {
                return '<li><span>🎓 ' + esc(f.title) +
                    (f.time_label ? ' · <span class="form-hint">' + esc(f.time_label) + '</span>' : '') +
                    ' · <span class="form-hint">📅 ' + (f.date_text || (f.start_date ? esc(formatDate(f.start_date)) : 'date à confirmer')) + '</span></span>' +
                    '<a href="formation.html?id=' + encodeURIComponent(f.id) + '" class="badge badge-sub-monthly" title="Voir la fiche formation">fiche →</a>' +
                    (f.url ? ' <a href="' + esc(f.url) + '" target="_blank" rel="noopener" class="badge badge-sub-monthly">site</a>' : '') +
                    '</li>';
            }

            html += '<div class="detail-visits" style="margin-top:1.2rem;">' +
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

            html += '<div class="detail-visits" style="margin-top:1.2rem;">' +
                '<h4>📚 Formations suivies <span class="members-count">' + past.length + '</span></h4>';
            if (past.length) {
                html += '<ul class="visits-list">';
                past.forEach(function (f) { html += formationLine(f); });
                html += '</ul>';
            } else {
                html += '<p class="form-hint">Aucune formation suivie pour le moment.</p>';
            }
            html += '</div>';

            // Impressions (même logique que la modale fiche de membres.html)
            var balance = member.print_balance || 0;
            html += '<div class="detail-prints" style="margin-top:1.2rem;">' +
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
            '</div>';

            // Visites
            html += '<div class="detail-visits" style="margin-top:1.2rem;">' +
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

            content.innerHTML = html;
            content.hidden = false;
            loading.hidden = true;

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
