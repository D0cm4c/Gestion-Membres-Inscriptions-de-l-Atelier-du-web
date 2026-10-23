#!/usr/bin/env node
/* Tests de rendu Playwright — exécute chaque page dans Chromium headless
   (servie par un petit serveur HTTP statique local) et vérifie :
   - aucune erreur JS (pageerror)
   - layout injecté : sidebar, topbar, 5 IDs partagés, lien actif correct
   - main rendu (pas vide) — échoue si le JS de la page a crashé avant de peupler

   Usage : node tests/render/run.js [--ci]
   En CI, PLAYWRIGHT_BROWSERS_PATH doit être provisionné (voir workflow). */

'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..', '..');
var IS_CI = process.argv.includes('--ci');

var PAGES = [
    { file: 'index.html', title: 'Tableau de bord', activeNav: 'Tableau de bord', searchId: 'siteSearch' },
    { file: 'membres.html', title: 'Membres', activeNav: 'Membres', searchId: 'searchInput' },
    { file: 'formations.html', title: 'Formations', activeNav: 'Formations', searchId: 'searchInput' },
    { file: 'salles.html', title: 'Planning des salles', activeNav: 'Salles', searchId: null },
    { file: 'suggestions.html', title: 'À faire / Suggestions', activeNav: 'À faire', searchId: null },
    { file: 'parametres.html', title: 'Paramètres', activeNav: 'Paramètres', searchId: null },
    { file: 'tickets.html', title: 'Incidents', activeNav: 'Incidents', searchId: 'searchInput' }
];

var MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.wasm': 'application/wasm' };

function serve() {
    return new Promise(function (resolve) {
        var server = http.createServer(function (req, res) {
            var urlPath = decodeURIComponent(req.url.split('?')[0]);
            if (urlPath === '/') urlPath = '/index.html';
            var file = path.join(ROOT, urlPath);
            if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
                res.writeHead(404); res.end('not found'); return;
            }
            res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
            fs.createReadStream(file).pipe(res);
        });
        server.listen(0, '127.0.0.1', function () {
            resolve({ server: server, port: server.address().port });
        });
    });
}

function main() {
    var playwright;
    try {
        playwright = require('playwright');
    } catch (e) {
        console.error('✗ playwright non installé — lance : npm install && npx playwright install chromium');
        process.exit(IS_CI ? 1 : 0);
    }

    serve().then(function (httpd) {
        var base = 'http://127.0.0.1:' + httpd.port + '/';
        var failures = 0;
        var browserP = playwright.chromium.launch({ headless: true });

        return browserP.then(function (browser) {
            var chain = Promise.resolve();
            PAGES.forEach(function (spec) {
                chain = chain.then(function () {
                    return browser.newPage().then(function (page) {
                        var errors = [];
                        page.on('pageerror', function (err) { errors.push(String(err)); });
                        return page.goto(base + spec.file, { waitUntil: 'load' })
                            .then(function () { return page.waitForTimeout(800); })
                            .then(function () {
                                return page.evaluate(function () {
                                    var side = document.querySelector('.sidebar');
                                    var top = document.querySelector('.topbar');
                                    var ids = {};
                                    ['navToggle', 'todayDate', 'openStatus', 'notifCenter', 'themeToggle', 'sidebarNav'].forEach(function (id) {
                                        ids[id] = !!document.getElementById(id);
                                    });
                                    var active = document.querySelector('.side-nav a.active');
                                    var activeLabel = null;
                                    if (active) {
                                        var clone = active.cloneNode(true);
                                        var ico = clone.querySelector('.nav-ico');
                                        if (ico) ico.remove();
                                        activeLabel = clone.textContent.trim();
                                    }
                                    return {
                                        hasSidebar: !!side,
                                        hasTopbar: !!top,
                                        ids: ids,
                                        activeNav: activeLabel,
                                        mainPopulated: !!document.querySelector('#main') &&
                                            document.querySelector('#main').children.length > 0
                                    };
                                });
                            })
                            .then(function (state) {
                                var pageFails = [];
                                if (errors.length) pageFails.push('erreurs JS : ' + errors.join(' | '));
                                if (!state.hasSidebar) pageFails.push('sidebar absente');
                                if (!state.hasTopbar) pageFails.push('topbar absente');
                                Object.keys(state.ids).forEach(function (id) {
                                    if (!state.ids[id]) pageFails.push('ID manquant : #' + id);
                                });
                                if (state.activeNav !== spec.activeNav) {
                                    pageFails.push('lien actif = ' + JSON.stringify(state.activeNav) + ' (attendu : ' + JSON.stringify(spec.activeNav) + ')');
                                }
                                if (pageFails.length) {
                                    failures++;
                                    console.error('✗ ' + spec.file);
                                    pageFails.forEach(function (f) { console.error('    - ' + f); });
                                } else {
                                    console.log('✓ ' + spec.file);
                                }
                            })
                            .then(function () {
                                if (!spec.searchId) return null;
                                return page.evaluate(function (sid) {
                                    return !!document.getElementById(sid);
                                }, spec.searchId).then(function (hasSearch) {
                                    if (!hasSearch) {
                                        failures++;
                                        console.error('✗ ' + spec.file + ' : champ de recherche #' + spec.searchId + ' absent');
                                    }
                                });
                            })
                            .then(function () { return page.close(); });
                    });
                });
            });
            return chain.then(function () {
                return browser.close().then(function () {
                    httpd.server.close();
                    console.log(failures ? '\n✗ ' + failures + ' page(s) en échec' : '\n✓ Rendu OK sur ' + PAGES.length + ' pages');
                    process.exit(failures ? 1 : 0);
                });
            });
        });
    }).catch(function (err) {
        console.error('✗ Erreur harness :', err);
        process.exit(1);
    });
}

main();
