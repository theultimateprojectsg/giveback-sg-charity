import type { Dispatch, SetStateAction } from 'react'
import { C } from '../theme'
import { s } from '../styles'
import { EmptyState } from '../components/ui/EmptyState'

interface MassAppeal {
  id: string
  cause_id?: string | null
  cause_name?: string | null
  message?: string | null
  amount: number | string
  status: string
  created_at: string
  sent_count: number
  failed_count: number
  donor_count: number
  [key: string]: unknown
}

interface MassAppealPageProps {
  isMobile?: boolean
  massAppeals: MassAppeal[]
  fyOf: (date: string | number | Date) => number
  myCauses: { id: string, title: string }[]
  setMassAppealStep: Dispatch<SetStateAction<string>>
  setMassAppealForm: Dispatch<SetStateAction<unknown>>
  setMassAppealRefs: Dispatch<SetStateAction<unknown[]>>
  setShowMassAppealModal: Dispatch<SetStateAction<boolean>>
  defaultMassAppealMessage: () => string
  massAppealSearchTerm: string
  setMassAppealSearchTerm: Dispatch<SetStateAction<string>>
  massAppealYearFilter: string
  setMassAppealYearFilter: Dispatch<SetStateAction<string>>
  massAppealAmountFilter: string
  setMassAppealAmountFilter: Dispatch<SetStateAction<string>>
  massAppealProgrammeFilter: string
  setMassAppealProgrammeFilter: Dispatch<SetStateAction<string>>
  massAppealStatusFilter: string
  setMassAppealStatusFilter: Dispatch<SetStateAction<string>>
  massAppealSortBy: string
  setMassAppealSortBy: Dispatch<SetStateAction<string>>
  exportMassAppealsExcel: (filtered: MassAppeal[]) => void
  expandedAppealYears: Set<number>
  setExpandedAppealYears: Dispatch<SetStateAction<Set<number>>>
  openAppealDetail: (appeal: MassAppeal) => void
}

// Renders only the appeal-history list. The "New Appeal" send flow lives in
// MassAppealModal, rendered unconditionally at the App level (not gated by
// activeTab) — see src/components/modals/MassAppealModal.tsx for why.
export function MassAppealPage({
  isMobile, massAppeals, fyOf, myCauses,
  setMassAppealStep, setMassAppealForm, setMassAppealRefs, setShowMassAppealModal, defaultMassAppealMessage,
  massAppealSearchTerm, setMassAppealSearchTerm, massAppealYearFilter, setMassAppealYearFilter,
  massAppealAmountFilter, setMassAppealAmountFilter, massAppealProgrammeFilter, setMassAppealProgrammeFilter,
  massAppealStatusFilter, setMassAppealStatusFilter, massAppealSortBy, setMassAppealSortBy,
  exportMassAppealsExcel, expandedAppealYears, setExpandedAppealYears, openAppealDetail,
}: MassAppealPageProps) {
  return (
    <div style={s.content}>
      <div style={s.pageHeader}>
        <div>
          <div style={s.pageTitle}>Mass Appeal</div>
          <div style={s.pageSub}>{massAppeals.length} appeal{massAppeals.length !== 1 ? 's' : ''} sent · Personal PayNow QR codes to your donor base</div>
        </div>
        <button style={s.btnGold} onClick={() => { setMassAppealStep('setup'); setMassAppealForm({ cause_id: '', amount: '', message: defaultMassAppealMessage(), customLabel: '' }); setMassAppealRefs([]); setShowMassAppealModal(true) }}>+ New Appeal</button>
      </div>

      {massAppeals.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
          <input style={{ ...s.searchBox, flex: 'none', width: isMobile ? '100%' : 380 }} placeholder="🔍 Search by campaign name or message..." value={massAppealSearchTerm} onChange={e => setMassAppealSearchTerm(e.target.value)} />
          <select style={{ ...s.formInput, width: isMobile ? '100%' : 160 }} value={massAppealYearFilter} onChange={e => setMassAppealYearFilter(e.target.value)}>
            <option value="All">All years</option>
            {[...new Set(massAppeals.map(a => fyOf(a.created_at)))].sort((a, b) => b - a).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select style={{ ...s.formInput, width: isMobile ? '100%' : 160 }} value={massAppealAmountFilter} onChange={e => setMassAppealAmountFilter(e.target.value)}>
            <option value="All">All amounts</option>
            <option value="Under 20">Under $20</option>
            <option value="20-50">$20 – $50</option>
            <option value="50-100">$50 – $100</option>
            <option value="Over 100">Over $100</option>
          </select>
          <select style={{ ...s.formInput, width: isMobile ? '100%' : 190 }} value={massAppealProgrammeFilter} onChange={e => setMassAppealProgrammeFilter(e.target.value)}>
            <option value="All">All programmes</option>
            <option value="__none__">General appeal</option>
            {myCauses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <select style={{ ...s.formInput, width: isMobile ? '100%' : 150 }} value={massAppealStatusFilter} onChange={e => setMassAppealStatusFilter(e.target.value)}>
            <option value="All">All statuses</option>
            <option value="Sent">Fully sent</option>
            <option value="Partial">Partial (some failed)</option>
            <option value="Sending">Still sending</option>
          </select>
          <select style={{ ...s.formInput, width: isMobile ? '100%' : 170 }} value={massAppealSortBy} onChange={e => setMassAppealSortBy(e.target.value)}>
            <option value="created_desc">Sort: Newest first</option>
            <option value="created_asc">Sort: Oldest first</option>
            <option value="amount_desc">Sort: Amount (high–low)</option>
            <option value="amount_asc">Sort: Amount (low–high)</option>
            <option value="sent_desc">Sort: Most sent</option>
            <option value="failed_desc">Sort: Most failed</option>
          </select>
          {(massAppealSearchTerm !== '' || massAppealYearFilter !== 'All' || massAppealAmountFilter !== 'All' || massAppealProgrammeFilter !== 'All' || massAppealStatusFilter !== 'All') && (
            <button style={{ ...s.viewBtn, whiteSpace: 'nowrap' }} onClick={() => { setMassAppealSearchTerm(''); setMassAppealYearFilter('All'); setMassAppealAmountFilter('All'); setMassAppealProgrammeFilter('All'); setMassAppealStatusFilter('All') }}>✕ Clear Filters</button>
          )}
          <button style={isMobile ? { ...s.exportSmallBtn, width: '100%' } : s.exportSmallBtn} onClick={() => {
            const q = massAppealSearchTerm.toLowerCase().trim()
            const filtered = massAppeals.filter(a => {
              const matchesSearch = !q || [a.cause_name, a.message].some(f => f?.toLowerCase().includes(q))
              const matchesYear = massAppealYearFilter === 'All' || fyOf(a.created_at).toString() === massAppealYearFilter
              const amt = Number(a.amount)
              const matchesAmt = massAppealAmountFilter === 'All'
                || (massAppealAmountFilter === 'Under 20' && amt < 20)
                || (massAppealAmountFilter === '20-50' && amt >= 20 && amt <= 50)
                || (massAppealAmountFilter === '50-100' && amt > 50 && amt <= 100)
                || (massAppealAmountFilter === 'Over 100' && amt > 100)
              const matchesProgramme = massAppealProgrammeFilter === 'All' || (massAppealProgrammeFilter === '__none__' ? !a.cause_id : a.cause_id === massAppealProgrammeFilter)
              const matchesStatus = massAppealStatusFilter === 'All'
                || (massAppealStatusFilter === 'Sending' && a.status === 'sending')
                || (massAppealStatusFilter === 'Sent' && a.status === 'sent' && a.failed_count === 0)
                || (massAppealStatusFilter === 'Partial' && a.status === 'sent' && a.failed_count > 0)
              return matchesSearch && matchesYear && matchesAmt && matchesProgramme && matchesStatus
            })
            exportMassAppealsExcel(filtered)
          }}>⬇️ Export to Excel</button>
        </div>
      )}

      {massAppeals.length === 0 ? (
        <EmptyState
          icon="📢"
          title="No appeals sent yet"
          description="Send a bulk PayNow QR appeal to a segment of your donor base — great for year-end giving pushes or urgent campaigns."
          ctaLabel="+ New Appeal"
          onCta={() => { setMassAppealStep('setup'); setMassAppealForm({ cause_id: '', amount: '', message: defaultMassAppealMessage(), customLabel: '' }); setMassAppealRefs([]); setShowMassAppealModal(true) }}
        />
      ) : (() => {
        const searchedAppeals = massAppeals.filter(a => {
          const q = massAppealSearchTerm.toLowerCase().trim()
          const matchesSearch = !q || [a.cause_name, a.message].some(f => f?.toLowerCase().includes(q))
          const matchesYear = massAppealYearFilter === 'All' || fyOf(a.created_at).toString() === massAppealYearFilter
          const amt = Number(a.amount)
          const matchesAmt = massAppealAmountFilter === 'All'
            || (massAppealAmountFilter === 'Under 20' && amt < 20)
            || (massAppealAmountFilter === '20-50' && amt >= 20 && amt <= 50)
            || (massAppealAmountFilter === '50-100' && amt > 50 && amt <= 100)
            || (massAppealAmountFilter === 'Over 100' && amt > 100)
          const matchesProgramme = massAppealProgrammeFilter === 'All' || (massAppealProgrammeFilter === '__none__' ? !a.cause_id : a.cause_id === massAppealProgrammeFilter)
          const matchesStatus = massAppealStatusFilter === 'All'
            || (massAppealStatusFilter === 'Sending' && a.status === 'sending')
            || (massAppealStatusFilter === 'Sent' && a.status === 'sent' && a.failed_count === 0)
            || (massAppealStatusFilter === 'Partial' && a.status === 'sent' && a.failed_count > 0)
          return matchesSearch && matchesYear && matchesAmt && matchesProgramme && matchesStatus
        }).sort((a, b) => {
          if (massAppealSortBy === 'created_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          if (massAppealSortBy === 'created_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          if (massAppealSortBy === 'amount_desc') return Number(b.amount) - Number(a.amount)
          if (massAppealSortBy === 'amount_asc') return Number(a.amount) - Number(b.amount)
          if (massAppealSortBy === 'sent_desc') return b.sent_count - a.sent_count
          if (massAppealSortBy === 'failed_desc') return b.failed_count - a.failed_count
          return 0
        })
        const byYear: Record<number, MassAppeal[]> = {}
        searchedAppeals.forEach(a => {
          const y = fyOf(a.created_at)
          if (!byYear[y]) byYear[y] = []
          byYear[y].push(a)
        })
        const years = Object.keys(byYear).map(Number).sort((a, b) => b - a)

        const renderAppealCard = (a: MassAppeal) => (
          <div key={a.id} style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', cursor: 'pointer', display: 'flex', flexDirection: 'column' }} onClick={() => openAppealDetail(a)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.forest }}>{a.cause_name || 'General Appeal'}</div>
              {a.status === 'sending' ? (
                <span style={{ fontSize: 10, fontWeight: 500, color: C.gold, background: C.gold + '1A', border: `1px solid ${C.gold}`, borderRadius: 20, padding: '3px 10px' }}>⏳ Sending…</span>
              ) : a.status === 'cancelled' ? (
                <span style={{ fontSize: 10, fontWeight: 500, color: C.muted, background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 20, padding: '3px 10px' }}>⊘ Cancelled</span>
              ) : a.failed_count > 0 ? (
                <span style={{ fontSize: 10, fontWeight: 500, color: C.gold, background: C.gold + '1A', border: `1px solid ${C.gold}`, borderRadius: 20, padding: '3px 10px' }}>⚠ Partial</span>
              ) : (
                <span style={s.badgeIssued}>✓ Sent</span>
              )}
            </div>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>
              {new Date(a.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
              <div style={{ fontFamily: C.fontVoice, fontSize: 20, fontWeight: 500, color: C.forest }}>${Number(a.amount).toLocaleString()}</div>
              <div style={{ fontSize: 11.5, color: C.muted }}>suggested amount asked per donor</div>
            </div>
            {a.message && (
              <div style={{ fontSize: 11.5, color: C.muted, fontStyle: 'italic', marginTop: 6, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                "{a.message}"
              </div>
            )}
            <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: `1px solid ${C.border}`, fontSize: 11.5, color: C.muted }}>
              <span style={{ color: C.sage, fontWeight: 500 }}>{a.sent_count} sent</span>
              {a.failed_count > 0 && <span style={{ color: C.red, fontWeight: 500 }}> · {a.failed_count} failed</span>}
              {' · '}{a.donor_count} total
            </div>
            <div style={{ fontSize: 10.5, color: C.muted, marginTop: 8, textAlign: 'center' }}>Click for full details →</div>
          </div>
        )

        return (
          <div>
            {years.map(year => {
              const isExpanded = expandedAppealYears.has(year)
              return (
                <div key={year} style={{ marginBottom: 24 }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: isExpanded ? 12 : 0 }}
                    onClick={() => setExpandedAppealYears(prev => {
                      const next = new Set(prev)
                      if (next.has(year)) next.delete(year); else next.add(year)
                      return next
                    })}
                  >
                    <span style={{ fontSize: 11, color: C.muted }}>{isExpanded ? '▾' : '▸'}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.forest }}>{year}</span>
                    <span style={{ fontSize: 12, color: C.muted }}>({byYear[year].length} appeal{byYear[year].length !== 1 ? 's' : ''})</span>
                  </div>
                  {isExpanded && (
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                      {byYear[year].map(renderAppealCard)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}

    </div>
  )
}
