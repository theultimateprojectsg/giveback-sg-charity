import { useState } from 'react'
import { supabase } from './supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!email || !password) { setError('Please fill in all fields'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Invalid email or password'); setLoading(false); return }
    setLoading(false)
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>💚</div>
        <div style={styles.title}>GiveBack SG</div>
        <div style={styles.sub}>Charity Portal — Sign In</div>

        {error && <div style={styles.error}>{error}</div>}

        <input
          style={styles.input}
          placeholder="Email address"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          style={styles.input}
          placeholder="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        <button
          style={loading ? styles.btnDisabled : styles.btn}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <div style={styles.note}>
          🔒 Access restricted to registered charities only.
          Contact GiveBack SG to get your account set up.
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', background: '#0F1117', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Segoe UI', sans-serif" },
  card: { background: '#111520', borderRadius: 24, padding: 32, width: '100%', maxWidth: 380, border: '1px solid #1E2640' },
  logo: { fontSize: 40, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 24, fontWeight: 800, color: '#E8ECF8', textAlign: 'center', marginBottom: 4 },
  sub: { fontSize: 13, color: '#5A6480', textAlign: 'center', marginBottom: 24 },
  input: { width: '100%', padding: '12px 16px', border: '1px solid #1E2640', borderRadius: 12, fontSize: 14, fontFamily: 'inherit', outline: 'none', marginBottom: 10, boxSizing: 'border-box', background: '#181D2E', color: '#E8ECF8' },
  btn: { width: '100%', padding: 16, background: '#00E5A0', color: '#0F1117', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 6 },
  btnDisabled: { width: '100%', padding: 16, background: '#1E2640', color: '#5A6480', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'default', marginTop: 6 },
  error: { background: 'rgba(255,69,96,0.1)', color: '#FF4560', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12 },
  note: { fontSize: 11, color: '#5A6480', textAlign: 'center', marginTop: 16, lineHeight: 1.6 },
}