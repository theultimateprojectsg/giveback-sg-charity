import React, { useState, useEffect, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { supabase } from './supabase'
import Auth from './CharityAuth'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import logo from './assets/logo.png'
import './App.css'

const C = {
  forest:    '#1B4332',
  teal:      '#1A3C34',
  sage:      '#40916C',
  gold:      '#D4A017',
  ivory:     '#FAF7F2',
  ivoryDark: '#F0EBE1',
  border:    '#E2D9CC',
  text:      '#1C1C1C',
  muted:     '#7A6E62',
  white:     '#FFFFFF',
  red:       '#C0392B',
  warning:       '#A07010',
  warningBg:     '#FDF3DC',
  warningBorder: '#E8CC7A',
  successBg: '#EEF6F1',
  bucket1:   '#74C69D',
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
  const [manualForm, setManualForm] = useState({ donor_name: '', donor_nric: '', amount: '', payment_method: 'Cash', notes: '', donor_email: '', date: new Date().toISOString().split('T')[0], cause_id: '' })
  const [manualError, setManualError] = useState('')
  const [savingManual, setSavingManual] = useState(false)
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
    }
  }, [session])

  async function loadCharityIpcStatus(activeSession) {
    const uen = activeSession?.user?.user_metadata?.charity_uen
    if (!uen) return
    const { data, error } = await supabase
      .from('charity_contacts')
      .select('ipc, annual_goal, fy_end_month, fy_end_day')
      .eq('charity_uen', uen)
      .single()
    if (error) { console.error('Could not load charity IPC status:', error); setCharityIpcLoaded(true); return }
    setCharityIsIpc(data?.ipc !== false)
    setAnnualGoal(data?.annual_goal || null)
    const month = data?.fy_end_month || 12
    const day = data?.fy_end_day || 31
    setFyEndMonth(month)
    setFyEndDay(day)
    setFyEndMonthInput(month.toString())
    setFyEndDayInput(day.toString())
    setCharityIpcLoaded(true)
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

    if (!donation.donor_email) {
      showToast('Payment confirmed and receipt issued')
      return
    }

    const { error: emailError } = await supabase.functions.invoke('send-thank-you', {
      body: {
        donor_name: donation.donor_name,
        donor_email: donation.donor_email,
        charity_name: charityName,
        charity_uen: charityUen,
        amount: donation.amount,
        date: new Date(donation.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' }),
        payment_ref: donation.payment_ref,
        notes: donation.notes,
        cause_title: causeNameForDonation(donation),
      }
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
    const { error } = await supabase.functions.invoke('send-thank-you', {
      body: {
        donor_name: donation.donor_name,
        donor_email: donation.donor_email,
        charity_name: charityName,
        charity_uen: charityUen,
        amount: donation.amount,
        date: new Date(donation.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' }),
        payment_ref: donation.payment_ref,
        notes: donation.notes,
        cause_title: causeNameForDonation(donation),
      }
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
        const { error } = await supabase.functions.invoke('send-thank-you', {
          body: {
            donor_name: donor.donor_name,
            donor_email: donor.donor_email,
            charity_name: charityName,
            amount: donor.total,
            date: new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' }),
            request_nric: true,
          }
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
    setSavingManual(true)
    setManualError('')
    const entryYear = new Date(manualForm.date).getFullYear()
    const { count: existingManualCount, error: countError } = await supabase
      .from('donations')
      .select('id', { count: 'exact', head: true })
      .eq('charity_uen', charityUen)
      .eq('source', 'manual')
      .gte('created_at', `${entryYear}-01-01`)
      .lt('created_at', `${entryYear + 1}-01-01`)
    if (countError) { console.error('Could not generate receipt number:', countError); setManualError('Error generating receipt number. Please try again.'); setSavingManual(false); return }
    const nextSeq = (existingManualCount || 0) + 1
    const receiptNumber = `MR-${entryYear}-${String(nextSeq).padStart(6, '0')}`
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
    }]).select()
    if (error && error.code === '23505') {
      // Receipt number collision (concurrent entry) — retry once with next sequence number
      const { count: retryCount, error: retryCountError } = await supabase
        .from('donations')
        .select('id', { count: 'exact', head: true })
        .eq('charity_uen', charityUen)
        .eq('source', 'manual')
        .gte('created_at', `${entryYear}-01-01`)
        .lt('created_at', `${entryYear + 1}-01-01`)
      if (retryCountError) { console.error('Retry count failed:', retryCountError); setManualError('Error saving: receipt number conflict, please try again'); setSavingManual(false); return }
      const retryReceiptNumber = `MR-${entryYear}-${String((retryCount || 0) + 1).padStart(6, '0')}`
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
    setManualForm({ donor_name: '', donor_nric: '', amount: '', payment_method: 'Cash', notes: '', donor_email: '', date: new Date().toISOString().split('T')[0], cause_id: '' })
    setShowManualForm(false)
    setSavingManual(false)
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
      donorMap[key] = { name: d.donor_name, email: d.donor_email, total: 0, count: 0, lastDate: d.created_at, receipts: 0 }
    }
    if (!donorMap[key].email && d.donor_email) donorMap[key].email = d.donor_email
    donorMap[key].total += d.amount
    donorMap[key].count += 1
    if (d.receipt_issued) donorMap[key].receipts += 1
    if (new Date(d.created_at) > new Date(donorMap[key].lastDate)) {
      donorMap[key].lastDate = d.created_at
    }
  })
  const donorList = Object.values(donorMap).sort((a, b) => b.total - a.total)
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
    doc.text(donation.donor_name || '', margin, y)
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

      {/* ── SIDEBAR (desktop, full) ── */}
      {screenSize === 'desktop' && (
      <div style={s.sidebar}>
        <div style={s.sidebarLogo}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <img src={logo} style={{ width: 32, height: 32, objectFit: 'contain' }} />
            <div style={s.logoText}>Giving Tree</div>
          </div>
          <div style={s.logoSub}>Charity Portal</div>
        </div>
        <div style={s.charityBadge}>
          <div style={s.charityIcon}>🏥</div>
          <div>
            <div style={s.charityName}>{charityName}</div>
            <div style={s.charityUen}>UEN: {charityUen}</div>
          </div>
        </div>
        <div style={s.navSection}>
          <div style={s.navLabel}>Main</div>
          {[
            { id: 'dashboard', icon: '📊', label: 'Dashboard' },
            { id: 'donations', icon: '💳', label: 'Donations' },
            { id: 'analytics', icon: '📈', label: 'Analytics' },
            { id: 'donors',    icon: '👥', label: 'Donors' },
          ].map(item => (
            <div key={item.id} style={{ ...s.navItem, ...(activeTab === item.id ? s.navItemActive : {}) }} onClick={() => { setActiveTab(item.id); setSelectedDonor(null) }}>
              <span style={s.navIcon}>{item.icon}</span>{item.label}
            </div>
          ))}
          <div style={s.navLabel}>Compliance</div>
          {[...(charityIsIpc ? [{ id: 'iras', icon: '🏛️', label: 'IRAS Export' }] : []), { id: 'activity', icon: '📋', label: 'Activity Log' }].map(item => (
            <div key={item.id} style={{ ...s.navItem, ...(activeTab === item.id ? s.navItemActive : {}) }} onClick={() => { setActiveTab(item.id); setSelectedDonor(null) }}>
              <span style={s.navIcon}>{item.icon}</span>{item.label}
            </div>
          ))}
          <div style={s.navLabel}>Account</div>
          <div style={{ ...s.navItem, ...(activeTab === 'promotions' ? s.navItemActive : {}) }} onClick={() => { setActiveTab('promotions'); setSelectedDonor(null) }}>
            <span style={s.navIcon}>📣</span>Promotions
          </div>
          <div style={{ ...s.navItem, ...(activeTab === 'settings' ? s.navItemActive : {}) }} onClick={() => { setActiveTab('settings'); setSelectedDonor(null) }}>
            <span style={s.navIcon}>⚙️</span>Settings
          </div>
        </div>
        <div style={s.sidebarFooter}>
          <div style={s.footerAvatar}>{charityName.charAt(0)}</div>
          <div>
            <div style={s.footerName}>{charityName}</div>
            <div style={s.footerEmail}>{session?.user?.email}</div>
          </div>
        </div>
      </div>
      )}

      {/* ── SIDEBAR (tablet, icon-only) ── */}
      {isTablet && (
      <div style={s.sidebarTablet}>
        <div style={s.sidebarTabletLogo}>
          <img src={logo} style={{ width: 28, height: 28, objectFit: 'contain' }} />
        </div>
        <div style={s.sidebarTabletNav}>
          {[
            { id: 'dashboard', icon: '📊', label: 'Dashboard' },
            { id: 'donations', icon: '💳', label: 'Donations' },
            { id: 'analytics', icon: '📈', label: 'Analytics' },
            { id: 'donors',    icon: '👥', label: 'Donors' },
            ...(charityIsIpc ? [{ id: 'iras', icon: '🏛️', label: 'IRAS Export' }] : []),
            { id: 'activity',  icon: '📋', label: 'Activity Log' },
            { id: 'promotions', icon: '📣', label: 'Promotions' },
          ].map(item => (
            <div key={item.id} style={{ ...s.sidebarTabletItem, ...(activeTab === item.id ? s.sidebarTabletItemActive : {}) }} onClick={() => { setActiveTab(item.id); setSelectedDonor(null) }} title={item.label}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
            </div>
          ))}
        </div>
        <div style={{ ...s.sidebarTabletItem, ...(activeTab === 'settings' ? s.sidebarTabletItemActive : {}) }} onClick={() => { setActiveTab('settings'); setSelectedDonor(null) }} title="Settings">
          <span style={{ fontSize: 20 }}>⚙️</span>
        </div>
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
            {charityIsIpc && (
              <div style={s.mobileOverflowItem} onClick={() => { setActiveTab('iras'); setSelectedDonor(null); setShowMobileMenu(false) }}>🏛️ IRAS Export</div>
            )}
            <div style={s.mobileOverflowItem} onClick={() => { setActiveTab('activity'); setSelectedDonor(null); setShowMobileMenu(false) }}>📋 Activity Log</div>
            <div style={s.mobileOverflowItem} onClick={() => { setActiveTab('promotions'); setSelectedDonor(null); setShowMobileMenu(false) }}>📣 Promotions</div>
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
      <div style={isMobile ? s.mainMobile : isTablet ? s.mainTablet : s.main}>

        {/* ── DASHBOARD ── */}
        {activeTab === 'dashboard' && (
          <div style={s.content}>
            {actionItems.length > 0 && (
              <div style={{ ...s.deadlineBanner, background: '#F5C9C4', border: `1.5px solid ${C.red}`, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ fontSize: 24 }}>⚡</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.red }}>{actionItems.length} thing{actionItems.length > 1 ? 's' : ''} need{actionItems.length > 1 ? '' : 's'} your attention</div>
                    <div style={{ fontSize: 12, color: C.red, marginTop: 2 }}>{actionItems.map(a => a.label).join(' · ')}</div>
                  </div>
                </div>
                <button style={{ ...s.bannerBtn, background: C.forest, color: 'white' }} onClick={() => setActiveTab(actionItems[0].tab)}>Review now</button>
              </div>
            )}

            {daysToDeadline <= 60 && daysToDeadline > 0 && pendingCount + (charityIsIpc ? donations.filter(d => !d.donor_nric).length : 0) > 0 && (
              <div style={{ background: '#FBE9E7', border: `1.5px solid ${C.red}`, borderRadius: 12, padding: '12px 18px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 18 }}>🏛️</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.red }}>
                    IRAS deadline in {daysToDeadline} day{daysToDeadline !== 1 ? 's' : ''} — {pendingCount} receipt{pendingCount !== 1 ? 's' : ''}{charityIsIpc ? ` and ${donations.filter(d => !d.donor_nric).length} NRIC${donations.filter(d => !d.donor_nric).length !== 1 ? 's' : ''}` : ''} still outstanding
                  </div>
                </div>
                <span style={{ fontSize: 12, color: C.red, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }} onClick={() => setActiveTab('iras')}>31 Jan {currentYear + 1} →</span>
              </div>
            )}

            {daysToCocDeadline <= 60 && daysToCocDeadline > 0 && (
              <div style={{ background: '#FDF3DC', border: `1.5px solid ${C.warningBorder}`, borderRadius: 12, padding: '12px 18px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 18 }}>📋</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.warning }}>
                    COC Annual Submission due in {daysToCocDeadline} day{daysToCocDeadline !== 1 ? 's' : ''} — Annual Report, Financial Statements & GEC via the Charity Portal
                  </div>
                </div>
                <span style={{ fontSize: 12, color: C.warning, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }} onClick={() => setActiveTab('settings')}>{cocDeadline.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })} →</span>
              </div>
            )}
            
            
            {!loading && donations.length === 0 && (
              <div style={{ background: C.white, border: `1.5px solid ${C.sage}`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.forest, marginBottom: 4 }}>👋 Welcome to Giving Tree</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>A few things to get you started:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Confirm your charity details are correct', action: () => setActiveTab('settings') },
                    { label: 'Try logging a donation manually (cash, cheque, or wire)', action: () => { setActiveTab('donations'); setShowManualForm(true) } },
                    charityIsIpc
                      ? { label: 'Check your IRAS export once you have a donation', action: () => setActiveTab('iras') }
                      : { label: 'Check your donation report once you have a donation', action: () => setActiveTab('analytics') },
                  ].map((step, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={step.action}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', border: `1.5px solid ${C.sage}`, flexShrink: 0 }} />
                      <div style={{ fontSize: 13, color: C.text }}>{step.label}</div>
                      <div style={{ marginLeft: 'auto', fontSize: 11, color: C.sage, fontWeight: 600 }}>Go →</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={s.pageHeader}>
              <div>
                <div style={s.pageTitle}>{greeting}, {charityName} 👋</div>
                <div style={s.pageSub}>Here's what's happening right now</div>
              </div>
            </div>

            <div style={isMobile ? s.statsGridMobile : isTablet ? s.statsGridTablet : s.statsGrid}>
              <div style={{ ...s.statCard, background: C.forest, borderColor: C.forest }}>
                <div style={{ ...s.statLabel, color: 'rgba(255,255,255,0.7)' }}>Confirmed, {dashboardCurrentYear}</div>
                <div style={{ ...s.statValue, color: 'white' }}>${dashboardConfirmedTotal.toLocaleString()}</div>
                <div style={{ ...s.statNote, color: 'rgba(255,255,255,0.6)' }}>{dashboardDonationsThisYear.length} donations</div>
              </div>
              <div style={s.statCard}>
                <div style={s.statLabel}>This Month</div>
                <div style={s.statValue}>${thisMonthTotal.toLocaleString()}</div>
                <div style={{ ...s.statNote, color: monthChangePct === null ? C.muted : (monthChangePct >= 0 ? C.sage : C.red) }}>
                  {monthChangePct === null ? 'No data last month' : `${monthChangePct >= 0 ? '↗' : '↘'} ${Math.abs(monthChangePct)}% vs last month`}
                </div>
              </div>
              <div style={s.statCard}>
                <div style={s.statLabel}>Unique Donors</div>
                <div style={s.statValue}>{dashboardUniqueDonors}</div>
                <div style={s.statNote}>{dashboardCurrentYear}</div>
              </div>
              {charityIsIpc && (
                <div style={{ ...s.statCard, background: dashboardMissingNric > 0 ? C.warningBg : s.statCard.background, borderColor: dashboardMissingNric > 0 ? C.warningBorder : C.border }}>
                  <div style={{ ...s.statLabel, color: dashboardMissingNric > 0 ? C.warning : C.muted }}>Missing NRIC</div>
                  <div style={{ ...s.statValue, color: dashboardMissingNric > 0 ? C.warning : C.forest }}>{dashboardMissingNric}</div>
                  <div style={{ ...s.statNote, color: dashboardMissingNric > 0 ? C.warning : C.muted }}>{dashboardMissingNric > 0 ? 'Blocks tax deduction' : 'All set ✓'}</div>
                </div>
              )}
            </div>

            {myCauses.filter(c => c.status === 'approved' && c.type === 'campaign' && (!c.end_date || new Date(c.end_date) >= new Date())).length > 0 && (
              <div style={s.tableCard}>
                <div style={s.tableHeader}>
                  <div style={s.tableTitle}>Active Campaigns</div>
                  <div style={{ fontSize: 12, color: C.sage, fontWeight: 600, cursor: 'pointer' }} onClick={() => setActiveTab('promotions')}>Manage →</div>
                </div>
                <div style={{ padding: 20, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 12 }}>
                  {myCauses.filter(c => c.status === 'approved' && c.type === 'campaign' && (!c.end_date || new Date(c.end_date) >= new Date())).map((c) => {
                    const stats = causeRaisedMap[c.id] || { total: 0, donors: new Set() }
                    const goal = c.target_amount || 0
                    const pct = goal > 0 ? Math.min(100, Math.round((stats.total / goal) * 100)) : 0
                    const daysLeft = c.end_date ? Math.max(0, Math.ceil((new Date(c.end_date) - new Date()) / (1000 * 60 * 60 * 24))) : null
                    const behindPace = goal > 0 && pct < 40
                    return (
                      <div key={c.id} style={{ background: C.ivory, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.forest }}>{c.title}</div>
                          <span style={s.badgeIssued}>✓ Approved</span>
                        </div>

                        {goal > 0 && (
                          <div style={{ background: C.ivoryDark, borderRadius: 3, height: 6, overflow: 'hidden', marginBottom: 14 }}>
                            <div style={{ width: `${Math.max(pct, 2)}%`, height: '100%', background: behindPace ? C.warning : C.sage, borderRadius: 3 }} />
                          </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Raised</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.forest }}>${stats.total.toLocaleString()}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Goal</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.forest }}>{goal > 0 ? `$${goal.toLocaleString()}` : '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Donors</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.forest }}>{stats.donors.size}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Ends</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.forest }}>{daysLeft !== null ? `${daysLeft}d` : '—'}</div>
                          </div>
                        </div>

                        {goal > 0 && (
                          <div style={{ marginTop: 10, fontSize: 11, color: behindPace ? C.warning : C.muted, fontWeight: behindPace ? 600 : 400 }}>
                            {behindPace ? `⚠ Behind pace · ${pct}% funded` : `${pct}% funded`}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {myCauses.filter(c => c.status === 'pending').length > 0 && (
              <div style={{ background: C.warningBg, border: `1.5px solid ${C.warningBorder}`, borderRadius: 12, padding: '12px 16px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 18 }}>⏳</div>
                  <div style={{ fontSize: 13, color: C.warning }}>
                    <strong>{myCauses.filter(c => c.status === 'pending').length} campaign{myCauses.filter(c => c.status === 'pending').length > 1 ? 's' : ''} pending review</strong>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: C.warning, fontWeight: 600, cursor: 'pointer' }} onClick={() => setActiveTab('promotions')}>View →</div>
              </div>
            )}

            {(() => {
              const dashboardDonationsPool = donations.slice(0, 30)
              const totalPages = Math.ceil(dashboardDonationsPool.length / 10)
              const pageDonations = dashboardDonationsPool.slice(dashboardDonationsPage * 10, dashboardDonationsPage * 10 + 10)
              return (
                <div style={s.tableCard}>
                  <div style={s.tableHeader}>
                    <div style={s.tableTitle}>Recent Donations</div>
                    <div style={{ fontSize: 12, color: C.sage, fontWeight: 600, cursor: 'pointer' }} onClick={() => { setFilterYear('All'); setFilterType('All'); setFilterNric('All'); setSearchTerm(''); setActiveTab('donations') }}>View all donations →</div>
                  </div>
                  {loading ? <div style={s.empty}>Loading...</div> : dashboardDonationsPool.length === 0 ? (
                    <div style={s.empty}>No donations yet.</div>
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
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: `1px solid ${C.border}` }}>
                      <button
                        style={{ ...s.viewBtn, opacity: dashboardDonationsPage === 0 ? 0.4 : 1, cursor: dashboardDonationsPage === 0 ? 'not-allowed' : 'pointer' }}
                        disabled={dashboardDonationsPage === 0}
                        onClick={() => setDashboardDonationsPage(p => Math.max(0, p - 1))}
                      >← Previous</button>
                      <span style={{ fontSize: 12, color: C.muted }}>Page {dashboardDonationsPage + 1} of {totalPages}</span>
                      <button
                        style={{ ...s.viewBtn, opacity: dashboardDonationsPage >= totalPages - 1 ? 0.4 : 1, cursor: dashboardDonationsPage >= totalPages - 1 ? 'not-allowed' : 'pointer' }}
                        disabled={dashboardDonationsPage >= totalPages - 1}
                        onClick={() => setDashboardDonationsPage(p => Math.min(totalPages - 1, p + 1))}
                      >Next →</button>
                    </div>
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
            <div style={isMobile ? { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 } : { display: 'flex', gap: 12, marginBottom: 20 }}>
              <input style={s.searchBox} placeholder="🔍 Search donors..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              <button style={isMobile ? { ...s.exportSmallBtn, width: '100%' } : s.exportSmallBtn} onClick={exportDonorContactsCSV}>📇 Export Contacts</button>
              {charityIsIpc && (
                <button style={isMobile ? { ...s.exportSmallBtn, width: '100%' } : s.exportSmallBtn} onClick={() => { if (filterYear === 'All') { showToast('Select a year first to export IRAS data'); return } exportIRASExcel() }}>⬇️ Export IRAS</button>
              )}
            </div>
            <div style={s.tableCard}>
              <div style={s.tableHeader}>
                <div style={s.tableTitle}>All Donors</div>
                <div style={s.tableCount}>{donorList.length} donors</div>
              </div>
              {loading ? <div style={s.empty}>Loading...</div> : donorList.length === 0 ? <div style={s.empty}>No donors yet.</div> : (isMobile || isTablet) ? (
                <div>
                  {donorList.filter(d => d.name?.toLowerCase().includes(searchTerm.toLowerCase())).map((d, i) => (
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
                    {donorList.filter(d => d.name?.toLowerCase().includes(searchTerm.toLowerCase())).map((d, i) => {
                      const key = d.email?.trim() || d.name
                      const b = donorBadgeMap[key]
                      const milestoneCount = b ? [b.isFirstTime, b.isBigGift, b.isLoyal, b.isBiggestYet].filter(Boolean).length : 0
                      const hasUnacked = b?.hasUnackedBadge
                      return (
                        <tr key={i} style={s.tr}>
                          <td style={s.td}><div style={s.donorCell}><div style={{ ...s.donorAvatar, background: [C.sage, C.teal, C.gold, C.forest, C.red][i % 5] }}>{d.name?.charAt(0)}</div><div style={s.donorName}>{d.name}</div></div></td>
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
          </div>
        )}

        {/* ── DONATIONS ── */}
        {activeTab === 'donations' && (
          <div style={s.content}>
            <div style={s.pageHeader}>
              <div>
                <div style={s.pageTitle}>Donations</div>
                <div style={s.pageSub}>{donations.length} total · {donations.filter(d => d.source === 'manual').length} manual entries</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {pendingCountForYear > 0 && <button style={s.btnForest} onClick={issueAllReceipts} disabled={bulkActionInProgress}>{bulkActionInProgress ? '⏳ Issuing...' : `🧾 Issue All Pending (${pendingCountForYear})`}</button>}
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
                    <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1' }}><div style={s.formLabel}>Notes</div><input style={s.formInput} placeholder="Optional notes" value={manualForm.notes} onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} onClick={saveManualEntry} disabled={savingManual}>{savingManual ? 'Saving...' : '✓ Save Entry'}</button>
                    <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => { setShowManualForm(false); setManualError('') }}>Cancel</button>
                  </div>
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
                <div style={s.tableCard}>
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
                </div>
              </div>

              {selectedDonation && (
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
                        <span style={{ fontSize: 11, fontWeight: 700, color: selectedDonation.payment_status === 'confirmed' ? C.forest : '#7A4E00', background: selectedDonation.payment_status === 'confirmed' ? '#D9F0E3' : '#FCE9BE', padding: '4px 10px', borderRadius: 20 }}>
                          {selectedDonation.payment_status === 'confirmed' ? '✓ Paid' : '⚠ Unverified'}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: selectedDonation.receipt_issued ? C.forest : '#7A4E00', background: selectedDonation.receipt_issued ? '#D9F0E3' : '#FCE9BE', padding: '4px 10px', borderRadius: 20 }}>
                          {selectedDonation.receipt_issued ? '✓ Receipt issued' : 'Receipt pending'}
                        </span>
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
                              const { error } = await supabase.functions.invoke('send-thank-you', {
                                body: { donor_name: selectedDonation.donor_name, donor_email: selectedDonation.donor_email, charity_name: charityName, amount: selectedDonation.amount, date: new Date(selectedDonation.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' }), request_nric: true }
                              })
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                          <span style={{ fontSize: 13, color: C.muted }}>Receipt No.</span>
                          {editingManual && selectedDonation.source === 'manual' ? (
                            <input type="text" style={{ ...s.formInput, padding: '4px 8px', fontSize: 12, width: 160, textAlign: 'right' }}
                              value={editForm.receipt_number ?? (selectedDonation.receipt_number || '')}
                              onChange={e => setEditForm(f => ({ ...f, receipt_number: e.target.value }))} />
                          ) : (
                            <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: 'monospace' }}>{selectedDonation.source === 'manual' ? (selectedDonation.receipt_number || '—') : (selectedDonation.payment_ref || '—')}</span>
                          )}
                        </div>
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
                        {selectedDonation.payment_status === 'confirmed' && !selectedDonation.receipt_issued && (
                          <button style={{ ...s.btnForest, justifyContent: 'center' }} onClick={async () => {
                            const { error } = await supabase.from('donations').update({ receipt_issued: true }).eq('id', selectedDonation.id)
                            if (error) { showToast('Error issuing receipt', 'error'); return }
                            setDonations(prev => prev.map(x => x.id === selectedDonation.id ? { ...x, receipt_issued: true } : x))
                            setSelectedDonation(prev => ({ ...prev, receipt_issued: true }))

                            if (!selectedDonation.donor_email) {
                              showToast('Receipt issued ✓')
                              return
                            }

                            const donationSnapshot = { ...selectedDonation, receipt_issued: true }
                            const { error: emailError } = await supabase.functions.invoke('send-thank-you', {
                              body: {
                                donor_name: donationSnapshot.donor_name,
                                donor_email: donationSnapshot.donor_email,
                                charity_name: charityName,
                                charity_uen: charityUen,
                                amount: donationSnapshot.amount,
                                date: new Date(donationSnapshot.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' }),
                                payment_ref: donationSnapshot.payment_ref,
                                notes: donationSnapshot.notes,
                                cause_title: causeNameForDonation(donationSnapshot),
                              }
                            })
                            if (!emailError) {
                              await supabase.from('donations').update({ thank_you_sent: true }).eq('id', donationSnapshot.id)
                              setDonations(prev => prev.map(x => x.id === donationSnapshot.id ? { ...x, thank_you_sent: true } : x))
                              setSelectedDonation(prev => ({ ...prev, thank_you_sent: true }))
                              showToast('Receipt issued ✓ — thank you email sent to ' + donationSnapshot.donor_email + ' 💌')
                            } else {
                              showToast('Receipt issued but thank you email failed — send manually', 'error')
                            }
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

            <div style={isMobile ? s.statsGridMobile : isTablet ? s.statsGridTablet : s.statsGrid}>
              <div style={{ ...s.statCard, background: C.forest, borderColor: C.forest }}>
                <div style={{ ...s.statLabel, color: 'rgba(255,255,255,0.7)' }}>Total Raised</div>
                <div style={{ ...s.statValue, color: 'white' }}>${totalThisYear.toLocaleString()}</div>
                <div style={{ ...s.statNote, color: 'rgba(255,255,255,0.6)' }}>Year to date</div>
              </div>
              <div style={s.statCard}>
                <div style={s.statLabel}>Unique Donors</div>
                <div style={s.statValue}>{uniqueDonorsThisYear.length}</div>
                <div style={s.statNote}>{filterYear}</div>
              </div>
              <div style={s.statCard}>
                <div style={s.statLabel}>Avg. Donation</div>
                <div style={s.statValue}>${avgDonation.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                <div style={s.statNote}>Per transaction</div>
              </div>
              <div style={s.statCard}>
                <div style={s.statLabel}>Median Donation</div>
                <div style={s.statValue}>${medianDonation.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                <div style={s.statNote}>Typical single gift, {filterYear}</div>
              </div>
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
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: C.muted }}>No goal set for this year yet.</div>
                )}
              </div>
            )}

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

            {causePerformanceThisYear.length > 0 && (
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

            <div style={{ ...s.card, marginBottom: 24 }}>
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

            <div style={isMobile ? s.twoColMobile : s.twoCol}>
              <div style={s.card}>
                <div style={s.cardTitle}>🧾 Receipt Completion Rate</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 16 }}>
                  <div style={{ position: 'relative', width: 100, height: 100 }}>
                    <svg viewBox="0 0 36 36" style={{ width: 100, height: 100, transform: 'rotate(-90deg)' }}>
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke={C.border} strokeWidth="3" />
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke={C.sage} strokeWidth="3"
                        strokeDasharray={`${(() => { const yd = filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).toLocaleDateString('en-SG', { year: 'numeric' }) === filterYear); return yd.length ? (yd.filter(d => d.receipt_issued).length / yd.length) * 100 : 0 })()} 100`} strokeLinecap="round" />
                    </svg>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 16, fontWeight: 800, color: C.forest }}>
                      {(() => { const yd = filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).toLocaleDateString('en-SG', { year: 'numeric' }) === filterYear); return yd.length ? Math.round((yd.filter(d => d.receipt_issued).length / yd.length) * 100) : 0 })()}%
                    </div>
                  </div>
                  <div>
                    {(() => {
                      const yd = filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).toLocaleDateString('en-SG', { year: 'numeric' }) === filterYear)
                      const yIssued = yd.filter(d => d.receipt_issued).length
                      const yPending = yd.length - yIssued
                      return (
                        <>
                          <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}><span style={{ fontWeight: 700, color: C.sage }}>{yIssued}</span> receipts issued</div>
                          <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}><span style={{ fontWeight: 700, color: C.warning }}>{yPending}</span> still pending</div>
                          <div style={{ fontSize: 13, color: C.muted }}><span style={{ fontWeight: 700, color: C.forest }}>{yd.length}</span> total donations</div>
                        </>
                      )
                    })()}
                  </div>
                </div>
                {pendingCountForYear > 0 && <button style={s.btnForest} onClick={issueAllReceipts} disabled={bulkActionInProgress}>{bulkActionInProgress ? '⏳ Issuing...' : `🧾 Issue All Pending Receipts (${filterYear === 'All' ? 'all years' : filterYear})`}</button>}
              </div>
              <div style={s.card}>
                <div style={s.cardTitle}>📅 Recent Activity{filterYear !== 'All' ? ` — ${filterYear}` : ''}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear))).slice(0, 5).map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 4 ? `1px solid ${C.ivoryDark}` : 'none', cursor: 'pointer' }}
                      onClick={() => goToDonation(d)}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.receipt_issued ? C.sage : C.gold, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.forest }}>{d.donor_name}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{new Date(d.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })} · {d.receipt_issued ? '✓ Issued' : 'Pending receipt'}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.forest }}>${Number(d.amount).toLocaleString()}</div>
                    </div>
                  ))}
                  {(filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear))).length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: 20 }}>No donations in {filterYear === 'All' ? 'this range' : filterYear}</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── IRAS ── */}
        {activeTab === 'iras' && charityIsIpc && (
          <div style={s.content}>
            <div style={s.pageHeader}>
              <div>
                <div style={s.pageTitle}>IRAS Export</div>
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
              <button style={s.btnForest} onClick={exportPDF}>📄 Download PDF Report</button>
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
                        <td style={s.td}><div style={s.donorCell}><div style={{ ...s.donorAvatar, background: [C.sage, C.teal, C.gold, C.forest, C.red][i % 5] }}>{d.name?.charAt(0)}</div><div style={s.donorName}>{d.name}</div></div></td>
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
                <div style={s.pageTitle}>Activity Log</div>
                <div style={s.pageSub}>A record of changes made to your donations — by you, your team, or donors.</div>
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
                <div style={s.pageTitle}>Promotions</div>
                <div style={s.pageSub}>Submit campaigns and sponsored banner requests for Giving Tree's review</div>
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

              <div style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: C.muted, lineHeight: 2 }}>
                <a href="https://givingtree.sg/privacy" target="_blank" rel="noopener noreferrer" style={{ color: C.muted, textDecoration: 'underline' }}>Privacy Policy</a>
                {' · '}
                <a href="https://givingtree.sg/terms" target="_blank" rel="noopener noreferrer" style={{ color: C.muted, textDecoration: 'underline' }}>Terms of Use</a>
              </div>

            </div>
          </div>
        )}

      </div>

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
                  const { donor, badgeState, text } = thankYouDraft
                  const { error } = await supabase.functions.invoke('send-thank-you', {
                    body: {
                      type: 'milestone_thank_you',
                      donor_name: donor.name,
                      donor_email: donor.email,
                      charity_name: charityName,
                      charity_uen: charityUen,
                      custom_message: text,
                    }
                  })
                  if (error) { showToast('Failed to send email', 'error'); return }
                  await ackDonorBadges(donor, badgeState)
                  setThankYouDraft(null)
                  showToast(`Thank-you note sent to ${donor.email}`)
                }}
              >💌 {thankYouDraft.donor.email?.trim() ? 'Send' : 'No email on file'}</button>
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
  main: { marginLeft: 240, flex: 1 },
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
