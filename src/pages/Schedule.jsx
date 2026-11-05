import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useStores } from '../context/StoreContext'
import { useAuth } from '../context/AuthContext'
import { exportXlsx } from '../lib/exportExcel'
import { Plus, X, Trash2, Download, Wand2, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  DOW, DOW_LONG, ISO_SHORT, MON, MON_GEN, SHIFT_LBL, yp, daysIn, dowOf, isWE, isoDow, shiftKey, normTime, oneT, shTime, shortT,
  groups, storeOpen, cellOf, sixthDays, coverage, gapsFor, buildReport, generate, fmtH, hm, DEFAULT_SHIFTS,
} from '../lib/schedule'

const nowYm = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') }
const shiftYm = (ym, k) => { const [y, m] = yp(ym); const d = new Date(y, m - 1 + k, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') }
const cfgFromRow = (store, r) => ({
  id: store.id, name: store.name,
  weekend: r ? r.weekend : true, open24: r ? r.open24 : false,
  openFrom: r?.open_from || '', openTo: r?.open_to || '', sheet: r?.sheet || '',
  shifts: r && Array.isArray(r.shifts) && r.shifts.length ? r.shifts : DEFAULT_SHIFTS,
})

export default function Schedule() {
  const { stores: allStores, selectedStoreId } = useStores()
  const { profile, role, readOnly } = useAuth()
  const canEdit = !readOnly && ['super_user', 'owner', 'store_manager'].includes(role)
  const [view, setView] = useState('grid')
  const [ym, setYm] = useState(nowYm())
  const [cfgRows, setCfgRows] = useState([])
  const [employees, setEmployees] = useState([])
  const [cells, setCells] = useState({})
  const [store, setStore] = useState(selectedStoreId && selectedStoreId !== 'all' ? selectedStoreId : 'all')
  const [editor, setEditor] = useState(null)
  const [confirmGen, setConfirmGen] = useState(false)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)

  const toast = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  const stores = useMemo(() => allStores.map((s) => cfgFromRow(s, cfgRows.find((r) => r.store_id === s.id))), [allStores, cfgRows])
  const staff = useMemo(() => employees.filter((e) => e.active !== false).map((e) => ({
    id: e.id, name: e.name, code: e.code || '', home: e.store_id, kind: e.kind || 'shift',
    fixedTime: e.fixed_time || '', fixedDays: e.fixed_days || [1, 2, 3, 4, 5], order: e.sched_order || 0,
  })).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'el')), [employees])
  const ctx = useMemo(() => ({ ym, stores, staff, cells }), [ym, stores, staff, cells])

  const loadBase = useCallback(async () => {
    const [{ data: cf }, { data: emp }] = await Promise.all([
      supabase.from('store_sched').select('*'),
      supabase.from('employees').select('*').order('name'),
    ])
    setCfgRows(cf || []); setEmployees(emp || [])
  }, [])
  const loadMonth = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('sched_months').select('cells').eq('ym', ym).maybeSingle()
    setCells(data?.cells || {}); setLoading(false)
  }, [ym])
  useEffect(() => { loadBase() }, [loadBase])
  useEffect(() => { loadMonth() }, [loadMonth])

  async function writeCells(sid, map, replace = false) {
    setCells((c) => {
      const row = replace ? {} : { ...(c[sid] || {}) }
      for (const d in map) { if (map[d] == null) delete row[d]; else row[d] = map[d] }
      return { ...c, [sid]: row }
    })
    const { error } = await supabase.rpc('save_cells', { p_ym: ym, p_data: { [sid]: map }, p_replace: replace })
    if (error) { toast('Δεν αποθηκεύτηκε: ' + error.message); loadMonth() }
  }

  async function runGenerate() {
    setConfirmGen(false)
    const out = generate(ctx)
    setCells((c) => ({ ...c, ...out }))
    const { error } = await supabase.rpc('save_cells', { p_ym: ym, p_data: out, p_replace: true })
    if (error) { toast('Δεν αποθηκεύτηκε: ' + error.message); loadMonth(); return }
    const nc = { ...cells, ...out }
    const cov = coverage({ ...ctx, cells: nc })
    const g = stores.reduce((a, st) => a + gapsFor({ ...ctx, cells: nc }, st, cov), 0)
    toast(g ? `Έτοιμο. ${g === 1 ? 'Έμεινε 1 κενό' : 'Έμειναν ' + g + ' κενά'} κάλυψης, δες τα κόκκινα.` : 'Έτοιμο, πλήρης κάλυψη.')
  }

  async function exportXls() {
    const [y, m] = yp(ym), n = daysIn(ym)
    const sheets = stores.map((st) => {
      const ppl = staff.filter((s) => s.home === st.id)
      const rows = [['ΚΩΔΙΚΟΣ', 'ΟΝΟΜΑΤΑ', ...Array.from({ length: n }, (_, i) => `${DOW[dowOf(ym, i + 1)]} ${String(i + 1).padStart(2, '0')}/${String(m).padStart(2, '0')}`)]]
      for (const s of ppl) {
        const six = sixthDays(ctx, s.id)
        rows.push([s.code, s.name, ...Array.from({ length: n }, (_, i) => {
          const d = i + 1, c = cellOf(ctx, s.id, d); let v = ''
          if (c?.k === 'r') v = 'ΡΕΠΟ'
          else if (c?.k === 'a') v = 'ΑΔΕΙΑ'
          else if (c?.k === 'w') { v = (c.t || '').replace('-', ' - '); if (c.s && c.s !== s.home) v += ' (' + (stores.find((x) => x.id === c.s)?.name || '') + ')' }
          if (six.has(d) && v) v += ' *'
          return v
        })])
      }
      rows.push([]); rows.push(['', '* = 6η μέρα εργασίας'])
      return { name: st.sheet || st.name, rows }
    }).filter((s) => s.rows.length > 3)
    if (!sheets.length) return toast('Δεν υπάρχει προσωπικό για εξαγωγή')
    await exportXlsx(`Προγραμμα ${MON_GEN[m - 1]} ${y}`, sheets)
  }

  const gapsTotal = useMemo(() => { const cov = coverage(ctx); return Object.fromEntries(stores.map((st) => [st.id, gapsFor(ctx, st, cov)])) }, [ctx, stores])
  const [y, m] = yp(ym)

  return (
    <div className="sch">
      <div className="sch-bar">
        <div className="sch-month">
          <button className="icon-btn" onClick={() => setYm(shiftYm(ym, -1))}><ChevronLeft size={18} /></button>
          <b>{MON[m - 1]} {y}</b>
          <button className="icon-btn" onClick={() => setYm(shiftYm(ym, 1))}><ChevronRight size={18} /></button>
        </div>
        <div className="sch-tabs">
          {[['grid', 'Πρόγραμμα'], ['stores', 'Μαγαζιά'], ['report', 'Αναφορές']].map(([k, l]) => (
            <button key={k} className={view === k ? 'btn' : 'btn btn-outline'} onClick={() => setView(k)}>{l}</button>
          ))}
        </div>
        {view === 'grid' && (
          <div className="sch-act">
            {canEdit && <button className="btn btn-outline" onClick={() => setConfirmGen(true)}><Wand2 size={15} /> Αυτόματο πρόγραμμα</button>}
            <button className="btn" onClick={exportXls}><Download size={15} /> Excel</button>
          </div>
        )}
      </div>
      {msg && <div className="sch-toast">{msg}</div>}
      {confirmGen && (
        <div className="sch-banner">
          <p><b>Αυτόματο πρόγραμμα για {MON[m - 1]} {y}.</b> Θα ξαναγραφτεί όλος ο μήνας. Οι άδειες μένουν, οι σταθεροί παίρνουν το ωράριό τους και οι υπόλοιποι μοιράζονται σε βάρδιες με 2 ρεπό την εβδομάδα.</p>
          <button className="btn" onClick={runGenerate}>Φτιάξ' το</button>
          <button className="btn btn-outline" onClick={() => setConfirmGen(false)}>Άκυρο</button>
        </div>
      )}

      {view === 'grid' && (
        <>
          <div className="sch-chips">
            {stores.map((st) => (
              <button key={st.id} className={'sch-chip' + (store === st.id ? ' on' : '')} onClick={() => setStore(st.id)}>
                {st.name}{gapsTotal[st.id] ? <span className="gap">{gapsTotal[st.id]}</span> : null}
              </button>
            ))}
            <button className={'sch-chip' + (store === 'all' ? ' on' : '')} onClick={() => setStore('all')}>Όλα μαζί</button>
          </div>
          {loading ? <div className="card">Φόρτωση…</div> : !staff.length ? <div className="card">Δεν υπάρχει προσωπικό. Πρόσθεσε άτομα από την καρτέλα Προσωπικό.</div> :
            (store === 'all' ? stores : stores.filter((s) => s.id === store)).map((st) => (
              <RosterTable key={st.id} st={st} ctx={ctx} canEdit={canEdit} onCell={(s, d) => setEditor({ sid: s.id, d, store: cellOf(ctx, s.id, d)?.s || s.home })} />
            ))}
          <div className="sch-legend"><span><i className="sh-P" />Πρωί</span><span><i className="sh-A" />Απόγευμα</span><span><i className="sh-N" />Νύχτα</span><span><i className="k-r" />Ρ = ρεπό</span><span><i className="k-a" />ΑΔ = άδεια</span><span><i className="k-x" />Σε άλλο μαγαζί</span><span><i className="six" />6η μέρα</span></div>
        </>
      )}
      {view === 'stores' && <StoresConfig stores={stores} staff={staff} canEdit={canEdit} companyId={profile?.company_id} onSaved={loadBase} toast={toast} />}
      {view === 'report' && (loading ? <div className="card">Φόρτωση…</div> : <Report ctx={ctx} onGo={(id) => { setStore(id); setView('grid') }} />)}

      {editor && <CellEditor ctx={ctx} ed={editor} onClose={() => setEditor(null)} write={writeCells} toast={toast} />}
    </div>
  )
}

function RosterTable({ st, ctx, canEdit, onCell }) {
  const { ym, staff } = ctx
  const people = staff.filter((s) => s.home === st.id)
  const n = daysIn(ym), cov = coverage(ctx), g = gapsFor(ctx, st, cov)
  const wk = (d) => (isoDow(ym, d) === 1 && d > 1 ? ' wk' : '')
  const shortName = (id) => String((ctx.stores.find((x) => x.id === id) || {}).name || '').split(' ·')[0]
  return (
    <section className="sch-store card">
      <div className="sch-store-h">
        <h2>{st.name}</h2>
        <span className="muted">{people.length} άτομα · {st.weekend ? '7 μέρες' : 'Δε–Πα'}{st.open24 ? ' · 24ωρο' : st.openFrom && st.openTo ? ` · ${st.openFrom}–${st.openTo}` : ''}</span>
        <span className={'pill ' + (g ? 'bad' : 'good')}>{g ? `${g} ${g === 1 ? 'κενό' : 'κενά'}` : 'πλήρης κάλυψη'}</span>
      </div>
      <div className="sch-scroll">
        <table className="roster">
          <thead><tr><th className="name" />
            {Array.from({ length: n }, (_, i) => i + 1).map((d) => { const w = dowOf(ym, d); return <th key={d} className={(w === 0 || w === 6 ? 'we' : '') + wk(d) + (storeOpen(st, ym, d) ? '' : ' closed')}>{DOW[w]}<b>{d}</b></th> })}
            <th>Μέρες</th></tr></thead>
          <tbody>
            {people.map((s) => {
              const six = sixthDays(ctx, s.id); let work = 0, off = 0
              return (
                <tr key={s.id}>
                  <td className="name"><span>{s.name}</span>{s.kind === 'fixed' && <em>Σταθερό {shortT(s.fixedTime)}</em>}</td>
                  {Array.from({ length: n }, (_, i) => i + 1).map((d) => {
                    const c = cellOf(ctx, s.id, d); let cls = (isWE(ym, d) ? 'we' : '') + wk(d), inner = null, tip = ''
                    if (!c) cls += ' k-e'
                    else if (c.k === 'r') { cls += ' k-r'; inner = 'Ρ'; off++; tip = 'Ρεπό' }
                    else if (c.k === 'a') { cls += ' k-a'; inner = 'ΑΔ'; tip = 'Άδεια' }
                    else {
                      work++; const [a, b] = (c.t || '').split('-'); cls += ' sh-' + shiftKey(c.t); tip = c.t
                      inner = <><span>{shortT(a)}</span><span>{shortT(b)}</span>{c.s && c.s !== s.home && <span className="to">→{shortName(c.s)}</span>}</>
                      if (c.s && c.s !== s.home) cls += ' k-x'
                    }
                    if (six.has(d)) cls += ' six'
                    return <td key={d} className={cls}><button className="c" title={tip} disabled={!canEdit} onClick={() => onCell(s, d)}>{inner}</button></td>
                  })}
                  <td className="tot"><b>{work}</b><span>{off} Ρ</span></td>
                </tr>
              )
            })}
            {groups(st).map((sh) => (
              <tr key={sh.k} className="cov">
                <td className="name">{sh.label} <span className="muted">θέλει {sh.wd}{st.weekend && sh.we !== sh.wd ? ' · ΣΚ ' + sh.we : ''}</span></td>
                {Array.from({ length: n }, (_, i) => i + 1).map((d) => {
                  if (!storeOpen(st, ym, d)) return <td key={d} />
                  const need = isWE(ym, d) ? sh.we : sh.wd, have = (((cov[st.id] || {})[d] || {})[sh.k]) || 0
                  return have < need ? <td key={d} className="cv-short">−{need - have}</td> : have > need ? <td key={d} className="cv-over">+{have - need}</td> : <td key={d} className="cv-ok">✓</td>
                })}
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function CellEditor({ ctx, ed, onClose, write, toast }) {
  const { ym, stores, staff } = ctx
  const s = staff.find((x) => x.id === ed.sid)
  const [storeId, setStoreId] = useState(ed.store)
  const [until, setUntil] = useState(ed.d)
  const [custom, setCustom] = useState('')
  const n = daysIn(ym), c = cellOf(ctx, s.id, ed.d)
  const st = stores.find((x) => x.id === storeId)
  const times = []
  if (s.kind === 'fixed' && s.fixedTime) times.push(s.fixedTime)
  for (const sh of st?.shifts || []) for (const t of sh.times || []) if (!times.includes(t)) times.push(t)
  async function apply(t) {
    const val = { k: 'w', t, ...(storeId !== s.home ? { s: storeId } : {}) }
    if (until <= ed.d) { await write(s.id, { [ed.d]: val }); return onClose() }
    const map = {}; let k = 0, skip = 0
    for (let d = ed.d; d <= until; d++) {
      const cc = cellOf(ctx, s.id, d)
      if (d !== ed.d && (!cc || cc.k !== 'w')) { skip++; continue }
      if (st && !storeOpen(st, ym, d)) { skip++; continue }
      map[d] = { ...val }; k++
    }
    await write(s.id, map); toast(`Άλλαξαν ${k} ${k === 1 ? 'μέρα' : 'μέρες'}${skip ? ` · κράτησα ${skip} ρεπό/άδειες/κλειστές μέρες` : ''}`); onClose()
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div><h2 style={{ margin: 0 }}>{s.name}</h2><div className="muted">{DOW_LONG[dowOf(ym, ed.d)]} {ed.d} {MON[yp(ym)[1] - 1]}</div></div>
          <button className="icon-btn" onClick={onClose}><X /></button>
        </div>
        <div className="ed-lbl">Δουλεύει στο</div>
        <div className="opts">{stores.map((x) => <button key={x.id} className={'opt' + (x.id === storeId ? ' on' : '')} onClick={() => setStoreId(x.id)}>{x.name}{x.id === s.home ? ' (δικό του)' : ''}</button>)}</div>
        <div className="form-row"><label>Ισχύει</label>
          <select value={until} onChange={(e) => setUntil(+e.target.value)}>
            <option value={ed.d}>μόνο αυτή τη μέρα</option>
            {Array.from({ length: n - ed.d }, (_, i) => ed.d + 1 + i).map((x) => <option key={x} value={x}>μέχρι {DOW[dowOf(ym, x)]} {x}/{yp(ym)[1]}</option>)}
          </select>
        </div>
        <div className="ed-lbl">Ωράριο</div>
        <div className="opts">{times.map((t) => <button key={t} className={'opt' + (c?.k === 'w' && c.t === t && (c.s || s.home) === storeId ? ' on' : '')} onClick={() => apply(t)}>{t}</button>)}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="άλλο, π.χ. 09:00-17:00" />
          <button className="btn" onClick={() => { const t = normTime(custom); if (!t) return toast('Γράψε το ωράριο σαν 09:00-17:00'); apply(t) }}>OK</button>
        </div>
        <div className="ed-lbl">Ή</div>
        <div className="opts">
          <button className="opt" onClick={async () => { await write(s.id, { [ed.d]: { k: 'r' } }); onClose() }}>ΡΕΠΟ</button>
          <button className="opt" onClick={async () => { await write(s.id, { [ed.d]: { k: 'a' } }); onClose() }}>ΑΔΕΙΑ</button>
          <button className="opt" onClick={async () => { await write(s.id, { [ed.d]: null }); onClose() }}>Κενό</button>
        </div>
      </div>
    </div>
  )
}

function StoresConfig({ stores, staff, canEdit, companyId, onSaved, toast }) {
  const [drafts, setDrafts] = useState({})
  const get = (st) => drafts[st.id] || st
  const patch = (st, p) => setDrafts((d) => ({ ...d, [st.id]: { ...get(st), ...p } }))
  async function save(st) {
    const x = get(st)
    const { error } = await supabase.from('store_sched').upsert({
      store_id: x.id, company_id: companyId, weekend: x.weekend, open24: x.open24,
      open_from: x.openFrom || null, open_to: x.openTo || null, sheet: x.sheet || null,
      shifts: x.shifts.map((sh) => ({ wd: +sh.wd || 0, we: x.weekend ? (+sh.we || 0) : 0, times: [shTime(sh)] })),
    })
    if (error) return toast('Δεν αποθηκεύτηκε: ' + error.message)
    setDrafts((d) => { const c = { ...d }; delete c[st.id]; return c }); onSaved(); toast('Αποθηκεύτηκε')
  }
  function setShift(st, j, p) { const x = get(st); patch(st, { shifts: x.shifts.map((sh, i) => (i === j ? { ...sh, ...p } : sh)) }) }
  function setTime(st, j, which, v) {
    const sh = get(st).shifts[j]; const [a, b] = shTime(sh).split('-'); const t = oneT(v)
    if (!t) return toast('Γράψε την ώρα σαν 07:00')
    setShift(st, j, { times: [which === 'from' ? t + '-' + b : a + '-' + t] })
  }
  return (
    <div>
      {stores.map((st0) => {
        const st = get(st0), dirty = !!drafts[st.id]
        const ppl = staff.filter((s) => s.home === st.id).length
        return (
          <section key={st.id} className="card" style={{ marginBottom: 14 }}>
            <div className="sch-store-h">
              <h2>{st.name}</h2><span className="muted">{ppl} άτομα</span>
              <label><input type="checkbox" checked={st.weekend} disabled={!canEdit} onChange={(e) => patch(st0, { weekend: e.target.checked })} /> Ανοιχτό Σαββατοκύριακο</label>
              <label><input type="checkbox" checked={st.open24} disabled={!canEdit} onChange={(e) => patch(st0, { open24: e.target.checked })} /> 24ωρο</label>
              {!st.open24 && <span>Ανοιχτό <input className="tin" disabled={!canEdit} defaultValue={st.openFrom} key={'f' + st.openFrom} placeholder="08:00" onBlur={(e) => { const v = oneT(e.target.value); patch(st0, { openFrom: v || '' }) }} /> – <input className="tin" disabled={!canEdit} defaultValue={st.openTo} key={'t' + st.openTo} placeholder="16:00" onBlur={(e) => { const v = oneT(e.target.value); patch(st0, { openTo: v || '' }) }} /></span>}
            </div>
            <table>
              <thead><tr><th>#</th><th>Από</th><th>Έως</th><th></th><th>Άτομα καθημερινή</th><th>Άτομα Σαβ/κο</th><th /></tr></thead>
              <tbody>
                {st.shifts.map((sh, j) => {
                  const [a, b] = shTime(sh).split('-'); const k = shiftKey(shTime(sh))
                  return (
                    <tr key={j}>
                      <td>{j + 1}</td>
                      <td><input className="tin" disabled={!canEdit} key={'a' + a} defaultValue={a} onBlur={(e) => setTime(st0, j, 'from', e.target.value)} /></td>
                      <td><input className="tin" disabled={!canEdit} key={'b' + b} defaultValue={b} onBlur={(e) => setTime(st0, j, 'to', e.target.value)} /></td>
                      <td><span className={'kchip k' + k}>{SHIFT_LBL[k]}</span></td>
                      <td><input type="number" min="0" max="20" style={{ width: 70 }} disabled={!canEdit} value={sh.wd} onChange={(e) => setShift(st0, j, { wd: e.target.value })} /></td>
                      <td>{st.weekend ? <input type="number" min="0" max="20" style={{ width: 70 }} disabled={!canEdit} value={sh.we} onChange={(e) => setShift(st0, j, { we: e.target.value })} /> : <span className="muted">κλειστό</span>}</td>
                      <td>{canEdit && st.shifts.length > 1 && <button className="icon-btn danger" onClick={() => patch(st0, { shifts: st.shifts.filter((_, i) => i !== j) })}><Trash2 size={14} /></button>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {canEdit && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-outline" onClick={() => { const last = shTime(st.shifts[st.shifts.length - 1] || {}); const b = last.split('-')[1] || '14:00'; const h = (parseInt(b) + 8) % 24; patch(st0, { shifts: [...st.shifts, { wd: 1, we: st.weekend ? 1 : 0, times: [b + '-' + String(h).padStart(2, '0') + b.slice(2)] }] }) }}><Plus size={14} /> Βάρδια</button>
                <label>Φύλλο Excel <input value={st.sheet} onChange={(e) => patch(st0, { sheet: e.target.value })} placeholder={st.name} /></label>
                <button className="btn" disabled={!dirty} onClick={() => save(st0)} style={{ marginLeft: 'auto' }}>Αποθήκευση</button>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function Report({ ctx, onGo }) {
  const R = useMemo(() => buildReport(ctx), [ctx])
  const pct = R.T.need ? R.T.have / R.T.need : 1
  const tile = (label, val, sub, cls = '') => <div className={'sch-tile ' + cls}><span>{label}</span><b>{val}</b><small>{sub}</small></div>
  const groupsL = [['gap', 'Κενά κάλυψης'], ['hours', 'Ώρες λειτουργίας χωρίς άτομο'], ['rest', 'Λίγη ανάπαυση ανάμεσα σε βάρδιες (κάτω από 11 ώρες)'], ['six', '6η μέρα εργασίας'], ['empty', 'Κενές μέρες στο πρόγραμμα']]
  const maxM = Math.max(1, ...R.people.map((p) => p.mins))
  return (
    <div>
      <div className="sch-tiles">
        {tile('Κάλυψη', Math.round(pct * 100) + '%', `${R.T.have} από ${R.T.need} βάρδιες`, pct < 1 ? 'warn' : 'ok')}
        {tile('Κενά κάλυψης', R.T.short, R.T.short ? 'βάρδιες χωρίς άτομο' : 'όλες καλυμμένες', R.T.short ? 'bad' : 'ok')}
        {tile('Ώρες εργασίας', Math.round(R.T.mins / 60), `σε ${R.people.length} άτομα`)}
        {tile('Θέματα ελέγχου', R.issues.length, R.issues.length ? 'δες τη λίστα' : 'κανένα', R.issues.length ? 'warn' : 'ok')}
        {tile('Έκτες μέρες', R.six, 'πάνω από 5 μέρες/βδομάδα')}
        {tile('Υπερωρίες', fmtH(R.otTotal), R.otTotal ? 'ώρες για να κλείσουν τα μαγαζιά' : 'δεν χρειάζονται')}
        {tile('Μέρες άδειας', R.lv, `${R.cross} μέρες σε άλλο μαγαζί`)}
      </div>
      <h2>Ανά μαγαζί</h2>
      <div className="card sch-scroll"><table>
        <thead><tr><th>Μαγαζί</th><th>Χρειάζονται</th><th>Καλύφθηκαν</th><th>Λείπουν</th><th>Περισσεύουν</th><th>Ώρες</th><th>Κάλυψη</th></tr></thead>
        <tbody>{R.stores.map((x) => (
          <tr key={x.st.id}><td><button className="link-btn" onClick={() => onGo(x.st.id)}>{x.st.name}</button></td><td>{x.need}</td><td>{x.have}</td><td style={{ color: x.short ? '#b3261e' : undefined }}>{x.short || '—'}</td><td>{x.over || '—'}</td><td>{Math.round(x.mins / 60)}</td>
            <td><div className="meter"><i style={{ width: (x.pct * 100).toFixed(1) + '%' }} className={x.short ? 'part' : ''} /></div> {Math.round(x.pct * 100)}%</td></tr>
        ))}</tbody></table></div>
      <h2>Ωράριο μαγαζιών</h2>
      <div className="card">
        {R.stores.map((x) => (
          <div key={x.st.id} className="tl-row">
            <div><button className="link-btn" onClick={() => onGo(x.st.id)}>{x.st.name}</button>
              <div className="muted">{x.st.open24 ? '24ωρο' : x.win ? `${hm(x.win[0])}–${hm(x.win[1])}` : 'ωράριο δεν έχει οριστεί'}</div></div>
            <div className="tl-track">
              {x.win && <i className="tl-open" style={{ left: (x.win[0] / 14.4) + '%', width: (Math.min(1440, x.win[1]) - x.win[0]) / 14.4 + '%' }} />}
              {x.first != null && x.last != null && <i className="tl-here" style={{ left: (x.first / 14.4) + '%', width: Math.max(1, ((x.last > x.first ? x.last : 1440) - x.first) / 14.4) + '%' }} title={`${hm(x.first)}–${hm(x.last)}`} />}
            </div>
            <div>{x.hourIssues ? <span className="pill bad">{x.hourIssues} μέρες με κενό</span> : x.otMins ? <span className="pill warn">{fmtH(x.otMins)} ώρες υπερωρία</span> : (x.win || x.st.open24) ? <span className="pill good">✓ καλυμμένο</span> : null}</div>
          </div>
        ))}
      </div>
      <h2>Ανά άτομο</h2>
      <div className="card sch-scroll"><table>
        <thead><tr><th>Όνομα</th><th>Μαγαζί</th><th>Μέρες</th><th>Ώρες</th><th>Ρεπό</th><th>Άδεια</th><th>Νύχτες</th><th>Σε άλλο</th><th>Υπερωρία</th><th>6η μέρα</th><th>Θέματα</th></tr></thead>
        <tbody>{R.people.map((p) => (
          <tr key={p.s.id}><td>{p.s.name}</td><td>{p.store}</td><td>{p.work}</td>
            <td><div className="meter thin"><i style={{ width: (p.mins / maxM * 100).toFixed(1) + '%' }} /></div> {fmtH(p.mins)}</td>
            <td>{p.off}</td><td>{p.lv || '—'}</td><td>{p.night || '—'}</td><td>{p.cross || '—'}</td><td>{p.ot ? fmtH(p.ot) : '—'}</td><td>{p.six || '—'}</td><td>{p.issues || '—'}</td></tr>
        ))}</tbody></table></div>
      <h2>Τι θέλει διόρθωση</h2>
      {!R.issues.length ? <div className="card">Δεν βρέθηκε κανένα θέμα. Το πρόγραμμα του μήνα είναι εντάξει.</div> : groupsL.map(([t, label]) => {
        const list = R.issues.filter((i) => i.type === t).sort((a, b) => (a.d || 0) - (b.d || 0)); if (!list.length) return null
        return <div key={t} className="card" style={{ marginBottom: 10 }}><b>{label} ({list.length})</b>
          <ul className="sch-issues">{list.map((i, k) => <li key={k}><button className="link-btn" onClick={() => onGo(i.store)}><span className="idate">{i.d ? R.dl(i.d) : 'μήνας'}</span> {i.text}</button></li>)}</ul></div>
      })}
      {R.otList.length > 0 && <div className="card"><b>Υπερωρίες ({fmtH(R.otTotal)} ώρες)</b>
        <ul className="sch-issues">{R.otList.sort((a, b) => a.d - b.d).map((i, k) => <li key={k}><button className="link-btn" onClick={() => onGo(i.store)}><span className="idate">{R.dl(i.d)}</span> {i.text}</button></li>)}</ul></div>}
    </div>
  )
}
