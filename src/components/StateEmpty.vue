<script setup lang="ts">
defineProps<{ title: string; hint?: string }>()
</script>

<template>
  <div class="border border-edge bg-surface px-4 py-10 text-center">
    <p class="font-display text-xl uppercase tracking-wide">{{ title }}</p>
    <p v-if="hint" class="mx-auto mt-2 max-w-prose text-sm text-muted">{{ hint }}</p>
  </div>
</template>
