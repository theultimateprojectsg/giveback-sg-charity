import { C } from '../theme'
import { s } from '../styles'

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
}

const CATEGORY_LABELS: Record<string, { icon: string, label: string }> = {
  goods: { icon: '📦', label: 'Goods' },
  services: { icon: '🛠️', label: 'Services' },
  venue: { icon: '🏛️', label: 'Venue / Space' },
  professional_services: { icon: '💼', label: 'Professional Services' },
  other: { icon: '🎁', label: 'Other' },
}

export function InKindDonationsPage({
  isMobile, userRole, inKindDonations, myCauses,
  showInKindForm, setShowInKindForm, editingInKindId, inKindForm, setInKindForm, inKindError, savingInKind,
  saveInKindDonation, closeInKindForm, startEditingInKind, deleteInKindDonation, toggleInKindThankYou, exportInKindExcel,
}: InKindDonationsPageProps) {
  const totalValue = inKindDonations.reduce((sum, d) => sum + Number(d.estimated_value), 0)
  const canEdit = userRole === 'staff' || userRole === 'ed'

  return (
    <div style={s.content}>
      <div style={s.pageHeader}>
        <div>
          <div style={s.pageTitle}>In-Kind Gifts</div>
          <div style={s.pageSub}>{inKindDonations.length} logged · ${totalValue.toLocaleString()} estimated value — not counted in cash revenue totals</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {inKindDonations.length > 0 && <button style={s.viewBtn} onClick={exportInKindExcel}>⬇️ Export to Excel</button>}
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

      {inKindDonations.length === 0 ? (
        <div style={{ ...s.card, textAlign: 'center', padding: 40, color: C.muted, fontSize: 13 }}>
          No in-kind gifts logged yet — donated goods, services, or venue space you've received will show up here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {inKindDonations.map(item => {
            const cat = CATEGORY_LABELS[item.category] || CATEGORY_LABELS.other
            const cause = item.cause_id ? myCauses.find(c => c.id === item.cause_id) : null
            return (
              <div key={item.id} style={{ ...s.card, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 14, alignItems: isMobile ? 'flex-start' : 'center' }}>
                <div style={{ fontSize: 22, flexShrink: 0 }}>{cat.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: C.forest }}>{item.donor_name}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 500, padding: '2px 7px', borderRadius: 4, background: C.ivoryDark, color: C.muted }}>{cat.label}</span>
                    {cause && <span style={{ fontSize: 10.5, fontWeight: 500, padding: '2px 7px', borderRadius: 4, background: C.teal + '1A', color: C.teal }}>🎯 {cause.title}</span>}
                    {item.thank_you_sent && <span style={{ fontSize: 10.5, color: C.sage }}>💌 Thanked</span>}
                  </div>
                  <div style={{ fontSize: 13, color: C.text, marginTop: 3 }}>{item.item_description}</div>
                  {item.notes && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2, fontStyle: 'italic' }}>{item.notes}</div>}
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{new Date(item.received_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </div>
                <div style={{ textAlign: isMobile ? 'left' : 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: C.fontVoice, fontSize: 17, fontWeight: 500, color: C.forest }}>${Number(item.estimated_value).toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>est. value</div>
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} onClick={() => toggleInKindThankYou(item)}>{item.thank_you_sent ? '↺ Unmark' : '💌 Thanked'}</button>
                    <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} onClick={() => startEditingInKind(item)}>✏️ Edit</button>
                    <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', color: C.red, borderColor: C.red }} onClick={() => deleteInKindDonation(item)}>✕</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
