import { useState } from 'react'
import type { CSSProperties } from 'react'

interface LedgerExpense { id: string, description: string, amount: number | string, expense_date: string, category?: string | null }
interface LedgerTranche { id: string, label: string, amount: number | string, expected_date: string, received?: boolean }
interface LedgerReport { id: string, label: string, due_date: string, submitted?: boolean }
interface LedgerClaim { id: string, amount: number | string, claim_date: string, notes?: string | null }
interface LedgerNote { id: string, note: string, created_at: string, created_by?: string | null }

interface GrantLedgerPanelProps {
  grant: { is_matching?: boolean }
  expenses: LedgerExpense[]
  tranches: LedgerTranche[]
  reports: LedgerReport[]
  claims: LedgerClaim[]
  notes: LedgerNote[]
  categories: string[]
  s: Record<string, CSSProperties | ((positive: boolean) => CSSProperties)>
  C: Record<string, string>
  onSaveExpense: (form: unknown) => Promise<unknown>
  onEditExpense: (e: LedgerExpense, form: unknown) => Promise<unknown>
  onDeleteExpense: (id: string) => void
  onSaveTranche: (form: unknown) => Promise<unknown>
  onToggleTranche: (t: LedgerTranche) => void
  onEditTranche: (t: LedgerTranche, form: unknown) => Promise<unknown>
  onDeleteTranche: (t: LedgerTranche) => void
  onSaveReport: (form: unknown) => Promise<unknown>
  onToggleReport: (r: LedgerReport) => void
  onEditReport: (r: LedgerReport, form: unknown) => Promise<unknown>
  onDeleteReport: (r: LedgerReport) => void
  onSaveClaim: (form: unknown) => Promise<unknown>
  onEditClaim: (c: LedgerClaim, form: unknown) => Promise<unknown>
  onDeleteClaim: (c: LedgerClaim) => void
  onSaveNote: (note: string) => Promise<unknown>
}

export function GrantLedgerPanel({ grant, expenses, tranches, reports, claims, notes, categories, s, C,
  onSaveExpense, onEditExpense, onDeleteExpense, onSaveTranche, onToggleTranche, onEditTranche, onDeleteTranche,
  onSaveReport, onToggleReport, onEditReport, onDeleteReport, onSaveClaim, onEditClaim, onDeleteClaim, onSaveNote }: GrantLedgerPanelProps) {
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '', expense_date: new Date().toISOString().split('T')[0], category: categories[0] || 'Programme Costs' })
  const [trancheForm, setTrancheForm] = useState({ label: '', amount: '', expected_date: '' })
  const [reportForm, setReportForm] = useState({ label: '', due_date: '' })
  const [claimForm, setClaimForm] = useState({ amount: '', claim_date: '', notes: '' })
  const [noteText, setNoteText] = useState('')
  const [savingExpense, setSavingExpense] = useState(false)
  const [savingTranche, setSavingTranche] = useState(false)
  const [savingReport, setSavingReport] = useState(false)
  const [savingClaim, setSavingClaim] = useState(false)
  const [savingNote, setSavingNote] = useState(false)

  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [editingExpenseForm, setEditingExpenseForm] = useState<{ description: string, amount: string, expense_date: string, category: string } | null>(null)
  const [savingEditedExpense, setSavingEditedExpense] = useState(false)
  function startEditingExpense(e: LedgerExpense) {
    setEditingExpenseId(e.id)
    setEditingExpenseForm({ description: e.description, amount: String(e.amount), expense_date: e.expense_date, category: e.category || categories[0] || 'Programme Costs' })
  }
  async function saveEditedExpense(e: LedgerExpense) {
    if (savingEditedExpense || !editingExpenseForm || !editingExpenseForm.description.trim() || !editingExpenseForm.amount) return
    setSavingEditedExpense(true)
    await onEditExpense(e, { description: editingExpenseForm.description.trim(), amount: parseFloat(editingExpenseForm.amount), expense_date: editingExpenseForm.expense_date, category: editingExpenseForm.category || null })
    setSavingEditedExpense(false)
    setEditingExpenseId(null)
  }

  const [editingTrancheId, setEditingTrancheId] = useState<string | null>(null)
  const [editingTrancheForm, setEditingTrancheForm] = useState<{ label: string, amount: string, expected_date: string } | null>(null)
  const [savingEditedTranche, setSavingEditedTranche] = useState(false)
  function startEditingTranche(t: LedgerTranche) {
    setEditingTrancheId(t.id)
    setEditingTrancheForm({ label: t.label, amount: String(t.amount), expected_date: t.expected_date })
  }
  async function saveEditedTranche(t: LedgerTranche) {
    if (savingEditedTranche || !editingTrancheForm || !editingTrancheForm.label.trim() || !editingTrancheForm.amount || !editingTrancheForm.expected_date) return
    setSavingEditedTranche(true)
    await onEditTranche(t, { label: editingTrancheForm.label.trim(), amount: parseFloat(editingTrancheForm.amount), expected_date: editingTrancheForm.expected_date })
    setSavingEditedTranche(false)
    setEditingTrancheId(null)
  }

  const [editingReportId, setEditingReportId] = useState<string | null>(null)
  const [editingReportForm, setEditingReportForm] = useState<{ label: string, due_date: string } | null>(null)
  const [savingEditedReport, setSavingEditedReport] = useState(false)
  function startEditingReport(r: LedgerReport) {
    setEditingReportId(r.id)
    setEditingReportForm({ label: r.label, due_date: r.due_date })
  }
  async function saveEditedReport(r: LedgerReport) {
    if (savingEditedReport || !editingReportForm || !editingReportForm.label.trim() || !editingReportForm.due_date) return
    setSavingEditedReport(true)
    await onEditReport(r, { label: editingReportForm.label.trim(), due_date: editingReportForm.due_date })
    setSavingEditedReport(false)
    setEditingReportId(null)
  }

  const [editingClaimId, setEditingClaimId] = useState<string | null>(null)
  const [editingClaimForm, setEditingClaimForm] = useState<{ amount: string, claim_date: string, notes: string } | null>(null)
  const [savingEditedClaim, setSavingEditedClaim] = useState(false)
  function startEditingClaim(c: LedgerClaim) {
    setEditingClaimId(c.id)
    setEditingClaimForm({ amount: String(c.amount), claim_date: c.claim_date, notes: c.notes || '' })
  }
  async function saveEditedClaim(c: LedgerClaim) {
    if (savingEditedClaim || !editingClaimForm || !editingClaimForm.amount || !editingClaimForm.claim_date) return
    setSavingEditedClaim(true)
    await onEditClaim(c, { amount: parseFloat(editingClaimForm.amount), claim_date: editingClaimForm.claim_date, notes: editingClaimForm.notes?.trim() || null })
    setSavingEditedClaim(false)
    setEditingClaimId(null)
  }

  return (
    <div style={{ marginTop: 8, paddingTop: 10, borderTop: `1px dashed ${C.border}` }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Expenses</div>
      {expenses.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {expenses.map(e => (
            editingExpenseId === e.id ? (
              <div key={e.id} style={{ background: C.ivory, borderRadius: 4, padding: '8px 10px' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  <input style={{ ...s.formInput, fontSize: 12, flex: 2, minWidth: 120 }} value={editingExpenseForm.description} onChange={ev => setEditingExpenseForm(f => ({ ...f, description: ev.target.value }))} maxLength={200} />
                  <select style={{ ...s.formInput, fontSize: 12, flex: 1, minWidth: 110 }} value={editingExpenseForm.category} onChange={ev => setEditingExpenseForm(f => ({ ...f, category: ev.target.value }))}>
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  <input style={{ ...s.formInput, fontSize: 12, flex: 1, minWidth: 80 }} type="number" value={editingExpenseForm.amount} onChange={ev => setEditingExpenseForm(f => ({ ...f, amount: ev.target.value }))} />
                  <input style={{ ...s.formInput, fontSize: 12, flex: 1, minWidth: 110 }} type="date" value={editingExpenseForm.expense_date} onChange={ev => setEditingExpenseForm(f => ({ ...f, expense_date: ev.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ ...s.issueBtn, fontSize: 11, padding: '4px 10px' }} disabled={savingEditedExpense} onClick={() => saveEditedExpense(e)}>{savingEditedExpense ? 'Saving...' : 'Save'}</button>
                  <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px' }} onClick={() => setEditingExpenseId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, borderRadius: 4, padding: '6px 10px', fontSize: 12 }}>
                <span style={{ color: C.text, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {e.description} <span style={{ color: C.muted }}>· {new Date(e.expense_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}</span>
                  {e.category && <span style={{ fontSize: 10, fontWeight: 500, color: C.teal, background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '1px 6px' }}>{e.category}</span>}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 500, color: C.forest }}>${Number(e.amount).toLocaleString()}</span>
                  <span style={{ color: C.muted, cursor: 'pointer' }} onClick={() => startEditingExpense(e)}>✏️</span>
                  <span style={{ color: C.muted, cursor: 'pointer' }} onClick={() => onDeleteExpense(e.id)}>✕</span>
                </div>
              </div>
            )
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <input style={{ ...s.formInput, fontSize: 12, flex: 2, minWidth: 120 }} placeholder="Description" value={expenseForm.description} onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))} maxLength={200} />
        <select style={{ ...s.formInput, fontSize: 12, flex: 1, minWidth: 110 }} value={expenseForm.category} onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))}>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <input style={{ ...s.formInput, fontSize: 12, flex: 1, minWidth: 80 }} type="number" placeholder="Amount" value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} />
        <input style={{ ...s.formInput, fontSize: 12, flex: 1, minWidth: 110 }} type="date" value={expenseForm.expense_date} onChange={e => setExpenseForm(f => ({ ...f, expense_date: e.target.value }))} />
        <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} disabled={savingExpense} onClick={async () => { setSavingExpense(true); await onSaveExpense(expenseForm); setSavingExpense(false); setExpenseForm({ description: '', amount: '', expense_date: new Date().toISOString().split('T')[0], category: categories[0] || 'Programme Costs' }) }}>{savingExpense ? 'Adding...' : 'Add'}</button>
      </div>

      <div style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingTop: 10, borderTop: `1px dashed ${C.border}` }}>Disbursement tranches</div>
      {tranches.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {tranches.map(t => {
            const isOverdue = !t.received && new Date(t.expected_date) < new Date()
            if (editingTrancheId === t.id) {
              return (
                <div key={t.id} style={{ background: C.ivory, borderRadius: 4, padding: '8px 10px' }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input style={{ ...s.formInput, fontSize: 12, flex: 2 }} value={editingTrancheForm.label} onChange={ev => setEditingTrancheForm(f => ({ ...f, label: ev.target.value }))} />
                    <input style={{ ...s.formInput, fontSize: 12, flex: 1 }} type="number" value={editingTrancheForm.amount} onChange={ev => setEditingTrancheForm(f => ({ ...f, amount: ev.target.value }))} />
                    <input style={{ ...s.formInput, fontSize: 12, flex: 1 }} type="date" value={editingTrancheForm.expected_date} onChange={ev => setEditingTrancheForm(f => ({ ...f, expected_date: ev.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ ...s.issueBtn, fontSize: 11, padding: '4px 10px' }} disabled={savingEditedTranche} onClick={() => saveEditedTranche(t)}>{savingEditedTranche ? 'Saving...' : 'Save'}</button>
                    <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px' }} onClick={() => setEditingTrancheId(null)}>Cancel</button>
                  </div>
                </div>
              )
            }
            return (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: t.received ? C.ivory : isOverdue ? '#FBEEE9' : C.warningBg, borderRadius: 4, padding: '6px 10px', fontSize: 12 }}>
                <span style={{ color: t.received ? C.muted : isOverdue ? C.red : C.warning, textDecoration: t.received ? 'line-through' : 'none' }}>
                  {t.label} <span style={{ color: C.muted, textDecoration: 'none' }}>· ${Number(t.amount).toLocaleString()} · {new Date(t.expected_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}{isOverdue ? ' — overdue' : ''}</span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: C.sage, cursor: 'pointer', fontWeight: 500 }} onClick={() => onToggleTranche(t)}>{t.received ? '↺ Undo' : '✓ Received'}</span>
                  <span style={{ color: C.muted, cursor: 'pointer' }} onClick={() => startEditingTranche(t)}>✏️</span>
                  <span style={{ color: C.muted, cursor: 'pointer' }} onClick={() => onDeleteTranche(t)}>✕</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <input style={{ ...s.formInput, fontSize: 12, flex: 2 }} placeholder="e.g. Tranche 1" value={trancheForm.label} onChange={e => setTrancheForm(f => ({ ...f, label: e.target.value }))} />
        <input style={{ ...s.formInput, fontSize: 12, flex: 1 }} type="number" placeholder="Amount" value={trancheForm.amount} onChange={e => setTrancheForm(f => ({ ...f, amount: e.target.value }))} />
        <input style={{ ...s.formInput, fontSize: 12, flex: 1 }} type="date" value={trancheForm.expected_date} onChange={e => setTrancheForm(f => ({ ...f, expected_date: e.target.value }))} />
        <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} disabled={savingTranche} onClick={async () => { setSavingTranche(true); await onSaveTranche(trancheForm); setSavingTranche(false); setTrancheForm({ label: '', amount: '', expected_date: '' }) }}>{savingTranche ? 'Adding...' : 'Add'}</button>
      </div>

      <div style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingTop: 10, borderTop: `1px dashed ${C.border}` }}>Reports & deadlines</div>
      {reports.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {reports.map(r => {
            const isOverdue = !r.submitted && new Date(r.due_date) < new Date()
            if (editingReportId === r.id) {
              return (
                <div key={r.id} style={{ background: C.ivory, borderRadius: 4, padding: '8px 10px' }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input style={{ ...s.formInput, fontSize: 12, flex: 2 }} value={editingReportForm.label} onChange={ev => setEditingReportForm(f => ({ ...f, label: ev.target.value }))} />
                    <input style={{ ...s.formInput, fontSize: 12, flex: 1 }} type="date" value={editingReportForm.due_date} onChange={ev => setEditingReportForm(f => ({ ...f, due_date: ev.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ ...s.issueBtn, fontSize: 11, padding: '4px 10px' }} disabled={savingEditedReport} onClick={() => saveEditedReport(r)}>{savingEditedReport ? 'Saving...' : 'Save'}</button>
                    <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px' }} onClick={() => setEditingReportId(null)}>Cancel</button>
                  </div>
                </div>
              )
            }
            return (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: r.submitted ? C.ivory : isOverdue ? '#FBEEE9' : C.warningBg, borderRadius: 4, padding: '6px 10px', fontSize: 12 }}>
                <span style={{ color: r.submitted ? C.muted : isOverdue ? C.red : C.warning, textDecoration: r.submitted ? 'line-through' : 'none' }}>
                  {r.label} <span style={{ color: C.muted, textDecoration: 'none' }}>· {new Date(r.due_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}{isOverdue ? ' — overdue' : ''}</span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: C.sage, cursor: 'pointer', fontWeight: 500 }} onClick={() => onToggleReport(r)}>{r.submitted ? '↺ Undo' : '✓ Submitted'}</span>
                  <span style={{ color: C.muted, cursor: 'pointer' }} onClick={() => startEditingReport(r)}>✏️</span>
                  <span style={{ color: C.muted, cursor: 'pointer' }} onClick={() => onDeleteReport(r)}>✕</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <input style={{ ...s.formInput, fontSize: 12, flex: 2 }} placeholder="e.g. Q1 2026 report" value={reportForm.label} onChange={e => setReportForm(f => ({ ...f, label: e.target.value }))} />
        <input style={{ ...s.formInput, fontSize: 12, flex: 1 }} type="date" value={reportForm.due_date} onChange={e => setReportForm(f => ({ ...f, due_date: e.target.value }))} />
        <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} disabled={savingReport} onClick={async () => { setSavingReport(true); await onSaveReport(reportForm); setSavingReport(false); setReportForm({ label: '', due_date: '' }) }}>{savingReport ? 'Adding...' : 'Add'}</button>
      </div>

      {grant.is_matching && (
        <>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingTop: 10, borderTop: `1px dashed ${C.border}` }}>Matching claims</div>
          {claims.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {claims.map(c => (
                editingClaimId === c.id ? (
                  <div key={c.id} style={{ background: C.ivory, borderRadius: 4, padding: '8px 10px' }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <input style={{ ...s.formInput, fontSize: 12, flex: 1 }} type="number" value={editingClaimForm.amount} onChange={ev => setEditingClaimForm(f => ({ ...f, amount: ev.target.value }))} />
                      <input style={{ ...s.formInput, fontSize: 12, flex: 1 }} type="date" value={editingClaimForm.claim_date} onChange={ev => setEditingClaimForm(f => ({ ...f, claim_date: ev.target.value }))} />
                      <input style={{ ...s.formInput, fontSize: 12, flex: 2 }} placeholder="Notes (optional)" value={editingClaimForm.notes} onChange={ev => setEditingClaimForm(f => ({ ...f, notes: ev.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={{ ...s.issueBtn, fontSize: 11, padding: '4px 10px' }} disabled={savingEditedClaim} onClick={() => saveEditedClaim(c)}>{savingEditedClaim ? 'Saving...' : 'Save'}</button>
                      <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px' }} onClick={() => setEditingClaimId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, borderRadius: 4, padding: '6px 10px', fontSize: 12 }}>
                    <span style={{ color: C.text }}>${Number(c.amount).toLocaleString()} <span style={{ color: C.muted }}>· {new Date(c.claim_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}{c.notes ? ` — ${c.notes}` : ''}</span></span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: C.muted, cursor: 'pointer' }} onClick={() => startEditingClaim(c)}>✏️</span>
                      <span style={{ color: C.muted, cursor: 'pointer' }} onClick={() => onDeleteClaim(c)}>✕</span>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <input style={{ ...s.formInput, fontSize: 12, flex: 1 }} type="number" placeholder="Amount claimed" value={claimForm.amount} onChange={e => setClaimForm(f => ({ ...f, amount: e.target.value }))} />
            <input style={{ ...s.formInput, fontSize: 12, flex: 1 }} type="date" value={claimForm.claim_date} onChange={e => setClaimForm(f => ({ ...f, claim_date: e.target.value }))} />
            <input style={{ ...s.formInput, fontSize: 12, flex: 2 }} placeholder="Notes (optional)" value={claimForm.notes} onChange={e => setClaimForm(f => ({ ...f, notes: e.target.value }))} />
            <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} disabled={savingClaim} onClick={async () => { setSavingClaim(true); await onSaveClaim(claimForm); setSavingClaim(false); setClaimForm({ amount: '', claim_date: '', notes: '' }) }}>{savingClaim ? 'Adding...' : 'Add'}</button>
          </div>
        </>
      )}

      <div style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingTop: 10, borderTop: `1px dashed ${C.border}` }}>Notes & updates</div>
      {notes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {notes.map(n => (
            <div key={n.id} style={{ background: C.ivory, borderRadius: 4, padding: '6px 10px', fontSize: 12 }}>
              <div style={{ color: C.text, marginBottom: 2 }}>{n.note}</div>
              <div style={{ fontSize: 10.5, color: C.muted }}>{new Date(n.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}{n.created_by ? ` · ${n.created_by}` : ''}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <input style={{ ...s.formInput, fontSize: 12, flex: 1 }} placeholder="e.g. Funder pushed report deadline to March" value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={async e => { if (e.key === 'Enter' && noteText.trim() && !savingNote) { setSavingNote(true); await onSaveNote(noteText); setSavingNote(false); setNoteText('') } }} />
        <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} disabled={savingNote} onClick={async () => { if (noteText.trim()) { setSavingNote(true); await onSaveNote(noteText); setSavingNote(false); setNoteText('') } }}>{savingNote ? 'Adding...' : 'Add'}</button>
      </div>
    </div>
  )
}
