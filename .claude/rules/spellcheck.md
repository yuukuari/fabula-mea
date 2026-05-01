---
paths:
  - "src/lib/spellcheck-extension.ts"
  - "src/lib/nspell-instance.ts"
  - "src/types/nspell.d.ts"
  - "public/dictionaries/**"
---

# Correcteur orthographique hybride + menu contextuel

## Deux couches

1. **Orthographe** — `nspell` (Hunspell JS), dictionnaire FR (`/dictionaries/fr.aff` + `fr.dic`). Vérification locale, instantanée, hors-ligne. Soulignement rouge ondulé.
2. **Grammaire** — LanguageTool API, envoi uniquement du paragraphe modifié (détection par hash). Soulignement bleu/violet. Catégories TYPOS/TYPOGRAPHY/STYLE/CASING et règles `FR_SPELLING_RULE`/`HUNSPELL_RULE`/`MORFOLOGIK_RULE_FR` désactivées côté LT (nspell gère l'orthographe).

## Dictionnaire personnalisé

`BookProject.customDictionary?: string[]`. Ajout via « Ajouter au dictionnaire » dans la popup de suggestions. Pré-remplissage automatique avec noms de personnages (name, surname, nickname), lieux (name) et notes univers (title) via `getCustomWords()` (ref dynamique).

## Menu contextuel (clic droit)

Architecture multi-niveaux avec navigation avant/arrière. Remplace le menu natif du navigateur.
- **Sur un mot** : couper/copier/coller, correction (suggestions, ignorer, ajouter), outils d'écriture, rechercher Wikipédia/internet
- **Sélection multi-mots** : couper/copier/coller, outils d'écriture, rechercher internet
- **Outils d'écriture** : casse (MAJ/min), définition, conjugaison, étymologie, champ lexical (CNRTL), synonymes/antonymes (inline scrappé CNRTL — clic sur la ligne = remplace, icône copier seule à droite avec `stopPropagation`)
- **Menu natif** : `⌘+clic droit` (Mac) / `Ctrl+clic droit` (PC)

## Implémentation

ProseMirror Plugin (`handleDOMEvents.contextmenu`), DOM vanilla (pas React), positionnement dynamique avec overflow protection, guard `menuOpenedAt` (300ms).

**Dépendances** : `nspell`, `dictionary-fr`
