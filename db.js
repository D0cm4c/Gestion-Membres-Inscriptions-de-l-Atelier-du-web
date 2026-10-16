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
                        self.db.run(
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
                            'created_at TEXT DEFAULT (datetime(\'now\'))' +
                            ')'
                        );
                        migrateLocalStorage(self.db);
                        return self;
                    });
                });
        },

        persist: function () {
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

    window.ADWDatabase = Database;
})();
