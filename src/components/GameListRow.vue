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
