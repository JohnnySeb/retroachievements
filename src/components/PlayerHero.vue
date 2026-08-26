<script setup lang="ts">
import { formatDate, formatNumber } from '@/lib/format'
import { mediaUrl } from '@/lib/media'
import type { PlayerProfile } from '@/lib/types'

defineProps<{ profile: PlayerProfile }>()
</script>

<template>
  <section class="border border-edge bg-surface p-4 sm:p-6">
    <div class="flex items-start gap-4">
      <img
        :src="mediaUrl(profile.avatarPath)"
        :alt="`Avatar for ${profile.user}`"
        width="64"
        height="64"
        class="is-pixel size-16 shrink-0 border border-edge sm:size-20"
      />

      <div class="min-w-0 flex-1">
        <h1 class="truncate font-display text-2xl font-bold uppercase sm:text-4xl">
          {{ profile.user }}
        </h1>
        <p v-if="profile.motto" class="mt-1 line-clamp-2 text-sm text-muted">{{ profile.motto }}</p>
        <p class="num mt-1 text-xs text-muted">
          <template v-if="profile.rank !== null">
            Rank {{ formatNumber(profile.rank) }} ·
          </template>
          member since {{ formatDate(profile.memberSince) }}
        </p>
      </div>
    </div>

    <p
      v-if="profile.richPresence"
      class="mt-4 flex flex-wrap items-center gap-2 border border-cyan/40 bg-cyan/10 px-3 py-2 text-xs text-cyan"
    >
      <span class="tag">Now playing</span>
      {{ profile.richPresence }}
    </p>
  </section>
</template>
