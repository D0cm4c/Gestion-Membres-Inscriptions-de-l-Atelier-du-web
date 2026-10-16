# Gestion des Membres et Inscriptions — Atelier du Web

Un système unifié pour gérer les membres du cyberespace et les participants aux formations de l'[Atelier du Web](https://atelierduweb.be).

## 📌 À propos

Ce projet permet de :
- Gérer les **membres** du cyberespace (fiches complètes, abonnements, suivi des visites).
- Gérer les **inscriptions aux formations** proposées par l'Atelier du Web *(en construction)*.
- Centraliser les informations dans des **fiches membres/participants**.

## 🚀 Démarrage rapide

### Prérequis
- Un navigateur web moderne (Chrome, Firefox, Edge, etc.).

### Installation
1. Clonez ce dépôt :
   ```bash
   git clone https://github.com/D0cm4c/Gestion-Membres-Inscriptions-de-l-Atelier-du-web.git
   ```
2. Ouvrez le fichier `index.html` dans votre navigateur.

La maquette est aussi en ligne : **[d0cm4c.github.io/Gestion-Membres-Inscriptions-de-l-Atelier-du-web](https://d0cm4c.github.io/Gestion-Membres-Inscriptions-de-l-Atelier-du-web/)**

## ✨ Fonctionnalités

### Tableau de bord (`index.html`)
- Indicateurs en temps réel : membres, inscriptions actives, visites du jour, revenus du mois.
- Alertes automatiques (inscriptions expirées, expirations proches, visites du jour).
- Dernières visites pointées.

### Gestion des membres (`membres.html`)
- **Fiches membres** : nom, prénom, âge, adresse, téléphone, email, dates d'inscription.
- **Numéro de membre unique** à 4 chiffres, généré automatiquement à la création (#1000, #1001…).
- **Abonnements** : mensuel (3 €), annuel (30 €) ou aucun.
- **Suivi des visites** : pointage de la visite du jour (1 € sans abonnement, incluse avec abonnement), historique complet sur la fiche du membre.
- **Recherche** par nom, prénom ou numéro de membre.
- **Tri** (11 critères) et **filtres** (tous / actifs / expirés / abonnés).
- **Affichage** en vue cartes ou liste compacte, préférences mémorisées.
- **Export CSV** des membres affichés (respecte filtres et recherche).

## 🛠️ Technologies utilisées

- **Frontend** : HTML5, CSS3, JavaScript (sans framework)
- **Base de données** : SQLite via [sql.js](https://sql.js.org) (WebAssembly) — fonctionne 100 % côté navigateur, persistée dans IndexedDB
- **Polices** : [Public Sans (Google Fonts)](https://fonts.google.com/specimen/Public+Sans)
- **Accessibilité** : contrastes AA, navigation clavier, lecteurs d'écran, mode sombre automatique

> ⚠️ GitHub Pages ne permet pas de backend : la base SQLite tourne entièrement dans le navigateur du visiteur. Le schéma SQL est standard et prêt pour une migration vers un vrai backend.

## 📂 Structure du projet

```
Gestion-Membres-Inscriptions-de-l-Atelier-du-web/
├── index.html              # Tableau de bord (stats temps réel)
├── membres.html             # Gestion des membres
├── dashboard.js             # Statistiques du tableau de bord
├── app.js                   # Logique membres (CRUD, tri, filtres, visites)
├── db.js                    # Couche BDD SQLite + persistance IndexedDB
├── styles.css               # Styles (design accessible, mode sombre)
├── vendor/                  # sql.js (SQLite WebAssembly)
└── assets/                  # Images (logo, etc.)
```

## 🗺️ Feuille de route

- [x] Tableau de bord avec statistiques
- [x] Fiches membres + CRUD complet
- [x] Abonnements et suivi des visites
- [ ] Fiches formations (tarifs, dates, participants)
- [ ] Calendrier des 2 salles de formation

## 📞 Contact

Pour toute question ou suggestion, contactez l'[Atelier du Web](https://atelierduweb.be).
