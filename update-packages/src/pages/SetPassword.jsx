import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

export default function SetPassword() {
  const { setRecovery } = useAuth()
  const { t } = useLanguage()
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')

  async function save(e) {
    e.preventDefault()
    if (pw.length < 6) { setErr(t('passwordMin')); return }
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) setErr(error.message); else setRecovery(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--olive-50)' }}>
      <form onSubmit={save} className="card" style={{ width: 360, maxWidth: '92vw' }}>
        <h2 style={{ marginTop: 0 }}>{t('newPassword')}</h2>
        <div className="form-row"><input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder={t('password')} /></div>
        {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <button className="btn" type="submit" style={{ width: '100%' }}>{t('save')}</button>
      </form>
    </div>
  )
}
