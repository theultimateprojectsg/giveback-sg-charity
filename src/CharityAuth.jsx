import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import logo from './assets/logo.png'

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= breakpoint)
  useEffect(() => {
    function handleResize() { setIsMobile(window.innerWidth <= breakpoint) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [breakpoint])
  return isMobile
}

export default function CharityAuth() {
  const isMobile = useIsMobile()
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
      height: isMobile ? 'auto' : '100vh',
      background: '#0A1A0F',
      display: 'flex',
      alignItems: isMobile ? 'flex-start' : 'center',
      justifyContent: 'center',
      fontFamily: 'Georgia, serif',
      position: 'relative',
      overflow: isMobile ? 'visible' : 'hidden',
      padding: isMobile ? '24px 0' : 0,
      boxSizing: 'border-box',
    }}>

      {/* Background */}
      <div style={{ position: 'absolute', top: -200, left: -200, width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(27,67,50,0.4) 0%, transparent 65%)', pointerEvents: 'none' }}/>
      <div style={{ position: 'absolute', bottom: -150, right: -100, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,160,23,0.06) 0%, transparent 70%)', pointerEvents: 'none' }}/>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(116,198,157,0.03) 1px, transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none' }}/>

      {/* Two column layout */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        width: '100%',
        maxWidth: 1000,
        minHeight: isMobile ? 'auto' : '100vh',
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
          padding: isMobile ? '40px 24px 24px' : '60px 56px',
          borderRight: isMobile ? 'none' : '1px solid rgba(116,198,157,0.08)',
          borderBottom: isMobile ? '1px solid rgba(116,198,157,0.08)' : 'none',
        }}>
          <div style={{ marginBottom: isMobile ? 16 : 28 }}>
            <img src={logo} style={{ width: isMobile ? 64 : 110, height: isMobile ? 64 : 110, objectFit: 'contain' }} />
          </div>
          <div style={{ fontSize: isMobile ? 24 : 36, fontWeight: 700, color: 'white', letterSpacing: '4px', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.1, marginBottom: 12 }}>
            Giving Tree
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, width: isMobile ? 180 : 260 }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, #D4A017)' }}/>
            <svg width="14" height="12" viewBox="0 0 16 14">
              <path d="M8 13 C8 13 1 7.5 1 3.5 C1 1.5 2.5 0.5 4 1.5 C5.5 2.5 8 5 8 5 C8 5 10.5 2.5 12 1.5 C13.5 0.5 15 1.5 15 3.5 C15 7.5 8 13 8 13Z" fill="#D4A017"/>
            </svg>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #D4A017, transparent)' }}/>
          </div>
          <div style={{ fontSize: 11, color: '#74C69D', letterSpacing: '3px', textTransform: 'uppercase', textAlign: 'center', marginBottom: isMobile ? 16 : 20 }}>
            Many Hearts. One Purpose.
          </div>
          {!isMobile && (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(116,198,157,0.15)', borderRadius: 16, padding: '16px 28px', textAlign: 'center', marginBottom: 20  }}>
            <div style={{ fontSize: 11, color: '#D4A017', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 0, fontFamily: 'sans-serif' }}>Charity Portal</div>
            
          </div>
          )}
          {!isMobile && (
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
          )}
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isMobile ? '32px 24px' : '60px 56px',
          background: 'rgba(255,255,255,0.02)',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          <div style={{ width: '100%', maxWidth: 380 }}>

            <div style={{ marginBottom: 36, textAlign: isMobile ? 'center' : 'left' }}>
              <div style={{ fontSize: 11, color: '#D4A017', letterSpacing: '3px', textTransform: 'uppercase', fontFamily: 'sans-serif', marginBottom: 10 }}>
                Charity Portal Access
              </div>
              <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>Welcome back</div>
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
