(function () {
    'use strict';

    var DEFAULT_BASE = 'https://atelierduweb.be/wp-json/mec/v1.0';
    var TOKEN_KEY = 'atelierduweb_mec_token';
    var CACHE_KEY = 'atelierduweb_mec_events';
    var CACHE_TTL = 15 * 60 * 1000;

    var Mec = {
        baseUrl: DEFAULT_BASE,

        getToken: function () {
            try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
        },

        setToken: function (token) {
            try { localStorage.setItem(TOKEN_KEY, token || ''); } catch (e) { /* ignore */ }
        },

        request: function (path, params) {
            var token = this.getToken();
            if (!token) {
                return Promise.reject(new Error('missing_token'));
            }
            var qs = '';
            if (params) {
                var parts = Object.keys(params).map(function (k) {
                    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
                });
                qs = parts.length ? '?' + parts.join('&') : '';
            }
            return fetch(this.baseUrl + path + qs, {
                headers: { 'mec-token': token },
                Accept: 'application/json'
            }).then(function (res) {
                if (!res.ok) {
                    var err = new Error('http_' + res.status);
                    err.status = res.status;
                    throw err;
                }
                return res.json();
            });
        },

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
            } catch (e) { /* quota exceeded : ignore */ }
        },

        parseTime: function (t) {
            if (!t) return '';
            var h = parseInt(t.hour, 10);
            var m = parseInt(t.minutes, 10);
            if (isNaN(h)) return '';
            var ampm = (t.ampm || '').toUpperCase();
            if (ampm === 'PM' && h < 12) h += 12;
            if (ampm === 'AM' && h === 12) h = 0;
            return String(h).padStart(2, '0') + ':' + String(isNaN(m) ? 0 : m).padStart(2, '0');
        },

        pick: function (obj, keys) {
            for (var i = 0; i < keys.length; i++) {
                var v = obj[keys[i]];
                if (v !== undefined && v !== null && v !== '') return v;
            }
            return '';
        },

        normalize: function (raw, fallbackDate) {
            var self = this;
            var data = raw.data || raw;
            var title = self.pick(data, ['title', 'post_title', 'name']) || '';
            var id = self.pick(raw, ['ID', 'id', 'event_id']) || self.pick(data, ['ID', 'id']);
            var url = self.pick(data, ['url', 'permalink', 'link', 'post_url']);
            var start = raw.start || (raw.date && raw.date.start) || {};
            var end = raw.end || (raw.date && raw.date.end) || {};
            var startDate = start.date || fallbackDate || '';
            var startTime = self.parseTime(start);
            var endTime = self.parseTime(end);
            var allday = String(start.allday || raw.allday || '0') === '1';
            var timeLabel = allday ? 'Journée entière' : (startTime && endTime ? startTime + ' – ' + endTime : startTime);
            var location = '';
            if (data.location) {
                location = typeof data.location === 'string' ? data.location : (data.location.name || '');
            }
            var categories = [];
            if (Array.isArray(data.categories)) {
                categories = data.categories.map(function (c) { return typeof c === 'string' ? c : (c && c.name) || ''; }).filter(Boolean);
            } else if (data.category) {
                categories = [typeof data.category === 'string' ? data.category : data.category.name || ''];
            }
            var labels = [];
            if (Array.isArray(data.labels)) {
                labels = data.labels.map(function (l) { return typeof l === 'string' ? l : (l && l.name) || ''; }).filter(Boolean);
            }
            var excerpt = self.pick(data, ['excerpt', 'post_excerpt', 'content', 'description']);
            if (excerpt && excerpt.replace) {
                excerpt = excerpt.replace(/<[^>]*>/g, '').trim();
                if (excerpt.length > 180) excerpt = excerpt.slice(0, 177) + '…';
            }
            return {
                id: id,
                title: title,
                url: url,
                startDate: startDate,
                timeLabel: timeLabel,
                allday: allday,
                location: location,
                categories: categories,
                labels: labels,
                excerpt: excerpt,
                raw: raw
            };
        },

        fetchAllEvents: function () {
            var self = this;
            var all = [];
            var startDate = '';
            var offset = 0;

            function page() {
                var params = { limit: 50, order: 'ASC', include_past_events: 0, offset: offset };
                if (startDate) params.start_date = startDate;
                return self.request('/events', params).then(function (res) {
                    var byDate = res.events || {};
                    var found = 0;
                    Object.keys(byDate).sort().forEach(function (dateKey) {
                        var list = byDate[dateKey];
                        if (!Array.isArray(list)) return;
                        list.forEach(function (raw) {
                            all.push(self.normalize(raw, dateKey));
                            found++;
                        });
                    });
                    var pag = res.pagination || {};
                    if (pag.has_more_events) {
                        startDate = pag.next_date || startDate;
                        offset = pag.next_offset || 0;
                        return page();
                    }
                    return all;
                });
            }

            return page();
        },

        load: function () {
            var self = this;
            var cached = self.readCache();
            if (cached && cached.events && cached.events.length) {
                return Promise.resolve(cached.events);
            }
            return self.fetchAllEvents().then(function (events) {
                self.writeCache(events);
                return events;
            });
        }
    };

    window.ADWMec = Mec;
})();
