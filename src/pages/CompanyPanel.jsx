import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activity'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { createUser, removeUser } from '../lib/userAdmin'
import { Plus, Trash2, Pencil, X, UserPlus } from 'lucide-react'

// Μία εταιρία: επίπεδο Εταιρίας (ιδιοκτήτης, λογιστήριο) και επίπεδο Καταστήματος (οι υπόλοιποι χρήστες).
export default function CompanyPanel({ companyId, maxStores = 9999, onChanged }) {
  const { t } = useLanguage()
  const { isPlatformAdmin, profile } = useAuth()
  const [stores, setStores] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // null | {} (new) | store
  const [addFor, setAddFor] = useState(null) // 'company' | store id

  const ROLE = { super_user: t('superUser'), owner: t('owner'), store_manager: t('storeManager'), shift_manager: t('shiftManager'), accounting: t('accounting') }
  const limitReached = !isPlatformAdmin && stores.length >= maxStores

  async function load() {
    const [s, u] = await Promise.all([
      supabase.from('stores').select('*').eq('company_id', companyId).order('name'),
      supabase.from('profiles').select('*').eq('company_id', companyId).order('email'),
    ])
    setStores(s.data || []); setUsers(u.data || []); setLoading(false)
  }
  useEffect(() => { load() }, [companyId])

  async function delUser(u) {
    if (!confirm(`${t('confirmDelete')} ${u.email}`)) return
    const r = await removeUser(u)
    if (r.error) alert(r.error)
    load(); onChanged?.()
  }
  async function delStore(s) {
    if (!confirm(t('confirmDelete'))) return
    await supabase.from('stores').delete().eq('id', s.id)
    await logActivity('delete', 'store', s.name)
    load(); onChanged?.()
  }

  const companyUsers = users.filter(u => !['store_manager', 'shift_manager'].includes(u.role))
  const people = (list) => (
    <table>
      <tbody>
        {list.map(u => (
          <tr key={u.id}>
            <td>{u.email}</td>
            <td>{ROLE[u.role] || u.role}</td>
            <td style={{ width: 40 }}>{u.id !== profile?.id && <button className="icon-btn danger" onClick={() => delUser(u)}><Trash2 size={16} /></button>}</td>
          </tr>
        ))}
        {list.length === 0 && <tr><td colSpan={3} style={{ color: '#6b6b5f' }}>{t('noUsers')}</td></tr>}
      </tbody>
    </table>
  )

  if (loading) return <p>{t('loading')}</p>

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{t('companyLevel')}</h2>
          {addFor !== 'company' && <button className="btn" onClick={() => setAddFor('company')}><UserPlus size={16} /> {t('addPerson')}</button>}
        </div>
        {addFor === 'company' && <AddPerson companyId={companyId} roles={['owner', 'accounting']} ROLE={ROLE} onClose={() => setAddFor(null)} onDone={() => { setAddFor(null); load(); onChanged?.() }} />}
        {people(companyUsers)}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0' }}>
        <h2 style={{ margin: 0 }}>{t('stores')} {maxStores < 9999 && <span style={{ fontSize: 13, fontWeight: 400 }}>({stores.length} / {maxStores})</span>}</h2>
        <button className="btn" onClick={() => setEditing({})} disabled={limitReached}><Plus size={16} /> {t('newStore')}</button>
      </div>
      {limitReached && <p style={{ fontSize: 13 }}>{t('storeLimitReached')}</p>}
      {stores.length === 0 && <div className="card">{t('noStores')}</div>}
      {stores.map(s => (
        <div className="card" key={s.id} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <b>{s.name} <span style={{ fontWeight: 400, fontSize: 13, color: '#6b6b5f' }}>{[s.code, s.address].filter(Boolean).join(' · ')}</span></b>
            <span style={{ display: 'flex', gap: 6 }}>
              {addFor !== s.id && <button className="btn btn-outline" onClick={() => setAddFor(s.id)}><UserPlus size={16} /> {t('addPerson')}</button>}
              <button className="icon-btn" onClick={() => setEditing(s)}><Pencil size={16} /></button>
              {isPlatformAdmin && <button className="icon-btn danger" onClick={() => delStore(s)}><Trash2 size={16} /></button>}
            </span>
          </div>
          {addFor === s.id && <AddPerson companyId={companyId} storeId={s.id} roles={['store_manager', 'shift_manager']} ROLE={ROLE} onClose={() => setAddFor(null)} onDone={() => { setAddFor(null); load() }} />}
          {people(users.filter(u => u.store_id === s.id))}
        </div>
      ))}
      {editing && <StoreFormModal store={editing.id ? editing : null} companyId={companyId} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); onChanged?.() }} />}
    </div>
  )
}

export function AddPerson({ companyId, storeId, roles, ROLE, onClose, onDone, hint }) {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(roles[0])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit() {
    setMsg('')
    if (!email || password.length < 6) { setMsg(t('userFormHint')); return }
    setBusy(true)
    const r = await createUser({ email: email.trim(), password, role, storeId: storeId || null, companyId })
    setBusy(false)
    if (r.error) { setMsg(r.error); return }
    onDone()
  }
  return (
    <div style={{ marginBottom: 12, padding: 12, background: 'var(--olive-50, #f4f5ec)', borderRadius: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input placeholder={t('password')} value={password} onChange={e => setPassword(e.target.value)} />
        {roles.length > 1 && (
          <select value={role} onChange={e => setRole(e.target.value)}>
            {roles.map(r => <option key={r} value={r}>{ROLE[r]}</option>)}
          </select>
        )}
        <button className="btn" onClick={submit} disabled={busy}>{busy ? t('saving') : t('add')}</button>
        <button className="btn btn-outline" onClick={onClose}>{t('cancel')}</button>
      </div>
      {msg && <p style={{ margin: '8px 0 0', color: 'var(--danger)' }}>{msg}</p>}
    </div>
  )
}

export function StoreFormModal({ store, companyId, onClose, onSaved }) {
  const { t } = useLanguage()
  const isEdit = !!store
  const [form, setForm] = useState({ name: store?.name || '', code: store?.code || '', address: store?.address || '' })
  async function save() {
    if (!form.name) return
    if (isEdit) {
      await supabase.from('stores').update(form).eq('id', store.id)
      await logActivity('update', 'store', form.name)
    } else {
      const { error } = await supabase.from('stores').insert({ ...form, active: true, ...(companyId ? { company_id: companyId } : {}) })
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
