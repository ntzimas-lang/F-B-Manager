import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activity'
import { useStores } from '../context/StoreContext'
import { Plus, X, Trash2 } from 'lucide-react'

const STATUS_LABELS = { draft: 'Πρόχειρη', sent: 'Απεστάλη', received: 'Παραλήφθηκε', cancelled: 'Ακυρώθηκε' }
const STATUS_BADGE = { draft: 'badge-warn', sent: 'badge-warn', received: 'badge-ok', cancelled: 'badge-danger' }

export default function Orders() {
  const { stores, selectedStoreId } = useStores()
  const [tab, setTab] = useState('orders')
  const [orders, setOrders] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [openOrder, setOpenOrder] = useState(null)

  async function load() {
    let q = supabase.from('purchase_orders').select('*, stores(name), suppliers(name)').order('order_date', { ascending: false })
    if (selectedStoreId !== 'all') q = q.eq('store_id', selectedStoreId)
    const [{ data: o }, { data: s }, { data: i }] = await Promise.all([
      q,
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('ingredients').select('*').order('name'),
    ])
    setOrders(o || [])
    setSuppliers(s || [])
    setIngredients(i || [])
  }
  useEffect(() => { load() }, [selectedStoreId])

  async function deleteSupplier(id) {
    if (!confirm('Διαγραφή προμηθευτή;')) return
    const supplier = suppliers.find(s => s.id === id)
    await supabase.from('suppliers').delete().eq('id', id)
    await logActivity('delete', 'supplier', supplier?.name)
    load()
  }

  return (
    <div>
      <div className="topbar" style={{marginBottom:16}}>
        <h1>Παραγγελίες Προμηθευτών</h1>
      </div>

      <div style={{display:'flex', gap:8, marginBottom:20}}>
        <button className={tab==='orders' ? 'btn' : 'btn btn-outline'} onClick={() => setTab('orders')}>Παραγγελίες</button>
        <button className={tab==='suppliers' ? 'btn' : 'btn btn-outline'} onClick={() => setTab('suppliers')}>Προμηθευτές</button>
      </div>

      {tab === 'orders' && (
        <div className="card">
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:12}}>
            <h2 style={{margin:0}}>Παραγγελίες ({orders.length})</h2>
            <button className="btn" onClick={() => setShowOrderForm(true)}><Plus size={16}/> Νέα Παραγγελία</button>
          </div>
          <table>
            <thead><tr><th>Ημ/νία</th><th>Κατάστημα</th><th>Προμηθευτής</th><th>Κατάσταση</th><th></th></tr></thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} style={{cursor:'pointer'}} onClick={() => setOpenOrder(o)}>
                  <td>{o.order_date}</td>
                  <td>{o.stores?.name}</td>
                  <td>{o.suppliers?.name}</td>
                  <td><span className={`badge ${STATUS_BADGE[o.status]}`}>{STATUS_LABELS[o.status]}</span></td>
                  <td></td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={5}>Δεν υπάρχουν παραγγελίες.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'suppliers' && (
        <div className="card">
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:12}}>
            <h2 style={{margin:0}}>Προμηθευτές ({suppliers.length})</h2>
            <button className="btn" onClick={() => setShowSupplierForm(true)}><Plus size={16}/> Νέος Προμηθευτής</button>
          </div>
          <table>
            <thead><tr><th>Όνομα</th><th>Επικοινωνία</th><th>Τηλέφωνο</th><th>Email</th><th></th></tr></thead>
            <tbody>
              {suppliers.map(s => (
                <tr key={s.id}>
                  <td>{s.name}</td><td>{s.contact_name}</td><td>{s.phone}</td><td>{s.email}</td>
                  <td><button className="icon-btn danger" onClick={() => deleteSupplier(s.id)}><Trash2 size={16}/></button></td>
                </tr>
              ))}
              {suppliers.length === 0 && <tr><td colSpan={5}>Δεν υπάρχουν προμηθευτές.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showSupplierForm && (
        <SupplierFormModal onClose={() => setShowSupplierForm(false)} onSaved={() => { setShowSupplierForm(false); load() }} />
      )}
      {showOrderForm && (
        <OrderFormModal stores={stores} suppliers={suppliers} onClose={() => setShowOrderForm(false)} onSaved={() => { setShowOrderForm(false); load() }} />
      )}
      {openOrder && (
        <OrderDetailModal order={openOrder} ingredients={ingredients} onClose={() => setOpenOrder(null)} onChanged={load} />
      )}
    </div>
  )
}

function SupplierFormModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name:'', contact_name:'', phone:'', email:'', notes:'' })
  async function save() {
    if (!form.name) return
    await supabase.from('suppliers').insert(form)
    await logActivity('create', 'supplier', form.name)
    onSaved()
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{display:'flex', justifyContent:'space-between'}}><h2>Νέος Προμηθευτής</h2><button className="icon-btn" onClick={onClose}><X/></button></div>
        <div className="form-row"><label>Όνομα</label><input value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></div>
        <div className="form-row"><label>Υπεύθυνος Επικοινωνίας</label><input value={form.contact_name} onChange={e => setForm({...form, contact_name:e.target.value})}/></div>
        <div className="form-row"><label>Τηλέφωνο</label><input value={form.phone} onChange={e => setForm({...form, phone:e.target.value})}/></div>
        <div className="form-row"><label>Email</label><input value={form.email} onChange={e => setForm({...form, email:e.target.value})}/></div>
        <div className="modal-actions"><button className="btn" onClick={save}>Αποθήκευση</button></div>
      </div>
    </div>
  )
}

function OrderFormModal({ stores, suppliers, onClose, onSaved }) {
  const [form, setForm] = useState({ store_id:'', supplier_id:'', order_date: new Date().toISOString().slice(0,10), expected_date:'', notes:'' })
  async function save() {
    if (!form.store_id || !form.supplier_id) return
    await supabase.from('purchase_orders').insert({ ...form, status:'draft' })
    const supplierName = suppliers.find(s => s.id === form.supplier_id)?.name
    await logActivity('create', 'order', supplierName, `Παραγγελία σε ${supplierName}`)
    onSaved()
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{display:'flex', justifyContent:'space-between'}}><h2>Νέα Παραγγελία</h2><button className="icon-btn" onClick={onClose}><X/></button></div>
        <div className="form-row"><label>Κατάστημα</label>
          <select value={form.store_id} onChange={e => setForm({...form, store_id:e.target.value})}>
            <option value="">Επιλογή...</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-row"><label>Προμηθευτής</label>
          <select value={form.supplier_id} onChange={e => setForm({...form, supplier_id:e.target.value})}>
            <option value="">Επιλογή...</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-row"><label>Ημερομηνία Παραγγελίας</label><input type="date" value={form.order_date} onChange={e => setForm({...form, order_date:e.target.value})}/></div>
        <div className="form-row"><label>Αναμενόμενη Παράδοση</label><input type="date" value={form.expected_date} onChange={e => setForm({...form, expected_date:e.target.value})}/></div>
        <div className="modal-actions"><button className="btn" onClick={save}>Δημιουργία</button></div>
      </div>
    </div>
  )
}

function OrderDetailModal({ order, ingredients, onClose, onChanged }) {
  const [items, setItems] = useState([])
  const [status, setStatus] = useState(order.status)
  const [addIng, setAddIng] = useState('')
  const [addQty, setAddQty] = useState('')

  async function load() {
    const { data } = await supabase.from('purchase_order_items').select('*').eq('purchase_order_id', order.id)
    setItems(data || [])
  }
  useEffect(() => { load() }, [])

  async function addItem() {
    const ing = ingredients.find(i => i.id === addIng)
    if (!ing || !addQty) return
    await supabase.from('purchase_order_items').insert({
      purchase_order_id: order.id, ingredient_id: addIng, quantity: Number(addQty), unit_price: ing.current_price,
    })
    setAddIng(''); setAddQty('')
    load()
  }
  async function removeItem(id) {
    await supabase.from('purchase_order_items').delete().eq('id', id)
    load()
  }
  async function updateStatus(newStatus) {
    setStatus(newStatus)
    await supabase.from('purchase_orders').update({ status: newStatus }).eq('id', order.id)
    await logActivity('update', 'order', order.suppliers?.name, `Κατάσταση παραγγελίας → ${newStatus}`)

    if (newStatus === 'received') {
      // ενημέρωση αποθέματος με βάση τα items
      for (const it of items) {
        const { data: existing } = await supabase
          .from('inventory_stock').select('*').eq('store_id', order.store_id).eq('ingredient_id', it.ingredient_id).maybeSingle()
        if (existing) {
          await supabase.from('inventory_stock').update({ quantity: Number(existing.quantity) + Number(it.quantity), updated_at: new Date().toISOString() }).eq('id', existing.id)
        } else {
          await supabase.from('inventory_stock').insert({ store_id: order.store_id, ingredient_id: it.ingredient_id, quantity: it.quantity })
        }
        await supabase.from('stock_movements').insert({ store_id: order.store_id, ingredient_id: it.ingredient_id, movement_type: 'receipt', quantity: it.quantity, note: `Παραγγελία #${order.id.slice(0,8)}` })
      }
    }
    onChanged()
  }

  const total = items.reduce((s, it) => s + it.quantity * it.unit_price, 0)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{width:560}}>
        <div style={{display:'flex', justifyContent:'space-between'}}>
          <h2>{order.suppliers?.name} — {order.stores?.name}</h2>
          <button className="icon-btn" onClick={onClose}><X/></button>
        </div>

        <div className="form-row"><label>Κατάσταση</label>
          <select value={status} onChange={e => updateStatus(e.target.value)}>
            <option value="draft">Πρόχειρη</option>
            <option value="sent">Απεστάλη</option>
            <option value="received">Παραλήφθηκε</option>
            <option value="cancelled">Ακυρώθηκε</option>
          </select>
        </div>

        <table style={{marginBottom:12}}>
          <thead><tr><th>Πρώτη Ύλη</th><th>Ποσότητα</th><th>Τιμή</th><th>Σύνολο</th><th></th></tr></thead>
          <tbody>
            {items.map(it => {
              const ing = ingredients.find(i => i.id === it.ingredient_id)
              return (
                <tr key={it.id}>
                  <td>{ing?.name}</td>
                  <td>{it.quantity} {ing?.unit}</td>
                  <td>{Number(it.unit_price).toFixed(3)} €</td>
                  <td>{(it.quantity * it.unit_price).toFixed(2)} €</td>
                  <td><button className="icon-btn danger" onClick={() => removeItem(it.id)}><Trash2 size={14}/></button></td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div style={{display:'flex', gap:8, marginBottom:16}}>
          <select value={addIng} onChange={e => setAddIng(e.target.value)} style={{flex:1}}>
            <option value="">Επιλογή πρώτης ύλης...</option>
            {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <input type="number" step="0.01" placeholder="ποσότητα" value={addQty} onChange={e => setAddQty(e.target.value)} style={{width:100}}/>
          <button className="btn" onClick={addItem}><Plus size={16}/></button>
        </div>

        <div className="stat-label">Σύνολο Παραγγελίας</div>
        <div className="stat-value">{total.toFixed(2)} €</div>
      </div>
    </div>
  )
}
