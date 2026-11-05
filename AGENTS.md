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

## Livraison

- Commiter et pousser soi-même sur une branche de travail `vibe/<slug>` et ouvrir une PR (draft puis ready). Pas de demande de validation à chaque étape.
- La fusion dans `main` est faite par le propriétaire depuis GitHub.
- Ne jamais commiter de secrets (clés API, `.env`) — les clés utilisateur restent dans le navigateur.

### 🔀 Procédure de fusion d'une branche (pour les sessions qui galèrent)

**Qui fusionne ?** Le propriétaire valide (« go » dans la conversation) et la **session app** exécute le merge localement puis pousse — pas de bouton GitHub. Avantages : historique `--no-ff` lisible, CI rejouée sur `main` avant Pages, contrôle total.

**La commande unique** (à adapter : branche, numéro de PR, titre) :

```bash
git checkout main
git pull --ff-only origin main          # 1. rattraper le dépôt distant (toujours, même si « up to date » affiché)
git merge --no-ff <branche> -m "Merge pull request #<n> : <titre>"   # 2. merge avec commit de fusion
git push origin main                    # 3. pousser
gh pr view <n> --json state -q '.state' # 4. vérifier : doit répondre MERGED... non — voir note
sleep 40                                # 5. laisser le temps au workflow de démarrer
RUN_ID=$(gh run list --branch main --workflow CI --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch $RUN_ID --exit-status      # 6. attendre la CI sur main (doit finir success)
```

**Les pièges qui font galérer (leçons réelles)** :

1. **« Already up to date » au pull** : normal si personne n'a poussé depuis — continuer quand même le merge.
2. **Le message du merge** doit citer la PR (`Merge pull request #NN : titre`) — c'est ce qui relie le commit de fusion à la PR dans l'historique.
3. **`--no-ff` toujours** : sans lui, un fast-forward rend l'historique linéaire et on perd la trace du groupe de commits de la PR.
4. **Après le push, la PR se ferme toute seule** (GitHub détecte le commit de fusion) — vérifier avec `gh pr view <n> --json state` qui doit afficher `MERGED`.
5. **Attendre la CI sur `main`** avant de dire « c'est déployé » : Pages déploie après CI. Si la CI échoue sur main (rare — elle était verte sur la branche), ne jamais forcer : investiguer le log (`gh run view --log-failed`).
6. **Jamais de `--force` sur `main`**, jamais de rebase de branches déjà poussées partagées.
7. **Conflits au merge** : si `git merge` signale des conflits, ne pas improviser — annuler (`git merge --abort`), rebase de la branche sur main (`git checkout <branche> && git rebase main`), résoudre sur la branche, re-pousser avec `--force-with-lease`, CI, puis re-merger.

**Nettoyage** : après le merge confirmé, la branche peut être supprimée localement (`git branch -d <branche>`) — la garder sur le distant ne coûte rien et sert d'archive.

---

## 📡 Protocole inter-sessions (écosystème multi-dépôts)

Ce dépôt fait partie d'un écosystème travaillé par plusieurs sessions IA en parallèle :

| Dépôt | Rôle | Sessions |
|---|---|---|
| `D0cm4c/Gestion-Membres-Inscriptions-de-l-Atelier-du-web` (**app**) | Cette app de gestion (GitHub Pages, statique) | sessions app |
| `D0cm4c/atelierduweb-mec-api` (**plugin**) | Plugin WordPress ADW MEC API (atelierduweb.be) | sessions plugin |

### Règles au démarrage de chaque session

1. Lister les issues ouvertes sur **ce dépôt** : `gh issue list --repo D0cm4c/Gestion-Membres-Inscriptions-de-l-Atelier-du-web --state open`
2. Lister aussi les issues ouvertes sur le **dépôt partenaire** : `gh issue list --repo D0cm4c/atelierduweb-mec-api --state open`
3. **Traiter en priorité** les issues portant le label `pour-app` (adressées à ce dépôt).
4. Pour chaque issue à traiter : **commenter d'abord son plan** (compréhension, fichiers visés, plan de livraison), puis livrer, puis **fermer l'issue** en citant le commit/PR.
5. Pour nos demandes vers le partenaire : ouvrir une issue sur **ce dépôt** avec le label `pour-plugin` et un titre préfixé `[app]`.

### Rédaction d'une demande inter-dépôts

Une demande = une issue, contenant :
- **Contexte** : dépôt émetteur, dépôt cible
- **Spec précise** : routes, formats, noms de champs exacts, exemples de payloads
- **Critère d'acceptation** : comment vérifier que la demande est satisfaite

Règles :
- Toute décision d'interface (nom de champ, route, format) est documentée **dans les deux dépôts** (issue + AGENTS.md/doc de chaque côté).
- **Jamais de secret dans une issue** (token, mot de passe, clé, `.env`).
- Pas de boucle : si deux issues se renvoient mutuellement la responsabilité → demander l'arbitrage humain.
- La gouvernance (sécurité, production) reste **humaine**.

### Interfaces documentées (vivant)

| Interface | Spec | Documentée |
|---|---|---|
| Préfill modale MEC | URL `{formation.url}?method=mec-booking-modal&adw_name=…&adw_email=…&adw_phone=…&adw_member_no=…` (attention : `adw_name`, pas `adw_nom`) | app `booking.js` + plugin |
| Endpoint labels (demandé, issue #89) | `GET /wp-json/adw-mec/v1/labels` → `{ "<event_id>": { labels[], price, location, organizer } }` — public, sans secret | app `mec.js` (enrichFromPlugin) + BACKEND.md §7 |
| Endpoint inscriptions (retour résas) | Authentifié par secret, server-to-server uniquement — jamais appelé depuis le navigateur | BACKEND.md §7-8 |
