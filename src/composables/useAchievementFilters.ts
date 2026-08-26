import { type Ref, computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { Achievement } from '@/lib/types'

export type AchievementFilter =
  | 'all'
  | 'unlocked'
  | 'locked'
  | 'progression'
  | 'win_condition'
  | 'missable'

export type AchievementSort = 'display' | 'points' | 'rarity' | 'earned'

export const ACHIEVEMENT_FILTERS: readonly AchievementFilter[] = [
  'all',
  'unlocked',
  'locked',
  'progression',
  'win_condition',
  'missable',
]

const SORTS: readonly AchievementSort[] = ['display', 'points', 'rarity', 'earned']

export function unlockState(achievement: Achievement): 'hardcore' | 'softcore' | 'locked' {
  if (achievement.dateEarnedHardcore) return 'hardcore'
  if (achievement.dateEarned) return 'softcore'
  return 'locked'
}

function matches(achievement: Achievement, filter: AchievementFilter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'unlocked':
      return unlockState(achievement) !== 'locked'
    case 'locked':
      return unlockState(achievement) === 'locked'
    default:
      return achievement.type === filter
  }
}

export function useAchievementFilters(source: Ref<Achievement[]>) {
  const route = useRoute()
  const router = useRouter()

  const initialFilter = String(route.query.filter ?? '') as AchievementFilter
  const initialSort = String(route.query.sort ?? '') as AchievementSort

  const filter = ref<AchievementFilter>(
    ACHIEVEMENT_FILTERS.includes(initialFilter) ? initialFilter : 'all',
  )
  const sort = ref<AchievementSort>(SORTS.includes(initialSort) ? initialSort : 'display')

  // Les filtres vivent dans l'URL pour qu'une vue filtree soit partageable.
  watch([filter, sort], () => {
    void router.replace({
      query: {
        ...route.query,
        filter: filter.value === 'all' ? undefined : filter.value,
        sort: sort.value === 'display' ? undefined : sort.value,
      },
    })
  })

  const visible = computed(() => {
    const kept = source.value.filter((achievement) => matches(achievement, filter.value))

    switch (sort.value) {
      case 'points':
        return kept.sort((a, b) => b.points - a.points || a.displayOrder - b.displayOrder)
      case 'rarity':
        return kept.sort((a, b) => a.unlockRate - b.unlockRate || a.displayOrder - b.displayOrder)
      case 'earned':
        return kept.sort((a, b) => {
          const left = a.dateEarnedHardcore ?? a.dateEarned
          const right = b.dateEarnedHardcore ?? b.dateEarned
          if (left && right) return right.localeCompare(left)
          if (left) return -1
          if (right) return 1
          return a.displayOrder - b.displayOrder
        })
      default:
        return kept.sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id)
    }
  })

  const counts = computed(() => {
    const result = Object.fromEntries(ACHIEVEMENT_FILTERS.map((key) => [key, 0])) as Record<
      AchievementFilter,
      number
    >
    for (const achievement of source.value) {
      for (const key of ACHIEVEMENT_FILTERS) {
        if (matches(achievement, key)) result[key] += 1
      }
    }
    return result
  })

  return { filter, sort, visible, counts }
}
