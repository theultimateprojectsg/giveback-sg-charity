import { describe, it, expect } from 'vitest'
import { fillTemplate, formatDate, formatNumber, formatCurrency } from '../lib/format'

describe('fillTemplate', () => {
  it('substitutes {{var}} placeholders', () => {
    expect(fillTemplate('Hi {{name}}, thanks for ${{amount}}', { name: 'Alice', amount: '100' }))
      .toBe('Hi Alice, thanks for $100')
  })

  it('replaces a missing variable with an empty string', () => {
    expect(fillTemplate('Hi {{name}}', {})).toBe('Hi ')
  })

  it('passes through null/undefined input unchanged', () => {
    expect(fillTemplate(null, { name: 'Alice' })).toBe(null)
    expect(fillTemplate(undefined, { name: 'Alice' })).toBe(undefined)
  })
})

describe('formatDate', () => {
  const d = '2025-06-01T00:00:00'

  it('defaults to the "short" preset (day + short month + year)', () => {
    expect(formatDate(d)).toBe('1 Jun 2025')
  })

  it('supports every named preset', () => {
    expect(formatDate(d, 'short')).toBe('1 Jun 2025')
    expect(formatDate(d, 'long')).toBe('1 June 2025')
    expect(formatDate(d, 'shortNoYear')).toBe('1 Jun')
    expect(formatDate(d, 'longNoYear')).toBe('1 June')
    expect(formatDate(d, 'monthShort')).toBe('Jun')
    expect(formatDate(d, 'monthLong')).toBe('June')
    expect(formatDate(d, 'monthYearShort')).toBe('Jun 2025')
    expect(formatDate(d, 'monthYearLong')).toBe('June 2025')
    expect(formatDate(d, 'year')).toBe('2025')
    expect(formatDate(d, 'numeric')).toBe('01/06/2025')
  })

  it('returns an empty string for null/undefined instead of "Invalid Date"', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate(undefined)).toBe('')
  })

  it('throws on an unknown preset name rather than silently falling back', () => {
    // A typo'd style name should fail loudly at the call site, not render "Invalid Date"
    // or silently drop the year — this guards against exactly that kind of bug.
    expect(() => formatDate(d, 'not-a-real-style')).toThrow()
  })
})

describe('formatNumber', () => {
  it('adds thousands separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
  })

  it('treats null/undefined as 0', () => {
    expect(formatNumber(null)).toBe('0')
    expect(formatNumber(undefined)).toBe('0')
  })

  it('coerces numeric strings (as amounts often arrive from Postgres/forms)', () => {
    expect(formatNumber('2500')).toBe('2,500')
  })
})

describe('formatCurrency', () => {
  it('prefixes a dollar sign and adds thousands separators', () => {
    expect(formatCurrency(2500)).toBe('$2,500')
  })

  it('treats null/undefined as $0, not "$" or "$NaN"', () => {
    expect(formatCurrency(null)).toBe('$0')
    expect(formatCurrency(undefined)).toBe('$0')
  })
})
