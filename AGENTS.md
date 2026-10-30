# AGENTS.md — Instructions pour toute session d'assistance (IA/agent) sur ce dépôt

> ⚠️ **Première action obligatoire de toute session : lire [`CONTEXT.md`](CONTEXT.md).**
> C'est la mémoire du projet entre les sessions (décisions, état, leçons). Ne jamais le réécrire de zéro : le **mettre à jour** à la fin de chaque session dans la même PR que le travail livré.

## Rappel du workflow (détails complets dans CONTEXT.md)

1. **Lire `CONTEXT.md`** puis `README.md` avant toute modification.
2. Vérifier `git status`, `git log` récents et les PRs ouvertes (`gh pr list`).
3. Respecter les décisions figées : app 100 % statique (GitHub Pages, pas de backend), SQLite via sql.js/IndexedDB, JS vanilla sans framework, UI en français.
4. Conventions : commits en français avec préfixes (`feat:`, `fix:`, `perf:`, `design:`), PRs petites et ciblées, tests fonctionnels jsdom quand la logique est testable, incrémenter le cache-busting des assets à chaque changement JS/CSS.

## ✅ Check-list obligatoire avant d'ouvrir une PR

**Aucune PR ne peut être ouverte sans avoir parcouru cette check-list.** Si un point ne s'applique pas (ex. typo dans un doc), le vérifier et passer au suivant — mais chaque point doit être examiné.

- [ ] `CONTEXT.md` lu au début de la session (pas seulement survolé)
- [ ] **`CONTEXT.md` mis à jour** si la session a changé : l'état du projet, une décision (figée ou nouvelle), une fonctionnalité, ou découvert une leçon/vigilance
- [ ] Section « 📦 État actuel » à jour (ce qui est fait / en cours)
- [ ] Section « 📜 Historique des livraisons » complétée avec cette PR (branche — titre)
- [ ] Nouvelles leçons ou bugs surprenants ajoutés à « 🧠 Leçons apprises »
- [ ] PRs ouvertes vérifiées : cette PR ne remplace pas une PR existante (mettre à jour la branche existante si le sujet est le même)

**Règle simple** : si la session a appris ou changé quelque chose qui serait utile à la prochaine session, **ça doit être dans `CONTEXT.md` avant le push final**.

## 📡 Protocole inter-sessions (généraliste)

Ce projet fait partie d'un **écosystème multi-dépôts** où plusieurs sessions IA travaillent sur des dépôts liés (ex. le plugin WordPress `D0cm4c/atelierduweb-mec-api`) et doivent se coordonner **sans messager humain** pour la partie conception.

### Au démarrage de CHAQUE session

1. Lire `gh issue list --state open` **sur ce dépôt ET sur les dépôts partenaires** (ex. `gh issue list --repo D0cm4c/atelierduweb-mec-api`), commentaires récents inclus.
2. Chercher les issues **adressées à ce dépôt** : label `pour-app`, ou mention de ce dépôt dans le titre/corps.
3. Si une issue est adressée à ce dépôt : **la traiter en priorité** (après validation humaine si ambiguë), commenter avec le plan, livrer, **fermer avec un commentaire** référençant le commit.
4. Si ce dépôt a besoin de quelque chose d'un autre dépôt (endpoint, spec, correction) : **ouvrir une issue sur ce dépôt avec le label `pour-<autre-dépôt>`** (ex. `pour-plugin`), titre préfixé `[app] …`. Ne jamais attendre que l'humain transmette.
5. Vérifier les issues que ce dépôt a ouvertes ailleurs : une réponse y attend peut-être.

### Règles de rédaction des issues inter-sessions

- **Une demande = une issue** : contexte, spec précise (routes, formats, exemples), critère d'acceptation, `Closes #<n>` si applicable.
- Toute **décision d'interface** (route, header, format, paramètres URL de préfill) doit être **répercutée dans la doc des deux dépôts** dans la même livraison (leçon apprise : `adw_name` vs `adw_nom` découvert après coup).
- Les issues automatisent la **conception/coordination**, pas la gouvernance : arbitrage sécurité, accès production et décisions produit restent humains.

### Adaptation à un autre projet

Copier cette section dans le `AGENTS.md` de chaque dépôt d'un écosystème, créer les labels `pour-<dépôt>`, et chaque session sait quoi lire. Aucune infrastructure supplémentaire requise (issues GitHub natives).

## Livraison

- Commiter et pousser soi-même sur une branche de travail `vibe/<slug>` et ouvrir une PR (draft puis ready). Pas de demande de validation à chaque étape.
- La fusion dans `main` est faite par le propriétaire depuis GitHub.
- Ne jamais commiter de secrets (clés API, `.env`) — les clés utilisateur restent dans le navigateur.
