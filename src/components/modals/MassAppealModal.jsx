import { C } from '../../theme'
import { s } from '../../styles'

// BUG FIX (2026-07-20): this modal used to be nested inside `activeTab === 'massappeal'`,
// but the "New Appeal" buttons that open it live on the Campaigns tab (activeTab === 'promotions')
// and nothing in the app ever sets activeTab to 'massappeal' — so the buttons silently did
// nothing. Rendered unconditionally here (controlled entirely by showMassAppealModal) so it
// opens correctly regardless of which tab is active. Pre-existing bug, not introduced by the
// Phase 5 tab-extraction refactor — confirmed by reading the original code before moving it.
export function MassAppealModal({
  showMassAppealModal, setShowMassAppealModal, massAppealStep, setMassAppealStep,
  massAppealForm, setMassAppealForm, massAppealRefs, setMassAppealRefs, massAppealProgress, massAppealCancelRef,
  myCauses, donorList, donorTagsMap,
  showTagSegmentManager, setShowTagSegmentManager, tagSegmentName, setTagSegmentName,
  tagSegmentSearch, setTagSegmentSearch, tagSegmentSelectedKeys, setTagSegmentSelectedKeys,
  savingTagSegment, saveTagSegment, generateMassAppealRefs, setShowAppealPreview,
  sendingTestAppeal, sendTestAppealToSelf, setConfirmModal, sendMassAppealEmails, downloadMassAppealQRZip,
  defaultMassAppealMessage,
}) {
  if (!showMassAppealModal) return null
  return (
    <div data-modal-overlay="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => { if (!massAppealProgress) { setShowMassAppealModal(false); setMassAppealStep('setup') } }}>
      <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: C.forest }}>
            {massAppealStep === 'setup' ? 'New Appeal' : massAppealStep === 'preview' && !massAppealProgress ? `${massAppealRefs.filter(r => r.selected).length} donors selected` : massAppealProgress ? 'Sending appeals...' : 'Appeal sent'}
          </div>
          {!massAppealProgress && (
            <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => { setShowMassAppealModal(false); setMassAppealStep('setup') }}>✕</button>
          )}
        </div>

        {/* Setup form */}
        {massAppealStep === 'setup' && !massAppealProgress && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            <label style={{ display: 'block' }}>
              <div style={s.formLabel}>Campaign (Optional)</div>
              <select style={s.formInput} value={massAppealForm.cause_id} onChange={e => setMassAppealForm(f => ({ ...f, cause_id: e.target.value }))}>
                <option value="">No specific campaign — give it a name below</option>
                {myCauses.filter(c => c.status === 'approved' && c.type === 'campaign' && (!c.end_date || new Date(c.end_date) >= new Date())).map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              {!massAppealForm.cause_id && (
                <div style={{ marginTop: 8 }}>
                  <input
                    style={s.formInput}
                    placeholder="e.g. Q1 Appeal, Year-End Appeal, Chinese New Year Appeal"
                    value={massAppealForm.customLabel || ''}
                    onChange={e => setMassAppealForm(f => ({ ...f, customLabel: e.target.value }))}
                  />
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Not tied to a tracked campaign — just a label to tell your appeals apart. Leave blank for "General Appeal."</div>
                </div>
              )}
            </label>
            <label style={{ display: 'block' }}>
              <div style={s.formLabel}>Default Amount (SGD) *</div>
              <input style={s.formInput} type="number" placeholder="e.g. 50" value={massAppealForm.amount} onChange={e => setMassAppealForm(f => ({ ...f, amount: e.target.value }))} />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Each donor's QR will be pre-filled with this amount</div>
            </label>
            <label style={{ display: 'block' }}>
              <div style={s.formLabel}>Personal Message (Optional)</div>
              <textarea style={{ ...s.formInput, minHeight: 100, resize: 'vertical' }} placeholder="e.g. Hi [name], we're reaching out for our year-end appeal..." value={massAppealForm.message} onChange={e => setMassAppealForm(f => ({ ...f, message: e.target.value }))} />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Appears in the email above the QR code. Type <strong>[name]</strong> anywhere to insert each donor's first name automatically.</div>
            </label>
            <label style={{ display: 'block' }}>
              <div style={s.formLabel}>Send only to donors in a segment (Optional)</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select style={s.formInput} value={massAppealForm.targetTag || 'All'} onChange={e => setMassAppealForm(f => ({ ...f, targetTag: e.target.value }))}>
                  <option value="All">Everyone with email on file</option>
                  {[...new Set(Object.values(donorTagsMap).flat().map(t => t.tag))].sort().map(tag => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
                <button type="button" style={{ ...s.viewBtn, flexShrink: 0, whiteSpace: 'nowrap' }} onClick={() => setShowTagSegmentManager(v => !v)}>{showTagSegmentManager ? '✕ Close' : '+ New segment'}</button>
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Use this to send targeted updates — e.g. group donors by programme interest and reach just that segment instead of everyone.</div>
            </label>
            {showTagSegmentManager && (
              <div style={{ background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 6, padding: 12 }}>
                <div style={s.formLabel}>Segment name</div>
                <input style={{ ...s.formInput, marginBottom: 10 }} placeholder="e.g. Board Members, Gala 2024 Attendees" value={tagSegmentName} onChange={e => setTagSegmentName(e.target.value)} maxLength={40} />
                <div style={s.formLabel}>Select donors for this segment</div>
                <input style={{ ...s.formInput, marginBottom: 8 }} placeholder="🔍 Search donors..." value={tagSegmentSearch} onChange={e => setTagSegmentSearch(e.target.value)} />
                <div style={{ maxHeight: 220, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 6, background: C.white, marginBottom: 10 }}>
                  {donorList.filter(d => d.name?.toLowerCase().includes(tagSegmentSearch.toLowerCase())).map(d => {
                    const key = d.email?.trim() || d.name
                    const checked = tagSegmentSelectedKeys.has(key)
                    return (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: `1px solid ${C.ivoryDark}`, cursor: 'pointer', fontSize: 12.5 }}>
                        <input type="checkbox" checked={checked} onChange={() => setTagSegmentSelectedKeys(prev => { const next = new Set(prev); if (checked) next.delete(key); else next.add(key); return next })} />
                        {d.name}
                      </label>
                    )
                  })}
                  {donorList.length === 0 && <div style={{ padding: 12, fontSize: 12, color: C.muted, fontStyle: 'italic' }}>No donors yet.</div>}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>{tagSegmentSelectedKeys.size} donor{tagSegmentSelectedKeys.size !== 1 ? 's' : ''} selected</div>
                <button style={{ ...s.btnForest, justifyContent: 'center', width: '100%', opacity: savingTagSegment ? 0.6 : 1 }} disabled={savingTagSegment} onClick={saveTagSegment}>{savingTagSegment ? 'Saving...' : '✓ Save Segment'}</button>
              </div>
            )}
            <div style={{ background: C.successBg, border: `1px solid ${C.sage}`, borderRadius: 6, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.forest, marginBottom: 4 }}>Who will receive this?</div>
              <div style={{ fontSize: 13, color: C.forest }}><strong>{donorList.filter(d => {
                if (d.deactivated || d.doNotContact || !d.email?.trim()) return false
                if (massAppealForm.targetTag && massAppealForm.targetTag !== 'All') {
                  const dk45 = d.email?.trim() || d.name
                  return (donorTagsMap[dk45] || []).some(t => t.tag === massAppealForm.targetTag)
                }
                return true
              }).length}</strong> donor{(donorList.filter(d => {
                if (d.deactivated || d.doNotContact || !d.email?.trim()) return false
                if (massAppealForm.targetTag && massAppealForm.targetTag !== 'All') {
                  const dk45b = d.email?.trim() || d.name
                  return (donorTagsMap[dk45b] || []).some(t => t.tag === massAppealForm.targetTag)
                }
                return true
              }).length) !== 1 ? 's' : ''} with email on file{massAppealForm.targetTag && massAppealForm.targetTag !== 'All' ? ` tagged "${massAppealForm.targetTag}"` : ''}</div>
              {donorList.filter(d => !d.deactivated && !d.email?.trim()).length > 0 && (
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{donorList.filter(d => !d.deactivated && !d.email?.trim()).length} donors without email excluded — downloadable via QR ZIP</div>
              )}
              {donorList.filter(d => !d.deactivated && d.doNotContact && d.email?.trim()).length > 0 && (
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{donorList.filter(d => !d.deactivated && d.doNotContact && d.email?.trim()).length} donor{donorList.filter(d => !d.deactivated && d.doNotContact && d.email?.trim()).length !== 1 ? 's' : ''} excluded — marked Do Not Contact</div>
              )}
            </div>
            <button style={{ ...s.btnForest, justifyContent: 'center' }} onClick={generateMassAppealRefs}>Next — Preview Donor List →</button>
          </div>
        )}

        {/* Preview step */}
        {massAppealStep === 'preview' && !massAppealProgress && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
              <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} onClick={() => setMassAppealStep('setup')}>← Back to edit</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} onClick={() => setMassAppealRefs(prev => prev.map(r => ({ ...r, selected: true })))}>Select All</button>
                <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} onClick={() => setMassAppealRefs(prev => prev.map(r => ({ ...r, selected: false })))}>Deselect All</button>
              </div>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 16 }}>
              {massAppealRefs.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${C.ivoryDark}`, background: r.selected ? C.white : C.ivoryDark }}>
                  <input type="checkbox" checked={r.selected} onChange={() => setMassAppealRefs(prev => prev.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.forest }}>{r.donor_name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{r.donor_email} · Ref: {r.ref}</div>
                    {r.restrictionNote && <div style={{ fontSize: 11, color: C.warning, marginTop: 2 }}>⚠ Deselected — restriction on file: "{r.restrictionNote}"</div>}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.forest, flexShrink: 0 }}>${r.amount}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => setShowAppealPreview(true)}>👁 Preview Email</button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} disabled={sendingTestAppeal} onClick={sendTestAppealToSelf}>
                {sendingTestAppeal ? 'Sending...' : '✉ Send Test to Myself'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} onClick={() => {
                const n = massAppealRefs.filter(r => r.selected).length
                setConfirmModal({
                  title: `Send this appeal to ${n} donor${n !== 1 ? 's' : ''}?`,
                  description: 'This sends a real email with a payment QR code to each selected donor right now. This cannot be undone once sent.',
                  confirmLabel: `Send to ${n} donor${n !== 1 ? 's' : ''}`,
                  onConfirm: sendMassAppealEmails,
                })
              }}>📧 Send to {massAppealRefs.filter(r => r.selected).length} Donors</button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={downloadMassAppealQRZip}>⬇️ Download QR ZIP</button>
            </div>
          </div>
        )}

        {/* Sending progress */}
        {massAppealProgress && (
          <div style={{ marginTop: 12 }}>
            <div style={{ background: C.ivoryDark, borderRadius: 6, height: 12, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: `${(massAppealProgress.done / massAppealProgress.total) * 100}%`, height: '100%', background: C.sage, borderRadius: 6, transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
              {massAppealProgress.done} of {massAppealProgress.total} · {massAppealProgress.sent} sent · {massAppealProgress.failed} failed{massAppealProgress.blocked > 0 ? ` · ${massAppealProgress.blocked} skipped (Do Not Contact)` : ''}
            </div>
            <button style={{ ...s.viewBtn, color: C.red, borderColor: C.red }} onClick={() => { massAppealCancelRef.current = true }}>✕ Cancel</button>
          </div>
        )}

        {/* Done */}
        {massAppealStep === 'done' && !massAppealProgress && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>✓</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: C.forest, marginBottom: 6 }}>Appeal Sent</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Each donor received a personalised email with their unique PayNow QR code.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnForest, flex: 1, justifyContent: 'center' }} onClick={() => { setMassAppealStep('setup'); setMassAppealForm({ cause_id: '', amount: '', message: defaultMassAppealMessage(), customLabel: '' }); setMassAppealRefs([]) }}>Send Another</button>
              <button style={{ ...s.viewBtn, flex: 1, justifyContent: 'center' }} onClick={() => { setShowMassAppealModal(false); setMassAppealStep('setup') }}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
