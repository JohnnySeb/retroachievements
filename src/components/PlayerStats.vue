<script setup lang="ts">
import { computed } from 'vue'

import { formatNumber } from '@/lib/format'
import type { PlayerProfile } from '@/lib/types'

const props = defineProps<{ profile: PlayerProfile; gamesPlayed: number; masteries: number }>()

// computed et non tableau litteral : les props changent apres le chargement de l'API.
const cells = computed(() => [
  { label: 'HC points', value: props.profile.totalPoints, tone: 'text-phosphor' },
  { label: 'Softcore', value: props.profile.totalSoftcorePoints, tone: 'text-amber' },
  { label: 'True points', value: props.profile.totalTruePoints, tone: 'text-ink' },
  { label: 'Games', value: props.gamesPlayed, tone: 'text-ink' },
  { label: 'Masteries', value: props.masteries, tone: 'text-magenta' },
])
</script>

<template>
  <dl class="grid grid-cols-2 gap-px border border-edge bg-edge sm:grid-cols-5">
    <div
      v-for="(cell, index) in cells"
      :key="cell.label"
      class="bg-surface p-3 sm:p-4"
      :class="{ 'col-span-2 sm:col-span-1': index === cells.length - 1 }"
    >
      <dt class="tag text-muted">{{ cell.label }}</dt>
      <dd class="num mt-2 text-xl font-bold sm:text-2xl" :class="cell.tone">
        {{ formatNumber(cell.value) }}
      </dd>
    </div>
  </dl>
</template>
