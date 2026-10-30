    (function () {
        'use strict';

        var loading = document.getElementById('loadingState');
        var content = document.getElementById('formationContent');
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
            var d = new Date(v + 'T12:00:00');
            return d.toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        }

        // Couleur déterministe par catégorie (même logique que formations.html)
        function toneFor(name) {
            var s = (name || '').toLowerCase();
            var h = 0;
            for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
            return h % 10;
        }
        var TONE_SOLID = ['#0F3D5C', '#6C5CE7', '#2F9BE4', '#18A55F', '#E8734A', '#B26A00', '#D8434B', '#7A5230', '#556B2F', '#4A4E69'];

        var currentFormation = null;

        function roomCardHtml(f) {
            var rooms = ADWDatabase.listRooms();
            var dates = [];
            try { dates = ADWDatabase.getFormationDates(f.id) || []; } catch (e) { dates = []; }
            var html = '<div class="form-group"><label for="roomSelect">Salle attribuée</label>' +
                '<select id="roomSelect">' +
                '<option value="">— Non attribuée —</option>';
            rooms.forEach(function (r) {
                html += '<option value="' + esc(r.id) + '"' + (f.room_id === r.id ? ' selected' : '') + '>' + esc(r.name) + '</option>';
            });
            html += '</select><div id="roomConflict" class="form-error" style="margin-top:0.6rem;" hidden></div></div>';
            // Seances (dates + creneaux)
            if (dates.length) {
                html += '<p class="form-hint" style="margin-bottom:0.4rem;"><strong>Séances (' + dates.length + ')</strong> — chaque séance bloque un créneau dans le planning de la salle :</p><ul style="list-style:none;">';
                dates.forEach(function (d) {
                    var label = new Date(d.date + 'T12:00:00').toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' });
                    html += '<li style="padding:0.25rem 0;border-bottom:1px solid var(--bg);font-size:0.88rem;">' +
                        '📅 ' + esc(label) + ' · <span class="badge ' + (d.slot === 'AM' ? 'badge-sub-monthly' : 'badge-sub-yearly') + '">' + (d.slot === 'AM' ? 'Matin 9h30–12h30' : 'Après-midi 13h30–16h30') + '</span></li>';
                });
                html += '</ul>';
            } else {
                html += '<p class="form-hint">Aucune séance parsée pour cette formation — elle ne bloque aucun créneau.</p>';
            }
            return html;
        }

        function attachRoomLogic(f) {
            var select = document.getElementById('roomSelect');
            var conflictBox = document.getElementById('roomConflict');
            if (!select) return;
            select.addEventListener('change', function () {
                var roomId = select.value || null;
                var conflicts = roomId ? ADWDatabase.getRoomConflicts(f.id, roomId) : [];
                ADWDatabase.setFormationRoom(f.id, roomId);
                if (roomId) {
                    var roomName = select.options[select.selectedIndex].textContent;
                    if (conflicts.length) {
                        var details = conflicts.map(function (c) {
                            var label = new Date(c.date + 'T12:00:00').toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' });
                            return '⚠️ ' + esc(c.title) + ' occupe déjà ce créneau le ' + label + ' ' + (c.slot === 'AM' ? 'matin' : 'après-midi');
                        }).join('<br>');
                        conflictBox.innerHTML = '<strong>Conflit détecté :</strong><br>' + details + '<br><span class="form-hint">Attribution enregistrée quand même — à toi de trancher.</span>';
                        conflictBox.hidden = false;
                        if (window.ADWNotifications) {
                            window.ADWNotifications.push('awaiting_validation',
                                '⚠️ Conflit de salle : « ' + f.title + ' » et ' + conflicts.length + ' autre(s) formation(s) partagent un créneau',
                                'warning');
                        }
                    } else {
                        conflictBox.hidden = true;
                    }
                    if (window.ADWNotifications) {
                        window.ADWNotifications.push('info', '📝 « ' + f.title + ' » attribuée à ' + roomName, 'success');
                    }
                } else {
                    conflictBox.hidden = true;
                }
            });
        }

        function render(f) {
            currentFormation = f;
            pageTitle.textContent = f.title;
            document.title = f.title + ' — Atelier du Web';

            var cats = (f.categories || '').split(',').map(function (c) { return c.trim(); }).filter(function (c) { return c && !/^\d+$/.test(c); });
            var mainCat = cats[0] || '';
            var tone = mainCat ? toneFor(mainCat) : -1;
            var bannerStyle = tone >= 0 ? ' style="background:linear-gradient(135deg,' + TONE_SOLID[tone] + ',rgba(0,0,0,0.25))"' : '';

            var attendees = [];
            try { attendees = ADWDatabase.getFormationAttendees(f.id) || []; } catch (e) { attendees = []; }


            var html = '';

            // Bandeau (couleur de la catégorie)
            html += '<div class="hero"' + bannerStyle + ' style="border-radius:var(--radius);padding:1.4rem 1.6rem;color:#fff;margin-bottom:1.3rem;position:relative;">' +
                '<h2 style="color:#fff;font-size:1.35rem;font-weight:800;letter-spacing:-0.4px;margin-bottom:0.5rem;">' + esc(f.title) + '</h2>' +
                '<p style="opacity:0.92;font-size:0.95rem;">' +
                (f.date_text || (f.start_date ? formatDate(f.start_date) : 'date à confirmer')) +
                (f.time_label ? ' · ' + esc(f.time_label) : '') +
                (f.duration ? ' · ' + esc(f.duration) : '') +
                '</p>' +
                (f.price ? '<p style="opacity:0.95;font-size:1.05rem;font-weight:700;margin-top:0.3rem;">💶 ' + esc(f.price) + ' €</p>' : '') +
                '<div id="mecLabels" style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;"></div>' +
                '<div class="hero-actions"><button class="btn btn-primary" id="bookBtn">Réserver sur le site</button></div>' +
                '<a class="f-card-count' + (attendees.length ? ' has-attendees' : '') + '" style="position:absolute;right:1.4rem;bottom:1rem;text-align:center;" href="#inscrits" title="Voir les inscrits">' +
                '<span class="f-count-num" style="font-size:3.4rem;line-height:1;font-weight:800;">' + attendees.length + '</span>' +
                '<span class="f-count-lbl" style="font-size:0.95rem;">inscrit' + (attendees.length > 1 ? 's' : '') + '</span></a>' +
                '</div>';

            // ---- KPI de la formation : aperçu de son fonctionnement (oct. 2026) ----
            var paidCount = attendees.filter(function (m) { return m.payment === 'bancontact' || m.payment === 'cash'; }).length;
            var presentCount = attendees.filter(function (m) { return m.attendance === 'present'; }).length;
            var canceledCount = attendees.filter(function (m) { return m.attendance === 'canceled'; }).length;
            function fKpi(icon, num, label, cls) {
                return '<div class="mkpi' + (cls ? ' ' + cls : '') + '">' +
                    '<span class="mkpi-icon" aria-hidden="true">' + icon + '</span>' +
                    '<span class="mkpi-num">' + num + '</span>' +
                    '<span class="mkpi-label">' + label + '</span></div>';
            }
            var bcCount = attendees.filter(function (m) { return m.payment === 'bancontact'; }).length;
            var cashCount = attendees.filter(function (m) { return m.payment === 'cash'; }).length;
            var unitPrice = f.price ? (parseFloat(String(f.price).replace(',', '.')) || 0) : 0;
            var projected = unitPrice * attendees.length;
            var collected = unitPrice * paidCount;
            function fKpiMoney(icon, main, sub, cls) {
                return '<div class="mkpi' + (cls ? ' ' + cls : '') + '">' +
                    '<span class="mkpi-icon" aria-hidden="true">' + icon + '</span>' +
                    '<span class="mkpi-num">' + main + '</span>' +
                    '<span class="mkpi-label">' + sub + '</span></div>';
            }
            html += '<div class="mkpi-row fkpi-row" style="grid-template-columns:repeat(4,1fr);">' +
                fKpi('💳', bcCount + ' / ' + attendees.length, 'payés bancontact') +
                fKpi('💵', cashCount + ' / ' + attendees.length, 'payés cash') +
                fKpi('✅', presentCount + ' / ' + attendees.length, 'présents', presentCount > 0 ? 'fkpi-green' : '') +
                fKpiMoney('💶', collected.toFixed(2).replace('.', ',') + ' €',
                    'encaissé / ' + (projected > 0 ? projected.toFixed(2).replace('.', ',') + ' € projetés' : 'projeté inconnu')) +
                '</div>';

            // Détails structurés (organisateur/lieu/tarif remplis dès que les snippets répondront)
            html += '<div class="stats-container">' +
                '<div class="stat-card"><h3>📌 Informations</h3><ul>' +
                '<li><strong>📅 Date :</strong> ' + esc(f.date_text || (f.start_date ? formatDate(f.start_date) : 'à confirmer')) + '</li>' +
                '<li><strong>⏰ Horaires :</strong> ' + esc(f.time_label || 'à confirmer') + '</li>' +
                '<li><strong>⏳ Durée :</strong> ' + esc(f.duration || 'à confirmer') + '</li>' +
                '<li><strong>💶 Tarif :</strong> ' + (f.price ? esc(f.price) + ' €' : 'voir sur le site') + '</li>' +
                '<li><strong>📍 Lieu :</strong> ' + esc(f.location || 'à confirmer') + '</li>' +
                '<li><strong>👤 Organisateur :</strong> ' + esc(f.organizer || 'à confirmer') + '</li>' +
                '</ul></div>' +
                '<div class="stat-card"><h3>📝 Description</h3>' + (f.excerpt
                    ? '<p style="font-size:0.95rem;color:var(--text);">' + esc(f.excerpt) + '</p>' +
                      (f.url ? '<p class="form-hint" style="margin-top:0.6rem;"><a href="' + esc(f.url) + '" target="_blank" rel="noopener">Voir la page complète sur atelierduweb.be →</a></p>' : '')
                    : '<p class="form-hint">Pas de description.</p>') +
                '</div>' +
                '<div class="stat-card" id="roomCard"><h3>📝 Salle & séances</h3>' +
                roomCardHtml(f) +
                '</div>' +
                '</div>';

            // Inscriptions (miroir) — marge top : détaché de la grille d'infos au-dessus
            html += '<div class="stat-card" id="inscrits" style="margin-top:1.2rem;"><h3>👥 Inscrits (miroir du site) <span class="members-count">' + attendees.length + '</span></h3>';
            if (attendees.length) {
                html += '<ul class="checkin-results" style="display:flex;flex-direction:column;">';
                attendees.forEach(function (m) {
                    var paid = m.payment; // 'bancontact' | 'cash' | null
                    var att = m.attendance; // 'present' | 'canceled' | null
                    html += '<li class="checkin-item fm-line' + (att === 'present' ? ' fm-present' : att === 'canceled' ? ' fm-canceled' : att === 'na' ? ' fm-na' : '') + (paid ? ' fm-paid' : '') + '" style="list-style:none;" data-fm-mid="' + esc(m.id) + '">' +
                        '<span class="member-avatar small" style="cursor:pointer;" data-preview-mid="' + esc(m.id) + '">' + esc((m.first_name || '?')[0] + (m.last_name || '')[0]) + '</span>' +
                        '<div style="flex:1;min-width:0;cursor:pointer;" data-preview-mid="' + esc(m.id) + '">' +
                        '<strong>' + esc(m.last_name.toUpperCase() + ' ' + m.first_name) + '</strong>' +
                        (m.member_no ? ' <span class="member-no">#' + esc(m.member_no) + '</span>' : '') +
                        '<div class="form-hint">' + (m.email ? esc(m.email) : 'pas d\u2019email') + ' · <span style="color:var(--blue);font-weight:600;">détails</span></div></div>' +
                        '<span class="fm-actions">' +
                        '<button type="button" class="btn btn-secondary btn-small fm-pay' + (paid === 'bancontact' ? ' is-paid' : paid === 'cash' ? ' is-muted' : '') + '" data-pay="bancontact"' + (paid === 'cash' ? ' disabled' : '') + '>💳 Bancontact</button>' +
                        '<button type="button" class="btn btn-secondary btn-small fm-pay' + (paid === 'cash' ? ' is-paid' : paid === 'bancontact' ? ' is-muted' : '') + '" data-pay="cash"' + (paid === 'bancontact' ? ' disabled' : '') + '>💵 Cash</button>' +
                        '<button type="button" class="btn btn-secondary btn-small fm-att' + (att === 'present' ? ' is-present' : att === 'canceled' ? ' is-canceled' : att === 'na' ? ' is-na' : '') + '" data-att="' + (att === 'present' ? 'canceled' : att === 'canceled' ? 'na' : 'present') + '" title="Cycler : présent → annulé → non concerné">' + (att === 'present' ? '✅ Présent' : att === 'canceled' ? '🚫 Annulé' : att === 'na' ? '⬜ Non concerné' : '❔ Présent ?') + '</button>' +
                        '</span>' +
                        '</li>';
                });
                html += '</ul>';
            } else {
                html += '<p class="form-hint">Aucun membre inscrit pour l\u2019instant. Les inscriptions réalisées sur le site apparaîtront ici après synchronisation (bouton 📥 dans la page Formations).</p>';
            }
            html += '</div>';


            // Catégories (bloc sous la carte Inscrits)
            html += '<div class="stats-container" style="margin-top:1.2rem;margin-bottom:1.3rem;"><div class="stat-card"><h3>🗂 Catégories</h3>' +
                (cats.length ? '<ul style="display:flex;gap:0.4rem;list-style:none;flex-wrap:wrap;">' + cats.map(function (c) {
                    var t = toneFor(c);
                    return '<li><span class="tag" style="background:' + TONE_SOLID[t] + ';color:#fff;"><span class="month-dot" style="display:inline-block;background:rgba(255,255,255,0.6);margin-right:0.35rem;"></span>' + esc(c) + '</span></li>';
                }).join('') + '</ul>' : '<p class="form-hint">Aucune catégorie.</p>') +
                '</div></div>';

            content.innerHTML = html;
            attachRoomLogic(f);
            loadMecLabels(f);
            attachAttendeeLogic(f);
            content.hidden = false;
            loading.hidden = true;
        }

        // ============ Labels MEC (Annulé, Niveau…) depuis la page publique ============
        // La page de la formation expose « Labels : Annulé, Niveau intermédiaire » dans son HTML
        // (bloc données MEC). L'API wp/v2 ne les expose pas — la page est la seule source
        // publique. Fetch sans clé, lecture simple.
        // Parsing du bloc données MEC de la page publique : labels + tarif + lieu + organisateur.
        // (L'API wp/v2 n'expose pas ces champs ; l'API officielle MEC nécessite la clé — réservée au
        // futur serveur Node. La page HTML est la source navigateur, cf. docs/BACKEND.md §7.)
        function parseMecBlock(html) {
            function clean(s) { return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }
            var out = {};
            // Labels : jusqu'à Lieu/Catégorie
            var mLab = html.match(/Labels\s*(?:<[^>]*>\s*)*([^]*?)(?=Lieu|Catégorie|$)/);
            out.labels = mLab ? mLab[1].split(',').map(clean).filter(function (s) { return s && s.length < 40; }) : [];
            // Tarif : « Tarif … 40.00€ » jusqu'à Labels
            var mPrice = html.match(/Tarif\s*(?:<[^>]*>\s*)*([^]*?)(?=Labels|$)/);
            out.price = mPrice ? (clean(mPrice[1]).replace(/[^€0-9,.]/g, '').replace('€', '').replace(',', '.').trim()) : '';
            // Lieu : « Lieu … » jusqu'à Catégorie/Organisateur
            var mLieu = html.match(/Lieu\s*(?:<[^>]*>\s*)*([^]*?)(?=Catégorie|Organisateur|$)/);
            out.location = mLieu ? clean(mLieu[1]) : '';
            // Organisateur : « Organisateur … » jusqu'à Email
            var mOrg = html.match(/Organisateur\s*(?:<[^>]*>\s*)*([^]*?)(?=Email|Site|$)/);
            out.organizer = mOrg ? clean(mOrg[1]) : '';
            return out;
        }

        function loadMecLabels(f) {
            var box = document.getElementById('mecLabels');
            if (!box || !f.url) return;
            fetch(f.url, { headers: { Accept: 'text/html' } })
                .then(function (res) { if (!res.ok) throw new Error('http_' + res.status); return res.text(); })
                .then(function (html) {
                    var parsed = parseMecBlock(html);
                    var labels = parsed.labels || [];
                    // Persist in base : tarif/lieu/organisateur (colonnes existantes, souvent vides)
                    try {
                        if (parsed.price || parsed.location || parsed.organizer) {
                            ADWDatabase.run('UPDATE formations SET price = COALESCE(NULLIF(?, \'\'), price), location = COALESCE(NULLIF(?, \'\'), location), organizer = COALESCE(NULLIF(?, \'\'), organizer) WHERE event_id = ?',
                                [parsed.price || '', parsed.location || '', parsed.organizer || '', String(f.event_id || f.id)]);
                        }
                    } catch (e) { /* best effort */ }
                    // Rafraîchir l'affichage avec les données fraîchement parsées (le rendu initial
                    // lit la base, potentiellement vide pour un nouvel événement)
                    if (parsed.price && !f.price) {
                        var priceEl = document.querySelector('.hero p[style*="font-weight:700"]');
                        if (priceEl && !priceEl.textContent.match(/€/)) {
                            // pas de paragraphe prix dans le hero → le créer
                        }
                        f.price = parsed.price;
                        var infoPrice = Array.prototype.find.call(document.querySelectorAll('.stat-card li'), function (li) {
                            return li.textContent.indexOf('Tarif :') !== -1;
                        });
                        if (infoPrice) infoPrice.innerHTML = '<strong>💶 Tarif :</strong> ' + esc(parsed.price) + ' €';
                    }
                    if (parsed.location && !f.location) {
                        f.location = parsed.location;
                        var infoLieu = Array.prototype.find.call(document.querySelectorAll('.stat-card li'), function (li) {
                            return li.textContent.indexOf('Lieu :') !== -1;
                        });
                        if (infoLieu) infoLieu.innerHTML = '<strong>📍 Lieu :</strong> ' + esc(parsed.location);
                    }
                    if (parsed.organizer && !f.organizer) {
                        f.organizer = parsed.organizer;
                        var infoOrg = Array.prototype.find.call(document.querySelectorAll('.stat-card li'), function (li) {
                            return li.textContent.indexOf('Organisateur :') !== -1;
                        });
                        if (infoOrg) infoOrg.innerHTML = '<strong>👤 Organisateur :</strong> ' + esc(parsed.organizer);
                    }
                    if (!labels.length) return; // rien trouvé : on laisse le bloc vide
                    // Labels MEC avec réactions (décision EPN oct. 2026) :
                    //   « annulé »  → badge orange, résa désactivée, carte grisée
                    //   « complet » → badge rouge, résa désactivée
                    //   « nouveau » → badge vert
                    var MAJORS = {
                        canceled: /annul/i,
                        full: /complet/i,
                        fresh: /nouveau|new/i
                    };
                    var isCanceled = MAJORS.canceled.test(labels.join(' '));
                    var isFull = !isCanceled && MAJORS.full.test(labels.join(' '));
                    box.innerHTML = labels.map(function (lb) {
                        var style;
                        if (MAJORS.canceled.test(lb)) {
                            style = 'background:var(--orange-light);color:#8F5600;border:1px solid var(--orange);font-weight:800;';
                        } else if (MAJORS.full.test(lb)) {
                            style = 'background:var(--danger-bg);color:var(--danger);border:1px solid var(--danger);font-weight:800;';
                        } else if (MAJORS.fresh.test(lb)) {
                            style = 'background:var(--green-light);color:var(--green);border:1px solid var(--green);font-weight:800;';
                        } else {
                            style = 'background:rgba(255,255,255,0.22);color:#fff;border:1px solid rgba(255,255,255,0.4);';
                        }
                        return '<span class="badge" style="' + style + '">' + esc(lb) + '</span>';
                    }).join('');
                    // Réactions : annulé / complet → résa désactivée ; annulé → carte grisée
                    var bookBtn = document.getElementById('bookBtn');
                    var hero = document.querySelector('.hero');
                    if ((isCanceled || isFull) && bookBtn) {
                        bookBtn.disabled = true;
                        bookBtn.classList.add('btn-disabled-locked');
                        bookBtn.title = isCanceled ? 'Formation annulée — réservation fermée' : 'Formation complète — réservation fermée';
                        bookBtn.textContent = isCanceled ? '🚫 Annulée' : '⛔ Complète';
                    }
                    if (isCanceled && hero) hero.classList.add('f-canceled-hero');
                })
                .catch(function () { /* page injoignable : pas de labels affichés, pas grave */ });
        }

        // ============ Suivi des inscrits : paiement + présence (oct. 2026) ============
        var attendeeLogicAttached = false;
        function attachAttendeeLogic(f) {
            // Délégation sur toute la liste : un listener UNIQUE (flag anti-accumulation au re-render)
            if (attendeeLogicAttached) return;
            attendeeLogicAttached = true;
            var currentFormation = f;
            attachAttendeeLogic = function (nf) { currentFormation = nf; }; // maj de la formation courante
            content.addEventListener('click', function (e) {
                var payBtn = e.target.closest('.fm-pay');
                if (payBtn) {
                    var li = payBtn.closest('.fm-line');
                    var memberId = li && li.getAttribute('data-fm-mid');
                    if (!memberId) return;
                    var method = payBtn.getAttribute('data-pay');
                    var already = payBtn.classList.contains('is-paid');
                    // clic sur un bouton déjà validé = annulation (toggle)
                    ADWDatabase.setFmPayment(currentFormation.id, memberId, already ? null : method);
                    if (window.ADWNotifications && !already) {
                        window.ADWNotifications.push('info', '💳 ' + (method === 'bancontact' ? 'Bancontact' : 'Cash') + ' enregistré pour un inscrit de « ' + currentFormation.title + ' »', 'success');
                    }
                    render(f);
                    return;
                }
                var attBtn = e.target.closest('.fm-att');
                if (attBtn) {
                    var li2 = attBtn.closest('.fm-line');
                    var memberId2 = li2 && li2.getAttribute('data-fm-mid');
                    if (!memberId2) return;
                    var target = attBtn.getAttribute('data-att'); // 'present' | 'canceled'
                    ADWDatabase.setFmAttendance(currentFormation.id, memberId2, target);
                    if (window.ADWNotifications) {
                        var msg = target === 'present'
                            ? '✅ Présence confirmée (formation « ' + currentFormation.title + ' »)'
                            : target === 'canceled'
                            ? '🚫 Inscription marquée annulée (formation « ' + currentFormation.title + ' »)'
                            : '⬜ Marqué non concerné (formation « ' + currentFormation.title + ' »)';
                        window.ADWNotifications.push('info', msg, target === 'present' ? 'success' : target === 'na' ? 'info' : 'warning');
                    }
                    render(f);
                }
            });
        }

        // ============ Apercu membre (modale rapide) ============
        var previewModal = document.getElementById('memberPreviewModal');
        var previewTitle = document.getElementById('memberPreviewTitle');
        var previewBody = document.getElementById('memberPreviewBody');
        var previewFullBtn = document.getElementById('memberPreviewFullBtn');

        var SUB_LABELS = { none: 'Aucun abo', monthly: 'Abo mensuel · 3 €', yearly: 'Abo annuel · 30 €' };

        function openMemberPreview(memberId) {
            var rows = ADWDatabase.queryAll(
                'SELECT m.*, ' +
                '(SELECT COUNT(*) FROM visits v WHERE v.member_id = m.id) AS visit_count, ' +
                '(SELECT COUNT(*) FROM formations_members fm WHERE fm.member_id = m.id) AS formation_count ' +
                'FROM members m WHERE m.id = ?', [memberId]);
            if (!rows.length) return;
            var m = rows[0];
            previewTitle.textContent = m.first_name + ' ' + m.last_name;
            var expired = m.end_date && m.end_date < new Date().toISOString().slice(0, 10);
            previewBody.innerHTML =
                '<div class="detail-head">' +
                '<div class="member-avatar">' + esc(((m.first_name || '?')[0] || '') + ((m.last_name || '')[0] || '')) + '</div>' +
                '<div><div class="member-name">' + esc(m.first_name) + ' ' + esc(m.last_name) + '</div>' +
                '<div class="member-no-detail">N° de membre : <strong>' + (m.member_no || '—') + '</strong></div>' +
                '<div class="member-badges">' +
                '<span class="badge ' + (expired ? 'badge-full' : 'badge-ok') + '">' + (expired ? 'Inscription expirée' : 'Inscription active') + '</span>' +
                '<span class="badge badge-sub-none">' + esc(SUB_LABELS[m.subscription] || SUB_LABELS.none) + '</span>' +
                '</div></div></div>' +
                '<dl class="detail-list">' +
                (m.email ? '<div><dt>Email</dt><dd><a href="mailto:' + esc(m.email) + '">' + esc(m.email) + '</a></dd></div>' : '') +
                (m.phone ? '<div><dt>Téléphone</dt><dd><a href="tel:' + esc(String(m.phone).replace(/\s/g, '')) + '">' + esc(m.phone) + '</a></dd></div>' : '') +
                (m.age ? '<div><dt>Âge</dt><dd>' + esc(m.age) + ' ans</dd></div>' : '') +
                (m.postal_code ? '<div><dt>Code postal</dt><dd>' + esc(m.postal_code) + '</dd></div>' : '') +
                '<div><dt>Visites</dt><dd>' + m.visit_count + '</dd></div>' +
                '<div><dt>Formations</dt><dd>' + m.formation_count + '</dd></div>' +
                '</dl>';
            previewFullBtn.href = 'membre.html?id=' + encodeURIComponent(m.id);
            previewModal.hidden = false;
            document.getElementById('memberPreviewCloseBtn').focus();
        }

        document.getElementById('formationContent').addEventListener('click', function (e) {
            var li = e.target.closest('[data-preview-mid]');
            if (li) openMemberPreview(li.getAttribute('data-preview-mid'));
        });
        document.getElementById('memberPreviewCloseBtn').addEventListener('click', function () { previewModal.hidden = true; });

        // Bouton Réserver : ouvre le sélecteur de membre, puis MEC pré-rempli.
        // Délégation sur #formationContent car #bookBtn n'existe qu'après le rendu.
        document.getElementById('formationContent').addEventListener('click', function (e) {
            if (!e.target.closest('#bookBtn')) return;
            if (window.ADWBooking && currentFormation) window.ADWBooking.openPicker(currentFormation);
        });
        previewModal.addEventListener('click', function (e) { if (e.target === previewModal) previewModal.hidden = true; });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !previewModal.hidden) previewModal.hidden = true;
        });

        ADWDatabase.init().then(function () {
            if (window.ADWNotifications) window.ADWNotifications.refresh();
            var id = null;
            var m = location.search.match(/[?&]id=([^&]+)/) || location.hash.match(/^#formation=(.+)$/);
            if (m) id = decodeURIComponent(m[1]);
            if (!id) {
                loading.hidden = true;
                notFound.hidden = false;
                notFound.querySelector('p').textContent = 'Aucune formation spécifiée dans l\u2019URL.';
                return;
            }
            // id = event_id MEC (clé naturelle partagée avec les cartes)
            var f = ADWDatabase.getFormationByEventId(id);
            if (!f) {
                loading.hidden = true;
                notFound.hidden = false;
                return;
            }
            render(f);
        }).catch(function (err) {
            loading.hidden = true;
            notFound.hidden = false;
            notFound.querySelector('p').textContent = 'Erreur de chargement de la base : ' + err.message;
        });
    })();
