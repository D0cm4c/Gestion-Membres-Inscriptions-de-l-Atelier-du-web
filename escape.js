(function () {
    'use strict';

    // Échappement HTML partagé — unique source de vérité pour toutes les pages.
    // Usage : window.ADWEscape.html(value) — null/undefined → ''
    function html(value) {
        var div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML;
    }

    window.ADWEscape = { html: html };
})();
