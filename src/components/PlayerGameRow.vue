<script setup lang="ts">
import { computed, ref } from 'vue'

import AchievementRow from '@/components/AchievementRow.vue'
import AppIcon from '@/components/AppIcon.vue'
import GameProgressCard from '@/components/GameProgressCard.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import { useApi } from '@/composables/useApi'
import type { Achievement, GameProgress, PlayerGameProgress } from '@/lib/types'

const props = defineProps<{ game: PlayerGameProgress; username: string }>()

const isOpen = ref(false)

// Le panneau n'appelle l'API qu'une fois ouvert : une liste de 500 jeux ne doit
// pas declencher 500 requetes.
const { data, error, pending } = useApi<{ progress: GameProgress; achievements: Achievement[] }>(
  () =>
    isOpen.value
      ? `/api/games/${props.game.gameId}/progress/${encodeURIComponent(props.username)}`
      : null,
)

const panelId = computed(() => `game-achievements-${props.game.gameId}`)
</script>

<template>
  <div class="border border-edge bg-surface">
    <div class="flex items-stretch">
      <RouterLink
        :to="{ name: 'game', params: { gameId: game.gameId } }"
        class="flex min-w-0 flex-1 items-center p-3"
      >
        <GameProgressCard :game="game" />
      </RouterLink>

      <button
        type="button"
        data-toggle
        class="flex min-h-11 w-12 shrink-0 items-center justify-center border-l border-edge text-muted hover:text-phosphor"
        :aria-expanded="isOpen"
        :aria-controls="panelId"
        :aria-label="`${isOpen ? 'Hide' : 'Show'} achievements for ${game.title}`"
        @click="isOpen = !isOpen"
      >
        <AppIcon
          name="chevron"
          class="transition-transform duration-150"
          :class="{ 'rotate-180': isOpen }"
        />
      </button>
    </div>

    <div v-if="isOpen" :id="panelId" class="border-t border-edge p-3">
      <div v-if="pending" class="grid grid-cols-1 gap-2">
        <SkeletonBlock v-for="n in 3" :key="n" height="72px" />
      </div>

      <p v-else-if="error" class="text-xs text-magenta">{{ error.message }}</p>

      <p v-else-if="!data?.achievements.length" class="text-xs text-muted">
        This set has no achievements.
      </p>

      <ul v-else class="grid grid-cols-1 gap-2">
        <li v-for="achievement in data.achievements" :key="achievement.id">
          <AchievementRow :achievement="achievement" has-progress />
        </li>
      </ul>
    </div>
  </div>
</template>
