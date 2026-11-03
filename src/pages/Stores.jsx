import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activity'
import { useStores } from '../context/StoreContext'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { createUser, removeUser } from '../lib/userAdmin'
import { Plus, Trash2, Pencil, X, UserPlus } from 'lucide-react'

// Ρυθμίσεις: καταστήματα και οι άνθρωποί τους, σε μία οθόνη.
export default function Stores() {
  const { stores, loading } = useStores()
  const { t } = useLanguage()
  const { maxStores, isPlatformAdmin, role, profile } = useAuth()
  const isAdminRole = isPlatformAdmin || role === 'super_user' || role === 'owner'
  const canCreate = isAdminRole
  const limitReached = !isPlatformAdmin && stores.length >= maxStores
  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState(null)
  const [users, setUsers] = useState([])
  const [adding, setAdding] = useState(false)

  async function loadUsers() {
    if (!isAdminRole) return
    const { data } = await supabase.from('profiles').select('*').order('email')
    setUsers((data || []).filter(u => !profile?.company_id || u.company_id === profile.company_id))
  }
  useEffect(() => { loadUsers() }, [profile?.company_id, role])

  const ROLE = { super_user: t('superUser'), owner: t('owner'), store_manager: t('storeManager'), shift_manager: t('shiftManager'), accounting: t('accounting') }
  const visibleStores = isAdminRole ? stores : stores.filter(s => s.id === profile?.store_id)

  async function remove(id) {
    if (!confirm(t('confirmDelete'))) return
    const store = stores.find(s => s.id === id)
    await supabase.from('stores').delete().eq('id', id)
    await logActivity('delete', 'store', store?.name)
    window.location.reload()
  }
  async function delUser(u) {
    if (!confirm(`${t('confirmDelete')} ${u.email}`)) return
    const r = await removeUser(u)
    if (r.error) alert(r.error)
    loadUsers()
  }

  const scoped = ['store_manager', 'shift_manager']

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 16 }}>
        <h1>{t('settings')}</h1>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{t('stores')} {maxStores < 9999 && <span style={{ fontSize: 13, fontWeight: 400 }}>({stores.length} / {maxStores})</span>}</h2>
          {canCreate && <button className="btn write-btn" onClick={() => { setEditing(null); setShow(true) }} disabled={limitReached}><Plus size={16} /> {t('newStore')}</button>}
        </div>
        {limitReached && <p style={{ margin: '0 0 8px', fontSize: 13 }}>{t('storeLimitReached')}</p>}
        {loading && <p>{t('loading')}</p>}
        {!loading && visibleStores.length === 0 && <p>{t('noStores')}</p>}
        {visibleStores.map(s => (
          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--olive-100, #e5e8d8)' }}>
            <span><b>{s.name}</b> <span style={{ fontSize: 13, color: '#6b6b5f' }}>{[s.code, s.address].filter(Boolean).join(' · ')}</span></span>
            <span style={{ display: 'flex', gap: 8 }}>
              <button className="icon-btn write-btn" onClick={() => { setEditing(s); setShow(true) }}><Pencil size={16} /></button>
              {isPlatformAdmin && <button className="icon-btn danger write-btn" onClick={() => remove(s.id)}><Trash2 size={16} /></button>}
            </span>
          </div>
        ))}
      </div>

      {isAdminRole && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>{t('people')}</h2>
            {!adding && <button className="btn" onClick={() => setAdding(true)}><UserPlus size={16} /> {t('addPerson')}</button>}
          </div>
          {adding && <AddPerson stores={stores} ROLE={ROLE} onClose={() => setAdding(false)} onDone={() => { setAdding(false); loadUsers() }} />}
          <table>
            <thead><tr><th>Email</th><th>{t('role')}</th><th>{t('store')}</th><th></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{ROLE[u.role] || u.role}</td>
                  <td>{scoped.includes(u.role) ? (stores.find(x => x.id === u.store_id)?.name || '—') : t('all')}</td>
                  <td>{u.id !== profile?.id && <button className="icon-btn danger" onClick={() => delUser(u)}><Trash2 size={16} /></button>}</td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={4}>{t('noUsers')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {show && <StoreFormModal store={editing} onClose={() => setShow(false)} onSaved={() => window.location.reload()} />}
    </div>
  )
}

function AddPerson({ stores, ROLE, onClose, onDone }) {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('shift_manager')
  const [storeId, setStoreId] = useState(stores[0]?.id || '')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const needsStore = role === 'store_manager' || role === 'shift_manager'
  async function submit() {
    setMsg('')
    if (!email || password.length < 6 || (needsStore && !storeId)) { setMsg(t('userFormHint2')); return }
    setBusy(true)
    const r = await createUser({ email: email.trim(), password, role, storeId: needsStore ? storeId : null })
    setBusy(false)
    if (r.error) { setMsg(r.error); return }
    onDone()
  }
  return (
    <div style={{ marginBottom: 12, padding: 12, background: 'var(--olive-50, #f4f5ec)', borderRadius: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input placeholder={t('password')} value={password} onChange={e => setPassword(e.target.value)} />
        <select value={role} onChange={e => setRole(e.target.value)}>
          {['shift_manager', 'store_manager', 'accounting', 'owner'].map(r => <option key={r} value={r}>{ROLE[r]}</option>)}
        </select>
        {needsStore && (
          <select value={storeId} onChange={e => setStoreId(e.target.value)}>
            {stores.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
          </select>
        )}
        <button className="btn" onClick={submit} disabled={busy}>{busy ? t('saving') : t('add')}</button>
        <button className="btn btn-outline" onClick={onClose}>{t('cancel')}</button>
      </div>
      {msg && <p style={{ margin: '8px 0 0', color: 'var(--danger)' }}>{msg}</p>}
    </div>
  )
}

function StoreFormModal({ store, onClose, onSaved }) {
  const { t } = useLanguage()
  const isEdit = !!store
  const [form, setForm] = useState({ name: store?.name || '', code: store?.code || '', address: store?.address || '' })

  async function save() {
    if (!form.name) return
    if (isEdit) {
      await supabase.from('stores').update(form).eq('id', store.id)
      await logActivity('update', 'store', form.name)
    } else {
      const { error } = await supabase.from('stores').insert({ ...form, active: true })
      if (error) { alert(/limit/i.test(error.message) ? t('storeLimitReached') : error.message); return }
      await logActivity('create', 'store', form.name)
    }
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><h2>{isEdit ? `${t('edit')} — ${store.name}` : t('newStore')}</h2><button className="icon-btn" onClick={onClose}><X /></button></div>
        <div className="form-row"><label>{t('name')}</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div className="form-row"><label>{t('code')}</label><input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
        <div className="form-row"><label>{t('address')}</label><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
        <div className="modal-actions"><button className="btn" onClick={save}>{t('save')}</button></div>
      </div>
    </div>
  )
}
