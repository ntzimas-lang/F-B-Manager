import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Pages } from './Deliveries'

// Δημόσια σελίδα πελάτη: /d/<token> — χωρίς σύνδεση
export default function DeliveryPublic({ token }) {
  const [n, setN] = useState(undefined)
  const [comment, setComment] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const load = async () => { const { data } = await supabase.rpc('get_delivery_by_token', { p_token: token }); setN(data || null) }
  useEffect(() => { load() }, [token])
  async function answer(yes) {
    if (!yes && !comment.trim()) return setErr('Γράψτε τι δεν είναι σωστό, για να το διορθώσει το κατάστημα.')
    setBusy(true); setErr('')
    const { data, error } = await supabase.rpc('answer_delivery', { p_token: token, p_accept: yes, p_comment: comment })
    setBusy(false)
    if (error || !data) return setErr('Η απάντηση δεν αποθηκεύτηκε. Ίσως έχει ήδη απαντηθεί.')
    load()
  }
  const wrap = { maxWidth: 760, margin: '0 auto', padding: 16, fontFamily: 'system-ui, sans-serif' }
  if (n === undefined) return <div style={wrap}>Φόρτωση…</div>
  if (!n) return <div style={wrap}><h2>Το δελτίο δεν βρέθηκε</h2><p>Ο σύνδεσμος δεν είναι σωστός ή το δελτίο ανακλήθηκε.</p></div>
  const row = (k, v) => v ? <><dt style={{ color: '#666', fontSize: 13 }}>{k}</dt><dd style={{ margin: 0 }}>{v}</dd></> : null
  return (
    <div style={wrap}>
      <h1 style={{ marginBottom: 4 }}>Δελτίο αποστολής</h1>
      <p style={{ color: '#666', marginTop: 0 }}>Παρακαλούμε ελέγξτε το και απαντήστε με αποδοχή ή απόρριψη.</p>
      <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '6px 16px' }}>
        {row('Από κατάστημα', n.store)}{row('Αρ. δελτίου', n.num)}{row('Πελάτης', n.customer)}{row('Εκδήλωση', n.event)}
        {row('Ημερομηνία', n.event_date ? new Date(n.event_date).toLocaleDateString('el-GR') : '')}
        {row('Ποσό', n.amount !== null && n.amount !== undefined ? Number(n.amount).toLocaleString('el-GR', { style: 'currency', currency: 'EUR' }) : '')}{row('Σημειώσεις', n.remarks)}
      </dl>
      <Pages imgs={n.pages} />
      {n.status === 'pending' ? (
        <div style={{ border: '1px solid #ddd', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <b>Η απάντησή σας</b>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Σχόλιο (υποχρεωτικό σε απόρριψη), π.χ. Λείπουν 10 μερίδες από το δελτίο" style={{ minHeight: 70 }} />
          {err && <span style={{ color: '#b3261e' }}>{err}</span>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ background: '#1d7748' }} disabled={busy} onClick={() => answer(true)}>Αποδοχή</button>
            <button className="btn btn-outline" style={{ color: '#b3261e', borderColor: '#b3261e' }} disabled={busy} onClick={() => answer(false)}>Απόρριψη</button>
          </div>
        </div>
      ) : (
        <div style={{ border: '1px solid #ddd', borderRadius: 10, padding: 14 }}>
          <b>{n.status === 'rejected' ? 'Στείλατε απόρριψη στο κατάστημα. Θα λάβετε το διορθωμένο δελτίο.' : n.status === 'invoiced' ? 'Το τιμολόγιο εκδόθηκε.' : 'Ευχαριστούμε, αποδεχτήκατε το δελτίο. Το τιμολόγιο θα σας σταλεί από το λογιστήριο.'}</b>
          {n.status === 'invoiced' && <><p>Τιμολόγιο {n.invoice_no}</p><Pages imgs={n.invoice_pages} empty="" /></>}
        </div>
      )}
    </div>
  )
}
