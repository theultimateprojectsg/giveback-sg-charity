import type { Dispatch, SetStateAction, MutableRefObject } from 'react'
import { C } from '../theme'
import { s } from '../styles'
import { InfoTip } from '../components/ui/InfoTip'
import { EmptyState } from '../components/ui/EmptyState'
import { SenderIdentityLine } from '../components/ui/SenderIdentityLine'
import { EditPledgeModal } from '../components/modals/EditPledgeModal'
import type { Pledge, Donation } from '../types'

interface PledgesPageProps {
  isMobile?: boolean
  pledges: Pledge[]
  myCauses: { id: string, title: string }[]
  fyOf: (date: string | number | Date) => number
  senderIdentity: Record<string, unknown>
  setShowPledgeForm: Dispatch<SetStateAction<boolean>>
  pledgeError: string
  setPledgeError: Dispatch<SetStateAction<string>>
  editingPledge: Pledge | null
  setEditingPledge: Dispatch<SetStateAction<Pledge | null>>
  updatePledge: (id: string, form: unknown) => unknown
  cancelPledge: (p: Pledge) => void
  pledgeInstalments: { id: string, pledge_id: string, year_number: number, expected_date: string, received?: boolean }[]
  pledgeSearchTerm: string
  setPledgeSearchTerm: Dispatch<SetStateAction<string>>
  showPledgeFilters: boolean
  setShowPledgeFilters: Dispatch<SetStateAction<boolean>>
  pledgeUrgencyFilter: string
  setPledgeUrgencyFilter: Dispatch<SetStateAction<string>>
  pledgeDueSoonDays: number
  pledgeAmountFilter: string
  setPledgeAmountFilter: Dispatch<SetStateAction<string>>
  pledgeYearFilter: string
  setPledgeYearFilter: Dispatch<SetStateAction<string>>
  pledgeTypeFilter: string
  setPledgeTypeFilter: Dispatch<SetStateAction<string>>
  pledgeProgrammeFilter: string
  setPledgeProgrammeFilter: Dispatch<SetStateAction<string>>
  pledgeSortBy: string
  setPledgeSortBy: Dispatch<SetStateAction<string>>
  exportPledgesExcel: (filtered: Pledge[]) => void
  showPledgeReminderModal: boolean
  pledgeReminderCandidate: Pledge | null
  pledgeReminderPreviewing: boolean
  setPledgeReminderPreviewing: Dispatch<SetStateAction<boolean>>
  setShowPledgeReminderModal: Dispatch<SetStateAction<boolean>>
  setPledgeReminderCandidate: Dispatch<SetStateAction<Pledge | null>>
  pledgeReminderSubject: string
  setPledgeReminderSubject: Dispatch<SetStateAction<string>>
  pledgeReminderBody: string
  setPledgeReminderBody: Dispatch<SetStateAction<string>>
  sendingPledgeReminder: boolean
  sendPledgeReminder: () => void
  showPledgeThankYouModal: boolean
  pledgeCompletionCandidate: { pledge: Pledge, donation: Donation } | null
  pledgeThankYouPreviewing: boolean
  setPledgeThankYouPreviewing: Dispatch<SetStateAction<boolean>>
  setShowPledgeThankYouModal: Dispatch<SetStateAction<boolean>>
  setPledgeCompletionCandidate: Dispatch<SetStateAction<unknown>>
  pledgeThankYouSubject: string
  setPledgeThankYouSubject: Dispatch<SetStateAction<string>>
  pledgeThankYouBody: string
  setPledgeThankYouBody: Dispatch<SetStateAction<string>>
  skipPledgeThankYou: () => void
  sendingPledgeThankYou: boolean
  sendPledgeThankYou: () => void
  logContactModal: Pledge | null
  setLogContactModal: Dispatch<SetStateAction<Pledge | null>>
  logContactMethod: string
  setLogContactMethod: Dispatch<SetStateAction<string>>
  logContactNote: string
  setLogContactNote: Dispatch<SetStateAction<string>>
  loggingContact: boolean
  logPledgeContact: () => void
  showPledgeForm: boolean
  pledgeForm: Record<string, unknown> & { donor_name?: string, donor_email?: string, donor_phone?: string, cause_id?: string, source?: string, is_anonymous?: boolean, is_multi_year?: boolean, amount?: string, total_years?: string, expected_date?: string, notes?: string }
  setPledgeForm: Dispatch<SetStateAction<PledgesPageProps['pledgeForm']>>
  savingPledge: boolean
  savePledge: () => void
  pledgeGivenTotals: Record<string, number>
  donationsByPledge: Record<string, { donation_id: string, created_at: string, amount_applied: number, payment_status?: string, notes?: string, source?: string }[]>
  pledgeReminderHistory: Record<string, { sent_at: string, channel?: string }[]>
  pledgeRescheduleHistory: Record<string, { old_expected_date: string, new_expected_date: string, reason?: string }[]>
  setSelectedDonor: (d: unknown) => void
  findDonorRecord: (email?: string | null, name?: string | null) => unknown
  deactivatedOrDncKeys?: Set<string>
  setActiveTab: (tab: string) => void
  pendingDonorProfileTabRef: MutableRefObject<string | null>
  setDonorProfileTab: (tab: string) => void
  expandedPledgeId: string | null
  setExpandedPledgeId: Dispatch<SetStateAction<string | null>>
  editingPledgeDonationId: string | null
  setEditingPledgeDonationId: Dispatch<SetStateAction<string | null>>
  editingPledgeAmount: string
  setEditingPledgeAmount: Dispatch<SetStateAction<string>>
  editingPledgeNotes: string
  setEditingPledgeNotes: Dispatch<SetStateAction<string>>
  savePledgeDonationAmount: (l: unknown) => void
  savingPledgeAmount: boolean
  startEditingPledgeAmount: (l: unknown) => void
  deleteDonation: (id: string) => void
  fulfillPledge: (p: Pledge) => void
  pledgeMoreMenuId: string | null
  setPledgeMoreMenuId: Dispatch<SetStateAction<string | null>>
  setRescheduleModal: (p: Pledge) => void
  setRescheduleNewDate: Dispatch<SetStateAction<string>>
  setRescheduleReason: Dispatch<SetStateAction<string>>
  openThankYouForFulfilledPledge: (p: Pledge) => void
  revertPledgeToPending: (p: Pledge) => void
  showFulfilledPledges: boolean
  setShowFulfilledPledges: Dispatch<SetStateAction<boolean>>
  showCancelledPledges: boolean
  setShowCancelledPledges: Dispatch<SetStateAction<boolean>>
}

export function PledgesPage({
  isMobile, pledges, myCauses, fyOf, senderIdentity,
  setShowPledgeForm, pledgeError, setPledgeError,
  editingPledge, setEditingPledge, updatePledge, cancelPledge, pledgeInstalments,
  pledgeSearchTerm, setPledgeSearchTerm, showPledgeFilters, setShowPledgeFilters,
  pledgeUrgencyFilter, setPledgeUrgencyFilter, pledgeDueSoonDays,
  pledgeAmountFilter, setPledgeAmountFilter, pledgeYearFilter, setPledgeYearFilter,
  pledgeTypeFilter, setPledgeTypeFilter, pledgeProgrammeFilter, setPledgeProgrammeFilter,
  pledgeSortBy, setPledgeSortBy, exportPledgesExcel,
  showPledgeReminderModal, pledgeReminderCandidate, pledgeReminderPreviewing, setPledgeReminderPreviewing,
  setShowPledgeReminderModal, setPledgeReminderCandidate,
  pledgeReminderSubject, setPledgeReminderSubject, pledgeReminderBody, setPledgeReminderBody,
  sendingPledgeReminder, sendPledgeReminder,
  showPledgeThankYouModal, pledgeCompletionCandidate, pledgeThankYouPreviewing, setPledgeThankYouPreviewing,
  setShowPledgeThankYouModal, setPledgeCompletionCandidate,
  pledgeThankYouSubject, setPledgeThankYouSubject, pledgeThankYouBody, setPledgeThankYouBody,
  skipPledgeThankYou, sendingPledgeThankYou, sendPledgeThankYou,
  logContactModal, setLogContactModal, logContactMethod, setLogContactMethod,
  logContactNote, setLogContactNote, loggingContact, logPledgeContact,
  showPledgeForm, pledgeForm, setPledgeForm, savingPledge, savePledge,
  pledgeGivenTotals, donationsByPledge, pledgeReminderHistory, pledgeRescheduleHistory,
  setSelectedDonor, findDonorRecord, setActiveTab, pendingDonorProfileTabRef, setDonorProfileTab, deactivatedOrDncKeys,
  expandedPledgeId, setExpandedPledgeId,
  editingPledgeDonationId, setEditingPledgeDonationId, editingPledgeAmount, setEditingPledgeAmount,
  editingPledgeNotes, setEditingPledgeNotes, savePledgeDonationAmount, savingPledgeAmount,
  startEditingPledgeAmount, deleteDonation, fulfillPledge,
  pledgeMoreMenuId, setPledgeMoreMenuId,
  setRescheduleModal, setRescheduleNewDate, setRescheduleReason,
  openThankYouForFulfilledPledge, revertPledgeToPending,
  showFulfilledPledges, setShowFulfilledPledges, showCancelledPledges, setShowCancelledPledges,
}: PledgesPageProps) {
  return (
    <div style={s.content}>
      <div style={s.pageHeader}>
        <div>
          <div style={s.pageTitle}>Pledges</div>
          <div style={s.pageSub}>{pledges.filter(p => p.status === 'pending').length} pending · {pledges.filter(p => p.status === 'fulfilled').length} fulfilled</div>
        </div>
        <button style={s.btnGold} onClick={() => { setShowPledgeForm(true); setPledgeError('') }}>+ Record Pledge</button>
      </div>

      {editingPledge && (
        <EditPledgeModal pledge={editingPledge} onClose={() => setEditingPledge(null)} onSave={(form) => updatePledge(editingPledge.id, form)} causes={myCauses} onCancelPledge={cancelPledge} instalments={pledgeInstalments.filter(i => i.pledge_id === editingPledge.id)} />
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
        <input style={{ ...s.searchBox, flex: 'none', width: isMobile ? '100%' : 380 }} placeholder="🔍 Search pledges by donor name, email, phone, reference, or notes..." value={pledgeSearchTerm} onChange={e => setPledgeSearchTerm(e.target.value)} />
        {isMobile && (
          <button style={{ ...s.viewBtn, width: '100%', justifyContent: 'center' }} onClick={() => setShowPledgeFilters(v => !v)}>{showPledgeFilters ? '▾ Hide Filters' : '▸ Filters & Sort'}</button>
        )}
        {(!isMobile || showPledgeFilters) && (<>
        <select style={{ ...s.formInput, width: isMobile ? '100%' : 160 }} value={pledgeUrgencyFilter} onChange={e => setPledgeUrgencyFilter(e.target.value)}>
          <option value="All">All urgency</option>
          <option value="Overdue">Overdue</option>
          <option value="Due Soon">Due soon ({pledgeDueSoonDays}d)</option>
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
          {[...new Set(pledges.map(p => fyOf(p.expected_date)))].sort((a, b) => b - a).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select style={{ ...s.formInput, width: isMobile ? '100%' : 150 }} value={pledgeTypeFilter} onChange={e => setPledgeTypeFilter(e.target.value)}>
          <option value="All">Single & multi-year</option>
          <option value="Single">Single-year only</option>
          <option value="Multi-year">Multi-year only</option>
        </select>
        <select style={{ ...s.formInput, width: isMobile ? '100%' : 190 }} value={pledgeProgrammeFilter} onChange={e => setPledgeProgrammeFilter(e.target.value)}>
          <option value="All">All programmes</option>
          <option value="__none__">General / unrestricted</option>
          {myCauses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <select style={{ ...s.formInput, width: isMobile ? '100%' : 170 }} value={pledgeSortBy} onChange={e => setPledgeSortBy(e.target.value)}>
          <option value="expected_asc">Sort: Expected soonest</option>
          <option value="expected_desc">Sort: Expected latest</option>
          <option value="amount_desc">Sort: Amount (high–low)</option>
          <option value="amount_asc">Sort: Amount (low–high)</option>
          <option value="created_desc">Sort: Newest recorded</option>
          <option value="created_asc">Sort: Oldest recorded</option>
          <option value="donor_az">Sort: Donor A–Z</option>
        </select>
        {(pledgeSearchTerm !== '' || pledgeUrgencyFilter !== 'All' || pledgeAmountFilter !== 'All' || pledgeYearFilter !== 'All' || pledgeTypeFilter !== 'All' || pledgeProgrammeFilter !== 'All') && (
          <button style={{ ...s.viewBtn, whiteSpace: 'nowrap' }} onClick={() => { setPledgeSearchTerm(''); setPledgeUrgencyFilter('All'); setPledgeAmountFilter('All'); setPledgeYearFilter('All'); setPledgeTypeFilter('All'); setPledgeProgrammeFilter('All') }}>✕ Clear Filters</button>
        )}
        </>)}
        <button style={isMobile ? { ...s.exportSmallBtn, width: '100%' } : s.exportSmallBtn} onClick={() => {
          const q = pledgeSearchTerm.toLowerCase().trim()
          const filtered = pledges.filter(p => {
            const matchesSearch = !q || [p.donor_name, p.donor_email, p.donor_phone, p.notes, p.reference].some(f => f?.toLowerCase().includes(q))
            const matchesYear = pledgeYearFilter === 'All' || fyOf(p.expected_date).toString() === pledgeYearFilter
            const matchesType = pledgeTypeFilter === 'All' || (pledgeTypeFilter === 'Multi-year' ? !!p.is_multi_year : !p.is_multi_year)
            const matchesProgramme = pledgeProgrammeFilter === 'All' || (pledgeProgrammeFilter === '__none__' ? !p.cause_id : p.cause_id === pledgeProgrammeFilter)
            const amt = Number(p.amount)
            const matchesAmt = pledgeAmountFilter === 'All'
              || (pledgeAmountFilter === 'Under 100' && amt < 100)
              || (pledgeAmountFilter === '100-500' && amt >= 100 && amt <= 500)
              || (pledgeAmountFilter === '500-1000' && amt > 500 && amt <= 1000)
              || (pledgeAmountFilter === 'Over 1000' && amt > 1000)
            return matchesSearch && matchesYear && matchesType && matchesProgramme && matchesAmt
          })
          exportPledgesExcel(filtered)
        }}>⬇️ Export to Excel</button>
      </div>

      {showPledgeReminderModal && pledgeReminderCandidate && !pledgeReminderPreviewing && (
        <div data-modal-overlay="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => { setShowPledgeReminderModal(false); setPledgeReminderCandidate(null) }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>Send pledge reminder</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => { setShowPledgeReminderModal(false); setPledgeReminderCandidate(null) }}>✕</button>
            </div>
            <SenderIdentityLine recipientName={pledgeReminderCandidate.donor_name} recipientEmail={pledgeReminderCandidate.donor_email} {...senderIdentity} />
            <label style={{ display: 'block', marginBottom: 12 }}>
              <div style={s.formLabel}>Subject</div>
              <input style={s.formInput} value={pledgeReminderSubject} onChange={e => setPledgeReminderSubject(e.target.value)} />
            </label>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={s.formLabel}>Message</div>
              <textarea style={{ ...s.formInput, minHeight: 260, resize: 'vertical', fontFamily: 'inherit' }} value={pledgeReminderBody} onChange={e => setPledgeReminderBody(e.target.value)} />
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={!pledgeReminderCandidate.donor_email} onClick={() => setPledgeReminderPreviewing(true)}>
                Preview email →
              </button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => { setShowPledgeReminderModal(false); setPledgeReminderCandidate(null) }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showPledgeReminderModal && pledgeReminderCandidate && pledgeReminderPreviewing && (
        <div data-modal-overlay="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => { setShowPledgeReminderModal(false); setPledgeReminderCandidate(null); setPledgeReminderPreviewing(false) }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>Preview email</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => { setShowPledgeReminderModal(false); setPledgeReminderCandidate(null); setPledgeReminderPreviewing(false) }}>✕</button>
            </div>
            <SenderIdentityLine recipientName={pledgeReminderCandidate.donor_name} recipientEmail={pledgeReminderCandidate.donor_email} {...senderIdentity} />
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: 16, background: C.ivory, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.forest, marginBottom: 10 }}>{pledgeReminderSubject}</div>
              <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{pledgeReminderBody}</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={sendingPledgeReminder} onClick={sendPledgeReminder}>
                {sendingPledgeReminder ? 'Sending...' : '✓ Send reminder'}
              </button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => setPledgeReminderPreviewing(false)}>
                ← Back to edit
              </button>
            </div>
          </div>
        </div>
      )}

      {showPledgeThankYouModal && pledgeCompletionCandidate && !pledgeThankYouPreviewing && (
        <div data-modal-overlay="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => { setShowPledgeThankYouModal(false); setPledgeCompletionCandidate(null) }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>🎉 Pledge completed</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => { setShowPledgeThankYouModal(false); setPledgeCompletionCandidate(null) }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              This donation brings {pledgeCompletionCandidate.pledge.donor_name}'s pledge of ${Number(pledgeCompletionCandidate.pledge.amount).toLocaleString()} to completion. Send a special thank-you?
            </div>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <div style={s.formLabel}>Subject</div>
              <input style={s.formInput} value={pledgeThankYouSubject} onChange={e => setPledgeThankYouSubject(e.target.value)} />
            </label>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={s.formLabel}>Message</div>
              <textarea style={{ ...s.formInput, minHeight: 260, resize: 'vertical', fontFamily: 'inherit' }} value={pledgeThankYouBody} onChange={e => setPledgeThankYouBody(e.target.value)} />
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={!pledgeCompletionCandidate.donation.donor_email} onClick={() => setPledgeThankYouPreviewing(true)}>
                Preview email →
              </button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={skipPledgeThankYou}>
                Skip — just mark fulfilled
              </button>
            </div>
            <div style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 10 }}>Not ready to decide? Close this and resolve the pledge later from the Pledges tab.</div>
          </div>
        </div>
      )}

      {showPledgeThankYouModal && pledgeCompletionCandidate && pledgeThankYouPreviewing && (
        <div data-modal-overlay="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => { setShowPledgeThankYouModal(false); setPledgeCompletionCandidate(null); setPledgeThankYouPreviewing(false) }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>Preview email</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => { setShowPledgeThankYouModal(false); setPledgeCompletionCandidate(null); setPledgeThankYouPreviewing(false) }}>✕</button>
            </div>
            <SenderIdentityLine recipientName={pledgeCompletionCandidate.donation.donor_name} recipientEmail={pledgeCompletionCandidate.donation.donor_email} {...senderIdentity} />
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: 16, background: C.ivory, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.forest, marginBottom: 10 }}>{pledgeThankYouSubject}</div>
              <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{pledgeThankYouBody}</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} disabled={sendingPledgeThankYou} onClick={sendPledgeThankYou}>
                {sendingPledgeThankYou ? 'Sending...' : '✓ Mark fulfilled & send'}
              </button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => setPledgeThankYouPreviewing(false)}>
                ← Back to edit
              </button>
            </div>
          </div>
        </div>
      )}

      {logContactModal && (
        <div data-modal-overlay="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => { setLogContactModal(null); setLogContactNote('') }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>Log a follow-up</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => { setLogContactModal(null); setLogContactNote('') }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              Already spoke with {logContactModal.donor_name}? Log it here instead of sending an email — this pledge won't be flagged as needing attention again for 7 days.
            </div>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <div style={s.formLabel}>How did you follow up?</div>
              <select style={s.formInput} value={logContactMethod} onChange={e => setLogContactMethod(e.target.value)}>
                <option value="phone">📞 Call</option>
                <option value="email">📧 Email</option>
                <option value="in_person">🤝 Meeting</option>
                <option value="whatsapp">💬 WhatsApp</option>
                <option value="other">📝 Note</option>
              </select>
            </label>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={s.formLabel}>Note (optional)</div>
              <input style={s.formInput} placeholder="e.g. Will pay by end of month" value={logContactNote} onChange={e => setLogContactNote(e.target.value)} />
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={s.issueBtn} disabled={loggingContact} onClick={logPledgeContact}>{loggingContact ? 'Saving...' : '✓ Log Follow-up'}</button>
              <button style={s.viewBtn} onClick={() => { setLogContactModal(null); setLogContactNote('') }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showPledgeForm && (
        <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => { setShowPledgeForm(false); setPledgeError('') }}>
        <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.forest }}>🤝 New Pledge</div>
            <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => { setShowPledgeForm(false); setPledgeError('') }}>✕</button>
          </div>
          {pledgeError && <div style={{ background: C.warningBg, color: C.warning, padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12 }}>{pledgeError}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <label style={{ display: 'block' }}>
              <div style={s.formLabel}>Donor Name *</div>
              <input style={s.formInput} placeholder="Full name" value={pledgeForm.donor_name} onChange={e => setPledgeForm(f => ({ ...f, donor_name: e.target.value }))} />
            </label>
            <label style={{ display: 'block' }}>
              <div style={s.formLabel}>Donor Email</div>
              <input style={s.formInput} placeholder="donor@email.com" value={pledgeForm.donor_email} onChange={e => setPledgeForm(f => ({ ...f, donor_email: e.target.value }))} />
            </label>
            <label style={{ display: 'block' }}>
              <div style={s.formLabel}>Donor Phone</div>
              <input style={s.formInput} type="tel" placeholder="+65 9123 4567" value={pledgeForm.donor_phone} onChange={e => setPledgeForm(f => ({ ...f, donor_phone: e.target.value }))} />
            </label>
            <label style={{ display: 'block' }}>
              <div style={s.formLabel}>Linked Programme / Campaign</div>
              <select style={s.formInput} value={pledgeForm.cause_id} onChange={e => setPledgeForm(f => ({ ...f, cause_id: e.target.value }))}>
                <option value="">None — general / unrestricted use</option>
                {(myCauses || []).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
            <label style={{ display: 'block' }}>
              <div style={s.formLabel}>How was this pledge made? (optional)</div>
              <select style={s.formInput} value={pledgeForm.source} onChange={e => setPledgeForm(f => ({ ...f, source: e.target.value }))}>
                <option value="">Not specified</option>
                <option value="event">Event</option>
                <option value="referral">Referral</option>
                <option value="social_media">Social Media</option>
                <option value="walk_in">Walk-in</option>
                <option value="corporate_partner">Corporate Partner</option>
                <option value="other">Other</option>
              </select>
            </label>
            <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.forest, cursor: 'pointer' }}>
                <input type="checkbox" checked={pledgeForm.is_anonymous} onChange={e => setPledgeForm(f => ({ ...f, is_anonymous: e.target.checked }))} />
                This pledge is anonymous
              </label>
            </div>
            <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.forest, cursor: 'pointer' }}>
                <input type="checkbox" checked={pledgeForm.is_multi_year} onChange={e => setPledgeForm(f => ({ ...f, is_multi_year: e.target.checked }))} />
                This is a multi-year pledge (e.g. $10K/year for 3 years)
              </label>
            </div>
            <label style={{ display: 'block' }}>
              <div style={s.formLabel}>{pledgeForm.is_multi_year ? 'Amount Per Year (SGD) *' : 'Pledged Amount (SGD) *'}</div>
              <input style={s.formInput} type="number" placeholder="0.00" value={pledgeForm.amount} onChange={e => setPledgeForm(f => ({ ...f, amount: e.target.value }))} />
            </label>
            {pledgeForm.is_multi_year && (
              <label style={{ display: 'block' }}>
                <div style={s.formLabel}>Number of Years *</div>
                <input style={s.formInput} type="number" min="2" placeholder="3" value={pledgeForm.total_years} onChange={e => setPledgeForm(f => ({ ...f, total_years: e.target.value }))} />
              </label>
            )}
            <label style={{ display: 'block' }}>
              <div style={s.formLabel}>{pledgeForm.is_multi_year ? 'First Instalment Due *' : 'Expected By *'}</div>
              <input style={s.formInput} type="date" min={new Date().toISOString().split('T')[0]} value={pledgeForm.expected_date} onChange={e => setPledgeForm(f => ({ ...f, expected_date: e.target.value }))} />
            </label>
            {pledgeForm.is_multi_year && pledgeForm.amount && pledgeForm.total_years && (
              <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1', background: C.successBg, border: `1px solid ${C.sage}`, borderRadius: 6, padding: 10, fontSize: 12, color: C.forest }}>
                Total commitment: <strong>${(parseFloat(pledgeForm.amount) * parseInt(pledgeForm.total_years)).toLocaleString()}</strong> over {pledgeForm.total_years} years
              </div>
            )}
            <label style={{ display: 'block', gridColumn: isMobile ? 'auto' : '1 / -1' }}>
              <div style={s.formLabel}>Notes</div>
              <input style={s.formInput} placeholder="e.g. Verbally committed at gala dinner" value={pledgeForm.notes} onChange={e => setPledgeForm(f => ({ ...f, notes: e.target.value }))} maxLength={500} />
            </label>
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
        const renderPledgeCard = (p: Pledge) => {
          const expectedDate = new Date(p.expected_date)
          const daysUntil = Math.ceil((expectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          const isOverdue = daysUntil < 0 && p.status === 'pending'
          const isDueSoon = daysUntil >= 0 && daysUntil <= 7 && p.status === 'pending'
          const given = pledgeGivenTotals[p.id] || 0
          const pledgedAmount = Number(p.amount)
          const pct = pledgedAmount > 0 ? Math.min(100, Math.round((given / pledgedAmount) * 100)) : 0
          const linkedCause = p.cause_id ? myCauses.find(c => c.id === p.cause_id) : null
          const pledgeStatusMap = {
            pending: { bg: C.sage, color: C.white, label: 'Active' },
            fulfilled: { bg: C.sage, color: C.white, label: 'Fulfilled' },
            cancelled: { bg: C.red, color: C.white, label: 'Cancelled' },
          }
          const pledgeStatusInfo = (pledgeStatusMap as Record<string, { bg: string, color: string, label: string }>)[p.status] || { bg: C.ivory, color: C.muted, label: p.status }
          const hasActivity = (donationsByPledge[p.id] || []).length > 0 || (p.status === 'pending' && ((pledgeReminderHistory[p.id] || []).length > 0 || (pledgeRescheduleHistory[p.id] || []).length > 0)) || p.resolution_notes
          return (
            <div key={p.id} style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

              {/* Header: who */}
              <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${C.ivoryDark}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontSize: 15, fontWeight: 500, color: C.forest, cursor: 'pointer' }} onClick={() => { setSelectedDonor(findDonorRecord(p.donor_email, p.donor_name)); setActiveTab('donors') }}>{p.donor_name}</div>
                      {deactivatedOrDncKeys?.has(p.donor_email?.trim() || p.donor_name || '') && (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: C.red + '1A', color: C.red }}>⊘ Deactivated donor</span>
                      )}
                    </div>
                    {(p.donor_email || p.donor_phone) && (
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 3 }}>
                        {p.donor_email && <span style={{ fontSize: 12, color: C.muted, display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ fontSize: 11, opacity: 0.7 }}>✉️</span>{p.donor_email}</span>}
                        {p.donor_phone && <span style={{ fontSize: 12, color: C.muted, display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ fontSize: 11, opacity: 0.7 }}>📞</span>{p.donor_phone}</span>}
                      </div>
                    )}
                    {p.reference && <div style={{ fontSize: 11, color: C.muted, fontFamily: C.fontMono, marginTop: 2 }}>{p.reference}</div>}
                    <div style={{ marginTop: 6 }}>
                      {linkedCause ? (
                        <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4, background: C.teal + '1A', color: C.teal, display: 'inline-flex', alignItems: 'center', gap: 4 }}>🎯 {linkedCause.title} · Restricted</span>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4, background: C.ivory, border: `1px solid ${C.border}`, color: C.muted }}>General / unrestricted</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {p.is_multi_year && <span style={{ fontSize: 10.5, fontWeight: 500, padding: '2px 8px', borderRadius: 4, background: C.ivory, border: `1px solid ${C.border}`, color: C.forest }}>{p.total_years}-YEAR</span>}
                    {p.is_anonymous && <span style={{ fontSize: 10.5, fontWeight: 500, padding: '2px 8px', borderRadius: 4, background: C.ivory, border: `1px solid ${C.border}`, color: C.muted, textTransform: 'uppercase' }}>Anonymous</span>}
                    {isOverdue && <span style={{ fontSize: 12, fontWeight: 500, color: C.white, background: C.red, padding: '4px 10px', borderRadius: 20 }}>⚠ {Math.abs(daysUntil)}d late</span>}
                    {isDueSoon && !isOverdue && daysUntil <= 0 && <span style={{ fontSize: 12, fontWeight: 500, color: C.white, background: C.red, padding: '4px 10px', borderRadius: 20 }}>Due today</span>}
                    {isDueSoon && !isOverdue && daysUntil > 0 && <span style={{ fontSize: 12, fontWeight: 500, color: C.white, background: C.gold, padding: '4px 10px', borderRadius: 20 }}>Due in {daysUntil}d</span>}
                    <span style={{ fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 20, background: pledgeStatusInfo.bg, color: pledgeStatusInfo.color }}>{pledgeStatusInfo.label}</span>
                  </div>
                </div>
              </div>

              {/* Amount + timeline */}
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.ivoryDark}` }}>
                {(p.is_multi_year || p.status !== 'pending') && (
                  <div style={{ marginBottom: 2 }}>
                    <span style={{ fontFamily: C.fontVoice, fontSize: 19, fontWeight: 500, color: C.forest }}>${(p.is_multi_year ? pledgedAmount / p.total_years : pledgedAmount).toLocaleString()}</span>
                    {p.is_multi_year && <span style={{ fontSize: 12.5, color: C.muted }}> / year</span>}
                  </div>
                )}
                {p.is_multi_year && (
                  <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10 }}>${pledgedAmount.toLocaleString()} total over {p.total_years} years</div>
                )}

                {p.is_multi_year && (() => {
                  const myInstalments = pledgeInstalments.filter(i => i.pledge_id === p.id).sort((a, b) => a.year_number - b.year_number)
                  const nextDue = myInstalments.find(i => !i.received)
                  return (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {myInstalments.map(i => (
                          <span key={i.id} style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 20, background: i.received ? C.successBg : (new Date(i.expected_date) < new Date() ? C.dangerBg : C.ivory), color: i.received ? C.sage : (new Date(i.expected_date) < new Date() ? C.red : C.muted), border: `1px solid ${i.received ? C.sage : C.border}` }}>
                            Year {i.year_number}{i.received ? ' ✓' : ` · ${new Date(i.expected_date).toLocaleDateString('en-SG', { month: 'short', year: 'numeric' })}`}
                          </span>
                        ))}
                      </div>
                      {nextDue && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>Next instalment due {new Date(nextDue.expected_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}</div>}
                    </div>
                  )
                })()}

                {p.status === 'pending' && (() => {
                  const progressColor = pct >= 80 ? C.sage : pct >= 50 ? C.gold : C.red
                  return (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                        <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                          <span style={{ fontFamily: C.fontVoice, fontSize: 19, fontWeight: 500, color: C.forest }}>${given.toLocaleString()}</span>
                          <span style={{ fontSize: 13, color: C.muted }}>of</span>
                          <span style={{ fontFamily: C.fontVoice, fontSize: 19, fontWeight: 500, color: C.forest }}>${pledgedAmount.toLocaleString()}</span>
                          <span style={{ fontSize: 13, color: C.muted }}>pledged</span>
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: progressColor }}>{pct}%</span>
                      </div>
                      <div style={{ background: C.ivoryDark, borderRadius: 3, height: 7, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(pct, 2)}%`, height: '100%', background: progressColor, borderRadius: 3 }} />
                      </div>
                    </div>
                  )
                })()}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontSize: 12.5, color: C.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                    Expected by {expectedDate.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {p.status === 'pending' && <InfoTip text="Donations are matched automatically by donor and applied here. If a donor has more than one pending pledge, donations apply to whichever is due soonest." />}
                  </span>
                  <span style={{ fontSize: 11.5, color: C.muted, fontStyle: 'italic' }}>Recorded {new Date(p.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                {p.notes && <div style={{ fontSize: 12.5, color: C.text, marginTop: 4 }}><span style={{ color: C.muted }}>Notes:</span> {p.notes}</div>}
              </div>

              {/* Activity */}
              {hasActivity && (
                <div style={{ padding: '12px 16px', background: C.ivory, borderBottom: `1px solid ${C.ivoryDark}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {p.status === 'pending' && (pledgeReminderHistory[p.id] || []).length > 0 && (() => {
                    const history = pledgeReminderHistory[p.id]
                    const last = history[0]
                    const daysAgo = Math.floor((new Date().getTime() - new Date(last.sent_at).getTime()) / (1000 * 60 * 60 * 24))
                    const channelInfo = { phone: ['📞', 'Called'], email: ['📧', 'Emailed'], in_person: ['🤝', 'Met in person'], whatsapp: ['💬', 'WhatsApped'], other: ['📝', 'Followed up'] }[last.channel] || ['✉', 'Reminded']
                    return (
                      <div
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        title="View in donor's Communication Log"
                        onClick={() => { pendingDonorProfileTabRef.current = 'logs'; setSelectedDonor(findDonorRecord(p.donor_email, p.donor_name)); setDonorProfileTab('logs'); setActiveTab('donors') }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span style={{ fontSize: 15, flexShrink: 0 }}>{channelInfo[0]}</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 500, color: C.forest }}>{channelInfo[1]} {daysAgo === 0 ? 'today' : `${daysAgo}d ago`}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>{history.length} follow-up{history.length > 1 ? 's' : ''} logged</div>
                          </div>
                        </div>
                        <span style={{ fontSize: 11, color: C.gold, fontWeight: 500, flexShrink: 0 }}>View log →</span>
                      </div>
                    )
                  })()}
                  {p.status === 'pending' && (pledgeRescheduleHistory[p.id] || []).length > 0 && (
                    <div style={{ fontSize: 11.5, color: C.muted, fontStyle: 'italic' }}>
                      Rescheduled from {new Date(pledgeRescheduleHistory[p.id][0].old_expected_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })} to {new Date(pledgeRescheduleHistory[p.id][0].new_expected_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {pledgeRescheduleHistory[p.id][0].reason && ` — "${pledgeRescheduleHistory[p.id][0].reason}"`}
                    </div>
                  )}
                  {p.resolution_notes && (
                    <div style={{ fontSize: 11.5, color: C.muted, fontStyle: 'italic' }}>"{p.resolution_notes}"</div>
                  )}
                  {(donationsByPledge[p.id] || []).length > 0 && (
                    <div>
                      <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', width: '100%', justifyContent: 'center', borderRadius: 4 }} onClick={() => setExpandedPledgeId(expandedPledgeId === p.id ? null : p.id)}>
                        {expandedPledgeId === p.id ? '▲ Hide payment history' : `▼ View payment history (${donationsByPledge[p.id].length})`}
                      </button>
                      {expandedPledgeId === p.id && (
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                          {donationsByPledge[p.id].map((l, i) => (
                            <div key={i} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 10px', fontSize: 12 }}>
                              {editingPledgeDonationId === l.donation_id ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ color: C.text, flexShrink: 0 }}>{new Date(l.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                  <input
                                    type="number"
                                    autoFocus
                                    style={{ width: 60, fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 6px', color: C.forest, textAlign: 'right', flexShrink: 0 }}
                                    value={editingPledgeAmount}
                                    onChange={e => setEditingPledgeAmount(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') savePledgeDonationAmount(l); if (e.key === 'Escape') setEditingPledgeDonationId(null) }}
                                  />
                                  <input
                                    type="text"
                                    placeholder="Note..."
                                    style={{ flex: 1, minWidth: 0, fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 6px', color: C.text }}
                                    value={editingPledgeNotes}
                                    onChange={e => setEditingPledgeNotes(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') savePledgeDonationAmount(l); if (e.key === 'Escape') setEditingPledgeDonationId(null) }}
                                  />
                                  <span style={{ color: C.sage, cursor: savingPledgeAmount ? 'default' : 'pointer', opacity: savingPledgeAmount ? 0.5 : 1, flexShrink: 0 }} onClick={() => savePledgeDonationAmount(l)}>✓</span>
                                  <span style={{ color: C.muted, cursor: 'pointer', flexShrink: 0 }} onClick={() => setEditingPledgeDonationId(null)}>✕</span>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                  <span style={{ color: C.text, display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                                    <span style={{ flexShrink: 0 }}>{new Date(l.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                    {l.payment_status && l.payment_status !== 'confirmed' && <span style={{ color: C.gold, flexShrink: 0 }}>· {l.payment_status}</span>}
                                    {l.notes && <span style={{ color: C.muted, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {l.notes}</span>}
                                  </span>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                    <span style={{ fontWeight: 500, color: C.forest }}>${Number(l.amount_applied).toLocaleString()}</span>
                                    {l.source === 'manual' ? (
                                      <span style={{ color: C.muted, cursor: 'pointer' }} onClick={() => startEditingPledgeAmount(l)}>✏️</span>
                                    ) : (
                                      <span style={{ color: C.muted, opacity: 0.4, cursor: 'default' }} title="Only manually-entered payments can be edited">🔒</span>
                                    )}
                                    <span style={{ color: C.muted, cursor: 'pointer' }} onClick={() => deleteDonation(l.donation_id)}>✕</span>
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
              {p.status === 'pending' && (
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'auto', position: 'relative' }}>
                  <button style={{ ...s.issueBtn, fontSize: 12, fontWeight: 500, padding: '8px 10px', width: '100%', justifyContent: 'center' }} onClick={() => fulfillPledge(p)}>✓ Mark fulfilled</button>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(isOverdue || isDueSoon) && (
                      <button style={{ ...s.viewBtn, fontSize: 11.5, padding: '7px 8px', flex: 1, justifyContent: 'center' }} onClick={() => { setPledgeReminderCandidate(p); setShowPledgeReminderModal(true) }}>✉ Remind</button>
                    )}
                    {(isOverdue || isDueSoon) && (
                      <button style={{ ...s.viewBtn, fontSize: 11.5, padding: '7px 8px', flex: 1, justifyContent: 'center' }} onClick={() => { setLogContactModal(p); setLogContactMethod('phone'); setLogContactNote('') }}>📞 Log contact</button>
                    )}
                    <button style={{ ...s.viewBtn, fontSize: 11.5, padding: '7px 8px', flex: 1, justifyContent: 'center' }} onClick={() => setPledgeMoreMenuId(pledgeMoreMenuId === p.id ? null : p.id)}>⋯ More</button>
                  </div>
                  {pledgeMoreMenuId === p.id && (
                    <div style={{ position: 'absolute', bottom: '100%', right: 16, marginBottom: 4, background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.12)', overflow: 'hidden', zIndex: 5, minWidth: 140 }}>
                      <button style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 12, padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', color: C.text }} onClick={() => { setPledgeMoreMenuId(null); setRescheduleModal(p); setRescheduleNewDate(''); setRescheduleReason('') }}>📅 Reschedule</button>
                      <button style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 12, padding: '8px 12px', background: 'transparent', border: 'none', borderTop: `1px solid ${C.ivoryDark}`, cursor: 'pointer', color: C.text }} onClick={() => { setPledgeMoreMenuId(null); setEditingPledge(p) }}>✏️ Edit</button>
                    </div>
                  )}
                </div>
              )}
              {(p.status === 'fulfilled' || p.status === 'cancelled') && (
                <div style={{ padding: '12px 16px', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {p.status === 'fulfilled' && (
                    <button style={{ ...s.viewBtn, fontSize: 11.5, padding: '7px 10px', width: '100%', justifyContent: 'center' }} onClick={() => openThankYouForFulfilledPledge(p)}>✉ Send Thank-You</button>
                  )}
                  <button style={{ ...s.viewBtn, fontSize: 11.5, padding: '7px 10px', width: '100%', justifyContent: 'center' }} onClick={() => revertPledgeToPending(p)}>↺ Revert to pending</button>
                </div>
              )}
            </div>
          )
        }

        const q = pledgeSearchTerm.toLowerCase().trim()
        const matchesSearch = (p: Pledge) => {
          if (!q) return true
          const searchFields = [p.donor_name, p.donor_email, p.donor_phone, p.notes, p.reference]
          return searchFields.some(field => field?.toLowerCase().includes(q))
        }
        const matchesUrgency = (p: Pledge) => {
          if (pledgeUrgencyFilter === 'All') return true
          if (p.status !== 'pending') return false
          const days = Math.ceil((new Date(p.expected_date || 0).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          if (pledgeUrgencyFilter === 'Overdue') return days < 0
          if (pledgeUrgencyFilter === 'Due Soon') return days >= 0 && days <= pledgeDueSoonDays
          if (pledgeUrgencyFilter === 'Healthy') return days > pledgeDueSoonDays
          return true
        }
        const matchesAmount = (p: Pledge) => {
          const amt = Number(p.amount)
          if (pledgeAmountFilter === 'All') return true
          if (pledgeAmountFilter === 'Under 100') return amt < 100
          if (pledgeAmountFilter === '100-500') return amt >= 100 && amt <= 500
          if (pledgeAmountFilter === '500-1000') return amt > 500 && amt <= 1000
          if (pledgeAmountFilter === 'Over 1000') return amt > 1000
          return true
        }
        const matchesYear = (p: Pledge) => pledgeYearFilter === 'All' || fyOf(p.expected_date).toString() === pledgeYearFilter
        const matchesType = (p: Pledge) => pledgeTypeFilter === 'All' || (pledgeTypeFilter === 'Multi-year' ? !!p.is_multi_year : !p.is_multi_year)
        const matchesProgramme = (p: Pledge) => pledgeProgrammeFilter === 'All' || (pledgeProgrammeFilter === '__none__' ? !p.cause_id : p.cause_id === pledgeProgrammeFilter)

        const sortPledges = (arr: Pledge[]) => [...arr].sort((a, b) => {
          if (pledgeSortBy === 'expected_asc') return new Date(a.expected_date || 0).getTime() - new Date(b.expected_date || 0).getTime()
          if (pledgeSortBy === 'expected_desc') return new Date(b.expected_date || 0).getTime() - new Date(a.expected_date || 0).getTime()
          if (pledgeSortBy === 'amount_desc') return Number(b.amount) - Number(a.amount)
          if (pledgeSortBy === 'amount_asc') return Number(a.amount) - Number(b.amount)
          if (pledgeSortBy === 'created_desc') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
          if (pledgeSortBy === 'created_asc') return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
          if (pledgeSortBy === 'donor_az') return (a.donor_name || '').localeCompare(b.donor_name || '')
          return 0
        })

        const searchedPledges = pledges.filter(p => matchesSearch(p) && matchesUrgency(p) && matchesAmount(p) && matchesYear(p) && matchesType(p) && matchesProgramme(p))

        const outstanding = sortPledges(searchedPledges.filter(p => p.status === 'pending'))
        const fulfilled = sortPledges(searchedPledges.filter(p => p.status === 'fulfilled'))
        const cancelled = sortPledges(searchedPledges.filter(p => p.status === 'cancelled'))

        if (pledges.length === 0) {
          return (
            <EmptyState
              icon="🤝"
              title="No pledges yet"
              description="Record a pledge when a donor commits to a future gift — you'll get reminders as the expected date approaches and can link it to the donation once it comes in."
              ctaLabel="+ Record Pledge"
              onCta={() => { setShowPledgeForm(true); setPledgeError('') }}
            />
          )
        }

        return (
          <>
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.forest, marginBottom: 12 }}>Outstanding Pledges ({outstanding.length})</div>
              {outstanding.length === 0 ? (
                <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 20px', fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No outstanding pledges.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'start' }}>
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
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'start' }}>
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
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'start' }}>
                    {cancelled.map(renderPledgeCard)}
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
