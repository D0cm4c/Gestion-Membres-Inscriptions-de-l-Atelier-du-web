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
        if (!fcols.labels) {
            db.run('ALTER TABLE formations ADD COLUMN labels TEXT');
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
        // Journal d'audit des paiements (fiche formation) : chaque clic bancontact/cash
        // est tracé (paiement, annulation) — historique en cas de fausse manœuvre.
        db.run(
            'CREATE TABLE IF NOT EXISTS fm_payment_log (' +
            'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
            'formation_id TEXT NOT NULL,' +
            'member_id TEXT NOT NULL,' +
            'action TEXT NOT NULL,' +      // paid | cleared
            'method TEXT,' +               // bancontact | cash (null si cleared)
            'created_at TEXT DEFAULT (datetime(' + "'" + 'now' + "'" + '))' +
            ')'
        );
        db.run('CREATE INDEX IF NOT EXISTS idx_fmpaylog ON fm_payment_log(formation_id, member_id, created_at)');
        // Listes d'attente : membres intéressés par une formation (complète ou future).
        // formation_event_id : la formation existante (fiche formation complète)
        // formation_title    : intitulé générique (intérêt pour une future session)
        // Le matching à la synchro se fait sur l'un OU l'autre (titre normalisé).
        db.run(
            'CREATE TABLE IF NOT EXISTS waitlist (' +
            'id TEXT PRIMARY KEY,' +
            'member_id TEXT NOT NULL,' +
            'formation_event_id TEXT,' +    // event_id MEC si la formation existe
            'formation_title TEXT NOT NULL,' + // intitulé (titre de la formation ou texte libre)
            'status TEXT DEFAULT ' + "'" + 'waiting' + "'" + ',' + // waiting | contacted | enrolled
            'contacted_at TEXT,' +          // dernière fois qu'on a proposé les nouvelles dates
            'created_at TEXT DEFAULT (datetime(' + "'" + 'now' + "'" + '))' +
            ')'
        );
        db.run('CREATE INDEX IF NOT EXISTS idx_waitlist ON waitlist(member_id, formation_event_id)');
        db.run(
            'CREATE TABLE IF NOT EXISTS tickets (' +
            'id TEXT PRIMARY KEY,' +
            'title TEXT NOT NULL,' +
            'description TEXT,' +
            'category TEXT DEFAULT \'other\',' +      // computer | printer | network | software | furniture | other
            'equipment TEXT,' +                        // ex. « PC 12 », « Imprimante HP accueil »
            'priority TEXT DEFAULT \'normal\',' +     // low | normal | high | urgent
            'status TEXT DEFAULT \'open\',' +        // open | in_progress | resolved | closed
            'assignee TEXT,' +                         // nom de l'animateur (texte libre, pas de comptes)
            'created_by TEXT,' +
            'created_at TEXT DEFAULT (datetime(\'now\')),' +
            'updated_at TEXT DEFAULT (datetime(\'now\')),' +
            'resolved_at TEXT' +
            ')'
        );
        db.run('CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status, priority, created_at)');
        db.run(
            'CREATE TABLE IF NOT EXISTS ticket_comments (' +
            'id TEXT PRIMARY KEY,' +
            'ticket_id TEXT NOT NULL,' +
            'author TEXT,' +                 // nom de l'animateur (texte libre)
            'message TEXT NOT NULL,' +
            'created_at TEXT DEFAULT (datetime(\'now\'))' +
            ')'
        );
        db.run('CREATE INDEX IF NOT EXISTS idx_tcomments ON ticket_comments(ticket_id, created_at)');
        db.run(
            'CREATE TABLE IF NOT EXISTS team_members (' +
            'id TEXT PRIMARY KEY,' +
            'name TEXT NOT NULL UNIQUE,' +   // nom de l'animateur/bénévole (équipe technique)
            'sort_order INTEGER DEFAULT 0,' +
            'created_at TEXT DEFAULT (datetime(\'now\'))' +
            ')'
        );
        var cols = {};
        var res = db.exec('PRAGMA table_info(members)');
        if (res.length) {
            res[0].values.forEach(function (row) { cols[row[1]] = true; });
        }
        // 1re inscription historique (préservée lors des renouvellements) — ajout oct. 2026
        // Suivi formation-membre : paiement (bancontact/cash) et présence (present/canceled) — oct. 2026
        var colsFm = {};
        try {
            db.run('ALTER TABLE formations_members ADD COLUMN payment TEXT');
        } catch (e) { /* colonne déjà là */ }
        try {
            db.run('ALTER TABLE formations_members ADD COLUMN attendance TEXT');
        } catch (e) { /* colonne déjà là */ }
        try {
            db.run('ALTER TABLE formations_members ADD COLUMN payment_at TEXT');
        } catch (e) { /* colonne déjà là */ }
        try {
            var fmCols = {};
            db.each('PRAGMA table_info(formations_members)', function (r) { fmCols[r.name] = true; });
            if (!fmCols.payment) db.run('ALTER TABLE formations_members ADD COLUMN payment TEXT');
            if (!fmCols.attendance) db.run('ALTER TABLE formations_members ADD COLUMN attendance TEXT');
            if (!fmCols.payment_at) db.run('ALTER TABLE formations_members ADD COLUMN payment_at TEXT');
        } catch (e) { /* best effort */ }

        if (!cols.first_start_date) {
            db.run('ALTER TABLE members ADD COLUMN first_start_date TEXT');
            db.run('UPDATE members SET first_start_date = start_date WHERE first_start_date IS NULL AND start_date IS NOT NULL');
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
                    'UPDATE formations SET title = ?, start_date = ?, date_text = ?, time_label = ?, duration = ?, excerpt = ?, url = ?, categories = ?, ' +
                    'price = COALESCE(?, price), location = COALESCE(?, location), organizer = COALESCE(?, organizer), labels = COALESCE(?, labels), synced_at = ? WHERE event_id = ?',
                    [ev.title, ev.startDate || null, ev.dateText || null, ev.timeLabel || null, ev.duration || null, ev.excerpt || null, ev.url || null, categories || null,
                     ev.price || null, ev.location || null, ev.organizer || null, (ev.labels || []).join(', ') || null, now, String(ev.id)]
                );
            } else {
                formationId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
                db.run(
                    'INSERT INTO formations (id, event_id, title, start_date, date_text, time_label, duration, excerpt, url, categories, price, location, organizer, labels, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [formationId, String(ev.id), ev.title, ev.startDate || null, ev.dateText || null, ev.timeLabel || null, ev.duration || null, ev.excerpt || null, ev.url || null, categories || null,
                     ev.price || null, ev.location || null, ev.organizer || null, (ev.labels || []).join(', ') || null, now]
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

    // M\u00e9moire des formations : un intitul\u00e9 unique par formation r\u00e9elle (d\u00e9doublonn\u00e9).
    // Les sessions r\u00e9p\u00e9t\u00e9es (m\u00eame titre, dates diff\u00e9rentes) = une seule entr\u00e9e,
    // pointant vers la session la plus r\u00e9cente (event_id) pour le lien fiche.
    // Sert au dropdown des int\u00e9r\u00eats (fiche membre) : toute l'histoire des formations synchro.
    Database.listFormationTitlesDistinct = function () {
        var rows = this.queryAll('SELECT event_id, title, start_date FROM formations ORDER BY start_date DESC');
        var seen = {};
        var out = [];
        rows.forEach(function (f) {
            var key = (f.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
            if (!key || seen[key]) return;
            seen[key] = true;
            out.push({ event_id: f.event_id, title: f.title });
        });
        out.sort(function (a, b) { return a.title.localeCompare(b.title, 'fr'); });
        return out;
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
        // Le membre s'inscrit \u2192 il sort de la liste d'attente (plus besoin de l'attendre)
        // NB : formationId est l'id INTERNE ; la waitlist stocke l'event_id MEC -> r\u00e9soudre
        try {
            var ev = this.queryAll('SELECT event_id FROM formations WHERE id = ?', [String(formationId)])[0];
            if (ev && ev.event_id) {
                this.run('DELETE FROM waitlist WHERE member_id = ? AND formation_event_id = ?', [String(memberId), String(ev.event_id)]);
            }
        } catch (e) {}
        var existing = this.queryAll('SELECT id FROM formations_members WHERE formation_id = ? AND member_id = ?', [formationId, memberId]);
        if (existing.length) return false; // déjà inscrit
        var rid = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        this.run('INSERT INTO formations_members (id, formation_id, member_id) VALUES (?, ?, ?)', [rid, formationId, memberId]);
        return true;
    };

    Database.unregisterMemberFromFormation = function (formationId, memberId) {
        this.run('DELETE FROM formations_members WHERE formation_id = ? AND member_id = ?', [formationId, memberId]);
    };

    // ============ Listes d'attente ============

    Database.addToWaitlist = function (memberId, formationEventId, formationTitle) {
        // anti-doublon : le m\u00eame membre pour la m\u00eame formation (event_id ou intitul\u00e9) = une seule entr\u00e9e
        var dup = this.queryAll('SELECT id FROM waitlist WHERE member_id = ? AND ' +
            '(formation_event_id = ? OR (formation_event_id IS NULL AND LOWER(formation_title) = LOWER(?)))',
            [String(memberId), String(formationEventId || ''), String(formationTitle || '')]);
        if (dup.length) return dup[0].id; // d\u00e9j\u00e0 inscrit : pas de doublon
        var rid = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        this.run('INSERT INTO waitlist (id, member_id, formation_event_id, formation_title) VALUES (?, ?, ?, ?)',
            [rid, String(memberId), formationEventId ? String(formationEventId) : null, String(formationTitle)]);
        try { this.flush(); } catch (e) {}
        return rid;
    };

    Database.removeFromWaitlist = function (entryId) {
        this.run('DELETE FROM waitlist WHERE id = ?', [String(entryId)]);
        try { this.flush(); } catch (e) {}
    };

    // Liste d'attente pour une formation (event_id) OU un intitulé
    Database.getWaitlist = function (formationEventId, formationTitle) {
        var rows = this.queryAll('SELECT w.*, m.first_name, m.last_name, m.member_no, m.email, m.phone ' +
            'FROM waitlist w JOIN members m ON m.id = w.member_id ' +
            'WHERE (formation_event_id = ? OR (formation_event_id IS NULL AND LOWER(formation_title) = LOWER(?))) ' +
            'ORDER BY w.created_at ASC', [String(formationEventId || ''), String(formationTitle || '')]);
        return rows;
    };

    // Formations les plus attendues (dashboard) : waitlist groupée par formation
    // (event_id ou intitulé libre), triée par nombre de membres en attente.
    Database.getMostWaitedFormations = function (limit) {
        limit = parseInt(limit, 10) || 5;
        return this.queryAll(
            'SELECT COALESCE(formation_event_id, formation_title) AS fkey, ' +
            'MAX(formation_title) AS title, MAX(formation_event_id) AS event_id, ' +
            'COUNT(*) AS waiting, ' +
            'SUM(CASE WHEN status = ' + "'" + 'contacted' + "'" + ' THEN 1 ELSE 0 END) AS contacted ' +
            'FROM waitlist ' +
            'GROUP BY COALESCE(formation_event_id, formation_title) ' +
            'ORDER BY waiting DESC, title ASC LIMIT ' + limit
        );
    };

    // Intérêts d'un membre (fiche membre)
    Database.getMemberWaitlist = function (memberId) {
        return this.queryAll('SELECT * FROM waitlist WHERE member_id = ? ORDER BY created_at ASC', [String(memberId)]);
    };

    // Matching synchro : membres en attente pour une formation (par event_id ou titre normalisé)
    // Titre normalisé : minuscules, sans la partie dates (« LES 05, 06... »), sans ponctuation
    Database.normalizeTitle = function (title) {
        return String(title || '')
            .toLowerCase()
            .replace(/\s*\b(les?|du)\s+\d{1,2}(\s*[,–-]\s*\d{1,2})*\s*(\w+)?\b.*$/g, '') // « LES 05, 06 ET 13 NOVEMBRE » à la fin
            .replace(/[^a-z0-9àâäéèêëîïôöùûüç ]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    };

    Database.matchWaitlistForFormation = function (eventId, title) {
        // garde critique : un titre normalis\u00e9 vide ne doit JAMAIS matcher tout
        // (LIKE '%%' = toutes les listes d'attente -> faux positifs massifs)
        var norm = this.normalizeTitle(title);
        if (!norm || norm.length < 4) {
            // titre inexploitable : matching par event_id uniquement
            return this.queryAll('SELECT w.*, m.first_name, m.last_name, m.member_no, m.email, m.phone ' +
                'FROM waitlist w JOIN members m ON m.id = w.member_id ' +
                'WHERE formation_event_id = ? ORDER BY w.created_at ASC',
                [String(eventId || '')]);
        }
        return this.queryAll('SELECT w.*, m.first_name, m.last_name, m.member_no, m.email, m.phone ' +
            'FROM waitlist w JOIN members m ON m.id = w.member_id ' +
            'WHERE formation_event_id = ? OR (formation_event_id IS NULL AND LOWER(formation_title) LIKE ?) ' +
            'ORDER BY w.created_at ASC',
            [String(eventId || ''), '%' + norm + '%']);
    };

    Database.markWaitlistContacted = function (entryIds) {
        (entryIds || []).forEach(function (id) {
            this.run('UPDATE waitlist SET status = ?, contacted_at = datetime(' + "'" + 'now' + "'" + ') WHERE id = ?',
                ['contacted', String(id)]);
        }, this);
        try { this.flush(); } catch (e) {}
    };

    // Historique des clics de paiement pour un inscrit (fiche formation)
    Database.getPaymentLog = function (formationId, memberId) {
        return this.queryAll(
            'SELECT action, method, created_at FROM fm_payment_log ' +
            'WHERE formation_id = ? AND member_id = ? ORDER BY created_at ASC, id ASC',
            [String(formationId), String(memberId)]
        );
    };

    Database.getFormationAttendees = function (formationId) {
        return this.queryAll(
            'SELECT m.id, m.first_name, m.last_name, m.member_no, m.email, m.phone, fm.registered_at, fm.payment, fm.payment_at, fm.attendance ' +
            'FROM formations_members fm JOIN members m ON m.id = fm.member_id ' +
            'WHERE fm.formation_id = ? ORDER BY m.last_name ASC', [formationId]
        );
    };

    // Suivi formation-membre : paiement et présence (page formation, liste des inscrits)
    Database.setFmPayment = function (formationId, memberId, payment) {
        // payment : 'bancontact' | 'cash' | null (annule) — payment_at = date du clic (historique)
        this.run('UPDATE formations_members SET payment = ?, payment_at = ? WHERE formation_id = ? AND member_id = ?',
            [payment, payment ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null, String(formationId), String(memberId)]);
        // Journal d'audit : chaque clic (paiement ou annulation) est tracé
        try {
            this.run('INSERT INTO fm_payment_log (formation_id, member_id, action, method) VALUES (?, ?, ?, ?)',
                [String(formationId), String(memberId), payment ? 'paid' : 'cleared', payment ? String(payment) : null]);
        } catch (e) { /* journal best effort */ }
        try { this.flush(); } catch (e) { /* best effort */ }
    };
    Database.setFmAttendance = function (formationId, memberId, attendance) {
        // attendance : 'present' | 'canceled' | null (annule)
        this.run('UPDATE formations_members SET attendance = ? WHERE formation_id = ? AND member_id = ?',
            [attendance, String(formationId), String(memberId)]);
        try { this.flush(); } catch (e) { /* best effort */ }
    };

    Database.getMemberFormations = function (memberId) {
        return this.queryAll(
            'SELECT f.id, f.event_id, f.title, f.start_date, f.date_text, f.time_label, f.url, f.categories ' +
            'FROM formations_members fm JOIN formations f ON f.id = fm.formation_id ' +
            'WHERE fm.member_id = ? ORDER BY f.start_date DESC', [memberId]
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

    // Aper\u00e9u cloche : les non-lues d'abord, en SQL (pas de filtrage JS sur 50 lignes)
    Database.listNotificationsPreview = function (limit) {
        limit = parseInt(limit, 10) || 8;
        var unread = this.queryAll('SELECT * FROM notifications WHERE is_read = 0 ORDER BY created_at DESC, id DESC LIMIT ' + limit);
        if (unread.length < limit) {
            var recent = this.queryAll('SELECT * FROM notifications ORDER BY created_at DESC, id DESC LIMIT ' + limit);
            var seen = {};
            unread.forEach(function (n) { seen[n.id] = true; });
            recent.forEach(function (n) {
                if (!seen[n.id] && unread.length < limit) { unread.push(n); seen[n.id] = true; }
            });
        }
        return unread;
    };

    // Marquage individuel (page Notifications : lecture notif par notif)
    Database.markNotificationRead = function (id) {
        this.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [String(id)]);
    };

    // Effacer uniquement les lues (page Notifications : garder les non-lues)
    Database.clearReadNotifications = function () {
        this.run('DELETE FROM notifications WHERE is_read = 1');
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
            // Journal d'audit des paiements : purge RGPD (table sans FK)
            try { self.run('DELETE FROM fm_payment_log WHERE member_id = ?', [String(memberId)]); } catch (e) {}
            try { self.run('DELETE FROM waitlist WHERE member_id = ?', [String(memberId)]); } catch (e) {}
            self.run('DELETE FROM visits WHERE member_id = ?', [memberId]);
            self.run('DELETE FROM prints WHERE member_id = ?', [memberId]);
            self.run('DELETE FROM formations_members WHERE member_id = ?', [memberId]);
            self.run('DELETE FROM members WHERE id = ?', [memberId]);
            try { self.flush(); } catch (e) { /* best effort */ }
        });
    };

    // Purge RGPD de toutes les données personnelles (garde les formations/salles du site) :
    // membres, visites, impressions, liens formations, inscriptions en attente, suggestions
    // Renouveler l'inscription d'un membre : prolonge end_date selon la formule
    // (mensuel +1 mois, annuel +1 an, sans abonnement : +1 mois par défaut).
    // Si l'inscription est encore active : s'ajoute à la fin (aucun jour perdu).
    // Si expirée : repart de la date du jour. Retourne la nouvelle date de fin (AAAA-MM-JJ).
    // Aperçu de renouvellement SANS écriture : calcule les futures dates (double validation UI).
    // Inscription active : nouveau début = ancienne fin +1 jour, nouveau fin = +1 mois/1 an.
    // Expirée : nouveau début = aujourd'hui. start_date (1re inscription) reste intacte.
    Database.previewRenewal = function (memberId) {
        var m = this.queryAll('SELECT subscription, end_date FROM members WHERE id = ?', [String(memberId)])[0];
        if (!m) return null;
        var today = new Date();
        var todayStr = today.toISOString().slice(0, 10);
        var active = m.end_date && m.end_date >= todayStr;
        var base = active ? new Date(m.end_date + 'T00:00:00') : today;
        var addMonths = m.subscription === 'yearly' ? 12 : 1;
        var newStart;
        if (active) {
            newStart = new Date(base.getTime() + 86400000); // lendemain de la fin actuelle
        } else {
            newStart = today;
        }
        var d = new Date(base.getTime());
        d.setMonth(d.getMonth() + addMonths);
        var newEnd = d.toISOString().slice(0, 10);
        return { newStart: newStart.toISOString().slice(0, 10), newEnd: newEnd };
    };

    // Renouvellement effectif (après double validation UI) : le CYCLE change de dates
    // (start_date = nouveau début, end_date = nouvelle fin), tandis que first_start_date
    // fige la date de la TOUTE PREMIÈRE inscription — affichée sur la fiche membre.html.
    Database.renewSubscription = function (memberId, confirmedStart, confirmedEnd) {
        var newStart = confirmedStart;
        var newEnd = confirmedEnd;
        if (!newStart || !newEnd) {
            var p = this.previewRenewal(memberId);
            if (!p) return null;
            newStart = p.newStart;
            newEnd = p.newEnd;
        }
        // Figer la 1re inscription à la première occasion (si pas encore figée)
        this.run('UPDATE members SET first_start_date = COALESCE(first_start_date, start_date) WHERE id = ?', [String(memberId)]);
        this.run('UPDATE members SET start_date = ?, end_date = ? WHERE id = ?', [newStart, newEnd, String(memberId)]);
        try { this.flush(); } catch (e) { /* best effort */ }
        return { newStart: newStart, newEnd: newEnd };
    };

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

    // ============ Tickets (incidents du cyberespace) ============

    Database.addTicket = function (t) {
        var id = 'tk-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        this.run(
            'INSERT INTO tickets (id, title, description, category, equipment, priority, status, assignee, created_by, created_at, updated_at) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))',
            [id, String(t.title || '').trim(), t.description || null, t.category || 'other',
             t.equipment || null, t.priority || 'normal', t.status || 'open',
             t.assignee || null, t.created_by || null]
        );
        try { this.flush(); } catch (e) { /* best effort */ }
        return id;
    };

    Database.getTicket = function (id) {
        return (this.queryAll('SELECT * FROM tickets WHERE id = ?', [String(id)])[0]) || null;
    };

    Database.listTickets = function () {
        return this.queryAll(
            'SELECT * FROM tickets ORDER BY ' +
            'CASE status WHEN \'open\' THEN 0 WHEN \'in_progress\' THEN 1 WHEN \'resolved\' THEN 2 ELSE 3 END, ' +
            'CASE priority WHEN \'urgent\' THEN 0 WHEN \'high\' THEN 1 WHEN \'normal\' THEN 2 ELSE 3 END, ' +
            'created_at DESC'
        );
    };

    // Les statuts/priorités/assignations passent par updateTicket(champs autorisés uniquement)
    var TICKET_MUTABLE = ['title', 'description', 'category', 'equipment', 'priority', 'status', 'assignee'];
    Database.updateTicket = function (id, fields) {
        var sets = [];
        var params = [];
        Object.keys(fields || {}).forEach(function (k) {
            if (TICKET_MUTABLE.indexOf(k) === -1) return;
            sets.push(k + ' = ?');
            params.push(fields[k]);
        });
        if (!sets.length) return;
        sets.push('updated_at = datetime(\'now\')');
        if (fields.status === 'resolved' || fields.status === 'closed') sets.push('resolved_at = datetime(\'now\')');
        params.push(String(id));
        this.run('UPDATE tickets SET ' + sets.join(', ') + ' WHERE id = ?', params);
        try { this.flush(); } catch (e) { /* best effort */ }
    };

    // Suppression : protégée par garde admin côté UI (auth.js) — la règle est ici documentée
    // Suppression : supprime les commentaires PUIS le ticket, en une seule passe persistée
    // (pas de FK cascade en sql.js ici — la suppression des commentaires est explicite)
    Database.deleteTicket = function (id) {
        this.run('DELETE FROM ticket_comments WHERE ticket_id = ?', [String(id)]);
        this.run('DELETE FROM tickets WHERE id = ?', [String(id)]);
        try { this.flush(); } catch (e) { /* best effort */ }
    };

    Database.addTicketComment = function (ticketId, author, message) {
        var id = 'tc-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        this.run('INSERT INTO ticket_comments (id, ticket_id, author, message, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))',
            [id, String(ticketId), author || null, String(message || '').trim()]);
        // Un commentaire fait vivre le ticket (updated_at) sans changer son statut
        this.run('UPDATE tickets SET updated_at = datetime(\'now\') WHERE id = ?', [String(ticketId)]);
        try { this.flush(); } catch (e) { /* best effort */ }
        return id;
    };

    Database.listTicketComments = function (ticketId) {
        return this.queryAll('SELECT * FROM ticket_comments WHERE ticket_id = ? ORDER BY created_at ASC', [String(ticketId)]);
    };

    // ============ Équipe technique (assignation des tickets) ============

    Database.listTeamMembers = function () {
        return this.queryAll('SELECT * FROM team_members ORDER BY sort_order ASC, name ASC');
    };

    Database.addTeamMember = function (name) {
        var id = 'tm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        var maxRow = this.queryAll('SELECT COALESCE(MAX(sort_order), 0) AS v FROM team_members')[0];
        this.run('INSERT INTO team_members (id, name, sort_order) VALUES (?, ?, ?)',
            [id, String(name || '').trim(), (maxRow ? maxRow.v : 0) + 1]);
        try { this.flush(); } catch (e) { /* best effort */ }
        return id;
    };

    // Suppression refusée si des tickets sont assignés à ce membre : renvoyer la liste bloquante
    Database.deleteTeamMember = function (id) {
        var nameRow = this.queryAll('SELECT name FROM team_members WHERE id = ?', [String(id)])[0];
        var used = this.queryAll('SELECT title FROM tickets WHERE assignee = ?', [nameRow ? nameRow.name : '']);
        if (used.length) return { ok: false, blocked: used };
        this.run('DELETE FROM team_members WHERE id = ?', [String(id)]);
        try { this.flush(); } catch (e) { /* best effort */ }
        return { ok: true };
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

    // Restauration de sauvegarde (backup.js) : remplace la base par les octets du fichier .db
    // Restauration de sauvegarde (backup.js) : remplace la base par les octets du fichier .db.
    // Résilience : le fichier est d'abord ouvert dans une instance TEMPORAIRE et validé
    // (PRAGMA integrity_check) — la base courante n'est écrasée que si le fichier est sain.
    // Retourne une Promise résolue ({ ok, error }) — jamais de base cassée en place.
    Database.replaceDatabase = function (bytes) {
        var self = this;
        return initSqlJs({ locateFile: function (file) { return 'vendor/' + file; } }).then(function (SQL) {
            var candidate;
            try {
                candidate = new SQL.Database(new Uint8Array(bytes));
            } catch (e) {
                return { ok: false, error: 'fichier illisible : ' + (e && e.message ? e.message : 'erreur') };
            }
            var check = candidate.exec('PRAGMA integrity_check');
            var verdict = (check && check[0] && check[0].values && check[0].values[0] && check[0].values[0][0]) || 'error';
            if (verdict !== 'ok') {
                try { candidate.close(); } catch (e) { /* ignore */ }
                return { ok: false, error: 'fichier corrompu (integrity_check : ' + verdict + ')' };
            }
            // Fichier sain : refermer le candidat puis adopter une base fraîche sur ces octets
            try { candidate.close(); } catch (e) { /* ignore */ }
            self.db = new SQL.Database(new Uint8Array(bytes));
            return saveToIndexedDB(self.idb, bytes).then(function () { return { ok: true }; });
        });
    };

    window.ADWDatabase = Database;
})();
