<script setup lang="ts">
import type { GameExtras } from '@/lib/types'

defineProps<{ leaderboards: GameExtras['leaderboards'] }>()
</script>

<template>
  <ul class="grid grid-cols-1 gap-2">
    <li v-for="board in leaderboards" :key="board.id" class="border border-edge bg-surface p-3">
      <p class="font-display text-base">{{ board.title }}</p>
      <p class="line-clamp-2 text-xs text-muted">{{ board.description }}</p>
      <p v-if="board.topEntry" class="num mt-2 flex flex-wrap gap-x-2 text-xs">
        <span class="text-muted">1st</span>
        <RouterLink
          :to="{ name: 'player', params: { username: board.topEntry.user } }"
          class="inline-flex min-h-11 items-center text-ink"
        >
          {{ board.topEntry.user }}
        </RouterLink>
        <span class="text-phosphor">{{ board.topEntry.formattedScore }}</span>
      </p>
    </li>
  </ul>
</template>
