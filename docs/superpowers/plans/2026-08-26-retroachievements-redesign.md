# Refonte RetroAchievements — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire un site qui affiche le contenu de RetroAchievements (recherche, fiche jeu + achievements, profil joueur, consoles, classements) avec une navigation et une esthétique refaites, en données réelles via l'API publique.

**Architecture:** Un proxy Hono côté serveur détient la clé API, normalise le PascalCase de l'API RA en camelCase et met en cache agressivement ; un client Vue 3 + Vite + Tailwind v4 consomme cette API interne. Un index de recherche est construit hors ligne depuis `API_GetGameList` parce que l'API RA n'expose aucun endpoint de recherche.

**Tech Stack:** Node 20+, TypeScript ESM, Hono, `@hono/node-server`, Vue 3.5, Vue Router 4, Pinia, Vite 6, Tailwind CSS v4 (`@tailwindcss/vite`), Vitest, `@vue/test-utils`, `tsx`, `concurrently`.

**Spec:** [`docs/superpowers/specs/2026-08-26-retroachievements-redesign-design.md`](../specs/2026-08-26-retroachievements-redesign-design.md)

## Global Constraints

Ces contraintes s'appliquent à **toutes** les tâches. Elles ne sont pas répétées ensuite.

- **Mobile d'abord, sans exception.** Chaque vue est construite et vérifiée à 375 px avant toute largeur supérieure. Classes Tailwind sans préfixe pour le petit écran, `sm:` / `md:` / `lg:` pour élargir. Une vue n'est terminée que si elle est correcte à 375 px, 390 px et 430 px.
- **Langue.** Code, variables, fonctions, classes, noms de fichiers, classes CSS → anglais. **Textes d'interface → anglais** également, ainsi que les messages d'erreur de l'API interne. Le formatage des nombres et des dates utilise la locale `en-US` (`491,867`, `June 11, 1991`, `66%`). Seuls le README et la documentation dans `docs/` restent en français.
- **La police pixel (Press Start 2P) n'a aucune capitale accentuée.** Aucun micro-label ne contient d'accent. Maximum 3 mots.
- **Secrets.** `RA_API_KEY` ne quitte jamais le serveur. Aucune clé en dur, jamais dans `src/`. Toute lecture passe par `server/env.ts`.
- **Commentaires** uniquement sur le POURQUOI non évident. Jamais de commentaire décrivant ce que le code fait.
- **Composants** : `<script setup lang="ts">`, `defineProps<{}>()`, `defineEmits<{}>()`. Un composant = une responsabilité. Au-delà de ~150 lignes, découper.
- **Composables** : `src/composables/useXxx.ts`, retournent des refs et des fonctions, nettoient leurs listeners dans `onUnmounted`.
- **Stores Pinia** : `src/stores/useXxxStore.ts`, uniquement pour l'état partagé entre plusieurs composants.
- **Imports triés** : Vue d'abord, puis librairies externes, puis imports internes.
- **`const` par défaut**, `let` si réassignation, jamais `var`.
- **Git** : ne jamais commiter sans demande explicite de l'utilisateur. Les étapes « Commit » de ce plan sont donc à exécuter **uniquement** si l'utilisateur a autorisé les commits pour cette session ; sinon, laisser les changements dans l'arbre de travail et le signaler.
- **Tokens de couleur** (verbatim) : fond `#0A0C10`, surface `#12161D`, surface élevée `#1A1F28`, bordure `#232A35`, texte `#E6EAF0`, secondaire `#8A94A6`, phosphore `#3DFF9E`, ambre `#FFB627`, magenta `#FF3D81`, cyan `#4CC9F0`.
- **Base média** : `https://media.retroachievements.org`. Badge débloqué `/Badge/{badgeName}.png`, verrouillé `/Badge/{badgeName}_lock.png`.
- **Cibles tactiles** : 44 px minimum. Aucun débordement horizontal du `body`.

## Structure des fichiers

| Fichier | Responsabilité |
| --- | --- |
| `server/env.ts` | Charge et valide `RA_API_KEY` et `PORT`. Seul point de lecture des secrets. |
| `server/ra-client.ts` | Appelle `API_*.php`. File d'attente concurrence 2, back-off sur 429/5xx. |
| `server/normalize.ts` | Convertit les réponses RA PascalCase en types internes camelCase. |
| `server/cache.ts` | `cached(key, ttlMs, fn)`. Mémoire + disque, sert le périmé si l'amont échoue. |
| `server/search-index.ts` | Construit, persiste et interroge l'index de jeux. |
| `server/routes/*.ts` | Une route interne par fichier. |
| `server/index.ts` | Assemble Hono, monte les routes, sert `dist/` en production. |
| `scripts/warm-index.ts` | Construction hors ligne de l'index (`npm run warm`). |
| `src/lib/types.ts` | Types partagés serveur/client. Source de vérité des contrats. |
| `src/lib/media.ts` | `mediaUrl()`, `badgeUrl()`. Aucune concaténation d'URL ailleurs. |
| `src/lib/format.ts` | Formatage nombres, dates, pourcentages. |
| `src/composables/useApi.ts` | GET vers l'API interne avec états `pending` / `error` / `data`. |
| `src/stores/usePinnedPlayerStore.ts` | Joueur épinglé, persisté en `localStorage`. |
| `src/components/*.vue` | Composants d'affichage, une responsabilité chacun. |
| `src/pages/*.vue` | Une vue par route. |
| `src/router/index.ts` | Définition des routes. |
| `src/styles/main.css` | Tailwind v4, `@theme` avec les tokens, utilitaires de base. |

---

## Task 1: Squelette du projet, tokens et outillage de test

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`
- Create: `src/main.ts`, `src/App.vue`, `src/styles/main.css`
- Create: `src/lib/format.ts`
- Test: `src/lib/format.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `formatNumber(n: number): string`, `formatPercent(n: number, digits?: number): string`, `formatDate(iso: string | null): string`. Scripts npm `dev`, `build`, `start`, `warm`, `test`.

- [ ] **Step 1: Créer `package.json`**

```json
{
  "name": "retroachievements-redesign",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "concurrently -n web,api -c cyan,green \"vite\" \"tsx watch server/index.ts\"",
    "build": "vue-tsc --noEmit && vite build",
    "start": "tsx server/index.ts",
    "warm": "tsx scripts/warm-index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@hono/node-server": "^1.13.7",
    "hono": "^4.6.14",
    "pinia": "^2.3.0",
    "vue": "^3.5.13",
    "vue-router": "^4.5.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@vitejs/plugin-vue": "^5.2.1",
    "@vue/test-utils": "^2.4.6",
    "concurrently": "^9.1.0",
    "happy-dom": "^15.11.7",
    "tailwindcss": "^4.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vite": "^6.0.5",
    "vitest": "^2.1.8",
    "vue-tsc": "^2.1.10"
  }
}
```

- [ ] **Step 2: Installer les dépendances**

Run: `npm install`
Expected: installation sans erreur, `node_modules/` créé.

- [ ] **Step 3: Créer `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vite/client"],
    "paths": { "@/*": ["./src/*"] },
    "baseUrl": "."
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "server/**/*.ts", "scripts/**/*.ts"]
}
```

- [ ] **Step 4: Créer `vite.config.ts`**

```ts
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } },
  },
})
```

- [ ] **Step 5: Créer `vitest.config.ts`**

```ts
import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
})
```

- [ ] **Step 6: Écrire le test qui échoue pour `format.ts`**

Create `src/lib/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { formatDate, formatNumber, formatPercent } from './format'

describe('formatNumber', () => {
  it('sépare les milliers par une espace insécable fine', () => {
    expect(formatNumber(491867)).toBe('491 867')
  })

  it('laisse les nombres à trois chiffres intacts', () => {
    expect(formatNumber(300)).toBe('300')
  })
})

describe('formatPercent', () => {
  it('arrondit à une décimale par défaut', () => {
    expect(formatPercent(10.3412)).toBe('10,3 %')
  })

  it('respecte le nombre de décimales demandé', () => {
    expect(formatPercent(3.8149, 2)).toBe('3,81 %')
  })
})

describe('formatDate', () => {
  it('formate une date ISO en français', () => {
    expect(formatDate('1991-06-11')).toBe('11 juin 1991')
  })

  it('retourne un tiret pour une date absente', () => {
    expect(formatDate(null)).toBe('—')
  })
})
```

- [ ] **Step 7: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/lib/format.test.ts`
Expected: FAIL — `Failed to resolve import "./format"`.

- [ ] **Step 8: Implémenter `src/lib/format.ts`**

```ts
const NUMBER_FORMATTER = new Intl.NumberFormat('fr-FR')
const DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value)
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits).replace('.', ',')} %`
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const parsed = new Date(iso.includes('T') ? iso : `${iso}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return '—'
  return DATE_FORMATTER.format(parsed)
}
```

- [ ] **Step 9: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/lib/format.test.ts`
Expected: PASS, 6 tests.

Si `formatNumber` échoue, vérifier le séparateur produit par `Intl` sur la machine : Node peut produire U+202F (espace fine insécable) ou U+00A0. Aligner l'attendu du test sur ce que produit `Intl`, pas l'inverse — c'est le rendu navigateur qui fait foi.

- [ ] **Step 10: Créer `src/styles/main.css` avec les tokens**

```css
@import "tailwindcss";

@theme {
  --color-bg: #0A0C10;
  --color-surface: #12161D;
  --color-raised: #1A1F28;
  --color-edge: #232A35;
  --color-ink: #E6EAF0;
  --color-muted: #8A94A6;
  --color-phosphor: #3DFF9E;
  --color-amber: #FFB627;
  --color-magenta: #FF3D81;
  --color-cyan: #4CC9F0;

  --font-display: "Barlow Condensed", system-ui, sans-serif;
  --font-body: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  --font-pixel: "Press Start 2P", monospace;
}

@layer base {
  body {
    @apply bg-bg text-ink font-body antialiased;
  }

  /* Le pixel art des badges RA est détruit par le lissage par défaut du navigateur. */
  .is-pixel {
    image-rendering: pixelated;
  }

  :focus-visible {
    @apply outline-2 outline-offset-2 outline-cyan;
  }
}

@layer components {
  .tag {
    @apply font-pixel text-[8px] leading-none uppercase tracking-wide;
  }

  .num {
    @apply font-mono tabular-nums;
  }
}

@media (prefers-reduced-motion: reduce) {
  .scanlines {
    display: none;
  }
}
```

Le nom `edge` remplace `border` : Tailwind v4 réserve `--color-border` pour ses propres utilitaires et une redéfinition casse `border-*`.

- [ ] **Step 11: Créer `index.html`**

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0A0C10" />
    <title>RetroAchievements</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&family=Press+Start+2P&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`viewport-fit=cover` est requis pour que `env(safe-area-inset-bottom)` renvoie une valeur non nulle sur iOS — sans lui, la barre d'onglets basse passe sous l'indicateur d'accueil.

- [ ] **Step 12: Créer `src/App.vue` et `src/main.ts` minimaux**

`src/App.vue` :

```vue
<script setup lang="ts">
</script>

<template>
  <main class="p-4">
    <h1 class="font-display text-3xl uppercase">RetroAchievements</h1>
  </main>
</template>
```

`src/main.ts` :

```ts
import { createApp } from 'vue'

import App from './App.vue'
import './styles/main.css'

createApp(App).mount('#app')
```

- [ ] **Step 13: Vérifier que le build passe**

Run: `npm run build`
Expected: `vue-tsc` sans erreur, `dist/` produit.

- [ ] **Step 14: Commit** (uniquement si les commits sont autorisés)

```bash
git init
git add -A
git commit -m "chore: scaffold vite + vue + tailwind v4 with design tokens"
```

---

## Task 2: Client API RetroAchievements et normalisation

**Files:**
- Create: `server/env.ts`, `server/ra-client.ts`, `server/normalize.ts`
- Create: `src/lib/types.ts`
- Test: `server/ra-client.test.ts`, `server/normalize.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `getEnv(): { raApiKey: string; port: number }`
  - `fetchRa<T>(endpoint: string, params: Record<string, string | number>): Promise<T>` — `endpoint` est le nom sans préfixe ni extension, par exemple `GetGameExtended`.
  - `normalizeGameDetail(raw: RaGameExtended): GameDetail`
  - `normalizeAchievement(raw: RaAchievement, distinctPlayers: number): Achievement`
  - `normalizePlayerProfile(raw: RaUserProfile): PlayerProfile`
  - Tous les types de `src/lib/types.ts`.

- [ ] **Step 1: Créer `src/lib/types.ts`**

```ts
export interface SystemSummary {
  id: number
  name: string
  iconUrl: string
}

export interface GameSummary {
  id: number
  title: string
  systemId: number
  systemName: string
  iconPath: string
  numAchievements: number
  points: number
}

export type AchievementType = 'progression' | 'win_condition' | 'missable' | null

export interface Achievement {
  id: number
  title: string
  description: string
  points: number
  trueRatio: number
  badgeName: string
  displayOrder: number
  type: AchievementType
  numAwarded: number
  numAwardedHardcore: number
  unlockRate: number
  unlockRateHardcore: number
  dateEarned: string | null
  dateEarnedHardcore: string | null
}

export interface GameDetail {
  id: number
  title: string
  systemId: number
  systemName: string
  developer: string
  publisher: string
  genre: string
  released: string | null
  iconPath: string
  boxArtPath: string
  titlePath: string
  ingamePath: string
  numDistinctPlayers: number
  numAchievements: number
  totalPoints: number
  achievements: Achievement[]
}

export interface GameProgress {
  numAwarded: number
  numAwardedHardcore: number
  completionPct: number
  completionHardcorePct: number
  highestAwardKind: string | null
}

export interface PlayerProfile {
  user: string
  ulid: string
  avatarPath: string
  motto: string
  memberSince: string
  rank: number
  totalPoints: number
  totalSoftcorePoints: number
  totalTruePoints: number
  richPresence: string | null
  lastGameId: number | null
}

export interface PlayerAward {
  awardedAt: string
  awardType: string
  title: string
  systemName: string
  iconPath: string
  isHardcore: boolean
  gameId: number
}

export interface PlayerGameProgress {
  gameId: number
  title: string
  systemId: number
  systemName: string
  iconPath: string
  maxPossible: number
  numAwarded: number
  numAwardedHardcore: number
  highestAwardKind: string | null
  mostRecentAwardedDate: string | null
}

export interface LeaderboardUser {
  rank: number
  user: string
  totalPoints: number
  totalTruePoints: number
}

export interface SearchResults {
  games: GameSummary[]
  player: PlayerProfile | null
  systems: SystemSummary[]
}
```

- [ ] **Step 2: Créer `server/env.ts`**

```ts
import { readFileSync } from 'node:fs'

function loadDotEnv(): void {
  try {
    const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    for (const line of raw.split('\n')) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
      if (match?.[1] && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2]
      }
    }
  } catch {
    // .env absent : les variables peuvent venir de l'environnement du process.
  }
}

loadDotEnv()

export function getEnv(): { raApiKey: string; port: number } {
  const raApiKey = process.env.RA_API_KEY
  if (!raApiKey) {
    throw new Error(
      'RA_API_KEY manquante. Copiez .env.example vers .env et renseignez votre clé Web API RetroAchievements.',
    )
  }
  return { raApiKey, port: Number(process.env.PORT ?? 3001) }
}
```

- [ ] **Step 3: Écrire le test qui échoue pour `ra-client.ts`**

Create `server/ra-client.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RaApiError, fetchRa, resetRaQueue } from './ra-client'

describe('fetchRa', () => {
  beforeEach(() => {
    process.env.RA_API_KEY = 'test-key'
    resetRaQueue()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('construit l\'URL avec la clé en param y', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ID: 1 }), { status: 200 }),
    )

    await fetchRa('GetGameExtended', { i: 1 })

    const url = new URL(spy.mock.calls[0]![0] as string)
    expect(url.pathname).toBe('/API/API_GetGameExtended.php')
    expect(url.searchParams.get('i')).toBe('1')
    expect(url.searchParams.get('y')).toBe('test-key')
  })

  it('réessaie sur 429 puis réussit', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    const result = await fetchRa<{ ok: boolean }>('GetConsoleIDs', {})

    expect(result.ok).toBe(true)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('lève une RaApiError après épuisement des tentatives', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }))

    await expect(fetchRa('GetConsoleIDs', {})).rejects.toBeInstanceOf(RaApiError)
  })

  it('ne dépasse jamais 2 appels sortants simultanés', async () => {
    let inFlight = 0
    let peak = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 5))
      inFlight -= 1
      return new Response(JSON.stringify({}), { status: 200 })
    })

    await Promise.all(
      Array.from({ length: 8 }, () => fetchRa('GetConsoleIDs', {})),
    )

    expect(peak).toBeLessThanOrEqual(2)
  })
})
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run server/ra-client.test.ts`
Expected: FAIL — `Failed to resolve import "./ra-client"`.

- [ ] **Step 5: Implémenter `server/ra-client.ts`**

```ts
import { getEnv } from './env'

const BASE_URL = 'https://retroachievements.org/API'
const MAX_CONCURRENCY = 2
const MAX_ATTEMPTS = 3

export class RaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'RaApiError'
  }
}

let active = 0
const waiting: Array<() => void> = []

export function resetRaQueue(): void {
  active = 0
  waiting.length = 0
}

async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENCY) {
    active += 1
    return
  }
  await new Promise<void>((resolve) => waiting.push(resolve))
  active += 1
}

function release(): void {
  active -= 1
  waiting.shift()?.()
}

function backoffDelay(attempt: number): number {
  return 300 * 2 ** (attempt - 1)
}

export async function fetchRa<T>(
  endpoint: string,
  params: Record<string, string | number>,
): Promise<T> {
  const { raApiKey } = getEnv()
  const url = new URL(`${BASE_URL}/API_${endpoint}.php`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }
  url.searchParams.set('y', raApiKey)

  await acquire()
  try {
    let lastStatus = 0
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const response = await fetch(url.toString())
      if (response.ok) {
        return (await response.json()) as T
      }
      lastStatus = response.status
      const retryable = response.status === 429 || response.status >= 500
      if (!retryable) break
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, backoffDelay(attempt)))
      }
    }
    throw new RaApiError(`API_${endpoint} a répondu ${lastStatus}`, lastStatus)
  } finally {
    release()
  }
}
```

- [ ] **Step 6: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run server/ra-client.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 7: Écrire le test qui échoue pour `normalize.ts`**

Create `server/normalize.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { normalizeAchievement, normalizeGameDetail, normalizePlayerProfile } from './normalize'

const RAW_ACHIEVEMENT = {
  ID: 9,
  NumAwarded: 54785,
  NumAwardedHardcore: 25640,
  Title: 'That Was Easy',
  Description: 'Complete the first act of Green Hill Zone.',
  Points: 3,
  TrueRatio: 3,
  Author: 'Scott',
  DateModified: '2026-01-06 00:58:04',
  DateCreated: '2012-11-02 00:03:12',
  BadgeName: '250336',
  DisplayOrder: 1,
  MemAddr: 'abc',
  type: 'progression',
}

describe('normalizeAchievement', () => {
  it('calcule les taux de déblocage en pourcentage', () => {
    const result = normalizeAchievement(RAW_ACHIEVEMENT, 60727)

    expect(result.unlockRate).toBeCloseTo(90.22, 1)
    expect(result.unlockRateHardcore).toBeCloseTo(42.22, 1)
  })

  it('renvoie 0 plutôt que NaN quand aucun joueur distinct', () => {
    const result = normalizeAchievement(RAW_ACHIEVEMENT, 0)

    expect(result.unlockRate).toBe(0)
    expect(result.unlockRateHardcore).toBe(0)
  })

  it('mappe le champ type en minuscule vers le type interne', () => {
    expect(normalizeAchievement(RAW_ACHIEVEMENT, 1).type).toBe('progression')
    expect(normalizeAchievement({ ...RAW_ACHIEVEMENT, type: '' }, 1).type).toBeNull()
    expect(normalizeAchievement({ ...RAW_ACHIEVEMENT, type: undefined }, 1).type).toBeNull()
  })

  it('expose les dates de déblocage quand elles sont présentes', () => {
    const withProgress = { ...RAW_ACHIEVEMENT, DateEarnedHardcore: '2026-02-01 10:00:00' }

    expect(normalizeAchievement(withProgress, 1).dateEarnedHardcore).toBe('2026-02-01 10:00:00')
    expect(normalizeAchievement(RAW_ACHIEVEMENT, 1).dateEarnedHardcore).toBeNull()
  })
})

describe('normalizeGameDetail', () => {
  const RAW_GAME = {
    ID: 1,
    Title: 'Sonic the Hedgehog',
    ConsoleID: 1,
    ConsoleName: 'Genesis/Mega Drive',
    ImageIcon: '/Images/085573.png',
    ImageTitle: '/Images/054993.png',
    ImageIngame: '/Images/000010.png',
    ImageBoxArt: '/Images/112941.png',
    Publisher: 'Sega',
    Developer: 'Sonic Team',
    Genre: '2D Platforming',
    Released: '1991-06-11',
    NumDistinctPlayers: 60727,
    NumAchievements: 1,
    Achievements: { '9': RAW_ACHIEVEMENT },
  }

  it('aplatit la map d\'achievements en tableau trié par displayOrder', () => {
    const second = { ...RAW_ACHIEVEMENT, ID: 2, DisplayOrder: 0, BadgeName: '250352' }
    const result = normalizeGameDetail({ ...RAW_GAME, Achievements: { '9': RAW_ACHIEVEMENT, '2': second } })

    expect(result.achievements.map((a) => a.id)).toEqual([2, 9])
  })

  it('additionne les points du set', () => {
    expect(normalizeGameDetail(RAW_GAME).totalPoints).toBe(3)
  })

  it('conserve les chemins média relatifs sans les préfixer', () => {
    expect(normalizeGameDetail(RAW_GAME).boxArtPath).toBe('/Images/112941.png')
  })

  it('tolère un jeu sans achievements', () => {
    const result = normalizeGameDetail({ ...RAW_GAME, Achievements: {} })

    expect(result.achievements).toEqual([])
    expect(result.totalPoints).toBe(0)
  })
})

describe('normalizePlayerProfile', () => {
  it('mappe les champs du profil', () => {
    const result = normalizePlayerProfile({
      User: 'MaxMilyin',
      ULID: '01A7ZWK9Z6K4S6WNNNA418A60H',
      UserPic: '/UserPic/MaxMilyin.png',
      MemberSince: '2016-01-02 00:43:04',
      RichPresenceMsg: 'PUP38/WAR19 on HorizonXI',
      LastGameID: 28275,
      TotalPoints: 491867,
      TotalSoftcorePoints: 0,
      TotalTruePoints: 2669943,
      Motto: 'LIVE RA at twitch.tv/gamesquadsquad',
      Rank: 1,
    })

    expect(result.user).toBe('MaxMilyin')
    expect(result.totalTruePoints).toBe(2669943)
    expect(result.richPresence).toBe('PUP38/WAR19 on HorizonXI')
  })

  it('normalise une rich presence vide en null', () => {
    const result = normalizePlayerProfile({
      User: 'x', ULID: 'y', UserPic: '/UserPic/x.png', MemberSince: '2020-01-01 00:00:00',
      RichPresenceMsg: 'Unknown', LastGameID: 0, TotalPoints: 0, TotalSoftcorePoints: 0,
      TotalTruePoints: 0, Motto: '', Rank: 0,
    })

    expect(result.richPresence).toBeNull()
    expect(result.lastGameId).toBeNull()
  })
})
```

- [ ] **Step 8: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run server/normalize.test.ts`
Expected: FAIL — `Failed to resolve import "./normalize"`.

- [ ] **Step 9: Implémenter `server/normalize.ts`**

```ts
import type {
  Achievement,
  AchievementType,
  GameDetail,
  PlayerProfile,
} from '../src/lib/types'

export interface RaAchievement {
  ID: number
  NumAwarded: number
  NumAwardedHardcore: number
  Title: string
  Description: string
  Points: number
  TrueRatio: number
  BadgeName: string
  DisplayOrder: number
  type?: string | null
  DateEarned?: string
  DateEarnedHardcore?: string
}

export interface RaGameExtended {
  ID: number
  Title: string
  ConsoleID: number
  ConsoleName: string
  ImageIcon: string
  ImageTitle: string
  ImageIngame: string
  ImageBoxArt: string
  Publisher: string
  Developer: string
  Genre: string
  Released: string | null
  NumDistinctPlayers: number
  NumAchievements: number
  Achievements: Record<string, RaAchievement>
}

export interface RaUserProfile {
  User: string
  ULID: string
  UserPic: string
  MemberSince: string
  RichPresenceMsg: string
  LastGameID: number
  TotalPoints: number
  TotalSoftcorePoints: number
  TotalTruePoints: number
  Motto: string
  Rank: number
}

const KNOWN_TYPES: readonly string[] = ['progression', 'win_condition', 'missable']

function toType(raw: string | null | undefined): AchievementType {
  if (!raw) return null
  return KNOWN_TYPES.includes(raw) ? (raw as AchievementType) : null
}

function rate(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0
}

export function normalizeAchievement(
  raw: RaAchievement,
  distinctPlayers: number,
): Achievement {
  return {
    id: raw.ID,
    title: raw.Title,
    description: raw.Description,
    points: raw.Points,
    trueRatio: raw.TrueRatio,
    badgeName: raw.BadgeName,
    displayOrder: raw.DisplayOrder,
    type: toType(raw.type),
    numAwarded: raw.NumAwarded,
    numAwardedHardcore: raw.NumAwardedHardcore,
    unlockRate: rate(raw.NumAwarded, distinctPlayers),
    unlockRateHardcore: rate(raw.NumAwardedHardcore, distinctPlayers),
    dateEarned: raw.DateEarned ?? null,
    dateEarnedHardcore: raw.DateEarnedHardcore ?? null,
  }
}

export function normalizeGameDetail(raw: RaGameExtended): GameDetail {
  const achievements = Object.values(raw.Achievements ?? {})
    .map((entry) => normalizeAchievement(entry, raw.NumDistinctPlayers))
    .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id)

  return {
    id: raw.ID,
    title: raw.Title,
    systemId: raw.ConsoleID,
    systemName: raw.ConsoleName,
    developer: raw.Developer,
    publisher: raw.Publisher,
    genre: raw.Genre,
    released: raw.Released ?? null,
    iconPath: raw.ImageIcon,
    boxArtPath: raw.ImageBoxArt,
    titlePath: raw.ImageTitle,
    ingamePath: raw.ImageIngame,
    numDistinctPlayers: raw.NumDistinctPlayers,
    numAchievements: achievements.length,
    totalPoints: achievements.reduce((sum, entry) => sum + entry.points, 0),
    achievements,
  }
}

export function normalizePlayerProfile(raw: RaUserProfile): PlayerProfile {
  // L'API renvoie la chaîne littérale "Unknown" quand aucune rich presence n'est active.
  const richPresence =
    raw.RichPresenceMsg && raw.RichPresenceMsg !== 'Unknown' ? raw.RichPresenceMsg : null

  return {
    user: raw.User,
    ulid: raw.ULID,
    avatarPath: raw.UserPic,
    motto: raw.Motto,
    memberSince: raw.MemberSince,
    rank: raw.Rank,
    totalPoints: raw.TotalPoints,
    totalSoftcorePoints: raw.TotalSoftcorePoints,
    totalTruePoints: raw.TotalTruePoints,
    richPresence,
    lastGameId: raw.LastGameID || null,
  }
}
```

- [ ] **Step 10: Lancer tous les tests serveur**

Run: `npx vitest run server/`
Expected: PASS, 13 tests.

- [ ] **Step 11: Commit** (si autorisé)

```bash
git add server/ src/lib/types.ts
git commit -m "feat: add RA API client with queue, backoff and normalization"
```

---

## Task 3: Cache mémoire + disque avec service du périmé

**Files:**
- Create: `server/cache.ts`
- Test: `server/cache.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T>`
  - `TTL: { home: number; systems: number; gameList: number; game: number; user: number; leaderboard: number }` en millisecondes.
  - `resetCache(): void` — usage test uniquement.
  - `readDisk<T>(name: string): Promise<T | null>` / `writeDisk<T>(name: string, value: T): Promise<void>` pour l'index de recherche.

- [ ] **Step 1: Écrire le test qui échoue**

Create `server/cache.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { cached, resetCache } from './cache'

describe('cached', () => {
  beforeEach(() => {
    resetCache()
    vi.useRealTimers()
  })

  it('n\'appelle le loader qu\'une fois pendant la durée de vie', async () => {
    const loader = vi.fn().mockResolvedValue('valeur')

    await cached('k', 1000, loader)
    await cached('k', 1000, loader)

    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('rappelle le loader une fois la durée de vie écoulée', async () => {
    vi.useFakeTimers()
    const loader = vi.fn().mockResolvedValue('valeur')

    await cached('k', 1000, loader)
    vi.advanceTimersByTime(1500)
    await cached('k', 1000, loader)

    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('sert la valeur périmée quand le loader échoue', async () => {
    vi.useFakeTimers()
    const loader = vi
      .fn()
      .mockResolvedValueOnce('fraiche')
      .mockRejectedValueOnce(new Error('amont indisponible'))

    await cached('k', 1000, loader)
    vi.advanceTimersByTime(1500)

    await expect(cached('k', 1000, loader)).resolves.toBe('fraiche')
  })

  it('propage l\'erreur quand aucune valeur périmée n\'existe', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('amont indisponible'))

    await expect(cached('vide', 1000, loader)).rejects.toThrow('amont indisponible')
  })

  it('ne lance qu\'un seul loader pour des appels concurrents sur la même clé', async () => {
    let calls = 0
    const loader = async () => {
      calls += 1
      await new Promise((resolve) => setTimeout(resolve, 10))
      return calls
    }

    await Promise.all([cached('k', 1000, loader), cached('k', 1000, loader)])

    expect(calls).toBe(1)
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run server/cache.test.ts`
Expected: FAIL — `Failed to resolve import "./cache"`.

- [ ] **Step 3: Implémenter `server/cache.ts`**

```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

export const TTL = {
  home: 15 * MINUTE,
  systems: 24 * HOUR,
  gameList: 24 * HOUR,
  game: 1 * HOUR,
  user: 5 * MINUTE,
  leaderboard: 15 * MINUTE,
} as const

interface Entry {
  value: unknown
  expiresAt: number
}

const entries = new Map<string, Entry>()
const inFlight = new Map<string, Promise<unknown>>()

export function resetCache(): void {
  entries.clear()
  inFlight.clear()
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const existing = entries.get(key)
  if (existing && existing.expiresAt > Date.now()) {
    return existing.value as T
  }

  const running = inFlight.get(key)
  if (running) return running as Promise<T>

  const promise = loader()
    .then((value) => {
      entries.set(key, { value, expiresAt: Date.now() + ttlMs })
      return value
    })
    .catch((error: unknown) => {
      // Une donnée périmée vaut mieux qu'une page en erreur : l'interface l'étiquettera.
      if (existing) return existing.value as T
      throw error
    })
    .finally(() => {
      inFlight.delete(key)
    })

  inFlight.set(key, promise)
  return promise
}

const CACHE_DIR = fileURLToPath(new URL('../.cache/', import.meta.url))

export async function readDisk<T>(name: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(`${CACHE_DIR}${name}`, 'utf8')) as T
  } catch {
    return null
  }
}

export async function writeDisk<T>(name: string, value: T): Promise<void> {
  const target = `${CACHE_DIR}${name}`
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, JSON.stringify(value), 'utf8')
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run server/cache.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit** (si autorisé)

```bash
git add server/cache.ts server/cache.test.ts
git commit -m "feat: add cache with stale-on-error and disk persistence"
```

---

## Task 4: Index de recherche et script de préchauffage

**Files:**
- Create: `server/search-index.ts`, `scripts/warm-index.ts`
- Test: `server/search-index.test.ts`

**Interfaces:**
- Consumes: `fetchRa` (Task 2), `readDisk` / `writeDisk` (Task 3), `GameSummary` / `SystemSummary` (Task 2).
- Produces:
  - `normalizeTitle(title: string): string`
  - `scoreMatch(normalizedTitle: string, normalizedQuery: string): number` — `-1` si aucun match.
  - `searchGames(query: string, limit?: number): GameSummary[]`
  - `loadIndex(): Promise<boolean>` — charge depuis le disque, retourne `false` si absent.
  - `buildIndex(onProgress?: (done: number, total: number) => void): Promise<GameSummary[]>`
  - `getIndexStatus(): { ready: boolean; total: number }`

- [ ] **Step 1: Écrire le test qui échoue**

Create `server/search-index.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'

import { normalizeTitle, scoreMatch, searchGames, setIndexForTests } from './search-index'

describe('normalizeTitle', () => {
  it('passe en minuscules et retire les diacritiques', () => {
    expect(normalizeTitle('Pokémon Rouge')).toBe('pokemon rouge')
  })

  it('retire les préfixes de sous-ensemble utilises par RA', () => {
    expect(normalizeTitle('~Hack~ Earthbound Beginnings Remake')).toBe(
      'earthbound beginnings remake',
    )
    expect(normalizeTitle('~Homebrew~ Micro Mages')).toBe('micro mages')
  })

  it('normalise la ponctuation en espaces simples', () => {
    expect(normalizeTitle('Sonic  the   Hedgehog 2')).toBe('sonic the hedgehog 2')
  })
})

describe('scoreMatch', () => {
  it('classe le préfixe exact avant le début de mot avant la sous-chaine', () => {
    const prefix = scoreMatch('sonic the hedgehog', 'sonic')
    const wordStart = scoreMatch('super sonic racing', 'sonic')
    const substring = scoreMatch('supersonic', 'sonic')

    expect(prefix).toBeGreaterThan(wordStart)
    expect(wordStart).toBeGreaterThan(substring)
    expect(substring).toBeGreaterThan(-1)
  })

  it('retourne -1 sans correspondance', () => {
    expect(scoreMatch('sonic the hedgehog', 'mario')).toBe(-1)
  })
})

describe('searchGames', () => {
  beforeEach(() => {
    setIndexForTests([
      { id: 1, title: 'Sonic the Hedgehog', systemId: 1, systemName: 'Genesis/Mega Drive', iconPath: '/Images/085573.png', numAchievements: 35, points: 300 },
      { id: 10, title: 'Sonic the Hedgehog 2', systemId: 1, systemName: 'Genesis/Mega Drive', iconPath: '/Images/121647.png', numAchievements: 32, points: 420 },
      { id: 29895, title: 'Sonic the Hedgehog [Subset - Perfect Bonus]', systemId: 1, systemName: 'Genesis/Mega Drive', iconPath: '/Images/121648.png', numAchievements: 24, points: 425 },
      { id: 3, title: 'Streets of Rage 2', systemId: 1, systemName: 'Genesis/Mega Drive', iconPath: '/Images/120551.png', numAchievements: 40, points: 626 },
    ])
  })

  it('trouve les jeux par sous-chaine', () => {
    expect(searchGames('sonic').map((game) => game.id)).toContain(1)
  })

  it('classe le titre le plus court en premier a score egal', () => {
    expect(searchGames('sonic the hedgehog')[0]!.id).toBe(1)
  })

  it('exclut les jeux sans correspondance', () => {
    expect(searchGames('rage').map((game) => game.id)).toEqual([3])
  })

  it('respecte la limite demandee', () => {
    expect(searchGames('sonic', 2)).toHaveLength(2)
  })

  it('retourne un tableau vide pour une requete trop courte', () => {
    expect(searchGames('s')).toEqual([])
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run server/search-index.test.ts`
Expected: FAIL — `Failed to resolve import "./search-index"`.

- [ ] **Step 3: Implémenter `server/search-index.ts`**

```ts
import type { GameSummary, SystemSummary } from '../src/lib/types'
import { readDisk, writeDisk } from './cache'
import { fetchRa } from './ra-client'

const INDEX_FILE = 'game-index.json'
const MIN_QUERY_LENGTH = 2
const SUBSET_PREFIX = /^~[^~]+~\s*/

interface IndexedGame extends GameSummary {
  normalized: string
}

let index: IndexedGame[] = []

export function setIndexForTests(games: GameSummary[]): void {
  index = games.map((game) => ({ ...game, normalized: normalizeTitle(game.title) }))
}

export function normalizeTitle(title: string): string {
  return title
    .replace(SUBSET_PREFIX, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function scoreMatch(normalizedTitle: string, normalizedQuery: string): number {
  const position = normalizedTitle.indexOf(normalizedQuery)
  if (position === -1) return -1
  if (position === 0) return 3
  return normalizedTitle[position - 1] === ' ' ? 2 : 1
}

export function searchGames(query: string, limit = 30): GameSummary[] {
  const normalizedQuery = normalizeTitle(query)
  if (normalizedQuery.length < MIN_QUERY_LENGTH) return []

  const scored: Array<{ game: IndexedGame; score: number }> = []
  for (const game of index) {
    const score = scoreMatch(game.normalized, normalizedQuery)
    if (score > -1) scored.push({ game, score })
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.game.normalized.length - b.game.normalized.length ||
      b.game.numAchievements - a.game.numAchievements,
  )

  return scored.slice(0, limit).map(({ game }) => {
    const { normalized: _normalized, ...summary } = game
    return summary
  })
}

export function getIndexStatus(): { ready: boolean; total: number } {
  return { ready: index.length > 0, total: index.length }
}

export async function loadIndex(): Promise<boolean> {
  const stored = await readDisk<GameSummary[]>(INDEX_FILE)
  if (!stored) return false
  setIndexForTests(stored)
  return true
}

interface RaGameListEntry {
  ID: number
  Title: string
  ConsoleID: number
  ConsoleName: string
  ImageIcon: string
  NumAchievements: number
  Points: number
}

export async function buildIndex(
  onProgress?: (done: number, total: number) => void,
): Promise<GameSummary[]> {
  const systems = await fetchRa<Array<{ ID: number; Name: string }>>('GetConsoleIDs', {
    a: 1,
    g: 1,
  })

  const games: GameSummary[] = []
  let done = 0
  for (const system of systems) {
    const entries = await fetchRa<RaGameListEntry[]>('GetGameList', { i: system.ID, f: 1 })
    for (const entry of entries) {
      games.push({
        id: entry.ID,
        title: entry.Title,
        systemId: entry.ConsoleID,
        systemName: entry.ConsoleName,
        iconPath: entry.ImageIcon,
        numAchievements: entry.NumAchievements,
        points: entry.Points,
      })
    }
    done += 1
    onProgress?.(done, systems.length)
  }

  await writeDisk(INDEX_FILE, games)
  setIndexForTests(games)
  return games
}

export function searchSystems(query: string, systems: SystemSummary[]): SystemSummary[] {
  const normalizedQuery = normalizeTitle(query)
  if (normalizedQuery.length < MIN_QUERY_LENGTH) return []
  return systems.filter((system) => scoreMatch(normalizeTitle(system.name), normalizedQuery) > -1)
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run server/search-index.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Créer `scripts/warm-index.ts`**

```ts
import { buildIndex } from '../server/search-index'

const started = Date.now()

buildIndex((done, total) => {
  process.stdout.write(`\rIndexation ${done}/${total} systemes...`)
})
  .then((games) => {
    const seconds = Math.round((Date.now() - started) / 1000)
    process.stdout.write(`\n${games.length} jeux indexes en ${seconds}s -> .cache/game-index.json\n`)
  })
  .catch((error: unknown) => {
    process.stderr.write(`\nEchec de l'indexation : ${String(error)}\n`)
    process.exitCode = 1
  })
```

- [ ] **Step 6: Construire l'index réel**

Run: `npm run warm`
Expected: progression jusqu'à 55/55, puis **11 880 jeux** et le fichier `.cache/game-index.json` (1,8 Mo) créé.

Mesure réelle : 21 secondes pour 56 appels. Cette étape n'est à relancer qu'après une longue période, les données étant quasi statiques.

- [ ] **Step 7: Vérifier le fichier produit**

Run: `node -e "const g=require('./.cache/game-index.json');console.log(g.length, g[0])"`
Expected: un nombre à cinq chiffres et un objet avec `id`, `title`, `systemName`.

- [ ] **Step 8: Commit** (si autorisé)

```bash
git add server/search-index.ts server/search-index.test.ts scripts/warm-index.ts
git commit -m "feat: add game search index built from GetGameList"
```

---

## Task 5: Serveur Hono et routes internes

**Files:**
- Create: `server/index.ts`, `server/routes/systems.ts`, `server/routes/games.ts`, `server/routes/users.ts`, `server/routes/search.ts`, `server/routes/leaderboards.ts`
- Test: `server/routes/routes.test.ts`

**Interfaces:**
- Consumes: `fetchRa` (Task 2), les `normalize*` (Task 2), `cached` / `TTL` (Task 3), `searchGames` / `loadIndex` / `getIndexStatus` / `buildIndex` / `searchSystems` (Task 4).
- Produces: `createApp(): Hono` exporté par `server/index.ts`, montant :
  - `GET /api/systems` → `SystemSummary[]`
  - `GET /api/systems/:id/games` → `GameSummary[]`
  - `GET /api/games/:id` → `GameDetail`
  - `GET /api/games/:id/progress/:user` → `{ progress: GameProgress; achievements: Achievement[] }`
  - `GET /api/users/:user` → `{ profile: PlayerProfile; awards: PlayerAward[]; recentGames: PlayerGameProgress[] }`
  - `GET /api/users/:user/progress` → `PlayerGameProgress[]`
  - `GET /api/search?q=` → `SearchResults`, ou `503 { status: 'indexing', total }`
  - `GET /api/leaderboards` → `LeaderboardUser[]`

- [ ] **Step 1: Écrire le test qui échoue**

Create `server/routes/routes.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resetCache } from '../cache'
import { createApp } from '../index'
import { setIndexForTests } from '../search-index'

const SONIC_RAW = {
  ID: 1,
  Title: 'Sonic the Hedgehog',
  ConsoleID: 1,
  ConsoleName: 'Genesis/Mega Drive',
  ImageIcon: '/Images/085573.png',
  ImageTitle: '/Images/054993.png',
  ImageIngame: '/Images/000010.png',
  ImageBoxArt: '/Images/112941.png',
  Publisher: 'Sega',
  Developer: 'Sonic Team',
  Genre: '2D Platforming',
  Released: '1991-06-11',
  NumDistinctPlayers: 60727,
  NumAchievements: 1,
  Achievements: {
    '9': {
      ID: 9, NumAwarded: 54785, NumAwardedHardcore: 25640, Title: 'That Was Easy',
      Description: 'Complete the first act of Green Hill Zone.', Points: 3, TrueRatio: 3,
      BadgeName: '250336', DisplayOrder: 1, type: 'progression',
    },
  },
}

function mockRa(byEndpoint: Record<string, unknown>): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input))
    const endpoint = url.pathname.replace('/API/API_', '').replace('.php', '')
    if (!(endpoint in byEndpoint)) {
      return new Response('', { status: 404 })
    }
    return new Response(JSON.stringify(byEndpoint[endpoint]), { status: 200 })
  })
}

describe('routes internes', () => {
  beforeEach(() => {
    process.env.RA_API_KEY = 'test-key'
    resetCache()
    setIndexForTests([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('GET /api/systems renvoie les systemes normalises', async () => {
    mockRa({
      GetConsoleIDs: [
        { ID: 1, Name: 'Genesis/Mega Drive', IconURL: 'https://static.retroachievements.org/assets/images/system/md.png', Active: true, IsGameSystem: true },
      ],
    })

    const response = await createApp().request('/api/systems')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([
      { id: 1, name: 'Genesis/Mega Drive', iconUrl: 'https://static.retroachievements.org/assets/images/system/md.png' },
    ])
  })

  it('GET /api/games/:id renvoie un GameDetail avec ses achievements', async () => {
    mockRa({ GetGameExtended: SONIC_RAW })

    const response = await createApp().request('/api/games/1')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.title).toBe('Sonic the Hedgehog')
    expect(body.achievements).toHaveLength(1)
    expect(body.achievements[0].unlockRate).toBeCloseTo(90.22, 1)
    expect(body.totalPoints).toBe(3)
  })

  it('GET /api/games/:id refuse un identifiant non numerique', async () => {
    const response = await createApp().request('/api/games/abc')

    expect(response.status).toBe(400)
  })

  it('GET /api/search repond 503 quand l\'index est vide', async () => {
    const response = await createApp().request('/api/search?q=sonic')
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.status).toBe('indexing')
  })

  it('GET /api/search renvoie les jeux trouves quand l\'index est charge', async () => {
    setIndexForTests([
      { id: 1, title: 'Sonic the Hedgehog', systemId: 1, systemName: 'Genesis/Mega Drive', iconPath: '/Images/085573.png', numAchievements: 35, points: 300 },
    ])
    mockRa({ GetConsoleIDs: [], GetUserProfile: {} })

    const response = await createApp().request('/api/search?q=sonic')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.games[0].id).toBe(1)
  })

  it('GET /api/search renvoie player null pour un pseudo inconnu', async () => {
    setIndexForTests([])
    mockRa({ GetConsoleIDs: [] })

    const response = await createApp().request('/api/search?q=zz')
    const body = await response.json()

    expect(body.player).toBeNull()
  })

  it('GET /api/users/:user agrege profil, awards et jeux recents', async () => {
    mockRa({
      GetUserProfile: {
        User: 'MaxMilyin', ULID: 'X', UserPic: '/UserPic/MaxMilyin.png',
        MemberSince: '2016-01-02 00:43:04', RichPresenceMsg: 'PUP38 on HorizonXI',
        LastGameID: 28275, TotalPoints: 491867, TotalSoftcorePoints: 0,
        TotalTruePoints: 2669943, Motto: 'LIVE RA', Rank: 1,
      },
      GetUserAwards: {
        TotalAwardsCount: 1,
        VisibleUserAwards: [
          { AwardedAt: '2026-01-01T00:00:00+00:00', AwardType: 'Mastery/Completion', AwardData: 1, AwardDataExtra: 1, Title: 'Sonic the Hedgehog', ConsoleID: 1, ConsoleName: 'Genesis/Mega Drive', ImageIcon: '/Images/085573.png' },
        ],
      },
      GetUserRecentlyPlayedGames: [
        { GameID: 1, ConsoleID: 1, ConsoleName: 'Genesis/Mega Drive', Title: 'Sonic the Hedgehog', ImageIcon: '/Images/085573.png', LastPlayed: '2026-08-01 12:00:00', NumPossibleAchievements: 35, NumAchieved: 22, NumAchievedHardcore: 16 },
      ],
    })

    const response = await createApp().request('/api/users/MaxMilyin')
    const body = await response.json()

    expect(body.profile.user).toBe('MaxMilyin')
    expect(body.awards[0].isHardcore).toBe(true)
    expect(body.recentGames[0].numAwardedHardcore).toBe(16)
  })

  it('GET /api/users/:user renvoie 404 pour un pseudo inconnu', async () => {
    mockRa({ GetUserProfile: {} })

    const response = await createApp().request('/api/users/inconnu')

    expect(response.status).toBe(404)
  })

  it('GET /api/games/:id/progress/:user renvoie la progression', async () => {
    mockRa({
      GetGameInfoAndUserProgress: {
        ...SONIC_RAW,
        NumAwardedToUser: 22,
        NumAwardedToUserHardcore: 16,
        UserCompletion: '62.86%',
        UserCompletionHardcore: '45.71%',
        HighestAwardKind: null,
        Achievements: {
          '9': { ...SONIC_RAW.Achievements['9'], DateEarnedHardcore: '2026-02-01 10:00:00' },
        },
      },
    })

    const response = await createApp().request('/api/games/1/progress/MaxMilyin')
    const body = await response.json()

    expect(body.progress.numAwardedHardcore).toBe(16)
    expect(body.progress.completionHardcorePct).toBeCloseTo(45.71, 1)
    expect(body.achievements[0].dateEarnedHardcore).toBe('2026-02-01 10:00:00')
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run server/routes/routes.test.ts`
Expected: FAIL — `Failed to resolve import "../index"`.

- [ ] **Step 3: Implémenter `server/routes/systems.ts`**

```ts
import { Hono } from 'hono'

import type { GameSummary, SystemSummary } from '../../src/lib/types'
import { TTL, cached } from '../cache'
import { fetchRa } from '../ra-client'

interface RaConsole {
  ID: number
  Name: string
  IconURL: string
}

interface RaGameListEntry {
  ID: number
  Title: string
  ConsoleID: number
  ConsoleName: string
  ImageIcon: string
  NumAchievements: number
  Points: number
}

export async function loadSystems(): Promise<SystemSummary[]> {
  return cached('systems', TTL.systems, async () => {
    const raw = await fetchRa<RaConsole[]>('GetConsoleIDs', { a: 1, g: 1 })
    return raw.map((entry) => ({ id: entry.ID, name: entry.Name, iconUrl: entry.IconURL }))
  })
}

export const systemsRoutes = new Hono()

systemsRoutes.get('/systems', async (context) => {
  return context.json(await loadSystems())
})

systemsRoutes.get('/systems/:id/games', async (context) => {
  const id = Number(context.req.param('id'))
  if (!Number.isInteger(id)) return context.json({ error: 'identifiant invalide' }, 400)

  const games = await cached(`system-games:${id}`, TTL.gameList, async () => {
    const raw = await fetchRa<RaGameListEntry[]>('GetGameList', { i: id, f: 1 })
    return raw.map(
      (entry): GameSummary => ({
        id: entry.ID,
        title: entry.Title,
        systemId: entry.ConsoleID,
        systemName: entry.ConsoleName,
        iconPath: entry.ImageIcon,
        numAchievements: entry.NumAchievements,
        points: entry.Points,
      }),
    )
  })

  return context.json(games)
})
```

- [ ] **Step 4: Implémenter `server/routes/games.ts`**

```ts
import { Hono } from 'hono'

import type { GameProgress } from '../../src/lib/types'
import { TTL, cached } from '../cache'
import { type RaGameExtended, normalizeAchievement, normalizeGameDetail } from '../normalize'
import { fetchRa } from '../ra-client'

interface RaGameProgress extends RaGameExtended {
  NumAwardedToUser: number
  NumAwardedToUserHardcore: number
  UserCompletion: string
  UserCompletionHardcore: string
  HighestAwardKind: string | null
}

function toPercent(raw: string): number {
  return Number.parseFloat(raw.replace('%', '')) || 0
}

export const gamesRoutes = new Hono()

gamesRoutes.get('/games/:id', async (context) => {
  const id = Number(context.req.param('id'))
  if (!Number.isInteger(id)) return context.json({ error: 'identifiant invalide' }, 400)

  const game = await cached(`game:${id}`, TTL.game, async () => {
    const raw = await fetchRa<RaGameExtended>('GetGameExtended', { i: id })
    if (!raw?.ID) return null
    return normalizeGameDetail(raw)
  })

  if (!game) return context.json({ error: 'jeu introuvable' }, 404)
  return context.json(game)
})

gamesRoutes.get('/games/:id/progress/:user', async (context) => {
  const id = Number(context.req.param('id'))
  const user = context.req.param('user')
  if (!Number.isInteger(id)) return context.json({ error: 'identifiant invalide' }, 400)

  const result = await cached(`game-progress:${id}:${user}`, TTL.user, async () => {
    const raw = await fetchRa<RaGameProgress>('GetGameInfoAndUserProgress', {
      g: id,
      u: user,
      a: 1,
    })
    if (!raw?.ID) return null

    const progress: GameProgress = {
      numAwarded: raw.NumAwardedToUser ?? 0,
      numAwardedHardcore: raw.NumAwardedToUserHardcore ?? 0,
      completionPct: toPercent(raw.UserCompletion ?? '0%'),
      completionHardcorePct: toPercent(raw.UserCompletionHardcore ?? '0%'),
      highestAwardKind: raw.HighestAwardKind ?? null,
    }

    const achievements = Object.values(raw.Achievements ?? {})
      .map((entry) => normalizeAchievement(entry, raw.NumDistinctPlayers))
      .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id)

    return { progress, achievements }
  })

  if (!result) return context.json({ error: 'progression introuvable' }, 404)
  return context.json(result)
})
```

- [ ] **Step 5: Implémenter `server/routes/users.ts`**

```ts
import { Hono } from 'hono'

import type { PlayerAward, PlayerGameProgress } from '../../src/lib/types'
import { TTL, cached } from '../cache'
import { type RaUserProfile, normalizePlayerProfile } from '../normalize'
import { fetchRa } from '../ra-client'

interface RaAward {
  AwardedAt: string
  AwardType: string
  AwardData: number
  AwardDataExtra: number
  Title: string
  ConsoleName: string
  ImageIcon: string
}

interface RaRecentGame {
  GameID: number
  ConsoleID: number
  ConsoleName: string
  Title: string
  ImageIcon: string
  LastPlayed: string
  NumPossibleAchievements: number
  NumAchieved: number
  NumAchievedHardcore: number
}

interface RaCompletionEntry {
  GameID: number
  Title: string
  ImageIcon: string
  ConsoleID: number
  ConsoleName: string
  MaxPossible: number
  NumAwarded: number
  NumAwardedHardcore: number
  MostRecentAwardedDate: string | null
  HighestAwardKind: string | null
}

export const usersRoutes = new Hono()

usersRoutes.get('/users/:user', async (context) => {
  const user = context.req.param('user')

  const payload = await cached(`user:${user}`, TTL.user, async () => {
    const raw = await fetchRa<RaUserProfile>('GetUserProfile', { u: user })
    if (!raw?.User) return null

    const [awardsRaw, recentRaw] = await Promise.all([
      fetchRa<{ VisibleUserAwards?: RaAward[] }>('GetUserAwards', { u: user }),
      fetchRa<RaRecentGame[]>('GetUserRecentlyPlayedGames', { u: user, c: 12 }),
    ])

    const awards: PlayerAward[] = (awardsRaw.VisibleUserAwards ?? []).map((entry) => ({
      awardedAt: entry.AwardedAt,
      awardType: entry.AwardType,
      title: entry.Title,
      systemName: entry.ConsoleName,
      iconPath: entry.ImageIcon,
      isHardcore: entry.AwardDataExtra === 1,
      gameId: entry.AwardData,
    }))

    const recentGames: PlayerGameProgress[] = (recentRaw ?? []).map((entry) => ({
      gameId: entry.GameID,
      title: entry.Title,
      systemId: entry.ConsoleID,
      systemName: entry.ConsoleName,
      iconPath: entry.ImageIcon,
      maxPossible: entry.NumPossibleAchievements,
      numAwarded: entry.NumAchieved,
      numAwardedHardcore: entry.NumAchievedHardcore,
      highestAwardKind: null,
      mostRecentAwardedDate: entry.LastPlayed,
    }))

    return { profile: normalizePlayerProfile(raw), awards, recentGames }
  })

  if (!payload) return context.json({ error: 'joueur introuvable' }, 404)
  return context.json(payload)
})

usersRoutes.get('/users/:user/progress', async (context) => {
  const user = context.req.param('user')

  const games = await cached(`user-progress:${user}`, TTL.user, async () => {
    const raw = await fetchRa<{ Results?: RaCompletionEntry[] }>('GetUserCompletionProgress', {
      u: user,
      c: 500,
    })
    return (raw.Results ?? []).map(
      (entry): PlayerGameProgress => ({
        gameId: entry.GameID,
        title: entry.Title,
        systemId: entry.ConsoleID,
        systemName: entry.ConsoleName,
        iconPath: entry.ImageIcon,
        maxPossible: entry.MaxPossible,
        numAwarded: entry.NumAwarded,
        numAwardedHardcore: entry.NumAwardedHardcore,
        highestAwardKind: entry.HighestAwardKind,
        mostRecentAwardedDate: entry.MostRecentAwardedDate,
      }),
    )
  })

  return context.json(games)
})
```

- [ ] **Step 6: Implémenter `server/routes/search.ts`**

```ts
import { Hono } from 'hono'

import type { PlayerProfile, SearchResults } from '../../src/lib/types'
import { TTL, cached } from '../cache'
import { type RaUserProfile, normalizePlayerProfile } from '../normalize'
import { fetchRa } from '../ra-client'
import { getIndexStatus, searchGames, searchSystems } from '../search-index'
import { loadSystems } from './systems'

async function findPlayer(query: string): Promise<PlayerProfile | null> {
  try {
    return await cached(`search-user:${query}`, TTL.user, async () => {
      const raw = await fetchRa<RaUserProfile>('GetUserProfile', { u: query })
      return raw?.User ? normalizePlayerProfile(raw) : null
    })
  } catch {
    // Un pseudo inconnu n'est pas une erreur de recherche : la section joueur reste vide.
    return null
  }
}

export const searchRoutes = new Hono()

searchRoutes.get('/search', async (context) => {
  const query = (context.req.query('q') ?? '').trim()
  if (!query) return context.json({ games: [], player: null, systems: [] } satisfies SearchResults)

  const status = getIndexStatus()
  if (!status.ready) {
    return context.json({ status: 'indexing', total: status.total }, 503)
  }

  const [player, systems] = await Promise.all([findPlayer(query), loadSystems()])

  return context.json({
    games: searchGames(query),
    player,
    systems: searchSystems(query, systems),
  } satisfies SearchResults)
})
```

- [ ] **Step 7: Implémenter `server/routes/leaderboards.ts`**

```ts
import { Hono } from 'hono'

import type { LeaderboardUser } from '../../src/lib/types'
import { TTL, cached } from '../cache'
import { fetchRa } from '../ra-client'

interface RaTopUser {
  '1': string
  '2': number
  '3': number
}

export const leaderboardsRoutes = new Hono()

leaderboardsRoutes.get('/leaderboards', async (context) => {
  const users = await cached('leaderboards', TTL.leaderboard, async () => {
    const raw = await fetchRa<RaTopUser[]>('GetTopTenUsers', {})
    return raw.map(
      (entry, position): LeaderboardUser => ({
        rank: position + 1,
        user: entry['1'],
        totalPoints: Number(entry['2']),
        totalTruePoints: Number(entry['3']),
      }),
    )
  })

  return context.json(users)
})
```

`API_GetTopTenUsers` retourne des objets à clés numériques `"1"`, `"2"`, `"3"` et non des champs nommés. Vérifier la forme réelle à l'implémentation avec `curl` et ajuster le mapping si l'API a changé — c'est le seul endpoint du plan dont le contrat n'a pas été validé en direct.

- [ ] **Step 8: Implémenter `server/index.ts`**

```ts
import { serveStatic } from '@hono/node-server/serve-static'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'

import { getEnv } from './env'
import { gamesRoutes } from './routes/games'
import { leaderboardsRoutes } from './routes/leaderboards'
import { searchRoutes } from './routes/search'
import { systemsRoutes } from './routes/systems'
import { usersRoutes } from './routes/users'
import { loadIndex } from './search-index'

export function createApp(): Hono {
  const app = new Hono()

  app.route('/api', systemsRoutes)
  app.route('/api', gamesRoutes)
  app.route('/api', usersRoutes)
  app.route('/api', searchRoutes)
  app.route('/api', leaderboardsRoutes)

  app.onError((error, context) => {
    const status = error instanceof Error && 'status' in error ? Number(error.status) : 502
    return context.json({ error: error.message }, status === 429 ? 429 : 502)
  })

  return app
}

const isEntryPoint = process.argv[1]?.endsWith('server/index.ts')

if (isEntryPoint) {
  const { port } = getEnv()
  const app = createApp()

  app.use('/*', serveStatic({ root: './dist' }))
  app.get('*', serveStatic({ path: './dist/index.html' }))

  loadIndex().then((ready) => {
    if (!ready) {
      process.stdout.write("Index de recherche absent. Lancez `npm run warm`.\n")
    }
  })

  serve({ fetch: app.fetch, port })
  process.stdout.write(`API sur http://localhost:${port}\n`)
}
```

- [ ] **Step 9: Lancer les tests de routes**

Run: `npx vitest run server/routes/routes.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 10: Vérifier le serveur contre l'API réelle**

Run: `npm run start` dans un terminal, puis dans un autre :

```bash
curl -s localhost:3001/api/games/1 | head -c 300
```

Expected: un JSON commençant par `{"id":1,"title":"Sonic the Hedgehog"`.

- [ ] **Step 11: Commit** (si autorisé)

```bash
git add server/
git commit -m "feat: add Hono proxy routes for systems, games, users, search and leaderboards"
```

---

## Task 6: Couche de données client

**Files:**
- Create: `src/lib/media.ts`, `src/composables/useApi.ts`, `src/stores/usePinnedPlayerStore.ts`
- Test: `src/lib/media.test.ts`, `src/composables/useApi.test.ts`, `src/stores/usePinnedPlayerStore.test.ts`

**Interfaces:**
- Consumes: types de `src/lib/types.ts` (Task 2).
- Produces:
  - `mediaUrl(path: string | null | undefined): string` — chaîne vide si absent.
  - `badgeUrl(badgeName: string, unlocked: boolean): string`
  - `useApi<T>(url: Ref<string | null> | (() => string | null)): { data: Ref<T | null>; error: Ref<ApiError | null>; pending: Ref<boolean>; reload: () => void }`
  - `ApiError` : `{ status: number; message: string; indexing: boolean }`
  - `usePinnedPlayerStore()` : `{ username: Ref<string | null>; pin(name: string): void; unpin(): void }`

- [ ] **Step 1: Écrire le test qui échoue pour `media.ts`**

Create `src/lib/media.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { badgeUrl, mediaUrl } from './media'

describe('mediaUrl', () => {
  it('prefixe un chemin relatif par la base media', () => {
    expect(mediaUrl('/Images/112941.png')).toBe(
      'https://media.retroachievements.org/Images/112941.png',
    )
  })

  it('laisse une URL absolue intacte', () => {
    const absolute = 'https://static.retroachievements.org/assets/images/system/md.png'
    expect(mediaUrl(absolute)).toBe(absolute)
  })

  it('retourne une chaine vide pour une valeur absente', () => {
    expect(mediaUrl(null)).toBe('')
    expect(mediaUrl(undefined)).toBe('')
    expect(mediaUrl('')).toBe('')
  })
})

describe('badgeUrl', () => {
  it('construit l\'URL du badge debloque', () => {
    expect(badgeUrl('250336', true)).toBe(
      'https://media.retroachievements.org/Badge/250336.png',
    )
  })

  it('utilise la variante _lock quand verrouille', () => {
    expect(badgeUrl('250336', false)).toBe(
      'https://media.retroachievements.org/Badge/250336_lock.png',
    )
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/lib/media.test.ts`
Expected: FAIL — `Failed to resolve import "./media"`.

- [ ] **Step 3: Implémenter `src/lib/media.ts`**

```ts
const MEDIA_BASE = 'https://media.retroachievements.org'

export function mediaUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${MEDIA_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

export function badgeUrl(badgeName: string, unlocked: boolean): string {
  return `${MEDIA_BASE}/Badge/${badgeName}${unlocked ? '' : '_lock'}.png`
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/lib/media.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Écrire le test qui échoue pour `useApi`**

Create `src/composables/useApi.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useApi } from './useApi'

async function flush(): Promise<void> {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

describe('useApi', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('charge les donnees et repasse pending a false', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), { status: 200 }),
    )

    const { data, pending, error } = useApi<{ id: number }>(ref('/api/games/1'))
    await flush()

    expect(data.value).toEqual({ id: 1 })
    expect(pending.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('expose une erreur avec son statut', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'jeu introuvable' }), { status: 404 }),
    )

    const { error, data } = useApi(ref('/api/games/999'))
    await flush()

    expect(error.value?.status).toBe(404)
    expect(error.value?.message).toBe('jeu introuvable')
    expect(data.value).toBeNull()
  })

  it('marque indexing sur un 503 status indexing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'indexing', total: 0 }), { status: 503 }),
    )

    const { error } = useApi(ref('/api/search?q=sonic'))
    await flush()

    expect(error.value?.indexing).toBe(true)
  })

  it('ne declenche aucun appel quand l\'url est null', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')

    const { pending } = useApi(ref(null))
    await flush()

    expect(spy).not.toHaveBeenCalled()
    expect(pending.value).toBe(false)
  })

  it('recharge quand l\'url change', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    )
    const url = ref('/api/games/1')

    useApi(ref(url.value))
    await flush()
    const first = spy.mock.calls.length

    const source = ref('/api/games/1')
    useApi(source)
    await flush()
    source.value = '/api/games/2'
    await flush()

    expect(spy.mock.calls.length).toBeGreaterThan(first + 1)
  })
})
```

- [ ] **Step 6: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/composables/useApi.test.ts`
Expected: FAIL — `Failed to resolve import "./useApi"`.

- [ ] **Step 7: Implémenter `src/composables/useApi.ts`**

```ts
import { type Ref, onUnmounted, ref, watch } from 'vue'

export interface ApiError {
  status: number
  message: string
  indexing: boolean
}

type UrlSource = Ref<string | null> | (() => string | null)

export function useApi<T>(source: UrlSource) {
  const data = ref<T | null>(null) as Ref<T | null>
  const error = ref<ApiError | null>(null)
  const pending = ref(false)

  let controller: AbortController | null = null

  async function load(): Promise<void> {
    const url = typeof source === 'function' ? source() : source.value
    controller?.abort()

    if (!url) {
      data.value = null
      error.value = null
      pending.value = false
      return
    }

    controller = new AbortController()
    pending.value = true
    error.value = null

    try {
      const response = await fetch(url, { signal: controller.signal })
      const body = (await response.json()) as Record<string, unknown>

      if (!response.ok) {
        data.value = null
        error.value = {
          status: response.status,
          message: typeof body.error === 'string' ? body.error : `Erreur ${response.status}`,
          indexing: body.status === 'indexing',
        }
        return
      }

      data.value = body as T
    } catch (caught: unknown) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return
      data.value = null
      error.value = { status: 0, message: 'Reseau indisponible', indexing: false }
    } finally {
      pending.value = false
    }
  }

  watch(
    typeof source === 'function' ? source : () => source.value,
    () => void load(),
    { immediate: true },
  )

  onUnmounted(() => controller?.abort())

  return { data, error, pending, reload: () => void load() }
}
```

- [ ] **Step 8: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/composables/useApi.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 9: Écrire le test qui échoue pour le store**

Create `src/stores/usePinnedPlayerStore.test.ts`:

```ts
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { usePinnedPlayerStore } from './usePinnedPlayerStore'

describe('usePinnedPlayerStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('demarre sans joueur epingle', () => {
    expect(usePinnedPlayerStore().username).toBeNull()
  })

  it('epingle un joueur et le persiste', () => {
    const store = usePinnedPlayerStore()
    store.pin('MaxMilyin')

    expect(store.username).toBe('MaxMilyin')
    expect(localStorage.getItem('ra:pinned-player')).toBe('MaxMilyin')
  })

  it('ignore un pseudo vide', () => {
    const store = usePinnedPlayerStore()
    store.pin('   ')

    expect(store.username).toBeNull()
  })

  it('desepingle et nettoie le stockage', () => {
    const store = usePinnedPlayerStore()
    store.pin('MaxMilyin')
    store.unpin()

    expect(store.username).toBeNull()
    expect(localStorage.getItem('ra:pinned-player')).toBeNull()
  })

  it('relit la valeur persistee a l\'initialisation', () => {
    localStorage.setItem('ra:pinned-player', 'Scott')
    setActivePinia(createPinia())

    expect(usePinnedPlayerStore().username).toBe('Scott')
  })
})
```

- [ ] **Step 10: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/stores/usePinnedPlayerStore.test.ts`
Expected: FAIL — `Failed to resolve import "./usePinnedPlayerStore"`.

- [ ] **Step 11: Implémenter `src/stores/usePinnedPlayerStore.ts`**

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'ra:pinned-player'

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    // Navigation privee ou stockage bloque : le site fonctionne sans joueur epingle.
    return null
  }
}

export const usePinnedPlayerStore = defineStore('pinnedPlayer', () => {
  const username = ref<string | null>(readStored())

  function pin(name: string): void {
    const trimmed = name.trim()
    if (!trimmed) return
    username.value = trimmed
    try {
      localStorage.setItem(STORAGE_KEY, trimmed)
    } catch {
      // Ignorer : l'epinglage reste valable pour la session en cours.
    }
  }

  function unpin(): void {
    username.value = null
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignorer.
    }
  }

  return { username, pin, unpin }
})
```

- [ ] **Step 12: Lancer toute la suite**

Run: `npx vitest run`
Expected: PASS, tous les tests des tâches 1 à 6.

- [ ] **Step 13: Commit** (si autorisé)

```bash
git add src/lib src/composables src/stores
git commit -m "feat: add client data layer with useApi, media helpers and pinned player store"
```

---

## Task 7: Coquille applicative mobile-first

**Files:**
- Create: `src/router/index.ts`, `src/App.vue` (remplace), `src/main.ts` (modifie)
- Create: `src/components/TheTopBar.vue`, `src/components/TheBottomNav.vue`
- Create: `src/components/StateEmpty.vue`, `src/components/StateError.vue`, `src/components/SkeletonBlock.vue`
- Create: `src/pages/HomePage.vue`, `src/pages/SearchPage.vue`, `src/pages/SystemsPage.vue`, `src/pages/SystemGamesPage.vue`, `src/pages/GamePage.vue`, `src/pages/PlayerPage.vue`, `src/pages/LeaderboardsPage.vue`, `src/pages/NotFoundPage.vue`
- Test: `src/components/TheBottomNav.test.ts`

**Interfaces:**
- Consumes: rien des tâches précédentes hormis les styles.
- Produces: routes nommées `home`, `search`, `systems`, `system-games`, `game`, `player`, `leaderboards`, `not-found`. Composants `StateEmpty` (props `title`, `hint?`), `StateError` (props `message`, `onRetry?`), `SkeletonBlock` (props `height`, `width?`).

- [ ] **Step 1: Créer `src/router/index.ts`**

```ts
import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: (to, from, saved) => saved ?? { top: 0 },
  routes: [
    { path: '/', name: 'home', component: () => import('@/pages/HomePage.vue') },
    { path: '/search', name: 'search', component: () => import('@/pages/SearchPage.vue') },
    { path: '/systems', name: 'systems', component: () => import('@/pages/SystemsPage.vue') },
    {
      path: '/systems/:systemId',
      name: 'system-games',
      component: () => import('@/pages/SystemGamesPage.vue'),
      props: true,
    },
    {
      path: '/games/:gameId',
      name: 'game',
      component: () => import('@/pages/GamePage.vue'),
      props: true,
    },
    {
      path: '/users/:username',
      name: 'player',
      component: () => import('@/pages/PlayerPage.vue'),
      props: true,
    },
    {
      path: '/leaderboards',
      name: 'leaderboards',
      component: () => import('@/pages/LeaderboardsPage.vue'),
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFoundPage.vue') },
  ],
})
```

- [ ] **Step 2: Écrire le test qui échoue pour la barre d'onglets**

Create `src/components/TheBottomNav.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { RouterLinkStub } from '@vue/test-utils'

import TheBottomNav from './TheBottomNav.vue'

function mountNav() {
  return mount(TheBottomNav, {
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
}

describe('TheBottomNav', () => {
  it('expose quatre destinations', () => {
    expect(mountNav().findAll('[data-nav-item]')).toHaveLength(4)
  })

  it('porte un role de navigation nomme', () => {
    const nav = mountNav().get('nav')

    expect(nav.attributes('aria-label')).toBe('Navigation principale')
  })

  it('reserve la zone sure du bas', () => {
    expect(mountNav().get('nav').classes().join(' ')).toContain('pb-[env(safe-area-inset-bottom)]')
  })

  it('emet une demande de recherche au lieu de naviguer', async () => {
    const wrapper = mountNav()
    await wrapper.get('[data-nav-search]').trigger('click')

    expect(wrapper.emitted('open-search')).toHaveLength(1)
  })

  it('est masquee au-dessus du point de rupture md', () => {
    expect(mountNav().get('nav').classes()).toContain('md:hidden')
  })
})
```

- [ ] **Step 3: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/components/TheBottomNav.test.ts`
Expected: FAIL — fichier `TheBottomNav.vue` introuvable.

- [ ] **Step 4: Implémenter `src/components/TheBottomNav.vue`**

```vue
<script setup lang="ts">
defineEmits<{ 'open-search': [] }>()

const destinations = [
  { name: 'home', label: 'Accueil', glyph: '▲' },
  { name: 'systems', label: 'Consoles', glyph: '◼' },
  { name: 'leaderboards', label: 'Classements', glyph: '★' },
] as const
</script>

<template>
  <nav
    aria-label="Navigation principale"
    class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-edge bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
  >
    <RouterLink
      v-for="destination in destinations"
      :key="destination.name"
      :to="{ name: destination.name }"
      data-nav-item
      class="flex min-h-11 flex-col items-center justify-center gap-1 py-2 text-muted"
      active-class="text-phosphor"
    >
      <span aria-hidden="true" class="text-base leading-none">{{ destination.glyph }}</span>
      <span class="tag">{{ destination.label }}</span>
    </RouterLink>

    <button
      type="button"
      data-nav-item
      data-nav-search
      class="flex min-h-11 flex-col items-center justify-center gap-1 py-2 text-muted"
      @click="$emit('open-search')"
    >
      <span aria-hidden="true" class="text-base leading-none">⌕</span>
      <span class="tag">Recherche</span>
    </button>
  </nav>
</template>
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/components/TheBottomNav.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Implémenter `src/components/TheTopBar.vue`**

```vue
<script setup lang="ts">
defineEmits<{ 'open-search': [] }>()

const destinations = [
  { name: 'home', label: 'Accueil' },
  { name: 'systems', label: 'Consoles' },
  { name: 'leaderboards', label: 'Classements' },
] as const
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-edge bg-bg/90 backdrop-blur">
    <div class="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 md:h-[60px]">
      <RouterLink :to="{ name: 'home' }" class="flex items-center gap-2">
        <span
          aria-hidden="true"
          class="grid size-6 place-items-center bg-phosphor font-pixel text-[10px] text-bg"
        >RA</span>
        <span class="font-display text-lg font-bold uppercase tracking-wide">RetroAchievements</span>
      </RouterLink>

      <nav aria-label="Sections" class="hidden gap-6 md:flex">
        <RouterLink
          v-for="destination in destinations"
          :key="destination.name"
          :to="{ name: destination.name }"
          class="border-b-2 border-transparent py-1 font-display text-base font-semibold uppercase tracking-wider text-muted hover:text-ink"
          active-class="border-phosphor text-ink"
        >
          {{ destination.label }}
        </RouterLink>
      </nav>

      <button
        type="button"
        class="ml-auto flex min-h-11 items-center gap-3 border border-edge bg-surface px-3 text-sm text-muted md:min-w-64"
        @click="$emit('open-search')"
      >
        <span aria-hidden="true">⌕</span>
        <span class="hidden md:inline">Rechercher un jeu, un joueur…</span>
        <span class="sr-only md:hidden">Rechercher</span>
        <kbd class="num ml-auto hidden border border-edge bg-raised px-1.5 py-0.5 text-[11px] pointer-fine:inline">
          ⌘K
        </kbd>
      </button>
    </div>
  </header>
</template>
```

Ajouter la variante `pointer-fine` dans `src/styles/main.css` pour masquer l'indice clavier sur écran tactile :

```css
@custom-variant pointer-fine (@media (pointer: fine));
```

- [ ] **Step 7: Implémenter les composants d'état**

`src/components/SkeletonBlock.vue` :

```vue
<script setup lang="ts">
defineProps<{ height: string; width?: string }>()
</script>

<template>
  <div
    aria-hidden="true"
    class="animate-pulse bg-raised"
    :style="{ height, width: width ?? '100%' }"
  />
</template>
```

`src/components/StateEmpty.vue` :

```vue
<script setup lang="ts">
defineProps<{ title: string; hint?: string }>()
</script>

<template>
  <div class="border border-edge bg-surface px-4 py-10 text-center">
    <p class="font-display text-xl uppercase tracking-wide">{{ title }}</p>
    <p v-if="hint" class="mt-2 text-sm text-muted">{{ hint }}</p>
  </div>
</template>
```

`src/components/StateError.vue` :

```vue
<script setup lang="ts">
defineProps<{ message: string }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="border border-magenta/40 bg-surface px-4 py-8 text-center">
    <p class="tag text-magenta">Erreur</p>
    <p class="mt-3 text-sm text-ink">{{ message }}</p>
    <button
      type="button"
      class="mt-4 min-h-11 border border-edge bg-raised px-4 font-display uppercase tracking-wider"
      @click="$emit('retry')"
    >
      Reessayer
    </button>
  </div>
</template>
```

- [ ] **Step 8: Implémenter `src/App.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue'

import TheBottomNav from '@/components/TheBottomNav.vue'
import TheTopBar from '@/components/TheTopBar.vue'

const isSearchOpen = ref(false)
</script>

<template>
  <TheTopBar @open-search="isSearchOpen = true" />

  <!-- pb-20 reserve la hauteur de la barre d'onglets, qui est en position fixe. -->
  <main class="mx-auto max-w-6xl px-4 pb-20 pt-4 md:pb-10">
    <RouterView />
  </main>

  <TheBottomNav @open-search="isSearchOpen = true" />
</template>
```

- [ ] **Step 9: Mettre à jour `src/main.ts`**

```ts
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import { router } from './router'
import './styles/main.css'

createApp(App).use(createPinia()).use(router).mount('#app')
```

- [ ] **Step 10: Créer les huit pages en placeholder minimal**

Chaque page reçoit le même squelette, avec son titre propre. Exemple pour `src/pages/HomePage.vue` :

```vue
<script setup lang="ts">
</script>

<template>
  <h1 class="font-display text-2xl uppercase tracking-wide">Accueil</h1>
</template>
```

Répéter pour `SearchPage` (« Recherche »), `SystemsPage` (« Consoles »), `SystemGamesPage` (« Jeux »), `GamePage` (« Jeu »), `PlayerPage` (« Joueur »), `LeaderboardsPage` (« Classements »), `NotFoundPage` (« Page introuvable »). Ces contenus sont remplacés aux tâches 9 à 11 ; ils existent ici pour que le routeur soit testable dès maintenant.

- [ ] **Step 11: Vérifier le rendu mobile**

Run: `npm run dev`, puis ouvrir `http://localhost:5173` avec une fenêtre de 375 px de large.

Expected: la barre d'onglets est collée en bas, chaque cible fait au moins 44 px de haut, le contenu ne passe pas dessous, aucun défilement horizontal. À 768 px, la barre d'onglets disparaît et la navigation du haut apparaît.

- [ ] **Step 12: Commit** (si autorisé)

```bash
git add src/
git commit -m "feat: add mobile-first app shell with bottom nav and router"
```

---

## Task 8: Recherche — feuille plein écran mobile et ⌘K desktop

**Files:**
- Create: `src/components/SearchOverlay.vue`, `src/composables/useDebouncedRef.ts`
- Modify: `src/App.vue` (monter l'overlay), `src/pages/SearchPage.vue`
- Test: `src/composables/useDebouncedRef.test.ts`, `src/components/SearchOverlay.test.ts`

**Interfaces:**
- Consumes: `useApi` (Task 6), `mediaUrl` (Task 6), `formatNumber` (Task 1), `SearchResults` (Task 2).
- Produces: `useDebouncedRef<T>(source: Ref<T>, delayMs: number): Ref<T>`. `SearchOverlay` avec prop `open: boolean` et émission `close`.

- [ ] **Step 1: Écrire le test qui échoue pour le debounce**

Create `src/composables/useDebouncedRef.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useDebouncedRef } from './useDebouncedRef'

describe('useDebouncedRef', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('conserve la valeur initiale immediatement', () => {
    expect(useDebouncedRef(ref('sonic'), 200).value).toBe('sonic')
  })

  it('ne propage la nouvelle valeur qu\'apres le delai', async () => {
    vi.useFakeTimers()
    const source = ref('so')
    const debounced = useDebouncedRef(source, 200)

    source.value = 'sonic'
    await nextTick()
    expect(debounced.value).toBe('so')

    vi.advanceTimersByTime(200)
    await nextTick()
    expect(debounced.value).toBe('sonic')
  })

  it('ne retient que la derniere valeur d\'une rafale', async () => {
    vi.useFakeTimers()
    const source = ref('s')
    const debounced = useDebouncedRef(source, 200)

    source.value = 'so'
    await nextTick()
    vi.advanceTimersByTime(100)
    source.value = 'son'
    await nextTick()
    vi.advanceTimersByTime(200)
    await nextTick()

    expect(debounced.value).toBe('son')
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/composables/useDebouncedRef.test.ts`
Expected: FAIL — `Failed to resolve import "./useDebouncedRef"`.

- [ ] **Step 3: Implémenter `src/composables/useDebouncedRef.ts`**

```ts
import { type Ref, onUnmounted, ref, watch } from 'vue'

export function useDebouncedRef<T>(source: Ref<T>, delayMs: number): Ref<T> {
  const debounced = ref(source.value) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | null = null

  watch(source, (value) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      debounced.value = value
    }, delayMs)
  })

  onUnmounted(() => {
    if (timer) clearTimeout(timer)
  })

  return debounced
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/composables/useDebouncedRef.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Écrire le test qui échoue pour l'overlay**

Create `src/components/SearchOverlay.test.ts`:

```ts
import { RouterLinkStub, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import SearchOverlay from './SearchOverlay.vue'

function mountOverlay(open = true) {
  return mount(SearchOverlay, {
    props: { open },
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
}

describe('SearchOverlay', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ games: [], player: null, systems: [] }), { status: 200 }),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ne rend rien quand il est ferme', () => {
    expect(mountOverlay(false).find('[data-search-dialog]').exists()).toBe(false)
  })

  it('expose un role de dialogue modal', () => {
    const dialog = mountOverlay().get('[data-search-dialog]')

    expect(dialog.attributes('role')).toBe('dialog')
    expect(dialog.attributes('aria-modal')).toBe('true')
  })

  it('cable le champ en combobox', () => {
    const input = mountOverlay().get('input')

    expect(input.attributes('role')).toBe('combobox')
    expect(input.attributes('aria-expanded')).toBe('true')
  })

  it('emet close sur Echap', async () => {
    const wrapper = mountOverlay()
    await wrapper.get('[data-search-dialog]').trigger('keydown', { key: 'Escape' })

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('affiche l\'etat indexation sur un 503', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'indexing', total: 0 }), { status: 503 }),
    )
    const wrapper = mountOverlay()
    await wrapper.get('input').setValue('sonic')
    await new Promise((resolve) => setTimeout(resolve, 260))
    await nextTick()

    expect(wrapper.text()).toContain('Index en construction')
  })
})
```

- [ ] **Step 6: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/components/SearchOverlay.test.ts`
Expected: FAIL — fichier `SearchOverlay.vue` introuvable.

- [ ] **Step 7: Implémenter `src/components/SearchOverlay.vue`**

```vue
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import StateEmpty from '@/components/StateEmpty.vue'
import { useApi } from '@/composables/useApi'
import { useDebouncedRef } from '@/composables/useDebouncedRef'
import { formatNumber } from '@/lib/format'
import { mediaUrl } from '@/lib/media'
import type { SearchResults } from '@/lib/types'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const query = ref('')
const debouncedQuery = useDebouncedRef(query, 200)
const input = ref<HTMLInputElement | null>(null)

const { data, error, pending } = useApi<SearchResults>(() =>
  debouncedQuery.value.trim().length >= 2
    ? `/api/search?q=${encodeURIComponent(debouncedQuery.value.trim())}`
    : null,
)

const hasResults = computed(
  () =>
    (data.value?.games.length ?? 0) > 0 ||
    (data.value?.systems.length ?? 0) > 0 ||
    data.value?.player != null,
)

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    await nextTick()
    input.value?.focus()
  },
)

function close(): void {
  query.value = ''
  emit('close')
}
</script>

<template>
  <div
    v-if="open"
    data-search-dialog
    role="dialog"
    aria-modal="true"
    aria-label="Recherche"
    class="fixed inset-0 z-50 flex flex-col bg-bg md:items-start md:justify-center md:bg-bg/80 md:p-8 md:backdrop-blur"
    @keydown.escape="close"
  >
    <div class="flex w-full flex-col overflow-hidden border-edge bg-surface md:mx-auto md:max-w-2xl md:border md:shadow-[6px_6px_0_rgba(0,0,0,.5)] flex-1 md:flex-none md:max-h-[70vh]">
      <div class="flex items-center gap-3 border-b border-edge px-4 py-3">
        <span aria-hidden="true" class="num text-phosphor">&gt;</span>
        <input
          ref="input"
          v-model="query"
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls="search-results"
          placeholder="Jeu, joueur, console…"
          class="min-h-11 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted"
        />
        <button type="button" class="tag min-h-11 px-2 text-muted" @click="close">Fermer</button>
      </div>

      <div id="search-results" class="flex-1 overflow-y-auto">
        <p v-if="pending" class="px-4 py-6 text-sm text-muted">Recherche…</p>

        <StateEmpty
          v-else-if="error?.indexing"
          title="Index en construction"
          hint="Lancez `npm run warm` pour construire l'index de recherche."
          class="m-4"
        />

        <StateEmpty
          v-else-if="error"
          :title="error.message"
          class="m-4"
        />

        <template v-else-if="data && hasResults">
          <section v-if="data.player" class="border-b border-edge py-2">
            <p class="tag px-4 pb-2 text-muted">Joueur — pseudo exact</p>
            <RouterLink
              :to="{ name: 'player', params: { username: data.player.user } }"
              class="flex min-h-11 items-center gap-3 px-4 py-2 hover:bg-raised"
              @click="close"
            >
              <img
                :src="mediaUrl(data.player.avatarPath)"
                :alt="''"
                width="32"
                height="32"
                class="is-pixel size-8 border border-edge"
              />
              <span class="min-w-0">
                <span class="block truncate text-sm">{{ data.player.user }}</span>
                <span class="block text-xs text-muted">Rang {{ formatNumber(data.player.rank) }}</span>
              </span>
              <span class="num ml-auto shrink-0 text-xs text-muted">
                {{ formatNumber(data.player.totalPoints) }} pts
              </span>
            </RouterLink>
          </section>

          <section v-if="data.games.length" class="py-2">
            <p class="tag px-4 pb-2 text-muted">Jeux</p>
            <RouterLink
              v-for="game in data.games"
              :key="game.id"
              :to="{ name: 'game', params: { gameId: game.id } }"
              class="flex min-h-11 items-center gap-3 px-4 py-2 hover:bg-raised"
              @click="close"
            >
              <img
                :src="mediaUrl(game.iconPath)"
                alt=""
                width="32"
                height="32"
                loading="lazy"
                class="is-pixel size-8 border border-edge"
              />
              <span class="min-w-0">
                <span class="block truncate text-sm">{{ game.title }}</span>
                <span class="block truncate text-xs text-muted">{{ game.systemName }}</span>
              </span>
              <span class="num ml-auto shrink-0 text-xs text-muted">{{ game.numAchievements }} ach</span>
            </RouterLink>
          </section>

          <section v-if="data.systems.length" class="border-t border-edge py-2">
            <p class="tag px-4 pb-2 text-muted">Consoles</p>
            <RouterLink
              v-for="system in data.systems"
              :key="system.id"
              :to="{ name: 'system-games', params: { systemId: system.id } }"
              class="flex min-h-11 items-center px-4 py-2 text-sm hover:bg-raised"
              @click="close"
            >
              {{ system.name }}
            </RouterLink>
          </section>
        </template>

        <StateEmpty
          v-else-if="debouncedQuery.trim().length >= 2"
          title="Aucun resultat"
          hint="La recherche de joueur exige le pseudo exact."
          class="m-4"
        />

        <p v-else class="px-4 py-6 text-sm text-muted">Saisissez au moins deux caracteres.</p>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 8: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/components/SearchOverlay.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 9: Monter l'overlay et le raccourci clavier dans `src/App.vue`**

Remplacer le `<script setup>` de `src/App.vue` :

```ts
import { onMounted, onUnmounted, ref } from 'vue'

import SearchOverlay from '@/components/SearchOverlay.vue'
import TheBottomNav from '@/components/TheBottomNav.vue'
import TheTopBar from '@/components/TheTopBar.vue'

const isSearchOpen = ref(false)

function onKeydown(event: KeyboardEvent): void {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    isSearchOpen.value = true
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
```

Et ajouter avant la fermeture du template :

```html
<SearchOverlay :open="isSearchOpen" @close="isSearchOpen = false" />
```

- [ ] **Step 10: Implémenter `src/pages/SearchPage.vue`**

La page réutilise l'overlay en mode toujours ouvert, alimentée par le paramètre `q` de l'URL, afin qu'un résultat de recherche soit partageable :

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import StateEmpty from '@/components/StateEmpty.vue'
import { useApi } from '@/composables/useApi'
import { mediaUrl } from '@/lib/media'
import type { SearchResults } from '@/lib/types'

const route = useRoute()
const query = computed(() => String(route.query.q ?? '').trim())

const { data, error, pending } = useApi<SearchResults>(() =>
  query.value.length >= 2 ? `/api/search?q=${encodeURIComponent(query.value)}` : null,
)
</script>

<template>
  <h1 class="font-display text-2xl uppercase tracking-wide">
    Recherche<span v-if="query" class="text-muted"> — {{ query }}</span>
  </h1>

  <p v-if="pending" class="mt-4 text-sm text-muted">Recherche…</p>

  <StateEmpty
    v-else-if="error?.indexing"
    class="mt-4"
    title="Index en construction"
    hint="Lancez `npm run warm` pour construire l'index de recherche."
  />

  <StateEmpty v-else-if="!query" class="mt-4" title="Saisissez une recherche" />

  <ul v-else-if="data?.games.length" class="mt-4 grid gap-2">
    <li v-for="game in data.games" :key="game.id">
      <RouterLink
        :to="{ name: 'game', params: { gameId: game.id } }"
        class="flex min-h-11 items-center gap-3 border border-edge bg-surface p-3"
      >
        <img
          :src="mediaUrl(game.iconPath)"
          alt=""
          width="40"
          height="40"
          loading="lazy"
          class="is-pixel size-10 border border-edge"
        />
        <span class="min-w-0">
          <span class="block truncate font-display text-lg">{{ game.title }}</span>
          <span class="block truncate text-xs text-muted">{{ game.systemName }}</span>
        </span>
        <span class="num ml-auto shrink-0 text-xs text-muted">{{ game.numAchievements }} ach</span>
      </RouterLink>
    </li>
  </ul>

  <StateEmpty v-else class="mt-4" title="Aucun resultat" />
</template>
```

- [ ] **Step 11: Vérifier le comportement mobile**

Run: `npm run dev`, fenêtre à 375 px.

Expected: le bouton Recherche de la barre d'onglets ouvre une feuille plein écran, le champ prend le focus et le clavier système s'ouvre, l'indice `⌘K` est absent. À 1024 px, `⌘K` ouvre la palette centrée et l'indice est visible.

- [ ] **Step 12: Commit** (si autorisé)

```bash
git add src/
git commit -m "feat: add search overlay with mobile sheet and desktop command palette"
```

---

## Task 9: Fiche jeu et liste d'achievements

**Files:**
- Create: `src/composables/useAchievementFilters.ts`
- Create: `src/components/GameHero.vue`, `src/components/ProgressMeter.vue`, `src/components/AchievementRow.vue`, `src/components/AchievementFilters.vue`, `src/components/AchievementList.vue`, `src/components/PinPlayerPrompt.vue`
- Modify: `src/pages/GamePage.vue`
- Test: `src/composables/useAchievementFilters.test.ts`, `src/components/AchievementRow.test.ts`

**Interfaces:**
- Consumes: `useApi` (Task 6), `badgeUrl` / `mediaUrl` (Task 6), `formatNumber` / `formatPercent` / `formatDate` (Task 1), `usePinnedPlayerStore` (Task 6), `Achievement` / `GameDetail` / `GameProgress` (Task 2).
- Produces:
  - `type AchievementFilter = 'all' | 'unlocked' | 'locked' | 'progression' | 'win_condition' | 'missable'`
  - `type AchievementSort = 'display' | 'points' | 'rarity' | 'earned'`
  - `useAchievementFilters(source: Ref<Achievement[]>): { filter: Ref<AchievementFilter>; sort: Ref<AchievementSort>; visible: ComputedRef<Achievement[]>; counts: ComputedRef<Record<AchievementFilter, number>> }` — `filter` et `sort` sont synchronisés avec les query params `filter` et `sort`.
  - `unlockState(achievement: Achievement): 'hardcore' | 'softcore' | 'locked'`

- [ ] **Step 1: Écrire le test qui échoue pour les filtres**

Create `src/composables/useAchievementFilters.test.ts`:

```ts
import { createRouter, createWebHistory } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'

import { unlockState, useAchievementFilters } from './useAchievementFilters'
import type { Achievement } from '@/lib/types'

function makeAchievement(overrides: Partial<Achievement>): Achievement {
  return {
    id: 1, title: 'A', description: '', points: 5, trueRatio: 5, badgeName: '1',
    displayOrder: 1, type: null, numAwarded: 10, numAwardedHardcore: 5,
    unlockRate: 50, unlockRateHardcore: 25, dateEarned: null, dateEarnedHardcore: null,
    ...overrides,
  }
}

const HARDCORE = makeAchievement({ id: 1, displayOrder: 3, points: 5, unlockRate: 90, dateEarned: '2026-01-01 00:00:00', dateEarnedHardcore: '2026-01-01 00:00:00' })
const SOFTCORE = makeAchievement({ id: 2, displayOrder: 1, points: 25, unlockRate: 10, dateEarned: '2026-02-01 00:00:00', type: 'progression' })
const LOCKED = makeAchievement({ id: 3, displayOrder: 2, points: 10, unlockRate: 3, type: 'missable' })

async function withComposable(run: (api: ReturnType<typeof useAchievementFilters>) => void) {
  const router = createRouter({ history: createWebHistory(), routes: [{ path: '/:x*', component: { template: '<div/>' } }] })
  await router.push('/games/1')
  await router.isReady()

  const Harness = defineComponent({
    setup() {
      const api = useAchievementFilters(ref([HARDCORE, SOFTCORE, LOCKED]))
      run(api)
      return () => h('div')
    },
  })

  mount(Harness, { global: { plugins: [router] } })
}

describe('unlockState', () => {
  it('distingue les trois etats', () => {
    expect(unlockState(HARDCORE)).toBe('hardcore')
    expect(unlockState(SOFTCORE)).toBe('softcore')
    expect(unlockState(LOCKED)).toBe('locked')
  })
})

describe('useAchievementFilters', () => {
  it('affiche tout par defaut, trie par displayOrder', async () => {
    await withComposable((api) => {
      expect(api.visible.value.map((a) => a.id)).toEqual([2, 3, 1])
    })
  })

  it('filtre les debloques', async () => {
    await withComposable((api) => {
      api.filter.value = 'unlocked'
      expect(api.visible.value.map((a) => a.id).sort()).toEqual([1, 2])
    })
  })

  it('filtre les verrouilles', async () => {
    await withComposable((api) => {
      api.filter.value = 'locked'
      expect(api.visible.value.map((a) => a.id)).toEqual([3])
    })
  })

  it('filtre par type', async () => {
    await withComposable((api) => {
      api.filter.value = 'missable'
      expect(api.visible.value.map((a) => a.id)).toEqual([3])
    })
  })

  it('trie par points decroissants', async () => {
    await withComposable((api) => {
      api.sort.value = 'points'
      expect(api.visible.value.map((a) => a.points)).toEqual([25, 10, 5])
    })
  })

  it('trie par rarete croissante, le plus rare en premier', async () => {
    await withComposable((api) => {
      api.sort.value = 'rarity'
      expect(api.visible.value.map((a) => a.unlockRate)).toEqual([3, 10, 90])
    })
  })

  it('trie par date de deblocage, les non debloques en dernier', async () => {
    await withComposable((api) => {
      api.sort.value = 'earned'
      expect(api.visible.value.map((a) => a.id)).toEqual([2, 1, 3])
    })
  })

  it('compte chaque categorie', async () => {
    await withComposable((api) => {
      expect(api.counts.value.all).toBe(3)
      expect(api.counts.value.unlocked).toBe(2)
      expect(api.counts.value.locked).toBe(1)
      expect(api.counts.value.missable).toBe(1)
    })
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/composables/useAchievementFilters.test.ts`
Expected: FAIL — `Failed to resolve import "./useAchievementFilters"`.

- [ ] **Step 3: Implémenter `src/composables/useAchievementFilters.ts`**

```ts
import { type ComputedRef, type Ref, computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { Achievement } from '@/lib/types'

export type AchievementFilter =
  | 'all'
  | 'unlocked'
  | 'locked'
  | 'progression'
  | 'win_condition'
  | 'missable'

export type AchievementSort = 'display' | 'points' | 'rarity' | 'earned'

const FILTERS: readonly AchievementFilter[] = [
  'all', 'unlocked', 'locked', 'progression', 'win_condition', 'missable',
]
const SORTS: readonly AchievementSort[] = ['display', 'points', 'rarity', 'earned']

export function unlockState(achievement: Achievement): 'hardcore' | 'softcore' | 'locked' {
  if (achievement.dateEarnedHardcore) return 'hardcore'
  if (achievement.dateEarned) return 'softcore'
  return 'locked'
}

function matches(achievement: Achievement, filter: AchievementFilter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'unlocked':
      return unlockState(achievement) !== 'locked'
    case 'locked':
      return unlockState(achievement) === 'locked'
    default:
      return achievement.type === filter
  }
}

export function useAchievementFilters(source: Ref<Achievement[]>) {
  const route = useRoute()
  const router = useRouter()

  const initialFilter = String(route.query.filter ?? '') as AchievementFilter
  const initialSort = String(route.query.sort ?? '') as AchievementSort

  const filter = ref<AchievementFilter>(FILTERS.includes(initialFilter) ? initialFilter : 'all')
  const sort = ref<AchievementSort>(SORTS.includes(initialSort) ? initialSort : 'display')

  // Les filtres vivent dans l'URL pour qu'une vue filtree soit partageable.
  watch([filter, sort], () => {
    void router.replace({
      query: {
        ...route.query,
        filter: filter.value === 'all' ? undefined : filter.value,
        sort: sort.value === 'display' ? undefined : sort.value,
      },
    })
  })

  const visible = computed(() => {
    const kept = source.value.filter((achievement) => matches(achievement, filter.value))

    switch (sort.value) {
      case 'points':
        return kept.sort((a, b) => b.points - a.points || a.displayOrder - b.displayOrder)
      case 'rarity':
        return kept.sort((a, b) => a.unlockRate - b.unlockRate || a.displayOrder - b.displayOrder)
      case 'earned':
        return kept.sort((a, b) => {
          const left = a.dateEarnedHardcore ?? a.dateEarned
          const right = b.dateEarnedHardcore ?? b.dateEarned
          if (left && right) return left.localeCompare(right)
          if (left) return -1
          if (right) return 1
          return a.displayOrder - b.displayOrder
        })
      default:
        return kept.sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id)
    }
  })

  const counts = computed(() => {
    const result = Object.fromEntries(FILTERS.map((key) => [key, 0])) as Record<
      AchievementFilter,
      number
    >
    for (const achievement of source.value) {
      for (const key of FILTERS) {
        if (matches(achievement, key)) result[key] += 1
      }
    }
    return result
  })

  return { filter, sort, visible, counts }
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/composables/useAchievementFilters.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Écrire le test qui échoue pour `AchievementRow`**

Create `src/components/AchievementRow.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AchievementRow from './AchievementRow.vue'
import type { Achievement } from '@/lib/types'

function makeAchievement(overrides: Partial<Achievement> = {}): Achievement {
  return {
    id: 9, title: 'That Was Easy', description: 'Complete the first act of Green Hill Zone.',
    points: 3, trueRatio: 3, badgeName: '250336', displayOrder: 1, type: 'progression',
    numAwarded: 54785, numAwardedHardcore: 25640, unlockRate: 90.22, unlockRateHardcore: 42.22,
    dateEarned: null, dateEarnedHardcore: null,
    ...overrides,
  }
}

describe('AchievementRow', () => {
  it('utilise le badge _lock quand verrouille', () => {
    const wrapper = mount(AchievementRow, { props: { achievement: makeAchievement() } })

    expect(wrapper.get('img').attributes('src')).toContain('250336_lock.png')
  })

  it('utilise le badge normal quand debloque', () => {
    const wrapper = mount(AchievementRow, {
      props: { achievement: makeAchievement({ dateEarnedHardcore: '2026-01-01 00:00:00' }) },
    })

    expect(wrapper.get('img').attributes('src')).toContain('250336.png')
    expect(wrapper.get('img').attributes('src')).not.toContain('_lock')
  })

  it('affiche l\'etat en texte, pas seulement en couleur', () => {
    const locked = mount(AchievementRow, { props: { achievement: makeAchievement() } })
    const hardcore = mount(AchievementRow, {
      props: { achievement: makeAchievement({ dateEarnedHardcore: '2026-01-01 00:00:00' }) },
    })
    const softcore = mount(AchievementRow, {
      props: { achievement: makeAchievement({ dateEarned: '2026-01-01 00:00:00' }) },
    })

    expect(locked.text()).toContain('LOCKED')
    expect(hardcore.text()).toContain('HARDCORE')
    expect(softcore.text()).toContain('SOFTCORE')
  })

  it('donne un alt descriptif au badge', () => {
    const wrapper = mount(AchievementRow, { props: { achievement: makeAchievement() } })

    expect(wrapper.get('img').attributes('alt')).toBe('Badge verrouille : That Was Easy')
  })

  it('rend le badge en pixel art non lisse', () => {
    const wrapper = mount(AchievementRow, { props: { achievement: makeAchievement() } })

    expect(wrapper.get('img').classes()).toContain('is-pixel')
  })

  it('affiche le taux de deblocage et le TrueRatio', () => {
    const wrapper = mount(AchievementRow, { props: { achievement: makeAchievement() } })

    expect(wrapper.text()).toContain('90,2 %')
    expect(wrapper.text()).toContain('TrueRatio 3')
  })
})
```

- [ ] **Step 6: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/components/AchievementRow.test.ts`
Expected: FAIL — fichier `AchievementRow.vue` introuvable.

- [ ] **Step 7: Implémenter `src/components/AchievementRow.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'

import { unlockState } from '@/composables/useAchievementFilters'
import { formatPercent } from '@/lib/format'
import { badgeUrl } from '@/lib/media'
import type { Achievement } from '@/lib/types'

const props = defineProps<{ achievement: Achievement }>()

const state = computed(() => unlockState(props.achievement))
const isUnlocked = computed(() => state.value !== 'locked')

const STATE_LABEL = { hardcore: 'HARDCORE', softcore: 'SOFTCORE', locked: 'LOCKED' } as const
const STATE_EDGE = {
  hardcore: 'border-l-phosphor',
  softcore: 'border-l-amber',
  locked: 'border-l-edge bg-bg',
} as const
const STATE_TEXT = {
  hardcore: 'text-phosphor',
  softcore: 'text-amber',
  locked: 'text-muted',
} as const

const TYPE_LABEL = {
  progression: 'Progression',
  win_condition: 'Win condition',
  missable: 'Missable',
} as const

const badgeAlt = computed(
  () =>
    `${isUnlocked.value ? 'Badge' : 'Badge verrouille'} : ${props.achievement.title}`,
)
</script>

<template>
  <article
    class="flex items-start gap-3 border border-l-[3px] border-edge bg-surface p-3 sm:items-center sm:gap-4 sm:p-4"
    :class="STATE_EDGE[state]"
  >
    <img
      :src="badgeUrl(achievement.badgeName, isUnlocked)"
      :alt="badgeAlt"
      width="48"
      height="48"
      loading="lazy"
      class="is-pixel size-12 shrink-0 border border-edge sm:size-16"
      :class="{ 'brightness-[.8]': !isUnlocked }"
    />

    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3
          class="font-display text-base font-semibold leading-tight sm:text-lg"
          :class="{ 'text-muted': !isUnlocked }"
        >
          {{ achievement.title }}
        </h3>
        <span
          v-if="achievement.type"
          class="tag border border-cyan/40 bg-cyan/10 px-1.5 py-0.5 text-cyan"
        >
          {{ TYPE_LABEL[achievement.type] }}
        </span>
      </div>

      <p class="mt-0.5 line-clamp-2 text-xs text-muted sm:text-sm">
        {{ achievement.description }}
      </p>

      <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-muted">
        <span class="tag border border-current px-1.5 py-0.5" :class="STATE_TEXT[state]">
          {{ STATE_LABEL[state] }}
        </span>
        <span class="num" :class="{ 'text-magenta': achievement.unlockRate < 15 }">
          {{ formatPercent(achievement.unlockRate) }} des joueurs
        </span>
        <span class="relative hidden h-1 max-w-40 flex-1 border border-edge bg-bg sm:block">
          <span
            class="absolute inset-y-0 left-0 bg-magenta"
            :style="{ width: `${Math.min(achievement.unlockRate, 100)}%` }"
          />
        </span>
        <span class="num">TrueRatio {{ achievement.trueRatio }}</span>
      </div>
    </div>

    <p class="num shrink-0 text-right text-base font-bold text-amber sm:text-lg">
      {{ achievement.points }}
      <span class="tag block font-normal text-muted">PTS</span>
    </p>
  </article>
</template>
```

- [ ] **Step 8: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/components/AchievementRow.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 9: Implémenter `src/components/AchievementFilters.vue`**

La rangée de filtres est collante sous l'en-tête et défile horizontalement : c'est la commande la plus utilisée de la page sur mobile.

```vue
<script setup lang="ts">
import type { AchievementFilter, AchievementSort } from '@/composables/useAchievementFilters'

defineProps<{
  counts: Record<AchievementFilter, number>
}>()

const filter = defineModel<AchievementFilter>('filter', { required: true })
const sort = defineModel<AchievementSort>('sort', { required: true })

const FILTER_OPTIONS: Array<{ value: AchievementFilter; label: string; countable: boolean }> = [
  { value: 'all', label: 'Tous', countable: true },
  { value: 'unlocked', label: 'Debloques', countable: true },
  { value: 'locked', label: 'Verrouilles', countable: true },
  { value: 'progression', label: 'Progression', countable: true },
  { value: 'win_condition', label: 'Win condition', countable: true },
  { value: 'missable', label: 'Missable', countable: true },
]

const SORT_OPTIONS: Array<{ value: AchievementSort; label: string }> = [
  { value: 'display', label: 'Ordre du set' },
  { value: 'points', label: 'Points' },
  { value: 'rarity', label: 'Rarete' },
  { value: 'earned', label: 'Date de deblocage' },
]
</script>

<template>
  <div class="sticky top-14 z-20 -mx-4 border-b border-edge bg-bg/95 px-4 py-2 backdrop-blur md:top-[60px]">
    <div class="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrer les achievements">
      <button
        v-for="option in FILTER_OPTIONS"
        :key="option.value"
        type="button"
        :aria-pressed="filter === option.value"
        class="min-h-11 shrink-0 border border-edge px-3 text-xs whitespace-nowrap"
        :class="filter === option.value ? 'border-phosphor bg-phosphor text-bg' : 'bg-surface text-muted'"
        @click="filter = option.value"
      >
        {{ option.label }}
        <span v-if="option.countable" class="num">· {{ counts[option.value] }}</span>
      </button>
    </div>

    <label class="mt-2 flex items-center gap-2 text-xs text-muted">
      <span class="tag">Tri</span>
      <select
        v-model="sort"
        class="min-h-11 flex-1 border border-edge bg-surface px-2 text-xs text-ink sm:flex-none"
      >
        <option v-for="option in SORT_OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>
  </div>
</template>
```

- [ ] **Step 10: Implémenter `src/components/GameHero.vue`**

Sur mobile, tout est empilé ; la rangée de métadonnées défile horizontalement plutôt que de casser la mise en page.

```vue
<script setup lang="ts">
import { computed } from 'vue'

import { formatDate, formatNumber } from '@/lib/format'
import { mediaUrl } from '@/lib/media'
import type { GameDetail } from '@/lib/types'

const props = defineProps<{ game: GameDetail }>()

const backgroundStyle = computed(() => ({
  backgroundImage: `url('${mediaUrl(props.game.ingamePath)}')`,
}))
</script>

<template>
  <section class="relative overflow-hidden border border-edge">
    <div
      class="absolute inset-0 scale-[1.15] bg-cover bg-center blur-lg brightness-[.35] saturate-[.75]"
      :style="backgroundStyle"
      aria-hidden="true"
    />
    <div
      class="scanlines pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(to_bottom,rgba(255,255,255,.055)_0_1px,transparent_1px_3px)]"
      aria-hidden="true"
    />

    <div class="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:gap-6 sm:p-6">
      <img
        :src="mediaUrl(game.boxArtPath)"
        :alt="`Jaquette de ${game.title}`"
        width="96"
        height="132"
        class="is-pixel w-24 shrink-0 border border-edge shadow-[5px_5px_0_rgba(0,0,0,.55)] sm:w-[132px]"
      />

      <div class="min-w-0">
        <RouterLink
          :to="{ name: 'system-games', params: { systemId: game.systemId } }"
          class="inline-flex min-h-11 items-center border border-edge bg-surface/80 px-2 text-xs text-muted"
        >
          {{ game.systemName }}
        </RouterLink>

        <h1 class="mt-2 line-clamp-2 font-display text-3xl font-bold leading-none sm:text-5xl">
          {{ game.title }}
        </h1>

        <div class="-mx-4 mt-3 flex gap-4 overflow-x-auto px-4 text-xs text-muted sm:mx-0 sm:flex-wrap sm:px-0 sm:text-sm">
          <span class="whitespace-nowrap">Developpeur <b class="font-medium text-ink">{{ game.developer }}</b></span>
          <span class="whitespace-nowrap">Editeur <b class="font-medium text-ink">{{ game.publisher }}</b></span>
          <span class="whitespace-nowrap">Genre <b class="font-medium text-ink">{{ game.genre }}</b></span>
          <span class="whitespace-nowrap">Sortie <b class="font-medium text-ink">{{ formatDate(game.released) }}</b></span>
          <span class="whitespace-nowrap"><b class="num font-medium text-ink">{{ formatNumber(game.numDistinctPlayers) }}</b> joueurs</span>
        </div>
      </div>
    </div>
  </section>
</template>
```

- [ ] **Step 11: Implémenter `src/components/ProgressMeter.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'

import { formatPercent } from '@/lib/format'

const props = defineProps<{
  total: number
  hardcore: number
  softcore: number
}>()

const hardcorePct = computed(() => (props.total ? (props.hardcore / props.total) * 100 : 0))
const softcorePct = computed(() => (props.total ? (props.softcore / props.total) * 100 : 0))
const earned = computed(() => props.hardcore + props.softcore)
</script>

<template>
  <section
    class="flex flex-col gap-3 border border-t-0 border-edge bg-surface p-4 sm:flex-row sm:items-center sm:gap-5"
    aria-label="Progression"
  >
    <p class="num shrink-0 text-xl font-bold text-phosphor">
      {{ earned }}<span class="font-normal text-muted">/{{ total }}</span>
    </p>

    <div
      class="relative h-3 w-full overflow-hidden border border-edge bg-bg"
      role="progressbar"
      :aria-valuenow="Math.round(hardcorePct + softcorePct)"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <span class="absolute inset-y-0 left-0 bg-phosphor" :style="{ width: `${hardcorePct}%` }" />
      <span
        class="absolute inset-y-0 bg-amber/85"
        :style="{ left: `${hardcorePct}%`, width: `${softcorePct}%` }"
      />
    </div>

    <p class="num shrink-0 text-xs text-muted">
      <span class="text-phosphor" aria-hidden="true">■</span>
      {{ hardcore }} hardcore · {{ formatPercent(hardcorePct, 0) }}
      &nbsp;
      <span class="text-amber" aria-hidden="true">■</span>
      {{ softcore }} softcore · {{ formatPercent(softcorePct, 0) }}
    </p>
  </section>
</template>
```

- [ ] **Step 12: Implémenter `src/pages/GamePage.vue`**

```vue
<script setup lang="ts">
import { computed, ref, toRef } from 'vue'

import AchievementFilters from '@/components/AchievementFilters.vue'
import AchievementRow from '@/components/AchievementRow.vue'
import GameHero from '@/components/GameHero.vue'
import ProgressMeter from '@/components/ProgressMeter.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StateEmpty from '@/components/StateEmpty.vue'
import StateError from '@/components/StateError.vue'
import { useAchievementFilters, unlockState } from '@/composables/useAchievementFilters'
import { useApi } from '@/composables/useApi'
import { formatDate, formatNumber } from '@/lib/format'
import { usePinnedPlayerStore } from '@/stores/usePinnedPlayerStore'
import type { Achievement, GameDetail, GameProgress } from '@/lib/types'

const props = defineProps<{ gameId: string }>()

const pinned = usePinnedPlayerStore()
const pinInput = ref('')

const game = useApi<GameDetail>(() => `/api/games/${props.gameId}`)

const progress = useApi<{ progress: GameProgress; achievements: Achievement[] }>(() =>
  pinned.username ? `/api/games/${props.gameId}/progress/${encodeURIComponent(pinned.username)}` : null,
)

// La progression du joueur epingle remplace la liste anonyme des qu'elle est disponible.
const achievements = computed<Achievement[]>(
  () => progress.data.value?.achievements ?? game.data.value?.achievements ?? [],
)

const { filter, sort, visible, counts } = useAchievementFilters(achievements)

const hardcoreCount = computed(
  () => achievements.value.filter((entry) => unlockState(entry) === 'hardcore').length,
)
const softcoreCount = computed(
  () => achievements.value.filter((entry) => unlockState(entry) === 'softcore').length,
)
</script>

<template>
  <div v-if="game.pending.value" class="grid gap-3">
    <SkeletonBlock height="220px" />
    <SkeletonBlock height="64px" />
    <SkeletonBlock v-for="n in 6" :key="n" height="88px" />
  </div>

  <StateError
    v-else-if="game.error.value"
    :message="game.error.value.message"
    @retry="game.reload()"
  />

  <template v-else-if="game.data.value">
    <GameHero :game="game.data.value" />

    <ProgressMeter
      v-if="pinned.username"
      :total="game.data.value.numAchievements"
      :hardcore="hardcoreCount"
      :softcore="softcoreCount"
    />

    <form
      v-else
      class="flex flex-col gap-2 border border-t-0 border-edge bg-surface p-4 sm:flex-row sm:items-center"
      @submit.prevent="pinned.pin(pinInput)"
    >
      <label class="text-xs text-muted" for="pin-player">
        Epinglez votre pseudo pour voir votre progression sur toutes les fiches.
      </label>
      <input
        id="pin-player"
        v-model="pinInput"
        type="text"
        autocomplete="username"
        placeholder="Pseudo RetroAchievements"
        class="min-h-11 flex-1 border border-edge bg-bg px-3 text-sm sm:ml-auto sm:max-w-56"
      />
      <button
        type="submit"
        class="min-h-11 border border-phosphor bg-phosphor px-4 font-display uppercase tracking-wider text-bg"
      >
        Epingler
      </button>
    </form>

    <section class="mt-6">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="font-display text-xl uppercase tracking-wide">Achievements</h2>
        <p class="num text-xs text-muted">
          {{ formatNumber(game.data.value.totalPoints) }} points au total
        </p>
      </div>

      <AchievementFilters v-model:filter="filter" v-model:sort="sort" :counts="counts" class="mt-2" />

      <StateEmpty
        v-if="!visible.length"
        class="mt-4"
        title="Aucun achievement"
        hint="Aucun achievement ne correspond a ce filtre."
      />

      <div v-else class="mt-3 grid gap-2">
        <AchievementRow
          v-for="achievement in visible"
          :key="achievement.id"
          :achievement="achievement"
        />
      </div>
    </section>

    <section class="mt-8 border border-edge bg-surface p-4">
      <h2 class="tag text-muted">Informations</h2>
      <dl class="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div><dt class="text-xs text-muted">Console</dt><dd>{{ game.data.value.systemName }}</dd></div>
        <div><dt class="text-xs text-muted">Genre</dt><dd>{{ game.data.value.genre }}</dd></div>
        <div><dt class="text-xs text-muted">Sortie</dt><dd>{{ formatDate(game.data.value.released) }}</dd></div>
        <div>
          <dt class="text-xs text-muted">Joueurs</dt>
          <dd class="num">{{ formatNumber(game.data.value.numDistinctPlayers) }}</dd>
        </div>
      </dl>
    </section>
  </template>
</template>
```

- [ ] **Step 13: Lancer toute la suite**

Run: `npx vitest run`
Expected: PASS, tous les tests des tâches 1 à 9.

- [ ] **Step 14: Vérifier la fiche jeu à 375 px**

Run: `npm run dev`, ouvrir `http://localhost:5173/games/1` à 375 px.

Expected: hero empilé, titre sur deux lignes maximum, métadonnées défilant horizontalement sans faire déborder la page, rangée de filtres collante sous l'en-tête au défilement, badges nets et non lissés, chaque bouton de filtre haut d'au moins 44 px.

- [ ] **Step 15: Commit** (si autorisé)

```bash
git add src/
git commit -m "feat: add game page with filterable achievement list"
```

---

## Task 10: Profil joueur

**Files:**
- Create: `src/components/PlayerHero.vue`, `src/components/PlayerStats.vue`, `src/components/GameProgressCard.vue`, `src/components/AwardWall.vue`, `src/components/TabStrip.vue`
- Modify: `src/pages/PlayerPage.vue`
- Test: `src/components/TabStrip.test.ts`, `src/components/GameProgressCard.test.ts`

**Interfaces:**
- Consumes: `useApi` (Task 6), `mediaUrl` (Task 6), `formatNumber` / `formatDate` (Task 1), `PlayerProfile` / `PlayerAward` / `PlayerGameProgress` (Task 2).
- Produces: `TabStrip` avec `v-model` de type `string`, prop `tabs: Array<{ value: string; label: string }>`. `GameProgressCard` prop `game: PlayerGameProgress`.

- [ ] **Step 1: Écrire le test qui échoue pour `TabStrip`**

Create `src/components/TabStrip.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TabStrip from './TabStrip.vue'

const TABS = [
  { value: 'activity', label: 'Activite' },
  { value: 'games', label: 'Jeux' },
  { value: 'awards', label: 'Awards' },
]

function mountTabs(modelValue = 'activity') {
  return mount(TabStrip, { props: { tabs: TABS, modelValue } })
}

describe('TabStrip', () => {
  it('expose un role tablist', () => {
    expect(mountTabs().get('[role="tablist"]').exists()).toBe(true)
  })

  it('marque l\'onglet actif via aria-selected', () => {
    const tabs = mountTabs('games').findAll('[role="tab"]')

    expect(tabs[1]!.attributes('aria-selected')).toBe('true')
    expect(tabs[0]!.attributes('aria-selected')).toBe('false')
  })

  it('emet la nouvelle valeur au clic', async () => {
    const wrapper = mountTabs()
    await wrapper.findAll('[role="tab"]')[2]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['awards'])
  })

  it('defile horizontalement sans casser la mise en page', () => {
    expect(mountTabs().get('[role="tablist"]').classes()).toContain('overflow-x-auto')
  })

  it('respecte la hauteur de cible tactile minimale', () => {
    expect(mountTabs().findAll('[role="tab"]')[0]!.classes()).toContain('min-h-11')
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/components/TabStrip.test.ts`
Expected: FAIL — fichier `TabStrip.vue` introuvable.

- [ ] **Step 3: Implémenter `src/components/TabStrip.vue`**

```vue
<script setup lang="ts">
defineProps<{ tabs: Array<{ value: string; label: string }> }>()

const active = defineModel<string>({ required: true })
</script>

<template>
  <div
    role="tablist"
    class="-mx-4 flex gap-1 overflow-x-auto border-b border-edge px-4 md:mx-0 md:px-0"
  >
    <button
      v-for="tab in tabs"
      :key="tab.value"
      type="button"
      role="tab"
      :aria-selected="active === tab.value"
      class="min-h-11 shrink-0 border-b-2 px-3 font-display text-sm uppercase tracking-wider whitespace-nowrap"
      :class="active === tab.value ? 'border-phosphor text-ink' : 'border-transparent text-muted'"
      @click="active = tab.value"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
```

- [ ] **Step 4: Écrire le test qui échoue pour `GameProgressCard`**

Create `src/components/GameProgressCard.test.ts`:

```ts
import { RouterLinkStub, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import GameProgressCard from './GameProgressCard.vue'
import type { PlayerGameProgress } from '@/lib/types'

function makeGame(overrides: Partial<PlayerGameProgress> = {}): PlayerGameProgress {
  return {
    gameId: 1, title: 'Sonic the Hedgehog', systemId: 1, systemName: 'Genesis/Mega Drive',
    iconPath: '/Images/085573.png', maxPossible: 35, numAwarded: 22, numAwardedHardcore: 16,
    highestAwardKind: null, mostRecentAwardedDate: '2026-08-01 12:00:00',
    ...overrides,
  }
}

function mountCard(game: PlayerGameProgress) {
  return mount(GameProgressCard, {
    props: { game },
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
}

describe('GameProgressCard', () => {
  it('affiche la progression en fraction', () => {
    expect(mountCard(makeGame()).text()).toContain('22/35')
  })

  it('expose la progression aux lecteurs d\'ecran', () => {
    const bar = mountCard(makeGame()).get('[role="progressbar"]')

    expect(bar.attributes('aria-valuenow')).toBe('63')
  })

  it('affiche le badge mastery quand le jeu est maitrise', () => {
    expect(mountCard(makeGame({ highestAwardKind: 'mastered' })).text()).toContain('MASTERED')
  })

  it('n\'affiche aucun badge sans award', () => {
    expect(mountCard(makeGame()).text()).not.toContain('MASTERED')
  })

  it('tolere un jeu sans achievement possible', () => {
    const bar = mountCard(makeGame({ maxPossible: 0, numAwarded: 0, numAwardedHardcore: 0 }))

    expect(bar.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('0')
  })
})
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/components/GameProgressCard.test.ts`
Expected: FAIL — fichier `GameProgressCard.vue` introuvable.

- [ ] **Step 6: Implémenter `src/components/GameProgressCard.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'

import { mediaUrl } from '@/lib/media'
import type { PlayerGameProgress } from '@/lib/types'

const props = defineProps<{ game: PlayerGameProgress }>()

const percent = computed(() =>
  props.game.maxPossible ? Math.round((props.game.numAwarded / props.game.maxPossible) * 100) : 0,
)
const hardcorePercent = computed(() =>
  props.game.maxPossible
    ? (props.game.numAwardedHardcore / props.game.maxPossible) * 100
    : 0,
)

const AWARD_LABEL: Record<string, string> = {
  mastered: 'MASTERED',
  completed: 'COMPLETED',
  'beaten-hardcore': 'BEATEN HC',
  'beaten-softcore': 'BEATEN',
}

const awardLabel = computed(() =>
  props.game.highestAwardKind ? AWARD_LABEL[props.game.highestAwardKind] ?? null : null,
)
</script>

<template>
  <RouterLink
    :to="{ name: 'game', params: { gameId: game.gameId } }"
    class="flex items-center gap-3 border border-edge bg-surface p-3"
  >
    <img
      :src="mediaUrl(game.iconPath)"
      alt=""
      width="48"
      height="48"
      loading="lazy"
      class="is-pixel size-12 shrink-0 border border-edge"
    />

    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <h3 class="min-w-0 truncate font-display text-base">{{ game.title }}</h3>
        <span v-if="awardLabel" class="tag shrink-0 border border-magenta px-1.5 py-0.5 text-magenta">
          {{ awardLabel }}
        </span>
      </div>

      <p class="truncate text-xs text-muted">{{ game.systemName }}</p>

      <div
        class="relative mt-2 h-2 overflow-hidden border border-edge bg-bg"
        role="progressbar"
        :aria-valuenow="percent"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="`Progression sur ${game.title}`"
      >
        <span class="absolute inset-y-0 left-0 bg-amber/50" :style="{ width: `${percent}%` }" />
        <span class="absolute inset-y-0 left-0 bg-phosphor" :style="{ width: `${hardcorePercent}%` }" />
      </div>
    </div>

    <p class="num shrink-0 text-sm text-muted">{{ game.numAwarded }}/{{ game.maxPossible }}</p>
  </RouterLink>
</template>
```

- [ ] **Step 7: Lancer les deux tests pour vérifier qu'ils passent**

Run: `npx vitest run src/components/TabStrip.test.ts src/components/GameProgressCard.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 8: Implémenter `src/components/PlayerHero.vue`**

```vue
<script setup lang="ts">
import { formatDate, formatNumber } from '@/lib/format'
import { mediaUrl } from '@/lib/media'
import type { PlayerProfile } from '@/lib/types'

defineProps<{ profile: PlayerProfile }>()
</script>

<template>
  <section class="border border-edge bg-surface p-4 sm:p-6">
    <div class="flex items-start gap-4">
      <img
        :src="mediaUrl(profile.avatarPath)"
        :alt="`Avatar de ${profile.user}`"
        width="64"
        height="64"
        class="is-pixel size-16 shrink-0 border border-edge sm:size-20"
      />

      <div class="min-w-0 flex-1">
        <h1 class="truncate font-display text-2xl font-bold uppercase sm:text-4xl">
          {{ profile.user }}
        </h1>
        <p v-if="profile.motto" class="mt-1 line-clamp-2 text-sm text-muted">{{ profile.motto }}</p>
        <p class="num mt-1 text-xs text-muted">
          Rang {{ formatNumber(profile.rank) }} · membre depuis {{ formatDate(profile.memberSince) }}
        </p>
      </div>
    </div>

    <p
      v-if="profile.richPresence"
      class="mt-4 border border-cyan/40 bg-cyan/10 px-3 py-2 text-xs text-cyan"
    >
      <span class="tag">En jeu</span>
      {{ profile.richPresence }}
    </p>
  </section>
</template>
```

- [ ] **Step 9: Implémenter `src/components/PlayerStats.vue`**

Grille 2 colonnes sur mobile, 5 sur desktop.

```vue
<script setup lang="ts">
import { computed } from 'vue'

import { formatNumber } from '@/lib/format'
import type { PlayerProfile } from '@/lib/types'

const props = defineProps<{ profile: PlayerProfile; gamesPlayed: number; masteries: number }>()

// computed et non tableau litteral : les props changent apres le chargement de l'API.
const cells = computed(() => [
  { label: 'Points HC', value: props.profile.totalPoints, tone: 'text-phosphor' },
  { label: 'Softcore', value: props.profile.totalSoftcorePoints, tone: 'text-amber' },
  { label: 'True points', value: props.profile.totalTruePoints, tone: 'text-ink' },
  { label: 'Jeux', value: props.gamesPlayed, tone: 'text-ink' },
  { label: 'Maitrises', value: props.masteries, tone: 'text-magenta' },
])
</script>

<template>
  <dl class="grid grid-cols-2 gap-px border border-edge bg-edge sm:grid-cols-5">
    <div v-for="cell in cells" :key="cell.label" class="bg-surface p-3 sm:p-4">
      <dt class="tag text-muted">{{ cell.label }}</dt>
      <dd class="num mt-2 text-xl font-bold sm:text-2xl" :class="cell.tone">
        {{ formatNumber(cell.value) }}
      </dd>
    </div>
  </dl>
</template>
```

- [ ] **Step 10: Implémenter `src/components/AwardWall.vue`**

```vue
<script setup lang="ts">
import { formatDate } from '@/lib/format'
import { mediaUrl } from '@/lib/media'
import type { PlayerAward } from '@/lib/types'

defineProps<{ awards: PlayerAward[] }>()
</script>

<template>
  <ul class="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-8">
    <li v-for="award in awards" :key="`${award.gameId}-${award.awardedAt}`">
      <RouterLink
        :to="{ name: 'game', params: { gameId: award.gameId } }"
        class="block border border-edge bg-surface p-2"
        :class="award.isHardcore ? 'border-l-[3px] border-l-phosphor' : 'border-l-[3px] border-l-amber'"
      >
        <img
          :src="mediaUrl(award.iconPath)"
          :alt="`${award.awardType} — ${award.title}`"
          width="48"
          height="48"
          loading="lazy"
          class="is-pixel mx-auto size-12 border border-edge"
        />
        <p class="mt-2 line-clamp-2 text-center text-[11px] leading-tight">{{ award.title }}</p>
        <p class="num mt-1 text-center text-[10px] text-muted">{{ formatDate(award.awardedAt) }}</p>
      </RouterLink>
    </li>
  </ul>
</template>
```

- [ ] **Step 11: Implémenter `src/pages/PlayerPage.vue`**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'

import AwardWall from '@/components/AwardWall.vue'
import GameProgressCard from '@/components/GameProgressCard.vue'
import PlayerHero from '@/components/PlayerHero.vue'
import PlayerStats from '@/components/PlayerStats.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StateEmpty from '@/components/StateEmpty.vue'
import StateError from '@/components/StateError.vue'
import TabStrip from '@/components/TabStrip.vue'
import { useApi } from '@/composables/useApi'
import { usePinnedPlayerStore } from '@/stores/usePinnedPlayerStore'
import type { PlayerAward, PlayerGameProgress, PlayerProfile } from '@/lib/types'

const props = defineProps<{ username: string }>()

const pinned = usePinnedPlayerStore()
const activeTab = ref('games')

const TABS = [
  { value: 'games', label: 'Jeux' },
  { value: 'recent', label: 'Activite' },
  { value: 'awards', label: 'Awards' },
]

const summary = useApi<{
  profile: PlayerProfile
  awards: PlayerAward[]
  recentGames: PlayerGameProgress[]
}>(() => `/api/users/${encodeURIComponent(props.username)}`)

const progress = useApi<PlayerGameProgress[]>(
  () => `/api/users/${encodeURIComponent(props.username)}/progress`,
)

const masteries = computed(
  () => (progress.data.value ?? []).filter((game) => game.highestAwardKind === 'mastered').length,
)

const isPinned = computed(
  () => pinned.username?.toLowerCase() === props.username.toLowerCase(),
)
</script>

<template>
  <div v-if="summary.pending.value" class="grid gap-3">
    <SkeletonBlock height="140px" />
    <SkeletonBlock height="90px" />
    <SkeletonBlock v-for="n in 4" :key="n" height="76px" />
  </div>

  <StateError
    v-else-if="summary.error.value"
    :message="summary.error.value.status === 404 ? 'Joueur introuvable.' : summary.error.value.message"
    @retry="summary.reload()"
  />

  <template v-else-if="summary.data.value">
    <PlayerHero :profile="summary.data.value.profile" />

    <div class="mt-3 flex">
      <button
        type="button"
        class="min-h-11 w-full border border-edge px-4 font-display uppercase tracking-wider sm:w-auto"
        :class="isPinned ? 'bg-raised text-muted' : 'border-phosphor bg-phosphor text-bg'"
        @click="isPinned ? pinned.unpin() : pinned.pin(username)"
      >
        {{ isPinned ? 'Desepingler' : 'Epingler ce joueur' }}
      </button>
    </div>

    <PlayerStats
      class="mt-4"
      :profile="summary.data.value.profile"
      :games-played="progress.data.value?.length ?? 0"
      :masteries="masteries"
    />

    <TabStrip v-model="activeTab" :tabs="TABS" class="mt-6" />

    <section v-if="activeTab === 'games'" class="mt-4">
      <div v-if="progress.pending.value" class="grid gap-2">
        <SkeletonBlock v-for="n in 5" :key="n" height="76px" />
      </div>
      <StateEmpty v-else-if="!progress.data.value?.length" title="Aucun jeu joue" />
      <ul v-else class="grid gap-2">
        <li v-for="game in progress.data.value" :key="game.gameId">
          <GameProgressCard :game="game" />
        </li>
      </ul>
    </section>

    <section v-else-if="activeTab === 'recent'" class="mt-4">
      <StateEmpty v-if="!summary.data.value.recentGames.length" title="Aucune activite recente" />
      <ul v-else class="grid gap-2">
        <li v-for="game in summary.data.value.recentGames" :key="game.gameId">
          <GameProgressCard :game="game" />
        </li>
      </ul>
    </section>

    <section v-else class="mt-4">
      <StateEmpty v-if="!summary.data.value.awards.length" title="Aucun award" />
      <AwardWall v-else :awards="summary.data.value.awards" />
    </section>
  </template>
</template>
```

- [ ] **Step 12: Vérifier à 375 px**

Run: `npm run dev`, ouvrir `http://localhost:5173/users/MaxMilyin` à 375 px.

Expected: hero lisible, stats sur 2 colonnes, onglets défilant horizontalement sans déborder, cartes de jeu avec titre tronqué et non cassé, bouton d'épinglage pleine largeur.

- [ ] **Step 13: Commit** (si autorisé)

```bash
git add src/
git commit -m "feat: add player profile with tabs, progress cards and award wall"
```

---

## Task 11: Accueil, consoles, jeux par console et classements

**Files:**
- Create: `src/components/SystemCard.vue`, `src/components/GameListRow.vue`
- Modify: `src/pages/HomePage.vue`, `src/pages/SystemsPage.vue`, `src/pages/SystemGamesPage.vue`, `src/pages/LeaderboardsPage.vue`, `src/pages/NotFoundPage.vue`
- Create: `server/routes/home.ts` (monté dans `server/index.ts`)
- Test: `src/pages/LeaderboardsPage.test.ts`

**Interfaces:**
- Consumes: `useApi` (Task 6), `loadSystems` (Task 5), `mediaUrl` (Task 6), `formatNumber` (Task 1).
- Produces: `GET /api/home` → `{ topUsers: LeaderboardUser[] }`. `SystemCard` prop `system: SystemSummary`. `GameListRow` prop `game: GameSummary`.

- [ ] **Step 1: Écrire le test qui échoue pour la page classements**

Create `src/pages/LeaderboardsPage.test.ts`:

```ts
import { RouterLinkStub, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import LeaderboardsPage from './LeaderboardsPage.vue'

const USERS = [
  { rank: 1, user: 'MaxMilyin', totalPoints: 491867, totalTruePoints: 2669943 },
  { rank: 2, user: 'Scott', totalPoints: 300000, totalTruePoints: 1000000 },
]

async function mountPage() {
  const wrapper = mount(LeaderboardsPage, {
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
  return wrapper
}

describe('LeaderboardsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rend une ligne par joueur', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(USERS), { status: 200 }),
    )

    expect((await mountPage()).findAll('[data-leaderboard-entry]')).toHaveLength(2)
  })

  it('confine le tableau dans un conteneur defilable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(USERS), { status: 200 }),
    )

    expect((await mountPage()).get('[data-scroll-container]').classes()).toContain('overflow-x-auto')
  })

  it('affiche un etat vide sans donnees', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    )

    expect((await mountPage()).text()).toContain('Classement indisponible')
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/pages/LeaderboardsPage.test.ts`
Expected: FAIL — la page placeholder ne contient aucun `[data-leaderboard-entry]`.

- [ ] **Step 3: Implémenter `src/pages/LeaderboardsPage.vue`**

Sous 640 px, le tableau devient des cartes empilées ; au-dessus, un vrai tableau confiné dans un conteneur défilable.

```vue
<script setup lang="ts">
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StateEmpty from '@/components/StateEmpty.vue'
import StateError from '@/components/StateError.vue'
import { useApi } from '@/composables/useApi'
import { formatNumber } from '@/lib/format'
import type { LeaderboardUser } from '@/lib/types'

const { data, error, pending, reload } = useApi<LeaderboardUser[]>(() => '/api/leaderboards')

const RANK_TONE = ['text-phosphor', 'text-amber', 'text-magenta'] as const
</script>

<template>
  <h1 class="font-display text-2xl uppercase tracking-wide">Classements</h1>

  <div v-if="pending" class="mt-4 grid gap-2">
    <SkeletonBlock v-for="n in 10" :key="n" height="56px" />
  </div>

  <StateError v-else-if="error" class="mt-4" :message="error.message" @retry="reload()" />

  <StateEmpty
    v-else-if="!data?.length"
    class="mt-4"
    title="Classement indisponible"
    hint="L'API n'a retourne aucun joueur."
  />

  <div v-else data-scroll-container class="mt-4 overflow-x-auto">
    <ul class="grid gap-2 sm:hidden">
      <li
        v-for="entry in data"
        :key="entry.user"
        data-leaderboard-entry
        class="flex items-center gap-3 border border-edge bg-surface p-3"
      >
        <span class="num w-8 shrink-0 text-lg font-bold" :class="RANK_TONE[entry.rank - 1] ?? 'text-muted'">
          {{ entry.rank }}
        </span>
        <RouterLink
          :to="{ name: 'player', params: { username: entry.user } }"
          class="min-w-0 flex-1 truncate font-display text-lg"
        >
          {{ entry.user }}
        </RouterLink>
        <span class="num shrink-0 text-right text-sm text-phosphor">
          {{ formatNumber(entry.totalPoints) }}
        </span>
      </li>
    </ul>

    <table class="hidden w-full border border-edge sm:table">
      <thead>
        <tr class="bg-raised text-left">
          <th scope="col" class="tag p-3 text-muted">Rang</th>
          <th scope="col" class="tag p-3 text-muted">Joueur</th>
          <th scope="col" class="tag p-3 text-right text-muted">Points</th>
          <th scope="col" class="tag p-3 text-right text-muted">True points</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="entry in data"
          :key="entry.user"
          data-leaderboard-entry
          class="border-t border-edge bg-surface"
        >
          <td class="num p-3 font-bold" :class="RANK_TONE[entry.rank - 1] ?? 'text-muted'">
            {{ entry.rank }}
          </td>
          <td class="p-3">
            <RouterLink
              :to="{ name: 'player', params: { username: entry.user } }"
              class="font-display text-lg"
            >
              {{ entry.user }}
            </RouterLink>
          </td>
          <td class="num p-3 text-right text-phosphor">{{ formatNumber(entry.totalPoints) }}</td>
          <td class="num p-3 text-right text-muted">{{ formatNumber(entry.totalTruePoints) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/pages/LeaderboardsPage.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Implémenter `src/components/SystemCard.vue`**

```vue
<script setup lang="ts">
import type { SystemSummary } from '@/lib/types'

defineProps<{ system: SystemSummary }>()
</script>

<template>
  <RouterLink
    :to="{ name: 'system-games', params: { systemId: system.id } }"
    class="flex min-h-11 items-center gap-3 border border-edge bg-surface p-3"
  >
    <img
      :src="system.iconUrl"
      alt=""
      width="32"
      height="32"
      loading="lazy"
      class="size-8 shrink-0"
    />
    <span class="min-w-0 truncate font-display text-base uppercase tracking-wide">
      {{ system.name }}
    </span>
  </RouterLink>
</template>
```

- [ ] **Step 6: Implémenter `src/components/GameListRow.vue`**

```vue
<script setup lang="ts">
import { formatNumber } from '@/lib/format'
import { mediaUrl } from '@/lib/media'
import type { GameSummary } from '@/lib/types'

defineProps<{ game: GameSummary }>()
</script>

<template>
  <RouterLink
    :to="{ name: 'game', params: { gameId: game.id } }"
    class="flex min-h-11 items-center gap-3 border border-edge bg-surface p-3"
  >
    <img
      :src="mediaUrl(game.iconPath)"
      alt=""
      width="40"
      height="40"
      loading="lazy"
      class="is-pixel size-10 shrink-0 border border-edge"
    />
    <span class="min-w-0 flex-1">
      <span class="block truncate font-display text-base">{{ game.title }}</span>
      <span class="num block text-xs text-muted">
        {{ game.numAchievements }} ach · {{ formatNumber(game.points) }} pts
      </span>
    </span>
  </RouterLink>
</template>
```

- [ ] **Step 7: Implémenter `src/pages/SystemsPage.vue`**

```vue
<script setup lang="ts">
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StateError from '@/components/StateError.vue'
import SystemCard from '@/components/SystemCard.vue'
import { useApi } from '@/composables/useApi'
import type { SystemSummary } from '@/lib/types'

const { data, error, pending, reload } = useApi<SystemSummary[]>(() => '/api/systems')
</script>

<template>
  <h1 class="font-display text-2xl uppercase tracking-wide">Consoles</h1>

  <div v-if="pending" class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
    <SkeletonBlock v-for="n in 12" :key="n" height="62px" />
  </div>

  <StateError v-else-if="error" class="mt-4" :message="error.message" @retry="reload()" />

  <ul v-else class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
    <li v-for="system in data ?? []" :key="system.id">
      <SystemCard :system="system" />
    </li>
  </ul>
</template>
```

- [ ] **Step 8: Implémenter `src/pages/SystemGamesPage.vue`**

Filtre local par titre, tri par titre / achievements / points.

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'

import GameListRow from '@/components/GameListRow.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StateEmpty from '@/components/StateEmpty.vue'
import StateError from '@/components/StateError.vue'
import { useApi } from '@/composables/useApi'
import type { GameSummary } from '@/lib/types'

const props = defineProps<{ systemId: string }>()

const query = ref('')
const sort = ref<'title' | 'achievements' | 'points'>('title')

const { data, error, pending, reload } = useApi<GameSummary[]>(
  () => `/api/systems/${props.systemId}/games`,
)

const visible = computed(() => {
  const needle = query.value.trim().toLowerCase()
  const kept = (data.value ?? []).filter((game) => game.title.toLowerCase().includes(needle))

  switch (sort.value) {
    case 'achievements':
      return [...kept].sort((a, b) => b.numAchievements - a.numAchievements)
    case 'points':
      return [...kept].sort((a, b) => b.points - a.points)
    default:
      return [...kept].sort((a, b) => a.title.localeCompare(b.title))
  }
})
</script>

<template>
  <h1 class="font-display text-2xl uppercase tracking-wide">
    {{ data?.[0]?.systemName ?? 'Jeux' }}
  </h1>

  <div class="mt-3 flex flex-col gap-2 sm:flex-row">
    <input
      v-model="query"
      type="search"
      placeholder="Filtrer par titre"
      class="min-h-11 flex-1 border border-edge bg-surface px-3 text-sm"
    />
    <select v-model="sort" class="min-h-11 border border-edge bg-surface px-3 text-sm">
      <option value="title">Titre</option>
      <option value="achievements">Achievements</option>
      <option value="points">Points</option>
    </select>
  </div>

  <div v-if="pending" class="mt-4 grid gap-2">
    <SkeletonBlock v-for="n in 10" :key="n" height="66px" />
  </div>

  <StateError v-else-if="error" class="mt-4" :message="error.message" @retry="reload()" />

  <StateEmpty v-else-if="!visible.length" class="mt-4" title="Aucun jeu" />

  <ul v-else class="mt-4 grid gap-2">
    <li v-for="game in visible" :key="game.id">
      <GameListRow :game="game" />
    </li>
  </ul>
</template>
```

- [ ] **Step 9: Implémenter `server/routes/home.ts`**

```ts
import { Hono } from 'hono'

import { TTL, cached } from '../cache'
import { fetchRa } from '../ra-client'
import type { LeaderboardUser } from '../../src/lib/types'

interface RaTopUser {
  '1': string
  '2': number
  '3': number
}

export const homeRoutes = new Hono()

homeRoutes.get('/home', async (context) => {
  const topUsers = await cached('home-top', TTL.home, async () => {
    const raw = await fetchRa<RaTopUser[]>('GetTopTenUsers', {})
    return raw.map(
      (entry, position): LeaderboardUser => ({
        rank: position + 1,
        user: entry['1'],
        totalPoints: Number(entry['2']),
        totalTruePoints: Number(entry['3']),
      }),
    )
  })

  return context.json({ topUsers })
})
```

Puis dans `server/index.ts`, ajouter l'import et `app.route('/api', homeRoutes)` avec les autres.

- [ ] **Step 10: Implémenter `src/pages/HomePage.vue`**

```vue
<script setup lang="ts">
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import SystemCard from '@/components/SystemCard.vue'
import { useApi } from '@/composables/useApi'
import { formatNumber } from '@/lib/format'
import type { LeaderboardUser, SystemSummary } from '@/lib/types'

const home = useApi<{ topUsers: LeaderboardUser[] }>(() => '/api/home')
const systems = useApi<SystemSummary[]>(() => '/api/systems')
</script>

<template>
  <section class="border border-edge bg-surface p-4 sm:p-6">
    <p class="tag text-phosphor">RetroAchievements</p>
    <h1 class="mt-3 font-display text-3xl font-bold uppercase leading-none sm:text-5xl">
      Des succes pour vos jeux retro
    </h1>
    <p class="mt-3 max-w-prose text-sm text-muted">
      Parcourez les consoles, ouvrez une fiche de jeu, epinglez votre pseudo et suivez votre
      progression achievement par achievement.
    </p>
  </section>

  <section class="mt-8">
    <h2 class="font-display text-xl uppercase tracking-wide">Top joueurs</h2>
    <div v-if="home.pending.value" class="mt-3 grid gap-2">
      <SkeletonBlock v-for="n in 5" :key="n" height="48px" />
    </div>
    <ol v-else class="mt-3 grid gap-2">
      <li
        v-for="entry in home.data.value?.topUsers ?? []"
        :key="entry.user"
        class="flex items-center gap-3 border border-edge bg-surface p-3"
      >
        <span class="num w-8 shrink-0 font-bold text-phosphor">{{ entry.rank }}</span>
        <RouterLink
          :to="{ name: 'player', params: { username: entry.user } }"
          class="min-w-0 flex-1 truncate font-display text-lg"
        >
          {{ entry.user }}
        </RouterLink>
        <span class="num shrink-0 text-sm text-muted">{{ formatNumber(entry.totalPoints) }}</span>
      </li>
    </ol>
  </section>

  <section class="mt-8">
    <h2 class="font-display text-xl uppercase tracking-wide">Consoles</h2>
    <ul class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="system in (systems.data.value ?? []).slice(0, 12)" :key="system.id">
        <SystemCard :system="system" />
      </li>
    </ul>
    <RouterLink
      :to="{ name: 'systems' }"
      class="mt-3 inline-flex min-h-11 items-center border border-edge bg-raised px-4 font-display uppercase tracking-wider"
    >
      Toutes les consoles
    </RouterLink>
  </section>
</template>
```

- [ ] **Step 11: Implémenter `src/pages/NotFoundPage.vue`**

```vue
<script setup lang="ts">
import StateEmpty from '@/components/StateEmpty.vue'
</script>

<template>
  <StateEmpty title="Page introuvable" hint="Utilisez la recherche pour trouver un jeu ou un joueur." />
</template>
```

- [ ] **Step 12: Lancer toute la suite**

Run: `npx vitest run`
Expected: PASS, tous les tests des tâches 1 à 11.

- [ ] **Step 13: Commit** (si autorisé)

```bash
git add src/ server/
git commit -m "feat: add home, systems, system games and leaderboards pages"
```

---

## Task 12: Passe de vérification mobile et accessibilité

**Files:**
- Modify: tout fichier révélé défaillant par la vérification.
- Create: `docs/mobile-check.md` (relevé des captures et des corrections)

**Interfaces:**
- Consumes: l'application complète des tâches 1 à 11.
- Produces: aucun nouveau module. Un relevé écrit et les correctifs appliqués.

- [ ] **Step 1: Lancer l'application avec des données réelles**

Run: `npm run warm` (si l'index n'existe pas), puis `npm run dev`.

- [ ] **Step 2: Contrôler chaque vue à 375 px**

Pour chaque route — `/`, `/systems`, `/systems/1`, `/games/1`, `/users/MaxMilyin`, `/leaderboards`, `/search?q=sonic`, une URL inexistante — vérifier et noter dans `docs/mobile-check.md` :

- aucun défilement horizontal du `body` ;
- aucune cible interactive sous 44 px de haut ;
- aucun texte tronqué de façon illisible ni titre débordant ;
- la barre d'onglets ne recouvre aucun contenu ;
- les images n'entraînent aucun saut de mise en page au chargement.

Commande de contrôle du débordement horizontal, à exécuter dans la console du navigateur sur chaque page :

```js
document.documentElement.scrollWidth <= document.documentElement.clientWidth
```

Expected: `true` sur chaque page.

- [ ] **Step 3: Refaire le contrôle à 390 px et 430 px**

Mêmes routes, mêmes critères. Noter toute différence.

- [ ] **Step 4: Contrôler en orientation paysage**

À 812 × 375, vérifier que la barre d'onglets ne mange pas plus d'un quart de la hauteur et que le hero de la fiche jeu reste lisible.

- [ ] **Step 5: Vérifier la zone sure iOS**

Sur un simulateur iPhone avec encoche, vérifier que la barre d'onglets s'arrête au-dessus de l'indicateur d'accueil. Si ce n'est pas le cas, la cause est presque toujours l'absence de `viewport-fit=cover` dans le `<meta name="viewport">` de `index.html`.

- [ ] **Step 6: Contrôler la navigation au clavier**

Parcourir `/games/1` uniquement au clavier : chaque cible doit recevoir un focus visible en cyan, `⌘K` doit ouvrir la palette, `Échap` la fermer, et le focus revenir au bouton de recherche.

- [ ] **Step 7: Vérifier que la couleur ne porte jamais seule l'information**

Passer l'affichage en niveaux de gris (DevTools → Rendering → Emulate vision deficiencies → Achromatopsia) et vérifier sur `/games/1` que les trois états d'achievement restent distinguables par l'étiquette texte `HARDCORE` / `SOFTCORE` / `LOCKED`.

- [ ] **Step 8: Vérifier le mouvement réduit**

Activer `prefers-reduced-motion` dans DevTools et vérifier que les scanlines disparaissent et que les squelettes cessent de pulser.

Si les squelettes continuent de pulser, ajouter dans `src/styles/main.css` :

```css
@media (prefers-reduced-motion: reduce) {
  .animate-pulse {
    animation: none;
  }
}
```

- [ ] **Step 9: Vérifier le build de production**

Run: `npm run build && npm run start`, puis ouvrir `http://localhost:3001` à 375 px.

Expected: l'application est servie par le serveur Hono, les routes profondes comme `/games/1` répondent directement (pas de 404 au rafraîchissement), et `/api/games/1` renvoie du JSON.

- [ ] **Step 10: Corriger et consigner**

Appliquer les correctifs révélés par les étapes 2 à 9. Consigner dans `docs/mobile-check.md` ce qui a été vérifié, ce qui a été corrigé, et ce qui reste ouvert.

- [ ] **Step 11: Lancer toute la suite une dernière fois**

Run: `npx vitest run && npm run build`
Expected: tous les tests passent et le build réussit.

- [ ] **Step 12: Commit** (si autorisé)

```bash
git add -A
git commit -m "fix: mobile and accessibility corrections from verification pass"
```

---

## Task 13: Modules secondaires de la fiche jeu

La spec §9 prévoit trois blocs latéraux (métadonnées, distribution des déblocages, top joueurs) et deux sections sous les achievements (leaderboards, jeux similaires). Les tâches 5 et 9 n'ont livré que les métadonnées. Cette tâche complète le manque.

`API_GetGameExtended` ne fournit pas de jeux similaires et l'API publique n'expose aucun endpoint équivalent. Les jeux similaires sont donc **retirés du périmètre** — c'est la seule section de la spec abandonnée, faute de source de données.

**Files:**
- Modify: `server/routes/games.ts`, `src/pages/GamePage.vue`
- Create: `src/components/UnlockDistribution.vue`, `src/components/TopPlayersList.vue`, `src/components/GameLeaderboards.vue`
- Test: `src/components/UnlockDistribution.test.ts`

**Interfaces:**
- Consumes: `fetchRa` (Task 2), `cached` / `TTL` (Task 3), `useApi` (Task 6).
- Produces:
  - `GET /api/games/:id/extras` → `{ distribution: Array<{ count: number; players: number }>; topPlayers: Array<{ user: string; numAchievements: number; totalScore: number }>; leaderboards: Array<{ id: number; title: string; description: string; topEntry: { user: string; formattedScore: string } | null }> }`
  - `UnlockDistribution` prop `buckets: Array<{ count: number; players: number }>`

- [ ] **Step 1: Écrire le test qui échoue pour l'histogramme**

Create `src/components/UnlockDistribution.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import UnlockDistribution from './UnlockDistribution.vue'

const BUCKETS = [
  { count: 1, players: 141 },
  { count: 2, players: 51 },
  { count: 3, players: 282 },
]

describe('UnlockDistribution', () => {
  it('rend une barre par palier', () => {
    const wrapper = mount(UnlockDistribution, { props: { buckets: BUCKETS } })

    expect(wrapper.findAll('[data-bucket]')).toHaveLength(3)
  })

  it('met la barre la plus haute a 100 pourcent', () => {
    const wrapper = mount(UnlockDistribution, { props: { buckets: BUCKETS } })
    const bars = wrapper.findAll('[data-bucket] span')

    expect(bars[2]!.attributes('style')).toContain('height: 100%')
  })

  it('defile horizontalement au lieu de deborder', () => {
    const wrapper = mount(UnlockDistribution, { props: { buckets: BUCKETS } })

    expect(wrapper.get('[data-scroll-container]').classes()).toContain('overflow-x-auto')
  })

  it('decrit chaque barre pour les lecteurs d\'ecran', () => {
    const wrapper = mount(UnlockDistribution, { props: { buckets: BUCKETS } })

    expect(wrapper.findAll('[data-bucket]')[0]!.attributes('aria-label')).toBe(
      '141 joueurs ont debloque 1 achievement',
    )
  })

  it('tolere une distribution vide', () => {
    const wrapper = mount(UnlockDistribution, { props: { buckets: [] } })

    expect(wrapper.findAll('[data-bucket]')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/components/UnlockDistribution.test.ts`
Expected: FAIL — fichier `UnlockDistribution.vue` introuvable.

- [ ] **Step 3: Implémenter `src/components/UnlockDistribution.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ buckets: Array<{ count: number; players: number }> }>()

const peak = computed(() => Math.max(1, ...props.buckets.map((bucket) => bucket.players)))
</script>

<template>
  <div data-scroll-container class="overflow-x-auto">
    <ul class="flex h-32 min-w-full items-end gap-1">
      <li
        v-for="bucket in buckets"
        :key="bucket.count"
        data-bucket
        class="flex h-full w-3 shrink-0 items-end sm:w-4"
        :aria-label="`${bucket.players} joueurs ont debloque ${bucket.count} achievement${bucket.count > 1 ? 's' : ''}`"
      >
        <span
          class="block w-full bg-phosphor"
          :style="{ height: `${(bucket.players / peak) * 100}%` }"
        />
      </li>
    </ul>
  </div>
</template>
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/components/UnlockDistribution.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Ajouter la route `/api/games/:id/extras`**

Dans `server/routes/games.ts`, ajouter :

```ts
interface RaGameRankEntry {
  User: string
  NumAchievements: number
  TotalScore: number
}

interface RaLeaderboard {
  ID: number
  Title: string
  Description: string
  TopEntry: { User: string; FormattedScore: string } | null
}

gamesRoutes.get('/games/:id/extras', async (context) => {
  const id = Number(context.req.param('id'))
  if (!Number.isInteger(id)) return context.json({ error: 'identifiant invalide' }, 400)

  const extras = await cached(`game-extras:${id}`, TTL.game, async () => {
    const [distributionRaw, topRaw, leaderboardsRaw] = await Promise.all([
      fetchRa<Record<string, number>>('GetAchievementDistribution', { i: id, h: 1 }),
      fetchRa<RaGameRankEntry[]>('GetGameRankAndScore', { g: id, t: 0 }),
      fetchRa<{ Results?: RaLeaderboard[] }>('GetGameLeaderboards', { i: id, c: 10 }),
    ])

    return {
      distribution: Object.entries(distributionRaw ?? {})
        .map(([count, players]) => ({ count: Number(count), players }))
        .sort((a, b) => a.count - b.count),
      topPlayers: (topRaw ?? []).slice(0, 10).map((entry) => ({
        user: entry.User,
        numAchievements: entry.NumAchievements,
        totalScore: entry.TotalScore,
      })),
      leaderboards: (leaderboardsRaw.Results ?? []).map((entry) => ({
        id: entry.ID,
        title: entry.Title,
        description: entry.Description,
        topEntry: entry.TopEntry
          ? { user: entry.TopEntry.User, formattedScore: entry.TopEntry.FormattedScore }
          : null,
      })),
    }
  })

  return context.json(extras)
})
```

Cette route est séparée de `/api/games/:id` volontairement : elle déclenche trois appels amont et ne doit pas retarder l'affichage du hero et des achievements, qui sont l'essentiel de la page.

- [ ] **Step 6: Implémenter `src/components/TopPlayersList.vue`**

```vue
<script setup lang="ts">
import { formatNumber } from '@/lib/format'

defineProps<{ players: Array<{ user: string; numAchievements: number; totalScore: number }> }>()
</script>

<template>
  <ol class="grid gap-1">
    <li
      v-for="(player, index) in players"
      :key="player.user"
      class="flex min-h-11 items-center gap-3 border border-edge bg-surface px-3"
    >
      <span class="num w-6 shrink-0 text-sm text-muted">{{ index + 1 }}</span>
      <RouterLink
        :to="{ name: 'player', params: { username: player.user } }"
        class="min-w-0 flex-1 truncate text-sm"
      >
        {{ player.user }}
      </RouterLink>
      <span class="num shrink-0 text-xs text-amber">{{ formatNumber(player.totalScore) }}</span>
    </li>
  </ol>
</template>
```

- [ ] **Step 7: Implémenter `src/components/GameLeaderboards.vue`**

```vue
<script setup lang="ts">
defineProps<{
  leaderboards: Array<{
    id: number
    title: string
    description: string
    topEntry: { user: string; formattedScore: string } | null
  }>
}>()
</script>

<template>
  <ul class="grid gap-2">
    <li
      v-for="board in leaderboards"
      :key="board.id"
      class="border border-edge bg-surface p-3"
    >
      <p class="font-display text-base">{{ board.title }}</p>
      <p class="line-clamp-2 text-xs text-muted">{{ board.description }}</p>
      <p v-if="board.topEntry" class="num mt-2 text-xs">
        <span class="text-muted">1er</span>
        <RouterLink
          :to="{ name: 'player', params: { username: board.topEntry.user } }"
          class="text-ink"
        >
          {{ board.topEntry.user }}
        </RouterLink>
        <span class="text-phosphor">{{ board.topEntry.formattedScore }}</span>
      </p>
    </li>
  </ul>
</template>
```

- [ ] **Step 8: Monter les trois modules dans `src/pages/GamePage.vue`**

Ajouter dans le `<script setup>` :

```ts
import GameLeaderboards from '@/components/GameLeaderboards.vue'
import TopPlayersList from '@/components/TopPlayersList.vue'
import UnlockDistribution from '@/components/UnlockDistribution.vue'

const extras = useApi<{
  distribution: Array<{ count: number; players: number }>
  topPlayers: Array<{ user: string; numAchievements: number; totalScore: number }>
  leaderboards: Array<{
    id: number
    title: string
    description: string
    topEntry: { user: string; formattedScore: string } | null
  }>
}>(() => `/api/games/${props.gameId}/extras`)
```

Et remplacer la section « Informations » finale par :

```html
<section v-if="extras.data.value?.distribution.length" class="mt-8">
  <h2 class="font-display text-xl uppercase tracking-wide">Distribution des deblocages</h2>
  <p class="mt-1 text-xs text-muted">Nombre de joueurs par nombre d'achievements obtenus, en hardcore.</p>
  <UnlockDistribution class="mt-3" :buckets="extras.data.value.distribution" />
</section>

<section v-if="extras.data.value?.topPlayers.length" class="mt-8">
  <h2 class="font-display text-xl uppercase tracking-wide">Top joueurs</h2>
  <TopPlayersList class="mt-3" :players="extras.data.value.topPlayers" />
</section>

<section v-if="extras.data.value?.leaderboards.length" class="mt-8">
  <h2 class="font-display text-xl uppercase tracking-wide">Leaderboards</h2>
  <GameLeaderboards class="mt-3" :leaderboards="extras.data.value.leaderboards" />
</section>
```

Sur mobile ces trois blocs sont des sections empilées sous les achievements, conformément à la spec §10 ; à partir de `lg:` ils peuvent être déplacés en colonne latérale, mais ce n'est pas requis pour considérer la tâche terminée.

- [ ] **Step 9: Vérifier contre l'API réelle**

Run: `curl -s localhost:3001/api/games/1/extras | head -c 400`
Expected: un JSON avec `distribution`, `topPlayers` et `leaderboards` non vides pour le jeu 1.

- [ ] **Step 10: Vérifier à 375 px**

Expected: l'histogramme défile horizontalement dans son propre conteneur, la page ne déborde pas.

- [ ] **Step 11: Commit** (si autorisé)

```bash
git add server/routes/games.ts src/components src/pages/GamePage.vue
git commit -m "feat: add unlock distribution, top players and leaderboards to game page"
```

---

## Task 14: Accueil enrichi, onglet achievements du joueur, mention de fraîcheur

Complète les trois derniers éléments de la spec sans tâche : l'Achievement of the Week et les récompenses récentes sur l'accueil (§9), l'onglet Achievements du profil (§9), et la mention « données du {date} » quand le cache sert une valeur périmée (§11).

**Files:**
- Modify: `server/routes/home.ts`, `server/routes/users.ts`, `server/cache.ts`, `src/composables/useApi.ts`, `src/pages/HomePage.vue`, `src/pages/PlayerPage.vue`
- Create: `src/components/StaleNotice.vue`
- Test: `server/cache.test.ts` (ajout), `src/components/StaleNotice.test.ts`

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces:
  - `GET /api/home` → `{ topUsers, achievementOfTheWeek, recentAwards }`
  - `GET /api/users/:user/recent` → `Achievement[]` enrichis de `gameId` et `gameTitle`
  - `cached` pose l'en-tête `X-Cache-Stale` via un retour `{ value, stale, fetchedAt }`
  - `useApi` expose `stale: Ref<string | null>` (date ISO de la donnée servie, ou `null`)

- [ ] **Step 1: Étendre le test du cache pour la fraîcheur**

Ajouter dans `server/cache.test.ts` :

```ts
it('signale une valeur perimee et sa date de recuperation', async () => {
  vi.useFakeTimers()
  const loader = vi
    .fn()
    .mockResolvedValueOnce('fraiche')
    .mockRejectedValueOnce(new Error('amont indisponible'))

  await cached('k', 1000, loader)
  const fetchedAt = new Date().toISOString()
  vi.advanceTimersByTime(1500)

  const meta = await cachedWithMeta('k', 1000, loader)

  expect(meta.value).toBe('fraiche')
  expect(meta.stale).toBe(true)
  expect(meta.fetchedAt).toBe(fetchedAt)
})
```

Ajouter `cachedWithMeta` à l'import en tête du fichier.

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run server/cache.test.ts`
Expected: FAIL — `cachedWithMeta` n'est pas exporté.

- [ ] **Step 3: Ajouter `cachedWithMeta` dans `server/cache.ts`**

Étendre `Entry` avec `fetchedAt: string`, le renseigner à chaque succès, puis :

```ts
export interface CacheMeta<T> {
  value: T
  stale: boolean
  fetchedAt: string
}

export async function cachedWithMeta<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<CacheMeta<T>> {
  const before = entries.get(key)
  const value = await cached(key, ttlMs, loader)
  const after = entries.get(key)

  const stale = before !== undefined && after?.fetchedAt === before.fetchedAt && before.expiresAt <= Date.now()

  return { value, stale, fetchedAt: after?.fetchedAt ?? new Date().toISOString() }
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run server/cache.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Poser l'en-tête dans les routes qui servent du cache**

Dans `server/routes/games.ts` pour `/games/:id`, remplacer `cached` par `cachedWithMeta` et, avant le `context.json(...)` :

```ts
if (meta.stale) {
  context.header('X-Cache-Stale', meta.fetchedAt)
}
```

Appliquer le même traitement à `/users/:user`. Les autres routes n'en ont pas besoin : leur péremption est sans conséquence visible.

- [ ] **Step 6: Écrire le test qui échoue pour `StaleNotice`**

Create `src/components/StaleNotice.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import StaleNotice from './StaleNotice.vue'

describe('StaleNotice', () => {
  it('ne rend rien sans date', () => {
    expect(mount(StaleNotice, { props: { fetchedAt: null } }).text()).toBe('')
  })

  it('affiche la date des donnees servies', () => {
    const wrapper = mount(StaleNotice, { props: { fetchedAt: '1991-06-11T00:00:00.000Z' } })

    expect(wrapper.text()).toContain('11 juin 1991')
  })

  it('porte un role de statut', () => {
    const wrapper = mount(StaleNotice, { props: { fetchedAt: '1991-06-11T00:00:00.000Z' } })

    expect(wrapper.get('[role="status"]').exists()).toBe(true)
  })
})
```

- [ ] **Step 7: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/components/StaleNotice.test.ts`
Expected: FAIL — fichier `StaleNotice.vue` introuvable.

- [ ] **Step 8: Implémenter `src/components/StaleNotice.vue`**

```vue
<script setup lang="ts">
import { formatDate } from '@/lib/format'

defineProps<{ fetchedAt: string | null }>()
</script>

<template>
  <p
    v-if="fetchedAt"
    role="status"
    class="border border-amber/40 bg-amber/10 px-3 py-2 text-xs text-amber"
  >
    L'API n'a pas repondu — donnees du {{ formatDate(fetchedAt) }}.
  </p>
</template>
```

- [ ] **Step 9: Exposer `stale` dans `useApi`**

Dans `src/composables/useApi.ts`, ajouter `const stale = ref<string | null>(null)`, le remettre à `null` au début de `load()`, le renseigner après une réponse réussie via `stale.value = response.headers.get('X-Cache-Stale')`, et l'ajouter au retour.

- [ ] **Step 10: Monter `StaleNotice` sur la fiche jeu et le profil**

Dans `src/pages/GamePage.vue`, juste après `<GameHero>` :

```html
<StaleNotice class="mt-2" :fetched-at="game.stale.value" />
```

Dans `src/pages/PlayerPage.vue`, juste après `<PlayerHero>` :

```html
<StaleNotice class="mt-2" :fetched-at="summary.stale.value" />
```

- [ ] **Step 11: Ajouter `/api/users/:user/recent`**

Dans `server/routes/users.ts` :

```ts
interface RaRecentUnlock {
  AchievementID: number
  GameID: number
  GameTitle: string
  Title: string
  Description: string
  Points: number
  TrueRatio: number
  BadgeName: string
  Type: string | null
  Date: string
  HardcoreMode: number
}

usersRoutes.get('/users/:user/recent', async (context) => {
  const user = context.req.param('user')

  const unlocks = await cached(`user-recent:${user}`, TTL.user, async () => {
    // 10080 minutes = 7 jours : la fenetre la plus large qui reste lisible en une page.
    const raw = await fetchRa<RaRecentUnlock[]>('GetUserRecentAchievements', { u: user, m: 10080 })
    return (raw ?? []).map((entry) => ({
      id: entry.AchievementID,
      gameId: entry.GameID,
      gameTitle: entry.GameTitle,
      title: entry.Title,
      description: entry.Description,
      points: entry.Points,
      trueRatio: entry.TrueRatio,
      badgeName: entry.BadgeName,
      displayOrder: 0,
      type: entry.Type === 'progression' || entry.Type === 'win_condition' || entry.Type === 'missable' ? entry.Type : null,
      numAwarded: 0,
      numAwardedHardcore: 0,
      unlockRate: 0,
      unlockRateHardcore: 0,
      dateEarned: entry.Date,
      dateEarnedHardcore: entry.HardcoreMode === 1 ? entry.Date : null,
    }))
  })

  return context.json(unlocks)
})
```

Les champs de rareté sont à zéro : `API_GetUserRecentAchievements` ne les fournit pas. `AchievementRow` affichera donc `0,0 %` — c'est pourquoi l'onglet Achievements du profil utilise un rendu propre plutôt que `AchievementRow`.

- [ ] **Step 12: Ajouter l'onglet Achievements au profil**

Dans `src/pages/PlayerPage.vue`, ajouter `{ value: 'achievements', label: 'Achievements' }` à `TABS`, un `useApi` vers `/api/users/${username}/recent`, et une section qui liste chaque déblocage avec son badge, son titre, le jeu et la date :

```html
<section v-else-if="activeTab === 'achievements'" class="mt-4">
  <StateEmpty v-if="!recent.data.value?.length" title="Aucun deblocage sur 7 jours" />
  <ul v-else class="grid gap-2">
    <li
      v-for="unlock in recent.data.value"
      :key="`${unlock.id}-${unlock.dateEarned}`"
      class="flex items-center gap-3 border border-edge bg-surface p-3"
      :class="unlock.dateEarnedHardcore ? 'border-l-[3px] border-l-phosphor' : 'border-l-[3px] border-l-amber'"
    >
      <img
        :src="badgeUrl(unlock.badgeName, true)"
        :alt="`Badge : ${unlock.title}`"
        width="48"
        height="48"
        loading="lazy"
        class="is-pixel size-12 shrink-0 border border-edge"
      />
      <span class="min-w-0 flex-1">
        <span class="block truncate font-display text-base">{{ unlock.title }}</span>
        <RouterLink
          :to="{ name: 'game', params: { gameId: unlock.gameId } }"
          class="block truncate text-xs text-muted"
        >
          {{ unlock.gameTitle }}
        </RouterLink>
        <span class="num block text-[11px] text-muted">{{ formatDate(unlock.dateEarned) }}</span>
      </span>
      <span class="num shrink-0 text-sm font-bold text-amber">{{ unlock.points }}</span>
    </li>
  </ul>
</section>
```

- [ ] **Step 13: Enrichir `/api/home`**

Dans `server/routes/home.ts`, ajouter deux appels en parallèle de `GetTopTenUsers` :

```ts
const [aotwRaw, recentAwardsRaw] = await Promise.all([
  fetchRa<Record<string, unknown>>('GetAchievementOfTheWeek', {}),
  fetchRa<unknown[]>('GetRecentGameAwards', { c: 12 }),
])
```

Vérifier la forme réelle de ces deux réponses avec `curl` avant d'écrire le mapping — ce sont, avec `GetTopTenUsers`, les seuls endpoints du projet dont le contrat n'a pas été validé en direct. Si l'une des deux réponses ne contient pas de badge exploitable, renvoyer `null` pour cette clé et masquer la section correspondante côté client plutôt que d'inventer un affichage.

- [ ] **Step 14: Afficher les deux sections sur l'accueil**

Dans `src/pages/HomePage.vue`, ajouter au-dessus de « Top joueurs » un bloc Achievement of the Week (badge en grand, titre du jeu, points) rendu uniquement si `home.data.value?.achievementOfTheWeek` n'est pas `null`, et une rangée horizontale défilable de récompenses récentes rendue uniquement si la liste est non vide.

- [ ] **Step 15: Lancer toute la suite**

Run: `npx vitest run && npm run build`
Expected: tous les tests passent, le build réussit.

- [ ] **Step 16: Commit** (si autorisé)

```bash
git add -A
git commit -m "feat: add home highlights, player achievements tab and stale data notice"
```

---

## Notes de revue du plan

Trois catégories de problèmes ont été corrigées dans ce document après rédaction.

**Classes Tailwind inexistantes.** `border-l-3`, `scale-115`, `brightness-35`, `saturate-75`, `brightness-80`, `w-33`, `h-15`, `top-15` ne sont pas dans l'échelle par défaut de Tailwind v4 et auraient été silencieusement ignorées. Remplacées par des valeurs arbitraires entre crochets.

**Deux bugs réels.** Dans `ProgressMeter`, la barre softcore portait `zIndex: -1`, ce qui l'aurait envoyée derrière le fond de son parent au lieu de derrière la barre hardcore — corrigé par l'ordre de rendu. Dans `PlayerStats`, `cells` était un tableau littéral évalué une seule fois au `setup`, donc figé aux valeurs initiales des props et jamais mis à jour après le chargement de l'API — passé en `computed`.

**Cinq éléments de spec sans tâche.** La distribution des déblocages, les top joueurs et les leaderboards de la fiche jeu, l'onglet Achievements du profil, l'Achievement of the Week et les récompenses récentes de l'accueil, et la mention de fraîcheur du cache n'étaient couverts par aucune tâche. Ils font l'objet des tâches 13 et 14.

**Une section de spec abandonnée.** Les « jeux similaires » de la fiche jeu sont retirés du périmètre : l'API publique RetroAchievements n'expose aucune source pour cette donnée.

**Trois endpoints non validés en direct.** `API_GetTopTenUsers`, `API_GetAchievementOfTheWeek` et `API_GetRecentGameAwards` sont les seuls dont la forme de réponse n'a pas été vérifiée par un appel réel pendant la conception. Les tâches 11 et 14 demandent explicitement de la vérifier au `curl` avant d'écrire le mapping.
