#!/usr/bin/env node
/* Smoke test structure des pages — exécuté en CI (node tests/smoke-pages.js)
   Vérifie, pour chaque page HTML :
   - structure de base (doctype, lang, viewport, main, skip-link)
   - layout.js chargé en PREMIER script (injection synchrone du header/sidebar)
   - slots data-layout-sidebar / data-layout-topbar présents, ancien HTML dupliqué absent
   - tous les scripts référencés existent sur le disque
   - les IDs requis par les scripts inline sont fournis (layout.js ou contenu de page)
   - cohérence des versions ?v= : une version unique par fichier, partout */

'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var PAGES = ['index.html', 'membres.html', 'formations.html', 'salles.html',
    'suggestions.html', 'parametres.html', 'membre.html', 'formation.html', 'tickets.html'];

// IDs fournis par layout.js (topbar/sidebar injectées)
var LAYOUT_IDS = ['navToggle', 'todayDate', 'openStatus', 'notifCenter', 'themeToggle', 'sidebarNav'];
// IDs requis par les scripts inline de chaque page, hors ceux du layout
var REQUIRED_IDS = {
    'index.html': ['siteSearch'],
    'membres.html': ['searchInput', 'filtersToggle', 'filtersMore'],
    'formations.html': ['searchInput', 'catSelect'],
    'membre.html': ['pageTitle'],
    'formation.html': ['pageTitle']
};

var failures = 0;
function fail(page, msg) {
    failures++;
    console.error('  ✗ ' + page + ' : ' + msg);
}
function ok(page, msg) {
    console.log('  ✓ ' + msg);
}

console.log('== Smoke test des pages ==');
var versions = {};
PAGES.forEach(function (page) {
    console.log('\n' + page);
    var file = path.join(ROOT, page);
    if (!fs.existsSync(file)) { fail(page, 'fichier introuvable'); return; }
    var html = fs.readFileSync(file, 'utf8');

    if (!/^<!DOCTYPE html>/i.test(html)) fail(page, 'doctype manquant');
    else ok(page, 'doctype');

    if (!/<html lang="fr">/.test(html)) fail(page, 'lang="fr" manquant');
    else ok(page, 'lang fr');

    if (!/name="viewport"/.test(html)) fail(page, 'viewport manquant');
    else ok(page, 'viewport');

    if (!/id="main"/.test(html)) fail(page, '<main id="main"> manquant');
    else ok(page, 'main#main');

    if (!/class="skip-link"/.test(html)) fail(page, 'skip-link manquant');
    else ok(page, 'skip-link');

    // Scripts : ordre + existence
    var scripts = [];
    var re = /<script src="([^"?]+)(?:\?v=(\d+))?"><\/script>/g;
    var m;
    while ((m = re.exec(html)) !== null) scripts.push({ src: m[1], v: m[2] });

    if (!scripts.length || scripts[0].src !== 'layout.js') fail(page, 'layout.js doit être le premier script (injection synchrone)');
    else ok(page, 'layout.js en premier');
    if (scripts.length < 2 || scripts[1].src !== 'escape.js') fail(page, 'escape.js doit suivre layout.js (échappement HTML partagé)');
    else ok(page, 'escape.js en second');
    // db.js requiert sql-wasm.js (initSqlJs) chargé avant
    var hasDb = scripts.some(function (s) { return s.src === 'db.js'; });
    var sqlIdx = scripts.findIndex(function (s) { return s.src === 'vendor/sql-wasm.js'; });
    var dbIdx = scripts.findIndex(function (s) { return s.src === 'db.js'; });
    if (hasDb && (sqlIdx === -1 || sqlIdx > dbIdx)) fail(page, 'db.js chargé sans vendor/sql-wasm.js avant lui (initSqlJs manquant)');

    scripts.forEach(function (s) {
        if (!fs.existsSync(path.join(ROOT, s.src))) fail(page, 'script introuvable : ' + s.src);
        if (s.v) {
            if (versions[s.src] && versions[s.src] !== s.v) {
                fail(page, 'version ?v= incohérente pour ' + s.src + ' : ' + versions[s.src] + ' vs ' + s.v);
            } else {
                versions[s.src] = s.v;
            }
        }
    });
    ok(page, 'scripts référencés (' + scripts.length + ')');

    // Layout : slots présents, ancien HTML absent
    if (!/data-layout-sidebar/.test(html)) fail(page, 'slot data-layout-sidebar manquant');
    else ok(page, 'slot sidebar');
    if (!/data-layout-topbar/.test(html)) fail(page, 'slot data-layout-topbar manquant');
    else ok(page, 'slot topbar');
    if (/<aside class="sidebar">/.test(html) || /<header class="topbar">/.test(html)) {
        fail(page, 'ancien HTML dupliqué (sidebar/topbar) encore présent');
    } else {
        ok(page, 'pas de HTML dupliqué');
    }

    // IDs requis fournis par layout.js ou par la page elle-même
    (REQUIRED_IDS[page] || []).forEach(function (id) {
        var inSearchAttr = new RegExp('data-search-id="' + id + '"').test(html);
        var inPage = new RegExp('id="' + id + '"').test(html);
        if (!inSearchAttr && !inPage && LAYOUT_IDS.indexOf(id) === -1) {
            fail(page, 'ID requis manquant : #' + id);
        }
    });
});

console.log('\n== Versions ?v= référencées ==');
var keys = Object.keys(versions).sort();
keys.forEach(function (k) { console.log('  ' + k + ' ?v=' + versions[k]); });

console.log('\n' + (failures ? '✗ ' + failures + ' problème(s)' : '✓ Smoke test OK'));
process.exit(failures ? 1 : 0);
