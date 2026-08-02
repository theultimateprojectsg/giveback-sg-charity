import type { ReactNode, RefObject } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { C } from '../theme'
import { s } from '../styles'
import { EmptyState } from '../components/ui/EmptyState'

interface InKindDonation {
  id: number
  donor_name: string
  donor_email?: string | null
  donor_nric?: string | null
  donor_phone?: string | null
  category: 'goods' | 'services' | 'venue' | 'professional_services' | 'other'
  item_description: string
  estimated_value: number
  received_date: string
  cause_id?: string | null
  notes?: string | null
  is_anonymous?: boolean
  thank_you_sent?: boolean
  receipt_number?: string | null
  receipt_issued?: boolean
  receipt_issued_at?: string | null
  receipt_voided?: boolean
  voided_at?: string | null
  voided_by?: string | null
  void_reason?: string | null
  reissued_from?: string | null
  impact_note?: string | null
  valuation_basis?: string | null
  condition?: string | null
  photo_url?: string | null
}

interface InKindDonationsPageProps {
  isMobile?: boolean
  isTablet?: boolean
  userRole: string
  inKindDonations: InKindDonation[]
  myCauses: { id: string, title: string }[]
  showInKindForm: boolean
  setShowInKindForm: (v: boolean) => void
  editingInKindId: number | null
  inKindForm: any
  setInKindForm: (updater: any) => void
  inKindError: string
  savingInKind: boolean
  saveInKindDonation: () => void
  closeInKindForm: () => void
  startEditingInKind: (item: InKindDonation) => void
  deleteInKindDonation: (item: InKindDonation) => void
  toggleInKindThankYou: (item: InKindDonation) => void
  exportInKindExcel: () => void
  updateInKindNotes: (item: InKindDonation, notes: string) => void
  issueInKindReceipt: (item: InKindDonation) => void
  exportInKindReceiptPDF: (item: InKindDonation) => void
  issuingInKindReceiptId: number | null
  issueAllInKindReceipts: () => void
  bulkInKindActionInProgress: boolean
  bulkInKindProgress: { done: number, total: number } | null
  bulkInKindCancelRef: RefObject<boolean>
  voidAndReissueInKindReceipt: (item: InKindDonation, reason: string) => void
  voidingInKindReceipt: boolean
  updateInKindImpactNote: (item: InKindDonation, note: string) => void
  uploadInKindPhoto: (item: InKindDonation, file: File) => void
  removeInKindPhoto: (item: InKindDonation) => void
  uploadingInKindPhotoId: number | null
}

const CATEGORY_LABELS: Record<string, { icon: string, label: string }> = {
  goods: { icon: '📦', label: 'Goods' },
  services: { icon: '🛠️', label: 'Services' },
  venue: { icon: '🏛️', label: 'Venue / Space' },
  professional_services: { icon: '💼', label: 'Professional Services' },
  other: { icon: '🎁', label: 'Other' },
}

const COLUMN_OPTIONS = [
  { key: 'category', label: 'Category' },
  { key: 'item', label: 'Item' },
  { key: 'cause', label: 'Cause' },
  { key: 'date', label: 'Date' },
  { key: 'value', label: 'Est. Value' },
  { key: 'receipt', label: 'Receipt' },
  { key: 'thankYou', label: 'Thank You' },
]

export function InKindDonationsPage({
  isMobile, isTablet, userRole, inKindDonations, myCauses,
  showInKindForm, setShowInKindForm, editingInKindId, inKindForm, setInKindForm, inKindError, savingInKind,
  saveInKindDonation, closeInKindForm, startEditingInKind, deleteInKindDonation, toggleInKindThankYou, exportInKindExcel,
  updateInKindNotes, issueInKindReceipt, exportInKindReceiptPDF, issuingInKindReceiptId,
  issueAllInKindReceipts, bulkInKindActionInProgress, bulkInKindProgress, bulkInKindCancelRef,
  voidAndReissueInKindReceipt, voidingInKindReceipt,
  updateInKindImpactNote, uploadInKindPhoto, removeInKindPhoto, uploadingInKindPhotoId,
}: InKindDonationsPageProps) {
  const [showVoidModal, setShowVoidModal] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [editingImpactNoteId, setEditingImpactNoteId] = useState<number | null>(null)
  const [impactNoteText, setImpactNoteText] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('All')
  const [filterThankYou, setFilterThankYou] = useState('All')
  const [filterReceipt, setFilterReceipt] = useState('All')
  const [selectedGiftId, setSelectedGiftId] = useState<number | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [editingNotesId, setEditingNotesId] = useState<number | null>(null)
  const [noteText, setNoteText] = useState('')
  const [perPage, setPerPage] = useState(25)
  const [page, setPage] = useState(0)
  const [columnOrder, setColumnOrder] = useState(COLUMN_OPTIONS.map(o => o.key))
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const orderedColumns = columnOrder.map(k => COLUMN_OPTIONS.find(o => o.key === k)).filter(Boolean) as { key: string, label: string }[]
  const reorderColumn = (fromKey: string | null, toKey: string) => {
    if (!fromKey || fromKey === toKey) return
    setColumnOrder(prev => {
      const next = prev.filter(k => k !== fromKey)
      const toIndex = next.indexOf(toKey)
      next.splice(toIndex, 0, fromKey)
      return next
    })
  }
  const pendingReceiptCount = inKindDonations.filter(d => !d.receipt_issued).length

  const totalValue = inKindDonations.reduce((sum, d) => sum + Number(d.estimated_value), 0)
  const canEdit = userRole === 'staff' || userRole === 'ed'
  const selectedGift = selectedGiftId != null ? inKindDonations.find(d => d.id === selectedGiftId) || null : null

  const causeNameFor = (item: InKindDonation) => {
    if (!item.cause_id) return null
    const c = myCauses.find(c => c.id === item.cause_id)
    return c ? c.title : null
  }

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return inKindDonations
      .filter(d => filterCategory === 'All' || d.category === filterCategory)
      .filter(d => filterReceipt === 'All' || (filterReceipt === 'Issued' ? d.receipt_issued : !d.receipt_issued))
      .filter(d => {
        if (filterThankYou === 'All') return true
        const noThankYouExpected = d.is_anonymous || !d.donor_email?.trim()
        if (filterThankYou === 'Sent') return !!d.thank_you_sent
        if (filterThankYou === 'Not Sent') return !d.thank_you_sent && !noThankYouExpected
        if (filterThankYou === 'No Email') return noThankYouExpected
        return true
      })
      .filter(d => !term || [d.donor_name, d.item_description, d.notes, d.receipt_number, causeNameFor(d)].filter(Boolean).some(v => String(v).toLowerCase().includes(term)))
      .sort((a, b) => {
        if (!sortBy) return new Date(b.received_date).getTime() - new Date(a.received_date).getTime()
        let cmp = 0
        if (sortBy === 'donor') cmp = (a.donor_name || '').localeCompare(b.donor_name || '')
        if (sortBy === 'category') cmp = (a.category || '').localeCompare(b.category || '')
        if (sortBy === 'item') cmp = (a.item_description || '').localeCompare(b.item_description || '')
        if (sortBy === 'cause') cmp = (causeNameFor(a) || '').localeCompare(causeNameFor(b) || '')
        if (sortBy === 'date') cmp = new Date(a.received_date).getTime() - new Date(b.received_date).getTime()
        if (sortBy === 'value') cmp = Number(a.estimated_value) - Number(b.estimated_value)
        if (sortBy === 'receipt') cmp = (a.receipt_issued ? 1 : 0) - (b.receipt_issued ? 1 : 0)
        if (sortBy === 'thankYou') cmp = (a.thank_you_sent ? 1 : 0) - (b.thank_you_sent ? 1 : 0)
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [inKindDonations, searchTerm, filterCategory, filterReceipt, filterThankYou, myCauses, sortBy, sortDir])

  const activeFilterCount = (filterCategory !== 'All' ? 1 : 0) + (filterReceipt !== 'All' ? 1 : 0) + (filterThankYou !== 'All' ? 1 : 0) + (searchTerm.trim() ? 1 : 0)
  const clearFilters = () => { setSearchTerm(''); setFilterCategory('All'); setFilterReceipt('All'); setFilterThankYou('All') }

  useEffect(() => { setPage(0) }, [searchTerm, filterCategory, filterReceipt, filterThankYou, sortBy, sortDir])
  useEffect(() => { setEditingNotesId(null); setShowVoidModal(false); setVoidReason(''); setEditingImpactNoteId(null) }, [selectedGiftId])
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const paginated = filtered.slice(page * perPage, (page + 1) * perPage)

  return (
    <div style={s.content}>
      <div style={s.pageHeader}>
        <div>
          <div style={s.pageTitle}>In-Kind Gifts</div>
          <div style={s.pageSub}>{inKindDonations.length} logged · ${totalValue.toLocaleString()} estimated value — not counted in cash revenue totals</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {canEdit && pendingReceiptCount > 0 && <button style={s.btnForest} onClick={issueAllInKindReceipts} disabled={bulkInKindActionInProgress}>{bulkInKindActionInProgress ? '⏳ Issuing...' : `🧾 Issue All Pending (${pendingReceiptCount})`}</button>}
          {canEdit && <button style={s.btnGold} onClick={() => setShowInKindForm(true)}>+ Log In-Kind Gift</button>}
        </div>
      </div>

      <div style={{ background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 4, padding: '10px 14px', marginBottom: 20, fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
        🎁 Donated goods, services, or venue space instead of cash — meals, transport, printing, pro-bono legal work, event space, and similar. These are tracked separately from cash donations and never affect your revenue totals, receipt numbers, or (for IPCs) tax deduction reporting.
      </div>

      {showInKindForm && (
        <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={closeInKindForm}>
          <div style={{ background: C.white, borderRadius: 8, padding: isMobile ? 20 : 24, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.forest }}>{editingInKindId ? 'Edit In-Kind Gift' : 'Log In-Kind Gift'}</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, cursor: 'pointer' }} onClick={closeInKindForm}>✕</button>
            </div>

            {inKindError && <div style={{ background: C.warningBg, color: C.warning, padding: '10px 14px', borderRadius: 4, fontSize: 13, marginBottom: 14 }}>{inKindError}</div>}

            {(() => {
              const editingItem = editingInKindId ? inKindDonations.find(d => d.id === editingInKindId) : null
              const receiptLocked = !!editingItem?.receipt_issued
              return <>
              {receiptLocked && (
                <div style={{ background: '#FBF3DE', color: C.gold, padding: '10px 14px', borderRadius: 4, fontSize: 12.5, marginBottom: 14, lineHeight: 1.5 }}>
                  A receipt has already been issued for this gift, so the acknowledged details are locked. Only Notes can be edited here — use "Void &amp; Reissue Receipt" to correct the gift details.
                </div>
              )}

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.forest, cursor: receiptLocked ? 'default' : 'pointer', marginBottom: 8, opacity: receiptLocked ? 0.6 : 1 }}>
                <input type="checkbox" disabled={receiptLocked} checked={inKindForm.is_anonymous} onChange={e => setInKindForm((f: any) => ({ ...f, is_anonymous: e.target.checked }))} />
                Anonymous donor
              </label>
              <div style={s.formLabel}>{inKindForm.is_anonymous ? 'Donor Name (not recorded)' : 'Donor Name *'}</div>
              <input style={s.formInput} disabled={inKindForm.is_anonymous || receiptLocked} placeholder="Full name or organisation" value={inKindForm.donor_name} onChange={e => setInKindForm((f: any) => ({ ...f, donor_name: e.target.value }))} />
            </div>

            {!inKindForm.is_anonymous && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={s.formLabel}>Donor Email</div>
                  <input style={s.formInput} type="email" disabled={receiptLocked} value={inKindForm.donor_email} onChange={e => setInKindForm((f: any) => ({ ...f, donor_email: e.target.value }))} />
                </div>
                <div>
                  <div style={s.formLabel}>Donor Phone</div>
                  <input style={s.formInput} type="tel" disabled={receiptLocked} placeholder="+65 9123 4567" value={inKindForm.donor_phone} onChange={e => setInKindForm((f: any) => ({ ...f, donor_phone: e.target.value }))} />
                </div>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <div style={s.formLabel}>Category *</div>
              <select style={s.formInput} disabled={receiptLocked} value={inKindForm.category} onChange={e => setInKindForm((f: any) => ({ ...f, category: e.target.value }))}>
                {Object.entries(CATEGORY_LABELS).map(([key, v]) => <option key={key} value={key}>{v.icon} {v.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={s.formLabel}>What was donated? *</div>
              <textarea style={{ ...s.formInput, minHeight: 60, resize: 'vertical' }} disabled={receiptLocked} placeholder="e.g. 200 packed meals for patient families" value={inKindForm.item_description} onChange={e => setInKindForm((f: any) => ({ ...f, item_description: e.target.value }))} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={s.formLabel}>Estimated Value (SGD) *</div>
                <input style={s.formInput} type="number" disabled={receiptLocked} placeholder="0.00" value={inKindForm.estimated_value} onChange={e => setInKindForm((f: any) => ({ ...f, estimated_value: e.target.value }))} />
              </div>
              <div>
                <div style={s.formLabel}>Date Received *</div>
                <input style={s.formInput} type="date" disabled={receiptLocked} max={new Date().toISOString().split('T')[0]} value={inKindForm.received_date} onChange={e => setInKindForm((f: any) => ({ ...f, received_date: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={s.formLabel}>Linked Programme / Campaign</div>
              <select style={s.formInput} disabled={receiptLocked} value={inKindForm.cause_id} onChange={e => setInKindForm((f: any) => ({ ...f, cause_id: e.target.value }))}>
                <option value="">None — general use</option>
                {myCauses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={s.formLabel}>Condition</div>
                <select style={s.formInput} disabled={receiptLocked} value={inKindForm.condition} onChange={e => setInKindForm((f: any) => ({ ...f, condition: e.target.value }))}>
                  <option value="">Not specified</option>
                  <option value="New">New</option>
                  <option value="Used - Good Condition">Used - Good Condition</option>
                  <option value="Used - Fair Condition">Used - Fair Condition</option>
                </select>
              </div>
              <div>
                <div style={s.formLabel}>Valuation Basis</div>
                <input style={s.formInput} disabled={receiptLocked} placeholder="e.g. Retail price, donor-quoted" value={inKindForm.valuation_basis} onChange={e => setInKindForm((f: any) => ({ ...f, valuation_basis: e.target.value }))} />
              </div>
            </div>
              </>
            })()}

            <div style={{ marginBottom: 16 }}>
              <div style={s.formLabel}>Notes</div>
              <textarea style={{ ...s.formInput, minHeight: 50, resize: 'vertical' }} value={inKindForm.notes} onChange={e => setInKindForm((f: any) => ({ ...f, notes: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={s.btnForest} disabled={savingInKind} onClick={saveInKindDonation}>{savingInKind ? 'Saving...' : editingInKindId ? 'Save Changes' : 'Log Gift'}</button>
              <button style={s.viewBtn} onClick={closeInKindForm}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {bulkInKindProgress && (
        <div style={{ background: C.forest, borderRadius: 4, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'white', flexShrink: 0 }}>
            Issuing {bulkInKindProgress.done} of {bulkInKindProgress.total}...
          </span>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.2)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
            <div style={{ width: `${(bulkInKindProgress.done / bulkInKindProgress.total) * 100}%`, height: '100%', background: C.gold, borderRadius: 3, transition: 'width 0.2s' }} />
          </div>
          <button
            style={{ ...s.bannerBtn, background: 'white', color: C.red, flexShrink: 0 }}
            onClick={() => { bulkInKindCancelRef.current = true }}
          >✕ Cancel</button>
        </div>
      )}

      <div style={isMobile ? { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 } : { display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <input style={isMobile ? s.searchBox : { ...s.searchBox, flex: 'none', width: 280 }} placeholder="🔍 Search donor, item, cause, or notes..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            {isMobile && (
              <button style={{ ...s.viewBtn, width: '100%', justifyContent: 'center' }} onClick={() => setShowFilters(v => !v)}>{showFilters ? '▾ Hide Filters' : '▸ Filters & Export'}</button>
            )}
            {(!isMobile || showFilters) && (<>
            <select style={isMobile ? { ...s.filterSelect, flex: 1, minWidth: 100 } : s.filterSelect} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="All">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([key, v]) => <option key={key} value={key}>{v.icon} {v.label}</option>)}
            </select>
            <select style={isMobile ? { ...s.filterSelect, flex: 1, minWidth: 100 } : s.filterSelect} value={filterReceipt} onChange={e => setFilterReceipt(e.target.value)}>
              <option value="All">Receipt: All</option>
              <option value="Issued">✓ Issued</option>
              <option value="Pending">Pending</option>
            </select>
            <select style={isMobile ? { ...s.filterSelect, flex: 1, minWidth: 100 } : s.filterSelect} value={filterThankYou} onChange={e => setFilterThankYou(e.target.value)}>
              <option value="All">Thank You: All</option>
              <option value="Sent">💌 Sent</option>
              <option value="Not Sent">Not Sent (has email)</option>
              <option value="No Email">No Email on File</option>
            </select>
            <button style={isMobile ? { ...s.exportSmallBtn, width: '100%' } : s.exportSmallBtn} onClick={exportInKindExcel}>⬇️ Export to Excel</button>
            {activeFilterCount > 0 && (
              <button style={{ ...s.viewBtn, whiteSpace: 'nowrap' }} onClick={clearFilters}>✕ Clear Filters ({activeFilterCount})</button>
            )}
            </>)}
          </div>

          <div style={s.tableCard}>
            <div style={s.tableHeader}>
              <div style={s.tableTitle}>All In-Kind Gifts</div>
              <div style={s.tableCount}>{filtered.length > perPage ? `${paginated.length} of ${filtered.length} records` : `${filtered.length} records`}</div>
            </div>

            {inKindDonations.length === 0 && activeFilterCount === 0 ? (
              <EmptyState
                icon="🎁"
                title="No in-kind gifts logged yet"
                description="Donated goods, services, or venue space you've received will show up here — tracked separately from cash donations."
                ctaLabel={canEdit ? '+ Log In-Kind Gift' : undefined}
                onCta={canEdit ? () => setShowInKindForm(true) : undefined}
              />
            ) : filtered.length === 0 ? (
              <div style={s.empty}>
                No in-kind gifts found matching your filters.
                <div style={{ marginTop: 10 }}>
                  <button style={s.viewBtn} onClick={clearFilters}>✕ Clear Filters</button>
                </div>
              </div>
            ) : (isMobile || isTablet) ? (
              <div>
                {paginated.map(item => {
                  const cat = CATEGORY_LABELS[item.category] || CATEGORY_LABELS.other
                  const cause = causeNameFor(item)
                  const noThankYouExpected = item.is_anonymous || !item.donor_email?.trim()
                  const railColor = (noThankYouExpected || item.thank_you_sent) ? C.sage : C.gold
                  return (
                    <div key={item.id} style={{ display: 'flex', gap: 8, padding: '12px 16px 12px 10px', borderBottom: `1px solid ${C.ivoryDark}`, cursor: 'pointer' }} onClick={() => setSelectedGiftId(item.id)}>
                      <div style={{ width: 4, borderRadius: 4, background: railColor, alignSelf: 'stretch', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <div style={{ ...s.donorAvatar, background: C.gold, flexShrink: 0 }}>{cat.icon}</div>
                            <div style={{ minWidth: 0 }}>
                              <div style={s.donorName}>{item.donor_name}</div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{new Date(item.received_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })} · {cat.label}</div>
                            </div>
                          </div>
                          <div style={{ ...s.amountText, fontSize: 15, flexShrink: 0 }}>${Number(item.estimated_value).toLocaleString()}</div>
                        </div>
                        <div style={{ marginTop: 8, marginLeft: 42 }}>
                          <div style={{ fontSize: 12.5, color: C.text, marginBottom: 6 }}>{item.item_description}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                            {cause ? <span style={{ fontSize: 10, fontWeight: 500, color: C.gold, background: C.warningBg, padding: '3px 9px', borderRadius: 20 }}>🎯 {cause}</span> : <span style={{ fontSize: 10, color: C.muted, background: C.ivoryDark, padding: '3px 9px', borderRadius: 20 }}>General</span>}
                            {item.receipt_issued ? <span style={s.badgeIssued}>🧾 {item.receipt_number}</span> : <span style={s.badgePending}>Receipt pending</span>}
                            {item.thank_you_sent ? <span style={s.badgeIssued}>💌 Thanked</span> : noThankYouExpected ? <span style={{ fontSize: 10, color: C.muted, fontStyle: 'italic' }}>No email on file</span> : <span style={s.badgePending}>Not thanked</span>}
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
                    {[{ key: 'name', label: 'Donor' }, ...orderedColumns].map(h => (
                      <th
                        key={h.key}
                        draggable={h.key !== 'name'}
                        onDragStart={() => setDraggedColumn(h.key)}
                        onDragOver={e => { if (h.key !== 'name') e.preventDefault() }}
                        onDrop={e => { e.preventDefault(); reorderColumn(draggedColumn, h.key); setDraggedColumn(null) }}
                        onDragEnd={() => setDraggedColumn(null)}
                        style={{ ...s.th, cursor: h.key === 'name' ? 'pointer' : 'grab', userSelect: 'none', width: h.key === 'name' ? 220 : undefined, opacity: draggedColumn === h.key ? 0.4 : 1 }}
                        onClick={() => {
                          const sortKey = h.key === 'name' ? 'donor' : h.key
                          if (sortBy === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                          else { setSortBy(sortKey); setSortDir('desc') }
                        }}
                        title={h.key !== 'name' ? 'Drag to reorder · click to sort' : undefined}
                      >
                        {h.label}{sortBy === (h.key === 'name' ? 'donor' : h.key) ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(item => {
                    const cat = CATEGORY_LABELS[item.category] || CATEGORY_LABELS.other
                    const cause = causeNameFor(item)
                    const noThankYouExpected = item.is_anonymous || !item.donor_email?.trim()
                    const railColor = (noThankYouExpected || item.thank_you_sent) ? C.sage : C.gold
                    const rowBg = selectedGiftId === item.id ? C.successBg : 'transparent'
                    const cellRenderers: Record<string, ReactNode> = {
                      category: <td key="category" style={s.td}><span style={{ fontSize: 10, fontWeight: 500, color: C.forest, background: C.ivoryDark, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>{cat.icon} {cat.label}</span></td>,
                      item: <td key="item" style={s.td}><span style={{ fontSize: 12.5, color: C.text, display: 'block', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.item_description}>{item.item_description}</span></td>,
                      cause: (
                        <td key="cause" style={s.td}>
                          {cause ? (
                            <span style={{ fontSize: 10, fontWeight: 500, color: C.gold, background: C.warningBg, padding: '3px 10px', borderRadius: 20, display: 'inline-block', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cause}>🎯 {cause}</span>
                          ) : (
                            <span style={{ fontSize: 11, color: C.muted }}>General</span>
                          )}
                        </td>
                      ),
                      date: <td key="date" style={s.td}><span style={s.dateText}>{new Date(item.received_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</span></td>,
                      value: <td key="value" style={s.td}><span style={s.amountText}>${Number(item.estimated_value).toLocaleString()}</span></td>,
                      receipt: <td key="receipt" style={s.td}>{item.receipt_issued ? <span style={s.badgeIssued}>✓ {item.receipt_number}</span> : <span style={s.badgePending}>Pending</span>}</td>,
                      thankYou: (
                        <td key="thankYou" style={s.td}>
                          {item.thank_you_sent ? <span style={s.badgeIssued}>💌 Sent</span> : noThankYouExpected ? <span style={{ fontSize: 10, color: C.muted, fontStyle: 'italic' }}>No email</span> : <span style={s.badgePending}>Not sent</span>}
                        </td>
                      ),
                    }
                    return (
                      <tr key={item.id} style={{ ...s.tr, background: rowBg, borderLeft: `3px solid ${railColor}`, cursor: 'pointer' }} onClick={() => setSelectedGiftId(item.id)}>
                        <td style={s.td}>
                          <div style={s.donorCell}>
                            <div style={{ ...s.donorAvatar, background: C.gold }}>{cat.icon}</div>
                            <div>
                              <div style={s.donorName}>{item.donor_name}</div>
                              {item.notes && <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', marginTop: 2 }}>📝 {item.notes}</div>}
                            </div>
                          </div>
                        </td>
                        {orderedColumns.map(o => cellRenderers[o.key])}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {filtered.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: `1px solid ${C.border}`, flexWrap: 'wrap', gap: 10 }}>
                <select style={{ ...s.filterSelect, padding: '6px 10px', fontSize: 12 }} value={perPage} onChange={e => { setPerPage(parseInt(e.target.value)); setPage(0) }}>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    style={{ ...s.viewBtn, opacity: page === 0 ? 0.4 : 1, cursor: page === 0 ? 'not-allowed' : 'pointer' }}
                    disabled={page === 0}
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                  >← Previous</button>
                  <span style={{ fontSize: 12, color: C.muted }}>Page {page + 1} of {totalPages}</span>
                  <button
                    style={{ ...s.viewBtn, opacity: page >= totalPages - 1 ? 0.4 : 1, cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer' }}
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  >Next →</button>
                </div>
              </div>
            )}
          </div>

      {selectedGift && (
        <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 24 }} onClick={() => setSelectedGiftId(null)}>
          <div style={isMobile ? { background: C.white, width: '100%', height: '100%', overflowY: 'auto' } : { width: 900, maxWidth: '100%', borderRadius: 8 }} onClick={e => e.stopPropagation()}>
            <div style={isMobile ? { background: C.white, minHeight: '100%', padding: 20 } : { background: C.white, borderRadius: 8, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 24 }}>
              {(() => {
                const item = selectedGift
                const cat = CATEGORY_LABELS[item.category] || CATEGORY_LABELS.other
                const cause = causeNameFor(item)
                const noThankYouExpected = item.is_anonymous || !item.donor_email?.trim()
                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{cat.icon}</div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>In-Kind Gift</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{item.donor_name}</div>
                        </div>
                      </div>
                      <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => setSelectedGiftId(null)}>✕</button>
                    </div>

                    <div style={{ background: C.forest, borderRadius: 14, padding: '20px 22px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                      <div>
                        <div style={{ fontSize: 34, fontWeight: 800, color: 'white', lineHeight: 1 }}>${Number(item.estimated_value).toLocaleString()}</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>{new Date(item.received_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })} · Est. value, not counted as cash</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                        <span style={{ fontSize: 11, fontWeight: 500, color: 'white', background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: 20 }}>{cat.icon} {cat.label}</span>
                        {item.receipt_issued ? (
                          <span style={{ fontSize: 11, fontWeight: 500, color: C.sage, background: C.successBg, padding: '4px 10px', borderRadius: 20 }}>Receipted</span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 500, color: C.warning, background: C.warningBg, padding: '4px 10px', borderRadius: 20 }}>Receipt pending</span>
                        )}
                        {item.thank_you_sent ? (
                          <span style={{ fontSize: 11, fontWeight: 500, color: C.sage, background: C.successBg, padding: '4px 10px', borderRadius: 20 }}>💌 Thanked</span>
                        ) : noThankYouExpected ? (
                          <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: 20 }}>No email on file</span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 500, color: C.warning, background: C.warningBg, padding: '4px 10px', borderRadius: 20 }}>Not thanked</span>
                        )}
                      </div>
                    </div>

                    <div style={{ overflowY: 'auto', flex: 1, display: 'flex', gap: 24, flexDirection: isMobile ? 'column' : 'row' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Gift Details</div>
                        <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: '4px 16px', marginBottom: 16 }}>
                          {([
                            ['Item', item.item_description, false],
                            ['Cause', cause || 'General', false],
                            ...(item.condition ? [['Condition', item.condition, false]] : []),
                            ...(item.valuation_basis ? [['Valuation Basis', item.valuation_basis, false]] : []),
                            ...(item.receipt_issued ? [['Receipt No.', item.receipt_number, true]] : []),
                            ...(item.reissued_from ? [['Reissued from', item.reissued_from, false]] : []),
                          ] as [string, string, boolean][]).map(([label, value, emphasize], i, arr) => (
                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < arr.length - 1 ? `1px solid ${C.ivoryDark}` : undefined }}>
                              <span style={{ fontSize: 13, color: C.muted }}>{label}</span>
                              <span style={{ fontSize: 13, fontWeight: emphasize ? 700 : 500, color: emphasize ? C.forest : C.text, textAlign: 'right', maxWidth: 280, fontFamily: label === 'Reissued from' ? 'monospace' : undefined }}>{value}</span>
                            </div>
                          ))}
                        </div>

                        {!item.is_anonymous && (
                          <>
                            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Donor</div>
                            <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: '4px 16px', marginBottom: 16 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                                <span style={{ fontSize: 13, color: C.muted }}>Email</span>
                                <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{item.donor_email || '—'}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                                <span style={{ fontSize: 13, color: C.muted }}>Phone</span>
                                <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{item.donor_phone || '—'}</span>
                              </div>
                            </div>
                          </>
                        )}

                        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Photo</div>
                        <div style={{ marginBottom: 16 }}>
                          {item.photo_url ? (
                            <div>
                              <img src={item.photo_url} alt="Gift-in-kind" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 8 }} />
                              {canEdit && (
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <label style={{ ...s.viewBtn, flex: 1, textAlign: 'center', cursor: 'pointer' }}>
                                    {uploadingInKindPhotoId === item.id ? 'Uploading...' : 'Replace Photo'}
                                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadInKindPhoto(item, f) }} />
                                  </label>
                                  <button style={{ ...s.viewBtn, color: C.red, borderColor: C.red, flex: 1 }} onClick={() => removeInKindPhoto(item)}>Remove</button>
                                </div>
                              )}
                            </div>
                          ) : canEdit ? (
                            <label style={{ ...s.viewBtn, display: 'block', textAlign: 'center', cursor: 'pointer' }}>
                              {uploadingInKindPhotoId === item.id ? 'Uploading...' : '📷 Add Photo'}
                              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadInKindPhoto(item, f) }} />
                            </label>
                          ) : (
                            <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No photo on file.</div>
                          )}
                        </div>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Notes</div>
                        {canEdit && editingNotesId === item.id ? (
                          <div style={{ marginBottom: 20 }}>
                            <textarea style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.sage}`, borderRadius: 10, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: C.white, color: C.text, boxSizing: 'border-box', resize: 'vertical', minHeight: 80 }}
                              value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..." autoFocus />
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                              <button style={{ ...s.issueBtn, flex: 1 }} onClick={() => { updateInKindNotes(item, noteText); setEditingNotesId(null) }}>Save</button>
                              <button style={{ ...s.viewBtn, flex: 1 }} onClick={() => setEditingNotesId(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div style={canEdit ? { background: C.white, borderRadius: 12, padding: '14px 16px', border: `1px dashed ${C.border}`, cursor: 'pointer', minHeight: 20, marginBottom: 20 } : { background: C.white, borderRadius: 12, padding: '14px 16px', border: `1px solid ${C.border}`, minHeight: 20, marginBottom: 20 }}
                            onClick={canEdit ? () => { setEditingNotesId(item.id); setNoteText(item.notes || '') } : undefined}>
                            {item.notes
                              ? <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{item.notes}</div>
                              : <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>{canEdit ? 'Click to add a note...' : 'No notes recorded.'}</div>
                            }
                          </div>
                        )}

                        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Impact Note</div>
                        {canEdit && editingImpactNoteId === item.id ? (
                          <div style={{ marginBottom: 20 }}>
                            <textarea style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.gold}`, borderRadius: 10, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: C.white, color: C.text, boxSizing: 'border-box', resize: 'vertical', minHeight: 60 }}
                              value={impactNoteText} onChange={e => setImpactNoteText(e.target.value)} placeholder="e.g. These meals fed 40 families in patient housing this month." autoFocus />
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                              <button style={{ ...s.issueBtn, flex: 1 }} onClick={() => { updateInKindImpactNote(item, impactNoteText); setEditingImpactNoteId(null) }}>Save</button>
                              <button style={{ ...s.viewBtn, flex: 1 }} onClick={() => setEditingImpactNoteId(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div style={canEdit ? { background: C.warningBg, borderRadius: 12, padding: '14px 16px', border: `1px dashed ${C.warningBorder}`, cursor: 'pointer', minHeight: 20, marginBottom: 20 } : { background: C.warningBg, borderRadius: 12, padding: '14px 16px', border: `1px solid ${C.warningBorder}`, minHeight: 20, marginBottom: 20 }}
                            onClick={canEdit ? () => { setEditingImpactNoteId(item.id); setImpactNoteText(item.impact_note || '') } : undefined}>
                            {item.impact_note
                              ? <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>🎯 {item.impact_note}</div>
                              : <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>{canEdit ? 'Click to describe what this gift funded...' : 'No impact note recorded.'}</div>
                            }
                          </div>
                        )}

                        {canEdit && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {item.receipt_issued ? (
                              <>
                                <button style={{ ...s.viewBtn, justifyContent: 'center' }} onClick={() => exportInKindReceiptPDF(item)}>⬇️ Download Receipt PDF</button>
                                <button style={{ ...s.viewBtn, color: C.red, borderColor: C.red, justifyContent: 'center' }} onClick={() => { setShowVoidModal(true); setVoidReason('') }}>🚫 Void & Reissue Receipt</button>
                              </>
                            ) : (
                              <button style={{ ...s.btnForest, justifyContent: 'center' }} disabled={issuingInKindReceiptId === item.id} onClick={() => issueInKindReceipt(item)}>{issuingInKindReceiptId === item.id ? '⏳ Issuing...' : '🧾 Issue Receipt'}</button>
                            )}
                            {item.donor_email?.trim() ? (
                              <button style={{ ...s.btnGold, justifyContent: 'center' }} onClick={() => toggleInKindThankYou(item)}>
                                {item.thank_you_sent ? '💌 Resend Thank You' : '💌 Send Thank You'}
                              </button>
                            ) : (
                              <button style={{ ...s.viewBtn, justifyContent: 'center' }} onClick={() => toggleInKindThankYou(item)}>
                                {item.thank_you_sent ? '↺ Unmark as Thanked' : '✓ Mark as Thanked'}
                              </button>
                            )}
                            <button style={{ ...s.viewBtn, justifyContent: 'center' }} onClick={() => { setSelectedGiftId(null); startEditingInKind(item) }}>✏️ Edit Entry</button>
                            <button style={{ ...s.viewBtn, color: C.red, borderColor: C.red, justifyContent: 'center' }} onClick={() => { setSelectedGiftId(null); deleteInKindDonation(item) }}>🗑️ Delete Entry</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {showVoidModal && selectedGift && (
        <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setShowVoidModal(false)}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.red, marginBottom: 4 }}>Void & Reissue Receipt</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
              The original receipt number <strong style={{ fontFamily: 'monospace' }}>{selectedGift.receipt_number}</strong> will be marked as voided and kept on record. A new corrected receipt will be issued with the next sequential number.
            </div>
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: C.muted }}>Donor</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: C.forest }}>{selectedGift.donor_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: C.muted }}>Estimated Value</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: C.forest }}>${Number(selectedGift.estimated_value).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: C.muted }}>Current Receipt No.</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: C.forest, fontFamily: 'monospace' }}>{selectedGift.receipt_number}</span>
              </div>
            </div>
            <label style={{ display: 'block' }}>
              <div style={s.formLabel}>Reason for voiding *</div>
              <input
                style={{ ...s.formInput, marginBottom: 16 }}
                placeholder="e.g. Wrong value entered, donor name misspelled"
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
                disabled={!voidReason.trim() || voidingInKindReceipt}
                onClick={async () => { await voidAndReissueInKindReceipt(selectedGift, voidReason); setShowVoidModal(false); setVoidReason('') }}
              >{voidingInKindReceipt ? '⏳ Processing...' : 'Void & Reissue'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
