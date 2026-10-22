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
3. **API officielle MEC (`wp-json/mec/v1.0`, header `mec-token`) — testée le 22 oct. 2026, fonctionne avec clé.** Réserves au serveur (clé en config serveur, JAMAIS dans le JS) :
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

## 8. Le préfill du formulaire de réservation (module 4) — PRIORITÉ UTILISATEUR

**Objectif** : quand l'app envoie un membre réserver sur le site, le formulaire MEC est **déjà rempli** avec ses infos (nom, email, tél, n° de membre). Le n° de membre pré-rempli EST le tracking : la réservation revient avec, le matching auto fait le reste.

**Côté app, c'est déjà prêt** (`booking.js`) : l'URL ouverte est
`{formation.url}?method=mec-booking-modal&adw_name=…&adw_email=…&adw_phone=…&adw_member_no=…`

### Constaté sur le HTML réel de la page de résa (analysé le 22 oct. 2026)

- `?method=mec-booking-modal` **n'ouvre pas une popup** : le formulaire est rendu **dans la page** (`#mec_booking{ID}`), en 4 étapes (Ticket → Participants → Paiement → Confirmation).
- **L'étape 1 ne contient que la quantité de billets**. Les champs participant (nom, email…) apparaissent à **l'étape 2, injectés en AJAX** — le HTML de l'étape 1 n'a PAS les inputs. Un préfill au seul chargement de la page ne peut donc pas fonctionner : il faut **observer le DOM** au fil des étapes.
- Noms réels des inputs (étape 2, `7` = id du billet) : `book[tickets][7][name]`, `book[tickets][7][email]` ; champs perso (reg fields) : `book[tickets][7][reg][ID]`.
- Le site a déjà le plugin **Code Snippets** actif → installation facile.

### Snippet prêt (Code Snippets > Add New > « footer only », ou thème enfant)

```js
// ADW — Préfill formulaire M.E. Calendar depuis l'app de gestion
// Lit ?adw_name=…&adw_email=…&adw_phone=…&adw_member_no=… et remplit
// les champs participant dès qu'ils apparaissent (étapes AJAX du booking MEC).
(function () {
    var params = new URLSearchParams(location.search);
    if (!params.get('adw_email') && !params.get('adw_name')) return;

    var ADW = {
        name: params.get('adw_name'),
        email: params.get('adw_email'),
        phone: params.get('adw_phone'),
        member_no: params.get('adw_member_no')
    };

    function tryFill() {
        // Conteneur du booking MEC (dans la page avec ?method=mec-booking-modal)
        var wrap = document.querySelector('[id^="mec_booking"]');
        if (!wrap) return false;

        var filled = 0;
        // Champs par participant : book[tickets][{ticketId}][name] / [email]
        wrap.querySelectorAll('input[name^="book[tickets]"]').forEach(function (input) {
            var n = input.getAttribute('name');
            if (/\[name\]$/.test(n) && ADW.name) { input.value = ADW.name; filled++; }
            else if (/\[email\]$/.test(n) && ADW.email) { input.value = ADW.email; filled++; }
            else if (/\[tel\]$/.test(n) && ADW.phone) { input.value = ADW.phone; filled++; }
            // Champs reg (perso) : identifier par label ou par name reg[ID] —
            // pour le n° de membre, voir la note ci-dessous
        });
        // Champs fixes éventuels : book[fields][ID]
        wrap.querySelectorAll('input[name^="book[fields]"]').forEach(function (input) {
            var li = input.closest('li');
            var label = li ? (li.textContent || '') : '';
            if (/t[ée]l[ée]phone/i.test(label) && ADW.phone) { input.value = ADW.phone; filled++; }
            if (/n[°o]\s*(de\s*)?membre/i.test(label) && ADW.member_no) { input.value = ADW.member_no; filled++; }
        });
        return filled > 0;
    }

    // Les étapes du booking sont injectées en AJAX : observer le DOM
    var done = { name: false };
    var obs = new MutationObserver(function () {
        // Remplir à chaque apparition de nouveaux champs (étape suivante)
        tryFill();
    });
    obs.observe(document.body, { childList: true, subtree: true });

    // Première tentative immédiate (au cas où l'étape 2 serait déjà là)
    tryFill();
})();
```

**Notes d'adaptation** :
- Le remplissage est **idempotent** (relancé à chaque mutation DOM) : il re-remplit après chaque changement d'étape AJAX sans casser la saisie manuelle ultérieure — si l'utilisateur modifie, la valeur saisie manuellement reste tant qu'aucune nouvelle injection DOM n'a lieu. À valider en usage réel ; si besoin, ajouter un marqueur `data-adw-filled` pour ne remplir qu'une fois par champ.
- **Champ n° de membre** : il n'existe pas encore dans le formulaire MEC (`/config/attendee-fields` testé — aucun champ n° membre). L'ajouter dans M.E. Calendar > Settings > Booking (attendee ou fixed field) ; une fois créé, repérer son `name` réel (`book[tickets][7][reg][ID]` ou `book[fields][ID]`) et compléter le mapping (par label comme ci-dessus, ou par ID explicite).
- Les champs date/select du formulaire (date de naissance, genre, statut) peuvent être pré-remplis sur le même modèle si l'app envoie les paramètres correspondants (extension possible de `booking.js`).

**Étapes de pose** :
1. Ajouter le champ « n° de membre » dans M.E. Calendar > Settings > Booking.
2. Coller le snippet via **Code Snippets** (déjà installé sur le site) : Add New, scope « footer only », activer.
3. Test : depuis l'app, « Réserver sur le site » sur un membre → étape Participants du site doit arriver remplie (nom, email, tél, n° membre).

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
