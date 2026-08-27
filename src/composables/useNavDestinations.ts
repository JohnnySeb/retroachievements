import { type ComputedRef, computed } from 'vue'
import { useRoute } from 'vue-router'

export interface NavDestination {
  name: 'home' | 'systems' | 'leaderboards'
  label: string
  icon: 'home' | 'systems' | 'ranks'
  isActive: boolean
}

// Une entree est active pour sa route et ses routes filles. On ne peut pas s'en
// remettre a `active-class` de router-link : sa correspondance est inclusive, et
// `/` etant prefixe de toutes les routes, Home resterait allume partout.
const ROUTE_NAMES: Record<NavDestination['name'], readonly string[]> = {
  home: ['home'],
  systems: ['systems', 'system-games'],
  leaderboards: ['leaderboards'],
}

export function useNavDestinations(): ComputedRef<NavDestination[]> {
  const route = useRoute()

  return computed(() => {
    const current = String(route.name ?? '')
    return [
      { name: 'home', label: 'Home', icon: 'home' },
      { name: 'systems', label: 'Systems', icon: 'systems' },
      { name: 'leaderboards', label: 'Ranks', icon: 'ranks' },
    ].map((entry) => ({
      ...entry,
      isActive: ROUTE_NAMES[entry.name as NavDestination['name']].includes(current),
    })) as NavDestination[]
  })
}
