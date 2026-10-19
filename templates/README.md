# Kit de démarrage « Projet avec agent IA » — Atelier du Web

Méthode éprouvée sur le projet *Gestion des Membres*. Copiez ces deux fichiers **à la racine de tout nouveau dépôt** dès sa création : les agents d'assistance les lisent automatiquement (aucun rappel à faire, aucune mémoire à réécrire).

```
nouveau-projet/
├── AGENTS.md      ← à copier depuis templates/AGENTS-template.md
├── CONTEXT.md     ← à copier depuis templates/CONTEXT-template.md
└── …
```

## Pourquoi ça marche

1. **`AGENTS.md`** est le fichier que les agents IA lisent en premier, automatiquement. Il renvoie vers `CONTEXT.md` et fixe les règles de travail.
2. **`CONTEXT.md`** sert de **mémoire entre les sessions** : les sessions n'ont pas accès aux conversations passées, mais elles lisent le dépôt. Chaque session met le fichier à jour en fin de travail → le contexte s'accumule.
3. Les conventions qui ont fait leurs preuves (PRs ciblées, tests avant fusion, vraies données tôt) y sont inscrites une fois pour toutes.

## Contenu du kit

- [`templates/AGENTS-template.md`](templates/AGENTS-template.md) — instructions pour toute session (à personnaliser : langue, conventions, stack).
- [`templates/CONTEXT-template.md`](templates/CONTEXT-template.md) — mémoire du projet (à remplir au lancement, puis à maintenir par les sessions).
- [`METHODE.md`](METHODE.md) — le débrief des méthodes qui ont fonctionné, à réutiliser comme check-list de gestion de projet.

## Mode d'emploi (nouveau projet)

1. Copier les deux templates à la racine du nouveau dépôt sous les noms `AGENTS.md` et `CONTEXT.md`.
2. Remplir la section « Objectif du projet » et les décisions figées de `CONTEXT.md`.
3. Premier commit + push. C'est tout : chaque session future lira la mémoire et la tiendra à jour toute seule.

## Rappel de livraison (à adapter selon le dépôt)

- L'agent **commite et pousse lui-même** sur des branches de travail (`vibe/…`) et ouvre des PRs.
- La **fusion dans `main` reste manuelle** (propriétaire) — sauf si le dépôt autorise la fusion via CLI.
