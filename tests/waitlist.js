#!/usr/bin/env node
/* Test unitaire de Database.normalizeTitle (matching listes d'attente)
   La fonction la plus risquée de la PR : un titre normalisé vide ne doit JAMAIS
   produire un LIKE '%%' (qui matcherait toutes les listes d'attente).
   Exécution : node tests/waitlist.js (CI) */

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// Extraire normalizeTitle de db.js sans charger sql.js :
// évaluer le fichier dans un contexte où les dépendances sont neutralisées.
var src = fs.readFileSync(path.join(__dirname, '..', 'db.js'), 'utf-8');
var ctx = {
    window: {},
    initSqlJs: function () { return Promise.reject(new Error('no sql')); },
    indexedDB: {},
    IDBKeyRange: {},
    console: console,
    Promise: Promise,
    setTimeout: setTimeout
};
var Database;
try {
    vm.createContext(ctx);
    vm.runInContext(src + '\n;typeof Database !== "undefined" ? Database : (typeof window.ADWDatabase !== "undefined" ? window.ADWDatabase : null);', ctx);
} catch (e) { /* db.js peut exiger sql.js : normalizeTitle est pur, on la récupère autrement */ }

var norm = (ctx.Database && ctx.Database.normalizeTitle) || (ctx.window.ADWDatabase && ctx.window.ADWDatabase.normalizeTitle);
if (!norm) {
    // fallback : évaluer uniquement la fonction par extraction de source
    var m = src.match(/Database\.normalizeTitle = function[\s\S]*?\n    \};/);
    if (!m) { console.error('✗ normalizeTitle introuvable'); process.exit(1); }
    var body = m[0].replace(/^Database\.normalizeTitle = /, '').replace(/;\s*$/, '');
    var fn = vm.runInNewContext('(' + body + ')');
    norm = fn;
}

var fails = 0;
function check(input, expected) {
    var out = norm(input);
    var ok = out === expected;
    if (!ok) { fails++; console.error('✗ normalizeTitle(' + JSON.stringify(input) + ') = ' + JSON.stringify(out) + ' (attendu : ' + JSON.stringify(expected) + ')'); }
    else { console.log('✓ ' + JSON.stringify(input) + ' → ' + JSON.stringify(out)); }
}

// Cas réels du site (titres MEC)
check('CRÉEZ DES DESIGNS AVEC CANVA', 'créez des designs avec canva');
check('CRÉEZ DES DESIGNS AVEC CANVA — LES 05, 06, 12 ET 13 NOVEMBRE', 'créez des designs avec canva');
check('Initiation à WordPress', 'initiation à wordpress');
check('LES 05 ET 06 NOVEMBRE', '');            // titre entièrement date → vide (garde anti-match-tout)
check('', '');                                  // vide
check(null, '');                                // null safe
check('A', 'a');                               // 1 lettre : normalizeTitle la garde — c'est matchWaitlistForFormation qui refuse (< 4)

console.log(fails ? '\n✗ ' + fails + ' échec(s)' : '\n✓ normalizeTitle OK');
process.exit(fails ? 1 : 0);
