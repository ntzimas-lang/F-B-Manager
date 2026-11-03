import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStores } from '../context/StoreContext'
import { useLanguage } from '../context/LanguageContext'
import { Download } from 'lucide-react'
import { exportXlsx } from '../lib/exportExcel'
import { CATEGORIES } from '../lib/categories'

const PERIODS = [30, 90, 180, 365]
const fmt3 = (n) => Number(n).toFixed(3)

function Chart({ points }) {
  if (points.length < 2) return null
  const W = 600, H = 170, P = 34
  const prices = points.map(p => p.price)
  const min = Math.min(...prices), max = Math.max(...prices)
  const span = max - min || 1
  const t0 = new Date(points[0].date).getTime(), t1 = new Date(points[points.length - 1].date).getTime()
  const tspan = t1 - t0 || 1
  const x = (d) => P + ((new Date(d).getTime() - t0) / tspan) * (W - P * 2)
  const y = (v) => H - P + 8 - ((v - min) / span) * (H - P * 2)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 640, height: 'auto' }}>
      <line x1={P} y1={y(min)} x2={W - P} y2={y(min)} stroke="#ddd" />
      <line x1={P} y1={y(max)} x2={W - P} y2={y(max)} stroke="#ddd" />
      <text x={4} y={y(max) + 4} fontSize="10" fill="#666">{fmt3(max)}</text>
      <text x={4} y={y(min) + 4} fontSize="10" fill="#666">{fmt3(min)}</text>
      <polyline fill="none" stroke="#3d4a28" strokeWidth="2" points={points.map(p => `${x(p.date)},${y(p.price)}`).join(' ')} />
      {points.map((p, i) => <circle key={i} cx={x(p.date)} cy={y(p.price)} r="3.5" fill="#3d4a28"><title>{p.date}: {fmt3(p.price)} €</title></circle>)}
      <text x={P} y={H - 4} fontSize="10" fill="#666">{points[0].date}</text>
      <text x={W - P} y={H - 4} fontSize="10" fill="#666" textAnchor="end">{points[points.length - 1].date}</text>
    </svg>
  )
}

export default function PriceTrends() {
  const { t } = useLanguage()
  const { selectedStoreId } = useStores()
  const [days, setDays] = useState(90)
  const [rows, setRows] = useState([])
  const [ings, setIngs] = useState([])
  const [sups, setSups] = useState([])
  const [loading, setLoading] = useState(true)
  const [fCat, setFCat] = useState('')
  const [fSup, setFSup] = useState('')
  const [q, setQ] = useState('')
  const [onlyChanged, setOnlyChanged] = useState(false)
  const [sort, setSort] = useState({ key: 'absPct', dir: -1 })
  const [open, setOpen] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
      let rq = supabase.from('goods_receipt_items')
        .select('ingredient_id, quantity, unit_price, goods_receipts!inner(receipt_date, supplier_id, store_id, invoice_number)')
        .not('unit_price', 'is', null).gte('goods_receipts.receipt_date', since).limit(5000)
      if (selectedStoreId !== 'all') rq = rq.eq('goods_receipts.store_id', selectedStoreId)
      const [{ data: r }, { data: i }, { data: s }] = await Promise.all([
        rq, supabase.from('ingredients').select('id, name, unit, category, supplier_id'), supabase.from('suppliers').select('id, name'),
      ])
      setRows(r || []); setIngs(i || []); setSups(s || []); setLoading(false)
    }
    load()
  }, [days, selectedStoreId])

  const supName = (id) => sups.find(s => s.id === id)?.name || '-'

  const data = useMemo(() => {
    const by = {}
    for (const r of rows) {
      const p = Number(r.unit_price); if (!(p > 0)) continue
      ;(by[r.ingredient_id] ||= []).push({ date: r.goods_receipts.receipt_date, price: p, qty: Number(r.quantity) || 0, supplier_id: r.goods_receipts.supplier_id, invoice: r.goods_receipts.invoice_number })
    }
    return Object.entries(by).map(([id, list]) => {
      list.sort((a, b) => a.date.localeCompare(b.date))
      const ing = ings.find(x => x.id === id) || {}
      const first = list[0], last = list[list.length - 1]
      const prices = list.map(x => x.price)
      const totQ = list.reduce((a, x) => a + x.qty, 0)
      const avg = totQ > 0 ? list.reduce((a, x) => a + x.qty * x.price, 0) / totQ : prices.reduce((a, b) => a + b, 0) / prices.length
      const pct = list.length > 1 ? ((last.price - first.price) / first.price) * 100 : 0
      return { id, name: ing.name || '?', unit: ing.unit || '', category: ing.category || '', first: first.price, last: last.price, pct, absPct: Math.abs(pct), min: Math.min(...prices), max: Math.max(...prices), avg, count: list.length, supplier: supName(last.supplier_id), supplier_id: last.supplier_id, list }
    })
  }, [rows, ings, sups])

  const filtered = data
    .filter(d => (!fCat || (fCat === '__none' ? !d.category : d.category === fCat)) && (!fSup || d.list.some(x => x.supplier_id === fSup)) && (!q || d.name.toLowerCase().includes(q.toLowerCase())) && (!onlyChanged || d.count > 1 && d.absPct >= 0.5))
    .sort((a, b) => {
      const k = sort.key, av = a[k], bv = b[k]
      return (typeof av === 'string' ? av.localeCompare(bv) : av - bv) * sort.dir
    })

  const withChange = filtered.filter(d => d.count > 1)
  const ups = withChange.filter(d => d.pct >= 0.5), downs = withChange.filter(d => d.pct <= -0.5)
  const topUp = [...ups].sort((a, b) => b.pct - a.pct)[0], topDown = [...downs].sort((a, b) => a.pct - b.pct)[0]

  const th = (key, label) => (
    <th style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => setSort(s => ({ key, dir: s.key === key ? -s.dir : (key === 'name' || key === 'category' ? 1 : -1) }))}>
      {label}{sort.key === key ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}
    </th>
  )

  async function doExport() {
    const r3 = (n) => Math.round(n * 1000) / 1000
    await exportXlsx(`price-trends-${days}d`, [
      { name: t('priceTrends'), rows: [[t('ingredient'), t('category'), t('firstPrice'), t('lastPrice'), t('change') + ' %', 'Min', 'Max', t('avgPrice'), t('receiptsCount'), t('supplier')],
        ...filtered.map(d => [d.name, d.category, r3(d.first), r3(d.last), Math.round(d.pct * 10) / 10, r3(d.min), r3(d.max), r3(d.avg), d.count, d.supplier])] },
      { name: t('detail'), rows: [[t('ingredient'), t('date'), t('supplier'), t('quantity'), t('unitPrice')],
        ...filtered.flatMap(d => d.list.map(x => [d.name, x.date, supName(x.supplier_id), x.qty, r3(x.price)]))] },
    ])
  }

  const badge = (pct, n) => n < 2 ? <span style={{ color: '#999' }}>—</span> : <span className={`badge ${pct >= 10 ? 'badge-danger' : pct >= 0.5 ? 'badge-warn' : pct <= -0.5 ? 'badge-ok' : ''}`}>{pct > 0.5 ? '▲ +' : pct < -0.5 ? '▼ ' : ''}{pct.toFixed(1)}%</span>

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {PERIODS.map(d => <button key={d} className={days === d ? 'btn' : 'btn btn-outline'} onClick={() => setDays(d)}>{d} {t('daysShort')}</button>)}
          <select value={fCat} onChange={e => setFCat(e.target.value)}>
            <option value="">{t('category')}: {t('all')}</option>
            {[...new Set([...CATEGORIES, ...ings.map(i => i.category)])].filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
            <option value="__none">{t('noCategory')}</option>
          </select>
          <select value={fSup} onChange={e => setFSup(e.target.value)}>
            <option value="">{t('supplier')}: {t('all')}</option>
            {sups.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input placeholder={t('search')} value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 180 }} />
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}><input type="checkbox" checked={onlyChanged} onChange={e => setOnlyChanged(e.target.checked)} /> {t('onlyChanged')}</label>
          <button className="btn btn-outline export-btn" style={{ marginLeft: 'auto' }} onClick={doExport}><Download size={16} /> {t('exportExcel')}</button>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="card"><div className="stat-label">{t('ingredientsTracked')}</div><div className="stat-value">{filtered.length}</div></div>
        <div className="card"><div className="stat-label">{t('priceUps')}</div><div className="stat-value" style={{ color: 'var(--danger)' }}>{ups.length}</div>{topUp && <div style={{ fontSize: 12 }}>{topUp.name}: +{topUp.pct.toFixed(0)}%</div>}</div>
        <div className="card"><div className="stat-label">{t('priceDowns')}</div><div className="stat-value" style={{ color: 'var(--ok)' }}>{downs.length}</div>{topDown && <div style={{ fontSize: 12 }}>{topDown.name}: {topDown.pct.toFixed(0)}%</div>}</div>
        <div className="card"><div className="stat-label">{t('avgChange')}</div><div className="stat-value">{withChange.length ? (withChange.reduce((a, d) => a + d.pct, 0) / withChange.length).toFixed(1) : '0.0'}%</div></div>
      </div>

      <div className="card">
        {loading ? <p>{t('loading')}</p> : filtered.length === 0 ? <p>{t('noPriceData')}</p> : (
          <table>
            <thead><tr>
              {th('name', t('ingredient'))}{th('category', t('category'))}{th('first', t('firstPrice'))}{th('last', t('lastPrice'))}{th('absPct', t('change'))}
              {th('min', 'Min')}{th('max', 'Max')}{th('avg', t('avgPrice'))}{th('count', t('receiptsCount'))}{th('supplier', t('supplier'))}
            </tr></thead>
            <tbody>
              {filtered.map(d => (
                <Fragment key={d.id}>
                  <tr style={{ cursor: 'pointer' }} onClick={() => setOpen(open === d.id ? null : d.id)}>
                    <td>{d.name}</td><td>{d.category || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmt3(d.first)} €</td><td style={{ whiteSpace: 'nowrap' }}>{fmt3(d.last)} €</td>
                    <td>{badge(d.pct, d.count)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmt3(d.min)} €</td><td style={{ whiteSpace: 'nowrap' }}>{fmt3(d.max)} €</td><td style={{ whiteSpace: 'nowrap' }}>{fmt3(d.avg)} €</td>
                    <td>{d.count}</td><td>{d.supplier}</td>
                  </tr>
                  {open === d.id && (
                    <tr><td colSpan={10} style={{ background: 'var(--olive-50, #f4f5ec)' }}>
                      <Chart points={d.list} />
                      <table style={{ marginTop: 8, maxWidth: 640 }}>
                        <thead><tr><th>{t('date')}</th><th>{t('supplier')}</th><th>{t('quantity')}</th><th>{t('unitPrice')}</th></tr></thead>
                        <tbody>{[...d.list].reverse().map((x, i) => <tr key={i}><td>{x.date}</td><td>{supName(x.supplier_id)}</td><td>{x.qty} {d.unit}</td><td>{fmt3(x.price)} €</td></tr>)}</tbody>
                      </table>
                    </td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
