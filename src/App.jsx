import { useState, useEffect } from 'react'
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
  const isCompact = isMobile || isTablet
  const [donations, setDonations] = useState([])
  const [loading, setLoading] = useState(true)
  const [issuing, setIssuing] = useState(null)
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [selectedDonor, setSelectedDonor] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [filterNric, setFilterNric] = useState('All')
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString())
  const [showManualForm, setShowManualForm] = useState(false)
  const [manualForm, setManualForm] = useState({ donor_name: '', donor_nric: '', amount: '', payment_method: 'Cash', notes: '', donor_email: '', date: new Date().toISOString().split('T')[0] })
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
  

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) {
      loadDonations()
      loadMyCauses()
    }
  }, [session])

  async function loadMyCauses() {
    const { data, error } = await supabase
      .from('causes')
      .select('*')
      .eq('charity_uen', charityUenFromSession())
      .order('created_at', { ascending: false })
    if (error) { console.error(error); return }
    setMyCauses(data)
  }

  function charityUenFromSession() {
    return session?.user?.user_metadata?.charity_uen || ''
  }

  async function submitCause() {
    if (!causeForm.title.trim()) { setCauseError('Title is required'); return }
    if (!causeForm.description.trim()) { setCauseError('Description is required'); return }
    setSavingCause(true)
    setCauseError('')
    const { error } = await supabase.from('causes').insert([{
      title: causeForm.title,
      description: causeForm.description,
      charity_name: charityName,
      charity_uen: charityUen,
      target_amount: causeForm.target_amount ? parseFloat(causeForm.target_amount) : null,
      end_date: causeForm.end_date || null,
      type: 'campaign',
      status: 'pending',
      active: true,
    }])
    setSavingCause(false)
    if (error) { setCauseError(`Error: ${error.message}`); return }
    supabase.functions.invoke('notify-pending-approval', { body: { title: causeForm.title, charity_name: charityName, type: 'campaign' } }).catch(err => console.error(err))
    setCauseForm({ title: '', description: '', target_amount: '', end_date: '' })
    setShowCauseForm(false)
    loadMyCauses()
    showToast('Cause submitted for approval ✓')
  }

  async function submitSponsoredRequest() {
    setSavingSponsored(true)
    setSponsoredError('')
    const { error } = await supabase.from('causes').insert([{
      title: `${charityName} — Sponsored Spot`,
      description: `Sponsored banner request from ${charityName}.`,
      charity_name: charityName,
      charity_uen: charityUen,
      type: 'sponsored',
      status: 'pending',
      active: true,
    }])
    setSavingSponsored(false)
    if (error) { setSponsoredError(`Error: ${error.message}`); return }
    supabase.functions.invoke('notify-pending-approval', { body: { title: `${charityName} — Sponsored Spot`, charity_name: charityName, type: 'sponsored' } }).catch(err => console.error(err))
    setShowSponsoredForm(false)
    loadMyCauses()
    showToast('Sponsored banner request submitted for approval ✓')
  }

  async function loadAuditLog() {
    setAuditLoading(true)
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) { console.error(error); setAuditLoading(false); return }
    setAuditLog(data)
    setAuditLoading(false)
  }

  useEffect(() => {
    if (session && activeTab === 'activity') loadAuditLog()
  }, [session, activeTab])

  async function loadDonations() {
    const { data, error } = await supabase
      .from('donations')
      .select('*')
      .eq('charity_uen', session.user.user_metadata.charity_uen)  
      .not('status', 'in', '(cancelled_by_donor,deleted_by_charity)')
      .order('created_at', { ascending: false })
    if (error) { console.error(error); return }
    setDonations(data)
    setLoading(false)
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
    const yearScoped = filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).getFullYear().toString() === filterYear)
    const pending = yearScoped.filter(d => !d.receipt_issued && d.payment_status === 'confirmed')
    if (pending.length === 0) { showToast('No confirmed payments pending receipt for ' + filterYear, 'error'); return }
    for (const d of pending) await issueReceipt(d, true)
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'bulk_receipts_issued',
      details: { donation_count: pending.length, year: filterYear },
    })
    showToast(`${pending.length} receipt${pending.length > 1 ? 's' : ''} issued for ${filterYear}`)
  }

  async function requestAllMissingNric() {
    const yearScoped = filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).getFullYear().toString() === filterYear)
    const missing = yearScoped.filter(d => !d.donor_nric && d.donor_email?.trim())
    if (missing.length === 0) { showToast(`No donors with email on file are missing NRIC for ${filterYear}`, 'error'); return }

    const byDonor = {}
    missing.forEach(d => {
      if (!byDonor[d.donor_email]) byDonor[d.donor_email] = { donor_name: d.donor_name, donor_email: d.donor_email, total: 0, count: 0 }
      byDonor[d.donor_email].total += d.amount
      byDonor[d.donor_email].count += 1
    })
    const donorList = Object.values(byDonor)

    if (!window.confirm(`Send a consolidated NRIC request to ${donorList.length} donor${donorList.length > 1 ? 's' : ''} missing NRIC?`)) return

    let sent = 0
    for (const donor of donorList) {
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
    }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'bulk_nric_requested',
      details: { donor_count: sent },
    })
    showToast(`NRIC request sent to ${sent} of ${donorList.length} donors`)
  }

  function goToDonation(donation) {
    setFilterYear('All')
    setFilterType('All')
    setFilterNric('All')
    setSelectedDonation(donation)
    setActiveTab('donations')
  }

  async function saveManualEntry() {
  if (!manualForm.donor_name) { setManualError('Donor name is required'); return }
  if (!manualForm.amount || parseFloat(manualForm.amount) <= 0) { setManualError('Please enter a valid amount'); return }
  if (new Date(manualForm.date) > new Date()) { setManualError('Donation date cannot be in the future'); return }
    setSavingManual(true)
    setManualError('')
    const { data, error } = await supabase.from('donations').insert([{
      donor_name: manualForm.donor_name,
      donor_nric: manualForm.donor_nric,
      charity_name: charityName,
      charity_uen: charityUen,
      amount: parseFloat(manualForm.amount),
      status: 'confirmed',
      payment_status: 'confirmed',
      receipt_issued: false,
      source: 'manual',
      payment_method: manualForm.payment_method,
      notes: manualForm.notes,
      donor_email: manualForm.donor_email,
      created_at: manualForm.date,
    }]).select()
    if (error) { console.error('Manual entry insert error:', error); setManualError(`Error saving: ${error.message}`); setSavingManual(false); return }
    await supabase.from('audit_log').insert({
      actor_type: 'charity',
      actor_email: session.user.email,
      action: 'manual_entry_created',
      donation_id: data[0].id,
      details: { donor_name: manualForm.donor_name, amount: parseFloat(manualForm.amount), payment_method: manualForm.payment_method },
    })
    setDonations(prev => [{ ...data[0] }, ...prev])
    setManualForm({ donor_name: '', donor_nric: '', amount: '', payment_method: 'Cash', notes: '', donor_email: '', date: new Date().toISOString().split('T')[0] })
    setShowManualForm(false)
    setSavingManual(false)
  }

  async function deleteDonation(id) {
    const donationToDelete = donations.find(d => d.id === id)
    const warningText = donationToDelete?.receipt_issued
      ? 'This entry already has a receipt issued. Delete anyway? The record will be kept for audit purposes but removed from your active lists.'
      : 'Delete this manual entry? The record will be kept for audit purposes but removed from your active lists.'
    if (!window.confirm(warningText)) return
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
        const { error: restoreError } = await supabase.from('donations').update({ status: 'confirmed' }).eq('id', id)
        if (restoreError) { showToast('Could not restore entry', 'error'); return }
        setDonations(prev => [donationToDelete, ...prev])
        setToast(null)
        showToast('Entry restored ✓')
      }
    })
    setTimeout(() => {
      if (!cancelled) setToast(null)
    }, 10000)
  }

  const charityName  = session?.user?.user_metadata?.charity_name || 'Your Charity'
  const charityUen   = session?.user?.user_metadata?.charity_uen  || ''
  const totalAllTime = donations.reduce((s, d) => s + d.amount, 0)
  const totalThisYear = filterYear === 'All'
    ? donations.filter(d => d.payment_status === 'confirmed').reduce((s, d) => s + d.amount, 0)
    : donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear) && d.payment_status === 'confirmed').reduce((s, d) => s + d.amount, 0)
  const pendingCount = donations.filter(d => !d.receipt_issued).length
  const unconfirmedCount = donations.filter(d => d.payment_status !== 'confirmed').length
  const issuedCount  = donations.filter(d => d.receipt_issued).length
  const uniqueDonors = [...new Set(donations.map(d => d.donor_name))]
  const avgDonation  = donations.length ? (totalAllTime / donations.length) : 0
  const currentYear = new Date().getFullYear()
  const irasDeadline = new Date(`${currentYear + 1}-01-31`)
  const daysToDeadline = Math.ceil((irasDeadline - new Date()) / (1000 * 60 * 60 * 24))
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'

  const donorMap = {}
  donations.forEach(d => {
    if (!donorMap[d.donor_name]) {
      donorMap[d.donor_name] = { name: d.donor_name, email: d.donor_email, total: 0, count: 0, lastDate: d.created_at, receipts: 0 }
    }
    if (!donorMap[d.donor_name].email && d.donor_email) donorMap[d.donor_name].email = d.donor_email
    donorMap[d.donor_name].total += d.amount
    donorMap[d.donor_name].count += 1
    if (d.receipt_issued) donorMap[d.donor_name].receipts += 1
    if (new Date(d.created_at) > new Date(donorMap[d.donor_name].lastDate)) {
      donorMap[d.donor_name].lastDate = d.created_at
    }
  })
  const donorList = Object.values(donorMap).sort((a, b) => b.total - a.total)

  const filteredDonations = donations.filter(d => {
    const matchSearch = d.donor_name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchYear = filterYear === 'All' || new Date(d.created_at).getFullYear().toString() === filterYear
    const matchType = filterType === 'All' || (filterType === 'Pending' && !d.receipt_issued) || (filterType === 'Issued' && d.receipt_issued)
    const matchNric = filterNric === 'All' || (filterNric === 'Missing NRIC' && !d.donor_nric)
    return matchSearch && matchYear && matchType && matchNric
  })

  // Year-filtered donor map for IRAS tab
  const irasYearDonorMap = {}
  donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear)).forEach(d => {
    if (!irasYearDonorMap[d.donor_name]) irasYearDonorMap[d.donor_name] = { name: d.donor_name, total: 0, count: 0, donations: [] }
    irasYearDonorMap[d.donor_name].total += d.amount
    irasYearDonorMap[d.donor_name].count += 1
    irasYearDonorMap[d.donor_name].donations.push(d)
  })
  const irasYearDonorList = Object.values(irasYearDonorMap).sort((a, b) => b.total - a.total)

  function exportIRASExcel() {
    const yearDonations = donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear))
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
      'ID Type': d.donor_nric.startsWith('S') || d.donor_nric.startsWith('T') || d.donor_nric.startsWith('F') || d.donor_nric.startsWith('G') ? 'NRIC/FIN' : 'UEN',
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
      'Action Required': 'Request NRIC/FIN from donor to qualify for tax deduction',
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

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
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
    XLSX.writeFile(wb, `GivingTree-DonorContacts-${charityName}.csv`)
  }

  function exportPDF() {
    const yearDonationsForExport = filterYear === 'All'
      ? donations
      : donations.filter(d => new Date(d.created_at).getFullYear().toString() === filterYear)
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
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('Official Donation Receipt', 14, 25)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(charityName, 14, 35)
    doc.text(`UEN: ${charityUen}`, 14, 42)
    doc.line(14, 48, 196, 48)
    doc.text(`Donor: ${donation.donor_name}`, 14, 60)
    doc.text(`Amount: SGD $${Number(donation.amount).toFixed(2)}`, 14, 70)
    doc.text(`Date: ${new Date(donation.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}`, 14, 80)
    doc.text(`Payment Method: ${donation.payment_method || (donation.source === 'manual' ? 'Manual Entry' : 'PayNow')}`, 14, 90)
    if (donation.donor_nric) doc.text(`NRIC/FIN: ${donation.donor_nric}`, 14, 100)
    doc.line(14, donation.donor_nric ? 108 : 98, 196, donation.donor_nric ? 108 : 98)
    doc.setFont('helvetica', 'bold')
    const y2 = donation.donor_nric ? 120 : 110
    doc.text(`Tax Deductible (250%): SGD $${(donation.amount * 2.5).toFixed(2)}`, 14, y2)
    doc.text(`Est. Tax Savings: SGD $${(donation.amount * 2.5 * 0.22).toFixed(2)}`, 14, y2 + 10)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    if (!donation.donor_nric) {
      doc.setTextColor(160, 113, 16)
      doc.text('⚠ NRIC/FIN not on file. Donor must provide this to claim the tax deduction.', 14, y2 + 22)
      doc.setTextColor(0, 0, 0)
    }
    doc.text(`Issued via Giving Tree on behalf of ${charityName}.`, 14, y2 + 32)
    doc.save(`Receipt-${donation.donor_name}-${new Date(donation.created_at).toISOString().split('T')[0]}.pdf`)
  }

  function exportYearEndSummary() {
    const doc = new jsPDF()
    const yearDons = donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear))
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

  if (authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: C.ivory, fontFamily: 'Segoe UI', fontSize: 16, color: C.muted }}>
      Loading...
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
          {[{ id: 'iras', icon: '🏛️', label: 'IRAS Export' }, { id: 'activity', icon: '📋', label: 'Activity Log' }].map(item => (
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
            { id: 'iras',      icon: '🏛️', label: 'IRAS Export' },
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
            <div style={s.mobileOverflowItem} onClick={() => { setActiveTab('iras'); setSelectedDonor(null); setShowMobileMenu(false) }}>🏛️ IRAS Export</div>
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
            {unconfirmedCount > 0 && (
              <div style={{ ...s.deadlineBanner, background: C.gold, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ fontSize: 24 }}>💳</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.forest }}>{unconfirmedCount} donation{unconfirmedCount > 1 ? 's' : ''} awaiting payment confirmation</div>
                    <div style={{ fontSize: 12, color: C.teal, marginTop: 2 }}>Confirm receipt of payment to issue receipts and notify donors</div>
                  </div>
                </div>
                <button style={{ ...s.bannerBtn, background: C.forest, color: 'white' }} onClick={() => setActiveTab('donations')}>Review Now</button>
              </div>
            )}
            {pendingCount > 0 && (
              <div style={s.deadlineBanner}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ fontSize: 24 }}>⚠️</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'white' }}>IRAS Deadline: 31 January {currentYear + 1} — {daysToDeadline} days remaining</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{pendingCount} receipt{pendingCount > 1 ? 's' : ''} still pending · Action required before deadline</div>
                  </div>
                </div>
                <button style={s.bannerBtn} onClick={issueAllReceipts}>Issue All Receipts</button>
              </div>
            )}
            {donations.filter(d => !d.donor_nric).length > 0 && (
              <div style={{ ...s.deadlineBanner, background: C.teal, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ fontSize: 24 }}>🪪</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'white' }}>{donations.filter(d => !d.donor_nric).length} donation{donations.filter(d => !d.donor_nric).length > 1 ? 's' : ''} missing NRIC</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>Needed for donors to claim their 250% tax deduction</div>
                  </div>
                </div>
                <button style={s.bannerBtn} onClick={() => setActiveTab('donations')}>Review →</button>
              </div>
            )}
            {donations.length === 0 && (
              <div style={{ background: C.white, border: `1.5px solid ${C.sage}`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.forest, marginBottom: 4 }}>👋 Welcome to Giving Tree</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>A few things to get you started:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Confirm your charity details are correct', action: () => setActiveTab('settings') },
                    { label: 'Try logging a donation manually (cash, cheque, or wire)', action: () => { setActiveTab('donations'); setShowManualForm(true) } },
                    { label: 'Check your IRAS export once you have a donation', action: () => setActiveTab('iras') },
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
                <div style={s.pageSub}>Here's your donation overview for {filterYear}</div>
              </div>
              <select style={{ ...s.filterSelect, padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700 }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                {donations.length === 0
  ? <option>{new Date().getFullYear()}</option>
  : [...new Set(donations.map(d => new Date(d.created_at).getFullYear()))].sort((a,b) => b-a).map(y => <option key={y}>{y}</option>)
}
              </select>
            </div>

            <div style={isMobile ? s.statsGridMobile : isTablet ? s.statsGridTablet : s.statsGrid}>
              <div style={{ ...s.statCard, background: C.forest, borderColor: C.forest }}>
                <div style={{ ...s.statLabel, color: 'rgba(255,255,255,0.7)' }}>Confirmed, {filterYear}</div>
                <div style={{ ...s.statValue, color: 'white' }}>${totalThisYear.toLocaleString()}</div>
                <div style={{ ...s.statNote, color: 'rgba(255,255,255,0.6)' }}>{donations.length} donations</div>
              </div>
              <div style={s.statCard}>
                <div style={s.statLabel}>Unique Donors</div>
                <div style={s.statValue}>{uniqueDonors.length}</div>
                <div style={s.statNote}>All time</div>
              </div>
              <div style={s.statCard}>
                <div style={s.statLabel}>Avg. Donation</div>
                <div style={s.statValue}>${avgDonation.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                <div style={s.statNote}>Per transaction</div>
              </div>
              <div style={{ ...s.statCard, background: pendingCount > 0 ? C.warningBg : s.statCard.background, borderColor: pendingCount > 0 ? C.warningBorder : C.border }}>
                <div style={{ ...s.statLabel, color: pendingCount > 0 ? C.warning : C.muted }}>Receipts Pending</div>
                <div style={{ ...s.statValue, color: pendingCount > 0 ? C.warning : C.forest }}>{pendingCount}</div>
                <div style={{ ...s.statNote, color: pendingCount > 0 ? C.warning : C.muted }}>{pendingCount > 0 ? 'Action needed' : 'All caught up ✓'}</div>
              </div>
            </div>

            <div style={isMobile ? s.twoColMobile : s.twoCol}>
              <div style={s.card}>
                <div style={s.cardTitle}>🏛️ IRAS Submission Status</div>
                <div style={s.statusStep}>
                  <div style={{ ...s.stepDot, background: C.sage }}>✓</div>
                  <div><div style={s.stepTitle}>Donations Recorded</div><div style={s.stepSub}>{donations.length} transactions captured</div></div>
                </div>
                <div style={s.stepLine} />
                <div style={s.statusStep}>
                  <div style={{ ...s.stepDot, background: pendingCount > 0 ? C.warningBg : C.sage, color: pendingCount > 0 ? C.warning : 'white', border: pendingCount > 0 ? `2px solid ${C.warningBorder}` : 'none' }}>{pendingCount > 0 ? '!' : '✓'}</div>
                  <div><div style={{ ...s.stepTitle, color: pendingCount > 0 ? C.warning : C.forest }}>Receipts {pendingCount > 0 ? 'Pending' : 'Complete'}</div><div style={s.stepSub}>{pendingCount > 0 ? `${pendingCount} donations need receipts` : 'All receipts issued'}</div></div>
                </div>
                <div style={s.stepLine} />
                <div style={s.statusStep}>
                  <div style={{ ...s.stepDot, background: C.ivoryDark, color: C.muted, border: `2px solid ${C.border}` }}>→</div>
                  <div><div style={{ ...s.stepTitle, color: C.muted }}>Submit to IRAS</div><div style={s.stepSub}>Due 31 January {currentYear + 1}</div></div>
                </div>
              </div>

              <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ fontSize: 24 }}>🏛️</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.forest }}>IRAS submission ready for {filterYear}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Export your file, check missing NRICs, or generate a board summary</div>
                  </div>
                </div>
                <button style={{ ...s.btnForest, marginTop: 'auto' }} onClick={() => setActiveTab('iras')}>Go to IRAS Export →</button>
              </div>
            </div>

            <div style={s.tableCard}>
              <div style={s.tableHeader}>
                <div style={s.tableTitle}>Recent Donations</div>
                {pendingCount > 0 && <div style={s.pendingBadge}>⚡ {pendingCount} pending</div>}
              </div>
              {loading ? <div style={s.empty}>Loading...</div> : donations.length === 0 ? <div style={s.empty}>No donations yet.</div> : isMobile ? (
                <div>
                  {donations.slice(0, 10).map(d => (
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
                      <div style={s.donationCardBadges}>
                        {d.payment_status === 'confirmed' ? <span style={s.badgeIssued}>✓ Paid</span> : <span style={s.badgePending}>✕ Paid</span>}
                        {d.receipt_issued ? <span style={s.badgeIssued}>✓ Receipt</span> : <span style={s.badgePending}>✕ Receipt</span>}
                        {!d.donor_nric && <span style={s.badgePending}>⚠️ NRIC missing</span>}
                        <span style={d.thank_you_sent ? s.badgeIssued : s.badgePending}>{d.thank_you_sent ? '✓' : '✕'} Thank You</span>
                      </div>  
                    </div>
                  ))}
                </div>
              ) : (
                <table style={s.table}>
                  <thead>
                    <tr>{(isTablet ? ['Donor', 'Amount', 'Date', 'Payment', 'Receipt', 'Thank You'] : ['Donor', 'Amount', 'Date', 'Source', 'Receipt', 'Payment', 'NRIC', 'Email', 'Thank You']).map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {donations.slice(0, 10).map(d => (
                      <tr key={d.id} style={{ ...s.tr, cursor: 'pointer' }} onClick={() => goToDonation(d)}>
                        <td style={s.td}><div style={s.donorCell}><div style={{ ...s.donorAvatar, background: C.sage }}>{d.donor_name?.charAt(0)}</div><div style={s.donorName}>{d.donor_name}</div></div></td>
                        <td style={s.td}><span style={s.amountText}>${Number(d.amount).toLocaleString()}</span></td>
                        <td style={s.td}><span style={s.dateText}>{new Date(d.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</span></td>
                        {!isTablet && <td style={s.td}>{d.source === 'manual' ? <span style={{ ...s.badgePending, color: C.gold, background: '#FDF8EC' }}>✏️ {d.payment_method || 'Manual'}</span> : <span style={s.badgeIssued}>📱 App</span>}</td>}
                        <td style={s.td}>{d.payment_status === 'confirmed' ? <span style={s.badgeIssued}>✓ Paid</span> : <span style={s.badgePending}>⚠️ Unverified</span>}</td>
                        <td style={s.td}>{d.receipt_issued ? <span style={s.badgeIssued}>✓ Issued</span> : <span style={s.badgePending}>Pending</span>}</td>
                        {!isTablet && <td style={s.td}>{d.donor_nric ? <span style={s.badgeIssued}>✓ {d.donor_nric}</span> : <span style={s.badgePending}>⚠️ Missing</span>}</td>}
                        {!isTablet && <td style={s.td}><span style={{ fontSize: 12, color: d.donor_email ? C.forest : C.muted }}>{d.donor_email || '—'}</span></td>}
                        <td style={s.td}>{d.thank_you_sent ? <span style={s.badgeIssued}>💌 Sent</span> : <span style={{ fontSize: 10, color: C.muted }}>—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
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
              <button style={isMobile ? { ...s.exportSmallBtn, width: '100%' } : s.exportSmallBtn} onClick={exportIRASExcel}>⬇️ Export IRAS</button>
            </div>
            <div style={s.tableCard}>
              <div style={s.tableHeader}>
                <div style={s.tableTitle}>All Donors</div>
                <div style={s.tableCount}>{donorList.length} donors</div>
              </div>
              {loading ? <div style={s.empty}>Loading...</div> : donorList.length === 0 ? <div style={s.empty}>No donors yet.</div> : isMobile ? (
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
                    <tr>{(isTablet ? ['Donor', 'Total Given', 'Receipts', ''] : ['Donor', 'Total Given', 'Donations', 'Last Donation', 'Receipts', '']).map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {donorList.filter(d => d.name?.toLowerCase().includes(searchTerm.toLowerCase())).map((d, i) => (
                      <tr key={i} style={s.tr}>
                        <td style={s.td}><div style={s.donorCell}><div style={{ ...s.donorAvatar, background: [C.sage, C.teal, C.gold, C.forest, C.red][i % 5] }}>{d.name?.charAt(0)}</div><div style={s.donorName}>{d.name}</div></div></td>
                        <td style={s.td}><span style={s.amountText}>${d.total.toLocaleString()}</span></td>
                        {!isTablet && <td style={s.td}><span style={s.dateText}>{d.count} donation{d.count > 1 ? 's' : ''}</span></td>}
                        {!isTablet && <td style={s.td}><span style={s.dateText}>{new Date(d.lastDate).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</span></td>}
                        <td style={s.td}><span style={d.receipts === d.count ? s.badgeIssued : s.badgePending}>{d.receipts}/{d.count} issued</span></td>
                        <td style={s.td}><button style={s.viewBtn} onClick={() => setSelectedDonor(d)}>View</button></td>
                      </tr>
                    ))}
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
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>Donor since {new Date(donations.filter(d => d.donor_name === selectedDonor.name).slice(-1)[0]?.created_at).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })}</div>
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
                </div>
              </div>
              <div style={s.card}>
                <div style={s.cardTitle}>Donation History</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {donations.filter(d => d.donor_name === selectedDonor.name).map(d => (
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
                  <button style={issuing ? s.issuingBtn : s.btnForest} disabled={!!issuing} onClick={() => donations.filter(d => d.donor_name === selectedDonor.name && !d.receipt_issued).forEach(d => issueReceipt(d))}>{issuing ? '⏳ Issuing...' : '🧾 Issue All Receipts'}</button>
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
                {pendingCount > 0 && <button style={s.btnForest} onClick={issueAllReceipts}>🧾 Issue All Pending ({pendingCount})</button>}
                <button style={s.btnGold} onClick={() => setShowManualForm(true)}>+ Manual Entry</button>
              </div>
            </div>

            {showManualForm && (
              <div style={{ background: C.white, borderRadius: 16, border: `1.5px solid ${C.border}`, padding: isMobile ? 16 : 24, marginBottom: 24 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.forest, marginBottom: 16 }}>📝 New Manual Entry</div>
                {manualError && <div style={{ background: C.warningBg, color: C.warning, padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12 }}>{manualError}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div><div style={s.formLabel}>Donor Name *</div><input style={s.formInput} placeholder="Full name" value={manualForm.donor_name} onChange={e => setManualForm(f => ({ ...f, donor_name: e.target.value }))} /></div>
                  <div><div style={s.formLabel}>NRIC / FIN</div><input style={s.formInput} placeholder="e.g. S1234567A" value={manualForm.donor_nric} onChange={e => setManualForm(f => ({ ...f, donor_nric: e.target.value }))} maxLength={9} /></div>
                  <div><div style={s.formLabel}>Amount (SGD) *</div><input style={s.formInput} type="number" placeholder="0.00" value={manualForm.amount} onChange={e => setManualForm(f => ({ ...f, amount: e.target.value }))} /></div>
                  <div><div style={s.formLabel}>Date</div><input style={s.formInput} type="date" value={manualForm.date} onChange={e => setManualForm(f => ({ ...f, date: e.target.value }))} /></div>
                  <div><div style={s.formLabel}>Payment Method</div>
                    <select style={s.formInput} value={manualForm.payment_method} onChange={e => setManualForm(f => ({ ...f, payment_method: e.target.value }))}>
                      <option>Cash</option><option>Bank Wire</option><option>Cheque</option><option>PayNow Direct</option><option>Other</option>
                    </select>
                  </div>
                  <div><div style={s.formLabel}>Donor Email</div><input style={s.formInput} placeholder="donor@email.com" value={manualForm.donor_email || ''} onChange={e => setManualForm(f => ({ ...f, donor_email: e.target.value }))} /></div>
                  <div><div style={s.formLabel}>Notes</div><input style={s.formInput} placeholder="Optional notes" value={manualForm.notes} onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))} /></div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button style={s.btnForest} onClick={saveManualEntry} disabled={savingManual}>{savingManual ? 'Saving...' : '✓ Save Entry'}</button>
                  <button style={s.viewBtn} onClick={() => { setShowManualForm(false); setManualError('') }}>Cancel</button>
                </div>
              </div>
            )}

            <div style={isMobile ? { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 } : { display: 'flex', gap: 12, marginBottom: 20 }}>
              <input style={s.searchBox} placeholder="🔍 Search by donor name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              <div style={isMobile ? { display: 'flex', gap: 10, flexWrap: 'wrap' } : { display: 'flex', gap: 12 }}>
                <select style={isMobile ? { ...s.filterSelect, flex: 1, minWidth: 100 } : s.filterSelect} value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option>All</option><option>Pending</option><option>Issued</option>
                </select>
                <select style={{ ...(isMobile ? { ...s.filterSelect, flex: 1, minWidth: 100 } : s.filterSelect), borderColor: filterNric !== 'All' ? C.warningBorder : C.border, background: filterNric !== 'All' ? C.warningBg : C.white }} value={filterNric} onChange={e => setFilterNric(e.target.value)}>
                  <option value="All">All NRICs</option>
                  <option value="Missing NRIC">⚠️ Missing NRIC</option>
                </select>
                <select style={isMobile ? { ...s.filterSelect, flex: 1, minWidth: 100 } : s.filterSelect} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                  <option>All</option>
                  {donations.length === 0
    ? <option>{new Date().getFullYear()}</option>
    : [...new Set(donations.map(d => new Date(d.created_at).getFullYear()))].sort((a,b) => b-a).map(y => <option key={y}>{y}</option>)
  }
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.tableCard}>
                  <div style={s.tableHeader}>
                    <div style={s.tableTitle}>All Donations</div>
                    <div style={s.tableCount}>{filteredDonations.length} records</div>
                  </div>
                  {loading ? <div style={s.empty}>Loading...</div> : filteredDonations.length === 0 ? <div style={s.empty}>No donations found.</div> : isMobile ? (
                    <div>
                      {filteredDonations.map(d => (
                        <div key={d.id} style={s.donationCard} onClick={() => setSelectedDonation(d)}>
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
                          <div style={s.donationCardBadges}>
                            {d.receipt_issued ? <span style={s.badgeIssued}>✓ Issued</span> : <span style={s.badgePending}>Receipt pending</span>}
                            {!d.donor_nric && <span style={s.badgePending}>⚠️ NRIC missing</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <table style={s.table}>
                      <thead>
                        <tr>{(isTablet ? ['Donor', 'Amount', 'Date', 'Receipt', 'NRIC'] : ['Donor', 'Amount', 'Date', 'Source', 'Receipt', 'NRIC', 'Payment', 'Thank You']).map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {filteredDonations.map(d => (
                          <tr key={d.id} style={{ ...s.tr, background: selectedDonation?.id === d.id ? C.successBg : 'transparent', cursor: 'pointer' }} onClick={() => setSelectedDonation(selectedDonation?.id === d.id ? null : d)}>
                            <td style={s.td}><div style={s.donorCell}><div style={{ ...s.donorAvatar, background: C.sage }}>{d.donor_name?.charAt(0)}</div><div><div style={s.donorName}>{d.donor_name}</div>{d.notes && <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', marginTop: 2 }}>📝 {d.notes}</div>}</div></div></td>
                            <td style={s.td}><span style={s.amountText}>${Number(d.amount).toLocaleString()}</span></td>
                            <td style={s.td}><span style={s.dateText}>{new Date(d.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</span></td>
                            {!isTablet && <td style={s.td}>{d.source === 'manual' ? <span style={{ ...s.badgePending, color: C.gold, background: '#FDF8EC' }}>✏️ {d.payment_method || 'Manual'}</span> : <span style={s.badgeIssued}>📱 App</span>}</td>}
                            <td style={s.td}>{d.receipt_issued ? <span style={s.badgeIssued}>✓ Issued</span> : <span style={s.badgePending}>Pending</span>}</td>
                            <td style={s.td}>{d.donor_nric ? <span style={s.badgeIssued}>✓ {d.donor_nric}</span> : <span style={s.badgePending}>⚠️ Missing</span>}</td>
                            {!isTablet && <td style={s.td}>{d.payment_status === 'confirmed' ? <span style={s.badgeIssued}>✓ Paid</span> : <span style={s.badgePending}>⚠️ Unverified</span>}</td>}
                            {!isTablet && <td style={s.td}>{d.thank_you_sent ? <span style={s.badgeIssued}>💌 Sent</span> : <span style={{ fontSize: 10, color: C.muted }}>—</span>}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {selectedDonation && (
                <div style={isMobile ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, background: C.ivory, overflowY: 'auto' } : { width: 320, flexShrink: 0 }}>
                  <div style={isMobile ? { background: C.white, minHeight: '100%' } : { background: C.white, borderRadius: 16, border: `1.5px solid ${C.border}`, overflow: 'hidden', position: 'sticky', top: 24 }}>
                    <div style={{ background: C.teal, padding: '20px 20px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Donation Details</div>
                        <button style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }} onClick={() => { setSelectedDonation(null); setEditingManual(false); setEditForm({}) }}>✕</button>
                      </div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: 'white', marginTop: 10 }}>${Number(selectedDonation.amount).toLocaleString()}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{new Date(selectedDonation.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    </div>
                    <div style={{ padding: 16, overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
                      {[
                        { label: 'Donor', key: 'donor_name', value: selectedDonation.donor_name, editable: true },
                        { label: 'Email', key: 'donor_email', value: selectedDonation.donor_email || '—', editable: true },
                        { label: 'Source', key: null, value: selectedDonation.source === 'manual' ? `Manual (${selectedDonation.payment_method})` : 'Giving Tree App', editable: false },
                        { label: 'Amount (SGD)', key: 'amount', value: `$${Number(selectedDonation.amount).toLocaleString()}`, editable: true, type: 'number' },
                        { label: 'Date', key: 'created_at', value: new Date(selectedDonation.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' }), editable: true, type: 'date' },
                        { label: 'Receipt', key: null, value: selectedDonation.receipt_issued ? '✓ Issued' : 'Pending', editable: false },
                        { label: '250% Deductible', key: null, value: `$${(selectedDonation.amount * 2.5).toLocaleString()}`, editable: false },
                        { label: 'Est. Tax Savings', key: null, value: `$${(selectedDonation.amount * 2.5 * 0.22).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, editable: false },
                      ].map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                          <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>{item.label}</span>
                          {editingManual && item.editable && selectedDonation.source === 'manual' ? (
                            item.key === 'created_at' ? (
                              <input type="date" style={{ ...s.formInput, padding: '4px 8px', fontSize: 12, width: 140, textAlign: 'right' }}
                                value={editForm.created_at || selectedDonation.created_at?.split('T')[0]}
                                onChange={e => setEditForm(f => ({ ...f, created_at: e.target.value }))} />
                            ) : item.key === 'amount' ? (
                              <input type="number" style={{ ...s.formInput, padding: '4px 8px', fontSize: 12, width: 100, textAlign: 'right' }}
                                value={editForm.amount ?? selectedDonation.amount}
                                onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} />
                            ) : (
                              <input type="text" style={{ ...s.formInput, padding: '4px 8px', fontSize: 12, width: 160, textAlign: 'right' }}
                                value={editForm[item.key] ?? (selectedDonation[item.key] || '')}
                                onChange={e => setEditForm(f => ({ ...f, [item.key]: e.target.value }))} />
                            )
                          ) : (
                            <span style={{ fontSize: 12, fontWeight: 600, color: C.forest }}>{item.value}</span>
                          )}
                        </div>
                      ))}

                      {!selectedDonation.donor_email?.trim() && !editingManual && selectedDonation.source === 'manual' && (
                        <div style={{ padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: C.muted }}>Add donor email to send a thank you</span>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input id="email-input" style={{ ...s.formInput, padding: '7px 10px', fontSize: 12 }} placeholder="donor@email.com" type="email" />
                            <button style={{ ...s.issueBtn, padding: '7px 12px', fontSize: 12, flexShrink: 0 }} onClick={() => {
                              const val = document.getElementById('email-input').value.trim()
                              if (!val) return
                              supabase.from('donations').update({ donor_email: val }).eq('id', selectedDonation.id)
                                .then(() => {
                                  setDonations(prev => prev.map(x => x.id === selectedDonation.id ? { ...x, donor_email: val } : x))
                                  setSelectedDonation(prev => ({ ...prev, donor_email: val }))
                                })
                            }}>Save</button>
                          </div>
                        </div>
                      )}

                      {/* NRIC */}
                      <div style={{ padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (!selectedDonation.donor_nric && !editingManual) ? 8 : 0 }}>
                          <span style={{ fontSize: 12, color: C.muted }}>NRIC / FIN</span>
                          {editingManual && selectedDonation.source === 'manual' ? (
                            <input type="text" style={{ ...s.formInput, padding: '4px 8px', fontSize: 12, width: 140, textAlign: 'right' }}
                              placeholder="e.g. S1234567A" maxLength={9}
                              value={editForm.donor_nric ?? (selectedDonation.donor_nric || '')}
                              onChange={e => setEditForm(f => ({ ...f, donor_nric: e.target.value.toUpperCase() }))} />
                          ) : selectedDonation.donor_nric ? (
                            <span style={{ fontSize: 12, fontWeight: 600, color: C.sage }}>✓ {selectedDonation.donor_nric}</span>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 700, color: C.warning }}>⚠️ Missing</span>
                          )}
                        </div>
                        {!selectedDonation.donor_nric && !editingManual && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input id="nric-input" style={{ ...s.formInput, padding: '7px 10px', fontSize: 12 }} placeholder="e.g. S1234567A" maxLength={9} />
                            <button style={{ ...s.issueBtn, padding: '7px 12px', fontSize: 12, flexShrink: 0 }} onClick={() => {
                              const val = document.getElementById('nric-input').value.trim().toUpperCase()
                              if (!val) return
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
                                })
                            }}>Save</button>
                          </div>
                        )}
                        {!selectedDonation.donor_nric && !editingManual && selectedDonation.donor_email?.trim() && (
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

                      {/* NOTES */}
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Notes</div>
                        {editingNoteId === selectedDonation.id ? (
                          <div>
                            <textarea style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.sage}`, borderRadius: 10, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: C.ivory, color: C.text, boxSizing: 'border-box', resize: 'vertical', minHeight: 80 }}
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
                          <div style={{ background: C.ivory, borderRadius: 10, padding: 12, border: `1px solid ${C.border}`, cursor: 'pointer', minHeight: 60 }}
                            onClick={() => { setEditingNoteId(selectedDonation.id); setNoteText(selectedDonation.notes || '') }}>
                            {selectedDonation.notes
                              ? <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{selectedDonation.notes}</div>
                              : <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>Click to add a note...</div>
                            }
                          </div>
                        )}
                      </div>

                      {/* ACTIONS */}
                      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {selectedDonation.receipt_issued && (
                          <button style={{ ...s.viewBtn, justifyContent: 'center' }} onClick={() => exportSingleReceiptPDF(selectedDonation)}>📄 Download Receipt PDF</button>
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

                            let cancelled = false
                            let countdown = 10
                            const donationSnapshot = { ...selectedDonation, receipt_issued: true }

                            const updateCountdown = () => {
                              setToast({
                                msg: `Receipt issued ✓ — Sending thank you email in ${countdown}s`,
                                type: 'success',
                                undoable: true,
                                onUndo: () => {
                                  cancelled = true
                                  setToast(null)
                                  showToast('Thank you email cancelled')
                                }
                              })
                            }

                            updateCountdown()
                            const interval = setInterval(() => {
                              countdown--
                              if (cancelled || countdown <= 0) {
                                clearInterval(interval)
                                return
                              }
                              updateCountdown()
                            }, 1000)

                            setTimeout(async () => {
                              if (cancelled) return
                              const { error: emailError } = await supabase.functions.invoke('send-thank-you', {
                                body: {
                                  donor_name: donationSnapshot.donor_name,
                                  donor_email: donationSnapshot.donor_email,
                                  charity_name: charityName,
                                  amount: donationSnapshot.amount,
                                  date: new Date(donationSnapshot.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })
                                }
                              })
                              if (!emailError) {
                                await supabase.from('donations').update({ thank_you_sent: true }).eq('id', donationSnapshot.id)
                                setDonations(prev => prev.map(x => x.id === donationSnapshot.id ? { ...x, thank_you_sent: true } : x))
                                setSelectedDonation(prev => ({ ...prev, thank_you_sent: true }))
                                showToast('Thank you email sent to ' + donationSnapshot.donor_email + ' 💌')
                              } else {
                                showToast('Receipt issued but email failed — send manually', 'error')
                              }
                            }, 10000)
                          }}>🧾 Issue Receipt</button>
                        )}
                        {selectedDonation.payment_status !== 'confirmed' && (
                          <button style={{ ...s.btnForest, justifyContent: 'center' }} onClick={async () => {
                            // Step 1 — Confirmation dialog
                            const confirmed = window.confirm(
                              `Confirm payment received from ${selectedDonation.donor_name} for $${selectedDonation.amount}?\n\nThis will:\n• Mark payment as confirmed\n• Issue a receipt\n• Send a thank you email in 10 seconds`
                            )
                            if (!confirmed) return

                            // Check current status from DB to prevent race condition
            const { data: freshData } = await supabase
            .from('donations')
            .select('payment_status, receipt_issued')
            .eq('id', selectedDonation.id)
            .single()

          if (freshData?.payment_status === 'confirmed') {
            showToast('This donation was already confirmed by someone else', 'error')
            setDonations(prev => prev.map(x => x.id === selectedDonation.id ? { ...x, payment_status: 'confirmed', receipt_issued: true } : x))
            setSelectedDonation(prev => ({ ...prev, payment_status: 'confirmed', receipt_issued: true }))
            return
          }

                            // Step 2 — Update DB
                            const { error } = await supabase.from('donations').update({ payment_status: 'confirmed', receipt_issued: true }).eq('id', selectedDonation.id)
                            if (error) { showToast('Error confirming payment', 'error'); return }
                            await supabase.from('audit_log').insert({
                              actor_type: 'charity',
                              actor_email: session.user.email,
                              action: 'payment_confirmed',
                              donation_id: selectedDonation.id,
                              details: { donor_name: selectedDonation.donor_name, amount: selectedDonation.amount },
                            })
                            setDonations(prev => prev.map(x => x.id === selectedDonation.id ? { ...x, payment_status: 'confirmed', receipt_issued: true } : x))
                            setSelectedDonation(prev => ({ ...prev, payment_status: 'confirmed', receipt_issued: true }))

                            if (!selectedDonation.donor_email) {
                              showToast('Payment confirmed and receipt issued')
                              return
                            }

                            // Step 3 — Show undo toast with 10s countdown
                            let cancelled = false
                            let countdown = 10
                            const donationSnapshot = { ...selectedDonation }

                            const updateCountdown = () => {
                              setToast({
                                msg: `Payment confirmed ✓ — Sending thank you email in ${countdown}s`,
                                type: 'success',
                                undoable: true,
                                onUndo: async () => {
                                  cancelled = true
                                  const { error: revertError } = await supabase.from('donations').update({ payment_status: 'pending', receipt_issued: false }).eq('id', donationSnapshot.id)
                                  if (revertError) { showToast('Error reverting — please refresh', 'error'); return }
                                  await supabase.from('audit_log').insert({
                                    actor_type: 'charity',
                                    actor_email: session.user.email,
                                    action: 'payment_confirmation_undone',
                                    donation_id: donationSnapshot.id,
                                  })
                                  setDonations(prev => prev.map(x => x.id === donationSnapshot.id ? { ...x, payment_status: 'pending', receipt_issued: false } : x))
                                  setSelectedDonation(prev => ({ ...prev, payment_status: 'pending', receipt_issued: false }))
                                  setToast(null)
                                  showToast('Action undone ✓')
                                }
                              })
                            }

                            updateCountdown()
                            const interval = setInterval(() => {
                              countdown--
                              if (cancelled || countdown <= 0) {
                                clearInterval(interval)
                                return
                              }
                              updateCountdown()
                            }, 1000)

                            // Step 4 — Send email after 10s delay
                            setTimeout(async () => {
                              if (cancelled) return
                              const { error: emailError } = await supabase.functions.invoke('send-thank-you', {
                                body: {
                                  donor_name: donationSnapshot.donor_name,
                                  donor_email: donationSnapshot.donor_email,
                                  charity_name: charityName,
                                  amount: donationSnapshot.amount,
                                  date: new Date(donationSnapshot.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })
                                }
                              })
                              if (!emailError) {
                                await supabase.from('donations').update({ thank_you_sent: true }).eq('id', donationSnapshot.id)
                                setDonations(prev => prev.map(x => x.id === donationSnapshot.id ? { ...x, thank_you_sent: true } : x))
                                setSelectedDonation(prev => ({ ...prev, thank_you_sent: true }))
                                showToast('Thank you email sent to ' + donationSnapshot.donor_email + ' 💌')
                              } else {
                                showToast('Receipt issued but email failed — send manually', 'error')
                              }
                            }, 10000)

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
                              }
                              if (!updates.donor_name?.trim()) { showToast('Donor name cannot be empty', 'error'); return }
                              if (!updates.amount || updates.amount <= 0) { showToast('Amount must be greater than zero', 'error'); return }
                              if (new Date(updates.created_at) > new Date()) { showToast('Date cannot be in the future', 'error'); return }
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
                          <button style={{ ...s.btnGold, justifyContent: 'center', opacity: selectedDonation.thank_you_sent ? 0.7 : 1 }} onClick={async () => {
                            if (selectedDonation.thank_you_sent) {
                              if (!window.confirm('A thank you email was already sent for this donation. Send again?')) return
                            }
                            const { error } = await supabase.functions.invoke('send-thank-you', {
                              body: {
                                donor_name: selectedDonation.donor_name,
                                donor_email: selectedDonation.donor_email,
                                charity_name: charityName,
                                amount: selectedDonation.amount,
                                date: new Date(selectedDonation.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })
                              }
                            })
                            if (error) { showToast('Failed to send email', 'error'); return }
                            await supabase.from('donations').update({ thank_you_sent: true }).eq('id', selectedDonation.id)
                            setDonations(prev => prev.map(x => x.id === selectedDonation.id ? { ...x, thank_you_sent: true } : x))
                            setSelectedDonation(prev => ({ ...prev, thank_you_sent: true }))
                            showToast(`Email sent to ${selectedDonation.donor_email}`)
                          }}>💌 Send Thank You Email</button>
                        )}
                        {selectedDonation.source === 'manual' && !editingManual && (
                          <button style={deletingId === selectedDonation.id ? s.issuingBtn : { ...s.viewBtn, color: C.red, borderColor: C.red }} disabled={deletingId === selectedDonation.id} onClick={() => deleteDonation(selectedDonation.id)}>{deletingId === selectedDonation.id ? '⏳ Deleting...' : '🗑️ Delete Entry'}</button>
                        )}
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
              <select style={{ ...s.filterSelect, padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700 }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                {donations.length === 0
  ? <option>{new Date().getFullYear()}</option>
  : [...new Set(donations.map(d => new Date(d.created_at).getFullYear()))].sort((a,b) => b-a).map(y => <option key={y}>{y}</option>)
}
              </select>
            </div>

            <div style={isMobile ? s.statsGridMobile : isTablet ? s.statsGridTablet : s.statsGrid}>
              <div style={{ ...s.statCard, background: C.forest, borderColor: C.forest }}>
                <div style={{ ...s.statLabel, color: 'rgba(255,255,255,0.7)' }}>Total Raised</div>
                <div style={{ ...s.statValue, color: 'white' }}>${totalThisYear.toLocaleString()}</div>
                <div style={{ ...s.statNote, color: 'rgba(255,255,255,0.6)' }}>Year to date</div>
              </div>
              <div style={s.statCard}>
                <div style={s.statLabel}>Unique Donors</div>
                <div style={s.statValue}>{uniqueDonors.length}</div>
                <div style={s.statNote}>All time</div>
              </div>
              <div style={s.statCard}>
                <div style={s.statLabel}>Avg. Donation</div>
                <div style={s.statValue}>${avgDonation.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                <div style={s.statNote}>Per transaction</div>
              </div>
              <div style={s.statCard}>
                <div style={s.statLabel}>Total Transactions</div>
                <div style={s.statValue}>{donations.length}</div>
                <div style={s.statNote}>All time</div>
              </div>
            </div>

            <div style={{ ...s.card, marginBottom: 24 }}>
              <div style={s.cardTitle}>📊 Monthly Donations — {filterYear}</div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={(() => {
                  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                  return months.map((month, i) => ({
                    month,
                    amount: donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear) && new Date(d.created_at).getMonth() === i).reduce((sum, d) => sum + d.amount, 0),
                    count: donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear) && new Date(d.created_at).getMonth() === i).length,
                  }))
                })()} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: C.muted }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: C.muted }} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toLocaleString()}`} />
                  <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(value) => [`$${value.toLocaleString()}`, 'Donations']} />
                  <Bar dataKey="amount" fill={C.sage} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={isMobile ? s.twoColMobile : s.twoCol}>
              <div style={s.card}>
                <div style={s.cardTitle}>📈 Number of Donations per Month</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={(() => {
                    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                    return months.map((month, i) => ({ month, count: donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear) && new Date(d.created_at).getMonth() === i).length }))
                  })()} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} />
                    <Line type="monotone" dataKey="count" stroke={C.gold} strokeWidth={2.5} dot={{ fill: C.gold, r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={s.card}>
                <div style={s.cardTitle}>🏆 Top Donors</div>
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

            <div style={{ ...s.card, marginBottom: 24 }}>
              <div style={s.cardTitle}>💰 Donation Size Breakdown</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 10 : 12 }}>
                {(() => {
                  const yearScoped = filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).getFullYear().toString() === filterYear)
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
                        strokeDasharray={`${(() => { const yd = filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).getFullYear().toString() === filterYear); return yd.length ? (yd.filter(d => d.receipt_issued).length / yd.length) * 100 : 0 })()} 100`} strokeLinecap="round" />
                    </svg>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 16, fontWeight: 800, color: C.forest }}>
                      {(() => { const yd = filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).getFullYear().toString() === filterYear); return yd.length ? Math.round((yd.filter(d => d.receipt_issued).length / yd.length) * 100) : 0 })()}%
                    </div>
                  </div>
                  <div>
                    {(() => {
                      const yd = filterYear === 'All' ? donations : donations.filter(d => new Date(d.created_at).getFullYear().toString() === filterYear)
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
                {pendingCount > 0 && <button style={s.btnForest} onClick={issueAllReceipts}>🧾 Issue All Pending Receipts</button>}
              </div>
              <div style={s.card}>
                <div style={s.cardTitle}>📅 Recent Activity</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {donations.slice(0, 5).map((d, i) => (
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
                  {donations.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: 20 }}>No donations yet</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── IRAS ── */}
        {activeTab === 'iras' && (
          <div style={s.content}>
            <div style={s.pageHeader}>
              <div>
                <div style={s.pageTitle}>IRAS Export</div>
                <div style={s.pageSub}>Year of Assessment {filterYear} · Due 31 January {parseInt(filterYear) + 1}</div>
              </div>
              <div style={{ ...s.filterSelect, padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700, background: C.forest, color: 'white', border: 'none', cursor: 'pointer' }}>
                <select style={{ background: 'transparent', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', outline: 'none' }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                  {[...new Set(donations.map(d => new Date(d.created_at).getFullYear()))].sort((a,b) => b-a).map(y => <option key={y} style={{ background: C.forest }}>{y}</option>)}
                </select>
              </div>
            </div>

            <div style={{ ...s.deadlineBanner, marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 24 }}>🏛️</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'white' }}>IRAS Submission — Year of Assessment {filterYear}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>Auto-generated from Giving Tree donor records · Ready to export</div>
                </div>
              </div>
              <div style={s.irasStatus}>✓ Ready</div>
            </div>

            <div style={isMobile ? s.irasInfoGridMobile : isTablet ? s.irasInfoGridTablet : s.irasInfoGrid}>
              {(() => {
                const yearDons = donations.filter(d => new Date(d.created_at).getFullYear() === parseInt(filterYear))
                const missingNric = yearDons.filter(d => !d.donor_nric).length
                const cards = [
                  { label: 'Total Donations', value: `$${totalThisYear.toLocaleString()}`, note: `${yearDons.length} transactions`, warn: false },
                  { label: '250% Deductible', value: `$${(totalThisYear * 2.5).toLocaleString()}`, note: 'Total tax deductible amount', warn: false },
                  { label: 'Missing NRIC', value: missingNric, note: missingNric > 0 ? 'Click to see affected donors' : 'All donors have NRIC ✓', warn: missingNric > 0, action: missingNric > 0 },
                  { label: 'Receipts Pending', value: pendingCount, note: pendingCount > 0 ? 'Action needed' : 'All issued ✓', warn: pendingCount > 0 },
                ]
                return cards.map((item, i) => (
                  <div key={i} style={{ ...s.irasInfoItem, background: item.warn ? C.warningBg : C.ivory, borderColor: item.warn ? C.warningBorder : C.border, cursor: item.action ? 'pointer' : 'default' }}
                    onClick={() => item.action && setActiveTab('donations')}>
                    <div style={{ ...s.irasInfoLabel, color: item.warn ? C.warning : C.muted }}>{item.label}</div>
                    <div style={{ ...s.irasInfoValue, color: item.warn ? C.warning : C.forest }}>{item.value}</div>
                    <div style={{ ...s.irasInfoNote, color: item.warn ? C.warning : C.muted }}>{item.note}</div>
                    {item.warn && <div style={{ fontSize: 10, fontWeight: 700, color: C.warning, marginTop: 6 }}>⚠️ {item.action ? 'Click to view' : 'Action needed'}</div>}
                  </div>
                ))
              })()}
            </div>

            {pendingCount > 0 && (
              <div style={{ background: C.warningBg, border: `1.5px solid ${C.warningBorder}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: C.warning, lineHeight: 1.5 }}>
                ⚠️ {pendingCount} donation{pendingCount > 1 ? 's' : ''} still pending receipt. Issue all receipts before submitting to IRAS.
              </div>
            )}
            {donations.filter(d => !d.donor_nric && d.donor_email?.trim()).length > 0 && (
              <div style={{ background: C.warningBg, border: `1.5px solid ${C.warningBorder}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: C.warning, lineHeight: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span>🪪 {donations.filter(d => !d.donor_nric && d.donor_email?.trim()).length} donations missing NRIC have a donor email on file.</span>
                <button style={{ ...s.bannerBtn, background: C.forest, color: 'white', flexShrink: 0 }} onClick={requestAllMissingNric}>Request All NRICs</button>
              </div>
            )}

            <div style={{ background: C.successBg, border: `1.5px solid ${C.bucket1}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: C.forest, lineHeight: 1.6 }}>
              📋 <strong>How to submit to IRAS:</strong> Download the file below, then log in to <strong>myTax Portal</strong> (mytax.iras.gov.sg) using Corppass → Manage Donation Submissions → Upload file. Deadline: 31 January {parseInt(filterYear) + 1}.
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
              <button style={{ ...s.btnGold, opacity: filterYear === 'All' ? 0.5 : 1, cursor: filterYear === 'All' ? 'not-allowed' : 'pointer' }} onClick={() => { if (filterYear === 'All') return; exportIRASExcel() }}>⬇️ Download IRAS File (.xlsx)</button>
              <button style={s.btnForest} onClick={exportPDF}>📄 Download PDF Report</button>
              <button style={{ ...s.btnForest, background: C.teal }} onClick={() => { if (filterYear === 'All') { showToast('Select a specific year first', 'error'); return }; exportYearEndSummary() }}>🎉 Year-End Summary for Board</button>
              {pendingCount > 0 && <button style={{ ...s.btnForest, background: C.sage }} onClick={issueAllReceipts}>🧾 Issue All Receipts First</button>}
            </div>

            <div style={s.tableCard}>
              <div style={s.tableHeader}>
                <div style={s.tableTitle}>Donor Submission Data</div>
                <div style={s.tableCount}>{irasYearDonorList.length} donors in {filterYear}</div>
              </div>
              {isMobile ? (
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
                          {nric ? <span style={s.badgeIssued}>✓ {nric}</span> : <span style={s.badgePending}>⚠️ Missing NRIC</span>}
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
                    <tr>{(isTablet ? ['Donor', 'Total Donated', '250% Deductible', 'NRIC'] : ['Donor', 'Total Donated', 'Transactions', '250% Deductible', 'Est. Tax Savings', 'NRIC']).map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {irasYearDonorList.map((d, i) => (
                      <tr key={i} style={s.tr}>
                        <td style={s.td}><div style={s.donorCell}><div style={{ ...s.donorAvatar, background: [C.sage, C.teal, C.gold, C.forest, C.red][i % 5] }}>{d.name?.charAt(0)}</div><div style={s.donorName}>{d.name}</div></div></td>
                        <td style={s.td}><span style={s.amountText}>${d.total.toLocaleString()}</span></td>
                        {!isTablet && <td style={s.td}><span style={s.dateText}>{d.count}</span></td>}
                        <td style={s.td}><span style={{ ...s.amountText, color: C.forest }}>${(d.total * 2.5).toLocaleString()}</span></td>
                        {!isTablet && <td style={s.td}><span style={{ ...s.amountText, color: C.sage }}>${(d.total * 2.5 * 0.22).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></td>}
                        <td style={s.td}>
                          {(() => {
                            const nric = d.donations.find(x => x.donor_nric)?.donor_nric
                            return nric ? <span style={s.badgeIssued}>✓ {nric}</span> : <span style={s.badgePending}>⚠️ Missing</span>
                          })()}
                        </td>
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
                <option value="nric_added">NRIC added by charity</option>
                <option value="nric_synced_by_donor">NRIC updated by donor</option>
                <option value="bulk_nric_requested">Bulk NRIC requests</option>
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
                                ? `${entry.details.donation_count} receipt${entry.details.donation_count > 1 ? 's' : ''} · ${entry.details.year}`
                                : [entry.details.donor_name || entry.details.charity_name, entry.details.amount != null ? `$${entry.details.amount}` : null, entry.details.notes ? `📝 "${entry.details.notes}"` : null].filter(Boolean).join(' · ')}
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
                  <button style={s.btnGold} onClick={() => setShowCauseForm(true)}>+ Submit a Campaign</button>
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
                      <button style={s.btnForest} onClick={submitCause} disabled={savingCause}>{savingCause ? 'Submitting...' : '✓ Submit for Approval'}</button>
                      <button style={s.viewBtn} onClick={() => { setShowCauseForm(false); setCauseError('') }}>Cancel</button>
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

            <div style={s.tableCard}>
              <div style={s.tableHeader}>
                <div style={s.tableTitle}>Your Submissions</div>
                <div style={s.tableCount}>{myCauses.length} total</div>
              </div>
              {myCauses.length === 0 ? <div style={s.empty}>No campaigns or sponsored requests submitted yet.</div> : (
                <div>
                  {myCauses.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: `1px solid ${C.ivoryDark}` }}>
                      <div style={{ fontSize: 18 }}>{c.type === 'sponsored' ? '⭐' : '🎯'}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.forest }}>{c.title}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{c.type === 'sponsored' ? 'Sponsored banner request' : 'Campaign'} · Submitted {new Date(c.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      </div>
                      <span style={
                        c.status === 'approved' ? s.badgeIssued :
                        c.status === 'rejected' ? { ...s.badgePending, color: C.red, background: '#FBE9E7' } :
                        s.badgePending
                      }>
                        {c.status === 'approved' ? '✓ Approved' : c.status === 'rejected' ? '✕ Rejected' : '⏳ Pending Review'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
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
              
            </div>
          </div>
        )}

      </div>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 32, right: 32,
          background: toast.type === 'success' ? C.forest : C.red,
          color: 'white', padding: '14px 20px', borderRadius: 14,
          fontSize: 13, fontWeight: 600, zIndex: 999,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: 12,
          maxWidth: 400,
        }}>
          <span>{toast.type === 'success' ? '✓' : '✕'}</span>
          <span style={{ flex: 1 }}>{toast.msg}</span>
          {toast.undoable && (
            <span
              onClick={toast.onUndo}
              style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}
            >Undo</span>
          )}
          <span
            onClick={() => setToast(null)}
            style={{ cursor: 'pointer', opacity: 0.7, fontSize: 16, lineHeight: 1 }}
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
