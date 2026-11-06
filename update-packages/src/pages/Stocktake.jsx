import { CATEGORIES } from '../lib/categories'
import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activity'
import { useStores } from '../context/StoreContext'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { Download, Tag, ScanLine, Pencil, Trash2, X, Check } from 'lucide-react'
import { exportXlsx } from '../lib/exportExcel'
import LabelsModal from './LabelsModal'

// Δέχεται κόμμα και απλές πράξεις, π.χ. 12+6 ή 2,5*4
function evalQty(v) {
  if (v === undefined || v === null || String(v).trim() === '') return null
  const c = String(v).replace(/,/g, '.').replace(/\s/g, '')
  if (!/^[0-9+\-*/().]+$/.test(c)) return NaN
  try {
    const r = Function('"use strict";return (' + c + ')')()
    return Number.isFinite(r) ? Math.round(r * 1000) / 1000 : NaN
  } catch { return NaN }
}

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
  const [rooms, setRooms] = useState([])
  const [roomItems, setRoomItems] = useState([]) // {room_id, ingredient_id}
  const [room, setRoom] = useState('all')
  const [editRoom, setEditRoom] = useState(false)
  const [sortBy, setSortBy] = useState('category')
  const [search, setSearch] = useState('')
  const [barcodes, setBarcodes] = useState([])
  const [scan, setScan] = useState(null) // null | {state:'camera'|'unknown'|'manual', code}
  const [scanMsg, setScanMsg] = useState('')
  const [linkIng, setLinkIng] = useState('')
  const [highlight, setHighlight] = useState('')
  const [showLabels, setShowLabels] = useState(false)
  const scannerRef = useRef(null)

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
    const [{ data: rm }, { data: ri }, { data: bc }] = await Promise.all([
      supabase.from('store_rooms').select('*').eq('store_id', activeStoreId).order('position').order('created_at'),
      supabase.from('room_items').select('room_id, ingredient_id'),
      supabase.from('ingredient_barcodes').select('*').order('created_at', { ascending: false }),
    ])
    setRooms(rm || []); setBarcodes(bc || [])
    const ids = new Set((rm || []).map(r => r.id))
    setRoomItems((ri || []).filter(x => ids.has(x.room_id)))
    setRoom(r => (r === 'all' || ids.has(r)) ? r : 'all')
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
    const bad = ingredients.find(i => Number.isNaN(evalQty(counts[i.id])))
    if (bad) { alert(`${t('invalidQty')}: ${bad.name}`); return }
    const items = ingredients.map(ing => {
      const sys = systemQty(ing.id)
      const ev = evalQty(counts[ing.id])
      const counted = ev === null ? sys : ev
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

  // ---- Δωμάτια ----
  async function addRoom() {
    const name = prompt(t('roomName'))
    if (!name || !name.trim()) return
    const { data } = await supabase.from('store_rooms').insert({ store_id: activeStoreId, name: name.trim(), position: rooms.length }).select().single()
    await load(); if (data) setRoom(data.id)
  }
  async function renameRoom() {
    const r = rooms.find(x => x.id === room); if (!r) return
    const name = prompt(t('roomName'), r.name)
    if (!name || !name.trim()) return
    await supabase.from('store_rooms').update({ name: name.trim() }).eq('id', r.id); load()
  }
  async function deleteRoom() {
    const r = rooms.find(x => x.id === room); if (!r) return
    if (!confirm(`${t('confirmDelete')} ${r.name}`)) return
    await supabase.from('store_rooms').delete().eq('id', r.id); setRoom('all'); setEditRoom(false); load()
  }
  async function toggleRoomItem(ingId) {
    const has = roomItems.some(x => x.room_id === room && x.ingredient_id === ingId)
    if (has) {
      setRoomItems(roomItems.filter(x => !(x.room_id === room && x.ingredient_id === ingId)))
      await supabase.from('room_items').delete().eq('room_id', room).eq('ingredient_id', ingId)
    } else {
      setRoomItems([...roomItems, { room_id: room, ingredient_id: ingId }])
      await supabase.from('room_items').insert({ room_id: room, ingredient_id: ingId })
    }
  }
  const roomCount = (id) => roomItems.filter(x => x.room_id === id).length
  const inRoom = (ingId) => roomItems.some(x => x.room_id === room && x.ingredient_id === ingId)
  const roomNamesOf = (ingId) => rooms.filter(r => roomItems.some(x => x.room_id === r.id && x.ingredient_id === ingId)).map(r => r.name).join(', ')

  // ---- Σάρωση ----
  async function stopCamera() {
    const sc = scannerRef.current; scannerRef.current = null
    if (sc) { try { await sc.stop(); sc.clear() } catch { /* ignore */ } }
  }
  useEffect(() => () => { stopCamera() }, [])
  async function openScan() {
    setScanMsg(''); setLinkIng(''); setScan({ state: 'camera' })
    setTimeout(async () => {
      try {
        const sc = new Html5Qrcode('apo-scan')
        scannerRef.current = sc
        await sc.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 260, height: 160 } }, (text) => onCode(text), () => {})
      } catch { setScanMsg(t('cameraError')) }
    }, 100)
  }
  async function closeScan() { await stopCamera(); setScan(null) }
  async function onCode(code) {
    await stopCamera()
    const found = barcodes.find(b => b.barcode === code)
    if (found) { setScan(null); focusItem(found.ingredient_id); return }
    const byCode = ingredients.find(i => i.code && i.code === code)
    if (byCode) { setScan(null); focusItem(byCode.id); return }
    setScan({ state: 'unknown', code })
  }
  function focusItem(id) {
    setRoom('all'); setFCat(''); setFSup(''); setSearch('')
    setHighlight(id)
    setTimeout(() => {
      const el = document.getElementById('qty-' + id)
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.focus() }
    }, 150)
  }
  async function linkBarcode() {
    if (!linkIng || !scan?.code) return
    const { error } = await supabase.from('ingredient_barcodes').insert({ ingredient_id: linkIng, barcode: scan.code, source: 'scan', reviewed: false })
    if (error) { alert(error.message); return }
    const id = linkIng
    setScan(null); await load(); focusItem(id)
  }
  async function reviewBarcode(b, ok) {
    if (ok) await supabase.from('ingredient_barcodes').update({ reviewed: true }).eq('id', b.id)
    else await supabase.from('ingredient_barcodes').delete().eq('id', b.id)
    load()
  }

  async function exportCSV(record) {
    const rows = [[t('code'), t('ingredient'), t('category'), t('supplier'), t('rooms'), t('unit'), t('systemQty'), t('realQty'), t('variance'), t('unitPrice'), t('total')]]
    const roomRows = [[t('rooms'), t('code'), t('ingredient'), t('unit'), t('realQty'), t('value')]]
    record.stocktake_items.forEach(it => {
      const ing = ingredients.find(i => i.id === it.ingredient_id)
      const p = Number(ing?.current_price || 0)
      rows.push([ing?.code || '', ing?.name || '', ing?.category || '', suppliers.find(x => x.id === ing?.supplier_id)?.name || '', roomNamesOf(it.ingredient_id), ing?.unit || '', Number(it.system_qty), Number(it.counted_qty), Number(it.variance), p, Math.round(Number(it.variance) * p * 100) / 100])
      rooms.forEach(r => { if (roomItems.some(x => x.room_id === r.id && x.ingredient_id === it.ingredient_id)) roomRows.push([r.name, ing?.code || '', ing?.name || '', ing?.unit || '', Number(it.counted_qty), Math.round(Number(it.counted_qty) * p * 100) / 100]) })
    })
    const sheets = [{ name: record.month, rows }]
    if (rooms.length) sheets.push({ name: t('rooms'), rows: roomRows })
    await exportXlsx(`stocktake-${store?.name || ''}-${record.month}`, sheets)
  }

  const roomPos = (ingId) => { const r = rooms.find(x => roomItems.some(y => y.room_id === x.id && y.ingredient_id === ingId)); return r ? r.position : 9999 }
  const shownIngredients = ingredients
    .filter(i => (!fCat || (fCat === '__none' ? !i.category : i.category === fCat)) && (!fSup || i.supplier_id === fSup)
      && (room === 'all' || editRoom || inRoom(i.id))
      && (!search || (i.name + ' ' + (i.code || '')).toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => sortBy === 'room' ? (roomPos(a.id) - roomPos(b.id) || a.name.localeCompare(b.name))
      : sortBy === 'name' ? a.name.localeCompare(b.name)
      : (a.category || '~').localeCompare(b.category || '~') || a.name.localeCompare(b.name))
  const pending = barcodes.filter(b => !b.reviewed && b.source === 'scan')

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
        <div style={{display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center'}}>
          <span style={{fontSize:13, color:'#6b6b5f'}}>{t('rooms')}</span>
          <button className={room === 'all' ? 'btn' : 'btn btn-outline'} style={{borderRadius:20}} onClick={() => { setRoom('all'); setEditRoom(false) }}>{t('allRooms')}</button>
          {rooms.map(r => (
            <button key={r.id} className={room === r.id ? 'btn' : 'btn btn-outline'} style={{borderRadius:20}} onClick={() => { setRoom(r.id); setEditRoom(false) }}>{r.name} <span style={{opacity:.7, fontSize:12}}>{roomCount(r.id)}</span></button>
          ))}
          {!readOnly && <button className="btn btn-outline" style={{borderRadius:20, borderStyle:'dashed'}} onClick={addRoom}>+ {t('room')}</button>}
        </div>
        {room !== 'all' && !readOnly && (
          <div style={{display:'flex', gap:8, marginBottom:12, flexWrap:'wrap'}}>
            <button className={editRoom ? 'btn' : 'btn btn-outline'} onClick={() => setEditRoom(!editRoom)}>{editRoom ? <><Check size={14}/> {t('done')}</> : t('whichItems')}</button>
            <button className="icon-btn" onClick={renameRoom}><Pencil size={16}/></button>
            <button className="icon-btn danger" onClick={deleteRoom}><Trash2 size={16}/></button>
          </div>
        )}
        <div style={{display:'flex', gap:8, marginBottom:12, flexWrap:'wrap'}}>
          {!readOnly && <button className="btn" onClick={openScan}><ScanLine size={16}/> {t('scanBtn')}</button>}
          <button className="btn btn-outline" onClick={() => setShowLabels(true)}><Tag size={16}/> {t('labels')}</button>
          <input placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="category">{t('sortBy')}: {t('category')}</option>
            <option value="room">{t('sortBy')}: {t('rooms')}</option>
            <option value="name">{t('sortBy')}: {t('name')}</option>
          </select>
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
              <thead><tr>{editRoom && <th></th>}<th>{t('code')}</th><th>{t('ingredient')}</th><th>{t('category')}</th><th>{t('supplier')}</th><th>{t('systemQty')}</th><th>{t('realQty')}</th><th>{t('variance')}</th></tr></thead>
              <tbody>
                {shownIngredients.map(ing => {
                  const sys = systemQty(ing.id)
                  const val = counts[ing.id]
                  const ev = evalQty(val)
                  const counted = ev === null || Number.isNaN(ev) ? sys : ev
                  const diff = counted - sys
                  return (
                    <tr key={ing.id} style={highlight === ing.id ? { background: 'var(--olive-50, #f4f5ec)' } : undefined}>
                      {editRoom && <td><input type="checkbox" checked={inRoom(ing.id)} onChange={() => toggleRoomItem(ing.id)} /></td>}
                      <td style={{color:'#6b6b5f'}}>{ing.code || '-'}</td>
                      <td>{ing.name}</td>
                      <td>{ing.category || '-'}</td>
                      <td>{suppliers.find(x => x.id === ing.supplier_id)?.name || '-'}</td>
                      <td>{sys} {ing.unit}</td>
                      <td><input id={'qty-' + ing.id} type="text" inputMode="decimal" disabled={readOnly} style={{width:100}} placeholder={String(sys)} value={val ?? ''} onChange={e => setCounts({...counts, [ing.id]: e.target.value})} /></td>
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

      {showLabels && <LabelsModal items={shownIngredients} onClose={() => setShowLabels(false)} />}
      {scan && (
        <div className="modal-overlay" onClick={closeScan}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between'}}><h2>{t('scanBtn')}</h2><button className="icon-btn" onClick={closeScan}><X /></button></div>
            {scan.state === 'camera' && (<><div id="apo-scan" style={{width:'100%'}} />{scanMsg && <p style={{color:'var(--danger)'}}>{scanMsg}</p>}</>)}
            {scan.state === 'unknown' && (
              <div>
                <p>{t('unknownBarcode')}: <b>{scan.code}</b></p>
                <div className="form-row">
                  <label>{t('linkToIngredient')}</label>
                  <select value={linkIng} onChange={e => setLinkIng(e.target.value)}>
                    <option value="">{t('selectOption')}</option>
                    {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
                <div className="modal-actions"><button className="btn" onClick={linkBarcode} disabled={!linkIng}>{t('save')}</button></div>
              </div>
            )}
          </div>
        </div>
      )}

      {!readOnly && pending.length > 0 && (
        <div className="card" style={{marginTop:20}}>
          <h2 style={{marginTop:0}}>{t('barcodeLinks')} <span className="badge badge-warn">{pending.length}</span></h2>
          <table>
            <tbody>
              {pending.map(b => (
                <tr key={b.id}>
                  <td>{b.barcode}</td>
                  <td>{ingredients.find(i => i.id === b.ingredient_id)?.name}</td>
                  <td style={{whiteSpace:'nowrap'}}>
                    <button className="btn btn-outline" onClick={() => reviewBarcode(b, true)}>{t('correct')}</button>{' '}
                    <button className="btn btn-outline" onClick={() => reviewBarcode(b, false)}>{t('delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
