import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import UnlockDistribution from './UnlockDistribution.vue'

const BUCKETS = [
  { count: 1, players: 141 },
  { count: 2, players: 51 },
  { count: 3, players: 282 },
]

describe('UnlockDistribution', () => {
  it('renders one bar per bucket', () => {
    expect(mount(UnlockDistribution, { props: { buckets: BUCKETS } }).findAll('[data-bucket]')).toHaveLength(3)
  })

  it('scales the tallest bar to 100 percent', () => {
    const bars = mount(UnlockDistribution, { props: { buckets: BUCKETS } }).findAll('[data-bucket] span')

    expect(bars[2]!.attributes('style')).toContain('height: 100%')
  })

  it('scrolls horizontally instead of overflowing', () => {
    const wrapper = mount(UnlockDistribution, { props: { buckets: BUCKETS } })

    expect(wrapper.get('[data-scroll-container]').classes()).toContain('overflow-x-auto')
  })

  it('describes each bar for screen readers', () => {
    const bars = mount(UnlockDistribution, { props: { buckets: BUCKETS } }).findAll('[data-bucket]')

    expect(bars[0]!.attributes('aria-label')).toBe('141 players unlocked 1 achievement')
    expect(bars[1]!.attributes('aria-label')).toBe('51 players unlocked 2 achievements')
  })

  it('tolerates an empty distribution', () => {
    expect(mount(UnlockDistribution, { props: { buckets: [] } }).findAll('[data-bucket]')).toHaveLength(0)
  })
})
