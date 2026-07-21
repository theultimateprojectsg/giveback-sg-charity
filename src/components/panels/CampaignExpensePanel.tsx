import { useState } from 'react'
import type { CSSProperties } from 'react'

interface Expense {
  id: string
  description: string
  amount: number | string
  expense_date: string
  category?: string | null
}

interface CampaignExpensePanelProps {
  cause: { cost?: number | string }
  expenses: Expense[]
  categories: string[]
  s: Record<string, CSSProperties | ((positive: boolean) => CSSProperties)>
  C: Record<string, string>
  onSaveExpense: (form: unknown) => Promise<unknown>
  onEditExpense: (e: Expense, form: unknown) => Promise<unknown>
  onDeleteExpense: (id: string) => void
}

export function CampaignExpensePanel({ cause, expenses, categories, s, C, onSaveExpense, onEditExpense, onDeleteExpense }: CampaignExpensePanelProps) {
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '', expense_date: new Date().toISOString().split('T')[0], category: categories[0] || 'Other' })
  const [savingExpense, setSavingExpense] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [editingExpenseForm, setEditingExpenseForm] = useState<{ description: string, amount: string, expense_date: string, category: string } | null>(null)
  const [savingEditedExpense, setSavingEditedExpense] = useState(false)
  const spent = expenses.reduce((s2, e) => s2 + Number(e.amount), 0)

  function startEditingExpense(e: Expense) {
    setEditingExpenseId(e.id)
    setEditingExpenseForm({ description: e.description, amount: String(e.amount), expense_date: e.expense_date, category: e.category || categories[0] || 'Other' })
  }

  async function saveEditedExpense(e: Expense) {
    if (savingEditedExpense || !editingExpenseForm) return
    if (!editingExpenseForm.description.trim() || !editingExpenseForm.amount) { return }
    setSavingEditedExpense(true)
    await onEditExpense(e, {
      description: editingExpenseForm.description.trim(),
      amount: parseFloat(editingExpenseForm.amount),
      expense_date: editingExpenseForm.expense_date,
      category: editingExpenseForm.category || null,
    })
    setSavingEditedExpense(false)
    setEditingExpenseId(null)
  }

  return (
    <div style={{ marginTop: 8, paddingTop: 10, borderTop: `1px dashed ${C.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Expenses</div>
        {Number(cause.cost) > 0 && <div style={{ fontSize: 11, color: spent > Number(cause.cost) ? C.red : C.muted, fontWeight: spent > Number(cause.cost) ? 500 : 400 }}>{spent > Number(cause.cost) ? '⚠ ' : ''}${spent.toLocaleString()} logged of ${Number(cause.cost).toLocaleString()} budget</div>}
      </div>
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
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <input style={{ ...s.formInput, fontSize: 12, flex: 2, minWidth: 120 }} placeholder="Description" value={expenseForm.description} onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))} maxLength={200} />
        <select style={{ ...s.formInput, fontSize: 12, flex: 1, minWidth: 110 }} value={expenseForm.category} onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))}>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <input style={{ ...s.formInput, fontSize: 12, flex: 1, minWidth: 80 }} type="number" placeholder="Amount" value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} />
        <input style={{ ...s.formInput, fontSize: 12, flex: 1, minWidth: 110 }} type="date" value={expenseForm.expense_date} onChange={e => setExpenseForm(f => ({ ...f, expense_date: e.target.value }))} />
        <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} disabled={savingExpense} onClick={async () => { setSavingExpense(true); await onSaveExpense(expenseForm); setSavingExpense(false); setExpenseForm({ description: '', amount: '', expense_date: new Date().toISOString().split('T')[0], category: categories[0] || 'Other' }) }}>{savingExpense ? 'Adding...' : 'Add'}</button>
      </div>
    </div>
  )
}
