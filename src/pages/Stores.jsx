import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStores } from '../context/StoreContext'
import { Plus, Trash2, X } from 'lucide-react'

export default function Stores() {
  const { stores, loading } = useStores()
  const [show, setShow] = useState(false)

  async function remove(id) {
    if (!confirm('Διαγραφή καταστήματος;')) return
    await supabase.from('stores').delete().eq('id', id)
    window.location.reload()
  }

  return (
    <div>
      <div className="topbar" style={{marginBottom:16}}>
        <h1>Καταστήματα</h1>
        <button className="btn" onClick={() => setShow(true)}><Plus size={16}/> Νέο Κατάστημα</button>
      </div>
      <div className="card">
        {loading ? <p>Φόρτωση...</p> : (
          <table>
            <thead><tr><th>Όνομα</th><th>Κωδικός</th><th>Διεύθυνση</th><th></th></tr></thead>
            <tbody>
              {stores.map(s => (
                <tr key={s.id}>
                  <td>{s.name}</td><td>{s.code}</td><td>{s.address}</td>
                  <td><button className="icon-btn danger" onClick={() => remove(s.id)}><Trash2 size={16}/></button></td>
                </tr>
              ))}
              {stores.length === 0 && <tr><td colSpan={4}>Δεν υπάρχουν καταστήματα ακόμα.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      {show && <StoreFormModal onClose={() => setShow(false)} onSaved={() => window.location.reload()} />}
    </div>
  )
}

function StoreFormModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name:'', code:'', address:'' })
  async function save() {
    if (!form.name) return
    await supabase.from('stores').insert({ ...form, active: true })
    onSaved()
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{display:'flex', justifyContent:'space-between'}}><h2>Νέο Κατάστημα</h2><button className="icon-btn" onClick={onClose}><X/></button></div>
        <div className="form-row"><label>Όνομα</label><input value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></div>
        <div className="form-row"><label>Κωδικός</label><input value={form.code} onChange={e => setForm({...form, code:e.target.value})}/></div>
        <div className="form-row"><label>Διεύθυνση</label><input value={form.address} onChange={e => setForm({...form, address:e.target.value})}/></div>
        <div className="modal-actions"><button className="btn" onClick={save}>Αποθήκευση</button></div>
      </div>
    </div>
  )
}
