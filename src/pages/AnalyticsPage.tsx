import type { Dispatch, SetStateAction, ReactNode } from 'react'
import { useState, useEffect, useRef, isValidElement, cloneElement } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import { supabase } from '../supabase'
import { C } from '../theme'
import { s } from '../styles'
import { InfoTip } from '../components/ui/InfoTip'
import { ActionBanner } from '../components/ui/ActionBanner'
import { fiscalYearBounds } from '../lib/fiscalYear'

function CustomCheckbox({ checked, onChange }: { checked: boolean, onChange: () => void }) {
  return (
    <span
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={onChange}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange() } }}
      style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 2, cursor: 'pointer',
        border: `1.5px solid ${checked ? C.forest : C.border}`, background: checked ? C.forest : C.white,
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s, border-color 0.1s',
      }}
    >
      {checked && <span style={{ color: C.white, fontSize: 11, lineHeight: 1, fontWeight: 700 }}>✓</span>}
    </span>
  )
}

function CustomizeSectionButton({ sectionId, cards, hiddenDashboardCards, toggleDashboardCard, resetDashboardSection, setConfirmModal }: { sectionId: string, cards: { key: string, label: string }[], hiddenDashboardCards: string[], toggleDashboardCard: (cardKey: string) => void, resetDashboardSection: (sectionId: string, cardKeys: string[]) => void, setConfirmModal: (v: any) => void }) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])
  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button
        style={{ background: 'rgba(255,255,255,0.14)', border: 'none', borderRadius: 100, padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: 4 }}
        onClick={() => setOpen(v => !v)}
      >⚙ Customize</button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 6, zIndex: 20, background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, padding: 12, width: 280, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Show in this section</div>
          {cards.map(c => (
            <label key={c.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', fontSize: 12.5, color: C.text, cursor: 'pointer' }}>
              <CustomCheckbox checked={!hiddenDashboardCards.includes(c.key)} onChange={() => toggleDashboardCard(c.key)} />
              <span>{c.label}</span>
            </label>
          ))}
          <button
            style={{ marginTop: 8, paddingTop: 10, borderWidth: '1px 0 0 0', borderStyle: 'solid', borderColor: C.ivoryDark, width: '100%', textAlign: 'left', background: 'none', cursor: 'pointer', fontSize: 11.5, color: C.muted, textDecoration: 'underline' }}
            onClick={() => setConfirmModal({
              title: 'Reset this section to default?',
              description: 'Any cards you\'ve hidden or reordered here will go back to how they started.',
              confirmLabel: 'Reset',
              onConfirm: () => { resetDashboardSection(sectionId, cards.map(c => c.key)); setOpen(false) },
            })}
          >↺ Reset to default</button>
        </div>
      )}
    </div>
  )
}

function getCardOrderIndex(dashboardCardOrder: Record<string, string[]>, sectionId: string, defaultOrder: string[], cardKey: string) {
  const saved = dashboardCardOrder[sectionId]
  const list = saved && saved.length ? saved : defaultOrder
  const idx = list.indexOf(cardKey)
  return idx === -1 ? defaultOrder.indexOf(cardKey) : idx
}

function AdjustInSettingsLink({ setActiveTab, setSettingsSection }: { setActiveTab: (tab: string) => void, setSettingsSection: (section: string) => void }) {
  return (
    <span
      style={{ fontSize: 10.5, color: C.sage, fontWeight: 500, cursor: 'pointer' }}
      onClick={() => { setActiveTab('settings'); setSettingsSection('thresholds'); setTimeout(() => document.getElementById('dashboard-alert-sensitivity-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50) }}
    >Adjust in Settings →</span>
  )
}

function DraggableCard({ sectionId, cardKey, order, flexBasis, defaultOrder, dashboardCardOrder, reorderDashboardCard, children }: {
  sectionId: string
  cardKey: string
  order: number
  flexBasis: string
  defaultOrder: string[]
  dashboardCardOrder: Record<string, string[]>
  reorderDashboardCard: (sectionId: string, defaultOrder: string[], draggedKey: string, targetKey: string) => void
  children: ReactNode
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const existingStyle = isValidElement(children) ? ((children.props as any).style || {}) : {}
  const hasOwnLayout = !!existingStyle.display
  const styledChild = isValidElement(children)
    ? cloneElement(children as React.ReactElement<any>, {
        style: {
          ...existingStyle,
          flex: 1,
          height: '100%',
          boxSizing: 'border-box',
          ...(hasOwnLayout ? {} : { display: 'flex', flexDirection: 'column', justifyContent: 'center' }),
        },
      })
    : children
  return (
    <div
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
      onDragEnter={() => setIsDragOver(true)}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={e => {
        e.preventDefault()
        setIsDragOver(false)
        const draggedKey = e.dataTransfer.getData('text/plain')
        if (draggedKey && draggedKey !== cardKey) reorderDashboardCard(sectionId, defaultOrder, draggedKey, cardKey)
      }}
      style={{ order, flex: `1 1 ${flexBasis}`, minWidth: 0, display: 'flex', position: 'relative', outline: isDragOver ? `2px dashed ${C.forest}` : 'none', outlineOffset: 2, borderRadius: 6 }}
    >
      <span
        draggable
        onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', cardKey) }}
        style={{ position: 'absolute', top: 6, right: 8, fontSize: 14, color: C.border, letterSpacing: -1, zIndex: 1, userSelect: 'none', cursor: 'grab', padding: 4 }}
        title="Drag to reorder"
      >⠿</span>
      {styledChild}
    </div>
  )
}

interface AnalyticsPageProps {
  ANALYTICS_NAV_OFFSET: number
  acquisitionSourceStats: any
  activeAnalyticsSection: string
  aiWeekSummary: any
  confirmedDonations: any[]
  grants: any[]
  massAppeals: any
  pledges: any[]
  thisMonthTotal: number
  aiWeekSummaryError: any
  aiWeekSummaryLoading: any
  allGivingChangeFlags: any
  analyticsGoalStats: any
  annualGoal: number
  appealConversionStats: any
  appealListHealthStats: any
  appealListStrip: any
  appealSnapshotStats: any
  appealTrendStats: any
  campaignGoalStrip: any
  campaignLeaderboardStats: any
  campaignSnapshotStats: any
  causeRaisedMap: any
  charityIsIpc: boolean
  charityName: string | undefined
  charityUen: string | undefined
  clearDonationFilters: (opts?: any) => void
  concentrationTopN: number
  customObligations: any
  customTasks: any
  dashboardActionItemsData: any
  daysToDeadline: number
  donationSizeBreakdownStats: any
  donations: any[]
  donorHighlightsStats: any
  donorLTVStats: any
  donorList: any[]
  donorRetentionSnapshotStats: any
  enabledModules: Record<string, boolean>
  filterYear: string | number
  findDonorRecord: (email: string | null | undefined, name?: string) => any
  fundingConcentrationStats: any
  hiddenDashboardCards: string[]
  toggleDashboardCard: (cardKey: string) => void
  dashboardCardOrder: Record<string, string[]>
  reorderDashboardCard: (sectionId: string, defaultOrder: string[], draggedKey: string, targetKey: string) => void
  resetDashboardSection: (sectionId: string, cardKeys: string[]) => void
  fundraisingSnapshotStats: any
  fyEndDay: number
  fyEndMonth: number
  fyOf: (date: string | Date) => number
  generateThankYouNote: (donor: any, badge: any) => void
  giroMissedCycles: any
  givingChangeMinGifts: number
  givingChangeMinPct: number
  givingStreaksStats: any
  grantExpensesByGrant: any
  grantMatchClaims: any
  grantOverviewStats: any
  grantSnapshotStats: any
  grantsWithNextReport: any
  isMobile: boolean
  isTablet: boolean
  lapsedDismissals: any
  lapsedDonorsStats: any
  lapsedMinDays: number
  lapsedMinGifts: number
  lapsedReminderHistory: any
  majorDonorThreshold: number
  monthlyCountData: any
  monthlyEquivalentAmount: any
  monthlyExpenses: any
  myCauses: any[]
  newDonorAcquisitionStats: any
  obligationForm: any
  paymentMixStats: any
  pledgeConcentrationStats: any
  pledgeInstalments: any[]
  pledgeReliabilityStats: any
  pledgeSnapshotStats: any
  pledgeStatsAndTrend: any
  pledgeWatchThreshold: number
  pledgesLoaded: boolean
  predictableVsOneOffStats: any
  quietDonorsStats: any
  quietlyPayingStats: any
  recurringAuthStats: any
  recurringCompositionStats: any
  recurringGifts: any[]
  recurringHealthStats: any
  recurringMissedThreshold: number
  recurringMrrStats: any
  recurringRiskStats: any
  recurringSnapshotStats: any
  recurringTrendCycles: number
  revenueByChannelStats: any
  revenueTrendStats: any
  setActiveTab: (tab: string) => void
  setSettingsSection: (section: string) => void
  setAiWeekSummary: (v: any) => void
  setAiWeekSummaryError: (v: any) => void
  setAiWeekSummaryLoading: (v: any) => void
  setCampaignSearchTerm: (v: any) => void
  setCampaignYearFilter: (v: any) => void
  setConcentrationTopN: (v: any) => void
  setConfirmModal: (v: any) => void
  setCustomObligations: (v: any) => void
  setCustomTasks: (v: any) => void
  setDonorFilterLabel: (v: any) => void
  setFilterDonorKeys: (v: any) => void
  setFilterThankYou: (v: any) => void
  setFilterTopDonorNames: (v: any) => void
  setFilterYear: (v: any) => void
  setGivingChangeMinGifts: (v: any) => void
  setGivingChangeMinPct: (v: any) => void
  setGrantAmountFilter: (v: any) => void
  setGrantSearchTerm: (v: any) => void
  setGrantUrgencyFilter: (v: any) => void
  setGrantYearFilter: (v: any) => void
  setLapsedMinDays: (v: any) => void
  setLapsedMinGifts: (v: any) => void
  setObligationForm: Dispatch<SetStateAction<Record<string, any>>>
  setPledgeAmountFilter: (v: any) => void
  setPledgeProgrammeFilter: (v: any) => void
  setPledgeSearchTerm: (v: any) => void
  setPledgeTypeFilter: (v: any) => void
  setPledgeUrgencyFilter: (v: any) => void
  setPledgeWatchThreshold: (v: any) => void
  setPledgeYearFilter: (v: any) => void
  setRecurringAmountFilter: (v: any) => void
  setRecurringAuthFilter: (v: any) => void
  setRecurringMissedThreshold: (v: any) => void
  setRecurringProgrammeFilter: (v: any) => void
  setRecurringSearchTerm: (v: any) => void
  setRecurringTrendCycles: (v: any) => void
  setRecurringTypeFilter: (v: any) => void
  setRecurringUrgencyFilter: (v: any) => void
  setRecurringYearFilter: (v: any) => void
  setSelectedDonor: (v: any) => void
  setShowAddObligation: Dispatch<SetStateAction<boolean>>
  setShowAddTask: Dispatch<SetStateAction<boolean>>
  setShowAllBounceReasons: Dispatch<SetStateAction<boolean>>
  setShowAllConcentrationDonors: Dispatch<SetStateAction<boolean>>
  setShowAllEndingSoon: Dispatch<SetStateAction<boolean>>
  setShowAllFatigueList: Dispatch<SetStateAction<boolean>>
  setShowAllFrequentSkippers: Dispatch<SetStateAction<boolean>>
  setShowAllGivingChanges: Dispatch<SetStateAction<boolean>>
  setShowAllLapsedDonors: Dispatch<SetStateAction<boolean>>
  setShowAllMissedPayments: Dispatch<SetStateAction<boolean>>
  setShowAllOverGivers: Dispatch<SetStateAction<boolean>>
  setShowAllOverdueUnits: Dispatch<SetStateAction<boolean>>
  setShowAllPausedGifts: Dispatch<SetStateAction<boolean>>
  setShowAllPledgeConcentration: Dispatch<SetStateAction<boolean>>
  setShowAllPledgeWatchlist: Dispatch<SetStateAction<boolean>>
  setShowDismissedLapsedDonors: Dispatch<SetStateAction<boolean>>
  setShowDoneTasks: Dispatch<SetStateAction<boolean>>
  setShowSnoozedItems: Dispatch<SetStateAction<boolean>>
  setSnoozeMenuOpen: (v: any) => void
  setTaskForm: Dispatch<SetStateAction<Record<string, any>>>
  setToast: (v: any) => void
  showAddObligation: boolean
  showAddTask: boolean
  showAllBounceReasons: boolean
  showAllConcentrationDonors: boolean
  showAllEndingSoon: boolean
  showAllFatigueList: boolean
  showAllFrequentSkippers: boolean
  showAllGivingChanges: boolean
  showAllLapsedDonors: boolean
  showAllMissedPayments: boolean
  showAllOverGivers: boolean
  showAllOverdueUnits: boolean
  showAllPausedGifts: boolean
  showAllPledgeConcentration: boolean
  showAllPledgeWatchlist: boolean
  showDismissedLapsedDonors: boolean
  showDoneTasks: boolean
  showSnoozedItems: boolean
  showToast: (msg: string, type?: string) => void
  snoozeActionItem: (...args: any[]) => void
  snoozeMenuOpen: any
  snoozedItems: any
  taskForm: any
  topConnectorsStats: any
  undismissLapsedDonor: (...args: any[]) => void
  unsnoozeActionItem: (...args: any[]) => void
  updateCharityJsonField: (field: string, key: string, updater: (current: any) => any) => Promise<{ error?: unknown, next?: any }>
}

export function AnalyticsPage({
  ANALYTICS_NAV_OFFSET, acquisitionSourceStats, activeAnalyticsSection, aiWeekSummary, confirmedDonations,
  grants, massAppeals, pledges, thisMonthTotal,
  aiWeekSummaryError, aiWeekSummaryLoading, allGivingChangeFlags, analyticsGoalStats, annualGoal,
  appealConversionStats, appealListHealthStats, appealListStrip, appealSnapshotStats, appealTrendStats, campaignGoalStrip, campaignLeaderboardStats, campaignSnapshotStats, causeRaisedMap,
  charityIsIpc, charityName, charityUen, clearDonationFilters, concentrationTopN, customObligations, customTasks, dashboardActionItemsData, daysToDeadline, donationSizeBreakdownStats, donations, donorHighlightsStats,
  donorLTVStats, donorList, donorRetentionSnapshotStats, enabledModules, filterYear,
  findDonorRecord, fundingConcentrationStats, fundraisingSnapshotStats, fyEndDay, fyEndMonth,
  hiddenDashboardCards, toggleDashboardCard, dashboardCardOrder, reorderDashboardCard, resetDashboardSection,
  fyOf, generateThankYouNote, giroMissedCycles, givingChangeMinGifts, givingChangeMinPct,
  givingStreaksStats, grantExpensesByGrant, grantMatchClaims, grantOverviewStats,
  grantSnapshotStats, grantsWithNextReport, isMobile, isTablet, lapsedDismissals,
  lapsedDonorsStats, lapsedMinDays, lapsedMinGifts, lapsedReminderHistory, majorDonorThreshold, monthlyCountData, monthlyEquivalentAmount,
  monthlyExpenses, myCauses, newDonorAcquisitionStats, obligationForm, paymentMixStats,
  pledgeConcentrationStats, pledgeInstalments, pledgeReliabilityStats, pledgeSnapshotStats,
  pledgeStatsAndTrend, pledgeWatchThreshold, pledgesLoaded, predictableVsOneOffStats, quietDonorsStats,
  quietlyPayingStats, recurringAuthStats, recurringCompositionStats,
  recurringGifts, recurringHealthStats, recurringMissedThreshold, recurringMrrStats, recurringRiskStats,
  recurringSnapshotStats, recurringTrendCycles, revenueByChannelStats,
  revenueTrendStats, setActiveTab, setSettingsSection, setAiWeekSummary, setAiWeekSummaryError,
  setAiWeekSummaryLoading, setCampaignSearchTerm, setCampaignYearFilter, setConcentrationTopN, setConfirmModal,
  setCustomObligations, setCustomTasks, setDonorFilterLabel, setFilterDonorKeys, setFilterThankYou,
  setFilterTopDonorNames, setFilterYear, setGivingChangeMinGifts, setGivingChangeMinPct, setGrantAmountFilter,
  setGrantSearchTerm, setGrantUrgencyFilter, setGrantYearFilter, setLapsedMinDays, setLapsedMinGifts,
  setObligationForm, setPledgeAmountFilter, setPledgeProgrammeFilter, setPledgeSearchTerm, setPledgeTypeFilter,
  setPledgeUrgencyFilter, setPledgeWatchThreshold, setPledgeYearFilter, setRecurringAmountFilter,
  setRecurringAuthFilter, setRecurringMissedThreshold, setRecurringProgrammeFilter, setRecurringSearchTerm,
  setRecurringTrendCycles, setRecurringTypeFilter, setRecurringUrgencyFilter, setRecurringYearFilter,
  setSelectedDonor, setShowAddObligation, setShowAddTask, setShowAllBounceReasons,
  setShowAllConcentrationDonors, setShowAllEndingSoon, setShowAllFatigueList, setShowAllFrequentSkippers,
  setShowAllGivingChanges, setShowAllLapsedDonors, setShowAllMissedPayments, setShowAllOverGivers,
  setShowAllOverdueUnits, setShowAllPausedGifts, setShowAllPledgeConcentration, setShowAllPledgeWatchlist,
  setShowDismissedLapsedDonors, setShowDoneTasks, setShowSnoozedItems, setSnoozeMenuOpen, setTaskForm,
  setToast, showAddObligation, showAddTask, showAllBounceReasons, showAllConcentrationDonors,
  showAllEndingSoon, showAllFatigueList, showAllFrequentSkippers, showAllGivingChanges, showAllLapsedDonors,
  showAllMissedPayments, showAllOverGivers, showAllOverdueUnits, showAllPausedGifts,
  showAllPledgeConcentration, showAllPledgeWatchlist, showDismissedLapsedDonors, showDoneTasks,
  showSnoozedItems, showToast, snoozeActionItem, snoozeMenuOpen, snoozedItems, taskForm, topConnectorsStats, undismissLapsedDonor, unsnoozeActionItem, updateCharityJsonField, }: AnalyticsPageProps) {
  const [snoozeReasonDraft, setSnoozeReasonDraft] = useState('')
  const [campaignSort, setCampaignSort] = useState<'raised' | 'behind' | 'roi' | 'ending'>('raised')
  const hidden = (cardKey: string) => hiddenDashboardCards.includes(cardKey)
  const cardOrd = (sectionId: string, defaultCards: { key: string }[], cardKey: string) => getCardOrderIndex(dashboardCardOrder, sectionId, defaultCards.map(c => c.key), cardKey)
  const FINANCIAL_OVERVIEW_CARDS = [
    { key: 'fo_goal', label: 'Annual Fundraising Goal' },
    { key: 'fo_keyMetrics', label: 'Key Metrics (Coverage, Runway, Unrestricted Funding, Fixed-Cost Coverage)' },
    { key: 'fo_fundingMix', label: 'Funding Mix Snapshot (Campaigns, Grants, Pledges, Appeals, Recurring)' },
  ]
  const FUNDRAISING_PERFORMANCE_CARDS = [
    { key: 'fp_snapshot', label: 'Snapshot Tiles (Total Raised, Donations, Donors, Avg Gift)' },
    { key: 'fp_revenueTrend', label: 'Revenue Trend' },
    { key: 'fp_revenueByChannel', label: 'Revenue by Channel' },
    { key: 'fp_predictableVsOneOff', label: 'Predictable vs One-Off Revenue' },
    { key: 'fp_newDonorAcquisition', label: 'New Donor Acquisition' },
    { key: 'fp_donationsPerMonth', label: 'Number of Donations per Month' },
    { key: 'fp_seasonality', label: 'Seasonality Trend' },
  ]
  const CAMPAIGN_PERFORMANCE_CARDS = [
    { key: 'cp_snapshot', label: 'Snapshot Tiles' },
    { key: 'cp_revenueTrend', label: 'Campaign Revenue Trend' },
    { key: 'cp_donorGrowth', label: 'Donor Growth & Funding Sources' },
    { key: 'cp_donorInsights', label: 'Donor Acquisition Insights' },
    { key: 'cp_leaderboard', label: 'Campaign Leaderboard' },
  ]
  const MASS_APPEALS_CARDS = [
    { key: 'ma_snapshot', label: 'Snapshot Tiles' },
    { key: 'ma_listStrip', label: 'List Strip Tiles' },
    { key: 'ma_appealsTrend', label: 'Appeals Trend' },
    { key: 'ma_conversion', label: 'Mass Appeal Conversion' },
    { key: 'ma_listHealth', label: 'Appeal List Health' },
  ]
  const PLEDGE_PERFORMANCE_CARDS = [
    { key: 'pp_snapshot', label: 'Snapshot Tiles' },
    { key: 'pp_revenueTrend', label: 'Pledge Revenue Trend' },
    { key: 'pp_fulfillmentTrend', label: 'Pledge Fulfillment Rate' },
    { key: 'pp_newVsCancelled', label: 'New vs Cancelled Pledges' },
    { key: 'pp_timing', label: 'Pledge Reliability & Concentration' },
    { key: 'pp_reliability', label: 'Pledge Reliability' },
    { key: 'pp_concentration', label: 'Pledge Concentration' },
    { key: 'pp_monthlyTiming', label: 'Outstanding Pledges by Month' },
  ]
  const RECURRING_PERFORMANCE_CARDS = [
    { key: 'rc_snapshot', label: 'Snapshot Tiles' },
    { key: 'rc_healthTiles', label: 'Health Tiles (MRR, Retention Rate)' },
    { key: 'rc_revenueTrend', label: 'Recurring Revenue Trend' },
    { key: 'rc_composition', label: 'Revenue Composition' },
    { key: 'rc_newVsChurned', label: 'New vs Churned MRR' },
    { key: 'rc_givingTrend', label: 'Giving Trend (Upgrades & Downgrades)' },
    { key: 'rc_authRisk', label: 'Authorization & Mandate Risk' },
    { key: 'rc_giftRisk', label: 'Recurring Gift Risk' },
  ]
  const GRANTS_OVERVIEW_CARDS = [
    { key: 'gr_snapshot', label: 'Snapshot Tiles' },
    { key: 'gr_trend', label: 'Grants Trend' },
    { key: 'gr_spendingByCategory', label: 'Spending by Category' },
    { key: 'gr_fundingComposition', label: 'Funding Composition' },
    { key: 'gr_grantFunding', label: 'Grant Funding (Pace vs Report Deadline)' },
    { key: 'gr_grantConcentration', label: 'Grant Funding Concentration' },
    { key: 'gr_matchingClaims', label: 'Matching Grant Claims' },
    { key: 'gr_disbursementTranches', label: 'Disbursement Tranches' },
    { key: 'gr_reportCompliance', label: 'Report Compliance' },
  ]
  const DONOR_BEHAVIOR_CARDS = [
    { key: 'db_retentionTiles', label: 'Retention Snapshot Tiles' },
    { key: 'db_highlights', label: 'Donor Highlights' },
    { key: 'db_paymentMix', label: 'How Donors Are Paying' },
    { key: 'db_fundingConcentration', label: 'Funding Concentration' },
    { key: 'db_slowingDown', label: 'Slowing Down' },
    { key: 'db_quietlyPaying', label: 'Paying, But No Contact' },
    { key: 'db_givingChanges', label: 'Giving Changes' },
    { key: 'db_thankYouDebt', label: 'Silent Thank-You Debt' },
    { key: 'db_givingStreaks', label: 'Giving Streaks' },
    { key: 'db_topDonorsLTV', label: 'Top Donors & Lifetime Value' },
    { key: 'db_topConnectors', label: 'Top Connectors' },
    { key: 'db_acquisitionSources', label: 'Donor Acquisition Sources' },
  ]
  return (
          <div style={s.content}>
            <div style={s.pageHeader}>
              <div>
                <div style={{ fontFamily: C.fontVoice, fontWeight: 500, fontSize: 26, color: C.forest }}>Dashboard</div>
                <div style={{ ...s.pageSub, marginTop: 4 }}>Here's what's happening, plus the detailed analysis behind it.</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: C.muted }}>Fiscal year:</span>
                <select style={s.filterSelect} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                  <option>All</option>
                  {donations.length === 0
                    ? <option>{fyOf(new Date())}</option>
                    : [...new Set(donations.map(d => fyOf(d.created_at)))].sort((a, b) => b - a).map(y => <option key={y}>{y}</option>)
                  }
                </select>
              </div>
            </div>

            <div style={{ position: 'sticky', top: isMobile ? 56 : 0, zIndex: 15, background: C.ivory, paddingTop: 10, paddingBottom: 10, marginBottom: 24, borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 8, overflowX: isMobile ? 'auto' : 'visible', flexWrap: isMobile ? 'nowrap' : 'wrap' }}>
              {[
                { id: 'analytics-section-today', label: 'Today' },
                { id: 'analytics-section-fundraising', label: 'Fundraising' },
                ...(enabledModules.campaigns !== false ? [{ id: 'analytics-section-campaigns', label: 'Campaigns' }] : []),
                ...(false ? [{ id: 'analytics-section-massappeals', label: 'Mass Appeals' }] : []),
                ...(enabledModules.pledges !== false ? [{ id: 'analytics-section-pledges', label: 'Pledges' }] : []),
                ...(enabledModules.recurring !== false ? [{ id: 'analytics-section-recurring', label: 'Recurring' }] : []),
                ...(enabledModules.grants !== false ? [{ id: 'analytics-section-grants', label: 'Grants' }] : []),
                { id: 'analytics-section-donorbehavior', label: 'Donor Behavior' },
              ].map(section => (
                <button
                  key={section.id}
                  style={activeAnalyticsSection === section.id
                    ? { ...s.viewBtn, fontSize: 12, padding: '6px 12px', whiteSpace: 'nowrap', flexShrink: 0, background: C.forest, borderColor: C.forest, color: 'white' }
                    : { ...s.viewBtn, fontSize: 12, padding: '6px 12px', whiteSpace: 'nowrap', flexShrink: 0 }}
                  onClick={() => {
                    const el = document.getElementById(section.id)
                    if (!el) return
                    const top = el.getBoundingClientRect().top + window.scrollY - ((isMobile ? 56 : 0) + ANALYTICS_NAV_OFFSET)
                    window.scrollTo({ top, behavior: 'smooth' })
                  }}
                >{section.label}</button>
              ))}
            </div>
            <div id="analytics-section-today" style={{ scrollMarginTop: 20 }}>
            <div style={{ marginBottom: 40 }}>
              <div style={s.sectionBand}>
                <span style={s.sectionBandLabel}>Today's Overview</span>
              </div>

            {/* ── THIS WEEK, IN WORDS ── */}
            {(() => {
              const now = new Date()
              const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
              const prevWeekAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

              const thisWeekDonations = confirmedDonations.filter(d => new Date(d.created_at) >= weekAgo)
              const lastWeekDonations = confirmedDonations.filter(d => new Date(d.created_at) >= prevWeekAgo && new Date(d.created_at) < weekAgo)
              const weekTotal = thisWeekDonations.reduce((s, d) => s + d.amount, 0)
              const lastWeekTotal = lastWeekDonations.reduce((s, d) => s + d.amount, 0)
              const weekDonorKeys = new Set(thisWeekDonations.map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name))
              const weekGrowthPct = lastWeekTotal > 0 ? Math.round(((weekTotal - lastWeekTotal) / lastWeekTotal) * 100) : null

              const donorFirstGiftW: Record<string, any> = {}
              ;[...confirmedDonations].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).forEach(d => {
                const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
                if (!donorFirstGiftW[key]) donorFirstGiftW[key] = d.created_at
              })
              const newDonorsThisWeek = [...weekDonorKeys].filter(k => new Date(donorFirstGiftW[k]) >= weekAgo).length
              const biggestGiftThisWeek = thisWeekDonations.sort((a, b) => b.amount - a.amount)[0]

              const recurringThisWeek = thisWeekDonations.filter(d => d.recurring_gift_id)
              const recurringGiftsThisWeekCount = recurringThisWeek.length
              const recurringGiftsThisWeekTotal = recurringThisWeek.reduce((s, d) => s + d.amount, 0)

              const lapsedReturningThisWeek = [...weekDonorKeys].filter(key => {
                const priorGifts = confirmedDonations.filter(p => {
                  const pk = p.donor_email?.trim() || p.donor_nric || p.donor_name
                  return pk === key && new Date(p.created_at) < weekAgo
                })
                if (priorGifts.length === 0) return false
                const mostRecentPrior = priorGifts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
                const gapDays = (now.getTime() - new Date(mostRecentPrior.created_at).getTime()) / (1000 * 60 * 60 * 24)
                return gapDays >= lapsedMinDays
              })

              const sentences = []
              sentences.push(`This week, ${weekDonorKeys.size} donor${weekDonorKeys.size !== 1 ? 's' : ''} gave $${weekTotal.toLocaleString()}${weekGrowthPct !== null ? ` — ${weekGrowthPct >= 0 ? 'up' : 'down'} ${Math.abs(weekGrowthPct)}% from last week` : ''}.`)
              if (newDonorsThisWeek > 0) sentences.push(`${newDonorsThisWeek} of those were first-time donors.`)
              if (biggestGiftThisWeek) sentences.push(`Your biggest gift this week was $${Number(biggestGiftThisWeek.amount).toLocaleString()} from ${biggestGiftThisWeek.donor_name}.`)

              const weekStats = {
                charity_name: charityName,
                weekTotal,
                weekDonorCount: weekDonorKeys.size,
                weekGrowthPct,
                newDonorsThisWeek,
                biggestGiftAmount: biggestGiftThisWeek ? biggestGiftThisWeek.amount : null,
                recurringGiftsThisWeekCount,
                recurringGiftsThisWeekTotal,
                lapsedReturningCount: lapsedReturningThisWeek.length,
              }

              const generateAiSummary = async () => {
                setAiWeekSummaryLoading(true)
                setAiWeekSummaryError(null)
                const { data, error } = await supabase.functions.invoke('generate-week-summary', { body: weekStats })
                setAiWeekSummaryLoading(false)
                if (error || data?.error) {
                  setAiWeekSummaryError(
                    (data?.error || '').includes('not configured')
                      ? "AI summary isn't set up yet — ask your admin to add an Anthropic API key."
                      : 'Could not generate an AI summary right now.'
                  )
                  return
                }
                setAiWeekSummary(data.summary)
              }

              return (
                <div style={{ background: C.forest, borderRadius: 14, padding: 24, marginBottom: 20, boxShadow: C.shadow }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Your Week So Far</div>
                  <div style={{ fontSize: 16, color: 'white', lineHeight: 1.7 }}>{sentences.join(' ')}</div>
                  {/* "Generate AI summary" button hidden for now (feature flagged off, not removed) — see generateAiSummary above and aiWeekSummary/aiWeekSummaryError state. */}
                </div>
              )
            })()}

            {/* ── ACTION ITEMS ── */}
            {(() => {
              const { actionItemsVisible, fyiItemsVisible, highItems, criticalCount, snoozedActiveItems, nowMs } = dashboardActionItemsData

              const snoozeControl = (item: any) => item.key && (
                snoozeMenuOpen === item.key ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <input
                      type="text"
                      placeholder="Reason (optional)"
                      value={snoozeReasonDraft}
                      onChange={e => setSnoozeReasonDraft(e.target.value)}
                      style={{ fontSize: 11.5, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 6, width: 130, fontFamily: 'inherit', outline: 'none' }}
                    />
                    <span style={{ fontSize: 11.5, color: C.muted, marginRight: 2 }}>for</span>
                    {[1, 3, 7].map(d => (
                      <span key={d} style={{ fontSize: 12.5, color: C.forest, fontWeight: 600, cursor: 'pointer', padding: '6px 12px', background: C.ivory, border: `1px solid ${C.borderStrong}`, borderRadius: 6, lineHeight: 1 }}
                        onMouseEnter={e => { e.currentTarget.style.background = C.forest; e.currentTarget.style.color = 'white' }}
                        onMouseLeave={e => { e.currentTarget.style.background = C.ivory; e.currentTarget.style.color = C.forest }}
                        onClick={(e) => { e.stopPropagation(); snoozeActionItem(item.key, d, snoozeReasonDraft); setSnoozeReasonDraft('') }}>{d} day{d > 1 ? 's' : ''}</span>
                    ))}
                    <span style={{ fontSize: 15, color: C.muted, cursor: 'pointer', padding: '4px 8px' }} onClick={(e) => { e.stopPropagation(); setSnoozeMenuOpen(null); setSnoozeReasonDraft('') }} title="Cancel">✕</span>
                  </span>
                ) : (
                  <span style={{ fontSize: 11.5, color: C.muted, fontWeight: 500, cursor: 'pointer', flexShrink: 0, padding: '5px 12px', border: `1px solid ${C.border}`, borderRadius: 6, lineHeight: 1, whiteSpace: 'nowrap' }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.ivory; e.currentTarget.style.borderColor = C.borderStrong }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = C.border }}
                    onClick={(e) => { e.stopPropagation(); setSnoozeMenuOpen(item.key); setSnoozeReasonDraft('') }} title="Snooze this item">💤 Snooze</span>
                )
              )

              const snoozedSection = snoozedActiveItems.length > 0 ? (
                <div style={{ marginBottom: 16 }}>
                  <span style={{ fontSize: 12, color: C.muted, cursor: 'pointer' }} onClick={() => setShowSnoozedItems(v => !v)}>
                    {snoozedActiveItems.length} snoozed · {showSnoozedItems ? 'Hide' : 'Show'}
                  </span>
                  {showSnoozedItems && (
                    <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, marginTop: 6, background: C.white, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      {snoozedActiveItems.map((item: any, i: any) => {
                        const entry = snoozedItems[item.key] || {}
                        const daysLeft = Math.max(1, Math.ceil((entry.until - nowMs) / (1000 * 60 * 60 * 24)))
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', borderTop: i > 0 ? `1px solid ${C.border}` : 'none', fontSize: 12.5 }}>
                            <span style={{ flex: 1, color: C.muted }}>{item.label}{entry.reason && <span style={{ fontStyle: 'italic' }}> — "{entry.reason}"</span>}</span>
                            <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{daysLeft}d left</span>
                            <span style={{ fontSize: 11.5, color: C.sage, fontWeight: 500, cursor: 'pointer', flexShrink: 0 }} onClick={() => unsnoozeActionItem(item.key)}>Un-snooze</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : null

              if (actionItemsVisible.length === 0 && fyiItemsVisible.length === 0) {
                return (
                  <>
                    <div style={{ borderRadius: 14, border: `1px solid ${C.border}`, background: C.white, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: snoozedActiveItems.length > 0 ? 12 : 0, boxShadow: C.shadow }}>
                      <span style={{ fontSize: 13, color: C.forest, fontWeight: 500 }}>You're all caught up.</span>
                      <span style={{ fontSize: 13, color: C.muted }}>Nothing needs your attention right now — nice work.</span>
                    </div>
                    {snoozedSection}
                  </>
                )
              }

              const renderFlatFyi = (list: any[]) => list.map((item: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: i > 0 ? `1px solid ${C.border}` : 'none', background: C.white, fontSize: 13 }}
                  onMouseEnter={e => e.currentTarget.style.background = C.ivory}
                  onMouseLeave={e => e.currentTarget.style.background = C.white}
                >
                  <span style={{ color: C.text, flex: 1, cursor: 'pointer' }} onClick={() => item.jump ? item.jump() : setActiveTab(item.tab)}>{item.label}</span>
                  <span style={{ fontSize: 12, color: C.sage, fontWeight: 500, fontFamily: C.fontMono, flexShrink: 0, cursor: 'pointer' }} onClick={() => item.jump ? item.jump() : setActiveTab(item.tab)}>→</span>
                  {snoozeControl(item)}
                </div>
              ))

              return (
                <>
                {actionItemsVisible.length > 0 && (
                  <div style={{ borderRadius: 14, overflow: 'hidden', marginBottom: 16, border: `1px solid ${highItems.length > 0 ? C.red : C.warning}`, boxShadow: C.shadow }}>
                    <div style={{ background: highItems.length > 0 ? C.red : C.warning, padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: 'white' }}>{actionItemsVisible.length} thing{actionItemsVisible.length > 1 ? 's' : ''} need{actionItemsVisible.length === 1 ? 's' : ''} your attention{criticalCount > 0 ? ` — ${criticalCount} urgent` : ''}</span>
                    </div>
                    <div style={{ background: C.white, display: 'flex', flexDirection: 'column' }}>
                      {actionItemsVisible.map((item: any, i: any) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: `1px solid ${C.border}`, background: C.white, fontSize: 13 }}
                          onMouseEnter={e => e.currentTarget.style.background = C.ivory}
                          onMouseLeave={e => e.currentTarget.style.background = C.white}
                        >
                          <span style={{ color: item.priority === 'high' ? C.red : C.text, fontWeight: item.priority === 'high' ? 500 : 400, flex: 1, cursor: 'pointer' }} onClick={() => item.jump ? item.jump() : setActiveTab(item.tab)}>{item.label}</span>
                          <span style={{ fontSize: 12, color: C.sage, fontWeight: 500, fontFamily: C.fontMono, flexShrink: 0, cursor: 'pointer' }} onClick={() => item.jump ? item.jump() : setActiveTab(item.tab)}>→</span>
                          {snoozeControl(item)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {fyiItemsVisible.length > 0 && (
                  <div style={{ borderRadius: 14, overflow: 'hidden', marginBottom: 16, border: `1px solid ${C.gold}`, boxShadow: C.shadow }}>
                    <div style={{ background: C.gold, padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: 'white' }}>{fyiItemsVisible.length} thing{fyiItemsVisible.length > 1 ? 's' : ''} worth knowing</span>
                    </div>
                    <div style={{ background: C.white, display: 'flex', flexDirection: 'column' }}>
                      {renderFlatFyi(fyiItemsVisible)}
                    </div>
                  </div>
                )}
                {snoozedSection}
                </>
              )
            })()}

            {false && (() => {
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              const builtIn = [
                ...(charityIsIpc && daysToDeadline > 0 ? [{ title: 'IRAS Tax Deduction Submission', date: new Date(today.getFullYear(), 0, 31), type: 'iras' }] : []),
              ]
              const custom = (customObligations || []).map((o: any) => {
                let d = new Date(o.date)
                if (o.repeat === 'annual' && d < today) d.setFullYear(today.getFullYear() + (d.setFullYear(today.getFullYear()) < today.getTime() ? 1 : 0))
                return { ...o, dateObj: new Date(o.date.replace(/\d{4}/, today.getFullYear())) }
              }).map((o: any) => {
                let d = new Date(o.date.replace(/\d{4}/, today.getFullYear()))
                if (d < today) d.setFullYear(today.getFullYear() + 1)
                return { ...o, dateObj: d }
              })
              const all = [...builtIn.map(o => ({ ...o, dateObj: o.date })), ...custom]
                .sort((a, b) => a.dateObj - b.dateObj)
                .filter(o => {
                  const days = Math.ceil((o.dateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                  return days >= 0 && days <= 180
                })
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                  <div id="upcoming-obligations-card" style={{ ...s.card, scrollMarginTop: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ ...s.analyticsCardTitle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 5 }}>Upcoming Obligations <InfoTip text="Fixed-date commitments like AGM meetings, board meetings, or IRAS deadlines. Add your own under the Add button." /></div>
                      <button style={{ border: `1px solid ${C.borderStrong}`, background: C.ivory, borderRadius: 4, padding: '5px 11px', fontSize: 11.5, fontWeight: 500, color: C.forest, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setShowAddObligation(v => !v)}>+ Add</button>
                    </div>
                  {showAddObligation && (
                    <div style={{ background: C.ivory, borderRadius: 10, padding: 14, marginBottom: 12, border: `1px solid ${C.border}` }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                        <label style={{ display: 'block' }}>
                          <div style={s.formLabel}>Title</div>
                          <input style={s.formInput} placeholder="e.g. AGM, Board Meeting" value={obligationForm.title} onChange={e => setObligationForm(f => ({ ...f, title: e.target.value }))} />
                        </label>
                        <label style={{ display: 'block' }}>
                          <div style={s.formLabel}>Date</div>
                          <input style={s.formInput} type="date" value={obligationForm.date} onChange={e => setObligationForm(f => ({ ...f, date: e.target.value }))} />
                        </label>
                        <button style={{ ...s.btnForest, padding: '10px 14px' }} onClick={async () => {
                          if (!obligationForm.title.trim() || !obligationForm.date) return
                          const newObligation = { title: obligationForm.title.trim(), date: obligationForm.date, repeat: 'annual' }
                          const { error, next } = await updateCharityJsonField(charityUen, 'custom_obligations', current => [...(current || []), newObligation])
                          if (error) { showToast('Error saving', 'error'); return }
                          setCustomObligations(next)
                          setObligationForm({ title: '', date: '', repeat: 'annual' })
                          setShowAddObligation(false)
                          showToast('Obligation added ✓')
                        }}>Save</button>
                      </div>
                    </div>
                  )}
                  {all.length === 0 ? (
                    <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No upcoming obligations in the next 6 months.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {all.map((o, i) => {
                        const days = Math.ceil((o.dateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                        const urgent = days <= 7
                        const soon = days <= 30
                        return (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: urgent ? C.dangerBg : soon ? C.warningBg : C.ivory, borderRadius: 4, border: `1px solid ${urgent ? C.dangerBorder : soon ? C.warningBorder : C.border}` }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: urgent ? C.red : C.forest }}>{o.title}</div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{o.dateObj.toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontFamily: C.fontMono, fontSize: 12, fontWeight: 500, color: urgent ? C.red : soon ? C.gold : C.muted }}>{days}d</span>
                              {o.type !== 'iras' && o.type !== 'coc' && (
                <span style={{ fontSize: 11, color: C.muted, cursor: 'pointer' }} onClick={() => setConfirmModal({
                  title: 'Delete this obligation?',
                  description: `"${o.title}" will be removed.`,
                  confirmLabel: 'Delete',
                  onConfirm: async () => {
                    const { error, next } = await updateCharityJsonField(charityUen, 'custom_obligations', current => (current || []).filter((c: any) => c.title !== o.title || c.date !== o.date))
                    if (error) { showToast('Error removing obligation', 'error'); return }
                    setCustomObligations(next)
                    let cancelled = false
                    setToast({
                      msg: 'Obligation removed', type: 'error', undoable: true,
                      onUndo: async () => {
                        cancelled = true
                        const { next: restored } = await updateCharityJsonField(charityUen, 'custom_obligations', current => [...(current || []), o])
                        setCustomObligations(restored)
                        setToast(null)
                      },
                    })
                    setTimeout(() => { if (!cancelled) setToast(null) }, 10000)
                  },
                })}>✕</span>
              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div style={s.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ ...s.analyticsCardTitle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 5 }}>Tasks and Reminders <InfoTip text="Informal to-dos, like scheduling a call or following up with someone. Nothing here is a fixed deadline." /></div>
                    <button style={{ border: `1px solid ${C.borderStrong}`, background: C.ivory, borderRadius: 4, padding: '5px 11px', fontSize: 11.5, fontWeight: 500, color: C.forest, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setShowAddTask(v => !v)}>+ Add</button>
                  </div>
                  {showAddTask && (
                    <div style={{ background: C.ivory, borderRadius: 10, padding: 14, marginBottom: 12, border: `1px solid ${C.border}` }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                        <label style={{ display: 'block' }}>
                          <div style={s.formLabel}>Task</div>
                          <input style={s.formInput} placeholder="e.g. Call Mrs Tan back" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} />
                        </label>
                        <label style={{ display: 'block' }}>
                          <div style={s.formLabel}>Date (optional)</div>
                          <input style={s.formInput} type="date" value={taskForm.date} onChange={e => setTaskForm(f => ({ ...f, date: e.target.value }))} />
                        </label>
                        <button style={{ ...s.btnForest, padding: '10px 14px' }} onClick={async () => {
                          if (!taskForm.title.trim()) return
                          const newTask = { title: taskForm.title.trim(), date: taskForm.date || null, done: false }
                          const { error, next } = await updateCharityJsonField(charityUen, 'custom_tasks', current => [...(current || []), newTask])
                          if (error) { showToast('Error saving', 'error'); return }
                          setCustomTasks(next)
                          setTaskForm({ title: '', date: '' })
                          setShowAddTask(false)
                          showToast('Task added ✓')
                        }}>Save</button>
                      </div>
                    </div>
                  )}
                  {(customTasks || []).filter((t: any) => !t.done).length === 0 ? (
                    <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No open tasks right now.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(customTasks || []).filter((t: any) => !t.done).map((t: any, i: any) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: C.ivory, borderRadius: 4, border: `1px solid ${C.border}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input type="checkbox" checked={false} onChange={async () => {
                              const { error, next } = await updateCharityJsonField(charityUen, 'custom_tasks', current => (current || []).map((x: any) => (x.title === t.title && x.date === t.date) ? { ...x, done: true } : x))
                              if (error) { showToast('Error saving', 'error'); return }
                              setCustomTasks(next)
                              let cancelled = false
                              setToast({
                                msg: 'Task done ✓', undoable: true,
                                onUndo: async () => {
                                  cancelled = true
                                  const { next: reverted } = await updateCharityJsonField(charityUen, 'custom_tasks', current => (current || []).map((x: any) => (x.title === t.title && x.date === t.date) ? { ...x, done: false } : x))
                                  setCustomTasks(reverted)
                                  setToast(null)
                                },
                              })
                              setTimeout(() => { if (!cancelled) setToast(null) }, 10000)
                            }} />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: C.forest }}>{t.title}</div>
                              {t.date && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{new Date(t.date).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}</div>}
                            </div>
                          </div>
                          <span style={{ fontSize: 11, color: C.muted, cursor: 'pointer' }} onClick={() => setConfirmModal({
                            title: 'Delete this task?',
                            description: `"${t.title}" will be removed.`,
                            confirmLabel: 'Delete',
                            onConfirm: async () => {
                              const { error, next } = await updateCharityJsonField(charityUen, 'custom_tasks', current => (current || []).filter((x: any) => x.title !== t.title || x.date !== t.date))
                              if (error) { showToast('Error removing task', 'error'); return }
                              setCustomTasks(next)
                              let cancelled = false
                              setToast({
                                msg: 'Task removed', type: 'error', undoable: true,
                                onUndo: async () => {
                                  cancelled = true
                                  const { next: restored } = await updateCharityJsonField(charityUen, 'custom_tasks', current => [...(current || []), t])
                                  setCustomTasks(restored)
                                  setToast(null)
                                },
                              })
                              setTimeout(() => { if (!cancelled) setToast(null) }, 10000)
                            },
                          })}>✕</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {(customTasks || []).filter((t: any) => t.done).length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <span style={{ fontSize: 11, color: C.muted, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setShowDoneTasks(v => !v)}>
                        {showDoneTasks ? 'Hide' : 'Show'} {(customTasks || []).filter((t: any) => t.done).length} completed task{(customTasks || []).filter((t: any) => t.done).length !== 1 ? 's' : ''}
                      </span>
                      {showDoneTasks && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                          {(customTasks || []).filter((t: any) => t.done).map((t: any, i: any) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: C.ivory, borderRadius: 4, border: `1px solid ${C.border}` }}>
                              <div style={{ fontSize: 13, color: C.muted, textDecoration: 'line-through' }}>{t.title}</div>
                              <span style={{ fontSize: 11, color: C.forest, cursor: 'pointer' }} onClick={async () => {
                                const { error, next } = await updateCharityJsonField(charityUen, 'custom_tasks', current => (current || []).map((x: any) => (x.title === t.title && x.date === t.date) ? { ...x, done: false } : x))
                                if (!error) { setCustomTasks(next); showToast('Task reopened') }
                              }}>↺ Reopen</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                </div>
              )
            })()}

            </div>

            <div style={{ marginBottom: 40 }}>
              <div style={s.sectionBand}>
                <span style={s.sectionBandLabel}>Financial Overview</span>
                <CustomizeSectionButton sectionId="fo" cards={FINANCIAL_OVERVIEW_CARDS} hiddenDashboardCards={hiddenDashboardCards} toggleDashboardCard={toggleDashboardCard} resetDashboardSection={resetDashboardSection} setConfirmModal={setConfirmModal} />
              </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>

            {/* ── ANNUAL FUNDRAISING GOAL (moved up from Fundraising Performance) ── */}
            {!hidden('fo_goal') && analyticsGoalStats.hasGoal && (() => {
              const { goalYear, totalThisGoalYear, pct, onTrack, projectedTotal, gap } = analyticsGoalStats
              const { end: goalYearEnd } = fiscalYearBounds(goalYear, fyEndMonth, fyEndDay)
              const goalYearEndLabel = goalYearEnd.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
              return (
              <DraggableCard sectionId="fo" cardKey="fo_goal" order={cardOrd('fo', FINANCIAL_OVERVIEW_CARDS, 'fo_goal')} flexBasis="440px" defaultOrder={FINANCIAL_OVERVIEW_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
              <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                <div style={{ ...s.analyticsCardTitle, letterSpacing: 0.5, marginBottom: 6 }}>Annual Fundraising Goal — FY{goalYear} <InfoTip text="Total confirmed donations this fiscal year against the goal you've set. Includes donations only, not grants. Always shows the current fiscal year, regardless of the year filter above. Set or change your goal in Settings, and your fiscal year end in Charity Governance." /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <svg width="76" height="76" viewBox="0 0 76 76" style={{ flexShrink: 0 }}>
                    <circle cx="38" cy="38" r="32" fill="none" stroke={C.ivoryDark} strokeWidth="8" />
                    <circle cx="38" cy="38" r="32" fill="none" stroke={onTrack ? C.sage : C.gold} strokeWidth="8" strokeLinecap="round"
                      strokeDasharray="201" strokeDashoffset={201 - Math.min(100, pct) / 100 * 201} transform="rotate(-90 38 38)" />
                    <text x="38" y="43" textAnchor="middle" fontSize="15" fontWeight="700" fill={C.forest} fontFamily="inherit">{pct}%</text>
                  </svg>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                      <span style={s.analyticsStatNumber}>${totalThisGoalYear.toLocaleString()}</span>
                      <span style={{ fontSize: 11.5, color: C.muted }}>of ${annualGoal.toLocaleString()} goal</span>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: onTrack ? C.successFill : C.warningFill, borderRadius: 20, padding: '7px 14px 7px 10px' }}>
                      <span style={{ fontSize: 14, color: C.white, lineHeight: 1, flexShrink: 0 }}>{onTrack ? '✓' : '⚠'}</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: C.white }}>
                        {onTrack ? 'On pace' : 'Off pace'} — projected ${projectedTotal.toLocaleString()} by {goalYearEndLabel}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
              </DraggableCard>
              )
            })()}

            {/* ── KEY METRICS ── */}
            {!hidden('fo_keyMetrics') && (() => {
              const now = new Date()
              const coverageRatio = monthlyExpenses > 0 ? (thisMonthTotal / monthlyExpenses) : null
              const activeRecurring = recurringGifts.filter(g => g.status === 'active')
              const totalMRR = activeRecurring.filter(g => g.authorization_status !== 'terminated').reduce((s, g) => s + monthlyEquivalentAmount(g), 0)
              const fixedCostCoveragePct = monthlyExpenses > 0 ? Math.round((totalMRR / monthlyExpenses) * 100) : null
              const unrestrictedGrantTotal = grants.filter(g => g.status === 'active').reduce((s, g) => s + Number(g.unrestricted_amount || 0), 0)
              const unrestrictedCoverageMonths = monthlyExpenses > 0 ? (unrestrictedGrantTotal / monthlyExpenses) : null

              const threeMoAgoFH = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
              const recentTotalFH = donations.filter(d => d.payment_status === 'confirmed' && new Date(d.created_at) >= threeMoAgoFH).reduce((s, d) => s + d.amount, 0)
              const trailingAvgMonthlyFH = recentTotalFH / 3
              const runwayMonthsFH = monthlyExpenses > 0 ? (trailingAvgMonthlyFH / monthlyExpenses) : null

              return (
                <DraggableCard sectionId="fo" cardKey="fo_keyMetrics" order={cardOrd('fo', FINANCIAL_OVERVIEW_CARDS, 'fo_keyMetrics')} flexBasis="100%" defaultOrder={FINANCIAL_OVERVIEW_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
                  {/* Coverage ratio */}
                  <div style={{ ...s.card, marginBottom: 0 }}>
                    <div style={{ ...s.analyticsCardTitle, letterSpacing: 0.5, marginBottom: 6 }}>Monthly Coverage <InfoTip text="This month's donations divided by your monthly expenses. 1.0x means you're breaking even. Set your expenses in Settings." /></div>
                    {coverageRatio === null ? (
                      <div>
                        <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>Set expenses</div>
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 8px' }} onClick={() => { setActiveTab('settings'); setTimeout(() => document.getElementById('monthly-expenses-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50) }}>Set →</button>
                      </div>
                    ) : (
                      <>
                        <div style={{ ...s.analyticsStatNumber, color: coverageRatio >= 1 ? C.forest : coverageRatio >= 0.75 ? C.gold : C.red }}>{coverageRatio.toFixed(1)}×</div>
                        <div style={{ fontSize: 11.5, color: coverageRatio >= 1 ? C.sage : coverageRatio >= 0.75 ? C.gold : C.red, marginTop: 6, fontWeight: 500 }}>
                          {coverageRatio >= 1 ? '✓ Covering costs' : coverageRatio >= 0.75 ? '⚠ Close to breaking even' : '⚠ Shortfall'}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Cash runway */}
                  <div style={{ ...s.card, marginBottom: 0 }}>
                    <div style={{ ...s.analyticsCardTitle, letterSpacing: 0.5, marginBottom: 6 }}>Cash Runway <InfoTip text="Based on your average monthly donations over the last 3 months, how many months of expenses that pace would cover. See Analytics for more detail." /></div>
                    {runwayMonthsFH === null ? (
                      <div>
                        <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>Set expenses</div>
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 8px' }} onClick={() => { setActiveTab('settings'); setTimeout(() => document.getElementById('monthly-expenses-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50) }}>Set →</button>
                      </div>
                    ) : (
                      <>
                        <div style={{ ...s.analyticsStatNumber, color: runwayMonthsFH >= 3 ? C.forest : runwayMonthsFH >= 1 ? C.gold : C.red }}>{runwayMonthsFH.toFixed(1)} mo</div>
                        <div style={{ fontSize: 11.5, color: runwayMonthsFH >= 3 ? C.sage : runwayMonthsFH >= 1 ? C.gold : C.red, marginTop: 6, fontWeight: 500 }}>
                          {runwayMonthsFH >= 3 ? '✓ Healthy pace' : runwayMonthsFH >= 1 ? '⚠ Worth a closer look' : '⚠ Critical'}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Unrestricted funding coverage */}
                  <div style={{ ...s.card, marginBottom: 0 }}>
                    <div style={{ ...s.analyticsCardTitle, letterSpacing: 0.5, marginBottom: 6 }}>Unrestricted Funding <InfoTip text="Unrestricted funding from active grants divided by your monthly expenses — restricted grant money can't legally cover operating costs, so this shows how many months your genuinely free-to-use funds could cover on their own." /></div>
                    {unrestrictedCoverageMonths === null ? (
                      <div>
                        <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>Set expenses</div>
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 8px' }} onClick={() => { setActiveTab('settings'); setTimeout(() => document.getElementById('monthly-expenses-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50) }}>Set →</button>
                      </div>
                    ) : (
                      <>
                        <div style={{ ...s.analyticsStatNumber, color: unrestrictedCoverageMonths >= 3 ? C.forest : unrestrictedCoverageMonths >= 1 ? C.gold : C.red }}>{unrestrictedCoverageMonths.toFixed(1)} mo</div>
                        <div style={{ fontSize: 11.5, color: unrestrictedCoverageMonths >= 3 ? C.sage : unrestrictedCoverageMonths >= 1 ? C.gold : C.red, marginTop: 6, fontWeight: 500 }}>
                          {unrestrictedCoverageMonths >= 3 ? '✓' : '⚠'} ${unrestrictedGrantTotal.toLocaleString()} unrestricted from active grants
                        </div>
                      </>
                    )}
                  </div>

                  {/* Fixed-cost coverage from recurring income */}
                  <div style={{ ...s.card, marginBottom: 0 }}>
                    <div style={{ ...s.analyticsCardTitle, letterSpacing: 0.5, marginBottom: 6 }}>Fixed-Cost Coverage <InfoTip text="Recurring donations (MRR) divided by monthly expenses — if one-off giving stopped tomorrow, this is how much of your fixed costs your recurring donors alone would still cover." /></div>
                    {fixedCostCoveragePct === null ? (
                      <div>
                        <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>Set expenses</div>
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 8px' }} onClick={() => { setActiveTab('settings'); setTimeout(() => document.getElementById('monthly-expenses-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50) }}>Set →</button>
                      </div>
                    ) : (
                      <>
                        <div style={{ ...s.analyticsStatNumber, color: fixedCostCoveragePct >= 50 ? C.forest : fixedCostCoveragePct >= 25 ? C.gold : C.red }}>{fixedCostCoveragePct}%</div>
                        <div style={{ fontSize: 11.5, color: fixedCostCoveragePct >= 50 ? C.sage : fixedCostCoveragePct >= 25 ? C.gold : C.red, marginTop: 6, fontWeight: 500 }}>
                          {fixedCostCoveragePct >= 50 ? '✓ Solid recurring base' : fixedCostCoveragePct >= 25 ? '⚠ Partial recurring base' : '⚠ Reliant on one-off giving'}
                        </div>
                      </>
                    )}
                  </div>

                </div>
                </DraggableCard>
              )
            })()}

            {!hidden('fo_fundingMix') && (() => {
              const now03 = new Date()
              const liveCampaignsList = myCauses.filter(c => c.status === 'approved' && c.type === 'campaign' && (!c.end_date || new Date(c.end_date) >= now03))
              const behindPaceCampaigns = liveCampaignsList.filter(c => {
                // Matches the Campaigns page's own time-proportional pace calculation exactly --
                // a flat "under 40% raised" threshold previously flagged brand-new campaigns as
                // "behind pace" on day one, disagreeing with the Campaigns page's own verdict.
                if (!(c.target_amount > 0 && c.end_date)) return false
                const stats = causeRaisedMap[c.id] || { total: 0 }
                const pct = Math.min(100, (stats.total / c.target_amount) * 100)
                const periodStart = new Date(c.start_date || c.created_at)
                const totalDuration = new Date(c.end_date).getTime() - periodStart.getTime()
                const elapsed = now03.getTime() - periodStart.getTime()
                const elapsedPct = totalDuration > 0 ? Math.min(100, Math.max(0, (elapsed / totalDuration) * 100)) : 0
                return pct < elapsedPct - 15
              })

              const activeGrantsList = grantsWithNextReport.filter((g: any) => g.status === 'active')
              const nearestGrantDeadline = activeGrantsList
                .filter((g: any) => g.report_due_date)
                .map((g: any) => Math.ceil((new Date(g.report_due_date).getTime() - now03.getTime()) / (1000 * 60 * 60 * 24)))
                .filter((d: any) => d >= 0)
                .sort((a: any, b: any) => a - b)[0]

              const pendingPledgesList = pledges.filter(p => p.status === 'pending')
              const overduePledgesList = pendingPledgesList.filter(p => new Date(p.expected_date) < now03)
              // Outstanding value counts only remaining unpaid instalments for multi-year pledges,
              // matching how the Pledges page itself totals outstanding value -- using the full
              // multi-year amount here would double-count instalments already paid off.
              const outstandingAmountForPledge = (p: any) => p.is_multi_year
                ? pledgeInstalments.filter(i => i.pledge_id === p.id && !i.received).reduce((s, i) => s + Number(i.amount), 0)
                : Number(p.amount)
              const overduePledgeTotal = overduePledgesList.reduce((s, p) => s + outstandingAmountForPledge(p), 0)

              const thisYearAppeals = massAppeals.filter((a: any) => fyOf(a.created_at) === fyOf(now03))
              const lastAppeal = [...massAppeals].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
              const daysSinceLastAppeal = lastAppeal ? Math.floor((now03.getTime() - new Date(lastAppeal.created_at).getTime()) / (1000 * 60 * 60 * 24)) : null

              const activeRecurringList = recurringGifts.filter(g => g.status === 'active')
              const escalatedGiroList = giroMissedCycles.filter((g: any) => g.missedCycles >= 2)

              const mixTiles = [
                { label: 'Campaigns', count: liveCampaignsList.length, tab: 'promotions',
                  flag: behindPaceCampaigns.length > 0 ? { text: `⚠ ${behindPaceCampaigns.length} behind pace`, color: C.gold }
                    : liveCampaignsList.length > 0 ? { text: '✓ On pace', color: C.sage } : null },
                { label: 'Grants', count: activeGrantsList.length, tab: 'grants',
                  flag: nearestGrantDeadline !== undefined ? { text: `⚠ Report due ${nearestGrantDeadline}d`, color: nearestGrantDeadline <= 30 ? C.red : C.gold }
                    : activeGrantsList.length > 0 ? { text: '✓ No deadlines soon', color: C.sage } : null },
                { label: 'Pledges', count: pendingPledgesList.length, tab: 'pledges',
                  flag: overduePledgesList.length > 0 ? { text: `⚠ $${overduePledgeTotal.toLocaleString()} overdue`, color: C.red }
                    : pendingPledgesList.length > 0 ? { text: '✓ None overdue', color: C.sage } : null },
                { label: 'Appeals', count: thisYearAppeals.length, tab: 'promotions',
                  flag: daysSinceLastAppeal !== null ? { text: daysSinceLastAppeal > 60 ? `⚠ Last sent ${daysSinceLastAppeal}d ago` : `Last sent ${daysSinceLastAppeal}d ago`, color: daysSinceLastAppeal > 60 ? C.gold : C.muted } : null },
                { label: 'Recurring', count: activeRecurringList.length, tab: 'recurring',
                  flag: escalatedGiroList.length > 0 ? { text: `⚠ ${escalatedGiroList.length} missed cycles`, color: C.red }
                    : activeRecurringList.length > 0 ? { text: '✓ All on schedule', color: C.sage } : null },
              ]
              return (
                <DraggableCard sectionId="fo" cardKey="fo_fundingMix" order={cardOrd('fo', FINANCIAL_OVERVIEW_CARDS, 'fo_fundingMix')} flexBasis="560px" defaultOrder={FINANCIAL_OVERVIEW_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '18px 20px 4px' }}>
                    <div style={{ ...s.analyticsCardTitle, letterSpacing: 0.5, marginBottom: 0 }}>Funding Mix — active items <InfoTip text="Quick snapshot of what's active or pending across each fundraising channel. Click a tile to jump to that section." /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : `repeat(${mixTiles.length}, minmax(0, 1fr))` }}>
                    {mixTiles.map((t, i) => (
                      <div key={t.label} style={{ padding: '14px 16px', paddingLeft: !isMobile && i === 0 ? 20 : 16, paddingRight: !isMobile && i === mixTiles.length - 1 ? 20 : 16, cursor: 'pointer', borderRight: !isMobile && i !== mixTiles.length - 1 ? `1px solid ${C.border}` : 'none', borderBottom: isMobile && i < mixTiles.length - (mixTiles.length % 2 === 0 ? 2 : 1) ? `1px solid ${C.border}` : 'none' }} onClick={() => setActiveTab(t.tab)}>
                        <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{t.label}</div>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 20, fontWeight: 500, color: C.forest, lineHeight: 1 }}>{t.count}</div>
                        {t.flag && <div style={{ fontSize: 11.5, color: t.flag.color, fontWeight: 500, marginTop: 5 }}>{t.flag.text}</div>}
                      </div>
                    ))}
                  </div>
                </div>
                </DraggableCard>
              )
            })()}

            </div>
            </div>
            </div>

            <div id="analytics-section-fundraising" style={{ marginBottom: 40, scrollMarginTop: 20 }}>
              <div style={s.sectionBand}>
                <span style={s.sectionBandLabel}>Fundraising Performance</span>
                <CustomizeSectionButton sectionId="fp" cards={FUNDRAISING_PERFORMANCE_CARDS} hiddenDashboardCards={hiddenDashboardCards} toggleDashboardCard={toggleDashboardCard} resetDashboardSection={resetDashboardSection} setConfirmModal={setConfirmModal} />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>

              {!hidden('fp_snapshot') && (() => {
                const { yr, tiles } = fundraisingSnapshotStats
                return (
                  <DraggableCard sectionId="fp" cardKey="fp_snapshot" order={cardOrd('fp', FUNDRAISING_PERFORMANCE_CARDS, 'fp_snapshot')} flexBasis="100%" defaultOrder={FUNDRAISING_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ display: 'flex', gap: 12, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                    {tiles.map((t: any, i: any) => (
                      <div key={i} style={{ ...s.card, flex: 1, minWidth: isMobile ? 'calc(50% - 6px)' : 0 }}>
                        <div style={{ ...s.analyticsCardTitle, letterSpacing: 0.5, marginBottom: 6 }}>{t.label} <InfoTip text={t.tip} /></div>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>{t.val}</div>
                        {t.d === undefined ? null : t.d === null ? (
                          <div style={{ fontSize: 11, color: C.muted }}>no activity in {yr - 1} to compare</div>
                        ) : (
                          <div style={{ fontSize: 11, fontWeight: 500, color: t.d > 0 ? C.sage : t.d < 0 ? C.red : C.muted }}>
                            {t.d > 0 ? '▲' : t.d < 0 ? '▼' : '–'} {Math.abs(t.d)}% vs {yr - 1}
                          </div>
                        )}
                        {t.extra && (
                          <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>{t.extra}</div>
                        )}
                      </div>
                    ))}
                  </div>
                  </DraggableCard>
                )
              })()}

              {!hidden('fp_revenueTrend') && revenueTrendStats && (() => {
                const { trendData, firstYr, lastYr, cagr } = revenueTrendStats
                return (
                  <DraggableCard sectionId="fp" cardKey="fp_revenueTrend" order={cardOrd('fp', FUNDRAISING_PERFORMANCE_CARDS, 'fp_revenueTrend')} flexBasis="360px" defaultOrder={FUNDRAISING_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                    <div style={s.analyticsCardTitle}>Revenue Trend — Last {trendData.length} Years <InfoTip text="Total confirmed donations per calendar year, so you can see the long-term trajectory rather than just this year vs last year." /></div>
                    <div style={{ flex: 1, minHeight: 130 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="year" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} width={40} tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K` : `$${v}`} />
                        <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(value) => [`$${value.toLocaleString()}`, 'Total raised']} />
                        <Bar dataKey="total" fill={C.sage} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                    </div>
                  </div>
                  </DraggableCard>
                )
              })()}

              {!hidden('fp_revenueByChannel') && (() => {
                const { yr, channelRows } = revenueByChannelStats
                return (
                  <DraggableCard sectionId="fp" cardKey="fp_revenueByChannel" order={cardOrd('fp', FUNDRAISING_PERFORMANCE_CARDS, 'fp_revenueByChannel')} flexBasis="360px" defaultOrder={FUNDRAISING_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ ...s.card, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                    <div style={s.analyticsCardTitle}>Revenue by Channel — {yr} <InfoTip text="Where your confirmed revenue actually came from this year: campaigns, mass appeals, recurring gifts, grants, and undesignated general giving." /></div>
                    {channelRows.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: C.muted }}>No revenue recorded {filterYear !== 'All' ? `in ${yr}` : 'yet'}.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: 12 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, minWidth: 0, width: isMobile ? '100%' : 'auto' }}>
                          {channelRows.map((r: any, i: any) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 9, height: 9, borderRadius: 3, background: r.color, flexShrink: 0 }} />
                              <span style={{ fontSize: 12.5, color: C.text, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
                              <span style={{ fontSize: 12.5, fontWeight: 700, color: C.forest, minWidth: 30, textAlign: 'right' }}>{r.pct}%</span>
                              <span style={{ fontSize: 11, color: C.muted, minWidth: 52, textAlign: 'right' }}>${r.amt.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                        <ResponsiveContainer width={isMobile ? '100%' : 100} height={110}>
                          <PieChart>
                            <Pie data={channelRows} dataKey="amt" nameKey="label" cx="50%" cy="50%" innerRadius={26} outerRadius={46} paddingAngle={2} isAnimationActive={false}>
                              {channelRows.map((r: any, i: any) => (
                                <Cell key={i} fill={r.color} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(value, name) => [`$${Number(value).toLocaleString()}`, name]} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                  </DraggableCard>
                )
              })()}

              {!hidden('fp_predictableVsOneOff') && (() => {
                const { yr, totalRevenue, predictablePct, predictableAmt, oneOffAmt } = predictableVsOneOffStats
                return (
                  <DraggableCard sectionId="fp" cardKey="fp_predictableVsOneOff" order={cardOrd('fp', FUNDRAISING_PERFORMANCE_CARDS, 'fp_predictableVsOneOff')} flexBasis="360px" defaultOrder={FUNDRAISING_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ ...s.card, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                    <div style={s.analyticsCardTitle}>Predictable vs One-Off Revenue — {yr} <InfoTip text="Predictable revenue is recurring gifts, grants, and fulfilled pledges — money you can count on without re-soliciting. One-off is everything else: campaign, mass appeal, and general gifts that each need to be earned fresh." /></div>
                    {totalRevenue === 0 ? (
                      <div style={{ fontSize: 12.5, color: C.muted }}>No revenue recorded {filterYear !== 'All' ? `in ${yr}` : 'yet'}.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                          <div style={{ fontFamily: C.fontVoice, fontSize: 22, fontWeight: 500, color: C.sage, lineHeight: 1 }}>${predictableAmt.toLocaleString()}</div>
                          <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>Predictable · {predictablePct}%</div>
                          <div style={{ background: C.ivoryDark, borderRadius: 3, height: 5, overflow: 'hidden' }}>
                            <div style={{ width: `${predictablePct}%`, height: '100%', background: C.sage }} />
                          </div>
                        </div>
                        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                          <div style={{ fontFamily: C.fontVoice, fontSize: 22, fontWeight: 500, color: C.gold, lineHeight: 1 }}>${oneOffAmt.toLocaleString()}</div>
                          <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>One-off · {100 - predictablePct}%</div>
                          <div style={{ background: C.ivoryDark, borderRadius: 3, height: 5, overflow: 'hidden' }}>
                            <div style={{ width: `${100 - predictablePct}%`, height: '100%', background: C.gold }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  </DraggableCard>
                )
              })()}

              {!hidden('fp_newDonorAcquisition') && (() => {
                const { yr, newDonorChartData, totalNew } = newDonorAcquisitionStats
                return (
                  <DraggableCard sectionId="fp" cardKey="fp_newDonorAcquisition" order={cardOrd('fp', FUNDRAISING_PERFORMANCE_CARDS, 'fp_newDonorAcquisition')} flexBasis="360px" defaultOrder={FUNDRAISING_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                    <div style={s.analyticsCardTitle}>New Donor Acquisition — {yr}{filterYear !== 'All' && ` vs ${yr - 1}`} <InfoTip text="First-time donors by the month of their very first confirmed gift, compared against the same months last year. Shows whether your donor base is actually growing, not just cycling the same supporters." /></div>
                    <div style={{ minHeight: 22, display: 'flex', gap: 14, fontSize: 10.5, color: C.muted }}>
                      {filterYear !== 'All' && (
                        <>
                          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: C.sage, borderRadius: 2, marginRight: 5 }} />{yr}</span>
                          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: C.gold, borderRadius: 2, marginRight: 5 }} />{yr - 1}</span>
                        </>
                      )}
                    </div>
                    {totalNew === 0 ? (
                      <div style={{ fontSize: 12.5, color: C.muted }}>No new donors recorded {filterYear !== 'All' ? `in ${yr}` : 'yet'}.</div>
                    ) : (
                      <div style={{ flex: 1, minHeight: 180 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={newDonorChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                          <XAxis dataKey="month" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
                          <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(value, name) => [value, name === 'count' ? `New donors, ${yr}` : `New donors, ${yr - 1}`]} />
                          {filterYear !== 'All' && <Line type="monotone" dataKey="lastYearCount" stroke={C.gold} strokeWidth={2.5} dot={{ fill: C.gold, r: 3.5 }} isAnimationActive={false} />}
                          <Line type="monotone" dataKey="count" stroke={C.sage} strokeWidth={2.5} dot={{ fill: C.sage, r: 4 }} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                  </DraggableCard>
                )
              })()}

                {!hidden('fp_donationsPerMonth') && (
                <DraggableCard sectionId="fp" cardKey="fp_donationsPerMonth" order={cardOrd('fp', FUNDRAISING_PERFORMANCE_CARDS, 'fp_donationsPerMonth')} flexBasis="360px" defaultOrder={FUNDRAISING_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                  <div style={s.analyticsCardTitle}>Number of Donations per Month — {filterYear}{filterYear !== 'All' && ` vs ${parseInt(String(filterYear)) - 1}`} <InfoTip text="Count of individual confirmed donations received each month, regardless of amount, compared against the same months last year." /></div>
                  <div style={{ minHeight: 22, display: 'flex', gap: 14, fontSize: 10.5, color: C.muted }}>
                    {filterYear !== 'All' && (
                      <>
                        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: C.sage, borderRadius: 2, marginRight: 5 }} />{filterYear}</span>
                        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: C.gold, borderRadius: 2, marginRight: 5 }} />{parseInt(String(filterYear)) - 1}</span>
                      </>
                    )}
                  </div>
                  <div style={{ flex: 1, minHeight: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyCountData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} width={24} />
                      <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(value, name) => [value, name === 'count' ? filterYear : (filterYear !== 'All' ? `${parseInt(String(filterYear)) - 1}` : 'Previous year')]} />
                      {filterYear !== 'All' && <Line type="monotone" dataKey="lastYearCount" stroke={C.gold} strokeWidth={2.5} dot={{ fill: C.gold, r: 3.5 }} isAnimationActive={false} />}
                      <Line type="monotone" dataKey="count" stroke={C.sage} strokeWidth={2.5} dot={{ fill: C.sage, r: 4 }} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                  </div>
                </div>
                </DraggableCard>
                )}
              {!hidden('fp_seasonality') && (() => {
                const fyStartMonth58 = (fyEndMonth + 1) % 12
                const monthNames58 = Array.from({ length: 12 }, (_, i) => new Date(2000, (fyStartMonth58 + i) % 12, 1).toLocaleDateString('en-SG', { month: 'short' }))
                const years58 = [...new Set(confirmedDonations.map(d => new Date(d.created_at).getFullYear()))].sort((a, b) => b - a).slice(0, 4).sort((a, b) => a - b)
                if (years58.length < 2) return (
                  <DraggableCard sectionId="fp" cardKey="fp_seasonality" order={cardOrd('fp', FUNDRAISING_PERFORMANCE_CARDS, 'fp_seasonality')} flexBasis="360px" defaultOrder={FUNDRAISING_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                    <div style={s.analyticsCardTitle}>Seasonality Trend <InfoTip text="Average confirmed revenue per calendar month, averaged across all years of data — helps identify which months tend to be strong or weak so you can time appeals accordingly." /></div>
                    <div style={{ fontSize: 13, color: C.muted }}>Needs at least 2 years of data to spot a repeating pattern — check back once you have more history.</div>
                  </div>
                  </DraggableCard>
                )
                const byMonth58 = monthNames58.map((name, i) => {
                  const monthIdx = (fyStartMonth58 + i) % 12
                  const totalsAcrossYears = years58.map(y => confirmedDonations.filter(d => { const dt = new Date(d.created_at); return dt.getFullYear() === y && dt.getMonth() === monthIdx }).reduce((s, d) => s + d.amount, 0))
                  const nonZeroTotals = totalsAcrossYears.filter(t => t > 0)
                  const avg = nonZeroTotals.length > 0 ? totalsAcrossYears.reduce((s, t) => s + t, 0) / years58.length : 0
                  return { name, avg }
                })
                const overallAvg58 = byMonth58.reduce((s, m) => s + m.avg, 0) / 12
                const maxAvg58 = Math.max(...byMonth58.map(m => m.avg), 1)
                return (
                  <DraggableCard sectionId="fp" cardKey="fp_seasonality" order={cardOrd('fp', FUNDRAISING_PERFORMANCE_CARDS, 'fp_seasonality')} flexBasis="360px" defaultOrder={FUNDRAISING_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                    <div style={s.analyticsCardTitle}>Seasonality Trend — Last {years58.length} Years <InfoTip text="Average confirmed revenue per calendar month, averaged across all years of data — helps identify which months tend to be strong or weak so you can time appeals accordingly." /></div>
                    <div style={{ flex: 1, minHeight: 140 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={byMonth58} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} width={40} tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K` : `$${v}`} />
                        <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(value) => [`$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 'Avg revenue']} />
                        <Bar dataKey="avg" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                          {byMonth58.map((m, i) => (
                            <Cell key={i} fill={m.avg >= overallAvg58 * 1.15 ? C.sage : m.avg <= overallAvg58 * 0.7 ? C.red : C.borderStrong} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    </div>
                    <div style={{ display: 'flex', gap: 14, fontSize: 11, color: C.muted, marginTop: 8 }}>
                      <span><span style={{ display: 'inline-block', width: 8, height: 8, background: C.sage, borderRadius: 2, marginRight: 4 }} />Strong month</span>
                      <span><span style={{ display: 'inline-block', width: 8, height: 8, background: C.red, borderRadius: 2, marginRight: 4 }} />Weak month</span>
                    </div>
                  </div>
                  </DraggableCard>
                )
              })()}
              </div>
            </div>

            <div id="analytics-section-campaigns" style={{ marginBottom: 40, scrollMarginTop: 20, display: enabledModules.campaigns === false ? 'none' : undefined }}>
              <div style={s.sectionBand}>
                <span style={s.sectionBandLabel}>Campaign Performance</span>
                <CustomizeSectionButton sectionId="cp" cards={CAMPAIGN_PERFORMANCE_CARDS} hiddenDashboardCards={hiddenDashboardCards} toggleDashboardCard={toggleDashboardCard} resetDashboardSection={resetDashboardSection} setConfirmModal={setConfirmModal} />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>

              {!hidden('cp_snapshot') && (() => {
                const { yr, tiles } = campaignSnapshotStats
                return (
                  <DraggableCard sectionId="cp" cardKey="cp_snapshot" order={cardOrd('cp', CAMPAIGN_PERFORMANCE_CARDS, 'cp_snapshot')} flexBasis="100%" defaultOrder={CAMPAIGN_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ display: 'flex', gap: 12, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                    {tiles.map((t: any, i: any) => (
                      <div key={i} style={{ ...s.card, flex: 1, minWidth: isMobile ? 'calc(50% - 6px)' : 0 }}>
                        <div style={{ ...s.analyticsCardTitle, letterSpacing: 0.5, marginBottom: 6 }}>{t.label} <InfoTip text={t.tip} /></div>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>{t.val}</div>
                        {t.d === undefined ? null : t.d === null ? (
                          <div style={{ fontSize: 11, color: C.muted }}>no activity in {yr - 1} to compare</div>
                        ) : (
                          <div style={{ fontSize: 11, fontWeight: 500, color: t.d > 0 ? C.sage : t.d < 0 ? C.red : C.muted }}>
                            {t.d > 0 ? '▲' : t.d < 0 ? '▼' : '–'} {Math.abs(t.d)}% vs {yr - 1}
                          </div>
                        )}
                        {t.extra && <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>{t.extra}</div>}
                      </div>
                    ))}
                  </div>
                  </DraggableCard>
                )
              })()}

              {/* Disabled for now: too noisy with < 2 campaigns/year for a small charity. Re-enable by restoring the cp_goalStrip entry in CAMPAIGN_PERFORMANCE_CARDS and flipping this back to !hidden('cp_goalStrip'). */}
              {false && (() => {
                const { yr, strip } = campaignGoalStrip
                return (
                  <DraggableCard sectionId="cp" cardKey="cp_goalStrip" order={cardOrd('cp', CAMPAIGN_PERFORMANCE_CARDS, 'cp_goalStrip')} flexBasis="100%" defaultOrder={CAMPAIGN_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ display: 'flex', gap: 12, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                    {strip.map((t: any, i: any) => (
                      <div key={i} style={{ ...s.card, flex: 1, minWidth: isMobile ? 'calc(50% - 6px)' : 0 }}>
                        <div style={{ ...s.analyticsCardTitle, letterSpacing: 0.5, marginBottom: 6 }}>{t.label} <InfoTip text={t.tip} /></div>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>{t.val}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>{t.sub}</div>
                        {t.d !== null ? (
                          <div style={{ fontSize: 11, fontWeight: 500, color: (t.invert ? t.d <= 0 : t.d >= 0) ? C.sage : C.red }}>
                            {t.d > 0 ? '▲' : t.d < 0 ? '▼' : '–'} {Math.abs(t.d)}{t.unit} vs {yr - 1}
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: C.muted }}>no comparable data last year</div>
                        )}
                      </div>
                    ))}
                  </div>
                  </DraggableCard>
                )
              })()}

              {(() => {
                const { endingSoon, campaignRows, trendData, donorGrowthAgg, donorGrowthRows } = campaignLeaderboardStats

                return (
                  <>
                    {!hidden('cp_leaderboard') && endingSoon.length > 0 && (
                      <div style={{ flexBasis: '100%', display: 'flex', alignItems: 'center', gap: 8, background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: 4, padding: '10px 14px' }}>
                        <span style={{ fontSize: 12.5, color: C.warning }}>⏰ {endingSoon.length} campaign{endingSoon.length !== 1 ? 's' : ''} end{endingSoon.length === 1 ? 's' : ''} this week — {endingSoon.map((r: any) => `${r.title} (${r.daysToEnd}d)`).join(', ')}</span>
                      </div>
                    )}

                        {!hidden('cp_revenueTrend') && trendData.length >= 2 && (
                          <DraggableCard sectionId="cp" cardKey="cp_revenueTrend" order={cardOrd('cp', CAMPAIGN_PERFORMANCE_CARDS, 'cp_revenueTrend')} flexBasis="460px" defaultOrder={CAMPAIGN_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                          <div style={{ ...s.card, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                            <div style={s.analyticsCardTitle}>Campaign Revenue Trend — Last {trendData.length} Years <InfoTip text="Average amount raised per campaign that received at least one confirmed donation, by year. Normalizes for running more or fewer campaigns year to year." /></div>
                            <div style={{ flex: 1, minHeight: 130 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                                <XAxis dataKey="year" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} width={40} tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K` : `$${v}`} />
                                <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(value) => [`$${value.toLocaleString()}`, 'Avg per campaign']} />
                                <Bar dataKey="avgPerCampaign" fill={C.sage} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                              </BarChart>
                            </ResponsiveContainer>
                            </div>
                          </div>
                          </DraggableCard>
                        )}

                        {!hidden('cp_donorGrowth') && donorGrowthAgg && (() => {
                          const { aggTotal, aggOrganicPct, aggAppealPct, aggReferralPct, appealReliant, standoutOrganic, stagnant } = donorGrowthAgg
                          const mixSlices = [
                            { label: 'Organic', pct: aggOrganicPct, color: C.sage },
                            { label: 'Mass appeal', pct: aggAppealPct, color: C.gold },
                            { label: 'Referral', pct: aggReferralPct, color: C.muted },
                          ].filter(s => s.pct > 0)
                          return (
                          <DraggableCard sectionId="cp" cardKey="cp_donorGrowth" order={cardOrd('cp', CAMPAIGN_PERFORMANCE_CARDS, 'cp_donorGrowth')} flexBasis="460px" defaultOrder={CAMPAIGN_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                          <div style={{ ...s.card, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                            <div style={s.analyticsCardTitle}>Donor Growth & Funding Sources — {filterYear} <InfoTip text="Overall funding mix across all campaigns — organic giving, mass appeals (traced by PayNow reference), and referrals — plus callouts for campaigns that stand out: heavily appeal-reliant, fully organic new-donor wins, or stagnant with no new donors." /></div>

                            {aggTotal === 0 ? (
                              <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 16 }}>No campaign revenue yet.</div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
                                  {mixSlices.map((s2, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <div style={{ width: 9, height: 9, borderRadius: 2, background: s2.color, flexShrink: 0 }} />
                                      <span style={{ fontSize: 12.5, color: C.text, flex: 1 }}>{s2.label}</span>
                                      <span style={{ fontSize: 12.5, fontWeight: 700, color: C.forest }}>{s2.pct}%</span>
                                    </div>
                                  ))}
                                </div>
                                <ResponsiveContainer width={100} height={110}>
                                  <PieChart>
                                    <Pie data={mixSlices} dataKey="pct" nameKey="label" cx="50%" cy="50%" innerRadius={26} outerRadius={46} paddingAngle={2} isAnimationActive={false}>
                                      {mixSlices.map((s2, i) => <Cell key={i} fill={s2.color} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(value, name) => [`${value}%`, name]} />
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>
                            )}

                            {(appealReliant.length > 0 || standoutOrganic.length > 0 || stagnant.length > 0) && (
                            <>
                            <div style={{ ...s.analyticsSubTitle, color: C.muted }}>Notable</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {appealReliant.map((r: any, i: any) => (
                                <div key={`appeal-${i}`} style={{ padding: '10px 12px', background: C.warningBg, borderRadius: 4, border: `1px solid ${C.warningBorder}` }}>
                                  <div style={{ fontSize: 12.5, fontWeight: 500, color: C.warning }}>{r.title} is {r.appealPct}% reliant on a mass appeal</div>
                                  <div style={{ fontSize: 10.5, color: C.warning }}>{r.newPct}% new donors · without that appeal, this campaign would have raised far less on its own</div>
                                </div>
                              ))}
                              {standoutOrganic.map((r: any, i: any) => (
                                <div key={`organic-${i}`} style={{ padding: '10px 12px', background: C.successBg, borderRadius: 4, border: `1px solid ${C.border}` }}>
                                  <div style={{ fontSize: 12.5, fontWeight: 500, color: C.successText }}>{r.title} brought in {r.newCount} brand-new donor{r.newCount !== 1 ? 's' : ''}</div>
                                  <div style={{ fontSize: 10.5, color: C.successText }}>100% new, fully organic — no appeal or referral involved</div>
                                </div>
                              ))}
                              {stagnant.map((r: any, i: any) => (
                                <div key={`stagnant-${i}`} style={{ padding: '10px 12px', background: C.ivory, borderRadius: 4, border: `1px solid ${C.border}` }}>
                                  <div style={{ fontSize: 12.5, fontWeight: 500, color: C.text }}>{r.title} hasn't attracted any new donors</div>
                                  <div style={{ fontSize: 10.5, color: C.muted }}>All {r.existingCount} donor{r.existingCount !== 1 ? 's' : ''} had given before — worth a push to reach new supporters</div>
                                </div>
                              ))}
                            </div>
                            </>
                            )}
                          </div>
                          </DraggableCard>
                          )
                        })()}

                        {!hidden('cp_donorInsights') && donorGrowthRows.length > 0 && (() => {
                          const totalNew = donorGrowthRows.reduce((s: any, r: any) => s + r.newCount, 0)
                          const totalReturning = donorGrowthRows.reduce((s: any, r: any) => s + r.existingCount, 0)
                          const totalDonorsSum = totalNew + totalReturning
                          const pctNew = totalDonorsSum > 0 ? Math.round((totalNew / totalDonorsSum) * 100) : 0
                          const totalDonorsAcrossCampaigns = campaignRows.reduce((s: any, r: any) => s + r.donors, 0)
                          const avgDonorsPerCampaign = campaignRows.length > 0 ? totalDonorsAcrossCampaigns / campaignRows.length : 0
                          const costedRows = campaignRows.filter((r: any) => r.cost > 0)
                          const totalCostLogged = costedRows.reduce((s: any, r: any) => s + r.cost, 0)
                          const totalDonorsInCostedCampaigns = costedRows.reduce((s: any, r: any) => s + r.donors, 0)
                          const costPerDonor = totalDonorsInCostedCampaigns > 0 ? totalCostLogged / totalDonorsInCostedCampaigns : null
                          return (
                          <DraggableCard sectionId="cp" cardKey="cp_donorInsights" order={cardOrd('cp', CAMPAIGN_PERFORMANCE_CARDS, 'cp_donorInsights')} flexBasis="360px" defaultOrder={CAMPAIGN_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                          <div style={{ ...s.card, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                            <div style={s.analyticsCardTitle}>Donor Acquisition Insights — {filterYear} <InfoTip text="New vs returning donors across all campaigns, how many donors each campaign typically attracts, and the cost to acquire a donor where campaign cost is logged." /></div>
                            <div style={{ display: 'flex', gap: 20, marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
                              <div>
                                <div style={{ fontFamily: C.fontVoice, fontSize: 22, fontWeight: 500, color: C.sage, lineHeight: 1 }}>{totalNew}</div>
                                <div style={{ fontSize: 10.5, color: C.muted, marginTop: 4 }}>new donors</div>
                              </div>
                              <div>
                                <div style={{ fontFamily: C.fontVoice, fontSize: 22, fontWeight: 500, color: C.forest, lineHeight: 1 }}>{totalReturning}</div>
                                <div style={{ fontSize: 10.5, color: C.muted, marginTop: 4 }}>returning donors</div>
                              </div>
                              {totalDonorsSum > 0 && (
                                <div style={{ marginLeft: 'auto', alignSelf: 'center' }}>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: C.sage, background: C.successBg, padding: '4px 10px', borderRadius: 100 }}>{pctNew}% new</span>
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                              <div style={{ flex: 1, padding: '10px 12px', background: C.ivory, borderRadius: 4, textAlign: 'center' }}>
                                <div style={{ fontFamily: C.fontVoice, fontSize: 17, fontWeight: 500, color: C.forest }}>{avgDonorsPerCampaign.toFixed(1)}</div>
                                <div style={{ fontSize: 9.5, color: C.muted, marginTop: 2 }}>avg donors / campaign</div>
                              </div>
                              <div style={{ flex: 1, padding: '10px 12px', background: C.ivory, borderRadius: 4, textAlign: 'center' }}>
                                <div style={{ fontFamily: C.fontVoice, fontSize: 17, fontWeight: 500, color: C.forest }}>{costPerDonor !== null ? `$${costPerDonor.toFixed(0)}` : '—'}</div>
                                <div style={{ fontSize: 9.5, color: C.muted, marginTop: 2 }}>cost / donor acquired</div>
                              </div>
                            </div>
                            {costPerDonor === null && (
                              <div style={{ fontSize: 10, color: C.muted, marginTop: 8 }}>No campaigns with cost data logged yet</div>
                            )}
                          </div>
                          </DraggableCard>
                          )
                        })()}

                    {!hidden('cp_leaderboard') && (() => {
                      return (
                      <DraggableCard sectionId="cp" cardKey="cp_leaderboard" order={cardOrd('cp', CAMPAIGN_PERFORMANCE_CARDS, 'cp_leaderboard')} flexBasis="100%" defaultOrder={CAMPAIGN_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                      <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                          <div style={{ ...s.analyticsCardTitle, marginBottom: 0 }}>Campaign Leaderboard — {filterYear} <InfoTip text={`All campaigns launched this year, including ones that received no donations. Shows progress toward each campaign's goal where one has been set. ROI shown where cost is logged — ${campaignRows.filter((r: any) => r.cost > 0).length} of ${campaignRows.length} campaign${campaignRows.length !== 1 ? 's' : ''} have cost data. Click a row to view that campaign.`} /></div>
                          {campaignRows.length > 1 && (
                            <div style={{ display: 'flex', gap: 4, marginRight: 18 }}>
                              {([
                                ['raised', 'Total Raised'],
                                ['behind', 'Most Behind Pace'],
                                ['roi', 'Highest ROI'],
                                ['ending', 'Ending Soonest'],
                              ] as const).map(([key, label]) => (
                                <button
                                  key={key}
                                  onClick={() => setCampaignSort(key)}
                                  style={{
                                    fontSize: 10.5, fontWeight: 600, padding: '4px 9px', borderRadius: 100, cursor: 'pointer',
                                    border: `1px solid ${campaignSort === key ? C.forest : C.border}`,
                                    background: campaignSort === key ? C.forest : 'none',
                                    color: campaignSort === key ? C.white : C.muted,
                                  }}
                                >{label}</button>
                              ))}
                            </div>
                          )}
                        </div>
                        {campaignRows.length === 0 ? (
                          <div style={{ fontSize: 13, color: C.muted, padding: '8px 0' }}>No campaigns launched {filterYear !== 'All' ? `in ${filterYear}` : 'yet'}.</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[...campaignRows].sort((a: any, b: any) => {
                              if (campaignSort === 'behind') {
                                const g = (r: any) => r.hasGoal && !r.goalReached && r.pctElapsed !== null ? r.pctElapsed - r.pctToGoal : -Infinity
                                return g(b) - g(a)
                              }
                              if (campaignSort === 'roi') {
                                const r = (row: any) => row.cost > 0 ? row.total / row.cost : -Infinity
                                return r(b) - r(a)
                              }
                              if (campaignSort === 'ending') {
                                const e = (row: any) => row.hasGoal && row.daysToEnd !== null && row.daysToEnd >= 0 ? row.daysToEnd : Infinity
                                return e(a) - e(b)
                              }
                              return b.total - a.total
                            }).map((row: any, i: any) => {
                              const bg = row.behind ? C.dangerBg : row.slightlyBehind ? C.warningBg : row.hasGoal && row.goalReached ? C.successBg : C.ivory
                              const accentColor = row.behind ? C.red : row.slightlyBehind ? C.gold : row.hasGoal && row.goalReached ? C.successText : C.forest
                              const barColor = row.behind ? C.red : row.slightlyBehind ? C.gold : C.sage
                              let statusText = null
                              if (row.hasGoal) {
                                if (row.goalReached) statusText = 'goal reached'
                                else if (row.behind) statusText = 'behind pace'
                                else if (row.slightlyBehind) statusText = 'slightly behind'
                                else statusText = 'on pace'
                              }
                              return (
                                <div key={i} style={{ padding: '12px 14px', background: bg, borderRadius: 4, border: `1px solid ${C.border}`, cursor: 'pointer' }} onClick={() => { setCampaignSearchTerm(row.title); setCampaignYearFilter('All'); setActiveTab('promotions') }}>
                                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-start', gap: isMobile ? 10 : 0, marginBottom: row.hasGoal ? 8 : 2 }}>
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontSize: 13, fontWeight: 700, color: accentColor, marginBottom: 2 }}>{i + 1}. {row.title}</div>
                                      <div style={{ fontSize: 10.5, color: C.muted }}>{row.count === 0 ? 'No donations yet' : `${row.count} donation${row.count > 1 ? 's' : ''} · ${row.donors} donor${row.donors > 1 ? 's' : ''} · avg $${row.avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 16, flexShrink: 0, marginLeft: isMobile ? 0 : 16 }}>
                                      <div style={isMobile ? {} : { textAlign: 'right' }}>
                                        <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Total Raised</div>
                                        <div style={{ fontFamily: C.fontVoice, fontSize: 20, fontWeight: 500, color: C.forest, lineHeight: 1 }}>${row.total.toLocaleString()}</div>
                                      </div>
                                      {row.cost > 0 && (
                                        <div style={isMobile ? {} : { textAlign: 'right' }}>
                                          <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>ROI</div>
                                          <div style={{ fontFamily: C.fontVoice, fontSize: 20, fontWeight: 500, color: C.sage, lineHeight: 1 }}>{(row.total / row.cost).toFixed(1)}×</div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {row.hasGoal && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <div style={{ flex: 1, background: 'rgba(0,0,0,0.08)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                                        <div style={{ width: `${Math.min(100, row.pctToGoal)}%`, height: '100%', background: barColor }} />
                                      </div>
                                      <span style={{ fontSize: 10.5, color: accentColor, fontWeight: 500, whiteSpace: 'nowrap' }}>
                                        {row.pctToGoal}% of goal · {row.daysToEnd >= 0 ? `ends in ${row.daysToEnd}d` : 'ended'} · {statusText}
                                      </span>
                                    </div>
                                  )}
                                  {row.appealSummary ? (
                                    <div style={{ marginTop: 8 }}>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 100, padding: '4px 10px', fontSize: 11, color: C.text }}
                                        onClick={e => { e.stopPropagation(); setActiveTab('promotions') }}
                                      >
                                        📣 <b style={{ color: C.forest }}>{row.appealSummary.count} appeal{row.appealSummary.count !== 1 ? 's' : ''} sent</b> · {new Date(row.appealSummary.lastSentDate).toLocaleDateString('en-SG', { month: 'short', year: 'numeric' })} · {row.appealSummary.converted} of {row.appealSummary.recipients} converted
                                      </span>
                                    </div>
                                  ) : row.behind ? (
                                    <div style={{ fontSize: 10.5, color: C.gold, fontWeight: 500, marginTop: 8 }}>⚠ No appeal sent yet — consider one given it's behind pace</div>
                                  ) : null}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                      </DraggableCard>
                      )
                    })()}
                  </>
                )
              })()}
              </div>
            </div>

            <div id="analytics-section-massappeals" style={{ marginBottom: 40, scrollMarginTop: 20, display: 'none' }}>
              <div style={s.sectionBand}>
                <span style={s.sectionBandLabel}>Mass Appeals</span>
                <CustomizeSectionButton sectionId="ma" cards={MASS_APPEALS_CARDS} hiddenDashboardCards={hiddenDashboardCards} toggleDashboardCard={toggleDashboardCard} resetDashboardSection={resetDashboardSection} setConfirmModal={setConfirmModal} />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>

              {!hidden('ma_snapshot') && (() => {
                const { yr, tiles } = appealSnapshotStats
                return (
                  <DraggableCard sectionId="ma" cardKey="ma_snapshot" order={cardOrd('ma', MASS_APPEALS_CARDS, 'ma_snapshot')} flexBasis="100%" defaultOrder={MASS_APPEALS_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ display: 'flex', gap: 12, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                    {tiles.map((t: any, i: any) => (
                      <div key={i} style={{ ...s.card, flex: 1, minWidth: isMobile ? 'calc(50% - 6px)' : 0 }}>
                        <div style={{ ...s.analyticsCardTitle, letterSpacing: 0.5, marginBottom: 6 }}>{t.label} <InfoTip text={t.tip} /></div>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>{t.val}</div>
                        {t.d === undefined ? null : t.d === null ? (
                          <div style={{ fontSize: 11, color: C.muted }}>no activity in {yr - 1} to compare</div>
                        ) : (
                          <div style={{ fontSize: 11, fontWeight: 500, color: t.d > 0 ? C.sage : t.d < 0 ? C.red : C.muted }}>
                            {t.d > 0 ? '▲' : t.d < 0 ? '▼' : '–'} {Math.abs(t.d)}% vs {yr - 1}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  </DraggableCard>
                )
              })()}

              {!hidden('ma_listStrip') && (() => {
                const { yr, strip } = appealListStrip
                return (
                  <DraggableCard sectionId="ma" cardKey="ma_listStrip" order={cardOrd('ma', MASS_APPEALS_CARDS, 'ma_listStrip')} flexBasis="100%" defaultOrder={MASS_APPEALS_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ display: 'flex', gap: 12, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                    {strip.map((t: any, i: any) => (
                      <div key={i} style={{ ...s.card, flex: 1, minWidth: isMobile ? 'calc(50% - 6px)' : 0 }}>
                        <div style={{ ...s.analyticsCardTitle, letterSpacing: 0.5, marginBottom: 6 }}>{t.label} <InfoTip text={t.tip} /></div>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>{t.val}</div>
                        {t.d !== undefined ? (
                          t.d === null ? (
                            <div style={{ fontSize: 11, color: C.muted }}>no activity in {yr - 1} to compare</div>
                          ) : (
                            <div style={{ fontSize: 11, fontWeight: 500, color: t.d > 0 ? C.sage : t.d < 0 ? C.red : C.muted }}>
                              {t.d > 0 ? '▲' : t.d < 0 ? '▼' : '–'} {Math.abs(t.d)}% vs {yr - 1}
                            </div>
                          )
                        ) : (
                          t.sub && <div style={{ fontSize: 11, color: C.muted }}>{t.sub}</div>
                        )}
                      </div>
                    ))}
                  </div>
                  </DraggableCard>
                )
              })()}

              {(() => {
                const { trendData, yr } = appealTrendStats

                return (
                  <>
                    {!hidden('ma_appealsTrend') && trendData.length >= 2 && (
                      <DraggableCard sectionId="ma" cardKey="ma_appealsTrend" order={cardOrd('ma', MASS_APPEALS_CARDS, 'ma_appealsTrend')} flexBasis="460px" defaultOrder={MASS_APPEALS_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                      <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                        <div style={s.analyticsCardTitle}>Appeals Trend — Last {trendData.length} Years <InfoTip text="Total raised from mass appeals per year, so you can see the long-term trajectory rather than just this year vs last year." /></div>
                        <div style={{ flex: 1, minHeight: 130 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                            <XAxis dataKey="year" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} width={40} tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K` : `$${v}`} />
                            <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(value) => [`$${value.toLocaleString()}`, 'Raised']} />
                            <Bar dataKey="raised" fill={C.sage} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                          </BarChart>
                        </ResponsiveContainer>
                        </div>
                        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>Total raised from appeals, by year.</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, marginTop: 12, paddingTop: 12 }}>
                          <span style={{ fontSize: 11, color: C.muted }}>Conversion rate trend</span>
                          <span style={{ fontSize: 11, color: C.text }}>{trendData.map((d: any) => d.conversionRate !== null ? `${d.conversionRate}%` : '—').join(' → ')}</span>
                        </div>
                      </div>
                      </DraggableCard>
                    )}

                  </>
                )
              })()}

                {!hidden('ma_conversion') && (() => {
                  const { yearNum, scopedAppeals, lastYearAppeals, scopedAnalyzed, totalRaised, overallConversion, appealCountDiff, conversionDiff, lastYearRaised, lastYearConversion, causeSpecificAvg, generalAvg, distinctAmounts } = appealConversionStats

                  return (
                    <DraggableCard sectionId="ma" cardKey="ma_conversion" order={cardOrd('ma', MASS_APPEALS_CARDS, 'ma_conversion')} flexBasis="460px" defaultOrder={MASS_APPEALS_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                    <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                      <div style={s.analyticsCardTitle}>Mass Appeal Conversion — {filterYear} <InfoTip text="Matches appeal recipients to actual donations by PayNow reference to show which appeals converted into real gifts. Only donations made using the QR code sent in the appeal are counted." /></div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Appeals sent</div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                            <span style={s.analyticsStatNumber}>{scopedAppeals.length}</span>
                            {lastYearAppeals.length > 0 && <span style={{ fontSize: 10.5, fontWeight: 500, color: appealCountDiff >= 0 ? C.sage : C.red }}>{appealCountDiff === 0 ? '—' : appealCountDiff > 0 ? `↑${appealCountDiff}` : `↓${Math.abs(appealCountDiff)}`}</span>}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Raised</div>
                          <div style={s.analyticsStatNumber}>${totalRaised.toLocaleString()}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Conversion</div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                            <span style={{ ...s.analyticsStatNumber, color: overallConversion >= 25 ? C.sage : overallConversion >= 15 ? C.gold : C.red }}>{overallConversion}%</span>
                            {conversionDiff !== null && <span style={{ fontSize: 10.5, fontWeight: 500, color: conversionDiff >= 0 ? C.sage : C.red }}>{conversionDiff === 0 ? '—' : conversionDiff > 0 ? `↑${conversionDiff}pt` : `↓${Math.abs(conversionDiff)}pt`}</span>}
                          </div>
                        </div>
                      </div>
                      {lastYearAppeals.length > 0 && (
                        <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 14 }}>{yearNum - 1}: {lastYearAppeals.length} appeal{lastYearAppeals.length !== 1 ? 's' : ''} · ${lastYearRaised.toLocaleString()} raised{lastYearConversion !== null ? ` · ${lastYearConversion}% conversion` : ''}</div>
                      )}

                      {scopedAnalyzed.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: C.muted, borderTop: `1px dashed ${C.border}`, paddingTop: 14 }}>No appeals sent {filterYear !== 'All' ? `in ${filterYear}` : 'yet'}.</div>
                      ) : (
                        <>
                          <div style={s.analyticsSubTitleDivider}>Appeal-by-appeal conversion</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                            {[...scopedAnalyzed].sort((a, b) => b.conversionRate - a.conversionRate).map((a, i) => {
                              const isSending = a.appeal.status === 'sending'
                              const bg = a.conversionRate >= 25 ? C.successBg : a.conversionRate >= 15 ? C.warningBg : C.ivory
                              const textColor = a.conversionRate >= 25 ? C.successText : a.conversionRate >= 15 ? C.warningTextStrong : C.text
                              return (
                                <div key={i} style={{ padding: '8px 10px', background: bg, borderRadius: 4 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                    <span style={{ fontSize: 12, fontWeight: 500, color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>{a.appeal.cause_name || 'General Appeal'}</span>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: textColor }}>{a.conversionRate}% · {a.convertedCount}/{a.sentCount} · ${a.raised.toLocaleString()}{isSending ? ' (sending)' : ''}</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          <div style={s.analyticsSubTitle}>Cause-specific vs. general</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: causeSpecificAvg !== null || generalAvg !== null ? 18 : 0 }}>
                            {causeSpecificAvg !== null && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.ivory, borderRadius: 4 }}>
                                <span style={{ fontSize: 12, color: C.text }}>Cause-specific appeals</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: C.forest }}>{causeSpecificAvg}% avg conversion</span>
                              </div>
                            )}
                            {generalAvg !== null && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.ivory, borderRadius: 4 }}>
                                <span style={{ fontSize: 12, color: C.text }}>General appeals</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>{generalAvg}% avg conversion</span>
                              </div>
                            )}
                          </div>

                          <div style={s.analyticsSubTitle}>Ask amount vs. conversion</div>
                          {distinctAmounts.length < 2 ? (
                            <div style={{ fontSize: 11.5, color: C.muted, fontStyle: 'italic' }}>Only {scopedAnalyzed.filter((a: any) => a.sentCount > 0).length} appeal{scopedAnalyzed.filter((a: any) => a.sentCount > 0).length !== 1 ? 's' : ''} so far — not enough spread in ask amounts yet to show a reliable pattern.</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {distinctAmounts.sort((a: any, b: any) => a - b).map((amt: any, i: any) => {
                                const matching = scopedAnalyzed.filter((a: any) => Number(a.appeal.amount) === amt && a.sentCount > 0)
                                const avgConv = Math.round(matching.reduce((s: any, a: any) => s + a.conversionRate, 0) / matching.length)
                                return (
                                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.ivory, borderRadius: 4 }}>
                                    <span style={{ fontSize: 12, color: C.text }}>${amt} ask</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: C.forest }}>{avgConv}% avg conversion</span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </>
                      )}
                      {scopedAppeals.length > 0 && (
                        overallConversion >= 25 ? (
                          <ActionBanner tone="success" text="Strong conversion" sub="Appeals are converting well" />
                        ) : overallConversion >= 15 ? (
                          <ActionBanner tone="warning" text="Moderate conversion" sub="Room to improve messaging, targeting, or ask amount" />
                        ) : (
                          <ActionBanner tone="danger" text="Low conversion" sub="Worth revisiting ask amount, messaging, or list quality" />
                        )
                      )}
                    </div>
                    </DraggableCard>
                  )
                })()}

                {!hidden('ma_listHealth') && (() => {
                  const { curDelivery, prevDelivery, bounceReasons, repeatRecipients, fatigueList, overGivers, fatiguedCount } = appealListHealthStats
                  const ptDelta = (c: any, p: any) => prevDelivery.total === 0 ? null : c - p

                  return (
                    <DraggableCard sectionId="ma" cardKey="ma_listHealth" order={cardOrd('ma', MASS_APPEALS_CARDS, 'ma_listHealth')} flexBasis="460px" defaultOrder={MASS_APPEALS_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                    <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                      <div style={s.analyticsCardTitle}>Appeal List Health <InfoTip text="Bounces are bad contact data — the message couldn't be delivered. Opt-outs are donors who actively blocked appeals — a stewardship signal, not a data problem." /></div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Bounced</div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                            <span style={{ ...s.analyticsStatNumber, color: curDelivery.bouncedPct >= 20 ? C.red : curDelivery.bouncedPct >= 10 ? C.gold : C.forest }}>{curDelivery.bouncedPct}%</span>
                            {ptDelta(curDelivery.bouncedPct, prevDelivery.bouncedPct) !== null && (
                              <span style={{ fontSize: 10.5, fontWeight: 500, color: ptDelta(curDelivery.bouncedPct, prevDelivery.bouncedPct) <= 0 ? C.sage : C.red }}>
                                {ptDelta(curDelivery.bouncedPct, prevDelivery.bouncedPct) === 0 ? '—' : ptDelta(curDelivery.bouncedPct, prevDelivery.bouncedPct) > 0 ? `▲${ptDelta(curDelivery.bouncedPct, prevDelivery.bouncedPct)}pt` : `▼${Math.abs(ptDelta(curDelivery.bouncedPct, prevDelivery.bouncedPct))}pt`}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>bad contact data</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Opted Out</div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                            <span style={{ ...s.analyticsStatNumber, color: curDelivery.blockedPct >= 20 ? C.red : curDelivery.blockedPct >= 10 ? C.gold : C.forest }}>{curDelivery.blockedPct}%</span>
                            {ptDelta(curDelivery.blockedPct, prevDelivery.blockedPct) !== null && (
                              <span style={{ fontSize: 10.5, fontWeight: 500, color: ptDelta(curDelivery.blockedPct, prevDelivery.blockedPct) <= 0 ? C.sage : C.red }}>
                                {ptDelta(curDelivery.blockedPct, prevDelivery.blockedPct) === 0 ? '—' : ptDelta(curDelivery.blockedPct, prevDelivery.blockedPct) > 0 ? `▲${ptDelta(curDelivery.blockedPct, prevDelivery.blockedPct)}pt` : `▼${Math.abs(ptDelta(curDelivery.blockedPct, prevDelivery.blockedPct))}pt`}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>donors who blocked appeals</div>
                        </div>
                      </div>

                      {bounceReasons.length > 0 && (
                        <>
                          <div style={s.analyticsSubTitleDivider}>Top bounce reasons</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                            {(showAllBounceReasons ? bounceReasons : bounceReasons.slice(0, 5)).map((r: any, i: any) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.ivory, borderRadius: 4 }}>
                                <span style={{ fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{r.reason}</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: C.forest }}>{r.count}</span>
                              </div>
                            ))}
                            {bounceReasons.length > 5 && (
                              <button style={{ fontSize: 11, color: C.muted, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, marginTop: 2 }} onClick={() => setShowAllBounceReasons(v => !v)}>
                                {showAllBounceReasons ? 'Show fewer' : `Show all ${bounceReasons.length}`}
                              </button>
                            )}
                          </div>
                        </>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Repeat recipients</div>
                          <div style={s.analyticsStatNumber}>{repeatRecipients.length}</div>
                          <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>received 2+ appeals</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>List Fatigue</div>
                          <div style={{ ...s.analyticsStatNumber, color: fatiguedCount > 0 ? C.gold : C.forest }}>{fatiguedCount}</div>
                          <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>gave before, skipped last appeal</div>
                        </div>
                      </div>

                      <div style={s.analyticsSubTitleDivider}>Response pattern among repeat recipients</div>
                      {fatigueList.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 18 }}>No donors have received more than one appeal yet.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                          {(showAllFatigueList ? fatigueList : fatigueList.slice(0, 5)).map((d: any, i: any) => (
                            <div key={i} style={{ padding: '8px 10px', background: d.isFatigued ? C.dangerBg : C.ivory, borderRadius: 4, cursor: 'pointer' }} onClick={() => { setSelectedDonor(findDonorRecord(d.email, d.name)); setActiveTab('donors') }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <span style={{ fontSize: 12.5, fontWeight: 500, color: d.isFatigued ? C.red : C.forest }}>{d.name}</span>
                                <span style={{ fontSize: 11, color: d.isFatigued ? C.red : C.muted }}>{d.isFatigued ? `gave earlier, skipped most recent` : `gave ${d.gaveCount} of ${d.totalAppeals} sent`}</span>
                              </div>
                            </div>
                          ))}
                          {fatigueList.length > 5 && (
                            <button style={{ fontSize: 11, color: C.muted, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, marginTop: 2 }} onClick={() => setShowAllFatigueList(v => !v)}>
                              {showAllFatigueList ? 'Show fewer' : `Show all ${fatigueList.length}`}
                            </button>
                          )}
                        </div>
                      )}

                      <div style={s.analyticsSubTitle}>Donors who gave more than asked</div>
                      {overGivers.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: C.muted }}>No standout over-gifts from appeal recipients yet.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {(showAllOverGivers ? overGivers : overGivers.slice(0, 5)).map((d: any, i: any) => (
                            <div key={i} style={{ padding: '8px 10px', background: C.ivory, borderRadius: 4, display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => { setSelectedDonor(findDonorRecord(d.email, d.name)); setActiveTab('donors') }}>
                              <span style={{ fontSize: 12.5, fontWeight: 500, color: C.forest }}>{d.name}</span>
                              <span style={{ fontSize: 11, color: C.muted }}>asked ${d.asked} · gave ${d.gave}</span>
                            </div>
                          ))}
                          {overGivers.length > 5 && (
                            <button style={{ fontSize: 11, color: C.muted, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, marginTop: 2 }} onClick={() => setShowAllOverGivers(v => !v)}>
                              {showAllOverGivers ? 'Show fewer' : `Show all ${overGivers.length}`}
                            </button>
                          )}
                        </div>
                      )}
                      {(() => {
                        const bounceHigh = curDelivery.bouncedPct >= 20 || curDelivery.blockedPct >= 20
                        const bounceMed = !bounceHigh && (curDelivery.bouncedPct >= 10 || curDelivery.blockedPct >= 10)
                        return curDelivery.total === 0 ? null : bounceHigh ? (
                          <ActionBanner tone="danger" text="List health needs attention" sub="High bounce or opt-out rate — clean up contact data before your next appeal" />
                        ) : bounceMed ? (
                          <ActionBanner tone="warning" text="List health worth watching" sub="Bounce or opt-out rate is creeping up" />
                        ) : (
                          <ActionBanner tone="success" text="List healthy" sub="Low bounce and opt-out rates" />
                        )
                      })()}
                    </div>
                    </DraggableCard>
                  )
                })()}
              </div>
            </div>

            <div id="analytics-section-pledges" style={{ marginBottom: 40, scrollMarginTop: 20, display: enabledModules.pledges === false ? 'none' : undefined }}>
              <div style={s.sectionBand}>
                <span style={s.sectionBandLabel}>Pledge Performance</span>
                <CustomizeSectionButton sectionId="pp" cards={PLEDGE_PERFORMANCE_CARDS} hiddenDashboardCards={hiddenDashboardCards} toggleDashboardCard={toggleDashboardCard} resetDashboardSection={resetDashboardSection} setConfirmModal={setConfirmModal} />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>

              {!hidden('pp_snapshot') && (() => {
                const { yr, tiles } = pledgeSnapshotStats
                const { overdueUnits, overdueTotal, avgPledgeSize, avgDelta } = pledgeStatsAndTrend
                const [pledgesMadeTile, amountPledgedTile] = tiles
                const genericTile = (t: any) => (
                  <div key={t.label} style={{ ...s.card, flex: 1, minWidth: isMobile ? 'calc(50% - 6px)' : 0 }}>
                    <div style={{ ...s.analyticsCardTitle, letterSpacing: 0.5, marginBottom: 6 }}>{t.label} <InfoTip text={t.tip} /></div>
                    <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>{t.val}</div>
                    {t.d === null ? (
                      <div style={{ fontSize: 11, color: C.muted }}>no activity in {yr - 1} to compare</div>
                    ) : (
                      <div style={{ fontSize: 11, fontWeight: 500, color: t.d > 0 ? C.sage : t.d < 0 ? C.red : C.muted }}>
                        {t.d > 0 ? '▲' : t.d < 0 ? '▼' : '–'} {Math.abs(t.d)}% vs {yr - 1}
                      </div>
                    )}
                  </div>
                )
                return (
                  <DraggableCard sectionId="pp" cardKey="pp_snapshot" order={cardOrd('pp', PLEDGE_PERFORMANCE_CARDS, 'pp_snapshot')} flexBasis="100%" defaultOrder={PLEDGE_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ display: 'flex', gap: 12, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                      {genericTile(amountPledgedTile)}
                      {genericTile(pledgesMadeTile)}
                      <div style={{ ...s.card, flex: 1, minWidth: isMobile ? 'calc(50% - 6px)' : 0 }}>
                        <div style={{ ...s.analyticsCardTitle, letterSpacing: 0.5, marginBottom: 6 }}>Currently Overdue <InfoTip text="Pending pledges (or unpaid instalments of multi-year pledges) whose expected date has already passed. Not gated by any threshold — this counts every overdue pledge." /></div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 6 }}>
                          {overdueUnits.length > 0 && <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>}
                          <span style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1 }}>{overdueUnits.length} <span style={{ fontSize: 15, fontWeight: 400, color: C.muted }}>· ${overdueTotal.toLocaleString()}</span></span>
                        </div>
                        <div style={{ fontSize: 11, color: C.muted }}>pending pledges past their due date</div>
                      </div>
                      <div style={{ ...s.card, flex: 1, minWidth: isMobile ? 'calc(50% - 6px)' : 0 }}>
                        <div style={{ ...s.analyticsCardTitle, letterSpacing: 0.5, marginBottom: 6 }}>Avg Pledge Size <InfoTip text={`Average pledge amount among pledges expected in ${yr}, compared to ${yr - 1}.`} /></div>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>${avgPledgeSize.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        {avgDelta === null ? (
                          <div style={{ fontSize: 11, color: C.muted }}>no activity in {yr - 1} to compare</div>
                        ) : (
                          <div style={{ fontSize: 11, fontWeight: 500, color: avgDelta > 0 ? C.sage : avgDelta < 0 ? C.red : C.muted }}>
                            {avgDelta > 0 ? '▲' : avgDelta < 0 ? '▼' : '–'} {Math.abs(avgDelta)}% vs {yr - 1}
                          </div>
                        )}
                      </div>
                  </div>
                  </DraggableCard>
                )
              })()}

              {(() => {
                const { yr, trendData, newPledgeValue, cancelledPledgeValue, netPledgeValue, newVsCancelledTrend } = pledgeStatsAndTrend

                return (
                  <>
                    {!hidden('pp_revenueTrend') && trendData.length >= 2 && (
                      <DraggableCard sectionId="pp" cardKey="pp_revenueTrend" order={cardOrd('pp', PLEDGE_PERFORMANCE_CARDS, 'pp_revenueTrend')} flexBasis="360px" defaultOrder={PLEDGE_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                      <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                        <div style={s.analyticsCardTitle}>Pledge Revenue Trend — Last {trendData.length} Years <InfoTip text="Total value of pledges expected per year, by the pledge's expected date." /></div>
                        <div style={{ flex: 1, minHeight: 130 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                            <XAxis dataKey="year" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} width={40} tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K` : `$${v}`} />
                            <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(value) => [`$${value.toLocaleString()}`, 'Pledged']} />
                            <Bar dataKey="pledged" fill={C.sage} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                          </BarChart>
                        </ResponsiveContainer>
                        </div>
                      </div>
                      </DraggableCard>
                    )}

                    {!hidden('pp_fulfillmentTrend') && trendData.length >= 2 && (() => {
                      const rateData = trendData.map((t: any) => ({ ...t, rate: t.pledged > 0 ? Math.round((t.fulfilled / t.pledged) * 100) : 0 }))
                      return (
                      <DraggableCard sectionId="pp" cardKey="pp_fulfillmentTrend" order={cardOrd('pp', PLEDGE_PERFORMANCE_CARDS, 'pp_fulfillmentTrend')} flexBasis="360px" defaultOrder={PLEDGE_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                      <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                        <div style={s.analyticsCardTitle}>Pledge Fulfillment Rate — Last {trendData.length} Years <InfoTip text="Share of each year's pledged value that's been fulfilled. The current year is still in progress, so its rate will look lower until it closes out." /></div>
                        <div style={{ flex: 1, minHeight: 130 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={rateData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                            <XAxis dataKey="year" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} width={34} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                            <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(value, name, entry: any) => [`${value}% ($${entry.payload.fulfilled.toLocaleString()} of $${entry.payload.pledged.toLocaleString()})`, 'Fulfilled']} />
                            <Line type="monotone" dataKey="rate" stroke={C.sage} strokeWidth={2.5} dot={{ fill: C.sage, r: 4 }} isAnimationActive={false} />
                          </LineChart>
                        </ResponsiveContainer>
                        </div>
                      </div>
                      </DraggableCard>
                      )
                    })()}

                    {!hidden('pp_newVsCancelled') && (
                    <DraggableCard sectionId="pp" cardKey="pp_newVsCancelled" order={cardOrd('pp', PLEDGE_PERFORMANCE_CARDS, 'pp_newVsCancelled')} flexBasis="460px" defaultOrder={PLEDGE_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                    <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                      <div style={s.analyticsCardTitle}>New vs Cancelled Pledges — {yr} <InfoTip text="Tracks fresh pledging activity, not the expected-revenue pipeline shown in the tiles above. New pledges made is scoped by when the pledge was recorded (created date) — a pulse check on new commitments coming in this year. Cancelled value is scoped by the pledge's expected year (pledges don't track a cancellation date), matching the Cancellation Rate tile above. Chart above shows the same split across recent years." /></div>
                      {newVsCancelledTrend.length >= 2 && (
                        <ResponsiveContainer width="100%" height={110}>
                          <BarChart data={newVsCancelledTrend.map((t: any) => ({ ...t, cancelledNeg: -t.cancelledValue }))} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                            <XAxis dataKey="year" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} width={40} tickFormatter={v => `$${Math.abs(v) >= 1000 ? (Math.abs(v) / 1000).toFixed(Math.abs(v) % 1000 === 0 ? 0 : 1) + 'K' : Math.abs(v)}`} />
                            <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(value, name) => [`$${Math.abs(Number(value)).toLocaleString()}`, name === 'newValue' ? 'New pledges made' : 'Cancelled']} />
                            <Bar dataKey="newValue" fill={C.sage} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                            <Bar dataKey="cancelledNeg" fill={C.red} radius={[0, 0, 4, 4]} isAnimationActive={false} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.successBg, borderRadius: 4 }}>
                          <span style={{ fontSize: 12, color: C.successText }}>+ New pledges made this year</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: C.successText }}>${Math.round(newPledgeValue).toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.dangerBg, borderRadius: 4 }}>
                          <span style={{ fontSize: 12, color: C.red }}>− Cancelled pledges</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: C.red }}>${Math.round(cancelledPledgeValue).toLocaleString()}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: `1px solid ${C.border}`, paddingTop: 10, marginBottom: 14 }}>
                        <span style={{ fontSize: 11.5, color: C.muted }}>Net pledge value</span>
                        <span style={{ fontFamily: C.fontVoice, fontSize: 20, fontWeight: 500, color: netPledgeValue >= 0 ? C.sage : C.red }}>{netPledgeValue >= 0 ? '+' : '−'}${Math.abs(Math.round(netPledgeValue)).toLocaleString()}</span>
                      </div>
                    </div>
                    </DraggableCard>
                    )}
                  </>
                )
              })()}

              {!hidden('pp_reliability') && (() => {
                const { fulfilledWithDates, onTimeGroup, slightlyLateGroup, veryLateGroup, watchList } = pledgeReliabilityStats
                const { overdueUnits } = pledgeStatsAndTrend
                const { donorRanked } = pledgeConcentrationStats
                const onTimeAmt = onTimeGroup.reduce((s: any, f: any) => s + Number(f.pledge.amount), 0)
                const slightlyLateAmt = slightlyLateGroup.reduce((s: any, f: any) => s + Number(f.pledge.amount), 0)
                const veryLateAmt = veryLateGroup.reduce((s: any, f: any) => s + Number(f.pledge.amount), 0)
                const onTimePct = fulfilledWithDates.length > 0 ? Math.round((onTimeGroup.length / fulfilledWithDates.length) * 100) : 0
                const slightlyLatePct = fulfilledWithDates.length > 0 ? Math.round((slightlyLateGroup.length / fulfilledWithDates.length) * 100) : 0
                const veryLatePct = fulfilledWithDates.length > 0 ? Math.round((veryLateGroup.length / fulfilledWithDates.length) * 100) : 0

                return (
                  <>
                  {(fulfilledWithDates.length > 0 || donorRanked.length > 0) && (
                  <DraggableCard sectionId="pp" cardKey="pp_timing" order={cardOrd('pp', PLEDGE_PERFORMANCE_CARDS, 'pp_timing')} flexBasis="460px" defaultOrder={PLEDGE_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ ...s.card, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                    <div style={s.analyticsCardTitle}>Pledge Reliability & Concentration <InfoTip text="How punctual fulfilled pledges have been, pooled across the last 4 fiscal years, and your largest outstanding pledges by value." /></div>

                    {fulfilledWithDates.length > 0 && (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.gold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Fulfilled pledges — last 4 years: how late did they run?</div>
                        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 22, marginBottom: 8 }}>
                          {onTimePct > 0 && <div style={{ width: `${onTimePct}%`, background: C.sage, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{onTimePct >= 12 && <span style={{ fontSize: 10.5, fontWeight: 700, color: C.white }}>{onTimePct}%</span>}</div>}
                          {slightlyLatePct > 0 && <div style={{ width: `${slightlyLatePct}%`, background: C.forest, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{slightlyLatePct >= 12 && <span style={{ fontSize: 10.5, fontWeight: 700, color: C.white }}>{slightlyLatePct}%</span>}</div>}
                          {veryLatePct > 0 && <div style={{ width: `${veryLatePct}%`, background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{veryLatePct >= 12 && <span style={{ fontSize: 9, fontWeight: 700, color: C.white }}>{veryLatePct}%</span>}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 12, fontSize: 10.5, color: C.muted, flexWrap: 'wrap', marginBottom: 14 }}>
                          <span><span style={{ display: 'inline-block', width: 9, height: 9, background: C.sage, borderRadius: 2, marginRight: 5 }} />On time or early ({onTimeGroup.length} · ${onTimeAmt.toLocaleString()})</span>
                          <span><span style={{ display: 'inline-block', width: 9, height: 9, background: C.forest, borderRadius: 2, marginRight: 5 }} />1–14 days late ({slightlyLateGroup.length} · ${slightlyLateAmt.toLocaleString()})</span>
                          {veryLateGroup.length > 0 && (
                            <span><span style={{ display: 'inline-block', width: 9, height: 9, background: C.gold, borderRadius: 2, marginRight: 5 }} />15+ days late ({veryLateGroup.length} · ${veryLateAmt.toLocaleString()})</span>
                          )}
                        </div>
                      </>
                    )}

                    {donorRanked.length > 0 && (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.forest, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, borderTop: `1px dashed ${C.border}`, paddingTop: 14 }}>Largest outstanding pledges</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {(showAllPledgeConcentration ? donorRanked : donorRanked.slice(0, 5)).map((d: any, i: any) => (
                            <div key={i} style={{ cursor: 'pointer' }} onClick={() => { setPledgeSearchTerm(d.name); setPledgeUrgencyFilter('All'); setPledgeAmountFilter('All'); setPledgeYearFilter('All'); setPledgeTypeFilter('All'); setPledgeProgrammeFilter('All'); setActiveTab('pledges') }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                                <span style={{ color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{d.name}</span>
                                <span style={{ fontWeight: 600, color: C.forest }}>${d.amount.toLocaleString()} · {d.pct}%</span>
                              </div>
                              <div style={{ background: C.ivoryDark, borderRadius: 3, height: 6, overflow: 'hidden' }}>
                                <div style={{ width: `${Math.max(4, d.pct)}%`, height: '100%', background: i === 0 ? C.red : i === 1 ? C.gold : C.sage }} />
                              </div>
                            </div>
                          ))}
                          {donorRanked.length > 5 && (
                            <button style={{ fontSize: 11, color: C.muted, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, marginTop: 2 }} onClick={() => setShowAllPledgeConcentration(v => !v)}>
                              {showAllPledgeConcentration ? 'Show fewer' : `Show all ${donorRanked.length}`}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  </DraggableCard>
                  )}

                  {false && (
                  <DraggableCard sectionId="pp" cardKey="pp_reliability" order={cardOrd('pp', PLEDGE_PERFORMANCE_CARDS, 'pp_reliability')} flexBasis="460px" defaultOrder={PLEDGE_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                    <div style={s.analyticsCardTitle}>Pledge Reliability — {filterYear} <InfoTip text="Which pledges are currently overdue, and which donors have a pattern of broken or overdue pledges. Totals and on-time rate are shown in the tiles above." /></div>

                    <div style={{ fontSize: 11, fontWeight: 600, color: C.red, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Currently overdue</div>
                    {overdueUnits.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 18 }}>No overdue pledges right now.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                        {(showAllOverdueUnits ? overdueUnits : overdueUnits.slice(0, 5)).map((u: any, i: any) => (
                          <div key={i} style={{ padding: '9px 11px', background: C.dangerBg, borderRadius: 4, cursor: 'pointer' }} onClick={() => { setPledgeSearchTerm(u.donor_name); setPledgeUrgencyFilter('All'); setPledgeAmountFilter('All'); setPledgeYearFilter('All'); setPledgeTypeFilter('All'); setPledgeProgrammeFilter('All'); setActiveTab('pledges') }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 12.5, fontWeight: 500, color: C.red }}>{u.donor_name}</span>
                              <span style={{ fontSize: 12, fontWeight: 500, color: C.red }}>${u.amount.toLocaleString()}</span>
                            </div>
                            <div style={{ fontSize: 10.5, color: C.red }}>{u.daysOverdue} day{u.daysOverdue !== 1 ? 's' : ''} overdue</div>
                          </div>
                        ))}
                        {overdueUnits.length > 5 && (
                          <button style={{ fontSize: 11, color: C.muted, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, marginTop: 2 }} onClick={() => setShowAllOverdueUnits(v => !v)}>
                            {showAllOverdueUnits ? 'Show fewer' : `Show all ${overdueUnits.length}`}
                          </button>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderTop: `1px dashed ${C.border}`, paddingTop: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.gold, textTransform: 'uppercase', letterSpacing: 0.5 }}>Donors worth watching</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 10.5, color: C.muted }}>Flagged after {pledgeWatchThreshold} broken pledge{pledgeWatchThreshold !== 1 ? 's' : ''}</span>
                        <AdjustInSettingsLink setActiveTab={setActiveTab} setSettingsSection={setSettingsSection} />
                      </div>
                    </div>
                    {watchList.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: C.muted }}>No donors currently meet this threshold.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(showAllPledgeWatchlist ? watchList : watchList.slice(0, 5)).map((d: any, i: any) => (
                          <div key={i} style={{ padding: '10px 12px', background: d.overdueNow.length > 0 ? C.dangerBg : C.ivory, borderRadius: 4, cursor: 'pointer' }} onClick={() => { setPledgeSearchTerm(d.name); setPledgeUrgencyFilter('All'); setPledgeAmountFilter('All'); setPledgeYearFilter('All'); setPledgeTypeFilter('All'); setPledgeProgrammeFilter('All'); setActiveTab('pledges') }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                              <span style={{ fontSize: 12.5, fontWeight: 500, color: d.overdueNow.length > 0 ? C.red : C.forest }}>{d.name}{d.overdueNow.length > 0 ? ' — overdue now' : ''}</span>
                              <span style={{ fontSize: 11, color: d.overdueNow.length > 0 ? C.red : C.muted }}>{d.pledges.length} pledge{d.pledges.length !== 1 ? 's' : ''}, {d.brokenCount} broken · ${d.broken.reduce((s: any, p: any) => s + Number(p.amount), 0).toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                        {watchList.length > 5 && (
                          <button style={{ fontSize: 11, color: C.muted, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, marginTop: 2 }} onClick={() => setShowAllPledgeWatchlist(v => !v)}>
                            {showAllPledgeWatchlist ? 'Show fewer' : `Show all ${watchList.length}`}
                          </button>
                        )}
                      </div>
                    )}
                    {watchList.length > 0 ? (
                      <ActionBanner tone="danger" text={`${watchList.length} donor${watchList.length !== 1 ? 's' : ''} worth watching`} sub="A pattern of broken or overdue pledges — worth a conversation before the next ask" />
                    ) : (
                      <ActionBanner tone="success" text="No donors flagged" sub="No one currently meets your broken-pledge threshold" />
                    )}
                  </div>
                  </DraggableCard>
                  )}
                  </>
                )
              })()}

              {!hidden('pp_concentration') && (() => {
                const { donorRanked, topDonorPct, highRisk, medRisk, tooFewDonors, monthsRanked, heaviestMonth } = pledgeConcentrationStats

                return (
                  <DraggableCard sectionId="pp" cardKey="pp_concentration" order={cardOrd('pp', PLEDGE_PERFORMANCE_CARDS, 'pp_concentration')} flexBasis="460px" defaultOrder={PLEDGE_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                    <div style={s.analyticsCardTitle}>Pledge Concentration <InfoTip text="Share of outstanding pledge value tied to your single largest donor. Multi-year pledges are counted by their remaining unpaid instalments, not their full multi-year total." /></div>

                    {tooFewDonors ? (
                      <div style={{ fontSize: 12.5, color: C.muted }}>Too few outstanding pledges to assess concentration yet.</div>
                    ) : (
                      <>
                        <div style={{ ...s.analyticsStatNumber, color: highRisk ? C.red : medRisk ? C.gold : C.forest, marginBottom: 4 }}>{topDonorPct}%</div>
                        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>of outstanding pledge value from your single largest pledge</div>
                        <div style={{ background: C.ivoryDark, borderRadius: 3, height: 6, overflow: 'hidden', marginBottom: 6 }}>
                          <div style={{ width: `${topDonorPct}%`, height: '100%', background: highRisk ? C.red : medRisk ? C.gold : C.sage, borderRadius: 3 }} />
                        </div>
                      </>
                    )}
                    {!tooFewDonors && (highRisk ? (
                      <ActionBanner tone="danger" text="High pledge concentration" sub="Prioritise diversifying who you're asking for pledges" />
                    ) : medRisk ? (
                      <ActionBanner tone="warning" text="Moderate pledge concentration" sub="Worth watching as your pledge portfolio grows" />
                    ) : (
                      <ActionBanner tone="success" text="Well diversified" sub="No single donor dominates your outstanding pledges" />
                    ))}
                  </div>
                  </DraggableCard>
                )
              })()}

              {!hidden('pp_monthlyTiming') && (() => {
                const { monthsRanked, heaviestMonth } = pledgeConcentrationStats
                return (
                  <DraggableCard sectionId="pp" cardKey="pp_monthlyTiming" order={cardOrd('pp', PLEDGE_PERFORMANCE_CARDS, 'pp_monthlyTiming')} flexBasis="460px" defaultOrder={PLEDGE_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                    <div style={s.analyticsCardTitle}>Outstanding Pledges by Month <InfoTip text="Which months carry an unusually large share of expected pledge income. Multi-year pledges are counted by their remaining unpaid instalments, not their full multi-year total." /></div>
                    {monthsRanked.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: C.muted }}>No outstanding pledges right now.</div>
                    ) : (
                      <>
                        <div style={{ flex: 1, minHeight: 130 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthsRanked} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                            <XAxis dataKey="label" tick={{ fontSize: 9.5, fill: C.muted }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} width={40} tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K` : `$${v}`} />
                            <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(value, name, entry: any) => [`$${Number(value).toLocaleString()} (${entry.payload.count} pledge${entry.payload.count !== 1 ? 's' : ''})`, 'Outstanding']} />
                            <Bar dataKey="amount" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                              {monthsRanked.map((m: any, i: any) => (
                                <Cell key={i} fill={heaviestMonth && m.label === heaviestMonth.label && monthsRanked.length > 1 ? C.gold : C.ivoryDark} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        </div>
                        {heaviestMonth && monthsRanked.length > 1 && (
                          <div style={{ fontSize: 11, color: C.warning, marginTop: 8 }}>⚠ {heaviestMonth.label} is heaviest — ${heaviestMonth.amount.toLocaleString()} across {heaviestMonth.count} pledge{heaviestMonth.count !== 1 ? 's' : ''}, worth confirming these are on track</div>
                        )}
                      </>
                    )}
                  </div>
                  </DraggableCard>
                )
              })()}
              </div>

              </div>

            <div id="analytics-section-recurring" style={{ marginBottom: 40, scrollMarginTop: 20, display: enabledModules.recurring === false ? 'none' : undefined }}>
              <div style={s.sectionBand}>
                <span style={s.sectionBandLabel}>Recurring Donations Performance</span>
                <CustomizeSectionButton sectionId="rc" cards={RECURRING_PERFORMANCE_CARDS} hiddenDashboardCards={hiddenDashboardCards} toggleDashboardCard={toggleDashboardCard} resetDashboardSection={resetDashboardSection} setConfirmModal={setConfirmModal} />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>

              {(!hidden('rc_snapshot') || !hidden('rc_healthTiles')) && (() => {
                const { yr, tiles } = recurringSnapshotStats
                const { mrr, mrrDiffPct, retentionRate } = recurringHealthStats
                const snapshotTiles = hidden('rc_snapshot') ? [] : tiles
                return (
                  <DraggableCard sectionId="rc" cardKey="rc_snapshot" order={cardOrd('rc', RECURRING_PERFORMANCE_CARDS, 'rc_snapshot')} flexBasis="100%" defaultOrder={RECURRING_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ display: 'flex', gap: 12, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                    {snapshotTiles.map((t: any, i: any) => (
                      <div key={i} style={{ ...s.card, flex: 1, minWidth: isMobile ? 'calc(50% - 6px)' : 0 }}>
                        <div style={{ ...s.analyticsCardTitle, letterSpacing: 0.5, marginBottom: 6 }}>{t.label} <InfoTip text={t.tip} /></div>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>{t.val}</div>
                        {t.d === undefined ? null : t.d === null ? (
                          <div style={{ fontSize: 11, color: C.muted }}>no activity in {yr - 1} to compare</div>
                        ) : (
                          <div style={{ fontSize: 11, fontWeight: 500, color: t.d > 0 ? C.sage : t.d < 0 ? C.red : C.muted }}>
                            {t.d > 0 ? '▲' : t.d < 0 ? '▼' : '–'} {Math.abs(t.d)}% vs {yr - 1}
                          </div>
                        )}
                      </div>
                    ))}
                    {!hidden('rc_healthTiles') && (
                    <div style={{ ...s.card, flex: 1, minWidth: isMobile ? 'calc(50% - 6px)' : 0 }}>
                      <div style={{ ...s.analyticsCardTitle, letterSpacing: 0.5, marginBottom: 6 }}>MRR <InfoTip text="Total monthly recurring revenue from currently active GIRO and habitual PayNow gifts, compared to 90 days ago." /></div>
                      <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>${Math.round(mrr).toLocaleString()}</div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: mrrDiffPct === null ? C.muted : mrrDiffPct >= 0 ? C.sage : C.red }}>{mrrDiffPct !== null ? `${mrrDiffPct >= 0 ? '▲' : '▼'} ${Math.abs(mrrDiffPct)}% vs 90 days ago` : 'vs 90 days ago'}</div>
                    </div>
                    )}
                    {!hidden('rc_healthTiles') && (
                    <div style={{ ...s.card, flex: 1, minWidth: isMobile ? 'calc(50% - 6px)' : 0 }}>
                      <div style={{ ...s.analyticsCardTitle, letterSpacing: 0.5, marginBottom: 6 }}>Retention rate <InfoTip text="Share of recurring gifts that were active a year ago and are still active today." /></div>
                      <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, lineHeight: 1, marginBottom: 6, color: retentionRate === null ? C.forest : retentionRate >= 80 ? C.sage : retentionRate >= 60 ? C.gold : C.red }}>{retentionRate !== null ? `${retentionRate}%` : '—'}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>vs a year ago</div>
                    </div>
                    )}
                  </div>
                  </DraggableCard>
                )
              })()}

              {(() => {
                const { trendData } = recurringMrrStats
                const { byProgrammeRows, byTypeRows } = recurringCompositionStats

                return (
                  <>
                    {!hidden('rc_revenueTrend') && trendData.length >= 2 && (
                      <DraggableCard sectionId="rc" cardKey="rc_revenueTrend" order={cardOrd('rc', RECURRING_PERFORMANCE_CARDS, 'rc_revenueTrend')} flexBasis="460px" defaultOrder={RECURRING_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                      <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                        <div style={s.analyticsCardTitle}>Recurring Revenue Trend — Last {trendData.length} Years <InfoTip text="Monthly recurring revenue as of December each year, based on which gifts were active at that point. Shows the long-term trajectory of your recurring program." /></div>
                        <div style={{ flex: 1, minHeight: 140 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                            <XAxis dataKey="year" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} width={40} tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K` : `$${v}`} />
                            <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(value) => [`$${value.toLocaleString()}`, 'MRR']} />
                            <Bar dataKey="mrr" fill={C.sage} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                          </BarChart>
                        </ResponsiveContainer>
                        </div>
                        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>Monthly recurring revenue as of December each year.</div>
                      </div>
                      </DraggableCard>
                    )}

                    {!hidden('rc_composition') && (
                    <DraggableCard sectionId="rc" cardKey="rc_composition" order={cardOrd('rc', RECURRING_PERFORMANCE_CARDS, 'rc_composition')} flexBasis="460px" defaultOrder={RECURRING_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                    <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                      <div style={s.analyticsCardTitle}>Revenue Composition <InfoTip text="Active recurring revenue broken down by linked programme and by payment type." /></div>
                      <div style={s.analyticsSubTitleDivider}>By programme</div>
                      {byProgrammeRows.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 14 }}>No active recurring gifts yet.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                          {byProgrammeRows.map((r: any, i: any) => (
                            <div key={i}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                <span style={{ fontSize: 12, color: C.text, flex: 1 }}>{r.title}</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: C.forest }}>{r.pct}%</span>
                                <span style={{ fontSize: 11, color: C.muted, minWidth: 65, textAlign: 'right' }}>${r.amount.toLocaleString()}</span>
                              </div>
                              <div style={{ background: C.ivoryDark, borderRadius: 3, height: 5, overflow: 'hidden' }}>
                                <div style={{ width: `${r.pct}%`, height: '100%', background: [C.forest, C.sage, C.gold, C.teal, C.muted][i % 5] }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={s.analyticsSubTitleDivider}>By type</div>
                      {byTypeRows.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: C.muted }}>No active recurring gifts yet.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {byTypeRows.map((r: any, i: any) => (
                            <div key={i}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                <span style={{ fontSize: 12, color: C.text, flex: 1 }}>{r.label}</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: C.forest }}>{r.pct}%</span>
                                <span style={{ fontSize: 11, color: C.muted, minWidth: 65, textAlign: 'right' }}>${r.amount.toLocaleString()}</span>
                              </div>
                              <div style={{ background: C.ivoryDark, borderRadius: 3, height: 5, overflow: 'hidden' }}>
                                <div style={{ width: `${r.pct}%`, height: '100%', background: [C.forest, C.sage, C.gold, C.teal, C.muted][i % 5] }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    </DraggableCard>
                    )}
                  </>
                )
              })()}

                {!hidden('rc_newVsChurned') && (() => {
                  const { yr, newMrr, churnedMrr, netMrr } = recurringMrrStats

                  return (
                    <DraggableCard sectionId="rc" cardKey="rc_newVsChurned" order={cardOrd('rc', RECURRING_PERFORMANCE_CARDS, 'rc_newVsChurned')} flexBasis="460px" defaultOrder={RECURRING_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                    <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                      <div style={s.analyticsCardTitle}>New vs Churned MRR — {yr} <InfoTip text="How much monthly recurring revenue was added by new recurring gifts this year, vs lost to cancellations, netting to the change in MRR." /></div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.successBg, borderRadius: 4 }}>
                          <span style={{ fontSize: 12, color: C.successText }}>+ New MRR added</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: C.successText }}>${Math.round(newMrr).toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.dangerBg, borderRadius: 4 }}>
                          <span style={{ fontSize: 12, color: C.red }}>− Churned MRR lost</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: C.red }}>${Math.round(churnedMrr).toLocaleString()}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: `1px solid ${C.border}`, paddingTop: 10, marginBottom: 14 }}>
                        <span style={{ fontSize: 11.5, color: C.muted }}>Net MRR change</span>
                        <span style={{ fontFamily: C.fontVoice, fontSize: 20, fontWeight: 500, color: netMrr >= 0 ? C.sage : C.red }}>{netMrr >= 0 ? '+' : '−'}${Math.abs(Math.round(netMrr)).toLocaleString()}</span>
                      </div>
                      {netMrr >= 0 ? (
                        <ActionBanner tone="success" text="Net MRR growing" sub={`New recurring gifts are outpacing churn so far in ${yr}`} />
                      ) : (
                        <ActionBanner tone="danger" text="Net MRR shrinking" sub="Churn is outpacing new recurring gifts — worth investigating why donors are cancelling" />
                      )}
                    </div>
                    </DraggableCard>
                  )
                })()}

                {!hidden('rc_givingTrend') && (() => {
                  const { trendFlagsFiltered, upgrades, downgrades } = recurringHealthStats

                  return (
                    <DraggableCard sectionId="rc" cardKey="rc_givingTrend" order={cardOrd('rc', RECURRING_PERFORMANCE_CARDS, 'rc_givingTrend')} flexBasis="460px" defaultOrder={RECURRING_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                    <div id="giving-trend-card-analytics" style={{ ...s.card, scrollMarginTop: 20 }}>
                      <div style={s.analyticsCardTitle}>Giving Trend <InfoTip text="Donors whose recurring giving has consistently increased or decreased over recent cycles." /></div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingTop: 2 }}>
                        <div style={s.analyticsSubTitle}>Sustained upgrades &amp; downgrades</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 10.5, color: C.muted }}>Flagged after {recurringTrendCycles} cycles</span>
                          <AdjustInSettingsLink setActiveTab={setActiveTab} setSettingsSection={setSettingsSection} />
                        </div>
                      </div>
                      {trendFlagsFiltered.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: C.muted }}>No sustained upgrade or downgrade patterns right now.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {[...upgrades, ...downgrades].slice(0, 5).map((f, i) => (
                            <div key={i} style={{ padding: '8px 10px', background: f.direction === 'upgrade' ? C.successBg : C.dangerBg, borderRadius: 4, cursor: 'pointer' }} onClick={() => { setRecurringSearchTerm(f.donor_name); setRecurringUrgencyFilter('All'); setRecurringAmountFilter('All'); setRecurringTypeFilter('All'); setRecurringYearFilter('All'); setRecurringProgrammeFilter('All'); setRecurringAuthFilter('All'); setActiveTab('recurring') }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <span style={{ fontSize: 12.5, fontWeight: 500, color: f.direction === 'upgrade' ? C.successText : C.dangerTextStrong }}>{f.donor_name}</span>
                                <span style={{ fontSize: 11.5, fontWeight: 600, color: f.direction === 'upgrade' ? C.successText : C.dangerTextStrong }}>{f.direction === 'upgrade' ? '↑' : '↓'} ${f.from} → ${f.to}</span>
                              </div>
                              <div style={{ fontSize: 11, color: f.direction === 'upgrade' ? C.successText : C.dangerTextStrong, marginTop: 2 }}>{recurringTrendCycles} consecutive cycles {f.direction === 'upgrade' ? 'increasing' : 'decreasing'}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {downgrades.length > 0 ? (
                        <ActionBanner tone="danger" text={`${downgrades.length} donor${downgrades.length !== 1 ? 's' : ''} trending down`} sub="Worth a check-in before the pattern turns into a cancellation" />
                      ) : (
                        <ActionBanner tone="success" text="No sustained downgrades" sub={upgrades.length > 0 ? `${upgrades.length} donor${upgrades.length !== 1 ? 's' : ''} trending up instead` : 'Recurring giving is holding steady'} />
                      )}
                    </div>
                    </DraggableCard>
                  )
                })()}

                {!hidden('rc_authRisk') && (() => {
                  const { pendingCount, authorizedCount, terminatedCount, terminatedGifts, terminatedMrr } = recurringAuthStats

                  return (
                    <DraggableCard sectionId="rc" cardKey="rc_authRisk" order={cardOrd('rc', RECURRING_PERFORMANCE_CARDS, 'rc_authRisk')} flexBasis="460px" defaultOrder={RECURRING_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                    <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                      <div style={s.analyticsCardTitle}>Authorization & Mandate Risk <InfoTip text="GIRO and Standing Order gifts by bank authorization status. A terminated mandate means the bank has cut off the deduction — the donor needs to be contacted to re-authorize, or the gift will keep silently failing." /></div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Pending</div>
                          <div style={{ ...s.analyticsStatNumber, color: C.gold }}>{pendingCount}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Authorized</div>
                          <div style={{ ...s.analyticsStatNumber, color: C.sage }}>{authorizedCount}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Terminated</div>
                          <div style={{ ...s.analyticsStatNumber, color: C.red }}>{terminatedCount}</div>
                        </div>
                      </div>
                      <div style={s.analyticsSubTitleDivider}>Terminated by bank — needs follow-up</div>
                      {terminatedGifts.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: C.muted }}>None right now.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {terminatedGifts.slice(0, 5).map((g: any, i: any) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.dangerBg, borderRadius: 4, cursor: 'pointer' }} onClick={() => { setRecurringSearchTerm(g.donor_name); setRecurringUrgencyFilter('All'); setRecurringAmountFilter('All'); setRecurringTypeFilter('All'); setRecurringYearFilter('All'); setRecurringProgrammeFilter('All'); setRecurringAuthFilter('All'); setActiveTab('recurring') }}>
                              <span style={{ fontSize: 12.5, fontWeight: 500, color: C.forest }}>{g.donor_name}{g.bank_name ? ` · ${g.bank_name}` : ''}</span>
                              <span style={{ fontSize: 11.5, color: C.red }}>${Number(g.amount).toLocaleString()}/{({ weekly: 'wk', monthly: 'mo', quarterly: 'qtr', annually: 'yr' } as Record<string, string>)[g.frequency] || 'mo'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {terminatedCount > 0 ? (
                        <ActionBanner tone="danger" text={`${terminatedCount} mandate${terminatedCount !== 1 ? 's' : ''} terminated`} sub={`~$${Math.round(terminatedMrr).toLocaleString()} MRR at risk — contact donors to re-authorize`} />
                      ) : (
                        <ActionBanner tone="success" text="All bank mandates in good standing" sub="No terminated authorizations right now" />
                      )}
                    </div>
                    </DraggableCard>
                  )
                })()}

                {!hidden('rc_giftRisk') && (() => {
                  const { missedFiltered, frequentSkippers, endingSoon, pausedGifts } = recurringRiskStats
                  const today = new Date()

                  return (
                    <DraggableCard sectionId="rc" cardKey="rc_giftRisk" order={cardOrd('rc', RECURRING_PERFORMANCE_CARDS, 'rc_giftRisk')} flexBasis="460px" defaultOrder={RECURRING_PERFORMANCE_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                    <div id="recurring-gift-risk-card-analytics" style={{ ...s.card, scrollMarginTop: 20 }}>
                      <div style={s.analyticsCardTitle}>Recurring Gift Risk <InfoTip text="Everything that needs a human decision: missed payments, gifts ending soon, currently paused gifts, donors who frequently skip, and manual gifts that look recurring but aren't tagged as one." /></div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={s.analyticsSubTitle}>Missed payments</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 10.5, color: C.muted }}>Flagged after {recurringMissedThreshold} cycle{recurringMissedThreshold !== 1 ? 's' : ''}</span>
                          <AdjustInSettingsLink setActiveTab={setActiveTab} setSettingsSection={setSettingsSection} />
                        </div>
                      </div>
                      {missedFiltered.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 14 }}>No missed recurring payments right now.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                          {(showAllMissedPayments ? missedFiltered : missedFiltered.slice(0, 5)).map((g: any, i: any) => {
                            const fullGift = recurringGifts.find(rg => rg.id === g.gift_id)
                            return (
                              <div key={i} style={{ padding: '8px 10px', background: g.missedCycles >= 2 ? C.dangerBg : C.warningBg, borderRadius: 4, cursor: 'pointer' }} onClick={() => { setRecurringSearchTerm(g.donor_name); setRecurringUrgencyFilter('All'); setRecurringAmountFilter('All'); setRecurringTypeFilter('All'); setRecurringYearFilter('All'); setRecurringProgrammeFilter('All'); setRecurringAuthFilter('All'); setActiveTab('recurring') }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                  <span style={{ fontSize: 12.5, fontWeight: 500, color: g.missedCycles >= 2 ? C.red : C.warning }}>
                                    {g.donor_name}
                                    {g.type && <span style={{ fontSize: 9.5, fontWeight: 500, background: C.white, color: C.muted, padding: '1px 6px', borderRadius: 3, marginLeft: 6, textTransform: 'uppercase' }}>{g.type === 'giro' ? 'GIRO' : 'PayNow'}</span>}
                                  </span>
                                  <span style={{ fontSize: 11.5, color: g.missedCycles >= 2 ? C.red : C.warning }}>{g.missedCycles} cycle{g.missedCycles !== 1 ? 's' : ''} missed{g.missedCycles >= 2 ? ' — possible cancellation' : ''}</span>
                                </div>
                                <div style={{ fontSize: 11, color: g.missedCycles >= 2 ? C.red : C.warning, marginTop: 2 }}>{fullGift?.donor_phone ? `Call ${fullGift.donor_phone}` : 'No phone on file — email only'}</div>
                              </div>
                            )
                          })}
                          {missedFiltered.length > 5 && (
                            <button style={{ fontSize: 11, color: C.muted, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, marginTop: 2 }} onClick={() => setShowAllMissedPayments(v => !v)}>
                              {showAllMissedPayments ? 'Show fewer' : `Show all ${missedFiltered.length}`}
                            </button>
                          )}
                        </div>
                      )}

                      <div style={s.analyticsSubTitleDivider}>Ending within 6 months</div>
                      {endingSoon.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 14 }}>No active gifts with an end date in the next 6 months.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                          {(showAllEndingSoon ? endingSoon : endingSoon.slice(0, 5)).map((g: any, i: any) => {
                            const monthsOut = Math.round((new Date(g.end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
                            return (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.warningBg, borderRadius: 4, cursor: 'pointer' }} onClick={() => { setRecurringSearchTerm(g.donor_name); setRecurringUrgencyFilter('All'); setRecurringAmountFilter('All'); setRecurringTypeFilter('All'); setRecurringYearFilter('All'); setRecurringProgrammeFilter('All'); setRecurringAuthFilter('All'); setActiveTab('recurring') }}>
                                <span style={{ fontSize: 12.5, fontWeight: 500, color: C.forest }}>{g.donor_name}</span>
                                <span style={{ fontSize: 11.5, color: C.warning }}>ends in {monthsOut} mo</span>
                              </div>
                            )
                          })}
                          {endingSoon.length > 5 && (
                            <button style={{ fontSize: 11, color: C.muted, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, marginTop: 2 }} onClick={() => setShowAllEndingSoon(v => !v)}>
                              {showAllEndingSoon ? 'Show fewer' : `Show all ${endingSoon.length}`}
                            </button>
                          )}
                        </div>
                      )}

                      <div style={s.analyticsSubTitleDivider}>Currently paused ({pausedGifts.length})</div>
                      {pausedGifts.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 14 }}>No paused gifts right now.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                          {(showAllPausedGifts ? pausedGifts : pausedGifts.slice(0, 5)).map((g: any, i: any) => (
                            <div key={i} style={{ padding: '8px 10px', background: C.ivory, borderRadius: 4, cursor: 'pointer' }} onClick={() => { setRecurringSearchTerm(g.donor_name); setRecurringUrgencyFilter('All'); setRecurringAmountFilter('All'); setRecurringTypeFilter('All'); setRecurringYearFilter('All'); setRecurringProgrammeFilter('All'); setRecurringAuthFilter('All'); setActiveTab('recurring') }}>
                              <span style={{ fontSize: 12.5, fontWeight: 500, color: C.forest }}>{g.donor_name}</span>
                              <span style={{ fontSize: 11.5, color: C.muted }}>{g.pause_reason ? ` — ${g.pause_reason}` : ''}{g.pause_resume_date ? ` · resume ${new Date(g.pause_resume_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}` : ''}</span>
                            </div>
                          ))}
                          {pausedGifts.length > 5 && (
                            <button style={{ fontSize: 11, color: C.muted, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, marginTop: 2 }} onClick={() => setShowAllPausedGifts(v => !v)}>
                              {showAllPausedGifts ? 'Show fewer' : `Show all ${pausedGifts.length}`}
                            </button>
                          )}
                        </div>
                      )}

                      <div style={s.analyticsSubTitleDivider}>Frequent skippers</div>
                      {frequentSkippers.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 14 }}>No donors have skipped 2+ cycles this year.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                          {(showAllFrequentSkippers ? frequentSkippers : frequentSkippers.slice(0, 5)).map((g: any, i: any) => (
                            <div key={i} style={{ padding: '8px 10px', background: C.ivory, borderRadius: 4, cursor: 'pointer' }} onClick={() => { setRecurringSearchTerm(g.donor_name); setRecurringUrgencyFilter('All'); setRecurringAmountFilter('All'); setRecurringTypeFilter('All'); setRecurringYearFilter('All'); setRecurringProgrammeFilter('All'); setRecurringAuthFilter('All'); setActiveTab('recurring') }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <span style={{ fontSize: 12.5, fontWeight: 500, color: C.forest }}>
                                  {g.donor_name}
                                  {g.type && <span style={{ fontSize: 9.5, fontWeight: 500, background: C.white, color: C.muted, padding: '1px 6px', borderRadius: 3, marginLeft: 6, textTransform: 'uppercase' }}>{g.type === 'giro' ? 'GIRO' : 'PayNow'}</span>}
                                </span>
                                <span style={{ fontSize: 11, color: C.muted }}>{g.skipCount} cycles skipped</span>
                              </div>
                            </div>
                          ))}
                          {frequentSkippers.length > 5 && (
                            <button style={{ fontSize: 11, color: C.muted, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, marginTop: 2 }} onClick={() => setShowAllFrequentSkippers(v => !v)}>
                              {showAllFrequentSkippers ? 'Show fewer' : `Show all ${frequentSkippers.length}`}
                            </button>
                          )}
                        </div>
                      )}

                      {(missedFiltered.length > 0 || frequentSkippers.length > 0 || endingSoon.length > 0) ? (
                        <ActionBanner tone="danger" text={`${missedFiltered.length + frequentSkippers.length + endingSoon.length} donor${(missedFiltered.length + frequentSkippers.length + endingSoon.length) !== 1 ? 's' : ''} need follow-up`} sub="A missed GIRO cycle usually means a bank authorization issue; PayNow is often just forgetfulness" />
                      ) : (
                        <ActionBanner tone="success" text="No risk signals right now" sub="No missed payments, expiring gifts, or frequent skippers" />
                      )}
                    </div>
                    </DraggableCard>
                  )
                })()}
              </div>
            </div>

            <div id="analytics-section-grants" style={{ marginBottom: 40, scrollMarginTop: 20, display: enabledModules.grants === false ? 'none' : undefined }}>
              <div style={s.sectionBand}>
                <span style={s.sectionBandLabel}>Grants Overview</span>
                <CustomizeSectionButton sectionId="gr" cards={GRANTS_OVERVIEW_CARDS} hiddenDashboardCards={hiddenDashboardCards} toggleDashboardCard={toggleDashboardCard} resetDashboardSection={resetDashboardSection} setConfirmModal={setConfirmModal} />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>

              {!hidden('gr_snapshot') && (() => {
                const { yr, tiles } = grantSnapshotStats
                return (
                  <DraggableCard sectionId="gr" cardKey="gr_snapshot" order={cardOrd('gr', GRANTS_OVERVIEW_CARDS, 'gr_snapshot')} flexBasis="100%" defaultOrder={GRANTS_OVERVIEW_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ display: 'flex', gap: 12, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                    {tiles.map((t: any, i: any) => (
                      <div key={i} style={{ ...s.card, flex: 1, minWidth: isMobile ? 'calc(50% - 6px)' : 0 }}>
                        <div style={{ ...s.analyticsCardTitle, letterSpacing: 0.5, marginBottom: 6 }}>{t.label} <InfoTip text={t.tip} /></div>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>{t.val}</div>
                        {t.d === undefined ? (
                          <div style={{ fontSize: 11, color: C.muted }}>currently active</div>
                        ) : t.d === null ? (
                          <div style={{ fontSize: 11, color: C.muted }}>no activity in {yr - 1} to compare</div>
                        ) : (
                          <div style={{ fontSize: 11, fontWeight: 500, color: t.d > 0 ? C.sage : t.d < 0 ? C.red : C.muted }}>
                            {t.d > 0 ? '▲' : t.d < 0 ? '▼' : '–'} {Math.abs(t.d)}% vs {yr - 1}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  </DraggableCard>
                )
              })()}

              {(() => {
                const { trendData, funderTypeBreakdown, expenseByCategory, restrictedTotal, unrestrictedTotal, restrictedPct } = grantOverviewStats
                return (
                  <>
                    {!hidden('gr_trend') && trendData.length >= 2 && (
                      <DraggableCard sectionId="gr" cardKey="gr_trend" order={cardOrd('gr', GRANTS_OVERVIEW_CARDS, 'gr_trend')} flexBasis="360px" defaultOrder={GRANTS_OVERVIEW_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                      <div style={{ ...s.card, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <div style={s.analyticsCardTitle}>Grants Trend — Last {trendData.length} Years <InfoTip text="Total grant funding secured per year, based on the grant's start date. Shows the long-term trajectory of your grant funding, not just this year vs last." /></div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <ResponsiveContainer width="100%" height={140}>
                            <BarChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                              <XAxis dataKey="year" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} width={40} tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K` : `$${v}`} />
                              <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(value) => [`$${value.toLocaleString()}`, 'Secured']} />
                              <Bar dataKey="total" fill={C.sage} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      </DraggableCard>
                    )}

                    {!hidden('gr_spendingByCategory') && (
                    <DraggableCard sectionId="gr" cardKey="gr_spendingByCategory" order={cardOrd('gr', GRANTS_OVERVIEW_CARDS, 'gr_spendingByCategory')} flexBasis="360px" defaultOrder={GRANTS_OVERVIEW_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                    <div style={{ ...s.card, height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <div style={s.analyticsCardTitle}>Spending by Category <InfoTip text="How grant expenses logged against active grants break down by category — useful for showing funders and auditors how much went to programme delivery versus overhead." /></div>
                      {expenseByCategory.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: C.muted }}>No expenses logged against active grants yet.</div>
                      ) : (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <ResponsiveContainer width="100%" height={110}>
                            <PieChart>
                              <Pie data={expenseByCategory} dataKey="amount" nameKey="label" cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={2} isAnimationActive={false}>
                                {expenseByCategory.map((c: any, i: any) => (
                                  <Cell key={i} fill={[C.forest, C.sage, C.gold, C.teal, C.muted][i % 5]} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(value, name) => [`$${Number(value).toLocaleString()}`, name]} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                            {expenseByCategory.map((c: any, i: any) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 9, height: 9, borderRadius: 2, background: [C.forest, C.sage, C.gold, C.teal, C.muted][i % 5], flexShrink: 0 }} />
                                <span style={{ fontSize: 12, color: C.text, flex: 1 }}>{c.label}</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: C.forest }}>{c.pct}%</span>
                                <span style={{ fontSize: 11, color: C.muted, minWidth: 65, textAlign: 'right' }}>${c.amount.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    </DraggableCard>
                    )}

                    {!hidden('gr_fundingComposition') && (
                    <DraggableCard sectionId="gr" cardKey="gr_fundingComposition" order={cardOrd('gr', GRANTS_OVERVIEW_CARDS, 'gr_fundingComposition')} flexBasis="360px" defaultOrder={GRANTS_OVERVIEW_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                    <div style={{ ...s.card, height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <div style={s.analyticsCardTitle}>Funding Composition <InfoTip text="Active grant funding broken down by funder type and by restricted vs unrestricted use." /></div>
                      <div style={s.analyticsSubTitle}>By funder type</div>
                      {funderTypeBreakdown.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 14 }}>No active grants yet.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                          {funderTypeBreakdown.map((f: any, i: any) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 12, color: C.text, flex: 1 }}>{f.label}</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: C.forest }}>{f.pct}%</span>
                              <span style={{ fontSize: 11, color: C.muted, minWidth: 65, textAlign: 'right' }}>${f.amount.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={s.analyticsSubTitleDivider}>Restricted vs unrestricted</div>
                      {(restrictedTotal + unrestrictedTotal) === 0 ? (
                        <div style={{ fontSize: 12.5, color: C.muted }}>No active grants yet.</div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', borderRadius: 3, overflow: 'hidden', height: 8, marginBottom: 8 }}>
                            <div style={{ width: `${restrictedPct}%`, background: C.red }} />
                            <div style={{ width: `${100 - restrictedPct}%`, background: C.sage }} />
                          </div>
                          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: C.text }}>
                            <span><span style={{ display: 'inline-block', width: 9, height: 9, background: C.red, borderRadius: 2, marginRight: 5 }} />{restrictedPct}% restricted · ${restrictedTotal.toLocaleString()}</span>
                            <span><span style={{ display: 'inline-block', width: 9, height: 9, background: C.sage, borderRadius: 2, marginRight: 5 }} />{100 - restrictedPct}% unrestricted · ${unrestrictedTotal.toLocaleString()}</span>
                          </div>
                        </>
                      )}
                    </div>
                    </DraggableCard>
                    )}
                  </>
                )
              })()}

              {(() => {
                const { totalActiveAmount, totalUtilized, utilizationRate, activeGrants, byFunder, topFunderPct, highRisk, medRisk, tooFewFunders, expiringSoon } = grantOverviewStats
                const today = new Date()

                return (
                  <>
                    {!hidden('gr_grantFunding') && (
                    <DraggableCard sectionId="gr" cardKey="gr_grantFunding" order={cardOrd('gr', GRANTS_OVERVIEW_CARDS, 'gr_grantFunding')} flexBasis="460px" defaultOrder={GRANTS_OVERVIEW_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                    <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                      <div style={s.analyticsCardTitle}>Grant Funding — {filterYear} <InfoTip text="Whether spending on each active grant that was active at any point during the selected fiscal year is keeping pace with its report deadline, plus overall utilization for those grants. A multi-year grant stays visible in every fiscal year it spans, not just the one it started in. Switch the year filter above to change scope." /></div>

                      {utilizationRate !== null && (
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Overall utilization</div>
                          <div style={{ ...s.analyticsStatNumber, color: utilizationRate >= 80 ? C.sage : utilizationRate >= 50 ? C.gold : C.red, marginBottom: 4 }}>{utilizationRate}%</div>
                          <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>${totalUtilized.toLocaleString()} of ${totalActiveAmount.toLocaleString()}</div>
                          <div style={{ background: C.ivoryDark, borderRadius: 3, height: 6, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, utilizationRate)}%`, height: '100%', background: utilizationRate >= 80 ? C.sage : utilizationRate >= 50 ? C.gold : C.red, borderRadius: 3 }} />
                          </div>
                        </div>
                      )}

                      {activeGrants.length === 0 ? (
                        <div style={{ fontSize: 13, color: C.muted }}>No active grants right now.</div>
                      ) : (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 600, color: C.gold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Pace vs report deadline</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {(() => { let behindPaceCount = 0; const rows = activeGrants.map((g: any, i: any) => {
                            const utilized = (grantExpensesByGrant[g.id] || []).reduce((s: any, e: any) => s + Number(e.amount), 0)
                            const pctSpent = g.amount > 0 ? Math.round((utilized / Number(g.amount)) * 100) : 0
                            const start = new Date(g.start_date || g.created_at)
                            const due = g.report_due_date ? new Date(g.report_due_date) : null
                            const daysToReport = due ? Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null
                            const overdue = daysToReport !== null && daysToReport < 0
                            let pctElapsed = null
                            if (due) {
                              const totalSpan = due.getTime() - start.getTime()
                              const elapsed = today.getTime() - start.getTime()
                              pctElapsed = totalSpan > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / totalSpan) * 100))) : null
                            }
                            const gap = pctElapsed !== null ? pctElapsed - pctSpent : null
                            const behind = gap !== null && gap >= 20
                            const slightlyBehind = gap !== null && gap >= 8 && gap < 20
                            if (overdue || behind) behindPaceCount++
                            const bg = overdue || behind ? C.dangerBg : slightlyBehind ? C.warningBg : C.ivory
                            const textColor = overdue || behind ? C.red : slightlyBehind ? C.gold : C.text
                            const barColor = overdue || behind ? C.red : slightlyBehind ? C.gold : C.sage
                            let verdict = 'Not enough data to assess pace'
                            if (pctElapsed !== null) {
                              verdict = `${pctElapsed}% of timeline elapsed, ${pctSpent}% spent — ${overdue || behind ? 'significantly behind on spend' : slightlyBehind ? 'slightly behind pace' : 'on pace'}`
                            }
                            return (
                              <div key={i} style={{ padding: '10px 12px', background: bg, borderRadius: 4, cursor: 'pointer' }} onClick={() => { setGrantSearchTerm(g.funder_name); setGrantUrgencyFilter('All'); setGrantAmountFilter('All'); setGrantYearFilter('All'); setActiveTab('grants') }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                                  <span style={{ fontSize: 12.5, fontWeight: 500, color: C.forest }}>{g.funder_name}</span>
                                  <span style={{ fontSize: 11, color: textColor }}>{overdue ? 'report overdue' : daysToReport !== null ? (daysToReport <= 60 ? `report in ${daysToReport}d` : due.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })) : 'no report date'}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                  <div style={{ flex: 1, background: 'rgba(0,0,0,0.06)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                                    <div style={{ width: `${pctSpent}%`, height: '100%', background: barColor }} />
                                  </div>
                                  <span style={{ fontSize: 11, color: textColor, whiteSpace: 'nowrap' }}>${utilized.toLocaleString()} of ${Number(g.amount).toLocaleString()}</span>
                                </div>
                                <div style={{ fontSize: 11, color: textColor }}>{verdict}</div>
                              </div>
                            )
                          }); return <>{rows}{behindPaceCount > 0 ? <ActionBanner tone="danger" text={`${behindPaceCount} grant${behindPaceCount !== 1 ? 's' : ''} behind pace`} sub="Log expenses or check in with the programme team" /> : <ActionBanner tone="success" text="All grants on pace" sub={`${activeGrants.length} active grant${activeGrants.length !== 1 ? 's' : ''} tracking on schedule`} />}</> })()}
                          </div>
                        </>
                      )}
                    </div>
                    </DraggableCard>
                    )}

                    {!hidden('gr_grantConcentration') && (() => {
                      return (
                    <DraggableCard sectionId="gr" cardKey="gr_grantConcentration" order={cardOrd('gr', GRANTS_OVERVIEW_CARDS, 'gr_grantConcentration')} flexBasis="460px" defaultOrder={GRANTS_OVERVIEW_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                    <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                      <div style={s.analyticsCardTitle}>Grant Funding Concentration <InfoTip text="Share of active grant funding coming from your single largest funder, and which active grants are approaching their final report date within 6 months with no successor lined up." /></div>

                    {tooFewFunders ? (
                      <div style={{ fontSize: 12.5, color: C.muted }}>Too few active funders to assess concentration yet.</div>
                    ) : (
                      <>
                        <div style={{ ...s.analyticsStatNumber, color: highRisk ? C.red : medRisk ? C.gold : C.forest, marginBottom: 4 }}>{topFunderPct}%</div>
                        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>of active grant funding from your single largest funder</div>
                        <div style={{ background: C.ivoryDark, borderRadius: 3, height: 6, overflow: 'hidden', marginBottom: 18 }}>
                          <div style={{ width: `${topFunderPct}%`, height: '100%', background: highRisk ? C.red : medRisk ? C.gold : C.sage, borderRadius: 3 }} />
                        </div>
                      </>
                    )}

                    {byFunder.length > 0 && (
                      <>
                        <div style={s.analyticsSubTitleDivider}>By funder, active grants only</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                          {byFunder.map((f: any, i: any) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.ivory, borderRadius: 4, cursor: 'pointer' }} onClick={() => { setGrantSearchTerm(f.funder_name); setGrantUrgencyFilter('All'); setGrantAmountFilter('All'); setGrantYearFilter('All'); setActiveTab('grants') }}>
                              <span style={{ fontSize: 12.5, fontWeight: 500, color: C.forest, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{f.funder_name}</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: C.forest }}>${f.amount.toLocaleString()} · {f.pct}%</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    <div style={s.analyticsSubTitle}>Funding expiring in the next 6 months</div>
                    {expiringSoon.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: C.muted }}>No active grants expiring in the next 6 months.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {expiringSoon.map((g: any, i: any) => {
                          const monthsOut = Math.round((new Date(g.end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
                          return (
                            <div key={i} style={{ padding: '10px 12px', background: C.warningBg, borderRadius: 4, cursor: 'pointer' }} onClick={() => { setGrantSearchTerm(g.funder_name); setGrantUrgencyFilter('All'); setGrantAmountFilter('All'); setGrantYearFilter('All'); setActiveTab('grants') }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <span style={{ fontSize: 12.5, fontWeight: 500, color: C.forest }}>{g.funder_name}</span>
                                <span style={{ fontSize: 11, color: C.text }}>ends in {monthsOut} mo</span>
                              </div>
                              <div style={{ fontSize: 11, color: C.text, marginTop: 2 }}>{g.is_renewable ? 'Marked renewable — worth starting the renewal conversation with the funder' : 'Not marked renewable — line up a replacement funder before this runs out'}</div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {!tooFewFunders && (highRisk ? (
                      <ActionBanner tone="danger" text="High funder concentration" sub="Prioritise diversifying your funder base" />
                    ) : medRisk ? (
                      <ActionBanner tone="warning" text="Moderate funder concentration" sub="Worth watching as your portfolio grows" />
                    ) : (
                      <ActionBanner tone="success" text="Well diversified" sub="No single funder dominates your active grants" />
                    ))}
                  </div>
                  </DraggableCard>
                      )
                    })()}
                  </>
                )
              })()}

              {(() => {
                const { totalMatchCap, totalMatchClaimed, matchClaimedPct, matchingAtRisk, totalCommitted, totalReceived, pendingTranches, reportCompliance } = grantOverviewStats
                return (
                  <>
                    {!hidden('gr_matchingClaims') && (
                    <DraggableCard sectionId="gr" cardKey="gr_matchingClaims" order={cardOrd('gr', GRANTS_OVERVIEW_CARDS, 'gr_matchingClaims')} flexBasis="360px" defaultOrder={GRANTS_OVERVIEW_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                    <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                      <div style={s.analyticsCardTitle}>Matching Grant Claims <InfoTip text="How much matched funding has been claimed against the cap across all active matching grants, and which ones are ending within 6 months with unclaimed match still on the table." /></div>
                      {totalMatchCap === 0 ? (
                        <div style={{ fontSize: 12.5, color: C.muted }}>No active matching grants.</div>
                      ) : (
                        <>
                          <div style={{ ...s.analyticsStatNumber, color: matchClaimedPct >= 80 ? C.sage : matchClaimedPct >= 50 ? C.gold : C.red, marginBottom: 4 }}>{matchClaimedPct}%</div>
                          <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>${totalMatchClaimed.toLocaleString()} claimed of ${totalMatchCap.toLocaleString()} total cap</div>
                          <div style={{ background: C.ivoryDark, borderRadius: 3, height: 6, overflow: 'hidden', marginBottom: 14 }}>
                            <div style={{ width: `${matchClaimedPct}%`, height: '100%', background: matchClaimedPct >= 80 ? C.sage : matchClaimedPct >= 50 ? C.gold : C.red, borderRadius: 3 }} />
                          </div>
                          <div style={s.analyticsSubTitle}>Ending within 6 months, unclaimed match remaining</div>
                          {matchingAtRisk.length === 0 ? (
                            <div style={{ fontSize: 12.5, color: C.muted }}>None — all on pace or not ending soon.</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {matchingAtRisk.map((m: any, i: any) => (
                                <div key={i} style={{ padding: '8px 10px', background: C.dangerBg, borderRadius: 4, cursor: 'pointer' }} onClick={() => { setGrantSearchTerm(m.funder_name); setGrantUrgencyFilter('All'); setGrantAmountFilter('All'); setGrantYearFilter('All'); setActiveTab('grants') }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                    <span style={{ fontSize: 12.5, fontWeight: 500, color: C.forest }}>{m.funder_name}</span>
                                    <span style={{ fontSize: 11, color: C.red }}>{m.pct}% claimed</span>
                                  </div>
                                  <div style={{ fontSize: 11, color: C.red, marginTop: 2 }}>${m.claimed.toLocaleString()} of ${m.cap.toLocaleString()} · ends {new Date(m.end_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          {matchingAtRisk.length > 0 ? (
                            <ActionBanner tone="danger" text={`${matchingAtRisk.length} grant${matchingAtRisk.length !== 1 ? 's' : ''} closing with unclaimed match`} sub="File grant claims now, or that money is gone for good" />
                          ) : (
                            <ActionBanner tone="success" text="No claims at risk" sub="Grant claims are on pace or not ending soon" />
                          )}
                        </>
                      )}
                    </div>
                    </DraggableCard>
                    )}

                    {!hidden('gr_disbursementTranches') && (
                    <DraggableCard sectionId="gr" cardKey="gr_disbursementTranches" order={cardOrd('gr', GRANTS_OVERVIEW_CARDS, 'gr_disbursementTranches')} flexBasis="360px" defaultOrder={GRANTS_OVERVIEW_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                    <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                      <div style={s.analyticsCardTitle}>Disbursement Tranches <InfoTip text="Committed disbursement amounts vs cash actually received across active grants — a grant can be fully 'utilized' on paper while the cash for a later tranche hasn't landed yet." /></div>
                      {totalCommitted === 0 ? (
                        <div style={{ fontSize: 12.5, color: C.muted }}>No disbursement tranches logged yet.</div>
                      ) : (() => {
                        const receivedPct = Math.round((totalReceived / totalCommitted) * 100)
                        const receivedColor = receivedPct >= 80 ? C.sage : receivedPct >= 50 ? C.gold : C.red
                        return (
                        <>
                          <div style={{ ...s.analyticsStatNumber, color: receivedColor, marginBottom: 4 }}>{receivedPct}%</div>
                          <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>${totalReceived.toLocaleString()} received of ${totalCommitted.toLocaleString()} committed</div>
                          <div style={{ background: C.ivoryDark, borderRadius: 3, height: 6, overflow: 'hidden', marginBottom: 14 }}>
                            <div style={{ width: `${Math.min(100, receivedPct)}%`, height: '100%', background: receivedColor, borderRadius: 3 }} />
                          </div>
                          <div style={s.analyticsSubTitle}>Pending tranches</div>
                          {pendingTranches.length === 0 ? (
                            <div style={{ fontSize: 12.5, color: C.muted }}>All committed tranches received.</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {pendingTranches.map((t: any, i: any) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: t.overdue ? C.dangerBg : C.ivory, borderRadius: 4, cursor: 'pointer' }} onClick={() => { setGrantSearchTerm(t.funder_name); setGrantUrgencyFilter('All'); setGrantAmountFilter('All'); setGrantYearFilter('All'); setActiveTab('grants') }}>
                                  <span style={{ fontSize: 12, color: t.overdue ? C.red : C.text }}>{t.funder_name} <span style={{ color: C.muted }}>· {t.label}</span></span>
                                  <span style={{ fontSize: 11.5, color: t.overdue ? C.red : C.muted }}>${t.amount.toLocaleString()} · {t.overdue ? 'overdue' : new Date(t.expected_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {pendingTranches.some((t: any) => t.overdue) ? (
                            <ActionBanner tone="danger" text={`${pendingTranches.filter((t: any) => t.overdue).length} tranche${pendingTranches.filter((t: any) => t.overdue).length !== 1 ? 's' : ''} overdue`} sub="Follow up with the funder" />
                          ) : (
                            <ActionBanner tone="success" text="No overdue tranches" sub="All disbursements are on schedule" />
                          )}
                        </>
                        )
                      })()}
                    </div>
                    </DraggableCard>
                    )}

                    {!hidden('gr_reportCompliance') && (
                    <DraggableCard sectionId="gr" cardKey="gr_reportCompliance" order={cardOrd('gr', GRANTS_OVERVIEW_CARDS, 'gr_reportCompliance')} flexBasis="360px" defaultOrder={GRANTS_OVERVIEW_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                    <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                      <div style={s.analyticsCardTitle}>Report Compliance <InfoTip text="How reliably your reports get submitted on time, scoped to reports due in the selected fiscal year, with the change vs the prior fiscal year." /></div>
                      {reportCompliance.total === 0 ? (
                        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 14 }}>No report deadlines due in {reportCompliance.yr} yet.</div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
                          <div>
                            <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>On-time rate — {reportCompliance.yr}</div>
                            <div style={{ ...s.analyticsStatNumber, color: reportCompliance.onTimeRate === null ? C.forest : reportCompliance.onTimeRate >= 80 ? C.sage : reportCompliance.onTimeRate >= 50 ? C.gold : C.red }}>{reportCompliance.onTimeRate !== null ? `${reportCompliance.onTimeRate}%` : '—'}</div>
                            <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>{reportCompliance.submitted} of {reportCompliance.total} submitted{reportCompliance.onTimeRateDelta !== null && (
                              <span style={{ color: reportCompliance.onTimeRateDelta >= 0 ? C.sage : C.red, fontWeight: 500 }}> · {reportCompliance.onTimeRateDelta >= 0 ? '▲' : '▼'} {Math.abs(reportCompliance.onTimeRateDelta)}pt vs last FY</span>
                            )}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Overdue now</div>
                            <div style={{ ...s.analyticsStatNumber, color: reportCompliance.overdueCount > 0 ? C.red : C.forest }}>{reportCompliance.overdueCount}</div>
                            <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>{reportCompliance.avgDaysLate !== null ? `avg ${reportCompliance.avgDaysLate}d late when late` : 'no late submissions yet'}</div>
                          </div>
                        </div>
                      )}
                      {reportCompliance.overdueCount > 0 && (
                        <>
                          <div style={s.analyticsSubTitle}>Overdue reports</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
                            {reportCompliance.overdueReportsList.map((r: any, i: any) => (
                              <div key={i} style={{ padding: '8px 10px', background: C.dangerBg, borderRadius: 4, cursor: 'pointer' }} onClick={() => { setGrantSearchTerm(r.funder_name); setGrantUrgencyFilter('All'); setGrantAmountFilter('All'); setGrantYearFilter('All'); setActiveTab('grants') }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                  <span style={{ fontSize: 12.5, fontWeight: 500, color: C.forest }}>{r.funder_name}</span>
                                  <span style={{ fontSize: 11, color: C.red }}>{r.daysOverdue}d overdue</span>
                                </div>
                                <div style={{ fontSize: 11, color: C.red, marginTop: 2 }}>{r.label} · due {new Date(r.due_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                      {reportCompliance.overdueCount > 0 ? (
                        <ActionBanner tone="danger" text={`${reportCompliance.overdueCount} report${reportCompliance.overdueCount !== 1 ? 's' : ''} overdue`} sub="Check and submit on time" />
                      ) : reportCompliance.total > 0 ? (
                        <ActionBanner tone="success" text="No overdue reports" sub="All reports are up to date" />
                      ) : null}
                    </div>
                    </DraggableCard>
                    )}
                  </>
                )
              })()}
              </div>
            </div>

            <div id="analytics-section-donorbehavior" style={{ marginBottom: 40, scrollMarginTop: 20 }}>
              <div style={s.sectionBand}>
                <span style={s.sectionBandLabel}>Donor Behavior & Retention</span>
                <CustomizeSectionButton sectionId="db" cards={DONOR_BEHAVIOR_CARDS} hiddenDashboardCards={hiddenDashboardCards} toggleDashboardCard={toggleDashboardCard} resetDashboardSection={resetDashboardSection} setConfirmModal={setConfirmModal} />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>

              {!hidden('db_retentionTiles') && (() => {
                const { yr, repeatDonorRate, avgLTV, retentionRate, activeCount, lapsedCount } = donorRetentionSnapshotStats
                return (
                  <DraggableCard sectionId="db" cardKey="db_retentionTiles" order={cardOrd('db', DONOR_BEHAVIOR_CARDS, 'db_retentionTiles')} flexBasis="100%" defaultOrder={DONOR_BEHAVIOR_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ display: 'flex', gap: 12, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                    <div style={{ ...s.card, flex: 1, minWidth: isMobile ? 'calc(50% - 6px)' : 0 }}>
                      <div style={{ ...s.analyticsCardTitle, letterSpacing: 0.5, marginBottom: 6 }}>Retention Rate <InfoTip text={`Share of donors who gave in ${yr - 1} and gave again in ${yr}.`} /></div>
                      <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>{retentionRate !== null ? `${retentionRate}%` : '—'}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>of {yr - 1}'s donors gave again in {yr}</div>
                    </div>
                    <div style={{ ...s.card, flex: 1, minWidth: isMobile ? 'calc(50% - 6px)' : 0 }}>
                      <div style={{ ...s.analyticsCardTitle, letterSpacing: 0.5, marginBottom: 6 }}>Repeat Donor Rate <InfoTip text="Share of all-time donors who have given 2 or more times." /></div>
                      <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>{repeatDonorRate}%</div>
                      <div style={{ fontSize: 11, color: C.muted }}>gave 2+ times, all-time</div>
                    </div>
                    <div style={{ ...s.card, flex: 1, minWidth: isMobile ? 'calc(50% - 6px)' : 0 }}>
                      <div style={{ ...s.analyticsCardTitle, letterSpacing: 0.5, marginBottom: 6 }}>Avg Lifetime Value <InfoTip text="Average total confirmed giving per donor, across all time." /></div>
                      <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>${avgLTV.toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>per donor, all-time</div>
                    </div>
                    <div style={{ ...s.card, flex: 1, minWidth: isMobile ? 'calc(50% - 6px)' : 0 }}>
                      <div style={{ ...s.analyticsCardTitle, letterSpacing: 0.5, marginBottom: 6 }}>Active vs Lapsed <InfoTip text={`Donors who gave in ${yr} vs donors who gave in a prior year but not ${yr}.`} /></div>
                      <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>{activeCount} <span style={{ fontSize: 14, color: C.muted, fontWeight: 400 }}>/ {lapsedCount}</span></div>
                      <div style={{ fontSize: 11, color: C.muted }}>active vs lapsed donors</div>
                    </div>
                  </div>
                  </DraggableCard>
                )
              })()}

              {!hidden('db_highlights') && (() => {
                const cards = donorHighlightsStats
                if (cards.length === 0) return null

                return (
                  <DraggableCard sectionId="db" cardKey="db_highlights" order={cardOrd('db', DONOR_BEHAVIOR_CARDS, 'db_highlights')} flexBasis="100%" defaultOrder={DONOR_BEHAVIOR_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div id="donor-highlights-card-analytics" style={{ ...s.card, scrollMarginTop: 20 }}>
                    <div style={s.analyticsCardTitle}>Donor Highlights — {filterYear}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Standout supporters worth a personal thank-you.</div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${cards.length}, 1fr)`, gap: 12 }}>
                      {cards.map((c: any, i: any) => (
                        <div key={i} style={{ background: C.ivory, borderRadius: 12, padding: 16, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 18 }}>{c.icon}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: 0.5 }}>{c.label}</span>
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: C.forest }}>{c.name}</div>
                          <div style={{ fontSize: 12, color: C.muted }}>{c.sub}</div>
                          {c.donor.email?.trim() && (
                            <button
                              style={{ ...s.btnGold, justifyContent: 'center', fontSize: 12, padding: '8px 14px', marginTop: 4 }}
                              onClick={() => generateThankYouNote(c.donor, { unackedBigGift: true })}
                            >✍️ Draft thank-you</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  </DraggableCard>
                )
              })()}

              {!hidden('db_paymentMix') && paymentMixStats && (() => {
                const { rows, allYears61, allMethods61, yearlyMix61 } = paymentMixStats
                const colors = [C.forest, C.gold, C.red, C.bucket1, C.muted, C.borderStrong]

                return (
                  <DraggableCard sectionId="db" cardKey="db_paymentMix" order={cardOrd('db', DONOR_BEHAVIOR_CARDS, 'db_paymentMix')} flexBasis="460px" defaultOrder={DONOR_BEHAVIOR_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ ...s.analyticsCardTitle, display: 'flex', alignItems: 'center', gap: 5 }}>How Donors Are Paying — {filterYear} <InfoTip text="Breakdown of confirmed donations by payment method — PayNow, cash, bank transfer, and other methods you've logged." /></div>
                    <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 10, marginBottom: 14 }}>
                      {rows.map((r: any, i: any) => <div key={i} style={{ width: `${r.rawPct}%`, background: colors[i % colors.length] }} />)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: allYears61.length > 1 ? 18 : 0 }}>
                      {rows.map((r: any, i: any) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: colors[i % colors.length], flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: C.text, flex: 1 }}>{r.label}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.forest }}>{r.pct}%</span>
                          <span style={{ fontSize: 12, color: C.muted, minWidth: 70, textAlign: 'right' }}>${r.amt.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    {allYears61.length > 1 && (
                      <div style={{ borderTop: `1px dashed ${C.border}`, paddingTop: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Shift over time</div>
                        {allMethods61.map((method: any, mi: any) => {
                          const series = yearlyMix61.map((y: any) => y.total > 0 ? Math.round((y.mix[method] / y.total) * 100) : 0)
                          const firstPct = series[0]
                          const lastPct = series[series.length - 1]
                          const delta = lastPct - firstPct
                          return (
                            <div key={mi} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <span style={{ fontSize: 12, color: C.text, width: 100, flexShrink: 0 }}>{method}</span>
                              <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                                {yearlyMix61.map((y: any, yi: any) => (
                                  <div key={yi} style={{ fontSize: 10, color: C.muted, textAlign: 'center', flex: 1 }}>{y.year}: {series[yi]}%</div>
                                ))}
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 500, color: delta > 0 ? C.sage : delta < 0 ? C.red : C.muted, width: 50, textAlign: 'right' }}>{delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta}pt`}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  </DraggableCard>
                )
              })()}
              {!hidden('db_fundingConcentration') && (() => {
                const { sorted, grandTotal, concentrationPct, tooFewDonors, highRisk, medRisk, topDonorNames, concentrationTrend } = fundingConcentrationStats

                return (
                  <DraggableCard sectionId="db" cardKey="db_fundingConcentration" order={cardOrd('db', DONOR_BEHAVIOR_CARDS, 'db_fundingConcentration')} flexBasis="460px" defaultOrder={DONOR_BEHAVIOR_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ ...s.analyticsCardTitle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 5 }}>Funding Concentration <InfoTip text="Share of total revenue coming from your top N donors, where N is selectable. High concentration means your income depends heavily on a small number of people." /></div>
                      <select style={{ fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 6px', color: C.forest, background: C.white, fontFamily: 'inherit' }} value={concentrationTopN} onChange={e => { const v = Number(e.target.value); setConcentrationTopN(v); supabase.from('charity_contacts').update({ concentration_top_n: v }).eq('charity_uen', charityUen) }}>
                        <option value={5}>Top 5</option>
                        <option value={10}>Top 10</option>
                        <option value={20}>Top 20</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <div style={{ ...s.analyticsStatNumber, color: highRisk ? C.red : medRisk ? C.gold : C.forest, marginBottom: 2 }}>{concentrationPct}%</div>
                      {concentrationTrend !== null && (
                        <span style={{ fontSize: 12, fontWeight: 500, color: concentrationTrend <= 0 ? C.sage : C.red }}>
                          {concentrationTrend === 0 ? '—' : concentrationTrend < 0 ? `↓ ${Math.abs(concentrationTrend)}pt` : `↑ ${concentrationTrend}pt`} vs 90d ago
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10 }}>of revenue from top {Math.min(concentrationTopN, sorted.length)} donors</div>
                    <div style={{ background: C.ivoryDark, borderRadius: 3, height: 6, overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ width: `${concentrationPct}%`, height: '100%', background: highRisk ? C.red : medRisk ? C.gold : C.sage, borderRadius: 3 }} />
                    </div>
                    <div style={{ fontSize: 11.5, color: highRisk ? C.red : medRisk ? C.gold : C.sage, fontWeight: 500, marginBottom: 14 }}>
                      {tooFewDonors ? 'Too few donors to assess yet' : highRisk ? '⚠ High risk — diversify donor base' : medRisk ? '⚠ Moderate risk' : '✓ Healthy diversification'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                    {sorted.slice(0, showAllConcentrationDonors ? 10 : 5).map((d: any, i: any) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: C.ivory, borderRadius: 4, cursor: 'pointer' }} onClick={() => { setSelectedDonor(findDonorRecord(d.email, d.name)); setActiveTab('donors') }}>
                          <span style={{ fontSize: 12.5, fontWeight: 500, color: C.forest }}>{d.name}</span>
                          <span style={{ fontFamily: C.fontMono, fontSize: 13, fontWeight: 500, color: C.forest }}>
                            ${d.total.toLocaleString()} / {grandTotal > 0 ? Math.round((d.total / grandTotal) * 100) : 0}%
                          </span>
                        </div>
                      ))}
                    </div>
                    {sorted.length > 5 && (
                      <button style={{ fontSize: 11, color: C.muted, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, marginTop: 0, marginBottom: 10, display: 'block' }} onClick={() => setShowAllConcentrationDonors(v => !v)}>
                        {showAllConcentrationDonors ? 'Show fewer' : `Show top ${Math.min(10, sorted.length)}`}
                      </button>
                    )}
                    <button style={{ ...s.viewBtn, fontSize: 11.5, padding: '6px 12px', width: '100%', justifyContent: 'center' }} onClick={() => { setFilterTopDonorNames(topDonorNames); setFilterDonorKeys(null); setDonorFilterLabel(null); setActiveTab('donors') }}>View Top Donors →</button>
                  </div>
                  </DraggableCard>
                )
              })()}
              </div>

              <div style={{ ...s.analyticsSubTitle, color: C.red, borderTop: `1px solid ${C.border}`, paddingTop: 20, marginTop: 8, marginBottom: 16 }}>Needs Attention</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
              {!hidden('db_slowingDown') && (() => {
                const quiet = quietDonorsStats
                return (
                  <DraggableCard sectionId="db" cardKey="db_slowingDown" order={cardOrd('db', DONOR_BEHAVIOR_CARDS, 'db_slowingDown')} flexBasis="460px" defaultOrder={DONOR_BEHAVIOR_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                    <div style={s.analyticsCardTitle}>Slowing Down</div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Used to give regularly, but their gap since the last gift is more than double their usual rhythm — worth checking in before they fully lapse.</div>
                    {quiet.length === 0 ? (
                      <div style={{ fontSize: 13, color: C.muted, padding: '8px 0' }}>No donors showing a slowdown right now.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {quiet.map((d: any, i: any) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: C.warningBg, borderRadius: 10, border: `1px solid ${C.warningBorder}` }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.warning, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{d.name?.charAt(0)}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: C.forest }}>{d.name}</div>
                              <div style={{ fontSize: 11, color: C.warning, marginTop: 1 }}>Usually gives every ~{d.avgGapDays}d · it's been {d.daysSinceLast}d</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  </DraggableCard>
                )
              })()}

              {!hidden('db_quietlyPaying') && (() => {
                const quietlyPaying75 = quietlyPayingStats
                return (
                  <DraggableCard sectionId="db" cardKey="db_quietlyPaying" order={cardOrd('db', DONOR_BEHAVIOR_CARDS, 'db_quietlyPaying')} flexBasis="460px" defaultOrder={DONOR_BEHAVIOR_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                    <div style={s.analyticsCardTitle}>Paying, But No Contact</div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Still giving on schedule, but no personal contact logged in over a year — the relationship may be going cold even though the payments aren't.</div>
                    {quietlyPaying75.length === 0 ? (
                      <div style={{ fontSize: 13, color: C.muted, padding: '8px 0' }}>No quietly-paying donors right now — nice work staying in touch.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {quietlyPaying75.map((d: any, i: any) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: C.ivory, borderRadius: 10, border: `1px solid ${C.border}` }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.forest, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{d.name?.charAt(0)}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: C.forest }}>{d.name}</div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>${d.amount}/{d.frequency} · {d.lastContact ? `last contact ${Math.floor((new Date().getTime() - new Date(d.lastContact).getTime()) / (1000 * 60 * 60 * 24 * 30))}mo ago` : 'no contact ever logged'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  </DraggableCard>
                )
              })()}

              {!hidden('db_givingChanges') && (() => {
                const allFlags = allGivingChangeFlags
                const flags = showAllGivingChanges ? allFlags : allFlags.slice(0, 5)
                return (
                  <DraggableCard sectionId="db" cardKey="db_givingChanges" order={cardOrd('db', DONOR_BEHAVIOR_CARDS, 'db_givingChanges')} flexBasis="460px" defaultOrder={DONOR_BEHAVIOR_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div id="giving-changes-card-analytics" style={{ ...s.card, scrollMarginTop: 20 }}>
                    <div style={{ ...s.analyticsCardTitle, display: 'flex', alignItems: 'center', gap: 5 }}>Giving Changes <InfoTip text="Donors whose most recent gift differs from their historical average by at least this percentage, based on this many or more prior gifts. Adjust the threshold in Settings." /></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11.5, color: C.muted }}>Donors with {givingChangeMinGifts}+ gifts, changed by {givingChangeMinPct}%+</span>
                      <span
                        style={{ fontSize: 11.5, color: C.sage, fontWeight: 500, cursor: 'pointer' }}
                        onClick={() => { setActiveTab('settings'); setSettingsSection('thresholds'); setTimeout(() => document.getElementById('dashboard-alert-sensitivity-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50) }}
                      >Adjust in Settings →</span>
                    </div>
                    {flags.length === 0 ? (
                      <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No significant changes detected yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                        {flags.map((f: any, i: any) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: f.changePct < 0 ? C.dangerBg : C.successBg, borderRadius: 4, cursor: 'pointer' }} onClick={() => { setSelectedDonor(findDonorRecord(f.email, f.name)); setActiveTab('donors') }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: C.forest }}>{f.name}</div>
                              <div style={{ fontSize: 11, color: C.muted }}>Avg was ${f.prevAvg} · Last gift ${f.recent.toLocaleString()}</div>
                            </div>
                            <span style={{ fontFamily: C.fontMono, fontSize: 13, fontWeight: 500, color: f.changePct < 0 ? C.red : C.sage }}>
                              {f.changePct > 0 ? '↑' : '↓'} {Math.abs(f.changePct)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {allFlags.length > 5 && (
                      <button style={{ fontSize: 11, color: C.muted, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }} onClick={() => setShowAllGivingChanges(v => !v)}>
                        {showAllGivingChanges ? 'Show top 5 only' : `Show all ${allFlags.length}`}
                      </button>
                    )}
                  </div>
                  </DraggableCard>
                )
              })()}

              {!hidden('db_thankYouDebt') && (() => {
                const owedDonations = donations.filter(d => d.payment_status === 'confirmed' && !d.thank_you_sent && d.donor_email?.trim() && !d.donor_deceased && !d.donor_do_not_contact)
                const owedTotal = owedDonations.reduce((s, d) => s + d.amount, 0)
                if (owedDonations.length === 0) return null
                return (
                  <DraggableCard sectionId="db" cardKey="db_thankYouDebt" order={cardOrd('db', DONOR_BEHAVIOR_CARDS, 'db_thankYouDebt')} flexBasis="100%" defaultOrder={DONOR_BEHAVIOR_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ ...s.card, background: C.warningBg, border: `1px solid ${C.warningBorder}` }}>
                    <div style={s.analyticsCardTitle}>Silent Thank-You Debt</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.warning, marginBottom: 4 }}>${owedTotal.toLocaleString()}</div>
                    <div style={{ fontSize: 13, color: C.warning }}>in donations from {owedDonations.length} donor{owedDonations.length > 1 ? 's' : ''} have never received a thank-you — that's real generosity sitting unacknowledged.</div>
                    <button style={{ ...s.viewBtn, marginTop: 10 }} onClick={() => { clearDonationFilters({ keepYear: false }); setFilterThankYou('Not Sent'); setActiveTab('donations') }}>Review and thank them →</button>
                  </div>
                  </DraggableCard>
                )
              })()}
              </div>

              <div style={{ ...s.analyticsSubTitle, color: C.sage, borderTop: `1px solid ${C.border}`, paddingTop: 20, marginTop: 8 }}>Recognition & Stewardship</div>
              {!hidden('db_givingStreaks') && (() => {
                const streaks = givingStreaksStats
                return (
                  <div style={{ ...s.card, marginBottom: 24 }}>
                    <div style={s.analyticsCardTitle}>Giving Streaks</div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Donors who've given in 3 or more consecutive months — your most dependable supporters, regardless of gift size.</div>
                    {streaks.length === 0 ? (
                      <div style={{ fontSize: 13, color: C.muted, padding: '8px 0' }}>No active streaks of 3+ months yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {streaks.map((d: any, i: any) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: C.ivory, borderRadius: 10, border: `1px solid ${C.border}` }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.gold, color: C.forest, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{d.name?.charAt(0)}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: C.forest }}>{d.name}</div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{d.email || 'No email on file'}</div>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, flexShrink: 0 }}>🔥 {d.streak} mo</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

              <div style={{ ...s.analyticsSubTitle, color: C.muted, borderTop: `1px solid ${C.border}`, paddingTop: 20, marginTop: 8, marginBottom: 16 }}>Donor Composition & Analysis</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {!hidden('db_topDonorsLTV') && (
              <DraggableCard sectionId="db" cardKey="db_topDonorsLTV" order={cardOrd('db', DONOR_BEHAVIOR_CARDS, 'db_topDonorsLTV')} flexBasis="460px" defaultOrder={DONOR_BEHAVIOR_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
              <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ ...s.analyticsCardTitle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 5 }}>Top Donors & Lifetime Value <InfoTip text="Your top 5 donors by total lifetime giving, plus average lifetime value across all donors — not scoped to the year filter above." /></div>
                  <div style={{ fontSize: 12, color: C.sage, fontWeight: 500, cursor: 'pointer' }} onClick={() => setActiveTab('donors')}>View all →</div>
                </div>
                {donorLTVStats && (() => {
                  const { avgLTV, avgGifts, under1yr59, oneToTwo59, twoPlus59, avgOf59 } = donorLTVStats
                  return (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 14 }}>
                        <div style={{ background: C.ivory, borderRadius: 4, padding: '9px 12px', border: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 10.5, color: C.muted }}>Avg LTV</div>
                          <div style={{ fontFamily: C.fontMono, fontSize: 16, fontWeight: 500, color: C.forest }}>${avgLTV.toLocaleString()}</div>
                        </div>
                        <div style={{ background: C.ivory, borderRadius: 4, padding: '9px 12px', border: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 10.5, color: C.muted }}>Avg gifts per donor</div>
                          <div style={{ fontFamily: C.fontMono, fontSize: 16, fontWeight: 500, color: C.forest }}>{avgGifts}</div>
                        </div>
                        <div style={{ background: C.ivory, borderRadius: 4, padding: '9px 12px', border: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 10.5, color: C.muted }}>Top donor LTV</div>
                          <div style={{ fontFamily: C.fontMono, fontSize: 16, fontWeight: 500, color: C.forest }}>${donorList[0]?.total.toLocaleString() || 0}</div>
                        </div>
                      </div>
                      <div style={{ background: C.ivory, borderRadius: 4, padding: '10px 12px', border: `1px solid ${C.border}`, marginBottom: 16 }}>
                        <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 6 }}>Average lifetime value by tenure</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.muted }}>Under 1 year ({under1yr59.length})</span><span style={{ fontWeight: 500, color: C.forest }}>{avgOf59(under1yr59) !== null ? `$${avgOf59(under1yr59).toLocaleString()}` : '—'}</span></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.muted }}>1–2 years ({oneToTwo59.length})</span><span style={{ fontWeight: 500, color: C.forest }}>{avgOf59(oneToTwo59) !== null ? `$${avgOf59(oneToTwo59).toLocaleString()}` : '—'}</span></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.muted }}>2+ years ({twoPlus59.length})</span><span style={{ fontWeight: 500, color: C.sage }}>{avgOf59(twoPlus59) !== null ? `$${avgOf59(twoPlus59).toLocaleString()}` : '—'}</span></div>
                        </div>
                      </div>
                    </>
                  )
                })()}
                <div style={{ fontSize: 10.5, color: C.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Top 5, all-time</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {donorList.slice(0, 5).map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: [C.gold, C.sage, C.teal, C.forest, C.muted][i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'white', flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: C.forest }}>{d.name}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{d.count} donation{d.count > 1 ? 's' : ''}</div>
                      </div>
                      <div style={{ fontFamily: C.fontVoice, fontSize: 14, fontWeight: 500, color: C.forest }}>${d.total.toLocaleString()}</div>
                    </div>
                  ))}
                  {donorList.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: 20 }}>No donors yet</div>}
                </div>
              </div>
              </DraggableCard>
              )}

              {!hidden('db_topConnectors') && (() => {
                const rows78 = topConnectorsStats
                const order78 = cardOrd('db', DONOR_BEHAVIOR_CARDS, 'db_topConnectors')
                if (rows78.length === 0) return (
                  <DraggableCard sectionId="db" cardKey="db_topConnectors" order={order78} flexBasis="460px" defaultOrder={DONOR_BEHAVIOR_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                    <div style={s.analyticsCardTitle}>Top Connectors</div>
                    <div style={{ fontSize: 13, color: C.muted }}>No referrals recorded yet — capture them when logging a new manual donor.</div>
                  </div>
                  </DraggableCard>
                )
                return (
                  <DraggableCard sectionId="db" cardKey="db_topConnectors" order={order78} flexBasis="460px" defaultOrder={DONOR_BEHAVIOR_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                    <div style={s.analyticsCardTitle}>Top Connectors</div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Donors whose referrals led to real, ongoing giving — worth a personal thank-you.</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {rows78.slice(0, 8).map((r: any, i: any) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, borderRadius: 6, padding: '8px 12px', border: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 13, color: C.forest, fontWeight: 500 }}>{r.name}</span>
                          <span style={{ fontSize: 12, color: C.muted }}>{r.referredCount} referred · {r.sustainedCount} became repeat givers</span>
                        </div>
                      ))}
                    </div>
                    {rows78.length < 3 && (
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 10, fontStyle: 'italic' }}>Only {rows78.length} connector{rows78.length !== 1 ? 's' : ''} so far — too little data yet to call this a pattern.</div>
                    )}
                  </div>
                  </DraggableCard>
                )
              })()}

              {!hidden('db_acquisitionSources') && (() => {
                const rows57 = acquisitionSourceStats
                const order57 = cardOrd('db', DONOR_BEHAVIOR_CARDS, 'db_acquisitionSources')
                if (rows57.length === 0) return (
                  <DraggableCard sectionId="db" cardKey="db_acquisitionSources" order={order57} flexBasis="460px" defaultOrder={DONOR_BEHAVIOR_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                    <div style={s.analyticsCardTitle}>Donor Acquisition Sources</div>
                    <div style={{ fontSize: 13, color: C.muted }}>No acquisition source data yet — start selecting a source when logging new manual donors.</div>
                  </div>
                  </DraggableCard>
                )
                return (
                  <DraggableCard sectionId="db" cardKey="db_acquisitionSources" order={order57} flexBasis="460px" defaultOrder={DONOR_BEHAVIOR_CARDS.map(c => c.key)} dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard}>
                  <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                    <div style={s.analyticsCardTitle}>Donor Acquisition Sources</div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Which channels bring in donors who come back and give again.</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {rows57.map((r: any, i: any) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, borderRadius: 6, padding: '8px 12px', border: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 13, color: C.forest, fontWeight: 500 }}>{r.source}</span>
                          <span style={{ fontSize: 12, color: C.muted }}>{r.totalDonors} donor{r.totalDonors !== 1 ? 's' : ''} · {r.repeatPct}% became repeat givers</span>
                        </div>
                      ))}
                    </div>
                    {rows57.length < 3 && (
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 10, fontStyle: 'italic' }}>Only {rows57.length} source{rows57.length !== 1 ? 's' : ''} so far — too little data yet to call this a pattern.</div>
                    )}
                  </div>
                  </DraggableCard>
                )
              })()}

              </div>

          </div>

          </div>

  )
}
