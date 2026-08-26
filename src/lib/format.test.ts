import { describe, expect, it } from 'vitest'

import { formatDate, formatNumber, formatPercent } from './format'

describe('formatNumber', () => {
  it('groups thousands', () => {
    expect(formatNumber(491867)).toBe('491,867')
  })

  it('leaves three-digit numbers untouched', () => {
    expect(formatNumber(300)).toBe('300')
  })
})

describe('formatPercent', () => {
  it('rounds to one decimal by default', () => {
    expect(formatPercent(10.3412)).toBe('10.3%')
  })

  it('honours the requested precision', () => {
    expect(formatPercent(3.8149, 2)).toBe('3.81%')
  })
})

describe('formatDate', () => {
  it('formats an ISO date in English', () => {
    expect(formatDate('1991-06-11')).toBe('June 11, 1991')
  })

  it('returns a dash when the date is missing', () => {
    expect(formatDate(null)).toBe('—')
  })

  it('returns a dash for an unparseable value', () => {
    expect(formatDate('not-a-date')).toBe('—')
  })
})
