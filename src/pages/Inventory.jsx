import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStores } from '../context/StoreContext'
import { Plus, X } from 'lucide-react'

export default function Inventory() {
  const { stores, selectedStoreId } = useStores()
  const [stock, setStock] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showMove, setShowMove] = useState(false)

  async function load() {
    setLoading(true)
    let query = supabase.from('inventory_stock').select('*, ingredients(*), stores(name)')
    if (selectedStoreId !== 'all') query = query.eq('store_id', selectedStoreId)
    const [{ data: stockData }, { data: ingData }] = await Promise.all([
      query,
      supabase.from('ingredients').select('*').order('name'),
    ])
    setStock(stockData || [])
    setIngredients(ingData || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [selectedStoreId])

  const lowStock = stock.filter(s => s.ingredients && s.quantity <= s.ingredients.min_stock_alert && s.ingredients.min_stock_alert > 0)

  return (
    <div>
      <div className="topbar" style={{marginBottom:16}}>
        <h1>Απόθεμα</h1>
        <button className="btn" onClick={() => setShowMove(true)}><Plus size={16}/> Κίνηση Αποθέματος</button>
      </div>

      {lowStock.length > 0 && (
        <div className="card" style={{marginBottom:20, borderColor:'var(--danger)'}}>
          <h2 style={{marginTop:0, color:'var(--danger)'}}>⚠ Χαμηλό Απόθεμα</h2>
          <ul style={{margin:0, paddingRight:20}}>
            {lowStock.map(s => (
              <li key={s.id}>{s.ingredients.name} — {s.stores?.name}: {s.quantity} {s.ingredients.unit} (όριο {s.ingredients.min_stock_alert})</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2 style={{marginTop:0}}>Τρέχον Απόθεμα {selectedStoreId==='all' ? '(Όλα τα Καταστήματα)' : ''}</h2>
        {loading ? <p>Φόρτωση...</p> : (
          <table>
            <thead><tr><th>Πρώτη Ύλη</th>{selectedStoreId==='all' && <th>Κατάστημα</th>}<th>Ποσότητα</th><th>Κατάσταση</th></tr></thead>
            <tbody>
              {stock.map(s => (
                <tr key={s.id}>
                  <td>{s.ingredients?.name}</td>
                  {selectedStoreId==='all' && <td>{s.stores?.name}</td>}
                  <td>{s.quantity} {s.ingredients?.unit}</td>
                  <td>
                    {s.ingredients?.min_stock_alert > 0 && s.quantity <= s.ingredients.min_stock_alert
                      ? <span className="badge badge-danger">Χαμηλό</span>
                      : <span className="badge badge-ok">Επαρκές</span>}
                  </td>
                </tr>
              ))}
              {stock.length === 0 && <tr><td colSpan={4}>Δεν υπάρχει καταχωρημένο απόθεμα.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {showMove && (
        <MovementModal stores={stores} ingredients={ingredients} defaultStore={selectedStoreId!=='all'?selectedStoreId:''} onClose={() => setShowMove(false)} onSaved={() => { setShowMove(false); load() }} />
      )}
    </div>
  )
}

function MovementModal({ stores, ingredients, defaultStore, onClose, onSaved }) {
  const [form, setForm] = useState({ store_id: defaultStore, ingredient_id:'', movement_type:'receipt', quantity:'', note:'' })

  async function save() {
    if (!form.store_id || !form.ingredient_id || !form.quantity) return
    let qty = Number(form.quantity)
    if (form.movement_type === 'waste' || form.movement_type === 'consumption') qty = -Math.abs(qty)

    await supabase.from('stock_movements').insert({ ...form, quantity: qty })

    // ενημέρωση τρέχοντος αποθέματος
    const { data: existing } = await supabase
      .from('inventory_stock')
      .select('*')
      .eq('store_id', form.store_id)
      .eq('ingredient_id', form.ingredient_id)
      .maybeSingle()

    if (existing) {
      await supabase.from('inventory_stock').update({
        quantity: Number(existing.quantity) + qty,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      await supabase.from('inventory_stock').insert({
        store_id: form.store_id, ingredient_id: form.ingredient_id, quantity: Math.max(qty, 0),
      })
    }
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{display:'flex', justifyContent:'space-between'}}><h2>Κίνηση Αποθέματος</h2><button className="icon-btn" onClick={onClose}><X/></button></div>
        <div className="form-row"><label>Κατάστημα</label>
          <select value={form.store_id} onChange={e => setForm({...form, store_id:e.target.value})}>
            <option value="">Επιλογή...</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-row"><label>Πρώτη Ύλη</label>
          <select value={form.ingredient_id} onChange={e => setForm({...form, ingredient_id:e.target.value})}>
            <option value="">Επιλογή...</option>
            {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
          </select>
        </div>
        <div className="form-row"><label>Τύπος Κίνησης</label>
          <select value={form.movement_type} onChange={e => setForm({...form, movement_type:e.target.value})}>
            <option value="receipt">Παραλαβή</option>
            <option value="waste">Φύρα</option>
            <option value="consumption">Ανάλωση</option>
            <option value="adjustment">Διόρθωση</option>
          </select>
        </div>
        <div className="form-row"><label>Ποσότητα</label><input type="number" step="0.01" value={form.quantity} onChange={e => setForm({...form, quantity:e.target.value})}/></div>
        <div className="form-row"><label>Σημείωση</label><input value={form.note} onChange={e => setForm({...form, note:e.target.value})}/></div>
        <div className="modal-actions"><button className="btn" onClick={save}>Αποθήκευση</button></div>
      </div>
    </div>
  )
}
