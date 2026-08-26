<script setup lang="ts">
import { formatDate } from '@/lib/format'

defineProps<{ fetchedAt: string | null }>()
</script>

<template>
  <p
    v-if="fetchedAt"
    role="status"
    class="border border-amber/40 bg-amber/10 px-3 py-2 text-xs text-amber"
  >
    The API did not respond — showing data from {{ formatDate(fetchedAt) }}.
  </p>
</template>
