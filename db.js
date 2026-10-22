(function () {
    'use strict';

    // Couche données : SQLite via sql.js (WebAssembly) persisté en IndexedDB.
    // Expose window.ADWDatabase — 36 méthodes métier (schéma, CRUD, sync, matching, RGPD).
    // ⚠️ Schéma et requêtes STANDARD : prévus pour migrer tels quels vers better-sqlite3
    // côté serveur (voir docs/BACKEND.md). Ne pas introduire d'API navigateur dans la logique métier.

    var DB_NAME = 'atelierduweb-db';
    var STORE = 'sqlite';
    var DB_KEY = 'db';
    var initSqlJs = window.initSqlJs || self.initSqlJs;

    function openIndexedDB() {
        return new Promise(function (resolve, reject) {
            var req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = function () {
                req.result.createObjectStore(STORE);
            };
            req.onsuccess = function () { resolve(req.result); };
            req.onerror = function () { reject(req.error); };
        });
    }

    function loadFromIndexedDB(idb) {
        return new Promise(function (resolve, reject) {
            var tx = idb.transaction([STORE], 'readonly');
            var req = tx.objectStore(STORE).get(DB_KEY);
            req.onsuccess = function () { resolve(req.result); };
            req.onerror = function () { reject(req.error); };
        });
    }

    function saveToIndexedDB(idb, bytes) {
        return new Promise(function (resolve, reject) {
            var tx = idb.transaction([STORE], 'readwrite');
            tx.objectStore(STORE).put(bytes, DB_KEY);
            tx.oncomplete = function () { resolve(); };
            tx.onerror = function () { reject(tx.error); };
        });
    }

    function nextMemberNo(db) {
        var used = {};
        var res = db.exec('SELECT member_no FROM members WHERE member_no IS NOT NULL');
        if (res.length) res[0].values.forEach(function (r) { used[r[0]] = true; });
        var next = 1000;
        while (used[next]) next++;
        if (next > 9999) return null;
        return next;
    }

    function migrateLocalStorage(db) {
        var raw = null;
        try { raw = localStorage.getItem('atelierduweb_members'); } catch (e) { return; }
        if (!raw) return;
        try {
            var members = JSON.parse(raw);
            if (!Array.isArray(members) || !members.length) return;
            var stmt = db.prepare(
                'INSERT INTO members (id, first_name, last_name, age, phone, email, address, start_date, end_date) ' +
                'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            members.forEach(function (m) {
                stmt.run([
                    m.id, m.firstName || '', m.lastName || '',
                    m.age ? Number(m.age) : null,
                    m.phone || '', m.email || '', m.address || '',
                    m.startDate || null, m.endDate || null
                ]);
            });
            stmt.free();
            localStorage.removeItem('atelierduweb_members');
        } catch (e) { /* migration best effort */ }
    }

    function ensureSchema(db) {
        db.run(
            'CREATE TABLE IF NOT EXISTS members (' +
            'id TEXT PRIMARY KEY,' +
            'first_name TEXT NOT NULL,' +
            'last_name TEXT NOT NULL,' +
            'age INTEGER,' +
            'phone TEXT,' +
            'email TEXT,' +
            'address TEXT,' +
            'start_date TEXT,' +
            'end_date TEXT,' +
            'subscription TEXT DEFAULT \'none\',' +
            'member_no INTEGER UNIQUE,' +
            'postal_code TEXT,' +
            'gender TEXT,' +
            'social_status TEXT,' +
            'created_at TEXT DEFAULT (datetime(\'now\'))' +
            ')'
        );
        db.run(
            'CREATE TABLE IF NOT EXISTS prints (' +
            'id TEXT PRIMARY KEY,' +
            'member_id TEXT NOT NULL,' +
            'print_date TEXT NOT NULL,' +
            'type TEXT NOT NULL CHECK (type IN (\'bw\', \'color\')),' +
            'amount REAL NOT NULL,' +
            'paid INTEGER DEFAULT 0,' +
            'paid_date TEXT,' +
            'created_at TEXT DEFAULT (datetime(\'now\')),' +
            'FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE' +
            ')'
        );
        db.run(
            'CREATE TABLE IF NOT EXISTS visits (' +
            'id TEXT PRIMARY KEY,' +
            'member_id TEXT NOT NULL,' +
            'visit_date TEXT NOT NULL,' +
            'amount REAL DEFAULT 1.0,' +
            'created_at TEXT DEFAULT (datetime(\'now\')),' +
            'FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE' +
            ')'
        );
        db.run(
            'CREATE TABLE IF NOT EXISTS formations (' +
            'id TEXT PRIMARY KEY,' +
            'event_id TEXT UNIQUE,' +
            'title TEXT NOT NULL,' +
            'start_date TEXT,' +
            'date_text TEXT,' +
            'time_label TEXT,' +
            'duration TEXT,' +
            'excerpt TEXT,' +
            'url TEXT,' +
            'categories TEXT,' +
            'price REAL,' +
            'organizer TEXT,' +
            'location TEXT,' +
            'synced_at TEXT,' +
            'created_at TEXT DEFAULT (datetime(\'now\'))' +
            ')'
        );
        db.run(
            'CREATE TABLE IF NOT EXISTS formations_members (' +
            'id TEXT PRIMARY KEY,' +
            'formation_id TEXT NOT NULL,' +
            'member_id TEXT NOT NULL,' +
            'registered_at TEXT DEFAULT (datetime(\'now\')),' +
            'UNIQUE(formation_id, member_id),' +
            'FOREIGN KEY (formation_id) REFERENCES formations(id) ON DELETE CASCADE,' +
            'FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE' +
            ')'
        );
        db.run(
            'CREATE TABLE IF NOT EXISTS notifications (' +
            'id TEXT PRIMARY KEY,' +
            'type TEXT NOT NULL,' +       // sync_formations | auto_link | auto_unlink | awaiting_validation | member_created | info | error
            'severity TEXT NOT NULL DEFAULT \'info\',' + // info | success | warning | danger
            'message TEXT NOT NULL,' +
            'details TEXT,' +              // JSON optionnel
            'is_read INTEGER DEFAULT 0,' +
            'created_at TEXT DEFAULT (datetime(\'now\'))' +
            ')'
        );
        db.run(
            'CREATE TABLE IF NOT EXISTS bookings_remote (' +
            'id TEXT PRIMARY KEY,' +      // id de réservation MEC (clé naturelle)
            'event_id TEXT,' +
            'member_no INTEGER,' +         // champ optionnel saisi par l'usager (n° de membre)
            'first_name TEXT,' +
            'last_name TEXT,' +
            'email TEXT,' +
            'booked_at TEXT,' +           // date de réservation côté site
            'status TEXT,' +              // statut MEC (confirmed/pending/canceled…)
            'synced_at TEXT,' +
            'processed INTEGER DEFAULT 0,' +  // 0 = à traiter, 1 = traité (rattaché/créé/ignoré)
            'processed_action TEXT,' +      // linked | created | ignored | auto_linked
            'processed_at TEXT,' +
            'local_member_id TEXT' +       // membre rattaché dans l'app
            ')'
        );
        // Migration formations : colonnes organizer/location ajoutées en oct. 2026
        var fcols = {};
        var fres = db.exec('PRAGMA table_info(formations)');
        if (fres.length) {
            fres[0].values.forEach(function (row) { fcols[row[1]] = true; });
        }
        if (!fcols.organizer) {
            db.run('ALTER TABLE formations ADD COLUMN organizer TEXT');
        }
        if (!fcols.location) {
            db.run('ALTER TABLE formations ADD COLUMN location TEXT');
        }
        if (!fcols.room_id) {
            db.run('ALTER TABLE formations ADD COLUMN room_id TEXT');
        }
        db.run(
            'CREATE TABLE IF NOT EXISTS rooms (' +
            'id TEXT PRIMARY KEY,' +
            'name TEXT NOT NULL,' +
            'capacity INTEGER,' +
            'sort_order INTEGER DEFAULT 0,' +
            'created_at TEXT DEFAULT (datetime(\'now\'))' +
            ')'
        );
        db.run(
            'CREATE TABLE IF NOT EXISTS formation_dates (' +
            'id TEXT PRIMARY KEY,' +
            'formation_id TEXT NOT NULL,' +
            'date TEXT NOT NULL,' +
            'slot TEXT NOT NULL CHECK (slot IN (\'AM\', \'PM\')),' +
            'UNIQUE(formation_id, date, slot),' +
            'FOREIGN KEY (formation_id) REFERENCES formations(id) ON DELETE CASCADE' +
            ')'
        );
        db.run('CREATE INDEX IF NOT EXISTS idx_fdates ON formation_dates(date, slot)');
        db.run(
            'CREATE TABLE IF NOT EXISTS suggestions (' +
            'id TEXT PRIMARY KEY,' +
            'message TEXT NOT NULL,' +
            'page TEXT,' +               // page d'origine (location.pathname)
            'author TEXT,' +            // optionnel : nom de l'animateur
            'status TEXT DEFAULT \'open\',' + // open | done | discarded
            'created_at TEXT DEFAULT (datetime(\'now\')),' +
            'handled_at TEXT' +
            ')'
        );
        db.run('CREATE INDEX IF NOT EXISTS idx_sugg_status ON suggestions(status, created_at)');
        db.run('CREATE INDEX IF NOT EXISTS idx_notif_unread ON notifications(is_read, created_at)');
        db.run('CREATE INDEX IF NOT EXISTS idx_booking_unprocessed ON bookings_remote(processed, booked_at)');
        var cols = {};
        var res = db.exec('PRAGMA table_info(members)');
        if (res.length) {
            res[0].values.forEach(function (row) { cols[row[1]] = true; });
        }
        if (!cols.subscription) {
            db.run('ALTER TABLE members ADD COLUMN subscription TEXT DEFAULT \'none\'');
        }
        if (!cols.member_no) {
            db.run('ALTER TABLE members ADD COLUMN member_no INTEGER');
        }
        if (!cols.postal_code) {
            db.run('ALTER TABLE members ADD COLUMN postal_code TEXT');
        }
        if (!cols.gender) {
            db.run('ALTER TABLE members ADD COLUMN gender TEXT');
        }
        if (!cols.social_status) {
            db.run('ALTER TABLE members ADD COLUMN social_status TEXT');
        }
        db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_members_no ON members(member_no)');
        // Salles par defaut (premier chargement seulement)
        var roomCount = db.exec('SELECT COUNT(*) FROM rooms');
        if (!roomCount.length || roomCount[0].values[0][0] === 0) {
            db.run("INSERT INTO rooms (id, name, capacity, sort_order) VALUES ('room-grande', 'Grande salle', 15, 1)");
            db.run("INSERT INTO rooms (id, name, capacity, sort_order) VALUES ('room-petite', 'Petite salle', 8, 2)");
            db.run("INSERT INTO rooms (id, name, capacity, sort_order) VALUES ('room-cyber', 'Cyber-espace', 25, 3)");
        }

        var missing = db.exec("SELECT id FROM members WHERE member_no IS NULL");
        if (missing.length) {
            var used = {};
            var existingNos = db.exec('SELECT member_no FROM members WHERE member_no IS NOT NULL');
            if (existingNos.length && existingNos[0].values) {
                existingNos[0].values.forEach(function (r) { used[r[0]] = true; });
            }
            var next = 1000;
            var stmt = db.prepare('UPDATE members SET member_no = ? WHERE id = ?');
            missing[0].values.forEach(function (row) {
                while (used[next]) next++;
                stmt.run([next, row[0]]);
                used[next] = true;
            });
            stmt.free();
        }
    }

    var Database = {
        db: null,
        idb: null,

        init: function () {
            var self = this;
            return initSqlJs({ locateFile: function (file) { return 'vendor/' + file; } })
                .then(function (SQL) {
                    return openIndexedDB().then(function (idb) {
                        self.idb = idb;
                        return loadFromIndexedDB(idb);
                    }).then(function (bytes) {
                        self.db = bytes ? new SQL.Database(new Uint8Array(bytes)) : new SQL.Database();
                        ensureSchema(self.db);
                        migrateLocalStorage(self.db);
                        return self;
                    });
                });
        },

        persist: function () {
            var self = this;
            if (this._persistTimer) clearTimeout(this._persistTimer);
            return new Promise(function (resolve) {
                self._persistTimer = setTimeout(function () {
                    self._persistTimer = null;
                    saveToIndexedDB(self.idb, self.db.export()).then(resolve, resolve);
                }, 250);
            });
        },

        flush: function () {
            if (this._persistTimer) {
                clearTimeout(this._persistTimer);
                this._persistTimer = null;
            }
            return saveToIndexedDB(this.idb, this.db.export());
        },

        queryAll: function (sql, params) {
            var stmt = this.db.prepare(sql);
            if (params) stmt.bind(params);
            var rows = [];
            while (stmt.step()) rows.push(stmt.getAsObject());
            stmt.free();
            return rows;
        },

        run: function (sql, params) {
            if (params) {
                this.db.run(sql, params);
            } else {
                this.db.run(sql);
            }
            return this.persist();
        }
    };

    Database.nextMemberNo = function () { return nextMemberNo(this.db); };

    // ============ Formations : synchronisation & inscriptions ============

    Database.syncFormations = function (events) {
        // events : liste normalisée venue de ADWMec.load()
        var self = this;
        var db = this.db;
        var now = new Date().toISOString();
        var keptIds = [];
        events.forEach(function (ev) {
            var existing = self.queryAll('SELECT id FROM formations WHERE event_id = ?', [String(ev.id)]);
            var categories = (ev.categories || []).join(', ');
            var formationId;
            if (existing.length) {
                formationId = existing[0].id;
                db.run(
                    'UPDATE formations SET title = ?, start_date = ?, date_text = ?, time_label = ?, duration = ?, excerpt = ?, url = ?, categories = ?, synced_at = ? WHERE event_id = ?',
                    [ev.title, ev.startDate || null, ev.dateText || null, ev.timeLabel || null, ev.duration || null, ev.excerpt || null, ev.url || null, categories || null, now, String(ev.id)]
                );
            } else {
                formationId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
                db.run(
                    'INSERT INTO formations (id, event_id, title, start_date, date_text, time_label, duration, excerpt, url, categories, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [formationId, String(ev.id), ev.title, ev.startDate || null, ev.dateText || null, ev.timeLabel || null, ev.duration || null, ev.excerpt || null, ev.url || null, categories || null, now]
                );
            }
            keptIds.push(formationId);
            // Dates + creneaux pour le planning des salles
            if (ev.dates && ev.dates.length) {
                var slot = ev.slot || 'AM';
                db.run('DELETE FROM formation_dates WHERE formation_id = ?', [formationId]);
                ev.dates.forEach(function (d) {
                    var did = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
                    db.run('INSERT OR IGNORE INTO formation_dates (id, formation_id, date, slot) VALUES (?, ?, ?, ?)',
                        [did, formationId, d, slot]);
                });
            }
        });
        // Supprime les formations disparues du flux (et leurs inscriptions via CASCADE)
        if (keptIds.length) {
            var placeholders = keptIds.map(function () { return '?'; }).join(', ');
            db.run('DELETE FROM formations WHERE id NOT IN (' + placeholders + ')', keptIds);
        }
        this.persist();
        return keptIds.length;
    };

    Database.listFormations = function () {
        return this.queryAll('SELECT f.*, (SELECT COUNT(*) FROM formations_members fm WHERE fm.formation_id = f.id) AS attendee_count FROM formations f ORDER BY f.start_date ASC');
    };

    Database.getFormation = function (formationId) {
        var rows = this.queryAll('SELECT * FROM formations WHERE id = ?', [formationId]);
        return rows.length ? rows[0] : null;
    };

    Database.getFormationByEventId = function (eventId) {
        var rows = this.queryAll('SELECT * FROM formations WHERE event_id = ?', [String(eventId)]);
        return rows.length ? rows[0] : null;
    };

    Database.registerMemberToFormation = function (formationId, memberId) {
        var existing = this.queryAll('SELECT id FROM formations_members WHERE formation_id = ? AND member_id = ?', [formationId, memberId]);
        if (existing.length) return false; // déjà inscrit
        var rid = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        this.run('INSERT INTO formations_members (id, formation_id, member_id) VALUES (?, ?, ?)', [rid, formationId, memberId]);
        return true;
    };

    Database.unregisterMemberFromFormation = function (formationId, memberId) {
        this.run('DELETE FROM formations_members WHERE formation_id = ? AND member_id = ?', [formationId, memberId]);
    };

    Database.getFormationAttendees = function (formationId) {
        return this.queryAll(
            'SELECT m.id, m.first_name, m.last_name, m.member_no, m.email, m.phone, fm.registered_at ' +
            'FROM formations_members fm JOIN members m ON m.id = fm.member_id ' +
            'WHERE fm.formation_id = ? ORDER BY m.last_name ASC', [formationId]
        );
    };

    Database.getMemberFormations = function (memberId) {
        return this.queryAll(
            'SELECT f.id, f.title, f.start_date, f.time_label, f.url ' +
            'FROM formations_members fm JOIN formations f ON f.id = fm.formation_id ' +
            'WHERE fm.member_id = ? ORDER BY f.start_date ASC', [memberId]
        );
    };

    // ============ Notifications (journal des actions) ============

    Database.notify = function (type, message, severity, details) {
        var nid = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        this.run(
            'INSERT INTO notifications (id, type, severity, message, details) VALUES (?, ?, ?, ?, ?)',
            [nid, type, severity || 'info', message, details ? JSON.stringify(details) : null]
        );
        return nid;
    };

    Database.listNotifications = function (limit) {
        limit = limit || 50;
        return this.queryAll('SELECT * FROM notifications ORDER BY created_at DESC, id DESC LIMIT ' + parseInt(limit, 10));
    };

    Database.unreadNotificationsCount = function () {
        var rows = this.queryAll('SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0');
        return rows.length ? rows[0].c : 0;
    };

    Database.markAllNotificationsRead = function () {
        this.run('UPDATE notifications SET is_read = 1 WHERE is_read = 0');
    };

    Database.clearNotifications = function () {
        this.run('DELETE FROM notifications');
    };

    // ============ Bookings distants (sync MEC) ============

    Database.upsertBookings = function (bookings) {
        // bookings : [{ id, event_id, member_no, first_name, last_name, email, booked_at, status }]
        var self = this;
        var now = new Date().toISOString();
        var added = 0, updated = 0;
        bookings.forEach(function (b) {
            var existing = self.queryAll('SELECT id FROM bookings_remote WHERE id = ?', [String(b.id)]);
            if (existing.length) {
                self.db.run(
                    'UPDATE bookings_remote SET event_id = ?, member_no = ?, first_name = ?, last_name = ?, email = ?, booked_at = ?, status = ?, synced_at = ? WHERE id = ?',
                    [String(b.event_id || ''), b.member_no || null, b.first_name || '', b.last_name || '', b.email || '', b.booked_at || '', b.status || '', now, String(b.id)]
                );
                updated++;
            } else {
                self.db.run(
                    'INSERT INTO bookings_remote (id, event_id, member_no, first_name, last_name, email, booked_at, status, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [String(b.id), String(b.event_id || ''), b.member_no || null, b.first_name || '', b.last_name || '', b.email || '', b.booked_at || '', b.status || '', now]
                );
                added++;
            }
        });
        this.persist();
        return { added: added, updated: updated };
    };

    Database.listUnprocessedBookings = function () {
        return this.queryAll('SELECT * FROM bookings_remote WHERE processed = 0 ORDER BY booked_at ASC');
    };

    Database.markBookingProcessed = function (bookingId, action, localMemberId) {
        this.run(
            'UPDATE bookings_remote SET processed = 1, processed_action = ?, processed_at = ?, local_member_id = ? WHERE id = ?',
            [action, new Date().toISOString(), localMemberId || null, String(bookingId)]
        );
    };

    // ============ Salles & planning ============

    Database.listRooms = function () {
        return this.queryAll('SELECT * FROM rooms ORDER BY sort_order ASC, name ASC');
    };

    Database.addRoom = function (name, capacity) {
        var id = 'room-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        var maxRow = this.queryAll('SELECT COALESCE(MAX(sort_order), 0) AS v FROM rooms')[0];
        var maxOrder = maxRow ? maxRow.v : 0;
        this.run('INSERT INTO rooms (id, name, capacity, sort_order) VALUES (?, ?, ?, ?)',
            [id, String(name || '').trim(), parseInt(capacity, 10) || null, (maxOrder || 0) + 1]);
        try { this.flush(); } catch (e) { /* best effort */ }
        return id;
    };

    Database.renameRoom = function (roomId, name) {
        this.run('UPDATE rooms SET name = ? WHERE id = ?', [String(name || '').trim(), roomId]);
        try { this.flush(); } catch (e) { /* best effort */ }
    };

    // Suppression refusée si des formations y sont attribuées : renvoyer la liste bloquante
    Database.deleteRoom = function (roomId) {
        var used = this.queryAll('SELECT title FROM formations WHERE room_id = ?', [roomId]);
        if (used.length) return { ok: false, blocked: used };
        this.run('DELETE FROM rooms WHERE id = ?', [roomId]);
        try { this.flush(); } catch (e) { /* best effort */ }
        return { ok: true };
    };

    Database.setFormationRoom = function (formationId, roomId) {
        this.run('UPDATE formations SET room_id = ? WHERE id = ?', [roomId || null, formationId]);
    };

    // Dates+creneaux d'une formation (re-calculables depuis date_text/time_label)
    Database.setFormationDates = function (formationId, dates) {
        // dates : [{ date: '2026-12-08', slot: 'AM' }]
        var self = this;
        this.db.run('DELETE FROM formation_dates WHERE formation_id = ?', [formationId]);
        dates.forEach(function (d) {
            var did = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
            self.db.run('INSERT INTO formation_dates (id, formation_id, date, slot) VALUES (?, ?, ?, ?)',
                [did, formationId, d.date, d.slot]);
        });
        this.persist();
    };

    Database.getFormationDates = function (formationId) {
        return this.queryAll('SELECT date, slot FROM formation_dates WHERE formation_id = ? ORDER BY date ASC', [formationId]);
    };

    // Grille du mois : toutes les occupations (date, slot, room) avec la formation
    Database.getRoomPlanning = function (monthStart, monthEnd) {
        return this.queryAll(
            'SELECT fd.date, fd.slot, fd.formation_id AS fid, f.title, f.event_id, f.categories ' +
            'FROM formation_dates fd JOIN formations f ON f.id = fd.formation_id ' +
            'WHERE fd.date >= ? AND fd.date <= ? ' +
            'ORDER BY fd.date ASC, fd.slot ASC', [monthStart, monthEnd]);
    };

    // Conflits : meme salle x meme date x meme creneau
    Database.getRoomConflicts = function (formationId, roomId) {
        var dates = this.getFormationDates(formationId);
        if (!dates.length || !roomId) return [];
        var conflicts = [];
        var self = this;
        dates.forEach(function (d) {
            var rows = self.queryAll(
                'SELECT fd.formation_id AS fid, f.title, fd.date, fd.slot ' +
                'FROM formation_dates fd JOIN formations f ON f.id = fd.formation_id ' +
                'WHERE f.room_id = ? AND fd.date = ? AND fd.slot = ? AND fd.formation_id != ?',
                [roomId, d.date, d.slot, formationId]);
            conflicts = conflicts.concat(rows);
        });
        return conflicts;
    };

    Database.formationsWithoutRoom = function () {
        return this.queryAll(
            "SELECT f.*, (SELECT COUNT(*) FROM formation_dates fd WHERE fd.formation_id = f.id) AS date_count " +
            "FROM formations f WHERE f.room_id IS NULL ORDER BY f.start_date ASC");
    };

    // ============ RGPD : effacement ============

    // Effacement complet d'un membre (droit à l'effacement) :
    // membre + visites + impressions + liens formations + notifications liées
    Database.deleteMemberCompletely = function (memberId) {
        var self = this;
        return Promise.resolve().then(function () {
            self.run('DELETE FROM visits WHERE member_id = ?', [memberId]);
            self.run('DELETE FROM prints WHERE member_id = ?', [memberId]);
            self.run('DELETE FROM formations_members WHERE member_id = ?', [memberId]);
            self.run('DELETE FROM members WHERE id = ?', [memberId]);
            try { self.flush(); } catch (e) { /* best effort */ }
        });
    };

    // Purge RGPD de toutes les données personnelles (garde les formations/salles du site) :
    // membres, visites, impressions, liens formations, inscriptions en attente, suggestions
    Database.purgeAllPersonalData = function () {
        var self = this;
        return Promise.resolve().then(function () {
            ['visits', 'prints', 'formations_members', 'members', 'bookings_remote', 'suggestions'].forEach(function (table) {
                self.run('DELETE FROM ' + table);
            });
            try { self.flush(); } catch (e) { /* best effort */ }
        });
    };

    // ============ Suggestions ============

    Database.addSuggestion = function (message, page, author) {
        var sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        this.run(
            'INSERT INTO suggestions (id, message, page, author) VALUES (?, ?, ?, ?)',
            [sid, message, page || null, author || null]
        );
        return sid;
    };

    Database.listSuggestions = function () {
        return this.queryAll('SELECT * FROM suggestions ORDER BY created_at DESC');
    };

    Database.openSuggestionsCount = function () {
        var rows = this.queryAll("SELECT COUNT(*) AS c FROM suggestions WHERE status = 'open'");
        return rows.length ? rows[0].c : 0;
    };

    Database.setSuggestionStatus = function (id, status) {
        this.run('UPDATE suggestions SET status = ?, handled_at = datetime(\'now\') WHERE id = ?', [status, String(id)]);
    };

    // ============ Miroir : réservation annulée côté site → retrait local notifié ============
    // Règles décidées avec l'utilisateur (oct. 2026) :
    //  - booking traité (linked/auto_linked/created) + statut canceled → retirer l'inscription locale,
    //    notifier, et remettre processed = 0 (pour ne pas ressusciter l'inscription au re-match)
    //  - booking non traité + statut canceled → marquer traité-ignoré (ne pollue pas la file)
    //  Retourne la liste des retraits effectués pour notification groupée.
    Database.applyMirror = function () {
        var self = this;
        var removals = [];
        var resetIds = [];
        var canceledProcessed = this.queryAll(
            "SELECT * FROM bookings_remote WHERE processed = 1 AND processed_action != 'ignored' AND UPPER(status) IN ('CANCELED', 'CANCELLED', 'TRASH', 'REJECTED')"
        );
        canceledProcessed.forEach(function (b) {
            if (b.local_member_id) {
                // Retrouve l'inscription locale (formation via event_id)
                var formation = self.queryAll('SELECT id, title FROM formations WHERE event_id = ?', [String(b.event_id)]);
                var member = self.queryAll('SELECT id, first_name, last_name FROM members WHERE id = ?', [b.local_member_id]);
                if (formation.length && member.length) {
                    self.db.run('DELETE FROM formations_members WHERE formation_id = ? AND member_id = ?', [formation[0].id, member[0].id]);
                    removals.push({
                        memberName: member[0].first_name + ' ' + member[0].last_name,
                        formationTitle: formation[0].title,
                        bookingId: b.id
                    });
                }
            }
            // Le booking redevient non-traité ; s'il est réimporté plus tard,
            // il repassera dans la file sans jamais ressusciter une inscription annulée.
            self.db.run(
                'UPDATE bookings_remote SET processed = 0, processed_action = NULL, processed_at = NULL, local_member_id = NULL WHERE id = ?',
                [String(b.id)]
            );
            resetIds.push(String(b.id));
        });
        // Non traités mais annulés côté site → ignorés (ne pas polluer la file de validation).
        // On exclut ceux qu'on vient de reseter (sinon ils seraient re-capturés immédiatement).
        if (resetIds.length) {
            var placeholders = resetIds.map(function () { return '?'; }).join(', ');
            this.db.run(
                "UPDATE bookings_remote SET processed = 1, processed_action = 'ignored', processed_at = datetime('now') WHERE processed = 0 AND id NOT IN (" + placeholders + ") AND UPPER(status) IN ('CANCELED', 'CANCELLED', 'TRASH', 'REJECTED')",
                resetIds
            );
        } else {
            this.db.run(
                "UPDATE bookings_remote SET processed = 1, processed_action = 'ignored', processed_at = datetime('now') WHERE processed = 0 AND UPPER(status) IN ('CANCELED', 'CANCELLED', 'TRASH', 'REJECTED')"
            );
        }
        if (removals.length) this.persist();
        return removals;
    };

    // Matching : hiérarchie n° membre > email > nom/prénom
    Database.matchBookingToMember = function (booking) {
        // 1. n° de membre exact (le plus fort)
        if (booking.member_no) {
            var byNo = this.queryAll(
                'SELECT * FROM members WHERE member_no = ? LIMIT 2', [Number(booking.member_no)]
            );
            if (byNo.length === 1) {
                return { member: byNo[0], method: 'member_no', certain: true };
            }
        }
        // 2. email exact (insensible à la casse)
        if (booking.email) {
            var byEmail = this.queryAll(
                'SELECT * FROM members WHERE LOWER(email) = LOWER(?) LIMIT 2', [booking.email]
            );
            if (byEmail.length === 1) {
                return { member: byEmail[0], method: 'email', certain: true };
            }
            if (byEmail.length > 1) {
                return { candidates: byEmail, method: 'email', certain: false };
            }
        }
        // 3. nom + prénom normalisés → candidats (jamais certain)
        var norm = function (s) {
            return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
        };
        var candidates = this.queryAll(
            'SELECT * FROM members WHERE LOWER(last_name) = ? AND LOWER(first_name) = ?',
            [norm(booking.last_name), norm(booking.first_name)]
        );
        if (candidates.length) {
            return { candidates: candidates, method: 'name', certain: false };
        }
        return { method: 'none', certain: false };
    };

    window.addEventListener('beforeunload', function () {
        try { Database.flush(); } catch (e) { /* best effort */ }
    });

    window.ADWDatabase = Database;
})();
