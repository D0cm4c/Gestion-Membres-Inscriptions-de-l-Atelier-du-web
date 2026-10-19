# CONTEXT.md — Mémoire du projet (à lire en priorité, à maintenir)

> Ce fichier est la **mémoire entre les sessions** d'assistance (IA/agents). Toute session doit le lire en premier et le mettre à jour en fin de travail.

## 🎯 Objectif du projet

<!-- Une application … qui permet de … pour … -->

## 🏗️ Architecture et décisions figées

<!-- Ex : 100 % statique / backend, framework, BDD, hébergement, design à respecter.
Lister ici toute décision qu'une session ne doit pas remettre en cause sans accord du propriétaire. -->

## 📐 Conventions

- Langue des commits/PRs/UI :
- Préfixes de commits : `feat:`, `fix:`, `perf:`, `design:`, `docs:`
- Livraison : PRs petites et ciblées, fusion dans `main` par le propriétaire
- Tests avant chaque PR (si testable) :
- Points de vigilance récurrents (cache, CORS, secrets…) :

## 📦 État actuel (date)

Fait :
- …

En cours / ouvert :
- …

## 🧠 Leçons apprises (méthodes qui ont marché)

1. PRs incrémentales : une fonctionnalité complète par PR.
2. Tests fonctionnels avant chaque fusion — révèlent des bugs invisibles en relecture de code.
3. Brancher les features sur les vraies données dès que possible.
4. Traiter les bugs bloquants dans une PR dédiée avant les améliorations.
5. Données réelles tôt = bugs d'échelle trouvés que les tests unitaires ne trouvent pas.

## 📜 Historique des livraisons

<!-- N° PR / branche — titre — état -->

## 📌 Règle pour toute future session

1. Lire ce fichier et le README.
2. Vérifier `git log`, les PRs ouvertes et `git status` avant de toucher au code.
3. À la fin de la session : **mettre à jour ce fichier** dans la même PR que le travail livré.

## 🔧 Autonomie de livraison

- Les sessions **commitent et poussent elles-mêmes** sur des branches de travail (`vibe/…`) et ouvrent des PRs.
- La **fusion dans `main` reste manuelle** (propriétaire, depuis GitHub).
