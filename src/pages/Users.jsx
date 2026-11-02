import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useStores } from '../context/StoreContext'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { logActivity } from '../lib/activity'
import { Trash2 } from 'lucide-react'

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

  const [nEmail, setNEmail] = useState('')
  const [nPass, setNPass] = useState('')
  const [nRole, setNRole] = useState('shift_manager')
  const [nStore, setNStore] = useState('')
  const [nMsg, setNMsg] = useState('')
  const [adding, setAdding] = useState(false)

  async function addUser() {
    setNMsg('')
    if (!nEmail || nPass.length < 6 || (nRole === 'store_manager' && !nStore)) { setNMsg(t('userFormHint2')); return }
    setAdding(true)
    const temp = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: 'tmp-signup' },
    })
    const { data, error } = await temp.auth.signUp({ email: nEmail, password: nPass })
    if (error || !data.user) { setNMsg(error?.message || 'Error'); setAdding(false); return }
    let err = null
    for (let i = 0; i < 5; i++) {
      const r = await supabase.rpc('claim_user', { p_user: data.user.id, p_role: nRole, p_store: nStore || null })
      err = r.error
      if (!err) break
      await new Promise(res => setTimeout(res, 600))
    }
    if (err) { setNMsg(err.message); setAdding(false); return }
    await logActivity('create', 'user', nEmail, nRole)
    setNMsg(t('userCreated'))
    setNEmail(''); setNPass(''); setNRole('shift_manager'); setNStore('')
    setAdding(false)
    load()
  }

  async function deleteUser(u) {
    if (!confirm(`${t('confirmDelete')} ${u.email}`)) return
    const { error } = await supabase.rpc('delete_user', { p_user: u.id })
    if (error) { alert(error.message); return }
    await logActivity('delete', 'user', u.email)
    load()
  }

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

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>{t('addUser')}</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input placeholder="Email" value={nEmail} onChange={e => setNEmail(e.target.value)} />
          <input placeholder={t('password')} value={nPass} onChange={e => setNPass(e.target.value)} />
          <select value={nRole} onChange={e => setNRole(e.target.value)}>
            {Object.entries(ROLE_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>
          {nRole === 'store_manager' && (
            <select value={nStore} onChange={e => setNStore(e.target.value)}>
              <option value="">{t('selectStore')}</option>
              {stores.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
            </select>
          )}
          <button className="btn" onClick={addUser} disabled={adding}>{adding ? t('saving') : t('add')}</button>
        </div>
        {nMsg && <p style={{ marginBottom: 0 }}>{nMsg}</p>}
      </div>

      <div className="card">
        {loading ? <p>{t('loading')}</p> : (
          <table>
            <thead><tr><th>Email</th><th>{t('role')}</th><th>{t('store')}</th>{isPlatformAdmin && <th>{t('company')}</th>}<th></th></tr></thead>
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
                  <td>
                    {u.id !== myProfile?.id && (
                      <button className="icon-btn danger" onClick={() => deleteUser(u)}><Trash2 size={16} /></button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={5}>{t('noUsers')}</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
