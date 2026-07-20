// Phase 0/1 of REFACTOR_PLAN.md: tests for the pure, non-JSX logic that used
// to live inline in App.jsx and has since been extracted to src/lib/. As
// predicted when these tests were written, only the import paths changed —
// the assertions below are untouched, which is exactly what let this move be
// verified mechanically instead of by eye.
import { describe, it, expect } from 'vitest'
import { donationDonorKey, contactDonorKey } from '../lib/donorKeys'
import { isoWeekKey, fiscalYearOf, fiscalYearBounds } from '../lib/fiscalYear'
import { fillTemplate } from '../lib/format'
import { colorForDonor } from '../lib/color'

describe('donationDonorKey', () => {
  it('prefers email over NRIC and name', () => {
    expect(donationDonorKey({ donor_email: 'a@b.com', donor_nric: 'S1234567A', donor_name: 'Alice' })).toBe('a@b.com')
  })

  it('trims whitespace off the email', () => {
    expect(donationDonorKey({ donor_email: '  a@b.com  ', donor_name: 'Alice' })).toBe('a@b.com')
  })

  it('falls back to NRIC when email is missing', () => {
    expect(donationDonorKey({ donor_email: null, donor_nric: 'S1234567A', donor_name: 'Alice' })).toBe('S1234567A')
  })

  it('falls back to NRIC when email is blank/whitespace-only', () => {
    expect(donationDonorKey({ donor_email: '   ', donor_nric: 'S1234567A', donor_name: 'Alice' })).toBe('S1234567A')
  })

  it('falls back to name when both email and NRIC are missing', () => {
    expect(donationDonorKey({ donor_email: null, donor_nric: null, donor_name: 'Alice' })).toBe('Alice')
  })
})

describe('contactDonorKey', () => {
  it('prefers email, then NRIC, then full_name, then name', () => {
    expect(contactDonorKey({ email: 'a@b.com', nric: 'S1234567A', full_name: 'Alice Tan', name: 'Alice' })).toBe('a@b.com')
    expect(contactDonorKey({ email: null, nric: 'S1234567A', full_name: 'Alice Tan', name: 'Alice' })).toBe('S1234567A')
    expect(contactDonorKey({ email: null, nric: null, full_name: 'Alice Tan', name: 'Alice' })).toBe('Alice Tan')
    expect(contactDonorKey({ email: null, nric: null, full_name: null, name: 'Alice' })).toBe('Alice')
  })

  it('produces the same key as donationDonorKey for the same person', () => {
    // These two helpers exist because donations and contact records use different
    // field names for the same underlying identity. They must agree, or donor
    // matching (e.g. Dashboard "Worth Knowing" jumps) silently breaks.
    const donation = { donor_email: 'a@b.com', donor_nric: 'S1234567A', donor_name: 'Alice' }
    const contact = { email: 'a@b.com', nric: 'S1234567A', full_name: 'Alice' }
    expect(donationDonorKey(donation)).toBe(contactDonorKey(contact))
  })
})

describe('isoWeekKey', () => {
  // Reference dates from the ISO 8601 Wikipedia examples table — standard,
  // independently-verifiable test vectors for ISO week date math.
  it('matches known ISO 8601 reference dates', () => {
    expect(isoWeekKey('2005-01-01')).toBe('2004-W53')
    expect(isoWeekKey('2007-01-01')).toBe('2007-W01')
    expect(isoWeekKey('2010-01-03')).toBe('2009-W53')
  })

  it('gives every day in the same Mon-Sun week the same key', () => {
    // Mon 2024-01-08 through Sun 2024-01-14
    const days = ['2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-12', '2024-01-13', '2024-01-14']
    const keys = new Set(days.map(isoWeekKey))
    expect(keys.size).toBe(1)
    expect([...keys][0]).toBe('2024-W02')
  })
})

describe('fiscalYearOf', () => {
  it('collapses to the calendar year when FY ends Dec 31', () => {
    expect(fiscalYearOf('2025-06-15', 12, 31)).toBe(2025)
    expect(fiscalYearOf('2025-12-31', 12, 31)).toBe(2025)
    expect(fiscalYearOf('2026-01-01', 12, 31)).toBe(2026)
  })

  it('labels a non-calendar FY by the year it ends in', () => {
    // FY ending 31 Mar: FY2026 runs 1 Apr 2025 - 31 Mar 2026
    expect(fiscalYearOf('2025-04-01', 3, 31)).toBe(2026)
    expect(fiscalYearOf('2026-03-31', 3, 31)).toBe(2026)
    expect(fiscalYearOf('2026-04-01', 3, 31)).toBe(2027)
    expect(fiscalYearOf('2025-03-31', 3, 31)).toBe(2025)
  })
})

// fiscalYearBounds returns Date objects constructed in local time (new Date(y, m, d, ...)),
// so comparisons must read local components — .toISOString() converts to UTC first and
// shifts the date by the local UTC offset, which is a test-authoring trap, not a bug.
function localDateString(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('fiscalYearBounds', () => {
  it('returns the correct start/end for a non-calendar FY', () => {
    const { start, end } = fiscalYearBounds(2026, 3, 31)
    expect(localDateString(end)).toBe('2026-03-31')
    expect(localDateString(start)).toBe('2025-04-01')
  })

  it('round-trips with fiscalYearOf: every day in the bounds maps back to the same FY label', () => {
    const { start, end } = fiscalYearBounds(2026, 3, 31)
    expect(fiscalYearOf(start, 3, 31)).toBe(2026)
    expect(fiscalYearOf(end, 3, 31)).toBe(2026)
  })
})

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

describe('colorForDonor', () => {
  const palette = ['#111', '#222', '#333', '#444']

  it('is deterministic for the same input', () => {
    expect(colorForDonor('alice@example.com', palette)).toBe(colorForDonor('alice@example.com', palette))
  })

  it('is case- and whitespace-insensitive', () => {
    expect(colorForDonor('Alice@Example.com', palette)).toBe(colorForDonor('  alice@example.com  ', palette))
  })

  it('always returns a color from the given palette', () => {
    for (const input of ['a', 'bb', 'ccc', '', null, 'Zebra Charity Fund']) {
      expect(palette).toContain(colorForDonor(input, palette))
    }
  })
})
