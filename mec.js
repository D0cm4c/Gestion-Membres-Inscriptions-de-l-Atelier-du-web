(function () {
    'use strict';

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

    // Parse une date française du type "le lundi 23 novembre", "Les 08 et 10 décembre 2026"
    function parseFrDate(text) {
        if (!text) return null;
        var months = { janvier: 1, 'février': 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, 'août': 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, 'décembre': 12, decembre: 12 };
        var m = text.toLowerCase().match(/(\d{1,2})(?:\s*(?:et|,|-)\s*\d{1,2})*\s+([a-zéû\d]+)\s*(\d{4})?/);
        if (!m) return null;
        var day = parseInt(m[1], 10);
        var month = months[m[2]];
        if (!month || !day) return null;
        var year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
        return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
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
            var mTime = clean.match(/Horaires?\s*:\s*([^\n]+?)(?=Votre|Vous|Allez|Venez|Lors|Pour|$)/);
            if (mTime) out.timeText = mTime[1].trim();
            else {
                mTime = clean.match(/Horaires?\s*:\s*(De\s*[\dh]+\s*[àa]\s*[\dh]+)/i);
                if (mTime) out.timeText = mTime[1].trim();
            }
            // Formats alternatifs : "1 demie – journée", "⏰ de 13h30 à 16h30"
            if (!out.duration) {
                var mDurAlt = clean.match(/(?:^|\s)(\d\s*(?:demie|matin[ée]e|apr[èe]s-midi|journ[ée]e|soir[ée]e|heure[s]?)[^📅⏰]*)/i);
                if (mDurAlt) out.duration = mDurAlt[1].trim().replace(/\s+/g, ' ');
            }
            if (!out.timeText) {
                var mTimeAlt = clean.match(/(?:[⏰:]\s*)?(de\s*[\dh]+\s*[àa]\s*[\dh]+)/i);
                if (mTimeAlt) out.timeText = mTimeAlt[1].trim();
            }
            if (!out.dateText) {
                var mDateAlt = clean.match(/(?:le |les )?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+\d{1,2}(?:\s*(?:et|,|-)\s*\d{1,2})*\s+[a-zéû\d]+\s*(?:\d{4})?/i);
                if (mDateAlt) out.dateText = mDateAlt[0].trim();
            }
            out.startDate = parseFrDate(out.dateText) || '';
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
                        var excerptText = stripHtml(item.excerpt && item.excerpt.rendered);
                        var fields = Mec.parseExcerptFields(excerptText);
                        events.push({
                            id: item.id,
                            title: stripHtml(item.title && item.title.rendered),
                            url: item.link,
                            excerpt: fields.description,
                            duration: fields.duration,
                            startDate: fields.startDate || '',
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
            }).catch(function () { return events; });
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
