<script setup lang="ts">
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import SystemCard from '@/components/SystemCard.vue'
import { useApi } from '@/composables/useApi'
import { formatDate, formatNumber } from '@/lib/format'
import { badgeUrl } from '@/lib/media'
import type { HomePayload, SystemSummary } from '@/lib/types'

const home = useApi<HomePayload>(() => '/api/home')
const systems = useApi<SystemSummary[]>(() => '/api/systems')

const AWARD_LABEL: Record<string, string> = {
  mastered: 'MASTERED',
  completed: 'COMPLETED',
  'beaten-hardcore': 'BEATEN HC',
  'beaten-softcore': 'BEATEN',
}

// Le liseré doit refléter le type exact : vert = hardcore, ambre = softcore.
const AWARD_EDGE: Record<string, string> = {
  mastered: 'border-l-magenta',
  completed: 'border-l-amber',
  'beaten-hardcore': 'border-l-phosphor',
  'beaten-softcore': 'border-l-amber',
}

const AWARD_TEXT: Record<string, string> = {
  mastered: 'text-magenta',
  completed: 'text-amber',
  'beaten-hardcore': 'text-phosphor',
  'beaten-softcore': 'text-amber',
}
</script>

<template>
  <section class="relative overflow-hidden border border-edge bg-surface p-4 sm:p-6">
    <div
      aria-hidden="true"
      class="scanlines pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(to_bottom,rgba(255,255,255,.022)_0_1px,transparent_1px_4px)]"
    />
    <p class="tag relative text-phosphor">RetroAchievements</p>
    <h1 class="relative mt-3 font-display text-3xl font-bold uppercase leading-none sm:text-5xl">
      Achievements for your retro games
    </h1>
    <p class="relative mt-3 max-w-prose text-sm text-muted">
      Browse the systems, open a game page, pin your username and follow your progress
      achievement by achievement.
    </p>
  </section>

  <section v-if="home.data.value?.achievementOfTheWeek" class="mt-8">
    <h2 class="font-display text-xl uppercase tracking-wide">Achievement of the week</h2>
    <RouterLink
      :to="{ name: 'game', params: { gameId: home.data.value.achievementOfTheWeek.gameId } }"
      class="mt-3 flex items-start gap-4 border border-l-[3px] border-edge border-l-phosphor bg-surface p-4"
    >
      <img
        :src="badgeUrl(home.data.value.achievementOfTheWeek.badgeName, true)"
        :alt="`Badge: ${home.data.value.achievementOfTheWeek.title}`"
        width="64"
        height="64"
        class="is-pixel size-16 shrink-0 border border-edge sm:size-20"
      />
      <div class="min-w-0 flex-1">
        <h3 class="font-display text-lg font-semibold sm:text-2xl">
          {{ home.data.value.achievementOfTheWeek.title }}
        </h3>
        <p class="mt-0.5 line-clamp-2 text-sm text-muted">
          {{ home.data.value.achievementOfTheWeek.description }}
        </p>
        <p class="mt-2 truncate text-xs text-muted">
          {{ home.data.value.achievementOfTheWeek.gameTitle }}
          · {{ home.data.value.achievementOfTheWeek.systemName }}
        </p>
        <p class="num mt-1 text-xs text-muted">
          {{ formatNumber(home.data.value.achievementOfTheWeek.unlocksHardcoreCount) }} hardcore
          unlocks out of {{ formatNumber(home.data.value.achievementOfTheWeek.totalPlayers) }} players
        </p>
      </div>
      <p class="num shrink-0 text-right text-lg font-bold text-amber">
        {{ home.data.value.achievementOfTheWeek.points }}
        <span class="tag block font-normal text-muted">PTS</span>
      </p>
    </RouterLink>
  </section>

  <section v-if="home.data.value?.recentAwards.length" class="mt-8">
    <h2 class="font-display text-xl uppercase tracking-wide">Fresh awards</h2>
    <div class="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
      <RouterLink
        v-for="(award, index) in home.data.value.recentAwards"
        :key="`${award.user}-${award.gameId}-${index}`"
        :to="{ name: 'game', params: { gameId: award.gameId } }"
        class="w-56 shrink-0 border border-l-[3px] border-edge bg-surface p-3"
        :class="AWARD_EDGE[award.awardKind] ?? 'border-l-edge'"
      >
        <span class="tag" :class="AWARD_TEXT[award.awardKind] ?? 'text-muted'">
          {{ AWARD_LABEL[award.awardKind] ?? award.awardKind }}
        </span>
        <p class="mt-2 line-clamp-2 font-display text-base leading-tight">{{ award.gameTitle }}</p>
        <p class="mt-1 truncate text-xs text-muted">{{ award.systemName }}</p>
        <p class="mt-2 truncate text-xs text-ink">{{ award.user }}</p>
        <p class="num text-[11px] text-muted">{{ formatDate(award.awardDate) }}</p>
      </RouterLink>
    </div>
  </section>

  <section class="mt-8">
    <h2 class="font-display text-xl uppercase tracking-wide">Top players</h2>
    <div v-if="home.pending.value" class="mt-3 grid grid-cols-1 gap-2">
      <SkeletonBlock v-for="n in 5" :key="n" height="48px" />
    </div>
    <ol v-else class="mt-3 grid grid-cols-1 gap-2">
      <li
        v-for="entry in home.data.value?.topUsers ?? []"
        :key="entry.user"
        class="flex items-center gap-3 border border-edge bg-surface p-3"
      >
        <span class="num w-8 shrink-0 font-bold text-phosphor">{{ entry.rank }}</span>
        <RouterLink
          :to="{ name: 'player', params: { username: entry.user } }"
          class="flex min-h-11 min-w-0 flex-1 items-center truncate font-display text-lg"
        >
          {{ entry.user }}
        </RouterLink>
        <span class="num shrink-0 text-sm text-muted">{{ formatNumber(entry.totalPoints) }}</span>
      </li>
    </ol>
  </section>

  <section class="mt-8">
    <h2 class="font-display text-xl uppercase tracking-wide">Systems</h2>
    <ul class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="system in (systems.data.value ?? []).slice(0, 12)" :key="system.id">
        <SystemCard :system="system" />
      </li>
    </ul>
    <RouterLink
      :to="{ name: 'systems' }"
      class="mt-3 inline-flex min-h-11 items-center border border-edge bg-raised px-4 font-display uppercase tracking-wider"
    >
      All systems
    </RouterLink>
  </section>
</template>
