<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import StateEmpty from '@/components/StateEmpty.vue'
import { useApi } from '@/composables/useApi'
import { useDebouncedRef } from '@/composables/useDebouncedRef'
import { formatNumber } from '@/lib/format'
import { mediaUrl } from '@/lib/media'
import type { SearchResults } from '@/lib/types'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const query = ref('')
const debouncedQuery = useDebouncedRef(query, 200)
const input = ref<HTMLInputElement | null>(null)
const dialog = ref<HTMLElement | null>(null)

const trimmedQuery = computed(() => debouncedQuery.value.trim())

const { data, error, pending } = useApi<SearchResults>(() =>
  props.open && trimmedQuery.value.length >= 2
    ? `/api/search?q=${encodeURIComponent(trimmedQuery.value)}`
    : null,
)

const hasResults = computed(
  () =>
    (data.value?.games.length ?? 0) > 0 ||
    (data.value?.systems.length ?? 0) > 0 ||
    data.value?.player != null,
)

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    await nextTick()
    input.value?.focus()
  },
  { immediate: true },
)

function close(): void {
  query.value = ''
  emit('close')
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled])'

// Sans piege, la tabulation sort de la superposition et laisse le focus sur la page masquee.
function onTab(event: KeyboardEvent): void {
  const targets = Array.from(dialog.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
  if (!targets.length) return

  const first = targets[0]!
  const last = targets[targets.length - 1]!
  const active = document.activeElement

  if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}
</script>

<template>
  <div
    v-if="open"
    ref="dialog"
    data-search-dialog
    role="dialog"
    aria-modal="true"
    aria-label="Search"
    class="fixed inset-0 z-50 flex flex-col bg-bg md:justify-start md:bg-bg/80 md:p-8 md:backdrop-blur"
    @keydown.escape="close"
    @keydown.tab="onTab"
  >
    <div
      class="flex min-h-0 flex-1 flex-col overflow-hidden border-edge bg-surface md:mx-auto md:max-h-[70vh] md:w-full md:max-w-2xl md:flex-none md:border md:shadow-[6px_6px_0_rgba(0,0,0,.5)]"
    >
      <div class="flex shrink-0 items-center gap-3 border-b border-edge px-4 py-2">
        <span aria-hidden="true" class="num text-phosphor">&gt;</span>
        <input
          ref="input"
          v-model="query"
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls="search-results"
          placeholder="Game, player, system…"
          class="min-h-11 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted"
        />
        <button type="button" class="tag min-h-11 shrink-0 px-2 text-muted" @click="close">
          Close
        </button>
      </div>

      <div id="search-results" class="min-h-0 flex-1 overflow-y-auto">
        <p v-if="pending" class="px-4 py-6 text-sm text-muted">Searching…</p>

        <StateEmpty
          v-else-if="error?.indexing"
          class="m-4"
          title="Search index not built"
          hint="Run npm run warm to build the game search index."
        />

        <StateEmpty v-else-if="error" class="m-4" :title="error.message" />

        <template v-else-if="data && hasResults">
          <section v-if="data.player" class="border-b border-edge py-2">
            <p class="tag px-4 pb-2 text-muted">Player — exact username</p>
            <RouterLink
              :to="{ name: 'player', params: { username: data.player.user } }"
              class="flex min-h-11 items-center gap-3 px-4 py-2 hover:bg-raised"
              @click="close"
            >
              <img
                :src="mediaUrl(data.player.avatarPath)"
                alt=""
                width="32"
                height="32"
                class="is-pixel size-8 shrink-0 border border-edge"
              />
              <span class="min-w-0">
                <span class="block truncate text-sm">{{ data.player.user }}</span>
                <span class="num block text-xs text-muted">
                  {{ formatNumber(data.player.totalTruePoints) }} true points
                </span>
              </span>
              <span class="num ml-auto shrink-0 text-xs text-muted">
                {{ formatNumber(data.player.totalPoints) }} pts
              </span>
            </RouterLink>
          </section>

          <section v-if="data.games.length" class="py-2">
            <p class="tag px-4 pb-2 text-muted">Games</p>
            <RouterLink
              v-for="game in data.games"
              :key="game.id"
              :to="{ name: 'game', params: { gameId: game.id } }"
              class="flex min-h-11 items-center gap-3 px-4 py-2 hover:bg-raised"
              @click="close"
            >
              <img
                :src="mediaUrl(game.iconPath)"
                alt=""
                width="32"
                height="32"
                loading="lazy"
                class="is-pixel size-8 shrink-0 border border-edge"
              />
              <span class="min-w-0">
                <span class="block truncate text-sm">{{ game.title }}</span>
                <span class="block truncate text-xs text-muted">{{ game.systemName }}</span>
              </span>
              <span class="num ml-auto shrink-0 text-xs text-muted">
                {{ game.numAchievements }} ach
              </span>
            </RouterLink>
          </section>

          <section v-if="data.systems.length" class="border-t border-edge py-2">
            <p class="tag px-4 pb-2 text-muted">Systems</p>
            <RouterLink
              v-for="system in data.systems"
              :key="system.id"
              :to="{ name: 'system-games', params: { systemId: system.id } }"
              class="flex min-h-11 items-center px-4 py-2 text-sm hover:bg-raised"
              @click="close"
            >
              {{ system.name }}
            </RouterLink>
          </section>
        </template>

        <StateEmpty
          v-else-if="trimmedQuery.length >= 2"
          class="m-4"
          title="No results"
          hint="Player search needs the exact username — the RetroAchievements API offers no fuzzy user search."
        />

        <p v-else class="px-4 py-6 text-sm text-muted">Type at least two characters.</p>
      </div>
    </div>
  </div>
</template>
