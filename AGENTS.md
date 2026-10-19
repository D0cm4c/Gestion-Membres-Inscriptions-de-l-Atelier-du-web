# AGENTS.md — Instructions pour toute session d'assistance (IA/agent) sur ce dépôt

> ⚠️ **Première action obligatoire de toute session : lire [`CONTEXT.md`](CONTEXT.md).**
> C'est la mémoire du projet entre les sessions (décisions, état, leçons). Ne jamais le réécrire de zéro : le **mettre à jour** à la fin de chaque session dans la même PR que le travail livré.

## Rappel du workflow (détails complets dans CONTEXT.md)

1. **Lire `CONTEXT.md`** puis `README.md` avant toute modification.
2. Vérifier `git status`, `git log` récents et les PRs ouvertes (`gh pr list`).
3. Respecter les décisions figées : app 100 % statique (GitHub Pages, pas de backend), SQLite via sql.js/IndexedDB, JS vanilla sans framework, UI en français.
4. Conventions : commits en français avec préfixes (`feat:`, `fix:`, `perf:`, `design:`), PRs petites et ciblées, tests fonctionnels jsdom quand la logique est testable, incrémenter le cache-busting des assets à chaque changement JS/CSS.
5. En fin de session : mettre à jour `CONTEXT.md` (état, décisions, leçons) dans la PR livrée.
