import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activity'
import { Plus, Trash2, X } from 'lucide-react'

export default function Ingredients() {
  const [ingredients, setIngredients] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [showForm, setShowForm] = useState(false)

  async function loadAll() {
    const [i, s] = await Promise.all([
      supabase.from('ingredients').select('*').order('name'),
      supabase.from('suppliers').select('*').order('name'),
    ])
    setIngredients(i.data || [])
    setSuppliers(s.data || [])
  }

  useEffect(() => { loadAll() }, [])

  async function deleteIngredient(id) {
    if (!confirm('Διαγραφή πρώτης ύλης;')) return
    const ing = ingredients.find(i => i.id === id)
    await supabase.from('ingredients').delete().eq('id', id)
    await logActivity('delete', 'ingredient', ing?.name)
    loadAll()
  }

  return (
    <div>
      <div className="topbar" style={{marginBottom: 16}}>
        <h1>Πρώτες Ύλες</h1>
      </div>

      <div className="card">
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:12}}>
          <h2 style={{margin:0}}>Πρώτες Ύλες ({ingredients.length})</h2>
          <button className="btn" onClick={() => setShowForm(true)}><Plus size={16}/> Νέα Πρώτη Ύλη</button>
        </div>
        <table>
          <thead><tr><th>Όνομα</th><th>Μονάδα</th><th>Τιμή</th><th>Προμηθευτής</th><th></th></tr></thead>
          <tbody>
            {ingredients.map(ing => (
              <tr key={ing.id}>
                <td>{ing.name}</td>
                <td>{ing.unit}</td>
                <td>{Number(ing.current_price).toFixed(3)} €</td>
                <td>{suppliers.find(s => s.id === ing.supplier_id)?.name || '-'}</td>
                <td><button className="icon-btn danger" onClick={() => deleteIngredient(ing.id)}><Trash2 size={16}/></button></td>
              </tr>
            ))}
            {ingredients.length === 0 && <tr><td colSpan={5}>Δεν υπάρχουν πρώτες ύλες ακόμα.</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <IngredientFormModal suppliers={suppliers} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); loadAll() }} />
      )}
    </div>
  )
}

function IngredientFormModal({ suppliers, onClose, onSaved }) {
  const [form, setForm] = useState({ name:'', unit:'kg', current_price:'', supplier_id:'', min_stock_alert:'' })
  async function save() {
    if (!form.name) return
    await supabase.from('ingredients').insert({
      ...form,
      current_price: Number(form.current_price) || 0,
      min_stock_alert: Number(form.min_stock_alert) || 0,
      supplier_id: form.supplier_id || null,
    })
    await logActivity('create', 'ingredient', form.name)
    onSaved()
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{display:'flex', justifyContent:'space-between'}}><h2>Νέα Πρώτη Ύλη</h2><button className="icon-btn" onClick={onClose}><X/></button></div>
        <div className="form-row"><label>Όνομα</label><input value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></div>
        <div className="form-row"><label>Μονάδα</label>
          <select value={form.unit} onChange={e => setForm({...form, unit:e.target.value})}>
            <option value="kg">kg</option><option value="gr">gr</option><option value="lt">lt</option>
            <option value="ml">ml</option><option value="τεμ">τεμ</option>
          </select>
        </div>
        <div className="form-row"><label>Τιμή ανά μονάδα (€)</label><input type="number" step="0.001" value={form.current_price} onChange={e => setForm({...form, current_price:e.target.value})}/></div>
        <div className="form-row"><label>Προμηθευτής</label>
          <select value={form.supplier_id} onChange={e => setForm({...form, supplier_id:e.target.value})}>
            <option value="">-</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-row"><label>Όριο Ειδοποίησης Αποθέματος</label><input type="number" step="0.1" value={form.min_stock_alert} onChange={e => setForm({...form, min_stock_alert:e.target.value})}/></div>
        <div className="modal-actions"><button className="btn" onClick={save}>Αποθήκευση</button></div>
      </div>
    </div>
  )
}
