import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activity'
import { useLanguage } from '../context/LanguageContext'
import { Plus, Trash2, Pencil, X, Upload } from 'lucide-react'
import { readSheet } from 'read-excel-file/browser'

export default function Ingredients() {
  const { t } = useLanguage()
  const [ingredients, setIngredients] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editIngredient, setEditIngredient] = useState(null)
  const [showImport, setShowImport] = useState(false)

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
            <button className="btn btn-outline" onClick={() => setShowImport(true)}><Upload size={16}/> {t('importExcel')}</button>
            <button className="btn" onClick={() => { setEditIngredient(null); setShowForm(true) }}><Plus size={16}/> {t('newIngredient')}</button>
          </div>
        </div>
        <table>
          <thead><tr><th>{t('name')}</th><th>{t('unit')}</th><th>{t('price')}</th><th>{t('supplier')}</th><th></th></tr></thead>
          <tbody>
            {ingredients.map(ing => (
              <tr key={ing.id}>
                <td>{ing.name}</td>
                <td>{ing.unit}</td>
                <td>{Number(ing.current_price).toFixed(3)} €</td>
                <td>{suppliers.find(s => s.id === ing.supplier_id)?.name || '-'}</td>
                <td style={{display:'flex', gap:8}}>
                  <button className="icon-btn" onClick={() => { setEditIngredient(ing); setShowForm(true) }}><Pencil size={16}/></button>
                  <button className="icon-btn danger" onClick={() => deleteIngredient(ing.id)}><Trash2 size={16}/></button>
                </td>
              </tr>
            ))}
            {ingredients.length === 0 && <tr><td colSpan={5}>{t('noIngredients')}</td></tr>}
          </tbody>
        </table>
      </div>

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
    min_stock_alert: ingredient?.min_stock_alert ?? '',
  })
  async function save() {
    if (!form.name) return
    const payload = {
      ...form,
      current_price: Number(form.current_price) || 0,
      min_stock_alert: Number(form.min_stock_alert) || 0,
      supplier_id: form.supplier_id || null,
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
              <button className="btn" disabled={busy || okCount === 0} onClick={doImport}>{busy ? t('saving') : `${t('importBtn')} (${okCount})`}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
