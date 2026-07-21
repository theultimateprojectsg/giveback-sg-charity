import { donationDonorKey } from './donorKeys'
import { fiscalYearOf } from './fiscalYear'
import type { Donation, DonationBadgeInfo, DonorBadgeMap } from '../types'

interface BadgeOptions {
  thankYouThreshold?: number
  majorDonorThreshold?: number
  loyalDonorThreshold?: number
}

// Per-donation and per-donor badges (first gift, biggest gift yet, loyal, major
// donor, big gift) computed from confirmed donations in chronological order.
// Used to decorate the donations table and drive Dashboard milestone alerts.
export function computeDonationBadges(donations: Donation[], { thankYouThreshold = Infinity, majorDonorThreshold = 1000, loyalDonorThreshold = 3 }: BadgeOptions = {}): { donationBadgeInfo: DonationBadgeInfo, donorBadgeMap: DonorBadgeMap } {
  const confirmedOnly = donations.filter(d => d.payment_status === 'confirmed')
  const donorFirstDonationId: Record<string, string> = {}
  const donationBadgeInfo: DonationBadgeInfo = {}
  const donorRunningTotals: Record<string, { count: number, maxAmount: number, total: number }> = {}
  ;[...confirmedOnly].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).forEach(d => {
    const key = donationDonorKey(d) as string
    if (!donorFirstDonationId[key]) donorFirstDonationId[key] = d.id
    if (!donorRunningTotals[key]) donorRunningTotals[key] = { count: 0, maxAmount: 0, total: 0 }
    donorRunningTotals[key].count += 1
    donorRunningTotals[key].total += d.amount
    const isBiggestYet = d.amount > donorRunningTotals[key].maxAmount
    if (d.amount > donorRunningTotals[key].maxAmount) donorRunningTotals[key].maxAmount = d.amount
    donationBadgeInfo[d.id] = {
      isFirstTime: donorFirstDonationId[key] === d.id,
      isBigGift: d.amount >= thankYouThreshold,
      isLoyal: donorRunningTotals[key].count >= loyalDonorThreshold,
      isBiggestYet: isBiggestYet && donorRunningTotals[key].count > 1,
    }
  })
  const donorBadgeMap: DonorBadgeMap = {}
  confirmedOnly.forEach(d => {
    const key = donationDonorKey(d) as string
    const b = donationBadgeInfo[d.id]
    if (!donorBadgeMap[key]) donorBadgeMap[key] = { isFirstTime: false, isBigGift: false, isLoyal: false, isBiggestYet: false, isMajorDonor: false, mostRecent: d.created_at }
    if (b.isFirstTime) donorBadgeMap[key].isFirstTime = true
    if (b.isBigGift) donorBadgeMap[key].isBigGift = true
    if (b.isLoyal) donorBadgeMap[key].isLoyal = true
    if (b.isBiggestYet) donorBadgeMap[key].isBiggestYet = true
    if (new Date(d.created_at) > new Date(donorBadgeMap[key].mostRecent)) donorBadgeMap[key].mostRecent = d.created_at
  })
  Object.keys(donorBadgeMap).forEach(key => {
    donorBadgeMap[key].isMajorDonor = donorRunningTotals[key].total >= (majorDonorThreshold || 1000)
  })
  return { donationBadgeInfo, donorBadgeMap }
}

interface SummaryStatsOptions {
  filterYear?: string
  fyEndMonth: number
  fyEndDay: number
  totalAllTime?: number
}

// Headline summary stats (receipts issued, unique donors, average/median gift)
// for the Reports/Dashboard tabs, optionally scoped to one fiscal year.
export function computeDonationSummaryStats(donations: Donation[], { filterYear = 'All', fyEndMonth, fyEndDay, totalAllTime }: SummaryStatsOptions) {
  const yearScoped = filterYear === 'All' ? donations : donations.filter(d => fiscalYearOf(d.created_at, fyEndMonth, fyEndDay) === parseInt(filterYear))

  const issuedCount = donations.filter(d => d.receipt_issued).length
  const uniqueDonors = [...new Set(donations.map(d => d.donor_name))]
  const uniqueDonorsThisYear = [...new Set(yearScoped.map(d => d.donor_name))]
  const avgDonation = donations.length ? ((totalAllTime ?? donations.reduce((s, d) => s + d.amount, 0)) / donations.length) : 0

  const amounts = yearScoped.map(d => d.amount).sort((a, b) => a - b)
  let medianDonation = 0
  if (amounts.length > 0) {
    const mid = Math.floor(amounts.length / 2)
    medianDonation = amounts.length % 2 === 0 ? (amounts[mid - 1] + amounts[mid]) / 2 : amounts[mid]
  }

  return { issuedCount, uniqueDonors, uniqueDonorsThisYear, avgDonation, medianDonation }
}
