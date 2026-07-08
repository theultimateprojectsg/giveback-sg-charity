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

export default function App() {
  const screenSize = useScreenSize()
  const isMobile = screenSize === 'mobile'
  const isTablet = screenSize === 'tablet'
  const [donations, setDonations] = useState([])
  const [loading, setLoading] = useState(true)
  const [issuing, setIssuing] = useState(null)
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('giveback_charity_tab') || 'dashboard')
  const [selectedDonor, setSelectedDonor] = useState(null)
  const [pendingSelectedDonorKey, setPendingSelectedDonorKey] = useState(() => localStorage.getItem('giveback_charity_selected_donor') || null)

  useEffect(() => {
    if (selectedDonor) {
      localStorage.setItem('giveback_charity_selected_donor', selectedDonor.email?.trim() || selectedDonor.name)
    } else {
      localStorage.removeItem('giveback_charity_selected_donor')
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
  const [manualForm, setManualForm] = useState({ donor_name: '', donor_nric: '', amount: '', payment_method: 'Cash', notes: '', donor_email: '', date: new Date().toISOString().split('T')[0], cause_id: '', receipt_name: '' })
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
  const [newTagInput, setNewTagInput] = useState('')
  const [savingTag, setSavingTag] = useState(false) 
  const [filterDonorTag, setFilterDonorTag] = useState('All')
  const [userRole, setUserRole] = useState('staff')
  const [roleLoaded, setRoleLoaded] = useState(false)
  const [volunteerInput, setVolunteerInput] = useState('')
  const [savingVolunteer, setSavingVolunteer] = useState(false)
  const [localVolunteers, setLocalVolunteers] = useState([])
  const [monthlyExpenses, setMonthlyExpenses] = useState(0)
  const [customObligations, setCustomObligations] = useState([])
  const [showAddObligation, setShowAddObligation] = useState(false)
  const [obligationForm, setObligationForm] = useState({ title: '', date: '', repeat: 'annual' })
  const [editingExpenses, setEditingExpenses] = useState(false)
  const [expensesInput, setExpensesInput] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [pledges, setPledges] = useState([])
  const [showPledgeForm, setShowPledgeForm] = useState(false)
  const [pledgeForm, setPledgeForm] = useState({ donor_name: '', donor_email: '', amount: '', expected_date: '', notes: '' })
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
  const [dismissingLapsed, setDismissingLapsed] = useState(false)
  const [showDismissedLapsedDonors, setShowDismissedLapsedDonors] = useState(false)
  const [givingChangeMinGifts, setGivingChangeMinGifts] = useState(() => {
    const saved = localStorage.getItem('gt_giving_change_min_gifts')
    return saved ? Number(saved) : 3
  })
  const [givingChangeMinPct, setGivingChangeMinPct] = useState(() => {
    const saved = localStorage.getItem('gt_giving_change_min_pct')
    return saved ? Number(saved) : 30
  })
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
    localStorage.setItem('gt_giving_change_min_gifts', String(givingChangeMinGifts))
  }, [givingChangeMinGifts])

  useEffect(() => {
    localStorage.setItem('gt_giving_change_min_pct', String(givingChangeMinPct))
  }, [givingChangeMinPct])

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
  const [concentrationTopN, setConcentrationTopN] = useState(() => {
    const saved = localStorage.getItem('gt_concentration_top_n')
    return saved ? Number(saved) : 10
  })

  useEffect(() => {
    localStorage.setItem('gt_concentration_top_n', String(concentrationTopN))
  }, [concentrationTopN])

  const [lapsedMinGifts, setLapsedMinGifts] = useState(() => {
    const saved = localStorage.getItem('gt_lapsed_min_gifts')
    return saved ? Number(saved) : 2
  })
  const [lapsedMinDays, setLapsedMinDays] = useState(() => {
    const saved = localStorage.getItem('gt_lapsed_min_days')
    return saved ? Number(saved) : 60
  })

  useEffect(() => {
    localStorage.setItem('gt_lapsed_min_gifts', String(lapsedMinGifts))
  }, [lapsedMinGifts])

  useEffect(() => {
    localStorage.setItem('gt_lapsed_min_days', String(lapsedMinDays))
  }, [lapsedMinDays])

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
  const [massAppealForm, setMassAppealForm] = useState({ cause_id: '', amount: '', message: '' })
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
  const [editingNoteId, setEditingNoteId] = useState(null)
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
  const [causeForm, setCauseForm] = useState({ title: '', description: '', target_amount: '', end_date: '' })
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
      .from('lapsed_donor_reminders')
      .select('donor_key, sent_at, sent_by')
      .eq('charity_uen', uen)
      .order('sent_at', { ascending: false })
    if (error) { console.error('Could not load lapsed reminders:', error); return }
    const history = {}
    ;(data || []).forEach(r => {
      if (!history[r.donor_key]) history[r.donor_key] = []
      history[r.donor_key].push(r)
    })
    setLapsedReminderHistory(history)

    const { data: dismissData, error: dismissError } = await supabase
      .from('lapsed_donor_dismissals')
      .select('donor_key, reason, dismissed_at, dismissed_by')
      .eq('charity_uen', uen)
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
      .select('ipc, annual_goal, fy_end_month, fy_end_day, visible_metrics, staff_emails, volunteer_emails, monthly_expenses, custom_obligations')
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
    // Determine role — volunteer_emails takes precedence, then staff_emails, default to staff
    const email = activeSession?.user?.email || ''
    const volunteerEmails = data?.volunteer_emails || []
    if (volunteerEmails.includes(email)) {
      setUserRole('volunteer')
    } else {
      setUserRole('staff')
    }
    setLocalVolunteers(volunteerEmails)
    setMonthlyExpenses(data?.monthly_expenses || 0)
    setCustomObligations(data?.custom_obligations || [])
    setSenderDomainStatus(data?.sender_domain_status || 'none')
    setSenderDomain(data?.sender_domain || '')
    setSenderEmailLocalPart(data?.sender_email_local_part || 'hello')
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
    setSavingPledge(true)
    setPledgeError('')
    const donorKey = pledgeForm.donor_email?.trim() || pledgeForm.donor_name.trim()
    const { data, error } = await supabase.from('pledges').insert([{
      charity_uen: charityUen,
      donor_name: pledgeForm.donor_name.trim(),
      donor_email: pledgeForm.donor_email?.trim() || null,
      donor_key: donorKey,
      amount: parseFloat(pledgeForm.amount),
      expected_date: pledgeForm.expected_date,
      notes: pledgeForm.notes?.trim() || null,
      status: 'pending',
      created_by: session.user.email,
    }]).select()
    setSavingPledge(false)
    if (error) { setPledgeError(`Error: ${error.message}`); return }
    setPledges(prev => [...prev, data[0]].sort((a, b) => new Date(a.expected_date) - new Date(b.expected_date)))
    setPledgeForm({ donor_name: '', donor_email: '', amount: '', expected_date: '', notes: '' })
    setShowPledgeForm(false)
    showToast('Pledge recorded ✓')
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

  async function sendCharityEmail(body) {
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
    setPledgeResolutionModal({ type: 'fulfilled', pledge })
  }

  async function confirmPledgeResolution() {
    if (!pledgeResolutionModal) return
    const { type, pledge } = pledgeResolutionModal
    const { error } = await supabase.from('pledges').update({ status: type, resolution_notes: pledgeResolutionNotes || null }).eq('id', pledge.id)
    if (error) { showToast('Error updating pledge', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: type === 'fulfilled' ? 'pledge_fulfilled' : 'pledge_cancelled',
      details: { donor_name: pledge.donor_name, amount: pledge.amount, notes: pledgeResolutionNotes || null },
    })
    setPledges(prev => prev.map(p => p.id === pledge.id ? { ...p, status: type, resolution_notes: pledgeResolutionNotes || null } : p))
    showToast(`Pledge from ${pledge.donor_name} marked as ${type} ${type === 'fulfilled' ? '✓' : ''}`)
    setPledgeResolutionModal(null)
    setPledgeResolutionNotes('')
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
        .from('recurring_gift_skips')
        .select('recurring_gift_id, skipped_cycle_date, reason, created_at')
        .in('recurring_gift_id', data.map(g => g.id))
        .order('created_at', { ascending: false })
      const skips = {}
      ;(skipData || []).forEach(s => {
        if (!skips[s.recurring_gift_id]) skips[s.recurring_gift_id] = []
        skips[s.recurring_gift_id].push(s)
      })
      setRecurringSkipHistory(skips)

      const { data: reminderData } = await supabase
        .from('recurring_gift_reminders')
        .select('recurring_gift_id, sent_at, sent_by')
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

    const { data: inserted, error: skipError } = await supabase.from('recurring_gift_skips').insert({
      recurring_gift_id: gift.id,
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

    const { data: inserted } = await supabase.from('recurring_gift_reminders').insert({
      recurring_gift_id: g.id,
      subject: recurringReminderSubject,
      message: recurringReminderBody,
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

    const { data: inserted, error } = await supabase.from('lapsed_donor_dismissals').upsert({
      charity_uen: charityUen,
      donor_key: donorKey,
      reason: lapsedDismissReason || null,
      dismissed_by: session.user.email,
      dismissed_at: new Date().toISOString(),
    }, { onConflict: 'charity_uen,donor_key' }).select().single()

    if (error) { showToast('Error dismissing donor', 'error'); setDismissingLapsed(false); return }

    setLapsedDismissals(prev => ({ ...prev, [donorKey]: inserted }))
    showToast(`${d.name} marked as not interested`)
    setDismissingLapsed(false)
    setShowLapsedDismissModal(null)
    setLapsedDismissReason('')
  }

  async function undismissLapsedDonor(donorKey) {
    const { error } = await supabase.from('lapsed_donor_dismissals').delete().eq('charity_uen', charityUen).eq('donor_key', donorKey)
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
      const { data: inserted } = await supabase.from('lapsed_donor_reminders').insert({
        charity_uen: charityUen,
        donor_key: donorKey,
        subject: lapsedReminderSubject,
        message: lapsedReminderBody,
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
      title: 'Delete this submission?',
      description: 'It will be moved to Past Campaigns and removed from the donor app.',
      confirmLabel: 'Delete',
      onConfirm: () => deleteCauseConfirmed(id),
    })
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
    setCauseForm({ title: c.title, description: c.description, target_amount: c.target_amount?.toString() || '', end_date: c.end_date || '', editingId: c.id })
    setShowCauseForm(true)
  }

  function requestRevision(c) {
    if (bulkActionInProgress) { showToast('Please wait for the current action to finish', 'error'); return }
    const description = c.type === 'campaign'
      ? `This will immediately remove "${c.title}" from the donor app, including for anyone currently viewing it, until it's re-approved.`
      : `This will immediately remove this sponsored banner from the donor app until it's re-approved.`
    setConfirmModal({
      title: 'Request a revision?',
      description,
      confirmLabel: 'Request revision',
      onConfirm: () => requestRevisionConfirmed(c),
    })
  }

  async function requestRevisionConfirmed(c) {
    setBulkActionInProgress(true)
    const { error } = await supabase.from('causes').update({ status: 'pending' }).eq('id', c.id)
    setBulkActionInProgress(false)
    if (error) { showToast('Error requesting revision', 'error'); return }
    supabase.functions.invoke('notify-pending-approval', { body: { title: c.title, description: c.description, target_amount: c.target_amount, end_date: c.end_date, charity_name: charityName, type: c.type, id: c.id, is_revision: true } }).catch(err => console.error(err))
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'cause_revision_requested',
      details: { title: c.title, charity_uen: charityUen },
    })
    loadMyCauses()
    showToast('Moved back to Pending Review — click Edit to update and resubmit')
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
      type: 'campaign',
      status: 'pending',
      active: true,
    }]).select()
    setSavingCause(false)
    if (error) { setCauseError(`Error: ${error.message}`); return }
    supabase.functions.invoke('notify-pending-approval', { body: { title: causeForm.title, description: causeForm.description, target_amount: causeForm.target_amount, end_date: causeForm.end_date, charity_name: charityName, type: 'campaign', id: data[0].id } }).catch(err => console.error(err))
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'cause_submitted',
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
    localStorage.setItem('giveback_charity_tab', activeTab)
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

  async function generateMassAppealRefs() {
    if (!massAppealForm.amount || parseFloat(massAppealForm.amount) <= 0) {
      showToast('Please enter a default amount', 'error'); return
    }
    const targetDonors = donorList.filter(d => !d.deactivated && d.email?.trim())
    if (targetDonors.length === 0) {
      showToast('No donors with email addresses found', 'error'); return
    }
    const refs = targetDonors.map(donor => ({
      donor_name: donor.name,
      donor_email: donor.email,
      ref: generateAppealRef(donor.name, massAppealForm.cause_id),
      amount: parseFloat(massAppealForm.amount),
      qrValue: `https://www.paynow.com.sg/pay?uen=${charityUen}&amount=${massAppealForm.amount}&ref=${generateAppealRef(donor.name, massAppealForm.cause_id)}`,
      selected: true,
    }))
    // Regenerate with consistent refs
    const finalRefs = targetDonors.map(donor => {
      const ref = generateAppealRef(donor.name, massAppealForm.cause_id)
      return {
        donor_name: donor.name,
        donor_email: donor.email,
        ref,
        amount: parseFloat(massAppealForm.amount),
        qrValue: `https://www.paynow.com.sg/pay?uen=${charityUen}&amount=${massAppealForm.amount}&ref=${ref}`,
        selected: true,
      }
    })
    setMassAppealRefs(finalRefs)
    setMassAppealStep('preview')
  }

  async function sendMassAppealEmails() {
    const selected = massAppealRefs.filter(r => r.selected)
    if (selected.length === 0) { showToast('No donors selected', 'error'); return }
    massAppealCancelRef.current = false
    setMassAppealProgress({ done: 0, total: selected.length, sent: 0, failed: 0 })
    let sent = 0
    let failed = 0
    const causeName = massAppealForm.cause_id ? myCauses.find(c => c.id === massAppealForm.cause_id)?.title || 'our campaign' : 'our campaign'

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
        custom_message: massAppealForm.message || null,
        paynow_url: donor.qrValue,
      })
      if (error) { failed++; console.error('Failed to send to', donor.donor_email, error) }
      else sent++
      setMassAppealProgress({ done: i + 1, total: selected.length, sent, failed })
    }

    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'mass_appeal_sent',
      details: { sent, failed, total: selected.length, cause_id: massAppealForm.cause_id },
    })

    const { data: appealData } = await supabase.from('mass_appeals').insert([{
      charity_uen: charityUen,
      cause_id: massAppealForm.cause_id || null,
      cause_name: causeName,
      amount: parseFloat(massAppealForm.amount),
      message: massAppealForm.message || null,
      donor_count: selected.length,
      sent_count: sent,
      failed_count: failed,
      status: 'sent',
      created_by: session.user.email,
    }]).select()
    if (appealData?.[0]) setMassAppeals(prev => [appealData[0], ...prev])

    setMassAppealStep('done')
    setMassAppealProgress(null)
    showToast(`Appeal sent to ${sent} donor${sent !== 1 ? 's' : ''}${failed > 0 ? ` · ${failed} failed` : ''} ✓`)
  }

  async function downloadMassAppealQRZip() {
    const selected = massAppealRefs.filter(r => r.selected)
    if (selected.length === 0) { showToast('No donors selected', 'error'); return }
    showToast('Generating QR codes...')

    const zip = new JSZip()
    const causeName = massAppealForm.cause_id ? myCauses.find(c => c.id === massAppealForm.cause_id)?.title || 'Appeal' : 'Appeal'

    for (const donor of selected) {
      // Render QR to canvas via a temporary DOM element
      const canvas = document.createElement('canvas')
      canvas.width = 300
      canvas.height = 300
      const ctx = canvas.getContext('2d')

      // White background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 300, 300)

      // We'll use a data URL approach — create SVG string for QR
      const svgEl = document.createElement('div')
      svgEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260"></svg>`

      // Simple approach: encode as text file with donor info + ref for manual QR generation
      const content = [
        `Donor: ${donor.donor_name}`,
        `Email: ${donor.donor_email}`,
        `Amount: SGD $${donor.amount}`,
        `Reference: ${donor.ref}`,
        `PayNow URL: ${donor.qrValue}`,
        `Campaign: ${causeName}`,
        `Charity: ${charityName} (UEN: ${charityUen})`,
      ].join('\n')
      zip.file(`${donor.donor_name.replace(/[^a-zA-Z0-9]/g, '_')}_${donor.ref}.txt`, content)
    }

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
    setPledges(prev => prev.map(p => p.id === pledge.id ? { ...p, status: 'fulfilled', resolution_notes: autoNote } : p))

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
    setPledges(prev => prev.map(p => p.id === pledge.id ? { ...p, status: 'fulfilled', resolution_notes: autoNote } : p))

    showToast('Pledge marked fulfilled')
    setShowPledgeThankYouModal(false)
    setPledgeCompletionCandidate(null)
  }

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

    const { error } = await supabase.from('donations').update({ payment_status: 'confirmed', receipt_issued: true }).eq('id', donation.id)
    if (error) { showToast('Error confirming payment', 'error'); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'payment_confirmed',
      donation_id: donation.id,
      details: { donor_name: donation.donor_name, amount: donation.amount, payment_ref: donation.payment_ref },
    })
    setDonations(prev => prev.map(x => x.id === donation.id ? { ...x, payment_status: 'confirmed', receipt_issued: true } : x))
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
    })
    if (!emailError) {
      await supabase.from('donations').update({ thank_you_sent: true }).eq('id', donation.id)
      setDonations(prev => prev.map(x => x.id === donation.id ? { ...x, thank_you_sent: true } : x))
      setSelectedDonation(prev => (prev && prev.id === donation.id ? { ...prev, thank_you_sent: true } : prev))
      showToast('Payment confirmed ✓ — thank you email sent to ' + donation.donor_email + ' 💌')
    } else {
      showToast('Payment confirmed but thank you email failed — send manually', 'error')
    }
  }

  async function sendThankYouEmail(donation) {
    if (sendingThankYouId === donation.id) return
    setSendingThankYouId(donation.id)
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
    })
    if (error) { showToast('Failed to send email', 'error'); setSendingThankYouId(null); return }
    await supabase.from('donations').update({ thank_you_sent: true }).eq('id', donation.id)
    setDonations(prev => prev.map(x => x.id === donation.id ? { ...x, thank_you_sent: true } : x))
    setSelectedDonation(prev => (prev && prev.id === donation.id ? { ...prev, thank_you_sent: true } : prev))
    setSendingThankYouId(null)
    showToast(`Email sent to ${donation.donor_email}`)
  }

  async function issueReceipt(donation, skipLog = false) {
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

  async function saveManualEntry() {
  if (!manualForm.donor_name) { setManualError('Donor name is required'); return }
  if (!manualForm.amount || parseFloat(manualForm.amount) <= 0) { setManualError('Please enter a valid amount'); return }
  if (new Date(manualForm.date) > new Date()) { setManualError('Donation date cannot be in the future'); return }
  if (new Date(manualForm.date) < new Date('2020-01-01')) { setManualError('Donation date seems too far in the past — please check it'); return }
  if (manualForm.donor_nric && !/^[A-Z]\d{7}[A-Z]$/i.test(manualForm.donor_nric.trim())) { setManualError('Invalid NRIC format. Should be like S1234567A'); return }
  if (manualForm.donor_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(manualForm.donor_email.trim())) { setManualError('Invalid email format'); return }

  // Duplicate detection — fuzzy name match against existing donors
  if (!manualForm.duplicateConfirmed) {
    const enteredName = manualForm.donor_name.trim().toLowerCase()
    const similarDonors = donorList.filter(d => {
      const existing = d.name.trim().toLowerCase()
      if (existing === enteredName) return true
      // Check if one name contains the other (catches "John Tan" vs "John Tan Jr")
      if (existing.includes(enteredName) || enteredName.includes(existing)) return true
      // Simple character similarity — flag if 80%+ of characters match
      const longer = existing.length > enteredName.length ? existing : enteredName
      const shorter = existing.length > enteredName.length ? enteredName : existing
      let matches = 0
      for (const char of shorter) { if (longer.includes(char)) matches++ }
      const similarity = matches / longer.length
      return similarity >= 0.8 && Math.abs(existing.length - enteredName.length) <= 4
    })
    if (similarDonors.length > 0) {
      setManualError('')
      setManualDuplicateWarning(similarDonors)
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
      receipt_number: receiptNumber,
      receipt_name: manualForm.receipt_name?.trim() || null,
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

  function deleteDonation(id) {
    const donationToDelete = donations.find(d => d.id === id)
    const description = donationToDelete?.receipt_issued
      ? 'This entry already has a receipt issued. The record will be kept for audit purposes but removed from your active lists.'
      : 'The record will be kept for audit purposes but removed from your active lists.'
    setConfirmModal({
      title: donationToDelete?.receipt_issued ? 'Delete this entry anyway?' : 'Delete this manual entry?',
      description,
      confirmLabel: 'Delete',
      onConfirm: () => deleteDonationConfirmed(id),
    })
  }

  async function deleteDonationConfirmed(id) {
    const donationToDelete = donations.find(d => d.id === id)
    const originalStatus = donationToDelete?.status || 'confirmed'
    setDeletingId(id)
    const { error } = await supabase.from('donations').update({ status: 'deleted_by_charity' }).eq('id', id)
    if (error) { console.error(error); setDeletingId(null); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'manual_entry_deleted',
      donation_id: id,
      details: { donor_name: donationToDelete?.donor_name, amount: donationToDelete?.amount },
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
  const donorMap = {}
  donations.forEach(d => {
    const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
    if (!donorMap[key]) {
      donorMap[key] = { name: d.donor_name, email: d.donor_email, total: 0, count: 0, lastDate: d.created_at, receipts: 0, deactivated: d.donor_deactivated || false }
    }
    if (!donorMap[key].email && d.donor_email) donorMap[key].email = d.donor_email
    donorMap[key].total += d.amount
    donorMap[key].count += 1
    if (d.receipt_issued) donorMap[key].receipts += 1
    if (d.donor_deactivated) donorMap[key].deactivated = true
    if (new Date(d.created_at) > new Date(donorMap[key].lastDate)) {
      donorMap[key].lastDate = d.created_at
    }
  })
  const donorList = Object.values(donorMap).sort((a, b) => b.total - a.total)
  const activeDonorList = donorList.filter(d => !d.deactivated)

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
  const noteworthyDonors = donorList
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
  const causeRaisedMap = {}
  donations.forEach(d => {
    if (!d.cause_id || d.payment_status !== 'confirmed') return
    causeRaisedMap[d.cause_id] = (causeRaisedMap[d.cause_id] || { total: 0, donors: new Set() })
    causeRaisedMap[d.cause_id].total += d.amount
    causeRaisedMap[d.cause_id].donors.add(d.donor_email?.trim() || d.donor_nric || d.donor_name)
  })
  const causePerformanceThisYear = (() => {
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
        title: cause?.title || 'Unknown Campaign',
        total: stats.total,
        count: stats.count,
        avg: stats.total / stats.count,
        donors: stats.donors.size,
      }
    }).sort((a, b) => b.total - a.total)
    if (generalCount > 0) {
      rows.push({ title: 'General Donation', total: generalTotal, count: generalCount, avg: generalTotal / generalCount, donors: null, isGeneral: true })
    }
    return rows
  })()

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const confirmedDonations = donations.filter(d => d.payment_status === 'confirmed')

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
  const repeatDonorsThisMonth = Object.values(donorMap).filter(d => {
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
      await issueReceipt(d, true)
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

  function exportDonationsExcel() {
    const rows = filteredDonations.map(d => ({
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

  function exportSingleReceiptPDF(donation) {
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
    doc.text(donation.receipt_name || donation.donor_name || '', margin, y)
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

    doc.save(`Receipt-${donation.payment_ref || donation.receipt_number || donation.id}.pdf`)
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

      {/* ── SIDEBAR (desktop, collapsible) ── */}
      {screenSize === 'desktop' && (
      <div style={{ ...s.sidebar, width: sidebarCollapsed ? 64 : 240, transition: 'width 0.2s ease', overflowX: 'hidden', overflowY: 'auto' }}>

        {/* Logo */}
        <div style={{ ...s.sidebarLogo, display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'space-between' }}>
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
            onClick={() => setSidebarCollapsed(v => !v)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.6)', width: 24, height: 24, borderRadius: 6, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: sidebarCollapsed ? 0 : 8 }}
          >{sidebarCollapsed ? '→' : '←'}</button>
        </div>

        {/* Charity badge */}
        {!sidebarCollapsed && (
          <div style={s.charityBadge}>
            <div style={s.charityIcon}>🏥</div>
            <div>
              <div style={s.charityName}>{charityName}</div>
              <div style={s.charityUen}>UEN: {charityUen}</div>
            </div>
          </div>
        )}

        {/* Nav */}
        <div style={{ ...s.navSection, overflowX: 'hidden' }}>
          {!sidebarCollapsed && <div style={s.navLabel}>Main</div>}
          {[
            { id: 'dashboard', icon: '📊', label: 'Dashboard', staffOnly: false },
            { id: 'donations', icon: '💳', label: 'Donations', staffOnly: false },
            { id: 'donors',    icon: '👥', label: 'Donors',    staffOnly: true },
            { id: 'analytics', icon: '📈', label: 'Analytics', staffOnly: true },
          ].filter(item => !item.staffOnly || userRole === 'staff').map(item => (
            <div key={item.id}
              title={item.label}
              style={{ ...s.navItem, ...(activeTab === item.id ? s.navItemActive : {}), justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}
              onClick={() => { setActiveTab(item.id); setSelectedDonor(null) }}>
              <span style={s.navIcon}>{item.icon}</span>
              {!sidebarCollapsed && item.label}
            </div>
          ))}
          {userRole === 'staff' && (
            <>
              {!sidebarCollapsed && <div style={s.navLabel}>Campaigns</div>}
              {[
                { id: 'promotions', icon: '📣', label: 'Campaigns' },
                { id: 'pledges',    icon: '🤝', label: 'Pledges' },
                { id: 'recurring',  icon: '🔁', label: 'Recurring' },
                { id: 'massappeal', icon: '📢', label: 'Mass Appeal' },
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
              <div style={s.footerEmail}>{session?.user?.email}</div>
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
            {userRole === 'staff' && (
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
      <div style={isMobile ? s.mainMobile : { ...s.main, marginLeft: sidebarCollapsed ? 64 : 240, width: `calc(100vw - ${sidebarCollapsed ? 64 : 240}px)`, transition: 'margin-left 0.2s ease, width 0.2s ease' }}>

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
                <span style={{ fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: C.forest, fontWeight: 600 }}>Today's Overview</span>
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
              if (dueSoonPledges.length > 0) items.push({ icon: '🤝', label: `${dueSoonPledges.length} pledge${dueSoonPledges.length > 1 ? 's' : ''} due within 7 days`, priority: 'medium', jump: () => { setPledgeSearchTerm(''); setPledgeAmountFilter('All'); setPledgeUrgencyFilter('Due Soon'); setActiveTab('pledges') } })

              const wasRecurringRecentlyReminded = (g) => {
                const history = recurringReminderHistory[g.id]
                if (!history || history.length === 0) return false
                const daysSinceLastReminder = Math.floor((today - new Date(history[0].sent_at)) / (1000 * 60 * 60 * 24))
                return daysSinceLastReminder < 7
              }
              const overdueRecurring = recurringGifts.filter(g => { if (g.status !== 'active' || wasRecurringRecentlyReminded(g)) return false; const daysLate = Math.floor((today - new Date(g.next_expected_date)) / (1000 * 60 * 60 * 24)); return daysLate > 7 })
              if (overdueRecurring.length > 0) items.push({ icon: '🔁', label: `${overdueRecurring.length} recurring gift${overdueRecurring.length > 1 ? 's' : ''} overdue by 7+ days — ${overdueRecurring.slice(0, 2).map(g => g.donor_name).join(', ')}${overdueRecurring.length > 2 ? ` +${overdueRecurring.length - 2} more` : ''}`, priority: 'high', tab: 'recurring' })

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
              if (lapsedCount > 0) items.push({ icon: '⏰', label: `${lapsedCount} repeat donor${lapsedCount > 1 ? 's' : ''} haven't given in ${lapsedMinDays}+ days`, priority: 'medium', jump: () => { document.getElementById('lapsed-donors-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) } })

              if (allGivingChangeFlags.length > 0) items.push({ icon: '📊', label: `${allGivingChangeFlags.length} donor${allGivingChangeFlags.length > 1 ? 's' : ''} with a notable giving change`, priority: 'medium', jump: () => { document.getElementById('giving-changes-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) } })

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
              obligationsDue.forEach(o => items.push({ icon: '📅', label: `${o.title} due in ${o.days} day${o.days !== 1 ? 's' : ''}`, priority: o.days <= 7 ? 'high' : 'medium', tab: 'reports' }))

              if (items.length === 0) {
                return (
                  <div style={{ borderRadius: 4, border: `1px solid ${C.border}`, background: C.white, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, color: C.forest, fontWeight: 600 }}>You're all caught up.</span>
                    <span style={{ fontSize: 13, color: C.muted }}>Nothing needs your attention right now — nice work.</span>
                  </div>
                )
              }

              const highItems = items.filter(i => i.priority === 'high')

              return (
                <div style={{ borderRadius: 4, overflow: 'hidden', marginBottom: 16, border: `1px solid ${highItems.length > 0 ? C.red : C.warning}` }}>
                  <div style={{ background: highItems.length > 0 ? C.red : C.warning, padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'white' }}>{items.length} action item{items.length > 1 ? 's' : ''} need{items.length === 1 ? 's' : ''} your attention</span>
                  </div>
                  <div style={{ background: C.white, display: 'flex', flexDirection: 'column' }}>
                    {items.map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: `1px solid ${C.border}`, cursor: 'pointer', background: C.white, fontSize: 13 }}
                        onClick={() => item.jump ? item.jump() : setActiveTab(item.tab)}
                        onMouseEnter={e => e.currentTarget.style.background = C.ivory}
                        onMouseLeave={e => e.currentTarget.style.background = C.white}
                      >
                        <span style={{ color: item.priority === 'high' ? C.red : C.text, fontWeight: item.priority === 'high' ? 500 : 400, flex: 1 }}>{item.label}</span>
                        <span style={{ fontSize: 12, color: C.sage, fontWeight: 600, fontFamily: C.fontMono, flexShrink: 0 }}>→</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            </div>

            <div style={{ position: 'relative', paddingLeft: 24, marginBottom: 40 }}>
              <div style={{ position: 'absolute', left: 0, top: 4, bottom: 4, width: 1, background: C.borderStrong }} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.muted }}>02</span>
                <span style={{ fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: C.forest, fontWeight: 600 }}>Financial Health</span>
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
              confirmedDonations.forEach(d => {
                const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
                if (!donorFirstGift[key] || new Date(d.created_at) < new Date(donorFirstGift[key])) {
                  donorFirstGift[key] = d.created_at
                }
              })
              const newDonorsThisMonth = Object.values(donorFirstGift).filter(date => new Date(date) >= mtdStart).length
              const newDonorsSameMonthLY = Object.values(donorFirstGift).filter(date => new Date(date) >= samePeriodLastYearStart && new Date(date) <= samePeriodLastYearEnd).length
              const newDonorsDiff = newDonorsSameMonthLY > 0 ? Math.round(((newDonorsThisMonth - newDonorsSameMonthLY) / newDonorsSameMonthLY) * 100) : null

              return (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', marginBottom: 20 }}>
                  {/* MTD donations */}
                  <div style={{ background: C.forest, padding: '16px 18px', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}`, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>This Month <InfoTip text="Total confirmed donations received so far this calendar month." /></div>
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
                  <div style={{ background: C.white, padding: '16px 18px', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>Coverage <InfoTip text="This month's donations divided by your monthly expenses. 1.0x means you're breaking even. Set your expenses in Settings." /></div>
                    {coverageRatio === null ? (
                      <div>
                        <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>Set expenses</div>
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 8px' }} onClick={() => { setExpensesInput(''); setEditingExpenses(true); setActiveTab('settings') }}>Set →</button>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: coverageRatio >= 1 ? C.forest : C.red, lineHeight: 1 }}>{coverageRatio.toFixed(1)}×</div>
                        <div style={{ fontSize: 11.5, color: coverageRatio >= 1 ? C.sage : C.red, marginTop: 6, fontWeight: 600 }}>
                          {coverageRatio >= 1 ? '✓ Covering costs' : '⚠ Shortfall'}
                        </div>
                      </>
                    )}
                  </div>

                  {/* New donors this month */}
                  <div style={{ background: C.white, padding: '16px 18px', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>New Donors <InfoTip text="Donors whose very first donation was this month." /></div>
                    <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1 }}>{newDonorsThisMonth}</div>
                    {newDonorsDiff !== null ? (
                      <div style={{ fontSize: 11.5, color: newDonorsDiff >= 0 ? C.sage : C.red, marginTop: 6 }}>
                        {newDonorsDiff >= 0 ? '↑' : '↓'} {Math.abs(newDonorsDiff)}% vs last year
                      </div>
                    ) : (
                      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>This month</div>
                    )}
                  </div>

                  {/* MRR */}
                  <div style={{ background: C.white, padding: '16px 18px', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, borderTopRightRadius: 4, borderBottomRightRadius: 4 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>Recurring<InfoTip text="Expected monthly income from active GIRO and habitual PayNow donors. Manage these under Recurring." /></div>
                    <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1 }}>${totalMRR.toLocaleString()}</div>
                    <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>
                      {giroMRR > 0 && <span>GIRO ${giroMRR.toLocaleString()} </span>}
                      {habitualMRR > 0 && <span>PayNow ${habitualMRR.toLocaleString()}</span>}
                      {totalMRR === 0 && <span>None set up yet</span>}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* ── UPCOMING OBLIGATIONS ── */}
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
                  <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '18px 20px', marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, display: 'flex', alignItems: 'center', gap: 5 }}>Upcoming Obligations <InfoTip text="Fixed-date commitments like AGM meetings, board meetings, or IRAS deadlines. Add your own under the Add button." /></div>
                      <button style={{ border: `1px solid ${C.borderStrong}`, background: C.ivory, borderRadius: 4, padding: '5px 11px', fontSize: 11.5, fontWeight: 600, color: C.forest, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setShowAddObligation(v => !v)}>+ Add</button>
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
                              <div style={{ fontSize: 13, fontWeight: 600, color: urgent ? C.red : C.forest }}>{o.title}</div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{o.dateObj.toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontFamily: C.fontMono, fontSize: 12, fontWeight: 600, color: urgent ? C.red : soon ? C.gold : C.muted }}>{days}d</span>
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
              )
            })()}

            </div>

            <div style={{ position: 'relative', paddingLeft: 24, marginBottom: 40 }}>
              <div style={{ position: 'absolute', left: 0, top: 4, bottom: 4, width: 1, background: C.borderStrong }} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.muted }}>03</span>
                <span style={{ fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: C.forest, fontWeight: 600 }}>Trends and Insights</span>
              </div>

            {/* ── CONCENTRATION + LAPSED + GIVING CHANGES (3-across) ── */}
            {(() => {
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

              const allFlags = allGivingChangeFlags
              const flags = showAllGivingChanges ? allFlags : allFlags.slice(0, 3)

              const lapsedToday = new Date()
              const allLapsed = Object.values((() => {
                const map = {}
                confirmedDonations.forEach(d => {
                  const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
                  if (!map[key] || new Date(d.created_at) > new Date(map[key].lastDate)) {
                    map[key] = { name: d.donor_name, email: d.donor_email, lastDate: d.created_at, count: 0, total: 0 }
                  }
                  map[key].count++
                  map[key].total += d.amount
                })
                return map
              })()).filter(d => {
                const daysSince = Math.floor((lapsedToday - new Date(d.lastDate)) / (1000 * 60 * 60 * 24))
                return daysSince >= lapsedMinDays && d.count >= lapsedMinGifts
              }).map(d => ({ ...d, key: d.email?.trim() || d.name })).sort((a, b) => b.total - a.total)

              const isInReachOutCooldown = (donorKey) => {
                const history = lapsedReminderHistory[donorKey]
                if (!history || history.length === 0) return false
                const daysSinceReminder = Math.floor((lapsedToday - new Date(history[0].sent_at)) / (1000 * 60 * 60 * 24))
                return daysSinceReminder < 30
              }

              const lapsed = allLapsed.filter(d => !lapsedDismissals[d.key] && !isInReachOutCooldown(d.key)).slice(0, 5)
              const dismissedLapsed = allLapsed.filter(d => lapsedDismissals[d.key])

              return (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16, marginBottom: 20, alignItems: 'start' }}>
                  {/* Concentration */}
                  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '18px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, display: 'flex', alignItems: 'center', gap: 5 }}>Donor Concentration <InfoTip text="Share of total revenue coming from your top N donors, where N is selectable. High concentration means your income depends heavily on a small number of people." /></div>
                      <select style={{ fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 6px', color: C.forest, background: C.white, fontFamily: 'inherit' }} value={concentrationTopN} onChange={e => setConcentrationTopN(Number(e.target.value))}>
                        <option value={5}>Top 5</option>
                        <option value={10}>Top 10</option>
                        <option value={20}>Top 20</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <div style={{ fontFamily: C.fontVoice, fontSize: 34, fontWeight: 500, color: highRisk ? C.red : medRisk ? C.gold : C.forest, marginBottom: 2, lineHeight: 1 }}>{concentrationPct}%</div>
                      {concentrationTrend !== null && (
                        <span style={{ fontSize: 12, fontWeight: 600, color: concentrationTrend <= 0 ? C.sage : C.red }}>
                          {concentrationTrend === 0 ? '—' : concentrationTrend < 0 ? `↓ ${Math.abs(concentrationTrend)}pt` : `↑ ${concentrationTrend}pt`} vs 90d ago
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10 }}>of revenue from top {Math.min(concentrationTopN, sorted.length)} donors</div>
                    <div style={{ background: C.ivoryDark, borderRadius: 3, height: 6, overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ width: `${concentrationPct}%`, height: '100%', background: highRisk ? C.red : medRisk ? C.gold : C.sage, borderRadius: 3 }} />
                    </div>
                    <div style={{ fontSize: 11.5, color: highRisk ? C.red : medRisk ? C.gold : C.sage, fontWeight: 600, marginBottom: 10 }}>
                      {tooFewDonors ? 'Too few donors to assess yet' : highRisk ? '⚠ High risk — diversify donor base' : medRisk ? '⚠ Moderate risk' : '✓ Healthy diversification'}
                    </div>
                    <button style={{ ...s.viewBtn, fontSize: 11.5, padding: '6px 12px', width: '100%', justifyContent: 'center' }} onClick={() => { setFilterTopDonorNames(topDonorNames); setActiveTab('donors') }}>View Top Donors →</button>
                  </div>

                  {/* Lapsed Donors */}
                  <div id="lapsed-donors-card" style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '18px 20px', scrollMarginTop: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>Lapsed Donors <InfoTip text="Donors who have given at least this many times but haven't donated in over this many days. Both are adjustable below." /></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11.5, color: C.muted }}>Gave</span>
                      <input type="number" min={1} style={{ width: 40, fontSize: 11.5, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 4px', color: C.forest, textAlign: 'center' }} value={lapsedMinGifts} onChange={e => setLapsedMinGifts(Math.max(1, Number(e.target.value) || 1))} />
                      <span style={{ fontSize: 11.5, color: C.muted }}>+ times but haven't donated in</span>
                      <input type="number" min={1} style={{ width: 48, fontSize: 11.5, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 4px', color: C.forest, textAlign: 'center' }} value={lapsedMinDays} onChange={e => setLapsedMinDays(Math.max(1, Number(e.target.value) || 1))} />
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 26, height: 26, borderRadius: '50%', background: C.gold, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, fontFamily: C.fontVoice, flexShrink: 0 }}>{d.name?.charAt(0)}</div>
                              <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => { setSelectedDonor({ ...d, receipts: d.count }); setActiveTab('donors') }}>
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: C.forest, textDecoration: 'underline' }}>{d.name}</div>
                                <div style={{ fontSize: 10.5, color: C.muted }}>{daysSince}d ago · ${d.total.toLocaleString()} lifetime</div>
                              </div>
                            </div>
                            {reminderCount > 0 && (
                              <div style={{ fontSize: 10.5, color: C.gold, fontWeight: 600 }}>
                                ✉ Last reached out {Math.floor((new Date() - new Date(lapsedReminderHistory[donorKey][0].sent_at)) / (1000 * 60 * 60 * 24))}d ago · {reminderCount}× sent
                              </div>
                            )}
                            
                          </div>
                        )
                      })}
                    </div>
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
                                    <div style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>{d.name}</div>
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

                  {/* Giving Changes */}
                  <div id="giving-changes-card" style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '18px 20px', scrollMarginTop: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>Giving Changes <InfoTip text="Donors whose most recent gift differs from their historical average by at least this percentage, based on this many or more prior gifts. Both are adjustable below." /></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11.5, color: C.muted }}>Donors with</span>
                      <input type="number" min={2} style={{ width: 40, fontSize: 11.5, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 4px', color: C.forest, textAlign: 'center' }} value={givingChangeMinGifts} onChange={e => setGivingChangeMinGifts(Math.max(2, Number(e.target.value) || 2))} />
                      <span style={{ fontSize: 11.5, color: C.muted }}>+ gifts, changed by</span>
                      <input type="number" min={1} style={{ width: 44, fontSize: 11.5, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 4px', color: C.forest, textAlign: 'center' }} value={givingChangeMinPct} onChange={e => setGivingChangeMinPct(Math.max(1, Number(e.target.value) || 1))} />
                      <span style={{ fontSize: 11.5, color: C.muted }}>%+</span>
                    </div>
                    {flags.length === 0 ? (
                      <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No significant changes detected yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                        {flags.map((f, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: f.changePct < 0 ? '#FBEEE9' : '#EAF3EC', borderRadius: 4, cursor: 'pointer' }} onClick={() => { setSelectedDonor({ name: f.name, email: f.email, total: f.recent, count: givingChangeMinGifts, receipts: 0 }); setActiveTab('donors') }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, textDecoration: 'underline' }}>{f.name}</div>
                              <div style={{ fontSize: 11, color: C.muted }}>Avg was ${f.prevAvg} · Last gift ${f.recent.toLocaleString()}</div>
                            </div>
                            <span style={{ fontFamily: C.fontMono, fontSize: 13, fontWeight: 600, color: f.changePct < 0 ? C.red : C.sage }}>
                              {f.changePct > 0 ? '↑' : '↓'} {Math.abs(f.changePct)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {allFlags.length > 3 && (
                      <button style={{ fontSize: 11, color: C.muted, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }} onClick={() => setShowAllGivingChanges(v => !v)}>
                        {showAllGivingChanges ? 'Show top 3 only' : `Show all ${allFlags.length}`}
                      </button>
                    )}
                  </div>
                </div>
              )
            })()}

            

            {/* ── ACTIVE CAMPAIGNS + SEASONALITY + DONOR LTV (3-across) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>

              {myCauses.filter(c => c.status === 'approved' && c.type === 'campaign' && (!c.end_date || new Date(c.end_date) >= new Date())).length > 0 ? (
                <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '18px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, display: 'flex', alignItems: 'center', gap: 5 }}>Active Campaigns <InfoTip text="Campaigns currently live and accepting donations. Manage goals and end dates under Campaigns." /></div>
                    <div style={{ fontSize: 12, color: C.sage, fontWeight: 600, cursor: 'pointer' }} onClick={() => setActiveTab('promotions')}>Manage →</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {myCauses.filter(c => c.status === 'approved' && c.type === 'campaign' && (!c.end_date || new Date(c.end_date) >= new Date())).map(c => {
                      const stats = causeRaisedMap[c.id] || { total: 0, donors: new Set() }
                      const goal = c.target_amount || 0
                      const pct = goal > 0 ? Math.min(100, Math.round((stats.total / goal) * 100)) : 0
                      const daysLeft = c.end_date ? Math.max(0, Math.ceil((new Date(c.end_date) - new Date()) / (1000 * 60 * 60 * 24))) : null
                      const behindPace = goal > 0 && pct < 40
                      return (
                        <div key={c.id} style={{ background: C.ivory, borderRadius: 4, padding: 14, border: `1px solid ${C.border}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.forest }}>{c.title}</div>
                            <span style={s.badgeIssued}>✓ Live</span>
                          </div>
                          {goal > 0 && (
                            <div style={{ background: C.ivoryDark, borderRadius: 3, height: 5, overflow: 'hidden', marginBottom: 10 }}>
                              <div style={{ width: `${Math.max(pct, 2)}%`, height: '100%', background: behindPace ? C.gold : C.sage, borderRadius: 3 }} />
                            </div>
                          )}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                            <div><div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Raised</div><div style={{ fontFamily: C.fontMono, fontSize: 13, fontWeight: 500, color: C.forest }}>${stats.total.toLocaleString()}</div></div>
                            <div><div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Goal</div><div style={{ fontFamily: C.fontMono, fontSize: 13, fontWeight: 500, color: C.forest }}>{goal > 0 ? `$${goal.toLocaleString()}` : '—'}</div></div>
                            <div><div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Donors</div><div style={{ fontFamily: C.fontMono, fontSize: 13, fontWeight: 500, color: C.forest }}>{stats.donors.size}</div></div>
                            <div><div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ends</div><div style={{ fontFamily: C.fontMono, fontSize: 13, fontWeight: 500, color: C.forest }}>{daysLeft !== null ? `${daysLeft}d` : '—'}</div></div>
                          </div>
                          {goal > 0 && <div style={{ marginTop: 8, fontSize: 11, color: behindPace ? C.gold : C.muted, fontWeight: behindPace ? 600 : 400 }}>{behindPace ? `⚠ Behind pace · ${pct}% funded` : `${pct}% funded`}</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '18px 20px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 6 }}>Active Campaigns</div>
                  <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No active campaigns right now.</div>
                </div>
              )}

              {confirmedDonations.length > 0 && (() => {
              const years = [...new Set(confirmedDonations.map(d => new Date(d.created_at).getFullYear()))].sort()
              const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
              const data = years.map(year => ({
                year,
                monthly: months.map((_, m) => confirmedDonations.filter(d => new Date(d.created_at).getFullYear() === year && new Date(d.created_at).getMonth() === m).reduce((s, d) => s + d.amount, 0))
              }))
              const maxVal = Math.max(...data.flatMap(y => y.monthly))
              const colors = [C.forest, C.sage, C.gold, C.borderStrong]
              return (
                <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '18px 20px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5 }}>Seasonality Trends <InfoTip text="Monthly donation totals by year, so you can spot patterns like year-end giving spikes." /></div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 16 }}>Monthly donations by year</div>
                  <div style={{ overflowX: 'auto' }}>
                    <div style={{ minWidth: 400 }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 120, marginBottom: 8 }}>
                        {months.map((month, m) => (
                          <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            {data.map((y, yi) => (
                              <div key={yi} title={`${y.year} ${month}: $${y.monthly[m].toLocaleString()}`} style={{ width: '100%', height: maxVal > 0 ? `${Math.max(2, (y.monthly[m] / maxVal) * 80)}px` : '2px', background: colors[yi % colors.length], borderRadius: 3, opacity: 0.85 }} />
                            ))}
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {months.map((m, i) => <div key={i} style={{ flex: 1, fontSize: 9, color: C.muted, textAlign: 'center' }}>{m}</div>)}
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                        {data.map((y, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.muted }}><div style={{ width: 10, height: 10, borderRadius: 2, background: colors[i % colors.length] }} />{y.year}</div>)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}

              {/* Donor Lifetime Value */}
              {confirmedDonations.length > 0 && (() => {
                const sorted = Object.values((() => {
                  const map = {}
                  confirmedDonations.forEach(d => {
                    const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
                    if (!map[key]) map[key] = { name: d.donor_name, total: 0, count: 0, firstDate: d.created_at }
                    map[key].total += d.amount
                    map[key].count++
                    if (new Date(d.created_at) < new Date(map[key].firstDate)) map[key].firstDate = d.created_at
                  })
                  return map
                })()).sort((a, b) => b.total - a.total)
                const avgLTV = sorted.length > 0 ? Math.round(sorted.reduce((s, d) => s + d.total, 0) / sorted.length) : 0
                const avgGifts = sorted.length > 0 ? (sorted.reduce((s, d) => s + d.count, 0) / sorted.length).toFixed(1) : 0
                return (
                  <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '18px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, display: 'flex', alignItems: 'center', gap: 5 }}>Donor Lifetime Value <InfoTip text="Total giving per donor across all time. Shows your average and top donors by cumulative amount given." /></div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10.5, color: C.muted }}>Avg LTV</div>
                        <div style={{ fontFamily: C.fontVoice, fontSize: 17, fontWeight: 500, color: C.forest }}>${avgLTV.toLocaleString()}</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                      <div style={{ background: C.ivory, borderRadius: 4, padding: '9px 12px', border: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 10.5, color: C.muted }}>Avg gifts per donor</div>
                        <div style={{ fontFamily: C.fontMono, fontSize: 16, fontWeight: 500, color: C.forest }}>{avgGifts}</div>
                      </div>
                      <div style={{ background: C.ivory, borderRadius: 4, padding: '9px 12px', border: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 10.5, color: C.muted }}>Top donor LTV</div>
                        <div style={{ fontFamily: C.fontMono, fontSize: 16, fontWeight: 500, color: C.forest }}>${sorted[0]?.total.toLocaleString() || 0}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {sorted.slice(0, 5).map((d, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: C.ivory, borderRadius: 4 }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: [C.forest, C.sage, C.gold, C.borderStrong, C.muted][i], color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 600, fontFamily: C.fontVoice, flexShrink: 0 }}>{i + 1}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: C.forest }}>{d.name}</div>
                            <div style={{ fontSize: 10.5, color: C.muted }}>{d.count} gift{d.count !== 1 ? 's' : ''} since {new Date(d.firstDate).getFullYear()}</div>
                          </div>
                          <div style={{ fontFamily: C.fontMono, fontSize: 13, fontWeight: 500, color: C.forest, flexShrink: 0 }}>${d.total.toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

            </div>

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
                              <div style={{ ...s.donorAvatar, background: C.sage }}>{d.donor_name?.charAt(0)}</div>
                              <div>
                                <div style={s.donationCardName}>{d.donor_name}</div>
                                <div style={s.donationCardDate}>{new Date(d.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                              </div>
                            </div>
                            <div style={s.donationCardAmount}>${Number(d.amount).toLocaleString()}</div>
                          </div>
                          <div style={{ fontSize: 11, fontFamily: 'monospace', color: C.muted, marginBottom: 6 }}>{d.payment_ref || d.receipt_number || '—'}</div>
                          <div style={s.donationCardBadges}>
                            {causeNameForDonation(d) && <span style={{ fontSize: 10, fontWeight: 600, color: C.gold, background: '#FDF8EC', padding: '3px 10px', borderRadius: 20, display: 'inline-block' }}>🎯 {causeNameForDonation(d)}</span>}
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
                          const railColor = d.payment_status !== 'confirmed' ? C.red : !d.receipt_issued ? C.gold : C.sage
                          return (
                          <tr key={d.id} style={{ ...s.tr, borderLeft: `3px solid ${railColor}`, cursor: 'pointer' }} onClick={() => goToDonation(d)}>
                            <td style={s.td}><div style={s.donorCell}><div style={{ ...s.donorAvatar, background: C.sage }}>{d.donor_name?.charAt(0)}</div><div><div style={s.donorName}>{d.donor_name}</div>{d.notes && <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', marginTop: 2 }}>📝 {d.notes}</div>}</div></div></td>
                            <td style={s.td}><span style={s.amountText}>${Number(d.amount).toLocaleString()}</span></td>
                            <td style={s.td}><span style={s.dateText}>{new Date(d.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</span></td>
                            {!isTablet && (
                              <td style={s.td}>
                                {causeNameForDonation(d) ? (
                                  <span style={{ fontSize: 10, fontWeight: 600, color: C.gold, background: '#FDF8EC', padding: '3px 10px', borderRadius: 20, display: 'inline-block', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={causeNameForDonation(d)}>🎯 {causeNameForDonation(d)}</span>
                                ) : (
                                  <span style={{ fontSize: 11, color: C.muted }}>General</span>
                                )}
                              </td>
                            )}
                            {!isTablet && <td style={s.td}>{d.source === 'manual' ? <span style={{ ...s.badgePending, color: C.gold, background: '#FDF8EC' }}>✏️ {d.payment_method || 'Manual'}</span> : <span style={s.badgeIssued}>📱 App</span>}</td>}
                            {charityIsIpc && <td style={s.td}>{d.donor_nric ? <span style={s.badgeIssued}>✓ {d.donor_nric}</span> : <span style={s.badgePending}>⚠️ Missing</span>}</td>}
                            <td style={s.td}>
                              {d.payment_status === 'confirmed' ? <span style={s.badgeIssued}>✓ Paid</span> : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={s.badgePending}>⚠️ Unverified</span>
                                  <button
                                    style={{ fontSize: 10, fontWeight: 700, color: C.teal, background: 'white', border: `1px solid ${C.teal}`, borderRadius: 20, padding: '2px 8px', cursor: 'pointer' }}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setConfirmModal({
                                        title: 'Confirm this payment?',
                                        subtitle: 'Check the transaction reference against your bank or PayNow statement before confirming.',
                                        donorName: d.donor_name,
                                        amount: d.amount,
                                        reference: d.payment_ref || d.receipt_number,
                                        steps: ['Mark payment as confirmed', 'Issue a receipt', ...(d.donor_email ? ['Send a thank-you email'] : [])],
                                        confirmLabel: 'Confirm payment',
                                        onConfirm: () => confirmPaymentFlow(d),
                                      })
                                    }}
                                  >✓ Confirm</button>
                                </div>
                              )}
                            </td>
                            <td style={s.td}>{d.receipt_issued ? <span style={s.badgeIssued}>✓ Issued</span> : <span style={s.badgePending}>Pending</span>}</td>
                            {!isTablet && <td style={s.td}><span style={{ fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{d.payment_ref || d.receipt_number || '—'}</span></td>}
                            {!isTablet && <td style={s.td}>{d.thank_you_sent ? <span style={s.badgeIssued}>💌 Sent</span> : <span style={{ fontSize: 10, color: C.muted }}>—</span>}</td>}
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
                <div style={s.pageSub}>{uniqueDonors.length} donors · All time</div>
              </div>
            </div>
            {filterTopDonorNames && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 4, padding: '10px 14px', marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: C.forest, fontWeight: 600 }}>Showing top {filterTopDonorNames.length} donors by lifetime giving</span>
                <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px', marginLeft: 'auto' }} onClick={() => setFilterTopDonorNames(null)}>✕ Clear</button>
              </div>
            )}
            <div style={isMobile ? s.statsGridMobile : isTablet ? s.statsGridTablet : s.statsGrid}>
              <div style={{ ...s.statCard, background: C.forest, borderColor: C.forest }}>
                <div style={{ ...s.statLabel, color: 'rgba(255,255,255,0.7)' }}>Total Donors</div>
                <div style={{ ...s.statValue, color: 'white' }}>{uniqueDonors.length}</div>
              </div>
              <div style={s.statCard}>
                <div style={s.statLabel}>Avg. Donation</div>
                <div style={s.statValue}>${avgDonation.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div style={s.statCard}>
                <div style={s.statLabel}>Total Raised, All Time</div>
                <div style={s.statValue}>${totalAllTime.toLocaleString()}</div>
              </div>
              <div style={s.statCard}>
                <div style={s.statLabel}>Receipts Issued</div>
                <div style={s.statValue}>{issuedCount}</div>
                <div style={s.statNote}>of {donations.length} donations</div>
              </div>
            </div>
            {(() => {
              const allTags = [...new Set(Object.values(donorTagsMap).flat().map(t => t.tag))].sort()
              return (
                <div style={isMobile ? { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 } : { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input style={isMobile ? s.searchBox : { ...s.searchBox, flex: 'none', width: 240 }} placeholder="🔍 Search donors..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  <select style={s.filterSelect} value={filterDonorTag} onChange={e => setFilterDonorTag(e.target.value)}>
                    <option value="All">All Tags</option>
                    {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button style={isMobile ? { ...s.exportSmallBtn, width: '100%' } : s.exportSmallBtn} onClick={exportDonorContactsCSV}>📇 Export Contacts</button>
                  {charityIsIpc && (
                    <button style={isMobile ? { ...s.exportSmallBtn, width: '100%' } : s.exportSmallBtn} onClick={() => { if (filterYear === 'All') { showToast('Select a year first to export IRAS data'); return } exportIRASExcel() }}>⬇️ Export IRAS</button>
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
                  {activeDonorList.filter(d => {
                    const matchSearch = d.name?.toLowerCase().includes(searchTerm.toLowerCase())
                    const donorKey = d.email?.trim() || d.name
                    const matchTag = filterDonorTag === 'All' || (donorTagsMap[donorKey] || []).some(t => t.tag === filterDonorTag)
                    const matchTopDonors = !filterTopDonorNames || filterTopDonorNames.includes(d.name)
                    return matchSearch && matchTag && matchTopDonors
                  }).map((d, i) => (
                    <div key={i} style={s.donationCard} onClick={() => setSelectedDonor(d)}>
                      <div style={s.donationCardTop}>
                        <div style={s.donationCardDonor}>
                          <div style={{ ...s.donorAvatar, background: [C.sage, C.teal, C.gold, C.forest, C.red][i % 5] }}>{d.name?.charAt(0)}</div>
                          <div>
                            <div style={s.donationCardName}>{d.name}</div>
                            <div style={s.donationCardDate}>{d.count} donation{d.count > 1 ? 's' : ''} · Last {new Date(d.lastDate).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                          </div>
                        </div>
                        <div style={s.donationCardAmount}>${d.total.toLocaleString()}</div>
                      </div>
                      <div style={s.donationCardBadges}>
                        <span style={d.receipts === d.count ? s.badgeIssued : s.badgePending}>{d.receipts}/{d.count} receipts issued</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <table style={s.table}>
                  <thead>
                    <tr>{(isTablet ? ['Donor', 'Total Given', 'Receipts', ''] : ['Donor', 'Total Given', 'Donations', 'Last Donation', 'Milestones', 'Receipts', '']).map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {activeDonorList.filter(d => {
                      const matchSearch = d.name?.toLowerCase().includes(searchTerm.toLowerCase())
                      const donorKey = d.email?.trim() || d.name
                      const matchTag = filterDonorTag === 'All' || (donorTagsMap[donorKey] || []).some(t => t.tag === filterDonorTag)
                      const matchTopDonors = !filterTopDonorNames || filterTopDonorNames.includes(d.name)
                      return matchSearch && matchTag && matchTopDonors
                    }).map((d, i) => {
                      const key = d.email?.trim() || d.name
                      const b = donorBadgeMap[key]
                      const milestoneCount = b ? [b.isFirstTime, b.isBigGift, b.isLoyal, b.isBiggestYet].filter(Boolean).length : 0
                      const hasUnacked = b?.hasUnackedBadge
                      return (
                        <tr key={i} style={s.tr}>
                          <td style={s.td}>
                            <div style={s.donorCell}>
                              <div style={{ ...s.donorAvatar, background: [C.sage, C.teal, C.gold, C.forest, C.red][i % 5] }}>{d.name?.charAt(0)}</div>
                              <div>
                                <div style={s.donorName}>{d.name}</div>
                                {(() => {
                                  const donorKey = d.email?.trim() || d.name
                                  const tags = donorTagsMap[donorKey] || []
                                  return tags.length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
                                      {tags.slice(0, 3).map(t => (
                                        <span key={t.id} style={{ fontSize: 10, fontWeight: 600, color: C.teal, background: '#E8F0EE', padding: '2px 7px', borderRadius: 20 }}>{t.tag}</span>
                                      ))}
                                      {tags.length > 3 && <span style={{ fontSize: 10, color: C.muted }}>+{tags.length - 3}</span>}
                                    </div>
                                  ) : null
                                })()}
                              </div>
                            </div>
                          </td>
                          <td style={s.td}><span style={s.amountText}>${d.total.toLocaleString()}</span></td>
                          {!isTablet && <td style={s.td}><span style={s.dateText}>{d.count} donation{d.count > 1 ? 's' : ''}</span></td>}
                          {!isTablet && <td style={s.td}><span style={s.dateText}>{new Date(d.lastDate).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</span></td>}
                          {!isTablet && <td style={s.td}>
                            {milestoneCount > 0 ? (
                              <span style={{ ...(hasUnacked ? { color: C.gold, background: '#FDF8EC' } : s.badgeIssued) }}>
                                <span style={hasUnacked ? { fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20, display: 'inline-block', color: C.gold, background: '#FDF8EC' } : s.badgeIssued}>⭐ {milestoneCount}</span>
                              </span>
                            ) : <span style={{ fontSize: 11, color: C.muted }}>—</span>}
                          </td>}
                          <td style={s.td}><span style={d.receipts === d.count ? s.badgeIssued : s.badgePending}>{d.receipts}/{d.count} issued</span></td>
                          <td style={s.td}><button style={s.viewBtn} onClick={() => setSelectedDonor(d)}>View</button></td>
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
            <div style={isMobile ? s.twoColMobile : s.twoCol}>
              <div>
                <div style={{ ...s.card, background: C.teal, marginBottom: 16 }}>
                  <div style={{ ...s.donorAvatar, width: 56, height: 56, fontSize: 22, background: C.sage, marginBottom: 12 }}>{selectedDonor.name?.charAt(0)}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'white', marginBottom: 4 }}>{selectedDonor.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>Donor since {new Date(donations.filter(d => (d.donor_email?.trim() || d.donor_name) === (selectedDonor.email?.trim() || selectedDonor.name)).slice(-1)[0]?.created_at).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })}</div>
                </div>
                <div style={s.card}>
                  <div style={s.cardTitle}>Giving Summary</div>
                  <div style={s.infoGrid}>
                    <div style={{ ...s.infoItem, background: C.sage }}>
                      <div style={{ ...s.infoLabel, color: 'rgba(255,255,255,0.7)' }}>Total Given</div>
                      <div style={{ ...s.infoValue, color: 'white' }}>${selectedDonor.total.toLocaleString()}</div>
                    </div>
                    <div style={s.infoItem}>
                      <div style={s.infoLabel}>Donations</div>
                      <div style={s.infoValue}>{selectedDonor.count}</div>
                    </div>
                    <div style={s.infoItem}>
                      <div style={s.infoLabel}>Avg. Donation</div>
                      <div style={s.infoValue}>${(selectedDonor.total / selectedDonor.count).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div style={s.infoItem}>
                      <div style={s.infoLabel}>Receipts</div>
                      <div style={s.infoValue}>{selectedDonor.receipts}/{selectedDonor.count}</div>
                    </div>
                  </div>
                  {charityIsIpc && (
                    <div style={{ marginTop: 16, padding: 14, background: C.ivory, borderRadius: 12, border: `1px solid ${C.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: C.muted }}>250% Tax Deductible</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.forest }}>${(selectedDonor.total * 2.5).toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: C.muted }}>Est. Tax Savings (22%)</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.sage }}>${(selectedDonor.total * 2.5 * 0.22).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  )}
                </div>
                {(() => {
                  const donorKey = selectedDonor.email?.trim() || selectedDonor.name
                  const outreachHistory = lapsedReminderHistory[donorKey] || []
                  const dismissal = lapsedDismissals[donorKey]
                  const daysSinceLastGift = Math.floor((new Date() - new Date(donations.filter(dn => (dn.donor_email?.trim() || dn.donor_name) === donorKey).slice(-1)[0]?.created_at || new Date())) / (1000 * 60 * 60 * 24))
                  const isLapsed = daysSinceLastGift >= lapsedMinDays && selectedDonor.count >= lapsedMinGifts
                  if (outreachHistory.length === 0 && !dismissal && !isLapsed) return null
                  return (
                    <div style={{ ...s.card, marginTop: 16 }}>
                      <div style={{ ...s.cardTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        Outreach History
                        {isLapsed && !dismissal && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            {selectedDonor.email && <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px' }} onClick={() => { setLapsedReminderCandidate({ name: selectedDonor.name, email: selectedDonor.email, total: selectedDonor.total, count: selectedDonor.count }); setShowLapsedReminderModal(true) }}>✉ Reach Out</button>}
                            <button style={{ fontSize: 11, color: C.muted, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { setLapsedDismissReason(''); setShowLapsedDismissModal({ name: selectedDonor.name, email: selectedDonor.email }) }}>Not interested</button>
                          </div>
                        )}
                      </div>
                      {dismissal && (
                        <div style={{ background: C.ivory, borderRadius: 8, padding: '10px 12px', marginBottom: outreachHistory.length > 0 ? 10 : 0, border: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: C.muted }}>Marked not interested</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{new Date(dismissal.dismissed_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })} by {dismissal.dismissed_by}</div>
                          {dismissal.reason && <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', marginTop: 4 }}>"{dismissal.reason}"</div>}
                        </div>
                      )}
                      {outreachHistory.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {outreachHistory.map((r, i) => (
                            <div key={i} style={{ background: C.ivory, borderRadius: 8, padding: '10px 12px', border: `1px solid ${C.border}` }}>
                              <div style={{ fontSize: 12.5, fontWeight: 600, color: C.forest }}>✉ Re-engagement email sent</div>
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
                    <div style={{ ...s.card, marginTop: 16 }}>
                      <div style={s.cardTitle}>Giving Pattern</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: isUpgrade ? '#EAF3EC' : '#FBEEE9', borderRadius: 4, marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.forest }}>{isUpgrade ? 'Giving increased' : 'Giving decreased'}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>Avg was ${flagMatch.prevAvg} · Last gift ${flagMatch.recent.toLocaleString()}</div>
                        </div>
                        <span style={{ fontFamily: C.fontMono, fontSize: 13, fontWeight: 600, color: isUpgrade ? C.sage : C.red }}>
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
                    <div style={{ ...s.card, marginTop: 16 }}>
                      <div style={s.cardTitle}>Milestones</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: b.hasUnackedBadge ? 16 : 0 }}>
                        {b.isFirstTime && <span style={{ ...s.badgeIssued, color: C.gold, background: '#FDF8EC' }}>🆕 First donation</span>}
                        {b.isBigGift && <span style={s.badgeIssued}>💰 ${thankYouThreshold}+ gift</span>}
                        {b.isLoyal && <span style={{ ...s.badgeIssued, color: C.teal, background: '#E8F0EE' }}>🔁 Loyal donor</span>}
                        {b.isBiggestYet && <span style={{ ...s.badgeIssued, color: '#993C1D', background: '#FAECE7' }}>📈 Biggest gift yet</span>}
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
              <div style={{ ...s.card, marginBottom: 16 }}>
                <div style={s.cardTitle}>🏷️ Tags</div>
                {(() => {
                  const donorKey = selectedDonor.email?.trim() || selectedDonor.name
                  const tags = donorTagsMap[donorKey] || []
                  const presetTags = ['Major Donor', 'Monthly Giver', 'Event Donor', 'Corporate', 'Anonymous', 'In Memoriam', 'Board Member', 'Volunteer']
                  return (
                    <div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, minHeight: 28 }}>
                        {tags.length === 0 && <span style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}>No tags yet</span>}
                        {tags.map(t => (
                          <span key={t.id} style={{ fontSize: 11, fontWeight: 700, color: C.teal, background: '#E8F0EE', padding: '4px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {t.tag}
                            <span style={{ cursor: 'pointer', color: C.muted, fontSize: 12 }} onClick={() => deleteDonorTag(selectedDonor, t.id)}>✕</span>
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                        {presetTags.filter(p => !tags.some(t => t.tag === p)).map(p => (
                          <span
                            key={p}
                            style={{ fontSize: 11, color: C.muted, background: C.ivoryDark, padding: '4px 10px', borderRadius: 20, cursor: 'pointer', border: `1px dashed ${C.border}` }}
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

              <div style={{ ...s.card, marginBottom: 16 }}>
                <div style={s.cardTitle}>📋 Communication Log</div>
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
                        call:      { icon: '📞', label: 'Call',      color: C.teal },
                        email:     { icon: '📧', label: 'Email',     color: C.sage },
                        meeting:   { icon: '🤝', label: 'Meeting',   color: C.gold },
                        whatsapp:  { icon: '💬', label: 'WhatsApp',  color: C.sage },
                        note:      { icon: '📝', label: 'Note',      color: C.muted },
                      }
                      const tc = typeConfig[n.note_type] || typeConfig.note
                      return (
                        <div key={n.id} style={{ background: C.ivory, borderRadius: 10, padding: '12px 14px', border: `1px solid ${C.border}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 14 }}>{tc.icon}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: tc.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{tc.label}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 11, color: C.muted }}>{new Date(n.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })} · {new Date(n.created_at).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })}</span>
                              <span
                                style={{ fontSize: 11, color: C.red, cursor: 'pointer', fontWeight: 600 }}
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

              <div style={s.card}>
                <div style={s.cardTitle}>Donation History</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {donations.filter(d => (d.donor_email?.trim() || d.donor_name) === (selectedDonor.email?.trim() || selectedDonor.name)).map(d => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: C.ivory, borderRadius: 10, border: `1px solid ${C.border}` }}>
                      <div style={{ width: 36, height: 36, background: C.successBg, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💳</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.forest }}>{d.source === 'manual' ? `✏️ ${d.payment_method || 'Manual'}` : '📱 Giving Tree App'}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{new Date(d.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.forest }}>${Number(d.amount).toLocaleString()}</div>
                        <div style={{ fontSize: 10, color: d.receipt_issued ? C.sage : C.warning, fontWeight: 600 }}>{d.receipt_issued ? '✓ Issued' : 'Pending'}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>{d.name}</div>
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
              <div style={{ background: C.warningBg, border: `1.5px solid ${C.warningBorder}`, borderRadius: 12, padding: '12px 18px', marginBottom: 20, fontSize: 13, color: C.warning, fontWeight: 600 }}>
                👋 You're logged in as a volunteer. You can log new manual entries below. To view donor records or financials, please contact a staff member.
              </div>
            )}
            <div style={s.pageHeader}>
              <div>
                <div style={s.pageTitle}>Donations</div>
                <div style={s.pageSub}>{userRole === 'volunteer' ? 'Log a new donation below' : `${donations.length} total · ${donations.filter(d => d.source === 'manual').length} manual entries`}</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {userRole === 'staff' && pendingCountForYear > 0 && <button style={s.btnForest} onClick={issueAllReceipts} disabled={bulkActionInProgress}>{bulkActionInProgress ? '⏳ Issuing...' : `🧾 Issue All Pending (${pendingCountForYear})`}</button>}
                <button style={s.btnGold} onClick={() => setShowManualForm(true)}>+ Manual Entry</button>
              </div>
            </div>

            {showManualForm && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => { setShowManualForm(false); setManualError('') }}>
                <div style={{ background: C.ivory, borderRadius: 16, padding: isMobile ? 20 : 28, maxWidth: 720, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: C.forest }}>📝 New Manual Entry</div>
                    <button style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer', lineHeight: 1 }} onClick={() => { setShowManualForm(false); setManualError('') }}>✕</button>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 18 }}>Log a cash, cheque, or wire donation received outside the app.</div>
                  {manualError && <div style={{ background: C.warningBg, color: C.warning, padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12 }}>{manualError}</div>}
                  {manualDuplicateWarning && (
                    <div style={{ background: '#FDF3DC', border: `1.5px solid ${C.warningBorder}`, borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.warning, marginBottom: 8 }}>⚠️ Possible duplicate donor</div>
                      <div style={{ fontSize: 12, color: C.warning, marginBottom: 10 }}>We found {manualDuplicateWarning.length} existing donor{manualDuplicateWarning.length > 1 ? 's' : ''} with a similar name. Is this the same person?</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                        {manualDuplicateWarning.slice(0, 3).map((d, i) => (
                          <div key={i} style={{ background: C.white, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: C.forest }}>
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
                          onClick={() => { setManualDuplicateWarning(null); setManualForm(f => ({ ...f, donor_name: manualDuplicateWarning[0].name })) }}
                        >Use existing name</button>
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div><div style={s.formLabel}>Donor Name *</div><input style={s.formInput} placeholder="Full name" value={manualForm.donor_name} onChange={e => setManualForm(f => ({ ...f, donor_name: e.target.value }))} /></div>
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
                <div style={{ background: C.ivory, borderRadius: 16, padding: 28, maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.forest, marginBottom: 2 }}>{payNowQrDonation.donor_name}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: C.forest, marginBottom: 16 }}>SGD ${Number(payNowQrDonation.amount).toFixed(2)}</div>
                  <div style={{ background: 'white', borderRadius: 16, padding: 16, border: `1.5px solid ${C.border}`, display: 'inline-block', marginBottom: 14 }}>
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
              <button style={isMobile ? { ...s.exportSmallBtn, width: '100%' } : s.exportSmallBtn} onClick={exportDonationsExcel}>⬇️ Export to Excel</button>
              <button
                style={bulkEditMode ? { ...s.viewBtn, background: C.teal, color: 'white', borderColor: C.teal } : s.viewBtn}
                onClick={() => { setBulkEditMode(v => !v); if (bulkEditMode) setSelectedDonationIds([]) }}
              >{bulkEditMode ? '✕ Exit Bulk Edit' : '☑️ Bulk Edit'}</button>
              {activeDonationFilterCount > 0 && (
                <button style={{ ...s.viewBtn, whiteSpace: 'nowrap' }} onClick={clearDonationFilters}>✕ Clear Filters ({activeDonationFilterCount})</button>
              )}
            </div>

            {bulkProgress && (
              <div style={{ background: C.forest, borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                  Issuing {bulkProgress.done} of {bulkProgress.total}...
                </span>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.2)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%`, height: '100%', background: C.gold, borderRadius: 6, transition: 'width 0.2s' }} />
                </div>
                <button
                  style={{ ...s.bannerBtn, background: 'white', color: C.red, flexShrink: 0 }}
                  onClick={() => { bulkCancelRef.current = true }}
                >✕ Cancel</button>
              </div>
            )}

            {selectedDonationIds.length > 0 && (
              <div style={{ background: C.teal, borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{selectedDonationIds.length} selected</span>
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
                <button style={{ ...s.bannerBtn, background: 'white', color: C.teal }} onClick={bulkIssueSelectedReceipts} disabled={bulkActionInProgress}>🧾 Issue Receipts</button>
                {charityIsIpc && (
                  <button style={{ ...s.bannerBtn, background: 'white', color: C.teal }} onClick={bulkRequestSelectedNric} disabled={bulkActionInProgress}>🪪 Request NRIC</button>
                )}
                <button style={{ ...s.bannerBtn, background: 'white', color: C.red }} onClick={bulkDeleteSelectedManual} disabled={bulkActionInProgress}>🗑️ Delete Manual</button>
                <button style={{ ...s.bannerBtn, background: 'rgba(255,255,255,0.15)', color: 'white' }} onClick={() => setSelectedDonationIds([])}>✕ Clear Selection</button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {userRole === 'volunteer' ? (
                  <div style={{ ...s.tableCard }}>
                    <div style={s.empty}>Your manual entries have been saved. A staff member can review them in the full donations list.</div>
                  </div>
                ) : <div style={s.tableCard}>
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
                        const isReceipted = d.receipt_issued
                        const needsThanking = isPaid && isReceipted && d.donor_email?.trim() && !d.thank_you_sent
                        const railColor = !isPaid ? C.red : (!isReceipted || needsThanking) ? C.gold : C.sage
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
                                  <span style={{ fontSize: 10, fontWeight: 600, color: '#854F0B', background: '#FDF8EC', padding: '3px 9px', borderRadius: 20 }}>{causeNameForDonation(d)}</span>
                                ) : (
                                  <span style={{ fontSize: 10, color: C.muted, background: C.ivoryDark, padding: '3px 9px', borderRadius: 20 }}>General</span>
                                )}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                {isPaid ? (
                                  <span style={{ fontSize: 10, fontWeight: 600, color: '#3B6D11', background: '#EAF3DE', padding: '3px 9px', borderRadius: 20 }}>Paid</span>
                                ) : (
                                  <span
                                    style={{ fontSize: 10, fontWeight: 600, color: '#A32D2D', background: '#FCEBEB', padding: '3px 9px', borderRadius: 20, cursor: 'pointer' }}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setConfirmModal({
                                        title: 'Confirm this payment?',
                                        subtitle: 'Check the transaction reference against your bank or PayNow statement before confirming.',
                                        donorName: d.donor_name,
                                        amount: d.amount,
                                        reference: d.payment_ref || d.receipt_number,
                                        steps: ['Mark payment as confirmed', 'Issue a receipt', ...(d.donor_email ? ['Send a thank-you email'] : [])],
                                        confirmLabel: 'Confirm payment',
                                        onConfirm: () => confirmPaymentFlow(d),
                                      })
                                    }}
                                  >Unpaid · tap to confirm</span>
                                )}
                                {isPaid && (isReceipted ? (
                                  <span style={{ fontSize: 10, fontWeight: 600, color: '#3B6D11', background: '#EAF3DE', padding: '3px 9px', borderRadius: 20 }}>Receipted</span>
                                ) : (
                                  <span style={{ fontSize: 10, fontWeight: 600, color: '#854F0B', background: '#FAEEDA', padding: '3px 9px', borderRadius: 20 }}>Receipt pending</span>
                                ))}
                                {isPaid && isReceipted && d.donor_email?.trim() && (
                                  d.thank_you_sent ? (
                                    <span style={{ fontSize: 10, fontWeight: 600, color: '#3B6D11', background: '#EAF3DE', padding: '3px 9px', borderRadius: 20 }}>Thanked</span>
                                  ) : (
                                    <span style={{ fontSize: 10, fontWeight: 600, color: '#854F0B', background: '#FAEEDA', padding: '3px 9px', borderRadius: 20 }}>Not thanked</span>
                                  )
                                )}
                                {charityIsIpc && !d.donor_nric && isPaid && (
                                  <span style={{ fontSize: 10, fontWeight: 600, color: '#854F0B', background: '#FAEEDA', padding: '3px 9px', borderRadius: 20 }}>NRIC missing</span>
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
                            : charityIsIpc ? ['Donor', 'Amount', 'Date', 'Cause', 'Source', 'NRIC', 'Payment', 'Receipt', 'Receipt No.', 'Thank You'] : ['Donor', 'Amount', 'Date', 'Cause', 'Source', 'Payment', 'Receipt', 'Receipt No.', 'Thank You']
                          ).map(h => {
                            const sortKey = h === 'Amount' ? 'amount' : h === 'Date' ? 'date' : h === 'Donor' ? 'donor' : h === 'Cause' ? 'cause' : null
                            return (
                              <th key={h} style={{ ...s.th, cursor: sortKey ? 'pointer' : 'default', userSelect: 'none' }} onClick={() => {
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
                          const isReceipted = d.receipt_issued
                          const railColor = !isPaid ? C.red : !isReceipted ? C.gold : C.sage
                          const rowBg = selectedDonation?.id === d.id ? C.successBg : selectedDonationIds.includes(d.id) ? C.warningBg : d.source === 'manual' ? '#FDFBF6' : 'transparent'
                          return (
                          <tr key={d.id} ref={selectedDonation?.id === d.id ? selectedRowRef : null} style={{ ...s.tr, background: rowBg, borderLeft: `3px solid ${railColor}`, cursor: 'pointer' }} onClick={() => { if (bulkEditMode) { toggleDonationSelected(d.id) } else { setSelectedDonation(d); setQuickEmailInput(''); setQuickNricInput('') } }}>
                            {bulkEditMode && (
                              <td style={s.td} onClick={e => e.stopPropagation()}>
                                <input type="checkbox" checked={selectedDonationIds.includes(d.id)} onChange={() => toggleDonationSelected(d.id)} />
                              </td>
                            )}
                            <td style={s.td}><div style={s.donorCell}><div style={{ ...s.donorAvatar, background: C.sage }}>{d.donor_name?.charAt(0)}</div><div><div style={s.donorName}>{d.donor_name}</div>{d.notes && <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', marginTop: 2 }}>📝 {d.notes}</div>}</div></div></td>
                            <td style={s.td}><span style={s.amountText}>${Number(d.amount).toLocaleString()}</span></td>
                            <td style={s.td}><span style={s.dateText}>{new Date(d.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</span></td>
                            {!isTablet && (
                              <td style={s.td}>
                                {causeNameForDonation(d) ? (
                                  <span style={{ fontSize: 10, fontWeight: 600, color: C.gold, background: '#FDF8EC', padding: '3px 10px', borderRadius: 20, display: 'inline-block', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={causeNameForDonation(d)}>🎯 {causeNameForDonation(d)}</span>
                                ) : (
                                  <span style={{ fontSize: 11, color: C.muted }}>General</span>
                                )}
                              </td>
                            )}
                            {!isTablet && <td style={s.td}>{d.source === 'manual' ? <span style={{ ...s.badgePending, color: C.gold, background: '#FDF8EC' }}>✏️ {d.payment_method || 'Manual'}</span> : <span style={s.badgeIssued}>📱 App</span>}</td>}
                            {charityIsIpc && <td style={s.td}>{d.donor_nric ? <span style={s.badgeIssued}>✓ {d.donor_nric}</span> : <span style={s.badgePending}>⚠️ Missing</span>}</td>}
                            <td style={s.td}>
                              {d.payment_status === 'confirmed' ? <span style={s.badgeIssued}>✓ Paid</span> : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={s.badgePending}>⚠️ Unverified</span>
                                  <button
                                    style={{ fontSize: 10, fontWeight: 700, color: C.teal, background: 'white', border: `1px solid ${C.teal}`, borderRadius: 20, padding: '2px 8px', cursor: 'pointer' }}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setConfirmModal({
                                        title: 'Confirm this payment?',
                                        subtitle: 'Check the transaction reference against your bank or PayNow statement before confirming.',
                                        donorName: d.donor_name,
                                        amount: d.amount,
                                        reference: d.payment_ref || d.receipt_number,
                                        steps: ['Mark payment as confirmed', 'Issue a receipt', ...(d.donor_email ? ['Send a thank-you email'] : [])],
                                        confirmLabel: 'Confirm payment',
                                        onConfirm: () => confirmPaymentFlow(d),
                                      })
                                    }}
                                  >✓ Confirm</button>
                                </div>
                              )}
                            </td>
                            <td style={s.td}>{d.receipt_issued ? <span style={s.badgeIssued}>✓ Issued</span> : <span style={s.badgePending}>Pending</span>}</td>
                            {!isTablet && <td style={s.td}><span style={{ fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{d.payment_ref || d.receipt_number || '—'}</span></td>}
                            {!isTablet && <td style={s.td}>{d.thank_you_sent ? <span style={s.badgeIssued}>💌 Sent</span> : <span style={{ fontSize: 10, color: C.muted }}>—</span>}</td>}
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

              {userRole === 'staff' && selectedDonation && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 24 }} onClick={() => { setSelectedDonation(null); setEditingManual(false); setEditForm({}); setQuickEmailInput(''); setQuickNricInput('') }}>
                <div style={isMobile ? { background: C.white, width: '100%', height: '100%', overflowY: 'auto' } : { width: 760, maxWidth: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', borderRadius: 16 }} onClick={e => e.stopPropagation()}>
                  <div style={isMobile ? { background: C.white, minHeight: '100%', padding: 20 } : { background: C.ivory, borderRadius: 16, overflow: 'hidden', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 28 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 52, height: 52, borderRadius: 12, background: C.forest, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: 'white', flexShrink: 0 }}>{selectedDonation.donor_name?.charAt(0)}</div>
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
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#3B6D11', background: '#EAF3DE', padding: '4px 10px', borderRadius: 20 }}>Paid</span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#A32D2D', background: '#FCEBEB', padding: '4px 10px', borderRadius: 20 }}>Unpaid</span>
                        )}
                        {selectedDonation.payment_status === 'confirmed' && (
                          selectedDonation.receipt_issued ? (
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#3B6D11', background: '#EAF3DE', padding: '4px 10px', borderRadius: 20 }}>Receipted</span>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#854F0B', background: '#FAEEDA', padding: '4px 10px', borderRadius: 20 }}>Receipt pending</span>
                          )
                        )}
                        {selectedDonation.payment_status === 'confirmed' && selectedDonation.receipt_issued && selectedDonation.donor_email?.trim() && (
                          selectedDonation.thank_you_sent ? (
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#3B6D11', background: '#EAF3DE', padding: '4px 10px', borderRadius: 20 }}>Thanked</span>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#854F0B', background: '#FAEEDA', padding: '4px 10px', borderRadius: 20 }}>Not thanked</span>
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
                              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.value}</span>
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
                            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>${Number(selectedDonation.amount).toLocaleString()}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                          <span style={{ fontSize: 13, color: C.muted }}>Date</span>
                          {editingManual && selectedDonation.source === 'manual' ? (
                            <input type="date" style={{ ...s.formInput, padding: '4px 8px', fontSize: 12, width: 140, textAlign: 'right' }}
                              value={editForm.created_at || selectedDonation.created_at?.split('T')[0]}
                              onChange={e => setEditForm(f => ({ ...f, created_at: e.target.value }))} />
                          ) : (
                            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{new Date(selectedDonation.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
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
                              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{selectedDonation.payment_method || '—'}</span>
                            )}
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                          <span style={{ fontSize: 13, color: C.muted }}>Cause</span>
                          {causeNameForDonation(selectedDonation) ? (
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.warning, background: C.warningBg, padding: '3px 10px', borderRadius: 20 }}>{causeNameForDonation(selectedDonation)}</span>
                          ) : (
                            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>General Donation</span>
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
                            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{selectedDonation.receipt_name || selectedDonation.donor_name}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                          <span style={{ fontSize: 13, color: C.muted }}>Receipt No.</span>
                          {editingManual && selectedDonation.source === 'manual' ? (
                            <input type="text" style={{ ...s.formInput, padding: '4px 8px', fontSize: 12, width: 160, textAlign: 'right' }}
                              value={editForm.receipt_number ?? (selectedDonation.receipt_number || '')}
                              onChange={e => setEditForm(f => ({ ...f, receipt_number: e.target.value }))} />
                          ) : (
                            <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: 'monospace' }}>{selectedDonation.source === 'manual' ? (selectedDonation.receipt_number || '—') : (selectedDonation.payment_ref || '—')}</span>
                          )}
                        </div>
                        {selectedDonation.reissued_from && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                            <span style={{ fontSize: 13, color: C.muted }}>Reissued From</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: C.warning, fontFamily: 'monospace' }}>{selectedDonation.reissued_from} (voided)</span>
                          </div>
                        )}
                        {selectedDonation.void_reason && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                            <span style={{ fontSize: 13, color: C.muted }}>Void Reason</span>
                            <span style={{ fontSize: 12, color: C.muted, fontStyle: 'italic', maxWidth: 200, textAlign: 'right' }}>{selectedDonation.void_reason}</span>
                          </div>
                        )}
                      </div>

                      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Notes</div>
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
                        <div style={{ background: C.white, borderRadius: 12, padding: '14px 16px', border: `1px dashed ${C.border}`, cursor: 'pointer', minHeight: 20, marginBottom: 20 }}
                          onClick={() => { setEditingNoteId(selectedDonation.id); setNoteText(selectedDonation.notes || '') }}>
                          {selectedDonation.notes
                            ? <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{selectedDonation.notes}</div>
                            : <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>Click to add a note...</div>
                          }
                        </div>
                      )}

                      {/* ACTIONS */}
                      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {selectedDonation.receipt_issued && (
                          <button style={{ ...s.viewBtn, justifyContent: 'center', opacity: charityIpcLoaded ? 1 : 0.5 }} disabled={!charityIpcLoaded} onClick={() => exportSingleReceiptPDF(selectedDonation)}>📄 Download Receipt PDF</button>
                        )}
                        {selectedDonation.payment_status === 'confirmed' && pledges.filter(p => p.status === 'pending').length > 0 && (
                          <button style={{ ...s.viewBtn, justifyContent: 'center' }} onClick={() => setShowManualPledgeLinkModal(true)}>🤝 Link to Pledge</button>
                        )}
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
                              steps: ['Mark payment as confirmed', 'Issue a receipt', ...(selectedDonation.donor_email ? ['Send a thank-you email'] : [])],
                              confirmLabel: 'Confirm payment',
                              onConfirm: () => confirmPaymentFlow(selectedDonation),
                            })
                          }}>✓ Confirm Payment & Issue Receipt</button>
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
                        {selectedDonation.donor_email?.trim() && (
                          <button
                            style={{ ...s.btnGold, justifyContent: 'center', opacity: (selectedDonation.thank_you_sent || sendingThankYouId === selectedDonation.id) ? 0.7 : 1, cursor: sendingThankYouId === selectedDonation.id ? 'default' : 'pointer' }}
                            disabled={sendingThankYouId === selectedDonation.id}
                            onClick={() => {
                              if (selectedDonation.thank_you_sent) {
                                setConfirmModal({
                                  title: 'Send this email again?',
                                  description: 'A thank you email was already sent for this donation.',
                                  confirmLabel: 'Send again',
                                  onConfirm: () => sendThankYouEmail(selectedDonation),
                                })
                              } else {
                                sendThankYouEmail(selectedDonation)
                              }
                            }}
                          >{sendingThankYouId === selectedDonation.id ? '⏳ Sending...' : '💌 Send Thank You Email'}</button>
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
                <div style={s.pageTitle}>Analytics</div>
                <div style={s.pageSub}>Donation trends and donor insights for {charityName}</div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button style={s.viewBtn} onClick={() => { setCustomizeMetricsDraft(visibleMetrics); setShowCustomizeAnalytics(true) }}>⚙️ Customize</button>
                <button style={s.exportSmallBtn} onClick={exportAnalyticsPDF}>📄 Export Snapshot</button>
                <button style={{ ...s.exportSmallBtn, background: C.gold, color: C.forest }} onClick={exportBoardPacket}>📦 Board Packet</button>
                <select style={{ ...s.filterSelect, padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700 }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                  {donations.length === 0
    ? <option>{new Date().getFullYear()}</option>
    : [...new Set(donations.map(d => new Date(d.created_at).getFullYear()))].sort((a,b) => b-a).map(y => <option key={y}>{y}</option>)
  }
                </select>
              </div>
            </div>

            {visibleMetrics.includes('story_mode') && (() => {
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
                <div style={{ background: C.forest, borderRadius: 16, padding: 24, marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Your Story So Far</div>
                  <div style={{ fontSize: 16, color: 'white', lineHeight: 1.7 }}>{sentences.join(' ')}</div>
                </div>
              )
            })()}

            {visibleMetrics.includes('health_check') && (() => {
              const scoped = (filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear))).filter(d => d.payment_status === 'confirmed')
              if (scoped.length === 0) return null
              const totalAmt = scoped.reduce((s, d) => s + d.amount, 0)
              const byDonor = {}
              scoped.forEach(d => { const key = d.donor_email?.trim() || d.donor_nric || d.donor_name; byDonor[key] = (byDonor[key] || 0) + d.amount })
              const sortedDonors = Object.values(byDonor).sort((a, b) => b - a)
              const top3Pct = totalAmt > 0 ? Math.round((sortedDonors.slice(0, 3).reduce((s, v) => s + v, 0) / totalAmt) * 100) : 0
              const diversityStatus = top3Pct >= 60 ? 'red' : top3Pct >= 40 ? 'amber' : 'green'

              const periodYear = filterYear === 'All' ? new Date().getFullYear() : parseInt(filterYear)
              const donorsLastYr = new Set(donations.filter(d => d.payment_status === 'confirmed' && new Date(d.created_at).getFullYear() === periodYear - 1).map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name))
              const donorsThisYr = new Set(scoped.map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name))
              const retained = [...donorsLastYr].filter(k => donorsThisYr.has(k)).length
              const retentionPct = donorsLastYr.size > 0 ? Math.round((retained / donorsLastYr.size) * 100) : null
              const retentionStatus = retentionPct === null ? 'gray' : retentionPct >= 45 ? 'green' : retentionPct >= 25 ? 'amber' : 'red'

              const owedCount = donations.filter(d => d.payment_status === 'confirmed' && d.receipt_issued && d.donor_email?.trim() && !d.thank_you_sent).length
              const totalThankable = donations.filter(d => d.payment_status === 'confirmed' && d.donor_email?.trim()).length
              const owedPct = totalThankable > 0 ? Math.round((owedCount / totalThankable) * 100) : 0
              const thankStatus = owedPct >= 40 ? 'red' : owedPct >= 15 ? 'amber' : 'green'

              const colorMap = { green: { bg: C.successBg, text: C.forest, dot: C.sage, label: 'Good' }, amber: { bg: C.warningBg, text: C.warning, dot: C.warning, label: 'Watch' }, red: { bg: '#FBE9E7', text: C.red, dot: C.red, label: 'Needs attention' }, gray: { bg: C.ivory, text: C.muted, dot: C.border, label: 'Not enough data' } }
              const lights = [
                { label: 'Funding diversity', status: diversityStatus, jump: () => setVisibleMetrics(prev => prev.includes('concentration_risk') ? prev : [...prev, 'concentration_risk']) },
                { label: 'Donor retention', status: retentionStatus, jump: () => setVisibleMetrics(prev => prev.includes('donor_retention') ? prev : [...prev, 'donor_retention']) },
                { label: 'Thank-you timeliness', status: thankStatus, jump: () => { clearDonationFilters({ keepYear: false }); setFilterThankYou('Not Sent'); setActiveTab('donations') } },
              ]
              return (
                <div style={{ ...s.card, marginBottom: 24 }}>
                  <div style={s.cardTitle}>🩺 Health Check</div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
                    {lights.map((l, i) => {
                      const c = colorMap[l.status]
                      return (
                        <div key={i} onClick={l.jump} style={{ background: c.bg, borderRadius: 10, padding: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 12, height: 12, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: c.text }}>{l.label}</div>
                            <div style={{ fontSize: 11, color: c.text, opacity: 0.85 }}>{c.label}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            <div style={{ background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14 }}>💰 Financial Health</div>
            <div style={isMobile ? s.statsGridMobile : isTablet ? s.statsGridTablet : s.statsGrid}>
              {visibleMetrics.includes('total_raised') && (
                <div style={{ ...s.statCard, background: C.forest, borderColor: C.forest }}>
                  <div style={{ ...s.statLabel, color: 'rgba(255,255,255,0.7)' }}>Total Raised</div>
                  <div style={{ ...s.statValue, color: 'white' }}>${totalThisYear.toLocaleString()}</div>
                  <div style={{ ...s.statNote, color: 'rgba(255,255,255,0.6)' }}>Year to date</div>
                </div>
              )}
              <div style={s.statCard}>
                <div style={s.statLabel}>Unique Donors</div>
                <div style={s.statValue}>{uniqueDonorsThisYear.length}</div>
                <div style={s.statNote}>{filterYear}</div>
              </div>
              {visibleMetrics.includes('avg_gift') && (
                <div style={s.statCard}>
                  <div style={s.statLabel}>Avg. Donation</div>
                  <div style={s.statValue}>${avgDonation.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <div style={s.statNote}>Per transaction</div>
                </div>
              )}
              {visibleMetrics.includes('median_donation') && (
                <div style={s.statCard}>
                  <div style={s.statLabel}>Median Donation</div>
                  <div style={s.statValue}>${medianDonation.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <div style={s.statNote}>Typical single gift, {filterYear}</div>
                </div>
              )}
              <div style={s.statCard}>
                <div style={s.statLabel}>Total Transactions</div>
                <div style={s.statValue}>{donations.length}</div>
                <div style={s.statNote}>All time</div>
              </div>
              <div style={s.statCard}>
                <div style={s.statLabel}>Repeat Donors, Current Month</div>
                <div style={s.statValue}>{repeatDonorsThisMonth}</div>
                <div style={s.statNote}>Live — not affected by year filter above</div>
              </div>
              <div style={s.statCard}>
                <div style={s.statLabel}>Longest Supporter</div>
                <div style={s.statValue}>{longestSupporter ? `${longestSupporter.monthsSupporting} mo${longestSupporter.monthsSupporting > 1 ? 's' : ''}` : '—'}</div>
                <div style={s.statNote}>{longestSupporter ? longestSupporter.name : 'No donors yet'}</div>
              </div>
              {visibleMetrics.includes('donor_retention') && (() => {
                const now2 = new Date()
                const thisYearNum = now2.getFullYear()
                const lastYearNum = thisYearNum - 1
                const donorsLastYear = new Set(donations.filter(d => new Date(d.created_at).getFullYear() === lastYearNum).map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name))
                const donorsThisYear = new Set(donations.filter(d => new Date(d.created_at).getFullYear() === thisYearNum).map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name))
                const retained = [...donorsLastYear].filter(k => donorsThisYear.has(k)).length
                const retentionRate = donorsLastYear.size > 0 ? Math.round((retained / donorsLastYear.size) * 100) : null
                const isOpen = explainerOpen === 'donor_retention'
                return (
                  <div style={s.statCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={s.statLabel}>Donor Retention</div>
                      <span style={{ fontSize: 11, color: C.sage, fontWeight: 700, cursor: 'pointer', border: `1px solid ${C.sage}`, borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setExplainerOpen(isOpen ? null : 'donor_retention')}>?</span>
                    </div>
                    <div style={s.statValue}>{retentionRate === null ? '—' : `${retentionRate}%`}</div>
                    <div style={s.statNote}>{donorsLastYear.size > 0 ? `${retained} of ${donorsLastYear.size} from ${lastYearNum} gave again` : `No donors in ${lastYearNum} to compare`}</div>
                    {isOpen && retentionRate !== null && (
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.ivoryDark}`, lineHeight: 1.5 }}>
                        This means {retentionRate}% of people who gave in {lastYearNum} came back and gave again in {thisYearNum}. The sector average for nonprofits is roughly 40–45%, so {retentionRate >= 45 ? "you're doing better than typical" : retentionRate >= 25 ? "you're around the lower end of typical — worth a stewardship push" : "this is below typical, and improving how you thank and follow up with donors usually helps most here"}.
                      </div>
                    )}
                  </div>
                )
              })()}
              {visibleMetrics.includes('new_vs_returning') && (() => {
                const yearScoped2 = filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear))
                const donorFirstSeen = {}
                ;[...donations].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).forEach(d => {
                  const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
                  if (!donorFirstSeen[key]) donorFirstSeen[key] = new Date(d.created_at).getFullYear()
                })
                const donorKeysThisPeriod = new Set(yearScoped2.map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name))
                const periodYear = filterYear === 'All' ? null : parseInt(filterYear)
                let newCount = 0, returningCount = 0
                donorKeysThisPeriod.forEach(key => {
                  if (periodYear === null || donorFirstSeen[key] === periodYear) newCount++
                  else returningCount++
                })
                return (
                  <div style={s.statCard}>
                    <div style={s.statLabel}>New vs Returning</div>
                    <div style={s.statValue}>{newCount} / {returningCount}</div>
                    <div style={s.statNote}>New donors / returning donors, {filterYear}</div>
                  </div>
                )
              })()}
            </div>

            {filterYear !== 'All' && (
              <div style={{ ...s.card, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: annualGoal ? 12 : 0 }}>
                  <div style={{ ...s.cardTitle, marginBottom: 0 }}>🎯 Annual Fundraising Goal — {filterYear}</div>
                  {!editingGoal && (
                    <span style={{ fontSize: 12, color: C.sage, fontWeight: 600, cursor: 'pointer' }} onClick={() => { setGoalInput(annualGoal?.toString() || ''); setEditingGoal(true) }}>
                      {annualGoal ? 'Edit' : '+ Set Goal'}
                    </span>
                  )}
                </div>
                {editingGoal ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={s.formInput} type="number" placeholder="e.g. 50000" value={goalInput} onChange={e => setGoalInput(e.target.value)} />
                    <button style={{ ...s.issueBtn, flexShrink: 0 }} onClick={saveAnnualGoal}>Save</button>
                    <button style={{ ...s.viewBtn, flexShrink: 0 }} onClick={() => setEditingGoal(false)}>Cancel</button>
                  </div>
                ) : annualGoal ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: C.forest }}>${totalThisYear.toLocaleString()}</span>
                      <span style={{ fontSize: 13, color: C.muted }}>of ${annualGoal.toLocaleString()} goal</span>
                    </div>
                    <div style={{ background: C.ivoryDark, borderRadius: 6, height: 10, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, Math.round((totalThisYear / annualGoal) * 100))}%`, height: '100%', background: totalThisYear >= annualGoal ? C.sage : C.gold, borderRadius: 6 }} />
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{Math.round((totalThisYear / annualGoal) * 100)}% of goal reached</div>
                    {visibleMetrics.includes('goal_pacing') && parseInt(filterYear) === new Date().getFullYear() && (() => {
                      const yearStart = new Date(parseInt(filterYear), 0, 1)
                      const now5 = new Date()
                      const yearEnd = new Date(parseInt(filterYear), 11, 31)
                      const daysElapsed = Math.max(1, Math.ceil((now5 - yearStart) / (1000 * 60 * 60 * 24)))
                      const totalDaysInYear = Math.ceil((yearEnd - yearStart) / (1000 * 60 * 60 * 24))
                      const dailyRate = totalThisYear / daysElapsed
                      const projectedTotal = Math.round(dailyRate * totalDaysInYear)
                      const onTrack = projectedTotal >= annualGoal
                      const gap = Math.abs(annualGoal - projectedTotal)
                      return (
                        <div style={{ marginTop: 12, padding: '10px 14px', background: onTrack ? C.successBg : C.warningBg, borderRadius: 10, border: `1px solid ${onTrack ? C.sage : C.warningBorder}` }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: onTrack ? C.forest : C.warning }}>
                            {onTrack
                              ? `On pace to raise $${projectedTotal.toLocaleString()} by Dec 31 — $${gap.toLocaleString()} above goal`
                              : `On pace to raise $${projectedTotal.toLocaleString()} by Dec 31 — $${gap.toLocaleString()} short of goal`}
                          </div>
                          <div style={{ fontSize: 11, color: onTrack ? C.sage : C.warning, marginTop: 2 }}>Based on your average of ${dailyRate.toLocaleString(undefined, { maximumFractionDigits: 0 })}/day so far this year</div>
                        </div>
                      )
                    })()}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: C.muted }}>No goal set for this year yet.</div>
                )}
              </div>
            )}

            </div>

            <div style={{ background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14 }}>📊 Trends & Story</div>

            {visibleMetrics.includes('monthly_trend') && (
            <div style={{ ...s.card, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ ...s.cardTitle, marginBottom: 0 }}>📊 Monthly Donations — {filterYear}{filterYear !== 'All' && ` vs ${parseInt(filterYear) - 1}`}</div>
                {filterYear !== 'All' && (
                  <div style={{ display: 'flex', gap: 14, fontSize: 11, color: C.muted }}>
                    <span><span style={{ display: 'inline-block', width: 10, height: 10, background: C.sage, borderRadius: 2, marginRight: 5 }} />{filterYear}</span>
                    <span><span style={{ display: 'inline-block', width: 10, height: 10, background: C.border, borderRadius: 2, marginRight: 5 }} />{parseInt(filterYear) - 1}</span>
                  </div>
                )}
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: C.muted }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: C.muted }} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toLocaleString()}`} />
                  <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(value, name) => [`$${value.toLocaleString()}`, name === 'amount' ? filterYear : (filterYear !== 'All' ? `${parseInt(filterYear) - 1}` : 'Previous year')]} />
                  {filterYear !== 'All' && <Bar dataKey="lastYearAmount" fill={C.border} radius={[6, 6, 0, 0]} />}
                  <Bar dataKey="amount" fill={C.sage} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            )}

            <div style={isMobile ? s.twoColMobile : s.twoCol}>
              <div style={s.card}>
                <div style={s.cardTitle}>📈 Number of Donations per Month</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={monthlyCountData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} />
                    <Line type="monotone" dataKey="count" stroke={C.gold} strokeWidth={2.5} dot={{ fill: C.gold, r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ ...s.cardTitle, marginBottom: 0 }}>🏆 Top Donors</div>
                  <div style={{ fontSize: 12, color: C.sage, fontWeight: 600, cursor: 'pointer' }} onClick={() => setActiveTab('donors')}>View all →</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {donorList.slice(0, 5).map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: [C.gold, C.sage, C.teal, C.forest, C.muted][i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'white', flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.forest }}>{d.name}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{d.count} donation{d.count > 1 ? 's' : ''}</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.forest }}>${d.total.toLocaleString()}</div>
                    </div>
                  ))}
                  {donorList.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: 20 }}>No donors yet</div>}
                </div>
              </div>
            </div>

            </div>

            <div style={{ background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14 }}>📣 Campaign Insights</div>

            {visibleMetrics.includes('campaign_performance') && causePerformanceThisYear.length > 0 && (
              <div style={{ ...s.card, marginBottom: 24 }}>
                <div style={s.cardTitle}>🎯 Campaign Performance — {filterYear}</div>
                {causePerformanceThisYear.filter(r => !r.isGeneral).length === 0 ? (
                  <div style={{ fontSize: 13, color: C.muted, padding: '8px 0' }}>No campaign-tagged donations {filterYear !== 'All' ? `in ${filterYear}` : 'yet'}.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {causePerformanceThisYear.filter(r => !r.isGeneral).map((row, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: C.ivory, borderRadius: 10, border: `1px solid ${C.border}` }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.forest, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🎯 {row.title}</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{row.count} donation{row.count > 1 ? 's' : ''} · {row.donors} donor{row.donors > 1 ? 's' : ''} · avg ${row.avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: C.forest, flexShrink: 0 }}>${row.total.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
                {causePerformanceThisYear.find(r => r.isGeneral) && (() => {
                  const g = causePerformanceThisYear.find(r => r.isGeneral)
                  return (
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: C.muted }}>💚 Untagged / General Giving — {g.count} donation{g.count > 1 ? 's' : ''}, avg ${g.avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, flexShrink: 0 }}>${g.total.toLocaleString()}</div>
                    </div>
                  )
                })()}
              </div>
            )}

            {visibleMetrics.includes('campaign_momentum') && (() => {
              const now6 = new Date()
              const liveCampaigns = myCauses.filter(c => c.status === 'approved' && c.type === 'campaign' && (!c.end_date || new Date(c.end_date) >= now6))
              if (liveCampaigns.length === 0) return null
              const rows = liveCampaigns.map(c => {
                const campDonations = donations.filter(d => d.cause_id === c.id && d.payment_status === 'confirmed')
                const thisWeekStart = new Date(now6.getTime() - 7 * 24 * 60 * 60 * 1000)
                const lastWeekStart = new Date(now6.getTime() - 14 * 24 * 60 * 60 * 1000)
                const thisWeek = campDonations.filter(d => new Date(d.created_at) >= thisWeekStart).reduce((s, d) => s + d.amount, 0)
                const lastWeek = campDonations.filter(d => new Date(d.created_at) >= lastWeekStart && new Date(d.created_at) < thisWeekStart).reduce((s, d) => s + d.amount, 0)
                const daysSinceLastGift = campDonations.length > 0 ? Math.floor((now6 - new Date([...campDonations].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].created_at)) / (1000 * 60 * 60 * 24)) : null
                let status = 'new'
                let changePct = null
                if (lastWeek > 0) {
                  changePct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
                  status = changePct >= 10 ? 'up' : changePct <= -25 ? 'down' : 'flat'
                } else if (thisWeek > 0) {
                  status = 'up'
                } else if (daysSinceLastGift !== null && daysSinceLastGift > 14) {
                  status = 'stalled'
                } else if (campDonations.length === 0) {
                  status = 'quiet'
                }
                return { title: c.title, thisWeek, lastWeek, changePct, daysSinceLastGift, status }
              })
              const statusMeta = {
                up: { label: 'Picking up', color: C.sage, bg: C.successBg, icon: '📈' },
                flat: { label: 'Steady', color: C.muted, bg: C.ivory, icon: '➡️' },
                down: { label: 'Slowing down', color: C.warning, bg: C.warningBg, icon: '📉' },
                stalled: { label: 'Stalled — no gifts in 2+ weeks', color: C.red, bg: '#FBE9E7', icon: '⚠️' },
                quiet: { label: 'No gifts yet', color: C.muted, bg: C.ivory, icon: '🌱' },
                new: { label: 'Just getting started', color: C.gold, bg: '#FDF8EC', icon: '✨' },
              }
              return (
                <div style={{ ...s.card, marginBottom: 24 }}>
                  <div style={s.cardTitle}>🚦 Campaign Momentum</div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>This week vs. last week, for your currently live campaigns — tells you where to focus your next push.</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {rows.map((r, i) => {
                      const m = statusMeta[r.status]
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: m.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 18, flexShrink: 0 }}>{m.icon}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.forest, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                            <div style={{ fontSize: 11, color: m.color, fontWeight: 600, marginTop: 2 }}>
                              {m.label}{r.changePct !== null ? ` · ${r.changePct >= 0 ? '+' : ''}${r.changePct}% vs last week` : ''}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.forest }}>${r.thisWeek.toLocaleString()}</div>
                            <div style={{ fontSize: 10, color: C.muted }}>this week</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {visibleMetrics.includes('campaign_donor_mix') && (() => {
              const scopedCampaigns = myCauses.filter(c => c.type === 'campaign' && donations.some(d => d.cause_id === c.id && d.payment_status === 'confirmed'))
              if (scopedCampaigns.length === 0) return null
              const donorFirstSeenDate = {}
              ;[...donations].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).forEach(d => {
                const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
                if (!donorFirstSeenDate[key]) donorFirstSeenDate[key] = d.created_at
              })
              const rows = scopedCampaigns.map(c => {
                const campDonations = donations.filter(d => d.cause_id === c.id && d.payment_status === 'confirmed')
                const donorKeys = new Set(campDonations.map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name))
                let brandNewCount = 0
                donorKeys.forEach(key => {
                  const firstGiftToCampaign = campDonations.filter(d => (d.donor_email?.trim() || d.donor_nric || d.donor_name) === key).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0]
                  if (donorFirstSeenDate[key] === firstGiftToCampaign.created_at) brandNewCount++
                })
                const total = campDonations.reduce((s, d) => s + d.amount, 0)
                const newPct = donorKeys.size > 0 ? Math.round((brandNewCount / donorKeys.size) * 100) : 0
                return { title: c.title, newCount: brandNewCount, existingCount: donorKeys.size - brandNewCount, newPct, total, avgPerDonor: donorKeys.size > 0 ? total / donorKeys.size : 0 }
              }).sort((a, b) => b.newPct - a.newPct)
              return (
                <div style={{ ...s.card, marginBottom: 24 }}>
                  <div style={s.cardTitle}>🌱 New vs Existing Donors per Campaign</div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Campaigns with a high "new" share are growing your donor base. Campaigns that mostly draw existing donors are moving money, not growing you.</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {rows.map((r, i) => (
                      <div key={i} style={{ padding: '12px 14px', background: C.ivory, borderRadius: 10, border: `1px solid ${C.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.forest, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{r.title}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: r.newPct >= 50 ? C.sage : C.warning }}>{r.newPct}% new donors</div>
                        </div>
                        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 8, marginBottom: 8 }}>
                          <div style={{ width: `${r.newPct}%`, background: C.sage }} />
                          <div style={{ width: `${100 - r.newPct}%`, background: C.border }} />
                        </div>
                        <div style={{ fontSize: 11, color: C.muted }}>
                          {r.newCount} new donor{r.newCount !== 1 ? 's' : ''} · {r.existingCount} existing donor{r.existingCount !== 1 ? 's' : ''} · avg ${r.avgPerDonor.toLocaleString(undefined, { maximumFractionDigits: 0 })}/donor
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            </div>

            <div style={{ background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14 }}>👥 Donor Insights</div>

            {visibleMetrics.includes('donors_to_reengage') && (() => {
              const currentYearNum = new Date().getFullYear()
              const donorLastGift = {}
              donations.filter(d => d.payment_status === 'confirmed').forEach(d => {
                const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
                const year = new Date(d.created_at).getFullYear()
                if (!donorLastGift[key] || year > donorLastGift[key].year) {
                  donorLastGift[key] = { name: d.donor_name, email: d.donor_email, year, amount: d.amount, date: d.created_at }
                }
                if (donorLastGift[key].year === year) {
                  donorLastGift[key].totalThatYear = (donorLastGift[key].totalThatYear || 0) + d.amount
                }
              })
              const lapsed = Object.values(donorLastGift)
                .filter(d => d.year < currentYearNum)
                .sort((a, b) => (b.totalThatYear || b.amount) - (a.totalThatYear || a.amount))
                .slice(0, 10)
              return (
                <div style={{ ...s.card, marginBottom: 24 }}>
                  <div style={s.cardTitle}>📞 Donors to Re-engage</div>
                  {lapsed.length === 0 ? (
                    <div style={{ fontSize: 13, color: C.muted, padding: '8px 0' }}>No lapsed donors — everyone who gave before has given again this year.</div>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Gave in a previous year but haven't given in {currentYearNum} yet — sorted by their last year's total.</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {lapsed.map((d, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: C.ivory, borderRadius: 10, border: `1px solid ${C.border}` }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.warning, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{d.name?.charAt(0)}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: C.forest }}>{d.name}</div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>Last gave in {d.year}{d.email ? ` · ${d.email}` : ''}</div>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.forest, flexShrink: 0 }}>${(d.totalThatYear || d.amount).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })()}

            {visibleMetrics.includes('donor_highlights') && (() => {
              const yearScopedConfirmed = (filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear))).filter(d => d.payment_status === 'confirmed')
              if (yearScopedConfirmed.length === 0) return null

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

              const cards = [
                topDonor && { icon: '🏆', label: 'Top donor', name: topDonor.name, sub: `$${topDonor.total.toLocaleString()} across ${topDonor.count} gift${topDonor.count > 1 ? 's' : ''}`, donor: { name: topDonor.name, email: topDonor.email, total: topDonor.total, count: topDonor.count } },
                largestGift && { icon: '💎', label: 'Largest single gift', name: largestGift.donor_name, sub: `$${Number(largestGift.amount).toLocaleString()} on ${new Date(largestGift.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}`, donor: { name: largestGift.donor_name, email: largestGift.donor_email, total: byDonorTotal[largestGift.donor_email?.trim() || largestGift.donor_nric || largestGift.donor_name]?.total || largestGift.amount, count: byDonorTotal[largestGift.donor_email?.trim() || largestGift.donor_nric || largestGift.donor_name]?.count || 1 } },
                mostFrequent && { icon: '🔁', label: 'Most frequent giver', name: mostFrequent.name, sub: `${mostFrequent.count} donations, $${mostFrequent.total.toLocaleString()} total`, donor: { name: mostFrequent.name, email: mostFrequent.email, total: mostFrequent.total, count: mostFrequent.count } },
                standoutNewDonor && { icon: '✨', label: 'Standout new supporter', name: standoutNewDonor.donor_name, sub: `First gift: $${Number(standoutNewDonor.amount).toLocaleString()}`, donor: { name: standoutNewDonor.donor_name, email: standoutNewDonor.donor_email, total: standoutNewDonor.amount, count: 1 } },
              ].filter(Boolean)

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

            {visibleMetrics.includes('channel_mix') && (() => {
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
              const colors = [C.sage, C.gold, C.teal, C.warning, C.red, C.muted]
              return (
                <div style={{ ...s.card, marginBottom: 24 }}>
                  <div style={s.cardTitle}>💳 How Donors Are Paying — {filterYear}</div>
                  <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 10, marginBottom: 14 }}>
                    {rows.map((r, i) => <div key={i} style={{ width: `${r.pct}%`, background: colors[i % colors.length] }} />)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {rows.map((r, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: colors[i % colors.length], flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: C.text, flex: 1 }}>{r.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.forest }}>{r.pct}%</span>
                        <span style={{ fontSize: 12, color: C.muted, minWidth: 70, textAlign: 'right' }}>${r.amt.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {visibleMetrics.includes('fun_facts') && (() => {
              const scoped = (filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear))).filter(d => d.payment_status === 'confirmed')
              if (scoped.length === 0) return null

              const firstDonationDate = donations.length > 0 ? new Date([...donations].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0].created_at) : new Date()
              const daysSinceStart = Math.max(1, Math.ceil((new Date() - firstDonationDate) / (1000 * 60 * 60 * 24)))
              const allConfirmed = donations.filter(d => d.payment_status === 'confirmed')
              const allDonorKeys = new Set(allConfirmed.map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name))
              const avgPerDay = (allConfirmed.reduce((s, d) => s + d.amount, 0) / daysSinceStart).toLocaleString(undefined, { maximumFractionDigits: 0 })
              const avgDonorsPerDay = (allDonorKeys.size / daysSinceStart).toFixed(1)

              const donorGiftCounts = {}
              allConfirmed.forEach(d => {
                const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
                donorGiftCounts[key] = (donorGiftCounts[key] || 0) + 1
              })
              const oneTimeDonors = Object.values(donorGiftCounts).filter(c => c === 1).length
              const oneTimePct = Object.keys(donorGiftCounts).length > 0 ? Math.round((oneTimeDonors / Object.keys(donorGiftCounts).length) * 100) : 0

              const byDay = {}
              scoped.forEach(d => {
                const dayKey = new Date(d.created_at).toLocaleDateString('en-SG')
                if (!byDay[dayKey]) byDay[dayKey] = { total: 0, count: 0 }
                byDay[dayKey].total += d.amount
                byDay[dayKey].count += 1
              })
              const bestDay = Object.entries(byDay).sort((a, b) => b[1].total - a[1].total)[0]

              return (
                <div style={{ ...s.card, marginBottom: 24 }}>
                  <div style={s.cardTitle}>💡 Fun Facts</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 13, color: C.text }}>On an average day, you bring in <strong style={{ color: C.forest }}>${avgPerDay}</strong> from about <strong style={{ color: C.forest }}>{avgDonorsPerDay}</strong> donors.</div>
                    <div style={{ fontSize: 13, color: C.text }}><strong style={{ color: C.forest }}>{oneTimePct}%</strong> of your donors have given exactly once — worth thinking about how to turn them into repeat supporters.</div>
                    {bestDay && (
                      <div style={{ fontSize: 13, color: C.text }}>Your best day{filterYear !== 'All' ? ` in ${filterYear}` : ''} was <strong style={{ color: C.forest }}>{bestDay[0]}</strong>, raising <strong style={{ color: C.forest }}>${bestDay[1].total.toLocaleString()}</strong> from {bestDay[1].count} donation{bestDay[1].count > 1 ? 's' : ''}.</div>
                    )}
                  </div>
                </div>
              )
            })()}

            {visibleMetrics.includes('concentration_risk') && (() => {
              const scoped = (filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear))).filter(d => d.payment_status === 'confirmed')
              if (scoped.length === 0) return null
              const totalAmt = scoped.reduce((s, d) => s + d.amount, 0)
              const byDonor = {}
              scoped.forEach(d => {
                const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
                if (!byDonor[key]) byDonor[key] = { name: d.donor_name, total: 0 }
                byDonor[key].total += d.amount
              })
              const sorted = Object.values(byDonor).sort((a, b) => b.total - a.total)
              const top3Total = sorted.slice(0, 3).reduce((s, d) => s + d.total, 0)
              const top3Pct = totalAmt > 0 ? Math.round((top3Total / totalAmt) * 100) : 0
              const highRisk = top3Pct >= 50
              return (
                <div style={{ ...s.card, marginBottom: 24, background: highRisk ? C.warningBg : C.white, border: `1px solid ${highRisk ? C.warningBorder : C.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ ...s.cardTitle, marginBottom: 0 }}>⚖️ Funding Concentration</div>
                    <span style={{ fontSize: 11, color: C.sage, fontWeight: 700, cursor: 'pointer', border: `1px solid ${C.sage}`, borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setExplainerOpen(explainerOpen === 'concentration' ? null : 'concentration')}>?</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: highRisk ? C.warning : C.forest, marginTop: 6, marginBottom: 6 }}>{top3Pct}%</div>
                  <div style={{ fontSize: 13, color: highRisk ? C.warning : C.text }}>Your top 3 donors ({sorted.slice(0, 3).map(d => d.name).join(', ')}) account for {top3Pct}% of total giving{filterYear !== 'All' ? ` in ${filterYear}` : ''}.</div>
                  {highRisk && <div style={{ fontSize: 12, color: C.warning, marginTop: 8, fontWeight: 600 }}>⚠️ High concentration — if one of these donors stops giving, it could significantly impact your funding. Consider building a broader base of smaller regular donors.</div>}
                  {explainerOpen === 'concentration' && (
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.ivoryDark}`, lineHeight: 1.5 }}>
                      This measures how dependent you are on a small number of donors. Under 40% is considered healthy diversification — if it's much higher, losing even one major donor could meaningfully hurt your funding. It doesn't mean anything is wrong today, just something worth keeping an eye on as you grow.
                    </div>
                  )}
                </div>
              )
            })()}

            {visibleMetrics.includes('small_gift_compounding') && (() => {
              const scoped = (filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear))).filter(d => d.payment_status === 'confirmed')
              const byDonor = {}
              scoped.forEach(d => {
                const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
                if (!byDonor[key]) byDonor[key] = 0
                byDonor[key] += d.amount
              })
              const smallDonors = Object.values(byDonor).filter(total => total < 20)
              if (smallDonors.length === 0) return null
              const potentialExtra = smallDonors.length * 5
              return (
                <div style={{ ...s.card, marginBottom: 24 }}>
                  <div style={s.cardTitle}>💡 The Power of Small Asks</div>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>
                    You have <strong style={{ color: C.forest }}>{smallDonors.length} donor{smallDonors.length > 1 ? 's' : ''}</strong> who gave under $20{filterYear !== 'All' ? ` in ${filterYear}` : ''}. If each gave just $5 more, that's an extra <strong style={{ color: C.forest }}>${potentialExtra.toLocaleString()}</strong> — worth a gentle nudge in your next appeal.
                  </div>
                </div>
              )
            })()}

            {visibleMetrics.includes('campaign_overlap') && (() => {
              const campaignsWithGifts = myCauses.filter(c => c.type === 'campaign' && causeRaisedMap[c.id])
              if (campaignsWithGifts.length < 2) return null
              const donorsByCampaign = {}
              campaignsWithGifts.forEach(c => {
                donorsByCampaign[c.id] = new Set(donations.filter(d => d.cause_id === c.id && d.payment_status === 'confirmed').map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name))
              })
              const pairs = []
              for (let i = 0; i < campaignsWithGifts.length; i++) {
                for (let j = i + 1; j < campaignsWithGifts.length; j++) {
                  const a = campaignsWithGifts[i], b = campaignsWithGifts[j]
                  const setA = donorsByCampaign[a.id], setB = donorsByCampaign[b.id]
                  const overlap = [...setA].filter(k => setB.has(k)).length
                  const pct = setB.size > 0 ? Math.round((overlap / setB.size) * 100) : 0
                  if (setA.size > 0 && setB.size > 0) pairs.push({ a: a.title, b: b.title, pct, overlap })
                }
              }
              if (pairs.length === 0) return null
              return (
                <div style={{ ...s.card, marginBottom: 24 }}>
                  <div style={s.cardTitle}>🔗 Campaign Donor Overlap</div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>How much your campaigns draw from the same supporters vs. reaching new people.</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {pairs.map((p, i) => (
                      <div key={i} style={{ fontSize: 13, color: C.text, padding: '8px 12px', background: C.ivory, borderRadius: 8, border: `1px solid ${C.border}` }}>
                        <strong style={{ color: C.forest }}>{p.pct}%</strong> of donors to "{p.b}" also gave to "{p.a}"
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {visibleMetrics.includes('thank_you_debt') && (() => {
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

            

            {visibleMetrics.includes('giving_streaks') && (() => {
              const confirmedAll = donations.filter(d => d.payment_status === 'confirmed')
              const byDonorMonths = {}
              confirmedAll.forEach(d => {
                const key = d.donor_email?.trim() || d.donor_nric || d.donor_name
                const dt = new Date(d.created_at)
                const monthKey = `${dt.getFullYear()}-${dt.getMonth()}`
                if (!byDonorMonths[key]) byDonorMonths[key] = { name: d.donor_name, email: d.donor_email, months: new Set() }
                byDonorMonths[key].months.add(monthKey)
              })
              const now3 = new Date()
              const streaks = Object.values(byDonorMonths).map(donor => {
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
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.forest }}>{d.name}</div>
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

            {visibleMetrics.includes('quiet_donors') && (() => {
              const confirmedAll = donations.filter(d => d.payment_status === 'confirmed')
              const byDonor = {}
              confirmedAll.forEach(d => {
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
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.forest }}>{d.name}</div>
                            <div style={{ fontSize: 11, color: C.warning, marginTop: 1 }}>Usually gives every ~{d.avgGapDays}d · it's been {d.daysSinceLast}d</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}

            {visibleMetrics.includes('donation_breakdown') && (
            <div style={{ ...s.card, marginBottom: 0 }}>
              <div style={s.cardTitle}>💰 Donation Size Breakdown</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 10 : 12 }}>
                {(() => {
                  const yearScoped = filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).toLocaleDateString('en-SG', { year: 'numeric' }) === filterYear)
                  return [
                    { label: 'Under $50', min: 0, max: 50, color: C.bucket1 },
                    { label: '$50 — $200', min: 50, max: 200, color: C.sage },
                    { label: '$200 — $1,000', min: 200, max: 1000, color: C.teal },
                    { label: 'Over $1,000', min: 1000, max: Infinity, color: C.forest },
                  ].map((bucket, i) => {
                  const count = yearScoped.filter(d => d.amount >= bucket.min && d.amount < bucket.max).length
                  const total = yearScoped.filter(d => d.amount >= bucket.min && d.amount < bucket.max).reduce((s, d) => s + d.amount, 0)
                  const pct = yearScoped.length ? Math.round((count / yearScoped.length) * 100) : 0
                  return (
                    <div key={i} style={{ background: C.ivory, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{bucket.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: bucket.color, marginBottom: 4 }}>{count}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>{pct}% of donations · ${total.toLocaleString()}</div>
                      <div style={{ background: C.border, borderRadius: 6, height: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: bucket.color, borderRadius: 6 }} />
                      </div>
                    </div>
                  )
                  })
                })()}
              </div>
            </div>
            )}

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
                            <div style={{ ...s.donorAvatar, background: [C.sage, C.teal, C.gold, C.forest, C.red][i % 5] }}>{d.name?.charAt(0)}</div>
                            <div style={s.donorName}>{d.name}</div>
                          </div>
                          {charityIsIpc && (nric ? <span style={s.badgeIssued}>✓ {nric}</span> : <span style={s.badgePending}>⚠️ Missing NRIC</span>)}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
                              <div style={{ ...s.donorAvatar, background: [C.sage, C.teal, C.gold, C.forest, C.red][i % 5] }}>{d.name?.charAt(0)}</div>
                              <div>
                                <div style={s.donorName}>{d.name}</div>
                                {(() => {
                                  const donorKey = d.email?.trim() || d.name
                                  const tags = donorTagsMap[donorKey] || []
                                  return tags.length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
                                      {tags.slice(0, 3).map(t => (
                                        <span key={t.id} style={{ fontSize: 10, fontWeight: 600, color: C.teal, background: '#E8F0EE', padding: '2px 7px', borderRadius: 20 }}>{t.tag}</span>
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
                          <div style={{ fontSize: 13, fontWeight: 600, color: info.color }}>{info.label}</div>
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
                <div style={s.pageTitle}>📣 Campaigns</div>
                <div style={s.pageSub}>Submit fundraising campaigns and sponsored banner requests for Giving Tree's review</div>
              </div>
              
            </div>

            <div style={isMobile ? s.twoColMobile : s.twoCol}>
              <div style={s.card}>
                <div style={s.cardTitle}>🎯 Run a Campaign</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>Submit a fundraising campaign or cause. Once approved, it appears in the Causes tab of the donor app.</div>
                {!showCauseForm ? (
                  <button style={s.btnGold} onClick={() => { setCauseForm({ title: '', description: '', target_amount: '', end_date: '' }); setShowCauseForm(true) }}>+ Submit a Campaign</button>
                ) : (
                  <div>
                    {causeError && <div style={{ background: C.warningBg, color: C.warning, padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12 }}>{causeError}</div>}
                    <div style={{ marginBottom: 10 }}>
                      <div style={s.formLabel}>Title *</div>
                      <input style={s.formInput} placeholder="e.g. Winter Meal Drive" value={causeForm.title} onChange={e => setCauseForm(f => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={s.formLabel}>Description *</div>
                      <textarea style={{ ...s.formInput, minHeight: 80, resize: 'vertical' }} placeholder="What is this campaign for?" value={causeForm.description} onChange={e => setCauseForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <div>
                        <div style={s.formLabel}>Target Amount (SGD)</div>
                        <input style={s.formInput} type="number" placeholder="Optional" value={causeForm.target_amount} onChange={e => setCauseForm(f => ({ ...f, target_amount: e.target.value }))} />
                      </div>
                      <div>
                        <div style={s.formLabel}>End Date</div>
                        <input style={s.formInput} type="date" value={causeForm.end_date} onChange={e => setCauseForm(f => ({ ...f, end_date: e.target.value }))} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button style={s.btnForest} onClick={submitCause} disabled={savingCause}>{savingCause ? 'Submitting...' : (causeForm.editingId ? '✓ Save Changes' : '✓ Submit for Approval')}</button>
                      <button style={s.viewBtn} onClick={() => { setShowCauseForm(false); setCauseError(''); setCauseForm({ title: '', description: '', target_amount: '', end_date: '' }) }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              <div style={s.card}>
                <div style={s.cardTitle}>⭐ Sponsored Banner Spot</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>Request a featured spot in the donor app's homepage banner. Approved charities rotate into the spot.</div>
                {!showSponsoredForm ? (
                  <button style={s.btnGold} onClick={() => setShowSponsoredForm(true)}>+ Request Sponsored Spot</button>
                ) : (
                  <div>
                    {sponsoredError && <div style={{ background: C.warningBg, color: C.warning, padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12 }}>{sponsoredError}</div>}
                    <div style={{ fontSize: 13, color: C.text, marginBottom: 16, lineHeight: 1.5 }}>This will submit a request for {charityName} to be featured in the rotating sponsored banner on the donor homepage. Giving Tree will review and approve.</div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button style={s.btnForest} onClick={submitSponsoredRequest} disabled={savingSponsored}>{savingSponsored ? 'Submitting...' : '✓ Submit Request'}</button>
                      <button style={s.viewBtn} onClick={() => { setShowSponsoredForm(false); setSponsoredError('') }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {(() => {
              const isPast = c => c.status === 'rejected' || c.status === 'deleted' || (c.status === 'approved' && c.end_date && new Date(c.end_date) < new Date())
              const activeCauses = myCauses.filter(c => !isPast(c))
              const pastCauses = myCauses.filter(isPast)
              const renderRow = c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: `1px solid ${C.ivoryDark}` }}>
                  <div style={{ fontSize: 18 }}>{c.type === 'sponsored' ? '⭐' : '🎯'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.forest }}>{c.title}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{c.type === 'sponsored' ? 'Sponsored banner request' : 'Campaign'} · Submitted {new Date(c.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}{c.end_date ? ` · Ends ${new Date(c.end_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}{c.target_amount ? ` · Target $${Number(c.target_amount).toLocaleString()}` : ''}</div>
                    {c.description && <div style={{ fontSize: 12, color: C.text, marginTop: 4, lineHeight: 1.4 }}>{c.description}</div>}
                  </div>
                  <span style={
                    c.status === 'approved' ? s.badgeIssued :
                    c.status === 'rejected' ? { ...s.badgePending, color: C.red, background: '#FBE9E7' } :
                    s.badgePending
                  }>
                    {c.status === 'approved' ? '✓ Approved' : c.status === 'rejected' ? '✕ Rejected' : '⏳ Pending Review'}
                  </span>
                  {c.status === 'pending' && c.type === 'campaign' && (
                    <button style={{ ...s.viewBtn, padding: '6px 10px', fontSize: 11 }} onClick={() => startEditCause(c)}>Edit</button>
                  )}
                  {c.status === 'pending' && (
                    <button style={{ ...s.viewBtn, padding: '6px 10px', fontSize: 11, color: C.red, borderColor: C.red }} onClick={() => deleteCause(c.id)}>Delete</button>
                  )}
                  {c.status === 'approved' && !isPast(c) && (
                    <button style={{ ...s.viewBtn, padding: '6px 10px', fontSize: 11 }} onClick={() => requestRevision(c)}>Request Change</button>
                  )}
                  {c.status === 'approved' && !isPast(c) && (
                    <button style={{ ...s.viewBtn, padding: '6px 10px', fontSize: 11, color: C.red, borderColor: C.red }} onClick={() => deleteCause(c.id)}>Delete</button>
                  )}
                </div>
              )
              return (
                <>
                  <div style={{ ...s.tableCard, marginBottom: 24 }}>
                    <div style={s.tableHeader}>
                      <div style={s.tableTitle}>Active Campaigns</div>
                      <div style={s.tableCount}>{activeCauses.length} total</div>
                    </div>
                    {activeCauses.length === 0 ? <div style={s.empty}>No active campaigns or sponsored requests.</div> : <div>{activeCauses.map(renderRow)}</div>}
                  </div>
                  <div style={s.tableCard}>
                    <div style={s.tableHeader}>
                      <div style={s.tableTitle}>Past Campaigns</div>
                      <div style={s.tableCount}>{pastCauses.length} total</div>
                    </div>
                    {pastCauses.length === 0 ? <div style={s.empty}>No past campaigns yet.</div> : <div>{pastCauses.map(renderRow)}</div>}
                  </div>
                </>
              )
            })()}
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
              <div style={{ ...s.card, marginBottom: 24, border: `1.5px solid ${C.sage}` }}>
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
              {(recurringSearchTerm !== '' || recurringUrgencyFilter !== 'All' || recurringAmountFilter !== 'All' || recurringTypeFilter !== 'All') && (
                <button style={{ ...s.viewBtn, whiteSpace: 'nowrap' }} onClick={() => { setRecurringSearchTerm(''); setRecurringUrgencyFilter('All'); setRecurringAmountFilter('All'); setRecurringTypeFilter('All') }}>✕ Clear Filters</button>
              )}
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

              const filtered = recurringGifts.filter(g => matchesSearch(g) && matchesUrgency(g) && matchesAmount(g) && matchesType(g))

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
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.forest }}>{g.donor_name}</div>
                      <div style={{ fontFamily: C.fontVoice, fontSize: 18, fontWeight: 500, color: C.forest, flexShrink: 0 }}>${Number(g.amount).toLocaleString()}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: C.forest, background: C.ivory, border: `1px solid ${C.border}`, padding: '2px 8px', borderRadius: 20 }}>{typeLabel}</span>
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
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: C.sage }}>
                          ${recurringGivenTotals[g.id].total.toLocaleString()} total · {recurringGivenTotals[g.id].count} payment{recurringGivenTotals[g.id].count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    {g.notes && <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', marginBottom: 8 }}>{g.notes}</div>}

                    {(recurringSkipHistory[g.id] || []).length > 0 && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: C.gold + '1A', border: `1px solid ${C.gold}`, borderRadius: 4, padding: '4px 8px', marginBottom: 8, alignSelf: 'flex-start' }}>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: C.gold }}>
                          ⏭ {recurringSkipHistory[g.id].length} cycle{recurringSkipHistory[g.id].length !== 1 ? 's' : ''} skipped
                        </span>
                      </div>
                    )}
                    {g.status === 'active' && (recurringReminderHistory[g.id] || []).length > 0 && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: C.gold + '1A', border: `1px solid ${C.gold}`, borderRadius: 4, padding: '4px 8px', marginBottom: 8, alignSelf: 'flex-start' }}>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: C.gold }}>
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
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 'auto' }}>
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
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 12 }}>Active Recurring Gifts ({active.length})</div>
                    {active.length === 0 ? (
                      <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 20px', fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No active recurring gifts.</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>
                        {active.map(renderRecurringCard)}
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: 32 }}>
                    <div
                      style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                      onClick={() => setShowPausedRecurring(v => !v)}
                    >
                      <span style={{ fontSize: 11, color: C.muted }}>{showPausedRecurring ? '▾' : '▸'}</span>
                      Paused ({paused.length})
                    </div>
                    {showPausedRecurring && (
                      paused.length === 0 ? (
                        <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 20px', fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No paused recurring gifts.</div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>
                          {paused.map(renderRecurringCard)}
                        </div>
                      )
                    )}
                  </div>

                  {cancelled.length > 0 && (
                    <div>
                      <div
                        style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                        onClick={() => setShowCancelledRecurring(v => !v)}
                      >
                        <span style={{ fontSize: 11, color: C.muted }}>{showCancelledRecurring ? '▾' : '▸'}</span>
                        Cancelled ({cancelled.length})
                      </div>
                      {showCancelledRecurring && (
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>
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
              {(pledgeSearchTerm !== '' || pledgeUrgencyFilter !== 'All' || pledgeAmountFilter !== 'All') && (
                <button style={{ ...s.viewBtn, whiteSpace: 'nowrap' }} onClick={() => { setPledgeSearchTerm(''); setPledgeUrgencyFilter('All'); setPledgeAmountFilter('All') }}>✕ Clear Filters</button>
              )}
            </div>

            {showPledgeReminderModal && pledgeReminderCandidate && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
                <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Send pledge reminder</div>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
                    To {pledgeReminderCandidate.donor_name} ({pledgeReminderCandidate.donor_email || 'no email on file'})
                  </div>
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
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.forest, marginBottom: 4 }}>🎉 Pledge completed</div>
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
              <div style={{ ...s.card, marginBottom: 24, border: `1.5px solid ${C.sage}` }}>
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
                  <div>
                    <div style={s.formLabel}>Pledged Amount (SGD) *</div>
                    <input style={s.formInput} type="number" placeholder="0.00" value={pledgeForm.amount} onChange={e => setPledgeForm(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                  <div>
                    <div style={s.formLabel}>Expected By *</div>
                    <input style={s.formInput} type="date" min={new Date().toISOString().split('T')[0]} value={pledgeForm.expected_date} onChange={e => setPledgeForm(f => ({ ...f, expected_date: e.target.value }))} />
                  </div>
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
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.forest }}>{p.donor_name}</div>
                      <div style={{ fontFamily: C.fontVoice, fontSize: 18, fontWeight: 500, color: C.forest, flexShrink: 0 }}>${pledgedAmount.toLocaleString()}</div>
                    </div>
                    {p.donor_email && <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>{p.donor_email}</div>}

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
                            <span style={{ fontSize: 11.5, fontWeight: 600, color: progressColor, display: 'flex', alignItems: 'center', gap: 4 }}>{pct}% given <InfoTip text="Donations are matched automatically by donor and applied here. If a donor has more than one pending pledge, donations apply to whichever is due soonest." /></span>
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
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: C.gold }}>
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
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 12 }}>Outstanding Pledges ({outstanding.length})</div>
                    {outstanding.length === 0 ? (
                      <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 20px', fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No outstanding pledges.</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>
                        {outstanding.map(renderPledgeCard)}
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: 32 }}>
                    <div
                      style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                      onClick={() => setShowFulfilledPledges(v => !v)}
                    >
                      <span style={{ fontSize: 11, color: C.muted }}>{showFulfilledPledges ? '▾' : '▸'}</span>
                      Fulfilled Pledges ({fulfilled.length})
                    </div>
                    {showFulfilledPledges && (
                      fulfilled.length === 0 ? (
                        <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 20px', fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No fulfilled pledges yet.</div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>
                          {fulfilled.map(renderPledgeCard)}
                        </div>
                      )
                    )}
                  </div>

                  {cancelled.length > 0 && (
                    <div>
                      <div
                        style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                        onClick={() => setShowCancelledPledges(v => !v)}
                      >
                        <span style={{ fontSize: 11, color: C.muted }}>{showCancelledPledges ? '▾' : '▸'}</span>
                        Cancelled ({cancelled.length})
                      </div>
                      {showCancelledPledges && (
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>
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
                <div style={s.pageTitle}>📢 Mass Appeal</div>
                <div style={s.pageSub}>Send personalised PayNow QR codes to all your donors at once</div>
              </div>
              {massAppealStep !== 'setup' && !massAppealProgress && (
                <button style={s.viewBtn} onClick={() => { setMassAppealStep('setup'); setMassAppealForm({ cause_id: '', amount: '', message: '' }); setMassAppealRefs([]) }}>← Start Over</button>
              )}
            </div>

            {/* Setup form */}
            {massAppealStep === 'setup' && !massAppealProgress && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 24, alignItems: 'start' }}>
                <div style={s.card}>
                  <div style={s.cardTitle}>New Appeal</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <div style={s.formLabel}>Campaign (Optional)</div>
                      <select style={s.formInput} value={massAppealForm.cause_id} onChange={e => setMassAppealForm(f => ({ ...f, cause_id: e.target.value }))}>
                        <option value="">General Appeal — no specific campaign</option>
                        {myCauses.filter(c => c.status === 'approved' && c.type === 'campaign').map(c => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div style={s.formLabel}>Default Amount (SGD) *</div>
                      <input style={s.formInput} type="number" placeholder="e.g. 50" value={massAppealForm.amount} onChange={e => setMassAppealForm(f => ({ ...f, amount: e.target.value }))} />
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Each donor's QR will be pre-filled with this amount</div>
                    </div>
                    <div>
                      <div style={s.formLabel}>Personal Message (Optional)</div>
                      <textarea style={{ ...s.formInput, minHeight: 100, resize: 'vertical' }} placeholder="e.g. Dear [name], we're reaching out for our year-end appeal..." value={massAppealForm.message} onChange={e => setMassAppealForm(f => ({ ...f, message: e.target.value }))} />
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Appears in the email above the QR code</div>
                    </div>
                    <div style={{ background: C.successBg, border: `1px solid ${C.sage}`, borderRadius: 10, padding: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.forest, marginBottom: 4 }}>Who will receive this?</div>
                      <div style={{ fontSize: 13, color: C.forest }}><strong>{donorList.filter(d => !d.deactivated && d.email?.trim()).length}</strong> donors with email on file</div>
                      {donorList.filter(d => !d.deactivated && !d.email?.trim()).length > 0 && (
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{donorList.filter(d => !d.deactivated && !d.email?.trim()).length} donors without email excluded — downloadable via QR ZIP</div>
                      )}
                    </div>
                    <button style={{ ...s.btnForest, justifyContent: 'center' }} onClick={generateMassAppealRefs}>Next — Preview Donor List →</button>
                  </div>
                </div>

                {/* Appeal history */}
                <div style={s.card}>
                  <div style={s.cardTitle}>Past Appeals</div>
                  {massAppeals.length === 0 ? (
                    <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No appeals sent yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {massAppeals.map(a => (
                        <div key={a.id} style={{ background: C.ivory, borderRadius: 10, padding: '12px 14px', border: `1px solid ${C.border}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.forest }}>{a.cause_name || 'General Appeal'}</div>
                              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                                {new Date(a.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })} · SGD ${Number(a.amount).toLocaleString()} default
                              </div>
                              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                                {a.sent_count} sent · {a.failed_count > 0 ? `${a.failed_count} failed · ` : ''}{a.donor_count} total
                              </div>
                            </div>
                            <span style={{ ...s.badgeIssued, flexShrink: 0 }}>✓ Sent</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Preview step */}
            {massAppealStep === 'preview' && !massAppealProgress && (
              <div style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.forest }}>{massAppealRefs.filter(r => r.selected).length} donors selected</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} onClick={() => setMassAppealRefs(prev => prev.map(r => ({ ...r, selected: true })))}>Select All</button>
                    <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} onClick={() => setMassAppealRefs(prev => prev.map(r => ({ ...r, selected: false })))}>Deselect All</button>
                  </div>
                </div>
                <div style={{ maxHeight: 400, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 16 }}>
                  {massAppealRefs.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${C.ivoryDark}`, background: r.selected ? C.white : C.ivoryDark }}>
                      <input type="checkbox" checked={r.selected} onChange={() => setMassAppealRefs(prev => prev.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.forest }}>{r.donor_name}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{r.donor_email} · Ref: {r.ref}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.forest, flexShrink: 0 }}>${r.amount}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} onClick={sendMassAppealEmails}>
                    📧 Send to {massAppealRefs.filter(r => r.selected).length} Donors
                  </button>
                  <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={downloadMassAppealQRZip}>
                    ⬇️ Download QR ZIP
                  </button>
                </div>
              </div>
            )}

            {/* Sending progress */}
            {massAppealProgress && (
              <div style={s.card}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.forest, marginBottom: 16 }}>📧 Sending appeals...</div>
                <div style={{ background: C.ivoryDark, borderRadius: 6, height: 12, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ width: `${(massAppealProgress.done / massAppealProgress.total) * 100}%`, height: '100%', background: C.sage, borderRadius: 6, transition: 'width 0.3s' }} />
                </div>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
                  {massAppealProgress.done} of {massAppealProgress.total} · {massAppealProgress.sent} sent · {massAppealProgress.failed} failed
                </div>
                <button style={{ ...s.viewBtn, color: C.red, borderColor: C.red }} onClick={() => { massAppealCancelRef.current = true }}>✕ Cancel</button>
              </div>
            )}

            {/* Done */}
            {massAppealStep === 'done' && !massAppealProgress && (
              <div style={{ ...s.card, textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.forest, marginBottom: 8 }}>Appeal Sent</div>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Each donor received a personalised email with their unique PayNow QR code.</div>
                <button style={{ ...s.btnForest, justifyContent: 'center' }} onClick={() => { setMassAppealStep('setup'); setMassAppealForm({ cause_id: '', amount: '', message: '' }); setMassAppealRefs([]) }}>Send Another Appeal</button>
              </div>
            )}
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

            {/* Donor Summary */}
            <div style={{ ...s.card, marginBottom: 16 }}>
              <div style={s.cardTitle}>👥 Donor Year-End Summary</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
                Individual giving summaries for each donor — useful for sending year-end thank you letters or donor acknowledgements.
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <select style={s.filterSelect} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                  <option value="All">All Years</option>
                  {[...new Set(donations.map(d => new Date(d.created_at).getFullYear()))].sort((a, b) => b - a).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
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
            <div style={{ maxWidth: 500 }}>
              <div style={s.card}>
                <div style={s.cardTitle}>Charity Details</div>
                {[
                  { label: 'Charity Name', value: charityName },
                  { label: 'UEN', value: charityUen },
                  { label: 'Email', value: session?.user?.email },
                ].map((item, i) => (
                  <div key={i} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: C.forest, padding: '10px 14px', background: C.ivory, borderRadius: 10, border: `1px solid ${C.border}` }}>{item.value}</div>
                  </div>
                ))}
                <button style={{ ...s.btnForest, background: C.red, marginTop: 8 }} onClick={() => supabase.auth.signOut()}>🚪 Sign Out</button>
              </div>

              <div style={{ ...s.card, marginTop: 16 }}>
                <div style={s.cardTitle}>Email Sending</div>
                {senderDomainStatus === 'verified' ? (
                  <div>
                    <div style={{ fontSize: 13, color: C.sage, fontWeight: 600, marginBottom: 8 }}>✓ Verified</div>
                    <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
                      Your emails send from <strong style={{ color: C.forest }}>{senderEmailLocalPart}@{senderDomain}</strong>
                    </div>
                    <button style={s.viewBtn} onClick={() => { setSenderDomainInput(senderDomain); setShowDomainSetup(true) }}>Change domain</button>
                  </div>
                ) : senderDomainStatus === 'pending' ? (
                  <div>
                    <div style={{ fontSize: 13, color: C.gold, fontWeight: 600, marginBottom: 8 }}>⏳ Verification pending</div>
                    <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
                      We're waiting for DNS records to be added for <strong style={{ color: C.forest }}>{senderDomain}</strong>. Until this is verified, your emails will send from Giving Tree with replies going to your inbox.
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={s.issueBtn} disabled={checkingVerification} onClick={checkDomainVerification}>{checkingVerification ? 'Checking...' : '↻ Check status'}</button>
                      <button style={s.viewBtn} onClick={() => { setSenderDomainInput(senderDomain); setShowDomainSetup(true) }}>View DNS records</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 13, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
                      Right now, emails to your donors send from Giving Tree's address, with replies going to your inbox. If you have your own website domain, you can set up emails to send directly from your own address instead.
                    </div>
                    <button style={s.issueBtn} onClick={() => setShowDomainSetup(true)}>Set up my own domain</button>
                  </div>
                )}
              </div>

              <div style={{ ...s.card, marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editingFyEnd ? 12 : 0 }}>
                  <div style={{ ...s.cardTitle, marginBottom: 0 }}>Financial Year End</div>
                  {!editingFyEnd && (
                    <span style={{ fontSize: 12, color: C.sage, fontWeight: 600, cursor: 'pointer' }} onClick={() => { setFyEndMonthInput(fyEndMonth.toString()); setFyEndDayInput(fyEndDay.toString()); setEditingFyEnd(true) }}>Edit</span>
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
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.forest, padding: '10px 14px', background: C.ivory, borderRadius: 10, border: `1px solid ${C.border}` }}>
                    {['January','February','March','April','May','June','July','August','September','October','November','December'][fyEndMonth - 1]} {fyEndDay}
                  </div>
                )}
              </div>

              <div style={{ ...s.card, marginTop: 16 }}>
                <div style={s.cardTitle}>Account</div>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
                  To delete your Giving Tree account and all associated data, email us at <span style={{ color: C.forest, fontWeight: 600 }}>hello@givingtree.sg</span> with the subject line "Account Deletion Request". We will process your request within 7 business days.
                </div>
                <a href={`mailto:hello@givingtree.sg?subject=Account Deletion Request — ${charityName}&body=Please delete the Giving Tree charity account for ${charityName} (UEN: ${charityUen}, email: ${session?.user?.email}).`}
                  style={{ ...s.viewBtn, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: C.red, borderColor: C.red }}>
                  🗑️ Request Account Deletion
                </a>
              </div>

              <div style={{ ...s.card, marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={s.cardTitle}>💸 Monthly Expenses</div>
                  {!editingExpenses && <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px' }} onClick={() => { setExpensesInput(monthlyExpenses?.toString() || ''); setEditingExpenses(true) }}>Edit</button>}
                </div>
                {editingExpenses ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={s.formInput} type="number" placeholder="e.g. 15000" value={expensesInput} onChange={e => setExpensesInput(e.target.value)} />
                    <button style={{ ...s.btnForest, flexShrink: 0 }} onClick={async () => {
                      const val = parseFloat(expensesInput) || 0
                      const { error } = await supabase.from('charity_contacts').update({ monthly_expenses: val }).eq('charity_uen', charityUen)
                      if (error) { showToast('Error saving', 'error'); return }
                      setMonthlyExpenses(val)
                      setEditingExpenses(false)
                      showToast('Monthly expenses updated ✓')
                    }}>Save</button>
                    <button style={s.viewBtn} onClick={() => setEditingExpenses(false)}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ fontSize: 24, fontWeight: 800, color: C.forest }}>
                    {monthlyExpenses > 0 ? `SGD $${monthlyExpenses.toLocaleString()}/month` : <span style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>Not set — used for coverage ratio on dashboard</span>}
                  </div>
                )}
              </div>

              <div style={{ ...s.card, marginTop: 16 }}>
                <div style={s.cardTitle}>👥 Staff & Volunteer Access</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
                  Volunteer accounts can log manual entries but cannot see donor records, financials, analytics, or reports. Add their email addresses below.
                </div>
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {localVolunteers.length === 0 && <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}>No volunteers added yet.</div>}
                    {localVolunteers.map(email => (
                      <div key={email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, borderRadius: 8, padding: '8px 12px', border: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: 13, color: C.forest }}>👤 {email}</span>
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px', color: C.red, borderColor: C.red }} onClick={async () => {
                          const updated = localVolunteers.filter(e => e !== email)
                          const { error } = await supabase.from('charity_contacts').update({ volunteer_emails: updated }).eq('charity_uen', charityUen)
                          if (error) { showToast('Error removing', 'error'); return }
                          setLocalVolunteers(updated)
                          showToast('Volunteer removed')
                        }}>Remove</button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={{ ...s.formInput, fontSize: 13 }} placeholder="volunteer@email.com" value={volunteerInput} onChange={e => setVolunteerInput(e.target.value)} onKeyDown={async e => {
                      if (e.key === 'Enter') {
                        const email = volunteerInput.trim().toLowerCase()
                        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Enter a valid email', 'error'); return }
                        if (localVolunteers.includes(email)) { showToast('Already added', 'error'); return }
                        setSavingVolunteer(true)
                        const updated = [...localVolunteers, email]
                        const { error } = await supabase.from('charity_contacts').update({ volunteer_emails: updated }).eq('charity_uen', charityUen)
                        if (error) { showToast('Error saving', 'error'); setSavingVolunteer(false); return }
                        setLocalVolunteers(updated)
                        setVolunteerInput('')
                        setSavingVolunteer(false)
                        showToast(`${email} added as volunteer ✓`)
                      }
                    }} />
                    <button style={{ ...s.btnForest, flexShrink: 0 }} onClick={async () => {
                      const email = volunteerInput.trim().toLowerCase()
                      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Enter a valid email', 'error'); return }
                      if (localVolunteers.includes(email)) { showToast('Already added', 'error'); return }
                      setSavingVolunteer(true)
                      const updated = [...localVolunteers, email]
                      const { error } = await supabase.from('charity_contacts').update({ volunteer_emails: updated }).eq('charity_uen', charityUen)
                      if (error) { showToast('Error saving', 'error'); setSavingVolunteer(false); return }
                      setLocalVolunteers(updated)
                      setVolunteerInput('')
                      setSavingVolunteer(false)
                      showToast(`${email} added as volunteer ✓`)
                    }} disabled={savingVolunteer}>{savingVolunteer ? '...' : 'Add'}</button>
                  </div>
                </div>
              </div>

              <div style={{ ...s.card, marginTop: 16 }}>
                <div style={s.cardTitle}>📥 Import Historical Data</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
                  Import existing donor records and transactions from a Google Sheets or Excel CSV export. Use this once during onboarding to migrate your historical data.
                </div>
                <button style={s.btnForest} onClick={() => { setShowMigrationTool(true); setMigrationPreview(null); setMigrationErrors([]); setMigrationComplete(null); setMigrationProgress(null) }}>📥 Open Migration Tool</button>
              </div>

              <div style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: C.muted, lineHeight: 2 }}>
                <a href="https://givingtree.sg/privacy" target="_blank" rel="noopener noreferrer" style={{ color: C.muted, textDecoration: 'underline' }}>Privacy Policy</a>
                {' · '}
                <a href="https://givingtree.sg/terms" target="_blank" rel="noopener noreferrer" style={{ color: C.muted, textDecoration: 'underline' }}>Terms of Use</a>
              </div>

            </div>
          </div>
        )}

      </div>

      

      {showMigrationTool && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => { if (!migrationProgress) setShowMigrationTool(false) }}>
          <div style={{ background: C.ivory, borderRadius: 16, padding: 28, maxWidth: 620, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: C.forest }}>📥 Migration Tool</div>
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
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Drop your CSV here or click to browse</div>
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
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div style={{ fontSize: 12, color: C.forest }}>Total rows: <strong>{migrationPreview.totalRows}</strong></div>
                        <div style={{ fontSize: 12, color: C.forest }}>Ready to import: <strong>{migrationPreview.validRows.length}</strong></div>
                        {migrationPreview.skippedRows > 0 && <div style={{ fontSize: 12, color: C.warning }}>Will skip: <strong>{migrationPreview.skippedRows}</strong></div>}
                      </div>
                    </div>

                    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Detected columns</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
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
            <div style={{ fontSize: 15, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Mark {showLapsedDismissModal.name} as not interested?</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              They'll be hidden from this list indefinitely. If they donate again on their own, they'll naturally reappear as an active donor — you can also restore them manually at any time.
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={s.formLabel}>Reason (optional)</div>
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
            <div style={{ fontSize: 15, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Reach out to a lapsed donor</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              To {lapsedReminderCandidate.name} ({lapsedReminderCandidate.email || 'no email on file'})
            </div>
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
            <div style={{ fontSize: 15, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Send reminder</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              To {recurringReminderCandidate.donor_name} ({recurringReminderCandidate.donor_email || 'no email on file'})
            </div>
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
            <div style={{ fontSize: 15, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Skip this cycle?</div>
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
            <div style={{ fontSize: 15, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Mark payment as received</div>
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
            <div style={{ fontSize: 15, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Set up your own sending domain</div>
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
                <div style={{ fontSize: 13, color: C.forest, fontWeight: 600, marginBottom: 8 }}>Add these DNS records</div>
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
            <div style={{ fontSize: 15, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Reschedule pledge</div>
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
            <div style={{ fontSize: 15, fontWeight: 600, color: C.forest, marginBottom: 4 }}>
              {pledgeResolutionModal.type === 'fulfilled' ? 'Mark this pledge as fulfilled?' : 'Cancel this pledge?'}
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              The pledge of ${Number(pledgeResolutionModal.pledge.amount).toLocaleString()} from {pledgeResolutionModal.pledge.donor_name} will be marked as {pledgeResolutionModal.type}.
              {pledgeResolutionModal.type === 'cancelled' && ' The record is kept for reference.'}
            </div>
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

      {showManualPledgeLinkModal && selectedDonation && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 480, width: '100%' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Link this donation to a pledge</div>
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
          <div style={{ background: C.ivory, borderRadius: 16, padding: 24, maxWidth: 420, width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.red, marginBottom: 4 }}>🚫 Void & Reissue Receipt</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
              The original receipt number <strong style={{ fontFamily: 'monospace' }}>{selectedDonation.receipt_number || selectedDonation.payment_ref}</strong> will be marked as voided and kept on record. A new corrected receipt will be issued with the next sequential number.
            </div>
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: C.muted }}>Donor</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.forest }}>{selectedDonation.donor_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: C.muted }}>Amount</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.forest }}>${Number(selectedDonation.amount).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: C.muted }}>Current Receipt No.</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.forest, fontFamily: 'monospace' }}>{selectedDonation.receipt_number || selectedDonation.payment_ref}</span>
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
          <div style={{ background: C.ivory, borderRadius: 16, padding: 24, maxWidth: 520, width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.forest, marginBottom: 4 }}>Thank-you note for {thankYouDraft.donor.name}</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Review and edit before sending. This won't be sent as-is.</div>
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
          <div style={{ background: C.ivory, borderRadius: 16, padding: 24, maxWidth: 460, width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: C.forest }}>Customize Analytics</div>
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
                { key: 'donors_to_reengage', label: 'Donors to Re-engage', note: "Past donors who haven't given this year" },
                { key: 'donor_highlights', label: 'Donor Highlights', note: 'Top donor, largest gift, most frequent giver, standout new supporter' },
                { key: 'giving_streaks', label: 'Giving Streaks', note: 'Donors giving 3+ consecutive months — your most dependable supporters' },
                { key: 'quiet_donors', label: 'Quiet Donors', note: 'Regular givers whose rhythm has slowed — catch them before they lapse' },
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
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.label}</div>
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

      {confirmModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setConfirmModal(null)}>
          <div style={{ background: C.ivory, borderRadius: 16, padding: 24, maxWidth: 400, width: '90%', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.successBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 20, color: C.forest }}>✓</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.forest, marginBottom: 6 }}>{confirmModal.title}</div>
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
                    <span style={{ fontSize: 12, color: C.warning, fontWeight: 600 }}>⚠️ No reference on file</span>
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
              style={{ cursor: 'pointer', color: C.sage, border: `0.5px solid ${C.sage}`, padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, marginTop: 1 }}
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
  sidebar: { width: 240, background: C.forest, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 10 },
  sidebarLogo: { padding: '28px 24px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  logoText: { fontSize: 18, fontWeight: 800, color: 'white' },
  logoSub: { fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 },
  charityBadge: { margin: 16, background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 10 },
  charityIcon: { width: 36, height: 36, background: '#FFF5E6', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 },
  charityName: { fontSize: 12, fontWeight: 700, color: 'white', lineHeight: 1.3 },
  charityUen: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  navSection: { padding: '8px 12px', flex: 1 },
  navLabel: { fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.5, padding: '12px 12px 6px' },
  navItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', marginBottom: 2, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)' },
  navItemActive: { background: C.sage, color: 'white' },
  navIcon: { fontSize: 16, width: 20, textAlign: 'center' },
  sidebarFooter: { padding: 16, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 10 },
  footerAvatar: { width: 32, height: 32, background: C.sage, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: 'white', flexShrink: 0 },
  footerName: { fontSize: 12, fontWeight: 700, color: 'white', lineHeight: 1.3 },
  footerEmail: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  main: { marginLeft: 240, flex: 1, minWidth: 0, overflowX: 'hidden', width: 'calc(100vw - 240px)', boxSizing: 'border-box' },
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
  padding: '12px 18px', fontSize: 13, fontWeight: 600, color: C.forest,
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
mobileTabLabel: { fontSize: 10, fontWeight: 600 },
  content: { padding: 32 },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  pageTitle: { fontSize: 24, fontWeight: 800, color: C.forest, marginBottom: 4 },
  pageSub: { fontSize: 13, color: C.muted },
  deadlineBanner: { background: C.red, borderRadius: 16, padding: '16px 20px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  bannerBtn: { background: 'white', color: C.red, border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 },
  statsGridTablet: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 22 },
  statsGridMobile: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 },
  statCard: { background: C.white, borderRadius: 16, padding: 20, border: `1.5px solid ${C.border}` },
  statLabel: { fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, marginBottom: 8 },
  statValue: { fontSize: 28, fontWeight: 800, color: C.forest, letterSpacing: -0.5 },
  statNote: { fontSize: 11, color: C.muted, marginTop: 4 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 },
  twoColMobile: { display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 24 },
  card: { background: C.white, borderRadius: 16, padding: 20, border: `1.5px solid ${C.border}`, marginBottom: 0 },
  cardTitle: { fontSize: 14, fontWeight: 700, color: C.forest, marginBottom: 16 },
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
  irasInfoGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 },
  irasInfoGridTablet: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 18 },
  irasInfoGridMobile: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 },
  irasInfoItem: { background: C.ivory, borderRadius: 12, padding: 14, border: `1px solid ${C.border}` },
  irasInfoLabel: { fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, marginBottom: 6 },
  irasInfoValue: { fontSize: 30, fontWeight: 800, color: C.forest },
  irasInfoNote: { fontSize: 12, color: C.muted, marginTop: 2 },
  tableCard: { background: C.white, borderRadius: 20, border: `1.5px solid ${C.border}`, overflow: 'hidden', marginBottom: 24 },
  tableHeader: { padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}` },
  tableTitle: { fontSize: 15, fontWeight: 700, color: C.forest },
  tableCount: { fontSize: 12, color: C.muted },
  pendingBadge: { background: C.warningBg, color: C.warning, fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20 },
  empty: { padding: 40, textAlign: 'center', color: C.muted, fontSize: 14 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '11px 20px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, background: C.ivory, borderBottom: `1px solid ${C.border}` },
  tr: { borderBottom: `1px solid ${C.ivoryDark}` },
  td: { padding: '13px 20px', fontSize: 13 },
  donorCell: { display: 'flex', alignItems: 'center', gap: 10 },
  donorAvatar: { width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 },
  donorName: { fontWeight: 600, color: C.forest, fontSize: 13 },
  amountText: { fontWeight: 700, color: C.forest },
  dateText: { color: C.muted, fontSize: 12 },
  badgeIssued: { fontSize: 10, fontWeight: 600, color: C.sage, background: C.successBg, padding: '3px 10px', borderRadius: 20, display: 'inline-block' },
  badgePending: { fontSize: 10, fontWeight: 600, color: C.warning, background: C.warningBg, padding: '3px 10px', borderRadius: 20, display: 'inline-block' },
  issueBtn: { padding: '6px 14px', background: C.sage, color: 'white', border: 'none', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  issuingBtn: { padding: '6px 14px', background: C.ivoryDark, color: C.muted, border: 'none', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'default', fontFamily: 'inherit' },
  viewBtn: { padding: '6px 14px', background: C.ivory, color: C.forest, border: `1.5px solid ${C.border}`, borderRadius: 12, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnGold: { background: C.gold, color: C.forest, border: 'none', borderRadius: 12, padding: '12px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 },
  btnForest: { background: C.forest, color: 'white', border: 'none', borderRadius: 12, padding: '12px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 },
  searchBox: { flex: 1, padding: '10px 16px', border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontFamily: 'inherit', background: C.white, color: C.text, outline: 'none' },
  filterSelect: { padding: '10px 14px', border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontFamily: 'inherit', background: C.white, color: C.text, cursor: 'pointer' },
  exportSmallBtn: { background: C.forest, color: 'white', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  backBtn: { background: C.ivory, color: C.forest, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 0 },
  infoItem: { background: C.ivory, borderRadius: 10, padding: 12, border: `1px solid ${C.border}` },
  infoLabel: { fontSize: 10, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  infoValue: { fontSize: 18, fontWeight: 800, color: C.forest },
  formLabel: { fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  formInput: { width: '100%', padding: '10px 14px', border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: C.ivory, color: C.text, boxSizing: 'border-box' },
  donationCard: { padding: '14px 16px', borderBottom: `1px solid ${C.ivoryDark}`, cursor: 'pointer' },
  donationCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  donationCardDonor: { display: 'flex', alignItems: 'center', gap: 10 },
  donationCardName: { fontWeight: 700, color: C.forest, fontSize: 14 },
  donationCardDate: { fontSize: 11, color: C.muted, marginTop: 1 },
  donationCardAmount: { fontWeight: 800, color: C.forest, fontSize: 16, textAlign: 'right' },
  donationCardBadges: { display: 'flex', flexWrap: 'wrap', gap: 6, marginLeft: 42 },
}
