# MÉTHODE.md — Méthodes qui ont marché (débrief, projet Gestion des Membres)

Check-list de gestion de projet avec assistance IA, tirée du débrief du projet *Gestion des Membres et Inscriptions — Atelier du Web* (8 PRs, 30+ commits, app en ligne).

## 1. Mémoire persistante entre les sessions

- **Problème** : les sessions d'assistance n'ont pas accès aux conversations passées.
- **Solution** : `AGENTS.md` (instructions lues automatiquement par les agents) qui impose de lire et tenir à jour `CONTEXT.md` (mémoire : objectifs, décisions figées, état, leçons, historique des PRs).
- **Résultat** : plus rien à répéter au démarrage d'une session ; le contexte s'accumule dans le dépôt.

## 2. Livraison incrémentale

- Une fonctionnalité complète par PR, fusionnée dans l'ordre logique.
- Périmètre étroit = merges rapides, peu de conflits, retour utilisateur précoce.
- Bugs bloquants traités dans une PR dédiée **avant** les améliorations.

## 3. Tester en sandbox avant de livrer

- Suites de tests fonctionnels (jsdom + vraie BDD) avant chaque fusion : 35/35, 48/48, 15/15 assertions.
- Ont révélé des bugs d'UX invisibles en relecture de code (ex. modal ne se fermant pas : `display:flex` écrasait `hidden`).
- Vérifications légères mais systématiques par PR (syntaxe, structure HTML).

## 4. Données réelles tôt

- Import des 3 806 membres réels dès que possible → a révélé un bug de performance et un bug de migration invisibles en tests unitaires.
- Le dashboard a été branché sur la vraie BDD dès le départ, pas sur des données fictives.

## 5. Contraintes assumées tôt

- Décisions d'architecture prises une fois, documentées dans `CONTEXT.md`, jamais remises en cause en cours de route (ex. 100 % statique sur GitHub Pages, SQLite sql.js/IndexedDB, schéma SQL standard prêt pour migration).

## 6. Vigilances identifiées

- **Cache navigateur** (GitHub Pages) : cache-busting systématique des assets.
- **CORS** pour les API tierces : prévoir un repli (proxy) dès la conception.
- **Secrets** : jamais dans le dépôt ; les clés utilisateur restent dans le navigateur.
- Suites de tests non versionnées : effort manuel à chaque PR — à automatiser si possible.

## Rappel livraison

- L'agent commite/pousse lui-même sur `vibe/…` + PR ; fusion `main` par le propriétaire (CLI bloquée).
- Commits en français, préfixes descriptifs (`feat:`, `fix:`, `perf:`, `design:`) → historique lisible, diagnostic facile.
