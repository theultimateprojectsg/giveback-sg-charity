import React, { useState, useEffect, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { supabase } from './supabase'
import Auth from './CharityAuth'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { QRCodeSVG } from 'qrcode.react'
import JSZip from 'jszip'
import logo from './assets/logo.png'
import './App.css'

if (typeof document !== 'undefined' && !document.getElementById('gt-font-import')) {
  const link = document.createElement('link')
  link.id = 'gt-font-import'
  link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=IBM+Plex+Mono:wght@500&display=swap'
  document.head.appendChild(link)
}

const C = {
  forest:    '#1B4332',
  forestInk: '#0F2A1F',
  teal:      '#1A3C34',
  sage:      '#3D7A5C',
  gold:      '#B4870E',
  ivory:     '#FAF7F2',
  ivoryDark: '#F0EBE1',
  border:    '#E2D9CC',
  borderStrong: '#CFC3AF',
  text:      '#1C1C1C',
  muted:     '#6B6255',
  white:     '#FFFFFF',
  red:       '#A0472F',
  warning:       '#B4870E',
  warningBg:     '#FBF2DE',
  warningBorder: '#E8CC7A',
  successBg: '#EAF3EC',
  bucket1:   '#74C69D',
  fontVoice: "'Fraunces', serif",
  fontMono:  "'IBM Plex Mono', monospace",
}

function useScreenSize() {
  function getSize() {
    const w = window.innerWidth
    if (w <= 640) return 'mobile'
    if (w <= 1024) return 'tablet'
    return 'desktop'
  }
  const [screenSize, setScreenSize] = useState(getSize())
  useEffect(() => {
    function handleResize() { setScreenSize(getSize()) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  return screenSize
}

function InfoTip({ text }) {
  const [show, setShow] = React.useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onTouchStart={() => setShow(v => !v)}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'default', flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8"/><line x1="12" y1="12" x2="12" y2="16"/></svg>
      {show && (
        <span style={{ position: 'absolute', bottom: '130%', left: '50%', transform: 'translateX(-50%)', background: 'white', color: '#444', fontSize: 11, fontWeight: 400, lineHeight: 1.6, padding: '8px 12px', borderRadius: 8, whiteSpace: 'normal', width: 200, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', border: '1px solid #e5e7eb', pointerEvents: 'none', textTransform: 'none', letterSpacing: 0 }}>
          {text}
          <span style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', borderWidth: 5, borderStyle: 'solid', borderColor: 'white transparent transparent transparent' }} />
        </span>
      )}
    </span>
  )
}

function colorForDonor(nameOrEmail, palette) {
  const str = (nameOrEmail || '').trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  const index = Math.abs(hash) % palette.length
  return palette[index]
}

export default function App() {
  const screenSize = useScreenSize()
  const isMobile = screenSize === 'mobile'
  const isTablet = screenSize === 'tablet'
  const [donations, setDonations] = useState([])
  const [loading, setLoading] = useState(true)
  const [issuing, setIssuing] = useState(null)
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [selectedDonor, setSelectedDonor] = useState(null)
  const [pendingSelectedDonorKey, setPendingSelectedDonorKey] = useState(null)

  useEffect(() => {
    if (!session) return
    if (selectedDonor) {
      supabase.auth.updateUser({ data: { last_selected_donor: selectedDonor.email?.trim() || selectedDonor.name } })
    } else {
      supabase.auth.updateUser({ data: { last_selected_donor: null } })
    }
  }, [selectedDonor])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [filterNric, setFilterNric] = useState('All')
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString())
  const [filterSource, setFilterSource] = useState('All')
  const [filterThankYou, setFilterThankYou] = useState('All')
  const [selectedDonationIds, setSelectedDonationIds] = useState([])
  const [donationsPage, setDonationsPage] = useState(0)
  const [donationsPerPage, setDonationsPerPage] = useState(25)
  const [donationSortBy, setDonationSortBy] = useState(null)
  const [donationSortDir, setDonationSortDir] = useState('desc')
  const [bulkEditMode, setBulkEditMode] = useState(false)
  
  const [showManualForm, setShowManualForm] = useState(false)
  const [manualForm, setManualForm] = useState({ donor_name: '', donor_nric: '', amount: '', payment_method: 'Cash', notes: '', donor_email: '', date: new Date().toISOString().split('T')[0], cause_id: '', receipt_name: '', is_anonymous: false, acquisition_source: '', referred_by_donor_key: '', already_verified: false })
  const [manualError, setManualError] = useState('')
  const [savingManual, setSavingManual] = useState(false)
  const [manualDuplicateWarning, setManualDuplicateWarning] = useState(null)
  const [showVoidModal, setShowVoidModal] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [voidingReceipt, setVoidingReceipt] = useState(false)
  const [donorNotes, setDonorNotes] = useState([])
  const [donorNotesLoading, setDonorNotesLoading] = useState(false)
  const [newNoteText, setNewNoteText] = useState('')
  const [newNoteType, setNewNoteType] = useState('note')
  const [savingNote, setSavingNote] = useState(false)
  const [donorTagsMap, setDonorTagsMap] = useState({})
  const [donorReceiptNameOverrides, setDonorReceiptNameOverrides] = useState({})
  const [householdLinkSearch, setHouseholdLinkSearch] = useState('')
  const [newTagInput, setNewTagInput] = useState('')
  const [savingTag, setSavingTag] = useState(false) 
  const [filterDonorTag, setFilterDonorTag] = useState('All')
  const DONOR_COLUMN_OPTIONS = [
    { key: 'total', label: 'Total Given' },
    { key: 'count', label: 'Donations' },
    { key: 'avg', label: 'Avg. Donation' },
    { key: 'lastDate', label: 'Last Donation' },
    { key: 'tags', label: 'Tags' },
    { key: 'milestones', label: 'Milestones' },
    { key: 'recurring', label: 'Recurring Status' },
    { key: 'pledge', label: 'Pledge Status' },
    { key: 'warmth', label: 'Relationship Warmth' },
  ]
  const DONOR_COLUMN_DEFAULTS = ['total', 'count', 'avg', 'lastDate', 'tags']
  const [selectedDonorColumns, setSelectedDonorColumns] = useState(DONOR_COLUMN_DEFAULTS)
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const toggleDonorColumn = (key) => {
    setSelectedDonorColumns(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      supabase.auth.updateUser({ data: { donor_table_columns: next } })
      return next
    })
  }
  const DONATION_COLUMN_OPTIONS = [
    { key: 'amount', label: 'Amount' },
    { key: 'date', label: 'Date' },
    { key: 'cause', label: 'Cause' },
    { key: 'source', label: 'Source' },
    { key: 'nric', label: 'NRIC' },
    { key: 'payment', label: 'Payment' },
    { key: 'receipt', label: 'Receipt' },
    { key: 'receiptNo', label: 'Receipt No.' },
    { key: 'thankYou', label: 'Thank You' },
  ]
  const DONATION_COLUMN_DEFAULTS = ['amount', 'date', 'cause', 'source', 'nric', 'payment', 'receipt', 'receiptNo', 'thankYou']
  const [selectedDonationColumns, setSelectedDonationColumns] = useState(DONATION_COLUMN_DEFAULTS)
  const [showDonationColumnPicker, setShowDonationColumnPicker] = useState(false)
  const toggleDonationColumn = (key) => {
    setSelectedDonationColumns(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      supabase.auth.updateUser({ data: { donation_table_columns: next } })
      return next
    })
  }
  const [userRole, setUserRole] = useState('volunteer')
  const [roleLoaded, setRoleLoaded] = useState(false)
  const [volunteerInput, setVolunteerInput] = useState('')
  const [showAddTeamMemberModal, setShowAddTeamMemberModal] = useState(false)
  const [newTeamMemberRole, setNewTeamMemberRole] = useState('ed')
  const [volunteerEditEntry, setVolunteerEditEntry] = useState(null)
  const [volunteerEditForm, setVolunteerEditForm] = useState({ donor_name: '', amount: '', date: '', notes: '' })
  const [savingVolunteer, setSavingVolunteer] = useState(false)
  const [localVolunteers, setLocalVolunteers] = useState([])
  const [localEds, setLocalEds] = useState([])
  const [localBoardMembers, setLocalBoardMembers] = useState([])
  const [localStaff, setLocalStaff] = useState([])
  const [monthlyExpensesRaw, setMonthlyExpensesRaw] = useState(0)
  const [customObligations, setCustomObligations] = useState([])
  const [customTasks, setCustomTasks] = useState([])
  const [showAddTask, setShowAddTask] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', date: '' })
  const [showAddObligation, setShowAddObligation] = useState(false)
  const [obligationForm, setObligationForm] = useState({ title: '', date: '', repeat: 'annual' })  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  useEffect(() => { if (isTablet) setSidebarCollapsed(true) }, [isTablet])
  const [pledges, setPledges] = useState([])
  const [showPledgeForm, setShowPledgeForm] = useState(false)
  const [pledgeForm, setPledgeForm] = useState({ donor_name: '', donor_email: '', amount: '', expected_date: '', notes: '', is_multi_year: false, total_years: '3' })
  const [pledgeInstalments, setPledgeInstalments] = useState([])
  const [grants, setGrants] = useState([])
  const [showGrantForm, setShowGrantForm] = useState(false)
  const [grantForm, setGrantForm] = useState({ funder_name: '', amount: '', purpose_restriction: '', disbursement_schedule: '', start_date: '', report_due_date: '' })
  const [recurringExpenses, setRecurringExpenses] = useState([])
  const monthlyExpenses = recurringExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const [newExpenseForm, setNewExpenseForm] = useState({ name: '', amount: '' })
  const [refunds, setRefunds] = useState([])
  const [showRefundForm, setShowRefundForm] = useState(false)
  const [refundForm, setRefundForm] = useState({ refund_amount: '', refund_date: new Date().toISOString().split('T')[0], reason: '' })
  const [grantExpenses, setGrantExpenses] = useState([])
  const [expandedGrantId, setExpandedGrantId] = useState(null)
  const [grantSearchTerm, setGrantSearchTerm] = useState('')
  const [grantYearFilter, setGrantYearFilter] = useState('All')
  const [grantAmountFilter, setGrantAmountFilter] = useState('All')
  const [highlightedGrantId, setHighlightedGrantId] = useState(null)
  const [grantUrgencyFilter, setGrantUrgencyFilter] = useState('All')
  const [grantExpenseForm, setGrantExpenseForm] = useState({ description: '', amount: '', expense_date: new Date().toISOString().split('T')[0] })
  const [pledgeError, setPledgeError] = useState('')
  const [savingPledge, setSavingPledge] = useState(false)
  const [activePledgeTab, setActivePledgeTab] = useState('pending')
  
  const [pledgeCompletionCandidate, setPledgeCompletionCandidate] = useState(null)
  const [showPledgeThankYouModal, setShowPledgeThankYouModal] = useState(false)
  const [pledgeThankYouSubject, setPledgeThankYouSubject] = useState('')
  const [pledgeThankYouBody, setPledgeThankYouBody] = useState('')
  const [sendingPledgeThankYou, setSendingPledgeThankYou] = useState(false)
  const [pledgeGivenTotals, setPledgeGivenTotals] = useState({})
  const [pledgeRescheduleHistory, setPledgeRescheduleHistory] = useState({})
  const [rescheduleModal, setRescheduleModal] = useState(null)
  const [rescheduleNewDate, setRescheduleNewDate] = useState('')
  const [rescheduleReason, setRescheduleReason] = useState('')
  const [reschedulingPledge, setReschedulingPledge] = useState(false)
  const [senderDomainStatus, setSenderDomainStatus] = useState('none')
  const [senderDomain, setSenderDomain] = useState('')
  const [senderEmailLocalPart, setSenderEmailLocalPart] = useState('hello')
  const [senderDomainInput, setSenderDomainInput] = useState('')
  const [showDomainSetup, setShowDomainSetup] = useState(false)
  const [savingDomain, setSavingDomain] = useState(false)
  const [dnsRecords, setDnsRecords] = useState(null)
  const [checkingVerification, setCheckingVerification] = useState(false)
  const [pledgeReminderHistory, setPledgeReminderHistory] = useState({})
  const [showManualPledgeLinkModal, setShowManualPledgeLinkModal] = useState(false)
  const [manualPledgeLinkSelection, setManualPledgeLinkSelection] = useState('')
  const [linkingPledgeManually, setLinkingPledgeManually] = useState(false)
  const [pledgeSearchTerm, setPledgeSearchTerm] = useState('')
  const [pledgeUrgencyFilter, setPledgeUrgencyFilter] = useState('All')
  const [pledgeAmountFilter, setPledgeAmountFilter] = useState('All')
  const [pledgeYearFilter, setPledgeYearFilter] = useState('All')
  const [massAppealSearchTerm, setMassAppealSearchTerm] = useState('')
  const [recurringYearFilter, setRecurringYearFilter] = useState('All')
  const [showCampaignModal, setShowCampaignModal] = useState(false)
  const [campaignSearchTerm, setCampaignSearchTerm] = useState('')
  const [showPastCampaigns, setShowPastCampaigns] = useState(false)
  const [showPastGrants, setShowPastGrants] = useState(false)
  const [campaignYearFilter, setCampaignYearFilter] = useState('All')
  const [expandedAppealYears, setExpandedAppealYears] = useState(() => new Set([new Date().getFullYear()]))
  const [showFulfilledPledges, setShowFulfilledPledges] = useState(false)
  const [showCancelledPledges, setShowCancelledPledges] = useState(false)
  const [showPausedRecurring, setShowPausedRecurring] = useState(false)
  const [showCancelledRecurring, setShowCancelledRecurring] = useState(false)
  const [recurringSearchTerm, setRecurringSearchTerm] = useState('')
  const [recurringUrgencyFilter, setRecurringUrgencyFilter] = useState('All')
  const [recurringAmountFilter, setRecurringAmountFilter] = useState('All')
  const [recurringTypeFilter, setRecurringTypeFilter] = useState('All')
  const [markReceivedModal, setMarkReceivedModal] = useState(null)
  const [markReceivedAmount, setMarkReceivedAmount] = useState('')
  const [markingReceived, setMarkingReceived] = useState(false)
  const [recurringGivenTotals, setRecurringGivenTotals] = useState({})
  const [lapsedReminderCandidate, setLapsedReminderCandidate] = useState(null)
  const [showLapsedReminderModal, setShowLapsedReminderModal] = useState(false)
  const [lapsedReminderSubject, setLapsedReminderSubject] = useState('')
  const [lapsedReminderBody, setLapsedReminderBody] = useState('')
  const [sendingLapsedReminder, setSendingLapsedReminder] = useState(false)
  const [lapsedReminderHistory, setLapsedReminderHistory] = useState({})
  const [lapsedDismissals, setLapsedDismissals] = useState({})
  const [showLapsedDismissModal, setShowLapsedDismissModal] = useState(null)
  const [lapsedDismissReason, setLapsedDismissReason] = useState('')
  const [lapsedDismissCategory, setLapsedDismissCategory] = useState('unknown')
  const [dismissingLapsed, setDismissingLapsed] = useState(false)
  const [showDismissedLapsedDonors, setShowDismissedLapsedDonors] = useState(false)
  const [showAllLapsedDonors, setShowAllLapsedDonors] = useState(false)
  const [showAllConcentrationDonors, setShowAllConcentrationDonors] = useState(false)
  const [showAppealPreview, setShowAppealPreview] = useState(false)
  const [sendingTestAppeal, setSendingTestAppeal] = useState(false)
  const [selectedAppealDetail, setSelectedAppealDetail] = useState(null)
  const [appealRecipients, setAppealRecipients] = useState([])
  const [loadingAppealDetail, setLoadingAppealDetail] = useState(false)
  const [showMassAppealModal, setShowMassAppealModal] = useState(false)
  const [donorContacts, setDonorContacts] = useState([])
  const [showAddDonorModal, setShowAddDonorModal] = useState(false)
  const [addDonorForm, setAddDonorForm] = useState({ full_name: '', email: '', notes: '' })
  const [donorStatusFilter, setDonorStatusFilter] = useState('All')
  const [donorYearFilter, setDonorYearFilter] = useState('All')
  const [addDonorError, setAddDonorError] = useState('')
  const [savingDonorContact, setSavingDonorContact] = useState(false)

  async function loadDonorContacts(activeSession = session) {
    const uen = activeSession?.user?.user_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase
      .from('charity_donor_contacts')
      .select('*')
      .eq('charity_uen', uen)
      .order('created_at', { ascending: false })
    if (error) { console.error('Could not load donor contacts:', error); return }
    setDonorContacts(data || [])
    const overrideMap = {}
    ;(data || []).forEach(c => {
      if (c.receipt_name_override?.trim()) {
        const key = c.email?.trim() || c.full_name
        overrideMap[key] = c.receipt_name_override.trim()
      }
    })
    setDonorReceiptNameOverrides(overrideMap)
  }
  const [massAppealYearFilter, setMassAppealYearFilter] = useState('All')
  const [allAppealRecipients, setAllAppealRecipients] = useState([])

  async function openAppealDetail(appeal) {
    setSelectedAppealDetail(appeal)
    setLoadingAppealDetail(true)
    const { data, error } = await supabase
      .from('mass_appeal_recipients')
      .select('*')
      .eq('appeal_id', appeal.id)
      .order('created_at', { ascending: true })
    if (error) { console.error('Could not load appeal recipients:', error) }
    setAppealRecipients(data || [])
    setLoadingAppealDetail(false)
  }
  const [givingChangeMinGifts, setGivingChangeMinGifts] = useState(3)
  const [givingChangeMinPct, setGivingChangeMinPct] = useState(30)
  const [showAllGivingChanges, setShowAllGivingChanges] = useState(false)
  const [givingChangeAckHistory, setGivingChangeAckHistory] = useState({})

  function buildUpgradeThankYouNote(donor, changePct, recent, prevAvg) {
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
        setLapsedReminderSubject(`Just checking in, ${d.name}`)
        setLapsedReminderBody(
          `We noticed your most recent gift was a bit different from your usual giving, and we just wanted to check in — no concerns at all, we simply value you as a supporter and wanted to make sure everything's okay on your end.\n\nYour generosity over the years has meant a lot to us, and we're grateful for your continued support in whatever way works for you.\n\nWarmly,\n${charityName}`
        )
      } else {
        setLapsedReminderSubject(`We miss you, ${d.name}!`)
        setLapsedReminderBody(
          `It's been a while since your last gift, and we wanted to reach out. Your past support of $${d.total.toLocaleString()} over ${d.count} gift${d.count !== 1 ? 's' : ''} has made a real difference, and we'd love to have you back whenever you're ready.\n\nNo pressure at all — just wanted you to know we're thinking of you.\n\nWith gratitude,\n${charityName}`
        )
      }
    }
  }, [showLapsedReminderModal, lapsedReminderCandidate])
  const [skipCycleModal, setSkipCycleModal] = useState(null)
  const [skipCycleReason, setSkipCycleReason] = useState('')
  const [skippingCycle, setSkippingCycle] = useState(false)
  const [recurringSkipHistory, setRecurringSkipHistory] = useState({})
  const [recurringReminderCandidate, setRecurringReminderCandidate] = useState(null)
  const [showRecurringReminderModal, setShowRecurringReminderModal] = useState(false)
  const [recurringReminderSubject, setRecurringReminderSubject] = useState('')
  const [recurringReminderBody, setRecurringReminderBody] = useState('')
  const [sendingRecurringReminder, setSendingRecurringReminder] = useState(false)
  const [recurringReminderHistory, setRecurringReminderHistory] = useState({})
  const [filterTopDonorNames, setFilterTopDonorNames] = useState(null)
  const [concentrationTopN, setConcentrationTopN] = useState(10)
  const [pledgeWatchThreshold, setPledgeWatchThreshold] = useState(2)
  const [recurringTrendCycles, setRecurringTrendCycles] = useState(2)
  const [recurringMissedThreshold, setRecurringMissedThreshold] = useState(2)

  const [lapsedMinGifts, setLapsedMinGifts] = useState(2)
  const [lapsedMinDays, setLapsedMinDays] = useState(60)

  useEffect(() => {
    if (showRecurringReminderModal && recurringReminderCandidate) {
      const g = recurringReminderCandidate
      setRecurringReminderSubject(`A quick note about your recurring gift to ${charityName}`)
      setRecurringReminderBody(
        `We noticed we haven't received your usual $${Number(g.amount).toLocaleString()} ${g.frequency} gift recently. This sometimes happens due to an expired card, updated bank details, or a lapsed standing instruction — nothing to worry about, just wanted to flag it in case you'd like to check on your end.\n\nThank you for your continued support.\n\nWith thanks,\n${charityName}`
      )
    }
  }, [showRecurringReminderModal, recurringReminderCandidate])
  const [pledgeResolutionModal, setPledgeResolutionModal] = useState(null)
  const [pledgeResolutionNotes, setPledgeResolutionNotes] = useState('')
  const [fulfillAmount, setFulfillAmount] = useState('')
  
  const [pledgeReminderCandidate, setPledgeReminderCandidate] = useState(null)
  const [showPledgeReminderModal, setShowPledgeReminderModal] = useState(false)
  const [pledgeReminderSubject, setPledgeReminderSubject] = useState('')
  const [pledgeReminderBody, setPledgeReminderBody] = useState('')
  const [sendingPledgeReminder, setSendingPledgeReminder] = useState(false)

  useEffect(() => {
    if (showPledgeReminderModal && pledgeReminderCandidate) {
      const p = pledgeReminderCandidate
      const daysUntil = Math.ceil((new Date(p.expected_date) - new Date()) / (1000 * 60 * 60 * 24))
      const isOverdue = daysUntil < 0
      setPledgeReminderSubject(`Following up on your pledge to ${charityName}`)
      setPledgeReminderBody(
        isOverdue
          ? `Just a friendly note — we haven't yet received your pledge of $${Number(p.amount).toLocaleString()}, which was expected by ${new Date(p.expected_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}. No rush at all, just wanted to check in. Let us know if there's anything we can help with.\n\nWith thanks,\n${charityName}`
          : `Just a friendly reminder that your pledge of $${Number(p.amount).toLocaleString()} is expected by ${new Date(p.expected_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}. Thank you again for your generosity — we're looking forward to it.\n\nWith thanks,\n${charityName}`
      )
    }
  }, [showPledgeReminderModal, pledgeReminderCandidate])
  const [recurringGifts, setRecurringGifts] = useState([])
  const [showRecurringForm, setShowRecurringForm] = useState(false)
  const [recurringForm, setRecurringForm] = useState({ donor_name: '', donor_email: '', amount: '', frequency: 'monthly', start_date: '', giro_reference: '', type: 'giro', notes: '' })
  const [recurringError, setRecurringError] = useState('')
  const [savingRecurring, setSavingRecurring] = useState(false)
  const [activeRecurringTab, setActiveRecurringTab] = useState('active')
  const [showMassAppealTool, setShowMassAppealTool] = useState(false)
  const [massAppealForm, setMassAppealForm] = useState({ cause_id: '', amount: '', message: '', customLabel: '' })
  const [massAppealRefs, setMassAppealRefs] = useState([])
  const [massAppealStep, setMassAppealStep] = useState('setup')
  const [massAppealProgress, setMassAppealProgress] = useState(null)
  const massAppealCancelRef = useRef(false)
  const [massAppeals, setMassAppeals] = useState([])
  const [selectedAppeal, setSelectedAppeal] = useState(null)
  const [showMigrationTool, setShowMigrationTool] = useState(false)
  const [migrationFile, setMigrationFile] = useState(null)
  const [migrationPreview, setMigrationPreview] = useState(null)
  const [migrationErrors, setMigrationErrors] = useState([])
  const [migrationProgress, setMigrationProgress] = useState(null)
  const [migrationComplete, setMigrationComplete] = useState(null)
  const migrationCancelRef = useRef(false)
  const [payNowQrDonation, setPayNowQrDonation] = useState(null)
  const [confirmingPayNow, setConfirmingPayNow] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [selectedDonation, setSelectedDonation] = useState(null)
  const [donationPledgeLink, setDonationPledgeLink] = useState(null)
  const [dismissedTodayItems, setDismissedTodayItems] = useState(() => {
    const todayKey = new Date().toDateString()
    const saved = localStorage.getItem('gt_dismissed_action_items')
    if (!saved) return {}
    try {
      const parsed = JSON.parse(saved)
      return parsed.date === todayKey ? parsed.items : {}
    } catch {
      return {}
    }
  })

  function dismissActionItemForToday(itemKey) {
    setDismissedTodayItems(prev => {
      const next = { ...prev, [itemKey]: true }
      localStorage.setItem('gt_dismissed_action_items', JSON.stringify({ date: new Date().toDateString(), items: next }))
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
            .select('donor_name')
            .eq('id', linkRow.pledge_id)
            .maybeSingle()
          setDonationPledgeLink({ ...linkRow, pledgeDonorName: pledgeRow?.donor_name })
        })
    } else {
      setDonationPledgeLink(null)
    }
  }, [selectedDonation?.id])
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editingImpactNoteId, setEditingImpactNoteId] = useState(null)
  const [impactNoteText, setImpactNoteText] = useState('')
  const [noteText, setNoteText] = useState('')
  const [editingManual, setEditingManual] = useState(false) 
  const [editForm, setEditForm] = useState({})
  const [nricRequestSent, setNricRequestSent] = useState({})
  const [toast, setToast] = useState(null)
  const toastTimerRef = useRef(null)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [auditLog, setAuditLog] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditActionFilter, setAuditActionFilter] = useState('All')
  const [auditDateFilter, setAuditDateFilter] = useState('30')
  const [myCauses, setMyCauses] = useState([])
  const [showCauseForm, setShowCauseForm] = useState(false)
  const [causeForm, setCauseForm] = useState({ title: '', description: '', target_amount: '', end_date: '', cost: '' })
  const [causeError, setCauseError] = useState('')
  const [savingCause, setSavingCause] = useState(false)
  const [showSponsoredForm, setShowSponsoredForm] = useState(false)
  const [sponsoredError, setSponsoredError] = useState('')
  const [savingSponsored, setSavingSponsored] = useState(false)
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false)
  const [bulkProgress, setBulkProgress] = useState(null) // { done, total }
  const bulkCancelRef = useRef(false)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetMsg, setResetMsg] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [quickEmailInput, setQuickEmailInput] = useState('')
  const [quickNricInput, setQuickNricInput] = useState('')
  const [sendingThankYouId, setSendingThankYouId] = useState(null)
  const [thankYouPreviewModal, setThankYouPreviewModal] = useState(null)
  const [thankYouCustomMessage, setThankYouCustomMessage] = useState('')
  const [charityIsIpc, setCharityIsIpc] = useState(true)
  const [charityIpcLoaded, setCharityIpcLoaded] = useState(false)
  const [annualGoal, setAnnualGoal] = useState(null)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const DEFAULT_VISIBLE_METRICS = ['total_raised', 'donor_retention', 'avg_gift', 'campaign_performance', 'monthly_trend', 'donor_highlights']
  const [visibleMetrics, setVisibleMetrics] = useState(DEFAULT_VISIBLE_METRICS)
  const [showCustomizeAnalytics, setShowCustomizeAnalytics] = useState(false)
  const [customizeMetricsDraft, setCustomizeMetricsDraft] = useState(DEFAULT_VISIBLE_METRICS)
  const [explainerOpen, setExplainerOpen] = useState(null)
  const [fyEndMonth, setFyEndMonth] = useState(12)
  const [fyEndDay, setFyEndDay] = useState(31)
  const [editingFyEnd, setEditingFyEnd] = useState(false)
  const [fyEndMonthInput, setFyEndMonthInput] = useState('12')
  const [fyEndDayInput, setFyEndDayInput] = useState('31')
  const selectedRowRef = useRef(null)
  
  const [confirmModal, setConfirmModal] = useState(null)
  const [donorBadgeAcks, setDonorBadgeAcks] = useState([])
  const [thankYouDraft, setThankYouDraft] = useState(null)
  const [dashboardDonationsPage, setDashboardDonationsPage] = useState(0)
  

  useEffect(() => {
    if (showPledgeThankYouModal && pledgeCompletionCandidate) {
      const { pledge } = pledgeCompletionCandidate
      setPledgeThankYouSubject(`Thank you for fulfilling your pledge, ${pledge.donor_name}!`)
      setPledgeThankYouBody(
        `Thank you so much for fulfilling your pledge. Your generosity and follow-through mean a great deal to us and to those we serve.\n\nWith gratitude,\n${charityName}`
      )
    }
  }, [showPledgeThankYouModal, pledgeCompletionCandidate])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
    if (session?.user?.user_metadata?.donor_table_columns) {
      setSelectedDonorColumns(session.user.user_metadata.donor_table_columns)
    }
    if (session?.user?.user_metadata?.donation_table_columns) {
      setSelectedDonationColumns(session.user.user_metadata.donation_table_columns)
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (session) {
      loadDonations(session)
      loadMyCauses()
      loadCharityIpcStatus(session)
      loadDonorBadgeAcks(session)
      loadAllDonorTags(session)
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
      loadGivingChangeAcks(session)
    }
  }, [session])

  async function loadGivingChangeAcks(activeSession = session) {
    const uen = activeSession?.user?.user_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase
      .from('giving_change_acks')
      .select('donor_key, direction, change_pct, sent_at, sent_by')
      .eq('charity_uen', uen)
      .order('sent_at', { ascending: false })
    if (error) { console.error('Could not load giving change acks:', error); return }
    const history = {}
    ;(data || []).forEach(r => {
      if (!history[r.donor_key]) history[r.donor_key] = []
      history[r.donor_key].push(r)
    })
    setGivingChangeAckHistory(history)
  }

  async function loadLapsedReminders(activeSession = session) {
    const uen = activeSession?.user?.user_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase
      .from('lapsed_donor_events')
      .select('donor_key, sent_at, sent_by')
      .eq('charity_uen', uen)
      .eq('event_type', 'reminder')
      .order('sent_at', { ascending: false })
    if (error) { console.error('Could not load lapsed reminders:', error); return }
    const history = {}
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
    const dismissals = {}
    ;(dismissData || []).forEach(d => { dismissals[d.donor_key] = d })
    setLapsedDismissals(dismissals)
  }

  async function loadCharityIpcStatus(activeSession) {
    const uen = activeSession?.user?.user_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase
      .from('charity_contacts')
      .select('ipc, annual_goal, fy_end_month, fy_end_day, visible_metrics, staff_emails, volunteer_emails, ed_emails, board_emails, monthly_expenses, custom_obligations, custom_tasks, giving_change_min_gifts, giving_change_min_pct, concentration_top_n, lapsed_min_gifts, lapsed_min_days, pledge_watch_threshold, recurring_trend_cycles, recurring_missed_threshold')
      .eq('charity_uen', uen)
      .single()
    if (error) { console.error('Could not load charity IPC status:', error); setCharityIpcLoaded(true); setRoleLoaded(true); return }
    setCharityIsIpc(data?.ipc !== false)
    setAnnualGoal(data?.annual_goal || null)
    if (Array.isArray(data?.visible_metrics)) setVisibleMetrics(data.visible_metrics)
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
      setUserRole('volunteer')
    }
    setLocalVolunteers(volunteerEmails)
    setLocalEds(edEmails)
    setLocalBoardMembers(boardEmails)
    setLocalStaff(staffEmails)
    // monthlyExpenses is now derived from recurringExpenses — no separate load needed
    setCustomObligations(data?.custom_obligations || [])
    setCustomTasks(data?.custom_tasks || [])
    setSenderDomainStatus(data?.sender_domain_status || 'none')
    setSenderDomain(data?.sender_domain || '')
    setSenderEmailLocalPart(data?.sender_email_local_part || 'hello')
    setGivingChangeMinGifts(data?.giving_change_min_gifts ?? 3)
    setGivingChangeMinPct(data?.giving_change_min_pct ?? 30)
    setConcentrationTopN(data?.concentration_top_n ?? 10)
    setPledgeWatchThreshold(data?.pledge_watch_threshold ?? 2)
    setRecurringTrendCycles(data?.recurring_trend_cycles ?? 2)
    setRecurringMissedThreshold(data?.recurring_missed_threshold ?? 2)
    setLapsedMinGifts(data?.lapsed_min_gifts ?? 2)
    setLapsedMinDays(data?.lapsed_min_days ?? 60)
    setRoleLoaded(true)
  }

  async function loadDonorBadgeAcks(activeSession = session) {
    const uen = activeSession?.user?.user_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase
      .from('donor_badge_acks')
      .select('*')
      .eq('charity_uen', uen)
    if (error) { console.error('Could not load donor badge acks:', error); return }
    setDonorBadgeAcks(data || [])
  }

  async function loadAllDonorTags(activeSession = session) {
    const uen = activeSession?.user?.user_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase
      .from('donor_tags')
      .select('*')
      .eq('charity_uen', uen)
    if (error) { console.error('Could not load donor tags:', error); return }
    const map = {}
    ;(data || []).forEach(t => {
      if (!map[t.donor_key]) map[t.donor_key] = []
      map[t.donor_key].push(t)
    })
    setDonorTagsMap(map)
  }

  const [pledgesLoaded, setPledgesLoaded] = useState(false)

  async function loadPledges(activeSession = session) {
    const uen = activeSession?.user?.user_metadata?.charity_uen
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
        .select('pledge_id, amount_applied')
        .in('pledge_id', data.map(p => p.id))
      const totals = {}
      ;(linkData || []).forEach(l => {
        totals[l.pledge_id] = (totals[l.pledge_id] || 0) + Number(l.amount_applied)
      })
      setPledgeGivenTotals(totals)

      const { data: reminderData } = await supabase
        .from('pledge_reminders')
        .select('pledge_id, sent_at, sent_by, subject')
        .in('pledge_id', data.map(p => p.id))
        .order('sent_at', { ascending: false })
      const history = {}
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
      const rescheduleHistory = {}
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
      donor_key: donorKey,
      amount: perYearAmount * years,
      expected_date: pledgeForm.expected_date,
      notes: pledgeForm.notes?.trim() || null,
      status: 'pending',
      created_by: session.user.email,
      is_multi_year: pledgeForm.is_multi_year || false,
      total_years: pledgeForm.is_multi_year ? years : null,
    }]).select()
    setSavingPledge(false)
    if (error) { setPledgeError(`Error: ${error.message}`); return }

    if (pledgeForm.is_multi_year) {
      const instalments = Array.from({ length: years }, (_, i) => ({
        pledge_id: data[0].id,
        year_number: i + 1,
        expected_date: new Date(new Date(pledgeForm.expected_date).setFullYear(new Date(pledgeForm.expected_date).getFullYear() + i)).toISOString().split('T')[0],
        amount: perYearAmount,
      }))
      const { error: instalmentError } = await supabase.from('pledge_instalments').insert(instalments)
      if (instalmentError) console.error('Error creating instalments:', instalmentError)
    }

    setPledges(prev => [...prev, data[0]].sort((a, b) => new Date(a.expected_date) - new Date(b.expected_date)))
    setPledgeForm({ donor_name: '', donor_email: '', amount: '', expected_date: '', notes: '', is_multi_year: false, total_years: '3' })
    setShowPledgeForm(false)
    showToast(pledgeForm.is_multi_year ? `${years}-year pledge recorded ✓` : 'Pledge recorded ✓')
    loadPledgeInstalments()
  }

  async function loadGrantExpenses() {
    const uen = session?.user?.user_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase.from('grant_expenses').select('*, grants!inner(charity_uen)').eq('grants.charity_uen', uen)
    if (error) { console.error('Could not load grant expenses:', error); return }
    setGrantExpenses(data || [])
  }

  async function saveGrantExpense(grantId) {
    if (!grantExpenseForm.description.trim() || !grantExpenseForm.amount) { showToast('Description and amount are required', 'error'); return }
    const { data, error } = await supabase.from('grant_expenses').insert({
      grant_id: grantId,
      description: grantExpenseForm.description.trim(),
      amount: parseFloat(grantExpenseForm.amount),
      expense_date: grantExpenseForm.expense_date,
      created_by: session.user.email,
    }).select().single()
    if (error) { showToast('Error saving expense', 'error'); return }
    setGrantExpenses(prev => [...prev, data])
    setGrantExpenseForm({ description: '', amount: '', expense_date: new Date().toISOString().split('T')[0] })
    showToast('Expense logged ✓')
  }

  async function deleteGrantExpense(id) {
    await supabase.from('grant_expenses').delete().eq('id', id)
    setGrantExpenses(prev => prev.filter(e => e.id !== id))
    showToast('Removed')
  }

  async function loadRefunds() {
    const uen = session?.user?.user_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase.from('refunds').select('*').eq('charity_uen', uen)
    if (error) { console.error('Could not load refunds:', error); return }
    setRefunds(data || [])
  }

  async function saveRefund(donation) {
    if (!refundForm.refund_amount || !refundForm.reason.trim()) { showToast('Refund amount and reason are required', 'error'); return }
    const refundAmt = parseFloat(refundForm.refund_amount)
    if (refundAmt > Number(donation.amount)) { showToast('Refund cannot exceed the original donation amount', 'error'); return }
    const { data, error } = await supabase.from('refunds').insert({
      donation_id: donation.id,
      charity_uen: charityUen,
      original_amount: donation.amount,
      refund_amount: refundAmt,
      refund_date: refundForm.refund_date,
      reason: refundForm.reason.trim(),
      approved_by: session.user.email,
    }).select().single()
    if (error) { showToast('Error recording refund', 'error'); return }
    setRefunds(prev => [...prev, data])
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'donation_refunded',
      donation_id: donation.id,
      details: { original_amount: donation.amount, refund_amount: refundAmt, reason: refundForm.reason.trim() },
    })
    setRefundForm({ refund_amount: '', refund_date: new Date().toISOString().split('T')[0], reason: '' })
    setShowRefundForm(false)
    showToast('Refund recorded ✓')
  }

  async function loadRecurringExpenses() {
    const uen = session?.user?.user_metadata?.charity_uen
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
    setRecurringExpenses(prev => [...prev, data].sort((a, b) => b.amount - a.amount))
    setNewExpenseForm({ name: '', amount: '' })
    showToast('Expense added ✓')
  }

  async function deleteRecurringExpense(id) {
    await supabase.from('recurring_expenses').delete().eq('id', id)
    setRecurringExpenses(prev => prev.filter(e => e.id !== id))
    showToast('Removed')
  }

  async function loadGrants() {
    const uen = session?.user?.user_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase.from('grants').select('*').eq('charity_uen', uen).order('report_due_date', { ascending: true })
    if (error) { console.error('Could not load grants:', error); return }
    setGrants(data || [])
  }

  async function saveGrant() {
    if (!grantForm.funder_name.trim() || !grantForm.amount) { showToast('Funder name and amount are required', 'error'); return }
    const { data, error } = await supabase.from('grants').insert({
      charity_uen: charityUen,
      funder_name: grantForm.funder_name.trim(),
      amount: parseFloat(grantForm.amount),
      purpose_restriction: grantForm.purpose_restriction?.trim() || null,
      disbursement_schedule: grantForm.disbursement_schedule?.trim() || null,
      start_date: grantForm.start_date || null,
      report_due_date: grantForm.report_due_date || null,
      status: 'active',
      created_by: session.user.email,
    }).select().single()
    if (error) { showToast('Error saving grant', 'error'); return }
    setGrants(prev => [...prev, data].sort((a, b) => new Date(a.report_due_date || '9999-12-31') - new Date(b.report_due_date || '9999-12-31')))
    setGrantForm({ funder_name: '', amount: '', purpose_restriction: '', disbursement_schedule: '', start_date: '', report_due_date: '' })
    setShowGrantForm(false)
    showToast('Grant recorded ✓')
  }

  async function loadPledgeInstalments() {
    const uen = session?.user?.user_metadata?.charity_uen
    if (!uen) return
    const { data } = await supabase.from('pledge_instalments').select('*, pledges!inner(charity_uen)').eq('pledges.charity_uen', uen)
    setPledgeInstalments(data || [])
  }

  async function confirmReschedule() {
    if (!rescheduleModal || !rescheduleNewDate) return
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

  function SenderIdentityLine({ recipientName, recipientEmail }) {
    const isVerified = senderDomainStatus === 'verified' && senderDomain
    const fromAddress = isVerified ? `${senderEmailLocalPart}@${senderDomain}` : 'Giving Tree'
    return (
      <div style={{ marginBottom: 14, background: isVerified ? '#EAF3EC' : (C.gold + '1A'), border: `1px solid ${isVerified ? C.sage : C.gold}`, borderRadius: 6, padding: '10px 12px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: isVerified ? C.sage : C.gold, marginBottom: 3 }}>
          {isVerified ? '✓' : '✉'} From: {fromAddress}
        </div>
        <div style={{ fontSize: 12.5, color: C.muted }}>
          To: {recipientName} {recipientEmail ? `(${recipientEmail})` : '(no email on file)'}
        </div>
        {!isVerified && (
          <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>Replies go to {session?.user?.email}</div>
        )}
      </div>
    )
  }

  async function sendCharityEmail(body) {
    const targetEmail = body.donor_email?.trim()
    if (targetEmail) {
      const donorKey = targetEmail
      const isBlocked = donations.some(d =>
        (d.donor_email?.trim() || d.donor_nric || d.donor_name) === donorKey && d.donor_do_not_contact
      )
      if (isBlocked) {
        console.warn(`Email blocked: ${body.donor_name || targetEmail} is marked Do Not Contact`)
        return { data: null, error: { message: 'This donor is marked as Do Not Contact — email was not sent.' } }
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
      setSenderDomainStatus('verified')
      showToast('Domain verified! 🎉 Emails will now send from your own address.')
    } else {
      showToast(`Still pending — status: ${data.status}. DNS changes can take a while to take effect.`)
    }
    setCheckingVerification(false)
  }

  function fulfillPledge(pledge) {
    setPledgeResolutionNotes('')
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

    const { data: donationData, error: donationError } = await supabase.from('donations').insert({
      donor_name: pledge.donor_name,
      donor_email: pledge.donor_email,
      amount: amount,
      payment_status: 'confirmed',
      receipt_issued: true,
      source: 'manual',
      payment_method: 'Other',
      status: 'confirmed',
      notes: pledgeResolutionNotes || 'Pledge fulfillment',
      charity_uen: charityUen,
    }).select().single()

    if (donationError) { showToast('Error recording donation', 'error'); return }

    const { error: linkError } = await supabase.from('pledge_donations').insert({
      pledge_id: pledge.id,
      donation_id: donationData.id,
      amount_applied: amount,
      created_by: session.user.email,
    })
    if (linkError) { showToast('Donation recorded, but error linking to pledge', 'error') }

    setDonations(prev => [donationData, ...prev])
    setPledgeGivenTotals(prev => ({ ...prev, [pledge.id]: (prev[pledge.id] || 0) + amount }))

    const alreadyGiven = pledgeGivenTotals[pledge.id] || 0
    const wouldReach = alreadyGiven + amount

    setPledgeResolutionModal(null)
    setPledgeResolutionNotes('')

    if (wouldReach >= Number(pledge.amount)) {
      // Fully covers the pledge — route through the existing completion flow (offers thank-you)
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
    const { error } = await sendCharityEmail({
      type: 'pledge_reminder',
      donor_name: p.donor_name,
      donor_email: p.donor_email,
      charity_name: charityName,
      charity_uen: charityUen,
      pledge_amount: Number(p.amount).toLocaleString(),
      subject_override: pledgeReminderSubject,
      custom_message: pledgeReminderBody,
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

    setSendingPledgeReminder(false)
    showToast(`Reminder sent to ${p.donor_email}`)
    setShowPledgeReminderModal(false)
    setPledgeReminderCandidate(null)
  }

  async function revertPledgeToPending(pledge) {
    setConfirmModal({
      title: 'Revert this pledge to pending?',
      description: `The pledge of $${Number(pledge.amount).toLocaleString()} from ${pledge.donor_name} will be moved back to Outstanding Pledges.`,
      confirmLabel: 'Revert to Pending',
      onConfirm: async () => {
        const { error } = await supabase.from('pledges').update({ status: 'pending' }).eq('id', pledge.id)
        if (error) { showToast('Error reverting pledge', 'error'); return }
        await supabase.from('audit_log').insert({
          actor_type: 'charity',
          actor_email: session.user.email,
          action: 'pledge_reverted_to_pending',
          details: { donor_name: pledge.donor_name, amount: pledge.amount },
        })
        setPledges(prev => prev.map(p => p.id === pledge.id ? { ...p, status: 'pending' } : p))
        showToast(`Pledge from ${pledge.donor_name} reverted to pending`)
      },
    })
  }

  function cancelPledge(pledge) {
    setPledgeResolutionNotes('')
    setPledgeResolutionModal({ type: 'cancelled', pledge })
  }

  async function loadRecurringGifts(activeSession = session) {
    const uen = activeSession?.user?.user_metadata?.charity_uen
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
      const totals = {}
      ;(linkedDonations || []).forEach(d => {
        if (!totals[d.recurring_gift_id]) totals[d.recurring_gift_id] = { total: 0, count: 0 }
        totals[d.recurring_gift_id].total += Number(d.amount)
        totals[d.recurring_gift_id].count += 1
      })
      setRecurringGivenTotals(totals)

      const { data: skipData } = await supabase
        .from('recurring_gift_events')
        .select('recurring_gift_id, skipped_cycle_date, reason, created_at')
        .eq('event_type', 'skip')
        .in('recurring_gift_id', data.map(g => g.id))
        .order('created_at', { ascending: false })
      const skips = {}
      ;(skipData || []).forEach(s => {
        if (!skips[s.recurring_gift_id]) skips[s.recurring_gift_id] = []
        skips[s.recurring_gift_id].push(s)
      })
      setRecurringSkipHistory(skips)

      const { data: reminderData } = await supabase
        .from('recurring_gift_events')
        .select('recurring_gift_id, sent_at, sent_by')
        .eq('event_type', 'reminder')
        .in('recurring_gift_id', data.map(g => g.id))
        .order('sent_at', { ascending: false })
      const reminders = {}
      ;(reminderData || []).forEach(r => {
        if (!reminders[r.recurring_gift_id]) reminders[r.recurring_gift_id] = []
        reminders[r.recurring_gift_id].push(r)
      })
      setRecurringReminderHistory(reminders)
    }
  }

  function computeNextExpectedDate(startDate, frequency, lastReceivedDate) {
    const base = lastReceivedDate ? new Date(lastReceivedDate) : new Date(startDate)
    const next = new Date(base)
    if (frequency === 'weekly')      next.setDate(next.getDate() + 7)
    else if (frequency === 'monthly') next.setMonth(next.getMonth() + 1)
    else if (frequency === 'quarterly') next.setMonth(next.getMonth() + 3)
    else if (frequency === 'annually') next.setFullYear(next.getFullYear() + 1)
    return next.toISOString().split('T')[0]
  }

  async function saveRecurringGift() {
    if (!recurringForm.donor_name.trim()) { setRecurringError('Donor name is required'); return }
    if (!recurringForm.amount || parseFloat(recurringForm.amount) <= 0) { setRecurringError('Please enter a valid amount'); return }
    if (!recurringForm.start_date) { setRecurringError('Start date is required'); return }
    setSavingRecurring(true)
    setRecurringError('')
    const donorKey = recurringForm.donor_email?.trim() || recurringForm.donor_name.trim()
    const nextExpected = computeNextExpectedDate(recurringForm.start_date, recurringForm.frequency, null)
    const { data, error } = await supabase.from('recurring_gifts').insert([{
      charity_uen: charityUen,
      donor_name: recurringForm.donor_name.trim(),
      donor_email: recurringForm.donor_email?.trim() || null,
      donor_key: donorKey,
      amount: parseFloat(recurringForm.amount),
      frequency: recurringForm.frequency,
      start_date: recurringForm.start_date,
      next_expected_date: nextExpected,
      giro_reference: recurringForm.giro_reference?.trim() || null,
      type: recurringForm.type,
      notes: recurringForm.notes?.trim() || null,
      status: 'active',
      created_by: session.user.email,
    }]).select()
    setSavingRecurring(false)
    if (error) { setRecurringError(`Error: ${error.message}`); return }
    setRecurringGifts(prev => [...prev, data[0]].sort((a, b) => new Date(a.next_expected_date) - new Date(b.next_expected_date)))
    setRecurringForm({ donor_name: '', donor_email: '', amount: '', frequency: 'monthly', start_date: '', giro_reference: '', type: 'giro', notes: '' })
    setShowRecurringForm(false)
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'recurring_gift_added',
      details: { donor_name: recurringForm.donor_name, amount: parseFloat(recurringForm.amount), frequency: recurringForm.frequency, type: recurringForm.type },
    })
    showToast('Recurring gift recorded ✓')
  }

  function markRecurringReceived(gift) {
    setMarkReceivedAmount(String(gift.amount))
    setMarkReceivedModal(gift)
  }

  async function confirmMarkReceived() {
    if (!markReceivedModal) return
    const amount = parseFloat(markReceivedAmount)
    if (!amount || amount <= 0) { showToast('Please enter a valid amount', 'error'); return }

    setMarkingReceived(true)
    const gift = markReceivedModal
    const today = new Date().toISOString().split('T')[0]
    const nextExpected = computeNextExpectedDate(gift.start_date, gift.frequency, today)

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
      notes: `Recurring ${gift.frequency} gift`,
      charity_uen: charityUen,
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
        notes: `Recurring ${gift.frequency} gift`,
      })
    }

    showToast(`$${amount.toLocaleString()} recorded ✓ · Next expected ${new Date(nextExpected).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}`)
    setMarkingReceived(false)
    setMarkReceivedModal(null)
    setMarkReceivedAmount('')
  }

  function skipRecurringCycle(gift) {
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

    setLapsedDismissals(prev => ({ ...prev, [donorKey]: inserted }))
    showToast(`${d.name} marked as not interested`)
    setDismissingLapsed(false)
    setShowLapsedDismissModal(null)
    setLapsedDismissReason('')
  }

  async function undismissLapsedDonor(donorKey) {
    const { error } = await supabase.from('lapsed_donor_events').delete().eq('charity_uen', charityUen).eq('donor_key', donorKey).eq('event_type', 'dismissal')
    if (error) { showToast('Error undoing dismissal', 'error'); return }
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
    const { error } = await sendCharityEmail({
      type: 'lapsed_donor_reminder',
      donor_name: d.name,
      donor_email: d.email,
      charity_name: charityName,
      charity_uen: charityUen,
      subject_override: lapsedReminderSubject,
      custom_message: lapsedReminderBody,
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
    }

    setSendingLapsedReminder(false)
    showToast(`Reminder sent to ${d.email}`)
    setShowLapsedReminderModal(false)
    setLapsedReminderCandidate(null)
  }

  async function pauseRecurringGift(gift) {
    setConfirmModal({
      title: 'Pause this recurring gift?',
      description: `${gift.donor_name}'s ${gift.frequency} gift of $${gift.amount.toLocaleString()} will be paused. You can reactivate it at any time.`,
      confirmLabel: 'Pause',
      onConfirm: async () => {
        const { error } = await supabase.from('recurring_gifts').update({ status: 'paused' }).eq('id', gift.id)
        if (error) { showToast('Error pausing', 'error'); return }
        setRecurringGifts(prev => prev.map(g => g.id === gift.id ? { ...g, status: 'paused' } : g))
        showToast(`${gift.donor_name}'s recurring gift paused`)
      },
    })
  }

  async function reactivateRecurringGift(gift) {
    const nextExpected = computeNextExpectedDate(gift.start_date, gift.frequency, gift.last_received_date)
    const { error } = await supabase.from('recurring_gifts').update({ status: 'active', next_expected_date: nextExpected }).eq('id', gift.id)
    if (error) { showToast('Error reactivating', 'error'); return }
    setRecurringGifts(prev => prev.map(g => g.id === gift.id ? { ...g, status: 'active', next_expected_date: nextExpected } : g))
    showToast(`${gift.donor_name}'s recurring gift reactivated ✓`)
  }

  async function cancelRecurringGift(gift) {
    setConfirmModal({
      title: 'Cancel this recurring gift?',
      description: `${gift.donor_name}'s ${gift.frequency} giving arrangement will be marked as cancelled. The record is kept for reference.`,
      confirmLabel: 'Cancel Arrangement',
      onConfirm: async () => {
        const { error } = await supabase.from('recurring_gifts').update({ status: 'cancelled' }).eq('id', gift.id)
        if (error) { showToast('Error cancelling', 'error'); return }
        setRecurringGifts(prev => prev.map(g => g.id === gift.id ? { ...g, status: 'cancelled' } : g))
        showToast('Recurring gift cancelled')
      },
    })
  }

  async function loadMassAppeals(activeSession = session) {
    const uen = activeSession?.user?.user_metadata?.charity_uen
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
    return session?.user?.user_metadata?.charity_uen || ''
  }

  function deleteCause(id) {
    if (bulkActionInProgress) { showToast('Please wait for the current action to finish', 'error'); return }
    setConfirmModal({
      title: 'Delete this campaign?',
      description: 'It will be moved to Past Campaigns. Any donations already tagged to it are kept for your records.',
      confirmLabel: 'Delete',
      onConfirm: () => deleteCauseConfirmed(id),
    })
  }

  function completeCause(c, raisedAmount) {
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

  async function completeCauseConfirmed(id) {
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

  async function restoreCause(c) {
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
  }

  async function permanentlyDeleteCause(c) {
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
      onConfirm: () => permanentlyDeleteCauseConfirmed(c.id),
    })
  }

  async function permanentlyDeleteCauseConfirmed(id) {
    setBulkActionInProgress(true)
    const { error } = await supabase.from('causes').delete().eq('id', id)
    setBulkActionInProgress(false)
    if (error) {
      showToast(error.message.includes('foreign key') ? 'Cannot delete — donations are still linked to this campaign' : 'Error deleting campaign', 'error')
      return
    }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'cause_permanently_deleted',
      details: { title: undefined, charity_uen: charityUen },
    })
    setMyCauses(prev => prev.filter(c => c.id !== id))
    showToast('Campaign permanently deleted')
  }

  async function deleteCauseConfirmed(id) {
    setBulkActionInProgress(true)
    const { error } = await supabase.from('causes').update({ status: 'deleted', active: false }).eq('id', id)
    setBulkActionInProgress(false)
    if (error) { showToast('Error deleting', 'error'); return }
    loadMyCauses()
    showToast('Submission deleted')
  }

  function startEditCause(c) {
    setCauseForm({ title: c.title, description: c.description, target_amount: c.target_amount?.toString() || '', end_date: c.end_date || '', cost: c.cost?.toString() || '', editingId: c.id })
    setShowCampaignModal(true)
  }

  function requestRevision(c) {
    startEditCause(c)
  }

  async function submitCause() {
    if (!causeForm.title.trim()) { setCauseError('Title is required'); return }
    if (!causeForm.description.trim()) { setCauseError('Description is required'); return }
    setSavingCause(true)
    setCauseError('')

    if (causeForm.editingId) {
      const { error } = await supabase.from('causes').update({
        title: causeForm.title,
        description: causeForm.description,
        target_amount: causeForm.target_amount ? parseFloat(causeForm.target_amount) : null,
        end_date: causeForm.end_date || null,
        cost: causeForm.cost ? parseFloat(causeForm.cost) : 0,
      }).eq('id', causeForm.editingId)
      setSavingCause(false)
      if (error) { setCauseError(`Error: ${error.message}`); return }
      await supabase.from('audit_log').insert({
        actor_type: 'charity',
        actor_email: session.user.email,
        action: 'cause_edited',
        details: { title: causeForm.title, charity_uen: charityUen },
      })
      setCauseForm({ title: '', description: '', target_amount: '', end_date: '' })
      setShowCauseForm(false)
      loadMyCauses()
      showToast('Submission updated ✓')
      return
    }

    const { data, error } = await supabase.from('causes').insert([{
      title: causeForm.title,
      description: causeForm.description,
      charity_name: charityName,
      charity_uen: charityUen,
      target_amount: causeForm.target_amount ? parseFloat(causeForm.target_amount) : null,
      end_date: causeForm.end_date || null,
      cost: causeForm.cost ? parseFloat(causeForm.cost) : 0,
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
    setCauseForm({ title: '', description: '', target_amount: '', end_date: '' })
    setShowCauseForm(false)
    loadMyCauses()
    showToast('Cause submitted for approval ✓')
  }

  async function submitSponsoredRequest() {
    setSavingSponsored(true)
    setSponsoredError('')
    const { data, error } = await supabase.from('causes').insert([{
      title: `${charityName} — Sponsored Spot`,
      description: `Sponsored banner request from ${charityName}.`,
      charity_name: charityName,
      charity_uen: charityUen,
      type: 'sponsored',
      status: 'pending',
      active: true,
    }]).select()
    setSavingSponsored(false)
    if (error) { setSponsoredError(`Error: ${error.message}`); return }
    supabase.functions.invoke('notify-pending-approval', { body: { title: `${charityName} — Sponsored Spot`, charity_name: charityName, type: 'sponsored', id: data[0].id } }).catch(err => console.error(err))
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'sponsored_requested',
      details: { charity_uen: charityUen },
    })
    setShowSponsoredForm(false)
    loadMyCauses()
    showToast('Sponsored banner request submitted for approval ✓')
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
    if (session && (activeTab === 'activity' || activeTab === 'dashboard')) loadAuditLog()
    setShowMobileMenu(false)
    if (session) supabase.auth.updateUser({ data: { last_active_tab: activeTab } })
  }, [session, activeTab])

  useEffect(() => {
    if (selectedDonation && selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [selectedDonation])

  useEffect(() => {
    if (selectedDonor) {
      loadDonorNotes(selectedDonor)
    } else {
      setDonorNotes([])
    }
  }, [selectedDonor])

  async function loadDonorNotes(donor) {
    setDonorNotesLoading(true)
    const donorKey = donor.email?.trim() || donor.name
    const { data, error } = await supabase
      .from('donor_notes')
      .select('*')
      .eq('charity_uen', charityUen)
      .eq('donor_key', donorKey)
      .order('created_at', { ascending: false })
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
    setDonorNotes(prev => [data[0], ...prev])
    setNewNoteText('')
    setNewNoteType('note')
    setSavingNote(false)
    showToast('Note saved ✓')
  }

  async function deleteDonorNote(noteId) {
    const { error } = await supabase.from('donor_notes').delete().eq('id', noteId)
    if (error) { showToast('Error deleting note', 'error'); return }
    setDonorNotes(prev => prev.filter(n => n.id !== noteId))
    showToast('Note deleted')
  }

  async function saveDonorTag(donor) {
    if (!newTagInput.trim()) return
    setSavingTag(true)
    const donorKey = donor.email?.trim() || donor.name
    const tag = newTagInput.trim()
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
    setDonorTagsMap(prev => ({
      ...prev,
      [donorKey]: [...(prev[donorKey] || []), data[0]],
    }))
    setNewTagInput('')
    setSavingTag(false)
    showToast('Tag added ✓')
  }

  async function deleteDonorTag(donor, tagId) {
    const donorKey = donor.email?.trim() || donor.name
    const { error } = await supabase.from('donor_tags').delete().eq('id', tagId)
    if (error) { showToast('Error removing tag', 'error'); return }
    setDonorTagsMap(prev => ({
      ...prev,
      [donorKey]: (prev[donorKey] || []).filter(t => t.id !== tagId),
    }))
    showToast('Tag removed')
  }

  function parseMigrationCSV(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) return { headers: [], rows: [] }
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
    const rows = lines.slice(1).map(line => {
      // Handle quoted fields with commas inside
      const fields = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') { inQuotes = !inQuotes; continue }
        if (line[i] === ',' && !inQuotes) { fields.push(current.trim()); current = ''; continue }
        current += line[i]
      }
      fields.push(current.trim())
      const obj = {}
      headers.forEach((h, i) => { obj[h] = fields[i] || '' })
      return obj
    })
    return { headers, rows }
  }

  function detectMigrationColumn(headers, candidates) {
    for (const candidate of candidates) {
      const match = headers.find(h => h.includes(candidate.toLowerCase()))
      if (match) return match
    }
    return null
  }

  function previewMigrationFile(file) {
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
      const validRows = []
      const rowErrors = []
      rows.forEach((row, i) => {
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
      const inserts = batch.map(row => ({
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

  function generateAppealRef(donorName, causeId) {
    const clean = donorName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase()
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase()
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
      if (d.deactivated || !d.email?.trim()) return false
      if (massAppealForm.targetTag && massAppealForm.targetTag !== 'All') {
        const donorKey45 = d.email?.trim() || d.name
        const tags45 = donorTagsMap[donorKey45] || []
        return tags45.some(t => t.tag === massAppealForm.targetTag)
      }
      return true
    })
    if (targetDonors.length === 0) {
      showToast('No donors with email addresses found', 'error'); return
    }
    // Regenerate with consistent refs
    const finalRefs = targetDonors.map(donor => {
      const ref = generateAppealRef(donor.name, massAppealForm.cause_id)
      const donorKey44b = donor.email?.trim() || donor.name
      const contact44b = donorContacts.find(c => (c.email?.trim() || c.full_name) === donorKey44b)
      const restrictions44b = contact44b?.communication_restrictions?.toLowerCase() || ''
      const flaggedRestricted = /no mass|no appeal|do not send appeal|no bulk/.test(restrictions44b)
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
        await supabase.from('mass_appeal_recipients').insert({
          appeal_id: appealId,
          donor_name: donor.donor_name,
          donor_email: donor.donor_email,
          amount: donor.amount,
          payment_ref: donor.ref,
          status: recipientStatus,
          error_message: error?.message || null,
        })
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
      const { data: updatedAppeal } = await supabase.from('mass_appeals').update({
        sent_count: sent,
        failed_count: failed,
        status: 'sent',
      }).eq('id', appealId).select()
      if (updatedAppeal?.[0]) setMassAppeals(prev => [updatedAppeal[0], ...prev.filter(a => a.id !== appealId)])
    }

    setMassAppealStep('done')
    setMassAppealProgress(null)
    showToast(`Appeal sent to ${sent} donor${sent !== 1 ? 's' : ''}${failed > 0 ? ` · ${failed} failed` : ''} ✓`)
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

    const svgToPngDataUrl = (svgString, size = 300) => new Promise((resolve) => {
      const img = new Image()
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
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
    const csvLines = [
      'Donor Name,Email,Amount,Reference,PayNow URL',
      ...selected.map(d => `"${d.donor_name}","${d.donor_email}",${d.amount},"${d.ref}","${d.qrValue}"`),
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
      .eq('charity_uen', activeSession.user.user_metadata.charity_uen)  
      .not('status', 'in', '(cancelled_by_donor,deleted_by_charity)')
      .order('created_at', { ascending: false })
    if (error) { console.error(error); return }
    setDonations(data)
    setSelectedDonationIds(prev => prev.filter(id => data.some(d => d.id === id)))
    setLoading(false)
  } 

  async function checkPledgeCompletion(donation) {
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
    const { error: linkError } = await supabase.from('pledge_donations').insert({
      pledge_id: matchingPledge.id,
      donation_id: donation.id,
      amount_applied: donation.amount,
      created_by: session.user.email,
    })
    if (linkError) { console.error('Could not link donation to pledge:', linkError); return null }

    setPledgeGivenTotals(prev => ({
      ...prev,
      [matchingPledge.id]: (prev[matchingPledge.id] || 0) + Number(donation.amount)
    }))

    if (wouldReach >= Number(matchingPledge.amount)) {
      return matchingPledge
    }
    return null
  }

  async function manuallyLinkDonationToPledge(donation, pledgeId) {
    setLinkingPledgeManually(true)
    const pledge = pledges.find(p => p.id === pledgeId)
    if (!pledge) { showToast('Pledge not found', 'error'); setLinkingPledgeManually(false); return }

    const { data: existingLink } = await supabase
      .from('pledge_donations')
      .select('pledge_id, pledges(donor_name)')
      .eq('donation_id', donation.id)
      .maybeSingle()

    if (existingLink) {
      const alreadyLinkedTo = existingLink.pledge_id === pledge.id ? 'this same pledge' : `${existingLink.pledges?.donor_name || 'a different'} pledge`
      showToast(`This donation is already linked to ${alreadyLinkedTo} — not linking again`, 'error')
      setLinkingPledgeManually(false)
      setShowManualPledgeLinkModal(false)
      return
    }

    const { error: linkError } = await supabase.from('pledge_donations').insert({
      pledge_id: pledge.id,
      donation_id: donation.id,
      amount_applied: donation.amount,
      created_by: session.user.email,
    })
    if (linkError) { showToast('Error linking donation to pledge', 'error'); setLinkingPledgeManually(false); return }

    setPledgeGivenTotals(prev => ({
      ...prev,
      [pledge.id]: (prev[pledge.id] || 0) + Number(donation.amount)
    }))

    const { data: existingLinks } = await supabase
      .from('pledge_donations')
      .select('amount_applied')
      .eq('pledge_id', pledge.id)
    const total = (existingLinks || []).reduce((s, l) => s + Number(l.amount_applied), 0)

    if (total >= Number(pledge.amount)) {
      setPledgeCompletionCandidate({ pledge, donation })
      setShowPledgeThankYouModal(true)
      showToast(`Linked — this completes ${pledge.donor_name}'s pledge!`)
    } else {
      showToast(`Linked $${Number(donation.amount).toLocaleString()} to ${pledge.donor_name}'s pledge`)
    }

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

    const { error: emailError } = await sendCharityEmail({
      type: 'pledge_thank_you',
      donor_name: donation.donor_name,
      donor_email: donation.donor_email,
      charity_name: charityName,
      charity_uen: charityUen,
      pledge_amount: Number(pledge.amount).toLocaleString(),
      subject_override: pledgeThankYouSubject,
      custom_message: pledgeThankYouBody,
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

    showToast('Pledge marked fulfilled')
    setShowPledgeThankYouModal(false)
    setPledgeCompletionCandidate(null)
  }

  const [duplicateDonationWarning, setDuplicateDonationWarning] = useState(null)

  async function confirmPaymentFlow(donation) {
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
      setSelectedDonation(prev => (prev && prev.id === donation.id ? { ...prev, payment_status: 'confirmed', receipt_issued: true } : prev))
      return
    }

    if (!donation.duplicateConfirmed) {
      const donorKey22 = donation.donor_email?.trim() || donation.donor_nric || donation.donor_name
      const fiveMinWindow = 5 * 60 * 1000
      const possibleDupe = donations.find(d =>
        d.id !== donation.id &&
        (d.donor_email?.trim() || d.donor_nric || d.donor_name) === donorKey22 &&
        Number(d.amount) === Number(donation.amount) &&
        Math.abs(new Date(d.created_at) - new Date(donation.created_at)) <= fiveMinWindow
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

    const updatePayload = { payment_status: 'confirmed', receipt_issued: true }
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
    setSelectedDonation(prev => (prev && prev.id === donation.id ? { ...prev, payment_status: 'confirmed', receipt_issued: true } : prev))

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

  function buildThankYouPreviewHtml(donation, customMessage) {
    const badgeInfo = donationBadgeInfo[donation.id]
    const isRecurring = !!donation.recurring_gift_id
    const templateType = donation.amount > thankYouThreshold ? 'major_gift'
      : isRecurring ? 'recurring_donor'
      : badgeInfo?.isFirstTime ? 'new_donor'
      : 'standard'
    const amount = Number(donation.amount).toLocaleString()
    const causeTitle = causeNameForDonation(donation)
    const dateStr = new Date(donation.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })
    const customBlock = customMessage?.trim()
      ? `<p style="font-size:13px;color:#1C1C1C;line-height:1.6;margin:10px 0;">${customMessage.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
      : ''

    if (templateType === 'major_gift') {
      return `
        <div style="background:#1B4332;border-radius:12px;padding:22px;text-align:center;margin-bottom:16px;">
          <div style="font-size:28px;margin-bottom:6px;">🌳</div>
          <div style="font-size:17px;font-weight:700;color:white;">A Gift That Changes Things</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:4px;">Thank you, ${donation.donor_name}, for your extraordinary generosity</div>
        </div>
        <div style="background:white;border-radius:12px;padding:16px;border:1px solid #E2D9CC;">
          <p style="font-size:13px;color:#1C1C1C;line-height:1.6;">A gift of this size doesn't just help — it changes what we're able to do. On behalf of everyone at ${charityName}, thank you.</p>
          ${customBlock}
          <div style="display:flex;justify-content:space-between;margin-top:10px;font-size:13px;"><span style="color:#7A6E62;">Amount</span><span style="font-weight:700;color:#40916C;">SGD $${amount}</span></div>
          ${causeTitle ? `<div style="display:flex;justify-content:space-between;margin-top:6px;font-size:13px;"><span style="color:#7A6E62;">Cause</span><span style="font-weight:700;color:#D4A017;">🎯 ${causeTitle}</span></div>` : ''}
        </div>`
    }
    if (templateType === 'new_donor') {
      return `
        <div style="background:#1B4332;border-radius:12px;padding:22px;text-align:center;margin-bottom:16px;">
          <div style="font-size:17px;font-weight:700;color:white;">Welcome, ${donation.donor_name}!</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:4px;">Thank you for your first gift to ${charityName}</div>
        </div>
        <div style="background:white;border-radius:12px;padding:16px;border:1px solid #E2D9CC;">
          <p style="font-size:13px;color:#1C1C1C;line-height:1.6;">Your first gift means more than the number on this receipt — it's the start of you becoming part of our story. Thank you for your gift of <strong>SGD $${amount}</strong>.</p>
          ${customBlock}
          ${causeTitle ? `<p style="font-size:13px;color:#1C1C1C;">Your gift went toward: <strong style="color:#D4A017;">🎯 ${causeTitle}</strong></p>` : ''}
        </div>`
    }
    if (templateType === 'recurring_donor') {
      return `
        <div style="background:#1B4332;border-radius:12px;padding:22px;text-align:center;margin-bottom:16px;">
          <div style="font-size:17px;font-weight:700;color:white;">Thank You for Your Continued Support</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:4px;">${donation.donor_name}, your steady giving makes a real difference</div>
        </div>
        <div style="background:white;border-radius:12px;padding:16px;border:1px solid #E2D9CC;">
          <p style="font-size:13px;color:#1C1C1C;line-height:1.6;">Reliable, ongoing support like yours is what lets us plan ahead with confidence. Thank you for another gift of <strong>SGD $${amount}</strong>.</p>
          ${customBlock}
        </div>`
    }
    return `
      <div style="background:#1B4332;border-radius:12px;padding:22px;text-align:center;margin-bottom:16px;">
        <div style="font-size:17px;font-weight:700;color:white;">Thank You, ${donation.donor_name}!</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:4px;">Your generosity makes a difference</div>
      </div>
      <div style="background:white;border-radius:12px;padding:16px;border:1px solid #E2D9CC;margin-bottom:16px;">
        <p style="font-size:13px;color:#1C1C1C;line-height:1.6;margin:0;">We don't say this often enough: thank you. Not just for this gift, but for choosing to keep giving. Consistent support like yours is what lets us plan further ahead and take on more than we could with one-off gifts alone.</p>
      </div>
      ${customBlock ? `<div style="background:white;border-radius:12px;padding:14px;border:1px solid #E2D9CC;margin-bottom:12px;">${customBlock}</div>` : ''}
      <div style="background:white;border-radius:12px;padding:16px;border:1px solid #E2D9CC;">
        <div style="font-size:11px;color:#7A6E62;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;font-weight:600;">Donation Details</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;"><span style="color:#7A6E62;">Charity</span><span style="font-weight:700;color:#1B4332;">${charityName}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;"><span style="color:#7A6E62;">Amount</span><span style="font-weight:700;color:#40916C;">SGD $${amount}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;"><span style="color:#7A6E62;">Date</span><span style="font-weight:700;color:#1B4332;">${dateStr}</span></div>
        ${causeTitle ? `<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:13px;"><span style="color:#7A6E62;">Cause</span><span style="font-weight:700;color:#D4A017;">🎯 ${causeTitle}</span></div>` : ''}
      </div>`
  }

  async function sendThankYouEmail(donation) {
    if (sendingThankYouId === donation.id) return
    setSendingThankYouId(donation.id)
    let receiptAttachmentB64b = null
    try { receiptAttachmentB64b = getReceiptPDFBase64(donation) } catch (e) { console.error('Could not generate receipt PDF for attachment:', e) }

    const badgeInfoSend = donationBadgeInfo[donation.id]
    const isRecurringSend = !!donation.recurring_gift_id
    const templateTypeSend = donation.amount > thankYouThreshold ? 'major_gift'
      : isRecurringSend ? 'recurring_donor'
      : badgeInfoSend?.isFirstTime ? 'new_donor'
      : 'standard'

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
      receipt_filename: `Receipt-${donation.payment_ref || donation.receipt_number || donation.id}.pdf`,
      thank_you_template: templateTypeSend,
      custom_message: thankYouCustomMessage?.trim() || null,
    })
    if (error) { showToast('Failed to send email', 'error'); setSendingThankYouId(null); return }
    setThankYouCustomMessage('')
    await supabase.from('donations').update({ thank_you_sent: true }).eq('id', donation.id)
    setDonations(prev => prev.map(x => x.id === donation.id ? { ...x, thank_you_sent: true } : x))
    setSelectedDonation(prev => (prev && prev.id === donation.id ? { ...prev, thank_you_sent: true } : prev))
    setSendingThankYouId(null)
    showToast(`Email sent to ${donation.donor_email}`)
  }

  async function issueReceipt(donation, skipLog = false, sendEmail = false) {
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
        receipt_filename: `Receipt-${donation.payment_ref || donation.receipt_number || donation.id}.pdf`,
      })
      if (!emailError) {
        await supabase.from('donations').update({ thank_you_sent: true }).eq('id', donation.id)
        setDonations(prev => prev.map(d => d.id === donation.id ? { ...d, thank_you_sent: true } : d))
      }
    }
    setIssuing(null)
  }

  async function voidAndReissueReceipt(donation) {
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

    // Step 2 — generate new sequential receipt number
    const entryYear = new Date(donation.created_at).getFullYear()
    const { count, error: countError } = await supabase
      .from('donations')
      .select('id', { count: 'exact', head: true })
      .eq('charity_uen', charityUen)
      .eq('source', 'manual')
      .gte('created_at', `${entryYear}-01-01`)
      .lt('created_at', `${entryYear + 1}-01-01`)
    if (countError) { showToast('Error generating new receipt number', 'error'); setVoidingReceipt(false); return }
    const newReceiptNumber = `MR-${entryYear}-${String((count || 0) + 1).padStart(6, '0')}`

    // Step 3 — issue new receipt with corrected number
    const { error: reissueError } = await supabase.from('donations').update({
      receipt_issued: true,
      receipt_number: newReceiptNumber,
      reissued_from: donation.receipt_number || donation.payment_ref,
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
    } : x))
    setSelectedDonation(prev => prev && prev.id === donation.id ? {
      ...prev,
      receipt_voided: true,
      receipt_issued: true,
      receipt_number: newReceiptNumber,
      reissued_from: donation.receipt_number || donation.payment_ref,
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
      const awaitingConfirmation = yearScoped.filter(d => !d.receipt_issued && d.payment_status !== 'confirmed').length
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

    const byDonor = {}
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

  async function sendBulkNricRequest(donorList, missingNoEmail) {
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

  function clearDonationFilters(opts = {}) {
    setSearchTerm('')
    setFilterType('All')  
    setFilterNric('All')
    if (!opts.keepYear) setFilterYear('All')
    setFilterSource('All')
    setFilterThankYou('All')
    setSelectedDonationIds([])
    setDonationSortBy(null)
    setDonationSortDir('desc')
    setBulkEditMode(false)
  }

  function goToDonation(donation) {
    if (bulkActionInProgress) { showToast('Please wait for the current bulk action to finish', 'error'); return }
    const hadActiveFilters = activeDonationFilterCount > 0
    clearDonationFilters()
    setSelectedDonation(donation)
    setQuickEmailInput('')
    setQuickNricInput('')
    setActiveTab('donations') 
    if (hadActiveFilters) showToast('Filters cleared to show this donation')
  }

  async function ensureDonorContact(donor) {
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

  async function linkDonorToHousehold(donorA, donorB) {
    const contactA = await ensureDonorContact(donorA)
    const contactB = await ensureDonorContact(donorB)
    if (!contactA || !contactB) { showToast('Error linking donors', 'error'); return }

    const householdId = contactA.household_id || contactB.household_id || crypto.randomUUID()
    await supabase.from('charity_donor_contacts').update({ household_id: householdId }).eq('id', contactA.id)
    await supabase.from('charity_donor_contacts').update({ household_id: householdId }).eq('id', contactB.id)

    showToast(`Linked ${donorA.name} and ${donorB.name} as a household ✓`)
    await loadDonorContacts()
  }

  async function unlinkFromHousehold(donor) {
    const key = donor.email?.trim() || donor.name
    const contact = donorContacts.find(c => (c.email?.trim() || c.full_name) === key)
    if (!contact) return
    await supabase.from('charity_donor_contacts').update({ household_id: null }).eq('id', contact.id)
    showToast('Removed from household')
    await loadDonorContacts()
  }

  function getDonorWarmth(donor) {
    const donorKey76 = donor.email?.trim() || donor.name
    const myNotes76 = donorNotes.filter(n => n.donor_key === donorKey76).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const lastContact76 = myNotes76[0]?.created_at || null
    if (!lastContact76) return { level: 'red', label: 'No contact logged', daysSince: null }
    const daysSince76 = Math.floor((new Date() - new Date(lastContact76)) / (1000 * 60 * 60 * 24))
    if (daysSince76 <= 90) return { level: 'green', label: `Contacted ${daysSince76}d ago`, daysSince: daysSince76 }
    if (daysSince76 <= 180) return { level: 'amber', label: `Contacted ${daysSince76}d ago`, daysSince: daysSince76 }
    return { level: 'red', label: `Contacted ${daysSince76}d ago`, daysSince: daysSince76 }
  }

  async function mergeDonorInto(sourceDonor, targetDonorKey) {
    const sourceKey = sourceDonor.email?.trim() || sourceDonor.name
    const targetDonorRow = combinedDonorList.find(d => (d.email?.trim() || d.name) === targetDonorKey)
    if (!targetDonorRow) { showToast('Target donor not found', 'error'); return }

    const { error } = await supabase.from('donations')
      .update({ donor_name: targetDonorRow.name, donor_email: targetDonorRow.email || null })
      .or(sourceDonor.email?.trim() ? `donor_email.eq.${sourceDonor.email.trim()}` : `donor_name.eq.${sourceDonor.name}`)
    if (error) { showToast('Error merging donors', 'error'); return }

    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'donors_merged',
      details: { merged_from: sourceDonor.name, merged_into: targetDonorRow.name },
    })

    showToast(`Merged ${sourceDonor.name} into ${targetDonorRow.name} ✓`)
    setSelectedDonor(null)
    await loadDonations()
  }

  async function saveManualEntry() {
  if (!manualForm.is_anonymous && !manualForm.donor_name) { setManualError('Donor name is required'); return }
  if (!manualForm.amount || parseFloat(manualForm.amount) <= 0) { setManualError('Please enter a valid amount'); return }
  if (new Date(manualForm.date) > new Date()) { setManualError('Donation date cannot be in the future'); return }
  if (new Date(manualForm.date) < new Date('2020-01-01')) { setManualError('Donation date seems too far in the past — please check it'); return }
  if (manualForm.donor_nric && !/^[A-Z]\d{7}[A-Z]$/i.test(manualForm.donor_nric.trim())) { setManualError('Invalid NRIC format. Should be like S1234567A'); return }
  if (manualForm.donor_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(manualForm.donor_email.trim())) { setManualError('Invalid email format'); return }

  // Duplicate detection — match on email, NRIC, or (only when neither is present) exact name
  if (!manualForm.is_anonymous && !manualForm.duplicateConfirmed) {
    const enteredEmail = manualForm.donor_email?.trim().toLowerCase()
    const enteredNric = manualForm.donor_nric?.trim().toUpperCase()
    const enteredName = manualForm.donor_name.trim().toLowerCase()

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
    // Backstop: no email and no NRIC entered — fall back to exact name match only
    if (matchedDonors.length === 0 && !enteredEmail && !enteredNric) {
      matchedDonors = donorList.filter(d => d.name.trim().toLowerCase() === enteredName)
      if (matchedDonors.length > 0) matchedOn = 'name (exact)'
    }

    if (matchedDonors.length > 0) {
      setManualError('')
      setManualDuplicateWarning({ donors: matchedDonors, matchedOn })
      return
    }
  }

  setSavingManual(true)
  setManualError('')
  setManualDuplicateWarning(null)
    const entryYear = new Date(manualForm.date).getFullYear()
    const { data: existingReceipts, error: countError } = await supabase
      .from('donations')
      .select('receipt_number')
      .eq('charity_uen', charityUen)
      .like('receipt_number', `MR-${entryYear}-%`)
    if (countError) { console.error('Could not generate receipt number:', countError); setManualError('Error generating receipt number. Please try again.'); setSavingManual(false); return }
    const maxSeq = (existingReceipts || []).reduce((max, d) => {
      const parts = d.receipt_number?.split('-')
      const seq = parts?.length === 3 ? parseInt(parts[2]) : 0
      return seq > max ? seq : max
    }, 0)
    const receiptNumber = `MR-${entryYear}-${String(maxSeq + 1).padStart(6, '0')}`
    let { data, error } = await supabase.from('donations').insert([{
      donor_name: manualForm.is_anonymous ? 'Anonymous' : manualForm.donor_name,
      donor_nric: manualForm.donor_nric ? manualForm.donor_nric.trim().toUpperCase() : manualForm.donor_nric,
      charity_name: charityName,
      charity_uen: charityUen,
      cause_id: manualForm.cause_id || null,
      amount: parseFloat(manualForm.amount),
      status: 'awaiting_donor_confirmation',
      payment_status: 'pending',
      receipt_issued: false,
      source: 'manual',
      payment_method: manualForm.payment_method,
      notes: manualForm.notes,
      donor_email: manualForm.is_anonymous ? null : (manualForm.donor_email?.trim().toLowerCase() || null),
      created_at: manualForm.date,
      receipt_number: receiptNumber,
      receipt_name: manualForm.receipt_name?.trim() || null,
      is_anonymous: manualForm.is_anonymous || false,
      acquisition_source: manualForm.acquisition_source || null,
      referred_by_donor_key: manualForm.referred_by_donor_key || null,
      created_by: session.user.email,
    }]).select()
    if (error && error.code === '23505') {
      // Receipt number collision (concurrent entry) — retry once with next sequence number
      const { data: retryReceipts, error: retryCountError } = await supabase
        .from('donations')
        .select('receipt_number')
        .eq('charity_uen', charityUen)
        .like('receipt_number', `MR-${entryYear}-%`)
      if (retryCountError) { console.error('Retry count failed:', retryCountError); setManualError('Error saving: receipt number conflict, please try again'); setSavingManual(false); return }
      const retryMaxSeq = (retryReceipts || []).reduce((max, d) => {
        const parts = d.receipt_number?.split('-')
        const seq = parts?.length === 3 ? parseInt(parts[2]) : 0
        return seq > max ? seq : max
      }, 0)
      const retryReceiptNumber = `MR-${entryYear}-${String(retryMaxSeq + 1).padStart(6, '0')}`
      const retryResult = await supabase.from('donations').insert([{
        donor_name: manualForm.donor_name,
        donor_nric: manualForm.donor_nric ? manualForm.donor_nric.trim().toUpperCase() : manualForm.donor_nric,
        charity_name: charityName,
        charity_uen: charityUen,
        cause_id: manualForm.cause_id || null,
        amount: parseFloat(manualForm.amount),
        status: 'confirmed',
        payment_status: 'confirmed',
        receipt_issued: true,
        source: 'manual',
        payment_method: manualForm.payment_method,
        notes: manualForm.notes,
        donor_email: manualForm.donor_email,
        created_at: manualForm.date,
        receipt_number: retryReceiptNumber,
      }]).select()
      data = retryResult.data
      error = retryResult.error
    }
    if (error) {
      console.error('Manual entry insert error:', error)
      if (error.code === '23505') {
        setManualError('Receipt number conflict happened twice in a row — please try saving again.')
      } else {
        setManualError(`Error saving: ${error.message}`)
      }
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
    setManualForm({ donor_name: '', donor_nric: '', amount: '', payment_method: 'Cash', notes: '', donor_email: '', date: new Date().toISOString().split('T')[0], cause_id: '', receipt_name: '', duplicateConfirmed: false })
    setShowManualForm(false)
    setSavingManual(false)
  }

  async function generatePayNowEntry() {
    if (!manualForm.donor_name) { setManualError('Donor name is required'); return }
    if (!manualForm.amount || parseFloat(manualForm.amount) <= 0) { setManualError('Please enter a valid amount'); return }
    if (new Date(manualForm.date) > new Date()) { setManualError('Donation date cannot be in the future'); return }
    if (manualForm.donor_nric && !/^[A-Z]\d{7}[A-Z]$/i.test(manualForm.donor_nric.trim())) { setManualError('Invalid NRIC format. Should be like S1234567A'); return }
    if (manualForm.donor_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(manualForm.donor_email.trim())) { setManualError('Invalid email format'); return }
    setSavingManual(true)
    setManualError('')
    const ref = 'GT' + Math.random().toString(36).substring(2, 10).toUpperCase()
    const { data, error } = await supabase.from('donations').insert([{
      donor_name: manualForm.donor_name,
      donor_nric: manualForm.donor_nric ? manualForm.donor_nric.trim().toUpperCase() : manualForm.donor_nric,
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
      donor_email: manualForm.donor_email,
      created_at: manualForm.date,
      payment_ref: ref,
    }]).select()
    setSavingManual(false)
    if (error) { setManualError(`Error saving: ${error.message}`); return }
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
  }

  async function confirmManualPayNow() {
    if (!payNowQrDonation || confirmingPayNow) return
    setConfirmingPayNow(true)
    await confirmPaymentFlow(payNowQrDonation)
    setConfirmingPayNow(false)
    setPayNowQrDonation(null)
    setManualForm({ donor_name: '', donor_nric: '', amount: '', payment_method: 'Cash', notes: '', donor_email: '', date: new Date().toISOString().split('T')[0], cause_id: '' })
  }

  async function deleteDonation(id) {
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
        .select('donor_name, status')
        .eq('id', linkRow.pledge_id)
        .maybeSingle()
      if (pledgeErr) console.error('Error fetching pledge for link warning:', pledgeErr)
      pledgeLink = { ...linkRow, pledgeDonorName: pledgeRow?.donor_name, pledgeStatus: pledgeRow?.status }
    }

    let description = donationToDelete?.receipt_issued
      ? 'This entry already has a receipt issued. The record will be kept for audit purposes but removed from your active lists.'
      : 'The record will be kept for audit purposes but removed from your active lists.'

    if (pledgeLink) {
      description = `⚠ This donation is linked to ${pledgeLink.pledgeDonorName || 'a'}'s pledge ($${Number(pledgeLink.amount_applied).toLocaleString()} applied). Deleting it will unlink it from that pledge and reduce the pledge's given-total accordingly${pledgeLink.pledgeStatus === 'fulfilled' ? '. Since this pledge was marked fulfilled by this donation, it will also revert to pending.' : '.'}`
    }

    setConfirmModal({
      title: donationToDelete?.receipt_issued ? 'Delete this entry anyway?' : 'Delete this manual entry?',
      description,
      confirmLabel: 'Delete',
      onConfirm: () => deleteDonationConfirmed(id, pledgeLink),
    })
  }

  async function deleteDonationConfirmed(id, pledgeLink = null) {
    const donationToDelete = donations.find(d => d.id === id)
    const originalStatus = donationToDelete?.status || 'confirmed'
    setDeletingId(id)
    const { error } = await supabase.from('donations').update({ status: 'deleted_by_charity' }).eq('id', id)
    if (error) { console.error(error); setDeletingId(null); return }

    if (pledgeLink) {
      await supabase.from('pledge_donations').delete().eq('pledge_id', pledgeLink.pledge_id).eq('donation_id', id)
      setPledgeGivenTotals(prev => ({
        ...prev,
        [pledgeLink.pledge_id]: Math.max(0, (prev[pledgeLink.pledge_id] || 0) - Number(pledgeLink.amount_applied))
      }))
      if (pledgeLink.pledgeStatus === 'fulfilled') {
        await supabase.from('pledges').update({ status: 'pending' }).eq('id', pledgeLink.pledge_id)
        setPledges(prev => prev.map(p => p.id === pledgeLink.pledge_id ? { ...p, status: 'pending' } : p))
      }
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

  function causeNameForDonation(donation) {
    if (!donation?.cause_id) return null
    const c = myCauses.find(c => c.id === donation.cause_id)
    return c ? c.title : null
  }

  const charityName  = session?.user?.user_metadata?.charity_name || 'Your Charity'
  const charityUen   = session?.user?.user_metadata?.charity_uen  || ''
  const totalAllTime = donations.reduce((s, d) => s + d.amount, 0)
  const totalThisYear = filterYear === 'All'
    ? donations.filter(d => d.payment_status === 'confirmed').reduce((s, d) => s + d.amount, 0)
    : donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear) && d.payment_status === 'confirmed').reduce((s, d) => s + d.amount, 0)
  const pendingCount = donations.filter(d => !d.receipt_issued && d.payment_status === 'confirmed').length
  const pendingCountForYear = (filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).toLocaleDateString('en-SG', { year: 'numeric' }) === filterYear)).filter(d => !d.receipt_issued && d.payment_status === 'confirmed').length
  const unconfirmedCount = donations.filter(d => d.payment_status !== 'confirmed').length
const unconfirmedCountForYear = (filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).toLocaleDateString('en-SG', { year: 'numeric' }) === filterYear)).filter(d => d.payment_status !== 'confirmed').length
  const missingNricThisYear = (filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear)))
    .filter(d => !d.donor_nric && d.payment_status === 'confirmed').length
  const dashboardCurrentYear = new Date().getFullYear()
  const dashboardDonationsThisYear = donations.filter(d => new Date(d.created_at).getFullYear() === dashboardCurrentYear)
  const dashboardConfirmedTotal = dashboardDonationsThisYear.filter(d => d.payment_status === 'confirmed').reduce((s, d) => s + d.amount, 0)
  const dashboardUniqueDonors = [...new Set(dashboardDonationsThisYear.map(d => d.donor_name))].length
  const dashboardMissingNric = dashboardDonationsThisYear.filter(d => !d.donor_nric && d.payment_status === 'confirmed').length
  const failedNotifications = auditLog.filter(e => e.action === 'charity_notification_failed').length
  const actionItems = [
    unconfirmedCount > 0 && { label: `${unconfirmedCount} payment${unconfirmedCount > 1 ? 's' : ''} to confirm`, tab: 'donations' },
    pendingCount > 0 && { label: `${pendingCount} receipt${pendingCount > 1 ? 's' : ''} pending`, tab: 'iras' },
    charityIsIpc && missingNricThisYear > 0 && { label: `${missingNricThisYear} NRIC${missingNricThisYear > 1 ? 's' : ''} missing`, tab: 'donations' },
    failedNotifications > 0 && { label: `${failedNotifications} notification${failedNotifications > 1 ? 's' : ''} failed`, tab: 'activity' },
  ].filter(Boolean)
  const thankYouThreshold = 200
  const loyalDonorThreshold = 3
  const { donationBadgeInfo, donorBadgeMap } = React.useMemo(() => {
    const donorFirstDonationId = {}
    const donationBadgeInfo = {}
    const donorRunningTotals = {}
    ;[...donations].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!donorFirstDonationId[key]) donorFirstDonationId[key] = d.id
      if (!donorRunningTotals[key]) donorRunningTotals[key] = { count: 0, maxAmount: 0 }
      donorRunningTotals[key].count += 1
      const isBiggestYet = d.amount > donorRunningTotals[key].maxAmount
      if (d.amount > donorRunningTotals[key].maxAmount) donorRunningTotals[key].maxAmount = d.amount
      donationBadgeInfo[d.id] = {
        isFirstTime: donorFirstDonationId[key] === d.id,
        isBigGift: d.amount >= thankYouThreshold,
        isLoyal: donorRunningTotals[key].count >= loyalDonorThreshold,
        isBiggestYet: isBiggestYet && donorRunningTotals[key].count > 1,
      }
    })
    const donorBadgeMap = {}
    donations.forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      const b = donationBadgeInfo[d.id]
      if (!donorBadgeMap[key]) donorBadgeMap[key] = { isFirstTime: false, isBigGift: false, isLoyal: false, isBiggestYet: false, mostRecent: d.created_at }
      if (b.isFirstTime) donorBadgeMap[key].isFirstTime = true
      if (b.isBigGift) donorBadgeMap[key].isBigGift = true
      if (b.isLoyal) donorBadgeMap[key].isLoyal = true
      if (b.isBiggestYet) donorBadgeMap[key].isBiggestYet = true
      if (new Date(d.created_at) > new Date(donorBadgeMap[key].mostRecent)) donorBadgeMap[key].mostRecent = d.created_at
    })
    return { donationBadgeInfo, donorBadgeMap }
  }, [donations])
  const donorList = React.useMemo(() => {
    const donorMap = {}
    donations.filter(d => !d.is_anonymous).forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!donorMap[key]) {
        donorMap[key] = { name: d.donor_name, email: d.donor_email, total: 0, count: 0, lastDate: d.created_at, receipts: 0, deactivated: d.donor_deactivated || false, doNotContact: d.donor_do_not_contact || false }
      }
      if (!donorMap[key].email && d.donor_email) donorMap[key].email = d.donor_email
      donorMap[key].total += d.amount
      donorMap[key].count += 1
      if (d.receipt_issued) donorMap[key].receipts += 1
      if (d.donor_deactivated) donorMap[key].deactivated = true
      if (d.donor_do_not_contact) donorMap[key].doNotContact = true
      if (new Date(d.created_at) > new Date(donorMap[key].lastDate)) {
        donorMap[key].lastDate = d.created_at
      }
    })
    return Object.values(donorMap).sort((a, b) => b.total - a.total)
  }, [donations])
  const activeDonorList = donorList.filter(d => !d.deactivated)

  const contactOnlyDonors = donorContacts
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
      isContactOnly: true,
      contactNotes: c.notes,
    }))

  const combinedDonorList = [...activeDonorList, ...contactOnlyDonors]

  useEffect(() => {
    if (pendingSelectedDonorKey && !selectedDonor && activeDonorList.length > 0) {
      const found = activeDonorList.find(d => (d.email?.trim() || d.name) === pendingSelectedDonorKey)
      if (found) {
        setSelectedDonor(found)
      }
      setPendingSelectedDonorKey(null)
    }
  }, [pendingSelectedDonorKey, activeDonorList])
  const deactivatedDonorList = donorList.filter(d => d.deactivated)
  const noteworthyDonors = React.useMemo(() => {
    return donorList
      .filter(d => {
        const key = d.email?.trim() || d.name
        const b = donorBadgeMap[key]
        return b && (b.isFirstTime || b.isBigGift || b.isLoyal || b.isBiggestYet)
      })
      .sort((a, b) => {
        const keyA = a.email?.trim() || a.name
        const keyB = b.email?.trim() || b.name
        return new Date(donorBadgeMap[keyB].mostRecent) - new Date(donorBadgeMap[keyA].mostRecent)
      })
      .slice(0, 5)
  }, [donorList, donorBadgeMap])
  const causeRaisedMap = React.useMemo(() => {
    const map = {}
    donations.forEach(d => {
      if (!d.cause_id || d.payment_status !== 'confirmed') return
      map[d.cause_id] = (map[d.cause_id] || { total: 0, donors: new Set() })
      map[d.cause_id].total += d.amount
      map[d.cause_id].donors.add(d.donor_email?.trim() || d.donor_nric || d.donor_name)
    })
    return map
  }, [donations])
  const causePerformanceThisYear = React.useMemo(() => {
    const yearScoped = filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear))
    const map = {}
    let generalTotal = 0
    let generalCount = 0
    yearScoped.forEach(d => {
      if (!d.cause_id) { generalTotal += d.amount; generalCount += 1; return }
      if (!map[d.cause_id]) map[d.cause_id] = { total: 0, count: 0, donors: new Set() }
      map[d.cause_id].total += d.amount
      map[d.cause_id].count += 1
      map[d.cause_id].donors.add(d.donor_email?.trim() || d.donor_nric || d.donor_name)
    })
    const rows = Object.entries(map).map(([causeId, stats]) => {
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
  }, [donations, filterYear, myCauses])

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const confirmedDonations = React.useMemo(() => donations.filter(d => d.payment_status === 'confirmed'), [donations])
  const campaignCauseIds = React.useMemo(() => new Set(myCauses.filter(c => c.type === 'campaign').map(c => c.id)), [myCauses])
  const donorFirstGiftDate = React.useMemo(() => {
    const map = {}
    ;[...donations].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!map[key]) map[key] = d.created_at
    })
    return map
  }, [donations])

  const giroMissedCycles = React.useMemo(() => {
    const now26 = new Date()
    return recurringGifts.filter(g => g.status === 'active').map(g => {
      const gapDays = g.frequency === 'weekly' ? 7 : g.frequency === 'quarterly' ? 91 : g.frequency === 'yearly' || g.frequency === 'annual' ? 365 : 30
      const daysLate = Math.floor((now26 - new Date(g.next_expected_date)) / (1000 * 60 * 60 * 24))
      if (daysLate <= 7) return null
      const missedCycles = Math.floor(daysLate / gapDays) + 1
      return { donor_name: g.donor_name, donor_email: g.donor_email, missedCycles, gift_id: g.id, type: g.type }
    }).filter(Boolean)
  }, [recurringGifts])
  const recurringPatternSuggestions = React.useMemo(() => {
    const alreadyRecurring = new Set(recurringGifts.map(g => g.donor_email?.trim() || g.donor_name))
    const donorGifts = {}
    confirmedDonations.forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!donorGifts[key]) donorGifts[key] = { name: d.donor_name, email: d.donor_email, gifts: [] }
      donorGifts[key].gifts.push({ amount: d.amount, date: d.created_at })
    })
    return Object.entries(donorGifts).filter(([key]) => !alreadyRecurring.has(key)).map(([key, info]) => {
      const sorted = [...info.gifts].sort((a, b) => new Date(a.date) - new Date(b.date))
      if (sorted.length < 3) return null
      const last3 = sorted.slice(-3)
      const amounts = last3.map(g => g.amount)
      const similarAmounts = Math.max(...amounts) - Math.min(...amounts) <= Math.max(...amounts) * 0.1
      const gap1 = (new Date(last3[1].date) - new Date(last3[0].date)) / (1000 * 60 * 60 * 24)
      const gap2 = (new Date(last3[2].date) - new Date(last3[1].date)) / (1000 * 60 * 60 * 24)
      const similarGaps = Math.abs(gap1 - gap2) <= 10
      if (similarAmounts && similarGaps && gap1 >= 20) {
        return { name: info.name, email: info.email, avgAmount: Math.round(amounts.reduce((s, a) => s + a, 0) / amounts.length), avgGapDays: Math.round((gap1 + gap2) / 2), key }
      }
      return null
    }).filter(Boolean)
  }, [recurringGifts, confirmedDonations])
  const recurringTrendFlags = React.useMemo(() => {
    return recurringGifts.filter(g => g.status === 'active').map(g => {
      const cycles = donations
        .filter(d => d.recurring_gift_id === g.id && d.payment_status === 'confirmed')
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      if (cycles.length < 3) return null
      const last3 = cycles.slice(-3).map(d => d.amount)
      const [a, b, c] = last3
      const firstStep = b - a
      const secondStep = c - b
      if (firstStep > 0 && secondStep > 0) {
        return { donor_name: g.donor_name, donor_email: g.donor_email, direction: 'upgrade', from: a, to: c, gift_id: g.id }
      }
      if (firstStep < 0 && secondStep < 0) {
        return { donor_name: g.donor_name, donor_email: g.donor_email, direction: 'downgrade', from: a, to: c, gift_id: g.id }
      }
      return null
    }).filter(Boolean)
  }, [recurringGifts, donations])

  const fundraisingSnapshotStats = React.useMemo(() => {
    const yr = filterYear === 'All' ? new Date().getFullYear() : parseInt(filterYear)
    const median = (arr) => {
      if (arr.length === 0) return 0
      const sorted = [...arr].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
    }
    const statsForYear = (y) => {
      const ds = donations.filter(d => d.payment_status === 'confirmed' && new Date(d.created_at).getFullYear() === y)
      const total = ds.reduce((s, d) => s + d.amount, 0)
      const donorKeys = new Set(ds.map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name))
      return { total, count: ds.length, donors: donorKeys.size, avgGift: ds.length > 0 ? total / ds.length : 0, medianGift: median(ds.map(d => d.amount)) }
    }
    const cur = statsForYear(yr)
    const prev = statsForYear(yr - 1)
    const delta = (c, p) => p === 0 ? (c > 0 ? null : 0) : Math.round(((c - p) / p) * 100)
    const tiles = [
      { label: 'Total Raised', val: `$${cur.total.toLocaleString()}`, d: delta(cur.total, prev.total), tip: `Total confirmed donations across all sources — campaigns, mass appeals, and general giving — in ${yr}, compared to ${yr - 1}.` },
      { label: 'Total Donations', val: cur.count, d: delta(cur.count, prev.count), tip: `Number of confirmed donations received across all sources in ${yr}, compared to ${yr - 1}.` },
      { label: 'Unique Donors', val: cur.donors, d: delta(cur.donors, prev.donors), tip: `Distinct donors who gave to any source in ${yr}, compared to ${yr - 1}. A donor giving more than once is only counted once.` },
      { label: 'Avg Gift Size', val: `$${cur.avgGift.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, d: delta(cur.avgGift, prev.avgGift), tip: `Average confirmed donation amount across all sources in ${yr}, compared to ${yr - 1}. Median shown below since a few large gifts can skew the average.`, extra: `median $${cur.medianGift.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
    ]
    return { yr, tiles }
  }, [filterYear, donations])

  const revenueTrendStats = React.useMemo(() => {
    const allYearsWithData = [...new Set(donations.filter(d => d.payment_status === 'confirmed').map(d => new Date(d.created_at).getFullYear()))].sort((a, b) => a - b)
    const trendYears = allYearsWithData.slice(-5)
    if (trendYears.length < 2) return null
    const trendData = trendYears.map(y => ({
      year: y.toString(),
      total: donations.filter(d => d.payment_status === 'confirmed' && new Date(d.created_at).getFullYear() === y).reduce((s, d) => s + d.amount, 0),
    }))
    const firstYr = trendData[0]
    const lastYr = trendData[trendData.length - 1]
    const cagr = firstYr.total > 0 && trendData.length > 1 ? Math.round((Math.pow(lastYr.total / firstYr.total, 1 / (trendData.length - 1)) - 1) * 100) : null
    return { trendData, firstYr, lastYr, cagr }
  }, [donations])

  const revenueByChannelStats = React.useMemo(() => {
    const yr = filterYear === 'All' ? new Date().getFullYear() : parseInt(filterYear)
    const grantYearOf = (g) => new Date(g.start_date || g.created_at).getFullYear()
    const yearDonations = donations.filter(d => d.payment_status === 'confirmed' && new Date(d.created_at).getFullYear() === yr)

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
      { label: 'Campaigns', amt: campaignsAmt, color: C.sage },
      { label: 'Mass Appeals', amt: massAppealAmt, color: C.gold },
      { label: 'Recurring Gifts', amt: recurringAmt, color: C.teal },
      { label: 'Grants', amt: grantsAmt, color: C.forest },
      { label: 'General / Unrestricted', amt: generalAmt, color: C.muted },
    ].filter(r => r.amt > 0).sort((a, b) => b.amt - a.amt).map(r => ({ ...r, pct: totalRevenue > 0 ? Math.round((r.amt / totalRevenue) * 100) : 0 }))

    return { yr, channelRows }
  }, [filterYear, donations, allAppealRecipients, campaignCauseIds, grants])

  const predictableVsOneOffStats = React.useMemo(() => {
    const yr = filterYear === 'All' ? new Date().getFullYear() : parseInt(filterYear)
    const grantYearOf = (g) => new Date(g.start_date || g.created_at).getFullYear()
    const yearDonations = donations.filter(d => d.payment_status === 'confirmed' && new Date(d.created_at).getFullYear() === yr)

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
  }, [filterYear, donations, allAppealRecipients, campaignCauseIds, grants, pledges])

  const newDonorAcquisitionStats = React.useMemo(() => {
    const yr = filterYear === 'All' ? new Date().getFullYear() : parseInt(filterYear)
    const donorFirstDate = {}
    ;[...donations].filter(d => d.payment_status === 'confirmed').sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!donorFirstDate[key]) donorFirstDate[key] = d.created_at
    })
    const monthCounts = Array(12).fill(0)
    Object.values(donorFirstDate).forEach(dateStr => {
      const dt = new Date(dateStr)
      if (dt.getFullYear() === yr) monthCounts[dt.getMonth()]++
    })
    const newDonorChartData = monthCounts.map((count, i) => ({ month: new Date(yr, i, 1).toLocaleDateString('en-SG', { month: 'short' }), count }))
    const totalNew = monthCounts.reduce((s, c) => s + c, 0)
    return { yr, newDonorChartData, totalNew }
  }, [filterYear, donations])

  const analyticsGoalStats = React.useMemo(() => {
    const goalYear = new Date().getFullYear()
    const totalThisGoalYear = donations.filter(d => new Date(d.created_at).getFullYear() === goalYear && d.payment_status === 'confirmed').reduce((s, d) => s + d.amount, 0)
    if (!annualGoal) return { goalYear, totalThisGoalYear, hasGoal: false }
    const pct = Math.round((totalThisGoalYear / annualGoal) * 100)
    const yearStart = new Date(goalYear, 0, 1)
    const now5 = new Date()
    const yearEnd = new Date(goalYear, 11, 31)
    const daysElapsed = Math.max(1, Math.ceil((now5 - yearStart) / (1000 * 60 * 60 * 24)))
    const totalDaysInYear = Math.ceil((yearEnd - yearStart) / (1000 * 60 * 60 * 24))
    const dailyRate = totalThisGoalYear / daysElapsed
    const projectedTotal = Math.round(dailyRate * totalDaysInYear)
    const onTrack = projectedTotal >= annualGoal
    const gap = Math.abs(annualGoal - projectedTotal)
    return { goalYear, totalThisGoalYear, hasGoal: true, pct, onTrack, projectedTotal, gap }
  }, [donations, annualGoal])

  const campaignSnapshotStats = React.useMemo(() => {
    const yr = filterYear === 'All' ? new Date().getFullYear() : parseInt(filterYear)
    const statsForYear = (y) => {
      const ds = donations.filter(d => d.cause_id && campaignCauseIds.has(d.cause_id) && d.payment_status === 'confirmed' && new Date(d.created_at).getFullYear() === y)
      const total = ds.reduce((s, d) => s + d.amount, 0)
      const donorKeys = new Set(ds.map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name))
      return {
        total,
        count: ds.length,
        donors: donorKeys.size,
        avgGift: ds.length > 0 ? total / ds.length : 0,
        campaignsRun: myCauses.filter(c => c.type === 'campaign' && new Date(c.created_at).getFullYear() === y).length,
      }
    }
    const cur = statsForYear(yr)
    const prev = statsForYear(yr - 1)
    const delta = (c, p) => p === 0 ? (c > 0 ? null : 0) : Math.round(((c - p) / p) * 100)
    const orgWideDs = donations.filter(d => d.payment_status === 'confirmed' && new Date(d.created_at).getFullYear() === yr)
    const orgWideAvgGift = orgWideDs.length > 0 ? orgWideDs.reduce((s, d) => s + d.amount, 0) / orgWideDs.length : 0
    const giftDiff = Math.round(cur.avgGift - orgWideAvgGift)
    const tiles = [
      { label: 'Total Raised', val: `$${cur.total.toLocaleString()}`, d: delta(cur.total, prev.total), tip: `Total confirmed donations tagged to a campaign in ${yr}, compared to ${yr - 1}. Excludes grants, mass appeals, and other donations not tied to a campaign.` },
      { label: 'Campaigns Run', val: cur.campaignsRun, d: delta(cur.campaignsRun, prev.campaignsRun), tip: `Number of campaigns launched in ${yr}, compared to ${yr - 1}. Includes campaigns that received no donations.` },
      { label: 'Unique Donors', val: cur.donors, d: delta(cur.donors, prev.donors), tip: `Distinct donors who gave to any campaign in ${yr}, compared to ${yr - 1}. A donor giving to multiple campaigns is only counted once.` },
      { label: 'Avg Gift Size', val: `$${cur.avgGift.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, d: delta(cur.avgGift, prev.avgGift), tip: `Average confirmed campaign donation amount in ${yr}, compared to ${yr - 1}.`, extra: orgWideDs.length > 0 ? `$${Math.abs(giftDiff).toLocaleString()} ${giftDiff >= 0 ? 'above' : 'below'} your org-wide avg` : null },
    ]
    return { yr, tiles }
  }, [filterYear, donations, campaignCauseIds, myCauses])

  const campaignGoalStrip = React.useMemo(() => {
    const yr = filterYear === 'All' ? new Date().getFullYear() : parseInt(filterYear)

    const statsForYear = (y) => {
      const campaignsForYear = myCauses.filter(c => c.type === 'campaign' && new Date(c.created_at).getFullYear() === y)
      const withGoal = campaignsForYear.filter(c => c.target_amount && c.end_date)
      const reachedGoalCampaigns = withGoal.filter(c => (causeRaisedMap[c.id]?.total || 0) >= Number(c.target_amount))
      const successRatePct = withGoal.length > 0 ? Math.round((reachedGoalCampaigns.length / withGoal.length) * 100) : null

      const yearScopedCampaignDonations = donations.filter(d => d.payment_status === 'confirmed' && d.cause_id && campaignCauseIds.has(d.cause_id) && new Date(d.created_at).getFullYear() === y)
      const donorCampaignSets = {}
      yearScopedCampaignDonations.forEach(d => {
        const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
        if (!donorCampaignSets[key]) donorCampaignSets[key] = new Set()
        donorCampaignSets[key].add(d.cause_id)
      })
      const donorKeysWithCampaign = Object.keys(donorCampaignSets)
      const loyalDonors = Object.values(donorCampaignSets).filter(set => set.size >= 2).length
      const loyaltyPct = donorKeysWithCampaign.length > 0 ? Math.round((loyalDonors / donorKeysWithCampaign.length) * 100) : null

      const timesToGoal = reachedGoalCampaigns.map(c => {
        const campDonationsSorted = donations.filter(d => d.cause_id === c.id && d.payment_status === 'confirmed').sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        let running = 0, crossDate = null
        for (const d of campDonationsSorted) {
          running += d.amount
          if (running >= Number(c.target_amount)) { crossDate = d.created_at; break }
        }
        return crossDate ? Math.round((new Date(crossDate) - new Date(c.created_at)) / (1000 * 60 * 60 * 24)) : null
      }).filter(d => d !== null)
      const avgTimeToGoal = timesToGoal.length > 0 ? Math.round(timesToGoal.reduce((s, d) => s + d, 0) / timesToGoal.length) : null

      return { withGoalCount: withGoal.length, reachedCount: reachedGoalCampaigns.length, successRatePct, donorCount: donorKeysWithCampaign.length, loyaltyPct, avgTimeToGoal }
    }

    const cur = statsForYear(yr)
    const prev = statsForYear(yr - 1)
    const ptDelta = (c, p) => (c === null || p === null) ? null : c - p
    const dayDelta = (c, p) => (c === null || p === null) ? null : c - p

    const strip = [
      { label: 'Goal Success Rate', val: cur.withGoalCount > 0 ? `${cur.reachedCount} of ${cur.withGoalCount}` : '—', sub: 'campaigns with a goal hit it', tip: 'Of campaigns with both a target amount and an end date, how many reached their target.', d: ptDelta(cur.successRatePct, prev.successRatePct), unit: 'pt' },
      { label: 'Cross-Campaign Loyalty', val: cur.donorCount > 0 ? `${cur.loyaltyPct}%` : '—', sub: 'of donors gave to 2+ campaigns', tip: `Share of this year's campaign donors who supported more than one campaign, out of ${cur.donorCount} donor${cur.donorCount !== 1 ? 's' : ''}.`, d: ptDelta(cur.loyaltyPct, prev.loyaltyPct), unit: 'pt' },
      { label: 'Avg Time to Goal', val: cur.avgTimeToGoal !== null ? `${cur.avgTimeToGoal}d` : '—', sub: 'for campaigns that reached target', tip: 'Average days from a campaign starting to the donation that pushed it past its goal, across campaigns that reached target.', d: dayDelta(cur.avgTimeToGoal, prev.avgTimeToGoal), unit: 'd', invert: true },
    ]

    return { yr, strip }
  }, [filterYear, myCauses, causeRaisedMap, donations, campaignCauseIds])

  const campaignLeaderboardStats = React.useMemo(() => {
    const today = new Date()
    const campaignsForLeaderboardYear = myCauses.filter(c => c.type === 'campaign' && (filterYear === 'All' || new Date(c.created_at).getFullYear() === parseInt(filterYear)))
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
        const totalSpan = end - start
        pctElapsed = totalSpan > 0 ? Math.min(100, Math.max(0, Math.round(((today - start) / totalSpan) * 100))) : null
        daysToEnd = Math.ceil((end - today) / (1000 * 60 * 60 * 24))
        goalReached = row.total >= Number(row.target_amount)
        const gap = pctElapsed !== null ? pctElapsed - pctToGoal : null
        behind = !goalReached && gap !== null && gap >= 20
        slightlyBehind = !goalReached && gap !== null && gap >= 8 && gap < 20
      }
      const isEnded = row.end_date ? new Date(row.end_date) < today : false
      const campDonations = donations.filter(d => d.cause_id === row.id && d.payment_status === 'confirmed').sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      const daysSinceLastGift = campDonations.length > 0
        ? Math.floor((today - new Date(campDonations[0].created_at)) / (1000 * 60 * 60 * 24))
        : (row.created_at ? Math.floor((today - new Date(row.created_at)) / (1000 * 60 * 60 * 24)) : null)
      const isStalled = !isEnded && daysSinceLastGift !== null && daysSinceLastGift >= 14
      return { ...row, hasGoal, pctToGoal, pctElapsed, daysToEnd, isStalled, goalReached, behind, slightlyBehind }
    }).sort((a, b) => b.total - a.total)

    const endingSoon = campaignRows.filter(r => r.hasGoal && r.daysToEnd !== null && r.daysToEnd >= 0 && r.daysToEnd <= 7).sort((a, b) => a.daysToEnd - b.daysToEnd)

    const yearScopedDonations = filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear))
    const scopedCampaigns = myCauses.filter(c => c.type === 'campaign' && yearScopedDonations.some(d => d.cause_id === c.id && d.payment_status === 'confirmed'))
    const donorGrowthRows = scopedCampaigns.map(c => {
      const campDonations = yearScopedDonations.filter(d => d.cause_id === c.id && d.payment_status === 'confirmed')
      const donorKeys = new Set(campDonations.map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name))
      let brandNewCount = 0
      donorKeys.forEach(key => {
        const firstGiftToCampaign = campDonations.filter(d => (d.donor_email?.trim() || d.donor_nric || d.donor_name) === key).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0]
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

    const allYearsWithCampaignData = [...new Set(donations.filter(d => d.payment_status === 'confirmed' && d.cause_id && campaignCauseIds.has(d.cause_id)).map(d => new Date(d.created_at).getFullYear()))].sort((a, b) => a - b)
    const trendYears = allYearsWithCampaignData.slice(-5)
    const trendData = trendYears.map(y => {
      const ds = donations.filter(d => d.payment_status === 'confirmed' && d.cause_id && campaignCauseIds.has(d.cause_id) && new Date(d.created_at).getFullYear() === y)
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

      const appealReliant = donorGrowthRows.filter(r => r.appealPct >= 40).sort((a, b) => b.appealPct - a.appealPct)
      const standoutOrganic = donorGrowthRows.filter(r => r.appealPct < 40 && r.newPct === 100 && r.organicPct === 100)
      const stagnant = donorGrowthRows.filter(r => r.appealPct < 40 && r.newPct === 0)
      const flaggedTitles = new Set([...appealReliant, ...standoutOrganic, ...stagnant].map(r => r.title))
      const restCount = donorGrowthRows.filter(r => !flaggedTitles.has(r.title)).length
      donorGrowthAgg = { aggTotal, aggOrganicPct, aggAppealPct, aggReferralPct, appealReliant, standoutOrganic, stagnant, restCount }
    }

    return { endingSoon, campaignRows, trendData, donorGrowthRows, donorGrowthAgg }
  }, [filterYear, myCauses, causePerformanceThisYear, donations, donorFirstGiftDate, allAppealRecipients, campaignCauseIds])

  const appealSnapshotStats = React.useMemo(() => {
    const yr = filterYear === 'All' ? new Date().getFullYear() : parseInt(filterYear)
    const statsForYear = (y) => {
      const appealsY = massAppeals.filter(a => new Date(a.created_at).getFullYear() === y)
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
    const delta = (c, p) => p === 0 ? (c > 0 ? null : 0) : Math.round(((c - p) / p) * 100)
    const tiles = [
      { label: 'Total Raised from Appeals', val: `$${cur.raised.toLocaleString()}`, d: delta(cur.raised, prev.raised), tip: `Total confirmed donations traced back to a mass appeal by PayNow reference, in ${yr} compared to ${yr - 1}.` },
      { label: 'Appeals Sent', val: cur.appealsSent, d: delta(cur.appealsSent, prev.appealsSent), tip: `Number of mass appeals sent out in ${yr}, compared to ${yr - 1}.` },
      { label: 'Recipients Reached', val: cur.recipients, d: delta(cur.recipients, prev.recipients), tip: `Total number of successful sends across all mass appeals in ${yr}, compared to ${yr - 1}. Counts each send, so a donor reached by multiple appeals is counted more than once.` },
      { label: 'Conversion Rate', val: `${cur.conversionRate}%`, d: delta(cur.conversionRate, prev.conversionRate), tip: `Share of appeal recipients who went on to make a confirmed donation using the appeal's QR code, in ${yr} compared to ${yr - 1}.` },
    ]
    return { yr, tiles }
  }, [filterYear, massAppeals, allAppealRecipients, donations])

  const appealListStrip = React.useMemo(() => {
    const yr = filterYear === 'All' ? new Date().getFullYear() : parseInt(filterYear)
    const appealIdsInYear = (y) => new Set(massAppeals.filter(a => new Date(a.created_at).getFullYear() === y).map(a => a.id))
    const donorKey = (r) => r.donor_email?.trim() || r.donor_name

    const curIds = appealIdsInYear(yr)
    const prevIds = appealIdsInYear(yr - 1)
    const curRecipients = allAppealRecipients.filter(r => curIds.has(r.appeal_id))
    const prevRecipients = allAppealRecipients.filter(r => prevIds.has(r.appeal_id))
    const curUnique = new Set(curRecipients.map(donorKey)).size
    const prevUnique = new Set(prevRecipients.map(donorKey)).size
    const uniqueDelta = prevUnique === 0 ? (curUnique > 0 ? null : 0) : Math.round(((curUnique - prevUnique) / prevUnique) * 100)

    const donorFirstAppealYear = {}
    ;[...allAppealRecipients].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).forEach(r => {
      const key = donorKey(r)
      if (!donorFirstAppealYear[key]) donorFirstAppealYear[key] = new Date(r.created_at).getFullYear()
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
    const orgWideDs = donations.filter(d => d.payment_status === 'confirmed' && new Date(d.created_at).getFullYear() === yr)
    const orgWideAvgGift = orgWideDs.length > 0 ? orgWideDs.reduce((s, d) => s + d.amount, 0) / orgWideDs.length : 0
    const giftDiff = Math.round(appealAvgGift - orgWideAvgGift)

    const strip = [
      { label: 'Unique Donors on List', val: curUnique, d: uniqueDelta, tip: `Distinct donors targeted by any mass appeal sent in ${yr}, compared to ${yr - 1}.` },
      { label: 'New to List This Year', val: newToListCount, sub: `first appeared on an appeal in ${yr}`, tip: `Donors whose earliest appearance on any mass appeal, across all years, falls in ${yr}.` },
      { label: 'Appeal Gift Size', val: `$${appealAvgGift.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, sub: orgWideDs.length > 0 ? `$${Math.abs(giftDiff).toLocaleString()} ${giftDiff >= 0 ? 'above' : 'below'} your org-wide avg` : null, tip: `Average confirmed donation amount among appeal recipients who converted in ${yr}, compared to your org-wide average gift.` },
    ]

    return { yr, strip }
  }, [filterYear, massAppeals, allAppealRecipients, donations])

  const appealTrendStats = React.useMemo(() => {
    const appealIdsInYear = (y) => new Set(massAppeals.filter(a => new Date(a.created_at).getFullYear() === y).map(a => a.id))
    const statsForYear = (y) => {
      const ids = appealIdsInYear(y)
      const sent = allAppealRecipients.filter(r => ids.has(r.appeal_id) && r.status === 'sent')
      const converted = sent.filter(r => donations.some(d => d.payment_ref && d.payment_ref === r.payment_ref && d.payment_status === 'confirmed'))
      const raised = converted.reduce((s, r) => {
        const donation = donations.find(d => d.payment_ref === r.payment_ref && d.payment_status === 'confirmed')
        return s + (donation ? Number(donation.amount) : 0)
      }, 0)
      return { raised, conversionRate: sent.length > 0 ? Math.round((converted.length / sent.length) * 100) : null }
    }
    const allYearsWithAppeals = [...new Set(massAppeals.map(a => new Date(a.created_at).getFullYear()))].sort((a, b) => a - b)
    const trendYears = allYearsWithAppeals.slice(-5)
    const trendData = trendYears.map(y => ({ year: y.toString(), ...statsForYear(y) }))

    const yr = filterYear === 'All' ? new Date().getFullYear() : parseInt(filterYear)
    const yearIds = appealIdsInYear(yr)
    const sentThisYear = allAppealRecipients.filter(r => yearIds.has(r.appeal_id) && r.status === 'sent')
    const responseTimes = sentThisYear.map(r => {
      const donation = donations.find(d => d.payment_ref === r.payment_ref && d.payment_status === 'confirmed')
      if (!donation) return null
      return Math.floor((new Date(donation.created_at) - new Date(r.created_at)) / (1000 * 60 * 60 * 24))
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
  }, [filterYear, massAppeals, allAppealRecipients, donations])

  const appealConversionStats = React.useMemo(() => {
    const yearNum = filterYear === 'All' ? new Date().getFullYear() : parseInt(filterYear)
    const scopedAppeals = massAppeals.filter(a => new Date(a.created_at).getFullYear() === yearNum)
    const lastYearAppeals = massAppeals.filter(a => new Date(a.created_at).getFullYear() === yearNum - 1)

    const recipientsForAppeal = (appealId) => allAppealRecipients.filter(r => r.appeal_id === appealId)

    const analyzeAppeal = (appeal) => {
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
    const avgConversion = (list) => {
      const withSends = list.filter(a => a.sentCount > 0)
      if (withSends.length === 0) return null
      return Math.round(withSends.reduce((s, a) => s + a.conversionRate, 0) / withSends.length)
    }
    const causeSpecificAvg = avgConversion(causeSpecific)
    const generalAvg = avgConversion(generalOnes)

    const distinctAmounts = [...new Set(scopedAnalyzed.filter(a => a.sentCount > 0).map(a => Number(a.appeal.amount)))]

    return { yearNum, scopedAppeals, lastYearAppeals, scopedAnalyzed, totalRaised, overallConversion, appealCountDiff, conversionDiff, lastYearRaised, lastYearConversion, causeSpecificAvg, generalAvg, distinctAmounts }
  }, [filterYear, massAppeals, allAppealRecipients, donations])

  const appealListHealthStats = React.useMemo(() => {
    const yr = filterYear === 'All' ? new Date().getFullYear() : parseInt(filterYear)
    const appealIdsInYear = (y) => new Set(massAppeals.filter(a => new Date(a.created_at).getFullYear() === y).map(a => a.id))
    const deliveryStatsForYear = (y) => {
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
      const counts = {}
      bounced.forEach(r => {
        const reason = r.error_message?.trim() || 'Unknown error'
        counts[reason] = (counts[reason] || 0) + 1
      })
      return Object.entries(counts).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count)
    })()

    const byDonor = {}
    allAppealRecipients.forEach(r => {
      const key = r.donor_email?.trim() || r.donor_name
      if (!byDonor[key]) byDonor[key] = { name: r.donor_name, recipientRows: [] }
      byDonor[key].recipientRows.push(r)
    })
    const repeatRecipients = Object.values(byDonor).filter(d => d.recipientRows.length >= 2)

    const fatigueList = repeatRecipients.map(d => {
      const sorted = [...d.recipientRows].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      const gaveFlags = sorted.map(r => donations.some(don => don.payment_ref === r.payment_ref && don.payment_status === 'confirmed'))
      const gaveCount = gaveFlags.filter(Boolean).length
      const lastGave = gaveFlags[gaveFlags.length - 1]
      const isFatigued = gaveFlags.length >= 2 && gaveFlags.slice(0, -1).some(Boolean) && !lastGave
      return { name: d.name, totalAppeals: sorted.length, gaveCount, isFatigued }
    }).sort((a, b) => (b.isFatigued ? 1 : 0) - (a.isFatigued ? 1 : 0))

    const overGivers = allAppealRecipients.filter(r => {
      const donation = donations.find(d => d.payment_ref === r.payment_ref && d.payment_status === 'confirmed')
      return donation && Number(donation.amount) > Number(r.amount) * 1.5
    }).map(r => ({
      name: r.donor_name,
      asked: Number(r.amount),
      gave: Number(donations.find(d => d.payment_ref === r.payment_ref).amount)
    }))

    const fatiguedCount = fatigueList.filter(d => d.isFatigued).length

    return { yr, curDelivery, prevDelivery, bounceReasons, repeatRecipients, fatigueList, overGivers, fatiguedCount }
  }, [filterYear, massAppeals, allAppealRecipients, donations])

  const pledgeSnapshotStats = React.useMemo(() => {
    const yr = filterYear === 'All' ? new Date().getFullYear() : parseInt(filterYear)
    const statsForYear = (y) => {
      const ps = pledges.filter(p => new Date(p.expected_date).getFullYear() === y)
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
    const delta = (c, p) => p === 0 ? (c > 0 ? null : 0) : Math.round(((c - p) / p) * 100)
    const tiles = [
      { label: 'Pledges Made', val: cur.count, d: delta(cur.count, prev.count), tip: `Number of pledges with an expected date in ${yr}, compared to ${yr - 1}.` },
      { label: 'Amount Pledged', val: `$${cur.total.toLocaleString()}`, d: delta(cur.total, prev.total), tip: `Total value of pledges expected in ${yr}, compared to ${yr - 1}. Includes fulfilled, pending, and cancelled pledges.` },
      { label: 'Fulfilled', val: cur.fulfilledCount, d: delta(cur.fulfilledCount, prev.fulfilledCount), tip: `Number of pledges expected in ${yr} that have been fulfilled with a matching donation, compared to ${yr - 1}.` },
      { label: 'Fulfilled On Time', val: `${cur.onTimeRate}%`, d: delta(cur.onTimeRate, prev.onTimeRate), tip: `Share of pledges expected in ${yr} that were fulfilled on or before their expected date, compared to ${yr - 1}.` },
    ]
    return { yr, tiles }
  }, [filterYear, pledges, donations])

  const pledgeStatsAndTrend = React.useMemo(() => {
    const today = new Date()
    const yr = filterYear === 'All' ? new Date().getFullYear() : parseInt(filterYear)
    const buildOutstandingUnits = () => {
      const units = []
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
      daysOverdue: Math.floor((today - new Date(u.expected_date)) / (1000 * 60 * 60 * 24)),
    })).sort((a, b) => b.daysOverdue - a.daysOverdue)
    const overdueTotal = overdueUnits.reduce((s, u) => s + u.amount, 0)

    const scopedPledgesForYr = pledges.filter(p => new Date(p.expected_date).getFullYear() === yr)
    const lastYearPledgesForYr = pledges.filter(p => new Date(p.expected_date).getFullYear() === yr - 1)
    const avgPledgeSize = scopedPledgesForYr.length > 0 ? scopedPledgesForYr.reduce((s, p) => s + Number(p.amount), 0) / scopedPledgesForYr.length : 0
    const lastYearAvgPledgeSize = lastYearPledgesForYr.length > 0 ? lastYearPledgesForYr.reduce((s, p) => s + Number(p.amount), 0) / lastYearPledgesForYr.length : 0
    const avgDelta = lastYearAvgPledgeSize === 0 ? (avgPledgeSize > 0 ? null : 0) : Math.round(((avgPledgeSize - lastYearAvgPledgeSize) / lastYearAvgPledgeSize) * 100)

    const cancelledCount = scopedPledgesForYr.filter(p => p.status === 'cancelled').length
    const cancellationRate = scopedPledgesForYr.length > 0 ? Math.round((cancelledCount / scopedPledgesForYr.length) * 100) : 0

    const pledgeDonorKey = (p) => p.donor_email?.trim() || p.donor_name
    const pledgeCountByDonor = {}
    pledges.forEach(p => {
      const key = pledgeDonorKey(p)
      pledgeCountByDonor[key] = (pledgeCountByDonor[key] || 0) + 1
    })
    const pledgeDonorKeys = Object.keys(pledgeCountByDonor)
    const repeatPledgeDonors = pledgeDonorKeys.filter(k => pledgeCountByDonor[k] >= 2).length
    const repeatPledgeRate = pledgeDonorKeys.length > 0 ? Math.round((repeatPledgeDonors / pledgeDonorKeys.length) * 100) : 0

    const allYearsWithPledges = [...new Set(pledges.map(p => new Date(p.expected_date).getFullYear()))].sort((a, b) => a - b)
    const trendYears = allYearsWithPledges.slice(-5)
    const trendData = trendYears.map(y => {
      const ps = pledges.filter(p => new Date(p.expected_date).getFullYear() === y)
      const pledgedTotal = ps.reduce((s, p) => s + Number(p.amount), 0)
      const fulfilledTotal = ps.filter(p => p.status === 'fulfilled').reduce((s, p) => s + Number(p.amount), 0)
      return { year: y.toString(), pledged: pledgedTotal, fulfilled: fulfilledTotal }
    })

    return { yr, overdueUnits, overdueTotal, avgPledgeSize, avgDelta, cancellationRate, repeatPledgeRate, trendData }
  }, [filterYear, pledges, pledgeInstalments])

  const pledgeReliabilityStats = React.useMemo(() => {
    const yearNum = filterYear === 'All' ? new Date().getFullYear() : parseInt(filterYear)
    const scopedPledges = pledges.filter(p => new Date(p.expected_date).getFullYear() === yearNum)
    const lastYearPledges = pledges.filter(p => new Date(p.expected_date).getFullYear() === yearNum - 1)
    const lastYearTotal = lastYearPledges.reduce((s, p) => s + Number(p.amount), 0)

    const fulfilled = scopedPledges.filter(p => p.status === 'fulfilled' && p.fulfilled_donation_id)
    const fulfilledWithDates = fulfilled.map(p => {
      const donation = donations.find(d => d.id === p.fulfilled_donation_id)
      if (!donation) return null
      const daysLate = Math.ceil((new Date(donation.created_at) - new Date(p.expected_date)) / (1000 * 60 * 60 * 24))
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
    const donorKey = (p) => p.donor_email?.trim() || p.donor_name
    const byDonor = {}
    pledges.forEach(p => {
      const key = donorKey(p)
      if (!byDonor[key]) byDonor[key] = { name: p.donor_name, pledges: [] }
      byDonor[key].pledges.push(p)
    })
    const watchList = Object.values(byDonor).map(d => {
      const broken = d.pledges.filter(p => p.status === 'cancelled' || (p.status === 'pending' && new Date(p.expected_date) < today))
      const rescheduled = d.pledges.filter(p => p.status === 'pending')
      return { ...d, brokenCount: broken.length, broken, overdueNow: d.pledges.filter(p => p.status === 'pending' && new Date(p.expected_date) < today) }
    }).filter(d => d.brokenCount >= pledgeWatchThreshold).sort((a, b) => b.brokenCount - a.brokenCount)

    return { yearNum, lastYearPledges, lastYearTotal, fulfilledWithDates, onTimeGroup, slightlyLateGroup, veryLateGroup, lastYearOnTimeRate, watchList }
  }, [filterYear, pledges, donations, pledgeWatchThreshold])

  const pledgeConcentrationStats = React.useMemo(() => {
    const outstandingUnits = []
    pledges.filter(p => p.status === 'pending').forEach(p => {
      if (p.is_multi_year) {
        const myInstalments = pledgeInstalments.filter(i => i.pledge_id === p.id && !i.received)
        myInstalments.forEach(inst => {
          outstandingUnits.push({ donor_name: p.donor_name, amount: Number(inst.amount), expected_date: inst.expected_date, pledge_id: p.id })
        })
      } else {
        outstandingUnits.push({ donor_name: p.donor_name, amount: Number(p.amount), expected_date: p.expected_date, pledge_id: p.id })
      }
    })

    const totalOutstanding = outstandingUnits.reduce((s, u) => s + u.amount, 0)

    const byDonorOutstanding = {}
    outstandingUnits.forEach(u => {
      if (!byDonorOutstanding[u.donor_name]) byDonorOutstanding[u.donor_name] = 0
      byDonorOutstanding[u.donor_name] += u.amount
    })
    const donorRanked = Object.entries(byDonorOutstanding).map(([name, amount]) => ({
      name, amount, pct: totalOutstanding > 0 ? Math.round((amount / totalOutstanding) * 100) : 0,
    })).sort((a, b) => b.amount - a.amount)

    const topDonorPct = donorRanked.length > 0 ? donorRanked[0].pct : 0
    const highRisk = donorRanked.length >= 2 && topDonorPct >= 60
    const medRisk = donorRanked.length >= 2 && topDonorPct >= 40 && topDonorPct < 60
    const tooFewDonors = donorRanked.length < 2

    const byMonth = {}
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
    const yr = filterYear === 'All' ? new Date().getFullYear() : parseInt(filterYear)
    const statsForYear = (y) => {
      const ds = donations.filter(d => d.recurring_gift_id && d.payment_status === 'confirmed' && new Date(d.created_at).getFullYear() === y)
      const total = ds.reduce((s, d) => s + d.amount, 0)
      const donorKeys = new Set(ds.map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name))
      const newGifts = recurringGifts.filter(g => new Date(g.created_at).getFullYear() === y).length
      return { total, count: ds.length, donors: donorKeys.size, newGifts }
    }
    const cur = statsForYear(yr)
    const prev = statsForYear(yr - 1)
    const delta = (c, p) => p === 0 ? (c > 0 ? null : 0) : Math.round(((c - p) / p) * 100)
    const tiles = [
      { label: 'Total Raised (Recurring)', val: `$${cur.total.toLocaleString()}`, d: delta(cur.total, prev.total), tip: `Total confirmed donations collected through recurring gifts in ${yr}, compared to ${yr - 1}.` },
      { label: 'New Recurring Gifts', val: cur.newGifts, d: delta(cur.newGifts, prev.newGifts), tip: `Number of new recurring gifts (GIRO or habitual PayNow) started in ${yr}, compared to ${yr - 1}.` },
      { label: 'Recurring Donors', val: cur.donors, d: delta(cur.donors, prev.donors), tip: `Distinct donors who made at least one recurring donation in ${yr}, compared to ${yr - 1}.` },
      { label: 'Recurring Donations', val: cur.count, d: delta(cur.count, prev.count), tip: `Number of individual confirmed recurring donation charges collected in ${yr}, compared to ${yr - 1}.` },
    ]
    return { yr, tiles }
  }, [filterYear, donations, recurringGifts])

  const recurringMrrStats = React.useMemo(() => {
    const monthlyEquivalent = (g) => g.frequency === 'weekly' ? Number(g.amount) * 4.33 : g.frequency === 'quarterly' ? Number(g.amount) / 3 : g.frequency === 'yearly' || g.frequency === 'annual' ? Number(g.amount) / 12 : Number(g.amount)
    const mrrAsOfEndOfYear = (y) => {
      const yearEnd = new Date(y, 11, 31)
      const activeAtYearEnd = recurringGifts.filter(g => new Date(g.created_at) <= yearEnd && (g.status === 'active' || (g.cancelled_at && new Date(g.cancelled_at) > yearEnd)))
      return activeAtYearEnd.reduce((s, g) => s + monthlyEquivalent(g), 0)
    }
    const allYearsWithGifts = [...new Set(recurringGifts.map(g => new Date(g.created_at).getFullYear()))].sort((a, b) => a - b)
    const trendYears = allYearsWithGifts.slice(-5)
    const trendData = trendYears.map(y => ({ year: y.toString(), mrr: Math.round(mrrAsOfEndOfYear(y)) }))

    const yr = filterYear === 'All' ? new Date().getFullYear() : parseInt(filterYear)
    const newGiftsThisYear = recurringGifts.filter(g => new Date(g.created_at).getFullYear() === yr)
    const newMrr = newGiftsThisYear.reduce((s, g) => s + monthlyEquivalent(g), 0)
    const churnedGiftsThisYear = recurringGifts.filter(g => g.status === 'cancelled' && g.cancelled_at && new Date(g.cancelled_at).getFullYear() === yr)
    const churnedMrr = churnedGiftsThisYear.reduce((s, g) => s + monthlyEquivalent(g), 0)
    const netMrr = newMrr - churnedMrr

    return { trendData, yr, newMrr, churnedMrr, netMrr }
  }, [filterYear, recurringGifts])

  const recurringHealthStats = React.useMemo(() => {
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const activeGifts = recurringGifts.filter(g => g.status === 'active')
    const activeGiftsAgo = recurringGifts.filter(g => g.status === 'active' && new Date(g.created_at) < ninetyDaysAgo)
    const giftCountDiff = activeGifts.length - activeGiftsAgo.length

    const mrr = activeGifts.reduce((s, g) => {
      const monthly = g.frequency === 'weekly' ? Number(g.amount) * 4.33 : g.frequency === 'quarterly' ? Number(g.amount) / 3 : g.frequency === 'yearly' || g.frequency === 'annual' ? Number(g.amount) / 12 : Number(g.amount)
      return s + monthly
    }, 0)
    const mrrAgo = activeGiftsAgo.reduce((s, g) => {
      const monthly = g.frequency === 'weekly' ? Number(g.amount) * 4.33 : g.frequency === 'quarterly' ? Number(g.amount) / 3 : g.frequency === 'yearly' || g.frequency === 'annual' ? Number(g.amount) / 12 : Number(g.amount)
      return s + monthly
    }, 0)
    const mrrDiffPct = mrrAgo > 0 ? Math.round(((mrr - mrrAgo) / mrrAgo) * 100) : null

    const cancelledGifts = recurringGifts.filter(g => g.status === 'cancelled' && g.cancelled_at)
    const avgLifespanMonths = cancelledGifts.length > 0
      ? Math.round(cancelledGifts.reduce((s, g) => s + (new Date(g.cancelled_at) - new Date(g.created_at)) / (1000 * 60 * 60 * 24 * 30.44), 0) / cancelledGifts.length)
      : null

    const atRiskGifts = giroMissedCycles.filter(g => g.missedCycles >= recurringMissedThreshold)
    const atRiskCount = atRiskGifts.length
    const atRiskMrr = atRiskGifts.reduce((s, g) => {
      const gift = recurringGifts.find(rg => rg.id === g.gift_id)
      if (!gift) return s
      const monthly = gift.frequency === 'weekly' ? Number(gift.amount) * 4.33 : gift.frequency === 'quarterly' ? Number(gift.amount) / 3 : gift.frequency === 'yearly' || gift.frequency === 'annual' ? Number(gift.amount) / 12 : Number(gift.amount)
      return s + monthly
    }, 0)

    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const activeOneYearAgo = recurringGifts.filter(g => new Date(g.created_at) <= oneYearAgo && (g.status === 'active' || (g.cancelled_at && new Date(g.cancelled_at) > oneYearAgo)))
    const stillActiveNow = activeOneYearAgo.filter(g => g.status === 'active')
    const retentionRate = activeOneYearAgo.length > 0 ? Math.round((stillActiveNow.length / activeOneYearAgo.length) * 100) : null

    const trendFlagsFiltered = recurringTrendFlags.filter(f => {
      const gift = recurringGifts.find(g => g.id === f.gift_id)
      if (!gift) return false
      const cycles = donations.filter(d => d.recurring_gift_id === gift.id && d.payment_status === 'confirmed').sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      if (recurringTrendCycles === 3 && cycles.length < 4) return false
      return true
    })
    const upgrades = trendFlagsFiltered.filter(f => f.direction === 'upgrade')
    const downgrades = trendFlagsFiltered.filter(f => f.direction === 'downgrade')

    return { activeGifts, giftCountDiff, mrr, mrrDiffPct, avgLifespanMonths, cancelledGifts, atRiskCount, atRiskMrr, retentionRate, trendFlagsFiltered, upgrades, downgrades }
  }, [recurringGifts, giroMissedCycles, recurringMissedThreshold, recurringTrendFlags, recurringTrendCycles, donations])

  const recurringRiskStats = React.useMemo(() => {
    const missedFiltered = giroMissedCycles.filter(g => g.missedCycles >= 1)
    const frequentSkippers = Object.entries(recurringSkipHistory).filter(([, skips]) => skips.length >= 2).map(([giftId, skips]) => {
      const gift = recurringGifts.find(g => g.id === giftId)
      return gift ? { ...gift, skipCount: skips.length } : null
    }).filter(Boolean)
    return { missedFiltered, frequentSkippers }
  }, [giroMissedCycles, recurringSkipHistory, recurringGifts])

  const grantSnapshotStats = React.useMemo(() => {
    const yr = filterYear === 'All' ? new Date().getFullYear() : parseInt(filterYear)
    const grantYearOf = (g) => new Date(g.start_date || g.created_at).getFullYear()
    const statsForYear = (y) => {
      const gs = grants.filter(g => grantYearOf(g) === y)
      const total = gs.reduce((s, g) => s + Number(g.amount), 0)
      return { total, count: gs.length, avg: gs.length > 0 ? total / gs.length : 0 }
    }
    const cur = statsForYear(yr)
    const prev = statsForYear(yr - 1)
    const delta = (c, p) => p === 0 ? (c > 0 ? null : 0) : Math.round(((c - p) / p) * 100)
    const activeGrantsCount = grants.filter(g => g.status === 'active').length
    const tiles = [
      { label: 'Grants Awarded', val: cur.count, d: delta(cur.count, prev.count), tip: `Number of grants with a start date in ${yr}, compared to ${yr - 1}.` },
      { label: 'Total Secured', val: `$${cur.total.toLocaleString()}`, d: delta(cur.total, prev.total), tip: `Total value of grants awarded in ${yr}, compared to ${yr - 1}.` },
      { label: 'Avg Grant Size', val: `$${cur.avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, d: delta(cur.avg, prev.avg), tip: `Average grant amount awarded in ${yr}, compared to ${yr - 1}.` },
      { label: 'Active Grants', val: activeGrantsCount, tip: `Grants currently marked active, as of today. Not scoped to ${yr} — this reflects your live grant portfolio right now.` },
    ]
    return { yr, tiles }
  }, [filterYear, grants])

  const grantOverviewStats = React.useMemo(() => {
    const grantYearOf = (g) => new Date(g.start_date || g.created_at).getFullYear()
    const allYearsWithGrants = [...new Set(grants.map(grantYearOf))].sort((a, b) => a - b)
    const trendYears = allYearsWithGrants.slice(-5)
    const trendData = trendYears.map(y => ({
      year: y.toString(),
      total: grants.filter(g => grantYearOf(g) === y).reduce((s, g) => s + Number(g.amount), 0),
    }))

    const activeGrantsList = grants.filter(g => g.status === 'active')
    const totalActiveAmount = activeGrantsList.reduce((s, g) => s + Number(g.amount), 0)
    const totalUtilized = activeGrantsList.reduce((s, g) => s + grantExpenses.filter(e => e.grant_id === g.id).reduce((s2, e) => s2 + Number(e.amount), 0), 0)
    const utilizationRate = totalActiveAmount > 0 ? Math.round((totalUtilized / totalActiveAmount) * 100) : null

    const activeGrants = grants.filter(g => g.status === 'active')
    const today = new Date()

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
    const expiringSoon = activeGrants.filter(g => g.report_due_date && new Date(g.report_due_date) >= today && new Date(g.report_due_date) <= sixMonthsOut)

    return { trendData, totalActiveAmount, totalUtilized, utilizationRate, activeGrants, byFunder, topFunderPct, highRisk, medRisk, tooFewFunders, expiringSoon }
  }, [grants, grantExpenses])

  const donorRetentionSnapshotStats = React.useMemo(() => {
    const yr = filterYear === 'All' ? new Date().getFullYear() : parseInt(filterYear)
    const donorMap = {}
    donations.filter(d => d.payment_status === 'confirmed').forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!donorMap[key]) donorMap[key] = { total: 0, count: 0, years: new Set() }
      donorMap[key].total += d.amount
      donorMap[key].count += 1
      donorMap[key].years.add(new Date(d.created_at).getFullYear())
    })
    const allDonors = Object.values(donorMap)
    const repeatCount = allDonors.filter(d => d.count >= 2).length
    const repeatDonorRate = allDonors.length > 0 ? Math.round((repeatCount / allDonors.length) * 100) : 0
    const avgLTV = allDonors.length > 0 ? Math.round(allDonors.reduce((s, d) => s + d.total, 0) / allDonors.length) : 0

    const priorYearDonors = allDonors.filter(d => d.years.has(yr - 1))
    const retainedDonors = priorYearDonors.filter(d => d.years.has(yr))
    const retentionRate = priorYearDonors.length > 0 ? Math.round((retainedDonors.length / priorYearDonors.length) * 100) : null

    const activeCount = allDonors.filter(d => d.years.has(yr)).length
    const lapsedCount = allDonors.filter(d => !d.years.has(yr) && Math.max(...d.years) < yr).length

    return { yr, repeatDonorRate, avgLTV, retentionRate, activeCount, lapsedCount }
  }, [filterYear, donations])

  const lapsedDonorsStats = React.useMemo(() => {
    const lapsedToday = new Date()
    const map = {}
    confirmedDonations.forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!map[key] || new Date(d.created_at) > new Date(map[key].lastDate)) {
        map[key] = { name: d.donor_name, email: d.donor_email, lastDate: d.created_at, count: 0, total: 0 }
      }
      map[key].count++
      map[key].total += d.amount
    })
    const allLapsed = Object.values(map).filter(d => {
      const daysSince = Math.floor((lapsedToday - new Date(d.lastDate)) / (1000 * 60 * 60 * 24))
      return daysSince >= lapsedMinDays && d.count >= lapsedMinGifts
    }).map(d => ({ ...d, key: d.email?.trim() || d.name })).sort((a, b) => b.total - a.total)

    const isInReachOutCooldown = (donorKey) => {
      const history = lapsedReminderHistory[donorKey]
      if (!history || history.length === 0) return false
      const daysSinceReminder = Math.floor((lapsedToday - new Date(history[0].sent_at)) / (1000 * 60 * 60 * 24))
      return daysSinceReminder < 30
    }

    const activeLapsed = allLapsed.filter(d => !lapsedDismissals[d.key] && !isInReachOutCooldown(d.key))
    const dismissedLapsed = allLapsed.filter(d => lapsedDismissals[d.key])

    return { activeLapsed, dismissedLapsed }
  }, [confirmedDonations, lapsedMinDays, lapsedMinGifts, lapsedDismissals, lapsedReminderHistory])

  const quietDonorsStats = React.useMemo(() => {
    const byDonor = {}
    confirmedDonations.forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!byDonor[key]) byDonor[key] = { name: d.donor_name, email: d.donor_email, dates: [] }
      byDonor[key].dates.push(new Date(d.created_at))
    })
    const now4 = new Date()
    const quiet = Object.values(byDonor).map(donor => {
      const sorted = donor.dates.sort((a, b) => a - b)
      if (sorted.length < 3) return null
      const gaps = []
      for (let i = 1; i < sorted.length; i++) {
        gaps.push((sorted[i] - sorted[i - 1]) / (1000 * 60 * 60 * 24))
      }
      const avgGapDays = gaps.reduce((s, g) => s + g, 0) / gaps.length
      const daysSinceLast = (now4 - sorted[sorted.length - 1]) / (1000 * 60 * 60 * 24)
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
      const myNotes75 = donorNotes.filter(n => n.donor_key === donorKey75).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
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
    const yearScopedConfirmed = (filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear))).filter(d => d.payment_status === 'confirmed')
    if (yearScopedConfirmed.length === 0) return []

    const byDonorTotal = {}
    yearScopedConfirmed.forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!byDonorTotal[key]) byDonorTotal[key] = { name: d.donor_name, email: d.donor_email, total: 0, count: 0, firstYear: null }
      byDonorTotal[key].total += d.amount
      byDonorTotal[key].count += 1
    })
    const topDonor = Object.values(byDonorTotal).sort((a, b) => b.total - a.total)[0]
    const mostFrequent = Object.values(byDonorTotal).sort((a, b) => b.count - a.count)[0]
    const largestGift = [...yearScopedConfirmed].sort((a, b) => b.amount - a.amount)[0]

    const donorFirstEverYear = {}
    ;[...donations].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!donorFirstEverYear[key]) donorFirstEverYear[key] = new Date(d.created_at).getFullYear()
    })
    const firstTimeGiftsThisPeriod = yearScopedConfirmed.filter(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      return donorFirstEverYear[key] === new Date(d.created_at).getFullYear()
    })
    const standoutNewDonor = [...firstTimeGiftsThisPeriod].sort((a, b) => b.amount - a.amount)[0]

    return [
      topDonor && { icon: '🏆', label: 'Top donor', name: topDonor.name, sub: `$${topDonor.total.toLocaleString()} across ${topDonor.count} gift${topDonor.count > 1 ? 's' : ''}`, donor: { name: topDonor.name, email: topDonor.email, total: topDonor.total, count: topDonor.count } },
      largestGift && { icon: '💎', label: 'Largest single gift', name: largestGift.donor_name, sub: `$${Number(largestGift.amount).toLocaleString()} on ${new Date(largestGift.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}`, donor: { name: largestGift.donor_name, email: largestGift.donor_email, total: byDonorTotal[largestGift.donor_email?.trim() || largestGift.donor_nric || largestGift.donor_name]?.total || largestGift.amount, count: byDonorTotal[largestGift.donor_email?.trim() || largestGift.donor_nric || largestGift.donor_name]?.count || 1 } },
      mostFrequent && { icon: '🔁', label: 'Most frequent giver', name: mostFrequent.name, sub: `${mostFrequent.count} donations, $${mostFrequent.total.toLocaleString()} total`, donor: { name: mostFrequent.name, email: mostFrequent.email, total: mostFrequent.total, count: mostFrequent.count } },
      standoutNewDonor && { icon: '✨', label: 'Standout new supporter', name: standoutNewDonor.donor_name, sub: `First gift: $${Number(standoutNewDonor.amount).toLocaleString()}`, donor: { name: standoutNewDonor.donor_name, email: standoutNewDonor.donor_email, total: standoutNewDonor.amount, count: 1 } },
    ].filter(Boolean)
  }, [filterYear, donations])

  const givingStreaksStats = React.useMemo(() => {
    const byDonorMonths = {}
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
    const map = {}
    confirmedDonations.forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!map[key]) map[key] = { name: d.donor_name, total: 0, count: 0, firstDate: d.created_at }
      map[key].total += d.amount
      map[key].count++
      if (new Date(d.created_at) < new Date(map[key].firstDate)) map[key].firstDate = d.created_at
    })
    const sorted = Object.values(map).sort((a, b) => b.total - a.total)
    const avgLTV = sorted.length > 0 ? Math.round(sorted.reduce((s, d) => s + d.total, 0) / sorted.length) : 0
    const avgGifts = sorted.length > 0 ? (sorted.reduce((s, d) => s + d.count, 0) / sorted.length).toFixed(1) : 0
    const now59 = new Date()
    const withTenure59 = sorted.map(d => ({ ...d, tenureYears: (now59 - new Date(d.firstDate)) / (1000 * 60 * 60 * 24 * 365) }))
    const under1yr59 = withTenure59.filter(d => d.tenureYears < 1)
    const oneToTwo59 = withTenure59.filter(d => d.tenureYears >= 1 && d.tenureYears < 2)
    const twoPlus59 = withTenure59.filter(d => d.tenureYears >= 2)
    const avgOf59 = (arr) => arr.length > 0 ? Math.round(arr.reduce((s, d) => s + d.total, 0) / arr.length) : null
    return { sorted, avgLTV, avgGifts, under1yr59, oneToTwo59, twoPlus59, avgOf59 }
  }, [confirmedDonations])

  const paymentMixStats = React.useMemo(() => {
    const scoped = (filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear))).filter(d => d.payment_status === 'confirmed')
    if (scoped.length === 0) return null
    const totalAmt = scoped.reduce((s, d) => s + d.amount, 0)
    const byMethod = {}
    scoped.forEach(d => {
      const label = d.source === 'manual' ? (d.payment_method || 'Manual') : 'PayNow (app)'
      if (!byMethod[label]) byMethod[label] = 0
      byMethod[label] += d.amount
    })
    const rows = Object.entries(byMethod).map(([label, amt]) => ({ label, amt, pct: Math.round((amt / totalAmt) * 100) })).sort((a, b) => b.amt - a.amt)

    const allYears61 = [...new Set(donations.filter(d => d.payment_status === 'confirmed').map(d => new Date(d.created_at).getFullYear()))].sort()
    const allMethods61 = [...new Set(rows.map(r => r.label))]
    const yearlyMix61 = allYears61.map(y => {
      const yearDons = donations.filter(d => d.payment_status === 'confirmed' && new Date(d.created_at).getFullYear() === y)
      const yearTotal = yearDons.reduce((s, d) => s + d.amount, 0)
      const mix = {}
      allMethods61.forEach(m => { mix[m] = 0 })
      yearDons.forEach(d => {
        const label = d.source === 'manual' ? (d.payment_method || 'Manual') : 'PayNow (app)'
        mix[label] = (mix[label] || 0) + d.amount
      })
      return { year: y, mix, total: yearTotal }
    })

    return { rows, allYears61, allMethods61, yearlyMix61 }
  }, [filterYear, donations])

  const fundingConcentrationStats = React.useMemo(() => {
    const donorTotals = {}
    confirmedDonations.forEach(d => {
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
    const priorDonorTotals = {}
    confirmedDonations.filter(d => new Date(d.created_at) < quarterAgo).forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!priorDonorTotals[key]) priorDonorTotals[key] = 0
      priorDonorTotals[key] += d.amount
    })
    const priorSorted = Object.values(priorDonorTotals).sort((a, b) => b - a)
    const priorGrandTotal = priorSorted.reduce((s, t) => s + t, 0)
    const priorTopNTotal = priorSorted.slice(0, concentrationTopN).reduce((s, t) => s + t, 0)
    const priorConcentrationPct = priorGrandTotal > 0 ? Math.round((priorTopNTotal / priorGrandTotal) * 100) : null
    const concentrationTrend = priorConcentrationPct !== null ? concentrationPct - priorConcentrationPct : null

    return { sorted, grandTotal, concentrationPct, tooFewDonors, highRisk, medRisk, topDonorNames, concentrationTrend }
  }, [confirmedDonations, concentrationTopN])

  const topConnectorsStats = React.useMemo(() => {
    const referrals78 = donations.filter(d => d.referred_by_donor_key)
    if (referrals78.length === 0) return []
    const byReferrer78 = {}
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
      const sustainedCount = Object.values(info.referredDonors).filter(c => c > 1).length
      return { name: referrer?.name || referrerKey, referredCount, sustainedCount }
    }).sort((a, b) => b.sustainedCount - a.sustainedCount || b.referredCount - a.referredCount)
  }, [donations, donorList])

  const acquisitionSourceStats = React.useMemo(() => {
    const bySource57 = {}
    donations.filter(d => d.acquisition_source).forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!bySource57[d.acquisition_source]) bySource57[d.acquisition_source] = {}
      if (!bySource57[d.acquisition_source][key]) bySource57[d.acquisition_source][key] = 0
      bySource57[d.acquisition_source][key]++
    })
    const sourceLabels57 = { referral: 'Referral', event: 'Event', social_media: 'Social Media', walk_in: 'Walk-in', corporate_partner: 'Corporate Partner', other: 'Other' }
    return Object.entries(bySource57).map(([source, donorCounts]) => {
      const donorKeys = Object.keys(donorCounts)
      const repeat = donorKeys.filter(k => donorCounts[k] > 1).length
      return { source: sourceLabels57[source] || source, totalDonors: donorKeys.length, repeatDonors: repeat, repeatPct: donorKeys.length > 0 ? Math.round((repeat / donorKeys.length) * 100) : 0 }
    }).sort((a, b) => b.totalDonors - a.totalDonors)
  }, [donations])

  const donationSizeBreakdownStats = React.useMemo(() => {
    const yearScoped = filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).toLocaleDateString('en-SG', { year: 'numeric' }) === filterYear)
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
  }, [filterYear, donations])

  const allGivingChangeFlags = (() => {
    const donorTotals = {}
    confirmedDonations.forEach(d => {
      const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
      if (!donorTotals[key]) donorTotals[key] = { name: d.donor_name, email: d.donor_email, total: 0, gifts: [] }
      donorTotals[key].total += d.amount
      donorTotals[key].gifts.push({ amount: d.amount, date: d.created_at })
    })
    return Object.values(donorTotals).filter(d => d.gifts.length >= givingChangeMinGifts).map(d => {
      const byDate = [...d.gifts].sort((a, b) => new Date(a.date) - new Date(b.date))
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
  })()
  const thisMonthTotal = confirmedDonations.filter(d => new Date(d.created_at) >= thisMonthStart).reduce((s, d) => s + d.amount, 0)
  const lastMonthTotal = confirmedDonations.filter(d => new Date(d.created_at) >= lastMonthStart && new Date(d.created_at) < thisMonthStart).reduce((s, d) => s + d.amount, 0)
  const monthChangePct = lastMonthTotal > 0 ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100) : null
  const sixMonthTrend = Array.from({ length: 6 }, (_, i) => {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1)
    return confirmedDonations.filter(d => new Date(d.created_at) >= monthStart && new Date(d.created_at) < monthEnd).reduce((s, d) => s + d.amount, 0)
  })
  const trendMax = Math.max(...sixMonthTrend, 1)
  const repeatDonorsThisMonth = donorList.filter(d => {
    const donationsThisMonth = donations.filter(don => (don.donor_email?.trim() || don.donor_nric || don.donor_name) === (d.email?.trim() || d.name) && new Date(don.created_at) >= thisMonthStart)
    return donationsThisMonth.length > 0 && d.count > donationsThisMonth.length
  }).length
  const longestSupporter = donorList.length > 0
    ? donorList.map(d => ({ ...d, monthsSupporting: Math.max(1, Math.round((now - new Date([...donations].filter(don => (don.donor_email?.trim() || don.donor_nric || don.donor_name) === (d.email?.trim() || d.name)).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0]?.created_at)) / (1000 * 60 * 60 * 24 * 30))) }))
        .sort((a, b) => b.monthsSupporting - a.monthsSupporting)[0]
    : null
  const issuedCount  = donations.filter(d => d.receipt_issued).length
  const uniqueDonors = [...new Set(donations.map(d => d.donor_name))]
  const uniqueDonorsThisYear = [...new Set(
    (filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear)))
      .map(d => d.donor_name)
  )]
  const avgDonation  = donations.length ? (totalAllTime / donations.length) : 0
  const medianDonation = (() => {
    const yearScoped = filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear))
    const amounts = yearScoped.map(d => d.amount).sort((a, b) => a - b)
    if (amounts.length === 0) return 0
    const mid = Math.floor(amounts.length / 2)
    return amounts.length % 2 === 0 ? (amounts[mid - 1] + amounts[mid]) / 2 : amounts[mid]
  })()
  const currentYear = new Date().getFullYear()
  const irasDeadline = new Date(`${currentYear + 1}-01-31`)
  const daysToDeadline = Math.ceil((irasDeadline - new Date()) / (1000 * 60 * 60 * 24))

  // COC Annual Submission deadline: 6 months after financial year end
  const { cocDeadline, daysToCocDeadline, fyEndLabel } = (() => {
    const today = new Date()
    let fyEndThisCycle = new Date(today.getFullYear(), fyEndMonth - 1, fyEndDay)
    // If FY-end hasn't happened yet this calendar year, the most recent FY-end was last year
    if (fyEndThisCycle > today) {
      fyEndThisCycle = new Date(today.getFullYear() - 1, fyEndMonth - 1, fyEndDay)
    }
    const deadline = new Date(fyEndThisCycle)
    deadline.setMonth(deadline.getMonth() + 6)
    // If that deadline already passed, we're actually counting toward next cycle's deadline
    if (deadline < today) {
      const nextFyEnd = new Date(fyEndThisCycle.getFullYear() + 1, fyEndMonth - 1, fyEndDay)
      const nextDeadline = new Date(nextFyEnd)
      nextDeadline.setMonth(nextDeadline.getMonth() + 6)
      const days = Math.ceil((nextDeadline - today) / (1000 * 60 * 60 * 24))
      return { cocDeadline: nextDeadline, daysToCocDeadline: days, fyEndLabel: nextFyEnd.toLocaleDateString('en-SG', { day: 'numeric', month: 'long' }) }
    }
    const days = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24))
    return { cocDeadline: deadline, daysToCocDeadline: days, fyEndLabel: fyEndThisCycle.toLocaleDateString('en-SG', { day: 'numeric', month: 'long' }) }
  })()
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'

  const activeDonationFilterCount = [
    searchTerm !== '',
    filterType !== 'All',
    filterNric !== 'All',
    filterYear !== 'All',
    filterSource !== 'All',
    filterThankYou !== 'All',
  ].filter(Boolean).length

  const filteredDonations = donations.filter(d => {
    const q = searchTerm.toLowerCase().trim()
    const searchFields = charityIsIpc ? [d.donor_name, d.donor_email, d.donor_nric, d.notes, d.payment_ref, d.receipt_number] : [d.donor_name, d.donor_email, d.notes, d.payment_ref, d.receipt_number]
    const matchSearch = q === '' || searchFields.some(field => field?.toLowerCase().includes(q))
    const matchYear = filterYear === 'All' || new Date(d.created_at).getFullYear().toString() === filterYear
    const matchType = filterType === 'All'
      || (filterType === 'Awaiting Payment' && d.payment_status !== 'confirmed')
      || (filterType === 'Receipt Pending' && d.payment_status === 'confirmed' && !d.receipt_issued)
      || (filterType === 'Issued' && d.receipt_issued)
      
    const matchNric = filterNric === 'All' || (filterNric === 'Missing NRIC' && !d.donor_nric && d.payment_status === 'confirmed')
    const matchSource = filterSource === 'All' || (filterSource === 'Manual' && d.source === 'manual') || (filterSource === 'App' && d.source !== 'manual')
    const matchThankYou = filterThankYou === 'All'
      || (filterThankYou === 'Sent' && d.thank_you_sent)
      || (filterThankYou === 'Not Sent' && !d.thank_you_sent && d.donor_email?.trim())
      || (filterThankYou === 'No Email' && !d.donor_email?.trim())
    return matchSearch && matchYear && matchType && matchNric && matchSource && matchThankYou
  }).sort((a, b) => {
    if (!donationSortBy) return new Date(b.created_at) - new Date(a.created_at)
    let cmp = 0
    if (donationSortBy === 'amount') cmp = a.amount - b.amount
    if (donationSortBy === 'date') cmp = new Date(a.created_at) - new Date(b.created_at)
    if (donationSortBy === 'donor') cmp = (a.donor_name || '').localeCompare(b.donor_name || '')
    if (donationSortBy === 'cause') cmp = (causeNameForDonation(a) || '').localeCompare(causeNameForDonation(b) || '')
    return donationSortDir === 'asc' ? cmp : -cmp
  })

  const donationsTotalPages = Math.max(1, Math.ceil(filteredDonations.length / donationsPerPage))
  const paginatedDonations = filteredDonations.slice(donationsPage * donationsPerPage, donationsPage * donationsPerPage + donationsPerPage)

  useEffect(() => {
    setDonationsPage(0)
  }, [searchTerm, filterType, filterNric, filterYear, filterSource, filterThankYou, donationSortBy, donationSortDir])

  function toggleDonationSelected(id) {
    setSelectedDonationIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleSelectAllVisible() {
    const visibleIds = paginatedDonations.map(d => d.id)
    const allSelected = visibleIds.every(id => selectedDonationIds.includes(id))
    if (allSelected) {
      setSelectedDonationIds(prev => prev.filter(id => !visibleIds.includes(id)))
    } else {
      setSelectedDonationIds(prev => [...new Set([...prev, ...visibleIds])])
    }
  }

  function selectAllMatchingFilters() {
    setSelectedDonationIds(filteredDonations.map(d => d.id))
  }

  async function bulkIssueSelectedReceipts() {
    const selected = donations.filter(d => selectedDonationIds.includes(d.id) && !d.receipt_issued && d.payment_status === 'confirmed')
    const skipped = selectedDonationIds.length - selected.length
    if (selected.length === 0) { showToast('No selected donations are eligible (must be payment-confirmed and receipt-pending)', 'error'); return }
    setBulkActionInProgress(true)
    bulkCancelRef.current = false
    setBulkProgress({ done: 0, total: selected.length })
    let issuedCount = 0
    for (const d of selected) {
      if (bulkCancelRef.current) break
      await issueReceipt(d, true, true)
      issuedCount++
      setBulkProgress({ done: issuedCount, total: selected.length })
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
    setSelectedDonationIds([])
    if (bulkCancelRef.current) {
      showToast(`Cancelled — ${issuedCount} of ${selected.length} receipts issued before stopping`)
    } else {
      showToast(`${issuedCount} receipt${issuedCount > 1 ? 's' : ''} issued${skipped > 0 ? ` — ${skipped} skipped (not payment-confirmed or already issued)` : ''}`)
    }
  }

  function bulkRequestSelectedNric() {
    const selected = donations.filter(d => selectedDonationIds.includes(d.id) && !d.donor_nric && d.donor_email?.trim())
    const skipped = selectedDonationIds.length - selected.length
    if (selected.length === 0) { showToast('No selected donations are eligible (must be missing NRIC and have an email on file)', 'error'); return }
    const byDonor = {}
    selected.forEach(d => {
      if (!byDonor[d.donor_email]) byDonor[d.donor_email] = { donor_name: d.donor_name, donor_email: d.donor_email, total: 0, count: 0 }
      byDonor[d.donor_email].total += d.amount
      byDonor[d.donor_email].count += 1
    })
    const donorList = Object.values(byDonor)
    setConfirmModal({
      title: 'Send NRIC request to selected donors?',
      description: `This will email ${donorList.length} donor${donorList.length > 1 ? 's' : ''}.${skipped > 0 ? ` ${skipped} selected donation${skipped > 1 ? 's are' : ' is'} not eligible (already has NRIC or no email on file) and will be skipped.` : ''}`,
      confirmLabel: 'Send request',
      onConfirm: () => { sendBulkNricRequest(donorList, skipped); setSelectedDonationIds([]) },
    })
  }

  function bulkDeleteSelectedManual() {
    const selected = donations.filter(d => selectedDonationIds.includes(d.id) && d.source === 'manual')
    const skipped = selectedDonationIds.length - selected.length
    if (selected.length === 0) { showToast('No selected donations are manual entries', 'error'); return }
    setConfirmModal({
      title: `Delete ${selected.length} manual entr${selected.length > 1 ? 'ies' : 'y'}?`,
      description: `Records will be kept for audit purposes but removed from your active lists.${skipped > 0 ? ` ${skipped} selected donation${skipped > 1 ? 's are' : ' is'} app-sourced (not manual) and will be skipped.` : ''}`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setBulkActionInProgress(true)
        bulkCancelRef.current = false
        setBulkProgress({ done: 0, total: selected.length })
        let deletedCount = 0
        for (const d of selected) {
          if (bulkCancelRef.current) break
          await deleteDonationConfirmed(d.id)
          deletedCount++
          setBulkProgress({ done: deletedCount, total: selected.length })
        }
        setBulkActionInProgress(false)
        setBulkProgress(null)
        setSelectedDonationIds([])
        if (bulkCancelRef.current) {
          showToast(`Cancelled — ${deletedCount} of ${selected.length} entries deleted before stopping`)
        } else {
          showToast(`${deletedCount} entr${deletedCount > 1 ? 'ies' : 'y'} deleted`)
        }
      },
    })
  }

  function exportPledgesExcel(searchedPledges) {
    const rows = searchedPledges.map(p => ({
      'Donor Name': p.donor_name,
      'Email': p.donor_email || '',
      'Amount (SGD)': p.amount,
      'Expected Date': new Date(p.expected_date).toLocaleDateString('en-SG'),
      'Status': p.status.charAt(0).toUpperCase() + p.status.slice(1),
      'Given So Far (SGD)': pledgeGivenTotals[p.id] || 0,
      'Notes': p.notes || '',
      'Resolution Notes': p.resolution_notes || '',
      'Recorded By': p.created_by,
      'Recorded On': new Date(p.created_at).toLocaleDateString('en-SG'),
    }))
    if (rows.length === 0) { showToast('No pledges to export with current filters', 'error'); return }
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 25 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 30 }, { wch: 30 }, { wch: 24 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Pledges')
    XLSX.writeFile(wb, `GivingTree-Pledges-${charityName}-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  function exportGrantsExcel(filteredGrants) {
    const rows = filteredGrants.map(g => {
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
  }

  function exportRecurringExcel(filteredGifts) {
    const rows = filteredGifts.map(g => ({
      'Donor Name': g.donor_name,
      'Email': g.donor_email || '',
      'Amount (SGD)': g.amount,
      'Frequency': g.frequency,
      'Type': g.type === 'giro' ? 'GIRO' : g.type === 'habitual_paynow' ? 'Habitual PayNow' : g.type === 'standing_order' ? 'Standing Order' : 'Other',
      'Status': g.status.charAt(0).toUpperCase() + g.status.slice(1),
      'Start Date': g.start_date ? new Date(g.start_date).toLocaleDateString('en-SG') : '',
      'Next Expected': g.next_expected_date ? new Date(g.next_expected_date).toLocaleDateString('en-SG') : '',
      'Last Received': g.last_received_date ? new Date(g.last_received_date).toLocaleDateString('en-SG') : '',
      'Total Received (SGD)': recurringGivenTotals[g.id]?.total || 0,
      'Payments Made': recurringGivenTotals[g.id]?.count || 0,
      'GIRO Reference': g.giro_reference || '',
      'Notes': g.notes || '',
    }))
    if (rows.length === 0) { showToast('No recurring gifts to export with current filters', 'error'); return }
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 25 }, { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 30 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Recurring Gifts')
    XLSX.writeFile(wb, `GivingTree-RecurringGifts-${charityName}-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  async function saveDonorContact() {
    if (!addDonorForm.full_name.trim()) { setAddDonorError('Name is required'); return }
    setSavingDonorContact(true)
    setAddDonorError('')

    const newKey = addDonorForm.email?.trim() || addDonorForm.full_name.trim()
    const alreadyExists = activeDonorList.some(d => (d.email?.trim() || d.name) === newKey)
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
    setShowAddDonorModal(false)
    setAddDonorForm({ full_name: '', email: '', notes: '' })
    showToast(`${data[0].full_name} added ✓`)
  }

  async function exportDonorsExcel(filteredDonors) {
    const { data: allNotes } = await supabase
      .from('donor_notes')
      .select('donor_key')
      .eq('charity_uen', charityUen)
    const noteCountByDonor = {}
    ;(allNotes || []).forEach(n => {
      noteCountByDonor[n.donor_key] = (noteCountByDonor[n.donor_key] || 0) + 1
    })

    const rows = filteredDonors.map(d => {
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
        'Tags': (donorTagsMap[donorKey] || []).map(t => t.tag).join(', '),
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
  }

  function exportCampaignsExcel(filteredCampaigns) {
    const rows = filteredCampaigns.map(c => {
      const raised = donations.filter(d => d.cause_id === c.id && d.payment_status === 'confirmed').reduce((s, d) => s + d.amount, 0)
      return {
        'Title': c.title,
        'Description': c.description || '',
        'Status': c.status.charAt(0).toUpperCase() + c.status.slice(1),
        'Target Amount (SGD)': c.target_amount || '',
        'Raised (SGD)': raised,
        'Created': new Date(c.created_at).toLocaleDateString('en-SG'),
        'End Date': c.end_date ? new Date(c.end_date).toLocaleDateString('en-SG') : '',
      }
    })
    if (rows.length === 0) { showToast('No campaigns to export with current filters', 'error'); return }
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 30 }, { wch: 45 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Campaigns')
    XLSX.writeFile(wb, `GivingTree-Campaigns-${charityName}-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  function exportMassAppealsExcel(filteredAppeals) {
    const rows = filteredAppeals.map(a => ({
      'Date': new Date(a.created_at).toLocaleDateString('en-SG'),
      'Campaign': a.cause_name || 'General Appeal',
      'Default Amount (SGD)': a.amount,
      'Message': a.message || '',
      'Donors Targeted': a.donor_count,
      'Sent': a.sent_count,
      'Failed': a.failed_count,
      'Sent By': a.created_by,
    }))
    if (rows.length === 0) { showToast('No appeals to export with current filters', 'error'); return }
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 14 }, { wch: 25 }, { wch: 18 }, { wch: 40 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 24 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Mass Appeals')
    XLSX.writeFile(wb, `GivingTree-MassAppeals-${charityName}-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  function exportDonationsExcel() {
    const rows = donations.map(d => ({
      'Donor Name': d.donor_name,
      'Email': d.donor_email || '',
      ...(charityIsIpc ? { 'NRIC/FIN': d.donor_nric || '' } : {}),
      'Amount (SGD)': d.amount,
      'Date': new Date(d.created_at).toLocaleDateString('en-SG'),
      'Source': d.source === 'manual' ? `Manual (${d.payment_method || ''})` : 'Giving Tree App',
      'Cause': causeNameForDonation(d) || 'General Donation',
      'Payment Status': d.payment_status === 'confirmed' ? 'Confirmed' : 'Unverified',
      'Receipt Issued': d.receipt_issued ? 'Yes' : 'No',
      'Receipt No.': d.payment_ref || d.receipt_number || '',
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
  }

  // Year-filtered donor map for IRAS tab
  const irasYearDonorMap = {}
  donations.filter(d => filterYear !== 'All' && new Date(d.created_at).getFullYear() === parseInt(filterYear) && d.payment_status === 'confirmed').forEach(d => {
    const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
    if (!irasYearDonorMap[key]) irasYearDonorMap[key] = { name: d.donor_name, total: 0, count: 0, donations: [] }
    irasYearDonorMap[key].total += d.amount
    irasYearDonorMap[key].count += 1
    irasYearDonorMap[key].donations.push(d)
  })
  const irasYearDonorList = Object.values(irasYearDonorMap).sort((a, b) => b.total - a.total)

  function exportIRASExcel() {
    if (filterYear === 'All') { showToast('Select a specific year before exporting'); return }
    const yearDonations = donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear) && d.payment_status === 'confirmed')
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
  }

  async function saveVisibleMetrics(metrics) {
    const { error } = await supabase.from('charity_contacts').update({ visible_metrics: metrics }).eq('charity_uen', charityUen)
    if (error) { showToast('Could not save your preferences', 'error'); return }
    setVisibleMetrics(metrics)
    setShowCustomizeAnalytics(false)
    showToast('Analytics view updated ✓')
  }

  async function saveAnnualGoal() {
    const val = parseFloat(goalInput)
    if (!goalInput || isNaN(val) || val <= 0) { showToast('Enter a valid goal amount', 'error'); return }
    const { error } = await supabase.from('charity_contacts').update({ annual_goal: val }).eq('charity_uen', charityUen)
    if (error) { showToast('Could not save goal', 'error'); return }
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
    setFyEndMonth(month)
    setFyEndDay(day)
    setEditingFyEnd(false)
    showToast('Financial year end updated ✓')
  }

  function showToast(msg, type = 'success') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ msg, type })
    toastTimerRef.current = setTimeout(() => setToast(null), 4000)
  }

  function generateThankYouNote(donor, badgeState) {
    setThankYouDraft({
      donor,
      badgeState,
      text: buildThankYouNote(donor, badgeState),
    })
  }

  function buildThankYouNote(donor, badgeState) {
    const firstName = donor.name?.split(' ')[0] || donor.name
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

  async function ackDonorBadges(donor, badgeState) {
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
      y13 = doc.lastAutoTable.finalY + 10
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
      y13 = doc.lastAutoTable.finalY + 10
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
      y = doc.lastAutoTable.finalY + 14
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

    const finalY = doc.lastAutoTable.finalY + 14
    doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setTextColor(120, 120, 120)
    doc.text('Generated by Giving Tree — a free donation platform for Singapore charities.', 14, finalY)

    doc.save(`GivingTree-Analytics-${charityName}-${filterYear}.pdf`)
  }

  function exportBoardPacket() {
    const doc = new jsPDF()
    doc.setFillColor(27, 67, 50)
    doc.rect(0, 0, 210, 42, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20); doc.setFont('helvetica', 'bold')
    doc.text('Board Packet', 14, 20)
    doc.setFontSize(11); doc.setFont('helvetica', 'normal')
    doc.text(`${charityName} · ${filterYear === 'All' ? 'All Time' : filterYear}`, 14, 30)
    doc.setFontSize(9)
    doc.text(`Generated ${new Date().toLocaleDateString('en-SG')}`, 14, 37)

    // Section 1: Cash Flow Summary
    doc.setTextColor(28, 28, 28)
    doc.setFontSize(13); doc.setFont('helvetica', 'bold')
    doc.text('Cash Flow Summary', 14, 56)
    doc.setFontSize(11); doc.setFont('helvetica', 'normal')
    const cashFlowStats = [
      ['Total Raised', `SGD $${totalThisYear.toLocaleString()}`],
      ['This Month', `SGD $${thisMonthTotal.toLocaleString()}`],
      ['Total Transactions', `${donations.length}`],
      ['Unique Donors', `${uniqueDonorsThisYear.length}`],
      ['Average Donation', `SGD $${avgDonation.toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
    ]
    let y = 66
    cashFlowStats.forEach(([label, value]) => {
      doc.setFont('helvetica', 'normal'); doc.text(label, 14, y)
      doc.setFont('helvetica', 'bold'); doc.text(value, 120, y)
      y += 8
    })

    // Section 2: Top 10 Donors
    y += 8
    doc.setFontSize(13); doc.setFont('helvetica', 'bold')
    doc.text('Top 10 Donors', 14, y)
    y += 4
    autoTable(doc, {
      startY: y,
      head: [['Donor', 'Total Given (SGD)', 'Donations']],
      body: donorList.slice(0, 10).length ? donorList.slice(0, 10).map(d => [d.name, `$${d.total.toLocaleString()}`, d.count]) : [['No donors yet', '', '']],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [212, 160, 23], textColor: [27, 67, 50] },
    })
    y = doc.lastAutoTable.finalY + 14

    // Section 3: Campaign Performance
    if (causePerformanceThisYear.filter(r => !r.isGeneral).length > 0) {
      doc.setFontSize(13); doc.setFont('helvetica', 'bold')
      doc.text('Campaign Performance', 14, y)
      y += 4
      autoTable(doc, {
        startY: y,
        head: [['Campaign', 'Total (SGD)', 'Donations', 'Donors', 'Avg (SGD)']],
        body: causePerformanceThisYear.filter(r => !r.isGeneral).map(row => [row.title, `$${row.total.toLocaleString()}`, row.count, row.donors, `$${row.avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}`]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [64, 145, 108], textColor: [255, 255, 255] },
      })
      y = doc.lastAutoTable.finalY + 14
    }

    // Section 4: Compliance Status
    if (y > 250) { doc.addPage(); y = 20 }
    doc.setFontSize(13); doc.setFont('helvetica', 'bold')
    doc.text('Compliance Status', 14, y)
    y += 10
    doc.setFontSize(10); doc.setFont('helvetica', 'normal')
    doc.text(`COC Annual Submission: ${daysToCocDeadline > 0 ? `due ${cocDeadline.toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })} (${daysToCocDeadline} days)` : 'check Charity Portal'}`, 14, y)
    y += 8
    if (charityIsIpc) {
      doc.text(`IRAS Submission: ${pendingCount} receipt${pendingCount !== 1 ? 's' : ''} pending, due 31 January ${currentYear + 1}`, 14, y)
      y += 8
    } else {
      doc.text('IRAS Submission: not applicable (non-IPC charity)', 14, y)
      y += 8
    }
    doc.text(`Receipts issued: ${issuedCount} of ${donations.length}`, 14, y)

    const finalY = y + 14
    doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setTextColor(120, 120, 120)
    doc.text('Generated by Giving Tree — a free donation platform for Singapore charities.', 14, finalY)

    doc.save(`GivingTree-BoardPacket-${charityName}-${filterYear}.pdf`)
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
    const recurringMonthly54 = activeRecurring54.reduce((s, g) => s + Number(g.amount), 0)
    const recurringQTotal = recurringMonthly54 * 3
    const oneOffQTotal = qTotal - qDonations.filter(d => d.recurring_gift_id).reduce((s, d) => s + d.amount, 0)

    const byMethod54 = {}
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
      ['  Recurring (GIRO + PayNow)', `SGD $${Math.round(recurringQTotal).toLocaleString()}`],
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
  }

  function exportGrantReportPDF(grant) {
    const doc = new jsPDF()
    const myExpenses = grantExpenses.filter(e => e.grant_id === grant.id).sort((a, b) => new Date(a.expense_date) - new Date(b.expense_date))
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

    const finalY = doc.lastAutoTable.finalY + 14
    doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setTextColor(120, 120, 120)
    doc.text(`Prepared by ${charityName}. Generated by Giving Tree — a free donation platform for Singapore charities.`, 14, finalY, { maxWidth: 180 })

    doc.save(`${grant.funder_name.replace(/[^a-zA-Z0-9]/g, '_')}-Grant-Report-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  function generateReceiptPDFDoc(donation) {
    const doc = new jsPDF()
    const isIpc = charityIsIpc
    const pageWidth = 210
    const margin = 20
    const contentWidth = pageWidth - margin * 2
    const forest = [27, 67, 50]
    const ivory = [250, 247, 242]
    const successBg = [238, 246, 241]
    const mutedText = [122, 110, 98]
    const darkText = [28, 28, 28]
    const borderColor = [226, 217, 204]

    doc.setFillColor(...forest)
    doc.rect(0, 0, pageWidth, 42, 'F')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text('OFFICIAL DONATION RECEIPT', margin, 16)
    doc.setFontSize(16)
    doc.text(charityName || 'Charity', margin, 26)
    doc.setFontSize(10)
    doc.text(`UEN ${charityUen || ''}`, margin, 34)

    let y = 56
    doc.setFontSize(9)
    doc.setTextColor(...mutedText)
    doc.text('ISSUED TO', margin, y)
    doc.setFontSize(9)
    doc.text('RECEIPT NO.', pageWidth - margin, y, { align: 'right' })
    y += 7
    doc.setFontSize(13)
    doc.setTextColor(...darkText)
    doc.text(donation.receipt_name || donorReceiptNameOverrides[donation.donor_email?.trim() || donation.donor_name] || donation.donor_name || '', margin, y)
    doc.setFontSize(10)
    doc.text(donation.payment_ref || donation.receipt_number || 'N/A', pageWidth - margin, y, { align: 'right' })
    y += 6
    doc.setDrawColor(...borderColor)
    doc.line(margin, y, pageWidth - margin, y)

    y += 14
    doc.setFillColor(...ivory)
    doc.roundedRect(margin, y, contentWidth, 32, 4, 4, 'F')
    doc.setFontSize(9)
    doc.setTextColor(...mutedText)
    doc.text('AMOUNT DONATED', pageWidth / 2, y + 12, { align: 'center' })
    doc.setFontSize(22)
    doc.setTextColor(...forest)
    doc.text(`SGD $${Number(donation.amount).toLocaleString()}.00`, pageWidth / 2, y + 24, { align: 'center' })

    y += 44
    const facts = [
      ['Date', new Date(donation.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })],
      ['Payment method', donation.source === 'manual' ? (donation.payment_method || 'Manual') : 'PayNow'],
    ]
    const causeTitle = causeNameForDonation(donation)
    if (causeTitle) facts.push(['Cause', causeTitle])
    if (donation.donor_nric) facts.push(['NRIC / FIN on file', donation.donor_nric])

    facts.forEach(([label, value], i) => {
      doc.setFontSize(10)
      doc.setTextColor(...mutedText)
      doc.text(label, margin, y)
      doc.setTextColor(...darkText)
      doc.text(String(value), pageWidth - margin, y, { align: 'right' })
      if (i < facts.length - 1) {
        doc.setDrawColor(240, 235, 225)
        doc.line(margin, y + 3, pageWidth - margin, y + 3)
      }
      y += 9
    })

    if (donation.notes) {
      y += 4
      const noteLines = doc.splitTextToSize(donation.notes, contentWidth - 12)
      const noteBoxHeight = 14 + noteLines.length * 5
      doc.setFillColor(...ivory)
      doc.roundedRect(margin, y, contentWidth, noteBoxHeight, 4, 4, 'F')
      doc.setFontSize(8)
      doc.setTextColor(...mutedText)
      doc.text('NOTE FROM DONOR', margin + 6, y + 8)
      doc.setFontSize(10)
      doc.setTextColor(...darkText)
      doc.text(noteLines, margin + 6, y + 15)
      y += noteBoxHeight + 10
    } else {
      y += 6
    }

    if (isIpc) {
      doc.setFillColor(...successBg)
      doc.roundedRect(margin, y, contentWidth, 26, 4, 4, 'F')
      doc.setFontSize(10)
      doc.setTextColor(59, 109, 17)
      doc.text('250% tax deductible', margin + 8, y + 11)
      doc.text('Est. tax savings (22%)', margin + 8, y + 20)
      doc.setFontSize(12)
      doc.setTextColor(...forest)
      doc.text(`SGD $${(donation.amount * 2.5).toLocaleString()}.00`, pageWidth - margin - 8, y + 11, { align: 'right' })
      doc.text(`SGD $${(donation.amount * 2.5 * 0.22).toLocaleString(undefined, { maximumFractionDigits: 0 })}.00`, pageWidth - margin - 8, y + 20, { align: 'right' })
      y += 36
    } else {
      doc.setFillColor(...ivory)
      doc.roundedRect(margin, y, contentWidth, 16, 4, 4, 'F')
      doc.setFontSize(9)
      doc.setTextColor(...mutedText)
      doc.text('This charity is registered but not an IPC. Not tax deductible.', pageWidth / 2, y + 10, { align: 'center' })
      y += 26
    }

    if (isIpc && !donation.donor_nric) {
      doc.setFillColor(253, 243, 220)
      doc.roundedRect(margin, y, contentWidth, 14, 4, 4, 'F')
      doc.setFontSize(8)
      doc.setTextColor(160, 113, 16)
      doc.text('NRIC/FIN not on file — donor must provide this before submission for tax deduction.', pageWidth / 2, y + 9, { align: 'center', maxWidth: contentWidth - 12 })
      y += 22
    }

    doc.setDrawColor(...borderColor)
    doc.line(margin, y, pageWidth - margin, y)
    y += 8
    doc.setFontSize(9)
    doc.setTextColor(...mutedText)
    doc.text('Issued via Giving Tree, a donation platform for Singapore charities', pageWidth / 2, y, { align: 'center' })
    y += 8
    doc.setFontSize(8)
    doc.setTextColor(180, 178, 167)
    doc.text('Tax savings shown assume a flat 22% rate for illustration only. Actual savings depend on your tax bracket.', pageWidth / 2, y, { align: 'center', maxWidth: contentWidth })

    return doc
  }

  function exportSingleReceiptPDF(donation) {
    const doc = generateReceiptPDFDoc(donation)
    doc.save(`Receipt-${donation.payment_ref || donation.receipt_number || donation.id}.pdf`)
  }

  function getReceiptPDFBase64(donation) {
    const doc = generateReceiptPDFDoc(donation)
    return doc.output('datauristring').split(',')[1]
  }

  function generateDonorYearEndStatementDoc(donorName, donorDonations, year) {
    const doc = new jsPDF()
    const sorted = [...donorDonations].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
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
        d.payment_ref || d.receipt_number || 'N/A',
        d.source === 'manual' ? (d.payment_method || 'Manual') : 'PayNow',
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [27, 67, 50], textColor: [255, 255, 255] },
    })

    let finalY = doc.lastAutoTable.finalY + 14
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
    const yearDons = donations.filter(d => new Date(d.created_at).getFullYear() === year && d.payment_status === 'confirmed' && !d.is_anonymous)
    if (yearDons.length === 0) { showToast('No donations found for this year', 'error'); return }

    const byDonor = {}
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
    showToast(`${Object.keys(byDonor).length} statements downloaded ✓`)
  }

  function exportYearEndSummary() {
    if (filterYear === 'All') { showToast('Select a specific year first'); return }
    const doc = new jsPDF()
    const yearDons = donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear) && d.payment_status === 'confirmed')
    const yearTotal = yearDons.reduce((s, d) => s + d.amount, 0)
    const yearDonors = new Set(yearDons.map(d => d.donor_name)).size
    const yearTop = Object.values(yearDons.reduce((acc, d) => {
      acc[d.donor_name] = acc[d.donor_name] || { name: d.donor_name, total: 0 }
      acc[d.donor_name].total += d.amount
      return acc
    }, {})).sort((a, b) => b.total - a.total).slice(0, 5)
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

    const finalY = doc.lastAutoTable.finalY + 14
    doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setTextColor(120, 120, 120)
    doc.text('Generated by Giving Tree — a free donation platform for Singapore charities.', 14, finalY)

    doc.save(`GivingTree-YearEnd-${charityName}-${filterYear}.pdf`)
  }

  async function handleSetNewPassword() {
    if (newPassword.length < 6) { setResetMsg('Password must be at least 6 characters'); return }
    if (newPassword !== confirmPassword) { setResetMsg('Passwords do not match'); return }
    setResetLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setResetLoading(false)
    if (error) { setResetMsg(error.message); return }
    setResetMsg('Password updated! Redirecting...')
    setTimeout(() => { setShowResetPassword(false); setNewPassword(''); setConfirmPassword(''); setResetMsg('') }, 1500)
  }

  const monthlyChartData = React.useMemo(() => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return months.map((month, i) => ({
      month,
      amount: donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear) && new Date(d.created_at).getMonth() === i).reduce((sum, d) => sum + d.amount, 0),
      lastYearAmount: donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear) - 1 && new Date(d.created_at).getMonth() === i).reduce((sum, d) => sum + d.amount, 0),
      count: donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear) && new Date(d.created_at).getMonth() === i).length,
    }))
  }, [donations, filterYear])

  const monthlyCountData = React.useMemo(() => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return months.map((month, i) => ({
      month,
      count: donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear) && new Date(d.created_at).getMonth() === i).length,
    }))
  }, [donations, filterYear])

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
            { id: 'dashboard', icon: '📊', label: 'Dashboard', roles: ['ed', 'staff', 'board', 'volunteer'] },
            { id: 'analytics', icon: '📈', label: 'Analytics', roles: ['ed', 'staff'] },
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
                { id: 'promotions', icon: '📣', label: 'Campaigns' },
                { id: 'pledges',    icon: '🤝', label: 'Pledges' },
                { id: 'recurring',  icon: '🔁', label: 'Recurring' },
                { id: 'massappeal', icon: '📢', label: 'Mass Appeal' },
                { id: 'grants',     icon: '🏛️', label: 'Grants' },
              ].map(item => (
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
        <div style={s.mobileOverflowBtn} onClick={() => setShowMobileMenu(v => !v)}>⋯</div>
        {showMobileMenu && (
          <div style={s.mobileOverflowMenu}>
            {(userRole === 'staff' || userRole === 'ed') && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, padding: '6px 16px 2px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Campaigns</div>
                <div style={s.mobileOverflowItem} onClick={() => { setActiveTab('promotions'); setSelectedDonor(null); setShowMobileMenu(false) }}>📣 Promotions</div>
                <div style={s.mobileOverflowItem} onClick={() => { setActiveTab('pledges'); setSelectedDonor(null); setShowMobileMenu(false) }}>🤝 Pledges</div>
                <div style={s.mobileOverflowItem} onClick={() => { setActiveTab('recurring'); setSelectedDonor(null); setShowMobileMenu(false) }}>🔁 Recurring</div>
                <div style={s.mobileOverflowItem} onClick={() => { setActiveTab('massappeal'); setSelectedDonor(null); setShowMobileMenu(false) }}>📢 Mass Appeal</div>
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

      {/* ── BOTTOM TAB BAR (mobile) ── */}
      {isMobile && (
      <div style={s.mobileTabBar}>
        {[
          { id: 'dashboard', icon: '📊', label: 'Dashboard' },
          { id: 'donations', icon: '💳', label: 'Donations' },
          { id: 'analytics', icon: '📈', label: 'Analytics' },
          { id: 'donors',    icon: '👥', label: 'Donors' },
        ].map(item => (
          <div key={item.id} style={s.mobileTabItem} onClick={() => { setActiveTab(item.id); setSelectedDonor(null) }}>
            <div style={{ fontSize: 18, opacity: activeTab === item.id ? 1 : 0.5 }}>{item.icon}</div>
            <div style={{ ...s.mobileTabLabel, color: activeTab === item.id ? C.sage : 'rgba(255,255,255,0.5)' }}>{item.label}</div>
          </div>
        ))}
      </div>
      )}

      {/* ── MAIN ── */}
      <div style={isMobile ? s.mainMobile : { ...s.main, marginLeft: sidebarCollapsed ? 64 : 232, width: `calc(100vw - ${sidebarCollapsed ? 64 : 232}px)`, transition: 'margin-left 0.2s ease, width 0.2s ease' }}>

        {/* ── DASHBOARD ── */}
        {activeTab === 'dashboard' && (
          <div style={s.content}>
            <div style={{ ...s.pageHeader, marginBottom: 32 }}>
              <div>
                <div style={{ fontFamily: C.fontVoice, fontWeight: 500, fontSize: 26, color: C.forest }}>{greeting}, {charityName}</div>
                <div style={{ ...s.pageSub, marginTop: 4 }}>Here's what's happening right now</div>
              </div>
            </div>

            <div style={{ position: 'relative', paddingLeft: 24, marginBottom: 40 }}>
              <div style={{ position: 'absolute', left: 0, top: 4, bottom: 4, width: 1, background: C.borderStrong }} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.muted }}>01</span>
                <span style={{ fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: C.forest, fontWeight: 500 }}>Today's Overview</span>
              </div>

            {/* ── ACTION ITEMS ── */}
            {(() => {
              const today = new Date()
              today.setHours(0, 0, 0, 0)

              const items = []

              const unconfirmed = donations.filter(d => d.payment_status !== 'confirmed' && d.payment_status !== 'cancelled' && d.status !== 'deleted_by_charity' && d.status !== 'cancelled_by_donor').length
              if (unconfirmed > 0) items.push({ icon: '⚡', label: `${unconfirmed} payment${unconfirmed > 1 ? 's' : ''} awaiting confirmation`, priority: 'high', jump: () => { clearDonationFilters({ keepYear: false }); setFilterType('Awaiting Payment'); setActiveTab('donations') } })

              const pendingReceipts = donations.filter(d => d.payment_status === 'confirmed' && !d.receipt_issued).length
              if (pendingReceipts > 0) items.push({ icon: '🧾', label: `${pendingReceipts} receipt${pendingReceipts > 1 ? 's' : ''} not yet issued`, priority: 'high', jump: () => { clearDonationFilters({ keepYear: false }); setFilterType('Receipt Pending'); setActiveTab('donations') } })

              if (charityIsIpc && daysToDeadline <= 60 && daysToDeadline > 0 && pendingCount > 0) {
                items.push({ icon: '🏛️', label: `IRAS deadline in ${daysToDeadline} days — ${pendingCount} receipt${pendingCount > 1 ? 's' : ''} outstanding`, priority: 'high', tab: 'iras' })
              }

              const wasRecentlyReminded = (p) => {
                const history = pledgeReminderHistory[p.id]
                if (!history || history.length === 0) return false
                const daysSinceLastReminder = Math.floor((today - new Date(history[0].sent_at)) / (1000 * 60 * 60 * 24))
                return daysSinceLastReminder < 7
              }
              const overduePledges = pledgesLoaded ? pledges.filter(p => p.status === 'pending' && new Date(p.expected_date) < today && !wasRecentlyReminded(p)) : []
              const dueSoonPledges = pledgesLoaded ? pledges.filter(p => { if (p.status !== 'pending' || wasRecentlyReminded(p)) return false; const days = Math.ceil((new Date(p.expected_date) - today) / (1000 * 60 * 60 * 24)); return days >= 0 && days <= 7 }) : []
              if (overduePledges.length > 0) items.push({ icon: '🤝', label: `${overduePledges.length} pledge${overduePledges.length > 1 ? 's' : ''} overdue — ${overduePledges.slice(0, 2).map(p => p.donor_name).join(', ')}${overduePledges.length > 2 ? ` +${overduePledges.length - 2} more` : ''}`, priority: 'high', jump: () => { setPledgeSearchTerm(''); setPledgeAmountFilter('All'); setPledgeUrgencyFilter('Overdue'); setActiveTab('pledges') } })
              if (dueSoonPledges.length > 0) items.push({ key: 'pledges_due_soon', icon: '🤝', label: `${dueSoonPledges.length} pledge${dueSoonPledges.length > 1 ? 's' : ''} due within 7 days`, priority: 'medium', jump: () => { setPledgeSearchTerm(''); setPledgeAmountFilter('All'); setPledgeUrgencyFilter('Due Soon'); setActiveTab('pledges') } })

              const wasRecurringRecentlyReminded = (g) => {
                const history = recurringReminderHistory[g.id]
                if (!history || history.length === 0) return false
                const daysSinceLastReminder = Math.floor((today - new Date(history[0].sent_at)) / (1000 * 60 * 60 * 24))
                return daysSinceLastReminder < 7
              }
              const overdueRecurring = recurringGifts.filter(g => { if (g.status !== 'active' || wasRecurringRecentlyReminded(g)) return false; const daysLate = Math.floor((today - new Date(g.next_expected_date)) / (1000 * 60 * 60 * 24)); return daysLate > 7 })
              const singleMissGiro = giroMissedCycles.filter(g => g.missedCycles < 2)
              const escalatedGiro = giroMissedCycles.filter(g => g.missedCycles >= 2)
              if (singleMissGiro.length > 0) items.push({ icon: '🔁', label: `${singleMissGiro.length} recurring gift${singleMissGiro.length > 1 ? 's' : ''} overdue — ${singleMissGiro.slice(0, 2).map(g => g.donor_name).join(', ')}${singleMissGiro.length > 2 ? ` +${singleMissGiro.length - 2} more` : ''}`, priority: 'high', jump: () => { setRecurringSearchTerm(''); setRecurringAmountFilter('All'); setRecurringTypeFilter('All'); setRecurringUrgencyFilter('Late'); setActiveTab('recurring') } })
              if (escalatedGiro.length > 0) items.push({ key: 'giro_possible_cancellation', icon: '⚠️', label: `Possible GIRO cancellation — ${escalatedGiro.slice(0, 2).map(g => g.donor_name).join(', ')}${escalatedGiro.length > 2 ? ` +${escalatedGiro.length - 2} more` : ''} missed 2+ cycles`, priority: 'high', jump: () => { setRecurringSearchTerm(''); setRecurringAmountFilter('All'); setRecurringTypeFilter('All'); setRecurringUrgencyFilter('Late'); setActiveTab('recurring') } })

              const lapsedCount = Object.values((() => { const map = {}; confirmedDonations.forEach(d => { const key = d.donor_email?.trim() || d.donor_nric || d.donor_name; if (!map[key]) map[key] = { count: 0, lastDate: d.created_at, key }; map[key].count++; if (new Date(d.created_at) > new Date(map[key].lastDate)) map[key].lastDate = d.created_at }); return map })()).filter(d => {
                if (d.count < lapsedMinGifts) return false
                const daysSince = Math.floor((today - new Date(d.lastDate)) / (1000 * 60 * 60 * 24))
                if (daysSince < lapsedMinDays) return false
                if (lapsedDismissals[d.key]) return false
                const history = lapsedReminderHistory[d.key]
                if (history && history.length > 0) {
                  const daysSinceReminder = Math.floor((today - new Date(history[0].sent_at)) / (1000 * 60 * 60 * 24))
                  if (daysSinceReminder < 30) return false
                }
                return true
              }).length
              if (lapsedCount > 0) items.push({ key: 'lapsed_donors', icon: '⏰', label: `${lapsedCount} repeat donor${lapsedCount > 1 ? 's' : ''} haven't given in ${lapsedMinDays}+ days`, priority: 'medium', jump: () => { document.getElementById('lapsed-donors-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) } })

              if (allGivingChangeFlags.length > 0) items.push({ key: 'giving_changes', icon: '📊', label: `${allGivingChangeFlags.length} donor${allGivingChangeFlags.length > 1 ? 's' : ''} with a notable giving change`, priority: 'medium', jump: () => { document.getElementById('giving-changes-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) } })

              const recurringUpgrades = recurringTrendFlags.filter(f => f.direction === 'upgrade')
              const recurringDowngrades = recurringTrendFlags.filter(f => f.direction === 'downgrade')
              if (recurringUpgrades.length > 0) items.push({ key: 'recurring_upgrades', icon: '📈', label: `${recurringUpgrades.length} recurring donor${recurringUpgrades.length > 1 ? 's' : ''} increased giving for 2 cycles in a row`, priority: 'medium', tab: 'recurring' })
              if (recurringDowngrades.length > 0) items.push({ key: 'recurring_downgrades', icon: '📉', label: `${recurringDowngrades.length} recurring donor${recurringDowngrades.length > 1 ? 's' : ''} decreased giving for 2 cycles in a row`, priority: 'medium', tab: 'recurring' })

              const majorGiftsAwaitingPersonalThanks = donations.filter(d => d.payment_status === 'confirmed' && d.amount >= thankYouThreshold && !d.thank_you_sent)
              if (majorGiftsAwaitingPersonalThanks.length > 0) items.push({ key: 'major_thanks_pending', icon: '💌', label: `${majorGiftsAwaitingPersonalThanks.length} major gift${majorGiftsAwaitingPersonalThanks.length > 1 ? 's' : ''} (${thankYouThreshold}+) waiting on a personal thank-you`, priority: 'high', jump: () => { clearDonationFilters({ keepYear: false }); setFilterThankYou('Not Sent'); setActiveTab('donations') } })

              if (recurringPatternSuggestions.length > 0) items.push({ key: 'recurring_pattern_suggestion', icon: '🔍', label: `${recurringPatternSuggestions.length} donor${recurringPatternSuggestions.length > 1 ? 's' : ''} look${recurringPatternSuggestions.length === 1 ? 's' : ''} recurring — tag them?`, priority: 'medium', tab: 'recurring' })

              const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
              const milestonesThisWeek = donations.filter(d => {
                if (d.payment_status !== 'confirmed' || new Date(d.created_at) < weekAgo) return false
                const b = donationBadgeInfo[d.id]
                return b && (b.isFirstTime || b.isBiggestYet)
              })
              const firstTimeCount = milestonesThisWeek.filter(d => donationBadgeInfo[d.id]?.isFirstTime).length
              const biggestYetCount = milestonesThisWeek.filter(d => donationBadgeInfo[d.id]?.isBiggestYet).length
              if (firstTimeCount > 0) items.push({ key: 'milestones_first_time', icon: '🆕', label: `${firstTimeCount} new donor${firstTimeCount > 1 ? 's' : ''} this week`, priority: 'medium', jump: () => { document.getElementById('donor-highlights-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) } })
              if (biggestYetCount > 0) items.push({ key: 'milestones_biggest_yet', icon: '📈', label: `${biggestYetCount} donor${biggestYetCount > 1 ? 's' : ''} gave their biggest gift yet this week`, priority: 'medium', jump: () => { document.getElementById('donor-highlights-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) } })

              // Anniversary + cumulative threshold + streak milestones
              const donorFirstGiftDate69 = {}
              const donorCumulative69 = {}
              confirmedDonations.forEach(d => {
                const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
                if (!donorFirstGiftDate69[key] || new Date(d.created_at) < new Date(donorFirstGiftDate69[key])) donorFirstGiftDate69[key] = d.created_at
                donorCumulative69[key] = (donorCumulative69[key] || 0) + d.amount
              })

              const anniversariesThisWeek = Object.entries(donorFirstGiftDate69).filter(([key, firstDate]) => {
                const fd = new Date(firstDate)
                const thisYearAnniversary = new Date(today.getFullYear(), fd.getMonth(), fd.getDate())
                const daysDiff = Math.floor((thisYearAnniversary - today) / (1000 * 60 * 60 * 24))
                return fd.getFullYear() < today.getFullYear() && daysDiff >= -7 && daysDiff <= 0
              })
              if (anniversariesThisWeek.length > 0) items.push({ key: 'donor_anniversaries', icon: '🎂', label: `${anniversariesThisWeek.length} donor${anniversariesThisWeek.length > 1 ? 's' : ''} celebrating their giving anniversary this week`, priority: 'medium', tab: 'donors' })

              const cumulativeThresholds69 = [1000, 5000, 10000]
              const crossedThresholdCount = Object.entries(donorCumulative69).filter(([key, total]) => {
                const priorTotal = total - confirmedDonations.filter(d => (d.donor_email?.trim() || d.donor_nric || d.donor_name) === key && new Date(d.created_at) >= weekAgo).reduce((s, d) => s + d.amount, 0)
                return cumulativeThresholds69.some(t => priorTotal < t && total >= t)
              }).length
              if (crossedThresholdCount > 0) items.push({ key: 'cumulative_thresholds', icon: '🏆', label: `${crossedThresholdCount} donor${crossedThresholdCount > 1 ? 's' : ''} crossed a cumulative giving milestone this week`, priority: 'medium', tab: 'donors' })

              const streakMilestones69 = [12, 24, 36, 60]
              const streakDonorMonths69 = {}
              confirmedDonations.forEach(d => {
                const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
                const dt = new Date(d.created_at)
                const monthKey = `${dt.getFullYear()}-${dt.getMonth()}`
                if (!streakDonorMonths69[key]) streakDonorMonths69[key] = new Set()
                streakDonorMonths69[key].add(monthKey)
              })
              const streakHitCount = Object.values(streakDonorMonths69).filter(months => streakMilestones69.includes(months.size)).length
              if (streakHitCount > 0) items.push({ key: 'streak_milestones', icon: '🔥', label: `${streakHitCount} donor${streakHitCount > 1 ? 's' : ''} hit a giving-streak milestone (12/24/36/60 months)`, priority: 'medium', tab: 'donors' })

              const grantReportsDue83 = grants.filter(g => {
                if (!g.report_due_date || g.status !== 'active') return false
                const days = Math.ceil((new Date(g.report_due_date) - today) / (1000 * 60 * 60 * 24))
                return days >= 0 && days <= 60
              })
              grantReportsDue83.forEach(g => {
                const days = Math.ceil((new Date(g.report_due_date) - today) / (1000 * 60 * 60 * 24))
                items.push({ key: `grant_report_${g.id}`, icon: '🏛️', label: `Report due to ${g.funder_name} in ${days} day${days !== 1 ? 's' : ''}`, priority: days <= 30 ? 'high' : 'medium', tab: 'grants' })
              })

              const majorDonorsNeedingVisit80 = donorList.filter(d => d.total >= (thankYouThreshold || 500) && !d.deactivated).map(d => {
                const donorKey80b = d.email?.trim() || d.name
                const contact80b = donorContacts.find(c => (c.email?.trim() || c.full_name) === donorKey80b)
                const lastVisited80b = contact80b?.last_visited_date
                const monthsSinceVisit80b = lastVisited80b ? (today - new Date(lastVisited80b)) / (1000 * 60 * 60 * 24 * 30) : null
                return { ...d, lastVisited: lastVisited80b, needsVisit: monthsSinceVisit80b === null || monthsSinceVisit80b >= 6 }
              }).filter(d => d.needsVisit)
              if (majorDonorsNeedingVisit80.length > 0) items.push({ key: 'major_donor_visits', icon: '🤝', label: `${majorDonorsNeedingVisit80.length} major donor${majorDonorsNeedingVisit80.length > 1 ? 's' : ''} haven't been visited in 6+ months`, priority: 'medium', tab: 'donors' })

              const seasonalPatternDonors71 = (() => {
                const byDonorMonth71 = {}
                confirmedDonations.forEach(d => {
                  const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
                  const dt = new Date(d.created_at)
                  if (!byDonorMonth71[key]) byDonorMonth71[key] = { name: d.donor_name, yearsGivingInMonth: {} }
                  const month = dt.getMonth()
                  if (!byDonorMonth71[key].yearsGivingInMonth[month]) byDonorMonth71[key].yearsGivingInMonth[month] = new Set()
                  byDonorMonth71[key].yearsGivingInMonth[month].add(dt.getFullYear())
                })
                const upcomingMonth71 = new Date(today.getFullYear(), today.getMonth() + 1, 1).getMonth()
                return Object.values(byDonorMonth71).filter(donor => {
                  const yearsInUpcomingMonth = donor.yearsGivingInMonth[upcomingMonth71]
                  return yearsInUpcomingMonth && yearsInUpcomingMonth.size >= 2
                })
              })()
              if (seasonalPatternDonors71.length > 0) items.push({ key: 'seasonal_pattern', icon: '📅', label: `${seasonalPatternDonors71.length} donor${seasonalPatternDonors71.length > 1 ? 's' : ''} usually give${seasonalPatternDonors71.length === 1 ? 's' : ''} next month — worth a soft note before they do`, priority: 'medium', tab: 'donors' })

              const birthdaysThisWeek70 = donorContacts.filter(c => {
                if (!c.birth_date) return false
                const bd = new Date(c.birth_date)
                const thisYearBday = new Date(today.getFullYear(), bd.getMonth(), bd.getDate())
                const daysUntil = Math.ceil((thisYearBday - today) / (1000 * 60 * 60 * 24))
                return daysUntil >= 0 && daysUntil <= 7
              })
              if (birthdaysThisWeek70.length > 0) items.push({ key: 'donor_birthdays', icon: '🎂', label: `${birthdaysThisWeek70.length} donor birthday${birthdaysThisWeek70.length > 1 ? 's' : ''} this week — ${birthdaysThisWeek70.slice(0, 2).map(c => c.full_name).join(', ')}${birthdaysThisWeek70.length > 2 ? ` +${birthdaysThisWeek70.length - 2} more` : ''}`, priority: 'medium', tab: 'donors' })

              const lapsedReturningCount = confirmedDonations.filter(d => {
                const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
                if (new Date(d.created_at) < weekAgo) return false
                const priorGifts = confirmedDonations.filter(p => (p.donor_email?.trim() || p.donor_nric || p.donor_name) === key && new Date(p.created_at) < new Date(d.created_at))
                if (priorGifts.length === 0) return false
                const mostRecentPrior = priorGifts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
                const gapDays = (new Date(d.created_at) - new Date(mostRecentPrior.created_at)) / (1000 * 60 * 60 * 24)
                return gapDays >= lapsedMinDays
              }).length
              if (lapsedReturningCount > 0) items.push({ key: 'lapsed_returning', icon: '🎉', label: `${lapsedReturningCount} previously lapsed donor${lapsedReturningCount > 1 ? 's' : ''} came back this week!`, priority: 'medium', tab: 'donors' })

              const obligationsDue = (() => {
                const builtIn = [
                  ...(charityIsIpc && daysToDeadline > 0 && daysToDeadline <= 30 ? [{ title: 'IRAS submission', days: daysToDeadline }] : []),
                  
                ]
                const custom = (customObligations || []).map(o => {
                  let d = new Date(o.date.replace(/\d{4}/, today.getFullYear()))
                  if (d < today) d.setFullYear(today.getFullYear() + 1)
                  const days = Math.ceil((d - today) / (1000 * 60 * 60 * 24))
                  return days >= 0 && days <= 30 ? { title: o.title, days } : null
                }).filter(Boolean)
                return [...builtIn, ...custom]
              })()
              obligationsDue.forEach(o => items.push({ key: `obligation_${o.title}`, icon: '📅', label: `${o.title} due in ${o.days} day${o.days !== 1 ? 's' : ''}`, priority: o.days <= 7 ? 'high' : 'medium', tab: 'reports' }))

              if (items.length === 0) {
                return (
                  <div style={{ borderRadius: 4, border: `1px solid ${C.border}`, background: C.white, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, color: C.forest, fontWeight: 500 }}>You're all caught up.</span>
                    <span style={{ fontSize: 13, color: C.muted }}>Nothing needs your attention right now — nice work.</span>
                  </div>
                )
              }

              const visibleItems = items.filter(i => i.priority === 'high' || !i.key || !dismissedTodayItems[i.key])
                .sort((a, b) => (a.priority === 'high' ? 0 : 1) - (b.priority === 'high' ? 0 : 1))
              const highItems = visibleItems.filter(i => i.priority === 'high')

              if (visibleItems.length === 0) {
                return (
                  <div style={{ borderRadius: 4, border: `1px solid ${C.border}`, background: C.white, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, color: C.forest, fontWeight: 500 }}>You're all caught up for today.</span>
                    <span style={{ fontSize: 13, color: C.muted }}>Nothing left to review — nice work.</span>
                  </div>
                )
              }

              return (
                <div style={{ borderRadius: 4, overflow: 'hidden', marginBottom: 16, border: `1px solid ${highItems.length > 0 ? C.red : C.warning}` }}>
                  <div style={{ background: highItems.length > 0 ? C.red : C.warning, padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: 'white' }}>{visibleItems.length} action item{visibleItems.length > 1 ? 's' : ''} need{visibleItems.length === 1 ? 's' : ''} your attention</span>
                  </div>
                  <div style={{ background: C.white, display: 'flex', flexDirection: 'column' }}>
                    {visibleItems.map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: `1px solid ${C.border}`, background: C.white, fontSize: 13 }}
                        onMouseEnter={e => e.currentTarget.style.background = C.ivory}
                        onMouseLeave={e => e.currentTarget.style.background = C.white}
                      >
                        <span style={{ color: item.priority === 'high' ? C.red : C.text, fontWeight: item.priority === 'high' ? 500 : 400, flex: 1, cursor: 'pointer' }} onClick={() => item.jump ? item.jump() : setActiveTab(item.tab)}>{item.label}</span>
                        <span style={{ fontSize: 12, color: C.sage, fontWeight: 500, fontFamily: C.fontMono, flexShrink: 0, cursor: 'pointer' }} onClick={() => item.jump ? item.jump() : setActiveTab(item.tab)}>→</span>
                        {item.priority === 'medium' && item.key && (
                          <span style={{ fontSize: 13, color: C.muted, cursor: 'pointer', flexShrink: 0, padding: '2px 6px' }} onClick={(e) => { e.stopPropagation(); dismissActionItemForToday(item.key) }} title="Dismiss for today">✕</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {(() => {
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              const builtIn = [
                ...(charityIsIpc && daysToDeadline > 0 ? [{ title: 'IRAS Tax Deduction Submission', date: new Date(today.getFullYear(), 0, 31), type: 'iras' }] : []),
              ]
              const custom = (customObligations || []).map(o => {
                let d = new Date(o.date)
                if (o.repeat === 'annual' && d < today) d.setFullYear(today.getFullYear() + (d.setFullYear(today.getFullYear()) < today ? 1 : 0))
                return { ...o, dateObj: new Date(o.date.replace(/\d{4}/, today.getFullYear())) }
              }).map(o => {
                let d = new Date(o.date.replace(/\d{4}/, today.getFullYear()))
                if (d < today) d.setFullYear(today.getFullYear() + 1)
                return { ...o, dateObj: d }
              })
              const all = [...builtIn.map(o => ({ ...o, dateObj: o.date })), ...custom]
                .sort((a, b) => a.dateObj - b.dateObj)
                .filter(o => {
                  const days = Math.ceil((o.dateObj - today) / (1000 * 60 * 60 * 24))
                  return days >= 0 && days <= 180
                })
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                  <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '18px 20px', marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: C.forest, display: 'flex', alignItems: 'center', gap: 5 }}>Upcoming Obligations <InfoTip text="Fixed-date commitments like AGM meetings, board meetings, or IRAS deadlines. Add your own under the Add button." /></div>
                      <button style={{ border: `1px solid ${C.borderStrong}`, background: C.ivory, borderRadius: 4, padding: '5px 11px', fontSize: 11.5, fontWeight: 500, color: C.forest, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setShowAddObligation(v => !v)}>+ Add</button>
                    </div>
                  {showAddObligation && (
                    <div style={{ background: C.ivory, borderRadius: 10, padding: 14, marginBottom: 12, border: `1px solid ${C.border}` }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                        <div>
                          <div style={s.formLabel}>Title</div>
                          <input style={s.formInput} placeholder="e.g. AGM, Board Meeting" value={obligationForm.title} onChange={e => setObligationForm(f => ({ ...f, title: e.target.value }))} />
                        </div>
                        <div>
                          <div style={s.formLabel}>Date</div>
                          <input style={s.formInput} type="date" value={obligationForm.date} onChange={e => setObligationForm(f => ({ ...f, date: e.target.value }))} />
                        </div>
                        <button style={{ ...s.btnForest, padding: '10px 14px' }} onClick={async () => {
                          if (!obligationForm.title.trim() || !obligationForm.date) return
                          const updated = [...(customObligations || []), { title: obligationForm.title.trim(), date: obligationForm.date, repeat: 'annual' }]
                          const { error } = await supabase.from('charity_contacts').update({ custom_obligations: updated }).eq('charity_uen', charityUen)
                          if (error) { showToast('Error saving', 'error'); return }
                          setCustomObligations(updated)
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
                        const days = Math.ceil((o.dateObj - today) / (1000 * 60 * 60 * 24))
                        const urgent = days <= 7
                        const soon = days <= 30
                        return (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: urgent ? '#FBEEE9' : soon ? '#FBF2DE' : C.ivory, borderRadius: 4, border: `1px solid ${urgent ? '#E0BBA9' : soon ? C.warningBorder : C.border}` }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: urgent ? C.red : C.forest }}>{o.title}</div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{o.dateObj.toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontFamily: C.fontMono, fontSize: 12, fontWeight: 500, color: urgent ? C.red : soon ? C.gold : C.muted }}>{days}d</span>
                              {o.type !== 'iras' && o.type !== 'coc' && (
                <span style={{ fontSize: 11, color: C.muted, cursor: 'pointer' }} onClick={async () => {
                  const updated = customObligations.filter(c => c.title !== o.title || c.date !== o.date)
                  const { error } = await supabase.from('charity_contacts').update({ custom_obligations: updated }).eq('charity_uen', charityUen)
                  if (!error) { setCustomObligations(updated); showToast('Removed') }
                }}>✕</span>
              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '18px 20px', marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.forest, display: 'flex', alignItems: 'center', gap: 5 }}>Tasks and Reminders <InfoTip text="Informal to-dos, like scheduling a call or following up with someone. Nothing here is a fixed deadline." /></div>
                    <button style={{ border: `1px solid ${C.borderStrong}`, background: C.ivory, borderRadius: 4, padding: '5px 11px', fontSize: 11.5, fontWeight: 500, color: C.forest, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setShowAddTask(v => !v)}>+ Add</button>
                  </div>
                  {showAddTask && (
                    <div style={{ background: C.ivory, borderRadius: 10, padding: 14, marginBottom: 12, border: `1px solid ${C.border}` }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                        <div>
                          <div style={s.formLabel}>Task</div>
                          <input style={s.formInput} placeholder="e.g. Call Mrs Tan back" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} />
                        </div>
                        <div>
                          <div style={s.formLabel}>Date (optional)</div>
                          <input style={s.formInput} type="date" value={taskForm.date} onChange={e => setTaskForm(f => ({ ...f, date: e.target.value }))} />
                        </div>
                        <button style={{ ...s.btnForest, padding: '10px 14px' }} onClick={async () => {
                          if (!taskForm.title.trim()) return
                          const updated = [...(customTasks || []), { title: taskForm.title.trim(), date: taskForm.date || null, done: false }]
                          const { error } = await supabase.from('charity_contacts').update({ custom_tasks: updated }).eq('charity_uen', charityUen)
                          if (error) { showToast('Error saving', 'error'); return }
                          setCustomTasks(updated)
                          setTaskForm({ title: '', date: '' })
                          setShowAddTask(false)
                          showToast('Task added ✓')
                        }}>Save</button>
                      </div>
                    </div>
                  )}
                  {(customTasks || []).filter(t => !t.done).length === 0 ? (
                    <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No open tasks right now.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(customTasks || []).filter(t => !t.done).map((t, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: C.ivory, borderRadius: 4, border: `1px solid ${C.border}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input type="checkbox" checked={false} onChange={async () => {
                              const updated = customTasks.map(x => (x.title === t.title && x.date === t.date) ? { ...x, done: true } : x)
                              const { error } = await supabase.from('charity_contacts').update({ custom_tasks: updated }).eq('charity_uen', charityUen)
                              if (!error) { setCustomTasks(updated); showToast('Task done ✓') }
                            }} />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: C.forest }}>{t.title}</div>
                              {t.date && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{new Date(t.date).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}</div>}
                            </div>
                          </div>
                          <span style={{ fontSize: 11, color: C.muted, cursor: 'pointer' }} onClick={async () => {
                            const updated = customTasks.filter(x => x.title !== t.title || x.date !== t.date)
                            const { error } = await supabase.from('charity_contacts').update({ custom_tasks: updated }).eq('charity_uen', charityUen)
                            if (!error) { setCustomTasks(updated); showToast('Removed') }
                          }}>✕</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </div>
              )
            })()}

            </div>

            <div style={{ position: 'relative', paddingLeft: 24, marginBottom: 40 }}>
              <div style={{ position: 'absolute', left: 0, top: 4, bottom: 4, width: 1, background: C.borderStrong }} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.muted }}>02</span>
                <span style={{ fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: C.forest, fontWeight: 500 }}>Financial Health</span>
              </div>

            {/* ── KEY METRICS ── */}
            {(() => {
              const now = new Date()
              const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1)
              const samePeriodLastYearStart = new Date(now.getFullYear() - 1, now.getMonth(), 1)
              const samePeriodLastYearEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
              const mtd = confirmedDonations.filter(d => new Date(d.created_at) >= mtdStart).reduce((s, d) => s + d.amount, 0)
              const lyMtd = confirmedDonations.filter(d => new Date(d.created_at) >= samePeriodLastYearStart && new Date(d.created_at) <= samePeriodLastYearEnd).reduce((s, d) => s + d.amount, 0)
              const mtdDiff = lyMtd > 0 ? Math.round(((mtd - lyMtd) / lyMtd) * 100) : null
              const coverageRatio = monthlyExpenses > 0 ? (thisMonthTotal / monthlyExpenses) : null
              const activeRecurring = recurringGifts.filter(g => g.status === 'active')
              const giroMRR = activeRecurring.filter(g => g.type === 'giro').reduce((s, g) => s + g.amount, 0)
              const habitualMRR = activeRecurring.filter(g => g.type === 'habitual_paynow').reduce((s, g) => s + g.amount, 0)
              const totalMRR = giroMRR + habitualMRR

              // New donors this month — first-ever donation falls within MTD
              const donorFirstGift = {}
              confirmedDonations.filter(d => !d.is_anonymous).forEach(d => {
                const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
                if (!donorFirstGift[key] || new Date(d.created_at) < new Date(donorFirstGift[key])) {
                  donorFirstGift[key] = d.created_at
                }
              })
              const newDonorsThisMonth = Object.values(donorFirstGift).filter(date => new Date(date) >= mtdStart).length
              const newDonorsSameMonthLY = Object.values(donorFirstGift).filter(date => new Date(date) >= samePeriodLastYearStart && new Date(date) <= samePeriodLastYearEnd).length
              const newDonorsDiff = newDonorsSameMonthLY > 0 ? Math.round(((newDonorsThisMonth - newDonorsSameMonthLY) / newDonorsSameMonthLY) * 100) : null

              const donorTotalsFH = {}
              confirmedDonations.forEach(d => {
                const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
                if (!donorTotalsFH[key]) donorTotalsFH[key] = 0
                donorTotalsFH[key] += d.amount
              })
              const sortedFH = Object.values(donorTotalsFH).sort((a, b) => b - a)
              const grandTotalFH = sortedFH.reduce((s, t) => s + t, 0)
              const top3TotalFH = sortedFH.slice(0, 3).reduce((s, t) => s + t, 0)
              const concentrationPctFH = grandTotalFH > 0 ? Math.round((top3TotalFH / grandTotalFH) * 100) : 0
              const concentrationHighRiskFH = concentrationPctFH >= 70
              const concentrationMedRiskFH = concentrationPctFH >= 50

              const thisYearNumFH = now.getFullYear()
              const lastYearNumFH = thisYearNumFH - 1
              const donorsLastYearFH = new Set(donations.filter(d => new Date(d.created_at).getFullYear() === lastYearNumFH).map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name))
              const donorsThisYearFH = new Set(donations.filter(d => new Date(d.created_at).getFullYear() === thisYearNumFH).map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name))
              const retainedFH = [...donorsLastYearFH].filter(k => donorsThisYearFH.has(k)).length
              const retentionPctFH = donorsLastYearFH.size > 0 ? Math.round((retainedFH / donorsLastYearFH.size) * 100) : null

              const threeMoAgoFH = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
              const recentTotalFH = donations.filter(d => d.payment_status === 'confirmed' && new Date(d.created_at) >= threeMoAgoFH).reduce((s, d) => s + d.amount, 0)
              const trailingAvgMonthlyFH = recentTotalFH / 3
              const runwayMonthsFH = monthlyExpenses > 0 ? (trailingAvgMonthlyFH / monthlyExpenses) : null

              return (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 20 }}>
                  {/* MTD donations */}
                  <div style={{ background: C.forest, border: `1px solid ${C.forest}`, borderRadius: 4, padding: '18px 20px' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 500, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>This Month <InfoTip text="Total confirmed donations received so far this calendar month." /></div>
                    <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: 'white', lineHeight: 1 }}>${mtd.toLocaleString()}</div>
                    {mtdDiff !== null ? (
                      <div style={{ fontSize: 11.5, color: mtdDiff >= 0 ? '#9FD9BC' : '#F0B8A8', marginTop: 6 }}>
                        {mtdDiff >= 0 ? '↑' : '↓'} {Math.abs(mtdDiff)}% vs last year
                      </div>
                    ) : (
                      <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>No prior year data</div>
                    )}
                  </div>

                  {/* Coverage ratio */}
                  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '18px 20px' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>Coverage <InfoTip text="This month's donations divided by your monthly expenses. 1.0x means you're breaking even. Set your expenses in Settings." /></div>
                    {coverageRatio === null ? (
                      <div>
                        <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>Set expenses</div>
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 8px' }} onClick={() => { setActiveTab('settings'); setTimeout(() => document.getElementById('monthly-expenses-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50) }}>Set →</button>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: coverageRatio >= 1 ? C.forest : C.red, lineHeight: 1 }}>{coverageRatio.toFixed(1)}×</div>
                        <div style={{ fontSize: 11.5, color: coverageRatio >= 1 ? C.sage : C.red, marginTop: 6, fontWeight: 500 }}>
                          {coverageRatio >= 1 ? '✓ Covering costs' : '⚠ Shortfall'}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Cash runway */}
                  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '18px 20px' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>Runway <InfoTip text="Based on your average monthly donations over the last 3 months, how many months of expenses that pace would cover. See Analytics for more detail." /></div>
                    {runwayMonthsFH === null ? (
                      <div>
                        <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>Set expenses</div>
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 8px' }} onClick={() => { setActiveTab('settings'); setTimeout(() => document.getElementById('monthly-expenses-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50) }}>Set →</button>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: runwayMonthsFH >= 3 ? C.forest : C.red, lineHeight: 1 }}>{runwayMonthsFH.toFixed(1)} mo</div>
                        <div style={{ fontSize: 11.5, color: runwayMonthsFH >= 3 ? C.sage : C.red, marginTop: 6, fontWeight: 500 }}>
                          {runwayMonthsFH >= 3 ? '✓ Healthy pace' : '⚠ Worth a closer look'}
                        </div>
                      </>
                    )}
                  </div>

                  {/* MRR */}
                  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '18px 20px' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>Recurring Donations<InfoTip text="Expected monthly income from active GIRO and habitual PayNow donors. Manage these under Recurring." /></div>
                    <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1 }}>${totalMRR.toLocaleString()}</div>
                    <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>
                      {giroMRR > 0 && <span>GIRO ${giroMRR.toLocaleString()} </span>}
                      {habitualMRR > 0 && <span>PayNow ${habitualMRR.toLocaleString()}</span>}
                      {totalMRR === 0 && <span>None set up yet</span>}
                    </div>
                  </div>

                  {/* Donor concentration */}
                  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '18px 20px' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>Donor Concentration <InfoTip text="Share of total revenue from your top 3 donors. High concentration means your income depends heavily on a small number of people. See Analytics for more detail." /></div>
                    <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: concentrationHighRiskFH ? C.red : concentrationMedRiskFH ? C.gold : C.forest, lineHeight: 1 }}>{concentrationPctFH}%</div>
                    <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>from your top 3 donors</div>
                  </div>

                  {/* Donor retention */}
                  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '18px 20px' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>Donor Retention <InfoTip text="Share of last year's donors who gave again this year. Sector average is roughly 40-45%." /></div>
                    <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: retentionPctFH === null ? C.muted : retentionPctFH >= 45 ? C.forest : retentionPctFH >= 25 ? C.gold : C.red, lineHeight: 1 }}>{retentionPctFH === null ? '—' : `${retentionPctFH}%`}</div>
                    <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>{donorsLastYearFH.size > 0 ? `${retainedFH} of ${donorsLastYearFH.size} from ${lastYearNumFH}` : 'No prior-year data'}</div>
                  </div>

                  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '18px 20px' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>Year-End Projection <InfoTip text="Extrapolates this year's giving pace so far (total confirmed donations divided by days elapsed) out to a full 365 days, to estimate where the year will land. Only shown from October, once there's enough of the year to project from." /></div>
                    {now.getMonth() < 9 ? (
                      <div style={{ fontSize: 12.5, color: C.muted }}>Available from October</div>
                    ) : (() => {
                      const yearStartYE = new Date(now.getFullYear(), 0, 1)
                      const daysElapsedYE = Math.max(1, Math.ceil((now - yearStartYE) / (1000 * 60 * 60 * 24)))
                      const ytdYE = confirmedDonations.filter(d => new Date(d.created_at) >= yearStartYE).reduce((s, d) => s + d.amount, 0)
                      const projectedYE = Math.round((ytdYE / daysElapsedYE) * 365)
                      return <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1 }}>${projectedYE.toLocaleString()}</div>
                    })()}
                  </div>

                  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '18px 20px' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>Monthly Forecast <InfoTip text="Typical range for this specific calendar month, based on what you raised in this same month in prior years. Needs at least one prior year of data for this month to show." /></div>
                    {(() => {
                      const cm = now.getMonth()
                      const priorYears = [...new Set(confirmedDonations.map(d => new Date(d.created_at).getFullYear()))].filter(y => y < now.getFullYear())
                      const histTotals = priorYears.map(y => confirmedDonations.filter(d => { const dt = new Date(d.created_at); return dt.getFullYear() === y && dt.getMonth() === cm }).reduce((s, d) => s + d.amount, 0)).filter(t => t > 0)
                      if (histTotals.length === 0) return <div style={{ fontSize: 12.5, color: C.muted }}>Needs prior year data</div>
                      const avg = histTotals.reduce((s, t) => s + t, 0) / histTotals.length
                      return <div style={{ fontFamily: C.fontVoice, fontSize: 20, fontWeight: 500, color: C.forest, lineHeight: 1.3 }}>${Math.round(avg * 0.85).toLocaleString()}–${Math.round(avg * 1.15).toLocaleString()}</div>
                    })()}
                  </div>
                </div>
              )
            })()}

            </div>

            <div style={{ position: 'relative', paddingLeft: 24, marginBottom: 40 }}>
              <div style={{ position: 'absolute', left: 0, top: 4, bottom: 4, width: 1, background: C.borderStrong }} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.muted }}>03</span>
                <span style={{ fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: C.forest, fontWeight: 500 }}>Fundraising Status</span>
              </div>

            {(() => {
              const goalYear = new Date().getFullYear()
              const totalThisGoalYear = donations.filter(d => new Date(d.created_at).getFullYear() === goalYear && d.payment_status === 'confirmed').reduce((s, d) => s + d.amount, 0)
              if (!annualGoal) return null
              const pct = Math.round((totalThisGoalYear / annualGoal) * 100)
              const yearStart = new Date(goalYear, 0, 1)
              const now5 = new Date()
              const yearEnd = new Date(goalYear, 11, 31)
              const daysElapsed = Math.max(1, Math.ceil((now5 - yearStart) / (1000 * 60 * 60 * 24)))
              const totalDaysInYear = Math.ceil((yearEnd - yearStart) / (1000 * 60 * 60 * 24))
              const dailyRate = totalThisGoalYear / daysElapsed
              const projectedTotal = Math.round(dailyRate * totalDaysInYear)
              const onTrack = projectedTotal >= annualGoal
              const gap = Math.abs(annualGoal - projectedTotal)
              return (
                <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '18px 20px', marginBottom: 20 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 12 }}>Annual Fundraising Goal — {goalYear} <InfoTip text="Total confirmed donations this calendar year against the goal you've set. Includes donations only, not grants. Set or change your goal in Settings." /></div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1 }}>${totalThisGoalYear.toLocaleString()}</span>
                    <span style={{ fontSize: 11.5, color: C.muted }}>of ${annualGoal.toLocaleString()} goal · {pct}%</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: onTrack ? C.sage : C.gold, fontWeight: 500 }}>
                    {onTrack
                      ? `✓ On pace to raise $${projectedTotal.toLocaleString()} by Dec 31 — $${gap.toLocaleString()} above goal`
                      : `⚠ On pace to raise $${projectedTotal.toLocaleString()} by Dec 31 — $${gap.toLocaleString()} short of goal`}
                  </div>
                </div>
              )
            })()}

            {(() => {
              const now03 = new Date()
              const liveCampaignsList = myCauses.filter(c => c.status === 'approved' && c.type === 'campaign' && (!c.end_date || new Date(c.end_date) >= now03))
              const campaignRevenue = liveCampaignsList.reduce((s, c) => s + (causeRaisedMap[c.id]?.total || 0), 0)
              const behindPaceCampaigns = liveCampaignsList.filter(c => {
                const stats = causeRaisedMap[c.id] || { total: 0 }
                const goal = c.target_amount || 0
                const pct = goal > 0 ? (stats.total / goal) * 100 : 100
                return goal > 0 && pct < 40
              })

              const activeGrantsList = grants.filter(g => g.status === 'active')
              const grantsReceived = activeGrantsList.reduce((s, g) => s + Number(g.amount), 0)
              const grantsSpent = activeGrantsList.reduce((s, g) => s + grantExpenses.filter(e => e.grant_id === g.id).reduce((s2, e) => s2 + Number(e.amount), 0), 0)
              const grantsRemaining = grantsReceived - grantsSpent
              const nearestGrantDeadline = activeGrantsList
                .filter(g => g.report_due_date)
                .map(g => Math.ceil((new Date(g.report_due_date) - now03) / (1000 * 60 * 60 * 24)))
                .filter(d => d >= 0)
                .sort((a, b) => a - b)[0]

              const pendingPledgesList = pledges.filter(p => p.status === 'pending')
              const overduePledgesList = pendingPledgesList.filter(p => new Date(p.expected_date) < now03)
              const upcomingPledgesList = pendingPledgesList.filter(p => new Date(p.expected_date) >= now03)
              const overduePledgeTotal = overduePledgesList.reduce((s, p) => s + Number(p.amount), 0)
              const upcomingPledgeTotal = upcomingPledgesList.reduce((s, p) => s + Number(p.amount), 0)

              const thisYearAppeals = massAppeals.filter(a => new Date(a.created_at).getFullYear() === now03.getFullYear())
              const lastAppeal = [...massAppeals].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
              const daysSinceLastAppeal = lastAppeal ? Math.floor((now03 - new Date(lastAppeal.created_at)) / (1000 * 60 * 60 * 24)) : null

              const activeRecurringList = recurringGifts.filter(g => g.status === 'active')
              const recurringMonthlyTotal = activeRecurringList.reduce((s, g) => {
                const amt = Number(g.amount) || 0
                if (g.frequency === 'weekly') return s + amt * 4.33
                if (g.frequency === 'quarterly') return s + amt / 3
                if (g.frequency === 'yearly' || g.frequency === 'annual') return s + amt / 12
                return s + amt
              }, 0)
              const escalatedGiroList = giroMissedCycles.filter(g => g.missedCycles >= 2)

              const pledgesFulfilledRevenue = pledges.filter(p => p.status === 'fulfilled').reduce((s, p) => s + Number(p.amount), 0)
              const massAppealRevenue = thisYearAppeals.reduce((s, a) => s + (Number(a.amount) || 0) * (a.sent_count || 0) / Math.max(1, a.donor_count || 1), 0)
              const totalChannelRevenue = campaignRevenue + grantsReceived + pledgesFulfilledRevenue + massAppealRevenue + recurringMonthlyTotal
              const shareOf = (amt) => totalChannelRevenue > 0 ? Math.round((amt / totalChannelRevenue) * 100) : 0

              return (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))', gap: 16, marginBottom: 20 }}>
                  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '18px 20px', cursor: 'pointer' }} onClick={() => setActiveTab('promotions')}>
                    <div style={{ fontSize: 10.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>Active Campaigns <InfoTip text="Campaigns currently live and accepting donations, and how much they've raised so far." /></div>
                    <div style={{ fontFamily: C.fontVoice, fontSize: 24, fontWeight: 500, color: C.forest, lineHeight: 1 }}>{liveCampaignsList.length}</div>
                    {behindPaceCampaigns.length > 0 ? (
                      <div style={{ fontSize: 11.5, color: C.gold, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 6 }}>⚠ "{behindPaceCampaigns[0].title}"{behindPaceCampaigns.length > 1 ? ` +${behindPaceCampaigns.length - 1} more` : ''} behind pace</div>
                    ) : liveCampaignsList.length > 0 ? (
                      <div style={{ fontSize: 11.5, color: C.sage, fontWeight: 500, marginTop: 6 }}>✓ On pace</div>
                    ) : null}
                    <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 12, paddingTop: 10 }}>
                      <div style={{ fontFamily: C.fontVoice, fontSize: 20, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>${campaignRevenue.toLocaleString()}</div>
                      <div style={{ background: C.ivoryDark, borderRadius: 6, height: 5, overflow: 'hidden', marginBottom: 4 }}>
                        <div style={{ width: `${shareOf(campaignRevenue)}%`, height: '100%', background: C.forest }} />
                      </div>
                      <div style={{ fontSize: 10, color: C.muted }}>{shareOf(campaignRevenue)}% of total revenue</div>
                    </div>
                  </div>

                  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '18px 20px', cursor: 'pointer' }} onClick={() => setActiveTab('grants')}>
                    <div style={{ fontSize: 10.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>Active Grants <InfoTip text="Grants currently active, how much of the funding remains unspent, and any upcoming funder report deadlines." /></div>
                    <div style={{ fontFamily: C.fontVoice, fontSize: 24, fontWeight: 500, color: C.forest, lineHeight: 1 }}>{activeGrantsList.length}</div>
                    {nearestGrantDeadline !== undefined ? (
                      <div style={{ fontSize: 11.5, color: nearestGrantDeadline <= 30 ? C.red : C.gold, fontWeight: 500, marginTop: 6 }}>⚠ Report due in {nearestGrantDeadline}d</div>
                    ) : activeGrantsList.length > 0 ? (
                      <div style={{ fontSize: 11.5, color: C.sage, fontWeight: 500, marginTop: 6 }}>✓ No deadlines soon</div>
                    ) : null}
                    <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 12, paddingTop: 10 }}>
                      <div style={{ fontFamily: C.fontVoice, fontSize: 20, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>${grantsReceived.toLocaleString()}</div>
                      <div style={{ background: C.ivoryDark, borderRadius: 6, height: 5, overflow: 'hidden', marginBottom: 4 }}>
                        <div style={{ width: `${shareOf(grantsReceived)}%`, height: '100%', background: C.sage }} />
                      </div>
                      <div style={{ fontSize: 10, color: C.muted }}>{shareOf(grantsReceived)}% of total revenue</div>
                    </div>
                  </div>

                  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '18px 20px', cursor: 'pointer' }} onClick={() => setActiveTab('pledges')}>
                    <div style={{ fontSize: 10.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>Pending Pledges <InfoTip text="Pledges not yet fulfilled, split into upcoming and overdue based on the expected date." /></div>
                    <div style={{ fontFamily: C.fontVoice, fontSize: 24, fontWeight: 500, color: C.forest, lineHeight: 1 }}>{pendingPledgesList.length}</div>
                    {overduePledgesList.length > 0 ? (
                      <div style={{ fontSize: 11.5, color: C.red, fontWeight: 500, marginTop: 6 }}>⚠ ${overduePledgeTotal.toLocaleString()} overdue</div>
                    ) : pendingPledgesList.length > 0 ? (
                      <div style={{ fontSize: 11.5, color: C.sage, fontWeight: 500, marginTop: 6 }}>✓ None overdue</div>
                    ) : null}
                    <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 12, paddingTop: 10 }}>
                      <div style={{ fontFamily: C.fontVoice, fontSize: 20, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>${pledgesFulfilledRevenue.toLocaleString()}</div>
                      <div style={{ background: C.ivoryDark, borderRadius: 6, height: 5, overflow: 'hidden', marginBottom: 4 }}>
                        <div style={{ width: `${shareOf(pledgesFulfilledRevenue)}%`, height: '100%', background: C.teal }} />
                      </div>
                      <div style={{ fontSize: 10, color: C.muted }}>{shareOf(pledgesFulfilledRevenue)}% of total revenue</div>
                    </div>
                  </div>

                  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '18px 20px', cursor: 'pointer' }} onClick={() => setActiveTab('massappeal')}>
                    <div style={{ fontSize: 10.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>Mass Appeals <InfoTip text="Mass appeals sent this year, and how long ago the most recent one went out." /></div>
                    <div style={{ fontFamily: C.fontVoice, fontSize: 24, fontWeight: 500, color: C.forest, lineHeight: 1 }}>{thisYearAppeals.length}</div>
                    {daysSinceLastAppeal !== null ? (
                      <div style={{ fontSize: 11.5, color: daysSinceLastAppeal > 60 ? C.gold : C.muted, fontWeight: 500, marginTop: 6 }}>{daysSinceLastAppeal > 60 ? `⚠ Last sent ${daysSinceLastAppeal}d ago` : `Last sent ${daysSinceLastAppeal}d ago`}</div>
                    ) : null}
                    <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 12, paddingTop: 10 }}>
                      <div style={{ fontFamily: C.fontVoice, fontSize: 20, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>${Math.round(massAppealRevenue).toLocaleString()}</div>
                      <div style={{ background: C.ivoryDark, borderRadius: 6, height: 5, overflow: 'hidden', marginBottom: 4 }}>
                        <div style={{ width: `${shareOf(massAppealRevenue)}%`, height: '100%', background: C.gold }} />
                      </div>
                      <div style={{ fontSize: 10, color: C.muted }}>{shareOf(massAppealRevenue)}% of total revenue</div>
                    </div>
                  </div>

                  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '18px 20px', cursor: 'pointer' }} onClick={() => setActiveTab('recurring')}>
                    <div style={{ fontSize: 10.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>Recurring Giving <InfoTip text="Active GIRO and habitual PayNow donors, expected monthly income, and whether any have missed 2 or more cycles." /></div>
                    <div style={{ fontFamily: C.fontVoice, fontSize: 24, fontWeight: 500, color: C.forest, lineHeight: 1 }}>{activeRecurringList.length}</div>
                    {escalatedGiroList.length > 0 ? (
                      <div style={{ fontSize: 11.5, color: C.red, fontWeight: 500, marginTop: 6 }}>⚠ {escalatedGiroList.length} missed 2+ cycles</div>
                    ) : activeRecurringList.length > 0 ? (
                      <div style={{ fontSize: 11.5, color: C.sage, fontWeight: 500, marginTop: 6 }}>✓ All on schedule</div>
                    ) : null}
                    <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 12, paddingTop: 10 }}>
                      <div style={{ fontFamily: C.fontVoice, fontSize: 20, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>${Math.round(recurringMonthlyTotal).toLocaleString()}<span style={{ fontSize: 12, color: C.muted }}>/mo</span></div>
                      <div style={{ background: C.ivoryDark, borderRadius: 6, height: 5, overflow: 'hidden', marginBottom: 4 }}>
                        <div style={{ width: `${shareOf(recurringMonthlyTotal)}%`, height: '100%', background: C.muted }} />
                      </div>
                      <div style={{ fontSize: 10, color: C.muted }}>{shareOf(recurringMonthlyTotal)}% of total revenue</div>
                    </div>
                  </div>
                </div>
              )
            })()}
            

            </div>

            
            

            

            

            {false && (() => { return (
                <div style={s.tableCard}>
                  <div style={s.tableHeader}>
                    <div style={s.tableTitle}>Needs your attention</div>
                  </div>
                  {false ? (
                    <div style={s.empty}>Nothing needs action right now.</div>
                  ) : (isMobile || isTablet) ? (
                    <div>
                      {pageDonations.map(d => (
                        <div key={d.id} style={s.donationCard} onClick={() => goToDonation(d)}>
                          <div style={s.donationCardTop}>
                            <div style={s.donationCardDonor}>
                              <div style={{ ...s.donorAvatar, background: d.payment_status !== 'confirmed' ? C.red : !d.thank_you_sent ? C.gold : C.sage }}>{d.donor_name?.charAt(0)}</div>
                              <div>
                                <div style={s.donationCardName}>{d.donor_name}</div>
                                <div style={s.donationCardDate}>{new Date(d.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                              </div>
                            </div>
                            <div style={s.donationCardAmount}>${Number(d.amount).toLocaleString()}</div>
                          </div>
                          <div style={{ fontSize: 11, fontFamily: 'monospace', color: C.muted, marginBottom: 6 }}>{d.payment_ref || d.receipt_number || '—'}</div>
                          <div style={s.donationCardBadges}>
                            {causeNameForDonation(d) && <span style={{ fontSize: 10, fontWeight: 500, color: C.gold, background: '#FDF8EC', padding: '3px 10px', borderRadius: 20, display: 'inline-block' }}>🎯 {causeNameForDonation(d)}</span>}
                            {d.receipt_issued ? <span style={s.badgeIssued}>✓ Issued</span> : <span style={s.badgePending}>Receipt pending</span>}
                            {charityIsIpc && !d.donor_nric && <span style={s.badgePending}>⚠️ NRIC missing</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <table style={s.table}>
                      <thead>
                        <tr>{(charityIsIpc ? (isTablet ? ['Donor', 'Amount', 'Date', 'NRIC', 'Receipt'] : ['Donor', 'Amount', 'Date', 'Cause', 'Source', 'NRIC', 'Payment', 'Receipt', 'Receipt No.', 'Thank You']) : (isTablet ? ['Donor', 'Amount', 'Date', 'Receipt'] : ['Donor', 'Amount', 'Date', 'Cause', 'Source', 'Payment', 'Receipt', 'Receipt No.', 'Thank You'])).map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {pageDonations.map(d => {
                          const railColor = d.payment_status !== 'confirmed' ? C.red : !d.thank_you_sent ? C.gold : C.sage
                          return (
                          <tr key={d.id} style={{ ...s.tr, borderLeft: `3px solid ${railColor}`, cursor: 'pointer' }} onClick={() => goToDonation(d)}>
                            <td style={s.td}><div style={s.donorCell}><div style={{ ...s.donorAvatar, background: d.payment_status !== 'confirmed' ? C.red : !d.thank_you_sent ? C.gold : C.sage }}>{d.donor_name?.charAt(0)}</div><div><div style={s.donorName}>{d.donor_name}</div>{d.notes && <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', marginTop: 2 }}>📝 {d.notes}</div>}</div></div></td>
                            {isTablet && <td style={s.td}><span style={s.amountText}>${Number(d.amount).toLocaleString()}</span></td>}
                            {isTablet && <td style={s.td}><span style={s.dateText}>{new Date(d.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</span></td>}
                            {isTablet ? (
                              <>
                                {charityIsIpc && <td style={s.td}>{d.donor_nric ? <span style={s.badgeIssued}>✓ {d.donor_nric}</span> : <span style={s.badgePending}>⚠️ Missing</span>}</td>}
                                <td style={s.td}>
                                  {d.payment_status === 'confirmed' ? <span style={s.badgeIssued}>✓ Paid</span> : <span style={s.badgePending}>⚠️ Unverified</span>}
                                </td>
                                <td style={s.td}>{d.receipt_issued ? <span style={s.badgeIssued}>✓ Issued</span> : <span style={s.badgePending}>Pending</span>}</td>
                              </>
                            ) : (() => {
                              const cellRenderers = {
                                cause: (
                                  <td key="cause" style={s.td}>
                                    {causeNameForDonation(d) ? (
                                      <span style={{ fontSize: 10, fontWeight: 500, color: C.gold, background: '#FDF8EC', padding: '3px 10px', borderRadius: 20, display: 'inline-block', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={causeNameForDonation(d)}>🎯 {causeNameForDonation(d)}</span>
                                    ) : (
                                      <span style={{ fontSize: 11, color: C.muted }}>General</span>
                                    )}
                                  </td>
                                ),
                                source: <td key="source" style={s.td}>{d.source === 'manual' ? <span style={{ ...s.badgePending, color: C.gold, background: '#FDF8EC' }}>✏️ {d.payment_method || 'Manual'}</span> : <span style={s.badgeIssued}>📱 App</span>}</td>,
                                nric: charityIsIpc ? <td key="nric" style={s.td}>{d.donor_nric ? <span style={s.badgeIssued}>✓ {d.donor_nric}</span> : <span style={s.badgePending}>⚠️ Missing</span>}</td> : null,
                                payment: (
                                  <td key="payment" style={s.td}>
                                    {d.payment_status === 'confirmed' ? <span style={s.badgeIssued}>✓ Paid</span> : (
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                                        <span style={s.badgePending}>⚠️ Unverified</span>
                                        <button
                                          style={{ fontSize: 10, fontWeight: 700, color: C.teal, background: 'white', border: `1px solid ${C.teal}`, borderRadius: 20, padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setConfirmModal({
                                              title: 'Confirm this payment?',
                                              subtitle: 'Check the transaction reference against your bank or PayNow statement before confirming.',
                                              donorName: d.donor_name,
                                              amount: d.amount,
                                              reference: d.payment_ref || d.receipt_number,
                                              steps: ['Mark payment as confirmed', 'Issue a receipt'],
                                              receiptPreviewDonation: d,
                                              confirmLabel: 'Confirm payment',
                                              onConfirm: () => confirmPaymentFlow(d),
                                            })
                                          }}
                                        >✓ Confirm</button>
                                      </div>
                                    )}
                                  </td>
                                ),
                                receipt: <td key="receipt" style={s.td}>{d.receipt_issued ? <span style={s.badgeIssued}>✓ Issued</span> : <span style={s.badgePending}>Pending</span>}</td>,
                                receiptNo: <td key="receiptNo" style={s.td}><span style={{ fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{d.payment_ref || d.receipt_number || '—'}</span></td>,
                                thankYou: <td key="thankYou" style={s.td}>{d.thank_you_sent ? <span style={s.badgeIssued}>💌 Sent</span> : <span style={{ fontSize: 10, color: C.muted }}>—</span>}</td>,
                              }
                              return selectedDonationColumns.map(key => cellRenderers[key]).filter(Boolean)
                            })()}
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                  </div>
              )
            })()}

            </div>
        )}

        {/* ── DONORS ── */}
        {activeTab === 'donors' && !selectedDonor && (
          <div style={s.content}>
            <div style={s.pageHeader}>
              <div>
                <div style={s.pageTitle}>Donors</div>
                <div style={s.pageSub}>{combinedDonorList.length} donors · All time</div>
              </div>
              <button style={s.btnGold} onClick={() => { setAddDonorForm({ full_name: '', email: '', notes: '' }); setAddDonorError(''); setShowAddDonorModal(true) }}>+ Add Donor</button>
            </div>
            {filterTopDonorNames && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 4, padding: '10px 14px', marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: C.forest, fontWeight: 500 }}>Showing top {filterTopDonorNames.length} donors by lifetime giving</span>
                <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px', marginLeft: 'auto' }} onClick={() => setFilterTopDonorNames(null)}>✕ Clear</button>
              </div>
            )}
            
            {(() => {
              const allTags = [...new Set(Object.values(donorTagsMap).flat().map(t => t.tag))].sort()
              return (
                <div style={isMobile ? { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 } : { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input style={isMobile ? s.searchBox : { ...s.searchBox, flex: 'none', width: 240 }} placeholder="🔍 Search donors..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  <select style={s.filterSelect} value={filterDonorTag} onChange={e => setFilterDonorTag(e.target.value)}>
                    <option value="All">All Tags</option>
                    {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select style={s.filterSelect} value={donorStatusFilter} onChange={e => setDonorStatusFilter(e.target.value)}>
                    <option value="All">All Statuses</option>
                    <option value="Active">Active donors</option>
                    <option value="Prospect">Prospects (no gift yet)</option>
                    <option value="DoNotContact">Do Not Contact</option>
                    <option value="Deactivated">Deactivated</option>
                  </select>
                  <select style={s.filterSelect} value={donorYearFilter} onChange={e => setDonorYearFilter(e.target.value)}>
                    <option value="All">All years (last donation)</option>
                    {[...new Set(donations.filter(d => d.payment_status === 'confirmed').map(d => new Date(d.created_at).getFullYear()))].sort((a, b) => b - a).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  {(searchTerm !== '' || filterDonorTag !== 'All' || donorStatusFilter !== 'All' || donorYearFilter !== 'All') && (
                    <button style={{ ...s.viewBtn, whiteSpace: 'nowrap' }} onClick={() => { setSearchTerm(''); setFilterDonorTag('All'); setDonorStatusFilter('All'); setDonorYearFilter('All') }}>✕ Clear Filters</button>
                  )}
                  <button style={isMobile ? { ...s.exportSmallBtn, width: '100%' } : s.exportSmallBtn} onClick={async () => {
                    const q = searchTerm.toLowerCase()
                    const filtered = combinedDonorList.filter(d => {
                      const matchesSearch = d.name?.toLowerCase().includes(q)
                      const donorKey = d.email?.trim() || d.name
                      const matchesTag = filterDonorTag === 'All' || (donorTagsMap[donorKey] || []).some(t => t.tag === filterDonorTag)
                      const matchesStatus = donorStatusFilter === 'All'
                        || (donorStatusFilter === 'Active' && !d.isContactOnly && !d.deactivated)
                        || (donorStatusFilter === 'Prospect' && d.isContactOnly)
                        || (donorStatusFilter === 'DoNotContact' && d.doNotContact)
                        || (donorStatusFilter === 'Deactivated' && d.deactivated)
                      const matchesYear = donorYearFilter === 'All' || (d.lastDate && new Date(d.lastDate).getFullYear().toString() === donorYearFilter)
                      return matchesSearch && matchesTag && matchesStatus && matchesYear
                    })
                    showToast('Preparing export...')
                    await exportDonorsExcel(combinedDonorList)
                  }}>⬇️ Export to Excel</button>
                  {charityIsIpc && (
                    <button style={isMobile ? { ...s.exportSmallBtn, width: '100%' } : s.exportSmallBtn} onClick={() => { if (filterYear === 'All') { showToast('Select a year first to export IRAS data'); return } exportIRASExcel() }}>⬇️ Export IRAS</button>
                  )}
                  {!isMobile && !isTablet && (
                    <div style={{ position: 'relative' }}>
                      <button style={s.exportSmallBtn} onClick={() => setShowColumnPicker(v => !v)}>⚙️ Columns</button>
                      {showColumnPicker && (
                        <>
                          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowColumnPicker(false)} />
                          <div style={{ position: 'absolute', top: '110%', right: 0, background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 10, zIndex: 50, minWidth: 200 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Show columns</div>
                            {DONOR_COLUMN_OPTIONS.map(opt => (
                              <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', fontSize: 13, color: C.forest, cursor: 'pointer' }}>
                                <input type="checkbox" checked={selectedDonorColumns.includes(opt.key)} onChange={() => toggleDonorColumn(opt.key)} />
                                {opt.label}
                              </label>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}
            <div style={s.tableCard}>
              <div style={s.tableHeader}>
                <div style={s.tableTitle}>All Donors</div>
                <div style={s.tableCount}>{activeDonorList.length} active · {deactivatedDonorList.length} deactivated</div>
              </div>
              {loading ? <div style={s.empty}>Loading...</div> : activeDonorList.length === 0 ? <div style={s.empty}>No donors yet.</div> : (isMobile || isTablet) ? (
                <div>
                  {combinedDonorList.filter(d => {
                    const matchSearch = d.name?.toLowerCase().includes(searchTerm.toLowerCase())
                    const donorKey = d.email?.trim() || d.name
                    const matchTag = filterDonorTag === 'All' || (donorTagsMap[donorKey] || []).some(t => t.tag === filterDonorTag)
                    const matchTopDonors = !filterTopDonorNames || filterTopDonorNames.includes(d.name)
                    return matchSearch && matchTag && matchTopDonors
                  }).map((d, i) => (
                    <div key={i} style={s.donationCard} onClick={() => setSelectedDonor(d)}>
                      <div style={s.donationCardTop}>
                        <div style={s.donationCardDonor}>
                          <div style={{ ...s.donorAvatar, background: C.forest }}>{d.name?.charAt(0)}</div>
                          <div>
                            <div style={s.donationCardName}>{d.name}</div>
                            <div style={s.donationCardDate}>{d.isContactOnly ? 'No donations yet' : `${d.count} donation${d.count > 1 ? 's' : ''} · Last ${new Date(d.lastDate).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}`}</div>
                          </div>
                        </div>
                        <div style={s.donationCardAmount}>${d.total.toLocaleString()}</div>
                      </div>
                      <div style={s.donationCardBadges}>
                        {d.isContactOnly ? (
                          <span style={{ ...s.badgePending, color: C.gold, background: '#FBF2DE' }}>👤 Prospect — no gift yet</span>
                        ) : (
                          <span style={d.receipts === d.count ? s.badgeIssued : s.badgePending}>{d.receipts}/{d.count} receipts issued</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <table style={s.table}>
                  <thead>
                  <tr>{(isTablet ? ['Donor', 'Total Given', 'Avg. Donation'] : ['Donor', ...DONOR_COLUMN_OPTIONS.filter(o => selectedDonorColumns.includes(o.key)).map(o => o.label)]).map(h => <th key={h} style={{ ...s.th, width: h === 'Donor' ? 260 : undefined, whiteSpace: 'nowrap' }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {combinedDonorList.filter(d => {
                      const matchSearch = d.name?.toLowerCase().includes(searchTerm.toLowerCase())
                      const donorKey = d.email?.trim() || d.name
                      const matchTag = filterDonorTag === 'All' || (donorTagsMap[donorKey] || []).some(t => t.tag === filterDonorTag)
                      const matchTopDonors = !filterTopDonorNames || filterTopDonorNames.includes(d.name)
                      return matchSearch && matchTag && matchTopDonors
                    }).map((d, i) => {
                      const key = d.email?.trim() || d.name
                      const b = donorBadgeMap[key]
                      const avgDonationForDonor = d.count > 0 ? Math.round(d.total / d.count) : 0
                      const donorKey = d.email?.trim() || d.name
                      const tags = donorTagsMap[donorKey] || []
                      return (
                        <tr key={i} style={{ ...s.tr, cursor: 'pointer' }} onClick={() => setSelectedDonor(d)}>
                          <td style={s.td}>
                            <div style={s.donorCell}>
                              <div style={{ ...s.donorAvatar, background: C.forest }}>{d.name?.charAt(0)}</div>
                              <div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                                  <div style={s.donorName}>{d.name}</div>
                                  {d.doNotContact && <span style={{ fontSize: 10, fontWeight: 600, color: C.red, background: '#FBEEE9', padding: '2px 7px', borderRadius: 4 }}>🚫 DNC</span>}
                                  {d.isContactOnly && <span style={{ fontSize: 10, fontWeight: 600, color: C.gold, background: '#FBF2DE', padding: '2px 7px', borderRadius: 4 }}>👤 Prospect</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                          {isTablet ? (
                            <>
                              <td style={s.td}><span style={s.amountText}>${d.total.toLocaleString()}</span></td>
                              <td style={s.td}><span style={s.amountText}>{d.count > 0 ? `$${avgDonationForDonor.toLocaleString()}` : '—'}</span></td>
                            </>
                          ) : (() => {
                            const openPledge = pledges.find(p => p.status === 'pending' && (p.donor_email?.trim() || p.donor_name) === donorKey)
                            const activeRecurring = recurringGifts.find(g => g.status === 'active' && (g.donor_email?.trim() || g.donor_name) === donorKey)
                            const cellRenderers = {
                              total: <td key="total" style={s.td}><span style={s.amountText}>${d.total.toLocaleString()}</span></td>,
                              count: <td key="count" style={s.td}><span style={s.dateText}>{d.count} donation{d.count !== 1 ? 's' : ''}</span></td>,
                              avg: <td key="avg" style={s.td}><span style={s.amountText}>{d.count > 0 ? `$${avgDonationForDonor.toLocaleString()}` : '—'}</span></td>,
                              lastDate: <td key="lastDate" style={s.td}><span style={s.dateText}>{d.lastDate ? new Date(d.lastDate).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span></td>,
                              tags: (
                                <td key="tags" style={s.td}>
                                  {tags.length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                      {tags.map(t => (
                                        <span key={t.id} style={{ fontSize: 10, fontWeight: 500, color: C.forest, background: C.ivory, border: `1px solid ${C.border}`, padding: '2px 7px', borderRadius: 4 }}>{t.tag}</span>
                                      ))}
                                    </div>
                                  ) : <span style={{ fontSize: 11, color: C.muted }}>—</span>}
                                </td>
                              ),
                              milestones: (
                                <td key="milestones" style={s.td}>
                                  {b && (b.isFirstTime || b.isBigGift || b.isLoyal || b.isBiggestYet) ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                      {b.isFirstTime && <span style={{ ...s.badgeIssued, color: C.gold, background: '#FDF8EC' }}>🆕 First gift</span>}
                                      {b.isBigGift && <span style={s.badgeIssued}>💰 Big gift</span>}
                                      {b.isLoyal && <span style={{ ...s.badgeIssued, color: C.sage, background: C.successBg }}>🔁 Loyal</span>}
                                      {b.isBiggestYet && <span style={{ ...s.badgeIssued, color: C.gold, background: '#FDF8EC' }}>📈 Biggest yet</span>}
                                    </div>
                                  ) : <span style={{ fontSize: 11, color: C.muted }}>—</span>}
                                </td>
                              ),
                              recurring: (
                                <td key="recurring" style={s.td}>
                                  {activeRecurring ? <span style={s.badgeIssued}>🔁 ${activeRecurring.amount}/{activeRecurring.frequency}</span> : <span style={{ fontSize: 11, color: C.muted }}>—</span>}
                                </td>
                              ),
                              warmth: (
                                <td key="warmth" style={s.td}>
                                  {(() => {
                                    const w76 = getDonorWarmth(d)
                                    const wColor76 = w76.level === 'green' ? C.sage : w76.level === 'amber' ? C.gold : C.red
                                    return (
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: wColor76, flexShrink: 0 }} />
                                        <span style={{ fontSize: 11, color: C.muted }}>{w76.label}</span>
                                      </div>
                                    )
                                  })()}
                                </td>
                              ),
                              pledge: (
                                <td key="pledge" style={s.td}>
                                  {openPledge ? <span style={s.badgePending}>${openPledge.amount.toLocaleString()} pending</span> : <span style={{ fontSize: 11, color: C.muted }}>—</span>}
                                </td>
                              ),
                            }
                            return DONOR_COLUMN_OPTIONS.filter(o => selectedDonorColumns.includes(o.key)).map(o => cellRenderers[o.key])
                          })()}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── DONOR DETAIL ── */}
        {activeTab === 'donors' && selectedDonor && (
          <div style={s.content}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <button style={s.backBtn} onClick={() => setSelectedDonor(null)}>← Back to Donors</button>
            </div>
            {selectedDonor.doNotContact && (
              <div style={{ background: '#FBEEE9', border: `1px solid ${C.red}`, borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.red }}>🚫 Do Not Contact — this donor is excluded from all emails, appeals, and outreach.</span>
              </div>
            )}
            <div style={isMobile ? s.twoColMobile : s.twoCol}>
              <div>
                <div style={{ background: C.forest, borderRadius: 4, padding: '20px 18px', marginBottom: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.gold, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontFamily: C.fontVoice, fontWeight: 500, marginBottom: 12 }}>{selectedDonor.name?.charAt(0)}</div>
                  <div style={{ fontFamily: C.fontVoice, fontSize: 19, fontWeight: 500, color: 'white', marginBottom: 4 }}>{selectedDonor.name}</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)' }}>Donor since {new Date(donations.filter(d => (d.donor_email?.trim() || d.donor_name) === (selectedDonor.email?.trim() || selectedDonor.name)).slice(-1)[0]?.created_at).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })}</div>
                  {(() => {
                    const warmth76 = getDonorWarmth(selectedDonor)
                    const warmthColor76 = warmth76.level === 'green' ? '#74C69D' : warmth76.level === 'amber' ? '#E8CC7A' : '#E0A599'
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: warmthColor76 }} />
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{warmth76.label}</span>
                      </div>
                    )
                  })()}
                </div>
                <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 12 }}>Giving Summary</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                    <div style={{ background: C.forest, borderRadius: 4, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Total Given</div>
                      <div style={{ fontFamily: C.fontVoice, fontSize: 18, fontWeight: 500, color: 'white' }}>${selectedDonor.total.toLocaleString()}</div>
                    </div>
                    <div style={{ background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 4, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: C.muted, marginBottom: 4 }}>Donations</div>
                      <div style={{ fontFamily: C.fontMono, fontSize: 16, fontWeight: 500, color: C.forest }}>{selectedDonor.count}</div>
                    </div>
                    <div style={{ background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 4, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: C.muted, marginBottom: 4 }}>Avg. Donation</div>
                      <div style={{ fontFamily: C.fontMono, fontSize: 16, fontWeight: 500, color: C.forest }}>${(selectedDonor.total / selectedDonor.count).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div style={{ background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 4, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: C.muted, marginBottom: 4 }}>Receipts</div>
                      <div style={{ fontFamily: C.fontMono, fontSize: 16, fontWeight: 500, color: C.forest }}>{selectedDonor.receipts}/{selectedDonor.count}</div>
                    </div>
                  </div>
                  {charityIsIpc && (
                    <div style={{ marginTop: 14, padding: 12, background: C.ivory, borderRadius: 4, border: `1px solid ${C.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 11.5, color: C.muted }}>250% Tax Deductible</span>
                        <span style={{ fontFamily: C.fontMono, fontSize: 11.5, fontWeight: 500, color: C.forest }}>${(selectedDonor.total * 2.5).toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11.5, color: C.muted }}>Est. Tax Savings (22%)</span>
                        <span style={{ fontFamily: C.fontMono, fontSize: 11.5, fontWeight: 500, color: C.sage }}>${(selectedDonor.total * 2.5 * 0.22).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Duplicate Donor?</div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 12 }}>If this is the same person as another donor record, merge their giving history together. This cannot be undone.</div>
                  {(() => {
                    const enteredName39 = selectedDonor.name.trim().toLowerCase()
                    const similarDonors39 = combinedDonorList.filter(d => {
                      if ((d.email?.trim() || d.name) === (selectedDonor.email?.trim() || selectedDonor.name)) return false
                      const existing = d.name.trim().toLowerCase()
                      if (existing === enteredName39) return true
                      if (existing.includes(enteredName39) || enteredName39.includes(existing)) return true
                      const longer = existing.length > enteredName39.length ? existing : enteredName39
                      const shorter = existing.length > enteredName39.length ? enteredName39 : existing
                      let matches = 0
                      for (const char of shorter) { if (longer.includes(char)) matches++ }
                      return (matches / longer.length) >= 0.8 && Math.abs(existing.length - enteredName39.length) <= 4
                    })
                    if (similarDonors39.length === 0) return <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}>No similar donor names found.</div>
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {similarDonors39.slice(0, 3).map((d, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px' }}>
                            <span style={{ fontSize: 12.5, color: C.forest }}><strong>{d.name}</strong> — {d.count} gift{d.count !== 1 ? 's' : ''}, ${d.total.toLocaleString()}</span>
                            <button
                              style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px' }}
                              onClick={() => {
                                setConfirmModal({
                                  title: `Merge ${selectedDonor.name} into ${d.name}?`,
                                  subtitle: `All of ${selectedDonor.name}'s donations will be reassigned to ${d.name}. This cannot be undone.`,
                                  confirmLabel: 'Merge donors',
                                  onConfirm: () => mergeDonorInto(selectedDonor, d.email?.trim() || d.name),
                                })
                              }}
                            >Merge into this donor</button>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>

                <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Communication Preferences</div>
                  {(() => {
                    const donorKey44 = selectedDonor.email?.trim() || selectedDonor.name
                    const contact44 = donorContacts.find(c => (c.email?.trim() || c.full_name) === donorKey44)
                    return (
                      <div>
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 4 }}>Preferred channel</div>
                          <select style={s.formInput} defaultValue={contact44?.preferred_channel || ''} id={`pref-channel-${donorKey44}`}>
                            <option value="">No preference set</option>
                            <option value="email">Email</option>
                            <option value="whatsapp">WhatsApp</option>
                            <option value="phone">Phone</option>
                            <option value="post">Post</option>
                          </select>
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 4 }}>Preferred timing</div>
                          <input style={s.formInput} placeholder="e.g. weekday mornings, not evenings" defaultValue={contact44?.preferred_timing || ''} id={`pref-timing-${donorKey44}`} />
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 4 }}>Restrictions</div>
                          <textarea style={{ ...s.formInput, minHeight: 50, resize: 'vertical' }} placeholder="e.g. no calls at work, appeals only, no event invites" defaultValue={contact44?.communication_restrictions || ''} id={`pref-restrictions-${donorKey44}`} />
                        </div>
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} onClick={async () => {
                          const channel = document.getElementById(`pref-channel-${donorKey44}`).value
                          const timing = document.getElementById(`pref-timing-${donorKey44}`).value.trim()
                          const restrictions = document.getElementById(`pref-restrictions-${donorKey44}`).value.trim()
                          if (contact44) {
                            await supabase.from('charity_donor_contacts').update({ preferred_channel: channel || null, preferred_timing: timing || null, communication_restrictions: restrictions || null }).eq('id', contact44.id)
                          } else {
                            await supabase.from('charity_donor_contacts').insert({ charity_uen: charityUen, full_name: selectedDonor.name, email: selectedDonor.email || null, preferred_channel: channel || null, preferred_timing: timing || null, communication_restrictions: restrictions || null, created_by: session.user.email })
                          }
                          showToast('Saved ✓')
                          loadDonorContacts()
                        }}>Save Preferences</button>
                      </div>
                    )
                  })()}
                </div>

                <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Household</div>
                  {(() => {
                    const donorKey43 = selectedDonor.email?.trim() || selectedDonor.name
                    const myContact43 = donorContacts.find(c => (c.email?.trim() || c.full_name) === donorKey43)
                    const householdMembers43 = myContact43?.household_id
                      ? donorContacts.filter(c => c.household_id === myContact43.household_id && c.id !== myContact43.id)
                      : []
                    if (myContact43?.household_id && householdMembers43.length > 0) {
                      const householdTotal43 = combinedDonorList
                        .filter(d => [selectedDonor, ...householdMembers43.map(m => ({ name: m.full_name, email: m.email }))]
                          .some(m => (m.email?.trim() || m.name) === (d.email?.trim() || d.name)))
                        .reduce((s, d) => s + (d.total || 0), 0)
                      return (
                        <div>
                          <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10 }}>Combined household giving: <strong style={{ color: C.forest }}>${householdTotal43.toLocaleString()}</strong></div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {householdMembers43.map(m => (
                              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px' }}>
                                <span style={{ fontSize: 12.5, color: C.forest }}>{m.full_name}</span>
                                <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px' }} onClick={() => unlinkFromHousehold({ name: m.full_name, email: m.email })}>Unlink</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    }
                    return (
                      <div>
                        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10 }}>Link this donor to a spouse or family member to see combined household giving.</div>
                        <input
                          style={{ ...s.formInput, marginBottom: 8 }}
                          placeholder="Search donor by name..."
                          value={householdLinkSearch}
                          onChange={e => setHouseholdLinkSearch(e.target.value)}
                        />
                        {householdLinkSearch.trim() && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                            {combinedDonorList.filter(d =>
                              (d.email?.trim() || d.name) !== donorKey43 &&
                              d.name.toLowerCase().includes(householdLinkSearch.toLowerCase())
                            ).slice(0, 5).map((d, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px' }}>
                                <span style={{ fontSize: 12.5, color: C.forest }}>{d.name}</span>
                                <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px' }} onClick={async () => { await linkDonorToHousehold(selectedDonor, d); setHouseholdLinkSearch('') }}>Link</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>

                <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Receipt Name Override</div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 12 }}>If this donor's receipts should show a different name (e.g. a spouse or company), set it once here — it'll apply to all future receipts automatically.</div>
                  {(() => {
                    const donorKey31 = selectedDonor.email?.trim() || selectedDonor.name
                    const existingContact = donorContacts.find(c => (c.email?.trim() || c.full_name) === donorKey31)
                    const [localOverride, setLocalOverride] = [donorReceiptNameOverrides[donorKey31] || '', null]
                    return (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          style={{ ...s.formInput, flex: 1 }}
                          placeholder="Leave blank to use donor name"
                          defaultValue={localOverride}
                          id={`receipt-override-${donorKey31}`}
                        />
                        <button style={{ ...s.viewBtn, flexShrink: 0 }} onClick={async () => {
                          const inputEl = document.getElementById(`receipt-override-${donorKey31}`)
                          const value = inputEl.value.trim()
                          if (existingContact) {
                            const { error } = await supabase.from('charity_donor_contacts').update({ receipt_name_override: value || null }).eq('id', existingContact.id)
                            if (error) { showToast('Error saving', 'error'); return }
                          } else {
                            const { error } = await supabase.from('charity_donor_contacts').insert({
                              charity_uen: charityUen,
                              full_name: selectedDonor.name,
                              email: selectedDonor.email || null,
                              receipt_name_override: value || null,
                              created_by: session.user.email,
                            })
                            if (error) { showToast('Error saving', 'error'); return }
                          }
                          setDonorReceiptNameOverrides(prev => ({ ...prev, [donorKey31]: value }))
                          showToast('Saved ✓')
                          loadDonorContacts()
                        }}>Save</button>
                      </div>
                    )
                  })()}
                  {selectedDonor.deceased && (() => {
                    const donorKey41b = selectedDonor.email?.trim() || selectedDonor.name
                    const existingContact41b = donorContacts.find(c => (c.email?.trim() || c.full_name) === donorKey41b)
                    return (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${C.border}` }}>
                        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 6 }}>Family member / estate executor contact (optional)</div>
                        <input
                          style={{ ...s.formInput, fontSize: 12 }}
                          placeholder="Name and contact info"
                          defaultValue={existingContact41b?.linked_family_contact || ''}
                          id={`family-contact-${donorKey41b}`}
                        />
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', marginTop: 6 }} onClick={async () => {
                          const value = document.getElementById(`family-contact-${donorKey41b}`).value.trim()
                          if (existingContact41b) {
                            await supabase.from('charity_donor_contacts').update({ linked_family_contact: value || null }).eq('id', existingContact41b.id)
                          } else {
                            await supabase.from('charity_donor_contacts').insert({ charity_uen: charityUen, full_name: selectedDonor.name, email: selectedDonor.email || null, linked_family_contact: value || null, created_by: session.user.email })
                          }
                          showToast('Saved ✓')
                          loadDonorContacts()
                        }}>Save</button>
                      </div>
                    )
                  })()}
                  {(() => {
                    const donorKey80 = selectedDonor.email?.trim() || selectedDonor.name
                    const existingContact80 = donorContacts.find(c => (c.email?.trim() || c.full_name) === donorKey80)
                    return (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 6 }}>Visit scheduling (for major donors)</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 6 }}>
                          <div>
                            <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 3 }}>Last visited</div>
                            <input style={{ ...s.formInput, fontSize: 12 }} type="date" defaultValue={existingContact80?.last_visited_date || ''} id={`last-visited-${donorKey80}`} />
                          </div>
                          <div>
                            <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 3 }}>Next visit planned</div>
                            <input style={{ ...s.formInput, fontSize: 12 }} type="date" defaultValue={existingContact80?.next_visit_planned_date || ''} id={`next-visit-${donorKey80}`} />
                          </div>
                        </div>
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} onClick={async () => {
                          const lastVisited = document.getElementById(`last-visited-${donorKey80}`).value
                          const nextVisit = document.getElementById(`next-visit-${donorKey80}`).value
                          if (existingContact80) {
                            await supabase.from('charity_donor_contacts').update({ last_visited_date: lastVisited || null, next_visit_planned_date: nextVisit || null }).eq('id', existingContact80.id)
                          } else {
                            await supabase.from('charity_donor_contacts').insert({ charity_uen: charityUen, full_name: selectedDonor.name, email: selectedDonor.email || null, last_visited_date: lastVisited || null, next_visit_planned_date: nextVisit || null, created_by: session.user.email })
                          }
                          showToast('Saved ✓')
                          loadDonorContacts()
                        }}>Save</button>
                      </div>
                    )
                  })()}
                  {(() => {
                    const donorKey70 = selectedDonor.email?.trim() || selectedDonor.name
                    const existingContact70 = donorContacts.find(c => (c.email?.trim() || c.full_name) === donorKey70)
                    return (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 6 }}>Birthday (optional — used to flag upcoming birthdays)</div>
                        <input
                          style={{ ...s.formInput, fontSize: 12 }}
                          type="date"
                          defaultValue={existingContact70?.birth_date || ''}
                          id={`birth-date-${donorKey70}`}
                        />
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', marginTop: 6 }} onClick={async () => {
                          const value = document.getElementById(`birth-date-${donorKey70}`).value
                          if (existingContact70) {
                            await supabase.from('charity_donor_contacts').update({ birth_date: value || null }).eq('id', existingContact70.id)
                          } else {
                            await supabase.from('charity_donor_contacts').insert({ charity_uen: charityUen, full_name: selectedDonor.name, email: selectedDonor.email || null, birth_date: value || null, created_by: session.user.email })
                          }
                          showToast('Saved ✓')
                          loadDonorContacts()
                        }}>Save</button>
                      </div>
                    )
                  })()}
                  {(() => {
                    const donorKey48 = selectedDonor.email?.trim() || selectedDonor.name
                    const existingContact48 = donorContacts.find(c => (c.email?.trim() || c.full_name) === donorKey48)
                    return (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 6 }}>Tax residency country (informational — for donors requesting specific documentation formats)</div>
                        <input
                          style={{ ...s.formInput, fontSize: 12 }}
                          placeholder="e.g. Singapore, Malaysia, Australia"
                          defaultValue={existingContact48?.tax_residency_country || ''}
                          id={`tax-residency-${donorKey48}`}
                        />
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', marginTop: 6 }} onClick={async () => {
                          const value = document.getElementById(`tax-residency-${donorKey48}`).value.trim()
                          if (existingContact48) {
                            await supabase.from('charity_donor_contacts').update({ tax_residency_country: value || null }).eq('id', existingContact48.id)
                          } else {
                            await supabase.from('charity_donor_contacts').insert({ charity_uen: charityUen, full_name: selectedDonor.name, email: selectedDonor.email || null, tax_residency_country: value || null, created_by: session.user.email })
                          }
                          showToast('Saved ✓')
                          loadDonorContacts()
                        }}>Save</button>
                      </div>
                    )
                  })()}
                  {(() => {
                    const donorKey31b = selectedDonor.email?.trim() || selectedDonor.name
                    const existingContact31b = donorContacts.find(c => (c.email?.trim() || c.full_name) === donorKey31b)
                    return (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 6 }}>Mailing address (for donors who want a physical copy)</div>
                        <textarea
                          style={{ ...s.formInput, minHeight: 60, resize: 'vertical', fontSize: 12 }}
                          placeholder="Optional — only needed if this donor wants receipts mailed"
                          defaultValue={existingContact31b?.mailing_address || ''}
                          id={`mailing-address-${donorKey31b}`}
                        />
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', marginTop: 6 }} onClick={async () => {
                          const value = document.getElementById(`mailing-address-${donorKey31b}`).value.trim()
                          if (existingContact31b) {
                            await supabase.from('charity_donor_contacts').update({ mailing_address: value || null }).eq('id', existingContact31b.id)
                          } else {
                            await supabase.from('charity_donor_contacts').insert({ charity_uen: charityUen, full_name: selectedDonor.name, email: selectedDonor.email || null, mailing_address: value || null, created_by: session.user.email })
                          }
                          showToast('Saved ✓')
                          loadDonorContacts()
                        }}>Save Address</button>
                      </div>
                    )
                  })()}
                </div>

                <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Personal PayNow QR</div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 12 }}>A standing code for this donor to use anytime — not tied to any campaign or amount. Print and mail once.</div>
                  {(() => {
                    const donorKey16 = selectedDonor.email?.trim() || selectedDonor.name
                    let hash16 = 0
                    for (let i = 0; i < donorKey16.length; i++) { hash16 = (hash16 * 31 + donorKey16.charCodeAt(i)) >>> 0 }
                    const personalRef16 = `D${hash16.toString(36).toUpperCase().slice(0, 8)}`
                    const personalQrValue = `https://www.paynow.com.sg/pay?uen=${charityUen}&ref=${personalRef16}`
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <div style={{ background: 'white', padding: 12, borderRadius: 8, border: `1px solid ${C.border}` }}>
                          <QRCodeSVG value={personalQrValue} size={160} level="H" />
                        </div>
                        <div style={{ fontFamily: C.fontMono, fontSize: 12, color: C.muted }}>Ref: {personalRef16}</div>
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} onClick={() => {
                          const svgEl = document.querySelector('#personal-qr-' + personalRef16 + ' svg') || document.querySelector('svg')
                          showToast('Right-click the QR above to save the image, or use Print (Ctrl/Cmd+P)')
                        }}>ℹ️ How to print/mail this</button>
                      </div>
                    )
                  })()}
                </div>
                {(() => {
                  const donorKey = selectedDonor.email?.trim() || selectedDonor.name
                  const outreachHistory = lapsedReminderHistory[donorKey] || []
                  const dismissal = lapsedDismissals[donorKey]
                  const daysSinceLastGift = Math.floor((new Date() - new Date(donations.filter(dn => (dn.donor_email?.trim() || dn.donor_name) === donorKey).slice(-1)[0]?.created_at || new Date())) / (1000 * 60 * 60 * 24))
                  const isLapsed = daysSinceLastGift >= lapsedMinDays && selectedDonor.count >= lapsedMinGifts
                  if (outreachHistory.length === 0 && !dismissal && !isLapsed) return null
                  return (
                    <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.forest }}>Outreach History</span>
                        {isLapsed && !dismissal && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            {selectedDonor.email && <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px' }} onClick={() => { setLapsedReminderCandidate({ name: selectedDonor.name, email: selectedDonor.email, total: selectedDonor.total, count: selectedDonor.count }); setShowLapsedReminderModal(true) }}>✉ Reach Out</button>}
                            <button style={{ fontSize: 11, color: C.muted, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { setLapsedDismissReason(''); setShowLapsedDismissModal({ name: selectedDonor.name, email: selectedDonor.email }) }}>Not interested</button>
                          </div>
                        )}
                      </div>
                      {dismissal && (
                        <div style={{ background: C.ivory, borderRadius: 4, padding: '10px 12px', marginBottom: outreachHistory.length > 0 ? 8 : 0, border: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 12.5, fontWeight: 500, color: C.muted }}>Marked not interested</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{new Date(dismissal.dismissed_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })} by {dismissal.dismissed_by}</div>
                          {dismissal.reason && <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', marginTop: 4 }}>"{dismissal.reason}"</div>}
                        </div>
                      )}
                      {outreachHistory.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {outreachHistory.map((r, i) => (
                            <div key={i} style={{ background: C.ivory, borderRadius: 4, padding: '10px 12px', border: `1px solid ${C.border}` }}>
                              <div style={{ fontSize: 12.5, fontWeight: 500, color: C.forest }}>✉ Re-engagement email sent</div>
                              <div style={{ fontSize: 11, color: C.muted }}>{new Date(r.sent_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })} by {r.sent_by}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}
                {(() => {
                  const donorKeyForFlag = selectedDonor.email?.trim() || selectedDonor.name
                  const flagMatch = allGivingChangeFlags.find(f => (f.email?.trim() || f.name) === donorKeyForFlag)
                  if (!flagMatch) return null
                  const isUpgrade = flagMatch.changePct > 0
                  return (
                    <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 12 }}>Giving Pattern</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: isUpgrade ? '#EAF3EC' : '#FBEEE9', borderRadius: 4, marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: C.forest }}>{isUpgrade ? 'Giving increased' : 'Giving decreased'}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>Avg was ${flagMatch.prevAvg} · Last gift ${flagMatch.recent.toLocaleString()}</div>
                        </div>
                        <span style={{ fontFamily: C.fontMono, fontSize: 13, fontWeight: 500, color: isUpgrade ? C.sage : C.red }}>
                          {isUpgrade ? '↑' : '↓'} {Math.abs(flagMatch.changePct)}%
                        </span>
                      </div>
                      {(() => {
                        const ackKey = selectedDonor.email?.trim() || selectedDonor.name
                        const ackHistory = givingChangeAckHistory[ackKey] || []
                        if (ackHistory.length === 0) return null
                        const last = ackHistory[0]
                        const daysAgo = Math.floor((new Date() - new Date(last.sent_at)) / (1000 * 60 * 60 * 24))
                        return (
                          <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, fontStyle: 'italic' }}>
                            Already {last.direction === 'upgrade' ? 'thanked' : 'checked in with'} {daysAgo === 0 ? 'today' : `${daysAgo}d ago`} ({ackHistory.length}× total)
                          </div>
                        )
                      })()}
                      {isUpgrade ? (
                        <button
                          style={{ ...s.btnGold, justifyContent: 'center', width: '100%' }}
                          onClick={() => setThankYouDraft({
                            donor: { name: selectedDonor.name, email: selectedDonor.email, total: selectedDonor.total, count: selectedDonor.count },
                            badgeState: null,
                            givingChangeMeta: { direction: 'upgrade', changePct: flagMatch.changePct },
                            text: buildUpgradeThankYouNote(selectedDonor, flagMatch.changePct, flagMatch.recent, flagMatch.prevAvg),
                          })}
                        >💌 Send thank-you for increased gift</button>
                      ) : (
                        selectedDonor.email && (
                          <button
                            style={{ ...s.viewBtn, justifyContent: 'center', width: '100%' }}
                            onClick={() => { setLapsedReminderCandidate({ name: selectedDonor.name, email: selectedDonor.email, total: selectedDonor.total, count: selectedDonor.count, givingChangeMeta: { changePct: flagMatch.changePct } }); setShowLapsedReminderModal(true) }}
                          >✉ Check in about decreased giving</button>
                        )
                      )}
                    </div>
                  )
                })()}
                {(() => {
                  const key = selectedDonor.email?.trim() || selectedDonor.name
                  const b = donorBadgeMap[key]
                  if (!b || !(b.isFirstTime || b.isBigGift || b.isLoyal || b.isBiggestYet)) return null
                  return (
                    <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 12 }}>Milestones</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: b.hasUnackedBadge ? 14 : 0 }}>
                        {b.isFirstTime && <span style={{ ...s.badgeIssued, color: C.gold, background: '#FDF8EC' }}>🆕 First donation</span>}
                        {b.isBigGift && <span style={s.badgeIssued}>💰 ${thankYouThreshold}+ gift</span>}
                        {b.isLoyal && <span style={{ ...s.badgeIssued, color: C.sage, background: C.successBg }}>🔁 Loyal donor</span>}
                        {b.isBiggestYet && <span style={{ ...s.badgeIssued, color: C.gold, background: '#FDF8EC' }}>📈 Biggest gift yet</span>}
                      </div>
                      {b.hasUnackedBadge && (
                        <button
                          style={{ ...s.btnGold, justifyContent: 'center', width: '100%' }}
                          onClick={() => generateThankYouNote(selectedDonor, b)}
                        >✍️ Generate thank-you note</button>
                      )}
                    </div>
                  )
                })()}
              </div>
              <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 12 }}>Tags</div>
                {(() => {
                  const donorKey = selectedDonor.email?.trim() || selectedDonor.name
                  const tags = donorTagsMap[donorKey] || []
                  const presetTags = ['Major Donor', 'Monthly Giver', 'Event Donor', 'Corporate', 'Anonymous', 'In Memoriam', 'Board Member', 'Volunteer']
                  return (
                    <div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, minHeight: 28 }}>
                        {tags.length === 0 && <span style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}>No tags yet</span>}
                        {tags.map(t => (
                          <span key={t.id} style={{ fontSize: 11, fontWeight: 600, color: C.forest, background: C.ivory, border: `1px solid ${C.border}`, padding: '4px 10px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {t.tag}
                            <span style={{ cursor: 'pointer', color: C.muted, fontSize: 12 }} onClick={() => deleteDonorTag(selectedDonor, t.id)}>✕</span>
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                        {presetTags.filter(p => !tags.some(t => t.tag === p)).map(p => (
                          <span
                            key={p}
                            style={{ fontSize: 11, color: C.muted, background: C.ivory, padding: '4px 10px', borderRadius: 4, cursor: 'pointer', border: `1px dashed ${C.borderStrong}` }}
                            onClick={() => { setNewTagInput(p); }}
                          >+ {p}</span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          style={{ ...s.formInput, fontSize: 12, padding: '7px 10px' }}
                          placeholder="Custom tag..."
                          value={newTagInput}
                          onChange={e => setNewTagInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveDonorTag(selectedDonor) }}
                        />
                        <button
                          style={{ ...s.issueBtn, flexShrink: 0, opacity: newTagInput.trim() ? 1 : 0.5 }}
                          disabled={!newTagInput.trim() || savingTag}
                          onClick={() => saveDonorTag(selectedDonor)}
                        >{savingTag ? '...' : 'Add'}</button>
                      </div>
                    </div>
                  )
                })()}
              </div>

              <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 12 }}>Communication Log</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  <select
                    style={{ ...s.filterSelect, fontSize: 12, padding: '8px 12px' }}
                    value={newNoteType}
                    onChange={e => setNewNoteType(e.target.value)}
                  >
                    <option value="note">📝 Note</option>
                    <option value="call">📞 Call</option>
                    <option value="email">📧 Email</option>
                    <option value="meeting">🤝 Meeting</option>
                    <option value="whatsapp">💬 WhatsApp</option>
                  </select>
                  <textarea
                    style={{ ...s.formInput, minHeight: 72, resize: 'vertical', fontSize: 13 }}
                    placeholder="Log a call, email, meeting, or note..."
                    value={newNoteText}
                    onChange={e => setNewNoteText(e.target.value)}
                  />
                  <button
                    style={{ ...s.btnForest, justifyContent: 'center', opacity: newNoteText.trim() ? 1 : 0.5 }}
                    disabled={!newNoteText.trim() || savingNote}
                    onClick={saveNewDonorNote}
                  >{savingNote ? '⏳ Saving...' : '+ Add to Log'}</button>
                </div>
                {donorNotesLoading ? (
                  <div style={{ fontSize: 13, color: C.muted, padding: '8px 0' }}>Loading...</div>
                ) : donorNotes.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No communications logged yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {donorNotes.map((n, i) => {
                      const typeConfig = {
                        call:      { icon: '📞', label: 'Call',      color: C.forest },
                        email:     { icon: '📧', label: 'Email',     color: C.sage },
                        meeting:   { icon: '🤝', label: 'Meeting',   color: C.gold },
                        whatsapp:  { icon: '💬', label: 'WhatsApp',  color: C.sage },
                        note:      { icon: '📝', label: 'Note',      color: C.muted },
                      }
                      const tc = typeConfig[n.note_type] || typeConfig.note
                      return (
                        <div key={n.id} style={{ background: C.ivory, borderRadius: 4, padding: '12px 14px', border: `1px solid ${C.border}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                              <span style={{ fontSize: 14 }}>{tc.icon}</span>
                              <span style={{ fontFamily: C.fontMono, fontSize: 10.5, fontWeight: 600, color: tc.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{tc.label}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 11, color: C.muted }}>{new Date(n.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })} · {new Date(n.created_at).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })}</span>
                              <span
                                style={{ fontSize: 11, color: C.red, cursor: 'pointer', fontWeight: 500 }}
                                onClick={() => setConfirmModal({
                                  title: 'Delete this note?',
                                  description: 'This cannot be undone.',
                                  confirmLabel: 'Delete',
                                  onConfirm: () => deleteDonorNote(n.id),
                                })}
                              >✕</span>
                            </div>
                          </div>
                          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{n.note}</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>by {n.created_by}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 12 }}>Donation History</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {donations.filter(d => (d.donor_email?.trim() || d.donor_name) === (selectedDonor.email?.trim() || selectedDonor.name)).map(d => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: C.ivory, borderRadius: 4, border: `1px solid ${C.border}` }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: C.forest }}>{d.source === 'manual' ? `${d.payment_method || 'Manual'}` : 'Giving Tree App'}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{new Date(d.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 15, fontWeight: 500, color: C.forest }}>${Number(d.amount).toLocaleString()}</div>
                        <div style={{ fontSize: 10, color: d.receipt_issued ? C.sage : C.warning, fontWeight: 500 }}>{d.receipt_issued ? '✓ Issued' : 'Pending'}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedDonor.isContactOnly && (
                    <button
                      style={{ ...s.viewBtn, color: C.red, borderColor: C.red }}
                      onClick={() => {
                        setConfirmModal({
                          title: 'Delete this prospect?',
                          description: 'This permanently removes the prospect record. This cannot be undone. This only applies to prospects with no donations — donors with donation history should be deactivated instead.',
                          confirmLabel: 'Delete Prospect',
                          onConfirm: async () => {
                            const { error } = await supabase.from('charity_donor_contacts').delete().eq('id', selectedDonor.id)
                            if (error) { showToast('Error deleting prospect', 'error'); return }
                            await supabase.from('audit_log').insert({
                              actor_type: 'charity',
                              actor_email: session.user.email,
                              action: 'prospect_deleted',
                              details: { donor_name: selectedDonor.name },
                            })
                            setDonorContacts(prev => prev.filter(c => c.id !== selectedDonor.id))
                            setSelectedDonor(null)
                            showToast(`${selectedDonor.name} deleted`)
                          },
                        })
                      }}
                    >🗑️ Delete Prospect</button>
                  )}
                  {!selectedDonor.isContactOnly && (
                  <button
                    style={{ ...s.viewBtn, color: selectedDonor.deactivated ? C.sage : C.warning, borderColor: selectedDonor.deactivated ? C.sage : C.warning }}
                    onClick={() => {
                      const isDeactivated = selectedDonor.deactivated
                      setConfirmModal({
                        title: isDeactivated ? 'Reactivate this donor?' : 'Deactivate this donor?',
                        description: isDeactivated
                          ? 'They will appear in active donor lists and appeals again. All their donation history is preserved.'
                          : 'They will be hidden from active donor lists and appeals. All their donation history is preserved and they will still appear in reports.',
                        confirmLabel: isDeactivated ? 'Reactivate' : 'Deactivate',
                        onConfirm: async () => {
                          const newVal = !isDeactivated
                          const donorKey = selectedDonor.email?.trim() || selectedDonor.name
                          const donorDonationIds = donations
                            .filter(d => (d.donor_email?.trim() || d.donor_nric || d.donor_name) === donorKey)
                            .map(d => d.id)
                          const { error } = await supabase
                            .from('donations')
                            .update({ donor_deactivated: newVal })
                            .in('id', donorDonationIds)
                          if (error) { showToast('Error updating donor status', 'error'); return }
                          await supabase.from('audit_log').insert({
                            actor_type: 'charity',
                            actor_email: session.user.email,
                            action: newVal ? 'donor_deactivated' : 'donor_reactivated',
                            details: { donor_name: selectedDonor.name },
                          })
                          setDonations(prev => prev.map(d =>
                            donorDonationIds.includes(d.id) ? { ...d, donor_deactivated: newVal } : d
                          ))
                          setSelectedDonor(prev => ({ ...prev, deactivated: newVal }))
                          showToast(newVal ? `${selectedDonor.name} deactivated` : `${selectedDonor.name} reactivated ✓`)
                        },
                      })
                    }}
                  >{selectedDonor.deactivated ? '✓ Reactivate Donor' : '⊘ Deactivate Donor'}</button>
                  )}
                  <button
                    style={{ ...s.viewBtn, color: selectedDonor.doNotContact ? C.sage : C.red, borderColor: selectedDonor.doNotContact ? C.sage : C.red }}
                    onClick={() => {
                      const isDNC = selectedDonor.doNotContact
                      setConfirmModal({
                        title: isDNC ? 'Allow contact with this donor again?' : 'Mark as Do Not Contact?',
                        description: isDNC
                          ? 'This donor will become eligible for reminders, appeals, and outreach emails again.'
                          : 'This donor will be excluded from every email sent by this platform — mass appeals, reminders, thank-yous, and any future outreach. Their donation history and receipts are unaffected.',
                        confirmLabel: isDNC ? 'Allow Contact' : 'Mark Do Not Contact',
                        onConfirm: async () => {
                          const newVal = !isDNC
                          const donorKey = selectedDonor.email?.trim() || selectedDonor.name
                          const donorDonationIds = donations
                            .filter(d => (d.donor_email?.trim() || d.donor_nric || d.donor_name) === donorKey)
                            .map(d => d.id)
                          const { error } = await supabase
                            .from('donations')
                            .update({ donor_do_not_contact: newVal })
                            .in('id', donorDonationIds)
                          if (error) { showToast('Error updating donor status', 'error'); return }
                          await supabase.from('audit_log').insert({
                            actor_type: 'charity',
                            actor_email: session.user.email,
                            action: newVal ? 'donor_marked_do_not_contact' : 'donor_contact_allowed',
                            details: { donor_name: selectedDonor.name },
                          })
                          setDonations(prev => prev.map(d =>
                            donorDonationIds.includes(d.id) ? { ...d, donor_do_not_contact: newVal } : d
                          ))
                          setSelectedDonor(prev => ({ ...prev, doNotContact: newVal }))
                          showToast(newVal ? `${selectedDonor.name} marked as Do Not Contact` : `${selectedDonor.name} can be contacted again ✓`)
                        },
                      })
                    }}
                  >{selectedDonor.doNotContact ? '✓ Allow Contact' : '🚫 Do Not Contact'}</button>
                  <button style={s.viewBtn} onClick={() => {
                    const isDeceased41 = selectedDonor.deceased
                    setConfirmModal({
                      title: isDeceased41 ? 'Unmark as deceased?' : 'Mark this donor as deceased?',
                      subtitle: isDeceased41
                        ? 'This donor will become eligible for communications again.'
                        : 'This immediately halts all outgoing communication to this donor — thank-yous, appeals, reminders, everything. Their donation history and receipts stay intact.',
                      confirmLabel: isDeceased41 ? 'Unmark' : 'Mark Deceased',
                      onConfirm: async () => {
                        const newVal41 = !isDeceased41
                        const donorKey41 = selectedDonor.email?.trim() || selectedDonor.name
                        const donorDonationIds41 = donations
                          .filter(d => (d.donor_email?.trim() || d.donor_nric || d.donor_name) === donorKey41)
                          .map(d => d.id)
                        const { error } = await supabase
                          .from('donations')
                          .update({ donor_deceased: newVal41 })
                          .in('id', donorDonationIds41)
                        if (error) { showToast('Error updating donor status', 'error'); return }
                        await supabase.from('audit_log').insert({
                          actor_type: 'charity',
                          actor_email: session.user.email,
                          action: newVal41 ? 'donor_marked_deceased' : 'donor_deceased_unmarked',
                          details: { donor_name: selectedDonor.name },
                        })
                        setDonations(prev => prev.map(d =>
                          donorDonationIds41.includes(d.id) ? { ...d, donor_deceased: newVal41 } : d
                        ))
                        setSelectedDonor(prev => ({ ...prev, deceased: newVal41 }))
                        showToast(newVal41 ? `${selectedDonor.name} marked as deceased` : `${selectedDonor.name} unmarked`)
                      },
                    })
                  }}>{selectedDonor.deceased ? '✓ Unmark Deceased' : '🕊️ Mark Deceased'}</button>
                  <button style={(issuing || bulkActionInProgress) ? s.issuingBtn : s.btnForest} disabled={!!issuing || bulkActionInProgress} onClick={async () => {
                    if (bulkActionInProgress) { showToast('Please wait for the current action to finish', 'error'); return }
                    setBulkActionInProgress(true)
                    const pending = donations.filter(d => (d.donor_email?.trim() || d.donor_name) === (selectedDonor.email?.trim() || selectedDonor.name) && !d.receipt_issued)
                    for (const d of pending) await issueReceipt(d, true)
                    if (pending.length > 1) {
                      await supabase.from('audit_log').insert({
                        actor_type: 'charity',
                        actor_email: session.user.email,
                        action: 'bulk_receipts_issued',
                        details: { donation_count: pending.length, donor_name: selectedDonor.name },
                      })
                    }
                    setBulkActionInProgress(false)
                    showToast(`${pending.length} receipt${pending.length > 1 ? 's' : ''} issued for ${selectedDonor.name}`)
                  }}>{(issuing || bulkActionInProgress) ? '⏳ Issuing...' : '🧾 Issue All Receipts'}</button>
                </div>
              </div>
            </div>
          {deactivatedDonorList.length > 0 && (
              <div style={{ ...s.tableCard, marginTop: 24, opacity: 0.7 }}>
                <div style={s.tableHeader}>
                  <div style={s.tableTitle}>Deactivated Donors</div>
                  <div style={s.tableCount}>{deactivatedDonorList.length} donors · hidden from active lists</div>
                </div>
                <div>
                  {deactivatedDonorList.filter(d => d.name?.toLowerCase().includes(searchTerm.toLowerCase())).map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${C.ivoryDark}` }}>
                      <div style={{ ...s.donorAvatar, background: C.muted }}>{d.name?.charAt(0)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: C.muted }}>{d.name}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{d.count} donation{d.count > 1 ? 's' : ''} · ${d.total.toLocaleString()} total</div>
                      </div>
                      <span style={{ ...s.badgePending, color: C.muted, background: C.ivoryDark }}>Deactivated</span>
                      <button style={s.viewBtn} onClick={() => setSelectedDonor(d)}>View</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── DONATIONS ── */}
        {activeTab === 'donations' && (
          <div style={s.content}>
            {userRole === 'volunteer' && (
              <div style={{ background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: 4, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: C.warning, fontWeight: 500 }}>
                You're logged in as a volunteer. You can log new manual entries below. To view donor records or financials, please contact a staff member.
              </div>
            )}
            <div style={s.pageHeader}>
              <div>
                <div style={s.pageTitle}>Donations</div>
                <div style={s.pageSub}>{userRole === 'volunteer' ? 'Log a new donation below' : `${donations.length} total · ${donations.filter(d => d.source === 'manual').length} manual entries`}</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {(userRole === 'staff' || userRole === 'ed') && pendingCountForYear > 0 && <button style={s.btnForest} onClick={issueAllReceipts} disabled={bulkActionInProgress}>{bulkActionInProgress ? '⏳ Issuing...' : `🧾 Issue All Pending (${pendingCountForYear})`}</button>}
                <button style={s.btnGold} onClick={() => setShowManualForm(true)}>+ Manual Entry</button>
              </div>
            </div>

            {showManualForm && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => { setShowManualForm(false); setManualError('') }}>
                <div style={{ background: C.white, borderRadius: 8, padding: isMobile ? 20 : 24, maxWidth: 720, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: C.forest }}>New Manual Entry</div>
                    <button style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer', lineHeight: 1 }} onClick={() => { setShowManualForm(false); setManualError('') }}>✕</button>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Log a cash, cheque, or wire donation received outside the app.</div>
                  {manualError && <div style={{ background: C.warningBg, color: C.warning, padding: '10px 14px', borderRadius: 4, fontSize: 13, marginBottom: 12 }}>{manualError}</div>}
                  {manualDuplicateWarning && (
                    <div style={{ background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: 4, padding: '12px 14px', marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.warning, marginBottom: 8 }}>⚠ Possible duplicate donor</div>
                      <div style={{ fontSize: 12, color: C.warning, marginBottom: 10 }}>We found {manualDuplicateWarning.donors.length} existing donor{manualDuplicateWarning.donors.length > 1 ? 's' : ''} matching this {manualDuplicateWarning.matchedOn}. Is this the same person?</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                        {manualDuplicateWarning.donors.slice(0, 3).map((d, i) => (
                          <div key={i} style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '8px 12px', fontSize: 12, color: C.forest }}>
                            <strong>{d.name}</strong> — {d.count} donation{d.count > 1 ? 's' : ''}, last gave ${d.total.toLocaleString()}
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          style={{ ...s.btnForest, fontSize: 12, padding: '8px 14px' }}
                          onClick={() => { setManualForm(f => ({ ...f, duplicateConfirmed: true })); setManualDuplicateWarning(null); saveManualEntry() }}
                        >It's a different person — save anyway</button>
                        <button
                          style={{ ...s.viewBtn, fontSize: 12, padding: '8px 14px' }}
                          onClick={() => { setManualDuplicateWarning(null); setManualForm(f => ({ ...f, donor_name: manualDuplicateWarning.donors[0].name, duplicateConfirmed: true })) }}
                        >Use existing name</button>
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={s.formLabel}>{manualForm.is_anonymous ? 'Donor Name (optional)' : 'Donor Name *'}</div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.muted, cursor: 'pointer' }}>
                          <input type="checkbox" checked={manualForm.is_anonymous} onChange={e => setManualForm(f => ({ ...f, is_anonymous: e.target.checked }))} /> Anonymous
                        </label>
                      </div>
                      <input style={s.formInput} placeholder={manualForm.is_anonymous ? 'Leave blank, or add a private note' : 'Full name'} value={manualForm.donor_name} onChange={e => setManualForm(f => ({ ...f, donor_name: e.target.value }))} />
                    </div>
                    <div>
                      <div style={s.formLabel}>How did they find you? (optional)</div>
                      <select style={s.formInput} value={manualForm.acquisition_source} onChange={e => setManualForm(f => ({ ...f, acquisition_source: e.target.value }))}>
                        <option value="">Not specified</option>
                        <option value="referral">Referral</option>
                        <option value="event">Event</option>
                        <option value="social_media">Social Media</option>
                        <option value="walk_in">Walk-in</option>
                        <option value="corporate_partner">Corporate Partner</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    {manualForm.acquisition_source === 'referral' && (
                      <div>
                        <div style={s.formLabel}>Referred by</div>
                        <select style={s.formInput} value={manualForm.referred_by_donor_key} onChange={e => setManualForm(f => ({ ...f, referred_by_donor_key: e.target.value }))}>
                          <option value="">Select existing donor...</option>
                          {donorList.map((d, i) => (
                            <option key={i} value={d.email?.trim() || d.name}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {charityIsIpc && (
                      <div><div style={s.formLabel}>NRIC / FIN</div><input style={s.formInput} placeholder="e.g. S1234567A" value={manualForm.donor_nric} onChange={e => setManualForm(f => ({ ...f, donor_nric: e.target.value }))} maxLength={9} /></div>
                    )}
                    <div><div style={s.formLabel}>Amount (SGD) *</div><input style={s.formInput} type="number" placeholder="0.00" value={manualForm.amount} onChange={e => setManualForm(f => ({ ...f, amount: e.target.value }))} /></div>
                    <div><div style={s.formLabel}>Date</div><input style={s.formInput} type="date" min="2020-01-01" max={new Date().toISOString().split('T')[0]} value={manualForm.date} onChange={e => setManualForm(f => ({ ...f, date: e.target.value }))} /></div>
                    <div><div style={s.formLabel}>Payment Method</div>
                      <select style={s.formInput} value={manualForm.payment_method} onChange={e => setManualForm(f => ({ ...f, payment_method: e.target.value }))}>
                        <option>Cash</option><option>Bank Wire</option><option>Cheque</option><option>PayNow Direct</option><option>Other</option>
                      </select>
                      {manualForm.payment_method === 'PayNow Direct' && (
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Generates a scannable QR — payment confirms in a second step</div>
                      )}
                    </div>
                    <div><div style={s.formLabel}>Donor Email</div><input style={s.formInput} placeholder="donor@email.com" value={manualForm.donor_email || ''} onChange={e => setManualForm(f => ({ ...f, donor_email: e.target.value }))} /></div>
                    <div><div style={s.formLabel}>Cause (Optional)</div>
                      <select style={s.formInput} value={manualForm.cause_id} onChange={e => setManualForm(f => ({ ...f, cause_id: e.target.value }))}>
                        <option value="">General Donation</option>
                        {myCauses.filter(c => c.status === 'approved' && c.type === 'campaign').map(c => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                    <div><div style={s.formLabel}>Receipt Name</div><input style={s.formInput} placeholder="Leave blank to use donor name" value={manualForm.receipt_name} onChange={e => setManualForm(f => ({ ...f, receipt_name: e.target.value }))} /><div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Only fill this if the receipt should show a different name (e.g. a company name)</div></div>
<div style={{ gridColumn: isMobile ? 'auto' : '1 / -1' }}><div style={s.formLabel}>Notes</div><input style={s.formInput} placeholder="Optional notes" value={manualForm.notes} onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {manualForm.payment_method === 'PayNow Direct' ? (
                      <button style={{ ...s.btnGold, flex: 1, justifyContent: 'center' }} onClick={generatePayNowEntry} disabled={savingManual}>{savingManual ? 'Generating...' : '📱 Generate PayNow Code'}</button>
                    ) : (
                      <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} onClick={saveManualEntry} disabled={savingManual}>{savingManual ? 'Saving...' : '✓ Save Entry'}</button>
                    )}
                    <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => { setShowManualForm(false); setManualError('') }}>Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {payNowQrDonation && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 380, width: '100%', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 2 }}>{payNowQrDonation.donor_name}</div>
                  <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, marginBottom: 16 }}>SGD ${Number(payNowQrDonation.amount).toFixed(2)}</div>
                  <div style={{ background: 'white', borderRadius: 4, padding: 16, border: `1px solid ${C.border}`, display: 'inline-block', marginBottom: 14 }}>
                    <QRCodeSVG value={`https://www.paynow.com.sg/pay?uen=${charityUen}&amount=${payNowQrDonation.amount}&ref=${payNowQrDonation.payment_ref}`} size={180} level="H" />
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Ask the donor to scan with their banking app</div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 18 }}>Ref: <span style={{ fontFamily: 'monospace' }}>{payNowQrDonation.payment_ref}</span></div>
                  <button style={{ ...s.btnForest, width: '100%', justifyContent: 'center', marginBottom: 10 }} onClick={confirmManualPayNow} disabled={confirmingPayNow}>{confirmingPayNow ? 'Confirming...' : '✓ Payment Received — Confirm'}</button>
                  <button style={{ ...s.viewBtn, width: '100%', justifyContent: 'center' }} onClick={() => { setPayNowQrDonation(null); setManualForm({ donor_name: '', donor_nric: '', amount: '', payment_method: 'Cash', notes: '', donor_email: '', date: new Date().toISOString().split('T')[0], cause_id: '' }) }}>Close — I'll confirm later</button>
                </div>
              </div>
            )}

            {(unconfirmedCountForYear > 0 || pendingCountForYear > 0 || (charityIsIpc && missingNricThisYear > 0)) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {unconfirmedCountForYear > 0 && (
                  <button style={{ ...s.badgePending, border: 'none', cursor: 'pointer', fontSize: 12, padding: '6px 14px' }} onClick={() => { clearDonationFilters({ keepYear: true }); setFilterType('Awaiting Payment') }}>
                    ⚠️ {unconfirmedCountForYear} awaiting confirmation{filterYear !== 'All' ? ` in ${filterYear}` : ''}
                  </button>
                )}
                {pendingCountForYear > 0 && (
                  <button style={{ ...s.badgePending, border: 'none', cursor: 'pointer', fontSize: 12, padding: '6px 14px' }} onClick={() => { clearDonationFilters({ keepYear: true }); setFilterType('Receipt Pending') }}>
                    🧾 {pendingCountForYear} receipt{pendingCountForYear > 1 ? 's' : ''} pending{filterYear !== 'All' ? ` in ${filterYear}` : ''}
                  </button>
                )}
                {charityIsIpc && missingNricThisYear > 0 && (
                  <button style={{ ...s.badgePending, border: 'none', cursor: 'pointer', fontSize: 12, padding: '6px 14px' }} onClick={() => { clearDonationFilters({ keepYear: true }); setFilterNric('Missing NRIC') }}>
                    🪪 {missingNricThisYear} missing NRIC{filterYear !== 'All' ? ` in ${filterYear}` : ''}
                  </button>
                )}
              </div>
            )}

            <div style={isMobile ? { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 } : { display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
              <input style={isMobile ? s.searchBox : { ...s.searchBox, flex: 'none', width: 280 }} placeholder={charityIsIpc ? "🔍 Search name, email, NRIC, ref, or notes..." : "🔍 Search name, email, ref, or notes..."} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              <select style={isMobile ? { ...s.filterSelect, flex: 1, minWidth: 100 } : s.filterSelect} value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option>All</option><option>Awaiting Payment</option><option>Receipt Pending</option><option>Issued</option>
              </select>
              {charityIsIpc && (
                <select style={{ ...(isMobile ? { ...s.filterSelect, flex: 1, minWidth: 100 } : s.filterSelect), borderColor: filterNric !== 'All' ? C.warningBorder : C.border, background: filterNric !== 'All' ? C.warningBg : C.white }} value={filterNric} onChange={e => setFilterNric(e.target.value)}>
                  <option value="All">All NRICs</option>
                  <option value="Missing NRIC">⚠️ Missing NRIC (confirmed)</option>
                </select>
              )}
              <select style={isMobile ? { ...s.filterSelect, flex: 1, minWidth: 100 } : s.filterSelect} value={filterSource} onChange={e => setFilterSource(e.target.value)}>
                <option value="All">All Sources</option>
                <option value="App">📱 App</option>
                <option value="Manual">✏️ Manual</option>
              </select>
              <select style={isMobile ? { ...s.filterSelect, flex: 1, minWidth: 100 } : s.filterSelect} value={filterThankYou} onChange={e => setFilterThankYou(e.target.value)}>
                <option value="All">Thank You: All</option>
                <option value="Sent">💌 Sent</option>
                <option value="Not Sent">Not Sent (has email)</option>
                <option value="No Email">No Email on File</option>
              </select>
              <select style={isMobile ? { ...s.filterSelect, flex: 1, minWidth: 100 } : s.filterSelect} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                <option>All</option>
                {donations.length === 0
    ? <option>{new Date().getFullYear()}</option>
    : [...new Set(donations.map(d => new Date(d.created_at).getFullYear()))].sort((a,b) => b-a).map(y => <option key={y}>{y}</option>)
  }
              </select>
              <button
                style={bulkEditMode ? { ...s.viewBtn, background: C.teal, color: 'white', borderColor: C.teal } : s.viewBtn}
                onClick={() => { setBulkEditMode(v => !v); if (bulkEditMode) setSelectedDonationIds([]) }}
              >{bulkEditMode ? '✕ Exit Bulk Edit' : '☑️ Bulk Edit'}</button>
              <button style={isMobile ? { ...s.exportSmallBtn, width: '100%' } : s.exportSmallBtn} onClick={exportDonationsExcel}>⬇️ Export to Excel</button>
              {!isMobile && !isTablet && (
                <div style={{ position: 'relative' }}>
                  <button style={s.exportSmallBtn} onClick={() => setShowDonationColumnPicker(v => !v)}>⚙️ Columns</button>
                  {showDonationColumnPicker && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowDonationColumnPicker(false)} />
                      <div style={{ position: 'absolute', top: '110%', right: 0, background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 10, zIndex: 50, minWidth: 200 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Show columns</div>
                        {DONATION_COLUMN_OPTIONS.filter(opt => opt.key !== 'nric' || charityIsIpc).map(opt => (
                          <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', fontSize: 13, color: C.forest, cursor: 'pointer' }}>
                            <input type="checkbox" checked={selectedDonationColumns.includes(opt.key)} onChange={() => toggleDonationColumn(opt.key)} />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              {activeDonationFilterCount > 0 && (
                <button style={{ ...s.viewBtn, whiteSpace: 'nowrap' }} onClick={clearDonationFilters}>✕ Clear Filters ({activeDonationFilterCount})</button>
              )}
            </div>

            {bulkProgress && (
              <div style={{ background: C.forest, borderRadius: 4, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'white', flexShrink: 0 }}>
                  Issuing {bulkProgress.done} of {bulkProgress.total}...
                </span>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.2)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%`, height: '100%', background: C.gold, borderRadius: 3, transition: 'width 0.2s' }} />
                </div>
                <button
                  style={{ ...s.bannerBtn, background: 'white', color: C.red, flexShrink: 0 }}
                  onClick={() => { bulkCancelRef.current = true }}
                >✕ Cancel</button>
              </div>
            )}

            {selectedDonationIds.length > 0 && (
              <div style={{ background: C.forest, borderRadius: 4, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{selectedDonationIds.length} selected</span>
                {selectedDonationIds.length < filteredDonations.length && (
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', textDecoration: 'underline', cursor: 'pointer' }} onClick={() => {
                    if (filteredDonations.length > 200) {
                      setConfirmModal({
                        title: `Select all ${filteredDonations.length} donations?`,
                        description: 'Bulk actions run one at a time, so this could take a while and cannot be cancelled partway through.',
                        confirmLabel: 'Select all',
                        onConfirm: selectAllMatchingFilters,
                      })
                    } else {
                      selectAllMatchingFilters()
                    }
                  }}>
                    Select all {filteredDonations.length} matching filters
                  </span>
                )}
                <button style={{ ...s.bannerBtn, background: 'white', color: C.forest }} onClick={bulkIssueSelectedReceipts} disabled={bulkActionInProgress}>🧾 Issue Receipts</button>
                {charityIsIpc && (
                  <button style={{ ...s.bannerBtn, background: 'white', color: C.forest }} onClick={bulkRequestSelectedNric} disabled={bulkActionInProgress}>🪪 Request NRIC</button>
                )}
                <button style={{ ...s.bannerBtn, background: 'white', color: C.red }} onClick={bulkDeleteSelectedManual} disabled={bulkActionInProgress}>🗑️ Delete Manual</button>
                <button style={{ ...s.bannerBtn, background: 'rgba(255,255,255,0.15)', color: 'white' }} onClick={() => setSelectedDonationIds([])}>✕ Clear Selection</button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {userRole === 'volunteer' ? (() => {
                  const myEntries = donations.filter(d => d.created_by === session?.user?.email).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                  return (
                    <div style={{ ...s.tableCard }}>
                      <div style={s.tableHeader}>
                        <div style={s.tableTitle}>Your Entries</div>
                        <div style={s.tableCount}>{myEntries.length} record{myEntries.length !== 1 ? 's' : ''}</div>
                      </div>
                      {myEntries.length === 0 ? (
                        <div style={s.empty}>No entries yet — use "+ Manual Entry" above to log a donation.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {myEntries.map(d => (
                            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }} onClick={() => { setVolunteerEditEntry(d); setVolunteerEditForm({ donor_name: d.donor_name || '', amount: d.amount?.toString() || '', date: d.created_at?.split('T')[0] || '', notes: d.notes || '' }) }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 500, color: C.forest }}>{d.donor_name}</div>
                                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{new Date(d.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 13, fontWeight: 500, color: C.forest }}>${Number(d.amount).toLocaleString()}</span>
                                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: d.payment_status === 'confirmed' ? C.successBg : C.warningBg, color: d.payment_status === 'confirmed' ? C.sage : C.warning }}>{d.payment_status === 'confirmed' ? 'Confirmed' : 'Pending review'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })() : <div style={s.tableCard}>
                  <div style={s.tableHeader}>
                    <div style={s.tableTitle}>All Donations</div>
                    <div style={s.tableCount}>{filteredDonations.length > donationsPerPage ? `${paginatedDonations.length} of ${filteredDonations.length} records` : `${filteredDonations.length} records`}</div>
                  </div>
                  {loading ? <div style={s.empty}>Loading...</div> : filteredDonations.length === 0 ? (
                    <div style={s.empty}>
                      No donations found{activeDonationFilterCount > 0 ? ' matching your filters.' : '.'}
                      {activeDonationFilterCount > 0 && (
                        <div style={{ marginTop: 10 }}>
                          <button style={s.viewBtn} onClick={clearDonationFilters}>✕ Clear Filters</button>
                        </div>
                      )}
                    </div>
                  ) : (isMobile || isTablet) ? (
                    <div>
                      {paginatedDonations.map(d => {
                        const isPaid = d.payment_status === 'confirmed'
                        const railColor = !isPaid ? C.red : !d.thank_you_sent ? C.gold : C.sage
                        return (
                        <div key={d.id} style={{ display: 'flex', gap: 8, padding: '12px 16px 12px 10px', borderBottom: `1px solid ${C.ivoryDark}`, cursor: 'pointer' }} onClick={() => { setSelectedDonation(d); setQuickEmailInput(''); setQuickNricInput('') }}>
                          <div style={{ width: 4, borderRadius: 4, background: railColor, alignSelf: 'stretch', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                <div style={{ ...s.donorAvatar, background: C.sage, flexShrink: 0 }}>{d.donor_name?.charAt(0)}</div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={s.donationCardName}>{d.donor_name}</div>
                                  <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{new Date(d.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })} · {d.payment_ref || d.receipt_number || '—'}</div>
                                </div>
                              </div>
                              <div style={{ ...s.donationCardAmount, flexShrink: 0 }}>${Number(d.amount).toLocaleString()}</div>
                            </div>
                            <div style={{ marginTop: 8, marginLeft: 42 }}>
                              <div style={{ marginBottom: 6 }}>
                                {causeNameForDonation(d) ? (
                                  <span style={{ fontSize: 10, fontWeight: 500, color: '#854F0B', background: '#FDF8EC', padding: '3px 9px', borderRadius: 20 }}>{causeNameForDonation(d)}</span>
                                ) : (
                                  <span style={{ fontSize: 10, color: C.muted, background: C.ivoryDark, padding: '3px 9px', borderRadius: 20 }}>General</span>
                                )}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                {isPaid ? (
                                  <span style={{ fontSize: 10, fontWeight: 500, color: '#3B6D11', background: '#EAF3DE', padding: '3px 9px', borderRadius: 20 }}>Paid</span>
                                ) : (
                                  <span
                                    style={{ fontSize: 10, fontWeight: 500, color: '#A32D2D', background: '#FCEBEB', padding: '3px 9px', borderRadius: 20, cursor: 'pointer' }}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setConfirmModal({
                                        title: 'Confirm this payment?',
                                        subtitle: 'Check the transaction reference against your bank or PayNow statement before confirming.',
                                        donorName: d.donor_name,
                                        amount: d.amount,
                                        reference: d.payment_ref || d.receipt_number,
                                        steps: ['Mark payment as confirmed', 'Issue a receipt'],
                                        receiptPreviewDonation: d,
                                        confirmLabel: 'Confirm payment',
                                        onConfirm: () => confirmPaymentFlow(d),
                                      })
                                    }}
                                  >Unpaid · tap to confirm</span>
                                )}
                                {isPaid && (isReceipted ? (
                                  <span style={{ fontSize: 10, fontWeight: 500, color: '#3B6D11', background: '#EAF3DE', padding: '3px 9px', borderRadius: 20 }}>Receipted</span>
                                ) : (
                                  <span style={{ fontSize: 10, fontWeight: 500, color: '#854F0B', background: '#FAEEDA', padding: '3px 9px', borderRadius: 20 }}>Receipt pending</span>
                                ))}
                                {isPaid && isReceipted && d.donor_email?.trim() && (
                                  d.thank_you_sent ? (
                                    <span style={{ fontSize: 10, fontWeight: 500, color: '#3B6D11', background: '#EAF3DE', padding: '3px 9px', borderRadius: 20 }}>Thanked</span>
                                  ) : (
                                    <span style={{ fontSize: 10, fontWeight: 500, color: '#854F0B', background: '#FAEEDA', padding: '3px 9px', borderRadius: 20 }}>Not thanked</span>
                                  )
                                )}
                                {charityIsIpc && !d.donor_nric && isPaid && (
                                  <span style={{ fontSize: 10, fontWeight: 500, color: '#854F0B', background: '#FAEEDA', padding: '3px 9px', borderRadius: 20 }}>NRIC missing</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        )
                      })}
                    </div>
                  ) : (
                    <table style={s.table}>
                      <thead>
                        <tr>
                          {bulkEditMode && (
                            <th style={{ ...s.th, width: 36 }}>
                              <input type="checkbox" checked={paginatedDonations.length > 0 && paginatedDonations.every(d => selectedDonationIds.includes(d.id))} onChange={toggleSelectAllVisible} />
                            </th>
                          )}
                          {(isTablet
                            ? charityIsIpc ? ['Donor', 'Amount', 'Date', 'NRIC', 'Payment', 'Receipt'] : ['Donor', 'Amount', 'Date', 'Payment', 'Receipt']
                            : ['Donor', ...DONATION_COLUMN_OPTIONS.filter(o => selectedDonationColumns.includes(o.key) && (o.key !== 'nric' || charityIsIpc)).sort((a, b) => selectedDonationColumns.indexOf(a.key) - selectedDonationColumns.indexOf(b.key)).map(o => o.label)]
                          ).map(h => {
                            const sortKey = h === 'Amount' ? 'amount' : h === 'Date' ? 'date' : h === 'Donor' ? 'donor' : h === 'Cause' ? 'cause' : null
                            return (
                              <th key={h} style={{ ...s.th, cursor: sortKey ? 'pointer' : 'default', userSelect: 'none', width: h === 'Donor' ? 220 : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={() => {
                                if (!sortKey) return
                                if (donationSortBy === sortKey) setDonationSortDir(d => d === 'asc' ? 'desc' : 'asc')
                                else { setDonationSortBy(sortKey); setDonationSortDir('desc') }
                              }}>
                                {h}{sortKey && donationSortBy === sortKey ? (donationSortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedDonations.map(d => {
                          const isPaid = d.payment_status === 'confirmed'
                          const railColor = !isPaid ? C.red : !d.thank_you_sent ? C.gold : C.sage
                          const rowBg = selectedDonation?.id === d.id ? C.successBg : selectedDonationIds.includes(d.id) ? C.warningBg : d.source === 'manual' ? '#FDFBF6' : 'transparent'
                          return (
                          <tr key={d.id} ref={selectedDonation?.id === d.id ? selectedRowRef : null} style={{ ...s.tr, background: rowBg, borderLeft: `3px solid ${railColor}`, cursor: 'pointer' }} onClick={() => { if (bulkEditMode) { toggleDonationSelected(d.id) } else { setSelectedDonation(d); setQuickEmailInput(''); setQuickNricInput('') } }}>
                            {bulkEditMode && (
                              <td style={s.td} onClick={e => e.stopPropagation()}>
                                <input type="checkbox" checked={selectedDonationIds.includes(d.id)} onChange={() => toggleDonationSelected(d.id)} />
                              </td>
                            )}
                            <td style={s.td}><div style={s.donorCell}><div style={{ ...s.donorAvatar, background: d.payment_status !== 'confirmed' ? C.red : !d.thank_you_sent ? C.gold : C.sage }}>{d.donor_name?.charAt(0)}</div><div><div style={s.donorName}>{d.donor_name}</div>{d.notes && <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', marginTop: 2 }}>📝 {d.notes}</div>}</div></div></td>
                            {isTablet && <td style={s.td}><span style={s.amountText}>${Number(d.amount).toLocaleString()}</span></td>}
                            {isTablet && <td style={s.td}><span style={s.dateText}>{new Date(d.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</span></td>}
                            {isTablet ? (
                              <>
                                {charityIsIpc && <td style={s.td}>{d.donor_nric ? <span style={s.badgeIssued}>✓ {d.donor_nric}</span> : <span style={s.badgePending}>⚠️ Missing</span>}</td>}
                                <td style={s.td}>
                                  {d.payment_status === 'confirmed' ? <span style={s.badgeIssued}>✓ Paid</span> : <span style={s.badgePending}>⚠️ Unverified</span>}
                                </td>
                                <td style={s.td}>{d.receipt_issued ? <span style={s.badgeIssued}>✓ Issued</span> : <span style={s.badgePending}>Pending</span>}</td>
                              </>
                            ) : (() => {
                              const cellRenderers = {
                                amount: <td key="amount" style={s.td}><span style={s.amountText}>${Number(d.amount).toLocaleString()}</span></td>,
                                date: <td key="date" style={s.td}><span style={s.dateText}>{new Date(d.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</span></td>,
                                cause: (
                                  <td key="cause" style={s.td}>
                                    {causeNameForDonation(d) ? (
                                      <span style={{ fontSize: 10, fontWeight: 500, color: C.gold, background: '#FDF8EC', padding: '3px 10px', borderRadius: 20, display: 'inline-block', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={causeNameForDonation(d)}>🎯 {causeNameForDonation(d)}</span>
                                    ) : (
                                      <span style={{ fontSize: 11, color: C.muted }}>General</span>
                                    )}
                                  </td>
                                ),
                                source: <td key="source" style={s.td}>{d.source === 'manual' ? <span style={{ ...s.badgePending, color: C.gold, background: '#FDF8EC' }}>✏️ {d.payment_method || 'Manual'}</span> : <span style={s.badgeIssued}>📱 App</span>}</td>,
                                nric: charityIsIpc ? <td key="nric" style={s.td}>{d.donor_nric ? <span style={s.badgeIssued}>✓ {d.donor_nric}</span> : <span style={s.badgePending}>⚠️ Missing</span>}</td> : null,
                                payment: (
                                  <td key="payment" style={s.td}>
                                    {d.payment_status === 'confirmed' ? <span style={s.badgeIssued}>✓ Paid</span> : (
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                                        <span style={s.badgePending}>⚠️ Unverified</span>
                                        <button
                                          style={{ fontSize: 10, fontWeight: 700, color: C.teal, background: 'white', border: `1px solid ${C.teal}`, borderRadius: 20, padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setConfirmModal({
                                              title: 'Confirm this payment?',
                                              subtitle: 'Check the transaction reference against your bank or PayNow statement before confirming.',
                                              donorName: d.donor_name,
                                              amount: d.amount,
                                              reference: d.payment_ref || d.receipt_number,
                                              steps: ['Mark payment as confirmed', 'Issue a receipt'],
                                              receiptPreviewDonation: d,
                                              confirmLabel: 'Confirm payment',
                                              onConfirm: () => confirmPaymentFlow(d),
                                            })
                                          }}
                                        >✓ Confirm</button>
                                      </div>
                                    )}
                                  </td>
                                ),
                                receipt: <td key="receipt" style={s.td}>{d.receipt_issued ? <span style={s.badgeIssued}>✓ Issued</span> : <span style={s.badgePending}>Pending</span>}</td>,
                                receiptNo: <td key="receiptNo" style={s.td}><span style={{ fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{d.payment_ref || d.receipt_number || '—'}</span></td>,
                                thankYou: <td key="thankYou" style={s.td}>{d.thank_you_sent ? <span style={s.badgeIssued}>💌 Sent</span> : <span style={{ fontSize: 10, color: C.muted }}>—</span>}</td>,
                              }
                              return selectedDonationColumns.map(key => cellRenderers[key]).filter(Boolean)
                            })()}
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                  {filteredDonations.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: `1px solid ${C.border}`, flexWrap: 'wrap', gap: 10 }}>
                      <select style={{ ...s.filterSelect, padding: '6px 10px', fontSize: 12 }} value={donationsPerPage} onChange={e => { setDonationsPerPage(parseInt(e.target.value)); setDonationsPage(0) }}>
                        <option value={25}>25 / page</option>
                        <option value={50}>50 / page</option>
                        <option value={100}>100 / page</option>
                      </select>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button
                          style={{ ...s.viewBtn, opacity: donationsPage === 0 ? 0.4 : 1, cursor: donationsPage === 0 ? 'not-allowed' : 'pointer' }}
                          disabled={donationsPage === 0}
                          onClick={() => setDonationsPage(p => Math.max(0, p - 1))}
                        >← Previous</button>
                        <span style={{ fontSize: 12, color: C.muted }}>Page {donationsPage + 1} of {donationsTotalPages}</span>
                        <button
                          style={{ ...s.viewBtn, opacity: donationsPage >= donationsTotalPages - 1 ? 0.4 : 1, cursor: donationsPage >= donationsTotalPages - 1 ? 'not-allowed' : 'pointer' }}
                          disabled={donationsPage >= donationsTotalPages - 1}
                          onClick={() => setDonationsPage(p => Math.min(donationsTotalPages - 1, p + 1))}
                        >Next →</button>
                      </div>
                    </div>
                  )}
                </div>}
              </div>

              {(userRole === 'staff' || userRole === 'ed') && selectedDonation && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 24 }} onClick={() => { setSelectedDonation(null); setEditingManual(false); setEditForm({}); setQuickEmailInput(''); setQuickNricInput('') }}>
                <div style={isMobile ? { background: C.white, width: '100%', height: '100%', overflowY: 'auto' } : { width: 760, maxWidth: '100%', borderRadius: 8 }} onClick={e => e.stopPropagation()}>
                  <div style={isMobile ? { background: C.white, minHeight: '100%', padding: 20 } : { background: C.white, borderRadius: 8, overflow: 'hidden', maxHeight: '96vh', display: 'flex', flexDirection: 'column', padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: C.fontVoice, fontSize: 18, fontWeight: 500, color: 'white', flexShrink: 0 }}>{selectedDonation.donor_name?.charAt(0)}</div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>Donation Details</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{selectedDonation.donor_name}</div>
                        </div>
                      </div>
                      <button style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 28, height: 28, cursor: 'pointer', fontSize: 14, flexShrink: 0 }} onClick={() => { setSelectedDonation(null); setEditingManual(false); setEditForm({}); setQuickEmailInput(''); setQuickNricInput('') }}>✕</button>
                    </div>

                    <div style={{ background: C.forest, borderRadius: 14, padding: '20px 22px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                      <div>
                        <div style={{ fontSize: 34, fontWeight: 800, color: 'white', lineHeight: 1 }}>${Number(selectedDonation.amount).toLocaleString()}</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
                          {new Date(selectedDonation.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })} · {selectedDonation.source === 'manual' ? `${selectedDonation.payment_method || 'Manual'} entry` : 'PayNow via Giving Tree App'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                        {selectedDonation.payment_status === 'confirmed' ? (
                          <span style={{ fontSize: 11, fontWeight: 500, color: '#3B6D11', background: '#EAF3DE', padding: '4px 10px', borderRadius: 20 }}>Paid</span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 500, color: '#A32D2D', background: '#FCEBEB', padding: '4px 10px', borderRadius: 20 }}>Unpaid</span>
                        )}
                        {selectedDonation.payment_status === 'confirmed' && (
                          selectedDonation.receipt_issued ? (
                            <span style={{ fontSize: 11, fontWeight: 500, color: '#3B6D11', background: '#EAF3DE', padding: '4px 10px', borderRadius: 20 }}>Receipted</span>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 500, color: '#854F0B', background: '#FAEEDA', padding: '4px 10px', borderRadius: 20 }}>Receipt pending</span>
                          )
                        )}
                        {selectedDonation.payment_status === 'confirmed' && selectedDonation.receipt_issued && selectedDonation.donor_email?.trim() && (
                          selectedDonation.thank_you_sent ? (
                            <span style={{ fontSize: 11, fontWeight: 500, color: '#3B6D11', background: '#EAF3DE', padding: '4px 10px', borderRadius: 20 }}>Thanked</span>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 500, color: '#854F0B', background: '#FAEEDA', padding: '4px 10px', borderRadius: 20 }}>Not thanked</span>
                          )
                        )}
                      </div>
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1, display: isMobile ? 'block' : 'grid', gridTemplateColumns: isMobile ? 'none' : '1fr 1fr', gap: isMobile ? 0 : 20 }}>
                      <div>

                      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Donor</div>
                      <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: '4px 16px', marginBottom: 16 }}>
                        {[
                          { label: 'Email', key: 'donor_email', value: selectedDonation.donor_email || '—', editable: true },
                        ].map((item, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                            <span style={{ fontSize: 13, color: C.muted }}>{item.label}</span>
                            {editingManual && item.editable && selectedDonation.source === 'manual' ? (
                              <input type="text" style={{ ...s.formInput, padding: '4px 8px', fontSize: 12, width: 160, textAlign: 'right' }}
                                value={editForm[item.key] ?? (selectedDonation[item.key] || '')}
                                onChange={e => setEditForm(f => ({ ...f, [item.key]: e.target.value }))} />
                            ) : (
                              <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{item.value}</span>
                            )}
                          </div>
                        ))}
                        {charityIsIpc && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                            <span style={{ fontSize: 13, color: C.muted }}>NRIC / FIN</span>
                            {editingManual && selectedDonation.source === 'manual' ? (
                              <input type="text" style={{ ...s.formInput, padding: '4px 8px', fontSize: 12, width: 140, textAlign: 'right' }}
                                placeholder="e.g. S1234567A" maxLength={9}
                                value={editForm.donor_nric ?? (selectedDonation.donor_nric || '')}
                                onChange={e => setEditForm(f => ({ ...f, donor_nric: e.target.value.toUpperCase() }))} />
                            ) : selectedDonation.donor_nric ? (
                              <span style={{ fontSize: 13, fontWeight: 700, color: C.sage }}>✓ {selectedDonation.donor_nric}</span>
                            ) : (
                              <span style={{ fontSize: 12, fontWeight: 700, color: C.warning }}>⚠️ Missing</span>
                            )}
                          </div>
                        )}
                      </div>

                      {!selectedDonation.donor_email?.trim() && !editingManual && selectedDonation.source === 'manual' && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Add donor email to send a thank you</div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input style={{ ...s.formInput, padding: '7px 10px', fontSize: 12 }} placeholder="donor@email.com" type="email" value={quickEmailInput} onChange={e => setQuickEmailInput(e.target.value)} />
                            <button style={{ ...s.issueBtn, padding: '7px 12px', fontSize: 12, flexShrink: 0 }} onClick={() => {
                              const val = quickEmailInput.trim()
                              if (!val) return
                              supabase.from('donations').update({ donor_email: val }).eq('id', selectedDonation.id)
                                .then(() => {
                                  setDonations(prev => prev.map(x => x.id === selectedDonation.id ? { ...x, donor_email: val } : x))
                                  setSelectedDonation(prev => ({ ...prev, donor_email: val }))
                                  setQuickEmailInput('')
                                })
                            }}>Save</button>
                          </div>
                        </div>
                      )}

                      {charityIsIpc && !selectedDonation.donor_nric && !editingManual && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input style={{ ...s.formInput, padding: '7px 10px', fontSize: 12 }} placeholder="e.g. S1234567A" maxLength={9} value={quickNricInput} onChange={e => setQuickNricInput(e.target.value)} />
                            <button style={{ ...s.issueBtn, padding: '7px 12px', fontSize: 12, flexShrink: 0 }} onClick={() => {
                              const val = quickNricInput.trim().toUpperCase()
                              if (!val) return
                              if (!/^[A-Z]\d{7}[A-Z]$/.test(val)) { showToast('Invalid NRIC format. Should be like S1234567A', 'error'); return }
                              supabase.from('donations').update({ donor_nric: val }).eq('id', selectedDonation.id)
                                .then(async () => {
                                  await supabase.from('audit_log').insert({
                                    actor_type: 'charity',
                                    actor_email: session.user.email,
                                    action: 'nric_added',
                                    donation_id: selectedDonation.id,
                                    details: { donor_name: selectedDonation.donor_name },
                                  })
                                  setDonations(prev => prev.map(x => x.id === selectedDonation.id ? { ...x, donor_nric: val } : x))
                                  setSelectedDonation(prev => ({ ...prev, donor_nric: val }))
                                  setQuickNricInput('')
                                })
                            }}>Save</button>
                          </div>
                          {selectedDonation.donor_email?.trim() && (
                            <button style={{ ...s.viewBtn, marginTop: 8, width: '100%', textAlign: 'center', fontSize: 12, opacity: nricRequestSent[selectedDonation.id] ? 0.5 : 1 }} onClick={async () => {
                              if (nricRequestSent[selectedDonation.id]) { showToast('Email already sent for this donation', 'error'); return }
                              const { error } = await sendCharityEmail({ donor_name: selectedDonation.donor_name, donor_email: selectedDonation.donor_email, charity_name: charityName, amount: selectedDonation.amount, date: new Date(selectedDonation.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' }), request_nric: true })
                              if (error) { showToast('Failed to send email', 'error'); return }
                              setNricRequestSent(prev => ({ ...prev, [selectedDonation.id]: true }))
                              showToast(`NRIC request sent to ${selectedDonation.donor_email}`)
                            }}>📧 {nricRequestSent[selectedDonation.id] ? 'Email Sent ✓' : 'Request NRIC via Email'}</button>
                          )}
                        </div>
                      )}

                      {charityIsIpc ? (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Tax Deduction</div>
                          <div style={{ background: C.successBg, borderRadius: 12, border: `1px solid #C8E3D3`, padding: '4px 16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #D7EBE0' }}>
                              <span style={{ fontSize: 13, color: '#3B6D11' }}>250% Deductible</span>
                              <span style={{ fontSize: 14, fontWeight: 800, color: C.forest }}>${(selectedDonation.amount * 2.5).toLocaleString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                              <span style={{ fontSize: 13, color: '#3B6D11' }}>Est. Tax Savings</span>
                              <span style={{ fontSize: 14, fontWeight: 800, color: C.forest }}>${(selectedDonation.amount * 2.5 * 0.22).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Donation Summary</div>
                          <div style={{ background: C.ivory, borderRadius: 12, border: `1px solid ${C.border}`, padding: '14px 16px' }}>
                            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>This charity is registered but not an IPC, so this donation is not eligible for a tax deduction under Singapore tax law.</div>
                          </div>
                        </>
                      )}

                      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 20 }}>Notes</div>
                      {editingNoteId === selectedDonation.id ? (
                        <div style={{ marginBottom: 20 }}>
                          <textarea style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.sage}`, borderRadius: 10, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: C.white, color: C.text, boxSizing: 'border-box', resize: 'vertical', minHeight: 80 }}
                            value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..." autoFocus />
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button style={{ ...s.issueBtn, flex: 1 }} onClick={() => {
                              supabase.from('donations').update({ notes: noteText }).eq('id', selectedDonation.id)
                                .then(() => {
                                  setDonations(prev => prev.map(x => x.id === selectedDonation.id ? { ...x, notes: noteText } : x))
                                  setSelectedDonation(prev => ({ ...prev, notes: noteText }))
                                  setEditingNoteId(null)
                                })
                            }}>Save</button>
                            <button style={{ ...s.viewBtn, flex: 1 }} onClick={() => setEditingNoteId(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ background: C.white, borderRadius: 12, padding: '14px 16px', border: `1px dashed ${C.border}`, cursor: 'pointer', minHeight: 20 }}
                          onClick={() => { setEditingNoteId(selectedDonation.id); setNoteText(selectedDonation.notes || '') }}>
                          {selectedDonation.notes
                            ? <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{selectedDonation.notes}</div>
                            : <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>Click to add a note...</div>
                          }
                        </div>
                      )}

                      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 20 }}>Impact Note</div>
                      {editingImpactNoteId === selectedDonation.id ? (
                        <div style={{ marginBottom: 20 }}>
                          <textarea style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.gold}`, borderRadius: 10, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: C.white, color: C.text, boxSizing: 'border-box', resize: 'vertical', minHeight: 60 }}
                            value={impactNoteText} onChange={e => setImpactNoteText(e.target.value)} placeholder="e.g. This $1,000 funded 10 tuition sessions for 3 students in Q2." autoFocus />
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button style={{ ...s.issueBtn, flex: 1 }} onClick={() => {
                              supabase.from('donations').update({ impact_note: impactNoteText }).eq('id', selectedDonation.id)
                                .then(() => {
                                  setDonations(prev => prev.map(x => x.id === selectedDonation.id ? { ...x, impact_note: impactNoteText } : x))
                                  setSelectedDonation(prev => ({ ...prev, impact_note: impactNoteText }))
                                  setEditingImpactNoteId(null)
                                })
                            }}>Save</button>
                            <button style={{ ...s.viewBtn, flex: 1 }} onClick={() => setEditingImpactNoteId(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ background: '#FDF8EC', borderRadius: 12, padding: '14px 16px', border: `1px dashed ${C.warningBorder}`, cursor: 'pointer', minHeight: 20 }}
                          onClick={() => { setEditingImpactNoteId(selectedDonation.id); setImpactNoteText(selectedDonation.impact_note || '') }}>
                          {selectedDonation.impact_note
                            ? <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>🎯 {selectedDonation.impact_note}</div>
                            : <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>Click to describe what this gift funded...</div>
                          }
                        </div>
                      )}
                      </div>

                      <div>

                      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Record</div>
                      <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: '4px 16px', marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                          <span style={{ fontSize: 13, color: C.muted }}>Amount (SGD)</span>
                          {editingManual && selectedDonation.source === 'manual' ? (
                            <input type="number" style={{ ...s.formInput, padding: '4px 8px', fontSize: 12, width: 100, textAlign: 'right' }}
                              value={editForm.amount ?? selectedDonation.amount}
                              onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} />
                          ) : (
                            <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>${Number(selectedDonation.amount).toLocaleString()}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                          <span style={{ fontSize: 13, color: C.muted }}>Date</span>
                          {editingManual && selectedDonation.source === 'manual' ? (
                            <input type="date" style={{ ...s.formInput, padding: '4px 8px', fontSize: 12, width: 140, textAlign: 'right' }}
                              value={editForm.created_at || selectedDonation.created_at?.split('T')[0]}
                              onChange={e => setEditForm(f => ({ ...f, created_at: e.target.value }))} />
                          ) : (
                            <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{new Date(selectedDonation.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                          )}
                        </div>
                        {selectedDonation.source === 'manual' && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                            <span style={{ fontSize: 13, color: C.muted }}>Payment Method</span>
                            {editingManual ? (
                              <select style={{ ...s.formInput, padding: '4px 8px', fontSize: 12, width: 140, textAlign: 'right' }}
                                value={editForm.payment_method ?? selectedDonation.payment_method}
                                onChange={e => setEditForm(f => ({ ...f, payment_method: e.target.value }))}>
                                <option>Cash</option><option>Bank Wire</option><option>Cheque</option><option>PayNow Direct</option><option>Other</option>
                              </select>
                            ) : (
                              <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{selectedDonation.payment_method || '—'}</span>
                            )}
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                          <span style={{ fontSize: 13, color: C.muted }}>Cause</span>
                          {causeNameForDonation(selectedDonation) ? (
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.warning, background: C.warningBg, padding: '3px 10px', borderRadius: 20 }}>{causeNameForDonation(selectedDonation)}</span>
                          ) : (
                            <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>General Donation</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                          <span style={{ fontSize: 13, color: C.muted }}>Receipt Name</span>
                          {editingManual && selectedDonation.source === 'manual' ? (
                            <input type="text" style={{ ...s.formInput, padding: '4px 8px', fontSize: 12, width: 160, textAlign: 'right' }}
                              placeholder={selectedDonation.donor_name}
                              value={editForm.receipt_name ?? (selectedDonation.receipt_name || '')}
                              onChange={e => setEditForm(f => ({ ...f, receipt_name: e.target.value }))} />
                          ) : (
                            <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{selectedDonation.receipt_name || selectedDonation.donor_name}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                          <span style={{ fontSize: 13, color: C.muted }}>Receipt No.</span>
                          {editingManual && selectedDonation.source === 'manual' ? (
                            <input type="text" style={{ ...s.formInput, padding: '4px 8px', fontSize: 12, width: 160, textAlign: 'right' }}
                              value={editForm.receipt_number ?? (selectedDonation.receipt_number || '')}
                              onChange={e => setEditForm(f => ({ ...f, receipt_number: e.target.value }))} />
                          ) : (
                            <span style={{ fontSize: 13, fontWeight: 500, color: C.text, fontFamily: 'monospace' }}>{selectedDonation.source === 'manual' ? (selectedDonation.receipt_number || '—') : (selectedDonation.payment_ref || '—')}</span>
                          )}
                        </div>
                        {selectedDonation.reissued_from && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                            <span style={{ fontSize: 13, color: C.muted }}>Reissued From</span>
                            <span style={{ fontSize: 12, fontWeight: 500, color: C.warning, fontFamily: 'monospace' }}>{selectedDonation.reissued_from} (voided)</span>
                          </div>
                        )}
                        {selectedDonation.void_reason && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                            <span style={{ fontSize: 13, color: C.muted }}>Void Reason</span>
                            <span style={{ fontSize: 12, color: C.muted, fontStyle: 'italic', maxWidth: 200, textAlign: 'right' }}>{selectedDonation.void_reason}</span>
                          </div>
                        )}
                      </div>

                      {/* ACTIONS */}
                      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {selectedDonation.receipt_issued && (
                          <>
                            <button style={{ ...s.viewBtn, justifyContent: 'center', opacity: charityIpcLoaded ? 1 : 0.5 }} disabled={!charityIpcLoaded} onClick={() => exportSingleReceiptPDF(selectedDonation)}>📄 Download Receipt PDF</button>
                            
                          </>
                        )}
                        {selectedDonation.payment_status === 'confirmed' && donationPledgeLink && (
                          <div style={{ fontSize: 12, color: C.sage, fontWeight: 500, background: '#EAF3EC', border: `1px solid ${C.sage}`, borderRadius: 6, padding: '8px 12px' }}>
                            ✓ Already linked to {donationPledgeLink.pledgeDonorName || 'a'} pledge (${Number(donationPledgeLink.amount_applied).toLocaleString()})
                          </div>
                        )}
                        {selectedDonation.payment_status === 'confirmed' && !donationPledgeLink && pledges.filter(p => p.status === 'pending').length > 0 && (
                          <button style={{ ...s.viewBtn, justifyContent: 'center' }} onClick={() => setShowManualPledgeLinkModal(true)}>🤝 Link to Pledge</button>
                        )}
                        {selectedDonation.payment_status === 'confirmed' && (() => {
                          const myRefunds119 = refunds.filter(r => r.donation_id === selectedDonation.id)
                          const totalRefunded119 = myRefunds119.reduce((s, r) => s + Number(r.refund_amount), 0)
                          return (
                            <div style={{ marginTop: 4 }}>
                              {myRefunds119.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                                  {myRefunds119.map(r => (
                                    <div key={r.id} style={{ fontSize: 12, background: '#FBEEE9', border: `1px solid #E0BBA9`, borderRadius: 6, padding: '8px 10px', color: C.red }}>
                                      Refunded ${Number(r.refund_amount).toLocaleString()} on {new Date(r.refund_date).toLocaleDateString('en-SG')} — {r.reason}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {totalRefunded119 < Number(selectedDonation.amount) && (
                                showRefundForm ? (
                                  <div style={{ background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 6, padding: 12 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 8 }}>
                                      <input style={{ ...s.formInput, fontSize: 12 }} type="number" placeholder="Refund amount" value={refundForm.refund_amount} onChange={e => setRefundForm(f => ({ ...f, refund_amount: e.target.value }))} />
                                      <input style={{ ...s.formInput, fontSize: 12 }} type="date" value={refundForm.refund_date} onChange={e => setRefundForm(f => ({ ...f, refund_date: e.target.value }))} />
                                    </div>
                                    <textarea style={{ ...s.formInput, fontSize: 12, minHeight: 50, resize: 'vertical', marginBottom: 8 }} placeholder="Reason for refund" value={refundForm.reason} onChange={e => setRefundForm(f => ({ ...f, reason: e.target.value }))} />
                                    <div style={{ display: 'flex', gap: 8 }}>
                                      <button style={{ ...s.btnForest, fontSize: 12 }} onClick={() => saveRefund(selectedDonation)}>Record Refund</button>
                                      <button style={{ ...s.viewBtn, fontSize: 12 }} onClick={() => setShowRefundForm(false)}>Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <button style={{ ...s.viewBtn, justifyContent: 'center', width: '100%' }} onClick={() => setShowRefundForm(true)}>↩️ Record a Refund</button>
                                )
                              )}
                            </div>
                          )
                        })()}
                        {selectedDonation.receipt_issued && selectedDonation.source === 'manual' && (
                          <button style={{ ...s.viewBtn, color: C.red, borderColor: C.red, justifyContent: 'center' }} onClick={() => { setShowVoidModal(true); setVoidReason('') }}>🚫 Void & Reissue Receipt</button>
                        )}
                        {selectedDonation.payment_status === 'confirmed' && !selectedDonation.receipt_issued && (
                          <button style={{ ...s.btnForest, justifyContent: 'center' }} onClick={() => {
                            setConfirmModal({
                              title: 'Issue receipt for this donation?',
                              subtitle: 'Review the details below before issuing. Once issued, the donor will receive a thank-you email if they have one on file.',
                              donorName: selectedDonation.donor_name,
                              amount: selectedDonation.amount,
                              reference: selectedDonation.receipt_number || selectedDonation.payment_ref,
                              steps: [
                                `Receipt name: ${selectedDonation.receipt_name || selectedDonation.donor_name}`,
                                `Amount: SGD $${Number(selectedDonation.amount).toLocaleString()}`,
                                `Date: ${new Date(selectedDonation.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}`,
                                ...(selectedDonation.donor_email ? [`Thank-you email will be sent to ${selectedDonation.donor_email}`] : ['No email on file — receipt only']),
                              ],
                              confirmLabel: 'Issue Receipt',
                              onConfirm: async () => {
                                const { error } = await supabase.from('donations').update({ receipt_issued: true }).eq('id', selectedDonation.id)
                                if (error) { showToast('Error issuing receipt', 'error'); return }
                                setDonations(prev => prev.map(x => x.id === selectedDonation.id ? { ...x, receipt_issued: true } : x))
                                setSelectedDonation(prev => ({ ...prev, receipt_issued: true }))

                                if (!selectedDonation.donor_email) {
                                  showToast('Receipt issued ✓')
                                  return
                                }

                                const donationSnapshot = { ...selectedDonation, receipt_issued: true }
                                const { error: emailError } = await sendCharityEmail({
                                  donor_name: donationSnapshot.donor_name,
                                  donor_email: donationSnapshot.donor_email,
                                  charity_name: charityName,
                                  charity_uen: charityUen,
                                  amount: donationSnapshot.amount,
                                  date: new Date(donationSnapshot.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' }),
                                  payment_ref: donationSnapshot.payment_ref,
                                  notes: donationSnapshot.notes,
                                  cause_title: causeNameForDonation(donationSnapshot),
                                })
                                if (!emailError) {
                                  await supabase.from('donations').update({ thank_you_sent: true }).eq('id', donationSnapshot.id)
                                  setDonations(prev => prev.map(x => x.id === donationSnapshot.id ? { ...x, thank_you_sent: true } : x))
                                  setSelectedDonation(prev => ({ ...prev, thank_you_sent: true }))
                                  showToast('Receipt issued ✓ — thank you email sent to ' + donationSnapshot.donor_email + ' 💌')
                                } else {
                                  showToast('Receipt issued but thank you email failed — send manually', 'error')
                                }
                              },
                            })
                          }}>🧾 Issue Receipt</button>
                        )}
                        {selectedDonation.payment_status !== 'confirmed' && (
                          <button style={{ ...s.btnForest, justifyContent: 'center' }} onClick={() => {
                            const refToShow = selectedDonation.payment_ref || selectedDonation.receipt_number
                            setConfirmModal({
                              title: 'Confirm this payment?',
                              subtitle: 'Check the transaction reference against your bank or PayNow statement before confirming.',
                              donorName: selectedDonation.donor_name,
                              amount: selectedDonation.amount,
                              reference: refToShow,
                              steps: ['Mark payment as confirmed', 'Issue a receipt'],
                              receiptPreviewDonation: selectedDonation,
                              confirmLabel: 'Confirm payment',
                              onConfirm: () => confirmPaymentFlow(selectedDonation),
                            })
                          }}>✓ Confirm Payment & Issue Receipt</button>
                        )}
                        {selectedDonation.payment_status === 'confirmed' && selectedDonation.donor_email?.trim() && (
                          <button
                            style={{ ...s.btnGold, justifyContent: 'center', opacity: (selectedDonation.thank_you_sent || sendingThankYouId === selectedDonation.id) ? 0.7 : 1, cursor: sendingThankYouId === selectedDonation.id ? 'default' : 'pointer' }}
                            disabled={sendingThankYouId === selectedDonation.id}
                            onClick={() => { setThankYouCustomMessage(''); setThankYouPreviewModal(selectedDonation) }}
                          >{sendingThankYouId === selectedDonation.id ? '⏳ Sending...' : '💌 Send Thank You + Receipt'}</button>
                        )}
                        {selectedDonation.source === 'manual' && !editingManual && (
                          <button style={s.viewBtn} onClick={() => { setEditingManual(true); setEditForm({}) }}>✏️ Edit Entry</button>
                        )}
                        {selectedDonation.source === 'manual' && editingManual && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button style={{ ...s.issueBtn, flex: 1 }} onClick={async () => {
                              const updates = {
                                donor_name: editForm.donor_name ?? selectedDonation.donor_name,
                                donor_nric: editForm.donor_nric ?? selectedDonation.donor_nric,
                                donor_email: editForm.donor_email ?? selectedDonation.donor_email,
                                amount: editForm.amount ? parseFloat(editForm.amount) : selectedDonation.amount,
                                payment_method: editForm.payment_method ?? selectedDonation.payment_method,
                                created_at: editForm.created_at ?? selectedDonation.created_at,
                                receipt_number: editForm.receipt_number ?? selectedDonation.receipt_number,
                              }
                              if (!updates.donor_name?.trim()) { showToast('Donor name cannot be empty', 'error'); return }
                              if (!updates.amount || updates.amount <= 0) { showToast('Amount must be greater than zero', 'error'); return }
                              if (new Date(updates.created_at) > new Date()) { showToast('Date cannot be in the future', 'error'); return }
                              if (updates.donor_nric && !/^[A-Z]\d{7}[A-Z]$/.test(updates.donor_nric.trim().toUpperCase())) { showToast('Invalid NRIC format. Should be like S1234567A', 'error'); return }
                              if (updates.donor_nric) updates.donor_nric = updates.donor_nric.trim().toUpperCase()
                              const { error } = await supabase.from('donations').update(updates).eq('id', selectedDonation.id)
                              if (error) { showToast('Error saving', 'error'); return }
                              await supabase.from('audit_log').insert({
                                actor_type: 'charity',
                                actor_email: session.user.email,
                                action: 'donation_edited',
                                donation_id: selectedDonation.id,
                                details: { before: { donor_name: selectedDonation.donor_name, amount: selectedDonation.amount }, after: updates },
                              })
                              setDonations(prev => prev.map(x => x.id === selectedDonation.id ? { ...x, ...updates } : x))
                              setSelectedDonation(prev => ({ ...prev, ...updates }))
                              setEditingManual(false)
                              setEditForm({})
                            }}>✓ Save Changes</button>
                            <button style={{ ...s.viewBtn, flex: 1 }} onClick={() => { setEditingManual(false); setEditForm({}) }}>Cancel</button>
                          </div>
                        )}
                        {selectedDonation.source === 'manual' && !editingManual && (
                          <button style={deletingId === selectedDonation.id ? s.issuingBtn : { ...s.viewBtn, color: C.red, borderColor: C.red }} disabled={deletingId === selectedDonation.id} onClick={() => deleteDonation(selectedDonation.id)}>{deletingId === selectedDonation.id ? '⏳ Deleting...' : '🗑️ Delete Entry'}</button>
                        )}
                      </div>

                      </div>
                    </div>
                  </div>
                </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {activeTab === 'analytics' && (
          <div style={s.content}>
            <div style={s.pageHeader}>
              <div>
                <div style={{ fontFamily: C.fontVoice, fontWeight: 500, fontSize: 26, color: C.forest }}>Analytics</div>
                <div style={{ ...s.pageSub, marginTop: 4 }}>Detailed analysis to drive your charity goals.</div>
              </div>
            </div>

            <div style={{ position: 'relative', paddingLeft: 24, marginBottom: 40 }}>
              <div style={{ position: 'absolute', left: 0, top: 4, bottom: 4, width: 1, background: C.borderStrong }} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.muted }}>01</span>
                <span style={{ fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: C.forest, fontWeight: 500 }}>Overview</span>
              </div>

              {(() => {
                const scoped = (filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear))).filter(d => d.payment_status === 'confirmed')
                if (scoped.length === 0) return null
                const totalAmt = scoped.reduce((s, d) => s + d.amount, 0)
                const donorKeys = new Set(scoped.map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name))
                const periodYear = filterYear === 'All' ? new Date().getFullYear() : parseInt(filterYear)
                const lastYearScoped = donations.filter(d => d.payment_status === 'confirmed' && new Date(d.created_at).getFullYear() === periodYear - 1)
                const lastYearTotal = lastYearScoped.reduce((s, d) => s + d.amount, 0)
                const growthPct = lastYearTotal > 0 ? Math.round(((totalAmt - lastYearTotal) / lastYearTotal) * 100) : null
                const byDonorCount = {}
                scoped.forEach(d => { const key = d.donor_email?.trim() || d.donor_nric || d.donor_name; byDonorCount[key] = (byDonorCount[key] || 0) + 1 })
                const mostLoyalEntry = Object.entries(byDonorCount).sort((a, b) => b[1] - a[1])[0]
                const mostLoyalDonor = mostLoyalEntry ? scoped.find(d => (d.donor_email?.trim() || d.donor_nric || d.donor_name) === mostLoyalEntry[0])?.donor_name : null
                const monthTotals = {}
                scoped.forEach(d => { const m = new Date(d.created_at).toLocaleDateString('en-SG', { month: 'long' }); monthTotals[m] = (monthTotals[m] || 0) + d.amount })
                const bestMonthEntry = Object.entries(monthTotals).sort((a, b) => b[1] - a[1])[0]
                const donorFirstYear = {}
                ;[...donations].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).forEach(d => {
                  const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
                  if (!donorFirstYear[key]) donorFirstYear[key] = new Date(d.created_at).getFullYear()
                })
                const firstTimeCount = [...donorKeys].filter(k => donorFirstYear[k] === periodYear).length

                const sentences = []
                sentences.push(`This ${filterYear === 'All' ? 'period' : 'year'}, ${donorKeys.size} donor${donorKeys.size !== 1 ? 's' : ''} gave a total of $${totalAmt.toLocaleString()}${growthPct !== null ? ` — ${growthPct >= 0 ? 'up' : 'down'} ${Math.abs(growthPct)}% from the year before` : ''}.`)
                if (mostLoyalDonor && mostLoyalEntry[1] > 1) sentences.push(`${mostLoyalDonor} was your most loyal supporter with ${mostLoyalEntry[1]} gifts.`)
                if (bestMonthEntry) sentences.push(`Your best month was ${bestMonthEntry[0]}, raising $${bestMonthEntry[1].toLocaleString()}.`)
                if (firstTimeCount > 0) sentences.push(`${firstTimeCount} first-time donor${firstTimeCount > 1 ? 's' : ''} joined this ${filterYear === 'All' ? 'period' : 'year'} — if even half return, that's real momentum.`)

                return (
                  <div style={{ background: C.forest, borderRadius: 4, padding: 24, marginBottom: 24 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>Your Story So Far <InfoTip text="An auto-generated recap of the selected period — total raised, your most loyal donor, best month, and first-time donors — written in plain sentences." /></div>
                    <div style={{ fontSize: 16, color: 'white', lineHeight: 1.7 }}>{sentences.join(' ')}</div>
                  </div>
                )
              })()}
      

              </div>

            <div style={{ position: 'relative', paddingLeft: 24, marginBottom: 40 }}>
              <div style={{ position: 'absolute', left: 0, top: 4, bottom: 4, width: 1, background: C.borderStrong }} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.muted }}>02</span>
                <span style={{ fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: C.forest, fontWeight: 500 }}>Fundraising Performance</span>
              </div>

              {(() => {
                const { yr, tiles } = fundraisingSnapshotStats
                return (
                  <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: (isMobile || isTablet) ? 'wrap' : 'nowrap' }}>
                    {tiles.map((t, i) => (
                      <div key={i} style={{ ...s.card, flex: 1, minWidth: (isMobile || isTablet) ? '100%' : 0 }}>
                        <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>{t.label} <InfoTip text={t.tip} /></div>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>{t.val}</div>
                        {t.d === null ? (
                          <div style={{ fontSize: 11, color: C.muted }}>new in {yr}</div>
                        ) : (
                          <div style={{ fontSize: 11, fontWeight: 500, color: t.d > 0 ? C.sage : t.d < 0 ? C.red : C.muted }}>
                            {t.d > 0 ? '▲' : t.d < 0 ? '▼' : '–'} {Math.abs(t.d)}% vs {yr - 1}
                          </div>
                        )}
                        {t.extra && <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>{t.extra}</div>}
                      </div>
                    ))}
                  </div>
                )
              })()}

              {analyticsGoalStats.hasGoal && (() => {
                const { goalYear, totalThisGoalYear, pct, onTrack, projectedTotal, gap } = analyticsGoalStats
                return (
                <div style={{ ...s.card, marginBottom: 24 }}>
                  <div style={s.analyticsCardTitle}>Annual Fundraising Goal — {goalYear} <InfoTip text="Total confirmed donations this calendar year against the goal you've set. Includes donations only, not grants. Always shows the current year, regardless of the year filter above. Set or change your goal in Settings." /></div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                    <span style={s.analyticsStatNumber}>${totalThisGoalYear.toLocaleString()}</span>
                    <span style={{ fontSize: 11.5, color: C.muted }}>of ${annualGoal.toLocaleString()} goal · {pct}%</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: onTrack ? C.sage : C.gold, fontWeight: 500 }}>
                    {onTrack
                      ? `✓ On pace to raise $${projectedTotal.toLocaleString()} by Dec 31 — $${gap.toLocaleString()} above goal`
                      : `⚠ On pace to raise $${projectedTotal.toLocaleString()} by Dec 31 — $${gap.toLocaleString()} short of goal`}
                  </div>
                </div>
                )
              })()}

              <div style={isMobile ? s.threeColMobile : isTablet ? s.threeColTablet : s.threeCol}>
              {(() => {
                if (!revenueTrendStats) return <div />
                const { trendData, firstYr, lastYr, cagr } = revenueTrendStats
                return (
                  <div style={s.card}>
                    <div style={s.analyticsCardTitle}>Revenue Trend — Last {trendData.length} Years <InfoTip text="Total confirmed donations per calendar year, so you can see the long-term trajectory rather than just this year vs last year." /></div>
                    <ResponsiveContainer width="100%" height={130}>
                      <BarChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="year" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toLocaleString()}`} />
                        <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(value) => [`$${value.toLocaleString()}`, 'Total raised']} />
                        <Bar dataKey="total" fill={C.forest} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                    {cagr !== null && (
                      <div style={{ fontSize: 11.5, color: cagr >= 0 ? C.sage : C.red, fontWeight: 500, marginTop: 10 }}>
                        {cagr >= 0 ? '✓' : '⚠'} {Math.abs(cagr)}% average annual growth from {firstYr.year} to {lastYr.year}
                      </div>
                    )}
                  </div>
                )
              })()}

              {(() => {
                const { yr, channelRows } = revenueByChannelStats
                return (
                  <div style={s.card}>
                    <div style={s.analyticsCardTitle}>Revenue by Channel — {yr} <InfoTip text="Where your confirmed revenue actually came from this year: campaigns, mass appeals, recurring gifts, grants, and undesignated general giving." /></div>
                    {channelRows.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: C.muted }}>No revenue recorded {filterYear !== 'All' ? `in ${yr}` : 'yet'}.</div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 10, marginBottom: 14 }}>
                          {channelRows.map((r, i) => <div key={i} style={{ width: `${r.pct}%`, background: r.color }} />)}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {channelRows.map((r, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 10, height: 10, borderRadius: 3, background: r.color, flexShrink: 0 }} />
                              <span style={{ fontSize: 13, color: C.text, flex: 1 }}>{r.label}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: C.forest }}>{r.pct}%</span>
                              <span style={{ fontSize: 12, color: C.muted, minWidth: 60, textAlign: 'right' }}>${r.amt.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )
              })()}

              {(() => {
                const { yr, totalRevenue, predictablePct, predictableAmt, oneOffAmt } = predictableVsOneOffStats
                return (
                  <div style={s.card}>
                    <div style={s.analyticsCardTitle}>Predictable vs One-Off Revenue — {yr} <InfoTip text="Predictable revenue is recurring gifts, grants, and fulfilled pledges — money you can count on without re-soliciting. One-off is everything else: campaign, mass appeal, and general gifts that each need to be earned fresh." /></div>
                    {totalRevenue === 0 ? (
                      <div style={{ fontSize: 12.5, color: C.muted }}>No revenue recorded {filterYear !== 'All' ? `in ${yr}` : 'yet'}.</div>
                    ) : (
                      <>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, marginBottom: 2, lineHeight: 1 }}>{predictablePct}%</div>
                        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10 }}>of revenue is predictable</div>
                        <div style={{ background: C.ivoryDark, borderRadius: 3, height: 6, overflow: 'hidden', marginBottom: 14 }}>
                          <div style={{ width: `${predictablePct}%`, height: '100%', background: C.sage, borderRadius: 3 }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.ivory, borderRadius: 4 }}>
                            <span style={{ fontSize: 12.5, color: C.text }}>Predictable</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: C.forest }}>${predictableAmt.toLocaleString()}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.ivory, borderRadius: 4 }}>
                            <span style={{ fontSize: 12.5, color: C.text }}>One-off</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: C.forest }}>${oneOffAmt.toLocaleString()}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )
              })()}
              </div>

              <div style={isMobile ? s.threeColMobile : isTablet ? s.threeColTablet : s.threeCol}>
              {(() => {
                const { yr, newDonorChartData, totalNew } = newDonorAcquisitionStats
                return (
                  <div style={s.card}>
                    <div style={s.analyticsCardTitle}>New Donor Acquisition — {yr} <InfoTip text="First-time donors by the month of their very first confirmed gift. Shows whether your donor base is actually growing, not just cycling the same supporters." /></div>
                    <div style={{ minHeight: 22 }} />
                    {totalNew === 0 ? (
                      <div style={{ fontSize: 12.5, color: C.muted }}>No new donors recorded {filterYear !== 'All' ? `in ${yr}` : 'yet'}.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={newDonorChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                          <XAxis dataKey="month" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(value) => [value, 'New donors']} />
                          <Bar dataKey="count" fill={C.teal} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )
              })()}

                <div style={s.card}>
                  <div style={s.analyticsCardTitle}>Monthly Donations — {filterYear}{filterYear !== 'All' && ` vs ${parseInt(filterYear) - 1}`} <InfoTip text="Confirmed donations by month, compared against the same months last year." /></div>
                  <div style={{ minHeight: 22, display: 'flex', gap: 14, fontSize: 10.5, color: C.muted }}>
                    {filterYear !== 'All' && (
                      <>
                        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: C.sage, borderRadius: 2, marginRight: 5 }} />{filterYear}</span>
                        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: C.border, borderRadius: 2, marginRight: 5 }} />{parseInt(filterYear) - 1}</span>
                      </>
                    )}
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toLocaleString()}`} />
                      <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(value, name) => [`$${value.toLocaleString()}`, name === 'amount' ? filterYear : (filterYear !== 'All' ? `${parseInt(filterYear) - 1}` : 'Previous year')]} />
                      {filterYear !== 'All' && <Bar dataKey="lastYearAmount" fill={C.border} radius={[6, 6, 0, 0]} isAnimationActive={false} />}
                      <Bar dataKey="amount" fill={C.sage} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={s.card}>
                  <div style={s.analyticsCardTitle}>Number of Donations per Month — {filterYear} <InfoTip text="Count of individual confirmed donations received each month, regardless of amount." /></div>
                  <div style={{ minHeight: 22 }} />
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={monthlyCountData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} />
                      <Line type="monotone" dataKey="count" stroke={C.gold} strokeWidth={2.5} dot={{ fill: C.gold, r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div style={{ position: 'relative', paddingLeft: 24, marginBottom: 40 }}>
              <div style={{ position: 'absolute', left: 0, top: 4, bottom: 4, width: 1, background: C.borderStrong }} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.muted }}>03</span>
                <span style={{ fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: C.forest, fontWeight: 500 }}>Campaign Performance</span>
              </div>

              {(() => {
                const { yr, tiles } = campaignSnapshotStats
                return (
                  <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: (isMobile || isTablet) ? 'wrap' : 'nowrap' }}>
                    {tiles.map((t, i) => (
                      <div key={i} style={{ ...s.card, flex: 1, minWidth: (isMobile || isTablet) ? '100%' : 0 }}>
                        <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>{t.label} <InfoTip text={t.tip} /></div>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>{t.val}</div>
                        {t.d === null ? (
                          <div style={{ fontSize: 11, color: C.muted }}>new in {yr}</div>
                        ) : (
                          <div style={{ fontSize: 11, fontWeight: 500, color: t.d > 0 ? C.sage : t.d < 0 ? C.red : C.muted }}>
                            {t.d > 0 ? '▲' : t.d < 0 ? '▼' : '–'} {Math.abs(t.d)}% vs {yr - 1}
                          </div>
                        )}
                        {t.extra && <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>{t.extra}</div>}
                      </div>
                    ))}
                  </div>
                )
              })()}

              {(() => {
                const { yr, strip } = campaignGoalStrip
                return (
                  <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: (isMobile || isTablet) ? 'wrap' : 'nowrap' }}>
                    {strip.map((t, i) => (
                      <div key={i} style={{ ...s.card, flex: 1, minWidth: (isMobile || isTablet) ? '100%' : 0 }}>
                        <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>{t.label} <InfoTip text={t.tip} /></div>
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
                )
              })()}

              {(() => {
                const { endingSoon, campaignRows, trendData, donorGrowthRows, donorGrowthAgg } = campaignLeaderboardStats

                return (
                  <>
                    {endingSoon.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: 4, padding: '10px 14px', marginBottom: 16 }}>
                        <span style={{ fontSize: 12.5, color: C.warning }}>⏰ {endingSoon.length} campaign{endingSoon.length !== 1 ? 's' : ''} end{endingSoon.length === 1 ? 's' : ''} this week — {endingSoon.map(r => `${r.title} (${r.daysToEnd}d)`).join(', ')}</span>
                      </div>
                    )}

                    <div style={isMobile ? s.twoColMobile : s.twoCol}>
                      <div style={s.card}>
                        <div style={s.analyticsCardTitle}>Campaign Leaderboard — {filterYear} <InfoTip text={`All campaigns launched this year, ranked by total raised, including ones that received no donations. Shows progress toward each campaign's goal where one has been set. ROI shown where cost is logged — ${campaignRows.filter(r => r.cost > 0).length} of ${campaignRows.length} campaign${campaignRows.length !== 1 ? 's' : ''} have cost data. Click a row to view that campaign.`} /></div>
                        {campaignRows.length === 0 ? (
                          <div style={{ fontSize: 13, color: C.muted, padding: '8px 0' }}>No campaigns launched {filterYear !== 'All' ? `in ${filterYear}` : 'yet'}.</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {campaignRows.map((row, i) => {
                              const bg = row.behind ? '#FBEEE9' : row.slightlyBehind ? '#FDF8EC' : row.hasGoal && row.goalReached ? '#EAF3DE' : C.ivory
                              const accentColor = row.behind ? C.red : row.slightlyBehind ? C.gold : row.hasGoal && row.goalReached ? '#27500A' : C.forest
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
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: row.hasGoal ? 8 : 2 }}>
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontSize: 13, fontWeight: 700, color: accentColor, marginBottom: 2 }}>{i + 1}. {row.title}</div>
                                      <div style={{ fontSize: 10.5, color: C.muted }}>{row.count === 0 ? 'No donations yet' : `${row.count} donation${row.count > 1 ? 's' : ''} · ${row.donors} donor${row.donors > 1 ? 's' : ''} · avg $${row.avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 16, flexShrink: 0, marginLeft: 16 }}>
                                      <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 9.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Total Raised</div>
                                        <div style={{ fontFamily: C.fontVoice, fontSize: 20, fontWeight: 500, color: C.forest, lineHeight: 1 }}>${row.total.toLocaleString()}</div>
                                      </div>
                                      {row.cost > 0 && (
                                        <div style={{ textAlign: 'right' }}>
                                          <div style={{ fontSize: 9.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>ROI</div>
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
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      <div>
                        {trendData.length >= 2 && (
                          <div style={{ ...s.card, marginBottom: 16 }}>
                            <div style={s.analyticsCardTitle}>Campaign Revenue Trend <InfoTip text="Average amount raised per campaign that received at least one confirmed donation, by year. Normalizes for running more or fewer campaigns year to year." /></div>
                            <ResponsiveContainer width="100%" height={140}>
                              <BarChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                                <XAxis dataKey="year" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toLocaleString()}`} />
                                <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(value) => [`$${value.toLocaleString()}`, 'Avg per campaign']} />
                                <Bar dataKey="avgPerCampaign" fill={C.forest} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                              </BarChart>
                            </ResponsiveContainer>
                            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>{trendData[trendData.length - 1].campaignsThatYear} campaign{trendData[trendData.length - 1].campaignsThatYear !== 1 ? 's' : ''} in {trendData[trendData.length - 1].year} vs {trendData[0].campaignsThatYear} in {trendData[0].year}</div>
                          </div>
                        )}

                        {donorGrowthAgg && (() => {
                          const { aggTotal, aggOrganicPct, aggAppealPct, aggReferralPct, appealReliant, standoutOrganic, stagnant, restCount } = donorGrowthAgg

                          return (
                          <div style={s.card}>
                            <div style={s.analyticsCardTitle}>Donor Growth & Funding Sources — {filterYear} <InfoTip text="Overall funding mix across all campaigns — organic giving, mass appeals (traced by PayNow reference), and referrals — plus callouts for campaigns that stand out: heavily appeal-reliant, fully organic new-donor wins, or stagnant with no new donors." /></div>

                            <div style={{ padding: '12px 14px', background: C.ivory, borderRadius: 4, border: `1px solid ${C.border}`, marginBottom: 16 }}>
                              <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Funding mix across all campaigns</div>
                              {aggTotal === 0 ? (
                                <div style={{ fontSize: 12.5, color: C.muted }}>No campaign revenue yet.</div>
                              ) : (
                                <>
                                  <div style={{ display: 'flex', borderRadius: 3, overflow: 'hidden', height: 8, marginBottom: 8 }}>
                                    {aggOrganicPct > 0 && <div style={{ width: `${aggOrganicPct}%`, background: C.sage }} />}
                                    {aggAppealPct > 0 && <div style={{ width: `${aggAppealPct}%`, background: C.gold }} />}
                                    {aggReferralPct > 0 && <div style={{ width: `${aggReferralPct}%`, background: C.muted }} />}
                                  </div>
                                  <div style={{ display: 'flex', gap: 14, fontSize: 11, color: C.text, flexWrap: 'wrap' }}>
                                    <span><span style={{ display: 'inline-block', width: 9, height: 9, background: C.sage, borderRadius: 2, marginRight: 5 }} />{aggOrganicPct}% organic</span>
                                    <span><span style={{ display: 'inline-block', width: 9, height: 9, background: C.gold, borderRadius: 2, marginRight: 5 }} />{aggAppealPct}% mass appeal</span>
                                    <span><span style={{ display: 'inline-block', width: 9, height: 9, background: C.muted, borderRadius: 2, marginRight: 5 }} />{aggReferralPct}% referral</span>
                                  </div>
                                </>
                              )}
                            </div>

                            <div style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Notable</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {appealReliant.map((r, i) => (
                                <div key={`appeal-${i}`} style={{ padding: '10px 12px', background: C.warningBg, borderRadius: 4, border: `1px solid ${C.warningBorder}` }}>
                                  <div style={{ fontSize: 12.5, fontWeight: 500, color: C.warning }}>{r.title} is {r.appealPct}% reliant on a mass appeal</div>
                                  <div style={{ fontSize: 10.5, color: C.warning }}>{r.newPct}% new donors · without that appeal, this campaign would have raised far less on its own</div>
                                </div>
                              ))}
                              {standoutOrganic.map((r, i) => (
                                <div key={`organic-${i}`} style={{ padding: '10px 12px', background: '#EAF3DE', borderRadius: 4, border: `1px solid ${C.border}` }}>
                                  <div style={{ fontSize: 12.5, fontWeight: 500, color: '#27500A' }}>{r.title} brought in {r.newCount} brand-new donor{r.newCount !== 1 ? 's' : ''}</div>
                                  <div style={{ fontSize: 10.5, color: '#27500A' }}>100% new, fully organic — no appeal or referral involved</div>
                                </div>
                              ))}
                              {stagnant.map((r, i) => (
                                <div key={`stagnant-${i}`} style={{ padding: '10px 12px', background: C.ivory, borderRadius: 4, border: `1px solid ${C.border}` }}>
                                  <div style={{ fontSize: 12.5, fontWeight: 500, color: C.text }}>{r.title} hasn't attracted any new donors</div>
                                  <div style={{ fontSize: 10.5, color: C.muted }}>All {r.existingCount} donor{r.existingCount !== 1 ? 's' : ''} had given before — worth a push to reach new supporters</div>
                                </div>
                              ))}
                              {restCount > 0 && (
                                <div style={{ padding: '10px 12px', background: C.ivory, borderRadius: 4, border: `1px solid ${C.border}` }}>
                                  <div style={{ fontSize: 12.5, fontWeight: 500, color: C.text }}>{restCount} other campaign{restCount !== 1 ? 's are' : ' is'} mostly organic with a healthy new-donor mix</div>
                                  <div style={{ fontSize: 10.5, color: C.muted }}>Nothing to flag — steady, unassisted growth</div>
                                </div>
                              )}
                            </div>
                          </div>
                          )
                        })()}
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>

            <div style={{ position: 'relative', paddingLeft: 24, marginBottom: 40 }}>
              <div style={{ position: 'absolute', left: 0, top: 4, bottom: 4, width: 1, background: C.borderStrong }} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.muted }}>04</span>
                <span style={{ fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: C.forest, fontWeight: 500 }}>Mass Appeals</span>
              </div>

              {(() => {
                const { yr, tiles } = appealSnapshotStats
                return (
                  <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: (isMobile || isTablet) ? 'wrap' : 'nowrap' }}>
                    {tiles.map((t, i) => (
                      <div key={i} style={{ ...s.card, flex: 1, minWidth: (isMobile || isTablet) ? '100%' : 0 }}>
                        <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>{t.label} <InfoTip text={t.tip} /></div>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>{t.val}</div>
                        {t.d === null ? (
                          <div style={{ fontSize: 11, color: C.muted }}>new in {yr}</div>
                        ) : (
                          <div style={{ fontSize: 11, fontWeight: 500, color: t.d > 0 ? C.sage : t.d < 0 ? C.red : C.muted }}>
                            {t.d > 0 ? '▲' : t.d < 0 ? '▼' : '–'} {Math.abs(t.d)}% vs {yr - 1}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })()}

              {(() => {
                const { yr, strip } = appealListStrip
                return (
                  <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: (isMobile || isTablet) ? 'wrap' : 'nowrap' }}>
                    {strip.map((t, i) => (
                      <div key={i} style={{ ...s.card, flex: 1, minWidth: (isMobile || isTablet) ? '100%' : 0 }}>
                        <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>{t.label} <InfoTip text={t.tip} /></div>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>{t.val}</div>
                        {t.d !== undefined ? (
                          t.d === null ? (
                            <div style={{ fontSize: 11, color: C.muted }}>new in {yr}</div>
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
                )
              })()}

              {(() => {
                const { trendData, yr, medianResponseDays, respBuckets, respTotal, within24h, within7d } = appealTrendStats

                return (
                  <div style={isMobile ? s.twoColMobile : s.twoCol}>
                    {trendData.length >= 2 && (
                      <div style={s.card}>
                        <div style={s.analyticsCardTitle}>Appeals Trend — Last {trendData.length} Years <InfoTip text="Total raised from mass appeals per year, so you can see the long-term trajectory rather than just this year vs last year." /></div>
                        <ResponsiveContainer width="100%" height={130}>
                          <BarChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                            <XAxis dataKey="year" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toLocaleString()}`} />
                            <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(value) => [`$${value.toLocaleString()}`, 'Raised']} />
                            <Bar dataKey="raised" fill={C.forest} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                          </BarChart>
                        </ResponsiveContainer>
                        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>Total raised from appeals, by year.</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, marginTop: 12, paddingTop: 12 }}>
                          <span style={{ fontSize: 11, color: C.muted }}>Conversion rate trend</span>
                          <span style={{ fontSize: 11, color: C.text }}>{trendData.map(d => d.conversionRate !== null ? `${d.conversionRate}%` : '—').join(' → ')}</span>
                        </div>
                      </div>
                    )}

                    <div style={s.card}>
                      <div style={s.analyticsCardTitle}>Response Speed — {yr} <InfoTip text="How long after a mass appeal is sent donors typically respond, measured from the appeal recipient's send time to their matched confirmed donation." /></div>
                      {medianResponseDays === null ? (
                        <div style={{ fontSize: 12.5, color: C.muted }}>No converted appeal recipients yet {filterYear !== 'All' ? `in ${yr}` : ''}.</div>
                      ) : (
                        <>
                          <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, marginBottom: 2, lineHeight: 1 }}>{medianResponseDays} day{medianResponseDays !== 1 ? 's' : ''}</div>
                          <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>median time from appeal sent to donation</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {respBuckets.map((b, i) => {
                              const pct = respTotal > 0 ? Math.round((b.count / respTotal) * 100) : 0
                              return (
                                <div key={i}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted, marginBottom: 4 }}>
                                    <span>{b.label}</span>
                                    <span>{pct}%</span>
                                  </div>
                                  <div style={{ background: C.ivoryDark, borderRadius: 3, height: 6, overflow: 'hidden' }}>
                                    <div style={{ width: `${pct}%`, height: '100%', background: b.color, borderRadius: 3 }} />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 12 }}>{within24h + within7d >= respTotal * 0.7 ? 'Results are mostly in within a week — safe to report final numbers after 7 days.' : 'A meaningful share of responses arrive after a week — wait longer before reporting final numbers.'}</div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })()}

              <div style={isMobile ? s.twoColMobile : s.twoCol}>
                {(() => {
                  const { yearNum, scopedAppeals, lastYearAppeals, scopedAnalyzed, totalRaised, overallConversion, appealCountDiff, conversionDiff, lastYearRaised, lastYearConversion, causeSpecificAvg, generalAvg, distinctAmounts } = appealConversionStats

                  return (
                    <div style={s.card}>
                      <div style={s.analyticsCardTitle}>Mass Appeal Conversion — {filterYear} <InfoTip text="Matches appeal recipients to actual donations by PayNow reference to show which appeals converted into real gifts. Only donations made using the QR code sent in the appeal are counted." /></div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Appeals sent</div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                            <span style={s.analyticsStatNumber}>{scopedAppeals.length}</span>
                            {lastYearAppeals.length > 0 && <span style={{ fontSize: 10.5, fontWeight: 500, color: appealCountDiff >= 0 ? C.sage : C.red }}>{appealCountDiff === 0 ? '—' : appealCountDiff > 0 ? `↑${appealCountDiff}` : `↓${Math.abs(appealCountDiff)}`}</span>}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Raised</div>
                          <div style={s.analyticsStatNumber}>${totalRaised.toLocaleString()}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Conversion</div>
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
                              const bg = a.conversionRate >= 25 ? '#EAF3DE' : a.conversionRate >= 15 ? '#FDF8EC' : C.ivory
                              const textColor = a.conversionRate >= 25 ? '#27500A' : a.conversionRate >= 15 ? '#854F0B' : C.text
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
                            <div style={{ fontSize: 11.5, color: C.muted, fontStyle: 'italic' }}>Only {scopedAnalyzed.filter(a => a.sentCount > 0).length} appeal{scopedAnalyzed.filter(a => a.sentCount > 0).length !== 1 ? 's' : ''} so far — not enough spread in ask amounts yet to show a reliable pattern.</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {distinctAmounts.sort((a, b) => a - b).map((amt, i) => {
                                const matching = scopedAnalyzed.filter(a => Number(a.appeal.amount) === amt && a.sentCount > 0)
                                const avgConv = Math.round(matching.reduce((s, a) => s + a.conversionRate, 0) / matching.length)
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
                    </div>
                  )
                })()}

                {(() => {
                  const { yr, curDelivery, prevDelivery, bounceReasons, repeatRecipients, fatigueList, overGivers, fatiguedCount } = appealListHealthStats
                  const ptDelta = (c, p) => prevDelivery.total === 0 ? null : c - p

                  return (
                    <div style={s.card}>
                      <div style={s.analyticsCardTitle}>Appeal List Health <InfoTip text="Bounces are bad contact data — the message couldn't be delivered. Opt-outs are donors who actively blocked appeals — a stewardship signal, not a data problem." /></div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Bounced</div>
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
                          <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Opted Out</div>
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
                            {bounceReasons.slice(0, 5).map((r, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.ivory, borderRadius: 4 }}>
                                <span style={{ fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{r.reason}</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: C.forest }}>{r.count}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Repeat recipients</div>
                          <div style={s.analyticsStatNumber}>{repeatRecipients.length}</div>
                          <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>received 2+ appeals</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>List Fatigue</div>
                          <div style={{ ...s.analyticsStatNumber, color: fatiguedCount > 0 ? C.gold : C.forest }}>{fatiguedCount}</div>
                          <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>gave before, skipped last appeal</div>
                        </div>
                      </div>

                      <div style={s.analyticsSubTitleDivider}>Response pattern among repeat recipients</div>
                      {fatigueList.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 18 }}>No donors have received more than one appeal yet.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                          {fatigueList.slice(0, 5).map((d, i) => (
                            <div key={i} style={{ padding: '8px 10px', background: d.isFatigued ? '#FBEEE9' : C.ivory, borderRadius: 4 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <span style={{ fontSize: 12.5, fontWeight: 500, color: d.isFatigued ? C.red : C.forest }}>{d.name}</span>
                                <span style={{ fontSize: 11, color: d.isFatigued ? C.red : C.muted }}>{d.isFatigued ? `gave earlier, skipped most recent` : `gave ${d.gaveCount} of ${d.totalAppeals} sent`}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={s.analyticsSubTitle}>Donors who gave more than asked</div>
                      {overGivers.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: C.muted }}>No standout over-gifts from appeal recipients yet.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {overGivers.slice(0, 5).map((d, i) => (
                            <div key={i} style={{ padding: '8px 10px', background: C.ivory, borderRadius: 4, display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 12.5, fontWeight: 500, color: C.forest }}>{d.name}</span>
                              <span style={{ fontSize: 11, color: C.muted }}>asked ${d.asked} · gave ${d.gave}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>

            <div style={{ position: 'relative', paddingLeft: 24, marginBottom: 40 }}>
              <div style={{ position: 'absolute', left: 0, top: 4, bottom: 4, width: 1, background: C.borderStrong }} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.muted }}>05</span>
                <span style={{ fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: C.forest, fontWeight: 500 }}>Pledge Performance</span>
              </div>

              {(() => {
                const { yr, tiles } = pledgeSnapshotStats
                return (
                  <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: (isMobile || isTablet) ? 'wrap' : 'nowrap' }}>
                    {tiles.map((t, i) => (
                      <div key={i} style={{ ...s.card, flex: 1, minWidth: (isMobile || isTablet) ? '100%' : 0 }}>
                        <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>{t.label} <InfoTip text={t.tip} /></div>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>{t.val}</div>
                        {t.d === null ? (
                          <div style={{ fontSize: 11, color: C.muted }}>new in {yr}</div>
                        ) : (
                          <div style={{ fontSize: 11, fontWeight: 500, color: t.d > 0 ? C.sage : t.d < 0 ? C.red : C.muted }}>
                            {t.d > 0 ? '▲' : t.d < 0 ? '▼' : '–'} {Math.abs(t.d)}% vs {yr - 1}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })()}

              {(() => {
                const { yr, overdueUnits, overdueTotal, avgPledgeSize, avgDelta, cancellationRate, repeatPledgeRate, trendData } = pledgeStatsAndTrend

                return (
                  <>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: (isMobile || isTablet) ? 'wrap' : 'nowrap' }}>
                      <div style={{ ...s.card, flex: 1, minWidth: (isMobile || isTablet) ? '100%' : 0, background: overdueUnits.length > 0 ? '#FBEEE9' : C.white, border: overdueUnits.length > 0 ? `1px solid ${C.red}` : `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 10.5, color: overdueUnits.length > 0 ? C.red : C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>Currently Overdue <InfoTip text="Pending pledges (or unpaid instalments of multi-year pledges) whose expected date has already passed. Not gated by any threshold — this counts every overdue pledge." /></div>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: overdueUnits.length > 0 ? C.red : C.forest, lineHeight: 1, marginBottom: 6 }}>{overdueUnits.length} <span style={{ fontSize: 15, fontWeight: 400 }}>· ${overdueTotal.toLocaleString()}</span></div>
                        <div style={{ fontSize: 11, color: overdueUnits.length > 0 ? C.red : C.muted }}>pending pledges past their due date</div>
                      </div>
                      <div style={{ ...s.card, flex: 1, minWidth: (isMobile || isTablet) ? '100%' : 0 }}>
                        <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>Avg Pledge Size <InfoTip text={`Average pledge amount among pledges expected in ${yr}, compared to ${yr - 1}.`} /></div>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>${avgPledgeSize.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        {avgDelta === null ? (
                          <div style={{ fontSize: 11, color: C.muted }}>new in {yr}</div>
                        ) : (
                          <div style={{ fontSize: 11, fontWeight: 500, color: avgDelta > 0 ? C.sage : avgDelta < 0 ? C.red : C.muted }}>
                            {avgDelta > 0 ? '▲' : avgDelta < 0 ? '▼' : '–'} {Math.abs(avgDelta)}% vs {yr - 1}
                          </div>
                        )}
                      </div>
                      <div style={{ ...s.card, flex: 1, minWidth: (isMobile || isTablet) ? '100%' : 0 }}>
                        <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>Cancellation Rate <InfoTip text={`Share of pledges expected in ${yr} that were cancelled.`} /></div>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>{cancellationRate}%</div>
                        <div style={{ fontSize: 11, color: C.muted }}>of pledges made were cancelled</div>
                      </div>
                      <div style={{ ...s.card, flex: 1, minWidth: (isMobile || isTablet) ? '100%' : 0 }}>
                        <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>Repeat Pledge Rate <InfoTip text="Share of donors who have ever made a pledge who have made more than one pledge, across all time. A one-time pledger vs. someone who pledges again and again." /></div>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>{repeatPledgeRate}%</div>
                        <div style={{ fontSize: 11, color: C.muted }}>of pledge donors have pledged 2+ times</div>
                      </div>
                    </div>

                    <div style={isMobile ? s.twoColMobile : s.twoCol}>
                      {trendData.length >= 2 && (
                        <div style={s.card}>
                          <div style={s.analyticsCardTitle}>Pledge Fulfillment Trend <InfoTip text="Total pledged vs total fulfilled, by year the pledge was expected. The current year is still in progress, so its fulfillment rate will look lower until it closes out." /></div>
                          <ResponsiveContainer width="100%" height={140}>
                            <BarChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                              <XAxis dataKey="year" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toLocaleString()}`} />
                              <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(value, name) => [`$${value.toLocaleString()}`, name === 'pledged' ? 'Pledged' : 'Fulfilled']} />
                              <Bar dataKey="pledged" fill={C.border} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                              <Bar dataKey="fulfilled" fill={C.sage} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                            </BarChart>
                          </ResponsiveContainer>
                          <div style={{ display: 'flex', gap: 14, fontSize: 10.5, color: C.muted, marginTop: 8 }}>
                            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: C.sage, borderRadius: 2, marginRight: 5 }} />Fulfilled</span>
                            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: C.border, borderRadius: 2, marginRight: 5 }} />Pledged</span>
                          </div>
                        </div>
                      )}

                      <div style={s.card}>
                        <div style={s.analyticsCardTitle}>Overdue Pledges <InfoTip text="Pending pledges (or unpaid instalments) whose expected date has passed, sorted by how overdue they are." /></div>
                        {overdueUnits.length === 0 ? (
                          <div style={{ fontSize: 12.5, color: C.muted }}>No overdue pledges right now.</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {overdueUnits.slice(0, 5).map((u, i) => (
                              <div key={i} style={{ padding: '9px 11px', background: '#FBEEE9', borderRadius: 4 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: 12.5, fontWeight: 500, color: C.red }}>{u.donor_name}</span>
                                  <span style={{ fontSize: 12, fontWeight: 500, color: C.red }}>${u.amount.toLocaleString()}</span>
                                </div>
                                <div style={{ fontSize: 10.5, color: C.red }}>{u.daysOverdue} day{u.daysOverdue !== 1 ? 's' : ''} overdue</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )
              })()}

              <div style={isMobile ? s.twoColMobile : s.twoCol}>
              {(() => {
                const { yearNum, lastYearPledges, lastYearTotal, fulfilledWithDates, onTimeGroup, slightlyLateGroup, veryLateGroup, lastYearOnTimeRate, watchList } = pledgeReliabilityStats

                return (
                  <div style={s.card}>
                    <div style={s.analyticsCardTitle}>Pledge Reliability — {filterYear} <InfoTip text="How punctual fulfilled pledges have been this year, and which donors have a pattern of broken or overdue pledges. Totals and on-time rate are shown in the tiles above." /></div>

                    {lastYearPledges.length > 0 && (
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>{yearNum - 1}: {lastYearPledges.length} pledge{lastYearPledges.length !== 1 ? 's' : ''} · ${lastYearTotal.toLocaleString()} pledged{lastYearOnTimeRate !== null ? ` · ${lastYearOnTimeRate}% fulfilled on time` : ''}</div>
                    )}

                    {fulfilledWithDates.length > 0 && (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.gold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, borderTop: `1px dashed ${C.border}`, paddingTop: 14 }}>Fulfilled pledges: how late did they run?</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.ivory, borderRadius: 4 }}>
                            <span style={{ fontSize: 12, color: C.text }}>On time or early</span>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: C.sage }}>{fulfilledWithDates.length > 0 ? Math.round((onTimeGroup.length / fulfilledWithDates.length) * 100) : 0}% · {onTimeGroup.length} · ${onTimeGroup.reduce((s, f) => s + Number(f.pledge.amount), 0).toLocaleString()}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.ivory, borderRadius: 4 }}>
                            <span style={{ fontSize: 12, color: C.text }}>1–14 days late</span>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: C.forest }}>{fulfilledWithDates.length > 0 ? Math.round((slightlyLateGroup.length / fulfilledWithDates.length) * 100) : 0}% · {slightlyLateGroup.length} · ${slightlyLateGroup.reduce((s, f) => s + Number(f.pledge.amount), 0).toLocaleString()}</span>
                          </div>
                          {veryLateGroup.length > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.warningBg, borderRadius: 4 }}>
                              <span style={{ fontSize: 12, color: C.warning }}>15+ days late</span>
                              <span style={{ fontSize: 12.5, fontWeight: 600, color: C.warning }}>{Math.round((veryLateGroup.length / fulfilledWithDates.length) * 100)}% · {veryLateGroup.length} · ${veryLateGroup.reduce((s, f) => s + Number(f.pledge.amount), 0).toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderTop: `1px dashed ${C.border}`, paddingTop: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.gold, textTransform: 'uppercase', letterSpacing: 0.5 }}>Donors worth watching</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 10.5, color: C.muted }}>Flag after</span>
                        <select style={{ fontSize: 10.5, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 5px', color: C.forest, background: C.white, fontFamily: 'inherit' }} value={pledgeWatchThreshold} onChange={async e => { const v = Number(e.target.value); setPledgeWatchThreshold(v); const { error } = await supabase.from('charity_contacts').update({ pledge_watch_threshold: v }).eq('charity_uen', charityUen); if (error) { console.error('Failed to save pledge watch threshold:', error); showToast('Could not save this setting — please try again', 'error') } }}>
                          <option value={1}>1 broken pledge</option>
                          <option value={2}>2 broken pledges</option>
                          <option value={3}>3 broken pledges</option>
                        </select>
                      </div>
                    </div>
                    {watchList.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: C.muted }}>No donors currently meet this threshold.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {watchList.slice(0, 5).map((d, i) => (
                          <div key={i} style={{ padding: '10px 12px', background: d.overdueNow.length > 0 ? '#FBEEE9' : C.ivory, borderRadius: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                              <span style={{ fontSize: 12.5, fontWeight: 500, color: d.overdueNow.length > 0 ? C.red : C.forest }}>{d.name}{d.overdueNow.length > 0 ? ' — overdue now' : ''}</span>
                              <span style={{ fontSize: 11, color: d.overdueNow.length > 0 ? C.red : C.muted }}>{d.pledges.length} pledge{d.pledges.length !== 1 ? 's' : ''}, {d.brokenCount} broken · ${d.broken.reduce((s, p) => s + Number(p.amount), 0).toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

              {(() => {
                const { donorRanked, topDonorPct, highRisk, medRisk, tooFewDonors, monthsRanked, heaviestMonth } = pledgeConcentrationStats

                return (
                  <div style={s.card}>
                    <div style={s.analyticsCardTitle}>Pledge Concentration & Timing <InfoTip text="Share of outstanding pledge value tied to your single largest donor, and which months carry an unusually large share of expected pledge income. Multi-year pledges are counted by their remaining unpaid instalments, not their full multi-year total." /></div>

                    {tooFewDonors ? (
                      <div style={{ fontSize: 12.5, color: C.muted }}>Too few outstanding pledges to assess concentration yet.</div>
                    ) : (
                      <>
                        <div style={{ ...s.analyticsStatNumber, color: highRisk ? C.red : medRisk ? C.gold : C.forest, marginBottom: 4 }}>{topDonorPct}%</div>
                        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>of outstanding pledge value from your single largest pledge</div>
                        <div style={{ background: C.ivoryDark, borderRadius: 3, height: 6, overflow: 'hidden', marginBottom: 6 }}>
                          <div style={{ width: `${topDonorPct}%`, height: '100%', background: highRisk ? C.red : medRisk ? C.gold : C.sage, borderRadius: 3 }} />
                        </div>
                        <div style={{ fontSize: 11.5, color: highRisk ? C.red : medRisk ? C.gold : C.sage, fontWeight: 500, marginBottom: 18 }}>
                          {highRisk ? '⚠ High concentration risk' : medRisk ? '⚠ Moderate concentration risk' : '✓ Well diversified'}
                        </div>
                      </>
                    )}

                    {donorRanked.length > 0 && (
                      <>
                        <div style={s.analyticsSubTitleDivider}>Largest outstanding pledges</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                          {donorRanked.slice(0, 5).map((d, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.ivory, borderRadius: 4 }}>
                              <span style={{ fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{d.name}</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: C.forest }}>${d.amount.toLocaleString()} · {d.pct}%</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    <div style={s.analyticsSubTitle}>Outstanding pledges by expected month</div>
                    {monthsRanked.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: C.muted }}>No outstanding pledges right now.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {monthsRanked.map((m, i) => {
                          const isHeaviest = heaviestMonth && m.label === heaviestMonth.label && monthsRanked.length > 1
                          return (
                            <div key={i} style={{ padding: '10px 12px', background: isHeaviest ? C.warningBg : C.ivory, borderRadius: 4 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <span style={{ fontSize: 12.5, fontWeight: 500, color: isHeaviest ? C.warning : C.text }}>{m.label}</span>
                                <span style={{ fontSize: 11, color: isHeaviest ? C.warning : C.muted }}>${m.amount.toLocaleString()} · {m.count} pledge{m.count !== 1 ? 's' : ''}</span>
                              </div>
                              {isHeaviest && (
                                <div style={{ fontSize: 11, color: C.warning, marginTop: 2 }}>Heaviest single month — worth confirming these are on track</div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })()}
              </div>

              </div>

            <div style={{ position: 'relative', paddingLeft: 24, marginBottom: 40 }}>
              <div style={{ position: 'absolute', left: 0, top: 4, bottom: 4, width: 1, background: C.borderStrong }} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.muted }}>06</span>
                <span style={{ fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: C.forest, fontWeight: 500 }}>Recurring Donations Performance</span>
              </div>

              {(() => {
                const { yr, tiles } = recurringSnapshotStats
                return (
                  <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: (isMobile || isTablet) ? 'wrap' : 'nowrap' }}>
                    {tiles.map((t, i) => (
                      <div key={i} style={{ ...s.card, flex: 1, minWidth: (isMobile || isTablet) ? '100%' : 0 }}>
                        <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>{t.label} <InfoTip text={t.tip} /></div>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>{t.val}</div>
                        {t.d === null ? (
                          <div style={{ fontSize: 11, color: C.muted }}>new in {yr}</div>
                        ) : (
                          <div style={{ fontSize: 11, fontWeight: 500, color: t.d > 0 ? C.sage : t.d < 0 ? C.red : C.muted }}>
                            {t.d > 0 ? '▲' : t.d < 0 ? '▼' : '–'} {Math.abs(t.d)}% vs {yr - 1}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })()}

              {(() => {
                const { trendData, yr, newMrr, churnedMrr, netMrr } = recurringMrrStats

                return (
                  <div style={isMobile ? s.twoColMobile : s.twoCol}>
                    {trendData.length >= 2 && (
                      <div style={s.card}>
                        <div style={s.analyticsCardTitle}>Recurring Revenue Trend <InfoTip text="Monthly recurring revenue as of December each year, based on which gifts were active at that point. Shows the long-term trajectory of your recurring program." /></div>
                        <ResponsiveContainer width="100%" height={140}>
                          <BarChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                            <XAxis dataKey="year" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toLocaleString()}`} />
                            <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(value) => [`$${value.toLocaleString()}`, 'MRR']} />
                            <Bar dataKey="mrr" fill={C.forest} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                          </BarChart>
                        </ResponsiveContainer>
                        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>Monthly recurring revenue as of December each year.</div>
                      </div>
                    )}

                    <div style={s.card}>
                      <div style={s.analyticsCardTitle}>New vs Churned MRR — {yr} <InfoTip text="How much monthly recurring revenue was added by new recurring gifts this year, vs lost to cancellations, netting to the change in MRR." /></div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#EAF3DE', borderRadius: 4 }}>
                          <span style={{ fontSize: 12, color: '#27500A' }}>+ New MRR added</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: '#27500A' }}>${Math.round(newMrr).toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#FBEEE9', borderRadius: 4 }}>
                          <span style={{ fontSize: 12, color: C.red }}>− Churned MRR lost</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: C.red }}>${Math.round(churnedMrr).toLocaleString()}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                        <span style={{ fontSize: 11.5, color: C.muted }}>Net MRR change</span>
                        <span style={{ fontFamily: C.fontVoice, fontSize: 20, fontWeight: 500, color: netMrr >= 0 ? C.sage : C.red }}>{netMrr >= 0 ? '+' : '−'}${Math.abs(Math.round(netMrr)).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )
              })()}

              <div style={isMobile ? s.twoColMobile : s.twoCol}>
                {(() => {
                  const { activeGifts, giftCountDiff, mrr, mrrDiffPct, avgLifespanMonths, cancelledGifts, atRiskCount, atRiskMrr, retentionRate, trendFlagsFiltered, upgrades, downgrades } = recurringHealthStats

                  return (
                    <div style={s.card}>
                      <div style={s.analyticsCardTitle}>Recurring Revenue Health <InfoTip text="Active recurring gifts and monthly recurring revenue vs 90 days ago, average time a recurring gift lasts before cancellation, and donors whose giving has consistently increased or decreased over recent cycles." /></div>

                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: 10, marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Active gifts</div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                            <span style={s.analyticsStatNumber}>{activeGifts.length}</span>
                            <span style={{ fontSize: 10.5, fontWeight: 500, color: giftCountDiff >= 0 ? C.sage : C.red }}>{giftCountDiff === 0 ? '—' : giftCountDiff > 0 ? `↑${giftCountDiff}` : `↓${Math.abs(giftCountDiff)}`}</span>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>MRR</div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                            <span style={s.analyticsStatNumber}>${Math.round(mrr).toLocaleString()}</span>
                            {mrrDiffPct !== null && <span style={{ fontSize: 10.5, fontWeight: 500, color: mrrDiffPct >= 0 ? C.sage : C.red }}>{mrrDiffPct >= 0 ? '↑' : '↓'}{Math.abs(mrrDiffPct)}%</span>}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>Retention rate <InfoTip text="Share of recurring gifts that were active a year ago and are still active today." /></div>
                          <div style={{ ...s.analyticsStatNumber, color: retentionRate === null ? C.forest : retentionRate >= 80 ? C.sage : retentionRate >= 60 ? C.gold : C.red }}>{retentionRate !== null ? `${retentionRate}%` : '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Avg. lifespan</div>
                          <div style={s.analyticsStatNumber}>{avgLifespanMonths !== null ? `${avgLifespanMonths} mo` : '—'}</div>
                        </div>
                        <div style={{ gridColumn: isMobile ? 'auto' : 'span 2' }}>
                          <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>At risk</div>
                          <div style={{ ...s.analyticsStatNumber, color: atRiskCount > 0 ? C.red : C.forest }}>{atRiskCount} {atRiskCount > 0 && <span style={{ fontSize: 15, fontWeight: 400 }}>· ${Math.round(atRiskMrr).toLocaleString()} MRR</span>}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 14 }}>Active gifts and MRR vs 90 days ago{cancelledGifts.length > 0 ? ` · lifespan based on ${cancelledGifts.length} cancelled gift${cancelledGifts.length !== 1 ? 's' : ''} to date` : ''}</div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderTop: `1px dashed ${C.border}`, paddingTop: 14 }}>
                        <div style={s.analyticsSubTitle}>Giving trend</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 10.5, color: C.muted }}>Flag after</span>
                          <select style={{ fontSize: 10.5, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 5px', color: C.forest, background: C.white, fontFamily: 'inherit' }} value={recurringTrendCycles} onChange={async e => { const v = Number(e.target.value); setRecurringTrendCycles(v); const { error } = await supabase.from('charity_contacts').update({ recurring_trend_cycles: v }).eq('charity_uen', charityUen); if (error) showToast('Could not save this setting', 'error') }}>
                            <option value={2}>2 cycles</option>
                            <option value={3}>3 cycles</option>
                          </select>
                        </div>
                      </div>
                      {trendFlagsFiltered.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: C.muted }}>No sustained upgrade or downgrade patterns right now.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {[...upgrades, ...downgrades].slice(0, 5).map((f, i) => (
                            <div key={i} style={{ padding: '8px 10px', background: f.direction === 'upgrade' ? '#EAF3DE' : '#FBEEE9', borderRadius: 4 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <span style={{ fontSize: 12.5, fontWeight: 500, color: f.direction === 'upgrade' ? '#27500A' : '#791F1F' }}>{f.donor_name}</span>
                                <span style={{ fontSize: 11.5, fontWeight: 600, color: f.direction === 'upgrade' ? '#27500A' : '#791F1F' }}>{f.direction === 'upgrade' ? '↑' : '↓'} ${f.from} → ${f.to}</span>
                              </div>
                              <div style={{ fontSize: 11, color: f.direction === 'upgrade' ? '#27500A' : '#791F1F', marginTop: 2 }}>{recurringTrendCycles} consecutive cycles {f.direction === 'upgrade' ? 'increasing' : 'decreasing'}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {(() => {
                  const { missedFiltered, frequentSkippers } = recurringRiskStats

                  return (
                    <div style={s.card}>
                      <div style={s.analyticsCardTitle}>Recurring Gift Risk <InfoTip text="Recurring donors who've missed payments, who frequently use Skip Cycle, and donors giving recurring-shaped manual gifts who aren't yet set up as a formal recurring gift." /></div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={s.analyticsSubTitle}>Missed payments</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 10.5, color: C.muted }}>Flag after</span>
                          <select style={{ fontSize: 10.5, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 5px', color: C.forest, background: C.white, fontFamily: 'inherit' }} value={recurringMissedThreshold} onChange={async e => { const v = Number(e.target.value); setRecurringMissedThreshold(v); const { error } = await supabase.from('charity_contacts').update({ recurring_missed_threshold: v }).eq('charity_uen', charityUen); if (error) showToast('Could not save this setting', 'error') }}>
                            <option value={1}>1 cycle</option>
                            <option value={2}>2 cycles</option>
                            <option value={3}>3 cycles</option>
                          </select>
                        </div>
                      </div>
                      {missedFiltered.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 18 }}>No missed recurring payments right now.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                          {missedFiltered.slice(0, 5).map((g, i) => (
                            <div key={i} style={{ padding: '8px 10px', background: g.missedCycles >= 2 ? '#FBEEE9' : C.warningBg, borderRadius: 4 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <span style={{ fontSize: 12.5, fontWeight: 500, color: g.missedCycles >= 2 ? C.red : C.warning }}>
                                  {g.donor_name}
                                  {g.type && <span style={{ fontSize: 9.5, fontWeight: 500, background: C.white, color: C.muted, padding: '1px 6px', borderRadius: 3, marginLeft: 6, textTransform: 'uppercase' }}>{g.type === 'giro' ? 'GIRO' : 'PayNow'}</span>}
                                </span>
                                <span style={{ fontSize: 11.5, color: g.missedCycles >= 2 ? C.red : C.warning }}>{g.missedCycles} cycle{g.missedCycles !== 1 ? 's' : ''} missed{g.missedCycles >= 2 ? ' — possible cancellation' : ''}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={s.analyticsSubTitleDivider}>Frequent skippers</div>
                      {frequentSkippers.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 18 }}>No donors have skipped 2+ cycles this year.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                          {frequentSkippers.slice(0, 5).map((g, i) => (
                            <div key={i} style={{ padding: '8px 10px', background: C.ivory, borderRadius: 4 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <span style={{ fontSize: 12.5, fontWeight: 500, color: C.forest }}>
                                  {g.donor_name}
                                  {g.type && <span style={{ fontSize: 9.5, fontWeight: 500, background: C.white, color: C.muted, padding: '1px 6px', borderRadius: 3, marginLeft: 6, textTransform: 'uppercase' }}>{g.type === 'giro' ? 'GIRO' : 'PayNow'}</span>}
                                </span>
                                <span style={{ fontSize: 11, color: C.muted }}>{g.skipCount} cycles skipped</span>
                              </div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Still active — using Skip Cycle rather than missing silently</div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={s.analyticsSubTitleDivider}>Looks recurring, not yet tagged</div>
                      {recurringPatternSuggestions.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: C.muted }}>No untagged recurring patterns detected.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                          {recurringPatternSuggestions.slice(0, 5).map((d, i) => (
                            <div key={i} style={{ padding: '8px 10px', background: C.ivory, borderRadius: 4, display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 12.5, fontWeight: 500, color: C.forest }}>{d.name}</span>
                              <span style={{ fontSize: 11, color: C.muted }}>~${d.avgAmount}/mo · every ~{d.avgGapDays}d</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {(missedFiltered.length > 0 || frequentSkippers.length > 0) && (
                        <div style={{ fontSize: 10.5, color: C.muted, borderTop: `1px dashed ${C.border}`, paddingTop: 10 }}>A missed GIRO cycle usually means a bank authorization issue — worth a direct follow-up. A missed PayNow cycle is often just forgetfulness.</div>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>

            <div style={{ position: 'relative', paddingLeft: 24, marginBottom: 40 }}>
              <div style={{ position: 'absolute', left: 0, top: 4, bottom: 4, width: 1, background: C.borderStrong }} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.muted }}>07</span>
                <span style={{ fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: C.forest, fontWeight: 500 }}>Grants Overview</span>
              </div>

              {(() => {
                const { yr, tiles } = grantSnapshotStats
                return (
                  <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: (isMobile || isTablet) ? 'wrap' : 'nowrap' }}>
                    {tiles.map((t, i) => (
                      <div key={i} style={{ ...s.card, flex: 1, minWidth: (isMobile || isTablet) ? '100%' : 0 }}>
                        <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>{t.label} <InfoTip text={t.tip} /></div>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>{t.val}</div>
                        {t.d === undefined ? (
                          <div style={{ fontSize: 11, color: C.muted }}>currently active</div>
                        ) : t.d === null ? (
                          <div style={{ fontSize: 11, color: C.muted }}>new in {yr}</div>
                        ) : (
                          <div style={{ fontSize: 11, fontWeight: 500, color: t.d > 0 ? C.sage : t.d < 0 ? C.red : C.muted }}>
                            {t.d > 0 ? '▲' : t.d < 0 ? '▼' : '–'} {Math.abs(t.d)}% vs {yr - 1}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })()}

              {(() => {
                const { trendData, totalActiveAmount, totalUtilized, utilizationRate, activeGrants, byFunder, topFunderPct, highRisk, medRisk, tooFewFunders, expiringSoon } = grantOverviewStats
                const today = new Date()

                return (
                  <div style={isMobile ? s.threeColMobile : isTablet ? s.threeColTablet : s.threeCol}>
                    {trendData.length >= 2 && (
                      <div style={s.card}>
                        <div style={s.analyticsCardTitle}>Grants Trend <InfoTip text="Total grant funding secured per year, based on the grant's start date. Shows the long-term trajectory of your grant funding, not just this year vs last." /></div>
                        <ResponsiveContainer width="100%" height={120}>
                          <BarChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                            <XAxis dataKey="year" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toLocaleString()}`} />
                            <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(value) => [`$${value.toLocaleString()}`, 'Secured']} />
                            <Bar dataKey="total" fill={C.forest} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                          </BarChart>
                        </ResponsiveContainer>
                        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>Total grant funding secured, by year awarded.</div>
                      </div>
                    )}

                    <div style={s.card}>
                      <div style={s.analyticsCardTitle}>Grant Funding — {filterYear} <InfoTip text="Whether spending on each active grant is keeping pace with its report deadline, plus overall utilization across all active grants. Totals and YoY change are shown in the tiles above." /></div>

                      {utilizationRate !== null && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 10, marginBottom: 10, borderBottom: `1px dashed ${C.border}` }}>
                          <span style={{ fontSize: 10.5, color: C.muted }}>Overall utilization</span>
                          <span style={{ fontFamily: C.fontVoice, fontSize: 16, fontWeight: 500, color: C.forest }}>{utilizationRate}% <span style={{ fontSize: 10, fontWeight: 400, fontFamily: 'inherit', color: C.muted }}>· ${totalUtilized.toLocaleString()} of ${totalActiveAmount.toLocaleString()}</span></span>
                        </div>
                      )}

                      {activeGrants.length === 0 ? (
                        <div style={{ fontSize: 13, color: C.muted }}>No active grants right now.</div>
                      ) : (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 600, color: C.gold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Pace vs report deadline</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {activeGrants.map((g, i) => {
                            const utilized = grantExpenses.filter(e => e.grant_id === g.id).reduce((s, e) => s + Number(e.amount), 0)
                            const pctSpent = g.amount > 0 ? Math.round((utilized / Number(g.amount)) * 100) : 0
                            const start = new Date(g.start_date || g.created_at)
                            const due = g.report_due_date ? new Date(g.report_due_date) : null
                            const daysToReport = due ? Math.ceil((due - today) / (1000 * 60 * 60 * 24)) : null
                            const overdue = daysToReport !== null && daysToReport < 0
                            let pctElapsed = null
                            if (due) {
                              const totalSpan = due - start
                              const elapsed = today - start
                              pctElapsed = totalSpan > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / totalSpan) * 100))) : null
                            }
                            const gap = pctElapsed !== null ? pctElapsed - pctSpent : null
                            const behind = gap !== null && gap >= 20
                            const slightlyBehind = gap !== null && gap >= 8 && gap < 20
                            const bg = overdue || behind ? '#FBEEE9' : slightlyBehind ? '#FDF8EC' : C.ivory
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
                          })}
                          </div>
                        </>
                      )}
                    </div>

                    {(() => {
                      return (
                    <div style={s.card}>
                      <div style={s.analyticsCardTitle}>Grant Funding Concentration <InfoTip text="Share of active grant funding coming from your single largest funder, and which active grants are approaching their final report date within 6 months with no successor lined up." /></div>

                    {tooFewFunders ? (
                      <div style={{ fontSize: 12.5, color: C.muted }}>Too few active funders to assess concentration yet.</div>
                    ) : (
                      <>
                        <div style={{ ...s.analyticsStatNumber, color: highRisk ? C.red : medRisk ? C.gold : C.forest, marginBottom: 4 }}>{topFunderPct}%</div>
                        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>of active grant funding from your single largest funder</div>
                        <div style={{ background: C.ivoryDark, borderRadius: 3, height: 6, overflow: 'hidden', marginBottom: 6 }}>
                          <div style={{ width: `${topFunderPct}%`, height: '100%', background: highRisk ? C.red : medRisk ? C.gold : C.sage, borderRadius: 3 }} />
                        </div>
                        <div style={{ fontSize: 11.5, color: highRisk ? C.red : medRisk ? C.gold : C.sage, fontWeight: 500, marginBottom: 18 }}>
                          {highRisk ? '⚠ High concentration risk' : medRisk ? '⚠ Moderate concentration risk' : '✓ Well diversified'}
                        </div>
                      </>
                    )}

                    {byFunder.length > 0 && (
                      <>
                        <div style={s.analyticsSubTitleDivider}>By funder, active grants only</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                          {byFunder.map((f, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.ivory, borderRadius: 4 }}>
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
                        {expiringSoon.map((g, i) => {
                          const monthsOut = Math.round((new Date(g.report_due_date) - today) / (1000 * 60 * 60 * 24 * 30.44))
                          return (
                            <div key={i} style={{ padding: '10px 12px', background: C.warningBg, borderRadius: 4 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <span style={{ fontSize: 12.5, fontWeight: 500, color: C.forest }}>{g.funder_name}</span>
                                <span style={{ fontSize: 11, color: C.text }}>ends in {monthsOut} mo</span>
                              </div>
                              <div style={{ fontSize: 11, color: C.text, marginTop: 2 }}>No renewal or replacement grant in the pipeline yet</div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                      )
                    })()}
                  </div>
                )
              })()}
            </div>

            <div style={{ position: 'relative', paddingLeft: 24, marginBottom: 40 }}>
              <div style={{ position: 'absolute', left: 0, top: 4, bottom: 4, width: 1, background: C.borderStrong }} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.muted }}>08</span>
                <span style={{ fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: C.forest, fontWeight: 500 }}>Donor Behavior & Retention</span>
              </div>

              {(() => {
                const { yr, repeatDonorRate, avgLTV, retentionRate, activeCount, lapsedCount } = donorRetentionSnapshotStats
                return (
                  <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: (isMobile || isTablet) ? 'wrap' : 'nowrap' }}>
                    <div style={{ ...s.card, flex: 1, minWidth: (isMobile || isTablet) ? '100%' : 0 }}>
                      <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>Retention Rate <InfoTip text={`Share of donors who gave in ${yr - 1} and gave again in ${yr}.`} /></div>
                      <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>{retentionRate !== null ? `${retentionRate}%` : '—'}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>of {yr - 1}'s donors gave again in {yr}</div>
                    </div>
                    <div style={{ ...s.card, flex: 1, minWidth: (isMobile || isTablet) ? '100%' : 0 }}>
                      <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>Repeat Donor Rate <InfoTip text="Share of all-time donors who have given 2 or more times." /></div>
                      <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>{repeatDonorRate}%</div>
                      <div style={{ fontSize: 11, color: C.muted }}>gave 2+ times, all-time</div>
                    </div>
                    <div style={{ ...s.card, flex: 1, minWidth: (isMobile || isTablet) ? '100%' : 0 }}>
                      <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>Avg Lifetime Value <InfoTip text="Average total confirmed giving per donor, across all time." /></div>
                      <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>${avgLTV.toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>per donor, all-time</div>
                    </div>
                    <div style={{ ...s.card, flex: 1, minWidth: (isMobile || isTablet) ? '100%' : 0 }}>
                      <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>Active vs Lapsed <InfoTip text={`Donors who gave in ${yr} vs donors who gave in a prior year but not ${yr}.`} /></div>
                      <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>{activeCount} <span style={{ fontSize: 14, color: C.muted, fontWeight: 400 }}>/ {lapsedCount}</span></div>
                      <div style={{ fontSize: 11, color: C.muted }}>active vs lapsed donors</div>
                    </div>
                  </div>
                )
              })()}

              <div style={{ fontSize: 12, fontWeight: 600, color: C.red, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Needs Attention</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 24, alignItems: 'start' }}>
              {(() => {
                const lapsedToday = new Date()
                const { activeLapsed, dismissedLapsed } = lapsedDonorsStats
                const lapsed = showAllLapsedDonors ? activeLapsed : activeLapsed.slice(0, 5)

                return (
                  <div id="lapsed-donors-card-analytics" style={{ ...s.card, marginBottom: 24, scrollMarginTop: 20 }}>
                    <div style={{ ...s.cardTitle, display: 'flex', alignItems: 'center', gap: 5 }}>Lapsed Donors <InfoTip text="Donors who have given at least this many times but haven't donated in over this many days. Both are adjustable below." /></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11.5, color: C.muted }}>Gave</span>
                      <input type="number" min={1} style={{ width: 40, fontSize: 11.5, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 4px', color: C.forest, textAlign: 'center' }} value={lapsedMinGifts} onChange={e => { const v = Math.max(1, Number(e.target.value) || 1); setLapsedMinGifts(v); supabase.from('charity_contacts').update({ lapsed_min_gifts: v }).eq('charity_uen', charityUen) }} />
                      <span style={{ fontSize: 11.5, color: C.muted }}>+ times but haven't donated in</span>
                      <input type="number" min={1} style={{ width: 48, fontSize: 11.5, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 4px', color: C.forest, textAlign: 'center' }} value={lapsedMinDays} onChange={e => { const v = Math.max(1, Number(e.target.value) || 1); setLapsedMinDays(v); supabase.from('charity_contacts').update({ lapsed_min_days: v }).eq('charity_uen', charityUen) }} />
                      <span style={{ fontSize: 11.5, color: C.muted }}>+ days</span>
                    </div>
                    {lapsed.length === 0 && <div style={{ fontSize: 13, color: C.sage, fontStyle: 'italic' }}>✓ No lapsed donors right now</div>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {lapsed.map((d, i) => {
                        const daysSince = Math.floor((lapsedToday - new Date(d.lastDate)) / (1000 * 60 * 60 * 24))
                        const donorKey = d.email?.trim() || d.name
                        const reminderCount = (lapsedReminderHistory[donorKey] || []).length
                        return (
                          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', background: C.ivory, borderRadius: 4, border: `1px solid ${C.border}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer' }} onClick={() => { setSelectedDonor({ ...d, receipts: d.count }); setActiveTab('donors') }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12.5, fontWeight: 500, color: C.forest }}>{d.name}</div>
                                <div style={{ fontSize: 10.5, color: C.muted }}>${d.total.toLocaleString()} lifetime</div>
                              </div>
                              <span style={{ fontFamily: C.fontMono, fontSize: 13, fontWeight: 500, color: C.gold, flexShrink: 0 }}>{daysSince}d ago</span>
                            </div>
                            {reminderCount > 0 && (
                              <div style={{ fontSize: 10.5, color: C.gold, fontWeight: 500 }}>
                                ✉ Last reached out {Math.floor((new Date() - new Date(lapsedReminderHistory[donorKey][0].sent_at)) / (1000 * 60 * 60 * 24))}d ago · {reminderCount}× sent
                              </div>
                            )}
                            {(() => {
                              const isDeepRelationship74 = d.count >= 5 || d.total >= (thankYouThreshold || 500)
                              const isRecent74 = daysSince <= 60
                              const suggestion74 = isDeepRelationship74 && isRecent74
                                ? { icon: '📞', text: 'Suggested: a personal call — this is a longtime supporter' }
                                : isDeepRelationship74
                                ? { icon: '✉️', text: 'Suggested: a personal note — they\'ve been with you a while' }
                                : { icon: '📢', text: 'Suggested: include in your next mass appeal' }
                              return (
                                <div style={{ fontSize: 10.5, color: C.forest, background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 8px' }}>
                                  {suggestion74.icon} {suggestion74.text}
                                </div>
                              )
                            })()}
                          </div>
                        )
                      })}
                    </div>
                    {activeLapsed.length > 5 && (
                      <button style={{ fontSize: 11, color: C.muted, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, marginTop: 8, marginBottom: 8, display: 'block' }} onClick={() => setShowAllLapsedDonors(v => !v)}>
                        {showAllLapsedDonors ? 'Show fewer' : `Show all ${activeLapsed.length}`}
                      </button>
                    )}
                    {dismissedLapsed.length > 0 && (
                      <div>
                        <button style={{ fontSize: 11, color: C.muted, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }} onClick={() => setShowDismissedLapsedDonors(v => !v)}>
                          {showDismissedLapsedDonors ? 'Hide' : 'Show'} {dismissedLapsed.length} dismissed donor{dismissedLapsed.length !== 1 ? 's' : ''}
                        </button>
                        {showDismissedLapsedDonors && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                            {dismissedLapsed.map((d, i) => {
                              const donorKey = d.email?.trim() || d.name
                              return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: C.ivory, borderRadius: 4, border: `1px solid ${C.border}` }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 500, color: C.muted }}>{d.name}</div>
                                    {lapsedDismissals[donorKey]?.reason && <div style={{ fontSize: 10.5, color: C.muted, fontStyle: 'italic' }}>"{lapsedDismissals[donorKey].reason}"</div>}
                                  </div>
                                  <button style={{ ...s.viewBtn, fontSize: 10.5, padding: '3px 8px', flexShrink: 0 }} onClick={() => undismissLapsedDonor(donorKey)}>↺ Restore</button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}

              {(() => {
                const quiet = quietDonorsStats
                return (
                  <div style={{ ...s.card, marginBottom: 24 }}>
                    <div style={s.cardTitle}>🤫 Quiet Donors</div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Used to give regularly, but their gap since the last gift is more than double their usual rhythm — worth checking in before they fully lapse.</div>
                    {quiet.length === 0 ? (
                      <div style={{ fontSize: 13, color: C.muted, padding: '8px 0' }}>No donors showing a slowdown right now.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {quiet.map((d, i) => (
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
                )
              })()}

              {(() => {
                const quietlyPaying75 = quietlyPayingStats
                return (
                  <div style={{ ...s.card, marginBottom: 24 }}>
                    <div style={s.cardTitle}>Quietly Paying Donors</div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Still giving on schedule, but no personal contact logged in over a year — the relationship may be going cold even though the payments aren't.</div>
                    {quietlyPaying75.length === 0 ? (
                      <div style={{ fontSize: 13, color: C.muted, padding: '8px 0' }}>No quietly-paying donors right now — nice work staying in touch.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {quietlyPaying75.map((d, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: C.ivory, borderRadius: 10, border: `1px solid ${C.border}` }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.forest, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{d.name?.charAt(0)}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: C.forest }}>{d.name}</div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>${d.amount}/{d.frequency} · {d.lastContact ? `last contact ${Math.floor((new Date() - new Date(d.lastContact)) / (1000 * 60 * 60 * 24 * 30))}mo ago` : 'no contact ever logged'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

              {(() => {
                const allFlags = allGivingChangeFlags
                const flags = showAllGivingChanges ? allFlags : allFlags.slice(0, 5)
                return (
                  <div id="giving-changes-card-analytics" style={{ ...s.card, marginBottom: 24, scrollMarginTop: 20 }}>
                    <div style={{ ...s.cardTitle, display: 'flex', alignItems: 'center', gap: 5 }}>Giving Changes <InfoTip text="Donors whose most recent gift differs from their historical average by at least this percentage, based on this many or more prior gifts. Both are adjustable below." /></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11.5, color: C.muted }}>Donors with</span>
                      <input type="number" min={2} style={{ width: 40, fontSize: 11.5, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 4px', color: C.forest, textAlign: 'center' }} value={givingChangeMinGifts} onChange={e => { const v = Math.max(2, Number(e.target.value) || 2); setGivingChangeMinGifts(v); supabase.from('charity_contacts').update({ giving_change_min_gifts: v }).eq('charity_uen', charityUen) }} />
                      <span style={{ fontSize: 11.5, color: C.muted }}>+ gifts, changed by</span>
                      <input type="number" min={1} style={{ width: 44, fontSize: 11.5, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 4px', color: C.forest, textAlign: 'center' }} value={givingChangeMinPct} onChange={e => { const v = Math.max(1, Number(e.target.value) || 1); setGivingChangeMinPct(v); supabase.from('charity_contacts').update({ giving_change_min_pct: v }).eq('charity_uen', charityUen) }} />
                      <span style={{ fontSize: 11.5, color: C.muted }}>%+</span>
                    </div>
                    {flags.length === 0 ? (
                      <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No significant changes detected yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                        {flags.map((f, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: f.changePct < 0 ? '#FBEEE9' : '#EAF3EC', borderRadius: 4, cursor: 'pointer' }} onClick={() => { setSelectedDonor({ name: f.name, email: f.email, total: f.recent, count: givingChangeMinGifts, receipts: 0 }); setActiveTab('donors') }}>
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
                )
              })()}
              </div>

              <div style={{ fontSize: 12, fontWeight: 600, color: C.sage, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Recognition & Stewardship</div>
              {(() => {
                const cards = donorHighlightsStats
                if (cards.length === 0) return null

                return (
                  <div style={{ ...s.card, marginBottom: 24 }}>
                    <div style={s.cardTitle}>🌟 Donor Highlights — {filterYear}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Standout supporters worth a personal thank-you.</div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${cards.length}, 1fr)`, gap: 12 }}>
                      {cards.map((c, i) => (
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
                )
              })()}
              {(() => {
                const streaks = givingStreaksStats
                return (
                  <div style={{ ...s.card, marginBottom: 24 }}>
                    <div style={s.cardTitle}>🔥 Giving Streaks</div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Donors who've given in 3 or more consecutive months — your most dependable supporters, regardless of gift size.</div>
                    {streaks.length === 0 ? (
                      <div style={{ fontSize: 13, color: C.muted, padding: '8px 0' }}>No active streaks of 3+ months yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {streaks.map((d, i) => (
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
              {(() => {
                const owedDonations = donations.filter(d => d.payment_status === 'confirmed' && d.receipt_issued && d.donor_email?.trim() && !d.thank_you_sent)
                const owedTotal = owedDonations.reduce((s, d) => s + d.amount, 0)
                if (owedDonations.length === 0) return null
                return (
                  <div style={{ ...s.card, marginBottom: 24, background: C.warningBg, border: `1px solid ${C.warningBorder}` }}>
                    <div style={s.cardTitle}>💌 Silent Thank-You Debt</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.warning, marginBottom: 4 }}>${owedTotal.toLocaleString()}</div>
                    <div style={{ fontSize: 13, color: C.warning }}>in donations from {owedDonations.length} donor{owedDonations.length > 1 ? 's' : ''} have never received a thank-you — that's real generosity sitting unacknowledged.</div>
                    <button style={{ ...s.viewBtn, marginTop: 10 }} onClick={() => { clearDonationFilters({ keepYear: false }); setFilterThankYou('Not Sent'); setActiveTab('donations') }}>Review and thank them →</button>
                  </div>
                )
              })()}
              {donorLTVStats && (() => {
                const { sorted, avgLTV, avgGifts, under1yr59, oneToTwo59, twoPlus59, avgOf59 } = donorLTVStats
                return (
                  <div style={{ ...s.card, marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div style={{ ...s.cardTitle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 5 }}>Donor Lifetime Value <InfoTip text="Total giving per donor across all time. Shows your average and top donors by cumulative amount given." /></div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10.5, color: C.muted }}>Avg LTV</div>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 17, fontWeight: 500, color: C.forest }}>${avgLTV.toLocaleString()}</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 14 }}>
                      <div style={{ background: C.ivory, borderRadius: 4, padding: '9px 12px', border: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 10.5, color: C.muted }}>Avg gifts per donor</div>
                        <div style={{ fontFamily: C.fontMono, fontSize: 16, fontWeight: 500, color: C.forest }}>{avgGifts}</div>
                      </div>
                      <div style={{ background: C.ivory, borderRadius: 4, padding: '9px 12px', border: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 10.5, color: C.muted }}>Top donor LTV</div>
                        <div style={{ fontFamily: C.fontMono, fontSize: 16, fontWeight: 500, color: C.forest }}>${sorted[0]?.total.toLocaleString() || 0}</div>
                      </div>
                    </div>
                    <div style={{ background: C.ivory, borderRadius: 4, padding: '10px 12px', border: `1px solid ${C.border}`, marginBottom: 14 }}>
                      <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 6 }}>Average lifetime value by tenure</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.muted }}>Under 1 year ({under1yr59.length})</span><span style={{ fontWeight: 500, color: C.forest }}>{avgOf59(under1yr59) !== null ? `$${avgOf59(under1yr59).toLocaleString()}` : '—'}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.muted }}>1–2 years ({oneToTwo59.length})</span><span style={{ fontWeight: 500, color: C.forest }}>{avgOf59(oneToTwo59) !== null ? `$${avgOf59(oneToTwo59).toLocaleString()}` : '—'}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.muted }}>2+ years ({twoPlus59.length})</span><span style={{ fontWeight: 500, color: C.sage }}>{avgOf59(twoPlus59) !== null ? `$${avgOf59(twoPlus59).toLocaleString()}` : '—'}</span></div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {sorted.slice(0, 5).map((d, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: C.ivory, borderRadius: 4 }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: [C.forest, C.sage, C.gold, C.borderStrong, C.muted][i], color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 500, fontFamily: C.fontVoice, flexShrink: 0 }}>{i + 1}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 500, color: C.forest }}>{d.name}</div>
                            <div style={{ fontSize: 10.5, color: C.muted }}>{d.count} gift{d.count !== 1 ? 's' : ''} since {new Date(d.firstDate).getFullYear()}</div>
                          </div>
                          <div style={{ fontFamily: C.fontMono, fontSize: 13, fontWeight: 500, color: C.forest, flexShrink: 0 }}>${d.total.toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              <div style={{ fontSize: 12, fontWeight: 600, color: C.teal, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Donor Composition & Sources</div>
              <div style={{ ...s.card, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ ...s.cardTitle, marginBottom: 0 }}>🏆 Top Donors</div>
                  <div style={{ fontSize: 12, color: C.sage, fontWeight: 500, cursor: 'pointer' }} onClick={() => setActiveTab('donors')}>View all →</div>
                </div>
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

              {paymentMixStats && (() => {
                const { rows, allYears61, allMethods61, yearlyMix61 } = paymentMixStats
                const colors = [C.sage, C.gold, C.teal, C.warning, C.red, C.muted]

                return (
                  <div style={{ ...s.card, marginBottom: 24 }}>
                    <div style={s.cardTitle}>💳 How Donors Are Paying — {filterYear}</div>
                    <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 10, marginBottom: 14 }}>
                      {rows.map((r, i) => <div key={i} style={{ width: `${r.pct}%`, background: colors[i % colors.length] }} />)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: allYears61.length > 1 ? 18 : 0 }}>
                      {rows.map((r, i) => (
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
                        {allMethods61.map((method, mi) => {
                          const series = yearlyMix61.map(y => y.total > 0 ? Math.round((y.mix[method] / y.total) * 100) : 0)
                          const firstPct = series[0]
                          const lastPct = series[series.length - 1]
                          const delta = lastPct - firstPct
                          return (
                            <div key={mi} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <span style={{ fontSize: 12, color: C.text, width: 100, flexShrink: 0 }}>{method}</span>
                              <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                                {yearlyMix61.map((y, yi) => (
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
                )
              })()}

              {(() => {
                const { sorted, grandTotal, concentrationPct, tooFewDonors, highRisk, medRisk, topDonorNames, concentrationTrend } = fundingConcentrationStats

                return (
                  <div style={{ ...s.card, marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ ...s.cardTitle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 5 }}>⚖️ Funding Concentration <InfoTip text="Share of total revenue coming from your top N donors, where N is selectable. High concentration means your income depends heavily on a small number of people." /></div>
                      <select style={{ fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 6px', color: C.forest, background: C.white, fontFamily: 'inherit' }} value={concentrationTopN} onChange={e => { const v = Number(e.target.value); setConcentrationTopN(v); supabase.from('charity_contacts').update({ concentration_top_n: v }).eq('charity_uen', charityUen) }}>
                        <option value={5}>Top 5</option>
                        <option value={10}>Top 10</option>
                        <option value={20}>Top 20</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <div style={{ fontFamily: C.fontVoice, fontSize: 34, fontWeight: 500, color: highRisk ? C.red : medRisk ? C.gold : C.forest, marginBottom: 2, lineHeight: 1 }}>{concentrationPct}%</div>
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
                    {sorted.slice(0, showAllConcentrationDonors ? 10 : 5).map((d, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: C.ivory, borderRadius: 4, cursor: 'pointer' }} onClick={() => { setSelectedDonor({ name: d.name, email: d.email, total: d.total, count: d.gifts.length, receipts: d.gifts.length }); setActiveTab('donors') }}>
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
                    <button style={{ ...s.viewBtn, fontSize: 11.5, padding: '6px 12px', width: '100%', justifyContent: 'center' }} onClick={() => { setFilterTopDonorNames(topDonorNames); setActiveTab('donors') }}>View Top Donors →</button>
                  </div>
                )
              })()}

              {(() => {
                const rows78 = topConnectorsStats
                if (rows78.length === 0) return (
                  <div style={{ ...s.card, marginBottom: 24 }}>
                    <div style={s.cardTitle}>Top Connectors</div>
                    <div style={{ fontSize: 13, color: C.muted }}>No referrals recorded yet — capture them when logging a new manual donor.</div>
                  </div>
                )
                return (
                  <div style={{ ...s.card, marginBottom: 24 }}>
                    <div style={s.cardTitle}>Top Connectors</div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Donors whose referrals led to real, ongoing giving — worth a personal thank-you.</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {rows78.slice(0, 8).map((r, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, borderRadius: 6, padding: '8px 12px', border: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 13, color: C.forest, fontWeight: 500 }}>{r.name}</span>
                          <span style={{ fontSize: 12, color: C.muted }}>{r.referredCount} referred · {r.sustainedCount} became repeat givers</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {(() => {
                const rows57 = acquisitionSourceStats
                if (rows57.length === 0) return (
                  <div style={{ ...s.card, marginBottom: 24 }}>
                    <div style={s.cardTitle}>Donor Acquisition Sources</div>
                    <div style={{ fontSize: 13, color: C.muted }}>No acquisition source data yet — start selecting a source when logging new manual donors.</div>
                  </div>
                )
                return (
                  <div style={{ ...s.card, marginBottom: 24 }}>
                    <div style={s.cardTitle}>Donor Acquisition Sources</div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Which channels bring in donors who come back and give again.</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {rows57.map((r, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, borderRadius: 6, padding: '8px 12px', border: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 13, color: C.forest, fontWeight: 500 }}>{r.source}</span>
                          <span style={{ fontSize: 12, color: C.muted }}>{r.totalDonors} donor{r.totalDonors !== 1 ? 's' : ''} · {r.repeatPct}% became repeat givers</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              <div style={{ ...s.card, marginBottom: 0 }}>
                <div style={s.cardTitle}>💰 Donation Size Breakdown</div>
                <div style={{ display: 'grid', gridTemplateColumns: (isMobile || isTablet) ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: isMobile ? 10 : 12 }}>
                  {donationSizeBreakdownStats.map((bucket, i) => (
                      <div key={i} style={{ background: C.ivory, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 11, color: C.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{bucket.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: bucket.color, marginBottom: 4 }}>{bucket.count}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>{bucket.pct}% of donations · ${bucket.total.toLocaleString()}</div>
                        <div style={{ background: C.border, borderRadius: 6, height: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${bucket.pct}%`, height: '100%', background: bucket.color, borderRadius: 6 }} />
                        </div>
                      </div>
                  ))}
                </div>
              </div>
              </div>

            <div style={{ position: 'relative', paddingLeft: 24, marginBottom: 40 }}>
              <div style={{ position: 'absolute', left: 0, top: 4, bottom: 4, width: 1, background: C.borderStrong }} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.muted }}>09</span>
                <span style={{ fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: C.forest, fontWeight: 500 }}>Forecasting and composition</span>
              </div>

              {(() => {
                const now79 = new Date()
                const currentMonth79 = now79.getMonth()
                const years79 = [...new Set(confirmedDonations.map(d => new Date(d.created_at).getFullYear()))].filter(y => y < now79.getFullYear() || (y === now79.getFullYear() && false))
                const historicalMonthTotals79 = years79.map(y => confirmedDonations.filter(d => { const dt = new Date(d.created_at); return dt.getFullYear() === y && dt.getMonth() === currentMonth79 }).reduce((s, d) => s + d.amount, 0)).filter(t => t > 0)

                if (historicalMonthTotals79.length === 0) return (
                  <div style={{ ...s.card, marginBottom: 24 }}>
                    <div style={s.cardTitle}>Monthly Forecast</div>
                    <div style={{ fontSize: 13, color: C.muted }}>Needs at least one prior year of data for this month to build a forecast.</div>
                  </div>
                )

                const avgHistorical79 = historicalMonthTotals79.reduce((s, t) => s + t, 0) / historicalMonthTotals79.length
                const lowRange79 = Math.round(avgHistorical79 * 0.85)
                const highRange79 = Math.round(avgHistorical79 * 1.15)

                const activeRecurring79 = recurringGifts.filter(g => g.status === 'active')
                const confirmedRecurringThisMonth79 = activeRecurring79.reduce((s, g) => {
                  const amt = Number(g.amount) || 0
                  if (g.frequency === 'weekly') return s + amt * 4.33
                  if (g.frequency === 'quarterly') return s + amt / 3
                  if (g.frequency === 'yearly' || g.frequency === 'annual') return s + amt / 12
                  return s + amt
                }, 0)

                const neededLow79 = Math.max(0, Math.round(lowRange79 - confirmedRecurringThisMonth79))
                const neededHigh79 = Math.max(0, Math.round(highRange79 - confirmedRecurringThisMonth79))
                const monthName79 = now79.toLocaleDateString('en-SG', { month: 'long' })

                return (
                  <div style={{ ...s.card, marginBottom: 24 }}>
                    <div style={s.cardTitle}>Monthly Forecast</div>
                    <div style={{ fontSize: 13, color: C.forest, marginBottom: 10, lineHeight: 1.6 }}>
                      You typically receive <strong>${lowRange79.toLocaleString()}–${highRange79.toLocaleString()}</strong> in {monthName79}.
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: C.muted }}>Confirmed recurring covers</span>
                        <span style={{ fontWeight: 500, color: C.forest }}>${Math.round(confirmedRecurringThisMonth79).toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: C.muted }}>You'd need from one-off gifts</span>
                        <span style={{ fontWeight: 500, color: C.forest }}>${neededLow79.toLocaleString()}–${neededHigh79.toLocaleString()}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>Based on {historicalMonthTotals79.length} prior year{historicalMonthTotals79.length !== 1 ? 's' : ''} of {monthName79} data.</div>
                  </div>
                )
              })()}

              {(() => {
                const monthNames58 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                const years58 = [...new Set(confirmedDonations.map(d => new Date(d.created_at).getFullYear()))]
                if (years58.length < 2) return (
                  <div style={{ ...s.card, marginBottom: 24 }}>
                    <div style={s.cardTitle}>Seasonality Trend</div>
                    <div style={{ fontSize: 13, color: C.muted }}>Needs at least 2 years of data to spot a repeating pattern — check back once you have more history.</div>
                  </div>
                )
                const byMonth58 = monthNames58.map((name, i) => {
                  const totalsAcrossYears = years58.map(y => confirmedDonations.filter(d => { const dt = new Date(d.created_at); return dt.getFullYear() === y && dt.getMonth() === i }).reduce((s, d) => s + d.amount, 0))
                  const nonZeroTotals = totalsAcrossYears.filter(t => t > 0)
                  const avg = nonZeroTotals.length > 0 ? totalsAcrossYears.reduce((s, t) => s + t, 0) / years58.length : 0
                  return { name, avg }
                })
                const overallAvg58 = byMonth58.reduce((s, m) => s + m.avg, 0) / 12
                const maxAvg58 = Math.max(...byMonth58.map(m => m.avg), 1)
                return (
                  <div style={{ ...s.card, marginBottom: 24 }}>
                    <div style={s.cardTitle}>Seasonality Trend</div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Average revenue per calendar month across {years58.length} years — use this to time your appeals.</div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 100, marginBottom: 8 }}>
                      {byMonth58.map((m, i) => (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: '100%', height: `${Math.max(4, (m.avg / maxAvg58) * 90)}px`, background: m.avg >= overallAvg58 * 1.15 ? C.sage : m.avg <= overallAvg58 * 0.7 ? C.red : C.borderStrong, borderRadius: 2 }} />
                          <span style={{ fontSize: 9, color: C.muted }}>{m.name}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 14, fontSize: 11, color: C.muted }}>
                      <span><span style={{ display: 'inline-block', width: 8, height: 8, background: C.sage, borderRadius: 2, marginRight: 4 }} />Strong month</span>
                      <span><span style={{ display: 'inline-block', width: 8, height: 8, background: C.red, borderRadius: 2, marginRight: 4 }} />Weak month</span>
                    </div>
                  </div>
                )
              })()}

              {(() => {
                const categoryLabels62 = { unknown: 'Unknown', financial_difficulty: 'Financial difficulty', moved_overseas: 'Moved overseas', switched_cause: 'Switched to another cause', deceased: 'Deceased', asked_to_stop: 'Asked to stop', other: 'Other' }
                const dismissalsList62 = Object.values(lapsedDismissals).filter(d => d.reason_category)
                if (dismissalsList62.length === 0) return (
                  <div style={{ ...s.card, marginBottom: 24 }}>
                    <div style={s.cardTitle}>Why Donors Lapse</div>
                    <div style={{ fontSize: 13, color: C.muted }}>No lapsed donors marked with a reason yet.</div>
                  </div>
                )
                const counts62 = {}
                dismissalsList62.forEach(d => { counts62[d.reason_category] = (counts62[d.reason_category] || 0) + 1 })
                const rows62 = Object.entries(counts62).map(([cat, count]) => ({ label: categoryLabels62[cat] || cat, count })).sort((a, b) => b.count - a.count)
                return (
                  <div style={{ ...s.card, marginBottom: 24 }}>
                    <div style={s.cardTitle}>Why Donors Lapse</div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Based on {dismissalsList62.length} donor{dismissalsList62.length !== 1 ? 's' : ''} marked not interested.</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {rows62.map((r, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, borderRadius: 6, padding: '8px 12px', border: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 13, color: C.forest }}>{r.label}</span>
                          <span style={{ fontSize: 12, color: C.muted }}>{r.count} donor{r.count !== 1 ? 's' : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {(() => {
                const now5 = new Date()
                const threeMoAgo = new Date(now5.getFullYear(), now5.getMonth() - 3, now5.getDate())
                const recentTotal = donations.filter(d => d.payment_status === 'confirmed' && new Date(d.created_at) >= threeMoAgo).reduce((s, d) => s + d.amount, 0)
                const trailingAvgMonthly = recentTotal / 3
                const runwayMonths = monthlyExpenses > 0 ? (trailingAvgMonthly / monthlyExpenses) : null
                return (
                  <div style={{ ...s.card, marginBottom: 24 }}>
                    <div style={{ ...s.cardTitle, display: 'flex', alignItems: 'center', gap: 5 }}>🛢️ Cash Runway <InfoTip text="Based on your average monthly donations over the last 3 months, how many months of expenses that pace would cover — not your actual bank balance." /></div>
                    {runwayMonths === null ? (
                      <div>
                        <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>Set your monthly expenses in Settings to see this.</div>
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px' }} onClick={() => { setActiveTab('settings'); setTimeout(() => document.getElementById('monthly-expenses-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50) }}>Set expenses →</button>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 30, fontWeight: 500, color: runwayMonths >= 3 ? C.forest : C.red, lineHeight: 1 }}>{runwayMonths.toFixed(1)} months</div>
                        <div style={{ fontSize: 11.5, color: runwayMonths >= 3 ? C.sage : C.red, marginTop: 8, fontWeight: 500 }}>
                          {runwayMonths >= 3 ? '✓ Healthy pace' : '⚠ Below 3 months — worth a closer look'}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Avg ${Math.round(trailingAvgMonthly).toLocaleString()}/month over last 3 months · expenses ${monthlyExpenses.toLocaleString()}/month</div>
                      </>
                    )}
                  </div>
                )
              })()}

              {(() => {
                const withTiming = donations.filter(d => d.receipt_issued && d.receipt_issued_at && d.created_at)
                if (withTiming.length === 0) {
                  return (
                    <div style={{ ...s.card, marginBottom: 24 }}>
                      <div style={s.cardTitle}>Gift Acknowledgment Timing</div>
                      <div style={{ fontSize: 13, color: C.muted }}>No timing data yet — this builds up as new receipts are issued.</div>
                    </div>
                  )
                }
                const diffsHours = withTiming.map(d => (new Date(d.receipt_issued_at) - new Date(d.created_at)) / (1000 * 60 * 60))
                const avgHours = diffsHours.reduce((s, h) => s + h, 0) / diffsHours.length
                const avgDays = avgHours / 24
                const overSla = avgHours > 48
                return (
                  <div style={{ ...s.card, marginBottom: 24 }}>
                    <div style={s.cardTitle}>Gift Acknowledgment Timing</div>
                    <div style={{ fontFamily: C.fontVoice, fontSize: 30, fontWeight: 500, color: overSla ? C.red : C.forest, lineHeight: 1, marginBottom: 8 }}>{avgDays.toFixed(1)} days</div>
                    <div style={{ fontSize: 12.5, color: overSla ? C.red : C.sage, fontWeight: 500 }}>
                      {overSla ? `⚠ Averaging above the 48-hour target` : `✓ Within the 48-hour target`}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Based on {withTiming.length} receipt{withTiming.length !== 1 ? 's' : ''} with timing data</div>
                  </div>
                )
              })()}

              {(() => {
                const now11 = new Date()
                if (now11.getMonth() < 9) {
                  return (
                    <div style={{ ...s.card, marginBottom: 24 }}>
                      <div style={s.cardTitle}>Year-End Projection</div>
                      <div style={{ fontSize: 13, color: C.muted }}>This projection becomes available from October, once there's enough of the year to extrapolate from.</div>
                    </div>
                  )
                }
                const yearStart11 = new Date(now11.getFullYear(), 0, 1)
                const daysElapsed = Math.max(1, Math.ceil((now11 - yearStart11) / (1000 * 60 * 60 * 24)))
                const ytdTotal = confirmedDonations.filter(d => new Date(d.created_at) >= yearStart11).reduce((s, d) => s + d.amount, 0)
                const projectedTotal = Math.round((ytdTotal / daysElapsed) * 365)
                const lastYearStart11 = new Date(now11.getFullYear() - 1, 0, 1)
                const lastYearEnd11 = new Date(now11.getFullYear(), 0, 1)
                const lastYearTotal = confirmedDonations.filter(d => new Date(d.created_at) >= lastYearStart11 && new Date(d.created_at) < lastYearEnd11).reduce((s, d) => s + d.amount, 0)
                const trendPct = lastYearTotal > 0 ? Math.round(((projectedTotal - lastYearTotal) / lastYearTotal) * 100) : null
                return (
                  <div style={{ ...s.card, marginBottom: 24 }}>
                    <div style={s.cardTitle}>Year-End Projection</div>
                    <div style={{ fontFamily: C.fontVoice, fontSize: 30, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 8 }}>${projectedTotal.toLocaleString()}</div>
                    <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>Based on your pace so far, that's where {now11.getFullYear()} is likely to land.</div>
                    {lastYearTotal > 0 ? (
                      <div style={{ fontSize: 12.5, color: trendPct >= 0 ? C.sage : C.red, fontWeight: 500 }}>
                        {trendPct >= 0 ? '↑' : '↓'} {Math.abs(trendPct)}% vs {now11.getFullYear() - 1}'s ${lastYearTotal.toLocaleString()}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: C.muted }}>No data from {now11.getFullYear() - 1} to compare against.</div>
                    )}
                  </div>
                )
              })()}

              {(() => {
                const activeRecurring6 = recurringGifts.filter(g => g.status === 'active')
                const monthlyize6 = (g) => {
                  const amt = Number(g.amount) || 0
                  if (g.frequency === 'weekly') return amt * 4.33
                  if (g.frequency === 'quarterly') return amt / 3
                  if (g.frequency === 'yearly' || g.frequency === 'annual') return amt / 12
                  return amt
                }
                const giroMonthly6 = activeRecurring6.filter(g => g.type === 'giro').reduce((s, g) => s + monthlyize6(g), 0)
                const habitualMonthly6 = activeRecurring6.filter(g => g.type === 'habitual_paynow').reduce((s, g) => s + monthlyize6(g), 0)
                const otherMonthly6 = activeRecurring6.filter(g => g.type !== 'giro' && g.type !== 'habitual_paynow').reduce((s, g) => s + monthlyize6(g), 0)
                const totalMonthly6 = giroMonthly6 + habitualMonthly6 + otherMonthly6
                return (
                  <div style={{ ...s.card, marginBottom: 24 }}>
                    <div style={s.cardTitle}>Monthly Recurring Revenue</div>
                    <div style={{ fontFamily: C.fontVoice, fontSize: 30, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 4 }}>${Math.round(totalMonthly6).toLocaleString()}</div>
                    <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 14 }}>per month, from {activeRecurring6.length} active recurring gift{activeRecurring6.length !== 1 ? 's' : ''} — separate from one-off donations</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: C.forest }}>GIRO (confirmed)</span>
                        <span style={{ fontWeight: 500, color: C.forest }}>${Math.round(giroMonthly6).toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: C.forest }}>Habitual PayNow (expected)</span>
                        <span style={{ fontWeight: 500, color: C.forest }}>${Math.round(habitualMonthly6).toLocaleString()}</span>
                      </div>
                      {otherMonthly6 > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: C.muted }}>Other (standing order, etc.)</span>
                          <span style={{ fontWeight: 500, color: C.muted }}>${Math.round(otherMonthly6).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>

          </div>
        )}

        {/* ── IRAS ── */}
        {activeTab === 'iras' && charityIsIpc && (
          <div style={s.content}>
            <div style={s.pageHeader}>
              <div>
                <div style={s.pageTitle}>🏛️ IRAS Export</div>
                <div style={s.pageSub}>{filterYear === 'All' ? 'Select a year to see submission deadline' : `Year of Assessment ${parseInt(filterYear) + 1} · Due 31 January ${parseInt(filterYear) + 1}`}</div>
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '8px 16px', borderRadius: 20, background: C.forest, border: 'none' }}>
                <select style={{ background: 'transparent', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', outline: 'none', appearance: 'none', WebkitAppearance: 'none', paddingRight: 18 }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                  {[...new Set(donations.map(d => new Date(d.created_at).getFullYear()))].sort((a,b) => b-a).map(y => <option key={y} style={{ background: C.forest, color: 'white' }}>{y}</option>)}
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
                const yearDons = filterYear === 'All' ? [] : donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear))
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
                    {[...new Set(donations.map(d => new Date(d.created_at).getFullYear()))].sort((a,b) => b-a).map(y => <option key={y}>{y}</option>)}
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
                    const nric = d.donations.find(x => x.donor_nric)?.donor_nric
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
                                      {tags.slice(0, 3).map(t => (
                                        <span key={t.id} style={{ fontSize: 10, fontWeight: 500, color: C.teal, background: '#E8F0EE', padding: '2px 7px', borderRadius: 20 }}>{t.tag}</span>
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
                              const nric = d.donations.find(x => x.donor_nric)?.donor_nric
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
                <div style={s.pageSub}>Live activity feed — all actions by your team, most recent first. Export from Reports.</div>
              </div>
            </div>


            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
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
            </div>
            <div style={s.tableCard}>
              <div style={s.tableHeader}>
                <div style={s.tableTitle}>Recent Activity</div>
                <div style={s.tableCount}>{auditLog.filter(entry => {
                  const matchAction = auditActionFilter === 'All' || entry.action === auditActionFilter
                  const matchDate = auditDateFilter === 'All' || (Date.now() - new Date(entry.created_at).getTime()) < parseInt(auditDateFilter) * 24 * 60 * 60 * 1000
                  return matchAction && matchDate
                }).length} entries</div>
              </div>
              {auditLoading ? <div style={s.empty}>Loading...</div> : auditLog.length === 0 ? <div style={s.empty}>No activity recorded yet.</div> : (
                <div>
                  {auditLog.filter(entry => {
                    const matchAction = auditActionFilter === 'All' || entry.action === auditActionFilter
                    const matchDate = auditDateFilter === 'All' || (Date.now() - new Date(entry.created_at).getTime()) < parseInt(auditDateFilter) * 24 * 60 * 60 * 1000
                    return matchAction && matchDate
                  }).map(entry => {
                    const actionLabels = {
                      cause_deleted: { label: 'Campaign/banner deleted', icon: '🗑️', color: C.red },
                      cause_submitted: { label: 'Campaign submitted for approval', icon: '🎯', color: C.gold },
                      cause_edited: { label: 'Campaign edited', icon: '✏️', color: C.gold },
                      cause_revision_requested: { label: 'Campaign sent back for revision', icon: '↩️', color: C.gold },
                      sponsored_requested: { label: 'Sponsored banner requested', icon: '⭐', color: C.gold },
                      donation_cancelled: { label: 'Donation cancelled by donor', icon: '✕', color: C.red },
                      donation_edited: { label: 'Donation edited', icon: '✏️', color: C.gold },
                      receipt_issued: { label: 'Receipt issued', icon: '🧾', color: C.sage },
                      manual_entry_deleted: { label: 'Manual entry deleted', icon: '🗑️', color: C.red },
                      manual_entry_created: { label: 'Manual entry added', icon: '➕', color: C.sage },
                      nric_added: { label: 'NRIC added', icon: '🪪', color: C.sage },
                      donation_created: { label: 'New donation received', icon: '💳', color: C.sage },
                      payment_confirmed: { label: 'Payment confirmed', icon: '✓', color: C.sage },
                      payment_confirmation_undone: { label: 'Payment confirmation undone', icon: '↩️', color: C.gold },
                      bulk_nric_requested: { label: 'Bulk NRIC request sent', icon: '📧', color: C.sage },
                      nric_synced_by_donor: { label: 'Donor updated their NRIC', icon: '🪪', color: C.sage },
                      bulk_receipts_issued: { label: 'Bulk receipts issued', icon: '🧾', color: C.sage },
                      receipt_voided_and_reissued: { label: 'Receipt voided and reissued', icon: '🚫', color: C.red },
                      recurring_gift_added: { label: 'Recurring gift added', icon: '🔁', color: C.sage },
                      recurring_gift_received: { label: 'Recurring payment marked received', icon: '🔁', color: C.sage },
                      pledge_fulfilled: { label: 'Pledge marked as fulfilled', icon: '🤝', color: C.sage },
                      csv_migration_imported: { label: 'Historical data imported via CSV', icon: '📥', color: C.sage },
                      mass_appeal_sent: { label: 'Mass appeal sent to donors', icon: '📣', color: C.sage },
                    }
                    const info = actionLabels[entry.action] || { label: entry.action, icon: '•', color: C.muted }
                    return (
                      <div key={entry.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 20px', borderBottom: `1px solid ${C.ivoryDark}` }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: C.ivory, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{info.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: info.color }}>{info.label}</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                            {entry.actor_type === 'donor' ? 'Donor' : 'Charity staff'} ({entry.actor_email}) · {new Date(entry.created_at).toLocaleString('en-SG')}
                          </div>
                          {entry.details && (
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontStyle: 'italic' }}>
                              {entry.action === 'donation_edited'
                                ? `${entry.details.before?.donor_name} · $${entry.details.before?.amount} → $${entry.details.after?.amount}`
                                : entry.action === 'bulk_nric_requested'
                                ? `${entry.details.donor_count} donor${entry.details.donor_count > 1 ? 's' : ''}`
                                : entry.action === 'nric_synced_by_donor'
                                ? `${entry.details.donation_count} donation${entry.details.donation_count > 1 ? 's' : ''} updated`
                                : entry.action === 'bulk_receipts_issued'
                                ? `${entry.details.donation_count} receipt${entry.details.donation_count > 1 ? 's' : ''}${entry.details.year ? ` · ${entry.details.year}` : entry.details.donor_name ? ` · ${entry.details.donor_name}` : ''}`
                                : [entry.details.donor_name || entry.details.charity_name, entry.details.amount != null ? `$${entry.details.amount}` : null, entry.details.payment_ref ? `Ref: ${entry.details.payment_ref}` : null, entry.details.notes ? `📝 "${entry.details.notes}"` : null].filter(Boolean).join(' · ')}
                            </div>
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
{activeTab === 'promotions' && (
          <div style={s.content}>
            <div style={s.pageHeader}>
              <div>
                <div style={s.pageTitle}>Campaigns</div>
                <div style={s.pageSub}>{myCauses.filter(c => c.type === 'campaign').length} campaign{myCauses.filter(c => c.type === 'campaign').length !== 1 ? 's' : ''} · Trackable goals for Mass Appeal and manual donations</div>
              </div>
              <button style={s.btnGold} onClick={() => { setCauseForm({ title: '', description: '', target_amount: '', end_date: '' }); setShowCampaignModal(true) }}>+ New Campaign</button>
            </div>

            {myCauses.length > 0 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
                <input style={{ ...s.searchBox, flex: 'none', width: isMobile ? '100%' : 380 }} placeholder="🔍 Search campaigns by title or description..." value={campaignSearchTerm} onChange={e => setCampaignSearchTerm(e.target.value)} />
                <select style={{ ...s.formInput, width: isMobile ? '100%' : 130 }} value={campaignYearFilter} onChange={e => setCampaignYearFilter(e.target.value)}>
                  <option value="All">All years</option>
                  {[...new Set(myCauses.filter(c => c.type === 'campaign').map(c => new Date(c.created_at).getFullYear()))].sort((a, b) => b - a).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                {(campaignSearchTerm !== '' || campaignYearFilter !== 'All') && (
                  <button style={{ ...s.viewBtn, whiteSpace: 'nowrap' }} onClick={() => { setCampaignSearchTerm(''); setCampaignYearFilter('All') }}>✕ Clear Filters</button>
                )}
                <button style={isMobile ? { ...s.exportSmallBtn, width: '100%' } : s.exportSmallBtn} onClick={() => {
                  const q = campaignSearchTerm.toLowerCase().trim()
                  const filtered = myCauses.filter(c => {
                    if (c.type !== 'campaign') return false
                    const matchesSearch = !q || [c.title, c.description].some(f => f?.toLowerCase().includes(q))
                    const matchesYear = campaignYearFilter === 'All' || new Date(c.created_at).getFullYear().toString() === campaignYearFilter
                    return matchesSearch && matchesYear
                  })
                  exportCampaignsExcel(filtered)
                }}>⬇️ Export to Excel</button>
              </div>
            )}

            {(() => {
              const q = campaignSearchTerm.toLowerCase().trim()
              const matchesSearch = c => !q || [c.title, c.description].some(f => f?.toLowerCase().includes(q))
              const matchesYear = c => campaignYearFilter === 'All' || new Date(c.created_at).getFullYear().toString() === campaignYearFilter
              const isPast = c => c.status === 'rejected' || c.status === 'deleted' || c.status === 'completed' || (c.status === 'approved' && c.end_date && new Date(c.end_date) < new Date())
              const activeCauses = myCauses.filter(c => c.type === 'campaign' && !isPast(c) && matchesSearch(c) && matchesYear(c))
              const pastCauses = myCauses.filter(c => c.type === 'campaign' && isPast(c) && matchesSearch(c) && matchesYear(c))

              const renderCard = c => {
                const raised = donations.filter(d => d.cause_id === c.id && d.payment_status === 'confirmed').reduce((s, d) => s + d.amount, 0)
                const donorCount = new Set(donations.filter(d => d.cause_id === c.id && d.payment_status === 'confirmed').map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name)).size
                const pct = c.target_amount > 0 ? Math.min(100, Math.round((raised / c.target_amount) * 100)) : null
                const daysLeft = c.end_date ? Math.ceil((new Date(c.end_date) - new Date()) / (1000 * 60 * 60 * 24)) : null
                const isActive = c.status === 'approved' && !isPast(c)
                const goalMet = c.target_amount > 0 && raised >= c.target_amount

                let behindPace = false
                if (isActive && c.target_amount > 0 && c.end_date) {
                  const totalDuration = new Date(c.end_date) - new Date(c.created_at)
                  const elapsed = new Date() - new Date(c.created_at)
                  const elapsedPct = totalDuration > 0 ? Math.min(100, Math.max(0, (elapsed / totalDuration) * 100)) : 0
                  behindPace = pct < elapsedPct - 15
                }

                return (
                  <div key={c.id} style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: C.forest }}>{c.title}</div>
                      <span style={
                        c.status === 'approved' ? s.badgeIssued :
                        c.status === 'completed' ? (goalMet ? s.badgeIssued : { ...s.badgePending, color: C.muted, background: C.ivory }) :
                        c.status === 'rejected' ? { ...s.badgePending, color: C.red, background: '#FBEEE9' } :
                        c.status === 'deleted' ? { ...s.badgePending, color: C.muted, background: C.ivory } :
                        s.badgePending
                      }>
                        {c.status === 'approved' ? '✓ Live' : c.status === 'completed' ? (goalMet ? '✓ Goal Met!' : '◻ Ended') : c.status === 'rejected' ? '✕ Rejected' : c.status === 'deleted' ? '🗑 Deleted' : '⏳ Pending'}
                      </span>
                    </div>
                    {c.description && <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5, marginBottom: 10 }}>{c.description}</div>}
                    {c.target_amount > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontFamily: C.fontVoice, fontSize: 17, fontWeight: 500, color: C.forest }}>${raised.toLocaleString()}</span>
                            <InfoTip text="Confirmed donations tagged to this campaign — manually selected, or auto-tagged when a Mass Appeal payment reference is confirmed." />
                          </span>
                          <span style={{ fontSize: 11.5, color: C.muted }}>of ${Number(c.target_amount).toLocaleString()}</span>
                        </div>
                        <div style={{ background: C.ivoryDark, borderRadius: 3, height: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(pct, 2)}%`, height: '100%', background: goalMet ? C.sage : behindPace ? C.gold : C.sage, borderRadius: 3 }} />
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: C.muted, marginBottom: 2 }}>Donors</div>
                        <div style={{ fontFamily: C.fontMono, fontSize: 14, fontWeight: 500, color: C.forest }}>{donorCount}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: C.muted, marginBottom: 2 }}>{isActive ? 'Ends' : 'Ended'}</div>
                        <div style={{ fontFamily: C.fontMono, fontSize: 14, fontWeight: 500, color: C.forest }}>
                          {daysLeft === null ? '—' : isActive ? (daysLeft >= 0 ? `${daysLeft}d` : 'Overdue') : new Date(c.end_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                    </div>
                    {c.cost > 0 && (
                      <div style={{ fontSize: 11.5, color: raised >= c.cost ? C.sage : C.red, fontWeight: 500, marginBottom: 10 }}>
                        Cost ${Number(c.cost).toLocaleString()} · ROI {(raised / c.cost).toFixed(1)}×
                      </div>
                    )}
                    {isActive && behindPace && (
                      <div style={{ fontSize: 11, color: C.gold, fontWeight: 500, marginBottom: 10 }}>⚠ Behind pace · {pct}% funded</div>
                    )}
                    {c.status === 'completed' && (
                      <div style={{ fontSize: 11, color: goalMet ? C.sage : C.muted, fontWeight: 500, marginBottom: 10 }}>
                        {goalMet ? `✓ Goal met · ${pct}% funded` : `Ended · ${pct !== null ? `${pct}% funded` : 'no target set'}`}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
                      Submitted {new Date(c.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                      {c.status === 'pending' && (
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', flex: 1, justifyContent: 'center' }} onClick={() => startEditCause(c)}>Edit</button>
                      )}
                      {isActive && (
                        <>
                          <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', flex: 1, justifyContent: 'center' }} onClick={() => requestRevision(c)}>Edit</button>
                          <button style={{ ...s.issueBtn, fontSize: 11, padding: '5px 10px', flex: 1, justifyContent: 'center' }} onClick={() => completeCause(c, raised)}>✓ Complete</button>
                        </>
                      )}
                      {c.status === 'deleted' ? (
                        <>
                          <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', flex: 1, justifyContent: 'center' }} onClick={() => restoreCause(c)}>↺ Restore</button>
                          <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', color: C.red, borderColor: C.red, flex: 1, justifyContent: 'center' }} onClick={() => permanentlyDeleteCause(c)}>🗑 Permanently Delete</button>
                        </>
                      ) : (
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', color: C.red, borderColor: C.red, flex: 1, justifyContent: 'center' }} onClick={() => deleteCause(c.id)}>Delete</button>
                      )}
                    </div>
                  </div>
                )
              }

              return (
                <>
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.forest, marginBottom: 12 }}>Active Campaigns ({activeCauses.length})</div>
                    {activeCauses.length === 0 ? (
                      <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 20px', fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No active campaigns yet — click "+ New Campaign" to get started.</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
                        {activeCauses.map(renderCard)}
                      </div>
                    )}
                  </div>

                  {pastCauses.length > 0 && (
                    <div>
                      <div
                        style={{ fontSize: 13, fontWeight: 500, color: C.muted, marginBottom: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                        onClick={() => setShowPastCampaigns(v => !v)}
                      >
                        <span style={{ fontSize: 11, color: C.muted }}>{showPastCampaigns ? '▾' : '▸'}</span>
                        Past Campaigns ({pastCauses.length})
                      </div>
                      {showPastCampaigns && (
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
                          {pastCauses.map(renderCard)}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )
            })()}

            {showCampaignModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
                <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>{causeForm.editingId ? 'Edit Campaign' : 'New Campaign'}</div>
                    <span style={{ cursor: 'pointer', color: C.muted, fontSize: 18 }} onClick={() => { setShowCampaignModal(false); setCauseError(''); setCauseForm({ title: '', description: '', target_amount: '', end_date: '' }) }}>✕</span>
                  </div>
                  {causeError && <div style={{ background: C.warningBg, color: C.warning, padding: '10px 14px', borderRadius: 6, fontSize: 13, marginTop: 12, marginBottom: 4 }}>{causeError}</div>}
                  <div style={{ marginTop: 12, marginBottom: 10 }}>
                    <div style={s.formLabel}>Title *</div>
                    <input style={s.formInput} placeholder="e.g. Winter Meal Drive" value={causeForm.title} onChange={e => setCauseForm(f => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={s.formLabel}>Description *</div>
                    <textarea style={{ ...s.formInput, minHeight: 80, resize: 'vertical' }} placeholder="What is this campaign for?" value={causeForm.description} onChange={e => setCauseForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 16 }}>
                    <div>
                      <div style={s.formLabel}>Target Amount (SGD)</div>
                      <input style={s.formInput} type="number" placeholder="Optional" value={causeForm.target_amount} onChange={e => setCauseForm(f => ({ ...f, target_amount: e.target.value }))} />
                    </div>
                    <div>
                      <div style={s.formLabel}>End Date</div>
                      <input style={s.formInput} type="date" value={causeForm.end_date} onChange={e => setCauseForm(f => ({ ...f, end_date: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={s.formLabel}>Campaign Cost (SGD)</div>
                    <input style={s.formInput} type="number" placeholder="e.g. printing, postage, venue — optional" value={causeForm.cost} onChange={e => setCauseForm(f => ({ ...f, cost: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} onClick={async () => { await submitCause(); setShowCampaignModal(false) }} disabled={savingCause}>{savingCause ? 'Saving...' : (causeForm.editingId ? '✓ Save Changes' : '✓ Create Campaign')}</button>
                    <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => { setShowCampaignModal(false); setCauseError(''); setCauseForm({ title: '', description: '', target_amount: '', end_date: '' }) }}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── RECURRING ── */}
        {activeTab === 'recurring' && (
          <div style={s.content}>
            <div style={s.pageHeader}>
              <div>
                <div style={s.pageTitle}>Recurring Giving</div>
                <div style={s.pageSub}>{recurringGifts.filter(g => g.status === 'active').length} active · ${recurringGifts.filter(g => g.status === 'active').reduce((s, g) => s + g.amount, 0).toLocaleString()} expected/cycle</div>
              </div>
              <button style={s.btnGold} onClick={() => { setShowRecurringForm(true); setRecurringError('') }}>+ Add Recurring Gift</button>
            </div>

            {showRecurringForm && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => { setShowRecurringForm(false); setRecurringError('') }}>
              <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.forest }}>🔁 New Recurring Gift</div>
                  <button style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer' }} onClick={() => { setShowRecurringForm(false); setRecurringError('') }}>✕</button>
                </div>
                {recurringError && <div style={{ background: C.warningBg, color: C.warning, padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12 }}>{recurringError}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <div style={s.formLabel}>Donor Name *</div>
                    <input style={s.formInput} placeholder="Full name" value={recurringForm.donor_name} onChange={e => setRecurringForm(f => ({ ...f, donor_name: e.target.value }))} />
                  </div>
                  <div>
                    <div style={s.formLabel}>Donor Email</div>
                    <input style={s.formInput} placeholder="donor@email.com" value={recurringForm.donor_email} onChange={e => setRecurringForm(f => ({ ...f, donor_email: e.target.value }))} />
                  </div>
                  <div>
                    <div style={s.formLabel}>Amount per Cycle (SGD) *</div>
                    <input style={s.formInput} type="number" placeholder="0.00" value={recurringForm.amount} onChange={e => setRecurringForm(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                  <div>
                    <div style={s.formLabel}>Frequency</div>
                    <select style={s.formInput} value={recurringForm.frequency} onChange={e => setRecurringForm(f => ({ ...f, frequency: e.target.value }))}>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annually">Annually</option>
                    </select>
                  </div>
                  <div>
                    <div style={s.formLabel}>Start Date *</div>
                    <input style={s.formInput} type="date" value={recurringForm.start_date} onChange={e => setRecurringForm(f => ({ ...f, start_date: e.target.value }))} />
                  </div>
                  <div>
                    <div style={s.formLabel}>Type</div>
                    <select style={s.formInput} value={recurringForm.type} onChange={e => setRecurringForm(f => ({ ...f, type: e.target.value }))}>
                      <option value="giro">GIRO</option>
                      <option value="habitual_paynow">Habitual PayNow</option>
                      <option value="standing_order">Standing Order</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <div style={s.formLabel}>GIRO Reference / Account</div>
                    <input style={s.formInput} placeholder="Optional reference number" value={recurringForm.giro_reference} onChange={e => setRecurringForm(f => ({ ...f, giro_reference: e.target.value }))} />
                  </div>
                  <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1' }}>
                    <div style={s.formLabel}>Notes</div>
                    <input style={s.formInput} placeholder="Optional notes" value={recurringForm.notes} onChange={e => setRecurringForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} onClick={saveRecurringGift} disabled={savingRecurring}>{savingRecurring ? 'Saving...' : '✓ Save'}</button>
                  <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => { setShowRecurringForm(false); setRecurringError('') }}>Cancel</button>
                </div>
              </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
              <input style={{ ...s.searchBox, flex: 'none', width: isMobile ? '100%' : 380 }} placeholder="🔍 Search by donor name, email, or notes..." value={recurringSearchTerm} onChange={e => setRecurringSearchTerm(e.target.value)} />
              <select style={{ ...s.formInput, width: isMobile ? '100%' : 160 }} value={recurringUrgencyFilter} onChange={e => setRecurringUrgencyFilter(e.target.value)}>
                <option value="All">All urgency</option>
                <option value="Late">Late (7d+)</option>
                <option value="Due Soon">Due soon</option>
                <option value="Healthy">Healthy</option>
              </select>
              <select style={{ ...s.formInput, width: isMobile ? '100%' : 160 }} value={recurringAmountFilter} onChange={e => setRecurringAmountFilter(e.target.value)}>
                <option value="All">All amounts</option>
                <option value="Under 50">Under $50</option>
                <option value="50-200">$50 – $200</option>
                <option value="200-500">$200 – $500</option>
                <option value="Over 500">Over $500</option>
              </select>
              <select style={{ ...s.formInput, width: isMobile ? '100%' : 160 }} value={recurringTypeFilter} onChange={e => setRecurringTypeFilter(e.target.value)}>
                <option value="All">All types</option>
                <option value="giro">GIRO</option>
                <option value="habitual_paynow">Habitual PayNow</option>
                <option value="standing_order">Standing Order</option>
                <option value="other">Other</option>
              </select>
              <select style={{ ...s.formInput, width: isMobile ? '100%' : 150 }} value={recurringYearFilter} onChange={e => setRecurringYearFilter(e.target.value)}>
                <option value="All">All start years</option>
                {[...new Set(recurringGifts.filter(g => g.start_date).map(g => new Date(g.start_date).getFullYear()))].sort((a, b) => b - a).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              {(recurringSearchTerm !== '' || recurringUrgencyFilter !== 'All' || recurringAmountFilter !== 'All' || recurringTypeFilter !== 'All' || recurringYearFilter !== 'All') && (
                <button style={{ ...s.viewBtn, whiteSpace: 'nowrap' }} onClick={() => { setRecurringSearchTerm(''); setRecurringUrgencyFilter('All'); setRecurringAmountFilter('All'); setRecurringTypeFilter('All'); setRecurringYearFilter('All') }}>✕ Clear Filters</button>
              )}
              <button style={isMobile ? { ...s.exportSmallBtn, width: '100%' } : s.exportSmallBtn} onClick={() => {
                const q = recurringSearchTerm.toLowerCase().trim()
                const today = new Date(); today.setHours(0,0,0,0)
                const filtered = recurringGifts.filter(g => {
                  const matchesSearch = !q || [g.donor_name, g.donor_email, g.notes, g.giro_reference].some(f => f?.toLowerCase().includes(q))
                  const matchesType = recurringTypeFilter === 'All' || g.type === recurringTypeFilter
                  const amt = Number(g.amount)
                  const matchesAmt = recurringAmountFilter === 'All'
                    || (recurringAmountFilter === 'Under 50' && amt < 50)
                    || (recurringAmountFilter === '50-200' && amt >= 50 && amt <= 200)
                    || (recurringAmountFilter === '200-500' && amt > 200 && amt <= 500)
                    || (recurringAmountFilter === 'Over 500' && amt > 500)
                  let matchesUrgency = true
                  if (recurringUrgencyFilter !== 'All') {
                    if (g.status !== 'active') matchesUrgency = false
                    else {
                      const days = Math.ceil((new Date(g.next_expected_date) - today) / (1000 * 60 * 60 * 24))
                      if (recurringUrgencyFilter === 'Late') matchesUrgency = days < -7
                      else if (recurringUrgencyFilter === 'Due Soon') matchesUrgency = days >= -7 && days <= 7
                      else if (recurringUrgencyFilter === 'Healthy') matchesUrgency = days > 7
                    }
                  }
                  const matchesYear = recurringYearFilter === 'All' || (g.start_date && new Date(g.start_date).getFullYear().toString() === recurringYearFilter)
                  return matchesSearch && matchesType && matchesAmt && matchesUrgency && matchesYear
                })
                exportRecurringExcel(filtered)
              }}>⬇️ Export to Excel</button>
            </div>

            {(() => {
              const today = new Date(); today.setHours(0,0,0,0)

              const q = recurringSearchTerm.toLowerCase().trim()
              const matchesSearch = (g) => {
                if (!q) return true
                const fields = [g.donor_name, g.donor_email, g.notes, g.giro_reference]
                return fields.some(f => f?.toLowerCase().includes(q))
              }
              const matchesUrgency = (g) => {
                if (recurringUrgencyFilter === 'All') return true
                if (g.status !== 'active') return false
                const days = Math.ceil((new Date(g.next_expected_date) - today) / (1000 * 60 * 60 * 24))
                if (recurringUrgencyFilter === 'Late') return days < -7
                if (recurringUrgencyFilter === 'Due Soon') return days >= -7 && days <= 7
                if (recurringUrgencyFilter === 'Healthy') return days > 7
                return true
              }
              const matchesAmount = (g) => {
                const amt = Number(g.amount)
                if (recurringAmountFilter === 'All') return true
                if (recurringAmountFilter === 'Under 50') return amt < 50
                if (recurringAmountFilter === '50-200') return amt >= 50 && amt <= 200
                if (recurringAmountFilter === '200-500') return amt > 200 && amt <= 500
                if (recurringAmountFilter === 'Over 500') return amt > 500
                return true
              }
              const matchesType = (g) => recurringTypeFilter === 'All' || g.type === recurringTypeFilter
              const matchesYear = (g) => recurringYearFilter === 'All' || (g.start_date && new Date(g.start_date).getFullYear().toString() === recurringYearFilter)

              const filtered = recurringGifts.filter(g => matchesSearch(g) && matchesUrgency(g) && matchesAmount(g) && matchesType(g) && matchesYear(g))

              const renderRecurringCard = (g) => {
                const nextDate = new Date(g.next_expected_date)
                const daysUntil = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24))
                const isLate = daysUntil < -7 && g.status === 'active'
                const isDueSoon = daysUntil >= -7 && daysUntil <= 7 && g.status === 'active'
                const frequencyLabel = { weekly: 'week', monthly: 'month', quarterly: 'quarter', annually: 'year' }[g.frequency] || g.frequency
                const typeLabel = g.type === 'giro' ? 'GIRO' : g.type === 'habitual_paynow' ? 'Habitual PayNow' : g.type === 'standing_order' ? 'Standing Order' : 'Other'

                return (
                  <div key={g.id} style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: C.forest }}>{g.donor_name}</div>
                      <div style={{ fontFamily: C.fontVoice, fontSize: 18, fontWeight: 500, color: C.forest, flexShrink: 0 }}>${Number(g.amount).toLocaleString()}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 500, color: C.forest, background: C.ivory, border: `1px solid ${C.border}`, padding: '2px 8px', borderRadius: 20 }}>{typeLabel}</span>
                      {isLate && <span style={{ ...s.badgePending, color: C.red, background: '#FBEEE9' }}>⚠ {Math.abs(daysUntil)}d late</span>}
                      {isDueSoon && !isLate && daysUntil <= 0 && <span style={{ ...s.badgePending, color: C.red, background: '#FBEEE9' }}>Due today</span>}
                      {isDueSoon && daysUntil > 0 && <span style={s.badgePending}>Due in {daysUntil}d</span>}
                    </div>
                    {g.donor_email && <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>{g.donor_email}</div>}

                    <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 2 }}>
                      ${Number(g.amount).toLocaleString()} / {frequencyLabel}
                      {g.giro_reference && ` · Ref: ${g.giro_reference}`}
                    </div>
                    <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 2 }}>
                      Next expected: {nextDate.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    {g.last_received_date && (
                      <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 2 }}>
                        Last received: {new Date(g.last_received_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                    {g.start_date && (
                      <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>
                        Giving since {new Date(g.start_date).toLocaleDateString('en-SG', { month: 'short', year: 'numeric' })}
                      </div>
                    )}
                    {recurringGivenTotals[g.id] && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: C.sage + '1A', border: `1px solid ${C.sage}`, borderRadius: 4, padding: '4px 8px', marginBottom: 8, alignSelf: 'flex-start' }}>
                        <span style={{ fontSize: 11.5, fontWeight: 500, color: C.sage, display: 'flex', alignItems: 'center', gap: 4 }}>
                          ${recurringGivenTotals[g.id].total.toLocaleString()} total · {recurringGivenTotals[g.id].count} payment{recurringGivenTotals[g.id].count !== 1 ? 's' : ''}
                          <InfoTip text="Sum of every payment recorded via Mark Received for this recurring gift, not an estimate." />
                        </span>
                      </div>
                    )}
                    {g.notes && <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', marginBottom: 8 }}>{g.notes}</div>}

                    {(recurringSkipHistory[g.id] || []).length > 0 && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: C.gold + '1A', border: `1px solid ${C.gold}`, borderRadius: 4, padding: '4px 8px', marginBottom: 8, alignSelf: 'flex-start' }}>
                        <span style={{ fontSize: 11.5, fontWeight: 500, color: C.gold }}>
                          ⏭ {recurringSkipHistory[g.id].length} cycle{recurringSkipHistory[g.id].length !== 1 ? 's' : ''} skipped
                        </span>
                      </div>
                    )}
                    {g.status === 'active' && (recurringReminderHistory[g.id] || []).length > 0 && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: C.gold + '1A', border: `1px solid ${C.gold}`, borderRadius: 4, padding: '4px 8px', marginBottom: 8, alignSelf: 'flex-start' }}>
                        <span style={{ fontSize: 11.5, fontWeight: 500, color: C.gold }}>
                          {(() => {
                            const history = recurringReminderHistory[g.id]
                            const last = history[0]
                            const daysAgo = Math.floor((new Date() - new Date(last.sent_at)) / (1000 * 60 * 60 * 24))
                            return `✉ Last reminded ${daysAgo === 0 ? 'today' : `${daysAgo}d ago`} · ${history.length}× sent`
                          })()}
                        </span>
                      </div>
                    )}
                    {g.status === 'active' && isLate && (
                      <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', width: '100%', justifyContent: 'center', marginBottom: 6 }} onClick={() => { setRecurringReminderCandidate(g); setShowRecurringReminderModal(true) }}>✉ Send Reminder</button>
                    )}
                    {g.status === 'active' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, marginTop: 'auto' }}>
                        <button style={{ ...s.issueBtn, fontSize: 11, padding: '5px 10px', justifyContent: 'center' }} onClick={() => markRecurringReceived(g)}>✓ Mark Received</button>
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', justifyContent: 'center' }} onClick={() => skipRecurringCycle(g)}>⏭ Skip Cycle</button>
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', justifyContent: 'center' }} onClick={() => pauseRecurringGift(g)}>⏸ Pause</button>
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', color: C.red, borderColor: C.red, justifyContent: 'center' }} onClick={() => cancelRecurringGift(g)}>✕ Cancel</button>
                      </div>
                    )}
                    {g.status === 'paused' && (
                      <button style={{ ...s.issueBtn, fontSize: 11, padding: '5px 10px', justifyContent: 'center', marginTop: 'auto' }} onClick={() => reactivateRecurringGift(g)}>▶ Reactivate</button>
                    )}
                  </div>
                )
              }

              const active = filtered.filter(g => g.status === 'active')
              const paused = filtered.filter(g => g.status === 'paused')
              const cancelled = filtered.filter(g => g.status === 'cancelled')

              return (
                <>
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.forest, marginBottom: 12 }}>Active Recurring Gifts ({active.length})</div>
                    {active.length === 0 ? (
                      <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 20px', fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No active recurring gifts.</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
                        {active.map(renderRecurringCard)}
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: 32 }}>
                    <div
                      style={{ fontSize: 13, fontWeight: 500, color: C.forest, marginBottom: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                      onClick={() => setShowPausedRecurring(v => !v)}
                    >
                      <span style={{ fontSize: 11, color: C.muted }}>{showPausedRecurring ? '▾' : '▸'}</span>
                      Paused ({paused.length})
                    </div>
                    {showPausedRecurring && (
                      paused.length === 0 ? (
                        <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 20px', fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No paused recurring gifts.</div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
                          {paused.map(renderRecurringCard)}
                        </div>
                      )
                    )}
                  </div>

                  {cancelled.length > 0 && (
                    <div>
                      <div
                        style={{ fontSize: 13, fontWeight: 500, color: C.muted, marginBottom: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                        onClick={() => setShowCancelledRecurring(v => !v)}
                      >
                        <span style={{ fontSize: 11, color: C.muted }}>{showCancelledRecurring ? '▾' : '▸'}</span>
                        Cancelled ({cancelled.length})
                      </div>
                      {showCancelledRecurring && (
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
                          {cancelled.map(renderRecurringCard)}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        )}

        {/* ── PLEDGES ── */}
        {activeTab === 'pledges' && (
          <div style={s.content}>
            <div style={s.pageHeader}>
              <div>
                <div style={s.pageTitle}>Pledges</div>
                <div style={s.pageSub}>{pledges.filter(p => p.status === 'pending').length} pending · {pledges.filter(p => p.status === 'fulfilled').length} fulfilled</div>
              </div>
              <button style={s.btnGold} onClick={() => { setShowPledgeForm(true); setPledgeError('') }}>+ Record Pledge</button>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
              <input style={{ ...s.searchBox, flex: 'none', width: isMobile ? '100%' : 380 }} placeholder="🔍 Search pledges by donor name, email, or notes..." value={pledgeSearchTerm} onChange={e => setPledgeSearchTerm(e.target.value)} />
              <select style={{ ...s.formInput, width: isMobile ? '100%' : 160 }} value={pledgeUrgencyFilter} onChange={e => setPledgeUrgencyFilter(e.target.value)}>
                <option value="All">All urgency</option>
                <option value="Overdue">Overdue</option>
                <option value="Due Soon">Due soon (7d)</option>
                <option value="Healthy">Healthy</option>
              </select>
              <select style={{ ...s.formInput, width: isMobile ? '100%' : 160 }} value={pledgeAmountFilter} onChange={e => setPledgeAmountFilter(e.target.value)}>
                <option value="All">All amounts</option>
                <option value="Under 100">Under $100</option>
                <option value="100-500">$100 – $500</option>
                <option value="500-1000">$500 – $1,000</option>
                <option value="Over 1000">Over $1,000</option>
              </select>
              <select style={{ ...s.formInput, width: isMobile ? '100%' : 130 }} value={pledgeYearFilter} onChange={e => setPledgeYearFilter(e.target.value)}>
                <option value="All">All years</option>
                {[...new Set(pledges.map(p => new Date(p.expected_date).getFullYear()))].sort((a, b) => b - a).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              {(pledgeSearchTerm !== '' || pledgeUrgencyFilter !== 'All' || pledgeAmountFilter !== 'All' || pledgeYearFilter !== 'All') && (
                <button style={{ ...s.viewBtn, whiteSpace: 'nowrap' }} onClick={() => { setPledgeSearchTerm(''); setPledgeUrgencyFilter('All'); setPledgeAmountFilter('All'); setPledgeYearFilter('All') }}>✕ Clear Filters</button>
              )}
              <button style={isMobile ? { ...s.exportSmallBtn, width: '100%' } : s.exportSmallBtn} onClick={() => {
                const q = pledgeSearchTerm.toLowerCase().trim()
                const filtered = pledges.filter(p => {
                  const matchesSearch = !q || [p.donor_name, p.donor_email, p.notes].some(f => f?.toLowerCase().includes(q))
                  const matchesYear = pledgeYearFilter === 'All' || new Date(p.expected_date).getFullYear().toString() === pledgeYearFilter
                  const amt = Number(p.amount)
                  const matchesAmt = pledgeAmountFilter === 'All'
                    || (pledgeAmountFilter === 'Under 100' && amt < 100)
                    || (pledgeAmountFilter === '100-500' && amt >= 100 && amt <= 500)
                    || (pledgeAmountFilter === '500-1000' && amt > 500 && amt <= 1000)
                    || (pledgeAmountFilter === 'Over 1000' && amt > 1000)
                  return matchesSearch && matchesYear && matchesAmt
                })
                exportPledgesExcel(filtered)
              }}>⬇️ Export to Excel</button>
            </div>

            {showPledgeReminderModal && pledgeReminderCandidate && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
                <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: C.forest, marginBottom: 12 }}>Send pledge reminder</div>
                  <SenderIdentityLine recipientName={pledgeReminderCandidate.donor_name} recipientEmail={pledgeReminderCandidate.donor_email} />
                  <div style={{ marginBottom: 12 }}>
                    <div style={s.formLabel}>Subject</div>
                    <input style={s.formInput} value={pledgeReminderSubject} onChange={e => setPledgeReminderSubject(e.target.value)} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={s.formLabel}>Message</div>
                    <textarea style={{ ...s.formInput, minHeight: 140, resize: 'vertical', fontFamily: 'inherit' }} value={pledgeReminderBody} onChange={e => setPledgeReminderBody(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={sendingPledgeReminder || !pledgeReminderCandidate.donor_email} onClick={sendPledgeReminder}>
                      {sendingPledgeReminder ? 'Sending...' : '✓ Send reminder'}
                    </button>
                    <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => { setShowPledgeReminderModal(false); setPledgeReminderCandidate(null) }}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showPledgeThankYouModal && pledgeCompletionCandidate && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
                <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: C.forest, marginBottom: 4 }}>🎉 Pledge completed</div>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
                    This donation brings {pledgeCompletionCandidate.pledge.donor_name}'s pledge of ${Number(pledgeCompletionCandidate.pledge.amount).toLocaleString()} to completion. Send a special thank-you?
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={s.formLabel}>Subject</div>
                    <input style={s.formInput} value={pledgeThankYouSubject} onChange={e => setPledgeThankYouSubject(e.target.value)} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={s.formLabel}>Message</div>
                    <textarea style={{ ...s.formInput, minHeight: 140, resize: 'vertical', fontFamily: 'inherit' }} value={pledgeThankYouBody} onChange={e => setPledgeThankYouBody(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={sendingPledgeThankYou} onClick={sendPledgeThankYou}>
                      {sendingPledgeThankYou ? 'Sending...' : '✓ Mark fulfilled & send'}
                    </button>
                    <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={skipPledgeThankYou}>
                      Skip — just mark fulfilled
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showPledgeForm && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => { setShowPledgeForm(false); setPledgeError('') }}>
              <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.forest }}>🤝 New Pledge</div>
                  <button style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer' }} onClick={() => { setShowPledgeForm(false); setPledgeError('') }}>✕</button>
                </div>
                {pledgeError && <div style={{ background: C.warningBg, color: C.warning, padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12 }}>{pledgeError}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <div style={s.formLabel}>Donor Name *</div>
                    <input style={s.formInput} placeholder="Full name" value={pledgeForm.donor_name} onChange={e => setPledgeForm(f => ({ ...f, donor_name: e.target.value }))} />
                  </div>
                  <div>
                    <div style={s.formLabel}>Donor Email</div>
                    <input style={s.formInput} placeholder="donor@email.com" value={pledgeForm.donor_email} onChange={e => setPledgeForm(f => ({ ...f, donor_email: e.target.value }))} />
                  </div>
                  <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.forest, cursor: 'pointer' }}>
                      <input type="checkbox" checked={pledgeForm.is_multi_year} onChange={e => setPledgeForm(f => ({ ...f, is_multi_year: e.target.checked }))} />
                      This is a multi-year pledge (e.g. $10K/year for 3 years)
                    </label>
                  </div>
                  <div>
                    <div style={s.formLabel}>{pledgeForm.is_multi_year ? 'Amount Per Year (SGD) *' : 'Pledged Amount (SGD) *'}</div>
                    <input style={s.formInput} type="number" placeholder="0.00" value={pledgeForm.amount} onChange={e => setPledgeForm(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                  {pledgeForm.is_multi_year && (
                    <div>
                      <div style={s.formLabel}>Number of Years *</div>
                      <input style={s.formInput} type="number" min="2" placeholder="3" value={pledgeForm.total_years} onChange={e => setPledgeForm(f => ({ ...f, total_years: e.target.value }))} />
                    </div>
                  )}
                  <div>
                    <div style={s.formLabel}>{pledgeForm.is_multi_year ? 'First Instalment Due *' : 'Expected By *'}</div>
                    <input style={s.formInput} type="date" min={new Date().toISOString().split('T')[0]} value={pledgeForm.expected_date} onChange={e => setPledgeForm(f => ({ ...f, expected_date: e.target.value }))} />
                  </div>
                  {pledgeForm.is_multi_year && pledgeForm.amount && pledgeForm.total_years && (
                    <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1', background: C.successBg, border: `1px solid ${C.sage}`, borderRadius: 6, padding: 10, fontSize: 12, color: C.forest }}>
                      Total commitment: <strong>${(parseFloat(pledgeForm.amount) * parseInt(pledgeForm.total_years)).toLocaleString()}</strong> over {pledgeForm.total_years} years
                    </div>
                  )}
                  <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1' }}>
                    <div style={s.formLabel}>Notes</div>
                    <input style={s.formInput} placeholder="e.g. Verbally committed at gala dinner" value={pledgeForm.notes} onChange={e => setPledgeForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} onClick={savePledge} disabled={savingPledge}>{savingPledge ? 'Saving...' : '✓ Save Pledge'}</button>
                  <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => { setShowPledgeForm(false); setPledgeError('') }}>Cancel</button>
                </div>
              </div>
              </div>
            )}

            {(() => {
              const today = new Date(); today.setHours(0,0,0,0)
              const renderPledgeCard = (p) => {
                const expectedDate = new Date(p.expected_date)
                const daysUntil = Math.ceil((expectedDate - today) / (1000 * 60 * 60 * 24))
                const isOverdue = daysUntil < 0 && p.status === 'pending'
                const isDueSoon = daysUntil >= 0 && daysUntil <= 7 && p.status === 'pending'
                const given = pledgeGivenTotals[p.id] || 0
                const pledgedAmount = Number(p.amount)
                const pct = pledgedAmount > 0 ? Math.min(100, Math.round((given / pledgedAmount) * 100)) : 0
                return (
                  <div key={p.id} style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: C.forest }}>{p.donor_name}</div>
                      <div style={{ fontFamily: C.fontVoice, fontSize: 18, fontWeight: 500, color: C.forest, flexShrink: 0 }}>${pledgedAmount.toLocaleString()}</div>
                    </div>
                    {p.donor_email && <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>{p.donor_email}</div>}

                    {p.is_multi_year && (() => {
                      const myInstalments = pledgeInstalments.filter(i => i.pledge_id === p.id).sort((a, b) => a.year_number - b.year_number)
                      const nextDue = myInstalments.find(i => !i.received)
                      return (
                        <div style={{ background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 12px', marginBottom: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: C.forest, marginBottom: 6 }}>{p.total_years}-year commitment · ${(Number(p.amount) / p.total_years).toLocaleString()}/year</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {myInstalments.map(i => (
                              <span key={i.id} style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 20, background: i.received ? C.successBg : (new Date(i.expected_date) < new Date() ? '#FBEEE9' : C.white), color: i.received ? C.sage : (new Date(i.expected_date) < new Date() ? C.red : C.muted), border: `1px solid ${i.received ? C.sage : C.border}` }}>
                                Year {i.year_number}{i.received ? ' ✓' : ` · ${new Date(i.expected_date).toLocaleDateString('en-SG', { month: 'short', year: 'numeric' })}`}
                              </span>
                            ))}
                          </div>
                          {nextDue && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Next instalment due {new Date(nextDue.expected_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}</div>}
                        </div>
                      )
                    })()}

                    {p.status === 'pending' && (() => {
                      const progressColor = (() => {
                        const brick = [160, 71, 47]
                        const gold = [180, 135, 14]
                        const sage = [61, 122, 92]
                        const lerp = (a, b, t) => Math.round(a + (b - a) * t)
                        const mix = (c1, c2, t) => `rgb(${lerp(c1[0], c2[0], t)}, ${lerp(c1[1], c2[1], t)}, ${lerp(c1[2], c2[2], t)})`
                        if (pct <= 50) return mix(brick, gold, pct / 50)
                        return mix(gold, sage, (pct - 50) / 50)
                      })()
                      return (
                        <div style={{ marginBottom: 4 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 500, color: progressColor, display: 'flex', alignItems: 'center', gap: 4 }}>{pct}% given <InfoTip text="Donations are matched automatically by donor and applied here. If a donor has more than one pending pledge, donations apply to whichever is due soonest." /></span>
                            <span style={{ fontSize: 11, color: C.muted }}>${given.toLocaleString()} of ${pledgedAmount.toLocaleString()}</span>
                          </div>
                          <div style={{ background: C.ivoryDark, borderRadius: 3, height: 6, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.max(pct, 2)}%`, height: '100%', background: progressColor, borderRadius: 3 }} />
                          </div>
                        </div>
                      )
                    })()}

                    <div style={{ marginTop: 10, marginBottom: 4 }}>
                      {isOverdue && <span style={{ ...s.badgePending, color: C.red, background: '#FBEEE9' }}>⚠ Overdue by {Math.abs(daysUntil)}d</span>}
                      {isDueSoon && <span style={s.badgePending}>⏰ Due in {daysUntil}d</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>
                      Expected by {expectedDate.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {p.notes && ` · ${p.notes}`}
                    </div>
                    <div style={{ fontSize: 10.5, color: C.muted, marginTop: 4, marginBottom: 12 }}>Recorded by {p.created_by} on {new Date(p.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</div>

                    {p.status === 'pending' && (pledgeReminderHistory[p.id] || []).length > 0 && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: C.gold + '1A', border: `1px solid ${C.gold}`, borderRadius: 4, padding: '4px 8px', marginBottom: 8, alignSelf: 'flex-start' }}>
                        <span style={{ fontSize: 11.5, fontWeight: 500, color: C.gold }}>
                          {(() => {
                            const history = pledgeReminderHistory[p.id]
                            const last = history[0]
                            const daysAgo = Math.floor((new Date() - new Date(last.sent_at)) / (1000 * 60 * 60 * 24))
                            return `✉ Last reminded ${daysAgo === 0 ? 'today' : `${daysAgo}d ago`} · ${history.length}× sent`
                          })()}
                        </span>
                      </div>
                    )}
                    {p.status === 'pending' && (pledgeRescheduleHistory[p.id] || []).length > 0 && (
                      <div style={{ fontSize: 10.5, color: C.muted, fontStyle: 'italic', marginBottom: 8 }}>
                        Rescheduled from {new Date(pledgeRescheduleHistory[p.id][0].old_expected_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })} to {new Date(pledgeRescheduleHistory[p.id][0].new_expected_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {pledgeRescheduleHistory[p.id][0].reason && ` — "${pledgeRescheduleHistory[p.id][0].reason}"`}
                      </div>
                    )}
                    {p.status === 'pending' && (isOverdue || isDueSoon) && (
                      <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', width: '100%', justifyContent: 'center', marginBottom: 6 }} onClick={() => { setPledgeReminderCandidate(p); setShowPledgeReminderModal(true) }}>✉ Send Reminder</button>
                    )}
                    {p.status === 'pending' && (
                      <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', width: '100%', justifyContent: 'center', marginBottom: 6 }} onClick={() => { setRescheduleModal(p); setRescheduleNewDate(''); setRescheduleReason('') }}>📅 Reschedule</button>
                    )}
                    {p.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                        <button style={{ ...s.issueBtn, fontSize: 11, padding: '5px 10px', flex: 1, justifyContent: 'center' }} onClick={() => fulfillPledge(p)}>✓ Fulfilled</button>
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', color: C.red, borderColor: C.red, flex: 1, justifyContent: 'center' }} onClick={() => cancelPledge(p)}>✕ Cancel</button>
                      </div>
                    )}
                    {p.resolution_notes && (
                      <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', marginBottom: 8, background: C.ivory, borderRadius: 4, padding: '6px 8px' }}>"{p.resolution_notes}"</div>
                    )}
                    {(p.status === 'fulfilled' || p.status === 'cancelled') && (
                      <div style={{ marginTop: 'auto' }}>
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', width: '100%', justifyContent: 'center' }} onClick={() => revertPledgeToPending(p)}>↺ Revert to Pending</button>
                      </div>
                    )}
                  </div>
                )
              }

              const q = pledgeSearchTerm.toLowerCase().trim()
              const matchesSearch = (p) => {
                if (!q) return true
                const searchFields = [p.donor_name, p.donor_email, p.notes]
                return searchFields.some(field => field?.toLowerCase().includes(q))
              }
              const matchesUrgency = (p) => {
                if (pledgeUrgencyFilter === 'All') return true
                if (p.status !== 'pending') return false
                const days = Math.ceil((new Date(p.expected_date) - today) / (1000 * 60 * 60 * 24))
                if (pledgeUrgencyFilter === 'Overdue') return days < 0
                if (pledgeUrgencyFilter === 'Due Soon') return days >= 0 && days <= 7
                if (pledgeUrgencyFilter === 'Healthy') return days > 7
                return true
              }
              const matchesAmount = (p) => {
                const amt = Number(p.amount)
                if (pledgeAmountFilter === 'All') return true
                if (pledgeAmountFilter === 'Under 100') return amt < 100
                if (pledgeAmountFilter === '100-500') return amt >= 100 && amt <= 500
                if (pledgeAmountFilter === '500-1000') return amt > 500 && amt <= 1000
                if (pledgeAmountFilter === 'Over 1000') return amt > 1000
                return true
              }
              const searchedPledges = pledges.filter(p => matchesSearch(p) && matchesUrgency(p) && matchesAmount(p))

              const outstanding = searchedPledges.filter(p => p.status === 'pending')
              const fulfilled = searchedPledges.filter(p => p.status === 'fulfilled')
              const cancelled = searchedPledges.filter(p => p.status === 'cancelled')

              return (
                <>
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.forest, marginBottom: 12 }}>Outstanding Pledges ({outstanding.length})</div>
                    {outstanding.length === 0 ? (
                      <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 20px', fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No outstanding pledges.</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
                        {outstanding.map(renderPledgeCard)}
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: 32 }}>
                    <div
                      style={{ fontSize: 13, fontWeight: 500, color: C.forest, marginBottom: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                      onClick={() => setShowFulfilledPledges(v => !v)}
                    >
                      <span style={{ fontSize: 11, color: C.muted }}>{showFulfilledPledges ? '▾' : '▸'}</span>
                      Fulfilled Pledges ({fulfilled.length})
                    </div>
                    {showFulfilledPledges && (
                      fulfilled.length === 0 ? (
                        <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 20px', fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No fulfilled pledges yet.</div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
                          {fulfilled.map(renderPledgeCard)}
                        </div>
                      )
                    )}
                  </div>

                  {cancelled.length > 0 && (
                    <div>
                      <div
                        style={{ fontSize: 13, fontWeight: 500, color: C.muted, marginBottom: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                        onClick={() => setShowCancelledPledges(v => !v)}
                      >
                        <span style={{ fontSize: 11, color: C.muted }}>{showCancelledPledges ? '▾' : '▸'}</span>
                        Cancelled ({cancelled.length})
                      </div>
                      {showCancelledPledges && (
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
                          {cancelled.map(renderPledgeCard)}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        )}

        {/* ── MASS APPEAL ── */}
        {activeTab === 'massappeal' && (
          <div style={s.content}>
            <div style={s.pageHeader}>
              <div>
                <div style={s.pageTitle}>Mass Appeal</div>
                <div style={s.pageSub}>{massAppeals.length} appeal{massAppeals.length !== 1 ? 's' : ''} sent · Personal PayNow QR codes to your donor base</div>
              </div>
              <button style={s.btnGold} onClick={() => { setMassAppealStep('setup'); setMassAppealForm({ cause_id: '', amount: '', message: '', customLabel: '' }); setMassAppealRefs([]); setShowMassAppealModal(true) }}>+ New Appeal</button>
            </div>

            {massAppeals.length > 0 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
                <input style={{ ...s.searchBox, flex: 'none', width: isMobile ? '100%' : 380 }} placeholder="🔍 Search by campaign name or message..." value={massAppealSearchTerm} onChange={e => setMassAppealSearchTerm(e.target.value)} />
                <select style={{ ...s.formInput, width: isMobile ? '100%' : 160 }} value={massAppealYearFilter} onChange={e => setMassAppealYearFilter(e.target.value)}>
                  <option value="All">All years</option>
                  {[...new Set(massAppeals.map(a => new Date(a.created_at).getFullYear()))].sort((a, b) => b - a).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                {(massAppealSearchTerm !== '' || massAppealYearFilter !== 'All') && (
                  <button style={{ ...s.viewBtn, whiteSpace: 'nowrap' }} onClick={() => { setMassAppealSearchTerm(''); setMassAppealYearFilter('All') }}>✕ Clear Filters</button>
                )}
                <button style={isMobile ? { ...s.exportSmallBtn, width: '100%' } : s.exportSmallBtn} onClick={() => {
                  const q = massAppealSearchTerm.toLowerCase().trim()
                  const filtered = massAppeals.filter(a => {
                    const matchesSearch = !q || [a.cause_name, a.message].some(f => f?.toLowerCase().includes(q))
                    const matchesYear = massAppealYearFilter === 'All' || new Date(a.created_at).getFullYear().toString() === massAppealYearFilter
                    return matchesSearch && matchesYear
                  })
                  exportMassAppealsExcel(filtered)
                }}>⬇️ Export to Excel</button>
              </div>
            )}

            {massAppeals.length === 0 ? (
              <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 20px', fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No appeals sent yet — click "+ New Appeal" to get started.</div>
            ) : (() => {
              const searchedAppeals = massAppeals.filter(a => {
                const q = massAppealSearchTerm.toLowerCase().trim()
                const matchesSearch = !q || [a.cause_name, a.message].some(f => f?.toLowerCase().includes(q))
                const matchesYear = massAppealYearFilter === 'All' || new Date(a.created_at).getFullYear().toString() === massAppealYearFilter
                return matchesSearch && matchesYear
              })
              const byYear = {}
              searchedAppeals.forEach(a => {
                const y = new Date(a.created_at).getFullYear()
                if (!byYear[y]) byYear[y] = []
                byYear[y].push(a)
              })
              const years = Object.keys(byYear).map(Number).sort((a, b) => b - a)

              const renderAppealCard = (a) => (
                <div key={a.id} style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', cursor: 'pointer', display: 'flex', flexDirection: 'column' }} onClick={() => openAppealDetail(a)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: C.forest }}>{a.cause_name || 'General Appeal'}</div>
                    {a.failed_count > 0 ? (
                      <span style={{ fontSize: 10, fontWeight: 500, color: C.gold, background: C.gold + '1A', border: `1px solid ${C.gold}`, borderRadius: 20, padding: '3px 10px' }}>⚠ Partial</span>
                    ) : (
                      <span style={s.badgeIssued}>✓ Sent</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>
                    {new Date(a.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                    <div style={{ fontFamily: C.fontVoice, fontSize: 20, fontWeight: 500, color: C.forest }}>${Number(a.amount).toLocaleString()}</div>
                    <div style={{ fontSize: 11.5, color: C.muted }}>suggested amount asked per donor</div>
                  </div>
                  {a.message && (
                    <div style={{ fontSize: 11.5, color: C.muted, fontStyle: 'italic', marginTop: 6, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      "{a.message}"
                    </div>
                  )}
                  <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: `1px solid ${C.border}`, fontSize: 11.5, color: C.muted }}>
                    <span style={{ color: C.sage, fontWeight: 500 }}>{a.sent_count} sent</span>
                    {a.failed_count > 0 && <span style={{ color: C.red, fontWeight: 500 }}> · {a.failed_count} failed</span>}
                    {' · '}{a.donor_count} total
                  </div>
                  <div style={{ fontSize: 10.5, color: C.muted, marginTop: 8, textAlign: 'center' }}>Click for full details →</div>
                </div>
              )

              return (
                <div>
                  {years.map(year => {
                    const isExpanded = expandedAppealYears.has(year)
                    return (
                      <div key={year} style={{ marginBottom: 24 }}>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: isExpanded ? 12 : 0 }}
                          onClick={() => setExpandedAppealYears(prev => {
                            const next = new Set(prev)
                            if (next.has(year)) next.delete(year); else next.add(year)
                            return next
                          })}
                        >
                          <span style={{ fontSize: 11, color: C.muted }}>{isExpanded ? '▾' : '▸'}</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: C.forest }}>{year}</span>
                          <span style={{ fontSize: 12, color: C.muted }}>({byYear[year].length} appeal{byYear[year].length !== 1 ? 's' : ''})</span>
                        </div>
                        {isExpanded && (
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
                            {byYear[year].map(renderAppealCard)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {showMassAppealModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
                <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>
                      {massAppealStep === 'setup' ? 'New Appeal' : massAppealStep === 'preview' && !massAppealProgress ? `${massAppealRefs.filter(r => r.selected).length} donors selected` : massAppealProgress ? 'Sending appeals...' : 'Appeal sent'}
                    </div>
                    {!massAppealProgress && (
                      <span style={{ cursor: 'pointer', color: C.muted, fontSize: 18 }} onClick={() => { setShowMassAppealModal(false); setMassAppealStep('setup') }}>✕</span>
                    )}
                  </div>

                  {/* Setup form */}
                  {massAppealStep === 'setup' && !massAppealProgress && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                      <div>
                        <div style={s.formLabel}>Campaign (Optional)</div>
                        <select style={s.formInput} value={massAppealForm.cause_id} onChange={e => setMassAppealForm(f => ({ ...f, cause_id: e.target.value }))}>
                          <option value="">No specific campaign — give it a name below</option>
                          {myCauses.filter(c => c.status === 'approved' && c.type === 'campaign').map(c => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                          ))}
                        </select>
                        {!massAppealForm.cause_id && (
                          <div style={{ marginTop: 8 }}>
                            <input
                              style={s.formInput}
                              placeholder="e.g. Q1 Appeal, Year-End Appeal, Chinese New Year Appeal"
                              value={massAppealForm.customLabel || ''}
                              onChange={e => setMassAppealForm(f => ({ ...f, customLabel: e.target.value }))}
                            />
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Not tied to a tracked campaign — just a label to tell your appeals apart. Leave blank for "General Appeal."</div>
                          </div>
                        )}
                      </div>
                      <div>
                        <div style={s.formLabel}>Default Amount (SGD) *</div>
                        <input style={s.formInput} type="number" placeholder="e.g. 50" value={massAppealForm.amount} onChange={e => setMassAppealForm(f => ({ ...f, amount: e.target.value }))} />
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Each donor's QR will be pre-filled with this amount</div>
                      </div>
                      <div>
                        <div style={s.formLabel}>Personal Message (Optional)</div>
                        <textarea style={{ ...s.formInput, minHeight: 100, resize: 'vertical' }} placeholder="e.g. Hi [name], we're reaching out for our year-end appeal..." value={massAppealForm.message} onChange={e => setMassAppealForm(f => ({ ...f, message: e.target.value }))} />
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Appears in the email above the QR code. Type <strong>[name]</strong> anywhere to insert each donor's first name automatically.</div>
                      </div>
                      <div>
                        <div style={s.formLabel}>Send only to donors tagged (Optional)</div>
                        <select style={s.formInput} value={massAppealForm.targetTag || 'All'} onChange={e => setMassAppealForm(f => ({ ...f, targetTag: e.target.value }))}>
                          <option value="All">Everyone with email on file</option>
                          {[...new Set(Object.values(donorTagsMap).flat().map(t => t.tag))].sort().map(tag => (
                            <option key={tag} value={tag}>{tag}</option>
                          ))}
                        </select>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Use this to send targeted updates — e.g. tag donors by programme interest and reach just that group instead of everyone.</div>
                      </div>
                      <div style={{ background: C.successBg, border: `1px solid ${C.sage}`, borderRadius: 6, padding: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: C.forest, marginBottom: 4 }}>Who will receive this?</div>
                        <div style={{ fontSize: 13, color: C.forest }}><strong>{donorList.filter(d => {
                          if (d.deactivated || !d.email?.trim()) return false
                          if (massAppealForm.targetTag && massAppealForm.targetTag !== 'All') {
                            const dk45 = d.email?.trim() || d.name
                            return (donorTagsMap[dk45] || []).some(t => t.tag === massAppealForm.targetTag)
                          }
                          return true
                        }).length}</strong> donor{(donorList.filter(d => {
                          if (d.deactivated || !d.email?.trim()) return false
                          if (massAppealForm.targetTag && massAppealForm.targetTag !== 'All') {
                            const dk45b = d.email?.trim() || d.name
                            return (donorTagsMap[dk45b] || []).some(t => t.tag === massAppealForm.targetTag)
                          }
                          return true
                        }).length) !== 1 ? 's' : ''} with email on file{massAppealForm.targetTag && massAppealForm.targetTag !== 'All' ? ` tagged "${massAppealForm.targetTag}"` : ''}</div>
                        {donorList.filter(d => !d.deactivated && !d.email?.trim()).length > 0 && (
                          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{donorList.filter(d => !d.deactivated && !d.email?.trim()).length} donors without email excluded — downloadable via QR ZIP</div>
                        )}
                      </div>
                      <button style={{ ...s.btnForest, justifyContent: 'center' }} onClick={generateMassAppealRefs}>Next — Preview Donor List →</button>
                    </div>
                  )}

                  {/* Preview step */}
                  {massAppealStep === 'preview' && !massAppealProgress && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} onClick={() => setMassAppealRefs(prev => prev.map(r => ({ ...r, selected: true })))}>Select All</button>
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} onClick={() => setMassAppealRefs(prev => prev.map(r => ({ ...r, selected: false })))}>Deselect All</button>
                      </div>
                      <div style={{ maxHeight: 320, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 16 }}>
                        {massAppealRefs.map((r, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${C.ivoryDark}`, background: r.selected ? C.white : C.ivoryDark }}>
                            <input type="checkbox" checked={r.selected} onChange={() => setMassAppealRefs(prev => prev.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: C.forest }}>{r.donor_name}</div>
                              <div style={{ fontSize: 11, color: C.muted }}>{r.donor_email} · Ref: {r.ref}</div>
                              {r.restrictionNote && <div style={{ fontSize: 11, color: C.warning, marginTop: 2 }}>⚠ Deselected — restriction on file: "{r.restrictionNote}"</div>}
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.forest, flexShrink: 0 }}>${r.amount}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                        <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => setShowAppealPreview(true)}>👁 Preview Email</button>
                        <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} disabled={sendingTestAppeal} onClick={sendTestAppealToSelf}>
                          {sendingTestAppeal ? 'Sending...' : '✉ Send Test to Myself'}
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} onClick={sendMassAppealEmails}>📧 Send to {massAppealRefs.filter(r => r.selected).length} Donors</button>
                        <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={downloadMassAppealQRZip}>⬇️ Download QR ZIP</button>
                      </div>
                    </div>
                  )}

                  {/* Sending progress */}
                  {massAppealProgress && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ background: C.ivoryDark, borderRadius: 6, height: 12, overflow: 'hidden', marginBottom: 8 }}>
                        <div style={{ width: `${(massAppealProgress.done / massAppealProgress.total) * 100}%`, height: '100%', background: C.sage, borderRadius: 6, transition: 'width 0.3s' }} />
                      </div>
                      <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
                        {massAppealProgress.done} of {massAppealProgress.total} · {massAppealProgress.sent} sent · {massAppealProgress.failed} failed{massAppealProgress.blocked > 0 ? ` · ${massAppealProgress.blocked} skipped (Do Not Contact)` : ''}
                      </div>
                      <button style={{ ...s.viewBtn, color: C.red, borderColor: C.red }} onClick={() => { massAppealCancelRef.current = true }}>✕ Cancel</button>
                    </div>
                  )}

                  {/* Done */}
                  {massAppealStep === 'done' && !massAppealProgress && (
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                      <div style={{ fontSize: 34, marginBottom: 10 }}>✓</div>
                      <div style={{ fontSize: 16, fontWeight: 500, color: C.forest, marginBottom: 6 }}>Appeal Sent</div>
                      <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Each donor received a personalised email with their unique PayNow QR code.</div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} onClick={() => { setMassAppealStep('setup'); setMassAppealForm({ cause_id: '', amount: '', message: '', customLabel: '' }); setMassAppealRefs([]) }}>Send Another</button>
                        <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => { setShowMassAppealModal(false); setMassAppealStep('setup') }}>Done</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── GRANTS ── */}
        {activeTab === 'grants' && (
          <div style={s.content}>
            <div style={s.pageHeader}>
              <div>
                <div style={s.pageTitle}>Grants & Restricted Funds</div>
                <div style={s.pageSub}>{grants.filter(g => g.status === 'active').length} active grant{grants.filter(g => g.status === 'active').length !== 1 ? 's' : ''}</div>
              </div>
              <button style={s.btnGold} onClick={() => setShowGrantForm(true)}>+ Record Grant</button>
            </div>

            {showGrantForm && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowGrantForm(false)}>
              <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.forest }}>🏛️ New Grant</div>
                  <button style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer' }} onClick={() => setShowGrantForm(false)}>✕</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <div style={s.formLabel}>Funder Name *</div>
                    <input style={s.formInput} value={grantForm.funder_name} onChange={e => setGrantForm(f => ({ ...f, funder_name: e.target.value }))} />
                  </div>
                  <div>
                    <div style={s.formLabel}>Grant Amount (SGD) *</div>
                    <input style={s.formInput} type="number" value={grantForm.amount} onChange={e => setGrantForm(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                  <div>
                    <div style={s.formLabel}>Disbursement Schedule</div>
                    <input style={s.formInput} placeholder="e.g. 3 tranches over 12 months" value={grantForm.disbursement_schedule} onChange={e => setGrantForm(f => ({ ...f, disbursement_schedule: e.target.value }))} />
                  </div>
                  <div>
                    <div style={s.formLabel}>Grant Start Date</div>
                    <input style={s.formInput} type="date" value={grantForm.start_date} onChange={e => setGrantForm(f => ({ ...f, start_date: e.target.value }))} />
                  </div>
                  <div>
                    <div style={s.formLabel}>Report Due Date</div>
                    <input style={s.formInput} type="date" value={grantForm.report_due_date} onChange={e => setGrantForm(f => ({ ...f, report_due_date: e.target.value }))} />
                  </div>
                  <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1' }}>
                    <div style={s.formLabel}>Purpose Restriction</div>
                    <textarea style={{ ...s.formInput, minHeight: 60, resize: 'vertical' }} placeholder="e.g. Must be spent on tutoring program costs, not administrative overhead" value={grantForm.purpose_restriction} onChange={e => setGrantForm(f => ({ ...f, purpose_restriction: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={s.btnForest} onClick={saveGrant}>Save Grant</button>
                  <button style={s.viewBtn} onClick={() => setShowGrantForm(false)}>Cancel</button>
                </div>
              </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
              <input style={{ ...s.searchBox, flex: 'none', width: isMobile ? '100%' : 380 }} placeholder="🔍 Search grants by funder name..." value={grantSearchTerm} onChange={e => setGrantSearchTerm(e.target.value)} />
              <select style={{ ...s.formInput, width: isMobile ? '100%' : 180 }} value={grantUrgencyFilter} onChange={e => setGrantUrgencyFilter(e.target.value)}>
                <option value="All">All grants</option>
                <option value="Overdue">Report overdue</option>
                <option value="Due Soon">Report due soon (60d)</option>
                <option value="Healthy">No urgent report</option>
              </select>
              <select style={{ ...s.formInput, width: isMobile ? '100%' : 160 }} value={grantAmountFilter} onChange={e => setGrantAmountFilter(e.target.value)}>
                <option value="All">All amounts</option>
                <option value="Under 20000">Under $20,000</option>
                <option value="20000-100000">$20,000 – $100,000</option>
                <option value="100000-250000">$100,000 – $250,000</option>
                <option value="Over 250000">Over $250,000</option>
              </select>
              <select style={{ ...s.formInput, width: isMobile ? '100%' : 130 }} value={grantYearFilter} onChange={e => setGrantYearFilter(e.target.value)}>
                <option value="All">All years</option>
                {[...new Set(grants.map(g => new Date(g.start_date || g.created_at).getFullYear()))].sort((a, b) => b - a).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              {(grantSearchTerm !== '' || grantUrgencyFilter !== 'All' || grantAmountFilter !== 'All' || grantYearFilter !== 'All') && (
                <button style={s.viewBtn} onClick={() => { setGrantSearchTerm(''); setGrantUrgencyFilter('All'); setGrantAmountFilter('All'); setGrantYearFilter('All') }}>✕ Clear Filters</button>
              )}
              <button style={isMobile ? { ...s.exportSmallBtn, width: '100%' } : s.exportSmallBtn} onClick={() => {
                const q = grantSearchTerm.toLowerCase().trim()
                const filtered = grants.filter(g => {
                  const matchesSearch = q === '' || g.funder_name.toLowerCase().includes(q)
                  const days = g.report_due_date ? Math.ceil((new Date(g.report_due_date) - new Date()) / (1000 * 60 * 60 * 24)) : null
                  const matchesUrgency = grantUrgencyFilter === 'All'
                    || (grantUrgencyFilter === 'Overdue' && days !== null && days < 0)
                    || (grantUrgencyFilter === 'Due Soon' && days !== null && days >= 0 && days <= 60)
                    || (grantUrgencyFilter === 'Healthy' && (days === null || days > 60))
                  const amt = Number(g.amount)
                  const matchesAmount = grantAmountFilter === 'All'
                    || (grantAmountFilter === 'Under 20000' && amt < 20000)
                    || (grantAmountFilter === '20000-100000' && amt >= 20000 && amt <= 100000)
                    || (grantAmountFilter === '100000-250000' && amt > 100000 && amt <= 250000)
                    || (grantAmountFilter === 'Over 250000' && amt > 250000)
                  const matchesYear = grantYearFilter === 'All' || new Date(g.start_date || g.created_at).getFullYear().toString() === grantYearFilter
                  return matchesSearch && matchesUrgency && matchesAmount && matchesYear
                })
                exportGrantsExcel(filtered)
              }}>⬇️ Export to Excel</button>
            </div>

            {(() => {
              const filteredGrants = grants.filter(g => {
                const q = grantSearchTerm.toLowerCase().trim()
                const matchesSearch = q === '' || g.funder_name.toLowerCase().includes(q)
                const days = g.report_due_date ? Math.ceil((new Date(g.report_due_date) - new Date()) / (1000 * 60 * 60 * 24)) : null
                const matchesUrgency = grantUrgencyFilter === 'All'
                  || (grantUrgencyFilter === 'Overdue' && days !== null && days < 0)
                  || (grantUrgencyFilter === 'Due Soon' && days !== null && days >= 0 && days <= 60)
                  || (grantUrgencyFilter === 'Healthy' && (days === null || days > 60))
                const amt = Number(g.amount)
                const matchesAmount = grantAmountFilter === 'All'
                  || (grantAmountFilter === 'Under 20000' && amt < 20000)
                  || (grantAmountFilter === '20000-100000' && amt >= 20000 && amt <= 100000)
                  || (grantAmountFilter === '100000-250000' && amt > 100000 && amt <= 250000)
                  || (grantAmountFilter === 'Over 250000' && amt > 250000)
                const matchesYear = grantYearFilter === 'All' || new Date(g.start_date || g.created_at).getFullYear().toString() === grantYearFilter
                return matchesSearch && matchesUrgency && matchesAmount && matchesYear
              })

              const activeGrants = filteredGrants.filter(g => g.status === 'active')
              const pastGrants = filteredGrants.filter(g => g.status !== 'active')

              const statusBadge = (status) => {
                const map = {
                  active: { bg: '#EAF3DE', color: '#27500A', label: 'Active' },
                  completed: { bg: C.ivory, color: C.muted, label: 'Completed' },
                  closed: { bg: C.ivory, color: C.muted, label: 'Closed' },
                }
                const m = map[status] || { bg: C.ivory, color: C.muted, label: status }
                return <span style={{ fontSize: 10.5, fontWeight: 500, padding: '2px 8px', borderRadius: 4, background: m.bg, color: m.color }}>{m.label}</span>
              }

              const renderGrantCard = (g) => {
                const daysToReport83 = g.report_due_date ? Math.ceil((new Date(g.report_due_date) - new Date()) / (1000 * 60 * 60 * 24)) : null
                const isReportSoon83 = daysToReport83 !== null && daysToReport83 <= 60 && daysToReport83 >= 0
                const isReportOverdue83 = daysToReport83 !== null && daysToReport83 < 0
                const isHighlighted = highlightedGrantId === g.id
                const myExpenses84 = grantExpenses.filter(e => e.grant_id === g.id)
                const spent84 = myExpenses84.reduce((s, e) => s + Number(e.amount), 0)
                const remaining84 = Number(g.amount) - spent84
                const pctUtilized = Number(g.amount) > 0 ? Math.min(100, Math.round((spent84 / Number(g.amount)) * 100)) : 0
                const isExpanded84 = expandedGrantId === g.id
                return (
                  <div key={g.id} id={`grant-card-${g.id}`} style={{ background: isHighlighted ? C.successBg : C.white, border: `1px solid ${isHighlighted ? C.sage : C.border}`, borderRadius: 4, padding: '16px 18px', transition: 'background 0.3s, border-color 0.3s' }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: C.forest, marginBottom: 6 }}>{g.funder_name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      {statusBadge(g.status)}
                      <div style={{ fontFamily: C.fontVoice, fontSize: 16, fontWeight: 500, color: C.forest }}>${Number(g.amount).toLocaleString()}</div>
                    </div>
                    {g.disbursement_schedule && <div style={{ fontSize: 12, color: C.text, marginBottom: 4 }}>{g.disbursement_schedule}</div>}
                    {g.purpose_restriction && <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic', marginBottom: 10 }}>{g.purpose_restriction}</div>}
                    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Start date</div>
                        <div style={{ fontSize: 12.5, color: C.text }}>{g.start_date ? new Date(g.start_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Report due</div>
                        {g.report_due_date ? (
                          <div style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 500, padding: '3px 8px', borderRadius: 4, background: isReportOverdue83 ? '#FBEEE9' : isReportSoon83 ? C.warningBg : C.ivory, color: isReportOverdue83 ? C.red : isReportSoon83 ? C.warning : C.muted, border: `1px solid ${isReportOverdue83 ? '#E0BBA9' : isReportSoon83 ? C.warningBorder : C.border}` }}>
                            {isReportOverdue83 ? `⚠ Overdue since ${new Date(g.report_due_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}` : new Date(g.report_due_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        ) : <div style={{ fontSize: 12.5, color: C.muted }}>—</div>}
                      </div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: C.muted }}>${spent84.toLocaleString()} utilized</span>
                        <span style={{ fontSize: 11, fontWeight: 500, color: C.text }}>{pctUtilized}%</span>
                      </div>
                      <div style={{ background: C.ivory, borderRadius: 3, height: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${pctUtilized}%`, height: '100%', background: remaining84 < 0 ? C.red : C.sage }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', flex: 1, justifyContent: 'center' }} onClick={() => setExpandedGrantId(isExpanded84 ? null : g.id)}>{isExpanded84 ? '▲ Hide ledger' : '▼ View ledger'}</button>
                      <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', flex: 1, justifyContent: 'center' }} onClick={() => exportGrantReportPDF(g)}>📄 Export report</button>
                    </div>
                    {isExpanded84 && (
                      <div style={{ marginTop: 8, paddingTop: 10, borderTop: `1px dashed ${C.border}` }}>
                        {myExpenses84.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                            {myExpenses84.map(e => (
                              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, borderRadius: 4, padding: '6px 10px', fontSize: 12 }}>
                                <span style={{ color: C.text }}>{e.description} <span style={{ color: C.muted }}>· {new Date(e.expense_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}</span></span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontWeight: 500, color: C.forest }}>${Number(e.amount).toLocaleString()}</span>
                                  <span style={{ color: C.muted, cursor: 'pointer' }} onClick={() => deleteGrantExpense(e.id)}>✕</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input style={{ ...s.formInput, fontSize: 12, flex: 2 }} placeholder="Description" value={grantExpenseForm.description} onChange={e => setGrantExpenseForm(f => ({ ...f, description: e.target.value }))} />
                          <input style={{ ...s.formInput, fontSize: 12, flex: 1 }} type="number" placeholder="Amount" value={grantExpenseForm.amount} onChange={e => setGrantExpenseForm(f => ({ ...f, amount: e.target.value }))} />
                          <input style={{ ...s.formInput, fontSize: 12, flex: 1 }} type="date" value={grantExpenseForm.expense_date} onChange={e => setGrantExpenseForm(f => ({ ...f, expense_date: e.target.value }))} />
                          <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} onClick={() => saveGrantExpense(g.id)}>Add</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              }

              if (filteredGrants.length === 0) {
                return <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>{grants.length === 0 ? 'No grants recorded yet.' : 'No grants match your filters.'}</div>
              }

              return (
                <>
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.forest, marginBottom: 12 }}>Active Grants ({activeGrants.length})</div>
                    {activeGrants.length === 0 ? (
                      <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 20px', fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No active grants right now.</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
                        {activeGrants.map(renderGrantCard)}
                      </div>
                    )}
                  </div>

                  {pastGrants.length > 0 && (
                    <div>
                      <div
                        style={{ fontSize: 13, fontWeight: 500, color: C.muted, marginBottom: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                        onClick={() => setShowPastGrants(v => !v)}
                      >
                        <span style={{ fontSize: 11, color: C.muted }}>{showPastGrants ? '▾' : '▸'}</span>
                        Completed / Closed Grants ({pastGrants.length})
                      </div>
                      {showPastGrants && (
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
                          {pastGrants.map(renderGrantCard)}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        )}

        {/* ── REPORTS ── */}
        {activeTab === 'reports' && (
          <div style={s.content}>
            <div style={s.pageHeader}>
              <div>
                <div style={s.pageTitle}>📋 Reports</div>
                <div style={s.pageSub}>Annual returns, board reports, and compliance exports</div>
              </div>
            </div>

            {/* COC Annual Return */}
            <div style={{ ...s.card, marginBottom: 16 }}>
              <div style={s.cardTitle}>🏛️ COC Annual Return</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
                Summary of donations by financial year for your Commissioner of Charities annual submission.
              </div>
              {(() => {
                const years = [...new Set(donations.map(d => new Date(d.created_at).getFullYear()))].sort((a, b) => b - a)
                if (years.length === 0) return <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No donation data yet.</div>
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {years.map(year => {
                      const yearDonations = donations.filter(d => new Date(d.created_at).getFullYear() === year && d.payment_status === 'confirmed')
                      const total = yearDonations.reduce((s, d) => s + d.amount, 0)
                      const uniqueDonors = new Set(yearDonations.map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name)).size
                      return (
                        <div key={year} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, borderRadius: 10, padding: '14px 16px', border: `1px solid ${C.border}` }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.forest }}>FY {year}</div>
                            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{yearDonations.length} donations · {uniqueDonors} unique donors</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: C.forest }}>SGD ${total.toLocaleString()}</div>
                            <button style={s.exportSmallBtn} onClick={() => {
                              const rows = yearDonations.map(d => [
                                new Date(d.created_at).toLocaleDateString('en-SG'),
                                d.donor_name,
                                d.donor_email || '',
                                d.amount,
                                d.payment_method || '',
                                d.receipt_number || d.payment_ref || '',
                                d.receipt_issued ? 'Yes' : 'No',
                              ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
                              const csv = ['Date,Donor Name,Email,Amount,Payment Method,Receipt No.,Receipt Issued', ...rows].join('\n')
                              const blob = new Blob([csv], { type: 'text/csv' })
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `${charityName}-COC-Annual-Return-${year}.csv`
                              a.click()
                              URL.revokeObjectURL(url)
                              showToast(`FY ${year} annual return exported ✓`)
                            }}>⬇️ Export CSV</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>

            {/* Board Report */}
            <div style={{ ...s.card, marginBottom: 16 }}>
              <div style={s.cardTitle}>📊 Board Report</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
                A full analytics snapshot formatted for your board meeting — financial summary, donor insights, campaign performance, and health check.
              </div>
              <button style={s.btnForest} onClick={exportAnalyticsPDF}>📄 Download Board Packet PDF</button>
            </div>

            {/* One-Page Quarterly Summary */}
            <div style={{ ...s.card, marginBottom: 16 }}>
              <div style={s.cardTitle}>Quarterly Board Summary</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
                A single page, paste-ready for a board deck: revenue by source and payment method, donor acquisition, retention rate, and year-on-year comparison for this quarter.
              </div>
              <button style={s.btnForest} onClick={exportQuarterlyBoardReportPDF}>📄 Download Quarterly Summary PDF</button>
            </div>

            {/* Weekly Snapshot */}
            <div style={{ ...s.card, marginBottom: 16 }}>
              <div style={s.cardTitle}>🗓️ Weekly Snapshot</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
                A quick one-page pulse for the ED — this week's donations, lapsed donors, overdue pledges, and milestones. Review before forwarding.
              </div>
              <button style={s.btnForest} onClick={exportWeeklySnapshotPDF}>📄 Download Weekly Snapshot PDF</button>
            </div>

            {/* Org-Wide Year-End Summary */}
            <div style={{ ...s.card, marginBottom: 16 }}>
              <div style={s.cardTitle}>Organisation Year-End Summary</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
                One report covering your whole organisation's year — totals, busiest month, and top supporters.
              </div>
              <button style={s.btnForest} onClick={exportYearEndSummary}>📄 Download Year-End Summary PDF</button>
            </div>

            {/* Per-Donor Year-End Statements */}
            <div style={{ ...s.card, marginBottom: 16 }}>
              <div style={s.cardTitle}>Donor Year-End Statements</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
                A personal annual statement for every donor — every gift with date, amount, and receipt number. Generated as one PDF per donor, downloaded together as a zip.
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <select style={s.filterSelect} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                  <option value="All">Select a year</option>
                  {[...new Set(donations.map(d => new Date(d.created_at).getFullYear()))].sort((a, b) => b - a).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <button style={s.btnForest} onClick={exportAllDonorYearEndStatements}>📦 Download All Statements (ZIP)</button>
                <button style={s.exportSmallBtn} onClick={exportDonorContactsCSV}>⬇️ Export Donor Contacts CSV</button>
              </div>
            </div>

            {/* IRAS Export — IPC only */}
            {charityIsIpc && (
              <div style={{ ...s.card, marginBottom: 16 }}>
                <div style={s.cardTitle}>🏛️ IRAS Tax Deduction Export</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
                  Excel export of donor NRIC and giving data for IRAS 250% tax deduction submission. Select a year before exporting.
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select style={s.filterSelect} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                    <option value="All">Select Year</option>
                    {[...new Set(donations.map(d => new Date(d.created_at).getFullYear()))].sort((a, b) => b - a).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <button style={s.btnForest} onClick={() => { if (filterYear === 'All') { showToast('Select a year first'); return } exportIRASExcel() }}>⬇️ Export IRAS Excel</button>
                </div>
              </div>
            )}

            {/* Audit Trail */}
            <div style={s.card}>
              <div style={s.cardTitle}>🗒️ Audit Trail Export</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
                Full log of all system actions — receipts issued, voids, imports, and staff activity. For auditors and compliance review.
              </div>
              <button style={s.exportSmallBtn} onClick={() => {
                const rows = auditLog.map(entry => {
                  const details = entry.details ? Object.entries(entry.details).map(([k, v]) => `${k}: ${v}`).join(' | ') : ''
                  return [
                    new Date(entry.created_at).toLocaleString('en-SG'),
                    entry.actor_email || '',
                    entry.actor_type || '',
                    entry.action || '',
                    details,
                  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
                })
                const csv = ['Timestamp,Actor Email,Actor Type,Action,Details', ...rows].join('\n')
                const blob = new Blob([csv], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${charityName}-audit-trail-${new Date().toISOString().split('T')[0]}.csv`
                a.click()
                URL.revokeObjectURL(url)
                showToast('Audit trail exported ✓')
              }}>⬇️ Export Audit Trail CSV</button>
            </div>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {activeTab === 'settings' && (
          <div style={s.content}>
            <div style={s.pageHeader}>
              <div style={s.pageTitle}>Settings</div>
            </div>
            <div style={{ maxWidth: 1000 }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 24, alignItems: 'start' }}>
              <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>Charity & Account</div>
              <div style={s.card}>
                <div style={s.cardTitle}>Charity Details</div>
                <div style={{ background: C.ivory, borderRadius: 8, border: `1px solid ${C.border}`, padding: '4px 14px', marginBottom: 12 }}>
                  {[
                    { label: 'Charity Name', value: charityName },
                    { label: 'UEN', value: charityUen },
                    { label: 'IPC Status', value: charityIsIpc ? '✓ Registered IPC' : 'Not an IPC' },
                    { label: 'Logged in as', value: session?.user?.email },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: i < 3 ? `1px solid ${C.border}` : 'none' }}>
                      <span style={{ fontSize: 11.5, color: C.muted }}>{item.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.forest, textAlign: 'right' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
                <button style={{ ...s.viewBtn, color: C.red, borderColor: C.red, width: '100%', justifyContent: 'center' }} onClick={() => supabase.auth.signOut()}>🚪 Sign Out</button>
              </div>

              <div style={{ ...s.card, marginTop: 16 }}>
                <div style={s.cardTitle}>Email Sending</div>
                {senderDomainStatus === 'verified' ? (
                  <div>
                    <div style={{ fontSize: 13, color: C.sage, fontWeight: 500, marginBottom: 8 }}>✓ Verified</div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
                      Your emails send from <strong style={{ color: C.forest }}>{senderEmailLocalPart}@{senderDomain}</strong>
                    </div>
                    <button style={s.viewBtn} onClick={() => { setSenderDomainInput(senderDomain); setShowDomainSetup(true) }}>Change domain</button>
                  </div>
                ) : senderDomainStatus === 'pending' ? (
                  <div>
                    <div style={{ fontSize: 13, color: C.gold, fontWeight: 500, marginBottom: 8 }}>⏳ Verification pending</div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
                      We're waiting for DNS records to be added for <strong style={{ color: C.forest }}>{senderDomain}</strong>. Until this is verified, your emails will send from Giving Tree with replies going to your inbox.
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={s.issueBtn} disabled={checkingVerification} onClick={checkDomainVerification}>{checkingVerification ? 'Checking...' : '↻ Check status'}</button>
                      <button style={s.viewBtn} onClick={() => { setSenderDomainInput(senderDomain); setShowDomainSetup(true) }}>View DNS records</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
                      Right now, emails to your donors send from Giving Tree's address, with replies going to your inbox. If you have your own website domain, you can set up emails to send directly from your own address instead.
                    </div>
                    <button style={s.btnForest} onClick={() => setShowDomainSetup(true)}>Set up my own domain</button>
                  </div>
                )}
              </div>

              <div style={{ ...s.card, marginTop: 16 }}>
                <div style={s.cardTitle}>Account</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
                  To delete your Giving Tree account and all associated data, email us at <span style={{ color: C.forest, fontWeight: 500 }}>hello@givingtree.sg</span> with the subject line "Account Deletion Request". We will process your request within 7 business days.
                </div>
                <a href={`mailto:hello@givingtree.sg?subject=Account Deletion Request — ${charityName}&body=Please delete the Giving Tree charity account for ${charityName} (UEN: ${charityUen}, email: ${session?.user?.email}).`}
                  style={{ ...s.viewBtn, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: C.red, borderColor: C.red }}>
                  🗑️ Request Account Deletion
                </a>
              </div>

              <div style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: C.muted, lineHeight: 2 }}>
                <a href="https://givingtree.sg/privacy" target="_blank" rel="noopener noreferrer" style={{ color: C.muted, textDecoration: 'underline' }}>Privacy Policy</a>
                {' · '}
                <a href="https://givingtree.sg/terms" target="_blank" rel="noopener noreferrer" style={{ color: C.muted, textDecoration: 'underline' }}>Terms of Use</a>
              </div>
              </div>

              <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>Operations</div>
              <div style={{ ...s.card, marginTop: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ ...s.cardTitle, marginBottom: 0 }}>Financial Year End</div>
                  {!editingFyEnd && (
                    <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px' }} onClick={() => { setFyEndMonthInput(fyEndMonth.toString()); setFyEndDayInput(fyEndDay.toString()); setEditingFyEnd(true) }}>Edit</button>
                  )}
                </div>
                {editingFyEnd ? (
                  <div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>Used to calculate your COC Annual Submission deadline (6 months after financial year end).</div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <select style={s.formInput} value={fyEndMonthInput} onChange={e => setFyEndMonthInput(e.target.value)}>
                        {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                          <option key={i} value={i + 1}>{m}</option>
                        ))}
                      </select>
                      <input style={{ ...s.formInput, width: 90 }} type="number" min="1" max="31" placeholder="Day" value={fyEndDayInput} onChange={e => setFyEndDayInput(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button style={s.issueBtn} onClick={saveFyEnd}>Save</button>
                      <button style={s.viewBtn} onClick={() => setEditingFyEnd(false)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 24, fontWeight: 800, color: C.forest }}>
                    {['January','February','March','April','May','June','July','August','September','October','November','December'][fyEndMonth - 1]} {fyEndDay}
                  </div>
                )}
              </div>

              <div style={{ ...s.card, marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ ...s.cardTitle, marginBottom: 0 }}>🎯 Annual Fundraising Goal</div>
                  {!editingGoal && (
                    <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px' }} onClick={() => { setGoalInput(annualGoal?.toString() || ''); setEditingGoal(true) }}>{annualGoal ? 'Edit' : '+ Set Goal'}</button>
                  )}
                </div>
                {editingGoal ? (
                  <div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>Total confirmed donations this calendar year are tracked against this goal on your Dashboard and Analytics pages.</div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <input style={s.formInput} type="number" placeholder="e.g. 50000" value={goalInput} onChange={e => setGoalInput(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button style={s.issueBtn} onClick={saveAnnualGoal}>Save</button>
                      <button style={s.viewBtn} onClick={() => setEditingGoal(false)}>Cancel</button>
                    </div>
                  </div>
                ) : annualGoal ? (
                  <div style={{ fontSize: 24, fontWeight: 800, color: C.forest }}>${annualGoal.toLocaleString()}</div>
                ) : (
                  <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No goal set yet — used for the progress tracker on Dashboard and Analytics.</div>
                )}
              </div>

              <div id="monthly-expenses-card" style={{ ...s.card, marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={s.cardTitle}>💸 Monthly Expenses</div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: C.forest }}>
                  {recurringExpenses.length > 0 ? `SGD $${recurringExpenses.reduce((s, e) => s + Number(e.amount), 0).toLocaleString()}/month` : <span style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>Add items below to calculate this — used for coverage ratio on dashboard</span>}
                </div>
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${C.border}` }}>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Itemised expenses — add rent, salaries, utilities, etc.</div>
                  {recurringExpenses.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                      {recurringExpenses.map(e => (
                        <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, borderRadius: 4, padding: '6px 10px' }}>
                          <span style={{ fontSize: 12.5, color: C.text }}>{e.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12.5, fontWeight: 500, color: C.forest }}>${Number(e.amount).toLocaleString()}</span>
                            <span style={{ color: C.muted, cursor: 'pointer' }} onClick={() => deleteRecurringExpense(e.id)}>✕</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input style={{ ...s.formInput, fontSize: 12, flex: 2 }} placeholder="e.g. Rent, Salaries, Utilities" value={newExpenseForm.name} onChange={e => setNewExpenseForm(f => ({ ...f, name: e.target.value }))} />
                    <input style={{ ...s.formInput, fontSize: 12, flex: 1 }} type="number" placeholder="Amount" value={newExpenseForm.amount} onChange={e => setNewExpenseForm(f => ({ ...f, amount: e.target.value }))} />
                    <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} onClick={saveRecurringExpense}>Add</button>
                  </div>
                </div>
              </div>

              <div style={{ ...s.card, marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ ...s.cardTitle, marginBottom: 0 }}>👥 Team Access</div>
                  <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px' }} onClick={() => { setVolunteerInput(''); setNewTeamMemberRole('ed'); setShowAddTeamMemberModal(true) }}>+ Add Person</button>
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
                  <strong>Executive Director</strong> sees everything. <strong>Staff</strong> has full operational access. <strong>Board Member</strong> sees dashboard trends only, no individual donor records. <strong>Volunteer</strong> can log manual entries only.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...localEds.map(e => ({ email: e, role: 'ed' })), ...localStaff.map(e => ({ email: e, role: 'staff' })), ...localBoardMembers.map(e => ({ email: e, role: 'board' })), ...localVolunteers.map(e => ({ email: e, role: 'volunteer' }))].length === 0 && (
                    <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}>No additional roles assigned yet — everyone else defaults to Staff.</div>
                  )}
                  {localEds.map(email => (
                    <div key={`ed-${email}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, borderRadius: 8, padding: '8px 12px', border: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 13, color: C.forest }}>👑 {email} <span style={{ fontSize: 10.5, color: C.muted }}>· Executive Director</span></span>
                      <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px', color: C.red, borderColor: C.red }} onClick={async () => {
                        const updated = localEds.filter(e => e !== email)
                        const { error } = await supabase.from('charity_contacts').update({ ed_emails: updated }).eq('charity_uen', charityUen)
                        if (error) { showToast('Error removing', 'error'); return }
                        setLocalEds(updated)
                        showToast('Removed')
                      }}>Remove</button>
                    </div>
                  ))}
                  {localStaff.map(email => (
                    <div key={`staff-${email}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, borderRadius: 8, padding: '8px 12px', border: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 13, color: C.forest }}>💼 {email} <span style={{ fontSize: 10.5, color: C.muted }}>· Staff</span></span>
                      <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px', color: C.red, borderColor: C.red }} onClick={async () => {
                        const updated = localStaff.filter(e => e !== email)
                        const { error } = await supabase.from('charity_contacts').update({ staff_emails: updated }).eq('charity_uen', charityUen)
                        if (error) { showToast('Error removing', 'error'); return }
                        setLocalStaff(updated)
                        showToast('Removed')
                      }}>Remove</button>
                    </div>
                  ))}
                  {localBoardMembers.map(email => (
                    <div key={`board-${email}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, borderRadius: 8, padding: '8px 12px', border: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 13, color: C.forest }}>📋 {email} <span style={{ fontSize: 10.5, color: C.muted }}>· Board Member</span></span>
                      <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px', color: C.red, borderColor: C.red }} onClick={async () => {
                        const updated = localBoardMembers.filter(e => e !== email)
                        const { error } = await supabase.from('charity_contacts').update({ board_emails: updated }).eq('charity_uen', charityUen)
                        if (error) { showToast('Error removing', 'error'); return }
                        setLocalBoardMembers(updated)
                        showToast('Removed')
                      }}>Remove</button>
                    </div>
                  ))}
                  {localVolunteers.map(email => (
                    <div key={`vol-${email}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, borderRadius: 8, padding: '8px 12px', border: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 13, color: C.forest }}>👤 {email} <span style={{ fontSize: 10.5, color: C.muted }}>· Volunteer</span></span>
                      <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px', color: C.red, borderColor: C.red }} onClick={async () => {
                        const updated = localVolunteers.filter(e => e !== email)
                        const { error } = await supabase.from('charity_contacts').update({ volunteer_emails: updated }).eq('charity_uen', charityUen)
                        if (error) { showToast('Error removing', 'error'); return }
                        setLocalVolunteers(updated)
                        showToast('Removed')
                      }}>Remove</button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ ...s.card, marginTop: 16 }}>
                <div style={s.cardTitle}>📥 Import Historical Data</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
                  Import existing donor records and transactions from a Google Sheets or Excel CSV export. Use this once during onboarding to migrate your historical data.
                </div>
                <button style={s.btnForest} onClick={() => { setShowMigrationTool(true); setMigrationPreview(null); setMigrationErrors([]); setMigrationComplete(null); setMigrationProgress(null) }}>📥 Open Migration Tool</button>
              </div>

              </div>
              </div>
            </div>
          </div>
        )}

      </div>

      

      {showMigrationTool && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => { if (!migrationProgress) setShowMigrationTool(false) }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 620, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.forest }}>Migration Tool</div>
              {!migrationProgress && <button style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer' }} onClick={() => setShowMigrationTool(false)}>✕</button>}
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
                      <input id="migration-file-input" type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) previewMigrationFile(e.target.files[0]) }} />
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
                        {Object.entries(migrationPreview.detectedColumns).map(([key, val]) => (
                          <div key={key} style={{ fontSize: 11, color: val ? C.sage : C.muted }}>
                            {val ? '✓' : '—'} {key}: <span style={{ fontFamily: 'monospace' }}>{val || 'not found'}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {migrationPreview.rowErrors.length > 0 && (
                      <div style={{ background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.warning, marginBottom: 6 }}>⚠️ {migrationPreview.totalErrors} row{migrationPreview.totalErrors !== 1 ? 's' : ''} will be skipped</div>
                        {migrationPreview.rowErrors.map((e, i) => <div key={i} style={{ fontSize: 11, color: C.warning, marginBottom: 2 }}>{e}</div>)}
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 420, width: '100%' }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.forest, marginBottom: 4 }}>Mark {showLapsedDismissModal.name} as not interested?</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              They'll be hidden from this list indefinitely. If they donate again on their own, they'll naturally reappear as an active donor — you can also restore them manually at any time.
            </div>
            <div style={{ marginBottom: 12 }}>
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
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={s.formLabel}>Additional detail (optional)</div>
              <input style={s.formInput} placeholder="e.g. Said no in person, requested no further contact" value={lapsedDismissReason} onChange={e => setLapsedDismissReason(e.target.value)} />
            </div>
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

      {showLapsedReminderModal && lapsedReminderCandidate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.forest, marginBottom: 12 }}>{lapsedReminderCandidate.givingChangeMeta ? 'Check in about decreased giving' : 'Reach out to a lapsed donor'}</div>
            {lapsedReminderCandidate.givingChangeMeta && (
              <div style={{ background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: 6, padding: '10px 12px', marginBottom: 14, fontSize: 12.5, color: C.warning, lineHeight: 1.5 }}>
                💛 This could be financial hardship, a change in circumstances, or simply a busy season — not necessarily a loss of interest. Suggested framing: a genuine check-in on how they're doing, not a question about why they gave less.
              </div>
            )}
            <SenderIdentityLine recipientName={lapsedReminderCandidate.name} recipientEmail={lapsedReminderCandidate.email} />
            <div style={{ marginBottom: 12 }}>
              <div style={s.formLabel}>Subject</div>
              <input style={s.formInput} value={lapsedReminderSubject} onChange={e => setLapsedReminderSubject(e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={s.formLabel}>Message</div>
              <textarea style={{ ...s.formInput, minHeight: 140, resize: 'vertical', fontFamily: 'inherit' }} value={lapsedReminderBody} onChange={e => setLapsedReminderBody(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={sendingLapsedReminder || !lapsedReminderCandidate.email} onClick={sendLapsedReminder}>
                {sendingLapsedReminder ? 'Sending...' : '✓ Send message'}
              </button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => { setShowLapsedReminderModal(false); setLapsedReminderCandidate(null) }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showRecurringReminderModal && recurringReminderCandidate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.forest, marginBottom: 12 }}>Send reminder</div>
            <SenderIdentityLine recipientName={recurringReminderCandidate.donor_name} recipientEmail={recurringReminderCandidate.donor_email} />
            <div style={{ marginBottom: 12 }}>
              <div style={s.formLabel}>Subject</div>
              <input style={s.formInput} value={recurringReminderSubject} onChange={e => setRecurringReminderSubject(e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={s.formLabel}>Message</div>
              <textarea style={{ ...s.formInput, minHeight: 140, resize: 'vertical', fontFamily: 'inherit' }} value={recurringReminderBody} onChange={e => setRecurringReminderBody(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={sendingRecurringReminder || !recurringReminderCandidate.donor_email} onClick={sendRecurringReminder}>
                {sendingRecurringReminder ? 'Sending...' : '✓ Send reminder'}
              </button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => { setShowRecurringReminderModal(false); setRecurringReminderCandidate(null) }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {skipCycleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 420, width: '100%' }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.forest, marginBottom: 4 }}>Skip this cycle?</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              {skipCycleModal.donor_name}'s payment for this cycle will be marked as skipped — no donation record will be created, and the schedule moves to the next expected date.
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={s.formLabel}>Reason (optional)</div>
              <input style={s.formInput} placeholder="e.g. Auto-payment failed, donor requested pause" value={skipCycleReason} onChange={e => setSkipCycleReason(e.target.value)} />
            </div>
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

      {markReceivedModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 420, width: '100%' }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.forest, marginBottom: 4 }}>Mark payment as received</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              From {markReceivedModal.donor_name} — confirm the amount received. This will create a donation record and send a thank-you email if they have one on file.
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={s.formLabel}>Amount received (SGD)</div>
              <input style={s.formInput} type="number" value={markReceivedAmount} onChange={e => setMarkReceivedAmount(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={markingReceived} onClick={confirmMarkReceived}>
                {markingReceived ? 'Recording...' : '✓ Confirm Received'}
              </button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => { setMarkReceivedModal(null); setMarkReceivedAmount('') }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDomainSetup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.forest, marginBottom: 4 }}>Set up your own sending domain</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              Enter your organization's website domain (e.g. <code>yourcharity.org.sg</code>). This is a technical step — you may want to loop in whoever manages your website or IT.
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={s.formLabel}>Your domain</div>
              <input style={s.formInput} placeholder="yourcharity.org.sg" value={senderDomainInput} onChange={e => setSenderDomainInput(e.target.value)} />
            </div>

            {!dnsRecords ? (
              <button style={{ ...s.btnForest, width: '100%', justifyContent: 'center' }} disabled={!senderDomainInput.trim() || savingDomain} onClick={registerSenderDomain}>
                {savingDomain ? 'Setting up...' : 'Continue'}
              </button>
            ) : (
              <div>
                <div style={{ fontSize: 13, color: C.forest, fontWeight: 500, marginBottom: 8 }}>Add these DNS records</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Add these to your domain's DNS settings (ask your web host or IT provider if unsure). Verification can take anywhere from a few minutes to a day.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {dnsRecords.map((rec, i) => (
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 420, width: '100%' }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.forest, marginBottom: 4 }}>Reschedule pledge</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              {rescheduleModal.donor_name}'s pledge is currently expected by {new Date(rescheduleModal.expected_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}. This updates the expected date and stops it from showing as overdue until then.
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={s.formLabel}>New expected date</div>
              <input style={s.formInput} type="date" value={rescheduleNewDate} onChange={e => setRescheduleNewDate(e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={s.formLabel}>Reason (optional)</div>
              <input style={s.formInput} placeholder="e.g. Donor requested more time, follow up in August" value={rescheduleReason} onChange={e => setRescheduleReason(e.target.value)} />
            </div>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 440, width: '100%' }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.forest, marginBottom: 4 }}>
              {pledgeResolutionModal.type === 'fulfilled' ? 'Mark this pledge as fulfilled?' : 'Cancel this pledge?'}
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              {pledgeResolutionModal.type === 'fulfilled'
                ? `This will record a real donation and link it to ${pledgeResolutionModal.pledge.donor_name}'s pledge.`
                : `The pledge of $${Number(pledgeResolutionModal.pledge.amount).toLocaleString()} from ${pledgeResolutionModal.pledge.donor_name} will be marked as cancelled. The record is kept for reference.`}
            </div>
            {pledgeResolutionModal.type === 'fulfilled' && (
              <div style={{ marginBottom: 16 }}>
                <div style={s.formLabel}>Amount Received (SGD)</div>
                <input style={s.formInput} type="number" value={fulfillAmount} onChange={e => setFulfillAmount(e.target.value)} />
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <div style={s.formLabel}>Notes (optional)</div>
              <textarea
                style={{ ...s.formInput, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }}
                placeholder={pledgeResolutionModal.type === 'fulfilled' ? 'e.g. Received via bank transfer, confirmed by phone' : 'e.g. Donor withdrew pledge, entered in error'}
                value={pledgeResolutionNotes}
                onChange={e => setPledgeResolutionNotes(e.target.value)}
              />
            </div>
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

      {selectedAppealDetail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => setSelectedAppealDetail(null)}>
          <div style={{ background: C.white, borderRadius: 8, padding: 0, maxWidth: 600, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.forest }}>{selectedAppealDetail.cause_name || 'General Appeal'}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                    {new Date(selectedAppealDetail.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })} · SGD ${Number(selectedAppealDetail.amount).toLocaleString()} default
                  </div>
                </div>
                <span style={{ cursor: 'pointer', color: C.muted, fontSize: 18 }} onClick={() => setSelectedAppealDetail(null)}>✕</span>
              </div>
              {selectedAppealDetail.message && (
                <div style={{ marginTop: 12, padding: 12, background: C.ivory, borderRadius: 6, fontSize: 12.5, color: C.text, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {selectedAppealDetail.message}
                </div>
              )}
              <button
                style={{ ...s.viewBtn, marginTop: 12, width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  setMassAppealForm({
                    cause_id: selectedAppealDetail.cause_id || '',
                    amount: String(selectedAppealDetail.amount || ''),
                    message: selectedAppealDetail.message || '',
                  })
                  setMassAppealStep('setup')
                  setMassAppealRefs([])
                  setSelectedAppealDetail(null)
                  setShowMassAppealModal(true)
                }}
              >📋 Clone this Appeal</button>
            </div>
            <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
              {loadingAppealDetail ? (
                <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>Loading recipients...</div>
              ) : appealRecipients.length === 0 ? (
                <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No recipient details available for this appeal.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {appealRecipients.map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: C.ivory, borderRadius: 4 }}>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: C.forest }}>{r.donor_name}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{r.donor_email}</div>
                      </div>
                      <span style={{
                        fontSize: 10.5, fontWeight: 500, padding: '3px 8px', borderRadius: 20,
                        color: r.status === 'sent' ? C.sage : r.status === 'blocked' ? C.gold : C.red,
                        background: r.status === 'sent' ? '#EAF3EC' : r.status === 'blocked' ? (C.gold + '1A') : '#FBEEE9',
                      }}>
                        {r.status === 'sent' ? '✓ Sent' : r.status === 'blocked' ? '🚫 Blocked' : '✕ Failed'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAppealPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => setShowAppealPreview(false)}>
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
                    <span style={{ cursor: 'pointer', color: C.muted, fontSize: 18 }} onClick={() => setShowAppealPreview(false)}>✕</span>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => setShowAddDonorModal(false)}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 460, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Add a Donor</div>
            <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 16 }}>Track someone you know but haven't received a donation from yet — a major donor prospect, or someone you met in person. They'll automatically merge with their real record once they give.</div>
            {addDonorError && <div style={{ background: C.warningBg, color: C.warning, padding: '10px 14px', borderRadius: 4, fontSize: 13, marginBottom: 12 }}>{addDonorError}</div>}
            <div style={{ marginBottom: 10 }}>
              <div style={s.formLabel}>Full Name *</div>
              <input style={s.formInput} placeholder="e.g. Tan Wei Ling" value={addDonorForm.full_name} onChange={e => setAddDonorForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={s.formLabel}>Email</div>
              <input style={s.formInput} placeholder="Optional" value={addDonorForm.email} onChange={e => setAddDonorForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <div style={s.formLabel}>Notes</div>
              <textarea style={{ ...s.formInput, minHeight: 70, resize: 'vertical' }} placeholder="e.g. Met at gala dinner, interested in Winter Cancer Drive" value={addDonorForm.notes} onChange={e => setAddDonorForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={savingDonorContact} onClick={saveDonorContact}>{savingDonorContact ? 'Saving...' : '✓ Add Donor'}</button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => setShowAddDonorModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showManualPledgeLinkModal && selectedDonation && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 480, width: '100%' }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.forest, marginBottom: 4 }}>Link this donation to a pledge</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              ${Number(selectedDonation.amount).toLocaleString()} from {selectedDonation.donor_name} — choose which pending pledge this should count toward.
            </div>
            {pledges.filter(p => p.status === 'pending').length === 0 ? (
              <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic', marginBottom: 16 }}>No pending pledges to link to.</div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <div style={s.formLabel}>Pending pledges</div>
                <select style={s.formInput} value={manualPledgeLinkSelection} onChange={e => setManualPledgeLinkSelection(e.target.value)}>
                  <option value="">Select a pledge...</option>
                  {pledges.filter(p => p.status === 'pending').map(p => (
                    <option key={p.id} value={p.id}>
                      {p.donor_name} — ${Number(p.amount).toLocaleString()} (${(pledgeGivenTotals[p.id] || 0).toLocaleString()} given so far)
                    </option>
                  ))}
                </select>
              </div>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setShowVoidModal(false)}>
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
            <div style={s.formLabel}>Reason for voiding *</div>
            <input
              style={{ ...s.formInput, marginBottom: 16 }}
              placeholder="e.g. Wrong amount entered, donor name misspelled"
              value={voidReason}
              onChange={e => setVoidReason(e.target.value)}
              autoFocus
            />
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

      {thankYouDraft && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setThankYouDraft(null)}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 520, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Thank-you note for {thankYouDraft.donor.name}</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Review and edit before sending. This won't be sent as-is.</div>
            <SenderIdentityLine recipientName={thankYouDraft.donor.name} recipientEmail={thankYouDraft.donor.email} />
            <textarea
              style={{ width: '100%', minHeight: 220, padding: '12px 14px', border: `1.5px solid ${C.sage}`, borderRadius: 10, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: C.white, color: C.text, boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6 }}
              value={thankYouDraft.text}
              onChange={e => setThankYouDraft(prev => ({ ...prev, text: e.target.value }))}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button style={{ flex: 1, background: C.ivoryDark, color: C.forest, border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setThankYouDraft(null)}>Cancel</button>
              <button
                style={{ flex: 1, background: C.forest, color: 'white', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: thankYouDraft.donor.email?.trim() ? 1 : 0.5 }}
                disabled={!thankYouDraft.donor.email?.trim()}
                onClick={async () => {
                  const { donor, badgeState, text, givingChangeMeta } = thankYouDraft
                  const { error } = await sendCharityEmail({
                    type: 'milestone_thank_you',
                    donor_name: donor.name,
                    donor_email: donor.email,
                    charity_name: charityName,
                    charity_uen: charityUen,
                    custom_message: text,
                  })
                  if (error) { showToast('Failed to send email', 'error'); return }
                  if (badgeState) await ackDonorBadges(donor, badgeState)
                  if (givingChangeMeta) {
                    const donorKey = donor.email?.trim() || donor.name
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
                  }
                  setThankYouDraft(null)
                  showToast(`Thank-you note sent to ${donor.email}`)
                }}
              >💌 {thankYouDraft.donor.email?.trim() ? 'Send' : 'No email on file'}</button>
            </div>
          </div>
        </div>
      )}

      {showCustomizeAnalytics && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setShowCustomizeAnalytics(false)}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 460, width: '100%', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.forest }}>Customize Analytics</div>
              <button style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer', lineHeight: 1 }} onClick={() => setShowCustomizeAnalytics(false)}>✕</button>
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
                    onChange={() => setCustomizeMetricsDraft(prev => prev.includes(item.key) ? prev.filter(k => k !== item.key) : [...prev, item.key])}
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

      {thankYouPreviewModal && (() => {
        const d = thankYouPreviewModal
        const previewBodyHtml = buildThankYouPreviewHtml(d, thankYouCustomMessage)
        const fullPreviewHtml = `<div style="font-family:'Segoe UI',sans-serif;padding:16px;background:#FAF7F2;">${previewBodyHtml}</div>`
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setThankYouPreviewModal(null)}>
            <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.forest }}>{d.thank_you_sent ? 'Send this email again?' : 'Send thank-you email'}</div>
                <button style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer' }} onClick={() => setThankYouPreviewModal(null)}>✕</button>
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
                {d.thank_you_sent ? 'A thank-you was already sent for this donation. ' : ''}Sending to <strong>{d.donor_email}</strong> · Receipt PDF will be attached
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={s.formLabel}>Add a personal message (optional)</div>
                <textarea
                  style={{ ...s.formInput, minHeight: 70, resize: 'vertical' }}
                  placeholder="This appears inside the email preview below as you type. Leave blank to send the template as-is."
                  value={thankYouCustomMessage}
                  onChange={e => setThankYouCustomMessage(e.target.value)}
                />
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Email Preview</div>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                <iframe
                  srcDoc={fullPreviewHtml}
                  style={{ width: '100%', height: 340, border: 'none', display: 'block' }}
                  title="Email preview"
                />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={sendingThankYouId === d.id} onClick={async () => { setThankYouPreviewModal(null); await sendThankYouEmail(d) }}>
                  {sendingThankYouId === d.id ? 'Sending...' : (d.thank_you_sent ? 'Send again' : 'Send email')}
                </button>
                <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => setThankYouPreviewModal(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )
      })()}

      {volunteerEditEntry && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setVolunteerEditEntry(null)}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 440, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.forest }}>Your Entry</div>
              <button style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer' }} onClick={() => setVolunteerEditEntry(null)}>✕</button>
            </div>
            {volunteerEditEntry.payment_status === 'confirmed' ? (
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
                This entry has already been confirmed and receipted by staff, so it can no longer be edited here. If something needs to change, please contact a staff member.
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <div style={s.formLabel}>Donor Name</div>
                  <input style={s.formInput} value={volunteerEditForm.donor_name} onChange={e => setVolunteerEditForm(f => ({ ...f, donor_name: e.target.value }))} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={s.formLabel}>Amount (SGD)</div>
                  <input style={s.formInput} type="number" value={volunteerEditForm.amount} onChange={e => setVolunteerEditForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={s.formLabel}>Date</div>
                  <input style={s.formInput} type="date" value={volunteerEditForm.date} onChange={e => setVolunteerEditForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <div style={s.formLabel}>Notes</div>
                  <textarea style={{ ...s.formInput, minHeight: 60, resize: 'vertical' }} value={volunteerEditForm.notes} onChange={e => setVolunteerEditForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} onClick={async () => {
                    if (!volunteerEditForm.donor_name.trim() || !volunteerEditForm.amount) { showToast('Name and amount are required', 'error'); return }
                    const { error } = await supabase.from('donations').update({
                      donor_name: volunteerEditForm.donor_name.trim(),
                      amount: parseFloat(volunteerEditForm.amount),
                      created_at: volunteerEditForm.date,
                      notes: volunteerEditForm.notes,
                    }).eq('id', volunteerEditEntry.id)
                    if (error) { showToast('Error saving', 'error'); return }
                    setDonations(prev => prev.map(d => d.id === volunteerEditEntry.id ? { ...d, donor_name: volunteerEditForm.donor_name.trim(), amount: parseFloat(volunteerEditForm.amount), created_at: volunteerEditForm.date, notes: volunteerEditForm.notes } : d))
                    setVolunteerEditEntry(null)
                    showToast('Updated ✓')
                  }}>Save</button>
                  <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => setVolunteerEditEntry(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showAddTeamMemberModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowAddTeamMemberModal(false)}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.forest }}>Add Team Member</div>
              <button style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer' }} onClick={() => setShowAddTeamMemberModal(false)}>✕</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={s.formLabel}>Email</div>
              <input style={s.formInput} placeholder="email@address.com" value={volunteerInput} onChange={e => setVolunteerInput(e.target.value)} autoFocus />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={s.formLabel}>Role</div>
              <select style={s.formInput} value={newTeamMemberRole} onChange={e => setNewTeamMemberRole(e.target.value)}>
                <option value="ed">Executive Director</option>
                <option value="staff">Staff</option>
                <option value="board">Board Member</option>
                <option value="volunteer">Volunteer</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={savingVolunteer} onClick={async () => {
                const email = volunteerInput.trim().toLowerCase()
                const role = newTeamMemberRole
                if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Enter a valid email', 'error'); return }
                if ([...localEds, ...localStaff, ...localBoardMembers, ...localVolunteers].includes(email)) { showToast('Already assigned a role', 'error'); return }
                setSavingVolunteer(true)
                const columnMap = { ed: 'ed_emails', staff: 'staff_emails', board: 'board_emails', volunteer: 'volunteer_emails' }
                const currentMap = { ed: localEds, staff: localStaff, board: localBoardMembers, volunteer: localVolunteers }
                const updated = [...currentMap[role], email]
                const { error } = await supabase.from('charity_contacts').update({ [columnMap[role]]: updated }).eq('charity_uen', charityUen)
                if (error) { showToast('Error saving', 'error'); setSavingVolunteer(false); return }

                const { error: inviteError } = await supabase.functions.invoke('invite-team-member', {
                  body: { email, charity_uen: charityUen, charity_name: charityName },
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setDuplicateDonationWarning(null)}>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setConfirmModal(null)}>
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
                {confirmModal.steps.map((step, i) => (
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
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Will be emailed to {rd.donor_email} as a PDF attachment along with the thank-you note.</div>
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
            background: toast.undoable ? C.warningBg : toast.type === 'success' ? C.successBg : '#FCEBEB',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: toast.undoable ? C.warning : toast.type === 'success' ? C.forest : '#791F1F' }}>
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

const s = {
  page: { display: 'flex', minHeight: '100vh', background: C.ivory, fontFamily: "'Segoe UI', sans-serif", color: C.text, overflowX: 'hidden' },
  sidebar: { width: 232, background: C.forest, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 10 },
  sidebarLogo: { padding: '28px 24px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  logoText: { fontSize: 18, fontWeight: 800, color: 'white' },
  logoSub: { fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 },
  charityBadge: { margin: 16, background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 10 },
  charityIcon: { width: 36, height: 36, background: '#FFF5E6', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 },
  charityName: { fontFamily: C.fontVoice, fontSize: 15, fontWeight: 500, color: 'white', lineHeight: 1.3 },
  charityUen: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  navSection: { padding: '6px 12px', flex: 1 },
  navLabel: { fontFamily: C.fontMono, fontSize: 10.5, fontWeight: 500, color: C.gold, textTransform: 'uppercase', letterSpacing: 1.5, padding: '10px 12px 5px' },
  navItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 1, fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,0.6)' },
  navItemActive: { background: C.sage, color: 'white' },
  navIcon: { fontSize: 16, width: 20, textAlign: 'center' },
  sidebarFooter: { padding: 16, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 10 },
  footerAvatar: { width: 32, height: 32, background: C.sage, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: 'white', flexShrink: 0 },
  footerName: { fontSize: 12, fontWeight: 700, color: 'white', lineHeight: 1.3 },
  footerEmail: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  main: { marginLeft: 232, flex: 1, minWidth: 0, overflowX: 'hidden', width: 'calc(100vw - 232px)', boxSizing: 'border-box' },
  mainTablet: { marginLeft: 72, flex: 1, minWidth: 0 },
  sidebarTablet: { width: 72, background: C.forest, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 10, paddingTop: 16, paddingBottom: 16 },
  sidebarTabletLogo: { marginBottom: 20 },
  sidebarTabletNav: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1 },
  sidebarTabletItem: { width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' },
  sidebarTabletItemActive: { background: C.sage, color: 'white' },
  mainMobile: { marginLeft: 0, flex: 1, minWidth: 0, paddingTop: 56, paddingBottom: 72, width: '100%', boxSizing: 'border-box' },
  mobileTopBar: {
  position: 'fixed', top: 0, left: 0, right: 0, height: 56, zIndex: 20,
  background: C.forest, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '0 16px', boxSizing: 'border-box',
},
mobileTopBarTitle: { fontSize: 16, fontWeight: 800, color: 'white' },
mobileOverflowBtn: {
  color: 'white', fontSize: 20, fontWeight: 800, cursor: 'pointer',
  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
},
mobileOverflowMenu: {
  position: 'absolute', top: 56, right: 16, background: C.white,
  borderRadius: 12, border: `1.5px solid ${C.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
  overflow: 'hidden', zIndex: 30,
},
mobileOverflowItem: {
  padding: '12px 18px', fontSize: 13, fontWeight: 500, color: C.forest,
  cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: `1px solid ${C.ivoryDark}`,
},
mobileTabBar: {
  position: 'fixed', bottom: 0, left: 0, right: 0, height: 64, zIndex: 20,
  background: C.teal, display: 'flex', justifyContent: 'space-around', alignItems: 'center',
  boxSizing: 'border-box',
},
mobileTabItem: {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
  cursor: 'pointer', flex: 1,
},
mobileTabLabel: { fontSize: 10, fontWeight: 500 },
  content: { padding: 32 },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  pageTitle: { fontSize: 24, fontWeight: 800, color: C.forest, marginBottom: 4 },
  pageSub: { fontSize: 13, color: C.muted },
  deadlineBanner: { background: C.red, borderRadius: 16, padding: '16px 20px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  bannerBtn: { background: 'white', color: C.red, border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 24 },
  statsGridTablet: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, marginBottom: 22 },
  statsGridMobile: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 20 },
  statCard: { background: C.white, borderRadius: 16, padding: 20, border: `1.5px solid ${C.border}` },
  statLabel: { fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500, marginBottom: 8 },
  statValue: { fontSize: 28, fontWeight: 800, color: C.forest, letterSpacing: -0.5 },
  statNote: { fontSize: 11, color: C.muted, marginTop: 4 },
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 24 },
  twoColMobile: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16, marginBottom: 24 },
  threeCol: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 24 },
  threeColTablet: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16, marginBottom: 24 },
  threeColMobile: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16, marginBottom: 24 },
  card: { background: C.white, borderRadius: 4, padding: 20, border: `1px solid ${C.border}`, marginBottom: 0 },
  cardTitle: { fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontFamily: C.fontMono, marginBottom: 16 },
  analyticsCardTitle: { fontSize: 12, fontWeight: 600, color: C.forest, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 5 },
  analyticsSubTitle: { fontSize: 11, fontWeight: 600, color: C.gold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  analyticsSubTitleDivider: { fontSize: 11, fontWeight: 600, color: C.gold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, borderTop: `1px dashed ${C.border}`, paddingTop: 14 },
  analyticsStatNumber: { fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1 },
  analyticsStatDelta: (positive) => ({ fontSize: 12, fontWeight: 600, color: positive ? C.sage : C.red }),
  statusStep: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 4 },
  stepDot: { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'white', flexShrink: 0 },
  stepLine: { width: 2, height: 16, background: C.border, marginLeft: 13, marginBottom: 4 },
  stepTitle: { fontSize: 12, fontWeight: 700, color: C.forest },
  stepSub: { fontSize: 11, color: C.muted },
  autoBadge: { background: C.successBg, color: C.sage, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 },
  notifItem: { borderRadius: 10, padding: 12, border: `1px solid ${C.border}`, marginBottom: 8 },
  irasCard: { background: C.white, borderRadius: 20, border: `1.5px solid ${C.border}`, marginBottom: 24, overflow: 'hidden' },
  irasHeader: { background: C.teal, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  irasStatus: { background: C.gold, color: C.forest, padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0 },
  irasBody: { padding: 24 },
  irasInfoGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 20 },
  irasInfoGridTablet: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, marginBottom: 18 },
  irasInfoGridMobile: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 16 },
  irasInfoItem: { background: C.ivory, borderRadius: 12, padding: 14, border: `1px solid ${C.border}` },
  irasInfoLabel: { fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500, marginBottom: 6 },
  irasInfoValue: { fontSize: 30, fontWeight: 800, color: C.forest },
  irasInfoNote: { fontSize: 12, color: C.muted, marginTop: 2 },
  tableCard: { background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, overflow: 'hidden', marginBottom: 24 },
  tableHeader: { padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}` },
  tableTitle: { fontSize: 13, fontWeight: 600, color: C.forest },
  tableCount: { fontSize: 11.5, color: C.muted },
  pendingBadge: { background: C.warningBg, color: C.warning, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 4 },
  empty: { padding: 32, textAlign: 'center', color: C.muted, fontSize: 13, fontStyle: 'italic' },
  table: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' },
  th: { padding: '10px 18px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontFamily: C.fontMono, background: C.ivory, borderBottom: `1px solid ${C.border}` },
  tr: { borderBottom: `1px solid ${C.ivoryDark}` },
  td: { padding: '11px 18px', fontSize: 13 },
  donorCell: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  donorAvatar: { width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: C.fontVoice, fontSize: 12, fontWeight: 500, color: 'white', flexShrink: 0 },
  donorName: { fontWeight: 600, color: C.forest, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 },
  amountText: { fontFamily: C.fontVoice, fontWeight: 500, color: C.forest },
  dateText: { color: C.muted, fontSize: 11.5 },
  badgeIssued: { fontSize: 10, fontWeight: 500, color: C.sage, background: C.successBg, padding: '3px 10px', borderRadius: 20, display: 'inline-block', whiteSpace: 'nowrap' },
  badgePending: { fontSize: 10, fontWeight: 500, color: C.warning, background: C.warningBg, padding: '3px 10px', borderRadius: 20, display: 'inline-block', whiteSpace: 'nowrap' },
  issueBtn: { padding: '6px 14px', background: C.sage, color: 'white', border: 'none', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  issuingBtn: { padding: '6px 14px', background: C.ivoryDark, color: C.muted, border: 'none', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'default', fontFamily: 'inherit' },
  viewBtn: { padding: '6px 14px', background: C.ivory, color: C.forest, border: `1.5px solid ${C.border}`, borderRadius: 12, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  btnGold: { background: C.gold, color: C.forest, border: 'none', borderRadius: 12, padding: '12px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 },
  btnForest: { background: C.forest, color: 'white', border: 'none', borderRadius: 12, padding: '12px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 },
  searchBox: { flex: 1, padding: '10px 16px', border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontFamily: 'inherit', background: C.white, color: C.text, outline: 'none' },
  filterSelect: { padding: '10px 14px', border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontFamily: 'inherit', background: C.white, color: C.text, cursor: 'pointer' },
  exportSmallBtn: { background: C.forest, color: 'white', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  backBtn: { background: C.ivory, color: C.forest, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  infoGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 0 },
  infoItem: { background: C.ivory, borderRadius: 10, padding: 12, border: `1px solid ${C.border}` },
  infoLabel: { fontSize: 10, color: C.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  infoValue: { fontSize: 18, fontWeight: 800, color: C.forest },
  formLabel: { fontSize: 11, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  formInput: { width: '100%', padding: '10px 14px', border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: C.ivory, color: C.text, boxSizing: 'border-box' },
  donationCard: { padding: '14px 16px', borderBottom: `1px solid ${C.ivoryDark}`, cursor: 'pointer' },
  donationCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  donationCardDonor: { display: 'flex', alignItems: 'center', gap: 10 },
  donationCardName: { fontWeight: 700, color: C.forest, fontSize: 14 },
  donationCardDate: { fontSize: 11, color: C.muted, marginTop: 1 },
  donationCardAmount: { fontWeight: 800, color: C.forest, fontSize: 16, textAlign: 'right' },
  donationCardBadges: { display: 'flex', flexWrap: 'wrap', gap: 6, marginLeft: 42 },
}
