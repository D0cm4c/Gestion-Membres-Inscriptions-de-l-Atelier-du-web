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
   - `GET /events` : formations + **contenu complet** (mieux que l'excerpt de l'API publique).
   - `GET /events/{id}/tickets` : 🎯 **tarifs** (« Stage de vacance : 30 € ») — complète les fiches (champ tarif aujourd'hui « à confirmer »).
   - `GET /events/{id}/next-occurrences` : **dates + horaires structurés** (`start.date`, `hour`, `minutes`) — remplace le parseur d'extraits FR (`parseFrDates` de mec.js) par des données propres.
   - `GET /events/{id}/related-events` : formations liées.
   - ❌ **`/bookers` n'existe pas** (404) : les réservations ne sont PAS exposées par l'API officielle, même avec clé. La synchro des inscriptions devra passer par le plugin WordPress prévu (module bookings avec secret) ou une lecture directe de la table `wp_mec_bookings`.
   - ⚠️ Ne pas oublier le piège CORS : l'API officielle exige un header custom → preflight bloqué depuis un navigateur. C'est une API **server-to-server**.
3. **À ajouter par le backend** (hors périmètre maquette) : authentification des postes (au minimum un token d'accès app + éventuellement login par utilisateur de l'équipe), HTTPS si exposition hors réseau local.
4. Le fichier `membres.db` contient des données personnelles (RGPD) : accès disque restreint, sauvegardes chiffrées si externes.

## 8. Pièges connus (leçons de la maquette)

- `toISOString()` décale les dates d'un jour en UTC+1 → **toujours** un formateur local (voir `isoLocal()` dans dashboard.js).
- Cache navigateur : les assets sont versionnés `?v=N` ; la CI vérifie la cohérence des versions entre pages (ne pas casser).
- Le double pointage de visite est refusé par la maquette — garder cette règle côté serveur (contrainte d'unicité).
- Les catégories MEC arrivent en **IDs numériques** de l'API : la résolution en noms (`mec_category`) doit réussir, sinon filtrer les numéros (bug historique corrigé — voir `resolveCategories`).

## 9. Ordre de travail suggéré

1. Serveur minimal : `express.static` + `GET /api/sante` → l'app s'affiche (en mode maquette encore).
2. `schema.sql` repris de `ensureSchema()` + endpoints lecture (`listMembres`, `listFormations`…).
3. `db.js` client HTTP (mêmes signatures) → bascule progressive page par page.
4. Endpoints écriture (membres, visites, inscriptions) + auth.
5. Sync formations en cron serveur + matching bookings server-to-server.
6. Décommissionner sql.js/IndexedDB.

---

*Questions sur le code existant ? Tout part de `db.js` (données), `layout.js` (structure commune) et `mec.js` (client du site). La maquette reste fonctionnelle et sert de référence visuelle : https://d0cm4c.github.io/Gestion-Membres-Inscriptions-de-l-Atelier-du-web/*
