<script setup lang="ts">
import { computed, ref } from 'vue'

import AwardWall from '@/components/AwardWall.vue'
import AppIcon from '@/components/AppIcon.vue'
import PlayerGameRow from '@/components/PlayerGameRow.vue'
import PlayerHero from '@/components/PlayerHero.vue'
import PlayerStats from '@/components/PlayerStats.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StaleNotice from '@/components/StaleNotice.vue'
import StateEmpty from '@/components/StateEmpty.vue'
import StateError from '@/components/StateError.vue'
import TabStrip from '@/components/TabStrip.vue'
import UnpinButton from '@/components/UnpinButton.vue'
import { useApi } from '@/composables/useApi'
import { formatDate, formatNumber, formatPercent } from '@/lib/format'
import { badgeUrl, mediaUrl } from '@/lib/media'
import type {
  PlayerProgressPayload,
  PlayerSummary,
  RecentUnlock,
  SuggestedUnlock,
} from '@/lib/types'
import { usePinnedPlayerStore } from '@/stores/usePinnedPlayerStore'

const props = defineProps<{ username: string }>()

const pinned = usePinnedPlayerStore()
const activeTab = ref('games')

const TABS = [
  { value: 'games', label: 'Games' },
  { value: 'suggested', label: 'Suggested' },
  { value: 'recent', label: 'Activity' },
  { value: 'achievements', label: 'Achievements' },
  { value: 'awards', label: 'Awards' },
]

const summary = useApi<PlayerSummary>(() => `/api/users/${encodeURIComponent(props.username)}`)
const progress = useApi<PlayerProgressPayload>(
  () => `/api/users/${encodeURIComponent(props.username)}/progress`,
)
const recent = useApi<RecentUnlock[]>(
  () => `/api/users/${encodeURIComponent(props.username)}/recent`,
)

// Les suggestions coutent plusieurs appels amont : on ne les charge qu'a l'ouverture
// de l'onglet, pas au chargement du profil.
const suggestions = useApi<SuggestedUnlock[]>(() =>
  activeTab.value === 'suggested'
    ? `/api/users/${encodeURIComponent(props.username)}/suggestions`
    : null,
)

const playedGames = computed(() => progress.data.value?.results ?? [])
const masteries = computed(
  () => playedGames.value.filter((game) => game.highestAwardKind === 'mastered').length,
)

const isPinned = computed(() => pinned.username?.toLowerCase() === props.username.toLowerCase())
</script>

<template>
  <div v-if="summary.pending.value" class="grid grid-cols-1 gap-3">
    <SkeletonBlock height="140px" />
    <SkeletonBlock height="90px" />
    <SkeletonBlock v-for="n in 4" :key="n" height="76px" />
  </div>

  <StateError
    v-else-if="summary.error.value"
    :message="
      summary.error.value.status === 404 ? 'This player does not exist.' : summary.error.value.message
    "
    @retry="summary.reload()"
  />

  <template v-else-if="summary.data.value">
    <PlayerHero :profile="summary.data.value.profile" />
    <StaleNotice class="mt-2" :fetched-at="summary.stale.value" />

    <div class="mt-3">
      <UnpinButton v-if="isPinned" :username="username" @confirm="pinned.unpin()" />
      <button
        v-else
        type="button"
        class="min-h-11 w-full border border-phosphor bg-phosphor px-4 font-display uppercase tracking-wider text-bg sm:w-auto"
        @click="pinned.pin(username)"
      >
        Pin this player
      </button>
    </div>

    <PlayerStats
      class="mt-4"
      :profile="summary.data.value.profile"
      :games-played="progress.data.value?.total ?? 0"
      :masteries="masteries"
    />

    <TabStrip v-model="activeTab" class="mt-6" :tabs="TABS" />

    <section v-if="activeTab === 'games'" class="mt-4">
      <div v-if="progress.pending.value" class="grid grid-cols-1 gap-2">
        <SkeletonBlock v-for="n in 5" :key="n" height="76px" />
      </div>
      <StateEmpty v-else-if="!playedGames.length" title="No games played" />
      <template v-else>
        <p v-if="progress.data.value && progress.data.value.total > playedGames.length" class="num mb-3 text-xs text-muted">
          Showing {{ playedGames.length }} of {{ formatNumber(progress.data.value.total) }} —
          the API caps this list at 500 entries.
        </p>
        <ul class="grid grid-cols-1 gap-2">
          <li v-for="game in playedGames" :key="game.gameId">
            <PlayerGameRow :game="game" :username="username" />
          </li>
        </ul>
      </template>
    </section>

    <section v-else-if="activeTab === 'suggested'" class="mt-4">
      <p class="mb-3 max-w-prose text-xs text-muted">
        Locked achievements from the games closest to completion, most commonly unlocked first —
        the likeliest quick wins.
      </p>

      <div v-if="suggestions.pending.value" class="grid grid-cols-1 gap-2">
        <SkeletonBlock v-for="n in 5" :key="n" height="76px" />
      </div>

      <StateError
        v-else-if="suggestions.error.value"
        :message="suggestions.error.value.message"
        @retry="suggestions.reload()"
      />

      <StateEmpty
        v-else-if="!suggestions.data.value?.length"
        title="Nothing to suggest"
        hint="Every started game is either finished or has no locked achievement left."
      />

      <ul v-else class="grid grid-cols-1 gap-2">
        <li
          v-for="entry in suggestions.data.value"
          :key="`${entry.gameId}-${entry.id}`"
          class="border border-l-[3px] border-edge border-l-cyan bg-surface p-3"
        >
          <div class="flex items-start gap-3">
            <img
              :src="badgeUrl(entry.badgeName, false)"
              :alt="`Locked badge: ${entry.title}`"
              width="48"
              height="48"
              loading="lazy"
              class="is-pixel size-12 shrink-0 border border-edge brightness-[.8]"
            />
            <div class="min-w-0 flex-1">
              <h3 class="truncate font-display text-base">{{ entry.title }}</h3>
              <p class="line-clamp-2 text-xs text-muted">{{ entry.description }}</p>
              <p class="num mt-1 text-[11px] text-phosphor">
                {{ formatPercent(entry.unlockRate) }} of players have it
              </p>
            </div>
            <p class="num shrink-0 text-right text-sm font-bold text-amber">
              {{ entry.points }}
              <span class="tag block font-normal text-muted">PTS</span>
            </p>
          </div>

          <RouterLink
            :to="{ name: 'game', params: { gameId: entry.gameId } }"
            class="mt-3 flex min-h-11 items-center gap-2 border-t border-edge pt-2 text-xs text-muted"
          >
            <img
              :src="mediaUrl(entry.gameIconPath)"
              alt=""
              width="20"
              height="20"
              loading="lazy"
              class="is-pixel size-5 shrink-0 border border-edge"
            />
            <span class="min-w-0 truncate">{{ entry.gameTitle }}</span>
            <span class="num ml-auto shrink-0">
              {{ entry.gameAwarded }}/{{ entry.gamePossible }}
            </span>
            <AppIcon name="chevron" class="size-4 shrink-0 -rotate-90" />
          </RouterLink>
        </li>
      </ul>
    </section>

    <section v-else-if="activeTab === 'recent'" class="mt-4">
      <StateEmpty v-if="!summary.data.value.recentGames.length" title="No recent activity" />
      <ul v-else class="grid grid-cols-1 gap-2">
        <li v-for="game in summary.data.value.recentGames" :key="game.gameId">
          <PlayerGameRow :game="game" :username="username" />
        </li>
      </ul>
    </section>

    <section v-else-if="activeTab === 'achievements'" class="mt-4">
      <div v-if="recent.pending.value" class="grid grid-cols-1 gap-2">
        <SkeletonBlock v-for="n in 5" :key="n" height="76px" />
      </div>
      <StateEmpty
        v-else-if="!recent.data.value?.length"
        title="No unlocks"
        hint="The API only reports the last seven days."
      />
      <ul v-else class="grid grid-cols-1 gap-2">
        <li
          v-for="unlock in recent.data.value"
          :key="`${unlock.id}-${unlock.dateEarned}`"
          class="flex items-center gap-3 border border-l-[3px] border-edge bg-surface p-3"
          :class="unlock.dateEarnedHardcore ? 'border-l-phosphor' : 'border-l-amber'"
        >
          <img
            :src="badgeUrl(unlock.badgeName, true)"
            :alt="`Badge: ${unlock.title}`"
            width="48"
            height="48"
            loading="lazy"
            class="is-pixel size-12 shrink-0 border border-edge"
          />
          <span class="min-w-0 flex-1">
            <span class="block truncate font-display text-base">{{ unlock.title }}</span>
            <RouterLink
              :to="{ name: 'game', params: { gameId: unlock.gameId } }"
              class="block truncate text-xs text-muted"
            >
              {{ unlock.gameTitle }}
            </RouterLink>
            <span class="num block text-[11px] text-muted">
              {{ formatDate(unlock.dateEarned) }}
              · {{ unlock.dateEarnedHardcore ? 'HARDCORE' : 'SOFTCORE' }}
            </span>
          </span>
          <span class="num shrink-0 text-sm font-bold text-amber">{{ unlock.points }}</span>
        </li>
      </ul>
    </section>

    <section v-else class="mt-4">
      <StateEmpty v-if="!summary.data.value.awards.length" title="No awards" />
      <template v-else>
        <p class="num mb-3 text-xs text-muted">
          Showing {{ summary.data.value.awards.length }} of
          {{ formatNumber(summary.data.value.awardsTotal) }} — most recent first.
        </p>
        <AwardWall :awards="summary.data.value.awards" />
      </template>
    </section>
  </template>
</template>
