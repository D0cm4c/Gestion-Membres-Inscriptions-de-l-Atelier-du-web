# SKILL-DESIGN — Le design de l'Atelier du Web (mémoire de travail)

> **Comment utiliser ce skill** : toute session qui touche au design (couleurs, mise en page, composants, skin) DOIT lire ce fichier d'abord et s'y conformer. Toute nouvelle décision design validée par l'utilisateur s'ajoute ici.
>
> **Définition de travail** (précision de l'utilisateur, nov. 2026) : quand on parle de design, on parle de **TROIS couches** :
> 1. **Couleur** — la palette et ses rôles
> 2. **Archi CSS** — marges, coins, filets, ombres, typographie, états
> 3. **Skin** — les habillages de composants spécifiques (bannières, avatars, modales)
>
> Une livraison design n'est complète que si les trois couches sont traitées.

---

## 🎨 Couche 1 — La palette « crème-charte » (validée nov. 2026, PR #128)

Chaque couleur a UN métier — rien ne se dispute :

| Couleur | Hex | Métier |
|---|---|---|
| **Crème** | `#F7F3EA` | Fond de page — la chaleur qui donne envie |
| **Blanc** | `#FFFFFF` | Surfaces (cartes), KPI hero — l'air |
| **Encre brune** | `#2B2226` | Texte, sidebar, compteurs — la structure |
| **Brun-noir** | `#3A2E33` | Hero de page, titres, aplats structure |
| **Beige** | `#D9CDB8` | Texte sur fonds bruns (sidebar) |
| **Beige foncé** | `#C4B49A` | Liserés, hover |
| **Filet** | `#E5DCC8` | Bordures des cartes |
| **Bordeaux** | `#9f0c45` | 🍒 L'IDENTITÉ de l'Atelier (charte du site) — primary/accent, chiffre hero, liserés. **TOUJOURS en micro-doses, JAMAIS en aplat dominant** |
| **Lime** | `#bbcc6a` | 🍋 Le POSITIF (charte du site) — liseré KPI Nouveaux, cartouche Ouvert, tag Attente |
| **Lime texte** | `#8FA344` | Chiffre sur blanc (contraste — le lime pur est illisible en texte) |
| **Rouge** | `#D8434B` | ❤️ L'attention — alertes, badge non-lus |

**Dark mode** : bruns chauds sombres (`#171216` sidebar, `#1A161A` fond, `#252025` surfaces), accent beige `#D9CDB8`, primary rosé `#E8A0BC` (lisible sur sombre). **Jamais de bleu nuit.**

**Couleurs fonctionnelles** (statuts sociaux, donut, paiements) : violet `#6C5CE7`, bleu `#2F9BE4`, vert `#18A55F`, ambre `#EFA02C`, rouge `#D8434B` + variantes `-light`. Conservées telles quelles — calibrées pour la lisibilité en petit texte.

### Les leçons couleur (à ne JAMAIS oublier)
1. **Une charte vitrine ≠ une palette d'app** : le bordeaux du site marche en petits accents sur blanc ; à grande dose dans une app dense, il fatigue et agresse. L'identité en filigrane, pas en peinture.
2. **Le lime a besoin d'un partenaire sombre** : brun dessous ou texte brun — seul sur crème, il délave.
3. **Le contraste d'abord** : une couleur claire en texte sur blanc → toujours une variante foncée dérivée (lime → `#8FA344`).
4. **Chaque couleur un métier** : identité / positif / attention / structure. Si deux couleurs font le même travail, une de trop.

---

## 📐 Couche 2 — L'archi CSS « H4 aérien » (cahier des charges validé)

### Coins — jamais plus de 6px
| Élément | Rayon |
|---|---|
| Cartes, KPI, recherche | **6px** (`--radius`) |
| Petits blocs (slots, tags, compteurs, badges) | **3px** |
| Cartouche Ouvert/Fermé | **4px** (`--radius-sm`) |
| Sidebar | **0px** — bloc plein |

### Bordures — les filets font le travail
- Cartes : **1px solid** filet — la carte existe par son contour, **pas par son ombre**
- KPI : 1px + **liseré gauche 3px** qui code la nature de la carte (bordeaux = identité, beige, lime = positif, brun = structure)
- Lignes : 1px transparent au repos → visible au hover
- La profondeur vient des **valeurs de fond** (crème < blanc < crème teinté `#F3EEE2`), pas de la 3D

### Ombres — quasi inexistantes
- Cartes au repos : **zéro ombre**
- KPI hero : une seule très légère `0 4px 14px rgba(59,46,51,0.08)`
- **Hover = changement de MATIÈRE, pas de position** : border visible + fond à peine teinté, **aucun translateY, aucun box-shadow au survol**

### Dégradés — **ZÉRO, définitif** (précision utilisateur : « c'est moche »)
Tout est **aplat**. La profondeur visuelle vient uniquement de l'empilement des fonds.

### Marges — resserrées
| Élément | Valeur |
|---|---|
| Main | `1.6rem 2rem 2.5rem`, max-width **1440px** centré |
| Cartes | `1.05rem 1.15rem` |
| KPI | `0.85rem 1rem` |
| Lignes | `0.58rem 0.75rem`, gap 0.7rem |
| Gap KPI | `0.9rem` |
| Gap cartes en grille | `1.1rem` |

### Typographie (Inter)
| Élément | Style |
|---|---|
| h1 | 1.35rem / 700 / -0.3px |
| Titres cartes | 0.95rem / 700 |
| KPI num | 1.8rem / 700 / **tabular-nums** |
| KPI label | 0.72rem / 600 / UPPERCASE / 0.8px |
| Lignes | 0.88rem / 500 |
| Tags/slots | 0.64rem / 700 / UPPERCASE / 0.5px |

### Icônes
Les **emojis natifs** restent le système d'icônes (précision utilisateur : « on garde les emoji de l'original »).

---

## 🧴 Couche 3 — Le skin (composants)

- **Hero de page** : aplat brun-noir `#3A2E33`, boutons blancs translucides — pas de bordeaux plein
- **KPI hero** : BLANC, liseré bordeaux, chiffre bordeaux (fini les gradients orange-violet)
- **Sidebar** : encre brune pleine, liseré droit 3px bordeaux, lien actif = fond translucide + liseré gauche, sous-titre beige
- **Bannières formations** (tones 0-9) : aplats des couleurs fonctionnelles
- **Avatars membres** : aplats (vert actif, rouge expiré, gris inactif) — plus de gradients
- **Cartes** : filet + fond blanc, lignes internes sur crème teinté `#F3EEE2`

---

## 🛠️ Le processus de design (la méthode qui a marché)

1. **Maquettes complètes** pour explorer (branche jetable `maquettes-design`)
2. **Comparatifs côte à côte** pour trancher : le MÊME composant en N palettes sur un écran — jamais itérer à l'aveugle
3. **Validation explicite de l'utilisateur** avant transposition (« J'ADORE » = feu vert)
4. **Transposition en 3 couches** : couleurs (`:root` + dark + hex en dur), puis archi (radius/ombres/hovers/marges), puis skin composant par composant
5. **Jugement en réel** avant merge — la maquette ment, l'écran dit la vérité

### Les pièges techniques rencontrés (leçons CI)
- Emojis en caractères directs, jamais en échappements `\U` dans les scripts
- Après réordonnancement de blocs HTML : vérifier l'équilibre des balises (fermeture orpheline = cartes hors grille)
- Après changement de fond d'un composant (sombre → clair) : vérifier TOUS les textes enfants (le bug « label blanc sur fond blanc »)
- `grep -c "couleur"` pour vérifier zéro résidu après une suppression de palette

---

## 📍 Références

- Maquettes : branche `maquettes-design` (jetable, jamais fusionnée) — la référence finale : `maquettes/H4-aerien-vert-rouge.html` (v5)
- Couleurs du site officiel (fournies par l'utilisateur) : `#9f0c45`, `#bbcc6a`, `#14171c`, `#ffffff`, `#eeeeee`
- PR d'application : #128 (couleurs) + PR archi (radius 6px, aplats, hovers matière)
- Historique du processus : 14 maquettes, 2 comparatifs, CONTEXT.md session nov. 2026
