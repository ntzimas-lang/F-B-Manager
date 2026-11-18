import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activity'
import { useAuth } from '../context/AuthContext'
import { Plus, X, Trash2, FileText, Link2, Check } from 'lucide-react'
import { pdfPagesText } from '../lib/offerPdf'
import { bestMatch, sameUnit } from '../lib/offerMatch'

const money = (n) => (n == null || isNaN(n) ? '' : Number(n).toFixed(3).replace(/\.?0+$/, (m) => (m.length > 3 ? '' : m)) + ' €')
const today = () => new Date().toISOString().slice(0, 10)

export default function Offers() {
  const { profile } = useAuth()
  const [offers, setOffers] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [open, setOpen] = useState(null)
  const [msg, setMsg] = useState('')

  async function load() {
    const [{ data: o }, { data: s }] = await Promise.all([
      supabase.from('supplier_offers').select('*, suppliers(name), supplier_offer_items(count)').order('offer_date', { ascending: false }),
      supabase.from('suppliers').select('id, name').order('name'),
    ])
    setOffers(o || []); setSuppliers(s || [])
  }
  useEffect(() => { load() }, [])

  async function openPdf(o) {
    const { data, error } = await supabase.storage.from('offers').createSignedUrl(o.file_path, 300)
    if (error) return setMsg('Δεν άνοιξε το αρχείο.')
    window.open(data.signedUrl, '_blank', 'noopener')
  }
  async function remove(o) {
    if (!confirm(`Διαγραφή της προσφοράς «${o.title}»;`)) return
    await supabase.storage.from('offers').remove([o.file_path])
    await supabase.from('supplier_offers').delete().eq('id', o.id)
    await logActivity('delete', 'offer', o.title)
    load()
  }

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 16 }}><h1>Προσφορές προμηθευτών</h1></div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ margin: 0 }}>Αρχείο προσφορών ({offers.length})</h2>
          <button className="btn" onClick={() => setShowNew(true)}><Plus size={16} /> Νέα προσφορά (PDF)</button>
        </div>
        {msg && <p style={{ color: '#b3261e' }}>{msg}</p>}
        <table>
          <thead><tr><th>Ημερομηνία</th><th>Προμηθευτής</th><th>Τίτλος</th><th>Ισχύει έως</th><th>Προϊόντα</th><th></th></tr></thead>
          <tbody>
            {offers.map(o => {
              const n = o.supplier_offer_items?.[0]?.count || 0
              return (
                <tr key={o.id}>
                  <td>{o.offer_date}</td><td>{o.suppliers?.name || '—'}</td><td>{o.title}</td><td>{o.valid_until || '—'}</td>
                  <td>{n ? <button className="btn btn-outline" onClick={() => setOpen(o)}>{n} τιμές</button> : (o.read_status === 'scan' ? 'σκαναρισμένο PDF' : o.read_status === 'failed' ? 'δεν διαβάστηκε' : '—')}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="icon-btn" title="Άνοιγμα PDF" onClick={() => openPdf(o)}><FileText size={16} /></button>
                    <button className="icon-btn danger" title="Διαγραφή" onClick={() => remove(o)}><Trash2 size={16} /></button>
                  </td>
                </tr>
              )
            })}
            {offers.length === 0 && <tr><td colSpan={6}>Δεν έχει ανέβει καμία προσφορά ακόμη.</td></tr>}
          </tbody>
        </table>
      </div>
      {showNew && <NewOffer suppliers={suppliers} companyId={profile?.company_id} onClose={() => setShowNew(false)} onDone={(o) => { setShowNew(false); load(); if (o) setOpen(o) }} />}
      {open && <OfferItems offer={open} onClose={() => { setOpen(null); load() }} />}
    </div>
  )
}

function NewOffer({ suppliers, companyId, onClose, onDone }) {
  const [form, setForm] = useState({ supplier_id: '', title: '', offer_date: today(), valid_until: '', notes: '' })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')

  async function save() {
    if (!file) return setErr('Διάλεξε το PDF της προσφοράς.')
    if (!companyId) return setErr('Δεν βρέθηκε εταιρεία.')
    setErr(''); setBusy('Ανέβασμα αρχείου…')
    const path = `${companyId}/${crypto.randomUUID()}.pdf`
    const up = await supabase.storage.from('offers').upload(path, file, { contentType: 'application/pdf' })
    if (up.error) { setBusy(''); return setErr('Το αρχείο δεν ανέβηκε.') }
    const { data: offer, error } = await supabase.from('supplier_offers').insert({
      supplier_id: form.supplier_id || null, title: form.title || file.name.replace(/\.pdf$/i, ''), offer_date: form.offer_date || today(),
      valid_until: form.valid_until || null, notes: form.notes || null, file_path: path, file_name: file.name, company_id: companyId,
    }).select().single()
    if (error) { await supabase.storage.from('offers').remove([path]); setBusy(''); return setErr('Δεν αποθηκεύτηκε η προσφορά.') }
    await logActivity('create', 'offer', offer.title)
    // Ανάγνωση τιμών σελίδα-σελίδα
    let status = 'read', total = 0
    try {
      const pages = await pdfPagesText(file)
      if (!pages.join('').trim()) status = 'scan'
      else {
        let pos = 0
        for (let i = 0; i < pages.length; i++) {
          setBusy(`Ανάγνωση τιμών… σελίδα ${i + 1} από ${pages.length}`)
          if (!pages[i].trim()) continue
          const { data, error: fe } = await supabase.functions.invoke('read-offer', { body: { text: pages[i] } })
          if (fe || data?.error) { status = total ? 'read' : 'failed'; continue }
          const rows = (data.items || []).filter(x => x?.name && Number(x.price) > 0).map(x => ({
            offer_id: offer.id, company_id: companyId, pos: pos++, category: x.category || null, code: x.code || null,
            name: String(x.name).trim(), unit: x.unit || null, price: Number(x.price),
          }))
          if (rows.length) { const ins = await supabase.from('supplier_offer_items').insert(rows); if (!ins.error) total += rows.length }
        }
        if (!total) status = 'failed'
      }
    } catch { status = 'failed' }
    await supabase.from('supplier_offers').update({ read_status: status }).eq('id', offer.id)
    setBusy('')
    onDone(total ? offer : null)
  }

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><h2>Νέα προσφορά</h2>{!busy && <button className="icon-btn" onClick={onClose}><X /></button>}</div>
        <div className="form-row"><label>Αρχείο PDF</label><input type="file" accept="application/pdf,.pdf" onChange={e => setFile(e.target.files[0] || null)} /></div>
        <div className="form-row"><label>Προμηθευτής</label>
          <select value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })}>
            <option value="">— επέλεξε —</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-row"><label>Τίτλος (προαιρετικά)</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
        <div className="form-row"><label>Ημερομηνία προσφοράς</label><input type="date" value={form.offer_date} onChange={e => setForm({ ...form, offer_date: e.target.value })} /></div>
        <div className="form-row"><label>Ισχύει έως (προαιρετικά)</label><input type="date" value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} /></div>
        <div className="form-row"><label>Σημείωση</label><input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
        {err && <p style={{ color: '#b3261e' }}>{err}</p>}
        {busy && <p>{busy}</p>}
        <div className="modal-actions"><button className="btn" disabled={!!busy} onClick={save}>Αποθήκευση και ανάγνωση τιμών</button></div>
      </div>
    </div>
  )
}

function OfferItems({ offer, onClose }) {
  const [items, setItems] = useState([])
  const [ings, setIngs] = useState([])
  const [q, setQ] = useState('')
  const [onlyLinked, setOnlyLinked] = useState(false)
  const [note, setNote] = useState('')

  async function load() {
    const [{ data: it }, { data: ig }] = await Promise.all([
      (async () => { const out = []; for (let f = 0; ; f += 1000) { const { data } = await supabase.from('supplier_offer_items').select('*').eq('offer_id', offer.id).order('pos').range(f, f + 999); out.push(...(data || [])); if (!data || data.length < 1000) break } return { data: out } })(),
      supabase.from('ingredients').select('id, name, unit, current_price').order('name'),
    ])
    setItems(it || []); setIngs(ig || [])
  }
  useEffect(() => { load() }, [])
  const ingMap = useMemo(() => Object.fromEntries(ings.map(i => [i.id, i])), [ings])
  const suggest = useMemo(() => {
    const o = {}
    for (const it of items) if (!it.ingredient_id) { const m = bestMatch(it.name, ings); if (m) o[it.id] = m.ingredient }
    return o
  }, [items, ings])

  async function link(it, ingId) {
    await supabase.from('supplier_offer_items').update({ ingredient_id: ingId || null }).eq('id', it.id)
    setItems(items.map(x => x.id === it.id ? { ...x, ingredient_id: ingId || null } : x))
  }
  async function linkAllSuggested() {
    const ids = Object.entries(suggest)
    if (!ids.length) return
    if (!confirm(`Σύνδεση ${ids.length} προϊόντων με τα προτεινόμενα υλικά; Μπορείς να τα αλλάξεις μετά.`)) return
    for (const [itemId, ing] of ids) await supabase.from('supplier_offer_items').update({ ingredient_id: ing.id }).eq('id', itemId)
    load()
  }
  async function updatePrice(it) {
    const ing = ingMap[it.ingredient_id]
    if (!ing) return
    const warn = sameUnit(it.unit, ing.unit) ? '' : `\n\nΠροσοχή: η μονάδα της προσφοράς (${it.unit || '?'}) διαφέρει από του υλικού (${ing.unit}).`
    if (!confirm(`Αλλαγή τιμής «${ing.name}» από ${Number(ing.current_price).toFixed(3)} € σε ${Number(it.price).toFixed(3)} €;${warn}`)) return
    const { error } = await supabase.from('ingredients').update({ current_price: it.price }).eq('id', ing.id)
    if (error) return setNote('Δεν άλλαξε η τιμή.')
    await logActivity('update', 'ingredient', ing.name)
    setIngs(ings.map(x => x.id === ing.id ? { ...x, current_price: it.price } : x)); setNote(`Ενημερώθηκε: ${ing.name}`)
  }

  const shown = items.filter(it => (!onlyLinked || it.ingredient_id) && (!q || (it.name + ' ' + (it.category || '')).toLowerCase().includes(q.toLowerCase())))
  let lastCat = null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 1100, width: '96vw' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h2>{offer.title} — {offer.suppliers?.name || ''} <span style={{ fontSize: 13, fontWeight: 400 }}>{offer.offer_date}</span></h2>
          <button className="icon-btn" onClick={onClose}><X /></button>
        </div>
        <p style={{ fontSize: 12, color: '#666', margin: '0 0 8px' }}>Οι τιμές είναι όπως γράφονται στην προσφορά (συνήθως χωρίς ΦΠΑ). Σύνδεσε κάθε προϊόν με υλικό σου και πάτα «Ενημέρωση τιμής» όπου θέλεις.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <input placeholder="Αναζήτηση…" value={q} onChange={e => setQ(e.target.value)} />
          <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={onlyLinked} onChange={e => setOnlyLinked(e.target.checked)} /> Μόνο συνδεδεμένα</label>
          <button className="btn btn-outline" onClick={linkAllSuggested}><Link2 size={14} /> Σύνδεση όλων των προτάσεων ({Object.keys(suggest).length})</button>
          {note && <span style={{ color: '#1f7a43', alignSelf: 'center' }}><Check size={14} /> {note}</span>}
        </div>
        <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
          <table>
            <thead><tr><th>Προϊόν προσφοράς</th><th>Μον.</th><th>Τιμή</th><th>Υλικό μου</th><th>Τρέχουσα</th><th>Διαφορά</th><th></th></tr></thead>
            <tbody>
              {shown.map(it => {
                const ing = ingMap[it.ingredient_id]
                const sug = !ing && suggest[it.id]
                const diff = ing && Number(ing.current_price) > 0 ? ((Number(it.price) - Number(ing.current_price)) / Number(ing.current_price)) * 100 : null
                const head = it.category !== lastCat ? (lastCat = it.category, <tr key={'c' + it.id}><td colSpan={7} style={{ background: '#f3f4f1', fontWeight: 700 }}>{it.category}</td></tr>) : null
                return [head,
                  <tr key={it.id}>
                    <td>{it.name}</td><td>{it.unit}</td><td><b>{Number(it.price).toFixed(2)} €</b></td>
                    <td>
                      <select value={it.ingredient_id || ''} onChange={e => link(it, e.target.value)} style={{ maxWidth: 220 }}>
                        <option value="">{sug ? `Πρόταση: ${sug.name}` : '— καμία —'}</option>
                        {ings.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                      {sug && <button className="icon-btn" title="Αποδοχή πρότασης" onClick={() => link(it, sug.id)}><Check size={14} /></button>}
                    </td>
                    <td>{ing ? Number(ing.current_price).toFixed(3) + ' €/' + ing.unit : ''}</td>
                    <td style={{ color: diff == null ? undefined : diff < 0 ? '#1f7a43' : diff > 0 ? '#b3261e' : undefined }}>{diff == null ? '' : (diff > 0 ? '+' : '') + diff.toFixed(1) + '%'}</td>
                    <td>{ing && <button className="btn btn-outline" onClick={() => updatePrice(it)}>Ενημέρωση τιμής</button>}</td>
                  </tr>]
              })}
              {shown.length === 0 && <tr><td colSpan={7}>Κανένα αποτέλεσμα.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
