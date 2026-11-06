import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useStores } from '../context/StoreContext'
import { useAuth } from '../context/AuthContext'
import { exportXlsx } from '../lib/exportExcel'
import { fileToPages } from '../lib/filePages'
import { Plus, X, Download, Copy, Mail, Trash2 } from 'lucide-react'

export const DL_ST = { draft: 'Πρόχειρο', pending: 'Αναμονή πελάτη', rejected: 'Απορρίφθηκε', accepted: 'Προς τιμολόγηση', invoiced: 'Τιμολογήθηκε' }
const COLOR = { draft: '#6b7785', pending: '#a86300', rejected: '#b3261e', accepted: '#1d7748', invoiced: '#1f4fa3' }
const LATE_DAYS = 3
const fmtD = (d) => (d ? new Date(d).toLocaleDateString('el-GR') : '—')
const fmtDT = (d) => (d ? new Date(d).toLocaleString('el-GR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '')
const eur = (n) => (n !== null && n !== undefined && n !== '' ? Number(n).toLocaleString('el-GR', { style: 'currency', currency: 'EUR' }) : '—')
const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const foldNum = (s) => fold(s).replace(/[\s\-/.]/g, '')
const okEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
const daysSince = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 864e5) : 0)
const isLate = (n) => n.status === 'pending' && daysSince(n.sent_at) >= LATE_DAYS
const monthOf = (n) => (n.event_date || n.created_at || '').slice(0, 7)
export const linkOf = (n) => `${window.location.origin}/d/${n.token}`

function Pill({ s, children }) {
  return <span style={{ color: COLOR[s], border: '1px solid currentColor', borderRadius: 999, padding: '2px 9px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{children || DL_ST[s]}</span>
}

export default function Deliveries() {
  const { stores } = useStores()
  const { role, profile } = useAuth()
  const kind = role === 'accounting' ? 'acct' : ['store_manager', 'shift_manager'].includes(role) ? 'store' : 'admin'
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [tab, setTab] = useState(kind === 'acct' ? 'accepted' : 'open')
  const [storeF, setStoreF] = useState('all')
  const [monthF, setMonthF] = useState('all')
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState('')
  const toast = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500) }
  const storeName = (id) => stores.find((s) => s.id === id)?.name || ''

  const load = useCallback(async () => {
    const { data } = await supabase.from('delivery_notes').select('*').order('updated_at', { ascending: false })
    setNotes(data || []); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const hist = (n, a) => [...(n.history || []), { t: new Date().toISOString(), a }]
  async function patch(n, fields, action) {
    const { error } = await supabase.from('delivery_notes').update({ ...fields, history: hist(n, action) }).eq('id', n.id)
    if (error) { toast('Δεν αποθηκεύτηκε: ' + error.message); return false }
    await load(); return true
  }

  const matchQ = (n) => { if (!q.trim()) return true; const t = fold(q.trim()); return [n.customer, n.num, n.event, n.customer_email, n.invoice_no, n.vat, storeName(n.store_id)].some((v) => fold(v).includes(t)) }
  const base = notes.filter((n) => (storeF === 'all' || n.store_id === storeF) && (monthF === 'all' || monthOf(n) === monthF))
  const months = [...new Set(notes.map(monthOf).filter(Boolean))].sort().reverse()
  const groups = {
    open: (n) => ['rejected', 'draft', 'pending'].includes(n.status), late: isLate, done: (n) => ['accepted', 'invoiced'].includes(n.status), all: () => true,
    accepted: (n) => n.status === 'accepted', invoiced: (n) => n.status === 'invoiced',
    draft: (n) => n.status === 'draft', pending: (n) => n.status === 'pending', rejected: (n) => n.status === 'rejected',
  }
  const order = (n) => (n.status === 'rejected' ? 0 : isLate(n) ? 1 : { draft: 2, pending: 3, accepted: 4, invoiced: 5 }[n.status])
  const chipsFor = kind === 'store' ? ['open', 'late', 'done', 'all'] : kind === 'acct' ? ['accepted', 'invoiced'] : ['all', 'late', 'draft', 'pending', 'rejected', 'accepted', 'invoiced']
  const chipLabel = { open: 'Εκκρεμότητες', late: `Καθυστερούν >${LATE_DAYS} ημ.`, done: 'Αποδεκτά', all: 'Όλα', accepted: 'Προς τιμολόγηση', invoiced: 'Τιμολογημένα', draft: 'Πρόχειρα', pending: 'Αναμονή πελάτη', rejected: 'Απορρίφθηκαν' }
  const shown = base.filter(groups[tab] || groups.all).filter(matchQ).sort((a, b) => order(a) - order(b))
  const open = notes.find((n) => n.id === openId)

  // πλήρη στατιστικά ροής
  const c = (ss) => notes.filter((n) => ss.includes(n.status)).length
  async function exportX() {
    if (!shown.length) return toast('Δεν υπάρχουν δελτία για εξαγωγή')
    const rows = [['Κατάστημα', 'Αρ. δελτίου ERP', 'Πελάτης', 'ΑΦΜ', 'Email πελάτη', 'Εκδήλωση', 'Ημ/νία εκδήλωσης', 'Ποσό (€)', 'Κατάσταση', 'Απάντηση πελάτη', 'Σχόλιο πελάτη', 'Αρ. τιμολογίου', 'Ημ/νία τιμολόγησης']]
    shown.forEach((n) => rows.push([storeName(n.store_id), n.num || '', n.customer, n.vat || '', n.customer_email, n.event, fmtD(n.event_date), n.amount !== null && n.amount !== '' ? Number(n.amount) : '', DL_ST[n.status], n.answered_at ? fmtD(n.answered_at) : '', n.customer_comment || '', n.invoice_no || '', n.invoiced_at ? fmtD(n.invoiced_at) : '']))
    await exportXlsx('deltia-ekdiloseon', [{ name: 'Deltia', rows }])
  }

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 12 }}><h1>Δελτία Εκδηλώσεων</h1></div>
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
        {[['draft', 'Κατάστημα', ['draft', 'rejected']], ['pending', 'Πελάτης', ['pending']], ['accepted', 'Λογιστήριο', ['accepted']], ['invoiced', 'Ολοκληρώθηκαν', ['invoiced']]].map(([s, l, ss]) => (
          <div key={s}><div className="stat-label" style={{ color: COLOR[s] }}>{l}</div><div className="stat-value" style={{ fontSize: 22 }}>{loading ? '…' : c(ss)}</div></div>
        ))}
      </div>
      {msg && <div className="sch-toast">{msg}</div>}
      <div className="dl-split">
        <div className={'card dl-list' + (openId || editing ? ' hide-m' : '')}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {kind === 'store' || kind === 'admin' ? <button className="btn" onClick={() => { setEditing({}); setOpenId(null) }}><Plus size={14} /> Νέο δελτίο</button> : null}
            {kind !== 'store' && <button className="btn btn-outline" onClick={exportX}><Download size={14} /> Excel</button>}
          </div>
          {kind !== 'store' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <select value={storeF} onChange={(e) => setStoreF(e.target.value)}><option value="all">Όλα τα καταστήματα</option>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <select value={monthF} onChange={(e) => setMonthF(e.target.value)}><option value="all">Όλοι οι μήνες</option>{months.map((m) => <option key={m} value={m}>{m}</option>)}</select>
            </div>
          )}
          <div className="sch-chips">
            {chipsFor.map((k) => { const cnt = base.filter(groups[k]).length; if (k === 'late' && !cnt) return null; return <button key={k} className={'sch-chip' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{chipLabel[k]} {cnt}</button> })}
          </div>
          <input type="search" placeholder="Αναζήτηση: πελάτης, αρ. ERP, email, τιμολόγιο" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
          {loading ? <p className="muted">Φόρτωση…</p> : !shown.length ? <p className="muted">{q.trim() ? 'Δεν βρέθηκε δελτίο.' : 'Δεν υπάρχουν δελτία εδώ.'}</p> : shown.map((n) => (
            <button key={n.id} className={'dl-row' + (n.id === openId ? ' cur' : '') + (isLate(n) ? ' late' : '')} onClick={() => { setOpenId(n.id); setEditing(null) }}>
              <b>{n.customer}</b>
              {isLate(n) ? <Pill s="rejected">Αναμονή {daysSince(n.sent_at)} ημ.</Pill> : <Pill s={n.status} />}
              <span className="muted">{n.num || '—'} · {n.event} · {fmtD(n.event_date)}{kind !== 'store' ? ' · ' + storeName(n.store_id) : ''}</span>
            </button>
          ))}
        </div>
        <div className={'card dl-detail' + (!openId && !editing ? ' hide-m' : '')}>
          {editing ? <DeliveryForm note={editing} kind={kind} stores={stores} profile={profile} notes={notes} onCancel={() => setEditing(null)} onSaved={async (id) => { await load(); setEditing(null); setOpenId(id) }} toast={toast} />
            : open ? <DeliveryDetail key={open.id + open.status + open.updated_at} n={open} kind={kind} storeName={storeName(open.store_id)} patch={patch} onEdit={() => setEditing(open)} onBack={() => setOpenId(null)} onDeleted={async () => { setOpenId(null); await load() }} toast={toast} />
              : <p className="muted">{kind === 'store' ? 'Επιλέξτε δελτίο ή δημιουργήστε νέο. Ανεβάστε το δελτίο αποστολής από το ERP και στείλτε το στον πελάτη.' : kind === 'acct' ? 'Επιλέξτε δελτίο για τιμολόγηση. Εδώ έρχονται μόνο όσα αποδέχτηκε ο πελάτης.' : 'Επιλέξτε δελτίο.'}</p>}
        </div>
      </div>
    </div>
  )
}

export function Pages({ imgs, empty }) {
  if (!imgs) return <p className="muted">Φόρτωση…</p>
  if (!imgs.length) return <p className="muted">{empty || 'Δεν έχει ανέβει αρχείο'}</p>
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '12px 0' }}>{imgs.map((s, i) => <img key={i} src={s} alt={'Σελίδα ' + (i + 1)} style={{ width: '100%', border: '1px solid #ddd', borderRadius: 4, background: '#fff' }} />)}</div>
}

function DeliveryDetail({ n, kind, storeName, patch, onEdit, onBack, onDeleted, toast }) {
  const [pages, setPages] = useState(null)
  const [invPages, setInvPages] = useState(null)
  const [invNo, setInvNo] = useState('')
  const [invFile, setInvFile] = useState(null)
  const [invTxt, setInvTxt] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('delivery_files').select('kind,i,data').eq('note_id', n.id).order('i')
      setPages((data || []).filter((f) => f.kind === 'note').map((f) => f.data))
      setInvPages((data || []).filter((f) => f.kind === 'invoice').map((f) => f.data))
    })()
  }, [n.id])
  const link = linkOf(n)
  const mailto = `mailto:${n.customer_email}?subject=${encodeURIComponent('Δελτίο αποστολής ' + (n.num || ''))}&body=${encodeURIComponent(`Καλησπέρα,\n\nπαρακαλούμε ελέγξτε το δελτίο αποστολής για την εκδήλωση «${n.event}» και απαντήστε με αποδοχή ή απόρριψη από τον παρακάτω σύνδεσμο:\n\n${link}\n\nΕυχαριστούμε.`)}`
  const copy = async () => { try { await navigator.clipboard.writeText(link); toast('Ο σύνδεσμος αντιγράφηκε') } catch { toast(link) } }
  async function doInvoice() {
    if (!invNo.trim()) return setErr('Γράψτε τον αριθμό τιμολογίου.')
    if (!invFile) return setErr('Ανεβάστε το τιμολόγιο.')
    setBusy(true); setErr('')
    try {
      const pg = await fileToPages(invFile)
      await supabase.from('delivery_files').delete().eq('note_id', n.id).eq('kind', 'invoice')
      const { error } = await supabase.from('delivery_files').insert(pg.map((data, i) => ({ note_id: n.id, company_id: n.company_id, kind: 'invoice', i, data })))
      if (error) throw error
      await patch(n, { status: 'invoiced', invoice_no: invNo.trim(), invoiced_at: new Date().toISOString() }, 'Τιμολογήθηκε · ' + invNo.trim())
      toast('Καταχωρήθηκε')
    } catch (e) { setErr('Η αποθήκευση απέτυχε: ' + (e.message || '')) } finally { setBusy(false) }
  }
  async function del() {
    const { error } = await supabase.from('delivery_notes').delete().eq('id', n.id)
    if (error) return toast('Η διαγραφή απέτυχε: ' + error.message)
    toast('Διαγράφηκε'); onDeleted()
  }
  const box = { marginTop: 14, padding: 14, border: '1px solid #ddd', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }
  return (
    <div>
      <button className="btn btn-outline back-m" onClick={onBack}>← Λίστα</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #222', paddingBottom: 8, marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Δελτίο αποστολής</h2><span className="muted">{n.num || 'χωρίς αριθμό'}</span><Pill s={n.status} />
      </div>
      <dl className="dl-kv">
        <dt>Κατάστημα</dt><dd>{storeName}</dd><dt>Πελάτης</dt><dd>{n.customer}{n.vat ? ' · ΑΦΜ ' + n.vat : ''}</dd>
        <dt>Email</dt><dd>{n.customer_email}</dd><dt>Εκδήλωση</dt><dd>{n.event}</dd><dt>Ημερομηνία</dt><dd>{fmtD(n.event_date)}</dd><dt>Ποσό</dt><dd>{eur(n.amount)}</dd>
        {n.remarks && <><dt>Σημειώσεις</dt><dd>{n.remarks}</dd></>}
      </dl>
      <Pages imgs={pages} />
      {(n.status === 'rejected' || n.customer_comment) && n.answered_at && (
        <div style={{ borderLeft: `3px solid ${n.status === 'rejected' ? COLOR.rejected : COLOR.accepted}`, padding: '8px 12px', background: '#f6f6f2', borderRadius: '0 8px 8px 0' }}>
          <b>{n.status === 'rejected' ? 'Απόρριψη' : 'Αποδοχή'} από {n.customer_email} · {fmtDT(n.answered_at)}</b>
          {n.customer_comment && <p style={{ margin: '4px 0 0' }}>{n.customer_comment}</p>}
        </div>
      )}
      {n.status === 'invoiced' && <><h3 style={{ marginTop: 18 }}>Τιμολόγιο {n.invoice_no} · {fmtD(n.invoiced_at)}</h3><Pages imgs={invPages} empty="Δεν επισυνάφθηκε αρχείο τιμολογίου" /></>}

      {kind !== 'acct' && n.status === 'draft' && <div style={box}><b>Επόμενο βήμα</b><p className="muted" style={{ margin: 0 }}>Ελέγξτε το δελτίο και στείλτε το στον πελάτη <b>{n.customer_email}</b>.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn" onClick={() => patch(n, { status: 'pending', sent_at: new Date().toISOString(), customer_comment: null, answered_at: null }, 'Στάλθηκε στο ' + n.customer_email).then((ok) => ok && toast('Έτοιμο για αποστολή. Στείλτε τον σύνδεσμο στον πελάτη.'))}>Αποστολή στον πελάτη</button><button className="btn btn-outline" onClick={onEdit}>Επεξεργασία</button></div></div>}
      {kind !== 'acct' && n.status === 'pending' && <div style={box}><b>Περιμένουμε απάντηση από τον πελάτη</b>
        <p className="muted" style={{ margin: 0 }}>Στάλθηκε {fmtDT(n.sent_at)}. Στείλτε στον πελάτη αυτόν τον σύνδεσμο (δεν χρειάζεται κωδικό):</p>
        <input readOnly value={link} onFocus={(e) => e.target.select()} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><a className="btn" href={mailto}><Mail size={14} /> Άνοιγμα email</a><button className="btn btn-outline" onClick={copy}><Copy size={14} /> Αντιγραφή συνδέσμου</button>
          <button className="btn btn-outline" onClick={() => patch(n, { status: 'draft' }, 'Ανάκληση αποστολής')}>Ανάκληση αποστολής</button></div></div>}
      {kind !== 'acct' && n.status === 'rejected' && <div style={box}><b>Ο πελάτης το απέρριψε, χρειάζεται διόρθωση</b><div><button className="btn" onClick={onEdit}>Διόρθωση & νέα αποστολή</button></div></div>}
      {kind !== 'acct' && n.status === 'accepted' && <div style={box}><b style={{ color: COLOR.accepted }}>Αποδεκτό, βρίσκεται στο λογιστήριο</b></div>}
      {n.status === 'accepted' && kind !== 'store' && (
        <div style={box}><b>Καταχώρηση τιμολογίου</b>
          <input placeholder="Αριθμός τιμολογίου, π.χ. ΤΠΥ-001245" value={invNo} onChange={(e) => setInvNo(e.target.value)} />
          <input type="file" accept="application/pdf,image/*" onChange={(e) => { setInvFile(e.target.files[0] || null); setInvTxt(e.target.files[0]?.name || '') }} />
          {invTxt && <span className="muted">{invTxt}</span>}
          {err && <span style={{ color: COLOR.rejected }}>{err}</span>}
          <div><button className="btn" disabled={busy} onClick={doInvoice}>{busy ? 'Αποθήκευση…' : 'Σήμανση ως τιμολογημένο'}</button></div></div>
      )}
      {n.status === 'invoiced' && kind !== 'store' && <div style={box}><b>Τιμολόγιο {n.invoice_no}</b><div><button className="btn btn-outline" onClick={async () => { await supabase.from('delivery_files').delete().eq('note_id', n.id).eq('kind', 'invoice'); patch(n, { status: 'accepted', invoice_no: null, invoiced_at: null }, 'Αναίρεση τιμολόγησης') }}>Αναίρεση</button></div></div>}
      {kind === 'admin' && <div style={box}><b>Διαγραφή δελτίου</b><p className="muted" style={{ margin: 0 }}>Οριστική διαγραφή του δελτίου και των αρχείων του.</p>
        {confirmDel ? <div style={{ display: 'flex', gap: 8 }}><button className="btn danger" onClick={del}><Trash2 size={14} /> Ναι, διαγραφή</button><button className="btn btn-outline" onClick={() => setConfirmDel(false)}>Άκυρο</button></div> : <div><button className="btn btn-outline danger" onClick={() => setConfirmDel(true)}>Διαγραφή</button></div>}</div>}
      {kind !== 'store' || n.history?.length ? <ul className="sch-issues" style={{ marginTop: 14 }}>{(n.history || []).map((x, i) => <li key={i} className="muted"><span className="idate">{fmtDT(x.t)}</span>{x.a}</li>)}</ul> : null}
    </div>
  )
}

function DeliveryForm({ note, kind, stores, profile, notes, onCancel, onSaved, toast }) {
  const isNew = !note.id, resend = note.status === 'rejected'
  const [f, setF] = useState({ store_id: note.store_id || (kind === 'store' ? profile?.store_id : '') || '', customer: note.customer || '', customer_email: note.customer_email || '', event: note.event || '', event_date: note.event_date || '', num: note.num || '', vat: note.vat || '', amount: note.amount ?? '', remarks: note.remarks || '' })
  const [pages, setPages] = useState(null)
  const [fname, setFname] = useState('')
  const [hasFile, setHasFile] = useState(!isNew)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [dupOk, setDupOk] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const dup = f.num && notes.find((x) => x.id !== note.id && foldNum(x.num) === foldNum(f.num))
  async function onFile(e) {
    const file = e.target.files[0]; if (!file) return
    setFname('Επεξεργασία αρχείου…')
    try { const p = await fileToPages(file); setPages(p); setHasFile(true); setFname(`${file.name} · ${p.length} σελ. έτοιμες`) } catch { setPages(null); setFname('Δεν διαβάστηκε το αρχείο. Δοκιμάστε φωτογραφία ή άλλο PDF.') }
  }
  async function submit(send) {
    const mail = f.customer_email.trim().toLowerCase()
    if (!f.store_id) return setErr('Διαλέξτε κατάστημα.')
    if (!f.customer.trim() || !f.event.trim()) return setErr('Συμπληρώστε πελάτη και εκδήλωση.')
    if (!okEmail(mail)) return setErr('Γράψτε σωστό email πελάτη.')
    if (!hasFile) return setErr('Ανεβάστε το δελτίο αποστολής.')
    if (dup && !dupOk) { setDupOk(true); return setErr(`Ο αριθμός ERP ${f.num} υπάρχει ήδη (${dup.customer} · ${DL_ST[dup.status]}). Αν είναι σωστός, πατήστε ξανά το κουμπί.`) }
    setErr(''); setBusy(true)
    try {
      const now = new Date().toISOString()
      const row = { store_id: f.store_id, num: f.num.trim() || null, event_date: f.event_date || null, customer: f.customer.trim(), customer_email: mail, vat: f.vat.trim() || null, event: f.event.trim(), amount: f.amount === '' ? null : Number(f.amount), remarks: f.remarks.trim() || null }
      const hist = [...(note.history || []), { t: now, a: isNew ? 'Δημιουργήθηκε' : resend ? 'Διορθώθηκε' : 'Επεξεργασία' }]
      if (send) { row.status = 'pending'; row.sent_at = now; row.customer_comment = null; row.answered_at = null; hist.push({ t: now, a: 'Στάλθηκε στο ' + mail }) }
      else row.status = note.status || 'draft'
      row.history = hist
      let id = note.id
      if (isNew) {
        const { data, error } = await supabase.from('delivery_notes').insert({ ...row, company_id: profile.company_id }).select('id').single()
        if (error) throw error; id = data.id
      } else { const { error } = await supabase.from('delivery_notes').update(row).eq('id', id); if (error) throw error }
      if (pages) {
        await supabase.from('delivery_files').delete().eq('note_id', id).eq('kind', 'note')
        const { error } = await supabase.from('delivery_files').insert(pages.map((data, i) => ({ note_id: id, company_id: profile.company_id, kind: 'note', i, data })))
        if (error) throw error
      }
      toast(send ? 'Έτοιμο για αποστολή. Στείλτε τον σύνδεσμο στον πελάτη.' : 'Αποθηκεύτηκε'); onSaved(id)
    } catch (e) { setErr('Η αποθήκευση απέτυχε: ' + (e.message || '')); setBusy(false) }
  }
  const fld = (label, el, full) => <div className="form-row" style={full ? { gridColumn: '1/-1' } : undefined}><label>{label}</label>{el}</div>
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><h2 style={{ margin: 0 }}>{isNew ? 'Νέο δελτίο' : resend ? 'Διόρθωση δελτίου' : 'Επεξεργασία δελτίου'}</h2><button className="icon-btn" onClick={onCancel}><X /></button></div>
      {resend && note.customer_comment && <div style={{ borderLeft: `3px solid ${COLOR.rejected}`, padding: '8px 12px', background: '#f6f6f2', margin: '10px 0' }}><b>Σχόλιο πελάτη</b><p style={{ margin: '4px 0 0' }}>{note.customer_comment}</p></div>}
      <div className="dl-form">
        {kind === 'admin' && fld('Κατάστημα *', <select value={f.store_id} onChange={(e) => set('store_id', e.target.value)}><option value="">—</option>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>, true)}
        {fld('Δελτίο αποστολής (PDF ή φωτογραφία) *', <><input type="file" accept="application/pdf,image/*" onChange={onFile} /><span className="muted">{fname || (hasFile ? 'Υπάρχει αρχείο. Επιλέξτε νέο για αντικατάσταση.' : '')}</span></>, true)}
        {fld('Πελάτης *', <input value={f.customer} onChange={(e) => set('customer', e.target.value)} placeholder="Επωνυμία" />)}
        {fld('Email πελάτη *', <input type="email" value={f.customer_email} onChange={(e) => set('customer_email', e.target.value)} />)}
        {fld('Εκδήλωση *', <input value={f.event} onChange={(e) => set('event', e.target.value)} placeholder="π.χ. Catering συνεδρίου, 120 άτομα" />, true)}
        {fld('Ημερομηνία εκδήλωσης', <input type="date" value={f.event_date} onChange={(e) => set('event_date', e.target.value)} />)}
        {fld('Αρ. δελτίου ERP', <><input value={f.num} onChange={(e) => { set('num', e.target.value); setDupOk(false) }} />{dup && <span style={{ color: COLOR.pending, fontSize: 13 }}>Υπάρχει ήδη: {dup.customer} · {DL_ST[dup.status]}</span>}</>)}
        {fld('ΑΦΜ', <input inputMode="numeric" value={f.vat} onChange={(e) => set('vat', e.target.value)} />)}
        {fld('Ποσό (€, προαιρετικό)', <input type="number" step="0.01" min="0" value={f.amount} onChange={(e) => set('amount', e.target.value)} />)}
        {fld('Σημειώσεις', <textarea value={f.remarks} onChange={(e) => set('remarks', e.target.value)} />, true)}
      </div>
      {err && <p style={{ color: COLOR.rejected }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn" disabled={busy} onClick={() => submit(true)}>{resend ? 'Αποθήκευση & νέα αποστολή' : 'Αποθήκευση & αποστολή'}</button>
        {!resend && <button className="btn btn-outline" disabled={busy} onClick={() => submit(false)}>Αποθήκευση ως πρόχειρο</button>}
        <button className="btn btn-outline" onClick={onCancel}>Άκυρο</button>
      </div>
    </div>
  )
}
