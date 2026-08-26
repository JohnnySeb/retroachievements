<script setup lang="ts">
import { computed, ref } from 'vue'

import AchievementFilters from '@/components/AchievementFilters.vue'
import AchievementRow from '@/components/AchievementRow.vue'
import GameHero from '@/components/GameHero.vue'
import GameLeaderboards from '@/components/GameLeaderboards.vue'
import ProgressMeter from '@/components/ProgressMeter.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StaleNotice from '@/components/StaleNotice.vue'
import StateEmpty from '@/components/StateEmpty.vue'
import StateError from '@/components/StateError.vue'
import TopPlayersList from '@/components/TopPlayersList.vue'
import UnlockDistribution from '@/components/UnlockDistribution.vue'
import { unlockState, useAchievementFilters } from '@/composables/useAchievementFilters'
import { useApi } from '@/composables/useApi'
import { formatNumber } from '@/lib/format'
import type { Achievement, GameDetail, GameExtras, GameProgress } from '@/lib/types'
import { usePinnedPlayerStore } from '@/stores/usePinnedPlayerStore'

const props = defineProps<{ gameId: string }>()

const pinned = usePinnedPlayerStore()
const pinInput = ref('')

const game = useApi<GameDetail>(() => `/api/games/${props.gameId}`)
const extras = useApi<GameExtras>(() => `/api/games/${props.gameId}/extras`)

const progress = useApi<{ progress: GameProgress; achievements: Achievement[] }>(() =>
  pinned.username
    ? `/api/games/${props.gameId}/progress/${encodeURIComponent(pinned.username)}`
    : null,
)

// La progression du joueur epingle remplace la liste anonyme des qu'elle est disponible.
const achievements = computed<Achievement[]>(
  () => progress.data.value?.achievements ?? game.data.value?.achievements ?? [],
)

const { filter, sort, visible, counts } = useAchievementFilters(achievements)

const hasProgress = computed(() => progress.data.value !== null)

const hardcoreCount = computed(
  () => achievements.value.filter((entry) => unlockState(entry) === 'hardcore').length,
)
const softcoreCount = computed(
  () => achievements.value.filter((entry) => unlockState(entry) === 'softcore').length,
)
</script>

<template>
  <div v-if="game.pending.value" class="grid grid-cols-1 gap-3">
    <SkeletonBlock height="220px" />
    <SkeletonBlock height="64px" />
    <SkeletonBlock v-for="n in 6" :key="n" height="88px" />
  </div>

  <StateError
    v-else-if="game.error.value"
    :message="game.error.value.status === 404 ? 'This game does not exist.' : game.error.value.message"
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
        Pin your username to see your progress on every game page.
      </label>
      <input
        id="pin-player"
        v-model="pinInput"
        type="text"
        autocomplete="username"
        placeholder="RetroAchievements username"
        class="min-h-11 flex-1 border border-edge bg-bg px-3 text-sm sm:ml-auto sm:max-w-56 sm:flex-none"
      />
      <button
        type="submit"
        class="min-h-11 shrink-0 border border-phosphor bg-phosphor px-4 font-display uppercase tracking-wider text-bg"
      >
        Pin
      </button>
    </form>

    <StaleNotice class="mt-2" :fetched-at="game.stale.value" />

    <section class="mt-6">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="font-display text-xl uppercase tracking-wide">Achievements</h2>
        <p class="num text-xs text-muted">
          {{ formatNumber(game.data.value.totalPoints) }} points total
        </p>
      </div>

      <AchievementFilters
        v-model:filter="filter"
        v-model:sort="sort"
        class="mt-2"
        :counts="counts"
        :has-progress="hasProgress"
      />

      <StateEmpty
        v-if="!visible.length"
        class="mt-4"
        title="No achievements"
        hint="No achievement matches this filter."
      />

      <div v-else class="mt-3 grid grid-cols-1 gap-2">
        <AchievementRow
          v-for="achievement in visible"
          :key="achievement.id"
          :achievement="achievement"
          :has-progress="hasProgress"
        />
      </div>
    </section>

    <section v-if="extras.data.value?.distribution.length" class="mt-8">
      <h2 class="font-display text-xl uppercase tracking-wide">Unlock distribution</h2>
      <p class="mt-1 text-xs text-muted">
        Number of players by achievements unlocked, in hardcore.
      </p>
      <UnlockDistribution class="mt-3" :buckets="extras.data.value.distribution" />
    </section>

    <section v-if="extras.data.value?.topPlayers.length" class="mt-8">
      <h2 class="font-display text-xl uppercase tracking-wide">Top players</h2>
      <TopPlayersList class="mt-3" :players="extras.data.value.topPlayers" />
    </section>

    <section v-if="extras.data.value?.leaderboards.length" class="mt-8">
      <h2 class="font-display text-xl uppercase tracking-wide">Leaderboards</h2>
      <GameLeaderboards class="mt-3" :leaderboards="extras.data.value.leaderboards" />
    </section>
  </template>
</template>
