import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import logo from '../assets/logo.png'

const PAIN_QUOTES = [
  { q: '"I\'m a volunteer. Doing this admin was never part of the job."', tag: 'Volunteer treasurer' },
  { q: '"Our cash donations are in an envelope. I don\'t know how to issue receipts for 200 donors."', tag: 'Programme lead' },
  { q: '"We do incredible work in our community. Nobody outside our circle knows we exist."', tag: 'Founder' },
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
  { n: 1, title: 'Reach out to us', desc: 'Email us at hello@givingtree.sg with your charity name and UEN. That\'s all we need.', tag: '5 minutes' },
  { n: 2, title: 'We set you up', desc: 'Your dashboard is live within 24 hours, configured around how your team already works.', tag: '24 hours' },
  { n: 3, title: 'Go live', desc: 'Log in and start logging donations, issuing receipts, and tracking donors straight away.', tag: 'You\'re live' },
  { n: 4, title: 'Run your season', desc: 'Come tax time, your IRAS export is one click away — not a scramble through spreadsheets.', tag: 'Ready for IRAS' },
]

const ROTATE_WORDS = ['donations.', 'receipts.', 'donors.', 'pledges.', 'IRAS export.']

const TOUR_SLIDES = [
  { key: 'Dashboard', icon: '📊', title: 'One dashboard, the whole picture', desc: 'Total raised, unique donors, and what still needs a receipt — the moment you log in.' },
  { key: 'Donations', icon: '💳', title: 'Every donation, however it arrives', desc: 'Cash, cheque, bank wire, PayNow, GIRO — logged once, tracked forever.' },
  { key: 'Analytics', icon: '📈', title: 'Analytics that actually explain your year', desc: 'Retention, campaign performance, and giving trends — built for a small team, not a data analyst.' },
  { key: 'IRAS Export', icon: '🏛️', title: 'IRAS export, one click away', desc: 'A fully formatted file for myTax Portal. No more scrambling every 31 January.' },
]

const CONFETTI_COLORS = ['#163B2A', '#E8A93B', '#F3D9A0', '#fff']

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

function TiltCard({ children, style, baseRotate = 0 }: { children: ReactNode, style?: React.CSSProperties, baseRotate?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    el.style.transform = `perspective(1200px) rotate(${baseRotate}deg) rotateY(${px * 6}deg) rotateX(${-py * 6}deg) scale3d(1.01,1.01,1.01)`
  }
  function onMouseLeave() {
    const el = ref.current
    if (!el) return
    el.style.transform = `perspective(1200px) rotate(${baseRotate}deg) rotateY(0deg) rotateX(0deg) scale3d(1,1,1)`
  }
  return (
    <div ref={ref} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} style={{ transition: 'transform 0.15s ease-out', willChange: 'transform', transform: `rotate(${baseRotate}deg)`, ...style }}>
      {children}
    </div>
  )
}

function MagneticButton({ children, onClick, href, className, style }: { children: ReactNode, onClick?: () => void, href?: string, className: string, style?: React.CSSProperties }) {
  const ref = useRef<HTMLAnchorElement & HTMLButtonElement>(null)
  function onMouseMove(e: React.MouseEvent) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const mx = (e.clientX - rect.left - rect.width / 2) * 0.22
    const my = (e.clientY - rect.top - rect.height / 2) * 0.22
    el.style.transform = `translate(${mx}px, ${my}px)`
  }
  function onMouseLeave() {
    if (ref.current) ref.current.style.transform = 'translate(0,0)'
  }
  const props = { ref, onMouseMove, onMouseLeave, className, style: { transition: 'transform 0.15s ease-out', ...style } }
  if (href) return <a href={href} {...props}>{children}</a>
  return <button onClick={onClick} {...props}>{children}</button>
}

function TourSidebar({ activeKey }: { activeKey: string }) {
  return (
    <div style={{ width: 190, background: '#163B2A', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '18px 14px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 22, height: 22, background: 'rgba(255,255,255,0.1)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>🌳</div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: 'white' }}>Giving Tree</div>
        </div>
        <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.35)', letterSpacing: 1, textTransform: 'uppercase', marginLeft: 30, marginTop: 2 }}>Charity Portal</div>
      </div>
      <div style={{ padding: '8px 10px' }}>
        {TOUR_SLIDES.map(s => (
          <div key={s.key} style={{ background: s.key === activeKey ? '#E8A93B' : 'transparent', borderRadius: 8, padding: '7px 9px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, transition: 'background .3s ease' }}>
            <span style={{ fontSize: 12.5 }}>{s.icon}</span>
            <span style={{ fontSize: 11.5, fontWeight: s.key === activeKey ? 800 : 500, color: s.key === activeKey ? '#163B2A' : 'rgba(255,255,255,0.6)' }}>{s.key}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TourDashboardPane() {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#14201A' }}>Good afternoon 👋</div>
          <div style={{ fontSize: 10.5, color: '#6b6259', marginTop: 2 }}>Here's your donation overview for 2026</div>
        </div>
        <div style={{ background: '#163B2A', color: 'white', borderRadius: 20, padding: '5px 12px', fontSize: 10.5, fontWeight: 800 }}>2026</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 9, marginBottom: 12 }}>
        {[{ l: 'Total received', t: 48200, prefix: '$', dark: true }, { l: 'Unique donors', t: 312 }, { l: 'Avg. donation', t: 154, prefix: '$' }, { l: 'Receipts pending', t: 3, warn: true }].map((s, i) => (
          <div key={i} className="pitch-stat-tile" style={{ background: s.dark ? '#163B2A' : s.warn ? '#FBF0DA' : 'white', border: s.dark ? undefined : `1.5px solid ${s.warn ? '#E8A93B' : '#E5E0D0'}`, borderRadius: 10, padding: 11 }}>
            <div style={{ fontSize: 8.5, color: s.dark ? 'rgba(255,255,255,0.6)' : s.warn ? '#8a5a10' : '#6b6259', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{s.l}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: s.dark ? 'white' : s.warn ? '#8a5a10' : '#14201A' }}><CountUp target={s.t} prefix={s.prefix} /></div>
          </div>
        ))}
      </div>
      <div style={{ background: 'white', borderRadius: 10, border: '1.5px solid #E5E0D0', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', fontSize: 11, fontWeight: 800, color: '#14201A', borderBottom: '1px solid #E5E0D0' }}>Recent Donations</div>
        {[['A', 'Alicia Lim', '$500', '✓ Issued', true], ['J', 'James Tan', '$250', 'Pending', false], ['P', 'Priya Nair', '$100', '✓ Issued', true]].map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: i < 2 ? '1px solid #F0EDE0' : undefined }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#163B2A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'white', flexShrink: 0 }}>{r[0]}</div>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#14201A', flex: 1 }}>{r[1]}</span>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#14201A' }}>{r[2]}</span>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: r[4] ? '#E6F2EA' : '#FBF0DA', color: r[4] ? '#1f7a48' : '#8a5a10' }}>{r[3]}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function TourDonationsPane() {
  const rows: [string, string, string, string, boolean][] = [
    ['A', 'Alicia Lim', '$500', 'PayNow', true],
    ['J', 'James Tan', '$250', 'Bank Wire', false],
    ['C', 'Cold Storage Supermarket', '$2,200', 'In-kind', true],
    ['M', 'Marcus Ng', '$150', 'GIRO', true],
    ['S', 'Sarah Chen', '$200', 'Cash', false],
  ]
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#14201A' }}>Donations</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ background: 'white', border: '1.5px solid #E5E0D0', borderRadius: 8, padding: '5px 10px', fontSize: 10, color: '#6b6259' }}>🔍 Search</div>
          <div style={{ background: '#163B2A', color: 'white', borderRadius: 8, padding: '5px 12px', fontSize: 10, fontWeight: 800 }}>+ New Entry</div>
        </div>
      </div>
      <div style={{ background: 'white', borderRadius: 10, border: '1.5px solid #E5E0D0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', padding: '8px 14px', background: '#FBF8F0', borderBottom: '1px solid #E5E0D0', fontSize: 9, fontWeight: 800, color: '#6b6259', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          <div style={{ flex: 1 }}>Donor</div><div style={{ width: 70 }}>Amount</div><div style={{ width: 70 }}>Method</div><div style={{ width: 60 }}>Receipt</div>
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderBottom: i < rows.length - 1 ? '1px solid #F0EDE0' : undefined }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#163B2A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: 'white', flexShrink: 0 }}>{r[0]}</div>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#14201A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r[1]}</span>
            </div>
            <div style={{ width: 70, fontSize: 10.5, fontWeight: 800, color: '#14201A' }}>{r[2]}</div>
            <div style={{ width: 70, fontSize: 10, color: '#6b6259' }}>{r[3]}</div>
            <div style={{ width: 60 }}><span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: r[4] ? '#E6F2EA' : '#FBF0DA', color: r[4] ? '#1f7a48' : '#8a5a10' }}>{r[4] ? '✓ Issued' : 'Pending'}</span></div>
          </div>
        ))}
      </div>
    </>
  )
}

function TourAnalyticsPane() {
  const bars = [40, 65, 50, 80, 60, 95, 72]
  return (
    <>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#14201A', marginBottom: 2 }}>Fundraising performance</div>
      <div style={{ fontSize: 10.5, color: '#6b6259', marginBottom: 14 }}>Last 7 months</div>
      <div style={{ background: 'white', border: '1.5px solid #E5E0D0', borderRadius: 10, padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 110 }}>
          {bars.map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h}%`, background: i === 5 ? '#E8A93B' : '#163B2A', borderRadius: '4px 4px 0 0' }} />
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9 }}>
        {[{ l: 'Donor retention', t: 68, suffix: '%' }, { l: 'Repeat donors', t: 142 }, { l: 'Avg. gift growth', t: 12, suffix: '%' }].map((s, i) => (
          <div key={i} className="pitch-stat-tile" style={{ background: 'white', border: '1.5px solid #E5E0D0', borderRadius: 10, padding: 11 }}>
            <div style={{ fontSize: 8.5, color: '#6b6259', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{s.l}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#14201A' }}><CountUp target={s.t} suffix={s.suffix} /></div>
          </div>
        ))}
      </div>
    </>
  )
}

function TourIrasPane() {
  return (
    <>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#14201A', marginBottom: 2 }}>IRAS Export — YA2027</div>
      <div style={{ fontSize: 10.5, color: '#6b6259', marginBottom: 14 }}>Formatted and ready for myTax Portal</div>
      <div style={{ background: 'white', border: '1.5px solid #E5E0D0', borderRadius: 10, padding: 18, marginBottom: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 30, marginBottom: 8 }}>🏛️</div>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#14201A', marginBottom: 4 }}>312 donors · $48,200 tax-deductible</div>
        <div style={{ fontSize: 10, color: '#6b6259', marginBottom: 14 }}>All NRICs verified, no gaps flagged</div>
        <div style={{ display: 'inline-block', background: '#163B2A', color: 'white', borderRadius: 8, padding: '8px 20px', fontSize: 11, fontWeight: 800 }}>⬇ Download IRAS File</div>
      </div>
      <div style={{ background: '#E6F2EA', border: '1px solid #74C69D', borderRadius: 10, padding: '10px 14px', fontSize: 10.5, color: '#1f7a48', fontWeight: 700 }}>✓ 0 donors missing an NRIC this year</div>
    </>
  )
}

const TOUR_PANES = [TourDashboardPane, TourDonationsPane, TourAnalyticsPane, TourIrasPane]

function ProductTour() {
  const [active, setActive] = useState(0)
  const [hovered, setHovered] = useState(false)
  useEffect(() => {
    if (hovered) return
    const id = setInterval(() => setActive(a => (a + 1) % TOUR_SLIDES.length), 4500)
    return () => clearInterval(id)
  }, [hovered])
  const Pane = TOUR_PANES[active]
  const slide = TOUR_SLIDES[active]
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="pitch-reveal" style={{ textAlign: 'center', marginBottom: 20 }}>
        <div key={slide.key} className="pitch-tour-caption" style={{ fontSize: 18, fontWeight: 800, color: '#14201A', marginBottom: 4, letterSpacing: '-0.3px' }}>{slide.title}</div>
        <div key={slide.key + '-d'} className="pitch-tour-caption" style={{ fontSize: 13, color: '#6b6259' }}>{slide.desc}</div>
      </div>

      <TiltCard style={{ marginBottom: 16 }}>
        <div className="pitch-dashboard-mock pitch-reveal" style={{ background: '#14201A', borderRadius: 16, overflow: 'hidden', boxShadow: '0 40px 100px rgba(20,32,26,0.22)' }}>
          <div style={{ background: '#1c2c22', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#FF5F57' }} />
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#FFBD2E' }} />
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#28C840' }} />
            </div>
            <div style={{ flex: 1, background: '#14201A', borderRadius: 6, padding: '5px 12px', fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>charity.givingtree.sg</div>
          </div>
          <div style={{ display: 'flex', height: 460, fontFamily: "-apple-system,'Segoe UI',sans-serif", fontSize: 13 }}>
            <TourSidebar activeKey={slide.key} />
            <div key={slide.key + '-pane'} className="pitch-tour-pane" style={{ flex: 1, background: '#FBF8F0', overflow: 'hidden', padding: 18 }}>
              <Pane />
            </div>
          </div>
        </div>
      </TiltCard>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
        {TOUR_SLIDES.map((s, i) => (
          <button
            key={s.key}
            aria-label={`Show ${s.key}`}
            onClick={() => setActive(i)}
            style={{
              width: i === active ? 22 : 8, height: 8, borderRadius: 100, border: 'none', cursor: 'pointer',
              background: i === active ? '#E8A93B' : '#DCD5BE', transition: 'width .3s ease,background .3s ease',
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default function PitchLandingPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ charity_name: '', contact_name: '', email: '', phone: '', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [wordIndex, setWordIndex] = useState(0)
  const [wordsPaused, setWordsPaused] = useState(false)

  useEffect(() => {
    if (wordsPaused) return
    const id = setInterval(() => setWordIndex(i => (i + 1) % ROTATE_WORDS.length), 2200)
    return () => clearInterval(id)
  }, [wordsPaused])

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(el => { if (el.isIntersecting) el.target.classList.add('visible') })
    }, { threshold: 0.08 })
    document.querySelectorAll('.pitch-reveal').forEach(el => observer.observe(el))
    const onScroll = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const bar = document.getElementById('pitch-progress')
      if (bar) bar.style.width = `${docHeight > 0 ? (scrollTop / docHeight) * 100 : 0}%`
    }
    window.addEventListener('scroll', onScroll)
    return () => { observer.disconnect(); window.removeEventListener('scroll', onScroll) }
  }, [])

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
          --forest:#163B2A;--forest-deep:#0F2A1F;--amber:#E8A93B;--amber-deep:#8a5a10;
          --cream:#FBF8F0;--ink:#14201A;--muted:#6b6259;--border:#E5E0D0;
          font-family:-apple-system,'Segoe UI','Helvetica Neue',sans-serif;background:var(--cream);color:var(--ink);overflow-x:hidden;
        }
        .pitch-page h1,.pitch-page h2{font-weight:800;letter-spacing:-0.5px;line-height:1.05}
        .pitch-nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:16px 32px;background:rgba(20,32,26,0.92);backdrop-filter:blur(16px)}
        .pitch-nav-link{color:rgba(255,255,255,0.65);font-size:13.5px;font-weight:600;text-decoration:none}
        .pitch-nav-link:hover{color:white}
        .pitch-nav-cta{background:white;color:var(--forest);padding:10px 20px;border-radius:100px;font-size:13.5px;font-weight:800;text-decoration:none;transition:transform .2s}
        .pitch-nav-cta:hover{transform:translateY(-2px)}
        .pitch-hero{position:relative;overflow:hidden;padding:112px 6vw 90px;background:linear-gradient(118deg,var(--forest) 0 44%,var(--amber) 44% 100%)}
        .pitch-hero-grid{position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.05) 1px,transparent 1px);background-size:46px 46px}
        .pitch-hero-inner{position:relative;z-index:1;display:flex;gap:48px;align-items:center;max-width:1180px;margin:0 auto;flex-wrap:wrap}
        .pitch-eyebrow-pill{display:inline-block;background:var(--forest-deep);color:#F3D9A0;font-size:11.5px;font-weight:800;letter-spacing:0.5px;padding:7px 16px;border-radius:100px;margin-bottom:24px;animation:pitchFadeUp .6s ease both}
        .pitch-hero-title{font-size:clamp(34px,4.6vw,52px);color:white;margin-bottom:22px;text-wrap:balance;animation:pitchFadeUp .6s .08s ease both}
        .pitch-hero-title .fg{color:var(--forest)}
        .pitch-rotate-wrap{display:inline-block;overflow:hidden;vertical-align:top}
        .pitch-rotate-word{display:inline-block;background:var(--forest-deep);color:var(--amber);padding:2px 12px;border-radius:6px;animation:pitchWordIn .5s cubic-bezier(.2,.9,.3,1) both}
        @keyframes pitchWordIn{from{opacity:0;transform:translateY(60%)}to{opacity:1;transform:translateY(0)}}
        .pitch-hero-sub{font-size:16px;line-height:1.7;color:rgba(255,255,255,0.85);max-width:440px;font-weight:500;animation:pitchFadeUp .6s .16s ease both}
        .pitch-hero-actions{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:30px;animation:pitchFadeUp .6s .24s ease both}
        .pitch-btn-primary{background:white;color:var(--forest);padding:16px 30px;border-radius:100px;font-size:14.5px;font-weight:800;text-decoration:none;display:inline-block;cursor:pointer;border:none;box-shadow:0 10px 30px rgba(0,0,0,0.15)}
        .pitch-btn-ghost{background:transparent;color:white;padding:15px 28px;border-radius:100px;font-size:14.5px;font-weight:700;text-decoration:none;border:2px solid rgba(255,255,255,0.45);display:inline-block;cursor:pointer;transition:background .2s,border-color .2s}
        .pitch-btn-ghost:hover{background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.7)}
        .pitch-pause-btn{background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.25);color:rgba(255,255,255,0.8);width:38px;height:38px;border-radius:50%;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;transition:background .2s}
        .pitch-pause-btn:hover{background:rgba(255,255,255,0.2)}
        .pitch-hero-note{font-size:12.5px;color:rgba(255,255,255,0.65);margin-top:16px;font-weight:600;animation:pitchFadeUp .6s .3s ease both}
        @keyframes pitchFadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .pitch-hero-preview{flex:0 0 340px;min-width:280px}
        @keyframes pitchConfetti{from{transform:translate(-50%,-50%) rotate(0deg);opacity:1}to{transform:translate(calc(-50% + var(--tx)),calc(-50% + var(--ty))) rotate(var(--rot));opacity:0}}
        .pitch-progress{position:fixed;top:0;left:0;height:3px;width:0%;background:linear-gradient(90deg,var(--forest),var(--amber));z-index:200;transition:width .1s linear}
        .pitch-trust-bar{padding:16px 32px;display:flex;align-items:center;justify-content:center;gap:26px;flex-wrap:wrap;background:var(--cream);border-bottom:1px solid var(--border)}
        .pitch-trust-item{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--muted)}
        .pitch-container{max-width:1080px;margin:0 auto;padding:0 24px}
        .pitch-section-eyebrow{display:inline-block;font-size:11.5px;font-weight:800;letter-spacing:0.5px;padding:6px 14px;border-radius:100px;margin-bottom:18px}
        .pitch-section-title{font-size:clamp(26px,3.6vw,38px);color:var(--ink);margin-bottom:16px;text-wrap:balance}
        .pitch-reveal{opacity:0;transform:translateY(24px);transition:opacity .6s ease,transform .6s ease}
        .pitch-reveal.visible{opacity:1;transform:translateY(0)}
        .pitch-quote-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;max-width:900px;margin:0 auto 32px}
        .pitch-quote-card{transition:transform .3s ease,box-shadow .3s ease;background:rgba(255,255,255,0.06);border-radius:16px;padding:26px 22px;text-align:left}
        .pitch-quote-card:hover{transform:translateY(-6px)}
        .pitch-feature-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
        .pitch-feature-card{transition:transform .25s ease,box-shadow .25s ease,border-color .25s ease}
        .pitch-feature-card:hover{transform:translateY(-4px);box-shadow:0 14px 32px rgba(20,32,26,0.1);border-color:var(--forest)}
        .pitch-steps-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;max-width:960px;margin:0 auto}
        .pitch-step-card{background:white;border-radius:16px;padding:24px 20px;text-align:left}
        .pitch-step-num{width:38px;height:38px;border-radius:10px;background:var(--forest);color:white;font-weight:800;font-size:16px;display:flex;align-items:center;justify-content:center;margin-bottom:16px}
        .pitch-input{width:100%;padding:13px 16px;background:white;border:2px solid var(--border);border-radius:12px;color:var(--ink);font-size:13.5px;font-family:inherit;outline:none;box-sizing:border-box;transition:border-color .2s}
        .pitch-input:focus{border-color:var(--forest)}
        .pitch-lbl{font-size:11px;font-weight:800;color:var(--muted);letter-spacing:0.5px;display:block;margin-bottom:6px}
        .pitch-stat-tile{transition:transform .2s ease}
        .pitch-stat-tile:hover{transform:translateY(-3px)}
        .pitch-tour-caption{animation:pitchFadeUp .4s ease both}
        .pitch-tour-pane{animation:pitchFadeUp .4s ease both}
        @media (max-width: 900px) {
          .pitch-quote-grid{grid-template-columns:1fr}
          .pitch-feature-grid{grid-template-columns:1fr}
          .pitch-steps-grid{grid-template-columns:repeat(2,1fr)}
          .pitch-dashboard-mock{display:none !important}
          .pitch-nav-link{display:none}
          .pitch-hero{background:var(--forest)}
        }
      `}</style>

      <div className="pitch-progress" id="pitch-progress" />

      {/* ── NAV ── */}
      <div className="pitch-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={logo} style={{ width: 30, height: 30, objectFit: 'contain' }} />
          <span style={{ fontWeight: 800, fontSize: 16, color: 'white' }}>Giving Tree</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <a href="#features" className="pitch-nav-link">Features</a>
          <a href="#how-it-works" className="pitch-nav-link">How it works</a>
          <a href="#contact" className="pitch-nav-cta">Get started free</a>
        </div>
      </div>

      {/* ── HERO ── */}
      <section className="pitch-hero">
        <div className="pitch-hero-grid" />
        <div className="pitch-hero-inner">
          <div style={{ flex: '1 1 460px', minWidth: 300 }}>
            <div className="pitch-eyebrow-pill">✦ Free for Singapore charities</div>
            <h1 className="pitch-hero-title">
              Run your charity's<br />
              <span className="pitch-rotate-wrap"><span key={wordIndex} className="pitch-rotate-word">{ROTATE_WORDS[wordIndex]}</span></span>
            </h1>
            <p className="pitch-hero-sub">A complete donation platform for IPC-registered Singapore charities — manual and online donations, auto receipts, IRAS export, donor analytics.</p>
            <div className="pitch-hero-actions">
              <MagneticButton href="#contact" className="pitch-btn-primary">Request a demo →</MagneticButton>
              <a href="#features" className="pitch-btn-ghost">See what it does</a>
              <button onClick={() => setWordsPaused(p => !p)} className="pitch-pause-btn" aria-label={wordsPaused ? 'Resume animation' : 'Pause animation'}>
                {wordsPaused ? '▶' : '⏸'}
              </button>
            </div>
            <p className="pitch-hero-note">Zero contracts. Zero setup fees. We onboard you personally.</p>
          </div>

          <div className="pitch-hero-preview">
            <TiltCard baseRotate={4} style={{ background: '#14201A', borderRadius: 18, overflow: 'hidden', boxShadow: '0 40px 90px rgba(0,0,0,0.4)' }}>
              <div style={{ background: '#1c2c22', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#E27D60' }} />
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#E8C547' }} />
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#6FCF97' }} />
                <div style={{ marginLeft: 8, fontSize: 10.5, color: 'rgba(255,255,255,0.5)' }}>charity.givingtree.sg</div>
              </div>
              <div style={{ padding: 18 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
                  {[{ l: 'Raised', t: 48200, prefix: '$' }, { l: 'Donors', t: 312 }, { l: 'Pending', t: 3 }].map((s, i) => (
                    <div key={i} className="pitch-stat-tile" style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '9px 8px' }}>
                      <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{s.l}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--amber)' }}><CountUp target={s.t} prefix={s.prefix} /></div>
                    </div>
                  ))}
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, overflow: 'hidden' }}>
                  {[['Tan Wei Ming', '$150', 'GIRO'], ['Cold Storage Supermarket', '$2,200', 'In-kind'], ['Marcus Ng', '$500', 'PayNow']].map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '9px 12px', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : undefined, fontSize: 11.5 }}>
                      <span style={{ color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r[0]}</span>
                      <span style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{r[2]}</span>
                      <span style={{ color: 'var(--amber)', fontWeight: 800, flexShrink: 0 }}>{r[1]}</span>
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
      <section style={{ background: 'var(--forest-deep)', padding: '76px 24px' }}>
        <div className="pitch-container" style={{ textAlign: 'center', maxWidth: 860, margin: '0 auto' }}>
          <div className="pitch-reveal">
            <span className="pitch-section-eyebrow" style={{ background: 'rgba(232,169,59,0.15)', color: 'var(--amber)' }}>Who we built this for</span>
            <h2 style={{ fontSize: 'clamp(24px,3.6vw,34px)', color: 'white', marginBottom: 16 }}>
              For the small teams carrying <span style={{ color: 'var(--amber)' }}>big hearts.</span>
            </h2>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8, fontWeight: 500, maxWidth: 580, margin: '0 auto 28px' }}>
              Behind every IPC-registered charity in Singapore is a small team doing extraordinary work — often without a finance team, a tech team, or even a full-time admin.
            </p>
          </div>
          <div className="pitch-quote-grid">
            {PAIN_QUOTES.map((p, i) => (
              <div key={i} className="pitch-reveal pitch-quote-card" style={{ transitionDelay: `${i * 100}ms`, borderTop: '3px solid var(--amber)' }}>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', lineHeight: 1.65, fontWeight: 600, margin: '0 0 14px' }}>{p.q}</p>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{p.tag}</div>
              </div>
            ))}
          </div>
          <div className="pitch-reveal" style={{ display: 'inline-block', background: 'var(--amber)', borderRadius: 100, padding: '13px 30px' }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--forest-deep)' }}>Giving Tree was built for them. And it's completely free.</span>
          </div>
        </div>
      </section>

      {/* ── FEATURES + PRODUCT TOUR ── */}
      <section id="features" style={{ background: 'var(--cream)', padding: '76px 24px' }}>
        <div className="pitch-container">
          <div className="pitch-reveal" style={{ textAlign: 'center', marginBottom: 40 }}>
            <span className="pitch-section-eyebrow" style={{ background: 'rgba(22,59,42,0.08)', color: 'var(--forest)' }}>What we built for you</span>
            <h2 className="pitch-section-title">Everything you need. <span style={{ color: 'var(--forest)' }}>One dashboard.</span></h2>
            <p style={{ fontSize: 14.5, color: 'var(--muted)', lineHeight: 1.8, fontWeight: 500, maxWidth: 480, margin: '0 auto' }}>Capture every donation on your dashboard — every donor recognised, every receipt issued, every thank-you sent.</p>
          </div>

          <ProductTour />
          <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', margin: '10px 0 32px', fontWeight: 600 }}>Illustrative preview — not a live screenshot. Auto-advances, or click a dot.</div>

          <div className="pitch-feature-grid">
            {FEATURE_CARDS.map((f, i) => (
              <div key={i} className="pitch-reveal pitch-feature-card" style={{ transitionDelay: `${(i % 2) * 90}ms`, display: 'flex', gap: 14, padding: 22, background: 'white', border: '2px solid var(--border)', borderRadius: 16 }}>
                <div style={{ width: 4, background: 'var(--amber)', borderRadius: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 5 }}>{f.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7, fontWeight: 500 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STEPS ── */}
      <section id="how-it-works" style={{ background: 'var(--amber)', padding: '76px 24px' }}>
        <div className="pitch-container">
          <div className="pitch-reveal" style={{ textAlign: 'center', marginBottom: 40 }}>
            <span className="pitch-section-eyebrow" style={{ background: 'var(--forest-deep)', color: 'var(--amber)' }}>Getting started</span>
            <h2 className="pitch-section-title" style={{ color: 'var(--forest-deep)' }}>Up and running <span style={{ color: 'white' }}>in under 24 hours.</span></h2>
          </div>
          <div className="pitch-steps-grid">
            {STEPS.map((s, i) => (
              <div key={s.n} className="pitch-reveal pitch-step-card" style={{ transitionDelay: `${i * 100}ms` }}>
                <div className="pitch-step-num">{s.n}</div>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.65, fontWeight: 500, marginBottom: 14 }}>{s.desc}</div>
                <div style={{ display: 'inline-block', background: 'var(--cream)', borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 800, color: 'var(--forest)' }}>{s.tag}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIAL ── */}
      <section style={{ background: 'var(--forest-deep)', padding: '76px 24px', textAlign: 'center' }}>
        <div className="pitch-container pitch-reveal" style={{ maxWidth: 660, margin: '0 auto' }}>
          <blockquote style={{ fontSize: 'clamp(19px,3vw,28px)', color: 'white', lineHeight: 1.5, margin: '0 auto 20px', fontWeight: 800, letterSpacing: '-0.5px' }}>
            "The charities doing the most <span style={{ color: 'var(--amber)' }}>important</span> work in Singapore are often the ones with the least support. We built Giving Tree to change that."
          </blockquote>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700 }}>— The Giving Tree Team</div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" style={{ background: 'var(--forest)', padding: '90px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="pitch-reveal" style={{ position: 'relative', zIndex: 1, maxWidth: 520, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(26px,4vw,36px)', color: 'white', marginBottom: 14 }}>Your cause deserves<br />to be <span style={{ color: 'var(--amber)' }}>found.</span></h2>
          <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.7)', fontWeight: 500, lineHeight: 1.8, marginBottom: 34 }}>If you're an IPC-registered charity in Singapore, we'd love to have you. It takes 5 minutes to get started, and it's completely free.</p>

          {sent ? (
            <div style={{ position: 'relative', background: 'rgba(232,169,59,0.15)', border: '2px solid var(--amber)', borderRadius: 16, padding: '24px 28px', fontSize: 14, color: 'white', lineHeight: 1.7, textAlign: 'left', overflow: 'visible', fontWeight: 600 }}>
              <ConfettiBurst />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <span style={{ fontSize: 20, marginRight: 8 }}>🎉</span>
                Thanks — we've got your request and will be in touch shortly. In the meantime, feel free to email <span style={{ color: 'var(--amber)' }}>hello@givingtree.sg</span> directly.
              </div>
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: 20, padding: 30, textAlign: 'left' }}>
              {error && (
                <div style={{ background: '#FBEAEA', border: '1.5px solid #E2A0A0', color: '#A32D2D', padding: '10px 14px', borderRadius: 10, fontSize: 12.5, marginBottom: 16, fontWeight: 600 }}>{error}</div>
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
              <MagneticButton onClick={submitDemoRequest} className="pitch-btn-primary" style={{ width: '100%', textAlign: 'center', opacity: sending ? 0.7 : 1 }}>
                {sending ? 'Sending...' : 'Get in touch →'}
              </MagneticButton>
            </div>
          )}
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 22, lineHeight: 1.7, fontWeight: 500 }}>
            Or write directly to <a href="mailto:hello@givingtree.sg" style={{ color: 'white' }}>hello@givingtree.sg</a><br />
            Already have an account? <span onClick={() => navigate('/dashboard')} style={{ color: 'white', textDecoration: 'underline', cursor: 'pointer' }}>Sign in here</span>
          </p>
        </div>
      </section>

      <footer style={{ background: 'var(--forest-deep)', padding: '22px 32px', textAlign: 'center', fontSize: 11.5, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
        © {new Date().getFullYear()} Giving Tree · hello@givingtree.sg
      </footer>
    </div>
  )
}
