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
  const [addFor, setAddFor] = useState(null) // store id | 'admin'

  async function loadUsers() {
    if (!isAdminRole) return
    const { data } = await supabase.from('profiles').select('*').order('email')
    setUsers((data || []).filter(u => !profile?.company_id || u.company_id === profile.company_id))
  }
  useEffect(() => { loadUsers() }, [profile?.company_id, role])

  const ROLE = { super_user: t('superUser'), owner: t('owner'), store_manager: t('storeManager'), shift_manager: t('shiftManager'), accounting: t('accounting') }
  const visibleStores = isAdminRole ? stores : stores.filter(s => s.id === profile?.store_id)
  const storeIds = new Set(stores.map(s => s.id))
  const adminUsers = users.filter(u => !(u.store_id && storeIds.has(u.store_id) && ['store_manager', 'shift_manager'].includes(u.role)))

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

  const person = (u) => (
    <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--olive-100, #e5e8d8)' }}>
      <span>{u.email} <span className="badge">{ROLE[u.role] || u.role}</span></span>
      {u.id !== profile?.id && <button className="icon-btn danger" onClick={() => delUser(u)}><Trash2 size={16} /></button>}
    </div>
  )

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 16 }}>
        <h1>{t('settings')}</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {maxStores < 9999 && <span style={{ fontSize: 13 }}>{stores.length} / {maxStores}</span>}
          {canCreate && <button className="btn write-btn" onClick={() => { setEditing(null); setShow(true) }} disabled={limitReached}><Plus size={16} /> {t('newStore')}</button>}
        </div>
      </div>
      {limitReached && <div className="card" style={{ marginBottom: 16, background: 'var(--olive-50)' }}>{t('storeLimitReached')}</div>}
      {loading && <p>{t('loading')}</p>}
      {!loading && visibleStores.length === 0 && <div className="card">{t('noStores')}</div>}

      {visibleStores.map(s => {
        const people = users.filter(u => u.store_id === s.id && ['store_manager', 'shift_manager'].includes(u.role))
        return (
          <div className="card" key={s.id} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div><h2 style={{ margin: 0 }}>{s.name}</h2><span style={{ fontSize: 13, color: '#6b6b5f' }}>{[s.code, s.address].filter(Boolean).join(' · ')}</span></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="icon-btn write-btn" onClick={() => { setEditing(s); setShow(true) }}><Pencil size={16} /></button>
                {isPlatformAdmin && <button className="icon-btn danger write-btn" onClick={() => remove(s.id)}><Trash2 size={16} /></button>}
              </div>
            </div>
            {isAdminRole && (
              <div style={{ marginTop: 12 }}>
                {people.map(person)}
                {addFor === s.id
                  ? <AddPerson roles={['store_manager', 'shift_manager']} storeId={s.id} ROLE={ROLE} onClose={() => setAddFor(null)} onDone={() => { setAddFor(null); loadUsers() }} />
                  : <button className="btn btn-outline" style={{ marginTop: 8 }} onClick={() => setAddFor(s.id)}><UserPlus size={16} /> {t('addPerson')}</button>}
              </div>
            )}
          </div>
        )
      })}

      {isAdminRole && (
        <div className="card">
          <h2 style={{ margin: 0 }}>{t('management')}</h2>
          <span style={{ fontSize: 13, color: '#6b6b5f' }}>{t('managementHint')}</span>
          <div style={{ marginTop: 12 }}>
            {adminUsers.map(person)}
            {addFor === 'admin'
              ? <AddPerson roles={['owner', 'accounting']} storeId={null} ROLE={ROLE} onClose={() => setAddFor(null)} onDone={() => { setAddFor(null); loadUsers() }} />
              : <button className="btn btn-outline" style={{ marginTop: 8 }} onClick={() => setAddFor('admin')}><UserPlus size={16} /> {t('addPerson')}</button>}
          </div>
        </div>
      )}
      {show && <StoreFormModal store={editing} onClose={() => setShow(false)} onSaved={() => window.location.reload()} />}
    </div>
  )
}

function AddPerson({ roles, storeId, ROLE, onClose, onDone }) {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(roles[0])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit() {
    setMsg('')
    if (!email || password.length < 6) { setMsg(t('userFormHint2')); return }
    setBusy(true)
    const r = await createUser({ email: email.trim(), password, role, storeId })
    setBusy(false)
    if (r.error) { setMsg(r.error); return }
    onDone()
  }
  return (
    <div style={{ marginTop: 8, padding: 12, background: 'var(--olive-50, #f4f5ec)', borderRadius: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input placeholder={t('password')} value={password} onChange={e => setPassword(e.target.value)} />
        <select value={role} onChange={e => setRole(e.target.value)}>
          {roles.map(r => <option key={r} value={r}>{ROLE[r]}</option>)}
        </select>
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
