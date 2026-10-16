(function () {
    'use strict';

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
        db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_members_no ON members(member_no)');
        var missing = db.exec("SELECT id FROM members WHERE member_no IS NULL");
        if (missing.length) {
            var used = {};
            db.exec('SELECT member_no FROM members WHERE member_no IS NOT NULL')[0].values.forEach(function (r) { used[r[0]] = true; });
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

    window.addEventListener('beforeunload', function () {
        try { Database.flush(); } catch (e) { /* best effort */ }
    });

    window.ADWDatabase = Database;
})();
