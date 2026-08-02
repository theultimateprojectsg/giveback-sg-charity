import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import Auth from './CharityAuth'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { QRCodeSVG } from 'qrcode.react'
import JSZip from 'jszip'
import logo from './assets/logo.png'
import './App.css'
import { donationDonorKey, contactDonorKey } from './lib/donorKeys'
import { fiscalYearOf, fiscalYearBounds, isoWeekKey } from './lib/fiscalYear'
import { fillTemplate, escapeHtml, sanitizeCsvCell } from './lib/format'
import { colorForDonor } from './lib/color'
import { computeDonationBadges, computeDonationSummaryStats } from './lib/donationStats'
import { C } from './theme'
import { s } from './styles'
import { InfoTip } from './components/ui/InfoTip'
import { EmptyState } from './components/ui/EmptyState'
import { SenderIdentityLine } from './components/ui/SenderIdentityLine'
import { CampaignExpensePanel } from './components/panels/CampaignExpensePanel'
import { ReportsPage } from './pages/ReportsPage'
import { GrantsPage } from './pages/GrantsPage'
import { InKindDonationsPage } from './pages/InKindDonationsPage'
import { MassAppealModal } from './components/modals/MassAppealModal'
import { RecurringPage } from './pages/RecurringPage'
import { PledgesPage } from './pages/PledgesPage'
import { DonationsPage } from './pages/DonationsPage'
import { DonorsPage } from './pages/DonorsPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { SettingsPage } from './pages/SettingsPage'

if (typeof document !== 'undefined' && !document.getElementById('gt-font-import')) {
  const link = document.createElement('link')
  link.id = 'gt-font-import'
  link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=IBM+Plex+Mono:wght@500&display=swap'
  document.head.appendChild(link)
}

function useScreenSize() {
  function getSize() {
    const w = window.innerWidth
    if (w <= 640) return 'mobile'
    if (w <= 1024) return 'tablet'
    return 'desktop'
  }
  const [screenSize, setScreenSize] = useState<any>(getSize())
  useEffect(() => {
    function handleResize() { setScreenSize(getSize()) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  return screenSize
}

// charity_contacts is a single row per charity holding several JSON list/object columns
// (custom_tasks, custom_obligations, email_templates, enabled_modules, ...). A plain
// `.update({ field: valueBuiltFromLocalState })` races: if two edits to the same field land
// close together (two tabs, two staff members), whichever write lands second silently
// overwrites the first — an added task or a toggled setting just vanishes with no error shown
// to anyone. Re-fetching the column immediately before merging shrinks that race window from
// "however long the page has been open" to the time of one round trip.
// Manual entries and CSV imports write payment_method as free text, so the same method
// shows up under different casings/formats ("Cash" vs "cash", "bank_transfer" vs "Bank Transfer").
// Normalize to one canonical label per method before grouping, so charts don't silently
// split one payment method into multiple slices.
function normalizePaymentMethodLabel(raw: any): string {
  const key = String(raw || '').trim().toLowerCase().replace(/[_-]+/g, ' ')
  const canonical: Record<string, string> = {
    cash: 'Cash',
    giro: 'GIRO',
    paynow: 'PayNow',
    'bank transfer': 'Bank Transfer',
    cheque: 'Cheque',
    check: 'Cheque',
  }
  if (canonical[key]) return canonical[key]
  return key ? key.replace(/\b\w/g, c => c.toUpperCase()) : 'Manual'
}

async function updateCharityJsonField(charityUen: any, field: any, mutate: any) {
  const { data, error: fetchError } = await supabase.from('charity_contacts').select(field).eq('charity_uen', charityUen).single()
  if (fetchError) return { error: fetchError }
  const next = mutate(data?.[field] ?? null)
  const { error } = await supabase.from('charity_contacts').update({ [field]: next }).eq('charity_uen', charityUen)
  return { error, next }
}

const EMAIL_TEMPLATE_DEFS = [
  { group: 'Donation Receipts', items: [
    { key: 'standard', label: 'Standard Receipt', description: 'Sent for a regular donation. The donation details (amount, date, tax info) are always included automatically — the body below is an optional extra note added above them.', tokens: ['donor_name', 'charity_name', 'amount', 'date', 'cause_title'] },
    { key: 'major_gift', label: 'Major Gift', description: 'Sent when a single gift is at or above your major gift threshold. The donation details are always included automatically — the body below is an optional extra note added above them.', tokens: ['donor_name', 'charity_name', 'amount', 'cause_title'] },
    { key: 'new_donor', label: 'First-Time Donor', description: "Sent to a donor's very first gift. The donation details are always included automatically — the body below is an optional extra note added above them.", tokens: ['donor_name', 'charity_name', 'amount', 'cause_title'] },
    { key: 'recurring_donor', label: 'Recurring Donor', description: 'Sent for donors with an ongoing giving history. The donation details are always included automatically — the body below is an optional extra note added above them.', tokens: ['donor_name', 'charity_name', 'amount'] },
    { key: 'nric_request', label: 'NRIC Request', description: 'Sent asking a donor to provide their NRIC for tax deduction. The explanation is always included automatically — the body below is an optional extra note added above it.', tokens: ['donor_name', 'charity_name', 'amount', 'date'] },
  ]},
  { group: 'Pledges', items: [
    { key: 'pledge_thank_you', label: 'Pledge Fulfilled', description: 'Sent when a donor completes a pledge.', tokens: ['donor_name', 'charity_name', 'pledge_amount'] },
    { key: 'pledge_reminder_upcoming', label: 'Pledge Reminder — upcoming', description: 'Sent as a friendly nudge before a pledge is due.', tokens: ['donor_name', 'charity_name', 'amount', 'due_date'] },
    { key: 'pledge_reminder_overdue', label: 'Pledge Reminder — overdue', description: 'Sent when a pledge has passed its expected date.', tokens: ['donor_name', 'charity_name', 'amount', 'due_date'] },
  ]},
  { group: 'Recurring Gifts', items: [
    { key: 'recurring_gift_reminder', label: 'Recurring Gift Check-in', description: "Sent when a donor's usual recurring gift hasn't come in.", tokens: ['donor_name', 'charity_name', 'amount', 'frequency'] },
  ]},
  { group: 'Lapsed & Re-engagement', items: [
    { key: 'lapsed_reminder_lapsed', label: 'Lapsed Donor', description: "Sent to donors who haven't given in a while.", tokens: ['donor_name', 'charity_name', 'amount', 'count'] },
    { key: 'lapsed_reminder_giving_change', label: 'Giving Pattern Check-in', description: "Sent when a donor's giving pattern noticeably changes.", tokens: ['donor_name', 'charity_name'] },
  ]},
  { group: 'Other', items: [
    { key: 'milestone_thank_you', label: 'Milestone Note', description: 'Freeform thank-you note, e.g. for a giving milestone.', tokens: ['donor_name', 'charity_name'] },
    { key: 'mass_appeal', label: 'Mass Appeal', description: 'Default draft used when composing a mass appeal. Use [name] (not {{donor_name}}) for the recipient\'s first name in the body.', tokens: ['charity_name', 'cause_title'] },
  ]},
]

const EMAIL_TEMPLATE_DEFAULTS = {
  standard: {
    subject: 'Thank you for your donation to {{charity_name}}! 💚',
    body: "Dear {{donor_name}},\n\nThank you so much for your generous gift to {{charity_name}}. Your support makes a real difference to the people and causes we serve.\n\nWith gratitude,\n{{charity_name}}",
    banner_title: 'Thank You, {{donor_name}}!',
    banner_subtitle: 'Your generosity makes a difference',
  },
  major_gift: {
    subject: 'Thank You, {{donor_name}}!',
    body: "Dear {{donor_name}},\n\nWe were truly moved by your generous gift of ${{amount}}. Contributions like yours make an outsized difference in what we're able to do, and we don't take that for granted.\n\nWith heartfelt thanks,\n{{charity_name}}",
    banner_title: 'A Gift That Changes Things',
    banner_subtitle: 'Thank you, {{donor_name}}, for your extraordinary generosity',
  },
  new_donor: {
    subject: 'Thank You, {{donor_name}}!',
    body: "Dear {{donor_name}},\n\nThank you for your very first gift to {{charity_name}} — we're so glad to have you with us. It's donors like you who make our work possible, and we hope this is the start of a long relationship.\n\nWith gratitude,\n{{charity_name}}",
    banner_title: 'Welcome, {{donor_name}}!',
    banner_subtitle: 'Thank you for your first gift to {{charity_name}}',
  },
  recurring_donor: {
    subject: 'Thank You, {{donor_name}}!',
    body: "Dear {{donor_name}},\n\nThank you once again for your continued support of {{charity_name}}. Your ongoing generosity gives us the stability to plan ahead and make a lasting difference.\n\nWith gratitude,\n{{charity_name}}",
    banner_title: 'Thank You for Your Continued Support',
    banner_subtitle: '{{donor_name}}, your steady giving makes a real difference',
  },
  nric_request: {
    subject: 'Action Required: Provide NRIC for tax deduction — {{charity_name}}',
    body: "Dear {{donor_name}},\n\nThank you again for your gift to {{charity_name}}. To issue you a tax-deductible receipt for your donation of ${{amount}} on {{date}}, we'll need your NRIC on file — please reply to this email with it at your convenience.\n\nWith thanks,\n{{charity_name}}",
    banner_title: 'Action Required',
    banner_subtitle: 'Provide your NRIC to claim your tax deduction',
  },
  milestone_thank_you: {
    subject: 'A note from {{charity_name}} 💚',
    body: "Dear {{donor_name}},\n\nWe wanted to take a moment, outside of any receipt or transaction, to just say thank you. Your support has genuinely meant a great deal to us and to the people we serve.\n\nWith gratitude,\n{{charity_name}}",
    banner_title: 'A note from {{charity_name}}',
    banner_subtitle: '',
  },
  pledge_thank_you: {
    subject: 'Thank you for fulfilling your pledge, {{donor_name}}!',
    body: "Dear {{donor_name}},\n\nYour pledge just came through — thank you for following through on it. Promises like this are easy to make and easy to forget, so the fact that you didn't means a great deal to us.\n\nWith gratitude,\n{{charity_name}}",
    banner_title: '🎉 Pledge Fulfilled!',
    banner_subtitle: 'Thank you, {{donor_name}}',
  },
  pledge_reminder_upcoming: {
    subject: 'Following up on your pledge to {{charity_name}}',
    body: "Dear {{donor_name}},\n\nJust a gentle, friendly reminder that your pledge of ${{amount}} is expected around {{due_date}}. No pressure at all — we just wanted to give you a heads-up. Thank you again for your generosity; we're genuinely looking forward to it.\n\nWith thanks,\n{{charity_name}}",
    banner_title: 'A quick note from {{charity_name}}',
    banner_subtitle: '',
  },
  pledge_reminder_overdue: {
    subject: 'Following up on your pledge to {{charity_name}}',
    body: "Dear {{donor_name}},\n\nWe haven't yet received your pledge of ${{amount}}, which was expected around {{due_date}} — just wanted to check in, no rush and no worries at all. If something's come up or you need a hand with anything, just let us know.\n\nWith thanks,\n{{charity_name}}",
    banner_title: 'A quick note from {{charity_name}}',
    banner_subtitle: '',
  },
  recurring_gift_reminder: {
    subject: 'A quick note about your recurring gift to {{charity_name}}',
    body: "Dear {{donor_name}},\n\nWe noticed we haven't received your usual ${{amount}} {{frequency}} gift recently. This happens sometimes — an expired card, updated bank details, a lapsed standing instruction — so nothing to worry about, we just wanted to flag it in case you'd like to check on your end.\n\nThank you, as always, for your continued support.\n\nWith thanks,\n{{charity_name}}",
    banner_title: 'A quick note from {{charity_name}}',
    banner_subtitle: '',
  },
  lapsed_reminder_lapsed: {
    subject: 'We miss you, {{donor_name}}!',
    body: "Dear {{donor_name}},\n\nIt's been a while since your last gift, and we wanted to reach out simply because we've missed you. Your past support of ${{amount}} over {{count}} gifts made a real difference, and we'd love to have you back whenever the time feels right.\n\nNo pressure at all — just wanted you to know we're thinking of you.\n\nWith gratitude,\n{{charity_name}}",
    banner_title: 'A note from {{charity_name}}',
    banner_subtitle: '',
  },
  lapsed_reminder_giving_change: {
    subject: 'Just checking in, {{donor_name}}',
    body: "Dear {{donor_name}},\n\nWe noticed your most recent gift looked a little different from your usual giving, and we just wanted to check in — no concerns at all, we simply value you as a supporter and wanted to make sure everything's okay on your end.\n\nYour generosity over the years has meant a lot to us, and we're grateful for your continued support in whatever way works for you.\n\nWarmly,\n{{charity_name}}",
    banner_title: 'A note from {{charity_name}}',
    banner_subtitle: '',
  },
  mass_appeal: {
    subject: '{{charity_name}} needs your support — {{cause_title}}',
    body: "Hi [name],\n\nI'm reaching out personally because your support has meant so much to us over the years, and we could really use it again right now. If you're able to help, even a small gift would mean the world to us today.\n\nThank you, as always, for being in our corner.\n\n{{charity_name}}",
  },
}

const EMAIL_TEMPLATE_PREVIEW_VARS = {
  donor_name: 'Sarah Tan', charity_name: 'Your Charity', amount: '150', pledge_amount: '500',
  date: '19 July 2026', due_date: '30 July 2026', cause_title: 'Youth Mentorship Fund',
  frequency: 'monthly', count: '4',
}

const CAMPAIGN_CATEGORIES = ['Community Development', 'Education', 'Health', 'Social & Welfare', 'Arts & Heritage', 'Sports', 'Environment', 'Advancement of Religion', 'Others']

const EMPTY_CAUSE_FORM = { title: '', description: '', target_amount: '', start_date: '', end_date: '', cost: '', category: '', tax_deductible: true, benefit_value: '', permit_number: '', permit_status: 'not_required', permit_expiry: '' }

const VALID_TABS = ['donors', 'donations', 'dashboard', 'iras', 'activity', 'promotions', 'recurring', 'pledges', 'grants', 'inkind', 'reports', 'settings']
const MODULE_TAB_IDS: Record<string, string> = { campaigns: 'promotions', pledges: 'pledges', recurring: 'recurring', grants: 'grants' }
const VOLUNTEER_ALLOWED_TABS = ['donations', 'settings']
const BOARD_ALLOWED_TABS = ['dashboard', 'settings']
const DONOR_COLUMN_OPTIONS = [
  { key: 'total', label: 'Total Given' },
  { key: 'count', label: 'Donations' },
  { key: 'avg', label: 'Avg. Donation' },
  { key: 'lastDate', label: 'Last Donation' },
  { key: 'recurring', label: 'Recurring Status' },
  { key: 'pledge', label: 'Pledge Status' },
  { key: 'warmth', label: 'Relationship Warmth' },
]
const DONATION_COLUMN_OPTIONS = [
  { key: 'amount', label: 'Amount' },
  { key: 'date', label: 'Date' },
  { key: 'cause', label: 'Cause' },
  { key: 'source', label: 'Source' },
  { key: 'reference', label: 'Reference' },
  { key: 'nric', label: 'NRIC' },
  { key: 'payment', label: 'Payment' },
  { key: 'receipt', label: 'Receipt' },
  { key: 'receiptNo', label: 'Receipt No.' },
  { key: 'thankYou', label: 'Thank You' },
]

export default function App() {
  const screenSize = useScreenSize()
  const isMobile = screenSize === 'mobile'
  const isTablet = screenSize === 'tablet'
  const [donations, setDonations] = useState<any[]>([])
  const [emailTemplates, setEmailTemplates] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState<any>(true)
  const [, setIssuing] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const charityName = session?.user?.app_metadata?.charity_name || 'Your Charity'
  const [authLoading, setAuthLoading] = useState<any>(true)
  const { tab: tabParam } = useParams()
  const navigate = useNavigate()
  const activeTab = VALID_TABS.includes(tabParam) ? tabParam : 'dashboard'
  const setActiveTab = React.useCallback((nextTab: any) => navigate(`/${nextTab}`), [navigate])
  useEffect(() => {
    if (!VALID_TABS.includes(tabParam)) navigate('/dashboard', { replace: true })
  }, [tabParam, navigate])
  const [settingsSection, setSettingsSection] = useState<any>('general')
  const [selectedDonor, setSelectedDonor] = useState<any>(null)
  const [donorProfileTab, setDonorProfileTab] = useState<any>('donations')
  const [donorHistoryPage, setDonorHistoryPage] = useState<any>(1)
  const [pendingSelectedDonorKey, setPendingSelectedDonorKey] = useState<any>(null)
  // Callers that need to open the profile on a specific tab (e.g. jumping to Logs) set this
  // ref right before calling setSelectedDonor — this effect consumes it instead of always
  // resetting to 'donations'.
  const pendingDonorProfileTabRef = React.useRef<any>(null)
  useEffect(() => {
    setDonorProfileTab(pendingDonorProfileTabRef.current || 'donations')
    pendingDonorProfileTabRef.current = null
    setDonorHistoryPage(1)
  }, [selectedDonor?.email, selectedDonor?.name])

  // Remember scroll position per tab so switching tabs and coming back (e.g. clicking a grant
  // from Analytics, then returning) restores where you were instead of dumping you at the top.
  const tabScrollPositions = useRef<Record<string, any>>({})
  const intentionalSignOutRef = useRef<boolean>(false)
  // Warns before the browser navigates away entirely (Back button, closing the tab, typing a new
  // URL) — this is a single-page app with no per-tab history entries, so Back doesn't switch tabs,
  // it exits the app outright.
  useEffect(() => {
    if (!session) return

    // Closing the tab / refreshing / typing a new URL can't show a custom dialog — browsers force
    // a generic native prompt for those, for phishing-prevention reasons. Keep that as a fallback.
    // The Back/Forward buttons no longer need a guard here (Phase 6): each tab is a real URL now,
    // so Back/Forward between tabs is legitimate in-app navigation, not "leaving the app" — a
    // popstate hijack here would fight React Router's own history entries.
    function onBeforeUnload(e: any) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [session])
  useEffect(() => {
    const onScroll = () => { tabScrollPositions.current[activeTab] = window.scrollY }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [activeTab])
  useEffect(() => {
    const saved = tabScrollPositions.current[activeTab] || 0
    requestAnimationFrame(() => window.scrollTo(0, saved))
  }, [activeTab])

  const ANALYTICS_NAV_OFFSET = 64 // approx height of the sticky section-jump bar, so scrolled-to titles land just below it instead of hidden behind it
  const [activeAnalyticsSection, setActiveAnalyticsSection] = useState<any>('analytics-section-today')

  // Shared keyboard handling for every modal: Escape triggers the topmost overlay's own
  // backdrop-click handler (so each modal's existing close/guard logic — e.g. blocking
  // close mid-migration — is reused rather than duplicated), and Tab is trapped within
  // the topmost overlay so focus can't silently leak into the page behind it.
  useEffect(() => {
    function getTopOverlay() {
      const overlays = document.querySelectorAll('[data-modal-overlay="true"]')
      return overlays.length ? overlays[overlays.length - 1] : null
    }
    function onKeyDown(e: any) {
      const overlay = getTopOverlay()
      if (!overlay) return
      if (e.key === 'Escape') {
        overlay.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        return
      }
      if (e.key === 'Tab') {
        const focusable = overlay.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!session) return
    if (selectedDonor) {
      supabase.auth.updateUser({ data: { last_selected_donor: selectedDonor.email?.trim() || selectedDonor.name } })
    } else {
      supabase.auth.updateUser({ data: { last_selected_donor: null } })
    }
    // intentionally fires only on donor selection change; session is a guard, not a trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDonor])
  const [searchTerm, setSearchTerm] = useState<any>('')
  const [filterType, setFilterType] = useState<any>('All')
  const [filterNric, setFilterNric] = useState<any>('All')
  const [filterYear, setFilterYear] = useState<any>(new Date().getFullYear().toString())
  const [filterSource, setFilterSource] = useState<any>('All')
  const [filterThankYou, setFilterThankYou] = useState<any>('All')
  const [filterMinAmount, setFilterMinAmount] = useState<any>(null)
  const [donationFilterLabel, setDonationFilterLabel] = useState<any>(null)
  const [donationsPage, setDonationsPage] = useState<any>(0)
  const [donationsPerPage, setDonationsPerPage] = useState<any>(25)
  const [donorsPage, setDonorsPage] = useState<any>(0)
  const [donorsPerPage, setDonorsPerPage] = useState<any>(25)
  const [donationSortBy, setDonationSortBy] = useState<any>(null)
  const [donationSortDir, setDonationSortDir] = useState<any>('desc')

  const [showManualForm, setShowManualForm] = useState<any>(false)
  const EMPTY_MANUAL_FORM = { donor_name: '', donor_nric: '', amount: '', payment_method: 'Cash', notes: '', donor_email: '', date: new Date().toISOString().split('T')[0], cause_id: '', receipt_name: '', is_anonymous: false, acquisition_source: '', referred_by_donor_key: '', acquisition_source_detail: '', payment_ref: '', already_verified: false }
  const [manualForm, setManualForm] = useState<any>(EMPTY_MANUAL_FORM)
  const [manualReferralSearch, setManualReferralSearch] = useState<any>('')
  const [editingDonationId, setEditingDonationId] = useState<any>(null)
  function resetManualForm() {
    setManualForm({ ...EMPTY_MANUAL_FORM, date: new Date().toISOString().split('T')[0] })
    setManualReferralSearch('')
    setEditingDonationId(null)
  }
  function closeManualForm() {
    if (editingDonationId) {
      setConfirmModal({
        title: 'Discard changes?',
        description: 'You have unsaved changes to this donation entry. Closing now will discard them.',
        confirmLabel: 'Discard changes',
        onConfirm: () => { setShowManualForm(false); setManualError(''); resetManualForm() },
      })
      return
    }
    setShowManualForm(false)
    setManualError('')
    resetManualForm()
  }
  const [manualError, setManualError] = useState<any>('')
  const [savingManual, setSavingManual] = useState<any>(false)
  const [manualDuplicateWarning, setManualDuplicateWarning] = useState<any>(null)
  const [showVoidModal, setShowVoidModal] = useState<any>(false)
  const [voidReason, setVoidReason] = useState<any>('')
  const [voidingReceipt, setVoidingReceipt] = useState<any>(false)
  const [donorNotes, setDonorNotes] = useState<any[]>([])
  const [donorNotesLoading, setDonorNotesLoading] = useState<any>(false)
  const [newNoteText, setNewNoteText] = useState<any>('')
  const [newNoteType, setNewNoteType] = useState<any>('note')
  const [savingNote, setSavingNote] = useState<any>(false)
  const [editingDonorNoteId, setEditingDonorNoteId] = useState<any>(null)
  const [editingDonorNoteText, setEditingDonorNoteText] = useState<any>('')
  const [savingDonorNoteEdit, setSavingDonorNoteEdit] = useState<any>(false)
  const [donorTagsMap, setDonorTagsMap] = useState<Record<string, any>>({})
  const [donorLastContactMap, setDonorLastContactMap] = useState<Record<string, any>>({})
  const [donorReceiptNameOverrides, setDonorReceiptNameOverrides] = useState<Record<string, any>>({})
  const [householdLinkSearch, setHouseholdLinkSearch] = useState<any>('')
  const [newTagInput, setNewTagInput] = useState<any>('')
  const [, setSavingTag] = useState<any>(false)
  const [savingCommPrefs, setSavingCommPrefs] = useState<any>(false)
  const [savingHousehold, setSavingHousehold] = useState<any>(false)
  const [savingReceiptOverride, setSavingReceiptOverride] = useState<any>(false)
  const [savingFamilyContact, setSavingFamilyContact] = useState<any>(false)
  const [savingVisitSchedule, setSavingVisitSchedule] = useState<any>(false)
  const [savingBirthday, setSavingBirthday] = useState<any>(false)
  const [savingTaxResidency, setSavingTaxResidency] = useState<any>(false)
  const [savingMailingAddress, setSavingMailingAddress] = useState<any>(false)
  const [donorSortBy, setDonorSortBy] = useState<any>(null)
  const [donorSortDir, setDonorSortDir] = useState<any>('asc')
  const [donorColumnOrder, setDonorColumnOrder] = useState<any>(DONOR_COLUMN_OPTIONS.map(o => o.key))
  const [draggedDonorColumn, setDraggedDonorColumn] = useState<any>(null)
  const orderedDonorColumns = donorColumnOrder.map((k: any) => DONOR_COLUMN_OPTIONS.find(o => o.key === k)).filter(Boolean)
  const reorderDonorColumn = (fromKey: any, toKey: any) => {
    if (!fromKey || fromKey === toKey) return
    setDonorColumnOrder((prev: any) => {
      const next = prev.filter((k: any) => k !== fromKey)
      const toIndex = next.indexOf(toKey)
      next.splice(toIndex, 0, fromKey)
      supabase.auth.updateUser({ data: { donor_column_order: next } })
      return next
    })
  }
  const [donationColumnOrder, setDonationColumnOrder] = useState<any>(DONATION_COLUMN_OPTIONS.map(o => o.key))
  const [draggedDonationColumn, setDraggedDonationColumn] = useState<any>(null)
  const orderedDonationColumns = donationColumnOrder.map((k: any) => DONATION_COLUMN_OPTIONS.find(o => o.key === k)).filter(Boolean)
  const reorderDonationColumn = (fromKey: any, toKey: any) => {
    if (!fromKey || fromKey === toKey) return
    setDonationColumnOrder((prev: any) => {
      const next = prev.filter((k: any) => k !== fromKey)
      const toIndex = next.indexOf(toKey)
      next.splice(toIndex, 0, fromKey)
      supabase.auth.updateUser({ data: { donation_column_order: next } })
      return next
    })
  }
  const [userRole, setUserRole] = useState<any>('volunteer')
  const [roleLoaded, setRoleLoaded] = useState<any>(false)
  const [volunteerInput, setVolunteerInput] = useState<any>('')
  const [showAddTeamMemberModal, setShowAddTeamMemberModal] = useState<any>(false)
  const [newTeamMemberRole, setNewTeamMemberRole] = useState<any>('ed')
  const [volunteerEditEntry, setVolunteerEditEntry] = useState<any>(null)
  const [volunteerEditForm, setVolunteerEditForm] = useState<any>({ donor_name: '', amount: '', date: '', notes: '', donor_email: '', donor_nric: '', payment_method: 'Cash', cause_id: '' })
  const [volunteerFlagMessage, setVolunteerFlagMessage] = useState<any>('')
  const [volunteerEditError, setVolunteerEditError] = useState<any>('')
  const [savingVolunteer, setSavingVolunteer] = useState<any>(false)
  const [localVolunteers, setLocalVolunteers] = useState<any[]>([])
  const [localEds, setLocalEds] = useState<any[]>([])
  const [localBoardMembers, setLocalBoardMembers] = useState<any[]>([])
  const [localStaff, setLocalStaff] = useState<any[]>([])
  const [customObligations, setCustomObligations] = useState<any[]>([])
  const [customTasks, setCustomTasks] = useState<any[]>([])
  const [showAddTask, setShowAddTask] = useState<any>(false)
  const [taskForm, setTaskForm] = useState<any>({ title: '', date: '' })
  const [showDoneTasks, setShowDoneTasks] = useState<any>(false)
  const [showAddObligation, setShowAddObligation] = useState<any>(false)
  const [obligationForm, setObligationForm] = useState<any>({ title: '', date: '', repeat: 'annual' })  
  const [sidebarCollapsed, setSidebarCollapsed] = useState<any>(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 0
    return w > 640 && w <= 1024
  })
  const [pledges, setPledges] = useState<any[]>([])
  const [showPledgeForm, setShowPledgeForm] = useState<any>(false)
  const [editingPledge, setEditingPledge] = useState<any>(null)
  const [pledgeForm, setPledgeForm] = useState<any>({ donor_name: '', donor_email: '', donor_phone: '', amount: '', expected_date: '', notes: '', is_multi_year: false, total_years: '3', cause_id: '', is_anonymous: false, source: '' })
  const [pledgeInstalments, setPledgeInstalments] = useState<any[]>([])
  const [grants, setGrants] = useState<any[]>([])
  const [showGrantForm, setShowGrantForm] = useState<any>(false)
  const [editingGrant, setEditingGrant] = useState<any>(null)
  const [recurringExpenses, setRecurringExpenses] = useState<any[]>([])
  const monthlyExpenses = recurringExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const [newExpenseForm, setNewExpenseForm] = useState<any>({ name: '', amount: '' })
  const [refunds, setRefunds] = useState<any[]>([])
  const [showRefundForm, setShowRefundForm] = useState<any>(false)
  const [inKindDonations, setInKindDonations] = useState<any[]>([])
  const [showInKindForm, setShowInKindForm] = useState<any>(false)
  const [editingInKindId, setEditingInKindId] = useState<any>(null)
  const [inKindForm, setInKindForm] = useState<any>({ donor_name: '', donor_email: '', donor_nric: '', donor_phone: '', category: 'goods', item_description: '', estimated_value: '', received_date: new Date().toISOString().split('T')[0], cause_id: '', notes: '', is_anonymous: false, valuation_basis: '', condition: '' })
  const [savingInKind, setSavingInKind] = useState<any>(false)
  const [inKindError, setInKindError] = useState<any>('')
  const [inKindThankYouModal, setInKindThankYouModal] = useState<any>(null)
  const [inKindThankYouPreviewing, setInKindThankYouPreviewing] = useState<any>(false)
  const [inKindThankYouSubject, setInKindThankYouSubject] = useState<any>('')
  const [inKindThankYouMessage, setInKindThankYouMessage] = useState<any>('')
  const [sendingInKindThankYouId, setSendingInKindThankYouId] = useState<any>(null)
  const [showDonationMoreActions, setShowDonationMoreActions] = useState<any>(false)
  const [refundForm, setRefundForm] = useState<any>({ reason: '' })
  const [savingRefund, setSavingRefund] = useState<any>(false)
  const [grantExpenses, setGrantExpenses] = useState<any[]>([])
  const [grantReports, setGrantReports] = useState<Record<string, any>>({})
  const [grantTranches, setGrantTranches] = useState<Record<string, any>>({})
  const [grantMatchClaims, setGrantMatchClaims] = useState<Record<string, any>>({})
  const [grantNotes, setGrantNotes] = useState<Record<string, any>>({})
  const [expandedGrantId, setExpandedGrantId] = useState<any>(null)
  const [expandedRecurringId, setExpandedRecurringId] = useState<any>(null)
  const [recurringMoreMenuId, setRecurringMoreMenuId] = useState<any>(null)
  const [editingRecurringDonationId, setEditingRecurringDonationId] = useState<any>(null)
  const [editingRecurringAmount, setEditingRecurringAmount] = useState<any>('')
  const [editingRecurringNote, setEditingRecurringNote] = useState<any>('')
  const [savingRecurringAmount, setSavingRecurringAmount] = useState<any>(false)
  const [editingPledgeDonationId, setEditingPledgeDonationId] = useState<any>(null)
  const [editingPledgeAmount, setEditingPledgeAmount] = useState<any>('')
  const [editingPledgeNotes, setEditingPledgeNotes] = useState<any>('')
  const [savingPledgeAmount, setSavingPledgeAmount] = useState<any>(false)
  const [grantSearchTerm, setGrantSearchTerm] = useState<any>('')
  const [grantYearFilter, setGrantYearFilter] = useState<any>('All')
  const [grantAmountFilter, setGrantAmountFilter] = useState<any>('All')
  const [highlightedGrantId, setHighlightedGrantId] = useState<any>(null)
  const [grantUrgencyFilter, setGrantUrgencyFilter] = useState<any>('All')
  const [grantFunderTypeFilter, setGrantFunderTypeFilter] = useState<any>('All')
  const [grantFundingTypeFilter, setGrantFundingTypeFilter] = useState<any>('All')
  const [grantSortBy, setGrantSortBy] = useState<any>('start_desc')
  const grantExpenseCategories = ['Programme Costs', 'Staff Costs', 'Administrative Overhead', 'Fundraising Costs', 'Other']
  const campaignExpenseCategories = ['Printing & Materials', 'Venue & Logistics', 'Marketing & Promotion', 'Volunteer/Staff Costs', 'Other']
  const [campaignExpenses, setCampaignExpenses] = useState<any[]>([])
  const [expandedCampaignId, setExpandedCampaignId] = useState<any>(null)
  const [pledgeError, setPledgeError] = useState<any>('')
  const [savingPledge, setSavingPledge] = useState<any>(false)
  
  const [pledgeCompletionCandidate, setPledgeCompletionCandidate] = useState<any>(null)
  const [showPledgeThankYouModal, setShowPledgeThankYouModal] = useState<any>(false)
  const [pledgeThankYouSubject, setPledgeThankYouSubject] = useState<any>('')
  const [pledgeThankYouBody, setPledgeThankYouBody] = useState<any>('')
  const [sendingPledgeThankYou, setSendingPledgeThankYou] = useState<any>(false)
  const [pledgeThankYouPreviewing, setPledgeThankYouPreviewing] = useState<any>(false)
  const [pledgeGivenTotals, setPledgeGivenTotals] = useState<Record<string, any>>({})
  const [pledgeDonationLinks, setPledgeDonationLinks] = useState<Record<string, any>>({})
  const [expandedPledgeId, setExpandedPledgeId] = useState<any>(null)
  const [pledgeMoreMenuId, setPledgeMoreMenuId] = useState<any>(null)
  const [pledgeRescheduleHistory, setPledgeRescheduleHistory] = useState<Record<string, any>>({})
  const [rescheduleModal, setRescheduleModal] = useState<any>(null)
  const [rescheduleNewDate, setRescheduleNewDate] = useState<any>('')
  const [rescheduleReason, setRescheduleReason] = useState<any>('')
  const [reschedulingPledge, setReschedulingPledge] = useState<any>(false)
  const [senderDomainStatus, setSenderDomainStatus] = useState<any>('none')
  const [senderDomain, setSenderDomain] = useState<any>('')
  const [senderEmailLocalPart, setSenderEmailLocalPart] = useState<any>('hello')
  const [senderDomainInput, setSenderDomainInput] = useState<any>('')
  const [showDomainSetup, setShowDomainSetup] = useState<any>(false)
  const [savingDomain, setSavingDomain] = useState<any>(false)
  const [dnsRecords, setDnsRecords] = useState<any>(null)
  const [checkingVerification, setCheckingVerification] = useState<any>(false)
  const [pledgeReminderHistory, setPledgeReminderHistory] = useState<Record<string, any>>({})
  const [showManualPledgeLinkModal, setShowManualPledgeLinkModal] = useState<any>(false)
  const [manualPledgeLinkSelection, setManualPledgeLinkSelection] = useState<any>('')
  const [linkingPledgeManually, setLinkingPledgeManually] = useState<any>(false)
  const [showPledgeFilters, setShowPledgeFilters] = useState<any>(false)
  const [showGrantFilters, setShowGrantFilters] = useState<any>(false)
  const [showDonorFilters, setShowDonorFilters] = useState<any>(false)
  const [showDonationFilters, setShowDonationFilters] = useState<any>(false)
  const [showCampaignFilters, setShowCampaignFilters] = useState<any>(false)
  const [showAuditFilters, setShowAuditFilters] = useState<any>(false)
  const [showRecurringFilters, setShowRecurringFilters] = useState<any>(false)
  const [pledgeSearchTerm, setPledgeSearchTerm] = useState<any>('')
  const [pledgeUrgencyFilter, setPledgeUrgencyFilter] = useState<any>('All')
  const [pledgeAmountFilter, setPledgeAmountFilter] = useState<any>('All')
  const [pledgeYearFilter, setPledgeYearFilter] = useState<any>('All')
  const [pledgeTypeFilter, setPledgeTypeFilter] = useState<any>('All')
  const [pledgeProgrammeFilter, setPledgeProgrammeFilter] = useState<any>('All')
  const [pledgeSortBy, setPledgeSortBy] = useState<any>('expected_asc')
  const [massAppealSearchTerm, setMassAppealSearchTerm] = useState<any>('')
  const [recurringYearFilter, setRecurringYearFilter] = useState<any>('All')
  const [showCampaignModal, setShowCampaignModal] = useState<any>(false)
  const [campaignSearchTerm, setCampaignSearchTerm] = useState<any>('')
  const [showPastCampaigns, setShowPastCampaigns] = useState<any>(false)
  const [showPastGrants, setShowPastGrants] = useState<any>(false)
  const [campaignYearFilter, setCampaignYearFilter] = useState<any>('All')
  const [campaignAmountFilter, setCampaignAmountFilter] = useState<any>('All')
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<any>('All')
  const [campaignSortBy, setCampaignSortBy] = useState<any>('created_desc')
  const [expandedAppealYears, setExpandedAppealYears] = useState<any>(() => new Set([new Date().getFullYear()]))
  const [showFulfilledPledges, setShowFulfilledPledges] = useState<any>(false)
  const [showCancelledPledges, setShowCancelledPledges] = useState<any>(false)
  const [showPausedRecurring, setShowPausedRecurring] = useState<any>(false)
  const [showCancelledRecurring, setShowCancelledRecurring] = useState<any>(false)
  const [recurringSearchTerm, setRecurringSearchTerm] = useState<any>('')
  const [recurringUrgencyFilter, setRecurringUrgencyFilter] = useState<any>('All')
  const [recurringAmountFilter, setRecurringAmountFilter] = useState<any>('All')
  const [recurringTypeFilter, setRecurringTypeFilter] = useState<any>('All')
  const [recurringProgrammeFilter, setRecurringProgrammeFilter] = useState<any>('All')
  const [recurringAuthFilter, setRecurringAuthFilter] = useState<any>('All')
  const [recurringSortBy, setRecurringSortBy] = useState<any>('next_asc')
  const [markReceivedModal, setMarkReceivedModal] = useState<any>(null)
  const [markReceivedAmount, setMarkReceivedAmount] = useState<any>('')
  const [markReceivedNote, setMarkReceivedNote] = useState<any>('')
  const [markingReceived, setMarkingReceived] = useState<any>(false)
  const [recurringGivenTotals, setRecurringGivenTotals] = useState<Record<string, any>>({})
  const [lapsedReminderCandidate, setLapsedReminderCandidate] = useState<any>(null)
  const [showLapsedReminderModal, setShowLapsedReminderModal] = useState<any>(false)
  const [lapsedReminderSubject, setLapsedReminderSubject] = useState<any>('')
  const [lapsedReminderBody, setLapsedReminderBody] = useState<any>('')
  const [sendingLapsedReminder, setSendingLapsedReminder] = useState<any>(false)
  const [lapsedReminderPreviewing, setLapsedReminderPreviewing] = useState<any>(false)
  const [lapsedReminderHistory, setLapsedReminderHistory] = useState<Record<string, any>>({})
  const [lapsedDismissals, setLapsedDismissals] = useState<Record<string, any>>({})
  const [showLapsedDismissModal, setShowLapsedDismissModal] = useState<any>(null)
  const [lapsedDismissReason, setLapsedDismissReason] = useState<any>('')
  const [lapsedDismissCategory, setLapsedDismissCategory] = useState<any>('unknown')
  const [dismissingLapsed, setDismissingLapsed] = useState<any>(false)
  const [showDismissedLapsedDonors, setShowDismissedLapsedDonors] = useState<any>(false)
  const [showAllLapsedDonors, setShowAllLapsedDonors] = useState<any>(false)
  const [showAllOverdueUnits, setShowAllOverdueUnits] = useState<any>(false)
  const [showAllPledgeWatchlist, setShowAllPledgeWatchlist] = useState<any>(false)
  const [showAllPledgeConcentration, setShowAllPledgeConcentration] = useState<any>(false)
  const [showAllMissedPayments, setShowAllMissedPayments] = useState<any>(false)
  const [showAllEndingSoon, setShowAllEndingSoon] = useState<any>(false)
  const [showAllPausedGifts, setShowAllPausedGifts] = useState<any>(false)
  const [showAllFrequentSkippers, setShowAllFrequentSkippers] = useState<any>(false)
  const [showAllConcentrationDonors, setShowAllConcentrationDonors] = useState<any>(false)
  const [showAppealPreview, setShowAppealPreview] = useState<any>(false)
  const [sendingTestAppeal, setSendingTestAppeal] = useState<any>(false)
  const [selectedAppealDetail, setSelectedAppealDetail] = useState<any>(null)
  const [appealRecipients, setAppealRecipients] = useState<any[]>([])
  const [loadingAppealDetail, setLoadingAppealDetail] = useState<any>(false)
  const [retryingAppealRecipients, setRetryingAppealRecipients] = useState<any>(false)
  const [retryPreviewList, setRetryPreviewList] = useState<any>(null)
  const [appealRecipientSearchTerm, setAppealRecipientSearchTerm] = useState<any>('')
  const [appealRecipientStatusFilter, setAppealRecipientStatusFilter] = useState<any>('All')
  const [showMassAppealModal, setShowMassAppealModal] = useState<any>(false)
  const [generalAppealsExpanded, setGeneralAppealsExpanded] = useState<any>(false)
  const [expandedCampaignAppeals, setExpandedCampaignAppeals] = useState<any>(new Set())
  const [donorContacts, setDonorContacts] = useState<any[]>([])
  const [showAddDonorModal, setShowAddDonorModal] = useState<any>(false)
  const [addDonorForm, setAddDonorForm] = useState<any>({ full_name: '', email: '', notes: '' })
  const [donorStatusFilter, setDonorStatusFilter] = useState<any>('All')
  const [donorYearFilter, setDonorYearFilter] = useState<any>('All')
  const [addDonorError, setAddDonorError] = useState<any>('')
  const [savingDonorContact, setSavingDonorContact] = useState<any>(false)

  async function loadDonorContacts(activeSession = session) {
    const uen = activeSession?.user?.app_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase
      .from('charity_donor_contacts')
      .select('*')
      .eq('charity_uen', uen)
      .order('created_at', { ascending: false })
    if (error) { console.error('Could not load donor contacts:', error); return }
    setDonorContacts(data || [])
    const overrideMap: Record<string, any> = {}
    ;(data || []).forEach(c => {
      if (c.receipt_name_override?.trim()) {
        const key = c.email?.trim() || c.full_name
        overrideMap[key] = c.receipt_name_override.trim()
      }
    })
    setDonorReceiptNameOverrides(overrideMap)
  }
  const [massAppealYearFilter, setMassAppealYearFilter] = useState<any>('All')
  const [massAppealAmountFilter, setMassAppealAmountFilter] = useState<any>('All')
  const [massAppealProgrammeFilter, setMassAppealProgrammeFilter] = useState<any>('All')
  const [massAppealStatusFilter, setMassAppealStatusFilter] = useState<any>('All')
  const [massAppealSortBy, setMassAppealSortBy] = useState<any>('created_desc')
  const [showAllBounceReasons, setShowAllBounceReasons] = useState<any>(false)
  const [showAllFatigueList, setShowAllFatigueList] = useState<any>(false)
  const [showAllOverGivers, setShowAllOverGivers] = useState<any>(false)
  const [allAppealRecipients, setAllAppealRecipients] = useState<any[]>([])

  async function openAppealDetail(appeal: any) {
    setSelectedAppealDetail(appeal)
    setLoadingAppealDetail(true)
    setAppealRecipientSearchTerm('')
    setAppealRecipientStatusFilter('All')
    const { data, error } = await supabase
      .from('mass_appeal_recipients')
      .select('*')
      .eq('appeal_id', appeal.id)
      .order('created_at', { ascending: true })
    if (error) { console.error('Could not load appeal recipients:', error) }
    setAppealRecipients(data || [])
    setLoadingAppealDetail(false)
  }
  const [givingChangeMinGifts, setGivingChangeMinGifts] = useState<any>(3)
  const [givingChangeMinPct, setGivingChangeMinPct] = useState<any>(30)
  const [showAllGivingChanges, setShowAllGivingChanges] = useState<any>(false)
  const [givingChangeAckHistory, setGivingChangeAckHistory] = useState<Record<string, any>>({})

  function buildUpgradeThankYouNote(donor: any, changePct: any, recent: any) {
    const lines = []
    lines.push(`Dear ${donor.name},`)
    lines.push('')
    lines.push(`We noticed your most recent gift of $${recent.toLocaleString()} was a real step up from your usual giving — and we wanted to take a moment to personally thank you for it. Support like yours genuinely makes a difference to the work we do.`)
    lines.push('')
    lines.push(`We're deeply grateful to have you in our corner.`)
    lines.push('')
    lines.push(`With warm thanks,`)
    lines.push(charityName)
    return lines.join('\n')
  }

  

  useEffect(() => {
    if (showLapsedReminderModal && lapsedReminderCandidate) {
      const d = lapsedReminderCandidate
      if (d.givingChangeMeta) {
        const key = 'lapsed_reminder_giving_change'
        const saved = emailTemplates[key]
        const vars = { donor_name: d.name, charity_name: charityName }
        setLapsedReminderSubject(fillTemplate(saved?.subject || EMAIL_TEMPLATE_DEFAULTS[key].subject, vars))
        setLapsedReminderBody(fillTemplate(saved?.body || EMAIL_TEMPLATE_DEFAULTS[key].body, vars))
      } else {
        const key = 'lapsed_reminder_lapsed'
        const saved = emailTemplates[key]
        const vars = { donor_name: d.name, charity_name: charityName, amount: d.total.toLocaleString(), count: d.count }
        setLapsedReminderSubject(fillTemplate(saved?.subject || EMAIL_TEMPLATE_DEFAULTS[key].subject, vars))
        setLapsedReminderBody(fillTemplate(saved?.body || EMAIL_TEMPLATE_DEFAULTS[key].body, vars))
      }
      setLapsedReminderPreviewing(false)
    }
  }, [showLapsedReminderModal, lapsedReminderCandidate, emailTemplates, charityName])
  const [skipCycleModal, setSkipCycleModal] = useState<any>(null)
  const [skipCycleReason, setSkipCycleReason] = useState<any>('')
  const [skippingCycle, setSkippingCycle] = useState<any>(false)
  const [recurringSkipHistory, setRecurringSkipHistory] = useState<Record<string, any>>({})
  const [recurringReminderCandidate, setRecurringReminderCandidate] = useState<any>(null)
  const [showRecurringReminderModal, setShowRecurringReminderModal] = useState<any>(false)
  const [recurringReminderSubject, setRecurringReminderSubject] = useState<any>('')
  const [recurringReminderBody, setRecurringReminderBody] = useState<any>('')
  const [sendingRecurringReminder, setSendingRecurringReminder] = useState<any>(false)
  const [recurringReminderPreviewing, setRecurringReminderPreviewing] = useState<any>(false)
  const [recurringReminderHistory, setRecurringReminderHistory] = useState<Record<string, any>>({})
  const [editingRecurringGift, setEditingRecurringGift] = useState<any>(null)
  const [pauseGiftModal, setPauseGiftModal] = useState<any>(null)
  const [pauseReasonInput, setPauseReasonInput] = useState<any>('')
  const [pauseResumeDateInput, setPauseResumeDateInput] = useState<any>('')
  const [pausingGift, setPausingGift] = useState<any>(false)
  const [failedDeductionModal, setFailedDeductionModal] = useState<any>(null)
  const [failedDeductionReason, setFailedDeductionReason] = useState<any>('Insufficient funds')
  const [recordingFailedDeduction, setRecordingFailedDeduction] = useState<any>(false)
  const [recurringFailedDeductionHistory, setRecurringFailedDeductionHistory] = useState<Record<string, any>>({})
  const [filterTopDonorNames, setFilterTopDonorNames] = useState<any>(null)
  // Key-based donor filter — used by dashboard "Worth knowing" jumps, which identify specific donor
  // records by key. Filtering by name would over-select when several donors share a name.
  const [filterDonorKeys, setFilterDonorKeys] = useState<any>(null)
  const [donorFilterLabel, setDonorFilterLabel] = useState<any>(null)
  const [activeInsightKey, setActiveInsightKey] = useState<any>(null)
  const [insightDismissals, setInsightDismissals] = useState<any[]>([])
  const [concentrationTopN, setConcentrationTopN] = useState<any>(10)
  const [pledgeWatchThreshold, setPledgeWatchThreshold] = useState<any>(2)
  const [pledgeDueSoonDays, setPledgeDueSoonDays] = useState<any>(7)
  const [recurringTrendCycles, setRecurringTrendCycles] = useState<any>(2)
  const [recurringMissedThreshold, setRecurringMissedThreshold] = useState<any>(2)

  const [lapsedMinGifts, setLapsedMinGifts] = useState<any>(2)
  const [lapsedMinDays, setLapsedMinDays] = useState<any>(60)
  const [editingAlertSensitivity, setEditingAlertSensitivity] = useState<boolean>(false)
  const [alertSensitivityInputs, setAlertSensitivityInputs] = useState<Record<string, string>>({})
  const [thankYouThreshold, setThankYouThreshold] = useState<any>(200)
  const [majorDonorThreshold, setMajorDonorThreshold] = useState<any>(1000)
  const [editingDonorThresholds, setEditingDonorThresholds] = useState<any>(false)
  const [thankYouThresholdInput, setThankYouThresholdInput] = useState<any>('200')
  const [majorDonorThresholdInput, setMajorDonorThresholdInput] = useState<any>('1000')
  const [cumulativeThresholds, setCumulativeThresholds] = useState<any>([1000, 5000, 10000])
  const [editingCumulativeThresholds, setEditingCumulativeThresholds] = useState<any>(false)
  const [cumulativeThresholdsInput, setCumulativeThresholdsInput] = useState<any>(['1000', '5000', '10000'])

  useEffect(() => {
    if (showRecurringReminderModal && recurringReminderCandidate) {
      const g = recurringReminderCandidate
      const key = 'recurring_gift_reminder'
      const saved = emailTemplates[key]
      const vars = { donor_name: g.donor_name, charity_name: charityName, amount: Number(g.amount).toLocaleString(), frequency: g.frequency }
      setRecurringReminderSubject(fillTemplate(saved?.subject || EMAIL_TEMPLATE_DEFAULTS[key].subject, vars))
      setRecurringReminderBody(fillTemplate(saved?.body || EMAIL_TEMPLATE_DEFAULTS[key].body, vars))
      setRecurringReminderPreviewing(false)
    }
  }, [showRecurringReminderModal, recurringReminderCandidate, emailTemplates, charityName])
  const [pledgeResolutionModal, setPledgeResolutionModal] = useState<any>(null)
  const [pledgeResolutionNotes, setPledgeResolutionNotes] = useState<any>('')
  const [fulfillAmount, setFulfillAmount] = useState<any>('')
  const [fulfillPaymentMethod, setFulfillPaymentMethod] = useState<any>('Cash')

  const [pledgeReminderCandidate, setPledgeReminderCandidate] = useState<any>(null)
  const [showPledgeReminderModal, setShowPledgeReminderModal] = useState<any>(false)
  const [pledgeReminderSubject, setPledgeReminderSubject] = useState<any>('')
  const [pledgeReminderBody, setPledgeReminderBody] = useState<any>('')
  const [sendingPledgeReminder, setSendingPledgeReminder] = useState<any>(false)
  const [pledgeReminderPreviewing, setPledgeReminderPreviewing] = useState<any>(false)
  const [logContactModal, setLogContactModal] = useState<any>(null)
  const [logContactMethod, setLogContactMethod] = useState<any>('phone')
  const [logContactNote, setLogContactNote] = useState<any>('')
  const [loggingContact, setLoggingContact] = useState<any>(false)

  useEffect(() => {
    if (showPledgeReminderModal && pledgeReminderCandidate) {
      const p = pledgeReminderCandidate
      const daysUntil = Math.ceil((new Date(p.expected_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      const isOverdue = daysUntil < 0
      const key = isOverdue ? 'pledge_reminder_overdue' : 'pledge_reminder_upcoming'
      const saved = emailTemplates[key]
      const vars = { donor_name: p.donor_name, charity_name: charityName, amount: Number(p.amount).toLocaleString(), due_date: new Date(p.expected_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' }) }
      setPledgeReminderSubject(fillTemplate(saved?.subject || EMAIL_TEMPLATE_DEFAULTS[key].subject, vars))
      setPledgeReminderBody(fillTemplate(saved?.body || EMAIL_TEMPLATE_DEFAULTS[key].body, vars))
      setPledgeReminderPreviewing(false)
    }
  }, [showPledgeReminderModal, pledgeReminderCandidate, emailTemplates, charityName])
  const [recurringGifts, setRecurringGifts] = useState<any[]>([])
  const [showRecurringForm, setShowRecurringForm] = useState<any>(false)
  const [savingRecurring, setSavingRecurring] = useState<any>(false)
  const [massAppealForm, setMassAppealForm] = useState<any>({ cause_id: '', amount: '', message: '', customLabel: '' })
  const [showTagSegmentManager, setShowTagSegmentManager] = useState<any>(false)
  const [tagSegmentName, setTagSegmentName] = useState<any>('')
  const [tagSegmentSelectedKeys, setTagSegmentSelectedKeys] = useState<any>(new Set())
  const [tagSegmentSearch, setTagSegmentSearch] = useState<any>('')
  const [savingTagSegment, setSavingTagSegment] = useState<any>(false)
  const [massAppealRefs, setMassAppealRefs] = useState<any[]>([])
  const [massAppealStep, setMassAppealStep] = useState<any>('setup')
  const [massAppealProgress, setMassAppealProgress] = useState<any>(null)
  const massAppealCancelRef = useRef<boolean>(false)
  const massAppealSendingRef = useRef<boolean>(false)
  const [massAppeals, setMassAppeals] = useState<any[]>([])
  const [showMigrationTool, setShowMigrationTool] = useState<any>(false)
  const [, setMigrationFile] = useState<any>(null)
  const [migrationPreview, setMigrationPreview] = useState<any>(null)
  const [migrationErrors, setMigrationErrors] = useState<any[]>([])
  const [migrationProgress, setMigrationProgress] = useState<any>(null)
  const [migrationComplete, setMigrationComplete] = useState<any>(null)
  const migrationCancelRef = useRef<boolean>(false)
  const [payNowQrDonation, setPayNowQrDonation] = useState<any>(null)
  const [confirmingPayNow, setConfirmingPayNow] = useState<any>(false)
  const [deletingId, setDeletingId] = useState<any>(null)
  const [selectedDonation, setSelectedDonation] = useState<any>(null)
  const [donationPledgeLink, setDonationPledgeLink] = useState<any>(null)
  // Snoozed action items: { [itemKey]: { until: timestampMs, reason?: string } }. An item stays
  // hidden from the dashboard Action Items list until its snooze expires. Expired entries are
  // pruned on load. Also accepts the older plain-number-timestamp shape for backward compat.
  const [snoozedItems, setSnoozedItems] = useState<any>(() => {
    const saved = localStorage.getItem('gt_snoozed_action_items')
    if (!saved) return {}
    try {
      const parsed = JSON.parse(saved)
      const now = Date.now()
      const active: Record<string, any> = {}
      Object.entries(parsed).forEach(([k, v]: [string, any]) => {
        const until = typeof v === 'number' ? v : v?.until
        const reason = typeof v === 'object' ? v?.reason : undefined
        if (typeof until === 'number' && until > now) active[k] = { until, reason }
      })
      return active
    } catch {
      return {}
    }
  })
  const [snoozeMenuOpen, setSnoozeMenuOpen] = useState<any>(null)

  const [showSnoozedItems, setShowSnoozedItems] = useState<any>(false)

  function snoozeActionItem(itemKey: any, days: any, reason?: string) {
    setSnoozedItems((prev: any) => {
      const next = { ...prev, [itemKey]: { until: Date.now() + days * 24 * 60 * 60 * 1000, reason: reason?.trim() || undefined } }
      localStorage.setItem('gt_snoozed_action_items', JSON.stringify(next))
      return next
    })
    setSnoozeMenuOpen(null)
  }

  function unsnoozeActionItem(itemKey: any) {
    setSnoozedItems((prev: any) => {
      const next = { ...prev }
      delete next[itemKey]
      localStorage.setItem('gt_snoozed_action_items', JSON.stringify(next))
      return next
    })
  }

  useEffect(() => {
    if (selectedDonation) {
      supabase
        .from('pledge_donations')
        .select('pledge_id, amount_applied')
        .eq('donation_id', selectedDonation.id)
        .maybeSingle()
        .then(async ({ data: linkRow }) => {
          if (!linkRow) { setDonationPledgeLink(null); return }
          const { data: pledgeRow } = await supabase
            .from('pledges')
            .select('donor_name, reference')
            .eq('id', linkRow.pledge_id)
            .maybeSingle()
          setDonationPledgeLink({ ...linkRow, pledgeDonorName: pledgeRow?.donor_name, pledgeReference: pledgeRow?.reference })
        })
    } else {
      setDonationPledgeLink(null)
    }
    // intentionally keyed on the id only -- using the whole object would refetch on every
    // unrelated field edit (notes, impact note, etc.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDonation?.id])
  const [editingNoteId, setEditingNoteId] = useState<any>(null)
  const [editingImpactNoteId, setEditingImpactNoteId] = useState<any>(null)
  const [impactNoteText, setImpactNoteText] = useState<any>('')
  const [noteText, setNoteText] = useState<any>('')
  const [nricRequestSent, setNricRequestSent] = useState<Record<string, any>>({})
  const [toast, setToast] = useState<any>(null)
  const toastTimerRef = useRef<any>(null)
  const [showMobileMenu, setShowMobileMenu] = useState<any>(false)
  const [auditLog, setAuditLog] = useState<any[]>([])
  const [auditLoading, setAuditLoading] = useState<any>(false)
  const [auditActionFilter, setAuditActionFilter] = useState<any>('All')
  const [auditDateFilter, setAuditDateFilter] = useState<any>('30')
  const [auditSearchTerm, setAuditSearchTerm] = useState<any>('')
  const [myCauses, setMyCauses] = useState<any[]>([])
  const [causeForm, setCauseForm] = useState<any>(EMPTY_CAUSE_FORM)
  const [causeError, setCauseError] = useState<any>('')
  const [savingCause, setSavingCause] = useState<any>(false)
  const [bulkActionInProgress, setBulkActionInProgress] = useState<any>(false)
  const [bulkProgress, setBulkProgress] = useState<any>(null) // { done, total }
  const bulkCancelRef = useRef<boolean>(false)
  const [showResetPassword, setShowResetPassword] = useState<any>(false)
  const [newPassword, setNewPassword] = useState<any>('')
  const [confirmPassword, setConfirmPassword] = useState<any>('')
  const [resetMsg, setResetMsg] = useState<any>('')
  const [resetLoading, setResetLoading] = useState<any>(false)
  const [quickEmailInput, setQuickEmailInput] = useState<any>('')
  const [quickNricInput, setQuickNricInput] = useState<any>('')
  const [sendingThankYouId, setSendingThankYouId] = useState<any>(null)
  const [thankYouPreviewModal, setThankYouPreviewModal] = useState<any>(null)
  const [thankYouCustomMessage, setThankYouCustomMessage] = useState<any>('')
  const [thankYouSubjectInput, setThankYouSubjectInput] = useState<any>('')
  const [aiWeekSummary, setAiWeekSummary] = useState<any>(null)
  const [aiWeekSummaryLoading, setAiWeekSummaryLoading] = useState<any>(false)
  const [aiWeekSummaryError, setAiWeekSummaryError] = useState<any>(null)
  const [thankYouPreviewing, setThankYouPreviewing] = useState<any>(false)
  const [charityIsIpc, setCharityIsIpc] = useState<any>(true)
  const [charityIpcLoaded, setCharityIpcLoaded] = useState<any>(false)
  const [editingEmailTemplate, setEditingEmailTemplate] = useState<any>(null)
  const [emailTemplateSubjectInput, setEmailTemplateSubjectInput] = useState<any>('')
  const [emailTemplateBodyInput, setEmailTemplateBodyInput] = useState<any>('')
  const [emailTemplateBannerTitleInput, setEmailTemplateBannerTitleInput] = useState<any>('')
  const [emailTemplateBannerSubtitleInput, setEmailTemplateBannerSubtitleInput] = useState<any>('')
  const [charityLogoUrl, setCharityLogoUrl] = useState<any>(null)
  const [charityLogoDataUrl, setCharityLogoDataUrl] = useState<any>(null)
  const [uploadingLogo, setUploadingLogo] = useState<any>(false)
  const [annualGoal, setAnnualGoal] = useState<any>(null)
  const [editingGoal, setEditingGoal] = useState<any>(false)
  const [goalInput, setGoalInput] = useState<any>('')
  const DEFAULT_VISIBLE_METRICS = ['total_raised', 'donor_retention', 'avg_gift', 'campaign_performance', 'monthly_trend', 'donor_highlights']
  const [, setVisibleMetrics] = useState<any>(DEFAULT_VISIBLE_METRICS)
  const DEFAULT_ENABLED_MODULES = { campaigns: false, pledges: false, recurring: false, grants: false, inKind: true }
  const [enabledModules, setEnabledModules] = useState<any>(DEFAULT_ENABLED_MODULES)
  const [hiddenDashboardCards, setHiddenDashboardCards] = useState<string[]>([])
  const [dashboardCardOrder, setDashboardCardOrder] = useState<Record<string, string[]>>({})
  useEffect(() => {
    const disabledTabIds = Object.entries(enabledModules).filter(([, v]) => v === false).map(([k]) => MODULE_TAB_IDS[k])
    if (disabledTabIds.includes(activeTab)) setActiveTab('dashboard')
  }, [enabledModules, activeTab, setActiveTab])
  useEffect(() => {
    if (activeTab !== 'dashboard') return
    const sectionIds = [
      'analytics-section-today',
      'analytics-section-fundraising',
      ...(enabledModules.campaigns !== false ? ['analytics-section-campaigns'] : []),
      'analytics-section-massappeals',
      ...(enabledModules.pledges !== false ? ['analytics-section-pledges'] : []),
      ...(enabledModules.recurring !== false ? ['analytics-section-recurring'] : []),
      ...(enabledModules.grants !== false ? ['analytics-section-grants'] : []),
      'analytics-section-donorbehavior',
    ]
    const stickyOffset = (isMobile ? 56 : 0) + ANALYTICS_NAV_OFFSET + 4
    function onScroll() {
      let current = sectionIds[0]
      for (const id of sectionIds) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top - stickyOffset <= 0) current = id
      }
      setActiveAnalyticsSection(current)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [activeTab, isMobile, enabledModules])
  useEffect(() => {
    if (roleLoaded && userRole === 'volunteer' && !VOLUNTEER_ALLOWED_TABS.includes(activeTab)) setActiveTab('donations')
  }, [roleLoaded, userRole, activeTab, setActiveTab])
  useEffect(() => {
    if (roleLoaded && userRole === 'board' && !BOARD_ALLOWED_TABS.includes(activeTab)) setActiveTab('dashboard')
  }, [roleLoaded, userRole, activeTab, setActiveTab])
  const [showCustomizeAnalytics, setShowCustomizeAnalytics] = useState<any>(false)
  const [customizeMetricsDraft, setCustomizeMetricsDraft] = useState<any>(DEFAULT_VISIBLE_METRICS)
  const [fyEndMonth, setFyEndMonth] = useState<any>(12)
  const [fyEndDay, setFyEndDay] = useState<any>(31)
  const [editingFyEnd, setEditingFyEnd] = useState<any>(false)
  const [fyEndMonthInput, setFyEndMonthInput] = useState<any>('12')
  const [fyEndDayInput, setFyEndDayInput] = useState<any>('31')
  const fyOf = React.useCallback((dateInput: any) => fiscalYearOf(dateInput, fyEndMonth, fyEndDay), [fyEndMonth, fyEndDay])
  useEffect(() => {
    if (!charityIpcLoaded) return
    const calendarYear = new Date().getFullYear().toString()
    const correctFiscalYear = fyOf(new Date()).toString()
    if (filterYear === calendarYear && filterYear !== correctFiscalYear) {
      setFilterYear(correctFiscalYear)
    }
    // intentionally narrow -- this only re-syncs when the FY-end setting itself changes; adding
    // filterYear would fight a user's own manual filter selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charityIpcLoaded, fyEndMonth, fyEndDay])
  // The Donations tab defaults to "this year" so it opens focused rather than showing everything —
  // but if this year genuinely has no donations yet (early in the year, or historical/demo data),
  // that default silently produces an empty list with no explanation. Fall back to "All" once,
  // the first time data loads, instead of leaving the user staring at a blank filtered view.
  const yearDefaultCheckedRef = useRef<boolean>(false)
  useEffect(() => {
    if (loading || yearDefaultCheckedRef.current) return
    yearDefaultCheckedRef.current = true
    const currentFiscalYear = fyOf(new Date()).toString()
    if (filterYear === currentFiscalYear) {
      const hasDataThisYear = donations.some(d => fyOf(d.created_at).toString() === currentFiscalYear)
      if (!hasDataThisYear && donations.length > 0) setFilterYear('All')
    }
    // intentionally one-shot -- gated by yearDefaultCheckedRef, so this only ever does its
    // check once after the first load completes, regardless of later donations/filterYear changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])
  const selectedRowRef = useRef<any>(null)
  
  const [confirmModal, setConfirmModal] = useState<any>(null)
  const [, setDonorBadgeAcks] = useState<any[]>([])
  const [thankYouDraft, setThankYouDraft] = useState<any>(null)
  const [thankYouDraftPreviewing, setThankYouDraftPreviewing] = useState<any>(false)
  const [rnOutreach, setRnOutreach] = useState<any>(null)
  const [rnSending, setRnSending] = useState<any>(false)
  const [viewEmailNote, setViewEmailNote] = useState<any>(null)


  useEffect(() => {
    if (showPledgeThankYouModal && pledgeCompletionCandidate) {
      const { pledge } = pledgeCompletionCandidate
      const key = 'pledge_thank_you'
      const saved = emailTemplates[key]
      const vars = { donor_name: pledge.donor_name, charity_name: charityName, pledge_amount: Number(pledge.amount).toLocaleString() }
      setPledgeThankYouSubject(fillTemplate(saved?.subject || EMAIL_TEMPLATE_DEFAULTS[key].subject, vars))
      setPledgeThankYouBody(fillTemplate(saved?.body || EMAIL_TEMPLATE_DEFAULTS[key].body, vars))
      setPledgeThankYouPreviewing(false)
    }
  }, [showPledgeThankYouModal, pledgeCompletionCandidate, emailTemplates, charityName])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' && !intentionalSignOutRef.current) {
        showToast('Your session expired — please sign in again', 'error')
      }
      intentionalSignOutRef.current = false
      setSession(session)
      if (event === 'PASSWORD_RECOVERY') setShowResetPassword(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session?.user?.user_metadata?.sidebar_collapsed !== undefined) {
      setSidebarCollapsed(session.user.user_metadata.sidebar_collapsed)
    }
    if (session?.user?.user_metadata?.last_active_tab) {
      setActiveTab(session.user.user_metadata.last_active_tab)
    }
    if (session?.user?.user_metadata?.last_selected_donor) {
      setPendingSelectedDonorKey(session.user.user_metadata.last_selected_donor)
    }
    if (session?.user?.user_metadata?.donor_column_order) {
      const saved = session.user.user_metadata.donor_column_order
      const validKeys = DONOR_COLUMN_OPTIONS.map(o => o.key)
      // Merge saved order with any columns added since it was saved, so a stale preference never
      // hides a newer column — anything not in the saved list is appended at the end.
      const merged = [...saved.filter((k: any) => validKeys.includes(k)), ...validKeys.filter(k => !saved.includes(k))]
      setDonorColumnOrder(merged)
    }
    if (session?.user?.user_metadata?.donation_column_order) {
      const saved = session.user.user_metadata.donation_column_order
      const validKeys = DONATION_COLUMN_OPTIONS.map(o => o.key)
      const merged = [...saved.filter((k: any) => validKeys.includes(k)), ...validKeys.filter(k => !saved.includes(k))]
      setDonationColumnOrder(merged)
    }
    // intentionally keyed on the user id only -- this hydrates local UI state from saved
    // preferences once per login; watching the metadata fields themselves would refire every
    // time one of these very setters calls supabase.auth.updateUser and changes the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id])

  useEffect(() => {
    if (session) {
      loadDonations(session)
      loadInsightDismissals()
      loadMyCauses()
      loadCharityIpcStatus(session)
      loadDonorBadgeAcks(session)
      loadAllDonorTags(session)
      loadAllDonorLastContact(session)
      loadPledges(session)
      loadRecurringGifts(session)
      loadMassAppeals(session)
      loadLapsedReminders(session)
      loadDonorContacts(session)
      loadPledgeInstalments()
      loadGrants()
      loadRecurringExpenses()
      loadRefunds()
      loadGrantExpenses()
      loadCampaignExpenses()
      loadGrantNotes()
      loadGrantReports()
      loadGrantTranches()
      loadGrantMatchClaims()
      loadGivingChangeAcks(session)
      loadInKindDonations(session)
    }
    // intentionally fires only on session change (login) -- the load* functions are plain
    // functions recreated every render, so including them would refetch everything on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  async function loadGivingChangeAcks(activeSession = session) {
    const uen = activeSession?.user?.app_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase
      .from('giving_change_acks')
      .select('donor_key, direction, change_pct, sent_at, sent_by')
      .eq('charity_uen', uen)
      .order('sent_at', { ascending: false })
    if (error) { console.error('Could not load giving change acks:', error); return }
    const history: Record<string, any> = {}
    ;(data || []).forEach(r => {
      if (!history[r.donor_key]) history[r.donor_key] = []
      history[r.donor_key].push(r)
    })
    setGivingChangeAckHistory(history)
  }

  async function loadLapsedReminders(activeSession = session) {
    const uen = activeSession?.user?.app_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase
      .from('lapsed_donor_events')
      .select('donor_key, sent_at, sent_by')
      .eq('charity_uen', uen)
      .eq('event_type', 'reminder')
      .order('sent_at', { ascending: false })
    if (error) { console.error('Could not load lapsed reminders:', error); return }
    const history: Record<string, any> = {}
    ;(data || []).forEach(r => {
      if (!history[r.donor_key]) history[r.donor_key] = []
      history[r.donor_key].push(r)
    })
    setLapsedReminderHistory(history)

    const { data: dismissData, error: dismissError } = await supabase
      .from('lapsed_donor_events')
      .select('donor_key, reason, dismissed_at, dismissed_by')
      .eq('charity_uen', uen)
      .eq('event_type', 'dismissal')
    if (dismissError) { console.error('Could not load lapsed dismissals:', dismissError); return }
    const dismissals: Record<string, any> = {}
    ;(dismissData || []).forEach(d => { dismissals[d.donor_key] = d })
    setLapsedDismissals(dismissals)
  }

  async function loadCharityIpcStatus(activeSession: any) {
    const uen = activeSession?.user?.app_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase
      .from('charity_contacts')
      .select('ipc, annual_goal, fy_end_month, fy_end_day, visible_metrics, enabled_modules, dashboard_hidden_cards, dashboard_card_order, staff_emails, volunteer_emails, ed_emails, board_emails, monthly_expenses, custom_obligations, custom_tasks, giving_change_min_gifts, giving_change_min_pct, concentration_top_n, lapsed_min_gifts, lapsed_min_days, pledge_watch_threshold, pledge_due_soon_days, recurring_trend_cycles, recurring_missed_threshold, major_gift_threshold, major_donor_threshold, cumulative_milestone_thresholds, logo_url, email_templates')
      .eq('charity_uen', uen)
      .single()
    if (error) { console.error('Could not load charity IPC status:', error); setCharityIpcLoaded(true); setRoleLoaded(true); return }
    setCharityIsIpc(data?.ipc !== false)
    setCharityLogoUrl(data?.logo_url || null)
    setAnnualGoal(data?.annual_goal || null)
    if (Array.isArray(data?.visible_metrics)) setVisibleMetrics(data.visible_metrics)
    setEnabledModules({ ...DEFAULT_ENABLED_MODULES, ...(data?.enabled_modules || {}) })
    setHiddenDashboardCards(Array.isArray(data?.dashboard_hidden_cards) ? data.dashboard_hidden_cards : [])
    setDashboardCardOrder(data?.dashboard_card_order && typeof data.dashboard_card_order === 'object' ? data.dashboard_card_order : {})
    setEmailTemplates(data?.email_templates || {})
    const month = data?.fy_end_month || 12
    const day = data?.fy_end_day || 31
    setFyEndMonth(month)
    setFyEndDay(day)
    setFyEndMonthInput(month.toString())
    setFyEndDayInput(day.toString())
    setCharityIpcLoaded(true)
    // Determine role — precedence: ED > Staff > Board > Volunteer > default Staff
    const email = activeSession?.user?.email || ''
    const volunteerEmails = data?.volunteer_emails || []
    const edEmails = data?.ed_emails || []
    const boardEmails = data?.board_emails || []
    const staffEmails = data?.staff_emails || []
    if (edEmails.includes(email)) {
      setUserRole('ed')
    } else if (staffEmails.includes(email)) {
      setUserRole('staff')
    } else if (boardEmails.includes(email)) {
      setUserRole('board')
    } else if (volunteerEmails.includes(email)) {
      setUserRole('volunteer')
    } else {
      setUserRole('staff')
    }
    setLocalVolunteers(volunteerEmails)
    setLocalEds(edEmails)
    setLocalBoardMembers(boardEmails)
    setLocalStaff(staffEmails)
    // monthlyExpenses is now derived from recurringExpenses — no separate load needed
    setCustomObligations(data?.custom_obligations || [])
    setCustomTasks(data?.custom_tasks || [])
    setSenderDomainStatus((data as any)?.sender_domain_status || 'none')
    setSenderDomain((data as any)?.sender_domain || '')
    setSenderEmailLocalPart((data as any)?.sender_email_local_part || 'hello')
    setGivingChangeMinGifts(data?.giving_change_min_gifts ?? 3)
    setGivingChangeMinPct(data?.giving_change_min_pct ?? 30)
    setConcentrationTopN(data?.concentration_top_n ?? 10)
    setPledgeWatchThreshold(data?.pledge_watch_threshold ?? 2)
    setPledgeDueSoonDays(data?.pledge_due_soon_days ?? 7)
    setRecurringTrendCycles(data?.recurring_trend_cycles ?? 2)
    setRecurringMissedThreshold(data?.recurring_missed_threshold ?? 2)
    setLapsedMinGifts(data?.lapsed_min_gifts ?? 2)
    setLapsedMinDays(data?.lapsed_min_days ?? 60)
    setThankYouThreshold(data?.major_gift_threshold ?? 200)
    setMajorDonorThreshold(data?.major_donor_threshold ?? 1000)
    setThankYouThresholdInput((data?.major_gift_threshold ?? 200).toString())
    setMajorDonorThresholdInput((data?.major_donor_threshold ?? 1000).toString())
    const loadedCumulative = Array.isArray(data?.cumulative_milestone_thresholds) && data.cumulative_milestone_thresholds.length === 3 ? data.cumulative_milestone_thresholds : [1000, 5000, 10000]
    setCumulativeThresholds(loadedCumulative)
    setCumulativeThresholdsInput(loadedCumulative.map(v => v.toString()))
    setRoleLoaded(true)
  }

  useEffect(() => {
    if (!charityLogoUrl) { setCharityLogoDataUrl(null); return }
    let cancelled = false
    fetch(charityLogoUrl)
      .then(res => res.blob())
      .then(blob => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      }))
      .then(dataUrl => { if (!cancelled) setCharityLogoDataUrl(dataUrl) })
      .catch(err => { console.error('Could not load charity logo for PDF embedding:', err); if (!cancelled) setCharityLogoDataUrl(null) })
    return () => { cancelled = true }
  }, [charityLogoUrl])

  async function resizeLogoForUpload(file: any, maxDim = 500) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = dataUrl as string
    })
    if (img.width <= maxDim && img.height <= maxDim) return file
    const ratio = Math.min(maxDim / img.width, maxDim / img.height)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * ratio)
    canvas.height = Math.round(img.height * ratio)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
    return blob ? new File([blob], file.name, { type: 'image/png' }) : file
  }

  async function uploadCharityLogo(file: any) {
    if (!file) return
    if (!file.type.startsWith('image/')) { showToast('Please choose an image file', 'error'); return }
    if (file.size > 2 * 1024 * 1024) { showToast('Logo must be under 2MB', 'error'); return }
    setUploadingLogo(true)
    // Logos only render small (a ~50px header badge, ~130px watermark) — anything larger than
    // 500px just bloats every generated receipt PDF and slows down email sends that attach one.
    file = await resizeLogoForUpload(file)
    const ext = file.name.split('.').pop().toLowerCase()
    const path = `${charityUen}/logo.${ext}`
    const { error: uploadError } = await supabase.storage.from('charity-assets').upload(path, file, { upsert: true, cacheControl: '3600' })
    if (uploadError) { showToast(`Error uploading logo: ${uploadError.message}`, 'error'); setUploadingLogo(false); return }
    const { data: urlData } = supabase.storage.from('charity-assets').getPublicUrl(path)
    const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`
    const { error: dbError } = await supabase.from('charity_contacts').update({ logo_url: publicUrl }).eq('charity_uen', charityUen)
    if (dbError) { showToast(`Error saving logo: ${dbError.message}`, 'error'); setUploadingLogo(false); return }
    setCharityLogoUrl(publicUrl)
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'charity_logo_updated',
      details: { charity_uen: charityUen },
    })
    setUploadingLogo(false)
    showToast('Logo updated ✓')
  }

  async function removeCharityLogo() {
    const { error } = await supabase.from('charity_contacts').update({ logo_url: null }).eq('charity_uen', charityUen)
    if (error) { showToast('Error removing logo', 'error'); return }
    setCharityLogoUrl(null)
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'charity_logo_removed',
      details: { charity_uen: charityUen },
    })
    showToast('Logo removed')
  }

  async function loadDonorBadgeAcks(activeSession = session) {
    const uen = activeSession?.user?.app_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase
      .from('donor_badge_acks')
      .select('*')
      .eq('charity_uen', uen)
    if (error) { console.error('Could not load donor badge acks:', error); return }
    setDonorBadgeAcks(data || [])
  }

  async function loadAllDonorTags(activeSession = session) {
    const uen = activeSession?.user?.app_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase
      .from('donor_tags')
      .select('*')
      .eq('charity_uen', uen)
    if (error) { console.error('Could not load donor tags:', error); return }
    const map: Record<string, any> = {}
    ;(data || []).forEach(t => {
      if (!map[t.donor_key]) map[t.donor_key] = []
      map[t.donor_key].push(t)
    })
    setDonorTagsMap(map)
  }

  async function loadAllDonorLastContact(activeSession = session) {
    const uen = activeSession?.user?.app_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase
      .from('donor_notes')
      .select('donor_key, created_at')
      .eq('charity_uen', uen)
    if (error) { console.error('Could not load donor last contact:', error); return }
    const map: Record<string, any> = {}
    ;(data || []).forEach(n => {
      if (!map[n.donor_key] || new Date(n.created_at) > new Date(map[n.donor_key])) {
        map[n.donor_key] = n.created_at
      }
    })
    setDonorLastContactMap(map)
  }

  async function loadInsightDismissals() {
    const { data, error } = await supabase
      .from('audit_log')
      .select('details')
      .eq('action', 'insight_dismissed')
    if (error) { console.error('Could not load insight dismissals:', error); return }
    setInsightDismissals((data || []).map(r => r.details).filter(Boolean))
  }

  async function dismissInsight(donorKey: any, insightKey: any) {
    const periodKey = isoWeekKey(new Date())
    const details = { donor_key: donorKey, insight_key: insightKey, period_key: periodKey }
    setInsightDismissals(prev => [...prev, details])
    const { data, error } = await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'insight_dismissed',
      details,
    }).select().single()
    if (error) { console.error('Could not save dismissal:', error); showToast('Could not mark as handled', 'error'); return }

    // These dismissals auto-expire at the end of the ISO week anyway, but there was previously
    // no way to undo one immediately if clicked by mistake -- only a wait-until-next-week option.
    let cancelled = false
    setToast({
      msg: 'Marked as handled — won\'t show again this week',
      undoable: true,
      onUndo: async () => {
        cancelled = true
        if (data?.id) await supabase.from('audit_log').delete().eq('id', data.id)
        setInsightDismissals(prev => prev.filter(d => !(d.donor_key === donorKey && d.insight_key === insightKey && d.period_key === periodKey)))
        setToast(null)
        showToast('Undone ✓')
      },
    })
    setTimeout(() => { if (!cancelled) setToast(null) }, 10000)
  }

  const [pledgesLoaded, setPledgesLoaded] = useState<any>(false)

  async function loadPledges(activeSession = session) {
    const uen = activeSession?.user?.app_metadata?.charity_uen
    if (!uen) { setPledgesLoaded(true); return }
    const { data, error } = await supabase
      .from('pledges')
      .select('*')
      .eq('charity_uen', uen)
      .order('expected_date', { ascending: true })
    if (error) { console.error('Could not load pledges:', error); setPledgesLoaded(true); return }
    setPledges(data || [])

    if (data && data.length > 0) {
      const { data: linkData } = await supabase
        .from('pledge_donations')
        .select('pledge_id, donation_id, amount_applied, created_at')
        .in('pledge_id', data.map(p => p.id))
      const totals: Record<string, any> = {}
      const links: Record<string, any> = {}
      ;(linkData || []).forEach(l => {
        totals[l.pledge_id] = (totals[l.pledge_id] || 0) + Number(l.amount_applied)
        ;(links[l.pledge_id] = links[l.pledge_id] || []).push(l)
      })
      setPledgeGivenTotals(totals)
      setPledgeDonationLinks(links)

      const { data: reminderData } = await supabase
        .from('pledge_reminders')
        .select('pledge_id, sent_at, sent_by, subject, channel')
        .in('pledge_id', data.map(p => p.id))
        .order('sent_at', { ascending: false })
      const history: Record<string, any> = {}
      ;(reminderData || []).forEach(r => {
        if (!history[r.pledge_id]) history[r.pledge_id] = []
        history[r.pledge_id].push(r)
      })
      setPledgeReminderHistory(history)

      const { data: rescheduleData } = await supabase
        .from('pledge_reschedules')
        .select('pledge_id, old_expected_date, new_expected_date, reason, created_at, created_by')
        .in('pledge_id', data.map(p => p.id))
        .order('created_at', { ascending: false })
      const rescheduleHistory: Record<string, any> = {}
      ;(rescheduleData || []).forEach(r => {
        if (!rescheduleHistory[r.pledge_id]) rescheduleHistory[r.pledge_id] = []
        rescheduleHistory[r.pledge_id].push(r)
      })
      setPledgeRescheduleHistory(rescheduleHistory)
    }
    setPledgesLoaded(true)
  }

  async function savePledge() {
    if (!pledgeForm.donor_name.trim()) { setPledgeError('Donor name is required'); return }
    if (!pledgeForm.amount || parseFloat(pledgeForm.amount) <= 0) { setPledgeError('Please enter a valid amount'); return }
    if (parseFloat(pledgeForm.amount) > 1000000) { setPledgeError('Amount seems too large — please check it (max $1,000,000)'); return }
    if (!pledgeForm.expected_date) { setPledgeError('Expected date is required'); return }
    if (new Date(pledgeForm.expected_date) < new Date(new Date().setHours(0,0,0,0))) { setPledgeError('Expected date cannot be in the past'); return }
    if (pledgeForm.is_multi_year && (!pledgeForm.total_years || parseInt(pledgeForm.total_years) < 2)) { setPledgeError('Multi-year pledges need at least 2 years'); return }
    setSavingPledge(true)
    setPledgeError('')
    const donorKey = pledgeForm.donor_email?.trim() || pledgeForm.donor_name.trim()
    const perYearAmount = parseFloat(pledgeForm.amount)
    const years = pledgeForm.is_multi_year ? parseInt(pledgeForm.total_years) : 1
    const { data, error } = await supabase.from('pledges').insert([{
      charity_uen: charityUen,
      donor_name: pledgeForm.donor_name.trim(),
      donor_email: pledgeForm.donor_email?.trim() || null,
      donor_phone: pledgeForm.donor_phone?.trim() || null,
      donor_key: donorKey,
      amount: perYearAmount * years,
      expected_date: pledgeForm.expected_date,
      notes: pledgeForm.notes?.trim() || null,
      status: 'pending',
      created_by: session.user.email,
      is_multi_year: pledgeForm.is_multi_year || false,
      total_years: pledgeForm.is_multi_year ? years : null,
      cause_id: pledgeForm.cause_id || null,
      is_anonymous: pledgeForm.is_anonymous || false,
      source: pledgeForm.source || null,
      reference: 'PLG-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
    }]).select()
    setSavingPledge(false)
    if (error) { setPledgeError(`Error: ${error.message}`); return }

    let instalmentsFailed = false
    if (pledgeForm.is_multi_year) {
      const instalments = Array.from({ length: years }, (_, i) => ({
        pledge_id: data[0].id,
        year_number: i + 1,
        expected_date: new Date(new Date(pledgeForm.expected_date).setFullYear(new Date(pledgeForm.expected_date).getFullYear() + i)).toISOString().split('T')[0],
        amount: perYearAmount,
      }))
      const { error: instalmentError } = await supabase.from('pledge_instalments').insert(instalments)
      if (instalmentError) { console.error('Error creating instalments:', instalmentError); instalmentsFailed = true }
    }

    setPledges(prev => [...prev, data[0]].sort((a, b) => new Date(a.expected_date).getTime() - new Date(b.expected_date).getTime()))
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'pledge_created',
      details: { donor_name: pledgeForm.donor_name.trim(), amount: perYearAmount * years, is_multi_year: pledgeForm.is_multi_year || false },
    })
    setPledgeForm({ donor_name: '', donor_email: '', donor_phone: '', amount: '', expected_date: '', notes: '', is_multi_year: false, total_years: '3', cause_id: '', is_anonymous: false, source: '' })
    setShowPledgeForm(false)
    // A failed instalment insert would otherwise leave a multi-year pledge with no instalment
    // rows at all -- invisible to every outstanding/overdue calculation from that point on --
    // so this must be surfaced loudly rather than only logged to the console.
    if (instalmentsFailed) {
      showToast('Pledge saved, but its yearly instalments failed to save — delete and re-create it to try again (editing an existing pledge can only correct instalments that already exist, not add missing ones)', 'error')
    } else {
      showToast(pledgeForm.is_multi_year ? `${years}-year pledge recorded ✓` : 'Pledge recorded ✓')
    }
    loadPledgeInstalments()
  }

  async function updatePledge(pledgeId: any, form: any) {
    if (!form.donor_name.trim()) { showToast('Donor name is required', 'error'); return }
    const donorKey = form.donor_email?.trim() || form.donor_name.trim()

    let amount = parseFloat(form.amount)
    let expectedDate = form.expected_date

    if (form.instalmentEdits) {
      // Multi-year pledge: persist each corrected (not-yet-received) instalment, then recompute
      // the parent pledge's total amount and expected date (earliest unreceived instalment) from
      // the full set, so they stay in sync with what's actually recorded per year.
      for (const inst of form.instalmentEdits) {
        if (inst.received) continue
        const { error: instError } = await supabase.from('pledge_instalments').update({
          amount: parseFloat(inst.amount),
          expected_date: inst.expected_date,
        }).eq('id', inst.id)
        if (instError) { showToast(`Error saving Year ${inst.year_number} instalment`, 'error'); return }
      }
      amount = form.instalmentEdits.reduce((s: any, i: any) => s + (parseFloat(i.amount) || 0), 0)
      const unreceived = form.instalmentEdits.filter((i: any) => !i.received).sort((a: any, b: any) => new Date(a.expected_date).getTime() - new Date(b.expected_date).getTime())
      expectedDate = unreceived[0]?.expected_date || form.instalmentEdits[0]?.expected_date || expectedDate
      setPledgeInstalments(prev => prev.map(i => {
        if (i.pledge_id !== pledgeId) return i
        const edited = form.instalmentEdits.find((e: any) => e.id === i.id)
        return edited && !edited.received ? { ...i, amount: parseFloat(edited.amount), expected_date: edited.expected_date } : i
      }))
    } else {
      if (!amount || amount <= 0) { showToast('Please enter a valid amount', 'error'); return }
      if (amount > 1000000) { showToast('Amount seems too large — please check it (max $1,000,000)', 'error'); return }
      if (!expectedDate) { showToast('Expected date is required', 'error'); return }
    }

    const { data, error } = await supabase.from('pledges').update({
      donor_name: form.donor_name.trim(),
      donor_email: form.donor_email?.trim() || null,
      donor_phone: form.donor_phone?.trim() || null,
      donor_key: donorKey,
      amount,
      expected_date: expectedDate,
      notes: form.notes?.trim() || null,
      cause_id: form.cause_id || null,
      is_anonymous: form.is_anonymous || false,
      source: form.source || null,
    }).eq('id', pledgeId).select().single()
    if (error) { showToast('Error updating pledge', 'error'); return }
    setPledges(prev => prev.map(p => p.id === pledgeId ? data : p).sort((a, b) => new Date(a.expected_date).getTime() - new Date(b.expected_date).getTime()))
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'pledge_updated',
      details: { donor_name: form.donor_name.trim(), amount, pledge_id: pledgeId },
    })
    setEditingPledge(null)
    showToast('Pledge updated ✓')
  }

  async function loadGrantExpenses() {
    const uen = session?.user?.app_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase.from('grant_expenses').select('*, grants!inner(charity_uen)').eq('grants.charity_uen', uen)
    if (error) { console.error('Could not load grant expenses:', error); return }
    setGrantExpenses(data || [])
  }

  async function loadCampaignExpenses() {
    const uen = session?.user?.app_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase.from('campaign_expenses').select('*, causes!inner(charity_uen)').eq('causes.charity_uen', uen)
    if (error) { console.error('Could not load campaign expenses:', error); return }
    setCampaignExpenses(data || [])
  }

  async function saveCampaignExpense(causeId: any, form: any) {
    if (!form.description.trim() || !form.amount) { showToast('Description and amount are required', 'error'); return }
    if (isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) { showToast('Amount must be a positive number', 'error'); return }
    const expenseAmount = parseFloat(form.amount)
    const { data, error } = await supabase.from('campaign_expenses').insert({
      cause_id: causeId,
      description: form.description.trim(),
      amount: expenseAmount,
      expense_date: form.expense_date,
      category: form.category || null,
      created_by: session.user.email,
    }).select().single()
    if (error) { console.error('Could not save campaign expense:', error); showToast('Error saving expense', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'campaign_expense_logged',
      details: { campaign_title: myCauses.find(c => c.id === causeId)?.title, description: form.description.trim(), amount: expenseAmount, category: form.category || null, charity_uen: charityUen },
    })
    setCampaignExpenses(prev => [...prev, data])
    const causeForBudget = myCauses.find(c => c.id === causeId)
    const budget = Number(causeForBudget?.cost) || 0
    const spentSoFar = campaignExpenses.filter(e => e.cause_id === causeId).reduce((s, e) => s + Number(e.amount), 0) + expenseAmount
    if (budget > 0 && spentSoFar > budget) {
      showToast(`Expense logged, but this campaign is now over budget: $${spentSoFar.toLocaleString()} spent of $${budget.toLocaleString()} ⚠`, 'error')
    } else {
      showToast('Expense logged ✓')
    }
  }

  async function editCampaignExpense(expense: any, updates: any) {
    const { data, error } = await supabase.from('campaign_expenses').update(updates).eq('id', expense.id).select().single()
    if (error) { console.error('Could not update campaign expense:', error); showToast('Error saving expense', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'campaign_expense_edited',
      details: { campaign_title: myCauses.find(c => c.id === expense.cause_id)?.title, before: { description: expense.description, amount: expense.amount }, after: updates, charity_uen: charityUen },
    })
    setCampaignExpenses(prev => prev.map(e => e.id === expense.id ? data : e))
    showToast('Expense updated ✓')
  }

  async function deleteCampaignExpense(id: any) {
    const expense = campaignExpenses.find(e => e.id === id)
    await supabase.from('campaign_expenses').delete().eq('id', id)
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'campaign_expense_deleted',
      details: { campaign_title: expense ? myCauses.find(c => c.id === expense.cause_id)?.title : null, description: expense?.description, amount: expense?.amount, charity_uen: charityUen },
    })
    setCampaignExpenses(prev => prev.filter(e => e.id !== id))
  }

  async function loadGrantNotes() {
    const uen = session?.user?.app_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase.from('grant_notes').select('*, grants!inner(charity_uen)').eq('grants.charity_uen', uen).order('created_at', { ascending: false })
    if (error) { console.error('Could not load grant notes:', error); return }
    const byGrant: Record<string, any> = {}
    ;(data || []).forEach(n => { if (!byGrant[n.grant_id]) byGrant[n.grant_id] = []; byGrant[n.grant_id].push(n) })
    setGrantNotes(byGrant)
  }

  async function saveGrantNote(grantId: any, noteText: any) {
    if (!noteText.trim()) return
    const { data, error } = await supabase.from('grant_notes').insert({
      charity_uen: charityUen,
      grant_id: grantId,
      note: noteText.trim(),
      created_by: session.user.email,
    }).select().single()
    if (error) { showToast('Error saving note', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'grant_note_added',
      details: { funder_name: grants.find(g => g.id === grantId)?.funder_name, note: noteText.trim(), charity_uen: charityUen },
    })
    setGrantNotes(prev => ({ ...prev, [grantId]: [data, ...(prev[grantId] || [])] }))
    showToast('Note added ✓')
  }

  async function loadGrantReports() {
    const uen = session?.user?.app_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase.from('grant_reports').select('*, grants!inner(charity_uen)').eq('grants.charity_uen', uen).order('due_date', { ascending: true })
    if (error) { console.error('Could not load grant reports:', error); return }
    const byGrant: Record<string, any> = {}
    ;(data || []).forEach(r => { if (!byGrant[r.grant_id]) byGrant[r.grant_id] = []; byGrant[r.grant_id].push(r) })
    setGrantReports(byGrant)
  }

  async function saveGrantReport(grantId: any, form: any) {
    if (!form.label.trim() || !form.due_date) { showToast('Label and due date are required', 'error'); return }
    const { data, error } = await supabase.from('grant_reports').insert({
      charity_uen: charityUen,
      grant_id: grantId,
      label: form.label.trim(),
      due_date: form.due_date,
    }).select().single()
    if (error) { showToast('Error adding report deadline', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'grant_report_added',
      details: { funder_name: grants.find(g => g.id === grantId)?.funder_name, label: form.label.trim(), due_date: form.due_date, charity_uen: charityUen },
    })
    setGrantReports(prev => ({ ...prev, [grantId]: [...(prev[grantId] || []), data].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()) }))
    showToast('Report deadline added ✓')
  }

  async function toggleGrantReportSubmitted(report: any) {
    const { data, error } = await supabase.from('grant_reports').update({
      submitted: !report.submitted,
      submitted_at: !report.submitted ? new Date().toISOString() : null,
    }).eq('id', report.id).select().single()
    if (error) { showToast('Error updating report', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: data.submitted ? 'grant_report_submitted' : 'grant_report_unsubmitted',
      details: { funder_name: grants.find(g => g.id === report.grant_id)?.funder_name, label: report.label, due_date: report.due_date, charity_uen: charityUen },
    })
    setGrantReports(prev => ({ ...prev, [report.grant_id]: (prev[report.grant_id] || []).map((r: any) => r.id === report.id ? data : r) }))
  }

  async function editGrantReport(report: any, updates: any) {
    const { data, error } = await supabase.from('grant_reports').update(updates).eq('id', report.id).select().single()
    if (error) { showToast('Error updating report', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'grant_report_edited',
      details: { funder_name: grants.find(g => g.id === report.grant_id)?.funder_name, before: { label: report.label, due_date: report.due_date }, after: updates, charity_uen: charityUen },
    })
    setGrantReports(prev => ({ ...prev, [report.grant_id]: (prev[report.grant_id] || []).map((r: any) => r.id === report.id ? data : r).sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()) }))
    showToast('Report updated ✓')
  }

  async function deleteGrantReport(report: any) {
    const { error } = await supabase.from('grant_reports').delete().eq('id', report.id)
    if (error) { showToast('Error deleting report', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'grant_report_deleted',
      details: { funder_name: grants.find(g => g.id === report.grant_id)?.funder_name, label: report.label, due_date: report.due_date, charity_uen: charityUen },
    })
    setGrantReports(prev => ({ ...prev, [report.grant_id]: (prev[report.grant_id] || []).filter((r: any) => r.id !== report.id) }))
  }

  async function loadGrantTranches() {
    const uen = session?.user?.app_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase.from('grant_tranches').select('*, grants!inner(charity_uen)').eq('grants.charity_uen', uen).order('expected_date', { ascending: true })
    if (error) { console.error('Could not load grant tranches:', error); return }
    const byGrant: Record<string, any> = {}
    ;(data || []).forEach(t => { if (!byGrant[t.grant_id]) byGrant[t.grant_id] = []; byGrant[t.grant_id].push(t) })
    setGrantTranches(byGrant)
  }

  async function saveGrantTranche(grantId: any, form: any) {
    if (!form.label.trim() || !form.amount || !form.expected_date) { showToast('Label, amount, and expected date are required', 'error'); return }
    if (isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) { showToast('Amount must be a positive number', 'error'); return }
    const trancheAmount = parseFloat(form.amount)
    const { data, error } = await supabase.from('grant_tranches').insert({
      charity_uen: charityUen,
      grant_id: grantId,
      label: form.label.trim(),
      amount: trancheAmount,
      expected_date: form.expected_date,
    }).select().single()
    if (error) { showToast('Error adding tranche', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'grant_tranche_added',
      details: { funder_name: grants.find(g => g.id === grantId)?.funder_name, label: form.label.trim(), amount: trancheAmount, expected_date: form.expected_date, charity_uen: charityUen },
    })
    setGrantTranches(prev => ({ ...prev, [grantId]: [...(prev[grantId] || []), data].sort((a, b) => new Date(a.expected_date).getTime() - new Date(b.expected_date).getTime()) }))
    const grantForTranche = grants.find(g => g.id === grantId)
    const grantTotal = Number(grantForTranche?.amount) || 0
    const trancheTotalSoFar = (grantTranches[grantId] || []).reduce((s: any, t: any) => s + Number(t.amount), 0) + trancheAmount
    if (grantTotal > 0 && trancheTotalSoFar > grantTotal) {
      showToast(`Tranche added, but scheduled tranches ($${trancheTotalSoFar.toLocaleString()}) now exceed the grant total ($${grantTotal.toLocaleString()}) ⚠`, 'error')
    } else {
      showToast('Tranche added ✓')
    }
  }

  async function toggleGrantTrancheReceived(tranche: any) {
    const { data, error } = await supabase.from('grant_tranches').update({
      received: !tranche.received,
      received_at: !tranche.received ? new Date().toISOString() : null,
    }).eq('id', tranche.id).select().single()
    if (error) { showToast('Error updating tranche', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: data.received ? 'grant_tranche_received' : 'grant_tranche_unreceived',
      details: { funder_name: grants.find(g => g.id === tranche.grant_id)?.funder_name, label: tranche.label, amount: tranche.amount, charity_uen: charityUen },
    })
    setGrantTranches(prev => ({ ...prev, [tranche.grant_id]: (prev[tranche.grant_id] || []).map((t: any) => t.id === tranche.id ? data : t) }))
  }

  async function editGrantTranche(tranche: any, updates: any) {
    const { data, error } = await supabase.from('grant_tranches').update(updates).eq('id', tranche.id).select().single()
    if (error) { showToast('Error updating tranche', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'grant_tranche_edited',
      details: { funder_name: grants.find(g => g.id === tranche.grant_id)?.funder_name, before: { label: tranche.label, amount: tranche.amount, expected_date: tranche.expected_date }, after: updates, charity_uen: charityUen },
    })
    setGrantTranches(prev => ({ ...prev, [tranche.grant_id]: (prev[tranche.grant_id] || []).map((t: any) => t.id === tranche.id ? data : t).sort((a: any, b: any) => new Date(a.expected_date).getTime() - new Date(b.expected_date).getTime()) }))
    showToast('Tranche updated ✓')
  }

  async function deleteGrantTranche(tranche: any) {
    const { error } = await supabase.from('grant_tranches').delete().eq('id', tranche.id)
    if (error) { showToast('Error deleting tranche', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'grant_tranche_deleted',
      details: { funder_name: grants.find(g => g.id === tranche.grant_id)?.funder_name, label: tranche.label, amount: tranche.amount, charity_uen: charityUen },
    })
    setGrantTranches(prev => ({ ...prev, [tranche.grant_id]: (prev[tranche.grant_id] || []).filter((t: any) => t.id !== tranche.id) }))
  }

  async function loadGrantMatchClaims() {
    const uen = session?.user?.app_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase.from('grant_match_claims').select('*, grants!inner(charity_uen)').eq('grants.charity_uen', uen).order('claim_date', { ascending: false })
    if (error) { console.error('Could not load grant match claims:', error); return }
    const byGrant: Record<string, any> = {}
    ;(data || []).forEach(c => { if (!byGrant[c.grant_id]) byGrant[c.grant_id] = []; byGrant[c.grant_id].push(c) })
    setGrantMatchClaims(byGrant)
  }

  async function saveGrantMatchClaim(grantId: any, form: any) {
    if (!form.amount || !form.claim_date) { showToast('Amount and claim date are required', 'error'); return }
    if (isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) { showToast('Amount must be a positive number', 'error'); return }
    const claimAmount = parseFloat(form.amount)
    const { data, error } = await supabase.from('grant_match_claims').insert({
      charity_uen: charityUen,
      grant_id: grantId,
      amount: claimAmount,
      claim_date: form.claim_date,
      notes: form.notes?.trim() || null,
    }).select().single()
    if (error) { showToast('Error adding claim', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'grant_match_claim_added',
      details: { funder_name: grants.find(g => g.id === grantId)?.funder_name, amount: claimAmount, claim_date: form.claim_date, charity_uen: charityUen },
    })
    setGrantMatchClaims(prev => ({ ...prev, [grantId]: [data, ...(prev[grantId] || [])] }))
    const grantForCap = grants.find(g => g.id === grantId)
    const capNum = Number(grantForCap?.match_cap) || 0
    const claimedSoFar = (grantMatchClaims[grantId] || []).reduce((s: any, c: any) => s + Number(c.amount), 0) + claimAmount
    if (capNum > 0 && claimedSoFar > capNum) {
      showToast(`Claim logged, but total claimed ($${claimedSoFar.toLocaleString()}) now exceeds the $${capNum.toLocaleString()} match cap ⚠`, 'error')
    } else {
      showToast('Claim logged ✓')
    }
  }

  async function editGrantMatchClaim(claim: any, updates: any) {
    const { data, error } = await supabase.from('grant_match_claims').update(updates).eq('id', claim.id).select().single()
    if (error) { showToast('Error updating claim', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'grant_match_claim_edited',
      details: { funder_name: grants.find(g => g.id === claim.grant_id)?.funder_name, before: { amount: claim.amount, claim_date: claim.claim_date }, after: updates, charity_uen: charityUen },
    })
    setGrantMatchClaims(prev => ({ ...prev, [claim.grant_id]: (prev[claim.grant_id] || []).map((c: any) => c.id === claim.id ? data : c) }))
    showToast('Claim updated ✓')
  }

  async function deleteGrantMatchClaim(claim: any) {
    const { error } = await supabase.from('grant_match_claims').delete().eq('id', claim.id)
    if (error) { showToast('Error deleting claim', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'grant_match_claim_deleted',
      details: { funder_name: grants.find(g => g.id === claim.grant_id)?.funder_name, amount: claim.amount, claim_date: claim.claim_date, charity_uen: charityUen },
    })
    setGrantMatchClaims(prev => ({ ...prev, [claim.grant_id]: (prev[claim.grant_id] || []).filter((c: any) => c.id !== claim.id) }))
  }

  async function saveGrantExpense(grantId: any, form: any) {
    if (!form.description.trim() || !form.amount) { showToast('Description and amount are required', 'error'); return }
    if (isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) { showToast('Amount must be a positive number', 'error'); return }
    const expenseAmount = parseFloat(form.amount)
    const { data, error } = await supabase.from('grant_expenses').insert({
      grant_id: grantId,
      description: form.description.trim(),
      amount: expenseAmount,
      expense_date: form.expense_date,
      category: form.category || null,
      created_by: session.user.email,
    }).select().single()
    if (error) { showToast('Error saving expense', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'grant_expense_logged',
      details: { funder_name: grants.find(g => g.id === grantId)?.funder_name, description: form.description.trim(), amount: expenseAmount, category: form.category || null, charity_uen: charityUen },
    })
    setGrantExpenses(prev => [...prev, data])
    const grantForExpense = grants.find(g => g.id === grantId)
    const grantTotal = Number(grantForExpense?.amount) || 0
    const spentSoFar = grantExpenses.filter(e => e.grant_id === grantId).reduce((s, e) => s + Number(e.amount), 0) + expenseAmount
    if (grantTotal > 0 && spentSoFar > grantTotal) {
      showToast(`Expense logged, but this grant is now over budget: $${spentSoFar.toLocaleString()} spent of $${grantTotal.toLocaleString()} ⚠`, 'error')
    } else {
      showToast('Expense logged ✓')
    }
  }

  async function editGrantExpense(expense: any, updates: any) {
    const { data, error } = await supabase.from('grant_expenses').update(updates).eq('id', expense.id).select().single()
    if (error) { showToast('Error updating expense', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'grant_expense_edited',
      details: { funder_name: grants.find(g => g.id === expense.grant_id)?.funder_name, before: { description: expense.description, amount: expense.amount }, after: updates, charity_uen: charityUen },
    })
    setGrantExpenses(prev => prev.map(e => e.id === expense.id ? data : e))
    showToast('Expense updated ✓')
  }

  async function deleteGrantExpense(id: any) {
    const expense = grantExpenses.find(e => e.id === id)
    await supabase.from('grant_expenses').delete().eq('id', id)
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'grant_expense_deleted',
      details: { funder_name: expense ? grants.find(g => g.id === expense.grant_id)?.funder_name : null, description: expense?.description, amount: expense?.amount, charity_uen: charityUen },
    })
    setGrantExpenses(prev => prev.filter(e => e.id !== id))
    showToast('Removed')
  }

  async function loadRefunds() {
    const uen = session?.user?.app_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase.from('refunds').select('*').eq('charity_uen', uen)
    if (error) { console.error('Could not load refunds:', error); return }
    setRefunds(data || [])
  }

  async function loadInKindDonations(activeSession = session) {
    const uen = activeSession?.user?.app_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase.from('in_kind_donations').select('*').eq('charity_uen', uen).order('received_date', { ascending: false })
    if (error) { console.error('Could not load in-kind donations:', error); return }
    setInKindDonations(data || [])
  }

  function closeInKindForm() {
    setShowInKindForm(false)
    setEditingInKindId(null)
    setInKindError('')
    setInKindForm({ donor_name: '', donor_email: '', donor_nric: '', donor_phone: '', category: 'goods', item_description: '', estimated_value: '', received_date: new Date().toISOString().split('T')[0], cause_id: '', notes: '', is_anonymous: false, valuation_basis: '', condition: '' })
  }

  function startEditingInKind(item: any) {
    setEditingInKindId(item.id)
    setInKindForm({
      donor_name: item.donor_name || '',
      donor_email: item.donor_email || '',
      donor_nric: item.donor_nric || '',
      donor_phone: item.donor_phone || '',
      category: item.category,
      item_description: item.item_description,
      estimated_value: item.estimated_value?.toString() || '',
      received_date: item.received_date,
      cause_id: item.cause_id || '',
      notes: item.notes || '',
      is_anonymous: item.is_anonymous || false,
      valuation_basis: item.valuation_basis || '',
      condition: item.condition || '',
    })
    setShowInKindForm(true)
  }

  async function saveInKindDonation() {
    if (savingInKind) return
    if (!inKindForm.is_anonymous && !inKindForm.donor_name.trim()) { setInKindError('Donor name is required (or mark as anonymous)'); return }
    if (!inKindForm.item_description.trim()) { setInKindError('A description of the item or service is required'); return }
    const val = parseFloat(inKindForm.estimated_value)
    if (!inKindForm.estimated_value || isNaN(val) || val <= 0) { setInKindError('Estimated value must be a positive number'); return }
    if (!inKindForm.received_date) { setInKindError('Date received is required'); return }
    setInKindError('')
    setSavingInKind(true)

    const payload = {
      donor_name: inKindForm.is_anonymous ? 'Anonymous' : inKindForm.donor_name.trim(),
      donor_email: inKindForm.is_anonymous ? null : (inKindForm.donor_email?.trim().toLowerCase() || null),
      donor_nric: inKindForm.is_anonymous ? null : (inKindForm.donor_nric?.trim().toUpperCase() || null),
      donor_phone: inKindForm.is_anonymous ? null : (inKindForm.donor_phone?.trim() || null),
      category: inKindForm.category,
      item_description: inKindForm.item_description.trim(),
      estimated_value: val,
      received_date: inKindForm.received_date,
      cause_id: inKindForm.cause_id || null,
      notes: inKindForm.notes?.trim() || null,
      is_anonymous: inKindForm.is_anonymous,
      valuation_basis: inKindForm.valuation_basis?.trim() || null,
      condition: inKindForm.condition || null,
      charity_uen: charityUen,
      created_by: session.user.email,
    }

    if (editingInKindId) {
      const original = inKindDonations.find(d => d.id === editingInKindId)
      // Once a receipt has been issued, the acknowledged gift details are frozen -- correcting
      // them silently here would let the receipt PDF (regenerated on demand from live fields)
      // drift from what was actually issued. Void & Reissue is the only sanctioned way to
      // correct an issued receipt, matching the cash-donation flow, so protected fields are
      // pinned back to their original values regardless of what the form submitted.
      const finalPayload = original?.receipt_issued ? {
        ...payload,
        donor_name: original.donor_name,
        donor_email: original.donor_email,
        donor_nric: original.donor_nric,
        donor_phone: original.donor_phone,
        is_anonymous: original.is_anonymous,
        category: original.category,
        item_description: original.item_description,
        estimated_value: original.estimated_value,
        received_date: original.received_date,
        cause_id: original.cause_id,
        condition: original.condition,
        valuation_basis: original.valuation_basis,
      } : payload
      const { data, error } = await supabase.from('in_kind_donations').update(finalPayload).eq('id', editingInKindId).select().single()
      setSavingInKind(false)
      if (error) { setInKindError('Error saving changes'); return }
      setInKindDonations(prev => prev.map(d => d.id === editingInKindId ? data : d).sort((a, b) => new Date(b.received_date).getTime() - new Date(a.received_date).getTime()))
      showToast('In-kind gift updated ✓')
    } else {
      const { data, error } = await supabase.from('in_kind_donations').insert(payload).select().single()
      setSavingInKind(false)
      if (error) { setInKindError('Error saving in-kind gift'); return }
      setInKindDonations(prev => [data, ...prev].sort((a, b) => new Date(b.received_date).getTime() - new Date(a.received_date).getTime()))
      await supabase.from('audit_log').insert({
        actor_type: 'charity',
        actor_email: session.user.email,
        action: 'in_kind_donation_logged',
        details: { donor_name: payload.donor_name, item_description: payload.item_description, estimated_value: val, charity_uen: charityUen },
      })
      showToast('In-kind gift logged ✓')
    }
    closeInKindForm()
  }

  async function deleteInKindDonation(item: any) {
    setConfirmModal({
      title: 'Delete this in-kind gift?',
      description: item.receipt_issued
        ? `⚠ A receipt (${item.receipt_number}) has already been issued for "${item.item_description}" from ${item.donor_name}. Deleting will permanently remove the record; the deletion itself is still logged in the audit trail. This cannot be undone.`
        : `"${item.item_description}" from ${item.donor_name} will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        const { error } = await supabase.from('in_kind_donations').delete().eq('id', item.id)
        if (error) { showToast('Error deleting in-kind gift', 'error'); return }
        await supabase.from('audit_log').insert({
          actor_type: 'charity',
          actor_email: session.user.email,
          action: 'in_kind_donation_deleted',
          details: { donor_name: item.donor_name, item_description: item.item_description, estimated_value: item.estimated_value, receipt_number: item.receipt_number || null, charity_uen: charityUen },
        })
        setInKindDonations(prev => prev.filter(d => d.id !== item.id))
        showToast('In-kind gift deleted')
      },
    })
  }

  async function toggleInKindThankYou(item: any) {
    if (!item.donor_email?.trim()) {
      // No email on file -- this is a manual bookkeeping flag with no send capability
      // at all, so (unlike Donations) toggling it back off is a legitimate action here.
      const { data, error } = await supabase.from('in_kind_donations').update({ thank_you_sent: !item.thank_you_sent }).eq('id', item.id).select().single()
      if (error) { showToast('Error updating thank-you status', 'error'); return }
      setInKindDonations(prev => prev.map(d => d.id === item.id ? data : d))
      if (!item.thank_you_sent) showToast('Marked as thanked — no email on file, so no email was sent')
      return
    }
    // Has an email on file -- always go through send/resend, matching Donations
    // (which never offers an "unmark" once a thank-you has been sent).
    setInKindThankYouModal(item)
    setInKindThankYouSubject(`Thank you for your generous gift, ${item.donor_name}!`)
    setInKindThankYouMessage(`Thank you so much for your donation of ${item.item_description} to ${charityName}. Your generosity means a great deal to us and the people we serve.`)
    setInKindThankYouPreviewing(false)
  }

  async function updateInKindNotes(item: any, notes: string) {
    const { data, error } = await supabase.from('in_kind_donations').update({ notes }).eq('id', item.id).select().single()
    if (error) { showToast('Error saving note', 'error'); return }
    setInKindDonations(prev => prev.map(d => d.id === item.id ? data : d))
  }

  async function updateInKindImpactNote(item: any, impact_note: string) {
    const { data, error } = await supabase.from('in_kind_donations').update({ impact_note }).eq('id', item.id).select().single()
    if (error) { showToast('Error saving impact note', 'error'); return }
    setInKindDonations(prev => prev.map(d => d.id === item.id ? data : d))
  }

  const [uploadingInKindPhotoId, setUploadingInKindPhotoId] = useState<any>(null)

  async function uploadInKindPhoto(item: any, file: any) {
    if (!file) return
    if (!file.type.startsWith('image/')) { showToast('Please choose an image file', 'error'); return }
    if (file.size > 5 * 1024 * 1024) { showToast('Photo must be under 5MB', 'error'); return }
    setUploadingInKindPhotoId(item.id)
    const ext = file.name.split('.').pop().toLowerCase()
    const path = `${charityUen}/inkind/${item.id}.${ext}`
    const { error: uploadError } = await supabase.storage.from('charity-assets').upload(path, file, { upsert: true, cacheControl: '3600' })
    if (uploadError) { showToast(`Error uploading photo: ${uploadError.message}`, 'error'); setUploadingInKindPhotoId(null); return }
    const { data: urlData } = supabase.storage.from('charity-assets').getPublicUrl(path)
    const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`
    const { data, error: dbError } = await supabase.from('in_kind_donations').update({ photo_url: publicUrl }).eq('id', item.id).select().single()
    if (dbError) { showToast(`Error saving photo: ${dbError.message}`, 'error'); setUploadingInKindPhotoId(null); return }
    setInKindDonations(prev => prev.map(d => d.id === item.id ? data : d))
    setUploadingInKindPhotoId(null)
    showToast('Photo uploaded ✓')
  }

  async function removeInKindPhoto(item: any) {
    const { data, error } = await supabase.from('in_kind_donations').update({ photo_url: null }).eq('id', item.id).select().single()
    if (error) { showToast('Error removing photo', 'error'); return }
    setInKindDonations(prev => prev.map(d => d.id === item.id ? data : d))
  }

  const [issuingInKindReceiptId, setIssuingInKindReceiptId] = useState<any>(null)
  const [bulkInKindActionInProgress, setBulkInKindActionInProgress] = useState<any>(false)
  const [bulkInKindProgress, setBulkInKindProgress] = useState<any>(null)
  const bulkInKindCancelRef = useRef<boolean>(false)

  // Acknowledgement receipt, not a tax receipt -- IRAS doesn't grant tax deductions for
  // non-cash gifts under the standard scheme, so this uses its own IK-prefixed sequence
  // entirely separate from the cash-donation MR- receipt numbers. Returns the new receipt
  // number on success, or null on failure -- shared by the single-issue and bulk-issue paths
  // so only one of them needs to log the audit entry / show a toast.
  async function issueInKindReceiptCore(item: any): Promise<string | null> {
    const entryYear = new Date(item.received_date).getFullYear()
    const { data: receiptNumber, error: seqError } = await supabase.rpc('next_inkind_receipt_number', { p_charity_uen: charityUen, p_year: entryYear })
    if (seqError) return null
    const { data, error } = await supabase.from('in_kind_donations').update({
      receipt_number: receiptNumber,
      receipt_issued: true,
      receipt_issued_at: new Date().toISOString(),
    }).eq('id', item.id).select().single()
    if (error) return null
    setInKindDonations(prev => prev.map(d => d.id === item.id ? data : d))
    return receiptNumber
  }

  async function issueInKindReceipt(item: any) {
    if (issuingInKindReceiptId === item.id) return
    setIssuingInKindReceiptId(item.id)
    const receiptNumber = await issueInKindReceiptCore(item)
    if (!receiptNumber) { showToast('Error issuing receipt', 'error'); setIssuingInKindReceiptId(null); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'inkind_receipt_issued',
      details: { donor_name: item.donor_name, item_description: item.item_description, receipt_number: receiptNumber },
    })
    setIssuingInKindReceiptId(null)
    showToast(`Receipt ${receiptNumber} issued`)
  }

  async function issueAllInKindReceipts() {
    if (bulkInKindActionInProgress) return
    const pending = inKindDonations.filter(d => !d.receipt_issued)
    if (pending.length === 0) { showToast('No in-kind receipts pending'); return }
    setBulkInKindActionInProgress(true)
    bulkInKindCancelRef.current = false
    setBulkInKindProgress({ done: 0, total: pending.length })
    let issuedCount = 0
    for (const item of pending) {
      if (bulkInKindCancelRef.current) break
      const receiptNumber = await issueInKindReceiptCore(item)
      if (receiptNumber) issuedCount++
      setBulkInKindProgress({ done: issuedCount, total: pending.length })
    }
    if (issuedCount > 0) {
      await supabase.from('audit_log').insert({
        actor_type: 'charity',
        actor_email: session.user.email,
        action: 'bulk_inkind_receipts_issued',
        details: { count: issuedCount },
      })
    }
    setBulkInKindActionInProgress(false)
    setBulkInKindProgress(null)
    if (bulkInKindCancelRef.current) {
      showToast(`Cancelled — ${issuedCount} of ${pending.length} receipts issued before stopping`)
    } else {
      showToast(`${issuedCount} receipt${issuedCount > 1 ? 's' : ''} issued`)
    }
  }

  const [voidingInKindReceipt, setVoidingInKindReceipt] = useState<any>(false)

  async function voidAndReissueInKindReceipt(item: any, reason: string) {
    if (!reason.trim()) { showToast('Please enter a reason for voiding', 'error'); return }
    setVoidingInKindReceipt(true)

    const { error: voidError } = await supabase.from('in_kind_donations').update({
      receipt_voided: true,
      voided_at: new Date().toISOString(),
      voided_by: session.user.email,
      void_reason: reason.trim(),
      receipt_issued: false,
    }).eq('id', item.id)
    if (voidError) { showToast('Error voiding receipt', 'error'); setVoidingInKindReceipt(false); return }

    const entryYear = new Date(item.received_date).getFullYear()
    const { data: newReceiptNumber, error: countError } = await supabase.rpc('next_inkind_receipt_number', { p_charity_uen: charityUen, p_year: entryYear })
    if (countError) { showToast('Error generating new receipt number', 'error'); setVoidingInKindReceipt(false); return }

    const { data, error: reissueError } = await supabase.from('in_kind_donations').update({
      receipt_issued: true,
      receipt_number: newReceiptNumber,
      reissued_from: item.receipt_number,
      thank_you_sent: false,
    }).eq('id', item.id).select().single()
    if (reissueError) { showToast('Error reissuing receipt', 'error'); setVoidingInKindReceipt(false); return }

    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'inkind_receipt_voided_and_reissued',
      details: {
        donor_name: item.donor_name,
        old_receipt_number: item.receipt_number,
        new_receipt_number: newReceiptNumber,
        void_reason: reason.trim(),
      },
    })

    setInKindDonations(prev => prev.map(d => d.id === item.id ? data : d))
    setVoidingInKindReceipt(false)
    showToast(`Receipt voided ✓ — new receipt issued as ${newReceiptNumber}`)
  }

  function generateInKindReceiptPDFDoc(item: any) {
    const doc = new jsPDF()
    const pageWidth = 210
    const pageHeight = 297
    const margin = 22
    const contentWidth = pageWidth - margin * 2
    const forest = [27, 67, 50] as [number, number, number]
    const gold = [180, 135, 14] as [number, number, number]
    const mutedText = [130, 122, 112] as [number, number, number]
    const faintText = [178, 172, 162] as [number, number, number]
    const darkText = [35, 35, 35] as [number, number, number]
    const hairline = [232, 226, 216] as [number, number, number]
    const microLabel = (text: any, x: any, ty: any, opts: any = {}) => {
      if (opts.align === 'center' || opts.align === 'right') { doc.text(text, x, ty, opts); return }
      doc.setCharSpace(0.6)
      doc.text(text, x, ty, opts)
      doc.setCharSpace(0)
    }

    try {
      doc.saveGraphicsState()
      doc.setGState(new (doc as any).GState({ opacity: 0.045 }))
      if (charityLogoDataUrl) {
        const fmt = charityLogoDataUrl.startsWith('data:image/png') ? 'PNG' : charityLogoDataUrl.startsWith('data:image/webp') ? 'WEBP' : 'JPEG'
        const size = 130
        doc.addImage(charityLogoDataUrl, fmt, (pageWidth - size) / 2, (pageHeight - size) / 2, size, size)
      } else {
        doc.setFont('times', 'bold')
        doc.setFontSize(260)
        doc.setTextColor(...forest)
        doc.text((charityName || 'C').trim().charAt(0).toUpperCase(), pageWidth / 2, pageHeight / 2 + 60, { align: 'center' })
      }
      doc.restoreGraphicsState()
    } catch (e) { console.error('Could not render receipt watermark:', e) }

    const headerHeight = 46
    doc.setFillColor(...forest)
    doc.rect(0, 0, pageWidth, headerHeight, 'F')
    doc.setFillColor(...gold)
    doc.rect(0, headerHeight, pageWidth, 0.9, 'F')

    const hasLogo = !!charityLogoDataUrl
    let textX = margin
    if (hasLogo) {
      try {
        const fmt = charityLogoDataUrl.startsWith('data:image/png') ? 'PNG' : charityLogoDataUrl.startsWith('data:image/webp') ? 'WEBP' : 'JPEG'
        const logoSize = 25, badgePad = 3.5, badgeSize = logoSize + badgePad * 2
        const badgeY = (headerHeight - badgeSize) / 2
        doc.setFillColor(255, 255, 255)
        doc.roundedRect(margin, badgeY, badgeSize, badgeSize, 2.5, 2.5, 'F')
        doc.addImage(charityLogoDataUrl, fmt, margin + badgePad, badgeY + badgePad, logoSize, logoSize)
        textX = margin + badgeSize + 10
      } catch (e) { console.error('Could not embed logo in receipt:', e) }
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    microLabel('ACKNOWLEDGEMENT OF GIFT-IN-KIND', textX, 17)
    doc.setFontSize(19)
    doc.setFont('times', 'bold')
    doc.text(charityName || 'Charity', textX, 27.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(220, 227, 223)
    doc.text(`UEN ${charityUen || ''}  ·  Registered Charity`, textX, 35.5)

    let y = 62
    doc.setFontSize(9)
    doc.setTextColor(...mutedText)
    microLabel('RECEIVED FROM', margin, y)
    microLabel('RECEIPT NO.', pageWidth - margin, y, { align: 'right' })
    y += 7
    doc.setFontSize(16)
    doc.setFont('times', 'bold')
    doc.setTextColor(...darkText)
    doc.text(item.is_anonymous ? 'Anonymous' : (item.donor_name || ''), margin, y)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...forest)
    doc.text(item.receipt_number || 'N/A', pageWidth - margin, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')

    y += 16
    doc.setDrawColor(...hairline)
    doc.line(margin, y, pageWidth - margin, y)
    y += 13
    doc.setFontSize(9)
    doc.setTextColor(...mutedText)
    microLabel('GIFT DESCRIPTION', margin, y)
    y += 7
    doc.setFontSize(13)
    doc.setFont('times', 'bold')
    doc.setTextColor(...darkText)
    const descLines = doc.splitTextToSize(item.item_description || '', contentWidth)
    doc.text(descLines, margin, y)
    doc.setFont('helvetica', 'normal')
    y += descLines.length * 7 + 6

    doc.setDrawColor(...hairline)
    doc.line(margin, y, pageWidth - margin, y)
    y += 7
    const facts: [string, string][] = [
      ['Estimated value', `SGD $${Number(item.estimated_value).toLocaleString()}.00 (est.)`],
      ['Date received', new Date(item.received_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })],
    ]
    const causeTitle = item.cause_id ? myCauses.find(c => c.id === item.cause_id)?.title : null
    if (causeTitle) facts.push(['Designated to', causeTitle])
    if (item.condition) facts.push(['Condition', item.condition])
    if (item.valuation_basis) facts.push(['Valuation basis', item.valuation_basis])
    if (item.reissued_from) facts.push(['Reissued from receipt', item.reissued_from])
    if (item.receipt_voided) facts.push(['Status', 'VOIDED'])

    facts.forEach(([label, value], i) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(...mutedText)
      doc.text(label, margin, y)
      doc.setFont('times', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(...darkText)
      doc.text(String(value), pageWidth - margin, y, { align: 'right' })
      y += 9
      if (i < facts.length - 1) {
        doc.setDrawColor(...hairline)
        doc.line(margin, y - 4.5, pageWidth - margin, y - 4.5)
      }
    })

    y += 4
    doc.setFillColor(...gold)
    const disclaimerLines = doc.splitTextToSize('This acknowledges receipt of a non-cash gift-in-kind. It is not a cash donation receipt and does not qualify for a tax deduction under Singapore tax law, regardless of IPC status.', contentWidth - 10)
    doc.rect(margin, y, 0.8, disclaimerLines.length * 5.5 + 6, 'F')
    doc.setFontSize(8.5)
    doc.setTextColor(...gold)
    microLabel('PLEASE NOTE', margin + 5, y + 4.5)
    doc.setFontSize(10)
    doc.setFont('times', 'italic')
    doc.setTextColor(...darkText)
    doc.text(disclaimerLines, margin + 5, y + 11)
    doc.setFont('helvetica', 'normal')
    y += disclaimerLines.length * 5.5 + 14

    if (item.impact_note?.trim()) {
      y += 8
      doc.setFillColor(...gold)
      const impactLines = doc.splitTextToSize(`"${item.impact_note.trim()}"`, contentWidth - 10)
      doc.rect(margin, y, 0.8, impactLines.length * 5.5 + 6, 'F')
      doc.setFontSize(8.5)
      doc.setTextColor(...gold)
      microLabel('THE DIFFERENCE YOUR GIFT MADE', margin + 5, y + 4.5)
      doc.setFontSize(11)
      doc.setFont('times', 'italic')
      doc.setTextColor(...forest)
      doc.text(impactLines, margin + 5, y + 11)
      doc.setFont('helvetica', 'normal')
      y += impactLines.length * 5.5 + 12
    }

    y += 10
    doc.setDrawColor(...hairline)
    doc.line(margin, y, pageWidth - margin, y)
    y += 12
    doc.setFontSize(12)
    doc.setFont('times', 'italic')
    doc.setTextColor(...forest)
    doc.text('With heartfelt thanks for your generosity,', pageWidth - margin, y, { align: 'right' })
    y += 8.5
    doc.setFont('times', 'bolditalic')
    doc.setFontSize(13)
    doc.text(`The ${charityName || 'team'}`, pageWidth - margin, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')

    const footerY = Math.max(pageHeight - 26, y + 18)
    doc.setDrawColor(...hairline)
    doc.setLineWidth(0.4)
    doc.roundedRect(margin - 6, 52, contentWidth + 12, footerY - 58, 2, 2, 'S')
    doc.setLineWidth(0.2)

    doc.setDrawColor(...hairline)
    doc.line(margin, footerY, pageWidth - margin, footerY)
    doc.setFontSize(9)
    doc.setTextColor(...mutedText)
    doc.text('Issued via Giving Tree, a donation platform for Singapore charities', pageWidth / 2, footerY + 7.5, { align: 'center' })
    doc.setFontSize(8.5)
    doc.setTextColor(...faintText)
    doc.text('This is an acknowledgement of a gift-in-kind, not a tax-deductible cash donation receipt.', pageWidth / 2, footerY + 15, { align: 'center', maxWidth: contentWidth })

    return doc
  }

  function exportInKindReceiptPDF(item: any) {
    const doc = generateInKindReceiptPDFDoc(item)
    doc.save(`InKindReceipt-${item.receipt_number || item.id}.pdf`)
    logExport('inkind_receipt_pdf', { in_kind_id: item.id, donor_name: item.donor_name })
  }

  function buildInKindThankYouPreviewHtml(item: any, customMessage: any) {
    const safeDonorName = escapeHtml(item.donor_name)
    const safeCharityName = escapeHtml(charityName)
    const safeItemDescription = escapeHtml(item.item_description)
    const cause = item.cause_id ? myCauses.find(c => c.id === item.cause_id) : null
    const safeCauseTitle = cause ? escapeHtml(cause.title) : null
    const dateStr = new Date(item.received_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })
    const customBlock = customMessage?.trim()
      ? `<p style="font-size:13px;color:${C.text};line-height:1.6;margin:10px 0;">${escapeHtml(customMessage.trim())}</p>`
      : ''
    return `
      <div style="background:${C.forest};border-radius:12px;padding:22px;text-align:center;margin-bottom:16px;">
        <div style="font-size:17px;font-weight:700;color:white;">Thank You, ${safeDonorName}!</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:4px;">Your gift-in-kind makes a real difference</div>
      </div>
      ${customBlock ? `<div style="background:white;border-radius:12px;padding:14px;border:1px solid ${C.border};margin-bottom:12px;">${customBlock}</div>` : ''}
      <div style="background:white;border-radius:12px;padding:16px;border:1px solid ${C.border};">
        <div style="font-size:11px;color:${C.emailMuted};text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;font-weight:600;">Gift Details</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;"><span style="color:${C.emailMuted};">Charity</span><span style="font-weight:700;color:${C.forest};">${safeCharityName}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;"><span style="color:${C.emailMuted};">Item</span><span style="font-weight:700;color:${C.forest};">${safeItemDescription}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;"><span style="color:${C.emailMuted};">Date Received</span><span style="font-weight:700;color:${C.forest};">${dateStr}</span></div>
        ${safeCauseTitle ? `<div style="display:flex;justify-content:space-between;font-size:13px;"><span style="color:${C.emailMuted};">Cause</span><span style="font-weight:700;color:${C.emailAccentGold};">🎯 ${safeCauseTitle}</span></div>` : ''}
      </div>
      <div style="font-size:11px;color:${C.emailMuted};margin-top:10px;line-height:1.5;">This is a gift-in-kind acknowledgement, not a cash donation receipt — it does not carry a tax deduction.</div>`
  }

  async function sendInKindThankYouEmail(item: any) {
    if (sendingInKindThankYouId === item.id) return
    setSendingInKindThankYouId(item.id)
    const cause = item.cause_id ? myCauses.find(c => c.id === item.cause_id) : null
    const { error } = await sendCharityEmail({
      donor_name: item.donor_name,
      donor_email: item.donor_email,
      charity_name: charityName,
      charity_uen: charityUen,
      type: 'in_kind_thank_you',
      item_description: item.item_description,
      estimated_value: item.estimated_value,
      cause_title: cause?.title || null,
      date: new Date(item.received_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' }),
      subject_override: inKindThankYouSubject?.trim() || undefined,
      custom_message: inKindThankYouMessage?.trim() || null,
    })
    if (error) { showToast('Failed to send email', 'error'); setSendingInKindThankYouId(null); return }
    setInKindThankYouSubject('')
    setInKindThankYouMessage('')
    const { data, error: updateError } = await supabase.from('in_kind_donations').update({ thank_you_sent: true }).eq('id', item.id).select().single()
    if (!updateError) setInKindDonations(prev => prev.map(d => d.id === item.id ? data : d))
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'in_kind_thank_you_sent',
      details: { donor_name: item.donor_name, donor_email: item.donor_email, item_description: item.item_description },
    })
    setSendingInKindThankYouId(null)
    showToast(`Email sent to ${item.donor_email}`)
  }

  async function saveRefund(donation: any) {
    if (savingRefund) return
    if (!refundForm.reason.trim()) { showToast('A reason is required', 'error'); return }
    const alreadyRefunded = refunds.filter(r => r.donation_id === donation.id).reduce((s, r) => s + Number(r.refund_amount), 0)
    if (alreadyRefunded > 0) { showToast('This donation has already been refunded', 'error'); return }
    setSavingRefund(true)
    const refundAmt = Number(donation.amount)

    // Look up what a refund is about to unwind BEFORE touching anything, so the exact prior state
    // can be snapshotted onto the refund row itself — that's what lets deleting the refund later
    // (correcting a mistake) fully restore the pledge link and recurring-gift dates/totals, not
    // just the donation's payment_status.
    const { data: linkRow } = await supabase
      .from('pledge_donations')
      .select('pledge_id, amount_applied')
      .eq('donation_id', donation.id)
      .maybeSingle()
    const linkedPledge = linkRow ? pledges.find(p => p.id === linkRow.pledge_id) : null
    const recurringGift = donation.recurring_gift_id ? recurringGifts.find(g => g.id === donation.recurring_gift_id) : null

    const { data, error } = await supabase.from('refunds').insert({
      donation_id: donation.id,
      charity_uen: charityUen,
      original_amount: donation.amount,
      refund_amount: refundAmt,
      refund_date: new Date().toISOString().split('T')[0],
      reason: refundForm.reason.trim(),
      approved_by: session.user.email,
      unlinked_pledge_id: linkRow?.pledge_id || null,
      unlinked_pledge_amount_applied: linkRow?.amount_applied || null,
      pledge_was_fulfilled: linkedPledge?.status === 'fulfilled',
      recurring_gift_id: donation.recurring_gift_id || null,
      recurring_gift_prior_last_received: recurringGift?.last_received_date || null,
      recurring_gift_prior_next_expected: recurringGift?.next_expected_date || null,
    }).select().single()
    if (error) { console.error('Refund insert error:', error); showToast(`Error recording refund: ${error.message}`, 'error'); setSavingRefund(false); return }
    setRefunds(prev => [...prev, data])

    // Refunded money isn't a real completed gift anymore — pull it out of totals, analytics,
    // and the IRAS tax-deduction export by moving it off payment_status: 'confirmed', the status
    // every aggregate in this app filters on. The row stays visible (not deleted) so it's still
    // auditable in the Donations list, just clearly marked and excluded from the numbers.
    const { error: statusError } = await supabase.from('donations').update({ payment_status: 'refunded' }).eq('id', donation.id)
    if (statusError) { console.error('Could not mark donation as refunded:', statusError) }
    setDonations(prev => prev.map(d => d.id === donation.id ? { ...d, payment_status: 'refunded' } : d))
    setSelectedDonation((prev: any) => (prev && prev.id === donation.id ? { ...prev, payment_status: 'refunded' } : prev))

    // A refund reverses the gift, so unwind the same side-effects deleting the donation would —
    // otherwise a linked pledge keeps counting refunded money as "given" (and stays fulfilled if
    // this was the completing gift), and a recurring gift's last-received/next-expected/totals
    // stay based on a payment that's since been returned.
    if (linkRow) {
      await supabase.from('pledge_donations').delete().eq('pledge_id', linkRow.pledge_id).eq('donation_id', donation.id)
      setPledgeGivenTotals(prev => ({
        ...prev,
        [linkRow.pledge_id]: Math.max(0, (prev[linkRow.pledge_id] || 0) - Number(linkRow.amount_applied))
      }))
      if (linkedPledge?.status === 'fulfilled') {
        await supabase.from('pledges').update({ status: 'pending', resolution_notes: null, fulfilled_donation_id: null }).eq('id', linkRow.pledge_id)
        setPledges(prev => prev.map(p => p.id === linkRow.pledge_id ? { ...p, status: 'pending', resolution_notes: null, fulfilled_donation_id: null } : p))
      }
    }

    if (donation.recurring_gift_id) {
      const giftId = donation.recurring_gift_id
      const remaining = donations.filter(d => d.recurring_gift_id === giftId && d.id !== donation.id && d.status !== 'deleted_by_charity')
      const remainingConfirmed = remaining.filter(d => d.payment_status === 'confirmed').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      const newLastReceived = remainingConfirmed[0]?.created_at ? remainingConfirmed[0].created_at.split('T')[0] : null
      const newNextExpected = recurringGift ? computeNextExpectedDate(recurringGift.start_date, recurringGift.frequency, newLastReceived) : null
      if (recurringGift) {
        await supabase.from('recurring_gifts').update({
          last_received_date: newLastReceived,
          next_expected_date: newNextExpected,
        }).eq('id', giftId)
        setRecurringGifts(prev => prev.map(g => g.id === giftId ? { ...g, last_received_date: newLastReceived, next_expected_date: newNextExpected } : g))
      }
      setRecurringGivenTotals(prev => {
        const cur = prev[giftId]
        if (!cur) return prev
        return { ...prev, [giftId]: { total: Math.max(0, cur.total - Number(donation.amount)), count: Math.max(0, cur.count - 1) } }
      })
    }

    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'donation_refunded',
      donation_id: donation.id,
      details: { original_amount: donation.amount, refund_amount: refundAmt, reason: refundForm.reason.trim() },
    })
    setRefundForm({ reason: '' })
    setShowRefundForm(false)
    setSavingRefund(false)
    showToast('Refund recorded ✓')
  }

  async function deleteRefund(refund: any) {
    const { error } = await supabase.from('refunds').delete().eq('id', refund.id)
    if (error) { console.error('Refund delete error:', error); showToast(`Error deleting refund: ${error.message}`, 'error'); return }
    setRefunds(prev => prev.filter(r => r.id !== refund.id))

    // Deleting the refund record reverses the refund itself, so restore the donation to confirmed
    // — it goes back to counting in totals, analytics, and the IRAS export.
    const { error: statusError } = await supabase.from('donations').update({ payment_status: 'confirmed' }).eq('id', refund.donation_id)
    if (statusError) { console.error('Could not restore donation to confirmed:', statusError) }
    setDonations(prev => prev.map(d => d.id === refund.donation_id ? { ...d, payment_status: 'confirmed' } : d))
    setSelectedDonation((prev: any) => (prev && prev.id === refund.donation_id ? { ...prev, payment_status: 'confirmed' } : prev))

    // Restore whatever the refund unwound, using the snapshot saveRefund took at refund time —
    // re-link the pledge (and re-fulfill it if this gift was what completed it), and roll the
    // recurring gift's last-received/next-expected/totals back forward.
    if (refund.unlinked_pledge_id) {
      await supabase.from('pledge_donations').insert({ pledge_id: refund.unlinked_pledge_id, donation_id: refund.donation_id, amount_applied: refund.unlinked_pledge_amount_applied })
      setPledgeGivenTotals(prev => ({
        ...prev,
        [refund.unlinked_pledge_id]: (prev[refund.unlinked_pledge_id] || 0) + Number(refund.unlinked_pledge_amount_applied)
      }))
      if (refund.pledge_was_fulfilled) {
        await supabase.from('pledges').update({ status: 'fulfilled' }).eq('id', refund.unlinked_pledge_id)
        setPledges(prev => prev.map(p => p.id === refund.unlinked_pledge_id ? { ...p, status: 'fulfilled' } : p))
      }
    }

    if (refund.recurring_gift_id) {
      await supabase.from('recurring_gifts').update({
        last_received_date: refund.recurring_gift_prior_last_received,
        next_expected_date: refund.recurring_gift_prior_next_expected,
      }).eq('id', refund.recurring_gift_id)
      setRecurringGifts(prev => prev.map(g => g.id === refund.recurring_gift_id ? { ...g, last_received_date: refund.recurring_gift_prior_last_received, next_expected_date: refund.recurring_gift_prior_next_expected } : g))
      setRecurringGivenTotals(prev => {
        const cur = prev[refund.recurring_gift_id]
        if (!cur) return prev
        return { ...prev, [refund.recurring_gift_id]: { total: cur.total + Number(refund.original_amount), count: cur.count + 1 } }
      })
    }

    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'refund_deleted',
      donation_id: refund.donation_id,
      details: { refund_amount: refund.refund_amount, reason: refund.reason },
    })
    showToast('Refund deleted ✓ — donation restored to confirmed')
  }

  async function loadRecurringExpenses() {
    const uen = session?.user?.app_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase.from('recurring_expenses').select('*').eq('charity_uen', uen).order('amount', { ascending: false })
    if (error) { console.error('Could not load recurring expenses:', error); return }
    setRecurringExpenses(data || [])
  }

  async function saveRecurringExpense() {
    if (!newExpenseForm.name.trim() || !newExpenseForm.amount) { showToast('Name and amount are required', 'error'); return }
    const { data, error } = await supabase.from('recurring_expenses').insert({
      charity_uen: charityUen,
      name: newExpenseForm.name.trim(),
      amount: parseFloat(newExpenseForm.amount),
      created_by: session.user.email,
    }).select().single()
    if (error) { showToast('Error saving expense', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'monthly_expense_added',
      details: { name: newExpenseForm.name.trim(), amount: parseFloat(newExpenseForm.amount), charity_uen: charityUen },
    })
    setRecurringExpenses(prev => [...prev, data].sort((a, b) => b.amount - a.amount))
    setNewExpenseForm({ name: '', amount: '' })
    showToast('Expense added ✓')
  }

  async function deleteRecurringExpense(id: any) {
    const expense = recurringExpenses.find(e => e.id === id)
    await supabase.from('recurring_expenses').delete().eq('id', id)
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'monthly_expense_deleted',
      details: { name: expense?.name, amount: expense?.amount, charity_uen: charityUen },
    })
    setRecurringExpenses(prev => prev.filter(e => e.id !== id))
    showToast('Removed')
  }

  async function loadGrants() {
    const uen = session?.user?.app_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase.from('grants').select('*').eq('charity_uen', uen).order('created_at', { ascending: false })
    if (error) { console.error('Could not load grants:', error); return }
    setGrants(data || [])
  }

  async function saveGrant(grantForm: any) {
    const unrestricted = parseFloat(grantForm.unrestricted_amount) || 0
    const restricted = parseFloat(grantForm.restricted_amount) || 0
    const matchCap = parseFloat(grantForm.match_cap) || 0
    if (!grantForm.funder_name.trim()) { showToast('Funder name is required', 'error'); return }
    if (!grantForm.funder_type) { showToast('Funder type is required', 'error'); return }
    if (!grantForm.start_date) { showToast('Start date is required', 'error'); return }
    if (unrestricted < 0 || restricted < 0 || matchCap < 0) { showToast('Amounts cannot be negative', 'error'); return }
    if (grantForm.end_date && grantForm.end_date < grantForm.start_date) { showToast('End date cannot be before start date', 'error'); return }
    if (grantForm.is_matching && matchCap <= 0) { showToast('Match cap is required for a matching grant', 'error'); return }
    if (!grantForm.is_matching && (unrestricted + restricted) <= 0) { showToast('At least one amount is required', 'error'); return }
    if (restricted > 0 && !grantForm.purpose_restriction?.trim()) { showToast('Purpose restriction is required when there is a restricted amount', 'error'); return }
    const amount = (unrestricted + restricted) > 0 ? unrestricted + restricted : matchCap
    const { data, error } = await supabase.from('grants').insert({
      charity_uen: charityUen,
      funder_name: grantForm.funder_name.trim(),
      funder_type: grantForm.funder_type || null,
      agreement_reference: grantForm.agreement_reference?.trim() || null,
      cause_id: grantForm.cause_id || null,
      amount,
      unrestricted_amount: unrestricted,
      restricted_amount: restricted,
      purpose_restriction: restricted > 0 ? grantForm.purpose_restriction?.trim() : null,
      disbursement_schedule: grantForm.disbursement_schedule?.trim() || null,
      start_date: grantForm.start_date || null,
      end_date: grantForm.end_date || null,
      is_renewable: grantForm.is_renewable || false,
      contact_name: grantForm.contact_name?.trim() || null,
      contact_email: grantForm.contact_email?.trim() || null,
      contact_phone: grantForm.contact_phone?.trim() || null,
      is_matching: grantForm.is_matching || false,
      match_ratio: grantForm.is_matching ? grantForm.match_ratio?.trim() || null : null,
      match_cap: grantForm.is_matching ? matchCap : null,
      status: 'active',
      created_by: session.user.email,
    }).select().single()
    if (error) { showToast('Error saving grant', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'grant_created',
      details: { funder_name: data.funder_name, amount, unrestricted_amount: unrestricted, restricted_amount: restricted, is_matching: data.is_matching, charity_uen: charityUen },
    })
    setGrants(prev => [...prev, data].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
    setShowGrantForm(false)
    showToast('Grant recorded ✓')
  }

  async function updateGrant(grantId: any, grantForm: any) {
    const unrestricted = parseFloat(grantForm.unrestricted_amount) || 0
    const restricted = parseFloat(grantForm.restricted_amount) || 0
    const matchCap = parseFloat(grantForm.match_cap) || 0
    if (!grantForm.funder_name.trim()) { showToast('Funder name is required', 'error'); return }
    if (!grantForm.funder_type) { showToast('Funder type is required', 'error'); return }
    if (!grantForm.start_date) { showToast('Start date is required', 'error'); return }
    if (unrestricted < 0 || restricted < 0 || matchCap < 0) { showToast('Amounts cannot be negative', 'error'); return }
    if (grantForm.end_date && grantForm.end_date < grantForm.start_date) { showToast('End date cannot be before start date', 'error'); return }
    if (grantForm.is_matching && matchCap <= 0) { showToast('Match cap is required for a matching grant', 'error'); return }
    if (!grantForm.is_matching && (unrestricted + restricted) <= 0) { showToast('At least one amount is required', 'error'); return }
    if (restricted > 0 && !grantForm.purpose_restriction?.trim()) { showToast('Purpose restriction is required when there is a restricted amount', 'error'); return }
    const amount = (unrestricted + restricted) > 0 ? unrestricted + restricted : matchCap
    const { data, error } = await supabase.from('grants').update({
      funder_name: grantForm.funder_name.trim(),
      funder_type: grantForm.funder_type || null,
      agreement_reference: grantForm.agreement_reference?.trim() || null,
      cause_id: grantForm.cause_id || null,
      amount,
      unrestricted_amount: unrestricted,
      restricted_amount: restricted,
      purpose_restriction: restricted > 0 ? grantForm.purpose_restriction?.trim() : null,
      disbursement_schedule: grantForm.disbursement_schedule?.trim() || null,
      start_date: grantForm.start_date || null,
      end_date: grantForm.end_date || null,
      is_renewable: grantForm.is_renewable || false,
      contact_name: grantForm.contact_name?.trim() || null,
      contact_email: grantForm.contact_email?.trim() || null,
      contact_phone: grantForm.contact_phone?.trim() || null,
      is_matching: grantForm.is_matching || false,
      match_ratio: grantForm.is_matching ? grantForm.match_ratio?.trim() || null : null,
      match_cap: grantForm.is_matching ? matchCap : null,
      status: grantForm.status || 'active',
    }).eq('id', grantId).select().single()
    if (error) { showToast('Error updating grant', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'grant_edited',
      details: { funder_name: data.funder_name, amount, unrestricted_amount: unrestricted, restricted_amount: restricted, status: data.status, charity_uen: charityUen },
    })
    setGrants(prev => prev.map(g => g.id === grantId ? data : g).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
    setEditingGrant(null)
    showToast('Grant updated ✓')
  }

  async function setGrantStatus(grant: any, newStatus: any) {
    const { data, error } = await supabase.from('grants').update({ status: newStatus }).eq('id', grant.id).select().single()
    if (error) { showToast('Error updating grant status', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'grant_status_changed',
      details: { funder_name: grant.funder_name, from: grant.status, to: newStatus, charity_uen: charityUen },
    })
    setGrants(prev => prev.map(g => g.id === grant.id ? data : g))
    showToast(newStatus === 'active' ? `"${grant.funder_name}" restored to active ✓` : `Grant marked ${newStatus} ✓`)
  }

  function changeGrantStatus(grant: any, newStatus: any) {
    const copy = ({
      completed: { title: 'End this grant?', description: `"${grant.funder_name}" will move out of your active grants. Its expenses, tranches, reports, and matching claims stay exactly as they are — nothing is closed out automatically. You can restore it to active later if needed.`, confirmLabel: 'End Grant' },
      active: { title: 'Restore this grant to active?', description: `"${grant.funder_name}" will move back into your active grants.`, confirmLabel: 'Restore' },
    } as Record<string, any>)[newStatus]
    setConfirmModal({ ...copy, onConfirm: () => setGrantStatus(grant, newStatus) })
  }

  function deleteGrant(grant: any) {
    setConfirmModal({
      title: 'Delete this grant?',
      description: `"${grant.funder_name}" (${'$' + Number(grant.amount).toLocaleString()}) will be permanently deleted, along with everything logged against it — expenses, disbursement tranches, report deadlines, matching claims, and notes. This cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        const { error } = await supabase.from('grant_expenses').delete().eq('grant_id', grant.id)
        if (error) { showToast('Error deleting grant', 'error'); return }
        const { error: grantError } = await supabase.from('grants').delete().eq('id', grant.id)
        if (grantError) { showToast('Error deleting grant', 'error'); return }
        await supabase.from('audit_log').insert({
          actor_type: 'charity',
          actor_email: session.user.email,
          action: 'grant_deleted',
          details: { funder_name: grant.funder_name, amount: grant.amount, charity_uen: charityUen },
        })
        setGrants(prev => prev.filter(g => g.id !== grant.id))
        setGrantExpenses(prev => prev.filter(e => e.grant_id !== grant.id))
        setGrantNotes(prev => { const next = { ...prev }; delete next[grant.id]; return next })
        setGrantReports(prev => { const next = { ...prev }; delete next[grant.id]; return next })
        setGrantTranches(prev => { const next = { ...prev }; delete next[grant.id]; return next })
        setGrantMatchClaims(prev => { const next = { ...prev }; delete next[grant.id]; return next })
        setEditingGrant(null)
        showToast('Grant deleted')
      },
    })
  }

  async function loadPledgeInstalments() {
    const uen = session?.user?.app_metadata?.charity_uen
    if (!uen) return
    const { data } = await supabase.from('pledge_instalments').select('*, pledges!inner(charity_uen)').eq('pledges.charity_uen', uen)
    setPledgeInstalments(data || [])
  }

  async function confirmReschedule() {
    if (!rescheduleModal || !rescheduleNewDate) return
    if (new Date(rescheduleNewDate) < new Date(new Date().setHours(0,0,0,0))) { showToast('New expected date cannot be in the past', 'error'); return }
    setReschedulingPledge(true)
    const pledge = rescheduleModal
    const oldDate = pledge.expected_date

    const { error: updateError } = await supabase.from('pledges').update({ expected_date: rescheduleNewDate }).eq('id', pledge.id)
    if (updateError) { showToast('Error rescheduling pledge', 'error'); setReschedulingPledge(false); return }

    const { data: inserted } = await supabase.from('pledge_reschedules').insert({
      pledge_id: pledge.id,
      old_expected_date: oldDate,
      new_expected_date: rescheduleNewDate,
      reason: rescheduleReason || null,
      created_by: session.user.email,
    }).select().single()

    setPledges(prev => prev.map(p => p.id === pledge.id ? { ...p, expected_date: rescheduleNewDate } : p))
    if (inserted) {
      setPledgeRescheduleHistory(prev => ({ ...prev, [pledge.id]: [inserted, ...(prev[pledge.id] || [])] }))
    }

    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'pledge_rescheduled',
      details: { donor_name: pledge.donor_name, old_date: oldDate, new_date: rescheduleNewDate, reason: rescheduleReason || null },
    })

    showToast(`Pledge rescheduled to ${new Date(rescheduleNewDate).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}`)
    setReschedulingPledge(false)
    setRescheduleModal(null)
    setRescheduleNewDate('')
    setRescheduleReason('')
  }

  const senderIdentity = { senderDomainStatus, senderDomain, senderEmailLocalPart, replyToEmail: session?.user?.email, charityName }

  // Resolves the charity's custom banner headline/subtitle for a template (falling back to
  // EMAIL_TEMPLATE_DEFAULTS), filled with the given vars. Shared by every send site so the
  // banner shown in Settings, in previews, and in the actual sent email always stays in sync.
  function emailBannerFor(key: any, vars: any) {
    const saved = emailTemplates[key]
    const def = EMAIL_TEMPLATE_DEFAULTS[key as keyof typeof EMAIL_TEMPLATE_DEFAULTS] as any
    return {
      banner_title: fillTemplate(saved?.banner_title ?? def?.banner_title ?? '', vars),
      banner_subtitle: fillTemplate(saved?.banner_subtitle ?? def?.banner_subtitle ?? '', vars),
    }
  }

  async function saveEmailTemplate(key: any, val: any) {
    const { error, next } = await updateCharityJsonField(charityUen, 'email_templates', (current: any) => {
      const merged = { ...(current || {}) }
      if (val) merged[key] = val
      else delete merged[key]
      return merged
    })
    if (error) { showToast('Could not save this template', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: val ? 'email_template_customized' : 'email_template_reset',
      details: { template_key: key, charity_uen: charityUen },
    })
    setEmailTemplates(next)
  }

  function defaultMassAppealMessage() {
    const saved = emailTemplates.mass_appeal
    return fillTemplate(saved?.body || EMAIL_TEMPLATE_DEFAULTS.mass_appeal.body, { charity_name: charityName })
  }

  function massAppealSubject(causeTitle: any) {
    const saved = emailTemplates.mass_appeal
    return fillTemplate(saved?.subject || EMAIL_TEMPLATE_DEFAULTS.mass_appeal.subject, { charity_name: charityName, cause_title: causeTitle || '' })
  }

  async function sendCharityEmail(body: any) {
    const targetEmail = body.donor_email?.trim()
    if (targetEmail) {
      const donorKey = targetEmail
      const isBlocked = donations.some(d =>
        (d.donor_email?.trim() || d.donor_nric || d.donor_name) === donorKey && d.donor_do_not_contact
      )
      if (isBlocked) {
        console.warn(`Email blocked: ${body.donor_name || targetEmail} is marked Do Not Contact`)
        return { data: null as any, error: { message: 'This donor is marked as Do Not Contact — email was not sent.' } }
      }
      const isDeceased = donations.some(d =>
        (d.donor_email?.trim() || d.donor_nric || d.donor_name) === donorKey && d.donor_deceased
      )
      if (isDeceased) {
        console.warn(`Email blocked: ${body.donor_name || targetEmail} is marked deceased`)
        return { data: null, error: { message: 'This donor is marked as deceased — email was not sent.' } }
      }
    }
    return supabase.functions.invoke('send-thank-you', {
      body: {
        ...body,
        sender_domain_status: senderDomainStatus,
        sender_domain: senderDomain,
        sender_email_local_part: senderEmailLocalPart,
        charity_reply_to: session?.user?.email,
      }
    })
  }

  async function registerSenderDomain() {
    if (!senderDomainInput.trim()) return
    setSavingDomain(true)
    const { data, error } = await supabase.functions.invoke('manage-sender-domain', {
      body: { action: 'register', domain: senderDomainInput.trim() }
    })
    if (error || data?.error) {
      showToast(data?.error || 'Failed to register domain', 'error')
      setSavingDomain(false)
      return
    }

    const { error: dbError } = await supabase.from('charity_contacts').update({
      sender_domain: senderDomainInput.trim(),
      sender_domain_status: 'pending',
      resend_domain_id: data.domain_id,
    }).eq('charity_uen', charityUen)

    if (dbError) {
      showToast('Domain registered but failed to save — please try again', 'error')
      setSavingDomain(false)
      return
    }

    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'sender_domain_registered',
      details: { domain: senderDomainInput.trim(), charity_uen: charityUen },
    })

    setSenderDomain(senderDomainInput.trim())
    setSenderDomainStatus('pending')
    setDnsRecords(data.records)
    setSavingDomain(false)
    showToast('Domain registered — now add the DNS records shown below')
  }

  async function checkDomainVerification() {
    setCheckingVerification(true)
    const { data: charityData } = await supabase.from('charity_contacts').select('resend_domain_id').eq('charity_uen', charityUen).single()
    if (!charityData?.resend_domain_id) {
      showToast('No domain registered yet', 'error')
      setCheckingVerification(false)
      return
    }

    const { data, error } = await supabase.functions.invoke('manage-sender-domain', {
      body: { action: 'check', domain_id: charityData.resend_domain_id }
    })
    if (error || data?.error) {
      showToast(data?.error || 'Failed to check status', 'error')
      setCheckingVerification(false)
      return
    }

    if (data.status === 'verified') {
      await supabase.from('charity_contacts').update({ sender_domain_status: 'verified' }).eq('charity_uen', charityUen)
      await supabase.from('audit_log').insert({
        actor_type: 'charity',
        actor_email: session.user.email,
        action: 'sender_domain_verified',
        details: { domain: senderDomain, charity_uen: charityUen },
      })
      setSenderDomainStatus('verified')
      showToast('Domain verified! 🎉 Emails will now send from your own address.')
    } else {
      showToast(`Still pending — status: ${data.status}. DNS changes can take a while to take effect.`)
    }
    setCheckingVerification(false)
  }

  function fulfillPledge(pledge: any) {
    setPledgeResolutionNotes('')
    setFulfillPaymentMethod('Cash')
    const alreadyGiven = pledgeGivenTotals[pledge.id] || 0
    setFulfillAmount(String(Number(pledge.amount) - alreadyGiven))
    setPledgeResolutionModal({ type: 'fulfilled', pledge })
  }

  async function confirmPledgeResolution() {
    if (!pledgeResolutionModal) return
    const { type, pledge } = pledgeResolutionModal

    if (type === 'cancelled') {
      const { error } = await supabase.from('pledges').update({ status: 'cancelled', resolution_notes: pledgeResolutionNotes || null }).eq('id', pledge.id)
      if (error) { showToast('Error updating pledge', 'error'); return }
      await supabase.from('audit_log').insert({
        actor_type: 'charity',
        actor_email: session.user.email,
        action: 'pledge_cancelled',
        details: { donor_name: pledge.donor_name, amount: pledge.amount, notes: pledgeResolutionNotes || null },
      })
      setPledges(prev => prev.map(p => p.id === pledge.id ? { ...p, status: 'cancelled', resolution_notes: pledgeResolutionNotes || null } : p))
      showToast(`Pledge from ${pledge.donor_name} marked as cancelled`)
      setPledgeResolutionModal(null)
      setPledgeResolutionNotes('')
      return
    }

    // type === 'fulfilled': create a real donation record for the amount received
    const amount = parseFloat(fulfillAmount)
    if (!amount || amount <= 0) { showToast('Please enter a valid amount', 'error'); return }
    if (amount > 1000000) { showToast('Amount seems too large — please check it (max $1,000,000)', 'error'); return }

    const { data: receiptNumber, error: seqError } = await supabase.rpc('next_receipt_number', { p_charity_uen: charityUen, p_year: new Date().getFullYear() })
    if (seqError) { console.error('Could not generate receipt number:', seqError); showToast('Error generating receipt number. Please try again.', 'error'); return }

    const { data: donationData, error: donationError } = await supabase.from('donations').insert({
      donor_name: pledge.donor_name,
      donor_email: pledge.donor_email,
      amount: amount,
      payment_status: 'confirmed',
      receipt_issued: true,
      source: 'manual',
      payment_method: fulfillPaymentMethod,
      status: 'confirmed',
      notes: pledgeResolutionNotes || 'Pledge fulfillment',
      charity_uen: charityUen,
      receipt_number: receiptNumber,
      created_by: session.user.email,
    }).select().single()

    if (donationError) { showToast('Error recording donation', 'error'); return }

    const { data: linkData, error: linkError } = await supabase.from('pledge_donations').insert({
      pledge_id: pledge.id,
      donation_id: donationData.id,
      amount_applied: amount,
      created_by: session.user.email,
    }).select().single()
    if (linkError) { showToast('Donation recorded, but error linking to pledge', 'error') }
    else setPledgeDonationLinks(prev => ({ ...prev, [pledge.id]: [...(prev[pledge.id] || []), linkData] }))

    setDonations(prev => [donationData, ...prev])
    setPledgeGivenTotals(prev => ({ ...prev, [pledge.id]: (prev[pledge.id] || 0) + amount }))

    const alreadyGiven = pledgeGivenTotals[pledge.id] || 0
    const wouldReach = alreadyGiven + amount

    setPledgeResolutionModal(null)
    setPledgeResolutionNotes('')

    if (wouldReach >= Number(pledge.amount)) {
      // Fully covers the pledge -- mark it fulfilled now, then offer the thank-you as a separate,
      // skippable step (closing that modal must never leave a fully-paid pledge stuck as pending)
      const autoNote = `Auto-fulfilled by donation of $${amount.toLocaleString()} confirmed on ${new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}`
      const { error: fulfillError } = await supabase.from('pledges').update({ status: 'fulfilled', fulfilled_donation_id: donationData.id, resolution_notes: autoNote }).eq('id', pledge.id)
      if (!fulfillError) setPledges(prev => prev.map(p => p.id === pledge.id ? { ...p, status: 'fulfilled', fulfilled_donation_id: donationData.id, resolution_notes: autoNote } : p))
      setPledgeCompletionCandidate({ pledge, donation: donationData })
      setShowPledgeThankYouModal(true)
    } else {
      showToast(`$${amount.toLocaleString()} recorded toward ${pledge.donor_name}'s pledge — ${(Number(pledge.amount) - wouldReach).toLocaleString()} remaining`)
    }
  }

  async function sendPledgeReminder() {
    if (!pledgeReminderCandidate) return
    if (!pledgeReminderCandidate.donor_email) {
      showToast('This donor has no email on file', 'error')
      return
    }
    setSendingPledgeReminder(true)
    const p = pledgeReminderCandidate
    const daysUntilSend = Math.ceil((new Date(p.expected_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    const reminderKey = daysUntilSend < 0 ? 'pledge_reminder_overdue' : 'pledge_reminder_upcoming'
    const { error } = await sendCharityEmail({
      type: 'pledge_reminder',
      donor_name: p.donor_name,
      donor_email: p.donor_email,
      charity_name: charityName,
      charity_uen: charityUen,
      pledge_amount: Number(p.amount).toLocaleString(),
      subject_override: pledgeReminderSubject,
      custom_message: pledgeReminderBody,
      ...emailBannerFor(reminderKey, { donor_name: p.donor_name, charity_name: charityName }),
    })
    if (error) { showToast('Failed to send reminder', 'error'); setSendingPledgeReminder(false); return }

    const { data: inserted } = await supabase.from('pledge_reminders').insert({
      pledge_id: p.id,
      subject: pledgeReminderSubject,
      message: pledgeReminderBody,
      sent_by: session.user.email,
    }).select().single()

    if (inserted) {
      setPledgeReminderHistory(prev => ({
        ...prev,
        [p.id]: [inserted, ...(prev[p.id] || [])]
      }))
    }

    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'pledge_reminder_sent',
      details: { donor_name: p.donor_name, donor_email: p.donor_email, amount: p.amount, charity_uen: charityUen },
    })

    setSendingPledgeReminder(false)
    showToast(`Reminder sent to ${p.donor_email}`)
    setShowPledgeReminderModal(false)
    setPledgeReminderCandidate(null)
  }

  async function logPledgeContact() {
    if (!logContactModal) return
    setLoggingContact(true)
    const p = logContactModal
    const { data: inserted, error } = await supabase.from('pledge_reminders').insert({
      pledge_id: p.id,
      channel: logContactMethod,
      message: logContactNote?.trim() || null,
      sent_by: session.user.email,
    }).select().single()
    setLoggingContact(false)
    if (error) { showToast('Error logging contact', 'error'); return }

    if (inserted) {
      setPledgeReminderHistory(prev => ({
        ...prev,
        [p.id]: [inserted, ...(prev[p.id] || [])]
      }))
    }

    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'pledge_contact_logged',
      details: { donor_name: p.donor_name, channel: logContactMethod, charity_uen: charityUen },
    })

    // Also lands in the donor's own Communication Log — this used to only exist on the pledge
    // reminder history, invisible from the donor's profile.
    const pledgeContactDonorKey = p.donor_email?.trim() || p.donor_name
    const channelLabel = ({ phone: 'Called', email: 'Emailed', in_person: 'Met in person', whatsapp: 'WhatsApped', other: 'Followed up' } as Record<string, string>)[logContactMethod] || 'Contacted'
    const noteType = ({ phone: 'call', email: 'email', in_person: 'meeting', whatsapp: 'whatsapp', other: 'note' } as Record<string, string>)[logContactMethod] || 'note'
    await logDonorContact(pledgeContactDonorKey, `${channelLabel} about pledge ($${Number(p.amount).toLocaleString()})${logContactNote?.trim() ? ` — ${logContactNote.trim()}` : ''}`, noteType)

    showToast(`Contact logged — won't be flagged again for 7 days`)
    setLogContactModal(null)
    setLogContactNote('')
  }

  async function revertPledgeToPending(pledge: any) {
    setConfirmModal({
      title: 'Revert this pledge to pending?',
      description: `The pledge of $${Number(pledge.amount).toLocaleString()} from ${pledge.donor_name} will be moved back to Outstanding Pledges.`,
      confirmLabel: 'Revert to Pending',
      onConfirm: async () => {
        const { error } = await supabase.from('pledges').update({ status: 'pending', resolution_notes: null, fulfilled_donation_id: null }).eq('id', pledge.id)
        if (error) { showToast('Error reverting pledge', 'error'); return }
        await supabase.from('audit_log').insert({
          actor_type: 'charity',
          actor_email: session.user.email,
          action: 'pledge_reverted_to_pending',
          details: { donor_name: pledge.donor_name, amount: pledge.amount },
        })
        setPledges(prev => prev.map(p => p.id === pledge.id ? { ...p, status: 'pending', resolution_notes: null, fulfilled_donation_id: null } : p))
        showToast(`Pledge from ${pledge.donor_name} reverted to pending`)
      },
    })
  }

  function openThankYouForFulfilledPledge(pledge: any) {
    // Lets staff trigger the completion thank-you at any time after the fact, not just in the
    // one-shot popup shown the moment a pledge is fulfilled -- closing/skipping that popup
    // previously meant there was no way to ever send it later.
    let donation = pledge.fulfilled_donation_id ? donations.find(d => d.id === pledge.fulfilled_donation_id) : null
    if (!donation) {
      const links = pledgeDonationLinks[pledge.id] || []
      const linkedDonations = links.map((l: any) => donations.find(d => d.id === l.donation_id)).filter(Boolean)
      donation = linkedDonations.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    }
    if (!donation) { showToast('No linked payment found for this pledge to thank the donor for', 'error'); return }
    setPledgeCompletionCandidate({ pledge, donation })
    setShowPledgeThankYouModal(true)
  }

  function cancelPledge(pledge: any) {
    setPledgeResolutionNotes('')
    setPledgeResolutionModal({ type: 'cancelled', pledge })
  }

  async function loadRecurringGifts(activeSession = session) {
    const uen = activeSession?.user?.app_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase
      .from('recurring_gifts')
      .select('*')
      .eq('charity_uen', uen)
      .order('next_expected_date', { ascending: true })
    if (error) { console.error('Could not load recurring gifts:', error); return }
    setRecurringGifts(data || [])

    if (data && data.length > 0) {
      const { data: linkedDonations } = await supabase
        .from('donations')
        .select('recurring_gift_id, amount')
        .in('recurring_gift_id', data.map(g => g.id))
        .eq('payment_status', 'confirmed')
      const totals: Record<string, any> = {}
      ;(linkedDonations || []).forEach(d => {
        if (!totals[d.recurring_gift_id]) totals[d.recurring_gift_id] = { total: 0, count: 0 }
        totals[d.recurring_gift_id].total += Number(d.amount)
        totals[d.recurring_gift_id].count += 1
      })
      setRecurringGivenTotals(totals)

      const { data: skipData } = await supabase
        .from('recurring_gift_events')
        .select('id, recurring_gift_id, skipped_cycle_date, reason, created_at')
        .eq('event_type', 'skip')
        .in('recurring_gift_id', data.map(g => g.id))
        .order('created_at', { ascending: false })
      const skips: Record<string, any> = {}
      ;(skipData || []).forEach(s => {
        if (!skips[s.recurring_gift_id]) skips[s.recurring_gift_id] = []
        skips[s.recurring_gift_id].push(s)
      })
      setRecurringSkipHistory(skips)

      const { data: failedData } = await supabase
        .from('recurring_gift_events')
        .select('id, recurring_gift_id, skipped_cycle_date, reason, created_at')
        .eq('event_type', 'failed_deduction')
        .in('recurring_gift_id', data.map(g => g.id))
        .order('created_at', { ascending: false })
      const failed: Record<string, any> = {}
      ;(failedData || []).forEach(f => {
        if (!failed[f.recurring_gift_id]) failed[f.recurring_gift_id] = []
        failed[f.recurring_gift_id].push(f)
      })
      setRecurringFailedDeductionHistory(failed)

      const { data: reminderData } = await supabase
        .from('recurring_gift_events')
        .select('recurring_gift_id, sent_at, sent_by')
        .eq('event_type', 'reminder')
        .in('recurring_gift_id', data.map(g => g.id))
        .order('sent_at', { ascending: false })
      const reminders: Record<string, any> = {}
      ;(reminderData || []).forEach(r => {
        if (!reminders[r.recurring_gift_id]) reminders[r.recurring_gift_id] = []
        reminders[r.recurring_gift_id].push(r)
      })
      setRecurringReminderHistory(reminders)
    }
  }

  function addMonthsClamped(date: any, monthsToAdd: any) {
    // Plain Date.setMonth overflows for day-of-month values the target month doesn't have
    // (e.g. Jan 31 + 1 month naively becomes Mar 3, not Feb 28) -- clamp to the target month's
    // actual last day instead, so month-end and leap-day donors don't silently drift late.
    const day = date.getDate()
    const next = new Date(date.getFullYear(), date.getMonth() + monthsToAdd, 1)
    const lastDayOfTargetMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
    next.setDate(Math.min(day, lastDayOfTargetMonth))
    return next
  }

  function monthlyEquivalentAmount(g: any) {
    // Normalizes any recurring gift's cadence to a monthly-equivalent amount, so MRR-style
    // totals are comparable across weekly/monthly/quarterly/annual gifts of any type instead
    // of just summing raw per-cycle amounts (which understates weekly gifts ~13x and
    // overstates annual gifts ~12x when treated as if they recur monthly).
    const amt = Number(g.amount) || 0
    if (g.frequency === 'weekly') return amt * 4.33
    if (g.frequency === 'quarterly') return amt / 3
    if (g.frequency === 'annually') return amt / 12
    return amt
  }

  function computeNextExpectedDate(startDate: any, frequency: any, lastReceivedDate: any) {
    const base = lastReceivedDate ? new Date(lastReceivedDate) : new Date(startDate)
    let next
    if (frequency === 'weekly') { next = new Date(base); next.setDate(next.getDate() + 7) }
    else if (frequency === 'monthly') next = addMonthsClamped(base, 1)
    else if (frequency === 'quarterly') next = addMonthsClamped(base, 3)
    else if (frequency === 'annually') next = addMonthsClamped(base, 12)
    else next = new Date(base)
    return next.toISOString().split('T')[0]
  }

  async function saveRecurringGift(form: any) {
    if (!form.donor_name.trim()) { showToast('Donor name is required', 'error'); return }
    if (!form.amount || parseFloat(form.amount) <= 0) { showToast('Please enter a valid amount', 'error'); return }
    if (parseFloat(form.amount) > 1000000) { showToast('Amount seems too large — please check it (max $1,000,000)', 'error'); return }
    if (!form.start_date) { showToast('Start date is required', 'error'); return }
    if (form.type === 'giro' && !form.giro_reference?.trim()) { showToast('GIRO reference / account is required for GIRO gifts', 'error'); return }
    if (form.type === 'other' && !form.type_detail?.trim()) { showToast('Please describe what "Other" means for this gift', 'error'); return }
    setSavingRecurring(true)
    const donorKey = form.donor_email?.trim() || form.donor_name.trim()
    const nextExpected = computeNextExpectedDate(form.start_date, form.frequency, null)
    const { data, error } = await supabase.from('recurring_gifts').insert([{
      charity_uen: charityUen,
      donor_name: form.donor_name.trim(),
      donor_email: form.donor_email?.trim() || null,
      donor_phone: form.donor_phone?.trim() || null,
      donor_key: donorKey,
      amount: parseFloat(form.amount),
      frequency: form.frequency,
      start_date: form.start_date,
      end_date: form.end_date || null,
      next_expected_date: nextExpected,
      giro_reference: form.giro_reference?.trim() || null,
      type: form.type,
      type_detail: form.type === 'other' ? form.type_detail?.trim() || null : null,
      cause_id: form.cause_id || null,
      bank_name: form.bank_name?.trim() || null,
      authorization_status: form.authorization_status,
      notes: form.notes?.trim() || null,
      status: 'active',
      created_by: session.user.email,
      reference: 'RG-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
    }]).select()
    setSavingRecurring(false)
    if (error) { showToast(`Error: ${error.message}`, 'error'); return }
    setRecurringGifts(prev => [...prev, data[0]].sort((a, b) => new Date(a.next_expected_date).getTime() - new Date(b.next_expected_date).getTime()))
    setShowRecurringForm(false)
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'recurring_gift_added',
      details: { donor_name: form.donor_name, amount: parseFloat(form.amount), frequency: form.frequency, type: form.type },
    })
    showToast('Recurring gift recorded ✓')
  }

  async function updateRecurringGift(giftId: any, form: any) {
    if (!form.donor_name.trim()) { showToast('Donor name is required', 'error'); return }
    if (!form.amount || parseFloat(form.amount) <= 0) { showToast('Please enter a valid amount', 'error'); return }
    if (parseFloat(form.amount) > 1000000) { showToast('Amount seems too large — please check it (max $1,000,000)', 'error'); return }
    if (!form.start_date) { showToast('Start date is required', 'error'); return }
    if (form.type === 'giro' && !form.giro_reference?.trim()) { showToast('GIRO reference / account is required for GIRO gifts', 'error'); return }
    if (form.type === 'other' && !form.type_detail?.trim()) { showToast('Please describe what "Other" means for this gift', 'error'); return }
    setSavingRecurring(true)
    const originalGift = recurringGifts.find(g => g.id === giftId)
    const cadenceChanged = originalGift && (originalGift.frequency !== form.frequency || originalGift.start_date !== form.start_date)
    const updatePayload: Record<string, any> = {
      donor_name: form.donor_name.trim(),
      donor_email: form.donor_email?.trim() || null,
      donor_phone: form.donor_phone?.trim() || null,
      donor_key: form.donor_email?.trim() || form.donor_name.trim(),
      amount: parseFloat(form.amount),
      frequency: form.frequency,
      start_date: form.start_date,
      end_date: form.end_date || null,
      giro_reference: form.giro_reference?.trim() || null,
      type: form.type,
      type_detail: form.type === 'other' ? form.type_detail?.trim() || null : null,
      cause_id: form.cause_id || null,
      bank_name: form.bank_name?.trim() || null,
      authorization_status: form.authorization_status,
      notes: form.notes?.trim() || null,
    }
    // A changed frequency or start date makes the previously stored next_expected_date stale --
    // recompute it so the card doesn't keep nagging "overdue" using the old cadence.
    if (cadenceChanged) updatePayload.next_expected_date = nextExpectedFromToday(form.start_date, form.frequency, originalGift.last_received_date)
    const { data, error } = await supabase.from('recurring_gifts').update(updatePayload).eq('id', giftId).select().single()
    setSavingRecurring(false)
    if (error) { showToast(`Error: ${error.message}`, 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'recurring_gift_edited',
      details: { donor_name: form.donor_name.trim(), amount: parseFloat(form.amount), frequency: form.frequency, charity_uen: charityUen },
    })
    setRecurringGifts(prev => prev.map(g => g.id === giftId ? data : g))
    setEditingRecurringGift(null)
    showToast('Recurring gift updated ✓')
  }

  function markRecurringReceived(gift: any) {
    setMarkReceivedAmount(String(gift.amount))
    setMarkReceivedNote('')
    setMarkReceivedModal(gift)
  }

  function startEditingRecurringAmount(donation: any) {
    setEditingRecurringDonationId(donation.id)
    setEditingRecurringAmount(String(donation.amount))
    setEditingRecurringNote(donation.notes || '')
  }

  async function saveRecurringDonationAmount(donation: any) {
    if (savingRecurringAmount) return
    const newAmount = parseFloat(editingRecurringAmount)
    if (!newAmount || newAmount <= 0) { showToast('Please enter a valid amount', 'error'); return }
    if (newAmount > 1000000) { showToast('Amount seems too large — please check it (max $1,000,000)', 'error'); return }
    const newNotes = editingRecurringNote.trim() || null
    if (newAmount === Number(donation.amount) && newNotes === (donation.notes || null)) { setEditingRecurringDonationId(null); return }
    setSavingRecurringAmount(true)
    const { error } = await supabase.from('donations').update({ amount: newAmount, notes: newNotes }).eq('id', donation.id)
    if (error) { console.error('Error updating recurring payment amount:', error); showToast(`Error saving amount: ${error.message}${error.code ? ` (${error.code})` : ''}`, 'error'); setSavingRecurringAmount(false); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'donation_edited',
      donation_id: donation.id,
      details: { before: { amount: donation.amount, notes: donation.notes || null }, after: { amount: newAmount, notes: newNotes } },
    })
    setDonations(prev => prev.map(d => d.id === donation.id ? { ...d, amount: newAmount, notes: newNotes } : d))
    if (donation.recurring_gift_id) {
      const delta = newAmount - Number(donation.amount)
      setRecurringGivenTotals(prev => {
        const cur = prev[donation.recurring_gift_id]
        if (!cur) return prev
        return { ...prev, [donation.recurring_gift_id]: { ...cur, total: cur.total + delta } }
      })
    }
    setEditingRecurringDonationId(null)
    setSavingRecurringAmount(false)
    showToast('Amount updated ✓')
  }

  function startEditingPledgeAmount(link: any) {
    setEditingPledgeDonationId(link.donation_id)
    setEditingPledgeAmount(String(link.amount_applied))
    setEditingPledgeNotes(link.notes || '')
  }

  async function savePledgeDonationAmount(link: any) {
    if (savingPledgeAmount) return
    const newAmount = parseFloat(editingPledgeAmount)
    if (!newAmount || newAmount <= 0) { showToast('Please enter a valid amount', 'error'); return }
    if (newAmount > 1000000) { showToast('Amount seems too large — please check it (max $1,000,000)', 'error'); return }
    const oldAmount = Number(link.amount_applied)
    const newNotes = editingPledgeNotes.trim() || null
    if (newAmount === oldAmount && newNotes === (link.notes || null)) { setEditingPledgeDonationId(null); return }
    setSavingPledgeAmount(true)
    // Keep the underlying donation and the pledge's applied amount in sync — a pledge fulfillment
    // is a real donation row plus a pledge_donations link, and both need to agree on the amount or
    // the pledge's progress bar drifts from what was actually recorded.
    const { error: donationError } = await supabase.from('donations').update({ amount: newAmount, notes: newNotes }).eq('id', link.donation_id)
    if (donationError) { console.error('Error updating pledge payment amount:', donationError); showToast(`Error saving amount: ${donationError.message}`, 'error'); setSavingPledgeAmount(false); return }
    const { error: linkError } = await supabase.from('pledge_donations').update({ amount_applied: newAmount }).eq('pledge_id', link.pledge_id).eq('donation_id', link.donation_id)
    if (linkError) { console.error('Error updating pledge link amount:', linkError); showToast(`Error saving pledge total: ${linkError.message}`, 'error'); setSavingPledgeAmount(false); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'donation_edited',
      donation_id: link.donation_id,
      details: { before: { amount: oldAmount, notes: link.notes || null }, after: { amount: newAmount, notes: newNotes } },
    })
    setDonations(prev => prev.map(d => d.id === link.donation_id ? { ...d, amount: newAmount, notes: newNotes } : d))
    setPledgeDonationLinks(prev => ({
      ...prev,
      [link.pledge_id]: (prev[link.pledge_id] || []).map((l: any) => l.donation_id === link.donation_id ? { ...l, amount_applied: newAmount } : l),
    }))
    const newTotal = (pledgeGivenTotals[link.pledge_id] || 0) + (newAmount - oldAmount)
    setPledgeGivenTotals(prev => ({ ...prev, [link.pledge_id]: newTotal }))
    // If editing this payment down pulls a "fulfilled" pledge back under its target amount, revert
    // it to pending and clear the auto-fulfilled note — otherwise the card would keep claiming it
    // was fulfilled by an amount that no longer matches what's actually recorded. Symmetrically, if
    // editing it UP now covers a still-"pending" pledge, mark it fulfilled -- otherwise a pledge that's
    // fully paid via an amount correction stays stuck showing "pending" with no way to fix it in the UI.
    const relatedPledge = pledges.find(p => p.id === link.pledge_id)
    if (relatedPledge?.status === 'fulfilled' && newTotal < Number(relatedPledge.amount)) {
      await supabase.from('pledges').update({ status: 'pending', resolution_notes: null, fulfilled_donation_id: null }).eq('id', link.pledge_id)
      setPledges(prev => prev.map(p => p.id === link.pledge_id ? { ...p, status: 'pending', resolution_notes: null, fulfilled_donation_id: null } : p))
      showToast('Payment updated — pledge reverted to pending (no longer fully covered)')
    } else if (relatedPledge?.status === 'pending' && newTotal >= Number(relatedPledge.amount)) {
      const autoNote = `Auto-fulfilled by an amount correction to $${newAmount.toLocaleString()} on ${new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}`
      await supabase.from('pledges').update({ status: 'fulfilled', fulfilled_donation_id: link.donation_id, resolution_notes: autoNote }).eq('id', link.pledge_id)
      setPledges(prev => prev.map(p => p.id === link.pledge_id ? { ...p, status: 'fulfilled', fulfilled_donation_id: link.donation_id, resolution_notes: autoNote } : p))
      showToast('Payment updated — this now fully covers the pledge, marked fulfilled ✓')
    } else {
      showToast('Payment updated ✓')
    }
    setEditingPledgeDonationId(null)
    setSavingPledgeAmount(false)
  }

  async function confirmMarkReceived() {
    if (!markReceivedModal) return
    const amount = parseFloat(markReceivedAmount)
    if (!amount || amount <= 0) { showToast('Please enter a valid amount', 'error'); return }
    if (amount > 1000000) { showToast('Amount seems too large — please check it (max $1,000,000)', 'error'); return }

    setMarkingReceived(true)
    const gift = markReceivedModal
    const today = new Date().toISOString().split('T')[0]
    const nextExpected = computeNextExpectedDate(gift.start_date, gift.frequency, today)

    const { data: receiptNumber, error: seqError } = await supabase.rpc('next_receipt_number', { p_charity_uen: charityUen, p_year: new Date(today).getFullYear() })
    if (seqError) { console.error('Could not generate receipt number:', seqError); showToast('Error generating receipt number. Please try again.', 'error'); setMarkingReceived(false); return }

    const { data: donationData, error: donationError } = await supabase.from('donations').insert({
      donor_name: gift.donor_name,
      donor_email: gift.donor_email,
      amount: amount,
      payment_status: 'confirmed',
      receipt_issued: true,
      source: 'manual',
      payment_method: gift.type === 'giro' ? 'GIRO' : gift.type === 'habitual_paynow' ? 'PayNow' : 'Bank Transfer',
      status: 'confirmed',
      recurring_gift_id: gift.id,
      notes: markReceivedNote.trim() || `Recurring ${gift.frequency} gift`,
      charity_uen: charityUen,
      receipt_number: receiptNumber,
      created_by: session.user.email,
    }).select().single()

    if (donationError) { showToast('Error recording donation', 'error'); setMarkingReceived(false); return }

    const { error: giftError } = await supabase.from('recurring_gifts').update({
      last_received_date: today,
      next_expected_date: nextExpected,
    }).eq('id', gift.id)
    if (giftError) { showToast('Donation recorded, but error updating recurring gift dates', 'error'); setMarkingReceived(false); return }

    setRecurringGifts(prev => prev.map(g => g.id === gift.id ? { ...g, last_received_date: today, next_expected_date: nextExpected } : g))
    setDonations(prev => [donationData, ...prev])
    setRecurringGivenTotals(prev => ({
      ...prev,
      [gift.id]: {
        total: (prev[gift.id]?.total || 0) + amount,
        count: (prev[gift.id]?.count || 0) + 1
      }
    }))

    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'recurring_gift_received',
      donation_id: donationData.id,
      details: { donor_name: gift.donor_name, amount: amount, frequency: gift.frequency },
    })

    if (gift.donor_email) {
      await sendCharityEmail({
        donor_name: gift.donor_name,
        donor_email: gift.donor_email,
        charity_name: charityName,
        charity_uen: charityUen,
        amount: amount,
        date: new Date(today).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' }),
        notes: markReceivedNote.trim() || `Recurring ${gift.frequency} gift`,
      })
    }

    showToast(`$${amount.toLocaleString()} recorded ✓ · Next expected ${new Date(nextExpected).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}`)
    setMarkingReceived(false)
    setMarkReceivedModal(null)
    setMarkReceivedAmount('')
    setMarkReceivedNote('')
  }

  function skipRecurringCycle(gift: any) {
    setSkipCycleReason('')
    setSkipCycleModal(gift)
  }

  async function confirmSkipCycle() {
    if (!skipCycleModal) return
    setSkippingCycle(true)
    const gift = skipCycleModal
    const skippedDate = gift.next_expected_date
    const nextExpected = computeNextExpectedDate(gift.start_date, gift.frequency, skippedDate)

    const { data: inserted, error: skipError } = await supabase.from('recurring_gift_events').insert({
      recurring_gift_id: gift.id,
      event_type: 'skip',
      skipped_cycle_date: skippedDate,
      reason: skipCycleReason || null,
      created_by: session.user.email,
    }).select().single()
    if (skipError) { showToast('Error recording skip', 'error'); setSkippingCycle(false); return }

    const { error: giftError } = await supabase.from('recurring_gifts').update({
      next_expected_date: nextExpected,
    }).eq('id', gift.id)
    if (giftError) { showToast('Skip recorded, but error updating next expected date', 'error'); setSkippingCycle(false); return }

    setRecurringGifts(prev => prev.map(g => g.id === gift.id ? { ...g, next_expected_date: nextExpected } : g))
    setRecurringSkipHistory(prev => ({
      ...prev,
      [gift.id]: [inserted, ...(prev[gift.id] || [])]
    }))

    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'recurring_gift_skipped',
      details: { donor_name: gift.donor_name, skipped_cycle_date: skippedDate, reason: skipCycleReason || null },
    })

    showToast(`Cycle skipped · Next expected ${new Date(nextExpected).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}`)
    setSkippingCycle(false)
    setSkipCycleModal(null)
    setSkipCycleReason('')
  }

  async function undoSkipCycle(gift: any) {
    const history = recurringSkipHistory[gift.id] || []
    const lastSkip = history[0]
    if (!lastSkip) return
    // If a real payment was recorded after this skip (donor paid anyway, or a later cycle came
    // in), next_expected_date has already moved forward for a legitimate reason. Blindly
    // restoring it to the pre-skip date would walk it backwards past the last actual payment,
    // showing a "next expected" date that's already in the past relative to money that's in.
    if (gift.last_received_date && new Date(lastSkip.skipped_cycle_date) <= new Date(gift.last_received_date)) {
      showToast('Can\'t undo this skip — a payment was recorded since then, so the expected date has already moved forward for a real reason.', 'error')
      return
    }
    const { error: deleteError } = await supabase.from('recurring_gift_events').delete().eq('id', lastSkip.id)
    if (deleteError) { showToast('Error undoing skip', 'error'); return }
    const { error: giftError } = await supabase.from('recurring_gifts').update({
      next_expected_date: lastSkip.skipped_cycle_date,
    }).eq('id', gift.id)
    if (giftError) { showToast('Skip event removed, but error reverting next expected date', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'recurring_gift_skip_undone',
      details: { donor_name: gift.donor_name, restored_next_expected_date: lastSkip.skipped_cycle_date, charity_uen: charityUen },
    })
    setRecurringGifts(prev => prev.map(g => g.id === gift.id ? { ...g, next_expected_date: lastSkip.skipped_cycle_date } : g))
    setRecurringSkipHistory(prev => ({ ...prev, [gift.id]: history.slice(1) }))
    showToast('Skip undone ✓')
  }

  async function undoFailedDeduction(gift: any, event: any) {
    const { error } = await supabase.from('recurring_gift_events').delete().eq('id', event.id)
    if (error) { showToast('Error undoing failed deduction', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'recurring_gift_failed_deduction_undone',
      details: { donor_name: gift.donor_name, reason: event.reason, charity_uen: charityUen },
    })
    setRecurringFailedDeductionHistory(prev => ({
      ...prev,
      [gift.id]: (prev[gift.id] || []).filter((e: any) => e.id !== event.id),
    }))
    showToast('Failed deduction entry removed ✓')
  }

  async function sendRecurringReminder() {
    if (!recurringReminderCandidate) return
    if (!recurringReminderCandidate.donor_email) {
      showToast('This donor has no email on file', 'error')
      return
    }
    setSendingRecurringReminder(true)
    const g = recurringReminderCandidate
    const { error } = await sendCharityEmail({
      type: 'recurring_gift_reminder',
      donor_name: g.donor_name,
      donor_email: g.donor_email,
      charity_name: charityName,
      charity_uen: charityUen,
      recurring_amount: Number(g.amount).toLocaleString(),
      subject_override: recurringReminderSubject,
      custom_message: recurringReminderBody,
      ...emailBannerFor('recurring_gift_reminder', { donor_name: g.donor_name, charity_name: charityName }),
    })
    if (error) { showToast('Failed to send reminder', 'error'); setSendingRecurringReminder(false); return }

    const { data: inserted } = await supabase.from('recurring_gift_events').insert({
      recurring_gift_id: g.id,
      event_type: 'reminder',
      subject: recurringReminderSubject,
      message: recurringReminderBody,
      sent_at: new Date().toISOString(),
      sent_by: session.user.email,
    }).select().single()

    if (inserted) {
      setRecurringReminderHistory(prev => ({
        ...prev,
        [g.id]: [inserted, ...(prev[g.id] || [])]
      }))
    }

    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'recurring_gift_reminder_sent',
      details: { donor_name: g.donor_name, donor_email: g.donor_email, charity_uen: charityUen },
    })

    setSendingRecurringReminder(false)
    showToast(`Reminder sent to ${g.donor_email}`)
    setShowRecurringReminderModal(false)
    setRecurringReminderCandidate(null)
  }

  async function confirmDismissLapsedDonor() {
    if (!showLapsedDismissModal) return
    setDismissingLapsed(true)
    const d = showLapsedDismissModal
    const donorKey = d.email?.trim() || d.name

    const { data: inserted, error } = await supabase.from('lapsed_donor_events').upsert({
      charity_uen: charityUen,
      donor_key: donorKey,
      event_type: 'dismissal',
      reason: lapsedDismissReason || null,
      reason_category: lapsedDismissCategory,
      dismissed_by: session.user.email,
      dismissed_at: new Date().toISOString(),
    }, { onConflict: 'charity_uen,donor_key', ignoreDuplicates: false }).select().single()

    if (error) { showToast('Error dismissing donor', 'error'); setDismissingLapsed(false); return }

    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'lapsed_donor_dismissed',
      details: { donor_name: d.name, reason_category: lapsedDismissCategory, reason: lapsedDismissReason || null, charity_uen: charityUen },
    })

    setLapsedDismissals(prev => ({ ...prev, [donorKey]: inserted }))
    showToast(`${d.name} marked as not interested`)
    setDismissingLapsed(false)
    setShowLapsedDismissModal(null)
    setLapsedDismissReason('')
  }

  async function undismissLapsedDonor(donorKey: any) {
    const { error } = await supabase.from('lapsed_donor_events').delete().eq('charity_uen', charityUen).eq('donor_key', donorKey).eq('event_type', 'dismissal')
    if (error) { showToast('Error undoing dismissal', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'lapsed_donor_dismissal_undone',
      details: { donor_key: donorKey, charity_uen: charityUen },
    })
    setLapsedDismissals(prev => {
      const next = { ...prev }
      delete next[donorKey]
      return next
    })
    showToast('Donor restored to lapsed list')
  }

  async function sendLapsedReminder() {
    if (!lapsedReminderCandidate) return
    if (!lapsedReminderCandidate.email) {
      showToast('This donor has no email on file', 'error')
      return
    }
    setSendingLapsedReminder(true)
    const d = lapsedReminderCandidate
    const donorKey = d.email?.trim() || d.name
    const lapsedKey = d.givingChangeMeta ? 'lapsed_reminder_giving_change' : 'lapsed_reminder_lapsed'
    const { error } = await sendCharityEmail({
      type: 'lapsed_donor_reminder',
      donor_name: d.name,
      donor_email: d.email,
      charity_name: charityName,
      charity_uen: charityUen,
      subject_override: lapsedReminderSubject,
      custom_message: lapsedReminderBody,
      ...emailBannerFor(lapsedKey, { donor_name: d.name, charity_name: charityName }),
    })
    if (error) { showToast('Failed to send reminder', 'error'); setSendingLapsedReminder(false); return }

    if (d.givingChangeMeta) {
      const { data: inserted } = await supabase.from('giving_change_acks').insert({
        charity_uen: charityUen,
        donor_key: donorKey,
        direction: 'downgrade',
        change_pct: d.givingChangeMeta.changePct,
        message: lapsedReminderBody,
        sent_by: session.user.email,
      }).select().single()
      if (inserted) {
        setGivingChangeAckHistory(prev => ({ ...prev, [donorKey]: [inserted, ...(prev[donorKey] || [])] }))
      }
      await logDonorContact(donorKey, `Giving decrease check-in — email sent`, 'email', true, { subject: lapsedReminderSubject, body: lapsedReminderBody })
    } else {
      const { data: inserted } = await supabase.from('lapsed_donor_events').insert({
        charity_uen: charityUen,
        donor_key: donorKey,
        event_type: 'reminder',
        subject: lapsedReminderSubject,
        message: lapsedReminderBody,
        sent_at: new Date().toISOString(),
        sent_by: session.user.email,
      }).select().single()
      if (inserted) {
        setLapsedReminderHistory(prev => ({
          ...prev,
          [donorKey]: [inserted, ...(prev[donorKey] || [])]
        }))
      }
      await logDonorContact(donorKey, `Re-engagement email sent`, 'email', true, { subject: lapsedReminderSubject, body: lapsedReminderBody })
    }

    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: d.givingChangeMeta ? 'giving_change_checkin_sent' : 'lapsed_donor_reminder_sent',
      details: { donor_name: d.name, donor_email: d.email, charity_uen: charityUen },
    })

    setSendingLapsedReminder(false)
    showToast(`Reminder sent to ${d.email}`)
    setShowLapsedReminderModal(false)
    setLapsedReminderCandidate(null)
  }

  function pauseRecurringGift(gift: any) {
    setPauseReasonInput('')
    setPauseResumeDateInput('')
    setPauseGiftModal(gift)
  }

  async function confirmPauseRecurringGift() {
    if (!pauseGiftModal) return
    setPausingGift(true)
    const gift = pauseGiftModal
    const { error } = await supabase.from('recurring_gifts').update({
      status: 'paused',
      pause_reason: pauseReasonInput.trim() || null,
      pause_resume_date: pauseResumeDateInput || null,
    }).eq('id', gift.id)
    setPausingGift(false)
    if (error) { showToast('Error pausing', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'recurring_gift_paused',
      details: { donor_name: gift.donor_name, pause_reason: pauseReasonInput.trim() || null, pause_resume_date: pauseResumeDateInput || null, charity_uen: charityUen },
    })
    setRecurringGifts(prev => prev.map(g => g.id === gift.id ? { ...g, status: 'paused', pause_reason: pauseReasonInput.trim() || null, pause_resume_date: pauseResumeDateInput || null } : g))
    showToast(`${gift.donor_name}'s recurring gift paused`)
    setPauseGiftModal(null)
  }

  function nextExpectedFromToday(startDate: any, frequency: any, lastReceivedDate: any) {
    // Reactivating/restoring a gift that's been paused or cancelled for a while shouldn't
    // immediately show it as overdue -- roll the projected date forward past today first.
    let candidate = computeNextExpectedDate(startDate, frequency, lastReceivedDate)
    const today = new Date(new Date().toDateString())
    let guard = 0
    while (new Date(candidate) < today && guard < 500) {
      candidate = computeNextExpectedDate(startDate, frequency, candidate)
      guard++
    }
    return candidate
  }

  function reactivateRecurringGift(gift: any) {
    setConfirmModal({
      title: 'Reactivate this recurring gift?',
      description: `${gift.donor_name}'s ${gift.frequency} giving arrangement will resume. The next expected date will be set to the next upcoming cycle, not the paused period.`,
      confirmLabel: 'Reactivate',
      onConfirm: async () => {
        const nextExpected = nextExpectedFromToday(gift.start_date, gift.frequency, gift.last_received_date)
        const { error } = await supabase.from('recurring_gifts').update({ status: 'active', next_expected_date: nextExpected, pause_reason: null, pause_resume_date: null }).eq('id', gift.id)
        if (error) { showToast('Error reactivating', 'error'); return }
        await supabase.from('audit_log').insert({
          actor_type: 'charity',
          actor_email: session.user.email,
          action: 'recurring_gift_reactivated',
          details: { donor_name: gift.donor_name, charity_uen: charityUen },
        })
        setRecurringGifts(prev => prev.map(g => g.id === gift.id ? { ...g, status: 'active', next_expected_date: nextExpected, pause_reason: null, pause_resume_date: null } : g))
        showToast(`${gift.donor_name}'s recurring gift reactivated ✓`)
      },
    })
  }

  async function cancelRecurringGift(gift: any) {
    setConfirmModal({
      title: 'Cancel this recurring gift?',
      description: `${gift.donor_name}'s ${gift.frequency} giving arrangement will be marked as cancelled. The record is kept for reference.`,
      confirmLabel: 'Cancel Arrangement',
      onConfirm: async () => {
        const { error } = await supabase.from('recurring_gifts').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', gift.id)
        if (error) { showToast('Error cancelling', 'error'); return }
        setRecurringGifts(prev => prev.map(g => g.id === gift.id ? { ...g, status: 'cancelled', cancelled_at: new Date().toISOString() } : g))
        await supabase.from('audit_log').insert({
          actor_type: 'charity',
          actor_email: session.user.email,
          action: 'recurring_gift_cancelled',
          details: { donor_name: gift.donor_name, charity_uen: charityUen },
        })
        showToast('Recurring gift cancelled')
      },
    })
  }

  function restoreCancelledRecurringGift(gift: any) {
    setConfirmModal({
      title: 'Restore this recurring gift?',
      description: `${gift.donor_name}'s ${gift.frequency} giving arrangement will be marked active again.`,
      confirmLabel: 'Restore',
      onConfirm: async () => {
        const nextExpected = nextExpectedFromToday(gift.start_date, gift.frequency, gift.last_received_date)
        const { error } = await supabase.from('recurring_gifts').update({ status: 'active', next_expected_date: nextExpected, cancelled_at: null }).eq('id', gift.id)
        if (error) { showToast('Error restoring', 'error'); return }
        await supabase.from('audit_log').insert({
          actor_type: 'charity',
          actor_email: session.user.email,
          action: 'recurring_gift_restored',
          details: { donor_name: gift.donor_name, charity_uen: charityUen },
        })
        setRecurringGifts(prev => prev.map(g => g.id === gift.id ? { ...g, status: 'active', next_expected_date: nextExpected, cancelled_at: null } : g))
        showToast(`${gift.donor_name}'s recurring gift restored ✓`)
      },
    })
  }

  function recordFailedDeduction(gift: any) {
    setFailedDeductionReason('Insufficient funds')
    setFailedDeductionModal(gift)
  }

  async function confirmRecordFailedDeduction() {
    if (!failedDeductionModal) return
    setRecordingFailedDeduction(true)
    const gift = failedDeductionModal
    const { data: inserted, error } = await supabase.from('recurring_gift_events').insert({
      recurring_gift_id: gift.id,
      event_type: 'failed_deduction',
      skipped_cycle_date: gift.next_expected_date,
      reason: failedDeductionReason,
      created_by: session.user.email,
    }).select().single()
    setRecordingFailedDeduction(false)
    if (error) { showToast('Error recording failed deduction', 'error'); return }
    setRecurringFailedDeductionHistory(prev => ({ ...prev, [gift.id]: [inserted, ...(prev[gift.id] || [])] }))
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'recurring_gift_failed_deduction',
      details: { donor_name: gift.donor_name, reason: failedDeductionReason },
    })
    showToast('Failed deduction logged')
    setFailedDeductionModal(null)
  }

  async function loadMassAppeals(activeSession = session) {
    const uen = activeSession?.user?.app_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase
      .from('mass_appeals')
      .select('*')
      .eq('charity_uen', uen)
      .order('created_at', { ascending: false })
    if (error) { console.error('Could not load mass appeals:', error); return }
    setMassAppeals(data || [])

    if (data && data.length > 0) {
      const { data: recipientData, error: recipientError } = await supabase
        .from('mass_appeal_recipients')
        .select('*')
        .in('appeal_id', data.map(a => a.id))
      if (recipientError) { console.error('Could not load appeal recipients:', recipientError); return }
      setAllAppealRecipients(recipientData || [])
    }
  }

  async function loadMyCauses() {
    const uen = charityUenFromSession()
    if (!uen) { console.warn('loadMyCauses: no charity_uen in session metadata'); return }
    const { data, error } = await supabase
      .from('causes')
      .select('*')
      .eq('charity_uen', uen)
      .order('created_at', { ascending: false })
    if (error) { console.error(error); return }
    setMyCauses(data)
  }

  function charityUenFromSession() {
    return session?.user?.app_metadata?.charity_uen || ''
  }

  function deleteCause(id: any) {
    if (bulkActionInProgress) { showToast('Please wait for the current action to finish', 'error'); return }
    setConfirmModal({
      title: 'Delete this campaign?',
      description: 'It will be moved to Past Campaigns. Any donations already tagged to it are kept for your records.',
      confirmLabel: 'Delete',
      onConfirm: () => deleteCauseConfirmed(id),
    })
  }

  function completeCause(c: any, raisedAmount: any) {
    const metGoal = c.target_amount > 0 && raisedAmount >= c.target_amount
    setConfirmModal({
      title: 'Mark this campaign as complete?',
      description: metGoal
        ? `"${c.title}" raised $${raisedAmount.toLocaleString()} of its $${Number(c.target_amount).toLocaleString()} goal — nicely done! It will move to Past Campaigns.`
        : `"${c.title}" raised $${raisedAmount.toLocaleString()}${c.target_amount > 0 ? ` of its $${Number(c.target_amount).toLocaleString()} goal` : ''}. It will move to Past Campaigns as ended.`,
      confirmLabel: 'Mark Complete',
      onConfirm: () => completeCauseConfirmed(c.id),
    })
  }

  async function completeCauseConfirmed(id: any) {
    setBulkActionInProgress(true)
    const { error } = await supabase.from('causes').update({ status: 'completed', active: false }).eq('id', id)
    setBulkActionInProgress(false)
    if (error) { showToast('Error completing campaign', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'cause_completed',
      details: { charity_uen: charityUen },
    })
    loadMyCauses()
    showToast('Campaign marked complete ✓')
  }

  function restoreCause(c: any) {
    const isPastEndDate = c.end_date && new Date(c.end_date) < new Date()
    setConfirmModal({
      title: 'Restore this campaign?',
      description: isPastEndDate
        ? `"${c.title}" will be restored, but its end date (${new Date(c.end_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}) has already passed, so it won't accept new donations as "live" until you edit it with a new end date.`
        : `"${c.title}" will move back into your active campaigns.`,
      confirmLabel: 'Restore',
      onConfirm: async () => {
        setBulkActionInProgress(true)
        const { error } = await supabase.from('causes').update({ status: 'approved', active: true }).eq('id', c.id)
        setBulkActionInProgress(false)
        if (error) { showToast('Error restoring campaign', 'error'); return }
        await supabase.from('audit_log').insert({
          actor_type: 'charity',
          actor_email: session.user.email,
          action: 'cause_restored',
          details: { title: c.title, charity_uen: charityUen },
        })
        loadMyCauses()
        showToast(`"${c.title}" restored ✓`)
      },
    })
  }

  async function permanentlyDeleteCause(c: any) {
    const linkedDonations = donations.filter(d => d.cause_id === c.id).length
    if (linkedDonations > 0) {
      setConfirmModal({
        title: 'Cannot permanently delete',
        description: `"${c.title}" has ${linkedDonations} donation${linkedDonations !== 1 ? 's' : ''} still linked to it. Permanently deleting it would break those records, so this isn't allowed. The campaign will remain soft-deleted (hidden from active use, but kept for your records).`,
        confirmLabel: 'OK',
        onConfirm: () => {},
      })
      return
    }
    setConfirmModal({
      title: 'Permanently delete this campaign?',
      description: `This cannot be undone. "${c.title}" will be completely removed, not just hidden.`,
      confirmLabel: 'Permanently Delete',
      onConfirm: () => permanentlyDeleteCauseConfirmed(c),
    })
  }

  async function permanentlyDeleteCauseConfirmed(c: any) {
    setBulkActionInProgress(true)
    const { error } = await supabase.from('causes').delete().eq('id', c.id)
    setBulkActionInProgress(false)
    if (error) {
      showToast(error.message.includes('foreign key') ? 'Cannot delete — donations are still linked to this campaign' : 'Error deleting campaign', 'error')
      return
    }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'cause_permanently_deleted',
      details: { title: c.title, charity_uen: charityUen },
    })
    setMyCauses(prev => prev.filter(x => x.id !== c.id))
    showToast('Campaign permanently deleted')
  }

  async function deleteCauseConfirmed(id: any) {
    setBulkActionInProgress(true)
    const causeTitle = myCauses.find((c: any) => c.id === id)?.title
    const { error } = await supabase.from('causes').update({ status: 'deleted', active: false }).eq('id', id)
    setBulkActionInProgress(false)
    if (error) { showToast('Error deleting', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'cause_deleted',
      details: { title: causeTitle, charity_uen: charityUen },
    })
    loadMyCauses()
    showToast('Submission deleted')
  }

  function startEditCause(c: any) {
    setCauseForm({
      title: c.title,
      description: c.description,
      target_amount: c.target_amount?.toString() || '',
      start_date: c.start_date || '',
      end_date: c.end_date || '',
      cost: c.cost?.toString() || '',
      category: c.category || '',
      tax_deductible: c.tax_deductible !== false,
      benefit_value: c.benefit_value?.toString() || '',
      permit_number: c.permit_number || '',
      permit_status: c.permit_status || 'not_required',
      permit_expiry: c.permit_expiry || '',
      editingId: c.id,
      editingStatus: c.status,
    })
    setShowCampaignModal(true)
  }

  function requestRevision(c: any) {
    startEditCause(c)
  }

  async function submitCause() {
    if (!causeForm.title.trim()) { setCauseError('Title is required'); return }
    if (!causeForm.description.trim()) { setCauseError('Description is required'); return }
    if (causeForm.target_amount && (isNaN(parseFloat(causeForm.target_amount)) || parseFloat(causeForm.target_amount) <= 0)) { setCauseError('Target amount must be a positive number'); return }
    if (causeForm.cost && (isNaN(parseFloat(causeForm.cost)) || parseFloat(causeForm.cost) < 0)) { setCauseError('Cost must be a positive number'); return }
    if (causeForm.benefit_value && (isNaN(parseFloat(causeForm.benefit_value)) || parseFloat(causeForm.benefit_value) < 0)) { setCauseError('Benefit value must be a positive number'); return }
    if (causeForm.start_date && causeForm.end_date && causeForm.end_date < causeForm.start_date) { setCauseError('End date cannot be before start date'); return }
    if (causeForm.permit_status !== 'not_required' && !causeForm.permit_number?.trim()) { setCauseError('Permit number is required when a permit is applied for or obtained'); return }
    if (causeForm.permit_status !== 'not_required' && !causeForm.permit_expiry) { setCauseError('Permit expiry date is required when a permit is applied for or obtained'); return }
    setSavingCause(true)
    setCauseError('')

    if (causeForm.editingId) {
      const { error } = await supabase.from('causes').update({
        title: causeForm.title,
        description: causeForm.description,
        target_amount: causeForm.target_amount ? parseFloat(causeForm.target_amount) : null,
        start_date: causeForm.start_date || null,
        end_date: causeForm.end_date || null,
        cost: causeForm.cost ? parseFloat(causeForm.cost) : 0,
        category: causeForm.category || null,
        tax_deductible: charityIsIpc ? causeForm.tax_deductible : false,
        benefit_value: (charityIsIpc && causeForm.tax_deductible && causeForm.benefit_value) ? parseFloat(causeForm.benefit_value) : 0,
        permit_number: causeForm.permit_status === 'not_required' ? null : (causeForm.permit_number || null),
        permit_status: causeForm.permit_status,
        permit_expiry: causeForm.permit_status === 'not_required' ? null : (causeForm.permit_expiry || null),
        ...(causeForm.editingStatus === 'rejected' ? { status: 'approved', active: true } : {}),
      }).eq('id', causeForm.editingId)
      setSavingCause(false)
      if (error) { setCauseError(`Error: ${error.message}`); return }
      await supabase.from('audit_log').insert({
        actor_type: 'charity',
        actor_email: session.user.email,
        action: 'cause_edited',
        details: { title: causeForm.title, charity_uen: charityUen },
      })
      setCauseForm(EMPTY_CAUSE_FORM)
      loadMyCauses()
      showToast('Campaign updated ✓')
      return
    }

    const { error } = await supabase.from('causes').insert([{
      title: causeForm.title,
      description: causeForm.description,
      charity_name: charityName,
      charity_uen: charityUen,
      target_amount: causeForm.target_amount ? parseFloat(causeForm.target_amount) : null,
      start_date: causeForm.start_date || null,
      end_date: causeForm.end_date || null,
      cost: causeForm.cost ? parseFloat(causeForm.cost) : 0,
      category: causeForm.category || null,
      tax_deductible: charityIsIpc ? causeForm.tax_deductible : false,
      benefit_value: (charityIsIpc && causeForm.tax_deductible && causeForm.benefit_value) ? parseFloat(causeForm.benefit_value) : 0,
      permit_number: causeForm.permit_status === 'not_required' ? null : (causeForm.permit_number || null),
      permit_status: causeForm.permit_status,
      permit_expiry: causeForm.permit_status === 'not_required' ? null : (causeForm.permit_expiry || null),
      type: 'campaign',
      status: 'approved',
      active: true,
    }]).select()
    setSavingCause(false)
    if (error) { setCauseError(`Error: ${error.message}`); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'cause_created',
      details: { title: causeForm.title, charity_uen: charityUen },
    })
    setCauseForm(EMPTY_CAUSE_FORM)
    loadMyCauses()
    showToast('Campaign created ✓')
  }


  async function loadAuditLog() {
    setAuditLoading(true)
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .or(`actor_email.eq.${session.user.email},details->>charity_uen.eq.${charityUen}`)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) { console.error(error); setAuditLoading(false); return }
    setAuditLog(data)
    setAuditLoading(false)
  }

  useEffect(() => {
    if (session && activeTab === 'activity') loadAuditLog()
    setShowMobileMenu(false)
    // intentionally keyed on session id, not the full session object -- loadAuditLog is a plain
    // function recreated every render, and the full session changes on every token refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, activeTab])

  // Separate from the effect above — updateUser() fires onAuthStateChange, which replaces the
  // session object, which would re-trigger any effect keyed on the full `session` value. Guarding
  // on the stored tab (not calling this if it's already correct) stops that from looping forever.
  useEffect(() => {
    if (session && session.user?.user_metadata?.last_active_tab !== activeTab) {
      supabase.auth.updateUser({ data: { last_active_tab: activeTab } })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, session?.user?.id])

  useEffect(() => {
    if (selectedDonation && selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    setShowDonationMoreActions(false)
  }, [selectedDonation])

  useEffect(() => {
    let cancelled = false
    if (selectedDonor) {
      loadDonorNotes(selectedDonor, () => cancelled)
    } else {
      setDonorNotes([])
    }
    return () => { cancelled = true }
    // loadDonorNotes is a plain function recreated every render; would refetch on every render if listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDonor])

  // Records a communication-log entry for a donor and updates the in-memory maps so anything keyed
  // off "last contacted" (donor warmth, the profile "Right now" moments) reflects it immediately.
  async function logDonorContact(donorKey: any, note: any, noteType: any, bumpWarmth = true, emailContent: any = null) {
    const base = { charity_uen: charityUen, donor_key: donorKey, note, note_type: noteType, created_by: session.user.email }
    const row = emailContent ? { ...base, email_subject: emailContent.subject || null, email_body: emailContent.body || null } : base
    let { data, error } = await supabase.from('donor_notes').insert([row]).select()
    // If the email_subject/email_body columns aren't migrated yet, fall back to logging without them.
    if (error && error.code === '42703' && emailContent) {
      ;({ data, error } = await supabase.from('donor_notes').insert([base]).select())
    }
    if (error) { console.error('Could not log contact:', error); return { error } }
    // 'moment_done' is an internal dismissal marker (used by the profile "Right now" card), not a real
    // communication — it clears the moment but shouldn't count as contact or show in the log.
    if (bumpWarmth) setDonorLastContactMap(prev => ({ ...prev, [donorKey]: data[0].created_at }))
    if (selectedDonor && (selectedDonor.email?.trim() || selectedDonor.name) === donorKey) {
      setDonorNotes(prev => [data[0], ...prev])
    }
    return { data: data[0] }
  }

  // Logs a contact/dismissal note and immediately offers an undo, rather than leaving the only
  // way back a trip to the donor's own Notes & Activity tab (which the person dismissing a "Right
  // now" card while looking at a donor LIST, not this donor's profile, wouldn't even know to visit).
  async function logDonorContactWithUndo(donorKey: any, note: any, noteType: any, doneMsg = 'Logged as done ✓') {
    const { data, error } = await logDonorContact(donorKey, note, noteType)
    if (error) { showToast('Could not log this', 'error'); return }
    let cancelled = false
    setToast({
      msg: doneMsg, undoable: true,
      onUndo: async () => {
        cancelled = true
        if (data?.id) await deleteDonorNote(data.id)
        setToast(null)
        showToast('Undone ✓')
      },
    })
    setTimeout(() => { if (!cancelled) setToast(null) }, 10000)
  }

  async function loadDonorNotes(donor: any, isCancelled: any) {
    setDonorNotesLoading(true)
    const donorKey = donor.email?.trim() || donor.name
    const { data, error } = await supabase
      .from('donor_notes')
      .select('*')
      .eq('charity_uen', charityUen)
      .eq('donor_key', donorKey)
      .order('created_at', { ascending: false })
    if (isCancelled && isCancelled()) return
    if (error) { console.error(error); setDonorNotesLoading(false); return }
    setDonorNotes(data || [])
    setDonorNotesLoading(false)
  }

  async function saveNewDonorNote() {
    if (!newNoteText.trim()) return
    if (!selectedDonor) return
    setSavingNote(true)
    const donorKey = selectedDonor.email?.trim() || selectedDonor.name
    const { data, error } = await supabase.from('donor_notes').insert([{
      charity_uen: charityUen,
      donor_key: donorKey,
      note: newNoteText.trim(),
      note_type: newNoteType,
      created_by: session.user.email,
    }]).select()
    if (error) { showToast('Error saving note', 'error'); setSavingNote(false); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'donor_note_added',
      details: { donor_name: selectedDonor.name, note_type: newNoteType, charity_uen: charityUen },
    })
    setDonorNotes(prev => [data[0], ...prev])
    setDonorLastContactMap(prev => (!prev[donorKey] || new Date(data[0].created_at) > new Date(prev[donorKey])) ? { ...prev, [donorKey]: data[0].created_at } : prev)
    setNewNoteText('')
    setNewNoteType('note')
    setSavingNote(false)
    showToast('Note saved ✓')
  }

  async function saveDonorNoteEdit(noteId: any) {
    const text = editingDonorNoteText.trim()
    if (!text) return
    setSavingDonorNoteEdit(true)
    const { error } = await supabase.from('donor_notes').update({ note: text }).eq('id', noteId)
    if (error) { showToast('Error updating note', 'error'); setSavingDonorNoteEdit(false); return }
    setDonorNotes(prev => prev.map(n => n.id === noteId ? { ...n, note: text } : n))
    setEditingDonorNoteId(null); setEditingDonorNoteText(''); setSavingDonorNoteEdit(false)
    showToast('Updated ✓')
  }

  async function deleteDonorNote(noteId: any) {
    const note = donorNotes.find(n => n.id === noteId)
    const { error } = await supabase.from('donor_notes').delete().eq('id', noteId)
    if (error) { showToast('Error deleting note', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'donor_note_deleted',
      details: { donor_key: note?.donor_key, note: note?.note, charity_uen: charityUen },
    })
    setDonorNotes(prev => {
      const next = prev.filter(n => n.id !== noteId)
      if (note) {
        const remaining = next.filter(n => n.donor_key === note.donor_key)
        const newest = remaining.reduce((latest, n) => !latest || new Date(n.created_at) > new Date(latest) ? n.created_at : latest, null)
        setDonorLastContactMap(prevMap => {
          const updated = { ...prevMap }
          if (newest) updated[note.donor_key] = newest
          else delete updated[note.donor_key]
          return updated
        })
      }
      return next
    })
    showToast('Note deleted')
  }

  async function saveDonorTag(donor: any, tagOverride: any) {
    const tag = (tagOverride ?? newTagInput).trim()
    if (!tag) return
    setSavingTag(true)
    const donorKey = donor.email?.trim() || donor.name
    const { data, error } = await supabase.from('donor_tags').insert([{
      charity_uen: charityUen,
      donor_key: donorKey,
      tag,
      created_by: session.user.email,
    }]).select()
    if (error) {
      if (error.code === '23505') { showToast('This tag already exists for this donor', 'error') }
      else { showToast('Error saving tag', 'error') }
      setSavingTag(false)
      return
    }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'donor_tag_added',
      details: { donor_name: donor.name, tag, charity_uen: charityUen },
    })
    setDonorTagsMap(prev => ({
      ...prev,
      [donorKey]: [...(prev[donorKey] || []), data[0]],
    }))
    setNewTagInput('')
    setSavingTag(false)
    showToast('Tag added ✓')
  }

  async function saveTagSegment() {
    const tag = tagSegmentName.trim()
    if (!tag) { showToast('Enter a segment name', 'error'); return }
    if (tagSegmentSelectedKeys.size === 0) { showToast('Select at least one donor', 'error'); return }
    setSavingTagSegment(true)
    for (const key of tagSegmentSelectedKeys) {
      const donor = donorList.find(d => (d.email?.trim() || d.name) === key)
      if (!donor) continue
      const alreadyTagged = (donorTagsMap[key] || []).some((t: any) => t.tag === tag)
      if (!alreadyTagged) await saveDonorTag(donor, tag)
    }
    setSavingTagSegment(false)
    setShowTagSegmentManager(false)
    setTagSegmentName('')
    setTagSegmentSelectedKeys(new Set())
    setTagSegmentSearch('')
    setMassAppealForm((f: any) => ({ ...f, targetTag: tag }))
    showToast(`Segment "${tag}" saved ✓`)
  }

  async function deleteDonorTag(donor: any, tagId: any) {
    const donorKey = donor.email?.trim() || donor.name
    const removedTag = (donorTagsMap[donorKey] || []).find((t: any) => t.id === tagId)
    const { error } = await supabase.from('donor_tags').delete().eq('id', tagId)
    if (error) { showToast('Error removing tag', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'donor_tag_removed',
      details: { donor_name: donor.name, tag: removedTag?.tag, charity_uen: charityUen },
    })
    setDonorTagsMap(prev => ({
      ...prev,
      [donorKey]: (prev[donorKey] || []).filter((t: any) => t.id !== tagId),
    }))
    showToast('Tag removed')
  }

  function parseMigrationCSV(text: any) {
    const lines = text.split('\n').map((l: any) => l.trim()).filter(Boolean)
    if (lines.length < 2) return { headers: [], rows: [] }
    const headers = lines[0].split(',').map((h: any) => h.trim().replace(/^"|"$/g, '').toLowerCase())
    const rows = lines.slice(1).map((line: any) => {
      // Handle quoted fields with commas inside
      const fields: any[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') { inQuotes = !inQuotes; continue }
        if (line[i] === ',' && !inQuotes) { fields.push(current.trim()); current = ''; continue }
        current += line[i]
      }
      fields.push(current.trim())
      const obj: Record<string, any> = {}
      headers.forEach((h: any, i: any) => { obj[h] = fields[i] || '' })
      return obj
    })
    return { headers, rows }
  }

  function detectMigrationColumn(headers: any, candidates: any) {
    for (const candidate of candidates) {
      const match = headers.find((h: any) => h.includes(candidate.toLowerCase()))
      if (match) return match
    }
    return null
  }

  function previewMigrationFile(file: any) {
    if (!file) return
    setMigrationFile(file)
    setMigrationErrors([])
    setMigrationPreview(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      const { headers, rows } = parseMigrationCSV(text)
      if (headers.length === 0) { setMigrationErrors(['Could not parse file — make sure it is a CSV exported from Google Sheets']); return }

      // Auto-detect columns
      const colDonorName  = detectMigrationColumn(headers, ['donor name', 'donor', 'name', 'full name'])
      const colAmount     = detectMigrationColumn(headers, ['amount', 'donation', 'sum', 'total'])
      const colDate       = detectMigrationColumn(headers, ['date', 'donation date', 'created'])
      const colEmail      = detectMigrationColumn(headers, ['email', 'donor email', 'e-mail'])
      const colNric       = detectMigrationColumn(headers, ['nric', 'fin', 'id number', 'nric/fin'])
      const colMethod     = detectMigrationColumn(headers, ['method', 'payment method', 'payment type', 'type'])
      const colNotes      = detectMigrationColumn(headers, ['notes', 'remarks', 'note', 'comment'])
      const colReceiptNo  = detectMigrationColumn(headers, ['receipt', 'receipt no', 'receipt number', 'receipt #'])

      const errors = []
      if (!colDonorName) errors.push('Could not find a donor name column — expected a column named "Donor Name" or "Name"')
      if (!colAmount) errors.push('Could not find an amount column — expected a column named "Amount" or "Donation"')
      if (!colDate) errors.push('Could not find a date column — expected a column named "Date" or "Donation Date"')

      // Validate rows
      const validRows: any[] = []
      const rowErrors: any[] = []
      rows.forEach((row: any, i: any) => {
        const rowNum = i + 2 // 1-indexed + header
        const name = colDonorName ? row[colDonorName]?.trim() : ''
        const amountRaw = colAmount ? row[colAmount]?.replace(/[$,\s]/g, '') : ''
        const amount = parseFloat(amountRaw)
        const dateRaw = colDate ? row[colDate]?.trim() : ''
        const date = new Date(dateRaw)

        if (!name) { rowErrors.push(`Row ${rowNum}: missing donor name`); return }
        if (isNaN(amount) || amount <= 0) { rowErrors.push(`Row ${rowNum}: invalid amount "${row[colAmount]}"`); return }
        if (isNaN(date.getTime())) { rowErrors.push(`Row ${rowNum}: invalid date "${dateRaw}"`); return }
        if (date > new Date()) { rowErrors.push(`Row ${rowNum}: date is in the future`); return }

        validRows.push({
          donor_name: name,
          amount,
          date: date.toISOString().split('T')[0],
          donor_email: colEmail ? row[colEmail]?.trim() || null : null,
          donor_nric: colNric ? row[colNric]?.trim().toUpperCase() || null : null,
          payment_method: colMethod ? row[colMethod]?.trim() || 'Cash' : 'Cash',
          notes: colNotes ? row[colNotes]?.trim() || null : null,
          receipt_number: colReceiptNo ? row[colReceiptNo]?.trim() || null : null,
        })
      })

      if (errors.length > 0) { setMigrationErrors(errors); return }

      setMigrationErrors(rowErrors.slice(0, 10))
      setMigrationPreview({
        totalRows: rows.length,
        validRows,
        skippedRows: rows.length - validRows.length,
        detectedColumns: {
          donorName: colDonorName,
          amount: colAmount,
          date: colDate,
          email: colEmail,
          nric: colNric,
          method: colMethod,
          notes: colNotes,
          receiptNo: colReceiptNo,
        },
        rowErrors: rowErrors.slice(0, 10),
        totalErrors: rowErrors.length,
      })
    }
    reader.readAsText(file)
  }

  async function runMigration() {
    if (!migrationPreview || migrationPreview.validRows.length === 0) return
    migrationCancelRef.current = false
    setMigrationProgress({ done: 0, total: migrationPreview.validRows.length, imported: 0, skipped: 0 })

    let imported = 0
    let skipped = 0
    const batchSize = 50

    const rows = migrationPreview.validRows
    for (let i = 0; i < rows.length; i += batchSize) {
      if (migrationCancelRef.current) break
      const batch = rows.slice(i, i + batchSize)
      const inserts = batch.map((row: any) => ({
        donor_name: row.donor_name,
        donor_email: row.donor_email || null,
        donor_nric: row.donor_nric || null,
        charity_name: charityName,
        charity_uen: charityUen,
        amount: row.amount,
        status: 'confirmed',
        payment_status: 'confirmed',
        receipt_issued: !!row.receipt_number,
        receipt_number: row.receipt_number || null,
        source: 'manual',
        payment_method: row.payment_method || 'Cash',
        notes: row.notes || null,
        created_at: row.date,
      }))
      const { error } = await supabase.from('donations').insert(inserts)
      if (error) {
        console.error('Migration batch error:', error)
        skipped += batch.length
      } else {
        imported += batch.length
      }
      setMigrationProgress({ done: i + batch.length, total: rows.length, imported, skipped })
    }

    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'csv_migration_imported',
      details: { imported, skipped, total: rows.length },
    })

    await loadDonations()
    setMigrationComplete({ imported, skipped })
    setMigrationProgress(null)
    showToast(`Migration complete — ${imported} records imported ✓`)
  }

  function generateAppealRef(donorName: any) {
    const clean = donorName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase()
    // 7 base36 chars (~78 billion combinations) instead of 4 (~1.7 million) -- refs aren't
    // namespaced by appeal, so low entropy risked two different appeals minting the same ref
    // and one donation getting attributed as "converted" for both.
    const suffix = Math.random().toString(36).substring(2, 9).toUpperCase()
    return `GT-${clean}-${suffix}`
  }

  async function sendTestAppealToSelf() {
    if (!session?.user?.email) { showToast('No email on your account', 'error'); return }
    setSendingTestAppeal(true)
    const sampleDonor = massAppealRefs.find(r => r.selected) || massAppealRefs[0]
    const causeName = massAppealForm.cause_id ? (myCauses.find(c => c.id === massAppealForm.cause_id)?.title || null) : (massAppealForm.customLabel?.trim() || null)
    const testMessage = massAppealForm.message
      ? massAppealForm.message.replace(/\[name\]/gi, sampleDonor?.donor_name?.split(' ')[0] || 'there')
      : null

    const { error } = await sendCharityEmail({
      type: 'mass_appeal',
      donor_name: `[TEST] ${sampleDonor?.donor_name || 'Sample Donor'}`,
      donor_email: session.user.email,
      charity_name: charityName,
      charity_uen: charityUen,
      amount: massAppealForm.amount,
      payment_ref: sampleDonor?.ref || 'TEST-REF',
      cause_title: causeName,
      subject_override: massAppealSubject(causeName),
      custom_message: testMessage,
      paynow_url: sampleDonor?.qrValue,
    })
    setSendingTestAppeal(false)
    if (error) { showToast('Failed to send test email', 'error'); return }
    showToast(`Test email sent to ${session.user.email} — check your inbox`)
  }

  async function generateMassAppealRefs() {
    if (!massAppealForm.amount || parseFloat(massAppealForm.amount) <= 0) {
      showToast('Please enter a default amount', 'error'); return
    }
    const targetDonors = donorList.filter(d => {
      // Must match the "Who will receive this?" count shown on the setup step, which already
      // excludes doNotContact donors -- previously this list still included them (just
      // pre-unchecked), so the preview list could be longer than what staff were told to expect.
      if (d.deactivated || d.doNotContact || !d.email?.trim()) return false
      if (massAppealForm.targetTag && massAppealForm.targetTag !== 'All') {
        const donorKey45 = d.email?.trim() || d.name
        const tags45 = donorTagsMap[donorKey45] || []
        return tags45.some((t: any) => t.tag === massAppealForm.targetTag)
      }
      return true
    })
    if (targetDonors.length === 0) {
      showToast('No donors with email addresses found', 'error'); return
    }
    // Regenerate with consistent refs
    const finalRefs = targetDonors.map(donor => {
      const ref = generateAppealRef(donor.name)
      const donorKey44b = donor.email?.trim() || donor.name
      const contact44b = donorContacts.find(c => (c.email?.trim() || c.full_name) === donorKey44b)
      const restrictions44b = contact44b?.communication_restrictions?.toLowerCase() || ''
      // Free-text matching is inherently fragile -- this catches common phrasings as a soft
      // pre-uncheck (staff can still see and override it in the preview list), not a hard block.
      const flaggedRestricted = /no mass|no appeal|do not send appeal|no bulk|don'?t (include|send|contact|email)|not.{0,15}appeal|exclude.{0,15}appeal|no (further |more )?(mass )?email/.test(restrictions44b)
      return {
        donor_name: donor.name,
        donor_email: donor.email,
        ref,
        amount: parseFloat(massAppealForm.amount),
        qrValue: `https://www.paynow.com.sg/pay?uen=${charityUen}&amount=${massAppealForm.amount}&ref=${ref}`,
        selected: !flaggedRestricted,
        restrictionNote: flaggedRestricted ? contact44b.communication_restrictions : null,
      }
    })
    setMassAppealRefs(finalRefs)
    setMassAppealStep('preview')
  }

  async function sendMassAppealEmails() {
    const selected = massAppealRefs.filter(r => r.selected)
    if (selected.length === 0) { showToast('No donors selected', 'error'); return }
    if (massAppealSendingRef.current) return
    massAppealSendingRef.current = true
    massAppealCancelRef.current = false
    setMassAppealProgress({ done: 0, total: selected.length, sent: 0, failed: 0, blocked: 0 })
    let sent = 0
    let failed = 0
    let blocked = 0
    const causeName = massAppealForm.cause_id ? (myCauses.find(c => c.id === massAppealForm.cause_id)?.title || null) : (massAppealForm.customLabel?.trim() || null)

    const { data: appealRow } = await supabase.from('mass_appeals').insert([{
      charity_uen: charityUen,
      cause_id: massAppealForm.cause_id || null,
      cause_name: causeName,
      target_tag: massAppealForm.targetTag && massAppealForm.targetTag !== 'All' ? massAppealForm.targetTag : null,
      amount: parseFloat(massAppealForm.amount),
      message: massAppealForm.message || null,
      donor_count: selected.length,
      sent_count: 0,
      failed_count: 0,
      status: 'sending',
      created_by: session.user.email,
    }]).select()
    const appealId = appealRow?.[0]?.id

    for (let i = 0; i < selected.length; i++) {
      if (massAppealCancelRef.current) break
      const donor = selected[i]
      const { error } = await sendCharityEmail({
        type: 'mass_appeal',
        donor_name: donor.donor_name,
        donor_email: donor.donor_email,
        charity_name: charityName,
        charity_uen: charityUen,
        amount: donor.amount,
        payment_ref: donor.ref,
        cause_title: causeName,
        subject_override: massAppealSubject(causeName),
        custom_message: massAppealForm.message
          ? massAppealForm.message.replace(/\[name\]/gi, donor.donor_name?.split(' ')[0] || 'there')
          : null,
        paynow_url: donor.qrValue,
      })
      let recipientStatus = 'sent'
      if (error?.message?.includes('Do Not Contact')) {
        blocked++
        recipientStatus = 'blocked'
      } else if (error) {
        failed++
        recipientStatus = 'failed'
        console.error('Failed to send to', donor.donor_email, error)
      } else {
        sent++
      }

      if (appealId) {
        const { error: insertError } = await supabase.from('mass_appeal_recipients').insert({
          appeal_id: appealId,
          donor_name: donor.donor_name,
          donor_email: donor.donor_email,
          amount: donor.amount,
          payment_ref: donor.ref,
          status: recipientStatus,
          error_message: error?.message || null,
        })
        if (insertError) console.error('Failed to record appeal recipient row for', donor.donor_email, insertError)
      }

      setMassAppealProgress({ done: i + 1, total: selected.length, sent, failed, blocked })
    }

    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'mass_appeal_sent',
      details: { sent, failed, blocked, total: selected.length, cause_id: massAppealForm.cause_id },
    })

    if (appealId) {
      // Derive final counts from the recipient rows that actually persisted, rather than the
      // in-memory counters, so mass_appeals never overstates what mass_appeal_recipients has —
      // a recipient insert above can fail independently of the send itself.
      const { data: persistedRecipients } = await supabase.from('mass_appeal_recipients').select('status').eq('appeal_id', appealId)
      const persistedSent = (persistedRecipients || []).filter(r => r.status === 'sent').length
      const persistedFailed = (persistedRecipients || []).filter(r => r.status === 'failed').length
      const { data: updatedAppeal } = await supabase.from('mass_appeals').update({
        sent_count: persistedSent,
        failed_count: persistedFailed,
        // A cancelled send previously still got marked "sent", indistinguishable from a
        // fully-completed appeal in both the data and the card badge.
        status: massAppealCancelRef.current ? 'cancelled' : 'sent',
      }).eq('id', appealId).select()
      if (updatedAppeal?.[0]) setMassAppeals(prev => [updatedAppeal[0], ...prev.filter(a => a.id !== appealId)])
    }

    setMassAppealStep('done')
    setMassAppealProgress(null)
    massAppealSendingRef.current = false
    showToast(massAppealCancelRef.current
      ? `Appeal cancelled after ${sent} donor${sent !== 1 ? 's' : ''} sent`
      : `Appeal sent to ${sent} donor${sent !== 1 ? 's' : ''}${failed > 0 ? ` · ${failed} failed` : ''} ✓`)
  }

  async function retryAppealRecipients(appeal: any, recipientsToRetry: any) {
    if (recipientsToRetry.length === 0) return
    setRetryingAppealRecipients(true)
    let retriedSent = 0
    let retriedFailed = 0

    for (const recipient of recipientsToRetry) {
      const qrValue = `https://www.paynow.com.sg/pay?uen=${charityUen}&amount=${recipient.amount}&ref=${recipient.payment_ref}`
      const { error } = await sendCharityEmail({
        type: 'mass_appeal',
        donor_name: recipient.donor_name,
        donor_email: recipient.donor_email,
        charity_name: charityName,
        charity_uen: charityUen,
        amount: recipient.amount,
        payment_ref: recipient.payment_ref,
        cause_title: appeal.cause_name,
        subject_override: massAppealSubject(appeal.cause_name),
        custom_message: appeal.message
          ? appeal.message.replace(/\[name\]/gi, recipient.donor_name?.split(' ')[0] || 'there')
          : null,
        paynow_url: qrValue,
      })
      const newStatus = error ? 'failed' : 'sent'
      if (error) retriedFailed++; else retriedSent++
      await supabase.from('mass_appeal_recipients').update({ status: newStatus, error_message: error?.message || null }).eq('id', recipient.id)
    }

    const { data: refreshedRecipients } = await supabase.from('mass_appeal_recipients').select('*').eq('appeal_id', appeal.id).order('created_at', { ascending: true })
    setAppealRecipients(refreshedRecipients || [])

    const persistedSent = (refreshedRecipients || []).filter(r => r.status === 'sent').length
    const persistedFailed = (refreshedRecipients || []).filter(r => r.status === 'failed').length
    const { data: updatedAppeal } = await supabase.from('mass_appeals').update({
      sent_count: persistedSent,
      failed_count: persistedFailed,
    }).eq('id', appeal.id).select()
    if (updatedAppeal?.[0]) {
      setMassAppeals(prev => prev.map(a => a.id === appeal.id ? updatedAppeal[0] : a))
      setSelectedAppealDetail(updatedAppeal[0])
    }

    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'mass_appeal_retry_sent',
      details: { cause_name: appeal.cause_name, retried_count: recipientsToRetry.length, retried_sent: retriedSent, retried_failed: retriedFailed },
    })
    setRetryingAppealRecipients(false)
    setRetryPreviewList(null)
    showToast(`Retried ${recipientsToRetry.length} — ${retriedSent} sent${retriedFailed > 0 ? `, ${retriedFailed} still failed` : ''}`)
  }

  async function downloadMassAppealQRZip() {
    const selected = massAppealRefs.filter(r => r.selected)
    if (selected.length === 0) { showToast('No donors selected', 'error'); return }
    showToast('Generating QR codes...')

    const zip = new JSZip()
    const causeName = massAppealForm.cause_id ? (myCauses.find(c => c.id === massAppealForm.cause_id)?.title || 'General Appeal') : (massAppealForm.customLabel?.trim() || 'General Appeal')

    // Render a temporary offscreen container so QRCodeSVG can mount and produce real SVG markup
    const offscreen = document.createElement('div')
    offscreen.style.position = 'fixed'
    offscreen.style.left = '-9999px'
    document.body.appendChild(offscreen)
    const ReactDOMClient = await import('react-dom/client')
    const root = ReactDOMClient.createRoot(offscreen)

    const svgToPngDataUrl = (svgString: any, size = 300): Promise<string> => new Promise((resolve) => {
      const img = new Image()
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '${C.white}fff'
        ctx.fillRect(0, 0, size, size)
        ctx.drawImage(img, 20, 20, size - 40, size - 40)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/png'))
      }
      img.src = url
    })

    for (const donor of selected) {
      await new Promise(resolve => {
        root.render(React.createElement(QRCodeSVG, { value: donor.qrValue, size: 260, level: 'H' }))
        setTimeout(resolve, 50)
      })
      const svgEl = offscreen.querySelector('svg')
      const svgString = new XMLSerializer().serializeToString(svgEl)
      const pngDataUrl = await svgToPngDataUrl(svgString, 300)
      const base64Data = pngDataUrl.split(',')[1]
      zip.file(`${donor.donor_name.replace(/[^a-zA-Z0-9]/g, '_')}_${donor.ref}.png`, base64Data, { base64: true })

      const infoContent = [
        `Donor: ${donor.donor_name}`,
        `Email: ${donor.donor_email}`,
        `Amount: SGD $${donor.amount}`,
        `Reference: ${donor.ref}`,
        `PayNow URL: ${donor.qrValue}`,
        `Campaign: ${causeName}`,
        `Charity: ${charityName} (UEN: ${charityUen})`,
      ].join('\n')
      zip.file(`${donor.donor_name.replace(/[^a-zA-Z0-9]/g, '_')}_${donor.ref}_info.txt`, infoContent)
    }

    root.unmount()
    document.body.removeChild(offscreen)

    // Also add a summary CSV
    const csvQuote = (v: unknown) => `"${sanitizeCsvCell(v).replace(/"/g, '""')}"`
    const csvLines = [
      'Donor Name,Email,Amount,Reference,PayNow URL',
      ...selected.map((d: any) => `${csvQuote(d.donor_name)},${csvQuote(d.donor_email)},${d.amount},${csvQuote(d.ref)},${csvQuote(d.qrValue)}`),
    ]
    zip.file('_summary.csv', csvLines.join('\n'))

    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `GivingTree-Appeal-${causeName}-${new Date().toISOString().split('T')[0]}.zip`
    a.click()
    URL.revokeObjectURL(url)
    showToast(`Downloaded ${selected.length} QR packages ✓`)
  }

  async function loadDonations(activeSession = session) {
    const { data, error } = await supabase
      .from('donations')
      .select('*')
      .eq('charity_uen', activeSession.user.app_metadata.charity_uen)
      .not('status', 'in', '(cancelled_by_donor,deleted_by_charity)')
      .order('created_at', { ascending: false })
    if (error) { console.error(error); return }
    setDonations(data)
    setLoading(false)
  }

  // Linking a donation to a pledge only ever updated the pledge's grand total and (once fully
  // met) its overall status -- for a multi-year pledge, the per-year instalment rows never got
  // marked received, so the Year 1/Year 2/... badges on the Pledges page stayed permanently
  // "pending" regardless of real payments. Mark instalments received in year order as the
  // cumulative amount applied to the pledge crosses each year's threshold.
  async function applyPaymentToInstalments(pledgeId: any, totalAppliedSoFar: number, donationDate: any) {
    const pledge = pledges.find(p => p.id === pledgeId)
    if (!pledge?.is_multi_year) return
    const myInstalments = pledgeInstalments
      .filter(i => i.pledge_id === pledgeId && !i.received)
      .sort((a, b) => a.year_number - b.year_number)
    let cumulative = pledgeInstalments
      .filter(i => i.pledge_id === pledgeId && i.received)
      .reduce((s, i) => s + Number(i.amount), 0)
    const receivedDate = donationDate ? new Date(donationDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    const newlyReceivedIds: any[] = []
    for (const inst of myInstalments) {
      cumulative += Number(inst.amount)
      if (totalAppliedSoFar + 0.005 < cumulative) break
      newlyReceivedIds.push(inst.id)
    }
    if (newlyReceivedIds.length === 0) return
    const { error } = await supabase.from('pledge_instalments').update({ received: true, received_date: receivedDate }).in('id', newlyReceivedIds)
    if (error) { console.error('Could not mark instalments received:', error); return }
    setPledgeInstalments(prev => prev.map(i => newlyReceivedIds.includes(i.id) ? { ...i, received: true, received_date: receivedDate } : i))
  }

  async function checkPledgeCompletion(donation: any) {
    const donorKey = donation.donor_email?.trim() || donation.donor_nric || donation.donor_name
    const matchingPledge = pledges.find(p => {
      if (p.status !== 'pending') return false
      const pledgeKey = p.donor_email?.trim() || p.donor_name
      return pledgeKey === donorKey
    })
    if (!matchingPledge) return null

    const { data: existingLinks } = await supabase
      .from('pledge_donations')
      .select('amount_applied')
      .eq('pledge_id', matchingPledge.id)

    const alreadyApplied = (existingLinks || []).reduce((s, l) => s + Number(l.amount_applied), 0)
    const wouldReach = alreadyApplied + Number(donation.amount)

    // Link this donation to the pledge regardless of whether it completes it
    const { data: linkData, error: linkError } = await supabase.from('pledge_donations').insert({
      pledge_id: matchingPledge.id,
      donation_id: donation.id,
      amount_applied: donation.amount,
      created_by: session.user.email,
    }).select().single()
    if (linkError) { console.error('Could not link donation to pledge:', linkError); return null }

    setPledgeGivenTotals(prev => ({
      ...prev,
      [matchingPledge.id]: (prev[matchingPledge.id] || 0) + Number(donation.amount)
    }))
    setPledgeDonationLinks(prev => ({ ...prev, [matchingPledge.id]: [...(prev[matchingPledge.id] || []), linkData] }))
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'donation_auto_linked_to_pledge',
      donation_id: donation.id,
      details: { donor_name: matchingPledge.donor_name, amount_applied: donation.amount },
    })
    await applyPaymentToInstalments(matchingPledge.id, wouldReach, donation.created_at)

    if (wouldReach >= Number(matchingPledge.amount)) {
      const autoNote = `Auto-fulfilled by donation of $${Number(donation.amount).toLocaleString()} confirmed on ${new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}`
      const { error: fulfillError } = await supabase.from('pledges').update({ status: 'fulfilled', fulfilled_donation_id: donation.id, resolution_notes: autoNote }).eq('id', matchingPledge.id)
      if (!fulfillError) setPledges(prev => prev.map(p => p.id === matchingPledge.id ? { ...p, status: 'fulfilled', fulfilled_donation_id: donation.id, resolution_notes: autoNote } : p))
      return matchingPledge
    }
    return null
  }

  async function manuallyLinkDonationToPledge(donation: any, pledgeId: any) {
    setLinkingPledgeManually(true)
    const pledge = pledges.find(p => p.id === pledgeId)
    if (!pledge) { showToast('Pledge not found', 'error'); setLinkingPledgeManually(false); return }

    const { data: existingLink } = await supabase
      .from('pledge_donations')
      .select('pledge_id, pledges(donor_name)')
      .eq('donation_id', donation.id)
      .maybeSingle()

    if (existingLink) {
      const alreadyLinkedTo = existingLink.pledge_id === pledge.id ? 'this same pledge' : `${(existingLink.pledges as any)?.donor_name || 'a different'} pledge`
      showToast(`This donation is already linked to ${alreadyLinkedTo} — not linking again`, 'error')
      setLinkingPledgeManually(false)
      setShowManualPledgeLinkModal(false)
      return
    }

    const { data: linkData, error: linkError } = await supabase.from('pledge_donations').insert({
      pledge_id: pledge.id,
      donation_id: donation.id,
      amount_applied: donation.amount,
      created_by: session.user.email,
    }).select().single()
    if (linkError) { showToast('Error linking donation to pledge', 'error'); setLinkingPledgeManually(false); return }
    setPledgeDonationLinks(prev => ({ ...prev, [pledge.id]: [...(prev[pledge.id] || []), linkData] }))

    setPledgeGivenTotals(prev => ({
      ...prev,
      [pledge.id]: (prev[pledge.id] || 0) + Number(donation.amount)
    }))

    const { data: existingLinks } = await supabase
      .from('pledge_donations')
      .select('amount_applied')
      .eq('pledge_id', pledge.id)
    const total = (existingLinks || []).reduce((s, l) => s + Number(l.amount_applied), 0)
    await applyPaymentToInstalments(pledge.id, total, donation.created_at)

    if (total >= Number(pledge.amount)) {
      const autoNote = `Auto-fulfilled by donation of $${Number(donation.amount).toLocaleString()} confirmed on ${new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}`
      const { error: fulfillError } = await supabase.from('pledges').update({ status: 'fulfilled', fulfilled_donation_id: donation.id, resolution_notes: autoNote }).eq('id', pledge.id)
      if (!fulfillError) setPledges(prev => prev.map(p => p.id === pledge.id ? { ...p, status: 'fulfilled', fulfilled_donation_id: donation.id, resolution_notes: autoNote } : p))
      setPledgeCompletionCandidate({ pledge, donation })
      setShowPledgeThankYouModal(true)
      showToast(`Linked — this completes ${pledge.donor_name}'s pledge!`)
    } else {
      showToast(`Linked $${Number(donation.amount).toLocaleString()} to ${pledge.donor_name}'s pledge`)
    }

    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'donation_linked_to_pledge',
      donation_id: donation.id,
      details: { donor_name: pledge.donor_name, amount_applied: donation.amount, pledge_completed: total >= Number(pledge.amount) },
    })
    setLinkingPledgeManually(false)
    setShowManualPledgeLinkModal(false)
    setManualPledgeLinkSelection('')
  }

  async function sendPledgeThankYou() {
    if (!pledgeCompletionCandidate) return
    setSendingPledgeThankYou(true)
    const { pledge, donation } = pledgeCompletionCandidate
    const autoNote = `Auto-fulfilled by donation of $${Number(donation.amount).toLocaleString()} confirmed on ${new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}`

    const { error: fulfillError } = await supabase.from('pledges').update({ status: 'fulfilled', fulfilled_donation_id: donation.id, resolution_notes: autoNote }).eq('id', pledge.id)
    if (fulfillError) { showToast('Error marking pledge fulfilled', 'error'); setSendingPledgeThankYou(false); return }
    setPledges(prev => prev.map(p => p.id === pledge.id ? { ...p, status: 'fulfilled', fulfilled_donation_id: donation.id, resolution_notes: autoNote } : p))
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'pledge_fulfilled',
      details: { donor_name: pledge.donor_name, amount: pledge.amount, donation_id: donation.id, thank_you_sent: true },
    })

    const { error: emailError } = await sendCharityEmail({
      type: 'pledge_thank_you',
      donor_name: donation.donor_name,
      donor_email: donation.donor_email,
      charity_name: charityName,
      charity_uen: charityUen,
      pledge_amount: Number(pledge.amount).toLocaleString(),
      subject_override: pledgeThankYouSubject,
      custom_message: pledgeThankYouBody,
      ...emailBannerFor('pledge_thank_you', { donor_name: donation.donor_name, charity_name: charityName }),
    })
    if (!emailError) {
      await supabase.from('donations').update({ thank_you_sent: true }).eq('id', donation.id)
      setDonations(prev => prev.map(x => x.id === donation.id ? { ...x, thank_you_sent: true } : x))
      showToast(`Pledge fulfilled ✓ — thank you sent to ${donation.donor_email} 🎉`)
    } else {
      showToast('Pledge marked fulfilled, but the email failed to send — try sending manually', 'error')
    }

    setSendingPledgeThankYou(false)
    setShowPledgeThankYouModal(false)
    setPledgeCompletionCandidate(null)
  }

  async function skipPledgeThankYou() {
    if (!pledgeCompletionCandidate) return
    const { pledge, donation } = pledgeCompletionCandidate
    const autoNote = `Auto-fulfilled by donation of $${Number(donation.amount).toLocaleString()} confirmed on ${new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}`

    const { error: fulfillError } = await supabase.from('pledges').update({ status: 'fulfilled', fulfilled_donation_id: donation.id, resolution_notes: autoNote }).eq('id', pledge.id)
    if (fulfillError) { showToast('Error marking pledge fulfilled', 'error'); return }
    setPledges(prev => prev.map(p => p.id === pledge.id ? { ...p, status: 'fulfilled', fulfilled_donation_id: donation.id, resolution_notes: autoNote } : p))
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'pledge_fulfilled',
      details: { donor_name: pledge.donor_name, amount: pledge.amount, donation_id: donation.id, thank_you_sent: false },
    })

    showToast('Pledge marked fulfilled')
    setShowPledgeThankYouModal(false)
    setPledgeCompletionCandidate(null)
  }

  const [duplicateDonationWarning, setDuplicateDonationWarning] = useState<any>(null)

  async function confirmPaymentFlow(donation: any) {
    const { data: freshData, error: freshError } = await supabase
      .from('donations')
      .select('payment_status, receipt_issued')
      .eq('id', donation.id)
      .single()

    if (freshError || !freshData) {
      showToast('Could not verify this donation — it may have been deleted. Please refresh and try again.', 'error')
      return
    }

    if (freshData.payment_status === 'confirmed') {
      showToast('This donation was already confirmed by someone else', 'error')
      setDonations(prev => prev.map(x => x.id === donation.id ? { ...x, payment_status: 'confirmed', receipt_issued: true } : x))
      setSelectedDonation((prev: any) => (prev && prev.id === donation.id ? { ...prev, payment_status: 'confirmed', receipt_issued: true } : prev))
      return
    }

    if (!donation.duplicateConfirmed) {
      const donorKey22 = donation.donor_email?.trim() || donation.donor_nric || donation.donor_name
      const fiveMinWindow = 5 * 60 * 1000
      const possibleDupe = donations.find(d =>
        d.id !== donation.id &&
        (d.donor_email?.trim() || d.donor_nric || d.donor_name) === donorKey22 &&
        Number(d.amount) === Number(donation.amount) &&
        Math.abs(new Date(d.created_at).getTime() - new Date(donation.created_at).getTime()) <= fiveMinWindow
      )
      if (possibleDupe) {
        setDuplicateDonationWarning({ donation, possibleDupe })
        return
      }
    }

    let autoTaggedCauseId = null
    if (!donation.cause_id && donation.payment_ref) {
      const { data: matchedRecipient } = await supabase
        .from('mass_appeal_recipients')
        .select('appeal_id')
        .eq('payment_ref', donation.payment_ref)
        .maybeSingle()
      if (matchedRecipient) {
        const { data: matchedAppeal } = await supabase
          .from('mass_appeals')
          .select('cause_id, cause_name')
          .eq('id', matchedRecipient.appeal_id)
          .maybeSingle()
        if (matchedAppeal?.cause_id) {
          autoTaggedCauseId = matchedAppeal.cause_id
          showToast(`Auto-tagged to campaign: ${matchedAppeal.cause_name}`)
        }
      }
    }

    const updatePayload: Record<string, any> = { payment_status: 'confirmed', receipt_issued: true }
    if (autoTaggedCauseId) updatePayload.cause_id = autoTaggedCauseId

    const { error } = await supabase.from('donations').update(updatePayload).eq('id', donation.id)
    if (error) { showToast('Error confirming payment', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'payment_confirmed',
      donation_id: donation.id,
      details: { donor_name: donation.donor_name, amount: donation.amount, payment_ref: donation.payment_ref, auto_tagged_cause_id: autoTaggedCauseId },
    })
    setDonations(prev => prev.map(x => x.id === donation.id ? { ...x, payment_status: 'confirmed', receipt_issued: true, ...(autoTaggedCauseId ? { cause_id: autoTaggedCauseId } : {}) } : x))
    setSelectedDonation((prev: any) => (prev && prev.id === donation.id ? { ...prev, payment_status: 'confirmed', receipt_issued: true } : prev))

    const completedPledge = await checkPledgeCompletion(donation)
    if (completedPledge) {
      setPledgeCompletionCandidate({ pledge: completedPledge, donation })
      setShowPledgeThankYouModal(true)
      return
    }

    if (!donation.donor_email) {
      showToast('Payment confirmed and receipt issued')
      return
    }

    showToast('Payment confirmed ✓ — receipt issued. Send the thank-you when ready.')
  }

  async function unconfirmPayment(donation: any) {
    const { error } = await supabase.from('donations').update({ payment_status: 'pending', receipt_issued: false }).eq('id', donation.id)
    if (error) { showToast('Error undoing confirmation', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'payment_unconfirmed',
      donation_id: donation.id,
      details: { donor_name: donation.donor_name, amount: donation.amount },
    })
    setDonations(prev => prev.map(x => x.id === donation.id ? { ...x, payment_status: 'pending', receipt_issued: false } : x))
    setSelectedDonation((prev: any) => (prev && prev.id === donation.id ? { ...prev, payment_status: 'pending', receipt_issued: false } : prev))
    showToast('Payment confirmation undone — back to awaiting confirmation')
  }

  function buildThankYouPreviewHtml(donation: any, customMessage: any) {
    const badgeInfo = donationBadgeInfo[donation.id]
    const isRecurring = !!donation.recurring_gift_id
    const templateType = donation.amount > thankYouThreshold ? 'major_gift'
      : isRecurring ? 'recurring_donor'
      : badgeInfo?.isFirstTime ? 'new_donor'
      : 'standard'
    const amount = Number(donation.amount).toLocaleString()
    // donor_name/cause titles are untrusted — donor_name in particular can come
    // from a public donation form — so everything interpolated into this raw
    // HTML string below must be escaped first. Was previously unescaped: a
    // donor name like `<img src=x onerror=alert(1)>` executed for real inside
    // the unsandboxed preview iframe.
    const safeDonorName = escapeHtml(donation.donor_name)
    const safeCharityName = escapeHtml(charityName)
    const causeTitle = escapeHtml(causeNameForDonation(donation))
    const dateStr = new Date(donation.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })
    const customBlock = customMessage?.trim()
      ? `<p style="font-size:13px;color:${C.text};line-height:1.6;margin:10px 0;">${escapeHtml(customMessage.trim())}</p>`
      : ''
    // Banner headline/subtitle are the charity's own copy, set (or left at their default) in
    // Settings → Email Templates -- nothing about the visible wording here is hardcoded.
    const { banner_title, banner_subtitle } = emailBannerFor(templateType, { donor_name: donation.donor_name, charity_name: charityName, amount, cause_title: causeNameForDonation(donation) })
    const safeBannerTitle = escapeHtml(banner_title)
    const safeBannerSubtitle = escapeHtml(banner_subtitle)

    if (templateType === 'major_gift') {
      return `
        <div style="background:${C.forest};border-radius:12px;padding:22px;text-align:center;margin-bottom:16px;">
          <div style="font-size:28px;margin-bottom:6px;">🌳</div>
          <div style="font-size:17px;font-weight:700;color:white;">${safeBannerTitle}</div>
          ${banner_subtitle ? `<div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:4px;">${safeBannerSubtitle}</div>` : ''}
        </div>
        <div style="background:white;border-radius:12px;padding:16px;border:1px solid ${C.border};">
          ${customBlock}
          <div style="display:flex;justify-content:space-between;margin-top:${customBlock ? '10px' : '0'};font-size:13px;"><span style="color:${C.emailMuted};">Amount</span><span style="font-weight:700;color:${C.emailAccentGreen};">SGD $${amount}</span></div>
          ${causeTitle ? `<div style="display:flex;justify-content:space-between;margin-top:6px;font-size:13px;"><span style="color:${C.emailMuted};">Cause</span><span style="font-weight:700;color:${C.emailAccentGold};">🎯 ${causeTitle}</span></div>` : ''}
        </div>`
    }
    if (templateType === 'new_donor') {
      return `
        <div style="background:${C.forest};border-radius:12px;padding:22px;text-align:center;margin-bottom:16px;">
          <div style="font-size:17px;font-weight:700;color:white;">${safeBannerTitle}</div>
          ${banner_subtitle ? `<div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:4px;">${safeBannerSubtitle}</div>` : ''}
        </div>
        <div style="background:white;border-radius:12px;padding:16px;border:1px solid ${C.border};">
          ${customBlock}
          <div style="display:flex;justify-content:space-between;margin-top:${customBlock ? '10px' : '0'};font-size:13px;"><span style="color:${C.emailMuted};">Amount</span><span style="font-weight:700;color:${C.emailAccentGreen};">SGD $${amount}</span></div>
          ${causeTitle ? `<p style="font-size:13px;color:${C.text};margin-top:10px;">Your gift went toward: <strong style="color:${C.emailAccentGold};">🎯 ${causeTitle}</strong></p>` : ''}
        </div>`
    }
    if (templateType === 'recurring_donor') {
      return `
        <div style="background:${C.forest};border-radius:12px;padding:22px;text-align:center;margin-bottom:16px;">
          <div style="font-size:17px;font-weight:700;color:white;">${safeBannerTitle}</div>
          ${banner_subtitle ? `<div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:4px;">${safeBannerSubtitle}</div>` : ''}
        </div>
        <div style="background:white;border-radius:12px;padding:16px;border:1px solid ${C.border};">
          ${customBlock}
          <div style="display:flex;justify-content:space-between;margin-top:${customBlock ? '10px' : '0'};font-size:13px;"><span style="color:${C.emailMuted};">Amount</span><span style="font-weight:700;color:${C.emailAccentGreen};">SGD $${amount}</span></div>
        </div>`
    }
    return `
      <div style="background:${C.forest};border-radius:12px;padding:22px;text-align:center;margin-bottom:16px;">
        <div style="font-size:17px;font-weight:700;color:white;">${safeBannerTitle}</div>
        ${banner_subtitle ? `<div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:4px;">${safeBannerSubtitle}</div>` : ''}
      </div>
      ${customBlock ? `<div style="background:white;border-radius:12px;padding:14px;border:1px solid ${C.border};margin-bottom:12px;">${customBlock}</div>` : ''}
      <div style="background:white;border-radius:12px;padding:16px;border:1px solid ${C.border};">
        <div style="font-size:11px;color:${C.emailMuted};text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;font-weight:600;">Donation Details</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;"><span style="color:${C.emailMuted};">Charity</span><span style="font-weight:700;color:${C.forest};">${safeCharityName}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;"><span style="color:${C.emailMuted};">Amount</span><span style="font-weight:700;color:${C.emailAccentGreen};">SGD $${amount}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;"><span style="color:${C.emailMuted};">Date</span><span style="font-weight:700;color:${C.forest};">${dateStr}</span></div>
        ${causeTitle ? `<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:13px;"><span style="color:${C.emailMuted};">Cause</span><span style="font-weight:700;color:${C.emailAccentGold};">🎯 ${causeTitle}</span></div>` : ''}
      </div>`
  }

  function thankYouTemplateTypeFor(donation: any) {
    const badgeInfoSend = donationBadgeInfo[donation.id]
    const isRecurringSend = !!donation.recurring_gift_id
    return donation.amount > thankYouThreshold ? 'major_gift'
      : isRecurringSend ? 'recurring_donor'
      : badgeInfoSend?.isFirstTime ? 'new_donor'
      : 'standard'
  }

  function thankYouDefaultsFor(donation: any) {
    const type = thankYouTemplateTypeFor(donation)
    const saved = emailTemplates[type]
    const vars = { donor_name: donation.donor_name, charity_name: charityName, amount: donation.amount, cause_title: causeNameForDonation(donation) }
    return {
      type,
      subject: fillTemplate(saved?.subject || EMAIL_TEMPLATE_DEFAULTS[type].subject, vars),
      body: fillTemplate(saved?.body || EMAIL_TEMPLATE_DEFAULTS[type].body, vars),
    }
  }

  async function sendThankYouEmail(donation: any) {
    if (sendingThankYouId === donation.id) return
    setSendingThankYouId(donation.id)
    let receiptAttachmentB64b = null
    try { receiptAttachmentB64b = getReceiptPDFBase64(donation) } catch (e) { console.error('Could not generate receipt PDF for attachment:', e) }

    const templateTypeSend = thankYouTemplateTypeFor(donation)

    const { error } = await sendCharityEmail({
      donor_name: donation.donor_name,
      donor_email: donation.donor_email,
      charity_name: charityName,
      charity_uen: charityUen,
      amount: donation.amount,
      date: new Date(donation.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' }),
      payment_ref: donation.payment_ref,
      notes: donation.notes,
      cause_title: causeNameForDonation(donation),
      receipt_pdf_base64: receiptAttachmentB64b,
      receipt_filename: `Receipt-${donation.receipt_number || donation.payment_ref || donation.id}.pdf`,
      thank_you_template: templateTypeSend,
      subject_override: thankYouSubjectInput?.trim() || undefined,
      custom_message: thankYouCustomMessage?.trim() || null,
      ...emailBannerFor(templateTypeSend, { donor_name: donation.donor_name, charity_name: charityName, amount: donation.amount, cause_title: causeNameForDonation(donation) }),
    })
    if (error) { showToast('Failed to send email', 'error'); setSendingThankYouId(null); return }
    setThankYouCustomMessage('')
    setThankYouSubjectInput('')
    await supabase.from('donations').update({ thank_you_sent: true }).eq('id', donation.id)
    setDonations(prev => prev.map(x => x.id === donation.id ? { ...x, thank_you_sent: true } : x))
    setSelectedDonation((prev: any) => (prev && prev.id === donation.id ? { ...prev, thank_you_sent: true } : prev))
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'thank_you_email_sent',
      donation_id: donation.id,
      details: { donor_name: donation.donor_name, donor_email: donation.donor_email, amount: donation.amount },
    })
    setSendingThankYouId(null)
    showToast(`Email sent to ${donation.donor_email}`)
  }

  async function issueReceipt(donation: any, skipLog = false, sendEmail = false) {
    setIssuing(donation.id)
    const { error } = await supabase
      .from('donations')
      .update({ receipt_issued: true })
      .eq('id', donation.id)
    if (error) { console.error(error); setIssuing(null); return }
    if (!skipLog) {
      await supabase.from('audit_log').insert({
        actor_type: 'charity',
        actor_email: session.user.email,
        action: 'receipt_issued',
        donation_id: donation.id,
        details: { donor_name: donation.donor_name, amount: donation.amount },
      })
    }
    setDonations(prev => prev.map(d => d.id === donation.id ? { ...d, receipt_issued: true } : d))
    if (sendEmail && donation.donor_email?.trim() && !donation.thank_you_sent) {
      let receiptB64 = null
      try { receiptB64 = getReceiptPDFBase64({ ...donation, receipt_issued: true }) } catch (e) { console.error('Could not generate receipt PDF for attachment:', e) }
      const { error: emailError } = await sendCharityEmail({
        donor_name: donation.donor_name,
        donor_email: donation.donor_email,
        charity_name: charityName,
        charity_uen: charityUen,
        amount: donation.amount,
        date: new Date(donation.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' }),
        payment_ref: donation.payment_ref,
        notes: donation.notes,
        cause_title: causeNameForDonation(donation),
        receipt_pdf_base64: receiptB64,
        receipt_filename: `Receipt-${donation.receipt_number || donation.payment_ref || donation.id}.pdf`,
        ...emailBannerFor('standard', { donor_name: donation.donor_name, charity_name: charityName, amount: donation.amount, cause_title: causeNameForDonation(donation) }),
      })
      if (!emailError) {
        await supabase.from('donations').update({ thank_you_sent: true }).eq('id', donation.id)
        setDonations(prev => prev.map(d => d.id === donation.id ? { ...d, thank_you_sent: true } : d))
      }
    }
    setIssuing(null)
  }

  async function voidAndReissueReceipt(donation: any) {
    if (!voidReason.trim()) { showToast('Please enter a reason for voiding', 'error'); return }
    setVoidingReceipt(true)

    // Step 1 — mark original as voided
    const { error: voidError } = await supabase.from('donations').update({
      receipt_voided: true,
      voided_at: new Date().toISOString(),
      voided_by: session.user.email,
      void_reason: voidReason.trim(),
      receipt_issued: false,
    }).eq('id', donation.id)
    if (voidError) { showToast('Error voiding receipt', 'error'); setVoidingReceipt(false); return }

    // Step 2 — generate new sequential receipt number, claimed atomically in the database
    const entryYear = new Date(donation.created_at).getFullYear()
    const { data: newReceiptNumber, error: countError } = await supabase.rpc('next_receipt_number', { p_charity_uen: charityUen, p_year: entryYear })
    if (countError) { showToast('Error generating new receipt number', 'error'); setVoidingReceipt(false); return }

    // Step 3 — issue new receipt with corrected number
    const { error: reissueError } = await supabase.from('donations').update({
      receipt_issued: true,
      receipt_number: newReceiptNumber,
      reissued_from: donation.receipt_number || donation.payment_ref,
      thank_you_sent: false,
    }).eq('id', donation.id)
    if (reissueError) { showToast('Error reissuing receipt', 'error'); setVoidingReceipt(false); return }

    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'receipt_voided_and_reissued',
      donation_id: donation.id,
      details: {
        donor_name: donation.donor_name,
        old_receipt_number: donation.receipt_number || donation.payment_ref,
        new_receipt_number: newReceiptNumber,
        void_reason: voidReason.trim(),
      },
    })

    setDonations(prev => prev.map(x => x.id === donation.id ? {
      ...x,
      receipt_voided: true,
      receipt_issued: true,
      receipt_number: newReceiptNumber,
      reissued_from: donation.receipt_number || donation.payment_ref,
      thank_you_sent: false,
    } : x))
    setSelectedDonation((prev: any) => prev && prev.id === donation.id ? {
      ...prev,
      receipt_voided: true,
      receipt_issued: true,
      receipt_number: newReceiptNumber,
      reissued_from: donation.receipt_number || donation.payment_ref,
      thank_you_sent: false,
    } : prev)

    setVoidingReceipt(false)
    setShowVoidModal(false)
    setVoidReason('')
    showToast(`Receipt voided ✓ — new receipt issued as ${newReceiptNumber}`)
  }

  async function issueAllReceipts() {
    if (bulkActionInProgress) return
    const yearScoped = filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).toLocaleDateString('en-SG', { year: 'numeric' }) === filterYear)
    const pending = yearScoped.filter(d => !d.receipt_issued && d.payment_status === 'confirmed')
    if (pending.length === 0) {
      const awaitingConfirmation = yearScoped.filter(d => !d.receipt_issued && d.payment_status !== 'confirmed' && d.payment_status !== 'refunded').length
      if (awaitingConfirmation > 0) {
        showToast(`${awaitingConfirmation} donation${awaitingConfirmation > 1 ? 's' : ''} still ${awaitingConfirmation > 1 ? 'need' : 'needs'} payment confirmed first — go to Donations to confirm ${awaitingConfirmation > 1 ? 'them' : 'it'} individually`)
      } else {
        showToast('No receipts pending for ' + filterYear)
      }
      return
    }
    setBulkActionInProgress(true)
    bulkCancelRef.current = false
    setBulkProgress({ done: 0, total: pending.length })
    let issuedCount = 0
    for (const d of pending) {
      if (bulkCancelRef.current) break
      await issueReceipt(d, true)
      issuedCount++
      setBulkProgress({ done: issuedCount, total: pending.length })
    }
    if (issuedCount > 0) {
      await supabase.from('audit_log').insert({
        actor_type: 'charity',
        actor_email: session.user.email,
        action: 'bulk_receipts_issued',
        details: { donation_count: issuedCount, year: filterYear },
      })
    }
    setBulkActionInProgress(false)
    setBulkProgress(null)
    if (bulkCancelRef.current) {
      showToast(`Cancelled — ${issuedCount} of ${pending.length} receipts issued before stopping`)
    } else {
      showToast(`${issuedCount} receipt${issuedCount > 1 ? 's' : ''} issued for ${filterYear}`)
    }
  }

  async function requestAllMissingNric() {
    if (bulkActionInProgress) return
    const yearScoped = filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).toLocaleDateString('en-SG', { year: 'numeric' }) === filterYear)
    const missing = yearScoped.filter(d => !d.donor_nric && d.donor_email?.trim())
    const missingNoEmail = yearScoped.filter(d => !d.donor_nric && !d.donor_email?.trim()).length
    if (missing.length === 0) {
      if (missingNoEmail > 0) {
        showToast(`${missingNoEmail} donation${missingNoEmail > 1 ? 's' : ''} missing NRIC have no email on file either — you'll need to follow up directly`)
      } else {
        showToast(`No donors with email on file are missing NRIC for ${filterYear}`)
      }
      return
    }

    const byDonor: Record<string, any> = {}
    missing.forEach(d => {
      if (!byDonor[d.donor_email]) byDonor[d.donor_email] = { donor_name: d.donor_name, donor_email: d.donor_email, total: 0, count: 0 }
      byDonor[d.donor_email].total += d.amount
      byDonor[d.donor_email].count += 1
    })
    const missingDonorList = Object.values(byDonor)

    setConfirmModal({
      title: 'Send bulk NRIC request?',
      description: `This will email ${missingDonorList.length} donor${missingDonorList.length > 1 ? 's' : ''} missing NRIC.`,
      confirmLabel: 'Send request',
      onConfirm: () => sendBulkNricRequest(missingDonorList, missingNoEmail),
    })
  }

  async function sendBulkNricRequest(donorList: any, missingNoEmail: any) {
    setBulkActionInProgress(true)
    bulkCancelRef.current = false
    setBulkProgress({ done: 0, total: donorList.length })
    let sent = 0
    let processed = 0
    for (const donor of donorList) {
      if (bulkCancelRef.current) break
      try {
        const { error } = await sendCharityEmail({
          donor_name: donor.donor_name,
          donor_email: donor.donor_email,
          charity_name: charityName,
          amount: donor.total,
          date: new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' }),
          request_nric: true,
          ...emailBannerFor('nric_request', { donor_name: donor.donor_name, charity_name: charityName }),
        })
        if (!error) sent++
      } catch (invokeErr) {
        console.error('NRIC request failed for', donor.donor_email, invokeErr)
      }
      processed++
      setBulkProgress({ done: processed, total: donorList.length })
    }
    if (sent > 0) {
      await supabase.from('audit_log').insert({
        actor_type: 'charity',
        actor_email: session.user.email,
        action: 'bulk_nric_requested',
        details: { donor_count: sent },
      })
    }
    setBulkActionInProgress(false)
    setBulkProgress(null)
    if (bulkCancelRef.current) {
      showToast(`Cancelled — sent to ${sent} of ${donorList.length} donors before stopping`)
    } else {
      showToast(`NRIC request sent to ${sent} of ${donorList.length} donors${missingNoEmail > 0 ? ` — ${missingNoEmail} more missing NRIC have no email and need direct follow-up` : ''}`)
    }
  }

  function clearDonationFilters(opts: { keepYear?: boolean } = {}) {
    setSearchTerm('')
    setFilterType('All')  
    setFilterNric('All')
    if (!opts.keepYear) setFilterYear('All')
    setFilterSource('All')
    setFilterThankYou('All')
    setFilterMinAmount(null)
    setDonationFilterLabel(null)
    setDonationSortBy(null)
    setDonationSortDir('desc')
  }


  async function ensureDonorContact(donor: any) {
    const key = donor.email?.trim() || donor.name
    let contact = donorContacts.find(c => (c.email?.trim() || c.full_name) === key)
    if (!contact) {
      const { data, error } = await supabase.from('charity_donor_contacts').insert({
        charity_uen: charityUen,
        full_name: donor.name,
        email: donor.email || null,
        created_by: session.user.email,
      }).select().single()
      if (error) return null
      contact = data
      setDonorContacts(prev => [contact, ...prev])
    }
    return contact
  }

  async function linkDonorToHousehold(donorA: any, donorB: any) {
    const contactA = await ensureDonorContact(donorA)
    const contactB = await ensureDonorContact(donorB)
    if (!contactA || !contactB) { showToast('Error linking donors', 'error'); return }

    const householdId = contactA.household_id || contactB.household_id || crypto.randomUUID()
    await supabase.from('charity_donor_contacts').update({ household_id: householdId }).eq('id', contactA.id)
    await supabase.from('charity_donor_contacts').update({ household_id: householdId }).eq('id', contactB.id)

    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'donor_household_linked',
      details: { donor_a: donorA.name, donor_b: donorB.name, charity_uen: charityUen },
    })
    showToast(`Linked ${donorA.name} and ${donorB.name} as a household ✓`)
    await loadDonorContacts()
  }

  async function unlinkFromHousehold(donor: any) {
    const key = donor.email?.trim() || donor.name
    const contact = donorContacts.find(c => (c.email?.trim() || c.full_name) === key)
    if (!contact) return
    await supabase.from('charity_donor_contacts').update({ household_id: null }).eq('id', contact.id)
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'donor_household_unlinked',
      details: { donor_name: donor.name, charity_uen: charityUen },
    })
    showToast('Removed from household')
    await loadDonorContacts()
  }

  function getDonorWarmth(donor: any) {
    const donorKey76 = donor.email?.trim() || donor.name
    const lastContact76 = donorLastContactMap[donorKey76] || null
    if (!lastContact76) return { level: 'red', label: 'No contact logged', daysSince: null }
    const daysSince76 = Math.floor((new Date().getTime() - new Date(lastContact76).getTime()) / (1000 * 60 * 60 * 24))
    if (daysSince76 <= 90) return { level: 'green', label: `Contacted ${daysSince76}d ago`, daysSince: daysSince76 }
    if (daysSince76 <= 180) return { level: 'amber', label: `Contacted ${daysSince76}d ago`, daysSince: daysSince76 }
    return { level: 'red', label: `Contacted ${daysSince76}d ago`, daysSince: daysSince76 }
  }

  async function mergeDonorInto(sourceDonor: any, targetDonorKey: any) {
    const targetDonorRow = combinedDonorList.find(d => (d.email?.trim() || d.name) === targetDonorKey)
    if (!targetDonorRow) { showToast('Target donor not found', 'error'); return }
    const filter = sourceDonor.email?.trim() ? `donor_email.eq.${sourceDonor.email.trim()}` : `donor_name.eq.${sourceDonor.name}`
    const sourceKey = sourceDonor.email?.trim() || sourceDonor.name
    const targetName = targetDonorRow.name
    const targetEmail = targetDonorRow.email || null

    // Pledges, recurring gifts, notes, and tags aren't linked to a donation by id -- they're
    // matched to a donor purely by donor_name/donor_email (or donor_key for notes/tags). Merging
    // only the donations rows would silently strand these under the old identity, invisible from
    // the merged donor's profile even though the money and history are real. Snapshot everything
    // first so a wrong merge can be fully undone, not just the donations part of it.
    const [
      { data: beforeRows, error: snapshotError },
      { data: beforePledges, error: pledgeSnapshotError },
      { data: beforeRecurring, error: recurringSnapshotError },
      { data: beforeNotes, error: notesSnapshotError },
      { data: beforeTags, error: tagsSnapshotError },
    ] = await Promise.all([
      supabase.from('donations').select('id, donor_name, donor_email').or(filter),
      supabase.from('pledges').select('id, donor_name, donor_email').or(filter),
      supabase.from('recurring_gifts').select('id, donor_name, donor_email').or(filter),
      supabase.from('donor_notes').select('id').eq('donor_key', sourceKey),
      supabase.from('donor_tags').select('id').eq('donor_key', sourceKey),
    ])
    if (snapshotError || pledgeSnapshotError || recurringSnapshotError || notesSnapshotError || tagsSnapshotError) {
      showToast('Error preparing merge', 'error'); return
    }

    const [{ error }, { error: pledgeError }, { error: recurringError }, { error: notesError }, { error: tagsError }] = await Promise.all([
      supabase.from('donations').update({ donor_name: targetName, donor_email: targetEmail }).or(filter),
      supabase.from('pledges').update({ donor_name: targetName, donor_email: targetEmail }).or(filter),
      supabase.from('recurring_gifts').update({ donor_name: targetName, donor_email: targetEmail }).or(filter),
      supabase.from('donor_notes').update({ donor_key: targetDonorKey }).eq('donor_key', sourceKey),
      supabase.from('donor_tags').update({ donor_key: targetDonorKey }).eq('donor_key', sourceKey),
    ])
    if (error || pledgeError || recurringError || notesError || tagsError) { showToast('Error merging donors', 'error'); return }

    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'donors_merged',
      details: {
        merged_from: sourceDonor.name, merged_into: targetDonorRow.name,
        affected_donation_ids: (beforeRows || []).map(r => r.id),
        affected_pledge_ids: (beforePledges || []).map(r => r.id),
        affected_recurring_gift_ids: (beforeRecurring || []).map(r => r.id),
      },
    })

    setSelectedDonor(null)
    await Promise.all([loadDonations(), loadPledges(), loadRecurringGifts(), loadAllDonorTags()])

    let cancelled = false
    setToast({
      msg: `Merged ${sourceDonor.name} into ${targetDonorRow.name} ✓`,
      undoable: true,
      onUndo: async () => {
        cancelled = true
        await Promise.all([
          ...(beforeRows || []).map(row => supabase.from('donations').update({ donor_name: row.donor_name, donor_email: row.donor_email }).eq('id', row.id)),
          ...(beforePledges || []).map(row => supabase.from('pledges').update({ donor_name: row.donor_name, donor_email: row.donor_email }).eq('id', row.id)),
          ...(beforeRecurring || []).map(row => supabase.from('recurring_gifts').update({ donor_name: row.donor_name, donor_email: row.donor_email }).eq('id', row.id)),
          ...(beforeNotes || []).map(row => supabase.from('donor_notes').update({ donor_key: sourceKey }).eq('id', row.id)),
          ...(beforeTags || []).map(row => supabase.from('donor_tags').update({ donor_key: sourceKey }).eq('id', row.id)),
        ])
        await supabase.from('audit_log').insert({
          actor_type: 'charity',
          actor_email: session.user.email,
          action: 'donors_merge_undone',
          details: { merged_from: sourceDonor.name, merged_into: targetDonorRow.name },
        })
        await Promise.all([loadDonations(), loadPledges(), loadRecurringGifts(), loadAllDonorTags()])
        setToast(null)
        showToast('Merge undone ✓')
      },
    })
    setTimeout(() => { if (!cancelled) setToast(null) }, 10000)
  }

  // Match on email, NRIC, or (only when neither is present) exact name. Returns null if no match.
  function findDuplicateDonor(form: any) {
    const enteredEmail = form.donor_email?.trim().toLowerCase()
    const enteredNric = form.donor_nric?.trim().toUpperCase()
    const enteredName = form.donor_name.trim().toLowerCase()

    let matchedDonors = []
    let matchedOn = null

    if (enteredEmail) {
      matchedDonors = donorList.filter(d => d.email?.trim().toLowerCase() === enteredEmail)
      if (matchedDonors.length > 0) matchedOn = 'email'
    }
    if (matchedDonors.length === 0 && enteredNric) {
      matchedDonors = donorList.filter(d => d.nric?.trim().toUpperCase() === enteredNric)
      if (matchedDonors.length > 0) matchedOn = 'NRIC'
    }
    if (matchedDonors.length === 0 && !enteredEmail && !enteredNric) {
      matchedDonors = donorList.filter(d => d.name.trim().toLowerCase() === enteredName)
      if (matchedDonors.length > 0) matchedOn = 'name (exact)'
    }

    return matchedDonors.length > 0 ? { donors: matchedDonors, matchedOn } : null
  }

  async function saveManualEntry(forceDuplicateConfirmed = false) {
  if (!manualForm.is_anonymous && !manualForm.donor_name) { setManualError('Donor name is required'); return }
  if (!manualForm.amount || parseFloat(manualForm.amount) <= 0) { setManualError('Please enter a valid amount'); return }
  if (parseFloat(manualForm.amount) > 1000000) { setManualError('Amount seems too large — please check it (max $1,000,000)'); return }
  if (new Date(manualForm.date) > new Date()) { setManualError('Donation date cannot be in the future'); return }
  if (new Date(manualForm.date) < new Date('2020-01-01')) { setManualError('Donation date seems too far in the past — please check it'); return }
  if (manualForm.donor_nric && !/^[A-Z]\d{7}[A-Z]$/i.test(manualForm.donor_nric.trim())) { setManualError('Invalid NRIC format. Should be like S1234567A'); return }
  if (manualForm.donor_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(manualForm.donor_email.trim())) { setManualError('Invalid email format'); return }

  if (editingDonationId) {
    setSavingManual(true)
    setManualError('')
    const updates = {
      donor_name: manualForm.is_anonymous ? 'Anonymous' : manualForm.donor_name,
      donor_nric: manualForm.is_anonymous ? null : (manualForm.donor_nric ? manualForm.donor_nric.trim().toUpperCase() : manualForm.donor_nric),
      cause_id: manualForm.cause_id || null,
      amount: parseFloat(manualForm.amount),
      payment_method: manualForm.payment_method,
      payment_ref: manualForm.payment_ref?.trim() || null,
      notes: manualForm.notes,
      donor_email: manualForm.is_anonymous ? null : (manualForm.donor_email?.trim().toLowerCase() || null),
      created_at: manualForm.date,
      receipt_name: manualForm.is_anonymous ? null : (manualForm.receipt_name?.trim() || null),
      is_anonymous: manualForm.is_anonymous || false,
      acquisition_source: manualForm.acquisition_source || null,
      acquisition_source_detail: manualForm.acquisition_source_detail?.trim() || null,
      referred_by_donor_key: manualForm.referred_by_donor_key || null,
    }
    const { data, error } = await supabase.from('donations').update(updates).eq('id', editingDonationId).select()
    if (error) {
      console.error('Manual entry update error:', error)
      setManualError(`Error saving: ${error.message}`)
      setSavingManual(false)
      return
    }
    try {
      await supabase.from('audit_log').insert({
        actor_type: 'charity',
        actor_email: session.user.email,
        action: 'donation_edited',
        donation_id: editingDonationId,
        details: { donor_name: updates.donor_name, amount: updates.amount, payment_method: updates.payment_method },
      })
    } catch (auditErr) {
      console.error('Audit log insert failed (non-blocking):', auditErr)
    }
    setDonations(prev => prev.map(d => d.id === editingDonationId ? { ...d, ...data[0] } : d))
    setSelectedDonation((prev: any) => prev && prev.id === editingDonationId ? { ...prev, ...data[0] } : prev)
    resetManualForm()
    setShowManualForm(false)
    setSavingManual(false)
    return
  }

  if (!manualForm.is_anonymous && !manualForm.duplicateConfirmed && !forceDuplicateConfirmed) {
    const dup = findDuplicateDonor(manualForm)
    if (dup) {
      setManualError('')
      setManualDuplicateWarning(dup)
      return
    }
  }

  setSavingManual(true)
  setManualError('')
  setManualDuplicateWarning(null)
    const entryYear = new Date(manualForm.date).getFullYear()
    // Receipt number is claimed atomically in the database (next_receipt_number RPC) so
    // concurrent manual entries can never be handed the same number — no client-side retry needed.
    const { data: receiptNumber, error: seqError } = await supabase.rpc('next_receipt_number', { p_charity_uen: charityUen, p_year: entryYear })
    if (seqError) { console.error('Could not generate receipt number:', seqError); setManualError('Error generating receipt number. Please try again.'); setSavingManual(false); return }
    const { data, error } = await supabase.from('donations').insert([{
      donor_name: manualForm.is_anonymous ? 'Anonymous' : manualForm.donor_name,
      donor_nric: manualForm.is_anonymous ? null : (manualForm.donor_nric ? manualForm.donor_nric.trim().toUpperCase() : manualForm.donor_nric),
      charity_name: charityName,
      charity_uen: charityUen,
      cause_id: manualForm.cause_id || null,
      amount: parseFloat(manualForm.amount),
      status: 'awaiting_donor_confirmation',
      payment_status: 'pending',
      receipt_issued: false,
      source: 'manual',
      payment_method: manualForm.payment_method,
      payment_ref: manualForm.payment_ref?.trim() || null,
      notes: manualForm.notes,
      donor_email: manualForm.is_anonymous ? null : (manualForm.donor_email?.trim().toLowerCase() || null),
      created_at: manualForm.date,
      receipt_number: receiptNumber,
      receipt_name: manualForm.is_anonymous ? null : (manualForm.receipt_name?.trim() || null),
      is_anonymous: manualForm.is_anonymous || false,
      acquisition_source: manualForm.acquisition_source || null,
      acquisition_source_detail: manualForm.acquisition_source_detail?.trim() || null,
      referred_by_donor_key: manualForm.referred_by_donor_key || null,
      created_by: session.user.email,
    }]).select()
    if (error) {
      console.error('Manual entry insert error:', error)
      setManualError(`Error saving: ${error.message}`)
      setSavingManual(false)
      return
    }
    try {
      await supabase.from('audit_log').insert({
        actor_type: 'charity',
        actor_email: session.user.email,
        action: 'manual_entry_created',
        donation_id: data[0].id,
        details: { donor_name: manualForm.donor_name, amount: parseFloat(manualForm.amount), payment_method: manualForm.payment_method },
      })
    } catch (auditErr) {
      console.error('Audit log insert failed (non-blocking):', auditErr)
    }
    setDonations(prev => [{ ...data[0] }, ...prev])
    resetManualForm()
    setShowManualForm(false)
    setSavingManual(false)
  }

  async function generatePayNowEntry(forceDuplicateConfirmed = false) {
    if (!manualForm.is_anonymous && !manualForm.donor_name) { setManualError('Donor name is required'); return }
    if (!manualForm.amount || parseFloat(manualForm.amount) <= 0) { setManualError('Please enter a valid amount'); return }
    if (parseFloat(manualForm.amount) > 1000000) { setManualError('Amount seems too large — please check it (max $1,000,000)'); return }
    if (new Date(manualForm.date) > new Date()) { setManualError('Donation date cannot be in the future'); return }
    if (manualForm.donor_nric && !/^[A-Z]\d{7}[A-Z]$/i.test(manualForm.donor_nric.trim())) { setManualError('Invalid NRIC format. Should be like S1234567A'); return }
    if (manualForm.donor_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(manualForm.donor_email.trim())) { setManualError('Invalid email format'); return }

    if (!manualForm.is_anonymous && !manualForm.duplicateConfirmed && !forceDuplicateConfirmed) {
      const dup = findDuplicateDonor(manualForm)
      if (dup) {
        setManualError('')
        setManualDuplicateWarning(dup)
        return
      }
    }

    setSavingManual(true)
    setManualError('')
    setManualDuplicateWarning(null)
    const ref = 'GT' + Math.random().toString(36).substring(2, 10).toUpperCase()
    const entryYear = new Date(manualForm.date).getFullYear()
    const { data: receiptNumber, error: seqError } = await supabase.rpc('next_receipt_number', { p_charity_uen: charityUen, p_year: entryYear })
    if (seqError) { console.error('Could not generate receipt number:', seqError); setManualError('Error generating receipt number. Please try again.'); setSavingManual(false); return }
    const { data, error } = await supabase.from('donations').insert([{
      donor_name: manualForm.is_anonymous ? 'Anonymous' : manualForm.donor_name,
      donor_nric: manualForm.is_anonymous ? null : (manualForm.donor_nric ? manualForm.donor_nric.trim().toUpperCase() : manualForm.donor_nric),
      charity_name: charityName,
      charity_uen: charityUen,
      cause_id: manualForm.cause_id || null,
      amount: parseFloat(manualForm.amount),
      status: 'confirmed',
      payment_status: 'pending',
      receipt_issued: false,
      source: 'manual',
      payment_method: 'PayNow',
      notes: manualForm.notes,
      donor_email: manualForm.is_anonymous ? null : (manualForm.donor_email?.trim().toLowerCase() || null),
      created_at: manualForm.date,
      payment_ref: ref,
      receipt_number: receiptNumber,
      receipt_name: manualForm.is_anonymous ? null : (manualForm.receipt_name?.trim() || null),
      is_anonymous: manualForm.is_anonymous || false,
      acquisition_source: manualForm.acquisition_source || null,
      acquisition_source_detail: manualForm.acquisition_source_detail?.trim() || null,
      referred_by_donor_key: manualForm.referred_by_donor_key || null,
      created_by: session.user.email,
    }]).select()
    if (error) { setManualError(`Error saving: ${error.message}`); setSavingManual(false); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'manual_entry_created',
      donation_id: data[0].id,
      details: { donor_name: manualForm.donor_name, amount: parseFloat(manualForm.amount), payment_method: 'PayNow' },
    })
    setDonations(prev => [{ ...data[0] }, ...prev])
    setPayNowQrDonation(data[0])
    setShowManualForm(false)
    setSavingManual(false)
  }

  async function confirmManualPayNow() {
    if (!payNowQrDonation || confirmingPayNow) return
    setConfirmingPayNow(true)
    await confirmPaymentFlow(payNowQrDonation)
    setConfirmingPayNow(false)
    setPayNowQrDonation(null)
    resetManualForm()
  }

  async function deleteDonation(id: any) {
    const donationToDelete = donations.find(d => d.id === id)

    const { data: linkRow, error: linkErr } = await supabase
      .from('pledge_donations')
      .select('pledge_id, amount_applied')
      .eq('donation_id', id)
      .maybeSingle()

    if (linkErr) console.error('Error checking pledge link:', linkErr)

    let pledgeLink = null
    if (linkRow) {
      const { data: pledgeRow, error: pledgeErr } = await supabase
        .from('pledges')
        .select('donor_name, status, resolution_notes')
        .eq('id', linkRow.pledge_id)
        .maybeSingle()
      if (pledgeErr) console.error('Error fetching pledge for link warning:', pledgeErr)
      pledgeLink = { ...linkRow, pledgeDonorName: pledgeRow?.donor_name, pledgeStatus: pledgeRow?.status, pledgeResolutionNotes: pledgeRow?.resolution_notes }
    }

    let description = donationToDelete?.receipt_issued
      ? 'This entry already has a receipt issued. The record will be kept for audit purposes but removed from your active lists.'
      : 'The record will be kept for audit purposes but removed from your active lists.'

    if (pledgeLink) {
      description = `⚠ This donation is linked to ${pledgeLink.pledgeDonorName || 'a'}'s pledge ($${Number(pledgeLink.amount_applied).toLocaleString()} applied). Deleting it will unlink it from that pledge and reduce the pledge's given-total accordingly${pledgeLink.pledgeStatus === 'fulfilled' ? '. Since this pledge was marked fulfilled by this donation, it will also revert to pending.' : '.'}`
    }

    if (donationToDelete?.recurring_gift_id) {
      description += ' This payment is linked to a recurring gift — its "last received" date, next expected date, and running total will be rolled back to reflect the deletion.'
    }

    setConfirmModal({
      title: donationToDelete?.receipt_issued ? 'Delete this entry anyway?' : 'Delete this manual entry?',
      description,
      confirmLabel: 'Delete',
      onConfirm: () => deleteDonationConfirmed(id, pledgeLink),
    })
  }

  async function deleteDonationConfirmed(id: any, pledgeLink: any = null) {
    const donationToDelete = donations.find(d => d.id === id)
    const originalStatus = donationToDelete?.status || 'confirmed'
    const originalGiftSnapshot = donationToDelete?.recurring_gift_id
      ? recurringGifts.find(g => g.id === donationToDelete.recurring_gift_id)
      : null
    setDeletingId(id)
    const { error } = await supabase.from('donations').update({ status: 'deleted_by_charity' }).eq('id', id)
    if (error) { console.error(error); setDeletingId(null); return }

    if (pledgeLink) {
      await supabase.from('pledge_donations').delete().eq('pledge_id', pledgeLink.pledge_id).eq('donation_id', id)
      setPledgeGivenTotals(prev => ({
        ...prev,
        [pledgeLink.pledge_id]: Math.max(0, (prev[pledgeLink.pledge_id] || 0) - Number(pledgeLink.amount_applied))
      }))
      setPledgeDonationLinks(prev => ({
        ...prev,
        [pledgeLink.pledge_id]: (prev[pledgeLink.pledge_id] || []).filter((l: any) => l.donation_id !== id)
      }))
      if (pledgeLink.pledgeStatus === 'fulfilled') {
        // fulfilled_donation_id must be cleared alongside status/resolution_notes -- otherwise it's
        // left dangling, still pointing at the donation that was just unlinked/deleted.
        await supabase.from('pledges').update({ status: 'pending', resolution_notes: null, fulfilled_donation_id: null }).eq('id', pledgeLink.pledge_id)
        setPledges(prev => prev.map(p => p.id === pledgeLink.pledge_id ? { ...p, status: 'pending', resolution_notes: null, fulfilled_donation_id: null } : p))
      }
    }

    if (donationToDelete?.recurring_gift_id) {
      const giftId = donationToDelete.recurring_gift_id
      const gift = recurringGifts.find(g => g.id === giftId)
      const remaining = donations.filter(d => d.recurring_gift_id === giftId && d.id !== id && d.status !== 'deleted_by_charity')
      const remainingConfirmed = remaining.filter(d => d.payment_status === 'confirmed').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      const newLastReceived = remainingConfirmed[0]?.created_at ? remainingConfirmed[0].created_at.split('T')[0] : null
      const newNextExpected = gift ? computeNextExpectedDate(gift.start_date, gift.frequency, newLastReceived) : null
      if (gift) {
        await supabase.from('recurring_gifts').update({
          last_received_date: newLastReceived,
          next_expected_date: newNextExpected,
        }).eq('id', giftId)
        setRecurringGifts(prev => prev.map(g => g.id === giftId ? { ...g, last_received_date: newLastReceived, next_expected_date: newNextExpected } : g))
      }
      setRecurringGivenTotals(prev => {
        const cur = prev[giftId]
        if (!cur) return prev
        return { ...prev, [giftId]: { total: Math.max(0, cur.total - Number(donationToDelete.amount)), count: Math.max(0, cur.count - 1) } }
      })
    }

    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'manual_entry_deleted',
      donation_id: id,
      details: { donor_name: donationToDelete?.donor_name, amount: donationToDelete?.amount, unlinked_pledge: pledgeLink?.pledge_id || null },
    })
    setDonations(prev => prev.filter(d => d.id !== id))
    setDeletingId(null)
    setSelectedDonation(null)
  
    // Undo toast for 10 seconds
    let cancelled = false
    setToast({
      msg: 'Entry deleted',
      type: 'error',
      undoable: true,
      onUndo: async () => {
        cancelled = true
        const { error: restoreError } = await supabase.from('donations').update({ status: originalStatus }).eq('id', id)
        if (restoreError) { showToast('Could not restore entry', 'error'); return }

        if (pledgeLink) {
          await supabase.from('pledge_donations').insert({ pledge_id: pledgeLink.pledge_id, donation_id: id, amount_applied: pledgeLink.amount_applied })
          setPledgeGivenTotals(prev => ({
            ...prev,
            [pledgeLink.pledge_id]: (prev[pledgeLink.pledge_id] || 0) + Number(pledgeLink.amount_applied)
          }))
          if (pledgeLink.pledgeStatus === 'fulfilled') {
            await supabase.from('pledges').update({ status: 'fulfilled', resolution_notes: pledgeLink.pledgeResolutionNotes || null, fulfilled_donation_id: id }).eq('id', pledgeLink.pledge_id)
            setPledges(prev => prev.map(p => p.id === pledgeLink.pledge_id ? { ...p, status: 'fulfilled', resolution_notes: pledgeLink.pledgeResolutionNotes || null, fulfilled_donation_id: id } : p))
          }
        }

        if (originalGiftSnapshot) {
          await supabase.from('recurring_gifts').update({
            last_received_date: originalGiftSnapshot.last_received_date,
            next_expected_date: originalGiftSnapshot.next_expected_date,
          }).eq('id', originalGiftSnapshot.id)
          setRecurringGifts(prev => prev.map(g => g.id === originalGiftSnapshot.id ? { ...g, last_received_date: originalGiftSnapshot.last_received_date, next_expected_date: originalGiftSnapshot.next_expected_date } : g))
          setRecurringGivenTotals(prev => {
            const cur = prev[originalGiftSnapshot.id]
            if (!cur) return prev
            return { ...prev, [originalGiftSnapshot.id]: { total: cur.total + Number(donationToDelete.amount), count: cur.count + 1 } }
          })
        }

        const { data: freshData } = await supabase.from('donations').select('*').eq('id', id).single()
        setDonations(prev => [freshData || donationToDelete, ...prev])
        setToast(null)
        showToast('Entry restored ✓')
      }
    })
    setTimeout(() => {
      if (!cancelled) setToast(null)
    }, 10000)
  }

  function causeNameForDonation(donation: any) {
    if (!donation?.cause_id) return null
    const c = myCauses.find(c => c.id === donation.cause_id)
    return c ? c.title : null
  }

  const charityUen   = session?.user?.app_metadata?.charity_uen  || ''

  useEffect(() => {
    if (!selectedDonor || !session?.user?.email) return
    supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'donor_profile_viewed',
      details: { donor_name: selectedDonor.name, donor_email: selectedDonor.email, charity_uen: charityUen },
    }).then()
  }, [selectedDonor?.email || selectedDonor?.name])

  function logExport(reportName: string, details?: any) {
    if (!session?.user?.email) return
    supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'report_exported',
      details: { report: reportName, charity_uen: charityUen, ...details },
    }).then()
  }

  useEffect(() => {
    if (!selectedDonation || !session?.user?.email) return
    supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'donation_viewed',
      details: { donation_id: selectedDonation.id, donor_name: selectedDonation.donor_name, charity_uen: charityUen },
    }).then()
  }, [selectedDonation?.id])

  const totalAllTime = donations.reduce((s, d) => s + d.amount, 0)
  const totalThisYear = filterYear === 'All'
    ? donations.filter(d => d.payment_status === 'confirmed').reduce((s, d) => s + d.amount, 0)
    : donations.filter(d => fyOf(d.created_at) === parseInt(filterYear) && d.payment_status === 'confirmed').reduce((s, d) => s + d.amount, 0)
  const pendingCount = donations.filter(d => !d.receipt_issued && d.payment_status === 'confirmed').length
  const pendingCountForYear = (filterYear === 'All' ? donations : donations.filter(d => fyOf(d.created_at).toString() === filterYear)).filter(d => !d.receipt_issued && d.payment_status === 'confirmed').length
const unconfirmedCountForYear = (filterYear === 'All' ? donations : donations.filter(d => fyOf(d.created_at).toString() === filterYear)).filter(d => d.payment_status !== 'confirmed' && d.payment_status !== 'refunded').length
  const missingNricThisYear = (filterYear === 'All' ? donations : donations.filter(d => fyOf(d.created_at) === parseInt(filterYear)))
    .filter(d => !d.donor_nric && d.payment_status === 'confirmed').length
  const awaitingThankYouCountForYear = (filterYear === 'All' ? donations : donations.filter(d => fyOf(d.created_at).toString() === filterYear))
    .filter(d => d.payment_status === 'confirmed' && !d.thank_you_sent && !d.is_anonymous && d.donor_email?.trim()).length
  const loyalDonorThreshold = 3
  const { donationBadgeInfo, donorBadgeMap } = React.useMemo(
    () => computeDonationBadges(donations, { thankYouThreshold, majorDonorThreshold, loyalDonorThreshold }),
    [donations, thankYouThreshold, majorDonorThreshold]
  )
  const donorList = React.useMemo(() => {
    const donorMap: Record<string, any> = {}
    donations.filter(d => !d.is_anonymous && d.payment_status === 'confirmed').forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!donorMap[key]) {
        donorMap[key] = { name: d.donor_name, email: d.donor_email, nric: d.donor_nric, total: 0, count: 0, lastDate: d.created_at, receipts: 0, deactivated: d.donor_deactivated || false, doNotContact: d.donor_do_not_contact || false, deceased: d.donor_deceased || false }
      }
      if (!donorMap[key].email && d.donor_email) donorMap[key].email = d.donor_email
      if (!donorMap[key].nric && d.donor_nric) donorMap[key].nric = d.donor_nric
      donorMap[key].total += d.amount
      donorMap[key].count += 1
      if (d.receipt_issued) donorMap[key].receipts += 1
      if (d.donor_deactivated) donorMap[key].deactivated = true
      if (d.donor_do_not_contact) donorMap[key].doNotContact = true
      if (d.donor_deceased) donorMap[key].deceased = true
      if (new Date(d.created_at) > new Date(donorMap[key].lastDate)) {
        donorMap[key].lastDate = d.created_at
      }
    })
    return Object.values(donorMap).sort((a, b) => b.total - a.total)
  }, [donations])
  const activeDonorList = React.useMemo(() => donorList.filter(d => !d.deactivated), [donorList])
  const findDonorRecord = React.useCallback((email: any, name: any) => {
    const key = email?.trim() || name
    return donorList.find(d => (d.email?.trim() || d.name) === key) || { name, email, total: 0, count: 0, receipts: 0 }
  }, [donorList])

  const contactOnlyDonors = React.useMemo(() => donorContacts
    .filter(c => {
      const contactKey = c.email?.trim() || c.full_name
      return !activeDonorList.some(d => (d.email?.trim() || d.name) === contactKey)
    })
    .map(c => ({
      id: c.id,
      name: c.full_name,
      email: c.email,
      nric: c.nric,
      total: 0,
      count: 0,
      receipts: 0,
      deactivated: false,
      doNotContact: false,
      deceased: false,
      isContactOnly: true,
      contactNotes: c.notes,
    })), [donorContacts, activeDonorList])

  const combinedDonorList = React.useMemo(() => [...activeDonorList, ...contactOnlyDonors], [activeDonorList, contactOnlyDonors])

  useEffect(() => {
    if (pendingSelectedDonorKey && !selectedDonor && activeDonorList.length > 0) {
      const found = activeDonorList.find(d => (d.email?.trim() || d.name) === pendingSelectedDonorKey)
      if (found) {
        setSelectedDonor(found)
      }
      setPendingSelectedDonorKey(null)
    }
  }, [pendingSelectedDonorKey, activeDonorList, selectedDonor])
  const deactivatedDonorList = donorList.filter(d => d.deactivated)
  const deactivatedOrDncKeys = React.useMemo(() => {
    const s = new Set<string>()
    donorList.forEach(d => { if (d.deactivated || d.doNotContact) s.add(d.email?.trim() || d.name) })
    return s
  }, [donorList])
  const causeRaisedMap = React.useMemo(() => {
    const map: Record<string, any> = {}
    donations.forEach(d => {
      if (!d.cause_id || d.payment_status !== 'confirmed') return
      map[d.cause_id] = (map[d.cause_id] || { total: 0, donors: new Set() })
      map[d.cause_id].total += d.amount
      map[d.cause_id].donors.add(d.donor_email?.trim() || d.donor_nric || d.donor_name)
    })
    return map
  }, [donations])
  const causePerformanceThisYear = React.useMemo(() => {
    const yearScoped = filterYear === 'All' ? donations : donations.filter(d => fyOf(d.created_at) === parseInt(filterYear))
    const map: Record<string, any> = {}
    let generalTotal = 0
    let generalCount = 0
    yearScoped.forEach(d => {
      if (!d.cause_id) { generalTotal += d.amount; generalCount += 1; return }
      if (!map[d.cause_id]) map[d.cause_id] = { total: 0, count: 0, donors: new Set() }
      map[d.cause_id].total += d.amount
      map[d.cause_id].count += 1
      map[d.cause_id].donors.add(d.donor_email?.trim() || d.donor_nric || d.donor_name)
    })
    const rows: any[] = Object.entries(map).map(([causeId, stats]) => {
      const cause = myCauses.find(c => c.id === causeId)
      return {
        id: causeId,
        title: cause?.title || 'Unknown Campaign',
        total: stats.total,
        count: stats.count,
        avg: stats.total / stats.count,
        donors: stats.donors.size,
        cost: cause?.cost || 0,
        target_amount: cause?.target_amount || null,
        end_date: cause?.end_date || null,
        created_at: cause?.created_at || null,
      }
    }).sort((a, b) => a.title.localeCompare(b.title))
    if (generalCount > 0) {
      rows.push({ title: 'General Donation', total: generalTotal, count: generalCount, avg: generalTotal / generalCount, donors: null, isGeneral: true })
    }
    return rows
  }, [donations, filterYear, myCauses, fyOf])

  const confirmedDonations = React.useMemo(() => donations.filter(d => d.payment_status === 'confirmed'), [donations])
  const campaignCauseIds = React.useMemo(() => new Set(myCauses.filter(c => c.type === 'campaign').map(c => c.id)), [myCauses])
  const donorFirstGiftDate = React.useMemo(() => {
    const map: Record<string, any> = {}
    ;[...donations].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!map[key]) map[key] = d.created_at
    })
    return map
  }, [donations])

  const giroMissedCycles = React.useMemo(() => {
    const now26 = new Date()
    // A gift whose bank mandate is still pending approval was never expected to actually
    // deduct yet, so it shouldn't accumulate "missed cycle" alarms before the bank has even
    // authorized the arrangement.
    return recurringGifts.filter(g => g.status === 'active' && g.authorization_status !== 'pending').map(g => {
      const gapDays = g.frequency === 'weekly' ? 7 : g.frequency === 'quarterly' ? 91 : g.frequency === 'annually' ? 365 : 30
      const daysLate = Math.floor((now26.getTime() - new Date(g.next_expected_date).getTime()) / (1000 * 60 * 60 * 24))
      if (daysLate <= 7) return null
      const missedCycles = Math.floor(daysLate / gapDays) + 1
      return { donor_name: g.donor_name, donor_email: g.donor_email, missedCycles, gift_id: g.id, type: g.type }
    }).filter(Boolean)
  }, [recurringGifts])
  const recurringTrendFlags = React.useMemo(() => {
    return recurringGifts.filter(g => g.status === 'active').map(g => {
      const cycles = donations
        .filter(d => d.recurring_gift_id === g.id && d.payment_status === 'confirmed')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      if (cycles.length < recurringTrendCycles) return null
      const lastN = cycles.slice(-recurringTrendCycles).map(d => d.amount)
      const steps = lastN.slice(1).map((amt, i) => amt - lastN[i])
      const allUp = steps.every(s => s > 0)
      const allDown = steps.every(s => s < 0)
      if (allUp || allDown) {
        return { donor_name: g.donor_name, donor_email: g.donor_email, direction: allUp ? 'upgrade' : 'downgrade', from: lastN[0], to: lastN[lastN.length - 1], gift_id: g.id }
      }
      return null
    }).filter(Boolean)
  }, [recurringGifts, donations, recurringTrendCycles])

  const fundraisingSnapshotStats = React.useMemo(() => {
    const yr = filterYear === 'All' ? fyOf(new Date()) : parseInt(filterYear)
    const median = (arr: any) => {
      if (arr.length === 0) return 0
      const sorted = [...arr].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
    }
    const statsForYear = (y: any) => {
      const ds = donations.filter(d => d.payment_status === 'confirmed' && fyOf(d.created_at) === y)
      const total = ds.reduce((s, d) => s + d.amount, 0)
      const donorKeys = new Set(ds.map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name))
      return { total, count: ds.length, donors: donorKeys.size, avgGift: ds.length > 0 ? total / ds.length : 0, medianGift: median(ds.map(d => d.amount)) }
    }
    const cur = statsForYear(yr)
    const prev = statsForYear(yr - 1)
    const delta = (c: any, p: any) => p === 0 ? (c > 0 ? null : 0) : Math.round(((c - p) / p) * 100)
    const tiles = [
      { label: 'Total Raised', val: `$${cur.total.toLocaleString()}`, d: delta(cur.total, prev.total), tip: `Total confirmed donations across all sources — campaigns, mass appeals, and general giving — in ${yr}, compared to ${yr - 1}.` },
      { label: 'Total Donations', val: cur.count, d: delta(cur.count, prev.count), tip: `Number of confirmed donations received across all sources in ${yr}, compared to ${yr - 1}.` },
      { label: 'Unique Donors', val: cur.donors, d: delta(cur.donors, prev.donors), tip: `Distinct donors who gave to any source in ${yr}, compared to ${yr - 1}. A donor giving more than once is only counted once.` },
      { label: 'Avg Gift Size', val: `$${cur.avgGift.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, d: delta(cur.avgGift, prev.avgGift), tip: `Average confirmed donation amount across all sources in ${yr}, compared to ${yr - 1}. Median shown below since a few large gifts can skew the average.`, extra: `median $${cur.medianGift.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
    ]
    return { yr, tiles }
  }, [filterYear, donations, fyOf])

  const revenueTrendStats = React.useMemo(() => {
    const allYearsWithData = [...new Set(donations.filter(d => d.payment_status === 'confirmed').map(d => fyOf(d.created_at)))].sort((a, b) => a - b)
    const trendYears = allYearsWithData.slice(-5)
    if (trendYears.length < 2) return null
    const trendData = trendYears.map(y => ({
      year: y.toString(),
      total: donations.filter(d => d.payment_status === 'confirmed' && fyOf(d.created_at) === y).reduce((s, d) => s + d.amount, 0),
    }))
    const firstYr = trendData[0]
    const lastYr = trendData[trendData.length - 1]
    const cagr = firstYr.total > 0 && trendData.length > 1 ? Math.round((Math.pow(lastYr.total / firstYr.total, 1 / (trendData.length - 1)) - 1) * 100) : null
    return { trendData, firstYr, lastYr, cagr }
  }, [donations, fyOf])

  const revenueByChannelStats = React.useMemo(() => {
    const yr = filterYear === 'All' ? fyOf(new Date()) : parseInt(filterYear)
    const grantYearOf = (g: any) => fyOf(g.start_date || g.created_at)
    const yearDonations = donations.filter(d => d.payment_status === 'confirmed' && fyOf(d.created_at) === yr)

    let campaignsAmt = 0, massAppealAmt = 0, recurringAmt = 0, generalAmt = 0
    yearDonations.forEach(d => {
      if (d.recurring_gift_id) { recurringAmt += d.amount; return }
      if (d.payment_ref && allAppealRecipients.some(r => r.payment_ref === d.payment_ref)) { massAppealAmt += d.amount; return }
      if (d.cause_id && campaignCauseIds.has(d.cause_id)) { campaignsAmt += d.amount; return }
      generalAmt += d.amount
    })
    const grantsAmt = grants.filter(g => grantYearOf(g) === yr).reduce((s, g) => s + Number(g.amount), 0)
    const totalRevenue = campaignsAmt + massAppealAmt + recurringAmt + generalAmt + grantsAmt

    const channelRows = [
      { label: 'Campaigns', amt: campaignsAmt, color: C.bucket1 },
      { label: 'Mass Appeals', amt: massAppealAmt, color: C.gold },
      { label: 'Recurring Gifts', amt: recurringAmt, color: C.red },
      { label: 'Grants', amt: grantsAmt, color: C.forest },
      { label: 'General / Unrestricted', amt: generalAmt, color: C.muted },
    ].filter(r => r.amt > 0).sort((a, b) => b.amt - a.amt).map(r => ({ ...r, pct: totalRevenue > 0 ? Math.round((r.amt / totalRevenue) * 100) : 0, rawPct: totalRevenue > 0 ? (r.amt / totalRevenue) * 100 : 0 }))

    return { yr, channelRows }
  }, [filterYear, donations, allAppealRecipients, campaignCauseIds, grants, fyOf])

  const predictableVsOneOffStats = React.useMemo(() => {
    const yr = filterYear === 'All' ? fyOf(new Date()) : parseInt(filterYear)
    const grantYearOf = (g: any) => fyOf(g.start_date || g.created_at)
    const yearDonations = donations.filter(d => d.payment_status === 'confirmed' && fyOf(d.created_at) === yr)

    let recurringAmt = 0, campaignsAmt = 0, massAppealAmt = 0, generalAmt = 0
    yearDonations.forEach(d => {
      if (d.recurring_gift_id) { recurringAmt += d.amount; return }
      if (d.payment_ref && allAppealRecipients.some(r => r.payment_ref === d.payment_ref)) { massAppealAmt += d.amount; return }
      if (d.cause_id && campaignCauseIds.has(d.cause_id)) { campaignsAmt += d.amount; return }
      generalAmt += d.amount
    })
    const grantsAmt = grants.filter(g => grantYearOf(g) === yr).reduce((s, g) => s + Number(g.amount), 0)
    const totalRevenue = campaignsAmt + massAppealAmt + recurringAmt + generalAmt + grantsAmt

    const pledgeFulfilledIds = new Set(pledges.filter(p => p.status === 'fulfilled' && p.fulfilled_donation_id).map(p => p.fulfilled_donation_id))
    const pledgeFulfilledAmt = yearDonations.filter(d => pledgeFulfilledIds.has(d.id)).reduce((s, d) => s + d.amount, 0)
    const predictableAmt = recurringAmt + grantsAmt + pledgeFulfilledAmt
    const predictablePct = totalRevenue > 0 ? Math.round((predictableAmt / totalRevenue) * 100) : 0
    const oneOffAmt = Math.max(0, totalRevenue - predictableAmt)

    return { yr, totalRevenue, predictablePct, predictableAmt, oneOffAmt }
  }, [filterYear, donations, allAppealRecipients, campaignCauseIds, grants, pledges, fyOf])

  const newDonorAcquisitionStats = React.useMemo(() => {
    const yr = filterYear === 'All' ? fyOf(new Date()) : parseInt(filterYear)
    const { start: fyStart } = fiscalYearBounds(yr, fyEndMonth, fyEndDay)
    const { start: lastFyStart } = fiscalYearBounds(yr - 1, fyEndMonth, fyEndDay)
    const buckets = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(fyStart.getFullYear(), fyStart.getMonth() + i, 1)
      const lastYearD = new Date(lastFyStart.getFullYear(), lastFyStart.getMonth() + i, 1)
      return { year: d.getFullYear(), month: d.getMonth(), lastYearYear: lastYearD.getFullYear(), lastYearMonth: lastYearD.getMonth(), label: d.toLocaleDateString('en-SG', { month: 'short' }), count: 0, lastYearCount: 0 }
    })
    const donorFirstDate: Record<string, any> = {}
    ;[...donations].filter(d => d.payment_status === 'confirmed').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!donorFirstDate[key]) donorFirstDate[key] = d.created_at
    })
    Object.values(donorFirstDate).forEach(dateStr => {
      const dt = new Date(dateStr)
      const bucket = buckets.find(b => b.year === dt.getFullYear() && b.month === dt.getMonth())
      if (bucket) bucket.count++
      const lastYearBucket = buckets.find(b => b.lastYearYear === dt.getFullYear() && b.lastYearMonth === dt.getMonth())
      if (lastYearBucket) lastYearBucket.lastYearCount++
    })
    const newDonorChartData = buckets.map(b => ({ month: b.label, count: b.count, lastYearCount: b.lastYearCount }))
    const totalNew = buckets.reduce((s, b) => s + b.count, 0)
    return { yr, newDonorChartData, totalNew }
  }, [filterYear, donations, fyOf, fyEndMonth, fyEndDay])

  const analyticsGoalStats = React.useMemo(() => {
    const goalYear = fyOf(new Date())
    const totalThisGoalYear = donations.filter(d => fyOf(d.created_at) === goalYear && d.payment_status === 'confirmed').reduce((s, d) => s + d.amount, 0)
    if (!annualGoal) return { goalYear, totalThisGoalYear, hasGoal: false }
    const pct = Math.round((totalThisGoalYear / annualGoal) * 100)
    const { start: yearStart, end: yearEnd } = fiscalYearBounds(goalYear, fyEndMonth, fyEndDay)
    const now5 = new Date()
    const daysElapsed = Math.max(1, Math.ceil((now5.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)))
    const totalDaysInYear = Math.ceil((yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24))
    const dailyRate = totalThisGoalYear / daysElapsed
    const projectedTotal = Math.round(dailyRate * totalDaysInYear)
    const onTrack = projectedTotal >= annualGoal
    const gap = Math.abs(annualGoal - projectedTotal)
    return { goalYear, totalThisGoalYear, hasGoal: true, pct, onTrack, projectedTotal, gap }
  }, [donations, annualGoal, fyOf, fyEndMonth, fyEndDay])

  const campaignSnapshotStats = React.useMemo(() => {
    const yr = filterYear === 'All' ? fyOf(new Date()) : parseInt(filterYear)
    const statsForYear = (y: any) => {
      const ds = donations.filter(d => d.cause_id && campaignCauseIds.has(d.cause_id) && d.payment_status === 'confirmed' && fyOf(d.created_at) === y)
      const total = ds.reduce((s, d) => s + d.amount, 0)
      const donorKeys = new Set(ds.map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name))
      return {
        total,
        count: ds.length,
        donors: donorKeys.size,
        avgGift: ds.length > 0 ? total / ds.length : 0,
        campaignsRun: myCauses.filter(c => c.type === 'campaign' && fyOf(c.created_at) === y).length,
      }
    }
    const cur = statsForYear(yr)
    const prev = statsForYear(yr - 1)
    const delta = (c: any, p: any) => p === 0 ? (c > 0 ? null : 0) : Math.round(((c - p) / p) * 100)
    const orgWideDs = donations.filter(d => d.payment_status === 'confirmed' && fyOf(d.created_at) === yr)
    const orgWideAvgGift = orgWideDs.length > 0 ? orgWideDs.reduce((s, d) => s + d.amount, 0) / orgWideDs.length : 0
    const giftDiff = Math.round(cur.avgGift - orgWideAvgGift)
    const tiles = [
      { label: 'Total Raised', val: `$${cur.total.toLocaleString()}`, d: delta(cur.total, prev.total), tip: `Total confirmed donations tagged to a campaign in ${yr}, compared to ${yr - 1}. Excludes grants, mass appeals, and other donations not tied to a campaign.` },
      { label: 'Campaigns Run', val: cur.campaignsRun, d: delta(cur.campaignsRun, prev.campaignsRun), tip: `Number of campaigns launched in ${yr}, compared to ${yr - 1}. Includes campaigns that received no donations.` },
      { label: 'Unique Donors', val: cur.donors, d: delta(cur.donors, prev.donors), tip: `Distinct donors who gave to any campaign in ${yr}, compared to ${yr - 1}. A donor giving to multiple campaigns is only counted once.` },
      { label: 'Avg Gift Size', val: `$${cur.avgGift.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, d: delta(cur.avgGift, prev.avgGift), tip: `Average confirmed campaign donation amount in ${yr}, compared to ${yr - 1}.`, extra: orgWideDs.length > 0 ? `$${Math.abs(giftDiff).toLocaleString()} ${giftDiff >= 0 ? 'above' : 'below'} your org-wide avg` : null },
    ]
    return { yr, tiles }
  }, [filterYear, donations, campaignCauseIds, myCauses, fyOf])

  const campaignGoalStrip = React.useMemo(() => {
    const yr = filterYear === 'All' ? fyOf(new Date()) : parseInt(filterYear)

    const statsForYear = (y: any) => {
      const campaignsForYear = myCauses.filter(c => c.type === 'campaign' && fyOf(c.created_at) === y)
      const withGoal = campaignsForYear.filter(c => c.target_amount && c.end_date)
      const reachedGoalCampaigns = withGoal.filter(c => (causeRaisedMap[c.id]?.total || 0) >= Number(c.target_amount))
      const successRatePct = withGoal.length > 0 ? Math.round((reachedGoalCampaigns.length / withGoal.length) * 100) : null

      const yearScopedCampaignDonations = donations.filter(d => d.payment_status === 'confirmed' && d.cause_id && campaignCauseIds.has(d.cause_id) && fyOf(d.created_at) === y)
      const donorCampaignSets: Record<string, any> = {}
      yearScopedCampaignDonations.forEach(d => {
        const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
        if (!donorCampaignSets[key]) donorCampaignSets[key] = new Set()
        donorCampaignSets[key].add(d.cause_id)
      })
      const donorKeysWithCampaign = Object.keys(donorCampaignSets)
      const loyalDonors = Object.values(donorCampaignSets).filter(set => set.size >= 2).length
      // With only one campaign ever run, no donor can possibly have given to 2+ campaigns --
      // the metric would always read 0%, which looks like a performance problem rather than
      // "not enough campaigns exist yet to measure this."
      const totalCampaignsEver = myCauses.filter(c => c.type === 'campaign').length
      const loyaltyPct = totalCampaignsEver < 2 ? null : donorKeysWithCampaign.length > 0 ? Math.round((loyalDonors / donorKeysWithCampaign.length) * 100) : null

      const timesToGoal = reachedGoalCampaigns.map(c => {
        const campDonationsSorted = donations.filter(d => d.cause_id === c.id && d.payment_status === 'confirmed').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        let running = 0, crossDate = null
        for (const d of campDonationsSorted) {
          running += d.amount
          if (running >= Number(c.target_amount)) { crossDate = d.created_at; break }
        }
        return crossDate ? Math.round((new Date(crossDate).getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24)) : null
      }).filter(d => d !== null)
      const avgTimeToGoal = timesToGoal.length > 0 ? Math.round(timesToGoal.reduce((s, d) => s + d, 0) / timesToGoal.length) : null

      return { withGoalCount: withGoal.length, reachedCount: reachedGoalCampaigns.length, successRatePct, donorCount: donorKeysWithCampaign.length, loyaltyPct, avgTimeToGoal }
    }

    const cur = statsForYear(yr)
    const prev = statsForYear(yr - 1)
    const ptDelta = (c: any, p: any) => (c === null || p === null) ? null : c - p
    const dayDelta = (c: any, p: any) => (c === null || p === null) ? null : c - p

    const strip = [
      { label: 'Goal Success Rate', val: cur.withGoalCount > 0 ? `${cur.reachedCount} of ${cur.withGoalCount}` : '—', sub: 'campaigns with a goal hit it', tip: 'Of campaigns with both a target amount and an end date, how many reached their target.', d: ptDelta(cur.successRatePct, prev.successRatePct), unit: 'pt' },
      { label: 'Cross-Campaign Loyalty', val: cur.loyaltyPct === null ? 'N/A' : `${cur.loyaltyPct}%`, sub: cur.loyaltyPct === null ? 'needs 2+ campaigns to measure' : 'of donors gave to 2+ campaigns', tip: `Share of this year's campaign donors who supported more than one campaign, out of ${cur.donorCount} donor${cur.donorCount !== 1 ? 's' : ''}. Needs at least 2 campaigns to ever have run before this is measurable.`, d: ptDelta(cur.loyaltyPct, prev.loyaltyPct), unit: 'pt' },
      { label: 'Avg Time to Goal', val: cur.avgTimeToGoal !== null ? `${cur.avgTimeToGoal}d` : '—', sub: 'for campaigns that reached target', tip: 'Average days from a campaign starting to the donation that pushed it past its goal, across campaigns that reached target.', d: dayDelta(cur.avgTimeToGoal, prev.avgTimeToGoal), unit: 'd', invert: true },
    ]

    return { yr, strip }
  }, [filterYear, myCauses, causeRaisedMap, donations, campaignCauseIds, fyOf])

  const campaignLeaderboardStats = React.useMemo(() => {
    const today = new Date()
    const campaignsForLeaderboardYear = myCauses.filter(c => c.type === 'campaign' && (filterYear === 'All' || fyOf(c.created_at) === parseInt(filterYear)))
    const donatedRows = causePerformanceThisYear.filter(r => !r.isGeneral)
    const donatedIds = new Set(donatedRows.map(r => r.id))
    const zeroRows = campaignsForLeaderboardYear.filter(c => !donatedIds.has(c.id)).map(c => ({
      id: c.id, title: c.title, total: 0, count: 0, avg: 0, donors: 0,
      cost: c.cost || 0, target_amount: c.target_amount || null, end_date: c.end_date || null, created_at: c.created_at || null,
    }))
    const campaignRows = [...donatedRows, ...zeroRows].map(row => {
      const hasGoal = row.target_amount && row.end_date
      let pctToGoal = null, pctElapsed = null, daysToEnd = null, goalReached = false, behind = false, slightlyBehind = false
      if (hasGoal) {
        const start = new Date(row.created_at)
        const end = new Date(row.end_date)
        pctToGoal = Math.round((row.total / Number(row.target_amount)) * 100)
        const totalSpan = end.getTime() - start.getTime()
        pctElapsed = totalSpan > 0 ? Math.min(100, Math.max(0, Math.round(((today.getTime() - start.getTime()) / totalSpan) * 100))) : null
        daysToEnd = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        goalReached = row.total >= Number(row.target_amount)
        const gap = pctElapsed !== null ? pctElapsed - pctToGoal : null
        behind = !goalReached && gap !== null && gap >= 20
        slightlyBehind = !goalReached && gap !== null && gap >= 8 && gap < 20
      }
      const isEnded = row.end_date ? new Date(row.end_date) < today : false
      const campDonations = donations.filter(d => d.cause_id === row.id && d.payment_status === 'confirmed').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      const daysSinceLastGift = campDonations.length > 0
        ? Math.floor((today.getTime() - new Date(campDonations[0].created_at).getTime()) / (1000 * 60 * 60 * 24))
        : (row.created_at ? Math.floor((today.getTime() - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24)) : null)
      const isStalled = !isEnded && daysSinceLastGift !== null && daysSinceLastGift >= 14
      return { ...row, hasGoal, pctToGoal, pctElapsed, daysToEnd, isStalled, goalReached, behind, slightlyBehind }
    }).sort((a, b) => b.total - a.total)

    const endingSoon = campaignRows.filter(r => r.hasGoal && r.daysToEnd !== null && r.daysToEnd >= 0 && r.daysToEnd <= 7).sort((a, b) => a.daysToEnd - b.daysToEnd)

    const yearScopedDonations = filterYear === 'All' ? donations : donations.filter(d => fyOf(d.created_at) === parseInt(filterYear))
    const scopedCampaigns = myCauses.filter(c => c.type === 'campaign' && yearScopedDonations.some(d => d.cause_id === c.id && d.payment_status === 'confirmed'))
    const donorGrowthRows = scopedCampaigns.map(c => {
      const campDonations = yearScopedDonations.filter(d => d.cause_id === c.id && d.payment_status === 'confirmed')
      const donorKeys = new Set(campDonations.map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name))
      let brandNewCount = 0
      donorKeys.forEach(key => {
        const firstGiftToCampaign = campDonations.filter(d => (d.donor_email?.trim() || d.donor_nric || d.donor_name) === key).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]
        if (donorFirstGiftDate[key] === firstGiftToCampaign.created_at) brandNewCount++
      })
      const total = campDonations.reduce((s, d) => s + d.amount, 0)
      const newPct = donorKeys.size > 0 ? Math.round((brandNewCount / donorKeys.size) * 100) : 0
      const appealTotal = campDonations.filter(d => d.payment_ref && allAppealRecipients.some(r => r.payment_ref === d.payment_ref)).reduce((s, d) => s + d.amount, 0)
      const referralTotal = campDonations.filter(d => d.acquisition_source === 'referral').reduce((s, d) => s + d.amount, 0)
      const organicTotal = total - appealTotal - referralTotal
      return {
        title: c.title, newCount: brandNewCount, existingCount: donorKeys.size - brandNewCount, newPct, total,
        avgPerDonor: donorKeys.size > 0 ? total / donorKeys.size : 0,
        organicTotal, appealTotal, referralTotal,
        organicPct: total > 0 ? Math.round((organicTotal / total) * 100) : 0,
        appealPct: total > 0 ? Math.round((appealTotal / total) * 100) : 0,
        referralPct: total > 0 ? Math.round((referralTotal / total) * 100) : 0,
        hasAppeal: appealTotal > 0,
      }
    }).sort((a, b) => b.total - a.total)

    const allYearsWithCampaignData = [...new Set(donations.filter(d => d.payment_status === 'confirmed' && d.cause_id && campaignCauseIds.has(d.cause_id)).map(d => fyOf(d.created_at)))].sort((a, b) => a - b)
    const trendYears = allYearsWithCampaignData.slice(-5)
    const trendData = trendYears.map(y => {
      const ds = donations.filter(d => d.payment_status === 'confirmed' && d.cause_id && campaignCauseIds.has(d.cause_id) && fyOf(d.created_at) === y)
      const total = ds.reduce((s, d) => s + d.amount, 0)
      const campaignsThatYear = new Set(ds.map(d => d.cause_id)).size
      return { year: y.toString(), avgPerCampaign: campaignsThatYear > 0 ? Math.round(total / campaignsThatYear) : 0, campaignsThatYear }
    })

    let donorGrowthAgg = null
    if (donorGrowthRows.length > 0) {
      const aggOrganic = donorGrowthRows.reduce((s, r) => s + r.organicTotal, 0)
      const aggAppeal = donorGrowthRows.reduce((s, r) => s + r.appealTotal, 0)
      const aggReferral = donorGrowthRows.reduce((s, r) => s + r.referralTotal, 0)
      const aggTotal = aggOrganic + aggAppeal + aggReferral
      const aggOrganicPct = aggTotal > 0 ? Math.round((aggOrganic / aggTotal) * 100) : 0
      const aggAppealPct = aggTotal > 0 ? Math.round((aggAppeal / aggTotal) * 100) : 0
      const aggReferralPct = aggTotal > 0 ? Math.round((aggReferral / aggTotal) * 100) : 0
      const aggOrganicRawPct = aggTotal > 0 ? (aggOrganic / aggTotal) * 100 : 0
      const aggAppealRawPct = aggTotal > 0 ? (aggAppeal / aggTotal) * 100 : 0
      const aggReferralRawPct = aggTotal > 0 ? (aggReferral / aggTotal) * 100 : 0

      const appealReliant = donorGrowthRows.filter(r => r.appealPct >= 40).sort((a, b) => b.appealPct - a.appealPct)
      const standoutOrganic = donorGrowthRows.filter(r => r.appealPct < 40 && r.newPct === 100 && r.organicPct === 100)
      const stagnant = donorGrowthRows.filter(r => r.appealPct < 40 && r.newPct === 0)
      const flaggedTitles = new Set([...appealReliant, ...standoutOrganic, ...stagnant].map(r => r.title))
      const restCount = donorGrowthRows.filter(r => !flaggedTitles.has(r.title)).length
      donorGrowthAgg = { aggTotal, aggOrganicPct, aggAppealPct, aggReferralPct, aggOrganicRawPct, aggAppealRawPct, aggReferralRawPct, appealReliant, standoutOrganic, stagnant, restCount }
    }

    return { endingSoon, campaignRows, trendData, donorGrowthRows, donorGrowthAgg }
  }, [filterYear, myCauses, causePerformanceThisYear, donations, donorFirstGiftDate, allAppealRecipients, campaignCauseIds, fyOf])

  const appealSnapshotStats = React.useMemo(() => {
    const yr = filterYear === 'All' ? fyOf(new Date()) : parseInt(filterYear)
    const statsForYear = (y: any) => {
      const appealsY = massAppeals.filter(a => fyOf(a.created_at) === y)
      const appealIds = new Set(appealsY.map(a => a.id))
      const recipients = allAppealRecipients.filter(r => appealIds.has(r.appeal_id) && r.status === 'sent')
      const converted = recipients.filter(r => donations.some(d => d.payment_ref && d.payment_ref === r.payment_ref && d.payment_status === 'confirmed'))
      const raised = converted.reduce((s, r) => {
        const donation = donations.find(d => d.payment_ref === r.payment_ref && d.payment_status === 'confirmed')
        return s + (donation ? Number(donation.amount) : 0)
      }, 0)
      return {
        appealsSent: appealsY.length,
        recipients: recipients.length,
        raised,
        conversionRate: recipients.length > 0 ? Math.round((converted.length / recipients.length) * 100) : 0,
      }
    }
    const cur = statsForYear(yr)
    const prev = statsForYear(yr - 1)
    const delta = (c: any, p: any) => p === 0 ? (c > 0 ? null : 0) : Math.round(((c - p) / p) * 100)
    const tiles = [
      { label: 'Total Raised from Appeals', val: `$${cur.raised.toLocaleString()}`, d: delta(cur.raised, prev.raised), tip: `Total confirmed donations traced back to a mass appeal by PayNow reference, in ${yr} compared to ${yr - 1}.` },
      { label: 'Appeals Sent', val: cur.appealsSent, d: delta(cur.appealsSent, prev.appealsSent), tip: `Number of mass appeals sent out in ${yr}, compared to ${yr - 1}.` },
      { label: 'Recipients Reached', val: cur.recipients, d: delta(cur.recipients, prev.recipients), tip: `Total number of successful sends across all mass appeals in ${yr}, compared to ${yr - 1}. Counts each send, so a donor reached by multiple appeals is counted more than once.` },
      { label: 'Conversion Rate', val: `${cur.conversionRate}%`, d: delta(cur.conversionRate, prev.conversionRate), tip: `Share of appeal recipients who went on to make a confirmed donation using the appeal's QR code, in ${yr} compared to ${yr - 1}.` },
    ]
    return { yr, tiles }
  }, [filterYear, massAppeals, allAppealRecipients, donations, fyOf])

  const appealListStrip = React.useMemo(() => {
    const yr = filterYear === 'All' ? fyOf(new Date()) : parseInt(filterYear)
    const appealIdsInYear = (y: any) => new Set(massAppeals.filter(a => fyOf(a.created_at) === y).map(a => a.id))
    const donorKey = (r: any) => r.donor_email?.trim() || r.donor_name

    const curIds = appealIdsInYear(yr)
    const prevIds = appealIdsInYear(yr - 1)
    const curRecipients = allAppealRecipients.filter(r => curIds.has(r.appeal_id))
    const prevRecipients = allAppealRecipients.filter(r => prevIds.has(r.appeal_id))
    const curUnique = new Set(curRecipients.map(donorKey)).size
    const prevUnique = new Set(prevRecipients.map(donorKey)).size
    const uniqueDelta = prevUnique === 0 ? (curUnique > 0 ? null : 0) : Math.round(((curUnique - prevUnique) / prevUnique) * 100)

    const donorFirstAppealYear: Record<string, any> = {}
    ;[...allAppealRecipients].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).forEach(r => {
      const key = donorKey(r)
      if (!donorFirstAppealYear[key]) donorFirstAppealYear[key] = fyOf(r.created_at)
    })
    const newToListCount = Object.values(donorFirstAppealYear).filter(y => y === yr).length

    const yearAppealIds = curIds
    const sentRecipientsYr = allAppealRecipients.filter(r => yearAppealIds.has(r.appeal_id) && r.status === 'sent')
    const convertedYr = sentRecipientsYr.filter(r => donations.some(d => d.payment_ref && d.payment_ref === r.payment_ref && d.payment_status === 'confirmed'))
    const appealGiftTotal = convertedYr.reduce((s, r) => {
      const donation = donations.find(d => d.payment_ref === r.payment_ref && d.payment_status === 'confirmed')
      return s + (donation ? Number(donation.amount) : 0)
    }, 0)
    const appealAvgGift = convertedYr.length > 0 ? appealGiftTotal / convertedYr.length : 0
    const orgWideDs = donations.filter(d => d.payment_status === 'confirmed' && fyOf(d.created_at) === yr)
    const orgWideAvgGift = orgWideDs.length > 0 ? orgWideDs.reduce((s, d) => s + d.amount, 0) / orgWideDs.length : 0
    const giftDiff = Math.round(appealAvgGift - orgWideAvgGift)

    const strip = [
      { label: 'Unique Donors on List', val: curUnique, d: uniqueDelta, tip: `Distinct donors targeted by any mass appeal sent in ${yr}, compared to ${yr - 1}.` },
      { label: 'New to List This Year', val: newToListCount, sub: `first appeared on an appeal in ${yr}`, tip: `Donors whose earliest appearance on any mass appeal, across all years, falls in ${yr}.` },
      { label: 'Appeal Gift Size', val: `$${appealAvgGift.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, sub: orgWideDs.length > 0 ? `$${Math.abs(giftDiff).toLocaleString()} ${giftDiff >= 0 ? 'above' : 'below'} your org-wide avg` : null, tip: `Average confirmed donation amount among appeal recipients who converted in ${yr}, compared to your org-wide average gift.` },
    ]

    return { yr, strip }
  }, [filterYear, massAppeals, allAppealRecipients, donations, fyOf])

  const appealTrendStats = React.useMemo(() => {
    const appealIdsInYear = (y: any) => new Set(massAppeals.filter(a => fyOf(a.created_at) === y).map(a => a.id))
    const statsForYear = (y: any) => {
      const ids = appealIdsInYear(y)
      const sent = allAppealRecipients.filter(r => ids.has(r.appeal_id) && r.status === 'sent')
      const converted = sent.filter(r => donations.some(d => d.payment_ref && d.payment_ref === r.payment_ref && d.payment_status === 'confirmed'))
      const raised = converted.reduce((s, r) => {
        const donation = donations.find(d => d.payment_ref === r.payment_ref && d.payment_status === 'confirmed')
        return s + (donation ? Number(donation.amount) : 0)
      }, 0)
      return { raised, conversionRate: sent.length > 0 ? Math.round((converted.length / sent.length) * 100) : null }
    }
    const allYearsWithAppeals = [...new Set(massAppeals.map(a => fyOf(a.created_at)))].sort((a, b) => a - b)
    const trendYears = allYearsWithAppeals.slice(-5)
    const trendData = trendYears.map(y => ({ year: y.toString(), ...statsForYear(y) }))

    const yr = filterYear === 'All' ? fyOf(new Date()) : parseInt(filterYear)
    const yearIds = appealIdsInYear(yr)
    const sentThisYear = allAppealRecipients.filter(r => yearIds.has(r.appeal_id) && r.status === 'sent')
    const responseTimes = sentThisYear.map(r => {
      const donation = donations.find(d => d.payment_ref === r.payment_ref && d.payment_status === 'confirmed')
      if (!donation) return null
      return Math.floor((new Date(donation.created_at).getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24))
    }).filter(d => d !== null && d >= 0)
    const medianResponseDays = (() => {
      if (responseTimes.length === 0) return null
      const sorted = [...responseTimes].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid]
    })()
    const within24h = responseTimes.filter(d => d < 1).length
    const within7d = responseTimes.filter(d => d >= 1 && d <= 7).length
    const after7d = responseTimes.filter(d => d > 7).length
    const respTotal = responseTimes.length
    const respBuckets = [
      { label: 'Within 24 hours', count: within24h, color: C.sage },
      { label: '1–7 days', count: within7d, color: C.gold },
      { label: '8+ days', count: after7d, color: C.muted },
    ]

    return { trendData, yr, medianResponseDays, respBuckets, respTotal, within24h, within7d }
  }, [filterYear, massAppeals, allAppealRecipients, donations, fyOf])

  const appealConversionStats = React.useMemo(() => {
    const yearNum = filterYear === 'All' ? fyOf(new Date()) : parseInt(filterYear)
    const scopedAppeals = massAppeals.filter(a => fyOf(a.created_at) === yearNum)
    const lastYearAppeals = massAppeals.filter(a => fyOf(a.created_at) === yearNum - 1)

    const recipientsForAppeal = (appealId: any) => allAppealRecipients.filter(r => r.appeal_id === appealId)

    const analyzeAppeal = (appeal: any) => {
      const recipients = recipientsForAppeal(appeal.id)
      const sentRecipients = recipients.filter(r => r.status === 'sent')
      const converted = sentRecipients.filter(r => donations.some(d => d.payment_ref && d.payment_ref === r.payment_ref && d.payment_status === 'confirmed'))
      const raised = converted.reduce((s, r) => {
        const donation = donations.find(d => d.payment_ref === r.payment_ref && d.payment_status === 'confirmed')
        return s + (donation ? Number(donation.amount) : 0)
      }, 0)
      const conversionRate = sentRecipients.length > 0 ? Math.round((converted.length / sentRecipients.length) * 100) : 0
      return { appeal, sentCount: sentRecipients.length, convertedCount: converted.length, raised, conversionRate }
    }

    const scopedAnalyzed = scopedAppeals.map(analyzeAppeal)
    const totalRaised = scopedAnalyzed.reduce((s, a) => s + a.raised, 0)
    const totalSent = scopedAnalyzed.reduce((s, a) => s + a.sentCount, 0)
    const totalConverted = scopedAnalyzed.reduce((s, a) => s + a.convertedCount, 0)
    const overallConversion = totalSent > 0 ? Math.round((totalConverted / totalSent) * 100) : 0

    const lastYearAnalyzed = lastYearAppeals.map(analyzeAppeal)
    const lastYearSent = lastYearAnalyzed.reduce((s, a) => s + a.sentCount, 0)
    const lastYearConverted = lastYearAnalyzed.reduce((s, a) => s + a.convertedCount, 0)
    const lastYearRaised = lastYearAnalyzed.reduce((s, a) => s + a.raised, 0)
    const lastYearConversion = lastYearSent > 0 ? Math.round((lastYearConverted / lastYearSent) * 100) : null
    const conversionDiff = lastYearConversion !== null ? overallConversion - lastYearConversion : null
    const appealCountDiff = scopedAppeals.length - lastYearAppeals.length

    const causeSpecific = scopedAnalyzed.filter(a => a.appeal.cause_id)
    const generalOnes = scopedAnalyzed.filter(a => !a.appeal.cause_id)
    const avgConversion = (list: any) => {
      const withSends = list.filter((a: any) => a.sentCount > 0)
      if (withSends.length === 0) return null
      return Math.round(withSends.reduce((s: any, a: any) => s + a.conversionRate, 0) / withSends.length)
    }
    const causeSpecificAvg = avgConversion(causeSpecific)
    const generalAvg = avgConversion(generalOnes)

    const distinctAmounts = [...new Set(scopedAnalyzed.filter(a => a.sentCount > 0).map(a => Number(a.appeal.amount)))]

    return { yearNum, scopedAppeals, lastYearAppeals, scopedAnalyzed, totalRaised, overallConversion, appealCountDiff, conversionDiff, lastYearRaised, lastYearConversion, causeSpecificAvg, generalAvg, distinctAmounts }
  }, [filterYear, massAppeals, allAppealRecipients, donations, fyOf])

  const appealListHealthStats = React.useMemo(() => {
    const yr = filterYear === 'All' ? fyOf(new Date()) : parseInt(filterYear)
    const appealIdsInYear = (y: any) => new Set(massAppeals.filter(a => fyOf(a.created_at) === y).map(a => a.id))
    const deliveryStatsForYear = (y: any) => {
      const ids = appealIdsInYear(y)
      const attempted = allAppealRecipients.filter(r => ids.has(r.appeal_id) && (r.status === 'sent' || r.status === 'failed' || r.status === 'blocked'))
      const bounced = attempted.filter(r => r.status === 'failed')
      const blocked = attempted.filter(r => r.status === 'blocked')
      return {
        total: attempted.length,
        bouncedPct: attempted.length > 0 ? Math.round((bounced.length / attempted.length) * 100) : 0,
        blockedPct: attempted.length > 0 ? Math.round((blocked.length / attempted.length) * 100) : 0,
        bouncedCount: bounced.length,
        blockedCount: blocked.length,
      }
    }
    const curDelivery = deliveryStatsForYear(yr)
    const prevDelivery = deliveryStatsForYear(yr - 1)

    const bounceReasons = (() => {
      const ids = appealIdsInYear(yr)
      const bounced = allAppealRecipients.filter(r => ids.has(r.appeal_id) && r.status === 'failed')
      const counts: Record<string, any> = {}
      bounced.forEach(r => {
        const reason = r.error_message?.trim() || 'Unknown error'
        counts[reason] = (counts[reason] || 0) + 1
      })
      return Object.entries(counts).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count)
    })()

    const byDonor: Record<string, any> = {}
    allAppealRecipients.forEach(r => {
      const key = r.donor_email?.trim() || r.donor_name
      if (!byDonor[key]) byDonor[key] = { name: r.donor_name, email: r.donor_email, recipientRows: [] }
      byDonor[key].recipientRows.push(r)
    })
    const repeatRecipients = Object.values(byDonor).filter(d => d.recipientRows.length >= 2)

    const fatigueList = repeatRecipients.map(d => {
      const sorted = [...d.recipientRows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      const gaveFlags = sorted.map(r => donations.some(don => don.payment_ref === r.payment_ref && don.payment_status === 'confirmed'))
      const gaveCount = gaveFlags.filter(Boolean).length
      const lastGave = gaveFlags[gaveFlags.length - 1]
      const isFatigued = gaveFlags.length >= 2 && gaveFlags.slice(0, -1).some(Boolean) && !lastGave
      return { name: d.name, email: d.email, totalAppeals: sorted.length, gaveCount, isFatigued }
    }).sort((a, b) => (b.isFatigued ? 1 : 0) - (a.isFatigued ? 1 : 0))

    const overGivers = allAppealRecipients.filter(r => {
      const donation = donations.find(d => d.payment_ref === r.payment_ref && d.payment_status === 'confirmed')
      return donation && Number(donation.amount) > Number(r.amount) * 1.5
    }).map(r => ({
      name: r.donor_name,
      email: r.donor_email,
      asked: Number(r.amount),
      gave: Number(donations.find(d => d.payment_ref === r.payment_ref).amount)
    }))

    const fatiguedCount = fatigueList.filter(d => d.isFatigued).length

    return { yr, curDelivery, prevDelivery, bounceReasons, repeatRecipients, fatigueList, overGivers, fatiguedCount }
  }, [filterYear, massAppeals, allAppealRecipients, donations, fyOf])

  const pledgeSnapshotStats = React.useMemo(() => {
    const yr = filterYear === 'All' ? fyOf(new Date()) : parseInt(filterYear)
    const statsForYear = (y: any) => {
      const ps = pledges.filter(p => fyOf(p.expected_date) === y)
      const total = ps.reduce((s, p) => s + Number(p.amount), 0)
      const fulfilled = ps.filter(p => p.status === 'fulfilled' && p.fulfilled_donation_id)
      const onTime = fulfilled.filter(p => {
        const donation = donations.find(d => d.id === p.fulfilled_donation_id)
        return donation && new Date(donation.created_at) <= new Date(p.expected_date)
      }).length
      return {
        count: ps.length,
        total,
        fulfilledCount: fulfilled.length,
        onTimeRate: ps.length > 0 ? Math.round((onTime / ps.length) * 100) : 0,
      }
    }
    const cur = statsForYear(yr)
    const prev = statsForYear(yr - 1)
    const delta = (c: any, p: any) => p === 0 ? (c > 0 ? null : 0) : Math.round(((c - p) / p) * 100)
    const tiles = [
      { label: 'Pledges Made', val: cur.count, d: delta(cur.count, prev.count), tip: `Number of pledges with an expected date in ${yr}, compared to ${yr - 1}.` },
      { label: 'Amount Pledged', val: `$${cur.total.toLocaleString()}`, d: delta(cur.total, prev.total), tip: `Total value of pledges expected in ${yr}, compared to ${yr - 1}. Includes fulfilled, pending, and cancelled pledges.` },
      { label: 'Fulfilled', val: cur.fulfilledCount, d: delta(cur.fulfilledCount, prev.fulfilledCount), tip: `Number of pledges expected in ${yr} that have been fulfilled with a matching donation, compared to ${yr - 1}.` },
      { label: 'Fulfilled On Time', val: `${cur.onTimeRate}%`, d: delta(cur.onTimeRate, prev.onTimeRate), tip: `Share of pledges expected in ${yr} that were fulfilled on or before their expected date, compared to ${yr - 1}.` },
    ]
    return { yr, tiles }
  }, [filterYear, pledges, donations, fyOf])

  const pledgeStatsAndTrend = React.useMemo(() => {
    const today = new Date()
    const yr = filterYear === 'All' ? fyOf(new Date()) : parseInt(filterYear)
    const buildOutstandingUnits = () => {
      const units: any[] = []
      pledges.filter(p => p.status === 'pending').forEach(p => {
        if (p.is_multi_year) {
          pledgeInstalments.filter(i => i.pledge_id === p.id && !i.received).forEach(inst => {
            units.push({ donor_name: p.donor_name, amount: Number(inst.amount), expected_date: inst.expected_date })
          })
        } else {
          units.push({ donor_name: p.donor_name, amount: Number(p.amount), expected_date: p.expected_date })
        }
      })
      return units
    }
    const outstandingUnits = buildOutstandingUnits()
    const overdueUnits = outstandingUnits.filter(u => new Date(u.expected_date) < today).map(u => ({
      ...u,
      daysOverdue: Math.floor((today.getTime() - new Date(u.expected_date).getTime()) / (1000 * 60 * 60 * 24)),
    })).sort((a, b) => b.daysOverdue - a.daysOverdue)
    const overdueTotal = overdueUnits.reduce((s, u) => s + u.amount, 0)

    const scopedPledgesForYr = pledges.filter(p => fyOf(p.expected_date) === yr)
    const lastYearPledgesForYr = pledges.filter(p => fyOf(p.expected_date) === yr - 1)
    const avgPledgeSize = scopedPledgesForYr.length > 0 ? scopedPledgesForYr.reduce((s, p) => s + Number(p.amount), 0) / scopedPledgesForYr.length : 0
    const lastYearAvgPledgeSize = lastYearPledgesForYr.length > 0 ? lastYearPledgesForYr.reduce((s, p) => s + Number(p.amount), 0) / lastYearPledgesForYr.length : 0
    const avgDelta = lastYearAvgPledgeSize === 0 ? (avgPledgeSize > 0 ? null : 0) : Math.round(((avgPledgeSize - lastYearAvgPledgeSize) / lastYearAvgPledgeSize) * 100)

    const cancelledCount = scopedPledgesForYr.filter(p => p.status === 'cancelled').length
    const cancellationRate = scopedPledgesForYr.length > 0 ? Math.round((cancelledCount / scopedPledgesForYr.length) * 100) : 0

    // New pledges are scoped by when they were made (created_at); cancelled value is scoped
    // by expected year (same as cancellationRate above) since pledges have no cancelled_at
    // timestamp to scope by when the cancellation actually happened.
    const newPledgesThisYear = pledges.filter(p => fyOf(p.created_at) === yr)
    const newPledgeValue = newPledgesThisYear.reduce((s, p) => s + Number(p.amount), 0)
    const cancelledPledgeValue = scopedPledgesForYr.filter(p => p.status === 'cancelled').reduce((s, p) => s + Number(p.amount), 0)
    const netPledgeValue = newPledgeValue - cancelledPledgeValue

    const pledgeDonorKey = (p: any) => p.donor_email?.trim() || p.donor_name
    const pledgeCountByDonor: Record<string, any> = {}
    pledges.forEach(p => {
      const key = pledgeDonorKey(p)
      pledgeCountByDonor[key] = (pledgeCountByDonor[key] || 0) + 1
    })
    const pledgeDonorKeys = Object.keys(pledgeCountByDonor)
    const repeatPledgeDonors = pledgeDonorKeys.filter(k => pledgeCountByDonor[k] >= 2).length
    const repeatPledgeRate = pledgeDonorKeys.length > 0 ? Math.round((repeatPledgeDonors / pledgeDonorKeys.length) * 100) : 0

    const allYearsWithPledges = [...new Set(pledges.map(p => fyOf(p.expected_date)))].sort((a, b) => a - b)
    const trendYears = allYearsWithPledges.slice(-5)
    const trendData = trendYears.map(y => {
      const ps = pledges.filter(p => fyOf(p.expected_date) === y)
      const pledgedTotal = ps.reduce((s, p) => s + Number(p.amount), 0)
      const fulfilledTotal = ps.filter(p => p.status === 'fulfilled').reduce((s, p) => s + Number(p.amount), 0)
      return { year: y.toString(), pledged: pledgedTotal, fulfilled: fulfilledTotal }
    })

    return { yr, overdueUnits, overdueTotal, avgPledgeSize, avgDelta, cancellationRate, repeatPledgeRate, trendData, newPledgeValue, cancelledPledgeValue, netPledgeValue }
  }, [filterYear, pledges, pledgeInstalments, fyOf])

  const pledgeReliabilityStats = React.useMemo(() => {
    const yearNum = filterYear === 'All' ? fyOf(new Date()) : parseInt(filterYear)
    const scopedPledges = pledges.filter(p => fyOf(p.expected_date) === yearNum)
    const lastYearPledges = pledges.filter(p => fyOf(p.expected_date) === yearNum - 1)
    const lastYearTotal = lastYearPledges.reduce((s, p) => s + Number(p.amount), 0)

    const fulfilled = scopedPledges.filter(p => p.status === 'fulfilled' && p.fulfilled_donation_id)
    const fulfilledWithDates = fulfilled.map(p => {
      const donation = donations.find(d => d.id === p.fulfilled_donation_id)
      if (!donation) return null
      const daysLate = Math.ceil((new Date(donation.created_at).getTime() - new Date(p.expected_date).getTime()) / (1000 * 60 * 60 * 24))
      return { pledge: p, daysLate }
    }).filter(Boolean)

    const onTimeGroup = fulfilledWithDates.filter(f => f.daysLate <= 0)
    const slightlyLateGroup = fulfilledWithDates.filter(f => f.daysLate > 0 && f.daysLate <= 14)
    const veryLateGroup = fulfilledWithDates.filter(f => f.daysLate > 14)

    const lastYearFulfilled = lastYearPledges.filter(p => p.status === 'fulfilled' && p.fulfilled_donation_id)
    const lastYearOnTime = lastYearFulfilled.filter(p => {
      const donation = donations.find(d => d.id === p.fulfilled_donation_id)
      if (!donation) return false
      return new Date(donation.created_at) <= new Date(p.expected_date)
    }).length
    const lastYearOnTimeRate = lastYearPledges.length > 0 ? Math.round((lastYearOnTime / lastYearPledges.length) * 100) : null

    const today = new Date()
    const donorKey = (p: any) => p.donor_email?.trim() || p.donor_name
    const byDonor: Record<string, any> = {}
    pledges.forEach(p => {
      const key = donorKey(p)
      if (!byDonor[key]) byDonor[key] = { name: p.donor_name, pledges: [] }
      byDonor[key].pledges.push(p)
    })
    // A pledge that was rescheduled while already overdue broke its original promise even if the
    // new date hasn't arrived yet -- counting only "currently overdue" here would let a donor
    // erase their broken-pledge history just by pushing the date forward.
    const wasRescheduledWhileOverdue = (p: any) => (pledgeRescheduleHistory[p.id] || []).some((r: any) => new Date(r.old_expected_date) < new Date(r.created_at))
    const watchList = Object.values(byDonor).map(d => {
      const broken = d.pledges.filter((p: any) => p.status === 'cancelled' || (p.status === 'pending' && new Date(p.expected_date) < today) || (p.status === 'pending' && wasRescheduledWhileOverdue(p)))
      return { ...d, brokenCount: broken.length, broken, overdueNow: d.pledges.filter((p: any) => p.status === 'pending' && new Date(p.expected_date) < today) }
    }).filter(d => d.brokenCount >= pledgeWatchThreshold).sort((a, b) => b.brokenCount - a.brokenCount)

    return { yearNum, lastYearPledges, lastYearTotal, fulfilledWithDates, onTimeGroup, slightlyLateGroup, veryLateGroup, lastYearOnTimeRate, watchList }
  }, [filterYear, pledges, donations, pledgeWatchThreshold, fyOf, pledgeRescheduleHistory])

  const pledgeConcentrationStats = React.useMemo(() => {
    const outstandingUnits: any[] = []
    pledges.filter(p => p.status === 'pending').forEach(p => {
      const donorKey = p.donor_email?.trim() || p.donor_name
      if (p.is_multi_year) {
        const myInstalments = pledgeInstalments.filter(i => i.pledge_id === p.id && !i.received)
        myInstalments.forEach(inst => {
          outstandingUnits.push({ donor_name: p.donor_name, donorKey, amount: Number(inst.amount), expected_date: inst.expected_date, pledge_id: p.id })
        })
      } else {
        outstandingUnits.push({ donor_name: p.donor_name, donorKey, amount: Number(p.amount), expected_date: p.expected_date, pledge_id: p.id })
      }
    })

    const totalOutstanding = outstandingUnits.reduce((s, u) => s + u.amount, 0)

    const byDonorOutstanding: Record<string, any> = {}
    outstandingUnits.forEach(u => {
      if (!byDonorOutstanding[u.donorKey]) byDonorOutstanding[u.donorKey] = { name: u.donor_name, amount: 0 }
      byDonorOutstanding[u.donorKey].amount += u.amount
    })
    const donorRanked = Object.values(byDonorOutstanding).map(({ name, amount }) => ({
      name, amount, pct: totalOutstanding > 0 ? Math.round((amount / totalOutstanding) * 100) : 0,
    })).sort((a, b) => b.amount - a.amount)

    const topDonorPct = donorRanked.length > 0 ? donorRanked[0].pct : 0
    const highRisk = donorRanked.length >= 2 && topDonorPct >= 60
    const medRisk = donorRanked.length >= 2 && topDonorPct >= 40 && topDonorPct < 60
    const tooFewDonors = donorRanked.length < 2

    const byMonth: Record<string, any> = {}
    outstandingUnits.forEach(u => {
      const d = new Date(u.expected_date)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!byMonth[key]) byMonth[key] = { label: d.toLocaleDateString('en-SG', { month: 'long', year: 'numeric' }), amount: 0, count: 0, sortKey: d.getFullYear() * 12 + d.getMonth() }
      byMonth[key].amount += u.amount
      byMonth[key].count += 1
    })
    const monthsRanked = Object.values(byMonth).sort((a, b) => a.sortKey - b.sortKey)
    const heaviestMonth = [...monthsRanked].sort((a, b) => b.amount - a.amount)[0]

    return { donorRanked, topDonorPct, highRisk, medRisk, tooFewDonors, monthsRanked, heaviestMonth }
  }, [pledges, pledgeInstalments])

  const recurringSnapshotStats = React.useMemo(() => {
    const yr = filterYear === 'All' ? fyOf(new Date()) : parseInt(filterYear)
    const statsForYear = (y: any) => {
      const ds = donations.filter(d => d.recurring_gift_id && d.payment_status === 'confirmed' && fyOf(d.created_at) === y)
      const total = ds.reduce((s, d) => s + d.amount, 0)
      const donorKeys = new Set(ds.map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name))
      const newGifts = recurringGifts.filter(g => fyOf(g.created_at) === y).length
      return { total, count: ds.length, donors: donorKeys.size, newGifts }
    }
    const cur = statsForYear(yr)
    const prev = statsForYear(yr - 1)
    const delta = (c: any, p: any) => p === 0 ? (c > 0 ? null : 0) : Math.round(((c - p) / p) * 100)
    const activeGiftsCount = recurringGifts.filter(g => g.status === 'active').length
    const tiles = [
      { label: 'Active Recurring Gifts', val: activeGiftsCount, tip: 'Recurring gifts currently marked active, as of today. Not scoped to a year — this reflects your live portfolio right now.' },
      { label: 'Total Raised (Recurring)', val: `$${cur.total.toLocaleString()}`, d: delta(cur.total, prev.total), tip: `Total confirmed donations collected through recurring gifts in ${yr}, compared to ${yr - 1}.` },
      { label: 'New Recurring Gifts', val: cur.newGifts, d: delta(cur.newGifts, prev.newGifts), tip: `Number of new recurring gifts (GIRO or habitual PayNow) started in ${yr}, compared to ${yr - 1}.` },
      { label: 'Recurring Donors', val: cur.donors, d: delta(cur.donors, prev.donors), tip: `Distinct donors who made at least one recurring donation in ${yr}, compared to ${yr - 1}.` },
    ]
    return { yr, tiles }
  }, [filterYear, donations, recurringGifts, fyOf])

  const recurringMrrStats = React.useMemo(() => {
    const monthlyEquivalent = (g: any) => g.frequency === 'weekly' ? Number(g.amount) * 4.33 : g.frequency === 'quarterly' ? Number(g.amount) / 3 : g.frequency === 'annually' ? Number(g.amount) / 12 : Number(g.amount)
    const mrrAsOfEndOfYear = (y: any) => {
      const yearEnd = fiscalYearBounds(y, fyEndMonth, fyEndDay).end
      const activeAtYearEnd = recurringGifts.filter(g => new Date(g.created_at) <= yearEnd && (g.status === 'active' || (g.cancelled_at && new Date(g.cancelled_at) > yearEnd)))
      return activeAtYearEnd.reduce((s, g) => s + monthlyEquivalent(g), 0)
    }
    const allYearsWithGifts = [...new Set(recurringGifts.map(g => fyOf(g.created_at)))].sort((a, b) => a - b)
    const trendYears = allYearsWithGifts.slice(-5)
    const trendData = trendYears.map(y => ({ year: y.toString(), mrr: Math.round(mrrAsOfEndOfYear(y)) }))

    const yr = filterYear === 'All' ? fyOf(new Date()) : parseInt(filterYear)
    const newGiftsThisYear = recurringGifts.filter(g => fyOf(g.created_at) === yr)
    const newMrr = newGiftsThisYear.reduce((s, g) => s + monthlyEquivalent(g), 0)
    const churnedGiftsThisYear = recurringGifts.filter(g => g.status === 'cancelled' && g.cancelled_at && fyOf(g.cancelled_at) === yr)
    const churnedMrr = churnedGiftsThisYear.reduce((s, g) => s + monthlyEquivalent(g), 0)
    const netMrr = newMrr - churnedMrr

    return { trendData, yr, newMrr, churnedMrr, netMrr }
  }, [filterYear, recurringGifts, fyOf, fyEndMonth, fyEndDay])

  const recurringHealthStats = React.useMemo(() => {
    const today = new Date()
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const activeGifts = recurringGifts.filter(g => g.status === 'active')
    const activeGiftsAgo = recurringGifts.filter(g => g.status === 'active' && new Date(g.created_at) < ninetyDaysAgo)
    const giftCountDiff = activeGifts.length - activeGiftsAgo.length

    // Terminated bank mandates are excluded from revenue-counting MRR -- the bank has cut off
    // the deduction, so this money will not actually arrive until the donor re-authorizes.
    const isRevenueGenerating = (g: any) => g.authorization_status !== 'terminated'
    const mrr = activeGifts.filter(isRevenueGenerating).reduce((s, g) => s + monthlyEquivalentAmount(g), 0)
    const mrrAgo = activeGiftsAgo.filter(isRevenueGenerating).reduce((s, g) => s + monthlyEquivalentAmount(g), 0)
    const mrrDiffPct = mrrAgo > 0 ? Math.round(((mrr - mrrAgo) / mrrAgo) * 100) : null

    const cancelledGifts = recurringGifts.filter(g => g.status === 'cancelled' && g.cancelled_at)
    const avgLifespanMonths = cancelledGifts.length > 0
      ? Math.round(cancelledGifts.reduce((s, g) => s + (new Date(g.cancelled_at).getTime() - new Date(g.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30.44), 0) / cancelledGifts.length)
      : null

    const atRiskGifts = giroMissedCycles.filter(g => g.missedCycles >= recurringMissedThreshold)
    const atRiskCount = atRiskGifts.length
    const atRiskMrr = atRiskGifts.reduce((s, g) => {
      const gift = recurringGifts.find(rg => rg.id === g.gift_id)
      if (!gift) return s
      const monthly = gift.frequency === 'weekly' ? Number(gift.amount) * 4.33 : gift.frequency === 'quarterly' ? Number(gift.amount) / 3 : gift.frequency === 'annually' ? Number(gift.amount) / 12 : Number(gift.amount)
      return s + monthly
    }, 0)

    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const activeOneYearAgo = recurringGifts.filter(g => new Date(g.created_at) <= oneYearAgo && (g.status === 'active' || (g.cancelled_at && new Date(g.cancelled_at) > oneYearAgo)))
    const stillActiveNow = activeOneYearAgo.filter(g => g.status === 'active')
    const retentionRate = activeOneYearAgo.length > 0 ? Math.round((stillActiveNow.length / activeOneYearAgo.length) * 100) : null

    const trendFlagsFiltered = recurringTrendFlags
    const upgrades = trendFlagsFiltered.filter(f => f.direction === 'upgrade')
    const downgrades = trendFlagsFiltered.filter(f => f.direction === 'downgrade')

    // Portfolio-wide reliability: payments actually received vs how many cycles should have
    // happened, for every gift that was live at some point during the fiscal year — same
    // received/expected math as the per-gift reliability shown on the Recurring Giving tab
    // cards, just rolled up and scoped to a fiscal year instead of since-inception.
    const gapDaysFor = (g: any) => (({ weekly: 7, monthly: 30, quarterly: 91, annually: 365 } as Record<string, number>)[g.frequency] || 30)
    const reliabilityForYear = (yr: any) => {
      const { start, end } = fiscalYearBounds(yr, fyEndMonth, fyEndDay)
      const windowEnd = end < today ? end : today
      let totalExpected = 0, totalReceived = 0
      recurringGifts.forEach(g => {
        if (!g.start_date) return
        const gStart = new Date(g.start_date)
        if (gStart > windowEnd) return
        if (g.cancelled_at && new Date(g.cancelled_at) < start) return
        const windowStart = gStart > start ? gStart : start
        if (windowStart > windowEnd) return
        const gapMs = gapDaysFor(g) * 24 * 60 * 60 * 1000
        const expected = Math.max(1, Math.floor((windowEnd.getTime() - windowStart.getTime()) / gapMs) + 1)
        const received = donations.filter(d => d.recurring_gift_id === g.id && d.payment_status === 'confirmed' && new Date(d.created_at) >= windowStart && new Date(d.created_at) <= windowEnd).length
        totalExpected += expected
        totalReceived += Math.min(received, expected)
      })
      return totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : null
    }
    const curFy = fyOf(today)
    const reliabilityPct = reliabilityForYear(curFy)
    const reliabilityPctPrevYear = reliabilityForYear(curFy - 1)
    const reliabilityDelta = (reliabilityPct !== null && reliabilityPctPrevYear !== null) ? reliabilityPct - reliabilityPctPrevYear : null

    return { activeGifts, giftCountDiff, mrr, mrrDiffPct, avgLifespanMonths, cancelledGifts, atRiskCount, atRiskMrr, retentionRate, trendFlagsFiltered, upgrades, downgrades, reliabilityPct, reliabilityDelta, reliabilityYr: curFy }
  }, [recurringGifts, giroMissedCycles, recurringMissedThreshold, recurringTrendFlags, donations, fyOf, fyEndMonth, fyEndDay])

  const recurringRiskStats = React.useMemo(() => {
    const missedFiltered = giroMissedCycles.filter(g => g.missedCycles >= 1)
    const frequentSkippers = Object.entries(recurringSkipHistory).filter(([, skips]) => skips.length >= 2).map(([giftId, skips]) => {
      const gift = recurringGifts.find(g => g.id === giftId)
      return gift ? { ...gift, skipCount: skips.length } : null
    }).filter(Boolean)

    const today = new Date()
    const sixMonthsOut = new Date()
    sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6)
    const endingSoon = recurringGifts.filter(g => g.status === 'active' && g.end_date && new Date(g.end_date) >= today && new Date(g.end_date) <= sixMonthsOut)
    const pausedGifts = recurringGifts.filter(g => g.status === 'paused')

    return { missedFiltered, frequentSkippers, endingSoon, pausedGifts }
  }, [giroMissedCycles, recurringSkipHistory, recurringGifts])

  const recurringAuthStats = React.useMemo(() => {
    const monthlyEquivalent = (g: any) => g.frequency === 'weekly' ? Number(g.amount) * 4.33 : g.frequency === 'quarterly' ? Number(g.amount) / 3 : g.frequency === 'annually' ? Number(g.amount) / 12 : Number(g.amount)
    const bankGifts = recurringGifts.filter(g => g.status === 'active' && (g.type === 'giro' || g.type === 'standing_order'))
    const pendingCount = bankGifts.filter(g => g.authorization_status === 'pending').length
    const authorizedCount = bankGifts.filter(g => !g.authorization_status || g.authorization_status === 'active').length
    const terminatedGifts = bankGifts.filter(g => g.authorization_status === 'terminated')
    return { pendingCount, authorizedCount, terminatedCount: terminatedGifts.length, terminatedGifts, terminatedMrr: terminatedGifts.reduce((s, g) => s + monthlyEquivalent(g), 0) }
  }, [recurringGifts])

  const recurringCompositionStats = React.useMemo(() => {
    const activeGifts = recurringGifts.filter(g => g.status === 'active')
    const totalActive = activeGifts.reduce((s, g) => s + monthlyEquivalentAmount(g), 0)

    const byProgramme: Record<string, any> = {}
    activeGifts.forEach(g => {
      const key = g.cause_id || 'none'
      if (!byProgramme[key]) byProgramme[key] = 0
      byProgramme[key] += monthlyEquivalentAmount(g)
    })
    const byProgrammeRows = Object.entries(byProgramme).map(([key, amt]) => ({
      key, title: key === 'none' ? 'General / unrestricted' : (myCauses.find(c => c.id === key)?.title || 'Unknown programme'),
      amount: amt, pct: totalActive > 0 ? Math.round((amt / totalActive) * 100) : 0,
    })).sort((a, b) => b.amount - a.amount)

    const typeLabels: Record<string, string> = { giro: 'GIRO', habitual_paynow: 'Habitual PayNow', standing_order: 'Standing Order', other: 'Other' }
    const byType: Record<string, any> = {}
    activeGifts.forEach(g => {
      const key = g.type || 'other'
      if (!byType[key]) byType[key] = 0
      byType[key] += monthlyEquivalentAmount(g)
    })
    const byTypeRows = Object.entries(byType).map(([key, amt]) => ({
      key, label: typeLabels[key] || key, amount: amt, pct: totalActive > 0 ? Math.round((amt / totalActive) * 100) : 0,
    })).sort((a, b) => b.amount - a.amount)

    return { byProgrammeRows, byTypeRows }
  }, [recurringGifts, myCauses])

  const grantsWithNextReport = React.useMemo(() => {
    return grants.map(g => {
      const upcoming = (grantReports[g.id] || []).filter((r: any) => !r.submitted).sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      return { ...g, report_due_date: upcoming[0]?.due_date || null }
    })
  }, [grants, grantReports])

  const grantExpensesByGrant = React.useMemo(() => {
    const m: Record<string, any> = {}
    grantExpenses.forEach(e => { (m[e.grant_id] = m[e.grant_id] || []).push(e) })
    return m
  }, [grantExpenses])

  const campaignExpensesByCause = React.useMemo(() => {
    const m: Record<string, any> = {}
    campaignExpenses.forEach(e => { (m[e.cause_id] = m[e.cause_id] || []).push(e) })
    return m
  }, [campaignExpenses])

  const donationsByRecurringGift = React.useMemo(() => {
    const m: Record<string, any> = {}
    donations.forEach(d => { if (d.recurring_gift_id) (m[d.recurring_gift_id] = m[d.recurring_gift_id] || []).push(d) })
    Object.values(m).forEach(list => list.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
    return m
  }, [donations])

  const donationsByPledge = React.useMemo(() => {
    const m: Record<string, any> = {}
    Object.entries(pledgeDonationLinks).forEach(([pledgeId, links]) => {
      m[pledgeId] = links.map((l: any) => {
        const donation = donations.find(d => d.id === l.donation_id)
        return { ...l, payment_status: donation?.payment_status, notes: donation?.notes, source: donation?.source }
      }).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    })
    return m
  }, [pledgeDonationLinks, donations])

  const grantSnapshotStats = React.useMemo(() => {
    const yr = filterYear === 'All' ? fyOf(new Date()) : parseInt(filterYear)
    const grantYearOf = (g: any) => fyOf(g.start_date || g.created_at)
    const statsForYear = (y: any) => {
      const gs = grantsWithNextReport.filter(g => grantYearOf(g) === y)
      const total = gs.reduce((s, g) => s + Number(g.amount), 0)
      return { total, count: gs.length, avg: gs.length > 0 ? total / gs.length : 0 }
    }
    const cur = statsForYear(yr)
    const prev = statsForYear(yr - 1)
    const delta = (c: any, p: any) => p === 0 ? (c > 0 ? null : 0) : Math.round(((c - p) / p) * 100)
    const activeGrantsCount = grantsWithNextReport.filter(g => g.status === 'active').length
    const tiles = [
      { label: 'Active Grants', val: activeGrantsCount, tip: `Grants currently marked active, as of today. Not scoped to ${yr} — this reflects your live grant portfolio right now.` },
      { label: 'Grants Awarded', val: cur.count, d: delta(cur.count, prev.count), tip: `Number of grants with a start date in ${yr}, compared to ${yr - 1}.` },
      { label: 'Total Secured', val: `$${cur.total.toLocaleString()}`, d: delta(cur.total, prev.total), tip: `Total value of grants awarded in ${yr}, compared to ${yr - 1}.` },
      { label: 'Avg Grant Size', val: `$${cur.avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, d: delta(cur.avg, prev.avg), tip: `Average grant amount awarded in ${yr}, compared to ${yr - 1}.` },
    ]
    return { yr, tiles }
  }, [filterYear, grantsWithNextReport, fyOf])

  const grantOverviewStats = React.useMemo(() => {
    const grantYearOf = (g: any) => fyOf(g.start_date || g.created_at)
    const allYearsWithGrants = [...new Set(grantsWithNextReport.map(grantYearOf))].sort((a, b) => a - b)
    const trendYears = allYearsWithGrants.slice(-5)
    const trendData = trendYears.map(y => ({
      year: y.toString(),
      total: grantsWithNextReport.filter(g => grantYearOf(g) === y).reduce((s, g) => s + Number(g.amount), 0),
    }))

    const today = new Date()
    const activeGrants = grantsWithNextReport.filter(g => g.status === 'active')

    // "Pace vs report deadline" card is scoped to the selected FY, but by whether the grant was
    // ACTIVE DURING that FY (start-to-end range overlaps it) — not just whether it started that year.
    // Otherwise a multi-year grant that started last FY silently disappears when you switch years.
    const yearScopedActiveGrants = filterYear === 'All' ? activeGrants : (() => {
      const { start: fyStart, end: fyEnd } = fiscalYearBounds(parseInt(filterYear), fyEndMonth, fyEndDay)
      return activeGrants.filter(g => {
        const gStart = new Date(g.start_date || g.created_at)
        const gEnd = g.end_date ? new Date(g.end_date) : null
        return gStart <= fyEnd && (!gEnd || gEnd >= fyStart)
      })
    })()
    const totalActiveAmount = yearScopedActiveGrants.reduce((s, g) => s + Number(g.amount), 0)
    const totalUtilized = yearScopedActiveGrants.reduce((s, g) => s + (grantExpensesByGrant[g.id] || []).reduce((s2: any, e: any) => s2 + Number(e.amount), 0), 0)
    const utilizationRate = totalActiveAmount > 0 ? Math.round((totalUtilized / totalActiveAmount) * 100) : null

    const totalActive = activeGrants.reduce((s, g) => s + Number(g.amount), 0)
    const byFunder = activeGrants.map(g => ({
      funder_name: g.funder_name,
      amount: Number(g.amount),
      pct: totalActive > 0 ? Math.round((Number(g.amount) / totalActive) * 100) : 0,
    })).sort((a, b) => b.amount - a.amount)
    const topFunderPct = byFunder.length > 0 ? byFunder[0].pct : 0
    const highRisk = byFunder.length >= 2 && topFunderPct >= 60
    const medRisk = byFunder.length >= 2 && topFunderPct >= 40 && topFunderPct < 60
    const tooFewFunders = byFunder.length < 2

    const sixMonthsOut = new Date()
    sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6)
    // Expiring soon is driven by the grant's own end date, not report deadlines — a grant can be
    // fully caught up on reports and still be ending soon with no successor funding lined up.
    const expiringSoon = activeGrants.filter(g => g.end_date && new Date(g.end_date) >= today && new Date(g.end_date) <= sixMonthsOut)

    const funderTypeLabelsMap: Record<string, string> = { government: 'Government / statutory board', corporate: 'Corporate foundation', trust: 'Private trust / individual', other: 'Other' }
    const byFunderType: Record<string, any> = {}
    activeGrants.forEach(g => {
      const key = g.funder_type || 'unspecified'
      if (!byFunderType[key]) byFunderType[key] = 0
      byFunderType[key] += Number(g.amount)
    })
    const funderTypeBreakdown = Object.entries(byFunderType).map(([key, amt]) => ({
      key, label: key === 'unspecified' ? 'Not specified' : funderTypeLabelsMap[key] || key,
      amount: amt, pct: totalActive > 0 ? Math.round((amt / totalActive) * 100) : 0,
    })).sort((a, b) => b.amount - a.amount)

    const activeGrantIds = new Set(activeGrants.map(g => g.id))
    const byCategory: Record<string, any> = {}
    grantExpenses.filter(e => activeGrantIds.has(e.grant_id)).forEach(e => {
      const key = e.category || 'Uncategorized'
      if (!byCategory[key]) byCategory[key] = 0
      byCategory[key] += Number(e.amount)
    })
    const totalCategorized = Object.values(byCategory).reduce((s, v) => s + v, 0)
    const expenseByCategory = Object.entries(byCategory).map(([label, amt]) => ({
      label, amount: amt, pct: totalCategorized > 0 ? Math.round((amt / totalCategorized) * 100) : 0,
    })).sort((a, b) => b.amount - a.amount)

    const restrictedTotal = activeGrants.reduce((s, g) => s + Number(g.restricted_amount || 0), 0)
    const unrestrictedTotal = activeGrants.reduce((s, g) => s + Number(g.unrestricted_amount || 0), 0)
    const restrictedRollupTotal = restrictedTotal + unrestrictedTotal
    const restrictedPct = restrictedRollupTotal > 0 ? Math.round((restrictedTotal / restrictedRollupTotal) * 100) : 0

    const allReports = Object.values(grantReports).flat()
    const reportYearOf = (r: any) => fyOf(r.due_date)
    const complianceYr = filterYear === 'All' ? fyOf(today) : parseInt(filterYear)
    const complianceStatsForYear = (y: any) => {
      const yReports = allReports.filter(r => reportYearOf(r) === y)
      const ySubmitted = yReports.filter(r => r.submitted)
      const yOnTime = ySubmitted.filter(r => new Date(r.submitted_at) <= new Date(r.due_date))
      const yLate = ySubmitted.filter(r => new Date(r.submitted_at) > new Date(r.due_date))
      const yAvgDaysLate = yLate.length > 0 ? Math.round(yLate.reduce((s, r) => s + Math.ceil((new Date(r.submitted_at).getTime() - new Date(r.due_date).getTime()) / (1000 * 60 * 60 * 24)), 0) / yLate.length) : null
      return {
        total: yReports.length,
        submitted: ySubmitted.length,
        onTimeRate: ySubmitted.length > 0 ? Math.round((yOnTime.length / ySubmitted.length) * 100) : null,
        avgDaysLate: yAvgDaysLate,
      }
    }
    const curCompliance = complianceStatsForYear(complianceYr)
    const prevCompliance = complianceStatsForYear(complianceYr - 1)
    const overdueReports = allReports.filter(r => !r.submitted && new Date(r.due_date) < today)
    const grantNameByIdForReports: Record<string, any> = {}
    grantsWithNextReport.forEach(g => { grantNameByIdForReports[g.id] = g.funder_name })
    const overdueReportsList = overdueReports.map(r => ({
      grant_id: r.grant_id,
      funder_name: grantNameByIdForReports[r.grant_id] || 'Unknown grant',
      label: r.label,
      due_date: r.due_date,
      daysOverdue: Math.floor((today.getTime() - new Date(r.due_date).getTime()) / (1000 * 60 * 60 * 24)),
    })).sort((a, b) => b.daysOverdue - a.daysOverdue)
    const reportCompliance = {
      yr: complianceYr,
      total: curCompliance.total,
      submitted: curCompliance.submitted,
      onTimeRate: curCompliance.onTimeRate,
      onTimeRateDelta: (curCompliance.onTimeRate !== null && prevCompliance.onTimeRate !== null) ? curCompliance.onTimeRate - prevCompliance.onTimeRate : null,
      avgDaysLate: curCompliance.avgDaysLate,
      overdueCount: overdueReports.length,
      overdueReportsList,
    }

    // Multi-year trend (up to 5 fiscal years with data) — for spotting a longer-run pattern that a
    // single this-year-vs-last-year comparison (reportCompliance above) can't show.
    const reportYears = [...new Set(allReports.map(reportYearOf))].sort((a, b) => a - b).slice(-5)
    const reportComplianceTrend = reportYears.map(y => ({ year: y.toString(), ...complianceStatsForYear(y) }))

    // Matching-grant claims rollup: how much matched funding is left unclaimed portfolio-wide,
    // and which matching grants are approaching their end date with claims still behind the cap.
    const matchingGrants = activeGrants.filter(g => g.is_matching && Number(g.match_cap) > 0)
    const totalMatchCap = matchingGrants.reduce((s, g) => s + Number(g.match_cap), 0)
    const totalMatchClaimed = matchingGrants.reduce((s, g) => s + (grantMatchClaims[g.id] || []).reduce((s2: any, c: any) => s2 + Number(c.amount), 0), 0)
    const matchClaimedPct = totalMatchCap > 0 ? Math.round((totalMatchClaimed / totalMatchCap) * 100) : null
    const matchingAtRisk = matchingGrants.map(g => {
      const claimed = (grantMatchClaims[g.id] || []).reduce((s: any, c: any) => s + Number(c.amount), 0)
      const cap = Number(g.match_cap)
      const pct = cap > 0 ? Math.round((claimed / cap) * 100) : 0
      const endingSoon = g.end_date && new Date(g.end_date) >= today && new Date(g.end_date) <= sixMonthsOut
      return { funder_name: g.funder_name, claimed, cap, pct, end_date: g.end_date, endingSoon }
    }).filter(m => m.endingSoon && m.pct < 100).sort((a, b) => a.pct - b.pct)

    // Disbursement tranche rollup: committed vs actually received cash across active grants.
    const grantNameById: Record<string, any> = {}
    activeGrants.forEach(g => { grantNameById[g.id] = g.funder_name })
    const activeTranches = activeGrants.flatMap(g => grantTranches[g.id] || [])
    const totalCommitted = activeTranches.reduce((s, t) => s + Number(t.amount), 0)
    const totalReceived = activeTranches.filter(t => t.received).reduce((s, t) => s + Number(t.amount), 0)
    const pendingTranches = activeTranches.filter(t => !t.received).map(t => ({
      funder_name: grantNameById[t.grant_id] || 'Unknown', label: t.label, amount: Number(t.amount), expected_date: t.expected_date,
      overdue: new Date(t.expected_date) < today,
    })).sort((a, b) => new Date(a.expected_date).getTime() - new Date(b.expected_date).getTime())

    return {
      trendData, totalActiveAmount, totalUtilized, utilizationRate, activeGrants: yearScopedActiveGrants, byFunder, topFunderPct, highRisk, medRisk, tooFewFunders, expiringSoon,
      funderTypeBreakdown, expenseByCategory, restrictedTotal, unrestrictedTotal, restrictedPct, reportCompliance, reportComplianceTrend,
      totalMatchCap, totalMatchClaimed, matchClaimedPct, matchingAtRisk,
      totalCommitted, totalReceived, pendingTranches,
    }
  }, [grantsWithNextReport, grantExpenses, grantExpensesByGrant, grantReports, grantMatchClaims, grantTranches, filterYear, fyOf, fyEndMonth, fyEndDay])

  const donorRetentionSnapshotStats = React.useMemo(() => {
    const yr = filterYear === 'All' ? fyOf(new Date()) : parseInt(filterYear)
    const donorMap: Record<string, any> = {}
    donations.filter(d => d.payment_status === 'confirmed').forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!donorMap[key]) donorMap[key] = { total: 0, count: 0, years: new Set() }
      donorMap[key].total += d.amount
      donorMap[key].count += 1
      donorMap[key].years.add(fyOf(d.created_at))
    })
    const allDonors = Object.values(donorMap)
    const repeatCount = allDonors.filter(d => d.count >= 2).length
    const repeatDonorRate = allDonors.length > 0 ? Math.round((repeatCount / allDonors.length) * 100) : 0
    const avgLTV = allDonors.length > 0 ? Math.round(allDonors.reduce((s: any, d: any) => s + d.total, 0) / allDonors.length) : 0

    const priorYearDonors = allDonors.filter(d => d.years.has(yr - 1))
    const retainedDonors = priorYearDonors.filter(d => d.years.has(yr))
    const retentionRate = priorYearDonors.length > 0 ? Math.round((retainedDonors.length / priorYearDonors.length) * 100) : null

    const activeCount = allDonors.filter(d => d.years.has(yr)).length
    const lapsedCount = allDonors.filter(d => !d.years.has(yr) && Math.max(...d.years) < yr).length

    return { yr, repeatDonorRate, avgLTV, retentionRate, activeCount, lapsedCount }
  }, [filterYear, donations, fyOf])

  const lapsedDonorsStats = React.useMemo(() => {
    const lapsedToday = new Date()
    const map: Record<string, any> = {}
    confirmedDonations.forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!map[key] || new Date(d.created_at) > new Date(map[key].lastDate)) {
        map[key] = { name: d.donor_name, email: d.donor_email, lastDate: d.created_at, count: 0, total: 0 }
      }
      map[key].count++
      map[key].total += d.amount
    })
    const allLapsed = Object.values(map).filter(d => {
      const daysSince = Math.floor((lapsedToday.getTime() - new Date(d.lastDate).getTime()) / (1000 * 60 * 60 * 24))
      return daysSince >= lapsedMinDays && d.count >= lapsedMinGifts
    }).map(d => ({ ...d, key: d.email?.trim() || d.name })).sort((a, b) => b.total - a.total)

    const isInReachOutCooldown = (donorKey: any) => {
      const history = lapsedReminderHistory[donorKey]
      if (!history || history.length === 0) return false
      const daysSinceReminder = Math.floor((lapsedToday.getTime() - new Date(history[0].sent_at).getTime()) / (1000 * 60 * 60 * 24))
      return daysSinceReminder < 30
    }

    const activeLapsed = allLapsed.filter(d => !lapsedDismissals[d.key] && !isInReachOutCooldown(d.key))
    const dismissedLapsed = allLapsed.filter(d => lapsedDismissals[d.key])

    return { activeLapsed, dismissedLapsed }
  }, [confirmedDonations, lapsedMinDays, lapsedMinGifts, lapsedDismissals, lapsedReminderHistory])

  const quietDonorsStats = React.useMemo(() => {
    const byDonor: Record<string, any> = {}
    confirmedDonations.forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!byDonor[key]) byDonor[key] = { name: d.donor_name, email: d.donor_email, dates: [] }
      byDonor[key].dates.push(new Date(d.created_at))
    })
    const now4 = new Date()
    const quiet = Object.values(byDonor).map(donor => {
      const sorted = donor.dates.sort((a: any, b: any) => a - b)
      if (sorted.length < 3) return null
      const gaps = []
      for (let i = 1; i < sorted.length; i++) {
        gaps.push((sorted[i] - sorted[i - 1]) / (1000 * 60 * 60 * 24))
      }
      const avgGapDays = gaps.reduce((s, g) => s + g, 0) / gaps.length
      const daysSinceLast = (now4.getTime() - sorted[sorted.length - 1]) / (1000 * 60 * 60 * 24)
      if (avgGapDays > 0 && avgGapDays < 60 && daysSinceLast > avgGapDays * 2 && daysSinceLast < 365) {
        return { name: donor.name, email: donor.email, avgGapDays: Math.round(avgGapDays), daysSinceLast: Math.round(daysSinceLast), lastGift: sorted[sorted.length - 1] }
      }
      return null
    }).filter(Boolean).sort((a, b) => b.daysSinceLast - a.daysSinceLast).slice(0, 8)
    return quiet
  }, [confirmedDonations])

  const quietlyPayingStats = React.useMemo(() => {
    const yearAgo75 = new Date()
    yearAgo75.setFullYear(yearAgo75.getFullYear() - 1)
    const activeRecurringDonors75 = recurringGifts.filter(g => g.status === 'active')
    return activeRecurringDonors75.map(g => {
      const donorKey75 = g.donor_email?.trim() || g.donor_name
      const myNotes75 = donorNotes.filter(n => n.donor_key === donorKey75).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      const lastContact75 = myNotes75[0]?.created_at || null
      const isQuiet75 = !lastContact75 || new Date(lastContact75) < yearAgo75
      if (!isQuiet75) return null
      return {
        name: g.donor_name,
        email: g.donor_email,
        amount: g.amount,
        frequency: g.frequency,
        lastContact: lastContact75,
      }
    }).filter(Boolean)
  }, [recurringGifts, donorNotes])

  const donorHighlightsStats = React.useMemo(() => {
    const yearScopedConfirmed = (filterYear === 'All' ? donations : donations.filter(d => fyOf(d.created_at) === parseInt(filterYear))).filter(d => d.payment_status === 'confirmed')
    if (yearScopedConfirmed.length === 0) return []

    const byDonorTotal: Record<string, any> = {}
    yearScopedConfirmed.forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!byDonorTotal[key]) byDonorTotal[key] = { name: d.donor_name, email: d.donor_email, total: 0, count: 0, firstYear: null }
      byDonorTotal[key].total += d.amount
      byDonorTotal[key].count += 1
    })
    const topDonor = Object.values(byDonorTotal).sort((a, b) => b.total - a.total)[0]
    const mostFrequent = Object.values(byDonorTotal).sort((a, b) => b.count - a.count)[0]
    const largestGift = [...yearScopedConfirmed].sort((a, b) => b.amount - a.amount)[0]

    const donorFirstEverYear: Record<string, any> = {}
    ;[...donations].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!donorFirstEverYear[key]) donorFirstEverYear[key] = fyOf(d.created_at)
    })
    const firstTimeGiftsThisPeriod = yearScopedConfirmed.filter(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      return donorFirstEverYear[key] === fyOf(d.created_at)
    })
    const standoutNewDonor = [...firstTimeGiftsThisPeriod].sort((a, b) => b.amount - a.amount)[0]

    return [
      topDonor && { icon: '🏆', label: 'Top donor', name: topDonor.name, sub: `$${topDonor.total.toLocaleString()} across ${topDonor.count} gift${topDonor.count > 1 ? 's' : ''}`, donor: { name: topDonor.name, email: topDonor.email, total: topDonor.total, count: topDonor.count } },
      largestGift && { icon: '💎', label: 'Largest single gift', name: largestGift.donor_name, sub: `$${Number(largestGift.amount).toLocaleString()} on ${new Date(largestGift.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}`, donor: { name: largestGift.donor_name, email: largestGift.donor_email, total: byDonorTotal[largestGift.donor_email?.trim() || largestGift.donor_nric || largestGift.donor_name]?.total || largestGift.amount, count: byDonorTotal[largestGift.donor_email?.trim() || largestGift.donor_nric || largestGift.donor_name]?.count || 1 } },
      mostFrequent && { icon: '🔁', label: 'Most frequent giver', name: mostFrequent.name, sub: `${mostFrequent.count} donations, $${mostFrequent.total.toLocaleString()} total`, donor: { name: mostFrequent.name, email: mostFrequent.email, total: mostFrequent.total, count: mostFrequent.count } },
      standoutNewDonor && { icon: '✨', label: 'Standout new supporter', name: standoutNewDonor.donor_name, sub: `First gift: $${Number(standoutNewDonor.amount).toLocaleString()}`, donor: { name: standoutNewDonor.donor_name, email: standoutNewDonor.donor_email, total: standoutNewDonor.amount, count: 1 } },
    ].filter(Boolean)
  }, [filterYear, donations, fyOf])

  const givingStreaksStats = React.useMemo(() => {
    const byDonorMonths: Record<string, any> = {}
    confirmedDonations.forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      const dt = new Date(d.created_at)
      const monthKey = `${dt.getFullYear()}-${dt.getMonth()}`
      if (!byDonorMonths[key]) byDonorMonths[key] = { name: d.donor_name, email: d.donor_email, months: new Set() }
      byDonorMonths[key].months.add(monthKey)
    })
    const now3 = new Date()
    return Object.values(byDonorMonths).map(donor => {
      const sortedMonths = [...donor.months].map(m => { const [y, mo] = m.split('-').map(Number); return y * 12 + mo }).sort((a, b) => b - a)
      const currentMonthIdx = now3.getFullYear() * 12 + now3.getMonth()
      if (sortedMonths[0] < currentMonthIdx - 1) return { ...donor, streak: 0 }
      let streak = 1
      for (let i = 0; i < sortedMonths.length - 1; i++) {
        if (sortedMonths[i] - sortedMonths[i + 1] === 1) streak++
        else break
      }
      return { ...donor, streak }
    }).filter(d => d.streak >= 3).sort((a, b) => b.streak - a.streak).slice(0, 8)
  }, [confirmedDonations])

  const donorLTVStats = React.useMemo(() => {
    if (confirmedDonations.length === 0) return null
    const map: Record<string, any> = {}
    confirmedDonations.forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!map[key]) map[key] = { name: d.donor_name, total: 0, count: 0, firstDate: d.created_at }
      map[key].total += d.amount
      map[key].count++
      if (new Date(d.created_at) < new Date(map[key].firstDate)) map[key].firstDate = d.created_at
    })
    const sorted = Object.values(map).sort((a, b) => b.total - a.total)
    const avgLTV = sorted.length > 0 ? Math.round(sorted.reduce((s: any, d: any) => s + d.total, 0) / sorted.length) : 0
    const avgGifts = sorted.length > 0 ? (sorted.reduce((s: any, d: any) => s + d.count, 0) / sorted.length).toFixed(1) : 0
    const now59 = new Date()
    const withTenure59 = sorted.map(d => ({ ...d, tenureYears: (now59.getTime() - new Date(d.firstDate).getTime()) / (1000 * 60 * 60 * 24 * 365) }))
    const under1yr59 = withTenure59.filter(d => d.tenureYears < 1)
    const oneToTwo59 = withTenure59.filter(d => d.tenureYears >= 1 && d.tenureYears < 2)
    const twoPlus59 = withTenure59.filter(d => d.tenureYears >= 2)
    const avgOf59 = (arr: any) => arr.length > 0 ? Math.round(arr.reduce((s: any, d: any) => s + d.total, 0) / arr.length) : null
    return { sorted, avgLTV, avgGifts, under1yr59, oneToTwo59, twoPlus59, avgOf59 }
  }, [confirmedDonations])

  const paymentMixStats = React.useMemo(() => {
    const scoped = (filterYear === 'All' ? donations : donations.filter(d => fyOf(d.created_at) === parseInt(filterYear))).filter(d => d.payment_status === 'confirmed')
    if (scoped.length === 0) return null
    const totalAmt = scoped.reduce((s, d) => s + d.amount, 0)
    const byMethod: Record<string, any> = {}
    scoped.forEach(d => {
      const label = d.source === 'manual' ? normalizePaymentMethodLabel(d.payment_method) : 'PayNow (app)'
      if (!byMethod[label]) byMethod[label] = 0
      byMethod[label] += d.amount
    })
    const rows = Object.entries(byMethod).map(([label, amt]) => ({ label, amt, pct: Math.round((amt / totalAmt) * 100), rawPct: (amt / totalAmt) * 100 })).sort((a, b) => b.amt - a.amt)

    const allYears61 = [...new Set(donations.filter(d => d.payment_status === 'confirmed').map(d => fyOf(d.created_at)))].sort()
    const allMethods61 = [...new Set(rows.map(r => r.label))]
    const yearlyMix61 = allYears61.map(y => {
      const yearDons = donations.filter(d => d.payment_status === 'confirmed' && fyOf(d.created_at) === y)
      const yearTotal = yearDons.reduce((s, d) => s + d.amount, 0)
      const mix: Record<string, any> = {}
      allMethods61.forEach(m => { mix[m] = 0 })
      yearDons.forEach(d => {
        const label = d.source === 'manual' ? normalizePaymentMethodLabel(d.payment_method) : 'PayNow (app)'
        mix[label] = (mix[label] || 0) + d.amount
      })
      return { year: y, mix, total: yearTotal }
    })

    return { rows, allYears61, allMethods61, yearlyMix61 }
  }, [filterYear, donations, fyOf])

  const fundingConcentrationStats = React.useMemo(() => {
    const donorTotals: Record<string, any> = {}
    confirmedDonations.filter(d => !d.is_anonymous).forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!donorTotals[key]) donorTotals[key] = { name: d.donor_name, email: d.donor_email, total: 0, gifts: [] }
      donorTotals[key].total += d.amount
      donorTotals[key].gifts.push({ amount: d.amount, date: d.created_at })
    })
    const sorted = Object.values(donorTotals).sort((a, b) => b.total - a.total)
    const grandTotal = sorted.reduce((s, d) => s + d.total, 0)
    const topNTotal = sorted.slice(0, concentrationTopN).reduce((s, d) => s + d.total, 0)
    const concentrationPct = grandTotal > 0 ? Math.round((topNTotal / grandTotal) * 100) : 0
    const tooFewDonors = sorted.length < concentrationTopN * 3
    const highRisk = !tooFewDonors && concentrationPct >= 70
    const medRisk = !tooFewDonors && concentrationPct >= 50
    const topDonorNames = sorted.slice(0, concentrationTopN).map(d => d.name)

    const quarterAgo = new Date()
    quarterAgo.setDate(quarterAgo.getDate() - 90)
    const priorDonorTotals: Record<string, any> = {}
    confirmedDonations.filter(d => !d.is_anonymous && new Date(d.created_at) < quarterAgo).forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!priorDonorTotals[key]) priorDonorTotals[key] = 0
      priorDonorTotals[key] += d.amount
    })
    const priorSorted: number[] = Object.values(priorDonorTotals).sort((a: any, b: any) => b - a)
    const priorGrandTotal = priorSorted.reduce((s, t) => s + t, 0)
    const priorTopNTotal = priorSorted.slice(0, concentrationTopN).reduce((s, t) => s + t, 0)
    const priorConcentrationPct = priorGrandTotal > 0 ? Math.round((priorTopNTotal / priorGrandTotal) * 100) : null
    const concentrationTrend = priorConcentrationPct !== null ? concentrationPct - priorConcentrationPct : null

    return { sorted, grandTotal, concentrationPct, tooFewDonors, highRisk, medRisk, topDonorNames, concentrationTrend }
  }, [confirmedDonations, concentrationTopN])

  const topConnectorsStats = React.useMemo(() => {
    const referrals78 = donations.filter(d => d.referred_by_donor_key)
    if (referrals78.length === 0) return []
    const byReferrer78: Record<string, any> = {}
    referrals78.forEach(d => {
      const referrerKey = d.referred_by_donor_key
      const referredKey = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!byReferrer78[referrerKey]) byReferrer78[referrerKey] = { referredDonors: {} }
      if (!byReferrer78[referrerKey].referredDonors[referredKey]) byReferrer78[referrerKey].referredDonors[referredKey] = 0
      byReferrer78[referrerKey].referredDonors[referredKey]++
    })
    return Object.entries(byReferrer78).map(([referrerKey, info]) => {
      const referrer = donorList.find(d => (d.email?.trim() || d.name) === referrerKey)
      const referredCount = Object.keys(info.referredDonors).length
      const sustainedCount = Object.values(info.referredDonors).filter((c: any) => c > 1).length
      return { name: referrer?.name || referrerKey, referredCount, sustainedCount }
    }).sort((a, b) => b.sustainedCount - a.sustainedCount || b.referredCount - a.referredCount)
  }, [donations, donorList])

  const acquisitionSourceStats = React.useMemo(() => {
    const bySource57: Record<string, any> = {}
    donations.filter(d => d.acquisition_source).forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!bySource57[d.acquisition_source]) bySource57[d.acquisition_source] = {}
      if (!bySource57[d.acquisition_source][key]) bySource57[d.acquisition_source][key] = 0
      bySource57[d.acquisition_source][key]++
    })
    const sourceLabels57: Record<string, string> = { referral: 'Referral', event: 'Event', social_media: 'Social Media', walk_in: 'Walk-in', corporate_partner: 'Corporate Partner', other: 'Other' }
    return Object.entries(bySource57).map(([source, donorCounts]) => {
      const donorKeys = Object.keys(donorCounts)
      const repeat = donorKeys.filter(k => donorCounts[k] > 1).length
      return { source: sourceLabels57[source] || source, totalDonors: donorKeys.length, repeatDonors: repeat, repeatPct: donorKeys.length > 0 ? Math.round((repeat / donorKeys.length) * 100) : 0 }
    }).sort((a, b) => b.totalDonors - a.totalDonors)
  }, [donations])

  const donationSizeBreakdownStats = React.useMemo(() => {
    const yearScoped = confirmedDonations.filter(d => filterYear === 'All' || fyOf(d.created_at).toString() === filterYear)
    return [
      { label: 'Under $50', min: 0, max: 50, color: C.bucket1 },
      { label: '$50 — $200', min: 50, max: 200, color: C.sage },
      { label: '$200 — $1,000', min: 200, max: 1000, color: C.teal },
      { label: 'Over $1,000', min: 1000, max: Infinity, color: C.forest },
    ].map((bucket) => {
      const count = yearScoped.filter(d => d.amount >= bucket.min && d.amount < bucket.max).length
      const total = yearScoped.filter(d => d.amount >= bucket.min && d.amount < bucket.max).reduce((s, d) => s + d.amount, 0)
      const pct = yearScoped.length ? Math.round((count / yearScoped.length) * 100) : 0
      return { ...bucket, count, total, pct }
    })
  }, [filterYear, confirmedDonations, fyOf])

  // These used to be plain top-level `const`s recomputed on every render of the WHOLE app
  // (not just when the relevant tab was open) — including two O(n) scans per donor
  // (repeatDonorsThisMonth, longestSupporter). Memoized like every other analytics stat below.
  const allGivingChangeFlags = React.useMemo(() => {
    const donorTotals: Record<string, any> = {}
    confirmedDonations.forEach(d => {
      const key = donationDonorKey(d)
      if (!donorTotals[key]) donorTotals[key] = { name: d.donor_name, email: d.donor_email, total: 0, gifts: [] }
      donorTotals[key].total += d.amount
      donorTotals[key].gifts.push({ amount: d.amount, date: d.created_at })
    })
    return Object.values(donorTotals).filter(d => d.gifts.length >= givingChangeMinGifts).map(d => {
      const byDate = [...d.gifts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      const recent = byDate[byDate.length - 1].amount
      const recentDate = byDate[byDate.length - 1].date
      const prevAvg = byDate.slice(0, -1).reduce((s, g) => s + g.amount, 0) / (byDate.length - 1)
      const changePct = Math.round(((recent - prevAvg) / prevAvg) * 100)
      if (Math.abs(changePct) >= givingChangeMinPct) return { name: d.name, email: d.email, changePct, recent, recentDate, prevAvg: Math.round(prevAvg) }
      return null
    }).filter(Boolean).map(f => {
      const donorKey = f.email?.trim() || f.name
      const acks = givingChangeAckHistory[donorKey] || []
      const isHandled = acks.length > 0 && new Date(acks[0].sent_at) > new Date(f.recentDate)
      return { ...f, isHandled }
    }).filter(f => !f.isHandled).sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
  }, [confirmedDonations, givingChangeMinGifts, givingChangeMinPct, givingChangeAckHistory])

  const { thisMonthTotal, repeatDonorsThisMonth, longestSupporter } = React.useMemo(() => {
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisMonthTotal = confirmedDonations.filter(d => new Date(d.created_at) >= thisMonthStart).reduce((s, d) => s + d.amount, 0)
    const repeatDonorsThisMonth = donorList.filter(d => {
      const donationsThisMonth = donations.filter(don => donationDonorKey(don) === contactDonorKey(d) && new Date(don.created_at) >= thisMonthStart)
      return donationsThisMonth.length > 0 && d.count > donationsThisMonth.length
    }).length
    const longestSupporter = donorList.length > 0
      ? donorList.map(d => ({ ...d, monthsSupporting: Math.max(1, Math.round((now.getTime() - new Date([...donations].filter(don => donationDonorKey(don) === contactDonorKey(d)).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]?.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30))) }))
          .sort((a, b) => b.monthsSupporting - a.monthsSupporting)[0]
      : null
    return { thisMonthTotal, repeatDonorsThisMonth, longestSupporter }
  }, [confirmedDonations, donations, donorList])

  const { uniqueDonorsThisYear, avgDonation, medianDonation } = React.useMemo(
    () => computeDonationSummaryStats(donations, { filterYear, fyEndMonth, fyEndDay, totalAllTime }),
    [donations, filterYear, fyEndMonth, fyEndDay, totalAllTime]
  )
  const currentYear = new Date().getFullYear()
  const irasDeadline = new Date(`${currentYear + 1}-01-31`)
  const daysToDeadline = Math.ceil((irasDeadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))

  const activeDonationFilterCount = [
    searchTerm !== '',
    filterType !== 'All',
    filterNric !== 'All',
    filterYear !== 'All',
    filterSource !== 'All',
    filterThankYou !== 'All',
  ].filter(Boolean).length

  // Was a plain top-level computation re-filtering/re-sorting the FULL donations array on every
  // render of the whole app (e.g. every keystroke on any other tab), not just when the Donations
  // tab's own search/filter/sort state changed. Memoized on its actual inputs.
  const filteredDonations = React.useMemo(() => donations.filter(d => {
    const q = searchTerm.toLowerCase().trim()
    const searchFields = charityIsIpc ? [d.donor_name, d.donor_email, d.donor_nric, d.notes, d.payment_ref, d.receipt_number, causeNameForDonation(d)] : [d.donor_name, d.donor_email, d.notes, d.payment_ref, d.receipt_number, causeNameForDonation(d)]
    const matchSearch = q === '' || searchFields.some(field => field?.toLowerCase().includes(q))
    const matchYear = filterYear === 'All' || fyOf(d.created_at).toString() === filterYear
    const matchType = filterType === 'All'
      || (filterType === 'Awaiting Payment' && d.payment_status !== 'confirmed' && d.payment_status !== 'refunded')
      || (filterType === 'Receipt Pending' && d.payment_status === 'confirmed' && !d.receipt_issued)
      || (filterType === 'Issued' && d.receipt_issued)
      || (filterType === 'Refunded' && d.payment_status === 'refunded')

    const matchNric = filterNric === 'All' || (filterNric === 'Missing NRIC' && !d.donor_nric && d.payment_status === 'confirmed')
    const matchSource = filterSource === 'All' || (filterSource === 'Manual' && d.source === 'manual') || (filterSource === 'App' && d.source !== 'manual')
    const matchThankYou = filterThankYou === 'All'
      || (filterThankYou === 'Sent' && d.thank_you_sent)
      || (filterThankYou === 'Not Sent' && !d.thank_you_sent && d.donor_email?.trim() && d.payment_status === 'confirmed')
      || (filterThankYou === 'No Email' && !d.donor_email?.trim())
    const matchMinAmount = !filterMinAmount || d.amount >= filterMinAmount
    return matchSearch && matchYear && matchType && matchNric && matchSource && matchThankYou && matchMinAmount
  }).sort((a, b) => {
    if (!donationSortBy) return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    let cmp = 0
    if (donationSortBy === 'amount') cmp = a.amount - b.amount
    if (donationSortBy === 'date') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    if (donationSortBy === 'donor') cmp = (a.donor_name || '').localeCompare(b.donor_name || '')
    if (donationSortBy === 'cause') cmp = (causeNameForDonation(a) || '').localeCompare(causeNameForDonation(b) || '')
    if (donationSortBy === 'source') cmp = (a.source === 'manual' ? 1 : 0) - (b.source === 'manual' ? 1 : 0)
    if (donationSortBy === 'reference') cmp = (a.payment_ref || '').localeCompare(b.payment_ref || '')
    if (donationSortBy === 'nric') cmp = (a.donor_nric ? 1 : 0) - (b.donor_nric ? 1 : 0)
    if (donationSortBy === 'payment') cmp = (a.payment_status || '').localeCompare(b.payment_status || '')
    if (donationSortBy === 'receipt') cmp = (a.receipt_issued ? 1 : 0) - (b.receipt_issued ? 1 : 0)
    if (donationSortBy === 'receiptNo') cmp = (a.receipt_number || a.payment_ref || '').localeCompare(b.receipt_number || b.payment_ref || '')
    if (donationSortBy === 'thankYou') cmp = (a.thank_you_sent ? 1 : 0) - (b.thank_you_sent ? 1 : 0)
    return donationSortDir === 'asc' ? cmp : -cmp
    // causeNameForDonation is a plain function recreated every render; omitted intentionally so
    // this memo doesn't recompute every render — it's derived from myCauses, which changing
    // without any of the listed deps also changing is not a real-world case here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [donations, searchTerm, charityIsIpc, filterYear, fyOf, filterType, filterNric, filterSource, filterThankYou, filterMinAmount, donationSortBy, donationSortDir])

  const donationsTotalPages = Math.max(1, Math.ceil(filteredDonations.length / donationsPerPage))
  const paginatedDonations = filteredDonations.slice(donationsPage * donationsPerPage, donationsPage * donationsPerPage + donationsPerPage)

  useEffect(() => {
    setDonationsPage(0)
  }, [searchTerm, filterType, filterNric, filterYear, filterSource, filterThankYou, filterMinAmount, donationSortBy, donationSortDir])

  const filteredDonorList = React.useMemo(() => {
    const q = searchTerm.toLowerCase()
    return combinedDonorList.filter(d => {
      const matchSearch = d.name?.toLowerCase().includes(q)
      const matchTopDonors = !filterTopDonorNames || filterTopDonorNames.includes(d.name)
      const matchDonorKeys = !filterDonorKeys || filterDonorKeys.includes(d.email?.trim() || d.nric || d.name)
      const matchStatus = donorStatusFilter === 'All'
        || (donorStatusFilter === 'Active' && !d.isContactOnly && !d.deactivated)
        || (donorStatusFilter === 'Prospect' && d.isContactOnly)
        || (donorStatusFilter === 'DoNotContact' && d.doNotContact)
        || (donorStatusFilter === 'Deactivated' && d.deactivated)
        || (donorStatusFilter === 'MajorDonor' && d.total >= (majorDonorThreshold || 1000))
      const matchYear = donorYearFilter === 'All' || (d.lastDate && fyOf(d.lastDate).toString() === donorYearFilter)
      return matchSearch && matchTopDonors && matchDonorKeys && matchStatus && matchYear
    })
  }, [combinedDonorList, searchTerm, filterTopDonorNames, filterDonorKeys, donorStatusFilter, donorYearFilter, fyOf, majorDonorThreshold])

  const sortedDonorList = React.useMemo(() => {
    if (!donorSortBy) return filteredDonorList
    const dir = donorSortDir === 'asc' ? 1 : -1
    const valueFor = (d: any) => {
      const donorKey = d.email?.trim() || d.name
      if (donorSortBy === 'name') return d.name?.toLowerCase() || ''
      if (donorSortBy === 'total') return d.total || 0
      if (donorSortBy === 'count') return d.count || 0
      if (donorSortBy === 'avg') return d.count > 0 ? d.total / d.count : 0
      if (donorSortBy === 'lastDate') return d.lastDate ? new Date(d.lastDate).getTime() : 0
      if (donorSortBy === 'recurring') { const g = recurringGifts.find(g => g.status === 'active' && (g.donor_email?.trim() || g.donor_name) === donorKey); return g ? Number(g.amount) : -1 }
      if (donorSortBy === 'pledge') { const p = pledges.find(p => p.status === 'pending' && (p.donor_email?.trim() || p.donor_name) === donorKey); return p ? Number(p.amount) : -1 }
      if (donorSortBy === 'warmth') { const w = getDonorWarmth(d); return w.daysSince === null ? Infinity : w.daysSince }
      return 0
    }
    return [...filteredDonorList].sort((a, b) => {
      const va = valueFor(a), vb = valueFor(b)
      if (va < vb) return -1 * dir
      if (va > vb) return 1 * dir
      return 0
    })
    // getDonorWarmth is a plain function recreated every render; omitted intentionally, same
    // reasoning as causeNameForDonation above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredDonorList, donorSortBy, donorSortDir, recurringGifts, pledges, donorLastContactMap])

  const donorsTotalPages = Math.max(1, Math.ceil(sortedDonorList.length / donorsPerPage))
  const paginatedDonorList = sortedDonorList.slice(donorsPage * donorsPerPage, donorsPage * donorsPerPage + donorsPerPage)

  useEffect(() => {
    setDonorsPage(0)
  }, [searchTerm, filterTopDonorNames, filterDonorKeys, donorStatusFilter, donorYearFilter])


  function exportPledgesExcel(searchedPledges: any) {
    const rows = searchedPledges.map((p: any) => ({
      'Donor Name': p.is_anonymous ? `${p.donor_name} (Anonymous)` : p.donor_name,
      'Email': p.donor_email || '',
      'Phone': p.donor_phone || '',
      'Amount (SGD)': p.amount,
      'Expected Date': new Date(p.expected_date).toLocaleDateString('en-SG'),
      'Status': p.status.charAt(0).toUpperCase() + p.status.slice(1),
      'Given So Far (SGD)': pledgeGivenTotals[p.id] || 0,
      'Multi-Year': p.is_multi_year ? `Yes (${p.total_years}y)` : 'No',
      'Programme': p.cause_id ? (myCauses.find(c => c.id === p.cause_id)?.title || '') : 'General / unrestricted',
      'Source': p.source || '',
      'Notes': p.notes || '',
      'Resolution Notes': p.resolution_notes || '',
      'Recorded By': p.created_by,
      'Recorded On': new Date(p.created_at).toLocaleDateString('en-SG'),
    }))
    if (rows.length === 0) { showToast('No pledges to export with current filters', 'error'); return }
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 25 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 30 }, { wch: 30 }, { wch: 24 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Pledges')
    XLSX.writeFile(wb, `GivingTree-Pledges-${charityName}-${new Date().toISOString().split('T')[0]}.xlsx`)
    logExport('pledges_excel', { row_count: rows.length })
  }

  function exportGrantsExcel(filteredGrants: any) {
    const rows = filteredGrants.map((g: any) => {
      const spent = grantExpenses.filter(e => e.grant_id === g.id).reduce((s, e) => s + Number(e.amount), 0)
      return {
        'Funder Name': g.funder_name,
        'Amount (SGD)': g.amount,
        'Status': g.status.charAt(0).toUpperCase() + g.status.slice(1),
        'Start Date': g.start_date ? new Date(g.start_date).toLocaleDateString('en-SG') : '',
        'Report Due Date': g.report_due_date ? new Date(g.report_due_date).toLocaleDateString('en-SG') : '',
        'Utilized (SGD)': spent,
        'Remaining (SGD)': Number(g.amount) - spent,
        'Utilization %': Number(g.amount) > 0 ? Math.round((spent / Number(g.amount)) * 100) : 0,
        'Disbursement Schedule': g.disbursement_schedule || '',
        'Purpose Restriction': g.purpose_restriction || '',
        'Recorded By': g.created_by || '',
        'Recorded On': new Date(g.created_at).toLocaleDateString('en-SG'),
      }
    })
    if (rows.length === 0) { showToast('No grants to export with current filters', 'error'); return }
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 24 }, { wch: 30 }, { wch: 24 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Grants')
    XLSX.writeFile(wb, `GivingTree-Grants-${charityName}-${new Date().toISOString().split('T')[0]}.xlsx`)
    logExport('grants_excel', { row_count: rows.length })
  }

  function exportInKindExcel() {
    const rows = inKindDonations.map(item => ({
      'Donor Name': item.donor_name,
      'Category': item.category.replace(/_/g, ' '),
      'Item / Service': item.item_description,
      'Estimated Value (SGD)': item.estimated_value,
      'Date Received': new Date(item.received_date).toLocaleDateString('en-SG'),
      'Programme': item.cause_id ? (myCauses.find(c => c.id === item.cause_id)?.title || '') : 'General',
      'Condition': item.condition || '',
      'Valuation Basis': item.valuation_basis || '',
      'Receipt No.': item.receipt_number || '',
      'Receipt Issued': item.receipt_issued ? 'Yes' : 'No',
      'Thank You Sent': item.thank_you_sent ? 'Yes' : 'No',
      'Impact Note': item.impact_note || '',
      'Photo on File': item.photo_url ? 'Yes' : 'No',
      'Notes': item.notes || '',
      'Recorded By': item.created_by || '',
    }))
    if (rows.length === 0) { showToast('No in-kind gifts to export', 'error'); return }
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 36 }, { wch: 18 }, { wch: 16 }, { wch: 24 }, { wch: 16 }, { wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 30 }, { wch: 24 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'In-Kind Gifts')
    XLSX.writeFile(wb, `GivingTree-InKindGifts-${charityName}-${new Date().toISOString().split('T')[0]}.xlsx`)
    logExport('in_kind_excel', { row_count: rows.length })
  }

  function exportRecurringExcel(filteredGifts: any) {
    const rows = filteredGifts.map((g: any) => ({
      'Donor Name': g.donor_name,
      'Email': g.donor_email || '',
      'Phone': g.donor_phone || '',
      'Amount (SGD)': g.amount,
      'Frequency': g.frequency,
      'Type': g.type === 'giro' ? 'GIRO' : g.type === 'habitual_paynow' ? 'Habitual PayNow' : g.type === 'standing_order' ? 'Standing Order' : 'Other',
      'Type Detail': g.type === 'other' ? (g.type_detail || '') : '',
      'Status': g.status.charAt(0).toUpperCase() + g.status.slice(1),
      'Linked Programme': g.cause_id ? (myCauses.find(c => c.id === g.cause_id)?.title || '') : '',
      'Start Date': g.start_date ? new Date(g.start_date).toLocaleDateString('en-SG') : '',
      'End Date': g.end_date ? new Date(g.end_date).toLocaleDateString('en-SG') : '',
      'Next Expected': g.next_expected_date ? new Date(g.next_expected_date).toLocaleDateString('en-SG') : '',
      'Last Received': g.last_received_date ? new Date(g.last_received_date).toLocaleDateString('en-SG') : '',
      'Total Received (SGD)': recurringGivenTotals[g.id]?.total || 0,
      'Payments Made': recurringGivenTotals[g.id]?.count || 0,
      'Bank Name': g.bank_name || '',
      'GIRO Reference': g.giro_reference || '',
      'Authorization Status': g.authorization_status || '',
      'Failed Deductions': (recurringFailedDeductionHistory[g.id] || []).length,
      'Pause Reason': g.pause_reason || '',
      'Pause Resume Date': g.pause_resume_date ? new Date(g.pause_resume_date).toLocaleDateString('en-SG') : '',
      'Recorded': g.created_at ? new Date(g.created_at).toLocaleDateString('en-SG') : '',
      'Notes': g.notes || '',
    }))
    if (rows.length === 0) { showToast('No recurring gifts to export with current filters', 'error'); return }
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 25 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 30 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Recurring Gifts')
    XLSX.writeFile(wb, `GivingTree-RecurringGifts-${charityName}-${new Date().toISOString().split('T')[0]}.xlsx`)
    logExport('recurring_gifts_excel', { row_count: rows.length })
  }

  async function saveDonorContact() {
    if (!addDonorForm.full_name.trim()) { setAddDonorError('Name is required'); return }
    setSavingDonorContact(true)
    setAddDonorError('')

    const newKey = addDonorForm.email?.trim() || addDonorForm.full_name.trim()
    const newNameLower = addDonorForm.full_name.trim().toLowerCase()
    // Two checks, not one: the exact-key match alone misses a same-name
    // collision whenever the existing donor has an email on file but this new
    // entry doesn't (or vice versa) — email and name aren't comparable keys.
    // Checks combinedDonorList (not activeDonorList) so it also catches a
    // duplicate against an existing prospect, not just a donor with real gifts.
    const alreadyExists = combinedDonorList.some(d =>
      (d.email?.trim() || d.name) === newKey || d.name?.trim().toLowerCase() === newNameLower
    )
    if (alreadyExists) {
      setAddDonorError('A donor with this name or email already exists in your donation records.')
      setSavingDonorContact(false)
      return
    }

    const { data, error } = await supabase.from('charity_donor_contacts').insert({
      charity_uen: charityUen,
      full_name: addDonorForm.full_name.trim(),
      email: addDonorForm.email.trim() || null,
      notes: addDonorForm.notes.trim() || null,
      created_by: session.user.email,
    }).select()

    setSavingDonorContact(false)
    if (error) { setAddDonorError(`Error: ${error.message}`); return }

    setDonorContacts(prev => [data[0], ...prev])
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'prospect_added',
      details: { donor_name: data[0].full_name, charity_uen: charityUen },
    })
    setShowAddDonorModal(false)
    setAddDonorForm({ full_name: '', email: '', notes: '' })
    showToast(`${data[0].full_name} added ✓`)
  }

  async function exportDonorsExcel(filteredDonors: any) {
    const { data: allNotes } = await supabase
      .from('donor_notes')
      .select('donor_key')
      .eq('charity_uen', charityUen)
    const noteCountByDonor: Record<string, any> = {}
    ;(allNotes || []).forEach(n => {
      noteCountByDonor[n.donor_key] = (noteCountByDonor[n.donor_key] || 0) + 1
    })

    const rows = filteredDonors.map((d: any) => {
      const donorKey = d.email?.trim() || d.name
      const b = donorBadgeMap[donorKey]
      const milestones = []
      if (b?.isFirstTime) milestones.push('First gift')
      if (b?.isBigGift) milestones.push('Big gift')
      if (b?.isLoyal) milestones.push('Loyal')
      if (b?.isBiggestYet) milestones.push('Biggest yet')

      const donorNric = donations.find(dn => (dn.donor_email?.trim() || dn.donor_nric || dn.donor_name) === donorKey && dn.donor_nric)?.donor_nric || ''

      const openPledge = pledges.find(p => p.status === 'pending' && (p.donor_email?.trim() || p.donor_name) === donorKey)
      const fulfilledPledgeCount = pledges.filter(p => p.status === 'fulfilled' && (p.donor_email?.trim() || p.donor_name) === donorKey).length

      const activeRecurring = recurringGifts.find(g => g.status === 'active' && (g.donor_email?.trim() || g.donor_name) === donorKey)
      const noteCount = noteCountByDonor[donorKey] || 0

      return {
        'Name': d.name,
        'Email': d.email || '',
        'NRIC/FIN': charityIsIpc ? donorNric : '',
        'Status': d.isContactOnly ? 'Prospect (no gift yet)' : d.deactivated ? 'Deactivated' : 'Active',
        'Total Given (SGD)': d.total,
        'Donations': d.count,
        'Avg. Donation (SGD)': d.count > 0 ? Math.round(d.total / d.count) : 0,
        'Last Donation': d.lastDate ? new Date(d.lastDate).toLocaleDateString('en-SG') : '',
        'Receipts Issued': d.count > 0 ? `${d.receipts}/${d.count}` : '',
        'Milestones': milestones.join(', '),
        'Tags': (donorTagsMap[donorKey] || []).map((t: any) => t.tag).join(', '),
        'Do Not Contact': d.doNotContact ? 'Yes' : 'No',
        'Open Pledge (SGD)': openPledge ? openPledge.amount : '',
        'Fulfilled Pledges': fulfilledPledgeCount || '',
        'Active Recurring Gift (SGD/cycle)': activeRecurring ? `${activeRecurring.amount} (${activeRecurring.frequency})` : '',
        'Communication Log Entries': noteCount || '',
      }
    })
    if (rows.length === 0) { showToast('No donors to export with current filters', 'error'); return }
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 25 }, { wch: 28 }, { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 24 }, { wch: 20 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Donors')
    XLSX.writeFile(wb, `GivingTree-Donors-${charityName}-${new Date().toISOString().split('T')[0]}.xlsx`)
    logExport('donors_excel', { row_count: rows.length })
  }

  function exportCampaignsExcel(filteredCampaigns: any) {
    const rows = filteredCampaigns.map((c: any) => {
      const raised = donations.filter(d => d.cause_id === c.id && d.payment_status === 'confirmed').reduce((s, d) => s + d.amount, 0)
      return {
        'Title': c.title,
        'Description': c.description || '',
        'Category': c.category || '',
        'Status': c.status.charAt(0).toUpperCase() + c.status.slice(1),
        'Target Amount (SGD)': c.target_amount || '',
        'Raised (SGD)': raised,
        'Start Date': c.start_date ? new Date(c.start_date).toLocaleDateString('en-SG') : '',
        'End Date': c.end_date ? new Date(c.end_date).toLocaleDateString('en-SG') : '',
        'Created': new Date(c.created_at).toLocaleDateString('en-SG'),
        'Tax-Deductible': charityIsIpc ? (c.tax_deductible === false ? 'No' : 'Yes') : 'N/A (non-IPC)',
        'Benefit Value per Gift (SGD)': c.benefit_value || '',
        'Permit Status': c.permit_status === 'obtained' ? 'Obtained' : c.permit_status === 'pending' ? 'Pending' : 'Not required',
        'Permit Number': c.permit_number || '',
        'Permit Expiry': c.permit_expiry ? new Date(c.permit_expiry).toLocaleDateString('en-SG') : '',
      }
    })
    if (rows.length === 0) { showToast('No campaigns to export with current filters', 'error'); return }
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 30 }, { wch: 45 }, { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Campaigns')
    XLSX.writeFile(wb, `GivingTree-Campaigns-${charityName}-${new Date().toISOString().split('T')[0]}.xlsx`)
    logExport('campaigns_excel', { row_count: rows.length })
  }

  function exportMassAppealsExcel(filteredAppeals: any) {
    const rows = filteredAppeals.map((a: any) => ({
      'Date': new Date(a.created_at).toLocaleDateString('en-SG'),
      'Campaign': a.cause_name || 'General Appeal',
      'Default Amount (SGD)': a.amount,
      'Message': a.message || '',
      'Donors Targeted': a.donor_count,
      'Sent': a.sent_count,
      'Failed': a.failed_count,
      'Status': a.status === 'sending' ? 'Sending' : a.failed_count > 0 ? 'Partial' : 'Sent',
      'Sent By': a.created_by,
    }))
    if (rows.length === 0) { showToast('No appeals to export with current filters', 'error'); return }
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 14 }, { wch: 25 }, { wch: 18 }, { wch: 40 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 24 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Mass Appeals')
    XLSX.writeFile(wb, `GivingTree-MassAppeals-${charityName}-${new Date().toISOString().split('T')[0]}.xlsx`)
    logExport('mass_appeals_excel', { row_count: rows.length })
  }

  function exportAuditLogExcel(filteredEntries: any) {
    const rows = filteredEntries.map((e: any) => ({
      'Date': new Date(e.created_at).toLocaleString('en-SG'),
      'Actor': e.actor_email || e.actor_type || '',
      'Action': e.action,
      'Details': e.details ? JSON.stringify(e.details) : '',
    }))
    if (rows.length === 0) { showToast('No activity to export with current filters', 'error'); return }
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 20 }, { wch: 26 }, { wch: 26 }, { wch: 60 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Audit Log')
    XLSX.writeFile(wb, `GivingTree-AuditLog-${charityName}-${new Date().toISOString().split('T')[0]}.xlsx`)
    logExport('audit_log_excel', { row_count: rows.length })
  }

  function exportDonationsExcel() {
    const rows = filteredDonations.map(d => ({
      'Donor Name': d.donor_name,
      'Email': d.donor_email || '',
      ...(charityIsIpc ? { 'NRIC/FIN': d.donor_nric || '' } : {}),
      'Amount (SGD)': d.amount,
      'Date': new Date(d.created_at).toLocaleDateString('en-SG'),
      'Source': d.source === 'manual' ? `Manual (${d.payment_method || ''})` : 'Giving Tree App',
      'Cause': causeNameForDonation(d) || 'General Donation',
      'Payment Status': d.payment_status === 'refunded' ? 'Refunded' : d.payment_status === 'confirmed' ? 'Confirmed' : 'Unverified',
      'Receipt Issued': d.receipt_issued ? 'Yes' : 'No',
      'Receipt No.': d.receipt_number || d.payment_ref || '',
      'Thank You Sent': d.thank_you_sent ? 'Yes' : 'No',
      'Notes': d.notes || '',
    }))
    if (rows.length === 0) { showToast('No donations to export with current filters', 'error'); return }
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = charityIsIpc
      ? [{ wch: 25 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 30 }]
      : [{ wch: 25 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 30 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Donations')
    XLSX.writeFile(wb, `GivingTree-Donations-${charityName}-${new Date().toISOString().split('T')[0]}.xlsx`)
    logExport('donations_excel', { row_count: rows.length, includes_nric: charityIsIpc })
  }

  // Year-filtered donor map for IRAS tab
  const irasYearDonorMap: Record<string, any> = {}
  donations.filter(d => filterYear !== 'All' && fyOf(d.created_at) === parseInt(filterYear) && d.payment_status === 'confirmed').forEach(d => {
    const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
    if (!irasYearDonorMap[key]) irasYearDonorMap[key] = { name: d.donor_name, total: 0, count: 0, donations: [] }
    irasYearDonorMap[key].total += d.amount
    irasYearDonorMap[key].count += 1
    irasYearDonorMap[key].donations.push(d)
  })
  const irasYearDonorList = Object.values(irasYearDonorMap).sort((a, b) => b.total - a.total)

  function exportIRASExcel() {
    if (filterYear === 'All') { showToast('Select a specific year before exporting'); return }
    const yearDonations = donations.filter(d => fyOf(d.created_at) === parseInt(filterYear) && d.payment_status === 'confirmed')
    const cover = [
      { 'Field': 'Charity Name', 'Value': charityName },
      { 'Field': 'UEN', 'Value': charityUen },
      { 'Field': 'Year of Assessment', 'Value': parseInt(filterYear) + 1 },
      { 'Field': 'Donation Year', 'Value': filterYear },
      { 'Field': 'Submission Deadline', 'Value': `31 January ${parseInt(filterYear) + 1}` },
      { 'Field': 'Generated On', 'Value': new Date().toLocaleDateString('en-SG') },
      { 'Field': 'Total Donations', 'Value': yearDonations.length },
      { 'Field': 'Total Amount (SGD)', 'Value': totalThisYear },
      { 'Field': 'Total 250% Deductible (SGD)', 'Value': totalThisYear * 2.5 },
      { 'Field': 'Donors with NRIC', 'Value': yearDonations.filter(d => d.donor_nric).length },
      { 'Field': 'Donors missing NRIC', 'Value': yearDonations.filter(d => !d.donor_nric).length },
      {},
      { 'Field': 'IMPORTANT', 'Value': 'This file is for reference only. Submit via IRAS myTax Portal or approved Donation Management System (DMS).' },
    ]
    const records = yearDonations.filter(d => d.donor_nric && d.payment_status === 'confirmed').map((d, i) => ({
      'No.': i + 1,
      'Donor Name': d.donor_name,
      'ID Type': /^[A-Z]\d{7}[A-Z]$/.test(d.donor_nric) ? 'NRIC/FIN' : 'UEN',
      'ID Number (NRIC/FIN/UEN)': d.donor_nric,
      'Donation Date': new Date(d.created_at).toLocaleDateString('en-SG'),
      'Donation Amount (SGD)': d.amount,
      '250% Tax Deductible (SGD)': d.amount * 2.5,
      'Donation Type': d.payment_method || 'PayNow',
      'Receipt Issued': d.receipt_issued ? 'Yes' : 'No',
      'Source': d.source === 'manual' ? 'Manual Entry' : 'Giving Tree App',
      'Notes': d.notes || '',
    }))
    const missing = yearDonations.filter(d => !d.donor_nric).map(d => ({
      'Donor Name': d.donor_name,
      'Donation Date': new Date(d.created_at).toLocaleDateString('en-SG'),
      'Amount (SGD)': d.amount,
      'Action Required': 'Request NRIC/FIN from donor before submitting this donation for tax deduction',
    }))
    const wb = XLSX.utils.book_new()
    const wsCover = XLSX.utils.json_to_sheet(cover)
    wsCover['!cols'] = [{ wch: 30 }, { wch: 50 }]
    XLSX.utils.book_append_sheet(wb, wsCover, 'Summary')
    const wsRecords = XLSX.utils.json_to_sheet(records)
    wsRecords['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 22 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, wsRecords, 'Donation Records')
    if (missing.length > 0) {
      const wsMissing = XLSX.utils.json_to_sheet(missing)
      wsMissing['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 45 }]
      XLSX.utils.book_append_sheet(wb, wsMissing, 'Missing NRIC ⚠️')
    }
    XLSX.writeFile(wb, `GivingTree-IRAS-${charityName}-YA${parseInt(filterYear) + 1}.xlsx`)
    logExport('iras_excel', { year: filterYear, record_count: records.length, includes_nric: true })
  }

  async function saveVisibleMetrics(metrics: any) {
    const { error } = await supabase.from('charity_contacts').update({ visible_metrics: metrics }).eq('charity_uen', charityUen)
    if (error) { showToast('Could not save your preferences', 'error'); return }
    setVisibleMetrics(metrics)
    setShowCustomizeAnalytics(false)
    showToast('Analytics view updated ✓')
  }

  async function toggleEnabledModule(key: any) {
    const turningOff = enabledModules[key] !== false
    if (turningOff) {
      const recordCounts: Record<string, number> = {
        campaigns: myCauses.filter(c => c.type === 'campaign').length + massAppeals.length,
        pledges: pledges.length,
        recurring: recurringGifts.length,
        grants: grants.length,
        inKind: inKindDonations.length,
      }
      const count = recordCounts[key] || 0
      if (count > 0) {
        showToast(`Can't hide this — you have ${count} record${count !== 1 ? 's' : ''} in it. Only empty features can be hidden.`, 'error')
        return
      }
    }
    const { error, next: updated } = await updateCharityJsonField(charityUen, 'enabled_modules', (current: any) => ({ ...(current || {}), [key]: !turningOff }))
    if (error) { showToast('Could not save your preferences', 'error'); return }
    setEnabledModules(updated)
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: updated[key] ? 'module_enabled' : 'module_disabled',
      details: { module: key, charity_uen: charityUen },
    })
    if (!updated[key] && activeTab === key) setActiveTab('dashboard')
    showToast(`${key.charAt(0).toUpperCase() + key.slice(1)} ${updated[key] ? 'enabled' : 'hidden'} ✓`)
  }

  async function toggleDashboardCard(cardKey: string) {
    const prev = hiddenDashboardCards
    const optimistic = prev.includes(cardKey) ? prev.filter(k => k !== cardKey) : [...prev, cardKey]
    setHiddenDashboardCards(optimistic)
    const { error, next: updated } = await updateCharityJsonField(charityUen, 'dashboard_hidden_cards', (current: any) => {
      const list: string[] = Array.isArray(current) ? current : []
      return list.includes(cardKey) ? list.filter(k => k !== cardKey) : [...list, cardKey]
    })
    if (error) { showToast('Could not save your preferences', 'error'); setHiddenDashboardCards(prev); return }
    setHiddenDashboardCards(updated)
  }

  function computeReorderedList(existing: string[], defaultOrder: string[], draggedKey: string, targetKey: string) {
    const base = defaultOrder.filter(k => !existing.includes(k)).length > 0
      ? [...existing, ...defaultOrder.filter(k => !existing.includes(k))]
      : existing
    const next = base.filter((k: string) => k !== draggedKey)
    const targetIdx = next.indexOf(targetKey)
    next.splice(targetIdx === -1 ? next.length : targetIdx, 0, draggedKey)
    return next
  }

  async function reorderDashboardCard(sectionId: string, defaultOrder: string[], draggedKey: string, targetKey: string) {
    if (draggedKey === targetKey) return
    const prev = dashboardCardOrder
    const existingOptimistic = Array.isArray(prev[sectionId]) ? prev[sectionId] : defaultOrder
    setDashboardCardOrder({ ...prev, [sectionId]: computeReorderedList(existingOptimistic, defaultOrder, draggedKey, targetKey) })
    const { error, next: updated } = await updateCharityJsonField(charityUen, 'dashboard_card_order', (current: any) => {
      const existing = current && Array.isArray(current[sectionId]) ? current[sectionId] : defaultOrder
      return { ...(current || {}), [sectionId]: computeReorderedList(existing, defaultOrder, draggedKey, targetKey) }
    })
    if (error) { showToast('Could not save your preferences', 'error'); setDashboardCardOrder(prev); return }
    setDashboardCardOrder(updated)
  }

  async function resetDashboardSection(sectionId: string, cardKeys: string[]) {
    const [hiddenResult, orderResult] = await Promise.all([
      updateCharityJsonField(charityUen, 'dashboard_hidden_cards', (current: any) => {
        const list: string[] = Array.isArray(current) ? current : []
        return list.filter(k => !cardKeys.includes(k))
      }),
      updateCharityJsonField(charityUen, 'dashboard_card_order', (current: any) => {
        const next = { ...(current || {}) }
        delete next[sectionId]
        return next
      }),
    ])
    if (hiddenResult.error || orderResult.error) { showToast('Could not reset this section', 'error'); return }
    setHiddenDashboardCards(hiddenResult.next)
    setDashboardCardOrder(orderResult.next)
    showToast('Section reset to default ✓')
  }

  function removeTeamMember(role: any, email: any) {
    const proceed = async () => {
      const columnMap: Record<string, string> = { ed: 'ed_emails', staff: 'staff_emails', board: 'board_emails', volunteer: 'volunteer_emails' }
      const currentMap: Record<string, any> = { ed: localEds, staff: localStaff, board: localBoardMembers, volunteer: localVolunteers }
      const setterMap: Record<string, any> = { ed: setLocalEds, staff: setLocalStaff, board: setLocalBoardMembers, volunteer: setLocalVolunteers }
      const updated = currentMap[role].filter((e: any) => e !== email)
      const { error } = await supabase.from('charity_contacts').update({ [columnMap[role]]: updated }).eq('charity_uen', charityUen)
      if (error) { showToast('Error removing', 'error'); return }
      await supabase.from('audit_log').insert({
        actor_type: 'charity',
        actor_email: session.user.email,
        action: 'team_member_removed',
        details: { email, role, charity_uen: charityUen },
      })
      setterMap[role](updated)
      showToast('Removed')
    }
    const roleLabel = role === 'ed' ? 'Executive Director' : role === 'staff' ? 'Staff' : role === 'board' ? 'a Board Member' : 'a Volunteer'
    if (email === session?.user?.email) {
      setConfirmModal({
        title: 'Remove your own access?',
        description: `You're about to remove yourself as ${roleLabel}. You'll immediately lose that access level and may be logged out of parts of the app.`,
        confirmLabel: 'Remove My Access',
        onConfirm: proceed,
      })
    } else {
      setConfirmModal({
        title: 'Remove this team member?',
        description: `${email} will immediately lose ${roleLabel} access to this charity's Giving Tree account. This can be undone by re-adding them.`,
        confirmLabel: 'Remove Access',
        onConfirm: proceed,
      })
    }
  }

  async function saveCumulativeThresholds() {
    const vals = cumulativeThresholdsInput.map((v: any) => parseFloat(v))
    if (vals.some((v: any) => !v || isNaN(v) || v <= 0)) { showToast('Enter three valid amounts', 'error'); return }
    const sorted = [...vals].sort((a, b) => a - b)
    if (sorted.some((v, i) => v !== vals[i])) { showToast('Amounts must be in ascending order', 'error'); return }
    const { error } = await supabase.from('charity_contacts').update({ cumulative_milestone_thresholds: vals }).eq('charity_uen', charityUen)
    if (error) { showToast('Could not save thresholds', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'cumulative_thresholds_updated',
      details: { thresholds: vals, charity_uen: charityUen },
    })
    setCumulativeThresholds(vals)
    setEditingCumulativeThresholds(false)
    showToast('Thresholds updated ✓')
  }

  async function saveDonorThresholds() {
    const giftVal = parseFloat(thankYouThresholdInput)
    const donorVal = parseFloat(majorDonorThresholdInput)
    if (!thankYouThresholdInput || isNaN(giftVal) || giftVal <= 0) { showToast('Enter a valid major gift amount', 'error'); return }
    if (!majorDonorThresholdInput || isNaN(donorVal) || donorVal <= 0) { showToast('Enter a valid major donor amount', 'error'); return }
    const { error } = await supabase.from('charity_contacts').update({ major_gift_threshold: giftVal, major_donor_threshold: donorVal }).eq('charity_uen', charityUen)
    if (error) { showToast('Could not save thresholds', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'donor_thresholds_updated',
      details: { major_gift_threshold: giftVal, major_donor_threshold: donorVal, charity_uen: charityUen },
    })
    setThankYouThreshold(giftVal)
    setMajorDonorThreshold(donorVal)
    setEditingDonorThresholds(false)
    showToast('Thresholds updated ✓')
  }

  async function saveAnnualGoal() {
    const val = parseFloat(goalInput)
    if (!goalInput || isNaN(val) || val <= 0) { showToast('Enter a valid goal amount', 'error'); return }
    const { error } = await supabase.from('charity_contacts').update({ annual_goal: val }).eq('charity_uen', charityUen)
    if (error) { showToast('Could not save goal', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'annual_goal_updated',
      details: { new_goal: val, charity_uen: charityUen },
    })
    setAnnualGoal(val)
    setEditingGoal(false)
    showToast('Annual goal updated ✓')
  }

  async function saveFyEnd() {
    const month = parseInt(fyEndMonthInput)
    const day = parseInt(fyEndDayInput)
    if (!month || month < 1 || month > 12) { showToast('Enter a valid month (1-12)', 'error'); return }
    const daysInMonth = new Date(2024, month, 0).getDate()
    if (!day || day < 1 || day > daysInMonth) { showToast(`Enter a valid day for that month (1-${daysInMonth})`, 'error'); return }
    const { error } = await supabase.from('charity_contacts').update({ fy_end_month: month, fy_end_day: day }).eq('charity_uen', charityUen)
    if (error) { showToast('Could not save financial year end', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'fiscal_year_end_changed',
      details: { old_month: fyEndMonth, old_day: fyEndDay, new_month: month, new_day: day, charity_uen: charityUen },
    })
    setFyEndMonth(month)
    setFyEndDay(day)
    setEditingFyEnd(false)
    showToast('Financial year end updated ✓')
  }

  async function saveAlertSensitivity() {
    const clamp = (key: string, min: number) => Math.max(min, parseInt(alertSensitivityInputs[key]) || min)
    const parsed = {
      lapsed_min_gifts: clamp('lapsed_min_gifts', 1),
      lapsed_min_days: clamp('lapsed_min_days', 1),
      giving_change_min_gifts: clamp('giving_change_min_gifts', 2),
      giving_change_min_pct: clamp('giving_change_min_pct', 1),
      recurring_trend_cycles: clamp('recurring_trend_cycles', 2),
      recurring_missed_threshold: clamp('recurring_missed_threshold', 1),
      pledge_watch_threshold: clamp('pledge_watch_threshold', 1),
      pledge_due_soon_days: clamp('pledge_due_soon_days', 1),
      concentration_top_n: clamp('concentration_top_n', 1),
    }
    const { error } = await supabase.from('charity_contacts').update(parsed).eq('charity_uen', charityUen)
    if (error) { showToast('Could not save these settings', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'alert_sensitivity_updated',
      details: { ...parsed, charity_uen: charityUen },
    })
    setLapsedMinGifts(parsed.lapsed_min_gifts)
    setLapsedMinDays(parsed.lapsed_min_days)
    setGivingChangeMinGifts(parsed.giving_change_min_gifts)
    setGivingChangeMinPct(parsed.giving_change_min_pct)
    setRecurringTrendCycles(parsed.recurring_trend_cycles)
    setRecurringMissedThreshold(parsed.recurring_missed_threshold)
    setPledgeWatchThreshold(parsed.pledge_watch_threshold)
    setPledgeDueSoonDays(parsed.pledge_due_soon_days)
    setConcentrationTopN(parsed.concentration_top_n)
    setEditingAlertSensitivity(false)
    showToast('Alert sensitivity updated ✓')
  }

  function showToast(msg: any, type = 'success') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ msg, type })
    toastTimerRef.current = setTimeout(() => setToast(null), 4000)
  }

  function generateThankYouNote(donor: any, badgeState: any) {
    setThankYouDraft({
      donor,
      badgeState,
      subject: fillTemplate(emailTemplates.milestone_thank_you?.subject || EMAIL_TEMPLATE_DEFAULTS.milestone_thank_you.subject, { donor_name: donor.name, charity_name: charityName }),
      text: buildThankYouNote(donor, badgeState),
    })
  }

  function buildThankYouNote(donor: any, badgeState: any) {
    const lines = []
    lines.push(`Dear ${donor.name},`)
    lines.push('')

    if (badgeState.unackedFirstTime) {
      lines.push(`Thank you so much for your first gift to ${charityName}. Supporters like you make it possible for us to keep doing this work, and we're so glad you're part of our community now.`)
    } else if (badgeState.unackedBiggestYet && badgeState.unackedLoyal) {
      lines.push(`We wanted to take a moment to recognise just how much your support has meant to us. Over ${donor.count} donations totalling $${donor.total.toLocaleString()}, you've become one of our most loyal supporters — and your most recent gift was your largest yet.`)
    } else if (badgeState.unackedLoyal) {
      lines.push(`With ${donor.count} donations to ${charityName} so far, you've become one of our most loyal supporters, and we wanted to say a heartfelt thank you for your continued generosity.`)
    } else if (badgeState.unackedBiggestYet) {
      lines.push(`We noticed your most recent gift was your largest yet, and we wanted to personally thank you for this incredible act of generosity.`)
    } else if (badgeState.unackedBigGift) {
      lines.push(`Thank you for your generous gift. Contributions like yours make a real difference in the work we're able to do.`)
    } else {
      lines.push(`Thank you so much for your continued support of ${charityName}.`)
    }

    lines.push('')
    lines.push(`Your total giving of $${donor.total.toLocaleString()} across ${donor.count} donation${donor.count > 1 ? 's' : ''} genuinely makes a difference, and we're deeply grateful to have you in our corner.`)
    lines.push('')
    lines.push(`With gratitude,`)
    lines.push(charityName)
    return lines.join('\n')
  }

  async function ackDonorBadges(donor: any, badgeState: any) {
    const donorKey = donor.email?.trim() || donor.name
    const badgesToAck = []
    if (badgeState.unackedFirstTime) badgesToAck.push('first_time')
    if (badgeState.unackedBigGift) badgesToAck.push('big_gift')
    if (badgeState.unackedLoyal) badgesToAck.push('loyal')
    if (badgeState.unackedBiggestYet) badgesToAck.push('biggest_yet')
    if (badgesToAck.length === 0) return
    const rows = badgesToAck.map(badge_type => ({ charity_uen: charityUen, donor_key: donorKey, badge_type }))
    const { error } = await supabase.from('donor_badge_acks').insert(rows)
    if (error) { console.error('Could not save badge acks:', error); return }
    loadDonorBadgeAcks()
  }

  function exportDonorContactsCSV() {
    const rows = donorList.map(d => ({
      'Donor Name': d.name,
      'Email': d.email || '',
      'Total Given (SGD)': d.total,
      'Number of Donations': d.count,
      'Last Donation': new Date(d.lastDate).toLocaleDateString('en-SG'),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 15 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Donor Contacts')
    XLSX.writeFile(wb, `GivingTree-DonorContacts-${charityName}.xlsx`)
    logExport('donor_contacts_excel', { row_count: rows.length })
  }

  // autoTable paginates its own rows automatically, but content written manually after a table
  // (via doc.text at lastAutoTable.finalY + N) isn't checked against the page boundary -- if the
  // table happens to end near the bottom of a page, that trailing text silently renders past the
  // edge of the page and never appears anywhere. Call this right after computing finalY, before
  // writing anything at it.
  function ensurePdfSpace(doc: any, y: number, neededHeight = 20): number {
    if (y + neededHeight > 280) { doc.addPage(); return 20 }
    return y
  }

  function exportWeeklySnapshotPDF() {
    const doc = new jsPDF()
    doc.setFillColor(27, 67, 50)
    doc.rect(0, 0, 210, 42, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20); doc.setFont('helvetica', 'bold')
    doc.text('Weekly Snapshot', 14, 20)
    doc.setFontSize(11); doc.setFont('helvetica', 'normal')
    doc.text(`${charityName}`, 14, 30)
    doc.setFontSize(9)
    doc.text(`Generated ${new Date().toLocaleDateString('en-SG')}`, 14, 37)

    doc.setTextColor(28, 28, 28)
    const weekAgo13 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const weekDonations = confirmedDonations.filter(d => new Date(d.created_at) >= weekAgo13)
    const weekTotal = weekDonations.reduce((s, d) => s + d.amount, 0)

    doc.setFontSize(13); doc.setFont('helvetica', 'bold')
    doc.text('Donations This Week', 14, 56)
    doc.setFontSize(11); doc.setFont('helvetica', 'normal')
    doc.text(`SGD $${weekTotal.toLocaleString()} across ${weekDonations.length} donation${weekDonations.length !== 1 ? 's' : ''}`, 14, 66)

    let y13 = 82
    doc.setFontSize(13); doc.setFont('helvetica', 'bold')
    doc.text('Lapsed Donors', 14, y13)
    y13 += 8
    doc.setFontSize(10); doc.setFont('helvetica', 'normal')
    if (allGivingChangeFlags.length === 0) {
      doc.text('No notable lapsed donors flagged right now.', 14, y13)
      y13 += 8
    } else {
      autoTable(doc, {
        startY: y13,
        head: [['Donor', 'Change']],
        body: allGivingChangeFlags.slice(0, 10).map(f => [f.name, `${f.changePct > 0 ? '+' : ''}${f.changePct}%`]),
        margin: { left: 14 },
      })
      y13 = ensurePdfSpace(doc, (doc as any).lastAutoTable.finalY + 10)
    }

    doc.setFontSize(13); doc.setFont('helvetica', 'bold')
    doc.text('Pledges Overdue', 14, y13)
    y13 += 8
    doc.setFontSize(10); doc.setFont('helvetica', 'normal')
    const overduePledges13 = pledges.filter(p => p.status === 'pending' && new Date(p.expected_date) < new Date())
    if (overduePledges13.length === 0) {
      doc.text('No overdue pledges.', 14, y13)
      y13 += 8
    } else {
      autoTable(doc, {
        startY: y13,
        head: [['Donor', 'Amount', 'Expected']],
        body: overduePledges13.slice(0, 10).map(p => [p.donor_name, `$${Number(p.amount).toLocaleString()}`, new Date(p.expected_date).toLocaleDateString('en-SG')]),
        margin: { left: 14 },
      })
      y13 = ensurePdfSpace(doc, (doc as any).lastAutoTable.finalY + 10)
    }

    doc.setFontSize(13); doc.setFont('helvetica', 'bold')
    doc.text('Upcoming Milestones', 14, y13)
    y13 += 8
    doc.setFontSize(10); doc.setFont('helvetica', 'normal')
    const milestonesThisWeek13 = weekDonations.filter(d => {
      const b = donationBadgeInfo[d.id]
      return b && (b.isFirstTime || b.isBiggestYet)
    })
    if (milestonesThisWeek13.length === 0) {
      doc.text('No milestones this week.', 14, y13)
    } else {
      doc.text(`${milestonesThisWeek13.length} donor milestone${milestonesThisWeek13.length !== 1 ? 's' : ''} this week (new donors and biggest-yet gifts).`, 14, y13)
    }

    doc.save(`weekly-snapshot-${new Date().toISOString().split('T')[0]}.pdf`)
    logExport('weekly_snapshot_pdf')
  }

  function exportAnalyticsPDF() {
    const doc = new jsPDF()
    doc.setFillColor(27, 67, 50)
    doc.rect(0, 0, 210, 42, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20); doc.setFont('helvetica', 'bold')
    doc.text('Analytics Snapshot', 14, 20)
    doc.setFontSize(11); doc.setFont('helvetica', 'normal')
    doc.text(`${charityName} · ${filterYear === 'All' ? 'All Time' : filterYear}`, 14, 30)
    doc.setFontSize(9)
    doc.text(`Generated ${new Date().toLocaleDateString('en-SG')}`, 14, 37)

    doc.setTextColor(28, 28, 28)
    doc.setFontSize(13); doc.setFont('helvetica', 'bold')
    doc.text('Key Metrics', 14, 56)
    doc.setFontSize(11); doc.setFont('helvetica', 'normal')
    const stats = [
      ['Total Raised', `SGD $${totalThisYear.toLocaleString()}`],
      ['Unique Donors', `${uniqueDonorsThisYear.length}`],
      ['Average Donation', `SGD $${avgDonation.toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
      ['Median Donation', `SGD $${medianDonation.toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
      ['Total Transactions', `${donations.length}`],
      ['Repeat Donors (current month)', `${repeatDonorsThisMonth}`],
      ['Longest Supporter', longestSupporter ? `${longestSupporter.name} (${longestSupporter.monthsSupporting} mo)` : '—'],
    ]
    let y = 66
    stats.forEach(([label, value]) => {
      doc.setFont('helvetica', 'normal'); doc.text(label, 14, y)
      doc.setFont('helvetica', 'bold'); doc.text(value, 120, y)
      y += 8
    })

    y += 6
    if (causePerformanceThisYear.length > 0) {
      doc.setFontSize(13); doc.setFont('helvetica', 'bold')
      doc.text('Campaign Performance', 14, y)
      y += 4
      const campaignRows = causePerformanceThisYear.filter(r => !r.isGeneral)
      const generalRow = causePerformanceThisYear.find(r => r.isGeneral)
      autoTable(doc, {
        startY: y,
        head: [['Campaign', 'Total (SGD)', 'Donations', 'Donors', 'Avg (SGD)']],
        body: campaignRows.length ? campaignRows.map(row => [row.title, `$${row.total.toLocaleString()}`, row.count, row.donors, `$${row.avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}`]) : [['No campaign-tagged donations', '', '', '', '']],
        foot: generalRow ? [['General / Untagged Giving', `$${generalRow.total.toLocaleString()}`, generalRow.count, '—', `$${generalRow.avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}`]] : [],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [64, 145, 108], textColor: [255, 255, 255] },
        footStyles: { fontStyle: 'italic', textColor: [122, 110, 98] },
      })
      y = ensurePdfSpace(doc, (doc as any).lastAutoTable.finalY + 14)
    }

    doc.setFontSize(13); doc.setFont('helvetica', 'bold')
    doc.text('Top Donors', 14, y)
    y += 4
    autoTable(doc, {
      startY: y,
      head: [['Donor', 'Total Given (SGD)', 'Donations']],
      body: donorList.slice(0, 10).length ? donorList.slice(0, 10).map(d => [d.name, `$${d.total.toLocaleString()}`, d.count]) : [['No donors yet', '', '']],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [212, 160, 23], textColor: [27, 67, 50] },
    })

    const finalY = ensurePdfSpace(doc, (doc as any).lastAutoTable.finalY + 14)
    doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setTextColor(120, 120, 120)
    doc.text('Generated by Giving Tree — a free donation platform for Singapore charities.', 14, finalY)

    doc.save(`GivingTree-Analytics-${charityName}-${filterYear}.pdf`)
    logExport('analytics_pdf', { year: filterYear })
  }

  function exportPDF() {
    const yearDonationsForExport = filterYear === 'All'
      ? donations.filter(d => d.payment_status === 'confirmed')
      : donations.filter(d => new Date(d.created_at).toLocaleDateString('en-SG', { year: 'numeric' }) === filterYear && d.payment_status === 'confirmed')
    const doc = new jsPDF()
    doc.setFontSize(18); doc.setFont('helvetica', 'bold')
    doc.text(`Giving Tree — Donation Report ${filterYear}`, 14, 22)
    doc.setFontSize(11); doc.setFont('helvetica', 'normal')
    doc.text(`Charity: ${charityName}`, 14, 32)
    doc.text(`UEN: ${charityUen}`, 14, 39)
    doc.text(`Generated: ${new Date().toLocaleDateString('en-SG')}`, 14, 46)
    doc.text(`Total: SGD $${yearDonationsForExport.reduce((s, d) => s + d.amount, 0).toLocaleString()}`, 14, 53)
    autoTable(doc, {
      startY: 62,
      head: [['Donor', 'Amount (SGD)', 'Date', 'Receipt']],
      body: yearDonationsForExport.map(d => [d.donor_name, `$${d.amount.toFixed(2)}`, new Date(d.created_at).toLocaleDateString('en-SG'), d.receipt_issued ? 'Issued' : 'Pending']),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [64, 145, 108], textColor: [255, 255, 255] },
    })
    doc.save(`GivingTree-Report-${charityName}-${filterYear}.pdf`)
    logExport('donation_report_pdf', { year: filterYear, row_count: yearDonationsForExport.length })
  }

  function exportQuarterlyBoardReportPDF() {
    const doc = new jsPDF()
    doc.setFillColor(27, 67, 50)
    doc.rect(0, 0, 210, 42, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20); doc.setFont('helvetica', 'bold')
    doc.text('Quarterly Board Summary', 14, 20)
    doc.setFontSize(11); doc.setFont('helvetica', 'normal')
    const now54 = new Date()
    const quarterLabel54 = `Q${Math.floor(now54.getMonth() / 3) + 1} ${now54.getFullYear()}`
    doc.text(`${charityName} · ${quarterLabel54}`, 14, 30)
    doc.setFontSize(9)
    doc.text(`Generated ${now54.toLocaleDateString('en-SG')}`, 14, 37)

    doc.setTextColor(28, 28, 28)
    const qStart = new Date(now54.getFullYear(), Math.floor(now54.getMonth() / 3) * 3, 1)
    const lyQStart = new Date(now54.getFullYear() - 1, Math.floor(now54.getMonth() / 3) * 3, 1)
    const lyQEnd = new Date(now54.getFullYear() - 1, Math.floor(now54.getMonth() / 3) * 3 + 3, 1)
    const qDonations = confirmedDonations.filter(d => new Date(d.created_at) >= qStart)
    const lyQDonations = confirmedDonations.filter(d => new Date(d.created_at) >= lyQStart && new Date(d.created_at) < lyQEnd)
    const qTotal = qDonations.reduce((s, d) => s + d.amount, 0)
    const lyQTotal = lyQDonations.reduce((s, d) => s + d.amount, 0)
    const yoyPct = lyQTotal > 0 ? Math.round(((qTotal - lyQTotal) / lyQTotal) * 100) : null

    const activeRecurring54 = recurringGifts.filter(g => g.status === 'active')
    const recurringMonthly54 = activeRecurring54.filter(g => g.authorization_status !== 'terminated').reduce((s, g) => s + monthlyEquivalentAmount(g), 0)
    const recurringQTotal = recurringMonthly54 * 3
    const oneOffQTotal = qTotal - qDonations.filter(d => d.recurring_gift_id).reduce((s, d) => s + d.amount, 0)

    const byMethod54: Record<string, any> = {}
    qDonations.forEach(d => {
      const method = d.source === 'manual' ? (d.payment_method || 'Manual') : 'PayNow'
      byMethod54[method] = (byMethod54[method] || 0) + d.amount
    })

    const qDonorKeys = new Set(qDonations.map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name))
    const priorDonorKeys = new Set(confirmedDonations.filter(d => new Date(d.created_at) < qStart).map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name))
    const newThisQuarter = [...qDonorKeys].filter(k => !priorDonorKeys.has(k)).length
    const lyQDonorKeys = new Set(lyQDonations.map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name))
    const retainedFromLastYear = [...lyQDonorKeys].filter(k => qDonorKeys.has(k)).length
    const retentionPct54 = lyQDonorKeys.size > 0 ? Math.round((retainedFromLastYear / lyQDonorKeys.size) * 100) : null

    let y54 = 56
    doc.setFontSize(13); doc.setFont('helvetica', 'bold')
    doc.text('Revenue by Source', 14, y54)
    y54 += 10
    doc.setFontSize(10); doc.setFont('helvetica', 'normal')
    const rows54 = [
      ['Total this quarter', `SGD $${qTotal.toLocaleString()}`],
      ['  Recurring (projected)', `SGD $${Math.round(recurringQTotal).toLocaleString()}`],
      ['  One-off gifts', `SGD $${Math.round(oneOffQTotal).toLocaleString()}`],
      ...Object.entries(byMethod54).map(([m, amt]) => [`  via ${m}`, `SGD $${amt.toLocaleString()}`]),
    ]
    rows54.forEach(([label, value]) => {
      doc.text(label, 14, y54)
      doc.text(value, 130, y54)
      y54 += 7
    })

    y54 += 8
    doc.setFontSize(13); doc.setFont('helvetica', 'bold')
    doc.text('Donors', 14, y54)
    y54 += 10
    doc.setFontSize(10); doc.setFont('helvetica', 'normal')
    const donorRows54 = [
      ['New donors this quarter', `${newThisQuarter}`],
      ['Retention (same quarter last year)', retentionPct54 !== null ? `${retentionPct54}%` : 'No prior-year data'],
      ['Year-on-year revenue', yoyPct !== null ? `${yoyPct >= 0 ? '+' : ''}${yoyPct}% vs same quarter last year` : 'No prior-year data'],
    ]
    donorRows54.forEach(([label, value]) => {
      doc.text(label, 14, y54)
      doc.text(value, 130, y54)
      y54 += 7
    })

    const finalY54 = y54 + 14
    doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setTextColor(120, 120, 120)
    doc.text('Generated by Giving Tree — a free donation platform for Singapore charities.', 14, finalY54)

    doc.save(`GivingTree-QuarterlyBoardSummary-${charityName}-${quarterLabel54.replace(' ', '-')}.pdf`)
    logExport('quarterly_board_report_pdf', { quarter: quarterLabel54 })
  }

  function exportGrantReportPDF(grant: any) {
    const doc = new jsPDF()
    const myExpenses = grantExpenses.filter(e => e.grant_id === grant.id).sort((a, b) => new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime())
    const totalSpent = myExpenses.reduce((s, e) => s + Number(e.amount), 0)
    const remaining = Number(grant.amount) - totalSpent

    doc.setFillColor(27, 67, 50)
    doc.rect(0, 0, 210, 42, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18); doc.setFont('helvetica', 'bold')
    doc.text('Grant Expenditure Report', 14, 20)
    doc.setFontSize(11); doc.setFont('helvetica', 'normal')
    doc.text(`${charityName} · Prepared for ${grant.funder_name}`, 14, 30)
    doc.setFontSize(9)
    doc.text(`Generated ${new Date().toLocaleDateString('en-SG')}`, 14, 37)

    doc.setTextColor(28, 28, 28)
    let y = 56
    doc.setFontSize(12); doc.setFont('helvetica', 'bold')
    doc.text('Grant Summary', 14, y)
    y += 10
    doc.setFontSize(10); doc.setFont('helvetica', 'normal')
    const summaryRows = [
      ['Funder', grant.funder_name],
      ['Grant Amount', `SGD $${Number(grant.amount).toLocaleString()}`],
      ['Disbursement Schedule', grant.disbursement_schedule || 'N/A'],
      ['Purpose Restriction', grant.purpose_restriction || 'N/A'],
      ['Total Spent to Date', `SGD $${totalSpent.toLocaleString()}`],
      ['Remaining Balance', `SGD $${remaining.toLocaleString()}`],
    ]
    summaryRows.forEach(([label, value]) => {
      doc.setFont('helvetica', 'normal'); doc.text(label, 14, y)
      doc.setFont('helvetica', 'bold')
      const lines = doc.splitTextToSize(value, 110)
      doc.text(lines, 90, y)
      y += lines.length * 6 + 2
    })

    y += 8
    doc.setFontSize(12); doc.setFont('helvetica', 'bold')
    doc.text('Itemised Expenditure', 14, y)
    y += 4
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Description', 'Amount (SGD)']],
      body: myExpenses.length ? myExpenses.map(e => [
        new Date(e.expense_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }),
        e.description,
        `$${Number(e.amount).toLocaleString()}`,
      ]) : [['No expenses logged yet', '', '']],
      foot: [['', 'Total', `$${totalSpent.toLocaleString()}`]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [27, 67, 50], textColor: [255, 255, 255] },
      footStyles: { fillColor: [250, 247, 242], textColor: [27, 67, 50], fontStyle: 'bold' },
    })

    const finalY = ensurePdfSpace(doc, (doc as any).lastAutoTable.finalY + 14)
    doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setTextColor(120, 120, 120)
    doc.text(`Prepared by ${charityName}. Generated by Giving Tree — a free donation platform for Singapore charities.`, 14, finalY, { maxWidth: 180 })

    doc.save(`${grant.funder_name.replace(/[^a-zA-Z0-9]/g, '_')}-Grant-Report-${new Date().toISOString().split('T')[0]}.pdf`)
    logExport('grant_report_pdf', { funder_name: grant.funder_name })
  }

  function generateReceiptPDFDoc(donation: any) {
    const doc = new jsPDF()
    const isIpc = charityIsIpc
    const pageWidth = 210
    const pageHeight = 297
    const margin = 22
    const contentWidth = pageWidth - margin * 2
    const forest = [27, 67, 50] as [number, number, number]
    const sage = [61, 122, 92] as [number, number, number]
    const gold = [180, 135, 14] as [number, number, number]
    const mutedText = [130, 122, 112] as [number, number, number]
    const faintText = [178, 172, 162] as [number, number, number]
    const darkText = [35, 35, 35] as [number, number, number]
    const hairline = [232, 226, 216] as [number, number, number]
    // Small uppercase labels (ISSUED TO, AMOUNT DONATED, etc.) get slight letter-spacing for a
    // more considered print feel — but only when left-aligned. jsPDF's width calc for
    // center/right-aligned text doesn't account for charSpace, so applying it there silently
    // throws off the centering/right-edge alignment.
    const microLabel = (text: any, x: any, ty: any, opts: any = {}) => {
      if (opts.align === 'center' || opts.align === 'right') { doc.text(text, x, ty, opts); return }
      doc.setCharSpace(0.6)
      doc.text(text, x, ty, opts)
      doc.setCharSpace(0)
    }

    // Faint full-page watermark — logo if we have one, else a monogram of the charity's initial —
    // so the page still reads as distinctly *this* charity's document even with the header covered.
    try {
      doc.saveGraphicsState()
      doc.setGState(new (doc as any).GState({ opacity: 0.045 }))
      if (charityLogoDataUrl) {
        const fmt = charityLogoDataUrl.startsWith('data:image/png') ? 'PNG' : charityLogoDataUrl.startsWith('data:image/webp') ? 'WEBP' : 'JPEG'
        const size = 130
        doc.addImage(charityLogoDataUrl, fmt, (pageWidth - size) / 2, (pageHeight - size) / 2, size, size)
      } else {
        doc.setFont('times', 'bold')
        doc.setFontSize(260)
        doc.setTextColor(...forest)
        doc.text((charityName || 'C').trim().charAt(0).toUpperCase(), pageWidth / 2, pageHeight / 2 + 60, { align: 'center' })
      }
      doc.restoreGraphicsState()
    } catch (e) { console.error('Could not render receipt watermark:', e) }

    // Header — logo left in a white badge (so logos with a light background sit cleanly on the
    // green field instead of looking like a pasted sticker), charity identity right.
    const headerHeight = 46
    doc.setFillColor(...forest)
    doc.rect(0, 0, pageWidth, headerHeight, 'F')
    doc.setFillColor(...gold)
    doc.rect(0, headerHeight, pageWidth, 0.9, 'F')

    const hasLogo = !!charityLogoDataUrl
    let textX = margin
    if (hasLogo) {
      try {
        const fmt = charityLogoDataUrl.startsWith('data:image/png') ? 'PNG' : charityLogoDataUrl.startsWith('data:image/webp') ? 'WEBP' : 'JPEG'
        const logoSize = 25, badgePad = 3.5, badgeSize = logoSize + badgePad * 2
        const badgeY = (headerHeight - badgeSize) / 2
        doc.setFillColor(255, 255, 255)
        doc.roundedRect(margin, badgeY, badgeSize, badgeSize, 2.5, 2.5, 'F')
        doc.addImage(charityLogoDataUrl, fmt, margin + badgePad, badgeY + badgePad, logoSize, logoSize)
        textX = margin + badgeSize + 10
      } catch (e) { console.error('Could not embed logo in receipt:', e) }
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    microLabel('OFFICIAL DONATION RECEIPT', textX, 17)
    doc.setFontSize(19)
    doc.setFont('times', 'bold')
    doc.text(charityName || 'Charity', textX, 27.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(220, 227, 223)
    doc.text(`UEN ${charityUen || ''}  ·  ${isIpc ? 'Institution of a Public Character' : 'Registered Charity'}`, textX, 35.5)

    let y = 62
    doc.setFontSize(9)
    doc.setTextColor(...mutedText)
    microLabel('ISSUED TO', margin, y)
    microLabel('RECEIPT NO.', pageWidth - margin, y, { align: 'right' })
    y += 7
    doc.setFontSize(16)
    doc.setFont('times', 'bold')
    doc.setTextColor(...darkText)
    doc.text(donation.receipt_name || donorReceiptNameOverrides[donation.donor_email?.trim() || donation.donor_name] || donation.donor_name || '', margin, y)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...forest)
    doc.text(donation.receipt_number || donation.payment_ref || 'N/A', pageWidth - margin, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')

    y += 16
    doc.setDrawColor(...hairline)
    doc.line(margin, y, pageWidth - margin, y)
    y += 13
    doc.setFontSize(9)
    doc.setTextColor(...mutedText)
    microLabel('AMOUNT DONATED', pageWidth / 2, y, { align: 'center' })
    y += 13
    doc.setFontSize(31)
    doc.setFont('times', 'bold')
    doc.setTextColor(...forest)
    doc.text(`SGD $${Number(donation.amount).toLocaleString()}.00`, pageWidth / 2, y, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    y += 13
    doc.setDrawColor(...hairline)
    doc.line(margin, y, pageWidth - margin, y)
    y += 7
    const facts = [
      ['Donation date', new Date(donation.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })],
      ['Payment method', donation.source === 'manual' ? (donation.payment_method || 'Manual') : 'PayNow'],
    ]
    if (donation.receipt_issued_at && new Date(donation.receipt_issued_at).toDateString() !== new Date(donation.created_at).toDateString()) {
      facts.push(['Receipt issued', new Date(donation.receipt_issued_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })])
    }
    const causeTitle = causeNameForDonation(donation)
    if (causeTitle) facts.push(['Designated to', causeTitle])
    if (donation.donor_nric) facts.push(['NRIC / FIN on file', donation.donor_nric])
    const linkedRecurringGift = donation.recurring_gift_id ? recurringGifts.find(g => g.id === donation.recurring_gift_id) : null
    if (linkedRecurringGift) facts.push(['Recurring gift ref.', linkedRecurringGift.reference || `${linkedRecurringGift.frequency} giving`])
    const linkedPledge = pledges.find(p => p.fulfilled_donation_id === donation.id)
    if (linkedPledge) facts.push(['Pledge ref.', linkedPledge.reference || '—'])
    if (donation.receipt_voided) facts.push(['Status', 'VOIDED'])
    if (donation.reissued_from) facts.push(['Reissued from receipt', donation.reissued_from])

    facts.forEach(([label, value], i) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(...mutedText)
      doc.text(label, margin, y)
      doc.setFont('times', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(...darkText)
      doc.text(String(value), pageWidth - margin, y, { align: 'right' })
      y += 9
      if (i < facts.length - 1) {
        doc.setDrawColor(...hairline)
        doc.line(margin, y - 4.5, pageWidth - margin, y - 4.5)
      }
    })
    doc.setFont('helvetica', 'normal')

    const isAutoGeneratedNote = donation.notes === 'Pledge fulfillment' || /^Recurring .+ gift$/.test(donation.notes || '')
    if (donation.notes && !isAutoGeneratedNote) {
      y += 5
      const noteLines = doc.splitTextToSize(donation.notes, contentWidth - 10)
      doc.setFillColor(...faintText)
      doc.rect(margin, y, 0.8, noteLines.length * 5.5 + 6, 'F')
      doc.setFontSize(8.5)
      doc.setTextColor(...mutedText)
      microLabel('NOTE', margin + 5, y + 4.5)
      doc.setFontSize(10.5)
      doc.setFont('times', 'italic')
      doc.setTextColor(...darkText)
      doc.text(noteLines, margin + 5, y + 11)
      doc.setFont('helvetica', 'normal')
      y += noteLines.length * 5.5 + 14
    } else {
      y += 4
    }

    if (isIpc) {
      y += 4
      doc.setFillColor(...sage)
      doc.rect(margin, y, 0.8, 19, 'F')
      doc.setFontSize(11)
      doc.setFont('times', 'bold')
      doc.setTextColor(...sage)
      doc.text('250% tax deductible', margin + 6, y + 7.5)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(...mutedText)
      doc.text(`Estimated tax savings at 22%: SGD $${(donation.amount * 2.5 * 0.22).toLocaleString(undefined, { maximumFractionDigits: 0 })}.00`, margin + 6, y + 15)
      y += 25
      if (!donation.donor_nric) {
        doc.setFontSize(9.5)
        doc.setTextColor(...gold)
        doc.text('⚠ NRIC/FIN not on file — required from the donor before this can be submitted for tax deduction.', margin, y, { maxWidth: contentWidth })
        y += 10
      }
    }

    if (donation.impact_note?.trim()) {
      y += 8
      doc.setFillColor(...gold)
      const impactLines = doc.splitTextToSize(`“${donation.impact_note.trim()}”`, contentWidth - 10)
      doc.rect(margin, y, 0.8, impactLines.length * 5.5 + 6, 'F')
      doc.setFontSize(8.5)
      doc.setTextColor(...gold)
      microLabel('THE DIFFERENCE YOUR GIFT MADE', margin + 5, y + 4.5)
      doc.setFontSize(11)
      doc.setFont('times', 'italic')
      doc.setTextColor(...forest)
      doc.text(impactLines, margin + 5, y + 11)
      doc.setFont('helvetica', 'normal')
      y += impactLines.length * 5.5 + 12
    }

    y += 10
    doc.setDrawColor(...hairline)
    doc.line(margin, y, pageWidth - margin, y)
    y += 12
    doc.setFontSize(12)
    doc.setFont('times', 'italic')
    doc.setTextColor(...forest)
    doc.text('With heartfelt thanks for your generosity,', pageWidth - margin, y, { align: 'right' })
    y += 8.5
    doc.setFont('times', 'bolditalic')
    doc.setFontSize(13)
    doc.text(`The ${charityName || 'team'}`, pageWidth - margin, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')

    // Footer sits at a fixed distance from the bottom for a consistent look, but if unusually
    // long content (many facts + note + impact quote) would run into it, push it down instead —
    // never let the two collide.
    const footerY = Math.max(pageHeight - 26, y + 18)
    doc.setDrawColor(...hairline)
    doc.setLineWidth(0.4)
    doc.roundedRect(margin - 6, 52, contentWidth + 12, footerY - 58, 2, 2, 'S')
    doc.setLineWidth(0.2)

    doc.setDrawColor(...hairline)
    doc.line(margin, footerY, pageWidth - margin, footerY)
    doc.setFontSize(9)
    doc.setTextColor(...mutedText)
    doc.text('Issued via Giving Tree, a donation platform for Singapore charities', pageWidth / 2, footerY + 7.5, { align: 'center' })
    doc.setFontSize(8.5)
    doc.setTextColor(...faintText)
    doc.text(
      isIpc
        ? 'Tax savings shown assume a flat 22% rate for illustration only. Actual savings depend on your tax bracket.'
        : 'This charity is registered but not an IPC — this donation is not tax deductible.',
      pageWidth / 2, footerY + 15, { align: 'center', maxWidth: contentWidth }
    )

    return doc
  }

  function exportSingleReceiptPDF(donation: any) {
    const doc = generateReceiptPDFDoc(donation)
    doc.save(`Receipt-${donation.receipt_number || donation.payment_ref || donation.id}.pdf`)
    logExport('receipt_pdf', { donation_id: donation.id, donor_name: donation.donor_name })
  }

  function getReceiptPDFBase64(donation: any) {
    const doc = generateReceiptPDFDoc(donation)
    return doc.output('datauristring').split(',')[1]
  }

  function generateDonorYearEndStatementDoc(donorName: any, donorDonations: any, year: any) {
    const doc = new jsPDF()
    const sorted = [...donorDonations].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    const total = sorted.reduce((s, d) => s + d.amount, 0)

    doc.setFillColor(27, 67, 50)
    doc.rect(0, 0, 210, 42, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.text(charityName || 'Charity', 14, 20)
    doc.setFontSize(10)
    doc.text(`UEN ${charityUen || ''} · Annual Giving Statement ${year}`, 14, 30)

    doc.setTextColor(28, 28, 28)
    doc.setFontSize(13); doc.setFont('helvetica', 'bold')
    doc.text(`Dear ${donorName},`, 14, 56)
    doc.setFontSize(10); doc.setFont('helvetica', 'normal')
    doc.text(`Thank you for your generosity in ${year}. Here is a summary of your giving this year.`, 14, 64, { maxWidth: 180 })

    doc.setFontSize(12); doc.setFont('helvetica', 'bold')
    doc.text(`Total given in ${year}: SGD $${total.toLocaleString()}`, 14, 78)

    autoTable(doc, {
      startY: 88,
      head: [['Date', 'Amount (SGD)', 'Receipt No.', 'Payment Method']],
      body: sorted.map(d => [
        new Date(d.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }),
        `$${Number(d.amount).toLocaleString()}`,
        d.receipt_number || d.payment_ref || 'N/A',
        d.source === 'manual' ? (d.payment_method || 'Manual') : 'PayNow',
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [27, 67, 50], textColor: [255, 255, 255] },
    })

    let finalY = ensurePdfSpace(doc, (doc as any).lastAutoTable.finalY + 14)
    const impactNotes81 = sorted.filter(d => d.impact_note?.trim())
    if (impactNotes81.length > 0) {
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(28, 28, 28)
      doc.text('The Difference Your Giving Made', 14, finalY)
      finalY += 10
      doc.setFontSize(10); doc.setFont('helvetica', 'normal')
      impactNotes81.forEach(d => {
        const lines = doc.splitTextToSize(`• ${d.impact_note}`, 180)
        doc.text(lines, 14, finalY)
        finalY += lines.length * 6 + 4
      })
      finalY += 8
    }

    doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setTextColor(120, 120, 120)
    doc.text(`With thanks, ${charityName}`, 14, finalY)
    doc.text('Generated by Giving Tree — a free donation platform for Singapore charities.', 14, finalY + 8)

    return doc
  }

  async function exportAllDonorYearEndStatements() {
    if (filterYear === 'All') { showToast('Select a specific year first', 'error'); return }
    const year = parseInt(filterYear)
    const yearDons = donations.filter(d => fyOf(d.created_at) === year && d.payment_status === 'confirmed' && !d.is_anonymous)
    if (yearDons.length === 0) { showToast('No donations found for this year', 'error'); return }

    const byDonor: Record<string, any> = {}
    yearDons.forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!byDonor[key]) byDonor[key] = { name: d.donor_name, donations: [] }
      byDonor[key].donations.push(d)
    })

    showToast(`Generating statements for ${Object.keys(byDonor).length} donors...`)
    const zip = new JSZip()
    Object.values(byDonor).forEach(donor => {
      const doc = generateDonorYearEndStatementDoc(donor.name, donor.donations, year)
      const pdfBlob = doc.output('blob')
      zip.file(`${donor.name.replace(/[^a-zA-Z0-9]/g, '_')}_${year}_Statement.pdf`, pdfBlob)
    })
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `GivingTree-YearEndStatements-${charityName}-${year}.zip`
    a.click()
    URL.revokeObjectURL(url)
    logExport('year_end_statements_zip', { year, donor_count: Object.keys(byDonor).length })
    showToast(`${Object.keys(byDonor).length} statements downloaded ✓`)
  }

  function exportYearEndSummary() {
    if (filterYear === 'All') { showToast('Select a specific year first'); return }
    const doc = new jsPDF()
    const yearDons = donations.filter(d => fyOf(d.created_at) === parseInt(filterYear) && d.payment_status === 'confirmed')
    const yearTotal = yearDons.reduce((s, d) => s + d.amount, 0)
    const yearDonors = new Set(yearDons.map(d => d.donor_name)).size
    const yearTop: any[] = Object.values(yearDons.reduce((acc: Record<string, any>, d) => {
      acc[d.donor_name] = acc[d.donor_name] || { name: d.donor_name, total: 0 }
      acc[d.donor_name].total += d.amount
      return acc
    }, {})).sort((a: any, b: any) => b.total - a.total).slice(0, 5)
    const monthly = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => ({
      month: m,
      total: yearDons.filter(d => new Date(d.created_at).getMonth() === i).reduce((s, d) => s + d.amount, 0),
    }))
    const busiestMonth = monthly.reduce((a, b) => (b.total > a.total ? b : a), monthly[0])

    doc.setFillColor(27, 67, 50)
    doc.rect(0, 0, 210, 50, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(22); doc.setFont('helvetica', 'bold')
    doc.text('Year-End Giving Summary', 14, 24)
    doc.setFontSize(12); doc.setFont('helvetica', 'normal')
    doc.text(`${charityName} · ${filterYear}`, 14, 34)
    doc.setFontSize(9)
    doc.text(`UEN ${charityUen} · Generated ${new Date().toLocaleDateString('en-SG')}`, 14, 42)

    doc.setTextColor(28, 28, 28)
    doc.setFontSize(13); doc.setFont('helvetica', 'bold')
    doc.text('Year at a Glance', 14, 64)
    doc.setFontSize(11); doc.setFont('helvetica', 'normal')
    const stats = [
      [`Total Raised`, `SGD $${yearTotal.toLocaleString()}`],
      [`Total Donations`, `${yearDons.length}`],
      [`Unique Donors`, `${yearDonors}`],
      [`Average Donation`, `SGD $${yearDons.length ? (yearTotal / yearDons.length).toFixed(0) : 0}`],
      [`Busiest Month`, busiestMonth.total > 0 ? `${busiestMonth.month} (SGD $${busiestMonth.total.toLocaleString()})` : '—'],
    ]
    let y = 74
    stats.forEach(([label, value]) => {
      doc.setFont('helvetica', 'normal'); doc.text(label, 14, y)
      doc.setFont('helvetica', 'bold'); doc.text(value, 90, y)
      y += 8
    })

    y += 6
    doc.setFontSize(13); doc.setFont('helvetica', 'bold')
    doc.text('Top Supporters', 14, y)
    y += 4
    autoTable(doc, {
      startY: y,
      head: [['Donor', 'Total Given (SGD)']],
      body: yearTop.length ? yearTop.map(d => [d.name, `$${d.total.toLocaleString()}`]) : [['No donations recorded yet', '']],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [212, 160, 23], textColor: [27, 67, 50] },
    })

    const finalY = ensurePdfSpace(doc, (doc as any).lastAutoTable.finalY + 14)
    doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setTextColor(120, 120, 120)
    doc.text('Generated by Giving Tree — a free donation platform for Singapore charities.', 14, finalY)

    doc.save(`GivingTree-YearEnd-${charityName}-${filterYear}.pdf`)
    logExport('year_end_summary_pdf', { year: filterYear })
  }

  function exportGrantsComplianceReport() {
    const doc = new jsPDF()
    const activeGrants92 = grants.filter(g => g.status === 'active')
    const today92 = new Date()

    const allReportRows: any[] = []
    activeGrants92.forEach(g => {
      (grantReports[g.id] || []).forEach((r: any) => {
        const isOverdue = !r.submitted && new Date(r.due_date) < today92
        allReportRows.push([
          g.funder_name,
          r.label,
          new Date(r.due_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }),
          r.submitted ? `Submitted ${r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('en-SG') : ''}` : (isOverdue ? 'OVERDUE' : 'Upcoming'),
        ])
      })
    })
    allReportRows.sort((a, b) => (a[3] === 'OVERDUE' ? -1 : 1) - (b[3] === 'OVERDUE' ? -1 : 1))

    const allTrancheRows: any[] = []
    activeGrants92.forEach(g => {
      (grantTranches[g.id] || []).forEach((t: any) => {
        const isOverdue = !t.received && new Date(t.expected_date) < today92
        allTrancheRows.push([
          g.funder_name,
          t.label,
          `$${Number(t.amount).toLocaleString()}`,
          new Date(t.expected_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }),
          t.received ? 'Received' : (isOverdue ? 'OVERDUE' : 'Pending'),
        ])
      })
    })

    const matchingGrants92 = activeGrants92.filter(g => g.is_matching)
    const overdueReportCount = allReportRows.filter(r => r[3] === 'OVERDUE').length
    const overdueTrancheCount = allTrancheRows.filter(r => r[4] === 'OVERDUE').length

    doc.setFillColor(27, 67, 50)
    doc.rect(0, 0, 210, 42, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20); doc.setFont('helvetica', 'bold')
    doc.text('Grants Compliance Report', 14, 20)
    doc.setFontSize(11); doc.setFont('helvetica', 'normal')
    doc.text(`${charityName} · ${activeGrants92.length} active grant${activeGrants92.length !== 1 ? 's' : ''}`, 14, 30)
    doc.setFontSize(9)
    doc.text(`Generated ${new Date().toLocaleDateString('en-SG')}`, 14, 37)

    doc.setTextColor(28, 28, 28)
    doc.setFontSize(13); doc.setFont('helvetica', 'bold')
    doc.text('Summary', 14, 56)
    doc.setFontSize(11); doc.setFont('helvetica', 'normal')
    let y92 = 66
    ;[
      ['Active Grants', `${activeGrants92.length}`],
      ['Overdue Reports', `${overdueReportCount}`],
      ['Overdue Disbursements', `${overdueTrancheCount}`],
      ['Matching Grants', `${matchingGrants92.length}`],
    ].forEach(([label, value]) => {
      doc.setFont('helvetica', 'normal'); doc.text(label, 14, y92)
      doc.setFont('helvetica', 'bold'); doc.text(value, 90, y92)
      y92 += 8
    })

    y92 += 6
    doc.setFontSize(13); doc.setFont('helvetica', 'bold')
    doc.text('Report Deadlines', 14, y92)
    y92 += 4
    autoTable(doc, {
      startY: y92,
      head: [['Funder', 'Report', 'Due Date', 'Status']],
      body: allReportRows.length ? allReportRows : [['No report deadlines recorded', '', '', '']],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [212, 160, 23], textColor: [27, 67, 50] },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3 && data.cell.raw === 'OVERDUE') {
          data.cell.styles.textColor = [160, 71, 47]
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
    y92 = ensurePdfSpace(doc, (doc as any).lastAutoTable.finalY + 14)

    doc.setFontSize(13); doc.setFont('helvetica', 'bold')
    doc.text('Disbursement Tranches', 14, y92)
    y92 += 4
    autoTable(doc, {
      startY: y92,
      head: [['Funder', 'Tranche', 'Amount', 'Expected', 'Status']],
      body: allTrancheRows.length ? allTrancheRows : [['No tranches recorded', '', '', '', '']],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [212, 160, 23], textColor: [27, 67, 50] },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 4 && data.cell.raw === 'OVERDUE') {
          data.cell.styles.textColor = [160, 71, 47]
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
    y92 = ensurePdfSpace(doc, (doc as any).lastAutoTable.finalY + 14)

    if (matchingGrants92.length > 0) {
      doc.setFontSize(13); doc.setFont('helvetica', 'bold')
      doc.text('Matching Grant Claims', 14, y92)
      y92 += 4
      autoTable(doc, {
        startY: y92,
        head: [['Funder', 'Ratio', 'Claimed', 'Cap', '% Claimed']],
        body: matchingGrants92.map(g => {
          const claimed = (grantMatchClaims[g.id] || []).reduce((s: any, c: any) => s + Number(c.amount), 0)
          const cap = Number(g.match_cap) || 0
          return [g.funder_name, g.match_ratio || '—', `$${claimed.toLocaleString()}`, `$${cap.toLocaleString()}`, cap > 0 ? `${Math.round((claimed / cap) * 100)}%` : '—']
        }),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [212, 160, 23], textColor: [27, 67, 50] },
      })
      y92 = ensurePdfSpace(doc, (doc as any).lastAutoTable.finalY + 14)
    }

    doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setTextColor(120, 120, 120)
    doc.text('Generated by Giving Tree — a free donation platform for Singapore charities.', 14, y92)
    doc.save(`GivingTree-GrantsCompliance-${charityName}-${new Date().toISOString().split('T')[0]}.pdf`)
    logExport('grants_compliance_pdf')
  }

  function exportPermitRegister() {
    const doc = new jsPDF()
    const campaigns92 = myCauses.filter(c => c.type === 'campaign')
    const permitLabel = (status: any) => status === 'obtained' ? 'Permit Obtained' : status === 'pending' ? 'Permit Pending' : 'Not Required'
    const rows92 = campaigns92.map(c => {
      const expired = c.permit_status === 'obtained' && c.permit_expiry && new Date(c.permit_expiry) < new Date()
      return [
        c.title,
        c.status === 'approved' ? 'Active' : c.status === 'completed' ? 'Ended' : c.status,
        expired ? 'EXPIRED' : permitLabel(c.permit_status),
        c.permit_number || '—',
        c.permit_expiry ? new Date(c.permit_expiry).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—',
      ]
    })

    doc.setFillColor(27, 67, 50)
    doc.rect(0, 0, 210, 42, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20); doc.setFont('helvetica', 'bold')
    doc.text('Fundraising Permit Register', 14, 20)
    doc.setFontSize(11); doc.setFont('helvetica', 'normal')
    doc.text(`${charityName} · ${campaigns92.length} campaign${campaigns92.length !== 1 ? 's' : ''}`, 14, 30)
    doc.setFontSize(9)
    doc.text(`Generated ${new Date().toLocaleDateString('en-SG')}`, 14, 37)

    doc.setTextColor(28, 28, 28)
    doc.setFontSize(10); doc.setFont('helvetica', 'normal')
    doc.text('Register of fundraising permit status for all campaigns, for compliance with the House to House and Street Collections Act and Charities Act.', 14, 54, { maxWidth: 182 })

    autoTable(doc, {
      startY: 64,
      head: [['Campaign', 'Status', 'Permit Status', 'Permit Number', 'Expiry']],
      body: rows92.length ? rows92 : [['No campaigns recorded', '', '', '', '']],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [212, 160, 23], textColor: [27, 67, 50] },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2 && data.cell.raw === 'EXPIRED') {
          data.cell.styles.textColor = [160, 71, 47]
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })

    const finalY92 = ensurePdfSpace(doc, (doc as any).lastAutoTable.finalY + 14)
    doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setTextColor(120, 120, 120)
    doc.text('Generated by Giving Tree — a free donation platform for Singapore charities.', 14, finalY92)
    doc.save(`GivingTree-PermitRegister-${charityName}-${new Date().toISOString().split('T')[0]}.pdf`)
    logExport('permit_register_pdf')
  }

  function exportRestrictedFundStatement() {
    if (filterYear === 'All') { showToast('Select a specific year first'); return }
    const { start: fyStart, end: fyEnd } = fiscalYearBounds(parseInt(filterYear), fyEndMonth, fyEndDay)
    const restrictedGrants92 = grants.filter(g => Number(g.restricted_amount) > 0)

    let totalOpening = 0, totalReceipts = 0, totalExpenditure = 0
    const fundRows = restrictedGrants92.map(g => {
      const restrictedAmt = Number(g.restricted_amount)
      const grantStart = new Date(g.start_date || g.created_at)
      const expenses = grantExpensesByGrant[g.id] || []
      const expensesBefore = expenses.filter((e: any) => new Date(e.expense_date) < fyStart).reduce((s: any, e: any) => s + Number(e.amount), 0)
      const expensesDuring = expenses.filter((e: any) => new Date(e.expense_date) >= fyStart && new Date(e.expense_date) <= fyEnd).reduce((s: any, e: any) => s + Number(e.amount), 0)

      const opening = grantStart < fyStart ? Math.max(0, restrictedAmt - Math.min(expensesBefore, restrictedAmt)) : 0
      const receipts = (grantStart >= fyStart && grantStart <= fyEnd) ? restrictedAmt : 0
      const availableForExpenditure = opening + receipts
      const expenditure = Math.min(expensesDuring, availableForExpenditure)
      const closing = availableForExpenditure - expenditure

      totalOpening += opening
      totalReceipts += receipts
      totalExpenditure += expenditure

      return [g.funder_name, g.purpose_restriction || '—', `$${opening.toLocaleString()}`, `$${receipts.toLocaleString()}`, `$${expenditure.toLocaleString()}`, `$${closing.toLocaleString()}`]
    })

    const doc = new jsPDF()
    doc.setFillColor(27, 67, 50)
    doc.rect(0, 0, 210, 42, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20); doc.setFont('helvetica', 'bold')
    doc.text('Statement of Restricted Funds', 14, 20)
    doc.setFontSize(11); doc.setFont('helvetica', 'normal')
    doc.text(`${charityName} · FY ${filterYear}`, 14, 30)
    doc.setFontSize(9)
    doc.text(`Generated ${new Date().toLocaleDateString('en-SG')}`, 14, 37)

    doc.setTextColor(28, 28, 28)
    doc.setFontSize(13); doc.setFont('helvetica', 'bold')
    doc.text('Movement Summary', 14, 56)
    doc.setFontSize(11); doc.setFont('helvetica', 'normal')
    let y93 = 66
    ;[
      ['Opening Balance', `$${totalOpening.toLocaleString()}`],
      ['Receipts This Year', `$${totalReceipts.toLocaleString()}`],
      ['Expenditure This Year', `$${totalExpenditure.toLocaleString()}`],
      ['Closing Balance', `$${(totalOpening + totalReceipts - totalExpenditure).toLocaleString()}`],
    ].forEach(([label, value]) => {
      doc.setFont('helvetica', 'normal'); doc.text(label, 14, y93)
      doc.setFont('helvetica', 'bold'); doc.text(value, 90, y93)
      y93 += 8
    })

    y93 += 6
    doc.setFontSize(13); doc.setFont('helvetica', 'bold')
    doc.text('By Restricted Fund', 14, y93)
    y93 += 4
    autoTable(doc, {
      startY: y93,
      head: [['Funder', 'Purpose', 'Opening', 'Receipts', 'Expenditure', 'Closing']],
      body: fundRows.length ? fundRows : [['No restricted grants recorded', '', '', '', '', '']],
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: [212, 160, 23], textColor: [27, 67, 50] },
    })
    const finalY93 = ensurePdfSpace(doc, (doc as any).lastAutoTable.finalY + 12)

    doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(120, 120, 120)
    doc.text('Methodology: for each restricted grant, expenditure is drawn from its restricted balance first (up to the restricted amount). This statement does not distinguish restricted vs. unrestricted spend within a single expense entry — review with your treasurer/auditor before use in audited financial statements.', 14, finalY93, { maxWidth: 182 })
    doc.text('Generated by Giving Tree — a free donation platform for Singapore charities.', 14, finalY93 + 18)
    doc.save(`GivingTree-RestrictedFunds-${charityName}-${filterYear}.pdf`)
    logExport('restricted_fund_statement_pdf', { year: filterYear })
  }

  async function handleSetNewPassword() {
    if (newPassword.length < 6) { setResetMsg('Password must be at least 6 characters'); return }
    if (newPassword !== confirmPassword) { setResetMsg('Passwords do not match'); return }
    setResetLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setResetLoading(false)
    if (error) { setResetMsg(error.message); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session?.user?.email,
      action: 'password_changed',
      details: { charity_uen: charityUen },
    })
    setResetMsg('Password updated! Redirecting...')
    setTimeout(() => { setShowResetPassword(false); setNewPassword(''); setConfirmPassword(''); setResetMsg('') }, 1500)
  }

  const monthlyCountData = React.useMemo(() => {
    const yr = filterYear === 'All' ? fyOf(new Date()) : parseInt(filterYear)
    const { start: fyStart } = fiscalYearBounds(yr, fyEndMonth, fyEndDay)
    const { start: lastFyStart } = fiscalYearBounds(yr - 1, fyEndMonth, fyEndDay)
    const confirmed = donations.filter(d => d.payment_status === 'confirmed')
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(fyStart.getFullYear(), fyStart.getMonth() + i, 1)
      const lastYearD = new Date(lastFyStart.getFullYear(), lastFyStart.getMonth() + i, 1)
      return {
        month: d.toLocaleDateString('en-SG', { month: 'short' }),
        count: confirmed.filter(don => { const dt = new Date(don.created_at); return dt.getFullYear() === d.getFullYear() && dt.getMonth() === d.getMonth() }).length,
        lastYearCount: confirmed.filter(don => { const dt = new Date(don.created_at); return dt.getFullYear() === lastYearD.getFullYear() && dt.getMonth() === lastYearD.getMonth() }).length,
      }
    })
  }, [donations, filterYear, fyOf, fyEndMonth, fyEndDay])

  // Dashboard "Action Items" / "Worth Knowing" lists. Pulled into a memo (rather than recomputed
  // inline in JSX on every render) because several of these scans are O(n) or worse over the full
  // donation history and don't depend on most Dashboard-tab UI state (snooze menu open, form
  // inputs, etc.) — only on the underlying data below.
  const dashboardActionItemsData = React.useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const items = []

    // Donors marked deceased or do-not-contact must never generate relationship / outreach
    // prompts (birthdays, anniversaries, thank-yous, check-ins, etc.).
    const suppressedKeys = new Set()
    donations.forEach(d => { if (d.donor_deceased || d.donor_do_not_contact) suppressedKeys.add(donationDonorKey(d)) })
    const notSuppressed = (key: any) => !suppressedKeys.has(key)

    const unconfirmed = donations.filter(d => d.payment_status !== 'confirmed' && d.payment_status !== 'cancelled' && d.payment_status !== 'refunded' && d.status !== 'deleted_by_charity' && d.status !== 'cancelled_by_donor').length
    if (unconfirmed > 0) items.push({ key: 'unconfirmed_payments', icon: '⚡', label: `${unconfirmed} payment${unconfirmed > 1 ? 's' : ''} awaiting confirmation`, priority: 'high', severity: 'critical', urgency: unconfirmed, jump: () => { clearDonationFilters({ keepYear: false }); setFilterType('Awaiting Payment'); setActiveTab('donations') } })

    const wasRecentlyReminded = (p: any) => {
      const history = pledgeReminderHistory[p.id]
      if (!history || history.length === 0) return false
      const daysSinceLastReminder = Math.floor((today.getTime() - new Date(history[0].sent_at).getTime()) / (1000 * 60 * 60 * 24))
      return daysSinceLastReminder < 7
    }
    const overduePledges = pledgesLoaded ? pledges.filter(p => p.status === 'pending' && new Date(p.expected_date) < today && !wasRecentlyReminded(p)) : []
    const dueSoonPledges = pledgesLoaded ? pledges.filter(p => { if (p.status !== 'pending' || wasRecentlyReminded(p)) return false; const days = Math.ceil((new Date(p.expected_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)); return days >= 0 && days <= pledgeDueSoonDays }) : []
    if (overduePledges.length > 0) {
      const maxOverdueDays = Math.max(...overduePledges.map(p => Math.ceil((today.getTime() - new Date(p.expected_date).getTime()) / (1000 * 60 * 60 * 24))))
      items.push({ key: 'pledges_overdue', icon: '🤝', label: `${overduePledges.length} pledge${overduePledges.length > 1 ? 's' : ''} overdue and need${overduePledges.length > 1 ? '' : 's'} a reminder — ${overduePledges.slice(0, 2).map(p => p.donor_name).join(', ')}${overduePledges.length > 2 ? ` +${overduePledges.length - 2} more` : ''}`, priority: 'high', urgency: maxOverdueDays, jump: () => { setPledgeSearchTerm(''); setPledgeAmountFilter('All'); setPledgeYearFilter('All'); setPledgeTypeFilter('All'); setPledgeProgrammeFilter('All'); setPledgeUrgencyFilter('Overdue'); setActiveTab('pledges') } })
    }
    if (dueSoonPledges.length > 0) {
      const minDaysUntil = Math.min(...dueSoonPledges.map(p => Math.ceil((new Date(p.expected_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))))
      items.push({ key: 'pledges_due_soon', icon: '🤝', label: `${dueSoonPledges.length} pledge${dueSoonPledges.length > 1 ? 's' : ''} due within ${pledgeDueSoonDays} days and may need a gentle reminder`, priority: 'medium', group: 'housekeeping', urgency: 50 - minDaysUntil, jump: () => { setPledgeSearchTerm(''); setPledgeAmountFilter('All'); setPledgeYearFilter('All'); setPledgeTypeFilter('All'); setPledgeProgrammeFilter('All'); setPledgeUrgencyFilter('Due Soon'); setActiveTab('pledges') } })
    }

    const singleMissGiro = giroMissedCycles.filter(g => g.missedCycles < 2)
    const escalatedGiro = giroMissedCycles.filter(g => g.missedCycles >= 2)
    if (singleMissGiro.length > 0) items.push({ key: 'recurring_overdue', icon: '🔁', label: `${singleMissGiro.length} recurring gift${singleMissGiro.length > 1 ? 's' : ''} overdue — ${singleMissGiro.slice(0, 2).map(g => g.donor_name).join(', ')}${singleMissGiro.length > 2 ? ` +${singleMissGiro.length - 2} more` : ''}`, priority: 'high', urgency: singleMissGiro.length, jump: () => { setRecurringSearchTerm(''); setRecurringAmountFilter('All'); setRecurringTypeFilter('All'); setRecurringUrgencyFilter('Late'); setActiveTab('recurring') } })
    if (escalatedGiro.length > 0) items.push({ key: 'giro_possible_cancellation', icon: '⚠️', label: `Possible GIRO cancellation — ${escalatedGiro.slice(0, 2).map(g => g.donor_name).join(', ')}${escalatedGiro.length > 2 ? ` +${escalatedGiro.length - 2} more` : ''} missed 2+ cycles`, priority: 'high', severity: 'critical', urgency: escalatedGiro.length, jump: () => { setRecurringSearchTerm(''); setRecurringAmountFilter('All'); setRecurringTypeFilter('All'); setRecurringUrgencyFilter('Escalated'); setActiveTab('recurring') } })

    const givingChangeFlags = allGivingChangeFlags.filter(f => notSuppressed(f.email?.trim() || f.name))
    if (givingChangeFlags.length > 0) items.push({ key: 'giving_changes', icon: '📊', label: `${givingChangeFlags.length} donor${givingChangeFlags.length > 1 ? 's' : ''} with a notable giving change`, priority: 'medium', group: 'trends', urgency: givingChangeFlags.length, jump: () => { setActiveTab('dashboard'); setTimeout(() => document.getElementById('giving-changes-card-analytics')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100) } })

    const majorGiftsAwaitingPersonalThanks = donations.filter(d => d.payment_status === 'confirmed' && !d.thank_you_sent && d.donor_email?.trim() && notSuppressed(donationDonorKey(d)))
    if (majorGiftsAwaitingPersonalThanks.length > 0) items.push({ key: 'major_thanks_pending', icon: '💌', label: `${majorGiftsAwaitingPersonalThanks.length} confirmed donation${majorGiftsAwaitingPersonalThanks.length > 1 ? 's' : ''} pending thank you`, priority: 'high', urgency: majorGiftsAwaitingPersonalThanks.length, jump: () => { clearDonationFilters({ keepYear: false }); setFilterThankYou('Not Sent'); setDonationFilterLabel('Showing gifts awaiting a thank-you'); setActiveTab('donations') } })

    if (enabledModules.inKind !== false) {
      const inKindThanksPending = inKindDonations.filter(d => !d.thank_you_sent && d.donor_email?.trim())
      if (inKindThanksPending.length > 0) items.push({ key: 'inkind_thanks_pending', icon: '💌', label: `${inKindThanksPending.length} in-kind gift${inKindThanksPending.length > 1 ? 's' : ''} pending thank you`, priority: 'high', urgency: inKindThanksPending.length, jump: () => setActiveTab('inkind') })

      const inKindReceiptsPending = inKindDonations.filter(d => !d.receipt_issued)
      if (inKindReceiptsPending.length > 0) items.push({ key: 'inkind_receipts_pending', icon: '🧾', label: `${inKindReceiptsPending.length} in-kind receipt${inKindReceiptsPending.length > 1 ? 's' : ''} pending`, priority: 'medium', group: 'housekeeping', urgency: inKindReceiptsPending.length, jump: () => setActiveTab('inkind') })
    }

    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    // Model B: a Worth-knowing donor is "handled" once you've logged a communication with
    // them since `sinceMs` (reuses donorLastContactMap from the warmth feature). Gift-driven
    // items also count a sent thank-you. The item's count shows only who's left, and it
    // clears itself once everyone's been actioned.
    const contactedSince = (key: any, sinceMs: any) => { const last = key ? donorLastContactMap[key] : null; return !!(last && new Date(last).getTime() >= sinceMs) }
    const donationKey = donationDonorKey
    const jumpToDonors69 = (keys: any, label: any, insightKey: any = null) => () => { setFilterDonorKeys(keys); setFilterTopDonorNames(null); setDonorFilterLabel(label); setActiveInsightKey(insightKey); setActiveTab('donors') }
    const periodKey69 = isoWeekKey(today)
    const notDismissed69 = (key: any, insightKey: any) => !insightDismissals.some(d => d.donor_key === key && d.insight_key === insightKey && d.period_key === periodKey69)

    const monthAgo69 = today.getTime() - 30 * 24 * 60 * 60 * 1000
    const lapsedFiltered69 = Object.values((() => { const map: Record<string, any> = {}; confirmedDonations.forEach(d => { const key = donationDonorKey(d); if (!map[key]) map[key] = { count: 0, lastDate: d.created_at, key }; map[key].count++; if (new Date(d.created_at) > new Date(map[key].lastDate)) map[key].lastDate = d.created_at }); return map })()).filter(d => {
      if (!notSuppressed(d.key) || !notDismissed69(d.key, 'lapsed_donors')) return false
      if (d.count < lapsedMinGifts) return false
      const daysSince = Math.floor((today.getTime() - new Date(d.lastDate).getTime()) / (1000 * 60 * 60 * 24))
      if (daysSince < lapsedMinDays) return false
      if (lapsedDismissals[d.key]) return false
      // Matches the per-donor "Right now" card's clearing check — any logged contact
      // (Reach Out send, or Mark done) within 30 days counts, not just a sent reminder.
      if (contactedSince(d.key, monthAgo69)) return false
      return true
    })
    if (lapsedFiltered69.length > 0) {
      const lapsedCount = lapsedFiltered69.length
      items.push({ key: 'lapsed_donors', icon: '⏰', label: `${lapsedCount} repeat donor${lapsedCount > 1 ? 's' : ''} haven't given in ${lapsedMinDays}+ days`, priority: 'medium', group: 'trends', urgency: lapsedCount, jump: jumpToDonors69(lapsedFiltered69.map(d => d.key), `Showing ${lapsedCount} repeat donor${lapsedCount > 1 ? 's' : ''} who haven't given in ${lapsedMinDays}+ days`, 'lapsed_donors') })
    }

    const milestonesThisWeek = donations.filter(d => {
      if (d.payment_status !== 'confirmed' || new Date(d.created_at) < weekAgo || d.is_anonymous) return false
      const b = donationBadgeInfo[d.id]
      return b && (b.isFirstTime || b.isBiggestYet)
    })
    const firstTimeToWelcome = milestonesThisWeek.filter(d => donationBadgeInfo[d.id]?.isFirstTime && !d.thank_you_sent && notSuppressed(donationKey(d)) && !contactedSince(donationKey(d), weekAgo.getTime()) && notDismissed69(donationKey(d), 'milestones_first_time'))
    const biggestYetToThank = milestonesThisWeek.filter(d => donationBadgeInfo[d.id]?.isBiggestYet && !d.thank_you_sent && notSuppressed(donationKey(d)) && !contactedSince(donationKey(d), weekAgo.getTime()) && notDismissed69(donationKey(d), 'milestones_biggest_yet'))
    if (firstTimeToWelcome.length > 0) items.push({ key: 'milestones_first_time', icon: '🆕', label: `${firstTimeToWelcome.length} new donor${firstTimeToWelcome.length > 1 ? 's' : ''} this week to welcome`, priority: 'medium', group: 'moments', urgency: firstTimeToWelcome.length, jump: jumpToDonors69(firstTimeToWelcome.map(d => donationKey(d)), `Showing ${firstTimeToWelcome.length} new donor${firstTimeToWelcome.length > 1 ? 's' : ''} this week`, 'milestones_first_time') })
    if (biggestYetToThank.length > 0) items.push({ key: 'milestones_biggest_yet', icon: '📈', label: `${biggestYetToThank.length} donor${biggestYetToThank.length > 1 ? 's' : ''} gave their biggest gift yet — thank them`, priority: 'medium', group: 'moments', urgency: biggestYetToThank.length, jump: jumpToDonors69(biggestYetToThank.map(d => donationKey(d)), `Showing ${biggestYetToThank.length} donor${biggestYetToThank.length > 1 ? 's' : ''} who gave their biggest gift yet`, 'milestones_biggest_yet') })

    // Anniversary + cumulative threshold + streak milestones
    const donorFirstGiftDate69: Record<string, any> = {}
    const donorCumulative69: Record<string, any> = {}
    const keyToName69: Record<string, any> = {}
    confirmedDonations.forEach(d => {
      const key = donationDonorKey(d)
      if (!donorFirstGiftDate69[key] || new Date(d.created_at) < new Date(donorFirstGiftDate69[key])) donorFirstGiftDate69[key] = d.created_at
      donorCumulative69[key] = (donorCumulative69[key] || 0) + d.amount
      keyToName69[key] = d.donor_name
    })

    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    const anniversariesThisWeek = Object.entries(donorFirstGiftDate69).filter(([key, firstDate]) => {
      const fd = new Date(firstDate)
      const thisYearAnniversary = new Date(today.getFullYear(), fd.getMonth(), fd.getDate())
      const daysDiff = Math.floor((thisYearAnniversary.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return fd.getFullYear() < today.getFullYear() && daysDiff >= -7 && daysDiff <= 0 && notSuppressed(key) && !contactedSince(key, weekAgo.getTime()) && notDismissed69(key, 'donor_anniversaries')
    })
    if (anniversariesThisWeek.length > 0) {
      const names = anniversariesThisWeek.map(([key]) => keyToName69[key])
      items.push({ key: 'donor_anniversaries', icon: '🎂', label: `${anniversariesThisWeek.length} donor${anniversariesThisWeek.length > 1 ? 's' : ''} celebrating a giving anniversary — send a note`, priority: 'medium', group: 'moments', urgency: names.length, jump: jumpToDonors69(anniversariesThisWeek.map(([key]) => key), `Showing ${names.length} donor${names.length > 1 ? 's' : ''} celebrating a giving anniversary this week`, 'donor_anniversaries') })
    }

    const cumulativeThresholds69 = cumulativeThresholds
    const crossedThresholdKeys = Object.entries(donorCumulative69).filter(([key, total]) => {
      if (!notSuppressed(key) || contactedSince(key, weekAgo.getTime()) || !notDismissed69(key, 'cumulative_thresholds')) return false
      const priorTotal = total - confirmedDonations.filter(d => donationDonorKey(d) === key && new Date(d.created_at) >= weekAgo).reduce((s, d) => s + d.amount, 0)
      return cumulativeThresholds69.some((t: any) => priorTotal < t && total >= t)
    }).map(([key]) => key)
    if (crossedThresholdKeys.length > 0) {
      const names = crossedThresholdKeys.map(key => keyToName69[key])
      items.push({ key: 'cumulative_thresholds', icon: '🏆', label: `${names.length} donor${names.length > 1 ? 's' : ''} crossed a cumulative giving milestone this week`, priority: 'medium', group: 'moments', urgency: names.length, jump: jumpToDonors69(crossedThresholdKeys, `Showing ${names.length} donor${names.length > 1 ? 's' : ''} who crossed a cumulative giving milestone this week`, 'cumulative_thresholds') })
    }

    const streakMilestones69 = [12, 24, 36, 60]
    const streakDonorMonths69: Record<string, any> = {}
    confirmedDonations.forEach(d => {
      const key = donationDonorKey(d)
      const dt = new Date(d.created_at)
      const monthIndex = dt.getFullYear() * 12 + dt.getMonth()
      if (!streakDonorMonths69[key]) streakDonorMonths69[key] = new Set()
      streakDonorMonths69[key].add(monthIndex)
    })
    const streakHitKeys = Object.entries(streakDonorMonths69).filter(([key, monthSet]) => {
      if (!notSuppressed(key) || contactedSince(key, weekAgo.getTime()) || !notDismissed69(key, 'streak_milestones')) return false
      const months = [...monthSet].sort((a, b) => b - a)
      let consecutiveStreak = 1
      for (let i = 1; i < months.length; i++) {
        if (months[i - 1] - months[i] === 1) consecutiveStreak++
        else break
      }
      return streakMilestones69.includes(consecutiveStreak)
    }).map(([key]) => key)
    if (streakHitKeys.length > 0) {
      const names = streakHitKeys.map(key => keyToName69[key])
      items.push({ key: 'streak_milestones', icon: '🔥', label: `${names.length} donor${names.length > 1 ? 's' : ''} hit a giving-streak milestone (12/24/36/60 months)`, priority: 'medium', group: 'moments', urgency: names.length, jump: jumpToDonors69(streakHitKeys, `Showing ${names.length} donor${names.length > 1 ? 's' : ''} who hit a giving-streak milestone`, 'streak_milestones') })
    }

    const grantReportsDue83 = grantsWithNextReport.filter(g => {
      if (!g.report_due_date || g.status !== 'active') return false
      const days = Math.ceil((new Date(g.report_due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return days >= 0 && days <= 60
    })
    grantReportsDue83.forEach(g => {
      const days = Math.ceil((new Date(g.report_due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      items.push({ key: `grant_report_${g.id}`, icon: '🏛️', label: `Report due to ${g.funder_name} in ${days} day${days !== 1 ? 's' : ''}`, priority: days <= 30 ? 'high' : 'medium', urgency: Math.max(0, 30 - days), jump: () => { setHighlightedGrantId(g.id); setActiveTab('grants'); setTimeout(() => document.getElementById(`grant-card-${g.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100) } })
    })

    const majorDonorsNeedingVisit80 = donorList.filter(d => d.total >= (majorDonorThreshold || 1000) && !d.deactivated).map(d => {
      const donorKey80b = contactDonorKey(d)
      const contact80b = donorContacts.find(c => contactDonorKey(c) === donorKey80b)
      const lastVisited80b = contact80b?.last_visited_date
      const monthsSinceVisit80b = lastVisited80b ? (today.getTime() - new Date(lastVisited80b).getTime()) / (1000 * 60 * 60 * 24 * 30) : null
      return { ...d, lastVisited: lastVisited80b, needsVisit: monthsSinceVisit80b === null || monthsSinceVisit80b >= 6 }
    }).filter(d => d.needsVisit && notSuppressed(contactDonorKey(d)) && !contactedSince(contactDonorKey(d), monthAgo.getTime()) && notDismissed69(contactDonorKey(d), 'major_donor_visits'))
    if (majorDonorsNeedingVisit80.length > 0) {
      const names = majorDonorsNeedingVisit80.map(d => d.name)
      items.push({ key: 'major_donor_visits', icon: '🤝', label: `${names.length} major donor${names.length > 1 ? 's' : ''} (${majorDonorThreshold}+ lifetime) due a catch-up — not visited in 6+ months`, priority: 'medium', group: 'moments', urgency: names.length, jump: jumpToDonors69(majorDonorsNeedingVisit80.map(d => contactDonorKey(d)), `Showing ${names.length} major donor${names.length > 1 ? 's' : ''} not visited in 6+ months`, 'major_donor_visits') })
    }

    // Reactive, not predictive: only flags a donor once their usual giving month is
    // mostly over and they haven't given yet this year — a "haven't heard from you"
    // check-in, not a reminder timed to land right before they'd normally give.
    const seasonalPatternDonors71 = (() => {
      const byDonorMonth71: Record<string, any> = {}
      confirmedDonations.forEach(d => {
        const key = donationDonorKey(d)
        const dt = new Date(d.created_at)
        if (!byDonorMonth71[key]) byDonorMonth71[key] = { key, name: d.donor_name, yearsGivingInMonth: {}, gaveThisMonthThisYear: false }
        const month = dt.getMonth()
        if (!byDonorMonth71[key].yearsGivingInMonth[month]) byDonorMonth71[key].yearsGivingInMonth[month] = new Set()
        byDonorMonth71[key].yearsGivingInMonth[month].add(dt.getFullYear())
        if (month === today.getMonth() && dt.getFullYear() === today.getFullYear()) byDonorMonth71[key].gaveThisMonthThisYear = true
      })
      const thisMonth71 = today.getMonth()
      if (today.getDate() < 15) return []
      return Object.values(byDonorMonth71).filter(donor => {
        const yearsInThisMonth = donor.yearsGivingInMonth[thisMonth71]
        return yearsInThisMonth && yearsInThisMonth.size >= 2 && !donor.gaveThisMonthThisYear && notSuppressed(donor.key) && !contactedSince(donor.key, monthAgo.getTime()) && notDismissed69(donor.key, 'seasonal_pattern')
      })
    })()
    if (seasonalPatternDonors71.length > 0) {
      const names = seasonalPatternDonors71.map(d => d.name)
      items.push({ key: 'seasonal_pattern', icon: '📅', label: `${names.length} donor${names.length > 1 ? 's' : ''} usually give${names.length === 1 ? 's' : ''} around this time — haven't yet this year`, priority: 'medium', group: 'trends', urgency: names.length, jump: jumpToDonors69(seasonalPatternDonors71.map(d => d.key), `Showing ${names.length} donor${names.length > 1 ? 's' : ''} who usually give around this time and haven't yet`, 'seasonal_pattern') })
    }

    const birthdaysThisWeek70 = donorContacts.filter(c => {
      if (!c.birth_date) return false
      const bd = new Date(c.birth_date)
      const thisYearBday = new Date(today.getFullYear(), bd.getMonth(), bd.getDate())
      const daysUntil = Math.ceil((thisYearBday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return daysUntil >= 0 && daysUntil <= 7 && notSuppressed(contactDonorKey(c)) && !contactedSince(contactDonorKey(c), weekAgo.getTime()) && notDismissed69(contactDonorKey(c), 'donor_birthdays')
    })
    if (birthdaysThisWeek70.length > 0) {
      const names = birthdaysThisWeek70.map(c => c.full_name)
      items.push({ key: 'donor_birthdays', icon: '🎂', label: `${names.length} donor birthday${names.length > 1 ? 's' : ''} this week — send a greeting to ${names.slice(0, 2).join(', ')}${names.length > 2 ? ` +${names.length - 2} more` : ''}`, priority: 'medium', group: 'moments', urgency: names.length, jump: jumpToDonors69(birthdaysThisWeek70.map(c => contactDonorKey(c)), `Showing ${names.length} donor${names.length > 1 ? 's' : ''} with a birthday this week`, 'donor_birthdays') })
    }

    const lapsedReturningKeys = new Set<string>()
    confirmedDonations.forEach(d => {
      const key = donationDonorKey(d)
      if (new Date(d.created_at) < weekAgo) return
      const priorGifts = confirmedDonations.filter(p => donationDonorKey(p) === key && new Date(p.created_at) < new Date(d.created_at))
      if (priorGifts.length === 0) return
      const mostRecentPrior = priorGifts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      const gapDays = (new Date(d.created_at).getTime() - new Date(mostRecentPrior.created_at).getTime()) / (1000 * 60 * 60 * 24)
      if (gapDays >= lapsedMinDays && notSuppressed(key) && !contactedSince(key, weekAgo.getTime()) && notDismissed69(key, 'lapsed_returning')) lapsedReturningKeys.add(key)
    })
    if (lapsedReturningKeys.size > 0) {
      const names = [...lapsedReturningKeys].map(key => keyToName69[key])
      items.push({ key: 'lapsed_returning', icon: '🎉', label: `${names.length} previously lapsed donor${names.length > 1 ? 's' : ''} came back this week — thank them`, priority: 'medium', group: 'moments', urgency: names.length, jump: jumpToDonors69([...lapsedReturningKeys], `Showing ${names.length} previously lapsed donor${names.length > 1 ? 's' : ''} who came back this week`, 'lapsed_returning') })
    }

    const obligationsDue = (() => {
      const builtIn = [
        ...(charityIsIpc && daysToDeadline > 0 && daysToDeadline <= 30 ? [{ title: 'IRAS submission', days: daysToDeadline }] : []),

      ]
      const custom = (customObligations || []).map(o => {
        let d = new Date(o.date.replace(/\d{4}/, today.getFullYear()))
        if (d < today) d.setFullYear(today.getFullYear() + 1)
        const days = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        return days >= 0 && days <= 30 ? { title: o.title, days } : null
      }).filter(Boolean)
      return [...builtIn, ...custom]
    })()
    obligationsDue.forEach(o => items.push({ key: `obligation_${o.title}`, icon: '📅', label: `${o.title} due in ${o.days} day${o.days !== 1 ? 's' : ''}`, priority: o.days <= 7 ? 'high' : 'medium', urgency: Math.max(0, 7 - o.days), jump: () => document.getElementById('upcoming-obligations-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }))

    const nowMs = Date.now()
    // Obligations with a real "done" state stay in Needs Action; everything else (donor
    // moments, trends, soft opportunities) is informational → Worth Knowing.
    const ACTION_KEYS = new Set(['unconfirmed_payments', 'major_thanks_pending', 'inkind_thanks_pending', 'pledges_overdue', 'recurring_overdue', 'giro_possible_cancellation'])
    const isActionItem = (i: any) => !i.key || ACTION_KEYS.has(i.key) || i.key.startsWith('grant_report_') || i.key.startsWith('obligation_')
    const notSnoozed = (i: any) => !i.key || !(snoozedItems[i.key]?.until > nowMs)

    // Within a priority tier, items are ordered by their own urgency (days overdue, deadline
    // proximity, backlog size -- whatever's meaningful for that trigger type), not by which
    // `if` block happened to run first when the list was built.
    const actionItemsVisible = items.filter(i => isActionItem(i) && notSnoozed(i))
      .sort((a, b) => {
        const aCrit = a.severity === 'critical' ? 0 : 1
        const bCrit = b.severity === 'critical' ? 0 : 1
        if (aCrit !== bCrit) return aCrit - bCrit
        const aHigh = a.priority === 'high' ? 0 : 1
        const bHigh = b.priority === 'high' ? 0 : 1
        if (aHigh !== bHigh) return aHigh - bHigh
        return (b.urgency || 0) - (a.urgency || 0)
      })
    const fyiItemsVisible = items.filter(i => !isActionItem(i) && notSnoozed(i))
      .sort((a, b) => (b.urgency || 0) - (a.urgency || 0))
    const highItems = actionItemsVisible.filter(i => i.priority === 'high')
    const criticalCount = actionItemsVisible.filter(i => i.severity === 'critical').length
    const snoozedActiveItems = items.filter(i => i.key && snoozedItems[i.key]?.until > nowMs)

    return { items, actionItemsVisible, fyiItemsVisible, highItems, criticalCount, snoozedActiveItems, nowMs }
  }, [
    donations, confirmedDonations, pledgesLoaded, pledges, pledgeReminderHistory, pledgeDueSoonDays,
    giroMissedCycles, allGivingChangeFlags, donorLastContactMap,
    insightDismissals, lapsedMinGifts, lapsedMinDays, lapsedDismissals, donationBadgeInfo, cumulativeThresholds,
    grantsWithNextReport, donorList, majorDonorThreshold, donorContacts, customObligations, charityIsIpc,
    daysToDeadline, snoozedItems, setActiveTab, inKindDonations, enabledModules,
  ])

  if (authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: C.ivory, fontFamily: 'Segoe UI', fontSize: 16, color: C.muted }}>
      Loading...
    </div>
  )

  if (showResetPassword) return (
    <div style={{ minHeight: '100vh', background: C.ivory, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <div style={{ background: C.white, borderRadius: 20, padding: 32, maxWidth: 380, width: '100%', textAlign: 'center', border: `1.5px solid ${C.border}` }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.forest, marginBottom: 8 }}>Set a New Password</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Enter a new password for your Giving Tree charity account.</div>
        {resetMsg && <div style={{ background: C.successBg, color: C.forest, padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>{resetMsg}</div>}
        <input style={{ ...s.formInput, marginBottom: 12 }} type="password" placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
        <input style={{ ...s.formInput, marginBottom: 16 }} type="password" placeholder="Confirm new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
        <button style={{ ...s.btnForest, justifyContent: 'center', width: '100%' }} onClick={handleSetNewPassword} disabled={resetLoading}>{resetLoading ? 'Saving...' : 'Update Password'}</button>
      </div>
    </div>
  )

  if (!session) return <Auth />

  return (
    <div style={s.page}>

      {/* ── SIDEBAR (desktop + tablet, collapsible) ── */}
      {!isMobile && (
      <div style={{ ...s.sidebar, width: sidebarCollapsed ? 64 : 232, transition: 'width 0.2s ease', overflowX: 'hidden', overflowY: 'auto' }}>

        {/* Logo */}
        <div style={{ ...s.sidebarLogo, display: 'flex', flexDirection: sidebarCollapsed ? 'column' : 'row', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'space-between', gap: sidebarCollapsed ? 12 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={logo} style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} />
            {!sidebarCollapsed && (
              <div>
                <div style={s.logoText}>Giving Tree</div>
                <div style={s.logoSub}>Charity Portal</div>
              </div>
            )}
          </div>
          <button
            onClick={async () => {
              const next = !sidebarCollapsed
              setSidebarCollapsed(next)
              await supabase.auth.updateUser({ data: { sidebar_collapsed: next } })
            }}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.6)', width: 24, height: 24, borderRadius: 6, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: sidebarCollapsed ? 0 : 8 }}
          >{sidebarCollapsed ? '→' : '←'}</button>
        </div>

        {/* Nav */}
        <div style={{ ...s.navSection, overflowX: 'hidden' }}>
          {!sidebarCollapsed && <div style={s.navLabel}>Main</div>}
          {[
            { id: 'dashboard', icon: '📊', label: 'Dashboard', roles: ['ed', 'staff', 'board'] },
            { id: 'donations', icon: '💳', label: 'Donations', roles: ['ed', 'staff', 'volunteer'] },
            { id: 'donors',    icon: '👥', label: 'Donors',    roles: ['ed', 'staff'] },

          ].filter(item => item.roles.includes(userRole)).map(item => (
            <div key={item.id}
              title={item.label}
              style={{ ...s.navItem, ...(activeTab === item.id ? s.navItemActive : {}), justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}
              onClick={() => { setActiveTab(item.id); setSelectedDonor(null) }}>
              <span style={s.navIcon}>{item.icon}</span>
              {!sidebarCollapsed && item.label}
            </div>
          ))}
          {(userRole === 'staff' || userRole === 'ed') && (
            <>
              {!sidebarCollapsed && <div style={s.navLabel}>Fundraising</div>}
              {[
                { id: 'promotions',  icon: '📣', label: 'Campaigns', module: 'campaigns' },
                { id: 'pledges',     icon: '🤝', label: 'Pledges', module: 'pledges' },
                { id: 'recurring',   icon: '🔁', label: 'Recurring', module: 'recurring' },
                { id: 'grants',      icon: '💰', label: 'Grants', module: 'grants' },
                { id: 'inkind',      icon: '🎁', label: 'In-Kind Gifts', module: 'inKind' },
              ].filter(item => enabledModules[item.module] !== false).map(item => (
                <div key={item.id}
                  title={item.label}
                  style={{ ...s.navItem, ...(activeTab === item.id ? s.navItemActive : {}), justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}
                  onClick={() => { setActiveTab(item.id); setSelectedDonor(null) }}>
                  <span style={s.navIcon}>{item.icon}</span>
                  {!sidebarCollapsed && item.label}
                </div>
              ))}
              {!sidebarCollapsed && <div style={s.navLabel}>Compliance</div>}
              {[
                { id: 'reports',  icon: '📋', label: 'Reports' },
                { id: 'activity', icon: '🗒️', label: 'Audit Log' },
                ...(charityIsIpc ? [{ id: 'iras', icon: '🏛️', label: 'IRAS Export' }] : []),
              ].map(item => (
                <div key={item.id}
                  title={item.label}
                  style={{ ...s.navItem, ...(activeTab === item.id ? s.navItemActive : {}), justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}
                  onClick={() => { setActiveTab(item.id); setSelectedDonor(null) }}>
                  <span style={s.navIcon}>{item.icon}</span>
                  {!sidebarCollapsed && item.label}
                </div>
              ))}
            </>
          )}
          {!sidebarCollapsed && <div style={s.navLabel}>Account</div>}
          <div
            title="Settings"
            style={{ ...s.navItem, ...(activeTab === 'settings' ? s.navItemActive : {}), justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}
            onClick={() => { setActiveTab('settings'); setSelectedDonor(null) }}>
            <span style={s.navIcon}>⚙️</span>
            {!sidebarCollapsed && 'Settings'}
          </div>
        </div>

        {/* Footer */}
        {!sidebarCollapsed && (
          <div style={s.sidebarFooter}>
            <div style={s.footerAvatar}>{charityName.charAt(0)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={s.footerName}>{charityName}</div>
              <div style={s.footerEmail}>UEN: {charityUen}</div>
            </div>
          </div>
        )}
      </div>
      )}

      

      {/* ── TOP BAR (mobile) ── */}
      {isMobile && (
      <div style={s.mobileTopBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={logo} style={{ width: 26, height: 26, objectFit: 'contain' }} />
          <div style={s.mobileTopBarTitle}>Giving Tree</div>
        </div>
        <div style={s.mobileOverflowBtn} onClick={() => setShowMobileMenu((v: any) => !v)}>⋯</div>
        {showMobileMenu && (
          <div style={s.mobileOverflowMenu}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, padding: '6px 16px 2px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Main</div>
            {[
              { id: 'dashboard', icon: '📊', label: 'Dashboard', roles: ['ed', 'staff', 'board'] },
              { id: 'donations', icon: '💳', label: 'Donations', roles: ['ed', 'staff', 'volunteer'] },
              { id: 'donors',    icon: '👥', label: 'Donors', roles: ['ed', 'staff'] },
            ].filter(item => item.roles.includes(userRole)).map(item => (
              <div key={item.id} style={s.mobileOverflowItem} onClick={() => { setActiveTab(item.id); setSelectedDonor(null); setShowMobileMenu(false) }}>{item.icon} {item.label}</div>
            ))}
            {(userRole === 'staff' || userRole === 'ed') && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, padding: '6px 16px 2px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Fundraising</div>
                {enabledModules.campaigns !== false && <div style={s.mobileOverflowItem} onClick={() => { setActiveTab('promotions'); setSelectedDonor(null); setShowMobileMenu(false) }}>📣 Campaigns</div>}
                {enabledModules.pledges !== false && <div style={s.mobileOverflowItem} onClick={() => { setActiveTab('pledges'); setSelectedDonor(null); setShowMobileMenu(false) }}>🤝 Pledges</div>}
                {enabledModules.recurring !== false && <div style={s.mobileOverflowItem} onClick={() => { setActiveTab('recurring'); setSelectedDonor(null); setShowMobileMenu(false) }}>🔁 Recurring</div>}
                {enabledModules.grants !== false && <div style={s.mobileOverflowItem} onClick={() => { setActiveTab('grants'); setSelectedDonor(null); setShowMobileMenu(false) }}>💰 Grants</div>}
                {enabledModules.inKind !== false && <div style={s.mobileOverflowItem} onClick={() => { setActiveTab('inkind'); setSelectedDonor(null); setShowMobileMenu(false) }}>🎁 In-Kind Gifts</div>}
                <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, padding: '6px 16px 2px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Compliance</div>
                <div style={s.mobileOverflowItem} onClick={() => { setActiveTab('reports'); setSelectedDonor(null); setShowMobileMenu(false) }}>📋 Reports</div>
                <div style={s.mobileOverflowItem} onClick={() => { setActiveTab('activity'); setSelectedDonor(null); setShowMobileMenu(false) }}>🗒️ Audit Log</div>
                {charityIsIpc && <div style={s.mobileOverflowItem} onClick={() => { setActiveTab('iras'); setSelectedDonor(null); setShowMobileMenu(false) }}>🏛️ IRAS Export</div>}
              </>
            )}
            <div style={s.mobileOverflowItem} onClick={() => { setActiveTab('settings'); setSelectedDonor(null); setShowMobileMenu(false) }}>⚙️ Settings</div>
          </div>
        )}
      </div>
      )}

      {/* ── MAIN ── */}
      <div style={isMobile ? s.mainMobile : { ...s.main, marginLeft: sidebarCollapsed ? 64 : 232, width: `calc(100vw - ${sidebarCollapsed ? 64 : 232}px)`, transition: 'margin-left 0.2s ease, width 0.2s ease' }}>
        {/* ── DONORS ── */}
        {activeTab === 'donors' && (
          <DonorsPage
            isMobile={isMobile} isTablet={isTablet} selectedDonor={selectedDonor} setSelectedDonor={setSelectedDonor} combinedDonorList={combinedDonorList}
            filterTopDonorNames={filterTopDonorNames} setFilterTopDonorNames={setFilterTopDonorNames} filterDonorKeys={filterDonorKeys} setFilterDonorKeys={setFilterDonorKeys}
            donorFilterLabel={donorFilterLabel} setDonorFilterLabel={setDonorFilterLabel} activeInsightKey={activeInsightKey} setActiveInsightKey={setActiveInsightKey} dismissInsight={dismissInsight}
            searchTerm={searchTerm} setSearchTerm={setSearchTerm} showDonorFilters={showDonorFilters} setShowDonorFilters={setShowDonorFilters}
            donorStatusFilter={donorStatusFilter} setDonorStatusFilter={setDonorStatusFilter} majorDonorThreshold={majorDonorThreshold}
            donorYearFilter={donorYearFilter} setDonorYearFilter={setDonorYearFilter} donations={donations} fyOf={fyOf}
            exportDonorsExcel={exportDonorsExcel} charityIsIpc={charityIsIpc} exportIRASExcel={exportIRASExcel} filterYear={filterYear}
            filteredDonorList={filteredDonorList} donorsPerPage={donorsPerPage} setDonorsPerPage={setDonorsPerPage} paginatedDonorList={paginatedDonorList}
            loading={loading} activeDonorList={activeDonorList} setActiveTab={setActiveTab} setShowManualForm={setShowManualForm} getDonorWarmth={getDonorWarmth}
            orderedDonorColumns={orderedDonorColumns} draggedDonorColumn={draggedDonorColumn} setDraggedDonorColumn={setDraggedDonorColumn} reorderDonorColumn={reorderDonorColumn}
            donorSortBy={donorSortBy} setDonorSortBy={setDonorSortBy} donorSortDir={donorSortDir} setDonorSortDir={setDonorSortDir}
            pledges={pledges} recurringGifts={recurringGifts} donorsPage={donorsPage} setDonorsPage={setDonorsPage} donorsTotalPages={donorsTotalPages}
            deactivatedDonorList={deactivatedDonorList} setAddDonorForm={setAddDonorForm} setAddDonorError={setAddDonorError} setShowAddDonorModal={setShowAddDonorModal}
            charityName={charityName} thankYouThreshold={thankYouThreshold} donorBadgeMap={donorBadgeMap} generateThankYouNote={generateThankYouNote}
            donorProfileTab={donorProfileTab} setDonorProfileTab={setDonorProfileTab} donorContacts={donorContacts}
            savingCommPrefs={savingCommPrefs} setSavingCommPrefs={setSavingCommPrefs} charityUen={charityUen} session={session} loadDonorContacts={loadDonorContacts} showToast={showToast}
            savingHousehold={savingHousehold} setSavingHousehold={setSavingHousehold} householdLinkSearch={householdLinkSearch} setHouseholdLinkSearch={setHouseholdLinkSearch}
            linkDonorToHousehold={linkDonorToHousehold} unlinkFromHousehold={unlinkFromHousehold}
            donorReceiptNameOverrides={donorReceiptNameOverrides} setDonorReceiptNameOverrides={setDonorReceiptNameOverrides} savingReceiptOverride={savingReceiptOverride} setSavingReceiptOverride={setSavingReceiptOverride}
            savingFamilyContact={savingFamilyContact} setSavingFamilyContact={setSavingFamilyContact} savingVisitSchedule={savingVisitSchedule} setSavingVisitSchedule={setSavingVisitSchedule}
            savingBirthday={savingBirthday} setSavingBirthday={setSavingBirthday} savingTaxResidency={savingTaxResidency} setSavingTaxResidency={setSavingTaxResidency}
            savingMailingAddress={savingMailingAddress} setSavingMailingAddress={setSavingMailingAddress}
            donorNotes={donorNotes} donorNotesLoading={donorNotesLoading} donationBadgeInfo={donationBadgeInfo} cumulativeThresholds={cumulativeThresholds}
            lapsedMinDays={lapsedMinDays} lapsedMinGifts={lapsedMinGifts} allGivingChangeFlags={allGivingChangeFlags}
            givingChangeAckHistory={givingChangeAckHistory} setGivingChangeAckHistory={setGivingChangeAckHistory} logDonorContact={logDonorContact} logDonorContactWithUndo={logDonorContactWithUndo}
            setThankYouDraft={setThankYouDraft} emailTemplates={emailTemplates} EMAIL_TEMPLATE_DEFAULTS={EMAIL_TEMPLATE_DEFAULTS} buildUpgradeThankYouNote={buildUpgradeThankYouNote}
            setLapsedReminderCandidate={setLapsedReminderCandidate} setShowLapsedReminderModal={setShowLapsedReminderModal} donorLastContactMap={donorLastContactMap} lapsedDismissals={lapsedDismissals}
            setRnOutreach={setRnOutreach} donorHistoryPage={donorHistoryPage} setDonorHistoryPage={setDonorHistoryPage} causeNameForDonation={causeNameForDonation}
            setSelectedDonation={setSelectedDonation} setQuickEmailInput={setQuickEmailInput} setQuickNricInput={setQuickNricInput}
            newNoteType={newNoteType} setNewNoteType={setNewNoteType} newNoteText={newNoteText} setNewNoteText={setNewNoteText}
            saveNewDonorNote={saveNewDonorNote} savingNote={savingNote}
            editingDonorNoteId={editingDonorNoteId} setEditingDonorNoteId={setEditingDonorNoteId} editingDonorNoteText={editingDonorNoteText} setEditingDonorNoteText={setEditingDonorNoteText}
            savingDonorNoteEdit={savingDonorNoteEdit} saveDonorNoteEdit={saveDonorNoteEdit} deleteDonorNote={deleteDonorNote} setViewEmailNote={setViewEmailNote}
            setRecurringSearchTerm={setRecurringSearchTerm} setPledgeSearchTerm={setPledgeSearchTerm} donorTagsMap={donorTagsMap} deleteDonorTag={deleteDonorTag}
            setDonorContacts={setDonorContacts} mergeDonorInto={mergeDonorInto} setConfirmModal={setConfirmModal} setDonations={setDonations} setToast={setToast}
          />
        )}

        {/* ── DONATIONS ── */}
        {activeTab === 'donations' && (
          <DonationsPage
            isMobile={isMobile} isTablet={isTablet} userRole={userRole} donations={donations} setDonations={setDonations}
            session={session} charityUen={charityUen} charityName={charityName} charityIsIpc={charityIsIpc} charityIpcLoaded={charityIpcLoaded}
            filterMinAmount={filterMinAmount} setFilterMinAmount={setFilterMinAmount} donationFilterLabel={donationFilterLabel} setDonationFilterLabel={setDonationFilterLabel}
            pendingCountForYear={pendingCountForYear} issueAllReceipts={issueAllReceipts} bulkActionInProgress={bulkActionInProgress}
            showManualForm={showManualForm} setShowManualForm={setShowManualForm} closeManualForm={closeManualForm} editingDonationId={editingDonationId} setEditingDonationId={setEditingDonationId}
            manualError={manualError} manualDuplicateWarning={manualDuplicateWarning} setManualDuplicateWarning={setManualDuplicateWarning} manualForm={manualForm} setManualForm={setManualForm} manualReferralSearch={manualReferralSearch} setManualReferralSearch={setManualReferralSearch}
            donorList={donorList} generatePayNowEntry={generatePayNowEntry} saveManualEntry={saveManualEntry} savingManual={savingManual} myCauses={myCauses}
            payNowQrDonation={payNowQrDonation} setPayNowQrDonation={setPayNowQrDonation} resetManualForm={resetManualForm} confirmManualPayNow={confirmManualPayNow} confirmingPayNow={confirmingPayNow}
            unconfirmedCountForYear={unconfirmedCountForYear} awaitingThankYouCountForYear={awaitingThankYouCountForYear} missingNricThisYear={missingNricThisYear} clearDonationFilters={clearDonationFilters}
            setFilterType={setFilterType} setFilterThankYou={setFilterThankYou} setFilterNric={setFilterNric} filterYear={filterYear} setFilterYear={setFilterYear}
            showDonationFilters={showDonationFilters} setShowDonationFilters={setShowDonationFilters} searchTerm={searchTerm} setSearchTerm={setSearchTerm} filterType={filterType} filterNric={filterNric} filterSource={filterSource} setFilterSource={setFilterSource}
            filterThankYou={filterThankYou} exportDonationsExcel={exportDonationsExcel} activeDonationFilterCount={activeDonationFilterCount}
            bulkProgress={bulkProgress} bulkCancelRef={bulkCancelRef}
            filteredDonations={filteredDonations} donationsPerPage={donationsPerPage} setDonationsPerPage={setDonationsPerPage} paginatedDonations={paginatedDonations} loading={loading}
            setSelectedDonation={setSelectedDonation} setQuickEmailInput={setQuickEmailInput} setQuickNricInput={setQuickNricInput}
            causeNameForDonation={causeNameForDonation} confirmPaymentFlow={confirmPaymentFlow} setConfirmModal={setConfirmModal}
            orderedDonationColumns={orderedDonationColumns} draggedDonationColumn={draggedDonationColumn} setDraggedDonationColumn={setDraggedDonationColumn} reorderDonationColumn={reorderDonationColumn}
            donationSortBy={donationSortBy} setDonationSortBy={setDonationSortBy} donationSortDir={donationSortDir} setDonationSortDir={setDonationSortDir}
            selectedDonation={selectedDonation} selectedRowRef={selectedRowRef}
            donationsPage={donationsPage} setDonationsPage={setDonationsPage} donationsTotalPages={donationsTotalPages}
            setVolunteerEditEntry={setVolunteerEditEntry} setVolunteerEditForm={setVolunteerEditForm} setVolunteerFlagMessage={setVolunteerFlagMessage} setVolunteerEditError={setVolunteerEditError}
            quickEmailInput={quickEmailInput} quickNricInput={quickNricInput}
            nricRequestSent={nricRequestSent} setNricRequestSent={setNricRequestSent} emailTemplates={emailTemplates} sendCharityEmail={sendCharityEmail} showToast={showToast}
            editingNoteId={editingNoteId} setEditingNoteId={setEditingNoteId} noteText={noteText} setNoteText={setNoteText}
            editingImpactNoteId={editingImpactNoteId} setEditingImpactNoteId={setEditingImpactNoteId} impactNoteText={impactNoteText} setImpactNoteText={setImpactNoteText}
            donationPledgeLink={donationPledgeLink} recurringGifts={recurringGifts} refunds={refunds} deleteRefund={deleteRefund} exportSingleReceiptPDF={exportSingleReceiptPDF}
            pledges={pledges} setShowManualPledgeLinkModal={setShowManualPledgeLinkModal}
            showRefundForm={showRefundForm} setShowRefundForm={setShowRefundForm} refundForm={refundForm} setRefundForm={setRefundForm} savingRefund={savingRefund} saveRefund={saveRefund}
            setShowVoidModal={setShowVoidModal} setVoidReason={setVoidReason}
            sendingThankYouId={sendingThankYouId} thankYouDefaultsFor={thankYouDefaultsFor} setThankYouSubjectInput={setThankYouSubjectInput} setThankYouCustomMessage={setThankYouCustomMessage}
            setThankYouPreviewing={setThankYouPreviewing} setThankYouPreviewModal={setThankYouPreviewModal}
            showDonationMoreActions={showDonationMoreActions} setShowDonationMoreActions={setShowDonationMoreActions}
            deletingId={deletingId} deleteDonation={deleteDonation} unconfirmPayment={unconfirmPayment}
            fyOf={fyOf}
          />
        )}

        {/* ── ANALYTICS ── */}
        {activeTab === 'dashboard' && (
          <AnalyticsPage
            ANALYTICS_NAV_OFFSET={ANALYTICS_NAV_OFFSET} acquisitionSourceStats={acquisitionSourceStats} confirmedDonations={confirmedDonations}
            grants={grants} massAppeals={massAppeals} pledges={pledges} thisMonthTotal={thisMonthTotal}
            activeAnalyticsSection={activeAnalyticsSection} aiWeekSummary={aiWeekSummary}
            aiWeekSummaryError={aiWeekSummaryError} aiWeekSummaryLoading={aiWeekSummaryLoading}
            allGivingChangeFlags={allGivingChangeFlags} analyticsGoalStats={analyticsGoalStats} annualGoal={annualGoal}
            appealConversionStats={appealConversionStats} appealListHealthStats={appealListHealthStats}
            appealListStrip={appealListStrip} appealSnapshotStats={appealSnapshotStats}
            appealTrendStats={appealTrendStats} campaignGoalStrip={campaignGoalStrip}
            campaignLeaderboardStats={campaignLeaderboardStats} campaignSnapshotStats={campaignSnapshotStats}
            causeRaisedMap={causeRaisedMap} charityIsIpc={charityIsIpc} charityName={charityName}
            charityUen={charityUen} clearDonationFilters={clearDonationFilters} concentrationTopN={concentrationTopN} customObligations={customObligations} customTasks={customTasks} dashboardActionItemsData={dashboardActionItemsData} daysToDeadline={daysToDeadline}
            donationSizeBreakdownStats={donationSizeBreakdownStats} donations={donations}
            donorHighlightsStats={donorHighlightsStats} donorLTVStats={donorLTVStats} donorList={donorList}
            donorRetentionSnapshotStats={donorRetentionSnapshotStats} enabledModules={enabledModules} filterYear={filterYear} findDonorRecord={findDonorRecord}
            hiddenDashboardCards={hiddenDashboardCards} toggleDashboardCard={toggleDashboardCard}
            dashboardCardOrder={dashboardCardOrder} reorderDashboardCard={reorderDashboardCard} resetDashboardSection={resetDashboardSection}
            fundingConcentrationStats={fundingConcentrationStats}
            fundraisingSnapshotStats={fundraisingSnapshotStats} fyEndDay={fyEndDay} fyEndMonth={fyEndMonth} fyOf={fyOf}
            generateThankYouNote={generateThankYouNote} giroMissedCycles={giroMissedCycles}
            givingChangeMinGifts={givingChangeMinGifts} givingChangeMinPct={givingChangeMinPct}
            givingStreaksStats={givingStreaksStats}
            grantExpensesByGrant={grantExpensesByGrant} grantMatchClaims={grantMatchClaims}
            grantOverviewStats={grantOverviewStats} grantSnapshotStats={grantSnapshotStats}
            grantsWithNextReport={grantsWithNextReport} isMobile={isMobile}
            isTablet={isTablet} lapsedDismissals={lapsedDismissals} lapsedDonorsStats={lapsedDonorsStats}
            lapsedMinDays={lapsedMinDays} lapsedMinGifts={lapsedMinGifts} lapsedReminderHistory={lapsedReminderHistory}
            majorDonorThreshold={majorDonorThreshold}
            monthlyCountData={monthlyCountData} monthlyEquivalentAmount={monthlyEquivalentAmount}
            monthlyExpenses={monthlyExpenses} myCauses={myCauses} newDonorAcquisitionStats={newDonorAcquisitionStats} obligationForm={obligationForm}
            paymentMixStats={paymentMixStats} pledgeConcentrationStats={pledgeConcentrationStats}
            pledgeInstalments={pledgeInstalments} pledgeReliabilityStats={pledgeReliabilityStats}
            pledgeSnapshotStats={pledgeSnapshotStats} pledgeStatsAndTrend={pledgeStatsAndTrend}
            pledgeWatchThreshold={pledgeWatchThreshold} pledgesLoaded={pledgesLoaded}
            predictableVsOneOffStats={predictableVsOneOffStats} quietDonorsStats={quietDonorsStats}
            quietlyPayingStats={quietlyPayingStats} recurringAuthStats={recurringAuthStats}
            recurringCompositionStats={recurringCompositionStats} recurringGifts={recurringGifts}
            recurringHealthStats={recurringHealthStats} recurringMissedThreshold={recurringMissedThreshold}
            recurringMrrStats={recurringMrrStats} recurringRiskStats={recurringRiskStats}
            recurringSnapshotStats={recurringSnapshotStats} recurringTrendCycles={recurringTrendCycles}
            revenueByChannelStats={revenueByChannelStats}
            revenueTrendStats={revenueTrendStats} setActiveTab={setActiveTab} setSettingsSection={setSettingsSection} setAiWeekSummary={setAiWeekSummary} setAiWeekSummaryError={setAiWeekSummaryError}
            setAiWeekSummaryLoading={setAiWeekSummaryLoading} setCampaignSearchTerm={setCampaignSearchTerm}
            setCampaignYearFilter={setCampaignYearFilter} setConcentrationTopN={setConcentrationTopN}
            setConfirmModal={setConfirmModal} setCustomObligations={setCustomObligations} setCustomTasks={setCustomTasks}
            setDonorFilterLabel={setDonorFilterLabel} setFilterDonorKeys={setFilterDonorKeys}
            setFilterThankYou={setFilterThankYou} setFilterTopDonorNames={setFilterTopDonorNames}
            setFilterYear={setFilterYear} setGivingChangeMinGifts={setGivingChangeMinGifts}
            setGivingChangeMinPct={setGivingChangeMinPct} setGrantAmountFilter={setGrantAmountFilter}
            setGrantSearchTerm={setGrantSearchTerm} setGrantUrgencyFilter={setGrantUrgencyFilter}
            setGrantYearFilter={setGrantYearFilter} setLapsedMinDays={setLapsedMinDays}
            setLapsedMinGifts={setLapsedMinGifts} setObligationForm={setObligationForm}
            setPledgeAmountFilter={setPledgeAmountFilter} setPledgeProgrammeFilter={setPledgeProgrammeFilter}
            setPledgeSearchTerm={setPledgeSearchTerm} setPledgeTypeFilter={setPledgeTypeFilter}
            setPledgeUrgencyFilter={setPledgeUrgencyFilter} setPledgeWatchThreshold={setPledgeWatchThreshold}
            setPledgeYearFilter={setPledgeYearFilter} setRecurringAmountFilter={setRecurringAmountFilter}
            setRecurringAuthFilter={setRecurringAuthFilter} setRecurringMissedThreshold={setRecurringMissedThreshold}
            setRecurringProgrammeFilter={setRecurringProgrammeFilter} setRecurringSearchTerm={setRecurringSearchTerm}
            setRecurringTrendCycles={setRecurringTrendCycles} setRecurringTypeFilter={setRecurringTypeFilter}
            setRecurringUrgencyFilter={setRecurringUrgencyFilter} setRecurringYearFilter={setRecurringYearFilter}
            setSelectedDonor={setSelectedDonor} setShowAddObligation={setShowAddObligation}
            setShowAddTask={setShowAddTask} setShowAllBounceReasons={setShowAllBounceReasons}
            setShowAllConcentrationDonors={setShowAllConcentrationDonors} setShowAllEndingSoon={setShowAllEndingSoon}
            setShowAllFatigueList={setShowAllFatigueList} setShowAllFrequentSkippers={setShowAllFrequentSkippers}
            setShowAllGivingChanges={setShowAllGivingChanges} setShowAllLapsedDonors={setShowAllLapsedDonors}
            setShowAllMissedPayments={setShowAllMissedPayments} setShowAllOverGivers={setShowAllOverGivers}
            setShowAllOverdueUnits={setShowAllOverdueUnits} setShowAllPausedGifts={setShowAllPausedGifts}
            setShowAllPledgeConcentration={setShowAllPledgeConcentration}
            setShowAllPledgeWatchlist={setShowAllPledgeWatchlist}
            setShowDismissedLapsedDonors={setShowDismissedLapsedDonors} setShowDoneTasks={setShowDoneTasks}
            setShowSnoozedItems={setShowSnoozedItems} setSnoozeMenuOpen={setSnoozeMenuOpen} setTaskForm={setTaskForm}
            setToast={setToast} showAddObligation={showAddObligation} showAddTask={showAddTask}
            showAllBounceReasons={showAllBounceReasons} showAllConcentrationDonors={showAllConcentrationDonors}
            showAllEndingSoon={showAllEndingSoon} showAllFatigueList={showAllFatigueList}
            showAllFrequentSkippers={showAllFrequentSkippers} showAllGivingChanges={showAllGivingChanges}
            showAllLapsedDonors={showAllLapsedDonors} showAllMissedPayments={showAllMissedPayments}
            showAllOverGivers={showAllOverGivers} showAllOverdueUnits={showAllOverdueUnits}
            showAllPausedGifts={showAllPausedGifts} showAllPledgeConcentration={showAllPledgeConcentration}
            showAllPledgeWatchlist={showAllPledgeWatchlist} showDismissedLapsedDonors={showDismissedLapsedDonors}
            showDoneTasks={showDoneTasks} showSnoozedItems={showSnoozedItems} showToast={showToast} snoozeActionItem={snoozeActionItem} snoozeMenuOpen={snoozeMenuOpen}
            snoozedItems={snoozedItems} taskForm={taskForm} topConnectorsStats={topConnectorsStats} undismissLapsedDonor={undismissLapsedDonor} unsnoozeActionItem={unsnoozeActionItem} updateCharityJsonField={updateCharityJsonField}
            />
        )}

        {/* ── IRAS ── */}
        {activeTab === 'iras' && charityIsIpc && donations.length === 0 && (
          <div style={s.content}>
            <div style={s.pageHeader}>
              <div style={s.pageTitle}>🏛️ IRAS Export</div>
            </div>
            <EmptyState
              icon="🏛️"
              title="No donations to export yet"
              description="Once you've recorded confirmed donations with donor NRICs on file, this tab will generate your IRAS 250% tax deduction submission file."
              ctaLabel="+ Record a Donation"
              onCta={() => { setActiveTab('donations'); setShowManualForm(true) }}
            />
          </div>
        )}

        {activeTab === 'iras' && charityIsIpc && donations.length > 0 && (
          <div style={s.content}>
            <div style={s.pageHeader}>
              <div>
                <div style={s.pageTitle}>🏛️ IRAS Export</div>
                <div style={s.pageSub}>{filterYear === 'All' ? 'Select a year to see submission deadline' : `Year of Assessment ${parseInt(filterYear) + 1} · Due 31 January ${parseInt(filterYear) + 1}`}</div>
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '8px 16px', borderRadius: 20, background: C.forest, border: 'none' }}>
                <select style={{ background: 'transparent', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', outline: 'none', appearance: 'none', WebkitAppearance: 'none', paddingRight: 18 }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                  {[...new Set(donations.map(d => fyOf(d.created_at)))].sort((a,b) => b-a).map(y => <option key={y} style={{ background: C.forest, color: 'white' }}>{y}</option>)}
                </select>
                <span style={{ position: 'absolute', right: 14, color: 'white', fontSize: 10, pointerEvents: 'none' }}>▼</span>
              </div>
            </div>

            {pendingCount > 0 && (
              <div style={s.deadlineBanner}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ fontSize: 24 }}>⚠️</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'white' }}>IRAS Deadline: 31 January {currentYear + 1} — {daysToDeadline} days remaining</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{pendingCount} receipt{pendingCount > 1 ? 's' : ''} still pending across all years{filterYear !== 'All' ? ` · ${pendingCountForYear} pending in ${filterYear}` : ''} · Action required before deadline</div>
                  </div>
                </div>
                <button style={s.bannerBtn} onClick={() => { if (filterYear !== 'All' && pendingCountForYear === 0) { showToast(`No receipts pending in ${filterYear} — switch to "All" or another year to issue the ${pendingCount} pending elsewhere`, 'error'); return } issueAllReceipts() }} disabled={bulkActionInProgress}>{bulkActionInProgress ? 'Issuing...' : `Issue All Receipts${filterYear !== 'All' ? ` (${filterYear})` : ''}`}</button>
              </div>
            )}
            {charityIsIpc && donations.filter(d => !d.donor_nric).length > 0 && (
              <div style={{ ...s.deadlineBanner, background: C.teal, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ fontSize: 24 }}>🪪</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'white' }}>{donations.filter(d => !d.donor_nric).length} donation{donations.filter(d => !d.donor_nric).length > 1 ? 's' : ''} missing NRIC</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>Needed to submit these donations to IRAS for the 250% tax deduction</div>
                  </div>
                </div>
                <button style={s.bannerBtn} onClick={() => { setFilterYear('All'); setActiveTab('donations') }}>Review →</button>
              </div>
            )}
            <div style={{ ...s.deadlineBanner, marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 24 }}>🏛️</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'white' }}>IRAS Submission — {filterYear === 'All' ? 'Select a Year' : `Year of Assessment ${parseInt(filterYear) + 1}`}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>Auto-generated from Giving Tree donor records · Ready to export</div>
                </div>
              </div>
              <div style={{ ...s.irasStatus, ...(pendingCount > 0 || (charityIsIpc && donations.filter(d => !d.donor_nric).length > 0) ? { background: C.warning, color: 'white' } : {}) }}>
                {pendingCount > 0 || (charityIsIpc && donations.filter(d => !d.donor_nric).length > 0) ? '⚠️ Action Needed' : '✓ Ready'}
              </div>
            </div>

            <div style={isMobile ? s.irasInfoGridMobile : isTablet ? s.irasInfoGridTablet : s.irasInfoGrid}>
              {(() => {
                const yearDons = filterYear === 'All' ? [] : donations.filter(d => fyOf(d.created_at) === parseInt(filterYear))
                const missingNric = yearDons.filter(d => !d.donor_nric).length
                const cards = [
                  { label: 'Total Donations', value: `$${totalThisYear.toLocaleString()}`, note: filterYear === 'All' ? 'Select a year for details' : `${yearDons.length} transactions`, warn: false },
                  { label: '250% Deductible', value: `$${(totalThisYear * 2.5).toLocaleString()}`, note: 'Total tax deductible amount', warn: false },
                  ...(charityIsIpc ? [{ label: 'Missing NRIC', value: filterYear === 'All' ? '—' : missingNric, note: filterYear === 'All' ? 'Select a year to check' : missingNric > 0 ? 'Click to see affected donors' : 'All donors have NRIC ✓', warn: filterYear !== 'All' && missingNric > 0, action: filterYear !== 'All' && missingNric > 0 }] : []),
                  { label: 'Receipts Pending', value: pendingCount, note: pendingCount > 0 ? 'Action needed' : 'All issued ✓', warn: pendingCount > 0 },
                ]
                return cards.map((item, i) => (
                  <div key={i} style={{ ...s.irasInfoItem, background: item.warn ? C.warningBg : C.ivory, borderColor: item.warn ? C.warningBorder : C.border, cursor: item.action ? 'pointer' : 'default', position: 'relative' }}
                    onClick={() => item.action && setActiveTab('donations')}>
                    {item.action && <div style={{ position: 'absolute', top: 14, right: 14, fontSize: 16, color: C.warning }}>→</div>}
                    <div style={{ ...s.irasInfoLabel, color: item.warn ? C.warning : C.muted }}>{item.label}</div>
                    <div style={{ ...s.irasInfoValue, color: item.warn ? C.warning : C.forest }}>{item.value}</div>
                    <div style={{ ...s.irasInfoNote, color: item.warn ? C.warning : C.muted }}>{item.note}</div>
                    {item.warn && <div style={{ fontSize: 10, fontWeight: 700, color: C.warning, marginTop: 6 }}>⚠️ {item.action ? 'Tap to view' : 'Action needed'}</div>}
                  </div>
                ))
              })()}
            </div>

            {pendingCount > 0 && (
              <div style={{ background: C.warningBg, border: `1.5px solid ${C.warningBorder}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: C.warning, lineHeight: 1.5 }}>
                ⚠️ {pendingCount} donation{pendingCount > 1 ? 's' : ''} still pending receipt. Issue all receipts before submitting to IRAS.
              </div>
            )}
            {charityIsIpc && donations.filter(d => !d.donor_nric && d.donor_email?.trim()).length > 0 && (
              <div style={{ background: C.warningBg, border: `1.5px solid ${C.warningBorder}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: C.warning, lineHeight: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span>🪪 {donations.filter(d => !d.donor_nric && d.donor_email?.trim()).length} donations missing NRIC have a donor email on file.</span>
                <button style={{ ...s.bannerBtn, background: C.forest, color: 'white', flexShrink: 0 }} onClick={requestAllMissingNric} disabled={bulkActionInProgress}>{bulkActionInProgress ? 'Sending...' : 'Request All NRICs'}</button>
              </div>
            )}
            {charityIsIpc && donations.filter(d => !d.donor_nric && !d.donor_email?.trim()).length > 0 && (
              <div style={{ background: C.warningBg, border: `1.5px solid ${C.warningBorder}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: C.warning, lineHeight: 1.5 }}>
                ⚠️ {donations.filter(d => !d.donor_nric && !d.donor_email?.trim()).length} donation{donations.filter(d => !d.donor_nric && !d.donor_email?.trim()).length > 1 ? 's' : ''} missing NRIC also have no email on file — these can't be reached by the bulk request and will need direct follow-up (phone, mail, or in person).
              </div>
            )}

            <div style={{ background: C.successBg, border: `1.5px solid ${C.bucket1}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: C.forest, lineHeight: 1.6 }}>
              📋 <strong>How to submit to IRAS:</strong> Download the file below, then log in to <strong>myTax Portal</strong> (mytax.iras.gov.sg) using Corppass → Manage Donation Submissions → Upload file. {filterYear !== 'All' && `Deadline: 31 January ${parseInt(filterYear) + 1}.`}
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              {filterYear === 'All' && (
                <div style={{ background: C.warningBg, border: `1.5px solid ${C.warningBorder}`, borderRadius: 12, padding: '10px 14px', fontSize: 13, color: C.warning, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  ⚠️ Select a year above to enable the export.
                  <select style={{ ...s.filterSelect, padding: '4px 10px', fontSize: 12, marginLeft: 'auto' }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                    <option value="All">Select year</option>
                    {[...new Set(donations.map(d => fyOf(d.created_at)))].sort((a,b) => b-a).map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
              )}
              {charityIsIpc && (
                <button style={{ ...s.btnGold, opacity: filterYear === 'All' ? 0.5 : 1, cursor: filterYear === 'All' ? 'not-allowed' : 'pointer' }} onClick={() => { if (filterYear === 'All') return; exportIRASExcel() }}>⬇️ Download IRAS File (.xlsx)</button>
              )}
              <button style={s.btnForest} onClick={exportPDF}>📄 Download PDF Reports</button>
              <button style={{ ...s.btnForest, background: C.teal }} onClick={() => { if (filterYear === 'All') { showToast('Select a specific year first'); return }; exportYearEndSummary() }}>🎉 Year-End Summary for Board</button>
              {pendingCount > 0 && <button style={{ ...s.btnForest, background: C.sage }} onClick={issueAllReceipts} disabled={bulkActionInProgress}>{bulkActionInProgress ? '⏳ Issuing...' : '🧾 Issue All Receipts First'}</button>}
            </div>

            <div style={s.tableCard}>
              <div style={s.tableHeader}>
                <div style={s.tableTitle}>Donor Submission Data</div>
                <div style={s.tableCount}>{filterYear === 'All' ? 'Select a year above' : `${irasYearDonorList.length} donors in ${filterYear}`}</div>
              </div>
              {(isMobile || isTablet) ? (
                <div>
                  {irasYearDonorList.map((d, i) => {
                    const nric = d.donations.find((x: any) => x.donor_nric)?.donor_nric
                    return (
                      <div key={i} style={{ padding: '14px 16px', borderBottom: `1px solid ${C.ivoryDark}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <div style={s.donorCell}>
                            <div style={{ ...s.donorAvatar, background: colorForDonor(d.email || d.name, [C.sage, C.gold, C.forest, C.red, C.borderStrong]) }}>{d.name?.charAt(0)}</div>
                            <div style={s.donorName}>{d.name}</div>
                          </div>
                          {charityIsIpc && (nric ? <span style={s.badgeIssued}>✓ {nric}</span> : <span style={s.badgePending}>⚠️ Missing NRIC</span>)}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Donated</div>
                            <div style={{ ...s.amountText, fontSize: 14 }}>${d.total.toLocaleString()}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Transactions</div>
                            <div style={{ ...s.dateText, fontSize: 14 }}>{d.count}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>250% Deductible</div>
                            <div style={{ ...s.amountText, fontSize: 14, color: C.forest }}>${(d.total * 2.5).toLocaleString()}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Est. Tax Savings</div>
                            <div style={{ ...s.amountText, fontSize: 14, color: C.sage }}>${(d.total * 2.5 * 0.22).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <table style={s.table}>
                  <thead>
                    <tr>{(charityIsIpc ? (isTablet ? ['Donor', 'Total Donated', '250% Deductible', 'NRIC'] : ['Donor', 'Total Donated', 'Transactions', '250% Deductible', 'Est. Tax Savings', 'NRIC']) : (isTablet ? ['Donor', 'Total Donated', '250% Deductible'] : ['Donor', 'Total Donated', 'Transactions', '250% Deductible', 'Est. Tax Savings'])).map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {irasYearDonorList.map((d, i) => (
                      <tr key={i} style={s.tr}>
                        <td style={s.td}>
                            <div style={s.donorCell}>
                              <div style={{ ...s.donorAvatar, background: colorForDonor(d.email || d.name, [C.sage, C.gold, C.forest, C.red, C.borderStrong]) }}>{d.name?.charAt(0)}</div>
                              <div>
                                <div style={s.donorName}>{d.name}</div>
                                {(() => {
                                  const donorKey = d.email?.trim() || d.name
                                  const tags = donorTagsMap[donorKey] || []
                                  return tags.length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
                                      {tags.slice(0, 3).map((t: any) => (
                                        <span key={t.id} style={{ fontSize: 10, fontWeight: 500, color: C.teal, background: C.tealBg, padding: '2px 7px', borderRadius: 20 }}>{t.tag}</span>
                                      ))}
                                      {tags.length > 3 && <span style={{ fontSize: 10, color: C.muted }}>+{tags.length - 3}</span>}
                                    </div>
                                  ) : null
                                })()}
                              </div>
                            </div>
                          </td>
                        <td style={s.td}><span style={s.amountText}>${d.total.toLocaleString()}</span></td>
                        {!isTablet && <td style={s.td}><span style={s.dateText}>{d.count}</span></td>}
                        <td style={s.td}><span style={{ ...s.amountText, color: C.forest }}>${(d.total * 2.5).toLocaleString()}</span></td>
                        {!isTablet && <td style={s.td}><span style={{ ...s.amountText, color: C.sage }}>${(d.total * 2.5 * 0.22).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></td>}
                        {charityIsIpc && (
                          <td style={s.td}>
                            {(() => {
                              const nric = d.donations.find((x: any) => x.donor_nric)?.donor_nric
                              return nric ? <span style={s.badgeIssued}>✓ {nric}</span> : <span style={s.badgePending}>⚠️ Missing</span>
                            })()}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
{/* ── ACTIVITY LOG ── */}

{activeTab === 'activity' && (
          <div style={s.content}>
            <div style={s.pageHeader}>
              <div>
                <div style={s.pageTitle}>🗒️ Audit Log</div>
                <div style={s.pageSub}>Live activity feed — all actions by your team, most recent first.</div>
              </div>
            </div>


            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
              <input style={{ ...s.searchBox, flex: 'none', width: isMobile ? '100%' : 240 }} placeholder="🔍 Search by actor or details..." value={auditSearchTerm} onChange={e => setAuditSearchTerm(e.target.value)} />
              {isMobile && (
                <button style={{ ...s.viewBtn, width: '100%', justifyContent: 'center' }} onClick={() => setShowAuditFilters((v: any) => !v)}>{showAuditFilters ? '▾ Hide Filters' : '▸ Filters & Export'}</button>
              )}
              {(!isMobile || showAuditFilters) && (<>
              <select style={s.filterSelect} value={auditDateFilter} onChange={e => setAuditDateFilter(e.target.value)}>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="All">All time</option>
              </select>
              <select style={s.filterSelect} value={auditActionFilter} onChange={e => setAuditActionFilter(e.target.value)}>
                <option value="All">All activity</option>
                <option value="donation_created">New donations</option>
                <option value="donation_cancelled">Cancellations</option>
                <option value="receipt_issued">Receipts issued</option>
                <option value="payment_confirmed">Payments confirmed</option>
                <option value="payment_confirmation_undone">Payment confirmations undone</option>
                <option value="manual_entry_created">Manual entries added</option>
                <option value="manual_entry_deleted">Manual entries deleted</option>
                <option value="donation_edited">Edits</option>
                {charityIsIpc && <option value="nric_added">NRIC added by charity</option>}
                {charityIsIpc && <option value="nric_synced_by_donor">NRIC updated by donor</option>}
                {charityIsIpc && <option value="bulk_nric_requested">Bulk NRIC requests</option>}
                <option value="bulk_receipts_issued">Bulk receipts issued</option>
              </select>
              {(auditSearchTerm !== '' || auditActionFilter !== 'All' || auditDateFilter !== '30') && (
                <button style={{ ...s.viewBtn, whiteSpace: 'nowrap' }} onClick={() => { setAuditSearchTerm(''); setAuditActionFilter('All'); setAuditDateFilter('30') }}>✕ Clear Filters</button>
              )}
              <button style={isMobile ? { ...s.exportSmallBtn, width: '100%' } : s.exportSmallBtn} onClick={() => {
                const q = auditSearchTerm.toLowerCase().trim()
                const filtered = auditLog.filter(entry => {
                  const matchAction = auditActionFilter === 'All' || entry.action === auditActionFilter
                  const matchDate = auditDateFilter === 'All' || (Date.now() - new Date(entry.created_at).getTime()) < parseInt(auditDateFilter) * 24 * 60 * 60 * 1000
                  const matchSearch = !q || [entry.actor_email, entry.action, JSON.stringify(entry.details || {})].some(f => f?.toLowerCase().includes(q))
                  return matchAction && matchDate && matchSearch
                })
                exportAuditLogExcel(filtered)
              }}>⬇️ Export to Excel</button>
              </>)}
            </div>
            <div style={s.tableCard}>
              <div style={s.tableHeader}>
                <div style={s.tableTitle}>Recent Activity</div>
                <div style={s.tableCount}>{auditLog.filter(entry => {
                  const q = auditSearchTerm.toLowerCase().trim()
                  const matchAction = auditActionFilter === 'All' || entry.action === auditActionFilter
                  const matchDate = auditDateFilter === 'All' || (Date.now() - new Date(entry.created_at).getTime()) < parseInt(auditDateFilter) * 24 * 60 * 60 * 1000
                  const matchSearch = !q || [entry.actor_email, entry.action, JSON.stringify(entry.details || {})].some(f => f?.toLowerCase().includes(q))
                  return matchAction && matchDate && matchSearch
                }).length} entries</div>
              </div>
              {auditLoading ? <div style={s.empty}>Loading...</div> : auditLog.length === 0 ? (
                <EmptyState icon="🗒️" title="No activity recorded yet" description="Every donation, receipt, edit, and deletion made by your team will show up here automatically as an audit trail." />
              ) : (
                <div>
                  {auditLog.filter(entry => {
                    const q = auditSearchTerm.toLowerCase().trim()
                    const matchAction = auditActionFilter === 'All' || entry.action === auditActionFilter
                    const matchDate = auditDateFilter === 'All' || (Date.now() - new Date(entry.created_at).getTime()) < parseInt(auditDateFilter) * 24 * 60 * 60 * 1000
                    const matchSearch = !q || [entry.actor_email, entry.action, JSON.stringify(entry.details || {})].some(f => f?.toLowerCase().includes(q))
                    return matchAction && matchDate && matchSearch
                  }).map(entry => {
                    // Curated icon/color for the actions worth visually emphasizing; anything else
                    // falls back to a readable label derived from the action name itself, so new
                    // action types added elsewhere in the app never show up blank or as raw_snake_case.
                    const actionLabels: Record<string, { label: string, icon: string, color: string }> = {
                      cause_deleted: { label: 'Campaign/banner deleted', icon: '🗑️', color: C.red },
                      cause_submitted: { label: 'Campaign submitted for approval', icon: '🎯', color: C.gold },
                      cause_edited: { label: 'Campaign edited', icon: '✏️', color: C.gold },
                      cause_revision_requested: { label: 'Campaign sent back for revision', icon: '↩️', color: C.gold },
                      cause_completed: { label: 'Campaign marked complete', icon: '✓', color: C.sage },
                      cause_restored: { label: 'Campaign restored', icon: '↺', color: C.sage },
                      cause_created: { label: 'Campaign created', icon: '➕', color: C.sage },
                      cause_permanently_deleted: { label: 'Campaign permanently deleted', icon: '🗑️', color: C.red },
                      sponsored_requested: { label: 'Sponsored banner requested', icon: '⭐', color: C.gold },
                      donation_cancelled: { label: 'Donation cancelled by donor', icon: '✕', color: C.red },
                      donation_edited: { label: 'Donation edited', icon: '✏️', color: C.gold },
                      donation_refunded: { label: 'Donation refunded', icon: '↩️', color: C.red },
                      refund_deleted: { label: 'Refund record deleted', icon: '🗑️', color: C.red },
                      donation_flagged_for_review: { label: 'Donation flagged for review', icon: '🚩', color: C.gold },
                      receipt_issued: { label: 'Receipt issued', icon: '🧾', color: C.sage },
                      manual_entry_deleted: { label: 'Manual entry deleted', icon: '🗑️', color: C.red },
                      manual_entry_created: { label: 'Manual entry added', icon: '➕', color: C.sage },
                      nric_added: { label: 'NRIC added', icon: '🪪', color: C.sage },
                      donation_created: { label: 'New donation received', icon: '💳', color: C.sage },
                      payment_confirmed: { label: 'Payment confirmed', icon: '✓', color: C.sage },
                      payment_confirmation_undone: { label: 'Payment confirmation undone', icon: '↩️', color: C.gold },
                      payment_unconfirmed: { label: 'Payment confirmation undone', icon: '↩️', color: C.gold },
                      bulk_nric_requested: { label: 'Bulk NRIC request sent', icon: '📧', color: C.sage },
                      nric_synced_by_donor: { label: 'Donor updated their NRIC', icon: '🪪', color: C.sage },
                      bulk_receipts_issued: { label: 'Bulk receipts issued', icon: '🧾', color: C.sage },
                      receipt_voided_and_reissued: { label: 'Receipt voided and reissued', icon: '🚫', color: C.red },
                      recurring_gift_added: { label: 'Recurring gift added', icon: '🔁', color: C.sage },
                      recurring_gift_edited: { label: 'Recurring gift edited', icon: '✏️', color: C.gold },
                      recurring_gift_received: { label: 'Recurring payment marked received', icon: '🔁', color: C.sage },
                      recurring_gift_skipped: { label: 'Recurring payment skipped', icon: '⏭️', color: C.gold },
                      recurring_gift_skip_undone: { label: 'Recurring skip undone', icon: '↺', color: C.gold },
                      recurring_gift_failed_deduction: { label: 'Recurring deduction marked failed', icon: '⚠️', color: C.red },
                      recurring_gift_failed_deduction_undone: { label: 'Failed deduction undone', icon: '↺', color: C.gold },
                      recurring_gift_reminder_sent: { label: 'Recurring gift reminder sent', icon: '📧', color: C.sage },
                      recurring_gift_paused: { label: 'Recurring gift paused', icon: '⏸️', color: C.gold },
                      recurring_gift_reactivated: { label: 'Recurring gift reactivated', icon: '▶️', color: C.sage },
                      lapsed_donor_dismissed: { label: 'Lapsed donor dismissed ("not interested")', icon: '🚫', color: C.gold },
                      lapsed_donor_dismissal_undone: { label: 'Lapsed donor dismissal undone', icon: '↺', color: C.gold },
                      insight_dismissed: { label: 'Dashboard insight marked handled', icon: '✓', color: C.sage },
                      pledge_fulfilled: { label: 'Pledge marked as fulfilled', icon: '🤝', color: C.sage },
                      pledge_rescheduled: { label: 'Pledge rescheduled', icon: '📅', color: C.gold },
                      pledge_cancelled: { label: 'Pledge cancelled', icon: '✕', color: C.red },
                      pledge_reminder_sent: { label: 'Pledge reminder sent', icon: '📧', color: C.sage },
                      pledge_contact_logged: { label: 'Pledge contact logged', icon: '📝', color: C.sage },
                      pledge_reverted_to_pending: { label: 'Pledge reverted to pending', icon: '↺', color: C.gold },
                      csv_migration_imported: { label: 'Historical data imported via CSV', icon: '📥', color: C.sage },
                      mass_appeal_sent: { label: 'Mass appeal sent to donors', icon: '📣', color: C.sage },
                      donor_note_added: { label: 'Donor note logged', icon: '📝', color: C.sage },
                      donor_note_deleted: { label: 'Donor note deleted', icon: '🗑️', color: C.red },
                      donor_tag_added: { label: 'Donor tag added', icon: '🏷️', color: C.sage },
                      donor_tag_removed: { label: 'Donor tag removed', icon: '🏷️', color: C.gold },
                      donor_household_linked: { label: 'Donors linked as household', icon: '🏠', color: C.sage },
                      donor_household_unlinked: { label: 'Household link removed', icon: '🏠', color: C.gold },
                      donors_merged: { label: 'Donor records merged', icon: '🔗', color: C.gold },
                      prospect_deleted: { label: 'Prospect deleted', icon: '🗑️', color: C.red },
                      grant_created: { label: 'Grant created', icon: '💰', color: C.sage },
                      grant_edited: { label: 'Grant edited', icon: '✏️', color: C.gold },
                      grant_deleted: { label: 'Grant deleted', icon: '🗑️', color: C.red },
                      grant_note_added: { label: 'Grant note added', icon: '📝', color: C.sage },
                      grant_report_added: { label: 'Grant report added', icon: '📄', color: C.sage },
                      grant_report_edited: { label: 'Grant report edited', icon: '✏️', color: C.gold },
                      grant_report_deleted: { label: 'Grant report deleted', icon: '🗑️', color: C.red },
                      grant_tranche_added: { label: 'Grant tranche added', icon: '💰', color: C.sage },
                      grant_tranche_edited: { label: 'Grant tranche edited', icon: '✏️', color: C.gold },
                      grant_tranche_deleted: { label: 'Grant tranche deleted', icon: '🗑️', color: C.red },
                      grant_match_claim_added: { label: 'Grant match claim added', icon: '💰', color: C.sage },
                      grant_match_claim_edited: { label: 'Grant match claim edited', icon: '✏️', color: C.gold },
                      grant_match_claim_deleted: { label: 'Grant match claim deleted', icon: '🗑️', color: C.red },
                      grant_expense_logged: { label: 'Grant expense logged', icon: '🧾', color: C.sage },
                      grant_expense_edited: { label: 'Grant expense edited', icon: '✏️', color: C.gold },
                      grant_expense_deleted: { label: 'Grant expense deleted', icon: '🗑️', color: C.red },
                      campaign_expense_logged: { label: 'Campaign expense logged', icon: '🧾', color: C.sage },
                      campaign_expense_edited: { label: 'Campaign expense edited', icon: '✏️', color: C.gold },
                      campaign_expense_deleted: { label: 'Campaign expense deleted', icon: '🗑️', color: C.red },
                      monthly_expense_added: { label: 'Monthly expense added', icon: '🧾', color: C.sage },
                      monthly_expense_deleted: { label: 'Monthly expense deleted', icon: '🗑️', color: C.red },
                      team_member_added: { label: 'Team member added', icon: '👤', color: C.sage },
                      team_member_removed: { label: 'Team member removed', icon: '👤', color: C.red },
                      sender_domain_registered: { label: 'Sender domain registered', icon: '🌐', color: C.sage },
                      sender_domain_verified: { label: 'Sender domain verified', icon: '✓', color: C.sage },
                      cumulative_thresholds_updated: { label: 'Giving milestone thresholds updated', icon: '⚙️', color: C.gold },
                      donor_thresholds_updated: { label: 'Major donor threshold updated', icon: '⚙️', color: C.gold },
                      annual_goal_updated: { label: 'Annual goal updated', icon: '🎯', color: C.gold },
                      fiscal_year_end_changed: { label: 'Fiscal year end changed', icon: '📅', color: C.gold },
                    }
                    const humanize = (s: any) => s.replace(/_/g, ' ').replace(/^./, (c: any) => c.toUpperCase())
                    const info = actionLabels[entry.action] || {
                      label: humanize(entry.action),
                      icon: /delet|cancel|refund|remov|permanent/i.test(entry.action) ? '🗑️' : /edit|reschedul|undo|revert|flag/i.test(entry.action) ? '✏️' : '•',
                      color: /delet|cancel|refund|remov|permanent/i.test(entry.action) ? C.red : /edit|reschedul|undo|revert|flag/i.test(entry.action) ? C.gold : C.sage,
                    }
                    // Generic detail renderer — a before/after diff when both are present (covers
                    // donation_edited and any future action shaped the same way), a few narrative
                    // overrides for actions that read better as a sentence than a field dump, and a
                    // fallback that prints every remaining field so nothing is ever silently dropped.
                    const formatVal = (k: any, v: any) => {
                      if (v === null || v === undefined || v === '') return null
                      if (typeof v === 'object') return JSON.stringify(v)
                      if (/amount|total|given|owed|revenue/i.test(k) && typeof v === 'number') return `$${v.toLocaleString()}`
                      if (/date/i.test(k) && typeof v === 'string' && !isNaN(Date.parse(v))) return new Date(v).toLocaleDateString('en-SG')
                      return String(v)
                    }
                    const renderDetails = () => {
                      const d = entry.details
                      if (!d) return null
                      if (d.before && d.after && typeof d.before === 'object' && typeof d.after === 'object') {
                        const changedKeys = Object.keys(d.after).filter(k => JSON.stringify(d.before[k]) !== JSON.stringify(d.after[k]))
                        if (changedKeys.length > 0) {
                          return changedKeys.map(k => `${humanize(k)}: ${formatVal(k, d.before[k]) ?? '—'} → ${formatVal(k, d.after[k]) ?? '—'}`).join(' · ')
                        }
                      }
                      const narrative: Record<string, () => string> = {
                        bulk_nric_requested: () => `${d.donor_count} donor${d.donor_count > 1 ? 's' : ''}`,
                        nric_synced_by_donor: () => `${d.donation_count} donation${d.donation_count > 1 ? 's' : ''} updated`,
                        bulk_receipts_issued: () => `${d.donation_count} receipt${d.donation_count > 1 ? 's' : ''}${d.year ? ` · ${d.year}` : d.donor_name ? ` · ${d.donor_name}` : ''}`,
                        mass_appeal_sent: () => `${d.sent} sent${d.failed ? ` · ${d.failed} failed` : ''}${d.blocked ? ` · ${d.blocked} blocked` : ''} of ${d.total} total`,
                        receipt_voided_and_reissued: () => `${d.donor_name || ''} · ${d.old_receipt_number || '—'} → ${d.new_receipt_number || '—'}${d.void_reason ? ` · "${d.void_reason}"` : ''}`,
                        insight_dismissed: () => `${d.donor_key || ''}${d.insight_key ? ` · ${humanize(d.insight_key)}` : ''}`,
                      }
                      if (narrative[entry.action]) {
                        const text = narrative[entry.action]()
                        if (text && text.trim()) return text
                      }
                      const skip = new Set(['charity_uen', 'before', 'after'])
                      const parts = Object.entries(d).filter(([k, v]) => !skip.has(k) && v !== null && v !== undefined && v !== '').map(([k, v]) => {
                        const fv = formatVal(k, v)
                        return fv ? `${humanize(k)}: ${fv}` : null
                      }).filter(Boolean)
                      return parts.length > 0 ? parts.join(' · ') : null
                    }
                    const detailsText = renderDetails()
                    const linkedDonation = entry.donation_id ? donations.find(d => d.id === entry.donation_id) : null
                    return (
                      <div
                        key={entry.id}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 20px', borderBottom: `1px solid ${C.ivoryDark}`, cursor: linkedDonation ? 'pointer' : 'default' }}
                        onClick={linkedDonation ? () => { setSelectedDonation(linkedDonation); setActiveTab('donations') } : undefined}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: C.ivory, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{info.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: info.color }}>{info.label}{linkedDonation && <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}> · view donation →</span>}</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                            {entry.actor_type === 'donor' ? 'Donor' : 'Charity staff'} ({entry.actor_email}) · {new Date(entry.created_at).toLocaleString('en-SG')}
                          </div>
                          {detailsText && (
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontStyle: 'italic' }}>{detailsText}</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

{/* ── PROMOTIONS ── */}
{activeTab === 'promotions' && enabledModules.campaigns !== false && (
          <div style={s.content}>
            <div style={s.pageHeader}>
              <div>
                <div style={s.pageTitle}>Campaigns</div>
                <div style={s.pageSub}>{myCauses.filter(c => c.type === 'campaign').length} campaign{myCauses.filter(c => c.type === 'campaign').length !== 1 ? 's' : ''} · Trackable goals for Mass Appeal and manual donations</div>
              </div>
              <button style={s.btnGold} onClick={() => { setCauseForm(EMPTY_CAUSE_FORM); setShowCampaignModal(true) }}>+ New Campaign</button>
            </div>

            {(() => {
              if (massAppeals.length === 0) return (
                <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '16px 18px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.forest }}>📢 No appeals sent yet</span>
                  <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} onClick={() => { setMassAppealStep('setup'); setMassAppealForm({ cause_id: '', amount: '', message: defaultMassAppealMessage(), customLabel: '' }); setMassAppealRefs([]); setShowMassAppealModal(true) }}>📣 New Appeal</button>
                </div>
              )
              const searchedAppeals = massAppeals.filter(a => {
                const q = massAppealSearchTerm.toLowerCase().trim()
                const matchesSearch = !q || [a.cause_name, a.message].some((f: any) => f?.toLowerCase().includes(q))
                const matchesYear = massAppealYearFilter === 'All' || fyOf(a.created_at).toString() === massAppealYearFilter
                const amt = Number(a.amount)
                const matchesAmt = massAppealAmountFilter === 'All'
                  || (massAppealAmountFilter === 'Under 20' && amt < 20)
                  || (massAppealAmountFilter === '20-50' && amt >= 20 && amt <= 50)
                  || (massAppealAmountFilter === '50-100' && amt > 50 && amt <= 100)
                  || (massAppealAmountFilter === 'Over 100' && amt > 100)
                const matchesProgramme = massAppealProgrammeFilter === 'All' || (massAppealProgrammeFilter === '__none__' ? !a.cause_id : a.cause_id === massAppealProgrammeFilter)
                const matchesStatus = massAppealStatusFilter === 'All'
                  || (massAppealStatusFilter === 'Sending' && a.status === 'sending')
                  || (massAppealStatusFilter === 'Sent' && a.status === 'sent' && a.failed_count === 0)
                  || (massAppealStatusFilter === 'Partial' && a.status === 'sent' && a.failed_count > 0)
                return matchesSearch && matchesYear && matchesAmt && matchesProgramme && matchesStatus
              }).sort((a: any, b: any) => {
                if (massAppealSortBy === 'created_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                if (massAppealSortBy === 'created_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                if (massAppealSortBy === 'amount_desc') return Number(b.amount) - Number(a.amount)
                if (massAppealSortBy === 'amount_asc') return Number(a.amount) - Number(b.amount)
                if (massAppealSortBy === 'sent_desc') return b.sent_count - a.sent_count
                if (massAppealSortBy === 'failed_desc') return b.failed_count - a.failed_count
                return 0
              })
              const renderAppealCard = (a: any) => (
                <div key={a.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px', cursor: 'pointer' }} onClick={() => openAppealDetail(a)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: C.forest }}>{a.cause_name || 'General appeal'}</span>
                    {a.status === 'sending' ? (
                      <span style={{ fontSize: 11, fontWeight: 500, color: C.gold, background: C.gold + '1A', padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>⏳ Sending…</span>
                    ) : a.status === 'cancelled' ? (
                      <span style={{ fontSize: 11, fontWeight: 500, color: C.muted, background: C.ivory, padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>⊘ Cancelled</span>
                    ) : a.failed_count > 0 ? (
                      <span style={{ fontSize: 11, fontWeight: 500, color: C.warning, background: C.warningBg, padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>⚠ Partial</span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 500, color: C.sage, background: C.successBg, padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>✓ Sent</span>
                    )}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 500, color: C.forest, marginBottom: 2 }}>${Number(a.amount).toLocaleString()}<span style={{ fontSize: 12, fontWeight: 400, color: C.muted }}> suggested</span></div>
                  {a.message ? (
                    <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.4, marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>"{a.message}"</div>
                  ) : (
                    <div style={{ fontSize: 12.5, color: C.muted, fontStyle: 'italic', marginBottom: 10 }}>No message added</div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: C.muted, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                    <span>{new Date(a.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span>{a.failed_count > 0 ? `${a.sent_count} of ${a.donor_count} sent` : `${a.sent_count} sent`}</span>
                  </div>
                </div>
              )
              const byYear: Record<number, any[]> = {}
              searchedAppeals.forEach((a: any) => { const y = fyOf(a.created_at); if (!byYear[y]) byYear[y] = []; byYear[y].push(a) })
              const years = Object.keys(byYear).map(Number).sort((a, b) => b - a)
              return (
                <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '16px 18px', marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: generalAppealsExpanded ? 14 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setGeneralAppealsExpanded((v: any) => !v)}>
                      <span style={{ fontSize: 11, color: C.muted }}>{generalAppealsExpanded ? '▾' : '▸'}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.forest }}>📢 Appeals</span>
                      <span style={{ fontSize: 12, color: C.muted }}>({massAppeals.length} sent)</span>
                    </div>
                    <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} onClick={() => { setMassAppealStep('setup'); setMassAppealForm({ cause_id: '', amount: '', message: defaultMassAppealMessage(), customLabel: '' }); setMassAppealRefs([]); setShowMassAppealModal(true) }}>📣 New Appeal</button>
                  </div>
                  {generalAppealsExpanded && (
                    <div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
                        <input style={{ ...s.searchBox, flex: 'none', width: isMobile ? '100%' : 260 }} placeholder="🔍 Search by campaign name or message..." value={massAppealSearchTerm} onChange={e => setMassAppealSearchTerm(e.target.value)} />
                        <select style={{ ...s.formInput, width: isMobile ? '100%' : 130 }} value={massAppealYearFilter} onChange={e => setMassAppealYearFilter(e.target.value)}>
                          <option value="All">All years</option>
                          {[...new Set(massAppeals.map((a: any) => fyOf(a.created_at)))].sort((a: any, b: any) => b - a).map((y: any) => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                        <select style={{ ...s.formInput, width: isMobile ? '100%' : 140 }} value={massAppealAmountFilter} onChange={e => setMassAppealAmountFilter(e.target.value)}>
                          <option value="All">All amounts</option>
                          <option value="Under 20">Under $20</option>
                          <option value="20-50">$20 – $50</option>
                          <option value="50-100">$50 – $100</option>
                          <option value="Over 100">Over $100</option>
                        </select>
                        <select style={{ ...s.formInput, width: isMobile ? '100%' : 170 }} value={massAppealProgrammeFilter} onChange={e => setMassAppealProgrammeFilter(e.target.value)}>
                          <option value="All">All programmes</option>
                          <option value="__none__">General appeal</option>
                          {myCauses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </select>
                        <select style={{ ...s.formInput, width: isMobile ? '100%' : 140 }} value={massAppealStatusFilter} onChange={e => setMassAppealStatusFilter(e.target.value)}>
                          <option value="All">All statuses</option>
                          <option value="Sent">Fully sent</option>
                          <option value="Partial">Partial (some failed)</option>
                          <option value="Sending">Still sending</option>
                        </select>
                        <select style={{ ...s.formInput, width: isMobile ? '100%' : 160 }} value={massAppealSortBy} onChange={e => setMassAppealSortBy(e.target.value)}>
                          <option value="created_desc">Sort: Newest first</option>
                          <option value="created_asc">Sort: Oldest first</option>
                          <option value="amount_desc">Sort: Amount (high–low)</option>
                          <option value="amount_asc">Sort: Amount (low–high)</option>
                          <option value="sent_desc">Sort: Most sent</option>
                          <option value="failed_desc">Sort: Most failed</option>
                        </select>
                        {(massAppealSearchTerm !== '' || massAppealYearFilter !== 'All' || massAppealAmountFilter !== 'All' || massAppealProgrammeFilter !== 'All' || massAppealStatusFilter !== 'All') && (
                          <button style={{ ...s.viewBtn, whiteSpace: 'nowrap' }} onClick={() => { setMassAppealSearchTerm(''); setMassAppealYearFilter('All'); setMassAppealAmountFilter('All'); setMassAppealProgrammeFilter('All'); setMassAppealStatusFilter('All') }}>✕ Clear Filters</button>
                        )}
                        <button style={isMobile ? { ...s.exportSmallBtn, width: '100%' } : s.exportSmallBtn} onClick={() => exportMassAppealsExcel(searchedAppeals)}>⬇️ Export to Excel</button>
                      </div>
                      {searchedAppeals.length === 0 ? (
                        <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}>No appeals match your filters.</div>
                      ) : (
                        years.map(year => (
                          <div key={year} style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: C.forest, marginBottom: 10 }}>{year} <span style={{ color: C.muted, fontWeight: 400 }}>({byYear[year].length})</span></div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                              {byYear[year].map(renderAppealCard)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

            {myCauses.length > 0 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
                <input style={{ ...s.searchBox, flex: 'none', width: isMobile ? '100%' : 380 }} placeholder="🔍 Search campaigns by title, description, or category..." value={campaignSearchTerm} onChange={e => setCampaignSearchTerm(e.target.value)} />
                {isMobile && (
                  <button style={{ ...s.viewBtn, width: '100%', justifyContent: 'center' }} onClick={() => setShowCampaignFilters((v: any) => !v)}>{showCampaignFilters ? '▾ Hide Filters' : '▸ Filters & Sort'}</button>
                )}
                {(!isMobile || showCampaignFilters) && (<>
                <select style={{ ...s.formInput, width: isMobile ? '100%' : 130 }} value={campaignYearFilter} onChange={e => setCampaignYearFilter(e.target.value)}>
                  <option value="All">All years</option>
                  {[...new Set(myCauses.filter(c => c.type === 'campaign').map(c => fyOf(c.created_at)))].sort((a, b) => b - a).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <select style={{ ...s.formInput, width: isMobile ? '100%' : 170 }} value={campaignAmountFilter} onChange={e => setCampaignAmountFilter(e.target.value)}>
                  <option value="All">All goal sizes</option>
                  <option value="Under 1000">Under $1,000</option>
                  <option value="1000-5000">$1,000 – $5,000</option>
                  <option value="5000-20000">$5,000 – $20,000</option>
                  <option value="Over 20000">Over $20,000</option>
                </select>
                <select style={{ ...s.formInput, width: isMobile ? '100%' : 150 }} value={campaignStatusFilter} onChange={e => setCampaignStatusFilter(e.target.value)}>
                  <option value="All">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Live</option>
                  <option value="completed">Ended / Completed</option>
                  <option value="rejected">Rejected</option>
                  <option value="deleted">Deleted</option>
                </select>
                <select style={{ ...s.formInput, width: isMobile ? '100%' : 170 }} value={campaignSortBy} onChange={e => setCampaignSortBy(e.target.value)}>
                  <option value="created_desc">Sort: Newest first</option>
                  <option value="created_asc">Sort: Oldest first</option>
                  <option value="raised_desc">Sort: Amount raised (high–low)</option>
                  <option value="raised_asc">Sort: Amount raised (low–high)</option>
                  <option value="ending_soon">Sort: Ending soonest</option>
                  <option value="title_az">Sort: Title A–Z</option>
                </select>
                {(campaignSearchTerm !== '' || campaignYearFilter !== 'All' || campaignAmountFilter !== 'All' || campaignStatusFilter !== 'All') && (
                  <button style={{ ...s.viewBtn, whiteSpace: 'nowrap' }} onClick={() => { setCampaignSearchTerm(''); setCampaignYearFilter('All'); setCampaignAmountFilter('All'); setCampaignStatusFilter('All') }}>✕ Clear Filters</button>
                )}
                <button style={isMobile ? { ...s.exportSmallBtn, width: '100%' } : s.exportSmallBtn} onClick={() => {
                  const q = campaignSearchTerm.toLowerCase().trim()
                  const filtered = myCauses.filter(c => {
                    if (c.type !== 'campaign') return false
                    const matchesSearch = !q || [c.title, c.description, c.category].some(f => f?.toLowerCase().includes(q))
                    const matchesYear = campaignYearFilter === 'All' || fyOf(c.created_at).toString() === campaignYearFilter
                    const amt = Number(c.target_amount) || 0
                    const matchesAmt = campaignAmountFilter === 'All'
                      || (campaignAmountFilter === 'Under 1000' && amt < 1000)
                      || (campaignAmountFilter === '1000-5000' && amt >= 1000 && amt <= 5000)
                      || (campaignAmountFilter === '5000-20000' && amt > 5000 && amt <= 20000)
                      || (campaignAmountFilter === 'Over 20000' && amt > 20000)
                    const matchesStatus = campaignStatusFilter === 'All' || c.status === campaignStatusFilter
                    return matchesSearch && matchesYear && matchesAmt && matchesStatus
                  })
                  exportCampaignsExcel(filtered)
                }}>⬇️ Export to Excel</button>
                </>)}
              </div>
            )}

            {(() => {
              const q = campaignSearchTerm.toLowerCase().trim()
              const matchesSearch = (c: any) => !q || [c.title, c.description, c.category].some(f => f?.toLowerCase().includes(q))
              const matchesYear = (c: any) => campaignYearFilter === 'All' || fyOf(c.created_at).toString() === campaignYearFilter
              const matchesAmt = (c: any) => {
                const amt = Number(c.target_amount) || 0
                return campaignAmountFilter === 'All'
                  || (campaignAmountFilter === 'Under 1000' && amt < 1000)
                  || (campaignAmountFilter === '1000-5000' && amt >= 1000 && amt <= 5000)
                  || (campaignAmountFilter === '5000-20000' && amt > 5000 && amt <= 20000)
                  || (campaignAmountFilter === 'Over 20000' && amt > 20000)
              }
              const matchesStatus = (c: any) => campaignStatusFilter === 'All' || c.status === campaignStatusFilter
              const raisedFor = (c: any) => donations.filter(d => d.cause_id === c.id && d.payment_status === 'confirmed').reduce((s, d) => s + d.amount, 0)
              const sortCauses = (arr: any) => [...arr].sort((a, b) => {
                if (campaignSortBy === 'created_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                if (campaignSortBy === 'created_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                if (campaignSortBy === 'raised_desc') return raisedFor(b) - raisedFor(a)
                if (campaignSortBy === 'raised_asc') return raisedFor(a) - raisedFor(b)
                if (campaignSortBy === 'ending_soon') return new Date(a.end_date || '9999-12-31').getTime() - new Date(b.end_date || '9999-12-31').getTime()
                if (campaignSortBy === 'title_az') return a.title.localeCompare(b.title)
                return 0
              })
              const isPast = (c: any) => c.status === 'rejected' || c.status === 'deleted' || c.status === 'completed' || (c.status === 'approved' && c.end_date && new Date(c.end_date) < new Date())
              const activeCauses = sortCauses(myCauses.filter(c => c.type === 'campaign' && !isPast(c) && matchesSearch(c) && matchesYear(c) && matchesAmt(c) && matchesStatus(c)))
              const pastCauses = sortCauses(myCauses.filter(c => c.type === 'campaign' && isPast(c) && matchesSearch(c) && matchesYear(c) && matchesAmt(c) && matchesStatus(c)))

              const renderCard = (c: any) => {
                const raised = donations.filter(d => d.cause_id === c.id && d.payment_status === 'confirmed').reduce((s, d) => s + d.amount, 0)
                const donorCount = new Set(donations.filter(d => d.cause_id === c.id && d.payment_status === 'confirmed').map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name)).size
                const loggedExpenses = campaignExpensesByCause[c.id] || []
                const spent = loggedExpenses.reduce((s: any, e: any) => s + Number(e.amount), 0)
                const costForRoi = spent > 0 ? spent : Number(c.cost) || 0
                const pct = c.target_amount > 0 ? Math.min(100, Math.round((raised / c.target_amount) * 100)) : null
                const daysLeft = c.end_date ? Math.ceil((new Date(c.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null
                const isActive = c.status === 'approved' && !isPast(c)
                const goalMet = c.target_amount > 0 && raised >= c.target_amount

                let behindPace = false
                if (isActive && c.target_amount > 0 && c.end_date) {
                  const periodStart = new Date(c.start_date || c.created_at)
                  const totalDuration = new Date(c.end_date).getTime() - periodStart.getTime()
                  const elapsed = new Date().getTime() - periodStart.getTime()
                  const elapsedPct = totalDuration > 0 ? Math.min(100, Math.max(0, (elapsed / totalDuration) * 100)) : 0
                  behindPace = pct < elapsedPct - 15
                }

                const campaignStatusMap: Record<string, { bg: string, color: string, label: string }> = {
                  approved: { bg: C.sage, color: C.white, label: 'Active' },
                  pending: { bg: C.gold, color: C.white, label: '⏳ Pending' },
                  rejected: { bg: C.red, color: C.white, label: '✕ Rejected' },
                  deleted: { bg: C.muted, color: C.white, label: '🗑 Deleted' },
                  completed: goalMet ? { bg: C.sage, color: C.white, label: '✓ Goal Met!' } : { bg: C.muted, color: C.white, label: '◻ Ended' },
                }
                const cStatusInfo = campaignStatusMap[c.status] || { bg: C.muted, color: C.white, label: c.status }
                const campaignAppeals = massAppeals.filter(a => a.cause_id === c.id)
                const cHasActivity = true
                return (
                  <div key={c.id} style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

                    {/* Header: who */}
                    <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${C.ivoryDark}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>{c.title}</div>
                          {c.description && <div style={{ fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>{c.description}</div>}
                          {(c.category || (charityIsIpc && c.tax_deductible === false) || (c.permit_status === 'pending') || (c.permit_status === 'obtained' && c.permit_expiry && new Date(c.permit_expiry) < new Date())) && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                              {c.category && <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4, background: C.ivory, border: `1px solid ${C.border}`, color: C.muted }}>{c.category}</span>}
                              {charityIsIpc && c.tax_deductible === false && <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4, background: C.dangerBg, color: C.red }}>Not tax-deductible</span>}
                              {c.permit_status === 'pending' && <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4, background: C.warningBg, color: C.warning }}>⏳ Permit pending</span>}
                              {c.permit_status === 'obtained' && c.permit_expiry && new Date(c.permit_expiry) < new Date() && <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4, background: C.dangerBg, color: C.red }}>⚠ Permit expired</span>}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 20, background: cStatusInfo.bg, color: cStatusInfo.color, flexShrink: 0 }}>{cStatusInfo.label}</span>
                      </div>
                    </div>

                    {/* Fundraising */}
                    <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.ivoryDark}` }}>
                      {c.target_amount > 0 && (() => {
                        const progressColor = goalMet ? C.sage : behindPace ? C.gold : C.sage
                        return (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                              <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                <span style={{ fontFamily: C.fontVoice, fontSize: 19, fontWeight: 500, color: C.forest }}>${raised.toLocaleString()}</span>
                                <span style={{ fontSize: 13, color: C.muted }}>of</span>
                                <span style={{ fontFamily: C.fontVoice, fontSize: 19, fontWeight: 500, color: C.forest }}>${Number(c.target_amount).toLocaleString()}</span>
                                <span style={{ fontSize: 13, color: C.muted }}>raised</span>
                              </span>
                              <span style={{ fontSize: 15, fontWeight: 700, color: progressColor }}>{pct}%</span>
                            </div>
                            <div style={{ background: C.ivoryDark, borderRadius: 3, height: 7, overflow: 'hidden' }}>
                              <div style={{ width: `${Math.max(pct, 2)}%`, height: '100%', background: progressColor, borderRadius: 3 }} />
                            </div>
                          </div>
                        )
                      })()}
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${costForRoi > 0 ? 4 : 3}, minmax(0, 1fr))`, gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: C.muted, marginBottom: 2 }}>Donors</div>
                          <div style={{ fontFamily: C.fontMono, fontSize: 14, fontWeight: 500, color: C.forest }}>{donorCount}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: C.muted, marginBottom: 2 }}>{isActive ? 'Ends' : 'Ended'}</div>
                          <div style={{ fontFamily: C.fontMono, fontSize: 14, fontWeight: 500, color: isActive && daysLeft !== null && daysLeft < 0 ? C.red : C.forest }}>
                            {daysLeft === null ? '—' : isActive ? (daysLeft >= 0 ? `${daysLeft}d` : 'Overdue') : new Date(c.end_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: C.muted, marginBottom: 2 }}>Pace</div>
                          <div style={{ fontFamily: C.fontMono, fontSize: 14, fontWeight: 500, color: c.target_amount <= 0 ? C.muted : c.status === 'completed' ? (goalMet ? C.sage : C.muted) : (behindPace ? C.gold : C.sage) }}>
                            {c.target_amount <= 0 ? '—' : c.status === 'completed' ? (goalMet ? 'Goal met' : 'Ended') : (behindPace ? 'Behind' : 'On track')}
                          </div>
                        </div>
                        {costForRoi > 0 && (
                          <div>
                            <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: C.muted, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                              ROI
                              <InfoTip text={`${spent > 0 ? `$${spent.toLocaleString()} spent` : `$${Number(c.cost).toLocaleString()} budgeted`}${spent > 0 && Number(c.cost) > 0 ? ` of $${Number(c.cost).toLocaleString()} budget` : ''}`} />
                            </div>
                            <div style={{ fontFamily: C.fontMono, fontSize: 14, fontWeight: 500, color: raised >= costForRoi ? C.sage : C.red }}>{(raised / costForRoi).toFixed(1)}×</div>
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: C.muted, fontStyle: 'italic', marginTop: 8 }}>Submitted {new Date(c.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    </div>

                    {/* Activity */}
                    {cHasActivity && (
                      <div style={{ padding: '12px 16px', background: C.ivory, borderBottom: `1px solid ${C.ivoryDark}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', flex: 1, justifyContent: 'center', borderRadius: 4 }} onClick={() => setExpandedCampaignId(expandedCampaignId === c.id ? null : c.id)}>{expandedCampaignId === c.id ? '▲ Hide ledger' : '▼ View ledger'}</button>
                          {campaignAppeals.length > 0 && (
                            <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', flex: 1, justifyContent: 'center', borderRadius: 4 }} onClick={() => setExpandedCampaignAppeals((prev: any) => {
                              const next = new Set(prev)
                              if (next.has(c.id)) next.delete(c.id); else next.add(c.id)
                              return next
                            })}>{expandedCampaignAppeals.has(c.id) ? '▲ Hide appeals' : `▼ Appeals (${campaignAppeals.length})`}</button>
                          )}
                        </div>
                        {expandedCampaignAppeals.has(c.id) && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {campaignAppeals.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(a => (
                              <div key={a.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '10px 12px', cursor: 'pointer' }} onClick={() => openAppealDetail(a)}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                  <span style={{ fontSize: 13, fontWeight: 500, color: C.forest }}>{a.cause_name || 'Campaign appeal'}</span>
                                  {a.failed_count > 0 ? (
                                    <span style={{ fontSize: 11, fontWeight: 500, color: C.warning, background: C.warningBg, padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>⚠ Partial</span>
                                  ) : (
                                    <span style={{ fontSize: 11, fontWeight: 500, color: C.sage, background: C.successBg, padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>✓ Sent</span>
                                  )}
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 500, color: C.forest, marginBottom: 4 }}>${Number(a.amount).toLocaleString()}<span style={{ fontSize: 11, fontWeight: 400, color: C.muted }}> suggested</span></div>
                                <div style={{ fontSize: 11.5, color: C.muted }}>{new Date(a.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })} · {a.failed_count > 0 ? `${a.sent_count} of ${a.donor_count} sent` : `${a.sent_count} sent`}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {expandedCampaignId === c.id && (
                          <CampaignExpensePanel
                            cause={c} s={s} C={C}
                            expenses={campaignExpensesByCause[c.id] || []}
                            categories={campaignExpenseCategories}
                            onSaveExpense={form => saveCampaignExpense(c.id, form)}
                            onEditExpense={(expense, updates) => editCampaignExpense(expense, updates)}
                            onDeleteExpense={id => {
                              const exp = (campaignExpensesByCause[c.id] || []).find((e: any) => e.id === id)
                              setConfirmModal({
                                title: 'Delete this expense?',
                                description: exp ? `"${exp.description}" — $${Number(exp.amount).toLocaleString()} will be permanently removed. This cannot be undone.` : 'This expense will be permanently removed. This cannot be undone.',
                                confirmLabel: 'Delete',
                                onConfirm: () => deleteCampaignExpense(id),
                              })
                            }}
                          />
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'auto', position: 'relative' }}>
                      {c.status === 'pending' && (
                        <button style={{ ...s.viewBtn, fontSize: 11.5, padding: '7px 10px', width: '100%', justifyContent: 'center' }} onClick={() => startEditCause(c)}>✏️ Edit</button>
                      )}
                      {isActive && (
                        <>
                          <button style={{ ...s.issueBtn, fontSize: 12, fontWeight: 500, padding: '8px 10px', width: '100%', justifyContent: 'center' }} onClick={() => completeCause(c, raised)}>✓ Complete</button>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button style={{ ...s.viewBtn, fontSize: 11.5, padding: '7px 8px', flex: 1, justifyContent: 'center' }} onClick={() => { setMassAppealStep('setup'); setMassAppealForm({ cause_id: c.id, amount: '', message: defaultMassAppealMessage(), customLabel: '' }); setMassAppealRefs([]); setShowMassAppealModal(true) }}>📣 Appeal</button>
                            <button style={{ ...s.viewBtn, fontSize: 11.5, padding: '7px 8px', flex: 1, justifyContent: 'center' }} onClick={() => requestRevision(c)}>✏️ Edit</button>
                          </div>
                        </>
                      )}
                      {c.status === 'approved' && !isActive && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ fontSize: 11, color: C.muted }}>Its end date has passed — mark it complete, or edit to extend the date.</div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button style={{ ...s.issueBtn, fontSize: 12, fontWeight: 500, padding: '8px 10px', flex: 1, justifyContent: 'center' }} onClick={() => completeCause(c, raised)}>✓ Complete</button>
                            <button style={{ ...s.viewBtn, fontSize: 11.5, padding: '7px 8px', flex: 1, justifyContent: 'center' }} onClick={() => requestRevision(c)}>✏️ Edit</button>
                            <button style={{ ...s.viewBtn, fontSize: 11.5, padding: '7px 8px', color: C.red, borderColor: C.red, flex: 1, justifyContent: 'center' }} onClick={() => deleteCause(c.id)}>Delete</button>
                          </div>
                        </div>
                      )}
                      {c.status === 'deleted' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button style={{ ...s.issueBtn, fontSize: 12, fontWeight: 500, padding: '8px 10px', flex: 1, justifyContent: 'center' }} onClick={() => restoreCause(c)}>↺ Restore</button>
                          <button style={{ ...s.viewBtn, fontSize: 11.5, padding: '7px 8px', color: C.red, borderColor: C.red, flex: 1, justifyContent: 'center' }} onClick={() => permanentlyDeleteCause(c)}>🗑 Delete permanently</button>
                        </div>
                      )}
                      {c.status === 'completed' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button style={{ ...s.issueBtn, fontSize: 12, fontWeight: 500, padding: '8px 10px', flex: 1, justifyContent: 'center' }} onClick={() => restoreCause(c)}>↺ Restore</button>
                          <button style={{ ...s.viewBtn, fontSize: 11.5, padding: '7px 8px', color: C.red, borderColor: C.red, flex: 1, justifyContent: 'center' }} onClick={() => deleteCause(c.id)}>Delete</button>
                        </div>
                      )}
                      {c.status === 'rejected' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button style={{ ...s.viewBtn, fontSize: 11.5, padding: '7px 8px', flex: 1, justifyContent: 'center' }} onClick={() => requestRevision(c)}>✏️ Edit &amp; Resubmit</button>
                          <button style={{ ...s.viewBtn, fontSize: 11.5, padding: '7px 8px', color: C.red, borderColor: C.red, flex: 1, justifyContent: 'center' }} onClick={() => deleteCause(c.id)}>Delete</button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              }

              return (
                <>
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.forest, marginBottom: 12 }}>Active Campaigns ({activeCauses.length})</div>
                    {activeCauses.length === 0 && myCauses.length === 0 ? (
                      <EmptyState
                        icon="📣"
                        title="No campaigns yet"
                        description="Campaigns let you track fundraising for a specific goal or event — set a target, log costs, and see performance separately from general giving."
                        ctaLabel="+ New Campaign"
                        onCta={() => { setCauseForm(EMPTY_CAUSE_FORM); setShowCampaignModal(true) }}
                      />
                    ) : activeCauses.length === 0 ? (
                      <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 20px', fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No active campaigns right now — click "+ New Campaign" to start one.</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'start' }}>
                        {activeCauses.map(renderCard)}
                      </div>
                    )}
                  </div>

                  {pastCauses.length > 0 && (
                    <div>
                      <div
                        style={{ fontSize: 13, fontWeight: 500, color: C.muted, marginBottom: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                        onClick={() => setShowPastCampaigns((v: any) => !v)}
                      >
                        <span style={{ fontSize: 11, color: C.muted }}>{showPastCampaigns ? '▾' : '▸'}</span>
                        Past Campaigns ({pastCauses.length})
                      </div>
                      {showPastCampaigns && (
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'start' }}>
                          {pastCauses.map(renderCard)}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )
            })()}

            {showCampaignModal && (
              <div data-modal-overlay="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => { setShowCampaignModal(false); setCauseError(''); setCauseForm(EMPTY_CAUSE_FORM) }}>
                <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>{causeForm.editingId ? 'Edit Campaign' : 'New Campaign'}</div>
                    <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => { setShowCampaignModal(false); setCauseError(''); setCauseForm(EMPTY_CAUSE_FORM) }}>✕</button>
                  </div>
                  {causeError && <div style={{ background: C.warningBg, color: C.warning, padding: '10px 14px', borderRadius: 6, fontSize: 13, marginTop: 12, marginBottom: 4 }}>{causeError}</div>}
                  <label style={{ display: 'block', marginTop: 12, marginBottom: 10 }}>
                    <div style={s.formLabel}>Title *</div>
                    <input style={s.formInput} placeholder="e.g. Winter Meal Drive" value={causeForm.title} onChange={e => setCauseForm((f: any) => ({ ...f, title: e.target.value }))} />
                  </label>
                  <label style={{ display: 'block', marginBottom: 10 }}>
                    <div style={s.formLabel}>Description *</div>
                    <textarea style={{ ...s.formInput, minHeight: 80, resize: 'vertical' }} placeholder="What is this campaign for?" value={causeForm.description} onChange={e => setCauseForm((f: any) => ({ ...f, description: e.target.value }))} />
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 10 }}>
                    <label style={{ display: 'block' }}>
                      <div style={s.formLabel}>Start Date</div>
                      <input style={s.formInput} type="date" value={causeForm.start_date} onChange={e => setCauseForm((f: any) => ({ ...f, start_date: e.target.value }))} />
                    </label>
                    <label style={{ display: 'block' }}>
                      <div style={s.formLabel}>End Date</div>
                      <input style={s.formInput} type="date" value={causeForm.end_date} onChange={e => setCauseForm((f: any) => ({ ...f, end_date: e.target.value }))} />
                    </label>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 10 }}>
                    <label style={{ display: 'block' }}>
                      <div style={s.formLabel}>Target Amount (SGD)</div>
                      <input style={s.formInput} type="number" placeholder="Optional" value={causeForm.target_amount} onChange={e => setCauseForm((f: any) => ({ ...f, target_amount: e.target.value }))} />
                    </label>
                    <label style={{ display: 'block' }}>
                      <div style={s.formLabel}>Campaign Cost (SGD)</div>
                      <input style={s.formInput} type="number" placeholder="e.g. printing, postage, venue" value={causeForm.cost} onChange={e => setCauseForm((f: any) => ({ ...f, cost: e.target.value }))} />
                    </label>
                  </div>
                  <label style={{ display: 'block', marginBottom: 10 }}>
                    <div style={s.formLabel}>Category</div>
                    <select style={s.formInput} value={causeForm.category} onChange={e => setCauseForm((f: any) => ({ ...f, category: e.target.value }))}>
                      <option value="">Select a category...</option>
                      {CAMPAIGN_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </label>
                  {charityIsIpc && (
                    <div style={{ marginBottom: 10, background: C.ivory, borderRadius: 6, padding: '10px 12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.forest, cursor: 'pointer' }}>
                        <input type="checkbox" checked={causeForm.tax_deductible} onChange={e => setCauseForm((f: any) => ({ ...f, tax_deductible: e.target.checked }))} />
                        Donations to this campaign are tax-deductible
                      </label>
                      {!causeForm.tax_deductible && (
                        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>Uncheck this if the campaign benefits a named individual, or if donors receive something in return (e.g. a gala dinner) — IRAS does not treat these as tax-deductible.</div>
                      )}
                      {causeForm.tax_deductible && (
                        <label style={{ display: 'block', marginTop: 8 }}>
                          <div style={{ ...s.formLabel, fontSize: 11 }}>Benefit value given to donor per gift (SGD, if any)</div>
                          <input style={s.formInput} type="number" placeholder="e.g. dinner/gift value — reduces the deductible amount" value={causeForm.benefit_value} onChange={e => setCauseForm((f: any) => ({ ...f, benefit_value: e.target.value }))} />
                        </label>
                      )}
                    </div>
                  )}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block' }}>
                      <div style={s.formLabel}>Fundraising Permit</div>
                      <select style={s.formInput} value={causeForm.permit_status} onChange={e => setCauseForm((f: any) => ({ ...f, permit_status: e.target.value }))}>
                        <option value="not_required">Not required (no physical/street collection)</option>
                        <option value="pending">Permit applied for — pending</option>
                        <option value="obtained">Permit obtained</option>
                      </select>
                    </label>
                    {causeForm.permit_status !== 'not_required' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 8 }}>
                        <label style={{ display: 'block' }}>
                          <div style={{ ...s.formLabel, fontSize: 11 }}>Permit Number</div>
                          <input style={s.formInput} placeholder="e.g. HHSC permit no." value={causeForm.permit_number} onChange={e => setCauseForm((f: any) => ({ ...f, permit_number: e.target.value }))} />
                        </label>
                        <label style={{ display: 'block' }}>
                          <div style={{ ...s.formLabel, fontSize: 11 }}>Permit Expiry</div>
                          <input style={s.formInput} type="date" value={causeForm.permit_expiry} onChange={e => setCauseForm((f: any) => ({ ...f, permit_expiry: e.target.value }))} />
                        </label>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} onClick={async () => { await submitCause(); setShowCampaignModal(false) }} disabled={savingCause}>{savingCause ? 'Saving...' : (causeForm.editingId ? '✓ Save Changes' : '✓ Create Campaign')}</button>
                    <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => { setShowCampaignModal(false); setCauseError(''); setCauseForm(EMPTY_CAUSE_FORM) }}>Cancel</button>
                    {causeForm.editingId && (
                      <button style={{ ...s.viewBtn, color: C.red, borderColor: C.red, marginLeft: 'auto' }} onClick={() => { deleteCause(causeForm.editingId); setShowCampaignModal(false) }}>✕ Delete Campaign</button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── RECURRING ── */}
        {activeTab === 'recurring' && enabledModules.recurring !== false && (
          <RecurringPage
            isMobile={isMobile} recurringGifts={recurringGifts} myCauses={myCauses} fyOf={fyOf} deactivatedOrDncKeys={deactivatedOrDncKeys}
            showRecurringForm={showRecurringForm} setShowRecurringForm={setShowRecurringForm} savingRecurring={savingRecurring}
            editingRecurringGift={editingRecurringGift} setEditingRecurringGift={setEditingRecurringGift}
            saveRecurringGift={saveRecurringGift} updateRecurringGift={updateRecurringGift} cancelRecurringGift={cancelRecurringGift}
            recurringSearchTerm={recurringSearchTerm} setRecurringSearchTerm={setRecurringSearchTerm}
            showRecurringFilters={showRecurringFilters} setShowRecurringFilters={setShowRecurringFilters}
            recurringUrgencyFilter={recurringUrgencyFilter} setRecurringUrgencyFilter={setRecurringUrgencyFilter}
            recurringAmountFilter={recurringAmountFilter} setRecurringAmountFilter={setRecurringAmountFilter}
            recurringTypeFilter={recurringTypeFilter} setRecurringTypeFilter={setRecurringTypeFilter}
            recurringYearFilter={recurringYearFilter} setRecurringYearFilter={setRecurringYearFilter}
            recurringProgrammeFilter={recurringProgrammeFilter} setRecurringProgrammeFilter={setRecurringProgrammeFilter}
            recurringAuthFilter={recurringAuthFilter} setRecurringAuthFilter={setRecurringAuthFilter}
            recurringSortBy={recurringSortBy} setRecurringSortBy={setRecurringSortBy}
            exportRecurringExcel={exportRecurringExcel} recurringGivenTotals={recurringGivenTotals}
            setSelectedDonor={setSelectedDonor} setActiveTab={setActiveTab} findDonorRecord={findDonorRecord}
            recurringSkipHistory={recurringSkipHistory} setConfirmModal={setConfirmModal} undoSkipCycle={undoSkipCycle}
            recurringFailedDeductionHistory={recurringFailedDeductionHistory} undoFailedDeduction={undoFailedDeduction}
            recurringReminderHistory={recurringReminderHistory}
            donationsByRecurringGift={donationsByRecurringGift} expandedRecurringId={expandedRecurringId} setExpandedRecurringId={setExpandedRecurringId}
            editingRecurringDonationId={editingRecurringDonationId} setEditingRecurringDonationId={setEditingRecurringDonationId} editingRecurringAmount={editingRecurringAmount} setEditingRecurringAmount={setEditingRecurringAmount}
            editingRecurringNote={editingRecurringNote} setEditingRecurringNote={setEditingRecurringNote}
            saveRecurringDonationAmount={saveRecurringDonationAmount} savingRecurringAmount={savingRecurringAmount}
            startEditingRecurringAmount={startEditingRecurringAmount} deleteDonation={deleteDonation} markRecurringReceived={markRecurringReceived}
            setRecurringReminderCandidate={setRecurringReminderCandidate} setShowRecurringReminderModal={setShowRecurringReminderModal}
            skipRecurringCycle={skipRecurringCycle}
            recurringMoreMenuId={recurringMoreMenuId} setRecurringMoreMenuId={setRecurringMoreMenuId}
            pauseRecurringGift={pauseRecurringGift} recordFailedDeduction={recordFailedDeduction}
            reactivateRecurringGift={reactivateRecurringGift} restoreCancelledRecurringGift={restoreCancelledRecurringGift}
            showPausedRecurring={showPausedRecurring} setShowPausedRecurring={setShowPausedRecurring}
            showCancelledRecurring={showCancelledRecurring} setShowCancelledRecurring={setShowCancelledRecurring}
          />
        )}

        {/* ── PLEDGES ── */}
        {activeTab === 'pledges' && enabledModules.pledges !== false && (
          <PledgesPage
            isMobile={isMobile} pledges={pledges} myCauses={myCauses} fyOf={fyOf} senderIdentity={senderIdentity} deactivatedOrDncKeys={deactivatedOrDncKeys}
            setShowPledgeForm={setShowPledgeForm} pledgeError={pledgeError} setPledgeError={setPledgeError}
            editingPledge={editingPledge} setEditingPledge={setEditingPledge} updatePledge={updatePledge} cancelPledge={cancelPledge} pledgeInstalments={pledgeInstalments}
            pledgeSearchTerm={pledgeSearchTerm} setPledgeSearchTerm={setPledgeSearchTerm} showPledgeFilters={showPledgeFilters} setShowPledgeFilters={setShowPledgeFilters}
            pledgeUrgencyFilter={pledgeUrgencyFilter} setPledgeUrgencyFilter={setPledgeUrgencyFilter} pledgeDueSoonDays={pledgeDueSoonDays}
            pledgeAmountFilter={pledgeAmountFilter} setPledgeAmountFilter={setPledgeAmountFilter} pledgeYearFilter={pledgeYearFilter} setPledgeYearFilter={setPledgeYearFilter}
            pledgeTypeFilter={pledgeTypeFilter} setPledgeTypeFilter={setPledgeTypeFilter} pledgeProgrammeFilter={pledgeProgrammeFilter} setPledgeProgrammeFilter={setPledgeProgrammeFilter}
            pledgeSortBy={pledgeSortBy} setPledgeSortBy={setPledgeSortBy} exportPledgesExcel={exportPledgesExcel}
            showPledgeReminderModal={showPledgeReminderModal} pledgeReminderCandidate={pledgeReminderCandidate} pledgeReminderPreviewing={pledgeReminderPreviewing} setPledgeReminderPreviewing={setPledgeReminderPreviewing}
            setShowPledgeReminderModal={setShowPledgeReminderModal} setPledgeReminderCandidate={setPledgeReminderCandidate}
            pledgeReminderSubject={pledgeReminderSubject} setPledgeReminderSubject={setPledgeReminderSubject} pledgeReminderBody={pledgeReminderBody} setPledgeReminderBody={setPledgeReminderBody}
            sendingPledgeReminder={sendingPledgeReminder} sendPledgeReminder={sendPledgeReminder}
            showPledgeThankYouModal={showPledgeThankYouModal} pledgeCompletionCandidate={pledgeCompletionCandidate} pledgeThankYouPreviewing={pledgeThankYouPreviewing} setPledgeThankYouPreviewing={setPledgeThankYouPreviewing}
            setShowPledgeThankYouModal={setShowPledgeThankYouModal} setPledgeCompletionCandidate={setPledgeCompletionCandidate}
            pledgeThankYouSubject={pledgeThankYouSubject} setPledgeThankYouSubject={setPledgeThankYouSubject} pledgeThankYouBody={pledgeThankYouBody} setPledgeThankYouBody={setPledgeThankYouBody}
            skipPledgeThankYou={skipPledgeThankYou} sendingPledgeThankYou={sendingPledgeThankYou} sendPledgeThankYou={sendPledgeThankYou}
            logContactModal={logContactModal} setLogContactModal={setLogContactModal} logContactMethod={logContactMethod} setLogContactMethod={setLogContactMethod}
            logContactNote={logContactNote} setLogContactNote={setLogContactNote} loggingContact={loggingContact} logPledgeContact={logPledgeContact}
            showPledgeForm={showPledgeForm} pledgeForm={pledgeForm} setPledgeForm={setPledgeForm} savingPledge={savingPledge} savePledge={savePledge}
            pledgeGivenTotals={pledgeGivenTotals} donationsByPledge={donationsByPledge} pledgeReminderHistory={pledgeReminderHistory} pledgeRescheduleHistory={pledgeRescheduleHistory}
            setSelectedDonor={setSelectedDonor} findDonorRecord={findDonorRecord} setActiveTab={setActiveTab} pendingDonorProfileTabRef={pendingDonorProfileTabRef} setDonorProfileTab={setDonorProfileTab}
            expandedPledgeId={expandedPledgeId} setExpandedPledgeId={setExpandedPledgeId}
            editingPledgeDonationId={editingPledgeDonationId} setEditingPledgeDonationId={setEditingPledgeDonationId} editingPledgeAmount={editingPledgeAmount} setEditingPledgeAmount={setEditingPledgeAmount}
            editingPledgeNotes={editingPledgeNotes} setEditingPledgeNotes={setEditingPledgeNotes} savePledgeDonationAmount={savePledgeDonationAmount} savingPledgeAmount={savingPledgeAmount}
            startEditingPledgeAmount={startEditingPledgeAmount} deleteDonation={deleteDonation} fulfillPledge={fulfillPledge}
            pledgeMoreMenuId={pledgeMoreMenuId} setPledgeMoreMenuId={setPledgeMoreMenuId}
            setRescheduleModal={setRescheduleModal} setRescheduleNewDate={setRescheduleNewDate} setRescheduleReason={setRescheduleReason}
            openThankYouForFulfilledPledge={openThankYouForFulfilledPledge} revertPledgeToPending={revertPledgeToPending}
            showFulfilledPledges={showFulfilledPledges} setShowFulfilledPledges={setShowFulfilledPledges} showCancelledPledges={showCancelledPledges} setShowCancelledPledges={setShowCancelledPledges}
          />
        )}

        {/* Mass appeals no longer have their own tab — appeal history, filtering, and
            sending all live inside the Campaigns tab (see the "Appeals" section there).
            This modal stays un-gated at the App level since it's opened from Campaigns'
            "New Appeal" buttons, which live outside any per-tab conditional. */}
        <MassAppealModal
          showMassAppealModal={showMassAppealModal} setShowMassAppealModal={setShowMassAppealModal}
          massAppealStep={massAppealStep} setMassAppealStep={setMassAppealStep}
          massAppealForm={massAppealForm} setMassAppealForm={setMassAppealForm}
          massAppealRefs={massAppealRefs} setMassAppealRefs={setMassAppealRefs}
          massAppealProgress={massAppealProgress} massAppealCancelRef={massAppealCancelRef}
          myCauses={myCauses} donorList={donorList} donorTagsMap={donorTagsMap}
          showTagSegmentManager={showTagSegmentManager} setShowTagSegmentManager={setShowTagSegmentManager}
          tagSegmentName={tagSegmentName} setTagSegmentName={setTagSegmentName}
          tagSegmentSearch={tagSegmentSearch} setTagSegmentSearch={setTagSegmentSearch}
          tagSegmentSelectedKeys={tagSegmentSelectedKeys} setTagSegmentSelectedKeys={setTagSegmentSelectedKeys}
          savingTagSegment={savingTagSegment} saveTagSegment={saveTagSegment} generateMassAppealRefs={generateMassAppealRefs}
          setShowAppealPreview={setShowAppealPreview} sendingTestAppeal={sendingTestAppeal} sendTestAppealToSelf={sendTestAppealToSelf}
          setConfirmModal={setConfirmModal} sendMassAppealEmails={sendMassAppealEmails} downloadMassAppealQRZip={downloadMassAppealQRZip}
          defaultMassAppealMessage={defaultMassAppealMessage}
        />

        {/* ── GRANTS ── */}
        {activeTab === 'grants' && enabledModules.grants !== false && (
          <GrantsPage
            isMobile={isMobile} grants={grants} grantsWithNextReport={grantsWithNextReport} myCauses={myCauses} fyOf={fyOf}
            showGrantForm={showGrantForm} setShowGrantForm={setShowGrantForm} editingGrant={editingGrant} setEditingGrant={setEditingGrant}
            saveGrant={saveGrant} updateGrant={updateGrant} deleteGrant={deleteGrant} grantMatchClaims={grantMatchClaims}
            grantSearchTerm={grantSearchTerm} setGrantSearchTerm={setGrantSearchTerm} showGrantFilters={showGrantFilters} setShowGrantFilters={setShowGrantFilters}
            grantUrgencyFilter={grantUrgencyFilter} setGrantUrgencyFilter={setGrantUrgencyFilter} grantAmountFilter={grantAmountFilter} setGrantAmountFilter={setGrantAmountFilter}
            grantYearFilter={grantYearFilter} setGrantYearFilter={setGrantYearFilter} grantFunderTypeFilter={grantFunderTypeFilter} setGrantFunderTypeFilter={setGrantFunderTypeFilter}
            grantFundingTypeFilter={grantFundingTypeFilter} setGrantFundingTypeFilter={setGrantFundingTypeFilter} grantSortBy={grantSortBy} setGrantSortBy={setGrantSortBy}
            exportGrantsExcel={exportGrantsExcel} highlightedGrantId={highlightedGrantId} grantExpensesByGrant={grantExpensesByGrant} expandedGrantId={expandedGrantId} setExpandedGrantId={setExpandedGrantId}
            grantReports={grantReports} grantTranches={grantTranches} grantNotes={grantNotes} grantExpenseCategories={grantExpenseCategories}
            saveGrantExpense={saveGrantExpense} editGrantExpense={editGrantExpense} deleteGrantExpense={deleteGrantExpense} setConfirmModal={setConfirmModal}
            saveGrantTranche={saveGrantTranche} toggleGrantTrancheReceived={toggleGrantTrancheReceived} editGrantTranche={editGrantTranche} deleteGrantTranche={deleteGrantTranche}
            saveGrantReport={saveGrantReport} toggleGrantReportSubmitted={toggleGrantReportSubmitted} editGrantReport={editGrantReport} deleteGrantReport={deleteGrantReport}
            saveGrantMatchClaim={saveGrantMatchClaim} editGrantMatchClaim={editGrantMatchClaim} deleteGrantMatchClaim={deleteGrantMatchClaim} saveGrantNote={saveGrantNote}
            exportGrantReportPDF={exportGrantReportPDF} changeGrantStatus={changeGrantStatus} showPastGrants={showPastGrants} setShowPastGrants={setShowPastGrants}
          />
        )}

        {/* ── IN-KIND GIFTS ── */}
        {activeTab === 'inkind' && enabledModules.inKind !== false && (
          <InKindDonationsPage
            isMobile={isMobile} isTablet={isTablet} userRole={userRole} inKindDonations={inKindDonations} myCauses={myCauses}
            showInKindForm={showInKindForm} setShowInKindForm={setShowInKindForm} editingInKindId={editingInKindId}
            inKindForm={inKindForm} setInKindForm={setInKindForm} inKindError={inKindError} savingInKind={savingInKind}
            saveInKindDonation={saveInKindDonation} closeInKindForm={closeInKindForm} startEditingInKind={startEditingInKind}
            deleteInKindDonation={deleteInKindDonation} toggleInKindThankYou={toggleInKindThankYou} exportInKindExcel={exportInKindExcel}
            updateInKindNotes={updateInKindNotes} issueInKindReceipt={issueInKindReceipt} exportInKindReceiptPDF={exportInKindReceiptPDF}
            issuingInKindReceiptId={issuingInKindReceiptId} issueAllInKindReceipts={issueAllInKindReceipts}
            bulkInKindActionInProgress={bulkInKindActionInProgress} bulkInKindProgress={bulkInKindProgress} bulkInKindCancelRef={bulkInKindCancelRef}
            voidAndReissueInKindReceipt={voidAndReissueInKindReceipt} voidingInKindReceipt={voidingInKindReceipt}
            updateInKindImpactNote={updateInKindImpactNote} uploadInKindPhoto={uploadInKindPhoto} removeInKindPhoto={removeInKindPhoto}
            uploadingInKindPhotoId={uploadingInKindPhotoId}
          />
        )}

        {/* ── REPORTS ── */}
        {activeTab === 'reports' && (
          <ReportsPage
            donations={donations} charityName={charityName} charityIsIpc={charityIsIpc} grants={grants}
            auditLog={auditLog} filterYear={filterYear} setFilterYear={setFilterYear} fyOf={fyOf} showToast={showToast}
            exportAnalyticsPDF={exportAnalyticsPDF} exportQuarterlyBoardReportPDF={exportQuarterlyBoardReportPDF}
            exportWeeklySnapshotPDF={exportWeeklySnapshotPDF} exportYearEndSummary={exportYearEndSummary}
            exportAllDonorYearEndStatements={exportAllDonorYearEndStatements} exportDonorContactsCSV={exportDonorContactsCSV}
            exportIRASExcel={exportIRASExcel} exportGrantsComplianceReport={exportGrantsComplianceReport}
            exportPermitRegister={exportPermitRegister} exportRestrictedFundStatement={exportRestrictedFundStatement}
            logExport={logExport}
          />
        )}

        {/* ── SETTINGS ── */}
        {activeTab === 'settings' && (
          <SettingsPage
            isMobile={isMobile} userRole={userRole} session={session} setConfirmModal={setConfirmModal} intentionalSignOutRef={intentionalSignOutRef}
            charityName={charityName} charityUen={charityUen} charityIsIpc={charityIsIpc}
            charityLogoUrl={charityLogoUrl} uploadingLogo={uploadingLogo} uploadCharityLogo={uploadCharityLogo} removeCharityLogo={removeCharityLogo}
            senderDomainStatus={senderDomainStatus} senderEmailLocalPart={senderEmailLocalPart} senderDomain={senderDomain} setSenderDomainInput={setSenderDomainInput} setShowDomainSetup={setShowDomainSetup}
            checkingVerification={checkingVerification} checkDomainVerification={checkDomainVerification}
            settingsSection={settingsSection} setSettingsSection={setSettingsSection}
            localEds={localEds} localStaff={localStaff} localBoardMembers={localBoardMembers} localVolunteers={localVolunteers}
            setVolunteerInput={setVolunteerInput} setNewTeamMemberRole={setNewTeamMemberRole} setShowAddTeamMemberModal={setShowAddTeamMemberModal} removeTeamMember={removeTeamMember}
            myCauses={myCauses} pledges={pledges} recurringGifts={recurringGifts} grants={grants} massAppeals={massAppeals} inKindDonations={inKindDonations} enabledModules={enabledModules} toggleEnabledModule={toggleEnabledModule}
            editingDonorThresholds={editingDonorThresholds} setThankYouThresholdInput={setThankYouThresholdInput} setMajorDonorThresholdInput={setMajorDonorThresholdInput} setEditingDonorThresholds={setEditingDonorThresholds}
            thankYouThreshold={thankYouThreshold} majorDonorThreshold={majorDonorThreshold} thankYouThresholdInput={thankYouThresholdInput} majorDonorThresholdInput={majorDonorThresholdInput} saveDonorThresholds={saveDonorThresholds}
            editingCumulativeThresholds={editingCumulativeThresholds} cumulativeThresholdsInput={cumulativeThresholdsInput} setCumulativeThresholdsInput={setCumulativeThresholdsInput} setEditingCumulativeThresholds={setEditingCumulativeThresholds}
            cumulativeThresholds={cumulativeThresholds} saveCumulativeThresholds={saveCumulativeThresholds} showToast={showToast}
            lapsedMinGifts={lapsedMinGifts} lapsedMinDays={lapsedMinDays}
            givingChangeMinGifts={givingChangeMinGifts} givingChangeMinPct={givingChangeMinPct}
            recurringTrendCycles={recurringTrendCycles} recurringMissedThreshold={recurringMissedThreshold}
            pledgeWatchThreshold={pledgeWatchThreshold} pledgeDueSoonDays={pledgeDueSoonDays}
            concentrationTopN={concentrationTopN}
            editingAlertSensitivity={editingAlertSensitivity} setEditingAlertSensitivity={setEditingAlertSensitivity}
            alertSensitivityInputs={alertSensitivityInputs} setAlertSensitivityInputs={setAlertSensitivityInputs}
            saveAlertSensitivity={saveAlertSensitivity}
            editingFyEnd={editingFyEnd} setFyEndMonthInput={setFyEndMonthInput} setFyEndDayInput={setFyEndDayInput} setEditingFyEnd={setEditingFyEnd} fyEndMonth={fyEndMonth} fyEndDay={fyEndDay} fyEndMonthInput={fyEndMonthInput} fyEndDayInput={fyEndDayInput} saveFyEnd={saveFyEnd}
            editingGoal={editingGoal} setEditingGoal={setEditingGoal} setGoalInput={setGoalInput} annualGoal={annualGoal} goalInput={goalInput} saveAnnualGoal={saveAnnualGoal}
            recurringExpenses={recurringExpenses} deleteRecurringExpense={deleteRecurringExpense} newExpenseForm={newExpenseForm} setNewExpenseForm={setNewExpenseForm} saveRecurringExpense={saveRecurringExpense}
            setShowMigrationTool={setShowMigrationTool} setMigrationPreview={setMigrationPreview} setMigrationErrors={setMigrationErrors} setMigrationComplete={setMigrationComplete} setMigrationProgress={setMigrationProgress}
            EMAIL_TEMPLATE_DEFS={EMAIL_TEMPLATE_DEFS} emailTemplates={emailTemplates} editingEmailTemplate={editingEmailTemplate} setEditingEmailTemplate={setEditingEmailTemplate}
            setEmailTemplateSubjectInput={setEmailTemplateSubjectInput} setEmailTemplateBodyInput={setEmailTemplateBodyInput} EMAIL_TEMPLATE_DEFAULTS={EMAIL_TEMPLATE_DEFAULTS}
            emailTemplateSubjectInput={emailTemplateSubjectInput} emailTemplateBodyInput={emailTemplateBodyInput} EMAIL_TEMPLATE_PREVIEW_VARS={EMAIL_TEMPLATE_PREVIEW_VARS} saveEmailTemplate={saveEmailTemplate}
            emailTemplateBannerTitleInput={emailTemplateBannerTitleInput} setEmailTemplateBannerTitleInput={setEmailTemplateBannerTitleInput}
            emailTemplateBannerSubtitleInput={emailTemplateBannerSubtitleInput} setEmailTemplateBannerSubtitleInput={setEmailTemplateBannerSubtitleInput}
          />
        )}

      </div>

      

      {showMigrationTool && (
        <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => { if (!migrationProgress) setShowMigrationTool(false) }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 620, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.forest }}>Migration Tool</div>
              {!migrationProgress && <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => setShowMigrationTool(false)}>✕</button>}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>
              Upload a CSV exported from Google Sheets or Excel. Required columns: <strong>Donor Name</strong>, <strong>Amount</strong>, <strong>Date</strong>. Optional: Email, NRIC, Payment Method, Notes, Receipt Number.
            </div>

            {migrationComplete ? (
              <div>
                <div style={{ background: C.successBg, border: `1.5px solid ${C.sage}`, borderRadius: 12, padding: 20, marginBottom: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.forest, marginBottom: 4 }}>Migration Complete</div>
                  <div style={{ fontSize: 13, color: C.sage }}>{migrationComplete.imported} records imported successfully</div>
                  {migrationComplete.skipped > 0 && <div style={{ fontSize: 12, color: C.warning, marginTop: 4 }}>{migrationComplete.skipped} records skipped due to errors</div>}
                </div>
                <button style={{ ...s.btnForest, width: '100%', justifyContent: 'center' }} onClick={() => setShowMigrationTool(false)}>Done</button>
              </div>
            ) : migrationProgress ? (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.forest, marginBottom: 12 }}>Importing records...</div>
                <div style={{ background: C.ivoryDark, borderRadius: 6, height: 10, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ width: `${(migrationProgress.done / migrationProgress.total) * 100}%`, height: '100%', background: C.sage, borderRadius: 6, transition: 'width 0.2s' }} />
                </div>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>{migrationProgress.done} of {migrationProgress.total} · {migrationProgress.imported} imported · {migrationProgress.skipped} skipped</div>
                <button style={{ ...s.viewBtn, color: C.red, borderColor: C.red }} onClick={() => { migrationCancelRef.current = true }}>✕ Cancel</button>
              </div>
            ) : (
              <div>
                {!migrationPreview ? (
                  <div>
                    <div
                      style={{ border: `2px dashed ${C.border}`, borderRadius: 12, padding: 32, textAlign: 'center', cursor: 'pointer', background: C.white, marginBottom: 16 }}
                      onClick={() => document.getElementById('migration-file-input').click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) previewMigrationFile(f) }}
                    >
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: C.forest, marginBottom: 4 }}>Drop your CSV here or click to browse</div>
                      <div style={{ fontSize: 12, color: C.muted }}>Exported from Google Sheets or Excel · .csv files only</div>
                      <input id="migration-file-input" type="file" accept=".csv" aria-label="Upload CSV file" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) previewMigrationFile(e.target.files[0]) }} />
                    </div>
                    {migrationErrors.length > 0 && (
                      <div style={{ background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                        {migrationErrors.map((e, i) => <div key={i} style={{ fontSize: 12, color: C.warning, marginBottom: 4 }}>⚠️ {e}</div>)}
                      </div>
                    )}
                    <div style={{ background: C.ivory, borderRadius: 10, padding: 14, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Expected CSV format</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.muted, lineHeight: 1.8 }}>
                        Donor Name, Amount, Date, Email, NRIC, Payment Method, Notes, Receipt Number<br />
                        John Tan, 100, 2024-03-15, john@email.com, S1234567A, Cash, Annual gala, MR-2024-000001<br />
                        Mary Lim, 250, 2024-04-01, mary@email.com, , PayNow, , MR-2024-000002
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ background: C.successBg, border: `1px solid ${C.sage}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.forest, marginBottom: 8 }}>✓ File parsed successfully</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                        <div style={{ fontSize: 12, color: C.forest }}>Total rows: <strong>{migrationPreview.totalRows}</strong></div>
                        <div style={{ fontSize: 12, color: C.forest }}>Ready to import: <strong>{migrationPreview.validRows.length}</strong></div>
                        {migrationPreview.skippedRows > 0 && <div style={{ fontSize: 12, color: C.warning }}>Will skip: <strong>{migrationPreview.skippedRows}</strong></div>}
                      </div>
                    </div>

                    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Detected columns</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
                        {Object.entries(migrationPreview.detectedColumns).map(([key, val]: [string, any]) => (
                          <div key={key} style={{ fontSize: 11, color: val ? C.sage : C.muted }}>
                            {val ? '✓' : '—'} {key}: <span style={{ fontFamily: 'monospace' }}>{val || 'not found'}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {migrationPreview.rowErrors.length > 0 && (
                      <div style={{ background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.warning, marginBottom: 6 }}>⚠️ {migrationPreview.totalErrors} row{migrationPreview.totalErrors !== 1 ? 's' : ''} will be skipped</div>
                        {migrationPreview.rowErrors.map((e: any, i: any) => <div key={i} style={{ fontSize: 11, color: C.warning, marginBottom: 2 }}>{e}</div>)}
                        {migrationPreview.totalErrors > 10 && <div style={{ fontSize: 11, color: C.warning, marginTop: 4 }}>...and {migrationPreview.totalErrors - 10} more</div>}
                      </div>
                    )}

                    <div style={{ background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: C.warning }}>
                      ⚠️ This will add {migrationPreview.validRows.length} donation records to your account. This cannot be bulk-undone. Make sure you haven't already imported this file.
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => { setMigrationPreview(null); setMigrationFile(null); setMigrationErrors([]) }}>← Choose different file</button>
                      <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} onClick={runMigration}>📥 Import {migrationPreview.validRows.length} Records</button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {showLapsedDismissModal && (
        <div data-modal-overlay="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => { setShowLapsedDismissModal(null); setLapsedDismissReason('') }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>Mark {showLapsedDismissModal.name} as not interested?</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => { setShowLapsedDismissModal(null); setLapsedDismissReason('') }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              They'll be hidden from this list indefinitely. If they donate again on their own, they'll naturally reappear as an active donor — you can also restore them manually at any time.
            </div>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <div style={s.formLabel}>Reason</div>
              <select style={s.formInput} value={lapsedDismissCategory} onChange={e => setLapsedDismissCategory(e.target.value)}>
                <option value="unknown">Unknown</option>
                <option value="financial_difficulty">Financial difficulty</option>
                <option value="moved_overseas">Moved overseas</option>
                <option value="switched_cause">Switched to another cause</option>
                <option value="deceased">Deceased</option>
                <option value="asked_to_stop">Asked to stop</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={s.formLabel}>Additional detail (optional)</div>
              <input style={s.formInput} placeholder="e.g. Said no in person, requested no further contact" value={lapsedDismissReason} onChange={e => setLapsedDismissReason(e.target.value)} />
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={dismissingLapsed} onClick={confirmDismissLapsedDonor}>
                {dismissingLapsed ? 'Saving...' : '✓ Confirm'}
              </button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => { setShowLapsedDismissModal(null); setLapsedDismissReason('') }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showLapsedReminderModal && lapsedReminderCandidate && !lapsedReminderPreviewing && (
        <div data-modal-overlay="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => { setShowLapsedReminderModal(false); setLapsedReminderCandidate(null) }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>{lapsedReminderCandidate.givingChangeMeta ? 'Check in about decreased giving' : 'Reach out to a lapsed donor'}</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => { setShowLapsedReminderModal(false); setLapsedReminderCandidate(null) }}>✕</button>
            </div>
            {lapsedReminderCandidate.givingChangeMeta && (
              <div style={{ background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: 6, padding: '10px 12px', marginBottom: 14, fontSize: 12.5, color: C.warning, lineHeight: 1.5 }}>
                💛 This could be financial hardship, a change in circumstances, or simply a busy season — not necessarily a loss of interest. Suggested framing: a genuine check-in on how they're doing, not a question about why they gave less.
              </div>
            )}
            <SenderIdentityLine recipientName={lapsedReminderCandidate.name} recipientEmail={lapsedReminderCandidate.email} {...senderIdentity} />
            <label style={{ display: 'block', marginBottom: 12 }}>
              <div style={s.formLabel}>Subject</div>
              <input style={s.formInput} value={lapsedReminderSubject} onChange={e => setLapsedReminderSubject(e.target.value)} />
            </label>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={s.formLabel}>Message</div>
              <textarea style={{ ...s.formInput, minHeight: 260, resize: 'vertical', fontFamily: 'inherit' }} value={lapsedReminderBody} onChange={e => setLapsedReminderBody(e.target.value)} />
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={!lapsedReminderCandidate.email} onClick={() => setLapsedReminderPreviewing(true)}>
                Preview email →
              </button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => { setShowLapsedReminderModal(false); setLapsedReminderCandidate(null) }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showLapsedReminderModal && lapsedReminderCandidate && lapsedReminderPreviewing && (
        <div data-modal-overlay="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => { setShowLapsedReminderModal(false); setLapsedReminderCandidate(null); setLapsedReminderPreviewing(false) }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>Preview email</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => { setShowLapsedReminderModal(false); setLapsedReminderCandidate(null); setLapsedReminderPreviewing(false) }}>✕</button>
            </div>
            <SenderIdentityLine recipientName={lapsedReminderCandidate.name} recipientEmail={lapsedReminderCandidate.email} {...senderIdentity} />
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: 16, background: C.ivory, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.forest, marginBottom: 10 }}>{lapsedReminderSubject}</div>
              <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{lapsedReminderBody}</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={sendingLapsedReminder} onClick={sendLapsedReminder}>
                {sendingLapsedReminder ? 'Sending...' : '✓ Send message'}
              </button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => setLapsedReminderPreviewing(false)}>
                ← Back to edit
              </button>
            </div>
          </div>
        </div>
      )}

      {showRecurringReminderModal && recurringReminderCandidate && !recurringReminderPreviewing && (
        <div data-modal-overlay="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => { setShowRecurringReminderModal(false); setRecurringReminderCandidate(null) }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>Send reminder</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => { setShowRecurringReminderModal(false); setRecurringReminderCandidate(null) }}>✕</button>
            </div>
            <SenderIdentityLine recipientName={recurringReminderCandidate.donor_name} recipientEmail={recurringReminderCandidate.donor_email} {...senderIdentity} />
            <label style={{ display: 'block', marginBottom: 12 }}>
              <div style={s.formLabel}>Subject</div>
              <input style={s.formInput} value={recurringReminderSubject} onChange={e => setRecurringReminderSubject(e.target.value)} />
            </label>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={s.formLabel}>Message</div>
              <textarea style={{ ...s.formInput, minHeight: 260, resize: 'vertical', fontFamily: 'inherit' }} value={recurringReminderBody} onChange={e => setRecurringReminderBody(e.target.value)} />
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={!recurringReminderCandidate.donor_email} onClick={() => setRecurringReminderPreviewing(true)}>
                Preview email →
              </button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => { setShowRecurringReminderModal(false); setRecurringReminderCandidate(null) }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showRecurringReminderModal && recurringReminderCandidate && recurringReminderPreviewing && (
        <div data-modal-overlay="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => { setShowRecurringReminderModal(false); setRecurringReminderCandidate(null); setRecurringReminderPreviewing(false) }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>Preview email</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => { setShowRecurringReminderModal(false); setRecurringReminderCandidate(null); setRecurringReminderPreviewing(false) }}>✕</button>
            </div>
            <SenderIdentityLine recipientName={recurringReminderCandidate.donor_name} recipientEmail={recurringReminderCandidate.donor_email} {...senderIdentity} />
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: 16, background: C.ivory, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.forest, marginBottom: 10 }}>{recurringReminderSubject}</div>
              <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{recurringReminderBody}</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={sendingRecurringReminder} onClick={sendRecurringReminder}>
                {sendingRecurringReminder ? 'Sending...' : '✓ Send reminder'}
              </button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => setRecurringReminderPreviewing(false)}>
                ← Back to edit
              </button>
            </div>
          </div>
        </div>
      )}

      {skipCycleModal && (
        <div data-modal-overlay="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => { setSkipCycleModal(null); setSkipCycleReason('') }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>Skip this cycle?</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => { setSkipCycleModal(null); setSkipCycleReason('') }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              {skipCycleModal.donor_name}'s payment for this cycle will be marked as skipped — no donation record will be created, and the schedule moves to the next expected date.
            </div>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={s.formLabel}>Reason (optional)</div>
              <input style={s.formInput} placeholder="e.g. Auto-payment failed, donor requested pause" value={skipCycleReason} onChange={e => setSkipCycleReason(e.target.value)} />
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={skippingCycle} onClick={confirmSkipCycle}>
                {skippingCycle ? 'Skipping...' : '⏭ Skip Cycle'}
              </button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => { setSkipCycleModal(null); setSkipCycleReason('') }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {pauseGiftModal && (
        <div data-modal-overlay="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => { setPauseGiftModal(null); setPauseReasonInput(''); setPauseResumeDateInput('') }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>Pause this recurring gift?</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => { setPauseGiftModal(null); setPauseReasonInput(''); setPauseResumeDateInput('') }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              {pauseGiftModal.donor_name}'s {pauseGiftModal.frequency} gift of ${Number(pauseGiftModal.amount).toLocaleString()} will be paused. You can reactivate it at any time.
            </div>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <div style={s.formLabel}>Reason (optional)</div>
              <input style={s.formInput} placeholder="e.g. Donor going through financial hardship" value={pauseReasonInput} onChange={e => setPauseReasonInput(e.target.value)} />
            </label>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={s.formLabel}>Expected resume date (optional)</div>
              <input style={s.formInput} type="date" value={pauseResumeDateInput} onChange={e => setPauseResumeDateInput(e.target.value)} />
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={pausingGift} onClick={confirmPauseRecurringGift}>
                {pausingGift ? 'Pausing...' : '⏸ Pause'}
              </button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => { setPauseGiftModal(null); setPauseReasonInput(''); setPauseResumeDateInput('') }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {failedDeductionModal && (
        <div data-modal-overlay="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => setFailedDeductionModal(null)}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>Log a failed deduction</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => setFailedDeductionModal(null)}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              {failedDeductionModal.donor_name}'s bank rejected this cycle's deduction. This is logged separately from a skip so you can tell "the bank said no" apart from "we haven't confirmed receipt yet." The schedule is not advanced — you'll still see this cycle as due until it's received or skipped.
            </div>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={s.formLabel}>Reason</div>
              <select style={s.formInput} value={failedDeductionReason} onChange={e => setFailedDeductionReason(e.target.value)}>
                <option value="Insufficient funds">Insufficient funds</option>
                <option value="Account closed">Account closed</option>
                <option value="Mandate cancelled by bank">Mandate cancelled by bank</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={recordingFailedDeduction} onClick={confirmRecordFailedDeduction}>
                {recordingFailedDeduction ? 'Logging...' : '⚠ Log Failed Deduction'}
              </button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => setFailedDeductionModal(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {markReceivedModal && (
        <div data-modal-overlay="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => { setMarkReceivedModal(null); setMarkReceivedAmount(''); setMarkReceivedNote('') }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>Mark payment as received</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => { setMarkReceivedModal(null); setMarkReceivedAmount(''); setMarkReceivedNote('') }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              From {markReceivedModal.donor_name} — confirm the amount received. This will create a donation record and send a thank-you email if they have one on file.
            </div>
            <label style={{ display: 'block', marginBottom: 14 }}>
              <div style={s.formLabel}>Amount received (SGD)</div>
              <input style={s.formInput} type="number" value={markReceivedAmount} onChange={e => setMarkReceivedAmount(e.target.value)} />
            </label>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={s.formLabel}>Note (optional)</div>
              <input style={s.formInput} placeholder={`Recurring ${markReceivedModal.frequency} gift`} value={markReceivedNote} onChange={e => setMarkReceivedNote(e.target.value)} />
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={markingReceived} onClick={confirmMarkReceived}>
                {markingReceived ? 'Recording...' : '✓ Confirm Received'}
              </button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => { setMarkReceivedModal(null); setMarkReceivedAmount(''); setMarkReceivedNote('') }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDomainSetup && (
        <div data-modal-overlay="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => { setShowDomainSetup(false); setDnsRecords(null); setSenderDomainInput('') }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>Set up your own sending domain</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => { setShowDomainSetup(false); setDnsRecords(null); setSenderDomainInput('') }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              Enter your organization's website domain (e.g. <code>yourcharity.org.sg</code>). This is a technical step — you may want to loop in whoever manages your website or IT.
            </div>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <div style={s.formLabel}>Your domain</div>
              <input style={s.formInput} placeholder="yourcharity.org.sg" value={senderDomainInput} onChange={e => setSenderDomainInput(e.target.value)} />
            </label>

            {!dnsRecords ? (
              <button style={{ ...s.btnForest, width: '100%', justifyContent: 'center' }} disabled={!senderDomainInput.trim() || savingDomain} onClick={registerSenderDomain}>
                {savingDomain ? 'Setting up...' : 'Continue'}
              </button>
            ) : (
              <div>
                <div style={{ fontSize: 13, color: C.forest, fontWeight: 500, marginBottom: 8 }}>Add these DNS records</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Add these to your domain's DNS settings (ask your web host or IT provider if unsure). Verification can take anywhere from a few minutes to a day.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {dnsRecords.map((rec: any, i: any) => (
                    <div key={i} style={{ background: C.ivory, borderRadius: 6, padding: 10, border: `1px solid ${C.border}`, fontFamily: 'monospace', fontSize: 11.5 }}>
                      <div><strong>Type:</strong> {rec.type}</div>
                      <div><strong>Name:</strong> {rec.name}</div>
                      <div style={{ wordBreak: 'break-all' }}><strong>Value:</strong> {rec.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button style={{ ...s.viewBtn, width: '100%', justifyContent: 'center', marginTop: 10 }} onClick={() => { setShowDomainSetup(false); setDnsRecords(null); setSenderDomainInput('') }}>
              Close
            </button>
          </div>
        </div>
      )}

      {rescheduleModal && (
        <div data-modal-overlay="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => { setRescheduleModal(null); setRescheduleNewDate(''); setRescheduleReason('') }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>Reschedule pledge</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => { setRescheduleModal(null); setRescheduleNewDate(''); setRescheduleReason('') }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              {rescheduleModal.donor_name}'s pledge is currently expected by {new Date(rescheduleModal.expected_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}. This updates the expected date and stops it from showing as overdue until then.
            </div>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <div style={s.formLabel}>New expected date</div>
              <input style={s.formInput} type="date" value={rescheduleNewDate} onChange={e => setRescheduleNewDate(e.target.value)} />
            </label>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={s.formLabel}>Reason (optional)</div>
              <input style={s.formInput} placeholder="e.g. Donor requested more time, follow up in August" value={rescheduleReason} onChange={e => setRescheduleReason(e.target.value)} />
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={!rescheduleNewDate || reschedulingPledge} onClick={confirmReschedule}>
                {reschedulingPledge ? 'Saving...' : '✓ Reschedule'}
              </button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => { setRescheduleModal(null); setRescheduleNewDate(''); setRescheduleReason('') }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {pledgeResolutionModal && (
        <div data-modal-overlay="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => { setPledgeResolutionModal(null); setPledgeResolutionNotes('') }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 440, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>
                {pledgeResolutionModal.type === 'fulfilled' ? 'Mark this pledge as fulfilled?' : 'Cancel this pledge?'}
              </div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => { setPledgeResolutionModal(null); setPledgeResolutionNotes('') }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              {pledgeResolutionModal.type === 'fulfilled'
                ? `This will record a real donation and link it to ${pledgeResolutionModal.pledge.donor_name}'s pledge.`
                : `The pledge of $${Number(pledgeResolutionModal.pledge.amount).toLocaleString()} from ${pledgeResolutionModal.pledge.donor_name} will be marked as cancelled. The record is kept for reference.`}
            </div>
            {pledgeResolutionModal.type === 'fulfilled' && (
              <>
                <label style={{ display: 'block', marginBottom: 16 }}>
                  <div style={s.formLabel}>Amount Received (SGD)</div>
                  <input style={s.formInput} type="number" value={fulfillAmount} onChange={e => setFulfillAmount(e.target.value)} />
                </label>
                <label style={{ display: 'block', marginBottom: 16 }}>
                  <div style={s.formLabel}>Payment Method</div>
                  <select style={s.formInput} value={fulfillPaymentMethod} onChange={e => setFulfillPaymentMethod(e.target.value)}>
                    <option>Cash</option><option>Bank Wire</option><option>Cheque</option><option>PayNow Direct</option><option>Other</option>
                  </select>
                </label>
              </>
            )}
            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={s.formLabel}>Notes (optional)</div>
              <textarea
                style={{ ...s.formInput, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }}
                placeholder={pledgeResolutionModal.type === 'fulfilled' ? 'e.g. Received via bank transfer, confirmed by phone' : 'e.g. Donor withdrew pledge, entered in error'}
                value={pledgeResolutionNotes}
                onChange={e => setPledgeResolutionNotes(e.target.value)}
              />
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} onClick={confirmPledgeResolution}>
                {pledgeResolutionModal.type === 'fulfilled' ? '✓ Mark Fulfilled' : '✕ Cancel Pledge'}
              </button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => { setPledgeResolutionModal(null); setPledgeResolutionNotes('') }}>
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedAppealDetail && !retryPreviewList && (
        <div data-modal-overlay="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => setSelectedAppealDetail(null)}>
          <div style={{ background: C.white, borderRadius: 8, padding: 0, maxWidth: 600, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.forest }}>{selectedAppealDetail.cause_name || 'General Appeal'}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                    {new Date(selectedAppealDetail.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })} · SGD ${Number(selectedAppealDetail.amount).toLocaleString()} default
                  </div>
                </div>
                <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => setSelectedAppealDetail(null)}>✕</button>
              </div>
              {selectedAppealDetail.message && (
                <div style={{ marginTop: 12, padding: 12, background: C.ivory, borderRadius: 6, fontSize: 12.5, color: C.text, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {selectedAppealDetail.message}
                </div>
              )}
              {(() => {
                const sentN = appealRecipients.filter(r => r.status === 'sent').length
                const failedN = appealRecipients.filter(r => r.status === 'failed').length
                const blockedN = appealRecipients.filter(r => r.status === 'blocked').length
                return (
                  <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 12 }}>
                    <span style={{ color: C.sage, fontWeight: 500 }}>{sentN} sent</span>
                    {failedN > 0 && <span style={{ color: C.red, fontWeight: 500 }}>{failedN} failed</span>}
                    {blockedN > 0 && <span style={{ color: C.gold, fontWeight: 500 }}>{blockedN} blocked</span>}
                    <span style={{ color: C.muted }}>{appealRecipients.length} total</span>
                  </div>
                )
              })()}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }}
                  onClick={() => {
                    setMassAppealForm({
                      cause_id: selectedAppealDetail.cause_id || '',
                      customLabel: !selectedAppealDetail.cause_id ? (selectedAppealDetail.cause_name || '') : '',
                      targetTag: selectedAppealDetail.target_tag || 'All',
                      amount: String(selectedAppealDetail.amount || ''),
                      message: selectedAppealDetail.message || '',
                    })
                    setMassAppealStep('setup')
                    setMassAppealRefs([])
                    setSelectedAppealDetail(null)
                    setShowMassAppealModal(true)
                  }}
                >📋 Clone this Appeal</button>
                {appealRecipients.filter(r => r.status === 'failed').length > 0 && (
                  <button
                    style={{ ...s.viewBtn, flex: 1, justifyContent: 'center', color: C.red, borderColor: C.red }}
                    onClick={() => setRetryPreviewList(appealRecipients.filter(r => r.status === 'failed'))}
                  >
                    🔁 Retry {appealRecipients.filter(r => r.status === 'failed').length} Failed
                  </button>
                )}
              </div>
            </div>
            <div style={{ padding: '16px 24px 8px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input style={{ ...s.searchBox, flex: 1, minWidth: 160 }} placeholder="🔍 Search recipients..." value={appealRecipientSearchTerm} onChange={e => setAppealRecipientSearchTerm(e.target.value)} />
              <select style={{ ...s.formInput, width: 140 }} value={appealRecipientStatusFilter} onChange={e => setAppealRecipientStatusFilter(e.target.value)}>
                <option value="All">All statuses</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
            <div style={{ padding: '8px 24px 16px', overflowY: 'auto', flex: 1 }}>
              {loadingAppealDetail ? (
                <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>Loading recipients...</div>
              ) : appealRecipients.length === 0 ? (
                <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No recipient details available for this appeal.</div>
              ) : (() => {
                const q = appealRecipientSearchTerm.toLowerCase().trim()
                const filteredRecipients = appealRecipients.filter(r => {
                  const matchesSearch = !q || [r.donor_name, r.donor_email].some(f => f?.toLowerCase().includes(q))
                  const matchesStatus = appealRecipientStatusFilter === 'All' || r.status === appealRecipientStatusFilter
                  return matchesSearch && matchesStatus
                })
                if (filteredRecipients.length === 0) {
                  return <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No recipients match your search or filter.</div>
                }
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {filteredRecipients.map((r, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: C.ivory, borderRadius: 4, cursor: 'pointer' }} onClick={() => { setSelectedDonor(findDonorRecord(r.donor_email, r.donor_name)); setActiveTab('donors') }}>
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 500, color: C.forest }}>{r.donor_name}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{r.donor_email}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            fontSize: 10.5, fontWeight: 500, padding: '3px 8px', borderRadius: 20,
                            color: r.status === 'sent' ? C.sage : r.status === 'blocked' ? C.gold : C.red,
                            background: r.status === 'sent' ? C.successBg : r.status === 'blocked' ? (C.gold + '1A') : C.dangerBg,
                          }}>
                            {r.status === 'sent' ? '✓ Sent' : r.status === 'blocked' ? '🚫 Blocked' : '✕ Failed'}
                          </span>
                          {r.status === 'failed' && (
                            <span style={{ fontSize: 11, color: C.red, textDecoration: 'underline', cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setRetryPreviewList([r]) }}>↺ Retry</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {retryPreviewList && (
        <div data-modal-overlay="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => !retryingAppealRecipients && setRetryPreviewList(null)}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 480, width: '100%', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.forest, marginBottom: 4 }}>Retry {retryPreviewList.length} recipient{retryPreviewList.length !== 1 ? 's' : ''}</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>The same message and QR code will be resent to:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, maxHeight: 200, overflowY: 'auto' }}>
              {retryPreviewList.map((r: any, i: any) => (
                <div key={i} style={{ padding: '8px 10px', background: C.ivory, borderRadius: 4 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: C.forest }}>{r.donor_name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{r.donor_email}</div>
                </div>
              ))}
            </div>
            {selectedAppealDetail?.message && (
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: 16, background: C.ivory, marginBottom: 16 }}>
                <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selectedAppealDetail.message}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={retryingAppealRecipients} onClick={() => retryAppealRecipients(selectedAppealDetail, retryPreviewList)}>
                {retryingAppealRecipients ? 'Sending...' : '✓ Confirm Retry'}
              </button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} disabled={retryingAppealRecipients} onClick={() => setRetryPreviewList(null)}>
                ← Back
              </button>
            </div>
          </div>
        </div>
      )}

      {showAppealPreview && (
        <div data-modal-overlay="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => setShowAppealPreview(false)}>
          <div style={{ background: C.white, borderRadius: 8, padding: 0, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            {(() => {
              const sampleDonor = massAppealRefs.find(r => r.selected) || massAppealRefs[0]
              const causeName = massAppealForm.cause_id ? (myCauses.find(c => c.id === massAppealForm.cause_id)?.title || null) : (massAppealForm.customLabel?.trim() || null)
              const previewMessage = massAppealForm.message
                ? massAppealForm.message.replace(/\[name\]/gi, sampleDonor?.donor_name?.split(' ')[0] || 'there')
                : '(No message written yet)'
              return (
                <div>
                  <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: C.forest }}>Email Preview — showing as {sampleDonor?.donor_name || 'a sample donor'} would see it</div>
                    <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => setShowAppealPreview(false)}>✕</button>
                  </div>
                  <div style={{ padding: 24, background: C.ivory }}>
                    <div style={{ background: C.forest, borderRadius: 12, padding: 24, textAlign: 'center', marginBottom: 16 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>{causeName || 'We need your help'}</div>
                    </div>
                    <div style={{ background: C.white, borderRadius: 12, padding: 20, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 16 }}>{previewMessage}</div>
                      <div style={{ textAlign: 'center', padding: 16, background: C.ivory, borderRadius: 8 }}>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Scan to give via PayNow</div>
                        <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic' }}>[QR code]</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.forest, marginTop: 8 }}>Suggested: SGD ${massAppealForm.amount || '—'}</div>
                        <div style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace', marginTop: 4 }}>Ref: {sampleDonor?.ref || '—'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {showAddDonorModal && (
        <div data-modal-overlay="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => setShowAddDonorModal(false)}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 460, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Add a Donor</div>
            <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 16 }}>Track someone you know but haven't received a donation from yet — a major donor prospect, or someone you met in person. They'll automatically merge with their real record once they give.</div>
            {addDonorError && <div style={{ background: C.warningBg, color: C.warning, padding: '10px 14px', borderRadius: 4, fontSize: 13, marginBottom: 12 }}>{addDonorError}</div>}
            <label style={{ display: 'block', marginBottom: 10 }}>
              <div style={s.formLabel}>Full Name *</div>
              <input style={s.formInput} placeholder="e.g. Tan Wei Ling" value={addDonorForm.full_name} onChange={e => setAddDonorForm((f: any) => ({ ...f, full_name: e.target.value }))} />
            </label>
            <label style={{ display: 'block', marginBottom: 10 }}>
              <div style={s.formLabel}>Email</div>
              <input style={s.formInput} placeholder="Optional" value={addDonorForm.email} onChange={e => setAddDonorForm((f: any) => ({ ...f, email: e.target.value }))} />
            </label>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={s.formLabel}>Notes</div>
              <textarea style={{ ...s.formInput, minHeight: 70, resize: 'vertical' }} placeholder="e.g. Met at gala dinner, interested in Winter Cancer Drive" value={addDonorForm.notes} onChange={e => setAddDonorForm((f: any) => ({ ...f, notes: e.target.value }))} />
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={savingDonorContact} onClick={saveDonorContact}>{savingDonorContact ? 'Saving...' : '✓ Add Donor'}</button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => setShowAddDonorModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showManualPledgeLinkModal && selectedDonation && (
        <div data-modal-overlay="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }} onClick={() => { setShowManualPledgeLinkModal(false); setManualPledgeLinkSelection('') }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 480, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>Link this donation to a pledge</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => { setShowManualPledgeLinkModal(false); setManualPledgeLinkSelection('') }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              ${Number(selectedDonation.amount).toLocaleString()} from {selectedDonation.donor_name} — choose which pending pledge this should count toward.
            </div>
            {pledges.filter(p => p.status === 'pending').length === 0 ? (
              <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic', marginBottom: 16 }}>No pending pledges to link to.</div>
            ) : (
              <label style={{ display: 'block', marginBottom: 16 }}>
                <div style={s.formLabel}>Pending pledges</div>
                <select style={s.formInput} value={manualPledgeLinkSelection} onChange={e => setManualPledgeLinkSelection(e.target.value)}>
                  <option value="">Select a pledge...</option>
                  {pledges.filter(p => p.status === 'pending').map(p => (
                    <option key={p.id} value={p.id}>
                      {p.donor_name} — ${Number(p.amount).toLocaleString()} (${(pledgeGivenTotals[p.id] || 0).toLocaleString()} given so far)
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={!manualPledgeLinkSelection || linkingPledgeManually} onClick={() => manuallyLinkDonationToPledge(selectedDonation, manualPledgeLinkSelection)}>
                {linkingPledgeManually ? 'Linking...' : '✓ Link donation'}
              </button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => { setShowManualPledgeLinkModal(false); setManualPledgeLinkSelection('') }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showVoidModal && selectedDonation && (
        <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setShowVoidModal(false)}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.red, marginBottom: 4 }}>Void & Reissue Receipt</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
              The original receipt number <strong style={{ fontFamily: 'monospace' }}>{selectedDonation.receipt_number || selectedDonation.payment_ref}</strong> will be marked as voided and kept on record. A new corrected receipt will be issued with the next sequential number.
            </div>
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: C.muted }}>Donor</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: C.forest }}>{selectedDonation.donor_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: C.muted }}>Amount</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: C.forest }}>${Number(selectedDonation.amount).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: C.muted }}>Current Receipt No.</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: C.forest, fontFamily: 'monospace' }}>{selectedDonation.receipt_number || selectedDonation.payment_ref}</span>
              </div>
            </div>
            <label style={{ display: 'block' }}>
              <div style={s.formLabel}>Reason for voiding *</div>
              <input
                style={{ ...s.formInput, marginBottom: 16 }}
                placeholder="e.g. Wrong amount entered, donor name misspelled"
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                autoFocus
              />
            </label>
            <div style={{ background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: C.warning }}>
              ⚠️ This action is logged and cannot be undone. The void reason will appear on the audit trail.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ flex: 1, background: C.ivoryDark, color: C.forest, border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => { setShowVoidModal(false); setVoidReason('') }}>Cancel</button>
              <button
                style={{ flex: 1, background: C.red, color: 'white', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: voidReason.trim() ? 1 : 0.5 }}
                disabled={!voidReason.trim() || voidingReceipt}
                onClick={() => voidAndReissueReceipt(selectedDonation)}
              >{voidingReceipt ? '⏳ Processing...' : 'Void & Reissue'}</button>
            </div>
          </div>
        </div>
      )}

      {thankYouDraft && !thankYouDraftPreviewing && (
        <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setThankYouDraft(null)}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.forest }}>Thank-you note for {thankYouDraft.donor.name}</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => setThankYouDraft(null)}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Review and edit before sending. This won't be sent as-is.</div>
            <SenderIdentityLine recipientName={thankYouDraft.donor.name} recipientEmail={thankYouDraft.donor.email} {...senderIdentity} />
            <label style={{ display: 'block', marginBottom: 12 }}>
              <div style={s.formLabel}>Subject</div>
              <input style={s.formInput} value={thankYouDraft.subject} onChange={e => setThankYouDraft((prev: any) => ({ ...prev, subject: e.target.value }))} />
            </label>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={s.formLabel}>Message</div>
              <textarea
                style={{ ...s.formInput, minHeight: 260, resize: 'vertical', fontFamily: 'inherit' }}
                value={thankYouDraft.text}
                onChange={e => setThankYouDraft((prev: any) => ({ ...prev, text: e.target.value }))}
              />
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={!thankYouDraft.donor.email?.trim()} onClick={() => setThankYouDraftPreviewing(true)}>
                {thankYouDraft.donor.email?.trim() ? 'Preview email →' : 'No email on file'}
              </button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => setThankYouDraft(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {thankYouDraft && thankYouDraftPreviewing && (
        <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => { setThankYouDraft(null); setThankYouDraftPreviewing(false) }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>Preview email</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => { setThankYouDraft(null); setThankYouDraftPreviewing(false) }}>✕</button>
            </div>
            <SenderIdentityLine recipientName={thankYouDraft.donor.name} recipientEmail={thankYouDraft.donor.email} {...senderIdentity} />
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: 16, background: C.ivory, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.forest, marginBottom: 10 }}>{thankYouDraft.subject}</div>
              <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{thankYouDraft.text}</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }}
                onClick={async () => {
                  const { donor, badgeState, subject, text, givingChangeMeta } = thankYouDraft
                  const { error } = await sendCharityEmail({
                    type: 'milestone_thank_you',
                    donor_name: donor.name,
                    donor_email: donor.email,
                    charity_name: charityName,
                    charity_uen: charityUen,
                    subject_override: subject,
                    custom_message: text,
                    ...emailBannerFor('milestone_thank_you', { donor_name: donor.name, charity_name: charityName }),
                  })
                  if (error) { showToast('Failed to send email', 'error'); return }
                  const donorKey = donor.email?.trim() || donor.name
                  if (badgeState) await ackDonorBadges(donor, badgeState)
                  if (givingChangeMeta) {
                    const { data: inserted } = await supabase.from('giving_change_acks').insert({
                      charity_uen: charityUen,
                      donor_key: donorKey,
                      direction: givingChangeMeta.direction,
                      change_pct: givingChangeMeta.changePct,
                      message: text,
                      sent_by: session.user.email,
                    }).select().single()
                    if (inserted) {
                      setGivingChangeAckHistory(prev => ({ ...prev, [donorKey]: [inserted, ...(prev[donorKey] || [])] }))
                    }
                    await logDonorContact(donorKey, `Giving increase thank-you — email sent`, 'email', true, { subject, body: text })
                  } else {
                    await logDonorContact(donorKey, `Thank-you note sent`, 'email', true, { subject, body: text })
                  }
                  await supabase.from('audit_log').insert({
                    actor_type: 'charity',
                    actor_email: session.user.email,
                    action: givingChangeMeta ? 'giving_change_checkin_sent' : 'milestone_thank_you_sent',
                    details: { donor_name: donor.name, donor_email: donor.email, charity_uen: charityUen },
                  })
                  setThankYouDraft(null)
                  setThankYouDraftPreviewing(false)
                  showToast(`Thank-you note sent to ${donor.email}`)
                }}
              >✓ Send</button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => setThankYouDraftPreviewing(false)}>
                ← Back to edit
              </button>
            </div>
          </div>
        </div>
      )}

      {rnOutreach && !rnOutreach.previewing && (
        <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => !rnSending && setRnOutreach(null)}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.forest }}>{rnOutreach.title} — {rnOutreach.donorName}</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} disabled={rnSending} onClick={() => setRnOutreach(null)}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Review and personalise, then preview before sending. Sending records it in this donor's log automatically.</div>
            <SenderIdentityLine recipientName={rnOutreach.donorName} recipientEmail={rnOutreach.donorEmail} {...senderIdentity} />
            <label style={{ display: 'block', marginBottom: 12 }}>
              <div style={s.formLabel}>Subject</div>
              <input style={s.formInput} value={rnOutreach.subject} onChange={e => setRnOutreach((prev: any) => ({ ...prev, subject: e.target.value }))} />
            </label>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={s.formLabel}>Message</div>
              <textarea
                style={{ ...s.formInput, minHeight: 260, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
                value={rnOutreach.text}
                onChange={e => setRnOutreach((prev: any) => ({ ...prev, text: e.target.value }))}
              />
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                style={{ ...s.btnForest, flex: 1, justifyContent: 'center', opacity: rnOutreach.donorEmail?.trim() ? 1 : 0.5 }}
                disabled={!rnOutreach.donorEmail?.trim()}
                onClick={() => setRnOutreach((prev: any) => ({ ...prev, previewing: true }))}
              >{rnOutreach.donorEmail?.trim() ? 'Preview email →' : 'No email on file'}</button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} disabled={rnSending} onClick={() => setRnOutreach(null)}>Cancel</button>
            </div>
            <div style={{ textAlign: 'center', marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 6 }}>Reached out another way — a call, in person, or your own email?</div>
              <button
                style={{ fontSize: 12.5, color: C.forest, fontWeight: 600, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 14px', cursor: rnSending ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                disabled={rnSending}
                onClick={async () => {
                  setRnSending(true)
                  await logDonorContact(rnOutreach.donorKey, `${rnOutreach.logNote} — logged as done`, 'note')
                  setRnSending(false); setRnOutreach(null); showToast('Logged as done ✓')
                }}
              >✓ Just log it as done</button>
            </div>
          </div>
        </div>
      )}

      {rnOutreach && rnOutreach.previewing && (
        <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => !rnSending && setRnOutreach((prev: any) => ({ ...prev, previewing: false }))}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>Preview email</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} disabled={rnSending} onClick={() => setRnOutreach(null)}>✕</button>
            </div>
            <SenderIdentityLine recipientName={rnOutreach.donorName} recipientEmail={rnOutreach.donorEmail} {...senderIdentity} />
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: 16, background: C.ivory, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.forest, marginBottom: 10 }}>{rnOutreach.subject}</div>
              <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{rnOutreach.text}</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }}
                disabled={rnSending}
                onClick={async () => {
                  setRnSending(true)
                  const { error } = await sendCharityEmail({
                    type: 'milestone_thank_you',
                    donor_name: rnOutreach.donorName,
                    donor_email: rnOutreach.donorEmail,
                    charity_name: charityName,
                    charity_uen: charityUen,
                    subject_override: rnOutreach.subject,
                    custom_message: rnOutreach.text,
                    ...emailBannerFor('milestone_thank_you', { donor_name: rnOutreach.donorName, charity_name: charityName }),
                  })
                  if (error) { showToast(error.message || 'Failed to send email', 'error'); setRnSending(false); return }
                  await logDonorContact(rnOutreach.donorKey, `${rnOutreach.logNote} sent by email`, 'email', true, { subject: rnOutreach.subject, body: rnOutreach.text })
                  const sentTo = rnOutreach.donorEmail
                  setRnSending(false); setRnOutreach(null); showToast(`Sent to ${sentTo} ✓ · logged`)
                }}
              >{rnSending ? 'Sending...' : '✓ Send email'}</button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} disabled={rnSending} onClick={() => setRnOutreach((prev: any) => ({ ...prev, previewing: false }))}>← Back to edit</button>
            </div>
          </div>
        </div>
      )}

      {viewEmailNote && (
        <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setViewEmailNote(null)}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>Email sent</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => setViewEmailNote(null)}>✕</button>
            </div>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 12 }}>Sent {new Date(viewEmailNote.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}, {new Date(viewEmailNote.created_at).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })} · by {viewEmailNote.created_by}</div>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: 16, background: C.ivory }}>
              {viewEmailNote.email_subject && <div style={{ fontSize: 13, fontWeight: 500, color: C.forest, marginBottom: 10 }}>{viewEmailNote.email_subject}</div>}
              <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{viewEmailNote.email_body}</div>
            </div>
          </div>
        </div>
      )}

      {showCustomizeAnalytics && (
        <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setShowCustomizeAnalytics(false)}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 460, width: '100%', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.forest }}>Customize Analytics</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => setShowCustomizeAnalytics(false)}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Choose which metrics appear on this page.</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[
                { key: 'total_raised', label: 'Total Raised', note: 'Year-to-date total' },
                { key: 'donor_retention', label: 'Donor Retention Rate', note: "% of last year's donors who gave again" },
                { key: 'new_vs_returning', label: 'New vs Returning Donors', note: 'Split of first-time and repeat givers' },
                { key: 'avg_gift', label: 'Average Gift', note: 'Mean donation amount' },
                { key: 'median_donation', label: 'Median Donation', note: 'Typical single gift' },
                { key: 'campaign_performance', label: 'Campaign Performance', note: 'Raised per active campaign' },
                { key: 'campaign_momentum', label: 'Campaign Momentum', note: 'Is each live campaign speeding up or slowing down right now' },
                { key: 'campaign_donor_mix', label: 'New vs Existing Donors per Campaign', note: 'Is this campaign growing your donor base or reshuffling existing donors' },
                { key: 'donation_breakdown', label: 'Donation Size Breakdown', note: 'Gifts grouped by amount range' },
                { key: 'donor_highlights', label: 'Donor Highlights', note: 'Top donor, largest gift, most frequent giver, standout new supporter' },
                { key: 'giving_streaks', label: 'Giving Streaks', note: 'Donors giving 3+ consecutive months — your most dependable supporters' },
                { key: 'quiet_donors', label: 'Quiet Donors', note: 'Regular givers whose rhythm has slowed — catch them before they lapse' },
                { key: 'quiet_recurring_donors', label: 'Quietly Paying Donors', note: 'Active recurring donors with no personal contact in 12+ months' },
                { key: 'cash_runway', label: 'Cash Runway', note: 'Months of operating expenses your recent giving pace would cover' },
                { key: 'acquisition_source', label: 'Donor Acquisition Sources', note: 'Which channels bring in donors who stick around' },
                { key: 'top_connectors', label: 'Top Connectors', note: 'Donors whose referrals turned into real, sustained giving' },
                { key: 'donation_forecast', label: 'Monthly Forecast', note: 'What to expect this month, combining confirmed recurring gifts with historical one-off patterns' },
                { key: 'seasonality_trend', label: 'Seasonality Trend', note: 'Which months are historically strong or weak, across all your years of data' },
                { key: 'lapse_reasons', label: 'Why Donors Lapse', note: 'Breakdown of reasons donors stop giving, from your dismissal records' },
                { key: 'year_end_projection', label: 'Year-End Projection', note: 'Where your revenue is likely to land by December, based on your pace so far (shown from October)' },
                { key: 'ack_timing_sla', label: 'Gift Acknowledgment Timing', note: 'Average days from a donation coming in to its receipt going out' },
                { key: 'recurring_revenue', label: 'Monthly Recurring Revenue', note: 'GIRO and habitual PayNow gifts, separated from one-off donations' },
                { key: 'goal_pacing', label: 'Goal Pacing Forecast', note: 'Whether you\u2019re on track to hit your annual goal by year end' },
                { key: 'channel_mix', label: 'How Donors Are Paying', note: 'Breakdown of PayNow vs cash vs other payment methods' },
                { key: 'fun_facts', label: 'Fun Facts', note: 'Average daily giving, one-time donor share, your best-ever day' },
                { key: 'story_mode', label: 'Your Story So Far', note: 'An auto-written summary of the year, in plain sentences' },
                { key: 'concentration_risk', label: 'Funding Concentration', note: 'How much you rely on your top 3 donors' },
                { key: 'small_gift_compounding', label: 'The Power of Small Asks', note: 'What a small nudge to sub-$20 donors could add up to' },
                { key: 'campaign_overlap', label: 'Campaign Donor Overlap', note: 'Whether your campaigns reach the same donors or different ones' },
                { key: 'thank_you_debt', label: 'Silent Thank-You Debt', note: 'Total dollar amount never acknowledged with a thank-you' },
                
                { key: 'monthly_trend', label: 'Monthly Trend Chart', note: 'Donations by month, year over year' },
              ].map(item => (
                <label key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 4px', borderBottom: `1px solid ${C.ivoryDark}`, cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{item.note}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={customizeMetricsDraft.includes(item.key)}
                    onChange={() => setCustomizeMetricsDraft((prev: any) => prev.includes(item.key) ? prev.filter((k: any) => k !== item.key) : [...prev, item.key])}
                  />
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => setShowCustomizeAnalytics(false)}>Cancel</button>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} onClick={() => saveVisibleMetrics(customizeMetricsDraft)}>✓ Save</button>
            </div>
          </div>
        </div>
      )}

      {thankYouPreviewModal && !thankYouPreviewing && (() => {
        const d = thankYouPreviewModal
        return (
          <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setThankYouPreviewModal(null)}>
            <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.forest }}>{d.thank_you_sent ? 'Send this email again?' : 'Send thank-you email'}</div>
                <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => setThankYouPreviewModal(null)}>✕</button>
              </div>
              {d.thank_you_sent && (
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>A thank-you was already sent for this donation.</div>
              )}
              <SenderIdentityLine recipientName={d.donor_name} recipientEmail={d.donor_email} {...senderIdentity} />
              <label style={{ display: 'block', marginBottom: 12 }}>
                <div style={s.formLabel}>Subject</div>
                <input style={s.formInput} value={thankYouSubjectInput} onChange={e => setThankYouSubjectInput(e.target.value)} />
              </label>
              <label style={{ display: 'block', marginBottom: 16 }}>
                <div style={s.formLabel}>Add a personal message (optional)</div>
                <textarea
                  style={{ ...s.formInput, minHeight: 260, resize: 'vertical' }}
                  placeholder="Appears above the donation details in the email. Leave blank to send just the receipt."
                  value={thankYouCustomMessage}
                  onChange={e => setThankYouCustomMessage(e.target.value)}
                />
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} onClick={() => setThankYouPreviewing(true)}>
                  Preview email →
                </button>
                <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => setThankYouPreviewModal(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )
      })()}

      {thankYouPreviewModal && thankYouPreviewing && (() => {
        const d = thankYouPreviewModal
        const previewBodyHtml = buildThankYouPreviewHtml(d, thankYouCustomMessage)
        const fullPreviewHtml = `<div style="font-family:'Segoe UI',sans-serif;padding:16px;background:${C.ivory};">${previewBodyHtml}</div>`
        return (
          <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => { setThankYouPreviewModal(null); setThankYouPreviewing(false) }}>
            <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>Preview email</div>
                <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => { setThankYouPreviewModal(null); setThankYouPreviewing(false) }}>✕</button>
              </div>
              <SenderIdentityLine recipientName={d.donor_name} recipientEmail={d.donor_email} {...senderIdentity} />
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Receipt PDF will be attached</div>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                <iframe
                  srcDoc={fullPreviewHtml}
                  style={{ width: '100%', height: 420, border: 'none', display: 'block' }}
                  title="Email preview"
                />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={sendingThankYouId === d.id} onClick={async () => { setThankYouPreviewModal(null); setThankYouPreviewing(false); await sendThankYouEmail(d) }}>
                  {sendingThankYouId === d.id ? 'Sending...' : (d.thank_you_sent ? '✓ Send again' : '✓ Send email')}
                </button>
                <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => setThankYouPreviewing(false)}>
                  ← Back to edit
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {inKindThankYouModal && !inKindThankYouPreviewing && (() => {
        const d = inKindThankYouModal
        return (
          <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setInKindThankYouModal(null)}>
            <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.forest }}>Send thank-you email</div>
                <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => setInKindThankYouModal(null)}>✕</button>
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>This acknowledges a gift-in-kind — it will not include a cash receipt or tax deduction.</div>
              <SenderIdentityLine recipientName={d.donor_name} recipientEmail={d.donor_email} {...senderIdentity} />
              <label style={{ display: 'block', marginBottom: 12 }}>
                <div style={s.formLabel}>Subject</div>
                <input style={s.formInput} value={inKindThankYouSubject} onChange={e => setInKindThankYouSubject(e.target.value)} />
              </label>
              <label style={{ display: 'block', marginBottom: 16 }}>
                <div style={s.formLabel}>Message</div>
                <textarea
                  style={{ ...s.formInput, minHeight: 180, resize: 'vertical' }}
                  value={inKindThankYouMessage}
                  onChange={e => setInKindThankYouMessage(e.target.value)}
                />
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} onClick={() => setInKindThankYouPreviewing(true)}>
                  Preview email →
                </button>
                <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => setInKindThankYouModal(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )
      })()}

      {inKindThankYouModal && inKindThankYouPreviewing && (() => {
        const d = inKindThankYouModal
        const previewBodyHtml = buildInKindThankYouPreviewHtml(d, inKindThankYouMessage)
        const fullPreviewHtml = `<div style="font-family:'Segoe UI',sans-serif;padding:16px;background:${C.ivory};">${previewBodyHtml}</div>`
        return (
          <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => { setInKindThankYouModal(null); setInKindThankYouPreviewing(false) }}>
            <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>Preview email</div>
                <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => { setInKindThankYouModal(null); setInKindThankYouPreviewing(false) }}>✕</button>
              </div>
              <SenderIdentityLine recipientName={d.donor_name} recipientEmail={d.donor_email} {...senderIdentity} />
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                <iframe
                  srcDoc={fullPreviewHtml}
                  style={{ width: '100%', height: 420, border: 'none', display: 'block' }}
                  title="Email preview"
                />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={sendingInKindThankYouId === d.id} onClick={async () => { setInKindThankYouModal(null); setInKindThankYouPreviewing(false); await sendInKindThankYouEmail(d) }}>
                  {sendingInKindThankYouId === d.id ? 'Sending...' : '✓ Send email'}
                </button>
                <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => setInKindThankYouPreviewing(false)}>
                  ← Back to edit
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {volunteerEditEntry && (
        <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setVolunteerEditEntry(null)}>
          <div style={{ background: C.white, borderRadius: 8, padding: isMobile ? 20 : 24, maxWidth: 720, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.forest }}>Your Entry</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => setVolunteerEditEntry(null)}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Correct the details below, or remove this entry if it was made in error.</div>
            {volunteerEditEntry.payment_status === 'confirmed' ? (
              <div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 16 }}>
                  This entry has already been confirmed and receipted by staff, so it can no longer be edited directly. If something's wrong, describe it below — this gets logged for staff to review.
                </div>
                <label style={{ display: 'block', marginBottom: 12 }}>
                  <div style={s.formLabel}>What needs to change?</div>
                  <textarea style={{ ...s.formInput, minHeight: 70, resize: 'vertical' }} placeholder="e.g. Amount should be $50, not $500" value={volunteerFlagMessage} onChange={e => setVolunteerFlagMessage(e.target.value)} />
                </label>
                <button style={{ ...s.btnForest, width: '100%', justifyContent: 'center' }} onClick={async () => {
                  if (!volunteerFlagMessage.trim()) { showToast('Describe what needs to change', 'error'); return }
                  await supabase.from('audit_log').insert({
                    actor_type: 'volunteer',
                    actor_email: session.user.email,
                    action: 'donation_flagged_for_review',
                    donation_id: volunteerEditEntry.id,
                    details: { donor_name: volunteerEditEntry.donor_name, amount: volunteerEditEntry.amount, message: volunteerFlagMessage.trim(), charity_uen: charityUen },
                  })
                  setVolunteerEditEntry(null)
                  setVolunteerFlagMessage('')
                  showToast('Logged for staff to review ✓')
                }}>Submit for Staff Review</button>
              </div>
            ) : (
              <div>
                {volunteerEditError && <div style={{ background: C.warningBg, color: C.warning, padding: '10px 14px', borderRadius: 4, fontSize: 13, marginBottom: 12 }}>{volunteerEditError}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <label style={{ display: 'block' }}><div style={s.formLabel}>Donor Name *</div><input style={s.formInput} value={volunteerEditForm.donor_name} onChange={e => setVolunteerEditForm((f: any) => ({ ...f, donor_name: e.target.value }))} /></label>
                  {charityIsIpc && (
                    <label style={{ display: 'block' }}><div style={s.formLabel}>NRIC / FIN</div><input style={s.formInput} placeholder="e.g. S1234567A" value={volunteerEditForm.donor_nric} onChange={e => setVolunteerEditForm((f: any) => ({ ...f, donor_nric: e.target.value }))} maxLength={9} /></label>
                  )}
                  <label style={{ display: 'block' }}><div style={s.formLabel}>Amount (SGD) *</div><input style={s.formInput} type="number" placeholder="0.00" value={volunteerEditForm.amount} onChange={e => setVolunteerEditForm((f: any) => ({ ...f, amount: e.target.value }))} /></label>
                  <label style={{ display: 'block' }}><div style={s.formLabel}>Date</div><input style={s.formInput} type="date" min="2020-01-01" max={new Date().toISOString().split('T')[0]} value={volunteerEditForm.date} onChange={e => setVolunteerEditForm((f: any) => ({ ...f, date: e.target.value }))} /></label>
                  <label style={{ display: 'block' }}><div style={s.formLabel}>Payment Method</div>
                    <select style={s.formInput} value={volunteerEditForm.payment_method} onChange={e => setVolunteerEditForm((f: any) => ({ ...f, payment_method: e.target.value }))}>
                      <option>Cash</option><option>Bank Wire</option><option>Cheque</option><option>PayNow Direct</option><option>Other</option>
                    </select>
                  </label>
                  <label style={{ display: 'block' }}><div style={s.formLabel}>Donor Email</div><input style={s.formInput} placeholder="donor@email.com" value={volunteerEditForm.donor_email} onChange={e => setVolunteerEditForm((f: any) => ({ ...f, donor_email: e.target.value }))} /></label>
                  <label style={{ display: 'block' }}><div style={s.formLabel}>Cause (Optional)</div>
                    <select style={s.formInput} value={volunteerEditForm.cause_id} onChange={e => setVolunteerEditForm((f: any) => ({ ...f, cause_id: e.target.value }))}>
                      <option value="">General Donation</option>
                      {myCauses.filter(c => c.status === 'approved' && c.type === 'campaign' && (!c.end_date || new Date(c.end_date) >= new Date())).map(c => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: 'block', gridColumn: isMobile ? 'auto' : '1 / -1' }}><div style={s.formLabel}>Notes</div><input style={s.formInput} placeholder="Optional notes" value={volunteerEditForm.notes} onChange={e => setVolunteerEditForm((f: any) => ({ ...f, notes: e.target.value }))} /></label>
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} onClick={async () => {
                    setVolunteerEditError('')
                    if (!volunteerEditForm.donor_name.trim()) { setVolunteerEditError('Donor name is required'); return }
                    if (!volunteerEditForm.amount || parseFloat(volunteerEditForm.amount) <= 0) { setVolunteerEditError('Please enter a valid amount'); return }
                    if (parseFloat(volunteerEditForm.amount) > 1000000) { setVolunteerEditError('Amount seems too large — please check it (max $1,000,000)'); return }
                    if (new Date(volunteerEditForm.date) > new Date()) { setVolunteerEditError('Date cannot be in the future'); return }
                    if (volunteerEditForm.donor_nric && !/^[A-Z]\d{7}[A-Z]$/i.test(volunteerEditForm.donor_nric.trim())) { setVolunteerEditError('Invalid NRIC format. Should be like S1234567A'); return }
                    if (volunteerEditForm.donor_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(volunteerEditForm.donor_email.trim())) { setVolunteerEditError('Invalid email format'); return }
                    const updates = {
                      donor_name: volunteerEditForm.donor_name.trim(),
                      amount: parseFloat(volunteerEditForm.amount),
                      created_at: volunteerEditForm.date,
                      notes: volunteerEditForm.notes,
                      payment_method: volunteerEditForm.payment_method,
                      donor_email: volunteerEditForm.donor_email?.trim().toLowerCase() || null,
                      donor_nric: volunteerEditForm.donor_nric ? volunteerEditForm.donor_nric.trim().toUpperCase() : null,
                      cause_id: volunteerEditForm.cause_id || null,
                    }
                    const { error } = await supabase.from('donations').update(updates).eq('id', volunteerEditEntry.id)
                    if (error) { showToast('Error saving', 'error'); return }
                    await supabase.from('audit_log').insert({
                      actor_type: 'volunteer',
                      actor_email: session.user.email,
                      action: 'donation_edited',
                      donation_id: volunteerEditEntry.id,
                      details: { before: { donor_name: volunteerEditEntry.donor_name, amount: volunteerEditEntry.amount }, after: { donor_name: updates.donor_name, amount: updates.amount }, charity_uen: charityUen },
                    })
                    setDonations(prev => prev.map(d => d.id === volunteerEditEntry.id ? { ...d, ...updates } : d))
                    setVolunteerEditEntry(null)
                    showToast('Updated ✓')
                  }}>Save</button>
                  <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => setVolunteerEditEntry(null)}>Cancel</button>
                </div>
                <button style={{ ...s.viewBtn, width: '100%', justifyContent: 'center', color: C.red, borderColor: C.red }} onClick={() => {
                  setConfirmModal({
                    title: 'Delete this entry?',
                    description: `${volunteerEditEntry.donor_name}'s $${Number(volunteerEditEntry.amount).toLocaleString()} entry will be removed. You'll have a few seconds to undo right after.`,
                    confirmLabel: 'Delete',
                    onConfirm: async () => {
                      const entryToDelete = volunteerEditEntry
                      const originalStatus = entryToDelete?.status || 'confirmed'
                      // Soft-delete, matching the charity-side delete flow -- a hard .delete() here
                      // gave volunteers no way to recover from an accidental click, unlike every
                      // other donation-delete path in the app.
                      const { error } = await supabase.from('donations').update({ status: 'deleted_by_charity' }).eq('id', entryToDelete.id)
                      if (error) { showToast('Error deleting entry', 'error'); return }
                      await supabase.from('audit_log').insert({
                        actor_type: 'volunteer',
                        actor_email: session.user.email,
                        action: 'manual_entry_deleted',
                        donation_id: entryToDelete.id,
                        details: { donor_name: entryToDelete.donor_name, amount: entryToDelete.amount, charity_uen: charityUen },
                      })
                      setDonations(prev => prev.filter(d => d.id !== entryToDelete.id))
                      setVolunteerEditEntry(null)

                      let cancelled = false
                      setToast({
                        msg: 'Entry deleted',
                        type: 'error',
                        undoable: true,
                        onUndo: async () => {
                          cancelled = true
                          const { error: restoreError } = await supabase.from('donations').update({ status: originalStatus }).eq('id', entryToDelete.id)
                          if (restoreError) { showToast('Could not restore entry', 'error'); return }
                          const { data: freshData } = await supabase.from('donations').select('*').eq('id', entryToDelete.id).single()
                          setDonations(prev => [freshData || entryToDelete, ...prev])
                          setToast(null)
                          showToast('Entry restored ✓')
                        },
                      })
                      setTimeout(() => { if (!cancelled) setToast(null) }, 10000)
                    },
                  })
                }}>🗑️ Delete This Entry</button>
              </div>
            )}
          </div>
        </div>
      )}

      {showAddTeamMemberModal && (
        <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowAddTeamMemberModal(false)}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.forest }}>Add Team Member</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => setShowAddTeamMemberModal(false)}>✕</button>
            </div>
            <label style={{ display: 'block', marginBottom: 14 }}>
              <div style={s.formLabel}>Email</div>
              <input style={s.formInput} placeholder="email@address.com" value={volunteerInput} onChange={e => setVolunteerInput(e.target.value)} autoFocus />
            </label>
            <label style={{ display: 'block', marginBottom: 20 }}>
              <div style={s.formLabel}>Role</div>
              <select style={s.formInput} value={newTeamMemberRole} onChange={e => setNewTeamMemberRole(e.target.value)}>
                <option value="ed">Executive Director</option>
                <option value="staff">Staff</option>
                <option value="board">Board Member</option>
                <option value="volunteer">Volunteer</option>
              </select>
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={savingVolunteer} onClick={async () => {
                const email = volunteerInput.trim().toLowerCase()
                const role = newTeamMemberRole
                if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Enter a valid email', 'error'); return }
                if ([...localEds, ...localStaff, ...localBoardMembers, ...localVolunteers].includes(email)) { showToast('Already assigned a role', 'error'); return }
                setSavingVolunteer(true)
                const columnMap: Record<string, string> = { ed: 'ed_emails', staff: 'staff_emails', board: 'board_emails', volunteer: 'volunteer_emails' }
                const currentMap: Record<string, any> = { ed: localEds, staff: localStaff, board: localBoardMembers, volunteer: localVolunteers }
                const updated = [...currentMap[role], email]
                const { error } = await supabase.from('charity_contacts').update({ [columnMap[role]]: updated }).eq('charity_uen', charityUen)
                if (error) { showToast('Error saving', 'error'); setSavingVolunteer(false); return }

                const { error: inviteError } = await supabase.functions.invoke('invite-team-member', {
                  body: { email, charity_uen: charityUen, charity_name: charityName },
                })

                await supabase.from('audit_log').insert({
                  actor_type: 'charity',
                  actor_email: session.user.email,
                  action: 'team_member_added',
                  details: { email, role, charity_uen: charityUen },
                })

                if (role === 'ed') setLocalEds(updated)
                else if (role === 'staff') setLocalStaff(updated)
                else if (role === 'board') setLocalBoardMembers(updated)
                else setLocalVolunteers(updated)
                setVolunteerInput('')
                setSavingVolunteer(false)
                setShowAddTeamMemberModal(false)
                if (inviteError) {
                  showToast(`${email} added, but invite email failed — ask them to use "Forgot password" after you create their account manually`, 'error')
                } else {
                  showToast(`${email} added — invite email sent ✓`)
                }
              }}>{savingVolunteer ? 'Adding...' : 'Add'}</button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => setShowAddTeamMemberModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {duplicateDonationWarning && (
        <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setDuplicateDonationWarning(null)}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 420, width: '90%' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: C.warningBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 18, color: C.warning }}>⚠</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.forest, marginBottom: 6 }}>Possible duplicate payment</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
              {duplicateDonationWarning.donation.donor_name} already has a donation of the same amount within the last 5 minutes. This can happen if a PayNow QR was scanned twice.
            </div>
            <div style={{ background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: C.forest }}>
              Existing: ${Number(duplicateDonationWarning.possibleDupe.amount).toLocaleString()} on {new Date(duplicateDonationWarning.possibleDupe.created_at).toLocaleString('en-SG')}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                style={{ ...s.btnForest, flex: 1, justifyContent: 'center', fontSize: 13 }}
                onClick={() => { const d = duplicateDonationWarning.donation; setDuplicateDonationWarning(null); confirmPaymentFlow({ ...d, duplicateConfirmed: true }) }}
              >This is a separate gift — confirm anyway</button>
              <button
                style={{ ...s.viewBtn, flex: 1, justifyContent: 'center', fontSize: 13 }}
                onClick={() => setDuplicateDonationWarning(null)}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {confirmModal && (
        <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setConfirmModal(null)}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 400, width: '90%' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: C.successBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 18, color: C.forest }}>✓</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.forest, marginBottom: 6 }}>{confirmModal.title}</div>
            {confirmModal.subtitle && <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>{confirmModal.subtitle}</div>}
            {confirmModal.description && <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>{confirmModal.description}</div>}
            {(confirmModal.donorName || confirmModal.amount != null) && (
              <div style={{ background: C.white, border: `1.5px solid ${C.sage}`, borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
                {confirmModal.donorName && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Donor</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.forest }}>{confirmModal.donorName}</span>
                  </div>
                )}
                {confirmModal.amount != null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Amount</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.forest }}>${Number(confirmModal.amount).toLocaleString()}</span>
                  </div>
                )}
                <div style={{ borderTop: `1px solid ${C.border}`, margin: '10px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Transaction ref</span>
                  {confirmModal.reference ? (
                    <span style={{ fontSize: 15, fontWeight: 700, color: C.forest, fontFamily: 'monospace', background: C.successBg, padding: '3px 8px', borderRadius: 6 }}>{confirmModal.reference}</span>
                  ) : (
                    <span style={{ fontSize: 12, color: C.warning, fontWeight: 500 }}>⚠️ No reference on file</span>
                  )}
                </div>
              </div>
            )}
            {confirmModal.steps && confirmModal.steps.length > 0 && (
              <div style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
                {confirmModal.steps.map((step: any, i: any) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: i < confirmModal.steps.length - 1 ? 8 : 0 }}>
                    <span style={{ fontSize: 13, color: C.sage }}>✓</span>
                    <span style={{ fontSize: 13, color: C.text }}>{step}</span>
                  </div>
                ))}
              </div>
            )}
            {confirmModal.receiptPreviewDonation && (() => {
              const rd = confirmModal.receiptPreviewDonation
              return (
                <div style={{ background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Receipt Preview</div>
                  <div style={{ background: C.white, borderRadius: 6, border: `1px solid ${C.border}`, padding: '12px 14px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.forest, marginBottom: 2 }}>{charityName}</div>
                    <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 10 }}>UEN {charityUen}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: C.muted }}>Issued to</span>
                      <span style={{ fontWeight: 600, color: C.forest }}>{rd.receipt_name || rd.donor_name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: C.muted }}>Amount</span>
                      <span style={{ fontWeight: 600, color: C.forest }}>SGD ${Number(rd.amount).toLocaleString()}.00</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: C.muted }}>Date</span>
                      <span style={{ fontWeight: 600, color: C.forest }}>{new Date(rd.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: causeNameForDonation(rd) ? 4 : 0 }}>
                      <span style={{ color: C.muted }}>Payment method</span>
                      <span style={{ fontWeight: 600, color: C.forest }}>{rd.source === 'manual' ? (rd.payment_method || 'Manual') : 'PayNow'}</span>
                    </div>
                    {causeNameForDonation(rd) && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: C.muted }}>Cause</span>
                        <span style={{ fontWeight: 600, color: C.gold }}>🎯 {causeNameForDonation(rd)}</span>
                      </div>
                    )}
                    <div style={{ borderTop: `1px dashed ${C.border}`, marginTop: 10, paddingTop: 8, fontSize: 10.5, color: C.muted, fontStyle: 'italic' }}>
                      {charityIsIpc ? '250% tax deductible receipt' : 'This charity is registered but not an IPC. Not tax deductible.'}
                    </div>
                  </div>
                  {rd.donor_email && (
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Will be emailed to {rd.donor_email} as a PDF attachment along with the thank-you notes.</div>
                  )}
                </div>
              )
            })()}
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ flex: 1, background: C.ivoryDark, color: C.forest, border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setConfirmModal(null)}>Cancel</button>
              <button style={{ flex: 1, background: C.forest, color: 'white', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => { const action = confirmModal.onConfirm; setConfirmModal(null); action() }}>{confirmModal.confirmLabel || 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 32, right: 32,
          background: C.white,
          borderLeft: `3px solid ${toast.undoable ? C.warning : toast.type === 'success' ? C.sage : C.red}`,
          borderRadius: 14, padding: '14px 16px', zIndex: 999,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)',
          display: 'flex', alignItems: 'flex-start', gap: 12,
          maxWidth: 420,
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 1,
            background: toast.undoable ? C.warningBg : toast.type === 'success' ? C.successBg : C.dangerBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: toast.undoable ? C.warning : toast.type === 'success' ? C.forest : C.dangerTextStrong }}>
              {toast.undoable ? '🗑' : toast.type === 'success' ? '✓' : '✕'}
            </span>
          </div>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: C.forest, lineHeight: 1.4, paddingTop: 2 }}>{toast.msg}</span>
          {toast.undoable && (
            <span
              onClick={toast.onUndo}
              style={{ cursor: 'pointer', color: C.sage, border: `0.5px solid ${C.sage}`, padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0, marginTop: 1 }}
            >Undo</span>
          )}
          <span
            onClick={() => setToast(null)}
            style={{ cursor: 'pointer', color: C.muted, fontSize: 14, lineHeight: 1, flexShrink: 0, marginTop: 3 }}
          >✕</span>
        </div>
      )}
    </div>
  )
}
