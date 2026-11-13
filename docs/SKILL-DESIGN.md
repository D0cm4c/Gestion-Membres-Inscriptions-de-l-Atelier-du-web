# SKILL-DESIGN — Bibliothèque de thèmes de l'Atelier du Web

> **Comment utiliser ce skill** : ce fichier est la **collection de thèmes** du projet — comme des thèmes WordPress. Chaque thème est un **style graphique complet** : sa palette, sa typographie, ses formes, son ambiance, ses règles d'archi. Un design = un THÈME appliqué sur les 3 couches (couleur, archi CSS, skin).
>
> Toute session design : 1) lit ce fichier, 2) identifie le thème actif, 3) s'y conforme OU crée/étoffe une fiche thème avec validation de l'utilisateur.
>
> **Thème actif : 🌅 Crème-charte** (appliqué en prod, PR #128 + #129)

---

## 🌅 THÈME 1 : Crème-charte — *corporate chaleureux* ⭐ ACTIF

**L'histoire** : la chaleur d'un accueil associatif, la rigueur d'un outil pro. L'identité du site en filigrane.

| | |
|---|---|
| **Genre** | Corporate chaleureux, aérien |
| **Typo** | Inter (400-700) |
| **Formes** | Coins 6px max (cartes) / 3-4px (petits blocs) — jamais plus |
| **Bordures** | Filets 1px beige — les cartes existent par leur contour, pas leur ombre |
| **Ombres** | Quasi zéro (une très légère sur le hero) — hover = matière (bordure), pas position |
| **Dégradés** | ZÉRO — tout aplat |
| **Marge** | Cartes 1.05rem 1.15rem, resserrées, max-width 1440px |

**Palette (chaque couleur a UN métier)** :
```
Crème #F7F3EA (fond/chaleur) · Blanc #FFFFFF (surfaces/air) · Encre #2B2226 + Brun-noir #3A2E33 (structure)
Beiges #D9CDB8/#C4B49A (liserés, texte sur brun) · Filet #E5DCC8
Bordeaux #9f0c45 (IDENTITÉ — micro-doses : liserés, chiffre hero, badge)
Lime #bbcc6a (POSITIF — KPI nouveaux, Ouvert, Attente) · Lime texte #8FA344 (contraste)
Rouge #D8434B (ATTENTION — alertes) · Fonctionnels : violet/bleu/vert/ambre (statuts)
```
**Dark mode** : bruns chauds sombres (#171216/#1A161A/#252025), accent beige, primary rosé #E8A0BC — jamais de bleu nuit.
**Référence** : `maquettes/H4-aerien-vert-rouge.html` (v5) — validé « J'ADORE ».
**Leçons du thème** : charte vitrine ≠ app (bordeaux micro-doses) · le lime exige un brun dessous · contraste d'abord (lime foncé pour le texte).

---

## 🧱 THÈME 2 : Brutalist — *néobrutalisme fun*

**L'histoire** : l'EPN qui assume sa personnalité — direct, tactile, mémorable.

| | |
|---|---|
| **Genre** | Néobrutalisme |
| **Typo** | Space Grotesk (500-700), titres UPPERCASE |
| **Formes** | Coins **0** — tout est rectangle brut |
| **Bordures** | **3px noir épaisses** partout |
| **Ombres** | **Dures et décalées** (`6px 6px 0 noir`) — pas de flou |
| **Hover** | Translate(-2px,-2px) + ombre qui pousse — l'objet « bouge » physiquement |
| **Marge** | Généreuse, blocs colorés pleins |

**Palette** :
```
Jaune crème #FFF8E7 (fond) · Noir #111111 (bordures, texte)
Punchy : rose #FF5D8F · bleu électrique #4D7CFE · lime #B8F135 · jaune soleil #FFC900
KPI = blocs de couleur pleine · tags = bordés 2px noir
```
**Référence** : `maquettes/1-neobrutalisme.html`.

---

## 🌻 THÈME 3 : Solarpunk — *coopérative verte*

**L'histoire** : l'utopie verte et locale — valeurs écologie, entraide, quartier.

| | |
|---|---|
| **Genre** | Solarpunk / corporate doux |
| **Typo** | Nunito (600-800) — ronde, amicale |
| **Formes** | Coins **très arrondis** (16-30px, pilules 999px) |
| **Bordures** | Filets fins + halos de couleurs douces en fond |
| **Ombres** | Douces et diffuses |
| **Marge** | Généreuse, tout respire |

**Palette** :
```
Beige terre #F5EFE0 (fond) · Vert forêt #2D5A3D (sidebar, titres)
Mousse #8FBF7A · Soleil #F2B84B · Terracotta #D98E5F · Encre verte #23331F
Boutons pilules, badges ronds, rangs en cercles
```
**Variante corporate** (4b, le coup de cœur initial) : coins 3-6px, marges resserrées, typo Inter, ocre plus sobre — voir `maquettes/4b-solarpunk-corporate.html` et `4e-solarpunk-chaud.html`.

---

## 🖥️ THÈME 4 : Terminal — *le geek assumé*

**L'histoire** : un EPN du web qui ressemble à ce que ses usagers imaginent — l'outil des hackers bienveillants.

| | |
|---|---|
| **Genre** | Rétro-informatique |
| **Typo** | IBM Plex Mono — monospace intégral |
| **Formes** | Coins 0, panneaux à filets 1px grille |
| **Texture** | Scanlines subtiles (repeating-linear-gradient sur overlay) |
| **Titres** | Commandes : `agenda --today`, `waitlist --top`, prompt `adw:~$` |

**Palette** :
```
Fond #0A0E0A (noir vert profond) · Phosphore #33FF66 (texte) · Dim #1E9944
Ambre #FFB000 (alertes) · Cyan #00D4FF (liens/KPI)
```
**Référence** : `maquettes/2-terminal.html`.

---

## 📰 THÈME 5 : Éditorial — *le journal de l'Atelier*

**L'histoire** : l'app se lit comme un imprimé — cohérente avec la feuille de séance papier.

| | |
|---|---|
| **Genre** | Presse / magazine |
| **Typo** | Fraunces serif (titres, 600-900) + Libre Franklin (corps) |
| **Formes** | Filets simples et **doubles** (masthead), aucune boîte — le contenu structure |
| **Ornement** | Lettrine vermillon sur le premier paragraphe, chiffres oldstyle |
| **Sections** | En articles : « Aujourd'hui », « Les plus attendues », « Dernières brèves » |

**Palette** :
```
Crème papier #FAF6EE · Encre chaude #1C1917 · Gris encre #6B6459
Vermillon #D93A2B (accents, lettrine) · Olive #6B7A3A (positif)
```
**Référence** : `maquettes/3-editorial.html`.

---

## 🎨 THÈME 6 : Claymorphism — *la pâte à modeler*

Pastel bombé 3D douce (lavande/pêche/menthe), ombres internes+externes, ambiance Duolingo — `maquettes/5-claymorphism.html`.

## 📐 THÈME 7 : Swiss — *l'affiche Bauhaus*

Noir/blanc/rouge `#E63329`, typo Inter 900 **géante** (titres 3.4rem, KPI 3.2rem), grille stricte, zéro décoration — `maquettes/6-swiss.html`.

## 🗒️ THÈME 8 : Neo-sobre — *l'invisible parfait*

Gris chauds, zéro bordure, whitespace maximal, hiérarchie pure par la typo — le calme Notion/Linear — `maquettes/7-neo-sobre.html`.

---

## 🛠️ Le processus de design (valable pour tout thème)

1. **Maquette complète** du thème (branche `maquettes-design`)
2. **Comparatif côte à côte** : le même composant en N thèmes sur un écran — jamais trancher à l'aveugle
3. **Validation explicite** de l'utilisateur
4. **Application en 3 couches** : couleur (`:root` + dark + hex en dur) → archi (radius/ombres/hovers/marges/dégradés) → skin (composants)
5. **Jugement en réel** avant merge

### Pièges techniques (leçons CI)
- Emojis en caractères directs, jamais en échappements dans les scripts
- Équilibre des balises après réordonnancement HTML (fermeture orpheline = cartes hors grille)
- Fond changé (sombre→clair) = vérifier TOUS les textes enfants (le label blanc sur blanc)
- `grep -c` pour vérifier zéro résidu (gradients, couleurs bannies)

### Perspective : un switcher de thème
La structure est prête pour un **sélecteur de thème** (comme WordPress — Paramètres → Apparence) : chaque thème = un bloc de variables CSS (`[data-skin="brutalist"] { --bg: ...; --radius: 0; ... }`). Toutes les maquettes existantes fournissent déjà les valeurs. À faire quand l'utilisateur le demande.
