(function () {
    'use strict';

    // Sauvegarde de la base (membres, formations, inscriptions, incidents…) — backup.js
    // Exporte le fichier SQLite COMPLET (toutes les tables) vers un emplacement choisi
    // (clé USB via File System Access API sur Chrome/Edge) + restauration.
    //
    // Limites navigateur (honnêteté) : impossible d'écrire sans interaction utilisateur.
    // Automatisme : rappel intelligent au chargement si des modifications ont eu lieu
    // depuis la dernière sauvegarde (notification + bouton direct).
    //
    // Expose window.ADWBackup :
    //   - chooseLocation() : l'utilisateur pointe la clé USB (mémorisé)
    //   - saveNow() : écrit la base à l'emplacement mémorisé (ou demande où si absent)
    //   - restore() : restaure depuis un fichier .db (double confirmation)
    //   - checkReminder() : notification 🔔 si données modifiées depuis le dernier backup
    //
    // Dépend de : db.js (ADWDatabase), notifications.js (optionnel).

    var LAST_BACKUP_KEY = 'atelierduweb_last_backup';
    var HANDLE_SUPPORTED = window.showSaveFilePicker !== undefined;

    var lastHandle = null; // FileSystemFileHandle mémorisé (session en cours)

    function esc(s) { return window.ADWEscape.html(s); }

    function getLastBackup() {
        try {
            var raw = localStorage.getItem(LAST_BACKUP_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    function setLastBackup(dateStr, size, fileName) {
        try {
            localStorage.setItem(LAST_BACKUP_KEY, JSON.stringify({
                date: dateStr, size: size, file: fileName
            }));
        } catch (e) { /* ignore */ }
    }

    function notify(type, message, severity) {
        if (window.ADWNotifications) window.ADWNotifications.push(type, message, severity || 'info');
    }

    function isoNow() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    // ============ Sauvegarde ============

    function chooseLocation() {
        if (!HANDLE_SUPPORTED) {
            return Promise.reject(new Error('unsupported'));
        }
        var fileName = 'atelierduweb-sauvegarde-' + isoNow() + '.db';
        return window.showSaveFilePicker({
            suggestedName: fileName,
            types: [{ description: 'Sauvegarde Atelier du Web (SQLite)', accept: { 'application/octet-stream': ['.db'] } }]
        }).then(function (handle) {
            lastHandle = handle;
            return handle;
        });
    }

    function writeBytes(handle, bytes) {
        return handle.createWritable().then(function (writable) {
            return writable.write(bytes).then(function () { return writable.close(); });
        });
    }

    function saveNow(silent) {
        var db = window.ADWDatabase;
        if (!db || !db.db) return Promise.reject(new Error('db'));

        var bytes = db.db.export(); // Uint8Array du fichier SQLite complet

        // Chrome/Edge avec emplacement mémorisé (ou à choisir)
        if (HANDLE_SUPPORTED) {
            var doWrite = lastHandle ? Promise.resolve(lastHandle) : chooseLocation();
            return doWrite.then(function (handle) {
                return writeBytes(handle, bytes).then(function () {
                    setLastBackup(new Date().toISOString(), bytes.length, handle.name);
                    if (!silent) notify('backup_ok', '💾 Sauvegarde réussie (' + (bytes.length / 1024).toFixed(0) + ' Ko) → ' + esc(handle.name), 'success');
                    return { ok: true, fileName: handle.name, size: bytes.length };
                });
            }).catch(function (err) {
                if (err && err.name === 'AbortError') return { ok: false, cancelled: true }; // utilisateur a annulé
                throw err;
            });
        }

        // Firefox/Safari : téléchargement classique (dossier Téléchargements, glisser sur la clé ensuite)
        return new Promise(function (resolve) {
            var blob = new Blob([bytes], { type: 'application/octet-stream' });
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'atelierduweb-sauvegarde-' + isoNow() + '.db';
            document.body.appendChild(a);
            a.click();
            setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
            setLastBackup(new Date().toISOString(), bytes.length, a.download);
            if (!silent) notify('backup_ok', '💾 Sauvegarde téléchargée : ' + esc(a.download) + ' — glisse-la sur la clé USB.', 'success');
            resolve({ ok: true, fileName: a.download, size: bytes.length, downloaded: true });
        });
    }

    // ============ Restauration ============

    function restore() {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.db,application/octet-stream';
        input.onchange = function () {
            var file = input.files && input.files[0];
            if (!file) return;
            // Double confirmation (écrase la base locale)
            var step1 = confirm('Restaurer la sauvegarde « ' + file.name + ' » ?\n\nATTENTION : cela REMPLACE toutes les données actuelles de ce navigateur (membres, formations, inscriptions, incidents…).');
            if (!step1) return;
            var step2 = confirm('Confirmation finale : la base actuelle sera ÉCRASÉE par la sauvegarde.\n\nEs-tu sûr·e ?');
            if (!step2) return;

            file.arrayBuffer().then(function (buf) {
                var bytes = new Uint8Array(buf);
                // Validation minimale : un fichier SQLite commence par "SQLite format 3"
                var header = String.fromCharCode.apply(null, bytes.slice(0, 15));
                if (header !== 'SQLite format 3') {
                    alert('Ce fichier n\u2019est pas une sauvegarde valide (en-tête SQLite manquant).');
                    return;
                }
                window.ADWDatabase.replaceDatabase(bytes).then(function (res) {
                    if (res && res.ok) {
                        notify('backup_restored', '✅ Sauvegarde restaurée : ' + esc(file.name) + '. Rechargement…', 'success');
                        setTimeout(function () { location.reload(); }, 1500);
                    } else {
                        alert('Restauration refusée — la base actuelle est INTACTE.\n\nCause : ' + (res && res.error ? res.error : 'erreur inconnue'));
                    }
                }).catch(function (e) {
                    alert('Échec de la restauration : ' + (e && e.message ? e.message : 'erreur inconnue'));
                });
            });
        };
        input.click();
    }

    // ============ Rappel intelligent ============

    function countRows() {
        // Nombre total de lignes de données modifiables (membres, visites, inscriptions, incidents…)
        var total = 0;
        var tables = ['members', 'visits', 'prints', 'formations_members', 'tickets', 'ticket_comments', 'suggestions', 'rooms', 'team_members'];
        tables.forEach(function (t) {
            try {
                var r = window.ADWDatabase.queryAll('SELECT COUNT(*) AS v FROM ' + t);
                if (r && r[0]) total += r[0].v || 0;
            } catch (e) { /* table absente : ignorer */ }
        });
        return total;
    }

    function checkReminder() {
        var last = getLastBackup();
        var rows = countRows();
        if (!last) {
            if (rows > 0) {
                notify('backup_reminder',
                    '💾 Aucune sauvegarde encore faite (' + rows + ' fiches en base) — fais-en une depuis Paramètres.',
                    'warning');
            }
            return;
        }
        var days = Math.floor((Date.now() - new Date(last.date).getTime()) / 86400000);
        if (days >= 3) {
            notify('backup_reminder',
                '💾 Dernière sauvegarde il y a ' + days + ' jours (' + rows + ' fiches en base) — pense à sauvegarder sur la clé USB.',
                'warning');
        }
    }

    // Rappel automatique : quand une page a ouvert la base, vérifier l'ancienneté de la
    // dernière sauvegarde. Les pages appellent ADWDatabase.init() à leur manière — on
    // attend passivement que la base soit prête (pas de re-init, pas de double chargement).
    var reminderDone = false;
    function scheduleReminder() {
        if (reminderDone) return;
        var base = window.ADWDatabase;
        if (!base) return;
        if (base.db) { // déjà ouverte par la page (script chargé après)
            reminderDone = true;
            try { checkReminder(); } catch (e) { /* table absente : ignorer */ }
            return;
        }
        // pas encore ouverte : guetter brièvement son ouverture (max ~5 s)
        var tries = 0;
        var timer = setInterval(function () {
            if (reminderDone) { clearInterval(timer); return; }
            if (window.ADWDatabase && window.ADWDatabase.db) {
                reminderDone = true;
                clearInterval(timer);
                try { checkReminder(); } catch (e) { /* ignore */ }
            } else if (++tries > 25) {
                clearInterval(timer);
            }
        }, 200);
    }
    if (document.readyState !== 'loading') scheduleReminder();
    else document.addEventListener('DOMContentLoaded', scheduleReminder);

    window.ADWBackup = {
        saveNow: saveNow,
        chooseLocation: chooseLocation,
        restore: restore,
        checkReminder: checkReminder,
        getLastBackup: getLastBackup,
        isLocationSupported: function () { return HANDLE_SUPPORTED; }
    };
})();
