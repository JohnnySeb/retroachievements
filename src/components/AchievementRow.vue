<script setup lang="ts">
import { computed } from 'vue'

import { unlockState } from '@/composables/useAchievementFilters'
import { formatPercent } from '@/lib/format'
import { badgeUrl } from '@/lib/media'
import type { Achievement } from '@/lib/types'

const props = withDefaults(
  defineProps<{ achievement: Achievement; hasProgress?: boolean }>(),
  { hasProgress: false },
)

// Sans joueur epingle, l'etat de deblocage est inconnu : afficher LOCKED serait un mensonge.
const state = computed(() => unlockState(props.achievement))
const isUnlocked = computed(() => !props.hasProgress || state.value !== 'locked')

const STATE_LABEL = { hardcore: 'HARDCORE', softcore: 'SOFTCORE', locked: 'LOCKED' } as const
const STATE_EDGE = {
  hardcore: 'border-l-phosphor',
  softcore: 'border-l-amber',
  locked: 'border-l-edge bg-bg',
} as const
const STATE_TEXT = { hardcore: 'text-phosphor', softcore: 'text-amber', locked: 'text-muted' } as const
const TYPE_LABEL = {
  progression: 'Progression',
  win_condition: 'Win condition',
  missable: 'Missable',
} as const

const badgeAlt = computed(
  () => `${isUnlocked.value ? 'Badge' : 'Locked badge'}: ${props.achievement.title}`,
)
</script>

<template>
  <article
    class="flex items-start gap-3 border border-l-[3px] border-edge bg-surface p-3 sm:items-center sm:gap-4 sm:p-4"
    :class="hasProgress ? STATE_EDGE[state] : 'border-l-edge'"
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
          :class="{ 'text-muted': hasProgress && !isUnlocked }"
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

      <p class="mt-0.5 line-clamp-2 text-xs text-muted sm:text-sm">{{ achievement.description }}</p>

      <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-muted">
        <span
          v-if="hasProgress"
          class="tag border border-current px-1.5 py-0.5"
          :class="STATE_TEXT[state]"
        >
          {{ STATE_LABEL[state] }}
        </span>
        <span class="num" :class="{ 'text-magenta': achievement.unlockRate < 15 }">
          {{ formatPercent(achievement.unlockRate) }} of players
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
