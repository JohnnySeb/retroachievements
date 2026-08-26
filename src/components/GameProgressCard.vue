<script setup lang="ts">
import { computed } from 'vue'

import { mediaUrl } from '@/lib/media'
import type { PlayerGameProgress } from '@/lib/types'

const props = defineProps<{ game: PlayerGameProgress }>()

const percent = computed(() =>
  props.game.maxPossible ? Math.round((props.game.numAwarded / props.game.maxPossible) * 100) : 0,
)
const hardcorePercent = computed(() =>
  props.game.maxPossible ? (props.game.numAwardedHardcore / props.game.maxPossible) * 100 : 0,
)

const AWARD_LABEL: Record<string, string> = {
  mastered: 'MASTERED',
  completed: 'COMPLETED',
  'beaten-hardcore': 'BEATEN HC',
  'beaten-softcore': 'BEATEN',
}

const awardLabel = computed(() =>
  props.game.highestAwardKind ? (AWARD_LABEL[props.game.highestAwardKind] ?? null) : null,
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
      <div class="flex min-w-0 items-center gap-2">
        <h3 class="min-w-0 truncate font-display text-base">{{ game.title }}</h3>
        <span
          v-if="awardLabel"
          class="tag shrink-0 border border-magenta px-1.5 py-0.5 text-magenta"
        >
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
        :aria-label="`Progress on ${game.title}`"
      >
        <span class="absolute inset-y-0 left-0 bg-amber/50" :style="{ width: `${percent}%` }" />
        <span
          class="absolute inset-y-0 left-0 bg-phosphor"
          :style="{ width: `${hardcorePercent}%` }"
        />
      </div>
    </div>

    <p class="num shrink-0 text-sm text-muted">{{ game.numAwarded }}/{{ game.maxPossible }}</p>
  </RouterLink>
</template>
