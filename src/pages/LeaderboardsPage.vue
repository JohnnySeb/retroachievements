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
  <h1 class="font-display text-2xl uppercase tracking-wide">Leaderboards</h1>
  <p class="mt-1 text-xs text-muted">The ten highest-ranked players by hardcore points.</p>

  <div v-if="pending" class="mt-4 grid grid-cols-1 gap-2">
    <SkeletonBlock v-for="n in 10" :key="n" height="56px" />
  </div>

  <StateError v-else-if="error" class="mt-4" :message="error.message" @retry="reload()" />

  <StateEmpty
    v-else-if="!data?.length"
    class="mt-4"
    title="Leaderboard unavailable"
    hint="The API returned no players."
  />

  <div v-else data-scroll-container class="mt-4 overflow-x-auto">
    <ul class="grid grid-cols-1 gap-2 sm:hidden">
      <li
        v-for="entry in data"
        :key="entry.user"
        data-leaderboard-entry
        class="flex items-center gap-3 border border-edge bg-surface p-3"
      >
        <span
          class="num w-8 shrink-0 text-lg font-bold"
          :class="RANK_TONE[entry.rank - 1] ?? 'text-muted'"
        >
          {{ entry.rank }}
        </span>
        <RouterLink
          :to="{ name: 'player', params: { username: entry.user } }"
          class="flex min-h-11 min-w-0 flex-1 items-center truncate font-display text-lg"
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
          <th scope="col" class="tag p-3 text-muted">Rank</th>
          <th scope="col" class="tag p-3 text-muted">Player</th>
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
