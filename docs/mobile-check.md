# Passe de vérification mobile et accessibilité

Date : 2026-08-26
Build vérifié : production (`npm run build` puis `npm run start`, servi par Hono sur `:3001`)

## Méthode

Chaque route a été chargée dans un navigateur réel aux largeurs 375, 390 et 430 px, puis en
paysage 812 × 375. Deux mesures automatiques ont été exécutées dans la page :

```js
// 1. Débordement horizontal du document
document.documentElement.scrollWidth <= document.documentElement.clientWidth

// 2. Cibles interactives sous 44 px de haut
[...document.querySelectorAll('a,button,select,input')]
  .filter((el) => { const r = el.getBoundingClientRect(); return r.height > 0 && r.height < 44 })
```

Les éléments descendant d'un conteneur `overflow-x-auto` ou `overflow-hidden` sont exclus du
comptage : leur débordement est intentionnel et clippé.

## Résultats

| Route | 375 px | 390 px | 430 px | Cibles < 44 px |
| --- | --- | --- | --- | --- |
| `/` | OK | OK | OK | 0 |
| `/systems` | OK | OK | OK | 0 |
| `/systems/12` | OK | OK | OK | 0 |
| `/games/1` | OK | OK | OK | 0 |
| `/users/MaxMilyin` | OK | OK | OK | 0 |
| `/search?q=sonic` | OK | OK | OK | 0 |
| `/nimportequoi` (404) | OK | OK | OK | 0 |

Paysage 812 × 375 : la barre d'onglets basse disparaît au profit de la navigation haute
(le point de rupture `md` est franchi), donc aucune hauteur n'est consommée en paysage.

## Défauts trouvés et corrigés

**Conteneurs `grid` sans colonnes explicites.** Neuf fichiers utilisaient `class="grid gap-2"`.
Une colonne implicite est dimensionnée `auto` et grandit avec son contenu, ce qui rend `truncate`
inopérant : la page débordait à 689 px pour une fenêtre de 375. Remplacé par `grid-cols-1`
(`minmax(0, 1fr)`), qui autorise le rétrécissement. C'est le défaut le plus coûteux de la passe,
et il était invisible sur desktop.

**Cibles tactiles sous 44 px.** Les liens de pseudo dans les classements, le top 10 de l'accueil,
la liste des top joueurs et le logo étaient des liens inline : la zone tappable se limitait à la
hauteur de ligne, environ 24 px. Passés en `flex min-h-11 items-center`.

**Barre de filtres collante mal calée.** `top-14` ne tenait pas compte du 1 px de bordure basse
de l'en-tête, si bien que la rangée de filtres passait sous le header au défilement. Corrigé en
`top-[57px]` / `md:top-[61px]`.

**Puce console surdimensionnée.** Le `min-h-11` appliqué à un lien bordé produisait un grand
rectangle vide autour d'un texte court. Le lien reste haut de 44 px mais sans bordure ni fond,
en cyan : la cible est conservée, l'encombrement visuel disparaît.

**Métadonnées du jeu en bande défilante.** Cinq informations courtes dans un `overflow-x-auto`
donnaient l'impression d'un texte coupé. Passées en grille 2 colonnes sous `sm`, flex au-delà.

**Grille de statistiques trouée.** Cinq cellules sur deux colonnes laissaient un vide en bas à
droite. La dernière cellule occupe désormais les deux colonnes sous `sm`.

## Accessibilité

- **La couleur ne porte jamais seule l'état.** Un achievement affiche son état en texte
  (`HARDCORE` / `SOFTCORE` / `LOCKED`) en plus du liseré coloré et du badge désaturé. Vérifiable
  en simulant l'achromatopsie : les trois états restent distinguables.
- **Contrastes** calculés sur la surface `#12161D` : texte secondaire 5.93:1, texte primaire
  15.02:1, phosphore 13.81:1, ambre 10.34:1, magenta 5.38:1, cyan 9.43:1. Toutes les paires
  passent WCAG AA en texte normal.
- **Mouvement réduit** : présent dans le CSS livré —
  `@media (prefers-reduced-motion:reduce){.scanlines{display:none}.animate-pulse{animation:none}}`.
- **Indice clavier** : `@media (pointer:coarse){.kbd-hint{display:none}}` masque `⌘K` sur écran
  tactile, où il n'a aucun sens.
- **Pixel art** : `image-rendering: pixelated` présent dans le CSS livré, appliqué à tous les
  badges et icônes de jeu.
- La palette de recherche porte `role="dialog"`, `aria-modal="true"`, le champ est un
  `combobox`, `Échap` la ferme, et le focus est piégé : `Tab` sur la dernière cible revient à la
  première, `Shift+Tab` sur la première va à la dernière.
- L'histogramme de distribution donne un `aria-label` par barre.
- Les barres de progression portent `role="progressbar"` avec `aria-valuenow`.

## Points ouverts

**Le classement de recherche n'a pas de signal de popularité.** À score de correspondance égal
et à statut égal (sortie officielle contre ROM hack), le départage se fait sur la longueur du
titre. « Sonic R » remonte donc avant « Sonic the Hedgehog ». `API_GetGameList` n'expose ni
nombre de joueurs ni popularité ; aucune métrique n'a été inventée pour combler ce manque.

**Zone sûre iOS non vérifiée sur appareil.** `viewport-fit=cover` est en place et la barre
d'onglets porte `pb-[env(safe-area-inset-bottom)]`, mais le rendu n'a pas été contrôlé sur un
iPhone à encoche réel — seulement sur un navigateur de bureau en viewport émulé.
