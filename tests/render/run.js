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
    { file: 'tickets.html', title: 'Incidents', activeNav: 'Incidents', searchId: 'searchInput' },
    { file: 'ticket.html?id=demo', title: 'Incidents', activeNav: null, searchId: null },
    { file: 'notifications.html', title: 'Notifications', activeNav: 'Notifications', searchId: null }
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
                                        var nb = clone.querySelector('.nav-badge'); // badge non-lus (Notifications)
                                        if (nb) nb.remove();
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
            // ===== C8 : scenario comportemental formation.html =====
            // Semer une formation + 2 inscrits, cliquer paiement/presence, verifier etats + KPI.
            chain = chain.then(function () {
                return browser.newPage().then(function (page) {
                    var errs = [];
                    page.on("pageerror", function (e) { errs.push(String(e)); });
                    return page.goto(base + "formation.html?id=c8demo", { waitUntil: "load" })
                        .then(function () { return page.waitForTimeout(900); })
                        .then(function () {
                            return page.evaluate(function () {
                                var db = window.ADWDatabase;
                                if (!db) return { seeded: false };
                                try { db.run("DELETE FROM formations_members WHERE formation_id = (SELECT id FROM formations WHERE event_id = 'c8demo')"); } catch (e) {}
                                try { db.run("DELETE FROM formations WHERE event_id = 'c8demo'"); } catch (e) {}
                                try { db.run("DELETE FROM members WHERE id IN ('c8m1','c8m2')"); } catch (e) {}
                                db.run("INSERT INTO formations (id, event_id, title, start_date, date_text, time_label, price, location, organizer) VALUES ('c8f', 'c8demo', 'Test C8 Canva', date('now'), 'aujourdhui', 'De 9h30 a 12h30', '40.00', 'Atelier du web', 'Testeur')");
                                db.run("INSERT INTO members (id, first_name, last_name, member_no, email) VALUES ('c8m1', 'Marie', 'Dubois', 101, 'm@x.be')");
                                db.run("INSERT INTO members (id, first_name, last_name, member_no, email) VALUES ('c8m2', 'Luc', 'Vandamme', 102, 'l@x.be')");
                                db.registerMemberToFormation("c8f", "c8m1");
                                db.registerMemberToFormation("c8f", "c8m2");
                                return { seeded: true };
                            });
                        })
                        .then(function (seed) {
                            if (!seed || !seed.seeded) { errs.push("ADWDatabase indisponible"); return []; }
                            return page.reload({ waitUntil: "load" })
                                .then(function () { return page.waitForTimeout(900); })
                                .then(function () {
                                    return page.evaluate(function () {
                                        var lines = document.querySelectorAll(".fm-line");
                                        var bc = lines[0] && lines[0].querySelector('[data-pay="bancontact"]');
                                        if (bc) bc.click();
                                        return { count: lines.length };
                                    });
                                })
                                .then(function (s1) {
                                    return page.waitForTimeout(400).then(function () {
                                        return page.evaluate(function () {
                                            var lines = document.querySelectorAll(".fm-line");
                                            return {
                                                line1Paid: lines[0] ? lines[0].className.indexOf("fm-paid") !== -1 : false,
                                                line1BtnPaid: lines[0] && lines[0].querySelector('[data-pay="bancontact"]') ? lines[0].querySelector('[data-pay="bancontact"]').className.indexOf("is-paid") !== -1 : false,
                                                cashDisabled: lines[0] && lines[0].querySelector('[data-pay="cash"]') ? !!lines[0].querySelector('[data-pay="cash"]').disabled : false,
                                                kpi: (document.querySelector(".fkpi-row") || {}).textContent || ""
                                            };
                                        }).then(function (s2) {
                                            var checks = [
                                                ["2 lignes inscrits", s1.count === 2],
                                                ["ligne 1 fm-paid apres clic bancontact", s2.line1Paid],
                                                ["bouton bancontact is-paid", s2.line1BtnPaid],
                                                ["bouton cash desactive", s2.cashDisabled],
                                                ["KPI ratio present", s2.kpi.indexOf("/ 2") !== -1]
                                            ];
                                            return page.evaluate(function () {
                                                var lines = document.querySelectorAll(".fm-line");
                                                var att = lines[1] && lines[1].querySelector(".fm-att");
                                                if (att) att.click();
                                            }).then(function () { return page.waitForTimeout(400); }).then(function () {
                                                return page.evaluate(function () {
                                                    var lines = document.querySelectorAll(".fm-line");
                                                    return lines[1] ? lines[1].className.indexOf("fm-present") !== -1 : false;
                                                });
                                            }).then(function (line2Present) {
                                                checks.push(["ligne 2 fm-present apres clic presence", line2Present]);
                                                return checks;
                                            });
                                        });
                                    });
                                });
                        })
                        .then(function (checks) {
                            var fails = (checks || []).filter(function (c) { return !c[1]; });
                            if (errs.length) fails.push(["erreurs JS", false, errs.join(" | ")]);
                            if (fails.length) {
                                failures++;
                                console.error("ECHEC formation.html (comportemental)");
                                fails.forEach(function (f) { console.error("    - " + f[0]); });
                            } else {
                                console.log("OK formation.html (comportemental : boutons paiement/presence, KPI, re-rendu)");
                            }
                            return page.evaluate(function () {
                                try { window.ADWDatabase.run("DELETE FROM formations_members WHERE formation_id = 'c8f'"); } catch (e) {}
                                try { window.ADWDatabase.run("DELETE FROM formations WHERE event_id = 'c8demo'"); } catch (e) {}
                                try { window.ADWDatabase.run("DELETE FROM members WHERE id IN ('c8m1','c8m2')"); } catch (e) {}
                            }).catch(function () {});
                        })
                        .then(function () { return page.close(); });
                });
            });

            // ===== Page Notifications : scenario comportemental =====
            // Seeder des notifs, tester filtres + marquage individuel + pagination.
            chain = chain.then(function () {
                return browser.newPage().then(function (page) {
                    var errs = [];
                    page.on("pageerror", function (e) { errs.push(String(e)); });
                    return page.goto(base + "notifications.html", { waitUntil: "load" })
                        .then(function () { return page.waitForTimeout(900); })
                        .then(function () {
                            return page.evaluate(function () {
                                var db = window.ADWDatabase;
                                if (!db) return { seeded: false };
                                try { db.run("DELETE FROM notifications"); } catch (e) {}
                                // 3 non lues + 2 lues, categories variees
                                db.notify("ticket_urgent", "Incident urgent test A", "danger", JSON.stringify({ ticket_id: "t1" }));
                                db.notify("room_needed", "Formation sans salle B", "warning", JSON.stringify({ event_id: "e1" }));
                                db.notify("sync_formations", "Synchro OK C", "info", null);
                                db.notify("checkin", "Visite pointee D", "success", null);
                                db.notify("print", "Impression E", "info", null);
                                db.run("UPDATE notifications SET is_read = 1 WHERE message LIKE '%D%' OR message LIKE '%E%'");
                                return { seeded: true };
                            });
                        })
                        .then(function (seed) {
                            if (!seed || !seed.seeded) { errs.push("seed impossible"); return []; }
                            // Pas de reload : le seed vit en memoire dans la page ;
                            // un clic sur un filtre re-render avec les donnees fraiches.
                            return page.waitForTimeout(200)
                                .then(function () {
                                    // filtre Non lus : 3 items
                                    return page.evaluate(function () {
                                        var btns = document.querySelectorAll("[data-nfilter]");
                                        for (var i = 0; i < btns.length; i++) {
                                            if (btns[i].getAttribute("data-nfilter") === "unread") btns[i].click();
                                        }
                                        return null;
                                    }).then(function () { return page.waitForTimeout(300); }).then(function () {
                                        return page.evaluate(function () {
                                            return document.querySelectorAll(".notif-page-item").length;
                                        });
                                    }).then(function (unreadCount) {
                                        var checks = [["filtre Non lus = 3 items", unreadCount === 3]];
                                        // marquage individuel : cliquer Lu sur la 1re
                                        return page.evaluate(function () {
                                            var b = document.querySelector(".n-read");
                                            if (b) b.click();
                                            return null;
                                        }).then(function () { return page.waitForTimeout(300); }).then(function () {
                                            return page.evaluate(function () {
                                                return document.querySelectorAll(".notif-page-item").length;
                                            });
                                        }).then(function (afterRead) {
                                            checks.push(["apres marquage lu : 2 non lues", afterRead === 2]);
                                            // filtre Alertes : 1 item (ticket_urgent)
                                            return page.evaluate(function () {
                                                var btns = document.querySelectorAll("[data-nfilter]");
                                                for (var i = 0; i < btns.length; i++) {
                                                    if (btns[i].getAttribute("data-nfilter") === "alerts") btns[i].click();
                                                }
                                                return null;
                                            }).then(function () { return page.waitForTimeout(300); }).then(function () {
                                                return page.evaluate(function () {
                                                    return { count: document.querySelectorAll(".notif-page-item").length,
                                                             hasOpen: !!document.querySelector('a[href*="ticket.html"]') };
                                                });
                                            }).then(function (alerts) {
                                                checks.push(["filtre Alertes = 1 item", alerts.count === 1]);
                                                checks.push(["bouton Ouvrir le ticket present", alerts.hasOpen]);
                                                return checks;
                                            });
                                        });
                                    });
                                });
                        })
                        .then(function (checks) {
                            var fails = (checks || []).filter(function (c) { return !c[1]; });
                            if (errs.length) fails.push(["erreurs JS", false, errs.join(" | ")]);
                            if (fails.length) {
                                failures++;
                                console.error("ECHEC notifications.html (comportemental)");
                                fails.forEach(function (f) { console.error("    - " + f[0]); });
                            } else {
                                console.log("OK notifications.html (comportemental : filtres, marquage, actions)");
                            }
                            return page.evaluate(function () {
                                try { window.ADWDatabase.run("DELETE FROM notifications"); } catch (e) {}
                            }).catch(function () {});
                        })
                        .then(function () { return page.close(); });
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
