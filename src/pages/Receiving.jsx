import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activity'
import { useStores } from '../context/StoreContext'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { ScanLine, Plus, Trash2, X, Download, FileText, Camera } from 'lucide-react'
import { exportXlsx } from '../lib/exportExcel'
import { PRICE_ALERT_PCT } from '../lib/prices'

export default function Receiving() {
  const { stores, selectedStoreId } = useStores()
  const { t } = useLanguage()
  const { hideCosts, readOnly } = useAuth()
  const activeStoreId = selectedStoreId !== 'all' ? selectedStoreId : (stores[0]?.id || '')
  const store = stores.find(s => s.id === activeStoreId)

  const [ingredients, setIngredients] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [history, setHistory] = useState([])
  const [invoiceRef, setInvoiceRef] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState([{ ingredient_id: '', quantity: '', unit_price: '' }])
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [duplicate, setDuplicate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [alerts, setAlerts] = useState([])
  const scannerRef = useRef(null)
  const [codeMap, setCodeMap] = useState([])
  const [importMsg, setImportMsg] = useState('')
  const [supName, setSupName] = useState('')

  async function load() {
    const [{ data: ing }, { data: sup }] = await Promise.all([
      supabase.from('ingredients').select('*').order('name'),
      supabase.from('suppliers').select('*').order('name'),
    ])
    const { data: cm } = await supabase.from('supplier_item_codes').select('*')
    setCodeMap(cm || [])
    setIngredients(ing || [])
    setSuppliers(sup || [])
    if (activeStoreId) {
      const { data } = await supabase.from('goods_receipts').select('*, goods_receipt_items(*)')
        .eq('store_id', activeStoreId).order('created_at', { ascending: false }).limit(20)
      setHistory(data || [])
    }
  }
  useEffect(() => { load() }, [activeStoreId])

  async function exportReceipts() {
    const rows = [[t('date'), t('invoiceNumber'), t('supplier'), t('ingredient'), t('quantity'), t('unit'), t('unitPrice'), t('total')]]
    history.forEach(r => (r.goods_receipt_items || []).forEach(it => {
      const ing = ingredients.find(i => i.id === it.ingredient_id)
      const q = Number(it.quantity), p = Number(it.unit_price || 0)
      rows.push([r.receipt_date, r.invoice_number || '', suppliers.find(s => s.id === r.supplier_id)?.name || '', ing?.name || '', q, ing?.unit || '', p, Math.round(q * p * 100) / 100])
    }))
    await exportXlsx(`receipts-${new Date().toISOString().slice(0, 10)}`, [{ name: t('receiptsSheet'), rows }])
  }

  // έλεγχος διπλοτύπου
  useEffect(() => {
    const ref = invoiceRef.trim()
    if ((!ref && !invoiceNumber.trim()) || !activeStoreId) { setDuplicate(false); return }
    const q = ref
      ? supabase.from('goods_receipts').select('id').eq('store_id', activeStoreId).eq('invoice_ref', ref).maybeSingle()
      : Promise.resolve({ data: null })
    q.then(async ({ data }) => {
        if (data) return setDuplicate(true)
        if (!invoiceNumber.trim()) return setDuplicate(false)
        const { data: d2 } = await supabase.from('goods_receipts').select('id').eq('store_id', activeStoreId).eq('invoice_number', invoiceNumber.trim()).eq('receipt_date', date).maybeSingle()
        setDuplicate(!!d2)
      })
  }, [invoiceRef, invoiceNumber, date, activeStoreId])

  async function applyInvoice(inv) {
    const key = (l) => l.code || l.description
    if (!inv.lines.length) { setImportMsg(t('pdfNoLines')); return }
    const sname = (inv.supplierName || '').trim()
    const sup = suppliers.find(s => sname && (s.name.toLowerCase().includes(sname.toLowerCase().slice(0, 8)) || sname.toLowerCase().includes(s.name.toLowerCase())))
    let supIdNow = sup?.id || ''
    if (!sup && sname) {
      const { data: ns } = await supabase.from('suppliers').insert({ name: sname }).select().single()
      if (ns) { supIdNow = ns.id; setSuppliers(prev => [...prev, ns]) }
    }
    if (supIdNow) setSupplierId(supIdNow)
    if (inv.number) setInvoiceNumber(inv.number)
    if (inv.date) setDate(inv.date)
    if (!invoiceRef.trim()) setInvoiceRef(inv.mark ? `MARK:${inv.mark}` : `${sname}:${inv.number}`)
    setSupName(sname)
    setLines(inv.lines.map(l => {
      const m = codeMap.find(c => c.item_code === key(l) && c.supplier_name === sname)
      const pack = String(l.description).match(/(\d+)\s*\/\s*[ΧXχx][ΤT]/i)
      const f = m ? Number(m.factor) : (pack && /^(κιβ|πακ|συσκ|box)/i.test(l.unit || '') ? Number(pack[1]) : 1)
      return {
        ingredient_id: m?.ingredient_id || '', code: key(l), desc: l.description, iunit: l.unit,
        rawQty: l.qty, rawPrice: l.price, factor: f, category: l.category || '',
        quantity: String(Math.round(l.qty * f * 1000) / 1000), unit_price: String(Math.round((l.price / f) * 10000) / 10000),
      }
    }))
    const unmatched = inv.lines.filter(l => !codeMap.find(c => c.item_code === key(l) && c.supplier_name === sname)).length
    setImportMsg(`${inv.lines.length} ${t('pdfLinesRead')}${unmatched ? ` — ${unmatched} ${t('pdfUnmatched')}` : ''}`)
  }

  async function importPdf(file) {
    if (!file) return
    setImportMsg('')
    try {
      const { parseInvoicePdf } = await import('../lib/invoicePdf')
      await applyInvoice(await parseInvoicePdf(file))
    } catch (e) { console.error(e); setImportMsg(t('pdfError')) }
  }

  async function importPhoto(file) {
    if (!file) return
    setImportMsg(t('photoReading'))
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
      const sc = Math.min(1, 1800 / Math.max(bmp.width, bmp.height))
      const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * sc); cv.height = Math.round(bmp.height * sc)
      cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height)
      const image = cv.toDataURL('image/jpeg', 0.85).split(',')[1]
      const { data, error } = await supabase.functions.invoke('read-invoice', { body: { image, media_type: 'image/jpeg' } })
      if (error || !data || data.error) { setImportMsg(data?.error === 'no_key' ? t('photoNoKey') : `${t('photoError')} (${data?.detail || data?.error || error?.message || ''})`); return }
      await applyInvoice({
        supplierName: data.supplier_name, number: [data.series, data.number].filter(Boolean).join('-'),
        date: /^\d{4}-\d{2}-\d{2}$/.test(data.date || '') ? data.date : '', mark: data.mark || '',
        lines: (data.lines || []).filter(l => Number(l.quantity) > 0).map(l => ({
          code: l.code || '', description: l.description, unit: l.unit || '', qty: Number(l.quantity), category: l.category || '',
          price: Math.round((Number(l.net_total) / Number(l.quantity)) * 10000) / 10000,
        })),
      })
    } catch (e) { console.error(e); setImportMsg(`${t('photoError')} (${e?.message || e})`) }
  }
  async function createIngredient(i) {
    const l = lines[i]
    const u = String(l.iunit || '').toLowerCase()
    const unit = /^(κιλ|kg)/.test(u) ? 'kg' : /^(λιτ|lt|l$)/.test(u) ? 'lt' : 'τεμ'
    const name = String(l.desc || '').replace(/\s*\d+\s*\/\s*[ΧXχx][ΤT]\.?/i, '').replace(/\s+ΤΕΜ\.?$/i, '').replace(/\.$/, '').replace(/\s+/g, ' ').trim()
    const { data: ing, error } = await supabase.from('ingredients').insert({
      name, unit, current_price: Number(l.unit_price) || 0, supplier_id: supplierId || null, category: l.category || null,
    }).select().single()
    if (error || !ing) { alert(error?.message || 'error'); return }
    setIngredients(prev => [...prev, ing].sort((a, b) => a.name.localeCompare(b.name)))
    setLine(i, { ingredient_id: ing.id })
  }
  function setFactor(i, v) {
    const l = lines[i], f = Number(v) > 0 ? Number(v) : 1
    setLine(i, { factor: v, quantity: String(Math.round(l.rawQty * f * 1000) / 1000), unit_price: String(Math.round((l.rawPrice / f) * 10000) / 10000) })
  }

  useEffect(() => () => { stopScan() }, [])

  async function startScan() {
    setScanError('')
    setScanning(true)
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode('qr-reader')
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (text) => { setInvoiceRef(text); stopScan() },
          () => {}
        )
      } catch (e) {
        setScanError(t('cameraError'))
        setScanning(false)
      }
    }, 100)
  }

  async function stopScan() {
    const s = scannerRef.current
    scannerRef.current = null
    if (s) { try { await s.stop(); s.clear() } catch (e) {} }
    setScanning(false)
  }

  function setLine(i, patch) { setLines(lines.map((l, idx) => idx === i ? { ...l, ...patch } : l)) }

  async function save() {
    const ref = invoiceRef.trim() || `MANUAL:${invoiceNumber.trim()}:${date}`
    const valid = lines.filter(l => l.ingredient_id && Number(l.quantity) > 0)
    if ((!invoiceRef.trim() && !invoiceNumber.trim()) || valid.length === 0 || duplicate || !activeStoreId) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    let supId = supplierId
    if (!supId && supName) {
      const { data: ns } = await supabase.from('suppliers').insert({ name: supName }).select().single()
      if (ns) { supId = ns.id; setSuppliers(prev => [...prev, ns]) }
    }
    const { data: receipt, error } = await supabase.from('goods_receipts').insert({
      store_id: activeStoreId, supplier_id: supId || null, invoice_ref: ref,
      invoice_number: invoiceNumber || null, receipt_date: date, created_by: user?.email || null,
    }).select().single()
    if (error) { setSaving(false); alert(error.message); return }

    // προηγούμενες τιμές (πριν την καταχώρηση αυτής της παραλαβής)
    const priceInfo = {}
    for (const l of valid) {
      const price = Number(l.unit_price)
      if (!(price > 0)) continue
      const { data: prevRows } = await supabase.from('goods_receipt_items')
        .select('unit_price, goods_receipts!inner(receipt_date)')
        .eq('ingredient_id', l.ingredient_id).not('unit_price', 'is', null)
        .limit(1000)
      const sorted = (prevRows || []).sort((a, b) => b.goods_receipts.receipt_date.localeCompare(a.goods_receipts.receipt_date))
      const latest = sorted[0]
      const ing = ingredients.find(x => x.id === l.ingredient_id)
      priceInfo[l.ingredient_id] = {
        prev: latest ? Number(latest.unit_price) : Number(ing?.current_price) || 0,
        isLatest: !latest || date >= latest.goods_receipts.receipt_date,
      }
    }

    await supabase.from('goods_receipt_items').insert(valid.map(l => ({
      receipt_id: receipt.id, ingredient_id: l.ingredient_id, quantity: Number(l.quantity),
      unit_price: Number(l.unit_price) > 0 ? Number(l.unit_price) : null,
    })))

    const newAlerts = []
    for (const l of valid) {
      const info = priceInfo[l.ingredient_id]
      if (!info) continue
      const price = Number(l.unit_price)
      const ing = ingredients.find(x => x.id === l.ingredient_id)
      if (info.isLatest) await supabase.from('ingredients').update({ current_price: price }).eq('id', l.ingredient_id)
      if (info.prev > 0) {
        const pct = ((price - info.prev) / info.prev) * 100
        if (pct >= PRICE_ALERT_PCT) newAlerts.push({ name: ing?.name, prev: info.prev, price, pct })
      }
    }
    setAlerts(newAlerts)

    for (const l of valid) {
      const qty = Number(l.quantity)
      const { data: row } = await supabase.from('inventory_stock').select('*').eq('store_id', activeStoreId).eq('ingredient_id', l.ingredient_id).maybeSingle()
      if (row) {
        await supabase.from('inventory_stock').update({ quantity: Number(row.quantity) + qty, updated_at: new Date().toISOString() }).eq('id', row.id)
      } else {
        await supabase.from('inventory_stock').insert({ store_id: activeStoreId, ingredient_id: l.ingredient_id, quantity: qty })
      }
      await supabase.from('stock_movements').insert({
        store_id: activeStoreId, ingredient_id: l.ingredient_id, movement_type: 'receipt', quantity: qty,
        note: `${t('receiving')}: ${invoiceNumber || ref.slice(0, 40)}`,
      })
    }
    const maps = valid.filter(l => l.code && supName).map(l => ({ supplier_name: supName, item_code: l.code, ingredient_id: l.ingredient_id, factor: Number(l.factor) > 0 ? Number(l.factor) : 1 }))
    if (maps.length) await supabase.from('supplier_item_codes').upsert(maps, { onConflict: 'company_id,supplier_name,item_code' })
    await logActivity('create', 'receipt', store?.name, `${invoiceNumber || ref.slice(0, 40)}: ${valid.length}`)
    setInvoiceRef(''); setInvoiceNumber(''); setSupplierId(''); setLines([{ ingredient_id: '', quantity: '', unit_price: '' }])
    setSaving(false)
    load()
  }

  if (!activeStoreId) return <div className="card">{t('addStoreFirst')}</div>

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 16 }}>
        <h1>{t('receiving')}</h1>
      </div>

      {selectedStoreId === 'all' && (
        <div className="card" style={{ marginBottom: 16, background: 'var(--olive-50)' }}>{t('pickStoreNotice')}</div>
      )}

      <div className="card write-btn">
        <h2 style={{ marginTop: 0 }}>{t('newReceipt')} — {store?.name}</h2>

        <div className="form-row">
          <div>
            <label className="btn write-btn" style={{ cursor: 'pointer', marginRight: 8 }}><Camera size={16} /> {t('importPhoto')}
              <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { importPhoto(e.target.files[0]); e.target.value = '' }} />
            </label>
            <label className="btn btn-outline write-btn" style={{ cursor: 'pointer' }}><FileText size={16} /> {t('importPdf')}
              <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => { importPdf(e.target.files[0]); e.target.value = '' }} />
            </label>
            {importMsg && <span style={{ marginLeft: 10, fontSize: 13 }}>{importMsg}</span>}
          </div>
          {scanError && <div style={{ color: 'var(--danger)', marginTop: 6 }}>{scanError}</div>}
          {duplicate && <div style={{ color: 'var(--danger)', marginTop: 6, fontWeight: 600 }}>{t('duplicateInvoice')}</div>}
        </div>

        <div className="form-row"><label>{t('invoiceNumber')}</label><input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} /></div>
        <div className="form-row"><label>{t('supplier')}</label>
          <select value={supplierId} onChange={e => setSupplierId(e.target.value)}>
            <option value="">-</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-row"><label>{t('date')}</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>

        <table>
          <thead><tr><th>{t('ingredient')}</th><th>{t('quantity')}</th>{!hideCosts && <th>{t('unitPrice')} (€)</th>}<th></th></tr></thead>
          <tbody>
            {lines.map((l, i) => {
              const ing = ingredients.find(x => x.id === l.ingredient_id)
              return (
                <tr key={i}>
                  <td>
                    <select value={l.ingredient_id} onChange={e => setLine(i, { ingredient_id: e.target.value })}>
                      <option value="">{t('selectOption')}</option>
                      {ingredients.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                    {l.code && !l.ingredient_id && <button type="button" className="btn btn-outline write-btn" style={{ marginTop: 4, padding: '2px 8px', fontSize: 12 }} onClick={() => createIngredient(i)}><Plus size={12} /> {t('createIngredient')}</button>}
                    {l.code && <div style={{ fontSize: 12, color: 'var(--text-muted, #666)', marginTop: 4 }}>
                      {l.desc} · {l.rawQty} {l.iunit} × <input type="number" step="0.01" min="0" style={{ width: 60 }} value={l.factor} onChange={e => setFactor(i, e.target.value)} />
                    </div>}
                  </td>
                  <td><input type="number" step="0.01" min="0" style={{ width: 100 }} value={l.quantity} onChange={e => setLine(i, { quantity: e.target.value })} /> {ing?.unit}</td>
                  {!hideCosts && <td>
                    <input type="number" step="0.001" min="0" style={{ width: 100 }} value={l.unit_price} onChange={e => setLine(i, { unit_price: e.target.value })} />
                    {(() => {
                      const cur = Number(ing?.current_price), np = Number(l.unit_price)
                      if (!(cur > 0 && np > 0)) return null
                      const pct = ((np - cur) / cur) * 100
                      return Math.abs(pct) >= 1 ? <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 600, color: pct >= PRICE_ALERT_PCT ? 'var(--danger)' : pct > 0 ? 'var(--warn)' : 'var(--ok)' }}>{pct > 0 ? '+' : ''}{pct.toFixed(0)}%</span> : null
                    })()}
                  </td>}
                  <td><button className="icon-btn danger write-btn" onClick={() => setLines(lines.length > 1 ? lines.filter((_, idx) => idx !== i) : lines)}><Trash2 size={16} /></button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
          <button className="btn btn-outline write-btn" onClick={() => setLines([...lines, { ingredient_id: '', quantity: '', unit_price: '' }])}><Plus size={14} /> {t('addLine')}</button>
          <button className="btn" onClick={save} disabled={saving || duplicate || (!invoiceRef.trim() && !invoiceNumber.trim())}>{saving ? t('saving') : t('recordReceipt')}</button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="card" style={{ marginTop: 16, borderColor: 'var(--danger)' }}>
          <h2 style={{ marginTop: 0, color: 'var(--danger)' }}>{t('priceAlert')}</h2>
          {alerts.map((a, i) => (
            <div key={i}>{a.name}: {a.prev.toFixed(3)} € → <strong>{a.price.toFixed(3)} €</strong> (+{a.pct.toFixed(0)}%)</div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}><h2 style={{ marginTop: 0 }}>{t('receiptHistory')}</h2><button className="btn btn-outline export-btn" onClick={exportReceipts}><Download size={16}/> {t('exportExcel')}</button></div>
          <table>
            <thead><tr><th>{t('date')}</th><th>{t('invoiceNumber')}</th><th>{t('supplier')}</th><th>{t('products')}</th></tr></thead>
            <tbody>
              {history.map(r => (
                <tr key={r.id}>
                  <td>{r.receipt_date}</td>
                  <td>{r.invoice_number || <a href={/^https?:/.test(r.invoice_ref) ? r.invoice_ref : undefined} target="_blank" rel="noreferrer">{r.invoice_ref.slice(0, 30)}…</a>}</td>
                  <td>{suppliers.find(s => s.id === r.supplier_id)?.name || '-'}</td>
                  <td>{(r.goods_receipt_items || []).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
