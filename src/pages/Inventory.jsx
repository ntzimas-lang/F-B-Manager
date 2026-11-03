import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activity'
import { useStores } from '../context/StoreContext'
import { useLanguage } from '../context/LanguageContext'
import { Plus, X, Download } from 'lucide-react'
import { exportXlsx } from '../lib/exportExcel'

export default function Inventory() {
  const { stores, selectedStoreId } = useStores()
  const { t } = useLanguage()
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

  async function exportStock() {
    const rows = [[t('ingredients'), t('store'), t('quantity'), t('unit'), t('unitPrice'), t('total')]]
    stock.forEach(s => {
      const q = Number(s.quantity), p = Number(s.ingredients?.current_price || 0)
      rows.push([s.ingredients?.name || '', s.stores?.name || '', q, s.ingredients?.unit || '', p, Math.round(q * p * 100) / 100])
    })
    await exportXlsx(`stock-${new Date().toISOString().slice(0, 10)}`, [{ name: t('stockSheet'), rows }])
  }

  const lowStock = stock.filter(s => s.ingredients && s.quantity <= s.ingredients.min_stock_alert && s.ingredients.min_stock_alert > 0)

  return (
    <div>
      <div className="topbar" style={{marginBottom:16}}>
        <h1>{t('inventory')}</h1>
        <div style={{display:'flex', gap:8}}>
          <button className="btn btn-outline export-btn" onClick={exportStock}><Download size={16}/> {t('exportExcel')}</button>
          <button className="btn write-btn" onClick={() => setShowMove(true)}><Plus size={16}/> {t('newMovement')}</button>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="card" style={{marginBottom:20, borderColor:'var(--danger)'}}>
          <h2 style={{marginTop:0, color:'var(--danger)'}}>⚠ {t('lowStockAlertTitle')}</h2>
          <ul style={{margin:0, paddingRight:20}}>
            {lowStock.map(s => (
              <li key={s.id}>{s.ingredients.name} — {s.stores?.name}: {s.quantity} {s.ingredients.unit} ({t('thresholdWord')} {s.ingredients.min_stock_alert})</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2 style={{marginTop:0}}>{t('currentStockTitle')} {selectedStoreId==='all' ? `(${t('allStores')})` : ''}</h2>
        {loading ? <p>{t('loading')}</p> : (
          <table>
            <thead><tr><th>{t('ingredients')}</th>{selectedStoreId==='all' && <th>{t('store')}</th>}<th>{t('quantity')}</th><th>{t('condition')}</th></tr></thead>
            <tbody>
              {stock.map(s => (
                <tr key={s.id}>
                  <td>{s.ingredients?.name}</td>
                  {selectedStoreId==='all' && <td>{s.stores?.name}</td>}
                  <td>{s.quantity} {s.ingredients?.unit}</td>
                  <td>
                    {s.ingredients?.min_stock_alert > 0 && s.quantity <= s.ingredients.min_stock_alert
                      ? <span className="badge badge-danger">{t('lowBadge')}</span>
                      : <span className="badge badge-ok">{t('sufficientBadge')}</span>}
                  </td>
                </tr>
              ))}
              {stock.length === 0 && <tr><td colSpan={4}>{t('noStock')}</td></tr>}
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
  const { t } = useLanguage()
  const [form, setForm] = useState({ store_id: defaultStore, ingredient_id:'', movement_type:'receipt', quantity:'', note:'' })

  async function save() {
    if (!form.store_id || !form.ingredient_id || !form.quantity) return
    let qty = Number(form.quantity)
    if (form.movement_type === 'waste' || form.movement_type === 'consumption') qty = -Math.abs(qty)

    await supabase.from('stock_movements').insert({ ...form, quantity: qty })

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
    const ingName = ingredients.find(i => i.id === form.ingredient_id)?.name
    await logActivity('create', 'stock_movement', ingName, `${form.movement_type}: ${qty}`)
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{display:'flex', justifyContent:'space-between'}}><h2>{t('newMovement')}</h2><button className="icon-btn" onClick={onClose}><X/></button></div>
        <div className="form-row"><label>{t('store')}</label>
          <select value={form.store_id} onChange={e => setForm({...form, store_id:e.target.value})}>
            <option value="">{t('selectOption')}</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-row"><label>{t('ingredient')}</label>
          <select value={form.ingredient_id} onChange={e => setForm({...form, ingredient_id:e.target.value})}>
            <option value="">{t('selectOption')}</option>
            {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
          </select>
        </div>
        <div className="form-row"><label>{t('movementType')}</label>
          <select value={form.movement_type} onChange={e => setForm({...form, movement_type:e.target.value})}>
            <option value="receipt">{t('receipt')}</option>
            <option value="waste">{t('waste')}</option>
            <option value="consumption">{t('consumption')}</option>
            <option value="adjustment">{t('adjustment')}</option>
          </select>
        </div>
        <div className="form-row"><label>{t('quantity')}</label><input type="number" step="0.01" value={form.quantity} onChange={e => setForm({...form, quantity:e.target.value})}/></div>
        <div className="form-row"><label>{t('notes')}</label><input value={form.note} onChange={e => setForm({...form, note:e.target.value})}/></div>
        <div className="modal-actions"><button className="btn" onClick={save}>{t('save')}</button></div>
      </div>
    </div>
  )
}
