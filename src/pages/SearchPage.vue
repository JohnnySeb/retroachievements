<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import GameListRow from '@/components/GameListRow.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StateEmpty from '@/components/StateEmpty.vue'
import { useApi } from '@/composables/useApi'
import type { SearchResults } from '@/lib/types'

const route = useRoute()
const query = computed(() => String(route.query.q ?? '').trim())

const { data, error, pending } = useApi<SearchResults>(() =>
  query.value.length >= 2 ? `/api/search?q=${encodeURIComponent(query.value)}` : null,
)
</script>

<template>
  <h1 class="font-display text-2xl uppercase tracking-wide">
    Search<span v-if="query" class="text-muted"> — {{ query }}</span>
  </h1>

  <div v-if="pending" class="mt-4 grid grid-cols-1 gap-2">
    <SkeletonBlock v-for="n in 6" :key="n" height="66px" />
  </div>

  <StateEmpty
    v-else-if="error?.indexing"
    class="mt-4"
    title="Search index not built"
    hint="Run npm run warm to build the game search index."
  />

  <StateEmpty v-else-if="!query" class="mt-4" title="Type a search" />

  <ul v-else-if="data?.games.length" class="mt-4 grid grid-cols-1 gap-2">
    <li v-for="game in data.games" :key="game.id">
      <GameListRow :game="game" />
    </li>
  </ul>

  <StateEmpty v-else class="mt-4" title="No results" />
</template>
