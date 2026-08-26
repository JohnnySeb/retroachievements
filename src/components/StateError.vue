<script setup lang="ts">
defineProps<{ message: string }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="border border-magenta/40 bg-surface px-4 py-8 text-center">
    <p class="tag text-magenta">Error</p>
    <p class="mt-3 text-sm text-ink">{{ message }}</p>
    <button
      type="button"
      class="mt-4 min-h-11 border border-edge bg-raised px-4 font-display uppercase tracking-wider"
      @click="$emit('retry')"
    >
      Retry
    </button>
  </div>
</template>
