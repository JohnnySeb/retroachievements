# RetroAchievements — refonte

Refonte de la navigation et de l'esthétique de retroachievements.org. Mêmes données, servies par
l'API publique RetroAchievements, avec une mise en page contemporaine et une identité visuelle
rétro assumée.

Conçu mobile d'abord : chaque vue est construite et vérifiée à 375 px avant toute largeur
supérieure.

L'interface est **en anglais**, formatage des nombres et des dates compris (locale `en-US`). Seuls
ce README et la documentation dans `docs/` sont en français.

## Prérequis

- Node 20 ou plus
- Une clé Web API RetroAchievements, disponible dans les paramètres de votre compte sur
  retroachievements.org

## Installation

```bash
npm install
cp .env.example .env
```

Renseignez `RA_API_KEY` dans `.env`. Ce fichier est ignoré par git et ne doit jamais être
commité.

## Construire l'index de recherche

L'API RetroAchievements **n'expose aucun endpoint de recherche**. La seule source exploitable est
`API_GetGameList`, qui retourne les jeux d'une console. Un index local est donc construit une fois
depuis les 55 systèmes actifs :

```bash
npm run warm
```

Environ 21 secondes, 56 appels à l'API, pour 11 880 jeux et 1,8 Mo écrits dans
`.cache/game-index.json`. L'index reste en mémoire côté serveur et n'est jamais envoyé au
navigateur. Sans lui, `/api/search` répond 503 avec un état « indexation » explicite plutôt que de
renvoyer silencieusement une liste vide.

Les données de jeux étant quasi statiques, cette commande n'est à relancer que de loin en loin.

## Développement

```bash
npm run dev
```

Vite sur `:5173`, serveur Hono sur `:3001`, avec proxy de `/api`.

## Production

```bash
npm run build
npm run start
```

Un seul process Node sert `dist/` et `/api` sur `:3001`.

## Domaine local (.test)

Ce projet n'a **pas de docroot à servir en statique**. Un serveur de fichiers classique — Valet,
Herd, `php -S` — renvoie `src/main.ts` avec le type MIME `video/mp2t`, car l'extension `.ts` est
enregistrée pour MPEG Transport Stream. Le navigateur refuse le module et la page reste blanche.
Corriger le type MIME ne suffirait pas : le fichier reste du TypeScript avec des imports nus que
le navigateur ne sait pas résoudre.

Pour utiliser un domaine `.test`, il faut proxifier vers le serveur, pas servir le dossier :

```bash
valet proxy retroachievements http://localhost:5173
```

Pointez sur `:5173` pour développer avec le rechargement à chaud, ou sur `:3001` pour tester le
build de production. Sur Herd, la même chose se configure dans l'onglet Sites.

## Déploiement

Le fichier [`render.yaml`](render.yaml) décrit le service. Sur Render : *New → Blueprint*, pointez
sur le dépôt, puis renseignez `RA_API_KEY` dans les variables d'environnement — elle est marquée
`sync: false` et n'est donc jamais versionnée.

Un **process persistant est requis**, pas du serverless. Le cache est une `Map` en mémoire de
process ; sur des fonctions serverless, chaque démarrage à froid repartirait d'un cache vide et
refrapperait l'API RetroAchievements, ce que sa documentation demande explicitement d'éviter.

Le serveur n'écrit rien sur disque au service des requêtes, donc aucun disque persistant payant
n'est nécessaire.

### Fraîcheur des données une fois en ligne

Les données se rafraîchissent seules dans la limite des durées de vie du cache : 5 min pour un
profil joueur, 15 min pour l'accueil et les classements, 1 h pour une fiche de jeu, 24 h pour les
listes de consoles et de jeux.

L'index de recherche, lui, est reconstruit **par le serveur lui-même** : au démarrage s'il est
absent, puis toutes les 24 h. Aucun redéploiement n'est nécessaire pour que les nouveaux jeux
deviennent trouvables.

Conséquence sur l'offre gratuite de Render : le système de fichiers est éphémère et le service
s'endort après inactivité. L'index disparaît donc à chaque réveil et se reconstruit — environ
21 secondes pendant lesquelles `/api/search` répond 503 avec un état « Search index not built »
explicite et sa progression. Le reste du site fonctionne normalement pendant ce temps. Sur une
offre payante, le service reste éveillé et l'index n'est reconstruit qu'une fois par jour.

## Tests

```bash
npm test
```

## Architecture

```
server/     Proxy Hono : détient la clé API, normalise le PascalCase de l'API RA
            en camelCase, met en cache et limite les appels sortants
scripts/    Construction hors ligne de l'index de recherche
src/        Client Vue 3 (Composition API, <script setup>), Vue Router, Pinia, Tailwind v4
docs/       Spec de design, plan d'implémentation, passe de vérification mobile
```

Le proxy n'est pas un confort : l'API RetroAchievements exige une clé en query param et n'envoie
aucun en-tête CORS. Un client navigateur ne peut donc pas l'appeler directement, et la clé ne doit
jamais atteindre le navigateur.

### Cache

L'API est limitée en débit et sa documentation demande explicitement d'être économe. Durées de
vie : consoles et listes de jeux 24 h, fiche de jeu 1 h, classements 15 min, données joueur 5 min.
Quand l'amont échoue, une valeur périmée est servie plutôt qu'une page en erreur, et l'interface
affiche la date de récupération.

## Limites connues

Elles viennent de l'API publique, pas du code.

- **La recherche de joueur exige le pseudo exact.** Il n'existe aucun endpoint de recherche floue
  sur les utilisateurs.
- **Aucun rang global.** `API_GetUserProfile` ne renvoie pas de champ `Rank` ; le rang n'est donc
  pas affiché sur les profils.
- **Aucun jeu similaire.** L'API n'expose pas cette donnée ; la section a été retirée du
  périmètre.
- **Liste de jeux d'un joueur plafonnée à 500 entrées** par l'API. Le total réel est affiché à
  côté.
- **Mur d'awards plafonné à 60 entrées** côté serveur : un joueur comme MaxMilyin en a 2 152, soit
  430 Ko de JSON. Le total réel est affiché.
- **Classement de recherche sans signal de popularité.** Les sorties officielles passent avant les
  ROM hacks et les sous-ensembles, puis le départage se fait sur la longueur du titre, faute de
  meilleure métrique dans `API_GetGameList`.

## Documentation

- [Spec de design](docs/superpowers/specs/2026-08-26-retroachievements-redesign-design.md)
- [Plan d'implémentation](docs/superpowers/plans/2026-08-26-retroachievements-redesign.md)
- [Passe de vérification mobile et accessibilité](docs/mobile-check.md)
- [Planche de style](docs/style-tile.html)
