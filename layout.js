(function () {
    'use strict';

    // Layout partagé — sidebar + topbar générés ici pour toutes les pages.
    // Injection synchrone : layout.js doit être le PREMIER script de la page,
    // avant theme.js / nav.js / openstatus.js / notifications.js / etc.
    //
    // Marqueurs dans le HTML des pages :
    //   <div data-layout-sidebar></div>
    //   <div data-layout-topbar
    //        data-title="Membres"
    //        data-title-id="pageTitle"            (optionnel : id sur le <h1>)
    //        data-back-href="membres.html"       (optionnel : bouton retour)
    //        data-back-label="Retour aux membres"
    //        data-search-id="searchInput"        (optionnel : barre de recherche)
    //        data-search-label="Rechercher un membre"
    //        data-search-placeholder="Nom, prénom ou n° de membre..."></div>

    var SIDEBAR_HTML =
        '<aside class="sidebar">' +
        '<a class="brand" href="index.html">' +
        '<span class="brand-mark" aria-hidden="true">AW</span>' +
        '<span class="brand-text">' +
        '<span class="brand-name">Atelier du Web</span>' +
        '<span class="brand-sub">EPN \u00b7 Saint-Gilles</span>' +
        '</span>' +
        '</a>' +
        '<nav class="side-nav" aria-label="Navigation principale" id="sidebarNav">' +
        '<a href="index.html"><span class="nav-ico" aria-hidden="true">\uD83D\uDCCA</span> Tableau de bord</a>' +
        '<a href="membres.html"><span class="nav-ico" aria-hidden="true">\uD83D\uDC65</span> Membres</a>' +
        '<a href="formations.html"><span class="nav-ico" aria-hidden="true">\uD83C\uDF93</span> Formations</a>' +
        '<a href="salles.html"><span class="nav-ico" aria-hidden="true">\uD83D\uDCC5</span> Salles</a>' +
        '<a href="suggestions.html"><span class="nav-ico" aria-hidden="true">\uD83D\uDCA1</span> À faire</a>' +
        '<a href="parametres.html"><span class="nav-ico" aria-hidden="true">\u2699\uFE0F</span> Paramètres</a>' +
        '</nav>' +
        '<div class="sidebar-footer">' +
        '<a class="side-external" href="https://atelierduweb.be" target="_blank" rel="noopener">\uD83C\uDF10 atelierduweb.be</a>' +
        '</div>' +
        '</aside>';

    function topbarHtml(cfg) {
        var html = '<header class="topbar">';
        html += '<button class="nav-toggle" id="navToggle" aria-expanded="false" aria-controls="sidebarNav" aria-label="Ouvrir la navigation">\u2630</button>';
        if (cfg.backHref) {
            html += '<a class="btn btn-secondary btn-small" href="' + cfg.backHref + '">\u2190 ' + cfg.backLabel + '</a>';
        }
        html += '<h1 class="topbar-title"' + (cfg.titleId ? ' id="' + cfg.titleId + '"' : '') + '>' + cfg.title + '</h1>';
        html += '<p class="topbar-date" id="todayDate"></p>';
        html += '<span class="open-status" id="openStatus" role="status" aria-live="polite"></span>';
        if (cfg.searchId) {
            html += '<div class="search-bar">';
            html += '<span class="search-icon" aria-hidden="true">\uD83D\uDD0D</span>';
            html += '<label for="' + cfg.searchId + '" style="position:absolute;left:-9999px">' + cfg.searchLabel + '</label>';
            html += '<input type="text" id="' + cfg.searchId + '" placeholder="' + cfg.searchPlaceholder + '">';
            html += '</div>';
        }
        html += '<span id="notifCenter" style="display:inline-flex' + (cfg.searchId ? '' : ';margin-left:auto') + '"></span>';
        html += '<button class="theme-toggle" id="themeToggle" title="Basculer le thème" aria-label="Basculer entre thème clair et sombre">\uD83C\uDF17</button>';
        html += '</header>';
        return html;
    }

    function mount() {
        var sidebarSlot = document.querySelector('[data-layout-sidebar]');
        if (sidebarSlot) {
            sidebarSlot.outerHTML = SIDEBAR_HTML;
            var page = location.pathname.split('/').pop() || 'index.html';
            var active = document.querySelector('.side-nav a[href="' + page + '"]');
            if (active) {
                active.classList.add('active');
                active.setAttribute('aria-current', 'page');
            }
        }

        var topbarSlot = document.querySelector('[data-layout-topbar]');
        if (topbarSlot) {
            var d = topbarSlot.dataset;
            topbarSlot.outerHTML = topbarHtml({
                title: d.title || '',
                titleId: d.titleId || '',
                backHref: d.backHref || '',
                backLabel: d.backLabel || 'Retour',
                searchId: d.searchId || '',
                searchLabel: d.searchLabel || 'Rechercher',
                searchPlaceholder: d.searchPlaceholder || 'Rechercher...'
            });
        }
    }

    mount();
})();
