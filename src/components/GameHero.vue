<script setup lang="ts">
import { computed } from 'vue'

import { formatDate, formatNumber } from '@/lib/format'
import { mediaUrl } from '@/lib/media'
import type { GameDetail } from '@/lib/types'

const props = defineProps<{ game: GameDetail }>()

const backgroundStyle = computed(() => ({
  backgroundImage: `url('${mediaUrl(props.game.ingamePath)}')`,
}))
</script>

<template>
  <section class="relative overflow-hidden border border-edge">
    <div
      aria-hidden="true"
      class="absolute inset-0 scale-[1.15] bg-cover bg-center blur-lg brightness-[.35] saturate-[.75]"
      :style="backgroundStyle"
    />
    <div
      aria-hidden="true"
      class="scanlines pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(to_bottom,rgba(255,255,255,.055)_0_1px,transparent_1px_3px)]"
    />

    <div class="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:gap-6 sm:p-6">
      <img
        :src="mediaUrl(game.boxArtPath)"
        :alt="`Box art for ${game.title}`"
        width="96"
        height="132"
        class="is-pixel w-24 shrink-0 self-start border border-edge shadow-[5px_5px_0_rgba(0,0,0,.55)] sm:w-[132px]"
      />

      <div class="min-w-0">
        <RouterLink
          :to="{ name: 'system-games', params: { systemId: game.systemId } }"
          class="-ml-1 inline-flex min-h-11 items-center px-1 text-xs font-medium uppercase tracking-wider text-cyan"
        >
          {{ game.systemName }}
        </RouterLink>

        <h1 class="mt-2 line-clamp-2 font-display text-3xl font-bold leading-none sm:text-5xl">
          {{ game.title }}
        </h1>

        <div
          class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted sm:flex sm:flex-wrap sm:text-sm"
        >
          <span class="truncate sm:whitespace-nowrap">
            Developer <b class="font-medium text-ink">{{ game.developer || '—' }}</b>
          </span>
          <span class="truncate sm:whitespace-nowrap">
            Publisher <b class="font-medium text-ink">{{ game.publisher || '—' }}</b>
          </span>
          <span class="truncate sm:whitespace-nowrap">
            Genre <b class="font-medium text-ink">{{ game.genre || '—' }}</b>
          </span>
          <span class="truncate sm:whitespace-nowrap">
            Released <b class="font-medium text-ink">{{ formatDate(game.released) }}</b>
          </span>
          <span class="truncate sm:whitespace-nowrap">
            <b class="num font-medium text-ink">{{ formatNumber(game.numDistinctPlayers) }}</b>
            players
          </span>
        </div>
      </div>
    </div>
  </section>
</template>
