<script setup lang="ts">
import { ref } from 'vue'

import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StateError from '@/components/StateError.vue'
import SystemCard from '@/components/SystemCard.vue'
import { useApi } from '@/composables/useApi'
import { useProximityGlow } from '@/composables/useProximityGlow'
import type { SystemSummary } from '@/lib/types'

const { data, error, pending, reload } = useApi<SystemSummary[]>(() => '/api/systems')

const grid = ref<HTMLElement | null>(null)
useProximityGlow(grid)
</script>

<template>
  <h1 class="font-display text-2xl uppercase tracking-wide">Systems</h1>

  <div v-if="pending" class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
    <SkeletonBlock v-for="n in 12" :key="n" height="62px" />
  </div>

  <StateError v-else-if="error" class="mt-4" :message="error.message" @retry="reload()" />

  <ul v-else ref="grid" class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
    <li v-for="system in data ?? []" :key="system.id">
      <SystemCard :system="system" />
    </li>
  </ul>
</template>
