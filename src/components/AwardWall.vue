<script setup lang="ts">
import { formatDate } from '@/lib/format'
import { mediaUrl } from '@/lib/media'
import type { PlayerAward } from '@/lib/types'

defineProps<{ awards: PlayerAward[] }>()
</script>

<template>
  <ul class="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-8">
    <li v-for="award in awards" :key="`${award.gameId}-${award.awardedAt}`">
      <RouterLink
        :to="{ name: 'game', params: { gameId: award.gameId } }"
        class="block border border-l-[3px] border-edge bg-surface p-2"
        :class="award.isHardcore ? 'border-l-phosphor' : 'border-l-amber'"
      >
        <img
          :src="mediaUrl(award.iconPath)"
          :alt="`${award.awardType} — ${award.title}`"
          width="48"
          height="48"
          loading="lazy"
          class="is-pixel mx-auto size-12 border border-edge"
        />
        <p class="mt-2 line-clamp-2 text-center text-[11px] leading-tight">{{ award.title }}</p>
        <p class="num mt-1 text-center text-[10px] text-muted">{{ formatDate(award.awardedAt) }}</p>
      </RouterLink>
    </li>
  </ul>
</template>
