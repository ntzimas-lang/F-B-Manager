import { CATEGORIES } from '../lib/categories'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activity'
import { useStores } from '../context/StoreContext'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { Download } from 'lucide-react'
import { exportXlsx } from '../lib/exportExcel'

export default function Stocktake() {
  const { stores, selectedStoreId } = useStores()
  const { t } = useLanguage()
  const { readOnly, canExport } = useAuth()
  const activeStoreId = selectedStoreId !== 'all' ? selectedStoreId : (stores[0]?.id || '')
  const store = stores.find(s => s.id === activeStoreId)

  const [month, setMonth] = useState(new Date().toISOString().slice(0,7))
  const [ingredients, setIngredients] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [fCat, setFCat] = useState('')
  const [fSup, setFSup] = useState('')
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
    const { data: supData } = await supabase.from('suppliers').select('id, name').order('name')
    setSuppliers(supData || [])
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

    for (const it of items) {
      const { data: existingStock } = await supabase.from('inventory_stock').select('*').eq('store_id', activeStoreId).eq('ingredient_id', it.ingredient_id).maybeSingle()
      if (existingStock) {
        await supabase.from('inventory_stock').update({ quantity: it.counted_qty, updated_at: new Date().toISOString() }).eq('id', existingStock.id)
      } else if (it.counted_qty !== 0) {
        await supabase.from('inventory_stock').insert({ store_id: activeStoreId, ingredient_id: it.ingredient_id, quantity: it.counted_qty })
      }
    }
    await logActivity('create', 'stocktake', store?.name, `${t('stocktake')} ${month}`)
    load()
  }

  async function exportCSV(record) {
    const rows = [[t('ingredient'), t('category'), t('supplier'), t('unit'), t('systemQty'), t('realQty'), t('variance'), t('unitPrice'), t('total')]]
    record.stocktake_items.forEach(it => {
      const ing = ingredients.find(i => i.id === it.ingredient_id)
      const p = Number(ing?.current_price || 0)
      rows.push([ing?.name || '', ing?.category || '', suppliers.find(x => x.id === ing?.supplier_id)?.name || '', ing?.unit || '', Number(it.system_qty), Number(it.counted_qty), Number(it.variance), p, Math.round(Number(it.variance) * p * 100) / 100])
    })
    await exportXlsx(`stocktake-${store?.name || ''}-${record.month}`, [{ name: record.month, rows }])
  }

  const shownIngredients = ingredients
    .filter(i => (!fCat || (fCat === '__none' ? !i.category : i.category === fCat)) && (!fSup || i.supplier_id === fSup))
    .sort((a, b) => (a.category || '~').localeCompare(b.category || '~') || a.name.localeCompare(b.name))

  if (!activeStoreId) return <div className="card">{t('addStoreFirst')}</div>

  return (
    <div>
      <div className="topbar" style={{marginBottom:16}}>
        <h1>{t('stocktake')}</h1>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
      </div>

      {selectedStoreId === 'all' && (
        <div className="card" style={{marginBottom:16, background:'var(--olive-50)'}}>
          {t('pickStoreNotice')}
        </div>
      )}
      {existing && (
        <div className="card" style={{marginBottom:16, borderColor:'var(--ok)'}}>
          {t('stocktakeAlreadyRecorded').replace('{month}', month).replace('{date}', existing.date)}
        </div>
      )}

      <div className="card">
        <h2 style={{marginTop:0}}>{t('stocktake')}</h2>
                <div style={{display:'flex', gap:8, marginBottom:12, flexWrap:'wrap'}}>
          <select value={fCat} onChange={e => setFCat(e.target.value)}>
            <option value="">{t('category')}: {t('all')}</option>
            {[...new Set([...CATEGORIES, ...ingredients.map(i => i.category)])].filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
            <option value="__none">{t('noCategory')}</option>
          </select>
          <select value={fSup} onChange={e => setFSup(e.target.value)}>
            <option value="">{t('supplier')}: {t('all')}</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {loading ? <p>{t('loading')}</p> : (
          <>
            <table>
              <thead><tr><th>{t('ingredient')}</th><th>{t('category')}</th><th>{t('supplier')}</th><th>{t('systemQty')}</th><th>{t('realQty')}</th><th>{t('variance')}</th></tr></thead>
              <tbody>
                {shownIngredients.map(ing => {
                  const sys = systemQty(ing.id)
                  const val = counts[ing.id]
                  const counted = val !== undefined && val !== '' ? Number(val) : sys
                  const diff = counted - sys
                  return (
                    <tr key={ing.id}>
                      <td>{ing.name}</td>
                      <td>{ing.category || '-'}</td>
                      <td>{suppliers.find(x => x.id === ing.supplier_id)?.name || '-'}</td>
                      <td>{sys} {ing.unit}</td>
                      <td><input type="number" step="0.01" disabled={readOnly} style={{width:100}} placeholder={String(sys)} value={val ?? ''} onChange={e => setCounts({...counts, [ing.id]: e.target.value})} /></td>
                      <td>{diff !== 0 ? <span style={{color: diff < 0 ? 'var(--danger)' : 'var(--ok)', fontWeight:600}}>{diff > 0 ? '+' : ''}{diff.toFixed(2)}</span> : '—'}</td>
                    </tr>
                  )
                })}
                {ingredients.length === 0 && <tr><td colSpan={6}>{t('noIngredients')}</td></tr>}
              </tbody>
            </table>
            {ingredients.length > 0 && <button className="btn write-btn" style={{marginTop:16}} onClick={saveStocktake}>{t('recordStocktake')}</button>}
          </>
        )}
      </div>

      {past.length > 0 && (
        <div className="card" style={{marginTop:20}}>
          <h2 style={{marginTop:0}}>{t('stocktakeHistory')}</h2>
          <table>
            <thead><tr><th>{t('monthLabel')}</th><th>{t('date')}</th><th>{t('variance')}</th><th></th></tr></thead>
            <tbody>
              {past.map(st => {
                const diffCount = (st.stocktake_items || []).filter(it => it.variance !== 0).length
                return (
                  <tr key={st.id}>
                    <td>{st.month}</td><td>{st.date}</td>
                    <td>{diffCount > 0 ? <span className="badge badge-warn">{diffCount} {t('differences')}</span> : <span className="badge badge-ok">{t('noVariance')}</span>}</td>
                    <td><button className="btn btn-outline export-btn" onClick={() => exportCSV(st)}><Download size={14}/> {t('exportExcel')}</button></td>
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
