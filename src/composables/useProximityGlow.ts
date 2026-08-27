import { type Ref, onBeforeUnmount, watch } from 'vue'

const RADIUS = 220

/** Intensite 0..1 selon la distance du curseur au bord le plus proche de la carte. */
export function glowFor(rect: DOMRect, x: number, y: number, radius = RADIUS): number {
  const dx = Math.max(rect.left - x, 0, x - rect.right)
  const dy = Math.max(rect.top - y, 0, y - rect.bottom)
  const distance = Math.hypot(dx, dy)
  if (distance >= radius) return 0
  const linear = 1 - distance / radius
  // Mise au carre : la lueur reste serree autour du curseur au lieu de baigner la grille.
  return linear * linear
}

export function useProximityGlow(container: Ref<HTMLElement | null>): void {
  let frame = 0
  let cards: HTMLElement[] = []
  let observer: MutationObserver | null = null
  let attached: HTMLElement | null = null

  function collect(): void {
    cards = Array.from(attached?.querySelectorAll<HTMLElement>('[data-glow]') ?? [])
  }

  function onPointerMove(event: PointerEvent): void {
    if (frame) return
    const { clientX, clientY } = event
    frame = requestAnimationFrame(() => {
      frame = 0
      // Les rects sont relus a chaque frame : ils suivent ainsi le defilement.
      for (const card of cards) {
        card.style.setProperty('--glow', String(glowFor(card.getBoundingClientRect(), clientX, clientY)))
      }
    })
  }

  function onPointerLeave(): void {
    for (const card of cards) card.style.setProperty('--glow', '0')
  }

  function detach(): void {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    observer?.disconnect()
    observer = null
    window.removeEventListener('pointermove', onPointerMove)
    attached?.removeEventListener('pointerleave', onPointerLeave)
    attached = null
    cards = []
  }

  // Le conteneur apparait souvent apres le chargement des donnees, derriere un v-if :
  // s'accrocher au montage laisserait la liste de cartes vide.
  watch(
    container,
    (element) => {
      detach()
      if (!element) return

      const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches
      const wantsMotion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!canHover || !wantsMotion) return

      attached = element
      collect()
      observer = new MutationObserver(collect)
      observer.observe(element, { childList: true, subtree: true })
      window.addEventListener('pointermove', onPointerMove, { passive: true })
      element.addEventListener('pointerleave', onPointerLeave)
    },
    { immediate: true, flush: 'post' },
  )

  onBeforeUnmount(detach)
}
