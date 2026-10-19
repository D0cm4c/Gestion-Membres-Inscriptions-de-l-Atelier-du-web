# Gestion des Membres et Inscriptions — Atelier du Web

Un système unifié en ligne pour gérer les membres du cyberespace et les participants aux formations de l'[Atelier du Web](https://atelierduweb.be), avec une base de données **SQLite**.

## 🎯 Objectif du projet

Une **application en ligne** (accessible par plusieurs postes via le navigateur, sans installation) qui réunit dans un outil unique :

- Les **fiches membres** du cyberespace (25 postes, accès sur inscription).
- Les **fiches formations** (tarifs, dates, participants).
- Le **calendrier et les fiches des 2 salles de formation**.

Le design correspond à l'identité visuelle d'atelierduweb.be.

## 📌 État actuel

L'application est **en ligne** : **[d0cm4c.github.io/Gestion-Membres-Inscriptions-de-l-Atelier-du-web](https://d0cm4c.github.io/Gestion-Membres-Inscriptions-de-l-Atelier-du-web/)**

- **Base de données SQLite** (via [sql.js](https://sql.js.org)/WebAssembly), persistée dans le navigateur (IndexedDB). Le schéma SQL est standard : l'objectif d'évolution est de la brancher sur un hébergement avec BDD SQLite partagée entre postes.
- Les données de l'instance hébergée sur GitHub Pages restent locales au navigateur ; l'import/export permet la réplication manuelle dans l'attente d'un vrai hébergement BDD.

### Tableau de bord (`index.html`)
- Indicateurs en temps réel : membres, inscriptions actives, visites du jour, revenus du mois.
- Alertes automatiques (inscriptions expirées, expirations proches, visites du jour, impressions à solder).
- Analyses croisées, nouveaux usagers du jour, rapport annuel exportable, thème sombre.

### Gestion des membres (`membres.html`)
- **Fiches membres** : nom, prénom, âge, genre, adresse, code postal (autocomplétion), téléphone, email, statut social, dates d'inscription.
- **Numéro de membre unique** à 4 chiffres, généré automatiquement (#1000, #1001…).
- **Abonnements** : mensuel (3 €), annuel (30 €) ou aucun.
- **Suivi des visites** : pointage du jour (1 € sans abonnement, incluse avec abonnement), historique complet, refus du double pointage.
- **Suivi des impressions** (solde à solder, impression rapide).
- Recherche, tri (11 critères), filtres (statut, abonnés), vues cartes/liste, export CSV, import XML (Access).
- Données réelles : import de 3 806 membres depuis l'ancienne base Access.

### Formations (`formations.html`) *(en cours, PR #7)*
- Intégration des formations du site via l'API REST M.E. Calendar (`wp-json/mec/v1.0`), clé API stockée uniquement dans le navigateur.
- Recherche, filtres (à venir/toutes, mois, catégorie), cartes au design du projet, lien direct vers la réservation sur atelierduweb.be.
- Repli automatique via proxy si l'API bloque les appels directs (CORS).

### Paramètres (`parametres.html`)
- Configuration de l'application, gestion du thème partagé sur toutes les pages.

## 🛠️ Technologies

- **Frontend** : HTML5, CSS3, JavaScript (sans framework)
- **Base de données** : SQLite via [sql.js](https://sql.js.org) (WebAssembly), persistée dans IndexedDB — prêt pour une migration vers un hébergement avec BDD SQLite partagée
- **Polices** : [Public Sans (Google Fonts)](https://fonts.google.com/specimen/Public+Sans)
- **Accessibilité** : contrastes AA, navigation clavier, lecteurs d'écran, mode sombre automatique

## 🤖 Assistance IA (sessions d'agents)

- Les sessions d'assistance (agents IA) peuvent **commiter et pousser elles-mêmes** sur des branches de travail (`vibe/…`) et ouvrir des PRs ; la fusion dans `main` reste manuelle depuis GitHub.
- **Mémoire du projet** : [`CONTEXT.md`](CONTEXT.md) (état, décisions, leçons) — lu et mis à jour automatiquement par chaque session, voir [`AGENTS.md`](AGENTS.md).

## 📂 Structure du projet

```
Gestion-Membres-Inscriptions-de-l-Atelier-du-web/
├── index.html              # Tableau de bord (stats temps réel)
├── membres.html             # Gestion des membres
├── formations.html          # Formations (API M.E. Calendar)
├── parametres.html          # Paramètres de l'application
├── dashboard.js             # Statistiques du tableau de bord
├── app.js                   # Logique membres (CRUD, tri, filtres, visites)
├── db.js                    # Couche BDD SQLite + persistance IndexedDB
├── mec.js                   # Client API M.E. Calendar
├── import.js                # Import XML (base Access)
├── postal-codes.js          # Autocomplétion codes postaux (Belgique)
├── settings.js / theme.js   # Paramètres et thème
├── demo-data.js             # Membres fictifs de démonstration
├── styles.css               # Styles (design accessible, mode sombre)
├── vendor/                  # sql.js (SQLite WebAssembly)
└── assets/                  # Images (logo, etc.)
```

## 🗺️ Feuille de route

- [x] Tableau de bord avec statistiques
- [x] Fiches membres + CRUD complet
- [x] Abonnements et suivi des visites
- [x] Suivi des impressions
- [ ] Formations : finaliser l'intégration M.E. Calendar (PR #7)
- [ ] Fiches formations (tarifs, dates, participants)
- [ ] Calendrier des 2 salles de formation
- [ ] BDD SQLite partagée en ligne (hébergement avec backend léger)

## 📬 Contact

Pour toute question ou suggestion, contactez l'[Atelier du Web](https://atelierduweb.be).
