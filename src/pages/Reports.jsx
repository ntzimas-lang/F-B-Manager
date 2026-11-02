import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStores } from '../context/StoreContext'
import { useLanguage } from '../context/LanguageContext'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d) }
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000) + 1

// Επιστρέφει {start, end} για τον τύπο περιόδου και το "anchor" (έτος, δείκτης)
function rangeFor(type, anchor, custom) {
  const { y, i } = anchor
  if (type === 'month') return { start: `${y}-${pad(i + 1)}-01`, end: ymd(new Date(y, i + 1, 0)) }
  if (type === 'quarter') return { start: `${y}-${pad(i * 3 + 1)}-01`, end: ymd(new Date(y, i * 3 + 3, 0)) }
  if (type === 'year') return { start: `${y}-01-01`, end: `${y}-12-31` }
  return { start: custom.start, end: custom.end }
}

export default function Reports() {
  const { stores, selectedStoreId } = useStores()
  const { t, lang } = useLanguage()
  const now = new Date()
  const [type, setType] = useState('month')
  const [anchor, setAnchor] = useState({ y: now.getFullYear(), i: now.getMonth() })
  const [custom, setCustom] = useState({ start: `${now.getFullYear()}-05-01`, end: `${now.getFullYear()}-09-30` })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const range = useMemo(() => rangeFor(type, anchor, custom), [type, anchor, custom])
  const prevRange = useMemo(() => {
    if (type === 'month') return rangeFor('month', anchor.i === 0 ? { y: anchor.y - 1, i: 11 } : { y: anchor.y, i: anchor.i - 1 })
    if (type === 'quarter') return rangeFor('quarter', anchor.i === 0 ? { y: anchor.y - 1, i: 3 } : { y: anchor.y, i: anchor.i - 1 })
    if (type === 'year') return rangeFor('year', { y: anchor.y - 1 })
    const len = daysBetween(custom.start, custom.end)
    return { start: addDays(custom.start, -len), end: addDays(custom.start, -1) }
  }, [type, anchor, custom])

  function changeType(newType) {
    setType(newType)
    if (newType === 'month') setAnchor({ y: now.getFullYear(), i: now.getMonth() })
    if (newType === 'quarter') setAnchor({ y: now.getFullYear(), i: Math.floor(now.getMonth() / 3) })
    if (newType === 'year') setAnchor({ y: now.getFullYear(), i: 0 })
  }
  function shift(dir) {
    if (type === 'month') setAnchor(a => { const m = a.i + dir; return { y: a.y + Math.floor(m / 12), i: ((m % 12) + 12) % 12 } })
    if (type === 'quarter') setAnchor(a => { const q = a.i + dir; return { y: a.y + Math.floor(q / 4), i: ((q % 4) + 4) % 4 } })
    if (type === 'year') setAnchor(a => ({ ...a, y: a.y + dir }))
  }

  async function fetchPeriod(r, recipeCost) {
    const storeFilter = selectedStoreId !== 'all' ? selectedStoreId : null
    let salesQ = supabase.from('sales').select('date, sale_items(recipe_id, quantity, unit_price)').gte('date', r.start).lte('date', r.end)
    let recQ = supabase.from('goods_receipt_items').select('quantity, unit_price, goods_receipts!inner(receipt_date, store_id)')
      .not('unit_price', 'is', null).gte('goods_receipts.receipt_date', r.start).lte('goods_receipts.receipt_date', r.end)
    let wasteQ = supabase.from('stock_movements').select('ingredient_id, quantity').eq('movement_type', 'waste')
      .gte('created_at', r.start + 'T00:00:00').lt('created_at', addDays(r.end, 1) + 'T00:00:00')
    if (storeFilter) {
      salesQ = salesQ.eq('store_id', storeFilter)
      recQ = recQ.eq('goods_receipts.store_id', storeFilter)
      wasteQ = wasteQ.eq('store_id', storeFilter)
    }
    const [{ data: sales }, { data: recs }, { data: waste }] = await Promise.all([salesQ, recQ, wasteQ])
    return { sales: sales || [], recs: recs || [], waste: waste || [], recipeCost }
  }

  useEffect(() => {
    async function load() {
      if (!range.start || !range.end || range.end < range.start) { setLoading(false); return }
      setLoading(true)
      const [{ data: recipes }, { data: links }, { data: ings }] = await Promise.all([
        supabase.from('recipes').select('id, name'),
        supabase.from('recipe_ingredients').select('*'),
        supabase.from('ingredients').select('id, current_price'),
      ])
      const priceMap = Object.fromEntries((ings || []).map(i => [i.id, Number(i.current_price) || 0]))
      const recipeCost = {}
      for (const r of recipes || []) {
        recipeCost[r.id] = (links || []).filter(l => l.recipe_id === r.id).reduce((s, l) => s + (priceMap[l.ingredient_id] || 0) * Number(l.quantity), 0)
      }
      const [cur, prev] = await Promise.all([fetchPeriod(range, recipeCost), fetchPeriod(prevRange, recipeCost)])
      setData({ cur, prev, recipes: recipes || [], priceMap })
      setLoading(false)
    }
    load()
  }, [range.start, range.end, selectedStoreId])

  function summarize(p) {
    if (!p) return null
    let revenue = 0, cost = 0, portions = 0
    const byDish = {}, byMonth = {}
    for (const s of p.sales) {
      for (const it of s.sale_items || []) {
        const q = Number(it.quantity), rev = q * Number(it.unit_price), c = q * (p.recipeCost[it.recipe_id] || 0)
        revenue += rev; cost += c; portions += q
        const d = (byDish[it.recipe_id] ||= { portions: 0, revenue: 0, cost: 0 })
        d.portions += q; d.revenue += rev; d.cost += c
        const m = (byMonth[s.date.slice(0, 7)] ||= { revenue: 0, cost: 0 })
        m.revenue += rev; m.cost += c
      }
    }
    const purchases = p.recs.reduce((a, r) => a + Number(r.quantity) * Number(r.unit_price), 0)
    const waste = p.waste.reduce((a, w) => a + Math.abs(Number(w.quantity)) * (data?.priceMap[w.ingredient_id] || 0), 0)
    return { revenue, cost, margin: revenue - cost, foodCostPct: revenue > 0 ? (cost / revenue) * 100 : 0, portions, purchases, waste, byDish, byMonth }
  }

  const cur = useMemo(() => summarize(data?.cur), [data])
  const prev = useMemo(() => summarize(data?.prev), [data])

  const MONTHS = lang === 'el'
    ? ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const label = type === 'month' ? `${MONTHS[anchor.i]} ${anchor.y}` : type === 'quarter' ? `Q${anchor.i + 1} ${anchor.y}` : type === 'year' ? String(anchor.y) : `${range.start} → ${range.end}`

  const fmt = (n) => Number(n).toLocaleString(lang === 'el' ? 'el-GR' : 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  function delta(c, p, goodIsUp = true) {
    if (!p || !(p > 0)) return null
    const pct = ((c - p) / p) * 100
    if (Math.abs(pct) < 0.5) return <span style={{ fontSize: 12, color: '#6b6b5f' }}>= {t('vsPrev')}</span>
    const good = goodIsUp ? pct > 0 : pct < 0
    return <span style={{ fontSize: 12, fontWeight: 600, color: good ? 'var(--ok)' : 'var(--danger)' }}>{pct > 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}% {t('vsPrev')}</span>
  }

  function exportCSV() {
    if (!cur) return
    const rows = [[t('dishes'), t('portions'), t('revenue'), t('cost'), t('grossMargin')]]
    for (const [id, d] of Object.entries(cur.byDish)) {
      rows.push([data.recipes.find(r => r.id === id)?.name || '', d.portions, d.revenue.toFixed(2), d.cost.toFixed(2), (d.revenue - d.cost).toFixed(2)])
    }
    const csv = '﻿' + rows.map(r => r.join(';')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    a.download = `results-${range.start}_${range.end}.csv`; a.click()
  }

  const tabBtn = (k, text) => (
    <button key={k} onClick={() => changeType(k)} className={'btn' + (type === k ? '' : ' btn-outline')} style={{ padding: '7px 14px' }}>{text}</button>
  )
  const monthRows = cur ? Object.entries(cur.byMonth).sort(([a], [b]) => a.localeCompare(b)) : []

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 16 }}>
        <h1>{t('results')}</h1>
        <button className="btn btn-outline" onClick={exportCSV}><Download size={16} /> {t('exportCsv')}</button>
      </div>

      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {tabBtn('month', t('month'))}{tabBtn('quarter', t('quarter'))}{tabBtn('year', t('year'))}{tabBtn('season', t('season'))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {type !== 'season' ? (
            <>
              <button className="icon-btn" onClick={() => shift(-1)}><ChevronLeft /></button>
              <strong style={{ minWidth: 140, textAlign: 'center' }}>{label}</strong>
              <button className="icon-btn" onClick={() => shift(1)}><ChevronRight /></button>
            </>
          ) : (
            <>
              <input type="date" value={custom.start} onChange={e => setCustom({ ...custom, start: e.target.value })} />
              <span>→</span>
              <input type="date" value={custom.end} onChange={e => setCustom({ ...custom, end: e.target.value })} />
            </>
          )}
        </div>
      </div>

      {selectedStoreId === 'all' && stores.length > 1 && (
        <div className="card" style={{ marginBottom: 16, background: 'var(--olive-50)', fontSize: 13 }}>{t('allStoresTotal')}</div>
      )}

      {loading || !cur ? <p>{t('loading')}</p> : (
        <>
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            <div className="card"><div className="stat-label">{t('revenue')}</div><div className="stat-value">{fmt(cur.revenue)} €</div>{delta(cur.revenue, prev?.revenue)}</div>
            <div className="card"><div className="stat-label">{t('foodCostAmount')}</div><div className="stat-value">{fmt(cur.cost)} €</div>{delta(cur.cost, prev?.cost, false)}</div>
            <div className="card"><div className="stat-label">{t('grossMargin')}</div><div className="stat-value">{fmt(cur.margin)} €</div>{delta(cur.margin, prev?.margin)}</div>
            <div className="card"><div className="stat-label">{t('foodCostPct')}</div><div className="stat-value">{cur.foodCostPct.toFixed(1)}%</div>{delta(cur.foodCostPct, prev?.foodCostPct, false)}</div>
          </div>
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            <div className="card"><div className="stat-label">{t('portions')}</div><div className="stat-value">{cur.portions}</div>{delta(cur.portions, prev?.portions)}</div>
            <div className="card"><div className="stat-label">{t('purchases')}</div><div className="stat-value">{fmt(cur.purchases)} €</div>{delta(cur.purchases, prev?.purchases, false)}</div>
            <div className="card"><div className="stat-label">{t('wasteValue')}</div><div className="stat-value">{fmt(cur.waste)} €</div>{delta(cur.waste, prev?.waste, false)}</div>
            <div className="card"><div className="stat-label">{t('previousPeriod')}</div><div style={{ fontSize: 13 }}>{prevRange.start} → {prevRange.end}<br />{t('revenue')}: {fmt(prev?.revenue || 0)} €</div></div>
          </div>

          {monthRows.length > 1 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h2 style={{ marginTop: 0 }}>{t('byMonth')}</h2>
              <table>
                <thead><tr><th>{t('monthLabel')}</th><th>{t('revenue')}</th><th>{t('foodCostAmount')}</th><th>{t('grossMargin')}</th><th>{t('foodCostPct')}</th></tr></thead>
                <tbody>
                  {monthRows.map(([m, v]) => (
                    <tr key={m}>
                      <td>{MONTHS[Number(m.slice(5)) - 1]} {m.slice(0, 4)}</td>
                      <td>{fmt(v.revenue)} €</td><td>{fmt(v.cost)} €</td><td>{fmt(v.revenue - v.cost)} €</td>
                      <td>{v.revenue > 0 ? ((v.cost / v.revenue) * 100).toFixed(1) : '0.0'}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="card">
            <h2 style={{ marginTop: 0 }}>{t('byDish')}</h2>
            <table>
              <thead><tr><th>{t('dishes')}</th><th>{t('portions')}</th><th>{t('revenue')}</th><th>{t('foodCostAmount')}</th><th>{t('grossMargin')}</th></tr></thead>
              <tbody>
                {Object.entries(cur.byDish).sort(([, a], [, b]) => b.revenue - a.revenue).map(([id, d]) => (
                  <tr key={id}>
                    <td>{data.recipes.find(r => r.id === id)?.name || '-'}</td>
                    <td>{d.portions}</td><td>{fmt(d.revenue)} €</td><td>{fmt(d.cost)} €</td><td>{fmt(d.revenue - d.cost)} €</td>
                  </tr>
                ))}
                {Object.keys(cur.byDish).length === 0 && <tr><td colSpan={5}>{t('noSalesPeriod')}</td></tr>}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 12, color: '#6b6b5f' }}>{t('costNote')}</p>
        </>
      )}
    </div>
  )
}
