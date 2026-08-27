<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'
import { useNavDestinations } from '@/composables/useNavDestinations'

defineEmits<{ 'open-search': [] }>()

const destinations = useNavDestinations()
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-edge bg-bg/90 backdrop-blur">
    <div class="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 md:h-[60px]">
      <RouterLink :to="{ name: 'home' }" class="flex min-h-11 shrink-0 items-center gap-2">
        <span
          aria-hidden="true"
          class="grid size-6 shrink-0 place-items-center bg-phosphor font-pixel text-[10px] text-bg"
        >
          RA
        </span>
        <span class="font-display text-lg font-bold uppercase tracking-wide">
          RetroAchievements
        </span>
      </RouterLink>

      <nav aria-label="Sections" class="hidden gap-6 md:flex">
        <RouterLink
          v-for="destination in destinations"
          :key="destination.name"
          :to="{ name: destination.name }"
          data-nav-item
          :data-active="destination.isActive ? '' : undefined"
          :aria-current="destination.isActive ? 'page' : undefined"
          class="border-b-2 py-1 font-display text-base font-semibold uppercase tracking-wider"
          :class="
            destination.isActive
              ? 'border-phosphor text-ink'
              : 'border-transparent text-muted hover:text-ink'
          "
        >
          {{ destination.label }}
        </RouterLink>
      </nav>

      <button
        type="button"
        class="ml-auto flex min-h-11 shrink-0 items-center gap-3 border border-edge bg-surface px-3 text-sm text-muted hover:text-ink md:min-w-64"
        @click="$emit('open-search')"
      >
        <AppIcon name="search" />
        <span class="hidden md:inline">Search a game or a player…</span>
        <span class="sr-only md:hidden">Search</span>
        <kbd
          class="kbd-hint num ml-auto hidden border border-edge bg-raised px-1.5 py-0.5 text-[11px] md:inline"
        >
          ⌘K
        </kbd>
      </button>
    </div>
  </header>
</template>
