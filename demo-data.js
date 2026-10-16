(function () {
    'use strict';

    // Données de démonstration entièrement fictives
    var DEMO_MEMBERS = [
    { last: 'Dubois', first: 'Marie', cp: '1060', gender: 'F', status: 'pensionne', sub: 'monthly', start: '2026-01-15', end: '2026-11-14', phone: '0475 12 34 56', email: 'marie.dubois@example.be', address: 'Rue Verte 12' },
    { last: 'Van Damme', first: 'Luc', cp: '1060', gender: 'M', status: 'travailleur', sub: 'yearly', start: '2025-11-02', end: '2026-11-01', phone: '0478 45 67 89', email: 'luc.vandamme@example.be', address: 'Av. Fonsny 8' },
    { last: 'El Amrani', first: 'Sofia', cp: '1070', gender: 'F', status: 'actiris', sub: 'none', start: '2026-03-10', end: '2026-04-09', phone: '0486 22 33 44', email: 'sofia.elamrani@example.be', address: 'Rue de la Barrière 45' },
    { last: 'Peeters', first: 'Jan', cp: '1000', gender: 'M', status: 'interim', sub: 'monthly', start: '2026-02-20', end: '2026-03-19', phone: '0471 98 76 54', email: 'jan.peeters@example.be', address: 'Rue du Marché 3' },
    { last: 'Mukendi', first: 'Grace', cp: '1190', gender: 'F', status: 'etudiant', sub: 'none', start: '2026-05-05', end: '2026-08-05', phone: '0492 11 22 33', email: 'grace.mukendi@example.be', address: 'Rue Saint-Denis 21' },
    { last: 'De Smet', first: 'Karel', cp: '1060', gender: 'M', status: 'cpas', sub: 'yearly', start: '2024-10-01', end: '2025-09-30', phone: '0477 33 44 55', email: 'karel.desmet@example.be', address: 'Chaussée de Forest 77' },
    { last: 'Lefebvre', first: 'Céline', cp: '1050', gender: 'F', status: 'mutuelle', sub: 'monthly', start: '2026-04-12', end: '2026-05-11', phone: '0485 66 77 88', email: 'celine.lefebvre@example.be', address: 'Rue Jourdan 15' },
    { last: 'Ozturk', first: 'Emre', cp: '1030', gender: 'M', status: 'travailleur', sub: 'none', start: '2026-06-01', end: '2026-06-30', phone: '0468 55 66 77', email: 'emre.ozturk@example.be', address: 'Rue de la Consort 5' },
    { last: 'Silva', first: 'Ana', cp: '1080', gender: 'F', status: 'actiris', sub: 'monthly', start: '2025-12-03', end: '2026-06-02', phone: '0499 88 99 00', email: 'ana.silva@example.be', address: 'Boulevard Léopold II 110' },
    { last: 'Janssens', first: 'Wim', cp: '1060', gender: 'M', status: 'pensionne', sub: 'none', start: '2023-05-15', end: '2024-05-14', phone: '0473 21 43 65', email: 'wim.janssens@example.be', address: 'Rue de l\'Hôtel des Postes 2' },
    { last: 'Ntumba', first: 'Josephine', cp: '1210', gender: 'F', status: 'enfant', sub: 'none', start: '2026-07-20', end: '2026-08-19', phone: '', email: '', address: 'Rue Royale 140' },
    { last: 'Moreau', first: 'Pierre', cp: '1060', gender: 'M', status: 'pensionne', sub: 'yearly', start: '2025-08-08', end: '2026-08-07', phone: '0474 56 78 90', email: 'pierre.moreau@example.be', address: 'Rue Orts 9' },
    { last: 'Benali', first: 'Yasmine', cp: '1070', gender: 'F', status: 'etudiant', sub: 'monthly', start: '2026-01-28', end: '2026-07-27', phone: '0494 33 22 11', email: 'yasmine.benali@example.be', address: 'Chaussée de Haecht 63' },
    { last: 'Claus', first: 'Dirk', cp: '1020', gender: 'M', status: 'travailleur', sub: 'none', start: '2026-09-01', end: '2026-10-01', phone: '0476 44 55 66', email: 'dirk.claus@example.be', address: 'Rue de Laeken 30' },
    { last: 'Kabongo', first: 'Chantal', cp: '1060', gender: 'F', status: 'cpas', sub: 'none', start: '2024-03-17', end: '2025-03-16', phone: '0487 77 88 99', email: 'chantal.kabongo@example.be', address: 'Rue de la Croix 18' },
    { last: 'Willems', first: 'An', cp: '1160', gender: 'F', status: 'interim', sub: 'monthly', start: '2026-02-14', end: '2026-08-13', phone: '0495 12 12 12', email: 'an.willems@example.be', address: 'Chaussée de Wavre 250' },
    { last: 'Rahmani', first: 'Karim', cp: '1060', gender: 'M', status: 'actiris', sub: 'none', start: '2025-06-25', end: '2025-12-24', phone: '0489 45 45 45', email: 'karim.rahmani@example.be', address: 'Rue Gray 17' },
    { last: 'Declercq', first: 'Bernadette', cp: '1180', gender: 'F', status: 'pensionne', sub: 'yearly', start: '2024-01-10', end: '2025-01-09', phone: '0472 87 65 43', email: 'bernadette.declercq@example.be', address: 'Rue Vanderkindere 305' },
    { last: 'Diallo', first: 'Mamadou', cp: '1060', gender: 'M', status: 'travailleur', sub: 'monthly', start: '2026-05-30', end: '2026-11-29', phone: '0481 23 32 10', email: 'mamadou.diallo@example.be', address: 'Avenue du Roi 100' },
    { last: 'Vandenberghe', first: 'Liesbeth', cp: '1050', gender: 'X', status: 'etudiant', sub: 'none', start: '2026-08-19', end: '2026-09-18', phone: '0497 65 43 21', email: 'liesbeth.vdb@example.be', address: 'Rue Malibran 4' }
    ];

    function pad(n) { return String(n).padStart(2, '0'); }

    function loadDemo(db) {
        return new Promise(function (resolve) {
            var existing = {};
            db.queryAll("SELECT id, first_name, last_name FROM members").forEach(function (r) {
                existing[r.first_name + '|' + r.last_name] = true;
            });
            var toInsert = DEMO_MEMBERS.filter(function (m) {
                return !existing[m.first + '|' + m.last];
            });
            var today = new Date();
            var raw = db.db;
            raw.run('BEGIN TRANSACTION');
            var stmt = raw.prepare(
                'INSERT INTO members (id, member_no, first_name, last_name, age, phone, email, address, postal_code, gender, social_status, start_date, end_date, subscription) ' +
                'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            toInsert.forEach(function (m, i) {
                var id = 'demo' + i;
                stmt.run([id, null, m.first, m.last,
                    m.status === 'enfant' ? 11 : (m.status === 'etudiant' ? 21 : 25 + (i % 40)),
                    m.phone || null, m.email || null, m.address || null,
                    m.cp, m.gender, m.status, m.start, m.end, m.sub]);
            });
            stmt.free();

            // quelques visites et impressions pour animer le dashboard
            var visitStmt = raw.prepare('INSERT INTO visits (id, member_id, visit_date, amount) VALUES (?, ?, ?, ?)');
            var printStmt = raw.prepare('INSERT INTO prints (id, member_id, print_date, type, amount, paid) VALUES (?, ?, ?, ?, ?, 0)');
            var demoIds = raw.exec("SELECT id FROM members WHERE id LIKE 'demo%'");
            var runStamp = Date.now().toString(36);
            if (demoIds.length) {
                demoIds[0].values.forEach(function (row, idx) {
                    var id = row[0];
                    for (var d = 0; d < 6; d++) {
                        var day = new Date(today);
                        day.setDate(day.getDate() - (d * 2 + (idx % 3)));
                        var date = day.getFullYear() + '-' + pad(day.getMonth() + 1) + '-' + pad(day.getDate());
                        if ((idx + d) % 3 !== 0) {
                            visitStmt.run(['dv' + runStamp + '-' + idx + '-' + d, id, date, idx % 4 === 0 ? 1 : 0]);
                        }
                    }
                    if (idx % 5 === 2) {
                        printStmt.run(['dp' + runStamp + '-' + idx, id, today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate()), idx % 2 ? 'color' : 'bw', idx % 2 ? 0.5 : 0.1]);
                    }
                });
            }
            visitStmt.free();
            printStmt.free();
            raw.run('COMMIT');
            resolve(toInsert.length);
        });
    }

    window.ADWDemo = { loadDemo: loadDemo, members: DEMO_MEMBERS };
})();
