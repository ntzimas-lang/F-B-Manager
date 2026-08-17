import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

export default function Login() {
  const { signIn } = useAuth()
  const { t, lang, toggleLang } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      <button
        onClick={toggleLang}
        style={{ position: 'absolute', top: 20, right: 20, padding: '6px 12px', borderRadius: 6, border: '1px solid #d8dcc9', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
      >{lang === 'el' ? 'ΕΛ' : 'EN'}</button>

      <form onSubmit={handleSubmit} className="card" style={{ width: 360 }}>
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
      </form>
    </div>
  )
}
