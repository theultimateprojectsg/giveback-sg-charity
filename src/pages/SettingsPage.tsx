import { useRef, useState } from 'react'
import type { Dispatch, SetStateAction, MutableRefObject, CSSProperties } from 'react'
import { supabase } from '../supabase'
import { C } from '../theme'
import { s } from '../styles'
import { fillTemplate } from '../lib/format'
import type { Grant, Pledge, RecurringGift } from '../types'

interface EmailTemplateDef { key: string, label: string, description: string, tokens: string[] }
interface EmailTemplateGroup { group: string, items: EmailTemplateDef[] }

interface SettingsPageProps {
  isMobile?: boolean
  userRole: string
  session: { user?: { email?: string } } | null
  setConfirmModal: (modal: unknown) => void
  intentionalSignOutRef: MutableRefObject<boolean>
  charityName: string
  charityUen: string
  charityIsIpc: boolean
  charityLogoUrl: string | null
  uploadingLogo: boolean
  uploadCharityLogo: (file: File) => void
  removeCharityLogo: () => void
  senderDomainStatus: string | null
  senderEmailLocalPart: string | null
  senderDomain: string | null
  setSenderDomainInput: Dispatch<SetStateAction<string>>
  setShowDomainSetup: Dispatch<SetStateAction<boolean>>
  checkingVerification: boolean
  checkDomainVerification: () => void
  settingsSection: string
  setSettingsSection: Dispatch<SetStateAction<string>>
  localEds: string[]
  localStaff: string[]
  localBoardMembers: string[]
  localVolunteers: string[]
  setVolunteerInput: Dispatch<SetStateAction<string>>
  setNewTeamMemberRole: Dispatch<SetStateAction<string>>
  setShowAddTeamMemberModal: Dispatch<SetStateAction<boolean>>
  removeTeamMember: (role: string, email: string) => void
  myCauses: { id: string, type: string }[]
  pledges: Pledge[]
  recurringGifts: RecurringGift[]
  grants: Grant[]
  massAppeals: any[]
  inKindDonations: any[]
  enabledModules: Record<string, boolean>
  toggleEnabledModule: (key: string) => void
  editingDonorThresholds: boolean
  setThankYouThresholdInput: Dispatch<SetStateAction<string>>
  setMajorDonorThresholdInput: Dispatch<SetStateAction<string>>
  setEditingDonorThresholds: Dispatch<SetStateAction<boolean>>
  thankYouThreshold: number
  majorDonorThreshold: number
  thankYouThresholdInput: string
  majorDonorThresholdInput: string
  saveDonorThresholds: () => void
  editingCumulativeThresholds: boolean
  cumulativeThresholdsInput: string[]
  setCumulativeThresholdsInput: Dispatch<SetStateAction<string[]>>
  setEditingCumulativeThresholds: Dispatch<SetStateAction<boolean>>
  cumulativeThresholds: number[]
  saveCumulativeThresholds: () => void
  showToast: (msg: string, type?: string) => void
  lapsedMinGifts: number
  lapsedMinDays: number
  givingChangeMinGifts: number
  givingChangeMinPct: number
  recurringTrendCycles: number
  recurringMissedThreshold: number
  pledgeWatchThreshold: number
  pledgeDueSoonDays: number
  concentrationTopN: number
  editingAlertSensitivity: boolean
  setEditingAlertSensitivity: Dispatch<SetStateAction<boolean>>
  alertSensitivityInputs: Record<string, string>
  setAlertSensitivityInputs: Dispatch<SetStateAction<Record<string, string>>>
  saveAlertSensitivity: () => void
  editingFyEnd: boolean
  setFyEndMonthInput: Dispatch<SetStateAction<string>>
  setFyEndDayInput: Dispatch<SetStateAction<string>>
  setEditingFyEnd: Dispatch<SetStateAction<boolean>>
  fyEndMonth: number
  fyEndDay: number
  fyEndMonthInput: string
  fyEndDayInput: string
  saveFyEnd: () => void
  editingGoal: boolean
  setEditingGoal: Dispatch<SetStateAction<boolean>>
  setGoalInput: Dispatch<SetStateAction<string>>
  annualGoal: number | null
  goalInput: string
  saveAnnualGoal: () => void
  recurringExpenses: { id: string, name: string, amount: number | string }[]
  deleteRecurringExpense: (id: string) => void
  newExpenseForm: { name: string, amount: string }
  setNewExpenseForm: Dispatch<SetStateAction<{ name: string, amount: string }>>
  saveRecurringExpense: () => void
  setShowMigrationTool: Dispatch<SetStateAction<boolean>>
  setMigrationPreview: Dispatch<SetStateAction<unknown>>
  setMigrationErrors: Dispatch<SetStateAction<unknown[]>>
  setMigrationComplete: Dispatch<SetStateAction<unknown>>
  setMigrationProgress: Dispatch<SetStateAction<unknown>>
  EMAIL_TEMPLATE_DEFS: EmailTemplateGroup[]
  emailTemplates: Record<string, { subject?: string, body?: string, banner_title?: string, banner_subtitle?: string } | undefined>
  editingEmailTemplate: string | null
  setEditingEmailTemplate: Dispatch<SetStateAction<string | null>>
  setEmailTemplateSubjectInput: Dispatch<SetStateAction<string>>
  setEmailTemplateBodyInput: Dispatch<SetStateAction<string>>
  EMAIL_TEMPLATE_DEFAULTS: Record<string, { subject?: string, body?: string, banner_title?: string, banner_subtitle?: string } | undefined>
  emailTemplateSubjectInput: string
  emailTemplateBodyInput: string
  EMAIL_TEMPLATE_PREVIEW_VARS: Record<string, unknown>
  saveEmailTemplate: (key: string, value: { subject: string, body: string, banner_title?: string, banner_subtitle?: string } | null) => void
  emailTemplateBannerTitleInput: string
  setEmailTemplateBannerTitleInput: Dispatch<SetStateAction<string>>
  emailTemplateBannerSubtitleInput: string
  setEmailTemplateBannerSubtitleInput: Dispatch<SetStateAction<string>>
}

export function SettingsPage({
  isMobile, userRole, session, setConfirmModal, intentionalSignOutRef,
  charityName, charityUen, charityIsIpc,
  charityLogoUrl, uploadingLogo, uploadCharityLogo, removeCharityLogo,
  senderDomainStatus, senderEmailLocalPart, senderDomain, setSenderDomainInput, setShowDomainSetup,
  checkingVerification, checkDomainVerification,
  settingsSection, setSettingsSection,
  localEds, localStaff, localBoardMembers, localVolunteers,
  setVolunteerInput, setNewTeamMemberRole, setShowAddTeamMemberModal, removeTeamMember,
  myCauses, pledges, recurringGifts, grants, massAppeals, inKindDonations, enabledModules, toggleEnabledModule,
  editingDonorThresholds, setThankYouThresholdInput, setMajorDonorThresholdInput, setEditingDonorThresholds,
  thankYouThreshold, majorDonorThreshold, thankYouThresholdInput, majorDonorThresholdInput, saveDonorThresholds,
  editingCumulativeThresholds, cumulativeThresholdsInput, setCumulativeThresholdsInput, setEditingCumulativeThresholds,
  cumulativeThresholds, saveCumulativeThresholds, showToast,
  lapsedMinGifts, lapsedMinDays,
  givingChangeMinGifts, givingChangeMinPct,
  recurringTrendCycles, recurringMissedThreshold,
  pledgeWatchThreshold, pledgeDueSoonDays,
  concentrationTopN,
  editingAlertSensitivity, setEditingAlertSensitivity, alertSensitivityInputs, setAlertSensitivityInputs, saveAlertSensitivity,
  editingFyEnd, setFyEndMonthInput, setFyEndDayInput, setEditingFyEnd, fyEndMonth, fyEndDay, fyEndMonthInput, fyEndDayInput, saveFyEnd,
  editingGoal, setEditingGoal, setGoalInput, annualGoal, goalInput, saveAnnualGoal,
  recurringExpenses, deleteRecurringExpense, newExpenseForm, setNewExpenseForm, saveRecurringExpense,
  setShowMigrationTool, setMigrationPreview, setMigrationErrors, setMigrationComplete, setMigrationProgress,
  EMAIL_TEMPLATE_DEFS, emailTemplates, editingEmailTemplate, setEditingEmailTemplate,
  setEmailTemplateSubjectInput, setEmailTemplateBodyInput, EMAIL_TEMPLATE_DEFAULTS,
  emailTemplateSubjectInput, emailTemplateBodyInput, EMAIL_TEMPLATE_PREVIEW_VARS, saveEmailTemplate,
  emailTemplateBannerTitleInput, setEmailTemplateBannerTitleInput, emailTemplateBannerSubtitleInput, setEmailTemplateBannerSubtitleInput,
}: SettingsPageProps) {
  // Lets the token chips insert `{{token}}` at the cursor of whichever template field was last
  // focused, rather than making non-technical charity staff type the double-brace syntax by hand.
  const [activeTokenField, setActiveTokenField] = useState<'banner_title' | 'banner_subtitle' | 'subject' | 'body'>('body')
  const bannerTitleFieldRef = useRef<HTMLInputElement>(null)
  const bannerSubtitleFieldRef = useRef<HTMLInputElement>(null)
  const subjectFieldRef = useRef<HTMLInputElement>(null)
  const bodyFieldRef = useRef<HTMLTextAreaElement>(null)
  const tokenFieldRefs = { banner_title: bannerTitleFieldRef, banner_subtitle: bannerSubtitleFieldRef, subject: subjectFieldRef, body: bodyFieldRef }
  const tokenFieldValues = { banner_title: emailTemplateBannerTitleInput, banner_subtitle: emailTemplateBannerSubtitleInput, subject: emailTemplateSubjectInput, body: emailTemplateBodyInput }
  const tokenFieldSetters = { banner_title: setEmailTemplateBannerTitleInput, banner_subtitle: setEmailTemplateBannerSubtitleInput, subject: setEmailTemplateSubjectInput, body: setEmailTemplateBodyInput }
  // The generic preview vars use a placeholder charity name -- swap in the real one so the
  // preview shows exactly what a donor would actually see, not a stand-in.
  const templatePreviewVars = { ...EMAIL_TEMPLATE_PREVIEW_VARS, charity_name: charityName || EMAIL_TEMPLATE_PREVIEW_VARS.charity_name }
  function insertTemplateToken(tok: string) {
    const token = `{{${tok}}}`
    const el = tokenFieldRefs[activeTokenField].current
    const value = tokenFieldValues[activeTokenField] || ''
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const next = value.slice(0, start) + token + value.slice(end)
    tokenFieldSetters[activeTokenField](next)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      el.selectionStart = el.selectionEnd = start + token.length
    })
  }
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
              { key: 'campaigns', icon: '📣', label: 'Campaigns', desc: 'Trackable fundraising goals, plus mass email appeals', count: myCauses.filter(c => c.type === 'campaign').length + massAppeals.length },
              { key: 'pledges', icon: '🤝', label: 'Pledges', desc: 'Promised future gifts and instalments', count: pledges.length },
              { key: 'recurring', icon: '🔁', label: 'Recurring Giving', desc: 'GIRO and habitual PayNow donors', count: recurringGifts.length },
              { key: 'grants', icon: '💰', label: 'Grants', desc: 'Restricted funds, tranches, and compliance reporting', count: grants.length },
              { key: 'inKind', icon: '🎁', label: 'In-Kind Gifts', desc: 'Donated goods, services, or venue space instead of cash', count: inKindDonations.length },
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
          const fields: { key: string, before: string, value: number, after: string }[] = [
            { key: 'lapsed_min_gifts', before: 'Lapsed donor: gave', value: lapsedMinGifts, after: '+ times, no gift in' },
            { key: 'lapsed_min_days', before: '', value: lapsedMinDays, after: '+ days' },
            { key: 'giving_change_min_gifts', before: 'Notable giving change: over', value: givingChangeMinGifts, after: 'gifts, change of' },
            { key: 'giving_change_min_pct', before: '', value: givingChangeMinPct, after: '% or more' },
            { key: 'recurring_trend_cycles', before: 'Recurring giving trend: same direction for', value: recurringTrendCycles, after: 'cycles in a row' },
            { key: 'recurring_missed_threshold', before: 'At-risk recurring gift: missed', value: recurringMissedThreshold, after: '+ cycles' },
            { key: 'pledge_watch_threshold', before: 'Pledge watch: donor has broken', value: pledgeWatchThreshold, after: '+ pledges' },
            { key: 'pledge_due_soon_days', before: "Flag a pledge as due soon when it's within", value: pledgeDueSoonDays, after: 'days' },
            { key: 'concentration_top_n', before: 'Donor concentration: track top', value: concentrationTopN, after: 'donors' },
          ]
          const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12.5, color: C.muted, padding: '10px 0', borderBottom: `1px solid ${C.border}` }
          const nStyle: CSSProperties = { width: 52, fontSize: 12.5, border: `1px solid ${C.border}`, borderRadius: 4, padding: '3px 6px', color: C.forest, textAlign: 'center' }
          const valueChipStyle: CSSProperties = { fontWeight: 700, color: C.forest, background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 4, padding: '3px 8px' }
          return (
            <div id="dashboard-alert-sensitivity-card" style={{ ...s.card, marginTop: 16, scrollMarginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ ...s.cardTitle, marginBottom: 0 }}>Dashboard Alert Sensitivity</div>
                {!editingAlertSensitivity && (
                  <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px' }} onClick={() => {
                    setAlertSensitivityInputs(Object.fromEntries(fields.map(f => [f.key, f.value.toString()])))
                    setEditingAlertSensitivity(true)
                  }}>Edit</button>
                )}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4, lineHeight: 1.6 }}>
                Controls when donors get flagged in your Dashboard lists and Analytics. Also editable inline on each Analytics card — both change the same setting.
              </div>
              {fields.map((f, i) => (
                <div key={f.key} style={i === fields.length - 1 ? { ...rowStyle, borderBottom: 'none' } : rowStyle}>
                  {f.before && <span>{f.before}</span>}
                  {editingAlertSensitivity ? (
                    <input
                      type="number"
                      style={nStyle}
                      value={alertSensitivityInputs[f.key] ?? ''}
                      onChange={e => setAlertSensitivityInputs(prev => ({ ...prev, [f.key]: e.target.value }))}
                    />
                  ) : (
                    <span style={valueChipStyle}>{f.value}</span>
                  )}
                  <span>{f.after}</span>
                </div>
              ))}
              {editingAlertSensitivity && (
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button style={s.issueBtn} onClick={saveAlertSensitivity}>Save</button>
                  <button style={s.viewBtn} onClick={() => setEditingAlertSensitivity(false)}>Cancel</button>
                </div>
              )}
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
                return (
                  <div key={t.key} style={s.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.forest }}>
                          {t.label}
                          {saved && <span style={{ fontSize: 10, fontWeight: 600, color: C.sage, marginLeft: 8 }}>● Customized</span>}
                        </div>
                        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3, lineHeight: 1.4 }}>{t.description}</div>
                      </div>
                      <button style={{ ...s.viewBtn, fontSize: 11, padding: '4px 10px', flexShrink: 0 }} onClick={() => {
                        setEditingEmailTemplate(t.key)
                        setEmailTemplateSubjectInput(saved?.subject ?? EMAIL_TEMPLATE_DEFAULTS[t.key]?.subject ?? '')
                        setEmailTemplateBodyInput(saved?.body ?? EMAIL_TEMPLATE_DEFAULTS[t.key]?.body ?? '')
                        setEmailTemplateBannerTitleInput(saved?.banner_title ?? EMAIL_TEMPLATE_DEFAULTS[t.key]?.banner_title ?? '')
                        setEmailTemplateBannerSubtitleInput(saved?.banner_subtitle ?? EMAIL_TEMPLATE_DEFAULTS[t.key]?.banner_subtitle ?? '')
                      }}>{saved ? 'Edit' : 'Customize'}</button>
                    </div>
                  </div>
                )
              })}
              </div>
            </div>
          ))}
        </div>
        )}

        {editingEmailTemplate && (() => {
          const t = EMAIL_TEMPLATE_DEFS.flatMap(g => g.items).find(i => i.key === editingEmailTemplate)
          if (!t) return null
          const saved = emailTemplates[t.key]
          const hasBanner = EMAIL_TEMPLATE_DEFAULTS[t.key]?.banner_title !== undefined
          return (
            <div data-modal-overlay="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setEditingEmailTemplate(null)}>
              <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: isMobile ? 640 : 980, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 4 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: C.forest }}>{t.label}</div>
                    <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3, lineHeight: 1.4 }}>{t.description}</div>
                  </div>
                  <button aria-label="Close" style={{ background: C.ivoryDark, border: 'none', color: C.forest, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={() => setEditingEmailTemplate(null)}>✕</button>
                </div>
                {t.tokens.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 14, marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: C.muted, marginRight: 2 }}>Insert into the field you clicked into:</span>
                    {t.tokens.map(tok => (
                      <button key={tok} type="button" style={{ fontSize: 11, color: C.forest, background: C.ivoryDark, border: `1px solid ${C.border}`, borderRadius: 20, padding: '3px 10px', cursor: 'pointer' }} onClick={() => insertTemplateToken(tok)}>
                        {tok.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 20, flexDirection: isMobile ? 'column' : 'row', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
                    {hasBanner && (
                      <>
                        <label style={{ display: 'block', marginBottom: 10 }}>
                          <div style={s.formLabel}>Banner Headline</div>
                          <input ref={bannerTitleFieldRef} style={s.formInput} value={emailTemplateBannerTitleInput} onFocus={() => setActiveTokenField('banner_title')} onChange={e => setEmailTemplateBannerTitleInput(e.target.value)} />
                        </label>
                        <label style={{ display: 'block', marginBottom: 10 }}>
                          <div style={s.formLabel}>Banner Subtitle (optional)</div>
                          <input ref={bannerSubtitleFieldRef} style={s.formInput} value={emailTemplateBannerSubtitleInput} onFocus={() => setActiveTokenField('banner_subtitle')} onChange={e => setEmailTemplateBannerSubtitleInput(e.target.value)} />
                        </label>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>Shown in the bold header of the email, above your message below.</div>
                      </>
                    )}
                    <label style={{ display: 'block', marginBottom: 10 }}>
                      <div style={s.formLabel}>Subject</div>
                      <input ref={subjectFieldRef} style={s.formInput} value={emailTemplateSubjectInput} onFocus={() => setActiveTokenField('subject')} onChange={e => setEmailTemplateSubjectInput(e.target.value)} />
                    </label>
                    <label style={{ display: 'block', marginBottom: 12 }}>
                      <div style={s.formLabel}>Body</div>
                      <textarea ref={bodyFieldRef} style={{ ...s.formInput, minHeight: 180, resize: 'vertical', fontFamily: 'inherit' }} value={emailTemplateBodyInput} onFocus={() => setActiveTokenField('body')} onChange={e => setEmailTemplateBodyInput(e.target.value)} />
                    </label>
                  </div>
                  {(emailTemplateSubjectInput.trim() || emailTemplateBodyInput.trim() || emailTemplateBannerTitleInput.trim()) && (
                    <div style={{ flex: 1, minWidth: 0, width: '100%', background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, position: isMobile ? 'static' : 'sticky', top: 0 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: C.muted, marginBottom: 8 }}>Preview with sample data</div>
                      {emailTemplateSubjectInput.trim() && (
                        <div style={{ display: 'flex', gap: 6, fontSize: 11.5, color: C.muted, paddingBottom: 8, marginBottom: 10, borderBottom: `1px solid ${C.border}` }}>
                          <span style={{ fontWeight: 600, flexShrink: 0 }}>Subject:</span>
                          <span>{fillTemplate(emailTemplateSubjectInput, templatePreviewVars)}</span>
                        </div>
                      )}
                      {hasBanner && emailTemplateBannerTitleInput.trim() && (
                        <div style={{ background: C.forest, borderRadius: 6, padding: '10px 12px', marginBottom: 8, textAlign: 'center' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{fillTemplate(emailTemplateBannerTitleInput, templatePreviewVars)}</div>
                          {emailTemplateBannerSubtitleInput.trim() && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 3 }}>{fillTemplate(emailTemplateBannerSubtitleInput, templatePreviewVars)}</div>}
                        </div>
                      )}
                      <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{fillTemplate(emailTemplateBodyInput, templatePreviewVars)}</div>
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button style={s.issueBtn} onClick={() => {
                      const trimmedSubject = emailTemplateSubjectInput.trim()
                      const trimmedBody = emailTemplateBodyInput.trim()
                      const trimmedBannerTitle = emailTemplateBannerTitleInput.trim()
                      const trimmedBannerSubtitle = emailTemplateBannerSubtitleInput.trim()
                      const def = EMAIL_TEMPLATE_DEFAULTS[t.key]
                      const matchesDefault = trimmedSubject === (def?.subject || '') && trimmedBody === (def?.body || '')
                        && trimmedBannerTitle === (def?.banner_title || '') && trimmedBannerSubtitle === (def?.banner_subtitle || '')
                      saveEmailTemplate(t.key, matchesDefault ? null : { subject: trimmedSubject, body: trimmedBody, ...(hasBanner ? { banner_title: trimmedBannerTitle, banner_subtitle: trimmedBannerSubtitle } : {}) })
                      setEditingEmailTemplate(null)
                    }}>Save</button>
                    <button style={s.viewBtn} onClick={() => setEditingEmailTemplate(null)}>Cancel</button>
                    {saved && (
                      <button style={{ ...s.viewBtn, color: C.red, borderColor: C.red }} onClick={() => { saveEmailTemplate(t.key, null); setEditingEmailTemplate(null) }}>Reset to default</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        </div>
      )}
    </div>
  )
}
