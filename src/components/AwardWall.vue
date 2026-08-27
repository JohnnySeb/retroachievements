<script setup lang="ts">
import { computed } from 'vue'

import { formatDate } from '@/lib/format'
import { mediaUrl } from '@/lib/media'
import type { PlayerAward } from '@/lib/types'

const props = defineProps<{ awards: PlayerAward[] }>()

// Ordre d'affichage des categories : du plus exigeant au plus anecdotique.
// Un type inconnu ne disparait pas, il passe simplement en fin de liste.
const TYPE_ORDER = ['Mastery/Completion', 'Game Beaten', 'Event']

const groups = computed(() => {
  const byType = new Map<string, PlayerAward[]>()
  for (const award of props.awards) {
    const bucket = byType.get(award.awardType)
    if (bucket) bucket.push(award)
    else byType.set(award.awardType, [award])
  }

  return [...byType.entries()]
    .map(([type, awards]) => ({ type, awards }))
    .sort((a, b) => {
      const left = TYPE_ORDER.indexOf(a.type)
      const right = TYPE_ORDER.indexOf(b.type)
      return (left === -1 ? TYPE_ORDER.length : left) - (right === -1 ? TYPE_ORDER.length : right)
    })
})

// La couleur suit le type d'award. Se fier au seul drapeau hardcore ferait passer
// un evenement ou une distinction de site pour du softcore.
function edgeClass(award: PlayerAward): string {
  if (award.gameId === null) return 'border-l-edge'
  if (award.awardType === 'Mastery/Completion') return 'border-l-magenta'
  if (award.awardType === 'Event') return 'border-l-cyan'
  return award.isHardcore ? 'border-l-phosphor' : 'border-l-amber'
}
</script>

<template>
  <div class="grid grid-cols-1 gap-6">
    <section v-for="group in groups" :key="group.type" data-award-group>
      <h3 class="flex items-center gap-3 text-muted">
        <span class="tag whitespace-nowrap">{{ group.type }}</span>
        <span class="num text-[11px]">{{ group.awards.length }}</span>
        <span aria-hidden="true" class="h-px flex-1 bg-edge" />
      </h3>

      <ul class="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-8">
        <li v-for="award in group.awards" :key="`${award.awardType}-${award.awardedAt}`">
          <component
            :is="award.gameId === null ? 'div' : 'RouterLink'"
            v-bind="
              award.gameId === null ? {} : { to: { name: 'game', params: { gameId: award.gameId } } }
            "
            class="block h-full border border-l-[3px] border-edge bg-surface p-2"
            :class="edgeClass(award)"
          >
            <img
              v-if="award.iconPath"
              :src="mediaUrl(award.iconPath)"
              :alt="`${award.awardType} — ${award.title}`"
              width="48"
              height="48"
              loading="lazy"
              class="is-pixel mx-auto size-12 border border-edge"
            />
            <span
              v-else
              aria-hidden="true"
              class="mx-auto grid size-12 place-items-center border border-edge bg-raised font-pixel text-[10px] text-muted"
            >
              RA
            </span>

            <p class="mt-2 line-clamp-2 text-center text-[11px] leading-tight">{{ award.title }}</p>
            <p class="num mt-1 text-center text-[10px] text-muted">
              {{ formatDate(award.awardedAt) }}
            </p>
          </component>
        </li>
      </ul>
    </section>
  </div>
</template>
