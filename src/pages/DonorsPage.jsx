import { supabase } from '../supabase'
import { C } from '../theme'
import { s } from '../styles'
import { EmptyState } from '../components/ui/EmptyState'
import { QRCodeSVG } from 'qrcode.react'
import { fillTemplate } from '../lib/format'

export function DonorsPage({
  isMobile, isTablet, selectedDonor, setSelectedDonor, combinedDonorList,
  filterTopDonorNames, setFilterTopDonorNames, filterDonorKeys, setFilterDonorKeys,
  donorFilterLabel, setDonorFilterLabel, activeInsightKey, setActiveInsightKey, dismissInsight,
  searchTerm, setSearchTerm, showDonorFilters, setShowDonorFilters,
  donorStatusFilter, setDonorStatusFilter, majorDonorThreshold,
  donorYearFilter, setDonorYearFilter, donations, fyOf,
  exportDonorsExcel, charityIsIpc, exportIRASExcel, filterYear,
  filteredDonorList, donorsPerPage, setDonorsPerPage, paginatedDonorList,
  loading, activeDonorList, setActiveTab, setShowManualForm, getDonorWarmth,
  orderedDonorColumns, draggedDonorColumn, setDraggedDonorColumn, reorderDonorColumn,
  donorSortBy, setDonorSortBy, donorSortDir, setDonorSortDir,
  pledges, recurringGifts, donorsPage, setDonorsPage, donorsTotalPages,
  deactivatedDonorList, setAddDonorForm, setAddDonorError, setShowAddDonorModal,
  charityName, thankYouThreshold, donorBadgeMap, generateThankYouNote,
  donorProfileTab, setDonorProfileTab, donorContacts,
  savingCommPrefs, setSavingCommPrefs, charityUen, session, loadDonorContacts, showToast,
  savingHousehold, setSavingHousehold, householdLinkSearch, setHouseholdLinkSearch,
  linkDonorToHousehold, unlinkFromHousehold,
  donorReceiptNameOverrides, setDonorReceiptNameOverrides, savingReceiptOverride, setSavingReceiptOverride,
  savingFamilyContact, setSavingFamilyContact, savingVisitSchedule, setSavingVisitSchedule,
  savingBirthday, setSavingBirthday, savingTaxResidency, setSavingTaxResidency,
  savingMailingAddress, setSavingMailingAddress,
  donorNotes, donorNotesLoading, donationBadgeInfo, cumulativeThresholds,
  lapsedMinDays, lapsedMinGifts, allGivingChangeFlags,
  givingChangeAckHistory, setGivingChangeAckHistory, logDonorContact, logDonorContactWithUndo,
  setThankYouDraft, emailTemplates, EMAIL_TEMPLATE_DEFAULTS, buildUpgradeThankYouNote,
  setLapsedReminderCandidate, setShowLapsedReminderModal, donorLastContactMap, lapsedDismissals,
  setRnOutreach, donorHistoryPage, setDonorHistoryPage, causeNameForDonation,
  setSelectedDonation, setQuickEmailInput, setQuickNricInput,
  newNoteType, setNewNoteType, newNoteText, setNewNoteText,
  saveNewDonorNote, savingNote,
  editingDonorNoteId, setEditingDonorNoteId, editingDonorNoteText, setEditingDonorNoteText,
  savingDonorNoteEdit, saveDonorNoteEdit, deleteDonorNote, setViewEmailNote,
  setRecurringSearchTerm, setPledgeSearchTerm, donorTagsMap, deleteDonorTag,
  setDonorContacts, mergeDonorInto, setConfirmModal, setDonations, setToast,
}) {
  return (
    <>
    {/* ── DONORS ── */}
    {!selectedDonor && (
      <div style={s.content}>
        <div style={s.pageHeader}>
          <div>
            <div style={s.pageTitle}>Donors</div>
            <div style={s.pageSub}>{combinedDonorList.length} donors · All time</div>
          </div>
          <button style={s.btnGold} onClick={() => { setAddDonorForm({ full_name: '', email: '', notes: '' }); setAddDonorError(''); setShowAddDonorModal(true) }}>+ Add Donor</button>
        </div>
        {(filterTopDonorNames || filterDonorKeys) && (
          <div style={{ background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 4, padding: '10px 14px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: C.forest, fontWeight: 500 }}>{donorFilterLabel || `Showing top ${(filterTopDonorNames || filterDonorKeys).length} donors by lifetime giving`}</span>
              <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px', marginLeft: 'auto' }} onClick={() => { setFilterTopDonorNames(null); setFilterDonorKeys(null); setDonorFilterLabel(null); setActiveInsightKey(null) }}>✕ Clear</button>
            </div>
            {activeInsightKey && filterDonorKeys && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {filterDonorKeys.map(key => {
                  const d = combinedDonorList.find(x => (x.email?.trim() || x.name) === key)
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.white, border: `1px solid ${C.border}`, borderRadius: 20, padding: '4px 6px 4px 12px' }}>
                      <span style={{ fontSize: 12, color: C.text }}>{d?.name || key}</span>
                      <button
                        title="Mark handled — won't show for this donor again this week"
                        style={{ fontSize: 11, fontWeight: 500, color: C.sage, background: C.successBg, border: 'none', borderRadius: 20, padding: '2px 8px', cursor: 'pointer' }}
                        onClick={() => { dismissInsight(key, activeInsightKey); setFilterDonorKeys(prev => prev.filter(k => k !== key)) }}
                      >✓ Handled</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {(() => {
          return (
            <div style={isMobile ? { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 } : { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
              <input style={isMobile ? s.searchBox : { ...s.searchBox, flex: 'none', width: 240 }} placeholder="🔍 Search donors..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              {isMobile && (
                <button style={{ ...s.viewBtn, width: '100%', justifyContent: 'center' }} onClick={() => setShowDonorFilters(v => !v)}>{showDonorFilters ? '▾ Hide Filters' : '▸ Filters & Export'}</button>
              )}
              {(!isMobile || showDonorFilters) && (<>
              <select style={s.filterSelect} value={donorStatusFilter} onChange={e => setDonorStatusFilter(e.target.value)}>
                <option value="All">All Statuses</option>
                <option value="Active">Active donors</option>
                <option value="Prospect">Prospects (no gift yet)</option>
                <option value="DoNotContact">Do Not Contact</option>
                <option value="Deactivated">Deactivated</option>
                <option value="MajorDonor">Major Donor (${majorDonorThreshold.toLocaleString()}+ lifetime)</option>
              </select>
              <select style={s.filterSelect} value={donorYearFilter} onChange={e => setDonorYearFilter(e.target.value)}>
                <option value="All">All years (last donation)</option>
                {[...new Set(donations.filter(d => d.payment_status === 'confirmed').map(d => fyOf(d.created_at)))].sort((a, b) => b - a).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              {(searchTerm !== '' || donorStatusFilter !== 'All' || donorYearFilter !== 'All') && (
                <button style={{ ...s.viewBtn, whiteSpace: 'nowrap' }} onClick={() => { setSearchTerm(''); setDonorStatusFilter('All'); setDonorYearFilter('All') }}>✕ Clear Filters</button>
              )}
              <button style={isMobile ? { ...s.exportSmallBtn, width: '100%' } : s.exportSmallBtn} onClick={async () => {
                const q = searchTerm.toLowerCase()
                const filtered = combinedDonorList.filter(d => {
                  const matchesSearch = d.name?.toLowerCase().includes(q)
                  const matchesStatus = donorStatusFilter === 'All'
                    || (donorStatusFilter === 'Active' && !d.isContactOnly && !d.deactivated)
                    || (donorStatusFilter === 'Prospect' && d.isContactOnly)
                    || (donorStatusFilter === 'DoNotContact' && d.doNotContact)
                    || (donorStatusFilter === 'Deactivated' && d.deactivated)
                    || (donorStatusFilter === 'MajorDonor' && d.total >= (majorDonorThreshold || 1000))
                  const matchesYear = donorYearFilter === 'All' || (d.lastDate && fyOf(d.lastDate).toString() === donorYearFilter)
                  return matchesSearch && matchesStatus && matchesYear
                })
                showToast('Preparing export...')
                await exportDonorsExcel(filtered)
              }}>⬇️ Export to Excel</button>
              {charityIsIpc && (
                <button style={isMobile ? { ...s.exportSmallBtn, width: '100%' } : s.exportSmallBtn} onClick={() => { if (filterYear === 'All') { showToast('Select a year first to export IRAS data'); return } exportIRASExcel() }}>⬇️ Export IRAS</button>
              )}
              </>)}
            </div>
          )
        })()}
        <div style={s.tableCard}>
          <div style={s.tableHeader}>
            <div style={s.tableTitle}>All Donors</div>
            <div style={s.tableCount}>{filteredDonorList.length > donorsPerPage ? `${paginatedDonorList.length} of ${filteredDonorList.length} records` : `${filteredDonorList.length} records`}</div>
          </div>
          {loading ? <div style={s.empty}>Loading...</div> : activeDonorList.length === 0 ? (
            <EmptyState
              icon="👥"
              title="No donors yet"
              description="Donors appear automatically here as soon as you record your first donation — there's nothing separate to set up."
              ctaLabel="+ Record a Donation"
              onCta={() => { setActiveTab('donations'); setShowManualForm(true) }}
            />
          ) : filteredDonorList.length === 0 ? <div style={s.empty}>No donors match your filters.</div> : (isMobile || isTablet) ? (
            <div>
              {paginatedDonorList.map((d, i) => (
                <div key={i} style={s.donationCard} onClick={() => setSelectedDonor(d)}>
                  <div style={s.donationCardTop}>
                    <div style={s.donationCardDonor}>
                      <div style={{ ...s.donorAvatar, background: (() => { const w = getDonorWarmth(d); return w.level === 'green' ? C.sage : w.level === 'amber' ? C.gold : C.red })() }}>{d.name?.charAt(0)}</div>
                      <div>
                        <div style={s.donationCardName}>{d.name}</div>
                        <div style={s.donationCardDate}>{d.isContactOnly ? 'No donations yet' : `${d.count} donation${d.count > 1 ? 's' : ''} · Last ${new Date(d.lastDate).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}`}</div>
                      </div>
                    </div>
                    <div style={s.donationCardAmount}>${d.total.toLocaleString()}</div>
                  </div>
                  <div style={s.donationCardBadges}>
                    {d.isContactOnly ? (
                      <span style={{ ...s.badgePending, color: C.gold, background: '#FBF2DE' }}>👤 Prospect — no gift yet</span>
                    ) : (
                      <span style={d.receipts === d.count ? s.badgeIssued : s.badgePending}>{d.receipts}/{d.count} receipts issued</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <table style={s.table}>
              <thead>
              <tr>{(isTablet
                ? [{ key: 'name', label: 'Donor' }, { key: 'total', label: 'Total Given' }, { key: 'avg', label: 'Avg. Donation' }]
                : [{ key: 'name', label: 'Donor' }, ...orderedDonorColumns]
              ).map(h => (
                <th
                  key={h.key}
                  draggable={!isTablet && h.key !== 'name'}
                  onDragStart={() => setDraggedDonorColumn(h.key)}
                  onDragOver={e => { if (!isTablet && h.key !== 'name') e.preventDefault() }}
                  onDrop={e => { e.preventDefault(); reorderDonorColumn(draggedDonorColumn, h.key); setDraggedDonorColumn(null) }}
                  onDragEnd={() => setDraggedDonorColumn(null)}
                  style={{ ...s.th, width: h.key === 'name' ? 260 : undefined, whiteSpace: 'nowrap', cursor: h.key === 'name' ? 'pointer' : 'grab', userSelect: 'none', opacity: draggedDonorColumn === h.key ? 0.4 : 1 }}
                  onClick={() => setDonorSortBy(prev => { if (prev === h.key) { setDonorSortDir(d => d === 'asc' ? 'desc' : 'asc') } else { setDonorSortDir('desc') }; return h.key })}
                  title={h.key !== 'name' ? 'Drag to reorder · click to sort' : 'Click to sort'}
                >{h.label}{donorSortBy === h.key ? (donorSortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              ))}</tr>
              </thead>
              <tbody>
                {paginatedDonorList.map((d, i) => {
                  const avgDonationForDonor = d.count > 0 ? Math.round(d.total / d.count) : 0
                  const donorKey = d.email?.trim() || d.name
                  const warmthColorRow = (() => { const w = getDonorWarmth(d); return w.level === 'green' ? C.sage : w.level === 'amber' ? C.gold : C.red })()
                  return (
                    <tr key={i} style={{ ...s.tr, cursor: 'pointer' }} onClick={() => setSelectedDonor(d)}>
                      <td style={s.td}>
                        <div style={s.donorCell}>
                          <div style={{ ...s.donorAvatar, background: warmthColorRow }}>{d.name?.charAt(0)}</div>
                          <div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                              <div style={s.donorName}>{d.name}</div>
                              {d.doNotContact && <span style={{ fontSize: 10, fontWeight: 600, color: C.red, background: '#FBEEE9', padding: '2px 7px', borderRadius: 4 }}>🚫 DNC</span>}
                              {d.isContactOnly && <span style={{ fontSize: 10, fontWeight: 600, color: C.gold, background: '#FBF2DE', padding: '2px 7px', borderRadius: 4 }}>👤 Prospect</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      {isTablet ? (
                        <>
                          <td style={s.td}><span style={s.amountText}>${d.total.toLocaleString()}</span></td>
                          <td style={s.td}><span style={s.amountText}>{d.count > 0 ? `$${avgDonationForDonor.toLocaleString()}` : '—'}</span></td>
                        </>
                      ) : (() => {
                        const openPledge = pledges.find(p => p.status === 'pending' && (p.donor_email?.trim() || p.donor_name) === donorKey)
                        const activeRecurring = recurringGifts.find(g => g.status === 'active' && (g.donor_email?.trim() || g.donor_name) === donorKey)
                        const cellRenderers = {
                          total: <td key="total" style={s.td}><span style={s.amountText}>${d.total.toLocaleString()}</span></td>,
                          count: <td key="count" style={s.td}><span style={s.dateText}>{d.count} donation{d.count !== 1 ? 's' : ''}</span></td>,
                          avg: <td key="avg" style={s.td}><span style={s.amountText}>{d.count > 0 ? `$${avgDonationForDonor.toLocaleString()}` : '—'}</span></td>,
                          lastDate: <td key="lastDate" style={s.td}><span style={s.dateText}>{d.lastDate ? new Date(d.lastDate).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span></td>,
                          recurring: (
                            <td key="recurring" style={s.td}>
                              {activeRecurring ? <span style={s.badgeIssued}>🔁 ${activeRecurring.amount}/{activeRecurring.frequency}</span> : <span style={{ fontSize: 11, color: C.muted }}>—</span>}
                            </td>
                          ),
                          warmth: (
                            <td key="warmth" style={s.td}>
                              {(() => {
                                const w76 = getDonorWarmth(d)
                                const wColor76 = w76.level === 'green' ? C.sage : w76.level === 'amber' ? C.gold : C.red
                                return (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                    <div style={{ width: 13, height: 13, borderRadius: '50%', background: wColor76, flexShrink: 0, boxShadow: `0 0 0 3px ${wColor76}26` }} />
                                    <span style={{ fontSize: 11, color: C.muted }}>{w76.label}</span>
                                  </div>
                                )
                              })()}
                            </td>
                          ),
                          pledge: (
                            <td key="pledge" style={s.td}>
                              {openPledge ? <span style={s.badgePending}>${openPledge.amount.toLocaleString()} pending</span> : <span style={{ fontSize: 11, color: C.muted }}>—</span>}
                            </td>
                          ),
                        }
                        return orderedDonorColumns.map(o => cellRenderers[o.key])
                      })()}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {filteredDonorList.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: `1px solid ${C.border}`, flexWrap: 'wrap', gap: 10 }}>
              <select style={{ ...s.filterSelect, padding: '6px 10px', fontSize: 12 }} value={donorsPerPage} onChange={e => { setDonorsPerPage(parseInt(e.target.value)); setDonorsPage(0) }}>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  style={{ ...s.viewBtn, opacity: donorsPage === 0 ? 0.4 : 1, cursor: donorsPage === 0 ? 'not-allowed' : 'pointer' }}
                  disabled={donorsPage === 0}
                  onClick={() => setDonorsPage(p => Math.max(0, p - 1))}
                >← Previous</button>
                <span style={{ fontSize: 12, color: C.muted }}>Page {donorsPage + 1} of {donorsTotalPages}</span>
                <button
                  style={{ ...s.viewBtn, opacity: donorsPage >= donorsTotalPages - 1 ? 0.4 : 1, cursor: donorsPage >= donorsTotalPages - 1 ? 'not-allowed' : 'pointer' }}
                  disabled={donorsPage >= donorsTotalPages - 1}
                  onClick={() => setDonorsPage(p => Math.min(donorsTotalPages - 1, p + 1))}
                >Next →</button>
              </div>
            </div>
          )}
        </div>
        {deactivatedDonorList.length > 0 && (
          <div style={{ ...s.tableCard, marginTop: 24, opacity: 0.7 }}>
            <div style={s.tableHeader}>
              <div style={s.tableTitle}>Deactivated Donors</div>
              <div style={s.tableCount}>{deactivatedDonorList.length} donors · hidden from active lists</div>
            </div>
            <div>
              {deactivatedDonorList.filter(d => d.name?.toLowerCase().includes(searchTerm.toLowerCase())).map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${C.ivoryDark}` }}>
                  <div style={{ ...s.donorAvatar, background: C.muted }}>{d.name?.charAt(0)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.muted }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{d.count} donation{d.count > 1 ? 's' : ''} · ${d.total.toLocaleString()} total</div>
                  </div>
                  <span style={{ ...s.badgePending, color: C.muted, background: C.ivoryDark }}>Deactivated</span>
                  <button style={s.viewBtn} onClick={() => setSelectedDonor(d)}>View</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )}

    {/* ── DONOR DETAIL ── */}
    {selectedDonor && (
      <div style={s.content}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button style={s.backBtn} onClick={() => setSelectedDonor(null)}>← Back to Donors</button>
        </div>
        {selectedDonor.doNotContact && (
          <div style={{ background: '#FBEEE9', border: `1px solid ${C.red}`, borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.red }}>🚫 Do Not Contact — this donor is excluded from all emails, appeals, and outreach.</span>
          </div>
        )}
        <div style={isMobile ? { display: 'flex', flexDirection: 'column', gap: 16 } : { display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, alignItems: 'start' }}>
          <div>
            <div style={{ background: C.forest, borderRadius: 4, padding: '20px 18px', marginBottom: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: (() => { const w = getDonorWarmth(selectedDonor); return w.level === 'green' ? C.sage : w.level === 'amber' ? C.gold : C.red })(), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontFamily: C.fontVoice, fontWeight: 500, marginBottom: 12 }}>{selectedDonor.name?.charAt(0)}</div>
              <div style={{ fontFamily: C.fontVoice, fontSize: 19, fontWeight: 500, color: 'white', marginBottom: 4 }}>{selectedDonor.name}</div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)' }}>Donor since {new Date(donations.filter(d => (d.donor_email?.trim() || d.donor_name) === (selectedDonor.email?.trim() || selectedDonor.name)).slice(-1)[0]?.created_at).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })}</div>
              {(() => {
                const donorKeyHdr = selectedDonor.email?.trim() || selectedDonor.name
                const linkedPhone = [...pledges, ...recurringGifts].find(r => (r.donor_email?.trim() || r.donor_name) === donorKeyHdr)?.donor_phone
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
                      {selectedDonor.email ? `✉ ${selectedDonor.email}` : <span style={{ color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' }}>✉ No email on file</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
                      {linkedPhone ? `📞 ${linkedPhone}` : <span style={{ color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' }}>📞 No phone on file</span>}
                    </div>
                    {charityIsIpc && (
                      <div style={{ fontSize: 12, color: selectedDonor.nric ? 'rgba(255,255,255,0.85)' : '#F0B8A8' }}>
                        {selectedDonor.nric ? `🪪 NRIC on file` : `🪪 NRIC missing — required for tax receipt`}
                      </div>
                    )}
                  </div>
                )
              })()}
              {(() => {
                const warmth76 = getDonorWarmth(selectedDonor)
                const warmthColor76 = warmth76.level === 'green' ? '#74C69D' : warmth76.level === 'amber' ? '#E8CC7A' : '#E0A599'
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: warmthColor76 }} />
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{warmth76.label}</span>
                  </div>
                )
              })()}

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: 14, paddingTop: 14 }}>
                <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>Giving Summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>Total Given</div>
                    <div style={{ fontFamily: C.fontVoice, fontSize: 20, fontWeight: 500, color: 'white' }}>${(selectedDonor.total || 0).toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>Donations</div>
                    <div style={{ fontFamily: C.fontMono, fontSize: 20, fontWeight: 500, color: 'white' }}>{selectedDonor.count || 0}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>Avg. Donation</div>
                    <div style={{ fontFamily: C.fontVoice, fontSize: 20, fontWeight: 500, color: 'white' }}>${selectedDonor.count > 0 ? ((selectedDonor.total || 0) / selectedDonor.count).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>Receipts</div>
                    <div style={{ fontFamily: C.fontMono, fontSize: 20, fontWeight: 500, color: 'white' }}>{selectedDonor.receipts || 0}/{selectedDonor.count || 0}</div>
                  </div>
                </div>
                {charityIsIpc && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>250% Tax Deductible</span>
                      <span style={{ fontFamily: C.fontMono, fontSize: 11.5, fontWeight: 500, color: 'white' }}>${((selectedDonor.total || 0) * 2.5).toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>Est. Tax Savings (22%)</span>
                      <span style={{ fontFamily: C.fontMono, fontSize: 11.5, fontWeight: 500, color: '#9FD9BC' }}>${((selectedDonor.total || 0) * 2.5 * 0.22).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                )}
                {(() => {
                  const key = selectedDonor.email?.trim() || selectedDonor.name
                  const b = donorBadgeMap[key]
                  if (!b || !(b.isFirstTime || b.isBigGift || b.isLoyal || b.isBiggestYet || b.isMajorDonor)) return null
                  return (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                      <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>Milestones</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: b.hasUnackedBadge ? 12 : 0 }}>
                        {b.isFirstTime && <span style={{ fontSize: 11, fontWeight: 600, color: C.gold, background: 'rgba(255,255,255,0.12)', padding: '3px 9px', borderRadius: 20 }}>🆕 First donation</span>}
                        {b.isBigGift && <span style={{ fontSize: 11, fontWeight: 600, color: 'white', background: 'rgba(255,255,255,0.12)', padding: '3px 9px', borderRadius: 20 }}>💰 ${thankYouThreshold}+ gift</span>}
                        {b.isLoyal && <span style={{ fontSize: 11, fontWeight: 600, color: '#9FD9BC', background: 'rgba(255,255,255,0.12)', padding: '3px 9px', borderRadius: 20 }}>🔁 Loyal donor</span>}
                        {b.isBiggestYet && <span style={{ fontSize: 11, fontWeight: 600, color: C.gold, background: 'rgba(255,255,255,0.12)', padding: '3px 9px', borderRadius: 20 }}>📈 Biggest gift yet</span>}
                        {b.isMajorDonor && <span style={{ fontSize: 11, fontWeight: 600, color: C.gold, background: 'rgba(255,255,255,0.12)', padding: '3px 9px', borderRadius: 20 }}>🏆 Major donor</span>}
                      </div>
                      {b.hasUnackedBadge && (
                        <button style={{ ...s.btnGold, justifyContent: 'center', width: '100%' }} onClick={() => generateThankYouNote(selectedDonor, b)}>✍️ Generate thank-you note</button>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>

          <div>
        <div style={{ display: 'flex', gap: 6, borderBottom: `1px solid ${C.border}`, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { key: 'donations', icon: '💳', label: 'Donations' },
            { key: 'logs', icon: '📞', label: 'Logs' },
            { key: 'recurring', icon: '🔁', label: 'Recurring' },
            { key: 'pledges', icon: '🤝', label: 'Pledges' },
            { key: 'details', icon: '📇', label: 'Preferences' },
            { key: 'settings', icon: '⚙️', label: 'Settings' },
          ].map(sec => (
            <div
              key={sec.key}
              onClick={() => setDonorProfileTab(sec.key)}
              style={{
                padding: '9px 16px',
                fontSize: 12.5,
                fontWeight: 500,
                color: donorProfileTab === sec.key ? C.forest : C.muted,
                borderBottom: donorProfileTab === sec.key ? `2px solid ${C.forest}` : '2px solid transparent',
                marginBottom: -1,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
              }}
            >
              <span>{sec.icon}</span> {sec.label}
            </div>
          ))}
        </div>

            {donorProfileTab === 'settings' && (
            <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Duplicate Donor?</div>
              <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 12 }}>If this is the same person as another donor record, merge their giving history together. This cannot be undone.</div>
              {(() => {
                const norm39 = s => (s || '').trim().toLowerCase().replace(/\s+/g, ' ')
                // Levenshtein edit distance — catches genuine typo variants of the same name.
                const lev39 = (a, b) => {
                  const m = a.length, n = b.length
                  if (!m) return n; if (!n) return m
                  let prev = Array.from({ length: n + 1 }, (_, i) => i)
                  for (let i = 1; i <= m; i++) {
                    const cur = [i]
                    for (let j = 1; j <= n; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1])
                    prev = cur
                  }
                  return prev[n]
                }
                const nric39 = s => (s || '').trim().toUpperCase()
                const phone39 = (emailOrName) => { const rec = [...pledges, ...recurringGifts].find(r => (r.donor_email?.trim() || r.donor_name) === emailOrName); const p = (rec?.donor_phone || '').replace(/\D/g, ''); return p.length >= 8 ? p.slice(-8) : '' }
                const enteredName39 = norm39(selectedDonor.name)
                const selKey39 = selectedDonor.email?.trim() || selectedDonor.name
                const selEmail39 = selectedDonor.email?.trim().toLowerCase() || ''
                const selNric39 = nric39(selectedDonor.nric)
                const selPhone39 = phone39(selKey39)
                // Match order: strong identity signals (email / NRIC / phone) first, then a name
                // look-alike (exact, full-name-contained, or 1–2 char typo). A shared surname alone
                // ("Quentin Low" vs "Natalie Low") must NOT match. Each result shows why it matched.
                const rank39 = { 'same email': 0, 'same NRIC': 1, 'same phone': 2, 'same name': 3, 'similar name': 4 }
                const similarDonors39 = combinedDonorList.map(d => {
                  const dKey = d.email?.trim() || d.name
                  if (dKey === selKey39) return null
                  const dEmail = d.email?.trim().toLowerCase() || ''
                  const dNric = nric39(d.nric)
                  const dPhone = phone39(dKey)
                  let reason = null
                  if (selEmail39 && dEmail && selEmail39 === dEmail) reason = 'same email'
                  else if (selNric39 && dNric && selNric39 === dNric) reason = 'same NRIC'
                  else if (selPhone39 && dPhone && selPhone39 === dPhone) reason = 'same phone'
                  else {
                    const existing = norm39(d.name)
                    if (existing && enteredName39) {
                      if (existing === enteredName39) reason = 'same name'
                      else {
                        const shorter = existing.length <= enteredName39.length ? existing : enteredName39
                        const longer = existing.length <= enteredName39.length ? enteredName39 : existing
                        if (shorter.includes(' ') && longer.includes(shorter)) reason = 'similar name'
                        else if (Math.max(existing.length, enteredName39.length) >= 6 && lev39(existing, enteredName39) <= 2) reason = 'similar name'
                      }
                    }
                  }
                  return reason ? { ...d, matchReason: reason } : null
                }).filter(Boolean).sort((a, b) => rank39[a.matchReason] - rank39[b.matchReason])
                if (similarDonors39.length === 0) return <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}>No likely duplicates found.</div>
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {similarDonors39.slice(0, 3).map((d, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px' }}>
                        <span style={{ fontSize: 12.5, color: C.forest }}><strong>{d.name}</strong> — {d.count} gift{d.count !== 1 ? 's' : ''}, ${d.total.toLocaleString()} <span style={{ fontSize: 10.5, color: C.muted, background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '1px 6px', marginLeft: 4 }}>{d.matchReason}</span></span>
                        <button
                          style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px' }}
                          onClick={() => {
                            setConfirmModal({
                              title: `Merge ${selectedDonor.name} into ${d.name}?`,
                              subtitle: `All of ${selectedDonor.name}'s donations will be reassigned to ${d.name}. This cannot be undone.`,
                              confirmLabel: 'Merge donors',
                              onConfirm: () => mergeDonorInto(selectedDonor, d.email?.trim() || d.name),
                            })
                          }}
                        >Merge into this donor</button>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
            )}

            {donorProfileTab === 'details' && (<>
            <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Communication Preferences</div>
              {(() => {
                const donorKey44 = selectedDonor.email?.trim() || selectedDonor.name
                const contact44 = donorContacts.find(c => (c.email?.trim() || c.full_name) === donorKey44)
                return (
                  <div>
                    <label style={{ display: 'block', marginBottom: 10 }}>
                      <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 4 }}>Preferred channel</div>
                      <select style={s.formInput} defaultValue={contact44?.preferred_channel || ''} id={`pref-channel-${donorKey44}`}>
                        <option value="">No preference set</option>
                        <option value="email">Email</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="phone">Phone</option>
                        <option value="post">Post</option>
                      </select>
                    </label>
                    <label style={{ display: 'block', marginBottom: 10 }}>
                      <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 4 }}>Preferred timing</div>
                      <input style={s.formInput} placeholder="e.g. weekday mornings, not evenings" defaultValue={contact44?.preferred_timing || ''} id={`pref-timing-${donorKey44}`} />
                    </label>
                    <label style={{ display: 'block', marginBottom: 10 }}>
                      <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 4 }}>Restrictions</div>
                      <textarea style={{ ...s.formInput, minHeight: 50, resize: 'vertical' }} placeholder="e.g. no calls at work, appeals only, no event invites" defaultValue={contact44?.communication_restrictions || ''} id={`pref-restrictions-${donorKey44}`} />
                    </label>
                    <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} disabled={savingCommPrefs} onClick={async () => {
                      if (savingCommPrefs) return
                      setSavingCommPrefs(true)
                      const channel = document.getElementById(`pref-channel-${donorKey44}`).value
                      const timing = document.getElementById(`pref-timing-${donorKey44}`).value.trim()
                      const restrictions = document.getElementById(`pref-restrictions-${donorKey44}`).value.trim()
                      if (contact44) {
                        await supabase.from('charity_donor_contacts').update({ preferred_channel: channel || null, preferred_timing: timing || null, communication_restrictions: restrictions || null }).eq('id', contact44.id)
                      } else {
                        await supabase.from('charity_donor_contacts').insert({ charity_uen: charityUen, full_name: selectedDonor.name, email: selectedDonor.email || null, preferred_channel: channel || null, preferred_timing: timing || null, communication_restrictions: restrictions || null, created_by: session.user.email })
                      }
                      await supabase.from('audit_log').insert({ actor_type: 'charity', actor_email: session.user.email, action: 'donor_contact_prefs_edited', details: { donor_name: selectedDonor.name, charity_uen: charityUen } })
                      showToast('Saved ✓')
                      await loadDonorContacts()
                      setSavingCommPrefs(false)
                    }}>{savingCommPrefs ? 'Saving...' : 'Save Preferences'}</button>
                  </div>
                )
              })()}
            </div>

            <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Household</div>
              {(() => {
                const donorKey43 = selectedDonor.email?.trim() || selectedDonor.name
                const myContact43 = donorContacts.find(c => (c.email?.trim() || c.full_name) === donorKey43)
                const householdMembers43 = myContact43?.household_id
                  ? donorContacts.filter(c => c.household_id === myContact43.household_id && c.id !== myContact43.id)
                  : []
                if (myContact43?.household_id && householdMembers43.length > 0) {
                  const householdTotal43 = combinedDonorList
                    .filter(d => [selectedDonor, ...householdMembers43.map(m => ({ name: m.full_name, email: m.email }))]
                      .some(m => (m.email?.trim() || m.name) === (d.email?.trim() || d.name)))
                    .reduce((s, d) => s + (d.total || 0), 0)
                  return (
                    <div>
                      <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10 }}>Combined household giving: <strong style={{ color: C.forest }}>${householdTotal43.toLocaleString()}</strong></div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {householdMembers43.map(m => (
                          <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px' }}>
                            <span style={{ fontSize: 12.5, color: C.forest }}>{m.full_name}</span>
                            <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px' }} onClick={() => unlinkFromHousehold({ name: m.full_name, email: m.email })}>Unlink</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                }
                return (
                  <div>
                    <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10 }}>Link this donor to a spouse or family member to see combined household giving.</div>
                    <input
                      style={{ ...s.formInput, marginBottom: 8 }}
                      placeholder="Search donor by name..."
                      aria-label="Search donor by name"
                      value={householdLinkSearch}
                      onChange={e => setHouseholdLinkSearch(e.target.value)}
                    />
                    {householdLinkSearch.trim() && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                        {combinedDonorList.filter(d =>
                          (d.email?.trim() || d.name) !== donorKey43 &&
                          d.name.toLowerCase().includes(householdLinkSearch.toLowerCase())
                        ).slice(0, 5).map((d, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px' }}>
                            <span style={{ fontSize: 12.5, color: C.forest }}>{d.name}</span>
                            <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px' }} disabled={savingHousehold} onClick={async () => { if (savingHousehold) return; setSavingHousehold(true); await linkDonorToHousehold(selectedDonor, d); setHouseholdLinkSearch(''); setSavingHousehold(false) }}>{savingHousehold ? 'Linking...' : 'Link'}</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Receipt Name Override</div>
              <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 12 }}>If this donor's receipts should show a different name (e.g. a spouse or company), set it once here — it'll apply to all future receipts automatically.</div>
              {(() => {
                const donorKey31 = selectedDonor.email?.trim() || selectedDonor.name
                const existingContact = donorContacts.find(c => (c.email?.trim() || c.full_name) === donorKey31)
                const [localOverride] = [donorReceiptNameOverrides[donorKey31] || '', null]
                return (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      style={{ ...s.formInput, flex: 1 }}
                      placeholder="Leave blank to use donor name"
                      aria-label="Receipt name override"
                      defaultValue={localOverride}
                      id={`receipt-override-${donorKey31}`}
                    />
                    <button style={{ ...s.viewBtn, flexShrink: 0 }} disabled={savingReceiptOverride} onClick={async () => {
                      if (savingReceiptOverride) return
                      setSavingReceiptOverride(true)
                      const inputEl = document.getElementById(`receipt-override-${donorKey31}`)
                      const value = inputEl.value.trim()
                      if (existingContact) {
                        const { error } = await supabase.from('charity_donor_contacts').update({ receipt_name_override: value || null }).eq('id', existingContact.id)
                        if (error) { showToast('Error saving', 'error'); setSavingReceiptOverride(false); return }
                      } else {
                        const { error } = await supabase.from('charity_donor_contacts').insert({
                          charity_uen: charityUen,
                          full_name: selectedDonor.name,
                          email: selectedDonor.email || null,
                          receipt_name_override: value || null,
                          created_by: session.user.email,
                        })
                        if (error) { showToast('Error saving', 'error'); setSavingReceiptOverride(false); return }
                      }
                      setDonorReceiptNameOverrides(prev => ({ ...prev, [donorKey31]: value }))
                      await supabase.from('audit_log').insert({ actor_type: 'charity', actor_email: session.user.email, action: 'donor_receipt_name_override_edited', details: { donor_name: selectedDonor.name, receipt_name_override: value || null, charity_uen: charityUen } })
                      showToast('Saved ✓')
                      await loadDonorContacts()
                      setSavingReceiptOverride(false)
                    }}>{savingReceiptOverride ? 'Saving...' : 'Save'}</button>
                  </div>
                )
              })()}
            </div>

            {selectedDonor.deceased && (
            <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Family / Estate Contact</div>
              <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 12 }}>Who to reach instead, since this donor is marked deceased.</div>
              {(() => {
                const donorKey41b = selectedDonor.email?.trim() || selectedDonor.name
                const existingContact41b = donorContacts.find(c => (c.email?.trim() || c.full_name) === donorKey41b)
                return (
                  <div>
                    <input
                      style={{ ...s.formInput, fontSize: 12 }}
                      placeholder="Name and contact info"
                      aria-label="Family / estate contact"
                      defaultValue={existingContact41b?.linked_family_contact || ''}
                      id={`family-contact-${donorKey41b}`}
                      maxLength={300}
                    />
                    <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', marginTop: 6 }} disabled={savingFamilyContact} onClick={async () => {
                      if (savingFamilyContact) return
                      setSavingFamilyContact(true)
                      const value = document.getElementById(`family-contact-${donorKey41b}`).value.trim()
                      if (existingContact41b) {
                        await supabase.from('charity_donor_contacts').update({ linked_family_contact: value || null }).eq('id', existingContact41b.id)
                      } else {
                        await supabase.from('charity_donor_contacts').insert({ charity_uen: charityUen, full_name: selectedDonor.name, email: selectedDonor.email || null, linked_family_contact: value || null, created_by: session.user.email })
                      }
                      await supabase.from('audit_log').insert({ actor_type: 'charity', actor_email: session.user.email, action: 'donor_family_contact_edited', details: { donor_name: selectedDonor.name, charity_uen: charityUen } })
                      showToast('Saved ✓')
                      await loadDonorContacts()
                      setSavingFamilyContact(false)
                    }}>{savingFamilyContact ? 'Saving...' : 'Save'}</button>
                  </div>
                )
              })()}
            </div>
            )}

            <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Visit Scheduling</div>
              <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 12 }}>For major donors — track in-person visits.</div>
              {(() => {
                const donorKey80 = selectedDonor.email?.trim() || selectedDonor.name
                const existingContact80 = donorContacts.find(c => (c.email?.trim() || c.full_name) === donorKey80)
                return (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 6 }}>
                      <label style={{ display: 'block' }}>
                        <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 3 }}>Last visited</div>
                        <input style={{ ...s.formInput, fontSize: 12 }} type="date" defaultValue={existingContact80?.last_visited_date || ''} id={`last-visited-${donorKey80}`} />
                      </label>
                      <label style={{ display: 'block' }}>
                        <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 3 }}>Next visit planned</div>
                        <input style={{ ...s.formInput, fontSize: 12 }} type="date" defaultValue={existingContact80?.next_visit_planned_date || ''} id={`next-visit-${donorKey80}`} />
                      </label>
                    </div>
                    <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} disabled={savingVisitSchedule} onClick={async () => {
                      if (savingVisitSchedule) return
                      const lastVisited = document.getElementById(`last-visited-${donorKey80}`).value
                      const nextVisit = document.getElementById(`next-visit-${donorKey80}`).value
                      if (lastVisited && nextVisit && nextVisit < lastVisited) { showToast('Next visit date cannot be before last visited date', 'error'); return }
                      setSavingVisitSchedule(true)
                      if (existingContact80) {
                        await supabase.from('charity_donor_contacts').update({ last_visited_date: lastVisited || null, next_visit_planned_date: nextVisit || null }).eq('id', existingContact80.id)
                      } else {
                        await supabase.from('charity_donor_contacts').insert({ charity_uen: charityUen, full_name: selectedDonor.name, email: selectedDonor.email || null, last_visited_date: lastVisited || null, next_visit_planned_date: nextVisit || null, created_by: session.user.email })
                      }
                      await supabase.from('audit_log').insert({ actor_type: 'charity', actor_email: session.user.email, action: 'donor_visit_schedule_edited', details: { donor_name: selectedDonor.name, last_visited_date: lastVisited || null, next_visit_planned_date: nextVisit || null, charity_uen: charityUen } })
                      showToast('Saved ✓')
                      await loadDonorContacts()
                      setSavingVisitSchedule(false)
                    }}>{savingVisitSchedule ? 'Saving...' : 'Save'}</button>
                  </div>
                )
              })()}
            </div>

            <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Birthday</div>
              <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 12 }}>Optional — used to flag upcoming birthdays.</div>
              {(() => {
                const donorKey70 = selectedDonor.email?.trim() || selectedDonor.name
                const existingContact70 = donorContacts.find(c => (c.email?.trim() || c.full_name) === donorKey70)
                return (
                  <div>
                    <input
                      style={{ ...s.formInput, fontSize: 12 }}
                      type="date"
                      aria-label="Birthday"
                      defaultValue={existingContact70?.birth_date || ''}
                      id={`birth-date-${donorKey70}`}
                    />
                    <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', marginTop: 6 }} disabled={savingBirthday} onClick={async () => {
                      if (savingBirthday) return
                      setSavingBirthday(true)
                      const value = document.getElementById(`birth-date-${donorKey70}`).value
                      if (existingContact70) {
                        await supabase.from('charity_donor_contacts').update({ birth_date: value || null }).eq('id', existingContact70.id)
                      } else {
                        await supabase.from('charity_donor_contacts').insert({ charity_uen: charityUen, full_name: selectedDonor.name, email: selectedDonor.email || null, birth_date: value || null, created_by: session.user.email })
                      }
                      await supabase.from('audit_log').insert({ actor_type: 'charity', actor_email: session.user.email, action: 'donor_birthday_edited', details: { donor_name: selectedDonor.name, charity_uen: charityUen } })
                      showToast('Saved ✓')
                      await loadDonorContacts()
                      setSavingBirthday(false)
                    }}>{savingBirthday ? 'Saving...' : 'Save'}</button>
                  </div>
                )
              })()}
            </div>

            <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Tax Residency</div>
              <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 12 }}>Informational — for donors requesting specific documentation formats.</div>
              {(() => {
                const donorKey48 = selectedDonor.email?.trim() || selectedDonor.name
                const existingContact48 = donorContacts.find(c => (c.email?.trim() || c.full_name) === donorKey48)
                return (
                  <div>
                    <input
                      style={{ ...s.formInput, fontSize: 12 }}
                      placeholder="e.g. Singapore, Malaysia, Australia"
                      aria-label="Tax residency country"
                      defaultValue={existingContact48?.tax_residency_country || ''}
                      id={`tax-residency-${donorKey48}`}
                      maxLength={100}
                    />
                    <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', marginTop: 6 }} disabled={savingTaxResidency} onClick={async () => {
                      if (savingTaxResidency) return
                      setSavingTaxResidency(true)
                      const value = document.getElementById(`tax-residency-${donorKey48}`).value.trim()
                      if (existingContact48) {
                        await supabase.from('charity_donor_contacts').update({ tax_residency_country: value || null }).eq('id', existingContact48.id)
                      } else {
                        await supabase.from('charity_donor_contacts').insert({ charity_uen: charityUen, full_name: selectedDonor.name, email: selectedDonor.email || null, tax_residency_country: value || null, created_by: session.user.email })
                      }
                      await supabase.from('audit_log').insert({ actor_type: 'charity', actor_email: session.user.email, action: 'donor_tax_residency_edited', details: { donor_name: selectedDonor.name, tax_residency_country: value || null, charity_uen: charityUen } })
                      showToast('Saved ✓')
                      await loadDonorContacts()
                      setSavingTaxResidency(false)
                    }}>{savingTaxResidency ? 'Saving...' : 'Save'}</button>
                  </div>
                )
              })()}
            </div>

            <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Mailing Address</div>
              <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 12 }}>Only needed if this donor wants receipts mailed physically.</div>
              {(() => {
                const donorKey31b = selectedDonor.email?.trim() || selectedDonor.name
                const existingContact31b = donorContacts.find(c => (c.email?.trim() || c.full_name) === donorKey31b)
                return (
                  <div>
                    <textarea
                      style={{ ...s.formInput, minHeight: 60, resize: 'vertical', fontSize: 12 }}
                      placeholder="Optional — only needed if this donor wants receipts mailed"
                      aria-label="Mailing address"
                      defaultValue={existingContact31b?.mailing_address || ''}
                      id={`mailing-address-${donorKey31b}`}
                      maxLength={500}
                    />
                    <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', marginTop: 6 }} disabled={savingMailingAddress} onClick={async () => {
                      if (savingMailingAddress) return
                      setSavingMailingAddress(true)
                      const value = document.getElementById(`mailing-address-${donorKey31b}`).value.trim()
                      if (existingContact31b) {
                        await supabase.from('charity_donor_contacts').update({ mailing_address: value || null }).eq('id', existingContact31b.id)
                      } else {
                        await supabase.from('charity_donor_contacts').insert({ charity_uen: charityUen, full_name: selectedDonor.name, email: selectedDonor.email || null, mailing_address: value || null, created_by: session.user.email })
                      }
                      await supabase.from('audit_log').insert({ actor_type: 'charity', actor_email: session.user.email, action: 'donor_mailing_address_edited', details: { donor_name: selectedDonor.name, charity_uen: charityUen } })
                      showToast('Saved ✓')
                      await loadDonorContacts()
                      setSavingMailingAddress(false)
                    }}>{savingMailingAddress ? 'Saving...' : 'Save Address'}</button>
                  </div>
                )
              })()}
            </div>

            <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 4 }}>Personal PayNow QR</div>
              <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 12 }}>A standing code for this donor to use anytime — not tied to any campaign or amount. Print and mail once.</div>
              {(() => {
                const donorKey16 = selectedDonor.email?.trim() || selectedDonor.name
                let hash16 = 0
                for (let i = 0; i < donorKey16.length; i++) { hash16 = (hash16 * 31 + donorKey16.charCodeAt(i)) >>> 0 }
                const personalRef16 = `D${hash16.toString(36).toUpperCase().slice(0, 8)}`
                const personalQrValue = `https://www.paynow.com.sg/pay?uen=${charityUen}&ref=${personalRef16}`
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <div style={{ background: 'white', padding: 12, borderRadius: 8, border: `1px solid ${C.border}` }}>
                      <QRCodeSVG value={personalQrValue} size={160} level="H" />
                    </div>
                    <div style={{ fontFamily: C.fontMono, fontSize: 12, color: C.muted }}>Ref: {personalRef16}</div>
                    <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} onClick={() => {
                      showToast('Right-click the QR above to save the image, or use Print (Ctrl/Cmd+P)')
                    }}>ℹ️ How to print/mail this</button>
                  </div>
                )
              })()}
            </div>
            </>)}

            {donorProfileTab === 'donations' && (
              <div>
            {(() => {
              // "Right now" — surfaces the donor-moment triggers this specific donor is currently
              // flagged for (the same ones that drive the dashboard Worth-knowing list), each with
              // a one-tap route to log the outreach. Lapsed + giving-change keep their own cards
              // below. A moment clears once you log a contact this week (or the gift is thanked).
              // Never surface outreach prompts for a deceased or do-not-contact donor.
              if (selectedDonor.deceased || selectedDonor.doNotContact) return null
              const dk = selectedDonor.email?.trim() || selectedDonor.name
              const rnToday = new Date(); rnToday.setHours(0, 0, 0, 0)
              const rnWeekAgo = new Date(rnToday.getTime() - 7 * 24 * 60 * 60 * 1000)
              const rnMonthAgo = new Date(rnToday.getTime() - 30 * 24 * 60 * 60 * 1000)
              const myConfirmed = donations.filter(d => (d.donor_email?.trim() || d.donor_name) === dk && d.payment_status === 'confirmed')
              const contact = donorContacts.find(c => (c.email?.trim() || c.full_name) === dk)
              const moments = []
              const first = (selectedDonor.name || '').split(' ')[0] || selectedDonor.name || 'friend'
              const sign = `\n\nWith gratitude,\n${charityName}`
              const rnWeekMs = rnWeekAgo.getTime(), rnMonthMs = rnMonthAgo.getTime()
              // A moment is "handled" once a communication logged for this donor within its window
              // mentions its marker — so acting on one moment clears only that one, not the others.
              const rnHandled = (marker, sinceMs) => donorNotes.some(n => new Date(n.created_at).getTime() >= sinceMs && (n.note || '').includes(marker))
              // icon, one-line prompt, button label, email subject, email body, and the short line logged when actioned
              const mk = (icon, text, button, subject, bodyIntro, logNote, sinceMs = rnWeekMs) => { if (rnHandled(logNote, sinceMs)) return; moments.push({ icon, text, button, subject, body: `Dear ${first},\n\n${bodyIntro}${sign}`, logNote, onDone: () => logDonorContactWithUndo(dk, `${logNote} — logged as done`, 'note') }) }

              {
                const sorted = [...myConfirmed].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                const firstGift = sorted[0]
                if (firstGift && new Date(firstGift.created_at) >= rnWeekAgo && !firstGift.thank_you_sent) mk('🆕', 'New donor — welcome them to your community', 'Send welcome', `Welcome to ${charityName}`, `Welcome to the ${charityName} family, and thank you for your very first gift. It truly means the world to us to have you with us, and we can't wait to show you the difference your support makes.`, 'Welcome note')
                const biggest = myConfirmed.find(d => new Date(d.created_at) >= rnWeekAgo && donationBadgeInfo[d.id]?.isBiggestYet)
                if (biggest && !biggest.thank_you_sent) mk('📈', `Gave their biggest gift yet ($${Number(biggest.amount).toLocaleString()}) — recognise it`, 'Send thank-you', 'Thank you for your generous gift', `We were deeply moved by your most generous gift of $${Number(biggest.amount).toLocaleString()} — the largest you've ever made to us. Thank you for your extraordinary support; it will go a long way.`, 'Biggest-gift thank-you')
                if (firstGift) {
                  const fd = new Date(firstGift.created_at)
                  const anniv = new Date(rnToday.getFullYear(), fd.getMonth(), fd.getDate())
                  const daysDiff = Math.floor((anniv - rnToday) / (1000 * 60 * 60 * 24))
                  if (fd.getFullYear() < rnToday.getFullYear() && daysDiff >= -7 && daysDiff <= 0) { const yrs = rnToday.getFullYear() - fd.getFullYear(); mk('🎉', `Giving anniversary this week (${yrs} year${yrs > 1 ? 's' : ''}) — send a note`, 'Send anniversary note', 'Happy giving anniversary', `This week marks ${yrs} year${yrs > 1 ? 's' : ''} since your very first gift to ${charityName}. Thank you for standing with us all this time — your loyalty means everything.`, `${yrs}-year anniversary note`) }
                }
                const lifetime = myConfirmed.reduce((s, d) => s + d.amount, 0)
                const priorLifetime = lifetime - myConfirmed.filter(d => new Date(d.created_at) >= rnWeekAgo).reduce((s, d) => s + d.amount, 0)
                const crossed = (cumulativeThresholds || []).find(t => priorLifetime < t && lifetime >= t)
                if (crossed) mk('🏆', `Crossed $${crossed.toLocaleString()} in lifetime giving this week — recognise the milestone`, 'Send milestone note', 'A special milestone — thank you', `Your generosity has now reached $${crossed.toLocaleString()} in lifetime giving to ${charityName}. That is a remarkable milestone, and we are so grateful for everything your support has made possible.`, `$${crossed.toLocaleString()} milestone note`)
                const monthsSet = new Set(myConfirmed.map(d => { const dt = new Date(d.created_at); return dt.getFullYear() * 12 + dt.getMonth() }))
                const monthsArr = [...monthsSet].sort((a, b) => b - a)
                let streak = monthsArr.length ? 1 : 0
                for (let i = 1; i < monthsArr.length; i++) { if (monthsArr[i - 1] - monthsArr[i] === 1) streak++; else break }
                if ([12, 24, 36, 60].includes(streak)) mk('🔥', `${streak}-month giving streak — celebrate it`, 'Send thank-you', 'Thank you for your continued support', `${streak} months of continuous giving — your steadfast support is the backbone of what we do. Thank you for showing up for our cause month after month.`, `${streak}-month streak thank-you`)
                if (contact?.birth_date) {
                  const bd = new Date(contact.birth_date)
                  const bday = new Date(rnToday.getFullYear(), bd.getMonth(), bd.getDate())
                  const daysUntil = Math.ceil((bday - rnToday) / (1000 * 60 * 60 * 24))
                  if (daysUntil >= 0 && daysUntil <= 7) mk('🎂', 'Birthday this week — send a greeting', 'Send birthday greeting', `Happy birthday from ${charityName}`, `Wishing you a very happy birthday from all of us at ${charityName}! We are so grateful to have you as part of our community, and we hope your day is wonderful.`, 'Birthday greeting')
                }
                const thisWeekGifts = myConfirmed.filter(d => new Date(d.created_at) >= rnWeekAgo)
                if (thisWeekGifts.length > 0) {
                  const mostRecentThisWeek = [...thisWeekGifts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
                  const priorGifts = myConfirmed.filter(d => new Date(d.created_at) < new Date(mostRecentThisWeek.created_at))
                  if (priorGifts.length > 0) {
                    const mostRecentPrior = [...priorGifts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
                    const gapDays = Math.floor((new Date(mostRecentThisWeek.created_at) - new Date(mostRecentPrior.created_at)) / (1000 * 60 * 60 * 24))
                    if (gapDays >= lapsedMinDays) mk('🎉', `Came back this week after ${gapDays}+ days away — thank them`, 'Send thank-you', 'Welcome back!', `It's wonderful to see your support again after some time away. Thank you for coming back to ${charityName} — it means a great deal to us and to those we serve.`, 'Welcome-back thank-you')
                  }
                }
              }

              {
                const lifetimeTotal = myConfirmed.reduce((s, d) => s + d.amount, 0)
                if (lifetimeTotal >= (majorDonorThreshold || 1000) && !selectedDonor.deactivated) {
                  const lastVisit = contact?.last_visited_date
                  const monthsSince = lastVisit ? (rnToday - new Date(lastVisit)) / (1000 * 60 * 60 * 24 * 30) : null
                  if (monthsSince === null || monthsSince >= 6) mk('🤝', 'Major donor due a catch-up — not visited in 6+ months', 'Send a note to reconnect', "Let's catch up", `It has been a while since we last connected, and we would love to catch up. Your support has made a real and lasting difference, and we would be glad to share where things stand and hear how you are.`, 'Reconnect note', rnMonthMs)
                }
                // Reactive: only flags once this month is mostly over and they haven't given
                // yet this year, so it reads as "haven't heard from you," not a pre-emptive
                // nudge timed right before they'd normally give.
                if (rnToday.getDate() >= 15) {
                  const thisMonthNum = rnToday.getMonth()
                  const yearsGivingThisMonth = new Set(myConfirmed.filter(d => { const dt = new Date(d.created_at); return dt.getMonth() === thisMonthNum && dt.getFullYear() < rnToday.getFullYear() }).map(d => new Date(d.created_at).getFullYear()))
                  const gaveThisMonthThisYear = myConfirmed.some(d => { const dt = new Date(d.created_at); return dt.getMonth() === thisMonthNum && dt.getFullYear() === rnToday.getFullYear() })
                  if (yearsGivingThisMonth.size >= 2 && !gaveThisMonthThisYear) mk('📅', "Usually gives around this time of year, hasn't yet — worth a check-in", 'Send a check-in note', 'Thinking of you', `We were thinking of you and wanted to check in — your support over the years has meant so much to us, and we hope all is well with you.`, 'Seasonal check-in note', rnMonthMs)
                }
              }

              // Giving-change (folded in from the former "Giving Pattern" card). Uses the existing
              // thank-you / check-in flows and clears once you've acked that direction.
              const gcFlag = allGivingChangeFlags.find(f => (f.email?.trim() || f.name) === dk)
              if (gcFlag) {
                const isUp = gcFlag.changePct > 0
                const acked = (givingChangeAckHistory[dk] || []).some(a => a.direction === (isUp ? 'upgrade' : 'downgrade'))
                if (!acked) {
                  const markGivingChangeDone = async () => {
                    const { data } = await supabase.from('giving_change_acks').insert({ charity_uen: charityUen, donor_key: dk, direction: isUp ? 'upgrade' : 'downgrade', change_pct: gcFlag.changePct, message: null, sent_by: session.user.email }).select().single()
                    if (data) setGivingChangeAckHistory(prev => ({ ...prev, [dk]: [data, ...(prev[dk] || [])] }))
                    await logDonorContact(dk, `Giving ${isUp ? 'increase' : 'decrease'} check-in — logged as done`, 'note')
                    // Unlike the structurally similar lapsed-donor dismissal, this had no delete path
                    // anywhere -- deleting the note wouldn't have undone it either, since the check
                    // that suppresses this moment reads giving_change_acks, not the note.
                    let cancelled = false
                    setToast({
                      msg: 'Logged as done ✓', undoable: true,
                      onUndo: async () => {
                        cancelled = true
                        if (data?.id) await supabase.from('giving_change_acks').delete().eq('id', data.id)
                        setGivingChangeAckHistory(prev => ({ ...prev, [dk]: (prev[dk] || []).filter(a => a.id !== data?.id) }))
                        setToast(null)
                        showToast('Undone ✓')
                      },
                    })
                    setTimeout(() => { if (!cancelled) setToast(null) }, 10000)
                  }
                  if (isUp) {
                    moments.push({ icon: '📈', text: `Giving increased ${Math.abs(gcFlag.changePct)}% (avg was $${gcFlag.prevAvg} · last gift $${gcFlag.recent.toLocaleString()}) — thank them`, button: 'Send thank-you for increased gift', onDone: markGivingChangeDone, onAction: () => setThankYouDraft({ donor: { name: selectedDonor.name, email: selectedDonor.email, total: selectedDonor.total, count: selectedDonor.count }, badgeState: null, givingChangeMeta: { direction: 'upgrade', changePct: gcFlag.changePct }, subject: fillTemplate(emailTemplates.milestone_thank_you?.subject || EMAIL_TEMPLATE_DEFAULTS.milestone_thank_you.subject, { donor_name: selectedDonor.name, charity_name: charityName }), text: buildUpgradeThankYouNote(selectedDonor, gcFlag.changePct, gcFlag.recent, gcFlag.prevAvg) }) })
                  } else {
                    moments.push({ icon: '📉', text: `Giving decreased ${Math.abs(gcFlag.changePct)}% (avg was $${gcFlag.prevAvg} · last gift $${gcFlag.recent.toLocaleString()}) — check in`, button: 'Check in about decreased giving', onDone: markGivingChangeDone, onAction: () => { setLapsedReminderCandidate({ name: selectedDonor.name, email: selectedDonor.email, total: selectedDonor.total, count: selectedDonor.count, givingChangeMeta: { changePct: gcFlag.changePct } }); setShowLapsedReminderModal(true) } })
                  }
                }
              }

              // Lapsed-donor re-engagement folded in as a moment too — reuses the same lapsed
              // reminder modal for the primary action. "Mark done" behaves the same as every
              // other moment here (a silent log, no reason needed) — it'll simply resurface if
              // they're still lapsed next time this renders, same as any other moment would.
              {
                const lastGiftDate = myConfirmed.length ? new Date([...myConfirmed].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].created_at) : null
                const daysSinceLastGift = lastGiftDate ? Math.floor((rnToday - lastGiftDate) / (1000 * 60 * 60 * 24)) : null
                const isLapsedRn = daysSinceLastGift !== null && daysSinceLastGift >= lapsedMinDays && myConfirmed.length >= lapsedMinGifts
                // Checks contact recency rather than a specific logged marker — the actual "Reach
                // Out" send logs different text ("Re-engagement email sent") than "Mark done" does,
                // so matching on any recent contact catches both paths instead of just one.
                const lastLapsedContact = donorLastContactMap[dk]
                const contactedForLapse = !!(lastLapsedContact && new Date(lastLapsedContact).getTime() >= rnMonthMs)
                if (isLapsedRn && !lapsedDismissals[dk] && !contactedForLapse) {
                  moments.push({
                    icon: '⏰',
                    text: `Hasn't given in ${daysSinceLastGift}+ days — reach out before they lapse further`,
                    button: 'Reach Out',
                    onAction: () => { setLapsedReminderCandidate({ name: selectedDonor.name, email: selectedDonor.email, total: selectedDonor.total, count: selectedDonor.count }); setShowLapsedReminderModal(true) },
                    onDone: () => logDonorContactWithUndo(dk, 'Lapsed donor reach-out — logged as done', 'note'),
                  })
                }
              }

              if (moments.length === 0) return null
              return (
                <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.gold}`, marginBottom: 16, overflow: 'hidden' }}>
                  <div style={{ background: C.gold, padding: '8px 16px' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: 'white' }}>Right now</span>
                  </div>
                  <div style={{ padding: '4px 18px 14px' }}>
                    {moments.map((m, i) => (
                      <div key={i} style={{ padding: '12px 0', borderBottom: i < moments.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          <span style={{ fontSize: 15, flexShrink: 0 }}>{m.icon}</span>
                          <span style={{ fontSize: 13, color: C.text, flex: 1 }}>{m.text}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            style={{ ...s.btnGold, justifyContent: 'center', flex: 1, opacity: 1 }}
                            onClick={() => m.onAction ? m.onAction() : setRnOutreach({ donorName: selectedDonor.name, donorEmail: selectedDonor.email, donorKey: dk, title: m.button, subject: m.subject, text: m.body, logNote: m.logNote, previewing: false })}
                          >✉ {m.button}</button>
                          {m.onDone && (
                            <button
                              style={{ ...s.viewBtn, justifyContent: 'center', flexShrink: 0, whiteSpace: 'nowrap' }}
                              title="Already reached out another way? Clear this without sending."
                              onClick={m.onDone}
                            >{m.doneLabel ? m.doneLabel : '✓ Mark done'}</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 12 }}>Donation History</div>
            {(() => {
              const donorHistoryPageSize = 8
              const donorDonations = donations
                .filter(d => (d.donor_email?.trim() || d.donor_name) === (selectedDonor.email?.trim() || selectedDonor.name))
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
              const totalPages = Math.max(1, Math.ceil(donorDonations.length / donorHistoryPageSize))
              const page = Math.min(donorHistoryPage, totalPages)
              const pageDonations = donorDonations.slice((page - 1) * donorHistoryPageSize, page * donorHistoryPageSize)
              return (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {pageDonations.map(d => {
                      const statusLabel = d.payment_status === 'refunded' ? '↩ Refunded' : d.payment_status !== 'confirmed' ? 'Awaiting Payment' : d.receipt_issued ? '✓ Issued' : 'Receipt Pending'
                      const statusColor = d.payment_status === 'refunded' ? C.red : d.payment_status !== 'confirmed' ? C.red : d.receipt_issued ? C.sage : C.warning
                      return (
                        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: C.ivory, borderRadius: 4, border: `1px solid ${C.border}`, cursor: 'pointer' }} onClick={() => { setSelectedDonation(d); setQuickEmailInput(''); setQuickNricInput('') }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: C.forest }}>{d.source === 'manual' ? `${d.payment_method || 'Manual'}` : `${d.payment_method ? d.payment_method + ' via ' : ''}Giving Tree App`}{d.recurring_gift_id ? ' · Recurring' : ''}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>{new Date(d.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })} · {causeNameForDonation(d) || 'General'}</div>
                            {(d.receipt_number || d.payment_ref) && <div style={{ fontSize: 10.5, color: C.muted, fontFamily: C.fontMono, marginTop: 2 }}>{d.receipt_number || d.payment_ref}</div>}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: C.fontVoice, fontSize: 15, fontWeight: 500, color: C.forest }}>${Number(d.amount).toLocaleString()}</div>
                            <div style={{ fontSize: 10, color: statusColor, fontWeight: 500 }}>{statusLabel}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 14 }}>
                      <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', opacity: page <= 1 ? 0.5 : 1 }} disabled={page <= 1} onClick={() => setDonorHistoryPage(page - 1)}>← Prev</button>
                      <span style={{ fontSize: 11.5, color: C.muted }}>Page {page} of {totalPages}</span>
                      <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px', opacity: page >= totalPages ? 0.5 : 1 }} disabled={page >= totalPages} onClick={() => setDonorHistoryPage(page + 1)}>Next →</button>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
              </div>
          )}

          {donorProfileTab === 'logs' && (
            <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 12 }}>Communication Log</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <select
                  style={{ ...s.filterSelect, fontSize: 12, padding: '6px 10px', flexShrink: 0, width: 130 }}
                  value={newNoteType}
                  onChange={e => setNewNoteType(e.target.value)}
                >
                  <option value="note">📝 Note</option>
                  <option value="call">📞 Call</option>
                  <option value="email">📧 Email</option>
                  <option value="meeting">🤝 Meeting</option>
                  <option value="whatsapp">💬 WhatsApp</option>
                </select>
                <input
                  style={{ ...s.formInput, fontSize: 12, padding: '6px 10px' }}
                  placeholder="Log a call, email, meeting, or note..."
                  value={newNoteText}
                  onChange={e => setNewNoteText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newNoteText.trim() && !savingNote) saveNewDonorNote() }}
                  maxLength={2000}
                />
                <button
                  style={{ ...s.issueBtn, flexShrink: 0, opacity: newNoteText.trim() ? 1 : 0.5 }}
                  disabled={!newNoteText.trim() || savingNote}
                  onClick={saveNewDonorNote}
                >{savingNote ? '...' : 'Add'}</button>
              </div>
              {donorNotesLoading ? (
                <div style={{ fontSize: 13, color: C.muted, padding: '8px 0' }}>Loading...</div>
              ) : donorNotes.filter(n => n.note_type !== 'moment_done').length === 0 ? (
                <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No communications logged yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {donorNotes.filter(n => n.note_type !== 'moment_done').map((n) => {
                    const typeConfig = {
                      call:      { icon: '📞', label: 'Call',      color: C.forest },
                      email:     { icon: '📧', label: 'Email',     color: C.sage },
                      meeting:   { icon: '🤝', label: 'Meeting',   color: C.gold },
                      whatsapp:  { icon: '💬', label: 'WhatsApp',  color: C.sage },
                      note:      { icon: '📝', label: 'Note',      color: C.muted },
                    }
                    const tc = typeConfig[n.note_type] || typeConfig.note
                    return (
                      <div key={n.id} style={{ background: C.ivory, borderRadius: 4, padding: '8px 12px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{tc.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {editingDonorNoteId === n.id ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input
                                style={{ ...s.formInput, fontSize: 12.5, padding: '5px 8px' }}
                                value={editingDonorNoteText}
                                onChange={e => setEditingDonorNoteText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && editingDonorNoteText.trim() && !savingDonorNoteEdit) saveDonorNoteEdit(n.id); if (e.key === 'Escape') { setEditingDonorNoteId(null); setEditingDonorNoteText('') } }}
                                maxLength={2000}
                                autoFocus
                              />
                              <button style={{ ...s.issueBtn, flexShrink: 0, opacity: editingDonorNoteText.trim() ? 1 : 0.5 }} disabled={!editingDonorNoteText.trim() || savingDonorNoteEdit} onClick={() => saveDonorNoteEdit(n.id)}>{savingDonorNoteEdit ? '...' : 'Save'}</button>
                              <button style={{ ...s.viewBtn, flexShrink: 0 }} onClick={() => { setEditingDonorNoteId(null); setEditingDonorNoteText('') }}>Cancel</button>
                            </div>
                          ) : (
                            <>
                              <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.4 }}>{n.note}</div>
                              <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>{tc.label} · {new Date(n.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}, {new Date(n.created_at).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })} · {n.created_by}</div>
                              {n.email_body && <span style={{ fontSize: 11, color: C.sage, fontWeight: 500, cursor: 'pointer', marginTop: 4, display: 'inline-block' }} onClick={() => setViewEmailNote(n)}>📧 View email sent →</span>}
                            </>
                          )}
                        </div>
                        {editingDonorNoteId !== n.id && (
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            <span
                              style={{ fontSize: 13, color: C.muted, cursor: 'pointer', padding: '3px 6px', borderRadius: 4, border: `1px solid ${C.border}` }}
                              title="Edit"
                              onClick={() => { setEditingDonorNoteId(n.id); setEditingDonorNoteText(n.note) }}
                            >✏️</span>
                            <span
                              style={{ fontSize: 13, color: C.muted, cursor: 'pointer', padding: '3px 6px', borderRadius: 4, border: `1px solid ${C.border}` }}
                              title="Delete"
                              onClick={() => setConfirmModal({
                                title: 'Delete this note?',
                                description: 'This cannot be undone.',
                                confirmLabel: 'Delete',
                                onConfirm: () => deleteDonorNote(n.id),
                              })}
                            >🗑️</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {donorProfileTab === 'recurring' && (() => {
            const donorKeyPR = selectedDonor.email?.trim() || selectedDonor.name
            const linkedRecurring = recurringGifts.filter(g => (g.donor_email?.trim() || g.donor_name) === donorKeyPR)
            return (
              <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 12 }}>Recurring Gifts</div>
                {linkedRecurring.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No recurring gifts on file.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {linkedRecurring.map(g => (
                      <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, borderRadius: 4, padding: '10px 12px', border: `1px solid ${C.border}`, cursor: 'pointer' }} onClick={() => { setActiveTab('recurring'); setRecurringSearchTerm(g.donor_email?.trim() || g.donor_name) }}>
                        <div>
                          <span style={{ fontSize: 13, color: C.forest }}>🔁 ${Number(g.amount).toLocaleString()}/{g.frequency} <span style={{ color: C.muted }}>· {g.status}</span></span>
                          {g.reference && <div style={{ fontSize: 10.5, color: C.muted, fontFamily: C.fontMono, marginTop: 2 }}>{g.reference}</div>}
                        </div>
                        <span style={{ fontSize: 11, color: C.muted }}>Details →</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          {donorProfileTab === 'pledges' && (() => {
            const donorKeyPR = selectedDonor.email?.trim() || selectedDonor.name
            const linkedPledges = pledges.filter(p => (p.donor_email?.trim() || p.donor_name) === donorKeyPR)
            return (
              <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 12 }}>Pledges</div>
                {linkedPledges.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No pledges on file.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {linkedPledges.map(p => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, borderRadius: 4, padding: '10px 12px', border: `1px solid ${C.border}`, cursor: 'pointer' }} onClick={() => { setActiveTab('pledges'); setPledgeSearchTerm(p.donor_email?.trim() || p.donor_name) }}>
                        <div>
                          <span style={{ fontSize: 13, color: C.forest }}>🤝 ${Number(p.amount).toLocaleString()} pledge <span style={{ color: C.muted }}>· {p.status}</span></span>
                          {p.reference && <div style={{ fontSize: 10.5, color: C.muted, fontFamily: C.fontMono, marginTop: 2 }}>{p.reference}</div>}
                        </div>
                        <span style={{ fontSize: 11, color: C.muted }}>Details →</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          {donorProfileTab === 'settings' && (
          <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 12 }}>Tags</div>
            {(() => {
              const donorKeyTags = selectedDonor.email?.trim() || selectedDonor.name
              const tags = donorTagsMap[donorKeyTags] || []
              return tags.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {tags.map(t => (
                    <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: C.teal, background: '#E8F0EE', padding: '4px 6px 4px 10px', borderRadius: 20 }}>
                      {t.tag}
                      <span
                        title="Remove tag"
                        style={{ cursor: 'pointer', color: C.muted, fontSize: 12, lineHeight: 1 }}
                        onClick={() => setConfirmModal({
                          title: 'Remove this tag?',
                          description: `"${t.tag}" will be removed from ${selectedDonor.name}.`,
                          confirmLabel: 'Remove',
                          onConfirm: () => deleteDonorTag(selectedDonor, t.id),
                        })}
                      >✕</span>
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: C.muted, fontStyle: 'italic' }}>No tags yet — add this donor to a segment from the Mass Appeal setup screen to tag them.</div>
              )
            })()}
          </div>
          )}

          {donorProfileTab === 'settings' && (
          <div style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '16px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 12 }}>Account Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedDonor.isContactOnly && (
                <button
                  style={{ ...s.viewBtn, color: C.red, borderColor: C.red }}
                  onClick={() => {
                    setConfirmModal({
                      title: 'Delete this prospect?',
                      description: 'This permanently removes the prospect record. This cannot be undone. This only applies to prospects with no donations — donors with donation history should be deactivated instead.',
                      confirmLabel: 'Delete Prospect',
                      onConfirm: async () => {
                        const { error } = await supabase.from('charity_donor_contacts').delete().eq('id', selectedDonor.id)
                        if (error) { showToast('Error deleting prospect', 'error'); return }
                        await supabase.from('audit_log').insert({
                          actor_type: 'charity',
                          actor_email: session.user.email,
                          action: 'prospect_deleted',
                          details: { donor_name: selectedDonor.name },
                        })
                        setDonorContacts(prev => prev.filter(c => c.id !== selectedDonor.id))
                        setSelectedDonor(null)
                        showToast(`${selectedDonor.name} deleted`)
                      },
                    })
                  }}
                >🗑️ Delete Prospect</button>
              )}
              {!selectedDonor.isContactOnly && (
              <button
                style={{ ...s.viewBtn, color: selectedDonor.deactivated ? C.sage : C.warning, borderColor: selectedDonor.deactivated ? C.sage : C.warning }}
                onClick={() => {
                  const isDeactivated = selectedDonor.deactivated
                  setConfirmModal({
                    title: isDeactivated ? 'Reactivate this donor?' : 'Deactivate this donor?',
                    description: isDeactivated
                      ? 'They will appear in active donor lists and appeals again. All their donation history is preserved.'
                      : 'They will be hidden from active donor lists and appeals. All their donation history is preserved and they will still appear in reports.',
                    confirmLabel: isDeactivated ? 'Reactivate' : 'Deactivate',
                    onConfirm: async () => {
                      const newVal = !isDeactivated
                      const donorKey = selectedDonor.email?.trim() || selectedDonor.name
                      const donorDonationIds = donations
                        .filter(d => (d.donor_email?.trim() || d.donor_nric || d.donor_name) === donorKey)
                        .map(d => d.id)
                      const { error } = await supabase
                        .from('donations')
                        .update({ donor_deactivated: newVal })
                        .in('id', donorDonationIds)
                      if (error) { showToast('Error updating donor status', 'error'); return }
                      await supabase.from('audit_log').insert({
                        actor_type: 'charity',
                        actor_email: session.user.email,
                        action: newVal ? 'donor_deactivated' : 'donor_reactivated',
                        details: { donor_name: selectedDonor.name },
                      })
                      setDonations(prev => prev.map(d =>
                        donorDonationIds.includes(d.id) ? { ...d, donor_deactivated: newVal } : d
                      ))
                      setSelectedDonor(prev => ({ ...prev, deactivated: newVal }))
                      showToast(newVal ? `${selectedDonor.name} deactivated` : `${selectedDonor.name} reactivated ✓`)
                    },
                  })
                }}
              >{selectedDonor.deactivated ? '✓ Reactivate Donor' : '⊘ Deactivate Donor'}</button>
              )}
              <button
                style={{ ...s.viewBtn, color: selectedDonor.doNotContact ? C.sage : C.red, borderColor: selectedDonor.doNotContact ? C.sage : C.red }}
                onClick={() => {
                  const isDNC = selectedDonor.doNotContact
                  setConfirmModal({
                    title: isDNC ? 'Allow contact with this donor again?' : 'Mark as Do Not Contact?',
                    description: isDNC
                      ? 'This donor will become eligible for reminders, appeals, and outreach emails again.'
                      : 'This donor will be excluded from every email sent by this platform — mass appeals, reminders, thank-yous, and any future outreach. Their donation history and receipts are unaffected.',
                    confirmLabel: isDNC ? 'Allow Contact' : 'Mark Do Not Contact',
                    onConfirm: async () => {
                      const newVal = !isDNC
                      const donorKey = selectedDonor.email?.trim() || selectedDonor.name
                      const donorDonationIds = donations
                        .filter(d => (d.donor_email?.trim() || d.donor_nric || d.donor_name) === donorKey)
                        .map(d => d.id)
                      const { error } = await supabase
                        .from('donations')
                        .update({ donor_do_not_contact: newVal })
                        .in('id', donorDonationIds)
                      if (error) { showToast('Error updating donor status', 'error'); return }
                      await supabase.from('audit_log').insert({
                        actor_type: 'charity',
                        actor_email: session.user.email,
                        action: newVal ? 'donor_marked_do_not_contact' : 'donor_contact_allowed',
                        details: { donor_name: selectedDonor.name },
                      })
                      setDonations(prev => prev.map(d =>
                        donorDonationIds.includes(d.id) ? { ...d, donor_do_not_contact: newVal } : d
                      ))
                      setSelectedDonor(prev => ({ ...prev, doNotContact: newVal }))
                      showToast(newVal ? `${selectedDonor.name} marked as Do Not Contact` : `${selectedDonor.name} can be contacted again ✓`)
                    },
                  })
                }}
              >{selectedDonor.doNotContact ? '✓ Allow Contact' : '🚫 Do Not Contact'}</button>
              <button style={s.viewBtn} onClick={() => {
                const isDeceased41 = selectedDonor.deceased
                setConfirmModal({
                  title: isDeceased41 ? 'Unmark as deceased?' : 'Mark this donor as deceased?',
                  subtitle: isDeceased41
                    ? 'This donor will become eligible for communications again.'
                    : 'This immediately halts all outgoing communication to this donor — thank-yous, appeals, reminders, everything. Their donation history and receipts stay intact.',
                  confirmLabel: isDeceased41 ? 'Unmark' : 'Mark Deceased',
                  onConfirm: async () => {
                    const newVal41 = !isDeceased41
                    const donorKey41 = selectedDonor.email?.trim() || selectedDonor.name
                    const donorDonationIds41 = donations
                      .filter(d => (d.donor_email?.trim() || d.donor_nric || d.donor_name) === donorKey41)
                      .map(d => d.id)
                    const { error } = await supabase
                      .from('donations')
                      .update({ donor_deceased: newVal41 })
                      .in('id', donorDonationIds41)
                    if (error) { showToast('Error updating donor status', 'error'); return }
                    await supabase.from('audit_log').insert({
                      actor_type: 'charity',
                      actor_email: session.user.email,
                      action: newVal41 ? 'donor_marked_deceased' : 'donor_deceased_unmarked',
                      details: { donor_name: selectedDonor.name },
                    })
                    setDonations(prev => prev.map(d =>
                      donorDonationIds41.includes(d.id) ? { ...d, donor_deceased: newVal41 } : d
                    ))
                    setSelectedDonor(prev => ({ ...prev, deceased: newVal41 }))
                    showToast(newVal41 ? `${selectedDonor.name} marked as deceased` : `${selectedDonor.name} unmarked`)
                  },
                })
              }}>{selectedDonor.deceased ? '✓ Unmark Deceased' : '🕊️ Mark Deceased'}</button>
            </div>
          </div>
          )}
          </div>
        </div>
      </div>
    )}
    </>
  )
}
