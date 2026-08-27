import { describe, expect, it } from 'vitest'

import { glowFor } from './useProximityGlow'

const RECT = { left: 100, top: 100, right: 200, bottom: 200 } as DOMRect

describe('glowFor', () => {
  it('is full inside the card', () => {
    expect(glowFor(RECT, 150, 150, 200)).toBe(1)
    expect(glowFor(RECT, 100, 200, 200)).toBe(1)
  })

  it('falls off with distance', () => {
    const near = glowFor(RECT, 240, 150, 200)
    const far = glowFor(RECT, 340, 150, 200)

    expect(near).toBeGreaterThan(far)
    expect(near).toBeLessThan(1)
  })

  it('is zero beyond the radius', () => {
    expect(glowFor(RECT, 500, 500, 200)).toBe(0)
  })

  it('measures distance to the nearest edge, not the centre', () => {
    // Un point aligne sur le bord droit est aussi proche qu'un point aligne en bas,
    // a distance egale : la carte ne doit pas s'allumer plus d'un cote que de l'autre.
    expect(glowFor(RECT, 250, 150, 200)).toBeCloseTo(glowFor(RECT, 150, 250, 200), 5)
  })

  it('never returns a value outside 0..1', () => {
    for (const [x, y] of [[-500, -500], [0, 150], [1000, 1000], [150, 150]]) {
      const glow = glowFor(RECT, x!, y!, 200)
      expect(glow).toBeGreaterThanOrEqual(0)
      expect(glow).toBeLessThanOrEqual(1)
    }
  })
})
