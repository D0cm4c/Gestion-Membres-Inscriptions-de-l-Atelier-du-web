(function () {
    'use strict';

    // Authentification admin — mot de passe unique (pas de comptes), pour l'app en localhost.
    // Protège les actions sensibles : page Paramètres, suppression membre, purge RGPD, import XML.
    // ⚠️ Maquette navigateur : garde-fou contre l'usage accidentel, pas une barrière
    // cryptographique (DevTools peut contourner). La vraie auth viendra du backend Node —
    // le point d'appel unique ensureUnlocked() est pensé pour changer d'implémentation sans
    // toucher aux appelants.
    //
    // Usage : ADWAuth.ensureUnlocked('libellé de l'action').then(function () { ... })

    var HASH_KEY = 'atelierduweb_admin_hash';
    var UNLOCKED_KEY = 'atelierduweb_admin_unlocked_until';
    var DEFAULT_PASSWORD = 'admin'; // mot de passe initial, à changer dès la première ouverture
    var UNLOCK_DURATION_MS = 30 * 60 * 1000; // « rester déverrouillé » 30 min

    var modal = null;
    var pendingResolve = null;

    function sha256(text) {
        // Web Crypto (natif navigateur) — retourne un hash hexadécimal
        var data = new TextEncoder().encode(text);
        return crypto.subtle.digest('SHA-256', data).then(function (buf) {
            return Array.from(new Uint8Array(buf)).map(function (b) {
                return b.toString(16).padStart(2, '0');
            }).join('');
        });
    }

    function getStoredHash() {
        try { return localStorage.getItem(HASH_KEY); } catch (e) { return null; }
    }

    function setStoredHash(hash) {
        try { localStorage.setItem(HASH_KEY, hash); } catch (e) { /* stockage indisponible */ }
    }

    function ensureDefaultHash() {
        // Premier lancement : initialise le hash avec le mot de passe par défaut.
        return getStoredHash() ? Promise.resolve(getStoredHash()) : sha256(DEFAULT_PASSWORD).then(function (h) {
            setStoredHash(h);
            return h;
        });
    }

    function isUnlocked() {
        try {
            var until = parseInt(localStorage.getItem(UNLOCKED_KEY) || '0', 10);
            return Date.now() < until;
        } catch (e) { return false; }
    }

    function markUnlocked(duration) {
        try {
            localStorage.setItem(UNLOCKED_KEY, String(Date.now() + (duration || UNLOCK_DURATION_MS)));
        } catch (e) { /* ignore */ }
    }

    function lock() {
        try { localStorage.removeItem(UNLOCKED_KEY); } catch (e) { /* ignore */ }
    }

    // ============ Modale (pas de prompt() natif) ============

    function buildModal() {
        var ov = document.createElement('div');
        ov.className = 'modal-overlay';
        ov.hidden = true;
        ov.style.zIndex = '1000';
        ov.innerHTML =
            '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="adwAuthTitle">' +
            '<h3 id="adwAuthTitle">🔐 Accès administrateur</h3>' +
            '<p class="form-hint" id="adwAuthLabel">Cette action est réservée à l\u2019équipe d\u2019animation.</p>' +
            '<div class="form-group">' +
            '<input type="password" id="adwAuthInput" placeholder="Mot de passe admin" autocomplete="off">' +
            '</div>' +
            '<p class="form-hint" id="adwAuthError" style="color:var(--danger);margin:0.4rem 0 0;" hidden>Mot de passe incorrect.</p>' +
            '<div class="modal-actions">' +
            '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;flex:1;cursor:pointer;">' +
            '<input type="checkbox" id="adwAuthKeep" checked> Rester déverrouillé (30 min)</label>' +
            '<button class="btn btn-secondary" id="adwAuthCancel">Annuler</button>' +
            '<button class="btn btn-primary" id="adwAuthOk">Déverrouiller</button>' +
            '</div>' +
            '<div style="margin-top:0.9rem;border-top:1px solid var(--border);padding-top:0.7rem;">' +
            '<button class="btn btn-secondary btn-small" id="adwAuthReset" style="font-size:0.75rem;">Réinitialiser le mot de passe (perte de l\u2019ancien)</button>' +
            '</div>' +
            '</div>';
        document.body.appendChild(ov);
        return ov;
    }

    function openModal(label) {
        return new Promise(function (resolve) {
            if (!modal) modal = buildModal();
            var input = modal.querySelector('#adwAuthInput');
            var errorEl = modal.querySelector('#adwAuthError');
            var labelEl = modal.querySelector('#adwAuthLabel');
            var keepCb = modal.querySelector('#adwAuthKeep');
            labelEl.textContent = label || 'Cette action est réservée à l\u2019équipe d\u2019animation.';
            input.value = '';
            errorEl.hidden = true;
            keepCb.checked = true;
            modal.hidden = false;
            setTimeout(function () { input.focus(); }, 50);

            function close(ok) {
                modal.hidden = true;
                modal.querySelector('#adwAuthOk').removeEventListener('click', onOk);
                modal.querySelector('#adwAuthCancel').removeEventListener('click', onCancel);
                input.removeEventListener('keydown', onKey);
                resolve(ok);
            }

            function onOk() {
                var val = (input.value || '').trim();
                if (!val) { input.focus(); return; }
                sha256(val).then(function (h) {
                    var stored = getStoredHash();
                    if (stored && h === stored) {
                        markUnlocked(keepCb.checked ? UNLOCK_DURATION_MS : 0);
                        close(true);
                    } else {
                        errorEl.hidden = false;
                        input.value = '';
                        input.focus();
                    }
                });
            }
            function onCancel() { close(false); }
            function onKey(e) {
                if (e.key === 'Enter') { e.preventDefault(); onOk(); }
                else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
            }

            modal.querySelector('#adwAuthOk').addEventListener('click', onOk);
            modal.querySelector('#adwAuthCancel').addEventListener('click', onCancel);
            input.addEventListener('keydown', onKey);

            modal.querySelector('#adwAuthReset').onclick = function () {
                if (!confirm('Réinitialiser le mot de passe admin ?\n\nL\u2019ancien mot de passe sera perdu et un nouveau sera demandé à la prochaine action sensible.')) return;
                try { localStorage.removeItem(HASH_KEY); localStorage.removeItem(UNLOCKED_KEY); } catch (e) { /* ignore */ }
                lock();
                close(false);
                // Prochain ensureUnlocked réinitialisera avec le mot de passe par défaut
            };
        });
    }

    // ============ API publique ============

    var Auth = {
        // ensureUnlocked(label) → Promise<boolean> (true = déverrouillé)
        ensureUnlocked: function (label) {
            return ensureDefaultHash().then(function () {
                if (isUnlocked()) return true;
                return openModal(label);
            });
        },

        // Vérifie un mot de passe sans modale (ex. pour changer le mot de passe)
        verify: function (password) {
            return ensureDefaultHash().then(function () {
                return sha256(password || '').then(function (h) { return h === getStoredHash(); });
            });
        },

        // Définit un nouveau mot de passe (doit être appelé après verify)
        setPassword: function (newPassword) {
            return sha256(newPassword || '').then(function (h) {
                setStoredHash(h);
                return true;
            });
        },

        // Verrouille la session immédiatement
        lock: lock,

        // État (pour afficher un indicateur dans l'UI)
        isUnlocked: isUnlocked,

        // À appeler au chargement d'une page gardée : blur le contenu jusqu'au déverrouillage
        guardPage: function () {
            return ensureDefaultHash().then(function () {
                if (isUnlocked()) return true;
                var main = document.getElementById('main');
                if (main) main.style.filter = 'blur(6px) pointer-events:none;';
                return openModal('Page réservée à l\u2019équipe d\u2019animation — déverrouille pour continuer.').then(function (ok) {
                    if (ok && main) { main.style.filter = ''; main.style.pointerEvents = ''; }
                    else if (main && !ok) { location.href = 'index.html'; }
                    return ok;
                });
            });
        }
    };

    window.ADWAuth = Auth;
})();
