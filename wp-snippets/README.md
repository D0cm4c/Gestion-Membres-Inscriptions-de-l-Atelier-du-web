# wp-snippets — Étapes de test avant le plugin « atelierduweb-mec-api »

> Stratégie : valider chaque module du futur plugin WordPress comme **snippet Code Snippets** sur le site en production, puis assembler le plugin une fois chaque brique validée. Un snippet cassé se désactive en un clic dans Code Snippets — aucun déploiement, aucun FTP.

## Règles de sécurité (site en production)

1. **Un module par snippet**, nommé `snippet-N-*.php` (N = n° du module du plan dans `CONTEXT.md`).
2. Lecture seule : aucun `UPDATE`/`DELETE`/`INSERT` en base, aucune écriture de fichier.
3. Hook **uniquement** `rest_api_init` ou `wp_footer` selon le module — jamais d'accroche sur le rendu des pages.
4. Toutes les fonctions préfixées `adw_mecapi_*` — aucun risque de collision.
5. Tout callback retourne `null` proprement en cas de donnée manquante — jamais d'exception PHP, jamais de `wp_die()`.
6. Champ `adw_snippetN_version` dans chaque réponse : vérifie d'un coup que le snippet actif ET sa version sont bien ceux attendus (les réponses REST peuvent être cachées par le site ou le CDN).

## Snippet 1 — Modules 1 & 2 : organisateur + lieu (✅ prêt à tester)

**Fichier :** `snippet-1-organisateur-lieu.php`

**Ce qu'il fait :** ajoute les champs `mec_organizer` et `mec_location` aux événements `mec-events` de l'API REST publique (`wp-json/wp/v2`), lus depuis les postmeta MEC `mec_organizer_id` / `mec_location_id`.

**Installation :**
1. WP Admin → Code Snippets → Add New.
2. Titre : `ADW — Modules 1&2 : organisateur + lieu (API REST)`.
3. Coller le contenu intégral du fichier, en conservant la ligne `if (!defined('ABSPATH')) { return; }`.
4. Config : *Run snippet everywhere* (sans effet front — le code ne tourne que sur l'API REST). Sauvegarder **et** activer.

**Test d'acceptation :**
```bash
curl -s 'https://atelierduweb.be/wp-json/wp/v2/mec-events?per_page=1&_fields=id,title,mec_organizer,mec_location,adw_snippet1_version' | python3 -m json.tool
```
- `adw_snippet1_version` vaut `1.0.0` → snippet actif.
- `mec_organizer` contient `{"id","name","email","tel","website"}`.
- `mec_location` contient `{"id","name","address","website"}`.
- Si un événement n'a pas d'organisateur/lieu : `null` (comportement normal).

**Retour d'urgence :** Code Snippets → snippet → toggle *Inactive* (ou suppression) → l'API redevient exactement comme avant.

## Snippets suivants (à livrer après validation du 1)

- **Snippet 2 — Module 3 : places restantes** (lecture `mec_events`/bookings MEC, champ `mec_spots_left`).
- **Snippet 3 — Module 4 : préfill modale MEC** (`wp_footer`, paramètres `?method=mec-booking-modal&adw_name=...&adw_member_no=...`) — nécessite le HTML de la modale pour les sélecteurs.
- **Snippet 4 — Module 5 : bookings** (`/adw/v1/bookings`, secret, désactivé par défaut) — **jamais appelé depuis le navigateur**, server-to-server uniquement. À valider avec l'hébergeur/DPO avant activation.
