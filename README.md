# Gestion des Membres et Inscriptions — Atelier du Web

Application de gestion pour l'[Atelier du Web](https://atelierduweb.be) (EPN de Saint-Gilles) : **membres du cyberespace** (25 postes), **formations** et **salles** — dans un seul outil, avec le design du site.

**App en ligne (maquette) : [d0cm4c.github.io/Gestion-Membres-Inscriptions-de-l-Atelier-du-web](https://d0cm4c.github.io/Gestion-Membres-Inscriptions-de-l-Atelier-du-web/)**

---

## ⚠️ Maquette, pas production — lisez ceci

> **Ce dépôt est une MAQUETTE 100 % statique** (GitHub Pages). La base de données vit **dans le navigateur** de chaque poste (SQLite via sql.js/WebAssembly, persistée en IndexedDB) : chaque poste a sa propre copie, répliquée manuellement via import/export.
>
> **La cible finale** est une app multi-poste : un serveur Node.js avec une **base SQLite unique partagée** (voir [`docs/BACKEND.md`](docs/BACKEND.md)). Le schéma SQL et les requêtes de cette maquette sont **écrits pour migrer tels quels** — c'est la contrainte de conception n°1 du projet.
>
> Conséquences :
> - Les données saisies ici **ne sont pas définitives** (mais le schéma, lui, est bon).
> - Aucune donnée ne circule sur le réseau (tout reste dans le navigateur).

## 🎯 Périmètre fonctionnel

| Partie | Page | Contenu |
|---|---|---|
| **Tableau de bord** | `index.html` | KPI temps réel, agenda du jour, alertes, analyses, usagers du jour, rapport annuel |
| **Membres** | `membres.html` + `membre.html` | Fiches complètes (identité, contact, statut social), n° auto (#1000…), abonnements, pointage de visites, impressions, recherche/tri/filtres, export CSV, import XML Access |
| **Formations** | `formations.html` + `formation.html` | Sync depuis atelierduweb.be (WordPress/M.E. Calendar), cartes par mois, filtres, inscriptions liées aux membres, validation des réservations du site |
| **Salles** | `salles.html` | Planning mensuel (salles × créneaux Matin/A-midi), conflits, attribution des formations |
| **À faire / Suggestions** | `suggestions.html` | Demandes d'amélioration, statuts |
| **Paramètres** | `parametres.html` | Salles (CRUD), cartes du dashboard, RGPD (purge) |

Fonctionnalités transverses : centre de notifications 🔔, recherche globale, thème clair/sombre, accessibilité (AA, clavier, lecteurs d'écran), responsive mobile, RGPD (effacement en cascade).

## 🛠️ Technologies

- **Frontend** : HTML5, CSS3, JavaScript vanilla — **aucun framework, aucun build**
- **Données** : SQLite via [sql.js](https://sql.js.org) (WebAssembly) → schéma SQL standard, 10 tables (voir `db.js`)
- **Source externe** : API REST publique WordPress (`wp-json/wp/v2/mec-events`) de atelierduweb.be, repli RSS — aucune clé API
- **Qualité** : CI GitHub Actions (syntaxe, smoke test structure, tests de rendu Playwright — voir [`tests/`](tests/))
- **Police** : [Public Sans](https://fonts.google.com/specimen/Public+Sans) · **Hébergement maquette** : GitHub Pages

## 📂 Structure du projet

```
├── index.html, membres.html, membre.html          # pages (1 page = 1 vue)
│   formations.html, formation.html, salles.html,
│   parametres.html, suggestions.html
│
├── layout.js        # ← COMMENCER ICI : génère sidebar + topbar de TOUTES les pages
├── escape.js        # échappement HTML partagé (ADWEscape.html)
├── db.js            # COUCHE DONNÉES : schéma SQLite + API métier (36 méthodes ADWDatabase.*)
├── mec.js           # client API WordPress (formations de atelierduweb.be)
│
├── app.js           # page Membres (CRUD, visites, impressions)
├── dashboard.js     # page Tableau de bord
├── salles.html (js) # page Salles (planning)
├── settings.js      # page Paramètres (salles, tuiles, RGPD)
├── suggestions.js   # bouton volant « suggestion » (toutes pages)
│
├── booking.js       # inscrire un membre via le site (modale de choix)
├── import.js        # import XML (ancienne base Access)
├── demo-data.js     # 20 membres fictifs de démo
├── postal-codes.js  # autocomplétion codes postaux (Belgique)
│
├── theme.js nav.js openstatus.js notifications.js globalsearch.js   # composants partagés
│
├── styles.css       # tout le design (variables CSS, mode sombre, responsive)
├── vendor/          # sql.js v1.15.0 (SQLite WebAssembly)
├── assets/          # images
├── tests/           # smoke test (node) + rendu Playwright (node)
└── .github/         # CI
```

**Ordre de chargement des scripts** (identique sur chaque page, vérifié par la CI) :
`layout.js` (injection du header/sidebar) → `escape.js` → `vendor/sql-wasm.js` → `db.js` → composants partagés → script de page.

## 🚀 Démarrage rapide

La maquette est déjà en ligne (lien en haut). Pour travailler dessus :

```bash
git clone https://github.com/D0cm4c/Gestion-Membres-Inscriptions-de-l-Atelier-du-web.git
cd Gestion-Membres-Inscriptions-de-l-Atelier-du-web
```

Servir localement (obligatoire — sql.js ne charge pas en `file://`) :

```bash
# au choix :
python3 -m http.server 8080        # puis http://localhost:8080
npx serve .                        # ou n'importe quel serveur statique
```

Les données sont vides au premier lancement : utilise l'import XML ou le bouton démo (page Membres).

Tests (optionnel, nécessite Node 20+) :

```bash
npm install && npx playwright install chromium   # une fois
node tests/smoke-pages.js                        # structure des 8 pages
node tests/render/run.js                         # rendu réel (Chromium headless)
```

## 🧭 Pour le backend Node.js — [`docs/BACKEND.md`](docs/BACKEND.md)

Ton collègue lira ce guide en premier. Il décrit :
- l'**architecture cible** (Express + better-sqlite3, l'app servie par le même serveur)
- l'**inventaire complet** des 36 méthodes `ADWDatabase.*` à exposer en endpoints REST
- le **schéma SQL** à reprendre tel quel (10 tables)
- ce qui doit être **réécrit** (persistance IndexedDB → disque) et ce qui est **réutilisable** (requêtes, logique de matching, parseurs)
- les **décisions de sécurité** déjà prises (clé MEC jamais publique, synchro bookings server-to-server)

## 🤖 Assistance IA (sessions d'agents)

Les agents IA peuvent committer et pousser sur des branches `vibe/…` et ouvrir des PRs ; la fusion dans `main` se fait après validation du propriétaire.

- [`AGENTS.md`](AGENTS.md) — règles de travail des sessions (check-list avant PR)
- [`CONTEXT.md`](CONTEXT.md) — **mémoire du projet** : décisions figées, état, leçons, historique. Toute session le lit d'abord et le met à jour.
- [`templates/`](templates/) — kit pour reproduire cette méthode sur d'autres dépôts

## 🗺️ Feuille de route

- [x] Membres : CRUD, visites, impressions, abonnements, import/export
- [x] Formations : sync site, inscriptions, validation des réservations
- [x] Salles : planning, conflits, administration
- [x] Tableau de bord : KPI, agenda du jour, analyses
- [x] Qualité : CI, tests de rendu, échappement unifié, RGPD
- [ ] **Serveur Node.js + SQLite partagé** → [`docs/BACKEND.md`](docs/BACKEND.md)
- [ ] Plugin WordPress (organisateur, lieu, places restantes, bookings sécurisés)

## ✉️ Contact

[Atelier du Web](https://atelierduweb.be) — Espace Public Numérique de Saint-Gilles.
