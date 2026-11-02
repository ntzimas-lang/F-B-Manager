import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activity'
import { useStores } from '../context/StoreContext'
import { useLanguage } from '../context/LanguageContext'
import { ScanLine, Plus, Trash2, X } from 'lucide-react'

export default function Receiving() {
  const { stores, selectedStoreId } = useStores()
  const { t } = useLanguage()
  const activeStoreId = selectedStoreId !== 'all' ? selectedStoreId : (stores[0]?.id || '')
  const store = stores.find(s => s.id === activeStoreId)

  const [ingredients, setIngredients] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [history, setHistory] = useState([])
  const [invoiceRef, setInvoiceRef] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState([{ ingredient_id: '', quantity: '' }])
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [duplicate, setDuplicate] = useState(false)
  const [saving, setSaving] = useState(false)
  const scannerRef = useRef(null)

  async function load() {
    const [{ data: ing }, { data: sup }] = await Promise.all([
      supabase.from('ingredients').select('*').order('name'),
      supabase.from('suppliers').select('*').order('name'),
    ])
    setIngredients(ing || [])
    setSuppliers(sup || [])
    if (activeStoreId) {
      const { data } = await supabase.from('goods_receipts').select('*, goods_receipt_items(*)')
        .eq('store_id', activeStoreId).order('created_at', { ascending: false }).limit(20)
      setHistory(data || [])
    }
  }
  useEffect(() => { load() }, [activeStoreId])

  // έλεγχος διπλοτύπου
  useEffect(() => {
    const ref = invoiceRef.trim()
    if (!ref || !activeStoreId) { setDuplicate(false); return }
    supabase.from('goods_receipts').select('id').eq('store_id', activeStoreId).eq('invoice_ref', ref).maybeSingle()
      .then(({ data }) => setDuplicate(!!data))
  }, [invoiceRef, activeStoreId])

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
    const ref = invoiceRef.trim()
    const valid = lines.filter(l => l.ingredient_id && Number(l.quantity) > 0)
    if (!ref || valid.length === 0 || duplicate || !activeStoreId) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: receipt, error } = await supabase.from('goods_receipts').insert({
      store_id: activeStoreId, supplier_id: supplierId || null, invoice_ref: ref,
      invoice_number: invoiceNumber || null, receipt_date: date, created_by: user?.email || null,
    }).select().single()
    if (error) { setSaving(false); alert(error.message); return }

    await supabase.from('goods_receipt_items').insert(valid.map(l => ({ receipt_id: receipt.id, ingredient_id: l.ingredient_id, quantity: Number(l.quantity) })))

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
    await logActivity('create', 'receipt', store?.name, `${invoiceNumber || ref.slice(0, 40)}: ${valid.length}`)
    setInvoiceRef(''); setInvoiceNumber(''); setSupplierId(''); setLines([{ ingredient_id: '', quantity: '' }])
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

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{t('newReceipt')} — {store?.name}</h2>

        <div className="form-row">
          <label>{t('invoiceQr')}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ flex: 1 }} value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} placeholder={t('invoiceQrHint')} />
            {!scanning
              ? <button className="btn" type="button" onClick={startScan}><ScanLine size={16} /> {t('scan')}</button>
              : <button className="btn btn-outline" type="button" onClick={stopScan}><X size={16} /> {t('cancel')}</button>}
          </div>
          {scanError && <div style={{ color: 'var(--danger)', marginTop: 6 }}>{scanError}</div>}
          {duplicate && <div style={{ color: 'var(--danger)', marginTop: 6, fontWeight: 600 }}>{t('duplicateInvoice')}</div>}
        </div>
        {scanning && <div id="qr-reader" style={{ width: '100%', maxWidth: 360, marginBottom: 16 }} />}

        <div className="form-row"><label>{t('invoiceNumber')}</label><input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} /></div>
        <div className="form-row"><label>{t('supplier')}</label>
          <select value={supplierId} onChange={e => setSupplierId(e.target.value)}>
            <option value="">-</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-row"><label>{t('date')}</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>

        <table>
          <thead><tr><th>{t('ingredient')}</th><th>{t('quantity')}</th><th></th></tr></thead>
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
                  </td>
                  <td><input type="number" step="0.01" min="0" style={{ width: 100 }} value={l.quantity} onChange={e => setLine(i, { quantity: e.target.value })} /> {ing?.unit}</td>
                  <td><button className="icon-btn danger" onClick={() => setLines(lines.length > 1 ? lines.filter((_, idx) => idx !== i) : lines)}><Trash2 size={16} /></button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
          <button className="btn btn-outline" onClick={() => setLines([...lines, { ingredient_id: '', quantity: '' }])}><Plus size={14} /> {t('addLine')}</button>
          <button className="btn" onClick={save} disabled={saving || duplicate || !invoiceRef.trim()}>{saving ? t('saving') : t('recordReceipt')}</button>
        </div>
      </div>

      {history.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <h2 style={{ marginTop: 0 }}>{t('receiptHistory')}</h2>
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
