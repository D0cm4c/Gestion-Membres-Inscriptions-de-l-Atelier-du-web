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
                        var dateMatch = excerptText.match(/[📅\s]*[Dd]ates?\s*:\s*([^⏰]+)/);
                        var dateText = dateMatch ? dateMatch[1] : '';
                        var timeMatch = excerptText.match(/[⏰\s]*Horaires?\s*:\s*([^A-Za-zÀ-ÿ]+)/);
                        var timeText = timeMatch ? timeMatch[1] : '';
                        events.push({
                            id: item.id,
                            title: stripHtml(item.title && item.title.rendered),
                            url: item.link,
                            excerpt: excerptText.split('Lire la suite')[0].trim(),
                            startDate: parseFrDate(dateText) || item.date.slice(0, 10),
                            timeLabel: timeText.trim(),
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
