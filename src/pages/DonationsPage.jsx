import { supabase } from '../supabase'
import { C } from '../theme'
import { s } from '../styles'
import { EmptyState } from '../components/ui/EmptyState'
import { QRCodeSVG } from 'qrcode.react'
import { fillTemplate } from '../lib/format'

export function DonationsPage({
  isMobile, isTablet, userRole, donations, setDonations, session, charityUen, charityName, charityIsIpc, charityIpcLoaded,
  filterMinAmount, setFilterMinAmount, donationFilterLabel, setDonationFilterLabel,
  pendingCountForYear, issueAllReceipts, bulkActionInProgress,
  showManualForm, setShowManualForm, closeManualForm, editingDonationId, setEditingDonationId,
  manualError, manualDuplicateWarning, setManualDuplicateWarning, manualForm, setManualForm, manualReferralSearch, setManualReferralSearch,
  donorList, generatePayNowEntry, saveManualEntry, savingManual, myCauses,
  payNowQrDonation, setPayNowQrDonation, resetManualForm, confirmManualPayNow, confirmingPayNow,
  unconfirmedCountForYear, awaitingThankYouCountForYear, missingNricThisYear, clearDonationFilters,
  setFilterType, setFilterThankYou, setFilterNric, filterYear, setFilterYear,
  showDonationFilters, setShowDonationFilters, searchTerm, setSearchTerm, filterType, filterNric, filterSource, setFilterSource,
  filterThankYou, exportDonationsExcel, activeDonationFilterCount,
  bulkProgress, bulkCancelRef,
  filteredDonations, donationsPerPage, setDonationsPerPage, paginatedDonations, loading,
  setSelectedDonation, setQuickEmailInput, setQuickNricInput,
  causeNameForDonation, confirmPaymentFlow, setConfirmModal,
  orderedDonationColumns, draggedDonationColumn, setDraggedDonationColumn, reorderDonationColumn,
  donationSortBy, setDonationSortBy, donationSortDir, setDonationSortDir,
  selectedDonation, selectedRowRef,
  donationsPage, setDonationsPage, donationsTotalPages,
  setVolunteerEditEntry, setVolunteerEditForm, setVolunteerFlagMessage, setVolunteerEditError,
  quickEmailInput, quickNricInput,
  nricRequestSent, setNricRequestSent, emailTemplates, sendCharityEmail, showToast,
  editingNoteId, setEditingNoteId, noteText, setNoteText,
  editingImpactNoteId, setEditingImpactNoteId, impactNoteText, setImpactNoteText,
  donationPledgeLink, recurringGifts, refunds, deleteRefund, exportSingleReceiptPDF,
  pledges, setShowManualPledgeLinkModal,
  showRefundForm, setShowRefundForm, refundForm, setRefundForm, savingRefund, saveRefund,
  setShowVoidModal, setVoidReason,
  sendingThankYouId, thankYouDefaultsFor, setThankYouSubjectInput, setThankYouCustomMessage,
  setThankYouPreviewing, setThankYouPreviewModal,
  showDonationMoreActions, setShowDonationMoreActions,
  deletingId, deleteDonation, unconfirmPayment, fyOf,
}) {
  return (
    <div style={s.content}>
      {userRole === 'volunteer' && (
        <div style={{ background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: 4, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: C.warning, fontWeight: 500 }}>
          You're logged in as a volunteer. You can log new manual entries below. To view donor records or financials, please contact a staff member.
        </div>
      )}
      <div style={s.pageHeader}>
        <div>
          <div style={s.pageTitle}>Donations</div>
          <div style={s.pageSub}>{userRole === 'volunteer' ? 'Log a new donation below' : `${donations.length} total · ${donations.filter(d => d.source === 'manual').length} manual entries`}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {(userRole === 'staff' || userRole === 'ed') && pendingCountForYear > 0 && <button style={s.btnForest} onClick={issueAllReceipts} disabled={bulkActionInProgress}>{bulkActionInProgress ? '⏳ Issuing...' : `🧾 Issue All Pending (${pendingCountForYear})`}</button>}
          <button style={s.btnGold} onClick={() => setShowManualForm(true)}>+ Manual Entry</button>
        </div>
      </div>

      {filterMinAmount && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 4, padding: '10px 14px', marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: C.forest, fontWeight: 500 }}>{donationFilterLabel || `Showing donations of $${filterMinAmount}+`}</span>
          <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px', marginLeft: 'auto' }} onClick={() => { setFilterMinAmount(null); setDonationFilterLabel(null) }}>✕ Clear</button>
        </div>
      )}

      {showManualForm && (
        <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={closeManualForm}>
          <div style={{ background: C.white, borderRadius: 8, padding: isMobile ? 20 : 24, maxWidth: 720, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.forest }}>{editingDonationId ? 'Edit Entry' : 'New Manual Entry'}</div>
              <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={closeManualForm}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>{editingDonationId ? 'Update the details of this donation entry.' : 'Log a cash, cheque, or wire donation received outside the app.'}</div>
            {manualError && <div style={{ background: C.warningBg, color: C.warning, padding: '10px 14px', borderRadius: 4, fontSize: 13, marginBottom: 12 }}>{manualError}</div>}
            {manualDuplicateWarning && (
              <div style={{ background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: 4, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.warning, marginBottom: 8 }}>⚠ Possible duplicate donor</div>
                <div style={{ fontSize: 12, color: C.warning, marginBottom: 10 }}>We found {manualDuplicateWarning.donors.length} existing donor{manualDuplicateWarning.donors.length > 1 ? 's' : ''} matching this {manualDuplicateWarning.matchedOn}. Is this the same person?</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {manualDuplicateWarning.donors.slice(0, 3).map((d, i) => (
                    <div key={i} style={{ background: C.white, borderRadius: 4, border: `1px solid ${C.border}`, padding: '8px 12px', fontSize: 12, color: C.forest }}>
                      <strong>{d.name}</strong> — {d.count} donation{d.count > 1 ? 's' : ''}, last gave ${d.total.toLocaleString()}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    style={{ ...s.btnForest, fontSize: 12, padding: '8px 14px' }}
                    onClick={() => { setManualForm(f => ({ ...f, duplicateConfirmed: true })); setManualDuplicateWarning(null); manualForm.payment_method === 'PayNow Direct' && !editingDonationId ? generatePayNowEntry(true) : saveManualEntry(true) }}
                  >It's a different person — save anyway</button>
                  <button
                    style={{ ...s.viewBtn, fontSize: 12, padding: '8px 14px' }}
                    onClick={() => { setManualDuplicateWarning(null); setManualForm(f => ({ ...f, donor_name: manualDuplicateWarning.donors[0].name, duplicateConfirmed: true })) }}
                  >Use existing name</button>
                </div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={s.formLabel}>{manualForm.is_anonymous ? 'Donor Name (not recorded)' : 'Donor Name *'}</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.muted, cursor: 'pointer' }}>
                    <input type="checkbox" checked={manualForm.is_anonymous} onChange={e => {
                      const checked = e.target.checked
                      setManualForm(f => ({ ...f, is_anonymous: checked, ...(checked ? { donor_name: '', donor_email: '', donor_nric: '', receipt_name: '' } : {}) }))
                    }} /> Anonymous
                  </label>
                </div>
                <input style={s.formInput} disabled={manualForm.is_anonymous} placeholder={manualForm.is_anonymous ? "Not recorded — see Notes below to remember privately" : 'Full name'} value={manualForm.donor_name} onChange={e => setManualForm(f => ({ ...f, donor_name: e.target.value }))} />
              </div>
              <label style={{ display: 'block' }}>
                <div style={s.formLabel}>How did they find you? (optional)</div>
                <select style={s.formInput} value={manualForm.acquisition_source} onChange={e => setManualForm(f => ({ ...f, acquisition_source: e.target.value, acquisition_source_detail: '', referred_by_donor_key: '' }))}>
                  <option value="">Not specified</option>
                  <option value="referral">Referral</option>
                  <option value="event">Event</option>
                  <option value="social_media">Social Media</option>
                  <option value="walk_in">Walk-in</option>
                  <option value="corporate_partner">Corporate Partner</option>
                  <option value="other">Other</option>
                </select>
              </label>
              {manualForm.acquisition_source === 'referral' && (
                <label style={{ display: 'block' }}>
                  <div style={s.formLabel}>Referred by (existing donor)</div>
                  <input
                    style={s.formInput}
                    placeholder="Search donor by name..."
                    value={manualForm.referred_by_donor_key ? (donorList.find(d => (d.email?.trim() || d.name) === manualForm.referred_by_donor_key)?.name || manualReferralSearch) : manualReferralSearch}
                    onChange={e => { setManualReferralSearch(e.target.value); setManualForm(f => ({ ...f, referred_by_donor_key: '' })) }}
                  />
                  {manualReferralSearch.trim() && !manualForm.referred_by_donor_key && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6, maxHeight: 140, overflowY: 'auto' }}>
                      {donorList
                        .filter(d => d.name.toLowerCase().includes(manualReferralSearch.toLowerCase()))
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .slice(0, 8)
                        .map((d, i) => (
                          <div key={i} style={{ fontSize: 12.5, color: C.forest, background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 10px', cursor: 'pointer' }}
                            onClick={() => { setManualForm(f => ({ ...f, referred_by_donor_key: d.email?.trim() || d.name })); setManualReferralSearch('') }}
                          >{d.name}</div>
                        ))}
                    </div>
                  )}
                </label>
              )}
              {manualForm.acquisition_source && (
                <label style={{ display: 'block' }}>
                  <div style={s.formLabel}>{manualForm.acquisition_source === 'referral' ? 'Referral details (optional)' : 'Details (optional)'}</div>
                  <input
                    style={s.formInput}
                    placeholder={{
                      referral: "If not an existing donor, e.g. \"Friend of Mrs Tan\"",
                      event: 'e.g. Winter Gala 2026',
                      social_media: 'e.g. Instagram, Facebook',
                      walk_in: 'e.g. Front desk, street collection',
                      corporate_partner: 'e.g. ABC Pte Ltd',
                      other: 'Describe the source',
                    }[manualForm.acquisition_source]}
                    value={manualForm.acquisition_source_detail}
                    onChange={e => setManualForm(f => ({ ...f, acquisition_source_detail: e.target.value }))}
                  />
                </label>
              )}
              {charityIsIpc && !manualForm.is_anonymous && (
                <label style={{ display: 'block' }}><div style={s.formLabel}>NRIC / FIN</div><input style={s.formInput} placeholder="e.g. S1234567A" value={manualForm.donor_nric} onChange={e => setManualForm(f => ({ ...f, donor_nric: e.target.value }))} maxLength={9} /></label>
              )}
              <label style={{ display: 'block' }}><div style={s.formLabel}>Amount (SGD) *</div><input style={s.formInput} type="number" placeholder="0.00" value={manualForm.amount} onChange={e => setManualForm(f => ({ ...f, amount: e.target.value }))} /></label>
              <label style={{ display: 'block' }}><div style={s.formLabel}>Date</div><input style={s.formInput} type="date" min="2020-01-01" max={new Date().toISOString().split('T')[0]} value={manualForm.date} onChange={e => setManualForm(f => ({ ...f, date: e.target.value }))} /></label>
              <label style={{ display: 'block' }}><div style={s.formLabel}>Payment Method</div>
                <select style={s.formInput} value={manualForm.payment_method} onChange={e => setManualForm(f => ({ ...f, payment_method: e.target.value }))}>
                  <option>Cash</option><option>Bank Wire</option><option>Cheque</option><option>PayNow Direct</option><option>Other</option>
                </select>
                {manualForm.payment_method === 'PayNow Direct' && (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Generates a scannable QR — payment confirms in a second step</div>
                )}
              </label>
              {(manualForm.payment_method === 'Bank Wire' || manualForm.payment_method === 'Cheque') && (
                <label style={{ display: 'block' }}>
                  <div style={s.formLabel}>{manualForm.payment_method === 'Cheque' ? 'Cheque No. (optional)' : 'Wire Reference (optional)'}</div>
                  <input style={s.formInput} placeholder={manualForm.payment_method === 'Cheque' ? 'e.g. 000123' : 'e.g. bank transaction reference'} value={manualForm.payment_ref} onChange={e => setManualForm(f => ({ ...f, payment_ref: e.target.value }))} />
                </label>
              )}
              <label style={{ display: 'block' }}>
                <div style={s.formLabel}>{manualForm.is_anonymous ? 'Donor Email (not recorded)' : 'Donor Email'}</div>
                <input style={s.formInput} disabled={manualForm.is_anonymous} placeholder={manualForm.is_anonymous ? 'Not recorded for anonymous donations' : 'donor@email.com'} value={manualForm.donor_email || ''} onChange={e => setManualForm(f => ({ ...f, donor_email: e.target.value }))} />
              </label>
              <label style={{ display: 'block' }}><div style={s.formLabel}>Cause (Optional)</div>
                <select style={s.formInput} value={manualForm.cause_id} onChange={e => setManualForm(f => ({ ...f, cause_id: e.target.value }))}>
                  <option value="">General Donation</option>
                  {myCauses.filter(c => c.status === 'approved' && c.type === 'campaign' && (!c.end_date || new Date(c.end_date) >= new Date())).map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'block' }}>
                <div style={s.formLabel}>{manualForm.is_anonymous ? 'Receipt Name (not recorded)' : 'Receipt Name'}</div>
                <input style={s.formInput} disabled={manualForm.is_anonymous} placeholder={manualForm.is_anonymous ? 'Receipts show "Anonymous"' : 'Leave blank to use donor name'} value={manualForm.receipt_name} onChange={e => setManualForm(f => ({ ...f, receipt_name: e.target.value }))} />
                {!manualForm.is_anonymous && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Only fill this if the receipt should show a different name (e.g. a company name)</div>}
              </label>
              <label style={{ display: 'block', gridColumn: isMobile ? 'auto' : '1 / -1' }}><div style={s.formLabel}>Notes{manualForm.is_anonymous ? ' — use this to privately remember who this was, if needed' : ''}</div><input style={s.formInput} placeholder="Optional notes" value={manualForm.notes} onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))} /></label>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {manualForm.payment_method === 'PayNow Direct' && !editingDonationId ? (
                <button style={{ ...s.btnGold, flex: 1, justifyContent: 'center' }} onClick={generatePayNowEntry} disabled={savingManual}>{savingManual ? 'Generating...' : '📱 Generate PayNow Code'}</button>
              ) : (
                <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} onClick={saveManualEntry} disabled={savingManual}>{savingManual ? 'Saving...' : (editingDonationId ? '✓ Save Changes' : '✓ Save Entry')}</button>
              )}
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={closeManualForm}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {payNowQrDonation && (
        <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => { setPayNowQrDonation(null); resetManualForm() }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 380, width: '100%', textAlign: 'center', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button aria-label="Close" style={{ position: 'absolute', top: 10, right: 10, background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => { setPayNowQrDonation(null); resetManualForm() }}>✕</button>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 2 }}>{payNowQrDonation.donor_name}</div>
            <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, marginBottom: 16 }}>SGD ${Number(payNowQrDonation.amount).toFixed(2)}</div>
            <div style={{ background: 'white', borderRadius: 4, padding: 16, border: `1px solid ${C.border}`, display: 'inline-block', marginBottom: 14 }}>
              <QRCodeSVG value={`https://www.paynow.com.sg/pay?uen=${charityUen}&amount=${payNowQrDonation.amount}&ref=${payNowQrDonation.payment_ref}`} size={180} level="H" />
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Ask the donor to scan with their banking app</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 18 }}>Ref: <span style={{ fontFamily: 'monospace' }}>{payNowQrDonation.payment_ref}</span></div>
            {userRole === 'ed' ? (
              <button style={{ ...s.btnForest, width: '100%', justifyContent: 'center', marginBottom: 10 }} onClick={confirmManualPayNow} disabled={confirmingPayNow}>{confirmingPayNow ? 'Confirming...' : '✓ Payment Received — Confirm'}</button>
            ) : (
              <div style={{ fontSize: 12, color: C.muted, background: C.ivory, borderRadius: 6, padding: '10px 12px', marginBottom: 10, lineHeight: 1.5 }}>Only an Executive Director can confirm this — it'll wait here until they verify it against the bank/PayNow account.</div>
            )}
            <button style={{ ...s.viewBtn, width: '100%', justifyContent: 'center' }} onClick={() => { setPayNowQrDonation(null); resetManualForm() }}>Close — I'll confirm later</button>
          </div>
        </div>
      )}

      {(unconfirmedCountForYear > 0 || pendingCountForYear > 0 || awaitingThankYouCountForYear > 0 || (charityIsIpc && missingNricThisYear > 0)) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {unconfirmedCountForYear > 0 && (
            <button style={{ ...s.badgePending, border: 'none', cursor: 'pointer', fontSize: 12, padding: '6px 14px' }} onClick={() => { clearDonationFilters({ keepYear: true }); setFilterType('Awaiting Payment') }}>
              ⚠️ {unconfirmedCountForYear} awaiting confirmation{filterYear !== 'All' ? ` in ${filterYear}` : ''}
            </button>
          )}
          {pendingCountForYear > 0 && (
            <button style={{ ...s.badgePending, border: 'none', cursor: 'pointer', fontSize: 12, padding: '6px 14px' }} onClick={() => { clearDonationFilters({ keepYear: true }); setFilterType('Receipt Pending') }}>
              🧾 {pendingCountForYear} receipt{pendingCountForYear > 1 ? 's' : ''} pending{filterYear !== 'All' ? ` in ${filterYear}` : ''}
            </button>
          )}
          {awaitingThankYouCountForYear > 0 && (
            <button style={{ ...s.badgePending, border: 'none', cursor: 'pointer', fontSize: 12, padding: '6px 14px' }} onClick={() => { clearDonationFilters({ keepYear: true }); setFilterThankYou('Not Sent') }}>
              💌 {awaitingThankYouCountForYear} awaiting thank you{filterYear !== 'All' ? ` in ${filterYear}` : ''}
            </button>
          )}
          {charityIsIpc && missingNricThisYear > 0 && (
            <button style={{ ...s.badgePending, border: 'none', cursor: 'pointer', fontSize: 12, padding: '6px 14px' }} onClick={() => { clearDonationFilters({ keepYear: true }); setFilterNric('Missing NRIC') }}>
              🪪 {missingNricThisYear} missing NRIC{filterYear !== 'All' ? ` in ${filterYear}` : ''}
            </button>
          )}
        </div>
      )}

      <div style={isMobile ? { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 } : { display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={isMobile ? s.searchBox : { ...s.searchBox, flex: 'none', width: 280 }} placeholder={charityIsIpc ? "🔍 Search name, email, NRIC, ref, or notes..." : "🔍 Search name, email, ref, or notes..."} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {isMobile && (
          <button style={{ ...s.viewBtn, width: '100%', justifyContent: 'center' }} onClick={() => setShowDonationFilters(v => !v)}>{showDonationFilters ? '▾ Hide Filters' : '▸ Filters & Export'}</button>
        )}
        {(!isMobile || showDonationFilters) && (<>
        <select style={isMobile ? { ...s.filterSelect, flex: 1, minWidth: 100 } : s.filterSelect} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option>All</option><option>Awaiting Payment</option><option>Receipt Pending</option><option>Issued</option><option>Refunded</option>
        </select>
        {charityIsIpc && (
          <select style={{ ...(isMobile ? { ...s.filterSelect, flex: 1, minWidth: 100 } : s.filterSelect), borderColor: filterNric !== 'All' ? C.warningBorder : C.border, background: filterNric !== 'All' ? C.warningBg : C.white }} value={filterNric} onChange={e => setFilterNric(e.target.value)}>
            <option value="All">All NRICs</option>
            <option value="Missing NRIC">⚠️ Missing NRIC (confirmed)</option>
          </select>
        )}
        <select style={isMobile ? { ...s.filterSelect, flex: 1, minWidth: 100 } : s.filterSelect} value={filterSource} onChange={e => setFilterSource(e.target.value)}>
          <option value="All">All Sources</option>
          <option value="App">📱 App</option>
          <option value="Manual">✏️ Manual</option>
        </select>
        <select style={isMobile ? { ...s.filterSelect, flex: 1, minWidth: 100 } : s.filterSelect} value={filterThankYou} onChange={e => setFilterThankYou(e.target.value)}>
          <option value="All">Thank You: All</option>
          <option value="Sent">💌 Sent</option>
          <option value="Not Sent">Not Sent (has email)</option>
          <option value="No Email">No Email on File</option>
        </select>
        <select style={isMobile ? { ...s.filterSelect, flex: 1, minWidth: 100 } : s.filterSelect} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
          <option>All</option>
          {donations.length === 0
? <option>{fyOf(new Date())}</option>
: [...new Set(donations.map(d => fyOf(d.created_at)))].sort((a,b) => b-a).map(y => <option key={y}>{y}</option>)
}
        </select>
        <button style={isMobile ? { ...s.exportSmallBtn, width: '100%' } : s.exportSmallBtn} onClick={exportDonationsExcel}>⬇️ Export to Excel</button>
        {activeDonationFilterCount > 0 && (
          <button style={{ ...s.viewBtn, whiteSpace: 'nowrap' }} onClick={clearDonationFilters}>✕ Clear Filters ({activeDonationFilterCount})</button>
        )}
        </>)}
      </div>

      {bulkProgress && (
        <div style={{ background: C.forest, borderRadius: 4, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'white', flexShrink: 0 }}>
            Issuing {bulkProgress.done} of {bulkProgress.total}...
          </span>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.2)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
            <div style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%`, height: '100%', background: C.gold, borderRadius: 3, transition: 'width 0.2s' }} />
          </div>
          <button
            style={{ ...s.bannerBtn, background: 'white', color: C.red, flexShrink: 0 }}
            onClick={() => { bulkCancelRef.current = true }}
          >✕ Cancel</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {userRole === 'volunteer' ? (() => {
            const myEntries = donations.filter(d => d.created_by === session?.user?.email).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            return (
              <div style={{ ...s.tableCard }}>
                <div style={s.tableHeader}>
                  <div style={s.tableTitle}>Your Entries</div>
                  <div style={s.tableCount}>{myEntries.length} record{myEntries.length !== 1 ? 's' : ''}</div>
                </div>
                {myEntries.length === 0 ? (
                  <div style={s.empty}>No entries yet — use "+ Manual Entry" above to log a donation.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {myEntries.map(d => (
                      <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }} onClick={() => { setVolunteerEditEntry(d); setVolunteerEditForm({ donor_name: d.donor_name || '', amount: d.amount?.toString() || '', date: d.created_at?.split('T')[0] || '', notes: d.notes || '', donor_email: d.donor_email || '', donor_nric: d.donor_nric || '', payment_method: d.payment_method || 'Cash', cause_id: d.cause_id || '' }); setVolunteerFlagMessage(''); setVolunteerEditError('') }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: C.forest }}>{d.donor_name}</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{new Date(d.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: C.forest }}>${Number(d.amount).toLocaleString()}</span>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: d.payment_status === 'confirmed' ? C.successBg : C.warningBg, color: d.payment_status === 'confirmed' ? C.sage : C.warning }}>{d.payment_status === 'confirmed' ? 'Confirmed' : 'Pending review'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })() : <div style={s.tableCard}>
            <div style={s.tableHeader}>
              <div style={s.tableTitle}>All Donations</div>
              <div style={s.tableCount}>{filteredDonations.length > donationsPerPage ? `${paginatedDonations.length} of ${filteredDonations.length} records` : `${filteredDonations.length} records`}</div>
            </div>
            {loading ? <div style={s.empty}>Loading...</div> : filteredDonations.length === 0 && activeDonationFilterCount === 0 ? (
              <EmptyState
                icon="💳"
                title="No donations yet"
                description="Record your first donation with '+ Manual Entry' above, or share your PayNow QR / donation link so donors can give directly."
                ctaLabel="+ Manual Entry"
                onCta={() => setShowManualForm(true)}
              />
            ) : filteredDonations.length === 0 ? (
              <div style={s.empty}>
                No donations found matching your filters.
                <div style={{ marginTop: 10 }}>
                  <button style={s.viewBtn} onClick={clearDonationFilters}>✕ Clear Filters</button>
                </div>
              </div>
            ) : (isMobile || isTablet) ? (
              <div>
                {paginatedDonations.map(d => {
                  const isPaid = d.payment_status === 'confirmed'
                  const isRefunded = d.payment_status === 'refunded'
                  const isReceipted = d.receipt_issued
                  const noThankYouExpected = d.is_anonymous || !d.donor_email?.trim()
                  const railColor = isRefunded ? C.red : !isPaid ? C.red : (noThankYouExpected || d.thank_you_sent) ? C.sage : C.gold
                  return (
                  <div key={d.id} style={{ display: 'flex', gap: 8, padding: '12px 16px 12px 10px', borderBottom: `1px solid ${C.ivoryDark}`, cursor: 'pointer', background: isRefunded ? '#FBEEE9' : 'transparent' }} onClick={() => { setSelectedDonation(d); setQuickEmailInput(''); setQuickNricInput('') }}>
                    <div style={{ width: 4, borderRadius: 4, background: railColor, alignSelf: 'stretch', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <div style={{ ...s.donorAvatar, background: C.sage, flexShrink: 0 }}>{d.donor_name?.charAt(0)}</div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <div style={s.donationCardName}>{d.donor_name}</div>
                              {isRefunded && <span style={{ fontSize: 9.5, fontWeight: 800, color: 'white', background: '#E11D48', padding: '2px 7px', borderRadius: 20, letterSpacing: 0.3, flexShrink: 0 }}>REFUNDED</span>}
                            </div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{new Date(d.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })} · {d.receipt_number || '—'}{d.payment_ref ? ` · Ref: ${d.payment_ref}` : ''}</div>
                          </div>
                        </div>
                        <div style={{ ...s.donationCardAmount, flexShrink: 0 }}>${Number(d.amount).toLocaleString()}</div>
                      </div>
                      <div style={{ marginTop: 8, marginLeft: 42 }}>
                        <div style={{ marginBottom: 6 }}>
                          {causeNameForDonation(d) ? (
                            <span style={{ fontSize: 10, fontWeight: 500, color: '#854F0B', background: '#FDF8EC', padding: '3px 9px', borderRadius: 20 }}>{causeNameForDonation(d)}</span>
                          ) : (
                            <span style={{ fontSize: 10, color: C.muted, background: C.ivoryDark, padding: '3px 9px', borderRadius: 20 }}>General</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                          {isRefunded ? (
                            <span style={{ fontSize: 10, fontWeight: 500, color: '#A32D2D', background: '#FCEBEB', padding: '3px 9px', borderRadius: 20 }}>↩ Refunded</span>
                          ) : isPaid ? (
                            <span style={{ fontSize: 10, fontWeight: 500, color: '#3B6D11', background: '#EAF3DE', padding: '3px 9px', borderRadius: 20 }}>Paid</span>
                          ) : userRole !== 'ed' ? (
                            <span style={{ fontSize: 10, fontWeight: 500, color: '#A32D2D', background: '#FCEBEB', padding: '3px 9px', borderRadius: 20 }}>Unpaid · awaiting ED confirmation</span>
                          ) : (
                            <span
                              style={{ fontSize: 10, fontWeight: 500, color: '#A32D2D', background: '#FCEBEB', padding: '3px 9px', borderRadius: 20, cursor: 'pointer' }}
                              onClick={(e) => {
                                e.stopPropagation()
                                setConfirmModal({
                                  title: 'Confirm this payment?',
                                  subtitle: 'Check the transaction reference against your bank or PayNow statement before confirming.',
                                  donorName: d.donor_name,
                                  amount: d.amount,
                                  reference: d.payment_ref || d.receipt_number,
                                  steps: ['Mark payment as confirmed', 'Issue a receipt'],
                                  receiptPreviewDonation: d,
                                  confirmLabel: 'Confirm payment',
                                  onConfirm: () => confirmPaymentFlow(d),
                                })
                              }}
                            >Unpaid · tap to confirm</span>
                          )}
                          {isPaid && (isReceipted ? (
                            <span style={{ fontSize: 10, fontWeight: 500, color: '#3B6D11', background: '#EAF3DE', padding: '3px 9px', borderRadius: 20 }}>Receipted</span>
                          ) : (
                            <span style={{ fontSize: 10, fontWeight: 500, color: '#854F0B', background: '#FAEEDA', padding: '3px 9px', borderRadius: 20 }}>Receipt pending</span>
                          ))}
                          {isPaid && isReceipted && d.donor_email?.trim() && (
                            d.thank_you_sent ? (
                              <span style={{ fontSize: 10, fontWeight: 500, color: '#3B6D11', background: '#EAF3DE', padding: '3px 9px', borderRadius: 20 }}>Thanked</span>
                            ) : (
                              <span style={{ fontSize: 10, fontWeight: 500, color: '#854F0B', background: '#FAEEDA', padding: '3px 9px', borderRadius: 20 }}>Not thanked</span>
                            )
                          )}
                          {charityIsIpc && !d.donor_nric && isPaid && (
                            <span style={{ fontSize: 10, fontWeight: 500, color: '#854F0B', background: '#FAEEDA', padding: '3px 9px', borderRadius: 20 }}>NRIC missing</span>
                          )}
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
                    {(isTablet
                      ? (charityIsIpc ? ['Donor', 'Amount', 'Date', 'NRIC', 'Payment', 'Receipt'] : ['Donor', 'Amount', 'Date', 'Payment', 'Receipt']).map(label => ({ key: label === 'Donor' ? 'name' : label.toLowerCase(), label }))
                      : [{ key: 'name', label: 'Donor' }, ...orderedDonationColumns.filter(o => o.key !== 'nric' || charityIsIpc)]
                    ).map(h => {
                      const sortKey = h.key === 'name' ? 'donor' : ['amount', 'date', 'cause', 'source', 'reference', 'nric', 'payment', 'receipt', 'receiptNo', 'thankYou'].includes(h.key) ? h.key : null
                      return (
                        <th
                          key={h.key}
                          draggable={!isTablet && h.key !== 'name'}
                          onDragStart={() => setDraggedDonationColumn(h.key)}
                          onDragOver={e => { if (!isTablet && h.key !== 'name') e.preventDefault() }}
                          onDrop={e => { e.preventDefault(); reorderDonationColumn(draggedDonationColumn, h.key); setDraggedDonationColumn(null) }}
                          onDragEnd={() => setDraggedDonationColumn(null)}
                          style={{ ...s.th, cursor: sortKey ? (h.key === 'name' ? 'pointer' : 'grab') : 'default', userSelect: 'none', width: h.key === 'name' ? 220 : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: draggedDonationColumn === h.key ? 0.4 : 1 }}
                          onClick={() => {
                            if (!sortKey) return
                            if (donationSortBy === sortKey) setDonationSortDir(d => d === 'asc' ? 'desc' : 'asc')
                            else { setDonationSortBy(sortKey); setDonationSortDir('desc') }
                          }}
                          title={!isTablet && h.key !== 'name' ? 'Drag to reorder · click to sort' : undefined}
                        >
                          {h.label}{sortKey && donationSortBy === sortKey ? (donationSortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {paginatedDonations.map(d => {
                    const isPaid = d.payment_status === 'confirmed'
                    const noThankYouExpected = d.is_anonymous || !d.donor_email?.trim()
                    const railColor = !isPaid ? C.red : (noThankYouExpected || d.thank_you_sent) ? C.sage : C.gold
                    const rowBg = selectedDonation?.id === d.id ? C.successBg : d.payment_status === 'refunded' ? '#FBEEE9' : d.source === 'manual' ? '#FDFBF6' : 'transparent'
                    return (
                    <tr key={d.id} ref={selectedDonation?.id === d.id ? selectedRowRef : null} style={{ ...s.tr, background: rowBg, borderLeft: `3px solid ${railColor}`, cursor: 'pointer' }} onClick={() => { setSelectedDonation(d); setQuickEmailInput(''); setQuickNricInput('') }}>
                      <td style={s.td}><div style={s.donorCell}><div style={{ ...s.donorAvatar, background: d.payment_status !== 'confirmed' ? C.red : (noThankYouExpected || d.thank_you_sent) ? C.sage : C.gold }}>{d.donor_name?.charAt(0)}</div><div><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={s.donorName}>{d.donor_name}</div>{d.payment_status === 'refunded' && <span style={{ fontSize: 9.5, fontWeight: 800, color: 'white', background: '#E11D48', padding: '2px 7px', borderRadius: 20, letterSpacing: 0.3, flexShrink: 0 }}>REFUNDED</span>}</div>{d.notes && <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', marginTop: 2 }}>📝 {d.notes}</div>}</div></div></td>
                      {isTablet && <td style={s.td}><span style={s.amountText}>${Number(d.amount).toLocaleString()}</span></td>}
                      {isTablet && <td style={s.td}><span style={s.dateText}>{new Date(d.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</span></td>}
                      {isTablet ? (
                        <>
                          {charityIsIpc && <td style={s.td}>{d.donor_nric ? <span style={s.badgeIssued}>✓ {d.donor_nric}</span> : <span style={s.badgePending}>⚠️ Missing</span>}</td>}
                          <td style={s.td}>
                            {d.payment_status === 'refunded' ? <span style={{ ...s.badgePending, color: C.red }}>↩ Refunded</span> : d.payment_status === 'confirmed' ? <span style={s.badgeIssued}>✓ Paid</span> : <span style={s.badgePending}>⚠️ Unverified</span>}
                          </td>
                          <td style={s.td}>{d.receipt_issued ? <span style={s.badgeIssued}>✓ Issued</span> : <span style={s.badgePending}>Pending</span>}</td>
                        </>
                      ) : (() => {
                        const cellRenderers = {
                          amount: <td key="amount" style={s.td}><span style={s.amountText}>${Number(d.amount).toLocaleString()}</span></td>,
                          date: <td key="date" style={s.td}><span style={s.dateText}>{new Date(d.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</span></td>,
                          cause: (
                            <td key="cause" style={s.td}>
                              {causeNameForDonation(d) ? (
                                <span style={{ fontSize: 10, fontWeight: 500, color: C.gold, background: '#FDF8EC', padding: '3px 10px', borderRadius: 20, display: 'inline-block', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={causeNameForDonation(d)}>🎯 {causeNameForDonation(d)}</span>
                              ) : (
                                <span style={{ fontSize: 11, color: C.muted }}>General</span>
                              )}
                            </td>
                          ),
                          source: <td key="source" style={s.td}>{d.source === 'manual' ? <span style={{ ...s.badgePending, color: C.gold, background: '#FDF8EC' }}>✏️ {d.payment_method || 'Manual'}</span> : <span style={s.badgeIssued}>📱 App</span>}</td>,
                          reference: <td key="reference" style={s.td}><span style={{ fontSize: 11, fontFamily: 'monospace', color: C.muted }} title={d.payment_ref || ''}>{d.payment_ref || '—'}</span></td>,
                          nric: charityIsIpc ? <td key="nric" style={s.td}>{d.donor_nric ? <span style={s.badgeIssued}>✓ {d.donor_nric}</span> : <span style={s.badgePending}>⚠️ Missing</span>}</td> : null,
                          payment: (
                            <td key="payment" style={s.td}>
                              {d.payment_status === 'refunded' ? <span style={{ ...s.badgePending, color: C.red }}>↩ Refunded</span> : d.payment_status === 'confirmed' ? <span style={s.badgeIssued}>✓ Paid</span> : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                                  <span style={s.badgePending}>⚠️ Unverified</span>
                                  {userRole === 'ed' ? (
                                    <button
                                      style={{ fontSize: 10, fontWeight: 700, color: C.teal, background: 'white', border: `1px solid ${C.teal}`, borderRadius: 20, padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setConfirmModal({
                                          title: 'Confirm this payment?',
                                          subtitle: 'Check the transaction reference against your bank or PayNow statement before confirming.',
                                          donorName: d.donor_name,
                                          amount: d.amount,
                                          reference: d.payment_ref || d.receipt_number,
                                          steps: ['Mark payment as confirmed', 'Issue a receipt'],
                                          receiptPreviewDonation: d,
                                          confirmLabel: 'Confirm payment',
                                          onConfirm: () => confirmPaymentFlow(d),
                                        })
                                      }}
                                    >✓ Confirm</button>
                                  ) : (
                                    <span style={{ fontSize: 10, color: C.muted, fontStyle: 'italic' }}>Awaiting ED confirmation</span>
                                  )}
                                </div>
                              )}
                            </td>
                          ),
                          receipt: <td key="receipt" style={s.td}>{d.receipt_issued ? <span style={s.badgeIssued}>✓ Issued</span> : <span style={s.badgePending}>Pending</span>}</td>,
                          receiptNo: <td key="receiptNo" style={s.td}><span style={{ fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{d.receipt_number || d.payment_ref || '—'}</span></td>,
                          thankYou: <td key="thankYou" style={s.td}>{d.thank_you_sent ? <span style={s.badgeIssued}>💌 Sent</span> : (d.payment_status === 'refunded' || noThankYouExpected) ? <span style={{ fontSize: 10, color: C.muted, fontStyle: 'italic' }}>N/A</span> : <span style={{ fontSize: 10, color: C.muted }}>—</span>}</td>,
                        }
                        return orderedDonationColumns.map(o => cellRenderers[o.key]).filter(Boolean)
                      })()}
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {filteredDonations.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: `1px solid ${C.border}`, flexWrap: 'wrap', gap: 10 }}>
                <select style={{ ...s.filterSelect, padding: '6px 10px', fontSize: 12 }} value={donationsPerPage} onChange={e => { setDonationsPerPage(parseInt(e.target.value)); setDonationsPage(0) }}>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    style={{ ...s.viewBtn, opacity: donationsPage === 0 ? 0.4 : 1, cursor: donationsPage === 0 ? 'not-allowed' : 'pointer' }}
                    disabled={donationsPage === 0}
                    onClick={() => setDonationsPage(p => Math.max(0, p - 1))}
                  >← Previous</button>
                  <span style={{ fontSize: 12, color: C.muted }}>Page {donationsPage + 1} of {donationsTotalPages}</span>
                  <button
                    style={{ ...s.viewBtn, opacity: donationsPage >= donationsTotalPages - 1 ? 0.4 : 1, cursor: donationsPage >= donationsTotalPages - 1 ? 'not-allowed' : 'pointer' }}
                    disabled={donationsPage >= donationsTotalPages - 1}
                    onClick={() => setDonationsPage(p => Math.min(donationsTotalPages - 1, p + 1))}
                  >Next →</button>
                </div>
              </div>
            )}
          </div>}
        </div>

        {(userRole === 'staff' || userRole === 'ed') && selectedDonation && (
          <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 24 }} onClick={() => { setSelectedDonation(null); resetManualForm(); setQuickEmailInput(''); setQuickNricInput('') }}>
          <div style={isMobile ? { background: C.white, width: '100%', height: '100%', overflowY: 'auto' } : { width: 760, maxWidth: '100%', borderRadius: 8 }} onClick={e => e.stopPropagation()}>
            <div style={isMobile ? { background: C.white, minHeight: '100%', padding: 20 } : { background: C.white, borderRadius: 8, overflow: 'hidden', maxHeight: '96vh', display: 'flex', flexDirection: 'column', padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: C.fontVoice, fontSize: 18, fontWeight: 500, color: 'white', flexShrink: 0 }}>{selectedDonation.donor_name?.charAt(0)}</div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>Donation Details</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{selectedDonation.donor_name}</div>
                  </div>
                </div>
                <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => { setSelectedDonation(null); resetManualForm(); setQuickEmailInput(''); setQuickNricInput('') }}>✕</button>
              </div>

              <div style={{ background: C.forest, borderRadius: 14, padding: '20px 22px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 34, fontWeight: 800, color: 'white', lineHeight: 1 }}>${Number(selectedDonation.amount).toLocaleString()}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
                    {new Date(selectedDonation.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })} · {selectedDonation.source === 'manual' ? `${selectedDonation.payment_method || 'Manual'} entry` : `${selectedDonation.payment_method || 'PayNow'} via Giving Tree App`}{selectedDonation.recurring_gift_id ? ' · Recurring' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  {selectedDonation.payment_status === 'refunded' ? (
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#A32D2D', background: '#FCEBEB', padding: '4px 10px', borderRadius: 20 }}>↩ Refunded</span>
                  ) : selectedDonation.payment_status === 'confirmed' ? (
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#3B6D11', background: '#EAF3DE', padding: '4px 10px', borderRadius: 20 }}>Paid</span>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#A32D2D', background: '#FCEBEB', padding: '4px 10px', borderRadius: 20 }}>Unpaid</span>
                  )}
                  {selectedDonation.payment_status === 'confirmed' && (
                    selectedDonation.receipt_issued ? (
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#3B6D11', background: '#EAF3DE', padding: '4px 10px', borderRadius: 20 }}>Receipted</span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#854F0B', background: '#FAEEDA', padding: '4px 10px', borderRadius: 20 }}>Receipt pending</span>
                    )
                  )}
                  {selectedDonation.payment_status === 'confirmed' && selectedDonation.receipt_issued && selectedDonation.donor_email?.trim() && (
                    selectedDonation.thank_you_sent ? (
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#3B6D11', background: '#EAF3DE', padding: '4px 10px', borderRadius: 20 }}>Thanked</span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#854F0B', background: '#FAEEDA', padding: '4px 10px', borderRadius: 20 }}>Not thanked</span>
                    )
                  )}
                </div>
              </div>
              <div style={{ overflowY: 'auto', flex: 1, display: isMobile ? 'block' : 'grid', gridTemplateColumns: isMobile ? 'none' : '1fr 1fr', gap: isMobile ? 0 : 20 }}>
                <div>

                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Donor</div>
                <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: '4px 16px', marginBottom: 16 }}>
                  {[
                    { label: 'Name', key: 'donor_name', value: selectedDonation.donor_name || '—', editable: true },
                    { label: 'Email', key: 'donor_email', value: selectedDonation.donor_email || '—', editable: true },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                      <span style={{ fontSize: 13, color: C.muted }}>{item.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{item.value}</span>
                    </div>
                  ))}
                  {charityIsIpc && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                      <span style={{ fontSize: 13, color: C.muted }}>NRIC / FIN</span>
                      {selectedDonation.donor_nric ? (
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.sage }}>✓ {selectedDonation.donor_nric}</span>
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.warning }}>⚠️ Missing</span>
                      )}
                    </div>
                  )}
                </div>

                {selectedDonation.source === 'manual' && selectedDonation.acquisition_source && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>How they found you</div>
                    <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: '4px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                        <span style={{ fontSize: 13, color: C.muted }}>Source</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: C.text, textTransform: 'capitalize' }}>{selectedDonation.acquisition_source?.replace('_', ' ') || '—'}</span>
                      </div>
                      {selectedDonation.acquisition_source === 'referral' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                          <span style={{ fontSize: 13, color: C.muted }}>Referred by</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{donorList.find(d => (d.email?.trim() || d.name) === selectedDonation.referred_by_donor_key)?.name || '—'}</span>
                        </div>
                      )}
                      {selectedDonation.acquisition_source && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                          <span style={{ fontSize: 13, color: C.muted }}>Details</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{selectedDonation.acquisition_source_detail || '—'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!selectedDonation.donor_email?.trim() && selectedDonation.source === 'manual' && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Add donor email to send a thank you</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input style={{ ...s.formInput, padding: '7px 10px', fontSize: 12 }} placeholder="donor@email.com" type="email" value={quickEmailInput} onChange={e => setQuickEmailInput(e.target.value)} />
                      <button style={{ ...s.issueBtn, padding: '7px 12px', fontSize: 12, flexShrink: 0 }} onClick={() => {
                        const val = quickEmailInput.trim()
                        if (!val) return
                        supabase.from('donations').update({ donor_email: val }).eq('id', selectedDonation.id)
                          .then(() => {
                            setDonations(prev => prev.map(x => x.id === selectedDonation.id ? { ...x, donor_email: val } : x))
                            setSelectedDonation(prev => ({ ...prev, donor_email: val }))
                            setQuickEmailInput('')
                          })
                      }}>Save</button>
                    </div>
                  </div>
                )}

                {charityIsIpc && !selectedDonation.donor_nric && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input style={{ ...s.formInput, padding: '7px 10px', fontSize: 12 }} placeholder="e.g. S1234567A" maxLength={9} value={quickNricInput} onChange={e => setQuickNricInput(e.target.value)} />
                      <button style={{ ...s.issueBtn, padding: '7px 12px', fontSize: 12, flexShrink: 0 }} onClick={() => {
                        const val = quickNricInput.trim().toUpperCase()
                        if (!val) return
                        if (!/^[A-Z]\d{7}[A-Z]$/.test(val)) { showToast('Invalid NRIC format. Should be like S1234567A', 'error'); return }
                        supabase.from('donations').update({ donor_nric: val }).eq('id', selectedDonation.id)
                          .then(async () => {
                            await supabase.from('audit_log').insert({
                              actor_type: 'charity',
                              actor_email: session.user.email,
                              action: 'nric_added',
                              donation_id: selectedDonation.id,
                              details: { donor_name: selectedDonation.donor_name },
                            })
                            setDonations(prev => prev.map(x => x.id === selectedDonation.id ? { ...x, donor_nric: val } : x))
                            setSelectedDonation(prev => ({ ...prev, donor_nric: val }))
                            setQuickNricInput('')
                          })
                      }}>Save</button>
                    </div>
                    {selectedDonation.donor_email?.trim() && (
                      <button style={{ ...s.viewBtn, marginTop: 8, width: '100%', textAlign: 'center', fontSize: 12, opacity: nricRequestSent[selectedDonation.id] ? 0.5 : 1 }} onClick={async () => {
                        if (nricRequestSent[selectedDonation.id]) { showToast('Email already sent for this donation', 'error'); return }
                        const nricVars = { donor_name: selectedDonation.donor_name, charity_name: charityName, amount: selectedDonation.amount, date: new Date(selectedDonation.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' }) }
                        const savedNric = emailTemplates.nric_request
                        const { error } = await sendCharityEmail({ donor_name: selectedDonation.donor_name, donor_email: selectedDonation.donor_email, charity_name: charityName, amount: selectedDonation.amount, date: nricVars.date, request_nric: true, subject_override: savedNric?.subject ? fillTemplate(savedNric.subject, nricVars) : undefined, custom_message: savedNric?.body ? fillTemplate(savedNric.body, nricVars) : undefined })
                        if (error) { showToast('Failed to send email', 'error'); return }
                        setNricRequestSent(prev => ({ ...prev, [selectedDonation.id]: true }))
                        showToast(`NRIC request sent to ${selectedDonation.donor_email}`)
                      }}>📧 {nricRequestSent[selectedDonation.id] ? 'Email Sent ✓' : 'Request NRIC via Email'}</button>
                    )}
                  </div>
                )}

                {charityIsIpc ? (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Tax Deduction</div>
                    <div style={{ background: C.successBg, borderRadius: 12, border: `1px solid #C8E3D3`, padding: '4px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #D7EBE0' }}>
                        <span style={{ fontSize: 13, color: '#3B6D11' }}>250% Deductible</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: C.forest }}>${(selectedDonation.amount * 2.5).toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                        <span style={{ fontSize: 13, color: '#3B6D11' }}>Est. Tax Savings</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: C.forest }}>${(selectedDonation.amount * 2.5 * 0.22).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Donation Summary</div>
                    <div style={{ background: C.ivory, borderRadius: 12, border: `1px solid ${C.border}`, padding: '14px 16px' }}>
                      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>This charity is registered but not an IPC, so this donation is not eligible for a tax deduction under Singapore tax law.</div>
                    </div>
                  </>
                )}

                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 20 }}>Notes</div>
                {editingNoteId === selectedDonation.id ? (
                  <div style={{ marginBottom: 20 }}>
                    <textarea style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.sage}`, borderRadius: 10, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: C.white, color: C.text, boxSizing: 'border-box', resize: 'vertical', minHeight: 80 }}
                      value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..." autoFocus />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button style={{ ...s.issueBtn, flex: 1 }} onClick={() => {
                        supabase.from('donations').update({ notes: noteText }).eq('id', selectedDonation.id)
                          .then(() => {
                            setDonations(prev => prev.map(x => x.id === selectedDonation.id ? { ...x, notes: noteText } : x))
                            setSelectedDonation(prev => ({ ...prev, notes: noteText }))
                            setEditingNoteId(null)
                          })
                      }}>Save</button>
                      <button style={{ ...s.viewBtn, flex: 1 }} onClick={() => setEditingNoteId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: C.white, borderRadius: 12, padding: '14px 16px', border: `1px dashed ${C.border}`, cursor: 'pointer', minHeight: 20 }}
                    onClick={() => { setEditingNoteId(selectedDonation.id); setNoteText(selectedDonation.notes || '') }}>
                    {selectedDonation.notes
                      ? <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{selectedDonation.notes}</div>
                      : <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>Click to add a note...</div>
                    }
                  </div>
                )}

                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 20 }}>Impact Note</div>
                {editingImpactNoteId === selectedDonation.id ? (
                  <div style={{ marginBottom: 20 }}>
                    <textarea style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.gold}`, borderRadius: 10, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: C.white, color: C.text, boxSizing: 'border-box', resize: 'vertical', minHeight: 60 }}
                      value={impactNoteText} onChange={e => setImpactNoteText(e.target.value)} placeholder="e.g. This $1,000 funded 10 tuition sessions for 3 students in Q2." autoFocus />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button style={{ ...s.issueBtn, flex: 1 }} onClick={() => {
                        supabase.from('donations').update({ impact_note: impactNoteText }).eq('id', selectedDonation.id)
                          .then(() => {
                            setDonations(prev => prev.map(x => x.id === selectedDonation.id ? { ...x, impact_note: impactNoteText } : x))
                            setSelectedDonation(prev => ({ ...prev, impact_note: impactNoteText }))
                            setEditingImpactNoteId(null)
                          })
                      }}>Save</button>
                      <button style={{ ...s.viewBtn, flex: 1 }} onClick={() => setEditingImpactNoteId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: '#FDF8EC', borderRadius: 12, padding: '14px 16px', border: `1px dashed ${C.warningBorder}`, cursor: 'pointer', minHeight: 20 }}
                    onClick={() => { setEditingImpactNoteId(selectedDonation.id); setImpactNoteText(selectedDonation.impact_note || '') }}>
                    {selectedDonation.impact_note
                      ? <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>🎯 {selectedDonation.impact_note}</div>
                      : <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>Click to describe what this gift funded...</div>
                    }
                  </div>
                )}
                </div>

                <div>

                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Record</div>
                <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: '4px 16px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                    <span style={{ fontSize: 13, color: C.muted }}>Amount (SGD)</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>${Number(selectedDonation.amount).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                    <span style={{ fontSize: 13, color: C.muted }}>Date</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{new Date(selectedDonation.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  {selectedDonation.source === 'manual' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                      <span style={{ fontSize: 13, color: C.muted }}>Payment Method</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{selectedDonation.payment_method || '—'}</span>
                    </div>
                  )}
                  {selectedDonation.source === 'manual' && (selectedDonation.payment_method === 'Bank Wire' || selectedDonation.payment_method === 'Cheque' || selectedDonation.payment_method === 'PayNow') && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                      <span style={{ fontSize: 13, color: C.muted }}>{selectedDonation.payment_method === 'Cheque' ? 'Cheque No.' : selectedDonation.payment_method === 'PayNow' ? 'PayNow Reference' : 'Wire Reference'}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.text, fontFamily: 'monospace' }}>{selectedDonation.payment_ref || '—'}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                    <span style={{ fontSize: 13, color: C.muted }}>Cause</span>
                    {causeNameForDonation(selectedDonation) ? (
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.warning, background: C.warningBg, padding: '3px 10px', borderRadius: 20 }}>{causeNameForDonation(selectedDonation)}</span>
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>General Donation</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                    <span style={{ fontSize: 13, color: C.muted }}>Receipt Name</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{selectedDonation.receipt_name || selectedDonation.donor_name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                    <span style={{ fontSize: 13, color: C.muted }}>Receipt No.</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.text, fontFamily: 'monospace' }}>{selectedDonation.source === 'manual' ? (selectedDonation.receipt_number || '—') : (selectedDonation.payment_ref || '—')}</span>
                  </div>
                  {selectedDonation.reissued_from && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.ivoryDark}` }}>
                      <span style={{ fontSize: 13, color: C.muted }}>Reissued From</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: C.warning, fontFamily: 'monospace' }}>{selectedDonation.reissued_from} (voided)</span>
                    </div>
                  )}
                  {selectedDonation.void_reason && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                      <span style={{ fontSize: 13, color: C.muted }}>Void Reason</span>
                      <span style={{ fontSize: 12, color: C.muted, fontStyle: 'italic', maxWidth: 200, textAlign: 'right' }}>{selectedDonation.void_reason}</span>
                    </div>
                  )}
                </div>

                {/* ACTIONS */}
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedDonation.receipt_issued && (
                    <>
                      <button style={{ ...s.viewBtn, justifyContent: 'center', opacity: charityIpcLoaded ? 1 : 0.5 }} disabled={!charityIpcLoaded} onClick={() => exportSingleReceiptPDF(selectedDonation)}>📄 Download Receipt PDF</button>

                    </>
                  )}
                  {selectedDonation.payment_status === 'confirmed' && donationPledgeLink && (
                    <div style={{ fontSize: 12, color: C.sage, fontWeight: 500, background: '#EAF3EC', border: `1px solid ${C.sage}`, borderRadius: 6, padding: '8px 12px' }}>
                      ✓ Already linked to {donationPledgeLink.pledgeDonorName || 'a'} pledge (${Number(donationPledgeLink.amount_applied).toLocaleString()}){donationPledgeLink.pledgeReference ? ` · ${donationPledgeLink.pledgeReference}` : ''}
                    </div>
                  )}
                  {selectedDonation.recurring_gift_id && (() => {
                    const linkedGift = recurringGifts.find(g => g.id === selectedDonation.recurring_gift_id)
                    return linkedGift ? (
                      <div style={{ fontSize: 12, color: C.forest, fontWeight: 500, background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px' }}>
                        🔁 From recurring gift · {linkedGift.reference || `$${Number(linkedGift.amount).toLocaleString()}/${linkedGift.frequency}`}
                      </div>
                    ) : null
                  })()}
                  {(() => {
                    const myRefunds119 = refunds.filter(r => r.donation_id === selectedDonation.id)
                    return myRefunds119.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {myRefunds119.map(r => (
                          <div key={r.id} style={{ fontSize: 12, background: '#FBEEE9', border: `1px solid #E0BBA9`, borderRadius: 6, padding: '8px 10px', color: C.red, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            <span>Refunded ${Number(r.refund_amount).toLocaleString()} on {new Date(r.refund_date).toLocaleDateString('en-SG')} — {r.reason}</span>
                            <button
                              style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 11, textDecoration: 'underline', flexShrink: 0, padding: 0 }}
                              onClick={() => setConfirmModal({
                                title: 'Delete this refund record?',
                                description: `This will permanently remove the $${Number(r.refund_amount).toLocaleString()} refund entered on ${new Date(r.refund_date).toLocaleDateString('en-SG')}, freeing up that amount to be refunded again if needed.`,
                                confirmLabel: 'Delete refund',
                                onConfirm: () => deleteRefund(r),
                              })}
                            >Delete</button>
                          </div>
                        ))}
                      </div>
                    ) : null
                  })()}
                  {selectedDonation.payment_status === 'confirmed' && !selectedDonation.receipt_issued && (
                    <button style={{ ...s.btnForest, justifyContent: 'center' }} onClick={() => {
                      setConfirmModal({
                        title: 'Issue receipt for this donation?',
                        subtitle: 'Review the details below before issuing. Once issued, the donor will receive a thank-you email if they have one on file.',
                        donorName: selectedDonation.donor_name,
                        amount: selectedDonation.amount,
                        reference: selectedDonation.receipt_number || selectedDonation.payment_ref,
                        steps: [
                          `Receipt name: ${selectedDonation.receipt_name || selectedDonation.donor_name}`,
                          `Amount: SGD $${Number(selectedDonation.amount).toLocaleString()}`,
                          `Date: ${new Date(selectedDonation.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}`,
                          ...(selectedDonation.donor_email ? [`Thank-you email will be sent to ${selectedDonation.donor_email}`] : ['No email on file — receipt only']),
                        ],
                        confirmLabel: 'Issue Receipt',
                        onConfirm: async () => {
                          const { error } = await supabase.from('donations').update({ receipt_issued: true }).eq('id', selectedDonation.id)
                          if (error) { showToast('Error issuing receipt', 'error'); return }
                          setDonations(prev => prev.map(x => x.id === selectedDonation.id ? { ...x, receipt_issued: true } : x))
                          setSelectedDonation(prev => ({ ...prev, receipt_issued: true }))

                          if (!selectedDonation.donor_email) {
                            showToast('Receipt issued ✓')
                            return
                          }

                          const donationSnapshot = { ...selectedDonation, receipt_issued: true }
                          const { error: emailError } = await sendCharityEmail({
                            donor_name: donationSnapshot.donor_name,
                            donor_email: donationSnapshot.donor_email,
                            charity_name: charityName,
                            charity_uen: charityUen,
                            amount: donationSnapshot.amount,
                            date: new Date(donationSnapshot.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' }),
                            payment_ref: donationSnapshot.payment_ref,
                            notes: donationSnapshot.notes,
                            cause_title: causeNameForDonation(donationSnapshot),
                          })
                          if (!emailError) {
                            await supabase.from('donations').update({ thank_you_sent: true }).eq('id', donationSnapshot.id)
                            setDonations(prev => prev.map(x => x.id === donationSnapshot.id ? { ...x, thank_you_sent: true } : x))
                            setSelectedDonation(prev => ({ ...prev, thank_you_sent: true }))
                            showToast('Receipt issued ✓ — thank you email sent to ' + donationSnapshot.donor_email + ' 💌')
                          } else {
                            showToast('Receipt issued but thank you email failed — send manually', 'error')
                          }
                        },
                      })
                    }}>🧾 Issue Receipt</button>
                  )}
                  {selectedDonation.payment_status !== 'confirmed' && selectedDonation.payment_status !== 'refunded' && (
                    userRole === 'ed' ? (
                      <button style={{ ...s.btnForest, justifyContent: 'center' }} onClick={() => {
                        const refToShow = selectedDonation.payment_ref || selectedDonation.receipt_number
                        setConfirmModal({
                          title: 'Confirm this payment?',
                          subtitle: 'Check the transaction reference against your bank or PayNow statement before confirming.',
                          donorName: selectedDonation.donor_name,
                          amount: selectedDonation.amount,
                          reference: refToShow,
                          steps: ['Mark payment as confirmed', 'Issue a receipt'],
                          receiptPreviewDonation: selectedDonation,
                          confirmLabel: 'Confirm payment',
                          onConfirm: () => confirmPaymentFlow(selectedDonation),
                        })
                      }}>✓ Confirm Payment & Issue Receipt</button>
                    ) : (
                      <div style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: '10px 0' }}>Only an Executive Director can confirm this payment.</div>
                    )
                  )}
                  {selectedDonation.payment_status === 'confirmed' && selectedDonation.donor_email?.trim() && (
                    <button
                      style={{ ...s.btnGold, justifyContent: 'center', opacity: (selectedDonation.thank_you_sent || sendingThankYouId === selectedDonation.id) ? 0.7 : 1, cursor: sendingThankYouId === selectedDonation.id ? 'default' : 'pointer' }}
                      disabled={sendingThankYouId === selectedDonation.id}
                      onClick={() => {
                        const defaults = thankYouDefaultsFor(selectedDonation)
                        setThankYouSubjectInput(defaults.subject)
                        setThankYouCustomMessage(defaults.body)
                        setThankYouPreviewing(false)
                        setThankYouPreviewModal(selectedDonation)
                      }}
                    >{sendingThankYouId === selectedDonation.id ? '⏳ Sending...' : selectedDonation.thank_you_sent ? '💌 Resend Thank You + Receipt' : '💌 Send Thank You + Receipt'}</button>
                  )}
                  {selectedDonation.source === 'manual' && (
                    <button style={s.viewBtn} onClick={() => {
                      setManualForm({
                        donor_name: selectedDonation.is_anonymous ? '' : (selectedDonation.donor_name || ''),
                        donor_nric: selectedDonation.donor_nric || '',
                        amount: selectedDonation.amount ?? '',
                        payment_method: selectedDonation.payment_method || 'Cash',
                        notes: selectedDonation.notes || '',
                        donor_email: selectedDonation.donor_email || '',
                        date: selectedDonation.created_at ? selectedDonation.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
                        cause_id: selectedDonation.cause_id || '',
                        receipt_name: selectedDonation.receipt_name || '',
                        is_anonymous: selectedDonation.is_anonymous || false,
                        acquisition_source: selectedDonation.acquisition_source || '',
                        acquisition_source_detail: selectedDonation.acquisition_source_detail || '',
                        referred_by_donor_key: selectedDonation.referred_by_donor_key || '',
                        payment_ref: selectedDonation.payment_ref || '',
                        duplicateConfirmed: true,
                      })
                      setManualReferralSearch(donorList.find(d => (d.email?.trim() || d.name) === selectedDonation.referred_by_donor_key)?.name || '')
                      setEditingDonationId(selectedDonation.id)
                      setShowManualForm(true)
                    }}>✏️ Edit Entry</button>
                  )}

                  {(() => {
                    const hasMoreActions =
                      (selectedDonation.payment_status === 'confirmed' && !donationPledgeLink && pledges.filter(p => p.status === 'pending').length > 0) ||
                      (selectedDonation.payment_status === 'confirmed' || selectedDonation.payment_status === 'refunded') ||
                      (selectedDonation.receipt_issued && selectedDonation.source === 'manual' && selectedDonation.payment_status !== 'refunded') ||
                      (selectedDonation.payment_status === 'confirmed' && !selectedDonation.thank_you_sent && userRole === 'ed') ||
                      selectedDonation.source === 'manual'
                    if (!hasMoreActions) return null
                    return (
                      <>
                        <button style={{ ...s.viewBtn, justifyContent: 'center' }} onClick={() => setShowDonationMoreActions(v => !v)}>{showDonationMoreActions ? '▲ Fewer actions' : '⋯ More actions'}</button>
                        {showDonationMoreActions && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 6, padding: 10 }}>
                            {selectedDonation.payment_status === 'confirmed' && !donationPledgeLink && pledges.filter(p => p.status === 'pending').length > 0 && (
                              <button style={{ ...s.viewBtn, justifyContent: 'center' }} onClick={() => setShowManualPledgeLinkModal(true)}>🤝 Link to Pledge</button>
                            )}
                            {(selectedDonation.payment_status === 'confirmed' || selectedDonation.payment_status === 'refunded') && (() => {
                              const myRefunds120 = refunds.filter(r => r.donation_id === selectedDonation.id)
                              const totalRefunded120 = myRefunds120.reduce((s, r) => s + Number(r.refund_amount), 0)
                              if (totalRefunded120 > 0) return null
                              return showRefundForm ? (
                                <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, padding: 12 }}>
                                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>This will refund the full ${Number(selectedDonation.amount).toLocaleString()} donation, dated today.</div>
                                  <textarea style={{ ...s.formInput, fontSize: 12, minHeight: 50, resize: 'vertical', marginBottom: 8 }} placeholder="Reason for refund" value={refundForm.reason} onChange={e => setRefundForm(f => ({ ...f, reason: e.target.value }))} />
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <button style={{ ...s.btnForest, fontSize: 12, opacity: savingRefund ? 0.7 : 1 }} disabled={savingRefund} onClick={() => saveRefund(selectedDonation)}>{savingRefund ? 'Refunding...' : 'Confirm Full Refund'}</button>
                                    <button style={{ ...s.viewBtn, fontSize: 12 }} disabled={savingRefund} onClick={() => setShowRefundForm(false)}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <button style={{ ...s.viewBtn, justifyContent: 'center' }} onClick={() => setShowRefundForm(true)}>↩️ Refund This Donation</button>
                              )
                            })()}
                            {selectedDonation.receipt_issued && selectedDonation.source === 'manual' && selectedDonation.payment_status !== 'refunded' && (
                              <button style={{ ...s.viewBtn, color: C.red, borderColor: C.red, justifyContent: 'center' }} onClick={() => { setShowVoidModal(true); setVoidReason('') }}>🚫 Void & Reissue Receipt</button>
                            )}
                            {selectedDonation.payment_status === 'confirmed' && !selectedDonation.thank_you_sent && userRole === 'ed' && (
                              <button style={{ ...s.viewBtn, justifyContent: 'center', color: C.warning, borderColor: C.warningBorder }} onClick={() => {
                                setConfirmModal({
                                  title: 'Undo this payment confirmation?',
                                  description: 'This will revert the donation to "awaiting confirmation" and un-issue its receipt. Use this if the payment was confirmed by mistake.',
                                  confirmLabel: 'Undo confirmation',
                                  onConfirm: () => unconfirmPayment(selectedDonation),
                                })
                              }}>↩️ Undo Confirmation</button>
                            )}
                            {selectedDonation.source === 'manual' && (
                              <button style={deletingId === selectedDonation.id ? s.issuingBtn : { ...s.viewBtn, color: C.red, borderColor: C.red }} disabled={deletingId === selectedDonation.id} onClick={() => deleteDonation(selectedDonation.id)}>{deletingId === selectedDonation.id ? '⏳ Deleting...' : '🗑️ Delete Entry'}</button>
                            )}
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>

                </div>
              </div>
            </div>
          </div>
          </div>
        )}
      </div>
    </div>
  )
}
