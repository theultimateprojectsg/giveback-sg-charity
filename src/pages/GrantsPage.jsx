import { C } from '../theme'
import { s } from '../styles'
import { InfoTip } from '../components/ui/InfoTip'
import { EmptyState } from '../components/ui/EmptyState'
import { AddGrantModal } from '../components/modals/AddGrantModal'
import { GrantLedgerPanel } from '../components/panels/GrantLedgerPanel'

export function GrantsPage({
  isMobile, grants, grantsWithNextReport, myCauses, fyOf,
  showGrantForm, setShowGrantForm, editingGrant, setEditingGrant,
  saveGrant, updateGrant, deleteGrant, grantMatchClaims,
  grantSearchTerm, setGrantSearchTerm, showGrantFilters, setShowGrantFilters,
  grantUrgencyFilter, setGrantUrgencyFilter, grantAmountFilter, setGrantAmountFilter,
  grantYearFilter, setGrantYearFilter, grantFunderTypeFilter, setGrantFunderTypeFilter,
  grantFundingTypeFilter, setGrantFundingTypeFilter, grantSortBy, setGrantSortBy,
  exportGrantsExcel, highlightedGrantId, grantExpensesByGrant, expandedGrantId, setExpandedGrantId,
  grantReports, grantTranches, grantNotes, grantExpenseCategories,
  saveGrantExpense, editGrantExpense, deleteGrantExpense, setConfirmModal,
  saveGrantTranche, toggleGrantTrancheReceived, editGrantTranche, deleteGrantTranche,
  saveGrantReport, toggleGrantReportSubmitted, editGrantReport, deleteGrantReport,
  saveGrantMatchClaim, editGrantMatchClaim, deleteGrantMatchClaim, saveGrantNote,
  exportGrantReportPDF, changeGrantStatus, showPastGrants, setShowPastGrants,
}) {
  return (
    <div style={s.content}>
      <div style={s.pageHeader}>
        <div>
          <div style={s.pageTitle}>Grants & Restricted Funds</div>
          <div style={s.pageSub}>{grantsWithNextReport.filter(g => g.status === 'active').length} active grant{grantsWithNextReport.filter(g => g.status === 'active').length !== 1 ? 's' : ''}</div>
        </div>
        <button style={s.btnGold} onClick={() => setShowGrantForm(true)}>+ Record Grant</button>
      </div>

      {showGrantForm && (
        <AddGrantModal isMobile={isMobile} onClose={() => setShowGrantForm(false)} onSave={saveGrant} causes={myCauses.filter(c => c.type === 'campaign')} />
      )}

      {editingGrant && (
        <AddGrantModal
          isMobile={isMobile}
          grant={editingGrant}
          onClose={() => setEditingGrant(null)}
          onSave={(form) => updateGrant(editingGrant.id, form)}
          onDelete={deleteGrant}
          causes={myCauses.filter(c => c.type === 'campaign')}
          hasExistingClaims={(grantMatchClaims[editingGrant.id] || []).length > 0}
        />
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
        <input style={{ ...s.searchBox, flex: 'none', width: isMobile ? '100%' : 380 }} placeholder="🔍 Search grants by funder, agreement ref, or contact..." value={grantSearchTerm} onChange={e => setGrantSearchTerm(e.target.value)} />
        {isMobile && (
          <button style={{ ...s.viewBtn, width: '100%', justifyContent: 'center' }} onClick={() => setShowGrantFilters(v => !v)}>{showGrantFilters ? '▾ Hide Filters' : '▸ Filters & Sort'}</button>
        )}
        {(!isMobile || showGrantFilters) && (<>
        <select style={{ ...s.formInput, width: isMobile ? '100%' : 180 }} value={grantUrgencyFilter} onChange={e => setGrantUrgencyFilter(e.target.value)}>
          <option value="All">All grants</option>
          <option value="Overdue">Report overdue</option>
          <option value="Due Soon">Report due soon (60d)</option>
          <option value="Healthy">No urgent report</option>
        </select>
        <select style={{ ...s.formInput, width: isMobile ? '100%' : 160 }} value={grantAmountFilter} onChange={e => setGrantAmountFilter(e.target.value)}>
          <option value="All">All amounts</option>
          <option value="Under 20000">Under $20,000</option>
          <option value="20000-100000">$20,000 – $100,000</option>
          <option value="100000-250000">$100,000 – $250,000</option>
          <option value="Over 250000">Over $250,000</option>
        </select>
        <select style={{ ...s.formInput, width: isMobile ? '100%' : 130 }} value={grantYearFilter} onChange={e => setGrantYearFilter(e.target.value)}>
          <option value="All">All years</option>
          {[...new Set(grantsWithNextReport.map(g => fyOf(g.start_date || g.created_at)))].sort((a, b) => b - a).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select style={{ ...s.formInput, width: isMobile ? '100%' : 180 }} value={grantFunderTypeFilter} onChange={e => setGrantFunderTypeFilter(e.target.value)}>
          <option value="All">All funder types</option>
          <option value="government">Government / statutory board</option>
          <option value="corporate">Corporate foundation</option>
          <option value="trust">Private trust / individual</option>
          <option value="other">Other</option>
        </select>
        <select style={{ ...s.formInput, width: isMobile ? '100%' : 160 }} value={grantFundingTypeFilter} onChange={e => setGrantFundingTypeFilter(e.target.value)}>
          <option value="All">Restricted or not</option>
          <option value="Restricted">Has restricted funds</option>
          <option value="Unrestricted">Fully unrestricted</option>
          <option value="Matching">Matching grants</option>
        </select>
        <select style={{ ...s.formInput, width: isMobile ? '100%' : 170 }} value={grantSortBy} onChange={e => setGrantSortBy(e.target.value)}>
          <option value="start_desc">Sort: Newest first</option>
          <option value="start_asc">Sort: Oldest first</option>
          <option value="amount_desc">Sort: Amount (high–low)</option>
          <option value="amount_asc">Sort: Amount (low–high)</option>
          <option value="report_asc">Sort: Report due soonest</option>
          <option value="funder_az">Sort: Funder A–Z</option>
        </select>
        {(grantSearchTerm !== '' || grantUrgencyFilter !== 'All' || grantAmountFilter !== 'All' || grantYearFilter !== 'All' || grantFunderTypeFilter !== 'All' || grantFundingTypeFilter !== 'All') && (
          <button style={s.viewBtn} onClick={() => { setGrantSearchTerm(''); setGrantUrgencyFilter('All'); setGrantAmountFilter('All'); setGrantYearFilter('All'); setGrantFunderTypeFilter('All'); setGrantFundingTypeFilter('All') }}>✕ Clear Filters</button>
        )}
        </>)}
        <button style={isMobile ? { ...s.exportSmallBtn, width: '100%' } : s.exportSmallBtn} onClick={() => {
          const q = grantSearchTerm.toLowerCase().trim()
          const filtered = grantsWithNextReport.filter(g => {
            const matchesSearch = q === '' || [g.funder_name, g.agreement_reference, g.contact_name, g.contact_email, g.contact_phone].some(f => f?.toLowerCase().includes(q))
            const days = g.report_due_date ? Math.ceil((new Date(g.report_due_date) - new Date()) / (1000 * 60 * 60 * 24)) : null
            const matchesUrgency = grantUrgencyFilter === 'All'
              || (grantUrgencyFilter === 'Overdue' && days !== null && days < 0)
              || (grantUrgencyFilter === 'Due Soon' && days !== null && days >= 0 && days <= 60)
              || (grantUrgencyFilter === 'Healthy' && (days === null || days > 60))
            const amt = Number(g.amount)
            const matchesAmount = grantAmountFilter === 'All'
              || (grantAmountFilter === 'Under 20000' && amt < 20000)
              || (grantAmountFilter === '20000-100000' && amt >= 20000 && amt <= 100000)
              || (grantAmountFilter === '100000-250000' && amt > 100000 && amt <= 250000)
              || (grantAmountFilter === 'Over 250000' && amt > 250000)
            const matchesYear = grantYearFilter === 'All' || fyOf(g.start_date || g.created_at).toString() === grantYearFilter
            const matchesFunderType = grantFunderTypeFilter === 'All' || g.funder_type === grantFunderTypeFilter
            const matchesFundingType = grantFundingTypeFilter === 'All'
              || (grantFundingTypeFilter === 'Restricted' && Number(g.restricted_amount) > 0)
              || (grantFundingTypeFilter === 'Unrestricted' && Number(g.restricted_amount) === 0)
              || (grantFundingTypeFilter === 'Matching' && g.is_matching)
            return matchesSearch && matchesUrgency && matchesAmount && matchesYear && matchesFunderType && matchesFundingType
          })
          exportGrantsExcel(filtered)
        }}>⬇️ Export to Excel</button>
      </div>

      {(() => {
        const filteredGrants = grantsWithNextReport.filter(g => {
          const q = grantSearchTerm.toLowerCase().trim()
          const matchesSearch = q === '' || [g.funder_name, g.agreement_reference, g.contact_name, g.contact_email, g.contact_phone].some(f => f?.toLowerCase().includes(q))
          const days = g.report_due_date ? Math.ceil((new Date(g.report_due_date) - new Date()) / (1000 * 60 * 60 * 24)) : null
          const matchesUrgency = grantUrgencyFilter === 'All'
            || (grantUrgencyFilter === 'Overdue' && days !== null && days < 0)
            || (grantUrgencyFilter === 'Due Soon' && days !== null && days >= 0 && days <= 60)
            || (grantUrgencyFilter === 'Healthy' && (days === null || days > 60))
          const amt = Number(g.amount)
          const matchesAmount = grantAmountFilter === 'All'
            || (grantAmountFilter === 'Under 20000' && amt < 20000)
            || (grantAmountFilter === '20000-100000' && amt >= 20000 && amt <= 100000)
            || (grantAmountFilter === '100000-250000' && amt > 100000 && amt <= 250000)
            || (grantAmountFilter === 'Over 250000' && amt > 250000)
          const matchesYear = grantYearFilter === 'All' || fyOf(g.start_date || g.created_at).toString() === grantYearFilter
          const matchesFunderType = grantFunderTypeFilter === 'All' || g.funder_type === grantFunderTypeFilter
          const matchesFundingType = grantFundingTypeFilter === 'All'
            || (grantFundingTypeFilter === 'Restricted' && Number(g.restricted_amount) > 0)
            || (grantFundingTypeFilter === 'Unrestricted' && Number(g.restricted_amount) === 0)
            || (grantFundingTypeFilter === 'Matching' && g.is_matching)
          return matchesSearch && matchesUrgency && matchesAmount && matchesYear && matchesFunderType && matchesFundingType
        }).sort((a, b) => {
          if (grantSortBy === 'start_desc') return new Date(b.start_date || b.created_at) - new Date(a.start_date || a.created_at)
          if (grantSortBy === 'start_asc') return new Date(a.start_date || a.created_at) - new Date(b.start_date || b.created_at)
          if (grantSortBy === 'amount_desc') return Number(b.amount) - Number(a.amount)
          if (grantSortBy === 'amount_asc') return Number(a.amount) - Number(b.amount)
          if (grantSortBy === 'report_asc') return new Date(a.report_due_date || '9999-12-31') - new Date(b.report_due_date || '9999-12-31')
          if (grantSortBy === 'funder_az') return a.funder_name.localeCompare(b.funder_name)
          return 0
        })

        const activeGrants = filteredGrants.filter(g => g.status === 'active')
        const pastGrants = filteredGrants.filter(g => g.status !== 'active')

        const statusBadgeInfo = (status) => {
          const map = {
            active: { bg: C.sage, color: C.white, label: 'Active' },
            completed: { bg: C.muted, color: C.white, label: 'Completed' },
            closed: { bg: C.muted, color: C.white, label: 'Closed' },
          }
          return map[status] || { bg: C.muted, color: C.white, label: status }
        }

        const funderTypeLabels = { government: 'Government / statutory board', corporate: 'Corporate foundation', trust: 'Private trust / individual', other: 'Other' }

        const renderGrantCard = (g) => {
          const isHighlighted = highlightedGrantId === g.id
          const myExpenses84 = grantExpensesByGrant[g.id] || []
          const spent84 = myExpenses84.reduce((s, e) => s + Number(e.amount), 0)
          const remaining84 = Number(g.amount) - spent84
          const pctUtilizedRaw = Number(g.amount) > 0 ? Math.round((spent84 / Number(g.amount)) * 100) : 0
          const pctUtilized = Math.min(100, pctUtilizedRaw)
          const isExpanded84 = expandedGrantId === g.id
          const myReports = (grantReports[g.id] || [])
          const myTranches = (grantTranches[g.id] || [])
          const myClaims = (grantMatchClaims[g.id] || [])
          const claimedTotal = myClaims.reduce((s, c) => s + Number(c.amount), 0)
          const linkedCause = g.cause_id ? myCauses.find(c => c.id === g.cause_id) : null
          const subtitleParts = [funderTypeLabels[g.funder_type], linkedCause?.title, g.agreement_reference ? `Ref: ${g.agreement_reference}` : null, g.contact_name].filter(Boolean)
          return (
            <div key={g.id} id={`grant-card-${g.id}`} style={{ background: isHighlighted ? C.successBg : C.white, border: `1px solid ${isHighlighted ? C.sage : C.border}`, borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'background 0.3s, border-color 0.3s' }}>

              {/* Header: who */}
              <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${C.ivoryDark}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>{g.funder_name}</div>
                    {subtitleParts.length > 0 && (
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{subtitleParts.join(' · ')}</div>
                    )}
                    <div style={{ marginTop: 6 }}>
                      {linkedCause ? (
                        <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4, background: C.teal + '1A', color: C.teal, display: 'inline-flex', alignItems: 'center', gap: 4 }}>🎯 {linkedCause.title} · Restricted</span>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4, background: C.ivory, border: `1px solid ${C.border}`, color: C.muted }}>General / unrestricted</span>
                      )}
                    </div>
                    {g.purpose_restriction && (
                      <div style={{ fontSize: 11.5, color: C.red, fontWeight: 500, background: '#FBEEE9', border: `1px solid #E0BBA9`, borderRadius: 4, padding: '6px 10px', marginTop: 8, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <span>⚠</span>
                        <span>{g.purpose_restriction}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {g.is_matching && <span style={{ fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 20, background: C.ivory, border: `1px solid ${C.border}`, color: C.teal }}>🔁 Matching</span>}
                    {g.is_renewable && <span style={{ fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 20, background: C.ivory, border: `1px solid ${C.border}`, color: C.sage }}>↻ Renewable</span>}
                    <span style={{ fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 20, background: statusBadgeInfo(g.status).bg, color: statusBadgeInfo(g.status).color }}>{statusBadgeInfo(g.status).label}</span>
                  </div>
                </div>
              </div>

              {/* Amount + timeline */}
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.ivoryDark}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontFamily: C.fontVoice, fontSize: 19, fontWeight: 500, color: C.forest }}>${spent84.toLocaleString()}</span>
                    <span style={{ fontSize: 13, color: C.muted }}>of</span>
                    <span style={{ fontFamily: C.fontVoice, fontSize: 19, fontWeight: 500, color: C.forest }}>${Number(g.amount).toLocaleString()}</span>
                    <span style={{ fontSize: 13, color: C.muted }}>utilized</span>
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: remaining84 < 0 ? C.red : pctUtilized >= 50 ? C.sage : C.gold }}>{pctUtilizedRaw}%</span>
                </div>
                <div style={{ background: C.ivoryDark, borderRadius: 3, height: 7, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(pctUtilized, 2)}%`, height: '100%', background: remaining84 < 0 ? C.red : C.sage, borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: 11, color: remaining84 < 0 ? C.red : C.muted, display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontWeight: remaining84 < 0 ? 500 : 400 }}>
                  {remaining84 < 0 ? `⚠ Over budget by $${Math.abs(remaining84).toLocaleString()}` : <InfoTip text="Sum of all expenses logged against this grant, from the ledger below." />}
                </div>

                {g.is_matching && (() => {
                  const capNum84 = Number(g.match_cap) || 0
                  const claimPct84 = capNum84 > 0 ? Math.round((claimedTotal / capNum84) * 100) : 0
                  const overCap84 = capNum84 > 0 && claimedTotal > capNum84
                  return (
                  <div style={{ marginTop: 10, padding: '8px 10px', background: C.ivory, borderRadius: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <span style={{ fontSize: 11.5, color: overCap84 ? C.red : C.text }}>${claimedTotal.toLocaleString()} claimed of ${capNum84.toLocaleString()} cap{g.match_ratio ? ` · ${g.match_ratio}` : ''}{overCap84 ? ' ⚠ over cap' : ''}</span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: overCap84 ? C.red : C.teal }}>{claimPct84}%</span>
                    </div>
                    <div style={{ background: C.ivoryDark, borderRadius: 3, height: 5, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, claimPct84)}%`, height: '100%', background: overCap84 ? C.red : C.teal, borderRadius: 3 }} />
                    </div>
                  </div>
                  )
                })()}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: C.muted, marginBottom: 2 }}>Unrestricted</div>
                    <div style={{ fontFamily: C.fontMono, fontSize: 14, fontWeight: 500, color: C.forest }}>${Number(g.unrestricted_amount || 0).toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: C.muted, marginBottom: 2 }}>Restricted</div>
                    <div style={{ fontFamily: C.fontMono, fontSize: 14, fontWeight: 500, color: Number(g.restricted_amount) > 0 ? C.red : C.forest }}>${Number(g.restricted_amount || 0).toLocaleString()}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: C.muted, marginBottom: 2 }}>Start / end</div>
                    <div style={{ fontFamily: C.fontMono, fontSize: 13, fontWeight: 500, color: C.forest }}>{g.start_date ? new Date(g.start_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}{g.end_date ? ` – ${new Date(g.end_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: C.muted, marginBottom: 2 }}>Next report</div>
                    <div style={{ fontFamily: C.fontMono, fontSize: 14, fontWeight: 500, color: g.report_due_date && new Date(g.report_due_date) < new Date() ? C.red : C.forest }}>{g.report_due_date ? new Date(g.report_due_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }) : myReports.length > 0 ? 'all submitted' : '—'}</div>
                  </div>
                </div>
                {g.disbursement_schedule && <div style={{ fontSize: 12.5, color: C.text, marginTop: 8 }}><span style={{ color: C.muted }}>Disbursement:</span> {g.disbursement_schedule}</div>}
              </div>

              {/* Activity */}
              <div style={{ padding: '12px 16px', background: C.ivory, borderBottom: `1px solid ${C.ivoryDark}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', width: '100%', justifyContent: 'center', borderRadius: 4 }} onClick={() => setExpandedGrantId(isExpanded84 ? null : g.id)}>{isExpanded84 ? '▲ Hide ledger' : '▼ View ledger'}</button>
                {isExpanded84 && (
                  <GrantLedgerPanel
                    grant={g} s={s} C={C}
                    expenses={myExpenses84} tranches={myTranches} reports={myReports} claims={myClaims} notes={grantNotes[g.id] || []}
                    categories={grantExpenseCategories}
                    onSaveExpense={form => saveGrantExpense(g.id, form)}
                    onEditExpense={(expense, updates) => editGrantExpense(expense, updates)}
                    onDeleteExpense={id => {
                      const exp = (myExpenses84 || []).find(e => e.id === id)
                      setConfirmModal({
                        title: 'Delete this expense?',
                        description: exp ? `"${exp.description}" — ${Number(exp.amount).toLocaleString()} will be permanently removed. This cannot be undone.` : 'This expense will be permanently removed. This cannot be undone.',
                        confirmLabel: 'Delete',
                        onConfirm: () => deleteGrantExpense(id),
                      })
                    }}
                    onSaveTranche={form => saveGrantTranche(g.id, form)}
                    onToggleTranche={toggleGrantTrancheReceived}
                    onEditTranche={editGrantTranche}
                    onDeleteTranche={deleteGrantTranche}
                    onSaveReport={form => saveGrantReport(g.id, form)}
                    onToggleReport={toggleGrantReportSubmitted}
                    onEditReport={editGrantReport}
                    onDeleteReport={deleteGrantReport}
                    onSaveClaim={form => saveGrantMatchClaim(g.id, form)}
                    onEditClaim={editGrantMatchClaim}
                    onDeleteClaim={deleteGrantMatchClaim}
                    onSaveNote={noteText => saveGrantNote(g.id, noteText)}
                  />
                )}
              </div>

              {/* Actions */}
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'auto' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={{ ...s.viewBtn, fontSize: 11.5, padding: '7px 8px', flex: 1, justifyContent: 'center' }} onClick={() => exportGrantReportPDF(g)}>📄 Export report</button>
                  <button style={{ ...s.viewBtn, fontSize: 11.5, padding: '7px 8px', flex: 1, justifyContent: 'center' }} onClick={() => setEditingGrant(g)}>✏️ Edit</button>
                </div>
                {g.status === 'active' ? (
                  <button style={{ ...s.issueBtn, fontSize: 11.5, padding: '7px 8px', width: '100%', justifyContent: 'center' }} onClick={() => changeGrantStatus(g, 'completed')}>⊘ End Grant</button>
                ) : (
                  <button style={{ ...s.issueBtn, fontSize: 11.5, padding: '7px 8px', width: '100%', justifyContent: 'center' }} onClick={() => changeGrantStatus(g, 'active')}>↺ Restore to Active</button>
                )}
              </div>
            </div>
          )
        }

        if (filteredGrants.length === 0) {
          if (grants.length === 0) {
            return (
              <EmptyState
                icon="💰"
                title="No grants recorded yet"
                description="Track institutional funding here — government, corporate, or foundation grants — including matching grants, disbursement schedules, and reporting deadlines."
                ctaLabel="+ Record Grant"
                onCta={() => setShowGrantForm(true)}
              />
            )
          }
          return <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No grants match your filters.</div>
        }

        return (
          <>
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.forest, marginBottom: 12 }}>Active Grants ({activeGrants.length})</div>
              {activeGrants.length === 0 ? (
                <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 20px', fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No active grants right now.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'start' }}>
                  {activeGrants.map(renderGrantCard)}
                </div>
              )}
            </div>

            {pastGrants.length > 0 && (
              <div>
                <div
                  style={{ fontSize: 13, fontWeight: 500, color: C.muted, marginBottom: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => setShowPastGrants(v => !v)}
                >
                  <span style={{ fontSize: 11, color: C.muted }}>{showPastGrants ? '▾' : '▸'}</span>
                  Completed / Closed Grants ({pastGrants.length})
                </div>
                {showPastGrants && (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'start' }}>
                    {pastGrants.map(renderGrantCard)}
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
