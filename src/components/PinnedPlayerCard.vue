<script setup lang="ts">
import { computed } from 'vue'

import UnpinButton from '@/components/UnpinButton.vue'
import { useApi } from '@/composables/useApi'
import { formatNumber } from '@/lib/format'
import { mediaUrl } from '@/lib/media'
import type { PlayerSummary } from '@/lib/types'
import { usePinnedPlayerStore } from '@/stores/usePinnedPlayerStore'

const pinned = usePinnedPlayerStore()

const { data } = useApi<PlayerSummary>(() =>
  pinned.username ? `/api/users/${encodeURIComponent(pinned.username)}` : null,
)

// Le pseudo epingle suffit a proposer le lien : le profil ne sert qu'a l'enrichir.
const profile = computed(() => data.value?.profile ?? null)
</script>

<template>
  <section
    v-if="pinned.username"
    data-pinned-card
    class="flex flex-col gap-3 border border-l-[3px] border-edge border-l-phosphor bg-surface p-4 sm:flex-row sm:items-center sm:gap-4"
  >
    <img
      v-if="profile"
      :src="mediaUrl(profile.avatarPath)"
      :alt="`Avatar for ${profile.user}`"
      width="48"
      height="48"
      class="is-pixel size-12 shrink-0 border border-edge"
    />

    <div class="min-w-0 flex-1">
      <p class="tag text-phosphor">Pinned player</p>
      <p class="mt-2 truncate font-display text-xl font-bold uppercase">{{ pinned.username }}</p>
      <p v-if="data" class="num mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        <span><b class="font-normal text-amber">{{ formatNumber(profile!.totalSoftcorePoints) }}</b> softcore</span>
        <span aria-hidden="true">·</span>
        <span><b class="font-normal text-phosphor">{{ formatNumber(profile!.totalPoints) }}</b> points</span>
        <span aria-hidden="true">·</span>
        <span><b class="font-normal text-ink">{{ formatNumber(profile!.totalTruePoints) }}</b> true points</span>
        <span aria-hidden="true">·</span>
        <span><b class="font-normal text-ink">{{ formatNumber(data.gamesTotal) }}</b> games played</span>
      </p>
      <p v-if="profile?.richPresence" class="mt-1 truncate text-xs text-cyan">
        {{ profile.richPresence }}
      </p>
    </div>

    <div class="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
      <RouterLink
        :to="{ name: 'player', params: { username: pinned.username } }"
        class="flex min-h-11 flex-1 items-center justify-center border border-phosphor bg-phosphor px-4 font-display uppercase tracking-wider text-bg sm:flex-none"
      >
        Go to this profile
      </RouterLink>
      <UnpinButton :username="pinned.username" @confirm="pinned.unpin()" />
    </div>
  </section>
</template>
