import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import logo from '../assets/logo.png'

const PAIN_QUOTES = [
  '"I\'m a volunteer. Doing this admin was never part of the job."',
  '"Our cash donations are in an envelope. I don\'t know how to issue receipts for 200 donors."',
  '"We do incredible work in our community. Nobody outside our circle knows we exist."',
]

const FEATURE_CARDS = [
  { title: 'Receipts & IRAS in one click', desc: 'Download a fully formatted IRAS export for myTax Portal in seconds. Never miss the 31 January deadline again.' },
  { title: 'Thank every donor automatically', desc: 'Personalised thank-you emails sent the moment you confirm a donation. Every donor acknowledged, no one forgotten.' },
  { title: 'Missing NRICs flagged for you', desc: 'Donors without an NRIC on file are highlighted automatically, with a one-click reminder so they can claim their tax deduction.' },
  { title: 'Donor analytics that show your impact', desc: 'Retention, campaign performance, and giving trends — simple, honest analytics built for a small team, not a data analyst.' },
  { title: 'Every donation captured, however it arrives', desc: 'Cash, cheque, bank wire, PayNow, GIRO — log it manually and it flows into the same dashboard and IRAS export.' },
  { title: 'Full donor and grant management', desc: 'Every donor, pledge, recurring gift, and funder report in one place — no more spreadsheets scattered across inboxes.' },
]

const STEPS = [
  { n: 1, title: 'Reach out to us', desc: 'Email us at hello@givingtree.sg with your charity name and UEN. That\'s all we need.', tag: '⏱ 5 minutes' },
  { n: 2, title: 'We set you up', desc: 'Your dashboard is live within 24 hours, configured around how your team already works.', tag: '⏱ 24 hours' },
  { n: 3, title: 'Go live', desc: 'Log in and start logging donations, issuing receipts, and tracking donors straight away.', tag: '✓ You\'re live', good: true },
  { n: 4, title: 'Run your season', desc: 'Come tax time, your IRAS export is one click away — not a scramble through spreadsheets.', tag: '💛 Ready for IRAS', warm: true },
]

const LEAVES = ['🌿', '🍃', '🌿', '🍃', '🌿', '🍃', '🌿']

const CONFETTI_COLORS = ['#D4A017', '#F0C84A', '#74C69D', '#40916C', '#FAF7F2']

// Counts up from 0 to `target` once its wrapper scrolls into view. Kept as
// its own component (not inlined) so each stat gets an independent observer
// and doesn't re-trigger every time a sibling re-renders.
function CountUp({ target, prefix = '', suffix = '', duration = 1200 }: { target: number, prefix?: string, suffix?: string, duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [value, setValue] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let started = false
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !started) {
          started = true
          const start = performance.now()
          const tick = (now: number) => {
            const progress = Math.min(1, (now - start) / duration)
            const eased = 1 - Math.pow(1 - progress, 3)
            setValue(Math.round(target * eased))
            if (progress < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
          observer.disconnect()
        }
      })
    }, { threshold: 0.4 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [target, duration])
  return <span ref={ref}>{prefix}{value.toLocaleString()}{suffix}</span>
}

// Small DOM-particle confetti burst — deliberately hand-rolled rather than a
// library, since we only ever need this one moment (successful demo request).
function ConfettiBurst() {
  const particles = useRef(Array.from({ length: 26 }, (_, i) => ({
    id: i,
    angle: (Math.PI * 2 * i) / 26 + Math.random() * 0.4,
    dist: 90 + Math.random() * 90,
    size: 6 + Math.random() * 6,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: Math.random() * 0.15,
    rot: Math.random() * 360,
  }))).current
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
      {particles.map(p => (
        <div
          key={p.id}
          className="pitch-confetti-piece"
          style={{
            position: 'absolute', top: '50%', left: '50%', width: p.size, height: p.size * 0.6,
            background: p.color, borderRadius: 2,
            // @ts-expect-error CSS custom properties aren't in the CSSProperties type
            '--tx': `${Math.cos(p.angle) * p.dist}px`,
            '--ty': `${Math.sin(p.angle) * p.dist}px`,
            '--rot': `${p.rot}deg`,
            animation: `pitchConfetti 900ms ease-out ${p.delay}s both`,
          }}
        />
      ))}
    </div>
  )
}

// Wraps children in a card that tilts toward the cursor in 3D — used for the
// dashboard mockup so it reads as something tangible you can "pick up",
// rather than a flat screenshot.
function TiltCard({ children, style }: { children: ReactNode, style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    el.style.transform = `perspective(1200px) rotateY(${px * 6}deg) rotateX(${-py * 6}deg) scale3d(1.01,1.01,1.01)`
  }
  function onMouseLeave() {
    const el = ref.current
    if (!el) return
    el.style.transform = 'perspective(1200px) rotateY(0deg) rotateX(0deg) scale3d(1,1,1)'
  }
  return (
    <div ref={ref} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} style={{ transition: 'transform 0.15s ease-out', willChange: 'transform', ...style }}>
      {children}
    </div>
  )
}

// A button that nudges a couple pixels toward the cursor while hovered — a
// subtle "magnetic" feel on the one CTA we most want clicked.
function MagneticButton({ children, onClick, href, style }: { children: ReactNode, onClick?: () => void, href?: string, style?: React.CSSProperties }) {
  const ref = useRef<HTMLAnchorElement & HTMLButtonElement>(null)
  function onMouseMove(e: React.MouseEvent) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const mx = (e.clientX - rect.left - rect.width / 2) * 0.25
    const my = (e.clientY - rect.top - rect.height / 2) * 0.25
    el.style.transform = `translate(${mx}px, ${my - 3}px)`
  }
  function onMouseLeave() {
    if (ref.current) ref.current.style.transform = 'translate(0,0)'
  }
  const props = { ref, onMouseMove, onMouseLeave, className: 'pitch-btn-primary', style: { transition: 'transform 0.15s ease-out, box-shadow .2s', ...style } }
  if (href) return <a href={href} {...props}>{children}</a>
  return <button onClick={onClick} {...props}>{children}</button>
}

export default function PitchLandingPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ charity_name: '', contact_name: '', email: '', phone: '', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const heroRef = useRef<HTMLElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(el => { if (el.isIntersecting) el.target.classList.add('visible') })
    }, { threshold: 0.08 })
    document.querySelectorAll('.pitch-reveal, .pitch-chip').forEach(el => observer.observe(el))
    const onScroll = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const bar = document.getElementById('pitch-progress')
      if (bar) bar.style.width = `${docHeight > 0 ? (scrollTop / docHeight) * 100 : 0}%`
    }
    window.addEventListener('scroll', onScroll)
    return () => { observer.disconnect(); window.removeEventListener('scroll', onScroll) }
  }, [])

  function onHeroMouseMove(e: React.MouseEvent<HTMLElement>) {
    const el = heroRef.current
    const glow = glowRef.current
    if (!el || !glow) return
    const rect = el.getBoundingClientRect()
    glow.style.left = `${e.clientX - rect.left}px`
    glow.style.top = `${e.clientY - rect.top}px`
  }

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
        .pitch-page *,.pitch-page *::before,.pitch-page *::after{box-sizing:border-box}
        .pitch-page{
          --forest:#1B4332;--forest-deep:#0F2A1F;--sage:#40916C;--sage-light:#74C69D;
          --gold:#D4A017;--gold-light:#F0C84A;--ivory:#FAF7F2;--border:#E2D9CC;--muted:#6B6259;
          font-family:'Segoe UI',sans-serif;background:var(--ivory);color:#1C1C1C;overflow-x:hidden;
        }
        .pitch-page h1,.pitch-page h2{font-family:Georgia,serif;line-height:1.15}
        .pitch-serif{font-family:Georgia,serif}
        .pitch-nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:16px 32px;background:rgba(15,42,31,0.96);backdrop-filter:blur(20px);border-bottom:1px solid rgba(116,198,157,0.1)}
        .pitch-nav-link{color:rgba(255,255,255,0.6);font-size:13px;text-decoration:none;position:relative;padding-bottom:2px}
        .pitch-nav-link::after{content:'';position:absolute;bottom:0;left:0;width:0;height:1.5px;background:var(--gold);transition:width .3s ease}
        .pitch-nav-link:hover{color:white}
        .pitch-nav-link:hover::after{width:100%}
        .pitch-nav-cta{background:var(--gold);color:var(--forest-deep);padding:9px 18px;border-radius:100px;font-size:13px;font-weight:700;text-decoration:none;transition:transform .2s,box-shadow .2s;cursor:pointer}
        .pitch-nav-cta:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(212,160,23,0.35)}
        .pitch-hero{min-height:100svh;background:var(--forest-deep);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:120px 24px 72px;position:relative;overflow:hidden}
        .pitch-hero-texture{position:absolute;inset:0;background-image:radial-gradient(rgba(116,198,157,0.035) 1px,transparent 1px);background-size:28px 28px;pointer-events:none}
        .pitch-glow-1{position:absolute;top:-200px;left:50%;width:900px;height:600px;border-radius:50%;background:radial-gradient(ellipse,rgba(27,67,50,0.6) 0%,transparent 65%);pointer-events:none;animation:pitchDrift1 16s ease-in-out infinite}
        .pitch-glow-2{position:absolute;bottom:-100px;right:-100px;width:500px;height:500px;border-radius:50%;background:radial-gradient(ellipse,rgba(212,160,23,0.07) 0%,transparent 65%);pointer-events:none;animation:pitchDrift2 20s ease-in-out infinite}
        .pitch-cursor-glow{position:absolute;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(212,160,23,0.08) 0%,transparent 70%);pointer-events:none;transform:translate(-50%,-50%);transition:left .25s ease-out,top .25s ease-out;z-index:0}
        @keyframes pitchDrift1{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-46%) translateY(24px)}}
        @keyframes pitchDrift2{0%,100%{transform:translate(0,0)}50%{transform:translate(-24px,-18px)}}
        .pitch-leaf{position:absolute;font-size:18px;opacity:0;pointer-events:none;animation:pitchFloat linear infinite}
        @keyframes pitchFloat{
          0%{opacity:0;transform:translateY(0) translateX(0) rotate(0deg)}
          10%{opacity:0.5}
          90%{opacity:0.4}
          100%{opacity:0;transform:translateY(-620px) translateX(60px) rotate(340deg)}
        }
        .pitch-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.06);border:1px solid rgba(116,198,157,0.2);border-radius:100px;padding:8px 18px;font-size:13px;color:var(--sage-light);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:28px;animation:pitchFadeUp .7s ease both}
        .pitch-hero-title{font-size:clamp(32px,6vw,44px);font-weight:600;color:white;line-height:1.25;margin-bottom:24px;animation:pitchFadeUp .7s .1s ease both}
        .pitch-hero-title em{font-style:italic;background:linear-gradient(90deg,var(--gold-light),#fff6d8,var(--gold-light));background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:pitchShimmer 4s linear infinite}
        @keyframes pitchShimmer{to{background-position:200% center}}
        .pitch-hero-sub{font-size:clamp(14px,1.8vw,17px);color:rgba(255,255,255,0.5);line-height:1.85;max-width:460px;font-weight:300;animation:pitchFadeUp .7s .2s ease both}
        .pitch-hero-sub strong{color:rgba(255,255,255,0.85);font-weight:600}
        .pitch-hero-actions{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:32px;animation:pitchFadeUp .7s .3s ease both}
        .pitch-btn-primary{background:var(--gold);color:var(--forest-deep);padding:15px 32px;border-radius:100px;font-size:14px;font-weight:700;text-decoration:none;box-shadow:0 8px 32px rgba(212,160,23,0.3);display:inline-block;cursor:pointer;border:none}
        .pitch-btn-primary:hover{box-shadow:0 14px 40px rgba(212,160,23,0.5)}
        .pitch-btn-ghost{background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.75);padding:15px 32px;border-radius:100px;font-size:14px;font-weight:500;text-decoration:none;border:1px solid rgba(255,255,255,0.15);transition:all .2s;display:inline-block;cursor:pointer}
        .pitch-btn-ghost:hover{background:rgba(255,255,255,0.12);color:white;transform:translateY(-2px)}
        .pitch-hero-note{font-size:12px;color:rgba(255,255,255,0.45);margin-top:18px;animation:pitchFadeUp .7s .4s ease both}
        .pitch-trust-bar{padding:18px 32px;display:flex;align-items:center;justify-content:center;gap:28px;flex-wrap:wrap;background:#F0EBE1;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
        .pitch-trust-item{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--muted);letter-spacing:0.3px}
        .pitch-container{max-width:1080px;margin:0 auto;padding:0 24px}
        .pitch-eyebrow{font-size:12px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:var(--sage);margin-bottom:14px;display:block}
        .pitch-section-title{font-size:clamp(26px,4vw,38px);font-weight:700;color:var(--forest);line-height:1.2;margin-bottom:16px}
        .pitch-section-title em{font-style:italic;color:var(--sage)}
        .pitch-divider{width:44px;height:3px;background:var(--gold);border-radius:2px;margin:20px auto 24px}
        .pitch-reveal{opacity:0;transform:translateY(26px);transition:opacity .7s ease,transform .7s ease}
        .pitch-reveal.visible{opacity:1;transform:translateY(0)}
        .pitch-chip{opacity:0;transform:translateY(10px);transition:opacity .4s ease,transform .4s ease}
        .pitch-chip.visible{opacity:1;transform:translateY(0)}
        @keyframes pitchFadeUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pitchConfetti{
          from{transform:translate(-50%,-50%) rotate(0deg);opacity:1}
          to{transform:translate(calc(-50% + var(--tx)),calc(-50% + var(--ty))) rotate(var(--rot));opacity:0}
        }
        .pitch-progress{position:fixed;top:0;left:0;height:3px;width:0%;background:linear-gradient(90deg,var(--sage),var(--gold));z-index:200;transition:width .1s linear}
        .pitch-quote-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;max-width:860px;margin:0 auto 36px}
        .pitch-quote-card{transition:transform .3s ease,box-shadow .3s ease}
        .pitch-quote-card:hover{transform:translateY(-6px);box-shadow:0 16px 36px rgba(0,0,0,0.25)}
        .pitch-feature-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
        .pitch-feature-card{transition:transform .25s ease,box-shadow .25s ease,border-color .25s ease}
        .pitch-feature-card:hover{transform:translateY(-4px);box-shadow:0 14px 32px rgba(27,67,50,0.1);border-color:var(--sage)}
        .pitch-steps-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:0;position:relative;max-width:900px;margin:0 auto}
        .pitch-steps-grid::before{content:'';position:absolute;top:26px;left:12%;right:12%;height:1px;background:var(--border);z-index:0}
        .pitch-step{text-align:center;padding:0 10px;position:relative;z-index:1}
        .pitch-step-num{width:52px;height:52px;border-radius:50%;background:var(--forest);color:white;font-family:Georgia,serif;font-size:19px;font-weight:700;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;transition:transform .25s ease,background .25s ease}
        .pitch-step:hover .pitch-step-num{transform:scale(1.1);background:var(--sage)}
        .pitch-input{width:100%;padding:12px 14px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.25);border-radius:10px;color:white;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;transition:border-color .2s,background .2s}
        .pitch-input:focus{border-color:var(--gold);background:rgba(255,255,255,0.1)}
        .pitch-lbl{font-size:10px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:1.5px;text-transform:uppercase;display:block;margin-bottom:6px}
        .pitch-stat-tile{transition:transform .2s ease}
        .pitch-stat-tile:hover{transform:translateY(-3px)}
        @media (max-width: 900px) {
          .pitch-quote-grid{grid-template-columns:1fr}
          .pitch-feature-grid{grid-template-columns:1fr}
          .pitch-steps-grid{grid-template-columns:repeat(2,1fr);gap:24px}
          .pitch-steps-grid::before{display:none}
          .pitch-dashboard-mock{display:none !important}
          .pitch-nav-link{display:none}
          .pitch-leaf{display:none}
        }
      `}</style>

      <div className="pitch-progress" id="pitch-progress" />

      {/* ── NAV ── */}
      <div className="pitch-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={logo} style={{ width: 30, height: 30, objectFit: 'contain' }} />
          <span className="pitch-serif" style={{ fontWeight: 700, fontSize: 16, letterSpacing: '0.5px', color: 'white', textTransform: 'uppercase' }}>Giving Tree</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <a href="#features" className="pitch-nav-link">Features</a>
          <a href="#how-it-works" className="pitch-nav-link">How it works</a>
          <a href="#contact" className="pitch-nav-cta">Get started free</a>
        </div>
      </div>

      {/* ── HERO ── */}
      <section className="pitch-hero" ref={heroRef} onMouseMove={onHeroMouseMove}>
        <div className="pitch-hero-texture" />
        <div className="pitch-glow-1" />
        <div className="pitch-glow-2" />
        <div ref={glowRef} className="pitch-cursor-glow" style={{ left: '50%', top: '40%' }} />
        {LEAVES.map((leaf, i) => (
          <span key={i} className="pitch-leaf" style={{ left: `${8 + i * 13}%`, bottom: '-40px', animationDuration: `${14 + i * 2}s`, animationDelay: `${i * 1.8}s` }}>{leaf}</span>
        ))}

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 56, alignItems: 'center', maxWidth: 1040, width: '100%', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 460px', minWidth: 300, textAlign: 'left' }}>
            <div className="pitch-badge">✦ Free for Singapore charities</div>
            <h1 className="pitch-hero-title">The big charities have entire teams for this.<br /><em>Now you do too.</em></h1>
            <p className="pitch-hero-sub">A complete donation platform for IPC-registered Singapore charities — <strong>manual & online donations</strong>, <strong>auto receipts</strong>, <strong>IRAS export</strong>, <strong>donor analytics</strong>.</p>
            <div className="pitch-hero-actions">
              <MagneticButton href="#contact">Request a demo →</MagneticButton>
              <a href="#features" className="pitch-btn-ghost">See what it does</a>
            </div>
            <p className="pitch-hero-note">Zero contracts. Zero setup fees. We onboard you personally.</p>
          </div>

          {/* Light preview card floating beside the headline */}
          <div style={{ flex: '0 0 300px', minWidth: 260 }}>
            <TiltCard style={{ background: 'var(--ivory)', borderRadius: 20, border: '1px solid rgba(116,198,157,0.2)', boxShadow: '0 30px 70px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
              <div style={{ background: 'var(--forest)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#E27D60' }} />
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#E8C547' }} />
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#6FCF97' }} />
                <div style={{ marginLeft: 8, fontSize: 10.5, color: 'rgba(255,255,255,0.6)' }}>charity.givingtree.sg</div>
              </div>
              <div style={{ padding: 18 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
                  {[{ l: 'Raised', t: 48200, prefix: '$' }, { l: 'Donors', t: 312 }, { l: 'Pending', t: 3 }].map((s, i) => (
                    <div key={i} className="pitch-stat-tile" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 8px' }}>
                      <div style={{ fontSize: 8.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{s.l}</div>
                      <div className="pitch-serif" style={{ fontSize: 15, fontWeight: 700, color: 'var(--forest)' }}><CountUp target={s.t} prefix={s.prefix} /></div>
                    </div>
                  ))}
                </div>
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  {[['Tan Wei Ming', '$150', 'GIRO'], ['Cold Storage Supermarket', '$2,200', 'In-kind'], ['Marcus Ng', '$500', 'PayNow']].map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '9px 12px', borderBottom: i < 2 ? '1px solid #F0EBE1' : undefined, fontSize: 11.5 }}>
                      <span style={{ color: '#1C1C1C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r[0]}</span>
                      <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{r[2]}</span>
                      <span style={{ color: 'var(--forest)', fontWeight: 700, flexShrink: 0 }}>{r[1]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </TiltCard>
          </div>
        </div>
      </section>

      <div className="pitch-trust-bar">
        <div className="pitch-trust-item">🏛️ IPC-registered charities</div>
        <div className="pitch-trust-item">🧾 IRAS-ready export</div>
        <div className="pitch-trust-item">💳 PayNow · Cheque · Cash · Wire</div>
        <div className="pitch-trust-item">🔒 Funds direct to your UEN</div>
      </div>

      {/* ── WHO WE BUILT THIS FOR ── */}
      <section style={{ background: 'var(--forest)', padding: '80px 24px' }}>
        <div className="pitch-container" style={{ textAlign: 'center', maxWidth: 820, margin: '0 auto' }}>
          <div className="pitch-reveal">
            <span className="pitch-eyebrow" style={{ color: 'var(--sage-light)' }}>Who we built this for</span>
            <h2 className="pitch-serif" style={{ fontSize: 'clamp(24px,4vw,34px)', fontWeight: 600, color: 'white', lineHeight: 1.4, marginBottom: 18 }}>
              For the small teams carrying <em style={{ color: 'var(--gold-light)', fontStyle: 'italic' }}>big hearts.</em>
            </h2>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.85, fontWeight: 300, maxWidth: 580, margin: '0 auto 28px' }}>
              Behind every IPC-registered charity in Singapore is a small team doing extraordinary work — often without a finance team, a tech team, or even a full-time admin. Just people who care deeply, and not enough hours in the day.
            </p>
          </div>
          <div className="pitch-quote-grid">
            {PAIN_QUOTES.map((q, i) => (
              <div key={i} className="pitch-reveal pitch-quote-card" style={{ transitionDelay: `${i * 100}ms`, background: 'rgba(255,255,255,0.05)', borderTop: '3px solid var(--gold)', borderRadius: 12, padding: '24px 20px', textAlign: 'center' }}>
                <p className="pitch-serif" style={{ fontSize: 14.5, fontStyle: 'italic', color: 'rgba(255,255,255,0.85)', lineHeight: 1.8, margin: 0 }}>{q}</p>
              </div>
            ))}
          </div>
          <div className="pitch-reveal" style={{ display: 'inline-block', background: 'rgba(212,160,23,0.12)', border: '1px solid rgba(212,160,23,0.3)', borderRadius: 100, padding: '12px 28px' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--gold-light)' }}>Giving Tree was built for them. And it's completely free.</span>
          </div>
        </div>
      </section>

      {/* ── FEATURES + DASHBOARD MOCK ── */}
      <section id="features" style={{ background: 'white', padding: '80px 24px' }}>
        <div className="pitch-container">
          <div className="pitch-reveal" style={{ textAlign: 'center', marginBottom: 44 }}>
            <span className="pitch-eyebrow">What we built for you</span>
            <h2 className="pitch-section-title">Everything you need. <em>One dashboard.</em></h2>
            <div className="pitch-divider" />
            <p style={{ fontSize: 14.5, color: 'var(--muted)', lineHeight: 1.85, fontWeight: 300, maxWidth: 480, margin: '0 auto' }}>Capture every donation on your dashboard — every donor recognised, every receipt issued, every thank-you sent.</p>
          </div>

          {/* Fake "browser window" dashboard mockup, tilts toward the cursor */}
          <TiltCard style={{ marginBottom: 12 }}>
            <div className="pitch-dashboard-mock pitch-reveal" style={{ background: '#1e1e1e', borderRadius: 16, overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.25)' }}>
              <div style={{ background: '#2d2d2d', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#FF5F57' }} />
                  <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#FFBD2E' }} />
                  <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#28C840' }} />
                </div>
                <div style={{ flex: 1, background: '#1e1e1e', borderRadius: 6, padding: '5px 12px', fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>charity.givingtree.sg</div>
              </div>
              <div style={{ display: 'flex', height: 460, fontFamily: "'Segoe UI',sans-serif", fontSize: 13 }}>
                <div style={{ width: 190, background: '#1B4332', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                  <div style={{ padding: '18px 14px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 22, height: 22, background: 'rgba(255,255,255,0.1)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>🌳</div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'white' }}>Giving Tree</div>
                    </div>
                    <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.3)', letterSpacing: 1, textTransform: 'uppercase', marginLeft: 30, marginTop: 2 }}>Charity Portal</div>
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    {[['📊', 'Dashboard', true], ['💳', 'Donations'], ['📈', 'Analytics'], ['👥', 'Donors'], ['🏛️', 'IRAS Export']].map(([icon, label, active], i) => (
                      <div key={i} style={{ background: active ? '#40916C' : 'transparent', borderRadius: 8, padding: '7px 9px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 12.5 }}>{icon}</span>
                        <span style={{ fontSize: 11.5, fontWeight: active ? 600 : 400, color: active ? 'white' : 'rgba(255,255,255,0.55)' }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1, background: '#FAF7F2', overflow: 'hidden', padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#1B4332' }}>Good afternoon 👋</div>
                      <div style={{ fontSize: 10.5, color: '#7A6E62', marginTop: 2 }}>Here's your donation overview for 2026</div>
                    </div>
                    <div style={{ background: '#1B4332', color: 'white', borderRadius: 20, padding: '5px 12px', fontSize: 10.5, fontWeight: 700 }}>2026</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 9, marginBottom: 12 }}>
                    {[{ l: 'Total received', t: 48200, prefix: '$', dark: true }, { l: 'Unique donors', t: 312 }, { l: 'Avg. donation', t: 154, prefix: '$' }, { l: 'Receipts pending', t: 3, warn: true }].map((s, i) => (
                      <div key={i} className="pitch-stat-tile" style={{ background: s.dark ? '#1B4332' : s.warn ? '#FDF3DC' : 'white', border: s.dark ? undefined : `1.5px solid ${s.warn ? '#E8CC7A' : '#E2D9CC'}`, borderRadius: 10, padding: 11 }}>
                        <div style={{ fontSize: 8.5, color: s.dark ? 'rgba(255,255,255,0.6)' : s.warn ? '#A07010' : '#7A6E62', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{s.l}</div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: s.dark ? 'white' : s.warn ? '#A07010' : '#1B4332' }}><CountUp target={s.t} prefix={s.prefix} /></div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: 'white', borderRadius: 10, border: '1.5px solid #E2D9CC', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#1B4332', borderBottom: '1px solid #E2D9CC' }}>Recent Donations</div>
                    {[['A', 'Alicia Lim', '$500', '✓ Issued', true], ['J', 'James Tan', '$250', 'Pending', false], ['P', 'Priya Nair', '$100', '✓ Issued', true]].map((r, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: i < 2 ? '1px solid #F0EBE1' : undefined }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#40916C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white', flexShrink: 0 }}>{r[0]}</div>
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: '#1B4332', flex: 1 }}>{r[1]}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#1B4332' }}>{r[2]}</span>
                        <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: r[4] ? '#EEF6F1' : '#FDF3DC', color: r[4] ? '#40916C' : '#A07010' }}>{r[3]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </TiltCard>
          <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginBottom: 32 }}>Illustrative preview — not a live screenshot.</div>

          <div className="pitch-feature-grid">
            {FEATURE_CARDS.map((f, i) => (
              <div key={i} className="pitch-reveal pitch-feature-card" style={{ transitionDelay: `${(i % 2) * 90}ms`, display: 'flex', gap: 14, padding: 22, background: 'white', border: '1.5px solid var(--border)', borderRadius: 16 }}>
                <div style={{ width: 4, background: 'var(--gold)', borderRadius: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--forest)', marginBottom: 5 }}>{f.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STEPS ── */}
      <section id="how-it-works" style={{ background: 'var(--ivory)', padding: '80px 24px' }}>
        <div className="pitch-container">
          <div className="pitch-reveal" style={{ textAlign: 'center', marginBottom: 48 }}>
            <span className="pitch-eyebrow">Getting started</span>
            <h2 className="pitch-section-title">Up and running <em>in under 24 hours.</em></h2>
            <div className="pitch-divider" />
          </div>
          <div className="pitch-steps-grid">
            {STEPS.map((s, i) => (
              <div key={s.n} className="pitch-reveal pitch-step" style={{ transitionDelay: `${i * 100}ms` }}>
                <div className="pitch-step-num">{s.n}</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--forest)', marginBottom: 7 }}>{s.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.65 }}>{s.desc}</div>
                <div style={{ display: 'inline-block', background: s.good ? '#EEF6F1' : s.warm ? '#FDF8EC' : 'var(--ivory)', border: `1px solid ${s.good ? '#74C69D' : s.warm ? '#E8CC7A' : 'var(--border)'}`, borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 600, color: s.good ? 'var(--sage)' : s.warm ? '#A07010' : 'var(--muted)', marginTop: 12 }}>{s.tag}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIAL ── */}
      <section style={{ background: 'var(--forest-deep)', padding: '80px 24px', textAlign: 'center' }}>
        <div className="pitch-container pitch-reveal" style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ fontSize: 28, marginBottom: 20 }}>💚</div>
          <blockquote className="pitch-serif" style={{ fontSize: 'clamp(18px,3vw,26px)', fontStyle: 'italic', color: 'white', lineHeight: 1.6, margin: '0 auto 20px', fontWeight: 400 }}>
            "The charities doing the most <em style={{ color: 'var(--gold-light)', fontStyle: 'normal' }}>important</em> work in Singapore are often the ones with the least support. We built Giving Tree to change that."
          </blockquote>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 2, textTransform: 'uppercase' }}>— The Giving Tree Team</div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" style={{ background: 'var(--forest)', padding: '96px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', fontSize: 360, opacity: 0.03, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none', lineHeight: 1 }}>🌳</div>
        <div className="pitch-reveal" style={{ position: 'relative', zIndex: 1, maxWidth: 520, margin: '0 auto' }}>
          <h2 className="pitch-serif" style={{ fontSize: 'clamp(26px,4vw,38px)', fontWeight: 700, color: 'white', lineHeight: 1.2, marginBottom: 14 }}>Your cause deserves<br />to be <em style={{ color: 'var(--gold-light)', fontStyle: 'italic' }}>found.</em></h2>
          <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.5)', fontWeight: 300, lineHeight: 1.8, marginBottom: 36 }}>If you're an IPC-registered charity in Singapore, we'd love to have you. It takes 5 minutes to get started, and it's completely free.</p>

          {sent ? (
            <div style={{ position: 'relative', background: 'rgba(64,145,108,0.15)', border: '1px solid #40916C', borderRadius: 16, padding: '24px 28px', fontSize: 14, color: 'white', lineHeight: 1.7, textAlign: 'left', overflow: 'visible' }}>
              <ConfettiBurst />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <span style={{ fontSize: 20, marginRight: 8 }}>🎉</span>
                Thanks — we've got your request and will be in touch shortly. In the meantime, feel free to email <span style={{ color: 'var(--gold-light)' }}>hello@givingtree.sg</span> directly.
              </div>
            </div>
          ) : (
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: 32, textAlign: 'left' }}>
              {error && (
                <div style={{ background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.3)', color: '#FF7B6B', padding: '10px 14px', borderRadius: 10, fontSize: 12.5, marginBottom: 16 }}>{error}</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="pitch-lbl">Your name</label>
                  <input className="pitch-input" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="Jane Tan" />
                </div>
                <div>
                  <label className="pitch-lbl">Charity name</label>
                  <input className="pitch-input" value={form.charity_name} onChange={e => setForm(f => ({ ...f, charity_name: e.target.value }))} placeholder="Your charity" />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label className="pitch-lbl">Email</label>
                <input className="pitch-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@charity.org.sg" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label className="pitch-lbl">Phone (optional)</label>
                <input className="pitch-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+65 1234 5678" />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label className="pitch-lbl">Message (optional)</label>
                <textarea className="pitch-input" style={{ minHeight: 72, resize: 'vertical' }} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Tell us a bit about your charity and what you'd like help with..." />
              </div>
              <MagneticButton onClick={submitDemoRequest} style={{ width: '100%', textAlign: 'center', opacity: sending ? 0.7 : 1 }}>
                {sending ? 'Sending...' : 'Get in touch →'}
              </MagneticButton>
            </div>
          )}
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 22, lineHeight: 1.7 }}>
            Or write directly to <a href="mailto:hello@givingtree.sg" style={{ color: 'rgba(255,255,255,0.5)' }}>hello@givingtree.sg</a><br />
            Already have an account? <span onClick={() => navigate('/dashboard')} style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'underline', cursor: 'pointer' }}>Sign in here</span>
          </p>
        </div>
      </section>

      <footer style={{ background: '#080F0A', padding: '24px 32px', textAlign: 'center', fontSize: 11.5, color: 'rgba(255,255,255,0.4)' }}>
        © {new Date().getFullYear()} Giving Tree · hello@givingtree.sg
      </footer>
    </div>
  )
}
