import { useState } from 'react'
import { C } from '../../theme'
import { s } from '../../styles'

export function EditPledgeModal({ pledge, onClose, onSave, causes, onCancelPledge, instalments }) {
  const [form, setForm] = useState({
    donor_name: pledge.donor_name || '',
    donor_email: pledge.donor_email || '',
    donor_phone: pledge.donor_phone || '',
    amount: pledge.amount?.toString() || '',
    expected_date: pledge.expected_date || '',
    notes: pledge.notes || '',
    cause_id: pledge.cause_id || '',
    is_anonymous: pledge.is_anonymous || false,
    source: pledge.source || '',
  })
  // Editable per-year instalments for multi-year pledges. Years already marked "received" stay
  // locked -- correcting those would disturb payment records that have already come in -- but
  // unreceived years can be corrected here instead of forcing a cancel-and-re-enter.
  const [instalmentEdits, setInstalmentEdits] = useState(() =>
    (instalments || []).map(i => ({ ...i, amount: i.amount?.toString() || '' })).sort((a, b) => a.year_number - b.year_number)
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  function handleSave() {
    if (!form.donor_name.trim()) { setError('Donor name is required'); return }
    if (!pledge.is_multi_year) {
      const amt = parseFloat(form.amount)
      if (!form.amount || isNaN(amt) || amt <= 0) { setError('Pledged amount must be a positive number'); return }
      if (!form.expected_date) { setError('Expected date is required'); return }
      if (pledge.status === 'pending' && form.expected_date !== pledge.expected_date && new Date(form.expected_date) < new Date(new Date().setHours(0,0,0,0))) { setError('Expected date cannot be in the past — use Reschedule instead if this pledge is already overdue'); return }
    } else {
      for (const inst of instalmentEdits) {
        if (inst.received) continue
        const amt = parseFloat(inst.amount)
        if (!inst.amount || isNaN(amt) || amt <= 0) { setError(`Year ${inst.year_number} amount must be a positive number`); return }
        if (!inst.expected_date) { setError(`Year ${inst.year_number} expected date is required`); return }
      }
    }
    setError('')
    setSaving(true)
    const payload = pledge.is_multi_year ? { ...form, instalmentEdits } : form
    Promise.resolve(onSave(payload)).finally(() => setSaving(false))
  }
  return (
    <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.forest }}>🤝 Edit Pledge</div>
          <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={onClose}>✕</button>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={s.formLabel}>Donor Name *</div>
          <input style={s.formInput} value={form.donor_name} onChange={e => setForm(f => ({ ...f, donor_name: e.target.value }))} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={s.formLabel}>Donor Email</div>
          <input style={s.formInput} type="email" value={form.donor_email} onChange={e => setForm(f => ({ ...f, donor_email: e.target.value }))} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={s.formLabel}>Donor Phone</div>
          <input style={s.formInput} type="tel" placeholder="+65 9123 4567" value={form.donor_phone} onChange={e => setForm(f => ({ ...f, donor_phone: e.target.value }))} />
        </div>
        {pledge.is_multi_year ? (
          <div style={{ marginBottom: 12 }}>
            <div style={s.formLabel}>Yearly Instalments</div>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>Years already marked received are locked to protect recorded payments. Fix a typo on the rest below.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {instalmentEdits.map((inst, idx) => (
                <div key={inst.id} style={{ display: 'flex', gap: 6, alignItems: 'center', background: inst.received ? C.ivory : C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 8px' }}>
                  <span style={{ fontSize: 11.5, color: C.muted, width: 42, flexShrink: 0 }}>Yr {inst.year_number}</span>
                  {inst.received ? (
                    <span style={{ fontSize: 12, color: C.sage, flex: 1 }}>✓ ${Number(inst.amount).toLocaleString()} received {inst.received_date ? new Date(inst.received_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span>
                  ) : (
                    <>
                      <input
                        type="number"
                        style={{ ...s.formInput, flex: 1, fontSize: 12, padding: '5px 8px' }}
                        value={inst.amount}
                        onChange={e => setInstalmentEdits(prev => prev.map((x, i) => i === idx ? { ...x, amount: e.target.value } : x))}
                      />
                      <input
                        type="date"
                        style={{ ...s.formInput, flex: 1, fontSize: 12, padding: '5px 8px' }}
                        value={inst.expected_date || ''}
                        onChange={e => setInstalmentEdits(prev => prev.map((x, i) => i === idx ? { ...x, expected_date: e.target.value } : x))}
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={s.formLabel}>Pledged Amount (SGD) *</div>
              <input style={s.formInput} type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={s.formLabel}>Expected By *</div>
              <input style={s.formInput} type="date" value={form.expected_date} onChange={e => setForm(f => ({ ...f, expected_date: e.target.value }))} />
            </div>
          </>
        )}
        <div style={{ marginBottom: 12 }}>
          <div style={s.formLabel}>Linked Programme / Campaign</div>
          <select style={s.formInput} value={form.cause_id} onChange={e => setForm(f => ({ ...f, cause_id: e.target.value }))}>
            <option value="">None — general / unrestricted use</option>
            {(causes || []).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={s.formLabel}>How was this pledge made? (optional)</div>
          <select style={s.formInput} value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
            <option value="">Not specified</option>
            <option value="event">Event</option>
            <option value="referral">Referral</option>
            <option value="social_media">Social Media</option>
            <option value="walk_in">Walk-in</option>
            <option value="corporate_partner">Corporate Partner</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.forest, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_anonymous} onChange={e => setForm(f => ({ ...f, is_anonymous: e.target.checked }))} />
            This pledge is anonymous
          </label>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={s.formLabel}>Notes</div>
          <textarea style={{ ...s.formInput, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.btnForest} disabled={saving} onClick={handleSave}>{saving ? 'Saving...' : 'Save Changes'}</button>
          <button style={s.viewBtn} onClick={onClose}>Cancel</button>
          {pledge.status === 'pending' && (
            <button style={{ ...s.viewBtn, color: C.red, borderColor: C.red, marginLeft: 'auto' }} onClick={() => { onCancelPledge(pledge); onClose() }}>✕ Cancel Pledge</button>
          )}
        </div>
      </div>
    </div>
  )
}
