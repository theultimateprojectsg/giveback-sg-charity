import { useState } from 'react'
import type { CSSProperties } from 'react'
import { C } from '../../theme'
import { s } from '../../styles'
import type { RecurringGift } from '../../types'

interface RecurringGiftModalProps {
  isMobile?: boolean
  onClose: () => void
  onSave: (form: unknown) => unknown
  gift?: (RecurringGift & { donor_phone?: string, start_date?: string, end_date?: string, type?: string, type_detail?: string, cause_id?: string, bank_name?: string, giro_reference?: string, notes?: string }) | null
  causes: { id: string, title: string }[]
  saving?: boolean
  onCancelGift?: (gift: RecurringGiftModalProps['gift']) => void
}

export function RecurringGiftModal({ isMobile, onClose, onSave, gift, causes, saving, onCancelGift }: RecurringGiftModalProps) {
  const isEditing = !!gift
  const [form, setForm] = useState(() => gift ? {
    donor_name: gift.donor_name || '',
    donor_email: gift.donor_email || '',
    donor_phone: gift.donor_phone || '',
    amount: gift.amount?.toString() || '',
    frequency: gift.frequency || 'monthly',
    start_date: gift.start_date || '',
    end_date: gift.end_date || '',
    type: gift.type || 'giro',
    type_detail: gift.type_detail || '',
    cause_id: gift.cause_id || '',
    bank_name: gift.bank_name || '',
    giro_reference: gift.giro_reference || '',
    authorization_status: gift.authorization_status || 'active',
    notes: gift.notes || '',
  } : { donor_name: '', donor_email: '', donor_phone: '', amount: '', frequency: 'monthly', start_date: '', end_date: '', type: 'giro', type_detail: '', cause_id: '', bank_name: '', giro_reference: '', authorization_status: 'active', notes: '' })
  const [error, setError] = useState('')
  const sectionHeaderStyle: CSSProperties = { fontSize: 10.5, fontWeight: 600, color: C.gold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }
  const dividerStyle: CSSProperties = { borderTop: `1px solid ${C.border}`, marginBottom: 10 }
  const needsBankInfo = form.type === 'giro' || form.type === 'standing_order'
  function handleSave() {
    if (!form.donor_name.trim()) { setError('Donor name is required'); return }
    if (!form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) { setError('Please enter a valid amount'); return }
    if (!form.start_date) { setError('Start date is required'); return }
    if (form.type === 'giro' && !form.giro_reference?.trim()) { setError('GIRO reference / account is required for GIRO gifts'); return }
    if (form.type === 'other' && !form.type_detail?.trim()) { setError('Please describe what "Other" means for this gift'); return }
    setError('')
    onSave(form)
  }
  return (
    <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.forest }}>🔁 {isEditing ? 'Edit Recurring Gift' : 'New Recurring Gift'}</div>
          <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={onClose}>✕</button>
        </div>

        <div style={sectionHeaderStyle}>Donor</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          <label style={{ display: 'block' }}>
            <div style={s.formLabel}>Donor Name *</div>
            <input style={s.formInput} placeholder="Full name" value={form.donor_name} onChange={e => setForm(f => ({ ...f, donor_name: e.target.value }))} />
          </label>
          <label style={{ display: 'block' }}>
            <div style={s.formLabel}>Donor Email</div>
            <input style={s.formInput} type="email" placeholder="donor@email.com" value={form.donor_email} onChange={e => setForm(f => ({ ...f, donor_email: e.target.value }))} />
          </label>
          <label style={{ display: 'block' }}>
            <div style={s.formLabel}>Donor Phone</div>
            <input style={s.formInput} type="tel" placeholder="+65 9123 4567" value={form.donor_phone} onChange={e => setForm(f => ({ ...f, donor_phone: e.target.value }))} />
          </label>
        </div>

        <div style={dividerStyle} />

        <div style={sectionHeaderStyle}>Giving details</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          <label style={{ display: 'block' }}>
            <div style={s.formLabel}>Amount per Cycle (SGD) *</div>
            <input style={s.formInput} type="number" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </label>
          <label style={{ display: 'block' }}>
            <div style={s.formLabel}>Frequency</div>
            <select style={s.formInput} value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annually">Annually</option>
            </select>
          </label>
          <label style={{ display: 'block' }}>
            <div style={s.formLabel}>Start Date *</div>
            <input style={s.formInput} type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
          </label>
          <label style={{ display: 'block' }}>
            <div style={s.formLabel}>End Date</div>
            <input style={s.formInput} type="date" placeholder="Leave blank if ongoing" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
          </label>
          <label style={{ display: 'block' }}>
            <div style={s.formLabel}>Type</div>
            <select style={s.formInput} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="giro">GIRO</option>
              <option value="habitual_paynow">Habitual PayNow</option>
              <option value="standing_order">Standing Order</option>
              <option value="other">Other</option>
            </select>
          </label>
          {form.type === 'other' && (
            <label style={{ display: 'block' }}>
              <div style={{ ...s.formLabel, color: C.red }}>Describe "Other" *</div>
              <input style={s.formInput} placeholder="e.g. Cheque standing arrangement" value={form.type_detail} onChange={e => setForm(f => ({ ...f, type_detail: e.target.value }))} />
            </label>
          )}
          <label style={{ display: 'block', gridColumn: isMobile ? 'auto' : '1 / -1' }}>
            <div style={s.formLabel}>Linked Programme / Campaign</div>
            <select style={s.formInput} value={form.cause_id} onChange={e => setForm(f => ({ ...f, cause_id: e.target.value }))}>
              <option value="">None — general / unrestricted use</option>
              {(causes || []).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </label>
        </div>

        <div style={dividerStyle} />

        <div style={sectionHeaderStyle}>Authorization {!needsBankInfo && <span style={{ color: C.muted, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional for {form.type === 'habitual_paynow' ? 'Habitual PayNow' : 'this type'})</span>}</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          <label style={{ display: 'block' }}>
            <div style={s.formLabel}>Bank Name</div>
            <input style={s.formInput} placeholder="e.g. DBS, OCBC" value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} />
          </label>
          <label style={{ display: 'block' }}>
            <div style={{ ...s.formLabel, color: form.type === 'giro' ? C.red : undefined }}>{form.type === 'giro' ? 'GIRO Reference / Account *' : 'Reference / Account'}</div>
            <input style={s.formInput} placeholder="Optional reference number" value={form.giro_reference} onChange={e => setForm(f => ({ ...f, giro_reference: e.target.value }))} />
          </label>
          <label style={{ display: 'block' }}>
            <div style={s.formLabel}>Authorization Status</div>
            <select style={s.formInput} value={form.authorization_status} onChange={e => setForm(f => ({ ...f, authorization_status: e.target.value }))}>
              <option value="pending">Pending bank approval</option>
              <option value="active">Active</option>
              <option value="terminated">Terminated by bank</option>
            </select>
          </label>
        </div>

        <div style={dividerStyle} />

        <label style={{ display: 'block', marginBottom: 16 }}>
          <div style={s.formLabel}>Notes</div>
          <input style={s.formInput} placeholder="Optional notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </label>

        {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.btnForest} onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Save Recurring Gift')}</button>
          <button style={s.viewBtn} onClick={onClose}>Cancel</button>
          {isEditing && gift.status === 'active' && (
            <button style={{ ...s.viewBtn, color: C.red, borderColor: C.red, marginLeft: 'auto' }} onClick={() => { onCancelGift(gift); onClose() }}>✕ Cancel Gift</button>
          )}
        </div>
      </div>
    </div>
  )
}
