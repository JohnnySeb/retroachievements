<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import SearchOverlay from '@/components/SearchOverlay.vue'
import TheBottomNav from '@/components/TheBottomNav.vue'
import TheTopBar from '@/components/TheTopBar.vue'

const isSearchOpen = ref(false)

function onKeydown(event: KeyboardEvent): void {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    isSearchOpen.value = true
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <TheTopBar @open-search="isSearchOpen = true" />

  <!-- pb-24 reserve la hauteur de la barre d'onglets, qui est en position fixe. -->
  <main class="mx-auto max-w-6xl px-4 pb-24 pt-4 md:pb-12">
    <RouterView />
  </main>

  <TheBottomNav @open-search="isSearchOpen = true" />
  <SearchOverlay :open="isSearchOpen" @close="isSearchOpen = false" />
</template>
