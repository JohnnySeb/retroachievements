<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ buckets: Array<{ count: number; players: number }> }>()

const peak = computed(() => Math.max(1, ...props.buckets.map((bucket) => bucket.players)))
</script>

<template>
  <div data-scroll-container class="-mx-4 overflow-x-auto px-4">
    <ul class="flex h-32 min-w-full items-end gap-1">
      <li
        v-for="bucket in buckets"
        :key="bucket.count"
        data-bucket
        class="flex h-full w-3 shrink-0 items-end sm:w-4"
        :aria-label="`${bucket.players} players unlocked ${bucket.count} achievement${bucket.count > 1 ? 's' : ''}`"
      >
        <span
          class="block w-full bg-phosphor"
          :style="{ height: `${(bucket.players / peak) * 100}%` }"
        />
      </li>
    </ul>
  </div>
</template>
