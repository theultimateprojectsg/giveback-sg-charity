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
}

const CATEGORY_LABELS: Record<string, { icon: string, label: string }> = {
  goods: { icon: '📦', label: 'Goods' },
  services: { icon: '🛠️', label: 'Services' },
  venue: { icon: '🏛️', label: 'Venue / Space' },
  professional_services: { icon: '💼', label: 'Professional Services' },
  other: { icon: '🎁', label: 'Other' },
}

export function InKindDonationsPage({
  isMobile, isTablet, userRole, inKindDonations, myCauses,
  showInKindForm, setShowInKindForm, editingInKindId, inKindForm, setInKindForm, inKindError, savingInKind,
  saveInKindDonation, closeInKindForm, startEditingInKind, deleteInKindDonation, toggleInKindThankYou, exportInKindExcel,
  updateInKindNotes,
}: InKindDonationsPageProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('All')
  const [filterThankYou, setFilterThankYou] = useState('All')
  const [selectedGiftId, setSelectedGiftId] = useState<number | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [editingNotesId, setEditingNotesId] = useState<number | null>(null)
  const [noteText, setNoteText] = useState('')
  const [perPage, setPerPage] = useState(25)
  const [page, setPage] = useState(0)

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
      .filter(d => {
        if (filterThankYou === 'All') return true
        const noThankYouExpected = d.is_anonymous || !d.donor_email?.trim()
        if (filterThankYou === 'Sent') return !!d.thank_you_sent
        if (filterThankYou === 'Not Sent') return !d.thank_you_sent && !noThankYouExpected
        if (filterThankYou === 'No Email') return noThankYouExpected
        return true
      })
      .filter(d => !term || [d.donor_name, d.item_description, d.notes, causeNameFor(d)].filter(Boolean).some(v => String(v).toLowerCase().includes(term)))
      .sort((a, b) => new Date(b.received_date).getTime() - new Date(a.received_date).getTime())
  }, [inKindDonations, searchTerm, filterCategory, filterThankYou, myCauses])

  const activeFilterCount = (filterCategory !== 'All' ? 1 : 0) + (filterThankYou !== 'All' ? 1 : 0) + (searchTerm.trim() ? 1 : 0)
  const clearFilters = () => { setSearchTerm(''); setFilterCategory('All'); setFilterThankYou('All') }

  useEffect(() => { setPage(0) }, [searchTerm, filterCategory, filterThankYou])
  useEffect(() => { setEditingNotesId(null) }, [selectedGiftId])
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

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.forest, cursor: 'pointer', marginBottom: 8 }}>
                <input type="checkbox" checked={inKindForm.is_anonymous} onChange={e => setInKindForm((f: any) => ({ ...f, is_anonymous: e.target.checked }))} />
                Anonymous donor
              </label>
              <div style={s.formLabel}>{inKindForm.is_anonymous ? 'Donor Name (not recorded)' : 'Donor Name *'}</div>
              <input style={s.formInput} disabled={inKindForm.is_anonymous} placeholder="Full name or organisation" value={inKindForm.donor_name} onChange={e => setInKindForm((f: any) => ({ ...f, donor_name: e.target.value }))} />
            </div>

            {!inKindForm.is_anonymous && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={s.formLabel}>Donor Email</div>
                  <input style={s.formInput} type="email" value={inKindForm.donor_email} onChange={e => setInKindForm((f: any) => ({ ...f, donor_email: e.target.value }))} />
                </div>
                <div>
                  <div style={s.formLabel}>Donor Phone</div>
                  <input style={s.formInput} type="tel" placeholder="+65 9123 4567" value={inKindForm.donor_phone} onChange={e => setInKindForm((f: any) => ({ ...f, donor_phone: e.target.value }))} />
                </div>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <div style={s.formLabel}>Category *</div>
              <select style={s.formInput} value={inKindForm.category} onChange={e => setInKindForm((f: any) => ({ ...f, category: e.target.value }))}>
                {Object.entries(CATEGORY_LABELS).map(([key, v]) => <option key={key} value={key}>{v.icon} {v.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={s.formLabel}>What was donated? *</div>
              <textarea style={{ ...s.formInput, minHeight: 60, resize: 'vertical' }} placeholder="e.g. 200 packed meals for patient families" value={inKindForm.item_description} onChange={e => setInKindForm((f: any) => ({ ...f, item_description: e.target.value }))} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={s.formLabel}>Estimated Value (SGD) *</div>
                <input style={s.formInput} type="number" placeholder="0.00" value={inKindForm.estimated_value} onChange={e => setInKindForm((f: any) => ({ ...f, estimated_value: e.target.value }))} />
              </div>
              <div>
                <div style={s.formLabel}>Date Received *</div>
                <input style={s.formInput} type="date" max={new Date().toISOString().split('T')[0]} value={inKindForm.received_date} onChange={e => setInKindForm((f: any) => ({ ...f, received_date: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={s.formLabel}>Linked Programme / Campaign</div>
              <select style={s.formInput} value={inKindForm.cause_id} onChange={e => setInKindForm((f: any) => ({ ...f, cause_id: e.target.value }))}>
                <option value="">None — general use</option>
                {myCauses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>

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
                    <th style={{ ...s.th, width: 220 }}>Donor</th>
                    <th style={s.th}>Category</th>
                    <th style={s.th}>Item</th>
                    <th style={s.th}>Cause</th>
                    <th style={s.th}>Date</th>
                    <th style={s.th}>Est. Value</th>
                    <th style={s.th}>Thank You</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(item => {
                    const cat = CATEGORY_LABELS[item.category] || CATEGORY_LABELS.other
                    const cause = causeNameFor(item)
                    const noThankYouExpected = item.is_anonymous || !item.donor_email?.trim()
                    const railColor = (noThankYouExpected || item.thank_you_sent) ? C.sage : C.gold
                    return (
                      <tr key={item.id} style={{ ...s.tr, borderLeft: `3px solid ${railColor}`, cursor: 'pointer' }} onClick={() => setSelectedGiftId(item.id)}>
                        <td style={s.td}>
                          <div style={s.donorCell}>
                            <div style={{ ...s.donorAvatar, background: C.gold }}>{cat.icon}</div>
                            <div>
                              <div style={s.donorName}>{item.donor_name}</div>
                              {item.notes && <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', marginTop: 2 }}>📝 {item.notes}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={s.td}><span style={{ fontSize: 10, fontWeight: 500, color: C.forest, background: C.ivoryDark, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>{cat.icon} {cat.label}</span></td>
                        <td style={s.td}><span style={{ fontSize: 12.5, color: C.text }} title={item.item_description}>{item.item_description}</span></td>
                        <td style={s.td}>
                          {cause ? (
                            <span style={{ fontSize: 10, fontWeight: 500, color: C.gold, background: C.warningBg, padding: '3px 10px', borderRadius: 20, display: 'inline-block', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cause}>🎯 {cause}</span>
                          ) : (
                            <span style={{ fontSize: 11, color: C.muted }}>General</span>
                          )}
                        </td>
                        <td style={s.td}><span style={s.dateText}>{new Date(item.received_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</span></td>
                        <td style={s.td}><span style={s.amountText}>${Number(item.estimated_value).toLocaleString()}</span></td>
                        <td style={s.td}>
                          {item.thank_you_sent ? <span style={s.badgeIssued}>💌 Sent</span> : noThankYouExpected ? <span style={{ fontSize: 10, color: C.muted, fontStyle: 'italic' }}>No email</span> : <span style={s.badgePending}>Not sent</span>}
                        </td>
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
          <div style={isMobile ? { background: C.white, width: '100%', height: '100%', overflowY: 'auto' } : { width: 560, maxWidth: '100%', borderRadius: 8 }} onClick={e => e.stopPropagation()}>
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
                        {item.thank_you_sent ? (
                          <span style={{ fontSize: 11, fontWeight: 500, color: C.sage, background: C.successBg, padding: '4px 10px', borderRadius: 20 }}>💌 Thanked</span>
                        ) : noThankYouExpected ? (
                          <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: 20 }}>No email on file</span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 500, color: C.warning, background: C.warningBg, padding: '4px 10px', borderRadius: 20 }}>Not thanked</span>
                        )}
                      </div>
                    </div>

                    <div style={{ overflowY: 'auto', flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Gift Details</div>
                      <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: '4px 16px', marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                          <span style={{ fontSize: 13, color: C.muted }}>Item</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: C.text, textAlign: 'right', maxWidth: 280 }}>{item.item_description}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                          <span style={{ fontSize: 13, color: C.muted }}>Cause</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{cause || 'General'}</span>
                        </div>
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

                      {canEdit && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
