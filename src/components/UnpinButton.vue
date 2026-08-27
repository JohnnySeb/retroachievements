<script setup lang="ts">
import { nextTick, ref } from 'vue'

defineProps<{ username: string }>()
const emit = defineEmits<{ confirm: [] }>()

const isArmed = ref(false)
const confirmButton = ref<HTMLButtonElement | null>(null)

async function arm(): Promise<void> {
  isArmed.value = true
  // Le focus suit l'action : sans cela, le clavier resterait sur un bouton disparu.
  await nextTick()
  confirmButton.value?.focus()
}

function confirm(): void {
  isArmed.value = false
  emit('confirm')
}
</script>

<template>
  <div
    v-if="isArmed"
    data-confirm-prompt
    class="flex flex-col gap-2 border border-magenta bg-magenta/10 p-2 sm:flex-row sm:items-center"
    @keydown.escape="isArmed = false"
  >
    <p class="px-1 text-xs text-ink">
      Unpin <b class="font-semibold">{{ username }}</b
      >? Your progress will stop showing on game pages.
    </p>
    <div class="flex gap-2 sm:ml-auto">
      <button
        ref="confirmButton"
        type="button"
        data-unpin-confirm
        class="min-h-11 flex-1 border border-magenta bg-magenta px-3 font-display uppercase tracking-wider text-bg sm:flex-none"
        @click="confirm"
      >
        Unpin
      </button>
      <button
        type="button"
        data-unpin-cancel
        class="min-h-11 flex-1 border border-edge bg-raised px-3 font-display uppercase tracking-wider text-muted sm:flex-none"
        @click="isArmed = false"
      >
        Cancel
      </button>
    </div>
  </div>

  <button
    v-else
    type="button"
    data-unpin
    class="min-h-11 border border-edge bg-raised px-3 font-display uppercase tracking-wider text-muted transition-colors hover:border-magenta hover:text-magenta"
    @click="arm()"
  >
    Unpin
  </button>
</template>
