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
    {{ data?.[0]?.systemName ?? 'Games' }}
  </h1>

  <div class="mt-3 flex flex-col gap-2 sm:flex-row">
    <input
      v-model="query"
      type="search"
      placeholder="Filter by title"
      aria-label="Filter by title"
      class="min-h-11 flex-1 border border-edge bg-surface px-3 text-sm"
    />
    <select
      v-model="sort"
      aria-label="Sort games"
      class="min-h-11 border border-edge bg-surface px-3 text-sm"
    >
      <option value="title">Title</option>
      <option value="achievements">Achievements</option>
      <option value="points">Points</option>
    </select>
  </div>

  <div v-if="pending" class="mt-4 grid grid-cols-1 gap-2">
    <SkeletonBlock v-for="n in 10" :key="n" height="66px" />
  </div>

  <StateError v-else-if="error" class="mt-4" :message="error.message" @retry="reload()" />

  <StateEmpty v-else-if="!visible.length" class="mt-4" title="No games" />

  <template v-else>
    <p class="num mt-4 text-xs text-muted">{{ visible.length }} games</p>
    <ul class="mt-2 grid grid-cols-1 gap-2">
      <li v-for="game in visible" :key="game.id">
        <GameListRow :game="game" />
      </li>
    </ul>
  </template>
</template>
