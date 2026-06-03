import { useState } from 'react'
import { supabase } from './supabase'

function TreeLogo({ size = 80 }) {
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 100 110" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="goldC" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F0C84A"/>
          <stop offset="100%" stopColor="#D4A017"/>
        </linearGradient>
      </defs>
      <path d="M42 108 Q40 96 40 86 Q40 77 43 71 Q46 66 50 65 Q54 66 57 71 Q60 77 60 86 Q60 96 58 108Z" fill="#8B5E3C"/>
      <path d="M42 104 Q33 108 24 110" stroke="#8B5E3C" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M58 104 Q67 108 76 110" stroke="#8B5E3C" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <circle cx="30" cy="72" r="22" fill="#1B4332"/>
      <circle cx="70" cy="72" r="22" fill="#1B4332"/>
      <circle cx="50" cy="76" r="28" fill="#1B4332"/>
      <circle cx="37" cy="56" r="20" fill="#1B4332"/>
      <circle cx="63" cy="56" r="20" fill="#1B4332"/>
      <circle cx="50" cy="52" r="24" fill="#1B4332"/>
      <circle cx="50" cy="34" r="20" fill="#1B4332"/>
      <circle cx="50" cy="22" r="14" fill="#1B4332"/>
      <circle cx="30" cy="70" r="18" fill="#2D6A4F"/>
      <circle cx="70" cy="70" r="18" fill="#2D6A4F"/>
      <circle cx="50" cy="72" r="24" fill="#2D6A4F"/>
      <circle cx="37" cy="53" r="16" fill="#2D6A4F"/>
      <circle cx="63" cy="53" r="16" fill="#2D6A4F"/>
      <circle cx="50" cy="48" r="20" fill="#2D6A4F"/>
      <circle cx="50" cy="31" r="16" fill="#2D6A4F"/>
      <circle cx="30" cy="67" r="13" fill="#40916C"/>
      <circle cx="70" cy="67" r="13" fill="#40916C"/>
      <circle cx="50" cy="67" r="18" fill="#40916C"/>
      <circle cx="37" cy="50" r="11" fill="#40916C"/>
      <circle cx="63" cy="50" r="11" fill="#40916C"/>
      <circle cx="50" cy="43" r="14" fill="#40916C"/>
      <circle cx="50" cy="27" r="11" fill="#40916C"/>
      <circle cx="50" cy="20" r="8" fill="#52B788"/>
      <circle cx="48" cy="16" r="5" fill="#74C69D"/>
      <path d="M50 54 C50 54 41 47 41 41.5 C41 37.8 44 36 46.5 37.5 C48 38.3 50 40.5 50 40.5 C50 40.5 52 38.3 53.5 37.5 C56 36 59 37.8 59 41.5 C59 47 50 54 50 54Z" fill="white"/>
      <path d="M41 41.5 C41 37.8 44 36 46.5 37.5 C48 38.3 50 40.5 50 40.5 C50 40.5 52 38.3 53.5 37.5 C56 36 59 37.8 59 41.5Z" fill="#EF3340"/>
      <circle cx="46.5" cy="40" r="2.2" fill="white"/>
      <circle cx="47.3" cy="39.4" r="1.6" fill="#EF3340"/>
      <text x="51" y="41.5" fontSize="2.8" fill="white">★</text>
      <text x="52.8" y="40.2" fontSize="2.5" fill="white">★</text>
      <text x="53.8" y="42" fontSize="2.5" fill="white">★</text>
      <text x="52.5" y="43.8" fontSize="2.5" fill="white">★</text>
      <text x="50.8" y="44.2" fontSize="2.5" fill="white">★</text>
      <path d="M50 33 C50 33 47.2 30.5 47.2 28.8 C47.2 27.6 48.2 27 49.1 27.6 C49.6 27.9 50 28.5 50 28.5 C50 28.5 50.4 27.9 50.9 27.6 C51.8 27 52.8 27.6 52.8 28.8 C52.8 30.5 50 33 50 33Z" fill="url(#goldC)"/>
      <path d="M36 52 C36 52 33.5 49.8 33.5 48.3 C33.5 47.2 34.4 46.7 35.2 47.2 C35.6 47.4 36 48 36 48 C36 48 36.4 47.4 36.8 47.2 C37.6 46.7 38.5 47.2 38.5 48.3 C38.5 49.8 36 52 36 52Z" fill="url(#goldC)"/>
      <path d="M64 52 C64 52 61.5 49.8 61.5 48.3 C61.5 47.2 62.4 46.7 63.2 47.2 C63.6 47.4 64 48 64 48 C64 48 64.4 47.4 64.8 47.2 C65.6 46.7 66.5 47.2 66.5 48.3 C66.5 49.8 64 52 64 52Z" fill="url(#goldC)"/>
      <path d="M26 66 C26 66 23.5 63.8 23.5 62.3 C23.5 61.2 24.4 60.7 25.2 61.2 C25.6 61.4 26 62 26 62 C26 62 26.4 61.4 26.8 61.2 C27.6 60.7 28.5 61.2 28.5 62.3 C28.5 63.8 26 66 26 66Z" fill="url(#goldC)"/>
      <path d="M74 66 C74 66 71.5 63.8 71.5 62.3 C71.5 61.2 72.4 60.7 73.2 61.2 C73.6 61.4 74 62 74 62 C74 62 74.4 61.4 74.8 61.2 C75.6 60.7 76.5 61.2 76.5 62.3 C76.5 63.8 74 66 74 66Z" fill="url(#goldC)"/>
    </svg>
  )
}

export default function CharityAuth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)

  async function handleLogin() {
    if (!email || !password) { setError('Please fill in all fields'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Invalid email or password. Please try again.'); setLoading(false); return }
    setLoading(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0A1A0F',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Georgia, serif',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Background */}
      <div style={{ position: 'absolute', top: -200, left: -200, width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(27,67,50,0.4) 0%, transparent 65%)', pointerEvents: 'none' }}/>
      <div style={{ position: 'absolute', bottom: -150, right: -100, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,160,23,0.06) 0%, transparent 70%)', pointerEvents: 'none' }}/>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(116,198,157,0.03) 1px, transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none' }}/>

      {/* Two column layout */}
      <div style={{
        display: 'flex',
        width: '100%',
        maxWidth: 1000,
        minHeight: '100vh',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* ── LEFT PANEL ── */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 56px',
          borderRight: '1px solid rgba(116,198,157,0.08)',
        }}>
          <div style={{ marginBottom: 28 }}>
            <TreeLogo size={110}/>
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, color: 'white', letterSpacing: '4px', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.1, marginBottom: 12 }}>
            Giving Tree
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, width: 260 }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, #D4A017)' }}/>
            <svg width="14" height="12" viewBox="0 0 16 14">
              <path d="M8 13 C8 13 1 7.5 1 3.5 C1 1.5 2.5 0.5 4 1.5 C5.5 2.5 8 5 8 5 C8 5 10.5 2.5 12 1.5 C13.5 0.5 15 1.5 15 3.5 C15 7.5 8 13 8 13Z" fill="#D4A017"/>
            </svg>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #D4A017, transparent)' }}/>
          </div>
          <div style={{ fontSize: 11, color: '#74C69D', letterSpacing: '3px', textTransform: 'uppercase', textAlign: 'center', marginBottom: 20 }}>
            Many Hearts. One Purpose.
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(116,198,157,0.15)', borderRadius: 16, padding: '16px 28px', textAlign: 'center', marginBottom: 20  }}>
            <div style={{ fontSize: 11, color: '#D4A017', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 0, fontFamily: 'sans-serif' }}>Charity Portal</div>
            
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: '💳', text: 'Real-time donation tracking' },
              { icon: '🧾', text: 'One-click receipt issuance' },
              { icon: '🏛️', text: 'IRAS export ready' },
              { icon: '📊', text: 'Donor analytics dashboard' },
            ].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 20 }}>{f.icon}</div>
                <div style={{ fontSize: 13, color: '#52B788', fontFamily: 'sans-serif' }}>{f.text}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 56px',
          background: 'rgba(255,255,255,0.02)',
        }}>
          <div style={{ width: '100%', maxWidth: 380 }}>

            <div style={{ marginBottom: 36 }}>
              <div style={{ fontSize: 11, color: '#D4A017', letterSpacing: '3px', textTransform: 'uppercase', fontFamily: 'sans-serif', marginBottom: 10 }}>
                Charity Portal Access
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>Welcome back</div>
              <div style={{ fontSize: 13, color: '#52B788', fontFamily: 'sans-serif', lineHeight: 1.6 }}>
                Sign in to manage donations and issue receipts.
              </div>
            </div>

            {error && (
              <div style={{ background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.25)', color: '#FF7B6B', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 20, fontFamily: 'sans-serif', lineHeight: 1.5 }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>Email Address</label>
              <input style={inp} placeholder="charity@email.com" type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown} autoCapitalize="none" autoFocus/>
            </div>

            <div style={{ marginBottom: 10, position: 'relative' }}>
              <label style={lbl}>Password</label>
              <input style={inp} placeholder="••••••••" type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKeyDown}/>
              <div onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 16, bottom: 15, fontSize: 12, color: '#74C69D', cursor: 'pointer', fontFamily: 'sans-serif', userSelect: 'none' }}>
                {showPass ? 'Hide' : 'Show'}
              </div>
            </div>

            <button onClick={handleLogin} disabled={loading} style={{
              width: '100%', padding: '16px',
              background: loading ? 'rgba(64,145,108,0.3)' : 'linear-gradient(135deg, #40916C, #1B4332)',
              color: 'white', border: 'none', borderRadius: 14,
              fontSize: 15, fontWeight: 700,
              cursor: loading ? 'default' : 'pointer',
              letterSpacing: '1.5px', textTransform: 'uppercase',
              fontFamily: 'Georgia, serif',
              boxShadow: loading ? 'none' : '0 6px 28px rgba(27,67,50,0.5)',
              marginTop: 20, transition: 'all 0.2s',
            }}>
              {loading ? 'Signing in...' : 'Sign In to Dashboard'}
            </button>

            <div style={{ marginTop: 28, padding: '14px 18px', background: 'rgba(116,198,157,0.04)', border: '1px solid rgba(116,198,157,0.1)', borderRadius: 12, fontSize: 12, color: '#52B788', fontFamily: 'sans-serif', lineHeight: 1.7, textAlign: 'center' }}>
              🔒 Access restricted to registered charities only.<br/>
              Contact <span style={{ color: '#D4A017' }}>hello@givingtree.sg</span> to get set up.
            </div>

            <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 10, opacity: 0.4 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(116,198,157,0.3)' }}/>
              <div style={{ fontSize: 11, color: '#52B788', fontFamily: 'sans-serif', letterSpacing: '2px', textTransform: 'uppercase' }}>The Giving Tree</div>
              <div style={{ flex: 1, height: 1, background: 'rgba(116,198,157,0.3)' }}/>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}

const lbl = {
  display: 'block', fontSize: 10, fontWeight: 600,
  color: '#74C69D', letterSpacing: '2px', textTransform: 'uppercase',
  marginBottom: 8, fontFamily: 'sans-serif',
}

const inp = {
  width: '100%', padding: '14px 18px',
  background: 'rgba(255,255,255,0.05)',
  border: '1.5px solid rgba(116,198,157,0.18)',
  borderRadius: 12, fontSize: 14, color: 'white',
  outline: 'none', boxSizing: 'border-box',
  fontFamily: 'sans-serif',
}
