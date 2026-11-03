import { CATEGORIES } from '../lib/categories'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activity'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { Plus, Trash2, Pencil, X, Upload, LineChart } from 'lucide-react'
import { readSheet } from 'read-excel-file/browser'

export default function Ingredients() {
  const { t } = useLanguage()
  const { hideCosts } = useAuth()
  const [ingredients, setIngredients] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editIngredient, setEditIngredient] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [historyIng, setHistoryIng] = useState(null)
  const [fCat, setFCat] = useState('')
  const [fSup, setFSup] = useState('')

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
    if (!confirm(t('confirmDelete'))) return
    const ing = ingredients.find(i => i.id === id)
    await supabase.from('ingredients').delete().eq('id', id)
    await logActivity('delete', 'ingredient', ing?.name)
    loadAll()
  }

  return (
    <div>
      <div className="topbar" style={{marginBottom: 16}}>
        <h1>{t('ingredients')}</h1>
      </div>

      <div className="card">
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:12}}>
          <h2 style={{margin:0}}>{t('ingredients')} ({ingredients.length})</h2>
          <div style={{display:'flex', gap:8}}>
            <button className="btn btn-outline write-master" onClick={() => setShowImport(true)}><Upload size={16}/> {t('importExcel')}</button>
            <button className="btn write-master" onClick={() => { setEditIngredient(null); setShowForm(true) }}><Plus size={16}/> {t('newIngredient')}</button>
          </div>
        </div>
        <div style={{display:'flex', gap:8, marginBottom:12, flexWrap:'wrap'}}>
          <select value={fCat} onChange={e => setFCat(e.target.value)}>
            <option value="">{t('category')}: {t('all')}</option>
            {[...new Set([...CATEGORIES, ...ingredients.map(i => i.category).filter(Boolean)])].map(c => <option key={c} value={c}>{c}</option>)}
            <option value="__none">{t('noCategory')}</option>
          </select>
          <select value={fSup} onChange={e => setFSup(e.target.value)}>
            <option value="">{t('supplier')}: {t('all')}</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <table>
          <thead><tr><th>{t('name')}</th><th>{t('category')}</th><th>{t('unit')}</th>{!hideCosts && <th>{t('price')}</th>}<th>{t('supplier')}</th><th></th></tr></thead>
          <tbody>
            {ingredients.filter(i => (!fCat || (fCat === '__none' ? !i.category : i.category === fCat)) && (!fSup || i.supplier_id === fSup)).map(ing => (
              <tr key={ing.id}>
                <td>{ing.name}</td>
                <td>{ing.category || '-'}</td>
                <td style={{textTransform:'uppercase'}}>{ing.unit}</td>
                {!hideCosts && <td style={{whiteSpace:'nowrap'}}>{Number(ing.current_price).toFixed(3)} €</td>}
                <td>{suppliers.find(s => s.id === ing.supplier_id)?.name || '-'}</td>
                <td style={{display:'flex', gap:8}}>
                  {!hideCosts && <button className="icon-btn" title={t('priceHistory')} onClick={() => setHistoryIng(ing)}><LineChart size={16}/></button>}
                  <button className="icon-btn write-master" onClick={() => { setEditIngredient(ing); setShowForm(true) }}><Pencil size={16}/></button>
                  <button className="icon-btn danger write-master" onClick={() => deleteIngredient(ing.id)}><Trash2 size={16}/></button>
                </td>
              </tr>
            ))}
            {ingredients.length === 0 && <tr><td colSpan={5}>{t('noIngredients')}</td></tr>}
          </tbody>
        </table>
      </div>

      {historyIng && <PriceHistoryModal ingredient={historyIng} suppliers={suppliers} onClose={() => setHistoryIng(null)} />}

      {showImport && (
        <ImportModal ingredients={ingredients} suppliers={suppliers} onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); loadAll() }} />
      )}

      {showForm && (
        <IngredientFormModal suppliers={suppliers} ingredient={editIngredient} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); loadAll() }} />
      )}
    </div>
  )
}

function IngredientFormModal({ suppliers, ingredient, onClose, onSaved }) {
  const { t } = useLanguage()
  const isEdit = !!ingredient
  const [form, setForm] = useState({
    name: ingredient?.name || '', unit: ingredient?.unit || 'kg',
    current_price: ingredient?.current_price ?? '', supplier_id: ingredient?.supplier_id || '',
    min_stock_alert: ingredient?.min_stock_alert ?? '', category: ingredient?.category || '',
  })
  async function save() {
    if (!form.name) return
    const payload = {
      ...form,
      current_price: Number(form.current_price) || 0,
      min_stock_alert: Number(form.min_stock_alert) || 0,
      supplier_id: form.supplier_id || null, category: form.category || null,
    }
    if (isEdit) {
      await supabase.from('ingredients').update(payload).eq('id', ingredient.id)
      await logActivity('update', 'ingredient', form.name)
    } else {
      await supabase.from('ingredients').insert(payload)
      await logActivity('create', 'ingredient', form.name)
    }
    onSaved()
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{display:'flex', justifyContent:'space-between'}}><h2>{isEdit ? `${t('edit')} — ${ingredient.name}` : t('newIngredient')}</h2><button className="icon-btn" onClick={onClose}><X/></button></div>
        <div className="form-row"><label>{t('name')}</label><input value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></div>
        <div className="form-row"><label>{t('category')}</label>
          <select value={form.category} onChange={e => setForm({...form, category:e.target.value})}>
            <option value="">-</option>
            {[...new Set([...CATEGORIES, form.category].filter(Boolean))].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-row"><label>{t('unit')}</label>
          <select value={form.unit} onChange={e => setForm({...form, unit:e.target.value})}>
            <option value="kg">kg</option><option value="gr">gr</option><option value="lt">lt</option>
            <option value="ml">ml</option><option value="τεμ">τεμ</option>
          </select>
        </div>
        <div className="form-row"><label>{t('price')} (€)</label><input type="number" step="0.001" value={form.current_price} onChange={e => setForm({...form, current_price:e.target.value})}/></div>
        <div className="form-row"><label>{t('supplier')}</label>
          <select value={form.supplier_id} onChange={e => setForm({...form, supplier_id:e.target.value})}>
            <option value="">-</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-row"><label>{t('minStockAlert')}</label><input type="number" step="0.1" value={form.min_stock_alert} onChange={e => setForm({...form, min_stock_alert:e.target.value})}/></div>
        <div className="modal-actions"><button className="btn" onClick={save}>{t('save')}</button></div>
      </div>
    </div>
  )
}

const UNIT_MAP = {
  kg: 'kg', 'κιλό': 'kg', 'κιλά': 'kg', 'κιλο': 'kg',
  gr: 'gr', g: 'gr', 'γραμμάρια': 'gr', 'γρ': 'gr',
  lt: 'lt', l: 'lt', 'λίτρο': 'lt', 'λίτρα': 'lt', 'λιτρο': 'lt',
  ml: 'ml',
  'τεμ': 'τεμ', 'τεμάχιο': 'τεμ', 'τεμάχια': 'τεμ', pcs: 'τεμ', pc: 'τεμ',
}

async function parseFile(file) {
  if (/\.xlsx$/i.test(file.name)) {
    return await readSheet(file)
  }
  const text = (await file.text()).replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  const delim = (lines[0].split(';').length > lines[0].split(',').length) ? ';' : ','
  return lines.map(l => l.split(delim).map(c => c.trim().replace(/^"|"$/g, '')))
}

function ImportModal({ ingredients, suppliers, onClose, onDone }) {
  const { t } = useLanguage()
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')

  function downloadTemplate() {
    const csv = '\uFEFFΌνομα;Μονάδα;Τιμή;Προμηθευτής;Όριο ειδοποίησης\nΕλαιόλαδο;lt;7.5;Προμηθευτής Α;5\nΑλεύρι;kg;0.9;;10\n'
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    a.download = 'protes-yles-template.csv'; a.click()
  }

  async function onFile(e) {
    setError(''); setResult(''); setRows([])
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = await parseFile(file)
      const body = data.slice(1) // πρώτη γραμμή = επικεφαλίδες
      const existing = new Set(ingredients.map(i => i.name.trim().toLowerCase()))
      const seen = new Set()
      const parsed = body.map((r, idx) => {
        const name = String(r[0] ?? '').trim()
        const unitRaw = String(r[1] ?? '').trim().toLowerCase()
        const unit = UNIT_MAP[unitRaw] || (unitRaw ? null : 'kg')
        const price = Number(String(r[2] ?? '0').replace(',', '.')) || 0
        const supplier = String(r[3] ?? '').trim()
        const min = Number(String(r[4] ?? '0').replace(',', '.')) || 0
        let status = 'ok'
        if (!name) status = 'empty'
        else if (!unit) status = 'badUnit'
        else if (existing.has(name.toLowerCase()) || seen.has(name.toLowerCase())) status = 'exists'
        if (name) seen.add(name.toLowerCase())
        return { line: idx + 2, name, unit, price, supplier, min, status }
      }).filter(r => r.status !== 'empty')
      setRows(parsed)
      if (parsed.length === 0) setError(t('importEmpty'))
    } catch (err) {
      setError(t('importReadError'))
    }
  }

  async function doImport() {
    setBusy(true)
    const good = rows.filter(r => r.status === 'ok')
    const supMap = Object.fromEntries(suppliers.map(s => [s.name.trim().toLowerCase(), s.id]))
    for (const name of [...new Set(good.map(r => r.supplier).filter(Boolean))]) {
      if (!supMap[name.toLowerCase()]) {
        const { data } = await supabase.from('suppliers').insert({ name }).select().single()
        if (data) supMap[name.toLowerCase()] = data.id
      }
    }
    const payload = good.map(r => ({
      name: r.name, unit: r.unit, current_price: r.price, min_stock_alert: r.min,
      supplier_id: r.supplier ? supMap[r.supplier.toLowerCase()] || null : null,
    }))
    const { error } = await supabase.from('ingredients').insert(payload)
    if (error) { setError(error.message); setBusy(false); return }
    await logActivity('create', 'ingredient', `${t('importExcel')}: ${payload.length}`)
    setBusy(false)
    setResult(t('importDone').replace('{n}', payload.length))
    setRows([])
    setTimeout(onDone, 1200)
  }

  const okCount = rows.filter(r => r.status === 'ok').length
  const STATUS = { ok: t('importOk'), exists: t('importExists'), badUnit: t('importBadUnit') }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{width:640}} onClick={e => e.stopPropagation()}>
        <div style={{display:'flex', justifyContent:'space-between'}}><h2>{t('importExcel')}</h2><button className="icon-btn" onClick={onClose}><X/></button></div>
        <p style={{fontSize:13, marginTop:0}}>{t('importHelp')}</p>
        <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:12}}>
          <button className="btn btn-outline" onClick={downloadTemplate}>{t('downloadTemplate')}</button>
          <input type="file" accept=".xlsx,.csv" onChange={onFile} />
        </div>
        {error && <div style={{color:'var(--danger)', marginBottom:8}}>{error}</div>}
        {result && <div style={{color:'var(--ok)', fontWeight:600}}>{result}</div>}
        {rows.length > 0 && (
          <>
            <div style={{maxHeight:260, overflowY:'auto'}}>
              <table>
                <thead><tr><th>{t('name')}</th><th>{t('unit')}</th><th>{t('price')}</th><th>{t('supplier')}</th><th></th></tr></thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.line}>
                      <td>{r.name}</td><td>{r.unit || '?'}</td><td>{r.price}</td><td>{r.supplier || '-'}</td>
                      <td><span className={'badge ' + (r.status === 'ok' ? 'badge-ok' : 'badge-warn')}>{STATUS[r.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-actions">
              <button className="btn write-master" disabled={busy || okCount === 0} onClick={doImport}>{busy ? t('saving') : `${t('importBtn')} (${okCount})`}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function PriceHistoryModal({ ingredient, suppliers, onClose }) {
  const { t } = useLanguage()
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [y, m] = month.split('-').map(Number)
      const start = `${month}-01`
      const end = new Date(y, m, 1).toISOString().slice(0, 10)
      const { data } = await supabase.from('goods_receipt_items')
        .select('quantity, unit_price, goods_receipts!inner(receipt_date, supplier_id, invoice_number)')
        .eq('ingredient_id', ingredient.id).not('unit_price', 'is', null)
        .gte('goods_receipts.receipt_date', start).lt('goods_receipts.receipt_date', end)
      const list = (data || []).map(r => ({
        date: r.goods_receipts.receipt_date, supplier_id: r.goods_receipts.supplier_id,
        invoice: r.goods_receipts.invoice_number, qty: Number(r.quantity), price: Number(r.unit_price),
      })).sort((a, b) => a.date.localeCompare(b.date))
      setRows(list)
      setLoading(false)
    }
    load()
  }, [month, ingredient.id])

  const prices = rows.map(r => r.price)
  const min = prices.length ? Math.min(...prices) : 0
  const max = prices.length ? Math.max(...prices) : 0
  const totalQty = rows.reduce((a, r) => a + r.qty, 0)
  const wavg = totalQty > 0 ? rows.reduce((a, r) => a + r.price * r.qty, 0) / totalQty : 0
  const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0

  // γράφημα SVG
  const W = 560, H = 160, pad = 28
  const lo = min === max ? min * 0.9 : min, hi = min === max ? max * 1.1 : max
  const x = i => rows.length === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (rows.length - 1)
  const y = v => hi === lo ? H / 2 : H - pad - ((v - lo) / (hi - lo)) * (H - 2 * pad)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 640 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ marginTop: 0 }}>{t('priceHistory')} — {ingredient.name}</h2>
          <button className="icon-btn" onClick={onClose}><X /></button>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
          <span style={{ fontSize: 13 }}>{t('currentPrice')}: <strong>{Number(ingredient.current_price).toFixed(3)} €/{ingredient.unit}</strong></span>
        </div>
        {loading ? <p>{t('loading')}</p> : rows.length === 0 ? <p>{t('noPriceData')}</p> : (
          <>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
              <div><div className="stat-label">{t('minPrice')}</div><strong>{min.toFixed(3)} €</strong></div>
              <div><div className="stat-label">{t('maxPrice')}</div><strong>{max.toFixed(3)} €</strong></div>
              <div><div className="stat-label">{t('avgPrice')}</div><strong>{avg.toFixed(3)} €</strong></div>
              <div><div className="stat-label">{t('weightedAvg')}</div><strong>{wavg.toFixed(3)} €</strong></div>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', background: 'var(--olive-50)', borderRadius: 8, marginBottom: 12 }}>
              <polyline fill="none" stroke="var(--olive-600)" strokeWidth="2" points={rows.map((r, i) => `${x(i)},${y(r.price)}`).join(' ')} />
              {rows.map((r, i) => (
                <g key={i}>
                  <circle cx={x(i)} cy={y(r.price)} r="4" fill="var(--olive-700)" />
                  <text x={x(i)} y={y(r.price) - 8} fontSize="10" textAnchor="middle" fill="var(--ink)">{r.price.toFixed(2)}</text>
                  <text x={x(i)} y={H - 6} fontSize="9" textAnchor="middle" fill="#6b6b5f">{r.date.slice(8, 10)}/{r.date.slice(5, 7)}</text>
                </g>
              ))}
            </svg>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              <table>
                <thead><tr><th>{t('date')}</th><th>{t('supplier')}</th><th>{t('quantity')}</th><th>{t('unitPrice')}</th></tr></thead>
                <tbody>
                  {[...rows].reverse().map((r, i) => (
                    <tr key={i}>
                      <td>{r.date}</td>
                      <td>{suppliers.find(s => s.id === r.supplier_id)?.name || '-'}</td>
                      <td>{r.qty} {ingredient.unit}</td>
                      <td>{r.price.toFixed(3)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
