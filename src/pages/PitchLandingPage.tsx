import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const NAV_CARDS = [
  { icon: 'card', bg: '#E6F2EA', fg: '#1f7a48', title: 'Log donations', sub: 'Cash, cheque, PayNow, GIRO' },
  { icon: 'receipt', bg: '#FBF2DE', fg: '#8a5a10', title: 'Issue receipts', sub: 'One click, IRAS-ready' },
  { icon: 'bank', bg: '#EAE6F5', fg: '#534AB7', title: 'File IRAS export', sub: 'myTax Portal formatted' },
  { icon: 'users', bg: '#FBEAE9', fg: '#A32D2D', title: 'Track donors', sub: 'Full giving history' },
  { icon: 'coins', bg: '#E6F0FA', fg: '#185FA5', title: 'Manage grants', sub: 'Reports, tranches, claims' },
  { icon: 'chart', bg: '#F0F5E6', fg: '#3B6D11', title: 'See analytics', sub: 'Retention, trends, impact' },
]

const LIB_TABS = ['Featured', 'Donations', 'Compliance', 'Donors', 'Analytics'] as const

const LIB_CARDS: { cat: typeof LIB_TABS[number], tagBg: string, tagFg: string, tag: string, title: string, desc: string }[] = [
  { cat: 'Featured', tagBg: '#FBF2DE', tagFg: '#8a5a10', tag: 'Most used', title: 'Receipts & IRAS in one click', desc: 'Download a fully formatted IRAS export for myTax Portal in seconds. Never miss the 31 January deadline again.' },
  { cat: 'Featured', tagBg: '#E6F2EA', tagFg: '#1f7a48', tag: 'New', title: 'Thank every donor automatically', desc: 'Personalised thank-you emails sent the moment you confirm a donation. Every donor acknowledged, no one forgotten.' },
  { cat: 'Featured', tagBg: '#FBEAE9', tagFg: '#A32D2D', tag: 'Popular', title: 'Missing NRICs flagged for you', desc: 'Donors without an NRIC on file are highlighted automatically, with a one-click reminder to claim their tax deduction.' },
  { cat: 'Donations', tagBg: '#E6F2EA', tagFg: '#1f7a48', tag: 'Donations', title: 'Every donation, however it arrives', desc: 'Cash, cheque, bank wire, PayNow, GIRO — logged once, tracked forever, and flowing into the same IRAS export.' },
  { cat: 'Donations', tagBg: '#E6F2EA', tagFg: '#1f7a48', tag: 'Donations', title: 'Recurring gifts & pledges', desc: 'Track GIRO commitments and multi-year pledges, with reminders when one lapses.' },
  { cat: 'Donations', tagBg: '#E6F2EA', tagFg: '#1f7a48', tag: 'Donations', title: 'In-kind gifts', desc: 'Log goods and services donations with their own acknowledgement receipts, separate from cash totals.' },
  { cat: 'Compliance', tagBg: '#FBF2DE', tagFg: '#8a5a10', tag: 'Compliance', title: 'IRAS-ready export', desc: 'NRIC handling and tax-deduction rules built in, so year-end submission is an export, not a scramble.' },
  { cat: 'Compliance', tagBg: '#FBF2DE', tagFg: '#8a5a10', tag: 'Compliance', title: 'Audit log', desc: 'Every change your team makes is recorded automatically — who did what, and when.' },
  { cat: 'Compliance', tagBg: '#FBF2DE', tagFg: '#8a5a10', tag: 'Compliance', title: 'Receipt voiding & reissue', desc: 'Made a mistake on a receipt? Void and reissue it properly, with a clean paper trail.' },
  { cat: 'Donors', tagBg: '#FBEAE9', tagFg: '#A32D2D', tag: 'Donors', title: 'Full donor management', desc: "Every donor's giving history, receipt status, and contact details — no more spreadsheets scattered across inboxes." },
  { cat: 'Donors', tagBg: '#FBEAE9', tagFg: '#A32D2D', tag: 'Donors', title: 'Grant tracking', desc: 'Funder reports, tranches, and matching claims in one place instead of a spreadsheet per grant.' },
  { cat: 'Donors', tagBg: '#FBEAE9', tagFg: '#A32D2D', tag: 'Donors', title: 'Household linking', desc: 'Link donors as a household so gifts and reporting reflect how families actually give.' },
  { cat: 'Analytics', tagBg: '#F0F5E6', tagFg: '#3B6D11', tag: 'Analytics', title: 'Donor analytics that show your impact', desc: 'Retention, campaign performance, and giving trends — simple, honest analytics built for a small team.' },
  { cat: 'Analytics', tagBg: '#F0F5E6', tagFg: '#3B6D11', tag: 'Analytics', title: 'Fundraising performance', desc: "See what's working across campaigns and mass appeals, month over month." },
  { cat: 'Analytics', tagBg: '#F0F5E6', tagFg: '#3B6D11', tag: 'Analytics', title: 'Audit-ready reporting', desc: 'Export clean records for your board or auditor without rebuilding a report from scratch.' },
]

const FAQS = [
  { q: 'Is Giving Tree free?', a: "We offer a free trial period so you can try it risk-free before committing to anything. After your trial, pricing is designed to be affordable for small charities — there's no setup fee, no long contract, and we onboard you personally within 24 hours." },
  { q: 'How does the IRAS export work?', a: 'Once your donations are logged with valid NRICs, you can download a fully formatted file for myTax Portal in one click — no manual formatting needed.' },
  { q: 'Is donor NRIC data handled securely?', a: "Yes — NRICs are used only to generate IRAS tax-deduction records and are never shared or sold. Access is restricted to your own charity's staff." },
  { q: 'Can more than one staff member use it?', a: 'Yes, you can add staff, board, and volunteer accounts with different levels of access — from full admin to read-only.' },
  { q: 'What if we already have donation records elsewhere?', a: "We'll help you migrate your existing donor and donation history when you get set up — just bring your spreadsheet." },
]

function Icon({ name, className }: { name: string, className?: string }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className }
  switch (name) {
    case 'card': return <svg {...common}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.5h19" /><path d="M6 14.5h4" /></svg>
    case 'receipt': return <svg {...common}><path d="M6 3h12v18l-2.5-1.6L13 21l-1-1.6-1 1.6-2.5-1.6L6 21V3z" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>
    case 'bank': return <svg {...common}><path d="M3 10l9-6 9 6" /><path d="M5 10v9M9.5 10v9M14.5 10v9M19 10v9" /><path d="M3 19h18" /></svg>
    case 'users': return <svg {...common}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c0-3.3 2.5-5.8 5.5-5.8s5.5 2.5 5.5 5.8" /><circle cx="17.5" cy="9" r="2.4" /><path d="M15.5 13.5c2.4.2 4.4 2.3 4.4 5" /></svg>
    case 'coins': return <svg {...common}><ellipse cx="9" cy="7" rx="6" ry="3.2" /><path d="M3 7v5c0 1.8 2.7 3.2 6 3.2s6-1.4 6-3.2V7" /><path d="M3 12v5c0 1.8 2.7 3.2 6 3.2 1 0 2-.1 2.8-.4" /><ellipse cx="17" cy="15" rx="4.3" ry="2.4" /><path d="M12.7 15v3c0 1.3 1.9 2.4 4.3 2.4s4.3-1.1 4.3-2.4v-3" /></svg>
    case 'chart': return <svg {...common}><path d="M4 20V10M11 20V4M18 20v-7" /><path d="M2.5 20.5h19" /></svg>
    case 'leaf': return <svg {...common}><path d="M4 20C4 10 11 4 20 4c0 9-6 16-16 16z" /><path d="M4 20c3-6 7.5-9.5 12-11.5" /></svg>
    default: return null
  }
}

function EmailCapture({ placeholder = 'you@charity.org.sg', cta = 'Get started', style }: { placeholder?: string, cta?: string, style?: React.CSSProperties }) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (sending) return
    if (!email.trim() || !email.includes('@')) { setError('Enter a valid email address.'); return }
    setSending(true)
    setError('')
    const { error } = await supabase.from('demo_requests').insert({ email: email.trim() })
    setSending(false)
    if (error) { setError("Something went wrong. Try again, or email hello@givingtree.sg."); return }
    setSent(true)
    setEmail('')
  }

  if (sent) {
    return <div className="hs-note" style={{ color: 'var(--forest)', fontWeight: 700, ...style }}>Thanks — we'll be in touch shortly.</div>
  }

  return (
    <div style={style}>
      <div className="hero-form">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit() }} placeholder={placeholder} />
        <button className="btn-pill btn-primary" onClick={submit} disabled={sending}>{sending ? 'Sending...' : cta}</button>
      </div>
      {error && <div style={{ color: '#A32D2D', fontSize: 12.5, fontWeight: 600, marginTop: 6 }}>{error}</div>}
    </div>
  )
}

export default function PitchLandingPage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [activeTab, setActiveTab] = useState<typeof LIB_TABS[number]>('Featured')
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll)
    const observer = new IntersectionObserver(entries => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('in'), i * 70)
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.12 })
    document.querySelectorAll('.hs-page .reveal').forEach(el => observer.observe(el))
    return () => { window.removeEventListener('scroll', onScroll); observer.disconnect() }
  }, [])

  return (
    <div className="hs-page">
      <style>{`
        .hs-page{
          --cream:#FBF6ED; --cream-deep:#F3ECDA; --ink:#211F1B; --muted:#6B6259; --muted-soft:#8A8072;
          --forest:#1B4332; --forest-deep:#0F2A1F; --sage:#3D7A5C; --gold:#B4870E; --gold-bg:#FBF2DE;
          --card-border:#EAE1CB; --white:#FFFFFF;
          --font:-apple-system,'Segoe UI','Helvetica Neue',Arial,sans-serif;
          --ease:cubic-bezier(.16,1,.3,1);
          --shadow-sm:0 1px 2px rgba(33,31,27,0.04),0 1px 1px rgba(33,31,27,0.03);
          --shadow-md:0 1px 2px rgba(33,31,27,0.04),0 12px 28px rgba(27,67,50,0.08);
          --shadow-lg:0 1px 3px rgba(33,31,27,0.05),0 30px 60px rgba(27,67,50,0.14);
        }
        .hs-page *,.hs-page *::before,.hs-page *::after{box-sizing:border-box}
        .hs-page{font-family:var(--font);background:var(--cream);color:var(--ink);overflow-x:hidden;-webkit-font-smoothing:antialiased;font-size:16px;line-height:1.5}
        .hs-page a{color:inherit}
        .hs-page svg{display:block}
        .hs-container{max-width:1160px;margin:0 auto;padding:0 32px}

        .hs-promo{background:var(--forest-deep);color:#F3D9A0;text-align:center;font-size:13.5px;font-weight:600;padding:11px 16px}
        .hs-promo a{text-decoration:underline;text-underline-offset:2px;margin-left:6px;color:#fff;cursor:pointer}

        .hs-nav{position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:20px 32px;background:rgba(251,246,237,0.85);backdrop-filter:blur(10px);border-bottom:1px solid transparent;transition:border-color .3s ease}
        .hs-nav.scrolled{border-color:var(--card-border)}
        .hs-nav-brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:17.5px;letter-spacing:-0.2px}
        .hs-nav-brand .dot{width:28px;height:28px;border-radius:9px;background:var(--forest);display:flex;align-items:center;justify-content:center}
        .hs-nav-brand .dot svg{width:15px;height:15px;stroke:white;stroke-width:2}
        .hs-nav-links{display:flex;align-items:center;gap:32px;font-size:14px;font-weight:600}
        .hs-nav-links a{text-decoration:none;color:var(--muted);transition:color .2s ease;cursor:pointer}
        .hs-nav-links a:hover{color:var(--ink)}

        .btn-pill{display:inline-flex;align-items:center;gap:6px;border-radius:100px;font-weight:700;font-size:14px;padding:13px 24px;text-decoration:none;border:none;cursor:pointer;font-family:inherit;transition:transform .25s var(--ease),box-shadow .25s var(--ease),background .2s ease}
        .btn-primary{background:var(--forest);color:white;box-shadow:0 1px 2px rgba(15,42,31,0.1),0 8px 20px rgba(27,67,50,0.18)}
        .btn-primary:hover{background:var(--forest-deep);transform:translateY(-2px);box-shadow:0 1px 2px rgba(15,42,31,0.1),0 14px 28px rgba(27,67,50,0.26)}
        .btn-primary:disabled{opacity:0.7;cursor:default;transform:none}
        .btn-secondary{background:var(--white);color:var(--ink);border:1.5px solid var(--card-border)}
        .btn-secondary:hover{border-color:var(--forest);transform:translateY(-2px)}
        .btn-sm{padding:11px 20px;font-size:13.5px}

        .reveal{opacity:0;transform:translateY(28px);transition:opacity .8s var(--ease),transform .8s var(--ease)}
        .reveal.in{opacity:1;transform:translateY(0)}

        .hs-hero{padding:88px 32px 120px;position:relative}
        .hs-hero-grid{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center;max-width:1160px;margin:0 auto}
        .hs-hero-eyebrow{display:inline-flex;align-items:center;gap:6px;background:var(--gold-bg);color:#8a5a10;font-size:12.5px;font-weight:700;padding:7px 15px;border-radius:100px;margin-bottom:26px}
        .hs-hero h1{font-size:clamp(38px,5vw,58px);font-weight:800;line-height:1.04;letter-spacing:-1.4px;margin-bottom:24px}
        .hs-hero p{font-size:18px;line-height:1.65;color:var(--muted);max-width:460px;margin-bottom:34px}
        .hero-form{display:flex;gap:10px;max-width:440px;margin-bottom:16px}
        .hero-form input{flex:1;padding:15px 18px;border-radius:100px;border:1.5px solid var(--card-border);background:white;font-size:14.5px;font-family:inherit;outline:none;transition:border-color .2s ease,box-shadow .2s ease}
        .hero-form input:focus{border-color:var(--forest);box-shadow:0 0 0 4px rgba(27,67,50,0.08)}
        .hs-hero-note{font-size:13px;color:var(--muted-soft);font-weight:500}

        .hs-hero-visual{position:relative}
        .hs-hero-glow{position:absolute;inset:-40px;background:radial-gradient(ellipse at 60% 30%,rgba(212,160,23,0.16) 0%,transparent 60%),radial-gradient(ellipse at 20% 80%,rgba(27,67,50,0.12) 0%,transparent 55%);pointer-events:none;filter:blur(6px)}
        .hs-hero-shot{position:relative;background:#14201A;border-radius:20px;overflow:hidden;box-shadow:var(--shadow-lg);transform:rotate(1.5deg)}
        .hs-shot-bar{background:#1c2c22;padding:12px 16px;display:flex;align-items:center;gap:12px}
        .hs-shot-bar .dots{display:flex;gap:6px}
        .hs-shot-bar span{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,0.18)}
        .hs-shot-bar .url{flex:1;background:rgba(0,0,0,0.2);border-radius:6px;padding:5px 12px;font-size:11px;color:rgba(255,255,255,0.35);font-family:ui-monospace,monospace}
        .hs-shot-body{display:flex;height:340px}
        .hs-sidebar{width:160px;background:#0F2A1F;flex-shrink:0;padding:18px 12px}
        .hs-sidebar-item{display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:8px;font-size:12px;color:rgba(255,255,255,0.55);margin-bottom:3px}
        .hs-sidebar-item svg{width:15px;height:15px;stroke-width:1.8;flex-shrink:0}
        .hs-sidebar-item.on{background:var(--sage);color:white;font-weight:700}
        .hs-shot-main{flex:1;padding:20px 22px;background:#182b21}
        .hs-stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}
        .hs-stat{background:rgba(255,255,255,0.05);border-radius:10px;padding:12px}
        .hs-stat .l{font-size:9px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;font-weight:600}
        .hs-stat .v{color:var(--gold);font-weight:800;font-size:17px;letter-spacing:-0.3px}
        .hs-table{background:rgba(255,255,255,0.03);border-radius:10px;overflow:hidden}
        .hs-row{display:flex;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);color:rgba(255,255,255,0.7);font-size:12px}
        .hs-row:last-child{border-bottom:none}
        .hs-hero-float{position:absolute;bottom:-22px;left:-26px;background:white;border-radius:14px;padding:14px 18px;box-shadow:var(--shadow-md);display:flex;align-items:center;gap:10px;transform:rotate(-2deg)}
        .hs-hero-float .n{font-weight:800;font-size:18px;color:var(--forest)}
        .hs-hero-float .l{font-size:11px;color:var(--muted);font-weight:600}

        .hs-section{padding:110px 32px}
        .hs-eyebrow{display:block;font-size:12.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--sage);margin-bottom:14px}
        .hs-page h2{font-size:clamp(28px,3.6vw,38px);font-weight:800;letter-spacing:-0.8px;line-height:1.12;margin-bottom:16px}

        .hs-sec-header{text-align:center;max-width:600px;margin:0 auto 52px}
        .hs-sec-header p{color:var(--muted);font-size:16.5px;line-height:1.65}

        .hs-nav-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:1160px;margin:0 auto}
        .hs-nav-card{background:var(--white);border:1.5px solid var(--card-border);border-radius:18px;padding:24px;display:flex;align-items:center;gap:16px;text-decoration:none;color:var(--ink);transition:transform .3s var(--ease),box-shadow .3s var(--ease),border-color .3s ease;box-shadow:var(--shadow-sm);cursor:pointer}
        .hs-nav-card:hover{transform:translateY(-5px);box-shadow:var(--shadow-md);border-color:transparent}
        .hs-nav-card .icon{width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .hs-nav-card .icon svg{width:22px;height:22px;stroke-width:1.7}
        .hs-nav-card .txt div:first-child{font-weight:700;font-size:15.5px;margin-bottom:3px;letter-spacing:-0.2px}
        .hs-nav-card .txt div:last-child{font-size:12.5px;color:var(--muted)}

        .hs-biz{background:var(--forest);border-radius:28px;max-width:1160px;margin:0 auto;padding:64px 56px;display:flex;gap:52px;align-items:center;position:relative;overflow:hidden}
        .hs-biz::before{content:'';position:absolute;top:-120px;right:-120px;width:340px;height:340px;border-radius:50%;background:radial-gradient(circle,rgba(212,160,23,0.14) 0%,transparent 70%)}
        .hs-biz-content{flex:1;position:relative;z-index:1}
        .hs-biz-content .hs-eyebrow{color:#9FD9BC}
        .hs-biz-content h2{color:white}
        .hs-biz-content p{color:rgba(255,255,255,0.65);font-size:16px;line-height:1.7;margin-bottom:30px;max-width:440px}
        .hs-biz-actions{display:flex;gap:12px}
        .hs-biz-stats{flex:0 0 230px;display:flex;flex-direction:column;gap:16px;position:relative;z-index:1}
        .hs-biz-stat{background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:20px}
        .hs-biz-stat .v{font-size:30px;font-weight:800;color:var(--gold);letter-spacing:-0.5px}
        .hs-biz-stat .l{font-size:12.5px;color:rgba(255,255,255,0.55);margin-top:4px;font-weight:500}

        .hs-tab-bar{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-bottom:40px}
        .hs-tab-btn{background:transparent;border:none;border-radius:100px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer;color:var(--muted);font-family:inherit;transition:all .25s var(--ease)}
        .hs-tab-btn:hover{color:var(--ink)}
        .hs-tab-btn.active{background:var(--forest);color:white;box-shadow:var(--shadow-sm)}
        .hs-lib-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:1160px;margin:0 auto}
        .hs-lib-card{background:var(--white);border:1.5px solid var(--card-border);border-radius:18px;padding:26px;box-shadow:var(--shadow-sm);transition:transform .3s var(--ease),box-shadow .3s var(--ease);animation:hsCardIn .4s var(--ease) both}
        .hs-lib-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-md)}
        @keyframes hsCardIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .hs-lib-tag{display:inline-block;font-size:10.5px;font-weight:700;padding:5px 11px;border-radius:100px;margin-bottom:14px;text-transform:uppercase;letter-spacing:0.5px}
        .hs-lib-card h3{font-size:16px;font-weight:800;margin-bottom:8px;letter-spacing:-0.2px}
        .hs-lib-card p{font-size:13px;color:var(--muted);line-height:1.65}

        .hs-faq{max-width:760px;margin:0 auto}
        .hs-faq-item{border-bottom:1.5px solid var(--card-border)}
        .hs-faq-btn{all:unset;box-sizing:border-box;cursor:pointer;padding:22px 4px;font-weight:700;font-size:16px;display:flex;justify-content:space-between;align-items:center;width:100%;letter-spacing:-0.2px}
        .hs-faq-icon{width:22px;height:22px;flex-shrink:0;position:relative}
        .hs-faq-icon::before,.hs-faq-icon::after{content:'';position:absolute;background:var(--sage);top:50%;left:50%;transform:translate(-50%,-50%)}
        .hs-faq-icon::before{width:14px;height:2px}
        .hs-faq-icon::after{width:2px;height:14px;transition:transform .3s var(--ease)}
        .hs-faq-item.open .hs-faq-icon::after{transform:translate(-50%,-50%) rotate(90deg)}
        .hs-faq-body{display:grid;grid-template-rows:0fr;transition:grid-template-rows .35s var(--ease)}
        .hs-faq-item.open .hs-faq-body{grid-template-rows:1fr}
        .hs-faq-body-inner{overflow:hidden}
        .hs-faq-body p{padding:0 4px 22px;color:var(--muted);font-size:14.5px;line-height:1.7;max-width:640px}

        .hs-capture{background:var(--cream-deep);border-radius:28px;max-width:1160px;margin:0 auto;padding:64px 56px;text-align:center;position:relative;overflow:hidden}
        .hs-capture::before{content:'';position:absolute;width:420px;height:420px;top:50%;left:50%;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,rgba(27,67,50,0.05) 0%,transparent 70%)}
        .hs-capture h2{margin-bottom:10px;position:relative}
        .hs-capture p{color:var(--muted);font-size:15.5px;margin-bottom:28px;position:relative}
        .hs-capture .hero-form{margin:0 auto;position:relative}

        .hs-footer{background:var(--forest-deep);color:rgba(255,255,255,0.55);padding:64px 32px 32px}
        .hs-foot-grid{max-width:1160px;margin:0 auto;display:grid;grid-template-columns:repeat(5,1fr);gap:32px;margin-bottom:44px}
        .hs-foot-grid h4{color:white;font-size:12.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:16px}
        .hs-foot-grid a{display:block;font-size:13.5px;text-decoration:none;color:rgba(255,255,255,0.55);margin-bottom:11px;transition:color .2s ease;cursor:pointer}
        .hs-foot-grid a:hover{color:white}
        .hs-foot-bottom{max-width:1160px;margin:0 auto;border-top:1px solid rgba(255,255,255,0.1);padding-top:24px;font-size:12.5px;display:flex;justify-content:space-between}

        @media (max-width:900px){
          .hs-section{padding:72px 24px}
          .hs-hero{padding:56px 24px 100px}
          .hs-hero-grid{grid-template-columns:1fr;gap:56px}
          .hs-hero-float{display:none}
          .hs-nav-grid{grid-template-columns:1fr 1fr}
          .hs-lib-grid{grid-template-columns:1fr}
          .hs-biz{flex-direction:column;padding:40px 28px}
          .hs-biz-stats{flex-direction:row;width:100%}
          .hs-foot-grid{grid-template-columns:1fr 1fr}
          .hs-nav-links{display:none}
        }
      `}</style>

      <div className="hs-promo">Now onboarding small registered charities in Singapore — start your free trial today<a onClick={() => document.getElementById('capture')?.scrollIntoView({ behavior: 'smooth' })}>Get started →</a></div>

      <nav className={`hs-nav${scrolled ? ' scrolled' : ''}`}>
        <div className="hs-nav-brand"><div className="dot"><Icon name="leaf" /></div>Giving Tree</div>
        <div className="hs-nav-links">
          <a onClick={() => document.getElementById('nav-grid')?.scrollIntoView({ behavior: 'smooth' })}>What you need</a>
          <a onClick={() => document.getElementById('library')?.scrollIntoView({ behavior: 'smooth' })}>Features</a>
          <a onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })}>FAQ</a>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-pill btn-secondary btn-sm" onClick={() => navigate('/dashboard')}>Log in</button>
          <button className="btn-pill btn-primary btn-sm" onClick={() => document.getElementById('capture')?.scrollIntoView({ behavior: 'smooth' })}>Start free trial</button>
        </div>
      </nav>

      <section className="hs-hero">
        <div className="hs-hero-grid">
          <div>
            <span className="hs-hero-eyebrow">Built for small registered charities in Singapore</span>
            <h1>Run your charity's donations without the admin headache.</h1>
            <p>Log donations, issue IRAS-ready receipts, and track every donor — all from one dashboard built for small charity teams, not accountants.</p>
            <EmailCapture cta="Start free trial" />
            <div className="hs-hero-note">Free trial · Zero setup fees · Live in 24 hours</div>
          </div>
          <div className="hs-hero-visual">
            <div className="hs-hero-glow" />
            <div className="hs-hero-shot">
              <div className="hs-shot-bar">
                <div className="dots"><span /><span /><span /></div>
                <div className="url">charity.givingtree.sg</div>
              </div>
              <div className="hs-shot-body">
                <div className="hs-sidebar">
                  <div className="hs-sidebar-item on"><Icon name="chart" />Dashboard</div>
                  <div className="hs-sidebar-item"><Icon name="card" />Donations</div>
                  <div className="hs-sidebar-item"><Icon name="chart" />Analytics</div>
                  <div className="hs-sidebar-item"><Icon name="bank" />IRAS Export</div>
                </div>
                <div className="hs-shot-main">
                  <div className="hs-stat-row">
                    <div className="hs-stat"><div className="l">Raised</div><div className="v">$48,200</div></div>
                    <div className="hs-stat"><div className="l">Donors</div><div className="v">312</div></div>
                    <div className="hs-stat"><div className="l">Pending</div><div className="v">3</div></div>
                  </div>
                  <div className="hs-table">
                    <div className="hs-row"><span>Tan Wei Ming</span><span style={{ color: 'var(--gold)', fontWeight: 700 }}>$150</span></div>
                    <div className="hs-row"><span>Cold Storage Supermarket</span><span style={{ color: 'var(--gold)', fontWeight: 700 }}>$2,200</span></div>
                    <div className="hs-row"><span>Marcus Ng</span><span style={{ color: 'var(--gold)', fontWeight: 700 }}>$500</span></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="hs-hero-float"><span className="n">312</span><span className="l">donors<br />tracked</span></div>
          </div>
        </div>
      </section>

      <section id="nav-grid" className="hs-section">
        <div className="hs-sec-header">
          <span className="hs-eyebrow">What does your charity need</span>
          <h2>Whatever's piling up, we've got it covered.</h2>
          <p>Pick what's giving your team the most trouble right now.</p>
        </div>
        <div className="hs-nav-grid">
          {NAV_CARDS.map((c, i) => (
            <div key={i} className="hs-nav-card reveal" onClick={() => document.getElementById('library')?.scrollIntoView({ behavior: 'smooth' })}>
              <div className="icon" style={{ background: c.bg, color: c.fg }}><Icon name={c.icon} /></div>
              <div className="txt"><div>{c.title}</div><div>{c.sub}</div></div>
            </div>
          ))}
        </div>
      </section>

      <section className="hs-section">
        <div className="hs-biz reveal">
          <div className="hs-biz-content">
            <span className="hs-eyebrow">Built for small charities</span>
            <h2>Small team, big admin load?<br />We built this for you.</h2>
            <p>No finance team, no tech team, no full-time admin — just people doing the work. Giving Tree handles the paperwork so you don't have to.</p>
            <div className="hs-biz-actions">
              <button className="btn-pill btn-primary" onClick={() => document.getElementById('capture')?.scrollIntoView({ behavior: 'smooth' })}>Request a demo</button>
              <button className="btn-pill" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1.5px solid rgba(255,255,255,0.25)' }} onClick={() => document.getElementById('library')?.scrollIntoView({ behavior: 'smooth' })}>See what it does</button>
            </div>
          </div>
          <div className="hs-biz-stats">
            <div className="hs-biz-stat"><div className="v">24 hrs</div><div className="l">From sign-up to live dashboard</div></div>
            <div className="hs-biz-stat"><div className="v">Free</div><div className="l">Trial period, no credit card needed</div></div>
          </div>
        </div>
      </section>

      <section id="library" className="hs-section">
        <div className="hs-sec-header">
          <span className="hs-eyebrow">Explore what's inside</span>
          <h2>Everything your charity's admin needs.</h2>
          <p>One dashboard, built specifically around how a small charity team actually works.</p>
        </div>
        <div className="hs-tab-bar">
          {LIB_TABS.map(tab => (
            <button key={tab} className={`hs-tab-btn${activeTab === tab ? ' active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>
          ))}
        </div>
        <div className="hs-lib-grid">
          {LIB_CARDS.filter(c => c.cat === activeTab).map((c, i) => (
            <div key={activeTab + i} className="hs-lib-card" style={{ animationDelay: `${i * 60}ms` }}>
              <span className="hs-lib-tag" style={{ background: c.tagBg, color: c.tagFg }}>{c.tag}</span>
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="hs-section">
        <div className="hs-sec-header">
          <span className="hs-eyebrow">Frequently asked questions</span>
          <h2>Good to know before you sign up.</h2>
        </div>
        <div className="hs-faq">
          {FAQS.map((f, i) => (
            <div key={i} className={`hs-faq-item${openFaq === i ? ' open' : ''}`}>
              <button className="hs-faq-btn" onClick={() => setOpenFaq(o => o === i ? null : i)}>{f.q}<span className="hs-faq-icon" /></button>
              <div className="hs-faq-body"><div className="hs-faq-body-inner"><p>{f.a}</p></div></div>
            </div>
          ))}
        </div>
      </section>

      <section id="capture" className="hs-section">
        <div className="hs-capture reveal">
          <h2>Ready to get started?</h2>
          <p>Leave your email and we'll reach out to set up your dashboard — no obligation.</p>
          <EmailCapture cta="Request a demo" />
        </div>
      </section>

      <footer className="hs-footer">
        <div className="hs-foot-grid">
          <div>
            <h4>Product</h4>
            <a onClick={() => document.getElementById('library')?.scrollIntoView({ behavior: 'smooth' })}>Donations</a>
            <a onClick={() => document.getElementById('library')?.scrollIntoView({ behavior: 'smooth' })}>Receipts & IRAS</a>
            <a onClick={() => document.getElementById('library')?.scrollIntoView({ behavior: 'smooth' })}>Donor CRM</a>
            <a onClick={() => document.getElementById('library')?.scrollIntoView({ behavior: 'smooth' })}>Analytics</a>
          </div>
          <div>
            <h4>Charities</h4>
            <a onClick={() => document.getElementById('capture')?.scrollIntoView({ behavior: 'smooth' })}>Get started</a>
            <a onClick={() => document.getElementById('capture')?.scrollIntoView({ behavior: 'smooth' })}>Request a demo</a>
            <a onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })}>FAQ</a>
          </div>
          <div>
            <h4>Company</h4>
            <a href="mailto:hello@givingtree.sg">Contact</a>
          </div>
          <div>
            <h4>Legal</h4>
            <a href="https://givingtree.sg/privacy">Privacy policy</a>
            <a href="https://givingtree.sg/terms">Terms of use</a>
          </div>
          <div>
            <h4>Get in touch</h4>
            <a href="mailto:hello@givingtree.sg">hello@givingtree.sg</a>
          </div>
        </div>
        <div className="hs-foot-bottom">
          <span>© {new Date().getFullYear()} Giving Tree</span>
          <span>Made for small Singapore charities</span>
        </div>
      </footer>
    </div>
  )
}
