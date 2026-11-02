import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStores } from '../context/StoreContext'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { logActivity } from '../lib/activity'

export default function Users() {
  const { stores } = useStores()
  const { profile: myProfile, isPlatformAdmin } = useAuth()
  const [companies, setCompanies] = useState([])
  const { t } = useLanguage()
  const ROLE_LABELS = {
    super_user: t('superUser'),
    store_manager: t('storeManager'),
    shift_manager: t('shiftManager'),
    accounting: t('accounting'),
  }
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*, stores(name)').order('email')
    setUsers(data || [])
    if (isPlatformAdmin) { const { data: c } = await supabase.from('companies').select('*').order('name'); setCompanies(c || []) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function updateField(userRow, field, value) {
    setSavingId(userRow.id)
    const payload = { [field]: value || null }
    if (field === 'role' && value !== 'store_manager') payload.store_id = null
    await supabase.from('profiles').update(payload).eq('id', userRow.id)
    await logActivity('update', 'user', userRow.email, `${field} → ${value}`)
    await load()
    setSavingId(null)
  }

  if (myProfile?.role !== 'super_user' && !isPlatformAdmin) {
    return <div className="card">{t('superUserOnly')}</div>
  }

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 16 }}>
        <h1>{t('users')}</h1>
      </div>

      <div className="card" style={{ marginBottom: 16, background: 'var(--olive-50)', fontSize: 13 }}>
        {t('newUserNote')}
      </div>

      <div className="card">
        {loading ? <p>{t('loading')}</p> : (
          <table>
            <thead><tr><th>Email</th><th>{t('role')}</th><th>{t('store')}</th>{isPlatformAdmin && <th>{t('company')}</th>}</tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      disabled={savingId === u.id}
                      onChange={(e) => updateField(u, 'role', e.target.value)}
                    >
                      {Object.entries(ROLE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {u.role === 'store_manager' ? (
                      <select
                        value={u.store_id || ''}
                        disabled={savingId === u.id}
                        onChange={(e) => updateField(u, 'store_id', e.target.value)}
                      >
                        <option value="">{t('selectStore')}</option>
                        {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    ) : (
                      <span style={{ color: '#8a8a7a' }}>{u.role === 'super_user' ? t('all') : '—'}</span>
                    )}
                  </td>
                  {isPlatformAdmin && (
                    <td>
                      <select value={u.company_id || ''} disabled={savingId === u.id} onChange={(e) => updateField(u, 'company_id', e.target.value)}>
                        <option value="">-</option>
                        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                  )}
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={4}>{t('noUsers')}</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
