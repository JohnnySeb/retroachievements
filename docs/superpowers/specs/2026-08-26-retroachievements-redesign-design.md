# Refonte RetroAchievements — Document de design

Date : 2026-08-26
Statut : validé le 2026-08-26

---

## 1. Objectif

Construire un site qui affiche sensiblement le même contenu que retroachievements.org,
avec une navigation et une esthétique refaites : mise en page contemporaine, identité
visuelle rétro assumée.

Le contenu vient de l'API publique RetroAchievements, en données réelles.

## 2. Analyse de l'existant

Source : dépôt open source `RetroAchievements/RAWeb` (React + Inertia), documentation
`api-docs.retroachievements.org`. Le site lui-même est protégé par une vérification
Cloudflare interactive qui n'a pas été contournée.

### Composition actuelle de la fiche jeu

`GameShowMainRoot` : média principal, conteneur de sets d'achievements, joueurs récents,
commentaires.

`GameShowSidebarRoot` empile onze modules sans hiérarchie : box art, avertissements de
contenu, métadonnées, boutons pleine largeur, statistiques de temps de jeu, hub de série,
jeux similaires, liste de hubs, comparaison de progression, distribution des déblocages,
top joueurs, leaderboards mis en avant.

### Composition actuelle du profil joueur

Avatar, motto, rang, points hardcore / softcore / true points, rich presence, jeux
récemment joués, awards, déblocages récents, progression de complétion, posts, abonnements.

### Problèmes retenus

1. **Sidebar fourre-tout.** Onze modules au même poids visuel : l'information utile se
   noie dans le bruit. Aucune priorisation entre « métadonnées du jeu » et « hubs ».
2. **Statut d'achievement illisible.** Verrouillé, débloqué softcore et débloqué hardcore
   ne se distinguent pas d'un coup d'œil dans des lignes denses.
3. **Recherche marginalisée.** Un champ étroit dans la barre du haut, des résultats en
   listes plates non groupées.
4. **Esthétique de forum du milieu des années 2000.** Gris plats, tableaux, densité
   uniforme. Les seuls éléments rétro sont les badges pixel eux-mêmes — et ils sont
   lissés à l'agrandissement, ce qui détruit le pixel art.
5. **Mobile = desktop compressé.** Pas de hiérarchie propre au petit écran.

## 3. Périmètre

### Dans le périmètre

| Page | Route | Contenu |
| --- | --- | --- |
| Accueil | `/` | Achievement of the Week, récompenses récentes, top 10 joueurs, entrées vers consoles |
| Recherche | `/search?q=` | Résultats groupés jeux / joueurs / consoles |
| Consoles | `/systems` | Grille des 55 systèmes actifs |
| Liste de jeux | `/systems/:systemId` | Jeux d'une console, triables et filtrables |
| Fiche jeu | `/games/:gameId` | Métadonnées, achievements, distribution, top joueurs, leaderboards, jeux similaires |
| Profil joueur | `/users/:username` | Identité, statistiques, activité, jeux, awards, achievements |
| Progression jeu/joueur | `/games/:gameId?user=:username` | Fiche jeu avec l'état de déblocage d'un joueur |
| Classements | `/leaderboards` | Top joueurs par points et true points |

### Hors périmètre (YAGNI)

Authentification, forums, messagerie, commentaires, tickets, claims de développeurs,
upload de captures, hubs, gestion de listes « want to play », téléchargements
d'émulateurs. Ces sections existent sur le site d'origine mais ne servent pas l'objectif
de refonte de navigation et d'esthétique, et plusieurs exigent une session authentifiée
que l'API publique ne fournit pas.

## 4. Architecture technique

### Contrainte fondatrice

L'API RetroAchievements exige une clé passée en query param `y` et **n'envoie pas
d'en-têtes CORS**. Un client navigateur ne peut donc pas l'appeler directement, et la clé
ne doit jamais atteindre le navigateur. Un proxy serveur est obligatoire, pas un confort.

### Arborescence

```
retroachievements/
├─ server/
│  ├─ index.ts             # bootstrap Hono, service des assets en prod
│  ├─ ra-client.ts         # appels API_*.php, retry, file d'attente sortante
│  ├─ cache.ts             # cache mémoire + persistance disque
│  ├─ search-index.ts      # construction et interrogation de l'index de jeux
│  └─ routes/
│     ├─ search.ts  systems.ts  games.ts  users.ts  leaderboards.ts  home.ts
├─ scripts/
│  └─ warm-index.ts        # construction hors ligne de l'index de recherche
├─ src/
│  ├─ main.ts  App.vue  router/
│  ├─ pages/               # une vue par route
│  ├─ components/          # PascalCase, une responsabilité
│  ├─ composables/         # useXxx.ts
│  ├─ stores/              # useXxxStore.ts (Pinia)
│  ├─ lib/                 # types API, helpers de formatage, URLs médias
│  └─ styles/main.css      # Tailwind v4 + tokens
├─ .cache/                 # index et réponses persistés (ignoré par git)
├─ .env                    # RA_API_KEY, PORT (ignoré par git)
└─ .env.example
```

### Serveur

Runtime Node, framework **Hono** (léger, typé, sert aussi les fichiers statiques).

Responsabilités :

- Détenir `RA_API_KEY` et l'injecter dans les appels sortants.
- Exposer une API interne **en camelCase** qui normalise le PascalCase incohérent de
  l'API RA (`ID`, `NumAwardedHardcore`, `type` en minuscule au milieu de champs
  capitalisés). Le client ne connaît jamais les formes d'origine.
- Mettre en cache agressivement. L'API RA est rate-limitée et sa documentation demande
  explicitement d'être économe.
- Sérialiser les appels sortants : file d'attente à concurrence 2, avec back-off
  exponentiel sur 429 et 5xx.

### Client

Vue 3 (Composition API, `<script setup>`), Vue Router 4, Pinia, Vite, Tailwind CSS v4 via
`@tailwindcss/vite`.

**TypeScript** dans les SFC : la convention maison impose `defineProps<{}>()`, qui exige
`lang="ts"`. Les types des réponses de l'API interne vivent dans `src/lib/types.ts` et
sont partagés avec le serveur.

Récupération de données : composable `useApi` bâti sur `fetch` + un cache de requêtes
Pinia, avec états `pending` / `error` / `data`. Pas de librairie de data-fetching
supplémentaire — le besoin est un GET, un cache et un état de chargement.

### Développement et production

En développement : `vite` sur 5173 et le serveur Hono sur 3001, Vite proxifie `/api` vers
3001. En production : `vite build` puis un seul process Node qui sert `dist/` et `/api`.

### Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `RA_API_KEY` | Clé Web API RetroAchievements |
| `PORT` | Port du serveur (défaut 3001) |

`.env` est en `.gitignore`, `.env.example` est versionné sans valeur.

## 5. Mapping de l'API

Chaque route interne agrège un ou plusieurs endpoints RA.

| Route interne | Endpoints RA | TTL cache |
| --- | --- | --- |
| `GET /api/home` | `API_GetAchievementOfTheWeek`, `API_GetRecentGameAwards`, `API_GetTopTenUsers` | 15 min |
| `GET /api/search?q=` | index local (voir §6) + `API_GetUserProfile` pour un match joueur exact | index 24 h |
| `GET /api/systems` | `API_GetConsoleIDs?a=1&g=1` | 24 h |
| `GET /api/systems/:id/games` | `API_GetGameList?i=&f=1` | 24 h, sur disque |
| `GET /api/games/:id` | `API_GetGameExtended?i=`, `API_GetAchievementDistribution?i=`, `API_GetGameRankAndScore?g=`, `API_GetGameLeaderboards?i=` | 1 h |
| `GET /api/games/:id/progress/:user` | `API_GetGameInfoAndUserProgress?g=&u=&a=1` | 5 min |
| `GET /api/users/:user` | `API_GetUserProfile`, `API_GetUserAwards`, `API_GetUserRecentlyPlayedGames?c=12` | 5 min |
| `GET /api/games/:id/extras` | `API_GetAchievementDistribution`, `API_GetGameRankAndScore`, `API_GetGameLeaderboards` | 1 h |
| `GET /api/users/:user/progress` | `API_GetUserCompletionProgress?c=500` | 5 min |
| `GET /api/users/:user/recent` | `API_GetUserRecentAchievements?m=10080` | 5 min |
| `GET /api/leaderboards` | `API_GetTopTenUsers` | 15 min |
| `GET /api/leaderboards/:id/entries` | `API_GetLeaderboardEntries?i=` | 15 min |

`API_GetUserSummary` n'est pas utilisé : sa propre documentation le signale comme lent et
sujet à sur-récupération. Les endpoints ciblés le remplacent.

### Conventions de médias (vérifiées)

Les champs `ImageIcon`, `ImageTitle`, `ImageIngame`, `ImageBoxArt`, `UserPic` retournent
des chemins relatifs. Base : `https://media.retroachievements.org`.

- Box art : `https://media.retroachievements.org` + `ImageBoxArt`
- Badge débloqué : `https://media.retroachievements.org/Badge/{BadgeName}.png`
- Badge verrouillé : `https://media.retroachievements.org/Badge/{BadgeName}_lock.png`
- Avatar : `https://media.retroachievements.org` + `UserPic`

Les icônes de console sont des URL absolues sur `static.retroachievements.org`.

Helper unique `mediaUrl()` dans `src/lib/media.ts` — aucune concaténation d'URL ailleurs.

## 6. Index de recherche

**L'API RA n'expose aucun endpoint de recherche.** La seule source exploitable est
`API_GetGameList?i=<systemId>&f=1`, qui retourne tous les jeux à achievements d'une
console.

Construction : `scripts/warm-index.ts` parcourt les 55 systèmes actifs, concurrence 2,
et écrit `.cache/game-index.json`. Chaque entrée est réduite aux champs utiles :

```
{ id, title, systemId, systemName, icon, numAchievements, points }
```

Volume réel mesuré après construction : **11 880 jeux, 1,8 Mo, en 21 secondes**. L'estimation
initiale de 25 000–30 000 jeux et « plusieurs minutes » était fausse — `f=1` ne retient que les
jeux possédant des achievements, ce qui élimine la majeure partie du catalogue. L'index reste en
mémoire serveur et n'est **jamais** envoyé au client.

Interrogation : normalisation (minuscules, suppression des diacritiques, retrait des
préfixes `~Hack~` / `~Homebrew~` pour le matching mais pas pour l'affichage), match par
sous-chaîne puis score de pertinence (préfixe exact > début de mot > sous-chaîne),
tri secondaire par nombre d'achievements. 30 résultats maximum.

Au démarrage, si `.cache/game-index.json` est absent, le serveur lance la construction en
tâche de fond et `/api/search` répond `503` avec `{ status: "indexing", progress }`.
L'interface affiche un état explicite. Pas de dégradation silencieuse.

La recherche de joueurs se fait par appel direct à `API_GetUserProfile?u=` : il n'existe
pas d'endpoint de recherche floue sur les utilisateurs, donc seul un pseudo exact
remonte. C'est une limite de l'API, documentée dans l'interface par un libellé
« pseudo exact ».

## 7. Système de design

Le rétro passe par la matière et la typographie, pas par des dégradés.

### Couleurs

| Rôle | Valeur |
| --- | --- |
| Fond | `#0A0C10` |
| Surface | `#12161D` |
| Surface élevée | `#1A1F28` |
| Bordure | `#232A35` |
| Texte primaire | `#E6EAF0` |
| Texte secondaire | `#8A94A6` |
| Phosphore — accent, hardcore | `#3DFF9E` |
| Ambre — points, softcore | `#FFB627` |
| Magenta — mastery, rareté extrême | `#FF3D81` |
| Cyan — liens, focus | `#4CC9F0` |

Déclarées en `@theme` Tailwind v4 dans `src/styles/main.css`.

### Typographie

- **Corps et titres** : une sans-serif condensée lisible. Une police bitmap sur des titres
  de jeux longs devient illisible — elle est écartée pour le texte courant.
- **Chiffres et données** : JetBrains Mono. C'est ce qui produit la lecture « terminal »
  et ce qui aligne les colonnes de points et de pourcentages.
- **Micro-labels** : police pixel (Press Start 2P) réservée aux étiquettes courtes —
  `HARDCORE`, `MASTERED`, `WIN`, valeurs de points sur les badges. Jamais plus de deux ou
  trois mots.

### Effets

- Ombres dures décalées `4px 4px 0` en `--color-border`, pas de flou. Lecture « cabinet »
  plutôt que material design.
- Scanlines en overlay CSS à 3 % d'opacité, **uniquement** sur les hero, jamais derrière
  du texte courant.
- `image-rendering: pixelated` sur tous les badges et icônes de jeu. C'est le détail le
  plus visible de la refonte : le site d'origine lisse le pixel art à l'agrandissement.
- Bordures 1px nettes, rayon 2px maximum.
- Focus visible sur toutes les cibles interactives, en cyan.

## 8. Navigation

La barre du haut passe d'une dizaine de liens à trois entrées plus une commande :
`Accueil · Consoles · Classements`, et un bouton de recherche déclenché aussi par
`⌘K` / `Ctrl+K`.

Il n'y a volontairement pas d'entrée « Jeux » ni « Joueurs » : l'API n'expose ni annuaire
de jeux global ni annuaire de joueurs. Les jeux se atteignent par console ou par
recherche, les joueurs par recherche ou par les classements. Une entrée de menu qui
mènerait à une page vide serait pire que son absence.

**Palette de recherche** : superposition plein écran, un seul champ, résultats groupés par
type (Jeux, Joueur, Consoles), navigation clavier complète (flèches, `Entrée`, `Échap`),
debounce 200 ms. C'est la réponse principale au reproche de navigation.

Sur mobile : barre d'onglets en bas, palette de recherche en plein écran.

Fil d'Ariane contextuel sur fiche jeu et profil.

## 9. Pages

### Accueil `/`

Hero court avec l'Achievement of the Week (badge en grand, jeu, points, date de fin).
Ligne de récompenses récentes (masteries fraîches, en flux horizontal). Top 10 joueurs en
tableau monospace. Grille d'accès aux consoles.

### Recherche `/search?q=`

Résultats groupés. Chaque jeu affiche icône pixel, titre, console, nombre d'achievements
et points. Le joueur, s'il existe, apparaît en tête dans une carte distincte. État vide
explicite, état « index en construction » distinct de l'état « aucun résultat ».

### Consoles `/systems` et `/systems/:id`

Grille des 55 systèmes avec icône et nombre de jeux. La liste d'une console est triable
(titre, nombre d'achievements, points) et filtrable par recherche locale.

### Fiche jeu `/games/:gameId`

**Hero** : `ImageIngame` en fond, assombri et flouté ; box art nette par-dessus ; titre ;
puce console ; ligne de métadonnées développeur / éditeur / genre / date de sortie ;
compteur de joueurs distincts.

**Barre de progression** : si un joueur est épinglé (voir §9 bis), une barre maîtresse
sous le hero affiche sa progression hardcore et softcore sur ce jeu.

**Liste d'achievements** — le cœur de la refonte :

- Bascule liste / grille.
- Filtres : tous, débloqués, verrouillés, progression, win condition, missable.
- Tris : ordre d'affichage, points, rareté, date de déblocage.
- Chaque entrée : badge pixel (verrouillé = variante `_lock`), titre, description,
  points en ambre, TrueRatio, barre de rareté avec le pourcentage de joueurs l'ayant
  débloqué.
- Statut lisible immédiatement : verrouillé = badge désaturé et bordure sourde,
  softcore = liseré ambre, hardcore = liseré phosphore.
- Les filtres persistent dans l'URL (`?filter=&sort=`), donc partageables.

**Sidebar réduite à trois blocs** : box art et métadonnées, distribution des déblocages
(histogramme), top joueurs. Jeux similaires et leaderboards descendent en sections sous
les achievements.

### 9 bis. Joueur épinglé

Sans authentification, le site ne sait pas qui consulte. Un « joueur épinglé » est stocké
en `localStorage` via un store Pinia : l'utilisateur saisit un pseudo une fois, et toutes
les fiches de jeu affichent alors sa progression. C'est ce qui rend la fonctionnalité
« ses achievements » utilisable sans compte.

### Profil joueur `/users/:username`

**Hero** : avatar, pseudo, motto, rang, membre depuis. Points hardcore et points softcore
en gros chiffres monospace. Rich presence affichée telle quelle si présente
(« PUP38/WAR19 on HorizonXI »).

**Ligne de statistiques** : points, true points, rang mondial, jeux maîtrisés,
achievements débloqués.

**Onglets** : Activité · Jeux · Awards · Achievements.

Le mur d'awards est **plafonné aux 60 plus récents**, le total réel restant affiché. Sans ce
plafond, un joueur comme MaxMilyin produit 2 152 awards, soit 430 Ko de JSON — inacceptable sur
mobile. Mesure réelle après plafonnement : 15 Ko.

- Activité : déblocages récents, groupés par jour, avec badge et jeu.
- Jeux : grille des jeux joués avec barre de progression et badge mastery. Filtrable par
  console, triable par progression ou date.
- Awards : mur de badges pixel, groupés par type (mastery, completion, beaten hardcore,
  beaten softcore, site awards).
- Achievements : liste plate des déblocages, filtrable et triable comme sur la fiche jeu.

### Classements `/leaderboards`

Top joueurs en tableau monospace, colonnes rang / joueur / points / true points, avec un
traitement visuel distinct des trois premiers.

## 10. Mobile — priorité de conception

Le mobile est le contexte d'usage principal attendu. Chaque page est conçue et
implémentée à 375 px **d'abord**, puis élargie. Une vue n'est considérée terminée que
lorsqu'elle est correcte en petit écran ; le desktop n'est jamais le point de départ.

### Navigation

Barre d'onglets fixe en bas — `Accueil · Consoles · Classements · Rechercher` — dans la
zone atteignable au pouce, avec `padding-bottom: env(safe-area-inset-bottom)` pour les
encoches et barres système iOS. La barre du haut se réduit au logo et au fil d'Ariane.

L'indice `⌘K` est masqué sur pointeur grossier (`@media (pointer: coarse)`) : il n'a aucun
sens sans clavier. La recherche s'ouvre en feuille plein écran, champ auto-focus.

### Adaptations par vue

| Vue | Comportement en petit écran |
| --- | --- |
| Hero jeu | Empilé : box art 96 px puis titre puis métadonnées. Titre limité à 2 lignes (`line-clamp`). Métadonnées en rangée de puces défilable horizontalement. |
| Barre de progression | Pleine largeur sous le hero, légende hardcore/softcore repliée sous la barre. |
| Liste d'achievements | Une colonne. Badge 48 px, description limitée à 2 lignes, points alignés en haut à droite. |
| Filtres | Rangée de puces défilable horizontalement, **collante** sous l'en-tête au défilement — c'est la commande la plus utilisée de la page. |
| Sidebar jeu | Devient des sections sous les achievements, dans l'ordre : métadonnées, distribution, top joueurs. |
| Stats joueur | Grille 2 colonnes au lieu de 5. |
| Onglets profil | Contrôle segmenté défilable horizontalement, onglet actif ramené dans le champ de vision. |
| Classements | Sous 640 px, le tableau devient des cartes empilées. Aucun tableau ne déborde jamais horizontalement de la page. |

### Règles transverses

- Cibles tactiles de 44 px minimum, y compris les puces de filtre.
- Tout conteneur large (tableau, histogramme de distribution) défile dans son propre
  `overflow-x: auto` — le `body` ne défile jamais horizontalement.
- `width` et `height` explicites sur toutes les images pour éviter les sauts de mise en
  page au chargement, `loading="lazy"` sous la ligne de flottaison.
- Squelettes de chargement calibrés sur la hauteur réelle du contenu, pour la même raison.
- Les effets décoratifs (scanlines, ombres portées) sont conservés — ils ne coûtent rien —
  mais désactivés sous `prefers-reduced-motion`.
- Classes Tailwind écrites en ordre mobile-first, sans préfixe pour le petit écran et
  `sm:` / `md:` / `lg:` pour élargir.

### Vérification

Chaque vue est contrôlée par capture à **375 px** (iPhone SE / mini), **390 px**
(iPhone standard) et **430 px** (Pro Max) avant d'être déclarée terminée, et au moins une
fois en orientation paysage. Le contrôle desktop vient après, pas avant.

## 11. États et erreurs

Chaque vue gère explicitement quatre états : chargement (squelettes calibrés sur la
forme réelle du contenu, pas un spinner), succès, vide, erreur.

Erreurs distinguées côté serveur et remontées au client avec un code :

| Cas | Traitement |
| --- | --- |
| Clé API absente ou invalide | Bandeau global explicite : la configuration est en cause, pas le réseau |
| 429 rate limit | Back-off exponentiel, jusqu'à 3 tentatives, puis message « API saturée, réessayez » |
| Jeu ou joueur inexistant | 404 applicatif avec état vide dédié et retour vers la recherche. L'API RA répond en **HTTP 404** pour un pseudo inconnu, pas avec un objet vide : `fetchRaOrNull` traduit ce cas en absence plutôt qu'en panne |
| Index non construit | 503 `{ status: "indexing" }`, interface dédiée avec progression |
| Timeout amont | 504, proposition de réessayer, cache périmé servi si disponible |

Le cache sert une valeur périmée plutôt que rien lorsque l'amont échoue, avec une mention
« données du {date} ».

## 12. Accessibilité

- Contrastes calculés sur la surface `#12161D` : texte secondaire `#8A94A6` 5.93:1,
  texte primaire `#E6EAF0` 15.02:1, phosphore 13.81:1, ambre 10.34:1, magenta 5.38:1,
  cyan 9.43:1. Toutes les paires passent WCAG AA en texte normal.
- La couleur ne porte jamais seule l'information de statut : un badge verrouillé porte
  aussi une icône de cadenas et un `aria-label`.
- Palette de recherche : rôle `combobox`, `aria-activedescendant`, piège de focus, `Échap`
  ferme.
- Toutes les images de badge ont un `alt` décrivant l'achievement.
- Les scanlines et effets décoratifs sont désactivés sous `prefers-reduced-motion` et
  portent `aria-hidden`.

## 13. Tests

- **Serveur** : Vitest sur `ra-client` (normalisation PascalCase → camelCase, back-off,
  file d'attente), `cache` (TTL, service de valeur périmée), `search-index`
  (normalisation, ordre de pertinence). Appels HTTP amont mockés.
- **Client** : Vitest + Testing Library sur les composables (`useApi`) et les composants
  porteurs de logique (filtres et tri de la liste d'achievements, palette de recherche).
- **Intégration** : un test par route interne, avec réponses RA figées en fixtures
  capturées depuis l'API réelle.

Développement en TDD : test rouge, implémentation, vert.

## 14. Décisions écartées

| Option | Raison du rejet |
| --- | --- |
| Fixtures statiques seules | L'utilisateur a demandé les données réelles |
| Laravel + Inertia | Stack Vue + Vite retenue ; le proxy ne justifie pas un framework PHP |
| Index de recherche envoyé au client | 4 Mo au chargement, inacceptable |
| `API_GetUserSummary` | Documenté comme lent et sur-récupérant |
| Police bitmap pour le texte courant | Illisible sur les titres de jeux longs |
| Authentification RA | L'API publique ne la fournit pas ; le joueur épinglé couvre le besoin |
