import { C } from '../theme'
import { s } from '../styles'
import { InfoTip } from '../components/ui/InfoTip'
import { EmptyState } from '../components/ui/EmptyState'
import { RecurringGiftModal } from '../components/modals/RecurringGiftModal'

export function RecurringPage({
  isMobile, recurringGifts, myCauses, fyOf,
  showRecurringForm, setShowRecurringForm, savingRecurring,
  editingRecurringGift, setEditingRecurringGift,
  saveRecurringGift, updateRecurringGift, cancelRecurringGift,
  recurringSearchTerm, setRecurringSearchTerm, showRecurringFilters, setShowRecurringFilters,
  recurringUrgencyFilter, setRecurringUrgencyFilter, recurringAmountFilter, setRecurringAmountFilter,
  recurringTypeFilter, setRecurringTypeFilter, recurringYearFilter, setRecurringYearFilter,
  recurringProgrammeFilter, setRecurringProgrammeFilter, recurringAuthFilter, setRecurringAuthFilter,
  recurringSortBy, setRecurringSortBy, exportRecurringExcel, recurringGivenTotals,
  setSelectedDonor, setActiveTab, findDonorRecord,
  recurringSkipHistory, setConfirmModal, undoSkipCycle,
  recurringFailedDeductionHistory, undoFailedDeduction, recurringReminderHistory,
  donationsByRecurringGift, expandedRecurringId, setExpandedRecurringId,
  editingRecurringDonationId, setEditingRecurringDonationId, editingRecurringAmount, setEditingRecurringAmount,
  editingRecurringNote, setEditingRecurringNote, saveRecurringDonationAmount, savingRecurringAmount,
  startEditingRecurringAmount, deleteDonation, markRecurringReceived,
  setRecurringReminderCandidate, setShowRecurringReminderModal, skipRecurringCycle,
  recurringMoreMenuId, setRecurringMoreMenuId, pauseRecurringGift, recordFailedDeduction,
  reactivateRecurringGift, restoreCancelledRecurringGift,
  showPausedRecurring, setShowPausedRecurring, showCancelledRecurring, setShowCancelledRecurring,
}) {
  return (
    <div style={s.content}>
      <div style={s.pageHeader}>
        <div>
          <div style={s.pageTitle}>Recurring Giving</div>
          <div style={s.pageSub}>{recurringGifts.filter(g => g.status === 'active').length} active · ${recurringGifts.filter(g => g.status === 'active').reduce((s, g) => s + g.amount, 0).toLocaleString()} expected/cycle</div>
        </div>
        <button style={s.btnGold} onClick={() => setShowRecurringForm(true)}>+ Add Recurring Gift</button>
      </div>

      {showRecurringForm && (
        <RecurringGiftModal
          isMobile={isMobile}
          onClose={() => setShowRecurringForm(false)}
          onSave={saveRecurringGift}
          causes={myCauses.filter(c => c.type === 'campaign')}
          saving={savingRecurring}
        />
      )}
      {editingRecurringGift && (
        <RecurringGiftModal
          isMobile={isMobile}
          gift={editingRecurringGift}
          onClose={() => setEditingRecurringGift(null)}
          onSave={(form) => updateRecurringGift(editingRecurringGift.id, form)}
          causes={myCauses.filter(c => c.type === 'campaign')}
          saving={savingRecurring}
          onCancelGift={cancelRecurringGift}
        />
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
        <input style={{ ...s.searchBox, flex: 'none', width: isMobile ? '100%' : 380 }} placeholder="🔍 Search by donor name, email, phone, reference, bank, or notes..." value={recurringSearchTerm} onChange={e => setRecurringSearchTerm(e.target.value)} />
        {isMobile && (
          <button style={{ ...s.viewBtn, width: '100%', justifyContent: 'center' }} onClick={() => setShowRecurringFilters(v => !v)}>{showRecurringFilters ? '▾ Hide Filters' : '▸ Filters & Sort'}</button>
        )}
        {(!isMobile || showRecurringFilters) && (<>
        <select style={{ ...s.formInput, width: isMobile ? '100%' : 160 }} value={recurringUrgencyFilter} onChange={e => setRecurringUrgencyFilter(e.target.value)}>
          <option value="All">All urgency</option>
          <option value="Late">Late — single miss</option>
          <option value="Escalated">Escalated (2+ missed)</option>
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
          {[...new Set(recurringGifts.filter(g => g.start_date).map(g => fyOf(g.start_date)))].sort((a, b) => b - a).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select style={{ ...s.formInput, width: isMobile ? '100%' : 190 }} value={recurringProgrammeFilter} onChange={e => setRecurringProgrammeFilter(e.target.value)}>
          <option value="All">All programmes</option>
          <option value="__none__">None — unrestricted</option>
          {myCauses.filter(c => c.type === 'campaign').map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <select style={{ ...s.formInput, width: isMobile ? '100%' : 170 }} value={recurringAuthFilter} onChange={e => setRecurringAuthFilter(e.target.value)}>
          <option value="All">All authorization</option>
          <option value="pending">Pending bank approval</option>
          <option value="active">Authorized</option>
          <option value="terminated">Terminated by bank</option>
        </select>
        <select style={{ ...s.formInput, width: isMobile ? '100%' : 190 }} value={recurringSortBy} onChange={e => setRecurringSortBy(e.target.value)}>
          <option value="next_asc">Next expected soonest</option>
          <option value="next_desc">Next expected latest</option>
          <option value="amount_desc">Amount high–low</option>
          <option value="amount_asc">Amount low–high</option>
          <option value="start_desc">Start date newest</option>
          <option value="start_asc">Start date oldest</option>
          <option value="donor_az">Donor A–Z</option>
          <option value="reliability_asc">Reliability lowest first</option>
        </select>
        {(recurringSearchTerm !== '' || recurringUrgencyFilter !== 'All' || recurringAmountFilter !== 'All' || recurringTypeFilter !== 'All' || recurringYearFilter !== 'All' || recurringProgrammeFilter !== 'All' || recurringAuthFilter !== 'All') && (
          <button style={{ ...s.viewBtn, whiteSpace: 'nowrap' }} onClick={() => { setRecurringSearchTerm(''); setRecurringUrgencyFilter('All'); setRecurringAmountFilter('All'); setRecurringTypeFilter('All'); setRecurringYearFilter('All'); setRecurringProgrammeFilter('All'); setRecurringAuthFilter('All') }}>✕ Clear Filters</button>
        )}
        <button style={isMobile ? { ...s.exportSmallBtn, width: '100%' } : s.exportSmallBtn} onClick={() => {
          const q = recurringSearchTerm.toLowerCase().trim()
          const today = new Date(); today.setHours(0,0,0,0)
          const filtered = recurringGifts.filter(g => {
            const matchesSearch = !q || [g.donor_name, g.donor_email, g.donor_phone, g.notes, g.giro_reference, g.reference, g.bank_name].some(f => f?.toLowerCase().includes(q))
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
                const gapDaysF = g.frequency === 'weekly' ? 7 : g.frequency === 'quarterly' ? 91 : g.frequency === 'annually' ? 365 : 30
                const missedCyclesF = -days > 7 ? Math.floor(-days / gapDaysF) + 1 : 0
                if (recurringUrgencyFilter === 'Late') matchesUrgency = days < -7 && missedCyclesF < 2
                else if (recurringUrgencyFilter === 'Escalated') matchesUrgency = missedCyclesF >= 2
                else if (recurringUrgencyFilter === 'Due Soon') matchesUrgency = days >= -7 && days <= 7
                else if (recurringUrgencyFilter === 'Healthy') matchesUrgency = days > 7
              }
            }
            const matchesYear = recurringYearFilter === 'All' || (g.start_date && fyOf(g.start_date).toString() === recurringYearFilter)
            const matchesProgramme = recurringProgrammeFilter === 'All' || (recurringProgrammeFilter === '__none__' ? !g.cause_id : g.cause_id === recurringProgrammeFilter)
            const matchesAuth = recurringAuthFilter === 'All' || g.authorization_status === recurringAuthFilter
            return matchesSearch && matchesType && matchesAmt && matchesUrgency && matchesYear && matchesProgramme && matchesAuth
          })
          exportRecurringExcel(filtered)
        }}>⬇️ Export to Excel</button>
        </>)}
      </div>

      {(() => {
        const today = new Date(); today.setHours(0,0,0,0)

        const q = recurringSearchTerm.toLowerCase().trim()
        const matchesSearch = (g) => {
          if (!q) return true
          const fields = [g.donor_name, g.donor_email, g.donor_phone, g.notes, g.giro_reference, g.reference, g.bank_name]
          return fields.some(f => f?.toLowerCase().includes(q))
        }
        const matchesUrgency = (g) => {
          if (recurringUrgencyFilter === 'All') return true
          if (g.status !== 'active') return false
          const days = Math.ceil((new Date(g.next_expected_date) - today) / (1000 * 60 * 60 * 24))
          const gapDaysF = g.frequency === 'weekly' ? 7 : g.frequency === 'quarterly' ? 91 : g.frequency === 'annually' ? 365 : 30
          const missedCyclesF = -days > 7 ? Math.floor(-days / gapDaysF) + 1 : 0
          if (recurringUrgencyFilter === 'Late') return days < -7 && missedCyclesF < 2
          if (recurringUrgencyFilter === 'Escalated') return missedCyclesF >= 2
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
        const matchesYear = (g) => recurringYearFilter === 'All' || (g.start_date && fyOf(g.start_date).toString() === recurringYearFilter)
        const matchesProgramme = (g) => recurringProgrammeFilter === 'All' || (recurringProgrammeFilter === '__none__' ? !g.cause_id : g.cause_id === recurringProgrammeFilter)
        const matchesAuth = (g) => recurringAuthFilter === 'All' || g.authorization_status === recurringAuthFilter

        const reliabilityPctOf = (g) => {
          const gapDays = { weekly: 7, monthly: 30, quarterly: 91, annually: 365 }[g.frequency] || 30
          const cyclesElapsed = g.start_date ? Math.max(1, Math.floor((today - new Date(g.start_date)) / (gapDays * 24 * 60 * 60 * 1000)) + 1) : 1
          const receivedCount = recurringGivenTotals[g.id]?.count || 0
          return Math.min(100, Math.round((receivedCount / cyclesElapsed) * 100))
        }

        const filtered = recurringGifts.filter(g => matchesSearch(g) && matchesUrgency(g) && matchesAmount(g) && matchesType(g) && matchesYear(g) && matchesProgramme(g) && matchesAuth(g)).sort((a, b) => {
          if (recurringSortBy === 'next_asc') return new Date(a.next_expected_date) - new Date(b.next_expected_date)
          if (recurringSortBy === 'next_desc') return new Date(b.next_expected_date) - new Date(a.next_expected_date)
          if (recurringSortBy === 'amount_desc') return Number(b.amount) - Number(a.amount)
          if (recurringSortBy === 'amount_asc') return Number(a.amount) - Number(b.amount)
          if (recurringSortBy === 'start_desc') return new Date(b.start_date || 0) - new Date(a.start_date || 0)
          if (recurringSortBy === 'start_asc') return new Date(a.start_date || 0) - new Date(b.start_date || 0)
          if (recurringSortBy === 'donor_az') return a.donor_name.localeCompare(b.donor_name)
          if (recurringSortBy === 'reliability_asc') return reliabilityPctOf(a) - reliabilityPctOf(b)
          return 0
        })

        const renderRecurringCard = (g) => {
          const nextDate = new Date(g.next_expected_date)
          const daysUntil = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24))
          const isLate = daysUntil < -7 && g.status === 'active'
          const isDueSoon = daysUntil >= -7 && daysUntil <= 7 && g.status === 'active'
          const frequencyLabel = { weekly: 'week', monthly: 'month', quarterly: 'quarter', annually: 'year' }[g.frequency] || g.frequency
          const typeLabel = g.type === 'giro' ? 'GIRO' : g.type === 'habitual_paynow' ? 'Habitual PayNow' : g.type === 'standing_order' ? 'Standing Order' : 'Other'
          const needsBankInfo = g.type === 'giro' || g.type === 'standing_order'
          const linkedCause = g.cause_id ? myCauses.find(c => c.id === g.cause_id) : null
          const authLabel = { pending: 'Pending bank approval', active: 'Authorized', terminated: 'Terminated by bank' }[g.authorization_status] || null
          const authColor = g.authorization_status === 'terminated' ? C.red : g.authorization_status === 'pending' ? C.gold : C.sage
          const statusMap = {
            active: { bg: C.sage, color: C.white, label: 'Active' },
            paused: { bg: C.gold, color: C.white, label: 'Paused' },
            cancelled: { bg: C.muted, color: C.white, label: 'Cancelled' },
          }
          const statusInfo = statusMap[g.status] || { bg: C.ivory, color: C.muted, label: g.status }
          const endLabel = g.end_date ? new Date(g.end_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }) : (g.status === 'cancelled' && g.cancelled_at ? new Date(g.cancelled_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Ongoing')
          const annualMultiplier = { weekly: 52, monthly: 12, quarterly: 4, annually: 1 }[g.frequency] || 12
          const annualizedValue = Number(g.amount) * annualMultiplier
          const gapDays = { weekly: 7, monthly: 30, quarterly: 91, annually: 365 }[g.frequency] || 30
          const cyclesElapsed = g.start_date ? Math.max(1, Math.floor((today - new Date(g.start_date)) / (gapDays * 24 * 60 * 60 * 1000)) + 1) : 1
          const receivedCount = recurringGivenTotals[g.id]?.count || 0
          const reliabilityPct = Math.min(100, Math.round((receivedCount / cyclesElapsed) * 100))
          const reliabilityColor = reliabilityPct >= 80 ? C.sage : reliabilityPct >= 50 ? C.gold : C.red

          const rHasActivity = recurringGivenTotals[g.id] || g.status !== 'cancelled' || (recurringSkipHistory[g.id] || []).length > 0 || (recurringFailedDeductionHistory[g.id] || []).length > 0 || (g.status === 'active' && (recurringReminderHistory[g.id] || []).length > 0) || (donationsByRecurringGift[g.id] || []).length > 0
          return (
            <div key={g.id} style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

              {/* Header: who */}
              <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${C.ivoryDark}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: C.forest, cursor: 'pointer' }} onClick={() => { setSelectedDonor(findDonorRecord(g.donor_email, g.donor_name)); setActiveTab('donors') }}>{g.donor_name}</div>
                    {(g.donor_email || g.donor_phone) && (
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 3 }}>
                        {g.donor_email && <span style={{ fontSize: 12, color: C.muted, display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ fontSize: 11, opacity: 0.7 }}>✉️</span>{g.donor_email}</span>}
                        {g.donor_phone && <span style={{ fontSize: 12, color: C.muted, display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ fontSize: 11, opacity: 0.7 }}>📞</span>{g.donor_phone}</span>}
                      </div>
                    )}
                    {(g.giro_reference || g.reference) && (
                      <div style={{ fontSize: 11, color: C.muted, fontFamily: C.fontMono, marginTop: 2 }}>{[g.giro_reference && `Bank ref: ${g.giro_reference}`, g.reference].filter(Boolean).join(' · ')}</div>
                    )}
                    <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {linkedCause ? (
                        <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4, background: C.teal + '1A', color: C.teal, display: 'inline-flex', alignItems: 'center', gap: 4 }}>🎯 {linkedCause.title} · Restricted</span>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4, background: C.ivory, border: `1px solid ${C.border}`, color: C.muted }}>General / unrestricted</span>
                      )}
                      {needsBankInfo && authLabel && g.authorization_status !== 'active' && (
                        <span style={{ fontSize: 11, fontWeight: 500, color: authColor, background: g.authorization_status === 'terminated' ? '#FBEEE9' : C.warningBg, padding: '3px 8px', borderRadius: 4 }}>{authLabel}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 20, background: C.ivory, border: `1px solid ${C.border}`, color: C.forest }}>{typeLabel}</span>
                    {isLate && <span style={{ fontSize: 12, fontWeight: 500, color: C.white, background: C.red, padding: '4px 10px', borderRadius: 20 }}>⚠ {Math.abs(daysUntil)}d late</span>}
                    {isDueSoon && !isLate && daysUntil <= 0 && <span style={{ fontSize: 12, fontWeight: 500, color: C.white, background: C.red, padding: '4px 10px', borderRadius: 20 }}>Due today</span>}
                    {isDueSoon && daysUntil > 0 && <span style={{ fontSize: 12, fontWeight: 500, color: C.white, background: C.gold, padding: '4px 10px', borderRadius: 20 }}>Due in {daysUntil}d</span>}
                    <span style={{ fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 20, background: statusInfo.bg, color: statusInfo.color }}>{statusInfo.label}</span>
                  </div>
                </div>
              </div>

              {/* Amount + timeline */}
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.ivoryDark}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6, marginBottom: 2 }}>
                  <span>
                    <span style={{ fontFamily: C.fontVoice, fontSize: 19, fontWeight: 500, color: C.forest }}>${Number(g.amount).toLocaleString()}</span>
                    <span style={{ fontSize: 12.5, color: C.muted }}> / {frequencyLabel}</span>
                  </span>
                  <span style={{ fontSize: 11.5, color: C.muted }}>~${annualizedValue.toLocaleString()} / year</span>
                </div>
                {needsBankInfo && g.bank_name && (
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Bank: {g.bank_name}</div>
                )}
                {g.type === 'other' && g.type_detail && (
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{g.type_detail}</div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: C.muted, marginBottom: 2 }}>Last received</div>
                    <div style={{ fontFamily: C.fontMono, fontSize: 13, fontWeight: 500, color: C.forest }}>{g.last_received_date ? new Date(g.last_received_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: C.muted, marginBottom: 2 }}>Next expected</div>
                    <div style={{ fontFamily: C.fontMono, fontSize: 13, fontWeight: 500, color: isLate ? C.red : C.forest }}>{nextDate.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: C.muted, marginBottom: 2 }}>Start</div>
                    <div style={{ fontFamily: C.fontMono, fontSize: 13, fontWeight: 500, color: C.forest }}>{g.start_date ? new Date(g.start_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: C.muted, marginBottom: 2 }}>End</div>
                    <div style={{ fontFamily: C.fontMono, fontSize: 13, fontWeight: 500, color: g.end_date && new Date(g.end_date) < today ? C.red : C.muted }}>{endLabel}</div>
                  </div>
                </div>
                {g.notes && <div style={{ fontSize: 12.5, color: C.text, marginTop: 8 }}><span style={{ color: C.muted }}>Notes:</span> {g.notes}</div>}
                {g.status === 'paused' && (g.pause_reason || g.pause_resume_date) && (() => {
                  const resumeDatePassed = g.pause_resume_date && new Date(g.pause_resume_date) < today
                  return (
                  <div style={{ fontSize: 11.5, color: resumeDatePassed ? C.red : C.warning, background: resumeDatePassed ? '#FBEEE9' : C.warningBg, borderRadius: 4, padding: '6px 10px', marginTop: 8 }}>
                    {g.pause_reason && <div>Paused: {g.pause_reason}</div>}
                    {g.pause_resume_date && <div>{resumeDatePassed ? '⚠ Was expected to resume' : 'Expected to resume'} {new Date(g.pause_resume_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })} — remember to reactivate it</div>}
                  </div>
                  )
                })()}
              </div>

              {/* Activity */}
              {rHasActivity && (
                <div style={{ padding: '12px 16px', background: C.ivory, borderBottom: `1px solid ${C.ivoryDark}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {recurringGivenTotals[g.id] && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12.5, color: C.text, display: 'flex', alignItems: 'center', gap: 4 }}>
                        ${recurringGivenTotals[g.id].total.toLocaleString()} total · {recurringGivenTotals[g.id].count} payment{recurringGivenTotals[g.id].count !== 1 ? 's' : ''}
                        <InfoTip text="Sum of every payment recorded via Mark Received for this recurring gift, not an estimate." />
                      </span>
                    </div>
                  )}
                  {g.status !== 'cancelled' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12.5, color: reliabilityColor, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {reliabilityPct}% reliability · {receivedCount} of ~{cyclesElapsed} expected
                        <InfoTip text="Payments received so far divided by roughly how many cycles should have happened since the start date. An estimate, not exact — skipped cycles still count against it." />
                      </span>
                    </div>
                  )}
                  {(recurringSkipHistory[g.id] || []).length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12.5, color: C.gold, fontWeight: 500 }}>⏭ {recurringSkipHistory[g.id].length} cycle{recurringSkipHistory[g.id].length !== 1 ? 's' : ''} skipped</span>
                      {g.status !== 'cancelled' && (
                        <span style={{ fontSize: 11, color: C.gold, textDecoration: 'underline', cursor: 'pointer' }} onClick={() => setConfirmModal({
                          title: 'Undo last skip?',
                          description: `This will restore ${g.donor_name}'s next expected date to the skipped cycle date.`,
                          confirmLabel: 'Undo',
                          onConfirm: () => undoSkipCycle(g),
                        })}>↺ Undo last</span>
                      )}
                    </div>
                  )}
                  {(recurringFailedDeductionHistory[g.id] || []).length > 0 && (() => {
                    const failCount = recurringFailedDeductionHistory[g.id].length
                    const tier = failCount >= 3 ? 'urgent' : failCount === 2 ? 'high' : 'low'
                    const tierColor = tier === 'urgent' ? C.red : tier === 'high' ? C.red : C.warning
                    return (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12.5, fontWeight: 500, color: tierColor }}>⚠ {failCount} failed deduction{failCount !== 1 ? 's' : ''} · last: {recurringFailedDeductionHistory[g.id][0].reason}</span>
                          <span style={{ fontSize: 11, color: tierColor, textDecoration: 'underline', cursor: 'pointer' }} onClick={() => setConfirmModal({
                            title: 'Undo last failed deduction entry?',
                            description: `This will remove the most recent failed deduction record for ${g.donor_name}.`,
                            confirmLabel: 'Undo',
                            onConfirm: () => undoFailedDeduction(g, recurringFailedDeductionHistory[g.id][0]),
                          })}>↺ Undo last</span>
                        </div>
                        {tier !== 'low' && (
                          <div style={{ fontSize: 11.5, color: C.red, marginTop: 4, fontWeight: tier === 'urgent' ? 500 : 400 }}>
                            {tier === 'urgent' ? 'Repeated failures — ' : 'Second failure — '}
                            {g.donor_phone ? `call ${g.donor_name} directly at ${g.donor_phone}` : `email is unreliable here, get a phone number for ${g.donor_name}`}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                  {g.status === 'active' && (recurringReminderHistory[g.id] || []).length > 0 && (() => {
                    const history = recurringReminderHistory[g.id]
                    const last = history[0]
                    const daysAgo = Math.floor((new Date() - new Date(last.sent_at)) / (1000 * 60 * 60 * 24))
                    return (
                      <div style={{ fontSize: 12.5, color: C.gold, fontWeight: 500 }}>✉ Last reminded {daysAgo === 0 ? 'today' : `${daysAgo}d ago`} · {history.length}× sent</div>
                    )
                  })()}
                  {(donationsByRecurringGift[g.id] || []).length > 0 && (
                    <div>
                      <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', width: '100%', justifyContent: 'center', borderRadius: 4 }} onClick={() => setExpandedRecurringId(expandedRecurringId === g.id ? null : g.id)}>
                        {expandedRecurringId === g.id ? '▲ Hide payment history' : `▼ View payment history (${donationsByRecurringGift[g.id].length})`}
                      </button>
                      {expandedRecurringId === g.id && (
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                          {donationsByRecurringGift[g.id].map(d => (
                            <div key={d.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 10px', fontSize: 12 }}>
                              {editingRecurringDonationId === d.id ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ color: C.text, flexShrink: 0 }}>{new Date(d.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                  <input
                                    type="number"
                                    autoFocus
                                    style={{ width: 60, fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 6px', color: C.forest, textAlign: 'right', flexShrink: 0 }}
                                    value={editingRecurringAmount}
                                    onChange={e => setEditingRecurringAmount(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') saveRecurringDonationAmount(d); if (e.key === 'Escape') setEditingRecurringDonationId(null) }}
                                  />
                                  <input
                                    type="text"
                                    placeholder="Note..."
                                    style={{ flex: 1, minWidth: 0, fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 6px', color: C.text }}
                                    value={editingRecurringNote}
                                    onChange={e => setEditingRecurringNote(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') saveRecurringDonationAmount(d); if (e.key === 'Escape') setEditingRecurringDonationId(null) }}
                                  />
                                  <span style={{ color: C.sage, cursor: savingRecurringAmount ? 'default' : 'pointer', opacity: savingRecurringAmount ? 0.5 : 1, flexShrink: 0 }} onClick={() => saveRecurringDonationAmount(d)}>✓</span>
                                  <span style={{ color: C.muted, cursor: 'pointer', flexShrink: 0 }} onClick={() => setEditingRecurringDonationId(null)}>✕</span>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                  <span style={{ color: C.text, display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                                    <span style={{ flexShrink: 0 }}>{new Date(d.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                    {d.payment_status !== 'confirmed' && <span style={{ color: C.gold, flexShrink: 0 }}>· {d.payment_status}</span>}
                                    {d.notes && <span style={{ color: C.muted, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {d.notes}</span>}
                                  </span>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                    <span style={{ fontWeight: 500, color: C.forest }}>${Number(d.amount).toLocaleString()}</span>
                                    {d.source === 'manual' ? (
                                      <span style={{ color: C.muted, cursor: 'pointer' }} onClick={() => startEditingRecurringAmount(d)}>✏️</span>
                                    ) : (
                                      <span style={{ color: C.muted, opacity: 0.4, cursor: 'default' }} title="Only manually-entered payments can be edited">🔒</span>
                                    )}
                                    <span style={{ color: C.muted, cursor: 'pointer' }} onClick={() => deleteDonation(d.id)}>✕</span>
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              {g.status === 'active' && (
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'auto', position: 'relative' }}>
                  <button style={{ ...s.issueBtn, fontSize: 12, fontWeight: 500, padding: '8px 10px', width: '100%', justifyContent: 'center' }} onClick={() => markRecurringReceived(g)}>✓ Mark received</button>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {isLate && (
                      <button style={{ ...s.viewBtn, fontSize: 11.5, padding: '7px 8px', flex: 1, justifyContent: 'center' }} onClick={() => { setRecurringReminderCandidate(g); setShowRecurringReminderModal(true) }}>✉ Remind</button>
                    )}
                    <button style={{ ...s.viewBtn, fontSize: 11.5, padding: '7px 8px', flex: 1, justifyContent: 'center' }} onClick={() => skipRecurringCycle(g)}>⏭ Skip</button>
                    <button style={{ ...s.viewBtn, fontSize: 11.5, padding: '7px 8px', flex: 1, justifyContent: 'center' }} onClick={() => setRecurringMoreMenuId(recurringMoreMenuId === g.id ? null : g.id)}>⋯ More</button>
                  </div>
                  {recurringMoreMenuId === g.id && (
                    <div style={{ position: 'absolute', bottom: '100%', right: 16, marginBottom: 4, background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.12)', overflow: 'hidden', zIndex: 5, minWidth: 150 }}>
                      <button style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 12, padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', color: C.text }} onClick={() => { setRecurringMoreMenuId(null); pauseRecurringGift(g) }}>⏸ Pause</button>
                      <button style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 12, padding: '8px 12px', background: 'transparent', border: 'none', borderTop: `1px solid ${C.ivoryDark}`, cursor: 'pointer', color: C.text }} onClick={() => { setRecurringMoreMenuId(null); setEditingRecurringGift(g) }}>✏️ Edit</button>
                      <button style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 12, padding: '8px 12px', background: 'transparent', border: 'none', borderTop: `1px solid ${C.ivoryDark}`, cursor: 'pointer', color: C.red }} onClick={() => { setRecurringMoreMenuId(null); recordFailedDeduction(g) }}>⚠ Failed deduction</button>
                    </div>
                  )}
                </div>
              )}
              {g.status === 'paused' && (
                <div style={{ padding: '12px 16px', display: 'flex', gap: 6, marginTop: 'auto' }}>
                  <button style={{ ...s.issueBtn, fontSize: 12, fontWeight: 500, padding: '8px 10px', flex: 1, justifyContent: 'center' }} onClick={() => reactivateRecurringGift(g)}>▶ Reactivate</button>
                  <button style={{ ...s.viewBtn, fontSize: 11.5, padding: '7px 8px', flex: 1, justifyContent: 'center' }} onClick={() => setEditingRecurringGift(g)}>✏️ Edit</button>
                </div>
              )}
              {g.status === 'cancelled' && (
                <div style={{ padding: '12px 16px', marginTop: 'auto' }}>
                  <button style={{ ...s.viewBtn, fontSize: 11.5, padding: '7px 10px', width: '100%', justifyContent: 'center' }} onClick={() => restoreCancelledRecurringGift(g)}>↺ Restore</button>
                </div>
              )}
            </div>
          )
        }

        if (recurringGifts.length === 0) {
          return (
            <EmptyState
              icon="🔁"
              title="No recurring gifts yet"
              description="Track GIRO and habitual PayNow donors who give on a regular schedule — you'll see missed cycles and get reminders to follow up."
              ctaLabel="+ Add Recurring Gift"
              onCta={() => setShowRecurringForm(true)}
            />
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
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'start' }}>
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
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'start' }}>
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
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'start' }}>
                    {cancelled.map(renderRecurringCard)}
                  </div>
                )}
              </div>
            )}
          </>
        )
      })()}
    </div>
  )
}
