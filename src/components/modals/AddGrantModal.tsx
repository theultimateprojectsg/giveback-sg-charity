import { useState } from 'react'
import type { CSSProperties } from 'react'
import { C } from '../../theme'
import { s } from '../../styles'
import { InfoTip } from '../ui/InfoTip'
import type { Grant } from '../../types'

interface AddGrantModalProps {
  isMobile?: boolean
  onClose: () => void
  onSave: (form: unknown) => unknown
  grant?: (Grant & {
    funder_type?: string, agreement_reference?: string, restricted_amount?: number,
    purpose_restriction?: string, disbursement_schedule?: string, start_date?: string, end_date?: string,
    is_renewable?: boolean, contact_name?: string, contact_email?: string, contact_phone?: string,
    match_ratio?: string, match_cap?: number,
  }) | null
  onDelete?: (grant: AddGrantModalProps['grant']) => void
  causes: { id: string, title: string }[]
  hasExistingClaims?: boolean
}

export function AddGrantModal({ isMobile, onClose, onSave, grant, onDelete, causes, hasExistingClaims }: AddGrantModalProps) {
  const isEditing = !!grant
  const [form, setForm] = useState(() => grant ? {
    funder_name: grant.funder_name || '',
    funder_type: grant.funder_type || '',
    agreement_reference: grant.agreement_reference || '',
    cause_id: grant.cause_id || '',
    unrestricted_amount: grant.unrestricted_amount?.toString() || '',
    restricted_amount: grant.restricted_amount?.toString() || '',
    purpose_restriction: grant.purpose_restriction || '',
    disbursement_schedule: grant.disbursement_schedule || '',
    start_date: grant.start_date || '',
    end_date: grant.end_date || '',
    is_renewable: grant.is_renewable || false,
    contact_name: grant.contact_name || '',
    contact_email: grant.contact_email || '',
    contact_phone: grant.contact_phone || '',
    is_matching: grant.is_matching || false,
    match_ratio: grant.match_ratio || '',
    match_cap: grant.match_cap?.toString() || '',
    status: grant.status || 'active',
  } : { funder_name: '', funder_type: '', agreement_reference: '', cause_id: '', unrestricted_amount: '', restricted_amount: '', purpose_restriction: '', disbursement_schedule: '', start_date: '', end_date: '', is_renewable: false, contact_name: '', contact_email: '', contact_phone: '', is_matching: false, match_ratio: '', match_cap: '', status: 'active' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const hasRestricted = parseFloat(form.restricted_amount) > 0
  const sectionHeaderStyle: CSSProperties = { fontSize: 10.5, fontWeight: 600, color: C.gold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }
  const dividerStyle: CSSProperties = { borderTop: `1px solid ${C.border}`, marginBottom: 10 }
  async function handleSave() {
    if (!form.funder_name.trim()) { setError('Funder name is required'); return }
    if (!form.funder_type) { setError('Funder type is required'); return }
    if (!form.start_date) { setError('Start date is required'); return }
    const unrestricted = parseFloat(form.unrestricted_amount) || 0
    const restricted = parseFloat(form.restricted_amount) || 0
    const matchCap = parseFloat(form.match_cap) || 0
    if (unrestricted < 0 || restricted < 0 || matchCap < 0) { setError('Amounts cannot be negative'); return }
    if (form.end_date && form.end_date < form.start_date) { setError('End date cannot be before start date'); return }
    if (form.is_matching && matchCap <= 0) { setError('Match cap is required for a matching grant'); return }
    if (!form.is_matching && hasExistingClaims) { setError('This grant has matching claims already logged against it — those would become hidden if you turn off "matching grant". Delete the claims first if you really want to unmark it.'); return }
    if (!form.is_matching && (unrestricted + restricted) <= 0) { setError('At least one amount is required'); return }
    if (restricted > 0 && !form.purpose_restriction?.trim()) { setError('Purpose restriction is required when there is a restricted amount'); return }
    setError('')
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }
  return (
    <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 720, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.forest }}>🏛️ {isEditing ? 'Edit Grant' : 'New Grant'}</div>
          <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={onClose}>✕</button>
        </div>

        <div style={sectionHeaderStyle}>Grant details</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          <label style={{ display: 'block' }}>
            <div style={s.formLabel}>Funder Name *</div>
            <input style={s.formInput} value={form.funder_name} onChange={e => setForm(f => ({ ...f, funder_name: e.target.value }))} />
          </label>
          <label style={{ display: 'block' }}>
            <div style={s.formLabel}>Funder Type *</div>
            <select style={s.formInput} value={form.funder_type} onChange={e => setForm(f => ({ ...f, funder_type: e.target.value }))}>
              <option value="">Select...</option>
              <option value="government">Government / statutory board</option>
              <option value="corporate">Corporate foundation</option>
              <option value="trust">Private trust / individual</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label style={{ display: 'block' }}>
            <div style={s.formLabel}>Agreement Reference</div>
            <input style={s.formInput} placeholder="e.g. Letter of Award no." value={form.agreement_reference} onChange={e => setForm(f => ({ ...f, agreement_reference: e.target.value }))} />
          </label>
          <label style={{ display: 'block', gridColumn: isMobile ? 'auto' : '1 / -1' }}>
            <div style={s.formLabel}>Linked Programme / Campaign</div>
            <select style={s.formInput} value={form.cause_id} onChange={e => setForm(f => ({ ...f, cause_id: e.target.value }))}>
              <option value="">None — general / unrestricted use</option>
              {(causes || []).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </label>
        </div>

        <div style={dividerStyle} />

        <div style={sectionHeaderStyle}>Funding</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
          <label style={{ display: 'block' }}>
            <div style={{ ...s.formLabel, display: 'flex', alignItems: 'center', gap: 5 }}>Unrestricted (SGD) <InfoTip text="Funds the funder lets you spend on any programme or overhead, at your discretion." /></div>
            <input style={s.formInput} type="number" placeholder="0" value={form.unrestricted_amount} onChange={e => setForm(f => ({ ...f, unrestricted_amount: e.target.value }))} />
          </label>
          <label style={{ display: 'block' }}>
            <div style={{ ...s.formLabel, display: 'flex', alignItems: 'center', gap: 5 }}>Restricted (SGD) <InfoTip text="Funds the funder requires you to spend only on a specific purpose (see Purpose Restriction below)." /></div>
            <input style={s.formInput} type="number" placeholder="0" value={form.restricted_amount} onChange={e => setForm(f => ({ ...f, restricted_amount: e.target.value }))} />
          </label>
          <label style={{ display: 'block' }}>
            <div style={{ ...s.formLabel, display: 'flex', alignItems: 'center', gap: 5 }}>Disbursement Schedule <InfoTip text="How and when the funder pays out the grant, e.g. in tranches over time rather than as one lump sum." /></div>
            <input style={s.formInput} placeholder="e.g. 3 tranches over 12 months" value={form.disbursement_schedule} onChange={e => setForm(f => ({ ...f, disbursement_schedule: e.target.value }))} />
          </label>
          {hasRestricted && (
            <label style={{ display: 'block', gridColumn: isMobile ? 'auto' : '1 / -1' }}>
              <div style={{ ...s.formLabel, color: C.red, display: 'flex', alignItems: 'center', gap: 5 }}>Purpose Restriction * <InfoTip text="Required whenever there's a restricted amount — describe exactly what the funder will and won't let this money be spent on." /></div>
              <textarea style={{ ...s.formInput, minHeight: 44, resize: 'vertical' }} placeholder="e.g. Must be spent on tutoring program costs, not administrative overhead" value={form.purpose_restriction} onChange={e => setForm(f => ({ ...f, purpose_restriction: e.target.value }))} />
            </label>
          )}
          <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1', display: 'flex', alignItems: 'center', gap: 6, paddingTop: 4 }}>
            <input type="checkbox" id="grant-matching" checked={form.is_matching} onChange={e => setForm(f => ({ ...f, is_matching: e.target.checked }))} />
            <label htmlFor="grant-matching" style={{ fontSize: 12.5, color: C.text, cursor: 'pointer' }}>This is a matching grant (funder matches donations you raise, rather than a fixed award)</label>
          </div>
          {form.is_matching && (
            <>
              <label style={{ display: 'block' }}>
                <div style={{ ...s.formLabel, display: 'flex', alignItems: 'center', gap: 5 }}>Match Ratio <InfoTip text="How much the funder contributes per dollar you raise, e.g. $1:$1 means they match every donor dollar with one of their own." /></div>
                <input style={s.formInput} placeholder="e.g. $1 : $1" value={form.match_ratio} onChange={e => setForm(f => ({ ...f, match_ratio: e.target.value }))} />
              </label>
              <label style={{ display: 'block' }}>
                <div style={{ ...s.formLabel, display: 'flex', alignItems: 'center', gap: 5 }}>Match Cap (SGD) * <InfoTip text="The most the funder will contribute in total, no matter how much more you raise beyond this." /></div>
                <input style={s.formInput} type="number" placeholder="Maximum funder will match" value={form.match_cap} onChange={e => setForm(f => ({ ...f, match_cap: e.target.value }))} />
              </label>
            </>
          )}
        </div>

        <div style={dividerStyle} />

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 16 }}>
          <div>
            <div style={sectionHeaderStyle}>Timeline</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
              <label style={{ display: 'block' }}>
                <div style={s.formLabel}>Start Date *</div>
                <input style={s.formInput} type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </label>
              <label style={{ display: 'block' }}>
                <div style={s.formLabel}>End Date</div>
                <input style={s.formInput} type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" id="grant-renewable" checked={form.is_renewable} onChange={e => setForm(f => ({ ...f, is_renewable: e.target.checked }))} />
              <label htmlFor="grant-renewable" style={{ fontSize: 12.5, color: C.text, cursor: 'pointer' }}>Likely to renew</label>
            </div>
          </div>

          <div>
            <div style={sectionHeaderStyle}>Funder contact</div>
            <label style={{ display: 'block', marginBottom: 8 }}>
              <div style={s.formLabel}>Contact Name</div>
              <input style={s.formInput} value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'block' }}>
                <div style={s.formLabel}>Email</div>
                <input style={s.formInput} type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} />
              </label>
              <label style={{ display: 'block' }}>
                <div style={s.formLabel}>Phone</div>
                <input style={s.formInput} value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
              </label>
            </div>
          </div>
        </div>

        {!isEditing && (
          <div style={{ fontSize: 11.5, color: C.muted, fontStyle: 'italic', marginBottom: 16 }}>Report deadlines and disbursement tranches are added after saving, from the grant's ledger — a grant can have more than one of each.</div>
        )}

        {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.btnForest} disabled={saving} onClick={handleSave}>{saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Save Grant')}</button>
          <button style={s.viewBtn} onClick={onClose}>Cancel</button>
          {isEditing && (
            <button style={{ ...s.viewBtn, color: C.red, borderColor: C.red, marginLeft: 'auto' }} onClick={() => onDelete(grant)}>🗑️ Delete</button>
          )}
        </div>
      </div>
    </div>
  )
}
