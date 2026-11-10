(function () {
    'use strict';

    // Page Paramètres (parametres.html) : cartes du dashboard (tuiles), administration des salles,
    // purge RGPD. Expose window.ADWSettings. Dépend de : db.js, escape.js.


    // ============ Gestion des salles (page Paramètres) ============

    var dbReady = null;
    function ensureDb() {
        if (!dbReady) dbReady = window.ADWDatabase.init();
        return dbReady;
    }

    function initRoomsAdmin() {
        var list = document.getElementById('roomsList');
        var nameInput = document.getElementById('newRoomName');
        var capInput = document.getElementById('newRoomCapacity');
        var addBtn = document.getElementById('addRoomBtn');
        if (!list || !addBtn || !window.ADWDatabase) return;

        function esc(v) { return window.ADWEscape.html(v); }

        function render() {
            var rooms = window.ADWDatabase.listRooms();
            if (!rooms.length) {
                list.innerHTML = '<li class="form-hint" style="padding:0.5rem 0;">Aucune salle — ajoute-en une ci-dessous.</li>';
                return;
            }
            list.innerHTML = '';
            rooms.forEach(function (r) {
                var li = document.createElement('li');
                li.innerHTML =
                    '<span class="grow" style="font-weight:600;">' + esc(r.name) + '</span>' +
                    '<span class="room-cap">' + (r.capacity ? esc(r.capacity) + ' place' + (r.capacity > 1 ? 's' : '') : 'capacité libre') + '</span>';

                var renameBtn = document.createElement('button');
                renameBtn.className = 'btn btn-secondary btn-small';
                renameBtn.textContent = '✏️';
                renameBtn.title = 'Renommer la salle';
                renameBtn.addEventListener('click', function () {
                    var newName = prompt('Nouveau nom de la salle :', r.name);
                    if (newName && newName.trim()) {
                        window.ADWDatabase.renameRoom(r.id, newName);
                        render();
                    }
                });

                var deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn btn-danger btn-small';
                deleteBtn.textContent = '🗑️';
                deleteBtn.title = 'Supprimer la salle';
                deleteBtn.addEventListener('click', function () {
                    var res = window.ADWDatabase.deleteRoom(r.id);
                    if (!res.ok) {
                        alert('Impossible de supprimer « ' + r.name + ' » : ' + res.blocked.length +
                            ' formation(s) y sont attribuée(s) (ex. « ' + res.blocked[0].title + ' »).\n' +
                            'Réattribue-les depuis la page Salles d’abord.');
                        return;
                    }
                    render();
                });

                li.appendChild(renameBtn);
                li.appendChild(deleteBtn);
                list.appendChild(li);
            });
        }

        addBtn.addEventListener('click', function () {
            var name = (nameInput.value || '').trim();
            if (!name) { nameInput.focus(); return; }
            window.ADWDatabase.addRoom(name, capInput.value);
            nameInput.value = '';
            capInput.value = '';
            render();
        });

        ensureDb().then(render).catch(function () { /* base indisponible : liste vide */ });
    }

    // ============ Clé API M.E. Calendar (page Paramètres) ============

    var MEC_KEY_STORAGE = 'atelierduweb_mec_api_key';

    function initMecKey() {
        var input = document.getElementById('mecApiKey');
        var saveBtn = document.getElementById('mecKeySaveBtn');
        var clearBtn = document.getElementById('mecKeyClearBtn');
        var statusEl = document.getElementById('mecKeyStatus');
        if (!input || !saveBtn || !clearBtn) return;

        function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }

        var stored = '';
        try { stored = localStorage.getItem(MEC_KEY_STORAGE) || ''; } catch (e) { /* stockage indisponible */ }
        if (stored) {
            input.value = stored;
            setStatus('✓ Clé enregistrée dans ce navigateur (' + stored.slice(0, 4) + '…' + stored.slice(-4) + ')');
        }

        saveBtn.addEventListener('click', function () {
            var val = (input.value || '').trim();
            if (!val) { input.focus(); setStatus('Colle d\u2019abord la clé dans le champ.'); return; }
            try {
                localStorage.setItem(MEC_KEY_STORAGE, val);
                setStatus('✓ Clé enregistrée dans ce navigateur (' + val.slice(0, 4) + '…' + val.slice(-4) + ')');
            } catch (e) {
                setStatus('⚠️ Impossible d\u2019enregistrer (stockage indisponible).');
            }
        });

        clearBtn.addEventListener('click', function () {
            input.value = '';
            try { localStorage.removeItem(MEC_KEY_STORAGE); } catch (e) { /* ignore */ }
            setStatus('Clé effacée de ce navigateur.');
        });
    }

    if (document.readyState !== 'loading') initRoomsAdmin();
    else document.addEventListener('DOMContentLoaded', initRoomsAdmin);

    // ============ Secret du plugin ADW MEC API (page Paramètres) ============
    // Même pattern que la clé MEC : stockage navigateur en attendant le serveur Node,
    // qui l'utilisera pour appeler l'endpoint inscriptions du plugin WordPress.

    var ADW_SECRET_STORAGE = 'atelierduweb_adw_plugin_secret';

    function initAdwSecret() {
        var input = document.getElementById('adwPluginSecret');
        var saveBtn = document.getElementById('adwSecretSaveBtn');
        var clearBtn = document.getElementById('adwSecretClearBtn');
        var statusEl = document.getElementById('adwSecretStatus');
        if (!input || !saveBtn || !clearBtn) return;

        function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }

        var stored = '';
        try { stored = localStorage.getItem(ADW_SECRET_STORAGE) || ''; } catch (e) { /* stockage indisponible */ }
        if (stored) {
            input.value = stored;
            setStatus('✓ Secret enregistré dans ce navigateur (' + stored.slice(0, 4) + '…' + stored.slice(-4) + ')');
        }

        saveBtn.addEventListener('click', function () {
            var val = (input.value || '').trim();
            if (!val) { input.focus(); setStatus('Colle d\u2019abord le secret dans le champ.'); return; }
            try {
                localStorage.setItem(ADW_SECRET_STORAGE, val);
                setStatus('✓ Secret enregistré dans ce navigateur (' + val.slice(0, 4) + '…' + val.slice(-4) + ')');
            } catch (e) {
                setStatus('⚠️ Impossible d\u2019enregistrer (stockage indisponible).');
            }
        });

        clearBtn.addEventListener('click', function () {
            input.value = '';
            try { localStorage.removeItem(ADW_SECRET_STORAGE); } catch (e) { /* ignore */ }
            setStatus('Secret effacé de ce navigateur.');
        });
    }

    if (document.readyState !== 'loading') initAdwSecret();
    else document.addEventListener('DOMContentLoaded', initAdwSecret);

    if (document.readyState !== 'loading') initMecKey();
    else document.addEventListener('DOMContentLoaded', initMecKey);

    // ============ Équipe technique (page Paramètres → assignation des incidents) ============

    function initTeamAdmin() {
        var list = document.getElementById('teamList');
        var nameInput = document.getElementById('newTeamMemberName');
        var addBtn = document.getElementById('addTeamMemberBtn');
        if (!list || !addBtn || !window.ADWDatabase) return;

        function esc(v) { return window.ADWEscape.html(v); }

        function render() {
            var team = window.ADWDatabase.listTeamMembers();
            if (!team.length) {
                list.innerHTML = '<li class="form-hint" style="padding:0.5rem 0;">Aucun membre — ajoute l\u2019équipe ici pour pouvoir assigner les incidents.</li>';
                return;
            }
            list.innerHTML = '';
            team.forEach(function (m) {
                var li = document.createElement('li');
                li.innerHTML = '<span class="grow" style="font-weight:600;">' + esc(m.name) + '</span>';
                var del = document.createElement('button');
                del.className = 'btn btn-danger btn-small';
                del.textContent = '🗑️';
                del.title = 'Retirer de l\u2019équipe';
                del.addEventListener('click', function () {
                    var res = window.ADWDatabase.deleteTeamMember(m.id);
                    if (res && res.ok === false) {
                        alert('Impossible de retirer « ' + m.name + ' » : ' + res.blocked.length +
                            ' incident(s) lui sont assigné(s) (ex. « ' + res.blocked[0].title + ' »).\n' +
                            'Réassigne-les depuis la page Incidents d\u2019abord.');
                        return;
                    }
                    render();
                });
                li.appendChild(del);
                list.appendChild(li);
            });
        }

        addBtn.addEventListener('click', function () {
            var name = (nameInput.value || '').trim();
            if (!name) { nameInput.focus(); return; }
            if (!window.ADWDatabase) { alert('Base de données non chargée — recharge la page.'); return; }
            try {
                window.ADWDatabase.addTeamMember(name);
            } catch (e) {
                alert('Impossible d\u2019ajouter ce membre : ' + (e && e.message ? e.message : 'erreur inconnue'));
                return;
            }
            nameInput.value = '';
            render();
        });

        ensureDb().then(render).catch(function () { /* base indisponible */ });
    }

    if (document.readyState !== 'loading') initTeamAdmin();
    else document.addEventListener('DOMContentLoaded', initTeamAdmin);

    // ============ Sauvegarde de la base (carte « Sauvegarde » de parametres.html) ============

    function initBackupCard() {
        var chooseBtn = document.getElementById('backupChooseBtn');
        var saveBtn = document.getElementById('backupSaveBtn');
        var restoreBtn = document.getElementById('backupRestoreBtn');
        var statusEl = document.getElementById('backupStatus');
        if (!saveBtn || !window.ADWBackup) return;

        function esc(v) { return window.ADWEscape.html(v); }

        function refreshStatus() {
            if (!statusEl) return;
            var last = window.ADWBackup.getLastBackup();
            if (!last) {
                statusEl.innerHTML = 'Aucune sauvegarde encore faite — fais la première pour protéger les données.';
                return;
            }
            var d = new Date(last.date);
            var label = d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' }) +
                ' à ' + d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
            statusEl.innerHTML = '✓ Dernière sauvegarde : <strong>' + esc(label) + '</strong>' +
                (last.file ? ' (' + esc(last.file) + ', ' + Math.round((last.size || 0) / 1024) + ' Ko)' : '');
        }

        if (chooseBtn) chooseBtn.addEventListener('click', function () {
            window.ADWBackup.chooseLocation().then(function () {
                if (statusEl) statusEl.textContent = 'Emplacement choisi — « Sauvegarder maintenant » écrira à cet endroit.';
            }).catch(function () { /* annulé ou navigateur non supporté */ });
        });
        if (!window.ADWBackup.isLocationSupported() && chooseBtn) chooseBtn.disabled = true;

        saveBtn.addEventListener('click', function () {
            saveBtn.disabled = true;
            window.ADWBackup.saveNow().then(function (res) {
                if (res && res.cancelled) return;
                refreshStatus();
            }).catch(function (err) {
                alert('Échec de la sauvegarde : ' + (err && err.message ? err.message : 'erreur inconnue'));
            }).then(function () { saveBtn.disabled = false; });
        });

        if (restoreBtn) restoreBtn.addEventListener('click', function () {
            window.ADWBackup.restore();
        });

        refreshStatus();
    }

    if (document.readyState !== 'loading') initBackupCard();
    else document.addEventListener('DOMContentLoaded', initBackupCard);

    // Garde admin : la page Paramètres est réservée à l'équipe (mot de passe admin, voir auth.js)
    function guardSettingsPage() {
        if (!window.ADWAuth) return; // auth.js absent : pas de garde (robustesse)
        window.ADWAuth.guardPage();
    }
    if (document.readyState !== 'loading') guardSettingsPage();
    else document.addEventListener('DOMContentLoaded', guardSettingsPage);

    // Changement du mot de passe admin (carte « Mot de passe admin » de parametres.html)
    function initAuthCard() {
        var oldInput = document.getElementById('authOldPass');
        var newInput = document.getElementById('authNewPass');
        var changeBtn = document.getElementById('authChangeBtn');
        var statusEl = document.getElementById('authStatus');
        if (!changeBtn || !window.ADWAuth) return;

        function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }

        changeBtn.addEventListener('click', function () {
            var oldPass = (oldInput.value || '').trim();
            var newPass = (newInput.value || '').trim();
            if (!oldPass || !newPass) { setStatus('Remplis les deux champs.'); return; }
            if (newPass.length < 4) { setStatus('Le nouveau mot de passe doit faire au moins 4 caractères.'); return; }
            window.ADWAuth.verify(oldPass).then(function (ok) {
                if (!ok) { setStatus('⚠️ Mot de passe actuel incorrect.'); oldInput.focus(); return; }
                return window.ADWAuth.setPassword(newPass).then(function () {
                    oldInput.value = '';
                    newInput.value = '';
                    setStatus('✓ Mot de passe modifié.');
                });
            });
        });
    }
    if (document.readyState !== 'loading') initAuthCard();
    else document.addEventListener('DOMContentLoaded', initAuthCard);

    window.ADWSettings = {};
})();
