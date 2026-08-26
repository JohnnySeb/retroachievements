<script setup lang="ts">
import { computed } from 'vue'

import { formatPercent } from '@/lib/format'

const props = defineProps<{ total: number; hardcore: number; softcore: number }>()

const hardcorePct = computed(() => (props.total ? (props.hardcore / props.total) * 100 : 0))
const softcorePct = computed(() => (props.total ? (props.softcore / props.total) * 100 : 0))
const earned = computed(() => props.hardcore + props.softcore)
</script>

<template>
  <section
    aria-label="Progress"
    class="flex flex-col gap-3 border border-t-0 border-edge bg-surface p-4 sm:flex-row sm:items-center sm:gap-5"
  >
    <p class="num shrink-0 text-xl font-bold text-phosphor">
      {{ earned }}<span class="font-normal text-muted">/{{ total }}</span>
    </p>

    <div
      class="relative h-3 w-full overflow-hidden border border-edge bg-bg"
      role="progressbar"
      :aria-valuenow="Math.round(hardcorePct + softcorePct)"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <span class="absolute inset-y-0 left-0 bg-phosphor" :style="{ width: `${hardcorePct}%` }" />
      <span
        class="absolute inset-y-0 bg-amber/85"
        :style="{ left: `${hardcorePct}%`, width: `${softcorePct}%` }"
      />
    </div>

    <p class="num shrink-0 text-xs text-muted">
      <span class="text-phosphor" aria-hidden="true">■</span>
      {{ hardcore }} hardcore · {{ formatPercent(hardcorePct, 0) }}
      &nbsp;
      <span class="text-amber" aria-hidden="true">■</span>
      {{ softcore }} softcore · {{ formatPercent(softcorePct, 0) }}
    </p>
  </section>
</template>
