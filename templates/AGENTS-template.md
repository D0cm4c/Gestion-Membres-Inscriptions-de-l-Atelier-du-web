# AGENTS.md — Instructions pour toute session d'assistance (IA/agent) sur ce dépôt

> ⚠️ **Première action obligatoire de toute session : lire [`CONTEXT.md`](CONTEXT.md).**
> C'est la mémoire du projet entre les sessions (décisions, état, leçons). Ne jamais le réécrire de zéro : le **mettre à jour** à la fin de chaque session dans la même PR que le travail livré.

## Workflow

1. **Lire `CONTEXT.md`** puis `README.md` avant toute modification.
2. Vérifier `git status`, `git log` récents et les PRs ouvertes (`gh pr list`).
3. Respecter les décisions figées listées dans `CONTEXT.md` (architecture, stack, langues).
4. Suivre les conventions listées dans `CONTEXT.md` (commits, PRs, tests, cache-busting, accessibilité…).
5. En fin de session : **mettre à jour `CONTEXT.md`** (état, décisions, leçons) dans la PR livrée.

## Livraison

- Commiter et pousser soi-même sur une branche de travail `vibe/<slug>-<hash>` et ouvrir une PR (draft puis ready).
- La fusion dans `main` est faite par le propriétaire depuis GitHub (la fusion via CLI est bloquée sur ce dépôt).
- Commits en français, préfixes `feat:`, `fix:`, `perf:`, `design:`, `docs:`, `layout:`.
- PRs petites et ciblées : une fonctionnalité complète par PR.
- Tests fonctionnels en sandbox avant chaque PR quand la logique est testable.
- Ne jamais commiter de secrets (clés API, `.env`) — les clés utilisateur restent dans le navigateur.
