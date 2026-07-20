import { describe, it, expect } from 'vitest'
import { computeDonationBadges, computeDonationSummaryStats } from '../lib/donationStats'

function donation(overrides) {
  return {
    id: 1, donor_email: 'a@b.com', donor_name: 'Alice', payment_status: 'confirmed',
    amount: 100, created_at: '2025-01-01T00:00:00Z', receipt_issued: false,
    ...overrides,
  }
}

describe('computeDonationBadges', () => {
  it('flags a donor\'s very first confirmed gift as isFirstTime', () => {
    const { donationBadgeInfo } = computeDonationBadges([
      donation({ id: 1, created_at: '2025-01-01' }),
      donation({ id: 2, created_at: '2025-02-01' }),
    ])
    expect(donationBadgeInfo[1].isFirstTime).toBe(true)
    expect(donationBadgeInfo[2].isFirstTime).toBe(false)
  })

  it('ignores order in the input array — sorts by date internally', () => {
    // Second gift listed first in the array; badge logic must still use
    // chronological order, not array order.
    const { donationBadgeInfo } = computeDonationBadges([
      donation({ id: 2, created_at: '2025-02-01' }),
      donation({ id: 1, created_at: '2025-01-01' }),
    ])
    expect(donationBadgeInfo[1].isFirstTime).toBe(true)
    expect(donationBadgeInfo[2].isFirstTime).toBe(false)
  })

  it('flags isBiggestYet only when a later gift exceeds all prior gifts for that donor', () => {
    const { donationBadgeInfo } = computeDonationBadges([
      donation({ id: 1, created_at: '2025-01-01', amount: 50 }),
      donation({ id: 2, created_at: '2025-02-01', amount: 100 }),
      donation({ id: 3, created_at: '2025-03-01', amount: 80 }),
    ])
    // First gift never counts as "biggest yet" (nothing to beat)
    expect(donationBadgeInfo[1].isBiggestYet).toBe(false)
    expect(donationBadgeInfo[2].isBiggestYet).toBe(true)
    expect(donationBadgeInfo[3].isBiggestYet).toBe(false)
  })

  it('does not mix up donors — first-time status is per donor, not global', () => {
    const { donationBadgeInfo } = computeDonationBadges([
      donation({ id: 1, donor_email: 'a@b.com', created_at: '2025-01-01' }),
      donation({ id: 2, donor_email: 'c@d.com', created_at: '2025-01-02' }),
    ])
    expect(donationBadgeInfo[1].isFirstTime).toBe(true)
    expect(donationBadgeInfo[2].isFirstTime).toBe(true)
  })

  it('ignores unconfirmed donations entirely', () => {
    const { donationBadgeInfo } = computeDonationBadges([
      donation({ id: 1, payment_status: 'pending' }),
    ])
    expect(donationBadgeInfo[1]).toBeUndefined()
  })

  it('marks a donor major once their lifetime confirmed total crosses the threshold', () => {
    const { donorBadgeMap } = computeDonationBadges([
      donation({ id: 1, amount: 600 }),
      donation({ id: 2, amount: 500, created_at: '2025-02-01' }),
    ], { majorDonorThreshold: 1000 })
    expect(donorBadgeMap['a@b.com'].isMajorDonor).toBe(true)
  })

  it('marks isLoyal once a donor reaches the loyal-gift-count threshold', () => {
    const { donationBadgeInfo } = computeDonationBadges([
      donation({ id: 1, created_at: '2025-01-01' }),
      donation({ id: 2, created_at: '2025-02-01' }),
      donation({ id: 3, created_at: '2025-03-01' }),
    ], { loyalDonorThreshold: 3 })
    expect(donationBadgeInfo[1].isLoyal).toBe(false)
    expect(donationBadgeInfo[2].isLoyal).toBe(false)
    expect(donationBadgeInfo[3].isLoyal).toBe(true)
  })
})

describe('computeDonationSummaryStats', () => {
  const donations = [
    donation({ id: 1, amount: 100, created_at: '2024-06-01', receipt_issued: true }),
    donation({ id: 2, amount: 300, created_at: '2025-06-01', donor_name: 'Bob' }),
    donation({ id: 3, amount: 200, created_at: '2025-08-01', donor_name: 'Carol' }),
  ]

  it('counts receipts issued across all donations regardless of year filter', () => {
    const stats = computeDonationSummaryStats(donations, { filterYear: 'All', fyEndMonth: 12, fyEndDay: 31 })
    expect(stats.issuedCount).toBe(1)
  })

  it('computes the average from all donations, unaffected by the year filter', () => {
    const stats = computeDonationSummaryStats(donations, { filterYear: '2025', fyEndMonth: 12, fyEndDay: 31, totalAllTime: 600 })
    expect(stats.avgDonation).toBe(200) // 600 / 3, not scoped to 2025
  })

  it('scopes unique donors and median to the selected fiscal year', () => {
    const stats = computeDonationSummaryStats(donations, { filterYear: '2025', fyEndMonth: 12, fyEndDay: 31 })
    expect(stats.uniqueDonorsThisYear.sort()).toEqual(['Bob', 'Carol'])
    expect(stats.medianDonation).toBe(250) // median of [200, 300]
  })

  it('falls back to computing totalAllTime when not provided', () => {
    const stats = computeDonationSummaryStats(donations, { filterYear: 'All', fyEndMonth: 12, fyEndDay: 31 })
    expect(stats.avgDonation).toBe(200) // (100+300+200)/3
  })

  it('returns a median of 0 for an empty year-scoped set', () => {
    const stats = computeDonationSummaryStats(donations, { filterYear: '2099', fyEndMonth: 12, fyEndDay: 31 })
    expect(stats.medianDonation).toBe(0)
  })
})
