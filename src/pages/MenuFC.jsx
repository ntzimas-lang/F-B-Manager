import { useEffect, useMemo, useState, useCallback } from 'react'
import JsBarcode from 'jsbarcode'
import JSZip from 'jszip'
import { readSheet } from 'read-excel-file/browser'
import { supabase } from '../lib/supabase'
import { useStores } from '../context/StoreContext'
import { useAuth } from '../context/AuthContext'

const SLOTS = { 1: 'Comfort Food', 2: 'Greek Roots', 3: 'Veggie Choice', 4: 'Balanced Choice', w: 'Σαββατοκύριακο' }
const DOW = ['Κυρ', 'Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ']
const MON = ['ΙΑΝ', 'ΦΕΒ', 'ΜΑΡ', 'ΑΠΡ', 'ΜΑΪ', 'ΙΟΥΝ', 'ΙΟΥΛ', 'ΑΥΓ', 'ΣΕΠ', 'ΟΚΤ', 'ΝΟΕ', 'ΔΕΚ']
const n2 = (n) => n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const eur = (n) => (isFinite(n) && n > 0 ? n2(n) + ' €' : '–')
const pct = (n) => (isFinite(n) ? n.toLocaleString('el-GR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' : '–')
const dt = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d) }
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dlabel = (s) => { const d = dt(s); return `${DOW[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` }

const priceOf = (d, cfg) => { if (+d.price > 0) return +d.price; const k = d.slot ? String(d.slot) : 'w'; return +(cfg?.slotPrices?.[k]) || 0 }
const net = (p, cfg) => p / (1 + (+cfg?.vat || 0) / 100)
const fcOf = (d, cfg) => { const p = priceOf(d, cfg); return p > 0 ? (+d.cost) / net(p, cfg) * 100 : NaN }
function calc(cfg, dishes, qty, waste) {
  let cost = 0, rev = 0, revW = 0, pcs = 0, w = 0
  dishes.forEach((d) => { const q = +qty?.[d.id] || 0, x = Math.min(+waste?.[d.id] || 0, q), nt = net(priceOf(d, cfg), cfg); cost += q * (+d.cost); rev += q * nt; revW += (q - x) * nt; pcs += q; w += x })
  return { cost, rev, pcs, w, fc: rev > 0 ? cost / rev * 100 : NaN, fcW: revW > 0 ? cost / revW * 100 : NaN }
}
const status = (fc, t) => (!isFinite(fc) ? 'none' : fc <= t ? 'good' : fc <= t + 2 ? 'warn' : 'bad')
const allDishes = (cfg) => (cfg?.days || []).flatMap((d) => d.dishes)
function weeksOf(cfg) {
  const out = []
  ;(cfg?.days || []).forEach((day) => {
    const d = dt(day.date); const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const k = iso(mon)
    let w = out.find((x) => x.key === k); if (!w) { w = { key: k, days: [] }; out.push(w) } w.days.push(day)
  })
  out.forEach((w) => { const a = dt(w.days[0].date), b = dt(w.days[w.days.length - 1].date); w.label = `${String(a.getDate()).padStart(2, '0')}${a.getMonth() !== b.getMonth() ? ' ' + MON[a.getMonth()] : ''}–${String(b.getDate()).padStart(2, '0')} ${MON[b.getMonth()]}` })
  return out
}
function bcSvg(code) {
  if (!code) return ''
  try { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); JsBarcode(s, code, { format: 'CODE128', height: 42, margin: 3, fontSize: 12, background: '#ffffff', lineColor: '#000000' }); return s.outerHTML } catch { return '<span class="code">μη έγκυρος</span>' }
}
const Chip = ({ d }) => { const k = d.slot ? String(d.slot) : 'w'; return <span className={'mf-chip c' + k}>{SLOTS[k]}</span> }
const Pill = ({ fc, t }) => <span className={'pill ' + status(fc, t)}>{pct(fc)}</span>
const nowPeriod = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}` }

export default function MenuFC() {
  const { stores } = useStores()
  const { role, profile } = useAuth()
  const canEdit = ['super_user', 'owner'].includes(role)
  const storeUser = ['store_manager', 'shift_manager'].includes(role)
  const [view, setView] = useState('entry')
  const [period, setPeriod] = useState(() => { try { return localStorage.getItem('mf.p') || nowPeriod() } catch { return nowPeriod() } })
  const [storeId, setStoreId] = useState('')
  const [cfg, setCfg] = useState(undefined)
  const [entries, setEntries] = useState({})
  const [book, setBook] = useState({})
  const [draft, setDraft] = useState({ qty: {}, waste: {} })
  const [dirty, setDirty] = useState(false)
  const [week, setWeek] = useState(0)
  const [msg, setMsg] = useState('')
  const toast = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500) }

  useEffect(() => { if (!storeId && stores.length) setStoreId(storeUser ? (profile?.store_id || stores[0].id) : stores[0].id) }, [stores, storeUser, profile, storeId])

  const loadAll = useCallback(async () => {
    setCfg(undefined)
    const [{ data: m }, { data: e }, { data: b }] = await Promise.all([
      supabase.from('menu_months').select('*').eq('period', period).maybeSingle(),
      supabase.from('menu_entries').select('*').eq('period', period),
      supabase.from('menu_prices').select('*').maybeSingle(),
    ])
    setCfg(m ? { target: m.target, vat: m.vat, slotPrices: m.slot_prices || {}, days: m.days || [] } : null)
    const o = {}; (e || []).forEach((x) => { o[x.store_id] = x }); setEntries(o)
    setBook(b?.codes || {})
  }, [period])
  useEffect(() => { loadAll(); setDirty(false); setWeek(0) }, [loadAll])
  useEffect(() => { if (!dirty) { const e = entries[storeId]; setDraft({ qty: { ...(e?.qty || {}) }, waste: { ...(e?.waste || {}) } }) } }, [entries, storeId, dirty])

  const setPeriodSave = (p) => { if (!p) return; setPeriod(p); try { localStorage.setItem('mf.p', p) } catch {} }
  const canEnterHere = canEdit || (storeUser && storeId === profile?.store_id)
  const store = stores.find((s) => s.id === storeId)

  async function saveQty() {
    const r = calc(cfg, allDishes(cfg), draft.qty, draft.waste)
    const { error } = await supabase.from('menu_entries').upsert({ company_id: profile.company_id, period, store_id: storeId, qty: draft.qty, waste: draft.waste, fc: isFinite(r.fc) ? Math.round(r.fc * 10) / 10 : null, updated_at: new Date().toISOString() })
    if (error) return toast('Δεν αποθηκεύτηκε: ' + error.message)
    setDirty(false); toast('Αποθηκεύτηκε'); loadAll()
  }

  const tabs = [['entry', 'Καταχώρηση'], ['summary', 'Σύνοψη καταστημάτων'], ['ppt', 'PowerPoint'], ...(canEdit ? [['admin', 'Μενού & τιμές']] : [])]
  return (
    <div className="mf">
      <div className="mf-head">
        <label className="f">Περίοδος μενού<input type="month" value={period} onChange={(e) => setPeriodSave(e.target.value)} /></label>
        <label className="f">Κατάστημα
          <select value={storeId} disabled={storeUser} onChange={(e) => { setStoreId(e.target.value); setDirty(false) }}>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </label>
      </div>
      <div className="sch-tabs" style={{ marginBottom: 12 }}>{tabs.map(([k, l]) => <button key={k} className={view === k ? 'btn' : 'btn btn-outline'} onClick={() => setView(k)}>{l}</button>)}</div>
      {msg && <div className="sch-toast">{msg}</div>}
      {view === 'entry' && <Entry cfg={cfg} store={store} period={period} week={week} setWeek={setWeek} draft={draft} setDraft={setDraft} setDirty={setDirty} dirty={dirty} saved={entries[storeId]} canEnter={canEnterHere} onSave={saveQty} />}
      {view === 'summary' && <Summary cfg={cfg} stores={stores} entries={entries} period={period} />}
      {view === 'ppt' && <Ppt cfg={cfg} period={period} toast={toast} />}
      {view === 'admin' && canEdit && <Admin key={period} cfg={cfg} period={period} book={book} profile={profile} toast={toast} onSaved={loadAll} />}
    </div>
  )
}

function WeekChips({ list, cur, set }) {
  return <div className="sch-chips" style={{ padding: '10px 14px' }}>{list.map((w, i) => <button key={w.key} className={'sch-chip' + (i === cur ? ' on' : '')} onClick={() => set(i)}>{w.label}</button>)}</div>
}

function Entry({ cfg, store, period, week, setWeek, draft, setDraft, setDirty, dirty, saved, canEnter, onSave }) {
  if (cfg === undefined) return <div className="card">Φόρτωση μενού…</div>
  if (!cfg || !cfg.days?.length) return <div className="card"><b>{store?.name}</b><p className="muted">Δεν έχει περαστεί μενού για την περίοδο {period}. Το περνάει η διοίκηση από την καρτέλα «Μενού & τιμές».</p></div>
  const W = weeksOf(cfg); const wk = W[week] || W[0]
  const r = calc(cfg, allDishes(cfg), draft.qty, draft.waste), t = +cfg.target, stt = status(r.fc, t)
  const setQ = (k, id, v) => { setDirty(true); setDraft((d) => { const o = { ...d[k] }; if (v === '') delete o[id]; else o[id] = Math.max(0, Math.floor(+v || 0)); return { ...d, [k]: o } }) }
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="mf-strip">
        <div><span>Food cost περιόδου</span><b className={stt}>{pct(r.fc)}</b></div>
        <div><span>Με καταστροφές</span><b className={status(r.fcW, t)}>{pct(r.fcW)}</b></div>
        <div><span>Στόχος</span><b>{pct(t)}</b></div>
        <div><span>Μερίδες</span><b>{r.pcs.toLocaleString('el-GR')}</b></div>
        <div><span>Κόστος / Καθ. πωλήσεις</span><b style={{ fontSize: 15 }}>{eur(r.cost)} / {eur(r.rev)}</b></div>
      </div>
      <div className={'mf-verdict ' + stt}>{stt === 'none' ? 'Βάλτε ποσότητες για να υπολογιστεί το food cost.' : stt === 'good' ? `Εντός στόχου, ${pct(t - r.fc)} κάτω από τον στόχο.` : `Πάνω από τον στόχο κατά ${pct(r.fc - t)}.`}</div>
      <WeekChips list={W} cur={week} set={setWeek} />
      <div className="sch-scroll"><table>
        <thead><tr><th>Πιάτο</th><th>Barcode</th><th>Ποσότητα</th><th>Καταστρ.</th><th>Κόστος</th><th>Τιμή</th><th>Food cost</th></tr></thead>
        <tbody>{wk.days.map((day) => { const dr = calc(cfg, day.dishes, draft.qty, draft.waste); return [
          <tr key={day.date} className="mf-day"><td colSpan={6}><b>{dlabel(day.date)}</b></td><td><Pill fc={dr.fc} t={t} /></td></tr>,
          ...day.dishes.map((d) => (
            <tr key={d.id}>
              <td><Chip d={d} /><div><b style={{ fontWeight: 500 }}>{d.name}</b></div><span className="muted">{d.code}</span></td>
              <td><span className="mf-bc" dangerouslySetInnerHTML={{ __html: bcSvg(d.code) }} /></td>
              <td><input className="mf-qty" type="number" min="0" inputMode="numeric" disabled={!canEnter} value={draft.qty[d.id] ?? ''} placeholder="0" onChange={(e) => setQ('qty', d.id, e.target.value)} /></td>
              <td><input className="mf-qty" type="number" min="0" inputMode="numeric" disabled={!canEnter} value={draft.waste[d.id] ?? ''} placeholder="0" onChange={(e) => setQ('waste', d.id, e.target.value)} /></td>
              <td>{eur(+d.cost)}</td><td>{eur(priceOf(d, cfg))}</td><td><Pill fc={fcOf(d, cfg)} t={t} /></td>
            </tr>)),
        ] })}</tbody></table></div>
      <div className="mf-save">
        <span className="muted">{dirty ? 'Μη αποθηκευμένες αλλαγές' : saved ? `Αποθηκεύτηκε ${new Date(saved.updated_at).toLocaleString('el-GR')}` : 'Δεν έχει καταχωρηθεί ακόμη'}</span>
        {canEnter && <button className="btn" disabled={!dirty} onClick={onSave}>Αποθήκευση</button>}
      </div>
    </div>
  )
}

function Summary({ cfg, stores, entries, period }) {
  if (cfg === undefined) return <div className="card">Φόρτωση…</div>
  if (!cfg || !cfg.days?.length) return <div className="card">Δεν υπάρχει μενού για την περίοδο {period}.</div>
  const t = +cfg.target, all = allDishes(cfg); let tc = 0, tr = 0
  const rows = stores.map((s) => { const e = entries[s.id]; const r = calc(cfg, all, e?.qty, e?.waste); if (e) { tc += r.cost; tr += r.rev } return { s, e, r } })
  const tfc = tr > 0 ? tc / tr * 100 : NaN
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="mf-strip">
        <div><span>Συνολικό food cost</span><b className={status(tfc, t)}>{pct(tfc)}</b></div>
        <div><span>Στόχος</span><b>{pct(t)}</b></div>
        <div><span>Καταχωρήσεις</span><b>{Object.keys(entries).length} / {stores.length}</b></div>
      </div>
      <div className="sch-scroll"><table>
        <thead><tr><th>Κατάστημα</th><th>Μερίδες</th><th>Καταστρ.</th><th>Κόστος</th><th>Καθ. πωλήσεις</th><th>FC</th><th>FC με καταστρ.</th></tr></thead>
        <tbody>{rows.map(({ s, e, r }) => (
          <tr key={s.id}><td><b>{s.name}</b></td><td>{e ? r.pcs.toLocaleString('el-GR') : '–'}</td><td>{e ? r.w : '–'}</td><td>{e ? eur(r.cost) : '–'}</td><td>{e ? eur(r.rev) : '–'}</td>
            <td>{e ? <Pill fc={r.fc} t={t} /> : <span className="pill none">εκκρεμεί</span>}</td><td>{e ? <Pill fc={r.fcW} t={t} /> : ''}</td></tr>))}</tbody></table></div>
    </div>
  )
}

// ---------- PowerPoint ----------
const EMU = 914400, NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main', NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const slotByX = (x) => { x /= EMU; return x < 2.9 ? 1 : x < 4.65 ? 2 : x < 6.35 ? 3 : 4 }
function Ppt({ cfg, period, toast }) {
  const [p, setP] = useState(null)
  if (!cfg || !cfg.days?.length) return <div className="card">Πρώτα χρειάζεται μενού για την περίοδο {period}.</div>
  async function read(file) {
    try {
      const zip = await JSZip.loadAsync(await file.arrayBuffer()); const W = weeksOf(cfg)
      const pres = new DOMParser().parseFromString(await zip.file('ppt/presentation.xml').async('string'), 'application/xml')
      const rels = new DOMParser().parseFromString(await zip.file('ppt/_rels/presentation.xml.rels').async('string'), 'application/xml')
      const relMap = {}; [...rels.getElementsByTagName('Relationship')].forEach((r) => { relMap[r.getAttribute('Id')] = r.getAttribute('Target') })
      const ids = [...pres.getElementsByTagNameNS(NS_P, 'sldId')].map((s) => s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'))
      const rowsOut = []; let filled = 0, missing = 0; const out = {}
      for (let k = 0; k < ids.length; k++) {
        const path = 'ppt/' + relMap[ids[k]].replace(/^\//, '').replace(/^ppt\//, '')
        const xml = new DOMParser().parseFromString(await zip.file(path).async('string'), 'application/xml')
        const shapes = [...xml.getElementsByTagNameNS(NS_P, 'sp')].map((sp) => { const off = sp.getElementsByTagNameNS(NS_A, 'off')[0]; const ts = [...sp.getElementsByTagNameNS(NS_A, 't')]; return { ts, x: off ? +off.getAttribute('x') : 0, y: off ? +off.getAttribute('y') : 0, text: ts.map((t) => t.textContent).join('').trim() } })
        const dayBoxes = shapes.filter((s) => /^\d{1,2}$/.test(s.text) && s.x < 1.1 * EMU).sort((a, b) => a.y - b.y)
        const prices = shapes.filter((s) => /^(\?{2,}|[\d.,]+)\s*€$/.test(s.text.replace(/\s/g, '')) && s.x > 1.1 * EMU)
        const dishes = shapes.filter((s) => s.text && s.x > 1.1 * EMU && s.y > 3.5 * EMU && !prices.includes(s) && !dayBoxes.includes(s))
        const wkDays = W[k]?.days || []
        prices.sort((a, b) => a.y - b.y || a.x - b.x).forEach((pr) => {
          const slot = slotByX(pr.x); const row = [...dayBoxes].reverse().find((d) => d.y <= pr.y + 0.25 * EMU) || dayBoxes[0]; const num = row ? +row.text : NaN
          const day = wkDays.find((d) => dt(d.date).getDate() === num) || cfg.days.find((d) => dt(d.date).getDate() === num && dt(d.date).getDay() >= 1 && dt(d.date).getDay() <= 5)
          const dish = day?.dishes.find((d) => d.slot === slot); const price = dish ? priceOf(dish, cfg) : 0
          const txt = dishes.filter((s) => slotByX(s.x) === slot && s.y < pr.y && s.y > pr.y - 1.4 * EMU).sort((a, b) => b.y - a.y)[0]?.text || ''
          if (price > 0) { pr.ts.forEach((t, i) => { t.textContent = i === 0 ? n2(price) + '€' : '' }); filled++ } else missing++
          rowsOut.push({ date: day?.date, slot, text: txt, erp: dish?.name, price })
        })
        out[path] = new XMLSerializer().serializeToString(xml)
      }
      setP({ name: file.name, zip, out, rows: rowsOut, filled, missing })
    } catch { setP(null); toast('Το PowerPoint δεν διαβάστηκε. Ανεβάστε το .pptx του μενού εβδομάδας.') }
  }
  async function save() {
    for (const [k, v] of Object.entries(p.out)) p.zip.file(k, v)
    const blob = await p.zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = p.name.replace(/\.pptx$/i, '') + ' - τιμές.pptx'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Τιμές στο PowerPoint</h2>
      <p className="muted">Ανεβάστε το «Μενού εβδομάδας» με τα ???€. Η σελίδα γράφει την τιμή κάθε πιάτου, ανά ημέρα και στήλη.</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <input type="file" accept=".pptx" onChange={(e) => e.target.files[0] && read(e.target.files[0])} />
        <button className="btn" disabled={!p || !p.filled} onClick={save}>Λήψη PowerPoint με τιμές</button>
      </div>
      {p ? <>
        <p style={{ color: p.missing ? '#b3261e' : '#1f7a43' }}>{p.filled} τιμές μπήκαν{p.missing ? ` · ${p.missing} χωρίς τιμή ή χωρίς πιάτο` : ''} <span className="muted">· {p.name}</span></p>
        <div className="sch-scroll"><table><thead><tr><th>Ημέρα</th><th>Στήλη</th><th>Στο PowerPoint</th><th>Στο μενού (ERP)</th><th>Τιμή</th></tr></thead>
          <tbody>{p.rows.map((r, i) => <tr key={i}><td>{r.date ? dlabel(r.date) : '?'}</td><td>{r.slot ? <span className={'mf-chip c' + r.slot}>{SLOTS[r.slot]}</span> : ''}</td><td>{r.text}</td><td className="muted">{r.erp || '—'}</td><td style={{ color: r.price ? undefined : '#b3261e' }}>{r.price ? n2(r.price) + '€' : '???'}</td></tr>)}</tbody></table></div>
      </> : <p className="muted">Δεν έχει ανέβει αρχείο ακόμη.</p>}
    </div>
  )
}

// ---------- Μενού & τιμές ----------
function parseDate(v) {
  if (v instanceof Date) { const d = new Date(v.getTime() + 12 * 3600e3); return iso(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) }
  if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 864e5) + 12 * 3600e3); return iso(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) }
  const m = String(v).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? iso(new Date(+m[3], +m[2] - 1, +m[1])) : null
}
function Admin({ cfg, period, book, profile, toast, onSaved }) {
  const [a, setA] = useState(() => ({ target: cfg?.target ?? 30, vat: cfg?.vat ?? 13, slotPrices: { 1: 0, 2: 0, 3: 0, 4: 0, w: 0, ...(cfg?.slotPrices || {}) }, days: JSON.parse(JSON.stringify(cfg?.days || [])) }))
  const [aw, setAw] = useState(0)
  const W = weeksOf(a); const wk = W[aw] || W[0]
  const setDish = (id, f, v) => setA((x) => ({ ...x, days: x.days.map((d) => ({ ...d, dishes: d.dishes.map((s) => (s.id === id ? { ...s, [f]: +v || 0 } : s)) })) }))
  async function importXls(file) {
    try {
      const rows = await readSheet(file)
      const hi = rows.findIndex((r) => r.some((c) => String(c || '').includes('Κωδ.Είδους')))
      if (hi < 0) return toast('Δεν βρέθηκε στήλη «Κωδ.Είδους» στο Excel.')
      const h = rows[hi].map((c) => String(c || '').trim()), ci = (n) => h.findIndex((x) => x.startsWith(n))
      const cD = ci('Ημερομηνία'), cC = ci('Κωδ.Είδους'), cN = ci('Περιγραφή'), cP = ci('ΠΤ')
      const map = new Map()
      rows.slice(hi + 1).forEach((r) => {
        const date = r[cD] != null ? parseDate(r[cD]) : null; const code = r[cC] != null ? String(r[cC]).trim() : ''
        if (!date || !code) return
        if (!map.has(date)) map.set(date, [])
        map.get(date).push({ group: cC > 0 ? r[cC - 1] : null, code, name: String(r[cN] || '').trim(), cost: cP >= 0 ? Math.round((+r[cP] || 0) * 10000) / 10000 : 0 })
      })
      if (!map.size) return toast('Το Excel δεν έχει γραμμές μενού.')
      const days = [...map.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)).map(([date, l]) => {
        const wd = dt(date).getDay(); const weekday = wd >= 1 && wd <= 5
        return { date, dishes: l.map((d, i) => ({ id: `${date}_${i + 1}`, slot: weekday && i < 4 ? i + 1 : null, price: +book[d.code] || 0, ...d })) }
      })
      setA((x) => ({ ...x, days })); setAw(0); toast(`Περάστηκαν ${days.reduce((n, d) => n + d.dishes.length, 0)} πιάτα για ${days.length} ημέρες. Πατήστε Αποθήκευση.`)
    } catch { toast('Το Excel δεν διαβάστηκε. Ελέγξτε ότι είναι το «Μενού με food cost».') }
  }
  async function save() {
    if (!a.days.length) return toast('Ανεβάστε πρώτα το Excel του μενού.')
    const cid = profile.company_id
    const codes = { ...book }; a.days.forEach((d) => d.dishes.forEach((s) => { if (+s.price > 0) codes[s.code] = +s.price }))
    const e1 = await supabase.from('menu_months').upsert({ company_id: cid, period, target: +a.target || 0, vat: +a.vat || 0, slot_prices: a.slotPrices, days: a.days, updated_at: new Date().toISOString() })
    const e2 = await supabase.from('menu_prices').upsert({ company_id: cid, codes, slot_prices: a.slotPrices, updated_at: new Date().toISOString() })
    if (e1.error || e2.error) return toast('Δεν αποθηκεύτηκε: ' + (e1.error || e2.error).message)
    toast('Μενού και τιμές αποθηκεύτηκαν'); onSaved()
  }
  const tmp = { ...a }
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: 14, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', borderBottom: '1px solid #ddd' }}>
        <label className="f">Εισαγωγή από Excel «Μενού με food cost»<input type="file" accept=".xlsx" onChange={(e) => e.target.files[0] && importXls(e.target.files[0])} /></label>
      </div>
      <div style={{ padding: 14, display: 'flex', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid #ddd' }}>
        <label className="f">Στόχος FC %<input type="number" step="0.1" value={a.target} onChange={(e) => setA({ ...a, target: e.target.value })} style={{ width: 90 }} /></label>
        <label className="f">ΦΠΑ %<input type="number" step="1" value={a.vat} onChange={(e) => setA({ ...a, vat: e.target.value })} style={{ width: 90 }} /></label>
        {['1', '2', '3', '4', 'w'].map((k) => <label key={k} className="f">Τιμή {SLOTS[k]} €<input type="number" step="0.05" min="0" value={+a.slotPrices[k] || ''} onChange={(e) => setA({ ...a, slotPrices: { ...a.slotPrices, [k]: +e.target.value || 0 } })} style={{ width: 100 }} /></label>)}
      </div>
      {W.length ? <>
        <WeekChips list={W} cur={aw} set={setAw} />
        <div className="sch-scroll"><table>
          <thead><tr><th>Πιάτο</th><th>Ομάδα</th><th>Κόστος €</th><th>Τιμή € (κενό = της στήλης)</th><th>FC</th></tr></thead>
          <tbody>{wk.days.map((day) => [
            <tr key={day.date} className="mf-day"><td colSpan={5}><b>{dlabel(day.date)}</b></td></tr>,
            ...day.dishes.map((d) => (
              <tr key={d.id}><td><Chip d={d} /><div><b style={{ fontWeight: 500 }}>{d.name}</b></div><span className="muted">{d.code}</span></td><td className="muted">{d.group || ''}</td>
                <td><input className="mf-qty" style={{ width: 90 }} type="number" step="0.001" min="0" value={d.cost} onChange={(e) => setDish(d.id, 'cost', e.target.value)} /></td>
                <td><input className="mf-qty" style={{ width: 90 }} type="number" step="0.05" min="0" value={+d.price || ''} placeholder={n2(priceOf({ ...d, price: 0 }, tmp))} onChange={(e) => setDish(d.id, 'price', e.target.value)} /></td>
                <td><Pill fc={fcOf(d, tmp)} t={+a.target} /></td></tr>)),
          ])}</tbody></table></div>
      </> : <p className="muted" style={{ padding: 14 }}>Ανεβάστε το Excel του μενού για να περαστούν τα πιάτα.</p>}
      <div style={{ padding: 14, textAlign: 'right' }}><button className="btn" onClick={save}>Αποθήκευση μενού & τιμών</button></div>
    </div>
  )
}
