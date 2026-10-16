(function () {
    'use strict';

    var STATUS_MAP = {
        'actiris': 'actiris',
        'orbem': 'cpas',
        'etudiant': 'etudiant',
        'etudiant(e)': 'etudiant',
        'etudiante': 'etudiant',
        'cpas': 'cpas',
        'employe': 'travailleur',
        'employe autre': 'travailleur',
        'employe saint gilles': 'travailleur',
        'travailleur/employe': 'travailleur',
        'seniors': 'pensionne',
        'senior': 'pensionne',
        'mutuelle': 'mutuelle',
        'pensionne': 'pensionne',
        'pensionnee': 'pensionne',
        'seniors/pensionnes': 'pensionne',
        'enfant': 'enfant',
        'interim': 'interim'
    };

    var FIELD = {
        numId: 'Num_id',
        nom: 'Nom',
        prenom: 'Prénom',
        adresse: 'Adresse',
        cp: 'Code Postal',
        naissance: 'Année de naissance',
        sexe: 'Sexe',
        tel: 'N° Téléphone (GSM)',
        statut: 'Statut Social',
        debut: 'Date début Abonnement',
        fin: 'Date fin Abonnement',
        email: 'Adresse E Mail',
       aboMensuel: 'ABO mensuel',
        aboAnnuel: 'ABO annuel',
        aboAnnuelCPAS: 'ABO annuel CPAS'
    };

    var EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

    function decodeTag(tag) {
        return tag.replace(/_x([0-9A-Fa-f]{4})_/g, function (_, hex) {
            return String.fromCharCode(parseInt(hex, 16));
        });
    }

    function recordFields(rec) {
        var map = {};
        for (var i = 0; i < rec.children.length; i++) {
            var child = rec.children[i];
            map[decodeTag(child.tagName)] = child.textContent;
        }
        return map;
    }

    function normalizeSpace(s) {
        return (s || '').replace(/\s+/g, ' ').trim();
    }

    function cleanText(v) {
        var s = normalizeSpace(v);
        if (!s || /^vide$/i.test(s)) return '';
        return s;
    }

    function mapGender(v) {
        var s = normalizeSpace(v).toLowerCase();
        if (s === 'femme' || s === 'f') return 'F';
        if (s === 'homme' || s === 'm' || s === 'masculin' || s === 'h') return 'M';
        return 'X';
    }

    function mapStatus(v) {
        var s = normalizeSpace(v).toLowerCase();
        s = s.replace(/[éèê]/g, 'e').replace(/ç/g, 'c');
        return STATUS_MAP[s] || '';
    }

    function parseDate(v) {
        if (!v) return null;
        var s = normalizeSpace(v);
        var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return m[1] + '-' + m[2] + '-' + m[3];
        m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
        if (m) {
            var d = m[1].padStart(2, '0');
            var mo = m[2].padStart(2, '0');
            var y = m[3].length === 2 ? (Number(m[3]) > 70 ? '19' + m[3] : '20' + m[3]) : m[3];
            return y + '-' + mo + '-' + d;
        }
        return null;
    }

    function cleanEmail(v) {
        var s = normalizeSpace(v);
        s = s.split('#')[0].trim();
        var m = s.match(EMAIL_RE);
        return m ? m[0] : '';
    }

    function computeAge(birthYear) {
        var y = parseInt(birthYear, 10);
        if (!y || y < 1900 || y > 2100) return null;
        var age = new Date().getFullYear() - y;
        return age > 0 && age < 120 ? age : null;
    }

    function isTrue(v) {
        return normalizeSpace(v) === '-1' || normalizeSpace(v) === '1';
    }

    function parseXml(text) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(text, 'application/xml');
        if (doc.querySelector('parsererror')) throw new Error('XML invalide');
        var records = doc.documentElement.children;
        var members = [];
        var warnings = { noStatus: 0, badEmail: 0, badDate: 0 };
        for (var i = 0; i < records.length; i++) {
            var f = recordFields(records[i]);
            var numId = parseInt(f[FIELD.numId], 10);
            var lastName = cleanText(f[FIELD.nom]);
            var firstName = cleanText(f[FIELD.prenom]);
            if (!numId || (!lastName && !firstName)) continue;

            var mensuel = isTrue(f[FIELD.aboMensuel]);
            var annuel = isTrue(f[FIELD.aboAnnuel]) || isTrue(f[FIELD.aboAnnuelCPAS]);
            var subscription = mensuel ? 'monthly' : (annuel ? 'yearly' : 'none');

            var statusRaw = f[FIELD.statut];
            var status = mapStatus(statusRaw);
            if (!status && statusRaw) warnings.noStatus++;

            var emailRaw = cleanText(f[FIELD.email]);
            var email = cleanEmail(emailRaw);
            if (emailRaw && !email) warnings.badEmail++;

            var endRaw = f[FIELD.fin];
            var endDate = parseDate(endRaw);
            if (endRaw && !endDate) warnings.badDate++;

            members.push({
                member_no: numId,
                first_name: firstName,
                last_name: lastName,
                address: cleanText(f[FIELD.adresse]),
                postal_code: cleanText(f[FIELD.cp]) || null,
                age: computeAge(f[FIELD.naissance]),
                gender: mapGender(f[FIELD.sexe]),
                phone: cleanText(f[FIELD.tel]),
                email: email,
                social_status: status || null,
                start_date: parseDate(f[FIELD.debut]),
                end_date: endDate,
                subscription: subscription
            });
        }
        return { members: members, warnings: warnings };
    }

    window.ADWImport = { parseXml: parseXml };
})();
