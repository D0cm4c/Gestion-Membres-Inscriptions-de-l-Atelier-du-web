(function () {
    'use strict';

    // Cartouche Ouvert/Fermé — partagé entre toutes les pages
    // (extrait de la logique dashboard.js, autonome)

    var OPENING_HOURS = {
        1: [12.5, 17],   // lundi
        2: [9, 17],      // mardi
        3: [9, 17],      // mercredi
        4: [9, 17],      // jeudi
        5: [9, 12],      // vendredi
        6: [9.5, 12]     // samedi
    };

    function fmt(h) {
        var hh = Math.floor(h);
        var mm = Math.round((h - hh) * 60);
        return hh + 'h' + (mm ? String(mm).padStart(2, '0') : '');
    }

    // Date du jour dans la topbar (module partag\u00e9 \u2014 les pages qui la remplissent aussi
    // \u00e9crivent la m\u00eame valeur, c'est idempotent)
    var todayDateEl = document.getElementById('todayDate');
    if (todayDateEl) {
        todayDateEl.textContent = new Date().toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }

    function update() {
        var el = document.getElementById('openStatus');
        if (!el) return;
        var now = new Date();
        var day = now.getDay();
        var t = now.getHours() + now.getMinutes() / 60;
        var hours = OPENING_HOURS[day];
        if (!hours) {
            el.className = 'open-status closed';
            el.textContent = '\uD83D\uDD34 Ferm\u00e9';
            el.title = 'Ferm\u00e9 aujourd\u2019hui';
            return;
        }
        if (t < hours[0]) {
            el.className = 'open-status closed';
            el.textContent = '\uD83D\uDFE1 Ouverture \u00e0 ' + fmt(hours[0]);
            el.title = 'Ouverture \u00e0 ' + fmt(hours[0]);
        } else if (t < hours[1]) {
            el.className = 'open-status open';
            el.textContent = '\uD83D\uDFE2 Ouvert \u00b7 ferme \u00e0 ' + fmt(hours[1]);
            el.title = 'Ouvert jusqu\u2019\u00e0 ' + fmt(hours[1]);
        } else {
            el.className = 'open-status closed';
            el.textContent = '\uD83D\uDD34 Ferm\u00e9';
            el.title = 'Ferm\u00e9 pour aujourd\u2019hui';
        }
    }

    function ready(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }

    ready(function () {
        update();
        setInterval(update, 60000); // rafraichi chaque minute
    });
})();
