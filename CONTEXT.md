# CONTEXT.md — Mémoire du projet (à lire en priorité)

> Ce fichier sert de **mémoire entre les sessions** d'assistance (IA/agents).
> Toute session qui travaille sur ce dépôt **doit lire ce fichier en premier** et le **mettre à jour** en fin de travail (décisions, état, leçons).

## 🎯 Projet

Système de gestion des membres du cyberespace (25 ordis, accès sur inscription) et des inscrits aux formations de l'**Atelier du Web** ([atelierduweb.be](https://atelierduweb.be)).
Outil en 3 parties principales : **fiches formations**, **fiches membres**, **calendrier/fiches des 2 salles de formation**.
Contrainte de design : correspondre au design du site atelierduweb.be.

## 🏗️ Architecture (décisions figées)

- **100 % statique**, hébergé sur GitHub Pages : [d0cm4c.github.io/Gestion-Membres-Inscriptions-de-l-Atelier-du-web](https://d0cm4c.github.io/Gestion-Membres-Inscriptions-de-l-Atelier-du-web/)
- **Pas de backend possible** : toute la logique tourne côté navigateur.
- **BDD : SQLite via sql.js (WebAssembly, v1.15.0 dans `vendor/`)**, persistée dans IndexedDB (`db.js`). Schéma SQL standard → migration possible vers un vrai backend sans réécriture.
- Migration automatique des anciennes données localStorage → SQLite.
- Frontend **sans framework** : HTML5, CSS3, JS vanilla. Police : Public Sans.
- Accessibilité : contrastes AA, mode sombre auto, `aria-*`, focus visible, skip-link, `prefers-reduced-motion`.

## 📐 Conventions

- Langue : **français** partout (code, commits, PRs, UI).
- Commits : préfixes `feat:`, `fix:`, `perf:`, `design:`, `layout:` + description concise.
- Livraison : **PRs petites et ciblées** (une fonctionnalité = une PR), fusionnées dans `main` via GitHub.
- Vérifications minimales par PR : `node --check` sur les JS modifiés + validation de la structure HTML.
- **Tests fonctionnels en sandbox** (jsdom + sql.js réel) avant chaque PR quand la logique est testable — c'est la méthode qui a trouvé le plus de bugs (35/35, 48/48, 15/15 assertions).
- ⚠️ **Cache navigateur sur Pages** : incrémenter le cache-busting des assets (actuellement v5+) à chaque changement de JS/CSS, sinon les visiteurs voient l'ancienne version.

## 📦 État actuel (nov. 2026)

Fait :
- Dashboard (`index.html`) : KPI temps réel, alertes, visites récentes, analyses croisées, usagers du jour, rapport annuel exportable, heatmap/donut, mosaïque drag'n'drop, thème sombre.
- Membres (`membres.html`) : CRUD complet, n° de membre auto (4 chiffres, #1000…), abonnements (mensuel 3 € / annuel 30 €), pointage de visite (1 € ou incluse si abo, double pointage refusé), suivi des impressions (solde, impression rapide), recherche/tri (11 critères)/filtres, vues cartes/liste, export CSV, code postal avec autocomplétion, genre, statut social.
- Import XML Access : **3 806 membres réels** importés avec mappings ; `db.js` tient la charge.
- Page Paramètres (`parametres.html`) + thème partagé sur toutes les pages.
- 20 membres fictifs de démonstration.

En cours / ouvert :
- **PR #7 (draft, branche `vibe/formations-mec`)** : page `formations.html` + `mec.js` — intégration des formations via l'API REST M.E. Calendar (`wp-json/mec/v1.0`, header `mec-token`, clé stockée uniquement dans le navigateur).
  - ⚠️ Non vérifiée en sandbox (header auth impossible hors navigateur). **À tester : CORS depuis d0cm4c.github.io** — si blocage, prévoir un proxy ou servir depuis atelierduweb.be.
- Feuille de route restante : fiches formations (tarifs, dates, participants) et calendrier des 2 salles.

## 🧠 Leçons apprises (méthodes qui ont marché)

1. PRs incrémentales, une fonctionnalité complète par PR, fusionnées dans l'ordre.
2. Tests fonctionnels jsdom avant chaque fusion : ils révèlent des bugs d'UX invisibles en relecture (ex. modal ne se fermant pas — `display:flex` écrasait `hidden` → fix `[hidden]{display:none!important}`).
3. Brancher les features sur les **vraies données** dès que possible (dashboard sur la vraie BDD ; import des 3 806 membres réels a révélé un bug de perf et un bug de migration `member_no`).
4. Traiter les bugs bloquants dans une PR dédiée **avant** les améliorations.
5. Données réelles tôt = bugs d'échelle trouvés que les tests unitaires ne trouvent pas.

## 📜 Historique des PRs

1. Page Membres CRUD + cartes (localStorage) — fusionnée
2. SQLite sql.js + IndexedDB + tri — fusionnée
3. Fix fermeture formulaire + filtres/tris/vues — fusionnée
4. UX : validation, préférences, toasts, export CSV — fusionnée (tests 35/35)
5. Abonnements, visites, n° auto, refonte design accessible — fusionnée (tests 48/48)
6. dashboard temps réel + README — fusionnée (tests 15/15)
7. Formations M.E. Calendar via API REST — **draft ouvert** (`vibe/formations-mec`)

## 📌 Règle pour toute future session

1. Lire ce fichier et le README.
2. Vérifier `git log`, les PRs ouvertes et `git status` avant de toucher au code.
3. À la fin de la session : **mettre à jour ce fichier** (état, décisions, leçons) dans la même PR que le travail livré.
