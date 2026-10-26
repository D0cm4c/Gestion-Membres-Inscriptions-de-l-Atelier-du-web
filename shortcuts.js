(function () {
    'use strict';

    // Raccourcis clavier des boutons principaux — shortcuts.js
    // Déclaratif : chaque page déclare ses boutons + touche. La bulle d'aide (title)
    // est enrichie automatiquement : « Pointer une visite (V) ».
    //
    // Règles :
    //  - Le raccourci ne se déclenche PAS si le focus est dans un champ de saisie
    //    (input/textarea/select) ou une modale est ouverte.
    //  - Insensible à la casse (V et v identiques), pas de modifificateur requis.
    //
    // Map par page (location.pathname) :
    var PAGE_SHORTCUTS = {
        'membres.html': [
            { id: 'addMemberBtn', key: 'n', label: 'Ajouter un membre' },
            { id: 'detailCheckinBtn', key: 'v', label: 'Pointer une visite' },
            { selector: '[data-print="bw"]', key: 'p', label: 'Ajouter une impression N&B' }
        ],
        'salles.html': [
            { id: 'todayBtn', key: 'h', label: 'Aujourd\u2019hui' }
        ],
        'tickets.html': [
            { id: 'newTicketBtn', key: 'i', label: 'Signaler un incident' }
        ]
    };

    var KEY_BADGE = { // libellé affiché dans la bulle
        n: 'N', v: 'V', p: 'P', h: 'H', i: 'I'
    };

    function pageKey() {
        var p = location.pathname.split('/').pop() || 'index.html';
        return p;
    }

    function findBtn(sc) {
        return sc.id ? document.getElementById(sc.id) : document.querySelector(sc.selector);
    }

    function decorate(btn, sc) {
        // Bulle d'aide : libellé + (Touche) — sans écraser un title existant
        var badge = ' (' + (KEY_BADGE[sc.key] || sc.key.toUpperCase()) + ')';
        var existing = btn.getAttribute('title');
        if (existing && existing.indexOf(badge) === -1) {
            btn.setAttribute('title', existing + badge);
        } else if (!existing) {
            btn.setAttribute('title', sc.label + badge);
        }
        // Accessibilité : annoncer le raccourci aux lecteurs d'écran
        btn.setAttribute('aria-keyshortcuts', sc.key.toUpperCase());
    }

    function isTyping() {
        var el = document.activeElement;
        if (!el) return false;
        var tag = (el.tagName || '').toLowerCase();
        return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
    }

    function anyModalOpen() {
        var overlays = document.querySelectorAll('.modal-overlay');
        for (var i = 0; i < overlays.length; i++) {
            if (!overlays[i].hidden) return true;
        }
        return false;
    }

    function init() {
        var shortcuts = PAGE_SHORTCUTS[pageKey()];
        if (!shortcuts) return;

        shortcuts.forEach(function (sc) {
            var btn = findBtn(sc);
            if (btn) decorate(btn, sc);
        });

        document.addEventListener('keydown', function (e) {
            if (e.ctrlKey || e.metaKey || e.altKey) return; // pas de combinaisons : simple touche
            if (isTyping() || anyModalOpen()) return;
            var key = (e.key || '').toLowerCase();
            shortcuts.forEach(function (sc) {
                if (key !== sc.key) return;
                var btn = findBtn(sc);
                if (!btn || btn.disabled || btn.hidden) return;
                e.preventDefault();
                btn.click();
            });
        });
    }

    if (document.readyState !== 'loading') init();
    else document.addEventListener('DOMContentLoaded', init);
})();
