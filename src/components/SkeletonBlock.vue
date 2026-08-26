<script setup lang="ts">
defineProps<{ height: string; width?: string }>()
</script>

<template>
  <div aria-hidden="true" class="animate-pulse bg-raised" :style="{ height, width: width ?? '100%' }" />
</template>
