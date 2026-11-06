import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import JsBarcode from 'jsbarcode'
import JSZip from 'jszip'
import { readSheet } from 'read-excel-file/browser'
import { supabase } from '../lib/supabase'
import './menufc.css'

// Αυτόνομη εφαρμογή: δεν έχει καμία σύνδεση με το F&B Manager (δικά της δεδομένα, δικός της κωδικός διαχείρισης)
const STORES = [{ code: '17', name: 'Β17 Διοίκηση' }, { code: '11', name: 'Β11 Συντήρηση' }, { code: '0', name: 'ΕΠ.1' }, { code: '3', name: 'ΕΠ.4' }, { code: '20', name: 'Β20' }]
const SLOTS = { 1: 'Comfort Food', 2: 'Greek Roots', 3: 'Veggie Choice', 4: 'Balanced Choice', w: 'Σαββατοκύριακο' }
const DOW = ['Κυρ', 'Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ']
const MON = ['ΙΑΝ', 'ΦΕΒ', 'ΜΑΡ', 'ΑΠΡ', 'ΜΑΪ', 'ΙΟΥΝ', 'ΙΟΥΛ', 'ΑΥΓ', 'ΣΕΠ', 'ΟΚΤ', 'ΝΟΕ', 'ΔΕΚ']
const n2 = (n) => n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const eur = (n) => (isFinite(n) && n > 0 ? n2(n) + ' €' : '–')
const pct = (n) => (isFinite(n) ? n.toLocaleString('el-GR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' : '–')
const dt = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dlabel = (s) => { const d = dt(s); return `${DOW[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` }
const ls = { get: (k) => { try { return localStorage.getItem(k) } catch { return null } }, set: (k, v) => { try { localStorage.setItem(k, v) } catch {} } }
const ss = { get: (k) => { try { return sessionStorage.getItem(k) } catch { return null } }, set: (k, v) => { try { v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v) } catch {} } }

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
const Chip = ({ d }) => { const k = d.slot ? String(d.slot) : 'w'; return <span className={'chip c' + k}>{SLOTS[k]}</span> }
const Pill = ({ fc, t }) => <span className={'pill ' + status(fc, t)}>{pct(fc)}</span>
const WeekChips = ({ list, cur, set }) => <div className="weeks">{list.map((w, i) => <button key={w.key} className="wk" aria-pressed={i === cur} onClick={() => set(i)}>{w.label}</button>)}</div>
const nowPeriod = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}` }

export default function MenuFC() {
  const [view, setView] = useState('entry')
  const [period, setPeriod] = useState(ls.get('mf.p') || nowPeriod())
  const [store, setStore] = useState(ls.get('mf.s') || STORES[0].code)
  const [cfg, setCfg] = useState(undefined)
  const [entries, setEntries] = useState({})
  const [book, setBook] = useState({})
  const [draft, setDraft] = useState({ qty: {}, waste: {} })
  const [dirty, setDirty] = useState(false)
  const [week, setWeek] = useState(0)
  const [msg, setMsg] = useState('')
  const [admCode, setAdmCode] = useState(ss.get('mf.adm') || '')
  const toast = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  useEffect(() => {
    const l = document.createElement('link'); l.rel = 'stylesheet'
    l.href = 'https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap'
    document.head.appendChild(l); return () => l.remove()
  }, [])
  const loadAll = useCallback(async () => {
    setCfg(undefined)
    const [{ data: m }, { data: e }, { data: b }] = await Promise.all([
      supabase.from('mf_months').select('*').eq('period', period).maybeSingle(),
      supabase.from('mf_entries').select('*').eq('period', period),
      supabase.from('mf_prices').select('*').maybeSingle(),
    ])
    setCfg(m ? { target: m.target, vat: m.vat, slotPrices: m.slot_prices || {}, days: m.days || [] } : null)
    const o = {}; (e || []).forEach((x) => { o[x.store] = x }); setEntries(o); setBook(b?.codes || {})
  }, [period])
  useEffect(() => { loadAll(); setDirty(false); setWeek(0) }, [loadAll])
  useEffect(() => { if (!dirty) { const e = entries[store]; setDraft({ qty: { ...(e?.qty || {}) }, waste: { ...(e?.waste || {}) } }) } }, [entries, store, dirty])

  async function saveQty() {
    const r = calc(cfg, allDishes(cfg), draft.qty, draft.waste)
    const { error } = await supabase.from('mf_entries').upsert({ period, store, qty: draft.qty, waste: draft.waste, fc: isFinite(r.fc) ? Math.round(r.fc * 10) / 10 : null, updated_at: new Date().toISOString() })
    if (error) return toast('Δεν αποθηκεύτηκε. Δοκιμάστε ξανά.')
    setDirty(false); toast('Αποθηκεύτηκε'); loadAll()
  }
  const st = STORES.find((s) => s.code === store)
  const tabs = [['entry', 'Καταχώρηση'], ['summary', 'Σύνοψη καταστημάτων'], ['ppt', 'PowerPoint'], ['admin', 'Μενού & τιμές']]
  const showSave = view === 'entry' && cfg && cfg.days?.length
  return (
    <div className="mfa">
      <div className="wrap">
        <header>
          <div><div className="eyebrow">Γευσήνους · AIA · Food cost</div><h1>Μηνιαίο Μενού</h1></div>
          <div className="controls">
            <label className="f">Περίοδος μενού<input type="month" value={period} onChange={(e) => { if (e.target.value) { setPeriod(e.target.value); ls.set('mf.p', e.target.value) } }} /></label>
            <label className="f">Κατάστημα<select value={store} onChange={(e) => { setStore(e.target.value); ls.set('mf.s', e.target.value); setDirty(false) }}>{STORES.map((s) => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}</select></label>
          </div>
        </header>
        <nav className="tabs">{tabs.map(([k, l]) => <button key={k} className="tab" aria-selected={view === k} onClick={() => setView(k)}>{l}</button>)}</nav>
        {view === 'entry' && <Entry cfg={cfg} st={st} period={period} week={week} setWeek={setWeek} draft={draft} setDraft={setDraft} setDirty={setDirty} />}
        {view === 'summary' && <Summary cfg={cfg} entries={entries} period={period} />}
        {view === 'ppt' && <Ppt cfg={cfg} period={period} toast={toast} />}
        {view === 'admin' && <AdminGate code={admCode} setCode={(c) => { setAdmCode(c); ss.set('mf.adm', c || null) }}><Admin key={period} cfg={cfg} period={period} book={book} code={admCode} toast={toast} onSaved={loadAll} /></AdminGate>}
        <p className="muted">Food cost = κόστος ÷ (τιμή ÷ 1,ΦΠΑ). Με καταστροφές = κόστος όλων ÷ πωλήσεις των μερίδων που πουλήθηκαν. Barcode: Code128 από τον κωδικό είδους.</p>
      </div>
      {showSave && <div className="savebar"><div className="in"><span className="muted">{dirty ? 'Μη αποθηκευμένες αλλαγές' : entries[store] ? `Αποθηκεύτηκε ${new Date(entries[store].updated_at).toLocaleString('el-GR')}` : 'Δεν έχει καταχωρηθεί ακόμη'}</span><button className="btn" disabled={!dirty} onClick={saveQty}>Αποθήκευση</button></div></div>}
      {msg && <div className="toast">{msg}</div>}
      <Link to="/" className="hub-pill">← My Business</Link>
    </div>
  )
}

function Entry({ cfg, st, period, week, setWeek, draft, setDraft, setDirty }) {
  if (cfg === undefined) return <section className="panel"><div className="empty">Φόρτωση μενού…</div></section>
  if (!cfg || !cfg.days?.length) return <section className="panel"><div className="phead"><h2>{st.code} · {st.name}</h2></div><div className="empty">Δεν έχει περαστεί μενού για την περίοδο {period}.<br />Το περνάει η διοίκηση από την καρτέλα «Μενού &amp; τιμές».</div></section>
  const W = weeksOf(cfg); const wk = W[week] || W[0]
  const r = calc(cfg, allDishes(cfg), draft.qty, draft.waste), t = +cfg.target, stt = status(r.fc, t)
  const setQ = (k, id, v) => { setDirty(true); setDraft((d) => { const o = { ...d[k] }; if (v === '') delete o[id]; else o[id] = Math.max(0, Math.floor(+v || 0)); return { ...d, [k]: o } }) }
  return (
    <section className="panel">
      <div className="phead"><h2>{st.code} · {st.name}</h2><span className="muted">{W[0].label.split('–')[0]}–{W[W.length - 1].label.split('–')[1]} · στόχος {pct(t)}</span></div>
      <div className="strip">
        <div><span className="k">Food cost περιόδου</span><span className={'v ' + stt}>{pct(r.fc)}</span></div>
        <div><span className="k">Με καταστροφές</span><span className={'v ' + status(r.fcW, t)}>{pct(r.fcW)}</span></div>
        <div><span className="k">Στόχος</span><span className="v">{pct(t)}</span></div>
        <div><span className="k">Μερίδες</span><span className="v">{r.pcs.toLocaleString('el-GR')}</span></div>
        <div><span className="k">Κόστος / Καθ. πωλήσεις</span><span className="v" style={{ fontSize: '1rem' }}>{eur(r.cost)} / {eur(r.rev)}</span></div>
      </div>
      <div className={'verdict ' + stt}>{stt === 'none' ? 'Βάλτε ποσότητες για να υπολογιστεί το food cost.' : stt === 'good' ? `Εντός στόχου, ${pct(t - r.fc)} κάτω από τον στόχο.` : `Πάνω από τον στόχο κατά ${pct(r.fc - t)}.`}</div>
      <WeekChips list={W} cur={week} set={setWeek} />
      <div className="tscroll"><table>
        <thead><tr><th>Πιάτο</th><th>Barcode</th><th className="num">Ποσότητα</th><th className="num">Καταστρ.</th><th className="num">Κόστος</th><th className="num">Τιμή</th><th className="num">Food cost</th></tr></thead>
        <tbody>{wk.days.map((day) => { const dr = calc(cfg, day.dishes, draft.qty, draft.waste); return [
          <tr key={day.date} className="day"><td colSpan={6}><span className="dl">{dlabel(day.date)}</span></td><td className="num"><Pill fc={dr.fc} t={t} /></td></tr>,
          ...day.dishes.map((d) => (
            <tr key={d.id}>
              <td><Chip d={d} /><div className="dish">{d.name}</div><span className="code">{d.code}</span></td>
              <td><span className="bc" dangerouslySetInnerHTML={{ __html: bcSvg(d.code) }} /></td>
              <td className="num"><input className="qty" type="number" min="0" step="1" inputMode="numeric" value={draft.qty[d.id] ?? ''} placeholder="0" onChange={(e) => setQ('qty', d.id, e.target.value)} /></td>
              <td className="num"><input className="qty" type="number" min="0" step="1" inputMode="numeric" value={draft.waste[d.id] ?? ''} placeholder="0" onChange={(e) => setQ('waste', d.id, e.target.value)} /></td>
              <td className="num">{eur(+d.cost)}</td><td className="num">{eur(priceOf(d, cfg))}</td><td className="num"><Pill fc={fcOf(d, cfg)} t={t} /></td>
            </tr>)),
        ] })}</tbody></table></div>
    </section>
  )
}

function Summary({ cfg, entries, period }) {
  if (cfg === undefined) return <section className="panel"><div className="empty">Φόρτωση…</div></section>
  if (!cfg || !cfg.days?.length) return <section className="panel"><div className="empty">Δεν υπάρχει μενού για την περίοδο {period}.</div></section>
  const t = +cfg.target, all = allDishes(cfg); let tc = 0, tr = 0
  const rows = STORES.map((s) => { const e = entries[s.code]; const r = calc(cfg, all, e?.qty, e?.waste); if (e) { tc += r.cost; tr += r.rev } return { s, e, r } })
  const tfc = tr > 0 ? tc / tr * 100 : NaN
  return (
    <section className="panel">
      <div className="phead"><h2>Όλα τα καταστήματα</h2><span className="muted">{period} · στόχος {pct(t)}</span></div>
      <div className="strip">
        <div><span className="k">Συνολικό food cost</span><span className={'v ' + status(tfc, t)}>{pct(tfc)}</span></div>
        <div><span className="k">Στόχος</span><span className="v">{pct(t)}</span></div>
        <div><span className="k">Καταχωρήσεις</span><span className="v">{Object.keys(entries).length} / {STORES.length}</span></div>
      </div>
      <div className="tscroll"><table>
        <thead><tr><th>Κατάστημα</th><th className="num">Μερίδες</th><th className="num">Καταστρ.</th><th className="num">Κόστος</th><th className="num">Καθ. πωλήσεις</th><th className="num">FC</th><th className="num">FC με καταστρ.</th></tr></thead>
        <tbody>{rows.map(({ s, e, r }) => (
          <tr key={s.code}><td><b>{s.code}</b> · {s.name}</td><td className="num">{e ? r.pcs.toLocaleString('el-GR') : '–'}</td><td className="num">{e ? r.w : '–'}</td><td className="num">{e ? eur(r.cost) : '–'}</td><td className="num">{e ? eur(r.rev) : '–'}</td>
            <td className="num">{e ? <Pill fc={r.fc} t={t} /> : <span className="pill none">εκκρεμεί</span>}</td><td className="num">{e ? <Pill fc={r.fcW} t={t} /> : ''}</td></tr>))}</tbody></table></div>
    </section>
  )
}

// ---------- PowerPoint ----------
const EMU = 914400, NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main', NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const slotByX = (x) => { x /= EMU; return x < 2.9 ? 1 : x < 4.65 ? 2 : x < 6.35 ? 3 : 4 }
function Ppt({ cfg, period, toast }) {
  const [p, setP] = useState(null)
  if (!cfg || !cfg.days?.length) return <section className="panel"><div className="empty">Πρώτα χρειάζεται μενού για την περίοδο {period}.</div></section>
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
    <section className="panel">
      <div className="phead"><h2>Τιμές στο PowerPoint</h2><span className="muted">Ανεβάστε το «Μενού εβδομάδας» με τα ???€. Η σελίδα γράφει την τιμή κάθε πιάτου, ανά ημέρα και στήλη.</span></div>
      <div className="row"><input type="file" accept=".pptx" onChange={(e) => e.target.files[0] && read(e.target.files[0])} /><button className="btn" disabled={!p || !p.filled} onClick={save}>Λήψη PowerPoint με τιμές</button></div>
      {p ? <>
        <div className="phead"><span className={p.missing ? 'err' : 'ok'}>{p.filled} τιμές μπήκαν{p.missing ? ` · ${p.missing} χωρίς τιμή ή χωρίς πιάτο` : ''}</span><span className="muted">{p.name}</span></div>
        <div className="tscroll"><table><thead><tr><th>Ημέρα</th><th>Στήλη</th><th>Στο PowerPoint</th><th>Στο μενού (ERP)</th><th className="num">Τιμή</th></tr></thead>
          <tbody>{p.rows.map((r, i) => <tr key={i}><td>{r.date ? dlabel(r.date) : '?'}</td><td>{r.slot ? <span className={'chip c' + r.slot}>{SLOTS[r.slot]}</span> : ''}</td><td className="dish">{r.text}</td><td className="code">{r.erp || '—'}</td><td className={'num ' + (r.price ? '' : 'err')}>{r.price ? n2(r.price) + '€' : '???'}</td></tr>)}</tbody></table></div>
      </> : <div className="empty">Δεν έχει ανέβει αρχείο ακόμη.</div>}
    </section>
  )
}

// ---------- Μενού & τιμές (με κωδικό διαχείρισης) ----------
function AdminGate({ code, setCode, children }) {
  const [v, setV] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(false)
  useEffect(() => { if (code) supabase.rpc('mf_check_admin', { p_code: code }).then(({ data }) => { if (data) setOk(true); else setCode('') }) }, [])
  if (ok) return children
  return (
    <section className="panel"><div className="phead"><h2>Μενού &amp; τιμές</h2><span className="muted">Μόνο η διοίκηση αλλάζει μενού και τιμές.</span></div>
      <form className="row" onSubmit={async (e) => { e.preventDefault(); const { data } = await supabase.rpc('mf_check_admin', { p_code: v }); if (data) { setCode(v.trim()); setOk(true) } else setErr('Λάθος κωδικός.') }}>
        <label className="f">Κωδικός διαχείρισης<input value={v} onChange={(e) => setV(e.target.value)} autoComplete="off" /></label>
        <button className="btn">Είσοδος</button>{err && <span className="err">{err}</span>}
      </form></section>
  )
}
function parseDate(v) {
  if (v instanceof Date) { const d = new Date(v.getTime() + 12 * 3600e3); return iso(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) }
  if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 864e5) + 12 * 3600e3); return iso(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) }
  const m = String(v).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? iso(new Date(+m[3], +m[2] - 1, +m[1])) : null
}
function Admin({ cfg, period, book, code, toast, onSaved }) {
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
        const date = r[cD] != null ? parseDate(r[cD]) : null; const c = r[cC] != null ? String(r[cC]).trim() : ''
        if (!date || !c) return
        if (!map.has(date)) map.set(date, [])
        map.get(date).push({ group: cC > 0 ? r[cC - 1] : null, code: c, name: String(r[cN] || '').trim(), cost: cP >= 0 ? Math.round((+r[cP] || 0) * 10000) / 10000 : 0 })
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
    const codes = { ...book }; a.days.forEach((d) => d.dishes.forEach((s) => { if (+s.price > 0) codes[s.code] = +s.price }))
    const { error } = await supabase.rpc('mf_save_menu', { p_code: code, p_period: period, p_doc: { target: +a.target || 0, vat: +a.vat || 0, slotPrices: a.slotPrices, days: a.days }, p_book: codes })
    if (error) return toast('Δεν αποθηκεύτηκε. Ελέγξτε τον κωδικό διαχείρισης.')
    toast('Μενού και τιμές αποθηκεύτηκαν'); onSaved()
  }
  return (
    <section className="panel adm">
      <div className="phead"><h2>Μενού &amp; τιμές {period}</h2><span className="muted">{a.days.reduce((n, d) => n + d.dishes.length, 0)} πιάτα · {a.days.length} ημέρες</span></div>
      <div className="row"><label className="f">Εισαγωγή από Excel «Μενού με food cost»<input type="file" accept=".xlsx" onChange={(e) => e.target.files[0] && importXls(e.target.files[0])} /></label></div>
      <div className="row">
        <label className="f">Στόχος FC %<input type="number" step="0.1" value={a.target} onChange={(e) => setA({ ...a, target: e.target.value })} /></label>
        <label className="f">ΦΠΑ %<input type="number" step="1" value={a.vat} onChange={(e) => setA({ ...a, vat: e.target.value })} /></label>
        {['1', '2', '3', '4', 'w'].map((k) => <label key={k} className="f">Τιμή {SLOTS[k]} €<input type="number" step="0.05" min="0" value={+a.slotPrices[k] || ''} onChange={(e) => setA({ ...a, slotPrices: { ...a.slotPrices, [k]: +e.target.value || 0 } })} /></label>)}
      </div>
      {W.length ? <>
        <WeekChips list={W} cur={aw} set={setAw} />
        <div className="tscroll"><table>
          <thead><tr><th>Πιάτο</th><th>Ομάδα</th><th className="num">Κόστος €</th><th className="num">Τιμή € (κενό = της στήλης)</th><th className="num">FC</th></tr></thead>
          <tbody>{wk.days.map((day) => [
            <tr key={day.date} className="day"><td colSpan={5}><span className="dl">{dlabel(day.date)}</span></td></tr>,
            ...day.dishes.map((d) => (
              <tr key={d.id}><td><Chip d={d} /><div className="dish">{d.name}</div><span className="code">{d.code}</span></td><td className="code">{d.group || ''}</td>
                <td className="num"><input type="number" step="0.001" min="0" value={d.cost} onChange={(e) => setDish(d.id, 'cost', e.target.value)} /></td>
                <td className="num"><input type="number" step="0.05" min="0" value={+d.price || ''} placeholder={n2(priceOf({ ...d, price: 0 }, a))} onChange={(e) => setDish(d.id, 'price', e.target.value)} /></td>
                <td className="num"><Pill fc={fcOf(d, a)} t={+a.target} /></td></tr>)),
          ])}</tbody></table></div>
      </> : <div className="empty">Ανεβάστε το Excel του μενού για να περαστούν τα πιάτα.</div>}
      <div className="row" style={{ justifyContent: 'flex-end', borderBottom: 0 }}><button className="btn" onClick={save}>Αποθήκευση μενού &amp; τιμών</button></div>
    </section>
  )
}
