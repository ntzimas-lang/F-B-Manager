import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

export default function Login() {
  const { signIn } = useAuth()
  const { t, lang, chooseLang } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [info, setInfo] = useState('')

  async function forgot() {
    setError(''); setInfo('')
    if (!email) { setError(t('enterEmailFirst')); return }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    if (error) setError(error.message); else setInfo(t('resetSent'))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) setError(t('wrongCredentials'))
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--olive-50)', direction: 'ltr', position: 'relative',
    }}>
      <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', border: '1px solid #d8dcc9', borderRadius: 6, overflow: 'hidden' }}>
        <button
          onClick={() => chooseLang('el')}
          style={{ padding: '6px 12px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: lang === 'el' ? 'var(--olive-700)' : '#fff', color: lang === 'el' ? '#fff' : 'var(--ink)' }}
        >Ελληνικά</button>
        <button
          onClick={() => chooseLang('en')}
          style={{ padding: '6px 12px', border: 'none', borderLeft: '1px solid #d8dcc9', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: lang === 'en' ? 'var(--olive-700)' : '#fff', color: lang === 'en' ? '#fff' : 'var(--ink)' }}
        >English</button>
      </div>

      <form onSubmit={handleSubmit} className="card" style={{ width: 360, maxWidth: '92vw' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--olive-900)' }}>F&B <span style={{ color: 'var(--olive-600)' }}>Manager</span></div>
          <div style={{ fontSize: 13, color: '#6b6b5f', marginTop: 4 }}>{t('login')}</div>
        </div>

        <div className="form-row">
          <label>{t('email')}</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="form-row">
          <label>{t('password')}</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <button className="btn" type="submit" style={{ width: '100%' }} disabled={loading}>
          {loading ? `${t('loading')}` : t('login')}
        </button>
        {info && <div style={{ color: 'var(--ok)', fontSize: 13, marginTop: 12 }}>{info}</div>}
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button type="button" onClick={forgot} style={{ background: 'none', border: 'none', color: 'var(--olive-700)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>{t('forgotPassword')}</button>
        </div>
      </form>
    </div>
  )
}
