(function () {
    'use strict';

    // Client de l'API WordPress de atelierduweb.be (formations M.E. Calendar).
    // Source : wp-json/wp/v2/mec-events (public, sans clé) + fallback RSS.
    // Parse les extraits FR (durée/dates/horaires), résout les catégories (IDs → noms),
    // cache localStorage 15 min. Expose window.ADWMec.

    var WP_BASE = 'https://atelierduweb.be/wp-json/wp/v2';
    var RSS_URL = 'https://atelierduweb.be/feed/';
    var CACHE_KEY = 'atelierduweb_mec_events';
    var CACHE_TTL = 15 * 60 * 1000;

    function stripHtml(html) {
        if (!html) return '';
        var d = document.createElement('div');
        d.innerHTML = html;
        return (d.textContent || '').trim();
    }

    // Parse une date française : "le lundi 23 novembre", "Les 08 et 10 décembre 2026",
    // "Les 15, 16, 22, 23 juin de 13h30 à 16h30" (on coupe avant "de 13h")
    // Parse TOUTES les dates d'un texte : "le lundi 23 novembre", "Les 08 et 10 décembre 2026", "Les 15, 16, 22, 23 juin de 13h30 à 16h30"
    function parseFrDates(text) {
        if (!text) return [];
        var clean = text.replace(/\s+de\s+\d{1,2}\s?h.*$/i, '').trim();
        var months = { janvier: 1, 'février': 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, 'août': 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, 'décembre': 12, decembre: 12 };
        var m = clean.toLowerCase().match(/(\d{1,2}(?:\s*(?:,|et|&)\s*\d{1,2})*)\s+([a-zéû]+)\s*(\d{4})?/);
        if (!m) return [];
        var month = months[m[2]];
        if (!month) return [];
        var year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
        var days = m[1].match(/\d{1,2}/g) || [];
        return days.map(function (d) {
            return year + '-' + String(month).padStart(2, '0') + '-' + String(parseInt(d, 10)).padStart(2, '0');
        });
    }

    // Creneau : matin (AM) si heure de debut < 12h, sinon apres-midi (PM)
    function parseSlot(timeText) {
        var m = (timeText || '').match(/(\d{1,2})\s?h/i);
        if (!m) return 'AM';
        return parseInt(m[1], 10) < 12 ? 'AM' : 'PM';
    }

    // Extrait durée / dates / horaires depuis l'extrait structuré du site
    // Format : "⏳ Durée : 1 Matinée 📅 Dates : le lundi 23 novembre ⏰ Horaires : De 13h30 à 16h30 …"
    var Mec = {
        clearCache: function () {
            try { localStorage.removeItem(CACHE_KEY); } catch (e) { /* ignore */ }
        },

        readCache: function () {
            try {
                var raw = localStorage.getItem(CACHE_KEY);
                if (!raw) return null;
                var cached = JSON.parse(raw);
                if (!cached || !cached.time || Date.now() - cached.time > CACHE_TTL) return null;
                // Cache pollué par des IDs numériques non résolus : forcer un rechargement
                var numeric = (cached.events || []).some(function (ev) {
                    return (ev.categories || []).some(function (c) { return /^\d+$/.test(String(c)); });
                });
                if (numeric) return null;
                return cached;
            } catch (e) { return null; }
        },

        writeCache: function (events) {
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), events: events }));
            } catch (e) { /* quota : ignore */ }
        },

        // Extrait durée / dates / horaires depuis l'extrait structuré du site
        // Format : "⏳ Durée : 1 Matinée 📅 Dates : le lundi 23 novembre ⏰ Horaires : De 13h30 à 16h30 …"
        parseExcerptFields: function (text) {
            var out = { duration: '', dateText: '', timeText: '', startDate: '', description: '' };
            if (!text) return out;
            var clean = text.replace(/Lire la suite.*$/, '').trim();
            var mDur = clean.match(/Dur[ée]e\s*:\s*([^📅⏰]+)/);
            if (mDur) out.duration = mDur[1].trim();
            var mDate = clean.match(/Dates?\s*:\s*([^⏰]+)/);
            if (mDate) out.dateText = mDate[1].trim();
            // Horaires : ne capturer QUE la plage horaire (h/mm), jamais le texte après
            var mTime = clean.match(/(?:[Dd]e\s*)?(\d{1,2}\s?h\s?\d{0,2})\s*[àa\-–]\s*(\d{1,2}\s?h\s?\d{0,2})/);
            if (mTime) out.timeText = 'De ' + mTime[1].replace(/\s/g, '') + ' à ' + mTime[2].replace(/\s/g, '');
            // Formats alternatifs : "1 demie – journée", "5 Matinées"…
            if (!out.duration) {
                var mDurAlt = clean.match(/(?:^|\s)(\d\s*(?:demie|matin[ée]e|apr[èe]s-midi|journ[ée]e|soir[ée]e|heure[s]?)[^📅⏰\n]{0,20})/i);
                if (mDurAlt) out.duration = mDurAlt[1].trim().replace(/\s+/g, ' ');
            }
            if (!out.dateText) {
                var mDateAlt = clean.match(/(?:le |les )?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+\d{1,2}(?:\s*(?:et|,|-)\s*\d{1,2})*\s+[a-zéû\d]+\s*(?:\d{4})?/i);
                if (mDateAlt) out.dateText = mDateAlt[0].trim();
            }
            out.startDate = (parseFrDates(out.dateText)[0]) || '';
            // La description = le texte restant après les trois champs
            var desc = clean;
            if (mDur) desc = desc.replace(mDur[0], '');
            if (mDate) desc = desc.replace(mDate[0], '');
            if (out.timeText) desc = desc.replace('Horaires : ' + out.timeText, '').replace(/Horaires?\s*:\s*/, '');
            desc = desc.replace(/[⏳📅⏰☀]/g, ' ').replace(/\s+/g, ' ').trim();
            out.description = desc;
            return out;
        },

        // Source 1 : API REST publique WordPress (CORS OK par défaut, pas de clé)
        fetchViaWpRest: function () {
            var self = this;
            var events = [];
            function page(pageNo) {
                var url = WP_BASE + '/mec-events?per_page=100&page=' + pageNo +
                    '&_fields=id,date,modified,title,link,excerpt,mec_category';
                return fetch(url, { headers: { Accept: 'application/json' } }).then(function (res) {
                    if (!res.ok) throw new Error('wp_http_' + res.status);
                    return res.json();
                }).then(function (items) {
                    if (!Array.isArray(items) || !items.length) return events;
                    items.forEach(function (item) {
                        // Ignorer les événements mis à la corbeille ou sans lien de formation
                        if (!item.link || item.link.indexOf('__trashed') !== -1) return;
                        var excerptText = stripHtml(item.excerpt && item.excerpt.rendered);
                        var fields = Mec.parseExcerptFields(excerptText);
                        var evDates = parseFrDates(fields.dateText);
                        if (!evDates.length && fields.startDate) evDates = [fields.startDate];
                        events.push({
                            id: item.id,
                            title: stripHtml(item.title && item.title.rendered),
                            url: item.link,
                            excerpt: fields.description,
                            duration: fields.duration,
                            startDate: evDates[0] || '',
                            dates: evDates,
                            slot: parseSlot(fields.timeText),
                            dateText: fields.dateText,
                            timeLabel: fields.timeText,
                            categories: item.mec_category || [],
                            raw: item
                        });
                    });
                    if (items.length === 100) return page(pageNo + 1);
                    return events;
                });
            }
            return page(1).then(function (evs) {
                // Ne garder que les événements dont la date de début est >= aujourd'hui
                var todayStr = new Date().toISOString().slice(0, 10);
                evs = evs.filter(function (ev) {
                    return ev.startDate && ev.startDate >= todayStr;
                });
                return self.resolveCategories(evs);
            });
        },

        // Résout les IDs de catégories en noms (une seule requête, mise en cache mémoire)
        resolveCategories: function (events) {
            var needed = {};
            events.forEach(function (ev) {
                (ev.categories || []).forEach(function (id) { needed[id] = true; });
            });
            var ids = Object.keys(needed);
            if (!ids.length) return Promise.resolve(events);
            return fetch(WP_BASE + '/mec_category?per_page=100&_fields=id,name', {
                headers: { Accept: 'application/json' }
            }).then(function (res) { return res.ok ? res.json() : []; }).then(function (terms) {
                var map = {};
                terms.forEach(function (t) { map[t.id] = t.name; });
                events.forEach(function (ev) {
                    ev.categories = (ev.categories || []).map(function (id) { return map[id] || null; }).filter(Boolean);
                });
                return events;
            }).catch(function () {
                // Résolution impossible : renvoyer les catégories vides plutôt que des IDs numériques,
                // qui pollueraient le cache, la base locale et l'affichage (numéros au lieu d'intitulés)
                events.forEach(function (ev) {
                    ev.categories = (ev.categories || []).filter(function (c) { return !/^\d+$/.test(String(c)); });
                });
                return events;
            });
        },

        // Source 2 (fallback) : flux RSS du site
        fetchViaRss: function () {
            return fetch(RSS_URL, { headers: { Accept: 'application/rss+xml' } })
                .then(function (res) {
                    if (!res.ok) throw new Error('rss_http_' + res.status);
                    return res.text();
                })
                .then(function (xml) {
                    var doc = new DOMParser().parseFromString(xml, 'application/xml');
                    if (doc.querySelector('parsererror')) throw new Error('rss_invalid');
                    var items = doc.querySelectorAll('item');
                    var events = [];
                    items.forEach(function (node) {
                        var get = function (tag) {
                            var el = node.querySelector(tag);
                            return el ? el.textContent.trim() : '';
                        };
                        var link = get('link');
                        if (link.indexOf('/formation/') === -1) return; // seulement les formations
                        var excerpt = stripHtml(get('description'));
                        events.push({
                            id: get('guid') || link,
                            title: get('title'),
                            url: link,
                            excerpt: excerpt.split('Lire la suite')[0].trim(),
                            startDate: '',
                            timeLabel: '',
                            categories: [],
                            raw: null
                        });
                    });
                    return events;
                });
        },

        load: function () {
            var self = this;
            var cached = self.readCache();
            if (cached && cached.events && cached.events.length) {
                return Promise.resolve(cached.events);
            }
            return self.fetchViaWpRest()
                .catch(function () { return self.fetchViaRss(); })
                .then(function (events) {
                    if (!events.length) throw new Error('empty');
                    self.writeCache(events);
                    return events;
                });
        }
    };

    window.ADWMec = Mec;
})();
