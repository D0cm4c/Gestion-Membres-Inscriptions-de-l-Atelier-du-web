#!/usr/bin/env node
// Bump de version cache-busting — usage : node tools/bump.js <fichier.js|fichier.css> [fichier2 ...]
// Met à jour ?v=N de TOUS les fichiers .html du projet qui référencent le fichier donné.
// Remplace la manipulation sed manuelle (source des bugs #42/#44 : page oubliée, version divergente).
//
// Exemples :
//   node tools/bump.js db.js            → db.js?v=N+1 partout
//   node tools/bump.js db.js styles.css → les deux fichiers
//
// Le smoke test (tests/smoke-pages.js) vérifie la cohérence inter-pages : ce tool la garantit à la source.

'use strict';

var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '..');
var args = process.argv.slice(2);
if (!args.length) {
    console.error('Usage : node tools/bump.js <fichier.js|fichier.css> [fichier2 ...]');
    process.exit(1);
}

var pages = fs.readdirSync(root).filter(function (f) { return f.endsWith('.html'); });
var changed = {};

args.forEach(function (target) {
    var re = new RegExp('(src|href)="' + target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\?v=(\\d+)"', 'g');
    pages.forEach(function (page) {
        var p = path.join(root, page);
        var src = fs.readFileSync(p, 'utf8');
        var touched = false;
        var out = src.replace(re, function (m, attr, ver) {
            touched = true;
            return attr + '="' + target + '?v=' + (parseInt(ver, 10) + 1) + '"';
        });
        if (touched) {
            fs.writeFileSync(p, out);
            changed[page] = (changed[page] || []).concat(target);
        }
    });
});

Object.keys(changed).sort().forEach(function (page) {
    console.log(page + ' : ' + changed[page].join(', ') + ' bumpés');
});
if (!Object.keys(changed).length) console.log('Aucune référence trouvée — vérifie le nom de fichier.');
