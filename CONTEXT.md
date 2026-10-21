# CONTEXT.md — Mémoire du projet (à lire en priorité)

> Ce fichier sert de **mémoire entre les sessions** d'assistance (IA/agents).
> Toute session qui travaille sur ce dépôt **doit lire ce fichier en premier** et le **mettre à jour** en fin de travail (décisions, état, leçons).

## 🎯 Objectif du projet

Être une **application en ligne** (utilisée depuis le navigateur par l'équipe de l'Atelier du Web) avec une **base de données SQLite**. Étapes : 1️⃣ app 100 % statique en ligne (GitHub Pages) avec SQLite sql.js dans le navigateur → 2️⃣ brancher un hébergement avec BDD SQLite partagée entre postes. Voir README pour l'état détaillé.

## 🎯 Périmètre fonctionnel

Système de gestion des membres du cyberespace (25 ordis, accès sur inscription) et des inscrits aux formations de l'**Atelier du Web** ([atelierduweb.be](https://atelierduweb.be)).
Outil en 3 parties principales : **fiches formations**, **fiches membres**, **calendrier/fiches des 2 salles de formation**.
Contrainte de design : correspondre au design du site atelierduweb.be.

## 🏗️ Architecture (décisions figées)

- ⚠️ **⚠️ LE PROJET GITHUB PAGES EST UNE MAQUETTE. Le projet final tournera avec une vraie base SQLite (backend).**
  - Toutes les décisions de schéma, de requêtes SQL et de flux de données doivent être **compatibles avec une migration vers SQLite réel** : schéma SQL standard, requêtes paramétrées, pas d'API propriétaire navigateur dans la logique métier.
  - Le sql.js/IndexedDB actuel est le **substrat temporaire** : le même code SQL doit pouvoir tourner sur un serveur SQLite (better-sqlite3, etc.) avec le minimum de réécriture.
  - Les données saisies dans la maquette ne sont PAS définitives (mais le schéma, lui, doit être bon dès maintenant).
- **100 % statique (pour la maquette)**, hébergé sur GitHub Pages : [d0cm4c.github.io/Gestion-Membres-Inscriptions-de-l-Atelier-du-web](https://d0cm4c.github.io/Gestion-Membres-Inscriptions-de-l-Atelier-du-web/)
- **Pas de backend possible (dans la maquette)** : toute la logique tourne côté navigateur.
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
- ⚠️ **Cache navigateur sur Pages** : incrémenter le cache-busting des assets à chaque changement de JS/CSS, sinon les visiteurs voient l'ancienne version.
- **Versionnage global** : quand un asset partagé change (theme.js, db.js, styles.css, notifications.js…), monter sa version sur **TOUTES les pages dans le même commit** — jamais page par page (l'audit d'oct. 2026 a trouvé theme.js en v13/v14 selon les pages et db.js en v17/v18 : même fichier, mais risque de cache divergent au prochain vrai changement). Vérifier avec `grep -h 'asset.js?v=' *.html | sort -u` qu'une seule version existe.

## 📦 État actuel (nov. 2026)

Fait :
- Dashboard (`index.html`) : KPI temps réel, alertes, visites récentes, analyses croisées, usagers du jour, rapport annuel exportable, heatmap/donut, mosaïque drag'n'drop, thème sombre.
- Membres (`membres.html`) : CRUD complet, n° de membre auto (4 chiffres, #1000…), abonnements (mensuel 3 € / annuel 30 €), pointage de visite (1 € ou incluse si abo, double pointage refusé), suivi des impressions (solde, impression rapide), recherche/tri (11 critères)/filtres, vues cartes/liste, export CSV, code postal avec autocomplétion, genre, statut social.
- Import XML Access : **3 806 membres réels** importés avec mappings ; `db.js` tient la charge.
- Page Paramètres (`parametres.html`) + thème partagé sur toutes les pages.
- 20 membres fictifs de démonstration.
- **Formations (`formations.html`) — fusionnées sur `main`** :
  - **Source de données : API REST publique WordPress** `wp-json/wp/v2/mec-events` (pas de clé, CORS OK nativement via `rest_send_cors_headers`). Fallback RSS `feed/` si l'API est désactivée.
  - ⚠️ Décision importante : l'API officielle M.E. Calendar (`wp-json/mec/v1.0`, header `mec-token`) a été **abandonnée** — elle exige un header custom qui déclenche un preflight CORS non géré par WordPress, et la clé fuite dans le client. Voir leçon n°6.
  - Module `mec.js` : fetch paginé (per_page 100), cache localStorage 15 min, parseur d'extraits FR (« ⏳ Durée / 📅 Dates / ⏰ Horaires » → champs séparés, 3 formats couverts dont « Les 08 et 10 décembre 2026 »), résolution des catégories `mec_category` (IDs → noms).
  - UI : cartes groupées par mois, bandeau dégradé coloré **par catégorie** (palette déterministe, hash du nom → 10 tons), bloc date (jour+mois), champs durée/horaires propres, tags colorés, pastille de couleur sur les en-têtes de mois, mode sombre.
  - Filtres : à venir/toutes, mois, catégorie + recherche. Liens directs vers la réservation sur atelierduweb.be.
  - Lien « 🎓 Formations » activé dans la sidebar de toutes les pages.
- **Inscriptions aux formations (session oct. 2026)** : synchronisées dans la base SQLite —
  - Tables : `formations` (sync flux → DB, event_id MEC = clé naturelle, retrait auto des disparues), `formations_members` (inscriptions locales, UNIQUE(formation_id, member_id)).
  - Modale d'inscription par formation (👥 sur les cartes) : recherche membre, inscription/désinscription, compteur en direct, **export CSV** (BOM UTF-8, séparateur `;`, en-tête formation/date/horaires, slug accentué).
  - **Champ « n° de membre » à ajouter côté MEC** (booking form) — décision utilisateur : c'est le match le plus fort pour la synchro des inscriptions du site.
- **Centre de notifications (toutes les pages)** : `notifications.js` — bouton 🔔 + badge non-lues dans la topbar, journal persistant (table `notifications`), API `ADWNotifications.push(type, message, sévérité)`. Règle : **toute action automatique est notifiée et journalisée**.
- **Écran de validation des inscriptions du site** (page Formations, bouton 📥) : file des `bookings_remote` non traités avec matching hiérarchique — 1) n° de membre exact → auto notifié, 2) email exact (LOWER) → auto notifié, 3) nom+prénom → candidats + validation humaine (jamais auto), 4) sinon création de membre (n° auto). Bouton démo 🧪 pour la maquette (3 résas simulées). **La vraie synchro se fera côté serveur** (décision sécurité : pas de clé publique) — le schéma et le flux sont prêts.
- **Page membre dédiée `membre.html?id=...`** : fiche complète en page (URL partageable, titre d'onglet dynamique, bouton retour), avec formations + visites. Les liens « voir la fiche » (modale inscriptions) pointent dessus. `membres.html#member=<id>` ouvre toujours la modale (compat ascendante).

- **Architecture miroir « le site vend, l'app gère » (décision utilisateur, oct. 2026)** :
  - Plus aucune inscription directe dans l'app : le bouton « 🌐 Inscrire via le site » ouvre le formulaire MEC pré-rempli (`?method=mec-booking-modal&adw_name=…&adw_member_no=…`) — **le n° de membre pré-rempli EST le tracking** : la booking revient avec, le matching auto fait le reste.
  - Désinscription supprimée de l'UI : le miroir retire automatiquement l'inscription locale quand la réservation est annulée côté site (`applyMirror`, testé 4/4), toujours notifié.
  - Le préfill nécessite le snippet 3 (wp_footer, remplissage de la modale AJAX MEC, en attente hébergeur).
- **Pages dédiées (URL partageables)** : `formation.html?id=<event_id>` (bandeau couleur catégorie, infos structurées date/horaires/durée/tarif/lieu/organisateur — ces 3 derniers « à confirmer » en attendant les snippets 1-2, description, inscrits) et `membre.html` (fiche complète). Les inscrits de la page formation ouvrent une **modale d'aperçu rapide** (infos clés + bouton « Fiche complète → »). Liens croisés cartes → formations → membres → formations.
- **Snippets WordPress séparés (plugin Code Snippets) en préparation** : 1) organisateur (REST), 2) lieu (REST), 3) préfill modale MEC (en attente du HTML de la modale pour les sélecteurs), 4) bookings (endpoint secret — refusé côté client public : à brancher sur le backend final).
- Colonnes `organizer`/`location` ajoutées à la table `formations` (schéma prêt).

- **Module Salles (oct. 2026, terminé)** : tables `rooms` (Grande salle 15, Petite salle 8, Cyber-espace 25) + `formation_dates` (date + créneau AM/PM 9h30-12h30 / 13h30-16h30), colonne `room_id`, parseur multi-dates, parseSlot (Matin si début < 12h), synchro remplit formation_dates, attribution sur fiche formation (conflits salle×date×créneau NON bloquants + notifications), page `salles.html` (grille mensuelle 3 salles × Matin/A-midi, couleurs par salle, jour + créneau actuels surlignés, refresh 60s, badge Sans salle + série). ATTENTION bug corrigé : `toISOString()` décale d'un jour en UTC+1 — utiliser un formateur local (isoLocal).
- **Système Suggestions (oct. 2026)** : bouton volant (suggestions.js, toutes pages, Ctrl+Entrée, page d'origine) + page `suggestions.html` (statuts, filtres) + cartouche Ouvert/Fermé partout (openstatus.js).
- **Uniformité totale (oct. 2026)** : 8 pages, sidebar identique (6 liens PLATS — sections Général/Espace/Système SUPPRIMÉES : source de 3 bugs de duplication) et topbar complète. Versionnage : 1 version unique par asset (styles v18, theme v14, db v18, mec v15, composants v2).
- **Bug emojis corrigé** : la séquence \U0001F... (syntaxe Python) ne marche pas en JS — vrais caractères UTF-8 ou surrogate pairs (\uD83D\uDCDD). 6 occurrences corrigées.

En cours / ouvert :
- **⚠️ MAQUETTE vs FINAL — décisions utilisateur (session oct. 2026) pour la synchro des inscriptions MEC :**
  1. **Refusé** : clé/secret public dans le JS pour exposer les inscriptions (point sécurité du 19/10). À revoir avec l'hébergeur/DPO — la synchro bookings devra passer par une voie non publique (idéalement le backend SQLite final, ou un endpoint protégé non exposé côté client).
  2. **Auto-rattachement sur email exact : OK**, MAIS avec notification obligatoire (journal d'actions + centre de notification/écran de validation pour tout ce qui est automatique).
  3. **Réservation annulée côté site → suppression automatique côté app**, MAIS avec notification (jamais silencieuse).
  → Conception générale : **toute action automatique doit être notifiée et journalisée** ; tout rattachement non certain (nom/prénom sans email exact) passe par l'écran de validation humaine.
- **Organisateur & lieu** : non exposés par l'API WP publique. Snippet `register_rest_field` fourni à l'utilisateur (organisateur + lieu via `mec_organizer_id`/`mec_location_id` postmeta) — **en attente de la réponse de l'hébergeur** pour installation. Une fois en place : ajouter le champ dans `mec.js` (`_fields` + affichage dans le pied de carte) et Actualiser. *(Un snippet combiné organisateur+lieu+bookings a aussi été proposé — voir discussion sécurité : la partie bookings ne doit PAS être exposée publiquement.)*
- **Responsive mobile (nov. 2026)** : bouton ☰ dans la topbar, sidebar transformée en tiroir coulissant ≤ 860px (overlay, touche Échap, clic sur un lien = fermeture, fermeture auto au retour desktop — nouveau `nav.js` chargé sur les 4 pages). Boutons d'action/filtres empilés pleine largeur et tapables, recherche et modales adaptées, cache-busting passé en v14. **Desktop inchangé** : tout est dans des `@media` uniquement.
- **PROCHAIN CHANTIER — Plugin WordPress « atelierduweb-mec-api » (nouvelle session à créer)** :
  L'utilisateur veut un plugin WP dédié (dépôt séparé, installable par upload zip dans l'admin WP) pour exposer les infos M.E. Calendar — remplace la stratégie des snippets à faire poser par l'hébergeur. Architecture validée :
  - **Module 1 — Organisateur** : `register_rest_field('mec-events', 'mec_organizer')` via postmeta `mec_organizer_id` (name, email, tel, website). Public.
  - **Module 2 — Lieu** : `register_rest_field('mec-events', 'mec_location')` via postmeta `mec_location_id`. Public.
  - **Module 3 — Places restantes** : dispo par événement (afficher « Complet » dans l'app sans clé MEC). Public.
  - **Module 4 — Préfill modale réservation** : JS `wp_footer` remplissant la modale AJAX MEC (paramètres `?method=mec-booking-modal&adw_name=...&adw_email=...&adw_phone=...&adw_member_no=...`). Sélecteurs DOM à valider avec le HTML de la modale MEC ouverte (l'utilisateur devait le fournir) — prévoir sélecteurs configurables dans les réglages si HTML non fourni.
  - **Module 5 — Bookings** : route REST `/adw/v1/bookings` (lecture table wp_mec_bookings : id, event_id, firstname, lastname, email, date, status, + champ n° de membre à ajouter au formulaire MEC). DÉSACTIVÉ PAR DÉFAUT + secret configuré dans l'admin — JAMAIS appelé depuis le navigateur (décision sécurité utilisateur) : server-to-server par le backend final uniquement.
  - **Page de réglages admin WP** : activer/désactiver chaque module (cases à cocher), champ secret, période de synchro. Pas de constantes à éditer dans le code.
  - Structure : fichier principal + includes par module. Code standard WP, commentaires français.
  - **Questions ouvertes** : dépôt GitHub séparé (conseillé) ; priorité module 4 ; périmètre module 3 ; qui installe le plugin (upload zip par l'utilisateur vs hébergeur).
  - Côté app une fois actif : organizer/location dans les `_fields` de mec.js (colonnes prêtes en base), badge « Complet », vraie synchro bookings côté serveur.
- Améliorations proposées (non tranchées) : visuel — agenda du jour (dashboard), print-friendly, vue compacte planning ; fonctionnel — recherche globale, vue annuelle salles (détection créneaux libres), rappel auto des formations sans salle.
- Feuille de route restante : fiches formations détaillées (tarifs, participants).

## 🧠 Leçons apprises (méthodes qui ont marché)

1. PRs incrémentales, une fonctionnalité complète par PR, fusionnées dans l'ordre.
2. Tests fonctionnels jsdom avant chaque fusion : ils révèlent des bugs d'UX invisibles en relecture (ex. modal ne se fermant pas — `display:flex` écrasait `hidden` → fix `[hidden]{display:none!important}`).
3. Brancher les features sur les **vraies données** dès que possible (dashboard sur la vraie BDD ; import des 3 806 membres réels a révélé un bug de perf et un bug de migration `member_no`).
4. Traiter les bugs bloquants dans une PR dédiée **avant** les améliorations.
5. Données réelles tôt = bugs d'échelle trouvés que les tests unitaires ne trouvent pas.
6. **API tierce : chercher la voie publique standard avant l'API officielle.** L'API MEC officielle (header `mec-token`) était bloquée par CORS + exposait une clé côté client ; le type custom `mec-events` de l'API WP publique a résolu les deux problèmes d'un coup. Toujours tester le namespace `wp/v2` d'abord.
7. **Parser les données affichées du site cible comme format de référence** : les extraits FR structurés (« ⏳ Durée : … 📅 Dates : … ⏰ Horaires : … ») sont une source fiable quand les postmeta ne sont pas exposés. Tester le parseur sur les 2-3 formats réellement utilisés (node + mock de `document`).
8. **Attendre la validation visuelle du client avant de verrouiller un design** : la version « liste » a été refusée, la version « cartes avec bordures » validée. Itérer vite, commetter les états validés.
9. **Ne jamais casser le desktop validé** : encapsuler tout travail responsive dans des `@media` (≤ 860px ici) sans toucher aux règles desktop — le design desktop est validé par le client et ne doit pas bouger.
10. **Anticiper la migration SQLite-serveur dans chaque décision** : le projet Pages est une MAQUETTE — schémas SQL standards, requêtes paramétrées, logique métier découplée des API navigateur. Les décisions de flux (synchro, matching) sont pensées pour tourner côté serveur ensuite.
11. **La validation humaine est le garde-fou des automatismes** : hiérarchie de matching avec seuil de certitude (id > email > nom), tout ce qui est certain s'automatise mais se journalise, tout ce qui est incertain passe par l'humain. Le champ « n° de membre » saisi par l'usager lui-même lors de la réservation renforce le maillon le plus fort.
12. **Résumer et faire valider avant de pousser** : présenter le résumé de chaque action (fichiers, but, impact) et obtenir l'aval explicite de l'utilisateur avant commit/push — l'utilisateur garde le contrôle du dépôt.
13. **Le préfill peut remplacer le tracking** : quand l'app fournit elle-même les données du formulaire distant (n° de membre), la donnée revient avec la réservation → le matching automatique fait la réconciliation. Pas besoin d'un système de vérification que personne n'utiliserait.
14. **Modale pour le parcours rapide, page pour le lien profond** : dans une liste de gestion (inscrits), l'aperçu en modale évite la navigation ; la page dédiée reste pour le partage/deep-linking.
15. **Sidebar et topbar partagées = risque de divergence** : chaque page duplique la sidebar/topbar en dur. Toute modification sur une page (nouveau lien, nouvelle section) DOIT être suivie d'une passe de vérification sur TOUTES les pages (grep : compter les sections, comparer les href, vérifier les composants topbar — cartouche, notifCenter, thème). Les bugs de ce type (section « Système » dupliquée sur 5 pages en 2 occurrences distinctes, liens désactivés alors que la page existe, notifications absentes d'une page) ne se voient qu'à l'audit systématique.

## 📜 Historique des PRs

1. Page Membres CRUD + cartes (localStorage) — fusionnée
2. SQLite sql.js + IndexedDB + tri — fusionnée
3. Fix fermeture formulaire + filtres/tris/vues — fusionnée
4. UX : validation, préférences, toasts, export CSV — fusionnée (tests 35/35)
5. Abonnements, visites, n° auto, refonte design accessible — fusionnée (tests 48/48)
6. dashboard temps réel + README — fusionnée (tests 15/15)
7. Formations M.E. Calendar — draft ouvert puis **fusionnée directement sur `main`** à la demande de l'utilisateur (commits `d7378eb` → `03a8e4e`) : page + API MEC officielle, puis refactor vers API WP publique, puis design cartes/mois, puis couleurs par catégorie.
8. Suite formations (oct. 2026, livré directement sur `main`) : inscriptions en base + modale + export CSV (`fed0e8a`), formations sur fiche membre (`db13583`), horaires/durée parsés proprement + filtrage events passés/trashed (`6ef0cf5`), centre de notifications + écran de validation des inscriptions du site + schéma bookings_remote (`fb87835`), page membre dédiée (`d57e02d`).

## 📌 Règle pour toute future session

> Voir aussi la **check-list obligatoire de fin de session** dans `AGENTS.md` : toute PR doit être précédée de la mise à jour de ce fichier quand l état, les décisions ou les leçons ont changé.

1. Lire ce fichier et le README.
2. Vérifier `git log`, les PRs ouvertes et `git status` avant de toucher au code.
3. À la fin de la session : **mettre à jour ce fichier** (état, décisions, leçons) dans la même PR que le travail livré.
4. **Avant tout commit/push : résumer l'action (fichiers, but) et attendre la validation explicite de l'utilisateur.** Jamais de push automatique en fin de tâche.
5. **Après tout changement de sidebar ou topbar sur une page : passer toutes les pages en revue** (sections, liens, composants) — la mise en page est dupliquée page par page, donc une modification localisée crée des divergences invisibles. Audit rapide : `for f in *.html; do grep -c 'side-section' $f; done` + comparaison des href de chaque nav.

## 🔧 Autonomie de livraison

- Les sessions d'assistance **commitent et poussent elles-mêmes** sur des branches de travail (`vibe/…`) et ouvrent des PRs — pas besoin de demander une validation à chaque étape.
- La **fusion dans `main` reste manuelle** (faite par le propriétaire depuis GitHub) : la fusion via CLI est bloquée sur ce dépôt.
