# Guide backend — migration vers serveur Node.js + SQLite partagé

> **Destination : collègue en charge du serveur Node.js.**
> Ce guide part du code existant (la maquette) et décrit précisément comment la transformer en application multi-poste. Tout ce qui est décrit ici est **déjà anticipé dans le code de la maquette** : schéma SQL standard, requêtes paramétrées, logique métier découplée.

## 1. Architecture cible

Un seul serveur Node.js remplit **les deux rôles** :

```
Poste 1 ──┐
Poste 2 ──┼──►  Serveur Node (http://192.168.x.x:3000)
Poste 3 ──┘         │
                    ├── Rôle A : servir l'app (fichiers statiques = ce dépôt)
                    │            express.static → remplace GitHub Pages
                    │
                    └── Rôle B : l'API données + la base unique
                                 endpoints REST /api/…
                                 better-sqlite3 → un fichier membres.db
```

- **Frontend** : ce dépôt, servi par le serveur (aucune modification des pages, `db.js` client remplacé par un client HTTP — voir §5).
- **Base** : un fichier SQLite unique sur le disque du serveur. Sauvegarde = copier le fichier.
- **Réseau** : en local (recommandé : PC de l'Atelier), l'appli fonctionne même sans Internet (seule la sync des formations depuis atelierduweb.be a besoin du web).

## 2. Installation du serveur (Linux)

```bash
# Node.js 22 LTS (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Projet serveur
mkdir adw-serveur && cd adw-serveur
npm init -y
npm install express better-sqlite3 cors
```

Ossature minimale (`serveur.js`) :

```js
const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database('membres.db');   // créé automatiquement
db.pragma('journal_mode = WAL');         // multi-utilisateurs sûrs

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));  // ce dépôt dans public/

// (endpoints ici — voir §4)

app.listen(3000, '0.0.0.0', () => console.log('http://localhost:3000'));
```

## 3. Le schéma SQL — à reprendre TEL QUEL

Il est dans `db.js`, fonction `ensureSchema()` (lignes ~74-220). **10 tables**, SQLite standard, aucune dépendance navigateur :

| Table | Rôle | Clés |
|---|---|---|
| `members` | fiches membres | `id` (TEXT, uuid), `member_no` unique auto (#1000…) |
| `visits` | pointage des visites (1 € ou abonnement) | FK `member_id` |
| `prints` | impressions (montants, payé/à solder) | FK `member_id` |
| `formations` | formations sync depuis le site | `event_id` MEC = clé naturelle UNIQUE |
| `formations_members` | inscriptions locales | UNIQUE(formation_id, member_id) |
| `formation_dates` | dates + créneaux (AM/PM) par formation | FK `formation_id` |
| `rooms` | salles (seed : Grande 15, Petite 8, Cyber 25) | `id` TEXT |
| `bookings_remote` | réservations faites sur le site, en attente de rattachement | `event_id` MEC |
| `notifications` | journal des actions automatiques | type + sévérité |
| `suggestions` | demandes « à faire » | statut open/done/discarded |
| `tickets` | incidents du cyberespace (matériel/réseau) | catégorie, matériel, priorité (low→urgent), statut (open→closed), assigné en texte libre (pas de comptes) |
| `ticket_comments` | suivi du dépannage par ticket | FK ticket_id (suppression en cascade côté app) |

### Index recommandés pour better-sqlite3 (audit oct. 2026)
- `CREATE INDEX IF NOT EXISTS idx_visits_member_date ON visits(member_id, visit_date)` — le dashboard et la fiche membre filtrent par membre+date à chaque chargement
- `CREATE INDEX IF NOT EXISTS idx_members_enddate ON members(end_date)` — alertes d'expiration (dashboard, 2 requêtes/jour)
- Les index existants (idx_fdates, idx_sugg_status, idx_notif_unread, idx_booking_unprocessed, idx_tickets_status, idx_tcomments) migrent tels quels.

À faire côté serveur : copier les `CREATE TABLE IF NOT EXISTS` dans un script `schema.sql`, exécuté au démarrage. Les requêtes de la maquette (dans les 36 méthodes, §4) sont **standard et paramétrées** — elles tournent sur better-sqlite3 sans réécriture.

## 4. L'API métier existante — inventaire complet

La maquette expose `window.ADWDatabase` (36 méthodes dans `db.js`). **Chaque méthode = un endpoint REST à créer** (ou presque) :

### Membres (page membres.html, app.js)
| Méthode actuelle | Endpoint suggéré | Notes |
|---|---|---|
| CRUD via `run()` direct dans app.js | `GET/POST/PUT/DELETE /api/membres` | regrouper le CRUD dispersé |
| `nextMemberNo()` | intégré au POST | n° auto 4 chiffres |
| `deleteMemberCompletely(id)` | `DELETE /api/membres/:id` | **cascade** : visites + prints + liens formations (RGPD) |
| `purgeAllPersonalData()` | `POST /api/rgpd/purge` | ⚠️ à protéger par auth |

### Visites & impressions (app.js, dashboard.js)
- `run('INSERT INTO visits…')`, refus double pointage → `POST /api/visites`
- impressions (solde, payement) → `POST /api/impressions`

### Formations (formations.html, mec.js)
| Méthode | Rôle |
|---|---|
| `syncFormations(events)` | maj/ajout/retrait depuis le flux du site |
| `listFormations()` / `getFormation(id)` / `getFormationByEventId(eid)` | lecture |
| `registerMemberToFormation` / `unregisterMemberFromFormation` | inscriptions locales |
| `getFormationAttendees(fid)` / `getMemberFormations(mid)` | listes croisées |
| `setFormationRoom` / `setFormationDates` | attribution salle + créneaux |
| `formationsWithoutRoom()` | rappel d'attribution |
| `applyMirror()` | désinscription auto quand résa annulée sur le site |

### Réservations du site (bookings_remote)
| Méthode | Rôle |
|---|---|
| `upsertBookings(list)` | réception des réservations du site |
| `listUnprocessedBookings()` | file de validation |
| `markBookingProcessed(id, action, memberId)` | traitements |
| `matchBookingToMember(booking)` | **matching hiérarchique** : n° membre > email > nom/prénom — voir la logique dans le code (§6) |

### Salles
`listRooms`, `addRoom`, `renameRoom`, `deleteRoom` (bloquée si occupée), `getRoomPlanning(mois)`, `getRoomConflicts(fid, rid)`

### Divers
Notifications (`notify`, `list`, `unreadCount`, `markAllRead`, `clear`), suggestions (`add`, `list`, `setStatus`).

## 5. Ce qui change côté client — et ce qui ne change pas

**Ne change pas** : toutes les pages HTML, `styles.css`, `layout.js`, `escape.js`, `mec.js` (le client API du site peut rester côté navigateur, ou migrer côté serveur pour la sync planifiée), `app.js`, `dashboard.js` etc. — seule leur façon d'accéder aux données change.

**Change — `db.js` client** : remplacer l'implémentation sql.js/IndexedDB par un client HTTP qui expose **les mêmes noms de méthodes** (`window.ADWDatabase`). Exemple :

```js
// avant (maquette) : Database.queryAll('SELECT …', params)
// après (serveur)  :
window.ADWDatabase = {
  listFormations: () => fetch('/api/formations').then(r => r.json()),
  registerMemberToFormation: (fid, mid) =>
    fetch(`/api/formations/${fid}/membres`, { method: 'POST', body: JSON.stringify({ mid }) }),
  // … même signature pour chaque méthode de l'inventaire §4
};
```

Les scripts de pages (app.js, formations.html…) appellent déjà `ADWDatabase.*` partout : **ils n'ont pas besoin de savoir** si derrière c'est sql.js ou le serveur.

**À ne PAS porter côté serveur** (spécifique navigateur) :
- `openIndexedDB` / `saveToIndexedDB` / `loadFromIndexedDB` (persistance → le fichier .db suffit)
- `migrateLocalStorage()` (migration de l'ère pré-SQLite)
- le debounce `persist()`/`flush()` (better-sqlite3 est synchrone)

## 6. Logique métier à connaître avant de coder

- **Sync formations** (`mec.js` + `syncFormations`) : la maquette utilise l'API publique `wp-json/wp/v2/mec-events` (sans clé) et parse les dates FR des extraits (« le lundi 23 novembre »…) via `parseFrDates()`. **Côté serveur, privilégier l'API officielle MEC** (§ sécurité point 3) : dates structurées (`/next-occurrences`) et tarifs (`/tickets`) sans parsing, en cron (l'équivalent du cache 15 min de la maquette).
- **Matching des réservations** (`matchBookingToMember`, db.js ~620) : hiérarchie stricte — (1) n° de membre exact → auto, (2) email exact → auto, (3) nom+prénom → **toujours validation humaine**, (4) sinon création de membre. **Règle du projet : toute action automatique est notifiée et journalisée** (table `notifications`).
- **Miroir site → app** : l'inscription se fait sur atelierduweb.be (jamais dans l'app) ; l'app rapproche (`applyMirror`) et retire automatiquement les annulations — toujours avec notification.
- **Conflits de salle** : NON bloquants par décision — avertissement + journal, l'humain tranche.
- **RGPD** : suppression membre = cascade complète ; purge globale séparée.

## 7. Sécurité — décisions déjà prises (ne pas les contredire)

1. **Aucune clé API dans le JS public** (décision utilisateur explicite) : la synchro des bookings MEC doit rester **server-to-server**, jamais appelée depuis le navigateur. Le plugin WordPress prévoit une route protégée par secret.
2. L'API WP utilisée dans la maquette est **publique et sans clé** (`wp/v2/mec-events`) — c'est un choix assumé côté navigateur.
3. **API officielle MEC (`wp-json/mec/v1.0`, header `mec-token`)**
   - Champs **tarif** (`/tickets`), **lieu** et **organisateur** (détail event) : à récupérer côté serveur (clé en config) plutôt que parsés depuis les pages HTML — le parsing navigateur (page-formation.js `parseMecBlock`, oct. 2026) est un palliatif en attendant : il extrait Tarif/Lieu/Organisateur/Labels du bloc HTML public et les persiste en base (`formations.price/location/organizer`). Le serveur remplira ces champs proprement via l'API MEC en cron. — testée le 22 oct. 2026, fonctionne avec clé.** Réserves au serveur (clé en config serveur, JAMAIS dans le JS) :
   - `GET /events/{id}` (Single Event) : **une seule requête renvoie TOUT** — testé en réel :
     - `data.locations` : **lieu** (nom, adresse complète) — remplace le module 2 du plugin prévu
     - `data.organizers` : **organisateur** (nom, email, page équipe, photo) — remplace le module 1
     - `data.tickets` + `availability` : **tarifs ET places restantes** — remplace le module 3
     - `data.labels` : inclut « **Complet** » (#dd3333) — l'état complet est déjà là
     - `data.categories` : noms directement (plus de résolution IDs → noms)
     - `data.dates[]` + `data.time` : dates/horaires structurés (« 10h00 »–« 12h00 », timestamps)
     - `data.featured_image`, `data.thumbnails` : photos
     - `data.meta.mec_cost` : coût
   - `GET /events` : liste avec **pagination propre** (`pagination.next_date`/`next_offset`) et filtres (`start=today`, `show_only_past_events`…) — mieux que le `per_page=100` de l'API publique.
   - `GET /events/{id}/next-occurrences`, `/related-events` : compléments.
   - `GET /config/attendee-fields` : **structure du formulaire d'inscription du site** (testé) — champs récoltés : email, nom, date de naissance, adresse, code postal, tél, genre (F/M/X/Divers), statut social (Travailleur.se, Intérim, Actiris, Mutuelle, CPAS, Pensionné, Étudiant, Enfant), paiement, SMS de rappel. **≈ le schéma de la table `members`** → une réservation d'un nouveau venu fournit une fiche membre quasi complète. ⚠️ Le champ **n° de membre** n'existe PAS encore côté formulaire MEC — l'ajouter renforcerait le matching (voir §6).
   - **Hiérarchie d'authentification** (doc officielle webnus.net) : clé `mec-token` seule = lecture (« public commands ») ; clé + `user-token` (via `POST /login` avec compte WP) = **écriture** (créer/modifier/supprimer events, taxonomies). Le serveur peut donc, si besoin un jour, créer des formations depuis l'app.
   - ❌ **Les réservations/inscrits ne sont PAS exposées** (aucun endpoint dans la doc officielle, `/bookers` = 404 testé) : la liste des inscrits devra passer par un snippet WordPress avec secret (voir point 4) ou un accès SQL direct à `wp_mec_bookings`.
   - ⚠️ Piège CORS : header custom → preflight bloqué depuis un navigateur. API **server-to-server** uniquement.

   **Conséquence roadmap** : le plugin WordPress « atelierduweb-mec-api » se réduit au **module bookings seul** (lecture `wp_mec_bookings`, route protégée par secret) — les modules organisateur/lieu/places restantes sont couverts par l'API officielle. Le préfill de modale (module 4) est un JS `wp_footer` indépendant.
3. **À ajouter par le backend** (hors périmètre maquette) : authentification des postes (au minimum un token d'accès app + éventuellement login par utilisateur de l'équipe), HTTPS si exposition hors réseau local.
4. Le fichier `membres.db` contient des données personnelles (RGPD) : accès disque restreint, sauvegardes chiffrées si externes.

## 8. Le préfill de la modale de réservation (module 4) — PRIORITÉ UTILISATEUR

**Objectif** : quand l'app envoie un membre réserver sur le site, la modale MEC est **déjà remplie** avec ses infos (nom, email, tél, n° de membre). Le n° de membre pré-rempli EST le tracking : la réservation revient avec, le matching auto fait le reste.

**Côté app, c'est déjà prêt** (`booking.js`) : l'URL ouverte est
`{formation.url}?method=mec-booking-modal&adw_name=…&adw_email=…&adw_phone=…&adw_member_no=…`

**Côté WordPress — plugin « ADW MEC API » (décision oct. 2026)** : le préfill est intégré au plugin WordPress dédié (développé en parallèle de la maquette), qui **remplace le snippet Code Snippets initialement prévu** (Code Snippets étant en échec 403 sur l'hébergeur). Le plugin injecte le JS de préfill via `wp_footer` — même logique que le snippet de référence ci-dessous, qui reste la spécification du comportement attendu :

```js
// ADW — Préfill modale M.E. Calendar depuis l'app de gestion
// Reçoit ?adw_name=…&adw_email=…&adw_phone=…&adw_member_no=… et remplit la modale AJAX MEC.
(function () {
    var params = new URLSearchParams(location.search);
    if (!params.get('adw_email') && !params.get('adw_name')) return;

    // ⚙️ SÉLECTEURS — à ajuster avec le HTML réel de la modale MEC ouverte
    // (ouvrir une résa sur le site, F12, repérer les input par name/id)
    var FIELDS = {
        name:      'input[name="name"]',            // champ nom/prénom
        email:     'input[name="email"]',           // champ email
        phone:     'input[name="tel"], input[name="phone"]',
        member_no: 'input[name="adw_member_no"], input[name="mec_fix_custom_field_1"]' // champ n° membre (voir note)
    };
    var ADW = {
        name: params.get('adw_name'),
        email: params.get('adw_email'),
        phone: params.get('adw_phone'),
        member_no: params.get('adw_member_no')
    };

    function fill() {
        var modal = document.querySelector('.mec-booking-modal, .lity-content'); // conteneur modale MEC
        if (!modal) return false;
        Object.keys(FIELDS).forEach(function (k) {
            if (!ADW[k]) return;
            var sel = FIELDS[k].split(',').map(function (s) { return s.trim(); });
            for (var i = 0; i < sel.length; i++) {
                var input = modal.querySelector(sel[i]);
                if (input) { input.value = ADW[k]; input.dispatchEvent(new Event('input', { bubbles: true })); break; }
            }
        });
        return true;
    }

    // La modale MEC charge en AJAX : réessayer jusqu'à ce qu'elle apparaisse
    var tries = 0;
    var timer = setInterval(function () {
        if (fill() || ++tries > 40) clearInterval(timer); // ~8s max
    }, 200);
})();
```

**Étapes pour le poser** :
1. Sur le site, ouvrir une réservation de formation, **F12 sur la modale ouverte**, noter les vrais `name`/`id` des champs (nom, email, tél) → ajuster `FIELDS`.
2. Ajouter le champ **« n° de membre »** dans M.E. Calendar > Settings > Booking > attendee/fixed fields (c'est le maillon fort du matching) — noter son `name` réel (ex. `mec_fix_custom_field_1`) dans `FIELDS.member_no`.
3. ~~Coller le snippet via Code Snippets~~ → **intégré au plugin ADW MEC API** ; côté WordPress, activer : Réglages → ADW MEC API → cocher « Activer l'endpoint inscriptions » + définir le secret (pour l'étape 3 du plan : le retour des réservations vers l'app).
   - **Architecture des flux (décision oct. 2026 — le secret ne voyage JAMAIS jusqu'au navigateur)** :
     - **Appelé depuis le navigateur (GitHub Pages), sans secret** : le préfill `adw_*` (modale MEC, par URL) et la lecture publique des formations (API wp/v2 publique). Tout fonctionne déjà, sans CORS spécifique.
     - **Appelé avec le secret, jamais depuis le navigateur** : l'endpoint inscriptions. Test = **intégré wp-admin** (onglet Tests des réglages du plugin) ou curl/Node local côté serveur. Le futur serveur Node l'appellera en server-to-server (pas de contrainte CORS).
4. Test : depuis l'app, bouton « Réserver sur le site » sur un membre → la modale doit arriver remplie.

⚠️ **Pré-requis découvert le 22 oct.** : le champ n° de membre n'existe pas encore dans le formulaire MEC (`/config/attendee-fields` testé — email/nom/date naissance/adresse/CP/tél/genre/statut présents, pas de n° membre). **Il faut l'ajouter côté MEC d'abord.** Le reste des champs du formulaire (adresse, statut…) est déjà récolté → une réservation de nouveau venu ≈ une fiche membre quasi complète.

## 9. Pièges connus (leçons de la maquette)

- `toISOString()` décale les dates d'un jour en UTC+1 → **toujours** un formateur local (voir `isoLocal()` dans dashboard.js).
- Cache navigateur : les assets sont versionnés `?v=N` ; la CI vérifie la cohérence des versions entre pages (ne pas casser).
- Le double pointage de visite est refusé par la maquette — garder cette règle côté serveur (contrainte d'unicité).
- Les catégories MEC arrivent en **IDs numériques** de l'API : la résolution en noms (`mec_category`) doit réussir, sinon filtrer les numéros (bug historique corrigé — voir `resolveCategories`).

## 10. Ordre de travail suggéré

1. Serveur minimal : `express.static` + `GET /api/sante` → l'app s'affiche (en mode maquette encore).
2. `schema.sql` repris de `ensureSchema()` + endpoints lecture (`listMembres`, `listFormations`…).
3. `db.js` client HTTP (mêmes signatures) → bascule progressive page par page.
4. Endpoints écriture (membres, visites, inscriptions) + auth.
5. Sync formations en cron serveur + matching bookings server-to-server.
6. Décommissionner sql.js/IndexedDB.

---

*Questions sur le code existant ? Tout part de `db.js` (données), `layout.js` (structure commune) et `mec.js` (client du site). La maquette reste fonctionnelle et sert de référence visuelle : https://d0cm4c.github.io/Gestion-Membres-Inscriptions-de-l-Atelier-du-web/*
