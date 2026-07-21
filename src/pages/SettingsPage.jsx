import { supabase } from '../supabase'
import { C } from '../theme'
import { s } from '../styles'
import { fillTemplate } from '../lib/format'

export function SettingsPage({
  isMobile, userRole, session, setConfirmModal, intentionalSignOutRef,
  charityName, charityUen, charityIsIpc,
  charityLogoUrl, uploadingLogo, uploadCharityLogo, removeCharityLogo,
  senderDomainStatus, senderEmailLocalPart, senderDomain, setSenderDomainInput, setShowDomainSetup,
  checkingVerification, checkDomainVerification,
  settingsSection, setSettingsSection,
  localEds, localStaff, localBoardMembers, localVolunteers,
  setVolunteerInput, setNewTeamMemberRole, setShowAddTeamMemberModal, removeTeamMember,
  myCauses, pledges, recurringGifts, grants, enabledModules, toggleEnabledModule,
  editingDonorThresholds, setThankYouThresholdInput, setMajorDonorThresholdInput, setEditingDonorThresholds,
  thankYouThreshold, majorDonorThreshold, thankYouThresholdInput, majorDonorThresholdInput, saveDonorThresholds,
  editingCumulativeThresholds, cumulativeThresholdsInput, setCumulativeThresholdsInput, setEditingCumulativeThresholds,
  cumulativeThresholds, saveCumulativeThresholds, showToast,
  lapsedMinGifts, setLapsedMinGifts, lapsedMinDays, setLapsedMinDays,
  givingChangeMinGifts, setGivingChangeMinGifts, givingChangeMinPct, setGivingChangeMinPct,
  recurringTrendCycles, setRecurringTrendCycles, recurringMissedThreshold, setRecurringMissedThreshold,
  pledgeWatchThreshold, setPledgeWatchThreshold, pledgeDueSoonDays, setPledgeDueSoonDays,
  concentrationTopN, setConcentrationTopN,
  editingFyEnd, setFyEndMonthInput, setFyEndDayInput, setEditingFyEnd, fyEndMonth, fyEndDay, fyEndMonthInput, fyEndDayInput, saveFyEnd,
  editingGoal, setEditingGoal, setGoalInput, annualGoal, goalInput, saveAnnualGoal,
  recurringExpenses, deleteRecurringExpense, newExpenseForm, setNewExpenseForm, saveRecurringExpense,
  setShowMigrationTool, setMigrationPreview, setMigrationErrors, setMigrationComplete, setMigrationProgress,
  EMAIL_TEMPLATE_DEFS, emailTemplates, editingEmailTemplate, setEditingEmailTemplate,
  setEmailTemplateSubjectInput, setEmailTemplateBodyInput, EMAIL_TEMPLATE_DEFAULTS,
  emailTemplateSubjectInput, emailTemplateBodyInput, EMAIL_TEMPLATE_PREVIEW_VARS, saveEmailTemplate,
}) {
  return (
    <div style={s.content}>
      <div style={s.pageHeader}>
        <div style={s.pageTitle}>Settings</div>
      </div>
      {userRole === 'volunteer' ? (
        <div style={s.card}>
          <div style={s.cardTitle}>Account</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Logged in as {session?.user?.email}</div>
          <button style={{ ...s.viewBtn, color: C.red, borderColor: C.red, width: '100%', justifyContent: 'center' }} onClick={() => setConfirmModal({
            title: 'Sign out?',
            description: 'Any unsaved changes on this page will be lost.',
            confirmLabel: 'Sign Out',
            onConfirm: () => { intentionalSignOutRef.current = true; supabase.auth.signOut() },
          })}>🚪 Sign Out</button>
        </div>
      ) : (
        <div style={{ maxWidth: 1000 }}>
        <div style={{ display: 'flex', gap: 6, borderBottom: `1px solid ${C.border}`, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { key: 'general', icon: '🏛️', label: 'General' },
            { key: 'modules', icon: '🧩', label: 'Feature Modules' },
            { key: 'thresholds', icon: '🎯', label: 'Thresholds & Goals' },
            { key: 'financial', icon: '💸', label: 'Financial & Data' },
            { key: 'templates', icon: '✉️', label: 'Email Templates' },
          ].map(sec => (
            <div
              key={sec.key}
              onClick={() => setSettingsSection(sec.key)}
              style={{
                padding: '9px 16px',
                fontSize: 12.5,
                fontWeight: 500,
                color: settingsSection === sec.key ? C.forest : C.muted,
                borderBottom: settingsSection === sec.key ? `2px solid ${C.forest}` : '2px solid transparent',
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

        {settingsSection === 'general' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, alignItems: 'start' }}>
        <div>
        <div style={s.card}>
          <div style={s.cardTitle}>Charity Details</div>
          <div style={{ background: C.ivory, borderRadius: 8, border: `1px solid ${C.border}`, padding: '4px 14px', marginBottom: 12 }}>
            {[
              { label: 'Charity Name', value: charityName },
              { label: 'UEN', value: charityUen },
              { label: 'IPC Status', value: charityIsIpc ? '✓ Registered IPC' : 'Not an IPC' },
              { label: 'Logged in as', value: session?.user?.email },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: i < 3 ? `1px solid ${C.border}` : 'none' }}>
                <span style={{ fontSize: 11.5, color: C.muted }}>{item.label}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.forest, textAlign: 'right' }}>{item.value}</span>
              </div>
            ))}
          </div>
          <button style={{ ...s.viewBtn, color: C.red, borderColor: C.red, width: '100%', justifyContent: 'center' }} onClick={() => setConfirmModal({
            title: 'Sign out?',
            description: 'Any unsaved changes on this page will be lost.',
            confirmLabel: 'Sign Out',
            onConfirm: () => { intentionalSignOutRef.current = true; supabase.auth.signOut() },
          })}>🚪 Sign Out</button>
        </div>

        <div style={{ ...s.card, marginTop: 16 }}>
          <div style={s.cardTitle}>Charity Logo</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
            Shown on donation receipts. PNG or JPG, under 2MB.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <div style={{ width: 72, height: 72, borderRadius: 8, border: `1px solid ${C.border}`, background: C.ivory, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {charityLogoUrl ? <img src={charityLogoUrl} alt="Charity logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 24 }}>🏛️</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ ...s.viewBtn, cursor: uploadingLogo ? 'not-allowed' : 'pointer', opacity: uploadingLogo ? 0.5 : 1, textAlign: 'center' }}>
                {uploadingLogo ? 'Uploading...' : charityLogoUrl ? 'Replace logo' : '⬆ Upload logo'}
                <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadingLogo} onChange={e => { if (e.target.files?.[0]) uploadCharityLogo(e.target.files[0]); e.target.value = '' }} />
              </label>
              {charityLogoUrl && (
                <button style={{ ...s.viewBtn, color: C.red, borderColor: C.red }} onClick={() => setConfirmModal({
                  title: 'Remove logo?',
                  description: 'Receipts will go back to showing your charity name only.',
                  confirmLabel: 'Remove',
                  onConfirm: removeCharityLogo,
                })}>🗑️ Remove</button>
              )}
            </div>
          </div>
        </div>

        <div style={{ ...s.card, marginTop: 16 }}>
          <div style={s.cardTitle}>Email Sending</div>
          {senderDomainStatus === 'verified' ? (
            <div>
              <div style={{ fontSize: 13, color: C.sage, fontWeight: 500, marginBottom: 8 }}>✓ Verified</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
                Your emails send from <strong style={{ color: C.forest }}>{senderEmailLocalPart}@{senderDomain}</strong>
              </div>
              <button style={s.viewBtn} onClick={() => { setSenderDomainInput(senderDomain); setShowDomainSetup(true) }}>Change domain</button>
            </div>
          ) : senderDomainStatus === 'pending' ? (
            <div>
              <div style={{ fontSize: 13, color: C.gold, fontWeight: 500, marginBottom: 8 }}>⏳ Verification pending</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
                We're waiting for DNS records to be added for <strong style={{ color: C.forest }}>{senderDomain}</strong>. Until this is verified, your emails will send from Giving Tree with replies going to your inbox.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={s.issueBtn} disabled={checkingVerification} onClick={checkDomainVerification}>{checkingVerification ? 'Checking...' : '↻ Check status'}</button>
                <button style={s.viewBtn} onClick={() => { setSenderDomainInput(senderDomain); setShowDomainSetup(true) }}>View DNS records</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
                Right now, emails to your donors send from Giving Tree's address, with replies going to your inbox. If you have your own website domain, you can set up emails to send directly from your own address instead.
              </div>
              <button style={s.btnForest} onClick={() => setShowDomainSetup(true)}>Set up my own domain</button>
            </div>
          )}
        </div>

        <div style={{ ...s.card, marginTop: 16 }}>
          <div style={s.cardTitle}>Account</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
            To delete your Giving Tree account and all associated data, email us at <span style={{ color: C.forest, fontWeight: 500 }}>hello@givingtree.sg</span> with the subject line "Account Deletion Request". We will process your request within 7 business days.
          </div>
          <a href={`mailto:hello@givingtree.sg?subject=Account Deletion Request — ${charityName}&body=Please delete the Giving Tree charity account for ${charityName} (UEN: ${charityUen}, email: ${session?.user?.email}).`}
            style={{ ...s.viewBtn, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: C.red, borderColor: C.red }}>
            🗑️ Request Account Deletion
          </a>
        </div>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: C.muted, lineHeight: 2 }}>
          <a href="https://givingtree.sg/privacy" target="_blank" rel="noopener noreferrer" style={{ color: C.muted, textDecoration: 'underline' }}>Privacy Policy</a>
          {' · '}
          <a href="https://givingtree.sg/terms" target="_blank" rel="noopener noreferrer" style={{ color: C.muted, textDecoration: 'underline' }}>Terms of Use</a>
        </div>
        </div>

        <div>
        <div style={{ ...s.card, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ ...s.cardTitle, marginBottom: 0 }}>👥 Team Access</div>
            <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px' }} onClick={() => { setVolunteerInput(''); setNewTeamMemberRole('ed'); setShowAddTeamMemberModal(true) }}>+ Add Person</button>
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
            <strong>Executive Director</strong> sees everything. <strong>Staff</strong> has full operational access. <strong>Board Member</strong> sees dashboard trends only, no individual donor records. <strong>Volunteer</strong> can log manual entries only.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...localEds.map(e => ({ email: e, role: 'ed' })), ...localStaff.map(e => ({ email: e, role: 'staff' })), ...localBoardMembers.map(e => ({ email: e, role: 'board' })), ...localVolunteers.map(e => ({ email: e, role: 'volunteer' }))].length === 0 && (
              <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}>No additional roles assigned yet — everyone else defaults to Staff.</div>
            )}
            {localEds.map(email => (
              <div key={`ed-${email}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, borderRadius: 8, padding: '8px 12px', border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 13, color: C.forest }}>👑 {email} <span style={{ fontSize: 10.5, color: C.muted }}>· Executive Director</span></span>
                <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px', color: C.red, borderColor: C.red }} onClick={() => removeTeamMember('ed', email)}>Remove</button>
              </div>
            ))}
            {localStaff.map(email => (
              <div key={`staff-${email}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, borderRadius: 8, padding: '8px 12px', border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 13, color: C.forest }}>💼 {email} <span style={{ fontSize: 10.5, color: C.muted }}>· Staff</span></span>
                <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px', color: C.red, borderColor: C.red }} onClick={() => removeTeamMember('staff', email)}>Remove</button>
              </div>
            ))}
            {localBoardMembers.map(email => (
              <div key={`board-${email}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, borderRadius: 8, padding: '8px 12px', border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 13, color: C.forest }}>📋 {email} <span style={{ fontSize: 10.5, color: C.muted }}>· Board Member</span></span>
                <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px', color: C.red, borderColor: C.red }} onClick={() => removeTeamMember('board', email)}>Remove</button>
              </div>
            ))}
            {localVolunteers.map(email => (
              <div key={`vol-${email}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, borderRadius: 8, padding: '8px 12px', border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 13, color: C.forest }}>👤 {email} <span style={{ fontSize: 10.5, color: C.muted }}>· Volunteer</span></span>
                <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px', color: C.red, borderColor: C.red }} onClick={() => removeTeamMember('volunteer', email)}>Remove</button>
              </div>
            ))}
          </div>
        </div>
        </div>
        </div>
        )}

        {settingsSection === 'modules' && (
        <div style={{ ...s.card, maxWidth: 600 }}>
          <div style={s.cardTitle}>Feature Modules</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
            Turn off features your charity doesn't use — they'll disappear from the sidebar, Dashboard, and Analytics. You can turn them back on anytime.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { key: 'campaigns', icon: '📣', label: 'Campaigns', desc: 'Trackable fundraising goals and appeals', count: myCauses.filter(c => c.type === 'campaign').length },
              { key: 'pledges', icon: '🤝', label: 'Pledges', desc: 'Promised future gifts and instalments', count: pledges.length },
              { key: 'recurring', icon: '🔁', label: 'Recurring Giving', desc: 'GIRO and habitual PayNow donors', count: recurringGifts.length },
              { key: 'grants', icon: '💰', label: 'Grants', desc: 'Restricted funds, tranches, and compliance reporting', count: grants.length },
            ].map(m => {
              const isOn = enabledModules[m.key] !== false
              const locked = isOn && m.count > 0
              return (
              <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: C.ivory, borderRadius: 4, border: `1px solid ${C.border}`, cursor: locked ? 'default' : 'pointer' }}>
                <input type="checkbox" checked={isOn} disabled={locked} onChange={() => toggleEnabledModule(m.key)} />
                <span style={{ fontSize: 15 }}>{m.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.forest }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{m.desc}</div>
                </div>
                {locked && <span style={{ fontSize: 10.5, color: C.muted, fontStyle: 'italic' }}>{m.count} record{m.count !== 1 ? 's' : ''} — can't hide</span>}
              </label>
              )
            })}
          </div>
        </div>
        )}

        {settingsSection === 'thresholds' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, alignItems: 'start' }}>
        <div>
        <div style={{ ...s.card, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ ...s.cardTitle, marginBottom: 0 }}>Donor Thresholds</div>
            {!editingDonorThresholds && (
              <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px' }} onClick={() => { setThankYouThresholdInput(thankYouThreshold.toString()); setMajorDonorThresholdInput(majorDonorThreshold.toString()); setEditingDonorThresholds(true) }}>Edit</button>
            )}
          </div>
          {editingDonorThresholds ? (
            <div>
              <label style={{ display: 'block', marginBottom: 12 }}>
                <div style={s.formLabel}>Major Gift (SGD) — a single donation this size or more gets a personal thank-you flag</div>
                <input style={s.formInput} type="number" value={thankYouThresholdInput} onChange={e => setThankYouThresholdInput(e.target.value)} />
              </label>
              <label style={{ display: 'block', marginBottom: 12 }}>
                <div style={s.formLabel}>Major Donor (SGD, lifetime total) — flags who needs a relationship visit</div>
                <input style={s.formInput} type="number" value={majorDonorThresholdInput} onChange={e => setMajorDonorThresholdInput(e.target.value)} />
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={s.issueBtn} onClick={saveDonorThresholds}>Save</button>
                <button style={s.viewBtn} onClick={() => setEditingDonorThresholds(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 4, padding: '14px 16px' }}>
                <div style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>Major Gift</div>
                <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1 }}>${thankYouThreshold.toLocaleString()}</div>
              </div>
              <div style={{ flex: 1, background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 4, padding: '14px 16px' }}>
                <div style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>Major Donor (lifetime)</div>
                <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1 }}>${majorDonorThreshold.toLocaleString()}</div>
              </div>
            </div>
          )}
        </div>

        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ ...s.cardTitle, marginBottom: 0 }}>Cumulative Giving Milestones</div>
            {!editingCumulativeThresholds && (
              <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px' }} onClick={() => { setCumulativeThresholdsInput(cumulativeThresholds.map(v => v.toString())); setEditingCumulativeThresholds(true) }}>Edit</button>
            )}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.6 }}>
            Flags a donor on the Dashboard when their lifetime giving crosses one of these amounts this week.
          </div>
          {editingCumulativeThresholds ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
                {cumulativeThresholdsInput.map((v, i) => (
                  <label key={i} style={{ display: 'block' }}>
                    <div style={s.formLabel}>Milestone {i + 1}</div>
                    <input style={s.formInput} type="number" value={v} onChange={e => setCumulativeThresholdsInput(prev => prev.map((p, pi) => pi === i ? e.target.value : p))} />
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={s.issueBtn} onClick={saveCumulativeThresholds}>Save</button>
                <button style={s.viewBtn} onClick={() => setEditingCumulativeThresholds(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              {cumulativeThresholds.map((t, i) => (
                <span key={i} style={{ fontSize: 13, fontWeight: 600, color: C.forest, background: C.ivory, borderRadius: 4, padding: '4px 10px', border: `1px solid ${C.border}` }}>${t.toLocaleString()}</span>
              ))}
            </div>
          )}
        </div>

        {(() => {
          const nStyle = { width: 52, fontSize: 12.5, border: `1px solid ${C.border}`, borderRadius: 4, padding: '3px 6px', color: C.forest, textAlign: 'center' }
          const saveNum = (col, v) => supabase.from('charity_contacts').update({ [col]: v }).eq('charity_uen', charityUen).then(({ error }) => { if (error) showToast('Could not save this setting', 'error') })
          const rowStyle = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12.5, color: C.muted, padding: '10px 0', borderBottom: `1px solid ${C.border}` }
          return (
            <div style={{ ...s.card, marginTop: 16 }}>
              <div style={s.cardTitle}>Dashboard Alert Sensitivity</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4, lineHeight: 1.6 }}>
                Controls when donors get flagged in your Dashboard lists and Analytics. Also editable inline on each Analytics card — both change the same setting.
              </div>
              <div style={rowStyle}>
                <span>Lapsed donor: gave</span>
                <input type="number" min={1} style={nStyle} value={lapsedMinGifts} onChange={e => { const v = Math.max(1, Number(e.target.value) || 1); setLapsedMinGifts(v); saveNum('lapsed_min_gifts', v) }} />
                <span>+ times, no gift in</span>
                <input type="number" min={1} style={nStyle} value={lapsedMinDays} onChange={e => { const v = Math.max(1, Number(e.target.value) || 1); setLapsedMinDays(v); saveNum('lapsed_min_days', v) }} />
                <span>+ days</span>
              </div>
              <div style={rowStyle}>
                <span>Notable giving change: over</span>
                <input type="number" min={2} style={nStyle} value={givingChangeMinGifts} onChange={e => { const v = Math.max(2, Number(e.target.value) || 2); setGivingChangeMinGifts(v); saveNum('giving_change_min_gifts', v) }} />
                <span>gifts, change of</span>
                <input type="number" min={1} style={nStyle} value={givingChangeMinPct} onChange={e => { const v = Math.max(1, Number(e.target.value) || 1); setGivingChangeMinPct(v); saveNum('giving_change_min_pct', v) }} />
                <span>% or more</span>
              </div>
              <div style={rowStyle}>
                <span>Recurring giving trend: same direction for</span>
                <input type="number" min={2} style={nStyle} value={recurringTrendCycles} onChange={e => { const v = Math.max(2, Number(e.target.value) || 2); setRecurringTrendCycles(v); saveNum('recurring_trend_cycles', v) }} />
                <span>cycles in a row</span>
              </div>
              <div style={rowStyle}>
                <span>At-risk recurring gift: missed</span>
                <input type="number" min={1} style={nStyle} value={recurringMissedThreshold} onChange={e => { const v = Math.max(1, Number(e.target.value) || 1); setRecurringMissedThreshold(v); saveNum('recurring_missed_threshold', v) }} />
                <span>+ cycles</span>
              </div>
              <div style={rowStyle}>
                <span>Pledge watch: donor has broken</span>
                <input type="number" min={1} style={nStyle} value={pledgeWatchThreshold} onChange={e => { const v = Math.max(1, Number(e.target.value) || 1); setPledgeWatchThreshold(v); saveNum('pledge_watch_threshold', v) }} />
                <span>+ pledges</span>
              </div>
              <div style={rowStyle}>
                <span>Flag a pledge as due soon when it's within</span>
                <input type="number" min={1} style={nStyle} value={pledgeDueSoonDays} onChange={e => { const v = Math.max(1, Number(e.target.value) || 1); setPledgeDueSoonDays(v); saveNum('pledge_due_soon_days', v) }} />
                <span>days</span>
              </div>
              <div style={{ ...rowStyle, borderBottom: 'none' }}>
                <span>Donor concentration: track top</span>
                <input type="number" min={1} style={nStyle} value={concentrationTopN} onChange={e => { const v = Math.max(1, Number(e.target.value) || 1); setConcentrationTopN(v); saveNum('concentration_top_n', v) }} />
                <span>donors</span>
              </div>
            </div>
          )
        })()}
        </div>

        <div>
        <div style={{ ...s.card, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ ...s.cardTitle, marginBottom: 0 }}>Financial Year End</div>
            {!editingFyEnd && (
              <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px' }} onClick={() => { setFyEndMonthInput(fyEndMonth.toString()); setFyEndDayInput(fyEndDay.toString()); setEditingFyEnd(true) }}>Edit</button>
            )}
          </div>
          {editingFyEnd ? (
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>Used to calculate your COC Annual Submission deadline (6 months after financial year end).</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <select style={s.formInput} aria-label="Fiscal year end month" value={fyEndMonthInput} onChange={e => setFyEndMonthInput(e.target.value)}>
                  {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
                <input style={{ ...s.formInput, width: 90 }} type="number" min="1" max="31" placeholder="Day" aria-label="Fiscal year end day" value={fyEndDayInput} onChange={e => setFyEndDayInput(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={s.issueBtn} onClick={saveFyEnd}>Save</button>
                <button style={s.viewBtn} onClick={() => setEditingFyEnd(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 4, padding: '14px 16px' }}>
              <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1 }}>
                {['January','February','March','April','May','June','July','August','September','October','November','December'][fyEndMonth - 1]} {fyEndDay}
              </div>
            </div>
          )}
        </div>

        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ ...s.cardTitle, marginBottom: 0 }}>🎯 Annual Fundraising Goal</div>
            {!editingGoal && (
              <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px' }} onClick={() => { setGoalInput(annualGoal?.toString() || ''); setEditingGoal(true) }}>{annualGoal ? 'Edit' : '+ Set Goal'}</button>
            )}
          </div>
          {editingGoal ? (
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>Total confirmed donations this calendar year are tracked against this goal on your Dashboard and Analytics pages.</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input style={s.formInput} type="number" placeholder="e.g. 50000" aria-label="Annual fundraising goal" value={goalInput} onChange={e => setGoalInput(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={s.issueBtn} onClick={saveAnnualGoal}>Save</button>
                <button style={s.viewBtn} onClick={() => setEditingGoal(false)}>Cancel</button>
              </div>
            </div>
          ) : annualGoal ? (
            <div style={{ background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 4, padding: '14px 16px' }}>
              <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1 }}>${annualGoal.toLocaleString()}</div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No goal set yet — used for the progress tracker on Dashboard and Analytics.</div>
          )}
        </div>
        </div>
        </div>
        )}

        {settingsSection === 'financial' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, alignItems: 'start' }}>
        <div id="monthly-expenses-card" style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={s.cardTitle}>💸 Monthly Expenses</div>
          </div>
          <div style={{ background: recurringExpenses.length > 0 ? C.ivory : 'transparent', border: recurringExpenses.length > 0 ? `1px solid ${C.border}` : 'none', borderRadius: 4, padding: recurringExpenses.length > 0 ? '14px 16px' : 0 }}>
            {recurringExpenses.length > 0 ? (
              <div style={{ fontFamily: C.fontVoice, fontSize: 26, fontWeight: 500, color: C.forest, lineHeight: 1 }}>SGD ${recurringExpenses.reduce((s, e) => s + Number(e.amount), 0).toLocaleString()}<span style={{ fontFamily: 'inherit', fontSize: 14, color: C.muted }}>/month</span></div>
            ) : (
              <span style={{ fontSize: 13, fontWeight: 400, color: C.muted, fontStyle: 'italic' }}>Add items below to calculate this — used for coverage ratio on dashboard</span>
            )}
          </div>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${C.border}` }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Itemised expenses — add rent, salaries, utilities, etc.</div>
            {recurringExpenses.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {recurringExpenses.map(e => (
                  <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, borderRadius: 4, padding: '6px 10px' }}>
                    <span style={{ fontSize: 12.5, color: C.text }}>{e.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: C.forest }}>${Number(e.amount).toLocaleString()}</span>
                      <span style={{ color: C.muted, cursor: 'pointer' }} onClick={() => setConfirmModal({
                        title: 'Delete this expense?',
                        description: `"${e.name}" — $${Number(e.amount).toLocaleString()}/month will be permanently removed.`,
                        confirmLabel: 'Delete',
                        onConfirm: () => deleteRecurringExpense(e.id),
                      })}>✕</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <input style={{ ...s.formInput, fontSize: 12, flex: 2 }} placeholder="e.g. Rent, Salaries, Utilities" aria-label="Expense name" value={newExpenseForm.name} onChange={e => setNewExpenseForm(f => ({ ...f, name: e.target.value }))} />
              <input style={{ ...s.formInput, fontSize: 12, flex: 1 }} type="number" placeholder="Amount" aria-label="Expense amount" value={newExpenseForm.amount} onChange={e => setNewExpenseForm(f => ({ ...f, amount: e.target.value }))} />
              <button style={{ ...s.viewBtn, fontSize: 11, padding: '5px 10px' }} onClick={saveRecurringExpense}>Add</button>
            </div>
          </div>
        </div>

        <div style={s.card}>
          <div style={s.cardTitle}>📥 Import Historical Data</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
            Import existing donor records and transactions from a Google Sheets or Excel CSV export. Use this once during onboarding to migrate your historical data.
          </div>
          <button style={s.btnForest} onClick={() => { setShowMigrationTool(true); setMigrationPreview(null); setMigrationErrors([]); setMigrationComplete(null); setMigrationProgress(null) }}>📥 Open Migration Tool</button>
        </div>
        </div>
        )}

        {settingsSection === 'templates' && (
        <div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6, maxWidth: 640 }}>
            Customize the subject and wording of your automated donor emails. Use tokens like <code>{'{{donor_name}}'}</code> — they're swapped for real values when each email sends. Leave a template untouched to keep our default wording.
          </div>
          {EMAIL_TEMPLATE_DEFS.map(group => (
            <div key={group.group} style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: C.muted, marginBottom: 8 }}>{group.group}</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
              {group.items.map(t => {
                const saved = emailTemplates[t.key]
                const isEditing = editingEmailTemplate === t.key
                return (
                  <div key={t.key} style={{ ...s.card, gridColumn: isEditing ? '1 / -1' : 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.forest }}>
                          {t.label}
                          {saved && <span style={{ fontSize: 10, fontWeight: 600, color: C.sage, marginLeft: 8 }}>● Customized</span>}
                        </div>
                        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3, lineHeight: 1.4 }}>{t.description}</div>
                      </div>
                      {!isEditing && (
                        <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px', flexShrink: 0 }} onClick={() => {
                          setEditingEmailTemplate(t.key)
                          setEmailTemplateSubjectInput(saved?.subject ?? EMAIL_TEMPLATE_DEFAULTS[t.key]?.subject ?? '')
                          setEmailTemplateBodyInput(saved?.body ?? EMAIL_TEMPLATE_DEFAULTS[t.key]?.body ?? '')
                        }}>{saved ? 'Edit' : 'Customize'}</button>
                      )}
                    </div>
                    {isEditing && (
                      <div style={{ marginTop: 14 }}>
                        <label style={{ display: 'block', marginBottom: 10 }}>
                          <div style={s.formLabel}>Subject</div>
                          <input style={s.formInput} value={emailTemplateSubjectInput} onChange={e => setEmailTemplateSubjectInput(e.target.value)} />
                        </label>
                        <label style={{ display: 'block', marginBottom: 8 }}>
                          <div style={s.formLabel}>Body</div>
                          <textarea style={{ ...s.formInput, minHeight: 180, resize: 'vertical', fontFamily: 'inherit' }} value={emailTemplateBodyInput} onChange={e => setEmailTemplateBodyInput(e.target.value)} />
                        </label>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>
                          Available tokens: {t.tokens.map(tok => <code key={tok} style={{ marginRight: 6 }}>{`{{${tok}}}`}</code>)}
                        </div>
                        {(emailTemplateSubjectInput.trim() || emailTemplateBodyInput.trim()) && (
                          <div style={{ background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, marginBottom: 12 }}>
                            <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: C.muted, marginBottom: 8 }}>Preview with sample data</div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: C.forest, marginBottom: 8 }}>{fillTemplate(emailTemplateSubjectInput, EMAIL_TEMPLATE_PREVIEW_VARS)}</div>
                            <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{fillTemplate(emailTemplateBodyInput, EMAIL_TEMPLATE_PREVIEW_VARS)}</div>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button style={s.issueBtn} onClick={() => {
                            const trimmedSubject = emailTemplateSubjectInput.trim()
                            const trimmedBody = emailTemplateBodyInput.trim()
                            const def = EMAIL_TEMPLATE_DEFAULTS[t.key]
                            const matchesDefault = trimmedSubject === (def?.subject || '') && trimmedBody === (def?.body || '')
                            saveEmailTemplate(t.key, matchesDefault ? null : { subject: trimmedSubject, body: trimmedBody })
                            setEditingEmailTemplate(null)
                          }}>Save</button>
                          <button style={s.viewBtn} onClick={() => setEditingEmailTemplate(null)}>Cancel</button>
                          {saved && (
                            <button style={{ ...s.viewBtn, color: C.red, borderColor: C.red }} onClick={() => { saveEmailTemplate(t.key, null); setEditingEmailTemplate(null) }}>Reset to default</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              </div>
            </div>
          ))}
        </div>
        )}

        </div>
      )}
    </div>
  )
}
