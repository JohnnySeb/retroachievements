<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'

defineEmits<{ 'open-search': [] }>()

const destinations = [
  { name: 'home', label: 'Home', icon: 'home' },
  { name: 'systems', label: 'Systems', icon: 'systems' },
  { name: 'leaderboards', label: 'Ranks', icon: 'ranks' },
] as const
</script>

<template>
  <nav
    aria-label="Main navigation"
    class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-edge bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
  >
    <RouterLink
      v-for="destination in destinations"
      :key="destination.name"
      :to="{ name: destination.name }"
      data-nav-item
      class="flex min-h-11 flex-col items-center justify-center gap-1 py-2 text-muted"
      active-class="text-phosphor"
    >
      <AppIcon :name="destination.icon" />
      <span class="tag">{{ destination.label }}</span>
    </RouterLink>

    <button
      type="button"
      data-nav-item
      data-nav-search
      class="flex min-h-11 flex-col items-center justify-center gap-1 py-2 text-muted"
      @click="$emit('open-search')"
    >
      <AppIcon name="search" />
      <span class="tag">Search</span>
    </button>
  </nav>
</template>
