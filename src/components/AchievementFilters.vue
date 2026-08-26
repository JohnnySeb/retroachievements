<script setup lang="ts">
import { computed } from 'vue'

import type { AchievementFilter, AchievementSort } from '@/composables/useAchievementFilters'

const props = withDefaults(
  defineProps<{ counts: Record<AchievementFilter, number>; hasProgress?: boolean }>(),
  { hasProgress: false },
)

const filter = defineModel<AchievementFilter>('filter', { required: true })
const sort = defineModel<AchievementSort>('sort', { required: true })

const ALL_FILTERS: Array<{ value: AchievementFilter; label: string; needsProgress: boolean }> = [
  { value: 'all', label: 'All', needsProgress: false },
  { value: 'unlocked', label: 'Unlocked', needsProgress: true },
  { value: 'locked', label: 'Locked', needsProgress: true },
  { value: 'progression', label: 'Progression', needsProgress: false },
  { value: 'win_condition', label: 'Win condition', needsProgress: false },
  { value: 'missable', label: 'Missable', needsProgress: false },
]

const filterOptions = computed(() =>
  ALL_FILTERS.filter((option) => props.hasProgress || !option.needsProgress),
)

const SORT_OPTIONS: Array<{ value: AchievementSort; label: string }> = [
  { value: 'display', label: 'Set order' },
  { value: 'points', label: 'Points' },
  { value: 'rarity', label: 'Rarity' },
  { value: 'earned', label: 'Unlock date' },
]
</script>

<template>
  <div class="sticky top-[57px] z-20 -mx-4 border-b border-edge bg-bg/95 px-4 py-2 backdrop-blur md:top-[61px]">
    <div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter achievements">
      <button
        v-for="option in filterOptions"
        :key="option.value"
        type="button"
        :aria-pressed="filter === option.value"
        class="min-h-11 shrink-0 whitespace-nowrap border px-3 text-xs"
        :class="
          filter === option.value
            ? 'border-phosphor bg-phosphor text-bg'
            : 'border-edge bg-surface text-muted'
        "
        @click="filter = option.value"
      >
        {{ option.label }}
        <span class="num">· {{ counts[option.value] }}</span>
      </button>
    </div>

    <label class="mt-2 flex items-center gap-2 text-xs text-muted">
      <span class="tag shrink-0">Sort</span>
      <select
        v-model="sort"
        class="min-h-11 flex-1 border border-edge bg-surface px-2 text-xs text-ink sm:flex-none"
      >
        <option v-for="option in SORT_OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>
  </div>
</template>
