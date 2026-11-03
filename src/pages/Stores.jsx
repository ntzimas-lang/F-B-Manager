import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activity'
import { useStores } from '../context/StoreContext'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { Plus, Trash2, Pencil, X } from 'lucide-react'

export default function Stores() {
  const { stores, loading } = useStores()
  const { t } = useLanguage()
  const { maxStores, isPlatformAdmin, role } = useAuth()
  const canCreate = isPlatformAdmin || role === 'super_user' || role === 'owner'
  const limitReached = !isPlatformAdmin && stores.length >= maxStores
  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState(null) // null = νέο, αντικείμενο = επεξεργασία

  async function remove(id) {
    if (!confirm(t('confirmDelete'))) return
    const store = stores.find(s => s.id === id)
    await supabase.from('stores').delete().eq('id', id)
    await logActivity('delete', 'store', store?.name)
    window.location.reload()
  }

  function openNew() { setEditing(null); setShow(true) }
  function openEdit(store) { setEditing(store); setShow(true) }

  return (
    <div>
      <div className="topbar" style={{marginBottom:16}}>
        <h1>{t('stores')}</h1>
        <div style={{display:'flex', gap:12, alignItems:'center'}}>
          {maxStores < 9999 && <span style={{fontSize:13}}>{stores.length} / {maxStores}</span>}
          {canCreate && <button className="btn write-btn" onClick={openNew} disabled={limitReached}><Plus size={16}/> {t('newStore')}</button>}
        </div>
      </div>
      {limitReached && <div className="card" style={{marginBottom:16, background:'var(--olive-50)'}}>{t('storeLimitReached')}</div>}
      <div className="card">
        {loading ? <p>{t('loading')}</p> : (
          <table>
            <thead><tr><th>{t('name')}</th><th>{t('code')}</th><th>{t('address')}</th><th></th></tr></thead>
            <tbody>
              {stores.map(s => (
                <tr key={s.id}>
                  <td>{s.name}</td><td>{s.code}</td><td>{s.address}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="icon-btn write-btn" onClick={() => openEdit(s)}><Pencil size={16}/></button>
                    {isPlatformAdmin && <button className="icon-btn danger write-btn" onClick={() => remove(s.id)}><Trash2 size={16}/></button>}
                  </td>
                </tr>
              ))}
              {stores.length === 0 && <tr><td colSpan={4}>{t('noStores')}</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      {show && <StoreFormModal store={editing} onClose={() => setShow(false)} onSaved={() => window.location.reload()} />}
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
        <div style={{display:'flex', justifyContent:'space-between'}}><h2>{isEdit ? `${t('edit')} — ${store.name}` : t('newStore')}</h2><button className="icon-btn" onClick={onClose}><X/></button></div>
        <div className="form-row"><label>{t('name')}</label><input value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></div>
        <div className="form-row"><label>{t('code')}</label><input value={form.code} onChange={e => setForm({...form, code:e.target.value})}/></div>
        <div className="form-row"><label>{t('address')}</label><input value={form.address} onChange={e => setForm({...form, address:e.target.value})}/></div>
        <div className="modal-actions"><button className="btn" onClick={save}>{t('save')}</button></div>
      </div>
    </div>
  )
}
