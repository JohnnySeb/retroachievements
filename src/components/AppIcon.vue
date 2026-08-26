<script setup lang="ts">
import { computed } from 'vue'

// Les glyphes Unicode (⌕, ▲, ◼, ★) ont des chasses et des hauteurs d'oeil differentes :
// un jeu de traces sur un meme gabarit 24x24 est le seul moyen de les uniformiser.
const props = defineProps<{ name: 'home' | 'systems' | 'ranks' | 'search' }>()

const PATHS: Record<string, string[]> = {
  home: ['M3 11 12 3l9 8', 'M5.5 9.8V21h13V9.8', 'M9.75 21v-6.25h4.5V21'],
  systems: ['M4 6.5h16v11H4z', 'M8 10v4', 'M6 12h4', 'M15 11.5h.01', 'M17.5 14h.01'],
  ranks: ['M12 3.5l2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85z'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M16.2 16.2 21 21'],
}

const paths = computed(() => PATHS[props.name] ?? [])
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    class="size-5 shrink-0"
  >
    <path v-for="(d, index) in paths" :key="index" :d="d" />
  </svg>
</template>
