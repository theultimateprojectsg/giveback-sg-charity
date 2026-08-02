import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import logo from '../assets/logo.png'
import { C } from '../theme'

// Dark palette shared with CharityAuth.tsx so the pitch page and the sign-in
// screen a charity lands on right after clicking "Request a demo" feel like
// the same product, not two different sites bolted together.
const P = {
  bg: '#0A1A0F',
  panel: 'rgba(255,255,255,0.03)',
  panelBorder: 'rgba(116,198,157,0.14)',
  gold: '#D4A017',
  green: '#52B788',
  greenBright: '#40916C',
  text: 'rgba(255,255,255,0.92)',
  textMuted: 'rgba(224,238,230,0.62)',
  errorText: '#FF7B6B',
}

const FEATURES = [
  { icon: '💳', title: 'Donations & receipts', desc: 'Log manual or online gifts, issue tax receipts in one click, and keep every donation reconciled by fiscal year.' },
  { icon: '🧑‍🤝‍🧑', title: 'Donor CRM', desc: 'A full history per donor — giving pattern, notes, tags, households, and who to thank next.' },
  { icon: '🔁', title: 'Recurring gifts & pledges', desc: 'Track GIRO/recurring commitments and multi-year pledges, with reminders when one lapses.' },
  { icon: '💰', title: 'Grants tracking', desc: 'Funder reports, tranches, and matching claims in one place instead of a spreadsheet per grant.' },
  { icon: '🎁', title: 'In-kind gifts', desc: 'Log goods and services donations with their own acknowledgement receipts, separate from cash totals.' },
  { icon: '📊', title: 'Analytics dashboard', desc: 'Fundraising performance, donor retention, and campaign health — built for a small team, not a data analyst.' },
  { icon: '🏛️', title: 'IRAS-ready export', desc: 'NRIC handling and tax-deduction rules built in, so year-end submission is an export, not a scramble.' },
  { icon: '🗒️', title: 'Audit log', desc: 'Every change your team makes is recorded automatically — who did what, and when.' },
]

const PRICING = [
  { name: 'Pilot', price: 'Free', period: 'for your first season', blurb: 'Full access while we set your charity up together and shape the product around how you actually work.', cta: 'Start a pilot' },
  { name: 'Standard', price: 'Indicative', period: 'per charity, per month', blurb: 'Priced to fit a small charity\'s budget — final number set together once your pilot wraps up.', cta: 'Ask about pricing', highlight: true },
  { name: 'Custom', price: 'Let\'s talk', period: '', blurb: 'Multiple entities, custom integrations, or a larger team — we\'ll scope it with you directly.', cta: 'Get in touch' },
]

export default function PitchLandingPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ charity_name: '', contact_name: '', email: '', phone: '', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submitDemoRequest() {
    if (sending) return
    if (!form.charity_name.trim() || !form.contact_name.trim() || !form.email.trim()) {
      setError('Please fill in your charity name, your name, and email.')
      return
    }
    setSending(true)
    setError('')
    const { error } = await supabase.from('demo_requests').insert({
      charity_name: form.charity_name.trim(),
      contact_name: form.contact_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      message: form.message.trim() || null,
    })
    setSending(false)
    if (error) { setError('Something went wrong sending your request. Please try again, or email hello@givingtree.sg directly.'); return }
    setSent(true)
  }

  return (
    <div className="pitch-page">
      <style>{`
        .pitch-page {
          min-height: 100vh;
          background: ${P.bg};
          font-family: 'Segoe UI', sans-serif;
          color: ${P.text};
        }
        .pitch-container {
          max-width: 1080px;
          margin: 0 auto;
          padding: 0 24px;
        }
        .pitch-hero-headline {
          font-family: Georgia, serif;
          font-size: 44px;
          line-height: 1.15;
          font-weight: 700;
          color: white;
          margin: 0 0 18px;
        }
        .pitch-feature-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
        }
        .pitch-pricing-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        .pitch-mock-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        @media (max-width: 900px) {
          .pitch-hero-headline { font-size: 32px; }
          .pitch-feature-grid { grid-template-columns: repeat(2, 1fr); }
          .pitch-pricing-grid { grid-template-columns: 1fr; }
          .pitch-mock-stats { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 560px) {
          .pitch-feature-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ── NAV ── */}
      <div style={{ borderBottom: `1px solid ${P.panelBorder}` }}>
        <div className="pitch-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={logo} style={{ width: 30, height: 30, objectFit: 'contain' }} />
            <span style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 17, letterSpacing: '1px', color: 'white' }}>Giving Tree</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <a href="#features" style={navLink}>Features</a>
            <a href="#pricing" style={navLink}>Pricing</a>
            <a href="#contact" style={{ ...navLink, color: P.gold }}>Contact</a>
            <span onClick={() => navigate('/dashboard')} style={{ ...navLink, cursor: 'pointer', border: `1px solid ${P.panelBorder}`, borderRadius: 8, padding: '7px 14px' }}>Sign in</span>
          </div>
        </div>
      </div>

      {/* ── HERO ── */}
      <div className="pitch-container" style={{ padding: '72px 24px 56px', display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 420px', minWidth: 320 }}>
          <div style={{ fontSize: 11, color: P.gold, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 16 }}>Built for small Singapore charities</div>
          <h1 className="pitch-hero-headline">Run donations, receipts, and donor relationships from one place — not five spreadsheets.</h1>
          <p style={{ fontSize: 15.5, color: P.textMuted, lineHeight: 1.7, marginBottom: 28, maxWidth: 480 }}>
            Giving Tree is a donor management dashboard built specifically for small charity teams: log a donation, issue an IRAS-ready receipt, and know who to thank — without hiring an ops person to run it.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <a href="#contact" style={btnPrimary}>Request a demo</a>
            <a href="#features" style={btnSecondary}>See what it does</a>
          </div>
        </div>

        {/* Stylized "screenshot" — a mock dashboard panel, not a real screenshot */}
        <div style={{ flex: '1 1 420px', minWidth: 320 }}>
          <div style={{ background: C.ivory, borderRadius: 16, border: `1px solid ${P.panelBorder}`, boxShadow: '0 24px 60px rgba(0,0,0,0.35)', overflow: 'hidden' }}>
            <div style={{ background: C.forest, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#E27D60' }} />
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#E8C547' }} />
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#6FCF97' }} />
              <div style={{ marginLeft: 10, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>charity.givingtree.sg/dashboard</div>
            </div>
            <div style={{ padding: 20 }}>
              <div className="pitch-mock-stats" style={{ marginBottom: 16 }}>
                {[{ l: 'Raised this year', v: '$48,200' }, { l: 'Donors', v: '312' }, { l: 'Receipts pending', v: '3' }].map((s, i) => (
                  <div key={i} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{s.l}</div>
                    <div style={{ fontFamily: C.fontVoice, fontSize: 18, fontWeight: 500, color: C.forest }}>{s.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                {[['Tan Wei Ming', '$150', 'GIRO'], ['Cold Storage Supermarket', '$2,200', 'In-kind'], ['Marcus Ng', '$500', 'PayNow']].map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < 2 ? `1px solid ${C.ivoryDark}` : undefined, fontSize: 12.5 }}>
                    <span style={{ color: C.text }}>{r[0]}</span>
                    <span style={{ color: C.muted }}>{r[2]}</span>
                    <span style={{ color: C.forest, fontWeight: 600 }}>{r[1]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: P.textMuted, marginTop: 10, textAlign: 'center' }}>Illustrative preview — not a live screenshot.</div>
        </div>
      </div>

      {/* ── FEATURES ── */}
      <div id="features" style={{ borderTop: `1px solid ${P.panelBorder}`, padding: '64px 0' }}>
        <div className="pitch-container">
          <div style={{ fontSize: 11, color: P.gold, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 10 }}>What's inside</div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: 'white', margin: '0 0 32px' }}>Everything a small charity's ops actually needs</h2>
          <div className="pitch-feature-grid">
            {FEATURES.map((f, i) => (
              <div key={i} style={{ background: P.panel, border: `1px solid ${P.panelBorder}`, borderRadius: 14, padding: '18px 16px' }}>
                <div style={{ fontSize: 22, marginBottom: 10 }}>{f.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 6 }}>{f.title}</div>
                <div style={{ fontSize: 12.5, color: P.textMuted, lineHeight: 1.55 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PRICING ── */}
      <div id="pricing" style={{ borderTop: `1px solid ${P.panelBorder}`, padding: '64px 0' }}>
        <div className="pitch-container">
          <div style={{ fontSize: 11, color: P.gold, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 10 }}>Pricing</div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: 'white', margin: '0 0 8px' }}>Simple, and shaped around your charity</h2>
          <p style={{ fontSize: 13.5, color: P.textMuted, marginBottom: 32 }}>We're still onboarding early charities directly, so numbers below are indicative — we'll agree on final pricing together.</p>
          <div className="pitch-pricing-grid">
            {PRICING.map((tier, i) => (
              <div key={i} style={{
                background: tier.highlight ? 'rgba(212,160,23,0.06)' : P.panel,
                border: tier.highlight ? `1.5px solid ${P.gold}` : `1px solid ${P.panelBorder}`,
                borderRadius: 16, padding: '26px 22px', display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: tier.highlight ? P.gold : P.green, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>{tier.name}</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: 'white', marginBottom: 2 }}>{tier.price}</div>
                {tier.period && <div style={{ fontSize: 11.5, color: P.textMuted, marginBottom: 16 }}>{tier.period}</div>}
                <p style={{ fontSize: 12.5, color: P.textMuted, lineHeight: 1.6, marginBottom: 20, flex: 1 }}>{tier.blurb}</p>
                <a href="#contact" style={tier.highlight ? btnPrimary : btnSecondary}>{tier.cta}</a>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTACT ── */}
      <div id="contact" style={{ borderTop: `1px solid ${P.panelBorder}`, padding: '64px 0 80px' }}>
        <div className="pitch-container" style={{ maxWidth: 560 }}>
          <div style={{ fontSize: 11, color: P.gold, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 10 }}>Get in touch</div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: 'white', margin: '0 0 10px' }}>Request a demo</h2>
          <p style={{ fontSize: 13.5, color: P.textMuted, marginBottom: 28, lineHeight: 1.6 }}>Tell us a bit about your charity and we'll reach out to set up a walkthrough — no obligation.</p>

          {sent ? (
            <div style={{ background: 'rgba(64,145,108,0.15)', border: `1px solid ${P.greenBright}`, borderRadius: 12, padding: '20px 22px', fontSize: 14, color: P.text, lineHeight: 1.6 }}>
              Thanks — we've got your request and will be in touch shortly. In the meantime, feel free to email <span style={{ color: P.gold }}>hello@givingtree.sg</span> directly.
            </div>
          ) : (
            <>
              {error && (
                <div style={{ background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.25)', color: P.errorText, padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 18 }}>{error}</div>
              )}
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Charity name</label>
                <input style={inp} value={form.charity_name} onChange={e => setForm(f => ({ ...f, charity_name: e.target.value }))} placeholder="e.g. Singapore Cancer Society" />
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Your name</label>
                  <input style={inp} value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="Your full name" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Email</label>
                  <input style={inp} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@charity.org" />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Phone (optional)</label>
                <input style={inp} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+65 1234 5678" />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>Anything we should know? (optional)</label>
                <textarea style={{ ...inp, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Team size, what you're using today, etc." />
              </div>
              <button onClick={submitDemoRequest} disabled={sending} style={{ ...btnPrimary, border: 'none', cursor: sending ? 'default' : 'pointer', width: '100%', textAlign: 'center', opacity: sending ? 0.7 : 1 }}>
                {sending ? 'Sending...' : 'Request a demo'}
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${P.panelBorder}`, padding: '24px 0', textAlign: 'center', fontSize: 11.5, color: P.textMuted }}>
        © {new Date().getFullYear()} Giving Tree · hello@givingtree.sg
      </div>
    </div>
  )
}

const navLink: CSSProperties = { fontSize: 13, color: 'rgba(224,238,230,0.8)', textDecoration: 'none' }

const btnPrimary: CSSProperties = {
  display: 'inline-block', padding: '13px 22px', background: `linear-gradient(135deg, ${P.greenBright}, ${C.forest})`,
  color: 'white', borderRadius: 12, fontSize: 13.5, fontWeight: 700, textDecoration: 'none',
  letterSpacing: '0.5px', boxShadow: '0 6px 22px rgba(27,67,50,0.45)',
}

const btnSecondary: CSSProperties = {
  display: 'inline-block', padding: '13px 22px', background: 'transparent', border: `1.5px solid ${P.panelBorder}`,
  color: P.text, borderRadius: 12, fontSize: 13.5, fontWeight: 600, textDecoration: 'none',
}

const lbl: CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 600, color: '#52B788', letterSpacing: '1.5px',
  textTransform: 'uppercase', marginBottom: 7,
}

const inp: CSSProperties = {
  width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(116,198,157,0.18)',
  borderRadius: 10, fontSize: 13.5, color: 'white', outline: 'none', boxSizing: 'border-box',
}
