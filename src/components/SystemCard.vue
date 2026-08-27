<script setup lang="ts">
import type { SystemSummary } from '@/lib/types'

defineProps<{ system: SystemSummary }>()
</script>

<template>
  <RouterLink
    :to="{ name: 'system-games', params: { systemId: system.id } }"
    data-glow
    class="glow-card relative flex min-h-11 items-center gap-3 border border-edge bg-surface p-3"
  >
    <span aria-hidden="true" class="glow-ring" />
    <img :src="system.iconUrl" alt="" width="32" height="32" loading="lazy" class="size-8 shrink-0" />
    <span class="min-w-0 truncate font-display text-base uppercase tracking-wide">
      {{ system.name }}
    </span>
  </RouterLink>
</template>
