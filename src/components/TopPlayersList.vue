<script setup lang="ts">
import { formatNumber } from '@/lib/format'

defineProps<{ players: Array<{ user: string; numAchievements: number; totalScore: number }> }>()
</script>

<template>
  <ol class="grid grid-cols-1 gap-1">
    <li
      v-for="(player, index) in players"
      :key="player.user"
      class="flex min-h-11 items-center gap-3 border border-edge bg-surface px-3"
    >
      <span class="num w-6 shrink-0 text-sm text-muted">{{ index + 1 }}</span>
      <RouterLink
        :to="{ name: 'player', params: { username: player.user } }"
        class="flex min-h-11 min-w-0 flex-1 items-center truncate text-sm"
      >
        {{ player.user }}
      </RouterLink>
      <span class="num shrink-0 text-xs text-amber">{{ formatNumber(player.totalScore) }}</span>
    </li>
  </ol>
</template>
