<script setup lang="ts">
defineProps<{ tabs: Array<{ value: string; label: string }> }>()

const active = defineModel<string>({ required: true })
</script>

<template>
  <div role="tablist" class="-mx-4 flex gap-1 overflow-x-auto border-b border-edge px-4 md:mx-0 md:px-0">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      type="button"
      role="tab"
      :aria-selected="active === tab.value"
      class="min-h-11 shrink-0 whitespace-nowrap border-b-2 px-3 font-display text-sm uppercase tracking-wider"
      :class="active === tab.value ? 'border-phosphor text-ink' : 'border-transparent text-muted'"
      @click="active = tab.value"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
