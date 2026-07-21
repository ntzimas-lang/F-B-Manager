import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStores } from '../context/StoreContext'
import { Download } from 'lucide-react'

export default function Stocktake() {
  const { stores, selectedStoreId } = useStores()
  const activeStoreId = selectedStoreId !== 'all' ? selectedStoreId : (stores[0]?.id || '')
  const store = stores.find(s => s.id === activeStoreId)

  const [month, setMonth] = useState(new Date().toISOString().slice(0,7))
  const [ingredients, setIngredients] = useState([])
  const [stockMap, setStockMap] = useState({})
  const [counts, setCounts] = useState({})
  const [existing, setExisting] = useState(null)
  const [past, setPast] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!activeStoreId) { setLoading(false); return }
    setLoading(true)
    const [{ data: ing }, { data: stock }, { data: st }, { data: pastList }] = await Promise.all([
      supabase.from('ingredients').select('*').order('name'),
      supabase.from('inventory_stock').select('*').eq('store_id', activeStoreId),
      supabase.from('stocktakes').select('*, stocktake_items(*)').eq('store_id', activeStoreId).eq('month', month).maybeSingle(),
      supabase.from('stocktakes').select('*, stocktake_items(*)').eq('store_id', activeStoreId).order('month', { ascending: false }),
    ])
    setIngredients(ing || [])
    setStockMap(Object.fromEntries((stock || []).map(s => [s.ingredient_id, s.quantity])))
    setExisting(st || null)
    setPast(pastList || [])
    setCounts({})
    setLoading(false)
  }
  useEffect(() => { load() }, [activeStoreId, month])

  function systemQty(id) { return stockMap[id] || 0 }

  async function saveStocktake() {
    const items = ingredients.map(ing => {
      const sys = systemQty(ing.id)
      const counted = counts[ing.id] !== undefined && counts[ing.id] !== '' ? Number(counts[ing.id]) : sys
      return { ingredient_id: ing.id, system_qty: sys, counted_qty: counted, variance: counted - sys }
    })

    let stocktakeId
    if (existing) {
      stocktakeId = existing.id
      await supabase.from('stocktake_items').delete().eq('stocktake_id', stocktakeId)
      await supabase.from('stocktakes').update({ date: new Date().toISOString().slice(0,10) }).eq('id', stocktakeId)
    } else {
      const { data } = await supabase.from('stocktakes').insert({ store_id: activeStoreId, month }).select().single()
      stocktakeId = data.id
    }
    await supabase.from('stocktake_items').insert(items.map(it => ({ ...it, stocktake_id: stocktakeId })))

    // ενημέρωση αποθέματος ώστε να ταιριάζει με την καταμέτρηση
    for (const it of items) {
      const { data: existingStock } = await supabase.from('inventory_stock').select('*').eq('store_id', activeStoreId).eq('ingredient_id', it.ingredient_id).maybeSingle()
      if (existingStock) {
        await supabase.from('inventory_stock').update({ quantity: it.counted_qty, updated_at: new Date().toISOString() }).eq('id', existingStock.id)
      } else if (it.counted_qty !== 0) {
        await supabase.from('inventory_stock').insert({ store_id: activeStoreId, ingredient_id: it.ingredient_id, quantity: it.counted_qty })
      }
    }
    load()
  }

  function exportCSV(record) {
    const rows = [['Πρώτη Ύλη', 'Σύστημα', 'Καταμέτρηση', 'Διαφορά']]
    record.stocktake_items.forEach(it => {
      const ing = ingredients.find(i => i.id === it.ingredient_id)
      rows.push([ing?.name || '', it.system_qty, it.counted_qty, it.variance])
    })
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `apografi-${store?.name || ''}-${record.month}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (!activeStoreId) return <div className="card">Πρόσθεσε πρώτα ένα κατάστημα για να ξεκινήσεις απογραφή.</div>

  return (
    <div>
      <div className="topbar" style={{marginBottom:16}}>
        <h1>Απογραφή {store ? `— ${store.name}` : ''}</h1>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
      </div>

      {selectedStoreId === 'all' && (
        <div className="card" style={{marginBottom:16, background:'var(--olive-50)'}}>
          Επίλεξε συγκεκριμένο κατάστημα πάνω δεξιά. Προς το παρόν δείχνει το πρώτο κατάστημα.
        </div>
      )}
      {existing && (
        <div className="card" style={{marginBottom:16, borderColor:'var(--ok)'}}>
          Η απογραφή για {month} έχει ήδη καταχωρηθεί ({existing.date}). Μπορείς να την ξανακάνεις για ενημέρωση.
        </div>
      )}

      <div className="card">
        <h2 style={{marginTop:0}}>Καταμέτρηση — {month}</h2>
        {loading ? <p>Φόρτωση...</p> : (
          <>
            <table>
              <thead><tr><th>Πρώτη Ύλη</th><th>Σύστημα</th><th>Πραγματική Ποσότητα</th><th>Διαφορά</th></tr></thead>
              <tbody>
                {ingredients.map(ing => {
                  const sys = systemQty(ing.id)
                  const val = counts[ing.id]
                  const counted = val !== undefined && val !== '' ? Number(val) : sys
                  const diff = counted - sys
                  return (
                    <tr key={ing.id}>
                      <td>{ing.name}</td>
                      <td>{sys} {ing.unit}</td>
                      <td><input type="number" step="0.01" style={{width:100}} placeholder={String(sys)} value={val ?? ''} onChange={e => setCounts({...counts, [ing.id]: e.target.value})} /></td>
                      <td>{diff !== 0 ? <span style={{color: diff < 0 ? 'var(--danger)' : 'var(--ok)', fontWeight:600}}>{diff > 0 ? '+' : ''}{diff.toFixed(2)}</span> : '—'}</td>
                    </tr>
                  )
                })}
                {ingredients.length === 0 && <tr><td colSpan={4}>Δεν υπάρχουν πρώτες ύλες ακόμα.</td></tr>}
              </tbody>
            </table>
            {ingredients.length > 0 && <button className="btn" style={{marginTop:16}} onClick={saveStocktake}>Καταχώρηση Απογραφής</button>}
          </>
        )}
      </div>

      {past.length > 0 && (
        <div className="card" style={{marginTop:20}}>
          <h2 style={{marginTop:0}}>Ιστορικό Απογραφών</h2>
          <table>
            <thead><tr><th>Μήνας</th><th>Ημερομηνία</th><th>Διαφορές</th><th></th></tr></thead>
            <tbody>
              {past.map(st => {
                const diffCount = (st.stocktake_items || []).filter(it => it.variance !== 0).length
                return (
                  <tr key={st.id}>
                    <td>{st.month}</td><td>{st.date}</td>
                    <td>{diffCount > 0 ? <span className="badge badge-warn">{diffCount} διαφορές</span> : <span className="badge badge-ok">Χωρίς διαφορές</span>}</td>
                    <td><button className="btn btn-outline" onClick={() => exportCSV(st)}><Download size={14}/> Export</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
